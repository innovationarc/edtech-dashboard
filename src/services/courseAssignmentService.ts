// src/services/courseAssignmentService.ts
// Course Assignment Service - Manages teacher access to courses and course sections
// Integrates with existing teacherService and courseService patterns

import {
  collection,
  doc,
  getDocs,
  getDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  addDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../config/firebase';

// ==================== INTERFACES ====================

// Global permissions (stored on CourseAssignment for cross-course access)
export type GlobalPermission = 'course_creation' | 'task_creation_global';

// Per-course permissions (stored in CourseAssignment.permissions for a specific course)
export type CoursePermission =
  | 'editing'
  | 'qna'
  | 'task_creation'
  | 'task_editing'
  | 'task_evaluation'
  | 'exams';

export const ALL_PERMISSIONS: CoursePermission[] = ['editing', 'qna', 'task_creation', 'task_editing', 'task_evaluation', 'exams'];

export const PERMISSION_META: Record<CoursePermission, {
  label: string;
  description: string;
  color: string;
  bgColor: string;
}> = {
  editing: {
    label: 'Course Editing',
    description: 'Edit content, lessons, and materials',
    color: '#6366f1',
    bgColor: 'rgba(99,102,241,0.12)',
  },
  qna: {
    label: 'Q&A',
    description: 'Manage student questions and answers',
    color: '#0ea5e9',
    bgColor: 'rgba(14,165,233,0.12)',
  },
  task_creation: {
    label: 'Task Creation',
    description: 'Create tasks for this specific course',
    color: '#f59e0b',
    bgColor: 'rgba(245,158,11,0.12)',
  },
  task_editing: {
    label: 'Task Editing',
    description: 'Edit tasks belonging to this course',
    color: '#f97316',
    bgColor: 'rgba(249,115,22,0.12)',
  },
  task_evaluation: {
    label: 'Task Evaluation',
    description: 'Evaluate and grade tasks for this course',
    color: '#22c55e',
    bgColor: 'rgba(34,197,94,0.12)',
  },
  exams: {
    label: 'Exams',
    description: 'Manage exams and assessments',
    color: '#10b981',
    bgColor: 'rgba(16,185,129,0.12)',
  },
};

export interface CourseAssignment {
  id?: string;
  teacherUid: string;
  teacherUserId: string;
  teacherSurname: string;
  teacherFullName?: string;
  teacherPhone?: string;
  courseId: string;
  courseTitle: string;
  courseCategory?: string;
  courseThumbnail?: string;
  permissions: CoursePermission[];
  // Global permissions that apply across all courses (e.g. course_creation, task_creation_global)
  globalPermissions?: GlobalPermission[];
  // Subjects this teacher can access for Q&A and Exams. Empty = all subjects.
  allowedSubjects: string[];
  assignedAt: Date;
  assignedByUid: string;
  assignedByUserId: string;
  assignedBySurname: string;
  updatedAt?: Date;
  updatedByUid?: string;
  updatedByUserId?: string;
  notes?: string;
  isActive: boolean;
}

export interface AssignmentLog {
  id?: string;
  action: 'assigned' | 'unassigned' | 'permissions_updated' | 'deactivated' | 'reactivated';
  teacherUid: string;
  teacherUserId: string;
  teacherSurname: string;
  courseId: string;
  courseTitle: string;
  performedByUid: string;
  performedByUserId: string;
  performedBySurname: string;
  timestamp: Date;
  details: string;
  previousPermissions?: CoursePermission[];
  newPermissions?: CoursePermission[];
}

export interface AssignmentStats {
  totalAssignments: number;
  activeAssignments: number;
  teachersWithAccess: number;
  coursesAssigned: number;
  permissionBreakdown: Record<CoursePermission, number>;
}

// ==================== SERVICE ====================

export const courseAssignmentService = {

  /**
   * Assign (or update) a teacher's access to a course
   */
  async assignTeacherToCourse(
    teacher: {
      uid: string;
      userId: string;
      surname: string;
      fullName?: string;
      phoneNumber?: string;
    },
    course: {
      id: string;
      title: string;
      category?: string;
      thumbnail?: string;
    },
    permissions: CoursePermission[],
    allowedSubjects: string[],
    assignedByUser: { uid: string; userId: string; surname: string },
    notes?: string,
    globalPermissions?: GlobalPermission[]
  ): Promise<string> {
    try {
      const existing = await this.getAssignment(teacher.uid, course.id);

      if (existing?.id) {
        await this.updateAssignmentPermissions(existing.id, permissions, allowedSubjects, assignedByUser, notes, globalPermissions);
        return existing.id;
      }

      const ref = await addDoc(collection(db, 'course_assignments'), {
        teacherUid: teacher.uid,
        teacherUserId: teacher.userId,
        teacherSurname: teacher.surname,
        teacherFullName: teacher.fullName || '',
        teacherPhone: teacher.phoneNumber || '',
        courseId: course.id,
        courseTitle: course.title,
        courseCategory: course.category || '',
        courseThumbnail: course.thumbnail || '',
        permissions,
        globalPermissions: globalPermissions || [],
        allowedSubjects,
        assignedAt: Timestamp.now(),
        assignedByUid: assignedByUser.uid,
        assignedByUserId: assignedByUser.userId,
        assignedBySurname: assignedByUser.surname,
        notes: notes || '',
        isActive: true,
      });

      await this._log({
        action: 'assigned',
        teacherUid: teacher.uid,
        teacherUserId: teacher.userId,
        teacherSurname: teacher.surname,
        courseId: course.id,
        courseTitle: course.title,
        performedByUid: assignedByUser.uid,
        performedByUserId: assignedByUser.userId,
        performedBySurname: assignedByUser.surname,
        timestamp: new Date(),
        details: `${teacher.surname} assigned to "${course.title}" with [${permissions.join(', ')}]${allowedSubjects.length ? ` — subjects: [${allowedSubjects.join(', ')}]` : ''}`,
        newPermissions: permissions,
      });

      return ref.id;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to assign teacher');
    }
  },

  /**
   * Update permissions for an existing assignment
   */
  async updateAssignmentPermissions(
    assignmentId: string,
    newPermissions: CoursePermission[],
    allowedSubjects: string[],
    updatedByUser: { uid: string; userId: string; surname: string },
    notes?: string,
    globalPermissions?: GlobalPermission[]
  ): Promise<void> {
    try {
      const ref = doc(db, 'course_assignments', assignmentId);
      const snap = await getDoc(ref);
      if (!snap.exists()) throw new Error('Assignment not found');

      const old = snap.data() as CourseAssignment;

      await updateDoc(ref, {
        permissions: newPermissions,
        globalPermissions: globalPermissions !== undefined ? globalPermissions : (old.globalPermissions || []),
        allowedSubjects,
        isActive: true,
        updatedAt: Timestamp.now(),
        updatedByUid: updatedByUser.uid,
        updatedByUserId: updatedByUser.userId,
        ...(notes !== undefined ? { notes } : {}),
      });

      await this._log({
        action: 'permissions_updated',
        teacherUid: old.teacherUid,
        teacherUserId: old.teacherUserId,
        teacherSurname: old.teacherSurname,
        courseId: old.courseId,
        courseTitle: old.courseTitle,
        performedByUid: updatedByUser.uid,
        performedByUserId: updatedByUser.userId,
        performedBySurname: updatedByUser.surname,
        timestamp: new Date(),
        details: `Permissions changed: [${old.permissions?.join(', ')}] → [${newPermissions.join(', ')}]`,
        previousPermissions: old.permissions,
        newPermissions,
      });
    } catch (error: any) {
      throw new Error(error.message || 'Failed to update permissions');
    }
  },

  /**
   * Permanently remove a teacher's access to a course
   */
  async revokeAccess(
    assignmentId: string,
    revokedByUser: { uid: string; userId: string; surname: string }
  ): Promise<void> {
    try {
      const ref = doc(db, 'course_assignments', assignmentId);
      const snap = await getDoc(ref);
      if (!snap.exists()) throw new Error('Assignment not found');

      const data = snap.data() as CourseAssignment;
      await deleteDoc(ref);

      await this._log({
        action: 'unassigned',
        teacherUid: data.teacherUid,
        teacherUserId: data.teacherUserId,
        teacherSurname: data.teacherSurname,
        courseId: data.courseId,
        courseTitle: data.courseTitle,
        performedByUid: revokedByUser.uid,
        performedByUserId: revokedByUser.userId,
        performedBySurname: revokedByUser.surname,
        timestamp: new Date(),
        details: `${data.teacherSurname} removed from "${data.courseTitle}"`,
        previousPermissions: data.permissions,
        newPermissions: [],
      });
    } catch (error: any) {
      throw new Error(error.message || 'Failed to revoke access');
    }
  },

  /**
   * Temporarily enable / disable access without deleting
   */
  async toggleActive(
    assignmentId: string,
    isActive: boolean,
    byUser: { uid: string; userId: string; surname: string }
  ): Promise<void> {
    try {
      const ref = doc(db, 'course_assignments', assignmentId);
      const snap = await getDoc(ref);
      if (!snap.exists()) throw new Error('Assignment not found');
      const data = snap.data() as CourseAssignment;

      await updateDoc(ref, {
        isActive,
        updatedAt: Timestamp.now(),
        updatedByUid: byUser.uid,
        updatedByUserId: byUser.userId,
      });

      await this._log({
        action: isActive ? 'reactivated' : 'deactivated',
        teacherUid: data.teacherUid,
        teacherUserId: data.teacherUserId,
        teacherSurname: data.teacherSurname,
        courseId: data.courseId,
        courseTitle: data.courseTitle,
        performedByUid: byUser.uid,
        performedByUserId: byUser.userId,
        performedBySurname: byUser.surname,
        timestamp: new Date(),
        details: `Access for "${data.courseTitle}" was ${isActive ? 'reactivated' : 'deactivated'} for ${data.teacherSurname}`,
      });
    } catch (error: any) {
      throw new Error(error.message || 'Failed to toggle status');
    }
  },

  /**
   * Save global permissions (course_creation, task_creation_global) for a teacher.
   * Updates globalPermissions on ALL existing assignments for that teacher.
   * If the teacher has no assignments yet, creates a sentinel record with courseId='__global__'
   * so the global flags are persisted independently.
   */
  async saveGlobalPermissions(
    teacher: { uid: string; userId: string; surname: string; fullName?: string; phoneNumber?: string },
    globalPermissions: GlobalPermission[],
    byUser: { uid: string; userId: string; surname: string }
  ): Promise<void> {
    try {
      const existing = await this.getTeacherAssignments(teacher.uid);

      if (existing.length > 0) {
        // Update globalPermissions on every existing assignment for this teacher
        const batch = writeBatch(db);
        for (const a of existing) {
          if (!a.id) continue;
          batch.update(doc(db, 'course_assignments', a.id), {
            globalPermissions,
            updatedAt: Timestamp.now(),
            updatedByUid: byUser.uid,
            updatedByUserId: byUser.userId,
          });
        }
        await batch.commit();
      } else {
        // No assignments yet — create a sentinel record keyed to '__global__'
        const sentinelRef = await this.getAssignment(teacher.uid, '__global__');
        if (sentinelRef?.id) {
          await updateDoc(doc(db, 'course_assignments', sentinelRef.id), {
            globalPermissions,
            updatedAt: Timestamp.now(),
            updatedByUid: byUser.uid,
            updatedByUserId: byUser.userId,
          });
        } else {
          await addDoc(collection(db, 'course_assignments'), {
            teacherUid: teacher.uid,
            teacherUserId: teacher.userId,
            teacherSurname: teacher.surname,
            teacherFullName: teacher.fullName || '',
            teacherPhone: teacher.phoneNumber || '',
            courseId: '__global__',
            courseTitle: '__global__',
            courseCategory: '',
            courseThumbnail: '',
            permissions: [],
            globalPermissions,
            allowedSubjects: [],
            assignedAt: Timestamp.now(),
            assignedByUid: byUser.uid,
            assignedByUserId: byUser.userId,
            assignedBySurname: byUser.surname,
            notes: '',
            isActive: true,
          });
        }
      }

      await this._log({
        action: 'permissions_updated',
        teacherUid: teacher.uid,
        teacherUserId: teacher.userId,
        teacherSurname: teacher.surname,
        courseId: '__global__',
        courseTitle: 'Global Permissions',
        performedByUid: byUser.uid,
        performedByUserId: byUser.userId,
        performedBySurname: byUser.surname,
        timestamp: new Date(),
        details: `Global permissions updated: [${globalPermissions.join(', ')}]`,
      });
    } catch (error: any) {
      throw new Error(error.message || 'Failed to save global permissions');
    }
  },

  /**
   * Bulk assign a teacher to multiple courses at once
   */
  async bulkAssign(
    teacher: { uid: string; userId: string; surname: string; fullName?: string; phoneNumber?: string },
    courses: Array<{ id: string; title: string; category?: string; thumbnail?: string; permissions: CoursePermission[]; allowedSubjects: string[] }>,
    byUser: { uid: string; userId: string; surname: string }
  ): Promise<void> {
    try {
      const batch = writeBatch(db);

      for (const c of courses) {
        const existing = await this.getAssignment(teacher.uid, c.id);
        if (existing?.id) {
          const ref = doc(db, 'course_assignments', existing.id);
          batch.update(ref, {
            permissions: c.permissions,
            allowedSubjects: c.allowedSubjects,
            isActive: true,
            updatedAt: Timestamp.now(),
            updatedByUid: byUser.uid,
          });
        } else {
          const ref = doc(collection(db, 'course_assignments'));
          batch.set(ref, {
            teacherUid: teacher.uid,
            teacherUserId: teacher.userId,
            teacherSurname: teacher.surname,
            teacherFullName: teacher.fullName || '',
            teacherPhone: teacher.phoneNumber || '',
            courseId: c.id,
            courseTitle: c.title,
            courseCategory: c.category || '',
            courseThumbnail: c.thumbnail || '',
            permissions: c.permissions,
            allowedSubjects: c.allowedSubjects,
            assignedAt: Timestamp.now(),
            assignedByUid: byUser.uid,
            assignedByUserId: byUser.userId,
            assignedBySurname: byUser.surname,
            notes: '',
            isActive: true,
          });
        }
      }

      await batch.commit();

      await this._log({
        action: 'assigned',
        teacherUid: teacher.uid,
        teacherUserId: teacher.userId,
        teacherSurname: teacher.surname,
        courseId: courses.map(c => c.id).join(','),
        courseTitle: `${courses.length} courses`,
        performedByUid: byUser.uid,
        performedByUserId: byUser.userId,
        performedBySurname: byUser.surname,
        timestamp: new Date(),
        details: `Bulk: ${teacher.surname} assigned to ${courses.length} courses`,
      });
    } catch (error: any) {
      throw new Error(error.message || 'Bulk assignment failed');
    }
  },

  // ── READ ──────────────────────────────────────────────────────────────────

  async getAssignment(teacherUid: string, courseId: string): Promise<CourseAssignment | null> {
    try {
      const q = query(
        collection(db, 'course_assignments'),
        where('teacherUid', '==', teacherUid),
        where('courseId', '==', courseId)
      );
      const snap = await getDocs(q);
      if (snap.empty) return null;
      const d = snap.docs[0];
      return {
        ...d.data(),
        id: d.id,
        assignedAt: d.data().assignedAt?.toDate() || new Date(),
        updatedAt: d.data().updatedAt?.toDate(),
      } as CourseAssignment;
    } catch {
      return null;
    }
  },

  async getTeacherAssignments(teacherUid: string): Promise<CourseAssignment[]> {
    try {
      const q = query(
        collection(db, 'course_assignments'),
        where('teacherUid', '==', teacherUid),
        orderBy('assignedAt', 'desc')
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => ({
        ...d.data(),
        id: d.id,
        assignedAt: d.data().assignedAt?.toDate() || new Date(),
        updatedAt: d.data().updatedAt?.toDate(),
      })) as CourseAssignment[];
    } catch (error: any) {
      throw new Error(error.message || 'Failed to load assignments');
    }
  },

  async getCourseAssignments(courseId: string): Promise<CourseAssignment[]> {
    try {
      const q = query(
        collection(db, 'course_assignments'),
        where('courseId', '==', courseId),
        orderBy('assignedAt', 'desc')
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => ({
        ...d.data(),
        id: d.id,
        assignedAt: d.data().assignedAt?.toDate() || new Date(),
        updatedAt: d.data().updatedAt?.toDate(),
      })) as CourseAssignment[];
    } catch (error: any) {
      throw new Error(error.message || 'Failed to load course assignments');
    }
  },

  async getAllAssignments(): Promise<CourseAssignment[]> {
    try {
      const q = query(
        collection(db, 'course_assignments'),
        orderBy('assignedAt', 'desc')
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => ({
        ...d.data(),
        id: d.id,
        assignedAt: d.data().assignedAt?.toDate() || new Date(),
        updatedAt: d.data().updatedAt?.toDate(),
      })) as CourseAssignment[];
    } catch (error: any) {
      throw new Error(error.message || 'Failed to load all assignments');
    }
  },

  async hasPermission(teacherUid: string, courseId: string, permission: CoursePermission): Promise<boolean> {
    const a = await this.getAssignment(teacherUid, courseId);
    if (!a || !a.isActive) return false;
    return a.permissions.includes(permission);
  },

  async getStats(): Promise<AssignmentStats> {
    const all = await this.getAllAssignments();
    const active = all.filter(a => a.isActive);
    const breakdown: Record<CoursePermission, number> = { editing: 0, qna: 0, task_creation: 0, task_editing: 0, task_evaluation: 0, exams: 0 };
    active.forEach(a => a.permissions.forEach(p => breakdown[p]++));
    return {
      totalAssignments: all.length,
      activeAssignments: active.length,
      teachersWithAccess: new Set(active.map(a => a.teacherUid)).size,
      coursesAssigned: new Set(active.map(a => a.courseId)).size,
      permissionBreakdown: breakdown,
    };
  },

  async getLogs(filters?: { teacherUid?: string; courseId?: string }): Promise<AssignmentLog[]> {
    try {
      let q;
      if (filters?.teacherUid) {
        q = query(collection(db, 'assignment_logs'), where('teacherUid', '==', filters.teacherUid), orderBy('timestamp', 'desc'));
      } else if (filters?.courseId) {
        q = query(collection(db, 'assignment_logs'), where('courseId', '==', filters.courseId), orderBy('timestamp', 'desc'));
      } else {
        q = query(collection(db, 'assignment_logs'), orderBy('timestamp', 'desc'));
      }
      const snap = await getDocs(q);
      return snap.docs.map(d => ({
        ...d.data(),
        id: d.id,
        timestamp: d.data().timestamp?.toDate() || new Date(),
      })) as AssignmentLog[];
    } catch (error: any) {
      throw new Error(error.message || 'Failed to load logs');
    }
  },

  async _log(log: Omit<AssignmentLog, 'id'>): Promise<void> {
    try {
      await addDoc(collection(db, 'assignment_logs'), {
        ...log,
        timestamp: Timestamp.now(),
      });
    } catch (e) {
      console.error('Failed to write assignment log:', e);
    }
  },
};

export default courseAssignmentService;
