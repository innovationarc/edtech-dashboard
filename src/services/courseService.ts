// src/services/courseService.ts - UPDATED VERSION
import { 
  collection, 
  doc, 
  getDocs, 
  getDoc,
  addDoc, 
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
import { gamificationService } from './gamificationService';

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
  
  // NEW FIELDS
  validity?: string; // ISO date string
  previousStudentDiscount?: number; // Percentage
  extraDiscount?: number; // Amount in BDT
  extraDiscountValidUntil?: string; // ISO date string
  routineFiles?: Array<{
    id: string;
    url: string;
    fileName: string;
    category: string;
  }>;
  contentStructure?: ContentNode[];
  
  hasQnA: boolean;
  hasStudyPlanner: boolean;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface Enrollment {
  id: string;
  courseId: string;
  studentId: string;
  studentName: string;
  enrolledAt: Date;
  progress: number;
  completedLessons: string[];
  lastAccessedAt: Date;
  certificateIssued?: boolean;
}

interface CourseReview {
  id: string;
  courseId: string;
  studentId: string;
  studentName: string;
  rating: number;
  comment: string;
  createdAt: Date;
}

interface CourseAnalytics {
  totalEnrollments: number;
  activeStudents: number;
  completionRate: number;
  averageProgress: number;
  revenue: number;
  enrollmentsByDate: Array<{ date: string; count: number }>;
  topPerformers: Array<{ studentName: string; progress: number }>;
}

export const courseService = {
  // Upload file to Firebase Storage
  async uploadFile(file: File, path: string): Promise<{ url: string; fileName: string }> {
    try {
      const timestamp = Date.now();
      const fileName = `${timestamp}_${file.name}`;
      const storageRef = ref(storage, `${path}/${fileName}`);
      
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      
      return { url, fileName };
    } catch (error: any) {
      throw new Error(`Failed to upload file: ${error.message}`);
    }
  },

  // Delete file from Firebase Storage
  async deleteFile(fileName: string, path: string): Promise<void> {
    try {
      const storageRef = ref(storage, `${path}/${fileName}`);
      await deleteObject(storageRef);
    } catch (error: any) {
      console.warn(`Failed to delete file: ${error.message}`);
    }
  },

  // Calculate total duration from content structure
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

  // Calculate total duration from lessons (legacy)
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

  // Course CRUD operations
  async createCourse(course: Omit<Course, 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      // Calculate duration from content structure or lessons
      let duration = '00:00';
      if (course.contentStructure && course.contentStructure.length > 0) {
        const totalMinutes = this.calculateTotalDurationFromStructure(course.contentStructure);
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        duration = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      } else if (course.lessons && course.lessons.length > 0) {
        duration = this.calculateTotalDuration(course.lessons);
      }

      const docRef = await addDoc(collection(db, 'courses'), {
        ...course,
        duration,
        rating: course.rating || 0,
        reviewCount: course.reviewCount || 0,
        studentCount: course.studentCount || 0,
        hasQnA: course.hasQnA || false,
        hasStudyPlanner: course.hasStudyPlanner || false,
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
      });
      return docRef.id;
    } catch (error: any) {
      throw new Error(error.message);
    }
  },

  async getAllCourses(): Promise<Course[]> {
    try {
      const coursesCollection = collection(db, 'courses');
      const coursesSnapshot = await getDocs(query(coursesCollection, orderBy('createdAt', 'desc')));
      
      return coursesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        class: doc.data().class || '',
        subjects: doc.data().subjects || [],
        contentStructure: doc.data().contentStructure || [],
        routineFiles: doc.data().routineFiles || [],
        createdAt: doc.data().createdAt.toDate(),
        updatedAt: doc.data().updatedAt.toDate()
      })) as Course[];
    } catch (error: any) {
      throw new Error(error.message);
    }
  },

  async getPublishedCourses(): Promise<Course[]> {
    try {
      const coursesCollection = collection(db, 'courses');
      
      try {
        const q = query(
          coursesCollection, 
          where('isPublished', '==', true),
          orderBy('createdAt', 'desc')
        );
        const coursesSnapshot = await getDocs(q);
        
        if (coursesSnapshot.docs.length > 0) {
          return coursesSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            class: doc.data().class || '',
            subjects: doc.data().subjects || [],
            contentStructure: doc.data().contentStructure || [],
            routineFiles: doc.data().routineFiles || [],
            createdAt: doc.data().createdAt.toDate(),
            updatedAt: doc.data().updatedAt.toDate()
          })) as Course[];
        }
      } catch (indexError) {
        console.warn('Firestore index may not exist, fetching all courses and filtering...');
      }
      
      const allCoursesSnapshot = await getDocs(coursesCollection);
      const allCourses = allCoursesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        class: doc.data().class || '',
        subjects: doc.data().subjects || [],
        contentStructure: doc.data().contentStructure || [],
        routineFiles: doc.data().routineFiles || [],
        createdAt: doc.data().createdAt.toDate(),
        updatedAt: doc.data().updatedAt.toDate()
      })) as Course[];
      
      const publishedCourses = allCourses.filter(course => course.isPublished === true);
      
      if (publishedCourses.length === 0) {
        console.log('No published courses found, returning all courses');
        return allCourses.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      }
      
      return publishedCourses.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } catch (error: any) {
      console.error('Error fetching published courses:', error);
      throw new Error(error.message);
    }
  },

  async getCourseById(courseId: string): Promise<Course | null> {
    try {
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
        createdAt: courseData.createdAt.toDate(),
        updatedAt: courseData.updatedAt.toDate()
      } as Course;
    } catch (error: any) {
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
        createdAt: doc.data().createdAt.toDate(),
        updatedAt: doc.data().updatedAt.toDate()
      })) as Course[];
    } catch (error: any) {
      throw new Error(error.message);
    }
  },

  async updateCourse(courseId: string, updates: Partial<Course>): Promise<void> {
    try {
      const courseRef = doc(db, 'courses', courseId);
      
      // Recalculate duration if content structure or lessons are being updated
      if (updates.contentStructure) {
        const totalMinutes = this.calculateTotalDurationFromStructure(updates.contentStructure);
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        updates.duration = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      } else if (updates.lessons) {
        updates.duration = this.calculateTotalDuration(updates.lessons);
      }

      await updateDoc(courseRef, {
        ...updates,
        updatedAt: Timestamp.now()
      });
    } catch (error: any) {
      throw new Error(error.message);
    }
  },

  async deleteCourse(courseId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'courses', courseId));
    } catch (error: any) {
      throw new Error(error.message);
    }
  },

  // Analytics
  async getCourseAnalytics(courseId: string): Promise<CourseAnalytics> {
    try {
      const enrollments = await this.getCourseEnrollments(courseId);
      const course = await this.getCourseById(courseId);
      
      const totalEnrollments = enrollments.length;
      const activeStudents = enrollments.filter(e => e.progress > 0 && e.progress < 100).length;
      const completedStudents = enrollments.filter(e => e.progress === 100).length;
      const completionRate = totalEnrollments > 0 ? (completedStudents / totalEnrollments) * 100 : 0;
      const averageProgress = totalEnrollments > 0 
        ? enrollments.reduce((sum, e) => sum + e.progress, 0) / totalEnrollments 
        : 0;
      const revenue = totalEnrollments * (course?.price || 0);

      // Group enrollments by date
      const enrollmentsByDateMap = new Map<string, number>();
      enrollments.forEach(enrollment => {
        const dateKey = enrollment.enrolledAt.toISOString().split('T')[0];
        enrollmentsByDateMap.set(dateKey, (enrollmentsByDateMap.get(dateKey) || 0) + 1);
      });
      const enrollmentsByDate = Array.from(enrollmentsByDateMap.entries())
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // Top performers
      const topPerformers = enrollments
        .sort((a, b) => b.progress - a.progress)
        .slice(0, 10)
        .map(e => ({
          studentName: e.studentName,
          progress: e.progress
        }));

      return {
        totalEnrollments,
        activeStudents,
        completionRate,
        averageProgress,
        revenue,
        enrollmentsByDate,
        topPerformers
      };
    } catch (error: any) {
      throw new Error(error.message);
    }
  },

  // Enrollment operations (existing code remains the same)
  async enrollStudent(enrollment: Omit<Enrollment, 'id' | 'enrolledAt'>): Promise<string> {
    try {
      const enrollmentsCollection = collection(db, 'enrollments');
      const q = query(
        enrollmentsCollection,
        where('courseId', '==', enrollment.courseId),
        where('studentId', '==', enrollment.studentId)
      );
      const existingEnrollments = await getDocs(q);

      if (!existingEnrollments.empty) {
        throw new Error('Student is already enrolled in this course');
      }

      const docRef = await addDoc(collection(db, 'enrollments'), {
        ...enrollment,
        enrolledAt: Timestamp.now()
      });
      
      const courseRef = doc(db, 'courses', enrollment.courseId);
      const courseDoc = await getDoc(courseRef);
      if (courseDoc.exists()) {
        const currentCount = courseDoc.data().studentCount || 0;
        await updateDoc(courseRef, {
          studentCount: currentCount + 1
        });
      }
      
      await this.addCourseToContentLibrary(enrollment.courseId, enrollment.studentId);
      
      return docRef.id;
    } catch (error: any) {
      throw new Error(error.message);
    }
  },

  async getAllEnrollments(): Promise<Enrollment[]> {
    try {
      const enrollmentsCollection = collection(db, 'enrollments');
      const enrollmentsSnapshot = await getDocs(query(enrollmentsCollection, orderBy('enrolledAt', 'desc')));
      
      return enrollmentsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        enrolledAt: doc.data().enrolledAt.toDate(),
        lastAccessedAt: doc.data().lastAccessedAt.toDate()
      })) as Enrollment[];
    } catch (error: any) {
      throw new Error(error.message);
    }
  },

  async addCourseToContentLibrary(courseId: string, studentId: string): Promise<void> {
    try {
      console.log('Adding course to content library:', { courseId, studentId });
      
      const course = await this.getCourseById(courseId);
      if (!course) {
        console.error('Course not found:', courseId);
        return;
      }

      console.log('Course found:', course.title);

      // Create content entries based on content structure or lessons
      if (course.contentStructure && course.contentStructure.length > 0) {
        // Use new content structure
        await this.addContentStructureToLibrary(course, studentId, course.contentStructure);
      } else if (course.lessons && course.lessons.length > 0) {
        // Fallback to legacy lessons
        for (const lesson of course.lessons) {
          const contentEntry = {
            title: `${course.title} - ${lesson.title}`,
            description: `Course lesson: ${lesson.title}`,
            type: lesson.type === 'video' ? 'lesson' : 
                  lesson.type === 'text' ? 'note' : 
                  lesson.type === 'quiz' ? 'mcq' : 'lesson',
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
            accessLevel: lesson.isPreview ? 'preview' : 'full',
            instructor: course.instructor,
            videoUrl: lesson.videoUrl,
            pdfUrl: lesson.pdfUrl,
            content: lesson.content,
            topics: lesson.topics || [],
            createdBy: course.instructorId,
            enrolledStudentId: studentId,
            createdAt: Timestamp.now()
          };

          console.log('Creating lesson content entry:', contentEntry.title);
          await addDoc(collection(db, 'studentContent'), contentEntry);
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
        hasQnA: course.hasQnA,
        hasStudyPlanner: course.hasStudyPlanner,
        createdBy: course.instructorId,
        enrolledStudentId: studentId,
        createdAt: Timestamp.now()
      };

      console.log('Creating main course entry:', mainCourseEntry.title);
      await addDoc(collection(db, 'studentContent'), mainCourseEntry);
      
      console.log('Successfully added course content to library');
    } catch (error: any) {
      console.error('Error adding course to content library:', error);
      throw new Error(error.message);
    }
  },

  async addContentStructureToLibrary(course: Course, studentId: string, nodes: ContentNode[]): Promise<void> {
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

        await addDoc(collection(db, 'studentContent'), contentEntry);
      }

      if (node.children && node.children.length > 0) {
        await this.addContentStructureToLibrary(course, studentId, node.children);
      }
    }
  },

  async getStudentCourseContent(studentId: string): Promise<any[]> {
    try {
      const contentCollection = collection(db, 'studentContent');
      const q = query(
        contentCollection,
        where('enrolledStudentId', '==', studentId),
        orderBy('createdAt', 'desc')
      );
      const contentSnapshot = await getDocs(q);
      
      return contentSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt.toDate()
      }));
    } catch (error: any) {
      throw new Error(error.message);
    }
  },

  async getStudentEnrollments(studentId: string): Promise<Enrollment[]> {
    try {
      const enrollmentsCollection = collection(db, 'enrollments');
      const q = query(
        enrollmentsCollection, 
        where('studentId', '==', studentId)
      );
      const enrollmentsSnapshot = await getDocs(q);
      
      const enrollments = enrollmentsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        enrolledAt: doc.data().enrolledAt.toDate(),
        lastAccessedAt: doc.data().lastAccessedAt.toDate()
      })) as Enrollment[];
      
      return enrollments.sort((a, b) => b.enrolledAt.getTime() - a.enrolledAt.getTime());
    } catch (error: any) {
      throw new Error(error.message);
    }
  },

  async getCourseEnrollments(courseId: string): Promise<Enrollment[]> {
    try {
      const enrollmentsCollection = collection(db, 'enrollments');
      const q = query(
        enrollmentsCollection, 
        where('courseId', '==', courseId),
        orderBy('enrolledAt', 'desc')
      );
      const enrollmentsSnapshot = await getDocs(q);
      
      return enrollmentsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        enrolledAt: doc.data().enrolledAt.toDate(),
        lastAccessedAt: doc.data().lastAccessedAt.toDate()
      })) as Enrollment[];
    } catch (error: any) {
      throw new Error(error.message);
    }
  },

  async updateEnrollmentProgress(
    enrollmentId: string, 
    progress: number, 
    completedLessons: string[]
  ): Promise<void> {
    try {
      const enrollmentRef = doc(db, 'enrollments', enrollmentId);
      const enrollmentDoc = await getDoc(enrollmentRef);
      
      if (!enrollmentDoc.exists()) {
        throw new Error('Enrollment not found');
      }
      
      const enrollmentData = enrollmentDoc.data();
      const wasCompleted = enrollmentData.progress === 100;
      const isNowCompleted = progress === 100;
      
      await updateDoc(enrollmentRef, {
        progress,
        completedLessons,
        lastAccessedAt: Timestamp.now()
      });
      
      if (!wasCompleted && isNowCompleted) {
        try {
          await gamificationService.recordActivity(enrollmentData.studentId, 'course_completed', {
            courseId: enrollmentData.courseId,
            progress: progress
          });
        } catch (gamificationError) {
          console.warn('Failed to record gamification activity:', gamificationError);
        }
      }
    } catch (error: any) {
      throw new Error(error.message);
    }
  },

  // Review operations (existing code remains the same)
  async addCourseReview(review: Omit<CourseReview, 'id' | 'createdAt'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, 'courseReviews'), {
        ...review,
        createdAt: Timestamp.now()
      });
      
      await this.updateCourseRating(review.courseId);
      
      return docRef.id;
    } catch (error: any) {
      throw new Error(error.message);
    }
  },

  async getCourseReviews(courseId: string): Promise<CourseReview[]> {
    try {
      const reviewsCollection = collection(db, 'courseReviews');
      const q = query(
        reviewsCollection, 
        where('courseId', '==', courseId),
        orderBy('createdAt', 'desc')
      );
      const reviewsSnapshot = await getDocs(q);
      
      return reviewsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt.toDate()
      })) as CourseReview[];
    } catch (error: any) {
      throw new Error(error.message);
    }
  },

  async updateCourseRating(courseId: string): Promise<void> {
    try {
      const reviews = await this.getCourseReviews(courseId);
      
      if (reviews.length === 0) return;
      
      const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
      const averageRating = totalRating / reviews.length;
      
      const courseRef = doc(db, 'courses', courseId);
      await updateDoc(courseRef, {
        rating: Math.round(averageRating * 10) / 10,
        reviewCount: reviews.length
      });
    } catch (error: any) {
      throw new Error(error.message);
    }
  },

  // Search operations (existing code remains the same)
  async searchCourses(searchTerm: string): Promise<Course[]> {
    try {
      const courses = await this.getPublishedCourses();
      return courses.filter(course => 
        course.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        course.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        course.instructor.toLowerCase().includes(searchTerm.toLowerCase()) ||
        course.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase())) ||
        course.subjects.some(subject => subject.toLowerCase().includes(searchTerm.toLowerCase())) ||
        course.class.toLowerCase().includes(searchTerm.toLowerCase()) ||
        course.category.toLowerCase().includes(searchTerm.toLowerCase())
      );
    } catch (error: any) {
      throw new Error(error.message);
    }
  }
};
