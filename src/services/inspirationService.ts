// src/services/inspirationService.ts
// Admins add inspirational quotes to Firestore.
// The student dashboard pulls a random one from the pool.

import {
  collection,
  doc,
  getDocs,
  addDoc,
  deleteDoc,
  query,
  orderBy,
  limit,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';

export interface Inspiration {
  id: string;
  text: string;
  author: string;
  addedBy: string;       // uid of the admin who added it
  addedByName: string;
  createdAt: Date;
}

export const inspirationService = {

  // Admin: get all inspirations (newest first)
  async getAll(): Promise<Inspiration[]> {
    const snap = await getDocs(
      query(collection(db, 'inspirations'), orderBy('createdAt', 'desc')),
    );
    return snap.docs.map(d => ({
      id: d.id,
      ...(d.data() as Omit<Inspiration, 'id' | 'createdAt'>),
      createdAt: d.data().createdAt?.toDate() ?? new Date(),
    }));
  },

  // Student dashboard: fetch one random quote from the latest 50
  async getRandom(): Promise<Inspiration | null> {
    const snap = await getDocs(
      query(collection(db, 'inspirations'), orderBy('createdAt', 'desc'), limit(50)),
    );
    if (snap.empty) return null;
    const idx = Math.floor(Math.random() * snap.docs.length);
    const d = snap.docs[idx];
    return {
      id: d.id,
      ...(d.data() as Omit<Inspiration, 'id' | 'createdAt'>),
      createdAt: d.data().createdAt?.toDate() ?? new Date(),
    };
  },

  // Admin: add a new inspiration
  async add(
    text: string,
    author: string,
    addedBy: string,
    addedByName: string,
  ): Promise<string> {
    const ref = await addDoc(collection(db, 'inspirations'), {
      text: text.trim(),
      author: author.trim() || 'Unknown',
      addedBy,
      addedByName,
      createdAt: Timestamp.now(),
    });
    return ref.id;
  },

  // Admin: remove an inspiration
  async remove(id: string): Promise<void> {
    await deleteDoc(doc(db, 'inspirations', id));
  },
};
