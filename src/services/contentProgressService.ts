// src/services/contentProgressService.ts
// Tracks student progress on content (videos, notes, tricks, exams)

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  query,
  where,
  Timestamp,
  runTransaction,
} from 'firebase/firestore';
import { db } from '../config/firebase';

export interface ContentProgress {
  id: string; // contentId__studentId
  contentId: string;
  studentId: string;
  contentType: 'lesson' | 'note' | 'trick' | 'exam';
  subject: string;
  topic: string;
  courseId?: string; // Optional course reference
  
  // For videos/lessons
  watchedDuration?: number; // seconds
  totalDuration?: number; // seconds
  watchPercentage?: number; // 0-100
  
  // For exams
  examCompleted?: boolean;
  examScore?: number;
  examTotalMarks?: number;
  
  // Completion status (70%+ for videos, completed for exams)
  isCompleted: boolean;
  
  lastWatchedAt: Date;
  firstWatchedAt: Date;
  completedAt?: Date;
}

const progressId = (contentId: string, studentId: string) => 
  `${contentId}__${studentId}`;

/**
 * Recalculate and sync enrollment.progress after a content item is completed.
 * Counts all completed content_progress docs for this student+course,
 * divides by total content items in the course, updates enrollments.progress.
 * Fire-and-forget — never throws, never blocks the caller.
 */
async function syncEnrollmentProgress(studentId: string, courseId: string): Promise<void> {
  try {
    // 1. Find the enrollment doc
    const enrollQ = query(
      collection(db, 'enrollments'),
      where('studentId', '==', studentId),
      where('courseId', '==', courseId),
    );
    const enrollSnap = await getDocs(enrollQ);
    if (enrollSnap.empty) return;

    const enrollDoc = enrollSnap.docs[0];

    // 2. Count total content items in the course's contentStructure
    const courseSnap = await getDoc(doc(db, 'courses', courseId));
    if (!courseSnap.exists()) return;

    const contentStructure = courseSnap.data().contentStructure || [];

    // Recursively collect all content node IDs
    function collectContentIds(nodes: any[]): string[] {
      const ids: string[] = [];
      for (const node of nodes) {
        if (node.type === 'content' && node.contentId) ids.push(node.contentId);
        if (node.children?.length) ids.push(...collectContentIds(node.children));
      }
      return ids;
    }
    const allContentIds = collectContentIds(contentStructure);
    const totalCount = allContentIds.length;
    if (totalCount === 0) return;

    // 3. Count how many are completed for this student+course
    const completedQ = query(
      collection(db, 'content_progress'),
      where('studentId', '==', studentId),
      where('courseId', '==', courseId),
      where('isCompleted', '==', true),
    );
    const completedSnap = await getDocs(completedQ);
    const completedCount = completedSnap.size;

    // 4. Calculate progress and update enrollment
    const progress = Math.min(100, Math.round((completedCount / totalCount) * 100));

    await runTransaction(db, async (t) => {
      const freshEnroll = await t.get(enrollDoc.ref);
      if (!freshEnroll.exists()) return;
      // Only update if progress increased (never go backwards)
      const currentProgress = freshEnroll.data().progress || 0;
      if (progress <= currentProgress) return;
      t.update(enrollDoc.ref, {
        progress,
        completedLessons: completedSnap.docs.map(d => d.data().contentId),
        lastAccessedAt: Timestamp.now(),
      });
    });
  } catch (e) {
    console.warn('[contentProgressService] syncEnrollmentProgress failed (non-fatal):', e);
  }
}

