// src/services/notificationService.ts
// Offline-first: reads Dexie first, syncs Firestore in background.
// All original methods and signatures preserved 100%.

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
import { db as localDB } from '../lib/dexie';
import syncService from '../lib/syncService';

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
  relatedId?: string;
  relatedType?: string;
  metadata?: Record<string, unknown>;
  isPermanent?: boolean;
}

const NOTIF_COLLECTION = 'notifications';

function mapDoc(d: any): AppNotification {
  const data = d.data();
  return {
    id: d.id,
    ...data,
    createdAt: data.createdAt?.toDate?.() ?? new Date(),
    readAt: data.readAt?.toDate?.(),
  } as AppNotification;
}

// ─── Dexie ↔ AppNotification ──────────────────────────────────────────────────
function toLocalNotif(n: AppNotification) {
  return {
    id: n.id,
    userId: n.userId,
    title: n.title,
    body: n.message,
    read: n.isRead,
    createdAt: n.createdAt.getTime(),
    _synced: true,
    _pendingSync: false,
    _raw: JSON.stringify(n),
  };
}

function fromLocalNotif(local: any): AppNotification | null {
  try {
    if (local._raw) return JSON.parse(local._raw) as AppNotification;
    // Fallback reconstruction
    return {
      id: local.id,
      userId: local.userId,
      title: local.title,
      message: local.body,
      type: 'system',
      priority: 'medium',
      isRead: local.read,
      createdAt: local.createdAt ? new Date(local.createdAt) : new Date(),
    };
  } catch { return null; }
}

