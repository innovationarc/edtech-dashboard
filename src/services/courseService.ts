// src/services/courseService.ts
// Course Service - Integrated with real CouponService validation & statistics recording
// SECURITY PATCH APPLIED: Updated initiatePaidEnrollment and completeEnrollmentAfterPayment

import { 
  collection, 
  doc, 
  getDocs, 
  getDoc,
  setDoc,
  updateDoc, 
  deleteDoc, 
  query, 
  where,
  orderBy,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../config/firebase';
import paymentService, { PaymentInitiationRequest } from './paymentService';
import couponService from './couponService';

console.log('📚 CourseService initialized');

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
    // Legacy single-coupon fields (kept for backward compatibility)
    couponCode?: string;
    couponId?: string;
    // Multi-coupon field (new)
    appliedCoupons?: AppliedCoupon[];
  };
}

// A single successfully-validated and applied coupon
export interface AppliedCoupon {
  couponId: string;
  couponCode: string;
  discount: number;           // actual ৳ amount saved by this coupon
  successMessage?: string;    // custom message from the Firestore coupon doc
}

export interface EnrollmentCalculation {
  basePrice: number;
  previousStudentDiscount: number;
  extraDiscount: number;
  // Multi-coupon: every accepted coupon and their combined discount
  appliedCoupons: AppliedCoupon[];
  couponDiscount: number;     // sum of all appliedCoupons[].discount
  totalDiscount: number;
  finalPrice: number;
  hasPreviousEnrollments: boolean;
  isExtraDiscountValid: boolean;
  // Backward-compat single-coupon surface (first coupon, or undefined)
  couponId?: string;
  couponCode?: string;
  couponSuccessMessage?: string;
  couponError?: string;
}

export interface EnrollmentRequest {
  courseId: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
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
}

// ==================== ERROR LOGGING HELPER ====================

