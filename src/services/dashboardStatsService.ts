// src/services/dashboardStatsService.ts
// New service: KPI stats, heatmaps, course progress, pending tasks, exam performance, continue learning
// All reads only — no writes to existing collections except appUsageLogs (new collection)

import {
  collection, doc, getDocs, getDoc, setDoc, query,
  where, orderBy, Timestamp, limit as fsLimit,
} from 'firebase/firestore';
import { db } from '../config/firebase';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface KPIStats {
  todayStudyMinutes: number;   // pomodoro sessions + completed calendar events today
  weekStudyMinutes: number;    // same sources, last 7 days
  tasksCompleted: number;      // objectives completed today
  streakDays: number;
}

export interface HeatmapDay {
  date: string;        // YYYY-MM-DD
  value: number;       // minutes for study heatmap / seconds for app heatmap
  level: 0 | 1 | 2 | 3 | 4;  // intensity level
}

export interface CourseProgressItem {
  courseId: string;
  title: string;
  instructor: string;
  progress: number;        // 0-100
  completedLessons: number;
  totalLessons: number;
  lastAccessedAt: Date;
  thumbnail?: string;
}

export interface PendingTaskItem {
  id: string;
  title: string;
  type: 'task' | 'goal' | 'event';
  dueDate: Date;
  urgency: 'overdue' | 'today' | 'tomorrow' | 'upcoming';
  course?: string;
  points?: number;
}

export interface ExamPerformancePoint {
  date: string;        // YYYY-MM-DD
  examTitle: string;
  percentage: number;
  courseId: string;
}

