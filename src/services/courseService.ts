// src/services/courseService.ts - PART 1 OF 2
// Course Service with Complete Error Handling and Payment Integration

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
  };
}

export interface EnrollmentCalculation {
  basePrice: number;
  previousStudentDiscount: number;
  extraDiscount: number;
  couponDiscount: number;
  totalDiscount: number;
  finalPrice: number;
  hasPreviousEnrollments: boolean;
  isExtraDiscountValid: boolean;
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

// ==================== COURSE SERVICE ====================

export const courseService = {
  
  // ==================== FILE OPERATIONS ====================
  
  async uploadFile(file: File, path: string): Promise<{ url: string; fileName: string }> {
    try {
      const timestamp = Date.now();
      const fileName = `${timestamp}_${file.name}`;
      const storageRef = ref(storage, `${path}/${fileName}`);
      
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      
      return { url, fileName };
    } catch (error: any) {
      console.error('CourseService: File upload error:', error);
      throw new Error(`Failed to upload file: ${error.message}`);
    }
  },

  async deleteFile(fileName: string, path: string): Promise<void> {
    try {
      const storageRef = ref(storage, `${path}/${fileName}`);
      await deleteObject(storageRef);
    } catch (error: any) {
      console.warn('CourseService: File deletion warning:', error.message);
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
      console.log('CourseService: Creating course:', course.id);

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
      
      console.log('CourseService: Course created successfully:', course.id);
      return course.id;
    } catch (error: any) {
      console.error('CourseService: Error creating course:', error);
      throw new Error(error.message);
    }
  },

  async getAllCourses(): Promise<Course[]> {
    try {
      console.log('CourseService: Getting all courses...');
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

      console.log('CourseService: Retrieved courses:', courses.length);
      return courses;
    } catch (error: any) {
      console.error('CourseService: Error getting courses:', error);
      throw new Error(error.message);
    }
  },

  async getPublishedCourses(): Promise<Course[]> {
    try {
      console.log('CourseService: Getting published courses...');
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

          console.log('CourseService: Retrieved published courses:', courses.length);
          return courses;
        }
      } catch (indexError) {
        console.warn('CourseService: Firestore index missing, filtering locally');
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
      console.log('CourseService: Filtered published courses:', published.length);
      return published;
    } catch (error: any) {
      console.error('CourseService: Error getting published courses:', error);
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
      console.error('CourseService: Error getting course:', error);
      throw new Error(error.message);
    }
  },

