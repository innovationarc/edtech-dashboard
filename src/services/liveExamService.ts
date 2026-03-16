// src/services/liveExamService.ts
// Production-grade Live Exam Service
// Handles: live exam creation, audience targeting, attempt tracking, participant stats

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
  increment,
} from 'firebase/firestore';
import { db } from '../config/firebase';

// ─── Types ────────────────────────────────────────────────────────────────────

export type LiveExamStatus = 'draft' | 'active' | 'ended';
export type LiveExamAudience = 'all' | 'course_based';

export interface LiveExamCourseTarget {
  courseId: string;
  courseName: string;
}

/** Top-level document stored in `liveExams` collection */
export interface LiveExam {
  id: string;
  name: string;

  // Linked exam-type content
  contentId: string;
  contentTitle: string;
  contentSubject?: string;
  contentExamType?: 'mcq' | 'written' | 'mixed';

  // Audience
  audience: LiveExamAudience;
  courseTargets: LiveExamCourseTarget[]; // only used when audience === 'course_based'

  // Timeline — copied from content but can be overridden
  examTimelineType: 'anytime' | 'scheduled';
  examStartDateTime?: string; // ISO string
  examEndDateTime?: string;   // ISO string

  // Attempt cap — copied from content but can be overridden
  maxAttempts: number | 'unlimited';

  status: LiveExamStatus;

  // Aggregate counters (updated atomically)
  totalParticipants: number;  // distinct students who attempted ≥1 time
  totalAttempts: number;      // sum of all attempts across all students

  // Authorship
  createdBy: string;
  createdByName: string;
  createdAt: Date;
  updatedAt?: Date;
}

