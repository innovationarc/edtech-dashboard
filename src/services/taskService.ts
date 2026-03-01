// src/services/taskService.ts
// Production-grade Task Management Service
// Supports: Homework, Project, Practical, Discussion, Peer Review, Link Submission, Exam
// Teacher files → Supabase private bucket ('assets')
// Student files  → Supabase public bucket ('uploads')

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
  writeBatch,
  increment,
  limit as firestoreLimit,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { uploadService } from './uploadService';
import { gamificationService } from './gamificationService';

// ─── Types ────────────────────────────────────────────────────────────────────

export type TaskType =
  | 'homework'
  | 'project'
  | 'practical'
  | 'discussion'
  | 'peer_review'
  | 'link_submission'
  | 'exam';

export type SubmissionStatus = 'submitted' | 'late' | 'reviewed' | 'resubmitted';
export type TaskGroupStatus = 'draft' | 'published' | 'closed';

export interface AssignmentScopeAll      { type: 'all' }
export interface AssignmentScopeCourse   { type: 'course'; courseId: string; courseName?: string }
export interface AssignmentScopeClass    { type: 'class'; classGrade: string; className?: string }
export interface AssignmentScopeStudents { type: 'students'; studentIds: string[]; studentNames?: string[] }
export type AssignmentScope =
  | AssignmentScopeAll | AssignmentScopeCourse
  | AssignmentScopeClass | AssignmentScopeStudents;

export interface RubricItem    { id: string; criterion: string; description: string; maxPoints: number }
export interface Milestone     { id: string; title: string; description: string; dueDate: Date; order: number }
export interface TaskAttachment { url: string; name: string; type: string; size?: number }
export interface LinkEntry     { url: string; label: string }
export interface RubricScore   { criterion: string; maxPoints: number; score: number; comment?: string }

export interface TaskGroup {
  id: string; title: string; description: string;
  teacherId: string; teacherName: string;
  assignedTo: AssignmentScope;
  dueDate: Date; lateSubmissionAllowed: boolean;
  lateSubmissionDeadline?: Date; startDate?: Date;
  status: TaskGroupStatus; totalPoints: number; taskIds: string[];
  createdAt: Date; updatedAt?: Date;
}

export interface Task {
  id: string; taskGroupId: string; title: string; description: string;
  type: TaskType; order: number; points: number; teacherId: string;
  rubric?: RubricItem[]; gradingCriteria?: string;
  attachments?: TaskAttachment[];
  allowResubmission?: boolean; maxSubmissions?: number;
  // Homework
  allowedFormats?: string[]; maxFileSizeMB?: number; allowRichText?: boolean;
  // Project
  milestones?: Milestone[]; allowLinks?: boolean;
  allowedLinkTypes?: string[]; stepBasedSubmission?: boolean;
  // Practical
  experimentSteps?: string[]; requiredSubmissionTypes?: string[];
  templateFiles?: TaskAttachment[];
  // Discussion
  prompt?: string; wordLimit?: number; allowPeerComments?: boolean;
  // Peer Review
  sourceTaskId?: string; peersToReview?: number;
  anonymous?: boolean; reviewDeadline?: Date;
  // Link
  validateLinks?: boolean;
  // Exam
  contentId?: string; examTitle?: string;
  createdAt: Date; updatedAt?: Date;
}

export interface Submission {
  id: string; taskId: string; taskGroupId: string;
  studentId: string; studentName: string; studentEmail?: string;
  textContent?: string; files?: TaskAttachment[];
  links?: LinkEntry[]; discussionText?: string;
  submittedAt: Date; updatedAt?: Date;
  isLate: boolean; attemptNumber: number; status: SubmissionStatus;
  grade?: number; gradedAt?: Date; gradedBy?: string; gradedByName?: string;
  feedback?: string; feedbackFiles?: TaskAttachment[];
  rubricScores?: RubricScore[]; createdAt: Date;
}

export interface PeerReview {
  id: string; taskId: string; taskGroupId: string;
  reviewerId: string; reviewerName: string;
  targetSubmissionId: string; targetStudentId: string;
  rating?: number; comment?: string; rubricScores?: RubricScore[];
  submittedAt?: Date; status: 'assigned' | 'completed'; createdAt: Date;
}

