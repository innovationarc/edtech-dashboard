// src/pages/StudentDashboard.tsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Target, Calendar, Star, Play, Pause, RotateCcw, Plus,
  CheckCircle, Circle, Megaphone, Award, X, Loader,
  AlertCircle, Video, Radio, Timer, Volume2, VolumeX,
  Coffee, Trash, ChevronDown, ChevronUp, Layers, CheckCircle2, Tag,
} from 'lucide-react';
import Card from '../components/ui/Card';
import { useDashboard } from '../contexts/DashboardContext';
import { getRandomQuote } from '../utils/quotes';
import { announcementService, Announcement } from '../services/announcementService';
import { courseService } from '../services/courseService';
import { gamificationService } from '../services/gamificationService';
import { qaService } from '../services/qaService';
import {
  studyPlanService, StudyPlanEvent, StudyGoal,
  SelectedTopicItem, EnrolledCourseForPlanning,
} from '../services/studyPlanService';
import { calcTotalHoursFromTopics, calcHoursRange } from '../services/studySchedulerService';
import { topicGroupService, TopicGroup } from '../services/topicGroupService';
import StudyPlanEventModal from '../components/shared/StudyPlanEventModal';
import { liveClassService } from '../services/liveClassService';
import { LiveClass } from '../types/liveClassTypes';
import { streamService } from '../services/streamService';
import { LiveStream } from '../types/streamTypes';
import { liveExamService, LiveExam } from '../services/liveExamService';
import { dashboardService, DashboardObjective } from '../services/dashboardService';
import { inspirationService, Inspiration } from '../services/inspirationService';

// ─── Types ────────────────────────────────────────────────────────────────────
type GoalMode = 'simple' | 'topic' | 'course';
interface TopicStar { id: string; name: string; mastered: boolean; progress: number; position: { x: number; y: number }; }
interface SubjectConstellation { id: string; name: string; color: string; stars: TopicStar[]; overallProgress: number; }

// ─── Constants ────────────────────────────────────────────────────────────────
const POMODORO_DURATIONS = { focus: 25 * 60, short: 5 * 60, long: 15 * 60 };

// ─── Helpers ──────────────────────────────────────────────────────────────────
const PC  = (p: string) => p === 'high' ? '#ef4444' : p === 'medium' ? '#f59e0b' : '#10b981';
const APB = (p: string) => p === 'high' ? '#ef4444' : p === 'medium' ? '#f59e0b' : p === 'low' ? '#10b981' : 'rgba(255,255,255,0.1)';
const EDC = (t: string) => {
  const s = t.toLowerCase();
  return s.includes('exam') || s.includes('test') || s.includes('quiz') ? '#ef4444'
    : s.includes('assignment') || s.includes('due') ? '#f59e0b'
    : s.includes('class') || s.includes('lecture') ? '#6366f1'
    : '#10b981';
};

