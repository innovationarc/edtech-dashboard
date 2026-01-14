// src/services/taskService.ts
import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp,
  getDoc,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '../config/firebase';
import { gamificationService } from './gamificationService'; // Import gamificationService

export interface Task {
  id: string;
  title: string;
  description: string;
  subject: string;
  courseId?: string;
  courseName?: string;
  teacherId: string;
  teacherName: string;
  dueDate: Date;
  attachments?: { url: string; name: string; type: string }[]; // Array of file URLs and names
  pointsPossible: number;
  createdAt: Date;
  updatedAt?: Date;
}

export interface Submission {
  id: string;
  taskId: string;
  studentId: string;
  studentName: string;
  submissionText?: string;
  submissionAttachments?: { url: string; name: string; type: string }[]; // Array of file URLs and names
  submittedAt: Date;
  status: 'pending' | 'graded'; // pending, graded
  grade?: number; // points awarded
  teacherFeedbackText?: string;
  teacherFeedbackAttachments?: { url: string; name: string; type: string }[]; // Array of file URLs and names
  gradedAt?: Date;
}

export const taskService = {
  // Utility to upload files to Firebase Storage
  async uploadFile(file: File, path: string): Promise<{ url: string; name: string; type: string }> {
    try {
      const timestamp = Date.now();
      const fileName = `${timestamp}_${file.name}`;
      const storageRef = ref(storage, `${path}/${fileName}`);

      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      return { url, name: file.name, type: file.type };
    } catch (error: any) {
      throw new Error(`Failed to upload file: ${error.message}`);
    }
  },

  // Task Operations
  async createTask(task: Omit<Task, 'id' | 'createdAt'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, 'tasks'), {
        ...task,
        dueDate: Timestamp.fromDate(task.dueDate),
        createdAt: Timestamp.now(),
      });
      return docRef.id;
    } catch (error: any) {
      throw new Error(`Failed to create task: ${error.message}`);
    }
  },

  async getTasks(filters?: { teacherId?: string; studentId?: string; courseId?: string; status?: 'pending' | 'graded' | 'all' }): Promise<Task[]> {
    try {
      let q = query(collection(db, 'tasks'), orderBy('dueDate', 'asc'));

      if (filters?.teacherId) {
        q = query(q, where('teacherId', '==', filters.teacherId));
      }
      if (filters?.courseId) {
        q = query(q, where('courseId', '==', filters.courseId));
      }

      const querySnapshot = await getDocs(q);
      const tasks = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        dueDate: doc.data().dueDate.toDate(),
        createdAt: doc.data().createdAt.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
      })) as Task[];

      // If filtering by studentId or status, we need to check submissions
      if (filters?.studentId || filters?.status) {
        const filteredTasks: Task[] = [];
        for (const task of tasks) {
          const submissions = await this.getTaskSubmissions(task.id);
          const studentSubmission = submissions.find(s => s.studentId === filters?.studentId);

          if (filters?.status === 'all') {
            filteredTasks.push(task);
          } else if (filters?.status === 'pending' && !studentSubmission) {
            filteredTasks.push(task);
          } else if (filters?.status === 'graded' && studentSubmission?.status === 'graded') {
            filteredTasks.push(task);
          }
        }
        return filteredTasks;
      }

      return tasks;
    } catch (error: any) {
      throw new Error(`Failed to get tasks: ${error.message}`);
    }
  },

  async getTaskById(taskId: string): Promise<Task | null> {
    try {
      const taskDoc = await getDoc(doc(db, 'tasks', taskId));
      if (!taskDoc.exists()) {
        return null;
      }
      const data = taskDoc.data();
      return {
        id: taskDoc.id,
        ...data,
        dueDate: data.dueDate.toDate(),
        createdAt: data.createdAt.toDate(),
        updatedAt: data.updatedAt?.toDate(),
      } as Task;
    } catch (error: any) {
      throw new Error(`Failed to get task by ID: ${error.message}`);
    }
  },

  // Submission Operations
  async submitTask(submission: Omit<Submission, 'id' | 'submittedAt'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, 'submissions'), {
        ...submission,
        submittedAt: Timestamp.now(),
        status: 'pending', // Default status
      });
      return docRef.id;
    } catch (error: any) {
      throw new Error(`Failed to submit task: ${error.message}`);
    }
  },

  async getTaskSubmissions(taskId: string): Promise<Submission[]> {
    try {
      const q = query(
        collection(db, 'submissions'),
        where('taskId', '==', taskId),
        orderBy('submittedAt', 'asc')
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        submittedAt: doc.data().submittedAt.toDate(),
        gradedAt: doc.data().gradedAt?.toDate(),
      })) as Submission[];
    } catch (error: any) {
      throw new Error(`Failed to get submissions for task: ${error.message}`);
    }
  },

  async getStudentSubmissions(studentId: string): Promise<Submission[]> {
    try {
      const q = query(
        collection(db, 'submissions'),
        where('studentId', '==', studentId),
        orderBy('submittedAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        submittedAt: doc.data().submittedAt.toDate(),
        gradedAt: doc.data().gradedAt?.toDate(),
      })) as Submission[];
    } catch (error: any) {
      throw new Error(`Failed to get student submissions: ${error.message}`);
    }
  },

  async gradeSubmission(submissionId: string, gradeData: { grade: number; teacherFeedbackText?: string; teacherFeedbackAttachments?: { url: string; name: string; type: string }[] }): Promise<void> {
    try {
      const submissionRef = doc(db, 'submissions', submissionId);
      await updateDoc(submissionRef, {
        ...gradeData,
        status: 'graded',
        gradedAt: Timestamp.now(),
      });

      // Fetch the submission to get studentId and taskId
      const submissionDoc = await getDoc(submissionRef);
      if (submissionDoc.exists()) {
        const submission = submissionDoc.data() as Submission;
        // Record gamification activity for task completion
        await gamificationService.recordActivity(submission.studentId, 'task_completed', {
          taskId: submission.taskId,
          grade: gradeData.grade,
        });
      }
    } catch (error: any) {
      throw new Error(`Failed to grade submission: ${error.message}`);
    }
  },
};