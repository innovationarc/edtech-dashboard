// src/services/novaChatHistoryService.ts
// Persistent chat history for Nova UI display.
//
// Schema: novaChats/{userId}/messages/{msgId}
//   text      : string
//   sender    : 'user' | 'ai'
//   timestamp : Timestamp
//   sessionId : string
//
// Retention: last 30 days shown in UI. Messages older than 30 days are
// pruned opportunistically on each session load (fire-and-forget).
//
// This is SEPARATE from novaMemoryService (novaMessages/{uid}/messages)
// which is short-term RAG context. This collection is purely for UI history
// and last-N-messages AI context injection.

import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
  writeBatch,
  limit,
} from 'firebase/firestore';
import { db } from '../config/firebase';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NovaChatMessage {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date;
  sessionId: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDate(v: any): Date {
  if (!v) return new Date();
  if (v instanceof Date) return v;
  if (typeof v.toDate === 'function') return v.toDate();
  return new Date(v);
}

function chatCol(userId: string) {
  return collection(db, 'novaChats', userId, 'messages');
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const novaChatHistoryService = {

  /**
   * Save a single message to persistent history.
   * Fire-and-forget safe.
   */
  async saveMessage(
    userId: string,
    message: { text: string; sender: 'user' | 'ai'; sessionId: string }
  ): Promise<NovaChatMessage | null> {
    try {
      const ref = await addDoc(chatCol(userId), {
        text:      message.text,
        sender:    message.sender,
        sessionId: message.sessionId,
        timestamp: Timestamp.now(),
      });
      return {
        id:        ref.id,
        text:      message.text,
        sender:    message.sender,
        sessionId: message.sessionId,
        timestamp: new Date(),
      };
    } catch (e) {
      console.warn('[novaChatHistory] saveMessage failed (non-fatal):', e);
      return null;
    }
  },

  /**
   * Fetch messages from the last 30 days for UI display, oldest first.
   * Also prunes messages older than 30 days (fire-and-forget).
   */
  async getHistory(userId: string): Promise<NovaChatMessage[]> {
    try {
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const cutoffTs = Timestamp.fromDate(cutoff);

      let snap;
      try {
        snap = await getDocs(
          query(
            chatCol(userId),
            where('timestamp', '>=', cutoffTs),
            orderBy('timestamp', 'asc')
          )
        );
      } catch {
        // Composite index may not exist yet — fallback without orderBy
        snap = await getDocs(
          query(chatCol(userId), where('timestamp', '>=', cutoffTs))
        );
      }

      const messages: NovaChatMessage[] = snap.docs.map(d => ({
        id:        d.id,
        text:      d.data().text      || '',
        sender:    d.data().sender    || 'user',
        sessionId: d.data().sessionId || '',
        timestamp: toDate(d.data().timestamp),
      }));

      // Chronological order regardless of query path
      messages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

      // Prune older messages opportunistically (fire-and-forget, don't await)
      this.pruneOldMessages(userId, 30 * 24).catch(() => {});

      return messages;
    } catch (e) {
      console.warn('[novaChatHistory] getHistory failed (non-fatal):', e);
      return [];
    }
  },

  /**
   * Get last N messages for AI context injection.
   * Returns plain {sender, text} pairs suitable for prompt building.
   */
  async getRecentForContext(
    userId: string,
    n = 6
  ): Promise<Array<{ sender: 'user' | 'ai'; text: string }>> {
    try {
      // Fetch last N*2 docs (each exchange = 2 msgs) then slice
      let snap;
      try {
        snap = await getDocs(
          query(chatCol(userId), orderBy('timestamp', 'desc'), limit(n * 2))
        );
      } catch {
        // Index fallback
        snap = await getDocs(query(chatCol(userId), limit(n * 2)));
      }

      const msgs = snap.docs
        .map(d => ({
          sender:    (d.data().sender || 'user') as 'user' | 'ai',
          text:      (d.data().text   || '') as string,
          ts:        toDate(d.data().timestamp).getTime(),
        }))
        .sort((a, b) => a.ts - b.ts)  // oldest first for prompt
        .slice(-n);                    // last N

      return msgs.map(m => ({ sender: m.sender, text: m.text }));
    } catch (e) {
      console.warn('[novaChatHistory] getRecentForContext failed (non-fatal):', e);
      return [];
    }
  },

  /**
   * Delete messages older than `hours` hours. Batched in 500-doc chunks.
   */
  async pruneOldMessages(userId: string, hours = 30 * 24): Promise<void> {
    try {
      const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
      const snap = await getDocs(
        query(chatCol(userId), where('timestamp', '<', Timestamp.fromDate(cutoff)))
      );
      if (snap.empty) return;
      const CHUNK = 500;
      for (let i = 0; i < snap.docs.length; i += CHUNK) {
        const batch = writeBatch(db);
        snap.docs.slice(i, i + CHUNK).forEach(d => batch.delete(d.ref));
        await batch.commit();
      }
    } catch (e) {
      console.warn('[novaChatHistory] pruneOldMessages failed (non-fatal):', e);
    }
  },
};
