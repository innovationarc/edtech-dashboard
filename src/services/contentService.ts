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
  Timestamp,
  increment 
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
  duration: number; // in minutes (total duration)
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
  
  // NEW: Separate duration and questions to show for MCQ and Written
  mcqDuration?: number; // Duration for MCQ part in minutes
  writtenDuration?: number; // Duration for written part in minutes
  mcqQuestionsToShow?: number; // Number of MCQ questions to show
  writtenQuestionsToShow?: number; // Number of written questions to show
  
  // NEW: Exam directions
  mcqDirection?: string; // Direction text for MCQ section
  writtenDirection?: string; // Direction text for written section
  
  // Analytics fields
  viewCount?: number; // Total views
  uniqueViewers?: number; // Unique student viewers
  coursesUsing?: string[]; // Course IDs using this content
  
  // Metadata
  createdBy: string;
  createdAt: Date;
  updatedAt?: Date;
}

// Analytics interfaces
export interface ContentView {
  id: string;
  contentId: string;
  studentId: string;
  studentName: string;
  courseId?: string;
  courseName?: string;
  viewedAt: Date;
  duration?: number; // View duration in seconds
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
  timeTaken: number; // in minutes
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

  // Delete file from Supabase
  async deleteFile(fileUrl: string): Promise<void> {
    try {
      if (!fileUrl) return;
      
      // Extract file path from URL
      const urlParts = fileUrl.split('/');
      const fileName = urlParts[urlParts.length - 1];
      
      await uploadService.deleteFromSupabase(fileName);
      console.log('File deleted successfully:', fileName);
    } catch (error: any) {
      console.error('Error deleting file:', error);
      // Don't throw - file deletion failure shouldn't stop content deletion
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
        viewCount: 0,
        uniqueViewers: 0,
        coursesUsing: [],
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

      // Delete files from Supabase
      if (content.videoUrl) {
        await this.deleteFile(content.videoUrl);
      }
      if (content.noteUrl) {
        await this.deleteFile(content.noteUrl);
      }

      // Delete question images if exam type
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

      // Delete analytics data
      await this.deleteContentAnalytics(id);

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

  // Analytics Operations
  async recordContentView(view: Omit<ContentView, 'id' | 'viewedAt'>): Promise<void> {
    try {
      // Record the view
      await addDoc(collection(db, 'contentViews'), {
        ...view,
        viewedAt: Timestamp.now()
      });

      // Update content view count
      const contentRef = doc(db, 'content', view.contentId);
      await updateDoc(contentRef, {
        viewCount: increment(1)
      });

      console.log('Content view recorded');
    } catch (error: any) {
      console.error('Error recording content view:', error);
      // Don't throw - view tracking failure shouldn't stop content access
    }
  },

  async recordExamAttempt(attempt: Omit<ExamAttempt, 'id' | 'attemptedAt'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, 'examAttempts'), {
        ...attempt,
        attemptedAt: Timestamp.now()
      });

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
          viewedAt: data.viewedAt?.toDate() || new Date()
        } as ContentView;
      });

      // Filter by date range
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
          attemptedAt: data.attemptedAt?.toDate() || new Date()
        } as ExamAttempt;
      });

      // Filter by date range
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

      // Determine date range
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

      // Get views
      const views = await this.getContentViews(contentId, startDate, undefined, courseId);
      const uniqueViewers = new Set(views.map(v => v.studentId)).size;

      // Group views by date
      const viewsByDateMap = new Map<string, number>();
      views.forEach(view => {
        const dateKey = view.viewedAt.toISOString().split('T')[0];
        viewsByDateMap.set(dateKey, (viewsByDateMap.get(dateKey) || 0) + 1);
      });
      const viewsByDate = Array.from(viewsByDateMap.entries())
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // Group views by course
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

      // Get content to check if it's an exam
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

        // MCQ statistics
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

            // Calculate option statistics
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
      // Delete all views
      const viewsQuery = query(collection(db, 'contentViews'), where('contentId', '==', contentId));
      const viewsSnapshot = await getDocs(viewsQuery);
      const viewDeletePromises = viewsSnapshot.docs.map(doc => deleteDoc(doc.ref));

      // Delete all exam attempts
      const attemptsQuery = query(collection(db, 'examAttempts'), where('contentId', '==', contentId));
      const attemptsSnapshot = await getDocs(attemptsQuery);
      const attemptDeletePromises = attemptsSnapshot.docs.map(doc => deleteDoc(doc.ref));

      await Promise.all([...viewDeletePromises, ...attemptDeletePromises]);
      console.log('Content analytics deleted');
    } catch (error: any) {
      console.error('Error deleting content analytics:', error);
      // Don't throw - analytics deletion failure shouldn't stop content deletion
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
