// src/services/examService.ts
// Production-grade Exam Service — replaces mcqService.ts
// Handles: exam sessions, attempt tracking, written answer evaluation,
//          scheduled/practice exams, result publishing, anti-cheat logging.

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
  Timestamp,
  serverTimestamp,
  increment,
  limit as firestoreLimit,
} from 'firebase/firestore';
import { db } from '../config/firebase';

// ─── Re-export content types for convenience ──────────────────────────────────
export type { MCQQuestion, WrittenQuestion, Content } from './contentService';

// ─── Exam Attempt Status ──────────────────────────────────────────────────────
export type AttemptStatus =
  | 'in_progress'
  | 'mcq_submitted'
  | 'submitted'
  | 'auto_submitted'
  | 'timed_out'
  | 'absent'
  | 'attempt_limit_reached';

export type ResultVisibility = 'hidden' | 'visible';

// ─── MCQ Answer ───────────────────────────────────────────────────────────────
export interface MCQAnswer {
  questionId: string;
  selectedOptions: number[];
  isCorrect: boolean;
  marksAwarded: number;
  timeTakenSeconds?: number;
}

// ─── Written Answer ───────────────────────────────────────────────────────────
export interface WrittenAnswer {
  questionId: string;
  answerText?: string;
  attachmentUrls?: string[];
  marksAwarded?: number;
  evaluatorComment?: string;
  evaluatedAt?: Date;
  evaluatedBy?: string;
}

// ─── Exam Session (one attempt by one student) ────────────────────────────────
export interface ExamSession {
  id: string;
  contentId: string;
  courseId?: string;
  studentId: string;
  studentName: string;
  studentEmail?: string;

  mcqQuestionIds: string[];
  writtenQuestionIds: string[];

  mcqAnswers: MCQAnswer[];
  writtenAnswers: WrittenAnswer[];

  mcqMarks: number;
  writtenMarks: number;
  totalMarks: number;
  maxMarks: number;
  percentage: number;

  status: AttemptStatus;
  resultVisibility: ResultVisibility;

  // FIX 3: attemptNumber field added
  attemptNumber: number;

  startedAt: Date;
  mcqStartedAt?: Date;       // NEW: when MCQ timer actually started (for DB-based timer)
  mcqSubmittedAt?: Date;
  writtenStartedAt?: Date;
  submittedAt?: Date;
  activeDeviceToken?: string; // NEW: single-device enforcement
  timeTakenSeconds: number;

  tabSwitchCount: number;
  focusLostCount: number;
  suspiciousActivity: string[];

  writtenEvaluationPending: boolean;
  writtenEvaluatedAt?: Date;
  writtenEvaluatedBy?: string;

  createdAt: Date;
  updatedAt?: Date;
}

// ─── Student Exam Status (per content per student) ────────────────────────────
export interface StudentExamStatus {
  id: string;
  contentId: string;
  studentId: string;
  courseId?: string;
  attemptCount: number;
  lastAttemptId?: string;
  lastAttemptAt?: Date;
  status: 'not_started' | 'in_progress' | 'mcq_submitted' | 'completed' | 'absent' | 'attempt_limit_reached';
  bestScore?: number;
  bestPercentage?: number;
}

// ─── Written Evaluation Payload ───────────────────────────────────────────────
export interface WrittenEvaluationPayload {
  sessionId: string;
  evaluatorId: string;
  evaluatorName: string;
  answers: Array<{
    questionId: string;
    marksAwarded: number;
    comment?: string;
  }>;
}

// ─── Helper: safe Timestamp → Date conversion ─────────────────────────────────
const toDate = (v: any): Date => {
  if (!v) return new Date();
  if (v instanceof Date) return v;
  if (v?.toDate) return v.toDate();
  if (typeof v === 'number') return new Date(v);
  if (typeof v === 'string') return new Date(v);
  return new Date();
};

const toOptDate = (v: any): Date | undefined => {
  if (!v) return undefined;
  return toDate(v);
};

// ─── Helper: strip undefined recursively ─────────────────────────────────────
const clean = (obj: any): any => {
  if (obj === null || obj === undefined) return null;
  if (Array.isArray(obj)) return obj.map(clean).filter(i => i !== undefined);
  if (obj instanceof Date || obj instanceof Timestamp) return obj;
  if (typeof obj === 'object') {
    const out: any = {};
    for (const k in obj) {
      if (obj[k] !== undefined) out[k] = clean(obj[k]);
    }
    return out;
  }
  return obj;
};

