// src/services/courseEnrollmentService.ts

import {
  collection,
  doc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  runTransaction as firestoreRunTransaction,
  Timestamp,
  addDoc,
  setDoc
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

  // validity = ISO date string — the date until which the course is visible/accessible
  validity?: string;
  // visibilityDate = ISO date string — earliest date the course appears to students
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
  studentPhone?: string;    // For enrollment SMS notification
  studentSurname?: string;  // For enrollment SMS notification
  studentUserId?: string;   // Formatted Student ID (e.g. ST-2601-00001) for SMS
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
  STUDENT_FLAGS: 'studentFlags', // stores isPreviousStudent flag per student
} as const;

const BACKEND_URL = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

// ==================== HELPERS ====================

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Safely convert Firestore Timestamp to Date.
 * Handles: Timestamp objects, plain objects with seconds, Date objects, undefined.
 */
function toDate(value: any): Date {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  if (typeof value.toDate === 'function') return value.toDate();
  if (value.seconds !== undefined) return new Date(value.seconds * 1000);
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}

/**
 * Remove undefined values from objects (Firestore compatibility).
 */
function sanitize(obj: any): any {
  if (obj === null || obj === undefined) return null;
  if (Array.isArray(obj)) return obj.filter(v => v !== undefined).map(sanitize);
  if (typeof obj === 'object') {
    const clean: any = {};
    for (const key in obj) {
      if (obj[key] !== undefined) {
        clean[key] = sanitize(obj[key]);
      }
    }
    return clean;
  }
  return obj;
}

function logError(operation: string, error: any, context?: any): void {
  console.error('');
  console.error('🚨 COURSE ENROLLMENT SERVICE ERROR 🚨');
  console.error('═'.repeat(80));
  console.error('Operation:', operation);
  console.error('Error:', error.message || error);
  if (error.stack) console.error('Stack:', error.stack);
  if (context) console.error('Context:', JSON.stringify(context, null, 2));
  console.error('Timestamp:', new Date().toISOString());
  console.error('═'.repeat(80));
  console.error('');
}

/**
 * Returns true when a course is currently visible to students.
 * Rules:
 *  - isPublished must be true
 *  - visibilityDate (if set) must be <= now  (course has started appearing)
 *  - validity      (if set) must be >= now  (course has not expired)
 */
function isCourseVisibleNow(data: any): boolean {
  const now = new Date();

  // visibilityDate: course shouldn't appear yet
  if (data.visibilityDate) {
    const visDate = new Date(data.visibilityDate);
    if (!isNaN(visDate.getTime()) && visDate > now) {
      return false;
    }
  }

  // validity: course has expired — remove from enrollment list
  if (data.validity) {
    const validUntil = new Date(data.validity);
    if (!isNaN(validUntil.getTime()) && validUntil < now) {
      return false;
    }
  }

  return true;
}

// ==================== STUDENT FLAG HELPERS ====================

/**
 * Check if a student is flagged as a "previous student" in Firestore.
 * This flag persists even after courses are deleted/expired.
 * Fails silently — never throws.
 */
async function getStudentPreviousFlag(studentId: string): Promise<boolean> {
  try {
    const snap = await getDoc(doc(db, COLLECTIONS.STUDENT_FLAGS, studentId));
    if (!snap.exists()) return false;
    return snap.data()?.isPreviousStudent === true;
  } catch (e) {
    console.warn('Failed to read student flag (non-fatal):', e);
    return false;
  }
}

/**
 * Mark a student as a "previous student" in Firestore.
 * Called after successful enrollment. Fire-and-forget — never blocks enrollment.
 * Fails silently if Firestore rules deny access.
 */
async function markStudentAsPrevious(studentId: string): Promise<void> {
  try {
    await setDoc(
      doc(db, COLLECTIONS.STUDENT_FLAGS, studentId),
      { isPreviousStudent: true, markedAt: Timestamp.now() },
      { merge: true }
    );
  } catch (e) {
    console.warn('Failed to mark student as previous (non-fatal):', e);
  }
}

// ==================== COURSE ENROLLMENT SERVICE ====================

