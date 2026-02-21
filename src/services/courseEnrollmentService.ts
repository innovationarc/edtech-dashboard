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
  addDoc
} from 'firebase/firestore';
import { db } from '../config/firebase';

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
  
  validity?: string;
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

interface Coupon {
  id: string;
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  minPurchase?: number;
  maxDiscount?: number;
  usageLimit?: number;
  usageCount?: number;
  expiresAt?: any;
  isActive: boolean;
  applicableTo?: string[];
  excludedCourses?: string[];
  successMessage?: string;
}

// ==================== CONSTANTS ====================

const COLLECTIONS = {
  TRANSACTIONS: 'transactions',
  ENROLLMENTS: 'enrollments',
  COURSES: 'courses',
  COUPONS: 'coupons',
  COUPON_USAGE: 'couponUsage',
} as const;

const BACKEND_URL = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

// ==================== HELPERS ====================

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Safely convert Firestore Timestamp to Date
 * Handles: Timestamp objects, plain objects with seconds, Date objects, undefined
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
 * Remove undefined values from objects (Firestore compatibility)
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
  if (error.stack) {
    console.error('Stack:', error.stack);
  }
  if (context) {
    console.error('Context:', JSON.stringify(context, null, 2));
  }
  console.error('Timestamp:', new Date().toISOString());
  console.error('═'.repeat(80));
  console.error('');
}

// ==================== COURSE ENROLLMENT SERVICE ====================

