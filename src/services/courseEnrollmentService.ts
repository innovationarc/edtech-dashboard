// src/services/courseEnrollmentService.ts
//
// STANDALONE Course Enrollment Service
// NO DEPENDENCY on courseService.ts - completely self-contained
//
// Handles:
// - Payment verification & enrollment retrieval
// - Loading all courses with enrollment status
// - Checking enrollment status
// - All enrollment-related operations

import {
  collection,
  doc,
  getDocs,
  query,
  where,
  runTransaction as firestoreRunTransaction,
  Timestamp
} from 'firebase/firestore';
import { db } from '../config/firebase';

// ==================== INTERFACES ====================

export interface EnrollmentVerificationResult {
  verified: boolean;
  status: 'success' | 'pending' | 'failed' | 'cancelled' | 'validating' | 'not_found' | 'ownership_error' | 'token_already_used';
  enrollmentId?: string;
  courseTitle?: string;
  courseId?: string;
  isReplay: boolean;
  message: string;
}

export interface EnrolledCourseInfo {
  id: string;
  courseId: string;
  enrollmentId: string;
  progress: number;
  enrolledAt: Date;
  transactionId?: string;
  completedLessons?: string[];
}

export interface Course {
  id: string;
  title: string;
  description: string;
  instructor: string;
  instructorId: string;
  category: string;
  class: string;
  subjects: string[];
  level: string;
  duration: string;
  thumbnail: string;
  price: number;
  rating: number;
  studentCount: number;
  tags: string[];
  status: string;
  createdAt: Date;
  // Enrollment-specific fields (added when loading)
  isEnrolled?: boolean;
  progress?: number;
  enrollmentId?: string;
  enrolledAt?: Date;
}

// ==================== CONSTANTS ====================

const COLLECTIONS = {
  TRANSACTIONS: 'transactions',
  ENROLLMENTS: 'enrollments',
  COURSES: 'courses',
} as const;

// ==================== HELPERS ====================

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Safely convert Firestore Timestamp to Date
 * Handles both Timestamp objects and plain objects with seconds/nanoseconds
 */
function toDate(value: any): Date {
  if (!value) return new Date();
  
  // Already a Date
  if (value instanceof Date) return value;
  
  // Firestore Timestamp with toDate method
  if (typeof value.toDate === 'function') {
    return value.toDate();
  }
  
  // Plain object with seconds/nanoseconds (serialized Timestamp)
  if (value.seconds !== undefined) {
    return new Date(value.seconds * 1000);
  }
  
  // Fallback: try to parse as date string or timestamp
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}

// ==================== ENROLLMENT SERVICE ====================

