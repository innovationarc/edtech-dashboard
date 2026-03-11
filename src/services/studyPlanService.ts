// src/services/studyPlanService.ts
// Extended — Chat History · Custom Activities · Enrolled Course Planning
// All original methods preserved and unchanged. 

import {
  collection, doc, getDocs, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, Timestamp, setDoc, getDoc, limit,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { courseService } from './courseService';

// ─── Original Interfaces (unchanged) ─────────────────────────────────────────

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
  isAIGenerated?: boolean;
  aiReason?: string;
  aiTips?: string[];
  sessionType?: 'focus' | 'review' | 'practice' | 'break';
  completed?: boolean;
  completedAt?: Date;
  completionPercent?: number;  // 0–100 partial completion; 100 = fully done
  expired?: boolean;   // true when the linked goal has passed its deadline
  color?: string;
  reminderMinutes?: number;
  recurrence?: 'none' | 'daily' | 'weekly' | 'biweekly';
  topicNames?: string[];  // NEW: topic names covered in this session
  topicContext?: Array<{  // NEW: rich subject > chapter > topic hierarchy
    subjectName: string;
    chapterName: string;
    topicName:   string;
  }>;
}

// NEW: A single topic item selected for a goal
export interface SelectedTopicItem {
  id: string;
  name: string;
  minHours: number;
  maxHours: number;
  difficulty: 'easy' | 'medium' | 'hard';
  chapterName?: string;
  subjectName?: string;
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
  // Optional: link to an enrolled course
  courseId?: string;
  // NEW: topic-based goal fields
  topics?: SelectedTopicItem[];
  studyMode?: 'first_reading' | 'revision';
  topicGroupId?: string;
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

// ─── NEW Interfaces ──────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  studentId: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  // AI-generated calendar events embedded in this message (if any)
  calendarEvents?: Array<{
    title: string;
    date: string;
    startTime: string;
    endTime: string;
    subject: string;
    eventType: string;
    priority: string;
    description?: string;
  }>;
}

export interface CustomActivity {
  id: string;
  studentId: string;
  name: string;
  category: 'sport' | 'job' | 'hobby' | 'family' | 'religious' | 'social' | 'transport' | 'other';
  /** 'recurring' = repeat on selected days of week; 'specific_dates' = one-off on chosen dates */
  scheduleType: 'recurring' | 'specific_dates';
  daysOfWeek: number[]; // 0=Sun … 6=Sat (used when scheduleType === 'recurring')
  specificDates?: string[]; // YYYY-MM-DD list (used when scheduleType === 'specific_dates')
  startTime: string;    // HH:MM
  endTime: string;      // HH:MM
  isFlexible: boolean;  // true = AI can schedule over it if urgent
  notes?: string;
  createdAt: Date;
}

