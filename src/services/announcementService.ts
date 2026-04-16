// src/services/announcementService.ts
// Offline-first: reads Dexie first, syncs Firestore in background.
// All original methods and signatures preserved 100%.

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { getDocs } from './firestoreMonitor';
import { db } from '../config/firebase';
import { db as localDB } from '../lib/dexie';

// ─── Cache ────────────────────────────────────────────────────────────────────
const announcementCache = new Map<string, { data: any[]; ts: number }>();
const ANNOUNCEMENT_TTL = 5 * 60 * 1000;

export function invalidateAnnouncementCache(userId?: string) {
  if (userId) announcementCache.delete(userId);
  else announcementCache.clear();
}

export interface Announcement {
  id: string;
  title: string;
  message: string;
  teacherId: string;
  teacherName: string;
  subject: string;
  courseId?: string;
  courseName?: string;
  type: 'assignment' | 'announcement' | 'reminder' | 'urgent';
  priority: 'low' | 'medium' | 'high';
  targetAudience: 'all' | 'course' | 'specific';
  targetStudents?: string[];
  targetCourses?: string[];
  isActive: boolean;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt?: Date;
}

// ─── Offline helpers ──────────────────────────────────────────────────────────
function toLocalAnnouncement(a: Announcement) {
  return {
    id: a.id,
    title: a.title,
    content: a.message,
    authorId: a.teacherId,
    targetRoles: [] as string[],
    createdAt: a.createdAt.getTime(),
    _synced: true,
    // Store full data as JSON in content for reconstruction
    _raw: JSON.stringify(a),
  };
}

function fromLocalAnnouncement(local: any): Announcement | null {
  try {
    if (local._raw) return JSON.parse(local._raw) as Announcement;
  } catch { /* fall through */ }
  return null;
}

