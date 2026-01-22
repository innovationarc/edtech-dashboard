// src/services/qaService.ts - Part 1 of 2 (FIXED OCR & Similarity Detection)
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

    if (question.imageUrl) {
      deletionPromises.push(this.deleteFromSupabase(question.imageUrl));
    }
    if (question.audioUrl) {
      deletionPromises.push(this.deleteFromSupabase(question.audioUrl));
    }
    if (question.fileUrl) {
      deletionPromises.push(this.deleteFromSupabase(question.fileUrl));
    }

    await Promise.all(deletionPromises);
  },

  async deleteAnswerAttachments(answer: Answer): Promise<void> {
    const deletionPromises: Promise<void>[] = [];

    if (answer.imageUrl) {
      deletionPromises.push(this.deleteFromSupabase(answer.imageUrl));
    }
    if (answer.audioUrl) {
      deletionPromises.push(this.deleteFromSupabase(answer.audioUrl));
    }
    if (answer.fileUrl) {
      deletionPromises.push(this.deleteFromSupabase(answer.fileUrl));
    }

    await Promise.all(deletionPromises);
  },

  // CRITICAL FIX: Robust text cleaning for OCR output
  cleanOCRText(text: string): string {
    if (!text) return '';
    
    // Step 1: Normalize Unicode (CRITICAL for OCR text)
    let cleaned = text.normalize('NFKD');
    
    // Step 2: Remove control characters and zero-width characters
    cleaned = cleaned.replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200D\uFEFF]/g, '');
    
    // Step 3: Normalize whitespace (convert all whitespace to single space)
    cleaned = cleaned.replace(/\s+/g, ' ');
    
    // Step 4: Remove special punctuation that OCR might add
    cleaned = cleaned.replace(/[`~]/g, '');
    
    // Step 5: Trim and convert to lowercase for comparison
    cleaned = cleaned.trim().toLowerCase();
    
    return cleaned;
  },

  // Extract text from image using Tesseract.js with proper cleanup
  async extractTextFromImage(imageUrl: string): Promise<string> {
    try {
      console.log('🔍 Starting OCR extraction from:', imageUrl.substring(0, 50) + '...');
      
      const worker = await Tesseract.createWorker('eng+ben', 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            console.log(`📊 OCR Progress: ${Math.round(m.progress * 100)}%`);
          }
        }
      });

      try {
        const { data } = await worker.recognize(imageUrl, {
          rotateAuto: true,
        });

        let extractedText = data.text.trim();
        console.log('✅ Raw OCR complete. Length:', extractedText.length);
        console.log('📝 Raw preview:', extractedText.substring(0, 100));
        
        // CRITICAL: Clean the OCR text immediately
        extractedText = this.cleanOCRText(extractedText);
        console.log('🧹 Cleaned OCR. Length:', extractedText.length);
        console.log('📝 Cleaned preview:', extractedText.substring(0, 100));
        
        return extractedText || '';
      } finally {
        await worker.terminate();
      }
    } catch (error) {
      console.error('❌ OCR extraction failed:', error);
      return '';
    }
  },

  // Remove instruction phrases (already cleaned text as input)
  removeInstructionPhrases(text: string): string {
    if (!text) return '';
    
    // First, clean the text
    let cleaned = this.cleanOCRText(text);
    
    const instructionPatterns = [
      /\b(solve|answer|help|explain|find|calculate|show|prove|verify|check|determine)\s+(it|this|that|the\s+problem|the\s+question)\b/gi,
      /\b(please\s+)?(solve|answer|help|explain|find|calculate|show|prove|verify|check|determine)\b/gi,
      /\b(can\s+you|could\s+you|will\s+you|would\s+you)\s+(solve|answer|help|explain|find|calculate|show|prove|verify|check|determine)/gi,
      /\b(solve|answer)\s+(koro|kore\s+do|kore\s+den|kore\s+dao|korte\s+paro|korte\s+parben)\b/gi,
      /\b(ki\s+hobe|answer\s+ki|solve\s+koro|solve\s+kore|answer\s+dao|answer\s+den)\b/gi,
      /\b(eta|ata|ti|ta)\s+(solve|answer|koro|dao|den)\b/gi,
      /\bkivabe\s+(solve|korbo|hobe)\b/gi,
      /\b(urgently|asap|quickly|fast|please|pls|plz)\b/gi,
    ];

    instructionPatterns.forEach(pattern => {
      cleaned = cleaned.replace(pattern, ' ');
    });

    // Remove punctuation at boundaries
    cleaned = cleaned.replace(/^[^\w\s]+|[^\w\s]+$/g, '');
    
    // Final cleanup
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    
    return cleaned;
  },

  async askQuestion(
    question: Omit<Question, 'id' | 'status' | 'createdAt' | 'viewedByStudent' | 'satisfactionStatus'>
  ): Promise<string> {
    try {
      let extractedText = '';
      
      if (question.imageUrl) {
        console.log('🖼️ Image detected, starting OCR...');
        extractedText = await this.extractTextFromImage(question.imageUrl);
        console.log('📄 Final extracted text length:', extractedText.length);
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
        if (cleanQuestion[key] === undefined) {
          delete cleanQuestion[key];
        }
      });

      const docRef = await addDoc(collection(db, 'questions'), cleanQuestion);
      console.log('✅ Question saved with ID:', docRef.id);
      return docRef.id;
    } catch (error: any) {
      console.error('❌ Failed to ask question:', error);
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

  // FIXED: Jaccard Similarity with proper text cleaning
  calculateJaccardSimilarity(text1: string, text2: string): number {
    const clean1 = this.cleanOCRText(text1);
    const clean2 = this.cleanOCRText(text2);
    
    if (!clean1 || !clean2) return 0;
    if (clean1 === clean2) return 1.0;

    const words1 = clean1.split(/\s+/).filter(w => w.length > 0);
    const words2 = clean2.split(/\s+/).filter(w => w.length > 0);
    
    if (words1.length === 0 || words2.length === 0) return 0;

    const set1 = new Set(words1);
    const set2 = new Set(words2);

    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    const score = intersection.size / union.size;
    console.log(`🔹 Jaccard: ${score.toFixed(3)} (${intersection.size}/${union.size})`);
    return score;
  },

  // FIXED: N-gram Similarity with proper text cleaning
  calculateNgramSimilarity(text1: string, text2: string, n: number = 2): number {
    const clean1 = this.cleanOCRText(text1);
    const clean2 = this.cleanOCRText(text2);
    
    if (!clean1 || !clean2) return 0;
    if (clean1 === clean2) return 1.0;

    const words1 = clean1.split(/\s+/).filter(w => w.length > 0);
    const words2 = clean2.split(/\s+/).filter(w => w.length > 0);
    
    if (words1.length < n || words2.length < n) return 0;

    const ngrams1 = new Set<string>();
    const ngrams2 = new Set<string>();
    
    for (let i = 0; i <= words1.length - n; i++) {
      ngrams1.add(words1.slice(i, i + n).join(' '));
    }
    
    for (let i = 0; i <= words2.length - n; i++) {
      ngrams2.add(words2.slice(i, i + n).join(' '));
    }

    if (ngrams1.size === 0 || ngrams2.size === 0) return 0;

    const intersection = new Set([...ngrams1].filter(x => ngrams2.has(x)));
    const union = new Set([...ngrams1, ...ngrams2]);

    const score = intersection.size / union.size;
    console.log(`🔹 ${n}-gram: ${score.toFixed(3)} (${intersection.size}/${union.size})`);
    return score;
  },

  // FIXED: Levenshtein Similarity with proper text cleaning
  calculateLevenshteinSimilarity(text1: string, text2: string): number {
    const clean1 = this.cleanOCRText(text1);
    const clean2 = this.cleanOCRText(text2);
    
    if (!clean1 || !clean2) return 0;
    if (clean1 === clean2) return 1.0;

    const matrix: number[][] = [];
    
    for (let i = 0; i <= clean2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= clean1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= clean2.length; i++) {
      for (let j = 1; j <= clean1.length; j++) {
        if (clean2.charAt(i - 1) === clean1.charAt(j - 1)) {
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
    
    const distance = matrix[clean2.length][clean1.length];
    const maxLength = Math.max(clean1.length, clean2.length);
    
    const score = maxLength === 0 ? 1 : 1 - (distance / maxLength);
    console.log(`🔹 Levenshtein: ${score.toFixed(3)} (dist=${distance}, max=${maxLength})`);
    return score;
  },

  // FIXED: Cosine Similarity with proper text cleaning
  calculateCosineSimilarity(text1: string, text2: string): number {
    const clean1 = this.cleanOCRText(text1);
    const clean2 = this.cleanOCRText(text2);
    
    if (!clean1 || !clean2) return 0;
    if (clean1 === clean2) return 1.0;

    const words1 = clean1.split(/\s+/).filter(w => w.length > 0);
    const words2 = clean2.split(/\s+/).filter(w => w.length > 0);
    
    if (words1.length === 0 || words2.length === 0) return 0;

    const freq1 = new Map<string, number>();
    const freq2 = new Map<string, number>();
    
    words1.forEach(word => {
      freq1.set(word, (freq1.get(word) || 0) + 1);
    });
    
    words2.forEach(word => {
      freq2.set(word, (freq2.get(word) || 0) + 1);
    });

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

    const score = dotProduct / (Math.sqrt(magnitude1) * Math.sqrt(magnitude2));
    console.log(`🔹 Cosine: ${score.toFixed(3)}`);
    return score;
  },

  // FIXED: Combined similarity with robust cleaning
  calculateAdvancedTextSimilarity(text1: string, text2: string): number {
    // Clean both texts first
    const cleanText1 = this.removeInstructionPhrases(text1);
    const cleanText2 = this.removeInstructionPhrases(text2);

    if (!cleanText1 || !cleanText2) return 0;
    if (cleanText1.length < 3 || cleanText2.length < 3) return 0;

    console.log('🔍 Comparing texts:');
    console.log('   Text1:', cleanText1.substring(0, 50));
    console.log('   Text2:', cleanText2.substring(0, 50));

    const jaccardScore = this.calculateJaccardSimilarity(cleanText1, cleanText2);
    const bigramScore = this.calculateNgramSimilarity(cleanText1, cleanText2, 2);
    const trigramScore = this.calculateNgramSimilarity(cleanText1, cleanText2, 3);
    const levenshteinScore = this.calculateLevenshteinSimilarity(cleanText1, cleanText2);
    const cosineScore = this.calculateCosineSimilarity(cleanText1, cleanText2);

    const finalScore = (
      jaccardScore * 0.20 +
      bigramScore * 0.25 +
      trigramScore * 0.20 +
      levenshteinScore * 0.15 +
      cosineScore * 0.20
    );

    console.log(`✅ Final Score: ${finalScore.toFixed(3)}`);
    return finalScore;
  },

  extractImageBaseName(imageUrl: string): string {
    try {
      const parts = imageUrl.split('/');
      const filename = parts[parts.length - 1];
      const baseName = filename.split('?')[0].toLowerCase();
      return baseName
        .replace(/\.(jpg|jpeg|png|gif|webp)$/i, '')
        .replace(/[_-]/g, ' ')
        .trim();
    } catch {
      return '';
    }
  },

  async calculateImageSimilarity(
    imageUrl1?: string, 
    imageUrl2?: string,
    extractedText1?: string,
    extractedText2?: string
  ): Promise<number> {
    if (!imageUrl1 && !imageUrl2) return 0;
    if (!imageUrl1 || !imageUrl2) return 0;
    if (imageUrl1 === imageUrl2) return 1.0;

    console.log('🖼️ Calculating image similarity...');
    console.log('📝 OCR1 length:', extractedText1?.length || 0);
    console.log('📝 OCR2 length:', extractedText2?.length || 0);

    let totalScore = 0;
    let weightSum = 0;

    // Filename similarity (low weight)
    const name1 = this.extractImageBaseName(imageUrl1);
    const name2 = this.extractImageBaseName(imageUrl2);

    if (name1 && name2 && name1.length > 3 && name2.length > 3) {
      const filenameSimilarity = name1 === name2 ? 0.95 : this.calculateAdvancedTextSimilarity(name1, name2);
      totalScore += filenameSimilarity * 0.10;
      weightSum += 0.10;
      console.log(`📁 Filename similarity: ${filenameSimilarity.toFixed(3)}`);
    }

    // OCR text similarity (HIGHEST weight)
    if (extractedText1 && extractedText2) {
      const clean1 = this.cleanOCRText(extractedText1);
      const clean2 = this.cleanOCRText(extractedText2);
      
      console.log('🧹 Cleaned OCR1:', clean1.substring(0, 50));
      console.log('🧹 Cleaned OCR2:', clean2.substring(0, 50));
      
      if (clean1.length > 5 && clean2.length > 5) {
        const ocrSimilarity = this.calculateAdvancedTextSimilarity(clean1, clean2);
        totalScore += ocrSimilarity * 0.90;
        weightSum += 0.90;
        console.log(`📊 OCR similarity: ${ocrSimilarity.toFixed(3)}`);
      }
    }

    const finalScore = weightSum > 0 ? totalScore / weightSum : 0;
    console.log(`✅ Final image score: ${finalScore.toFixed(3)}`);
    return finalScore;
  },

  async findSimilarQuestions(
    questionText: string,
    subject: string,
    currentQuestionId?: string,
    imageUrl?: string,
    courseId?: string
  ): Promise<Question[]> {
    try {
      console.log('\n🔍 === FINDING SIMILAR QUESTIONS ===');
      console.log('📚 Subject:', subject);
      console.log('🖼️ Has image:', !!imageUrl);
      
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

      console.log('📊 Total answered questions:', allQuestions.length);

      const questionsToSearch = currentQuestionId 
        ? allQuestions.filter(q => q.id !== currentQuestionId)
        : allQuestions;

      // Extract OCR text from current image
      let currentImageText = '';
      if (imageUrl) {
        console.log('🖼️ Extracting OCR from current question image...');
        currentImageText = await this.extractTextFromImage(imageUrl);
        console.log('📝 Current OCR length:', currentImageText.length);
      }

      const cleanedQuestionText = this.removeInstructionPhrases(questionText);
      console.log('🧹 Cleaned question:', cleanedQuestionText.substring(0, 50));

      const scoredQuestions = await Promise.all(
        questionsToSearch.map(async (q) => {
          console.log(`\n--- Comparing with Q: ${q.id.substring(0, 8)} ---`);
          
          const cleanedStoredText = this.removeInstructionPhrases(q.questionText);
          const textSimilarity = this.calculateAdvancedTextSimilarity(cleanedQuestionText, cleanedStoredText);
          
          let imageSimilarity = 0;
          if (imageUrl && q.imageUrl) {
            imageSimilarity = await this.calculateImageSimilarity(
              imageUrl, 
              q.imageUrl,
              currentImageText,
              q.extractedText
            );
          } else if (!imageUrl && !q.imageUrl) {
            imageSimilarity = 0.05;
          }

          // Cross-comparisons
          let ocrToQuestionSimilarity = 0;
          if (currentImageText && q.questionText) {
            const cleanedOCR = this.removeInstructionPhrases(currentImageText);
            ocrToQuestionSimilarity = this.calculateAdvancedTextSimilarity(cleanedOCR, cleanedStoredText);
          }

          let questionToOCRSimilarity = 0;
          if (cleanedQuestionText && q.extractedText) {
            const cleanedStoredOCR = this.removeInstructionPhrases(q.extractedText);
            questionToOCRSimilarity = this.calculateAdvancedTextSimilarity(cleanedQuestionText, cleanedStoredOCR);
          }

          const finalScore = (
            imageSimilarity * 0.50 +
            textSimilarity * 0.25 +
            ocrToQuestionSimilarity * 0.15 +
            questionToOCRSimilarity * 0.10
          );
          
          console.log(`📊 Scores: Overall=${finalScore.toFixed(3)}, Image=${imageSimilarity.toFixed(3)}, Text=${textSimilarity.toFixed(3)}`);
          
          return { 
            question: q, 
            score: finalScore,
            textScore: textSimilarity,
            imageScore: imageSimilarity,
            ocrToQuestionScore: ocrToQuestionSimilarity,
            questionToOCRScore: questionToOCRSimilarity
          };
        })
      );

      const similarQuestions = scoredQuestions
        .filter(item => {
          if (item.imageScore > 0.4) {
            return item.score >= 0.40;
          }
          return item.score >= 0.50;
        })
        .sort((a, b) => {
          if (Math.abs(a.imageScore - b.imageScore) > 0.15) {
            return b.imageScore - a.imageScore;
          }
          return b.score - a.score;
        })
        .slice(0, 5)
        .map(item => {
          console.log(`\n✅ SIMILAR FOUND: Q=${item.question.id.substring(0, 8)}, Score=${item.score.toFixed(3)}, Image=${item.imageScore.toFixed(3)}, Text=${item.textScore.toFixed(3)}`);
          return item.question;
        });

      console.log(`\n📊 === TOTAL SIMILAR: ${similarQuestions.length} ===\n`);
      return similarQuestions;
    } catch (error: any) {
      console.error('❌ Error finding similar questions:', error);
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
      const question = await this.getQuestionById(id);
      if (question) {
        await this.deleteAttachments(question);
      }
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
// src/services/qaService.ts - Part 2 of 2 (Remaining Functions - PASTE AFTER PART 1)

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
      const relatedNotifications = allNotifications.docs.filter(
        doc => doc.data().questionId === questionId
      );
      for (const notif of relatedNotifications) {
        await this.deleteNotification(notif.id);
      }

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

  async getAiConversationContext(questionId: string): Promise<{
    originalQuestion: string;
    previousAnswers: string[];
  }> {
    try {
      console.log('🔍 Getting AI conversation context for:', questionId);
      
      const question = await this.getQuestionById(questionId);
      if (!question) {
        return { originalQuestion: '', previousAnswers: [] };
      }

      const answers = await this.getAnswersForQuestion(questionId);
      const aiAnswers = answers
        .filter(a => a.type === 'ai')
        .map(a => a.answerText);

      console.log('📝 Context: Q + ', aiAnswers.length, 'AI answers');

      return {
        originalQuestion: question.questionText,
        previousAnswers: aiAnswers,
      };
    } catch (error: any) {
      console.error('❌ Failed to get conversation context:', error);
      return { originalQuestion: '', previousAnswers: [] };
    }
  },
};
