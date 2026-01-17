// src/services/qaService.ts - Enhanced with Ratings, Save Features, and Voice Support
import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp,
  getDoc,
  onSnapshot,
  deleteDoc,
  setDoc,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { uploadService } from './uploadService';

export interface Question {
  id: string;
  studentId: string;
  studentName: string;
  subject: string;
  questionText: string;
  imageUrl?: string;
  audioUrl?: string;
  fileUrl?: string;
  fileName?: string;
  status: 'pending' | 'answered' | 'closed';
  answeredBy?: 'teacher' | 'ai';
  createdAt: Date;
  updatedAt?: Date;
  viewedByStudent?: boolean;
  satisfactionStatus?: 'satisfied' | 'confused' | 'none';
  parentQuestionId?: string;
  isFollowUp?: boolean;
  courseId?: string;
  closedReason?: string;
  closedBy?: string;
  closedAt?: Date;
}

export interface Answer {
  id: string;
  questionId: string;
  teacherId?: string;
  teacherName?: string;
  answerText: string;
  imageUrl?: string;
  audioUrl?: string;
  fileUrl?: string;
  fileName?: string;
  type: 'teacher' | 'ai';
  createdAt: Date;
}

export interface Notification {
  id: string;
  userId: string;
  type: 'question_answered';
  questionId: string;
  message: string;
  read: boolean;
  createdAt: Date;
}

export interface Knowledge {
  id: string;
  teacherId: string;
  teacherName: string;
  subject: string;
  title: string;
  content: string;
  imageUrls?: string[];
  fileUrls?: string[];
  fileNames?: string[];
  type: 'concept' | 'sample_qa' | 'procedure';
  createdAt: Date;
  updatedAt?: Date;
}

export interface AnswerRating {
  questionId: string;
  answerId: string;
  answerType: 'teacher' | 'ai';
  rating: number;
  createdAt: Date;
}

