// src/services/novaMemoryService.ts
// Nova RAG — Conversation memory stored in Firestore subcollection.
//
// Schema: novaMessages/{userId}/messages/{msgId}
//   text      : string
//   sender    : 'user' | 'ai'
//   timestamp : Timestamp
//   sessionId : string

import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
  deleteDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../config/firebase';

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface NovaMessage {
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

function messagesCol(userId: string) {
  return collection(db, 'novaMessages', userId, 'messages');
}

// ─── Service ──────────────────────────────────────────────────────────────────

// ─── Cache ────────────────────────────────────────────────────────────────────
// getRecentMessages fires on every Nova message. Cache per userId for 2 minutes —
// short TTL so new messages appear in context quickly.
const recentMsgCache = new Map<string, { data: any[]; ts: number }>();
const RECENT_MSG_TTL = 2 * 60 * 1000; // 2 minutes

/** Invalidate a user's message cache — called after saving a new message. */
export function invalidateRecentMsgCache(userId: string) {
  recentMsgCache.delete(userId);
}

export const novaMemoryService = {

  /**
   * Persist a single message to Firestore.
   * Fire-and-forget safe — never throws so the UI is never blocked.
   */
  async saveMessage(
    userId: string,
    message: { text: string; sender: 'user' | 'ai'; sessionId: string }
  ): Promise<void> {
    try {
      await addDoc(messagesCol(userId), {
        text:      message.text,
        sender:    message.sender,
        sessionId: message.sessionId,
        timestamp: Timestamp.now(),
      });
    } catch (e) {
      console.warn('[novaMemory] saveMessage failed (non-fatal):', e);
    }
  },

  /**
   * Fetch messages from the last `hours` hours for a user, oldest first.
   * Returns an empty array on any error so RAG still works without memory.
   */
  async getRecentMessages(userId: string, hours = 48): Promise<NovaMessage[]> {
    // Return cached messages if still fresh — avoids subcollection read per message
    const cacheKey = `${userId}_${hours}`;
    const cached = recentMsgCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < RECENT_MSG_TTL) return cached.data;

    try {
      const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
      const cutoffTs = Timestamp.fromDate(cutoff);

      let snap;
      try {
        snap = await getDocs(
          query(
            messagesCol(userId),
            where('timestamp', '>=', cutoffTs),
            orderBy('timestamp', 'asc')
          )
        );
      } catch {
        // Composite index may not exist yet — fallback without orderBy
        snap = await getDocs(
          query(
            messagesCol(userId),
            where('timestamp', '>=', cutoffTs)
          )
        );
      }

      const messages: NovaMessage[] = snap.docs.map(d => ({
        id:        d.id,
        text:      d.data().text    || '',
        sender:    d.data().sender  || 'user',
        sessionId: d.data().sessionId || '',
        timestamp: toDate(d.data().timestamp),
      }));

      // Ensure chronological order regardless of which query path was used
      const sorted = messages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      recentMsgCache.set(cacheKey, { data: sorted, ts: Date.now() });
      return sorted;
    } catch (e) {
      console.warn('[novaMemory] getRecentMessages failed (non-fatal):', e);
      return [];
    }
  },

  /**
   * Delete all messages older than `hours` hours for a user.
   * Intended to be called periodically to keep subcollection lean.
   * Batches in chunks of 500 to respect Firestore limits.
   */
  async pruneOldMessages(userId: string, hours = 72): Promise<void> {
    try {
      const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
      const cutoffTs = Timestamp.fromDate(cutoff);

      const snap = await getDocs(
        query(messagesCol(userId), where('timestamp', '<', cutoffTs))
      );
      if (snap.empty) return;

      const CHUNK = 500;
      for (let i = 0; i < snap.docs.length; i += CHUNK) {
        const batch = writeBatch(db);
        snap.docs.slice(i, i + CHUNK).forEach(d => batch.delete(d.ref));
        await batch.commit();
      }
    } catch (e) {
      console.warn('[novaMemory] pruneOldMessages failed (non-fatal):', e);
    }
  },

  /**
   * Delete all messages for a user (hard reset).
   */
  async clearAllMessages(userId: string): Promise<void> {
    try {
      const snap = await getDocs(messagesCol(userId));
      if (snap.empty) return;
      const CHUNK = 500;
      for (let i = 0; i < snap.docs.length; i += CHUNK) {
        const batch = writeBatch(db);
        snap.docs.slice(i, i + CHUNK).forEach(d => batch.delete(d.ref));
        await batch.commit();
      }
    } catch (e) {
      console.warn('[novaMemory] clearAllMessages failed (non-fatal):', e);
    }
  },
};
