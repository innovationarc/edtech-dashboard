// src/services/leaderboardService.ts
// Production-grade Leaderboard Service
// Only counts 1-time limited exams (maxAttempts === 1)
// Only counts sessions: status in ['submitted','auto_submitted'], resultVisibility === 'visible', writtenEvaluationPending === false

import {
  collection, query, where,
} from 'firebase/firestore';
import { getDocs } from './firestoreMonitor';
import { db } from '../config/firebase';
import { ExamSession } from './examService';
import { contentService, Content } from './contentService';
import { courseEnrollmentService, Enrollment } from './courseEnrollmentService';
import { courseAssignmentService, CourseAssignment } from './courseAssignmentService';
import { courseService, Course } from './courseService';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ExamLeaderboardEntry {
  studentId: string;
  studentName: string;
  totalMarks: number;
  maxMarks: number;
  percentage: number;
  timeTakenSeconds: number;
  rank: number;
  sessionId: string;
}

export interface ExamLeaderboardData {
  contentId: string;
  examTitle: string;
  maxMarks: number;
  entries: ExamLeaderboardEntry[];   // sorted by rank
  totalParticipants: number;
}

export interface CourseLeaderboardEntry {
  studentId: string;
  studentName: string;
  userId?: string;
  surname?: string;
  totalMarks: number;
  totalMaxMarks: number;
  percentage: number;
  examsTaken: number;
  rank: number;
}

export interface CourseLeaderboardData {
  courseId: string;
  courseTitle: string;
  courseThumbnail?: string;
  courseClass?: string;
  courseCategory?: string;
  entries: CourseLeaderboardEntry[];   // sorted by rank
  examBreakdowns: ExamLeaderboardData[];
  totalParticipants: number;
  totalExams: number;
  cachedAt: number;
}

// ─── In-memory cache ──────────────────────────────────────────────────────────
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const cache = new Map<string, { data: CourseLeaderboardData; at: number }>();

