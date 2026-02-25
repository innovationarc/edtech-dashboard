// src/services/contentService.ts - FIXED VERSION WITH PROPER TIMESTAMP HANDLING

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
  Timestamp,
  increment 
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { uploadService, UploadProgress } from './uploadService';

export interface MCQQuestion {
  id: string;
  question: string;
  questionImage?: string;
  options: string[];
  correctOptions: number[];
  correctMarks: number;
  wrongMarks: number;
  skipMarks: number;
  solution: string;
  solutionImage?: string;
  isLocked?: boolean;
  lockedPosition?: 'first' | 'last' | null;
}

export interface WrittenQuestion {
  id: string;
  question: string;
  questionImage?: string;
  solution: string;
  solutionImage?: string;
  marks: number;
  isLocked?: boolean;
  lockedPosition?: 'first' | 'last' | null;
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
  duration: number;
  durationFormatted: string;
  type: 'lesson' | 'note' | 'trick' | 'exam';
  
  videoUrl?: string;
  videoFileName?: string;
  noteUrl?: string;
  noteFileName?: string;
  noteSource?: 'local' | 'gdrive';
  noteGDrivePreviewUrl?: string;
  noteGDriveDownloadUrl?: string;
  
  examType?: 'mcq' | 'written' | 'mixed';
  totalQuestions?: number;
  questionsToShow?: number;
  totalMarks?: number;
  mcqQuestions?: MCQQuestion[];
  writtenQuestions?: WrittenQuestion[];
  
  mcqDuration?: number;
  writtenDuration?: number;
  mcqQuestionsToShow?: number;
  writtenQuestionsToShow?: number;
  
  mcqDirection?: string;
  writtenDirection?: string;
  
  viewCount?: number;
  uniqueViewers?: number;
  coursesUsing?: string[];
  
  createdBy: string;
  createdAt: Date;
  updatedAt?: Date;
}

export interface ContentView {
  id: string;
  contentId: string;
  studentId: string;
  studentName: string;
  courseId?: string;
  courseName?: string;
  viewedAt: Date;
  duration?: number;
}

export interface ExamAttempt {
  id: string;
  contentId: string;
  studentId: string;
  studentName: string;
  courseId?: string;
  courseName?: string;
  score: number;
  totalMarks: number;
  percentage: number;
  mcqAnswers?: Array<{ questionId: string; selectedOptions: number[]; isCorrect: boolean }>;
  writtenAnswers?: Array<{ questionId: string; answer: string }>;
  attemptedAt: Date;
  timeTaken: number;
}

// HELPER: Safely convert Timestamp to Date
const toDate = (value: any): Date => {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  if (value instanceof Timestamp) return value.toDate();
  if (typeof value === 'object' && value.toDate && typeof value.toDate === 'function') {
    return value.toDate();
  }
  if (typeof value === 'number') return new Date(value);
  if (typeof value === 'string') return new Date(value);
  return new Date();
};

// CRITICAL HELPER: Remove undefined values from object recursively
const removeUndefinedFields = (obj: any): any => {
  if (obj === null || obj === undefined) {
    return null;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => removeUndefinedFields(item)).filter(item => item !== undefined);
  }

  if (obj instanceof Date || obj instanceof Timestamp) {
    return obj;
  }

  if (typeof obj === 'object') {
    const cleaned: any = {};
    
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const value = obj[key];
        
        // Skip undefined values completely
        if (value === undefined) {
          continue;
        }
        
        // Recursively clean nested objects and arrays
        if (value !== null && typeof value === 'object') {
          const cleanedValue = removeUndefinedFields(value);
          if (cleanedValue !== undefined) {
            cleaned[key] = cleanedValue;
          }
        } else {
          cleaned[key] = value;
        }
      }
    }
    
    return cleaned;
  }

  return obj;
};