export const courseEnrollmentService = {

  // ─────────────────────────────────────────────────────────────────────────
  // getPublishedCourses
  //
  // Returns only published courses that are currently visible:
  //   • not yet expired (validity >= today, or no validity set)
  //   • already past their visibility start (visibilityDate <= today, or not set)
  // Uses spread operator to capture ALL Firestore fields automatically.
  // ─────────────────────────────────────────────────────────────────────────

  async getPublishedCourses(): Promise<Course[]> {
    try {
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
      } catch (indexError) {
        console.warn('⚠️ Firestore index missing, filtering locally');
        const snap = await getDocs(coursesCollection);
        rawCourses = snap.docs
          .map(d => ({ _id: d.id, ...d.data() }))
          .filter(d => d.isPublished === true)
          .sort((a, b) => toDate(b.createdAt).getTime() - toDate(a.createdAt).getTime());
      }

      // Apply date-based visibility filtering
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

      const q = query(
        collection(db, COLLECTIONS.ENROLLMENTS),
        where('studentId', '==', studentId)
      );
      const snapshot = await getDocs(q);

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        enrolledAt: toDate(doc.data().enrolledAt),
        lastAccessedAt: toDate(doc.data().lastAccessedAt),
        paymentDate: doc.data().paymentDate ? toDate(doc.data().paymentDate) : undefined
      })) as Enrollment[];
    } catch (error: any) {
      logError('getStudentEnrollments', error, { studentId });
      throw new Error(error.message);
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // calculateEnrollmentPrice
  //
  // previousStudentDiscount and extraDiscount are stored in Firestore as
  // flat BDT AMOUNTS (set in CourseCreation as "Amount in BDT"), NOT percentages.
  //
  // hasPreviousEnrollments checks BOTH live enrollments AND the persistent
  // isPreviousStudent flag in studentFlags collection — so the discount
  // persists even after old courses are deleted/expired.
  // ─────────────────────────────────────────────────────────────────────────

  async calculateEnrollmentPrice(
    courseId: string,
    studentId: string,
    couponCodes: string[] = []
  ): Promise<EnrollmentCalculation> {
    try {

      const courseDoc = await getDoc(doc(db, COLLECTIONS.COURSES, courseId));
      if (!courseDoc.exists()) throw new Error('Course not found');

      const courseData = courseDoc.data();
      const basePrice = courseData.price || 0;

      // Check if student has previous enrollments (any course) OR is flagged as previous student.
      // The flag persists even after courses are deleted/expired.
      const [enrollmentsSnap, isPreviousFlagged] = await Promise.all([
        getDocs(query(
          collection(db, COLLECTIONS.ENROLLMENTS),
          where('studentId', '==', studentId)
        )),
        getStudentPreviousFlag(studentId),
      ]);
      const hasPreviousEnrollments = !enrollmentsSnap.empty || isPreviousFlagged;

      // ── Previous student discount ─────────────────────────────────────────
      // Stored as flat BDT amount. Only applied if student has prior enrollment.
      const rawPrevDiscount = courseData.previousStudentDiscount || 0;
      const previousStudentDiscount = hasPreviousEnrollments && rawPrevDiscount > 0
        ? Math.min(rawPrevDiscount, basePrice) // cap at basePrice
        : 0;

      // ── Extra (time-limited) discount ─────────────────────────────────────
      // Stored as flat BDT amount. Applied only if extraDiscountValidUntil > now.
      let extraDiscount = 0;
      let isExtraDiscountValid = false;
      if (courseData.extraDiscount && courseData.extraDiscount > 0 && courseData.extraDiscountValidUntil) {
        const validUntil = new Date(courseData.extraDiscountValidUntil);
        if (!isNaN(validUntil.getTime()) && validUntil > new Date()) {
          extraDiscount = Math.min(courseData.extraDiscount, basePrice);
          isExtraDiscountValid = true;
        }
      }

      // ── Coupon codes ──────────────────────────────────────────────────────
      let couponDiscount = 0;
      const appliedCoupons: AppliedCoupon[] = [];
      let couponError: string | undefined;

      if (couponCodes.length > 0) {
        // Fetch student's already-enrolled course IDs for nextPurchaseEligibility checks
        let enrolledCourseIds: string[] = [];
        try {
          const enrolledSnap = await getDocs(query(
            collection(db, COLLECTIONS.ENROLLMENTS),
            where('studentId', '==', studentId)
          ));
          enrolledCourseIds = enrolledSnap.docs.map(d => d.data().courseId).filter(Boolean);
        } catch (e) {
          console.warn('Could not fetch enrolled courses for coupon validation (non-fatal)');
        }

        for (const code of couponCodes) {
          const upper = code.trim().toUpperCase();
          if (!upper) continue;

          // Skip if already applied (duplicate guard)
          if (appliedCoupons.some(c => c.couponCode === upper)) {
            couponError = `Coupon "${upper}" is already applied.`;
            continue;
          }

          try {
            // Price after all discounts applied so far (including earlier coupons in this loop)
            const priceForValidation = Math.max(0, basePrice - previousStudentDiscount - extraDiscount - couponDiscount);

            const result = await couponService.validateCoupon(
              upper,
              studentId,
              courseId,
              priceForValidation,
              enrolledCourseIds
            );

            if (!result.valid) {
              couponError = result.reason || `Coupon "${upper}" is not valid.`;
              continue;
            }

            const discount = result.discount ?? 0;
            couponDiscount += discount;
            appliedCoupons.push({
              couponId: '', // back-filled below
              couponCode: upper,
              discount,
              successMessage: result.successMessage || `Coupon "${upper}" applied! ৳${discount} off.`,
            });
            couponError = undefined;
          } catch (err: any) {
            console.error('Error validating coupon:', upper, err);
            couponError = `Error validating coupon "${upper}". Please try again.`;
          }
        }

        // Back-fill coupon doc IDs for recordCouponUsage later
        if (appliedCoupons.length > 0) {
          try {
            for (const ac of appliedCoupons) {
              if (ac.couponId) continue;
              const snap = await getDocs(query(
                collection(db, COLLECTIONS.COUPONS),
                where('couponCode', '==', ac.couponCode)
              ));
              if (!snap.empty) ac.couponId = snap.docs[0].id;
            }
          } catch (e) {
            console.warn('Could not back-fill coupon IDs (non-fatal):', e);
          }
        }
      }

      const totalDiscount = previousStudentDiscount + extraDiscount + couponDiscount;
      const finalPrice = Math.max(0, basePrice - totalDiscount);

      const result: EnrollmentCalculation = {
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
        // Backward compat: expose first coupon
        couponId: appliedCoupons[0]?.couponId,
        couponCode: appliedCoupons[0]?.couponCode,
        couponSuccessMessage: appliedCoupons[0]?.successMessage,
      };

      return result;
    } catch (error: any) {
      logError('calculateEnrollmentPrice', error, { courseId, studentId });
      throw new Error(`Failed to calculate price: ${error.message}`);
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // enrollStudent
  //
  // Handles both free and paid enrollments.
  // FREE:  writes enrollment doc directly, fires SMS, marks student as previous.
  // PAID:  creates transaction record, calls /api/payment?action=initiate,
  //        returns gatewayUrl for redirect — exactly as old working version.
  // ─────────────────────────────────────────────────────────────────────────

  async enrollStudent(request: EnrollmentRequest): Promise<EnrollmentResponse> {
    try {
      const {
        courseId, studentId, studentName, studentEmail,
        studentPhone, studentSurname, studentUserId, calculation
      } = request;


      // Check already enrolled
      const existingSnap = await getDocs(query(
        collection(db, COLLECTIONS.ENROLLMENTS),
        where('studentId', '==', studentId),
        where('courseId', '==', courseId)
      ));
      if (!existingSnap.empty) {
        return { success: false, error: 'Already enrolled', userMessage: 'You are already enrolled in this course' };
      }

      // Get course info
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
          progress: 0,
          completedLessons: [],
          enrolledAt: Timestamp.now(),
          lastAccessedAt: Timestamp.now(),
          paymentStatus: 'completed',
          amountPaid: 0,
          paymentMethod: 'FREE',
          paymentDate: Timestamp.now(),
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

        // Mark student as previous student — fire-and-forget, never blocks enrollment
        markStudentAsPrevious(studentId);

        // Record coupon usage for statistics — fire-and-forget, never blocks enrollment
        if (calculation.appliedCoupons && calculation.appliedCoupons.length > 0) {
          for (const ac of calculation.appliedCoupons) {
            if (!ac.couponId) continue;
            couponService.recordCouponUsage({
              couponId: ac.couponId,
              userId: studentId,
              courseId,
              userName: studentName,
              courseName,
              discountApplied: ac.discount,
              amountPaid: 0,
            }).catch(err => console.error('Failed to record coupon usage (non-fatal):', err));
          }
        }

        // Increment course student count — fire-and-forget
        try {
          const { updateDoc, increment } = await import('firebase/firestore');
          await updateDoc(doc(db, COLLECTIONS.COURSES, courseId), {
            studentCount: increment(1)
          });
        } catch (e) {
          console.warn('Failed to increment studentCount (non-fatal):', e);
        }

        // Send enrollment confirmation SMS — fire-and-forget, never blocks enrollment
        if (studentPhone) {
          // Try new notification method first, fall back to old SMS method
          if (otpService?.sendEnrollmentNotification) {
            otpService.sendEnrollmentNotification({
              phone: studentPhone,
              studentName,
              studentSurname: studentSurname || '',
              studentUserId: studentUserId || '',
              courseName,
              amountPaid: 0,
            }).catch(err => console.error('Enrollment notification error (non-fatal):', err));
          } else if (otpService?.sendEnrollmentSuccessSMS) {
            otpService.sendEnrollmentSuccessSMS(
              studentPhone,
              studentSurname || studentName.split(' ')[0],
              studentUserId || studentId,
              courseName,
            ).catch(err => console.error('Enrollment SMS error (non-fatal):', err));
          }
        }

        return {
          success: true,
          enrollmentId: enrollmentRef.id,
          message: `Successfully enrolled in ${courseName}!`,
          userMessage: `Successfully enrolled in ${courseName}!`,
        };
      }

      // ── PAID ENROLLMENT — initiate payment gateway ────────────────────────

      const transactionId = `TXN_${courseId.substring(0, 5).toUpperCase()}_${studentId.substring(0, 12).toUpperCase()}_${Date.now()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

      // Create transaction record in Firestore BEFORE calling payment API
      const transactionData = sanitize({
        userId: studentId,
        userName: studentName,
        userEmail: studentEmail || `${studentId}@noemail.local`,
        amount: calculation.finalPrice,
        currency: 'BDT',
        status: 'pending',
        gateway: 'SSLCOMMERZ',
        productName: courseName,
        productId: courseId,
        productType: 'course',
        transactionId,
        appliedDiscounts: {
          previousStudentDiscount: calculation.previousStudentDiscount,
          extraDiscount: calculation.extraDiscount,
          couponDiscount: calculation.couponDiscount,
        },
        metadata: {
          studentName,
          studentEmail: studentEmail || '',
          studentPhone: studentPhone || '',
          studentSurname: studentSurname || '',
          studentUserId: studentUserId || '',
          courseName,
          courseId,
          finalPrice: calculation.finalPrice,
          basePrice: calculation.basePrice,
          isPreviousStudent: calculation.hasPreviousEnrollments,
          appliedCoupons: JSON.stringify(calculation.appliedCoupons),
        },
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

      await addDoc(collection(db, COLLECTIONS.TRANSACTIONS), transactionData);

      // Call payment API — same approach as working old version
      const response = await fetch(`${BACKEND_URL}/api/payment?action=initiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionId,
          userId: studentId,
          userName: studentName,
          userEmail: studentEmail,
          amount: calculation.finalPrice,
          productId: courseId,
          productName: courseName,
          productType: 'course',
        }),
      });

      if (!response.ok) {
        throw new Error(`Payment API returned ${response.status}`);
      }

      const paymentResult = await response.json();

      if (paymentResult.success && paymentResult.gatewayUrl) {
        return {
          success: true,
          gatewayUrl: paymentResult.gatewayUrl,
          transactionId,
        };
      } else {
        throw new Error(paymentResult.error || 'Failed to initiate payment');
      }

    } catch (error: any) {
      logError('enrollStudent', error, { courseId: request.courseId, studentId: request.studentId });
      return {
        success: false,
        error: error.message,
        userMessage: 'Failed to process enrollment. Please try again.',
      };
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // verifyPaymentAndGetEnrollment
  //
  // Payment verification with one-time token consumption.
  // Marks student as previous after successful paid enrollment.
  // ─────────────────────────────────────────────────────────────────────────

  async verifyPaymentAndGetEnrollment(
    tranId: string,
    currentUserId: string
  ): Promise<EnrollmentVerificationResult> {
    const TAG = '[verifyPaymentAndGetEnrollment]';

    if (!tranId || !currentUserId) {
      return {
        verified: false,
        status: 'not_found',
        isReplay: false,
        message: 'Invalid payment reference. Please contact support.',
      };
    }

    try {
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

      if (txn.userId !== currentUserId) {
        console.error(`${TAG} SECURITY: Ownership mismatch`);
        return {
          verified: false,
          status: 'ownership_error',
          isReplay: false,
          message: 'This payment reference does not belong to your account.',
        };
      }

      const courseTitle: string = txn.productName || txn.metadata?.courseTitle || '';
      const courseId: string = txn.productId || txn.metadata?.courseId || '';

      // ── One-time token consumption ────────────────────────────────────────
      // PURPOSE: Prevent URL replay attacks (user opening callback URL in new tab).
      //
      // Three cases:
      //   (A) tokenConsumed = false → token present, we consume it → legitimate first visit
      //   (B) tokenConsumed = true  → token already null → could be server-side consumed or replay
      //   (C) tokenMissing  = true  → token was never written (IPN/callback timing race)
      //       → treat as legitimate (enrollment by transactionId will confirm)
      //
      // We use isDefiniteReplay only when token was null AND enrollment was already
      // found by a DIFFERENT transaction (proving prior enrollment exists independently).

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
            t.update(txnRef, {
              returnToken: null,
              returnTokenConsumedAt: Timestamp.now(),
              returnTokenConsumedBy: currentUserId,
            });
          }
        });
      } catch (tokenErr: any) {
        console.warn(`${TAG} Token consumption failed (non-fatal):`, tokenErr.message);
        tokenWasNull = true;
      }


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
          isReplay: false,
          message: `Payment was ${freshTxn.status}. Please try again or contact support.`,
        };
      }

      if (freshTxn.status === 'validating') {
        return {
          verified: false,
          status: 'validating',
          courseTitle,
          courseId,
          isReplay: false,
          message: 'Your payment is under manual review. You will be enrolled once approved. Kindly contact support for confirmation.',
        };
      }

      if (freshTxn.status !== 'success' && freshTxn.status !== 'pending') {
        return {
          verified: false,
          status: 'not_found',
          courseTitle,
          courseId,
          isReplay: false,
          message: `Unexpected payment status: ${freshTxn.status}. Contact support with ref: ${tranId}`,
        };
      }

      const delays = [500, 800, 1200, 1500, 1500, 2000, 2000, 2500];

      for (let attempt = 0; attempt <= delays.length; attempt++) {
        if (attempt > 0) {
          await sleep(delays[attempt - 1]);
        }

        try {
          // PRIMARY: find enrollment by this exact transactionId
          // If found → always SUCCESS (this payment created this enrollment)
          const byTxn = await getDocs(query(
            collection(db, COLLECTIONS.ENROLLMENTS),
            where('transactionId', '==', tranId)
          ));

          if (!byTxn.empty) {
            const enrollDoc = byTxn.docs[0];
            // Mark student as previous after successful paid enrollment — fire-and-forget
            markStudentAsPrevious(currentUserId);
            return {
              verified: true,
              status: 'success',
              enrollmentId: enrollDoc.id,
              courseTitle,
              courseId,
              isReplay: false, // Found by THIS transaction → always fresh success
              message: `Payment verified! You are now enrolled in ${courseTitle || 'the course'}.`,
            };
          }

          // FALLBACK: find by studentId+courseId
          // Only treat as "replay" if token was null AND enrollment belongs to different transaction.
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

              // Mark student as previous — fire-and-forget
              markStudentAsPrevious(currentUserId);
              return {
                verified: true,
                status: 'success',
                enrollmentId: enrollDoc.id,
                courseTitle,
                courseId,
                isReplay: isDefiniteReplay,
                message: isDefiniteReplay
                  ? `You are already enrolled in ${courseTitle || 'this course'}.`
                  : `Payment verified! You are now enrolled in ${courseTitle || 'the course'}.`,
              };
            }
          }
        } catch (pollErr: any) {
          console.warn(`${TAG} Poll error:`, pollErr.message);
        }
      }

      console.warn(`${TAG} Enrollment not found after retries`);
      return {
        verified: false,
        status: 'pending',
        courseTitle,
        courseId,
        isReplay: false,
        message: 'Payment confirmed! Your enrollment is being activated. Please refresh in a moment.',
      };

    } catch (err: any) {
      logError('verifyPaymentAndGetEnrollment', err);
      return {
        verified: false,
        status: 'not_found',
        isReplay: false,
        message: `An unexpected error occurred. Contact support with ref: ${tranId}`,
      };
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Utility methods
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
