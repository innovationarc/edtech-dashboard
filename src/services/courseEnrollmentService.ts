// src/services/courseEnrollmentService.ts
// ─────────────────────────────────────────────────────────────────────────────
// ALL PREVIOUS FEATURES 100% PRESERVED + BACKWARDS COMPATIBLE
//
// ADDITIONS IN THIS VERSION:
//  1. recordPreviousStudentStatus — writes to userStudentRecords/{uid} after
//     any successful enrollment so the "previous student" status persists even
//     after a course is deleted or expired.
//  2. hasPreviousStudentRecord — reads that record; used by
//     calculateEnrollmentPrice as the authoritative source of truth.
//  3. calculateEnrollmentPrice now checks userStudentRecords first, then falls
//     back to live enrollment count (backward compatible).
//  4. Discounts treated as flat BDT amounts (not percentages) — matches
//     CourseCreation form which stores "Amount in BDT".
//  5. getPublishedCourses filters expired / not-yet-visible courses.
// ─────────────────────────────────────────────────────────────────────────────

import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  query,
  where,
  orderBy,
  runTransaction as firestoreRunTransaction,
  Timestamp,
  addDoc
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { otpService } from './otpService';
import couponService from './couponService';

// ==================== INTERFACES ====================

export interface ContentNode {
  id: string;
  type: 'folder' | 'content';
  name: string;
  contentId?: string;
  contentData?: any;
  children: ContentNode[];
  isExpanded?: boolean;
  order: number;
}

export interface CourseLesson {
  id: string;
  title: string;
  duration: string;
  type: 'video' | 'text' | 'quiz' | 'assignment';
  isPreview: boolean;
  videoUrl?: string;
  pdfUrl?: string;
  content?: string;
  order: number;
  topics?: string[];
}

export interface Course {
  id: string;
  title: string;
  description: string;
  instructor: string;
  instructorId: string;
  price: number;
  originalPrice?: number;
  rating: number;
  reviewCount: number;
  studentCount: number;
  duration: string;
  level: 'beginner' | 'intermediate' | 'advanced' | 'unspecified';
  category: string;
  class: string;
  subjects: string[];
  tags: string[];
  thumbnail: string;
  thumbnailUrl?: string;
  previewVideo?: string;
  lessons: CourseLesson[];
  requirements: string[];
  whatYouWillLearn: string[];

  // validity = ISO date string — course enrollment closes after this date
  validity?: string;
  // visibilityDate = ISO date string — course appears to students after this date
  visibilityDate?: string;
  // Discounts stored as flat BDT amounts (NOT percentages)
  previousStudentDiscount?: number;
  extraDiscount?: number;
  extraDiscountValidUntil?: string;

  routineFiles?: Array<{
    id: string;
    url: string;
    fileName: string;
    category: string;
  }>;

  contentStructure?: ContentNode[];