// ─── Helper: deserialize ExamSession from Firestore ───────────────────────────
const deserializeSession = (id: string, data: any): ExamSession => ({
  id,
  contentId: data.contentId,
  courseId: data.courseId,
  studentId: data.studentId,
  studentName: data.studentName,
  studentEmail: data.studentEmail,
  mcqQuestionIds: data.mcqQuestionIds || [],
  writtenQuestionIds: data.writtenQuestionIds || [],
  mcqAnswers: data.mcqAnswers || [],
  writtenAnswers: data.writtenAnswers || [],
  mcqMarks: data.mcqMarks ?? 0,
  writtenMarks: data.writtenMarks ?? 0,
  totalMarks: data.totalMarks ?? 0,
  maxMarks: data.maxMarks ?? 0,
  percentage: data.percentage ?? 0,
  status: data.status ?? 'in_progress',
  resultVisibility: data.resultVisibility ?? 'hidden',
  // FIX 3: deserialize attemptNumber, fallback to 1
  attemptNumber: data.attemptNumber ?? 1,
  startedAt: toDate(data.startedAt),
  mcqStartedAt: toOptDate(data.mcqStartedAt),
  mcqSubmittedAt: toOptDate(data.mcqSubmittedAt),
  writtenStartedAt: toOptDate(data.writtenStartedAt),
  submittedAt: toOptDate(data.submittedAt),
  timeTakenSeconds: data.timeTakenSeconds ?? 0,
  tabSwitchCount: data.tabSwitchCount ?? 0,
  focusLostCount: data.focusLostCount ?? 0,
  suspiciousActivity: data.suspiciousActivity || [],
  writtenEvaluationPending: data.writtenEvaluationPending ?? false,
  writtenEvaluatedAt: toOptDate(data.writtenEvaluatedAt),
  writtenEvaluatedBy: data.writtenEvaluatedBy,
  activeDeviceToken: data.activeDeviceToken,
  createdAt: toDate(data.createdAt),
  updatedAt: toOptDate(data.updatedAt),
});

