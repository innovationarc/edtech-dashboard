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
  courseContentIds: Set<string>
): Promise<void> {
  try {
    // 1. Query all ended live classes
    let liveClassSnap: any;
    try {
      const liveClassQ = query(
        collection(db, 'live_classes'),
        where('status', '==', 'ended'),
      );
      liveClassSnap = await getDocs(liveClassQ);
      console.log(`[autoComplete] live_classes query OK, found ${liveClassSnap.size} ended classes`);
    } catch (e: any) {
      console.warn('[autoComplete] FAILED at live_classes query:', e.message); return;
    }
    if (liveClassSnap.empty) return;

    const now = Timestamp.now();

    await Promise.all(liveClassSnap.docs.map(async (liveClassDoc: any) => {
      const cls = liveClassDoc.data();
      const contentId: string | null = cls.contentId || null;
      if (!contentId) return;
      if (!courseContentIds.has(contentId)) return;

      // 2. Check attendance
      const attendanceDocId = `${liveClassDoc.id}__${studentId}`;
      let attendanceSnap: any;
      try {
        attendanceSnap = await getDoc(doc(db, 'live_class_attendance', attendanceDocId));
        console.log(`[autoComplete] live_class_attendance getDoc OK, exists=${attendanceSnap.exists()}`);
      } catch (e: any) {
        console.warn('[autoComplete] FAILED at live_class_attendance getDoc:', e.message); return;
      }
      if (!attendanceSnap.exists()) return;

      // 3. Check existing progress
      const progressDocId = `${contentId}__${studentId}`;
      let progressSnap: any;
      try {
        progressSnap = await getDoc(doc(db, 'content_progress', progressDocId));
        console.log(`[autoComplete] content_progress getDoc OK, exists=${progressSnap.exists()}`);
      } catch (e: any) {
        console.warn('[autoComplete] FAILED at content_progress getDoc:', e.message); return;
      }
      if (progressSnap.exists() && progressSnap.data().isCompleted === true) return;

      // 4. Fetch content metadata
      let contentData: any = {};
      try {
        const contentSnap = await getDoc(doc(db, 'content', contentId));
        contentData = contentSnap.exists() ? contentSnap.data() : {};
        console.log(`[autoComplete] content getDoc OK`);
      } catch (e: any) {
        console.warn('[autoComplete] FAILED at content getDoc:', e.message);
      }

      // 5. Write content_progress
      try {
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
        console.log(`[autoComplete] content_progress setDoc OK — auto-completed "${contentData.title || contentId}"`);
      } catch (e: any) {
        console.warn('[autoComplete] FAILED at content_progress setDoc:', e.message);
      }
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
    if (enrollSnap.empty) {
      console.log(`[syncEnrollmentProgress] No enrollment found for student=${studentId} course=${courseId}`);
      return;
    }

    const enrollDoc = enrollSnap.docs[0];

    // 2. Get course contentStructure to know which contentIds belong to this course
    const courseSnap = await getDoc(doc(db, 'courses', courseId));
    if (!courseSnap.exists()) {
      console.log(`[syncEnrollmentProgress] Course not found: ${courseId}`);
      return;
    }

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
    console.log(`[syncEnrollmentProgress] Course=${courseId} totalContent=${totalCount}`, allContentIds);
    if (totalCount === 0) return;

    // 3. Auto-complete any content the student attended live but hasn't watched
    await autoCompleteFromLiveAttendance(studentId, courseId, new Set(allContentIds));

    // 4. Count how many course content items are completed for this student
    const completedQ = query(
      collection(db, 'content_progress'),
      where('studentId', '==', studentId),
      where('isCompleted', '==', true),
    );
    const completedSnap = await getDocs(completedQ);
    console.log(`[syncEnrollmentProgress] Total completed content_progress docs for student: ${completedSnap.size}`);
    completedSnap.docs.forEach(d => {
      const data = d.data();
      console.log(`  - contentId=${data.contentId} courseId=${data.courseId} isCompleted=${data.isCompleted}`);
    });

    const courseContentIdSet = new Set(allContentIds);
    const completedInCourse = completedSnap.docs.filter(d =>
      courseContentIdSet.has(d.data().contentId)
    );
    const completedCount = completedInCourse.length;
    console.log(`[syncEnrollmentProgress] completedInCourse=${completedCount}/${totalCount} → ${Math.round(completedCount/totalCount*100)}%`);

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
    console.log(`[syncEnrollmentProgress] Updated enrollment progress to ${progress}%`);
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