// HELPER: Parse a Google Drive share link and return preview + download URLs
export const parseGDriveLink = (shareLink: string): { previewUrl: string; downloadUrl: string; fileId: string } | null => {
  try {
    // Match patterns like: https://drive.google.com/file/d/FILE_ID/view?...
    const match = shareLink.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (!match) return null;
    const fileId = match[1];
    return {
      fileId,
      previewUrl: `https://drive.google.com/file/d/${fileId}/preview`,
      downloadUrl: `https://drive.google.com/uc?export=download&id=${fileId}`
    };
  } catch {
    return null;
  }
};


  async uploadFile(
    file: File, 
    folder: string,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<{ url: string; fileName: string }> {
    try {
      if (!file) {
        throw new Error('No file provided');
      }

      const timestamp = Date.now();
      const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const fileName = `${timestamp}_${sanitizedFileName}`;
      
      console.log('Uploading file:', fileName, 'to folder:', folder);
      
      const result = await uploadService.uploadToSupabase(file, folder, onProgress);
      
      console.log('File uploaded successfully:', result.url);
      
      return { url: result.url, fileName };
    } catch (error: any) {
      console.error('Error uploading file:', error);
      throw new Error(`Failed to upload file: ${error.message}`);
    }
  },

  async deleteFile(fileUrl: string): Promise<void> {
    try {
      if (!fileUrl) return;
      
      const urlParts = fileUrl.split('/');
      const fileName = urlParts[urlParts.length - 1];
      
      await uploadService.deleteFromSupabase(fileName);
      console.log('File deleted successfully:', fileName);
    } catch (error: any) {
      console.error('Error deleting file:', error);
    }
  },

  async createContent(
    content: Omit<Content, 'id' | 'createdAt'>,
    onProgress?: (stage: string, progress: number) => void
  ): Promise<string> {
    try {
      console.log('Creating content:', content);
      
      onProgress?.('Validating content...', 10);
      
      const existingContent = await this.getContentByCustomId(content.customId);
      if (existingContent) {
        throw new Error(`Content with ID "${content.customId}" already exists`);
      }
      
      onProgress?.('Preparing data...', 30);
      
      const contentData: any = {
        customId: content.customId,
        title: content.title,
        subject: content.subject,
        category: content.category || '',
        description: content.description || '',
        tags: content.tags || [],
        difficulty: content.difficulty,
        language: content.language || '',
        version: content.version || '',
        duration: content.duration,
        durationFormatted: content.durationFormatted,
        type: content.type,
        viewCount: 0,
        uniqueViewers: 0,
        coursesUsing: [],
        createdBy: content.createdBy,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };

      if (content.videoUrl) contentData.videoUrl = content.videoUrl;
      if (content.videoFileName) contentData.videoFileName = content.videoFileName;
      if (content.noteUrl) contentData.noteUrl = content.noteUrl;
      if (content.noteFileName) contentData.noteFileName = content.noteFileName;
      if (content.noteSource) contentData.noteSource = content.noteSource;
      if (content.noteGDrivePreviewUrl) contentData.noteGDrivePreviewUrl = content.noteGDrivePreviewUrl;
      if (content.noteGDriveDownloadUrl) contentData.noteGDriveDownloadUrl = content.noteGDriveDownloadUrl;

      if (content.type === 'exam') {
        if (content.examType) contentData.examType = content.examType;
        if (content.totalQuestions !== undefined) contentData.totalQuestions = content.totalQuestions;
        if (content.questionsToShow !== undefined) contentData.questionsToShow = content.questionsToShow;
        if (content.totalMarks !== undefined) contentData.totalMarks = content.totalMarks;
        if (content.mcqQuestions) contentData.mcqQuestions = content.mcqQuestions;
        if (content.writtenQuestions) contentData.writtenQuestions = content.writtenQuestions;
        if (content.mcqDuration !== undefined) contentData.mcqDuration = content.mcqDuration;
        if (content.writtenDuration !== undefined) contentData.writtenDuration = content.writtenDuration;
        if (content.mcqQuestionsToShow !== undefined) contentData.mcqQuestionsToShow = content.mcqQuestionsToShow;
        if (content.writtenQuestionsToShow !== undefined) contentData.writtenQuestionsToShow = content.writtenQuestionsToShow;
        if (content.mcqDirection) contentData.mcqDirection = content.mcqDirection;
        if (content.writtenDirection) contentData.writtenDirection = content.writtenDirection;
      }

      const cleanedContent = removeUndefinedFields(contentData);

      console.log('Cleaned content (no undefined):', cleanedContent);
      
      onProgress?.('Saving to database...', 70);
      
      const docRef = await addDoc(collection(db, 'content'), cleanedContent);
      
      onProgress?.('Content created successfully!', 100);
      
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
          createdAt: toDate(data.createdAt),
          updatedAt: data.updatedAt ? toDate(data.updatedAt) : undefined
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
          createdAt: toDate(data.createdAt),
          updatedAt: data.updatedAt ? toDate(data.updatedAt) : undefined
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
        createdAt: toDate(data.createdAt),
        updatedAt: data.updatedAt ? toDate(data.updatedAt) : undefined
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
        createdAt: toDate(data.createdAt),
        updatedAt: data.updatedAt ? toDate(data.updatedAt) : undefined
      } as Content;
    } catch (error: any) {
      console.error('Error getting content by custom ID:', error);
      throw new Error(`Failed to get content: ${error.message}`);
    }
  },

  async updateContent(
    id: string, 
    updates: Partial<Content>,
    onProgress?: (stage: string, progress: number) => void
  ): Promise<void> {
    try {
      if (!id) {
        throw new Error('Content ID is required');
      }

      console.log('Updating content:', id, updates);
      
      onProgress?.('Preparing update...', 10);

      const updateData: any = {
        updatedAt: Timestamp.now()
      };

      if (updates.title !== undefined) updateData.title = updates.title;
      if (updates.subject !== undefined) updateData.subject = updates.subject;
      if (updates.category !== undefined) updateData.category = updates.category || '';
      if (updates.description !== undefined) updateData.description = updates.description || '';
      if (updates.tags !== undefined) updateData.tags = updates.tags || [];
      if (updates.difficulty !== undefined) updateData.difficulty = updates.difficulty;
      if (updates.language !== undefined) updateData.language = updates.language || '';
      if (updates.version !== undefined) updateData.version = updates.version || '';
      if (updates.duration !== undefined) updateData.duration = updates.duration;
      if (updates.durationFormatted !== undefined) updateData.durationFormatted = updates.durationFormatted;

      if (updates.videoUrl !== undefined) updateData.videoUrl = updates.videoUrl;
      if (updates.videoFileName !== undefined) updateData.videoFileName = updates.videoFileName;
      if (updates.noteUrl !== undefined) updateData.noteUrl = updates.noteUrl;
      if (updates.noteFileName !== undefined) updateData.noteFileName = updates.noteFileName;
      if (updates.noteSource !== undefined) updateData.noteSource = updates.noteSource;
      if (updates.noteGDrivePreviewUrl !== undefined) updateData.noteGDrivePreviewUrl = updates.noteGDrivePreviewUrl;
      if (updates.noteGDriveDownloadUrl !== undefined) updateData.noteGDriveDownloadUrl = updates.noteGDriveDownloadUrl;

      if (updates.type === 'exam') {
        if (updates.examType !== undefined) updateData.examType = updates.examType;
        if (updates.totalQuestions !== undefined) updateData.totalQuestions = updates.totalQuestions;
        if (updates.questionsToShow !== undefined) updateData.questionsToShow = updates.questionsToShow;
        if (updates.totalMarks !== undefined) updateData.totalMarks = updates.totalMarks;
        if (updates.mcqQuestions !== undefined) updateData.mcqQuestions = updates.mcqQuestions;
        if (updates.writtenQuestions !== undefined) updateData.writtenQuestions = updates.writtenQuestions;
        if (updates.mcqDuration !== undefined) updateData.mcqDuration = updates.mcqDuration;
        if (updates.writtenDuration !== undefined) updateData.writtenDuration = updates.writtenDuration;
        if (updates.mcqQuestionsToShow !== undefined) updateData.mcqQuestionsToShow = updates.mcqQuestionsToShow;
        if (updates.writtenQuestionsToShow !== undefined) updateData.writtenQuestionsToShow = updates.writtenQuestionsToShow;
        if (updates.mcqDirection !== undefined) updateData.mcqDirection = updates.mcqDirection || '';
        if (updates.writtenDirection !== undefined) updateData.writtenDirection = updates.writtenDirection || '';
      }

      const cleanedUpdates = removeUndefinedFields(updateData);

      console.log('Cleaned updates (no undefined):', cleanedUpdates);

      onProgress?.('Saving to database...', 70);

      const contentRef = doc(db, 'content', id);
      await updateDoc(contentRef, cleanedUpdates);
      
      onProgress?.('Content updated successfully!', 100);
      
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

      const content = await this.getContentById(id);
      if (!content) {
        throw new Error('Content not found');
      }

      if (content.videoUrl) {
        await this.deleteFile(content.videoUrl);
      }
      if (content.noteUrl) {
        await this.deleteFile(content.noteUrl);
      }

      if (content.type === 'exam') {
        if (content.mcqQuestions) {
          for (const question of content.mcqQuestions) {
            if (question.questionImage) await this.deleteFile(question.questionImage);
            if (question.solutionImage) await this.deleteFile(question.solutionImage);
          }
        }
        if (content.writtenQuestions) {
          for (const question of content.writtenQuestions) {
            if (question.questionImage) await this.deleteFile(question.questionImage);
            if (question.solutionImage) await this.deleteFile(question.solutionImage);
          }
        }
      }

      await this.deleteContentAnalytics(id);
      await deleteDoc(doc(db, 'content', id));
      console.log('Content deleted:', id);
    } catch (error: any) {
      console.error('Error deleting content:', error);
      throw new Error(`Failed to delete content: ${error.message}`);
    }
  },

  async searchContent(searchTerm: string, filters?: {
    subject?: string;
    category?: string;
    type?: string;
    difficulty?: string;
  }): Promise<Content[]> {
    try {
      const allContent = await this.getAllContent();
      
      return allContent.filter(content => {
        const matchesSearch = !searchTerm || 
                            content.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            content.customId.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            content.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            content.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            content.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            content.tags?.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
        
        const matchesSubject = !filters?.subject || filters.subject === 'all' || content.subject === filters.subject;
        const matchesCategory = !filters?.category || content.category === filters.category;
        const matchesType = !filters?.type || filters.type === 'all' || content.type === filters.type;
        const matchesDifficulty = !filters?.difficulty || content.difficulty === filters.difficulty;
        
        return matchesSearch && matchesSubject && matchesCategory && matchesType && matchesDifficulty;
      });
    } catch (error: any) {
      console.error('Error searching content:', error);
      throw new Error(`Failed to search content: ${error.message}`);
    }
  },

  async getContentBySubject(subject: string): Promise<Content[]> {
    try {
      const allContent = await this.getAllContent();
      return allContent.filter(content => content.subject === subject);
    } catch (error: any) {
      console.error('Error getting content by subject:', error);
      throw new Error(`Failed to get content by subject: ${error.message}`);
    }
  },

  async getContentByCategory(category: string): Promise<Content[]> {
    try {
      const allContent = await this.getAllContent();
      return allContent.filter(content => content.category === category);
    } catch (error: any) {
      console.error('Error getting content by category:', error);
      throw new Error(`Failed to get content by category: ${error.message}`);
    }
  },

  async getContentByType(type: 'lesson' | 'note' | 'trick' | 'exam'): Promise<Content[]> {
    try {
      const allContent = await this.getAllContent();
      return allContent.filter(content => content.type === type);
    } catch (error: any) {
      console.error('Error getting content by type:', error);
      throw new Error(`Failed to get content by type: ${error.message}`);
    }
  },

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

  async recordContentView(view: Omit<ContentView, 'id' | 'viewedAt'>): Promise<void> {
    try {
      const cleanedView = removeUndefinedFields({
        ...view,
        viewedAt: Timestamp.now()
      });

      await addDoc(collection(db, 'contentViews'), cleanedView);

      const contentRef = doc(db, 'content', view.contentId);
      await updateDoc(contentRef, {
        viewCount: increment(1)
      });

      console.log('Content view recorded');
    } catch (error: any) {
      console.error('Error recording content view:', error);
    }
  },

  async recordExamAttempt(attempt: Omit<ExamAttempt, 'id' | 'attemptedAt'>): Promise<string> {
    try {
      const cleanedAttempt = removeUndefinedFields({
        ...attempt,
        attemptedAt: Timestamp.now()
      });

      const docRef = await addDoc(collection(db, 'examAttempts'), cleanedAttempt);

      console.log('Exam attempt recorded:', docRef.id);
      return docRef.id;
    } catch (error: any) {
      console.error('Error recording exam attempt:', error);
      throw new Error(`Failed to record exam attempt: ${error.message}`);
    }
  },

  async getContentViews(contentId: string, startDate?: Date, endDate?: Date, courseId?: string): Promise<ContentView[]> {
    try {
      const viewsCollection = collection(db, 'contentViews');
      let q = query(viewsCollection, where('contentId', '==', contentId), orderBy('viewedAt', 'desc'));

      const viewsSnapshot = await getDocs(q);
      let views = viewsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          viewedAt: toDate(data.viewedAt)
        } as ContentView;
      });

      if (startDate) {
        views = views.filter(v => v.viewedAt >= startDate);
      }
      if (endDate) {
        views = views.filter(v => v.viewedAt <= endDate);
      }
      if (courseId) {
        views = views.filter(v => v.courseId === courseId);
      }

      return views;
    } catch (error: any) {
      console.error('Error getting content views:', error);
      throw new Error(`Failed to get content views: ${error.message}`);
    }
  },

  async getExamAttempts(contentId: string, startDate?: Date, endDate?: Date, courseId?: string): Promise<ExamAttempt[]> {
    try {
      const attemptsCollection = collection(db, 'examAttempts');
      let q = query(attemptsCollection, where('contentId', '==', contentId), orderBy('attemptedAt', 'desc'));

      const attemptsSnapshot = await getDocs(q);
      let attempts = attemptsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          attemptedAt: toDate(data.attemptedAt)
        } as ExamAttempt;
      });

      if (startDate) {
        attempts = attempts.filter(a => a.attemptedAt >= startDate);
      }
      if (endDate) {
        attempts = attempts.filter(a => a.attemptedAt <= endDate);
      }
      if (courseId) {
        attempts = attempts.filter(a => a.courseId === courseId);
      }

      return attempts;
    } catch (error: any) {
      console.error('Error getting exam attempts:', error);
      throw new Error(`Failed to get exam attempts: ${error.message}`);
    }
  },

  async getContentAnalytics(contentId: string, timeRange?: string, courseId?: string): Promise<{
    totalViews: number;
    uniqueViewers: number;
    viewsByDate: Array<{ date: string; count: number }>;
    coursesUsing: Array<{ courseId: string; courseName: string; viewCount: number }>;
    examStats?: {
      totalAttempts: number;
      averageScore: number;
      averagePercentage: number;
      mcqStats?: Array<{
        questionId: string;
        question: string;
        correctRate: number;
        optionStats: Array<{ option: number; percentage: number }>;
      }>;
    };
  }> {
    try {
      const now = new Date();
      let startDate: Date | undefined;

      switch (timeRange) {
        case 'day':
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case 'year':
          startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          break;
      }

      const views = await this.getContentViews(contentId, startDate, undefined, courseId);
      const uniqueViewers = new Set(views.map(v => v.studentId)).size;

      const viewsByDateMap = new Map<string, number>();
      views.forEach(view => {
        const dateKey = view.viewedAt.toISOString().split('T')[0];
        viewsByDateMap.set(dateKey, (viewsByDateMap.get(dateKey) || 0) + 1);
      });
      const viewsByDate = Array.from(viewsByDateMap.entries())
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date));

      const courseViewsMap = new Map<string, { courseName: string; count: number }>();
      views.forEach(view => {
        if (view.courseId && view.courseName) {
          const existing = courseViewsMap.get(view.courseId);
          if (existing) {
            existing.count++;
          } else {
            courseViewsMap.set(view.courseId, { courseName: view.courseName, count: 1 });
          }
        }
      });
      const coursesUsing = Array.from(courseViewsMap.entries()).map(([courseId, data]) => ({
        courseId,
        courseName: data.courseName,
        viewCount: data.count
      }));

      const content = await this.getContentById(contentId);
      let examStats;

      if (content?.type === 'exam') {
        const attempts = await this.getExamAttempts(contentId, startDate, undefined, courseId);
        
        const totalAttempts = attempts.length;
        const averageScore = totalAttempts > 0 
          ? attempts.reduce((sum, a) => sum + a.score, 0) / totalAttempts 
          : 0;
        const averagePercentage = totalAttempts > 0 
          ? attempts.reduce((sum, a) => sum + a.percentage, 0) / totalAttempts 
          : 0;

        let mcqStats;
        if (content.mcqQuestions && content.mcqQuestions.length > 0) {
          mcqStats = content.mcqQuestions.map(question => {
            const questionAttempts = attempts.filter(a => 
              a.mcqAnswers?.some(ans => ans.questionId === question.id)
            );
            
            const correctAnswers = questionAttempts.filter(a => 
              a.mcqAnswers?.find(ans => ans.questionId === question.id)?.isCorrect
            ).length;

            const correctRate = questionAttempts.length > 0 
              ? (correctAnswers / questionAttempts.length) * 100 
              : 0;

            const optionCounts = new Array(question.options.length).fill(0);
            questionAttempts.forEach(attempt => {
              const answer = attempt.mcqAnswers?.find(ans => ans.questionId === question.id);
              if (answer) {
                answer.selectedOptions.forEach(optIndex => {
                  if (optIndex < optionCounts.length) {
                    optionCounts[optIndex]++;
                  }
                });
              }
            });

            const optionStats = optionCounts.map((count, index) => ({
              option: index,
              percentage: questionAttempts.length > 0 ? (count / questionAttempts.length) * 100 : 0
            }));

            return {
              questionId: question.id,
              question: question.question,
              correctRate,
              optionStats
            };
          });
        }

        examStats = {
          totalAttempts,
          averageScore,
          averagePercentage,
          mcqStats
        };
      }

      return {
        totalViews: views.length,
        uniqueViewers,
        viewsByDate,
        coursesUsing,
        examStats
      };
    } catch (error: any) {
      console.error('Error getting content analytics:', error);
      throw new Error(`Failed to get content analytics: ${error.message}`);
    }
  },

  async deleteContentAnalytics(contentId: string): Promise<void> {
    try {
      const viewsQuery = query(collection(db, 'contentViews'), where('contentId', '==', contentId));
      const viewsSnapshot = await getDocs(viewsQuery);
      const viewDeletePromises = viewsSnapshot.docs.map(doc => deleteDoc(doc.ref));

      const attemptsQuery = query(collection(db, 'examAttempts'), where('contentId', '==', contentId));
      const attemptsSnapshot = await getDocs(attemptsQuery);
      const attemptDeletePromises = attemptsSnapshot.docs.map(doc => deleteDoc(doc.ref));

      await Promise.all([...viewDeletePromises, ...attemptDeletePromises]);
      console.log('Content analytics deleted');
    } catch (error: any) {
      console.error('Error deleting content analytics:', error);
    }
  },

  async getContentStats(userId?: string): Promise<{
    total: number;
    byType: Record<string, number>;
    bySubject: Record<string, number>;
    byCategory: Record<string, number>;
    byDifficulty: Record<string, number>;
    totalDuration: number;
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
