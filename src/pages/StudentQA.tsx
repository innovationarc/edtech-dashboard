// src/pages/StudentQA.tsx - Full Production (Modal styled identical to LiveExam ExamFormModal)
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
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

// ─── Theme helpers — exact copy from LiveExam.tsx ────────────────────────────

const hexRgb = (hex: string) => {
  if (!hex || hex.length < 7) return '99,102,241';
  return `${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)}`;
};

const THEME_BG: Record<string, string> = {
  dark: '#0d1117', light: '#ebe8e1', slate: '#0f172a',
  ocean: '#0c1a2e', forest: '#0a1f14', purple: '#1e1b4b',
  pink: '#831843', sunset: '#1c0a00',
};

const useT = () => {
  const { theme, primaryColor, accentColor } = useDashboard();
  const isLight = theme === 'light';
  const pRgb = hexRgb(primaryColor);
  return {
    isLight, darkMode: !isLight, theme, primaryColor, accentColor, pRgb,
    baseBg: THEME_BG[theme] ?? '#0d1117',
    text: isLight ? '#111827' : '#f1f5f9',
    text2: isLight ? '#6b7280' : '#94a3b8',
    text3: isLight ? '#9ca3af' : '#475569',
    border: isLight ? 'rgba(0,0,0,0.08)' : `rgba(${hexRgb(primaryColor)},0.15)`,
    surface: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.04)',
    cardBg: isLight ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.04)',
    inputBg: isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.16)',
    inputBorder: isLight ? 'rgba(0,0,0,0.10)' : `rgba(${hexRgb(primaryColor)},0.22)`,
    divider: isLight ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.06)',
    btnSecBg: isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.07)',
    btnSecBorder: isLight ? 'rgba(0,0,0,0.09)' : 'rgba(255,255,255,0.09)',
    danger: '#ef4444',
    green: '#22c55e',
    gold: '#f59e0b',
    purple2: '#8b5cf6',
    gradient: `linear-gradient(135deg,${primaryColor} 0%,${accentColor} 100%)`,
  };
};

// ─── ModalShell — exact copy from LiveExam.tsx ───────────────────────────────

