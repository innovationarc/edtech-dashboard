// src/pages/StudentQA.tsx - Part 1 of 2 (Updated with Voice, LaTeX, and Similar Questions)
import { useState, useEffect } from 'react';
import { Plus, Search, Loader, AlertCircle, BookOpen, User, MessageSquare, X, Brain, Bell, FileText, Filter, ThumbsUp, HelpCircle, Mic, Volume2, Eye, Send } from 'lucide-react';
import Card from '../components/ui/Card';
import { useDashboard } from '../contexts/DashboardContext';
import { qaService, Question } from '../services/qaService';
import { courseService, Course } from '../services/courseService';
import { useNavigate } from 'react-router-dom';
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';

const StudentQA = () => {
  const { user } = useDashboard();
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAskQuestionModal, setShowAskQuestionModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [selectedCourse, setSelectedCourse] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'pending' | 'answered'>('all');
  const [questionFilter, setQuestionFilter] = useState<'my' | 'others' | 'all'>('all');
  const [unreadCount, setUnreadCount] = useState(0);
  const [enrolledCoursesWithQnA, setEnrolledCoursesWithQnA] = useState<Course[]>([]);
  const [availableSubjects, setAvailableSubjects] = useState<string[]>([]);

  const helpSupportSubjects = [
    'System related problems',
    'Course related problems',
    'Others'
  ];

  useEffect(() => {
    loadEnrolledCoursesWithQnA();
  }, []);

  useEffect(() => {
    loadQuestions();
    loadNotifications();
    
    const unsubscribe = qaService.onNewNotifications(user?.uid || '', (notifications) => {
      setUnreadCount(notifications.length);
      if (notifications.length > 0 && (window as any).addNotification) {
        (window as any).addNotification(notifications[0].message, 'info');
      }
    });

    return () => unsubscribe();
  }, [selectedSubject, selectedCourse, selectedStatus, questionFilter]);

  useEffect(() => {
    updateAvailableSubjects();
  }, [selectedCourse, enrolledCoursesWithQnA]);

  const loadEnrolledCoursesWithQnA = async () => {
    try {
      const enrollments = await courseService.getStudentEnrollments(user?.uid || '');
      const enrolledCourses = await Promise.all(
        enrollments.map(async (enrollment) => {
          const course = await courseService.getCourseById(enrollment.courseId);
          return course;
        })
      );
      const coursesWithQnA = enrolledCourses.filter(
        (course): course is Course => course !== null && course.hasQnA === true
      );
      setEnrolledCoursesWithQnA(coursesWithQnA);
    } catch (err) {
      console.error('Failed to load enrolled courses:', err);
    }
  };

  const updateAvailableSubjects = () => {
    if (selectedCourse === 'all') {
      const allSubjects = new Set<string>();
      enrolledCoursesWithQnA.forEach(course => {
        course.subjects.forEach(subject => allSubjects.add(subject));
      });
      helpSupportSubjects.forEach(subject => allSubjects.add(subject));
      setAvailableSubjects(Array.from(allSubjects));
    } else if (selectedCourse === 'help-support') {
      setAvailableSubjects(helpSupportSubjects);
    } else {
      const selectedCourseData = enrolledCoursesWithQnA.find(c => c.id === selectedCourse);
      if (selectedCourseData) {
        setAvailableSubjects(selectedCourseData.subjects);
      } else {
        setAvailableSubjects([]);
      }
    }
  };

  const loadQuestions = async () => {
    setLoading(true);
    setError('');
    try {
      let fetchedQuestions = await qaService.getQuestions(selectedSubject, selectedStatus);
      if (selectedCourse !== 'all') {
        if (selectedCourse === 'help-support') {
          fetchedQuestions = fetchedQuestions.filter(q => q.courseId === 'help-support');
        } else {
          fetchedQuestions = fetchedQuestions.filter(q => q.courseId === selectedCourse);
        }
      }
      setQuestions(fetchedQuestions);
    } catch (err: any) {
      setError('Failed to load questions: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadNotifications = async () => {
    try {
      const notifications = await qaService.getNotifications(user?.uid || '');
      const unread = notifications.filter(n => !n.read);
      setUnreadCount(unread.length);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    }
  };

  const handleAskQuestionSuccess = () => {
    loadQuestions();
    setShowAskQuestionModal(false);
    if ((window as any).addNotification) {
      (window as any).addNotification('Your question has been submitted!', 'success');
    }
  };

  const handleQuestionClick = async (question: Question) => {
    if (question.studentId === user?.uid && question.status === 'answered' && !question.viewedByStudent) {
      await qaService.markQuestionAsViewed(question.id);
      const notifications = await qaService.getNotifications(user?.uid || '');
      const relatedNotif = notifications.find(n => n.questionId === question.id && !n.read);
      if (relatedNotif) {
        await qaService.markNotificationAsRead(relatedNotif.id);
        loadNotifications();
      }
    }
    navigate(`/question/${question.id}`);
  };

  const filteredQuestions = questions.filter(q => {
    const matchesSearch = q.questionText.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          q.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          q.subject.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = 
      questionFilter === 'all' ? true :
      questionFilter === 'my' ? q.studentId === user?.uid :
      q.studentId !== user?.uid;
    return matchesSearch && matchesFilter;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader size={32} className="animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Ask a Question</h1>
          <p className="text-gray-400 mt-1">Get help from teachers, AI, and peers</p>
        </div>
        <div className="flex items-center gap-3">
          {unreadCount > 0 && (
            <div className="relative">
              <Bell size={20} className="text-primary-400" />
              <span className="absolute -top-1 -right-1 bg-error-light text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                {unreadCount}
              </span>
            </div>
          )}
          <button
            onClick={() => setShowAskQuestionModal(true)}
            className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg transition-colors shadow-lg hover:shadow-xl"
          >
            <Plus size={20} />
            <span>Ask New Question</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-error-dark text-error-light px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      <Card>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <input
              type="text"
              placeholder="Search questions..."
              className="w-full bg-background-800 text-white rounded-lg py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-primary-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Search size={18} className="absolute left-3 top-2.5 text-gray-400" />
          </div>

          <div className="flex gap-3 flex-wrap">
            <select
              value={questionFilter}
              onChange={(e) => setQuestionFilter(e.target.value as 'my' | 'others' | 'all')}
              className="bg-background-800 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="all">All Questions</option>
              <option value="my">My Questions</option>
              <option value="others">Others' Questions</option>
            </select>

            <select
              value={selectedCourse}
              onChange={(e) => setSelectedCourse(e.target.value)}
              className="bg-background-800 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="all">All Courses</option>
              <option value="help-support">🆘 Help & Support</option>
              {enrolledCoursesWithQnA.length === 0 ? (
                <option disabled>You don't have any courses with Q&A enabled</option>
              ) : (
                enrolledCoursesWithQnA.map(course => (
                  <option key={course.id} value={course.id}>{course.title}</option>
                ))
              )}
            </select>

            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="bg-background-800 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="all">All Subjects</option>
              {availableSubjects.map(subject => (
                <option key={subject} value={subject}>{subject}</option>
              ))}
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as 'all' | 'pending' | 'answered')}
              className="bg-background-800 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="answered">Answered</option>
            </select>
          </div>
        </div>

        <div className="space-y-4">
          {filteredQuestions.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <MessageSquare size={48} className="mx-auto mb-4" />
              <p>No questions found. Be the first to ask!</p>
            </div>
          ) : (
            filteredQuestions.map(question => (
              <div
                key={question.id}
                className={`bg-background-800 rounded-lg p-4 cursor-pointer hover:bg-background-700 transition-colors ${
                  question.studentId === user?.uid && question.status === 'answered' && !question.viewedByStudent 
                    ? 'ring-2 ring-primary-500' 
                    : ''
                }`}
                onClick={() => handleQuestionClick(question)}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <BookOpen size={16} className="text-primary-400" />
                    <span className="text-sm font-medium text-white">{question.subject}</span>
                    {question.studentId === user?.uid && (
                      <span className="text-xs text-primary-400 bg-primary-900 px-2 py-0.5 rounded">You</span>
                    )}
                    {question.isFollowUp && (
                      <span className="text-xs text-orange-400 bg-orange-900 px-2 py-0.5 rounded">Follow-up</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {question.status === 'answered' && question.answeredBy && (
                      <span className={`text-xs px-2 py-1 rounded ${
                        question.answeredBy === 'ai' 
                          ? 'bg-purple-900 text-purple-300' 
                          : 'bg-blue-900 text-blue-300'
                      }`}>
                        {question.answeredBy === 'ai' ? '🤖 AI' : '👨‍🏫 Teacher'}
                      </span>
                    )}
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      question.status === 'pending' 
                        ? 'bg-warning-dark text-warning-light' 
                        : 'bg-success-dark text-success-light'
                    }`}>
                      {question.status === 'pending' ? 'Pending' : 'Answered'}
                    </span>
                    {question.studentId === user?.uid && question.status === 'answered' && !question.viewedByStudent && (
                      <span className="w-2 h-2 bg-primary-500 rounded-full"></span>
                    )}
                  </div>
                </div>
                <h3 className="text-lg font-medium text-white mb-2 line-clamp-2">{question.questionText}</h3>
                {question.imageUrl && (
                  <img src={question.imageUrl} alt="Question attachment" className="max-h-40 object-contain rounded-lg mb-2" />
                )}
                {question.audioUrl && (
                  <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
                    <Volume2 size={14} />
                    <span>Voice message attached</span>
                  </div>
                )}
                {question.fileName && (
                  <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
                    <FileText size={14} />
                    <span>{question.fileName}</span>
                  </div>
                )}
                <div className="flex items-center gap-3 text-sm text-gray-400">
                  <div className="flex items-center gap-1">
                    <User size={14} />
                    <span>{question.studentName}</span>
                  </div>
                  <span>•</span>
                  <span>{question.createdAt.toLocaleDateString()}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {showAskQuestionModal && (
        <AskQuestionModal
          onClose={() => setShowAskQuestionModal(false)}
          onSuccess={handleAskQuestionSuccess}
          studentId={user?.uid || ''}
          studentName={user?.name || 'Student'}
          enrolledCoursesWithQnA={enrolledCoursesWithQnA}
          helpSupportSubjects={helpSupportSubjects}
        />
      )}
    </div>
  );
};

// src/pages/StudentQA.tsx - Part 2A of 2 (First Half)
// PASTE THIS IMMEDIATELY AFTER PART 1

interface AskQuestionModalProps {
  onClose: () => void;
  onSuccess: () => void;
  studentId: string;
  studentName: string;
  enrolledCoursesWithQnA: Course[];
  helpSupportSubjects: string[];
}

// Helper function to render formatted text with LaTeX
const renderFormattedText = (text: string) => {
  if (!text) return null;

  // Split by block math ($$...$$)
  const blockMathRegex = /\$\$([\s\S]*?)\$\$/g;
  const parts = text.split(blockMathRegex);
  
  return parts.map((part, index) => {
    if (index % 2 === 1) {
      // This is LaTeX block math
      try {
        return <BlockMath key={index} math={part} />;
      } catch (e) {
        return <span key={index} className="text-error-light">{part}</span>;
      }
    } else {
      // Process inline math ($...$) in non-math parts
      const inlineMathRegex = /\$([^\$]+)\$/g;
      const inlineParts = part.split(inlineMathRegex);
      
      return inlineParts.map((inlinePart, inlineIndex) => {
        if (inlineIndex % 2 === 1) {
          // This is inline LaTeX
          try {
            return <InlineMath key={`${index}-${inlineIndex}`} math={inlinePart} />;
          } catch (e) {
            return <span key={`${index}-${inlineIndex}`} className="text-error-light">{inlinePart}</span>;
          }
        } else {
          // Regular text - preserve newlines and basic formatting
          return inlinePart.split('\n').map((line, lineIndex) => (
            <span key={`${index}-${inlineIndex}-${lineIndex}`}>
              {line}
              {lineIndex < inlinePart.split('\n').length - 1 && <br />}
            </span>
          ));
        }
      });
    }
  });
};

const AskQuestionModal = ({ onClose, onSuccess, studentId, studentName, enrolledCoursesWithQnA, helpSupportSubjects }: AskQuestionModalProps) => {
  const [questionText, setQuestionText] = useState('');
  const [subject, setSubject] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('');
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showAiSolution, setShowAiSolution] = useState(false);
  const [showSimilarQuestions, setShowSimilarQuestions] = useState(false);
  const [similarQuestions, setSimilarQuestions] = useState<Question[]>([]);
  const [aiSolutions, setAiSolutions] = useState<string[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiQuestionId, setAiQuestionId] = useState<string | null>(null);
  const [showFollowUpInput, setShowFollowUpInput] = useState(false);
  const [followUpText, setFollowUpText] = useState('');
  const [availableSubjects, setAvailableSubjects] = useState<string[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);

  const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
  const MODEL = 'gemini-2.0-flash-exp';

  const isHelpSupport = selectedCourse === 'help-support';

  useEffect(() => {
    updateAvailableSubjects();
  }, [selectedCourse]);

  const updateAvailableSubjects = () => {
    if (selectedCourse === 'help-support') {
      setAvailableSubjects(helpSupportSubjects);
    } else if (selectedCourse) {
      const course = enrolledCoursesWithQnA.find(c => c.id === selectedCourse);
      if (course) {
        setAvailableSubjects(course.subjects);
      } else {
        setAvailableSubjects([]);
      }
    } else {
      const allSubjects = new Set<string>();
      enrolledCoursesWithQnA.forEach(course => {
        course.subjects.forEach(subject => allSubjects.add(subject));
      });
      helpSupportSubjects.forEach(subject => allSubjects.add(subject));
      setAvailableSubjects(Array.from(allSubjects));
    }
    setSubject('');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const allowedTypes = [
        'image/jpeg', 
        'image/jpg', 
        'image/png', 
        'image/heic',
        'application/pdf', 
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 
        'application/msword'
      ];
      
      if (!allowedTypes.includes(file.type)) {
        setError('Please select a valid file (JPG, JPEG, PNG, HEIC, PDF, or DOCX)');
        return;
      }
      
      if (file.size > 10 * 1024 * 1024) {
        setError('File size must be less than 10MB');
        return;
      }
      
      setAttachedFile(file);
      setError('');
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        const audioFileObj = new File([audioBlob], `audio_${Date.now()}.webm`, { type: 'audio/webm' });
        setAudioFile(audioFileObj);
        stream.getTracks().forEach(track => track.stop());
      };

      setMediaRecorder(recorder);
      recorder.start();
      setIsRecording(true);
    } catch (err) {
      setError('Failed to start recording. Please check microphone permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
    }
  };

  const getFileType = (file: File): 'image' | 'document' | 'audio' => {
    if (file.type.startsWith('image/')) {
      return 'image';
    }
    if (file.type.startsWith('audio/')) {
      return 'audio';
    }
    return 'document';
  };

  const convertFileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onloadend = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
    });
  };

  const getMimeType = (file: File): string => {
    const mimeTypes: { [key: string]: string } = {
      'image/jpeg': 'image/jpeg',
      'image/jpg': 'image/jpeg',
      'image/png': 'image/png',
      'image/heic': 'image/heic',
      'application/pdf': 'application/pdf',
    };
    return mimeTypes[file.type] || 'image/jpeg';
  };

  const detectLanguage = (text: string): 'bengali' | 'english' | 'banglish' => {
    const bengaliPattern = /[\u0980-\u09FF]/;
    const banglishPattern = /\b(keno|karon|tumi|ami|kothay|kivabe|kobe|ke|ki|ache|hobe|kora|kore|korte|jai|jay|jabe|jabo|chile|chilo|chilam|thake|thaki|thakbo|thakbe|bole|boli|bolte|bolbo|bolbe|kori|korbo|korbe|hoy|hoye|jabe|geche|gelo|dao|den|debo|dibe)\b/i;
    
    if (bengaliPattern.test(text)) {
      return 'bengali';
    } else if (banglishPattern.test(text)) {
      return 'banglish';
    } else {
      return 'english';
    }
  };

  const handleSubmitToTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!questionText.trim() || !subject || !selectedCourse) {
      setError('Please fill in all required fields.');
      return;
    }

    // Check for similar questions
    const similar = await qaService.findSimilarQuestions(questionText, subject);
    if (similar.length > 0) {
      setSimilarQuestions(similar);
      setShowSimilarQuestions(true);
      setShowAiSolution(false);
      return;
    }

    // No similar questions, proceed with submission
    await submitToTeacher();
  };

  const submitToTeacher = async () => {
    setLoading(true);
    setError('');
    setShowSimilarQuestions(false);

    try {
      let imageUrl: string | undefined;
      let audioUrl: string | undefined;
      let fileUrl: string | undefined;
      let fileName: string | undefined;

      // Upload files to Supabase
      if (attachedFile) {
        const fileType = getFileType(attachedFile);
        const uploadResult = await qaService.uploadToSupabase(
          attachedFile, 
          fileType === 'image' ? 'question_images' : 'question_documents'
        );
        
        if (fileType === 'image') {
          imageUrl = uploadResult.url;
        } else {
          fileUrl = uploadResult.url;
          fileName = attachedFile.name;
        }
      }

      if (audioFile) {
        const uploadResult = await qaService.uploadToSupabase(audioFile, 'question_audio');
        audioUrl = uploadResult.url;
      }

      await qaService.askQuestion({
        studentId,
        studentName,
        subject,
        questionText: questionText.trim(),
        imageUrl,
        audioUrl,
        fileUrl,
        fileName,
        courseId: selectedCourse,
      });

      onSuccess();
    } catch (err: any) {
      setError('Failed to submit question: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const getAiSolution = async (questionToSolve: string, isFollowUp: boolean = false, fileToProcess?: File) => {
    try {
      const knowledgeList = await qaService.getKnowledgeBySubject(subject);
      const knowledgeContext = knowledgeList.length > 0 
        ? `\n\nTeacher's Knowledge Base for ${subject}:\n${knowledgeList.map(k => 
            `Title: ${k.title}\nContent: ${k.content}`
          ).join('\n\n')}`
        : '';

      const language = detectLanguage(questionToSolve);
      const languageInstruction = language === 'bengali' || language === 'banglish'
        ? 'Answer ONLY in Bengali (Bangla script - বাংলা). If the question uses Banglish (Bengali written in English letters like "keno", "kivabe"), convert it to proper Bengali script first, then answer in Bengali.'
        : 'Answer ONLY in English.';

      const previousContext = isFollowUp && aiSolutions.length > 0
        ? `\n\nPrevious conversation:\nOriginal Question: ${questionText}\nPrevious Answer: ${aiSolutions[aiSolutions.length - 1]}\n\n`
        : '';

      const aiPrompt = `You are an expert AI tutor for Bengali (Bangla) education, teaching classes 6–12.

CRITICAL SUBJECT VALIDATION:
- The selected subject is: ${subject}
- If the question is NOT related to ${subject}, respond EXACTLY: "দয়া করে ${subject} বিষয়ের প্রশ্ন করুন। (Please ask questions related to ${subject}.)"
- Do NOT answer questions from other subjects.

LANGUAGE RULE:
${languageInstruction}
- Scientific/technical terms that MUST be in English (like "photosynthesis", "DNA", "Newton's Law", "quadratic equation") should remain in English.
- Use LaTeX for mathematical expressions: inline math with $...$ and display math with $$...$$
- Mathematical symbols and equations use standard LaTeX notation.
- All explanations and steps must be in the target language.

IMAGE GENERATION:
- You CANNOT generate, create, or draw images.
- If asked to generate/create/draw images, respond: "দুঃখিত, আমি ছবি তৈরি করতে পারি না। (Sorry, I cannot generate images.)"

TEACHING METHOD:
${knowledgeContext ? '- IMPORTANT: Use the Teacher\'s Knowledge Base provided above for solving methods and procedures. Follow those exact methods.' : '- Use traditional Bengali school textbook methods (NCERT/NCTB style).'}

ANSWER FORMAT:
1. Provide ONLY:
   - Clear, numbered step-by-step solution (each step short and necessary)
   - Show ALL calculations and work using LaTeX where appropriate
   - End with "চূড়ান্ত উত্তর:" (for Bengali) or "Final answer:" (for English)

2. No greetings, no summaries, no extra commentary.

3. For multi-part problems, label clearly: (ক), (খ), (গ) (for Bengali) or (a), (b), (c) (for English)

${previousContext}Subject: ${subject}
${isFollowUp ? 'Follow-up Question' : 'Question'}: ${questionToSolve}${knowledgeContext}`;

      const contents: any[] = [{
        parts: [{
          text: aiPrompt
        }]
      }];

      // If there's a file to process (image only), add it to the request
      if (fileToProcess && getFileType(fileToProcess) === 'image') {
        const base64Data = await convertFileToBase64(fileToProcess);
        const mimeType = getMimeType(fileToProcess);
        
        contents[0].parts.push({
          inline_data: {
            mime_type: mimeType,
            data: base64Data
          }
        });
      }

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || `API Error (${response.status})`);
      }

      const data = await response.json();
      
      if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
        throw new Error('Invalid response from AI');
      }

      return data.candidates[0].content.parts[0].text;
    } catch (err: any) {
      throw err;
    }
  };

  const handleAiSolve = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!questionText.trim() || !subject || !selectedCourse) {
      setError('Please fill in all required fields.');
      return;
    }

    if (isHelpSupport) {
      setError('AI Solve-mate is not available for Help & Support. Please use Human Teacher.');
      return;
    }

    if (!API_KEY) {
      setError('API key not configured. Please check your .env file.');
      return;
    }

    // Check if file is a document (not image) - AI can't process documents
    if (attachedFile && getFileType(attachedFile) === 'document') {
      setError('AI Solve-mate can only process images (JPG, PNG, HEIC). For PDF/DOCX files, please use Human Teacher.');
      return;
    }

    setAiLoading(true);
    setShowAiSolution(true);
    setShowSimilarQuestions(false);

    try {
      // Pass the file to AI if it's an image
      const solution = await getAiSolution(
        questionText, 
        false, 
        attachedFile && getFileType(attachedFile) === 'image' ? attachedFile : undefined
      );
      setAiSolutions([solution]);

      // Save question to database (without uploading file to Supabase for AI questions)
      const questionId = await qaService.askQuestion({
        studentId,
        studentName,
        subject,
        questionText: questionText.trim(),
        courseId: selectedCourse,
      });

      setAiQuestionId(questionId);

      await qaService.answerQuestion({
        questionId,
        answerText: solution,
        type: 'ai',
      });

    } catch (err: any) {
      setError('Failed to get AI solution: ' + err.message);
      setShowAiSolution(false);
    } finally {
      setAiLoading(false);
    }
  };

  const handleAiSatisfaction = async (status: 'satisfied' | 'confused') => {
    if (!aiQuestionId) return;

    try {
      await qaService.updateSatisfactionStatus(aiQuestionId, status);
      
      if (status === 'satisfied') {
        if ((window as any).addNotification) {
          (window as any).addNotification('Marked as satisfied!', 'success');
        }
        onSuccess();
      } else {
        setShowFollowUpInput(true);
        if ((window as any).addNotification) {
          (window as any).addNotification('Please ask your follow-up question', 'info');
        }
      }
    } catch (err: any) {
      setError('Failed to update status: ' + err.message);
    }
  };

  const handleFollowUpSubmit = async () => {
    if (!followUpText.trim()) {
      setError('Please enter your follow-up question.');
      return;
    }

    setAiLoading(true);
    setError('');

    try {
      const followUpSolution = await getAiSolution(followUpText, true);
      setAiSolutions(prev => [...prev, followUpSolution]);
      setFollowUpText('');
      setShowFollowUpInput(false);
    } catch (err: any) {
      setError('Failed to get AI solution: ' + err.message);
    } finally {
      setAiLoading(false);
    }
  };

  // CONTINUE TO PART 2B...

  // src/pages/StudentQA.tsx - Part 2B of 2 (Second Half)
// PASTE THIS IMMEDIATELY AFTER PART 2A

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-background-900 rounded-xl w-full max-w-6xl my-8 relative">
        <button
          onClick={onClose}
          disabled={loading || aiLoading}
          className="absolute right-4 top-4 text-gray-400 hover:text-white z-10"
        >
          <X size={20} />
        </button>

        <div className="p-6">
          <h2 className="text-2xl font-bold text-white mb-6">Ask a New Question</h2>

          {error && (
            <div className="bg-error-dark text-error-light px-4 py-3 rounded-lg mb-4 flex items-center gap-2">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Course *</label>
                <select
                  value={selectedCourse}
                  onChange={(e) => setSelectedCourse(e.target.value)}
                  className="w-full bg-background-800 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  disabled={loading || aiLoading}
                  required
                >
                  <option value="">Select a course</option>
                  <option value="help-support">Help & Support</option>
                  {enrolledCoursesWithQnA.map(course => (
                    <option key={course.id} value={course.id}>{course.title}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  {enrolledCoursesWithQnA.length === 0 
                    ? 'You can use Help & Support for general queries' 
                    : 'Select course or use Help & Support'}
                </p>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Subject *</label>
                <select
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full bg-background-800 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  disabled={loading || aiLoading || !selectedCourse}
                  required
                >
                  <option value="">Select a subject</option>
                  {availableSubjects.map(sub => (
                    <option key={sub} value={sub}>{sub}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  {!selectedCourse ? 'Please select a course first' : 'Subjects based on selected course'}
                </p>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Your Question *</label>
                <textarea
                  value={questionText}
                  onChange={(e) => setQuestionText(e.target.value)}
                  className="w-full bg-background-800 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Type your question here in Bengali or English... (Supports LaTeX: $x^2$ for inline, $$E=mc^2$$ for display)"
                  rows={6}
                  disabled={loading || aiLoading}
                  required
                ></textarea>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Attach File (Optional)</label>
                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/heic,.pdf,.doc,.docx"
                  onChange={handleFileChange}
                  className="w-full bg-background-800 text-white rounded-lg py-2 px-3 text-sm file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:bg-primary-600 file:text-white file:cursor-pointer"
                  disabled={loading || aiLoading}
                />
                {attachedFile && (
                  <div className="text-sm text-gray-400 mt-1 flex items-center gap-2">
                    <FileText size={14} />
                    <span>{attachedFile.name} ({(attachedFile.size / 1024).toFixed(2)} KB)</span>
                    {getFileType(attachedFile) === 'document' && (
                      <span className="text-xs text-orange-400 ml-2">
                        (AI can't process documents - use Human Teacher)
                      </span>
                    )}
                  </div>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  Human Teacher: All formats (JPG, PNG, HEIC, PDF, DOCX) - Max 10MB<br/>
                  AI Solve-mate: Images only (JPG, PNG, HEIC)
                </p>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Voice Message (Optional)</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={isRecording ? stopRecording : startRecording}
                    disabled={loading || aiLoading}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                      isRecording 
                        ? 'bg-error-dark text-error-light' 
                        : 'bg-background-800 text-white hover:bg-background-700'
                    }`}
                  >
                    {isRecording ? <Volume2 size={16} className="animate-pulse" /> : <Mic size={16} />}
                    <span>{isRecording ? 'Stop Recording' : 'Record Voice'}</span>
                  </button>
                  {audioFile && (
                    <span className="text-sm text-gray-400 flex items-center">
                      Audio recorded ({(audioFile.size / 1024).toFixed(2)} KB)
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-3 pt-4 border-t border-background-800">
                <button
                  onClick={handleSubmitToTeacher}
                  disabled={loading || aiLoading || !selectedCourse}
                  className="w-full px-6 py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-800 disabled:text-gray-500 text-white rounded-lg transition-colors flex items-center justify-center gap-2 font-medium"
                >
                  {loading && <Loader size={16} className="animate-spin" />}
                  <User size={16} />
                  <span>{loading ? 'Submitting...' : 'Submit to Human Teacher'}</span>
                </button>

                <button
                  onClick={handleAiSolve}
                  disabled={loading || aiLoading || !selectedCourse || isHelpSupport || (attachedFile && getFileType(attachedFile) === 'document')}
                  className="w-full px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 disabled:text-gray-500 text-white rounded-lg transition-colors flex items-center justify-center gap-2 font-medium"
                  title={
                    isHelpSupport 
                      ? 'AI Solve-mate is not available for Help & Support' 
                      : attachedFile && getFileType(attachedFile) === 'document'
                      ? 'AI can only process images. Please use Human Teacher for documents.'
                      : ''
                  }
                >
                  {aiLoading && <Loader size={16} className="animate-spin" />}
                  <Brain size={16} />
                  <span>
                    {aiLoading 
                      ? 'Solving...' 
                      : isHelpSupport 
                      ? 'AI Not Available for Support' 
                      : 'AI Solve-mate'}
                  </span>
                </button>

                <button
                  onClick={onClose}
                  disabled={loading || aiLoading}
                  className="w-full px-6 py-3 bg-background-800 hover:bg-background-700 text-white rounded-lg transition-colors font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {showSimilarQuestions ? (
                <div className="bg-background-800 rounded-lg p-4 h-full min-h-[500px] max-h-[600px] overflow-y-auto">
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-background-700 sticky top-0 bg-background-800 z-10">
                    <div className="flex items-center gap-2">
                      <Eye size={20} className="text-blue-400" />
                      <h3 className="text-lg font-semibold text-white">Similar Questions Found</h3>
                    </div>
                    <button
                      onClick={() => submitToTeacher()}
                      disabled={loading}
                      className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-800 text-white px-3 py-1.5 rounded-lg transition-colors text-sm"
                    >
                      {loading ? <Loader size={14} className="animate-spin" /> : <Send size={14} />}
                      <span>{loading ? 'Submitting...' : 'Submit as New'}</span>
                    </button>
                  </div>

                  <div className="space-y-4">
                    {similarQuestions.map((q) => (
                      <div key={q.id} className="bg-background-700 rounded-lg p-3 hover:bg-background-600 transition-colors cursor-pointer" onClick={() => window.open(`/question/${q.id}`, '_blank')}>
                        <div className="flex items-center gap-2 mb-2">
                          <BookOpen size={14} className="text-primary-400" />
                          <span className="text-xs font-medium text-white">{q.subject}</span>
                          <span className="text-xs px-2 py-0.5 rounded bg-green-900 text-green-300">Answered</span>
                        </div>
                        <p className="text-sm text-white mb-2 line-clamp-3">{q.questionText}</p>
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                          <User size={12} />
                          <span>{q.studentName}</span>
                          <span>•</span>
                          <span>{q.createdAt.toLocaleDateString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 pt-4 border-t border-background-700 text-sm text-gray-400">
                    <p>💡 Click on any question to view its answer. If none of these match your question, click "Submit as New" above.</p>
                  </div>
                </div>
              ) : showAiSolution ? (
                <div className="bg-background-800 rounded-lg p-4 h-full min-h-[500px] max-h-[600px] overflow-y-auto">
                  <div className="flex items-center gap-2 mb-4 pb-3 border-b border-background-700 sticky top-0 bg-background-800 z-10">
                    <Brain size={20} className="text-purple-400" />
                    <h3 className="text-lg font-semibold text-white">AI Solution</h3>
                  </div>

                  {aiLoading && aiSolutions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12">
                      <Loader size={32} className="animate-spin text-purple-500 mb-3" />
                      <p className="text-gray-400 text-sm">AI is analyzing and solving your question...</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {aiSolutions.map((solution, index) => (
                        <div key={index} className="space-y-3">
                          {index > 0 && (
                            <div className="flex items-center gap-2 text-sm text-orange-400 font-medium">
                              <MessageSquare size={14} />
                              <span>Follow-up Answer {index}</span>
                            </div>
                          )}
                          <div className="prose prose-invert max-w-none">
                            <div className="text-white text-sm leading-relaxed">
                              {renderFormattedText(solution)}
                            </div>
                          </div>
                          {index < aiSolutions.length - 1 && (
                            <div className="border-t border-background-700 pt-2"></div>
                          )}
                        </div>
                      ))}
                      
                      <div className="text-xs text-red-500 pt-4 border-t border-background-700">
                        N.B.: AI Solve-mate answers may be inaccurate. Please use the Human Teacher option if you notice a flawed answer.
                      </div>

                      {aiQuestionId && !showFollowUpInput && (
                        <div className="pt-4 border-t border-background-700">
                          <p className="text-sm text-gray-400 mb-3">Was this answer helpful?</p>
                          <div className="flex gap-3">
                            <button
                              onClick={() => handleAiSatisfaction('satisfied')}
                              disabled={aiLoading}
                              className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-green-800 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium"
                            >
                              <ThumbsUp size={16} />
                              <span>Satisfied</span>
                            </button>
                            <button
                              onClick={() => handleAiSatisfaction('confused')}
                              disabled={aiLoading}
                              className="flex-1 flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-800 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium"
                            >
                              <HelpCircle size={16} />
                              <span>Still Confused</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {showFollowUpInput && (
                        <div className="pt-4 border-t border-background-700 space-y-3">
                          <label className="block text-sm text-gray-400">Ask your follow-up question:</label>
                          <textarea
                            value={followUpText}
                            onChange={(e) => setFollowUpText(e.target.value)}
                            className="w-full bg-background-700 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
                            placeholder="What are you still confused about?"
                            rows={4}
                            disabled={aiLoading}
                          ></textarea>
                          <div className="flex gap-2">
                            <button
                              onClick={handleFollowUpSubmit}
                              disabled={aiLoading || !followUpText.trim()}
                              className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                            >
                              {aiLoading && <Loader size={14} className="animate-spin" />}
                              <span>{aiLoading ? 'Getting answer...' : 'Submit'}</span>
                            </button>
                            <button
                              onClick={() => {
                                setShowFollowUpInput(false);
                                setFollowUpText('');
                              }}
                              disabled={aiLoading}
                              className="px-4 py-2 bg-background-700 hover:bg-background-600 text-white rounded-lg transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-background-800 rounded-lg p-8 h-full min-h-[500px] flex flex-col items-center justify-center text-center">
                  <Brain size={48} className="text-purple-400 mb-4" />
                  <h3 className="text-lg font-semibold text-white mb-2">AI Solve-mate</h3>
                  <p className="text-gray-400 text-sm max-w-sm mb-4">
                    {isHelpSupport 
                      ? 'AI Solve-mate is not available for Help & Support. Please use the Human Teacher option for assistance.'
                      : 'Click "AI Solve-mate" to get an instant solution. AI can analyze images and solve your questions!'}
                  </p>
                  {!isHelpSupport && (
                    <>
                      <p className="text-xs text-gray-500 mb-2">
                        Supports Bengali (বাংলা), Banglish (keno, kivabe), and English
                      </p>
                      <p className="text-xs text-purple-400">
                        ✨ Can analyze images (JPG, PNG, HEIC) • LaTeX math rendering
                      </p>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentQA;