function logError(operation: string, error: any, context?: any): void {
  console.error('');
  console.error('🚨 COURSE SERVICE ERROR 🚨');
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

// ==================== COURSE SERVICE ====================

export const courseService = {
  
  // ==================== FILE OPERATIONS ====================
  
  async uploadFile(file: File, path: string): Promise<{ url: string; fileName: string }> {
    try {
      console.log('📤 Uploading file:', file.name, 'to', path);
      const timestamp = Date.now();
      const fileName = `${timestamp}_${file.name}`;
      const storageRef = ref(storage, `${path}/${fileName}`);
      
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      
      console.log('✅ File uploaded:', fileName);
      return { url, fileName };
    } catch (error: any) {
      logError('uploadFile', error, { fileName: file.name, path });
      throw new Error(`Failed to upload file: ${error.message}`);
    }
  },

  async deleteFile(fileName: string, path: string): Promise<void> {
    try {
      console.log('🗑️ Deleting file:', fileName, 'from', path);
      const storageRef = ref(storage, `${path}/${fileName}`);
      await deleteObject(storageRef);
      console.log('✅ File deleted:', fileName);
    } catch (error: any) {
      console.warn('⚠️ File deletion warning:', error.message);
    }
  },

  // ==================== DURATION CALCULATIONS ====================
  
  calculateTotalDurationFromStructure(nodes: ContentNode[]): number {
    let totalMinutes = 0;

    const traverse = (node: ContentNode) => {
      if (node.type === 'content' && node.contentData?.duration) {
        totalMinutes += node.contentData.duration;
      }
      if (node.children && node.children.length > 0) {
        node.children.forEach(traverse);
      }
    };

    nodes.forEach(traverse);
    return totalMinutes;
  },

  calculateTotalDuration(lessons: CourseLesson[]): string {
    if (!lessons || lessons.length === 0) return '00:00';

    let totalMinutes = 0;

    lessons.forEach(lesson => {
      const duration = lesson.duration.toLowerCase();
      
      const hoursMatch = duration.match(/(\d+)\s*h/);
      if (hoursMatch) {
        totalMinutes += parseInt(hoursMatch[1]) * 60;
      }

      const minutesMatch = duration.match(/(\d+)\s*m/);
      if (minutesMatch) {
        totalMinutes += parseInt(minutesMatch[1]);
      }
    });

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  },

  // ==================== COURSE CRUD OPERATIONS ====================

  async createCourse(course: Omit<Course, 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      console.log('📝 Creating course:', course.id);

      if (!course.id || !course.id.trim()) {
        throw new Error('Course ID is required');
      }

      const existingCourse = await this.getCourseById(course.id);
      if (existingCourse) {
        throw new Error(`A course with ID "${course.id}" already exists.`);
      }

      let duration = '00:00';
      if (course.contentStructure && course.contentStructure.length > 0) {
        const totalMinutes = this.calculateTotalDurationFromStructure(course.contentStructure);
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        duration = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      } else if (course.lessons && course.lessons.length > 0) {
        duration = this.calculateTotalDuration(course.lessons);
      }

      const courseData: any = {
        ...course,
        duration,
        rating: course.rating || 0,
        reviewCount: course.reviewCount || 0,
        studentCount: course.studentCount || 0,
        hasAiQnA: course.hasAiQnA || false,
        hasHumanQnA: course.hasHumanQnA || false,
        hasStudyPlanner: course.hasStudyPlanner || false,
        hasQnA: course.hasQnA || false,
        isPublished: course.isPublished || false,
        lessons: course.lessons || [],
        class: course.class || '',
        subjects: course.subjects || [],
        contentStructure: course.contentStructure || [],
        routineFiles: course.routineFiles || [],
        previousStudentDiscount: course.previousStudentDiscount || 0,
        extraDiscount: course.extraDiscount || 0,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };

      if (course.validity !== undefined) {
        courseData.validity = course.validity;
      }
      if (course.extraDiscountValidUntil !== undefined) {
        courseData.extraDiscountValidUntil = course.extraDiscountValidUntil;
      }

      const courseRef = doc(db, 'courses', course.id);
      await setDoc(courseRef, courseData);
      
      console.log('✅ Course created:', course.id);
      return course.id;
    } catch (error: any) {
      logError('createCourse', error, { courseId: course.id });
      throw new Error(error.message);
    }
  },

  async getAllCourses(): Promise<Course[]> {
    try {
      console.log('📚 Getting all courses...');
      const coursesCollection = collection(db, 'courses');
      const coursesSnapshot = await getDocs(query(coursesCollection, orderBy('createdAt', 'desc')));
      
      const courses = coursesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        class: doc.data().class || '',
        subjects: doc.data().subjects || [],
        contentStructure: doc.data().contentStructure || [],
        routineFiles: doc.data().routineFiles || [],
        hasAiQnA: doc.data().hasAiQnA || false,
        hasHumanQnA: doc.data().hasHumanQnA || false,
        hasStudyPlanner: doc.data().hasStudyPlanner || false,
        hasQnA: doc.data().hasQnA || false,
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date()
      })) as Course[];

      console.log('✅ Retrieved courses:', courses.length);
      return courses;
    } catch (error: any) {
      logError('getAllCourses', error);
      throw new Error(error.message);
    }
  },

  async getPublishedCourses(): Promise<Course[]> {
    try {
      console.log('📚 Getting published courses...');
      const coursesCollection = collection(db, 'courses');
      
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
            ...doc.data(),
            class: doc.data().class || '',
            subjects: doc.data().subjects || [],
            contentStructure: doc.data().contentStructure || [],
            routineFiles: doc.data().routineFiles || [],
            hasAiQnA: doc.data().hasAiQnA || false,
            hasHumanQnA: doc.data().hasHumanQnA || false,
            hasStudyPlanner: doc.data().hasStudyPlanner || false,
            hasQnA: doc.data().hasQnA || false,
            createdAt: doc.data().createdAt?.toDate() || new Date(),
            updatedAt: doc.data().updatedAt?.toDate() || new Date()
          })) as Course[];

          console.log('✅ Retrieved published courses:', courses.length);
          return courses;
        }
      } catch (indexError) {
        console.warn('⚠️ Firestore index missing, filtering locally');
      }
      
      const allCoursesSnapshot = await getDocs(coursesCollection);
      const allCourses = allCoursesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        class: doc.data().class || '',
        subjects: doc.data().subjects || [],
        contentStructure: doc.data().contentStructure || [],
        routineFiles: doc.data().routineFiles || [],
        hasAiQnA: doc.data().hasAiQnA || false,
        hasHumanQnA: doc.data().hasHumanQnA || false,
        hasStudyPlanner: doc.data().hasStudyPlanner || false,
        hasQnA: doc.data().hasQnA || false,
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date()
      })) as Course[];
      
      const published = allCourses.filter(c => c.isPublished).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      console.log('✅ Filtered published courses:', published.length);
      return published;
    } catch (error: any) {
      logError('getPublishedCourses', error);
      throw new Error(error.message);
    }
  },

  async getCourseById(courseId: string): Promise<Course | null> {
    try {
      if (!courseId || !courseId.trim()) {
        return null;
      }

      const courseDoc = await getDoc(doc(db, 'courses', courseId));
      
      if (!courseDoc.exists()) {
        return null;
      }
      
      const courseData = courseDoc.data();
      return {
        id: courseDoc.id,
        ...courseData,
        class: courseData.class || '',
        subjects: courseData.subjects || [],
        contentStructure: courseData.contentStructure || [],
        routineFiles: courseData.routineFiles || [],
        hasAiQnA: courseData.hasAiQnA || false,
        hasHumanQnA: courseData.hasHumanQnA || false,
        hasStudyPlanner: courseData.hasStudyPlanner || false,
        hasQnA: courseData.hasQnA || false,
        createdAt: courseData.createdAt?.toDate() || new Date(),
        updatedAt: courseData.updatedAt?.toDate() || new Date()
      } as Course;
    } catch (error: any) {
      logError('getCourseById', error, { courseId });
      throw new Error(error.message);
    }
  },

  async getCoursesByInstructor(instructorId: string): Promise<Course[]> {
    try {
      console.log('📚 Getting courses by instructor:', instructorId);
      const coursesCollection = collection(db, 'courses');
      const q = query(
        coursesCollection, 
        where('instructorId', '==', instructorId),
        orderBy('createdAt', 'desc')
      );
      const coursesSnapshot = await getDocs(q);
      
      const courses = coursesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        class: doc.data().class || '',
        subjects: doc.data().subjects || [],
        contentStructure: doc.data().contentStructure || [],
        routineFiles: doc.data().routineFiles || [],
        hasAiQnA: doc.data().hasAiQnA || false,
        hasHumanQnA: doc.data().hasHumanQnA || false,
        hasStudyPlanner: doc.data().hasStudyPlanner || false,
        hasQnA: doc.data().hasQnA || false,
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date()
      })) as Course[];

      console.log('✅ Retrieved courses:', courses.length);
      return courses;
    } catch (error: any) {
      logError('getCoursesByInstructor', error, { instructorId });
      throw new Error(error.message);
    }
  },

  async updateCourse(courseId: string, updates: Partial<Course>): Promise<void> {
    try {
      console.log('📝 Updating course:', courseId);

      if (!courseId || !courseId.trim()) {
        throw new Error('Course ID required');
      }

      const existingCourse = await this.getCourseById(courseId);
      if (!existingCourse) {
        throw new Error(`Course with ID "${courseId}" not found`);
      }

      const updateData: any = {
        ...updates,
        updatedAt: Timestamp.now()
      };

      if (updates.contentStructure && updates.contentStructure.length > 0) {
        const totalMinutes = this.calculateTotalDurationFromStructure(updates.contentStructure);
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        updateData.duration = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      } else if (updates.lessons && updates.lessons.length > 0) {
        updateData.duration = this.calculateTotalDuration(updates.lessons);
      }

      const courseRef = doc(db, 'courses', courseId);
      await updateDoc(courseRef, updateData);
      
      console.log('✅ Course updated:', courseId);
    } catch (error: any) {
      logError('updateCourse', error, { courseId });
      throw new Error(error.message);
    }
  },

  async deleteCourse(courseId: string): Promise<void> {
    try {
      console.log('🗑️ Deleting course:', courseId);

      if (!courseId || !courseId.trim()) {
        throw new Error('Course ID required');
      }

      const course = await this.getCourseById(courseId);
      if (!course) {
        throw new Error('Course not found');
      }

      const courseRef = doc(db, 'courses', courseId);

      try {
        const enrollmentsQuery = query(
          collection(db, 'enrollments'),
          where('courseId', '==', courseId)
        );
        const enrollmentsSnapshot = await getDocs(enrollmentsQuery);
        
        await Promise.all(
          enrollmentsSnapshot.docs.map(doc => deleteDoc(doc.ref))
        );
      } catch (error) {
        console.warn('⚠️ Failed to delete enrollments');
      }

      try {
        const contentQuery = query(
          collection(db, 'studentContent'),
          where('courseId', '==', courseId)
        );
        const contentSnapshot = await getDocs(contentQuery);
        
        await Promise.all(
          contentSnapshot.docs.map(doc => deleteDoc(doc.ref))
        );
      } catch (error) {
        console.warn('⚠️ Failed to delete student content');
      }

      await deleteDoc(courseRef);
      console.log('✅ Course deleted:', courseId);
    } catch (error: any) {
      logError('deleteCourse', error, { courseId });
      throw new Error(error.message);
    }
  },

  // ==================== ENROLLMENT PRICE CALCULATION ====================

  /**
   * Calculate the final enrollment price, supporting multiple stacked coupon codes.
   */
  async calculateEnrollmentPrice(
    courseId: string,
    studentId: string,
    couponCodes: string[] = []
  ): Promise<EnrollmentCalculation> {
    try {
      console.log('💰 Calculating price:', { courseId, studentId, couponCodes });

      const course = await this.getCourseById(courseId);
      if (!course) {
        throw new Error('Course not found');
      }

      const basePrice = course.price;
      let previousStudentDiscount = 0;
      let extraDiscount = 0;

      const previousEnrollments = await this.getStudentEnrollments(studentId);
      const hasPreviousEnrollments = previousEnrollments.length > 0;
      const enrolledCourseIds = previousEnrollments.map(e => e.courseId);

      console.log('Previous enrollments:', previousEnrollments.length);

      if (hasPreviousEnrollments && course.previousStudentDiscount && course.previousStudentDiscount > 0) {
        previousStudentDiscount = course.previousStudentDiscount;
        console.log('✅ Applied previous student discount:', previousStudentDiscount);
      }

      let isExtraDiscountValid = false;
      if (course.extraDiscount && course.extraDiscount > 0 && course.extraDiscountValidUntil) {
        try {
          const validUntilDate = new Date(course.extraDiscountValidUntil);
          const now = new Date();
          validUntilDate.setHours(23, 59, 59, 999);
          
          if (now <= validUntilDate) {
            extraDiscount = course.extraDiscount;
            isExtraDiscountValid = true;
            console.log('✅ Applied extra discount:', extraDiscount);
          } else {
            console.log('❌ Extra discount expired');
          }
        } catch (dateError) {
          console.warn('⚠️ Invalid extraDiscountValidUntil date format:', course.extraDiscountValidUntil);
        }
      }

      // ── MULTI-COUPON VALIDATION via couponService ──────────────────────────
      const appliedCoupons: AppliedCoupon[] = [];
      let couponDiscount = 0;
      let couponError: string | undefined;

      const uniqueCodes = Array.from(
        new Set(couponCodes.map(c => c.trim().toUpperCase()).filter(Boolean))
      );

      for (const code of uniqueCodes) {
        const priceForThisCoupon = Math.max(0, basePrice - previousStudentDiscount - extraDiscount - couponDiscount);

        try {
          const validationResult = await couponService.validateCoupon(
            code,
            studentId,
            courseId,
            priceForThisCoupon,
            enrolledCourseIds
          );

          if (validationResult.valid && validationResult.discount !== undefined && validationResult.discount > 0) {
            const couponDoc = await couponService.getCouponByCode(code);
            if (couponDoc?.id) {
              appliedCoupons.push({
                couponId: couponDoc.id,
                couponCode: code,
                discount: validationResult.discount,
                successMessage: validationResult.successMessage,
              });
              couponDiscount += validationResult.discount;
              console.log(`✅ Coupon applied: ${code}, discount: ${validationResult.discount}`);
            }
          } else {
            if (uniqueCodes.length === 1) {
              couponError = validationResult.reason || 'Invalid coupon code';
            }
            console.log(`❌ Coupon rejected: ${code}`, validationResult.reason);
          }
        } catch (couponErr: any) {
          if (uniqueCodes.length === 1) {
            couponError = 'Unable to validate coupon. Please try again.';
          }
          console.warn(`⚠️ Coupon validation error for ${code}:`, couponErr.message);
        }
      }
      // ── END MULTI-COUPON VALIDATION ────────────────────────────────────────

      const totalDiscount = previousStudentDiscount + extraDiscount + couponDiscount;
      const finalPrice = Math.max(0, basePrice - totalDiscount);

      const firstCoupon = appliedCoupons[0];

      console.log('Price calculation:', {
        basePrice, previousStudentDiscount, extraDiscount,
        appliedCoupons: appliedCoupons.map(c => c.couponCode),
        couponDiscount, totalDiscount, finalPrice,
        hasPreviousEnrollments, isExtraDiscountValid, couponError,
      });

      return {
        basePrice,
        previousStudentDiscount,
        extraDiscount,
        appliedCoupons,
        couponDiscount,
        totalDiscount,
        finalPrice,
        hasPreviousEnrollments,
        isExtraDiscountValid,
        couponId: firstCoupon?.couponId,
        couponCode: firstCoupon?.couponCode,
        couponSuccessMessage: firstCoupon?.successMessage,
        couponError,
      };
    } catch (error: any) {
      logError('calculateEnrollmentPrice', error, { courseId, studentId });
      throw new Error(error.message);
    }
  },

  // ==================== ENROLLMENT ====================

  async enrollStudent(request: EnrollmentRequest): Promise<EnrollmentResponse> {
    try {
      console.log('');
      console.log('📝 ENROLLMENT REQUEST');
      console.log('═'.repeat(80));
      console.log('Timestamp:', new Date().toISOString());
      console.log('Course ID:', request.courseId);
      console.log('Student ID:', request.studentId);
      console.log('Student Name:', request.studentName);
      console.log('Final Price:', request.calculation.finalPrice);
      console.log('Coupon Code:', request.calculation.couponCode || 'None');
      console.log('Applied Coupons:', request.calculation.appliedCoupons?.map(c => c.couponCode).join(', ') || 'None');
      console.log('Total Coupon Discount:', request.calculation.couponDiscount);
      console.log('═'.repeat(80));

      const course = await this.getCourseById(request.courseId);
      if (!course) {
        logError('enrollStudent', new Error('Course not found'), { courseId: request.courseId });
        return {
          success: false,
          error: 'Course not found',
          details: 'The requested course does not exist',
          message: 'Course not found. Please refresh and try again.'
        };
      }

      const existingEnrollments = await this.getStudentEnrollments(request.studentId);
      if (existingEnrollments.some(e => e.courseId === request.courseId)) {
        console.log('ℹ️ Student already enrolled');
        return {
          success: false,
          error: 'Already enrolled',
          details: 'You are already enrolled in this course',
          message: 'You are already enrolled in this course.'
        };
      }

      const { finalPrice } = request.calculation;

      if (finalPrice === 0) {
        console.log('Processing free enrollment');
        return await this.createFreeEnrollment(request, course);
      }

      console.log('Processing paid enrollment');
      return await this.initiatePaidEnrollment(request);
      
    } catch (error: any) {
      logError('enrollStudent', error, { 
        courseId: request.courseId, 
        studentId: request.studentId 
      });
      return {
        success: false,
        error: 'Enrollment failed',
        details: error.message,
        message: 'Failed to process enrollment. Please try again.'
      };
    }
  },

  async createFreeEnrollment(
    request: EnrollmentRequest,
    course: Course
  ): Promise<EnrollmentResponse> {
    try {
      console.log('Creating free enrollment');

      const enrollmentData: any = {
        courseId: request.courseId,
        studentId: request.studentId,
        studentName: request.studentName,
        studentEmail: request.studentEmail,
        progress: 0,
        completedLessons: [],
        enrolledAt: Timestamp.now(),
        lastAccessedAt: Timestamp.now(),
        paymentStatus: 'completed' as const,
        amountPaid: 0,
        paymentMethod: 'FREE',
        paymentDate: Timestamp.now(),
        appliedDiscounts: {
          previousStudentDiscount: request.calculation.previousStudentDiscount,
          extraDiscount: request.calculation.extraDiscount,
          couponDiscount: request.calculation.couponDiscount,
          appliedCoupons: request.calculation.appliedCoupons,
          ...(request.calculation.couponCode ? { couponCode: request.calculation.couponCode } : {}),
          ...(request.calculation.couponId ? { couponId: request.calculation.couponId } : {}),
        }
      };

      const enrollmentRef = doc(collection(db, 'enrollments'));
      await setDoc(enrollmentRef, enrollmentData);

      console.log('✅ Free enrollment created:', enrollmentRef.id);

      // Record coupon usage for ALL applied coupons
      for (const appliedCoupon of request.calculation.appliedCoupons) {
        try {
          await couponService.recordCouponUsage({
            couponId: appliedCoupon.couponId,
            userId: request.studentId,
            courseId: request.courseId,
            userName: request.studentName,
            courseName: course.title,
            discountApplied: appliedCoupon.discount,
            amountPaid: request.calculation.finalPrice,
          });
          console.log(`✅ Coupon usage recorded: ${appliedCoupon.couponCode}`);
        } catch (couponRecordErr: any) {
          console.warn(`⚠️ Failed to record coupon usage for ${appliedCoupon.couponCode}:`, couponRecordErr.message);
        }
      }

      try {
        const courseRef = doc(db, 'courses', request.courseId);
        await updateDoc(courseRef, {
          studentCount: course.studentCount + 1
        });
      } catch (updateError: any) {
        console.warn('⚠️ Course count update failed');
      }

      try {
        await this.addCourseToContentLibrary(request.courseId, request.studentId);
      } catch (libraryError: any) {
        console.warn('⚠️ Library addition failed');
      }

      return {
        success: true,
        enrollmentId: enrollmentRef.id,
        message: 'Successfully enrolled in free course'
      };
    } catch (error: any) {
      logError('createFreeEnrollment', error, { courseId: request.courseId });
      return {
        success: false,
        error: 'Free enrollment failed',
        details: error.message,
        message: 'Failed to complete enrollment. Please try again.'
      };
    }
  },

  // ==================== SECURITY PATCHED: initiatePaidEnrollment ====================
  async initiatePaidEnrollment(
    request: EnrollmentRequest
  ): Promise<EnrollmentResponse> {
    try {
      console.log('');
      console.log('💰 INITIATING PAID ENROLLMENT (SECURE)');
      console.log('═'.repeat(80));
      console.log('Course ID:', request.courseId);
      console.log('Student ID:', request.studentId);
      console.log('Final Price:', request.calculation.finalPrice);
      console.log('Has Applied Coupons:', request.calculation.appliedCoupons.length);
      console.log('═'.repeat(80));

      // Validate final price
      if (request.calculation.finalPrice <= 0) {
        return {
          success: false,
          error: 'Invalid price',
          message: 'Price must be greater than zero for paid enrollment.'
        };
      }

      // Get course
      const course = await this.getCourseById(request.courseId);
      if (!course) {
        return {
          success: false,
          error: 'Course not found',
          message: 'The course you are trying to enroll in was not found.'
        };
      }

      // Check for existing enrollment
      const existingEnrollments = await this.getStudentEnrollments(request.studentId);
      const alreadyEnrolled = existingEnrollments.some(e => e.courseId === request.courseId);
      
      if (alreadyEnrolled) {
        return {
          success: false,
          error: 'Already enrolled',
          message: 'You are already enrolled in this course.'
        };
      }

      // Prepare payment request with full metadata
      const paymentRequest: PaymentInitiationRequest = {
        userId: request.studentId,
        userName: request.studentName,
        userEmail: request.studentEmail || undefined,
        amount: request.calculation.finalPrice,
        productId: request.courseId,
        productName: course.title,
        productType: 'course',
        appliedDiscounts: {
          previousStudentDiscount: request.calculation.previousStudentDiscount,
          extraDiscount: request.calculation.extraDiscount,
          couponDiscount: request.calculation.couponDiscount,
        },
        metadata: {
          // Everything needed to reconstruct enrollment server-side
          courseId: request.courseId,
          studentId: request.studentId,
          studentName: request.studentName,
          studentEmail: request.studentEmail || '',
          courseTitle: course.title,
          instructorId: course.instructorId,
          category: course.category,
          basePrice: request.calculation.basePrice,
          finalPrice: request.calculation.finalPrice,
          previousStudentDiscount: request.calculation.previousStudentDiscount,
          extraDiscount: request.calculation.extraDiscount,
          couponDiscount: request.calculation.couponDiscount,
          totalDiscount: request.calculation.totalDiscount,
          // Serialize full coupon list for server-side statistics
          appliedCoupons: JSON.stringify(request.calculation.appliedCoupons || []),
          couponId: request.calculation.couponId || '',
          couponCode: request.calculation.couponCode || '',
          discountApplied: request.calculation.couponDiscount,
          courseName: course.title,
          userName: request.studentName,
        }
      };

      console.log('Calling payment service...');

      const paymentResponse = await paymentService.initiatePayment(paymentRequest);

      console.log('');
      console.log('💳 PAYMENT RESPONSE');
      console.log('═'.repeat(80));
      console.log('Success:', paymentResponse.success);
      console.log('Has Gateway URL:', !!paymentResponse.gatewayUrl);
      console.log('Transaction ID:', paymentResponse.transactionId);
      console.log('═'.repeat(80));

      if (paymentResponse.success && paymentResponse.gatewayUrl) {
        return {
          success: true,
          transactionId: paymentResponse.transactionId,
          gatewayUrl: paymentResponse.gatewayUrl,
          message: paymentResponse.userMessage || 'Payment initiated successfully'
        };
      } else {
        return {
          success: false,
          error: paymentResponse.error || 'Payment initiation failed',
          details: paymentResponse.details,
          message: paymentResponse.userMessage || 'Failed to initiate payment. Please try again.'
        };
      }
    } catch (error: any) {
      logError('initiatePaidEnrollment', error, { courseId: request.courseId });
      return {
        success: false,
        error: 'Payment initiation failed',
        details: error.message,
        message: 'Failed to initiate payment. Please try again.'
      };
    }
  },

  // ==================== SECURITY PATCHED: completeEnrollmentAfterPayment ====================
  // This function is now ONLY called by the frontend for verification
  // The actual enrollment creation happens server-side in api/payment.ts
  async completeEnrollmentAfterPayment(
    transactionId: string,
    userId: string  // ADD userId parameter for security check
  ): Promise<{
    success: boolean;
    enrollmentId?: string;
    alreadyEnrolled?: boolean;
    courseTitle?: string;
    error?: string;
  }> {
    try {
      console.log('');
      console.log('🔍 VERIFYING ENROLLMENT AFTER PAYMENT');
      console.log('═'.repeat(80));
      console.log('Transaction ID:', transactionId);
      console.log('User ID:', userId);
      console.log('═'.repeat(80));

      // Step 1: Get transaction from Firestore
      const txnSnap = await getDocs(query(
        collection(db, 'transactions'),
        where('transactionId', '==', transactionId)
      ));

      if (txnSnap.empty) {
        return { success: false, error: 'Transaction not found' };
      }

      const txn = txnSnap.docs[0].data();

      // Step 2: SECURITY CHECK - Verify ownership
      if (txn.userId !== userId) {
        console.error('🚨 SECURITY: User ID mismatch');
        console.error('Transaction userId:', txn.userId);
        console.error('Provided userId:', userId);
        return { success: false, error: 'Unauthorized access' };
      }

      // Step 3: Check transaction status
      if (txn.status !== 'success') {
        return { 
          success: false, 
          error: `Payment not completed. Status: ${txn.status}` 
        };
      }

      const courseId = txn.productId;
      const courseTitle = txn.metadata?.courseTitle || txn.productName || '';

      // Step 4: Check if enrollment exists (server should have created it)
      const enrollmentSnap = await getDocs(query(
        collection(db, 'enrollments'),
        where('studentId', '==', userId),
        where('courseId', '==', courseId)
      ));

      if (enrollmentSnap.empty) {
        // Enrollment not found - this shouldn't happen if server processed payment correctly
        console.error('❌ Enrollment not found after successful payment');
        console.error('This indicates the server-side enrollment creation failed');
        return {
          success: false,
          error: 'Enrollment pending. Please wait a moment and refresh the page.',
          courseTitle
        };
      }

      const enrollmentDoc = enrollmentSnap.docs[0];
      console.log('✅ Enrollment verified:', enrollmentDoc.id);

      return {
        success: true,
        enrollmentId: enrollmentDoc.id,
        alreadyEnrolled: false,
        courseTitle
      };

    } catch (error: any) {
      console.error('Error verifying enrollment:', error);
      return {
        success: false,
        error: error.message || 'Failed to verify enrollment'
      };
    }
  },

  // ==================== SECURITY HELPER: verifyEnrollmentExists ====================
  /**
   * Verifies that an enrollment exists for a user and course
   * Used after payment to confirm server-side enrollment creation
   */
  async verifyEnrollmentExists(
    userId: string,
    courseId: string,
    maxAttempts: number = 3,
    delayMs: number = 2000
  ): Promise<{ exists: boolean; enrollmentId?: string }> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      console.log(`Checking enrollment existence... Attempt ${attempt}/${maxAttempts}`);

      try {
        const enrollmentSnap = await getDocs(query(
          collection(db, 'enrollments'),
          where('studentId', '==', userId),
          where('courseId', '==', courseId)
        ));

        if (!enrollmentSnap.empty) {
          return {
            exists: true,
            enrollmentId: enrollmentSnap.docs[0].id
          };
        }

        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      } catch (error: any) {
        console.error(`Enrollment check attempt ${attempt} failed:`, error.message);
        if (attempt === maxAttempts) {
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    return { exists: false };
  },

  // ── POST-PAYMENT COUPON USAGE RECORDING ─────────────────────────────────────
  async recordAllCouponUsagesAfterPayment(
    appliedCouponsJson: string,
    userId: string,
    courseId: string,
    userName: string,
    courseName: string,
    amountPaid: number,
  ): Promise<void> {
    try {
      const appliedCoupons: AppliedCoupon[] = JSON.parse(appliedCouponsJson);
      for (const ac of appliedCoupons) {
        try {
          await couponService.recordCouponUsage({
            couponId: ac.couponId,
            userId,
            courseId,
            userName,
            courseName,
            discountApplied: ac.discount,
            amountPaid,
          });
          console.log(`✅ Post-payment coupon usage recorded: ${ac.couponCode}`);
        } catch (err: any) {
          console.warn(`⚠️ Failed to record post-payment usage for ${ac.couponCode}:`, err.message);
        }
      }
    } catch (parseErr: any) {
      console.warn('⚠️ Could not parse appliedCoupons for post-payment recording:', parseErr.message);
    }
  },

  // Legacy single-coupon helper kept for backward compatibility
  async recordCouponUsageAfterPayment(
    couponId: string,
    couponCode: string,
    userId: string,
    courseId: string,
    userName: string,
    courseName: string,
    discountApplied: number,
    amountPaid: number,
  ): Promise<void> {
    try {
      await couponService.recordCouponUsage({
        couponId,
        userId,
        courseId,
        userName,
        courseName,
        discountApplied,
        amountPaid,
      });
      console.log('✅ Post-payment coupon usage recorded');
    } catch (err: any) {
      console.warn('⚠️ Failed to record post-payment coupon usage:', err.message);
    }
  },
  // ── END POST-PAYMENT COUPON USAGE RECORDING ─────────────────────────────────

  async validatePayment(transactionId: string): Promise<{
    success: boolean;
    validated: boolean;
    status?: string;
    error?: string;
    details?: string;
    message?: string;
  }> {
    try {
      console.log('Validating payment:', transactionId);

      const validationResponse = await paymentService.validatePayment(transactionId);

      console.log('');
      console.log('🔍 VALIDATION RESPONSE');
      console.log('═'.repeat(80));
      console.log('Success:', validationResponse.success);
      console.log('Validated:', validationResponse.validated);
      console.log('Status:', validationResponse.status);
      console.log('Error:', validationResponse.error);
      console.log('═'.repeat(80));

      return {
        success: validationResponse.success,
        validated: validationResponse.validated || false,
        status: validationResponse.status,
        error: validationResponse.error,
        details: validationResponse.details,
        message: validationResponse.userMessage
      };
    } catch (error: any) {
      logError('validatePayment', error, { transactionId });
      return {
        success: false,
        validated: false,
        error: 'Validation failed',
        details: error.message,
        message: 'Failed to validate payment. Please contact support.'
      };
    }
  },

  async getStudentEnrollments(studentId: string): Promise<Enrollment[]> {
    try {
      if (!studentId?.trim()) {
        return [];
      }

      const q = query(
        collection(db, 'enrollments'), 
        where('studentId', '==', studentId)
      );
      const snapshot = await getDocs(q);
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        enrolledAt: doc.data().enrolledAt?.toDate() || new Date(),
        lastAccessedAt: doc.data().lastAccessedAt?.toDate() || new Date(),
        paymentDate: doc.data().paymentDate?.toDate()
      })) as Enrollment[];
    } catch (error: any) {
      logError('getStudentEnrollments', error, { studentId });
      throw new Error(error.message);
    }
  },

  async getCourseEnrollments(courseId: string): Promise<Enrollment[]> {
    try {
      if (!courseId?.trim()) {
        return [];
      }

      const q = query(
        collection(db, 'enrollments'), 
        where('courseId', '==', courseId),
        orderBy('enrolledAt', 'desc')
      );
      const snapshot = await getDocs(q);
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        enrolledAt: doc.data().enrolledAt?.toDate() || new Date(),
        lastAccessedAt: doc.data().lastAccessedAt?.toDate() || new Date(),
        paymentDate: doc.data().paymentDate?.toDate()
      })) as Enrollment[];
    } catch (error: any) {
      logError('getCourseEnrollments', error, { courseId });
      throw new Error(error.message);
    }
  },

  async updateEnrollmentProgress(
    enrollmentId: string, 
    progress: number, 
    completedLessons: string[]
  ): Promise<void> {
    try {
      if (!enrollmentId?.trim()) {
        throw new Error('Enrollment ID required');
      }

      const enrollmentRef = doc(db, 'enrollments', enrollmentId);
      await updateDoc(enrollmentRef, {
        progress,
        completedLessons,
        lastAccessedAt: Timestamp.now()
      });

      console.log('✅ Progress updated:', enrollmentId);
    } catch (error: any) {
      logError('updateEnrollmentProgress', error, { enrollmentId });
      throw new Error(error.message);
    }
  },

  // ==================== CONTENT LIBRARY ====================

  async addCourseToContentLibrary(courseId: string, studentId: string): Promise<void> {
    try {
      console.log('Adding to library:', { courseId, studentId });
      
      const course = await this.getCourseById(courseId);
      if (!course) {
        throw new Error('Course not found');
      }

      if (course.contentStructure && course.contentStructure.length > 0) {
        await this.addContentStructureToLibrary(course, studentId, course.contentStructure);
      } else if (course.lessons && course.lessons.length > 0) {
        for (const lesson of course.lessons) {
          const contentEntry = {
            title: `${course.title} - ${lesson.title}`,
            description: `Lesson: ${lesson.title}`,
            type: lesson.type === 'video' ? 'lesson' : 
                  lesson.type === 'text' ? 'note' : 'mcq',
            course: course.title,
            category: course.category,
            class: course.class,
            subjects: course.subjects,
            difficulty: course.level as 'beginner' | 'intermediate' | 'advanced',
            tags: [...course.tags, 'purchased-course', 'enrolled'],
            courseId,
            lessonId: lesson.id,
            duration: lesson.duration,
            isFromCourse: true,
            accessLevel: 'full',
            instructor: course.instructor,
            videoUrl: lesson.videoUrl,
            pdfUrl: lesson.pdfUrl,
            content: lesson.content,
            topics: lesson.topics || [],
            createdBy: course.instructorId,
            enrolledStudentId: studentId,
            createdAt: Timestamp.now()
          };

          await setDoc(doc(collection(db, 'studentContent')), contentEntry);
        }
      }

      const mainCourseEntry = {
        title: course.title,
        description: course.description,
        type: 'course',
        course: course.title,
        category: course.category,
        class: course.class,
        subjects: course.subjects,
        difficulty: course.level as 'beginner' | 'intermediate' | 'advanced',
        tags: [...course.tags, 'purchased-course', 'enrolled', 'full-course'],
        courseId,
        isFromCourse: true,
        accessLevel: 'full',
        duration: course.duration,
        instructor: course.instructor,
        thumbnail: course.thumbnail,
        rating: course.rating,
        studentCount: course.studentCount,
        hasAiQnA: course.hasAiQnA,
        hasHumanQnA: course.hasHumanQnA,
        hasStudyPlanner: course.hasStudyPlanner,
        createdBy: course.instructorId,
        enrolledStudentId: studentId,
        createdAt: Timestamp.now()
      };

      await setDoc(doc(collection(db, 'studentContent')), mainCourseEntry);
      console.log('✅ Added to library');
    } catch (error: any) {
      logError('addCourseToContentLibrary', error, { courseId, studentId });
      throw new Error(error.message);
    }
  },

  async addContentStructureToLibrary(
    course: Course, 
    studentId: string, 
    nodes: ContentNode[]
  ): Promise<void> {
    for (const node of nodes) {
      if (node.type === 'content' && node.contentData) {
        const contentEntry = {
          title: `${course.title} - ${node.name}`,
          description: node.contentData.description || '',
          type: node.contentData.type,
          course: course.title,
          category: course.category,
          class: course.class,
          subjects: course.subjects,
          difficulty: course.level as 'beginner' | 'intermediate' | 'advanced',
          tags: [...course.tags, 'purchased-course', 'enrolled'],
          courseId: course.id,
          contentId: node.contentId,
          duration: node.contentData.duration || 0,
          isFromCourse: true,
          accessLevel: 'full',
          instructor: course.instructor,
          videoUrl: node.contentData.videoUrl,
          noteUrl: node.contentData.noteUrl,
          createdBy: course.instructorId,
          enrolledStudentId: studentId,
          createdAt: Timestamp.now()
        };

        await setDoc(doc(collection(db, 'studentContent')), contentEntry);
      }

      if (node.children && node.children.length > 0) {
        await this.addContentStructureToLibrary(course, studentId, node.children);
      }
    }
  },

  async getStudentCourseContent(studentId: string): Promise<any[]> {
    try {
      if (!studentId?.trim()) {
        return [];
      }

      const q = query(
        collection(db, 'studentContent'),
        where('enrolledStudentId', '==', studentId),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date()
      }));
    } catch (error: any) {
      logError('getStudentCourseContent', error, { studentId });
      throw new Error(error.message);
    }
  },

  // ==================== SEARCH ====================

  async searchCourses(searchTerm: string): Promise<Course[]> {
    try {
      if (!searchTerm?.trim()) {
        return [];
      }

      const courses = await this.getPublishedCourses();
      const lowerSearch = searchTerm.toLowerCase().trim();
      
      return courses.filter(course => 
        course.title.toLowerCase().includes(lowerSearch) ||
        course.description.toLowerCase().includes(lowerSearch) ||
        course.instructor.toLowerCase().includes(lowerSearch) ||
        course.tags.some(tag => tag.toLowerCase().includes(lowerSearch)) ||
        course.subjects.some(subject => subject.toLowerCase().includes(lowerSearch)) ||
        course.class.toLowerCase().includes(lowerSearch) ||
        course.category.toLowerCase().includes(lowerSearch)
      );
    } catch (error: any) {
      logError('searchCourses', error, { searchTerm });
      throw new Error(error.message);
    }
  },

  async getAllEnrollments(): Promise<Enrollment[]> {
    try {
      const snapshot = await getDocs(
        query(collection(db, 'enrollments'), orderBy('enrolledAt', 'desc'))
      );
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        enrolledAt: doc.data().enrolledAt?.toDate() || new Date(),
        lastAccessedAt: doc.data().lastAccessedAt?.toDate() || new Date(),
        paymentDate: doc.data().paymentDate?.toDate()
      })) as Enrollment[];
    } catch (error: any) {
      logError('getAllEnrollments', error);
      throw new Error(error.message);
    }
  }
};

export default courseService;