export const contentProgressService = {
  /**
   * Update video/lesson progress
   */
  async updateVideoProgress(
    contentId: string,
    studentId: string,
    watchedDuration: number,
    totalDuration: number,
    subject: string,
    topic: string,
    contentType: 'lesson' | 'note' | 'trick' = 'lesson',
    courseId?: string
  ): Promise<void> {
    const id = progressId(contentId, studentId);
    const watchPercentage = Math.min(100, Math.round((watchedDuration / totalDuration) * 100));
    const isCompleted = watchPercentage >= 70;
    
    const now = Timestamp.now();
    
    // Get existing progress to preserve firstWatchedAt
    const existing = await getDoc(doc(db, 'content_progress', id));
    const existingData = existing.exists() ? existing.data() : null;
    
    await setDoc(doc(db, 'content_progress', id), {
      id,
      contentId,
      studentId,
      contentType,
      subject,
      topic,
      courseId: courseId || null,
      watchedDuration,
      totalDuration,
      watchPercentage,
      isCompleted,
      lastWatchedAt: now,
      firstWatchedAt: existingData?.firstWatchedAt || now,
      completedAt: isCompleted && !existingData?.completedAt ? now : existingData?.completedAt || null,
    }, { merge: true });

    // Sync enrollment progress whenever this content becomes newly completed
    const wasAlreadyCompleted = existingData?.isCompleted === true;
    if (isCompleted && !wasAlreadyCompleted && courseId) {
      syncEnrollmentProgress(studentId, courseId); // fire-and-forget
    }
  },

  /**
   * Mark exam as completed
   */
  async updateExamProgress(
    contentId: string,
    studentId: string,
    score: number,
    totalMarks: number,
    subject: string,
    topic: string,
    courseId?: string
  ): Promise<void> {
    const id = progressId(contentId, studentId);
    const now = Timestamp.now();
    
    const existing = await getDoc(doc(db, 'content_progress', id));
    const existingData = existing.exists() ? existing.data() : null;
    
    await setDoc(doc(db, 'content_progress', id), {
      id,
      contentId,
      studentId,
      contentType: 'exam',
      subject,
      topic,
      courseId: courseId || null,
      examCompleted: true,
      examScore: score,
      examTotalMarks: totalMarks,
      isCompleted: true,
      lastWatchedAt: now,
      firstWatchedAt: existingData?.firstWatchedAt || now,
      completedAt: now,
    }, { merge: true });

    // Sync enrollment progress — exams always count as newly completed
    if (courseId) {
      syncEnrollmentProgress(studentId, courseId); // fire-and-forget
    }
  },

  /**
   * Get all progress for a student
   */
  async getStudentProgress(studentId: string): Promise<ContentProgress[]> {
    const q = query(
      collection(db, 'content_progress'),
      where('studentId', '==', studentId)
    );
    const snap = await getDocs(q);
    
    return snap.docs.map(d => {
      const data = d.data();
      return {
        ...data,
        lastWatchedAt: data.lastWatchedAt?.toDate() || new Date(),
        firstWatchedAt: data.firstWatchedAt?.toDate() || new Date(),
        completedAt: data.completedAt?.toDate() || undefined,
      } as ContentProgress;
    });
  },

  /**
   * Get progress for specific content
   */
  async getContentProgress(
    contentId: string,
    studentId: string
  ): Promise<ContentProgress | null> {
    const id = progressId(contentId, studentId);
    const snap = await getDoc(doc(db, 'content_progress', id));
    
    if (!snap.exists()) return null;
    
    const data = snap.data();
    return {
      ...data,
      lastWatchedAt: data.lastWatchedAt?.toDate() || new Date(),
      firstWatchedAt: data.firstWatchedAt?.toDate() || new Date(),
      completedAt: data.completedAt?.toDate() || undefined,
    } as ContentProgress;
  },

  /**
   * Get progress by subject
   */
  async getSubjectProgress(
    studentId: string,
    subject: string
  ): Promise<ContentProgress[]> {
    const q = query(
      collection(db, 'content_progress'),
      where('studentId', '==', studentId),
      where('subject', '==', subject)
    );
    const snap = await getDocs(q);
    
    return snap.docs.map(d => {
      const data = d.data();
      return {
        ...data,
        lastWatchedAt: data.lastWatchedAt?.toDate() || new Date(),
        firstWatchedAt: data.firstWatchedAt?.toDate() || new Date(),
        completedAt: data.completedAt?.toDate() || undefined,
      } as ContentProgress;
    });
  },
};
