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
  receiptNumber: string;
  issuedAt: Date;
  studentName: string;
  studentEmail: string;
  studentUserId: string;
  courseTitle: string;
  courseClass: string;
  courseCategory: string;
  courseInstructor: string;
  basePrice: number;
  amountPaid: number;
  totalDiscount: number;
  paymentStatus: string;
  paymentMethod: string;
  transactionId: string;
  enrollmentId: string;
  isFree: boolean;
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

export function deriveReceiptNumber(enrollmentId: string): string {
  return 'RCP-' + enrollmentId.slice(0, 8).toUpperCase();
}

function parseCouponCodes(discounts: any): string[] {
  const codes: string[] = [];
  if (discounts.couponCode) codes.push(discounts.couponCode);
  if (Array.isArray(discounts.appliedCoupons)) {
    discounts.appliedCoupons.forEach((c: any) => {
      if (c.couponCode && !codes.includes(c.couponCode)) codes.push(c.couponCode);
    });
  }
  return codes;
}

// ==================== SERVICE ====================

const receiptService = {

  async getReceiptData(
    enrollmentId: string,
    currentUserId: string
  ): Promise<ReceiptResult> {
    if (!enrollmentId || !currentUserId) {
      return { status: 'not_found', message: 'Invalid enrollment reference.' };
    }

    try {
      // ── Step 1: Fetch enrollment ──────────────────────────────────────────
      const enrollSnap = await getDoc(doc(db, 'enrollments', enrollmentId));
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

      const amountPaid: number = enroll.amountPaid || 0;

      // ── Step 3: Fetch transaction ─────────────────────────────────────────
      // For PAID enrollments the payment webhook creates the enrollment doc but
      // does NOT copy appliedDiscounts onto it — those only live on the
      // transaction doc. So we always fetch the transaction and use its
      // appliedDiscounts as the authoritative source, falling back to whatever
      // is on the enrollment doc (free enrollments write discounts there).
      let paymentMethod: string = enroll.paymentMethod || '';
      let txAppliedDiscounts: any = null;

      if (enroll.transactionId) {
        try {
          const txSnap = await getDocs(
            query(collection(db, 'transactions'), where('transactionId', '==', enroll.transactionId))
          );
          if (!txSnap.empty) {
            const txData = txSnap.docs[0].data();
            if (!paymentMethod) paymentMethod = txData.paymentMethod || '';
            if (txData.appliedDiscounts) txAppliedDiscounts = txData.appliedDiscounts;
          }
        } catch (txErr: any) {
          console.warn('[receiptService] Could not fetch transaction:', txErr.message);
        }
      }

      // Prefer transaction discounts (paid flow) → fall back to enrollment discounts (free flow)
      const discounts = txAppliedDiscounts || enroll.appliedDiscounts || {};

      const previousStudentDiscount: number = discounts.previousStudentDiscount || 0;
      const extraDiscount: number           = discounts.extraDiscount           || 0;
      const couponDiscount: number          = discounts.couponDiscount          || 0;
      const totalDiscount                   = previousStudentDiscount + extraDiscount + couponDiscount;
      const basePrice                       = Math.max(0, amountPaid + totalDiscount);
      const couponCodes                     = parseCouponCodes(discounts);

      // ── Step 4: Fetch course ──────────────────────────────────────────────
      let courseTitle = '', courseClass = '', courseCategory = '', courseInstructor = '';
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
        }
      }

      // ── Step 5: Build ReceiptData ─────────────────────────────────────────
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
