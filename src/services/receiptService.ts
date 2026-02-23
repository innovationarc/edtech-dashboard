// src/services/receiptService.ts

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../config/firebase';

// ==================== INTERFACES ====================

export interface ReceiptData {
  // Receipt meta
  receiptNumber: string;
  issuedAt: Date;

  // Student
  studentName: string;
  studentEmail: string;
  studentUserId: string;

  // Course
  courseTitle: string;
  courseClass: string;
  courseCategory: string;
  courseInstructor: string;

  // Payment
  basePrice: number;
  amountPaid: number;
  totalDiscount: number;
  paymentStatus: string;
  paymentMethod: string;
  transactionId: string;
  enrollmentId: string;
  isFree: boolean;

  // Discount breakdown
  previousStudentDiscount: number;
  extraDiscount: number;
  couponDiscount: number;
  couponCodes: string[];
}

export type ReceiptFetchStatus =
  | 'success'
  | 'not_found'
  | 'permission_denied'
  | 'error';

export interface ReceiptResult {
  status: ReceiptFetchStatus;
  data?: ReceiptData;
  message: string;
}

// ==================== HELPERS ====================

function toDate(value: any): Date {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  if (typeof value.toDate === 'function') return value.toDate();
  if (value.seconds !== undefined) return new Date(value.seconds * 1000);
  const p = new Date(value);
  return isNaN(p.getTime()) ? new Date() : p;
}

/**
 * Derives a human-readable receipt number from the Firestore enrollment doc ID.
 * Format: RCP-{first 8 chars of enrollmentId uppercased}
 * No extra storage needed — deterministic and reversible.
 */
export function deriveReceiptNumber(enrollmentId: string): string {
  return 'RCP-' + enrollmentId.slice(0, 8).toUpperCase();
}

// ==================== SERVICE ====================

const receiptService = {

  /**
   * Fetches all data needed to render an enrollment receipt.
   *
   * Steps:
   *  1. Fetch enrollment doc by enrollmentId
   *  2. Verify ownership (studentId === currentUserId)
   *  3. Fetch course doc for title/class/category/instructor
   *  4. Fetch transaction doc for paymentMethod (if not already on enrollment)
   *  5. Merge into ReceiptData
   *
   * Returns a ReceiptResult with status + data (or error message).
   */
  async getReceiptData(
    enrollmentId: string,
    currentUserId: string
  ): Promise<ReceiptResult> {
    if (!enrollmentId || !currentUserId) {
      return { status: 'not_found', message: 'Invalid enrollment reference.' };
    }

    try {
      // ── Step 1: Fetch enrollment ──────────────────────────────────────────
      const enrollRef = doc(db, 'enrollments', enrollmentId);
      const enrollSnap = await getDoc(enrollRef);

      if (!enrollSnap.exists()) {
        return {
          status: 'not_found',
          message: `Enrollment not found. Please contact support with ID: ${enrollmentId}`,
        };
      }

      const enroll = enrollSnap.data();

      // ── Step 2: Ownership check ───────────────────────────────────────────
      if (enroll.studentId !== currentUserId) {
        return {
          status: 'permission_denied',
          message: 'This receipt does not belong to your account.',
        };
      }

      // ── Step 3: Parse discounts ───────────────────────────────────────────
      const discounts = enroll.appliedDiscounts || {};

      const previousStudentDiscount: number = discounts.previousStudentDiscount || 0;
      const extraDiscount: number           = discounts.extraDiscount || 0;
      const couponDiscount: number          = discounts.couponDiscount || 0;
      const totalDiscount                   = previousStudentDiscount + extraDiscount + couponDiscount;

      // Reconstruct basePrice from amountPaid + all discounts
      const amountPaid: number = enroll.amountPaid || 0;
      const basePrice          = Math.max(0, amountPaid + totalDiscount);

      // Collect coupon codes
      const couponCodes: string[] = [];
      if (discounts.couponCode) couponCodes.push(discounts.couponCode);
      if (Array.isArray(discounts.appliedCoupons)) {
        discounts.appliedCoupons.forEach((c: any) => {
          if (c.couponCode && !couponCodes.includes(c.couponCode)) {
            couponCodes.push(c.couponCode);
          }
        });
      }

      // ── Step 4: Fetch course ──────────────────────────────────────────────
      let courseTitle      = '';
      let courseClass      = '';
      let courseCategory   = '';
      let courseInstructor = '';

      if (enroll.courseId) {
        try {
          const courseSnap = await getDoc(doc(db, 'courses', enroll.courseId));
          if (courseSnap.exists()) {
            const c = courseSnap.data();
            courseTitle      = c.title      || '';
            courseClass      = c.class      || '';
            courseCategory   = c.category   || '';
            courseInstructor = c.instructor || '';
          }
        } catch (courseErr: any) {
          console.warn('[receiptService] Could not fetch course:', courseErr.message);
          // Non-fatal — receipt still renders with enrollment data
        }
      }

      // ── Step 5: Fetch transaction for paymentMethod ───────────────────────
      let paymentMethod: string = enroll.paymentMethod || '';

      if (!paymentMethod && enroll.transactionId) {
        try {
          const txSnap = await getDocs(
            query(
              collection(db, 'transactions'),
              where('transactionId', '==', enroll.transactionId)
            )
          );
          if (!txSnap.empty) {
            paymentMethod = txSnap.docs[0].data().paymentMethod || '';
          }
        } catch (txErr: any) {
          console.warn('[receiptService] Could not fetch transaction:', txErr.message);
          // Non-fatal
        }
      }

      // ── Step 6: Build ReceiptData ─────────────────────────────────────────
      const data: ReceiptData = {
        receiptNumber:   deriveReceiptNumber(enrollmentId),
        issuedAt:        toDate(enroll.paymentDate || enroll.enrolledAt),

        studentName:     enroll.studentName   || '',
        studentEmail:    enroll.studentEmail  || '',
        studentUserId:   enroll.studentUserId || '',

        courseTitle,
        courseClass,
        courseCategory,
        courseInstructor,

        basePrice,
        amountPaid,
        totalDiscount,
        paymentStatus:   enroll.paymentStatus || '',
        paymentMethod,
        transactionId:   enroll.transactionId || '',
        enrollmentId,
        isFree:          amountPaid === 0,

        previousStudentDiscount,
        extraDiscount,
        couponDiscount,
        couponCodes,
      };

      return { status: 'success', data, message: 'Receipt loaded successfully.' };

    } catch (err: any) {
      console.error('[receiptService] getReceiptData failed:', err.message, err.stack);
      return {
        status: 'error',
        message: 'Failed to load receipt. Please try again or contact support.',
      };
    }
  },
};

export default receiptService;