export interface TaskGroupStats {
  totalStudents: number; submitted: number; pending: number;
  late: number; reviewed: number; averageScore?: number;
  highestScore?: number; lowestScore?: number; submissionRate: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const toDate = (v: any): Date => {
  if (!v) return new Date();
  if (v instanceof Date) return v;
  if (v?.toDate) return v.toDate();
  return new Date(v);
};
const toOpt = (v: any): Date | undefined => v ? toDate(v) : undefined;

const serTask = (t: Partial<Task>): any => {
  const d: any = { ...t };
  if (t.milestones) d.milestones = t.milestones.map(m => ({ ...m, dueDate: Timestamp.fromDate(m.dueDate) }));
  if (t.reviewDeadline) d.reviewDeadline = Timestamp.fromDate(t.reviewDeadline);
  delete d.id;
  return d;
};

const deTask = (id: string, d: any): Task => ({
  id, taskGroupId: d.taskGroupId, title: d.title || '', description: d.description || '',
  type: d.type || 'homework', order: d.order ?? 0, points: d.points ?? 0, teacherId: d.teacherId || '',
  rubric: d.rubric, gradingCriteria: d.gradingCriteria, attachments: d.attachments,
  allowResubmission: d.allowResubmission, maxSubmissions: d.maxSubmissions,
  allowedFormats: d.allowedFormats, maxFileSizeMB: d.maxFileSizeMB, allowRichText: d.allowRichText,
  milestones: d.milestones?.map((m: any) => ({ ...m, dueDate: toDate(m.dueDate) })),
  allowLinks: d.allowLinks, allowedLinkTypes: d.allowedLinkTypes, stepBasedSubmission: d.stepBasedSubmission,
  experimentSteps: d.experimentSteps, requiredSubmissionTypes: d.requiredSubmissionTypes, templateFiles: d.templateFiles,
  prompt: d.prompt, wordLimit: d.wordLimit, allowPeerComments: d.allowPeerComments,
  sourceTaskId: d.sourceTaskId, peersToReview: d.peersToReview, anonymous: d.anonymous,
  reviewDeadline: toOpt(d.reviewDeadline), validateLinks: d.validateLinks,
  contentId: d.contentId, examTitle: d.examTitle,
  createdAt: toDate(d.createdAt), updatedAt: toOpt(d.updatedAt),
});

const deGroup = (id: string, d: any): TaskGroup => ({
  id, title: d.title || '', description: d.description || '',
  teacherId: d.teacherId || '', teacherName: d.teacherName || '',
  assignedTo: d.assignedTo || { type: 'all' },
  dueDate: toDate(d.dueDate), lateSubmissionAllowed: d.lateSubmissionAllowed ?? false,
  lateSubmissionDeadline: toOpt(d.lateSubmissionDeadline), startDate: toOpt(d.startDate),
  status: d.status ?? 'draft', totalPoints: d.totalPoints ?? 0, taskIds: d.taskIds ?? [],
  createdAt: toDate(d.createdAt), updatedAt: toOpt(d.updatedAt),
});

const deSub = (id: string, d: any): Submission => ({
  id, taskId: d.taskId, taskGroupId: d.taskGroupId,
  studentId: d.studentId, studentName: d.studentName, studentEmail: d.studentEmail,
  textContent: d.textContent, files: d.files, links: d.links, discussionText: d.discussionText,
  submittedAt: toDate(d.submittedAt), updatedAt: toOpt(d.updatedAt),
  isLate: d.isLate ?? false, attemptNumber: d.attemptNumber ?? 1, status: d.status ?? 'submitted',
  grade: d.grade, gradedAt: toOpt(d.gradedAt), gradedBy: d.gradedBy, gradedByName: d.gradedByName,
  feedback: d.feedback, feedbackFiles: d.feedbackFiles, rubricScores: d.rubricScores,
  createdAt: toDate(d.createdAt),
});

// ─── Service ──────────────────────────────────────────────────────────────────

export const taskService = {

  // ─ Upload ─────────────────────────────────────────────────────────────────

  async uploadTeacherFile(file: File, folder: string, onProgress?: (pct: number) => void): Promise<TaskAttachment> {
    const r = await uploadService.uploadToSupabase(file, `task-attachments/${folder}`,
      onProgress ? (p) => onProgress(p.percentage) : undefined, 'private');
    return { url: r.url, name: file.name, type: file.type, size: file.size };
  },

  async uploadStudentFile(file: File, folder: string, onProgress?: (pct: number) => void): Promise<TaskAttachment> {
    const r = await uploadService.uploadToSupabase(file, `submissions/${folder}`,
      onProgress ? (p) => onProgress(p.percentage) : undefined, 'public');
    return { url: r.url, name: file.name, type: file.type, size: file.size };
  },

  // ─ Task Groups ────────────────────────────────────────────────────────────

  async createTaskGroup(group: Omit<TaskGroup, 'id' | 'createdAt' | 'updatedAt' | 'totalPoints' | 'taskIds'>): Promise<string> {
    const ref = await addDoc(collection(db, 'taskGroups'), {
      ...group,
      dueDate: Timestamp.fromDate(group.dueDate),
      lateSubmissionDeadline: group.lateSubmissionDeadline ? Timestamp.fromDate(group.lateSubmissionDeadline) : null,
      startDate: group.startDate ? Timestamp.fromDate(group.startDate) : null,
      totalPoints: 0, taskIds: [],
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
    return ref.id;
  },

  async updateTaskGroup(groupId: string, updates: Partial<Omit<TaskGroup, 'id' | 'createdAt' | 'teacherId'>>): Promise<void> {
    const d: any = { ...updates, updatedAt: serverTimestamp() };
    if (updates.dueDate) d.dueDate = Timestamp.fromDate(updates.dueDate);
    if (updates.lateSubmissionDeadline) d.lateSubmissionDeadline = Timestamp.fromDate(updates.lateSubmissionDeadline);
    if (updates.startDate) d.startDate = Timestamp.fromDate(updates.startDate);
    delete d.id;
    await updateDoc(doc(db, 'taskGroups', groupId), d);
  },

  async deleteTaskGroup(groupId: string): Promise<void> {
    const tasks = await this.getTasksByGroup(groupId);
    const batch = writeBatch(db);
    for (const t of tasks) {
      const subs = await getDocs(query(collection(db, 'submissions'), where('taskId', '==', t.id)));
      subs.docs.forEach(d => batch.delete(d.ref));
      batch.delete(doc(db, 'tasks', t.id));
    }
    batch.delete(doc(db, 'taskGroups', groupId));
    await batch.commit();
  },

  async getTaskGroupsByTeacher(teacherId: string): Promise<TaskGroup[]> {
    try {
      const snap = await getDocs(query(collection(db, 'taskGroups'),
        where('teacherId', '==', teacherId), orderBy('createdAt', 'desc')));
      return snap.docs.map(d => deGroup(d.id, d.data()));
    } catch {
      const snap = await getDocs(query(collection(db, 'taskGroups'), where('teacherId', '==', teacherId)));
      return snap.docs.map(d => deGroup(d.id, d.data())).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }
  },

  async getTaskGroupById(groupId: string): Promise<TaskGroup | null> {
    const snap = await getDoc(doc(db, 'taskGroups', groupId));
    return snap.exists() ? deGroup(snap.id, snap.data()) : null;
  },

  /**
   * Get published task groups for a student.
   * Uses simple single-field query + client-side filtering to avoid compound index requirements.
   */
  async getTaskGroupsForStudent(studentId: string, courseId?: string, classGrade?: string): Promise<TaskGroup[]> {
    try {
      const snap = await getDocs(query(collection(db, 'taskGroups'), where('status', '==', 'published')));
      return snap.docs
        .map(d => deGroup(d.id, d.data()))
        .filter(g => {
          const at = g.assignedTo;
          if (at.type === 'all') return true;
          if (at.type === 'course' && courseId) return (at as AssignmentScopeCourse).courseId === courseId;
          if (at.type === 'class' && classGrade) return (at as AssignmentScopeClass).classGrade === classGrade;
          if (at.type === 'students') return ((at as AssignmentScopeStudents).studentIds ?? []).includes(studentId);
          return false;
        })
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } catch (e) {
      console.error('getTaskGroupsForStudent:', e);
      return [];
    }
  },

  async publishTaskGroup(groupId: string): Promise<void> {
    await updateDoc(doc(db, 'taskGroups', groupId), { status: 'published', updatedAt: serverTimestamp() });
  },

  async closeTaskGroup(groupId: string): Promise<void> {
    await updateDoc(doc(db, 'taskGroups', groupId), { status: 'closed', updatedAt: serverTimestamp() });
  },

  // ─ Tasks ──────────────────────────────────────────────────────────────────

  async createTask(task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const ref = await addDoc(collection(db, 'tasks'), {
      ...serTask(task), createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
    try {
      const gs = await getDoc(doc(db, 'taskGroups', task.taskGroupId));
      if (gs.exists()) {
        await updateDoc(doc(db, 'taskGroups', task.taskGroupId), {
          taskIds: [...(gs.data().taskIds ?? []), ref.id],
          totalPoints: increment(task.points ?? 0),
          updatedAt: serverTimestamp(),
        });
      }
    } catch { /* non-critical */ }
    return ref.id;
  },

  async updateTask(taskId: string, updates: Partial<Task>): Promise<void> {
    let oldPoints = 0, groupId = '';
    try {
      const s = await getDoc(doc(db, 'tasks', taskId));
      if (s.exists()) { oldPoints = s.data().points ?? 0; groupId = s.data().taskGroupId; }
    } catch { /* ok */ }
    await updateDoc(doc(db, 'tasks', taskId), { ...serTask(updates), updatedAt: serverTimestamp() });
    if (updates.points !== undefined && updates.points !== oldPoints && groupId) {
      try { await updateDoc(doc(db, 'taskGroups', groupId), { totalPoints: increment(updates.points - oldPoints), updatedAt: serverTimestamp() }); } catch { /* ok */ }
    }
  },

  async deleteTask(taskId: string): Promise<void> {
    let t: Task | null = null;
    try { const s = await getDoc(doc(db, 'tasks', taskId)); if (s.exists()) t = deTask(taskId, s.data()); } catch { /* ok */ }
    try {
      const subs = await getDocs(query(collection(db, 'submissions'), where('taskId', '==', taskId)));
      const b = writeBatch(db); subs.docs.forEach(d => b.delete(d.ref)); b.delete(doc(db, 'tasks', taskId)); await b.commit();
    } catch { await deleteDoc(doc(db, 'tasks', taskId)); }
    if (t) {
      try {
        const gs = await getDoc(doc(db, 'taskGroups', t.taskGroupId));
        if (gs.exists()) await updateDoc(doc(db, 'taskGroups', t.taskGroupId), {
          taskIds: (gs.data().taskIds ?? []).filter((id: string) => id !== taskId),
          totalPoints: increment(-(t!.points ?? 0)), updatedAt: serverTimestamp(),
        });
      } catch { /* ok */ }
    }
  },

  async getTasksByGroup(groupId: string): Promise<Task[]> {
    try {
      const snap = await getDocs(query(collection(db, 'tasks'), where('taskGroupId', '==', groupId), orderBy('order', 'asc')));
      return snap.docs.map(d => deTask(d.id, d.data()));
    } catch {
      const snap = await getDocs(query(collection(db, 'tasks'), where('taskGroupId', '==', groupId)));
      return snap.docs.map(d => deTask(d.id, d.data())).sort((a, b) => a.order - b.order);
    }
  },

  async getTaskById(taskId: string): Promise<Task | null> {
    const s = await getDoc(doc(db, 'tasks', taskId));
    return s.exists() ? deTask(s.id, s.data()) : null;
  },

  // ─ Submissions ────────────────────────────────────────────────────────────

  async submitTask(payload: {
    taskId: string; taskGroupId: string; studentId: string; studentName: string;
    studentEmail?: string; dueDate: Date;
    textContent?: string; files?: TaskAttachment[]; links?: LinkEntry[]; discussionText?: string;
  }): Promise<string> {
    const isLate = new Date() > payload.dueDate;
    const existing = await this.getStudentSubmissionForTask(payload.taskId, payload.studentId);
    const attemptNumber = existing ? existing.attemptNumber + 1 : 1;

    const data: any = {
      taskId: payload.taskId, taskGroupId: payload.taskGroupId,
      studentId: payload.studentId, studentName: payload.studentName,
      studentEmail: payload.studentEmail ?? null,
      textContent: payload.textContent ?? null,
      files: payload.files ?? [],
      links: (payload.links ?? []).filter(l => l.url?.trim()),
      discussionText: payload.discussionText ?? null,
      submittedAt: serverTimestamp(), isLate, attemptNumber,
      status: isLate ? 'late' : existing ? 'resubmitted' : 'submitted',
      createdAt: serverTimestamp(),
    };

    if (existing) {
      await updateDoc(doc(db, 'submissions', existing.id), { ...data, updatedAt: serverTimestamp() });
      return existing.id;
    }
    const ref = await addDoc(collection(db, 'submissions'), data);
    try { await gamificationService.recordActivity(payload.studentId, 'task_completed', { taskId: payload.taskId }); } catch { /* ok */ }
    return ref.id;
  },

  async getTaskSubmissions(taskId: string): Promise<Submission[]> {
    try {
      const snap = await getDocs(query(collection(db, 'submissions'), where('taskId', '==', taskId), orderBy('submittedAt', 'desc')));
      return snap.docs.map(d => deSub(d.id, d.data()));
    } catch {
      const snap = await getDocs(query(collection(db, 'submissions'), where('taskId', '==', taskId)));
      return snap.docs.map(d => deSub(d.id, d.data()));
    }
  },

  async getGroupSubmissions(taskGroupId: string): Promise<Submission[]> {
    try {
      const snap = await getDocs(query(collection(db, 'submissions'), where('taskGroupId', '==', taskGroupId), orderBy('submittedAt', 'desc')));
      return snap.docs.map(d => deSub(d.id, d.data()));
    } catch {
      const snap = await getDocs(query(collection(db, 'submissions'), where('taskGroupId', '==', taskGroupId)));
      return snap.docs.map(d => deSub(d.id, d.data()));
    }
  },

  async getStudentSubmissions(studentId: string): Promise<Submission[]> {
    try {
      const snap = await getDocs(query(collection(db, 'submissions'), where('studentId', '==', studentId), orderBy('submittedAt', 'desc')));
      return snap.docs.map(d => deSub(d.id, d.data()));
    } catch {
      const snap = await getDocs(query(collection(db, 'submissions'), where('studentId', '==', studentId)));
      return snap.docs.map(d => deSub(d.id, d.data()));
    }
  },

  async getStudentSubmissionForTask(taskId: string, studentId: string): Promise<Submission | null> {
    try {
      const snap = await getDocs(query(collection(db, 'submissions'),
        where('taskId', '==', taskId), where('studentId', '==', studentId), firestoreLimit(1)));
      return snap.empty ? null : deSub(snap.docs[0].id, snap.docs[0].data());
    } catch { return null; }
  },

  async gradeSubmission(submissionId: string, grading: {
    grade: number; feedback?: string; feedbackFiles?: TaskAttachment[];
    rubricScores?: RubricScore[]; gradedBy: string; gradedByName: string;
  }): Promise<void> {
    await updateDoc(doc(db, 'submissions', submissionId), {
      grade: grading.grade, feedback: grading.feedback ?? null,
      feedbackFiles: grading.feedbackFiles ?? [], rubricScores: grading.rubricScores ?? [],
      gradedBy: grading.gradedBy, gradedByName: grading.gradedByName,
      gradedAt: serverTimestamp(), status: 'reviewed', updatedAt: serverTimestamp(),
    });
  },

  async getTaskGroupStats(groupId: string, totalStudents: number): Promise<TaskGroupStats> {
    const subs = await this.getGroupSubmissions(groupId);
    const unique = new Set(subs.map(s => s.studentId));
    const reviewed = subs.filter(s => s.status === 'reviewed');
    const grades = reviewed.map(s => s.grade ?? 0);
    return {
      totalStudents, submitted: unique.size,
      pending: Math.max(0, totalStudents - unique.size),
      late: subs.filter(s => s.isLate).length, reviewed: reviewed.length,
      averageScore: grades.length ? grades.reduce((a, b) => a + b, 0) / grades.length : undefined,
      highestScore: grades.length ? Math.max(...grades) : undefined,
      lowestScore: grades.length ? Math.min(...grades) : undefined,
      submissionRate: totalStudents > 0 ? (unique.size / totalStudents) * 100 : 0,
    };
  },
};