function getCached(courseId: string): CourseLeaderboardData | null {
  const hit = cache.get(courseId);
  if (hit && Date.now() - hit.at < CACHE_TTL) return hit.data;
  return null;
}
function setCached(courseId: string, data: CourseLeaderboardData) {
  cache.set(courseId, { data, at: Date.now() });
}
export function invalidateCache(courseId?: string) {
  if (courseId) cache.delete(courseId);
  else cache.clear();
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isValidSession(s: ExamSession): boolean {
  return (
    (s.status === 'submitted' || s.status === 'auto_submitted') &&
    s.resultVisibility === 'visible' &&
    !s.writtenEvaluationPending
  );
}

// Best session per student per contentId (by percentage DESC, timeTaken ASC)
function bestSessionPerStudent(sessions: ExamSession[]): ExamSession[] {
  const map = new Map<string, ExamSession>();
  for (const s of sessions) {
    const key = `${s.studentId}__${s.contentId}`;
    const existing = map.get(key);
    if (!existing) { map.set(key, s); continue; }
    if (
      s.percentage > existing.percentage ||
      (s.percentage === existing.percentage && s.timeTakenSeconds < existing.timeTakenSeconds)
    ) map.set(key, s);
  }
  return Array.from(map.values());
}

function assignRanks<T extends { percentage: number; timeTakenSeconds: number }>(
  items: T[]
): (T & { rank: number })[] {
  const sorted = [...items].sort((a, b) =>
    b.percentage - a.percentage || a.timeTakenSeconds - b.timeTakenSeconds
  );
  let rank = 1;
  return sorted.map((item, i) => {
    if (i > 0) {
      const prev = sorted[i - 1];
      if (item.percentage !== prev.percentage || item.timeTakenSeconds !== prev.timeTakenSeconds)
        rank = i + 1;
    }
    return { ...item, rank };
  });
}

// ─── Main service ─────────────────────────────────────────────────────────────

export const leaderboardService = {

  // Fetch all valid sessions for a course (1-time exams only)
  async _fetchCourseValidSessions(courseId: string): Promise<{
    sessions: ExamSession[];
    contents: Map<string, Content>;
  }> {
    // 1. Get all submitted/visible sessions for this course
    // Note: no orderBy here to avoid requiring a composite Firestore index.
    // Sorting is done in-memory via assignRanks().
    const q = query(
      collection(db, 'examSessions'),
      where('courseId', '==', courseId),
      where('resultVisibility', '==', 'visible')
    );
    const snap = await getDocs(q);

    // Import deserializer pattern — we parse manually since we can't import private fn
    const allSessions: ExamSession[] = snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        contentId: data.contentId,
        courseId: data.courseId,
        studentId: data.studentId,
        studentName: data.studentName ?? '',
        studentEmail: data.studentEmail,
        mcqQuestionIds: data.mcqQuestionIds ?? [],
        writtenQuestionIds: data.writtenQuestionIds ?? [],
        mcqAnswers: data.mcqAnswers ?? [],
        writtenAnswers: data.writtenAnswers ?? [],
        mcqMarks: data.mcqMarks ?? 0,
        writtenMarks: data.writtenMarks ?? 0,
        totalMarks: data.totalMarks ?? 0,
        maxMarks: data.maxMarks ?? 0,
        percentage: data.percentage ?? 0,
        status: data.status ?? 'in_progress',
        resultVisibility: data.resultVisibility ?? 'hidden',
        attemptNumber: data.attemptNumber ?? 1,
        startedAt: data.startedAt?.toDate?.() ?? new Date(),
        mcqSubmittedAt: data.mcqSubmittedAt?.toDate?.(),
        submittedAt: data.submittedAt?.toDate?.(),
        timeTakenSeconds: data.timeTakenSeconds ?? 0,
        tabSwitchCount: data.tabSwitchCount ?? 0,
        focusLostCount: data.focusLostCount ?? 0,
        suspiciousActivity: data.suspiciousActivity ?? [],
        writtenEvaluationPending: data.writtenEvaluationPending ?? false,
        writtenEvaluatedAt: data.writtenEvaluatedAt?.toDate?.(),
        writtenEvaluatedBy: data.writtenEvaluatedBy,
        reviewRequests: data.reviewRequests ?? [],
      } as ExamSession;
    });

    // 2. Filter valid sessions
    const validSessions = allSessions.filter(isValidSession);

    // 3. Get unique contentIds, fetch contents, filter to maxAttempts === 1
    const uniqueContentIds = [...new Set(validSessions.map(s => s.contentId))];
    const contents = new Map<string, Content>();

    await Promise.all(
      uniqueContentIds.map(async (cid) => {
        try {
          const c = await contentService.getContentById(cid);
          if (c && c.maxAttempts === 1) contents.set(cid, c);
        } catch { /* skip */ }
      })
    );

    // 4. Return only sessions for 1-time exams
    const filteredSessions = validSessions.filter(s => contents.has(s.contentId));
    return { sessions: filteredSessions, contents };
  },

  // Build full leaderboard data for a course
  async getCourseLeaderboard(
    courseId: string,
    courseTitle: string,
    courseThumbnail?: string,
    courseClass?: string,
    courseCategory?: string,
    forceRefresh = false
  ): Promise<CourseLeaderboardData> {
    if (!forceRefresh) {
      const cached = getCached(courseId);
      if (cached) return cached;
    }

    const { sessions, contents } = await this._fetchCourseValidSessions(courseId);

    // Per-exam breakdowns
    const examBreakdowns: ExamLeaderboardData[] = [];
    const contentIds = [...contents.keys()];

    for (const cid of contentIds) {
      const examSessions = sessions.filter(s => s.contentId === cid);
      const best = bestSessionPerStudent(examSessions);
      const content = contents.get(cid)!;

      const entriesRaw: Omit<ExamLeaderboardEntry, 'rank'>[] = best.map(s => ({
        studentId: s.studentId,
        studentName: s.studentName,
        totalMarks: s.totalMarks,
        maxMarks: s.maxMarks,
        percentage: s.percentage,
        timeTakenSeconds: s.timeTakenSeconds,
        sessionId: s.id,
      }));

      const ranked = assignRanks(entriesRaw);
      examBreakdowns.push({
        contentId: cid,
        examTitle: content.title ?? 'Untitled Exam',
        maxMarks: content.maxMarks ?? (best[0]?.maxMarks ?? 0),
        entries: ranked,
        totalParticipants: ranked.length,
      });
    }

    // Course-level leaderboard: aggregate marks per student across all exams
    const studentAgg = new Map<string, {
      studentId: string; studentName: string;
      totalMarks: number; totalMaxMarks: number; examsTaken: number;
      totalTimeTaken: number;
    }>();

    for (const s of bestSessionPerStudent(sessions)) {
      const existing = studentAgg.get(s.studentId);
      if (!existing) {
        studentAgg.set(s.studentId, {
          studentId: s.studentId,
          studentName: s.studentName,
          totalMarks: s.totalMarks,
          totalMaxMarks: s.maxMarks,
          examsTaken: 1,
          totalTimeTaken: s.timeTakenSeconds,
        });
      } else {
        existing.totalMarks += s.totalMarks;
        existing.totalMaxMarks += s.maxMarks;
        existing.examsTaken += 1;
        existing.totalTimeTaken += s.timeTakenSeconds;
      }
    }

    const courseEntriesRaw = Array.from(studentAgg.values()).map(a => ({
      studentId: a.studentId,
      studentName: a.studentName,
      totalMarks: a.totalMarks,
      totalMaxMarks: a.totalMaxMarks,
      percentage: a.totalMaxMarks > 0 ? (a.totalMarks / a.totalMaxMarks) * 100 : 0,
      examsTaken: a.examsTaken,
      timeTakenSeconds: a.totalTimeTaken,
    }));

    const courseEntriesRanked = assignRanks(courseEntriesRaw).map(e => ({
      studentId: e.studentId,
      studentName: e.studentName,
      totalMarks: e.totalMarks,
      totalMaxMarks: e.totalMaxMarks,
      percentage: e.percentage,
      examsTaken: e.examsTaken,
      rank: e.rank,
    })) as CourseLeaderboardEntry[];

    const result: CourseLeaderboardData = {
      courseId,
      courseTitle,
      courseThumbnail,
      courseClass,
      courseCategory,
      entries: courseEntriesRanked,
      examBreakdowns,
      totalParticipants: courseEntriesRanked.length,
      totalExams: contentIds.length,
      cachedAt: Date.now(),
    };

    setCached(courseId, result);
    return result;
  },

  // For student view: get enrolled courses with leaderboard summaries
  async getStudentLeaderboardSummaries(studentId: string): Promise<{
    enrollment: Enrollment;
    course: Course;
    courseLeaderboard: CourseLeaderboardData;
    myRank: number | null;
    myPercentage: number | null;
    top3: CourseLeaderboardEntry[];
  }[]> {
    // Fetch enrollments — do NOT swallow the error so Progress.tsx can surface it
    let enrollments = await courseEnrollmentService.getStudentEnrollments(studentId);

    // Fallback: if service returns empty, query Firestore directly trying both field names
    if (!enrollments.length) {
      try {
        // Try studentId field first
        const q1 = query(collection(db, 'enrollments'), where('studentId', '==', studentId));
        const snap1 = await getDocs(q1);
        if (!snap1.empty) {
          enrollments = snap1.docs.map(d => ({ id: d.id, ...d.data() } as any));
        } else {
          // Try userId field (legacy enrollment format)
          const q2 = query(collection(db, 'enrollments'), where('userId', '==', studentId));
          const snap2 = await getDocs(q2);
          if (!snap2.empty) {
            enrollments = snap2.docs.map(d => ({ id: d.id, ...d.data() } as any));
          }
        }
        console.log('[leaderboardService] Fallback found enrollments:', enrollments.length);
      } catch (e) {
        console.warn('[leaderboardService] Fallback enrollment query failed:', e);
      }
    }

    if (!enrollments.length) return [];

    // Fetch all courses in parallel with enrollments resolution
    const courses = await courseService.getAllCourses();
    const courseMap = new Map(courses.map(c => [c.id, c]));

    const results = await Promise.allSettled(
      enrollments.map(async (enr) => {
        // Try all possible courseId field names used by different enrollment formats
        const resolvedCourseId = enr.courseId ?? (enr as any).course ?? (enr as any).id;
        const course = courseMap.get(resolvedCourseId);
        if (!course) throw new Error(`Course not found: ${resolvedCourseId}`);

        const lb = await this.getCourseLeaderboard(
          course.id, course.title, course.thumbnailUrl ?? course.thumbnail,
          course.class, course.category
        );

        const myEntry = lb.entries.find(e => e.studentId === studentId);
        return {
          enrollment: enr,
          course,
          courseLeaderboard: lb,
          myRank: myEntry?.rank ?? null,
          myPercentage: myEntry?.percentage ?? null,
          top3: lb.entries.filter(e => e.rank <= 3).slice(0, 3),
        };
      })
    );

    // Log any rejections for debugging without hiding them from the UI
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        console.warn(`[leaderboardService] Course ${enrollments[i]?.courseId} failed:`, r.reason);
      }
    });

    return results
      .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
      .map(r => r.value);
  },

  // For admin/manager/teacher view: get course list based on role
  async getAccessibleCourseLeaderboards(
    role: string,
    uid: string,
    additionalUserId?: string
  ): Promise<{
    course: Course;
    leaderboard: CourseLeaderboardData;
  }[]> {
    let allowedCourseIds: string[] | null = null; // null = all

    if (role === 'teacher') {
      const assignments: CourseAssignment[] = await courseAssignmentService.getTeacherAssignments(uid);
      allowedCourseIds = assignments
        .filter(a => a.isActive !== false && a.permissions.includes('exams'))
        .map(a => a.courseId);
    }

    const allCourses = await courseService.getAllCourses();
    const visibleCourses = allowedCourseIds === null
      ? allCourses
      : allCourses.filter(c => allowedCourseIds!.includes(c.id));

    const results = await Promise.allSettled(
      visibleCourses.map(async (course) => {
        const leaderboard = await this.getCourseLeaderboard(
          course.id, course.title, course.thumbnailUrl ?? course.thumbnail,
          course.class, course.category
        );
        return { course, leaderboard };
      })
    );

    return results
      .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
      .map(r => r.value);
  },

  // Enrich course entries with userId/surname from enrollments (for admin view)
  async enrichEntriesWithStudentInfo(
    courseId: string,
    entries: CourseLeaderboardEntry[]
  ): Promise<CourseLeaderboardEntry[]> {
    try {
      const q = query(
        collection(db, 'enrollments'),
        where('courseId', '==', courseId)
      );
      const snap = await getDocs(q);
      const enrollMap = new Map<string, { userId?: string; surname?: string }>();
      snap.docs.forEach(d => {
        const data = d.data();
        enrollMap.set(data.studentId, {
          userId: data.userId ?? data.studentUserId,
          surname: data.surname ?? data.studentSurname,
        });
      });

      return entries.map(e => ({
        ...e,
        userId: enrollMap.get(e.studentId)?.userId,
        surname: enrollMap.get(e.studentId)?.surname,
      }));
    } catch {
      return entries;
    }
  },
};
