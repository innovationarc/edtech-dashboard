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
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '../config/firebase';

export interface Content {
  id: string;
  title: string;
  description: string;
  type: 'lesson' | 'note' | 'trick' | 'mcq';
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

export const contentService = {
  // Upload file to Firebase Storage
  async uploadFile(file: File, path: string): Promise<{ url: string; fileName: string }> {
    try {
      if (!file) {
        throw new Error('No file provided');
      }

      const timestamp = Date.now();
      const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const fileName = `${timestamp}_${sanitizedFileName}`;
      const storageRef = ref(storage, `${path}/${fileName}`);
      
      console.log('Uploading file:', fileName, 'to path:', path);
      
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      
      console.log('File uploaded successfully:', url);
      
      return { url, fileName };
    } catch (error: any) {
      console.error('Error uploading file:', error);
      throw new Error(`Failed to upload file: ${error.message}`);
    }
  },

  // Delete file from Firebase Storage
  async deleteFile(fileName: string, path: string): Promise<void> {
    try {
      if (!fileName || !path) {
        throw new Error('File name and path are required');
      }
      const storageRef = ref(storage, `${path}/${fileName}`);
      await deleteObject(storageRef);
      console.log('File deleted successfully:', fileName);
    } catch (error: any) {
      // Don't throw error if file doesn't exist
      if (error.code !== 'storage/object-not-found') {
        console.error('Error deleting file:', error);
        throw new Error(`Failed to delete file: ${error.message}`);
      }
    }
  },

  // Content CRUD operations
  async createContent(content: Omit<Content, 'id' | 'createdAt'>): Promise<string> {
    try {
      console.log('Creating content:', content);
      
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

      // Get the content first to find the file path
      const content = await this.getContentById(id);
      if (!content) {
        throw new Error('Content not found');
      }

      // Delete file from storage if it exists
      if (content.fileUrl && content.fileName) {
        try {
          // Determine the path based on content type
          let path = '';
          if (content.type === 'lesson') {
            path = `content/lessons`;
          } else if (content.type === 'note') {
            path = `content/notes`;
          } else if (content.type === 'trick') {
            path = `content/tricks`;
          } else if (content.type === 'mcq') {
            path = `content/mcqs`;
          }
          
          if (path) {
            await this.deleteFile(content.fileName, path);
          }
        } catch (error) {
          // Log error but continue with document deletion
          console.error('Error deleting file from storage:', error);
        }
      }

      // Delete the document from Firestore
      await deleteDoc(doc(db, 'content', id));
      console.log('Content deleted:', id);
    } catch (error: any) {
      console.error('Error deleting content:', error);
      throw new Error(`Failed to delete content: ${error.message}`);
    }
  },

  // Search content
  async searchContent(searchTerm: string, category?: string): Promise<Content[]> {
    try {
      const allContent = await this.getAllContent();
      
      return allContent.filter(content => {
        const matchesSearch = content.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            content.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            content.tags?.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
        
        const matchesCategory = !category || category === 'all' || content.category === category;
        
        return matchesSearch && matchesCategory;
      });
    } catch (error: any) {
      console.error('Error searching content:', error);
      throw new Error(`Failed to search content: ${error.message}`);
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
  async getContentByType(type: 'lesson' | 'note' | 'trick' | 'mcq'): Promise<Content[]> {
    try {
      const allContent = await this.getAllContent();
      return allContent.filter(content => content.type === type);
    } catch (error: any) {
      console.error('Error getting content by type:', error);
      throw new Error(`Failed to get content by type: ${error.message}`);
    }
  },

  // Get content by course
  async getContentByCourse(courseId: string): Promise<Content[]> {
    try {
      const allContent = await this.getAllContent();
      return allContent.filter(content => content.course === courseId);
    } catch (error: any) {
      console.error('Error getting content by course:', error);
      throw new Error(`Failed to get content by course: ${error.message}`);
    }
  },

  // Statistics
  async getContentStats(userId?: string): Promise<{
    total: number;
    byType: Record<string, number>;
    byCategory: Record<string, number>;
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
      const byCategory: Record<string, number> = {};

      content.forEach(item => {
        byType[item.type] = (byType[item.type] || 0) + 1;
        byCategory[item.category] = (byCategory[item.category] || 0) + 1;
      });

      return {
        total: content.length,
        byType,
        byCategory,
        recentUploads: content.slice(0, 5) // Last 5 uploads
      };
    } catch (error: any) {
      console.error('Error getting content stats:', error);
      throw new Error(`Failed to get content stats: ${error.message}`);
    }
  }
};
