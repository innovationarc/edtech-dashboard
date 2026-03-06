// src/services/studyPlanService.ts (ENHANCED - fully backwards compatible)
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
  setDoc,
  getDoc,
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
  isPersonal: boolean;
  studentId?: string;
  targetAudience: 'all' | 'specific_student' | 'course_students';
  targetStudentIds?: string[];
  targetCourseIds?: string[];
  eventType: 'class' | 'assignment' | 'exam' | 'study_session' | 'personal' | 'deadline';
  priority: 'low' | 'medium' | 'high';
  createdAt: Date;
  updatedAt?: Date;
  // New fields (optional for backwards compatibility)
  isAIGenerated?: boolean;
  aiReason?: string;
  aiTips?: string[];
  sessionType?: 'focus' | 'review' | 'practice' | 'break';
  completed?: boolean;
  completedAt?: Date;
  color?: string;
  reminderMinutes?: number;
  recurrence?: 'none' | 'daily' | 'weekly' | 'biweekly';
}

export interface StudyGoal {
  id: string;
  studentId: string;
  subject: string;
  targetDate: Date;
  hoursNeeded: number;
  hoursCompleted: number;
  difficulty: 'easy' | 'medium' | 'hard';
  currentProgress: number;
  isActive: boolean;
  createdAt: Date;
}

export interface PomodoroSession {
  id: string;
  studentId: string;
  subject: string;
  eventId?: string;
  startTime: Date;
  duration: number;
  completed: boolean;
  notes: string;
  createdAt: Date;
}

export interface StudyStreak {
  studentId: string;
  currentStreak: number;
  longestStreak: number;
  lastStudyDate: Date;
  totalSessions: number;
  totalMinutes: number;
}

