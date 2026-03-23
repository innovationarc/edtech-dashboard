// src/services/novaContextService.ts
// Nova RAG — Admin-managed context documents stored in Firestore.
// On every create/update the content is embedded with Gemini text-embedding-004
// and the 768-dim vector is stored alongside the document so similarity search
// can be done entirely client-side (no server, no vector DB).
//
// Collection: novaContextDocs/{docId}
// Config doc: settings/novaConfig

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  setDoc,
  Timestamp,
  orderBy,
  query,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { embedText, cosineSimilarity } from './novaEmbeddingService';

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface NovaContextDoc {
  id: string;
  title: string;
  content: string;
  /** 768-dimensional Gemini text-embedding-004 vector */
  embedding: number[];
  tags: string[];
  updatedAt: Date;
  createdAt: Date;
  createdBy: string; // admin UID
  /** 'pending' = saved but not yet embedded; 'ready' = embedding exists; 'error' = embedding failed */
  embeddingStatus: 'pending' | 'ready' | 'error';
  embeddingError?: string;
}

export interface NovaConfig {
  systemPrompt: string;
  navigationEnabled: boolean;
  maxContextDocs: number;  // default 3
  memoryHours: number;     // default 48
}

const NOVA_DOCS_COL  = 'novaContextDocs';
const NOVA_CONFIG_DOC = 'settings/novaConfig';

// ─── Module-level caches ──────────────────────────────────────────────────────
// getConfig and getAllDocs are called on EVERY Nova message. Cache them to avoid
// per-message Firestore reads. Config changes rarely; docs change only when admin edits them.
let configCache: { data: NovaConfig; ts: number } | null = null;
const CONFIG_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

let docsCache: { data: NovaContextDoc[]; ts: number } | null = null;
const DOCS_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

/** Call this after saving/updating config or docs to force a fresh fetch next time. */
export function invalidateNovaCache() {
  configCache = null;
  docsCache = null;
}