export const notificationService = {

  async createNotification(
    notification: Omit<AppNotification, 'id' | 'createdAt' | 'isRead'>
  ): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, NOTIF_COLLECTION), {
        ...notification,
        isRead: false,
        createdAt: Timestamp.now(),
      });
      // Persist to Dexie
      const newNotif: AppNotification = {
        ...notification,
        id: docRef.id,
        isRead: false,
        createdAt: new Date(),
      };
      await localDB.notifications.put(toLocalNotif(newNotif)).catch(() => {});
      return docRef.id;
    } catch (err: any) {
      throw new Error(`createNotification: ${err.message}`);
    }
  },

  async getUserNotifications(userId: string): Promise<AppNotification[]> {
    // 1. Try Dexie first
    try {
      const local = await localDB.notifications
        .where('userId').equals(userId)
        .toArray();
      if (local.length > 0) {
        const result = local
          .map(fromLocalNotif)
          .filter((n): n is AppNotification => n !== null)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

        // Background sync
        this._syncNotificationsFromFirestore(userId).catch(() => {});
        return result;
      }
    } catch { /* fall through */ }

    // 2. Firestore
    try {
      const q = query(
        collection(db, NOTIF_COLLECTION),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      const result = snapshot.docs.map(mapDoc);

      // Persist to Dexie
      await localDB.notifications.bulkPut(result.map(toLocalNotif)).catch(() => {});
      return result;
    } catch (err: any) {
      throw new Error(`getUserNotifications: ${err.message}`);
    }
  },

  // Background sync helper
  async _syncNotificationsFromFirestore(userId: string): Promise<void> {
    try {
      const q = query(
        collection(db, NOTIF_COLLECTION),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      const result = snapshot.docs.map(mapDoc);
      await localDB.notifications.bulkPut(result.map(toLocalNotif)).catch(() => {});
    } catch { /* non-fatal */ }
  },

  async getUnreadCount(userId: string): Promise<number> {
    // Try local count first (instant, offline-safe)
    try {
      const local = await localDB.notifications
        .where('userId').equals(userId)
        .toArray();
      const localUnread = local.filter(n => !n.read).length;
      if (local.length > 0) {
        // Background: verify with Firestore
        if (navigator.onLine) {
          getCountFromServer(query(
            collection(db, NOTIF_COLLECTION),
            where('userId', '==', userId),
            where('isRead', '==', false)
          )).then(snap => {
            // If count differs significantly, trigger a full sync
            if (Math.abs(snap.data().count - localUnread) > 2) {
              this._syncNotificationsFromFirestore(userId).catch(() => {});
            }
          }).catch(() => {});
        }
        return localUnread;
      }
    } catch { /* fall through */ }

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

  async markAsRead(notificationId: string): Promise<void> {
    // Update Dexie immediately
    try {
      const local = await localDB.notifications.get(notificationId);
      if (local) await localDB.notifications.put({ ...local, read: true });
    } catch { /* non-fatal */ }

    try {
      await updateDoc(doc(db, NOTIF_COLLECTION, notificationId), {
        isRead: true,
        readAt: Timestamp.now(),
      });
    } catch {
      await syncService.writeDoc(NOTIF_COLLECTION, notificationId, {
        isRead: true,
        readAt: Timestamp.now(),
      });
    }
  },

  async markAllAsRead(userId: string): Promise<void> {
    // Update all in Dexie immediately
    try {
      const local = await localDB.notifications
        .where('userId').equals(userId)
        .toArray();
      const updates = local.map(n => ({ ...n, read: true }));
      await localDB.notifications.bulkPut(updates).catch(() => {});
    } catch { /* non-fatal */ }

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

  async deleteNotification(notificationId: string): Promise<void> {
    await localDB.notifications.delete(notificationId).catch(() => {});
    try {
      await deleteDoc(doc(db, NOTIF_COLLECTION, notificationId));
    } catch {
      await syncService.deleteDoc(NOTIF_COLLECTION, notificationId);
    }
  },

  async clearAllNotifications(userId: string): Promise<void> {
    // Clear from Dexie immediately
    try {
      const local = await localDB.notifications
        .where('userId').equals(userId)
        .toArray();
      await localDB.notifications.bulkDelete(local.map(n => n.id)).catch(() => {});
    } catch { /* non-fatal */ }

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

  subscribeToNotifications(
    userId: string,
    callback: (notifications: AppNotification[]) => void,
    onError?: (err: Error) => void
  ): () => void {
    // Seed from Dexie immediately so UI shows data before Firestore resolves
    localDB.notifications
      .where('userId').equals(userId)
      .toArray()
      .then(local => {
        if (local.length > 0) {
          const result = local
            .map(fromLocalNotif)
            .filter((n): n is AppNotification => n !== null)
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
          callback(result);
        }
      })
      .catch(() => {});

    const q = query(
      collection(db, NOTIF_COLLECTION),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );

    const unsub = onSnapshot(
      q,
      snapshot => {
        const result = snapshot.docs.map(mapDoc);
        // Persist to Dexie on every update
        localDB.notifications.bulkPut(result.map(toLocalNotif)).catch(() => {});
        callback(result);
      },
      err => {
        console.error('notificationService.subscribeToNotifications error:', err);
        onError?.(err);
      }
    );

    return unsub;
  },

  async syncAnnouncementsAsNotifications(
    userId: string,
    userRole: string,
    enrolledCourseIds: string[] = []
  ): Promise<void> {
    try {
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

      const { announcementService } = await import('./announcementService');
      const announcements = await announcementService.getAnnouncementsForUser(
        userId, userRole, enrolledCourseIds
      );

      const fresh = announcements.filter(a => !syncedIds.has(a.id));
      if (fresh.length === 0) return;

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
      console.warn('notificationService.syncAnnouncementsAsNotifications:', err.message);
    }
  },

  async purgeTransient(userId: string): Promise<void> {
    // Also purge from Dexie
    try {
      const local = await localDB.notifications
        .where('userId').equals(userId)
        .toArray();
      const cutoff = Date.now() - 10 * 1000;
      const toDelete = local.filter(n => {
        if (!n._raw) return false;
        try {
          const parsed = JSON.parse(n._raw) as AppNotification;
          return !parsed.isPermanent && n.createdAt && n.createdAt < cutoff;
        } catch { return false; }
      });
      if (toDelete.length > 0) {
        await localDB.notifications.bulkDelete(toDelete.map(n => n.id)).catch(() => {});
      }
    } catch { /* non-fatal */ }

    try {
      const cutoff = new Date(Date.now() - 10 * 1000);
      const q = query(
        collection(db, NOTIF_COLLECTION),
        where('userId', '==', userId),
        where('isPermanent', '==', false),
        where('createdAt', '<', Timestamp.fromDate(cutoff))
      );
      const snap = await getDocs(q);
      if (snap.empty) return;
      const batch = writeBatch(db);
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
    } catch { /* non-fatal */ }
  },
};

