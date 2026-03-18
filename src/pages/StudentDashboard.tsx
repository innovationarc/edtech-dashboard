// src/pages/StudentDashboard.tsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Target, Calendar, Star, Play, Pause, RotateCcw, Plus,
  CheckCircle, Circle, Megaphone, Award, X, Loader,
  AlertCircle, Video, Radio, Timer, Volume2, VolumeX,
  Coffee, Trash, ChevronDown, ChevronUp, Layers, CheckCircle2, Tag,
  BookOpen, TrendingUp, Clock, Flame, ChevronRight, AlertTriangle,
  BarChart2, Zap, BookMarked,
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
import { subjectMapService, SubjectConstellation as SubjectConstellationType } from '../services/subjectMapService';
import {
  dashboardStatsService, KPIStats, HeatmapDay, CourseProgressItem,
  PendingTaskItem, ExamPerformancePoint, ContinueLearningItem,
} from '../services/dashboardStatsService';

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

function fmtMins(m: number): string {
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60); const rem = m % 60;
  return rem > 0 ? `${h}h ${rem}m` : `${h}h`;
}

function fmtCountdown(due: Date): string {
  const diff = due.getTime() - Date.now();
  if (diff < 0) {
    const ago = Math.abs(diff);
    const h = Math.floor(ago / 3600000);
    const d = Math.floor(h / 24);
    return d > 0 ? `${d}d overdue` : `${h}h overdue`;
  }
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(h / 24);
  if (d > 1) return `in ${d} days`;
  if (h > 0) return `in ${h}h`;
  return 'due soon';
}

