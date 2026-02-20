// src/services/courseEnrollmentService.ts
//
// COMPLETE STANDALONE Course Enrollment Service
// ZERO DEPENDENCY on courseService.ts
//
// Features:
// ✅ Payment verification & enrollment retrieval
// ✅ Loading courses with enrollment status
// ✅ Enrollment price calculation with discounts
// ✅ Coupon validation and application
// ✅ Payment initiation (free & paid enrollments)
// ✅ All enrollment-related operations

import {
  collection,
  doc,
  getDocs,
  getDoc,
  query,
  where,
  runTransaction as firestoreRunTransaction,
  Timestamp,
  addDoc
} from 'firebase/firestore';
import { db } from '../config/firebase';

// ==================== INTERFACES ====================

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
  reviewCount: number;
  studentCount: number;
  tags: string[];
  status: string;
  createdAt: Date;
  isPublished?: boolean;
  // Enrollment-specific fields
  isEnrolled?: boolean;
  progress?: number;
  enrollmentId?: string;
  enrolledAt?: Date;
}

export interface AppliedCoupon {
  couponId: string;
  couponCode: string;
  discount: number;
  discountType?: 'percentage' | 'fixed';
  successMessage?: string;
}

export interface EnrollmentCalculation {
  courseId: string;
  basePrice: number;
  isPreviousStudent: boolean;
  previousStudentDiscount: number;
  extraDiscount: number;
  couponDiscount: number;
  totalDiscount: number;
  finalPrice: number;
  appliedCoupons: AppliedCoupon[];
  couponError?: string;
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
  gatewayUrl?: string;
  transactionId?: string;
  enrollmentId?: string;
  error?: string;
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

export interface EnrolledCourseInfo {
  id: string;
  courseId: string;
  enrollmentId: string;
  progress: number;
  enrolledAt: Date;
  transactionId?: string;
  completedLessons?: string[];
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

// Previous student discount: 10%
const PREVIOUS_STUDENT_DISCOUNT_RATE = 0.10;

// Extra discount for all students: 5%
const EXTRA_DISCOUNT_RATE = 0.05;

// ==================== HELPERS ====================

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Safely convert Firestore Timestamp to Date
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

// ==================== COURSE ENROLLMENT SERVICE ====================

export const courseEnrollmentService = {

  // ─────────────────────────────────────────────────────────────────────────
  // verifyPaymentAndGetEnrollment
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
        console.warn(`${TAG} Token consumption failed:`, tokenErr.message);
        isReplay = true;
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
            console.log(`${TAG} Enrollment found on attempt ${attempt + 1}`);
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
              console.log(`${TAG} Enrollment found by course on attempt ${attempt + 1}`);
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
        isReplay,
        message: 'Payment confirmed! Your enrollment is being activated. Please refresh in a moment.',
      };

    } catch (err: any) {
      console.error(`${TAG} Error:`, err);
      return {
        verified: false,
        status: 'not_found',
        isReplay: false,
        message: `An unexpected error occurred. Contact support with ref: ${tranId}`,
      };
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // getStudentEnrollments
  // ─────────────────────────────────────────────────────────────────────────

  async getStudentEnrollments(studentId: string): Promise<EnrolledCourseInfo[]> {
    const TAG = '[getStudentEnrollments]';
    
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
          enrolledAt: toDate(data.enrolledAt),
          transactionId: data.transactionId,
          completedLessons: data.completedLessons || [],
        };
      });

      console.log(`${TAG} Found ${enrollments.length} enrollments`);
      return enrollments;

    } catch (err: any) {
      console.error(`${TAG} Error:`, err);
      return [];
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // getPublishedCourses
  //
  // IMPORTANT: Matches courseService.getPublishedCourses() exactly
  // - Primary: Query by isPublished === true with orderBy createdAt
  // - Fallback: If index missing, load all and filter locally
  // ─────────────────────────────────────────────────────────────────────────

  async getPublishedCourses(): Promise<Course[]> {
    const TAG = '[getPublishedCourses]';
    console.log(`${TAG} Loading published courses...`);
    
    try {
      const coursesCollection = collection(db, COLLECTIONS.COURSES);
      
      // Try indexed query first
      try {
        const q = query(
          coursesCollection,
          where('isPublished', '==', true),
          orderBy('createdAt', 'desc')
        );
        const snapshot = await getDocs(q);
        
        if (snapshot.docs.length > 0) {
          const courses = snapshot.docs.map(doc => {
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
              reviewCount: data.reviewCount || 0,
              studentCount: data.studentCount || 0,
              tags: data.tags || [],
              status: data.status || 'draft',
              createdAt: toDate(data.createdAt),
            };
          });

          console.log(`${TAG} ✅ Found ${courses.length} published courses (indexed query)`);
          return courses;
        }
      } catch (indexError) {
        console.warn(`${TAG} ⚠️ Firestore index missing, filtering locally`);
      }
      
      // Fallback: Load all and filter
      const allSnapshot = await getDocs(coursesCollection);
      const allCourses = allSnapshot.docs.map(doc => {
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
          reviewCount: data.reviewCount || 0,
          studentCount: data.studentCount || 0,
          tags: data.tags || [],
          status: data.status || 'draft',
          createdAt: toDate(data.createdAt),
          isPublished: data.isPublished || false,
        };
      });
      
      const published = allCourses
        .filter(c => c.isPublished)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      
      console.log(`${TAG} ✅ Found ${published.length} published courses (local filter)`);
      return published;

    } catch (err: any) {
      console.error(`${TAG} ❌ Error:`, err.message);
      console.error(`${TAG} Stack:`, err.stack);
      return [];
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // calculateEnrollmentPrice
  //
  // Calculates final price with all discounts and coupons
  // ─────────────────────────────────────────────────────────────────────────

  async calculateEnrollmentPrice(
    courseId: string,
    studentId: string,
    couponCodes: string[] = []
  ): Promise<EnrollmentCalculation> {
    const TAG = '[calculateEnrollmentPrice]';
    console.log(`${TAG} Calculating for course ${courseId}, student ${studentId}`);

    try {
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
      const isPreviousStudent = !enrollmentsSnap.empty;

      // Calculate discounts
      const previousStudentDiscount = isPreviousStudent ? Math.floor(basePrice * PREVIOUS_STUDENT_DISCOUNT_RATE) : 0;
      const extraDiscount = Math.floor(basePrice * EXTRA_DISCOUNT_RATE);

      let couponDiscount = 0;
      const appliedCoupons: AppliedCoupon[] = [];
      let couponError: string | undefined;

      // Process coupons
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

            // Check if applicable to this course
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

            // Check minimum purchase
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

            // Apply max discount cap
            if (coupon.maxDiscount && discount > coupon.maxDiscount) {
              discount = coupon.maxDiscount;
            }

            couponDiscount += discount;
            appliedCoupons.push({
              couponId: couponDoc.id,
              couponCode: upper,
              discount,
              discountType: coupon.type,
              successMessage: `Coupon "${upper}" applied!`,
            });

            couponError = undefined; // Success clears any previous error

          } catch (err: any) {
            console.error(`${TAG} Error validating coupon ${upper}:`, err);
            couponError = `Error validating coupon "${upper}"`;
          }
        }
      }

      const totalDiscount = previousStudentDiscount + extraDiscount + couponDiscount;
      const finalPrice = Math.max(0, basePrice - totalDiscount);

      const result: EnrollmentCalculation = {
        courseId,
        basePrice,
        isPreviousStudent,
        previousStudentDiscount,
        extraDiscount,
        couponDiscount,
        totalDiscount,
        finalPrice,
        appliedCoupons,
        couponError,
      };

      console.log(`${TAG} Calculation result:`, result);
      return result;

    } catch (err: any) {
      console.error(`${TAG} Error:`, err);
      throw new Error(`Failed to calculate price: ${err.message}`);
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // enrollStudent
  //
  // Handles both free and paid enrollments
  // ─────────────────────────────────────────────────────────────────────────

  async enrollStudent(request: EnrollmentRequest): Promise<EnrollmentResponse> {
    const TAG = '[enrollStudent]';
    console.log(`${TAG} Processing enrollment`, {
      courseId: request.courseId,
      studentId: request.studentId,
      finalPrice: request.calculation.finalPrice
    });

    try {
      const { courseId, studentId, studentName, studentEmail, calculation } = request;

      // Check if already enrolled
      const existingEnrollment = await getDocs(query(
        collection(db, COLLECTIONS.ENROLLMENTS),
        where('studentId', '==', studentId),
        where('courseId', '==', courseId)
      ));

      if (!existingEnrollment.empty) {
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
        console.log(`${TAG} Processing free enrollment`);

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

        console.log(`${TAG} ✅ Free enrollment created:`, enrollmentRef.id);

        return {
          success: true,
          enrollmentId: enrollmentRef.id,
          userMessage: `Successfully enrolled in ${courseName}!`,
        };
      }

      // PAID ENROLLMENT - Initiate payment
      console.log(`${TAG} Initiating payment for ৳${calculation.finalPrice}`);

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
          isPreviousStudent: calculation.isPreviousStudent,
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
        console.log(`${TAG} ✅ Payment initiated:`, transactionId);
        return {
          success: true,
          gatewayUrl: paymentResult.gatewayUrl,
          transactionId,
        };
      } else {
        throw new Error(paymentResult.error || 'Failed to initiate payment');
      }

    } catch (err: any) {
      console.error(`${TAG} Error:`, err);
      return {
        success: false,
        error: err.message,
        userMessage: 'Failed to process enrollment. Please try again.',
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
      console.error('[getStudentEnrolledCourseIds]', err);
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
      console.error('[isAlreadyEnrolled]', err);
      return false;
    }
  },
};

export default courseEnrollmentService;