  async getCoursesByInstructor(instructorId: string): Promise<Course[]> {
    try {
      const coursesCollection = collection(db, 'courses');
      const q = query(
        coursesCollection, 
        where('instructorId', '==', instructorId),
        orderBy('createdAt', 'desc')
      );
      const coursesSnapshot = await getDocs(q);
      
      return coursesSnapshot.docs.map(doc => ({
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
    } catch (error: any) {
      console.error('CourseService: Error getting courses by instructor:', error);
      throw new Error(error.message);
    }
  },

  async updateCourse(courseId: string, updates: Partial<Course>): Promise<void> {
    try {
      if (!courseId || !courseId.trim()) {
        throw new Error('Course ID is required');
      }

      const courseRef = doc(db, 'courses', courseId);
      const courseDoc = await getDoc(courseRef);
      
      if (!courseDoc.exists()) {
        throw new Error(`Course "${courseId}" not found`);
      }

      if (updates.contentStructure) {
        const totalMinutes = this.calculateTotalDurationFromStructure(updates.contentStructure);
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        updates.duration = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      } else if (updates.lessons) {
        updates.duration = this.calculateTotalDuration(updates.lessons);
      }

      const updateData: any = {
        ...updates,
        updatedAt: Timestamp.now()
      };

      Object.keys(updateData).forEach(key => {
        if (updateData[key] === undefined || key === 'id' || key === 'createdAt') {
          delete updateData[key];
        }
      });

      await updateDoc(courseRef, updateData);
      console.log('CourseService: Course updated:', courseId);
    } catch (error: any) {
      console.error('CourseService: Error updating course:', error);
      throw new Error(error.message);
    }
  },

  async deleteCourse(courseId: string): Promise<void> {
    try {
      if (!courseId || !courseId.trim()) {
        throw new Error('Course ID is required');
      }

      const courseRef = doc(db, 'courses', courseId);
      const courseDoc = await getDoc(courseRef);
      
      if (!courseDoc.exists()) {
        throw new Error(`Course "${courseId}" not found`);
      }

      const courseData = courseDoc.data();
      
      // Delete files
      if (courseData.thumbnail) {
        try {
          const thumbnailPath = courseData.thumbnail.split('/').pop();
          if (thumbnailPath) {
            await this.deleteFile(thumbnailPath, 'course_thumbnails');
          }
        } catch (error) {
          console.warn('CourseService: Failed to delete thumbnail');
        }
      }

      if (courseData.routineFiles && Array.isArray(courseData.routineFiles)) {
        for (const file of courseData.routineFiles) {
          try {
            const fileName = file.url.split('/').pop();
            if (fileName) {
              await this.deleteFile(fileName, 'course_routines');
            }
          } catch (error) {
            console.warn('CourseService: Failed to delete routine file');
          }
        }
      }

      // Delete enrollments
      try {
        const enrollmentsCollection = collection(db, 'enrollments');
        const enrollmentsQuery = query(enrollmentsCollection, where('courseId', '==', courseId));
        const enrollmentsSnapshot = await getDocs(enrollmentsQuery);
        
        await Promise.all(
          enrollmentsSnapshot.docs.map(doc => deleteDoc(doc.ref))
        );
      } catch (error) {
        console.warn('CourseService: Failed to delete enrollments');
      }

      // Delete student content
      try {
        const studentContentCollection = collection(db, 'studentContent');
        const contentQuery = query(studentContentCollection, where('courseId', '==', courseId));
        const contentSnapshot = await getDocs(contentQuery);
        
        await Promise.all(
          contentSnapshot.docs.map(doc => deleteDoc(doc.ref))
        );
      } catch (error) {
        console.warn('CourseService: Failed to delete student content');
      }

      await deleteDoc(courseRef);
      console.log('CourseService: Course deleted:', courseId);
    } catch (error: any) {
      console.error('CourseService: Error deleting course:', error);
      throw new Error(error.message);
    }
  },
  // src/services/courseService.ts - PART 2 OF 2
  // Enrollment Operations with Complete Error Handling
  
  // PASTE THIS IMMEDIATELY AFTER PART 1

  // ==================== ENROLLMENT PRICE CALCULATION ====================

  async calculateEnrollmentPrice(
    courseId: string, 
    studentId: string, 
    couponCode?: string
  ): Promise<EnrollmentCalculation> {
    try {
      console.log('CourseService: Calculating enrollment price', { courseId, studentId, couponCode });

      const course = await this.getCourseById(courseId);
      if (!course) {
        throw new Error('Course not found');
      }

      const basePrice = course.price;
      let previousStudentDiscount = 0;
      let extraDiscount = 0;
      let couponDiscount = 0;

      // Check previous enrollments
      const previousEnrollments = await this.getStudentEnrollments(studentId);
      const hasPreviousEnrollments = previousEnrollments.length > 0;

      console.log('CourseService: Previous enrollments count:', previousEnrollments.length);

      // Apply previous student discount
      if (hasPreviousEnrollments && course.previousStudentDiscount) {
        previousStudentDiscount = course.previousStudentDiscount;
        console.log('CourseService: Applied previous student discount:', previousStudentDiscount);
      }

      // Apply extra discount if valid
      let isExtraDiscountValid = false;
      if (course.extraDiscount && course.extraDiscountValidUntil) {
        const validUntil = new Date(course.extraDiscountValidUntil);
        const now = new Date();
        if (now <= validUntil) {
          extraDiscount = course.extraDiscount;
          isExtraDiscountValid = true;
          console.log('CourseService: Applied extra discount:', extraDiscount);
        } else {
          console.log('CourseService: Extra discount expired');
        }
      }

      // Coupon discount (placeholder)
      if (couponCode) {
        console.log('CourseService: Coupon code provided but validation not implemented:', couponCode);
        couponDiscount = 0;
      }

      const totalDiscount = previousStudentDiscount + extraDiscount + couponDiscount;
      const finalPrice = Math.max(0, basePrice - totalDiscount);

      console.log('CourseService: Price calculation complete', {
        basePrice,
        totalDiscount,
        finalPrice
      });

      return {
        basePrice,
        previousStudentDiscount,
        extraDiscount,
        couponDiscount,
        totalDiscount,
        finalPrice,
        hasPreviousEnrollments,
        isExtraDiscountValid
      };
    } catch (error: any) {
      console.error('CourseService: Error calculating price:', error);
      throw new Error(error.message);
    }
  },

  // ==================== ENROLLMENT OPERATIONS ====================

  async enrollStudent(request: EnrollmentRequest): Promise<EnrollmentResponse> {
    try {
      console.log('CourseService: Enrollment request', {
        courseId: request.courseId,
        studentId: request.studentId,
        finalPrice: request.calculation.finalPrice
      });

      // Validate course exists
      const course = await this.getCourseById(request.courseId);
      if (!course) {
        return {
          success: false,
          error: 'Course not found',
          details: 'The requested course does not exist'
        };
      }

      // Check if already enrolled
      const existingEnrollments = await this.getStudentEnrollments(request.studentId);
      if (existingEnrollments.some(e => e.courseId === request.courseId)) {
        return {
          success: false,
          error: 'Already enrolled',
          details: 'You are already enrolled in this course'
        };
      }

      const { finalPrice } = request.calculation;

      // Free course - direct enrollment
      if (finalPrice === 0) {
        console.log('CourseService: Processing free enrollment');
        return await this.createFreeEnrollment(request, course);
      }

      // Paid course - initiate payment
      console.log('CourseService: Processing paid enrollment');
      return await this.initiatePaidEnrollment(request, course);
      
    } catch (error: any) {
      console.error('CourseService: Enrollment error:', error);
      return {
        success: false,
        error: 'Enrollment failed',
        details: error.message || 'An unexpected error occurred'
      };
    }
  },

  async createFreeEnrollment(
    request: EnrollmentRequest,
    course: Course
  ): Promise<EnrollmentResponse> {
    try {
      console.log('CourseService: Creating free enrollment');

      const enrollmentData = {
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
          couponDiscount: request.calculation.couponDiscount
        }
      };

      const enrollmentRef = doc(collection(db, 'enrollments'));
      await setDoc(enrollmentRef, enrollmentData);

      console.log('CourseService: Free enrollment created:', enrollmentRef.id);

      // Update course student count
      try {
        const courseRef = doc(db, 'courses', request.courseId);
        await updateDoc(courseRef, {
          studentCount: course.studentCount + 1
        });
        console.log('CourseService: Course student count updated');
      } catch (updateError: any) {
        console.warn('CourseService: Failed to update student count:', updateError.message);
      }

      // Add to content library
      try {
        await this.addCourseToContentLibrary(request.courseId, request.studentId);
        console.log('CourseService: Course added to content library');
      } catch (libraryError: any) {
        console.warn('CourseService: Failed to add to library:', libraryError.message);
      }

      return {
        success: true,
        enrollmentId: enrollmentRef.id,
        message: 'Successfully enrolled in free course'
      };
    } catch (error: any) {
      console.error('CourseService: Free enrollment error:', error);
      return {
        success: false,
        error: 'Free enrollment failed',
        details: error.message
      };
    }
  },

  async initiatePaidEnrollment(
    request: EnrollmentRequest,
    course: Course
  ): Promise<EnrollmentResponse> {
    try {
      console.log('CourseService: Initiating paid enrollment');

      const paymentRequest: PaymentInitiationRequest = {
        userId: request.studentId,
        userName: request.studentName,
        userEmail: request.studentEmail,
        amount: request.calculation.finalPrice,
        productId: request.courseId,
        productName: course.title,
        productType: 'course',
        appliedDiscounts: {
          previousStudentDiscount: request.calculation.previousStudentDiscount,
          extraDiscount: request.calculation.extraDiscount,
          couponDiscount: request.calculation.couponDiscount
        },
        metadata: {
          courseId: request.courseId,
          studentId: request.studentId,
          courseTitle: course.title,
          instructorId: course.instructorId,
          category: course.category
        }
      };

      console.log('CourseService: Calling payment service...');

      const paymentResponse = await paymentService.initiatePayment(paymentRequest);

      console.log('CourseService: Payment service response:', {
        success: paymentResponse.success,
        hasGatewayUrl: !!paymentResponse.gatewayUrl,
        error: paymentResponse.error
      });

      if (paymentResponse.success && paymentResponse.gatewayUrl) {
        return {
          success: true,
          transactionId: paymentResponse.transactionId,
          gatewayUrl: paymentResponse.gatewayUrl,
          message: 'Payment initiated successfully'
        };
      } else {
        return {
          success: false,
          error: paymentResponse.error || 'Payment initiation failed',
          details: paymentResponse.details
        };
      }
    } catch (error: any) {
      console.error('CourseService: Paid enrollment error:', error);
      return {
        success: false,
        error: 'Payment initiation failed',
        details: error.message
      };
    }
  },

  async validatePayment(transactionId: string): Promise<{
    success: boolean;
    validated: boolean;
    status?: string;
    error?: string;
    details?: string;
  }> {
    try {
      console.log('CourseService: Validating payment:', transactionId);

      const validationResponse = await paymentService.validatePayment(transactionId);

      console.log('CourseService: Payment validation response:', {
        success: validationResponse.success,
        validated: validationResponse.validated,
        status: validationResponse.status
      });

      return {
        success: validationResponse.success,
        validated: validationResponse.validated || false,
        status: validationResponse.status,
        error: validationResponse.error,
        details: validationResponse.details
      };
    } catch (error: any) {
      console.error('CourseService: Payment validation error:', error);
      return {
        success: false,
        validated: false,
        error: 'Payment validation failed',
        details: error.message
      };
    }
  },

  async getStudentEnrollments(studentId: string): Promise<Enrollment[]> {
    try {
      if (!studentId || !studentId.trim()) {
        return [];
      }

      const enrollmentsCollection = collection(db, 'enrollments');
      const q = query(
        enrollmentsCollection, 
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
      console.error('CourseService: Error getting enrollments:', error);
      throw new Error(error.message);
    }
  },

  async getCourseEnrollments(courseId: string): Promise<Enrollment[]> {
    try {
      if (!courseId || !courseId.trim()) {
        return [];
      }

      const enrollmentsCollection = collection(db, 'enrollments');
      const q = query(
        enrollmentsCollection, 
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
      console.error('CourseService: Error getting course enrollments:', error);
      throw new Error(error.message);
    }
  },

  async updateEnrollmentProgress(
    enrollmentId: string, 
    progress: number, 
    completedLessons: string[]
  ): Promise<void> {
    try {
      if (!enrollmentId || !enrollmentId.trim()) {
        throw new Error('Enrollment ID is required');
      }

      const enrollmentRef = doc(db, 'enrollments', enrollmentId);
      await updateDoc(enrollmentRef, {
        progress,
        completedLessons,
        lastAccessedAt: Timestamp.now()
      });

      console.log('CourseService: Enrollment progress updated:', enrollmentId);
    } catch (error: any) {
      console.error('CourseService: Error updating progress:', error);
      throw new Error(error.message);
    }
  },

  // ==================== CONTENT LIBRARY OPERATIONS ====================

  async addCourseToContentLibrary(courseId: string, studentId: string): Promise<void> {
    try {
      console.log('CourseService: Adding to library:', { courseId, studentId });
      
      const course = await this.getCourseById(courseId);
      if (!course) {
        throw new Error('Course not found');
      }

      // Add content from structure or lessons
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
            courseId: courseId,
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

      // Add main course entry
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
        courseId: courseId,
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
      console.log('CourseService: Added to library successfully');
    } catch (error: any) {
      console.error('CourseService: Error adding to library:', error);
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
      if (!studentId || !studentId.trim()) {
        return [];
      }

      const contentCollection = collection(db, 'studentContent');
      const q = query(
        contentCollection,
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
      console.error('CourseService: Error getting student content:', error);
      throw new Error(error.message);
    }
  },

  // ==================== SEARCH OPERATIONS ====================

  async searchCourses(searchTerm: string): Promise<Course[]> {
    try {
      if (!searchTerm || !searchTerm.trim()) {
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
      console.error('CourseService: Error searching courses:', error);
      throw new Error(error.message);
    }
  },

  // ==================== HELPER METHODS ====================

  async getAllEnrollments(): Promise<Enrollment[]> {
    try {
      const enrollmentsCollection = collection(db, 'enrollments');
      const snapshot = await getDocs(query(enrollmentsCollection, orderBy('enrolledAt', 'desc')));
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        enrolledAt: doc.data().enrolledAt?.toDate() || new Date(),
        lastAccessedAt: doc.data().lastAccessedAt?.toDate() || new Date(),
        paymentDate: doc.data().paymentDate?.toDate()
      })) as Enrollment[];
    } catch (error: any) {
      console.error('CourseService: Error getting all enrollments:', error);
      throw new Error(error.message);
    }
  }
};

export default courseService;