export const announcementService = {

  async createAnnouncement(announcement: Omit<Announcement, 'id' | 'createdAt'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, 'announcements'), {
        ...announcement,
        createdAt: Timestamp.now(),
        expiresAt: announcement.expiresAt ? Timestamp.fromDate(announcement.expiresAt) : null
      });
      return docRef.id;
    } catch (error: any) {
      throw new Error(error.message);
    }
  },

  async getAllAnnouncements(): Promise<Announcement[]> {
    try {
      const snap = await getDocs(
        query(collection(db, 'announcements'), orderBy('createdAt', 'desc'))
      );
      return snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
        expiresAt: doc.data().expiresAt?.toDate()
      })) as Announcement[];
    } catch (error: any) {
      throw new Error(error.message);
    }
  },

  async getAnnouncementsForUser(
    userId: string,
    userRole: string,
    enrolledCourseIds: string[] = []
  ): Promise<Announcement[]> {
    // 1. Try Dexie first — works offline
    try {
      const local = await localDB.announcements.toArray();
      if (local.length > 0) {
        const cached = announcementCache.get(userId);

        // Reconstruct announcements from local storage
        const announcements: Announcement[] = local
          .map(fromLocalAnnouncement)
          .filter((a): a is Announcement => a !== null);

        if (announcements.length > 0) {
          const now = new Date();
          const filtered = announcements
            .filter(a => {
              if (!a.isActive) return false;
              if (a.expiresAt && a.expiresAt < now) return false;
              if (a.targetAudience === 'all') return true;
              if (a.targetAudience === 'course') {
                return a.targetCourses?.some(id => enrolledCourseIds.includes(id)) ?? false;
              }
              if (a.targetAudience === 'specific') {
                return a.targetStudents?.includes(userId) ?? false;
              }
              return false;
            })
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

          // Background sync if cache is stale
          if (!cached || Date.now() - cached.ts >= ANNOUNCEMENT_TTL) {
            this._syncAnnouncementsFromFirestore(userId, userRole, enrolledCourseIds).catch(() => {});
          }

          return filtered;
        }
      }
    } catch { /* fall through to Firestore */ }

    // 2. Return memory cache if fresh
    const cached = announcementCache.get(userId);
    if (cached && Date.now() - cached.ts < ANNOUNCEMENT_TTL) return cached.data;

    // 3. Fetch from Firestore
    try {
      const snap = await getDocs(
        query(collection(db, 'announcements'), where('isActive', '==', true))
      );
      const now = new Date();
      const all = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
        expiresAt: doc.data().expiresAt?.toDate()
      })) as Announcement[];

      const filtered = all.filter(a => {
        if (a.expiresAt && a.expiresAt < now) return false;
        if (a.targetAudience === 'all') return true;
        if (a.targetAudience === 'course') {
          return a.targetCourses?.some(id => enrolledCourseIds.includes(id)) ?? false;
        }
        if (a.targetAudience === 'specific') {
          return a.targetStudents?.includes(userId) ?? false;
        }
        return false;
      }).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      announcementCache.set(userId, { data: filtered, ts: Date.now() });

      // Persist ALL active announcements to Dexie for offline
      await localDB.announcements.bulkPut(
        all.map(a => ({
          id: a.id,
          title: a.title,
          content: a.message,
          authorId: a.teacherId,
          targetRoles: [],
          createdAt: a.createdAt.getTime(),
          _synced: true,
          _raw: JSON.stringify(a),
        }))
      ).catch(() => {});

      return filtered;
    } catch (error: any) {
      throw new Error(error.message);
    }
  },

  // Background sync helper
  async _syncAnnouncementsFromFirestore(
    userId: string,
    _userRole: string,
    enrolledCourseIds: string[]
  ): Promise<void> {
    try {
      const snap = await getDocs(
        query(collection(db, 'announcements'), where('isActive', '==', true))
      );
      const now = new Date();
      const all = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
        expiresAt: doc.data().expiresAt?.toDate()
      })) as Announcement[];

      const filtered = all.filter(a => {
        if (a.expiresAt && a.expiresAt < now) return false;
        if (a.targetAudience === 'all') return true;
        if (a.targetAudience === 'course') {
          return a.targetCourses?.some(id => enrolledCourseIds.includes(id)) ?? false;
        }
        if (a.targetAudience === 'specific') {
          return a.targetStudents?.includes(userId) ?? false;
        }
        return false;
      }).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      announcementCache.set(userId, { data: filtered, ts: Date.now() });
      await localDB.announcements.bulkPut(
        all.map(a => ({
          id: a.id,
          title: a.title,
          content: a.message,
          authorId: a.teacherId,
          targetRoles: [],
          createdAt: a.createdAt.getTime(),
          _synced: true,
          _raw: JSON.stringify(a),
        }))
      ).catch(() => {});
    } catch { /* non-fatal */ }
  },

  async getAnnouncementsByTeacher(teacherId: string): Promise<Announcement[]> {
    try {
      const snap = await getDocs(
        query(
          collection(db, 'announcements'),
          where('teacherId', '==', teacherId),
          orderBy('createdAt', 'desc')
        )
      );
      return snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
        expiresAt: doc.data().expiresAt?.toDate()
      })) as Announcement[];
    } catch (error: any) {
      throw new Error(error.message);
    }
  },

  async updateAnnouncement(id: string, updates: Partial<Announcement>): Promise<void> {
    try {
      const updateData = { ...updates } as any;
      if (updateData.expiresAt) {
        updateData.expiresAt = Timestamp.fromDate(updateData.expiresAt);
      }
      await updateDoc(doc(db, 'announcements', id), {
        ...updateData,
        updatedAt: Timestamp.now()
      });
      announcementCache.clear();
    } catch (error: any) {
      throw new Error(error.message);
    }
  },

  async deleteAnnouncement(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'announcements', id));
      await localDB.announcements.delete(id).catch(() => {});
      announcementCache.clear();
    } catch (error: any) {
      throw new Error(error.message);
    }
  },

  async deactivateAnnouncement(id: string): Promise<void> {
    try {
      await this.updateAnnouncement(id, { isActive: false });
    } catch (error: any) {
      throw new Error(error.message);
    }
  }
};
