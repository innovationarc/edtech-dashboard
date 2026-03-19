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
 * For a given course, find any linked live class recordings where the student
 * attended the live class. If attended but content_progress not yet marked
 * complete, auto-mark as completed so it counts toward enrollment progress.
 *
 * Handles live classes where courseId is null — instead queries ALL ended
 * classes with a contentId, checks attendance, then verifies the content
 * belongs to this course via the course's contentStructure.
 * Fire-and-forget — never throws.
 */
async function autoCompleteFromLiveAttendance(
  studentId: string,
  courseId: string,
  courseContentIds: Set<string>  // all contentIds in this course, pre-computed
): Promise<void> {
  try {
    // 1. Query all ended live classes that have a contentId linked
    // Don't filter by courseId — teacher may have left it null
    const liveClassQ = query(
      collection(db, 'live_classes'),
      where('status', '==', 'ended'),
    );
    const liveClassSnap = await getDocs(liveClassQ);
    if (liveClassSnap.empty) return;

    const now = Timestamp.now();

    await Promise.all(liveClassSnap.docs.map(async (liveClassDoc) => {
      const cls = liveClassDoc.data();
      const contentId: string | null = cls.contentId || null;
      if (!contentId) return; // no recording linked

      // 2. Verify this content belongs to the current course
      if (!courseContentIds.has(contentId)) return;

      // 3. Check if student attended this live class
      const attendanceDocId = `${liveClassDoc.id}__${studentId}`;
      const attendanceSnap = await getDoc(doc(db, 'live_class_attendance', attendanceDocId));
      if (!attendanceSnap.exists()) return; // student didn't attend

      // 4. Check if content_progress already marks this as completed
      const progressDocId = `${contentId}__${studentId}`;
      const progressSnap = await getDoc(doc(db, 'content_progress', progressDocId));
      if (progressSnap.exists() && progressSnap.data().isCompleted === true) return; // already done

      // 5. Fetch content metadata for subject/topic/type
      const contentSnap = await getDoc(doc(db, 'content', contentId));
      const contentData = contentSnap.exists() ? contentSnap.data() : {};

      // 6. Auto-mark as completed via live class attendance
      await setDoc(doc(db, 'content_progress', progressDocId), {
        id: progressDocId,
        contentId,
        studentId,
        contentType: contentData.type || 'lesson',
        subject: contentData.subject || '',
        topic: contentData.topic || '',
        courseId,
        isCompleted: true,
        completedViaLiveClass: true,
        liveClassId: liveClassDoc.id,
        lastWatchedAt: now,
        firstWatchedAt: progressSnap.exists() ? progressSnap.data().firstWatchedAt : now,
        completedAt: now,
      }, { merge: true });

      console.log(`[contentProgressService] Auto-completed "${contentData.title || contentId}" via live class attendance`);
    }));
  } catch (e) {
    console.warn('[contentProgressService] autoCompleteFromLiveAttendance failed (non-fatal):', e);
  }
}

/**
 * Recalculate and sync enrollment.progress after a content item is completed.
 * Also auto-completes any content the student attended live but hasn't watched.
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

    // 2. Get course contentStructure to know which contentIds belong to this course
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

    // 3. Auto-complete any content the student attended live but hasn't watched
    // Pass the full Set of course contentIds — avoids relying on courseId field on live class doc
    await autoCompleteFromLiveAttendance(studentId, courseId, new Set(allContentIds));

    // 4. Count how many course content items are completed for this student
    // Query by studentId + isCompleted only — then filter against allContentIds set
    // This handles content_progress docs that were written before courseId was correctly set
    const completedQ = query(
      collection(db, 'content_progress'),
      where('studentId', '==', studentId),
      where('isCompleted', '==', true),
    );
    const completedSnap = await getDocs(completedQ);
    const courseContentIdSet = new Set(allContentIds);
    const completedInCourse = completedSnap.docs.filter(d =>
      courseContentIdSet.has(d.data().contentId)
    );
    const completedCount = completedInCourse.length;

    // 5. Calculate progress and update enrollment
    const progress = Math.min(100, Math.round((completedCount / totalCount) * 100));

    await runTransaction(db, async (t) => {
      const freshEnroll = await t.get(enrollDoc.ref);
      if (!freshEnroll.exists()) return;
      t.update(enrollDoc.ref, {
        progress,
        completedLessons: completedInCourse.map(d => d.data().contentId),
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

  /**
   * Publicly trigger a full sync for a course:
   * - Auto-completes content from live class attendance
   * - Recalculates and updates enrollment.progress
   * Call this when the student opens their library or dashboard.
   */
  async syncProgressForCourse(studentId: string, courseId: string): Promise<void> {
    await syncEnrollmentProgress(studentId, courseId);
  },
};
