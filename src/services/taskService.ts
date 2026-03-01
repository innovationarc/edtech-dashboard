// src/services/taskService.ts
// Production-grade Task Management Service
// Supports: Homework, Project, Practical, Discussion, Peer Review, Link Submission, Exam
// Storage: Teacher files → Supabase private bucket ('assets')
//          Student files → Supabase public bucket ('uploads')

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
  onSnapshot,
  DocumentSnapshot,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { uploadService } from './uploadService';
import { gamificationService } from './gamificationService';

// ─── Task Types ───────────────────────────────────────────────────────────────

export type TaskType =
  | 'homework'
  | 'project'
  | 'practical'
  | 'discussion'
  | 'peer_review'
  | 'link_submission'
  | 'exam';

export type SubmissionStatus =
  | 'not_started'
  | 'pending'
  | 'submitted'
  | 'late'
  | 'reviewed'
  | 'resubmitted';

export type TaskGroupStatus = 'draft' | 'published' | 'closed';

export type AssignmentScope =
  | { type: 'all' }
  | { type: 'course'; courseId: string; courseName?: string }
  | { type: 'class'; classId: string; className?: string }
  | { type: 'students'; studentIds: string[]; studentNames?: string[] };

// ─── Sub-types ────────────────────────────────────────────────────────────────

export interface RubricItem {
  id: string;
  criterion: string;
  description: string;
  maxPoints: number;
}

export interface Milestone {
  id: string;
  title: string;
  description: string;
  dueDate: Date;
  order: number;
}

export interface TaskAttachment {
  url: string;
  name: string;
  type: string;
  size?: number;
}

export interface LinkEntry {
  url: string;
  label: string;
}

export interface MilestoneSubmission {
  milestoneId: string;
  files?: TaskAttachment[];
  links?: LinkEntry[];
  textContent?: string;
  submittedAt?: Date;
}

export interface RubricScore {
  criterion: string;
  maxPoints: number;
  score: number;
  comment?: string;
}

// ─── Task Group ───────────────────────────────────────────────────────────────

export interface TaskGroup {
  id: string;
  title: string;
  description: string;
  teacherId: string;
  teacherName: string;
  assignedTo: AssignmentScope;
  dueDate: Date;
  lateSubmissionAllowed: boolean;
  lateSubmissionDeadline?: Date;
  startDate?: Date;
  status: TaskGroupStatus;
  totalPoints: number;
  taskIds: string[];
  createdAt: Date;
  updatedAt?: Date;
}

// ─── Task ─────────────────────────────────────────────────────────────────────

export interface Task {
  id: string;
  taskGroupId: string;
  title: string;
  description: string;
  type: TaskType;
  order: number;
  points: number;
  teacherId: string;

  // Universal
  rubric?: RubricItem[];
  gradingCriteria?: string;
  attachments?: TaskAttachment[]; // teacher reference files (private bucket)
  allowResubmission?: boolean;
  maxSubmissions?: number;

  // Homework / Written
  allowedFormats?: string[];
  maxFileSizeMB?: number;
  allowRichText?: boolean;

  // Project / Capstone
  milestones?: Milestone[];
  allowLinks?: boolean;
  allowedLinkTypes?: string[];
  stepBasedSubmission?: boolean;

  // Practical / Lab
  experimentSteps?: string[];
  requiredSubmissionTypes?: string[];
  templateFiles?: TaskAttachment[];

  // Discussion / Reflection
  prompt?: string;
  wordLimit?: number;
  allowPeerComments?: boolean;

  // Peer Review
  sourceTaskId?: string;
  peersToReview?: number;
  anonymous?: boolean;
  reviewDeadline?: Date;

  // Link Submission
  validateLinks?: boolean;

  // Exam
  contentId?: string;
  examTitle?: string;

  createdAt: Date;
  updatedAt?: Date;
}

// ─── Submission ───────────────────────────────────────────────────────────────

export interface Submission {
  id: string;
  taskId: string;
  taskGroupId: string;
  studentId: string;
  studentName: string;
  studentEmail?: string;
  studentAvatar?: string;

  // Content
  textContent?: string;
  files?: TaskAttachment[];
  links?: LinkEntry[];
  milestoneSubmissions?: MilestoneSubmission[];
  discussionText?: string;

  // Status
  submittedAt: Date;
  updatedAt?: Date;
  isLate: boolean;
  attemptNumber: number;
  status: SubmissionStatus;