const ModalShell = ({
  children,
  onClose,
  wide,
}: {
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) => {
  const { theme, primaryColor, accentColor, glitterTheme } = useDashboard();
  const darkMode = theme !== 'light';
  const isLight = theme === 'light';
  const pRgb = hexRgb(primaryColor);
  const baseBg = THEME_BG[theme] ?? '#0d1117';

  const glitterImageMap: Record<string, string> = {
    silver: isLight ? `
      radial-gradient(ellipse at 20% 20%, rgba(0,0,0,0.04) 0%, transparent 50%),
      radial-gradient(ellipse at 80% 80%, rgba(0,0,0,0.03) 0%, transparent 50%),
      radial-gradient(circle at 30% 40%, rgba(80,80,100,0.60) 1px, transparent 1px),
      radial-gradient(circle at 70% 20%, rgba(80,80,100,0.52) 1px, transparent 1px),
      radial-gradient(circle at 50% 70%, rgba(80,80,100,0.56) 1px, transparent 1px),
      radial-gradient(circle at 15% 80%, rgba(80,80,100,0.48) 1px, transparent 1px),
      radial-gradient(circle at 85% 60%, rgba(80,80,100,0.60) 1px, transparent 1px),
      radial-gradient(circle at 60% 45%, rgba(80,80,100,0.52) 1px, transparent 1px),
      radial-gradient(circle at 40% 15%, rgba(80,80,100,0.55) 1px, transparent 1px),
      radial-gradient(circle at 90% 35%, rgba(80,80,100,0.48) 1px, transparent 1px)
    ` : `
      radial-gradient(ellipse at 20% 20%, rgba(255,255,255,0.05) 0%, transparent 50%),
      radial-gradient(ellipse at 80% 80%, rgba(255,255,255,0.03) 0%, transparent 50%),
      radial-gradient(circle at 30% 40%, rgba(220,220,240,0.55) 0.5px, transparent 0.5px),
      radial-gradient(circle at 70% 20%, rgba(200,200,220,0.45) 0.5px, transparent 0.5px),
      radial-gradient(circle at 50% 70%, rgba(220,220,240,0.50) 0.5px, transparent 0.5px),
      radial-gradient(circle at 15% 80%, rgba(200,200,220,0.40) 0.5px, transparent 0.5px),
      radial-gradient(circle at 85% 60%, rgba(220,220,240,0.55) 0.5px, transparent 0.5px),
      radial-gradient(circle at 60% 45%, rgba(200,200,220,0.45) 0.5px, transparent 0.5px),
      radial-gradient(circle at 40% 15%, rgba(220,220,240,0.50) 0.5px, transparent 0.5px),
      radial-gradient(circle at 90% 35%, rgba(200,200,220,0.40) 0.5px, transparent 0.5px)
    `,
    gold: isLight ? `
      radial-gradient(ellipse at 15% 15%, rgba(180,130,0,0.09) 0%, transparent 45%),
      radial-gradient(ellipse at 85% 85%, rgba(150,110,0,0.07) 0%, transparent 45%),
      radial-gradient(circle at 25% 35%, rgba(160,120,0,0.72) 1px, transparent 1px),
      radial-gradient(circle at 75% 25%, rgba(180,140,0,0.68) 1px, transparent 1px),
      radial-gradient(circle at 45% 65%, rgba(160,120,0,0.70) 1px, transparent 1px),
      radial-gradient(circle at 80% 70%, rgba(180,140,0,0.62) 1px, transparent 1px),
      radial-gradient(circle at 10% 55%, rgba(160,120,0,0.65) 1px, transparent 1px),
      radial-gradient(circle at 60% 15%, rgba(180,140,0,0.72) 1px, transparent 1px),
      radial-gradient(circle at 35% 85%, rgba(160,120,0,0.58) 1px, transparent 1px)
    ` : `
      radial-gradient(ellipse at 15% 15%, rgba(212,175,55,0.12) 0%, transparent 45%),
      radial-gradient(ellipse at 85% 85%, rgba(180,140,30,0.08) 0%, transparent 45%),
      radial-gradient(circle at 25% 35%, rgba(212,175,55,0.60) 0.5px, transparent 0.5px),
      radial-gradient(circle at 75% 25%, rgba(255,215,0,0.55) 0.5px, transparent 0.5px),
      radial-gradient(circle at 45% 65%, rgba(212,175,55,0.58) 0.5px, transparent 0.5px),
      radial-gradient(circle at 80% 70%, rgba(255,215,0,0.48) 0.5px, transparent 0.5px),
      radial-gradient(circle at 10% 55%, rgba(212,175,55,0.52) 0.5px, transparent 0.5px),
      radial-gradient(circle at 60% 15%, rgba(255,215,0,0.62) 0.5px, transparent 0.5px),
      radial-gradient(circle at 35% 85%, rgba(212,175,55,0.42) 0.5px, transparent 0.5px)
    `,
    purple: isLight ? `
      radial-gradient(ellipse at 20% 30%, rgba(99,102,241,0.10) 0%, transparent 45%),
      radial-gradient(ellipse at 80% 70%, rgba(79,70,229,0.08) 0%, transparent 45%),
      radial-gradient(circle at 30% 40%, rgba(99,102,241,0.65) 1px, transparent 1px),
      radial-gradient(circle at 70% 20%, rgba(79,70,229,0.60) 1px, transparent 1px),
      radial-gradient(circle at 55% 70%, rgba(99,102,241,0.62) 1px, transparent 1px),
      radial-gradient(circle at 15% 60%, rgba(79,70,229,0.55) 1px, transparent 1px),
      radial-gradient(circle at 88% 50%, rgba(99,102,241,0.60) 1px, transparent 1px),
      radial-gradient(circle at 45% 15%, rgba(79,70,229,0.65) 1px, transparent 1px),
      radial-gradient(circle at 75% 85%, rgba(99,102,241,0.50) 1px, transparent 1px)
    ` : `
      radial-gradient(ellipse at 20% 30%, rgba(139,92,246,0.12) 0%, transparent 45%),
      radial-gradient(ellipse at 80% 70%, rgba(99,102,241,0.10) 0%, transparent 45%),
      radial-gradient(circle at 30% 40%, rgba(200,180,255,0.70) 0.5px, transparent 0.5px),
      radial-gradient(circle at 70% 20%, rgba(180,160,240,0.62) 0.5px, transparent 0.5px),
      radial-gradient(circle at 55% 70%, rgba(220,200,255,0.68) 0.5px, transparent 0.5px),
      radial-gradient(circle at 15% 60%, rgba(200,180,255,0.58) 0.5px, transparent 0.5px),
      radial-gradient(circle at 88% 50%, rgba(180,160,240,0.64) 0.5px, transparent 0.5px),
      radial-gradient(circle at 45% 15%, rgba(220,200,255,0.72) 0.5px, transparent 0.5px),
      radial-gradient(circle at 75% 85%, rgba(200,180,255,0.50) 0.5px, transparent 0.5px)
    `,
  };

  const glitterBgImage = glitterImageMap[glitterTheme] ?? '';
  const glitterBgSize = glitterTheme === 'silver'
    ? 'auto, auto, 80px 80px, 120px 120px, 90px 90px, 110px 110px, 70px 70px, 100px 100px, 85px 85px, 95px 95px'
    : glitterTheme === 'gold'
    ? 'auto, auto, 60px 60px, 90px 90px, 75px 75px, 110px 110px, 50px 50px, 80px 80px, 95px 95px'
    : glitterTheme === 'purple'
    ? 'auto, auto, 55px 55px, 85px 85px, 70px 70px, 100px 100px, 65px 65px, 90px 90px, 78px 78px'
    : 'auto';

  const sbSparkle = glitterBgImage
    ? glitterBgImage
    : `radial-gradient(ellipse at 20% 20%, rgba(${pRgb},0.18) 0%, transparent 60%),
       radial-gradient(ellipse at 80% 80%, rgba(${pRgb},0.12) 0%, transparent 50%),
       radial-gradient(ellipse at 50% 50%, ${darkMode ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.55)'} 0%, transparent 70%)`;

  const sbBorder = darkMode
    ? `1px solid rgba(${pRgb},0.22)`
    : `1px solid rgba(255,255,255,0.95)`;

  const sbShadow = darkMode
    ? `0 8px 40px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(${pRgb},0.12), 0 0 60px rgba(${pRgb},0.06)`
    : `0 8px 32px rgba(0,0,0,0.10), inset 0 0 0 1px rgba(255,255,255,0.8), 0 0 40px rgba(${pRgb},0.07)`;

  return createPortal(
    <div
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16, background: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className={`w-full ${wide ? 'max-w-5xl' : 'max-w-md'}`}
        style={{
          backgroundColor: baseBg,
          backgroundImage: sbSparkle,
          backgroundSize: glitterBgSize,
          backdropFilter: 'blur(32px) saturate(200%)',
          WebkitBackdropFilter: 'blur(32px) saturate(200%)',
          border: sbBorder,
          borderRadius: 24,
          boxShadow: sbShadow,
          fontFamily: "'Outfit', sans-serif",
          position: 'relative',
          isolation: 'isolate',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Noise sparkle overlay */}
        <div style={{
          position: 'absolute', inset: 0, borderRadius: 'inherit', pointerEvents: 'none', zIndex: 0,
          background: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
          opacity: darkMode ? 0.04 : 0.025,
          mixBlendMode: 'overlay',
        }} />
        {/* Color accent glow top */}
        <div style={{
          position: 'absolute', top: -30, left: '50%', transform: 'translateX(-50%)',
          width: 120, height: 120, borderRadius: '50%',
          background: `radial-gradient(circle, rgba(${pRgb},${darkMode ? 0.20 : 0.12}) 0%, transparent 70%)`,
          pointerEvents: 'none', zIndex: 0, filter: 'blur(20px)',
        }} />
        {/* Content */}
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};

// ─── StudentQA ────────────────────────────────────────────────────────────────

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
      // Pass user.uid so Firestore filters server-side — avoids fetching all students' questions
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
        // Update local state instead of re-fetching all notifications from Firestore
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
      {/* Header — responsive */}
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
            className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-3 sm:px-4 py-2 rounded-lg transition-colors shadow-lg hover:shadow-xl text-sm sm:text-base whitespace-nowrap"
          >
            <Plus size={18} />
            <span>Ask New Question</span>
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
        {/* Search + filter toggle */}
        <div className="flex flex-col gap-3 mb-4 sm:mb-6">
          <div className="flex gap-2">
            <div className="relative flex-1 max-w-md">
              <input
                type="text"
                placeholder="Search questions..."
                className="w-full bg-background-800 text-white rounded-lg py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
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
              {showFilters ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
          </div>

          {/* Filters — always visible sm+, collapsible on mobile */}
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

        <div className="space-y-3 sm:space-y-4">
          {filteredQuestions.length === 0 ? (
            <div className="text-center py-10 sm:py-12 text-gray-400">
              <MessageSquare size={48} className="mx-auto mb-4" />
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
                <div className="flex items-start justify-between gap-2 mb-2 flex-wrap">
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
                    <span className="truncate max-w-xs">{question.fileName}</span>
                  </div>
                )}
                <div className="flex items-center gap-3 text-xs sm:text-sm text-gray-400 flex-wrap">
                  <div className="flex items-center gap-1">
                    <User size={13} />
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

// ─── renderFormattedText ──────────────────────────────────────────────────────

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

// ─── AskQuestionModal ─────────────────────────────────────────────────────────

interface AskQuestionModalProps {
  onClose: () => void;
  onSuccess: () => void;
  studentId: string;
  studentName: string;
  enrolledCoursesWithQnA: Course[];
  helpSupportSubjects: string[];
}

const AskQuestionModal = ({ onClose, onSuccess, studentId, studentName, enrolledCoursesWithQnA, helpSupportSubjects }: AskQuestionModalProps) => {
  const T = useT();

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
  // Mobile tab: 'form' | 'preview' — only used when right panel has content
  const [activeTab, setActiveTab] = useState<'form' | 'preview'>('form');
  
  // Refs to prevent duplicate submissions and store uploaded image
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

  // Auto-switch to preview tab on mobile when right panel content appears
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
    
    // Prevent duplicate submissions
    if (isSubmittingRef.current || loading) {
      console.log('⚠️ Submission already in progress, ignoring duplicate click');
      return;
    }
    
    setError('');

    if (!questionText.trim() || !subject || !selectedCourse) {
      setError('Please fill in all required fields.');
      return;
    }

    if (!hasHumanQnA) {
      setError('Human Teacher Q&A is not available for this course. Please use AI Solve-mate or select a different course.');
      return;
    }

    // Mark as submitting
    isSubmittingRef.current = true;
    setLoading(true);

    try {
      // CRITICAL FIX: Handle new return type {questions, uploadedImageUrl}
      const result = await qaService.findSimilarQuestionsWithFile(
        questionText, 
        subject, 
        attachedFile && getFileType(attachedFile) === 'image' ? attachedFile : null,
        selectedCourse
      );
      
      // Store uploaded image URL for reuse
      if (result.uploadedImageUrl) {
        uploadedImageUrlRef.current = result.uploadedImageUrl;
        console.log('✅ Stored uploaded image URL for reuse');
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
    if (isSubmittingRef.current && loading) {
      console.log('⚠️ Already submitting, skipping');
      return;
    }
    
    isSubmittingRef.current = true;
    setLoading(true);
    setError('');
    setShowSimilarQuestions(false);

    try {
      let imageUrl: string | undefined;
      let audioUrl: string | undefined;
      let fileUrl: string | undefined;
      let fileName: string | undefined;

      // CRITICAL FIX: Reuse uploaded image URL if available
      if (attachedFile) {
        const fileType = getFileType(attachedFile);
        
        if (fileType === 'image') {
          // Reuse already uploaded image URL if available
          if (uploadedImageUrlRef.current) {
            imageUrl = uploadedImageUrlRef.current;
            console.log('✅ Reusing uploaded image URL');
          } else {
            const uploadResult = await qaService.uploadToSupabase(attachedFile, 'question_images');
            imageUrl = uploadResult.url;
          }
        } else {
          const uploadResult = await qaService.uploadToSupabase(
            attachedFile, 
            'question_documents'
          );
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

      // Extract image data if present, then route through smart failover
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
    
    // Prevent duplicate submissions
    if (isSubmittingRef.current || aiLoading) {
      console.log('⚠️ AI solve already in progress, ignoring duplicate click');
      return;
    }
    
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

    // Mark as submitting
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

  // Shared style objects matching LiveExam ExamFormModal exactly
  const inp: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    background: T.inputBg,
    border: `1px solid ${T.inputBorder}`,
    borderRadius: 12,
    color: T.text,
    fontSize: 13,
    outline: 'none',
    boxSizing: 'border-box' as const,
    fontFamily: "'Outfit',sans-serif",
  };
  const lbl: React.CSSProperties = {
    display: 'block',
    fontSize: 13,
    fontWeight: 600,
    color: T.text2,
    marginBottom: 6,
  };

  return (
    <ModalShell onClose={onClose} wide>
      {/* ── Header — identical pattern to ExamFormModal ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '20px 24px 16px', borderBottom: `1px solid ${T.divider}`, flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: `rgba(${T.pRgb},0.15)`, border: `1px solid rgba(${T.pRgb},0.25)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <MessageSquare size={18} style={{ color: T.primaryColor }} />
          </div>
          <div>
            <h2 style={{ color: T.text, fontWeight: 700, fontSize: 17, margin: 0 }}>Ask a New Question</h2>
            <p style={{ color: T.text3, fontSize: 11, margin: '2px 0 0' }}>Submit to teacher or get an instant AI solution</p>
          </div>
        </div>
        <button
          onClick={onClose}
          disabled={loading || aiLoading}
          style={{
            padding: 6, color: T.text2, background: 'none', border: 'none',
            cursor: (loading || aiLoading) ? 'not-allowed' : 'pointer',
            borderRadius: 8, display: 'flex', opacity: (loading || aiLoading) ? 0.4 : 1,
          }}
        >
          <X size={18} />
        </button>
      </div>

      {/* ── Desktop tab switcher — only when right panel has content, desktop only ── */}
      {hasRightPanel && (
        <div
          className="hidden md:flex"
          style={{ gap: 6, padding: '10px 16px 0', flexShrink: 0 }}
        >
          {(['form', 'preview'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                flex: 1, padding: '8px 0', fontSize: 13, fontWeight: 600,
                borderRadius: 10, border: 'none', cursor: 'pointer',
                fontFamily: "'Outfit',sans-serif",
                background: activeTab === tab ? `rgba(${T.pRgb},0.20)` : T.surface,
                color: activeTab === tab ? T.primaryColor : T.text2,
                transition: 'all 0.15s',
              }}
            >
              {tab === 'form' ? 'Form' : showSimilarQuestions ? 'Similar Questions' : 'AI Solution'}
            </button>
          ))}
        </div>
      )}

      {/* ── Body: stacked on mobile (single scroll), two-column on md+ ── */}
      <div
        className="md:flex-row flex-col md:overflow-hidden"
        style={{ flex: 1, minHeight: 0, display: 'flex', overflowY: 'auto' }}
      >

        {/* ── LEFT COLUMN: Form ── */}
        <div
          className={`${hasRightPanel && activeTab !== 'form' ? 'hidden md:flex' : 'flex'} md:w-1/2 w-full md:overflow-y-auto`}
          style={{
            flexDirection: 'column',
            overflowY: 'visible',
            padding: '20px 24px', gap: 18,
            borderRight: `1px solid ${T.divider}`,
          }}
        >
          {/* Error */}
          {error && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 8,
              padding: '10px 14px', background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.25)', borderRadius: 12, flexShrink: 0,
            }}>
              <AlertCircle size={14} style={{ color: T.danger, flexShrink: 0, marginTop: 2 }} />
              <p style={{ color: '#fca5a5', fontSize: 13, margin: 0 }}>{error}</p>
            </div>
          )}

          {/* Course */}
          <div>
            <label style={lbl}>Course <span style={{ color: T.danger }}>*</span></label>
            <select
              value={selectedCourse}
              onChange={(e) => setSelectedCourse(e.target.value)}
              style={inp}
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
            <p style={{ fontSize: 11, color: T.text3, margin: '5px 0 0' }}>
              {enrolledCoursesWithQnA.length === 0 
                ? 'You can use Help & Support for general queries' 
                : selectedCourse && !isHelpSupport
                ? `Available: ${hasAiQnA ? 'AI' : ''}${hasAiQnA && hasHumanQnA ? ' + ' : ''}${hasHumanQnA ? 'Teacher' : ''}`
                : 'Select course to see available Q&A options'}
            </p>
          </div>

          {/* Subject */}
          <div>
            <label style={lbl}>Subject <span style={{ color: T.danger }}>*</span></label>
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              style={inp}
              disabled={loading || aiLoading || !selectedCourse}
              required
            >
              <option value="">Select a subject</option>
              {availableSubjects.map(sub => (
                <option key={sub} value={sub}>{sub}</option>
              ))}
            </select>
            <p style={{ fontSize: 11, color: T.text3, margin: '5px 0 0' }}>
              {!selectedCourse ? 'Please select a course first' : 'Subjects based on selected course'}
            </p>
          </div>

          {/* Question textarea */}
          <div>
            <label style={lbl}>Your Question <span style={{ color: T.danger }}>*</span></label>
            <textarea
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              style={{ ...inp, resize: 'vertical' }}
              placeholder="Type your question here in Bengali or English... (Supports LaTeX: $x^2$ for inline, $$E=mc^2$$ for display)"
              rows={6}
              disabled={loading || aiLoading}
              required
            />
          </div>

          {/* File attachment */}
          <div>
            <label style={lbl}>
              Attach File <span style={{ color: T.text3, fontWeight: 400, fontSize: 11 }}>(Optional)</span>
            </label>
            <input
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/heic,.pdf,.doc,.docx"
              onChange={handleFileChange}
              style={{ ...inp, padding: '8px 12px' }}
              className="file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:cursor-pointer"
              disabled={loading || aiLoading}
            />
            {attachedFile && (
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 8,
                marginTop: 6, fontSize: 12, color: T.text3, flexWrap: 'wrap' as const,
              }}>
                <FileText size={13} style={{ marginTop: 1, flexShrink: 0 }} />
                <span style={{ wordBreak: 'break-all' }}>
                  {attachedFile.name} ({(attachedFile.size / 1024).toFixed(2)} KB)
                </span>
                {getFileType(attachedFile) === 'document' && (
                  <span style={{ color: '#fb923c' }}>
                    (AI can't process documents - use Human Teacher)
                  </span>
                )}
              </div>
            )}
            <p style={{ fontSize: 11, color: T.text3, margin: '5px 0 0', lineHeight: 1.5 }}>
              Human Teacher: All formats (JPG, PNG, HEIC, PDF, DOCX) - Max 10MB<br/>
              AI Solve-mate: Images only (JPG, PNG, HEIC) - Images will be saved
            </p>
          </div>

          {/* Voice message */}
          <div>
            <label style={lbl}>
              Voice Message <span style={{ color: T.text3, fontWeight: 400, fontSize: 11 }}>(Optional)</span>
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' as const }}>
              <button
                type="button"
                onClick={isRecording ? stopRecording : startRecording}
                disabled={loading || aiLoading}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '9px 16px', fontSize: 13, fontWeight: 600,
                  background: isRecording ? 'rgba(239,68,68,0.15)' : T.btnSecBg,
                  border: `1px solid ${isRecording ? 'rgba(239,68,68,0.4)' : T.btnSecBorder}`,
                  color: isRecording ? '#fca5a5' : T.text2,
                  borderRadius: 12,
                  cursor: (loading || aiLoading) ? 'not-allowed' : 'pointer',
                  opacity: (loading || aiLoading) ? 0.5 : 1,
                  fontFamily: "'Outfit',sans-serif",
                  transition: 'all 0.15s',
                }}
              >
                {isRecording ? <Volume2 size={14} className="animate-pulse" /> : <Mic size={14} />}
                <span>{isRecording ? 'Stop Recording' : 'Record Voice'}</span>
              </button>
              {audioFile && (
                <span style={{ fontSize: 12, color: T.text3 }}>
                  Audio recorded ({(audioFile.size / 1024).toFixed(2)} KB)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── RIGHT COLUMN: Similar questions / AI solution / Placeholder ── */}
        <div
          className={`${hasRightPanel && activeTab !== 'preview' ? 'hidden md:flex' : 'flex'} md:w-1/2 w-full md:overflow-y-auto`}
          style={{
            flexDirection: 'column',
            overflowY: 'visible',
            padding: '20px 24px',
            borderTop: `1px solid ${T.divider}`,
          }}
        >
          {showSimilarQuestions ? (
            /* ── Similar Questions Panel ── */
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              {/* Panel header */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                paddingBottom: 14, marginBottom: 14, borderBottom: `1px solid ${T.divider}`, flexShrink: 0,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: 10,
                    background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.25)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Eye size={15} style={{ color: '#60a5fa' }} />
                  </div>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 700, color: T.text, margin: 0 }}>Similar Questions Found</p>
                    <p style={{ fontSize: 11, color: T.text3, margin: 0 }}>Does one of these answer your question?</p>
                  </div>
                </div>
                <button
                  onClick={() => submitToTeacher()}
                  disabled={loading}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '7px 14px', fontSize: 12, fontWeight: 600,
                    background: T.gradient, color: '#fff', border: 'none',
                    borderRadius: 10, cursor: loading ? 'not-allowed' : 'pointer',
                    opacity: loading ? 0.6 : 1, fontFamily: "'Outfit',sans-serif", flexShrink: 0,
                  }}
                >
                  {loading ? <Loader size={12} className="animate-spin" /> : <Send size={12} />}
                  <span>{loading ? 'Submitting...' : 'Submit as New'}</span>
                </button>
              </div>

              <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {similarLoading ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
                    <Loader size={28} className="animate-spin text-primary-500" />
                  </div>
                ) : (
                  <>
                    {similarQuestionsWithAnswers.map(({ question: q, answers }) => (
                      <div
                        key={q.id}
                        style={{
                          background: T.surface, border: `1px solid ${T.border}`,
                          borderRadius: 12, padding: '12px 14px',
                        }}
                      >
                        <div
                          style={{ cursor: 'pointer' }}
                          onClick={() => toggleQuestionExpansion(q.id)}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' as const }}>
                            <BookOpen size={12} style={{ color: T.primaryColor }} />
                            <span style={{ fontSize: 12, fontWeight: 600, color: T.text }}>{q.subject}</span>
                            <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: 'rgba(34,197,94,0.15)', color: '#4ade80', fontWeight: 600 }}>Answered</span>
                            <span style={{ marginLeft: 'auto', color: T.text3, fontSize: 12 }}>
                              {expandedQuestionId === q.id ? '▼' : '▶'}
                            </span>
                          </div>
                          <p style={{ fontSize: 13, color: T.text, margin: '0 0 6px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            {q.questionText}
                          </p>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: T.text3 }}>
                            <User size={10} />
                            <span>{q.studentName}</span>
                            <span>•</span>
                            <span>{q.createdAt.toLocaleDateString()}</span>
                          </div>
                        </div>

                        {expandedQuestionId === q.id && (
                          <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.divider}` }}>
                            <div>
                              <p style={{ fontSize: 11, fontWeight: 700, color: T.primaryColor, textTransform: 'uppercase' as const, letterSpacing: '0.06em', margin: '0 0 6px' }}>Full Question:</p>
                              <p style={{ fontSize: 13, color: T.text, margin: '0 0 10px', whiteSpace: 'pre-wrap' }}>{q.questionText}</p>
                              {q.imageUrl && (
                                <img src={q.imageUrl} alt="Question" style={{ maxHeight: 160, objectFit: 'contain', borderRadius: 8, marginBottom: 8 }} />
                              )}
                              {q.audioUrl && (
                                <div style={{ marginBottom: 8 }}>
                                  <audio controls className="w-full">
                                    <source src={q.audioUrl} type="audio/webm" />
                                  </audio>
                                </div>
                              )}
                              {q.fileName && q.fileUrl && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, marginBottom: 8 }}>
                                  <FileText size={13} style={{ color: T.primaryColor }} />
                                  <span style={{ color: T.text3 }}>{q.fileName}</span>
                                </div>
                              )}
                            </div>

                            {answers.length > 0 && (
                              <div>
                                <p style={{ fontSize: 11, fontWeight: 700, color: T.green, textTransform: 'uppercase' as const, letterSpacing: '0.06em', margin: '0 0 8px' }}>
                                  {answers.length === 1 ? 'Answer:' : `Answers (${answers.length}):`}
                                </p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                  {answers.map((answer) => (
                                    <div
                                      key={answer.id}
                                      style={{
                                        background: T.cardBg, border: `1px solid ${T.divider}`,
                                        borderRadius: 10, padding: '10px 12px',
                                      }}
                                    >
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                                        {answer.type === 'ai' ? (
                                          <>
                                            <Brain size={13} style={{ color: '#a78bfa' }} />
                                            <span style={{ fontSize: 11, color: '#a78bfa' }}>AI Answer</span>
                                          </>
                                        ) : (
                                          <>
                                            <User size={13} style={{ color: '#60a5fa' }} />
                                            <span style={{ fontSize: 11, color: '#60a5fa' }}>Teacher Answer</span>
                                          </>
                                        )}
                                      </div>
                                      <div style={{ fontSize: 13, color: T.text, whiteSpace: 'pre-wrap' }}>
                                        {renderFormattedText(answer.answerText)}
                                      </div>
                                      {answer.imageUrl && (
                                        <img src={answer.imageUrl} alt="Answer" style={{ marginTop: 8, maxHeight: 120, objectFit: 'contain', borderRadius: 8 }} />
                                      )}
                                      {answer.audioUrl && (
                                        <div style={{ marginTop: 8 }}>
                                          <audio controls className="w-full">
                                            <source src={answer.audioUrl} type="audio/webm" />
                                          </audio>
                                        </div>
                                      )}
                                      {answer.fileName && answer.fileUrl && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, marginTop: 6 }}>
                                          <FileText size={12} style={{ color: T.primaryColor }} />
                                          <span style={{ color: T.text3 }}>{answer.fileName}</span>
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

                    <p style={{ fontSize: 11, color: T.text3, paddingTop: 4 }}>
                      Click on any question to expand and view the full answer. If none of these match your question, click "Submit as New" above.
                    </p>
                  </>
                )}
              </div>
            </div>

          ) : showAiSolution ? (
            /* ── AI Solution Panel ── */
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              {/* Panel header */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                paddingBottom: 14, marginBottom: 14, borderBottom: `1px solid ${T.divider}`, flexShrink: 0,
              }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 10,
                  background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.25)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Brain size={15} style={{ color: '#a78bfa' }} />
                </div>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: T.text, margin: 0 }}>AI Solution</p>
                  <p style={{ fontSize: 11, color: T.text3, margin: 0 }}>Powered by AI Solve-mate</p>
                </div>
              </div>

              <div style={{ overflowY: 'auto', flex: 1 }}>
                {aiLoading && aiSolutions.length === 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 0', gap: 12 }}>
                    <Loader size={28} className="animate-spin" style={{ color: '#8b5cf6' }} />
                    <p style={{ color: T.text3, fontSize: 13, margin: 0 }}>AI is analyzing and solving your question...</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {aiSolutions.map((solution, index) => (
                      <div key={index} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {index > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#f97316', fontWeight: 600 }}>
                            <MessageSquare size={13} />
                            <span>Follow-up Answer {index}</span>
                          </div>
                        )}
                        <div className="prose prose-invert max-w-none">
                          <div style={{ fontSize: 13, color: T.text, lineHeight: 1.7 }}>
                            {renderFormattedText(solution)}
                          </div>
                        </div>
                        {index < aiSolutions.length - 1 && (
                          <div style={{ borderTop: `1px solid ${T.divider}`, paddingTop: 8 }}></div>
                        )}
                      </div>
                    ))}
                    
                    <div style={{ fontSize: 11, color: '#f87171', paddingTop: 12, borderTop: `1px solid ${T.divider}` }}>
                      N.B.: AI Solve-mate answers may be inaccurate. Please use the Human Teacher option if you notice a flawed answer.
                    </div>

                    {aiQuestionId && !showFollowUpInput && (
                      <div style={{ paddingTop: 12, borderTop: `1px solid ${T.divider}` }}>
                        <p style={{ fontSize: 12, color: T.text2, margin: '0 0 10px' }}>Was this answer helpful?</p>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            onClick={() => handleAiSatisfaction('satisfied')}
                            disabled={aiLoading}
                            style={{
                              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                              padding: '9px 0', fontSize: 13, fontWeight: 600,
                              background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)',
                              color: '#4ade80', borderRadius: 12,
                              cursor: aiLoading ? 'not-allowed' : 'pointer',
                              opacity: aiLoading ? 0.5 : 1, fontFamily: "'Outfit',sans-serif",
                            }}
                          >
                            <ThumbsUp size={14} />
                            <span>Satisfied</span>
                          </button>
                          <button
                            onClick={() => handleAiSatisfaction('confused')}
                            disabled={aiLoading}
                            style={{
                              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                              padding: '9px 0', fontSize: 13, fontWeight: 600,
                              background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.3)',
                              color: '#fb923c', borderRadius: 12,
                              cursor: aiLoading ? 'not-allowed' : 'pointer',
                              opacity: aiLoading ? 0.5 : 1, fontFamily: "'Outfit',sans-serif",
                            }}
                          >
                            <HelpCircle size={14} />
                            <span>Still Confused</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {showFollowUpInput && (
                      <div style={{ paddingTop: 12, borderTop: `1px solid ${T.divider}`, display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <label style={lbl}>Ask your follow-up question:</label>
                        <textarea
                          value={followUpText}
                          onChange={(e) => setFollowUpText(e.target.value)}
                          style={{ ...inp, resize: 'vertical' }}
                          placeholder="What are you still confused about?"
                          rows={4}
                          disabled={aiLoading}
                        />
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            onClick={handleFollowUpSubmit}
                            disabled={aiLoading || !followUpText.trim()}
                            style={{
                              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                              padding: '9px 0', fontSize: 13, fontWeight: 600,
                              background: 'rgba(139,92,246,0.8)', color: '#fff', border: 'none',
                              borderRadius: 12,
                              cursor: (aiLoading || !followUpText.trim()) ? 'not-allowed' : 'pointer',
                              opacity: (aiLoading || !followUpText.trim()) ? 0.5 : 1,
                              fontFamily: "'Outfit',sans-serif",
                            }}
                          >
                            {aiLoading && <Loader size={13} className="animate-spin" />}
                            <span>{aiLoading ? 'Getting answer...' : 'Submit'}</span>
                          </button>
                          <button
                            onClick={() => {
                              setShowFollowUpInput(false);
                              setFollowUpText('');
                            }}
                            disabled={aiLoading}
                            style={{
                              padding: '9px 18px', fontSize: 13, fontWeight: 600,
                              background: T.btnSecBg, border: `1px solid ${T.btnSecBorder}`,
                              color: T.text2, borderRadius: 12,
                              cursor: aiLoading ? 'not-allowed' : 'pointer',
                              fontFamily: "'Outfit',sans-serif",
                            }}
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

          ) : (
            /* ── Placeholder panel ── */
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', height: '100%', minHeight: 320,
              textAlign: 'center', padding: '24px 16px',
            }}>
              <div style={{
                width: 56, height: 56, borderRadius: 16,
                background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.22)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14,
              }}>
                <Brain size={26} style={{ color: '#a78bfa' }} />
              </div>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: T.text, margin: '0 0 8px' }}>AI Solve-mate</h3>
              <p style={{ fontSize: 13, color: T.text3, margin: '0 0 10px', maxWidth: 300, lineHeight: 1.5 }}>
                {isHelpSupport 
                  ? 'AI Solve-mate is not available for Help & Support. Please use the Human Teacher option for assistance.'
                  : !hasAiQnA
                  ? 'AI Q&A is not enabled for this course. Please use the Human Teacher option or select a different course.'
                  : 'Click "AI Solve-mate" to get an instant solution. AI can analyze images and solve your questions!'}
              </p>
              {!isHelpSupport && hasAiQnA && (
                <>
                  <p style={{ fontSize: 11, color: T.text3, margin: '0 0 4px' }}>
                    Supports Bengali (বাংলা), Banglish (keno, kivabe), and English
                  </p>
                  <p style={{ fontSize: 11, color: '#a78bfa', margin: 0 }}>
                    Can analyze images (JPG, PNG, HEIC) • LaTeX math rendering • Images saved to database
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Footer ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '12px 16px', borderTop: `1px solid ${T.divider}`,
        flexShrink: 0,
      }}>
        {/* Cancel — small fixed icon button */}
        <button
          onClick={onClose}
          disabled={loading || aiLoading}
          title="Cancel"
          style={{
            flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 40, height: 40,
            fontSize: 13, fontWeight: 600,
            color: T.text2, background: T.btnSecBg, border: `1px solid ${T.btnSecBorder}`,
            borderRadius: 10,
            cursor: (loading || aiLoading) ? 'not-allowed' : 'pointer',
            opacity: (loading || aiLoading) ? 0.5 : 1,
            fontFamily: "'Outfit',sans-serif",
          }}
        >
          <X size={15} />
        </button>

        {/* Submit to Teacher */}
        <button
          onClick={handleSubmitToTeacher}
          disabled={loading || aiLoading || !selectedCourse || !hasHumanQnA}
          title={!hasHumanQnA ? 'Human Teacher Q&A is not available for this course' : 'Submit to Human Teacher'}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '9px 10px', fontSize: 13, fontWeight: 600,
            background: (!selectedCourse || !hasHumanQnA) ? T.btnSecBg : T.gradient,
            color: (!selectedCourse || !hasHumanQnA) ? T.text3 : '#fff',
            border: (!selectedCourse || !hasHumanQnA) ? `1px solid ${T.btnSecBorder}` : 'none',
            borderRadius: 10,
            cursor: (loading || aiLoading || !selectedCourse || !hasHumanQnA) ? 'not-allowed' : 'pointer',
            opacity: (loading || aiLoading) ? 0.6 : 1,
            fontFamily: "'Outfit',sans-serif",
          }}
        >
          {loading ? <Loader size={13} className="animate-spin" /> : <User size={13} />}
          {loading ? (
            <span>Submitting...</span>
          ) : hasHumanQnA ? (
            <><span className="hidden sm:inline">Submit to </span><span>Teacher</span></>
          ) : (
            <span>Q&A Off</span>
          )}
        </button>

        {/* AI Solve-mate */}
        <button
          onClick={handleAiSolve}
          disabled={loading || aiLoading || !selectedCourse || isHelpSupport || !hasAiQnA || (attachedFile !== null && getFileType(attachedFile) === 'document')}
          title={
            isHelpSupport
              ? 'AI Solve-mate is not available for Help & Support'
              : !hasAiQnA
              ? 'AI Q&A is not available for this course'
              : attachedFile && getFileType(attachedFile) === 'document'
              ? 'AI can only process images. Please use Human Teacher for documents.'
              : 'AI Solve-mate'
          }
          style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '9px 10px', fontSize: 13, fontWeight: 600,
            background: (!selectedCourse || isHelpSupport || !hasAiQnA)
              ? 'rgba(139,92,246,0.12)'
              : 'linear-gradient(135deg,#7c3aed 0%,#a855f7 100%)',
            color: (!selectedCourse || isHelpSupport || !hasAiQnA) ? '#9f7aea' : '#fff',
            border: (!selectedCourse || isHelpSupport || !hasAiQnA) ? '1px solid rgba(139,92,246,0.3)' : 'none',
            borderRadius: 10,
            cursor: (loading || aiLoading || !selectedCourse || isHelpSupport || !hasAiQnA || (attachedFile !== null && getFileType(attachedFile) === 'document'))
              ? 'not-allowed' : 'pointer',
            opacity: (loading || aiLoading) ? 0.6 : 1,
            fontFamily: "'Outfit',sans-serif",
            whiteSpace: 'nowrap',
          }}
        >
          {aiLoading ? <Loader size={13} className="animate-spin" /> : <Brain size={13} />}
          {aiLoading ? (
            <span>Solving...</span>
          ) : isHelpSupport || !hasAiQnA ? (
            <span>AI N/A</span>
          ) : (
            <span>Solve-mate</span>
          )}
        </button>
      </div>
    </ModalShell>
  );
};

export default StudentQA;
