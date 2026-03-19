// src/pages/StudentDashboard.tsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Target, Calendar, Star, Play, Pause, RotateCcw, Plus,
  CheckCircle, Circle, Megaphone, Award, X, Loader,
  AlertCircle, Video, Radio, Timer, Volume2, VolumeX,
  Coffee, Trash, ChevronDown, ChevronUp, Layers, CheckCircle2, Tag,
  Clock, TrendingUp, Flame, BookOpen, AlertTriangle, BarChart2, Zap, BookMarked,
} from 'lucide-react';
import Card from '../components/ui/Card';
import { useDashboard } from '../contexts/DashboardContext';
import { getRandomQuote } from '../utils/quotes';
import { announcementService, Announcement } from '../services/announcementService';
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
import { subjectMapService, SubjectConstellation as SubjectConstellationType } from '../services/subjectMapService';
import { taskService, TaskGroup } from '../services/taskService';
import { courseService, Course } from '../services/courseService';
import { collection, getDocs, query, where, orderBy, limit, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';

// ─── Types ────────────────────────────────────────────────────────────────────
type GoalMode = 'simple' | 'topic' | 'course';
type HeatmapView = 'days' | 'weeks' | 'months';

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

// NEW: formatting helpers
function fmtMins(m: number): string {
  if (m <= 0) return '0m';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60); const r = m % 60;
  return r > 0 ? `${h}h ${r}m` : `${h}h`;
}
function fmtCountdown(due: Date): string {
  const diff = due.getTime() - Date.now();
  if (diff < 0) { const d = Math.floor(Math.abs(diff) / 86400000); return d > 0 ? `${d}d overdue` : 'overdue'; }
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  if (d > 1) return `in ${d} days`;
  if (h > 0) return `in ${h}h`;
  return 'due soon';
}
function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function hmapLevel(v: number, max: number): 0|1|2|3|4 {
  if (!v || !max) return 0;
  const p = v / max;
  return p < 0.15 ? 1 : p < 0.40 ? 2 : p < 0.70 ? 3 : 4;
}
// Pre-fill 70 blank days so heatmap grid always renders from day 1
function blankHeatmap(weeks = 10): { date: string; value: number; level: 0|1|2|3|4 }[] {
  const today = new Date(); today.setHours(0,0,0,0);
  return Array.from({ length: weeks * 7 }, (_, i) => {
    const d = new Date(today); d.setDate(today.getDate() - (weeks * 7 - 1 - i));
    return { date: ymd(d), value: 0, level: 0 as const };
  });
}

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

  // ── NEW feature state ─────────────────────────────────────────────────────
  // KPI
  const [kpiTodayMins, setKpiTodayMins]     = useState(0);
  const [kpiWeekMins, setKpiWeekMins]       = useState(0);
  const [kpiTasksDone, setKpiTasksDone]     = useState(0);
  const [kpiLoading, setKpiLoading]         = useState(true);
  // Continue Learning
  const [continueLearning, setContinueLearning] = useState<{ courseId: string; title: string; instructor: string; progress: number; thumbnail?: string } | null>(null);
  // Available Courses (all published)
  const [allCourses, setAllCourses]         = useState<Course[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  // Pending Tasks (task groups only)
  const [pendingTasks, setPendingTasks]     = useState<{ id: string; title: string; dueDate: Date; urgency: 'overdue'|'today'|'tomorrow'|'upcoming'; points: number }[]>([]);
  const [tasksLoading, setTasksLoading]     = useState(true);
  // Exam Performance
  const [examPerf, setExamPerf]             = useState<{ courseId: string; courseTitle: string; points: { date: string; label: string; pct: number }[] }[]>([]);
  const [examPerfCourse, setExamPerfCourse] = useState('');
  const [examPerfLoading, setExamPerfLoading] = useState(true);
  // Heatmaps
  const [studyHeatmap, setStudyHeatmap]     = useState<{ date: string; value: number; level: 0|1|2|3|4 }[]>(() => blankHeatmap());
  const [appHeatmap, setAppHeatmap]         = useState<{ date: string; value: number; level: 0|1|2|3|4 }[]>(() => blankHeatmap());
  const [heatmapView, setHeatmapView]       = useState<HeatmapView>('days');
  // App session tracking
  const sessionStartRef = useRef<number>(Date.now());

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

  // ── Subject Map / Constellations ──────────────────────────────────────────
  const [constellations, setConstellations]             = useState<SubjectConstellationType[]>([]);
  const [constellationsLoading, setConstellationsLoading] = useState(true);

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
    loadEnrolledCourses(); loadStreakData(); loadConstellations();
    // NEW loaders
    loadKPI(); loadContinueLearning(); loadAllCourses(); loadPendingTasks(); loadExamPerf(); loadStudyHeatmap();
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

  const loadConstellations = async () => {
    if (!user) return;
    try {
      setConstellationsLoading(true);
      const map = await subjectMapService.buildSubjectMap(user.uid);
      setConstellations(map);
    } catch (err) {
      console.error('[loadConstellations]', err);
      setConstellations([]);
    } finally {
      setConstellationsLoading(false);
    }
  };

  // ── NEW loaders ───────────────────────────────────────────────────────────
  const loadKPI = async () => {
    if (!user) return;
    setKpiLoading(true);
    try {
      const now = new Date();
      const todayStr = ymd(now);
      const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 6);
      // Pomodoro minutes
      const sessions = await studyPlanService.getPomodoroSessions(user.uid, 100);
      let todayMins = 0, weekMins = 0;
      sessions.forEach(s => {
        if (!s.completed) return;
        const d = ymd(s.startTime);
        if (d >= ymd(weekAgo)) weekMins += s.duration;
        if (d === todayStr) todayMins += s.duration;
      });
      // Completed calendar events (add their duration)
      const allEvs = await studyPlanService.getEventsForStudent(user.uid);
      allEvs.forEach(e => {
        if (!e.completed) return;
        const completedAt = (e as any).completedAt ?? e.date;
        const d = ymd(completedAt instanceof Date ? completedAt : new Date(completedAt));
        try {
          const [sh, sm] = (e.startTime || '00:00').split(':').map(Number);
          const [eh, em] = (e.endTime   || '00:00').split(':').map(Number);
          const mins = Math.max(0, (eh * 60 + em) - (sh * 60 + sm));
          if (d >= ymd(weekAgo)) weekMins += mins;
          if (d === todayStr) todayMins += mins;
        } catch {}
      });
      // 3. Lesson viewing time from content_progress
      const weekAgoTs = Timestamp.fromDate(weekAgo);
      const progressSnap = await getDocs(query(
        collection(db, 'content_progress'),
        where('studentId', '==', user.uid),
        where('lastWatchedAt', '>=', weekAgoTs),
        orderBy('lastWatchedAt', 'desc'),
      ));
      progressSnap.docs.forEach(d => {
        const data = d.data();
        const mins = Math.round((data.watchedDuration ?? 0) / 60);
        if (mins <= 0) return;
        const at: Date = data.lastWatchedAt?.toDate?.() ?? new Date(data.lastWatchedAt);
        const dateStr = ymd(at);
        if (dateStr >= ymd(weekAgo)) weekMins += mins;
        if (dateStr === todayStr) todayMins += mins;
      });
      setKpiTodayMins(todayMins);
      setKpiWeekMins(weekMins);
      // Objectives completed
      const objs = await dashboardService.getObjectives(user.uid);
      setKpiTasksDone(objs.filter(o => o.completed).length);
    } catch {}
    finally { setKpiLoading(false); }
  };

  const loadContinueLearning = async () => {
    if (!user) return;
    try {
      const enrollments = await courseService.getStudentEnrollments(user.uid);
      const active = enrollments.filter((e: any) => e.paymentStatus === 'completed');
      if (!active.length) return;
      // Sort by lastAccessedAt desc
      active.sort((a: any, b: any) => {
        const ta = a.lastAccessedAt instanceof Date ? a.lastAccessedAt.getTime() : new Date(a.lastAccessedAt || 0).getTime();
        const tb = b.lastAccessedAt instanceof Date ? b.lastAccessedAt.getTime() : new Date(b.lastAccessedAt || 0).getTime();
        return tb - ta;
      });
      const top = active[0] as any;
      const course = await courseService.getCourseById(top.courseId);
      if (!course) return;
      setContinueLearning({
        courseId: top.courseId,
        title: course.title,
        instructor: course.instructor,
        progress: top.progress ?? 0,
        thumbnail: course.thumbnailUrl ?? course.thumbnail,
      });
    } catch {}
  };

  const loadAllCourses = async () => {
    setCoursesLoading(true);
    try {
      const all = await courseService.getPublishedCourses();
      setAllCourses(all);
    } catch {}
    finally { setCoursesLoading(false); }
  };

  const loadPendingTasks = async () => {
    if (!user) return;
    setTasksLoading(true);
    try {
      const now = new Date();
      const todayEnd = new Date(now); todayEnd.setHours(23,59,59,999);
      const tomorrowEnd = new Date(now); tomorrowEnd.setDate(now.getDate()+1); tomorrowEnd.setHours(23,59,59,999);
      const cutoff = new Date(now); cutoff.setDate(now.getDate()+14);

      const groups = await taskService.getTaskGroupsForStudent(user.uid);
      const items: typeof pendingTasks = [];
      groups.forEach((g: TaskGroup) => {
        if (g.status !== 'published') return;
        const due = g.dueDate instanceof Date ? g.dueDate : new Date(g.dueDate);
        if (due > cutoff) return;
        let urgency: 'overdue'|'today'|'tomorrow'|'upcoming';
        if (due < now) urgency = 'overdue';
        else if (due <= todayEnd) urgency = 'today';
        else if (due <= tomorrowEnd) urgency = 'tomorrow';
        else urgency = 'upcoming';
        items.push({ id: g.id, title: g.title, dueDate: due, urgency, points: g.totalPoints });
      });
      items.sort((a,b) => {
        const ord = { overdue:0, today:1, tomorrow:2, upcoming:3 };
        return ord[a.urgency] - ord[b.urgency] || a.dueDate.getTime() - b.dueDate.getTime();
      });
      setPendingTasks(items.slice(0, 8));
    } catch {}
    finally { setTasksLoading(false); }
  };

  const loadExamPerf = async () => {
    if (!user) return;
    setExamPerfLoading(true);
    try {
      const snap = await getDocs(query(
        collection(db, 'examSessions'),
        where('studentId', '==', user.uid),
        where('resultVisibility', '==', 'visible'),
        orderBy('submittedAt', 'asc'),
        limit(100),
      ));
      const byCourse = new Map<string, { courseTitle: string; points: { date: string; label: string; pct: number }[] }>();
      snap.docs.forEach(d => {
        const data = d.data();
        if (!['submitted','auto_submitted'].includes(data.status ?? '')) return;
        const cid = data.courseId ?? '_general';
        const cTitle = data.courseTitle ?? data.courseName ?? 'General';
        if (!byCourse.has(cid)) byCourse.set(cid, { courseTitle: cTitle, points: [] });
        const submittedAt = data.submittedAt?.toDate?.() ?? new Date();
        byCourse.get(cid)!.points.push({
          date: ymd(submittedAt),
          label: data.contentTitle ?? data.examTitle ?? 'Exam',
          pct: data.percentage ?? 0,
        });
      });
      const result = Array.from(byCourse.entries()).map(([courseId, v]) => ({ courseId, courseTitle: v.courseTitle, points: v.points }));
      setExamPerf(result);
      if (result.length > 0 && !examPerfCourse) setExamPerfCourse(result[0].courseId);
    } catch {}
    finally { setExamPerfLoading(false); }
  };

  const loadStudyHeatmap = async () => {
    if (!user) return;
    try {
      const WEEKS = 10;
      const today = new Date(); today.setHours(0,0,0,0);
      const cutoff = new Date(today); cutoff.setDate(today.getDate() - WEEKS * 7);
      const dayMap = new Map<string, number>();

      // Pomodoro sessions
      const sessions = await studyPlanService.getPomodoroSessions(user.uid, 500);
      sessions.forEach(s => {
        if (!s.completed) return;
        if (s.startTime < cutoff) return;
        const k = ymd(s.startTime);
        dayMap.set(k, (dayMap.get(k) ?? 0) + s.duration);
      });
      // Completed calendar events
      const evs = await studyPlanService.getEventsForStudent(user.uid);
      evs.forEach(e => {
        if (!e.completed) return;
        const at = (e as any).completedAt instanceof Date ? (e as any).completedAt : e.date;
        if (at < cutoff) return;
        try {
          const [sh,sm] = (e.startTime||'00:00').split(':').map(Number);
          const [eh,em] = (e.endTime||'00:00').split(':').map(Number);
          const mins = Math.max(0,(eh*60+em)-(sh*60+sm));
          const k = ymd(at);
          dayMap.set(k, (dayMap.get(k)??0) + mins);
        } catch {}
      });
      // 3. Lesson viewing time from content_progress
      const progressSnap = await getDocs(query(
        collection(db, 'content_progress'),
        where('studentId', '==', user.uid),
        where('lastWatchedAt', '>=', Timestamp.fromDate(cutoff)),
        orderBy('lastWatchedAt', 'asc'),
      ));
      progressSnap.docs.forEach(d => {
        const data = d.data();
        const mins = Math.round((data.watchedDuration ?? 0) / 60);
        if (mins <= 0) return;
        const at: Date = data.lastWatchedAt?.toDate?.() ?? new Date(data.lastWatchedAt);
        const k = ymd(at);
        dayMap.set(k, (dayMap.get(k) ?? 0) + mins);
      });

      const maxVal = Math.max(...Array.from(dayMap.values()), 1);
      const days: typeof studyHeatmap = [];
      for (let i = WEEKS*7-1; i >= 0; i--) {
        const d = new Date(today); d.setDate(today.getDate()-i);
        const k = ymd(d);
        const v = dayMap.get(k) ?? 0;
        days.push({ date: k, value: v, level: hmapLevel(v, maxVal) });
      }
      setStudyHeatmap(days);

      // App heatmap — use pomodoroTodayMinutes as proxy (or zero if no tracking yet)
      // We'll just generate zeros for now; DashboardLayout logs sessions separately
      setAppHeatmap(days.map(d => ({ ...d, value: 0, level: 0 as const })));
    } catch {}
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
  const selectedExamData = examPerf.find(e => e.courseId === examPerfCourse) ?? null;

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

      {/* ── KPI Stats Row ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 'clamp(8px,1.2vw,12px)' }}>
        {([
          { icon: <Clock size={13} color="#6366f1" />, label: 'Today', value: kpiLoading ? '…' : fmtMins(kpiTodayMins), sub: 'study time', accent: '#6366f1', delay: 0 },
          { icon: <TrendingUp size={13} color="#10b981" />, label: 'This Week', value: kpiLoading ? '…' : fmtMins(kpiWeekMins), sub: 'study time', accent: '#10b981', delay: 40 },
          { icon: <CheckCircle size={13} color="#f59e0b" />, label: 'Done', value: kpiLoading ? '…' : `${kpiTasksDone}`, sub: 'objectives', accent: '#f59e0b', delay: 80 },
          { icon: <Flame size={13} color="#ef4444" />, label: 'Streak', value: kpiLoading ? '…' : `${streak.current}`, sub: 'day streak', accent: '#ef4444', delay: 120 },
        ] as const).map((s, i) => (
          <Card key={i} accent={s.accent} enterDelay={s.delay} padding="sm">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {s.icon}
                <span style={{ fontSize: 9, fontWeight: 700, color: T.text3, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{s.label}</span>
              </div>
              <p style={{ fontSize: 'clamp(1.1rem,2vw,1.35rem)', fontWeight: 800, color: T.text, margin: 0, lineHeight: 1 }}>{s.value}</p>
              <p style={{ fontSize: 9, color: T.text3, margin: 0 }}>{s.sub}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* ── Continue Learning ─────────────────────────────────────────────────── */}
      {continueLearning && (
        <div style={{ padding: 'clamp(12px,1.8vw,16px)', borderRadius: 16, background: `linear-gradient(135deg,${primaryColor}12 0%,${primaryColor}06 100%)`, border: `1px solid ${primaryColor}28`, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 42, height: 42, borderRadius: 11, flexShrink: 0, overflow: 'hidden', background: `${primaryColor}20`, border: `1px solid ${primaryColor}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {continueLearning.thumbnail ? <img src={continueLearning.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <BookMarked size={18} color={primaryColor} />}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 9, fontWeight: 700, color: `${primaryColor}bb`, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 2px' }}>Continue Learning</p>
            <p style={{ fontSize: 'clamp(0.74rem,1.15vw,0.86rem)', fontWeight: 700, color: T.text, margin: '0 0 5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{continueLearning.title}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ flex: 1, height: 4, borderRadius: 99, background: T.trackBg, maxWidth: 140, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${continueLearning.progress}%`, borderRadius: 99, background: primaryColor }} />
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, color: T.text2 }}>{continueLearning.progress}%</span>
            </div>
          </div>
          <button onClick={() => navigate(`/content-library?courseId=${continueLearning.courseId}`)} style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5, padding: '8px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: "'Outfit',sans-serif", background: 'var(--ce-blue, #2563eb)', color: '#fff', boxShadow: '0 2px 10px rgba(37,99,235,0.28)', whiteSpace: 'nowrap' }}>
            <Play size={13} fill="#fff" />Continue
          </button>
        </div>
      )}

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

      {/* Cards grid — ordered per spec */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit,minmax(280px,1fr))', gap: 'clamp(14px,1.8vw,22px)' }}>

        {/* 1. Today's Objectives */}
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

        {/* 2. Daily Inspiration */}
        <Card title="Daily Inspiration" icon={<Star size={15} color="#f59e0b" />} accent="#f59e0b" enterDelay={40}>
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

        {/* 3. Pending Tasks */}
        <Card title="Pending Tasks" subtitle="Due within 2 weeks" icon={<AlertTriangle size={15} color="#f59e0b" />} accent="#f59e0b" enterDelay={80}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {tasksLoading ? (
              <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'24px 0' }}><Loader size={15} color="#f59e0b" className="animate-spin" /><span style={{ fontSize:12, color:T.text2 }}>Loading…</span></div>
            ) : pendingTasks.length === 0 ? (
              <div style={{ textAlign:'center', padding:'20px 0' }}><CheckCircle size={26} color={T.dimIcon} style={{ margin:'0 auto 6px' }} /><p style={{ fontSize:12, color:T.text3, margin:0 }}>All clear — no pending tasks</p></div>
            ) : pendingTasks.map(task => {
              const uc = task.urgency === 'overdue' ? '#ef4444' : task.urgency === 'today' ? '#f59e0b' : task.urgency === 'tomorrow' ? '#f97316' : '#6366f1';
              return (
                <div key={task.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 11px', borderRadius:12, background:`${uc}0d`, border:`1px solid ${uc}22` }}>
                  <div style={{ width:7, height:7, borderRadius:'50%', background:uc, flexShrink:0 }} />
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ fontSize:'clamp(0.7rem,1.05vw,0.78rem)', fontWeight:650, color:T.text, margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{task.title}</p>
                    {task.points > 0 && <p style={{ fontSize:9, color:T.text3, margin:'1px 0 0' }}>{task.points} pts</p>}
                  </div>
                  <div style={{ textAlign:'right', flexShrink:0 }}>
                    <p style={{ fontSize:10, fontWeight:700, color:uc, margin:0 }}>{fmtCountdown(task.dueDate)}</p>
                    <p style={{ fontSize:9, color:T.text3, margin:'1px 0 0', textTransform:'capitalize' }}>{task.urgency}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* 4. Weekly Schedule */}
        <Card title="Weekly Schedule" subtitle="Events this week" icon={<Calendar size={15} color="#06b6d4" />} accent="#06b6d4" enterDelay={120}>
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

        {/* 5. Focus Timer */}
        <Card title="Focus Timer" icon={<Timer size={15} color="#6366f1" />} accent="#6366f1" enterDelay={160}>
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

        {/* 6. Latest Updates */}
        <Card title="Latest Updates" icon={<Megaphone size={15} color="#a78bfa" />} accent="#8b5cf6" enterDelay={200}>
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

        {/* 7. My Goals */}
        <Card title="My Goals" subtitle="From your Study Planner" icon={<Award size={15} color="#f97316" />} accent="#f97316" enterDelay={240}>
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

      {/* 8. Subject Constellations */}
      <Card title="Subject Constellations" subtitle="Your knowledge map across subjects" accent="#ec4899" enterDelay={280}>
        {constellationsLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 0' }}>
            <Loader size={24} style={{ color: T.text2, animation: 'spin 1s linear infinite' }} />
          </div>
        ) : constellations.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: T.text3 }}>
            <Star size={40} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
            <p style={{ fontSize: 14, marginBottom: 4 }}>No subjects available yet</p>
            <p style={{ fontSize: 12 }}>Enroll in courses to start your learning journey</p>
          </div>
        ) : (
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
        )}
      </Card>

      {/* 9. Exam Performance */}
        <Card title="Exam Performance" subtitle="Score trend by course" icon={<BarChart2 size={15} color="#8b5cf6" />} accent="#8b5cf6" enterDelay={680}>
          {examPerfLoading ? (
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'24px 0' }}><Loader size={15} color="#8b5cf6" className="animate-spin" /><span style={{ fontSize:12, color:T.text2 }}>Loading…</span></div>
          ) : examPerf.length === 0 ? (
            <div style={{ textAlign:'center', padding:'24px 0' }}><BarChart2 size={28} color={T.dimIcon} style={{ margin:'0 auto 7px' }} /><p style={{ fontSize:12, color:T.text3, margin:0 }}>No exam results yet</p></div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              {examPerf.length > 1 && (
                <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                  {examPerf.map(e => (
                    <button key={e.courseId} onClick={() => setExamPerfCourse(e.courseId)} style={{ padding:'4px 10px', borderRadius:20, fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:"'Outfit',sans-serif", background:examPerfCourse===e.courseId?'rgba(139,92,246,0.18)':T.surface, border:`1px solid ${examPerfCourse===e.courseId?'rgba(139,92,246,0.40)':T.border}`, color:examPerfCourse===e.courseId?'#a78bfa':T.text2 }}>
                      {e.courseTitle}
                    </button>
                  ))}
                </div>
              )}
              {selectedExamData && selectedExamData.points.length > 0 && (() => {
                const pts = selectedExamData.points;
                const W=100, H=60, pad=4;
                const xs = pts.map((_,i) => pad + (i/Math.max(pts.length-1,1))*(W-pad*2));
                const ys = pts.map(p => H-pad-(p.pct/100)*(H-pad*2));
                const pathD = pts.map((_,i) => `${i===0?'M':'L'}${xs[i].toFixed(1)},${ys[i].toFixed(1)}`).join(' ');
                const fillD = `${pathD} L${xs[xs.length-1].toFixed(1)},${(H-pad).toFixed(1)} L${xs[0].toFixed(1)},${(H-pad).toFixed(1)} Z`;
                const avg = Math.round(pts.reduce((s,p)=>s+p.pct,0)/pts.length);
                const trend = pts.length>1 ? pts[pts.length-1].pct - pts[0].pct : 0;
                return (
                  <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                      <div style={{ flex:1 }}>
                        <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', height:80 }}>
                          {[0,25,50,75,100].map(v => { const y=H-pad-(v/100)*(H-pad*2); return <line key={v} x1={pad} y1={y} x2={W-pad} y2={y} stroke={T.border} strokeWidth="0.5" />; })}
                          <defs><linearGradient id="ef" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.28" /><stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.02" /></linearGradient></defs>
                          <path d={fillD} fill="url(#ef)" />
                          <path d={pathD} fill="none" stroke="#8b5cf6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          {pts.map((p,i) => <circle key={i} cx={xs[i]} cy={ys[i]} r="2.5" fill="#8b5cf6" stroke={dark?'#0d1117':'#fff'} strokeWidth="1"><title>{p.label}: {p.pct.toFixed(1)}%</title></circle>)}
                        </svg>
                      </div>
                      <div style={{ display:'flex', flexDirection:'column', gap:8, flexShrink:0, minWidth:64, textAlign:'center' }}>
                        <div><p style={{ fontSize:'clamp(1rem,1.8vw,1.25rem)', fontWeight:800, color:T.text, margin:0 }}>{avg}%</p><p style={{ fontSize:9, color:T.text3, margin:0 }}>avg</p></div>
                        <div><p style={{ fontSize:13, fontWeight:700, color:trend>0?'#10b981':trend<0?'#ef4444':T.muted, margin:0 }}>{trend>0?'↑':trend<0?'↓':'–'}{Math.abs(trend).toFixed(1)}%</p><p style={{ fontSize:9, color:T.text3, margin:0 }}>trend</p></div>
                      </div>
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                      {pts.slice(-4).map((p,i) => (
                        <div key={i} style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <div style={{ width:22, height:22, borderRadius:6, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', background:p.pct>=80?'rgba(16,185,129,0.12)':p.pct>=50?'rgba(245,158,11,0.12)':'rgba(239,68,68,0.12)', fontSize:10, fontWeight:700, color:p.pct>=80?'#10b981':p.pct>=50?'#f59e0b':'#ef4444' }}>{p.pct.toFixed(0)}</div>
                          <p style={{ flex:1, fontSize:11, color:T.text2, margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.label}</p>
                          <span style={{ fontSize:9, color:T.text3, flexShrink:0 }}>{p.date}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </Card>
      )}

      {/* ── Heatmaps ─────────────────────────────────────────────────────────── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,320px),1fr))', gap:'clamp(14px,1.8vw,22px)' }}>
        <HeatmapCard title="Study Activity" subtitle="Sessions + completed events" icon={<Zap size={15} color="#f59e0b" />} accent="#8b5cf6" days={studyHeatmap} view={heatmapView} onViewChange={setHeatmapView} T={T} dark={dark} unit="min" enterDelay={740} />
        <HeatmapCard title="App Usage" subtitle="Time in app per day" icon={<Clock size={15} color="#06b6d4" />} accent="#06b6d4" days={appHeatmap} view={heatmapView} onViewChange={setHeatmapView} T={T} dark={dark} unit="min" enterDelay={800} />
      </div>

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

// ─── HeatmapCard ─────────────────────────────────────────────────────────────
const HMAP_COLORS: Record<string, string[]> = {
  '#8b5cf6': ['rgba(139,92,246,0.07)','rgba(139,92,246,0.24)','rgba(139,92,246,0.48)','rgba(139,92,246,0.72)','rgba(139,92,246,0.94)'],
  '#06b6d4': ['rgba(6,182,212,0.07)','rgba(6,182,212,0.24)','rgba(6,182,212,0.48)','rgba(6,182,212,0.72)','rgba(6,182,212,0.94)'],
};
const HeatmapCard = ({
  title, subtitle, icon, accent, days, view, onViewChange, T, dark, unit, enterDelay,
}: {
  title: string; subtitle: string; icon: React.ReactNode; accent: string;
  days: { date: string; value: number; level: 0|1|2|3|4 }[];
  view: HeatmapView; onViewChange: (v: HeatmapView) => void;
  T: any; dark: boolean; unit: string; enterDelay: number;
}) => {
  const colors = HMAP_COLORS[accent] ?? HMAP_COLORS['#8b5cf6'];
  const CELL = view === 'months' ? 18 : view === 'weeks' ? 13 : 9;
  const GAP = 2;

  // aggregate
  const agg = (() => {
    if (view === 'days') return days;
    const map = new Map<string, number>();
    days.forEach(d => {
      const dt = new Date(d.date);
      const key = view === 'weeks'
        ? (() => { const w = new Date(dt); w.setDate(dt.getDate()-dt.getDay()); return w.toISOString().slice(0,10); })()
        : d.date.slice(0,7);
      map.set(key, (map.get(key)??0)+d.value);
    });
    const maxV = Math.max(...Array.from(map.values()),1);
    return Array.from(map.entries()).map(([date,value]) => ({
      date, value,
      level: (value===0?0:value/maxV<0.15?1:value/maxV<0.40?2:value/maxV<0.70?3:4) as 0|1|2|3|4,
    }));
  })();

  const active = agg.filter(d => d.level > 0).length;
  return (
    <Card title={title} subtitle={subtitle} icon={icon} accent={accent} enterDelay={enterDelay}>
      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        <div style={{ display:'flex', gap:4, alignSelf:'flex-end' }}>
          {(['days','weeks','months'] as HeatmapView[]).map(v => (
            <button key={v} onClick={() => onViewChange(v)} style={{ padding:'3px 8px', borderRadius:20, fontSize:10, fontWeight:600, cursor:'pointer', fontFamily:"'Outfit',sans-serif", background:view===v?`${accent}20`:T.surface, border:`1px solid ${view===v?`${accent}50`:T.border}`, color:view===v?accent:T.text3 }}>
              {v.charAt(0).toUpperCase()+v.slice(1)}
            </button>
          ))}
        </div>
        <div style={{ overflowX:'auto' }}>
            {view === 'days' ? (
              <div style={{ display:'grid', gridTemplateColumns:`repeat(${Math.ceil(agg.length/7)},${CELL}px)`, gridTemplateRows:`repeat(7,${CELL}px)`, gap:GAP, width:'fit-content' }}>
                {agg.map(d => (
                  <div key={d.date} title={`${d.date}: ${d.value}${unit}`} style={{ width:CELL, height:CELL, borderRadius:2, background:colors[d.level], transition:'transform 0.1s', cursor:'default' }}
                    onMouseOver={e => { (e.currentTarget as HTMLDivElement).style.transform='scale(1.3)'; }}
                    onMouseOut={e => { (e.currentTarget as HTMLDivElement).style.transform='scale(1)'; }}
                  />
                ))}
              </div>
            ) : (
              <div style={{ display:'flex', gap:GAP, flexWrap:'wrap' }}>
                {agg.map(d => <div key={d.date} title={`${d.date}: ${d.value}${unit}`} style={{ width:CELL, height:CELL, borderRadius:view==='months'?4:3, background:colors[d.level], cursor:'default', flexShrink:0 }} />)}
              </div>
            )}
        </div>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap:4 }}>
            <span style={{ fontSize:9, color:T.text3 }}>Less</span>
            {[0,1,2,3,4].map(l => <div key={l} style={{ width:9, height:9, borderRadius:2, background:colors[l] }} />)}
            <span style={{ fontSize:9, color:T.text3 }}>More</span>
          </div>
          <span style={{ fontSize:10, color:T.text3 }}>{active} active {view}</span>
        </div>
      </div>
    </Card>
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
