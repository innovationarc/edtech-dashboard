// src/services/qaService.ts - Part 1 of 2 (FIXED - Proper Upload Timing & Similarity)
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
import Tesseract from 'tesseract.js';

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
  extractedText?: string;
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

  async deleteFromSupabase(url: string): Promise<void> {
    try {
      await uploadService.deleteFromSupabase(url);
    } catch (error) {
      console.error('Failed to delete from Supabase:', error);
    }
  },

  async deleteAttachments(question: Question): Promise<void> {
    const deletionPromises: Promise<void>[] = [];
    if (question.imageUrl) deletionPromises.push(this.deleteFromSupabase(question.imageUrl));
    if (question.audioUrl) deletionPromises.push(this.deleteFromSupabase(question.audioUrl));
    if (question.fileUrl) deletionPromises.push(this.deleteFromSupabase(question.fileUrl));
    await Promise.all(deletionPromises);
  },

  async deleteAnswerAttachments(answer: Answer): Promise<void> {
    const deletionPromises: Promise<void>[] = [];
    if (answer.imageUrl) deletionPromises.push(this.deleteFromSupabase(answer.imageUrl));
    if (answer.audioUrl) deletionPromises.push(this.deleteFromSupabase(answer.audioUrl));
    if (answer.fileUrl) deletionPromises.push(this.deleteFromSupabase(answer.fileUrl));
    await Promise.all(deletionPromises);
  },

  aggressiveClean(text: string): string {
    if (!text || typeof text !== 'string') return '';
    
    try {
      let cleaned = text.normalize('NFKD').normalize('NFC');
      cleaned = cleaned.replace(/[^\x20-\x7E\u00A0-\uFFFF]/g, '');
      cleaned = cleaned.replace(/[\s\n\r\t\u00A0\u1680\u2000-\u200B\u202F\u205F\u3000\uFEFF]+/g, ' ');
      cleaned = cleaned.replace(/[`~|]/g, ' ');
      cleaned = cleaned.replace(/['']/g, "'");
      cleaned = cleaned.replace(/[""]/g, '"');
      cleaned = cleaned.replace(/([.,!?;:]){2,}/g, '$1');
      cleaned = cleaned.toLowerCase();
      cleaned = cleaned.trim();
      cleaned = cleaned.replace(/\s{2,}/g, ' ');
      return cleaned;
    } catch (e) {
      console.error('Error cleaning text:', e);
      return '';
    }
  },

  async extractTextFromImage(imageUrl: string): Promise<string> {
    try {
      console.log('🔍 OCR START');
      
      const worker = await Tesseract.createWorker('eng', 1, {
        logger: (m) => {
          if (m.status === 'recognizing text' && m.progress === 1) {
            console.log('📊 OCR: 100%');
          }
        }
      });

      try {
        const { data } = await worker.recognize(imageUrl);
        const rawText = data.text || '';
        
        console.log('📝 RAW LENGTH:', rawText.length);
        
        const cleanedText = this.aggressiveClean(rawText);
        
        console.log('🧹 CLEAN LENGTH:', cleanedText.length);
        console.log('🧹 PREVIEW:', cleanedText.substring(0, 60));
        console.log('✅ OCR DONE\n');
        
        return cleanedText;
      } finally {
        await worker.terminate();
      }
    } catch (error) {
      console.error('❌ OCR FAILED:', error);
      return '';
    }
  },

  removeInstructions(text: string): string {
    if (!text) return '';
    
    let cleaned = this.aggressiveClean(text);
    
    const patterns = [
      /^(solve|answer|help|explain|find|calculate|show|prove|verify|determine|check)\s+/gi,
      /\s+(it|this|that|the problem|the question|please|pls|plz)$/gi,
      /^(can you|could you|will you|please)\s+/gi,
    ];
    
    patterns.forEach(p => {
      cleaned = cleaned.replace(p, ' ');
    });
    
    return cleaned.replace(/\s+/g, ' ').trim();
  },

  async askQuestion(
    question: Omit<Question, 'id' | 'status' | 'createdAt' | 'viewedByStudent' | 'satisfactionStatus'>
  ): Promise<string> {
    try {
      let extractedText = '';
      
      if (question.imageUrl) {
        console.log('🖼️ IMAGE DETECTED - EXTRACTING OCR');
        extractedText = await this.extractTextFromImage(question.imageUrl);
      }

      const cleanQuestion: any = {
        ...question,
        status: 'pending',
        viewedByStudent: true,
        satisfactionStatus: 'none',
        createdAt: Timestamp.now(),
        extractedText: extractedText || undefined,
      };

      Object.keys(cleanQuestion).forEach(key => {
        if (cleanQuestion[key] === undefined) delete cleanQuestion[key];
      });

      const docRef = await addDoc(collection(db, 'questions'), cleanQuestion);
      console.log('✅ SAVED Q:', docRef.id.substring(0, 8));
      return docRef.id;
    } catch (error: any) {
      console.error('❌ SAVE FAILED:', error);
      throw new Error(`Failed to ask question: ${error.message}`);
    }
  },

  async updateQuestion(id: string, updates: Partial<Question>): Promise<void> {
    try {
      const updateData: any = { ...updates, updatedAt: Timestamp.now() };
      Object.keys(updateData).forEach(key => {
        if (updateData[key] === undefined) delete updateData[key];
      });
      await updateDoc(doc(db, 'questions', id), updateData);
    } catch (error: any) {
      throw new Error(`Failed to update question: ${error.message}`);
    }
  },

  async getQuestions(subject?: string, status?: 'pending' | 'answered' | 'closed' | 'all', studentId?: string): Promise<Question[]> {
    try {
      let q = query(collection(db, 'questions'), orderBy('createdAt', 'desc'));
      if (subject && subject !== 'all') q = query(q, where('subject', '==', subject));
      if (status && status !== 'all') q = query(q, where('status', '==', status));
      if (studentId) q = query(q, where('studentId', '==', studentId));

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

  wordOverlapSimilarity(text1: string, text2: string): number {
    const clean1 = this.aggressiveClean(text1);
    const clean2 = this.aggressiveClean(text2);
    
    if (!clean1 || !clean2) return 0;
    if (clean1 === clean2) return 1.0;
    
    const words1 = clean1.split(/\s+/).filter(w => w.length > 1);
    const words2 = clean2.split(/\s+/).filter(w => w.length > 1);
    
    if (words1.length === 0 || words2.length === 0) return 0;
    
    const set1 = new Set(words1);
    const set2 = new Set(words2);
    const intersection = [...set1].filter(w => set2.has(w)).length;
    const union = new Set([...set1, ...set2]).size;
    
    return union > 0 ? intersection / union : 0;
  },

  characterSimilarity(text1: string, text2: string): number {
    const clean1 = this.aggressiveClean(text1).replace(/\s/g, '');
    const clean2 = this.aggressiveClean(text2).replace(/\s/g, '');
    
    if (!clean1 || !clean2) return 0;
    if (clean1 === clean2) return 1.0;
    
    const len1 = clean1.length;
    const len2 = clean2.length;
    const maxLen = Math.max(len1, len2);
    
    if (maxLen === 0) return 0;
    
    let matches = 0;
    const minLen = Math.min(len1, len2);
    
    for (let i = 0; i < minLen; i++) {
      if (clean1[i] === clean2[i]) matches++;
    }
    
    return matches / maxLen;
  },

  calculateSimilarity(text1: string, text2: string): number {
    const wordScore = this.wordOverlapSimilarity(text1, text2);
    const charScore = this.characterSimilarity(text1, text2);
    const finalScore = (wordScore * 0.7) + (charScore * 0.3);
    
    console.log(`   Word: ${wordScore.toFixed(3)} | Char: ${charScore.toFixed(3)} | Final: ${finalScore.toFixed(3)}`);
    
    return finalScore;
  },

  async calculateImageSimilarity(
    imageUrl1?: string, 
    imageUrl2?: string,
    extractedText1?: string,
    extractedText2?: string
  ): Promise<number> {
    if (!imageUrl1 || !imageUrl2) return 0;
    if (imageUrl1 === imageUrl2) return 1.0;

    console.log('🖼️ IMAGE SIMILARITY CHECK');
    
    if (extractedText1 && extractedText2) {
      const clean1 = this.aggressiveClean(extractedText1);
      const clean2 = this.aggressiveClean(extractedText2);
      
      console.log(`   OCR1 (${clean1.length}ch): ${clean1.substring(0, 40)}`);
      console.log(`   OCR2 (${clean2.length}ch): ${clean2.substring(0, 40)}`);
      
      if (clean1.length > 5 && clean2.length > 5) {
        const score = this.calculateSimilarity(clean1, clean2);
        console.log(`   IMAGE SCORE: ${score.toFixed(3)}\n`);
        return score;
      }
    }
    
    const getName = (url: string) => {
      const parts = url.split('/');
      return parts[parts.length - 1].split('?')[0].toLowerCase();
    };
    
    const name1 = getName(imageUrl1);
    const name2 = getName(imageUrl2);
    
    if (name1 === name2) {
      console.log('   SAME FILENAME: 0.95\n');
      return 0.95;
    }
    
    console.log('   NO MATCH: 0\n');
    return 0;
  },

  // CRITICAL FIX: Upload image FIRST, then extract OCR from uploaded URL
  async findSimilarQuestionsWithFile(
    questionText: string,
    subject: string,
    file: File | null,
    courseId?: string
  ): Promise<Question[]> {
    try {
      console.log('\n╔════════════════════════════════════════╗');
      console.log('║   FINDING SIMILAR QUESTIONS            ║');
      console.log('╚════════════════════════════════════════╝');
      console.log('📚 Subject:', subject);
      console.log('🖼️ Has File:', !!file);
      
      // CRITICAL: Upload file FIRST if present
      let uploadedImageUrl: string | undefined;
      let currentOCR = '';
      
      if (file) {
        console.log('⬆️ UPLOADING IMAGE FIRST...');
        const uploadResult = await this.uploadToSupabase(file, 'question_images');
        uploadedImageUrl = uploadResult.url;
        console.log('✅ UPLOADED:', uploadedImageUrl.substring(uploadedImageUrl.lastIndexOf('/') + 1, uploadedImageUrl.lastIndexOf('/') + 20));
        
        console.log('🔍 EXTRACTING OCR FROM UPLOADED IMAGE...');
        currentOCR = await this.extractTextFromImage(uploadedImageUrl);
        console.log('📝 CURRENT OCR:', currentOCR.substring(0, 60));
      }
      
      let q = query(
        collection(db, 'questions'),
        where('subject', '==', subject),
        where('status', '==', 'answered'),
        orderBy('createdAt', 'desc')
      );

      if (courseId) {
        q = query(q, where('courseId', '==', courseId));
      }
      
      const querySnapshot = await getDocs(q);
      let allQuestions = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
        closedAt: doc.data().closedAt?.toDate(),
      })) as Question[];

      console.log('📊 Total answered questions:', allQuestions.length);

      const cleanCurrentText = this.removeInstructions(questionText);
      console.log('📝 Current Q (cleaned):', cleanCurrentText.substring(0, 60));

      const scored = await Promise.all(
        allQuestions.map(async (q, idx) => {
          console.log(`\n[${idx+1}/${allQuestions.length}] Comparing: ${q.id.substring(0, 8)}`);
          
          const cleanStoredText = this.removeInstructions(q.questionText);
          const textScore = this.calculateSimilarity(cleanCurrentText, cleanStoredText);
          
          let imageScore = 0;
          if (uploadedImageUrl && q.imageUrl) {
            imageScore = await this.calculateImageSimilarity(uploadedImageUrl, q.imageUrl, currentOCR, q.extractedText);
          }
          
          const finalScore = uploadedImageUrl && q.imageUrl 
            ? (imageScore * 0.6 + textScore * 0.4)
            : textScore;
          
          console.log(`   FINAL: ${finalScore.toFixed(3)} (Img:${imageScore.toFixed(2)} Text:${textScore.toFixed(2)})`);
          
          return { question: q, score: finalScore, uploadedImageUrl };
        })
      );

      const similar = scored
        .filter(item => item.score >= 0.35)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

      console.log('\n╔════════════════════════════════════════╗');
      console.log(`║   FOUND ${similar.length} SIMILAR QUESTION(S)`.padEnd(41) + '║');
      console.log('╚════════════════════════════════════════╝\n');

      return similar.map(s => s.question);
    } catch (error: any) {
      console.error('❌ Error finding similar:', error);
      return [];
    }
  },

  // Legacy method for compatibility - use findSimilarQuestionsWithFile instead
  async findSimilarQuestions(
    questionText: string,
    subject: string,
    currentQuestionId?: string,
    imageUrl?: string,
    courseId?: string
  ): Promise<Question[]> {
    try {
      console.log('\n╔════════════════════════════════════════╗');
      console.log('║   FINDING SIMILAR (LEGACY)             ║');
      console.log('╚════════════════════════════════════════╝');
      
      let q = query(
        collection(db, 'questions'),
        where('subject', '==', subject),
        where('status', '==', 'answered'),
        orderBy('createdAt', 'desc')
      );

      if (courseId) {
        q = query(q, where('courseId', '==', courseId));
      }
      
      const querySnapshot = await getDocs(q);
      let allQuestions = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
        closedAt: doc.data().closedAt?.toDate(),
      })) as Question[];

      const questionsToSearch = currentQuestionId 
        ? allQuestions.filter(q => q.id !== currentQuestionId)
        : allQuestions;

      let currentOCR = '';
      if (imageUrl) {
        currentOCR = await this.extractTextFromImage(imageUrl);
      }

      const cleanCurrentText = this.removeInstructions(questionText);

      const scored = await Promise.all(
        questionsToSearch.map(async (q) => {
          const cleanStoredText = this.removeInstructions(q.questionText);
          const textScore = this.calculateSimilarity(cleanCurrentText, cleanStoredText);
          
          let imageScore = 0;
          if (imageUrl && q.imageUrl) {
            imageScore = await this.calculateImageSimilarity(imageUrl, q.imageUrl, currentOCR, q.extractedText);
          }
          
          const finalScore = imageUrl && q.imageUrl 
            ? (imageScore * 0.6 + textScore * 0.4)
            : textScore;
          
          return { question: q, score: finalScore };
        })
      );

      return scored
        .filter(item => item.score >= 0.35)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
        .map(s => s.question);
    } catch (error: any) {
      console.error('❌ Error:', error);
      return [];
    }
  },

  async getQuestionById(id: string): Promise<Question | null> {
    try {
      const questionDoc = await getDoc(doc(db, 'questions', id));
      if (!questionDoc.exists()) return null;
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

  async updateQuestionStatus(id: string, status: 'pending' | 'answered' | 'closed', answeredBy?: 'teacher' | 'ai'): Promise<void> {
    try {
      const updateData: any = { status, updatedAt: Timestamp.now() };
      if (answeredBy) {
        updateData.answeredBy = answeredBy;
        updateData.viewedByStudent = false;
      }
      await updateDoc(doc(db, 'questions', id), updateData);
    } catch (error: any) {
      throw new Error(`Failed to update question status: ${error.message}`);
    }
  },

  async closeQuestion(id: string, reason: string, closedBy: string): Promise<void> {
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
      await updateDoc(doc(db, 'questions', id), { viewedByStudent: true });
    } catch (error: any) {
      throw new Error(`Failed to mark question as viewed: ${error.message}`);
    }
  },

  async updateSatisfactionStatus(id: string, satisfactionStatus: 'satisfied' | 'confused' | 'none'): Promise<void> {
    try {
      await updateDoc(doc(db, 'questions', id), { satisfactionStatus, updatedAt: Timestamp.now() });
    } catch (error: any) {
      throw new Error(`Failed to update satisfaction status: ${error.message}`);
    }
  },

  async deleteQuestion(id: string): Promise<void> {
    try {
      const question = await this.getQuestionById(id);
      if (question) await this.deleteAttachments(question);
      await deleteDoc(doc(db, 'questions', id));
    } catch (error: any) {
      throw new Error(`Failed to delete question: ${error.message}`);
    }
  },

  async answerQuestion(answer: Omit<Answer, 'id' | 'createdAt'>): Promise<string> {
    try {
      const cleanAnswer: any = { ...answer, createdAt: Timestamp.now() };
      Object.keys(cleanAnswer).forEach(key => {
        if (cleanAnswer[key] === undefined) delete cleanAnswer[key];
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
      const q = query(collection(db, 'answers'), where('questionId', '==', questionId), orderBy('createdAt', 'asc'));
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
// src/services/qaService.ts - Part 2 of 2 (PASTE IMMEDIATELY AFTER PART 1)

  async deleteAnswer(id: string): Promise<void> {
    try {
      const answerDoc = await getDoc(doc(db, 'answers', id));
      if (answerDoc.exists()) {
        const answer = { id: answerDoc.id, ...answerDoc.data() } as Answer;
        await this.deleteAnswerAttachments(answer);
      }
      await deleteDoc(doc(db, 'answers', id));
    } catch (error: any) {
      throw new Error(`Failed to delete answer: ${error.message}`);
    }
  },

  async rateAnswer(questionId: string, answerId: string, answerType: 'teacher' | 'ai', rating: number): Promise<void> {
    try {
      const ratingDoc = await getDoc(doc(db, 'answer_ratings', `${questionId}_${answerId}`));
      const ratingData: any = { questionId, answerId, answerType, rating };
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
      if (!ratingDoc.exists()) return null;
      return ratingDoc.data().rating;
    } catch (error: any) {
      throw new Error(`Failed to get rating: ${error.message}`);
    }
  },

  async getAnswerRatings(answerType: 'teacher' | 'ai'): Promise<AnswerRating[]> {
    try {
      const q = query(collection(db, 'answer_ratings'), where('answerType', '==', answerType));
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
      const q = query(collection(db, 'saved_questions'), where('userId', '==', userId));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map((doc) => doc.data().questionId);
    } catch (error: any) {
      throw new Error(`Failed to get saved questions: ${error.message}`);
    }
  },

  async createNotification(notification: Omit<Notification, 'id' | 'read' | 'createdAt'>): Promise<string> {
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
      const q = query(collection(db, 'notifications'), where('userId', '==', userId), orderBy('createdAt', 'desc'));
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
      await updateDoc(doc(db, 'notifications', id), { read: true });
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

  async addKnowledge(knowledge: Omit<Knowledge, 'id' | 'createdAt'>): Promise<string> {
    try {
      const cleanKnowledge: any = { ...knowledge, createdAt: Timestamp.now() };
      Object.keys(cleanKnowledge).forEach(key => {
        if (cleanKnowledge[key] === undefined) delete cleanKnowledge[key];
      });
      const docRef = await addDoc(collection(db, 'knowledge'), cleanKnowledge);
      return docRef.id;
    } catch (error: any) {
      throw new Error(`Failed to add knowledge: ${error.message}`);
    }
  },

  async getKnowledgeBySubject(subject: string): Promise<Knowledge[]> {
    try {
      const q = query(collection(db, 'knowledge'), where('subject', '==', subject), orderBy('createdAt', 'desc'));
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
      const updateData: any = { ...updates, updatedAt: Timestamp.now() };
      Object.keys(updateData).forEach(key => {
        if (updateData[key] === undefined) delete updateData[key];
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
      const q = query(collection(db, 'questions'), where('status', '==', 'pending'), orderBy('createdAt', 'desc'));
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
      const question = await this.getQuestionById(questionId);
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
      const relatedNotifications = allNotifications.docs.filter(doc => doc.data().questionId === questionId);
      for (const notif of relatedNotifications) {
        await this.deleteNotification(notif.id);
      }

      const savedQuestionsSnapshot = await getDocs(collection(db, 'saved_questions'));
      const savedReferences = savedQuestionsSnapshot.docs.filter(doc => doc.data().questionId === questionId);
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
      const q = query(collection(db, 'questions'), where('courseId', '==', courseId));
      const querySnapshot = await getDocs(q);
      const deletionPromises = querySnapshot.docs.map(doc => this.deleteQuestionWithRelatedData(doc.id));
      await Promise.all(deletionPromises);
    } catch (error: any) {
      throw new Error(`Failed to delete questions by course: ${error.message}`);
    }
  },

  async getAiConversationContext(questionId: string): Promise<{ originalQuestion: string; previousAnswers: string[] }> {
    try {
      const question = await this.getQuestionById(questionId);
      if (!question) return { originalQuestion: '', previousAnswers: [] };

      const answers = await this.getAnswersForQuestion(questionId);
      const aiAnswers = answers.filter(a => a.type === 'ai').map(a => a.answerText);

      return { originalQuestion: question.questionText, previousAnswers: aiAnswers };
    } catch (error: any) {
      console.error('Failed to get conversation context:', error);
      return { originalQuestion: '', previousAnswers: [] };
    }
  },
};
