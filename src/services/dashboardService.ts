// src/services/dashboardService.ts
// Persists student dashboard objectives to Firestore.

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { getDocs } from './firestoreMonitor';
import { db } from '../config/firebase';

// ─── Cache ────────────────────────────────────────────────────────────────────
// getObjectives is called on every dashboard mount + every poll.
// Cache per studentId with 3-min TTL. Invalidated on write operations.
const objectivesCache = new Map<string, { data: DashboardObjective[]; ts: number }>();
const OBJECTIVES_TTL = 3 * 60 * 1000; // 3 minutes
// In-flight dedup: if a fetch is already in progress for a studentId, reuse it
const objectivesInFlight = new Map<string, Promise<DashboardObjective[]>>();

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
    // Return cached if fresh
    const cached = objectivesCache.get(studentId);
    if (cached && Date.now() - cached.ts < OBJECTIVES_TTL) return cached.data;
    // Dedup concurrent calls — reuse in-flight promise
    if (objectivesInFlight.has(studentId)) return objectivesInFlight.get(studentId)!;
    const fetch = (async () => {
      try {
        const snap = await getDocs(
          query(
            collection(db, 'dashboardObjectives'),
            where('studentId', '==', studentId),
            orderBy('createdAt', 'asc'),
          ),
        );
        const result = snap.docs.map(d => ({
          id: d.id,
          ...(d.data() as Omit<DashboardObjective, 'id' | 'createdAt'>),
          createdAt: d.data().createdAt?.toDate() ?? new Date(),
        }));
        objectivesCache.set(studentId, { data: result, ts: Date.now() });
        return result;
      } finally {
        objectivesInFlight.delete(studentId);
      }
    })();
    objectivesInFlight.set(studentId, fetch);
    return fetch;
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
    objectivesCache.delete(studentId); // invalidate
    return {
      id: ref.id,
      studentId,
      title,
      completed: false,
      priority,
      createdAt: new Date(),
    };
  },

  async toggleObjective(id: string, completed: boolean, studentId?: string): Promise<void> {
    await updateDoc(doc(db, 'dashboardObjectives', id), { completed });
    if (studentId) objectivesCache.delete(studentId);
  },

  async deleteObjective(id: string, studentId?: string): Promise<void> {
    await deleteDoc(doc(db, 'dashboardObjectives', id));
    if (studentId) objectivesCache.delete(studentId);
  },
};
