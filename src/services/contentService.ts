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
  getDoc,
  where,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { uploadService } from './uploadService';

export interface MCQQuestion {
  id: string;
  question: string;
  questionImage?: string;
  options: string[];
  correctOptions: number[]; // Changed to array for multiple correct answers
  correctMarks: number;
  wrongMarks: number;
  skipMarks: number;
  solution: string;
  solutionImage?: string;
  isLocked?: boolean; // Whether this question position is locked
  lockedPosition?: 'first' | 'last' | null; // Where it's locked
}

export interface WrittenQuestion {
  id: string;
  question: string;
  questionImage?: string;
  solution: string;
  solutionImage?: string;
  marks: number; // Marks for this written question
  isLocked?: boolean; // Whether this question position is locked
  lockedPosition?: 'first' | 'last' | null; // Where it's locked
}

export interface Content {
  id: string;
  customId: string;
  title: string;
  subject: string;
  category: string;
  description: string;
  tags: string[];
  difficulty: 'easy' | 'medium' | 'hard' | 'very_hard';
  language: string;
  version: string;
  duration: number; // in minutes
  durationFormatted: string;
  type: 'lesson' | 'note' | 'trick' | 'exam';
  
  // File URLs
  videoUrl?: string;
  videoFileName?: string;
  noteUrl?: string;
  noteFileName?: string;
  
  // Exam specific fields
  examType?: 'mcq' | 'written' | 'mixed'; // Added 'mixed' type
  totalQuestions?: number;
  questionsToShow?: number;
  totalMarks?: number; // Total marks for the exam
  mcqQuestions?: MCQQuestion[];
  writtenQuestions?: WrittenQuestion[];
  
  // Metadata
  createdBy: string;
  createdAt: Date;
  updatedAt?: Date;
}

