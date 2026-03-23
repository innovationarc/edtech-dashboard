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
  targetStudents?: string[]; // student IDs for specific targeting
  targetCourses?: string[]; // course IDs for course-specific announcements
  isActive: boolean;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt?: Date;
}

// ─── Cache ────────────────────────────────────────────────────────────────────
// getAnnouncementsForUser is called on every dashboard poll (every 5 min).
// Cache per userId for 5 minutes — announcements change infrequently.
const announcementCache = new Map<string, { data: any[]; ts: number }>();
const ANNOUNCEMENT_TTL = 5 * 60 * 1000; // 5 minutes

export function invalidateAnnouncementCache(userId?: string) {
  if (userId) announcementCache.delete(userId);
  else announcementCache.clear();
}

export const announcementService = {
  // Create a new announcement
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

  // Get all announcements (for admin/teacher view)
  async getAllAnnouncements(): Promise<Announcement[]> {
    try {
      const announcementsCollection = collection(db, 'announcements');
      const announcementsSnapshot = await getDocs(
        query(announcementsCollection, orderBy('createdAt', 'desc'))
      );
      
      return announcementsSnapshot.docs.map(doc => ({
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

  // Get announcements for a specific user (student view)
  async getAnnouncementsForUser(
    userId: string, 
    userRole: string, 
    enrolledCourseIds: string[] = []
  ): Promise<Announcement[]> {
    // Return cached announcements if still fresh — called on every dashboard poll
    const cached = announcementCache.get(userId);
    if (cached && Date.now() - cached.ts < ANNOUNCEMENT_TTL) return cached.data;

    try {
      const announcementsCollection = collection(db, 'announcements');
      const now = new Date();
      
      // Get all active announcements (without orderBy to avoid composite index requirement)
      const activeQuery = query(
        announcementsCollection,
        where('isActive', '==', true)
      );
      
      const announcementsSnapshot = await getDocs(activeQuery);
      
      const allAnnouncements = announcementsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
        expiresAt: doc.data().expiresAt?.toDate()
      })) as Announcement[];
      
      // Filter announcements based on user and targeting
      const filteredAnnouncements = allAnnouncements.filter(announcement => {
        // Check if announcement has expired
        if (announcement.expiresAt && announcement.expiresAt < now) {
            return false;
        }
        
        // Check targeting
        if (announcement.targetAudience === 'all') {
            return true;
        }
        
        if (announcement.targetAudience === 'course') {
          const matches = announcement.targetCourses?.some(courseId => 
            enrolledCourseIds.includes(courseId)
          ) || false;
            return matches;
        }
        
        if (announcement.targetAudience === 'specific') {
          const matches = announcement.targetStudents?.includes(userId) || false;
            return matches;
        }
        
        console.log('No match for announcement:', announcement.title, announcement.targetAudience);
        return false;
      });
      
      // Sort by createdAt in descending order (most recent first)
      filteredAnnouncements.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      
      announcementCache.set(userId, { data: filteredAnnouncements, ts: Date.now() });
      return filteredAnnouncements;
    } catch (error: any) {
      throw new Error(error.message);
    }
  },

  // Get announcements by teacher
  async getAnnouncementsByTeacher(teacherId: string): Promise<Announcement[]> {
    try {
      const announcementsCollection = collection(db, 'announcements');
      const teacherQuery = query(
        announcementsCollection,
        where('teacherId', '==', teacherId),
        orderBy('createdAt', 'desc')
      );
      
      const announcementsSnapshot = await getDocs(teacherQuery);
      
      return announcementsSnapshot.docs.map(doc => ({
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

  // Update an announcement
  async updateAnnouncement(id: string, updates: Partial<Announcement>): Promise<void> {
    try {
      const announcementRef = doc(db, 'announcements', id);
      const updateData = { ...updates };
      
      if (updateData.expiresAt) {
        updateData.expiresAt = Timestamp.fromDate(updateData.expiresAt) as any;
      }
      
      await updateDoc(announcementRef, {
        ...updateData,
        updatedAt: Timestamp.now()
      });
    } catch (error: any) {
      throw new Error(error.message);
    }
  },

  // Delete an announcement
  async deleteAnnouncement(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'announcements', id));
    } catch (error: any) {
      throw new Error(error.message);
    }
  },

  // Mark announcement as inactive (soft delete)
  async deactivateAnnouncement(id: string): Promise<void> {
    try {
      await this.updateAnnouncement(id, { isActive: false });
    } catch (error: any) {
      throw new Error(error.message);
    }
  }
};