  // Grading
  grade?: number;
  gradedAt?: Date;
  gradedBy?: string;
  gradedByName?: string;
  feedback?: string;
  feedbackFiles?: TaskAttachment[];
  rubricScores?: RubricScore[];

  createdAt: Date;
}

// ─── Peer Review ──────────────────────────────────────────────────────────────

export interface PeerReview {
  id: string;
  taskId: string;
  taskGroupId: string;
  reviewerId: string;
  reviewerName: string;
  targetSubmissionId: string;
  targetStudentId: string;
  rating?: number;
  comment?: string;
  rubricScores?: RubricScore[];
  submittedAt?: Date;
  status: 'assigned' | 'completed';
  createdAt: Date;
}

// ─── Statistics ───────────────────────────────────────────────────────────────

export interface TaskGroupStats {
  totalStudents: number;
  submitted: number;
  pending: number;
  late: number;
  reviewed: number;
  averageScore?: number;
  highestScore?: number;
  lowestScore?: number;
  submissionRate: number;
}

// ─── Firestore Helpers ────────────────────────────────────────────────────────

const toDate = (v: any): Date => {
  if (!v) return new Date();
  if (v instanceof Date) return v;
  if (v?.toDate) return v.toDate();
  return new Date(v);
};

const toOptDate = (v: any): Date | undefined => {
  if (!v) return undefined;
  return toDate(v);
};

const serializeTask = (task: Partial<Task>): any => {
  const data: any = { ...task };
  if (task.milestones) {
    data.milestones = task.milestones.map((m) => ({
      ...m,
      dueDate: Timestamp.fromDate(m.dueDate),
    }));
  }
  if (task.reviewDeadline) data.reviewDeadline = Timestamp.fromDate(task.reviewDeadline);
  delete data.id;
  return data;
};

const deserializeTask = (id: string, data: any): Task => ({
  id,
  taskGroupId: data.taskGroupId,
  title: data.title,
  description: data.description,
  type: data.type,
  order: data.order ?? 0,
  points: data.points ?? 0,
  teacherId: data.teacherId,
  rubric: data.rubric,
  gradingCriteria: data.gradingCriteria,
  attachments: data.attachments,
  allowResubmission: data.allowResubmission,
  maxSubmissions: data.maxSubmissions,
  allowedFormats: data.allowedFormats,
  maxFileSizeMB: data.maxFileSizeMB,
  allowRichText: data.allowRichText,
  milestones: data.milestones?.map((m: any) => ({ ...m, dueDate: toDate(m.dueDate) })),
  allowLinks: data.allowLinks,
  allowedLinkTypes: data.allowedLinkTypes,
  stepBasedSubmission: data.stepBasedSubmission,
  experimentSteps: data.experimentSteps,
  requiredSubmissionTypes: data.requiredSubmissionTypes,
  templateFiles: data.templateFiles,
  prompt: data.prompt,
  wordLimit: data.wordLimit,
  allowPeerComments: data.allowPeerComments,
  sourceTaskId: data.sourceTaskId,
  peersToReview: data.peersToReview,
  anonymous: data.anonymous,
  reviewDeadline: toOptDate(data.reviewDeadline),
  validateLinks: data.validateLinks,
  contentId: data.contentId,
  examTitle: data.examTitle,
  createdAt: toDate(data.createdAt),
  updatedAt: toOptDate(data.updatedAt),
});

const deserializeGroup = (id: string, data: any): TaskGroup => ({
  id,
  title: data.title,
  description: data.description,
  teacherId: data.teacherId,
  teacherName: data.teacherName,
  assignedTo: data.assignedTo,
  dueDate: toDate(data.dueDate),
  lateSubmissionAllowed: data.lateSubmissionAllowed ?? false,
  lateSubmissionDeadline: toOptDate(data.lateSubmissionDeadline),
  startDate: toOptDate(data.startDate),
  status: data.status ?? 'draft',
  totalPoints: data.totalPoints ?? 0,
  taskIds: data.taskIds ?? [],
  createdAt: toDate(data.createdAt),
  updatedAt: toOptDate(data.updatedAt),
});