export interface ContinueLearningItem {
  courseId: string;
  title: string;
  instructor: string;
  progress: number;
  lastAccessedAt: Date;
  thumbnail?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const toDate = (v: any): Date => {
  if (!v) return new Date();
  if (v instanceof Date) return v;
  if (v?.toDate) return v.toDate();
  return new Date(v);
};

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function intensityLevel(value: number, maxValue: number): 0 | 1 | 2 | 3 | 4 {
  if (value === 0 || maxValue === 0) return 0;
  const pct = value / maxValue;
  if (pct < 0.15) return 1;
  if (pct < 0.40) return 2;
  if (pct < 0.70) return 3;
  return 4;
}

function buildHeatmapGrid(dayMap: Map<string, number>, weeksBack: number): HeatmapDay[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const totalDays = weeksBack * 7;
  const maxVal = Math.max(...Array.from(dayMap.values()), 1);

  const days: HeatmapDay[] = [];
  for (let i = totalDays - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = ymd(d);
    const val = dayMap.get(key) ?? 0;
    days.push({ date: key, value: val, level: intensityLevel(val, maxVal) });
  }
  return days;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const dashboardStatsService = {

  // ── KPI Stats ─────────────────────────────────────────────────────────────

  async getKPIStats(studentId: string): Promise<KPIStats> {
    const now = new Date();
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const weekStart = new Date(now); weekStart.setDate(now.getDate() - 6); weekStart.setHours(0, 0, 0, 0);

    const [pomodoroSnap, eventsSnap, objectivesSnap, streakSnap] = await Promise.allSettled([
      // Pomodoro sessions (last 7 days)
      getDocs(query(
        collection(db, 'pomodoroSessions'),
        where('studentId', '==', studentId),
        where('startTime', '>=', Timestamp.fromDate(weekStart)),
        orderBy('startTime', 'desc'),
      )),
      // Completed calendar events (last 7 days)
      getDocs(query(
        collection(db, 'studyPlanEvents'),
        where('studentId', '==', studentId),
        where('isPersonal', '==', true),
        where('completed', '==', true),
      )),
      // Today's objectives
      getDocs(query(
        collection(db, 'dashboardObjectives'),
        where('studentId', '==', studentId),
        where('completed', '==', true),
      )),
      // Streak
      getDoc(doc(db, 'studyStreaks', studentId)),
    ]);

    // Pomodoro minutes
    let todayPomodoro = 0, weekPomodoro = 0;
    if (pomodoroSnap.status === 'fulfilled') {
      pomodoroSnap.value.docs.forEach(d => {
        const start = toDate(d.data().startTime);
        const mins = d.data().duration ?? 0;
        if (d.data().completed !== false) {
          weekPomodoro += mins;
          if (start >= todayStart) todayPomodoro += mins;
        }
      });
    }

    // Completed event minutes
    let todayEvents = 0, weekEvents = 0;
    if (eventsSnap.status === 'fulfilled') {
      eventsSnap.value.docs.forEach(d => {
        const data = d.data();
        const completedAt = data.completedAt ? toDate(data.completedAt) : toDate(data.date);
        if (completedAt < weekStart) return;
        // Estimate duration from startTime/endTime
        try {
          const [sh, sm] = (data.startTime || '00:00').split(':').map(Number);
          const [eh, em] = (data.endTime   || '00:00').split(':').map(Number);
          const mins = Math.max(0, (eh * 60 + em) - (sh * 60 + sm));
          weekEvents += mins;
          if (completedAt >= todayStart) todayEvents += mins;
        } catch { /* skip */ }
      });
    }

    // Objectives completed today
    let tasksCompleted = 0;
    if (objectivesSnap.status === 'fulfilled') {
      tasksCompleted = objectivesSnap.value.size;
    }

    // Streak
    let streakDays = 0;
    if (streakSnap.status === 'fulfilled' && streakSnap.value.exists()) {
      streakDays = streakSnap.value.data().currentStreak ?? 0;
    }

    return {
      todayStudyMinutes: todayPomodoro + todayEvents,
      weekStudyMinutes: weekPomodoro + weekEvents,
      tasksCompleted,
      streakDays,
    };
  },

  // ── Study Activity Heatmap ────────────────────────────────────────────────

  async getStudyHeatmap(studentId: string, weeksBack = 10): Promise<HeatmapDay[]> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - (weeksBack * 7));
    cutoff.setHours(0, 0, 0, 0);

    const dayMap = new Map<string, number>();

    const [pomSnap, evSnap] = await Promise.allSettled([
      getDocs(query(
        collection(db, 'pomodoroSessions'),
        where('studentId', '==', studentId),
        where('startTime', '>=', Timestamp.fromDate(cutoff)),
        orderBy('startTime', 'desc'),
      )),
      getDocs(query(
        collection(db, 'studyPlanEvents'),
        where('studentId', '==', studentId),
        where('isPersonal', '==', true),
        where('completed', '==', true),
      )),
    ]);

    if (pomSnap.status === 'fulfilled') {
      pomSnap.value.docs.forEach(d => {
        if (d.data().completed === false) return;
        const key = ymd(toDate(d.data().startTime));
        dayMap.set(key, (dayMap.get(key) ?? 0) + (d.data().duration ?? 0));
      });
    }

    if (evSnap.status === 'fulfilled') {
      evSnap.value.docs.forEach(d => {
        const data = d.data();
        const at = data.completedAt ? toDate(data.completedAt) : toDate(data.date);
        if (at < cutoff) return;
        try {
          const [sh, sm] = (data.startTime || '00:00').split(':').map(Number);
          const [eh, em] = (data.endTime   || '00:00').split(':').map(Number);
          const mins = Math.max(0, (eh * 60 + em) - (sh * 60 + sm));
          const key = ymd(at);
          dayMap.set(key, (dayMap.get(key) ?? 0) + mins);
        } catch { /* skip */ }
      });
    }

    return buildHeatmapGrid(dayMap, weeksBack);
  },

  // ── App Usage Heatmap ─────────────────────────────────────────────────────