const DEFAULT_CONFIG: NovaConfig = {
  systemPrompt: '',
  navigationEnabled: true,
  maxContextDocs: 3,
  memoryHours: 48,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDate(v: any): Date {
  if (!v) return new Date();
  if (v instanceof Date) return v;
  if (typeof v.toDate === 'function') return v.toDate();
  return new Date(v);
}

function docToNovaContextDoc(id: string, d: any): NovaContextDoc {
  return {
    id,
    title: d.title || '',
    content: d.content || '',
    embedding: Array.isArray(d.embedding) ? d.embedding : [],
    tags: Array.isArray(d.tags) ? d.tags : [],
    updatedAt: toDate(d.updatedAt),
    createdAt: toDate(d.createdAt),
    createdBy: d.createdBy || '',
    embeddingStatus: d.embeddingStatus || 'pending',
    embeddingError: d.embeddingError,
  };
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const novaContextService = {

  // ── Config ─────────────────────────────────────────────────────────────────

  async getConfig(): Promise<NovaConfig> {
    // Return cached config if still fresh — avoids a Firestore read per message
    if (configCache && Date.now() - configCache.ts < CONFIG_CACHE_TTL) {
      return configCache.data;
    }
    try {
      const snap = await getDoc(doc(db, NOVA_CONFIG_DOC));
      if (snap.exists()) {
        const d = snap.data();
        const result: NovaConfig = {
          systemPrompt:      d.systemPrompt      ?? DEFAULT_CONFIG.systemPrompt,
          navigationEnabled: d.navigationEnabled  ?? DEFAULT_CONFIG.navigationEnabled,
          maxContextDocs:    d.maxContextDocs     ?? DEFAULT_CONFIG.maxContextDocs,
          memoryHours:       d.memoryHours        ?? DEFAULT_CONFIG.memoryHours,
        };
        configCache = { data: result, ts: Date.now() };
        return result;
      }
    } catch (e) {
      console.warn('[novaContext] Failed to load novaConfig, using defaults:', e);
    }
    return { ...DEFAULT_CONFIG };
  },

  async saveConfig(config: Partial<NovaConfig>, adminUid: string): Promise<void> {
    await setDoc(
      doc(db, NOVA_CONFIG_DOC),
      { ...config, updatedAt: Timestamp.now(), updatedBy: adminUid },
      { merge: true }
    );
    configCache = null; // invalidate so next read gets fresh config
  },

  // ── CRUD ───────────────────────────────────────────────────────────────────

  /** Fetch all context docs, ordered by createdAt desc. */
  async getAllDocs(): Promise<NovaContextDoc[]> {
    // Return cached docs if still fresh — same docs are fetched for every student every message
    if (docsCache && Date.now() - docsCache.ts < DOCS_CACHE_TTL) {
      return docsCache.data;
    }
    try {
      const snap = await getDocs(
        query(collection(db, NOVA_DOCS_COL), orderBy('createdAt', 'desc'))
      );
      const result = snap.docs.map(d => docToNovaContextDoc(d.id, d.data()));
      docsCache = { data: result, ts: Date.now() };
      return result;
    } catch {
      // Fallback if index not yet created
      const snap = await getDocs(collection(db, NOVA_DOCS_COL));
      const result = snap.docs
        .map(d => docToNovaContextDoc(d.id, d.data()))
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      docsCache = { data: result, ts: Date.now() };
      return result;
    }
  },

  /**
   * Create a new context document.
   * Immediately tries to generate its embedding. Saves with embeddingStatus='pending'
   * first so the doc exists even if embedding is slow; updates to 'ready' after.
   */
  async createDoc(
    payload: { title: string; content: string; tags: string[] },
    createdBy: string
  ): Promise<string> {
    const now = Timestamp.now();
    const docRef = await addDoc(collection(db, NOVA_DOCS_COL), {
      title: payload.title.trim(),
      content: payload.content.trim(),
      tags: payload.tags,
      embedding: [],
      embeddingStatus: 'pending',
      createdBy,
      createdAt: now,
      updatedAt: now,
    });

    // Generate embedding asynchronously after doc creation
    novaContextService._embedAndUpdate(docRef.id, payload.content).catch(() => {
      // Logged inside _embedAndUpdate — never crash the caller
    });

    return docRef.id;
  },

  /**
   * Update an existing document's content/tags.
   * Triggers re-embedding when content changes.
   */
  async updateDoc(
    docId: string,
    updates: { title?: string; content?: string; tags?: string[] }
  ): Promise<void> {
    const payload: Record<string, any> = {
      updatedAt: Timestamp.now(),
    };
    if (updates.title   !== undefined) payload.title   = updates.title.trim();
    if (updates.tags    !== undefined) payload.tags    = updates.tags;
    if (updates.content !== undefined) {
      payload.content         = updates.content.trim();
      payload.embeddingStatus = 'pending';
      payload.embedding       = [];
    }

    await updateDoc(doc(db, NOVA_DOCS_COL, docId), payload);

    // Re-embed if content changed
    if (updates.content !== undefined) {
      novaContextService._embedAndUpdate(docId, updates.content).catch(() => {});
    }
  },

  async deleteDoc(docId: string): Promise<void> {
    await deleteDoc(doc(db, NOVA_DOCS_COL, docId));
  },

  /**
   * Re-trigger embedding for a document that is in 'pending' or 'error' state.
   */
  async retryEmbedding(docId: string): Promise<void> {
    const snap = await getDoc(doc(db, NOVA_DOCS_COL, docId));
    if (!snap.exists()) throw new Error(`Doc ${docId} not found`);
    const content: string = snap.data().content || '';
    await updateDoc(doc(db, NOVA_DOCS_COL, docId), {
      embeddingStatus: 'pending',
      embeddingError:  null,
      updatedAt:       Timestamp.now(),
    });
    await novaContextService._embedAndUpdate(docId, content);
  },

  // ── Embedding ──────────────────────────────────────────────────────────────

  /** Internal: call Gemini, write vector + status back to Firestore. */
  async _embedAndUpdate(docId: string, content: string): Promise<void> {
    try {
      const embedding = await embedText(content);
      await updateDoc(doc(db, NOVA_DOCS_COL, docId), {
        embedding,
        embeddingStatus: 'ready',
        embeddingError:  null,
        updatedAt:       Timestamp.now(),
      });
    } catch (e: any) {
      const errMsg = e?.message || 'Embedding failed';
      console.error('[novaContext] Embedding failed for doc', docId, errMsg);
      await updateDoc(doc(db, NOVA_DOCS_COL, docId), {
        embeddingStatus: 'error',
        embeddingError:  errMsg,
        updatedAt:       Timestamp.now(),
      }).catch(() => {});
    }
  },

  // ── Retrieval ──────────────────────────────────────────────────────────────

  /**
   * Embed a query string and return the top-N most relevant context docs.
   * Only docs with embeddingStatus === 'ready' and non-empty embeddings are scored.
   * Returns at most `maxDocs` results with similarity >= threshold.
   */
  async getTopRelevantDocs(
    query: string,
    maxDocs = 3,
    threshold = 0.35
  ): Promise<Array<NovaContextDoc & { similarity: number }>> {
    const [queryEmbedding, allDocs] = await Promise.all([
      embedText(query),
      novaContextService.getAllDocs(),
    ]);

    const readyDocs = allDocs.filter(
      d => d.embeddingStatus === 'ready' && d.embedding.length > 0
    );

    const scored = readyDocs
      .map(d => ({ ...d, similarity: cosineSimilarity(queryEmbedding, d.embedding) }))
      .filter(d => d.similarity >= threshold)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, maxDocs);

    return scored;
  },
};
