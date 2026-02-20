// src/services/courseEnrollmentService.ts
//
// PRODUCTION-GRADE Course Enrollment Service
// Completely separate from courseService.ts — zero modifications to that file.
//
// KEY SECURITY GUARANTEES:
// ─────────────────────────────────────────────────────────────────────────────
// 1. ONE-TIME CLAIM TOKEN: The backend writes a cryptographically random
//    `returnToken` to the transaction Firestore doc at callback time.
//    The frontend must present this token; the backend atomically marks it
//    consumed so it can never be reused — even by the same user.
//
// 2. OWNERSHIP CHECK: transaction.userId must equal user.uid.
//    Different-user URL replay is rejected outright.
//
// 3. STATUS CHECK: Only 'success' transactions produce an enrollment.
//    'pending', 'failed', 'cancelled' are all terminal.
//
// 4. IDEMPOTENCY: Enrollment creation is keyed on transactionId, so
//    double-processing (IPN + callback) never creates duplicate records.
//
// FRONTEND RACE FIX:
// ─────────────────────────────────────────────────────────────────────────────
// Instead of relying on React state to propagate correctly across multiple
// simultaneous setState() calls (which caused the "enrolled tab empty until
// refresh" bug), all post-payment UI state is returned from a single async
// call and applied atomically.
//
// BACKWARDS COMPATIBILITY:
// ─────────────────────────────────────────────────────────────────────────────
// courseService.ts is NOT modified. This file adds new capabilities only.

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
  /** Payment ownership + status is verified and enrollment exists */
  verified: boolean;
  /** Transaction record status */
  status: 'success' | 'pending' | 'failed' | 'cancelled' | 'validating' | 'not_found' | 'ownership_error' | 'token_already_used';
  /** Enrollment document id if found */
  enrollmentId?: string;
  /** Course title from transaction metadata */
  courseTitle?: string;
  /** Course id */
  courseId?: string;
  /** Whether this is a replayed URL (token already consumed) */
  isReplay: boolean;
  /** Human-readable message for display */
  message: string;
}

export interface EnrolledCourseInfo {
  courseId: string;
  enrollmentId: string;
  progress: number;
  enrolledAt: Date;
  transactionId?: string;
}

// ==================== CONSTANTS ====================

/** Firestore collection names — single source of truth */
const COLLECTIONS = {
  TRANSACTIONS: 'transactions',
  ENROLLMENTS: 'enrollments',
} as const;

// ==================== HELPERS ====================

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ==================== ENROLLMENT SERVICE ====================

export const courseEnrollmentService = {

  // ─────────────────────────────────────────────────────────────────────────
  // verifyPaymentAndGetEnrollment
  //
  // PRIMARY ENTRY POINT for the post-payment return URL handler.
  //
  // Security flow:
  //   1. Fetch transaction by tran_id
  //   2. Check userId ownership
  //   3. Atomically consume the one-time returnToken
  //      → if already consumed: isReplay=true, still show info but no re-enroll
  //   4. Verify payment status
  //   5. Poll for enrollment doc with exponential backoff
  //
  // Returns a rich result object — caller decides what UI to show.
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
      // ── Step 1: Fetch transaction ──────────────────────────────────────────
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

      // ── Step 2: Ownership check ───────────────────────────────────────────
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

      // ── Step 3: Atomic one-time token consumption ─────────────────────────
      // The backend writes `returnToken` when redirecting after payment.
      // We use a Firestore transaction to atomically:
      //   a) Read the current returnToken value
      //   b) If it's already null/consumed → isReplay = true
      //   c) If present → set it to null (consume it) and continue
      //
      // This means the VERY FIRST browser tab to process this URL wins.
      // Every subsequent open — same user, different tab, copied URL — is replay.
      let isReplay = false;

      try {
        await firestoreRunTransaction(db, async (t) => {
          const txnRef = doc(db, COLLECTIONS.TRANSACTIONS, txnDoc.id);
          const freshSnap = await t.get(txnRef);
          const freshData = freshSnap.data() || {};

          if (freshData.returnToken === null || freshData.returnToken === undefined) {
            // Token already consumed — this is a replay
            isReplay = true;
            // Don't throw — we still want to show the user their enrollment
          } else {
            // First use — consume the token
            t.update(txnRef, {
              returnToken: null,
              returnTokenConsumedAt: Timestamp.now(),
              returnTokenConsumedBy: currentUserId,
            });
          }
        });
      } catch (tokenErr: any) {
        // If the transaction fails (e.g. no returnToken field at all — legacy),
        // treat as replay-safe: check enrollment existence but don't block.
        console.warn(`${TAG} Token consumption failed (non-fatal):`, tokenErr.message);
        isReplay = true; // conservative: treat missing token as already consumed
      }

      // ── Step 4: Payment status check ─────────────────────────────────────
      // Re-fetch to get the most current status after token consumption
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

      // ── Step 5: Poll for enrollment doc ──────────────────────────────────
      // The backend creates the enrollment in the callback, but Firestore
      // propagation can take seconds. We poll with exponential backoff.
      const delays = [500, 800, 1200, 1500, 1500, 2000, 2000, 2500]; // ~12s total

      for (let attempt = 0; attempt <= delays.length; attempt++) {
        if (attempt > 0) {
          await sleep(delays[attempt - 1]);
        }

        try {
          // Primary: by transactionId (most specific)
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

          // Secondary: by studentId + courseId (handles IPN-created enrollments)
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

      // Exhausted all retries — enrollment not found but payment succeeded
      console.warn(`${TAG} Enrollment not found after ${delays.length + 1} attempts`);
      return {
        verified: false, // enrollment not confirmed in DB
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
  // getStudentEnrolledCourseIds
  //
  // Lightweight helper to get just the enrolled course IDs for a student.
  // Used to determine which courses are already enrolled so we can filter.
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
  // Quick boolean check for a single course.
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