// ─── Component ────────────────────────────────────────────────────────────────
const StudentDashboard = () => {
  const { user, primaryColor = '#6366f1', theme } = useDashboard();
  const navigate = useNavigate();
  const isLight  = theme === 'light';
  const dark     = !isLight;

  const T = {
    text:    isLight ? '#111827'            : 'rgba(255,255,255,0.88)',
    text2:   isLight ? '#6b7280'            : 'rgba(255,255,255,0.52)',
    text3:   isLight ? '#9ca3af'            : 'rgba(255,255,255,0.32)',
    muted:   isLight ? 'rgba(0,0,0,0.45)'  : 'rgba(255,255,255,0.38)',
    surface: isLight ? 'rgba(0,0,0,0.045)' : 'rgba(255,255,255,0.06)',
    border:  isLight ? 'rgba(0,0,0,0.075)' : 'rgba(255,255,255,0.08)',
    dimIcon: isLight ? 'rgba(0,0,0,0.25)'  : 'rgba(255,255,255,0.24)',
    trackBg: isLight ? 'rgba(0,0,0,0.08)'  : 'rgba(255,255,255,0.09)',
    starBg:  isLight ? 'rgba(0,0,0,0.06)'  : 'rgba(0,0,0,0.22)',
    tagBg:   isLight ? 'rgba(0,0,0,0.06)'  : 'rgba(255,255,255,0.065)',
  };

  const inputCls = 'w-full bg-background-700 text-white text-sm rounded-xl px-3 py-2.5 border border-background-600 focus:outline-none focus:border-primary-500 transition-colors placeholder-gray-500';

  // ── Data state ────────────────────────────────────────────────────────────
  const [isMobile, setIsMobile]                         = useState(() => window.innerWidth < 768);
  const [announcements, setAnnouncements]               = useState<Announcement[]>([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(true);
  const [announcementsError, setAnnouncementsError]     = useState('');
  const [calendarEvents, setCalendarEvents]             = useState<StudyPlanEvent[]>([]);
  const [calendarLoading, setCalendarLoading]           = useState(true);
  const [liveClasses, setLiveClasses]                   = useState<LiveClass[]>([]);
  const [liveStreams, setLiveStreams]                   = useState<LiveStream[]>([]);
  const [liveExams, setLiveExams]                       = useState<LiveExam[]>([]);
  const [objectives, setObjectives]                     = useState<DashboardObjective[]>([]);
  const [objectivesLoading, setObjectivesLoading]       = useState(true);
  const [goals, setGoals]                               = useState<StudyGoal[]>([]);
  const [goalsLoading, setGoalsLoading]                 = useState(true);
  const [inspiration, setInspiration]                   = useState<Inspiration | null>(null);
  const [inspirationLoading, setInspirationLoading]     = useState(true);
  const [localQuote]                                    = useState(() => getRandomQuote());
  const [enrolledCourses, setEnrolledCourses]           = useState<EnrolledCourseForPlanning[]>([]);

  // UI state
  const [showObjModal, setShowObjModal]     = useState(false);
  const [showGoalModal, setShowGoalModal]   = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);
  const [selectedDate]                      = useState(new Date());

  // ── Pomodoro state ────────────────────────────────────────────────────────
  const [pomodoroActive, setPomodoroActive]             = useState(false);
  const [pomodoroMode, setPomodoroMode]                 = useState<'focus' | 'short' | 'long'>('focus');
  const [pomodoroTime, setPomodoroTime]                 = useState(POMODORO_DURATIONS.focus);
  const [pomodoroSubject, setPomodoroSubject]           = useState('');
  const [pomodoroLinkedEvent, setPomodoroLinkedEvent]   = useState('');
  const [pomodoroSessionCount, setPomodoroSessionCount] = useState(0);
  const [pomodoroPhase, setPomodoroPhase]               = useState<'idle' | 'focus' | 'break'>('idle');
  const [pomodoroTodayMinutes, setPomodoroTodayMinutes] = useState(0);
  const [pomodoroStartTime, setPomodoroStartTime]       = useState<Date | null>(null);
  const [pomodoroSoundEnabled, setPomodoroSoundEnabled] = useState(true);
  const [streak, setStreak]                             = useState({ current: 0, longest: 0, totalSessions: 0 });
  const pomodoroRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // ── Goal form state ───────────────────────────────────────────────────────
  const [newGoal, setNewGoal]             = useState({ subject: '', targetDate: '', hoursNeeded: 10, difficulty: 'medium' as StudyGoal['difficulty'] });
  const [savingGoal, setSavingGoal]       = useState(false);
  const [goalMode, setGoalMode]           = useState<GoalMode>('simple');
  const [goalStudyMode, setGoalStudyMode] = useState<'first_reading' | 'revision'>('first_reading');
  const [manualTopics, setManualTopics]   = useState<SelectedTopicItem[]>([]);
  const [topicInput, setTopicInput]       = useState({ name: '', minHours: 1, maxHours: 2, difficulty: 'medium' as SelectedTopicItem['difficulty'] });
  const [ctCourseId, setCtCourseId]               = useState('');
  const [ctGroups, setCtGroups]                   = useState<TopicGroup[]>([]);
  const [ctLoadingGroups, setCtLoadingGroups]     = useState(false);
  const [ctSelSubjects, setCtSelSubjects]         = useState<Set<string>>(new Set());
  const [ctSelChapters, setCtSelChapters]         = useState<Set<string>>(new Set());
  const [ctSelTopics, setCtSelTopics]             = useState<Set<string>>(new Set());
  const [ctExpandedSubjects, setCtExpandedSubjects] = useState<Set<string>>(new Set());
  const [ctExpandedChapters, setCtExpandedChapters] = useState<Set<string>>(new Set());

  const selectedCourseTopics = useMemo<SelectedTopicItem[]>(() => {
    const result: SelectedTopicItem[] = [];
    for (const grp of ctGroups)
      for (const subj of grp.subjects)
        for (const chap of subj.chapters)
          for (const t of chap.topics)
            if (ctSelTopics.has(t.id))
              result.push({ id: t.id, name: t.name, minHours: (t as any).minHours ?? 1, maxHours: (t as any).maxHours ?? 2, difficulty: (t as any).difficulty ?? 'medium', chapterName: chap.name, subjectName: subj.name });
    return result;
  }, [ctGroups, ctSelSubjects, ctSelChapters, ctSelTopics]);

  const activeTopics         = goalMode === 'topic' ? manualTopics : goalMode === 'course' ? selectedCourseTopics : [];
  const calculatedHoursRange = activeTopics.length > 0 ? calcHoursRange(activeTopics) : null;
  const calculatedHours      = activeTopics.length > 0 ? calcTotalHoursFromTopics(activeTopics, goalStudyMode) : 0;

  // ── Constellations (static) ───────────────────────────────────────────────
  const [constellations] = useState<SubjectConstellation[]>([
    { id: '1', name: 'Mathematics', color: '#6366f1', overallProgress: 75, stars: [
      { id: '1', name: 'Algebra', mastered: true, progress: 100, position: { x: 20, y: 30 } },
      { id: '2', name: 'Geometry', mastered: true, progress: 100, position: { x: 60, y: 20 } },
      { id: '3', name: 'Calculus', mastered: false, progress: 60, position: { x: 40, y: 60 } },
      { id: '4', name: 'Statistics', mastered: false, progress: 30, position: { x: 80, y: 50 } },
      { id: '5', name: 'Trigonometry', mastered: false, progress: 45, position: { x: 30, y: 80 } },
    ]},
    { id: '2', name: 'Physics', color: '#8b5cf6', overallProgress: 60, stars: [
      { id: '6', name: 'Mechanics', mastered: true, progress: 100, position: { x: 25, y: 25 } },
      { id: '7', name: 'Thermodynamics', mastered: false, progress: 70, position: { x: 70, y: 30 } },
      { id: '8', name: 'Electromagnetism', mastered: false, progress: 40, position: { x: 50, y: 70 } },
      { id: '9', name: 'Optics', mastered: false, progress: 20, position: { x: 80, y: 60 } },
    ]},
    { id: '3', name: 'Biology', color: '#10b981', overallProgress: 85, stars: [
      { id: '10', name: 'Cell Biology', mastered: true, progress: 100, position: { x: 30, y: 20 } },
      { id: '11', name: 'Genetics', mastered: true, progress: 100, position: { x: 70, y: 25 } },
      { id: '12', name: 'Evolution', mastered: true, progress: 100, position: { x: 50, y: 50 } },
      { id: '13', name: 'Ecology', mastered: false, progress: 80, position: { x: 25, y: 75 } },
      { id: '14', name: 'Anatomy', mastered: false, progress: 65, position: { x: 75, y: 70 } },
    ]},
  ]);

  // ─────────────────────────────────────────────────────────────────────────
  // Effects
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);

  useEffect(() => {
    if (!user) return;
    loadAnnouncements(); loadCalendarEvents(); loadLiveClasses(); loadLiveStreams();
    loadLiveExams(); loadObjectives(); loadGoals(); loadInspiration();
    loadEnrolledCourses(); loadStreakData();
    const iv = setInterval(() => { loadAnnouncements(); loadCalendarEvents(); loadLiveClasses(); loadLiveStreams(); loadLiveExams(); }, 30000);
    return () => clearInterval(iv);
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (user?.role !== 'student') return;
    let unsubs: (() => void)[] = [];
    (async () => {
      try {
        const qs = await qaService.getQuestions(undefined, 'all');
        qs.filter(q => q.studentId === user.uid).forEach(q => {
          unsubs.push(qaService.onAnswerToQuestion(q.id, answers => {
            if (answers.length > 0 && q.status === 'pending' && (window as any).addNotification)
              (window as any).addNotification(`Your question "${q.questionText}" has been answered!`, 'success');
          }));
        });
      } catch {}
    })();
    return () => unsubs.forEach(u => u());
  }, [user]);

  // Pomodoro tick
  useEffect(() => {
    if (pomodoroActive) {
      pomodoroRef.current = setInterval(() => {
        setPomodoroTime(t => {
          if (t <= 1) {
            setPomodoroActive(false);
            if (pomodoroMode === 'focus' && user) {
              playPomodoroSound('focus');
              const sessionMins = 25;
              const sessionStart = pomodoroStartTime || new Date(Date.now() - sessionMins * 60 * 1000);
              studyPlanService.savePomodoroSession({
                studentId: user.uid, subject: pomodoroSubject || 'General',
                startTime: sessionStart, duration: sessionMins, completed: true,
                notes: pomodoroLinkedEvent ? `Linked to event: ${pomodoroLinkedEvent}` : '',
              }).then(() => studyPlanService.getStreak(user.uid))
                .then(s => { if (s) setStreak({ current: s.currentStreak, longest: s.longestStreak, totalSessions: s.totalSessions }); })
                .catch(() => {});
              gamificationService.recordActivity(user.uid, 'study_session', { duration: sessionMins }).catch(() => {});
              setPomodoroTodayMinutes(prev => prev + sessionMins);
              const newCount = pomodoroSessionCount + 1;
              setPomodoroSessionCount(newCount);
              setPomodoroPhase('break');
              const nextMode = newCount % 4 === 0 ? 'long' : 'short';
              setPomodoroMode(nextMode);
              return POMODORO_DURATIONS[nextMode];
            } else {
              playPomodoroSound('break');
              setPomodoroMode('focus');
              setPomodoroPhase('idle');
              return POMODORO_DURATIONS.focus;
            }
          }
          return t - 1;
        });
      }, 1000);
    } else {
      if (pomodoroRef.current) clearInterval(pomodoroRef.current);
    }
    return () => { if (pomodoroRef.current) clearInterval(pomodoroRef.current); };
  }, [pomodoroActive, pomodoroMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─────────────────────────────────────────────────────────────────────────
  // Pomodoro helpers
  // ─────────────────────────────────────────────────────────────────────────
  const playPomodoroSound = (type: 'focus' | 'break') => {
    if (!pomodoroSoundEnabled) return;
    try {
      if (!audioCtxRef.current || audioCtxRef.current.state === 'closed')
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      const ctx = audioCtxRef.current;
      const playNote = (freq: number, startAt: number, duration: number, gain = 0.4) => {
        const osc = ctx.createOscillator(); const g = ctx.createGain();
        osc.connect(g); g.connect(ctx.destination); osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + startAt);
        g.gain.setValueAtTime(0, ctx.currentTime + startAt);
        g.gain.linearRampToValueAtTime(gain, ctx.currentTime + startAt + 0.05);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startAt + duration);
        osc.start(ctx.currentTime + startAt); osc.stop(ctx.currentTime + startAt + duration + 0.05);
      };
      if (type === 'focus') { playNote(523.25, 0.0, 0.6, 0.35); playNote(659.25, 0.25, 0.6, 0.35); playNote(783.99, 0.5, 0.9, 0.4); }
      else { playNote(440, 0.0, 0.8, 0.25); }
    } catch {}
  };

  const startPomodoro = () => {
    if (!pomodoroActive) { setPomodoroStartTime(new Date()); setPomodoroPhase('focus'); }
    setPomodoroActive(p => !p);
  };
  const resetPomodoro = (mode: 'focus' | 'short' | 'long') => {
    setPomodoroActive(false); setPomodoroMode(mode); setPomodoroTime(POMODORO_DURATIONS[mode]); setPomodoroPhase('idle'); setPomodoroStartTime(null);
  };
  const resetPomodoroSitting = () => {
    setPomodoroActive(false); setPomodoroMode('focus'); setPomodoroTime(POMODORO_DURATIONS.focus); setPomodoroSessionCount(0); setPomodoroPhase('idle'); setPomodoroStartTime(null);
  };

  const pct           = Math.round((1 - pomodoroTime / POMODORO_DURATIONS[pomodoroMode]) * 100);
  const pMins         = String(Math.floor(pomodoroTime / 60)).padStart(2, '0');
  const pSecs         = String(pomodoroTime % 60).padStart(2, '0');
  const circumference = 2 * Math.PI * 54;

  // ─────────────────────────────────────────────────────────────────────────
  // Loaders
  // ─────────────────────────────────────────────────────────────────────────
  const loadObjectives = async () => {
    if (!user) return;
    try { setObjectivesLoading(true); setObjectives(await dashboardService.getObjectives(user.uid)); }
    catch (e) { console.error('[dashboardService.getObjectives]', e); }
    finally { setObjectivesLoading(false); }
  };
  const loadGoals = async () => {
    if (!user) return;
    try { setGoalsLoading(true); setGoals(await studyPlanService.getGoalsForStudent(user.uid)); }
    catch {} finally { setGoalsLoading(false); }
  };
  const loadInspiration = async () => {
    try { setInspirationLoading(true); setInspiration(await inspirationService.getRandom()); }
    catch {} finally { setInspirationLoading(false); }
  };
  const loadEnrolledCourses = async () => {
    if (!user) return;
    try { setEnrolledCourses(await studyPlanService.getEnrolledCoursesForPlanning(user.uid)); } catch {}
  };
  const loadStreakData = async () => {
    if (!user) return;
    try {
      const s = await studyPlanService.getStreak(user.uid);
      if (s) setStreak({ current: s.currentStreak, longest: s.longestStreak, totalSessions: s.totalSessions });
      const sessions = await studyPlanService.getPomodoroSessions(user.uid, 50);
      const todayStr = new Date().toISOString().slice(0, 10);
      setPomodoroTodayMinutes(sessions.filter(s => s.completed && s.startTime.toISOString().slice(0, 10) === todayStr).reduce((sum, s) => sum + s.duration, 0));
    } catch {}
  };
  const loadAnnouncements = async () => {
    if (!user) return;
    try {
      setAnnouncementsLoading(true); setAnnouncementsError('');
      let ids: string[] = [];
      try { ids = (await courseService.getStudentEnrollments(user.uid)).map(e => e.courseId); } catch {}
      setAnnouncements(await announcementService.getAnnouncementsForUser(user.uid, user.role, ids));
    } catch { setAnnouncementsError('Failed to load'); } finally { setAnnouncementsLoading(false); }
  };
  const loadCalendarEvents = async () => {
    if (!user) return;
    try {
      setCalendarLoading(true);
      const all = await studyPlanService.getEventsForStudent(user.uid);
      const now = new Date(); const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const next = new Date(today); next.setDate(today.getDate() + 7);
      setCalendarEvents(all.filter(e => { const d = new Date(e.date.getFullYear(), e.date.getMonth(), e.date.getDate()); return d >= today && d <= next; }).sort((a, b) => a.date.getTime() - b.date.getTime()));
    } catch { setCalendarEvents([]); } finally { setCalendarLoading(false); }
  };
  const loadLiveClasses = async () => {
    try {
      const all = await liveClassService.getAll(); const now = new Date(); const in48h = new Date(now.getTime() + 48 * 3600000);
      setLiveClasses(all.filter(c => { if (c.status === 'live') return true; if (c.status === 'scheduled') { const t = c.scheduledAt.toDate(); return t >= now && t <= in48h; } return false; }));
    } catch {}
  };
  const loadLiveStreams = async () => {
    try {
      const all = await streamService.getAll(); const now = new Date(); const in48h = new Date(now.getTime() + 48 * 3600000);
      setLiveStreams(all.filter(s => { if (s.status === 'live') return true; if (s.status === 'scheduled' && s.scheduledAt) { const t = s.scheduledAt.toDate(); return t >= now && t <= in48h; } return false; }));
    } catch {}
  };
  const loadLiveExams = async () => {
    if (!user) return;
    try {
      const now = new Date(); const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      let ids: string[] = [];
      try { ids = (await courseService.getStudentEnrollments(user.uid)).map(e => e.courseId); } catch {}
      const eligible = await liveExamService.getLiveExamsForStudent(user.uid, ids);
      const todayExams = eligible.filter(e => {
        if (e.status !== 'active') return false;
        if (e.examTimelineType === 'anytime') return true;
        const start = e.examStartDateTime ? new Date(e.examStartDateTime) : null;
        const end   = e.examEndDateTime   ? new Date(e.examEndDateTime)   : null;
        if (end && now > end) return false;
        if (start && start > todayEnd) return false;
        return true;
      });
      const withAttempts = await Promise.all(todayExams.map(async e => {
        if (e.maxAttempts === 'unlimited') return e;
        const record = await liveExamService.getStudentAttemptRecord(e.id, user.uid);
        return (record?.attemptCount ?? 0) < (e.maxAttempts as number) ? e : null;
      }));
      setLiveExams(withAttempts.filter((e): e is LiveExam => e !== null));
    } catch {}
  };
  const loadCourseTopics = async (courseId: string) => {
    if (!courseId) { setCtGroups([]); setNewGoal(p => ({ ...p, subject: '' })); return; }
    const course = enrolledCourses.find(c => c.courseId === courseId);
    if (course) setNewGoal(p => ({ ...p, subject: course.title }));
    setCtLoadingGroups(true);
    try {
      const groups = await topicGroupService.getGroupsByCourse(courseId);
      setCtGroups(groups); setCtSelSubjects(new Set()); setCtSelChapters(new Set()); setCtSelTopics(new Set()); setCtExpandedSubjects(new Set()); setCtExpandedChapters(new Set());
    } catch { setCtGroups([]); } finally { setCtLoadingGroups(false); }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Actions
  // ─────────────────────────────────────────────────────────────────────────
  const toggleObj = async (id: string, current: boolean) => {
    setObjectives(prev => prev.map(o => o.id === id ? { ...o, completed: !current } : o));
    try { await dashboardService.toggleObjective(id, !current); }
    catch { setObjectives(prev => prev.map(o => o.id === id ? { ...o, completed: current } : o)); }
  };
  const addObj = async (title: string, priority: 'high' | 'medium' | 'low') => {
    if (!user) return; setShowObjModal(false);
    try { const obj = await dashboardService.addObjective(user.uid, title, priority); setObjectives(prev => [...prev, obj]); } catch {}
  };
  const resetGoalForm = () => {
    setNewGoal({ subject: '', targetDate: '', hoursNeeded: 10, difficulty: 'medium' });
    setGoalMode('simple'); setGoalStudyMode('first_reading');
    setManualTopics([]); setTopicInput({ name: '', minHours: 1, maxHours: 2, difficulty: 'medium' });
    setCtCourseId(''); setCtGroups([]); setCtSelSubjects(new Set()); setCtSelChapters(new Set()); setCtSelTopics(new Set()); setCtExpandedSubjects(new Set()); setCtExpandedChapters(new Set());
  };
  const handleAddGoal = async () => {
    if (!user || !newGoal.targetDate || savingGoal) return;
    if (goalMode !== 'course' && !newGoal.subject) return;
    if (goalMode === 'course' && !ctCourseId) return;
    setSavingGoal(true);
    try {
      const hasTopics = goalMode !== 'simple' && activeTopics.length > 0;
      const hours     = hasTopics ? Math.max(1, calculatedHours) : newGoal.hoursNeeded;
      let difficulty  = newGoal.difficulty;
      if (hasTopics) {
        const counts = { easy: 0, medium: 0, hard: 0 };
        activeTopics.forEach(t => counts[t.difficulty]++);
        difficulty = (Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]) as StudyGoal['difficulty'];
      }
      await studyPlanService.createGoal({
        studentId: user.uid, subject: newGoal.subject,
        targetDate: new Date(newGoal.targetDate + 'T12:00:00'),
        hoursNeeded: hours, hoursCompleted: 0, difficulty, currentProgress: 0, isActive: true,
        ...(hasTopics ? { topics: activeTopics, studyMode: goalStudyMode } : {}),
        ...(goalMode === 'course' && ctCourseId ? { courseId: ctCourseId } : {}),
      });
      resetGoalForm(); setShowGoalModal(false);
      setGoals(await studyPlanService.getGoalsForStudent(user.uid));
    } catch {}
    finally { setSavingGoal(false); }
  };

  // Derived
  const todayEventsForTimer = calendarEvents.filter(e => e.date.toDateString() === new Date().toDateString() && !e.completed);
  const inspirationText     = inspiration ? inspiration.text   : localQuote.text;
  const inspirationAuthor   = inspiration ? inspiration.author : localQuote.author;
  const timeDiff = (ms: number) => { const h = Math.floor(ms / 3600000); const m = Math.floor((ms % 3600000) / 60000); return h > 0 ? `In ${h}h ${m}m` : `In ${m}m`; };

  // ═════════════════════════════════════════════════════════════════════════
  // JSX
  // ═════════════════════════════════════════════════════════════════════════
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(18px,2.8vw,30px)', fontFamily: "'Outfit',sans-serif" }}>

      {/* Welcome */}
      <div>
        <div className="flex items-start justify-between">
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ fontSize: 'clamp(1.2rem,2.5vw,1.6rem)', fontWeight: 800, color: T.text, margin: 0, lineHeight: isMobile ? 1.25 : 1.15 }}>
              Welcome back, <span style={{ display: 'inline-block' }}>{user?.name || 'Student'}! 🌟</span>
            </h1>
            {!isMobile && <p style={{ color: T.text2, fontSize: 14, margin: '2px 0 0' }}>Ready to conquer your learning goals today?</p>}
          </div>
          <div style={{ flexShrink: 0, marginLeft: 12, textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: T.text3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Today</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: T.text, whiteSpace: 'nowrap' }}>
              {new Date().toLocaleDateString('en-US', isMobile ? { weekday: 'short', month: 'short', day: 'numeric' } : { weekday: 'long', month: 'short', day: 'numeric' })}
            </div>
          </div>
        </div>
        {isMobile && <p style={{ color: T.text2, fontSize: 14, margin: '4px 0 0' }}>Ready to conquer your learning goals today?</p>}
      </div>

      {/* Live Streams */}
      {liveStreams.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Radio size={15} color={primaryColor} /><span style={{ fontSize: 12, fontWeight: 700, color: T.text3, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Live Streams</span></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,280px),1fr))', gap: 'clamp(8px,1.2vw,14px)' }}>
            {liveStreams.map(s => {
              const isLive = s.status === 'live';
              const diff = (s.scheduledAt?.toDate().getTime() ?? Date.now()) - Date.now();
              return (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderRadius: 13, background: isLive ? 'rgba(99,102,241,0.08)' : T.surface, border: `1px solid ${isLive ? 'rgba(99,102,241,0.28)' : T.border}` }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: isLive ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.08)' }}>
                    {isLive ? <span style={{ width: 10, height: 10, borderRadius: '50%', background: primaryColor, boxShadow: `0 0 0 3px ${primaryColor}40`, display: 'block', animation: 'pulse 1.5s ease-in-out infinite' }} /> : <Radio size={16} color={primaryColor} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 'clamp(0.72rem,1.1vw,0.8rem)', fontWeight: 700, color: T.text, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                      {isLive && <span style={{ fontSize: 9, fontWeight: 800, background: 'rgba(99,102,241,0.18)', color: primaryColor, borderRadius: 4, padding: '1px 5px' }}>LIVE</span>}
                      <span style={{ fontSize: 10, color: isLive ? `${primaryColor}bb` : T.text3 }}>{isLive ? 'Live now' : timeDiff(diff)}</span>
                      {s.teacherName && <span style={{ fontSize: 10, color: T.text3 }}>· {s.teacherName}</span>}
                    </div>
                  </div>
                  <button onClick={() => navigate('/student-streams')} style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, fontFamily: "'Outfit',sans-serif", background: `${primaryColor}cc`, color: '#fff' }}>
                    <Play size={10} fill="#fff" />{isLive ? 'Watch' : 'View'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Live Classes */}
      {liveClasses.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Video size={15} color="#ef4444" /><span style={{ fontSize: 12, fontWeight: 700, color: T.text3, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Live &amp; Upcoming Classes</span></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,280px),1fr))', gap: 'clamp(8px,1.2vw,14px)' }}>
            {liveClasses.map(cls => {
              const isLive = cls.status === 'live';
              const diff = cls.scheduledAt.toDate().getTime() - Date.now();
              return (
                <div key={cls.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderRadius: 13, background: isLive ? 'rgba(239,68,68,0.08)' : T.surface, border: `1px solid ${isLive ? 'rgba(239,68,68,0.28)' : T.border}` }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: isLive ? 'rgba(239,68,68,0.15)' : 'rgba(99,102,241,0.12)' }}>
                    {isLive ? <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 0 3px rgba(239,68,68,0.25)', display: 'block', animation: 'pulse 1.5s ease-in-out infinite' }} /> : <Video size={16} color="#6366f1" />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 'clamp(0.72rem,1.1vw,0.8rem)', fontWeight: 700, color: T.text, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cls.title}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                      {isLive && <span style={{ fontSize: 9, fontWeight: 800, background: 'rgba(239,68,68,0.18)', color: '#ef4444', borderRadius: 4, padding: '1px 5px' }}>LIVE</span>}
                      <span style={{ fontSize: 10, color: isLive ? 'rgba(239,68,68,0.7)' : T.text3 }}>{isLive ? 'Happening now' : timeDiff(diff)}</span>
                      {cls.teacherName && <span style={{ fontSize: 10, color: T.text3 }}>· {cls.teacherName}</span>}
                    </div>
                  </div>
                  <button onClick={() => navigate('/student-live-classes')} style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, fontFamily: "'Outfit',sans-serif", background: isLive ? '#ef4444' : 'rgba(99,102,241,0.85)', color: '#fff' }}>
                    <Play size={10} fill="#fff" />{isLive ? 'Join Now' : 'View'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Live Exams */}
      {liveExams.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Radio size={15} color="#f59e0b" /><span style={{ fontSize: 12, fontWeight: 700, color: T.text3, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Live Exams Today</span></div>
          <div style={{ padding: '14px 16px', borderRadius: 13, background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.22)', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(245,158,11,0.15)' }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#f59e0b', boxShadow: '0 0 0 3px rgba(245,158,11,0.28)', display: 'block', animation: 'pulse 1.5s ease-in-out infinite' }} />
              </div>
              <div>
                <p style={{ fontSize: 'clamp(0.75rem,1.1vw,0.82rem)', fontWeight: 700, color: T.text, margin: 0 }}>You've <span style={{ color: '#f59e0b' }}>{liveExams.length}</span> live exam{liveExams.length !== 1 ? 's' : ''} today</p>
                <p style={{ fontSize: 10, color: T.text3, margin: '1px 0 0' }}>Tap an exam to open it</p>
              </div>
            </div>
            {liveExams.map(exam => (
              <button key={exam.id} onClick={() => navigate(`/student-live-exams?highlight=${exam.id}`)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 10, background: T.surface, border: `1px solid ${T.border}`, cursor: 'pointer', textAlign: 'left', width: '100%', fontFamily: "'Outfit',sans-serif" }}>
                <Radio size={13} color="#f59e0b" style={{ flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 'clamp(0.72rem,1.05vw,0.8rem)', fontWeight: 600, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{exam.name}</span>
                <span style={{ fontSize: 9, fontWeight: 800, background: 'rgba(245,158,11,0.18)', color: '#f59e0b', borderRadius: 4, padding: '2px 6px', flexShrink: 0 }}>OPEN</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Row 1 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,230px),1fr))', gap: 'clamp(14px,1.8vw,22px)' }}>

        {/* Objectives */}
        <Card title="Today's Objectives" icon={<Target size={15} color="#6366f1" />} accent="#6366f1" enterDelay={0}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {objectivesLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '24px 0' }}>
                <Loader size={15} color="#6366f1" className="animate-spin" /><span style={{ fontSize: 12, color: T.text2 }}>Loading…</span>
              </div>
            ) : objectives.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <Target size={26} color={T.dimIcon} style={{ margin: '0 auto 6px' }} />
                <p style={{ fontSize: 12, color: T.text3, margin: 0 }}>No objectives yet</p>
              </div>
            ) : objectives.map(o => (
              <div key={o.id} onClick={() => toggleObj(o.id, o.completed)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 14, cursor: 'pointer', background: o.completed ? (dark ? 'rgba(16,185,129,0.07)' : 'rgba(16,185,129,0.06)') : T.surface, border: `1px solid ${o.completed ? (dark ? 'rgba(16,185,129,0.15)' : 'rgba(16,185,129,0.14)') : T.border}`, transition: 'all 0.20s ease' }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateX(3px)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateX(0)'; }}>
                {o.completed ? <CheckCircle size={18} color="#10b981" style={{ flexShrink: 0 }} /> : <Circle size={18} color={T.dimIcon} style={{ flexShrink: 0 }} />}
                <p style={{ flex: 1, fontSize: 'clamp(0.72rem,1.08vw,0.82rem)', color: o.completed ? T.text3 : T.text, margin: 0, textDecoration: o.completed ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.title}</p>
                <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', padding: '3px 8px', borderRadius: 99, flexShrink: 0, background: dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)', color: PC(o.priority) }}>{o.priority}</span>
              </div>
            ))}
            <button onClick={() => setShowObjModal(true)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px 14px', borderRadius: 12, marginTop: 4, background: isLight ? 'rgba(99,102,241,0.07)' : 'rgba(99,102,241,0.10)', border: '1px solid rgba(99,102,241,0.20)', color: '#818cf8', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>
              <Plus size={13} /> Add objective
            </button>
          </div>
        </Card>

        {/* Focus Timer */}
        <Card title="Focus Timer" icon={<Timer size={15} color="#6366f1" />} accent="#6366f1" enterDelay={90}>
          <div className="flex flex-col gap-3">
            <div className="flex items-center">
              {pomodoroSessionCount > 0 && <span className="text-xs bg-primary-500/15 text-primary-300 px-2 py-0.5 rounded-full">{pomodoroSessionCount} session{pomodoroSessionCount > 1 ? 's' : ''} today</span>}
              <button onClick={() => setPomodoroSoundEnabled(p => !p)} className={`ml-auto p-1.5 rounded-lg transition-colors ${pomodoroSoundEnabled ? 'text-primary-400 bg-primary-500/10 hover:bg-primary-500/20' : 'text-gray-600 bg-background-700 hover:text-gray-400'}`}>
                {pomodoroSoundEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
              </button>
            </div>
            <div className="relative flex justify-center items-center h-32">
              <svg width="128" height="128" className="-rotate-90" style={{ position: 'absolute' }}>
                <circle cx="64" cy="64" r="54" strokeWidth="8" stroke="#1f2937" fill="none" />
                <circle cx="64" cy="64" r="54" strokeWidth="8" stroke={pomodoroMode === 'focus' ? '#6366f1' : pomodoroMode === 'short' ? '#10b981' : '#f59e0b'} fill="none" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - pct / 100)} strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s linear' }} />
              </svg>
              <div className="relative text-center z-10">
                <span className="text-2xl font-bold font-mono" style={{ color: T.text }}>{pMins}:{pSecs}</span>
                <p className="text-xs text-gray-400 mt-0.5">{pomodoroMode === 'short' ? 'Short Break' : pomodoroMode === 'long' ? 'Long Break' : 'Focus'}</p>
                <div className="flex gap-1 justify-center mt-1">
                  {[0, 1, 2, 3].map(i => <div key={i} className={`w-1.5 h-1.5 rounded-full ${i < (pomodoroSessionCount % 4) ? 'bg-primary-400' : 'bg-background-600'}`} />)}
                </div>
              </div>
            </div>
            <div className="flex gap-1.5">
              {(['focus', 'short', 'long'] as const).map(m => (
                <button key={m} onClick={() => resetPomodoro(m)} className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${pomodoroMode === m ? 'bg-primary-600 text-white' : 'bg-background-700 text-gray-400 hover:text-white'}`}>
                  {m === 'focus' ? '25 min' : m === 'short' ? '5 min' : '15 min'}
                </button>
              ))}
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">What are you studying?</label>
              <select value={pomodoroLinkedEvent || pomodoroSubject}
                onChange={e => { const v = e.target.value; const m = todayEventsForTimer.find(ev => ev.id === v); if (m) { setPomodoroLinkedEvent(m.id); setPomodoroSubject(m.course || m.title); } else { setPomodoroLinkedEvent(''); setPomodoroSubject(v); } }}
                className={inputCls + ' mb-1.5'}>
                <option value="">— Pick a session or type below —</option>
                {todayEventsForTimer.map(ev => <option key={ev.id} value={ev.id}>{ev.title} ({ev.startTime}–{ev.endTime})</option>)}
              </select>
              {!pomodoroLinkedEvent && <input value={pomodoroSubject} onChange={e => setPomodoroSubject(e.target.value)} placeholder="Or type subject manually…" className={inputCls} />}
              {pomodoroLinkedEvent && <p className="text-xs text-primary-400 flex items-center gap-1 mt-1"><CheckCircle2 size={10} /> Progress auto-updates on linked session</p>}
            </div>
            <div className="flex gap-2">
              <button onClick={startPomodoro} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${pomodoroActive ? 'bg-amber-600 hover:bg-amber-700' : 'bg-primary-600 hover:bg-primary-700'} text-white`}>
                {pomodoroActive ? <><Pause size={13} />Pause</> : <><Play size={13} />Start</>}
              </button>
              <button onClick={() => resetPomodoro(pomodoroMode)} className="p-2.5 bg-background-700 hover:bg-background-600 text-gray-400 hover:text-white rounded-xl transition-colors"><RotateCcw size={14} /></button>
              {pomodoroSessionCount > 0 && <button onClick={resetPomodoroSitting} className="p-2.5 bg-background-700 hover:bg-red-500/20 text-gray-400 hover:text-red-400 rounded-xl transition-colors"><Trash size={14} /></button>}
            </div>
            <div className="pt-3 border-t border-background-700 grid grid-cols-3 gap-2 text-center">
              <div><p className="text-sm font-bold text-white">{streak.totalSessions}</p><p className="text-xs text-gray-500">Total</p></div>
              <div><p className="text-sm font-bold text-white">{pomodoroTodayMinutes}m</p><p className="text-xs text-gray-500">Today</p></div>
              <div><p className="text-sm font-bold text-white">{Math.round(streak.totalSessions * 25 / 60)}h</p><p className="text-xs text-gray-500">All time</p></div>
            </div>
            {pomodoroSessionCount > 0 && pomodoroSessionCount % 4 === 0 && pomodoroMode !== 'long' && !pomodoroActive && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2 flex items-center gap-2">
                <Coffee size={12} className="text-amber-400 shrink-0" />
                <p className="text-xs text-amber-300">4 sessions done — take a long break!</p>
                <button onClick={() => resetPomodoro('long')} className="ml-auto text-xs text-amber-400 hover:text-amber-300 font-medium whitespace-nowrap">15 min break</button>
              </div>
            )}
          </div>
        </Card>

        {/* Announcements */}
        <Card title="Latest Updates" icon={<Megaphone size={15} color="#a78bfa" />} accent="#8b5cf6" enterDelay={180}>
          {announcementsLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '28px 0' }}><Loader size={16} color="#6366f1" className="animate-spin" /><span style={{ fontSize: 12, color: T.text2 }}>Loading…</span></div>
          ) : announcementsError ? (
            <div style={{ textAlign: 'center', padding: '22px 0' }}><AlertCircle size={22} color="#ef4444" style={{ margin: '0 auto 5px' }} /><p style={{ fontSize: 11, color: 'rgba(239,68,68,0.8)', margin: '0 0 5px' }}>{announcementsError}</p><button onClick={loadAnnouncements} style={{ fontSize: 11, color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer' }}>Retry</button></div>
          ) : announcements.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0' }}><Megaphone size={28} color={T.dimIcon} style={{ margin: '0 auto 8px' }} /><p style={{ fontSize: 12, color: T.text3, margin: 0 }}>No announcements yet</p></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {announcements.slice(0, 3).map(a => (
                <div key={a.id} style={{ padding: '11px 13px', borderRadius: 14, background: T.surface, border: `1px solid ${T.border}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)', border: `1px solid ${T.border}` }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: APB(a.priority) }} />
                    </div>
                    <p style={{ fontSize: 'clamp(0.71rem,1.05vw,0.79rem)', fontWeight: 700, color: T.text, margin: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.title}</p>
                    {a.priority === 'high' && <span style={{ fontSize: 9, fontWeight: 800, background: 'rgba(239,68,68,0.12)', color: '#ef4444', borderRadius: 99, padding: '2px 8px', flexShrink: 0, border: '1px solid rgba(239,68,68,0.20)' }}>URGENT</span>}
                  </div>
                  <p style={{ fontSize: 10, color: T.text2, margin: '0 0 3px 36px' }}>{a.teacherName} · {a.subject}</p>
                  <p style={{ fontSize: 11, color: T.text2, margin: '0 0 0 36px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>{a.message}</p>
                </div>
              ))}
              {announcements.length > 3 && <button style={{ fontSize: 11, color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', padding: '3px 0' }}>View all {announcements.length} →</button>}
            </div>
          )}
        </Card>

        {/* Daily Inspiration */}
        <Card title="Daily Inspiration" icon={<Star size={15} color="#f59e0b" />} accent="#f59e0b" enterDelay={270}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 14 }}>
            <div style={{ fontSize: 36 }}>💡</div>
            {inspirationLoading ? <Loader size={16} color="#f59e0b" className="animate-spin" /> : (
              <>
                <blockquote style={{ fontSize: 'clamp(0.76rem,1.15vw,0.86rem)', color: T.text2, fontStyle: 'italic', lineHeight: 1.65, margin: 0 }}>"{inspirationText}"</blockquote>
                <cite style={{ fontSize: 12, fontWeight: 700, color: '#a78bfa', fontStyle: 'normal' }}>— {inspirationAuthor}</cite>
              </>
            )}
            <div style={{ width: '100%', borderTop: `1px solid ${T.border}`, paddingTop: 9 }}>
              <button onClick={loadInspiration} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, color: T.muted, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 20, padding: '5px 11px', cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>
                <RotateCcw size={10} /> New Quote
              </button>
            </div>
          </div>
        </Card>
      </div>

      {/* Row 2 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,290px),1fr))', gap: 'clamp(14px,1.8vw,22px)' }}>

        {/* Weekly Schedule */}
        <Card title="Weekly Schedule" subtitle="Events this week" icon={<Calendar size={15} color="#06b6d4" />} accent="#06b6d4" enterDelay={360}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3 }}>
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <div key={i} style={{ textAlign: 'center', fontSize: 9, fontWeight: 600, color: T.text3 }}>{d}</div>)}
              {Array.from({ length: 7 }, (_, i) => {
                const d = new Date(); d.setDate(d.getDate() - d.getDay() + i);
                const isToday = d.toDateString() === new Date().toDateString();
                const has = calendarEvents.some(e => e.date.toDateString() === d.toDateString());
                return <div key={i} style={{ position: 'relative', textAlign: 'center', padding: '5px 2px', borderRadius: 7, fontSize: 11, fontWeight: 600, background: isToday ? 'rgba(99,102,241,0.32)' : has ? T.surface : 'transparent', color: isToday ? 'white' : has ? T.text : T.text3, border: isToday ? '1px solid rgba(99,102,241,0.45)' : '1px solid transparent' }}>
                  {d.getDate()}
                  {has && !isToday && <div style={{ position: 'absolute', bottom: 2, left: '50%', transform: 'translateX(-50%)', width: 3, height: 3, borderRadius: '50%', background: '#10b981' }} />}
                </div>;
              })}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: T.text3, textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0 }}>Upcoming</p>
              {calendarLoading
                ? <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Loader size={13} color="#6366f1" className="animate-spin" /><span style={{ fontSize: 11, color: T.text2 }}>Loading…</span></div>
                : calendarEvents.length === 0
                  ? <div style={{ textAlign: 'center', padding: '10px 0' }}><Calendar size={20} color={T.dimIcon} style={{ margin: '0 auto 5px' }} /><p style={{ fontSize: 11, color: T.text3, margin: 0 }}>No upcoming events</p></div>
                  : calendarEvents.slice(0, 4).map(ev => (
                    <div key={ev.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 14, background: T.surface, border: `1px solid ${T.border}` }}>
                      <div style={{ width: 32, height: 32, borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', border: `1px solid ${T.border}` }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: EDC(ev.title) }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 'clamp(0.68rem,1.05vw,0.76rem)', fontWeight: 650, color: T.text, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.title}</p>
                        <p style={{ fontSize: 10, color: T.text3, margin: '1px 0 0' }}>{ev.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {ev.startTime}</p>
                      </div>
                      <span style={{ fontSize: 9, fontWeight: 600, color: T.muted, background: T.tagBg, borderRadius: 5, padding: '2px 6px', flexShrink: 0, maxWidth: 65, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.course}</span>
                    </div>
                  ))}
              <button onClick={() => setShowEventModal(true)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '8px 14px', borderRadius: 12, marginTop: 4, background: isLight ? 'rgba(6,182,212,0.07)' : 'rgba(6,182,212,0.10)', border: '1px solid rgba(6,182,212,0.20)', color: '#22d3ee', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>
                <Plus size={11} /> Add event
              </button>
            </div>
          </div>
        </Card>

        {/* Goals */}
        <Card title="My Goals" subtitle="From your Study Planner" icon={<Award size={15} color="#f97316" />} accent="#f97316" enterDelay={450}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {goalsLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '24px 0' }}><Loader size={15} color="#f97316" className="animate-spin" /><span style={{ fontSize: 12, color: T.text2 }}>Loading…</span></div>
            ) : goals.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}><Award size={28} color={T.dimIcon} style={{ margin: '0 auto 7px' }} /><p style={{ fontSize: 12, color: T.text3, margin: 0 }}>No active goals yet</p></div>
            ) : goals.map(g => {
              const progress = Math.min(100, Math.round(g.hoursCompleted > 0 ? (g.hoursCompleted / g.hoursNeeded) * 100 : g.currentProgress ?? 0));
              return (
                <div key={g.id} style={{ padding: '12px 14px', borderRadius: 14, background: T.surface, border: `1px solid ${T.border}` }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 7, marginBottom: 7 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 'clamp(0.72rem,1.1vw,0.8rem)', fontWeight: 650, color: T.text, margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.subject}</p>
                      <p style={{ fontSize: 10, color: T.text2, margin: 0 }}>{g.hoursCompleted}h of {g.hoursNeeded}h completed</p>
                    </div>
                    <span style={{ fontSize: 9, fontWeight: 700, background: 'rgba(99,102,241,0.14)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.22)', borderRadius: 5, padding: '2px 6px', flexShrink: 0, textTransform: 'capitalize' }}>{g.difficulty}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, height: 5, borderRadius: 99, background: T.trackBg, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${progress}%`, borderRadius: 99, background: 'linear-gradient(90deg,#6366f1,#8b5cf6,#06b6d4)' }} />
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: progress > 70 ? '#10b981' : progress > 40 ? '#f59e0b' : T.muted, flexShrink: 0, minWidth: 30, textAlign: 'right' }}>{progress}%</span>
                  </div>
                  <p style={{ fontSize: 10, color: T.text3, margin: '4px 0 0' }}>Due {g.targetDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                </div>
              );
            })}
            <button onClick={() => setShowGoalModal(true)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '9px 14px', borderRadius: 12, background: isLight ? 'rgba(249,115,22,0.07)' : 'rgba(249,115,22,0.10)', border: '1px solid rgba(249,115,22,0.20)', color: '#fb923c', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>
              <Plus size={11} /> Add new goal
            </button>
          </div>
        </Card>
      </div>

      {/* Constellations */}
      <Card title="Subject Constellations" subtitle="Your knowledge map across subjects" accent="#ec4899" enterDelay={540}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,200px),1fr))', gap: 'clamp(12px,2vw,20px)' }}>
          {constellations.map(c => (
            <div key={c.id} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <div style={{ width: 9, height: 9, borderRadius: '50%', background: c.color, boxShadow: `0 0 7px ${c.color}` }} />
                  <span style={{ fontSize: 'clamp(0.74rem,1.2vw,0.85rem)', fontWeight: 700, color: T.text }}>{c.name}</span>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: c.color }}>{c.overallProgress}%</span>
              </div>
              <div style={{ height: 3, borderRadius: 2, background: T.trackBg, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${c.overallProgress}%`, background: c.color, borderRadius: 2 }} />
              </div>
              <div style={{ position: 'relative', height: 130, borderRadius: 10, background: T.starBg, border: `1px solid ${T.border}`, overflow: 'hidden' }}>
                {Array.from({ length: 12 }).map((_, i) => <div key={i} style={{ position: 'absolute', width: 2, height: 2, borderRadius: '50%', background: T.dimIcon, left: `${(i * 41) % 97}%`, top: `${(i * 67) % 95}%` }} />)}
                <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
                  {c.stars.map((s, i) => i > 0 && <line key={s.id} x1={`${c.stars[i - 1].position.x}%`} y1={`${c.stars[i - 1].position.y}%`} x2={`${s.position.x}%`} y2={`${s.position.y}%`} stroke={c.color} strokeWidth="1" opacity={s.mastered && c.stars[i - 1].mastered ? 0.45 : 0.12} />)}
                </svg>
                {c.stars.map(s => (
                  <div key={s.id} style={{ position: 'absolute', left: `${s.position.x}%`, top: `${s.position.y}%`, transform: 'translate(-50%,-50%)' }} title={`${s.name} – ${s.progress}%`}>
                    <Star size={s.mastered ? 16 : 12} color={s.mastered ? '#fbbf24' : s.progress > 50 ? `${c.color}88` : T.dimIcon} fill={s.mastered ? '#fbbf24' : 'none'} style={{ filter: s.mastered ? 'drop-shadow(0 0 4px rgba(251,191,36,0.6))' : 'none' }} />
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {c.stars.map(s => (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Star size={9} color={s.mastered ? '#fbbf24' : T.dimIcon} fill={s.mastered ? '#fbbf24' : 'none'} />
                      <span style={{ fontSize: 10, color: s.mastered ? T.text2 : T.text3 }}>{s.name}</span>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 600, color: s.mastered ? '#10b981' : s.progress > 50 ? '#f59e0b' : T.text3 }}>{s.progress}%</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* ══ MODALS ══ */}

      {showObjModal && <ObjModal onClose={() => setShowObjModal(false)} onAdd={addObj} />}

      {/* Goal Modal */}
      {showGoalModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16, overflowY: 'auto' }}>
          <div style={{ background: '#0d1018', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 22, width: '100%', maxWidth: 500, position: 'relative', fontFamily: "'Outfit',sans-serif", maxHeight: '90vh', overflowY: 'auto' }}>
            <button onClick={() => { setShowGoalModal(false); resetGoalForm(); }} style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 7, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'rgba(255,255,255,0.55)' }}><X size={13} /></button>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: 'rgba(255,255,255,0.9)', margin: '0 0 16px' }}>Add Study Goal</h2>
            <div className="space-y-3">
              {/* Mode tabs */}
              <div className="flex gap-1 bg-background-800 p-1 rounded-lg">
                {(['simple', 'topic', 'course'] as GoalMode[]).map(m => (
                  <button key={m} onClick={() => setGoalMode(m)} className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-colors ${goalMode === m ? 'bg-primary-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                    {m === 'simple' ? 'Simple' : m === 'topic' ? 'Add Topics' : 'From Course'}
                  </button>
                ))}
              </div>
              {/* Subject + date */}
              {goalMode !== 'course'
                ? <div className="grid grid-cols-2 gap-3"><input value={newGoal.subject} onChange={e => setNewGoal(p => ({ ...p, subject: e.target.value }))} placeholder="Subject / Course" className={inputCls} /><input type="date" value={newGoal.targetDate} onChange={e => setNewGoal(p => ({ ...p, targetDate: e.target.value }))} className={inputCls} /></div>
                : <input type="date" value={newGoal.targetDate} onChange={e => setNewGoal(p => ({ ...p, targetDate: e.target.value }))} className={inputCls} />
              }
              {/* Simple */}
              {goalMode === 'simple' && (
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-xs text-gray-400 mb-1 block">Hours needed</label><input type="number" min={1} value={newGoal.hoursNeeded} onChange={e => setNewGoal(p => ({ ...p, hoursNeeded: Number(e.target.value) }))} className={inputCls} /></div>
                  <div><label className="text-xs text-gray-400 mb-1 block">Difficulty</label><select value={newGoal.difficulty} onChange={e => setNewGoal(p => ({ ...p, difficulty: e.target.value as any }))} className={inputCls}><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></div>
                </div>
              )}
              {/* Topic */}
              {goalMode === 'topic' && (
                <div className="space-y-2">
                  <div className="flex gap-1">
                    {(['first_reading', 'revision'] as const).map(m => <button key={m} onClick={() => setGoalStudyMode(m)} className={`flex-1 text-xs py-1.5 rounded-lg font-medium transition-colors ${goalStudyMode === m ? 'bg-teal-600 text-white' : 'bg-background-800 text-gray-400 hover:text-white'}`}>{m === 'first_reading' ? 'First Reading' : 'Revision'}</button>)}
                  </div>
                  <input value={topicInput.name} onChange={e => setTopicInput(p => ({ ...p, name: e.target.value }))} placeholder="Topic name" className={inputCls} onKeyDown={e => { if (e.key === 'Enter' && topicInput.name) { setManualTopics(p => [...p, { id: Date.now().toString(), ...topicInput }]); setTopicInput(p => ({ ...p, name: '' })); } }} />
                  <div className="grid grid-cols-3 gap-2">
                    <div><label className="text-xs text-gray-500 mb-0.5 block">Min h</label><input type="number" min={0.5} step={0.5} value={topicInput.minHours} onChange={e => setTopicInput(p => ({ ...p, minHours: Number(e.target.value) }))} className={inputCls} /></div>
                    <div><label className="text-xs text-gray-500 mb-0.5 block">Max h</label><input type="number" min={0.5} step={0.5} value={topicInput.maxHours} onChange={e => setTopicInput(p => ({ ...p, maxHours: Number(e.target.value) }))} className={inputCls} /></div>
                    <div><label className="text-xs text-gray-500 mb-0.5 block">Difficulty</label><select value={topicInput.difficulty} onChange={e => setTopicInput(p => ({ ...p, difficulty: e.target.value as any }))} className={inputCls}><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></div>
                  </div>
                  <button onClick={() => { if (!topicInput.name) return; setManualTopics(p => [...p, { id: Date.now().toString(), ...topicInput }]); setTopicInput(p => ({ ...p, name: '' })); }} className="w-full text-xs bg-background-600 hover:bg-background-500 text-gray-300 py-1.5 rounded-lg transition-colors">+ Add Topic</button>
                  {manualTopics.length > 0 && (
                    <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                      {manualTopics.map((t, i) => (
                        <div key={t.id} className="flex items-center justify-between bg-background-800 px-3 py-1.5 rounded-lg text-xs">
                          <span className="text-white flex-1 truncate mr-2">{t.name}</span>
                          <span className="text-gray-500 mr-2 shrink-0">{t.minHours}–{t.maxHours}h · {t.difficulty}</span>
                          <button onClick={() => setManualTopics(p => p.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-300 shrink-0"><X size={11} /></button>
                        </div>
                      ))}
                    </div>
                  )}
                  {calculatedHours > 0 && <p className="text-xs text-teal-400 text-right">{manualTopics.length} topics · <span className="font-semibold">{calculatedHoursRange ? `${calculatedHoursRange.min}–${calculatedHoursRange.max}h` : `${calculatedHours}h`}</span></p>}
                </div>
              )}
              {/* From Course */}
              {goalMode === 'course' && (
                <div className="space-y-2">
                  <div className="flex gap-1">
                    {(['first_reading', 'revision'] as const).map(m => <button key={m} onClick={() => setGoalStudyMode(m)} className={`flex-1 text-xs py-1.5 rounded-lg font-medium transition-colors ${goalStudyMode === m ? 'bg-teal-600 text-white' : 'bg-background-800 text-gray-400 hover:text-white'}`}>{m === 'first_reading' ? 'First Reading' : 'Revision'}</button>)}
                  </div>
                  {enrolledCourses.length === 0
                    ? <p className="text-xs text-gray-500 text-center py-3">No enrolled courses found.</p>
                    : <div className="space-y-1.5">{enrolledCourses.map(c => <button key={c.courseId} onClick={() => { setCtCourseId(c.courseId); loadCourseTopics(c.courseId); }} className={`w-full text-left px-3 py-2.5 rounded-xl border text-sm transition-colors ${ctCourseId === c.courseId ? 'bg-primary-600/20 border-primary-500 text-white' : 'bg-background-800 border-background-600 text-gray-300 hover:border-background-500'}`}><div className="font-medium">{c.title}</div>{c.instructor && <div className="text-xs text-gray-500 mt-0.5">{c.instructor} · {c.progress}% done</div>}</button>)}</div>
                  }
                  {ctLoadingGroups && <p className="text-xs text-gray-400 text-center py-2"><Loader size={12} className="inline animate-spin mr-1" />Loading topics…</p>}
                  {!ctLoadingGroups && ctGroups.length > 0 && (() => {
                    const allSubjIds  = ctGroups.flatMap(g => g.subjects.map(s => s.id));
                    const allChapIds  = ctGroups.flatMap(g => g.subjects.flatMap(s => s.chapters.map(c => c.id)));
                    const allTopicIds = ctGroups.flatMap(g => g.subjects.flatMap(s => s.chapters.flatMap(c => c.topics.map(t => t.id))));
                    const allSel = allSubjIds.every(id => ctSelSubjects.has(id)) && allChapIds.every(id => ctSelChapters.has(id)) && allTopicIds.every(id => ctSelTopics.has(id));
                    const toggleAll = () => { setCtSelSubjects(allSel ? new Set() : new Set(allSubjIds)); setCtSelChapters(allSel ? new Set() : new Set(allChapIds)); setCtSelTopics(allSel ? new Set() : new Set(allTopicIds)); };
                    return (
                      <div className="bg-background-800 rounded-xl overflow-hidden">
                        <label className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-primary-300 border-b border-background-700 cursor-pointer hover:bg-background-700 transition-colors">
                          <input type="checkbox" checked={allSel} onChange={toggleAll} className="accent-primary-500" />Select All ({allTopicIds.length} topics)
                        </label>
                        <div className="divide-y divide-background-700">
                          {ctGroups.flatMap(grp => grp.subjects.map(subj => {
                            const subjChapIds  = subj.chapters.map(c => c.id);
                            const subjTopicIds = subj.chapters.flatMap(c => c.topics.map(t => t.id));
                            const subjAllSel   = subjChapIds.every(id => ctSelChapters.has(id)) && subjTopicIds.every(id => ctSelTopics.has(id));
                            const subjExpanded = ctExpandedSubjects.has(subj.id);
                            const toggleSubjSel = (e: React.ChangeEvent<HTMLInputElement>) => { e.stopPropagation(); setCtSelSubjects(p => { const n = new Set(p); subjAllSel ? n.delete(subj.id) : n.add(subj.id); return n; }); setCtSelChapters(p => { const n = new Set(p); subjChapIds.forEach(id => subjAllSel ? n.delete(id) : n.add(id)); return n; }); setCtSelTopics(p => { const n = new Set(p); subjTopicIds.forEach(id => subjAllSel ? n.delete(id) : n.add(id)); return n; }); };
                            return (
                              <div key={subj.id}>
                                <div className="flex items-center gap-2 px-3 py-2.5 hover:bg-background-700 transition-colors">
                                  <input type="checkbox" checked={subjAllSel} onChange={toggleSubjSel} className="accent-primary-500 flex-shrink-0" />
                                  <Layers size={11} className="text-primary-400 flex-shrink-0" />
                                  <span className="flex-1 text-xs font-semibold text-white">{subj.name}</span>
                                  <span className="text-xs text-gray-500 mr-1">{subjTopicIds.length}</span>
                                  <button onClick={() => setCtExpandedSubjects(p => { const n = new Set(p); n.has(subj.id) ? n.delete(subj.id) : n.add(subj.id); return n; })} className="text-gray-400 hover:text-white p-0.5">{subjExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}</button>
                                </div>
                                {subjExpanded && subj.chapters.map(chap => {
                                  const chapTopicIds = chap.topics.map(t => t.id);
                                  const chapAllSel   = chapTopicIds.every(id => ctSelTopics.has(id));
                                  const chapExpanded = ctExpandedChapters.has(chap.id);
                                  const toggleChapSel = (e: React.ChangeEvent<HTMLInputElement>) => { e.stopPropagation(); setCtSelChapters(p => { const n = new Set(p); chapAllSel ? n.delete(chap.id) : n.add(chap.id); return n; }); setCtSelTopics(p => { const n = new Set(p); chapTopicIds.forEach(id => chapAllSel ? n.delete(id) : n.add(id)); return n; }); };
                                  return (
                                    <div key={chap.id} className="border-t border-background-700/50">
                                      <div className="flex items-center gap-2 pl-7 pr-3 py-2 hover:bg-background-700 transition-colors">
                                        <input type="checkbox" checked={chapAllSel} onChange={toggleChapSel} className="accent-teal-500 flex-shrink-0" />
                                        <span className="flex-1 text-xs text-gray-300">{chap.name}</span>
                                        <span className="text-xs text-gray-600 mr-1">{chapTopicIds.length}</span>
                                        <button onClick={() => setCtExpandedChapters(p => { const n = new Set(p); n.has(chap.id) ? n.delete(chap.id) : n.add(chap.id); return n; })} className="text-gray-500 hover:text-white p-0.5">{chapExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}</button>
                                      </div>
                                      {chapExpanded && chap.topics.map(t => (
                                        <label key={t.id} className="flex items-center gap-2 pl-11 pr-3 py-1.5 text-xs text-gray-400 cursor-pointer hover:bg-background-700 transition-colors">
                                          <input type="checkbox" checked={ctSelTopics.has(t.id)} onChange={e => setCtSelTopics(p => { const n = new Set(p); e.target.checked ? n.add(t.id) : n.delete(t.id); return n; })} className="accent-teal-500" />
                                          <Tag size={9} className="text-teal-500 flex-shrink-0" />
                                          <span className="flex-1">{t.name}</span>
                                          <span className="text-gray-600 flex-shrink-0">{(t as any).minHours}–{(t as any).maxHours}h</span>
                                        </label>
                                      ))}
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          }))}
                        </div>
                      </div>
                    );
                  })()}
                  {!ctLoadingGroups && ctCourseId && ctGroups.length === 0 && (
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2.5 text-xs text-amber-300">
                      No topic groups for this course yet. Use <button onClick={() => setGoalMode('topic')} className="underline font-medium">Add Topics</button> to plan manually.
                    </div>
                  )}
                  {calculatedHours > 0 && <p className="text-xs text-teal-400 text-right">{selectedCourseTopics.length} topics · <span className="font-semibold">{calculatedHoursRange ? `${calculatedHoursRange.min}–${calculatedHoursRange.max}h` : `${calculatedHours}h`}</span></p>}
                </div>
              )}
              {/* Save / Cancel */}
              <div className="flex gap-2 pt-1">
                <button onClick={handleAddGoal}
                  disabled={savingGoal || !newGoal.targetDate || (goalMode !== 'course' && !newGoal.subject) || (goalMode === 'course' && !ctCourseId)}
                  className="flex-1 bg-primary-600 hover:bg-primary-700 text-white py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1">
                  {savingGoal && <Loader size={13} className="animate-spin" />}Save Goal
                </button>
                <button onClick={() => { setShowGoalModal(false); resetGoalForm(); }} className="px-4 bg-background-600 hover:bg-background-500 text-gray-400 py-2 rounded-xl text-sm transition-colors">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Event Modal */}
      {showEventModal && (
        <StudyPlanEventModal selectedDate={selectedDate} currentUser={user} isPersonalEvent={true} onClose={() => setShowEventModal(false)} onSave={() => { setShowEventModal(false); loadCalendarEvents(); }} />
      )}
    </div>
  );
};

// ─── Objective Modal ──────────────────────────────────────────────────────────
const ObjModal = ({ onClose, onAdd }: { onClose: () => void; onAdd: (t: string, p: 'high' | 'medium' | 'low') => void }) => {
  const [title, setTitle]       = useState('');
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const color = (p: string) => p === 'high' ? '#ef4444' : p === 'medium' ? '#f59e0b' : '#10b981';
  const GI: React.CSSProperties = { width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '8px 12px', color: 'rgba(255,255,255,0.9)', fontSize: 13, fontFamily: "'Outfit',sans-serif", outline: 'none' };
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}>
      <div style={{ background: '#0d1018', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 22, width: '100%', maxWidth: 380, position: 'relative', fontFamily: "'Outfit',sans-serif" }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 7, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'rgba(255,255,255,0.55)' }}><X size={13} /></button>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: 'rgba(255,255,255,0.9)', margin: '0 0 16px' }}>Add Objective</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.42)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Title</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="What do you want to achieve?" style={GI} onKeyDown={e => { if (e.key === 'Enter' && title.trim()) onAdd(title.trim(), priority); }} />
          </div>
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.42)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Priority</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['high', 'medium', 'low'] as const).map(p => (
                <button key={p} onClick={() => setPriority(p)} style={{ flex: 1, padding: '6px 0', borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: "'Outfit',sans-serif", background: priority === p ? `${color(p)}1a` : 'rgba(255,255,255,0.04)', border: priority === p ? `1px solid ${color(p)}55` : '1px solid rgba(255,255,255,0.07)', color: priority === p ? color(p) : 'rgba(255,255,255,0.42)' }}>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button onClick={onClose} style={{ flex: 1, padding: '8px 0', borderRadius: 9, border: '1px solid rgba(255,255,255,0.09)', background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.55)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>Cancel</button>
            <button onClick={() => title.trim() && onAdd(title.trim(), priority)} style={{ flex: 1, padding: '8px 0', borderRadius: 9, border: 'none', background: '#6366f1', color: 'white', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>Add</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentDashboard;
