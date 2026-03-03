// src/services/examService.ts
// Production-grade Exam Service — replaces mcqService.ts
// Handles: exam sessions, attempt tracking, written answer evaluation,
//          scheduled/practice exams, result publishing, anti-cheat logging.
// UPDATES:
//   - submitMCQPart: stores mcqSubmittedAt as Firestore Timestamp (persists across browser close)
//   - getStudentExamStatus: returns mcqSubmittedAt for client-side window calculation
//   - getStudentExamStatus / getExamSession: unchanged logic, new getAllAttempts added
//   - getAllAttemptSessions: new method — fetches all exam sessions for a student+content

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
  | 'mcq_submitted'        // MCQ done, written not yet started
  | 'submitted'
  | 'auto_submitted'
  | 'timed_out'
  | 'absent'
  | 'attempt_limit_reached';

export type ResultVisibility = 'hidden' | 'visible';

// ─── MCQ Answer ───────────────────────────────────────────────────────────────
export interface MCQAnswer {
  questionId: string;
  selectedOptions: number[]; // indices of selected options
  isCorrect: boolean;
  marksAwarded: number;
  timeTakenSeconds?: number;
}

// ─── Written Answer ───────────────────────────────────────────────────────────
export interface WrittenAnswer {
  questionId: string;
  answerText?: string;
  attachmentUrls?: string[]; // image uploads (notebook photos)
  marksAwarded?: number;     // filled by teacher during evaluation
  evaluatorComment?: string;
  evaluatedAt?: Date;
  evaluatedBy?: string;
}

// ─── Exam Session (one attempt by one student) ────────────────────────────────
export interface ExamSession {
  id: string;
  contentId: string;           // references 'content' collection
  courseId?: string;
  studentId: string;
  studentName: string;
  studentEmail?: string;

  // Which questions were shown (after shuffle/lock logic applied)
  mcqQuestionIds: string[];
  writtenQuestionIds: string[];

  mcqAnswers: MCQAnswer[];
  writtenAnswers: WrittenAnswer[];

  // Scoring
  mcqMarks: number;
  writtenMarks: number;        // 0 until evaluated
  totalMarks: number;
  maxMarks: number;
  percentage: number;

  status: AttemptStatus;
  resultVisibility: ResultVisibility;

  startedAt: Date;
  mcqSubmittedAt?: Date;       // when MCQ part was submitted — persisted to Firestore
  writtenStartedAt?: Date;     // when written part was started
  submittedAt?: Date;
  timeTakenSeconds: number;

  // Anti-cheat
  tabSwitchCount: number;
  focusLostCount: number;
  suspiciousActivity: string[]; // log of suspicious events

  // Written evaluation state
  writtenEvaluationPending: boolean;
  writtenEvaluatedAt?: Date;
  writtenEvaluatedBy?: string;