const deserializeSubmission = (id: string, data: any): Submission => ({
  id,
  taskId: data.taskId,
  taskGroupId: data.taskGroupId,
  studentId: data.studentId,
  studentName: data.studentName,
  studentEmail: data.studentEmail,
  studentAvatar: data.studentAvatar,
  textContent: data.textContent,
  files: data.files,
  links: data.links,
  milestoneSubmissions: data.milestoneSubmissions?.map((ms: any) => ({
    ...ms,
    submittedAt: toOptDate(ms.submittedAt),
  })),
  discussionText: data.discussionText,
  submittedAt: toDate(data.submittedAt),
  updatedAt: toOptDate(data.updatedAt),
  isLate: data.isLate ?? false,
  attemptNumber: data.attemptNumber ?? 1,
  status: data.status ?? 'submitted',
  grade: data.grade,
  gradedAt: toOptDate(data.gradedAt),
  gradedBy: data.gradedBy,
  gradedByName: data.gradedByName,
  feedback: data.feedback,
  feedbackFiles: data.feedbackFiles,
  rubricScores: data.rubricScores,
  createdAt: toDate(data.createdAt),
});

// ─── taskService ──────────────────────────────────────────────────────────────

export const taskService = {

  // ── File Uploads ─────────────────────────────────────────────────────────────

  /** Upload teacher reference file to private Supabase bucket */
  async uploadTeacherFile(
    file: File,
    folder: string,
    onProgress?: (pct: number) => void
  ): Promise<TaskAttachment> {
    const result = await uploadService.uploadToSupabase(
      file,
      `task-attachments/${folder}`,
      onProgress ? (p) => onProgress(p.percentage) : undefined,
      'private'
    );
    return { url: result.url, name: file.name, type: file.type, size: file.size };
  },

  /** Upload student submission file to public Supabase bucket */
  async uploadStudentFile(
    file: File,
    folder: string,
    onProgress?: (pct: number) => void
  ): Promise<TaskAttachment> {
    const result = await uploadService.uploadToSupabase(
      file,
      `submissions/${folder}`,
      onProgress ? (p) => onProgress(p.percentage) : undefined,
      'public'
    );
    return { url: result.url, name: file.name, type: file.type, size: file.size };
  },

  // ── Task Groups ───────────────────────────────────────────────────────────────

  async createTaskGroup(
    group: Omit<TaskGroup, 'id' | 'createdAt' | 'updatedAt' | 'totalPoints' | 'taskIds'>
  ): Promise<string> {
    const data: any = {
      ...group,
      dueDate: Timestamp.fromDate(group.dueDate),
      lateSubmissionDeadline: group.lateSubmissionDeadline
        ? Timestamp.fromDate(group.lateSubmissionDeadline)
        : null,
      startDate: group.startDate ? Timestamp.fromDate(group.startDate) : null,
      totalPoints: 0,
      taskIds: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    const ref = await addDoc(collection(db, 'taskGroups'), data);
    return ref.id;
  },

  async updateTaskGroup(
    groupId: string,
    updates: Partial<Omit<TaskGroup, 'id' | 'createdAt' | 'teacherId'>>
  ): Promise<void> {
    const data: any = { ...updates, updatedAt: serverTimestamp() };
    if (updates.dueDate) data.dueDate = Timestamp.fromDate(updates.dueDate);
    if (updates.lateSubmissionDeadline)
      data.lateSubmissionDeadline = Timestamp.fromDate(updates.lateSubmissionDeadline);
    if (updates.startDate) data.startDate = Timestamp.fromDate(updates.startDate);
    await updateDoc(doc(db, 'taskGroups', groupId), data);
  },

  async deleteTaskGroup(groupId: string): Promise<void> {
    const batch = writeBatch(db);
    // Delete all tasks in the group
    const tasks = await this.getTasksByGroup(groupId);
    for (const task of tasks) {
      batch.delete(doc(db, 'tasks', task.id));
    }
    // Delete all submissions for those tasks
    for (const task of tasks) {
      const subs = await this.getTaskSubmissions(task.id);
      for (const sub of subs) {
        batch.delete(doc(db, 'submissions', sub.id));
      }
    }
    batch.delete(doc(db, 'taskGroups', groupId));
    await batch.commit();
  },

  async getTaskGroupsByTeacher(teacherId: string): Promise<TaskGroup[]> {
    const q = query(
      collection(db, 'taskGroups'),
      where('teacherId', '==', teacherId),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => deserializeGroup(d.id, d.data()));
  },

  async getTaskGroupById(groupId: string): Promise<TaskGroup | null> {
    const snap = await getDoc(doc(db, 'taskGroups', groupId));
    if (!snap.exists()) return null;
    return deserializeGroup(snap.id, snap.data());
  },

  async getTaskGroupsForStudent(studentId: string, courseId?: string, classId?: string): Promise<TaskGroup[]> {
    // Get published groups assigned to this student's course/class/all
    const queries = [
      query(collection(db, 'taskGroups'), where('status', '==', 'published'), where('assignedTo.type', '==', 'all')),
    ];
    if (courseId) {
      queries.push(
        query(collection(db, 'taskGroups'), where('status', '==', 'published'), where('assignedTo.type', '==', 'course'), where('assignedTo.courseId', '==', courseId))
      );
    }
    if (classId) {
      queries.push(
        query(collection(db, 'taskGroups'), where('status', '==', 'published'), where('assignedTo.type', '==', 'class'), where('assignedTo.classId', '==', classId))
      );
    }
    queries.push(
      query(collection(db, 'taskGroups'), where('status', '==', 'published'), where('assignedTo.studentIds', 'array-contains', studentId))
    );

    const results: TaskGroup[] = [];
    const seen = new Set<string>();
    for (const q of queries) {
      try {
        const snap = await getDocs(q);
        for (const d of snap.docs) {
          if (!seen.has(d.id)) {
            seen.add(d.id);
            results.push(deserializeGroup(d.id, d.data()));
          }
        }
      } catch { /* index might not exist for some combos */ }
    }

    return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  },

  async publishTaskGroup(groupId: string): Promise<void> {
    await updateDoc(doc(db, 'taskGroups', groupId), {
      status: 'published',
      updatedAt: serverTimestamp(),
    });
  },

  async closeTaskGroup(groupId: string): Promise<void> {
    await updateDoc(doc(db, 'taskGroups', groupId), {
      status: 'closed',
      updatedAt: serverTimestamp(),
    });
  },

  // Recalculate total points from tasks
  async recalcGroupPoints(groupId: string): Promise<void> {
    const tasks = await this.getTasksByGroup(groupId);
    const total = tasks.reduce((sum, t) => sum + (t.points || 0), 0);
    await updateDoc(doc(db, 'taskGroups', groupId), { totalPoints: total, updatedAt: serverTimestamp() });
  },

  // ── Tasks ─────────────────────────────────────────────────────────────────────

  async createTask(task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const data: any = {
      ...serializeTask(task),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    const ref = await addDoc(collection(db, 'tasks'), data);
    // Update group's taskIds and recalc points
    const groupRef = doc(db, 'taskGroups', task.taskGroupId);
    const groupSnap = await getDoc(groupRef);
    if (groupSnap.exists()) {
      const taskIds = groupSnap.data().taskIds ?? [];
      taskIds.push(ref.id);
      await updateDoc(groupRef, {
        taskIds,
        totalPoints: increment(task.points ?? 0),
        updatedAt: serverTimestamp(),
      });
    }
    return ref.id;
  },

  async updateTask(taskId: string, updates: Partial<Task>): Promise<void> {
    const oldSnap = await getDoc(doc(db, 'tasks', taskId));
    const oldPoints = oldSnap.exists() ? (oldSnap.data().points ?? 0) : 0;
    const data: any = { ...serializeTask(updates), updatedAt: serverTimestamp() };
    await updateDoc(doc(db, 'tasks', taskId), data);
    // Update group points if points changed
    if (updates.points !== undefined && updates.points !== oldPoints && oldSnap.exists()) {
      const groupId = oldSnap.data().taskGroupId;
      await updateDoc(doc(db, 'taskGroups', groupId), {
        totalPoints: increment(updates.points - oldPoints),
        updatedAt: serverTimestamp(),
      });
    }
  },

  async deleteTask(taskId: string): Promise<void> {
    const taskSnap = await getDoc(doc(db, 'tasks', taskId));
    if (!taskSnap.exists()) return;
    const task = deserializeTask(taskId, taskSnap.data());
    const batch = writeBatch(db);
    // Delete submissions
    const subs = await this.getTaskSubmissions(taskId);
    for (const sub of subs) batch.delete(doc(db, 'submissions', sub.id));
    batch.delete(doc(db, 'tasks', taskId));
    await batch.commit();
    // Update group
    const groupSnap = await getDoc(doc(db, 'taskGroups', task.taskGroupId));
    if (groupSnap.exists()) {
      const taskIds = (groupSnap.data().taskIds ?? []).filter((id: string) => id !== taskId);
      await updateDoc(doc(db, 'taskGroups', task.taskGroupId), {
        taskIds,
        totalPoints: increment(-(task.points ?? 0)),
        updatedAt: serverTimestamp(),
      });
    }
  },

  async getTasksByGroup(groupId: string): Promise<Task[]> {
    const q = query(
      collection(db, 'tasks'),
      where('taskGroupId', '==', groupId),
      orderBy('order', 'asc')
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => deserializeTask(d.id, d.data()));
  },

  async getTaskById(taskId: string): Promise<Task | null> {
    const snap = await getDoc(doc(db, 'tasks', taskId));
    if (!snap.exists()) return null;
    return deserializeTask(snap.id, snap.data());
  },

  // ── Submissions ───────────────────────────────────────────────────────────────

  async submitTask(payload: {
    taskId: string;
    taskGroupId: string;
    studentId: string;
    studentName: string;
    studentEmail?: string;
    dueDate: Date;
    textContent?: string;
    files?: TaskAttachment[];
    links?: LinkEntry[];
    milestoneSubmissions?: MilestoneSubmission[];
    discussionText?: string;
  }): Promise<string> {
    const now = new Date();
    const isLate = now > payload.dueDate;

    // Check if existing submission exists
    const existing = await this.getStudentSubmissionForTask(payload.taskId, payload.studentId);
    const attemptNumber = existing ? (existing.attemptNumber + 1) : 1;

    const data: any = {
      taskId: payload.taskId,
      taskGroupId: payload.taskGroupId,
      studentId: payload.studentId,
      studentName: payload.studentName,
      studentEmail: payload.studentEmail ?? null,
      textContent: payload.textContent ?? null,
      files: payload.files ?? [],
      links: payload.links ?? [],
      milestoneSubmissions: payload.milestoneSubmissions?.map((ms) => ({
        ...ms,
        submittedAt: ms.submittedAt ? Timestamp.fromDate(ms.submittedAt) : null,
      })) ?? [],
      discussionText: payload.discussionText ?? null,
      submittedAt: serverTimestamp(),
      isLate,
      attemptNumber,
      status: isLate ? 'late' : 'submitted',
      createdAt: serverTimestamp(),
    };

    if (existing) {
      // Resubmit: update existing
      await updateDoc(doc(db, 'submissions', existing.id), {
        ...data,
        status: isLate ? 'late' : 'resubmitted',
        updatedAt: serverTimestamp(),
      });
      return existing.id;
    }

    const ref = await addDoc(collection(db, 'submissions'), data);

    // Gamification
    try {
      await gamificationService.recordActivity(payload.studentId, 'task_completed', {
        taskId: payload.taskId,
      });
    } catch { /* non-critical */ }

    return ref.id;
  },

  async getTaskSubmissions(taskId: string): Promise<Submission[]> {
    const q = query(
      collection(db, 'submissions'),
      where('taskId', '==', taskId),
      orderBy('submittedAt', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => deserializeSubmission(d.id, d.data()));
  },

  async getGroupSubmissions(taskGroupId: string): Promise<Submission[]> {
    const q = query(
      collection(db, 'submissions'),
      where('taskGroupId', '==', taskGroupId),
      orderBy('submittedAt', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => deserializeSubmission(d.id, d.data()));
  },

  async getStudentSubmissions(studentId: string): Promise<Submission[]> {
    const q = query(
      collection(db, 'submissions'),
      where('studentId', '==', studentId),
      orderBy('submittedAt', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => deserializeSubmission(d.id, d.data()));
  },

  async getStudentSubmissionForTask(taskId: string, studentId: string): Promise<Submission | null> {
    const q = query(
      collection(db, 'submissions'),
      where('taskId', '==', taskId),
      where('studentId', '==', studentId),
      firestoreLimit(1)
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return deserializeSubmission(snap.docs[0].id, snap.docs[0].data());
  },

  async gradeSubmission(
    submissionId: string,
    grading: {
      grade: number;
      feedback?: string;
      feedbackFiles?: TaskAttachment[];
      rubricScores?: RubricScore[];
      gradedBy: string;
      gradedByName: string;
    }
  ): Promise<void> {
    await updateDoc(doc(db, 'submissions', submissionId), {
      grade: grading.grade,
      feedback: grading.feedback ?? null,
      feedbackFiles: grading.feedbackFiles ?? [],
      rubricScores: grading.rubricScores ?? [],
      gradedBy: grading.gradedBy,
      gradedByName: grading.gradedByName,
      gradedAt: serverTimestamp(),
      status: 'reviewed',
      updatedAt: serverTimestamp(),
    });
  },

  // ── Peer Reviews ──────────────────────────────────────────────────────────────

  async assignPeerReviews(
    taskId: string,
    taskGroupId: string,
    peersToReview: number,
    anonymous: boolean
  ): Promise<void> {
    const submissions = await this.getTaskSubmissions(taskId);
    if (submissions.length < 2) return;

    const batch = writeBatch(db);
    for (let i = 0; i < submissions.length; i++) {
      const reviewer = submissions[i];
      // Assign `peersToReview` others to this reviewer
      let count = 0;
      for (let j = 1; j <= submissions.length && count < peersToReview; j++) {
        const targetIdx = (i + j) % submissions.length;
        const target = submissions[targetIdx];
        const reviewRef = doc(collection(db, 'peerReviews'));
        batch.set(reviewRef, {
          taskId,
          taskGroupId,
          reviewerId: reviewer.studentId,
          reviewerName: anonymous ? 'Anonymous' : reviewer.studentName,
          targetSubmissionId: target.id,
          targetStudentId: target.studentId,
          status: 'assigned',
          createdAt: serverTimestamp(),
        });
        count++;
      }
    }
    await batch.commit();
  },

  async submitPeerReview(
    reviewId: string,
    data: { rating?: number; comment?: string; rubricScores?: RubricScore[] }
  ): Promise<void> {
    await updateDoc(doc(db, 'peerReviews', reviewId), {
      ...data,
      submittedAt: serverTimestamp(),
      status: 'completed',
    });
  },

  async getPeerReviewsForReviewer(reviewerId: string, taskId: string): Promise<PeerReview[]> {
    const q = query(
      collection(db, 'peerReviews'),
      where('reviewerId', '==', reviewerId),
      where('taskId', '==', taskId)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
      submittedAt: toOptDate(d.data().submittedAt),
      createdAt: toDate(d.data().createdAt),
    } as PeerReview));
  },

  async getPeerReviewsForSubmission(submissionId: string): Promise<PeerReview[]> {
    const q = query(
      collection(db, 'peerReviews'),
      where('targetSubmissionId', '==', submissionId)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
      submittedAt: toOptDate(d.data().submittedAt),
      createdAt: toDate(d.data().createdAt),
    } as PeerReview));
  },

  // ── Statistics ────────────────────────────────────────────────────────────────

  async getTaskGroupStats(groupId: string, totalStudents: number): Promise<TaskGroupStats> {
    const submissions = await this.getGroupSubmissions(groupId);

    // Unique students
    const uniqueStudents = new Set(submissions.map((s) => s.studentId));
    const reviewed = submissions.filter((s) => s.status === 'reviewed');
    const late = submissions.filter((s) => s.isLate);

    const grades = reviewed.map((s) => s.grade ?? 0);
    const avgScore = grades.length ? grades.reduce((a, b) => a + b, 0) / grades.length : undefined;

    return {
      totalStudents,
      submitted: uniqueStudents.size,
      pending: totalStudents - uniqueStudents.size,
      late: late.length,
      reviewed: reviewed.length,
      averageScore: avgScore,
      highestScore: grades.length ? Math.max(...grades) : undefined,
      lowestScore: grades.length ? Math.min(...grades) : undefined,
      submissionRate: totalStudents ? (uniqueStudents.size / totalStudents) * 100 : 0,
    };
  },

  // ── Discussion Comments ───────────────────────────────────────────────────────

  async addDiscussionComment(payload: {
    taskId: string;
    submissionId: string;
    authorId: string;
    authorName: string;
    comment: string;
  }): Promise<string> {
    const ref = await addDoc(collection(db, 'discussionComments'), {
      ...payload,
      createdAt: serverTimestamp(),
    });
    return ref.id;
  },

  async getDiscussionComments(submissionId: string): Promise<{
    id: string; authorId: string; authorName: string; comment: string; createdAt: Date
  }[]> {
    const q = query(
      collection(db, 'discussionComments'),
      where('submissionId', '==', submissionId),
      orderBy('createdAt', 'asc')
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({
      id: d.id,
      authorId: d.data().authorId,
      authorName: d.data().authorName,
      comment: d.data().comment,
      createdAt: toDate(d.data().createdAt),
    }));
  },
};