export const courseEnrollmentService = {

  // ─────────────────────────────────────────────────────────────────────────
  // verifyPaymentAndGetEnrollment
  //
  // PRIMARY ENTRY POINT for post-payment return URL handler
  // ─────────────────────────────────────────────────────────────────────────

  async verifyPaymentAndGetEnrollment(
    tranId: string,
    currentUserId: string
  ): Promise<EnrollmentVerificationResult> {
    const TAG = '[courseEnrollmentService.verifyPaymentAndGetEnrollment]';
    console.log(`${TAG} Starting verification`, { tranId, currentUserId });

    if (!tranId || !currentUserId) {
      return {
        verified: false,
        status: 'not_found',
        isReplay: false,
        message: 'Invalid payment reference. Please contact support.',
      };
    }

    try {
      // Step 1: Fetch transaction
      const txnSnap = await getDocs(query(
        collection(db, COLLECTIONS.TRANSACTIONS),
        where('transactionId', '==', tranId)
      ));

      if (txnSnap.empty) {
        console.error(`${TAG} Transaction not found:`, tranId);
        return {
          verified: false,
          status: 'not_found',
          isReplay: false,
          message: `Payment record not found. Contact support with ref: ${tranId}`,
        };
      }

      const txnDoc = txnSnap.docs[0];
      const txn = txnDoc.data();

      // Step 2: Ownership check
      if (txn.userId !== currentUserId) {
        console.error(`${TAG} SECURITY: Ownership mismatch`, {
          txnUserId: txn.userId,
          currentUserId,
          tranId,
        });
        return {
          verified: false,
          status: 'ownership_error',
          isReplay: false,
          message: 'This payment reference does not belong to your account.',
        };
      }

      const courseTitle: string = txn.productName || txn.metadata?.courseTitle || '';
      const courseId: string = txn.productId || txn.metadata?.courseId || '';

      // Step 3: Atomic one-time token consumption
      let isReplay = false;

      try {
        await firestoreRunTransaction(db, async (t) => {
          const txnRef = doc(db, COLLECTIONS.TRANSACTIONS, txnDoc.id);
          const freshSnap = await t.get(txnRef);
          const freshData = freshSnap.data() || {};

          if (freshData.returnToken === null || freshData.returnToken === undefined) {
            isReplay = true;
          } else {
            t.update(txnRef, {
              returnToken: null,
              returnTokenConsumedAt: Timestamp.now(),
              returnTokenConsumedBy: currentUserId,
            });
          }
        });
      } catch (tokenErr: any) {
        console.warn(`${TAG} Token consumption failed (non-fatal):`, tokenErr.message);
        isReplay = true;
      }

      // Step 4: Payment status check
      const freshTxnSnap = await getDocs(query(
        collection(db, COLLECTIONS.TRANSACTIONS),
        where('transactionId', '==', tranId)
      ));
      const freshTxn = freshTxnSnap.empty ? txn : freshTxnSnap.docs[0].data();

      if (freshTxn.status === 'failed' || freshTxn.status === 'cancelled') {
        return {
          verified: false,
          status: freshTxn.status,
          courseTitle,
          courseId,
          isReplay,
          message: `Payment was ${freshTxn.status}. Please try again or contact support.`,
        };
      }

      if (freshTxn.status === 'validating') {
        return {
          verified: false,
          status: 'validating',
          courseTitle,
          courseId,
          isReplay,
          message: 'Your payment is under manual review. You will be enrolled once approved.',
        };
      }

      if (freshTxn.status !== 'success' && freshTxn.status !== 'pending') {
        return {
          verified: false,
          status: 'not_found',
          courseTitle,
          courseId,
          isReplay,
          message: `Unexpected payment status: ${freshTxn.status}. Contact support with ref: ${tranId}`,
        };
      }

      // Step 5: Poll for enrollment doc
      const delays = [500, 800, 1200, 1500, 1500, 2000, 2000, 2500];

      for (let attempt = 0; attempt <= delays.length; attempt++) {
        if (attempt > 0) {
          await sleep(delays[attempt - 1]);
        }

        try {
          const byTxn = await getDocs(query(
            collection(db, COLLECTIONS.ENROLLMENTS),
            where('transactionId', '==', tranId)
          ));
          
          if (!byTxn.empty) {
            const enrollDoc = byTxn.docs[0];
            console.log(`${TAG} Enrollment found by transactionId on attempt ${attempt + 1}`);
            return {
              verified: true,
              status: 'success',
              enrollmentId: enrollDoc.id,
              courseTitle,
              courseId,
              isReplay,
              message: isReplay
                ? `You are already enrolled in "${courseTitle || 'this course'}".`
                : `Payment verified! You are now enrolled in "${courseTitle || 'the course'}".`,
            };
          }

          if (courseId) {
            const byCourse = await getDocs(query(
              collection(db, COLLECTIONS.ENROLLMENTS),
              where('studentId', '==', currentUserId),
              where('courseId', '==', courseId)
            ));
            
            if (!byCourse.empty) {
              const enrollDoc = byCourse.docs[0];
              console.log(`${TAG} Enrollment found by studentId+courseId on attempt ${attempt + 1}`);
              return {
                verified: true,
                status: 'success',
                enrollmentId: enrollDoc.id,
                courseTitle,
                courseId,
                isReplay,
                message: isReplay
                  ? `You are already enrolled in "${courseTitle || 'this course'}".`
                  : `Payment verified! You are now enrolled in "${courseTitle || 'the course'}".`,
              };
            }
          }

          console.log(`${TAG} Enrollment not yet found, attempt ${attempt + 1}/${delays.length + 1}`);
        } catch (pollErr: any) {
          console.warn(`${TAG} Poll attempt ${attempt + 1} error:`, pollErr.message);
        }
      }

      console.warn(`${TAG} Enrollment not found after ${delays.length + 1} attempts`);
      return {
        verified: false,
        status: 'pending',
        courseTitle,
        courseId,
        isReplay,
        message: 'Payment confirmed! Your enrollment is being activated. If the course does not appear, please refresh the page in a moment.',
      };

    } catch (err: any) {
      console.error(`${TAG} Unexpected error:`, err);
      return {
        verified: false,
        status: 'not_found',
        isReplay: false,
        message: `An unexpected error occurred. Your payment may still have been processed. Contact support with ref: ${tranId}`,
      };
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // getStudentEnrollments
  //
  // Get all enrollments for a student with full enrollment data
  // FIX: Safely handles Timestamp conversion
  // ─────────────────────────────────────────────────────────────────────────

  async getStudentEnrollments(studentId: string): Promise<EnrolledCourseInfo[]> {
    const TAG = '[courseEnrollmentService.getStudentEnrollments]';
    
    if (!studentId) {
      console.warn(`${TAG} No studentId provided`);
      return [];
    }

    try {
      const snap = await getDocs(query(
        collection(db, COLLECTIONS.ENROLLMENTS),
        where('studentId', '==', studentId)
      ));

      const enrollments: EnrolledCourseInfo[] = snap.docs.map(doc => {
        const data = doc.data();
        
        return {
          id: doc.id,
          courseId: data.courseId || '',
          enrollmentId: doc.id,
          progress: data.progress || 0,
          enrolledAt: toDate(data.enrolledAt), // SAFE conversion
          transactionId: data.transactionId,
          completedLessons: data.completedLessons || [],
        };
      });

      console.log(`${TAG} Found ${enrollments.length} enrollments for student ${studentId}`);
      return enrollments;

    } catch (err: any) {
      console.error(`${TAG} Error:`, err.message);
      console.error('Stack:', err.stack);
      console.error('Context:', { studentId });
      return [];
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // getPublishedCourses
  //
  // Get all published courses (status === 'published')
  // ─────────────────────────────────────────────────────────────────────────

  async getPublishedCourses(): Promise<Course[]> {
    const TAG = '[courseEnrollmentService.getPublishedCourses]';
    
    try {
      const snap = await getDocs(query(
        collection(db, COLLECTIONS.COURSES),
        where('status', '==', 'published')
      ));

      const courses: Course[] = snap.docs.map(doc => {
        const data = doc.data();
        
        return {
          id: doc.id,
          title: data.title || '',
          description: data.description || '',
          instructor: data.instructor || '',
          instructorId: data.instructorId || '',
          category: data.category || '',
          class: data.class || '',
          subjects: data.subjects || [],
          level: data.level || 'beginner',
          duration: data.duration || '',
          thumbnail: data.thumbnail || '',
          price: data.price || 0,
          rating: data.rating || 0,
          studentCount: data.studentCount || 0,
          tags: data.tags || [],
          status: data.status || 'draft',
          createdAt: toDate(data.createdAt),
        };
      });

      console.log(`${TAG} Found ${courses.length} published courses`);
      return courses;

    } catch (err: any) {
      console.error(`${TAG} Error:`, err.message);
      console.error('Stack:', err.stack);
      return [];
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // getCoursesWithEnrollmentStatus
  //
  // Get all courses with enrollment status for a specific student
  // Returns courses marked with isEnrolled, progress, enrollmentId
  // ─────────────────────────────────────────────────────────────────────────

  async getCoursesWithEnrollmentStatus(studentId: string): Promise<Course[]> {
    const TAG = '[courseEnrollmentService.getCoursesWithEnrollmentStatus]';
    
    try {
      console.log(`${TAG} Loading courses for student:`, studentId);

      const [courses, enrollments] = await Promise.all([
        this.getPublishedCourses(),
        this.getStudentEnrollments(studentId),
      ]);

      const enrollmentMap = new Map<string, EnrolledCourseInfo>();
      enrollments.forEach(e => {
        enrollmentMap.set(e.courseId, e);
      });

      const enrichedCourses: Course[] = courses.map(course => {
        const enrollment = enrollmentMap.get(course.id);
        
        return {
          ...course,
          isEnrolled: !!enrollment,
          progress: enrollment?.progress || 0,
          enrollmentId: enrollment?.enrollmentId,
          enrolledAt: enrollment?.enrolledAt,
        };
      });

      console.log(`${TAG} Loaded ${enrichedCourses.length} courses, ${enrollments.length} enrolled`);
      return enrichedCourses;

    } catch (err: any) {
      console.error(`${TAG} Error:`, err.message);
      console.error('Stack:', err.stack);
      return [];
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // getStudentEnrolledCourseIds
  //
  // Lightweight helper to get just enrolled course IDs
  // ─────────────────────────────────────────────────────────────────────────

  async getStudentEnrolledCourseIds(studentId: string): Promise<Set<string>> {
    if (!studentId) return new Set();
    
    try {
      const snap = await getDocs(query(
        collection(db, COLLECTIONS.ENROLLMENTS),
        where('studentId', '==', studentId)
      ));
      
      const ids = new Set<string>();
      snap.docs.forEach(d => {
        const courseId = d.data().courseId;
        if (courseId) ids.add(courseId);
      });
      
      return ids;
    } catch (err: any) {
      console.error('[courseEnrollmentService.getStudentEnrolledCourseIds]', err.message);
      return new Set();
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // isAlreadyEnrolled
  //
  // Quick boolean check for a single course
  // ─────────────────────────────────────────────────────────────────────────

  async isAlreadyEnrolled(studentId: string, courseId: string): Promise<boolean> {
    if (!studentId || !courseId) return false;
    
    try {
      const snap = await getDocs(query(
        collection(db, COLLECTIONS.ENROLLMENTS),
        where('studentId', '==', studentId),
        where('courseId', '==', courseId)
      ));
      
      return !snap.empty;
    } catch (err: any) {
      console.error('[courseEnrollmentService.isAlreadyEnrolled]', err.message);
      return false;
    }
  },
};

export default courseEnrollmentService;