export const contentService = {
  // Upload file using Supabase
  async uploadFile(file: File, folder: string): Promise<{ url: string; fileName: string }> {
    try {
      if (!file) {
        throw new Error('No file provided');
      }

      const timestamp = Date.now();
      const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const fileName = `${timestamp}_${sanitizedFileName}`;
      
      console.log('Uploading file:', fileName, 'to folder:', folder);
      
      const result = await uploadService.uploadToSupabase(file, folder);
      
      console.log('File uploaded successfully:', result.url);
      
      return { url: result.url, fileName };
    } catch (error: any) {
      console.error('Error uploading file:', error);
      throw new Error(`Failed to upload file: ${error.message}`);
    }
  },

  // Content CRUD operations
  async createContent(content: Omit<Content, 'id' | 'createdAt'>): Promise<string> {
    try {
      console.log('Creating content:', content);
      
      // Check if customId already exists
      const existingContent = await this.getContentByCustomId(content.customId);
      if (existingContent) {
        throw new Error(`Content with ID "${content.customId}" already exists`);
      }
      
      const docRef = await addDoc(collection(db, 'content'), {
        ...content,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });
      
      console.log('Content created with ID:', docRef.id);
      return docRef.id;
    } catch (error: any) {
      console.error('Error creating content:', error);
      throw new Error(`Failed to create content: ${error.message}`);
    }
  },

  async getAllContent(): Promise<Content[]> {
    try {
      const contentCollection = collection(db, 'content');
      const contentSnapshot = await getDocs(query(contentCollection, orderBy('createdAt', 'desc')));
      
      const contents = contentSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate()
        } as Content;
      });
      
      console.log('Fetched contents:', contents.length);
      return contents;
    } catch (error: any) {
      console.error('Error getting content:', error);
      throw new Error(`Failed to get content: ${error.message}`);
    }
  },

  async getContentByUser(userId: string): Promise<Content[]> {
    try {
      if (!userId) {
        throw new Error('User ID is required');
      }

      const contentCollection = collection(db, 'content');
      const q = query(
        contentCollection, 
        where('createdBy', '==', userId),
        orderBy('createdAt', 'desc')
      );
      const contentSnapshot = await getDocs(q);
      
      const contents = contentSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate()
        } as Content;
      });
      
      console.log('Fetched user contents:', contents.length);
      return contents;
    } catch (error: any) {
      console.error('Error getting user content:', error);
      throw new Error(`Failed to get user content: ${error.message}`);
    }
  },

  async getContentById(id: string): Promise<Content | null> {
    try {
      if (!id) {
        throw new Error('Content ID is required');
      }

      const contentDoc = await getDoc(doc(db, 'content', id));
      if (!contentDoc.exists()) {
        return null;
      }
      
      const data = contentDoc.data();
      return {
        id: contentDoc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate()
      } as Content;
    } catch (error: any) {
      console.error('Error getting content by ID:', error);
      throw new Error(`Failed to get content: ${error.message}`);
    }
  },

  async getContentByCustomId(customId: string): Promise<Content | null> {
    try {
      if (!customId) {
        throw new Error('Custom ID is required');
      }

      const contentCollection = collection(db, 'content');
      const q = query(contentCollection, where('customId', '==', customId));
      const contentSnapshot = await getDocs(q);
      
      if (contentSnapshot.empty) {
        return null;
      }

      const doc = contentSnapshot.docs[0];
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate()
      } as Content;
    } catch (error: any) {
      console.error('Error getting content by custom ID:', error);
      throw new Error(`Failed to get content: ${error.message}`);
    }
  },

  async updateContent(id: string, updates: Partial<Content>): Promise<void> {
    try {
      if (!id) {
        throw new Error('Content ID is required');
      }

      const contentRef = doc(db, 'content', id);
      await updateDoc(contentRef, {
        ...updates,
        updatedAt: Timestamp.now()
      });
      
      console.log('Content updated:', id);
    } catch (error: any) {
      console.error('Error updating content:', error);
      throw new Error(`Failed to update content: ${error.message}`);
    }
  },

  async deleteContent(id: string): Promise<void> {
    try {
      if (!id) {
        throw new Error('Content ID is required');
      }

      // Get the content first to find the file paths
      const content = await this.getContentById(id);
      if (!content) {
        throw new Error('Content not found');
      }

      // Note: We're not deleting files from Supabase here as they're managed separately
      // If you need to delete files from Supabase, you'll need to implement that separately

      // Delete the document from Firestore
      await deleteDoc(doc(db, 'content', id));
      console.log('Content deleted:', id);
    } catch (error: any) {
      console.error('Error deleting content:', error);
      throw new Error(`Failed to delete content: ${error.message}`);
    }
  },

  // Search content
  async searchContent(searchTerm: string, filters?: {
    subject?: string;
    category?: string;
    type?: string;
    difficulty?: string;
  }): Promise<Content[]> {
    try {
      const allContent = await this.getAllContent();
      
      return allContent.filter(content => {
        const matchesSearch = content.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            content.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            content.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            content.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            content.tags?.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
        
        const matchesSubject = !filters?.subject || content.subject === filters.subject;
        const matchesCategory = !filters?.category || content.category === filters.category;
        const matchesType = !filters?.type || content.type === filters.type;
        const matchesDifficulty = !filters?.difficulty || content.difficulty === filters.difficulty;
        
        return matchesSearch && matchesSubject && matchesCategory && matchesType && matchesDifficulty;
      });
    } catch (error: any) {
      console.error('Error searching content:', error);
      throw new Error(`Failed to search content: ${error.message}`);
    }
  },

  // Get content by subject
  async getContentBySubject(subject: string): Promise<Content[]> {
    try {
      const allContent = await this.getAllContent();
      return allContent.filter(content => content.subject === subject);
    } catch (error: any) {
      console.error('Error getting content by subject:', error);
      throw new Error(`Failed to get content by subject: ${error.message}`);
    }
  },

  // Get content by category
  async getContentByCategory(category: string): Promise<Content[]> {
    try {
      const allContent = await this.getAllContent();
      return allContent.filter(content => content.category === category);
    } catch (error: any) {
      console.error('Error getting content by category:', error);
      throw new Error(`Failed to get content by category: ${error.message}`);
    }
  },

  // Get content by type
  async getContentByType(type: 'lesson' | 'note' | 'trick' | 'exam'): Promise<Content[]> {
    try {
      const allContent = await this.getAllContent();
      return allContent.filter(content => content.type === type);
    } catch (error: any) {
      console.error('Error getting content by type:', error);
      throw new Error(`Failed to get content by type: ${error.message}`);
    }
  },

  // Get all unique subjects
  async getAllSubjects(): Promise<string[]> {
    try {
      const allContent = await this.getAllContent();
      const subjects = new Set<string>();
      allContent.forEach(content => {
        if (content.subject) subjects.add(content.subject);
      });
      return Array.from(subjects).sort();
    } catch (error: any) {
      console.error('Error getting subjects:', error);
      throw new Error(`Failed to get subjects: ${error.message}`);
    }
  },

  // Get all unique categories
  async getAllCategories(): Promise<string[]> {
    try {
      const allContent = await this.getAllContent();
      const categories = new Set<string>();
      allContent.forEach(content => {
        if (content.category) categories.add(content.category);
      });
      return Array.from(categories).sort();
    } catch (error: any) {
      console.error('Error getting categories:', error);
      throw new Error(`Failed to get categories: ${error.message}`);
    }
  },

  // Statistics
  async getContentStats(userId?: string): Promise<{
    total: number;
    byType: Record<string, number>;
    bySubject: Record<string, number>;
    byCategory: Record<string, number>;
    byDifficulty: Record<string, number>;
    totalDuration: number; // in minutes
    recentUploads: Content[];
  }> {
    try {
      let content: Content[];
      if (userId) {
        content = await this.getContentByUser(userId);
      } else {
        content = await this.getAllContent();
      }

      const byType: Record<string, number> = {};
      const bySubject: Record<string, number> = {};
      const byCategory: Record<string, number> = {};
      const byDifficulty: Record<string, number> = {};
      let totalDuration = 0;

      content.forEach(item => {
        byType[item.type] = (byType[item.type] || 0) + 1;
        bySubject[item.subject] = (bySubject[item.subject] || 0) + 1;
        if (item.category) byCategory[item.category] = (byCategory[item.category] || 0) + 1;
        byDifficulty[item.difficulty] = (byDifficulty[item.difficulty] || 0) + 1;
        totalDuration += item.duration || 0;
      });

      return {
        total: content.length,
        byType,
        bySubject,
        byCategory,
        byDifficulty,
        totalDuration,
        recentUploads: content.slice(0, 5)
      };
    } catch (error: any) {
      console.error('Error getting content stats:', error);
      throw new Error(`Failed to get content stats: ${error.message}`);
    }
  }
};