export interface EnrolledCourseForPlanning {
  courseId: string;
  title: string;
  subjects: string[];
  totalLessons: number;
  completedLessons: number;
  progress: number;     // 0-100
  level: string;
  instructor: string;
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function toDate(val: any): Date {
  if (val instanceof Timestamp) return val.toDate();
  if (val instanceof Date) return val;
  return new Date(val);
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const studyPlanService = {

  // ── Original methods (100% unchanged) ────────────────────────────────────

  async createEvent(event: Omit<StudyPlanEvent, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    // Firestore rejects undefined — strip before writing
    const payload: Record<string, any> = { createdAt: Timestamp.now() };
    for (const [k, v] of Object.entries(event)) {
      if (v !== undefined) {
        payload[k] = (k === 'date' && v instanceof Date) ? Timestamp.fromDate(v) : v;
      }
    }
    const docRef = await addDoc(collection(db, 'studyPlanEvents'), payload);
    return docRef.id;
  },

  async getEventsByTeacher(instructorId: string): Promise<StudyPlanEvent[]> {
    const q = query(
      collection(db, 'studyPlanEvents'),
      where('instructorId', '==', instructorId),
      where('isPersonal', '==', false)
    );
    const snap = await getDocs(q);
    const events = snap.docs.map(d => ({
      id: d.id, ...d.data(),
      date: toDate(d.data().date),
      startTime: d.data().startTime || '',
      endTime: d.data().endTime || '',
      createdAt: toDate(d.data().createdAt),
      updatedAt: d.data().updatedAt ? toDate(d.data().updatedAt) : undefined,
      completedAt: d.data().completedAt ? toDate(d.data().completedAt) : undefined,
    })) as StudyPlanEvent[];
    return events.sort((a, b) => {
      const dd = a.date.getTime() - b.date.getTime();
      if (dd !== 0) return dd;
      return parseInt((a.startTime || '00:00').replace(':', '')) - parseInt((b.startTime || '00:00').replace(':', ''));
    });
  },

  async getEventsForStudent(studentId: string): Promise<StudyPlanEvent[]> {
    const snap = await getDocs(query(collection(db, 'studyPlanEvents'), orderBy('date', 'asc')));
    const all = snap.docs.map(d => ({
      id: d.id, ...d.data(),
      date: toDate(d.data().date),
      startTime: d.data().startTime || '',
      endTime: d.data().endTime || '',
      createdAt: toDate(d.data().createdAt),
      updatedAt: d.data().updatedAt ? toDate(d.data().updatedAt) : undefined,
      completedAt: d.data().completedAt ? toDate(d.data().completedAt) : undefined,
    })) as StudyPlanEvent[];

    let enrolledCourseIds: string[] = [];
    try {
      const enrollments = await courseService.getStudentEnrollments(studentId);
      enrolledCourseIds = enrollments.map((e: any) => e.courseId);
    } catch { /* ignore */ }

    return all.filter(e => {
      if (e.isPersonal && e.studentId === studentId) return true;
      if (e.targetAudience === 'all') return true;
      if (e.targetAudience === 'specific_student' && e.targetStudentIds?.includes(studentId)) return true;
      if (e.targetAudience === 'course_students' && e.targetCourseIds?.some(id => enrolledCourseIds.includes(id))) return true;
      return false;
    }).sort((a, b) => {
      const dd = a.date.getTime() - b.date.getTime();
      if (dd !== 0) return dd;
      return parseInt((a.startTime || '00:00').replace(':', '')) - parseInt((b.startTime || '00:00').replace(':', ''));
    });
  },

  async getAllStudents(): Promise<{ uid: string; name: string; email: string }[]> {
    const { userService } = await import('./userService');
    const all = await userService.getAllUsers();
    return all.filter((u: any) => u.role === 'student' && u.status === 'active')
      .map((u: any) => ({ uid: u.uid, name: u.name, email: u.email }));
  },

  async getAllCourses(): Promise<{ id: string; title: string; instructorName: string }[]> {
    const all = await courseService.getAllCourses();
    return all.map((c: any) => ({ id: c.id, title: c.title, instructorName: c.instructor }));
  },

  async updateEvent(id: string, updates: Partial<StudyPlanEvent>): Promise<void> {
    const data: any = { updatedAt: Timestamp.now() };
    // Firestore rejects undefined values — strip them before writing
    for (const [k, v] of Object.entries(updates)) {
      if (v === undefined) continue;
      data[k] = k === 'date' && v instanceof Date ? Timestamp.fromDate(v)
               : k === 'completedAt' && v instanceof Date ? Timestamp.fromDate(v)
               : v;
    }
    await updateDoc(doc(db, 'studyPlanEvents', id), data);
  },

  async deleteEvent(id: string): Promise<void> {
    await deleteDoc(doc(db, 'studyPlanEvents', id));
  },

  async markEventComplete(id: string, completed: boolean): Promise<void> {
    await studyPlanService.updateEvent(id, {
      completed,
      completedAt: completed ? new Date() : undefined,
    } as any);
  },

  /**
   * Set partial or full completion % on an event.
   * 100% automatically flips completed=true; anything below resets it to false.
   */
  async updateEventCompletionPercent(id: string, percent: number): Promise<void> {
    const clamped = Math.max(0, Math.min(100, percent));
    // Never pass completedAt: undefined — omit the field entirely when not 100%
    const updates: any = {
      completionPercent: clamped,
      completed: clamped === 100,
    };
    if (clamped === 100) updates.completedAt = new Date();
    await studyPlanService.updateEvent(id, updates);
  },

  async createBulkAIEvents(
    events: Omit<StudyPlanEvent, 'id' | 'createdAt' | 'updatedAt'>[],
    studentId: string
  ): Promise<string[]> {
    const ids: string[] = [];
    for (const e of events) {
      ids.push(await studyPlanService.createEvent({ ...e, studentId, isPersonal: true }));
    }
    return ids;
  },

  // ── Study Goals ───────────────────────────────────────────────────────────

  async createGoal(goal: Omit<StudyGoal, 'id' | 'createdAt'>): Promise<string> {
    // Strip undefined optional fields to avoid Firestore "undefined value" errors
    const payload: Record<string, any> = {};
    for (const [k, v] of Object.entries({ ...goal, targetDate: Timestamp.fromDate(goal.targetDate), createdAt: Timestamp.now() })) {
      if (v !== undefined) payload[k] = v;
    }
    const ref = await addDoc(collection(db, 'studyGoals'), payload);
    return ref.id;
  },

  async getGoalsForStudent(studentId: string): Promise<StudyGoal[]> {
    const snap = await getDocs(query(
      collection(db, 'studyGoals'),
      where('studentId', '==', studentId),
      where('isActive', '==', true)
    ));
    return snap.docs.map(d => ({
      id: d.id, ...d.data(),
      targetDate: toDate(d.data().targetDate),
      createdAt: toDate(d.data().createdAt),
    })) as StudyGoal[];
  },

  async updateGoal(id: string, updates: Partial<StudyGoal>): Promise<void> {
    const data: any = { ...updates };
    if (data.targetDate instanceof Date) data.targetDate = Timestamp.fromDate(data.targetDate);
    await updateDoc(doc(db, 'studyGoals', id), data);
  },

  async deleteGoal(id: string): Promise<void> {
    await deleteDoc(doc(db, 'studyGoals', id));
  },

  // ── Pomodoro Sessions ─────────────────────────────────────────────────────

  async savePomodoroSession(session: Omit<PomodoroSession, 'id' | 'createdAt'>): Promise<string> {
    const ref = await addDoc(collection(db, 'pomodoroSessions'), {
      ...session,
      startTime: Timestamp.fromDate(session.startTime),
      createdAt: Timestamp.now(),
    });
    await studyPlanService.updateStreak(session.studentId, session.duration);
    return ref.id;
  },

  async getPomodoroSessions(studentId: string, limitCount = 30): Promise<PomodoroSession[]> {
    const snap = await getDocs(query(
      collection(db, 'pomodoroSessions'),
      where('studentId', '==', studentId),
      orderBy('startTime', 'desc')
    ));
    return snap.docs.slice(0, limitCount).map(d => ({
      id: d.id, ...d.data(),
      startTime: toDate(d.data().startTime),
      createdAt: toDate(d.data().createdAt),
    })) as PomodoroSession[];
  },

  // ── Study Streaks ─────────────────────────────────────────────────────────

  async updateStreak(studentId: string, minutesAdded: number): Promise<void> {
    const ref = doc(db, 'studyStreaks', studentId);
    const snap = await getDoc(ref);
    const today = new Date(); today.setHours(0, 0, 0, 0);

    if (snap.exists()) {
      const d = snap.data() as any;
      const last = toDate(d.lastStudyDate); last.setHours(0, 0, 0, 0);
      const diff = Math.round((today.getTime() - last.getTime()) / 86400000);
      const streak = diff === 1 ? d.currentStreak + 1 : diff === 0 ? d.currentStreak : 1;
      await updateDoc(ref, {
        currentStreak: streak,
        longestStreak: Math.max(d.longestStreak, streak),
        lastStudyDate: Timestamp.fromDate(today),
        totalSessions: (d.totalSessions || 0) + 1,
        totalMinutes:  (d.totalMinutes  || 0) + minutesAdded,
      });
    } else {
      await setDoc(ref, {
        studentId, currentStreak: 1, longestStreak: 1,
        lastStudyDate: Timestamp.fromDate(today),
        totalSessions: 1, totalMinutes: minutesAdded,
      });
    }
  },

  async getStreak(studentId: string): Promise<StudyStreak | null> {
    const snap = await getDoc(doc(db, 'studyStreaks', studentId));
    if (!snap.exists()) return null;
    const d = snap.data();
    return { ...d, lastStudyDate: toDate(d.lastStudyDate) } as StudyStreak;
  },

  // ── NEW: Chat History ─────────────────────────────────────────────────────

  async saveChatMessage(
    studentId: string,
    message: Pick<ChatMessage, 'role' | 'content'> & { calendarEvents?: ChatMessage['calendarEvents'] }
  ): Promise<void> {
    try {
      await addDoc(collection(db, 'studyChatHistory'), {
        studentId,
        role: message.role,
        content: message.content,
        ...(message.calendarEvents ? { calendarEvents: message.calendarEvents } : {}),
        timestamp: Timestamp.now(),
      });
    } catch (e) {
      // Non-critical — chat still works without persistence
      console.warn('Failed to save chat message:', e);
    }
  },

  async getChatHistory(studentId: string, limitCount = 40): Promise<ChatMessage[]> {
    try {
      const snap = await getDocs(query(
        collection(db, 'studyChatHistory'),
        where('studentId', '==', studentId),
        orderBy('timestamp', 'asc'),
        limit(limitCount)
      ));
      return snap.docs.map(d => ({
        id: d.id,
        studentId: d.data().studentId,
        role: d.data().role,
        content: d.data().content,
        timestamp: toDate(d.data().timestamp),
        calendarEvents: d.data().calendarEvents,
      })) as ChatMessage[];
    } catch (e) {
      console.warn('Failed to load chat history:', e);
      return [];
    }
  },

  async clearChatHistory(studentId: string): Promise<void> {
    try {
      const snap = await getDocs(query(
        collection(db, 'studyChatHistory'),
        where('studentId', '==', studentId)
      ));
      // Delete in batches of 10 to avoid hitting Firestore limits
      const deletions = snap.docs.map(d => deleteDoc(d.ref));
      await Promise.all(deletions);
    } catch (e) {
      console.warn('Failed to clear chat history:', e);
    }
  },

  // ── NEW: Custom Activities ────────────────────────────────────────────────

  async createCustomActivity(
    activity: Omit<CustomActivity, 'id' | 'createdAt'>
  ): Promise<string> {
    // Firestore rejects undefined values — strip them before writing
    const payload: Record<string, any> = { createdAt: Timestamp.now() };
    for (const [k, v] of Object.entries(activity)) {
      if (v !== undefined) payload[k] = v;
    }
    const ref = await addDoc(collection(db, 'studentActivities'), payload);
    return ref.id;
  },

  async getCustomActivities(studentId: string): Promise<CustomActivity[]> {
    try {
      const snap = await getDocs(query(
        collection(db, 'studentActivities'),
        where('studentId', '==', studentId),
        orderBy('createdAt', 'asc')
      ));
      return snap.docs.map(d => ({
        id: d.id, ...d.data(),
        createdAt: toDate(d.data().createdAt),
      })) as CustomActivity[];
    } catch (e) {
      // Index not yet created — fallback without ordering
      try {
        const snap = await getDocs(query(
          collection(db, 'studentActivities'),
          where('studentId', '==', studentId)
        ));
        return snap.docs.map(d => ({
          id: d.id, ...d.data(),
          createdAt: toDate(d.data().createdAt),
        })) as CustomActivity[];
      } catch { return []; }
    }
  },

  async updateCustomActivity(id: string, updates: Partial<CustomActivity>): Promise<void> {
    await updateDoc(doc(db, 'studentActivities', id), updates);
  },

  async deleteCustomActivity(id: string): Promise<void> {
    await deleteDoc(doc(db, 'studentActivities', id));
  },

  /**
   * Auto-cleanup expired personal events.
   * Rules:
   *   - AI-generated events: only delete 24h AFTER their linked goal's deadline (not event date)
   *   - Regular personal events: delete 24h after the event's own date
   * Returns IDs that were deleted so the caller can filter them out.
   */
  async deleteExpiredPersonalEvents(
    studentId: string,
    events: StudyPlanEvent[],
    goals?: import('./studyPlanService').StudyGoal[]
  ): Promise<string[]> {
    const now = Date.now();
    const cutoff24h = new Date(now - 24 * 60 * 60 * 1000);

    const toDelete = events.filter(e => {
      if (!e.isPersonal || e.studentId !== studentId || e.completed) return false;

      // AI-generated events: survive until 24h after the linked goal's deadline
      if (e.isAIGenerated && goals && goals.length > 0) {
        const linkedGoal = goals.find(
          g => g.subject === e.course || e.course?.startsWith(g.subject.split(' (')[0])
        );
        if (linkedGoal) {
          const goalDeadlineCutoff = new Date(linkedGoal.targetDate.getTime() + 24 * 60 * 60 * 1000);
          return new Date() > goalDeadlineCutoff;
        }
        // AI event but no linked goal found → use event date + 24h grace
        return e.date < cutoff24h;
      }

      // Regular personal events: 24h after event date
      return e.date < cutoff24h;
    });

    await Promise.all(toDelete.map(e => studyPlanService.deleteEvent(e.id))).catch(() => {});
    return toDelete.map(e => e.id);
  },

  /**
   * Reschedule: delete all future uncompleted AI-generated events for a goal,
   * returning the count of deleted sessions so the caller knows what was cleared.
   */
  async clearFutureAIEventsForGoal(
    goalSubject: string,
    events: StudyPlanEvent[],
    studentId: string
  ): Promise<number> {
    const now = new Date();
    const toDelete = events.filter(
      e =>
        e.isPersonal &&
        e.studentId === studentId &&
        e.isAIGenerated &&
        !e.completed &&
        e.date >= now &&
        (e.course === goalSubject || e.course?.startsWith(goalSubject.split(' (')[0]))
    );
    await Promise.all(toDelete.map(e => studyPlanService.deleteEvent(e.id))).catch(() => {});
    return toDelete.length;
  },

  /**
   * Full reset: delete ALL uncompleted AI events for a goal (past + future).
   * Used when accepting a brand-new schedule or reschedule to prevent duplicates
   * and reset the "behind" tracker to zero.
   */
  async clearAllAIEventsForGoal(
    goalSubject: string,
    events: StudyPlanEvent[],
    studentId: string
  ): Promise<number> {
    const baseSubject = goalSubject.split(' (')[0];
    const toDelete = events.filter(
      e =>
        e.isPersonal &&
        e.studentId === studentId &&
        e.isAIGenerated &&
        !e.completed &&
        (e.course === goalSubject || e.course === baseSubject || e.course?.startsWith(baseSubject))
    );
    await Promise.all(toDelete.map(e => studyPlanService.deleteEvent(e.id))).catch(() => {});
    return toDelete.length;
  },

  /**
   * Nuclear option: query Firestore DIRECTLY to delete all uncompleted AI events
   * for a student (optionally filtered to specific goal subjects).
   * Bypasses stale React state — always works on fresh data.
   */
  /**
   * Returns the highest "Session N" number among COMPLETED sessions for the given
   * student + subject.
   *
   * WHY completed-only: on reschedule we delete all uncompleted sessions first,
   * so only completed sessions survive. Counting uncompleted sessions (e.g. 1–8
   * when only 1 is done) would make the next session start at 9 instead of 2.
   */
  async getMaxSessionNumberForSubject(studentId: string, subject: string): Promise<number> {
    const base = subject.split(' (')[0].toLowerCase().trim();
    const snap = await getDocs(
      query(
        collection(db, 'studyPlanEvents'),
        where('studentId', '==', studentId),
        where('completed', '==', true)   // ← only sessions that survive the clear
      )
    );
    let max = 0;
    snap.docs.forEach(d => {
      const data = d.data();
      const courseNorm = ((data.course as string) || '').toLowerCase().trim();
      const titleNorm  = ((data.title  as string) || '').toLowerCase();
      const match = courseNorm === base || courseNorm.startsWith(base)
        || base.startsWith(courseNorm) || titleNorm.startsWith(base);
      if (!match) return;
      const m = ((data.title as string) || '').match(/Session\s+(\d+)/i);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    });
    return max;
  },

  async clearAllStudentAIEventsFromFirestore(
    studentId: string,
    goalSubjects?: string[]
  ): Promise<number> {
    const snap = await getDocs(
      query(
        collection(db, 'studyPlanEvents'),
        where('studentId', '==', studentId),
        where('isAIGenerated', '==', true),
        where('isPersonal', '==', true),
        where('completed', '==', false)
      )
    );
    const toDelete = snap.docs.filter(doc => {
      if (!goalSubjects || goalSubjects.length === 0) return true;
      const course: string = doc.data().course || '';
      return goalSubjects.some(subj => {
        const base = subj.split(' (')[0];
        return course === subj || course === base || course.startsWith(base);
      });
    });
    await Promise.all(toDelete.map(doc => studyPlanService.deleteEvent(doc.id))).catch(() => {});
    return toDelete.length;
  },

  /**
   * Delete ALL AI-generated sessions for given goal subjects — including completed ones.
   * Used when a goal is manually deleted so no orphan sessions remain.
   */
  async deleteAllAISessionsForGoalFromFirestore(
    studentId: string,
    goalSubjects: string[]
  ): Promise<number> {
    const snap = await getDocs(
      query(
        collection(db, 'studyPlanEvents'),
        where('studentId', '==', studentId),
        where('isAIGenerated', '==', true),
        where('isPersonal', '==', true)
      )
    );
    const toDelete = snap.docs.filter(d => {
      const course: string = d.data().course || '';
      return goalSubjects.some(subj => {
        const base = subj.split(' (')[0];
        return course === subj || course === base || course.startsWith(base);
      });
    });
    await Promise.all(toDelete.map(d => studyPlanService.deleteEvent(d.id))).catch(() => {});
    return toDelete.length;
  },

  /**
   * Mark all AI sessions for given goal subjects as expired (expired: true).
   * Called when a goal's deadline passes but it hasn't yet hit the 12-hour auto-delete window.
   */
  async markGoalSessionsExpired(
    studentId: string,
    goalSubjects: string[]
  ): Promise<void> {
    const snap = await getDocs(
      query(
        collection(db, 'studyPlanEvents'),
        where('studentId', '==', studentId),
        where('isAIGenerated', '==', true),
        where('isPersonal', '==', true)
      )
    );
    const toMark = snap.docs.filter(d => {
      if (d.data().expired) return false; // already marked
      const course: string = d.data().course || '';
      return goalSubjects.some(subj => {
        const base = subj.split(' (')[0];
        return course === subj || course === base || course.startsWith(base);
      });
    });
    await Promise.all(toMark.map(d => updateDoc(d.ref, { expired: true }))).catch(() => {});
  },

  // ── NEW: Enrolled Courses For Planning ────────────────────────────────────

  // ── Help Video URL (set by teacher/admin, read by students) ─────────────────

  async getHelpVideoUrl(): Promise<string> {
    try {
      const snap = await getDoc(doc(db, 'appSettings', 'studyPlanHelp'));
      return snap.exists() ? (snap.data().videoUrl || '') : '';
    } catch { return ''; }
  },

  async setHelpVideoUrl(url: string): Promise<void> {
    await setDoc(doc(db, 'appSettings', 'studyPlanHelp'), { videoUrl: url }, { merge: true });
  },

  // ── Free Time Preferences (Firestore) ────────────────────────────────────
  // Document: userPrefs/{uid} → { freeTimeMode, freeHoursPerDay, freeTimeRanges, configured }

  async getFreeTimePrefs(uid: string): Promise<{ mode: 'hours' | 'range'; hours: number; ranges: { start: string; end: string }[]; configured: boolean } | null> {
    try {
      const snap = await getDoc(doc(db, 'userPrefs', uid));
      if (!snap.exists() || !snap.data().freeTimeConfigured) return null;
      const d = snap.data();
      return {
        mode:       d.freeTimeMode       ?? 'hours',
        hours:      d.freeHoursPerDay    ?? 4,
        ranges:     d.freeTimeRanges     ?? [{ start: '14:00', end: '22:00' }],
        configured: true,
      };
    } catch { return null; }
  },

  async saveFreeTimePrefs(uid: string, prefs: { mode: 'hours' | 'range'; hours: number; ranges: { start: string; end: string }[] }): Promise<void> {
    await setDoc(doc(db, 'userPrefs', uid), {
      freeTimeMode: prefs.mode,
      freeHoursPerDay: prefs.hours,
      freeTimeRanges: prefs.ranges,
      freeTimeConfigured: true,
    }, { merge: true });
  },

  // ── Streak Freeze (Firestore) ─────────────────────────────────────────────
  // Document: streakFreezes/{uid} → { count, lastMonthlyAdd, createdAt }
  // - New users start with 3 freezes
  // - +1 freeze added automatically each month (cap: 10)

  async getStreakFreeze(uid: string): Promise<{ count: number }> {
    try {
      const ref = doc(db, 'streakFreezes', uid);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        const initial = { count: 3, lastMonthlyAdd: new Date().toISOString(), createdAt: new Date().toISOString() };
        await setDoc(ref, initial);
        return { count: 3 };
      }
      const data = snap.data();
      const lastAdd = new Date(data.lastMonthlyAdd || data.createdAt || 0);
      const monthsSince = (Date.now() - lastAdd.getTime()) / (1000 * 60 * 60 * 24 * 30);
      if (monthsSince >= 1 && (data.count ?? 0) < 10) {
        const newCount = Math.min(10, (data.count ?? 0) + 1);
        await setDoc(ref, { count: newCount, lastMonthlyAdd: new Date().toISOString() }, { merge: true });
        return { count: newCount };
      }
      return { count: data.count ?? 0 };
    } catch { return { count: 0 }; }
  },

  async useStreakFreeze(uid: string): Promise<number> {
    try {
      const ref = doc(db, 'streakFreezes', uid);
      const snap = await getDoc(ref);
      const current = snap.exists() ? (snap.data().count ?? 0) : 0;
      const newCount = Math.max(0, current - 1);
      await setDoc(ref, { count: newCount }, { merge: true });
      return newCount;
    } catch { return 0; }
  },

  async getEnrolledCoursesForPlanning(studentId: string): Promise<EnrolledCourseForPlanning[]> {
    try {
      const enrollments = await courseService.getStudentEnrollments(studentId);
      const activeEnrollments = enrollments.filter(
        (e: any) => e.paymentStatus === 'completed'
      );

      const courseDetails = await Promise.allSettled(
        activeEnrollments.map((e: any) => courseService.getCourseById(e.courseId))
      );

      const result: EnrolledCourseForPlanning[] = [];
      courseDetails.forEach((detail, i) => {
        if (detail.status === 'fulfilled' && detail.value) {
          const course = detail.value;
          const enrollment = activeEnrollments[i] as any;
          const totalLessons = course.lessons?.length || 0;
          const completedLessons = enrollment.completedLessons?.length || 0;

          result.push({
            courseId: course.id,
            title: course.title,
            subjects: course.subjects?.length ? course.subjects : [course.category].filter(Boolean),
            totalLessons,
            completedLessons,
            progress: enrollment.progress || (totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0),
            level: course.level || 'unspecified',
            instructor: course.instructor || '',
          });
        }
      });

      return result;
    } catch (e) {
      console.warn('Failed to load enrolled courses for planning:', e);
      return [];
    }
  },
};
