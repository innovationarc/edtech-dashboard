// src/pages/StudentStudyPlan.tsx
// AI Study Planner — Calendar · Goals · Analytics · AI Chat
// Fixes: duplicate creation, broken AI, no loading states
// New: enrolled course planning, custom activities, chat persistence, add-to-calendar from chat
// AI provider loaded from Firestore (Admin → AI Model Settings) — supports Groq, Gemini, OpenAI, Anthropic, DeepSeek

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, Loader, AlertCircle,
  Edit, Trash2, Clock, Target, Brain, Sparkles, BarChart2, MessageSquare,
  CheckCircle2, X, Flame, BookOpen, Play, Pause, RotateCcw, Send,
  ListTodo, Timer, AlertOctagon, Lightbulb, Heart, GraduationCap,
  Zap, ChevronDown, ChevronUp, Award, TrendingUp, RefreshCw, Trash,
  AlertTriangle, BarChart,
} from 'lucide-react';
import Calendar from 'react-calendar';
import { format, differenceInDays, startOfWeek, endOfWeek, isToday, isTomorrow } from 'date-fns';
import { useDashboard } from '../contexts/DashboardContext';
import {
  studyPlanService, StudyPlanEvent, StudyGoal,
  CustomActivity, EnrolledCourseForPlanning,
} from '../services/studyPlanService';
import {
  aiStudyPlannerService, AIInsight, AIScheduleSuggestion, CalendarEventFromChat,
} from '../services/aiStudyPlannerService';
import { aiModelConfigService, callProviderDirect, AIModelConfig } from '../services/aiModelConfigService';
import StudyPlanEventModal from '../components/shared/StudyPlanEventModal';
import Card from '../components/ui/Card';


type View = 'calendar' | 'list' | 'analytics' | 'chat';
type Value = Date | null | [Date | null, Date | null];

// ─── Style helpers ────────────────────────────────────────────────────────────

const TYPE_COLOR: Record<string, string> = {
  assignment: 'border-amber-500', exam: 'border-red-500', class: 'border-indigo-500',
  study_session: 'border-emerald-500', deadline: 'border-pink-500', personal: 'border-purple-500',
};
const TYPE_BG: Record<string, string> = {
  assignment: 'bg-amber-500/10 text-amber-300', exam: 'bg-red-500/10 text-red-300',
  class: 'bg-indigo-500/10 text-indigo-300', study_session: 'bg-emerald-500/10 text-emerald-300',
  deadline: 'bg-pink-500/10 text-pink-300', personal: 'bg-purple-500/10 text-purple-300',
};
const TYPE_EMOJI: Record<string, string> = {
  assignment: '📋', exam: '🎯', class: '🏫', study_session: '📚', deadline: '⏰', personal: '📝',
};
const INSIGHT_STYLE: Record<string, { bg: string; icon: any; color: string }> = {
  warning:    { bg: 'bg-amber-500/10 border-amber-500/30',    icon: AlertOctagon, color: 'text-amber-400' },
  success:    { bg: 'bg-emerald-500/10 border-emerald-500/30', icon: CheckCircle2, color: 'text-emerald-400' },
  tip:        { bg: 'bg-blue-500/10 border-blue-500/30',      icon: Lightbulb,    color: 'text-blue-400' },
  motivation: { bg: 'bg-purple-500/10 border-purple-500/30',  icon: Heart,        color: 'text-purple-400' },
};
const POMODORO_DURATIONS = { focus: 25 * 60, short: 5 * 60, long: 15 * 60 };
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const CATEGORY_EMOJI: Record<string, string> = {
  sport: '🏃', job: '💼', hobby: '🎨', family: '👨‍👩‍👧', religious: '🙏', social: '🎉', transport: '🚌', other: '📌',
};

// ─── Component ────────────────────────────────────────────────────────────────

