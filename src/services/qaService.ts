// src/services/qaService.ts - Part 1 of 2 (Enhanced with Advanced Text & Image Similarity Detection)
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
  updatedAt?: Date;
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

  // Advanced text similarity using Jaccard coefficient
  calculateJaccardSimilarity(text1: string, text2: string): number {
    const normalize = (text: string): Set<string> => {
      const words = text.toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 2);
      return new Set(words);
    };

    const set1 = normalize(text1);
    const set2 = normalize(text2);

    if (set1.size === 0 || set2.size === 0) return 0;

    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    return intersection.size / union.size;
  },

  // Advanced N-gram similarity (bigrams and trigrams)
  calculateNgramSimilarity(text1: string, text2: string, n: number = 2): number {
    const createNgrams = (text: string, n: number): Set<string> => {
      const normalized = text.toLowerCase().replace(/[^\w\s]/g, '');
      const words = normalized.split(/\s+/).filter(w => w.length > 0);
      const ngrams = new Set<string>();
      
      for (let i = 0; i <= words.length - n; i++) {
        ngrams.add(words.slice(i, i + n).join(' '));
      }
      
      return ngrams;
    };

    const ngrams1 = createNgrams(text1, n);
    const ngrams2 = createNgrams(text2, n);

    if (ngrams1.size === 0 || ngrams2.size === 0) return 0;

    const intersection = new Set([...ngrams1].filter(x => ngrams2.has(x)));
    const union = new Set([...ngrams1, ...ngrams2]);

    return intersection.size / union.size;
  },

  // Levenshtein distance for character-level similarity
  calculateLevenshteinSimilarity(text1: string, text2: string): number {
    const s1 = text1.toLowerCase();
    const s2 = text2.toLowerCase();
    
    const matrix: number[][] = [];
    
    for (let i = 0; i <= s2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= s1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= s2.length; i++) {
      for (let j = 1; j <= s1.length; j++) {
        if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    const distance = matrix[s2.length][s1.length];
    const maxLength = Math.max(s1.length, s2.length);
    
    return maxLength === 0 ? 1 : 1 - (distance / maxLength);
  },

  // Cosine similarity for semantic matching
  calculateCosineSimilarity(text1: string, text2: string): number {
    const getWordFrequency = (text: string): Map<string, number> => {
      const words = text.toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 2);
      
      const freq = new Map<string, number>();
      words.forEach(word => {
        freq.set(word, (freq.get(word) || 0) + 1);
      });
      return freq;
    };

    const freq1 = getWordFrequency(text1);
    const freq2 = getWordFrequency(text2);

    const allWords = new Set([...freq1.keys(), ...freq2.keys()]);
    
    let dotProduct = 0;
    let magnitude1 = 0;
    let magnitude2 = 0;

    allWords.forEach(word => {
      const val1 = freq1.get(word) || 0;
      const val2 = freq2.get(word) || 0;
      
      dotProduct += val1 * val2;
      magnitude1 += val1 * val1;
      magnitude2 += val2 * val2;
    });

    if (magnitude1 === 0 || magnitude2 === 0) return 0;

    return dotProduct / (Math.sqrt(magnitude1) * Math.sqrt(magnitude2));
  },

  // Advanced text similarity combining multiple algorithms
  calculateAdvancedTextSimilarity(text1: string, text2: string): number {
    const jaccardScore = this.calculateJaccardSimilarity(text1, text2);
    const bigramScore = this.calculateNgramSimilarity(text1, text2, 2);
    const trigramScore = this.calculateNgramSimilarity(text1, text2, 3);
    const levenshteinScore = this.calculateLevenshteinSimilarity(text1, text2);
    const cosineScore = this.calculateCosineSimilarity(text1, text2);

    // Weighted combination of all similarity scores
    return (
      jaccardScore * 0.25 +
      bigramScore * 0.20 +
      trigramScore * 0.15 +
      levenshteinScore * 0.20 +
      cosineScore * 0.20
    );
  },

  // Extract text from image URL using basic pattern matching
  extractImageBaseName(imageUrl: string): string {
    try {
      const parts = imageUrl.split('/');
      const filename = parts[parts.length - 1];
      const baseName = filename.split('?')[0].toLowerCase();
      // Remove file extension and common separators
      return baseName
        .replace(/\.(jpg|jpeg|png|gif|webp)$/i, '')
        .replace(/[_-]/g, ' ')
        .trim();
    } catch {
      return '';
    }
  },

  // Advanced image similarity checking
  async calculateImageSimilarity(imageUrl1?: string, imageUrl2?: string): Promise<number> {
    if (!imageUrl1 && !imageUrl2) return 0;
    if (!imageUrl1 || !imageUrl2) return 0;
    
    // Exact URL match
    if (imageUrl1 === imageUrl2) return 1.0;

    // Extract and compare base filenames
    const name1 = this.extractImageBaseName(imageUrl1);
    const name2 = this.extractImageBaseName(imageUrl2);

    if (!name1 || !name2) return 0;

    // Check for exact filename match (high confidence)
    if (name1 === name2) return 0.95;

    // Calculate text similarity between filenames
    const filenameSimilarity = this.calculateAdvancedTextSimilarity(name1, name2);
    
    // If filenames are very similar, return high score
    if (filenameSimilarity > 0.8) return 0.85;
    if (filenameSimilarity > 0.6) return 0.70;
    
    // Check if one filename contains the other
    if (name1.includes(name2) || name2.includes(name1)) {
      return 0.75;
    }

    // For moderate filename similarity
    if (filenameSimilarity > 0.4) return filenameSimilarity * 0.6;

    return 0;
  },

  // Check if images have similar dimensions or metadata (placeholder for future enhancement)
  async getImageMetadata(imageUrl: string): Promise<{ width: number; height: number } | null> {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        resolve({ width: img.width, height: img.height });
      };
      
      img.onerror = () => {
        resolve(null);
      };
      
      img.src = imageUrl;
      
      // Timeout after 3 seconds
      setTimeout(() => resolve(null), 3000);
    });
  },

  // Enhanced similarity detection with image analysis
  async findSimilarQuestions(
    questionText: string,
    subject: string,
    currentQuestionId?: string,
    imageUrl?: string,
    courseId?: string
  ): Promise<Question[]> {
    try {
      // Build efficient pre-filter query
      let q = query(
        collection(db, 'questions'),
        where('subject', '==', subject),
        where('status', '==', 'answered')
      );

      if (courseId) {
        q = query(q, where('courseId', '==', courseId));
      }

      q = query(q, orderBy('createdAt', 'desc'));
      
      const querySnapshot = await getDocs(q);
      let allQuestions = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
        closedAt: doc.data().closedAt?.toDate(),
      })) as Question[];

      // Filter out current question
      const questionsToSearch = currentQuestionId 
        ? allQuestions.filter(q => q.id !== currentQuestionId)
        : allQuestions;

      // Calculate similarity scores for each question
      const scoredQuestions = await Promise.all(
        questionsToSearch.map(async (q) => {
          // Advanced text similarity
          const textSimilarity = this.calculateAdvancedTextSimilarity(
            questionText,
            q.questionText
          );
          
          // Image similarity (if both have images)
          let imageSimilarity = 0;
          if (imageUrl && q.imageUrl) {
            imageSimilarity = await this.calculateImageSimilarity(imageUrl, q.imageUrl);
          } else if (!imageUrl && !q.imageUrl) {
            // Slight bonus if both don't have images
            imageSimilarity = 0.1;
          }

          // Combined score with weights
          // Text is more important (70%), images add context (30%)
          const finalScore = (textSimilarity * 0.70) + (imageSimilarity * 0.30);
          
          return { 
            question: q, 
            score: finalScore,
            textScore: textSimilarity,
            imageScore: imageSimilarity
          };
        })
      );

      // Filter and return top matches
      // Threshold: 0.50 for good similarity (50%+)
      const similarQuestions = scoredQuestions
        .filter(item => item.score >= 0.50)
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
          const answerSource = question.courseId === 'help-support' ? 'Admin' : 'Teacher';
          await this.createNotification({
            userId: question.studentId,
            type: 'question_answered',
            questionId: answer.questionId,
            message: `Your question about ${question.subject} has been answered by ${answerSource}`,
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
      const ratingDoc = await getDoc(doc(db, 'answer_ratings', `${questionId}_${answerId}`));
      
      const ratingData: any = {
        questionId,
        answerId,
        answerType,
        rating,
      };

      if (ratingDoc.exists()) {
        ratingData.updatedAt = Timestamp.now();
      } else {
        ratingData.createdAt = Timestamp.now();
      }

      await setDoc(doc(db, 'answer_ratings', `${questionId}_${answerId}`), ratingData, { merge: true });
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
        updatedAt: doc.data().updatedAt?.toDate(),
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
// src/services/qaService.ts - Part 2 of 2 (Continuation with Notifications, Knowledge, and Listeners)

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

      // Delete saved question references
      const savedQuestionsSnapshot = await getDocs(collection(db, 'saved_questions'));
      const savedReferences = savedQuestionsSnapshot.docs.filter(
        doc => doc.data().questionId === questionId
      );
      for (const savedRef of savedReferences) {
        await deleteDoc(doc(db, 'saved_questions', savedRef.id));
      }

      await this.deleteQuestion(questionId);
    } catch (error: any) {
      throw new Error(`Failed to delete question with related data: ${error.message}`);
    }
  },

  async deleteQuestionsByCourse(courseId: string): Promise<void> {
    try {
      const q = query(
        collection(db, 'questions'),
        where('courseId', '==', courseId)
      );
      const querySnapshot = await getDocs(q);
      
      const deletionPromises = querySnapshot.docs.map(doc => 
        this.deleteQuestionWithRelatedData(doc.id)
      );
      
      await Promise.all(deletionPromises);
    } catch (error: any) {
      throw new Error(`Failed to delete questions by course: ${error.message}`);
    }
  },
};
