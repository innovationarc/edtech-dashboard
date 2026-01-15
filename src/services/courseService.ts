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
  level: 'beginner' | 'intermediate' | 'advanced';
  category: string;
  tags: string[];
  thumbnail: string;
  thumbnailUrl?: string;
  previewVideo?: string;
  lessons: CourseLesson[];
  requirements: string[];
  whatYouWillLearn: string[];
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
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  },

  // Calculate total duration from lessons
  calculateTotalDuration(lessons: CourseLesson[]): string {
    if (!lessons || lessons.length === 0) return '0 hours';

    let totalMinutes = 0;

    lessons.forEach(lesson => {
      const duration = lesson.duration.toLowerCase();
      
      // Parse hours
      const hoursMatch = duration.match(/(\d+)\s*h/);
      if (hoursMatch) {
        totalMinutes += parseInt(hoursMatch[1]) * 60;
      }

      // Parse minutes
      const minutesMatch = duration.match(/(\d+)\s*m/);
      if (minutesMatch) {
        totalMinutes += parseInt(minutesMatch[1]);
      }
    });

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours === 0) {
      return `${minutes} minutes`;
    } else if (minutes === 0) {
      return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
    } else {
      return `${hours} ${hours === 1 ? 'hour' : 'hours'} ${minutes} min`;
    }
  },

  // Course CRUD operations
  async createCourse(course: Omit<Course, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      // Calculate duration if lessons exist
      const duration = course.lessons && course.lessons.length > 0 
        ? this.calculateTotalDuration(course.lessons)
        : '0 hours';

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
      const q = query(
        coursesCollection, 
        where('isPublished', '==', true),
        orderBy('createdAt', 'desc')
      );
      const coursesSnapshot = await getDocs(q);
      
      return coursesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt.toDate(),
        updatedAt: doc.data().updatedAt.toDate()
      })) as Course[];
    } catch (error: any) {
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
      
      // Recalculate duration if lessons are being updated
      if (updates.lessons) {
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

  // Add lesson to existing course
  async addLessonToCourse(courseId: string, lesson: Omit<CourseLesson, 'id' | 'order'>): Promise<void> {
    try {
      const course = await this.getCourseById(courseId);
      if (!course) {
        throw new Error('Course not found');
      }

      const newLesson: CourseLesson = {
        ...lesson,
        id: `lesson_${Date.now()}`,
        order: course.lessons.length + 1
      };

      const updatedLessons = [...course.lessons, newLesson];
      const newDuration = this.calculateTotalDuration(updatedLessons);

      await this.updateCourse(courseId, {
        lessons: updatedLessons,
        duration: newDuration
      });
    } catch (error: any) {
      throw new Error(error.message);
    }
  },

  // Update specific lesson in a course
  async updateCourseLesson(courseId: string, lessonId: string, updates: Partial<CourseLesson>): Promise<void> {
    try {
      const course = await this.getCourseById(courseId);
      if (!course) {
        throw new Error('Course not found');
      }

      const updatedLessons = course.lessons.map(lesson =>
        lesson.id === lessonId ? { ...lesson, ...updates } : lesson
      );

      const newDuration = this.calculateTotalDuration(updatedLessons);

      await this.updateCourse(courseId, {
        lessons: updatedLessons,
        duration: newDuration
      });
    } catch (error: any) {
      throw new Error(error.message);
    }
  },

  // Delete lesson from course
  async deleteCourseLesson(courseId: string, lessonId: string): Promise<void> {
    try {
      const course = await this.getCourseById(courseId);
      if (!course) {
        throw new Error('Course not found');
      }

      const updatedLessons = course.lessons
        .filter(lesson => lesson.id !== lessonId)
        .map((lesson, index) => ({ ...lesson, order: index + 1 }));

      const newDuration = this.calculateTotalDuration(updatedLessons);

      await this.updateCourse(courseId, {
        lessons: updatedLessons,
        duration: newDuration
      });
    } catch (error: any) {
      throw new Error(error.message);
    }
  },

  // Enrollment operations
  async enrollStudent(enrollment: Omit<Enrollment, 'id' | 'enrolledAt'>): Promise<string> {
    try {
      // Check if already enrolled
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
      
      // Update course student count
      const courseRef = doc(db, 'courses', enrollment.courseId);
      const courseDoc = await getDoc(courseRef);
      if (courseDoc.exists()) {
        const currentCount = courseDoc.data().studentCount || 0;
        await updateDoc(courseRef, {
          studentCount: currentCount + 1
        });
      }
      
      // Create content library entries for all course lessons
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

  // Add course content to student's content library
  async addCourseToContentLibrary(courseId: string, studentId: string): Promise<void> {
    try {
      console.log('Adding course to content library:', { courseId, studentId });
      
      const course = await this.getCourseById(courseId);
      if (!course) {
        console.error('Course not found:', courseId);
        return;
      }

      console.log('Course found:', course.title, 'with', course.lessons.length, 'lessons');

      // Create content entries for each lesson in the course
      for (const lesson of course.lessons) {
        const contentEntry = {
          title: `${course.title} - ${lesson.title}`,
          description: `Course lesson: ${lesson.title}`,
          type: lesson.type === 'video' ? 'lesson' : 
                lesson.type === 'text' ? 'note' : 
                lesson.type === 'quiz' ? 'mcq' : 'lesson',
          course: course.title,
          category: course.category,
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

      // Also add the main course as a content item
      const mainCourseEntry = {
        title: course.title,
        description: course.description,
        type: 'course',
        course: course.title,
        category: course.category,
        difficulty: course.level as 'beginner' | 'intermediate' | 'advanced',
        tags: [...course.tags, 'purchased-course', 'enrolled', 'full-course'],
        courseId: courseId,
        isFromCourse: true,
        accessLevel: 'full',
        totalLessons: course.lessons.length,
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

  // Get student's purchased course content
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

  // Review operations
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

  // Search and filter operations
  async searchCourses(searchTerm: string): Promise<Course[]> {
    try {
      const courses = await this.getPublishedCourses();
      return courses.filter(course => 
        course.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        course.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        course.instructor.toLowerCase().includes(searchTerm.toLowerCase()) ||
        course.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    } catch (error: any) {
      throw new Error(error.message);
    }
  },

  async getCoursesByCategory(category: string): Promise<Course[]> {
    try {
      const coursesCollection = collection(db, 'courses');
      const q = query(
        coursesCollection, 
        where('category', '==', category),
        where('isPublished', '==', true),
        orderBy('createdAt', 'desc')
      );
      const coursesSnapshot = await getDocs(q);
      
      return coursesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt.toDate(),
        updatedAt: doc.data().updatedAt.toDate()
      })) as Course[];
    } catch (error: any) {
      throw new Error(error.message);
    }
  },

  async getCoursesByLevel(level: 'beginner' | 'intermediate' | 'advanced'): Promise<Course[]> {
    try {
      const coursesCollection = collection(db, 'courses');
      const q = query(
        coursesCollection, 
        where('level', '==', level),
        where('isPublished', '==', true),
        orderBy('createdAt', 'desc')
      );
      const coursesSnapshot = await getDocs(q);
      
      return coursesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt.toDate(),
        updatedAt: doc.data().updatedAt.toDate()
      })) as Course[];
    } catch (error: any) {
      throw new Error(error.message);
    }
  }
};