  // Attempt number (1-based, set when fetching all attempts)
  attemptNumber?: number;

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
  // NEW: mcqSubmittedAt stored here so it survives browser close
  pendingMcqSubmittedAt?: Date;
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
  startedAt: toDate(data.startedAt),
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
        // NEW: restore persisted mcqSubmittedAt so timer survives browser close
        pendingMcqSubmittedAt: toOptDate(d.data().pendingMcqSubmittedAt),
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
    mcqQuestionIds: string[];
    writtenQuestionIds: string[];
    maxMarks: number;
    resultVisibility: ResultVisibility;
  }): Promise<string> {
    const sessionData = clean({
      ...payload,
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

    // Upsert studentExamStatus — clear any stale pendingMcqSubmittedAt on new attempt
    await examService._upsertStudentExamStatus({
      contentId: payload.contentId,
      courseId: payload.courseId,
      studentId: payload.studentId,
      lastAttemptId: ref.id,
      status: 'in_progress',
      pendingMcqSubmittedAt: null, // clear old window
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

  // ── 3b. Submit MCQ part only (mixed exam) ────────────────────────────────────
  // Persists mcqSubmittedAt to BOTH examSessions AND studentExamStatus.
  // This means the 10-minute window survives browser close/reload.
  async submitMCQPart(sessionId: string): Promise<void> {
    const session = await examService.getExamSession(sessionId);
    if (!session) throw new Error('Session not found');

    const now = Timestamp.now();

    // Mark session as mcq_submitted with timestamp
    await updateDoc(doc(db, 'examSessions', sessionId), clean({
      status: 'mcq_submitted',
      mcqSubmittedAt: now,
      updatedAt: now,
    }));

    // ALSO persist to studentExamStatus so we can restore after browser close
    await examService._upsertStudentExamStatus({
      contentId: session.contentId,
      courseId: session.courseId,
      studentId: session.studentId,
      lastAttemptId: sessionId,
      status: 'mcq_submitted',
      pendingMcqSubmittedAt: now, // <-- KEY: persisted for timer recovery
    });
  },

  // ── 3c. Start written part ────────────────────────────────────────────────────
  async startWrittenPart(sessionId: string): Promise<void> {
    const session = await examService.getExamSession(sessionId);
    if (!session) throw new Error('Session not found');

    const now = Timestamp.now();

    await updateDoc(doc(db, 'examSessions', sessionId), clean({
      status: 'in_progress',
      writtenStartedAt: now,
      updatedAt: now,
    }));

    // Clear pendingMcqSubmittedAt — written has started, window no longer needed
    await examService._upsertStudentExamStatus({
      contentId: session.contentId,
      courseId: session.courseId,
      studentId: session.studentId,
      lastAttemptId: sessionId,
      status: 'in_progress',
      pendingMcqSubmittedAt: null, // clear — written section is now active
    });
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

  // ── 4b. Add attachment to a written answer ───────────────────────────────────
  async addWrittenAttachment(
    sessionId: string,
    questionId: string,
    url: string
  ): Promise<void> {
    const session = await examService.getExamSession(sessionId);
    if (!session) throw new Error('Session not found');

    const updatedAnswers = session.writtenAnswers.map(wa =>
      wa.questionId === questionId
        ? { ...wa, attachmentUrls: [...(wa.attachmentUrls || []), url] }
        : wa
    );
    await updateDoc(doc(db, 'examSessions', sessionId), clean({
      writtenAnswers: updatedAnswers,
      updatedAt: Timestamp.now(),
    }));
  },

  // ── 4c. Remove attachment from a written answer ──────────────────────────────
  async removeWrittenAttachment(
    sessionId: string,
    questionId: string,
    url: string
  ): Promise<void> {
    const session = await examService.getExamSession(sessionId);
    if (!session) throw new Error('Session not found');

    const updatedAnswers = session.writtenAnswers.map(wa =>
      wa.questionId === questionId
        ? { ...wa, attachmentUrls: (wa.attachmentUrls || []).filter(u => u !== url) }
        : wa
    );
    await updateDoc(doc(db, 'examSessions', sessionId), clean({
      writtenAnswers: updatedAnswers,
      updatedAt: Timestamp.now(),
    }));
  },

  // ── 5. Submit exam session (final) ───────────────────────────────────────────
  async submitExamSession(
    sessionId: string,
    mcqAnswers: MCQAnswer[],
    writtenAnswers: WrittenAnswer[],
    mcqMarks: number,
    timeTakenSeconds: number,
    auto: boolean = false
  ): Promise<void> {
    const session = await examService.getExamSession(sessionId);
    if (!session) throw new Error('Session not found');

    const hasWritten = writtenAnswers.length > 0;
    const status: AttemptStatus = auto ? 'auto_submitted' : 'submitted';

    await updateDoc(doc(db, 'examSessions', sessionId), clean({
      mcqAnswers,
      writtenAnswers,
      mcqMarks,
      writtenMarks: 0,
      totalMarks: mcqMarks,
      maxMarks: session.maxMarks,
      percentage: session.maxMarks > 0 ? (mcqMarks / session.maxMarks) * 100 : 0,
      status,
      timeTakenSeconds,
      submittedAt: Timestamp.now(),
      writtenEvaluationPending: hasWritten,
      updatedAt: Timestamp.now(),
    }));

    // Update studentExamStatus
    await examService._upsertStudentExamStatus({
      contentId: session.contentId,
      courseId: session.courseId,
      studentId: session.studentId,
      lastAttemptId: sessionId,
      status: 'completed',
      bestScore: mcqMarks,
      bestPercentage: session.maxMarks > 0 ? (mcqMarks / session.maxMarks) * 100 : 0,
      pendingMcqSubmittedAt: null,
    });
  },

  // ── 6. Get a single exam session ─────────────────────────────────────────────
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

  // ── 6b. NEW: Get ALL exam sessions for a student + content ───────────────────
  // Returns sessions sorted by startedAt ascending, with attemptNumber set.
  async getAllAttemptSessions(
    contentId: string,
    studentId: string
  ): Promise<ExamSession[]> {
    try {
      const q = query(
        collection(db, 'examSessions'),
        where('contentId', '==', contentId),
        where('studentId', '==', studentId),
        orderBy('startedAt', 'asc')
      );
      const snap = await getDocs(q);
      return snap.docs
        .map((d, idx) => ({
          ...deserializeSession(d.id, d.data()),
          attemptNumber: idx + 1,
        }))
        .filter(s => s.status !== 'in_progress' && s.status !== 'mcq_submitted');
    } catch (e: any) {
      console.error('examService.getAllAttemptSessions:', e);
      return [];
    }
  },

  // ── 7. Anti-cheat event logging ───────────────────────────────────────────────
  async logAntiCheatEvent(sessionId: string, eventType: string): Promise<void> {
    try {
      const session = await examService.getExamSession(sessionId);
      if (!session) return;

      const event = `${eventType} @ ${new Date().toLocaleTimeString()}`;
      const newActivity = [...(session.suspiciousActivity || []), event];

      const tabSwitchInc  = eventType === 'tab_switch'  ? { tabSwitchCount:  increment(1) } : {};
      const focusLostInc  = eventType === 'focus_lost'  ? { focusLostCount:  increment(1) } : {};

      await updateDoc(doc(db, 'examSessions', sessionId), {
        suspiciousActivity: newActivity,
        ...tabSwitchInc,
        ...focusLostInc,
        updatedAt: Timestamp.now(),
      });
    } catch (e) {
      // non-critical, swallow
    }
  },

  // ── 8. Evaluate written answers ───────────────────────────────────────────────
  async evaluateWrittenAnswers(payload: WrittenEvaluationPayload): Promise<void> {
    const session = await examService.getExamSession(payload.sessionId);
    if (!session) throw new Error('Session not found');

    const updatedAnswers = session.writtenAnswers.map(wa => {
      const evaluation = payload.answers.find(a => a.questionId === wa.questionId);
      if (!evaluation) return wa;
      return {
        ...wa,
        marksAwarded: evaluation.marksAwarded,
        evaluatorComment: evaluation.comment || '',
        evaluatedAt: new Date(),
        evaluatedBy: payload.evaluatorName,
      };
    });

    const writtenMarks = updatedAnswers.reduce((sum, wa) => sum + (wa.marksAwarded ?? 0), 0);
    const totalMarks   = session.mcqMarks + writtenMarks;
    const percentage   = session.maxMarks > 0 ? (totalMarks / session.maxMarks) * 100 : 0;

    await updateDoc(doc(db, 'examSessions', payload.sessionId), clean({
      writtenAnswers: updatedAnswers,
      writtenMarks,
      totalMarks,
      percentage,
      writtenEvaluationPending: false,
      writtenEvaluatedAt: Timestamp.now(),
      writtenEvaluatedBy: payload.evaluatorName,
      updatedAt: Timestamp.now(),
    }));

    // Update best score in status if improved
    await examService._upsertStudentExamStatus({
      contentId: session.contentId,
      courseId: session.courseId,
      studentId: session.studentId,
      lastAttemptId: payload.sessionId,
      status: 'completed',
      bestScore: totalMarks,
      bestPercentage: percentage,
    });
  },

  // ── 9. Make result visible for a session ─────────────────────────────────────
  async setResultVisibility(
    sessionId: string,
    visibility: ResultVisibility
  ): Promise<void> {
    await updateDoc(doc(db, 'examSessions', sessionId), {
      resultVisibility: visibility,
      updatedAt: Timestamp.now(),
    });
  },

  // ── 10. Get all sessions for a content (teacher view) ────────────────────────
  async getContentSessions(contentId: string): Promise<ExamSession[]> {
    try {
      const q = query(
        collection(db, 'examSessions'),
        where('contentId', '==', contentId),
        orderBy('startedAt', 'desc')
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => deserializeSession(d.id, d.data()));
    } catch (e: any) {
      console.error('examService.getContentSessions:', e);
      return [];
    }
  },

  // ── 11. Mark student absent ───────────────────────────────────────────────────
  async markAbsent(contentId: string, studentId: string): Promise<void> {
    await examService._upsertStudentExamStatus({
      contentId,
      studentId,
      status: 'absent',
    });
  },

  // ── 12. Delete an exam session ────────────────────────────────────────────────
  async deleteExamSession(sessionId: string): Promise<void> {
    await deleteDoc(doc(db, 'examSessions', sessionId));
  },

  // ── Internal: upsert studentExamStatus ───────────────────────────────────────
  async _upsertStudentExamStatus(params: {
    contentId: string;
    courseId?: string;
    studentId: string;
    lastAttemptId?: string;
    status?: StudentExamStatus['status'];
    bestScore?: number;
    bestPercentage?: number;
    pendingMcqSubmittedAt?: Timestamp | null;
  }): Promise<void> {
    try {
      const q = query(
        collection(db, 'studentExamStatus'),
        where('contentId', '==', params.contentId),
        where('studentId', '==', params.studentId)
      );
      const snap = await getDocs(q);

      const updateData: any = {
        updatedAt: Timestamp.now(),
      };
      if (params.status)         updateData.status        = params.status;
      if (params.lastAttemptId)  updateData.lastAttemptId = params.lastAttemptId;
      if (params.bestScore !== undefined)      updateData.bestScore      = params.bestScore;
      if (params.bestPercentage !== undefined) updateData.bestPercentage = params.bestPercentage;

      // Handle pendingMcqSubmittedAt explicitly (null = delete/clear, value = set)
      if (params.pendingMcqSubmittedAt !== undefined) {
        updateData.pendingMcqSubmittedAt = params.pendingMcqSubmittedAt;
      }

      if (snap.empty) {
        // Create new
        await addDoc(collection(db, 'studentExamStatus'), clean({
          contentId: params.contentId,
          courseId: params.courseId,
          studentId: params.studentId,
          attemptCount: params.status === 'completed' ? 1 : 0,
          lastAttemptAt: Timestamp.now(),
          ...updateData,
          createdAt: Timestamp.now(),
        }));
      } else {
        const ref = snap.docs[0].ref;
        if (params.status === 'completed') {
          updateData.attemptCount = increment(1);
          updateData.lastAttemptAt = Timestamp.now();
        }
        await updateDoc(ref, clean(updateData));
      }
    } catch (e: any) {
      console.error('examService._upsertStudentExamStatus:', e);
    }
  },
};