const StudentStudyPlan = () => {
  const { user } = useDashboard();

  const [view, setView]         = useState<View>('calendar');
  const [date, setDate]         = useState<Value>(new Date());
  const [events, setEvents]     = useState<StudyPlanEvent[]>([]);
  const [goals, setGoals]       = useState<StudyGoal[]>([]);
  const [streak, setStreak]     = useState({ current: 0, longest: 0, totalSessions: 0 });
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [aiReady, setAiReady]   = useState(false);

  // Enrolled courses & custom activities
  const [enrolledCourses, setEnrolledCourses] = useState<EnrolledCourseForPlanning[]>([]);
  const [customActivities, setCustomActivities] = useState<CustomActivity[]>([]);
  const [showCoursesPanel, setShowCoursesPanel] = useState(true);
  const [showActivitiesPanel, setShowActivitiesPanel] = useState(false);
  const [showActivityForm, setShowActivityForm] = useState(false);
  const [newActivity, setNewActivity] = useState({
    name: '', category: 'other' as CustomActivity['category'],
    scheduleType: 'recurring' as 'recurring' | 'specific_dates',
    daysOfWeek: [] as number[],
    specificDates: [] as string[],
    startTime: '08:00', endTime: '09:00',
    isFlexible: false, notes: '',
  });
  const [savingActivity, setSavingActivity] = useState(false);

  // Modal / editing
  const [showModal, setShowModal]       = useState(false);
  const [editingEvent, setEditingEvent] = useState<StudyPlanEvent | null>(null);
  const [isSaving, setIsSaving]         = useState(false);

  // AI insights
  const [insights, setInsights]               = useState<AIInsight[]>([]);
  const [insightsLoading, setInsightsLoading] = useState(false);

  // AI Schedule
  const [scheduleLoading, setScheduleLoading]     = useState(false);
  const [suggestions, setSuggestions]             = useState<AIScheduleSuggestion[]>([]);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [freeHoursPerDay, setFreeHoursPerDay]     = useState(4);
  const [addingSchedule, setAddingSchedule]       = useState(false);
  // Cache: avoid re-calling AI when nothing changed
  const [scheduleHash, setScheduleHash]           = useState('');
  const [cachedSuggestions, setCachedSuggestions] = useState<AIScheduleSuggestion[]>([]);
  // AI config (for direct calls)
  const [aiConfig, setAiConfig]                   = useState<AIModelConfig | null>(null);

  // Reschedule — global (all goals at once)
  const [showRescheduleModal, setShowRescheduleModal]   = useState(false);
  const [rescheduling, setRescheduling]                 = useState(false);
  const [reschedulePreview, setReschedulePreview]       = useState<AIScheduleSuggestion[]>([]);
  const [addingReschedule, setAddingReschedule]         = useState(false);
  // Free time input — 'hours' mode or 'range' mode
  const [freeTimeMode, setFreeTimeMode]                 = useState<'hours' | 'range'>('hours');
  const [freeTimeRanges, setFreeTimeRanges]             = useState<{ start: string; end: string }[]>([{ start: '14:00', end: '22:00' }]);
  // Keep single aliases for backward compat
  const freeTimeStart = freeTimeRanges[0]?.start ?? '14:00';
  const freeTimeEnd   = freeTimeRanges[0]?.end   ?? '22:00';

  // Helper: minutes between two HH:MM strings
  const rangeMinutes = (s: string, e: string) => {
    const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
    return Math.max(0, toMin(e) - toMin(s));
  };

  // Derived: effective free hours per day (used everywhere)
  const effectiveFreeHours = freeTimeMode === 'range'
    ? Math.max(1, Math.round(freeTimeRanges.reduce((sum, r) => sum + rangeMinutes(r.start, r.end), 0) / 60))
    : freeHoursPerDay;

  // Chat
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; content: string; calendarEvents?: CalendarEventFromChat[] }[]>([]);
  const [chatInput, setChatInput]       = useState('');
  const [chatLoading, setChatLoading]   = useState(false);
  const [pendingCalendarEvents, setPendingCalendarEvents] = useState<CalendarEventFromChat[]>([]);
  const [addingChatEvents, setAddingChatEvents] = useState(false);
  const [chatHistoryLoaded, setChatHistoryLoaded] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const dayEventsRef = useRef<HTMLDivElement>(null); // Fix #8: scroll to day events on calendar click

  // Pomodoro
  const [pomodoroActive, setPomodoroActive]     = useState(false);
  const [pomodoroMode, setPomodoroMode]         = useState<'focus' | 'short' | 'long'>('focus');
  const [pomodoroTime, setPomodoroTime]         = useState(POMODORO_DURATIONS.focus);
  const [pomodoroSubject, setPomodoroSubject]   = useState('');
  const pomodoroRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Goals form
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [newGoal, setNewGoal] = useState({ subject: '', targetDate: '', hoursNeeded: 10, difficulty: 'medium' as StudyGoal['difficulty'] });
  const [savingGoal, setSavingGoal] = useState(false);
  // Goal editing
  const [editingGoal, setEditingGoal]   = useState<StudyGoal | null>(null);
  const [editGoalData, setEditGoalData] = useState({ subject: '', targetDate: '', hoursNeeded: 10, difficulty: 'medium' as StudyGoal['difficulty'] });
  const [savingEditGoal, setSavingEditGoal] = useState(false);
  // Activity editing
  const [editingActivity, setEditingActivity]   = useState<CustomActivity | null>(null);
  const [editActivityData, setEditActivityData] = useState({
    name: '', category: 'other' as CustomActivity['category'],
    scheduleType: 'recurring' as 'recurring' | 'specific_dates',
    daysOfWeek: [] as number[], specificDates: [] as string[],
    startTime: '08:00', endTime: '09:00', isFlexible: false, notes: '',
  });
  const [savingEditActivity, setSavingEditActivity] = useState(false);

  // ── Load ────────────────────────────────────────────────────────────────────

  const loadAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      let [evts, gls, stk, acts, courses] = await Promise.all([
        studyPlanService.getEventsForStudent(user.uid),
        studyPlanService.getGoalsForStudent(user.uid),
        studyPlanService.getStreak(user.uid),
        studyPlanService.getCustomActivities(user.uid),
        studyPlanService.getEnrolledCoursesForPlanning(user.uid),
      ]);

      // Fix #9: auto-delete personal events expired > 24h, respecting AI event goal deadlines
      const deletedIds = await studyPlanService.deleteExpiredPersonalEvents(user.uid, evts, gls);
      if (deletedIds.length > 0) evts = evts.filter(e => !deletedIds.includes(e.id));

      // Fix #2: remove specific-date activities whose all dates have passed
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const expiredActs = acts.filter(a =>
        a.scheduleType === 'specific_dates' &&
        (a.specificDates?.length ?? 0) > 0 &&
        (a.specificDates ?? []).every(d => new Date(d + 'T00:00:00') < today)
      );
      await Promise.all(expiredActs.map(a => studyPlanService.deleteCustomActivity(a.id))).catch(() => {});
      acts = acts.filter(a => !expiredActs.find(ea => ea.id === a.id));

      setEvents(evts);
      setGoals(gls);
      setCustomActivities(acts);
      setEnrolledCourses(courses);
      if (stk) setStreak({ current: stk.currentStreak, longest: stk.longestStreak, totalSessions: stk.totalSessions });
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [user]);

  // Load AI config from Firestore once on mount
  useEffect(() => {
    aiModelConfigService.getConfig().then(cfg => {
      setAiReady(!!cfg.apiKey);
      if (cfg.apiKey) setAiConfig(cfg);
    }).catch(() => {});
  }, []);

  useEffect(() => { if (user) loadAll(); }, [user, loadAll]);

  // Load chat history once
  useEffect(() => {
    if (user && !chatHistoryLoaded && view === 'chat') {
      studyPlanService.getChatHistory(user.uid, 30).then(history => {
        if (history.length > 0) {
          setChatMessages(history.map(m => ({ role: m.role, content: m.content, calendarEvents: m.calendarEvents })));
        }
        setChatHistoryLoaded(true);
      }).catch(() => setChatHistoryLoaded(true));
    }
  }, [user, view, chatHistoryLoaded]);

  // Load AI insights once per session
  useEffect(() => {
    if (events.length > 0 && aiReady && insights.length === 0 && user) loadInsights();
  }, [events]);

  const loadInsights = async () => {
    if (!user || !aiReady) return;
    setInsightsLoading(true);
    try {
      const upcoming  = events.filter(e => e.date >= new Date() && !e.completed);
      const completed = events.filter(e => e.completed).length;
      const rate      = events.length > 0 ? Math.round((completed / events.length) * 100) : 0;
      setInsights(await aiStudyPlannerService.getPersonalizedInsights(
        user.displayName || user.name || 'Student', upcoming, rate, '',
        user.uid // cache key
      ));
    } catch { /* silent */ } finally { setInsightsLoading(false); }
  };

  // ── Derived ─────────────────────────────────────────────────────────────────

  const selectedDate   = date instanceof Date ? date : new Date();
  const upcomingEvents = events.filter(e => e.date >= new Date() && !e.completed).sort((a, b) => a.date.getTime() - b.date.getTime());
  const completedCount = events.filter(e => e.completed).length;
  const completionRate = events.length > 0 ? Math.round((completedCount / events.length) * 100) : 0;
  const thisWeekEvents = events.filter(e => { const n = new Date(); return e.date >= startOfWeek(n) && e.date <= endOfWeek(n); });
  const todayEvents    = events.filter(e => isToday(e.date));
  const dayEvents      = events.filter(e => e.date.toDateString() === selectedDate.toDateString());

  // ── Event CRUD ───────────────────────────────────────────────────────────────

  const handleSaveEvent = async (data: any) => {
    if (!user || isSaving) return; // prevents duplicate creation
    setIsSaving(true);
    try {
      if (editingEvent) await studyPlanService.updateEvent(editingEvent.id, data);
      else              await studyPlanService.createEvent(data);
      setShowModal(false);
      setEditingEvent(null);
      await loadAll();
    } catch (e: any) { setError(e.message); }
    finally { setIsSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this event?')) return;
    try { await studyPlanService.deleteEvent(id); await loadAll(); }
    catch (e: any) { setError(e.message); }
  };

  const handleToggleComplete = async (ev: StudyPlanEvent) => {
    try { await studyPlanService.markEventComplete(ev.id, !ev.completed); await loadAll(); }
    catch (e: any) { setError(e.message); }
  };

  // ── AI Schedule ─────────────────────────────────────────────────────────────

  // Fix #1: stable hash of inputs — skip AI if nothing changed
  const computeScheduleHash = () => JSON.stringify({
    freeHours: effectiveFreeHours,
    freeMode: freeTimeMode,
    freeRanges: freeTimeMode === 'range' ? freeTimeRanges : [],
    goals: goals.map(g => ({ s: g.subject, t: g.targetDate.toISOString().slice(0, 10), h: g.hoursNeeded, d: g.difficulty, p: g.currentProgress })),
    activities: customActivities.map(a => ({ n: a.name, days: a.daysOfWeek, st: a.startTime, et: a.endTime })),
  });

  const handleGenerateSchedule = async () => {
    if (!aiReady || !goals.length || scheduleLoading) return;

    // Return cached schedule if inputs haven't changed
    const hash = computeScheduleHash();
    if (hash === scheduleHash && cachedSuggestions.length > 0) {
      setSuggestions(cachedSuggestions);
      setShowScheduleModal(true);
      return;
    }

    setScheduleLoading(true);
    try {
      const result = await aiStudyPlannerService.generateSmartSchedule(
        goals.map(g => ({ subject: g.subject, targetDate: g.targetDate, hoursNeeded: g.hoursNeeded, difficulty: g.difficulty, currentProgress: g.currentProgress })),
        events.map(e => ({ date: e.date, startTime: e.startTime, endTime: e.endTime })),
        effectiveFreeHours,
        '',
        {
          enrolledCourses: enrolledCourses.map(c => ({ title: c.title, subjects: c.subjects })),
          customActivities: customActivities.map(a => ({
            name: a.name, daysOfWeek: a.daysOfWeek,
            startTime: a.startTime, endTime: a.endTime, isFlexible: a.isFlexible,
          })),
        }
      );
      setSuggestions(result);
      setCachedSuggestions(result);
      setScheduleHash(hash);
      setShowScheduleModal(true);
    } catch (e: any) { setError('AI schedule error: ' + e.message); }
    finally { setScheduleLoading(false); }
  };

  const handleAcceptSchedule = async () => {
    if (!user || addingSchedule) return;
    setAddingSchedule(true);
    try {
      // Clear ALL existing AI events directly from Firestore — bypasses stale React state
      await studyPlanService.clearAllStudentAIEventsFromFirestore(
        user.uid, goals.map(g => g.subject)
      );
      await studyPlanService.createBulkAIEvents(
        suggestions.map(s => ({
          title: s.title, description: s.reason,
          date: s.date, startTime: s.startTime, endTime: s.endTime,
          course: s.subject, instructorId: user.uid,
          instructorName: user.displayName || user.name || '',
          isPersonal: true, studentId: user.uid,
          targetAudience: 'specific_student' as const,
          targetStudentIds: [user.uid], targetCourseIds: [],
          eventType: 'study_session' as const,
          priority: s.priority, isAIGenerated: true,
          aiReason: s.reason, aiTips: s.tips,
          sessionType: s.sessionType, completed: false,
        })), user.uid
      );
      setShowScheduleModal(false);
      setSuggestions([]);
      setCachedSuggestions([]);
      setScheduleHash(''); // reset so next change triggers fresh AI call
      await loadAll();
    } catch (e: any) { setError(e.message); }
    finally { setAddingSchedule(false); }
  };

  // ── Goals ────────────────────────────────────────────────────────────────────

  const handleAddGoal = async () => {
    if (!user || !newGoal.subject || !newGoal.targetDate || savingGoal) return;
    setSavingGoal(true);
    try {
      await studyPlanService.createGoal({
        studentId: user.uid, subject: newGoal.subject,
        targetDate: new Date(newGoal.targetDate),
        hoursNeeded: newGoal.hoursNeeded, hoursCompleted: 0,
        difficulty: newGoal.difficulty, currentProgress: 0, isActive: true,
      });
      setNewGoal({ subject: '', targetDate: '', hoursNeeded: 10, difficulty: 'medium' });
      setShowGoalForm(false);
      setGoals(await studyPlanService.getGoalsForStudent(user.uid));
    } catch (e: any) { setError(e.message); }
    finally { setSavingGoal(false); }
  };

  const handleAddGoalFromCourse = async (course: EnrolledCourseForPlanning) => {
    if (!user) return;
    if (goals.some(g => g.subject === course.title)) {
      setError(`Goal for "${course.title}" already exists`);
      return;
    }
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 30);
    // Fix #7: use the course's actual subjects in the goal description
    const subjectLabel = course.subjects.length > 0
      ? `${course.title} (${course.subjects.slice(0, 3).join(', ')})`
      : course.title;
    try {
      await studyPlanService.createGoal({
        studentId: user.uid,
        subject: subjectLabel,
        targetDate: deadline,
        hoursNeeded: Math.max(8, (course.totalLessons - course.completedLessons)),
        hoursCompleted: 0, difficulty: 'medium',
        currentProgress: course.progress, isActive: true,
        courseId: course.courseId,
      });
      setGoals(await studyPlanService.getGoalsForStudent(user.uid));
    } catch (e: any) { setError(e.message); }
  };

  const handleUpdateGoalProgress = async (id: string, progress: number) => {
    try {
      await studyPlanService.updateGoal(id, { currentProgress: progress });
      setGoals(await studyPlanService.getGoalsForStudent(user!.uid));
    } catch { /* silent */ }
  };

  const handleDeleteGoal = async (id: string) => {
    if (!confirm('Delete this goal?')) return;
    try {
      await studyPlanService.deleteGoal(id);
      setGoals(await studyPlanService.getGoalsForStudent(user!.uid));
    } catch { /* silent */ }
  };

  const handleOpenEditGoal = (g: StudyGoal) => {
    setEditingGoal(g);
    setEditGoalData({
      subject:     g.subject,
      targetDate:  g.targetDate.toISOString().slice(0, 10),
      hoursNeeded: g.hoursNeeded,
      difficulty:  g.difficulty,
    });
  };

  const handleSaveEditGoal = async () => {
    if (!editingGoal || !editGoalData.subject || !editGoalData.targetDate || savingEditGoal) return;
    setSavingEditGoal(true);
    try {
      await studyPlanService.updateGoal(editingGoal.id, {
        subject:     editGoalData.subject,
        targetDate:  new Date(editGoalData.targetDate),
        hoursNeeded: editGoalData.hoursNeeded,
        difficulty:  editGoalData.difficulty,
      });
      setEditingGoal(null);
      setGoals(await studyPlanService.getGoalsForStudent(user!.uid));
      setScheduleHash(''); // bust schedule cache so changes are reflected
    } catch (e: any) { setError(e.message); }
    finally { setSavingEditGoal(false); }
  };

  // ── AI Plan Progress ─────────────────────────────────────────────────────────

  /** Returns progress stats for AI-generated events linked to a goal */
  const getGoalAIProgress = (goal: StudyGoal) => {
    const baseSubject = goal.subject.split(' (')[0];
    const goalEvents = events.filter(
      e => e.isAIGenerated && e.isPersonal &&
        (e.course === goal.subject || e.course === baseSubject || e.course?.startsWith(baseSubject))
    );
    const now = new Date();
    const completedSessions  = goalEvents.filter(e => e.completed).length;
    const totalSessions      = goalEvents.length;
    // Past = sessions whose scheduled time has passed
    const pastSessions       = goalEvents.filter(e => e.date < now).length;
    const remainingSessions  = goalEvents.filter(e => !e.completed && e.date >= now).length;
    const completedPast      = goalEvents.filter(e => e.completed && e.date < now).length;
    // Only "behind" when: there are sessions, some are past, and not all past ones are done
    const behind             = totalSessions > 0 && pastSessions > 0 && completedPast < pastSessions;
    const missedSessions     = Math.max(0, pastSessions - completedPast);
    const daysLeft           = differenceInDays(goal.targetDate, now);
    const sessionRate        = totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0;
    return {
      goalEvents, completedSessions, totalSessions, pastSessions, remainingSessions,
      completedPast, behind, missedSessions, daysLeft, sessionRate,
    };
  };

  // ── Reschedule (Global — all goals) ─────────────────────────────────────────

  const handleOpenReschedule = () => {
    setReschedulePreview([]);
    setShowRescheduleModal(true);
  };

  const handleGenerateReschedule = async () => {
    if (!aiConfig || rescheduling || goals.length === 0) return;
    setRescheduling(true);
    try {
      const now = new Date();
      const todayStr = now.toISOString().slice(0, 10);
      const currentTimeStr = now.toTimeString().slice(0, 5); // HH:MM

      // Build per-goal summary using live progress
      const goalsSummary = goals.map(g => {
        const prog = getGoalAIProgress(g);
        const daysLeft = Math.max(1, differenceInDays(g.targetDate, new Date()));
        const hoursLeft = Math.max(1, Math.round(g.hoursNeeded * (1 - g.currentProgress / 100)));
        const maxSessions = Math.min(Math.floor((daysLeft * effectiveFreeHours) / 1.5), 10);
        return { ...g, prog, daysLeft, hoursLeft, maxSessions,
          deadlineStr: g.targetDate.toISOString().slice(0, 10) };
      });

      const totalSessions = goalsSummary.reduce((sum, g) => sum + g.maxSessions, 0);

      const startTimeHint = freeTimeMode === 'range' ? freeTimeStart : '09:00';
      const endTimeHint   = freeTimeMode === 'range' ? freeTimeEnd   : `${9 + effectiveFreeHours}:00`;
      const rangesDesc = freeTimeMode === 'range'
        ? freeTimeRanges.map(r => `${r.start}–${r.end}`).join(', ')
        : `${startTimeHint}–${endTimeHint}`;

      const prompt = `You are a study planner. A student has multiple goals and needs a catch-up schedule.

TODAY: ${todayStr}
CURRENT TIME: ${currentTimeStr} (do NOT schedule any session on ${todayStr} that starts before ${currentTimeStr})
FREE TIME EACH DAY: ${rangesDesc} (${effectiveFreeHours}h available total)

GOALS:
${goalsSummary.map((g, i) => `${i + 1}. Subject: "${g.subject}"
   Deadline: ${g.deadlineStr} (${g.daysLeft} days left)
   Hours needed: ~${g.hoursLeft}h | Difficulty: ${g.difficulty}
   Sessions done: ${g.prog.completedSessions}/${g.prog.totalSessions} | Missed: ${g.prog.missedSessions}
   Max new sessions for this goal: ${g.maxSessions}`).join('\n\n')}

TOTAL sessions to generate across all goals: ~${totalSessions} (never exceed this)

STRICT RULES:
- Title format: "<Subject> — Session N" (e.g. "Physics — Session 1"). Never invent sub-topics.
- All sessions MUST fall between ${todayStr} and the goal's deadline.
- All session times MUST fall within the free time ranges: ${rangesDesc}.
- On ${todayStr} specifically, do NOT schedule any session starting before ${currentTimeStr}.
- Sessions are 60–90 minutes. Never overlap on the same day.
- Spread sessions for each goal proportionally across their remaining days.
- Keep "reason" to 1 sentence. "tips" is one short action tip.
- Do not schedule more than ${effectiveFreeHours}h of total sessions per day across all subjects.

Return ONLY a valid JSON array, no markdown:
[
  {
    "title": "<Subject> — Session N",
    "subject": "<exact subject name from goals list>",
    "date": "YYYY-MM-DD",
    "startTime": "HH:MM",
    "endTime": "HH:MM",
    "priority": "high|medium|low",
    "sessionType": "focus|review|practice",
    "reason": "One sentence on what to do.",
    "tips": ["One short action tip."]
  }
]`;

      const raw     = await callProviderDirect(prompt, aiConfig, 3000, 0.5);
      const cleaned = raw.replace(/```json|```/g, '').trim();
      const parsed: AIScheduleSuggestion[] = JSON.parse(cleaned);
      if (!Array.isArray(parsed) || parsed.length === 0)
        throw new Error('AI returned empty. Try again.');
      const withDates = parsed.map(s => ({ ...s, date: new Date((s as any).date) }));
      setReschedulePreview(withDates as any);
    } catch (e: any) {
      setError('Reschedule error: ' + e.message);
    } finally {
      setRescheduling(false);
    }
  };

  const handleAcceptReschedule = async () => {
    if (!user || !reschedulePreview.length || addingReschedule) return;
    setAddingReschedule(true);
    try {
      // Delete ALL uncompleted AI events for this student from Firestore directly
      await studyPlanService.clearAllStudentAIEventsFromFirestore(
        user.uid, goals.map(g => g.subject)
      );

      await studyPlanService.createBulkAIEvents(
        reschedulePreview.map((s: any) => ({
          title: s.title,
          description: s.reason,
          date: s.date instanceof Date ? s.date : new Date(s.date),
          startTime: s.startTime,
          endTime: s.endTime,
          course: s.subject,
          instructorId: user.uid,
          instructorName: user.displayName || user.name || '',
          isPersonal: true,
          studentId: user.uid,
          targetAudience: 'specific_student' as const,
          targetStudentIds: [user.uid],
          targetCourseIds: [],
          eventType: 'study_session' as const,
          priority: s.priority || 'medium',
          isAIGenerated: true,
          aiReason: s.reason,
          aiTips: s.tips || [],
          sessionType: s.sessionType || 'focus',
          completed: false,
        })),
        user.uid
      );

      setShowRescheduleModal(false);
      setReschedulePreview([]);
      setScheduleHash('');
      await loadAll();
    } catch (e: any) {
      setError('Failed to apply reschedule: ' + e.message);
    } finally {
      setAddingReschedule(false);
    }
  };

  // ── Custom Activities ────────────────────────────────────────────────────────

  const handleSaveActivity = async () => {
    const hasSchedule = newActivity.scheduleType === 'recurring'
      ? newActivity.daysOfWeek.length > 0
      : newActivity.specificDates.length > 0;
    if (!user || !newActivity.name || !hasSchedule || savingActivity) return;
    setSavingActivity(true);
    try {
      const payload: Omit<CustomActivity, 'id' | 'createdAt'> = {
        studentId: user.uid,
        name: newActivity.name,
        category: newActivity.category,
        scheduleType: newActivity.scheduleType,
        daysOfWeek: newActivity.scheduleType === 'recurring' ? newActivity.daysOfWeek : [],
        startTime: newActivity.startTime,
        endTime: newActivity.endTime,
        isFlexible: newActivity.isFlexible,
        // only include notes + specificDates if non-empty to avoid Firestore undefined error
        ...(newActivity.notes ? { notes: newActivity.notes } : {}),
        ...(newActivity.scheduleType === 'specific_dates' && newActivity.specificDates.length
          ? { specificDates: newActivity.specificDates }
          : {}),
      };
      await studyPlanService.createCustomActivity(payload);
      setNewActivity({ name: '', category: 'other', scheduleType: 'recurring', daysOfWeek: [], specificDates: [], startTime: '08:00', endTime: '09:00', isFlexible: false, notes: '' });
      setShowActivityForm(false);
      setCustomActivities(await studyPlanService.getCustomActivities(user.uid));
    } catch (e: any) { setError(e.message); }
    finally { setSavingActivity(false); }
  };

  const handleDeleteActivity = async (id: string) => {
    try {
      await studyPlanService.deleteCustomActivity(id);
      setCustomActivities(prev => prev.filter(a => a.id !== id));
    } catch { /* silent */ }
  };

  const handleOpenEditActivity = (a: CustomActivity) => {
    setEditingActivity(a);
    setEditActivityData({
      name:          a.name,
      category:      a.category,
      scheduleType:  a.scheduleType || 'recurring',
      daysOfWeek:    a.daysOfWeek || [],
      specificDates: a.specificDates || [],
      startTime:     a.startTime,
      endTime:       a.endTime,
      isFlexible:    a.isFlexible,
      notes:         a.notes || '',
    });
  };

  const handleSaveEditActivity = async () => {
    const hasSchedule = editActivityData.scheduleType === 'recurring'
      ? editActivityData.daysOfWeek.length > 0
      : editActivityData.specificDates.length > 0;
    if (!editingActivity || !editActivityData.name || !hasSchedule || savingEditActivity) return;
    setSavingEditActivity(true);
    try {
      const updates: Partial<CustomActivity> = {
        name:         editActivityData.name,
        category:     editActivityData.category,
        scheduleType: editActivityData.scheduleType,
        daysOfWeek:   editActivityData.scheduleType === 'recurring' ? editActivityData.daysOfWeek : [],
        startTime:    editActivityData.startTime,
        endTime:      editActivityData.endTime,
        isFlexible:   editActivityData.isFlexible,
        ...(editActivityData.notes      ? { notes:         editActivityData.notes }         : {}),
        ...(editActivityData.scheduleType === 'specific_dates' && editActivityData.specificDates.length
          ? { specificDates: editActivityData.specificDates } : {}),
      };
      await studyPlanService.updateCustomActivity(editingActivity.id, updates);
      setEditingActivity(null);
      setCustomActivities(await studyPlanService.getCustomActivities(user!.uid));
      setScheduleHash(''); // bust cache so AI schedule reflects changes
    } catch (e: any) { setError(e.message); }
    finally { setSavingEditActivity(false); }
  };

  const toggleEditActivityDay = (day: number) => {
    setEditActivityData(p => ({
      ...p,
      daysOfWeek: p.daysOfWeek.includes(day) ? p.daysOfWeek.filter(d => d !== day) : [...p.daysOfWeek, day],
    }));
  };

  const toggleActivityDay = (day: number) => {
    setNewActivity(p => ({
      ...p,
      daysOfWeek: p.daysOfWeek.includes(day) ? p.daysOfWeek.filter(d => d !== day) : [...p.daysOfWeek, day],
    }));
  };

  // ── Pomodoro ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (pomodoroActive) {
      pomodoroRef.current = setInterval(() => {
        setPomodoroTime(t => {
          if (t <= 1) {
            setPomodoroActive(false);
            if (pomodoroMode === 'focus' && user) {
              studyPlanService.savePomodoroSession({
                studentId: user.uid, subject: pomodoroSubject || 'General',
                startTime: new Date(), duration: 25, completed: true, notes: '',
              }).then(() => studyPlanService.getStreak(user.uid))
                .then(s => { if (s) setStreak({ current: s.currentStreak, longest: s.longestStreak, totalSessions: s.totalSessions }); })
                .catch(() => {});
            }
            return POMODORO_DURATIONS[pomodoroMode];
          }
          return t - 1;
        });
      }, 1000);
    } else { if (pomodoroRef.current) clearInterval(pomodoroRef.current); }
    return () => { if (pomodoroRef.current) clearInterval(pomodoroRef.current); };
  }, [pomodoroActive, pomodoroMode]);

  const resetPomodoro = (mode: 'focus' | 'short' | 'long') => {
    setPomodoroActive(false); setPomodoroMode(mode); setPomodoroTime(POMODORO_DURATIONS[mode]);
  };

  const pct          = Math.round((1 - pomodoroTime / POMODORO_DURATIONS[pomodoroMode]) * 100);
  const pMins        = String(Math.floor(pomodoroTime / 60)).padStart(2, '0');
  const pSecs        = String(pomodoroTime % 60).padStart(2, '0');
  const circumference = 2 * Math.PI * 54;

  // ── Chat ─────────────────────────────────────────────────────────────────────

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);

  const handleSendChat = async () => {
    if (!chatInput.trim() || !aiReady || chatLoading) return;
    const msg = chatInput.trim();
    setChatInput('');

    const userMsg = { role: 'user' as const, content: msg };
    setChatMessages(p => [...p, userMsg]);
    setChatLoading(true);

    // Fire-and-forget save
    studyPlanService.saveChatMessage(user!.uid, { role: 'user', content: msg }).catch(() => {});

    try {
      const { response, calendarEvents } = await aiStudyPlannerService.chatWithAI(
        msg,
        {
          studentName: user?.displayName || user?.name || 'Student',
          totalEvents: events.length,
          subjects: [...new Set(events.map(e => e.course).filter(Boolean))],
          upcomingExams: events.filter(e => e.eventType === 'exam' && e.date >= new Date()).map(e => e.title),
          enrolledCourses: enrolledCourses.map(c => ({
            title: c.title, subjects: c.subjects,
            totalLessons: c.totalLessons, progress: c.progress,
          })),
          customActivities: customActivities.map(a => ({
            name: a.name,
            days: a.daysOfWeek.map(d => DAYS[d]),
            time: `${a.startTime}–${a.endTime}`,
            priority: a.isFlexible ? 'flexible' : 'fixed',
          })),
          activeGoals: goals.map(g => ({
            subject: g.subject,
            targetDate: g.targetDate.toISOString().split('T')[0],
            hoursNeeded: g.hoursNeeded,
            progress: g.currentProgress,
          })),
          completionRate,
          streak: streak.current,
          pomodoroSessions: streak.totalSessions,
        },
        chatMessages.slice(-8),
        ''
      );

      const assistantMsg = { role: 'assistant' as const, content: response, calendarEvents };
      setChatMessages(p => [...p, assistantMsg]);

      // Fire-and-forget save
      studyPlanService.saveChatMessage(user!.uid, { role: 'assistant', content: response, calendarEvents }).catch(() => {});

      if (calendarEvents && calendarEvents.length > 0) {
        setPendingCalendarEvents(calendarEvents);
      }
    } catch (err: any) {
      setChatMessages(p => [...p, {
        role: 'assistant',
        content: `Something went wrong. Please try again.${err?.message ? ` (${err.message})` : ''}`,
      }]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleAddChatEventsToCalendar = async () => {
    if (!user || !pendingCalendarEvents.length || addingChatEvents) return;
    setAddingChatEvents(true);
    try {
      const eventsToCreate = pendingCalendarEvents.map(e => ({
        title: e.title,
        description: e.description || 'AI-generated study session',
        date: new Date(e.date),
        startTime: e.startTime,
        endTime: e.endTime,
        course: e.subject,
        eventType: (e.eventType || 'study_session') as StudyPlanEvent['eventType'],
        priority: (e.priority || 'medium') as StudyPlanEvent['priority'],
        instructorId: user.uid,
        instructorName: user.displayName || user.name || '',
        isPersonal: true,
        studentId: user.uid,
        targetAudience: 'specific_student' as const,
        targetStudentIds: [user.uid],
        targetCourseIds: [],
        isAIGenerated: true,
        aiReason: 'Created from AI chat',
        completed: false,
      }));

      await studyPlanService.createBulkAIEvents(eventsToCreate, user.uid);
      const count = eventsToCreate.length;
      setPendingCalendarEvents([]);
      await loadAll();

      setChatMessages(p => [...p, {
        role: 'assistant',
        content: `Done! Added ${count} study session${count > 1 ? 's' : ''} to your calendar. Head to the Calendar tab to see them.`,
      }]);
    } catch (e: any) {
      setError('Failed to add events: ' + e.message);
    } finally {
      setAddingChatEvents(false);
    }
  };

  const handleClearChat = async () => {
    if (!user || !confirm('Clear all chat history?')) return;
    await studyPlanService.clearChatHistory(user.uid).catch(() => {});
    setChatMessages([]);
    setPendingCalendarEvents([]);
    setChatHistoryLoaded(true);
  };

  // ── Input style ──────────────────────────────────────────────────────────────

  const inputCls = 'w-full bg-background-700 text-white text-sm rounded-xl px-3 py-2.5 border border-background-600 focus:outline-none focus:border-primary-500 transition-colors placeholder-gray-500';

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader size={32} className="animate-spin text-primary-500" />
    </div>
  );

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            My Study Plan
            {aiReady && <span className="text-xs bg-purple-500/15 border border-purple-500/30 text-purple-300 px-2 py-1 rounded-full flex items-center gap-1"><Sparkles size={10} /> AI</span>}
          </h1>
          <p className="text-gray-400 mt-1 text-sm">Manage your schedule and track your progress</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Free hours selector (feeds into AI schedule) */}
          {aiReady && goals.length > 0 && (
            <div className="flex items-center gap-2 bg-background-800 border border-background-700 rounded-xl px-3 py-2">
              <Clock size={12} className="text-gray-400" />
              <span className="text-xs text-gray-400">Free hrs/day:</span>
              <select
                value={freeHoursPerDay}
                onChange={e => setFreeHoursPerDay(Number(e.target.value))}
                className="bg-transparent text-white text-xs focus:outline-none cursor-pointer"
              >
                {[2, 3, 4, 5, 6, 8, 10].map(h => (
                  <option key={h} value={h}>{h}h</option>
                ))}
              </select>
            </div>
          )}
          {aiReady && goals.length > 0 && (
            <button
              onClick={handleGenerateSchedule}
              disabled={scheduleLoading}
              className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-primary-600 hover:from-purple-700 hover:to-primary-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {scheduleLoading ? <Loader size={14} className="animate-spin" /> : <Brain size={14} />}
              {scheduleLoading ? 'Generating…' : 'AI Schedule'}
            </button>
          )}
          <button
            onClick={() => { setEditingEvent(null); setShowModal(true); }}
            className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all"
          >
            <Plus size={14} /> Add Event
          </button>
        </div>
      </div>

      {/* ── Error Banner ── */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl flex items-center gap-2 text-sm">
          <AlertCircle size={14} />{error}
          <button onClick={() => setError('')} className="ml-auto"><X size={13} /></button>
        </div>
      )}

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Streak',      value: streak.current,        extra: `Best: ${streak.longest}d`,          cls: 'from-orange-600/20 to-red-600/20 border-orange-500/20' },
          { label: 'This Week',   value: thisWeekEvents.length,  extra: `${todayEvents.length} today`,        cls: 'from-blue-600/20 to-indigo-600/20 border-blue-500/20' },
          { label: 'Completion',  value: `${completionRate}%`,   extra: `${completedCount}/${events.length} done`, cls: 'from-emerald-600/20 to-green-600/20 border-emerald-500/20' },
          { label: 'Goals',       value: goals.length,           extra: `${goals.filter(g => g.currentProgress >= 100).length} completed`, cls: 'from-purple-600/20 to-violet-600/20 border-purple-500/20' },
        ].map(s => (
          <div key={s.label} className={`bg-gradient-to-br ${s.cls} border rounded-2xl p-4`}>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">{s.label}</p>
            <p className="text-2xl font-bold text-white">{s.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{s.extra}</p>
          </div>
        ))}
      </div>

      {/* ── AI Insights ── */}
      {(insights.length > 0 || insightsLoading) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {insightsLoading && [1, 2, 3, 4].map(i => (
            <div key={i} className="bg-background-800 border border-background-700 rounded-2xl p-4 animate-pulse">
              <div className="h-3 bg-background-600 rounded w-24 mb-2" /><div className="h-2 bg-background-600 rounded w-full" />
            </div>
          ))}
          {insights.map((ins, i) => {
            const s = INSIGHT_STYLE[ins.type] || INSIGHT_STYLE.tip;
            const Icon = s.icon;
            return (
              <div key={i} className={`${s.bg} border rounded-2xl p-4`}>
                <div className="flex items-center gap-2 mb-1.5">
                  <Icon size={13} className={s.color} />
                  <span className={`text-xs font-semibold ${s.color}`}>{ins.title}</span>
                </div>
                <p className="text-xs text-gray-300 leading-relaxed">{ins.message}</p>
                {ins.action && <p className="text-xs mt-1.5 font-medium text-primary-400">{ins.action} →</p>}
              </div>
            );
          })}
        </div>
      )}

      {/* ── View Tabs ── */}
      <div className="flex gap-1 bg-background-800 border border-background-700 p-1 rounded-2xl w-fit flex-wrap">
        {([
          { id: 'calendar', label: 'Calendar',  Icon: CalendarIcon },
          { id: 'list',     label: 'Upcoming',  Icon: ListTodo },
          { id: 'analytics',label: 'Analytics', Icon: BarChart2 },
          { id: 'chat',     label: 'AI Chat',   Icon: MessageSquare },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setView(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${view === t.id ? 'bg-primary-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}>
            <t.Icon size={13} />{t.label}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════ CALENDAR VIEW ═══════════════════════════ */}
      {view === 'calendar' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left column */}
          <div className="space-y-4">
            <Card>
              <h2 className="text-base font-semibold text-white mb-4">Calendar</h2>
              <div className="custom-calendar">
                <Calendar onChange={(val) => { setDate(val); setTimeout(() => dayEventsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80); }} value={date}
                  className="bg-transparent text-white rounded-lg w-full"
                  tileClassName={({ date: d }) => events.some(e => e.date.toDateString() === d.toDateString()) ? 'has-event' : null}
                  prevLabel={<ChevronLeft size={15} />} nextLabel={<ChevronRight size={15} />}
                  navigationLabel={({ date: d }) => <span className="text-white font-medium">{format(d, 'MMMM yyyy')}</span>}
                />
              </div>
              <div className="mt-4 pt-4 border-t border-background-700 grid grid-cols-2 gap-1.5">
                {[['assignment', 'amber'], ['exam', 'red'], ['class', 'indigo'], ['study_session', 'emerald'], ['deadline', 'pink'], ['personal', 'purple']].map(([t, c]) => (
                  <div key={t} className="flex items-center gap-1.5">
                    <div className={`h-2 w-2 rounded-full bg-${c}-500`} />
                    <span className="text-xs text-gray-400 capitalize">{t.replace('_', ' ')}</span>
                  </div>
                ))}
              </div>
            </Card>

            {/* Pomodoro Timer */}
            <Card>
              <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
                <Timer size={14} className="text-primary-400" /> Pomodoro Timer
              </h2>
              <div className="relative flex justify-center items-center mb-4 h-32">
                <svg width="128" height="128" className="-rotate-90" style={{ position: 'absolute' }}>
                  <circle cx="64" cy="64" r="54" strokeWidth="8" stroke="#1f2937" fill="none" />
                  <circle cx="64" cy="64" r="54" strokeWidth="8" stroke="#6366f1" fill="none"
                    strokeDasharray={circumference} strokeDashoffset={circumference * (1 - pct / 100)}
                    strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s linear' }} />
                </svg>
                <div className="relative text-center z-10">
                  <span className="text-2xl font-bold text-white font-mono">{pMins}:{pSecs}</span>
                  <p className="text-xs text-gray-400 capitalize">{pomodoroMode === 'short' ? 'Short Break' : pomodoroMode === 'long' ? 'Long Break' : 'Focus'}</p>
                </div>
              </div>
              <div className="flex gap-2 mb-3">
                {(['focus', 'short', 'long'] as const).map(m => (
                  <button key={m} onClick={() => resetPomodoro(m)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${pomodoroMode === m ? 'bg-primary-600 text-white' : 'bg-background-700 text-gray-400 hover:text-white'}`}>
                    {m === 'focus' ? '25m' : m === 'short' ? '5m' : '15m'}
                  </button>
                ))}
              </div>
              <input value={pomodoroSubject} onChange={e => setPomodoroSubject(e.target.value)} placeholder="Subject (optional)" className={inputCls + ' mb-3'} />
              <div className="flex gap-2">
                <button onClick={() => setPomodoroActive(p => !p)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${pomodoroActive ? 'bg-amber-600 hover:bg-amber-700' : 'bg-primary-600 hover:bg-primary-700'} text-white`}>
                  {pomodoroActive ? <><Pause size={13} />Pause</> : <><Play size={13} />Start</>}
                </button>
                <button onClick={() => resetPomodoro(pomodoroMode)} className="p-2.5 bg-background-700 hover:bg-background-600 text-gray-400 hover:text-white rounded-xl transition-colors">
                  <RotateCcw size={14} />
                </button>
              </div>
              {streak.totalSessions > 0 && (
                <p className="text-xs text-center text-gray-500 mt-3">{streak.totalSessions} sessions · ~{Math.round(streak.totalSessions * 25 / 60)}h focused</p>
              )}
            </Card>
          </div>

          {/* Right column */}
          <div className="lg:col-span-2 space-y-4">

            {/* Events for selected day */}
            <div ref={dayEventsRef}>
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-white">
                  {isToday(selectedDate) ? 'Today' : isTomorrow(selectedDate) ? 'Tomorrow' : format(selectedDate, 'MMMM d, yyyy')}
                  <span className="text-gray-500 text-sm font-normal ml-2">({dayEvents.length})</span>
                </h2>
                <button onClick={() => { setEditingEvent(null); setShowModal(true); }}
                  className="flex items-center gap-1 text-xs bg-primary-600 hover:bg-primary-700 text-white px-3 py-1.5 rounded-lg transition-colors">
                  <Plus size={12} />Add
                </button>
              </div>
              {dayEvents.length === 0 ? (
                <div className="py-8 text-center text-gray-400">
                  <CalendarIcon size={36} className="mx-auto mb-3 text-gray-600" />
                  <p className="text-sm">No events for this day</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {dayEvents.map(ev => {
                    const now = new Date();
                    // Only show "Expired" if:
                    // - AI event: the linked goal's deadline has passed
                    // - Regular personal event: the event itself is 0–24h past AND not completed
                    let isExpired = false;
                    if (ev.isAIGenerated && !ev.completed) {
                      const baseSubject = ev.course?.split(' (')[0] || '';
                      const linkedGoal = goals.find(
                        g => g.subject === ev.course || g.subject.split(' (')[0] === baseSubject
                      );
                      // Only expired if the goal deadline has passed
                      isExpired = linkedGoal ? now > linkedGoal.targetDate : false;
                    } else if (!ev.isAIGenerated && !ev.completed) {
                      const msSince = now.getTime() - ev.date.getTime();
                      isExpired = msSince > 0 && msSince < 24 * 60 * 60 * 1000;
                    }
                    return (
                    <div key={ev.id} className={`bg-background-800 rounded-xl p-4 border-l-4 ${TYPE_COLOR[ev.eventType] || 'border-gray-500'} ${ev.completed ? 'opacity-60' : ''}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center flex-wrap gap-2 mb-1.5">
                            <span>{TYPE_EMOJI[ev.eventType] || '📅'}</span>
                            <span className={`text-sm font-semibold ${ev.completed ? 'line-through text-gray-500' : 'text-white'}`}>{ev.title}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${TYPE_BG[ev.eventType]}`}>{ev.eventType.replace('_', ' ')}</span>
                            {ev.isAIGenerated && <span className="text-xs bg-purple-500/15 text-purple-300 px-1.5 py-0.5 rounded-full flex items-center gap-1"><Sparkles size={9} />AI</span>}
                            {isExpired && <span className="text-xs bg-red-500/15 text-red-400 px-1.5 py-0.5 rounded-full border border-red-500/30">Expired</span>}
                          </div>
                          {ev.description && <p className="text-xs text-gray-400 mb-1.5 line-clamp-1">{ev.description}</p>}
                          <div className="flex flex-wrap gap-3 text-xs text-gray-400">
                            <span className="flex items-center gap-1"><CalendarIcon size={11} />{format(ev.date, 'MMM d, yyyy')}</span>
                            <span className="flex items-center gap-1"><Clock size={11} />{ev.startTime}–{ev.endTime}</span>
                            {ev.course && <span className="flex items-center gap-1"><BookOpen size={11} />{ev.course}</span>}
                            {!ev.isPersonal && <span className="text-gray-500">by {ev.instructorName}</span>}
                          </div>
                          {ev.aiTips?.[0] && <p className="text-xs text-purple-300/60 mt-1.5">{ev.aiTips[0]}</p>}
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button onClick={() => handleToggleComplete(ev)}
                            className={`p-1.5 rounded-lg transition-colors ${ev.completed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-background-700 text-gray-500 hover:text-emerald-400'}`}>
                            <CheckCircle2 size={13} />
                          </button>
                          {ev.isPersonal && ev.studentId === user?.uid && (
                            <>
                              <button onClick={() => { setEditingEvent(ev); setShowModal(true); }} className="p-1.5 bg-background-700 hover:bg-background-600 text-gray-400 hover:text-white rounded-lg transition-colors"><Edit size={12} /></button>
                              <button onClick={() => handleDelete(ev.id)} className="p-1.5 bg-background-700 hover:bg-red-500/20 text-gray-400 hover:text-red-400 rounded-lg transition-colors"><Trash2 size={12} /></button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    );
                  })}
                </div>
              )}
            </Card>
            </div>

            {/* Enrolled Courses */}
            {enrolledCourses.length > 0 && (
              <Card>
                <button onClick={() => setShowCoursesPanel(p => !p)} className="flex items-center justify-between w-full mb-3">
                  <h2 className="text-base font-semibold text-white flex items-center gap-2">
                    <GraduationCap size={14} className="text-primary-400" /> My Courses
                    <span className="text-xs text-gray-500 font-normal">({enrolledCourses.length})</span>
                  </h2>
                  {showCoursesPanel ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                </button>
                {showCoursesPanel && (
                  <>
                    <p className="text-xs text-gray-500 mb-3">Click "Plan" to create a study goal for any enrolled course.</p>
                    <div className="space-y-2">
                      {enrolledCourses.map(course => (
                        <div key={course.courseId} className="bg-background-800 rounded-xl p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-white truncate">{course.title}</p>
                              <p className="text-xs text-gray-400 mt-0.5">
                                {course.subjects.slice(0, 2).join(', ')}
                                {course.totalLessons > 0 && ` · ${course.totalLessons} lessons`}
                                {` · ${course.progress}% done`}
                              </p>
                              {course.totalLessons > 0 && (
                                <div className="h-1 bg-background-700 rounded-full mt-2 overflow-hidden">
                                  <div className="h-full bg-gradient-to-r from-primary-600 to-purple-600 rounded-full" style={{ width: `${course.progress}%` }} />
                                </div>
                              )}
                            </div>
                            <button
                              onClick={() => handleAddGoalFromCourse(course)}
                              disabled={goals.some(g => g.subject === course.title)}
                              className="text-xs bg-primary-600/20 hover:bg-primary-600 border border-primary-500/30 text-primary-300 hover:text-white px-2.5 py-1 rounded-lg transition-all whitespace-nowrap flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              {goals.some(g => g.subject === course.title) ? 'Planned ✓' : 'Plan'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </Card>
            )}

            {/* Study Goals */}
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-white flex items-center gap-2">
                  <Target size={14} className="text-primary-400" />Study Goals
                </h2>
                <div className="flex items-center gap-2">
                  {aiReady && goals.length > 0 && goals.some(g => getGoalAIProgress(g).totalSessions > 0) && (
                    <button
                      onClick={handleOpenReschedule}
                      className="flex items-center gap-1 text-xs bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 px-2.5 py-1.5 rounded-lg transition-all"
                    >
                      <RefreshCw size={11} />Replan
                    </button>
                  )}
                  <button onClick={() => setShowGoalForm(p => !p)}
                    className="flex items-center gap-1 text-xs bg-primary-600 hover:bg-primary-700 text-white px-3 py-1.5 rounded-lg transition-colors">
                    <Plus size={12} />Goal
                  </button>
                </div>
              </div>

              {showGoalForm && (
                <div className="mb-4 p-4 bg-background-700 rounded-xl space-y-3 border border-background-600">
                  <div className="grid grid-cols-2 gap-3">
                    <input value={newGoal.subject} onChange={e => setNewGoal(p => ({ ...p, subject: e.target.value }))} placeholder="Subject / Course" className={inputCls} />
                    <input type="date" value={newGoal.targetDate} onChange={e => setNewGoal(p => ({ ...p, targetDate: e.target.value }))} className={inputCls} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">Hours needed</label>
                      <input type="number" min={1} value={newGoal.hoursNeeded} onChange={e => setNewGoal(p => ({ ...p, hoursNeeded: Number(e.target.value) }))} className={inputCls} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">Difficulty</label>
                      <select value={newGoal.difficulty} onChange={e => setNewGoal(p => ({ ...p, difficulty: e.target.value as any }))} className={inputCls}>
                        <option value="easy">Easy</option>
                        <option value="medium">Medium</option>
                        <option value="hard">Hard</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleAddGoal} disabled={savingGoal || !newGoal.subject || !newGoal.targetDate}
                      className="flex-1 bg-primary-600 hover:bg-primary-700 text-white py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1">
                      {savingGoal ? <Loader size={13} className="animate-spin" /> : null}
                      Save Goal
                    </button>
                    <button onClick={() => setShowGoalForm(false)} className="px-4 bg-background-600 text-gray-400 py-2 rounded-xl text-sm transition-colors">Cancel</button>
                  </div>
                </div>
              )}

              {goals.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">Add goals to unlock AI Schedule generation!</p>
              ) : (
                <div className="space-y-3">
                  {goals.map(g => {
                    const d    = differenceInDays(g.targetDate, new Date());
                    const prog = getGoalAIProgress(g);
                    return (
                      <div key={g.id} className="bg-background-800 rounded-xl p-4">
                        {/* ── Inline edit form ── */}
                        {editingGoal?.id === g.id ? (
                          <div className="space-y-3">
                            <p className="text-xs font-semibold text-primary-400 mb-1">Edit Goal</p>
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                value={editGoalData.subject}
                                onChange={e => setEditGoalData(p => ({ ...p, subject: e.target.value }))}
                                placeholder="Subject / Course"
                                className={inputCls}
                              />
                              <input
                                type="date"
                                value={editGoalData.targetDate}
                                onChange={e => setEditGoalData(p => ({ ...p, targetDate: e.target.value }))}
                                className={inputCls}
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-xs text-gray-400 mb-1 block">Hours needed</label>
                                <input
                                  type="number" min={1}
                                  value={editGoalData.hoursNeeded}
                                  onChange={e => setEditGoalData(p => ({ ...p, hoursNeeded: Number(e.target.value) }))}
                                  className={inputCls}
                                />
                              </div>
                              <div>
                                <label className="text-xs text-gray-400 mb-1 block">Difficulty</label>
                                <select
                                  value={editGoalData.difficulty}
                                  onChange={e => setEditGoalData(p => ({ ...p, difficulty: e.target.value as any }))}
                                  className={inputCls}
                                >
                                  <option value="easy">Easy</option>
                                  <option value="medium">Medium</option>
                                  <option value="hard">Hard</option>
                                </select>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={handleSaveEditGoal}
                                disabled={savingEditGoal || !editGoalData.subject || !editGoalData.targetDate}
                                className="flex-1 bg-primary-600 hover:bg-primary-700 text-white py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                              >
                                {savingEditGoal ? <Loader size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                                Save
                              </button>
                              <button onClick={() => setEditingGoal(null)} className="px-4 bg-background-600 text-gray-400 py-2 rounded-xl text-sm transition-colors">
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                        {/* Goal header */}
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-white">{g.subject}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded ${g.difficulty === 'hard' ? 'bg-red-500/15 text-red-400' : g.difficulty === 'medium' ? 'bg-amber-500/15 text-amber-400' : 'bg-emerald-500/15 text-emerald-400'}`}>{g.difficulty}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className={`text-xs ${d <= 3 ? 'text-red-400' : d <= 7 ? 'text-amber-400' : 'text-gray-400'}`}>{d > 0 ? `${d}d left` : d === 0 ? 'Due today' : 'Past due'}</span>
                            <button onClick={() => handleOpenEditGoal(g)} className="p-1 text-gray-500 hover:text-primary-400 transition-colors" title="Edit goal"><Edit size={11} /></button>
                            <button onClick={() => handleDeleteGoal(g.id)} className="p-1 text-gray-500 hover:text-red-400 transition-colors" title="Delete goal"><Trash2 size={11} /></button>
                          </div>
                        </div>

                        {/* Manual progress bar */}
                        <div className="flex items-center gap-2 mb-2">
                          <div className="flex-1 bg-background-700 rounded-full h-1.5 overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-primary-600 to-purple-600 rounded-full transition-all" style={{ width: `${g.currentProgress}%` }} />
                          </div>
                          <span className="text-xs text-gray-400 w-8 text-right">{g.currentProgress}%</span>
                        </div>
                        <div className="flex gap-1 mb-3">
                          {[25, 50, 75, 100].map(p => (
                            <button key={p} onClick={() => handleUpdateGoalProgress(g.id, p)}
                              className={`flex-1 py-1 rounded text-xs transition-colors ${g.currentProgress >= p ? 'bg-primary-600 text-white' : 'bg-background-700 text-gray-500 hover:text-white'}`}>
                              {p}%
                            </button>
                          ))}
                        </div>

                        {/* AI Plan Progress Tracker — compact, no alarm state */}
                        {prog.totalSessions > 0 && (
                          <div className="rounded-lg p-2.5 bg-background-700 border border-background-600 mt-1">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-xs text-gray-400">
                                {prog.completedSessions}/{prog.totalSessions} sessions
                                {prog.behind ? <span className="text-amber-400 ml-1">· {prog.missedSessions} missed</span> : ''}
                              </span>
                              <span className="text-xs text-gray-500">{prog.sessionRate}%</span>
                            </div>
                            <div className="h-1 bg-background-600 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${prog.behind ? 'bg-amber-500' : prog.sessionRate === 100 ? 'bg-emerald-500' : 'bg-primary-500'}`}
                                style={{ width: `${Math.max(prog.sessionRate, 2)}%` }}
                              />
                            </div>
                          </div>
                        )}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            {/* Custom Activities */}
            <Card>
              <button onClick={() => setShowActivitiesPanel(p => !p)} className="flex items-center justify-between w-full mb-1">
                <h2 className="text-base font-semibold text-white flex items-center gap-2">
                  <Zap size={14} className="text-primary-400" /> Daily Activities
                  <span className="text-xs text-gray-500 font-normal">({customActivities.length})</span>
                </h2>
                {showActivitiesPanel ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
              </button>

              {showActivitiesPanel && (
                <div className="mt-3 space-y-3">
                  <p className="text-xs text-gray-500">Add your regular commitments so AI can plan around them — sports, jobs, family time, etc.</p>

                  {!showActivityForm && (
                    <button onClick={() => setShowActivityForm(true)}
                      className="flex items-center gap-1 text-xs bg-primary-600 hover:bg-primary-700 text-white px-3 py-1.5 rounded-lg transition-colors">
                      <Plus size={12} /> Add Activity
                    </button>
                  )}

                  {showActivityForm && (
                    <div className="p-4 bg-background-700 rounded-xl space-y-3 border border-background-600">
                      <div className="grid grid-cols-2 gap-3">
                        <input value={newActivity.name} onChange={e => setNewActivity(p => ({ ...p, name: e.target.value }))} placeholder="Activity name" className={inputCls} />
                        <select value={newActivity.category} onChange={e => setNewActivity(p => ({ ...p, category: e.target.value as any }))} className={inputCls}>
                          {(['sport', 'job', 'hobby', 'family', 'religious', 'social', 'transport', 'other'] as const).map(c => (
                            <option key={c} value={c}>{CATEGORY_EMOJI[c]} {c.charAt(0).toUpperCase() + c.slice(1)}</option>
                          ))}
                        </select>
                      </div>

                      {/* Fix #2: schedule type toggle */}
                      <div>
                        <label className="text-xs text-gray-400 mb-2 block">Schedule Type</label>
                        <div className="flex gap-2">
                          {(['recurring', 'specific_dates'] as const).map(t => (
                            <button key={t} type="button"
                              onClick={() => setNewActivity(p => ({ ...p, scheduleType: t }))}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${newActivity.scheduleType === t ? 'bg-primary-600 text-white' : 'bg-background-600 text-gray-400 hover:text-white'}`}>
                              {t === 'recurring' ? 'Recurring (weekly)' : 'Specific Dates'}
                            </button>
                          ))}
                        </div>
                      </div>

                      {newActivity.scheduleType === 'recurring' ? (
                        <div>
                          <label className="text-xs text-gray-400 mb-2 block">Days of week</label>
                          <div className="flex gap-1.5 flex-wrap">
                            {DAYS.map((day, i) => (
                              <button key={i} type="button" onClick={() => toggleActivityDay(i)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${newActivity.daysOfWeek.includes(i) ? 'bg-primary-600 text-white' : 'bg-background-600 text-gray-400 hover:text-white'}`}>
                                {day}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div>
                          <label className="text-xs text-gray-400 mb-2 block">Select dates <span className="text-gray-500">(expired dates auto-removed)</span></label>
                          <input
                            type="date"
                            min={new Date().toISOString().slice(0, 10)}
                            onChange={e => {
                              const val = e.target.value;
                              if (val && !newActivity.specificDates.includes(val)) {
                                setNewActivity(p => ({ ...p, specificDates: [...p.specificDates, val].sort() }));
                              }
                              e.target.value = '';
                            }}
                            className={inputCls}
                          />
                          {newActivity.specificDates.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {newActivity.specificDates.map(d => (
                                <span key={d} className="flex items-center gap-1 bg-primary-600/20 text-primary-300 border border-primary-500/30 text-xs px-2 py-1 rounded-lg">
                                  {d}
                                  <button type="button" onClick={() => setNewActivity(p => ({ ...p, specificDates: p.specificDates.filter(x => x !== d) }))} className="text-gray-400 hover:text-red-400">
                                    <X size={10} />
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-gray-400 mb-1 block">Start time</label>
                          <input type="time" value={newActivity.startTime} onChange={e => setNewActivity(p => ({ ...p, startTime: e.target.value }))} className={inputCls} />
                        </div>
                        <div>
                          <label className="text-xs text-gray-400 mb-1 block">End time</label>
                          <input type="time" value={newActivity.endTime} onChange={e => setNewActivity(p => ({ ...p, endTime: e.target.value }))} className={inputCls} />
                        </div>
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={newActivity.isFlexible} onChange={e => setNewActivity(p => ({ ...p, isFlexible: e.target.checked }))} className="h-4 w-4 rounded text-primary-600" />
                        <span className="text-xs text-gray-300">Flexible — AI can schedule study over this if urgent</span>
                      </label>
                      <div className="flex gap-2">
                        <button onClick={handleSaveActivity}
                          disabled={savingActivity || !newActivity.name || (newActivity.scheduleType === 'recurring' ? !newActivity.daysOfWeek.length : !newActivity.specificDates.length)}
                          className="flex-1 bg-primary-600 hover:bg-primary-700 text-white py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1">
                          {savingActivity ? <Loader size={13} className="animate-spin" /> : null}
                          Save
                        </button>
                        <button onClick={() => setShowActivityForm(false)} className="px-4 bg-background-600 text-gray-400 py-2 rounded-xl text-sm transition-colors">Cancel</button>
                      </div>
                    </div>
                  )}

                  {customActivities.length > 0 && (
                    <div className="space-y-2">
                      {customActivities.map(a => (
                        <div key={a.id} className="bg-background-800 rounded-xl p-3">
                          {editingActivity?.id === a.id ? (
                            /* ── Inline activity edit form ── */
                            <div className="space-y-3">
                              <p className="text-xs font-semibold text-primary-400">Edit Activity</p>
                              <div className="grid grid-cols-2 gap-2">
                                <input
                                  value={editActivityData.name}
                                  onChange={e => setEditActivityData(p => ({ ...p, name: e.target.value }))}
                                  placeholder="Activity name"
                                  className={inputCls}
                                />
                                <select
                                  value={editActivityData.category}
                                  onChange={e => setEditActivityData(p => ({ ...p, category: e.target.value as any }))}
                                  className={inputCls}
                                >
                                  {(['sport', 'job', 'hobby', 'family', 'religious', 'social', 'transport', 'other'] as const).map(c => (
                                    <option key={c} value={c}>{CATEGORY_EMOJI[c]} {c.charAt(0).toUpperCase() + c.slice(1)}</option>
                                  ))}
                                </select>
                              </div>
                              {/* Schedule type */}
                              <div className="flex gap-2">
                                {(['recurring', 'specific_dates'] as const).map(t => (
                                  <button key={t} type="button"
                                    onClick={() => setEditActivityData(p => ({ ...p, scheduleType: t }))}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${editActivityData.scheduleType === t ? 'bg-primary-600 text-white' : 'bg-background-600 text-gray-400 hover:text-white'}`}>
                                    {t === 'recurring' ? 'Recurring' : 'Specific Dates'}
                                  </button>
                                ))}
                              </div>
                              {editActivityData.scheduleType === 'recurring' ? (
                                <div className="flex gap-1.5 flex-wrap">
                                  {DAYS.map((day, i) => (
                                    <button key={i} type="button" onClick={() => toggleEditActivityDay(i)}
                                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${editActivityData.daysOfWeek.includes(i) ? 'bg-primary-600 text-white' : 'bg-background-600 text-gray-400 hover:text-white'}`}>
                                      {day}
                                    </button>
                                  ))}
                                </div>
                              ) : (
                                <div>
                                  <input
                                    type="date"
                                    min={new Date().toISOString().slice(0, 10)}
                                    onChange={e => {
                                      const val = e.target.value;
                                      if (val && !editActivityData.specificDates.includes(val)) {
                                        setEditActivityData(p => ({ ...p, specificDates: [...p.specificDates, val].sort() }));
                                      }
                                      e.target.value = '';
                                    }}
                                    className={inputCls}
                                  />
                                  {editActivityData.specificDates.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 mt-2">
                                      {editActivityData.specificDates.map(d => (
                                        <span key={d} className="flex items-center gap-1 bg-primary-600/20 text-primary-300 border border-primary-500/30 text-xs px-2 py-1 rounded-lg">
                                          {d}
                                          <button type="button" onClick={() => setEditActivityData(p => ({ ...p, specificDates: p.specificDates.filter(x => x !== d) }))} className="text-gray-400 hover:text-red-400"><X size={10} /></button>
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="text-xs text-gray-400 mb-1 block">Start time</label>
                                  <input type="time" value={editActivityData.startTime} onChange={e => setEditActivityData(p => ({ ...p, startTime: e.target.value }))} className={inputCls} />
                                </div>
                                <div>
                                  <label className="text-xs text-gray-400 mb-1 block">End time</label>
                                  <input type="time" value={editActivityData.endTime} onChange={e => setEditActivityData(p => ({ ...p, endTime: e.target.value }))} className={inputCls} />
                                </div>
                              </div>
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={editActivityData.isFlexible} onChange={e => setEditActivityData(p => ({ ...p, isFlexible: e.target.checked }))} className="h-4 w-4 rounded text-primary-600" />
                                <span className="text-xs text-gray-300">Flexible — AI can schedule study over this if urgent</span>
                              </label>
                              <div className="flex gap-2">
                                <button
                                  onClick={handleSaveEditActivity}
                                  disabled={savingEditActivity || !editActivityData.name || (editActivityData.scheduleType === 'recurring' ? !editActivityData.daysOfWeek.length : !editActivityData.specificDates.length)}
                                  className="flex-1 bg-primary-600 hover:bg-primary-700 text-white py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                                >
                                  {savingEditActivity ? <Loader size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                                  Save
                                </button>
                                <button onClick={() => setEditingActivity(null)} className="px-4 bg-background-600 text-gray-400 py-2 rounded-xl text-sm transition-colors">Cancel</button>
                              </div>
                            </div>
                          ) : (
                            /* ── Normal view ── */
                            <div className="flex items-center justify-between">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-base">{CATEGORY_EMOJI[a.category]}</span>
                                  <span className="text-sm font-medium text-white truncate">{a.name}</span>
                                  {a.isFlexible && <span className="text-xs px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">flexible</span>}
                                </div>
                                <p className="text-xs text-gray-400 mt-0.5 ml-6">
                                  {a.scheduleType === 'specific_dates' && a.specificDates?.length
                                    ? a.specificDates.join(', ')
                                    : a.daysOfWeek.map(d => DAYS[d]).join(', ')
                                  } · {a.startTime}–{a.endTime}
                                </p>
                              </div>
                              <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                                <button onClick={() => handleOpenEditActivity(a)} className="p-1.5 text-gray-500 hover:text-primary-400 transition-colors" title="Edit activity">
                                  <Edit size={12} />
                                </button>
                                <button onClick={() => handleDeleteActivity(a.id)} className="p-1.5 text-gray-500 hover:text-red-400 transition-colors" title="Delete activity">
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {/* ════════════════════════════════ UPCOMING VIEW ═══════════════════════════ */}
      {view === 'list' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card>
              <h2 className="text-base font-semibold text-white mb-4">Upcoming Events ({upcomingEvents.length})</h2>
              {upcomingEvents.length === 0 ? (
                <div className="py-10 text-center text-gray-400">
                  <CalendarIcon size={36} className="mx-auto mb-3 text-gray-600" />
                  <p className="text-sm">No upcoming events</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {upcomingEvents.map(ev => {
                    const d = differenceInDays(ev.date, new Date());
                    return (
                      <div key={ev.id} className={`bg-background-800 rounded-xl p-4 border-l-4 ${TYPE_COLOR[ev.eventType] || 'border-gray-500'}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center flex-wrap gap-2 mb-1">
                              <span>{TYPE_EMOJI[ev.eventType]}</span>
                              <span className="text-sm font-semibold text-white">{ev.title}</span>
                              {ev.isAIGenerated && <span className="text-xs bg-purple-500/15 text-purple-300 px-1.5 py-0.5 rounded-full flex items-center gap-1"><Sparkles size={9} />AI</span>}
                            </div>
                            <div className="flex flex-wrap gap-3 text-xs text-gray-400">
                              <span>{format(ev.date, 'EEE, MMM d')}</span>
                              {ev.startTime && <span><Clock size={11} className="inline mr-0.5" />{ev.startTime}–{ev.endTime}</span>}
                              {ev.course && <span>{ev.course}</span>}
                              <span className={`font-semibold ${d <= 1 ? 'text-red-400' : d <= 3 ? 'text-amber-400' : 'text-gray-400'}`}>
                                {d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : `${d}d`}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              onClick={() => handleToggleComplete(ev)}
                              className={`p-1.5 rounded-lg transition-colors ${ev.completed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-background-700 text-gray-400 hover:text-emerald-400'}`}
                              title="Mark complete"
                            >
                              <CheckCircle2 size={13} />
                            </button>
                            {ev.isPersonal && ev.studentId === user?.uid && (
                              <>
                                <button
                                  onClick={() => { setEditingEvent(ev); setShowModal(true); }}
                                  className="p-1.5 bg-background-700 hover:bg-background-600 text-gray-400 hover:text-white rounded-lg transition-colors"
                                  title="Edit event"
                                >
                                  <Edit size={12} />
                                </button>
                                <button
                                  onClick={() => handleDelete(ev.id)}
                                  className="p-1.5 bg-background-700 hover:bg-red-500/20 text-gray-400 hover:text-red-400 rounded-lg transition-colors"
                                  title="Delete event"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>
          <div className="space-y-4">
            <Card>
              <h3 className="text-sm font-semibold text-white mb-3">Goals Progress</h3>
              {goals.length === 0 ? <p className="text-xs text-gray-500">No goals added</p> : goals.map(g => (
                <div key={g.id} className="mb-3 last:mb-0">
                  <div className="flex justify-between items-center text-xs mb-1">
                    <span className="text-gray-300 font-medium truncate flex-1">{g.subject}</span>
                    <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                      <span className="text-gray-500 mr-1">{g.currentProgress}%</span>
                      <button onClick={() => handleOpenEditGoal(g)} className="p-0.5 text-gray-600 hover:text-primary-400 transition-colors" title="Edit goal"><Edit size={10} /></button>
                      <button onClick={() => handleDeleteGoal(g.id)} className="p-0.5 text-gray-600 hover:text-red-400 transition-colors" title="Delete goal"><Trash2 size={10} /></button>
                    </div>
                  </div>
                  <div className="h-1.5 bg-background-700 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-primary-600 to-purple-600 rounded-full" style={{ width: `${g.currentProgress}%` }} /></div>
                </div>
              ))}
            </Card>
            <Card>
              <h3 className="text-sm font-semibold text-white mb-3">By Event Type</h3>
              {['assignment', 'exam', 'class', 'study_session', 'deadline', 'personal'].map(t => {
                const count = events.filter(e => e.eventType === t).length;
                if (!count) return null;
                return <div key={t} className="flex items-center justify-between py-1.5 border-b border-background-700 last:border-0"><span className="text-xs text-gray-400 capitalize flex items-center gap-1.5">{TYPE_EMOJI[t]}{t.replace('_', ' ')}</span><span className="text-xs font-semibold text-white">{count}</span></div>;
              })}
            </Card>
          </div>
        </div>
      )}

      {/* ════════════════════════════════ ANALYTICS VIEW ══════════════════════════ */}
      {view === 'analytics' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[
            { label: 'Total Events',  value: events.length,         icon: CalendarIcon, c: 'text-blue-400',    bg: 'bg-blue-500/10' },
            { label: 'Completed',     value: completedCount,        icon: CheckCircle2, c: 'text-emerald-400', bg: 'bg-emerald-500/10' },
            { label: 'Upcoming',      value: upcomingEvents.length, icon: Clock,        c: 'text-amber-400',   bg: 'bg-amber-500/10' },
            { label: 'Active Goals',  value: goals.length,          icon: Target,       c: 'text-purple-400',  bg: 'bg-purple-500/10' },
            { label: 'Study Streak',  value: `${streak.current}d`,  icon: Flame,        c: 'text-orange-400',  bg: 'bg-orange-500/10' },
            { label: 'Pomodoros',     value: streak.totalSessions,  icon: Timer,        c: 'text-pink-400',    bg: 'bg-pink-500/10' },
          ].map(s => (
            <div key={s.label} className="bg-background-800 border border-background-700 rounded-2xl p-5">
              <div className={`w-10 h-10 ${s.bg} rounded-xl flex items-center justify-center mb-3`}><s.icon size={17} className={s.c} /></div>
              <p className="text-2xl font-bold text-white">{s.value}</p>
              <p className="text-sm text-gray-400 mt-0.5">{s.label}</p>
            </div>
          ))}
          <div className="bg-background-800 border border-background-700 rounded-2xl p-5 sm:col-span-2">
            <h3 className="text-sm font-semibold text-white mb-4">Overall Completion Rate</h3>
            <div className="flex items-center gap-4 mb-2">
              <div className="flex-1 bg-background-700 rounded-full h-3 overflow-hidden"><div className="h-full bg-gradient-to-r from-primary-600 to-emerald-500 rounded-full" style={{ width: `${completionRate}%` }} /></div>
              <span className="text-2xl font-bold text-white w-14 text-right">{completionRate}%</span>
            </div>
            <p className="text-xs text-gray-400">{completedCount} of {events.length} events completed</p>
          </div>
          <div className="bg-background-800 border border-background-700 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2"><Award size={14} className="text-amber-400" /> Achievements</h3>
            <div className="space-y-2">
              {[
                { label: 'Study Streak',  earned: streak.current >= 3,                 icon: '🔥', desc: '3+ day streak' },
                { label: 'Goal Setter',   earned: goals.length >= 1,                   icon: '🎯', desc: 'Added a goal' },
                { label: 'Pomodoro Pro',  earned: streak.totalSessions >= 5,           icon: '⏱️', desc: '5+ sessions' },
                { label: 'Completionist', earned: completionRate >= 75,                icon: '✅', desc: '75% completion' },
                { label: 'AI Adopter',    earned: events.some(e => e.isAIGenerated),   icon: '🤖', desc: 'Used AI schedule' },
                { label: 'Course Planner',earned: enrolledCourses.length > 0,          icon: '📚', desc: 'Enrolled in course' },
              ].map(a => (
                <div key={a.label} className={`flex items-center gap-3 p-2.5 rounded-xl ${a.earned ? 'bg-primary-500/10' : 'opacity-40'}`}>
                  <span className="text-lg">{a.icon}</span>
                  <div><p className="text-xs font-semibold text-white">{a.label}</p><p className="text-xs text-gray-500">{a.desc}</p></div>
                  {a.earned && <CheckCircle2 size={13} className="text-emerald-400 ml-auto" />}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════ AI CHAT VIEW ════════════════════════════ */}
      {view === 'chat' && (
        <Card>
          <div className="flex items-center justify-between mb-4 pb-4 border-b border-background-700">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-purple-600 to-primary-600 rounded-xl flex items-center justify-center">
                <Brain size={15} className="text-white" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-white">Sage — AI Study Companion</h2>
                <p className="text-xs text-gray-400">Knows your schedule</p>
              </div>
            </div>
            {chatMessages.length > 0 && (
              <button onClick={handleClearChat} className="p-1.5 text-gray-500 hover:text-red-400 transition-colors" title="Clear chat history">
                <Trash size={14} />
              </button>
            )}
          </div>

          {/* Pending calendar events banner */}
          {pendingCalendarEvents.length > 0 && (
            <div className="flex items-center gap-3 bg-purple-500/10 border border-purple-500/30 rounded-xl p-3 mb-4">
              <Sparkles size={15} className="text-purple-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-purple-200">
                  Sage created {pendingCalendarEvents.length} study session{pendingCalendarEvents.length > 1 ? 's' : ''}
                </p>
                <p className="text-xs text-purple-300/70">Add them to your calendar?</p>
              </div>
              <button onClick={handleAddChatEventsToCalendar} disabled={addingChatEvents}
                className="text-xs bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap disabled:opacity-50 flex items-center gap-1">
                {addingChatEvents ? <Loader size={11} className="animate-spin" /> : null}
                Add to Calendar
              </button>
              <button onClick={() => setPendingCalendarEvents([])} className="text-gray-500 hover:text-gray-300 flex-shrink-0">
                <X size={13} />
              </button>
            </div>
          )}

          {/* Messages */}
          <div className="h-80 overflow-y-auto space-y-3 mb-4 pr-1">
            {!chatHistoryLoaded && (
              <div className="flex justify-center py-4"><Loader size={16} className="animate-spin text-primary-400" /></div>
            )}
            {chatHistoryLoaded && chatMessages.length === 0 && (
              <div className="space-y-2">
                <p className="text-sm text-gray-400 text-center py-4">
                  Hi {user?.name || user?.displayName || 'there'}! I'm Sage, your study companion. Ask me anything!
                </p>
                {[
                  `Create a study plan for my upcoming exams`,
                  `How should I manage my time this week?`,
                  `What are the best memorization techniques?`,
                  `Help me stay motivated when I'm tired`,
                  `Schedule ${enrolledCourses[0]?.title || 'my course'} study sessions`,
                ].slice(0, 4).map(p => (
                  <button key={p} onClick={() => setChatInput(p)}
                    className="w-full text-left text-xs bg-background-700 hover:bg-background-600 text-gray-300 px-3 py-2.5 rounded-xl transition-colors border border-background-600">
                    {p}
                  </button>
                ))}
              </div>
            )}
            {chatMessages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[82%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${m.role === 'user' ? 'bg-primary-600 text-white rounded-br-sm' : 'bg-background-700 text-gray-200 rounded-bl-sm'}`}>
                  {m.content}
                  {m.calendarEvents && m.calendarEvents.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-white/10 text-xs flex items-center gap-1 opacity-70">
                      <CalendarIcon size={10} /> {m.calendarEvents.length} session{m.calendarEvents.length > 1 ? 's' : ''} created
                    </div>
                  )}
                </div>
              </div>
            ))}
            {chatLoading && (
              <div className="flex justify-start">
                <div className="bg-background-700 px-4 py-2.5 rounded-2xl rounded-bl-sm flex items-center gap-2">
                  <Loader size={11} className="animate-spin text-primary-400" />
                  <span className="text-xs text-gray-400">Sage is thinking…</span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div className="flex gap-2">
            <input
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendChat(); } }}
              placeholder="Ask Sage anything about your studies…"
              className={inputCls + ' flex-1'}
            />
            <button onClick={handleSendChat} disabled={!chatInput.trim() || chatLoading || !aiReady}
              className="bg-primary-600 hover:bg-primary-700 text-white p-2.5 rounded-xl transition-colors disabled:opacity-50 flex-shrink-0">
              <Send size={15} />
            </button>
          </div>
          {!aiReady && <p className="text-xs text-amber-400 mt-2">⚠️ AI not configured — Admin → AI Model Settings</p>}
        </Card>
      )}

      {/* ─── AI Schedule Modal ──────────────────────────────────────────────────── */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-background-900 border border-background-700 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-background-700">
              <div className="flex items-center gap-2">
                <Brain size={17} className="text-purple-400" />
                <h3 className="text-base font-bold text-white">AI Generated Study Schedule</h3>
                <span className="text-xs text-gray-500">{suggestions.length} sessions · based on {freeHoursPerDay}h/day</span>
              </div>
              <button onClick={() => setShowScheduleModal(false)} className="text-gray-400 hover:text-white"><X size={17} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {suggestions.length === 0 ? (
                <p className="text-center text-gray-400 py-8">No sessions generated. Try adding more goals or adjusting your free hours.</p>
              ) : suggestions.map((s, i) => (
                <div key={i} className={`bg-background-800 rounded-xl p-4 border-l-4 ${s.priority === 'high' ? 'border-red-500' : s.priority === 'medium' ? 'border-amber-500' : 'border-emerald-500'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-white">{s.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {format(s.date, 'EEE, MMM d')} · {s.startTime}–{s.endTime} · {s.subject}
                        <span className="ml-2 capitalize text-gray-500">{s.sessionType}</span>
                      </p>
                      <p className="text-xs text-purple-300/70 mt-1">{s.reason}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${s.priority === 'high' ? 'bg-red-500/15 text-red-400' : s.priority === 'medium' ? 'bg-amber-500/15 text-amber-400' : 'bg-emerald-500/15 text-emerald-400'}`}>{s.priority}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-6 py-4 border-t border-background-700 flex gap-3 justify-between items-center">
              <p className="text-xs text-gray-500">These sessions use spaced repetition and work around your activities.</p>
              <div className="flex gap-3">
                <button onClick={() => setShowScheduleModal(false)} className="px-5 py-2.5 bg-background-700 hover:bg-background-600 text-gray-300 rounded-xl text-sm font-medium transition-colors">
                  Cancel
                </button>
                <button onClick={handleAcceptSchedule} disabled={addingSchedule || suggestions.length === 0}
                  className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-primary-600 hover:from-purple-700 hover:to-primary-700 text-white rounded-xl text-sm font-semibold transition-all shadow-lg disabled:opacity-50 flex items-center gap-2">
                  {addingSchedule ? <Loader size={14} className="animate-spin" /> : null}
                  Add All to Planner
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Event Modal ─────────────────────────────────────────────────────────── */}
      {showModal && (
        <StudyPlanEventModal
          selectedDate={selectedDate}
          currentUser={user}
          allStudents={[]}
          allCourses={enrolledCourses.map(c => ({ id: c.courseId, title: c.title }))}
          event={editingEvent}
          onClose={() => { setShowModal(false); setEditingEvent(null); }}
          onSave={handleSaveEvent}
          isPersonalEvent={true}
        />
      )}

      {/* ─── Goal Edit Modal ─────────────────────────────────────────────────────── */}
      {editingGoal && view !== 'calendar' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-background-900 border border-background-700 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-background-700">
              <div className="flex items-center gap-2">
                <Target size={15} className="text-primary-400" />
                <h3 className="text-base font-bold text-white">Edit Goal</h3>
              </div>
              <button onClick={() => setEditingGoal(null)} className="text-gray-400 hover:text-white"><X size={17} /></button>
            </div>
            <div className="p-6 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input
                  value={editGoalData.subject}
                  onChange={e => setEditGoalData(p => ({ ...p, subject: e.target.value }))}
                  placeholder="Subject / Course"
                  className={inputCls}
                />
                <input
                  type="date"
                  value={editGoalData.targetDate}
                  onChange={e => setEditGoalData(p => ({ ...p, targetDate: e.target.value }))}
                  className={inputCls}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Hours needed</label>
                  <input type="number" min={1} value={editGoalData.hoursNeeded} onChange={e => setEditGoalData(p => ({ ...p, hoursNeeded: Number(e.target.value) }))} className={inputCls} />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Difficulty</label>
                  <select value={editGoalData.difficulty} onChange={e => setEditGoalData(p => ({ ...p, difficulty: e.target.value as any }))} className={inputCls}>
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleSaveEditGoal}
                  disabled={savingEditGoal || !editGoalData.subject || !editGoalData.targetDate}
                  className="flex-1 bg-primary-600 hover:bg-primary-700 text-white py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                >
                  {savingEditGoal ? <Loader size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                  Save Changes
                </button>
                <button onClick={() => setEditingGoal(null)} className="px-5 bg-background-700 text-gray-400 py-2.5 rounded-xl text-sm transition-colors">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Reschedule Modal ────────────────────────────────────────────────────── */}
      {showRescheduleModal && (() => {
        const allBehind = goals.some(g => getGoalAIProgress(g).behind);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="bg-background-900 border border-background-700 rounded-2xl w-full max-w-xl max-h-[92vh] flex flex-col shadow-2xl">

              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-background-700">
                <div className="flex items-center gap-2">
                  <RefreshCw size={15} className="text-amber-400" />
                  <div>
                    <h3 className="text-sm font-bold text-white">Replan Schedule</h3>
                    <p className="text-xs text-gray-500">{goals.length} goal{goals.length !== 1 ? 's' : ''} · replanning from today</p>
                  </div>
                </div>
                <button onClick={() => { setShowRescheduleModal(false); setReschedulePreview([]); }} className="text-gray-400 hover:text-white p-1"><X size={16} /></button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-4">

                {/* Goals overview — compact */}
                <div className="space-y-2">
                  {goals.map(g => {
                    const prog = getGoalAIProgress(g);
                    const dl   = Math.max(0, differenceInDays(g.targetDate, new Date()));
                    return (
                      <div key={g.id} className="flex items-center gap-3 bg-background-800 rounded-xl px-3 py-2.5">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-white truncate">{g.subject}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${g.difficulty === 'hard' ? 'bg-red-500/15 text-red-400' : g.difficulty === 'medium' ? 'bg-amber-500/15 text-amber-400' : 'bg-emerald-500/15 text-emerald-400'}`}>{g.difficulty}</span>
                          </div>
                          <p className={`text-xs mt-0.5 ${dl <= 2 ? 'text-red-400' : dl <= 5 ? 'text-amber-400' : 'text-gray-500'}`}>
                            {dl === 0 ? 'Due today' : `${dl}d left`}
                            {prog.totalSessions > 0 && (
                              <span className="text-gray-500"> · {prog.completedSessions}/{prog.totalSessions} done
                                {prog.behind ? <span className="text-amber-400"> · {prog.missedSessions} missed</span> : ''}
                              </span>
                            )}
                          </p>
                        </div>
                        {prog.totalSessions === 0 && (
                          <span className="text-xs text-gray-600">no plan yet</span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Free time input */}
                <div className="bg-background-800 border border-background-700 rounded-xl p-4 space-y-3">
                  <p className="text-xs font-semibold text-gray-300">When are you free each day?</p>
                  {/* Toggle */}
                  <div className="flex gap-1.5 p-1 bg-background-700 rounded-lg w-fit">
                    {(['hours', 'range'] as const).map(m => (
                      <button
                        key={m}
                        onClick={() => setFreeTimeMode(m)}
                        className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${freeTimeMode === m ? 'bg-primary-600 text-white' : 'text-gray-400 hover:text-white'}`}
                      >
                        {m === 'hours' ? 'Set hours' : 'Set time range'}
                      </button>
                    ))}
                  </div>
                  {freeTimeMode === 'hours' ? (
                    <div className="flex items-center gap-3">
                      <label className="text-xs text-gray-400">Free hours per day:</label>
                      <select
                        value={freeHoursPerDay}
                        onChange={e => setFreeHoursPerDay(Number(e.target.value))}
                        className="bg-background-700 border border-background-600 text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-primary-500"
                      >
                        {[1, 2, 3, 4, 5, 6, 8].map(h => <option key={h} value={h}>{h}h</option>)}
                      </select>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {freeTimeRanges.map((r, idx) => (
                        <div key={idx} className="flex items-center gap-2 flex-wrap">
                          <label className="text-xs text-gray-400 w-8">From</label>
                          <input
                            type="time"
                            value={r.start}
                            onChange={e => setFreeTimeRanges(prev => prev.map((x, i) => i === idx ? { ...x, start: e.target.value } : x))}
                            className="bg-background-700 border border-background-600 text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-primary-500"
                          />
                          <label className="text-xs text-gray-400">To</label>
                          <input
                            type="time"
                            value={r.end}
                            onChange={e => setFreeTimeRanges(prev => prev.map((x, i) => i === idx ? { ...x, end: e.target.value } : x))}
                            className="bg-background-700 border border-background-600 text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-primary-500"
                          />
                          <span className="text-xs text-gray-500">{Math.max(0, Math.round(rangeMinutes(r.start, r.end) / 60 * 10) / 10)}h</span>
                          {freeTimeRanges.length > 1 && (
                            <button onClick={() => setFreeTimeRanges(prev => prev.filter((_, i) => i !== idx))} className="text-gray-500 hover:text-red-400 transition-colors"><X size={13} /></button>
                          )}
                        </div>
                      ))}
                      <div className="flex items-center justify-between pt-1">
                        <button
                          onClick={() => setFreeTimeRanges(prev => [...prev, { start: '18:00', end: '20:00' }])}
                          className="text-xs text-primary-400 hover:text-primary-300 flex items-center gap-1 transition-colors"
                        >
                          <Plus size={12} /> Add time range
                        </button>
                        <span className="text-xs text-gray-400">= <strong className="text-white">{effectiveFreeHours}h</strong> free total</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Generate button */}
                <button
                  onClick={handleGenerateReschedule}
                  disabled={rescheduling}
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
                >
                  {rescheduling ? <Loader size={14} className="animate-spin" /> : <Brain size={14} />}
                  {rescheduling ? 'Generating plan…' : reschedulePreview.length > 0 ? 'Re-generate' : 'Generate New Plan'}
                </button>

                {/* Preview */}
                {reschedulePreview.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-gray-300">{reschedulePreview.length} sessions planned</p>
                      <p className="text-xs text-gray-500">Review before applying</p>
                    </div>
                    {reschedulePreview.map((s: any, i: number) => (
                      <div key={i} className="bg-background-800 rounded-xl p-3 flex items-start gap-3">
                        <div className={`w-1 self-stretch rounded-full flex-shrink-0 ${s.priority === 'high' ? 'bg-red-500' : s.priority === 'medium' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-white">{s.title}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {s.date instanceof Date ? format(s.date, 'EEE, MMM d') : s.date} · {s.startTime}–{s.endTime} · <span className="capitalize">{s.sessionType}</span>
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">{s.reason}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-5 py-4 border-t border-background-700 flex items-center justify-end gap-3">
                <button
                  onClick={() => { setShowRescheduleModal(false); setReschedulePreview([]); }}
                  className="px-4 py-2 bg-background-700 hover:bg-background-600 text-gray-300 rounded-xl text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAcceptReschedule}
                  disabled={addingReschedule || reschedulePreview.length === 0}
                  className="px-5 py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {addingReschedule ? <Loader size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                  Apply Plan
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default StudentStudyPlan;