// Aggregate heatmap days into weeks or months
function aggregateHeatmap(days: HeatmapDay[], view: HeatmapView): HeatmapDay[] {
  if (view === 'days') return days;
  const grouped = new Map<string, number>();
  days.forEach(d => {
    const dt = new Date(d.date);
    let key: string;
    if (view === 'weeks') {
      const weekStart = new Date(dt);
      weekStart.setDate(dt.getDate() - dt.getDay());
      key = weekStart.toISOString().slice(0, 10);
    } else {
      key = d.date.slice(0, 7);
    }
    grouped.set(key, (grouped.get(key) ?? 0) + d.value);
  });
  const maxVal = Math.max(...Array.from(grouped.values()), 1);
  const fn = (v: number): 0 | 1 | 2 | 3 | 4 => {
    if (v === 0) return 0;
    const p = v / maxVal;
    return p < 0.15 ? 1 : p < 0.40 ? 2 : p < 0.70 ? 3 : 4;
  };
  return Array.from(grouped.entries()).map(([date, value]) => ({
    date, value, level: fn(value),
  }));
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

  // ── NEW: Feature state ────────────────────────────────────────────────────
  const [kpi, setKpi]                                   = useState<KPIStats | null>(null);
  const [kpiLoading, setKpiLoading]                     = useState(true);
  const [courseProgress, setCourseProgress]             = useState<CourseProgressItem[]>([]);
  const [courseProgressLoading, setCourseProgressLoading] = useState(true);
  const [pendingTasks, setPendingTasks]                 = useState<PendingTaskItem[]>([]);
  const [pendingTasksLoading, setPendingTasksLoading]   = useState(true);
  const [studyHeatmap, setStudyHeatmap]                 = useState<HeatmapDay[]>([]);
  const [appHeatmap, setAppHeatmap]                     = useState<HeatmapDay[]>([]);
  const [heatmapView, setHeatmapView]                   = useState<HeatmapView>('days');
  const [examPerf, setExamPerf]                         = useState<{ courseId: string; courseTitle: string; points: ExamPerformancePoint[] }[]>([]);
  const [examPerfLoading, setExamPerfLoading]           = useState(true);
  const [continueLearning, setContinueLearning]         = useState<ContinueLearningItem | null>(null);
  const [selectedExamCourse, setSelectedExamCourse]     = useState<string>('');

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
    // NEW: load new features
    loadKPI(); loadCourseProgress(); loadPendingTasks(); loadHeatmaps(); loadExamPerf(); loadContinueLearning();
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
  const circumference = 2 * Math.PI * 54;
  const pct = (pomodoroTime / POMODORO_DURATIONS[pomodoroMode]) * 100;
  const pMins = String(Math.floor(pomodoroTime / 60)).padStart(2, '0');
  const pSecs = String(pomodoroTime % 60).padStart(2, '0');

  const playPomodoroSound = (type: 'focus' | 'break') => {
    if (!pomodoroSoundEnabled) return;
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator(); const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = type === 'focus' ? 880 : 440;
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.5);
    } catch {}
  };

  const startPomodoro = () => {
    if (!pomodoroActive) setPomodoroStartTime(new Date());
    setPomodoroActive(p => !p);
  };

  const resetPomodoro = (mode: 'focus' | 'short' | 'long') => {
    setPomodoroActive(false); setPomodoroMode(mode);
    setPomodoroTime(POMODORO_DURATIONS[mode]); setPomodoroPhase('idle');
  };

  const resetPomodoroSitting = () => {
    setPomodoroActive(false); setPomodoroMode('focus');
    setPomodoroTime(POMODORO_DURATIONS.focus); setPomodoroSessionCount(0); setPomodoroPhase('idle');
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Data loaders (original)
  // ─────────────────────────────────────────────────────────────────────────
  const loadAnnouncements = async () => {
    if (!user) return;
    setAnnouncementsLoading(true); setAnnouncementsError('');
    try { setAnnouncements(await announcementService.getAnnouncements()); }
    catch (e: any) { setAnnouncementsError(e.message || 'Failed to load'); }
    finally { setAnnouncementsLoading(false); }
  };

  const loadCalendarEvents = async () => {
    if (!user) return;
    setCalendarLoading(true);
    try {
      const events = await studyPlanService.getEventsForStudent(user.uid);
      const upcoming = events.filter(e => !e.completed && e.date >= new Date(Date.now() - 86400000));
      setCalendarEvents(upcoming);
    } catch {}
    finally { setCalendarLoading(false); }
  };

  const loadLiveClasses = async () => {
    if (!user) return;
    try {
      const classes = await liveClassService.getLiveClassesForStudent(user.uid, []);
      setLiveClasses(classes.filter(c => ['live', 'scheduled'].includes(c.status) && c.scheduledAt.toDate().getTime() - Date.now() < 3600000));
    } catch {}
  };

  const loadLiveStreams = async () => {
    if (!user) return;
    try {
      const streams = await streamService.getActiveStreams();
      setLiveStreams(streams.filter(s => s.status === 'live' || (s.scheduledAt && s.scheduledAt.toDate().getTime() - Date.now() < 3600000)));
    } catch {}
  };

  const loadLiveExams = async () => {
    if (!user) return;
    try {
      const enrollments = await courseService.getStudentEnrollments(user.uid);
      const courseIds = enrollments.map((e: any) => e.courseId);
      const exams = await liveExamService.getLiveExamsForStudent(user.uid, courseIds);
      setLiveExams(exams);
    } catch {}
  };

  const loadObjectives = async () => {
    if (!user) return;
    setObjectivesLoading(true);
    try { setObjectives(await dashboardService.getObjectives(user.uid)); }
    catch {}
    finally { setObjectivesLoading(false); }
  };

  const loadGoals = async () => {
    if (!user) return;
    setGoalsLoading(true);
    try { setGoals(await studyPlanService.getGoalsForStudent(user.uid)); }
    catch {}
    finally { setGoalsLoading(false); }
  };

  const loadInspiration = async () => {
    if (!user) return;
    setInspirationLoading(true);
    try { setInspiration(await inspirationService.getRandomInspiration()); }
    catch {}
    finally { setInspirationLoading(false); }
  };

  const loadEnrolledCourses = async () => {
    if (!user) return;
    try { setEnrolledCourses(await studyPlanService.getEnrolledCoursesForPlanning(user.uid)); }
    catch {}
  };

  const loadStreakData = async () => {
    if (!user) return;
    try {
      const s = await studyPlanService.getStreak(user.uid);
      if (s) setStreak({ current: s.currentStreak, longest: s.longestStreak, totalSessions: s.totalSessions });
    } catch {}
  };

  const loadConstellations = async () => {
    if (!user) return;
    setConstellationsLoading(true);
    try { setConstellations(await subjectMapService.getConstellations(user.uid)); }
    catch {}
    finally { setConstellationsLoading(false); }
  };

  // ── NEW: Data loaders ─────────────────────────────────────────────────────
  const loadKPI = async () => {
    if (!user) return;
    setKpiLoading(true);
    try { setKpi(await dashboardStatsService.getKPIStats(user.uid)); }
    catch {}
    finally { setKpiLoading(false); }
  };

  const loadCourseProgress = async () => {
    if (!user) return;
    setCourseProgressLoading(true);
    try { setCourseProgress(await dashboardStatsService.getCourseProgress(user.uid)); }
    catch {}
    finally { setCourseProgressLoading(false); }
  };

  const loadPendingTasks = async () => {
    if (!user) return;
    setPendingTasksLoading(true);
    try { setPendingTasks(await dashboardStatsService.getPendingTasks(user.uid)); }
    catch {}
    finally { setPendingTasksLoading(false); }
  };

  const loadHeatmaps = async () => {
    if (!user) return;
    try {
      const [study, app] = await Promise.allSettled([
        dashboardStatsService.getStudyHeatmap(user.uid, 10),
        dashboardStatsService.getAppUsageHeatmap(user.uid, 10),
      ]);
      if (study.status === 'fulfilled') setStudyHeatmap(study.value);
      if (app.status === 'fulfilled') setAppHeatmap(app.value);
    } catch {}
  };

  const loadExamPerf = async () => {
    if (!user) return;
    setExamPerfLoading(true);
    try {
      const data = await dashboardStatsService.getExamPerformance(user.uid);
      setExamPerf(data);
      if (data.length > 0) setSelectedExamCourse(data[0].courseId);
    } catch {}
    finally { setExamPerfLoading(false); }
  };

  const loadContinueLearning = async () => {
    if (!user) return;
    try { setContinueLearning(await dashboardStatsService.getContinueLearning(user.uid)); }
    catch {}
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Actions
  // ─────────────────────────────────────────────────────────────────────────
  const toggleObj = async (id: string, completed: boolean) => {
    try {
      await dashboardService.toggleObjective(id, !completed);
      setObjectives(prev => prev.map(o => o.id === id ? { ...o, completed: !o.completed } : o));
    } catch {}
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

  // Selected exam perf course data
  const selectedExamData = useMemo(() =>
    examPerf.find(e => e.courseId === selectedExamCourse) ?? null
  , [examPerf, selectedExamCourse]);

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

      {/* ── NEW: KPI Stats Row ─────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,140px),1fr))', gap: 'clamp(8px,1.2vw,12px)' }}>
        {[
          { icon: <Clock size={15} color="#6366f1" />, label: 'Today', value: kpiLoading ? '…' : fmtMins(kpi?.todayStudyMinutes ?? 0), sub: 'study time', accent: '#6366f1' },
          { icon: <TrendingUp size={15} color="#10b981" />, label: 'This Week', value: kpiLoading ? '…' : fmtMins(kpi?.weekStudyMinutes ?? 0), sub: 'study time', accent: '#10b981' },
          { icon: <CheckCircle size={15} color="#f59e0b" />, label: 'Completed', value: kpiLoading ? '…' : `${kpi?.tasksCompleted ?? 0}`, sub: 'objectives', accent: '#f59e0b' },
          { icon: <Flame size={15} color="#ef4444" />, label: 'Streak', value: kpiLoading ? '…' : `${kpi?.streakDays ?? 0}`, sub: 'day streak', accent: '#ef4444' },
        ].map((stat, i) => (
          <div key={i} style={{ padding: 'clamp(10px,1.5vw,14px)', borderRadius: 16, background: T.surface, border: `1px solid ${T.border}`, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${stat.accent}18`, border: `1px solid ${stat.accent}28`, flexShrink: 0 }}>{stat.icon}</div>
              <span style={{ fontSize: 10, fontWeight: 700, color: T.text3, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{stat.label}</span>
            </div>
            <div>
              <p style={{ fontSize: 'clamp(1.1rem,2vw,1.4rem)', fontWeight: 800, color: T.text, margin: 0, lineHeight: 1.1 }}>{stat.value}</p>
              <p style={{ fontSize: 10, color: T.text3, margin: '2px 0 0' }}>{stat.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── NEW: Continue Learning ─────────────────────────────────────────── */}
      {continueLearning && (
        <div style={{ padding: 'clamp(12px,1.8vw,16px)', borderRadius: 16, background: `linear-gradient(135deg, ${primaryColor}12 0%, ${primaryColor}06 100%)`, border: `1px solid ${primaryColor}28`, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0, background: continueLearning.thumbnail ? 'transparent' : `${primaryColor}20`, border: `1px solid ${primaryColor}30`, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {continueLearning.thumbnail
              ? <img src={continueLearning.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <BookMarked size={20} color={primaryColor} />}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: `${primaryColor}bb`, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 2px' }}>Continue Learning</p>
            <p style={{ fontSize: 'clamp(0.76rem,1.2vw,0.88rem)', fontWeight: 700, color: T.text, margin: '0 0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{continueLearning.title}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ flex: 1, height: 4, borderRadius: 99, background: T.trackBg, maxWidth: 160, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${continueLearning.progress}%`, borderRadius: 99, background: `linear-gradient(90deg,${primaryColor},${primaryColor}aa)` }} />
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, color: T.text2 }}>{continueLearning.progress}%</span>
              <span style={{ fontSize: 10, color: T.text3 }}>· {continueLearning.instructor}</span>
            </div>
          </div>
          <button onClick={() => navigate(`/student-courses/${continueLearning.courseId}`)} style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5, padding: '8px 14px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: "'Outfit',sans-serif", background: primaryColor, color: '#fff' }}>
            <Play size={11} fill="#fff" />Resume
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
              <Plus size={12} /> Add Goal
            </button>
          </div>
        </Card>

        {/* ── NEW: Pending Tasks ─────────────────────────────────────────────── */}
        <Card title="Pending Tasks" subtitle="Due within 2 weeks" icon={<AlertTriangle size={15} color="#f59e0b" />} accent="#f59e0b" enterDelay={540}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {pendingTasksLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '24px 0' }}><Loader size={15} color="#f59e0b" className="animate-spin" /><span style={{ fontSize: 12, color: T.text2 }}>Loading…</span></div>
            ) : pendingTasks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <CheckCircle size={26} color={T.dimIcon} style={{ margin: '0 auto 6px' }} />
                <p style={{ fontSize: 12, color: T.text3, margin: 0 }}>All clear! No pending tasks</p>
              </div>
            ) : pendingTasks.map(task => {
              const urgColor = task.urgency === 'overdue' ? '#ef4444' : task.urgency === 'today' ? '#f59e0b' : task.urgency === 'tomorrow' ? '#f97316' : '#6366f1';
              const urgBg    = task.urgency === 'overdue' ? 'rgba(239,68,68,0.08)' : task.urgency === 'today' ? 'rgba(245,158,11,0.08)' : task.urgency === 'tomorrow' ? 'rgba(249,115,22,0.07)' : 'rgba(99,102,241,0.06)';
              return (
                <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px', borderRadius: 12, background: urgBg, border: `1px solid ${urgColor}22` }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: urgColor, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 'clamp(0.7rem,1.05vw,0.78rem)', fontWeight: 650, color: T.text, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</p>
                    {task.course && <p style={{ fontSize: 9, color: T.text3, margin: '1px 0 0' }}>{task.course}</p>}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: urgColor, margin: 0 }}>{fmtCountdown(task.dueDate)}</p>
                    <p style={{ fontSize: 9, color: T.text3, margin: '1px 0 0', textTransform: 'capitalize' }}>{task.urgency}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

      </div>

      {/* ── NEW: Course Progress ──────────────────────────────────────────────── */}
      {(courseProgress.length > 0 || courseProgressLoading) && (
        <Card title="My Courses" subtitle="Enrollment progress" icon={<BookOpen size={15} color="#10b981" />} accent="#10b981" enterDelay={600}>
          {courseProgressLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '24px 0' }}><Loader size={15} color="#10b981" className="animate-spin" /><span style={{ fontSize: 12, color: T.text2 }}>Loading…</span></div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,260px),1fr))', gap: 'clamp(8px,1.2vw,12px)' }}>
              {courseProgress.slice(0, 6).map(c => (
                <div key={c.courseId} style={{ padding: '12px 14px', borderRadius: 14, background: T.surface, border: `1px solid ${T.border}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 9, flexShrink: 0, overflow: 'hidden', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.20)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {c.thumbnail ? <img src={c.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <BookOpen size={16} color="#10b981" />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 'clamp(0.7rem,1.05vw,0.78rem)', fontWeight: 700, color: T.text, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</p>
                      <p style={{ fontSize: 9, color: T.text3, margin: '1px 0 0' }}>{c.instructor}</p>
                    </div>
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 9, color: T.text3 }}>{c.completedLessons}/{c.totalLessons} lessons</span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: c.progress >= 80 ? '#10b981' : c.progress >= 40 ? '#f59e0b' : T.muted }}>{c.progress}%</span>
                    </div>
                    <div style={{ height: 5, borderRadius: 99, background: T.trackBg, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${c.progress}%`, borderRadius: 99, background: 'linear-gradient(90deg,#10b981,#06b6d4)' }} />
                    </div>
                  </div>
                  <button onClick={() => navigate(`/student-courses/${c.courseId}`)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '6px 0', borderRadius: 9, border: '1px solid rgba(16,185,129,0.25)', background: 'rgba(16,185,129,0.08)', color: '#10b981', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>
                    {c.progress === 0 ? 'Start' : c.progress >= 100 ? 'Review' : 'Continue'} <ChevronRight size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* ── NEW: Exam Performance Graph ───────────────────────────────────────── */}
      {(examPerf.length > 0 || examPerfLoading) && (
        <Card title="Exam Performance" subtitle="Score trend by course" icon={<BarChart2 size={15} color="#8b5cf6" />} accent="#8b5cf6" enterDelay={660}>
          {examPerfLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '24px 0' }}><Loader size={15} color="#8b5cf6" className="animate-spin" /><span style={{ fontSize: 12, color: T.text2 }}>Loading…</span></div>
          ) : examPerf.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0' }}><BarChart2 size={28} color={T.dimIcon} style={{ margin: '0 auto 7px' }} /><p style={{ fontSize: 12, color: T.text3, margin: 0 }}>No exam results yet</p></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Course tabs */}
              {examPerf.length > 1 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {examPerf.map(e => (
                    <button key={e.courseId} onClick={() => setSelectedExamCourse(e.courseId)}
                      style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: "'Outfit',sans-serif", background: selectedExamCourse === e.courseId ? 'rgba(139,92,246,0.18)' : T.surface, border: `1px solid ${selectedExamCourse === e.courseId ? 'rgba(139,92,246,0.40)' : T.border}`, color: selectedExamCourse === e.courseId ? '#a78bfa' : T.text2 }}>
                      {e.courseTitle}
                    </button>
                  ))}
                </div>
              )}
              {/* Simple SVG line chart */}
              {selectedExamData && selectedExamData.points.length > 0 && (() => {
                const pts = selectedExamData.points;
                const W = 100, H = 60, pad = 4;
                const xs = pts.map((_, i) => pad + (i / Math.max(pts.length - 1, 1)) * (W - pad * 2));
                const ys = pts.map(p => H - pad - (p.percentage / 100) * (H - pad * 2));
                const pathD = pts.map((_, i) => `${i === 0 ? 'M' : 'L'}${xs[i].toFixed(1)},${ys[i].toFixed(1)}`).join(' ');
                const fillD = `${pathD} L${xs[xs.length-1].toFixed(1)},${(H-pad).toFixed(1)} L${xs[0].toFixed(1)},${(H-pad).toFixed(1)} Z`;
                const avg = Math.round(pts.reduce((s, p) => s + p.percentage, 0) / pts.length);
                const trend = pts.length > 1 ? pts[pts.length-1].percentage - pts[0].percentage : 0;
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 80 }}>
                          {/* Grid lines */}
                          {[0, 25, 50, 75, 100].map(v => {
                            const y = H - pad - (v / 100) * (H - pad * 2);
                            return <line key={v} x1={pad} y1={y} x2={W - pad} y2={y} stroke={T.border} strokeWidth="0.5" />;
                          })}
                          {/* Fill */}
                          <defs>
                            <linearGradient id="examFill" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.3" />
                              <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.02" />
                            </linearGradient>
                          </defs>
                          <path d={fillD} fill="url(#examFill)" />
                          {/* Line */}
                          <path d={pathD} fill="none" stroke="#8b5cf6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          {/* Dots */}
                          {pts.map((p, i) => (
                            <circle key={i} cx={xs[i]} cy={ys[i]} r="2.5" fill="#8b5cf6" stroke={dark ? '#0d1117' : '#fff'} strokeWidth="1" />
                          ))}
                        </svg>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0, minWidth: 70 }}>
                        <div style={{ textAlign: 'center' }}>
                          <p style={{ fontSize: 'clamp(1rem,1.8vw,1.3rem)', fontWeight: 800, color: T.text, margin: 0 }}>{avg}%</p>
                          <p style={{ fontSize: 9, color: T.text3, margin: 0 }}>avg score</p>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <p style={{ fontSize: 13, fontWeight: 700, color: trend > 0 ? '#10b981' : trend < 0 ? '#ef4444' : T.muted, margin: 0 }}>
                            {trend > 0 ? '↑' : trend < 0 ? '↓' : '–'} {Math.abs(trend).toFixed(1)}%
                          </p>
                          <p style={{ fontSize: 9, color: T.text3, margin: 0 }}>trend</p>
                        </div>
                      </div>
                    </div>
                    {/* Exam list */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      {pts.slice(-4).map((p, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 24, height: 24, borderRadius: 6, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: p.percentage >= 80 ? 'rgba(16,185,129,0.12)' : p.percentage >= 50 ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)', fontSize: 10, fontWeight: 700, color: p.percentage >= 80 ? '#10b981' : p.percentage >= 50 ? '#f59e0b' : '#ef4444' }}>
                            {p.percentage.toFixed(0)}
                          </div>
                          <p style={{ flex: 1, fontSize: 11, color: T.text2, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.examTitle}</p>
                          <span style={{ fontSize: 9, color: T.text3, flexShrink: 0 }}>{p.date}</span>
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

      {/* ── NEW: Heatmaps ────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,340px),1fr))', gap: 'clamp(14px,1.8vw,22px)' }}>
        {/* Study Heatmap */}
        <Card title="Study Activity" subtitle="Sessions + completed events" icon={<Zap size={15} color="#f59e0b" />} accent="#f59e0b" enterDelay={720}>
          <HeatmapWidget days={studyHeatmap} view={heatmapView} onViewChange={setHeatmapView} accentColor="#f59e0b" unit="min" T={T} dark={dark} />
        </Card>

        {/* App Usage Heatmap */}
        <Card title="App Usage" subtitle="Time spent in app" icon={<Clock size={15} color="#06b6d4" />} accent="#06b6d4" enterDelay={780}>
          <HeatmapWidget days={appHeatmap} view={heatmapView} onViewChange={setHeatmapView} accentColor="#06b6d4" unit="sec" T={T} dark={dark} />
        </Card>
      </div>

      {/* Modals */}
      {showObjModal && <ObjModal onClose={() => setShowObjModal(false)} onAdd={addObj} />}

      {showGoalModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}>
          <div style={{ background: dark ? '#0d1018' : '#fff', border: `1px solid ${T.border}`, borderRadius: 18, padding: 22, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', position: 'relative', fontFamily: "'Outfit',sans-serif" }}>
            <button onClick={() => { setShowGoalModal(false); resetGoalForm(); }} style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 7, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'rgba(255,255,255,0.55)' }}><X size={13} /></button>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: T.text, margin: '0 0 16px' }}>Add Study Goal</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Mode selector */}
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: T.text3, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Goal Type</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {(['simple', 'topic', 'course'] as GoalMode[]).map(m => (
                    <button key={m} onClick={() => setGoalMode(m)} style={{ flex: 1, padding: '7px 0', borderRadius: 9, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: "'Outfit',sans-serif", background: goalMode === m ? 'rgba(99,102,241,0.18)' : T.surface, border: `1px solid ${goalMode === m ? 'rgba(99,102,241,0.4)' : T.border}`, color: goalMode === m ? '#818cf8' : T.text2 }}>
                      {m.charAt(0).toUpperCase() + m.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {goalMode !== 'course' && (
                <div>
                  <label style={{ fontSize: 10, fontWeight: 700, color: T.text3, display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Subject</label>
                  <input value={newGoal.subject} onChange={e => setNewGoal(p => ({ ...p, subject: e.target.value }))} placeholder="e.g. Mathematics" className={inputCls} />
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 700, color: T.text3, display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Target Date</label>
                  <input type="date" value={newGoal.targetDate} onChange={e => setNewGoal(p => ({ ...p, targetDate: e.target.value }))} className={inputCls} />
                </div>
                {goalMode === 'simple' && (
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 700, color: T.text3, display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Hours Needed</label>
                    <input type="number" min={1} max={500} value={newGoal.hoursNeeded} onChange={e => setNewGoal(p => ({ ...p, hoursNeeded: Number(e.target.value) }))} className={inputCls} />
                  </div>
                )}
              </div>

              {goalMode === 'simple' && (
                <div>
                  <label style={{ fontSize: 10, fontWeight: 700, color: T.text3, display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Difficulty</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {(['easy', 'medium', 'hard'] as StudyGoal['difficulty'][]).map(d => (
                      <button key={d} onClick={() => setNewGoal(p => ({ ...p, difficulty: d }))} style={{ flex: 1, padding: '6px 0', borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: "'Outfit',sans-serif", background: newGoal.difficulty === d ? (d === 'easy' ? 'rgba(16,185,129,0.15)' : d === 'medium' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)') : T.surface, border: `1px solid ${newGoal.difficulty === d ? (d === 'easy' ? 'rgba(16,185,129,0.4)' : d === 'medium' ? 'rgba(245,158,11,0.4)' : 'rgba(239,68,68,0.4)') : T.border}`, color: newGoal.difficulty === d ? (d === 'easy' ? '#10b981' : d === 'medium' ? '#f59e0b' : '#ef4444') : T.text2 }}>
                        {d.charAt(0).toUpperCase() + d.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {goalMode === 'topic' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label style={{ fontSize: 10, fontWeight: 700, color: T.text3, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Topics</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 6 }}>
                    <input value={topicInput.name} onChange={e => setTopicInput(p => ({ ...p, name: e.target.value }))} placeholder="Topic name" className={inputCls} />
                    <input type="number" min={1} max={100} value={topicInput.minHours} onChange={e => setTopicInput(p => ({ ...p, minHours: Number(e.target.value) }))} className={inputCls} style={{ width: 60 }} />
                    <button onClick={() => { if (!topicInput.name.trim()) return; setManualTopics(p => [...p, { id: Date.now().toString(), ...topicInput }]); setTopicInput({ name: '', minHours: 1, maxHours: 2, difficulty: 'medium' }); }} style={{ padding: '0 12px', borderRadius: 10, border: 'none', background: '#6366f1', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: "'Outfit',sans-serif" }}>Add</button>
                  </div>
                  {manualTopics.map((t, i) => (
                    <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 9, background: T.surface, border: `1px solid ${T.border}` }}>
                      <Tag size={11} color="#6366f1" />
                      <span style={{ flex: 1, fontSize: 12, color: T.text }}>{t.name}</span>
                      <span style={{ fontSize: 10, color: T.text3 }}>{t.minHours}–{t.maxHours}h</span>
                      <button onClick={() => setManualTopics(p => p.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 2 }}><X size={11} /></button>
                    </div>
                  ))}
                </div>
              )}

              {goalMode === 'course' && (() => {
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <label style={{ fontSize: 10, fontWeight: 700, color: T.text3, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Select Course</label>
                    <select value={ctCourseId} onChange={async e => {
                      const id = e.target.value; setCtCourseId(id); setCtSelSubjects(new Set()); setCtSelChapters(new Set()); setCtSelTopics(new Set());
                      if (!id) { setCtGroups([]); return; }
                      setCtLoadingGroups(true);
                      try { setCtGroups(await topicGroupService.getGroupsForCourse(id)); } catch { setCtGroups([]); } finally { setCtLoadingGroups(false); }
                    }} className={inputCls}>
                      <option value="">— Select course —</option>
                      {enrolledCourses.map(c => <option key={c.courseId} value={c.courseId}>{c.title}</option>)}
                    </select>
                    {ctLoadingGroups && <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Loader size={13} color="#6366f1" className="animate-spin" /><span style={{ fontSize: 11, color: T.text2 }}>Loading topics…</span></div>}
                    {!ctLoadingGroups && ctCourseId && ctGroups.length > 0 && (
                      <div style={{ border: `1px solid ${T.border}`, borderRadius: 12, overflow: 'hidden', maxHeight: 200, overflowY: 'auto' }}>
                        {ctGroups.map(grp => grp.subjects.map(subj => {
                          const subjTopicIds = subj.chapters.flatMap(c => c.topics.map(t => t.id));
                          const subjAllSel   = subjTopicIds.every(id => ctSelTopics.has(id));
                          const subjExpanded = ctExpandedSubjects.has(subj.id);
                          const toggleSubjSel = (e: React.ChangeEvent<HTMLInputElement>) => { e.stopPropagation(); setCtSelSubjects(p => { const n = new Set(p); subjAllSel ? n.delete(subj.id) : n.add(subj.id); return n; }); setCtSelTopics(p => { const n = new Set(p); subjTopicIds.forEach(id => subjAllSel ? n.delete(id) : n.add(id)); return n; }); };
                          return (
                            <div key={subj.id} className="border-b border-background-700/50 last:border-b-0">
                              <div className="flex items-center gap-2 px-3 py-2 hover:bg-background-700 transition-colors">
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
                    )}
                    {!ctLoadingGroups && ctCourseId && ctGroups.length === 0 && (
                      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2.5 text-xs text-amber-300">
                        No topic groups for this course yet. Use <button onClick={() => setGoalMode('topic')} className="underline font-medium">Add Topics</button> to plan manually.
                      </div>
                    )}
                    {calculatedHours > 0 && <p className="text-xs text-teal-400 text-right">{selectedCourseTopics.length} topics · <span className="font-semibold">{calculatedHoursRange ? `${calculatedHoursRange.min}–${calculatedHoursRange.max}h` : `${calculatedHours}h`}</span></p>}
                  </div>
                );
              })()}
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

// ─── Heatmap Widget ───────────────────────────────────────────────────────────
const HEATMAP_COLORS: Record<string, string[]> = {
  '#f59e0b': ['rgba(245,158,11,0.08)', 'rgba(245,158,11,0.25)', 'rgba(245,158,11,0.50)', 'rgba(245,158,11,0.75)', 'rgba(245,158,11,0.95)'],
  '#06b6d4': ['rgba(6,182,212,0.08)', 'rgba(6,182,212,0.25)', 'rgba(6,182,212,0.50)', 'rgba(6,182,212,0.75)', 'rgba(6,182,212,0.95)'],
};
const DEFAULT_COLORS = ['rgba(99,102,241,0.08)', 'rgba(99,102,241,0.25)', 'rgba(99,102,241,0.50)', 'rgba(99,102,241,0.75)', 'rgba(99,102,241,0.95)'];

const HeatmapWidget = ({
  days, view, onViewChange, accentColor, unit, T, dark,
}: {
  days: HeatmapDay[];
  view: HeatmapView;
  onViewChange: (v: HeatmapView) => void;
  accentColor: string;
  unit: string;
  T: any;
  dark: boolean;
}) => {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; day: HeatmapDay } | null>(null);
  const colors = HEATMAP_COLORS[accentColor] ?? DEFAULT_COLORS;
  const aggregated = aggregateHeatmap(days, view);
  const CELL = view === 'months' ? 20 : view === 'weeks' ? 14 : 10;
  const GAP  = 2;

  // For day view: render 7 rows × N cols (week columns)
  // For week/month: render as horizontal bar
  const totalDays = aggregated.length;

  if (totalDays === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '20px 0' }}>
        <Zap size={22} color={T.dimIcon} style={{ margin: '0 auto 6px' }} />
        <p style={{ fontSize: 11, color: T.text3, margin: 0 }}>No data yet</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* View toggle */}
      <div style={{ display: 'flex', gap: 4, alignSelf: 'flex-end' }}>
        {(['days', 'weeks', 'months'] as HeatmapView[]).map(v => (
          <button key={v} onClick={() => onViewChange(v)} style={{ padding: '3px 9px', borderRadius: 20, fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: "'Outfit',sans-serif", background: view === v ? `${accentColor}20` : T.surface, border: `1px solid ${view === v ? `${accentColor}50` : T.border}`, color: view === v ? accentColor : T.text3 }}>
            {v.charAt(0).toUpperCase() + v.slice(1)}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div style={{ position: 'relative', overflowX: 'auto' }} onMouseLeave={() => setTooltip(null)}>
        {view === 'days' ? (() => {
          const weeks = Math.ceil(aggregated.length / 7);
          const cols = weeks;
          const rows = 7;
          return (
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols},${CELL}px)`, gridTemplateRows: `repeat(${rows},${CELL}px)`, gap: GAP, width: 'fit-content' }}>
              {aggregated.map((day, i) => (
                <div key={day.date} title={`${day.date}: ${day.value}${unit}`}
                  onMouseEnter={e => setTooltip({ x: e.currentTarget.getBoundingClientRect().left, y: e.currentTarget.getBoundingClientRect().top, day })}
                  style={{ width: CELL, height: CELL, borderRadius: 2, background: colors[day.level], cursor: 'default', transition: 'transform 0.1s', flexShrink: 0 }}
                  onMouseOver={e => { (e.currentTarget as HTMLDivElement).style.transform = 'scale(1.3)'; }}
                  onMouseOut={e => { (e.currentTarget as HTMLDivElement).style.transform = 'scale(1)'; setTooltip(null); }}
                />
              ))}
            </div>
          );
        })() : (
          <div style={{ display: 'flex', gap: GAP, flexWrap: 'wrap' }}>
            {aggregated.map(day => (
              <div key={day.date} title={`${day.date}: ${day.value}${unit}`}
                onMouseEnter={e => setTooltip({ x: e.currentTarget.getBoundingClientRect().left, y: e.currentTarget.getBoundingClientRect().top, day })}
                onMouseLeave={() => setTooltip(null)}
                style={{ width: CELL, height: CELL, borderRadius: view === 'months' ? 4 : 3, background: colors[day.level], cursor: 'default', flexShrink: 0 }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Legend + summary */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 9, color: T.text3 }}>Less</span>
          {[0,1,2,3,4].map(l => <div key={l} style={{ width: 9, height: 9, borderRadius: 2, background: colors[l] }} />)}
          <span style={{ fontSize: 9, color: T.text3 }}>More</span>
        </div>
        <span style={{ fontSize: 10, color: T.text3 }}>
          {aggregated.filter(d => d.level > 0).length} active {view}
        </span>
      </div>
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
