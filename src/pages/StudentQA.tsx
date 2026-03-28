// src/pages/StudentQA.tsx - Fully Responsive (Production Grade)
import { useState, useEffect, useRef } from 'react';
import { Plus, Search, Loader, AlertCircle, BookOpen, User, MessageSquare, X, Brain, Bell, FileText, Filter, ThumbsUp, HelpCircle, Mic, Volume2, Eye, Send, Bookmark, ChevronDown, ChevronUp } from 'lucide-react';
import Card from '../components/ui/Card';
import { useDashboard } from '../contexts/DashboardContext';
import { qaService, Question, Answer } from '../services/qaService';
import { courseService, Course } from '../services/courseService';
import { callWithFailover } from '../services/aiModelConfigService';
import { notificationService } from '../services/notificationService';
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
  const [questionFilter, setQuestionFilter] = useState<'my' | 'others' | 'all' | 'saved'>('all');
  const [unreadCount, setUnreadCount] = useState(0);
  const [enrolledCoursesWithQnA, setEnrolledCoursesWithQnA] = useState<Course[]>([]);
  const [availableSubjects, setAvailableSubjects] = useState<string[]>([]);
  const [savedQuestionIds, setSavedQuestionIds] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  const helpSupportSubjects = [
    'System related problems',
    'Course related problems',
    'Others'
  ];

  useEffect(() => {
    loadEnrolledCoursesWithQnA();
    loadSavedQuestions();
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
        (course): course is Course =>
          course !== null && (course.hasAiQnA === true || course.hasHumanQnA === true)
      );

      setEnrolledCoursesWithQnA(coursesWithQnA);
    } catch (err) {
      console.error('Failed to load enrolled courses:', err);
    }
  };

  const loadSavedQuestions = async () => {
    try {
      const savedIds = await qaService.getSavedQuestions(user?.uid || '');
      setSavedQuestionIds(savedIds);
    } catch (err) {
      console.error('Failed to load saved questions:', err);
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
      let fetchedQuestions = await qaService.getQuestions(selectedSubject, selectedStatus, user?.uid);

      fetchedQuestions = fetchedQuestions.filter(q => !q.isFollowUp);

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
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    }
    navigate(`/question/${question.id}`);
  };

  const filteredQuestions = questions.filter(q => {
    const matchesSearch = q.questionText.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          q.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          q.subject.toLowerCase().includes(searchTerm.toLowerCase());

    let matchesFilter = true;
    if (questionFilter === 'my') {
      matchesFilter = q.studentId === user?.uid;
    } else if (questionFilter === 'others') {
      matchesFilter = q.studentId !== user?.uid;
    } else if (questionFilter === 'saved') {
      matchesFilter = savedQuestionIds.includes(q.id);
    }

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
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">Ask a Question</h1>
          <p className="text-gray-400 mt-1 text-sm">Get help from teachers, AI, and peers</p>
        </div>
        <div className="flex items-center gap-3 self-start sm:self-auto">
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
            className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-3 sm:px-4 py-2 rounded-lg transition-colors shadow-lg hover:shadow-xl text-sm sm:text-base"
          >
            <Plus size={18} />
            <span className="whitespace-nowrap">Ask New Question</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-error-dark text-error-light px-4 py-3 rounded-lg flex items-center gap-2 text-sm">
          <AlertCircle size={16} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <Card tilt={false}>
        {/* Search + filter toggle row */}
        <div className="flex flex-col gap-3 mb-4 sm:mb-6">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Search questions..."
                className="w-full bg-background-800 text-white rounded-lg py-2 pl-9 pr-3 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
            </div>
            {/* Mobile filter toggle */}
            <button
              className="sm:hidden flex items-center gap-1 bg-background-800 text-white px-3 py-2 rounded-lg text-sm shrink-0"
              onClick={() => setShowFilters(v => !v)}
            >
              <Filter size={16} />
              {showFilters ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>

          {/* Filters - always visible on sm+, collapsible on mobile */}
          <div className={`${showFilters ? 'flex' : 'hidden'} sm:flex flex-col sm:flex-row gap-2 flex-wrap`}>
            <select
              value={questionFilter}
              onChange={(e) => setQuestionFilter(e.target.value as 'my' | 'others' | 'all' | 'saved')}
              className="bg-background-800 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm w-full sm:w-auto"
            >
              <option value="all">All Questions</option>
              <option value="my">My Questions</option>
              <option value="others">Others' Questions</option>
              <option value="saved">Saved Questions</option>
            </select>

            <select
              value={selectedCourse}
              onChange={(e) => setSelectedCourse(e.target.value)}
              className="bg-background-800 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm w-full sm:w-auto"
            >
              <option value="all">All Courses</option>
              <option value="help-support">Help & Support</option>
              {enrolledCoursesWithQnA.length === 0 ? (
                <option disabled>No courses with Q&A available</option>
              ) : (
                enrolledCoursesWithQnA.map(course => (
                  <option key={course.id} value={course.id}>
                    {course.title}
                  </option>
                ))
              )}
            </select>

            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="bg-background-800 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm w-full sm:w-auto"
            >
              <option value="all">All Subjects</option>
              {availableSubjects.map(subject => (
                <option key={subject} value={subject}>{subject}</option>
              ))}
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as 'all' | 'pending' | 'answered')}
              className="bg-background-800 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm w-full sm:w-auto"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="answered">Answered</option>
            </select>
          </div>
        </div>

        {/* Question list */}
        <div className="space-y-3 sm:space-y-4">
          {filteredQuestions.length === 0 ? (
            <div className="text-center py-10 sm:py-12 text-gray-400">
              <MessageSquare size={40} className="mx-auto mb-4" />
              <p className="text-sm px-4">
                {questionFilter === 'saved'
                  ? 'No saved questions found. Save questions by clicking the bookmark icon on any question.'
                  : enrolledCoursesWithQnA.length === 0
                  ? 'You are not enrolled in any courses with Q&A enabled. Enroll in a course to start asking questions!'
                  : 'No questions found. Be the first to ask!'}
              </p>
            </div>
          ) : (
            filteredQuestions.map(question => (
              <div
                key={question.id}
                className={`bg-background-800 rounded-lg p-3 sm:p-4 cursor-pointer hover:bg-background-700 transition-colors ${
                  question.studentId === user?.uid && question.status === 'answered' && !question.viewedByStudent
                    ? 'ring-2 ring-primary-500'
                    : ''
                }`}
                onClick={() => handleQuestionClick(question)}
              >
                {/* Question header row */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <BookOpen size={14} className="text-primary-400 shrink-0" />
                    <span className="text-sm font-medium text-white truncate">{question.subject}</span>
                    {question.studentId === user?.uid && (
                      <span className="text-xs text-primary-400 bg-primary-900 px-2 py-0.5 rounded shrink-0">You</span>
                    )}
                    {savedQuestionIds.includes(question.id) && (
                      <Bookmark size={13} className="text-yellow-400 fill-yellow-400 shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                    {question.status === 'answered' && question.answeredBy && (
                      <span className={`text-xs px-2 py-0.5 rounded whitespace-nowrap ${
                        question.answeredBy === 'ai'
                          ? 'bg-purple-900 text-purple-300'
                          : 'bg-blue-900 text-blue-300'
                      }`}>
                        {question.answeredBy === 'ai' ? '🤖 AI' : '👨‍🏫 Teacher'}
                      </span>
                    )}
                    <span className={`px-2 py-0.5 rounded-full text-xs whitespace-nowrap ${
                      question.status === 'pending'
                        ? 'bg-warning-dark text-warning-light'
                        : 'bg-success-dark text-success-light'
                    }`}>
                      {question.status === 'pending' ? 'Pending' : 'Answered'}
                    </span>
                    {question.studentId === user?.uid && question.status === 'answered' && !question.viewedByStudent && (
                      <span className="w-2 h-2 bg-primary-500 rounded-full shrink-0"></span>
                    )}
                  </div>
                </div>

                <h3 className="text-sm sm:text-base font-medium text-white mb-2 line-clamp-2">{question.questionText}</h3>

                {question.imageUrl && (
                  <img src={question.imageUrl} alt="Question attachment" className="max-h-32 sm:max-h-40 object-contain rounded-lg mb-2" />
                )}
                {question.audioUrl && (
                  <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-400 mb-2">
                    <Volume2 size={13} />
                    <span>Voice message attached</span>
                  </div>
                )}
                {question.fileName && (
                  <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-400 mb-2">
                    <FileText size={13} />
                    <span className="truncate">{question.fileName}</span>
                  </div>
                )}

                <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-400 flex-wrap">
                  <div className="flex items-center gap-1">
                    <User size={12} />
                    <span className="truncate max-w-[120px]">{question.studentName}</span>
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

// ─── Shared text renderer ────────────────────────────────────────────────────

const renderFormattedText = (text: string) => {
  if (!text) return null;

  const blockMathRegex = /\$\$([\s\S]*?)\$\$/g;
  const parts = text.split(blockMathRegex);

  return parts.map((part, index) => {
    if (index % 2 === 1) {
      try {
        return <BlockMath key={index} math={part} />;
      } catch (e) {
        return <span key={index} className="text-error-light">{part}</span>;
      }
    } else {
      const inlineMathRegex = /\$([^\$]+)\$/g;
      const inlineParts = part.split(inlineMathRegex);

      return inlineParts.map((inlinePart, inlineIndex) => {
        if (inlineIndex % 2 === 1) {
          try {
            return <InlineMath key={`${index}-${inlineIndex}`} math={inlinePart} />;
          } catch (e) {
            return <span key={`${index}-${inlineIndex}`} className="text-error-light">{inlinePart}</span>;
          }
        } else {
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

// ─── AskQuestionModal ────────────────────────────────────────────────────────

interface AskQuestionModalProps {
  onClose: () => void;
  onSuccess: () => void;
  studentId: string;
  studentName: string;
  enrolledCoursesWithQnA: Course[];
  helpSupportSubjects: string[];
}

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
  const [similarQuestionsWithAnswers, setSimilarQuestionsWithAnswers] = useState<Array<{question: Question, answers: Answer[]}>>([]);
  const [similarLoading, setSimilarLoading] = useState(false);
  const [aiSolutions, setAiSolutions] = useState<string[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiQuestionId, setAiQuestionId] = useState<string | null>(null);
  const [showFollowUpInput, setShowFollowUpInput] = useState(false);
  const [followUpText, setFollowUpText] = useState('');
  const [availableSubjects, setAvailableSubjects] = useState<string[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [expandedQuestionId, setExpandedQuestionId] = useState<string | null>(null);
  // Mobile: which panel is active (form | preview)
  const [activeTab, setActiveTab] = useState<'form' | 'preview'>('form');

  const isSubmittingRef = useRef(false);
  const uploadedImageUrlRef = useRef<string | undefined>(undefined);

  const isHelpSupport = selectedCourse === 'help-support';
  const selectedCourseData = enrolledCoursesWithQnA.find(c => c.id === selectedCourse);
  const hasAiQnA = isHelpSupport ? false : (selectedCourseData?.hasAiQnA || false);
  const hasHumanQnA = isHelpSupport ? true : (selectedCourseData?.hasHumanQnA || false);

  const hasRightPanel = showSimilarQuestions || showAiSolution;

  useEffect(() => {
    updateAvailableSubjects();
  }, [selectedCourse]);

  // Switch to preview tab on mobile when right panel content appears
  useEffect(() => {
    if (hasRightPanel) setActiveTab('preview');
  }, [hasRightPanel]);

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
        if (e.data.size > 0) chunks.push(e.data);
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
    if (file.type.startsWith('image/')) return 'image';
    if (file.type.startsWith('audio/')) return 'audio';
    return 'document';
  };

  const convertFileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onloadend = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]);
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
    if (bengaliPattern.test(text)) return 'bengali';
    if (banglishPattern.test(text)) return 'banglish';
    return 'english';
  };

  const loadSimilarQuestionsWithAnswers = async (questions: Question[]) => {
    setSimilarLoading(true);
    try {
      const questionsWithAnswers = await Promise.all(
        questions.map(async (q) => {
          const answers = await qaService.getAnswersForQuestion(q.id);
          return { question: q, answers };
        })
      );
      setSimilarQuestionsWithAnswers(questionsWithAnswers);
    } catch (err) {
      console.error('Failed to load answers for similar questions:', err);
    } finally {
      setSimilarLoading(false);
    }
  };

  const handleSubmitToTeacher = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmittingRef.current || loading) return;

    setError('');

    if (!questionText.trim() || !subject || !selectedCourse) {
      setError('Please fill in all required fields.');
      return;
    }

    if (!hasHumanQnA) {
      setError('Human Teacher Q&A is not available for this course. Please use AI Solve-mate or select a different course.');
      return;
    }

    isSubmittingRef.current = true;
    setLoading(true);

    try {
      const result = await qaService.findSimilarQuestionsWithFile(
        questionText,
        subject,
        attachedFile && getFileType(attachedFile) === 'image' ? attachedFile : null,
        selectedCourse
      );

      if (result.uploadedImageUrl) {
        uploadedImageUrlRef.current = result.uploadedImageUrl;
      }

      if (result.questions.length > 0) {
        setSimilarQuestions(result.questions);
        setShowSimilarQuestions(true);
        setShowAiSolution(false);
        await loadSimilarQuestionsWithAnswers(result.questions);
        isSubmittingRef.current = false;
        setLoading(false);
        return;
      }

      await submitToTeacher();
    } catch (err: any) {
      setError('Failed to check for similar questions: ' + err.message);
      isSubmittingRef.current = false;
      setLoading(false);
    }
  };

  const submitToTeacher = async () => {
    if (isSubmittingRef.current && loading) return;

    isSubmittingRef.current = true;
    setLoading(true);
    setError('');
    setShowSimilarQuestions(false);

    try {
      let imageUrl: string | undefined;
      let audioUrl: string | undefined;
      let fileUrl: string | undefined;
      let fileName: string | undefined;

      if (attachedFile) {
        const fileType = getFileType(attachedFile);

        if (fileType === 'image') {
          if (uploadedImageUrlRef.current) {
            imageUrl = uploadedImageUrlRef.current;
          } else {
            const uploadResult = await qaService.uploadToSupabase(attachedFile, 'question_images');
            imageUrl = uploadResult.url;
          }
        } else {
          const uploadResult = await qaService.uploadToSupabase(attachedFile, 'question_documents');
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

      notificationService.createNotification({
        userId: studentId,
        title: 'Question Submitted',
        message: questionText.trim(),
        type: 'reminder',
        priority: 'low',
        isPermanent: false,
        relatedType: 'qa',
        metadata: { subject, courseId: selectedCourse },
      });

      onSuccess();
    } catch (err: any) {
      setError('Failed to submit question: ' + err.message);
    } finally {
      isSubmittingRef.current = false;
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

      let imageBase64: string | undefined;
      let imageMimeType: string | undefined;
      if (fileToProcess && getFileType(fileToProcess) === 'image') {
        imageBase64 = await convertFileToBase64(fileToProcess);
        imageMimeType = getMimeType(fileToProcess);
      }

      const featureId = isFollowUp ? 'qa_followup' : 'qa_solve';
      return await callWithFailover(aiPrompt, featureId, 2048, 0.7, imageBase64, imageMimeType);
    } catch (err: any) {
      throw err;
    }
  };

  const handleAiSolve = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmittingRef.current || aiLoading) return;

    setError('');

    if (!questionText.trim() || !subject || !selectedCourse) {
      setError('Please fill in all required fields.');
      return;
    }

    if (isHelpSupport) {
      setError('AI Solve-mate is not available for Help & Support. Please use Human Teacher.');
      return;
    }

    if (!hasAiQnA) {
      setError('AI Solve-mate is not available for this course. Please use Human Teacher or select a different course.');
      return;
    }

    if (attachedFile && getFileType(attachedFile) === 'document') {
      setError('AI Solve-mate can only process images (JPG, PNG, HEIC). For PDF/DOCX files, please use Human Teacher.');
      return;
    }

    isSubmittingRef.current = true;
    setAiLoading(true);
    setShowAiSolution(true);
    setShowSimilarQuestions(false);

    try {
      let uploadedImageUrl: string | undefined;
      if (attachedFile && getFileType(attachedFile) === 'image') {
        const uploadResult = await qaService.uploadToSupabase(attachedFile, 'question_images');
        uploadedImageUrl = uploadResult.url;
        uploadedImageUrlRef.current = uploadedImageUrl;
      }

      const solution = await getAiSolution(
        questionText,
        false,
        attachedFile && getFileType(attachedFile) === 'image' ? attachedFile : undefined
      );
      setAiSolutions([solution]);

      const questionId = await qaService.askQuestion({
        studentId,
        studentName,
        subject,
        questionText: questionText.trim(),
        imageUrl: uploadedImageUrl,
        courseId: selectedCourse,
      });

      setAiQuestionId(questionId);

      await qaService.answerQuestion({
        questionId,
        answerText: solution,
        type: 'ai',
      });

      notificationService.createNotification({
        userId: studentId,
        title: 'Your Question Was Answered',
        message: questionText.trim(),
        type: 'announcement',
        priority: 'high',
        isPermanent: true,
        relatedId: questionId,
        relatedType: 'qa',
        metadata: { subject, courseId: selectedCourse },
      });

    } catch (err: any) {
      setError('Failed to get AI solution: ' + err.message);
      setShowAiSolution(false);
    } finally {
      isSubmittingRef.current = false;
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

  const toggleQuestionExpansion = (questionId: string) => {
    setExpandedQuestionId(expandedQuestionId === questionId ? null : questionId);
  };

  // ── Right panel content ────────────────────────────────────────────────────

  const RightPanelContent = () => {
    if (showSimilarQuestions) {
      return (
        <div className="bg-background-800 rounded-lg p-3 sm:p-4 flex flex-col h-full min-h-[400px] max-h-[55vh] sm:max-h-[600px] overflow-hidden">
          {/* Sticky header */}
          <div className="flex items-center justify-between pb-3 border-b border-background-700 mb-3 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <Eye size={18} className="text-blue-400 shrink-0" />
              <h3 className="text-base font-semibold text-white truncate">Similar Questions Found</h3>
            </div>
            <button
              onClick={() => submitToTeacher()}
              disabled={loading}
              className="flex items-center gap-1.5 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-800 disabled:cursor-not-allowed text-white px-2.5 py-1.5 rounded-lg transition-colors text-xs sm:text-sm shrink-0 ml-2"
            >
              {loading ? <Loader size={12} className="animate-spin" /> : <Send size={12} />}
              <span className="whitespace-nowrap">{loading ? 'Submitting...' : 'Submit as New'}</span>
            </button>
          </div>

          <div className="overflow-y-auto flex-1 space-y-3">
            {similarLoading ? (
              <div className="flex justify-center py-8">
                <Loader size={28} className="animate-spin text-primary-500" />
              </div>
            ) : (
              <>
                {similarQuestionsWithAnswers.map(({ question: q, answers }) => (
                  <div key={q.id} className="bg-background-700 rounded-lg p-3">
                    <div
                      className="cursor-pointer"
                      onClick={() => toggleQuestionExpansion(q.id)}
                    >
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <BookOpen size={13} className="text-primary-400 shrink-0" />
                        <span className="text-xs font-medium text-white">{q.subject}</span>
                        <span className="text-xs px-1.5 py-0.5 rounded bg-green-900 text-green-300">Answered</span>
                        <span className="ml-auto text-gray-400 text-xs">
                          {expandedQuestionId === q.id ? '▼' : '▶'}
                        </span>
                      </div>
                      <p className="text-sm text-white mb-2 line-clamp-2">{q.questionText}</p>
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <User size={11} />
                        <span>{q.studentName}</span>
                        <span>•</span>
                        <span>{q.createdAt.toLocaleDateString()}</span>
                      </div>
                    </div>

                    {expandedQuestionId === q.id && (
                      <div className="mt-3 pt-3 border-t border-background-600 space-y-3">
                        <div>
                          <h4 className="text-xs font-semibold text-primary-400 mb-1">Full Question:</h4>
                          <p className="text-sm text-white whitespace-pre-wrap">{q.questionText}</p>
                          {q.imageUrl && (
                            <img src={q.imageUrl} alt="Question" className="mt-2 max-h-40 object-contain rounded-lg" />
                          )}
                          {q.audioUrl && (
                            <div className="mt-2">
                              <audio controls className="w-full">
                                <source src={q.audioUrl} type="audio/webm" />
                              </audio>
                            </div>
                          )}
                          {q.fileName && q.fileUrl && (
                            <div className="mt-2 flex items-center gap-2 text-sm">
                              <FileText size={13} className="text-primary-400" />
                              <span className="text-gray-400 truncate">{q.fileName}</span>
                            </div>
                          )}
                        </div>

                        {answers.length > 0 && (
                          <div>
                            <h4 className="text-xs font-semibold text-green-400 mb-2">
                              {answers.length === 1 ? 'Answer:' : `Answers (${answers.length}):`}
                            </h4>
                            <div className="space-y-2">
                              {answers.map((answer) => (
                                <div key={answer.id} className="bg-background-600 rounded-lg p-3">
                                  <div className="flex items-center gap-2 mb-2">
                                    {answer.type === 'ai' ? (
                                      <>
                                        <Brain size={13} className="text-purple-400" />
                                        <span className="text-xs text-purple-300">AI Answer</span>
                                      </>
                                    ) : (
                                      <>
                                        <User size={13} className="text-blue-400" />
                                        <span className="text-xs text-blue-300">Teacher Answer</span>
                                      </>
                                    )}
                                  </div>
                                  <div className="text-sm text-white whitespace-pre-wrap">
                                    {renderFormattedText(answer.answerText)}
                                  </div>
                                  {answer.imageUrl && (
                                    <img src={answer.imageUrl} alt="Answer" className="mt-2 max-h-40 object-contain rounded-lg" />
                                  )}
                                  {answer.audioUrl && (
                                    <div className="mt-2">
                                      <audio controls className="w-full">
                                        <source src={answer.audioUrl} type="audio/webm" />
                                      </audio>
                                    </div>
                                  )}
                                  {answer.fileName && answer.fileUrl && (
                                    <div className="mt-2 flex items-center gap-2 text-sm">
                                      <FileText size={12} className="text-primary-400" />
                                      <span className="text-gray-400 truncate">{answer.fileName}</span>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                <div className="pt-3 border-t border-background-700 text-xs text-gray-400">
                  <p>Click on any question to expand and view the full answer. If none of these match your question, click "Submit as New" above.</p>
                </div>
              </>
            )}
          </div>
        </div>
      );
    }

    if (showAiSolution) {
      return (
        <div className="bg-background-800 rounded-lg p-3 sm:p-4 flex flex-col h-full min-h-[400px] max-h-[55vh] sm:max-h-[600px] overflow-hidden">
          <div className="flex items-center gap-2 pb-3 border-b border-background-700 mb-3 shrink-0">
            <Brain size={18} className="text-purple-400 shrink-0" />
            <h3 className="text-base font-semibold text-white">AI Solution</h3>
          </div>

          <div className="overflow-y-auto flex-1">
            {aiLoading && aiSolutions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader size={28} className="animate-spin text-purple-500 mb-3" />
                <p className="text-gray-400 text-sm text-center">AI is analyzing and solving your question...</p>
              </div>
            ) : (
              <div className="space-y-5">
                {aiSolutions.map((solution, index) => (
                  <div key={index} className="space-y-3">
                    {index > 0 && (
                      <div className="flex items-center gap-2 text-sm text-orange-400 font-medium">
                        <MessageSquare size={13} />
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

                <div className="text-xs text-red-500 pt-3 border-t border-background-700">
                  N.B.: AI Solve-mate answers may be inaccurate. Please use the Human Teacher option if you notice a flawed answer.
                </div>

                {aiQuestionId && !showFollowUpInput && (
                  <div className="pt-3 border-t border-background-700">
                    <p className="text-sm text-gray-400 mb-3">Was this answer helpful?</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAiSatisfaction('satisfied')}
                        disabled={aiLoading}
                        className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-green-800 disabled:opacity-50 text-white px-3 py-2 rounded-lg transition-colors text-sm font-medium"
                      >
                        <ThumbsUp size={14} />
                        <span>Satisfied</span>
                      </button>
                      <button
                        onClick={() => handleAiSatisfaction('confused')}
                        disabled={aiLoading}
                        className="flex-1 flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-800 disabled:opacity-50 text-white px-3 py-2 rounded-lg transition-colors text-sm font-medium"
                      >
                        <HelpCircle size={14} />
                        <span>Still Confused</span>
                      </button>
                    </div>
                  </div>
                )}

                {showFollowUpInput && (
                  <div className="pt-3 border-t border-background-700 space-y-3">
                    <label className="block text-sm text-gray-400">Ask your follow-up question:</label>
                    <textarea
                      value={followUpText}
                      onChange={(e) => setFollowUpText(e.target.value)}
                      className="w-full bg-background-700 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                      placeholder="What are you still confused about?"
                      rows={3}
                      disabled={aiLoading}
                    ></textarea>
                    <div className="flex gap-2">
                      <button
                        onClick={handleFollowUpSubmit}
                        disabled={aiLoading || !followUpText.trim()}
                        className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 disabled:opacity-50 text-white rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
                      >
                        {aiLoading && <Loader size={13} className="animate-spin" />}
                        <span>{aiLoading ? 'Getting answer...' : 'Submit'}</span>
                      </button>
                      <button
                        onClick={() => { setShowFollowUpInput(false); setFollowUpText(''); }}
                        disabled={aiLoading}
                        className="px-4 py-2 bg-background-700 hover:bg-background-600 disabled:opacity-50 text-white rounded-lg transition-colors text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    // Default placeholder
    return (
      <div className="bg-background-800 rounded-lg p-6 sm:p-8 h-full min-h-[300px] sm:min-h-[500px] flex flex-col items-center justify-center text-center">
        <Brain size={44} className="text-purple-400 mb-4" />
        <h3 className="text-base font-semibold text-white mb-2">AI Solve-mate</h3>
        <p className="text-gray-400 text-sm max-w-xs mb-4">
          {isHelpSupport
            ? 'AI Solve-mate is not available for Help & Support. Please use the Human Teacher option for assistance.'
            : !hasAiQnA
            ? 'AI Q&A is not enabled for this course. Please use the Human Teacher option or select a different course.'
            : 'Click "AI Solve-mate" to get an instant solution. AI can analyze images and solve your questions!'}
        </p>
        {!isHelpSupport && hasAiQnA && (
          <>
            <p className="text-xs text-gray-500 mb-2">
              Supports Bengali (বাংলা), Banglish (keno, kivabe), and English
            </p>
            <p className="text-xs text-purple-400">
              Can analyze images (JPG, PNG, HEIC) • LaTeX math rendering • Images saved to database
            </p>
          </>
        )}
      </div>
    );
  };

  // ── Modal render ───────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-start justify-center z-50 p-2 sm:p-4 overflow-y-auto">
      <div className="bg-background-900 rounded-xl w-full max-w-6xl my-4 sm:my-8 relative">

        {/* Close button */}
        <button
          onClick={onClose}
          disabled={loading || aiLoading}
          className="absolute right-3 top-3 sm:right-4 sm:top-4 text-gray-400 hover:text-white z-10 disabled:opacity-50 p-1"
        >
          <X size={20} />
        </button>

        <div className="p-4 sm:p-6">
          <h2 className="text-lg sm:text-2xl font-bold text-white mb-4 sm:mb-6 pr-8">Ask a New Question</h2>

          {error && (
            <div className="bg-error-dark text-error-light px-3 py-2.5 rounded-lg mb-4 flex items-start gap-2 text-sm">
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Mobile tab switcher — only shown when there's right panel content */}
          {hasRightPanel && (
            <div className="flex lg:hidden gap-1 mb-4 bg-background-800 rounded-lg p-1">
              <button
                onClick={() => setActiveTab('form')}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                  activeTab === 'form'
                    ? 'bg-primary-600 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Form
              </button>
              <button
                onClick={() => setActiveTab('preview')}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                  activeTab === 'preview'
                    ? 'bg-primary-600 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {showSimilarQuestions ? 'Similar Questions' : 'AI Solution'}
              </button>
            </div>
          )}

          {/* Grid layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">

            {/* LEFT — Form */}
            <div className={`space-y-4 ${hasRightPanel && activeTab !== 'form' ? 'hidden lg:block' : 'block'}`}>
              {/* Course */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Course *</label>
                <select
                  value={selectedCourse}
                  onChange={(e) => setSelectedCourse(e.target.value)}
                  className="w-full bg-background-800 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                  disabled={loading || aiLoading}
                  required
                >
                  <option value="">Select a course</option>
                  <option value="help-support">Help & Support</option>
                  {enrolledCoursesWithQnA.map(course => (
                    <option key={course.id} value={course.id}>
                      {course.title}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  {enrolledCoursesWithQnA.length === 0
                    ? 'You can use Help & Support for general queries'
                    : selectedCourse && !isHelpSupport
                    ? `Available: ${hasAiQnA ? 'AI' : ''}${hasAiQnA && hasHumanQnA ? ' + ' : ''}${hasHumanQnA ? 'Teacher' : ''}`
                    : 'Select course to see available Q&A options'}
                </p>
              </div>

              {/* Subject */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Subject *</label>
                <select
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full bg-background-800 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
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

              {/* Question textarea */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Your Question *</label>
                <textarea
                  value={questionText}
                  onChange={(e) => setQuestionText(e.target.value)}
                  className="w-full bg-background-800 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                  placeholder="Type your question here in Bengali or English... (Supports LaTeX: $x^2$ for inline, $$E=mc^2$$ for display)"
                  rows={5}
                  disabled={loading || aiLoading}
                  required
                ></textarea>
              </div>

              {/* File attachment */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Attach File (Optional)</label>
                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/heic,.pdf,.doc,.docx"
                  onChange={handleFileChange}
                  className="w-full bg-background-800 text-white rounded-lg py-2 px-3 text-xs sm:text-sm file:mr-3 file:py-1 file:px-2 sm:file:px-3 file:rounded file:border-0 file:bg-primary-600 file:text-white file:cursor-pointer file:text-xs"
                  disabled={loading || aiLoading}
                />
                {attachedFile && (
                  <div className="text-xs text-gray-400 mt-1 flex items-start gap-2 flex-wrap">
                    <FileText size={13} className="shrink-0 mt-0.5" />
                    <span className="break-all">{attachedFile.name} ({(attachedFile.size / 1024).toFixed(2)} KB)</span>
                    {getFileType(attachedFile) === 'document' && (
                      <span className="text-orange-400">(AI can't process documents - use Human Teacher)</span>
                    )}
                  </div>
                )}
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                  Human Teacher: All formats (JPG, PNG, HEIC, PDF, DOCX) — Max 10MB<br />
                  AI Solve-mate: Images only (JPG, PNG, HEIC) — Images will be saved
                </p>
              </div>

              {/* Voice message */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Voice Message (Optional)</label>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={isRecording ? stopRecording : startRecording}
                    disabled={loading || aiLoading}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors disabled:opacity-50 text-sm ${
                      isRecording
                        ? 'bg-error-dark text-error-light'
                        : 'bg-background-800 text-white hover:bg-background-700'
                    }`}
                  >
                    {isRecording ? <Volume2 size={15} className="animate-pulse" /> : <Mic size={15} />}
                    <span>{isRecording ? 'Stop Recording' : 'Record Voice'}</span>
                  </button>
                  {audioFile && (
                    <span className="text-xs text-gray-400">
                      Audio recorded ({(audioFile.size / 1024).toFixed(2)} KB)
                    </span>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-col gap-2.5 pt-3 border-t border-background-800">
                <button
                  onClick={handleSubmitToTeacher}
                  disabled={loading || aiLoading || !selectedCourse || !hasHumanQnA}
                  className="w-full px-4 py-2.5 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-800 disabled:text-gray-500 disabled:cursor-not-allowed text-white rounded-lg transition-all flex items-center justify-center gap-2 font-medium text-sm"
                  title={!hasHumanQnA ? 'Human Teacher Q&A is not available for this course' : ''}
                >
                  {loading && <Loader size={14} className="animate-spin" />}
                  <User size={14} />
                  <span>{loading ? 'Submitting...' : hasHumanQnA ? 'Submit to Human Teacher' : 'Teacher Q&A Not Available'}</span>
                </button>

                <button
                  onClick={handleAiSolve}
                  disabled={loading || aiLoading || !selectedCourse || isHelpSupport || !hasAiQnA || !!(attachedFile && getFileType(attachedFile) === 'document')}
                  className="w-full px-4 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 disabled:text-gray-500 disabled:cursor-not-allowed text-white rounded-lg transition-all flex items-center justify-center gap-2 font-medium text-sm"
                  title={
                    isHelpSupport
                      ? 'AI Solve-mate is not available for Help & Support'
                      : !hasAiQnA
                      ? 'AI Q&A is not available for this course'
                      : attachedFile && getFileType(attachedFile) === 'document'
                      ? 'AI can only process images. Please use Human Teacher for documents.'
                      : ''
                  }
                >
                  {aiLoading && <Loader size={14} className="animate-spin" />}
                  <Brain size={14} />
                  <span>
                    {aiLoading
                      ? 'Solving...'
                      : isHelpSupport
                      ? 'AI Not Available for Support'
                      : !hasAiQnA
                      ? 'AI Q&A Not Available'
                      : 'AI Solve-mate'}
                  </span>
                </button>

                <button
                  onClick={onClose}
                  disabled={loading || aiLoading}
                  className="w-full px-4 py-2.5 bg-background-800 hover:bg-background-700 disabled:opacity-50 text-white rounded-lg transition-colors font-medium text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>

            {/* RIGHT — Panel */}
            <div className={`${hasRightPanel && activeTab !== 'preview' ? 'hidden lg:block' : 'block'}`}>
              <RightPanelContent />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentQA;
