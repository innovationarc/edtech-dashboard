// src/services/mcqService.ts
import { 
  collection, 
  doc, 
  getDocs, 
  getDoc,
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
  title: string;
  description: string;
  question: string;
  choices: MCQChoice[];
  correctAnswer: number;
  subject: string;
  difficulty: 'easy' | 'medium' | 'hard';
  explanation: string;
  points: number;
  course: string;
  tags: string[];
  type: 'mcq';
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
      // Validate required fields
      if (!question.question?.trim()) {
        throw new Error('Question text is required');
      }

      if (!question.title?.trim()) {
        throw new Error('Title is required');
      }

      if (!question.subject) {
        throw new Error('Subject/Category is required');
      }

      if (!question.choices || question.choices.length !== 4) {
        throw new Error('Exactly 4 choices are required');
      }

      // Validate all choices have text
      const emptyChoices = question.choices.filter(choice => !choice.text?.trim());
      if (emptyChoices.length > 0) {
        throw new Error('All answer choices must be filled');
      }

      if (!question.correctAnswer || question.correctAnswer < 1 || question.correctAnswer > 4) {
        throw new Error('Valid correct answer must be selected (1-4)');
      }

      console.log('Creating MCQ question:', question.title);

      const docRef = await addDoc(collection(db, 'mcqQuestions'), {
        ...question,
        type: 'mcq', // Ensure type is set
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });

      console.log('MCQ question created with ID:', docRef.id);
      return docRef.id;
    } catch (error: any) {
      console.error('Error creating MCQ question:', error);
      throw new Error(`Failed to create MCQ question: ${error.message}`);
    }
  },

  async getAllMCQQuestions(): Promise<MCQQuestion[]> {
    try {
      const mcqCollection = collection(db, 'mcqQuestions');
      const mcqSnapshot = await getDocs(query(mcqCollection, orderBy('createdAt', 'desc')));
      
      const questions = mcqSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          type: 'mcq', // Ensure type is set
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate()
        } as MCQQuestion;
      });

      console.log('Fetched MCQ questions:', questions.length);
      return questions;
    } catch (error: any) {
      console.error('Error getting MCQ questions:', error);
      throw new Error(`Failed to get MCQ questions: ${error.message}`);
    }
  },

  async getMCQQuestionById(id: string): Promise<MCQQuestion | null> {
    try {
      if (!id) {
        throw new Error('MCQ question ID is required');
      }

      const questionDoc = await getDoc(doc(db, 'mcqQuestions', id));
      if (!questionDoc.exists()) {
        return null;
      }

      const data = questionDoc.data();
      return {
        id: questionDoc.id,
        ...data,
        type: 'mcq',
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate()
      } as MCQQuestion;
    } catch (error: any) {
      console.error('Error getting MCQ question by ID:', error);
      throw new Error(`Failed to get MCQ question: ${error.message}`);
    }
  },

  async getMCQQuestionsBySubject(subject: string): Promise<MCQQuestion[]> {
    try {
      if (!subject) {
        throw new Error('Subject is required');
      }

      const mcqCollection = collection(db, 'mcqQuestions');
      const q = query(
        mcqCollection, 
        where('subject', '==', subject),
        orderBy('createdAt', 'desc')
      );
      const mcqSnapshot = await getDocs(q);
      
      const questions = mcqSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          type: 'mcq',
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate()
        } as MCQQuestion;
      });

      console.log(`Fetched MCQ questions for subject ${subject}:`, questions.length);
      return questions;
    } catch (error: any) {
      console.error('Error getting MCQ questions by subject:', error);
      throw new Error(`Failed to get MCQ questions by subject: ${error.message}`);
    }
  },

  async getMCQQuestionsByDifficulty(difficulty: 'easy' | 'medium' | 'hard'): Promise<MCQQuestion[]> {
    try {
      if (!difficulty) {
        throw new Error('Difficulty is required');
      }

      const mcqCollection = collection(db, 'mcqQuestions');
      const q = query(
        mcqCollection, 
        where('difficulty', '==', difficulty),
        orderBy('createdAt', 'desc')
      );
      const mcqSnapshot = await getDocs(q);
      
      const questions = mcqSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          type: 'mcq',
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate()
        } as MCQQuestion;
      });

      console.log(`Fetched MCQ questions for difficulty ${difficulty}:`, questions.length);
      return questions;
    } catch (error: any) {
      console.error('Error getting MCQ questions by difficulty:', error);
      throw new Error(`Failed to get MCQ questions by difficulty: ${error.message}`);
    }
  },

  async getMCQQuestionsByCourse(course: string): Promise<MCQQuestion[]> {
    try {
      if (!course) {
        throw new Error('Course is required');
      }

      const mcqCollection = collection(db, 'mcqQuestions');
      const q = query(
        mcqCollection, 
        where('course', '==', course),
        orderBy('createdAt', 'desc')
      );
      const mcqSnapshot = await getDocs(q);
      
      const questions = mcqSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          type: 'mcq',
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate()
        } as MCQQuestion;
      });

      console.log(`Fetched MCQ questions for course ${course}:`, questions.length);
      return questions;
    } catch (error: any) {
      console.error('Error getting MCQ questions by course:', error);
      throw new Error(`Failed to get MCQ questions by course: ${error.message}`);
    }
  },

  async getMCQQuestionsByCreator(creatorId: string): Promise<MCQQuestion[]> {
    try {
      if (!creatorId) {
        throw new Error('Creator ID is required');
      }

      const mcqCollection = collection(db, 'mcqQuestions');
      const q = query(
        mcqCollection, 
        where('createdBy', '==', creatorId),
        orderBy('createdAt', 'desc')
      );
      const mcqSnapshot = await getDocs(q);
      
      const questions = mcqSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          type: 'mcq',
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate()
        } as MCQQuestion;
      });

      console.log(`Fetched MCQ questions for creator ${creatorId}:`, questions.length);
      return questions;
    } catch (error: any) {
      console.error('Error getting MCQ questions by creator:', error);
      throw new Error(`Failed to get MCQ questions by creator: ${error.message}`);
    }
  },

  async updateMCQQuestion(id: string, updates: Partial<MCQQuestion>): Promise<void> {
    try {
      if (!id) {
        throw new Error('MCQ question ID is required');
      }

      const questionRef = doc(db, 'mcqQuestions', id);
      await updateDoc(questionRef, {
        ...updates,
        updatedAt: Timestamp.now()
      });

      console.log('MCQ question updated:', id);
    } catch (error: any) {
      console.error('Error updating MCQ question:', error);
      throw new Error(`Failed to update MCQ question: ${error.message}`);
    }
  },

  async deleteMCQQuestion(id: string): Promise<void> {
    try {
      if (!id) {
        throw new Error('MCQ question ID is required');
      }

      await deleteDoc(doc(db, 'mcqQuestions', id));
      console.log('MCQ question deleted:', id);
    } catch (error: any) {
      console.error('Error deleting MCQ question:', error);
      throw new Error(`Failed to delete MCQ question: ${error.message}`);
    }
  },

  // Search MCQ questions
  async searchMCQQuestions(searchTerm: string, subject?: string): Promise<MCQQuestion[]> {
    try {
      const allQuestions = await this.getAllMCQQuestions();
      
      return allQuestions.filter(question => {
        const matchesSearch = 
          question.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          question.question?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          question.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          question.tags?.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
        
        const matchesSubject = !subject || subject === 'all' || question.subject === subject;
        
        return matchesSearch && matchesSubject;
      });
    } catch (error: any) {
      console.error('Error searching MCQ questions:', error);
      throw new Error(`Failed to search MCQ questions: ${error.message}`);
    }
  },

  // Quiz Session operations
  async createQuizSession(session: Omit<QuizSession, 'id' | 'completedAt'>): Promise<string> {
    try {
      if (!session.studentId) {
        throw new Error('Student ID is required');
      }

      if (!session.questions || session.questions.length === 0) {
        throw new Error('Quiz must have at least one question');
      }

      console.log('Creating quiz session for student:', session.studentId);

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
        console.log('Gamification activity recorded for quiz session');
      } catch (gamificationError) {
        console.warn('Failed to record gamification activity:', gamificationError);
        // Don't throw - gamification failure shouldn't stop quiz creation
      }
      
      console.log('Quiz session created with ID:', docRef.id);
      return docRef.id;
    } catch (error: any) {
      console.error('Error creating quiz session:', error);
      throw new Error(`Failed to create quiz session: ${error.message}`);
    }
  },

  async getAllQuizSessions(): Promise<QuizSession[]> {
    try {
      const sessionsCollection = collection(db, 'quizSessions');
      const sessionsSnapshot = await getDocs(query(sessionsCollection, orderBy('completedAt', 'desc')));
      
      const sessions = sessionsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          completedAt: data.completedAt?.toDate() || new Date()
        } as QuizSession;
      });

      console.log('Fetched quiz sessions:', sessions.length);
      return sessions;
    } catch (error: any) {
      console.error('Error getting quiz sessions:', error);
      throw new Error(`Failed to get quiz sessions: ${error.message}`);
    }
  },

  async getQuizSessionsByStudent(studentId: string): Promise<QuizSession[]> {
    try {
      if (!studentId) {
        throw new Error('Student ID is required');
      }

      const sessionsCollection = collection(db, 'quizSessions');
      const q = query(
        sessionsCollection, 
        where('studentId', '==', studentId),
        orderBy('completedAt', 'desc')
      );
      const sessionsSnapshot = await getDocs(q);
      
      const sessions = sessionsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          completedAt: data.completedAt?.toDate() || new Date()
        } as QuizSession;
      });

      console.log(`Fetched quiz sessions for student ${studentId}:`, sessions.length);
      return sessions;
    } catch (error: any) {
      console.error('Error getting quiz sessions by student:', error);
      throw new Error(`Failed to get quiz sessions by student: ${error.message}`);
    }
  },

  async getQuizSessionsBySubject(subject: string): Promise<QuizSession[]> {
    try {
      if (!subject) {
        throw new Error('Subject is required');
      }

      const sessionsCollection = collection(db, 'quizSessions');
      const q = query(
        sessionsCollection, 
        where('subject', '==', subject),
        orderBy('completedAt', 'desc')
      );
      const sessionsSnapshot = await getDocs(q);
      
      const sessions = sessionsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          completedAt: data.completedAt?.toDate() || new Date()
        } as QuizSession;
      });

      console.log(`Fetched quiz sessions for subject ${subject}:`, sessions.length);
      return sessions;
    } catch (error: any) {
      console.error('Error getting quiz sessions by subject:', error);
      throw new Error(`Failed to get quiz sessions by subject: ${error.message}`);
    }
  },

  // MCQ Attempt operations
  async recordMCQAttempt(attempt: Omit<MCQAttempt, 'id' | 'attemptedAt'>): Promise<string> {
    try {
      if (!attempt.studentId) {
        throw new Error('Student ID is required');
      }

      if (!attempt.questionId) {
        throw new Error('Question ID is required');
      }

      console.log('Recording MCQ attempt for student:', attempt.studentId);

      const docRef = await addDoc(collection(db, 'mcqAttempts'), {
        ...attempt,
        attemptedAt: Timestamp.now()
      });

      console.log('MCQ attempt recorded with ID:', docRef.id);
      return docRef.id;
    } catch (error: any) {
      console.error('Error recording MCQ attempt:', error);
      throw new Error(`Failed to record MCQ attempt: ${error.message}`);
    }
  },

  async getMCQAttemptsByStudent(studentId: string): Promise<MCQAttempt[]> {
    try {
      if (!studentId) {
        throw new Error('Student ID is required');
      }

      const attemptsCollection = collection(db, 'mcqAttempts');
      const q = query(
        attemptsCollection, 
        where('studentId', '==', studentId),
        orderBy('attemptedAt', 'desc')
      );
      const attemptsSnapshot = await getDocs(q);
      
      const attempts = attemptsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          attemptedAt: data.attemptedAt?.toDate() || new Date()
        } as MCQAttempt;
      });

      console.log(`Fetched MCQ attempts for student ${studentId}:`, attempts.length);
      return attempts;
    } catch (error: any) {
      console.error('Error getting MCQ attempts by student:', error);
      throw new Error(`Failed to get MCQ attempts by student: ${error.message}`);
    }
  },

  async getMCQAttemptsByQuestion(questionId: string): Promise<MCQAttempt[]> {
    try {
      if (!questionId) {
        throw new Error('Question ID is required');
      }

      const attemptsCollection = collection(db, 'mcqAttempts');
      const q = query(
        attemptsCollection, 
        where('questionId', '==', questionId),
        orderBy('attemptedAt', 'desc')
      );
      const attemptsSnapshot = await getDocs(q);
      
      const attempts = attemptsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          attemptedAt: data.attemptedAt?.toDate() || new Date()
        } as MCQAttempt;
      });

      console.log(`Fetched MCQ attempts for question ${questionId}:`, attempts.length);
      return attempts;
    } catch (error: any) {
      console.error('Error getting MCQ attempts by question:', error);
      throw new Error(`Failed to get MCQ attempts by question: ${error.message}`);
    }
  },

  // Statistics and Analytics
  async getStudentMCQStats(studentId: string): Promise<{
    totalAttempts: number;
    correctAnswers: number;
    accuracy: number;
    averageTimePerQuestion: number;
    subjectBreakdown: Record<string, { attempts: number; correct: number; accuracy: number }>;
    recentQuizzes: QuizSession[];
  }> {
    try {
      if (!studentId) {
        throw new Error('Student ID is required');
      }

      const [attempts, quizSessions] = await Promise.all([
        this.getMCQAttemptsByStudent(studentId),
        this.getQuizSessionsByStudent(studentId)
      ]);
      
      const totalAttempts = attempts.length;
      const correctAnswers = attempts.filter(a => a.isCorrect).length;
      const accuracy = totalAttempts > 0 ? (correctAnswers / totalAttempts) * 100 : 0;
      const averageTimePerQuestion = totalAttempts > 0 
        ? attempts.reduce((sum, a) => sum + a.timeSpent, 0) / totalAttempts 
        : 0;

      // Get subject breakdown from quiz sessions
      const subjectBreakdown: Record<string, { attempts: number; correct: number; accuracy: number }> = {};
      
      quizSessions.forEach(session => {
        if (!subjectBreakdown[session.subject]) {
          subjectBreakdown[session.subject] = {
            attempts: 0,
            correct: 0,
            accuracy: 0
          };
        }
        subjectBreakdown[session.subject].attempts += session.totalQuestions;
        subjectBreakdown[session.subject].correct += session.score;
      });

      // Calculate accuracy for each subject
      Object.keys(subjectBreakdown).forEach(subject => {
        const data = subjectBreakdown[subject];
        data.accuracy = data.attempts > 0 ? (data.correct / data.attempts) * 100 : 0;
      });
      
      return {
        totalAttempts,
        correctAnswers,
        accuracy,
        averageTimePerQuestion,
        subjectBreakdown,
        recentQuizzes: quizSessions.slice(0, 10) // Last 10 quizzes
      };
    } catch (error: any) {
      console.error('Error getting student MCQ stats:', error);
      throw new Error(`Failed to get student MCQ stats: ${error.message}`);
    }
  },

  async getQuestionStats(questionId: string): Promise<{
    totalAttempts: number;
    correctAttempts: number;
    accuracy: number;
    averageTimeSpent: number;
  }> {
    try {
      if (!questionId) {
        throw new Error('Question ID is required');
      }

      const attempts = await this.getMCQAttemptsByQuestion(questionId);
      
      const totalAttempts = attempts.length;
      const correctAttempts = attempts.filter(a => a.isCorrect).length;
      const accuracy = totalAttempts > 0 ? (correctAttempts / totalAttempts) * 100 : 0;
      const averageTimeSpent = totalAttempts > 0
        ? attempts.reduce((sum, a) => sum + a.timeSpent, 0) / totalAttempts
        : 0;

      return {
        totalAttempts,
        correctAttempts,
        accuracy,
        averageTimeSpent
      };
    } catch (error: any) {
      console.error('Error getting question stats:', error);
      throw new Error(`Failed to get question stats: ${error.message}`);
    }
  },

  async getLeaderboard(limit: number = 50): Promise<QuizSession[]> {
    try {
      const sessions = await this.getAllQuizSessions();
      
      // Sort by score (descending), then by accuracy (descending), then by time (ascending)
      const sortedSessions = sessions
        .sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy;
          return a.timeSpent - b.timeSpent;
        })
        .slice(0, limit);

      console.log('Generated leaderboard with', sortedSessions.length, 'entries');
      return sortedSessions;
    } catch (error: any) {
      console.error('Error getting leaderboard:', error);
      throw new Error(`Failed to get leaderboard: ${error.message}`);
    }
  },

  // Get MCQ statistics for all questions
  async getMCQStats(creatorId?: string): Promise<{
    total: number;
    bySubject: Record<string, number>;
    byDifficulty: Record<string, number>;
    recentQuestions: MCQQuestion[];
  }> {
    try {
      let questions: MCQQuestion[];
      if (creatorId) {
        questions = await this.getMCQQuestionsByCreator(creatorId);
      } else {
        questions = await this.getAllMCQQuestions();
      }

      const bySubject: Record<string, number> = {};
      const byDifficulty: Record<string, number> = {};

      questions.forEach(question => {
        bySubject[question.subject] = (bySubject[question.subject] || 0) + 1;
        byDifficulty[question.difficulty] = (byDifficulty[question.difficulty] || 0) + 1;
      });

      return {
        total: questions.length,
        bySubject,
        byDifficulty,
        recentQuestions: questions.slice(0, 5) // Last 5 questions
      };
    } catch (error: any) {
      console.error('Error getting MCQ stats:', error);
      throw new Error(`Failed to get MCQ stats: ${error.message}`);
    }
  }
};
