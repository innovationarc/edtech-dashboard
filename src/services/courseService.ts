// src/services/courseService.ts - FIXED VERSION
import { 
  collection, 
  doc, 
  getDocs, 
  getDoc,
  setDoc, // Changed from addDoc to setDoc for custom IDs
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
  previousStudentDiscount?: number; // Amount in BDT
  extraDiscount?: number; // Amount in BDT
  extraDiscountValidUntil?: string; // ISO date string
  routineFiles?: Array<{
    id: string;
    url: string;
    fileName: string;
    category: string;
  }>;
  contentStructure?: ContentNode[];
  
  // Special Features
  hasAiQnA: boolean;
  hasHumanQnA: boolean;
  hasStudyPlanner: boolean;
  
  // Legacy field for backward compatibility
  hasQnA: boolean;
  
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
      // FIXED: Validate that course.id is provided
      if (!course.id || !course.id.trim()) {
        throw new Error('Course ID is required');
      }

      // FIXED: Check if course with this ID already exists
      const existingCourse = await this.getCourseById(course.id);
      if (existingCourse) {
        throw new Error(`A course with ID "${course.id}" already exists. Please use a different ID.`);
      }

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

      // Prepare data object - only include fields that are not undefined
      const courseData: any = {
        ...course,
        duration,
        rating: course.rating || 0,
        reviewCount: course.reviewCount || 0,
        studentCount: course.studentCount || 0,
        hasAiQnA: course.hasAiQnA || false,
        hasHumanQnA: course.hasHumanQnA || false,
        hasStudyPlanner: course.hasStudyPlanner || false,
        hasQnA: course.hasQnA || false, // Legacy field
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

      // Only add validity and extraDiscountValidUntil if they are provided
      if (course.validity !== undefined) {
        courseData.validity = course.validity;
      }
      if (course.extraDiscountValidUntil !== undefined) {
        courseData.extraDiscountValidUntil = course.extraDiscountValidUntil;
      }

      // FIXED: Use setDoc with custom ID instead of addDoc
      const courseRef = doc(db, 'courses', course.id);
      await setDoc(courseRef, courseData);
      
      console.log(`Course created successfully with ID: ${course.id}`);
      return course.id;
    } catch (error: any) {
      console.error('Error creating course:', error);
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
        hasAiQnA: doc.data().hasAiQnA || false,
        hasHumanQnA: doc.data().hasHumanQnA || false,
        hasStudyPlanner: doc.data().hasStudyPlanner || false,
        hasQnA: doc.data().hasQnA || false,
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date()
      })) as Course[];
    } catch (error: any) {
      console.error('Error getting all courses:', error);
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
            hasAiQnA: doc.data().hasAiQnA || false,
            hasHumanQnA: doc.data().hasHumanQnA || false,
            hasStudyPlanner: doc.data().hasStudyPlanner || false,
            hasQnA: doc.data().hasQnA || false,
            createdAt: doc.data().createdAt?.toDate() || new Date(),
            updatedAt: doc.data().updatedAt?.toDate() || new Date()
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
        hasAiQnA: doc.data().hasAiQnA || false,
        hasHumanQnA: doc.data().hasHumanQnA || false,
        hasStudyPlanner: doc.data().hasStudyPlanner || false,
        hasQnA: doc.data().hasQnA || false,
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date()
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
      // FIXED: Better error handling and logging
      if (!courseId || !courseId.trim()) {
        console.warn('getCourseById called with empty courseId');
        return null;
      }

      const courseDoc = await getDoc(doc(db, 'courses', courseId));
      
      if (!courseDoc.exists()) {
        console.log(`Course with ID ${courseId} does not exist`);
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
      console.error(`Error getting course by ID ${courseId}:`, error);
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
      console.error('Error getting courses by instructor:', error);
      throw new Error(error.message);
    }
  },

  async updateCourse(courseId: string, updates: Partial<Course>): Promise<void> {
    try {
      // FIXED: Validate courseId
      if (!courseId || !courseId.trim()) {
        throw new Error('Course ID is required for update');
      }

      // FIXED: Check if course exists before updating
      const courseRef = doc(db, 'courses', courseId);
      const courseDoc = await getDoc(courseRef);
      
      if (!courseDoc.exists()) {
        throw new Error(`Course with ID "${courseId}" does not exist. Cannot update.`);
      }

      console.log(`Updating course: ${courseId}`);
      
      // Recalculate duration if content structure or lessons are being updated
      if (updates.contentStructure) {
        const totalMinutes = this.calculateTotalDurationFromStructure(updates.contentStructure);
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        updates.duration = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      } else if (updates.lessons) {
        updates.duration = this.calculateTotalDuration(updates.lessons);
      }

      // Prepare update data - only include fields that are not undefined
      const updateData: any = {
        ...updates,
        updatedAt: Timestamp.now()
      };

      // Remove undefined fields and the 'id' field (it shouldn't be updated)
      Object.keys(updateData).forEach(key => {
        if (updateData[key] === undefined || key === 'id' || key === 'createdAt') {
          delete updateData[key];
        }
      });

      await updateDoc(courseRef, updateData);
      console.log(`Course ${courseId} updated successfully`);
    } catch (error: any) {
      console.error(`Error updating course ${courseId}:`, error);
      throw new Error(error.message);
    }
  },

  async deleteCourse(courseId: string): Promise<void> {
    try {
      // FIXED: Validate courseId
      if (!courseId || !courseId.trim()) {
        throw new Error('Course ID is required for deletion');
      }

      console.log(`Attempting to delete course: ${courseId}`);

      // FIXED: Check if course exists before deleting
      const courseRef = doc(db, 'courses', courseId);
      const courseDoc = await getDoc(courseRef);
      
      if (!courseDoc.exists()) {
        throw new Error(`Course with ID "${courseId}" does not exist. Cannot delete.`);
      }

      const courseData = courseDoc.data();
      
      // Delete associated files from storage if they exist
      if (courseData.thumbnail) {
        try {
          const thumbnailPath = courseData.thumbnail.split('/').pop();
          if (thumbnailPath) {
            await this.deleteFile(thumbnailPath, 'course_thumbnails');
          }
        } catch (error) {
          console.warn('Failed to delete thumbnail:', error);
        }
      }

      // Delete routine files from storage
      if (courseData.routineFiles && Array.isArray(courseData.routineFiles)) {
        for (const file of courseData.routineFiles) {
          try {
            const fileName = file.url.split('/').pop();
            if (fileName) {
              await this.deleteFile(fileName, 'course_routines');
            }
          } catch (error) {
            console.warn('Failed to delete routine file:', error);
          }
        }
      }

      // Delete all enrollments for this course
      try {
        const enrollmentsCollection = collection(db, 'enrollments');
        const enrollmentsQuery = query(enrollmentsCollection, where('courseId', '==', courseId));
        const enrollmentsSnapshot = await getDocs(enrollmentsQuery);
        
        const deletePromises = enrollmentsSnapshot.docs.map(enrollmentDoc => 
          deleteDoc(doc(db, 'enrollments', enrollmentDoc.id))
        );
        await Promise.all(deletePromises);
        console.log(`Deleted ${enrollmentsSnapshot.docs.length} enrollments for course ${courseId}`);
      } catch (error) {
        console.warn('Failed to delete enrollments:', error);
      }

      // Delete all reviews for this course
      try {
        const reviewsCollection = collection(db, 'courseReviews');
        const reviewsQuery = query(reviewsCollection, where('courseId', '==', courseId));
        const reviewsSnapshot = await getDocs(reviewsQuery);
        
        const deletePromises = reviewsSnapshot.docs.map(reviewDoc => 
          deleteDoc(doc(db, 'courseReviews', reviewDoc.id))
        );
        await Promise.all(deletePromises);
        console.log(`Deleted ${reviewsSnapshot.docs.length} reviews for course ${courseId}`);
      } catch (error) {
        console.warn('Failed to delete reviews:', error);
      }

      // Delete all student content entries for this course
      try {
        const studentContentCollection = collection(db, 'studentContent');
        const contentQuery = query(studentContentCollection, where('courseId', '==', courseId));
        const contentSnapshot = await getDocs(contentQuery);
        
        const deletePromises = contentSnapshot.docs.map(contentDoc => 
          deleteDoc(doc(db, 'studentContent', contentDoc.id))
        );
        await Promise.all(deletePromises);
        console.log(`Deleted ${contentSnapshot.docs.length} student content entries for course ${courseId}`);
      } catch (error) {
        console.warn('Failed to delete student content:', error);
      }

      // Finally, delete the course document
      await deleteDoc(courseRef);
      console.log(`Course ${courseId} deleted successfully`);
    } catch (error: any) {
      console.error(`Error deleting course ${courseId}:`, error);
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
      console.error('Error getting course analytics:', error);
      throw new Error(error.message);
    }
  },

  // Enrollment operations
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

      const enrollmentData = {
        ...enrollment,
        enrolledAt: Timestamp.now(),
        lastAccessedAt: Timestamp.now()
      };

      const docRef = await setDoc(doc(enrollmentsCollection), enrollmentData);
      
      const courseRef = doc(db, 'courses', enrollment.courseId);
      const courseDoc = await getDoc(courseRef);
      if (courseDoc.exists()) {
        const currentCount = courseDoc.data().studentCount || 0;
        await updateDoc(courseRef, {
          studentCount: currentCount + 1
        });
      }
      
      await this.addCourseToContentLibrary(enrollment.courseId, enrollment.studentId);
      
      return enrollment.courseId; // Return a stable ID
    } catch (error: any) {
      console.error('Error enrolling student:', error);
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
        enrolledAt: doc.data().enrolledAt?.toDate() || new Date(),
        lastAccessedAt: doc.data().lastAccessedAt?.toDate() || new Date()
      })) as Enrollment[];
    } catch (error: any) {
      console.error('Error getting all enrollments:', error);
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
        hasQnA: course.hasQnA,
        createdBy: course.instructorId,
        enrolledStudentId: studentId,
        createdAt: Timestamp.now()
      };

      console.log('Creating main course entry:', mainCourseEntry.title);
      await setDoc(doc(collection(db, 'studentContent')), mainCourseEntry);
      
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

        await setDoc(doc(collection(db, 'studentContent')), contentEntry);
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
        createdAt: doc.data().createdAt?.toDate() || new Date()
      }));
    } catch (error: any) {
      console.error('Error getting student course content:', error);
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
        enrolledAt: doc.data().enrolledAt?.toDate() || new Date(),
        lastAccessedAt: doc.data().lastAccessedAt?.toDate() || new Date()
      })) as Enrollment[];
      
      return enrollments.sort((a, b) => b.enrolledAt.getTime() - a.enrolledAt.getTime());
    } catch (error: any) {
      console.error('Error getting student enrollments:', error);
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
        enrolledAt: doc.data().enrolledAt?.toDate() || new Date(),
        lastAccessedAt: doc.data().lastAccessedAt?.toDate() || new Date()
      })) as Enrollment[];
    } catch (error: any) {
      console.error('Error getting course enrollments:', error);
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
      console.error('Error updating enrollment progress:', error);
      throw new Error(error.message);
    }
  },

  // Review operations
  async addCourseReview(review: Omit<CourseReview, 'id' | 'createdAt'>): Promise<string> {
    try {
      const reviewData = {
        ...review,
        createdAt: Timestamp.now()
      };
      
      const docRef = doc(collection(db, 'courseReviews'));
      await setDoc(docRef, reviewData);
      
      await this.updateCourseRating(review.courseId);
      
      return docRef.id;
    } catch (error: any) {
      console.error('Error adding course review:', error);
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
        createdAt: doc.data().createdAt?.toDate() || new Date()
      })) as CourseReview[];
    } catch (error: any) {
      console.error('Error getting course reviews:', error);
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
      const courseDoc = await getDoc(courseRef);
      
      if (!courseDoc.exists()) {
        console.warn(`Cannot update rating: Course ${courseId} does not exist`);
        return;
      }
      
      await updateDoc(courseRef, {
        rating: Math.round(averageRating * 10) / 10,
        reviewCount: reviews.length
      });
    } catch (error: any) {
      console.error('Error updating course rating:', error);
      throw new Error(error.message);
    }
  },

  // Search operations
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
      console.error('Error searching courses:', error);
      throw new Error(error.message);
    }
  }
};