export const courseEnrollmentService = {

  // ─────────────────────────────────────────────────────────────────────────
  // getPublishedCourses
  //
  // EXACT COPY of working old courseService implementation
  // Uses spread operator to capture ALL fields automatically
  // ─────────────────────────────────────────────────────────────────────────

  async getPublishedCourses(): Promise<Course[]> {
    try {
      console.log('📚 Getting published courses...');
      const coursesCollection = collection(db, COLLECTIONS.COURSES);
      
      // Try indexed query first
      try {
        const q = query(
          coursesCollection, 
          where('isPublished', '==', true),
          orderBy('createdAt', 'desc')
        );
        const coursesSnapshot = await getDocs(q);
        
        if (coursesSnapshot.docs.length > 0) {
          const courses = coursesSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(), // SPREAD ALL FIELDS - this is the key!
            class: doc.data().class || '',
            subjects: doc.data().subjects || [],
            contentStructure: doc.data().contentStructure || [],
            routineFiles: doc.data().routineFiles || [],
            hasAiQnA: doc.data().hasAiQnA || false,
            hasHumanQnA: doc.data().hasHumanQnA || false,
            hasStudyPlanner: doc.data().hasStudyPlanner || false,
            hasQnA: doc.data().hasQnA || false,
            createdAt: toDate(doc.data().createdAt),
            updatedAt: toDate(doc.data().updatedAt)
          })) as Course[];

          console.log('✅ Retrieved published courses:', courses.length);
          return courses;
        }
      } catch (indexError) {
        console.warn('⚠️ Firestore index missing, filtering locally');
      }
      
      // Fallback: load all and filter
      const allCoursesSnapshot = await getDocs(coursesCollection);
      const allCourses = allCoursesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(), // SPREAD ALL FIELDS
        class: doc.data().class || '',
        subjects: doc.data().subjects || [],
        contentStructure: doc.data().contentStructure || [],
        routineFiles: doc.data().routineFiles || [],
        hasAiQnA: doc.data().hasAiQnA || false,
        hasHumanQnA: doc.data().hasHumanQnA || false,
        hasStudyPlanner: doc.data().hasStudyPlanner || false,
        hasQnA: doc.data().hasQnA || false,
        createdAt: toDate(doc.data().createdAt),
        updatedAt: toDate(doc.data().updatedAt)
      })) as Course[];
      
      const published = allCourses
        .filter(c => c.isPublished)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      
      console.log('✅ Filtered published courses:', published.length);
      return published;
    } catch (error: any) {
      logError('getPublishedCourses', error);
      throw new Error(error.message);
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // getStudentEnrollments
  //
  // EXACT COPY of working old courseService implementation
  // ─────────────────────────────────────────────────────────────────────────

  async getStudentEnrollments(studentId: string): Promise<Enrollment[]> {
    try {
      if (!studentId?.trim()) {
        return [];
      }

      const q = query(
        collection(db, COLLECTIONS.ENROLLMENTS), 
        where('studentId', '==', studentId)
      );
      const snapshot = await getDocs(q);
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(), // SPREAD ALL FIELDS
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
  // Full price calculation with discounts and coupons
  // ─────────────────────────────────────────────────────────────────────────

  async calculateEnrollmentPrice(
    courseId: string,
    studentId: string,
    couponCodes: string[] = []
  ): Promise<EnrollmentCalculation> {
    try {
      console.log('💰 Calculating enrollment price:', { courseId, studentId, couponCodes });

      // Get course
      const courseDoc = await getDoc(doc(db, COLLECTIONS.COURSES, courseId));
      if (!courseDoc.exists()) {
        throw new Error('Course not found');
      }

      const courseData = courseDoc.data();
      const basePrice = courseData.price || 0;

      // Check if previous student
      const enrollmentsSnap = await getDocs(query(
        collection(db, COLLECTIONS.ENROLLMENTS),
        where('studentId', '==', studentId)
      ));
      const hasPreviousEnrollments = !enrollmentsSnap.empty;

      // Calculate automatic discounts
      const previousStudentDiscount = hasPreviousEnrollments && courseData.previousStudentDiscount
        ? Math.floor(basePrice * (courseData.previousStudentDiscount / 100))
        : 0;

      let extraDiscount = 0;
      let isExtraDiscountValid = false;
      if (courseData.extraDiscount && courseData.extraDiscountValidUntil) {
        const validUntil = new Date(courseData.extraDiscountValidUntil);
        if (validUntil > new Date()) {
          extraDiscount = Math.floor(basePrice * (courseData.extraDiscount / 100));
          isExtraDiscountValid = true;
        }
      }

      // Process coupons
      let couponDiscount = 0;
      const appliedCoupons: AppliedCoupon[] = [];
      let couponError: string | undefined;

      if (couponCodes.length > 0) {
        for (const code of couponCodes) {
          const upper = code.trim().toUpperCase();
          if (!upper) continue;

          try {
            const couponSnap = await getDocs(query(
              collection(db, COLLECTIONS.COUPONS),
              where('code', '==', upper)
            ));

            if (couponSnap.empty) {
              couponError = `Coupon "${upper}" not found`;
              continue;
            }

            const couponDoc = couponSnap.docs[0];
            const coupon = couponDoc.data() as Coupon;

            // Validate coupon
            if (!coupon.isActive) {
              couponError = `Coupon "${upper}" is not active`;
              continue;
            }

            if (coupon.expiresAt) {
              const expiryDate = toDate(coupon.expiresAt);
              if (expiryDate < new Date()) {
                couponError = `Coupon "${upper}" has expired`;
                continue;
              }
            }

            if (coupon.usageLimit !== undefined && coupon.usageCount !== undefined) {
              if (coupon.usageCount >= coupon.usageLimit) {
                couponError = `Coupon "${upper}" usage limit reached`;
                continue;
              }
            }

            if (coupon.excludedCourses?.includes(courseId)) {
              couponError = `Coupon "${upper}" cannot be used for this course`;
              continue;
            }

            if (coupon.applicableTo && coupon.applicableTo.length > 0) {
              if (!coupon.applicableTo.includes(courseId)) {
                couponError = `Coupon "${upper}" is not applicable to this course`;
                continue;
              }
            }

            const priceAfterOtherDiscounts = basePrice - previousStudentDiscount - extraDiscount - couponDiscount;
            
            if (coupon.minPurchase && priceAfterOtherDiscounts < coupon.minPurchase) {
              couponError = `Minimum purchase of ৳${coupon.minPurchase} required for "${upper}"`;
              continue;
            }

            // Calculate coupon discount
            let discount = 0;
            if (coupon.type === 'percentage') {
              discount = Math.floor(priceAfterOtherDiscounts * (coupon.value / 100));
            } else {
              discount = coupon.value;
            }

            if (coupon.maxDiscount && discount > coupon.maxDiscount) {
              discount = coupon.maxDiscount;
            }

            couponDiscount += discount;
            appliedCoupons.push({
              couponId: couponDoc.id,
              couponCode: upper,
              discount,
              successMessage: coupon.successMessage || `Coupon "${upper}" applied!`,
            });

            couponError = undefined;

          } catch (err: any) {
            console.error('Error validating coupon:', upper, err);
            couponError = `Error validating coupon "${upper}"`;
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

      console.log('✅ Price calculated:', result);
      return result;

    } catch (error: any) {
      logError('calculateEnrollmentPrice', error, { courseId, studentId });
      throw new Error(`Failed to calculate price: ${error.message}`);
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // enrollStudent
  //
  // Handles both free and paid enrollments
  // ─────────────────────────────────────────────────────────────────────────

  async enrollStudent(request: EnrollmentRequest): Promise<EnrollmentResponse> {
    try {
      const { courseId, studentId, studentName, studentEmail, calculation } = request;

      console.log('📝 Processing enrollment:', { courseId, studentId, finalPrice: calculation.finalPrice });

      // Check if already enrolled
      const existingSnap = await getDocs(query(
        collection(db, COLLECTIONS.ENROLLMENTS),
        where('studentId', '==', studentId),
        where('courseId', '==', courseId)
      ));

      if (!existingSnap.empty) {
        return {
          success: false,
          error: 'Already enrolled',
          userMessage: 'You are already enrolled in this course',
        };
      }

      // Get course info
      const courseDoc = await getDoc(doc(db, COLLECTIONS.COURSES, courseId));
      if (!courseDoc.exists()) {
        return {
          success: false,
          error: 'Course not found',
          userMessage: 'Course not found',
        };
      }

      const courseData = courseDoc.data();
      const courseName = courseData.title || 'Course';

      // FREE ENROLLMENT
      if (calculation.finalPrice === 0) {
        console.log('✅ Processing free enrollment');

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
            appliedCoupons: calculation.appliedCoupons,
          },
        });

        const enrollmentRef = await addDoc(collection(db, COLLECTIONS.ENROLLMENTS), enrollmentData);

        console.log('✅ Free enrollment created:', enrollmentRef.id);

        return {
          success: true,
          enrollmentId: enrollmentRef.id,
          message: `Successfully enrolled in ${courseName}!`,
          userMessage: `Successfully enrolled in ${courseName}!`,
        };
      }

      // PAID ENROLLMENT
      console.log('💳 Initiating payment for ৳', calculation.finalPrice);

      const transactionId = `TXN_${courseId.substring(0, 5).toUpperCase()}_${studentId.substring(0, 12).toUpperCase()}_${Date.now()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

      // Create transaction record
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

      // Call payment API
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
        console.log('✅ Payment initiated:', transactionId);
        return {
          success: true,
          gatewayUrl: paymentResult.gatewayUrl,
          transactionId,
        };
      } else {
        throw new Error(paymentResult.error || 'Failed to initiate payment');
      }

    } catch (error: any) {
      logError('enrollStudent', error);
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
  // Payment verification with one-time token consumption
  // ─────────────────────────────────────────────────────────────────────────

  async verifyPaymentAndGetEnrollment(
    tranId: string,
    currentUserId: string
  ): Promise<EnrollmentVerificationResult> {
    const TAG = '[verifyPaymentAndGetEnrollment]';
    console.log(`${TAG} Starting`, { tranId, currentUserId });

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
      // FIX: We distinguish three cases:
      //   (A) tokenConsumed = false  → token present, we consume it → legitimate first visit
      //   (B) tokenConsumed = true   → token already null → could be:
      //       - Server-side replay prevention already consumed it (still legitimate)
      //       - A real replay (user opened URL twice)
      //   (C) tokenMissing = true    → token was never written (IPN/callback timing race)
      //       → treat as legitimate (enrollment by transactionId will confirm)
      //
      // We use `isDefiniteReplay` only when token was null AND enrollment was already
      // found by a DIFFERENT transaction (proving prior enrollment exists independently).
      // Finding enrollment by THIS transactionId always means success — never "already enrolled".

      let tokenConsumed = false; // token was present and we consumed it (fresh visit)
      let tokenWasNull = false;  // token was already null before we tried

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

      console.log(`${TAG} Token state: tokenConsumed=${tokenConsumed} tokenWasNull=${tokenWasNull}`);

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
          message: 'Your payment is under manual review. You will be enrolled once approved.',
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
            console.log(`${TAG} Enrollment found by transactionId on attempt ${attempt + 1}`);
            return {
              verified: true,
              status: 'success',
              enrollmentId: enrollDoc.id,
              courseTitle,
              courseId,
              isReplay: false, // Found by THIS transaction → always fresh success
              message: `Payment verified! You are now enrolled in "${courseTitle || 'the course'}".`,
            };
          }

          // FALLBACK: find by studentId+courseId
          // Only show "already enrolled" if token was null (possible replay)
          // AND there's no enrollment linked to this exact transaction.
          if (courseId) {
            const byCourse = await getDocs(query(
              collection(db, COLLECTIONS.ENROLLMENTS),
              where('studentId', '==', currentUserId),
              where('courseId', '==', courseId)
            ));
            
            if (!byCourse.empty) {
              const enrollDoc = byCourse.docs[0];
              const enrollData = enrollDoc.data();
              console.log(`${TAG} Enrollment found by courseId on attempt ${attempt + 1}, enrollTxnId=${enrollData.transactionId}`);

              // Determine if this is a true replay:
              // - Token was null (already consumed or never written)
              // - AND the enrollment belongs to a DIFFERENT transaction
              //   (meaning enrollment pre-existed this payment)
              const isFromDifferentTxn = enrollData.transactionId && enrollData.transactionId !== tranId;
              const isDefiniteReplay = tokenWasNull && isFromDifferentTxn;

              return {
                verified: true,
                status: 'success',
                enrollmentId: enrollDoc.id,
                courseTitle,
                courseId,
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
