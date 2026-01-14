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
  Timestamp 
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { gamificationService } from './gamificationService';

interface MCQChoice {
  id: number;
  text: string;
}

export interface MCQQuestion {
  id: string;
  question: string;
  choices: MCQChoice[];
  correctAnswer: number;
  subject: string;
  difficulty: 'easy' | 'medium' | 'hard';
  explanation: string;
  points: number;
  course: string;
  tags: string[];
  createdBy: string;
  createdAt: Date;
  updatedAt?: Date;
}

interface MCQAttempt {
  id: string;
  studentId: string;
  studentName: string;
  questionId: string;
  selectedAnswer: number;
  isCorrect: boolean;
  timeSpent: number; // in seconds
  attemptedAt: Date;
}

export interface QuizSession {
  id: string;
  studentId: string;
  studentName: string;
  subject: string;
  questions: string[]; // question IDs
  answers: (number | null)[];
  score: number;
  totalQuestions: number;
  accuracy: number;
  timeSpent: number; // in minutes
  completedAt: Date;
}

export const mcqService = {
  // MCQ Question CRUD operations
  async createMCQQuestion(question: Omit<MCQQuestion, 'id' | 'createdAt'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, 'mcqQuestions'), {
        ...question,
        createdAt: Timestamp.now()
      });
      return docRef.id;
    } catch (error: any) {
      throw new Error(error.message);
    }
  },

  async getAllMCQQuestions(): Promise<MCQQuestion[]> {
    try {
      const mcqCollection = collection(db, 'mcqQuestions');
      const mcqSnapshot = await getDocs(query(mcqCollection, orderBy('createdAt', 'desc')));
      
      return mcqSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt.toDate(),
        updatedAt: doc.data().updatedAt?.toDate()
      })) as MCQQuestion[];
    } catch (error: any) {
      throw new Error(error.message);
    }
  },

  async getMCQQuestionsBySubject(subject: string): Promise<MCQQuestion[]> {
    try {
      const mcqCollection = collection(db, 'mcqQuestions');
      const q = query(
        mcqCollection, 
        where('subject', '==', subject),
        orderBy('createdAt', 'desc')
      );
      const mcqSnapshot = await getDocs(q);
      
      return mcqSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt.toDate(),
        updatedAt: doc.data().updatedAt?.toDate()
      })) as MCQQuestion[];
    } catch (error: any) {
      throw new Error(error.message);
    }
  },

  async getMCQQuestionsByDifficulty(difficulty: 'easy' | 'medium' | 'hard'): Promise<MCQQuestion[]> {
    try {
      const mcqCollection = collection(db, 'mcqQuestions');
      const q = query(
        mcqCollection, 
        where('difficulty', '==', difficulty),
        orderBy('createdAt', 'desc')
      );
      const mcqSnapshot = await getDocs(q);
      
      return mcqSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt.toDate(),
        updatedAt: doc.data().updatedAt?.toDate()
      })) as MCQQuestion[];
    } catch (error: any) {
      throw new Error(error.message);
    }
  },

  async updateMCQQuestion(id: string, updates: Partial<MCQQuestion>): Promise<void> {
    try {
      const questionRef = doc(db, 'mcqQuestions', id);
      await updateDoc(questionRef, {
        ...updates,
        updatedAt: Timestamp.now()
      });
    } catch (error: any) {
      throw new Error(error.message);
    }
  },

  async deleteMCQQuestion(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'mcqQuestions', id));
    } catch (error: any) {
      throw new Error(error.message);
    }
  },

  // Quiz Session operations
  async createQuizSession(session: Omit<QuizSession, 'id' | 'completedAt'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, 'quizSessions'), {
        ...session,
        completedAt: Timestamp.now()
      });
      
      // Record gamification activity
      try {
        await gamificationService.recordActivity(session.studentId, 'mcq_completed', {
          isCorrect: session.accuracy > 0,
          isPerfectScore: session.accuracy === 100,
          score: session.score,
          accuracy: session.accuracy
        });
      } catch (gamificationError) {
        console.warn('Failed to record gamification activity:', gamificationError);
      }
      
      return docRef.id;
    } catch (error: any) {
      throw new Error(error.message);
    }
  },

  async getAllQuizSessions(): Promise<QuizSession[]> {
    try {
      const sessionsCollection = collection(db, 'quizSessions');
      const sessionsSnapshot = await getDocs(query(sessionsCollection, orderBy('completedAt', 'desc')));
      
      return sessionsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        completedAt: doc.data().completedAt.toDate()
      })) as QuizSession[];
    } catch (error: any) {
      throw new Error(error.message);
    }
  },

  async getQuizSessionsByStudent(studentId: string): Promise<QuizSession[]> {
    try {
      const sessionsCollection = collection(db, 'quizSessions');
      const q = query(
        sessionsCollection, 
        where('studentId', '==', studentId),
        orderBy('completedAt', 'desc')
      );
      const sessionsSnapshot = await getDocs(q);
      
      return sessionsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        completedAt: doc.data().completedAt.toDate()
      })) as QuizSession[];
    } catch (error: any) {
      throw new Error(error.message);
    }
  },

  async getQuizSessionsBySubject(subject: string): Promise<QuizSession[]> {
    try {
      const sessionsCollection = collection(db, 'quizSessions');
      const q = query(
        sessionsCollection, 
        where('subject', '==', subject),
        orderBy('completedAt', 'desc')
      );
      const sessionsSnapshot = await getDocs(q);
      
      return sessionsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        completedAt: doc.data().completedAt.toDate()
      })) as QuizSession[];
    } catch (error: any) {
      throw new Error(error.message);
    }
  },

  // MCQ Attempt operations
  async recordMCQAttempt(attempt: Omit<MCQAttempt, 'id' | 'attemptedAt'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, 'mcqAttempts'), {
        ...attempt,
        attemptedAt: Timestamp.now()
      });
      return docRef.id;
    } catch (error: any) {
      throw new Error(error.message);
    }
  },

  async getMCQAttemptsByStudent(studentId: string): Promise<MCQAttempt[]> {
    try {
      const attemptsCollection = collection(db, 'mcqAttempts');
      const q = query(
        attemptsCollection, 
        where('studentId', '==', studentId),
        orderBy('attemptedAt', 'desc')
      );
      const attemptsSnapshot = await getDocs(q);
      
      return attemptsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        attemptedAt: doc.data().attemptedAt.toDate()
      })) as MCQAttempt[];
    } catch (error: any) {
      throw new Error(error.message);
    }
  },

  // Statistics and Analytics
  async getStudentMCQStats(studentId: string): Promise<{
    totalAttempts: number;
    correctAnswers: number;
    accuracy: number;
    averageTimePerQuestion: number;
    subjectBreakdown: Record<string, { attempts: number; correct: number; accuracy: number }>;
  }> {
    try {
      const attempts = await this.getMCQAttemptsByStudent(studentId);
      
      const totalAttempts = attempts.length;
      const correctAnswers = attempts.filter(a => a.isCorrect).length;
      const accuracy = totalAttempts > 0 ? (correctAnswers / totalAttempts) * 100 : 0;
      const averageTimePerQuestion = totalAttempts > 0 
        ? attempts.reduce((sum, a) => sum + a.timeSpent, 0) / totalAttempts 
        : 0;

      // Get subject breakdown
      const subjectBreakdown: Record<string, { attempts: number; correct: number; accuracy: number }> = {};
      
      // This would require joining with questions to get subjects
      // For now, we'll return basic stats
      
      return {
        totalAttempts,
        correctAnswers,
        accuracy,
        averageTimePerQuestion,
        subjectBreakdown
      };
    } catch (error: any) {
      throw new Error(error.message);
    }
  },

  async getLeaderboard(limit: number = 50): Promise<QuizSession[]> {
    try {
      const sessions = await this.getAllQuizSessions();
      
      // Sort by score (descending), then by accuracy (descending), then by time (ascending)
      return sessions
        .sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy;
          return a.timeSpent - b.timeSpent;
        })
        .slice(0, limit);
    } catch (error: any) {
      throw new Error(error.message);
    }
  }
};