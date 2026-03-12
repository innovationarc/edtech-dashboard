/**
 * notificationService.ts
 * Per-user notification system backed by Firestore.
 * Supports real-time subscriptions, announcement syncing,
 * read/unread state, and full CRUD operations.
 */

import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  writeBatch,
  onSnapshot,
  Timestamp,
  getCountFromServer,
} from 'firebase/firestore';
import { db } from '../config/firebase';

// ─────────────────────────────────────────
// Types
// ─────────────────────────────────────────

export type NotificationType =
  | 'announcement'
  | 'assignment'
  | 'reminder'
  | 'urgent'
  | 'grade'
  | 'system';

export type NotificationPriority = 'low' | 'medium' | 'high';

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  priority: NotificationPriority;
  isRead: boolean;
  createdAt: Date;
  readAt?: Date;
  /** ID of the source document (e.g. announcement ID) */
  relatedId?: string;
  /** Source collection name (e.g. 'announcement') */
  relatedType?: string;
  /** Extra data (teacherName, courseName, grade, etc.) */
  metadata?: Record<string, unknown>;
}

// ─────────────────────────────────────────
// Constants
// ─────────────────────────────────────────

const NOTIF_COLLECTION = 'notifications';

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────

function mapDoc(d: ReturnType<typeof getDocs> extends Promise<infer S> ? never : any): AppNotification {
  const data = d.data();
  return {
    id: d.id,
    ...data,
    createdAt: data.createdAt?.toDate?.() ?? new Date(),
    readAt: data.readAt?.toDate?.(),
  } as AppNotification;
}

// ─────────────────────────────────────────
// Service
// ─────────────────────────────────────────

export const notificationService = {
  /**
   * Create a single notification for a user.
   * Returns the new document ID.
   */
  async createNotification(
    notification: Omit<AppNotification, 'id' | 'createdAt' | 'isRead'>
  ): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, NOTIF_COLLECTION), {
        ...notification,
        isRead: false,
        createdAt: Timestamp.now(),
      });
      return docRef.id;
    } catch (err: any) {
      throw new Error(`createNotification: ${err.message}`);
    }
  },

  /**
   * Fetch all notifications for a user, newest first.
   */
  async getUserNotifications(userId: string): Promise<AppNotification[]> {
    try {
      const q = query(
        collection(db, NOTIF_COLLECTION),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(mapDoc);
    } catch (err: any) {
      throw new Error(`getUserNotifications: ${err.message}`);
    }
  },

  /**
   * Returns the count of unread notifications for a user.
   * Uses getCountFromServer (single read — no payload cost).
   */
  async getUnreadCount(userId: string): Promise<number> {
    try {
      const q = query(
        collection(db, NOTIF_COLLECTION),
        where('userId', '==', userId),
        where('isRead', '==', false)
      );
      const snap = await getCountFromServer(q);
      return snap.data().count;
    } catch {
      return 0;
    }
  },

  /**
   * Mark a single notification as read.
   */
  async markAsRead(notificationId: string): Promise<void> {
    try {
      await updateDoc(doc(db, NOTIF_COLLECTION, notificationId), {
        isRead: true,
        readAt: Timestamp.now(),
      });
    } catch (err: any) {
      throw new Error(`markAsRead: ${err.message}`);
    }
  },

  /**
   * Mark ALL unread notifications as read for a user in a single batch.
   */
  async markAllAsRead(userId: string): Promise<void> {
    try {
      const q = query(
        collection(db, NOTIF_COLLECTION),
        where('userId', '==', userId),
        where('isRead', '==', false)
      );
      const snapshot = await getDocs(q);
      if (snapshot.empty) return;

      const batch = writeBatch(db);
      const now = Timestamp.now();
      snapshot.docs.forEach(d => {
        batch.update(d.ref, { isRead: true, readAt: now });
      });
      await batch.commit();
    } catch (err: any) {
      throw new Error(`markAllAsRead: ${err.message}`);
    }
  },

  /**
   * Delete a single notification.
   */
  async deleteNotification(notificationId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, NOTIF_COLLECTION, notificationId));
    } catch (err: any) {
      throw new Error(`deleteNotification: ${err.message}`);
    }
  },

  /**
   * Delete ALL notifications for a user in a single batch.
   */
  async clearAllNotifications(userId: string): Promise<void> {
    try {
      const q = query(
        collection(db, NOTIF_COLLECTION),
        where('userId', '==', userId)
      );
      const snapshot = await getDocs(q);
      if (snapshot.empty) return;

      const batch = writeBatch(db);
      snapshot.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
    } catch (err: any) {
      throw new Error(`clearAllNotifications: ${err.message}`);
    }
  },

  /**
   * Subscribe to real-time notification updates for a user.
   * Returns an unsubscribe function — call it on component unmount.
   *
   * @example
   * const unsub = notificationService.subscribeToNotifications(userId, setNotifications);
   * return () => unsub();
   */
  subscribeToNotifications(
    userId: string,
    callback: (notifications: AppNotification[]) => void,
    onError?: (err: Error) => void
  ): () => void {
    const q = query(
      collection(db, NOTIF_COLLECTION),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );

    const unsub = onSnapshot(
      q,
      snapshot => {
        callback(snapshot.docs.map(mapDoc));
      },
      err => {
        console.error('notificationService.subscribeToNotifications error:', err);
        onError?.(err);
      }
    );

    return unsub;
  },

  /**
   * Syncs announcements targeted at the user into their personal
   * notifications collection.  Idempotent — already-synced announcements
   * are skipped by checking `relatedId` against existing notification docs.
   *
   * Call this once on mount of the notifications page (or after sign-in).
   */
  async syncAnnouncementsAsNotifications(
    userId: string,
    userRole: string,
    enrolledCourseIds: string[] = []
  ): Promise<void> {
    try {
      // 1. Collect already-synced announcement IDs
      const existingQ = query(
        collection(db, NOTIF_COLLECTION),
        where('userId', '==', userId),
        where('relatedType', '==', 'announcement')
      );
      const existingSnap = await getDocs(existingQ);
      const syncedIds = new Set<string>(
        existingSnap.docs
          .map(d => d.data().relatedId as string | undefined)
          .filter((id): id is string => Boolean(id))
      );

      // 2. Fetch announcements visible to the user
      // Dynamic import avoids circular dependency
      const { announcementService } = await import('./announcementService');
      const announcements = await announcementService.getAnnouncementsForUser(
        userId,
        userRole,
        enrolledCourseIds
      );

      const fresh = announcements.filter(a => !syncedIds.has(a.id));
      if (fresh.length === 0) return;

      // 3. Batch-write new notification docs
      const batch = writeBatch(db);
      fresh.forEach(a => {
        const newRef = doc(collection(db, NOTIF_COLLECTION));
        batch.set(newRef, {
          userId,
          title: a.title,
          message: a.message,
          type: a.type as NotificationType,
          priority: a.priority as NotificationPriority,
          isRead: false,
          createdAt: Timestamp.fromDate(a.createdAt),
          relatedId: a.id,
          relatedType: 'announcement',
          metadata: {
            teacherName: a.teacherName ?? null,
            subject: a.subject ?? null,
            courseName: a.courseName ?? null,
          },
        });
      });
      await batch.commit();
    } catch (err: any) {
      // Non-fatal — surface as warning so the page still loads
      console.warn('notificationService.syncAnnouncementsAsNotifications:', err.message);
    }
  },
};