export const qaService = {
  async uploadToSupabase(file: File, folder: string): Promise<{ url: string }> {
    return uploadService.uploadToSupabase(file, folder);
  },

  async askQuestion(
    question: Omit<Question, 'id' | 'status' | 'createdAt' | 'viewedByStudent' | 'satisfactionStatus'>
  ): Promise<string> {
    try {
      const cleanQuestion: any = {
        ...question,
        status: 'pending',
        viewedByStudent: true,
        satisfactionStatus: 'none',
        createdAt: Timestamp.now(),
      };

      Object.keys(cleanQuestion).forEach(key => {
        if (cleanQuestion[key] === undefined) {
          delete cleanQuestion[key];
        }
      });

      const docRef = await addDoc(collection(db, 'questions'), cleanQuestion);
      return docRef.id;
    } catch (error: any) {
      throw new Error(`Failed to ask question: ${error.message}`);
    }
  },

  async updateQuestion(id: string, updates: Partial<Question>): Promise<void> {
    try {
      const updateData: any = {
        ...updates,
        updatedAt: Timestamp.now(),
      };

      Object.keys(updateData).forEach(key => {
        if (updateData[key] === undefined) {
          delete updateData[key];
        }
      });

      await updateDoc(doc(db, 'questions', id), updateData);
    } catch (error: any) {
      throw new Error(`Failed to update question: ${error.message}`);
    }
  },

  async getQuestions(
    subject?: string,
    status?: 'pending' | 'answered' | 'closed' | 'all',
    studentId?: string
  ): Promise<Question[]> {
    try {
      let q = query(collection(db, 'questions'), orderBy('createdAt', 'desc'));

      if (subject && subject !== 'all') {
        q = query(q, where('subject', '==', subject));
      }
      if (status && status !== 'all') {
        q = query(q, where('status', '==', status));
      }
      if (studentId) {
        q = query(q, where('studentId', '==', studentId));
      }

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
        closedAt: doc.data().closedAt?.toDate(),
      })) as Question[];
    } catch (error: any) {
      throw new Error(`Failed to get questions: ${error.message}`);
    }
  },

  async findSimilarQuestions(questionText: string, subject: string, currentQuestionId?: string): Promise<Question[]> {
    try {
      const q = query(
        collection(db, 'questions'),
        where('subject', '==', subject),
        where('status', '==', 'answered'),
        orderBy('createdAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const allQuestions = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
        closedAt: doc.data().closedAt?.toDate(),
      })) as Question[];

      // Filter out current question if exists
      const questionsToSearch = currentQuestionId 
        ? allQuestions.filter(q => q.id !== currentQuestionId)
        : allQuestions;

      // Simple keyword-based similarity matching
      const keywords = questionText.toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(word => word.length > 3);

      const similarQuestions = questionsToSearch
        .map(q => {
          const qText = q.questionText.toLowerCase();
          const matchCount = keywords.filter(keyword => qText.includes(keyword)).length;
          return { question: q, score: matchCount };
        })
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
        .map(item => item.question);

      return similarQuestions;
    } catch (error: any) {
      console.error('Error finding similar questions:', error);
      return [];
    }
  },

  async getQuestionById(id: string): Promise<Question | null> {
    try {
      const questionDoc = await getDoc(doc(db, 'questions', id));
      if (!questionDoc.exists()) {
        return null;
      }
      const data = questionDoc.data();
      return {
        id: questionDoc.id,
        ...data,
        createdAt: data.createdAt.toDate(),
        updatedAt: data.updatedAt?.toDate(),
        closedAt: data.closedAt?.toDate(),
      } as Question;
    } catch (error: any) {
      throw new Error(`Failed to get question by ID: ${error.message}`);
    }
  },

  async updateQuestionStatus(
    id: string,
    status: 'pending' | 'answered' | 'closed',
    answeredBy?: 'teacher' | 'ai'
  ): Promise<void> {
    try {
      const updateData: any = {
        status,
        updatedAt: Timestamp.now(),
      };

      if (answeredBy) {
        updateData.answeredBy = answeredBy;
        updateData.viewedByStudent = false;
      }

      await updateDoc(doc(db, 'questions', id), updateData);
    } catch (error: any) {
      throw new Error(`Failed to update question status: ${error.message}`);
    }
  },

  async closeQuestion(
    id: string,
    reason: string,
    closedBy: string
  ): Promise<void> {
    try {
      await updateDoc(doc(db, 'questions', id), {
        status: 'closed',
        closedReason: reason,
        closedBy: closedBy,
        closedAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
    } catch (error: any) {
      throw new Error(`Failed to close question: ${error.message}`);
    }
  },

  async markQuestionAsViewed(id: string): Promise<void> {
    try {
      await updateDoc(doc(db, 'questions', id), {
        viewedByStudent: true,
      });
    } catch (error: any) {
      throw new Error(`Failed to mark question as viewed: ${error.message}`);
    }
  },

  async updateSatisfactionStatus(
    id: string,
    satisfactionStatus: 'satisfied' | 'confused' | 'none'
  ): Promise<void> {
    try {
      await updateDoc(doc(db, 'questions', id), {
        satisfactionStatus,
        updatedAt: Timestamp.now(),
      });
    } catch (error: any) {
      throw new Error(`Failed to update satisfaction status: ${error.message}`);
    }
  },

  async deleteQuestion(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'questions', id));
    } catch (error: any) {
      throw new Error(`Failed to delete question: ${error.message}`);
    }
  },

  async answerQuestion(
    answer: Omit<Answer, 'id' | 'createdAt'>
  ): Promise<string> {
    try {
      const cleanAnswer: any = {
        ...answer,
        createdAt: Timestamp.now(),
      };

      Object.keys(cleanAnswer).forEach(key => {
        if (cleanAnswer[key] === undefined) {
          delete cleanAnswer[key];
        }
      });

      const docRef = await addDoc(collection(db, 'answers'), cleanAnswer);
      
      await this.updateQuestionStatus(answer.questionId, 'answered', answer.type);
      
      if (answer.type === 'teacher') {
        const question = await this.getQuestionById(answer.questionId);
        if (question) {
          await this.createNotification({
            userId: question.studentId,
            type: 'question_answered',
            questionId: answer.questionId,
            message: `Your question about ${question.subject} has been answered by ${answer.teacherName || 'a teacher'}`,
          });
        }
      }
      
      return docRef.id;
    } catch (error: any) {
      throw new Error(`Failed to answer question: ${error.message}`);
    }
  },

  async getAnswersForQuestion(questionId: string): Promise<Answer[]> {
    try {
      const q = query(
        collection(db, 'answers'),
        where('questionId', '==', questionId),
        orderBy('createdAt', 'asc')
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt.toDate(),
      })) as Answer[];
    } catch (error: any) {
      throw new Error(`Failed to get answers for question: ${error.message}`);
    }
  },

  async deleteAnswer(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'answers', id));
    } catch (error: any) {
      throw new Error(`Failed to delete answer: ${error.message}`);
    }
  },

  async rateAnswer(
    questionId: string,
    answerId: string,
    answerType: 'teacher' | 'ai',
    rating: number
  ): Promise<void> {
    try {
      const ratingData = {
        questionId,
        answerId,
        answerType,
        rating,
        createdAt: Timestamp.now(),
      };

      await setDoc(doc(db, 'answer_ratings', `${questionId}_${answerId}`), ratingData);
    } catch (error: any) {
      throw new Error(`Failed to rate answer: ${error.message}`);
    }
  },

  async getRating(questionId: string, answerId: string): Promise<number | null> {
    try {
      const ratingDoc = await getDoc(doc(db, 'answer_ratings', `${questionId}_${answerId}`));
      if (!ratingDoc.exists()) {
        return null;
      }
      return ratingDoc.data().rating;
    } catch (error: any) {
      throw new Error(`Failed to get rating: ${error.message}`);
    }
  },

  async getAnswerRatings(answerType: 'teacher' | 'ai'): Promise<AnswerRating[]> {
    try {
      const q = query(
        collection(db, 'answer_ratings'),
        where('answerType', '==', answerType)
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map((doc) => ({
        ...doc.data(),
        createdAt: doc.data().createdAt.toDate(),
      })) as AnswerRating[];
    } catch (error: any) {
      throw new Error(`Failed to get answer ratings: ${error.message}`);
    }
  },

  async saveQuestion(userId: string, questionId: string): Promise<void> {
    try {
      await setDoc(doc(db, 'saved_questions', `${userId}_${questionId}`), {
        userId,
        questionId,
        savedAt: Timestamp.now(),
      });
    } catch (error: any) {
      throw new Error(`Failed to save question: ${error.message}`);
    }
  },

  async unsaveQuestion(userId: string, questionId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'saved_questions', `${userId}_${questionId}`));
    } catch (error: any) {
      throw new Error(`Failed to unsave question: ${error.message}`);
    }
  },

  async getSavedQuestions(userId: string): Promise<string[]> {
    try {
      const q = query(
        collection(db, 'saved_questions'),
        where('userId', '==', userId)
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map((doc) => doc.data().questionId);
    } catch (error: any) {
      throw new Error(`Failed to get saved questions: ${error.message}`);
    }
  },

  async createNotification(
    notification: Omit<Notification, 'id' | 'read' | 'createdAt'>
  ): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, 'notifications'), {
        ...notification,
        read: false,
        createdAt: Timestamp.now(),
      });
      return docRef.id;
    } catch (error: any) {
      throw new Error(`Failed to create notification: ${error.message}`);
    }
  },

  async getNotifications(userId: string): Promise<Notification[]> {
    try {
      const q = query(
        collection(db, 'notifications'),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt.toDate(),
      })) as Notification[];
    } catch (error: any) {
      throw new Error(`Failed to get notifications: ${error.message}`);
    }
  },

  async markNotificationAsRead(id: string): Promise<void> {
    try {
      await updateDoc(doc(db, 'notifications', id), {
        read: true,
      });
    } catch (error: any) {
      throw new Error(`Failed to mark notification as read: ${error.message}`);
    }
  },

  async deleteNotification(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'notifications', id));
    } catch (error: any) {
      throw new Error(`Failed to delete notification: ${error.message}`);
    }
  },

  async addKnowledge(
    knowledge: Omit<Knowledge, 'id' | 'createdAt'>
  ): Promise<string> {
    try {
      const cleanKnowledge: any = {
        ...knowledge,
        createdAt: Timestamp.now(),
      };

      Object.keys(cleanKnowledge).forEach(key => {
        if (cleanKnowledge[key] === undefined) {
          delete cleanKnowledge[key];
        }
      });

      const docRef = await addDoc(collection(db, 'knowledge'), cleanKnowledge);
      return docRef.id;
    } catch (error: any) {
      throw new Error(`Failed to add knowledge: ${error.message}`);
    }
  },

  async getKnowledgeBySubject(subject: string): Promise<Knowledge[]> {
    try {
      const q = query(
        collection(db, 'knowledge'),
        where('subject', '==', subject),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
      })) as Knowledge[];
    } catch (error: any) {
      throw new Error(`Failed to get knowledge: ${error.message}`);
    }
  },

  async getAllKnowledge(): Promise<Knowledge[]> {
    try {
      const q = query(collection(db, 'knowledge'), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
      })) as Knowledge[];
    } catch (error: any) {
      throw new Error(`Failed to get all knowledge: ${error.message}`);
    }
  },

  async updateKnowledge(id: string, updates: Partial<Knowledge>): Promise<void> {
    try {
      const updateData: any = {
        ...updates,
        updatedAt: Timestamp.now(),
      };

      Object.keys(updateData).forEach(key => {
        if (updateData[key] === undefined) {
          delete updateData[key];
        }
      });

      await updateDoc(doc(db, 'knowledge', id), updateData);
    } catch (error: any) {
      throw new Error(`Failed to update knowledge: ${error.message}`);
    }
  },

  async deleteKnowledge(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'knowledge', id));
    } catch (error: any) {
      throw new Error(`Failed to delete knowledge: ${error.message}`);
    }
  },

  onNewPendingQuestions(callback: (questions: Question[]) => void): () => void {
    try {
      const q = query(
        collection(db, 'questions'),
        where('status', '==', 'pending'),
        orderBy('createdAt', 'desc')
      );

      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const questions = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt.toDate(),
          updatedAt: doc.data().updatedAt?.toDate(),
          closedAt: doc.data().closedAt?.toDate(),
        })) as Question[];
        
        callback(questions);
      });

      return unsubscribe;
    } catch (error: any) {
      console.error('Failed to set up pending questions listener:', error);
      return () => {};
    }
  },

  onNewNotifications(userId: string, callback: (notifications: Notification[]) => void): () => void {
    try {
      const q = query(
        collection(db, 'notifications'),
        where('userId', '==', userId),
        where('read', '==', false),
        orderBy('createdAt', 'desc')
      );

      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const notifications = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt.toDate(),
        })) as Notification[];
        
        callback(notifications);
      });

      return unsubscribe;
    } catch (error: any) {
      console.error('Failed to set up notifications listener:', error);
      return () => {};
    }
  },

  async getFollowUpQuestions(parentQuestionId: string): Promise<Question[]> {
    try {
      const q = query(
        collection(db, 'questions'),
        where('parentQuestionId', '==', parentQuestionId),
        orderBy('createdAt', 'asc')
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
        closedAt: doc.data().closedAt?.toDate(),
      })) as Question[];
    } catch (error: any) {
      throw new Error(`Failed to get follow-up questions: ${error.message}`);
    }
  },

  async deleteQuestionWithRelatedData(questionId: string): Promise<void> {
    try {
      const answers = await this.getAnswersForQuestion(questionId);
      for (const answer of answers) {
        await this.deleteAnswer(answer.id);
        
        try {
          await deleteDoc(doc(db, 'answer_ratings', `${questionId}_${answer.id}`));
        } catch (err) {
          // Rating might not exist
        }
      }

      const followUps = await this.getFollowUpQuestions(questionId);
      for (const followUp of followUps) {
        await this.deleteQuestionWithRelatedData(followUp.id);
      }

      const allNotifications = await getDocs(collection(db, 'notifications'));
      const relatedNotifications = allNotifications.docs.filter(
        doc => doc.data().questionId === questionId
      );
      for (const notif of relatedNotifications) {
        await this.deleteNotification(notif.id);
      }

      await this.deleteQuestion(questionId);
    } catch (error: any) {
      throw new Error(`Failed to delete question with related data: ${error.message}`);
    }
  },
};
