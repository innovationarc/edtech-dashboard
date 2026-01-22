// src/services/qaService.ts - Part 1 of 2 (Enhanced with Working OCR & Advanced Similarity Detection)
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
  extractedText?: string; // OCR extracted text from image
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

  // OCR: Extract text from image using Tesseract.js (client-side) - IMPROVED VERSION
  async extractTextFromImage(imageUrl: string): Promise<string> {
    try {
      console.log('🔍 Starting OCR extraction from image:', imageUrl);
      
      // Create a worker for better performance and control
      const worker = await Tesseract.createWorker('eng+ben', 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            console.log(`📊 OCR Progress: ${Math.round(m.progress * 100)}%`);
          }
        }
      });

      try {
        // Perform OCR with optimized settings
        const { data } = await worker.recognize(imageUrl, {
          rotateAuto: true,
          // Improve accuracy with preprocessing
        });

        const extractedText = data.text.trim();
        console.log('✅ OCR extraction complete. Text length:', extractedText.length);
        console.log('📝 Extracted preview:', extractedText.substring(0, 200));
        
        return extractedText || '';
      } finally {
        // Always terminate the worker to free memory
        await worker.terminate();
      }
    } catch (error) {
      console.error('❌ Failed to extract text from image using Tesseract:', error);
      return '';
    }
  },

  // Remove common instruction phrases that don't help with similarity
  removeInstructionPhrases(text: string): string {
    const instructionPatterns = [
      // English patterns
      /\b(solve|answer|help|explain|find|calculate|show|prove|verify|check|determine)\s+(it|this|that|the\s+problem|the\s+question)\b/gi,
      /\b(please\s+)?(solve|answer|help|explain|find|calculate|show|prove|verify|check|determine)\b/gi,
      /\b(can\s+you|could\s+you|will\s+you|would\s+you)\s+(solve|answer|help|explain|find|calculate|show|prove|verify|check|determine)/gi,
      
      // Bengali/Banglish patterns
      /\b(solve|answer)\s+(koro|kore\s+do|kore\s+den|kore\s+dao|korte\s+paro|korte\s+parben)\b/gi,
      /\b(ki\s+hobe|answer\s+ki|solve\s+koro|solve\s+kore|answer\s+dao|answer\s+den)\b/gi,
      /\b(eta|ata|ti|ta)\s+(solve|answer|koro|dao|den)\b/gi,
      /\bkivabe\s+(solve|korbo|hobe)\b/gi,
      
      // Common filler phrases
      /\b(urgently|asap|quickly|fast|please|pls|plz)\b/gi,
      /[?!]+$/g, // Remove trailing question marks and exclamation points
    ];

    let cleanedText = text;
    
    instructionPatterns.forEach(pattern => {
      cleanedText = cleanedText.replace(pattern, ' ');
    });

    // Clean up extra whitespace
    cleanedText = cleanedText.replace(/\s+/g, ' ').trim();
    
    return cleanedText;
  },

  async askQuestion(
    question: Omit<Question, 'id' | 'status' | 'createdAt' | 'viewedByStudent' | 'satisfactionStatus'>
  ): Promise<string> {
    try {
      let extractedText = '';
      
      // Extract text from image if present
      if (question.imageUrl) {
        console.log('🖼️ Image URL provided, extracting text...');
        extractedText = await this.extractTextFromImage(question.imageUrl);
        console.log('📄 Extracted text length:', extractedText.length);
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

  calculateAdvancedTextSimilarity(text1: string, text2: string): number {
    // Remove instruction phrases before comparison
    const cleanText1 = this.removeInstructionPhrases(text1);
    const cleanText2 = this.removeInstructionPhrases(text2);

    // If after cleaning, texts are too short, return 0
    if (cleanText1.length < 5 || cleanText2.length < 5) {
      return 0;
    }

    const jaccardScore = this.calculateJaccardSimilarity(cleanText1, cleanText2);
    const bigramScore = this.calculateNgramSimilarity(cleanText1, cleanText2, 2);
    const trigramScore = this.calculateNgramSimilarity(cleanText1, cleanText2, 3);
    const levenshteinScore = this.calculateLevenshteinSimilarity(cleanText1, cleanText2);
    const cosineScore = this.calculateCosineSimilarity(cleanText1, cleanText2);

    // Weighted average with emphasis on n-gram and cosine similarity
    return (
      jaccardScore * 0.20 +
      bigramScore * 0.25 +
      trigramScore * 0.20 +
      levenshteinScore * 0.15 +
      cosineScore * 0.20
    );
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

    console.log('🔍 Calculating image similarity...');
    console.log('📝 OCR Text 1 length:', extractedText1?.length || 0);
    console.log('📝 OCR Text 2 length:', extractedText2?.length || 0);

    let totalScore = 0;
    let weightSum = 0;

    // 1. Filename similarity (weight: 0.15) - Lower priority
    const name1 = this.extractImageBaseName(imageUrl1);
    const name2 = this.extractImageBaseName(imageUrl2);

    if (name1 && name2) {
      if (name1 === name2) {
        totalScore += 0.95 * 0.15;
      } else {
        const filenameSimilarity = this.calculateAdvancedTextSimilarity(name1, name2);
        totalScore += filenameSimilarity * 0.15;
      }
      weightSum += 0.15;
    }

    // 2. OCR text similarity (weight: 0.85) - HIGHEST priority for academic content
    if (extractedText1 && extractedText2) {
      // Clean OCR text from instruction phrases
      const cleanOCR1 = this.removeInstructionPhrases(extractedText1);
      const cleanOCR2 = this.removeInstructionPhrases(extractedText2);
      
      console.log('🧹 Cleaned OCR Text 1 length:', cleanOCR1.length);
      console.log('🧹 Cleaned OCR Text 2 length:', cleanOCR2.length);
      
      if (cleanOCR1.length > 10 && cleanOCR2.length > 10) {
        const ocrSimilarity = this.calculateAdvancedTextSimilarity(cleanOCR1, cleanOCR2);
        console.log('📊 OCR Similarity Score:', ocrSimilarity.toFixed(3));
        totalScore += ocrSimilarity * 0.85;
        weightSum += 0.85;
      }
    } else if (!extractedText1 && !extractedText2) {
      // If both images have no text, rely more on filename
      weightSum = 1.0; // Normalize the filename weight
    }

    // Normalize score
    const finalScore = weightSum > 0 ? totalScore / weightSum : 0;
    console.log('✅ Final Image Similarity Score:', finalScore.toFixed(3));

    return finalScore;
  },

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
      
      setTimeout(() => resolve(null), 3000);
    });
  },

  async findSimilarQuestions(
    questionText: string,
    subject: string,
    currentQuestionId?: string,
    imageUrl?: string,
    courseId?: string
  ): Promise<Question[]> {
    try {
      console.log('🔍 Finding similar questions...');
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

      console.log('📊 Total questions found:', allQuestions.length);

      const questionsToSearch = currentQuestionId 
        ? allQuestions.filter(q => q.id !== currentQuestionId)
        : allQuestions;

      // Extract text from current image if present
      let currentImageText = '';
      if (imageUrl) {
        console.log('🖼️ Extracting text from current image...');
        currentImageText = await this.extractTextFromImage(imageUrl);
        console.log('📝 Current image text length:', currentImageText.length);
      }

      // Clean the question text from instruction phrases
      const cleanedQuestionText = this.removeInstructionPhrases(questionText);

      const scoredQuestions = await Promise.all(
        questionsToSearch.map(async (q) => {
          // Clean the stored question text
          const cleanedStoredText = this.removeInstructionPhrases(q.questionText);
          
          // Calculate text similarity with cleaned texts
          const textSimilarity = this.calculateAdvancedTextSimilarity(
            cleanedQuestionText,
            cleanedStoredText
          );
          
          let imageSimilarity = 0;
          if (imageUrl && q.imageUrl) {
            // Use extracted text for comparison - HIGHEST PRIORITY
            imageSimilarity = await this.calculateImageSimilarity(
              imageUrl, 
              q.imageUrl,
              currentImageText,
              q.extractedText
            );
          } else if (!imageUrl && !q.imageUrl) {
            // Small boost if both don't have images (text-only questions)
            imageSimilarity = 0.05;
          }

          // If OCR text is available, also compare it with question text
          let ocrToQuestionSimilarity = 0;
          if (currentImageText && q.questionText) {
            const cleanedOCR = this.removeInstructionPhrases(currentImageText);
            ocrToQuestionSimilarity = this.calculateAdvancedTextSimilarity(
              cleanedOCR,
              cleanedStoredText
            );
          }

          // Cross-comparison: current question text vs stored OCR text
          let questionToOCRSimilarity = 0;
          if (cleanedQuestionText && q.extractedText) {
            const cleanedStoredOCR = this.removeInstructionPhrases(q.extractedText);
            questionToOCRSimilarity = this.calculateAdvancedTextSimilarity(
              cleanedQuestionText,
              cleanedStoredOCR
            );
          }

          // **CRITICAL: Image similarity gets HIGHEST weight**
          // Priority order: Image OCR > Question Text > Cross-comparisons
          const finalScore = (
            imageSimilarity * 0.50 +           // Image OCR text similarity - HIGHEST
            textSimilarity * 0.25 +             // Question text similarity
            ocrToQuestionSimilarity * 0.15 +    // Current OCR vs stored question
            questionToOCRSimilarity * 0.10      // Current question vs stored OCR
          );
          
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

      // Filter and sort with higher threshold for image-based matches
      const similarQuestions = scoredQuestions
        .filter(item => {
          // If images are present, require higher overall score
          if (item.imageScore > 0.3) {
            return item.score >= 0.45; // Lower threshold if good image match
          }
          // For text-only, require higher text similarity
          return item.score >= 0.55;
        })
        .sort((a, b) => {
          // Prioritize image similarity in sorting
          if (Math.abs(a.imageScore - b.imageScore) > 0.1) {
            return b.imageScore - a.imageScore;
          }
          // Then by overall score
          return b.score - a.score;
        })
        .slice(0, 5)
        .map(item => {
          console.log(`✅ Similar Q Found - Overall: ${item.score.toFixed(3)}, Image: ${item.imageScore.toFixed(3)}, Text: ${item.textScore.toFixed(3)}`);
          return item.question;
        });

      console.log('📊 Total similar questions found:', similarQuestions.length);
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
// src/services/qaService.ts - Part 2 of 2 (Remaining Functions with All Features Intact)
// PASTE THIS IMMEDIATELY AFTER PART 1

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
      // Get the question first to delete its attachments
      const question = await this.getQuestionById(questionId);
      
      // Delete all answers and their attachments
      const answers = await this.getAnswersForQuestion(questionId);
      for (const answer of answers) {
        await this.deleteAnswer(answer.id); // This will also delete answer attachments
        
        // Delete answer ratings
        try {
          await deleteDoc(doc(db, 'answer_ratings', `${questionId}_${answer.id}`));
        } catch (err) {
          // Rating might not exist
        }
      }

      // Delete all follow-up questions recursively
      const followUps = await this.getFollowUpQuestions(questionId);
      for (const followUp of followUps) {
        await this.deleteQuestionWithRelatedData(followUp.id);
      }

      // Delete related notifications
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

      // Delete the question (this will also delete its attachments via deleteQuestion method)
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
      
      // Delete all questions and their attachments
      const deletionPromises = querySnapshot.docs.map(doc => 
        this.deleteQuestionWithRelatedData(doc.id)
      );
      
      await Promise.all(deletionPromises);
    } catch (error: any) {
      throw new Error(`Failed to delete questions by course: ${error.message}`);
    }
  },

  // NEW: Get conversation context for AI follow-up questions
  async getAiConversationContext(questionId: string): Promise<{
    originalQuestion: string;
    previousAnswers: string[];
  }> {
    try {
      console.log('🔍 Getting AI conversation context for question:', questionId);
      
      const question = await this.getQuestionById(questionId);
      if (!question) {
        return { originalQuestion: '', previousAnswers: [] };
      }

      const answers = await this.getAnswersForQuestion(questionId);
      const aiAnswers = answers
        .filter(a => a.type === 'ai')
        .map(a => a.answerText);

      console.log('📝 Original question:', question.questionText.substring(0, 100));
      console.log('💬 Previous AI answers count:', aiAnswers.length);

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
