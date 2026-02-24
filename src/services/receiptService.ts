// src/services/receiptService.ts

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  serverTimestamp,
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
  // Format: RCP-LLNNNNNN (2 uppercase letters + 6 digits)
  // Derive deterministically from enrollmentId so it is always reproducible.
  const id = enrollmentId.replace(/[^a-zA-Z0-9]/g, '');

  // Extract 2 letters from alphabetic chars in the id
  const letters = id.replace(/[^a-zA-Z]/g, '').toUpperCase();
  const l1 = letters[0] || 'A';
  const l2 = letters[1] || 'B';

  // Extract 6 digits — use char codes of remaining chars if not enough raw digits
  const rawDigits = id.replace(/[^0-9]/g, '');
  let digits = rawDigits;
  if (digits.length < 6) {
    // Pad with char-code-derived digits from the id string
    for (let i = 0; digits.length < 6; i++) {
      digits += (id.charCodeAt(i % id.length) % 10).toString();
    }
  }
  const sixDigits = digits.slice(0, 6).padStart(6, '0');

  return `RCP-${l1}${l2}${sixDigits}`;
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

// Serialize ReceiptData for Firestore (Date → ISO string)
function serializeForFirestore(data: ReceiptData, studentId: string) {
  return {
    ...data,
    issuedAt: data.issuedAt.toISOString(),
    studentId,        // for admin lookup / permission checks
    savedAt: serverTimestamp(),
  };
}

// Deserialize from Firestore (ISO string / Timestamp → Date)
function deserializeFromFirestore(raw: any): ReceiptData {
  return { ...raw, issuedAt: toDate(raw.issuedAt) } as ReceiptData;
}

// ==================== SERVICE ====================

const receiptService = {

  // ── Generate + persist receipt from enrollment ────────────────────────────
  // Used by: student receipt page, admin panel (set skipOwnershipCheck=true)
  async getReceiptData(
    enrollmentId: string,
    currentUserId: string,
    skipOwnershipCheck = false
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
      if (!skipOwnershipCheck && enroll.studentId !== currentUserId) {
        return {
          status: 'permission_denied',
          message: 'This receipt does not belong to your account.',
        };
      }

      const amountPaid: number = enroll.amountPaid || 0;

      // ── Step 3: Fetch transaction ─────────────────────────────────────────
      let paymentMethod: string   = enroll.paymentMethod || '';
      let txAppliedDiscounts: any = null;
      let studentUserId: string   = enroll.studentUserId || '';

      if (enroll.transactionId) {
        try {
          const txSnap = await getDocs(
            query(collection(db, 'transactions'), where('transactionId', '==', enroll.transactionId))
          );
          if (!txSnap.empty) {
            const txData = txSnap.docs[0].data();
            if (!paymentMethod) paymentMethod = txData.paymentMethod || '';
            if (txData.appliedDiscounts) txAppliedDiscounts = txData.appliedDiscounts;
            const meta = txData.metadata || {};
            if (meta.studentUserId) studentUserId = meta.studentUserId;
          }
        } catch (txErr: any) {
          console.warn('[receiptService] Could not fetch transaction:', txErr.message);
        }
      }

      // Prefer transaction discounts → fall back to enrollment discounts (free flow)
      const discounts = txAppliedDiscounts || enroll.appliedDiscounts || {};

      // ── Step 3b: Fallback — fetch studentUserId from users collection ──────
      // Free enrollments have no transaction metadata, so look up from user doc.
      if (!studentUserId && enroll.studentId) {
        try {
          const userSnap = await getDoc(doc(db, 'users', enroll.studentId));
          if (userSnap.exists()) {
            studentUserId = userSnap.data().userId || '';
          }
        } catch (userErr: any) {
          console.warn('[receiptService] Could not fetch user for studentUserId:', userErr.message);
        }
      }

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
      const receiptNumber = deriveReceiptNumber(enrollmentId);

      const data: ReceiptData = {
        receiptNumber,
        issuedAt:        toDate(enroll.paymentDate || enroll.enrolledAt),
        studentName:     enroll.studentName   || '',
        studentEmail:    enroll.studentEmail  || '',
        studentUserId,
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

      // ── Step 6: Persist to receipts/{receiptNumber} ───────────────────────
      // Doc ID = receiptNumber → enables direct QR lookup.
      // Only writes on first generation — never overwrites existing receipt.
      try {
        const receiptRef = doc(db, 'receipts', receiptNumber);
        const existing   = await getDoc(receiptRef);
        if (!existing.exists()) {
          await setDoc(receiptRef, serializeForFirestore(data, enroll.studentId || ''));
        }
      } catch (saveErr: any) {
        // Non-fatal — receipt still renders even if save fails
        console.warn('[receiptService] Could not persist receipt:', saveErr.message);
      }

      return { status: 'success', data, message: 'Receipt loaded successfully.' };

    } catch (err: any) {
      console.error('[receiptService] getReceiptData failed:', err.message, err.stack);
      return {
        status: 'error',
        message: 'Failed to load receipt. Please try again or contact support.',
      };
    }
  },

  // ── Lookup by receipt number — used by QR verify page ────────────────────
  // URL: /verify-receipt?r=RCP-XXXXXXXX
  async getReceiptByNumber(receiptNumber: string): Promise<ReceiptResult> {
    if (!receiptNumber) {
      return { status: 'not_found', message: 'No receipt number provided.' };
    }
    try {
      const snap = await getDoc(doc(db, 'receipts', receiptNumber.toUpperCase()));
      if (!snap.exists()) {
        return {
          status: 'not_found',
          message: 'No receipt found for this number. The student may need to open their receipt once first.',
        };
      }
      return {
        status: 'success',
        data: deserializeFromFirestore(snap.data()),
        message: 'This receipt is authentic and verified.',
      };
    } catch (err: any) {
      console.error('[receiptService] getReceiptByNumber failed:', err.message);
      return { status: 'error', message: 'Verification service unavailable. Please try again later.' };
    }
  },

  // ── Lookup by transaction ID — used by admin panel ────────────────────────
  async getReceiptByTransactionId(transactionId: string): Promise<ReceiptResult> {
    if (!transactionId) {
      return { status: 'not_found', message: 'No transaction ID provided.' };
    }
    try {
      const snap = await getDocs(
        query(collection(db, 'receipts'), where('transactionId', '==', transactionId))
      );
      if (snap.empty) {
        return { status: 'not_found', message: 'No receipt found for this transaction ID.' };
      }
      return {
        status: 'success',
        data: deserializeFromFirestore(snap.docs[0].data()),
        message: 'Receipt found.',
      };
    } catch (err: any) {
      console.error('[receiptService] getReceiptByTransactionId failed:', err.message);
      return { status: 'error', message: 'Could not look up receipt. Please try again.' };
    }
  },

};

export default receiptService;
