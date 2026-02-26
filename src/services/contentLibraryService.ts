// src/services/contentLibraryService.ts
// Content Library Service - Fetches enrolled courses and their content structures
// This is a SEPARATE service; it does NOT modify contentService.ts or courseService.ts

import {
  collection,
  doc,
  getDocs,
  getDoc,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../config/firebase';

// ==================== INTERFACES ====================

export interface ContentNode {
  id: string;
  type: 'folder' | 'content';
  name: string;
  contentId?: string;
  contentData?: LibraryContent;
  children: ContentNode[];
  isExpanded?: boolean;
  order: number;
}

export interface LibraryContent {
  id: string;
  title: string;
  subject: string;
  type: 'lesson' | 'note' | 'trick' | 'exam';
  description?: string;
  duration?: number;
  durationFormatted?: string;
  examType?: 'mcq' | 'written' | 'mixed';
  totalQuestions?: number;
  totalMarks?: number;
  // Video — may be a secured:// proxy URL or a direct storage URL
  videoUrl?: string;
  videoFileName?: string;
  // Note — may be local storage URL or GDrive
  noteUrl?: string;
  noteFileName?: string;
  noteSource?: 'local' | 'gdrive';
  noteGDrivePreviewUrl?: string;
  noteGDriveDownloadUrl?: string;
}

export interface LibraryCourse {
  courseId: string;
  title: string;
  thumbnail?: string;
  thumbnailUrl?: string;
  subjects: string[];
  contentStructure: ContentNode[];
  enrolledAt: Date;
  progress: number;
  validity?: string;
}

export interface EnrolledCourseRaw {
  id: string;
  courseId: string;
  studentId: string;
  enrolledAt: any;
  progress: number;
  paymentStatus: string;
}

// ==================== HELPERS ====================

function toDate(val: any): Date {
  if (!val) return new Date();
  if (val instanceof Date) return val;
  if (val?.toDate) return val.toDate();
  return new Date(val);
}

// ==================== SERVICE ====================

export const contentLibraryService = {

  /**
   * Fetch all enrolled courses for a student (only completed payments),
   * then hydrate each with its course data + content structure.
   */
  async getStudentLibrary(studentId: string): Promise<LibraryCourse[]> {
    if (!studentId?.trim()) return [];

    // 1. Get all enrollments for this student
    const enrollQ = query(
      collection(db, 'enrollments'),
      where('studentId', '==', studentId),
      where('paymentStatus', '==', 'completed')
    );
    const enrollSnap = await getDocs(enrollQ);

    if (enrollSnap.empty) return [];

    const enrollments = enrollSnap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      enrolledAt: toDate(d.data().enrolledAt),
    })) as EnrolledCourseRaw[];

    // 2. Hydrate each enrollment with course data
    const results: LibraryCourse[] = [];

    await Promise.all(
      enrollments.map(async (enrollment) => {
        try {
          const courseDoc = await getDoc(doc(db, 'courses', enrollment.courseId));
          if (!courseDoc.exists()) return;

          const courseData = courseDoc.data();

          // Check validity — skip if course expired
          if (courseData.validity) {
            const validUntil = new Date(courseData.validity);
            if (validUntil < new Date()) return;
          }

          // 3. Hydrate contentNodes with actual content data
          const hydratedStructure = await contentLibraryService.hydrateContentNodes(
            courseData.contentStructure || []
          );

          results.push({
            courseId: enrollment.courseId,
            title: courseData.title || 'Untitled Course',
            thumbnail: courseData.thumbnail,
            thumbnailUrl: courseData.thumbnailUrl,
            subjects: courseData.subjects || [],
            contentStructure: hydratedStructure,
            enrolledAt: enrollment.enrolledAt,
            progress: enrollment.progress || 0,
            validity: courseData.validity,
          });
        } catch (err) {
          console.error(`Error hydrating course ${enrollment.courseId}:`, err);
        }
      })
    );

    // Sort by enrolledAt desc
    results.sort((a, b) => b.enrolledAt.getTime() - a.enrolledAt.getTime());

    return results;
  },

  /**
   * Recursively hydrate content nodes — for 'content' type nodes,
   * fetch the actual content data from Firestore.
   */
  async hydrateContentNodes(nodes: ContentNode[]): Promise<ContentNode[]> {
    if (!nodes || nodes.length === 0) return [];

    const hydrated = await Promise.all(
      nodes.map(async (node) => {
        if (node.type === 'content' && node.contentId) {
          const contentData = await contentLibraryService.fetchContentData(node.contentId);
          return {
            ...node,
            contentData: contentData || undefined,
            children: [],
          };
        }

        if (node.type === 'folder' && node.children?.length > 0) {
          const hydratedChildren = await contentLibraryService.hydrateContentNodes(node.children);
          return {
            ...node,
            children: hydratedChildren,
          };
        }

        return { ...node, children: node.children || [] };
      })
    );

    // Sort by order
    return hydrated.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  },

  /**
   * Fetch full content data needed for the library and player.
   * Now includes all video/note fields for the LessonViewer.
   */
  async fetchContentData(contentId: string): Promise<LibraryContent | null> {
    try {
      const contentDoc = await getDoc(doc(db, 'content', contentId));
      if (!contentDoc.exists()) return null;

      const d = contentDoc.data();
      return {
        id: contentDoc.id,
        title: d.title || 'Untitled',
        subject: d.subject || '',
        type: d.type || 'lesson',
        description: d.description,
        duration: d.duration,
        durationFormatted: d.durationFormatted,
        examType: d.examType,
        totalQuestions: d.totalQuestions,
        totalMarks: d.totalMarks,
        // Video fields — videoUrl may be secured:// proxy or direct URL
        videoUrl: d.videoUrl,
        videoFileName: d.videoFileName,
        // Note fields — full set for the viewer
        noteUrl: d.noteUrl,
        noteFileName: d.noteFileName,
        noteSource: d.noteSource,
        noteGDrivePreviewUrl: d.noteGDrivePreviewUrl,
        noteGDriveDownloadUrl: d.noteGDriveDownloadUrl,
      };
    } catch (err) {
      console.error(`Error fetching content ${contentId}:`, err);
      return null;
    }
  },

  /**
   * Get a single course's content structure for the library view.
   */
  async getCourseLibraryData(courseId: string, studentId: string): Promise<LibraryCourse | null> {
    try {
      // Verify enrollment
      const enrollQ = query(
        collection(db, 'enrollments'),
        where('studentId', '==', studentId),
        where('courseId', '==', courseId),
        where('paymentStatus', '==', 'completed')
      );
      const enrollSnap = await getDocs(enrollQ);
      if (enrollSnap.empty) return null;

      const enrollData = enrollSnap.docs[0].data();

      const courseDoc = await getDoc(doc(db, 'courses', courseId));
      if (!courseDoc.exists()) return null;

      const courseData = courseDoc.data();

      const hydratedStructure = await contentLibraryService.hydrateContentNodes(
        courseData.contentStructure || []
      );

      return {
        courseId,
        title: courseData.title || 'Untitled Course',
        thumbnail: courseData.thumbnail,
        thumbnailUrl: courseData.thumbnailUrl,
        subjects: courseData.subjects || [],
        contentStructure: hydratedStructure,
        enrolledAt: toDate(enrollData.enrolledAt),
        progress: enrollData.progress || 0,
        validity: courseData.validity,
      };
    } catch (err) {
      console.error('Error fetching course library data:', err);
      return null;
    }
  },
};
