// src/services/topicGroupService.ts
// Teacher Topic Group management — Groups · Subjects · Chapters · Topics · CSV Import

import {
  collection, doc, getDocs, addDoc, updateDoc, deleteDoc,
  query, where, Timestamp, getDoc,
} from 'firebase/firestore';
import { db } from '../config/firebase';

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface Topic {
  id: string;
  name: string;
  minHours: number;
  maxHours: number;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface TopicChapter {
  id: string;
  name: string;
  topics: Topic[];
}

export interface TopicSubject {
  id: string;
  name: string;
  chapters: TopicChapter[];
}

export interface TopicGroup {
  id: string;
  teacherId: string;
  name: string;
  subjects: TopicSubject[];
  assignedCourseIds: string[];
  createdAt: Date;
  updatedAt?: Date;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function genId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function toDate(val: any): Date {
  if (val?.toDate) return val.toDate();
  if (val instanceof Date) return val;
  return new Date(val);
}

// ─── Service ─────────────────────────────────────────────────────────────────

export const topicGroupService = {

  async createGroup(data: Omit<TopicGroup, 'id' | 'createdAt'>): Promise<string> {
    const ref = await addDoc(collection(db, 'topicGroups'), {
      ...data,
      createdAt: Timestamp.now(),
    });
    return ref.id;
  },

  async getGroupsByTeacher(teacherId: string): Promise<TopicGroup[]> {
    const q = query(collection(db, 'topicGroups'), where('teacherId', '==', teacherId));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      createdAt: toDate(d.data().createdAt),
      updatedAt: d.data().updatedAt ? toDate(d.data().updatedAt) : undefined,
    })) as TopicGroup[];
  },

  async getGroupsByCourse(courseId: string): Promise<TopicGroup[]> {
    try {
      const q = query(
        collection(db, 'topicGroups'),
        where('assignedCourseIds', 'array-contains', courseId)
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        createdAt: toDate(d.data().createdAt),
        updatedAt: d.data().updatedAt ? toDate(d.data().updatedAt) : undefined,
      })) as TopicGroup[];
    } catch {
      return [];
    }
  },

  async updateGroup(id: string, updates: Partial<Omit<TopicGroup, 'id' | 'createdAt'>>): Promise<void> {
    await updateDoc(doc(db, 'topicGroups', id), {
      ...updates,
      updatedAt: Timestamp.now(),
    });
  },

  async deleteGroup(id: string): Promise<void> {
    await deleteDoc(doc(db, 'topicGroups', id));
  },

  async assignToCourse(groupId: string, courseId: string): Promise<void> {
    const ref = doc(db, 'topicGroups', groupId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const ids: string[] = snap.data().assignedCourseIds || [];
    if (!ids.includes(courseId)) {
      await updateDoc(ref, {
        assignedCourseIds: [...ids, courseId],
        updatedAt: Timestamp.now(),
      });
    }
  },

  async unassignFromCourse(groupId: string, courseId: string): Promise<void> {
    const ref = doc(db, 'topicGroups', groupId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const ids: string[] = snap.data().assignedCourseIds || [];
    await updateDoc(ref, {
      assignedCourseIds: ids.filter(id => id !== courseId),
      updatedAt: Timestamp.now(),
    });
  },

  /**
   * Parse CSV text into TopicSubject[] hierarchy.
   * Expected columns (case-insensitive): Subject, Chapter, Topic, MinHours, MaxHours, Difficulty
   * Delimiter: comma or semicolon (auto-detected)
   */
  parseTopicCSV(csvText: string): TopicSubject[] {
    const lines = csvText.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) throw new Error('CSV must have a header row + at least one data row.');

    const delim = lines[0].includes(';') ? ';' : ',';
    const headers = lines[0].split(delim).map(h => h.trim().toLowerCase().replace(/["']/g, ''));

    const idx = (name: string) => headers.indexOf(name);
    const sI = idx('subject'), cI = idx('chapter'), tI = idx('topic');
    const minI = idx('minhours'), maxI = idx('maxhours'), dI = idx('difficulty');

    if ([sI, cI, tI, minI, maxI, dI].some(i => i === -1)) {
      throw new Error('CSV must contain columns: Subject, Chapter, Topic, MinHours, MaxHours, Difficulty');
    }

    const subjectMap = new Map<string, Map<string, Topic[]>>();

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(delim).map(c => c.trim().replace(/["']/g, ''));
      if (cols.length <= Math.max(sI, cI, tI, minI, maxI, dI)) continue;

      const sName = cols[sI];
      const cName = cols[cI];
      const tName = cols[tI];
      if (!sName || !cName || !tName) continue;

      const minH = Math.max(0.25, parseFloat(cols[minI]) || 1);
      const maxH = Math.max(minH, parseFloat(cols[maxI]) || minH + 1);
      const rawDiff = cols[dI]?.toLowerCase() || 'medium';
      const diff: Topic['difficulty'] = (['easy', 'medium', 'hard'] as const).includes(rawDiff as any)
        ? rawDiff as Topic['difficulty']
        : 'medium';

      if (!subjectMap.has(sName)) subjectMap.set(sName, new Map());
      const chapMap = subjectMap.get(sName)!;
      if (!chapMap.has(cName)) chapMap.set(cName, []);
      chapMap.get(cName)!.push({ id: genId(), name: tName, minHours: minH, maxHours: maxH, difficulty: diff });
    }

    const subjects: TopicSubject[] = [];
    subjectMap.forEach((chapMap, subjectName) => {
      const chapters: TopicChapter[] = [];
      chapMap.forEach((topics, chapName) => {
        chapters.push({ id: genId(), name: chapName, topics });
      });
      subjects.push({ id: genId(), name: subjectName, chapters });
    });

    if (subjects.length === 0) throw new Error('No valid rows found in CSV.');
    return subjects;
  },
};
