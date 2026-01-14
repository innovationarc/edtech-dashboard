// src/services/contentService.ts
import { 
  collection, 
  doc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy,
  Timestamp 
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '../config/firebase';

export interface Content {
  id: string;
  title: string;
  description: string;
  type: 'lesson' | 'note' | 'trick'; // Removed 'mcq'
  course: string;
  category: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  tags?: string[];
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  createdBy: string;
  createdAt: Date;
  updatedAt?: Date;
}

// Removed MCQQuestion interface and related methods (createMCQ, getAllMCQs)
// as they are now handled by mcqService.ts

export const contentService = {
  // Upload file to Firebase Storage
  async uploadFile(file: File, path: string): Promise<{ url: string; fileName: string }> {
    try {
      const timestamp = Date.now();
      const fileName = `${timestamp}_${file.name}`;
      const storageRef = ref(storage, `${path}/${fileName}`);
      
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      
      return { url, fileName };
    } catch (error: any) {
      throw new Error(error.message);
    }
  },

  // Delete file from Firebase Storage
  async deleteFile(fileName: string, path: string): Promise<void> {
    try {
      const storageRef = ref(storage, `${path}/${fileName}`);
      await deleteObject(storageRef);
    } catch (error: any) {
      throw new Error(error.message);
    }
  },

  // Content CRUD operations
  async createContent(content: Omit<Content, 'id' | 'createdAt'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, 'content'), {
        ...content,
        createdAt: Timestamp.now()
      });
      return docRef.id;
    } catch (error: any) {
      throw new Error(error.message);
    }
  },

  async getAllContent(): Promise<Content[]> {
    try {
      const contentCollection = collection(db, 'content');
      const contentSnapshot = await getDocs(query(contentCollection, orderBy('createdAt', 'desc')));
      
      return contentSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt.toDate(),
        updatedAt: doc.data().updatedAt?.toDate()
      })) as Content[];
    } catch (error: any) {
      throw new Error(error.message);
    }
  },

  async updateContent(id: string, updates: Partial<Content>): Promise<void> {
    try {
      const contentRef = doc(db, 'content', id);
      await updateDoc(contentRef, {
        ...updates,
        updatedAt: Timestamp.now()
      });
    } catch (error: any) {
      throw new Error(error.message);
    }
  },

  async deleteContent(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'content', id));
    } catch (error: any) {
      throw new Error(error.message);
    }
  },
};