export const studyPlanService = {
  // ─── EXISTING METHODS (unchanged) ────────────────────────────────────────

  async createEvent(event: Omit<StudyPlanEvent, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
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
      const q = query(eventsCollection, where('instructorId', '==', instructorId), where('isPersonal', '==', false));
      const querySnapshot = await getDocs(q);
      const events = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date.toDate(),
        startTime: doc.data().startTime || '',
        endTime: doc.data().endTime || '',
        createdAt: doc.data().createdAt.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
        completedAt: doc.data().completedAt?.toDate(),
      })) as StudyPlanEvent[];

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
        completedAt: doc.data().completedAt?.toDate(),
      })) as StudyPlanEvent[];

      let enrolledCourseIds: string[] = [];
      try {
        const enrollments = await courseService.getStudentEnrollments(studentId);
        enrolledCourseIds = enrollments.map((e) => e.courseId);
      } catch (error) {
        console.warn('Could not fetch enrollments:', error);
      }

      const studentEvents = allEvents.filter((event) => {
        if (event.isPersonal && event.studentId === studentId) return true;
        if (event.targetAudience === 'all') return true;
        if (event.targetAudience === 'specific_student' && event.targetStudentIds?.includes(studentId)) return true;
        if (event.targetAudience === 'course_students' && event.targetCourseIds?.some((id) => enrolledCourseIds.includes(id))) return true;
        return false;
      });

      return studentEvents.sort((a, b) => {
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

  async getAllStudents(): Promise<{ uid: string; name: string; email: string }[]> {
    try {
      const { userService } = await import('./userService');
      const allUsers = await userService.getAllUsers();
      return allUsers
        .filter((user) => user.role === 'student' && user.status === 'active')
        .map((user) => ({ uid: user.uid, name: user.name, email: user.email }));
    } catch (error: any) {
      throw new Error(error.message);
    }
  },

  async getAllCourses(): Promise<{ id: string; title: string; instructorName: string }[]> {
    try {
      const allCourses = await courseService.getAllCourses();
      return allCourses.map((course) => ({ id: course.id, title: course.title, instructorName: course.instructor }));
    } catch (error: any) {
      throw new Error(error.message);
    }
  },

  async updateEvent(id: string, updates: Partial<StudyPlanEvent>): Promise<void> {
    try {
      const eventRef = doc(db, 'studyPlanEvents', id);
      const updateData = { ...updates } as any;
      if (updateData.date) updateData.date = Timestamp.fromDate(updateData.date);
      if (updateData.completedAt) updateData.completedAt = Timestamp.fromDate(updateData.completedAt);
      await updateDoc(eventRef, { ...updateData, updatedAt: Timestamp.now() });
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

  // ─── NEW METHODS ──────────────────────────────────────────────────────────

  async markEventComplete(id: string, completed: boolean): Promise<void> {
    await studyPlanService.updateEvent(id, {
      completed,
      completedAt: completed ? new Date() : undefined,
    } as any);
  },

  async createBulkAIEvents(
    events: Omit<StudyPlanEvent, 'id' | 'createdAt' | 'updatedAt'>[],
    studentId: string
  ): Promise<string[]> {
    const ids: string[] = [];
    for (const event of events) {
      const id = await studyPlanService.createEvent({ ...event, studentId, isPersonal: true });
      ids.push(id);
    }
    return ids;
  },

  // ─── STUDY GOALS ─────────────────────────────────────────────────────────

  async createGoal(goal: Omit<StudyGoal, 'id' | 'createdAt'>): Promise<string> {
    const docRef = await addDoc(collection(db, 'studyGoals'), {
      ...goal,
      targetDate: Timestamp.fromDate(goal.targetDate),
      createdAt: Timestamp.now(),
    });
    return docRef.id;
  },

  async getGoalsForStudent(studentId: string): Promise<StudyGoal[]> {
    const q = query(collection(db, 'studyGoals'), where('studentId', '==', studentId), where('isActive', '==', true));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
      targetDate: d.data().targetDate.toDate(),
      createdAt: d.data().createdAt.toDate(),
    })) as StudyGoal[];
  },

  async updateGoal(id: string, updates: Partial<StudyGoal>): Promise<void> {
    const ref = doc(db, 'studyGoals', id);
    const data = { ...updates } as any;
    if (data.targetDate) data.targetDate = Timestamp.fromDate(data.targetDate);
    await updateDoc(ref, data);
  },

  async deleteGoal(id: string): Promise<void> {
    await deleteDoc(doc(db, 'studyGoals', id));
  },

  // ─── POMODORO SESSIONS ───────────────────────────────────────────────────

  async savePomodoroSession(session: Omit<PomodoroSession, 'id' | 'createdAt'>): Promise<string> {
    const docRef = await addDoc(collection(db, 'pomodoroSessions'), {
      ...session,
      startTime: Timestamp.fromDate(session.startTime),
      createdAt: Timestamp.now(),
    });
    // Update streak
    await studyPlanService.updateStreak(session.studentId, session.duration);
    return docRef.id;
  },

  async getPomodoroSessions(studentId: string, limit = 30): Promise<PomodoroSession[]> {
    const q = query(
      collection(db, 'pomodoroSessions'),
      where('studentId', '==', studentId),
      orderBy('startTime', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.slice(0, limit).map((d) => ({
      id: d.id,
      ...d.data(),
      startTime: d.data().startTime.toDate(),
      createdAt: d.data().createdAt.toDate(),
    })) as PomodoroSession[];
  },

  // ─── STREAKS ─────────────────────────────────────────────────────────────

  async updateStreak(studentId: string, minutesAdded: number): Promise<void> {
    const ref = doc(db, 'studyStreaks', studentId);
    const snap = await getDoc(ref);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (snap.exists()) {
      const data = snap.data() as StudyStreak;
      const lastDate = data.lastStudyDate instanceof Timestamp ? data.lastStudyDate.toDate() : new Date(data.lastStudyDate);
      lastDate.setHours(0, 0, 0, 0);
      const diffDays = Math.round((today.getTime() - lastDate.getTime()) / 86400000);
      const newStreak = diffDays === 1 ? data.currentStreak + 1 : diffDays === 0 ? data.currentStreak : 1;
      await updateDoc(ref, {
        currentStreak: newStreak,
        longestStreak: Math.max(data.longestStreak, newStreak),
        lastStudyDate: Timestamp.fromDate(today),
        totalSessions: (data.totalSessions || 0) + 1,
        totalMinutes: (data.totalMinutes || 0) + minutesAdded,
      });
    } else {
      await setDoc(ref, {
        studentId,
        currentStreak: 1,
        longestStreak: 1,
        lastStudyDate: Timestamp.fromDate(today),
        totalSessions: 1,
        totalMinutes: minutesAdded,
      });
    }
  },

  async getStreak(studentId: string): Promise<StudyStreak | null> {
    const snap = await getDoc(doc(db, 'studyStreaks', studentId));
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
      ...data,
      lastStudyDate: data.lastStudyDate instanceof Timestamp ? data.lastStudyDate.toDate() : new Date(data.lastStudyDate),
    } as StudyStreak;
  },
};