  hasAiQnA: boolean;
  hasHumanQnA: boolean;
  hasStudyPlanner: boolean;
  hasQnA: boolean;

  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Enrollment {
  id: string;
  courseId: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  enrolledAt: Date;
  progress: number;
  completedLessons: string[];
  lastAccessedAt: Date;
  certificateIssued?: boolean;

  paymentStatus: 'pending' | 'completed' | 'failed' | 'refunded';
  transactionId?: string;
  amountPaid: number;
  paymentMethod?: string;
  paymentDate?: Date;

  appliedDiscounts?: {
    previousStudentDiscount?: number;
    extraDiscount?: number;
    couponDiscount?: number;
    couponCode?: string;
    couponId?: string;
    appliedCoupons?: AppliedCoupon[];
  };
}

export interface AppliedCoupon {
  couponId: string;
  couponCode: string;
  discount: number;
  successMessage?: string;
}

export interface EnrollmentCalculation {
  basePrice: number;
  previousStudentDiscount: number;
  extraDiscount: number;
  appliedCoupons: AppliedCoupon[];
  couponDiscount: number;
  totalDiscount: number;
  finalPrice: number;
  hasPreviousEnrollments: boolean;
  isExtraDiscountValid: boolean;
  couponId?: string;
  couponCode?: string;
  couponSuccessMessage?: string;
  couponError?: string;
  courseId?: string;
}

export interface EnrollmentRequest {
  courseId: string;
  studentId: string;
  studentName: string;
  studentEmail?: string;
  studentPhone?: string;
  studentSurname?: string;
  studentUserId?: string;
  calculation: EnrollmentCalculation;
}

export interface EnrollmentResponse {
  success: boolean;
  enrollmentId?: string;
  transactionId?: string;
  gatewayUrl?: string;
  error?: string;
  message?: string;
  details?: string;
  userMessage?: string;
}

export interface EnrollmentVerificationResult {
  verified: boolean;
  status: 'success' | 'pending' | 'failed' | 'cancelled' | 'validating' | 'not_found' | 'ownership_error' | 'token_already_used';
  enrollmentId?: string;
  courseTitle?: string;
  courseId?: string;
  isReplay: boolean;
  message: string;
}

// ==================== CONSTANTS ====================

const COLLECTIONS = {
  TRANSACTIONS: 'transactions',
  ENROLLMENTS: 'enrollments',
  COURSES: 'courses',
  COUPONS: 'coupons',
  COUPON_USAGE: 'couponUsage',
  // Persistent student records — survives course deletion / expiry
  STUDENT_RECORDS: 'userStudentRecords',
} as const;

const BACKEND_URL = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

// ==================== HELPERS ====================

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function toDate(value: any): Date {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  if (typeof value.toDate === 'function') return value.toDate();
  if (value.seconds !== undefined) return new Date(value.seconds * 1000);
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}

function sanitize(obj: any): any {
  if (obj === null || obj === undefined) return null;
  if (Array.isArray(obj)) return obj.filter(v => v !== undefined).map(sanitize);
  if (typeof obj === 'object') {
    const clean: any = {};
    for (const key in obj) {
      if (obj[key] !== undefined) clean[key] = sanitize(obj[key]);
    }
    return clean;
  }
  return obj;
}

function logError(operation: string, error: any, context?: any): void {
  console.error('\n🚨 COURSE ENROLLMENT SERVICE ERROR 🚨');
  console.error('═'.repeat(60));
  console.error('Operation:', operation);
  console.error('Error:', error.message || error);
  if (context) console.error('Context:', JSON.stringify(context, null, 2));
  console.error('Timestamp:', new Date().toISOString());
  console.error('═'.repeat(60) + '\n');
}

/**
 * Returns true when a course is currently visible to students.
 * - visibilityDate (if set) must be <= now
 * - validity (if set) must be >= now  (not expired)
 */
function isCourseVisibleNow(data: any): boolean {
  const now = new Date();
  if (data.visibilityDate) {
    const vis = new Date(data.visibilityDate);
    if (!isNaN(vis.getTime()) && vis > now) return false;
  }
  if (data.validity) {
    const exp = new Date(data.validity);
    if (!isNaN(exp.getTime()) && exp < now) return false;
  }
  return true;
}

// ==================== COURSE ENROLLMENT SERVICE ====================

export const courseEnrollmentService = {

  // ─────────────────────────────────────────────────────────────────────────
  // getPublishedCourses
  // Returns only published, currently-visible courses (not expired, not future).
  // ─────────────────────────────────────────────────────────────────────────

  async getPublishedCourses(): Promise<Course[]> {
    try {
      console.log('📚 Getting published courses...');
      const coursesCollection = collection(db, COLLECTIONS.COURSES);
      let rawCourses: any[] = [];

      try {
        const q = query(
          coursesCollection,
          where('isPublished', '==', true),
          orderBy('createdAt', 'desc')
        );
        const snap = await getDocs(q);
        rawCourses = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
      } catch {
        console.warn('⚠️ Firestore index missing, filtering locally');
        const snap = await getDocs(coursesCollection);
        rawCourses = snap.docs
          .map(d => ({ _id: d.id, ...d.data() }))
          .filter(d => d.isPublished === true)
          .sort((a, b) => toDate(b.createdAt).getTime() - toDate(a.createdAt).getTime());
      }

      const visibleRaw = rawCourses.filter(d => isCourseVisibleNow(d));

      const courses: Course[] = visibleRaw.map(d => ({
        id: d._id,
        ...d,
        class: d.class || '',
        subjects: d.subjects || [],
        contentStructure: d.contentStructure || [],
        routineFiles: d.routineFiles || [],
        hasAiQnA: d.hasAiQnA || false,
        hasHumanQnA: d.hasHumanQnA || false,
        hasStudyPlanner: d.hasStudyPlanner || false,
        hasQnA: d.hasQnA || false,
        createdAt: toDate(d.createdAt),
        updatedAt: toDate(d.updatedAt),
      }));

      console.log(`✅ ${courses.length} visible courses (${rawCourses.length - courses.length} hidden by date)`);
      return courses;
    } catch (error: any) {
      logError('getPublishedCourses', error);
      throw new Error(error.message);
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // getStudentEnrollments
  // ─────────────────────────────────────────────────────────────────────────

  async getStudentEnrollments(studentId: string): Promise<Enrollment[]> {
    try {
      if (!studentId?.trim()) return [];
      const q = query(collection(db, COLLECTIONS.ENROLLMENTS), where('studentId', '==', studentId));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        enrolledAt: toDate(d.data().enrolledAt),
        lastAccessedAt: toDate(d.data().lastAccessedAt),
        paymentDate: d.data().paymentDate ? toDate(d.data().paymentDate) : undefined,
      })) as Enrollment[];
    } catch (error: any) {
      logError('getStudentEnrollments', error, { studentId });
      throw new Error(error.message);
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // hasPreviousStudentRecord
  // Checks the persistent userStudentRecords collection.
  // This is the authoritative source — survives course deletion/expiry.
  // ─────────────────────────────────────────────────────────────────────────

  async hasPreviousStudentRecord(studentId: string): Promise<boolean> {
    if (!studentId) return false;
    try {
      const snap = await getDoc(doc(db, COLLECTIONS.STUDENT_RECORDS, studentId));
      if (!snap.exists()) return false;
      const data = snap.data();
      // isPreviousStudent boolean OR enrollmentCount > 0
      return data?.isPreviousStudent === true || (data?.enrollmentCount || 0) > 0;
    } catch (e) {
      console.warn('hasPreviousStudentRecord: read failed (non-fatal)', e);
      return false;
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // recordPreviousStudentStatus
  // Called after every successful enrollment.
  // Writes/updates userStudentRecords/{uid} with:
  //   isPreviousStudent: true
  //   enrollmentCount: incremented
  //   firstEnrolledAt / lastEnrolledAt timestamps
  //   lastCourseId, lastCourseName
  // ─────────────────────────────────────────────────────────────────────────

  async recordPreviousStudentStatus(
    studentId: string,
    courseId: string,
    courseName: string
  ): Promise<void> {
    if (!studentId) return;
    try {
      const ref = doc(db, COLLECTIONS.STUDENT_RECORDS, studentId);
      const snap = await getDoc(ref);
      const existing = snap.exists() ? snap.data() : {};
      await setDoc(ref, {
        isPreviousStudent: true,
        enrollmentCount: (existing?.enrollmentCount || 0) + 1,
        firstEnrolledAt: existing?.firstEnrolledAt || Timestamp.now(),
        lastEnrolledAt: Timestamp.now(),
        lastCourseId: courseId,
        lastCourseName: courseName,
        studentId,
      }, { merge: true });
      console.log('✅ Previous student record updated for', studentId);
    } catch (e) {
      console.warn('recordPreviousStudentStatus: write failed (non-fatal)', e);
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // calculateEnrollmentPrice
  //
  // FIX: previousStudentDiscount and extraDiscount are flat BDT amounts.
  // Uses userStudentRecords as primary source for "previous student" check.
  // Falls back to live enrollment count for backward compatibility.
  // ─────────────────────────────────────────────────────────────────────────

  async calculateEnrollmentPrice(
    courseId: string,
    studentId: string,
    couponCodes: string[] = []
  ): Promise<EnrollmentCalculation> {
    try {
      console.log('💰 Calculating price:', { courseId, studentId, couponCodes });

      const courseDoc = await getDoc(doc(db, COLLECTIONS.COURSES, courseId));
      if (!courseDoc.exists()) throw new Error('Course not found');
      const courseData = courseDoc.data();
      const basePrice = courseData.price || 0;

      // ── Previous student check ──────────────────────────────────────────
      // Primary: persistent record (survives course deletion/expiry)
      // Fallback: live enrollment count
      let hasPreviousEnrollments = false;
      try {
        hasPreviousEnrollments = await this.hasPreviousStudentRecord(studentId);
        if (!hasPreviousEnrollments) {
          // Fallback to live enrollment count
          const enrollSnap = await getDocs(query(
            collection(db, COLLECTIONS.ENROLLMENTS),
            where('studentId', '==', studentId)
          ));
          hasPreviousEnrollments = !enrollSnap.empty;
        }
      } catch (e) {
        console.warn('Previous student check failed, defaulting to false (non-fatal)');
      }

      // ── Previous student discount (flat BDT amount) ─────────────────────
      const rawPrev = courseData.previousStudentDiscount || 0;
      const previousStudentDiscount = hasPreviousEnrollments && rawPrev > 0
        ? Math.min(rawPrev, basePrice)
        : 0;

      // ── Extra discount (flat BDT, only if not expired) ──────────────────
      let extraDiscount = 0;
      let isExtraDiscountValid = false;
      if (courseData.extraDiscount && courseData.extraDiscount > 0 && courseData.extraDiscountValidUntil) {
        const validUntil = new Date(courseData.extraDiscountValidUntil);
        if (!isNaN(validUntil.getTime()) && validUntil > new Date()) {
          extraDiscount = Math.min(courseData.extraDiscount, basePrice);
          isExtraDiscountValid = true;
        }
      }

      // ── Coupons ──────────────────────────────────────────────────────────
      let couponDiscount = 0;
      const appliedCoupons: AppliedCoupon[] = [];
      let couponError: string | undefined;

      if (couponCodes.length > 0) {
        let enrolledCourseIds: string[] = [];
        try {
          const es = await getDocs(query(
            collection(db, COLLECTIONS.ENROLLMENTS),
            where('studentId', '==', studentId)
          ));
          enrolledCourseIds = es.docs.map(d => d.data().courseId).filter(Boolean);
        } catch { /* non-fatal */ }

        for (const code of couponCodes) {
          const upper = code.trim().toUpperCase();
          if (!upper) continue;
          if (appliedCoupons.some(c => c.couponCode === upper)) {
            couponError = `Coupon "${upper}" is already applied.`;
            continue;
          }
          try {
            const priceForValidation = Math.max(0, basePrice - previousStudentDiscount - extraDiscount - couponDiscount);
            const result = await couponService.validateCoupon(upper, studentId, courseId, priceForValidation, enrolledCourseIds);
            if (!result.valid) {
              couponError = result.reason || `Coupon "${upper}" is not valid.`;
              continue;
            }
            const discount = result.discount ?? 0;
            couponDiscount += discount;
            appliedCoupons.push({
              couponId: '',
              couponCode: upper,
              discount,
              successMessage: result.successMessage || `Coupon "${upper}" applied! ৳${discount} off.`,
            });
            couponError = undefined;
          } catch (err: any) {
            couponError = `Error validating coupon "${upper}". Please try again.`;
          }
        }

        // Back-fill coupon IDs
        if (appliedCoupons.length > 0) {
          try {
            for (const ac of appliedCoupons) {
              if (ac.couponId) continue;
              const s = await getDocs(query(collection(db, COLLECTIONS.COUPONS), where('couponCode', '==', ac.couponCode)));
              if (!s.empty) ac.couponId = s.docs[0].id;
            }
          } catch { /* non-fatal */ }
        }
      }

      const totalDiscount = previousStudentDiscount + extraDiscount + couponDiscount;
      const finalPrice = Math.max(0, basePrice - totalDiscount);

      return {
        courseId,
        basePrice,
        previousStudentDiscount,
        extraDiscount,
        couponDiscount,
        totalDiscount,
        finalPrice,
        hasPreviousEnrollments,
        isExtraDiscountValid,
        appliedCoupons,
        couponError,
        couponId: appliedCoupons[0]?.couponId,
        couponCode: appliedCoupons[0]?.couponCode,
        couponSuccessMessage: appliedCoupons[0]?.successMessage,
      };
    } catch (error: any) {
      logError('calculateEnrollmentPrice', error, { courseId, studentId });
      throw new Error(`Failed to calculate price: ${error.message}`);
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // enrollStudent — handles free and paid enrollments
  // After success: writes previous student record to Firestore.
  // ─────────────────────────────────────────────────────────────────────────

  async enrollStudent(request: EnrollmentRequest): Promise<EnrollmentResponse> {
    try {
      const { courseId, studentId, studentName, studentEmail, studentPhone, studentSurname, studentUserId, calculation } = request;
      console.log('📝 Processing enrollment:', { courseId, studentId, finalPrice: calculation.finalPrice });

      const existingSnap = await getDocs(query(
        collection(db, COLLECTIONS.ENROLLMENTS),
        where('studentId', '==', studentId),
        where('courseId', '==', courseId)
      ));
      if (!existingSnap.empty) {
        return { success: false, error: 'Already enrolled', userMessage: 'You are already enrolled in this course' };
      }

      const courseDoc = await getDoc(doc(db, COLLECTIONS.COURSES, courseId));
      if (!courseDoc.exists()) {
        return { success: false, error: 'Course not found', userMessage: 'Course not found' };
      }
      const courseData = courseDoc.data();
      const courseName = courseData.title || 'Course';

      // ── FREE ENROLLMENT ───────────────────────────────────────────────────
      if (calculation.finalPrice === 0) {
        const enrollmentData = sanitize({
          courseId,
          studentId,
          studentName,
          studentEmail: studentEmail || '',
          enrolledAt: Timestamp.now(),
          progress: 0,
          completedLessons: [],
          lastAccessedAt: Timestamp.now(),
          paymentStatus: 'completed',
          amountPaid: 0,
          paymentMethod: 'free',
          appliedDiscounts: {
            previousStudentDiscount: calculation.previousStudentDiscount,
            extraDiscount: calculation.extraDiscount,
            couponDiscount: calculation.couponDiscount,
            couponCode: calculation.couponCode,
            couponId: calculation.couponId,
            appliedCoupons: calculation.appliedCoupons,
          },
        });

        const enrollmentRef = await addDoc(collection(db, COLLECTIONS.ENROLLMENTS), enrollmentData);

        // Record coupon usage
        if (calculation.appliedCoupons?.length > 0) {
          try {
            for (const ac of calculation.appliedCoupons) {
              if (ac.couponId) await couponService.recordCouponUsage(ac.couponId, studentId, courseId, enrollmentRef.id);
            }
          } catch { /* non-fatal */ }
        }

        // Increment student count
        try {
          const { updateDoc, increment } = await import('firebase/firestore');
          await updateDoc(doc(db, COLLECTIONS.COURSES, courseId), { studentCount: increment(1) });
        } catch { /* non-fatal */ }

        // ⭐ Write persistent previous student record
        await this.recordPreviousStudentStatus(studentId, courseId, courseName);

        // Send notification
        try {
          if (studentPhone && otpService?.sendEnrollmentNotification) {
            await otpService.sendEnrollmentNotification({
              phone: studentPhone,
              studentName,
              studentSurname: studentSurname || '',
              studentUserId: studentUserId || '',
              courseName,
              amountPaid: 0,
            });
          }
        } catch { /* non-fatal */ }

        return { success: true, enrollmentId: enrollmentRef.id, message: 'Successfully enrolled!' };
      }

      // ── PAID ENROLLMENT ───────────────────────────────────────────────────
      const { default: paymentService } = await import('./paymentService');
      const callbackBase = `${BACKEND_URL}/courses`;
      const paymentResponse = await paymentService.initiatePayment({
        amount: calculation.finalPrice,
        currency: 'BDT',
        productName: courseName,
        productId: courseId,
        userId: studentId,
        customerName: studentName,
        customerEmail: studentEmail || '',
        customerPhone: studentPhone || '',
        successUrl: `${callbackBase}?status=success`,
        failUrl: `${callbackBase}?status=failed`,
        cancelUrl: `${callbackBase}?status=cancelled`,
        metadata: {
          courseId,
          courseTitle: courseName,
          studentId,
          calculationSnapshot: JSON.stringify(sanitize(calculation)),
        },
      });

      if (!paymentResponse.success || !paymentResponse.gatewayUrl) {
        return { success: false, error: paymentResponse.error || 'Failed to initiate payment', userMessage: 'Payment initiation failed. Please try again.' };
      }

      return {
        success: true,
        transactionId: paymentResponse.transactionId,
        gatewayUrl: paymentResponse.gatewayUrl,
        message: 'Redirecting to payment gateway...',
      };
    } catch (error: any) {
      logError('enrollStudent', error, { courseId: request.courseId });
      return { success: false, error: error.message, userMessage: `Enrollment failed: ${error.message}` };
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // verifyPaymentAndGetEnrollment
  // After successful payment verification, also writes previous student record.
  // ─────────────────────────────────────────────────────────────────────────

  async verifyPaymentAndGetEnrollment(
    tranId: string,
    currentUserId: string
  ): Promise<EnrollmentVerificationResult> {
    const TAG = '[verifyPaymentAndGetEnrollment]';
    console.log(`${TAG} Starting`, { tranId, currentUserId });

    if (!tranId || !currentUserId) {
      return { verified: false, status: 'not_found', isReplay: false, message: 'Invalid payment reference. Please contact support.' };
    }

    try {
      const txnSnap = await getDocs(query(
        collection(db, COLLECTIONS.TRANSACTIONS),
        where('transactionId', '==', tranId)
      ));

      if (txnSnap.empty) {
        return { verified: false, status: 'not_found', isReplay: false, message: `Payment record not found. Contact support with ref: ${tranId}` };
      }

      const txnDoc = txnSnap.docs[0];
      const txn = txnDoc.data();

      if (txn.userId !== currentUserId) {
        return { verified: false, status: 'ownership_error', isReplay: false, message: 'This payment reference does not belong to your account.' };
      }

      const courseTitle: string = txn.productName || txn.metadata?.courseTitle || '';
      const courseId: string = txn.productId || txn.metadata?.courseId || '';

      let tokenConsumed = false;
      let tokenWasNull = false;

      try {
        await firestoreRunTransaction(db, async (t) => {
          const txnRef = doc(db, COLLECTIONS.TRANSACTIONS, txnDoc.id);
          const freshSnap = await t.get(txnRef);
          const freshData = freshSnap.data() || {};
          if (freshData.returnToken === null || freshData.returnToken === undefined) {
            tokenWasNull = true;
          } else {
            tokenConsumed = true;
            t.update(txnRef, { returnToken: null, returnTokenConsumedAt: Timestamp.now(), returnTokenConsumedBy: currentUserId });
          }
        });
      } catch (tokenErr: any) {
        console.warn(`${TAG} Token consumption failed (non-fatal):`, tokenErr.message);
        tokenWasNull = true;
      }

      const freshTxnSnap = await getDocs(query(collection(db, COLLECTIONS.TRANSACTIONS), where('transactionId', '==', tranId)));
      const freshTxn = freshTxnSnap.empty ? txn : freshTxnSnap.docs[0].data();

      if (freshTxn.status === 'failed' || freshTxn.status === 'cancelled') {
        return { verified: false, status: freshTxn.status, courseTitle, courseId, isReplay: false, message: `Payment was ${freshTxn.status}. Please try again or contact support.` };
      }
      if (freshTxn.status === 'validating') {
        return { verified: false, status: 'validating', courseTitle, courseId, isReplay: false, message: 'Your payment is under manual review. You will be enrolled once approved.' };
      }
      if (freshTxn.status !== 'success' && freshTxn.status !== 'pending') {
        return { verified: false, status: 'not_found', courseTitle, courseId, isReplay: false, message: `Unexpected payment status: ${freshTxn.status}. Contact support with ref: ${tranId}` };
      }

      const delays = [500, 800, 1200, 1500, 1500, 2000, 2000, 2500];

      for (let attempt = 0; attempt <= delays.length; attempt++) {
        if (attempt > 0) await sleep(delays[attempt - 1]);
        try {
          const byTxn = await getDocs(query(collection(db, COLLECTIONS.ENROLLMENTS), where('transactionId', '==', tranId)));
          if (!byTxn.empty) {
            const enrollDoc = byTxn.docs[0];
            // Write previous student record for paid enrollment
            await this.recordPreviousStudentStatus(currentUserId, courseId, courseTitle);
            return { verified: true, status: 'success', enrollmentId: enrollDoc.id, courseTitle, courseId, isReplay: false, message: `Payment verified! You are now enrolled in "${courseTitle || 'the course'}".` };
          }

          if (courseId) {
            const byCourse = await getDocs(query(
              collection(db, COLLECTIONS.ENROLLMENTS),
              where('studentId', '==', currentUserId),
              where('courseId', '==', courseId)
            ));
            if (!byCourse.empty) {
              const enrollDoc = byCourse.docs[0];
              const enrollData = enrollDoc.data();
              const isFromDifferentTxn = enrollData.transactionId && enrollData.transactionId !== tranId;
              const isDefiniteReplay = tokenWasNull && isFromDifferentTxn;
              if (!isDefiniteReplay) await this.recordPreviousStudentStatus(currentUserId, courseId, courseTitle);
              return {
                verified: true, status: 'success', enrollmentId: enrollDoc.id, courseTitle, courseId,
                isReplay: isDefiniteReplay,
                message: isDefiniteReplay
                  ? `You are already enrolled in "${courseTitle || 'this course'}".`
                  : `Payment verified! You are now enrolled in "${courseTitle || 'the course'}".`,
              };
            }
          }
        } catch (pollErr: any) {
          console.warn(`${TAG} Poll error:`, pollErr.message);
        }
      }

      return { verified: false, status: 'pending', courseTitle, courseId, isReplay: false, message: 'Payment confirmed! Your enrollment is being activated. Please refresh in a moment.' };
    } catch (err: any) {
      logError('verifyPaymentAndGetEnrollment', err);
      return { verified: false, status: 'not_found', isReplay: false, message: `An unexpected error occurred. Contact support with ref: ${tranId}` };
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Utility methods (all original, unchanged)
  // ─────────────────────────────────────────────────────────────────────────

  async getStudentEnrolledCourseIds(studentId: string): Promise<Set<string>> {
    if (!studentId) return new Set();
    try {
      const snap = await getDocs(query(collection(db, COLLECTIONS.ENROLLMENTS), where('studentId', '==', studentId)));
      const ids = new Set<string>();
      snap.docs.forEach(d => { const cid = d.data().courseId; if (cid) ids.add(cid); });
      return ids;
    } catch (err: any) {
      logError('getStudentEnrolledCourseIds', err);
      return new Set();
    }
  },

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
      logError('isAlreadyEnrolled', err);
      return false;
    }
  },
};

export default courseEnrollmentService;
