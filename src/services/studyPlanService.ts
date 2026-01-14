// src/services/studyPlanService.ts
import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { courseService } from './courseService';

export interface StudyPlanEvent {
  id: string;
  title: string;
  description: string;
  date: Date;
  startTime: string;
  endTime: string;
  course: string;
  instructorId: string;
  instructorName: string;
  isPersonal: boolean; // True if created by student for themselves
  studentId?: string; // Set if this is a personal event or assigned to specific student
  targetAudience: 'all' | 'specific_student' | 'course_students'; // Who this event is for
  targetStudentIds?: string[]; // Array of student IDs for specific targeting
  targetCourseIds?: string[]; // Array of course IDs for course-specific events
  eventType: 'class' | 'assignment' | 'exam' | 'study_session' | 'personal' | 'deadline';
  priority: 'low' | 'medium' | 'high';
  createdAt: Date;
  updatedAt?: Date;
}

export const studyPlanService = {
  async createEvent(
    event: Omit<StudyPlanEvent, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, 'studyPlanEvents'), {
        ...event,
        date: Timestamp.fromDate(event.date),
        createdAt: Timestamp.now(),
      });
      return docRef.id;
    } catch (error: any) {
      throw new Error(error.message);
    }
  },

  async getEventsByTeacher(instructorId: string): Promise<StudyPlanEvent[]> {
    try {
      const eventsCollection = collection(db, 'studyPlanEvents');
      const q = query(
        eventsCollection,
        where('instructorId', '==', instructorId),
        where('isPersonal', '==', false)
      );
      const querySnapshot = await getDocs(q);

      const events = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date.toDate(),
        startTime: doc.data().startTime || '',
        endTime: doc.data().endTime || '',
        createdAt: doc.data().createdAt.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
      })) as StudyPlanEvent[];

      // Sort by startTime in memory after fetching
      return events.sort((a, b) => {
        const dateA = a.date.getTime();
        const dateB = b.date.getTime();
        if (dateA !== dateB) return dateA - dateB;
        
        const timeA = parseInt((a.startTime || '00:00').replace(':', ''));
        const timeB = parseInt((b.startTime || '00:00').replace(':', ''));
        return timeA - timeB;
      });
    } catch (error: any) {
      throw new Error(error.message);
    }
  },

  async getEventsForStudent(studentId: string): Promise<StudyPlanEvent[]> {
    try {
      console.log('Getting events for student:', studentId);
      
      // Get all events and filter for this student
      const eventsCollection = collection(db, 'studyPlanEvents');
      const eventsSnapshot = await getDocs(query(eventsCollection, orderBy('date', 'asc')));
      
      const allEvents = eventsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date.toDate(),
        startTime: doc.data().startTime || '',
        endTime: doc.data().endTime || '',
        createdAt: doc.data().createdAt.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
      })) as StudyPlanEvent[];
      
      // Get student's enrolled courses
      let enrolledCourseIds: string[] = [];
      try {
        const enrollments = await courseService.getStudentEnrollments(studentId);
        enrolledCourseIds = enrollments.map(e => e.courseId);
      } catch (error) {
        console.warn('Could not fetch enrollments:', error);
      }
      
      // Filter events for this student
      const studentEvents = allEvents.filter(event => {
        // Personal events created by this student
        if (event.isPersonal && event.studentId === studentId) {
          return true;
        }
        
        // Events targeting all students
        if (event.targetAudience === 'all') {
          return true;
        }
        
        // Events targeting this specific student
        if (event.targetAudience === 'specific_student' && 
            event.targetStudentIds?.includes(studentId)) {
          return true;
        }
        
        // Events targeting students in courses this student is enrolled in
        if (event.targetAudience === 'course_students' && 
            event.targetCourseIds?.some(courseId => enrolledCourseIds.includes(courseId))) {
          return true;
        }
        
        return false;
      });
      
      // Sort by date and time
      studentEvents.sort((a, b) => {
        const dateA = a.date.getTime();
        const dateB = b.date.getTime();
        if (dateA !== dateB) return dateA - dateB;
        
        const timeA = parseInt((a.startTime || '00:00').replace(':', ''));
        const timeB = parseInt((b.startTime || '00:00').replace(':', ''));
        return timeA - timeB;
      });
      
      console.log('Total events for student:', studentEvents.length);
      return studentEvents;
    } catch (error: any) {
      console.error('Error getting events for student:', error);
      throw new Error(error.message);
    }
  },

  // Get all students (for admin/teacher to assign events)
  async getAllStudents(): Promise<{ uid: string; name: string; email: string }[]> {
    try {
      const { userService } = await import('./userService');
      const allUsers = await userService.getAllUsers();
      return allUsers
        .filter(user => user.role === 'student' && user.status === 'active')
        .map(user => ({
          uid: user.uid,
          name: user.name,
          email: user.email
        }));
    } catch (error: any) {
      throw new Error(error.message);
    }
  },

  // Get all courses (for targeting course students)
  async getAllCourses(): Promise<{ id: string; title: string; instructorName: string }[]> {
    try {
      const allCourses = await courseService.getAllCourses();
      return allCourses.map(course => ({
        id: course.id,
        title: course.title,
        instructorName: course.instructor
      }));
    } catch (error: any) {
      throw new Error(error.message);
    }
  },

  async updateEvent(id: string, updates: Partial<StudyPlanEvent>): Promise<void> {
    try {
      const eventRef = doc(db, 'studyPlanEvents', id);
      const updateData = { ...updates };

      if (updateData.date) {
        updateData.date = Timestamp.fromDate(updateData.date) as any;
      }

      await updateDoc(eventRef, {
        ...updateData,
        updatedAt: Timestamp.now(),
      });
    } catch (error: any) {
      throw new Error(error.message);
    }
  },

  async deleteEvent(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'studyPlanEvents', id));
    } catch (error: any) {
      throw new Error(error.message);
    }
  },
};