  async getAppUsageHeatmap(studentId: string, weeksBack = 10): Promise<HeatmapDay[]> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - (weeksBack * 7));

    try {
      const snap = await getDocs(query(
        collection(db, 'appUsageLogs'),
        where('studentId', '==', studentId),
        where('date', '>=', ymd(cutoff)),
        orderBy('date', 'asc'),
      ));

      const dayMap = new Map<string, number>();
      snap.docs.forEach(d => {
        const key = d.data().date as string;
        dayMap.set(key, (dayMap.get(key) ?? 0) + (d.data().durationSeconds ?? 0));
      });

      return buildHeatmapGrid(dayMap, weeksBack);
    } catch {
      return buildHeatmapGrid(new Map(), weeksBack);
    }
  },

  // Log a session — called from DashboardLayout on unmount
  async logAppUsageSession(studentId: string, durationSeconds: number): Promise<void> {
    if (durationSeconds < 30) return; // ignore < 30s micro-visits
    const dateKey = ymd(new Date());
    try {
      const ref = doc(db, 'appUsageLogs', `${studentId}_${dateKey}_${Date.now()}`);
      await setDoc(ref, {
        studentId,
        date: dateKey,
        durationSeconds: Math.round(durationSeconds),
        recordedAt: Timestamp.now(),
      });
    } catch { /* non-fatal */ }
  },

  // ── Course Progress ───────────────────────────────────────────────────────

  async getCourseProgress(studentId: string): Promise<CourseProgressItem[]> {
    try {
      const enrollSnap = await getDocs(query(
        collection(db, 'enrollments'),
        where('studentId', '==', studentId),
      ));

      const enrollments = enrollSnap.docs
        .map(d => ({ id: d.id, ...d.data(), lastAccessedAt: toDate(d.data().lastAccessedAt) }))
        .filter((e: any) => e.paymentStatus === 'completed') as any[];

      if (!enrollments.length) return [];

      const courseIds = [...new Set(enrollments.map((e: any) => e.courseId))] as string[];
      const courseSnaps = await Promise.allSettled(
        courseIds.map(id => getDoc(doc(db, 'courses', id)))
      );

      const courseMap = new Map<string, any>();
      courseSnaps.forEach((r, i) => {
        if (r.status === 'fulfilled' && r.value.exists()) {
          courseMap.set(courseIds[i], { id: courseIds[i], ...r.value.data() });
        }
      });

      return enrollments
        .filter((e: any) => courseMap.has(e.courseId))
        .map((e: any) => {
          const c = courseMap.get(e.courseId);
          const total = c.lessons?.length ?? 0;
          const completed = e.completedLessons?.length ?? 0;
          return {
            courseId: e.courseId,
            title: c.title ?? 'Untitled',
            instructor: c.instructor ?? '',
            progress: e.progress ?? (total > 0 ? Math.round((completed / total) * 100) : 0),
            completedLessons: completed,
            totalLessons: total,
            lastAccessedAt: e.lastAccessedAt,
            thumbnail: c.thumbnailUrl ?? c.thumbnail,
          };
        })
        .sort((a: CourseProgressItem, b: CourseProgressItem) =>
          b.lastAccessedAt.getTime() - a.lastAccessedAt.getTime()
        );
    } catch (e) {
      console.warn('[dashboardStatsService] getCourseProgress:', e);
      return [];
    }
  },

  // ── Pending Tasks / Deadlines ─────────────────────────────────────────────

  async getPendingTasks(studentId: string): Promise<PendingTaskItem[]> {
    const now = new Date();
    const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999);
    const tomorrowEnd = new Date(now); tomorrowEnd.setDate(now.getDate() + 1); tomorrowEnd.setHours(23, 59, 59, 999);
    const futureEnd = new Date(now); futureEnd.setDate(now.getDate() + 14);

    function urgency(due: Date): 'overdue' | 'today' | 'tomorrow' | 'upcoming' | null {
      if (due < now) return 'overdue';
      if (due <= todayEnd) return 'today';
      if (due <= tomorrowEnd) return 'tomorrow';
      if (due <= futureEnd) return 'upcoming';
      return null; // too far out
    }

    const items: PendingTaskItem[] = [];

    const [taskSnap, goalSnap, eventSnap] = await Promise.allSettled([
      // Published task groups assigned to this student
      getDocs(query(
        collection(db, 'taskGroups'),
        where('status', '==', 'published'),
      )),
      // Active goals nearing deadline
      getDocs(query(
        collection(db, 'studyGoals'),
        where('studentId', '==', studentId),
        where('isActive', '==', true),
      )),
      // Upcoming calendar events (not completed)
      getDocs(query(
        collection(db, 'studyPlanEvents'),
        where('studentId', '==', studentId),
        where('isPersonal', '==', true),
        where('completed', '==', false),
      )),
    ]);

    // Task groups
    if (taskSnap.status === 'fulfilled') {
      taskSnap.value.docs.forEach(d => {
        const data = d.data();
        const scope = data.assignedTo;
        // Only include if targeted to all or includes this student
        const targeted =
          !scope || scope.type === 'all' ||
          (scope.type === 'students' && scope.studentIds?.includes(studentId)) ||
          scope.type === 'course' || scope.type === 'class';
        if (!targeted) return;

        const due = toDate(data.dueDate);
        const u = urgency(due);
        if (!u) return;
        items.push({
          id: d.id,
          title: data.title ?? 'Task',
          type: 'task',
          dueDate: due,
          urgency: u,
          points: data.totalPoints,
        });
      });
    }

    // Goals
    if (goalSnap.status === 'fulfilled') {
      goalSnap.value.docs.forEach(d => {
        const data = d.data();
        const due = toDate(data.targetDate);
        const u = urgency(due);
        if (!u) return;
        const progress = data.hoursCompleted > 0
          ? Math.round((data.hoursCompleted / (data.hoursNeeded || 1)) * 100)
          : (data.currentProgress ?? 0);
        if (progress >= 100) return; // already done
        items.push({
          id: d.id,
          title: `Goal: ${data.subject}`,
          type: 'goal',
          dueDate: due,
          urgency: u,
          course: data.subject,
        });
      });
    }

    // Calendar events (upcoming, not completed)
    if (eventSnap.status === 'fulfilled') {
      eventSnap.value.docs.forEach(d => {
        const data = d.data();
        const due = toDate(data.date);
        const u = urgency(due);
        if (!u) return;
        if (['exam', 'assignment', 'deadline'].includes(data.eventType ?? '')) {
          items.push({
            id: d.id,
            title: data.title ?? 'Event',
            type: 'event',
            dueDate: due,
            urgency: u,
            course: data.course,
          });
        }
      });
    }

    // Sort: overdue first, then by date asc
    const order = { overdue: 0, today: 1, tomorrow: 2, upcoming: 3 };
    return items.sort((a, b) =>
      order[a.urgency] - order[b.urgency] ||
      a.dueDate.getTime() - b.dueDate.getTime()
    ).slice(0, 10);
  },

  // ── Exam Performance (per enrolled course) ────────────────────────────────

  async getExamPerformance(studentId: string): Promise<{
    courseId: string;
    courseTitle: string;
    points: ExamPerformancePoint[];
  }[]> {
    try {
      // Get student exam sessions that are submitted and result visible
      const snap = await getDocs(query(
        collection(db, 'examSessions'),
        where('studentId', '==', studentId),
        where('resultVisibility', '==', 'visible'),
        orderBy('submittedAt', 'asc'),
        fsLimit(100),
      ));

      if (snap.empty) return [];

      // Group by courseId
      const byCourse = new Map<string, ExamPerformancePoint[]>();
      snap.docs.forEach(d => {
        const data = d.data();
        if (!['submitted', 'auto_submitted'].includes(data.status ?? '')) return;
        const courseId = data.courseId ?? '_no_course';
        const pt: ExamPerformancePoint = {
          date: ymd(toDate(data.submittedAt ?? data.startedAt)),
          examTitle: data.contentTitle ?? data.examTitle ?? 'Exam',
          percentage: data.percentage ?? 0,
          courseId,
        };
        if (!byCourse.has(courseId)) byCourse.set(courseId, []);
        byCourse.get(courseId)!.push(pt);
      });

      // Get course titles
      const courseIds = [...byCourse.keys()].filter(id => id !== '_no_course');
      const courseTitles = new Map<string, string>();
      await Promise.allSettled(
        courseIds.map(async id => {
          try {
            const s = await getDoc(doc(db, 'courses', id));
            if (s.exists()) courseTitles.set(id, s.data().title ?? id);
          } catch { /* skip */ }
        })
      );

      return Array.from(byCourse.entries()).map(([courseId, points]) => ({
        courseId,
        courseTitle: courseTitles.get(courseId) ?? (courseId === '_no_course' ? 'General' : courseId),
        points: points.sort((a, b) => a.date.localeCompare(b.date)),
      }));
    } catch (e) {
      console.warn('[dashboardStatsService] getExamPerformance:', e);
      return [];
    }
  },

  // ── Continue Learning ─────────────────────────────────────────────────────

  async getContinueLearning(studentId: string): Promise<ContinueLearningItem | null> {
    try {
      const snap = await getDocs(query(
        collection(db, 'enrollments'),
        where('studentId', '==', studentId),
        orderBy('lastAccessedAt', 'desc'),
        fsLimit(1),
      ));
      if (snap.empty) return null;
      const e = snap.docs[0].data();
      if (e.paymentStatus !== 'completed') return null;
      const course = await getDoc(doc(db, 'courses', e.courseId));
      if (!course.exists()) return null;
      const c = course.data();
      return {
        courseId: e.courseId,
        title: c.title ?? 'Untitled',
        instructor: c.instructor ?? '',
        progress: e.progress ?? 0,
        lastAccessedAt: toDate(e.lastAccessedAt),
        thumbnail: c.thumbnailUrl ?? c.thumbnail,
      };
    } catch {
      return null;
    }
  },
};
