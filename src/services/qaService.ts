// src/services/qaService.ts - Part 1 of 2 (FINAL FIX - Proper Image Reuse & Course Filtering)
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
  combinedText?: string;
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

  normalizeText(text: string): string {
    if (!text || typeof text !== 'string') return '';
    
    try {
      let normalized = text.normalize('NFKD').normalize('NFC');
      normalized = normalized.replace(/[^\x20-\x7E\u00A0-\uFFFF]/g, ' ');
      normalized = normalized.replace(/[\s\n\r\t\u00A0\u1680\u2000-\u200B\u202F\u205F\u3000\uFEFF]+/g, ' ');
      normalized = normalized.replace(/[`~|]/g, ' ');
      normalized = normalized.replace(/['']/g, "'");
      normalized = normalized.replace(/[""]/g, '"');
      normalized = normalized.replace(/([.,!?;:]){2,}/g, '$1');
      normalized = normalized.toLowerCase();
      normalized = normalized.trim();
      normalized = normalized.replace(/\s{2,}/g, ' ');
      return normalized;
    } catch (e) {
      console.error('Error normalizing text:', e);
      return '';
    }
  },

  async extractTextFromImage(imageUrl: string): Promise<string> {
    try {
      console.log('🔍 Starting OCR extraction...');
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const worker = await Tesseract.createWorker('eng', 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            const percent = Math.round(m.progress * 100);
            if (percent % 20 === 0) {
              console.log(`📊 OCR Progress: ${percent}%`);
            }
          }
        }
      });

      try {
        const { data } = await worker.recognize(imageUrl);
        const rawText = data.text || '';
        
        console.log('📝 Raw OCR length:', rawText.length);
        
        const cleanedText = this.normalizeText(rawText);
        
        console.log('🧹 Cleaned OCR length:', cleanedText.length);
        console.log('🧹 OCR Preview:', cleanedText.substring(0, 100));
        console.log('✅ OCR extraction complete');
        
        return cleanedText;
      } finally {
        await worker.terminate();
      }
    } catch (error) {
      console.error('❌ OCR extraction failed:', error);
      return '';
    }
  },

  removeStopWords(text: string): string {
    if (!text) return '';
    
    const normalized = this.normalizeText(text);
    
    const stopWords = [
      'solve', 'answer', 'help', 'explain', 'find', 'calculate', 'show', 
      'prove', 'verify', 'determine', 'check', 'can', 'you', 'could', 
      'will', 'please', 'pls', 'plz', 'it', 'this', 'that', 'the', 
      'problem', 'question', 'a', 'an', 'and', 'or', 'but', 'is', 'are',
      'what', 'how', 'why', 'when', 'where', 'who'
    ];
    
    const words = normalized.split(/\s+/);
    const filtered = words.filter(word => 
      word.length > 2 && !stopWords.includes(word)
    );
    
    return filtered.join(' ');
  },

  levenshteinDistance(str1: string, str2: string): number {
    const len1 = str1.length;
    const len2 = str2.length;
    const matrix: number[][] = [];

    if (len1 === 0) return len2;
    if (len2 === 0) return len1;

    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }

    return matrix[len1][len2];
  },

  calculateAdvancedSimilarity(text1: string, text2: string): number {
    const clean1 = this.removeStopWords(text1);
    const clean2 = this.removeStopWords(text2);
    
    if (!clean1 || !clean2) return 0;
    if (clean1 === clean2) return 1.0;
    
    // 1. Word overlap (Jaccard similarity)
    const words1 = clean1.split(/\s+/).filter(w => w.length > 1);
    const words2 = clean2.split(/\s+/).filter(w => w.length > 1);
    
    if (words1.length === 0 || words2.length === 0) return 0;
    
    const set1 = new Set(words1);
    const set2 = new Set(words2);
    const intersection = [...set1].filter(w => set2.has(w)).length;
    const union = new Set([...set1, ...set2]).size;
    const jaccardScore = union > 0 ? intersection / union : 0;
    
    // 2. Levenshtein similarity
    const maxLen = Math.max(clean1.length, clean2.length);
    const levDistance = this.levenshteinDistance(clean1, clean2);
    const levScore = maxLen > 0 ? 1 - (levDistance / maxLen) : 0;
    
    // 3. Character n-gram overlap (trigrams)
    const getNgrams = (text: string, n: number): Set<string> => {
      const ngrams = new Set<string>();
      if (text.length < n) return ngrams;
      for (let i = 0; i <= text.length - n; i++) {
        ngrams.add(text.substring(i, i + n));
      }
      return ngrams;
    };
    
    const trigrams1 = getNgrams(clean1, 3);
    const trigrams2 = getNgrams(clean2, 3);
    const trigramIntersection = [...trigrams1].filter(t => trigrams2.has(t)).length;
    const trigramUnion = new Set([...trigrams1, ...trigrams2]).size;
    const trigramScore = trigramUnion > 0 ? trigramIntersection / trigramUnion : 0;
    
    // 4. Longest common subsequence
    const lcs = (s1: string, s2: string): number => {
      const m = s1.length;
      const n = s2.length;
      const dp: number[][] = Array(m + 1).fill(0).map(() => Array(n + 1).fill(0));
      
      for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
          if (s1[i - 1] === s2[j - 1]) {
            dp[i][j] = dp[i - 1][j - 1] + 1;
          } else {
            dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
          }
        }
      }
      return dp[m][n];
    };
    
    const lcsLength = lcs(clean1, clean2);
    const lcsScore = maxLen > 0 ? lcsLength / maxLen : 0;
    
    // Weighted combination
    const finalScore = (
      jaccardScore * 0.40 +
      levScore * 0.30 +
      trigramScore * 0.20 +
      lcsScore * 0.10
    );
    
    return finalScore;
  },

  async askQuestion(
    question: Omit<Question, 'id' | 'status' | 'createdAt' | 'viewedByStudent' | 'satisfactionStatus'>
  ): Promise<string> {
    try {
      console.log('💾 Saving question to database...');
      
      const cleanQuestion: any = {
        ...question,
        status: 'pending',
        viewedByStudent: true,
        satisfactionStatus: 'none',
        createdAt: Timestamp.now(),
        combinedText: this.normalizeText(question.questionText),
      };

      Object.keys(cleanQuestion).forEach(key => {
        if (cleanQuestion[key] === undefined) delete cleanQuestion[key];
      });

      const docRef = await addDoc(collection(db, 'questions'), cleanQuestion);
      console.log('✅ Question saved:', docRef.id.substring(0, 8));
      
      if (question.imageUrl) {
        console.log('🖼️ Image detected, extracting OCR in background...');
        this.extractTextFromImage(question.imageUrl).then(async (extractedText) => {
          if (extractedText && extractedText.length > 5) {
            console.log('📝 Updating question with OCR and combined text...');
            
            const normalizedQuestion = this.normalizeText(question.questionText);
            const normalizedOCR = this.normalizeText(extractedText);
            const combined = `${normalizedQuestion} ${normalizedOCR}`.trim();
            
            await updateDoc(doc(db, 'questions', docRef.id), {
              extractedText,
              combinedText: combined,
              updatedAt: Timestamp.now()
            });
            console.log('✅ OCR and combined text saved to database');
            console.log('📊 Combined text length:', combined.length);
          }
        }).catch(err => {
          console.error('Failed to extract/save OCR:', err);
        });
      }
      
      return docRef.id;
    } catch (error: any) {
      console.error('❌ Failed to save question:', error);
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

  async findSimilarQuestionsWithFile(
    questionText: string,
    subject: string,
    file: File | null,
    courseId?: string
  ): Promise<{ questions: Question[], uploadedImageUrl?: string }> {
    try {
      console.log('\n╔════════════════════════════════════════╗');
      console.log('║   FINDING SIMILAR QUESTIONS            ║');
      console.log('╚════════════════════════════════════════╝');
      console.log('📚 Subject:', subject);
      console.log('📚 Course ID:', courseId);
      console.log('📝 Question text:', questionText.substring(0, 80));
      console.log('🖼️ Has File:', !!file);
      
      let uploadedImageUrl: string | undefined;
      let extractedOCR = '';
      
      if (file) {
        console.log('⬆️ Uploading image to Supabase...');
        const uploadResult = await this.uploadToSupabase(file, 'question_images');
        uploadedImageUrl = uploadResult.url;
        console.log('✅ Image uploaded:', uploadedImageUrl.substring(uploadedImageUrl.lastIndexOf('/') + 1));
        
        console.log('🔍 Extracting OCR from uploaded image...');
        extractedOCR = await this.extractTextFromImage(uploadedImageUrl);
        console.log('📝 OCR extracted, length:', extractedOCR.length);
        console.log('📝 OCR preview:', extractedOCR.substring(0, 80));
      }
      
      const normalizedQuestion = this.normalizeText(questionText);
      const normalizedOCR = this.normalizeText(extractedOCR);
      const currentCombinedText = `${normalizedQuestion} ${normalizedOCR}`.trim();
      
      console.log('🔗 Current combined text:', currentCombinedText.substring(0, 100));
      console.log('🔗 Combined text length:', currentCombinedText.length);
      
      // Build query for answered questions in same subject AND course
      let q = query(
        collection(db, 'questions'),
        where('subject', '==', subject),
        where('status', '==', 'answered')
      );

      // CRITICAL: Filter by course if provided
      if (courseId) {
        q = query(q, where('courseId', '==', courseId));
      }
      
      q = query(q, orderBy('createdAt', 'desc'));
      
      const querySnapshot = await getDocs(q);
      const allQuestions = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
        closedAt: doc.data().closedAt?.toDate(),
      })) as Question[];

      console.log('📊 Total answered questions in subject+course:', allQuestions.length);

      if (allQuestions.length === 0) {
        console.log('❌ No answered questions found');
        return { questions: [], uploadedImageUrl };
      }

      // Calculate similarity
      const scored = allQuestions.map((q, idx) => {
        const storedCombinedText = q.combinedText || this.normalizeText(q.questionText);
        
        const similarityScore = this.calculateAdvancedSimilarity(
          currentCombinedText,
          storedCombinedText
        );
        
        if ((idx + 1) <= 5) {
          console.log(`\n[${idx + 1}] Q: ${q.id.substring(0, 8)} (Course: ${q.courseId})`);
          console.log(`   Question: ${q.questionText.substring(0, 50)}...`);
          console.log(`   Stored combined: ${storedCombinedText.substring(0, 60)}...`);
          console.log(`   Similarity: ${(similarityScore * 100).toFixed(1)}%`);
        }
        
        return { 
          question: q, 
          score: similarityScore
        };
      });

      const threshold = 0.35;
      const similar = scored
        .filter(item => item.score >= threshold)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

      console.log('\n╔════════════════════════════════════════╗');
      console.log(`║   FOUND ${similar.length} SIMILAR QUESTION(S)`.padEnd(41) + '║');
      if (similar.length > 0) {
        console.log('║   Top similarities:'.padEnd(41) + '║');
        similar.forEach((s, i) => {
          console.log(`║   ${i + 1}. ${(s.score * 100).toFixed(1)}% - ${s.question.id.substring(0, 8)}`.padEnd(41) + '║');
        });
      }
      console.log('╚════════════════════════════════════════╝\n');

      return { 
        questions: similar.map(s => s.question),
        uploadedImageUrl 
      };
    } catch (error: any) {
      console.error('❌ Error finding similar questions:', error);
      return { questions: [], uploadedImageUrl: undefined };
    }
  },

  async findSimilarQuestions(
    questionText: string,
    subject: string,
    currentQuestionId?: string,
    imageUrl?: string,
    courseId?: string
  ): Promise<Question[]> {
    try {
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

      const questionsToSearch = currentQuestionId 
        ? allQuestions.filter(q => q.id !== currentQuestionId)
        : allQuestions;

      if (questionsToSearch.length === 0) return [];

      const normalizedCurrent = this.normalizeText(questionText);

      const scored = questionsToSearch.map((q) => {
        const storedCombinedText = q.combinedText || this.normalizeText(q.questionText);
        const score = this.calculateAdvancedSimilarity(normalizedCurrent, storedCombinedText);
        return { question: q, score };
      });

      return scored
        .filter(item => item.score >= 0.35)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
        .map(s => s.question);
    } catch (error: any) {
      console.error('❌ Error in findSimilarQuestions:', error);
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
