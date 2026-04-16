// src/services/dashboardService.ts
// Offline-first: reads Dexie first, syncs Firestore in background.
// All original methods and signatures preserved 100%.

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
import { db as localDB } from '../lib/dexie';
import syncService from '../lib/syncService';

// ─── Cache ────────────────────────────────────────────────────────────────────
const objectivesCache = new Map<string, { data: DashboardObjective[]; ts: number }>();
const OBJECTIVES_TTL = 3 * 60 * 1000;
const objectivesInFlight = new Map<string, Promise<DashboardObjective[]>>();

export interface DashboardObjective {
  id: string;
  studentId: string;
  title: string;
  completed: boolean;
  priority: 'high' | 'medium' | 'low';
  createdAt: Date;
}

// ─── Offline helper ───────────────────────────────────────────────────────────
// Maps DashboardObjective ↔ LocalTask (tasks table is the closest match)
function toLocalTask(obj: DashboardObjective) {
  return {
    id: obj.id,
    userId: obj.studentId,
    title: obj.title,
    completed: obj.completed,
    priority: obj.priority as 'high' | 'medium' | 'low',
    createdAt: obj.createdAt.getTime(),
    updatedAt: Date.now(),
    _synced: true,
    _pendingSync: false,
  };
}

function fromLocalTask(t: any): DashboardObjective {
  return {
    id: t.id,
    studentId: t.userId,
    title: t.title,
    completed: t.completed,
    priority: t.priority ?? 'medium',
    createdAt: t.createdAt ? new Date(t.createdAt) : new Date(),
  };
}

export const dashboardService = {

  async getObjectives(studentId: string): Promise<DashboardObjective[]> {
    // 1. Try Dexie first — instant, works offline
    try {
      const local = await localDB.tasks
        .where('userId').equals(studentId)
        .toArray();
      if (local.length > 0) {
        // Filter only dashboard objectives (tagged by userId match — all tasks for this user)
        const cached = objectivesCache.get(studentId);
        const result = local.map(fromLocalTask)
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

        // If cache is fresh, skip background sync
        if (cached && Date.now() - cached.ts < OBJECTIVES_TTL) return result;

        // Background sync from Firestore (non-blocking)
        this._syncObjectivesFromFirestore(studentId).catch(() => {});
        return result;
      }
    } catch { /* fall through to Firestore */ }

    // 2. Return cached if fresh
    const cached = objectivesCache.get(studentId);
    if (cached && Date.now() - cached.ts < OBJECTIVES_TTL) return cached.data;

    // 3. Dedup concurrent calls
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

        // Persist to Dexie
        await localDB.tasks.bulkPut(result.map(toLocalTask)).catch(() => {});
        return result;
      } finally {
        objectivesInFlight.delete(studentId);
      }
    })();
    objectivesInFlight.set(studentId, fetch);
    return fetch;
  },

  // Background sync helper — pulls fresh data from Firestore into Dexie
  async _syncObjectivesFromFirestore(studentId: string): Promise<void> {
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
      await localDB.tasks.bulkPut(result.map(toLocalTask)).catch(() => {});
    } catch { /* non-fatal */ }
  },

  async addObjective(
    studentId: string,
    title: string,
    priority: 'high' | 'medium' | 'low',
  ): Promise<DashboardObjective> {
    const newObj: DashboardObjective = {
      id: `local_${Date.now()}`,
      studentId,
      title,
      completed: false,
      priority,
      createdAt: new Date(),
    };

    // Write to Dexie immediately
    await localDB.tasks.put(toLocalTask(newObj)).catch(() => {});
    objectivesCache.delete(studentId);

    // Write to Firestore (online) or queue (offline)
    try {
      const ref = await addDoc(collection(db, 'dashboardObjectives'), {
        studentId,
        title,
        completed: false,
        priority,
        createdAt: Timestamp.now(),
      });
      // Update local record with real Firestore ID
      const realObj = { ...newObj, id: ref.id };
      await localDB.tasks.delete(newObj.id).catch(() => {});
      await localDB.tasks.put(toLocalTask(realObj)).catch(() => {});
      objectivesCache.delete(studentId);
      return realObj;
    } catch {
      // Offline — queue for later via syncService
      await syncService.writeDoc('dashboardObjectives', newObj.id, {
        studentId, title, completed: false, priority,
        createdAt: Timestamp.now(),
      });
      return newObj;
    }
  },

  async toggleObjective(id: string, completed: boolean, studentId?: string): Promise<void> {
    // Update Dexie immediately
    try {
      const local = await localDB.tasks.get(id);
      if (local) await localDB.tasks.put({ ...local, completed, updatedAt: Date.now() });
    } catch { /* non-fatal */ }
    if (studentId) objectivesCache.delete(studentId);

    // Sync to Firestore
    try {
      await updateDoc(doc(db, 'dashboardObjectives', id), { completed });
    } catch {
      await syncService.writeDoc('dashboardObjectives', id, { completed });
    }
  },

  async deleteObjective(id: string, studentId?: string): Promise<void> {
    // Remove from Dexie immediately
    await localDB.tasks.delete(id).catch(() => {});
    if (studentId) objectivesCache.delete(studentId);

    // Sync delete to Firestore
    try {
      await deleteDoc(doc(db, 'dashboardObjectives', id));
    } catch {
      await syncService.deleteDoc('dashboardObjectives', id);
    }
  },
};