/** Per-student attempt record stored in `liveExamAttempts` subcollection under each liveExam */
export interface LiveExamAttemptRecord {
  id: string;
  liveExamId: string;
  studentId: string;
  studentName: string;
  studentEmail?: string;
  attemptCount: number;
  lastAttemptAt?: Date;
  // Links to actual examSession ids (from the main examSessions collection)
  sessionIds: string[];
  bestScore?: number;
  bestPercentage?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const toDate = (v: any): Date => {
  if (!v) return new Date();
  if (v instanceof Date) return v;
  if (v?.toDate) return v.toDate();
  if (typeof v === 'number') return new Date(v);
  if (typeof v === 'string') return new Date(v);
  return new Date();
};

const toOptDate = (v: any): Date | undefined => (v ? toDate(v) : undefined);

const clean = (obj: any): any => {
  if (obj === null || obj === undefined) return null;
  if (Array.isArray(obj)) return obj.map(clean).filter((i) => i !== undefined);
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

const deserializeLiveExam = (id: string, data: any): LiveExam => ({
  id,
  name: data.name ?? '',
  contentId: data.contentId ?? '',
  contentTitle: data.contentTitle ?? '',
  contentSubject: data.contentSubject,
  contentExamType: data.contentExamType,
  audience: data.audience ?? 'all',
  courseTargets: data.courseTargets ?? [],
  examTimelineType: data.examTimelineType ?? 'anytime',
  examStartDateTime: data.examStartDateTime,
  examEndDateTime: data.examEndDateTime,
  maxAttempts: data.maxAttempts === 'unlimited' ? 'unlimited' : Number(data.maxAttempts ?? 1),
  status: data.status ?? 'active',
  totalParticipants: data.totalParticipants ?? 0,
  totalAttempts: data.totalAttempts ?? 0,
  createdBy: data.createdBy ?? '',
  createdByName: data.createdByName ?? '',
  createdAt: toDate(data.createdAt),
  updatedAt: toOptDate(data.updatedAt),
});

const deserializeAttemptRecord = (id: string, data: any): LiveExamAttemptRecord => ({
  id,
  liveExamId: data.liveExamId ?? '',
  studentId: data.studentId ?? '',
  studentName: data.studentName ?? '',
  studentEmail: data.studentEmail,
  attemptCount: data.attemptCount ?? 0,
  lastAttemptAt: toOptDate(data.lastAttemptAt),
  sessionIds: data.sessionIds ?? [],
  bestScore: data.bestScore,
  bestPercentage: data.bestPercentage,
});

// ─── Service ──────────────────────────────────────────────────────────────────

export const liveExamService = {

  // ── 1. Create a live exam ─────────────────────────────────────────────────────
  async createLiveExam(payload: {
    name: string;
    contentId: string;
    contentTitle: string;
    contentSubject?: string;
    contentExamType?: 'mcq' | 'written' | 'mixed';
    audience: LiveExamAudience;
    courseTargets?: LiveExamCourseTarget[];
    examTimelineType: 'anytime' | 'scheduled';
    examStartDateTime?: string;
    examEndDateTime?: string;
    maxAttempts: number | 'unlimited';
    createdBy: string;
    createdByName: string;
  }): Promise<string> {
    try {
      const ref = await addDoc(collection(db, 'liveExams'), clean({
        name: payload.name,
        contentId: payload.contentId,
        contentTitle: payload.contentTitle,
        contentSubject: payload.contentSubject,
        contentExamType: payload.contentExamType,
        audience: payload.audience,
        courseTargets: payload.courseTargets ?? [],
        examTimelineType: payload.examTimelineType,
        examStartDateTime: payload.examStartDateTime,
        examEndDateTime: payload.examEndDateTime,
        maxAttempts: payload.maxAttempts,
        status: 'active',
        totalParticipants: 0,
        totalAttempts: 0,
        createdBy: payload.createdBy,
        createdByName: payload.createdByName,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      }));
      return ref.id;
    } catch (e: any) {
      console.error('liveExamService.createLiveExam:', e);
      throw e;
    }
  },

  // ── 2. Get a single live exam ─────────────────────────────────────────────────
  async getLiveExam(id: string): Promise<LiveExam | null> {
    try {
      const snap = await getDoc(doc(db, 'liveExams', id));
      if (!snap.exists()) return null;
      return deserializeLiveExam(snap.id, snap.data());
    } catch (e: any) {
      console.error('liveExamService.getLiveExam:', e);
      return null;
    }
  },

  // ── 3. Get all live exams (for admin/teacher) ─────────────────────────────────
  async getAllLiveExams(): Promise<LiveExam[]> {
    try {
      const snap = await getDocs(
        query(collection(db, 'liveExams'), orderBy('createdAt', 'desc'))
      );
      return snap.docs.map((d) => deserializeLiveExam(d.id, d.data()));
    } catch (e: any) {
      console.error('liveExamService.getAllLiveExams:', e);
      return [];
    }
  },

  // ── 4. Get live exams created by a specific teacher ───────────────────────────
  async getLiveExamsByCreator(userId: string): Promise<LiveExam[]> {
    try {
      const snap = await getDocs(
        query(
          collection(db, 'liveExams'),
          where('createdBy', '==', userId),
          orderBy('createdAt', 'desc')
        )
      );
      return snap.docs.map((d) => deserializeLiveExam(d.id, d.data()));
    } catch (e: any) {
      console.error('liveExamService.getLiveExamsByCreator:', e);
      return [];
    }
  },

  // ── 5. Get live exams available to a student ──────────────────────────────────
  async getLiveExamsForStudent(
    studentId: string,
    enrolledCourseIds: string[]
  ): Promise<LiveExam[]> {
    try {
      const snap = await getDocs(
        query(
          collection(db, 'liveExams'),
          where('status', '==', 'active'),
          orderBy('createdAt', 'desc')
        )
      );
      const all = snap.docs.map((d) => deserializeLiveExam(d.id, d.data()));

      // Filter by audience
      return all.filter((exam) => {
        if (exam.audience === 'all') return true;
        if (exam.audience === 'course_based') {
          return exam.courseTargets.some((ct) =>
            enrolledCourseIds.includes(ct.courseId)
          );
        }
        return false;
      });
    } catch (e: any) {
      console.error('liveExamService.getLiveExamsForStudent:', e);
      return [];
    }
  },

  // ── 6. Update a live exam ─────────────────────────────────────────────────────
  async updateLiveExam(
    id: string,
    updates: Partial<Omit<LiveExam, 'id' | 'createdAt' | 'createdBy' | 'createdByName'>>
  ): Promise<void> {
    try {
      await updateDoc(doc(db, 'liveExams', id), clean({
        ...updates,
        updatedAt: Timestamp.now(),
      }));
    } catch (e: any) {
      console.error('liveExamService.updateLiveExam:', e);
      throw e;
    }
  },

  // ── 7. Delete a live exam ─────────────────────────────────────────────────────
  async deleteLiveExam(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'liveExams', id));
    } catch (e: any) {
      console.error('liveExamService.deleteLiveExam:', e);
      throw e;
    }
  },

  // ── 8. Toggle status (active ↔ ended) ────────────────────────────────────────
  async setStatus(id: string, status: LiveExamStatus): Promise<void> {
    await liveExamService.updateLiveExam(id, { status });
  },

  // ── 9. Record a student attempt ───────────────────────────────────────────────
  // Called when a student starts an exam session linked to a live exam.
  async recordAttempt(payload: {
    liveExamId: string;
    studentId: string;
    studentName: string;
    studentEmail?: string;
    sessionId: string;
    score?: number;
    percentage?: number;
  }): Promise<void> {
    try {
      const attemptsRef = collection(db, 'liveExamAttempts');
      const q = query(
        attemptsRef,
        where('liveExamId', '==', payload.liveExamId),
        where('studentId', '==', payload.studentId)
      );
      const snap = await getDocs(q);

      if (snap.empty) {
        // First attempt by this student
        await addDoc(attemptsRef, clean({
          liveExamId: payload.liveExamId,
          studentId: payload.studentId,
          studentName: payload.studentName,
          studentEmail: payload.studentEmail,
          attemptCount: 1,
          lastAttemptAt: Timestamp.now(),
          sessionIds: [payload.sessionId],
          bestScore: payload.score,
          bestPercentage: payload.percentage,
        }));
        // Increment both counters on the parent doc
        await updateDoc(doc(db, 'liveExams', payload.liveExamId), {
          totalParticipants: increment(1),
          totalAttempts: increment(1),
          updatedAt: Timestamp.now(),
        });
      } else {
        const existing = snap.docs[0];
        const data = existing.data();
        const newBestScore = payload.score !== undefined
          ? Math.max(data.bestScore ?? 0, payload.score)
          : data.bestScore;
        const newBestPct = payload.percentage !== undefined
          ? Math.max(data.bestPercentage ?? 0, payload.percentage)
          : data.bestPercentage;

        await updateDoc(existing.ref, clean({
          attemptCount: (data.attemptCount ?? 0) + 1,
          lastAttemptAt: Timestamp.now(),
          sessionIds: [...(data.sessionIds ?? []), payload.sessionId],
          bestScore: newBestScore,
          bestPercentage: newBestPct,
        }));
        // Only increment totalAttempts (not participants — already counted)
        await updateDoc(doc(db, 'liveExams', payload.liveExamId), {
          totalAttempts: increment(1),
          updatedAt: Timestamp.now(),
        });
      }
    } catch (e: any) {
      console.error('liveExamService.recordAttempt:', e);
      // Non-fatal — don't rethrow so exam session creation is not blocked
    }
  },

  // ── 10. Get all attempt records for a live exam (teacher stats view) ──────────
  async getAttemptRecords(liveExamId: string): Promise<LiveExamAttemptRecord[]> {
    try {
      const snap = await getDocs(
        query(
          collection(db, 'liveExamAttempts'),
          where('liveExamId', '==', liveExamId),
          orderBy('lastAttemptAt', 'desc')
        )
      );
      return snap.docs.map((d) => deserializeAttemptRecord(d.id, d.data()));
    } catch (e: any) {
      console.error('liveExamService.getAttemptRecords:', e);
      return [];
    }
  },

  // ── 11. Get a student's attempt record for a specific live exam ───────────────
  async getStudentAttemptRecord(
    liveExamId: string,
    studentId: string
  ): Promise<LiveExamAttemptRecord | null> {
    try {
      const snap = await getDocs(
        query(
          collection(db, 'liveExamAttempts'),
          where('liveExamId', '==', liveExamId),
          where('studentId', '==', studentId)
        )
      );
      if (snap.empty) return null;
      return deserializeAttemptRecord(snap.docs[0].id, snap.docs[0].data());
    } catch (e: any) {
      console.error('liveExamService.getStudentAttemptRecord:', e);
      return null;
    }
  },

  // ── 12. Check if student is within attempt limit ──────────────────────────────
  async canStudentAttempt(liveExamId: string, studentId: string): Promise<{
    canAttempt: boolean;
    attemptCount: number;
    maxAttempts: number | 'unlimited';
    reason?: string;
  }> {
    try {
      const exam = await liveExamService.getLiveExam(liveExamId);
      if (!exam) return { canAttempt: false, attemptCount: 0, maxAttempts: 1, reason: 'Exam not found' };
      if (exam.status !== 'active') return { canAttempt: false, attemptCount: 0, maxAttempts: exam.maxAttempts, reason: 'Exam is not active' };

      // Check timeline
      if (exam.examTimelineType === 'scheduled') {
        const now = new Date();
        if (exam.examStartDateTime && new Date(exam.examStartDateTime) > now) {
          return { canAttempt: false, attemptCount: 0, maxAttempts: exam.maxAttempts, reason: 'Exam has not started yet' };
        }
        if (exam.examEndDateTime && new Date(exam.examEndDateTime) < now) {
          return { canAttempt: false, attemptCount: 0, maxAttempts: exam.maxAttempts, reason: 'Exam has ended' };
        }
      }

      const record = await liveExamService.getStudentAttemptRecord(liveExamId, studentId);
      const attemptCount = record?.attemptCount ?? 0;

      if (exam.maxAttempts === 'unlimited') {
        return { canAttempt: true, attemptCount, maxAttempts: 'unlimited' };
      }

      if (attemptCount >= (exam.maxAttempts as number)) {
        return {
          canAttempt: false,
          attemptCount,
          maxAttempts: exam.maxAttempts,
          reason: `Attempt limit reached (${attemptCount}/${exam.maxAttempts})`,
        };
      }

      return { canAttempt: true, attemptCount, maxAttempts: exam.maxAttempts };
    } catch (e: any) {
      console.error('liveExamService.canStudentAttempt:', e);
      return { canAttempt: false, attemptCount: 0, maxAttempts: 1, reason: 'Error checking eligibility' };
    }
  },
};

export default liveExamService;