// ─── examService ──────────────────────────────────────────────────────────────
export const examService = {

  // ── 1. Check if student can take the exam ────────────────────────────────────
  async getStudentExamStatus(
    contentId: string,
    studentId: string,
    courseId?: string
  ): Promise<StudentExamStatus | null> {
    try {
      const q = query(
        collection(db, 'studentExamStatus'),
        where('contentId', '==', contentId),
        where('studentId', '==', studentId)
      );
      const snap = await getDocs(q);
      if (snap.empty) return null;
      const d = snap.docs[0];
      return {
        id: d.id,
        ...d.data(),
        lastAttemptAt: toOptDate(d.data().lastAttemptAt),
      } as StudentExamStatus;
    } catch (e: any) {
      console.error('examService.getStudentExamStatus:', e);
      return null;
    }
  },

  // ── 2. Start an exam session ──────────────────────────────────────────────────
  async startExamSession(payload: {
    contentId: string;
    courseId?: string;
    studentId: string;
    studentName: string;
    studentEmail?: string;
    deviceToken: string;       // NEW: unique token for this browser tab/device
    mcqQuestionIds: string[];
    writtenQuestionIds: string[];
    maxMarks: number;
    resultVisibility: ResultVisibility;
  }): Promise<string> {
    // FIX 3: compute attemptNumber before creating session
    const existingStatus = await examService.getStudentExamStatus(
      payload.contentId,
      payload.studentId
    );
    const attemptNumber = (existingStatus?.attemptCount ?? 0) + 1;

    const now = Timestamp.now();
    const sessionData = clean({
      contentId: payload.contentId,
      courseId: payload.courseId,
      studentId: payload.studentId,
      studentName: payload.studentName,
      studentEmail: payload.studentEmail,
      activeDeviceToken: payload.deviceToken,
      mcqStartedAt: now,            // NEW: record exact MCQ start time
      attemptNumber,
      mcqQuestionIds: payload.mcqQuestionIds,
      writtenQuestionIds: payload.writtenQuestionIds,
      maxMarks: payload.maxMarks,
      resultVisibility: payload.resultVisibility,
      mcqAnswers: [],
      writtenAnswers: payload.writtenQuestionIds.map(qId => ({
        questionId: qId,
        answerText: '',
        attachmentUrls: [],
      })),
      mcqMarks: 0,
      writtenMarks: 0,
      totalMarks: 0,
      percentage: 0,
      status: 'in_progress',
      tabSwitchCount: 0,
      focusLostCount: 0,
      suspiciousActivity: [],
      writtenEvaluationPending: payload.writtenQuestionIds.length > 0,
      startedAt: Timestamp.now(),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    const ref = await addDoc(collection(db, 'examSessions'), sessionData);

    await examService._upsertStudentExamStatus({
      contentId: payload.contentId,
      courseId: payload.courseId,
      studentId: payload.studentId,
      lastAttemptId: ref.id,
      status: 'in_progress',
    });

    return ref.id;
  },

  // ── 3. Save MCQ answers (called periodically/on navigation) ──────────────────
  async saveMCQAnswers(
    sessionId: string,
    mcqAnswers: MCQAnswer[],
    mcqMarks: number
  ): Promise<void> {
    await updateDoc(doc(db, 'examSessions', sessionId), clean({
      mcqAnswers,
      mcqMarks,
      updatedAt: Timestamp.now(),
    }));
  },

  // ── 3b. FIX 2: submitMCQPart takes only sessionId ────────────────────────────
  // Answers already saved via saveMCQAnswers before this is called.
  async submitMCQPart(sessionId: string): Promise<void> {
    const session = await examService.getExamSession(sessionId);
    if (!session) throw new Error('Session not found');

    await updateDoc(doc(db, 'examSessions', sessionId), clean({
      status: 'mcq_submitted',
      mcqSubmittedAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    }));

    await examService._upsertStudentExamStatus({
      contentId: session.contentId,
      courseId: session.courseId,
      studentId: session.studentId,
      lastAttemptId: sessionId,
      status: 'mcq_submitted',
    });
  },

  // ── 3c. Start written part after MCQ ─────────────────────────────────────────
  async startWrittenPart(sessionId: string): Promise<void> {
    await updateDoc(doc(db, 'examSessions', sessionId), clean({
      status: 'in_progress',
      writtenStartedAt: Timestamp.now(),   // exact written start time for DB-timer
      updatedAt: Timestamp.now(),
    }));
  },

  // ── NEW: Claim this device as the active device for a session ─────────────────
  // Returns false if another device already has the lock.
  async claimDevice(sessionId: string, deviceToken: string): Promise<boolean> {
    try {
      const snap = await getDoc(doc(db, 'examSessions', sessionId));
      if (!snap.exists()) return false;
      const existing = snap.data().activeDeviceToken;
      if (existing && existing !== deviceToken) return false; // another device holds the lock
      await updateDoc(doc(db, 'examSessions', sessionId), {
        activeDeviceToken: deviceToken,
        updatedAt: Timestamp.now(),
      });
      return true;
    } catch {
      return false;
    }
  },

  // ── NEW: Release device lock on session (called on beforeunload) ───────────────
  async releaseDevice(sessionId: string, deviceToken: string): Promise<void> {
    try {
      const snap = await getDoc(doc(db, 'examSessions', sessionId));
      if (!snap.exists()) return;
      if (snap.data().activeDeviceToken !== deviceToken) return;
      await updateDoc(doc(db, 'examSessions', sessionId), {
        activeDeviceToken: null,
        updatedAt: Timestamp.now(),
      });
    } catch { /* best-effort */ }
  },

  // ── 4. Save written answers ───────────────────────────────────────────────────
  async saveWrittenAnswers(
    sessionId: string,
    writtenAnswers: WrittenAnswer[]
  ): Promise<void> {
    await updateDoc(doc(db, 'examSessions', sessionId), clean({
      writtenAnswers,
      updatedAt: Timestamp.now(),
    }));
  },

  // ── 5. Log anti-cheat event ───────────────────────────────────────────────────
  async logAntiCheatEvent(
    sessionId: string,
    event: 'tab_switch' | 'focus_lost' | 'right_click' | 'copy_attempt' | 'fullscreen_exit' | string
  ): Promise<void> {
    try {
      const ref = doc(db, 'examSessions', sessionId);
      const snap = await getDoc(ref);
      if (!snap.exists()) return;
      const data = snap.data();

      const updates: any = {
        suspiciousActivity: [
          ...(data.suspiciousActivity || []),
          `${event} @ ${new Date().toISOString()}`,
        ],
        updatedAt: Timestamp.now(),
      };

      if (event === 'tab_switch') updates.tabSwitchCount = increment(1);
      if (event === 'focus_lost') updates.focusLostCount = increment(1);

      await updateDoc(ref, updates);
    } catch (e) {
      console.warn('examService.logAntiCheatEvent:', e);
    }
  },

  // ── 6. Submit exam ────────────────────────────────────────────────────────────
  async submitExamSession(
    sessionId: string,
    mcqAnswers: MCQAnswer[],
    writtenAnswers: WrittenAnswer[],
    mcqMarks: number,
    timeTakenSeconds: number,
    autoSubmit = false
  ): Promise<void> {
    const session = await examService.getExamSession(sessionId);
    if (!session) throw new Error('Session not found');

    const writtenEvaluationPending = session.writtenQuestionIds.length > 0;
    const totalMarks = mcqMarks;
    const percentage = session.maxMarks > 0 ? (totalMarks / session.maxMarks) * 100 : 0;

    await updateDoc(doc(db, 'examSessions', sessionId), clean({
      mcqAnswers,
      writtenAnswers,
      mcqMarks,
      writtenMarks: 0,
      totalMarks,
      percentage,
      status: autoSubmit ? 'auto_submitted' : 'submitted',
      submittedAt: Timestamp.now(),
      timeTakenSeconds,
      writtenEvaluationPending,
      updatedAt: Timestamp.now(),
    }));

    await examService._upsertStudentExamStatus({
      contentId: session.contentId,
      courseId: session.courseId,
      studentId: session.studentId,
      lastAttemptId: sessionId,
      status: 'completed',
      bestScore: totalMarks,
      bestPercentage: percentage,
      incrementAttempt: false,
    });
  },

  // ── 7. Mark absent ────────────────────────────────────────────────────────────
  async markAbsent(
    contentId: string,
    studentId: string,
    courseId?: string
  ): Promise<void> {
    await examService._upsertStudentExamStatus({
      contentId,
      courseId,
      studentId,
      status: 'absent',
      incrementAttempt: false,
    });
  },

  // ── 8. Mark attempt limit reached ────────────────────────────────────────────
  async markAttemptLimitReached(
    contentId: string,
    studentId: string,
    courseId?: string
  ): Promise<void> {
    await examService._upsertStudentExamStatus({
      contentId,
      courseId,
      studentId,
      status: 'attempt_limit_reached',
      incrementAttempt: false,
    });
  },

  // ── 9. Get exam session by ID ─────────────────────────────────────────────────
  async getExamSession(sessionId: string): Promise<ExamSession | null> {
    try {
      const snap = await getDoc(doc(db, 'examSessions', sessionId));
      if (!snap.exists()) return null;
      return deserializeSession(snap.id, snap.data());
    } catch (e: any) {
      console.error('examService.getExamSession:', e);
      return null;
    }
  },

  // ── 10. Get all sessions for a student on a content ──────────────────────────
  async getStudentSessionsForContent(
    contentId: string,
    studentId: string
  ): Promise<ExamSession[]> {
    try {
      const q = query(
        collection(db, 'examSessions'),
        where('contentId', '==', contentId),
        where('studentId', '==', studentId),
        orderBy('createdAt', 'asc')
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => deserializeSession(d.id, d.data()));
    } catch (e: any) {
      console.error('examService.getStudentSessionsForContent:', e);
      return [];
    }
  },

  // ── 11. Get all sessions for a content (teacher view) ─────────────────────────
  async getAllSessionsForContent(
    contentId: string,
    courseId?: string
  ): Promise<ExamSession[]> {
    try {
      const q = query(
        collection(db, 'examSessions'),
        where('contentId', '==', contentId),
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      let sessions = snap.docs.map(d => deserializeSession(d.id, d.data()));
      if (courseId) sessions = sessions.filter(s => s.courseId === courseId);
      return sessions;
    } catch (e: any) {
      console.error('examService.getAllSessionsForContent:', e);
      return [];
    }
  },

  // ── 12. Get sessions pending written evaluation ───────────────────────────────
  async getPendingWrittenEvaluations(contentId?: string): Promise<ExamSession[]> {
    try {
      const constraints: any[] = [
        where('writtenEvaluationPending', '==', true),
        where('status', 'in', ['submitted', 'auto_submitted']),
        orderBy('submittedAt', 'asc'),
      ];
      if (contentId) constraints.unshift(where('contentId', '==', contentId));

      const q = query(collection(db, 'examSessions'), ...constraints);
      const snap = await getDocs(q);
      return snap.docs.map(d => deserializeSession(d.id, d.data()));
    } catch (e: any) {
      console.error('examService.getPendingWrittenEvaluations:', e);
      return [];
    }
  },

  // ── 13. Submit written evaluation (teacher) ───────────────────────────────────
  async submitWrittenEvaluation(payload: WrittenEvaluationPayload): Promise<void> {
    const session = await examService.getExamSession(payload.sessionId);
    if (!session) throw new Error('Session not found');

    const updatedWrittenAnswers = session.writtenAnswers.map(wa => {
      const eval_ = payload.answers.find(a => a.questionId === wa.questionId);
      if (!eval_) return wa;
      return {
        ...wa,
        marksAwarded: eval_.marksAwarded,
        evaluatorComment: eval_.comment ?? '',
        evaluatedAt: new Date(),
        evaluatedBy: payload.evaluatorId,
      };
    });

    const writtenMarks = payload.answers.reduce((sum, a) => sum + a.marksAwarded, 0);
    const totalMarks = session.mcqMarks + writtenMarks;
    const percentage = session.maxMarks > 0 ? (totalMarks / session.maxMarks) * 100 : 0;

    await updateDoc(doc(db, 'examSessions', payload.sessionId), clean({
      writtenAnswers: updatedWrittenAnswers,
      writtenMarks,
      totalMarks,
      percentage,
      writtenEvaluationPending: false,
      writtenEvaluatedAt: Timestamp.now(),
      writtenEvaluatedBy: payload.evaluatorId,
      updatedAt: Timestamp.now(),
    }));

    await examService._upsertStudentExamStatus({
      contentId: session.contentId,
      courseId: session.courseId,
      studentId: session.studentId,
      lastAttemptId: payload.sessionId,
      status: 'completed',
      bestScore: totalMarks,
      bestPercentage: percentage,
      incrementAttempt: false,
    });
  },

  // ── 14. Publish results for a content ─────────────────────────────────────────
  async publishResults(contentId: string): Promise<void> {
    try {
      const sessions = await examService.getAllSessionsForContent(contentId);
      await Promise.all(
        sessions
          .filter(s => s.resultVisibility === 'hidden' && s.status !== 'in_progress' && s.status !== 'mcq_submitted')
          .map(s =>
            updateDoc(doc(db, 'examSessions', s.id), {
              resultVisibility: 'visible',
              updatedAt: Timestamp.now(),
            })
          )
      );
    } catch (e: any) {
      console.error('examService.publishResults:', e);
      throw e;
    }
  },

  // ── 15. Add written answer attachment ─────────────────────────────────────────
  async addWrittenAttachment(
    sessionId: string,
    questionId: string,
    fileUrl: string
  ): Promise<void> {
    const session = await examService.getExamSession(sessionId);
    if (!session) throw new Error('Session not found');

    const updatedAnswers = session.writtenAnswers.map(wa => {
      if (wa.questionId !== questionId) return wa;
      return { ...wa, attachmentUrls: [...(wa.attachmentUrls || []), fileUrl] };
    });

    await updateDoc(doc(db, 'examSessions', sessionId), clean({
      writtenAnswers: updatedAnswers,
      updatedAt: Timestamp.now(),
    }));
  },

  // ── 16. Remove written answer attachment ──────────────────────────────────────
  async removeWrittenAttachment(
    sessionId: string,
    questionId: string,
    fileUrl: string
  ): Promise<void> {
    const session = await examService.getExamSession(sessionId);
    if (!session) throw new Error('Session not found');

    const updatedAnswers = session.writtenAnswers.map(wa => {
      if (wa.questionId !== questionId) return wa;
      return { ...wa, attachmentUrls: (wa.attachmentUrls || []).filter(u => u !== fileUrl) };
    });

    await updateDoc(doc(db, 'examSessions', sessionId), clean({
      writtenAnswers: updatedAnswers,
      updatedAt: Timestamp.now(),
    }));
  },

  // ── 17. Get leaderboard for a content ─────────────────────────────────────────
  async getLeaderboard(contentId: string, top = 50): Promise<ExamSession[]> {
    try {
      const sessions = await examService.getAllSessionsForContent(contentId);
      return sessions
        .filter(s => ['submitted', 'auto_submitted'].includes(s.status) && s.resultVisibility === 'visible')
        .sort((a, b) => {
          if (b.percentage !== a.percentage) return b.percentage - a.percentage;
          return a.timeTakenSeconds - b.timeTakenSeconds;
        })
        .slice(0, top);
    } catch (e: any) {
      console.error('examService.getLeaderboard:', e);
      return [];
    }
  },

  // ── 18. Get exam statistics for a content ─────────────────────────────────────
  async getExamStatistics(contentId: string): Promise<{
    totalAttempts: number;
    averageScore: number;
    averagePercentage: number;
    highestScore: number;
    lowestScore: number;
    passRate: number;
    pendingEvaluations: number;
  }> {
    try {
      const sessions = await examService.getAllSessionsForContent(contentId);
      const completed = sessions.filter(s =>
        ['submitted', 'auto_submitted'].includes(s.status)
      );

      if (completed.length === 0) {
        return { totalAttempts: 0, averageScore: 0, averagePercentage: 0, highestScore: 0, lowestScore: 0, passRate: 0, pendingEvaluations: 0 };
      }

      const scores = completed.map(s => s.percentage);
      const pendingEvaluations = completed.filter(s => s.writtenEvaluationPending).length;

      return {
        totalAttempts: completed.length,
        averageScore: completed.reduce((s, a) => s + a.totalMarks, 0) / completed.length,
        averagePercentage: scores.reduce((a, b) => a + b, 0) / scores.length,
        highestScore: Math.max(...scores),
        lowestScore: Math.min(...scores),
        passRate: (scores.filter(s => s >= 40).length / scores.length) * 100,
        pendingEvaluations,
      };
    } catch (e: any) {
      console.error('examService.getExamStatistics:', e);
      return { totalAttempts: 0, averageScore: 0, averagePercentage: 0, highestScore: 0, lowestScore: 0, passRate: 0, pendingEvaluations: 0 };
    }
  },

  // ── Internal: upsert StudentExamStatus ────────────────────────────────────────
  async _upsertStudentExamStatus(payload: {
    contentId: string;
    courseId?: string;
    studentId: string;
    lastAttemptId?: string;
    status: StudentExamStatus['status'];
    bestScore?: number;
    bestPercentage?: number;
    incrementAttempt?: boolean;
  }): Promise<void> {
    try {
      const q = query(
        collection(db, 'studentExamStatus'),
        where('contentId', '==', payload.contentId),
        where('studentId', '==', payload.studentId)
      );
      const snap = await getDocs(q);

      const shouldIncrement = payload.incrementAttempt !== undefined
        ? payload.incrementAttempt
        : payload.status === 'in_progress';

      if (snap.empty) {
        await addDoc(collection(db, 'studentExamStatus'), clean({
          contentId: payload.contentId,
          courseId: payload.courseId,
          studentId: payload.studentId,
          lastAttemptId: payload.lastAttemptId,
          status: payload.status,
          attemptCount: shouldIncrement ? 1 : 0,
          lastAttemptAt: Timestamp.now(),
          bestScore: payload.bestScore,
          bestPercentage: payload.bestPercentage,
        }));
      } else {
        const existing = snap.docs[0].data();
        const newBest = payload.bestScore !== undefined
          ? Math.max(existing.bestScore ?? 0, payload.bestScore)
          : existing.bestScore;
        const newBestPct = payload.bestPercentage !== undefined
          ? Math.max(existing.bestPercentage ?? 0, payload.bestPercentage)
          : existing.bestPercentage;

        await updateDoc(snap.docs[0].ref, clean({
          contentId: payload.contentId,
          courseId: payload.courseId,
          studentId: payload.studentId,
          lastAttemptId: payload.lastAttemptId,
          status: payload.status,
          attemptCount: shouldIncrement
            ? (existing.attemptCount ?? 0) + 1
            : existing.attemptCount ?? 0,
          lastAttemptAt: Timestamp.now(),
          bestScore: newBest,
          bestPercentage: newBestPct,
        }));
      }
    } catch (e) {
      console.warn('examService._upsertStudentExamStatus:', e);
    }
  },
};

export default examService;
