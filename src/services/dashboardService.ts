// src/services/dashboardService.ts
// Persists student dashboard objectives to Firestore.

import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';

export interface DashboardObjective {
  id: string;
  studentId: string;
  title: string;
  completed: boolean;
  priority: 'high' | 'medium' | 'low';
  createdAt: Date;
}

export const dashboardService = {

  async getObjectives(studentId: string): Promise<DashboardObjective[]> {
    const snap = await getDocs(
      query(
        collection(db, 'dashboardObjectives'),
        where('studentId', '==', studentId),
        orderBy('createdAt', 'asc'),
      ),
    );
    return snap.docs.map(d => ({
      id: d.id,
      ...(d.data() as Omit<DashboardObjective, 'id' | 'createdAt'>),
      createdAt: d.data().createdAt?.toDate() ?? new Date(),
    }));
  },

  async addObjective(
    studentId: string,
    title: string,
    priority: 'high' | 'medium' | 'low',
  ): Promise<DashboardObjective> {
    const ref = await addDoc(collection(db, 'dashboardObjectives'), {
      studentId,
      title,
      completed: false,
      priority,
      createdAt: Timestamp.now(),
    });
    return {
      id: ref.id,
      studentId,
      title,
      completed: false,
      priority,
      createdAt: new Date(),
    };
  },

  async toggleObjective(id: string, completed: boolean): Promise<void> {
    await updateDoc(doc(db, 'dashboardObjectives', id), { completed });
  },

  async deleteObjective(id: string): Promise<void> {
    await deleteDoc(doc(db, 'dashboardObjectives', id));
  },
};
