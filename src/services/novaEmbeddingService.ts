// src/services/novaEmbeddingService.ts
// Nova RAG — Gemini text-embedding-004 embeddings with key rotation
//
// Key group: looks up the group named exactly "vector" (case-insensitive) in
// aiKeyGroupService. Only Gemini keys in that group are eligible (this is a
// Gemini-only embedding API). Falls back to VITE_GEMINI_API_KEY env var.
//
// Intentionally separate from callWithFailover — the embedding endpoint is
// completely different from chat completions and must not share key state.

import { aiKeyGroupService } from './aiModelConfigService';

// ─── Constants ────────────────────────────────────────────────────────────────

const EMBEDDING_MODEL      = 'text-embedding-004';
const EMBEDDING_DIMENSIONS = 768;

const embeddingUrl = (apiKey: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent?key=${apiKey}`;

// ─── Math ─────────────────────────────────────────────────────────────────────

/**
 * Cosine similarity between two equal-length float vectors.
 * Returns a value in [-1, 1]. Higher means more semantically similar.
 * Returns 0 for empty or mismatched vectors instead of NaN.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (!Array.isArray(a) || !Array.isArray(b)) return 0;
  if (a.length !== b.length || a.length === 0)  return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot  += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

// ─── Key resolution ───────────────────────────────────────────────────────────

/**
 * Returns ordered list of active Gemini API keys from the "vector" key group.
 * Sort: lowest errorCount first, then lowest priority number first.
 * Falls back to VITE_GEMINI_API_KEY env var when no group is configured.
 */
async function resolveVectorKeys(): Promise<string[]> {
  try {
    const config = await aiKeyGroupService.getConfig();
    const group = config.groups.find(
      g => g.name.trim().toLowerCase() === 'vector'
    );
    if (group && group.keys.length > 0) {
      const activeKeys = group.keys
        .filter(k => !k.isDisabled && k.provider === 'gemini' && k.apiKey?.trim())
        .sort((a, b) =>
          a.errorCount !== b.errorCount
            ? a.errorCount - b.errorCount
            : a.priority - b.priority
        )
        .map(k => k.apiKey.trim());
      if (activeKeys.length > 0) return activeKeys;
    }
  } catch (e) {
    console.warn('[novaEmbedding] Could not load vector key group, using env fallback:', e);
  }
  // Final fallback — env var (works in dev without a Firestore group configured)
  const envKey = (import.meta as any).env?.VITE_GEMINI_API_KEY?.trim() || '';
  if (envKey) return [envKey];
  return [];
}

// ─── Single-key API call ──────────────────────────────────────────────────────

async function callGeminiEmbed(text: string, apiKey: string): Promise<number[]> {
  const res = await fetch(embeddingUrl(apiKey), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: `models/${EMBEDDING_MODEL}`,
      content: { parts: [{ text }] },
    }),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => res.statusText);
    throw new Error(`Gemini Embed ${res.status}: ${errBody}`);
  }

  const data = await res.json();
  const values: number[] | undefined = data?.embedding?.values;

  if (!Array.isArray(values) || values.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Gemini Embed: unexpected shape — got ${values?.length ?? 0} dims, expected ${EMBEDDING_DIMENSIONS}`
    );
  }
  return values;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Embed a text string using Gemini text-embedding-004.
 * Rotates through all active keys in the "vector" group with automatic failover.
 *
 * @throws Error if all keys fail or none are configured.
 */
export async function embedText(text: string): Promise<number[]> {
  const trimmed = text?.trim();
  if (!trimmed) throw new Error('[novaEmbedding] Cannot embed empty text.');

  const keys = await resolveVectorKeys();

  if (keys.length === 0) {
    throw new Error(
      'No Gemini embedding keys configured. ' +
      'Create a key group named "vector" in Admin → AI Model Settings and add Gemini API keys.'
    );
  }

  let lastError: Error | null = null;

  for (const key of keys) {
    try {
      return await callGeminiEmbed(trimmed, key);
    } catch (e: any) {
      lastError = e instanceof Error ? e : new Error(String(e));
      console.warn('[novaEmbedding] Key failed, trying next:', lastError.message);
    }
  }

  throw lastError ?? new Error('[novaEmbedding] All vector keys failed.');
}
