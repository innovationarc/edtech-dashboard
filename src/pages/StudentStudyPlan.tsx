// src/pages/StudentStudyPlan.tsx  (ADVANCED AI VERSION)
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, Loader, AlertCircle,
  Edit, Trash2, Clock, Target, Brain, Zap, TrendingUp, MessageSquare, Award,
  Flame, CheckCircle2, Circle, BarChart3, Sparkles, Send, X, BookOpen,
  LayoutGrid, List, Timer, Bell, ChevronDown, RefreshCw, Star
} from 'lucide-react';
import Calendar from 'react-calendar';
import Card from '../components/ui/Card';
import { format, isToday, isTomorrow, differenceInDays, addDays, startOfWeek } from 'date-fns';
import { useDashboard } from '../contexts/DashboardContext';
import { studyPlanService, StudyPlanEvent, StudyGoal, PomodoroSession } from '../services/studyPlanService';
import { aiStudyPlannerService, AIInsight, AIScheduleSuggestion } from '../services/aiStudyPlannerService';
import StudyPlanEventModal from '../components/shared/StudyPlanEventModal';

type Value = Date | null | [Date | null, Date | null];
type ViewMode = 'calendar' | 'list' | 'analytics' | 'ai-chat';
type TabMode = 'events' | 'goals' | 'pomodoro';

const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

// ─── Helpers ────────────────────────────────────────────────────────────────

const eventColors: Record<string, string> = {
  assignment: '#f59e0b', exam: '#ef4444', class: '#6366f1',
  study_session: '#10b981', deadline: '#ec4899', personal: '#8b5cf6',
};

const eventBorders: Record<string, string> = {
  assignment: 'border-amber-500', exam: 'border-red-500', class: 'border-indigo-500',
  study_session: 'border-emerald-500', deadline: 'border-pink-500', personal: 'border-purple-500',
};

const priorityGradients: Record<string, string> = {
  high: 'from-red-500/20 to-transparent', medium: 'from-amber-500/20 to-transparent',
  low: 'from-emerald-500/20 to-transparent',
};

const getRelativeDate = (date: Date) => {
  if (isToday(date)) return 'Today';
  if (isTomorrow(date)) return 'Tomorrow';
  const days = differenceInDays(date, new Date());
  if (days < 0) return `${Math.abs(days)}d ago`;
  if (days < 7) return `In ${days}d`;
  return format(date, 'MMM d');
};

// ─── Sub-components ──────────────────────────────────────────────────────────

const InsightCard = ({ insight }: { insight: AIInsight }) => {
  const config = {
    warning: { bg: 'bg-amber-500/10 border-amber-500/30', icon: '⚠️', text: 'text-amber-400' },
    success: { bg: 'bg-emerald-500/10 border-emerald-500/30', icon: '✅', text: 'text-emerald-400' },
    tip: { bg: 'bg-blue-500/10 border-blue-500/30', icon: '💡', text: 'text-blue-400' },
    motivation: { bg: 'bg-purple-500/10 border-purple-500/30', icon: '🚀', text: 'text-purple-400' },
  }[insight.type];

  return (
    <div className={`rounded-xl border p-3 ${config.bg}`}>
      <div className="flex items-start gap-2">
        <span className="text-base mt-0.5">{config.icon}</span>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold ${config.text}`}>{insight.title}</p>
          <p className="text-xs text-gray-300 mt-0.5 leading-relaxed">{insight.message}</p>
        </div>
      </div>
    </div>
  );
};

const PomodoroTimer = ({
  onSessionComplete,
  subjects,
}: {
  onSessionComplete: (session: { subject: string; duration: number; notes: string }) => void;
  subjects: string[];
}) => {
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [mode, setMode] = useState<'focus' | 'short' | 'long'>('focus');
  const [subject, setSubject] = useState(subjects[0] || '');
  const [notes, setNotes] = useState('');
  const [sessionStarted, setSessionStarted] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const durations = { focus: 25 * 60, short: 5 * 60, long: 15 * 60 };
  const modeLabels = { focus: '🎯 Focus', short: '☕ Short Break', long: '🌿 Long Break' };

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setTimeLeft((t) => {
          if (t <= 1) {
            setIsRunning(false);
            if (mode === 'focus' && sessionStarted) {
              onSessionComplete({ subject, duration: durations.focus / 60, notes });
            }
            return durations[mode];
          }
          return t - 1;
        });
      }, 1000);
    } else {
      clearInterval(intervalRef.current!);
    }
    return () => clearInterval(intervalRef.current!);
  }, [isRunning, mode]);

  const reset = () => { setIsRunning(false); setTimeLeft(durations[mode]); setSessionStarted(false); };
  const switchMode = (m: 'focus' | 'short' | 'long') => { setMode(m); setIsRunning(false); setTimeLeft(durations[m]); setSessionStarted(false); };

  const mins = String(Math.floor(timeLeft / 60)).padStart(2, '0');
  const secs = String(timeLeft % 60).padStart(2, '0');
  const progress = 1 - timeLeft / durations[mode];
  const radius = 56;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="flex gap-2">
        {(['focus', 'short', 'long'] as const).map((m) => (
          <button key={m} onClick={() => switchMode(m)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${mode === m ? 'bg-primary-600 text-white' : 'bg-background-800 text-gray-400 hover:text-white'}`}>
            {modeLabels[m]}
          </button>
        ))}
      </div>

      <div className="relative w-36 h-36">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 128 128">
          <circle cx="64" cy="64" r={radius} fill="none" stroke="#1f2937" strokeWidth="8" />
          <circle cx="64" cy="64" r={radius} fill="none" stroke={mode === 'focus' ? '#6366f1' : '#10b981'}
            strokeWidth="8" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - progress)}
            strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s linear' }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-mono font-bold text-white">{mins}:{secs}</span>
          <span className="text-xs text-gray-400 mt-1">{mode === 'focus' ? 'Focus' : 'Break'}</span>
        </div>
      </div>

      <div className="w-full space-y-2">
        {subjects.length > 0 && (
          <select value={subject} onChange={(e) => setSubject(e.target.value)}
            className="w-full bg-background-800 text-white text-sm rounded-lg px-3 py-2 border border-background-700 focus:outline-none focus:border-primary-500">
            {subjects.map((s) => <option key={s}>{s}</option>)}
            <option value="">Other</option>
          </select>
        )}
        <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Session notes (optional)"
          className="w-full bg-background-800 text-white text-sm rounded-lg px-3 py-2 border border-background-700 focus:outline-none focus:border-primary-500" />
      </div>

      <div className="flex gap-3">
        <button onClick={() => { setIsRunning(!isRunning); if (!sessionStarted) setSessionStarted(true); }}
          className={`px-6 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-lg ${
            isRunning ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'bg-primary-600 hover:bg-primary-700 text-white'}`}>
          {isRunning ? '⏸ Pause' : '▶ Start'}
        </button>
        <button onClick={reset} className="px-4 py-2.5 rounded-xl bg-background-700 text-gray-300 hover:text-white text-sm transition-all">
          <RefreshCw size={16} />
        </button>
      </div>
    </div>
  );
};

const GoalCard = ({ goal, onUpdate, onDelete }: { goal: StudyGoal; onUpdate: (id: string, p: Partial<StudyGoal>) => void; onDelete: (id: string) => void }) => {
  const daysLeft = differenceInDays(goal.targetDate, new Date());
  const pct = Math.min(100, goal.currentProgress);

  return (
    <div className="bg-background-800 rounded-xl p-4 border border-background-700">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className="text-white font-semibold text-sm">{goal.subject}</h4>
          <p className="text-xs text-gray-400 mt-0.5">
            {daysLeft > 0 ? `${daysLeft} days left` : daysLeft === 0 ? 'Due today!' : `${Math.abs(daysLeft)}d overdue`}
            {' · '}{goal.difficulty} difficulty
          </p>
        </div>
        <div className="flex gap-1">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${daysLeft < 3 ? 'bg-red-500/20 text-red-400' : daysLeft < 7 ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
            {daysLeft < 0 ? 'Overdue' : daysLeft < 3 ? 'Urgent' : 'On Track'}
          </span>
          <button onClick={() => onDelete(goal.id)} className="p-1 text-gray-500 hover:text-red-400 transition-colors">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div className="mb-2">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-gray-400">{goal.hoursCompleted}h / {goal.hoursNeeded}h completed</span>
          <span className="text-white font-medium">{pct}%</span>
        </div>
        <div className="h-2 bg-background-700 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, background: pct >= 80 ? '#10b981' : pct >= 50 ? '#6366f1' : '#f59e0b' }} />
        </div>
      </div>

      <div className="flex gap-2 mt-3">
        {[25, 50, 75, 100].map((p) => (
          <button key={p} onClick={() => onUpdate(goal.id, { currentProgress: p })}
            className={`flex-1 py-1 rounded text-xs transition-all ${goal.currentProgress >= p ? 'bg-primary-600 text-white' : 'bg-background-700 text-gray-400 hover:text-white'}`}>
            {p}%
          </button>
        ))}
      </div>
    </div>
  );
};

// ─── Main Component ──────────────────────────────────────────────────────────

const StudentStudyPlan = () => {
  const { user } = useDashboard();

  // Core state
  const [date, setDate] = useState<Value>(new Date());
  const [showModal, setShowModal] = useState(false);
  const [events, setEvents] = useState<StudyPlanEvent[]>([]);
  const [currentEvent, setCurrentEvent] = useState<StudyPlanEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // New state
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');
  const [activeTab, setActiveTab] = useState<TabMode>('events');
  const [goals, setGoals] = useState<StudyGoal[]>([]);
  const [sessions, setSessions] = useState<PomodoroSession[]>([]);
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<AIScheduleSuggestion[]>([]);
  const [showAISuggestions, setShowAISuggestions] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; content: string; time: Date }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [streak, setStreak] = useState<{ current: number; longest: number; total: number }>({ current: 0, longest: 0, total: 0 });
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [newGoal, setNewGoal] = useState({ subject: '', hoursNeeded: 10, difficulty: 'medium' as const, targetDate: '' });

  const chatEndRef = useRef<HTMLDivElement>(null);

  const selectedDate = date instanceof Date ? date : new Date();

  // ─── Data loading ──────────────────────────────────────────────────────────

  const loadAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const [fetchedEvents, fetchedGoals, fetchedSessions, fetchedStreak] = await Promise.all([
        studyPlanService.getEventsForStudent(user.uid),
        studyPlanService.getGoalsForStudent(user.uid),
        studyPlanService.getPomodoroSessions(user.uid),
        studyPlanService.getStreak(user.uid),
      ]);
      setEvents(fetchedEvents);
      setGoals(fetchedGoals);
      setSessions(fetchedSessions);
      if (fetchedStreak) {
        setStreak({ current: fetchedStreak.currentStreak, longest: fetchedStreak.longestStreak, total: fetchedStreak.totalSessions });
      }
    } catch (err: any) {
      setError('Failed to load data: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Load AI insights after data loads
  useEffect(() => {
    if (!user || events.length === 0 || !GEMINI_KEY) return;
    const upcoming = events.filter(e => e.date >= new Date()).slice(0, 10)
      .map(e => ({ title: e.title, date: e.date, priority: e.priority, eventType: e.eventType }));
    const completionRate = events.length > 0
      ? Math.round((events.filter(e => e.completed).length / events.length) * 100) : 0;

    aiStudyPlannerService.getPersonalizedInsights(user.displayName || 'Student', upcoming, completionRate, GEMINI_KEY)
      .then(setInsights).catch(console.warn);
  }, [events, user]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);

  // ─── Event handlers ────────────────────────────────────────────────────────

  const handleSaveEvent = async (eventData: Omit<StudyPlanEvent, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!user) return;
    setLoading(true);
    try {
      if (currentEvent) {
        await studyPlanService.updateEvent(currentEvent.id, eventData);
      } else {
        await studyPlanService.createEvent(eventData);
      }
      await loadAll();
      setShowModal(false);
      setCurrentEvent(null);
      (window as any).addNotification?.(currentEvent ? 'Event updated!' : 'Event added!', 'success');
    } catch (err: any) {
      setError('Failed to save: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEvent = async (id: string) => {
    if (!confirm('Delete this event?')) return;
    setLoading(true);
    try {
      await studyPlanService.deleteEvent(id);
      await loadAll();
      (window as any).addNotification?.('Event deleted', 'success');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleComplete = async (event: StudyPlanEvent) => {
    await studyPlanService.markEventComplete(event.id, !event.completed);
    setEvents(prev => prev.map(e => e.id === event.id ? { ...e, completed: !e.completed } : e));
  };

  const handleGenerateAISchedule = async () => {
    if (!GEMINI_KEY || goals.length === 0) {
      setError('Add study goals first to generate AI schedule');
      return;
    }
    setAiLoading(true);
    try {
      const existing = events.filter(e => e.date >= new Date()).map(e => ({ date: e.date, startTime: e.startTime, endTime: e.endTime }));
      const suggestions = await aiStudyPlannerService.generateSmartSchedule(
        goals.map(g => ({ subject: g.subject, targetDate: g.targetDate, hoursNeeded: g.hoursNeeded, difficulty: g.difficulty, currentProgress: g.currentProgress })),
        existing, 6, GEMINI_KEY
      );
      setAiSuggestions(suggestions);
      setShowAISuggestions(true);
    } catch (err: any) {
      setError('AI error: ' + err.message);
    } finally {
      setAiLoading(false);
    }
  };

  const handleAcceptAISuggestions = async () => {
    if (!user) return;
    setAiLoading(true);
    try {
      const eventsToCreate = aiSuggestions.map(s => ({
        title: s.title, description: s.reason, date: s.date,
        startTime: s.startTime, endTime: s.endTime, course: s.subject,
        instructorId: user.uid, instructorName: user.displayName || 'AI',
        isPersonal: true, studentId: user.uid, targetAudience: 'specific_student' as const,
        targetStudentIds: [user.uid], eventType: 'study_session' as const,
        priority: s.priority, isAIGenerated: true, aiReason: s.reason, aiTips: s.tips,
        sessionType: s.sessionType, completed: false,
      }));
      await studyPlanService.createBulkAIEvents(eventsToCreate, user.uid);
      await loadAll();
      setShowAISuggestions(false);
      setAiSuggestions([]);
      (window as any).addNotification?.(`${eventsToCreate.length} AI sessions added!`, 'success');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAiLoading(false);
    }
  };

  const handleSendChat = async () => {
    if (!chatInput.trim() || !GEMINI_KEY) return;
    const userMsg = { role: 'user' as const, content: chatInput, time: new Date() };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setChatLoading(true);
    try {
      const subjects = [...new Set(events.map(e => e.course).filter(Boolean))];
      const upcomingExams = events.filter(e => e.eventType === 'exam' && e.date >= new Date()).slice(0, 3).map(e => e.title);
      const reply = await aiStudyPlannerService.chatWithAI(
        userMsg.content,
        { events: events.length, subjects, upcomingExams },
        chatMessages.slice(-6).map(m => ({ role: m.role, content: m.content })),
        GEMINI_KEY
      );
      setChatMessages(prev => [...prev, { role: 'assistant', content: reply, time: new Date() }]);
    } catch {
      setChatMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I had trouble connecting. Please try again.', time: new Date() }]);
    } finally {
      setChatLoading(false);
    }
  };

  const handlePomodoroComplete = async (session: { subject: string; duration: number; notes: string }) => {
    if (!user) return;
    await studyPlanService.savePomodoroSession({
      studentId: user.uid, subject: session.subject,
      startTime: new Date(Date.now() - session.duration * 60000),
      duration: session.duration, completed: true, notes: session.notes,
    });
    await loadAll();
    (window as any).addNotification?.(`🎉 ${session.duration}min focus session complete!`, 'success');
  };

  const handleAddGoal = async () => {
    if (!user || !newGoal.subject || !newGoal.targetDate) return;
    await studyPlanService.createGoal({
      studentId: user.uid, subject: newGoal.subject, targetDate: new Date(newGoal.targetDate),
      hoursNeeded: newGoal.hoursNeeded, hoursCompleted: 0, difficulty: newGoal.difficulty,
      currentProgress: 0, isActive: true,
    });
    setNewGoal({ subject: '', hoursNeeded: 10, difficulty: 'medium', targetDate: '' });
    setShowGoalForm(false);
    await loadAll();
    (window as any).addNotification?.('Goal added!', 'success');
  };

  // ─── Derived data ──────────────────────────────────────────────────────────

  const eventsForSelectedDate = events.filter(e =>
    e.date.getDate() === selectedDate.getDate() &&
    e.date.getMonth() === selectedDate.getMonth() &&
    e.date.getFullYear() === selectedDate.getFullYear()
  );

  const upcomingEvents = events.filter(e => e.date >= new Date() && !e.completed)
    .sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, 8);

  const completedCount = events.filter(e => e.completed).length;
  const completionRate = events.length > 0 ? Math.round((completedCount / events.length) * 100) : 0;

  const weekStart = startOfWeek(new Date());
  const weekEvents = events.filter(e => e.date >= weekStart && e.date <= addDays(weekStart, 6));

  const subjects = [...new Set(events.map(e => e.course).filter(Boolean))];

  // ─── Render helpers ────────────────────────────────────────────────────────

  const EventRow = ({ event }: { event: StudyPlanEvent }) => (
    <div className={`bg-background-800 rounded-xl p-3 border-l-4 ${eventBorders[event.eventType] || 'border-primary-500'} transition-all hover:bg-background-750 group ${event.completed ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <button onClick={() => handleToggleComplete(event)} className="mt-0.5 flex-shrink-0">
            {event.completed
              ? <CheckCircle2 size={18} className="text-emerald-400" />
              : <Circle size={18} className="text-gray-500 hover:text-emerald-400 transition-colors" />}
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-base">{({ assignment: '📋', exam: '🎯', class: '🏫', study_session: '📚', deadline: '⏰', personal: '📝' })[event.eventType] || '📅'}</span>
              <span className={`text-sm font-semibold text-white truncate ${event.completed ? 'line-through text-gray-500' : ''}`}>{event.title}</span>
              {event.isAIGenerated && <span className="text-xs bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded-full flex-shrink-0">✨ AI</span>}
              {event.priority === 'high' && <span className="text-xs bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-full flex-shrink-0">🔥 High</span>}
            </div>
            {event.description && <p className="text-xs text-gray-400 mt-0.5 truncate">{event.description}</p>}
            <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
              {event.startTime && <span className="flex items-center gap-1"><Clock size={11} />{event.startTime}–{event.endTime}</span>}
              {event.course && <span className="flex items-center gap-1"><BookOpen size={11} />{event.course}</span>}
              <span className="flex items-center gap-1"><CalendarIcon size={11} />{getRelativeDate(event.date)}</span>
            </div>
            {event.aiTips && event.aiTips.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {event.aiTips.slice(0, 2).map((tip, i) => (
                  <span key={i} className="text-xs bg-purple-500/10 text-purple-300 px-2 py-0.5 rounded-full">💡 {tip}</span>
                ))}
              </div>
            )}
          </div>
        </div>
        {event.isPersonal && event.studentId === user?.uid && (
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
            <button onClick={() => { setCurrentEvent(event); setShowModal(true); }}
              className="p-1.5 rounded-lg bg-background-700 hover:bg-primary-600/20 text-gray-400 hover:text-primary-400 transition-all">
              <Edit size={13} />
            </button>
            <button onClick={() => handleDeleteEvent(event.id)}
              className="p-1.5 rounded-lg bg-background-700 hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-all">
              <Trash2 size={13} />
            </button>
          </div>
        )}
      </div>
    </div>
  );

  if (loading && events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="relative">
          <Loader size={32} className="animate-spin text-primary-500" />
          <Sparkles size={14} className="absolute -top-1 -right-1 text-amber-400" />
        </div>
        <p className="text-gray-400 text-sm">Loading your AI-powered study planner...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white">Study Planner</h1>
            <span className="flex items-center gap-1 text-xs bg-gradient-to-r from-purple-500/20 to-blue-500/20 border border-purple-500/30 text-purple-300 px-2 py-1 rounded-full">
              <Sparkles size={10} /> AI Powered
            </span>
          </div>
          <p className="text-gray-400 mt-1 text-sm">Intelligent scheduling · Pomodoro · Goals · Analytics</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={handleGenerateAISchedule} disabled={aiLoading}
            className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-4 py-2 rounded-xl transition-all shadow-lg hover:shadow-purple-500/25 text-sm font-medium disabled:opacity-50">
            {aiLoading ? <Loader size={16} className="animate-spin" /> : <Brain size={16} />}
            {aiLoading ? 'Generating...' : 'AI Schedule'}
          </button>
          <button onClick={() => { setCurrentEvent(null); setShowModal(true); }}
            className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-xl transition-all text-sm font-medium">
            <Plus size={16} /> Add Event
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Streak', value: `${streak.current}🔥`, sub: `${streak.longest} best`, color: 'from-orange-500/20 to-transparent', icon: <Flame size={16} className="text-orange-400" /> },
          { label: 'This Week', value: weekEvents.length, sub: 'events scheduled', color: 'from-blue-500/20 to-transparent', icon: <CalendarIcon size={16} className="text-blue-400" /> },
          { label: 'Completed', value: `${completionRate}%`, sub: `${completedCount}/${events.length} done`, color: 'from-emerald-500/20 to-transparent', icon: <CheckCircle2 size={16} className="text-emerald-400" /> },
          { label: 'Goals', value: goals.length, sub: 'active goals', color: 'from-purple-500/20 to-transparent', icon: <Target size={16} className="text-purple-400" /> },
        ].map(stat => (
          <div key={stat.label} className={`rounded-xl bg-gradient-to-br ${stat.color} border border-background-700 p-3 bg-background-800`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-400">{stat.label}</span>
              {stat.icon}
            </div>
            <div className="text-xl font-bold text-white">{stat.value}</div>
            <div className="text-xs text-gray-500">{stat.sub}</div>
          </div>
        ))}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl flex items-center gap-2">
          <AlertCircle size={16} /><span className="text-sm">{error}</span>
          <button onClick={() => setError('')} className="ml-auto"><X size={14} /></button>
        </div>
      )}

      {/* View Mode Tabs */}
      <div className="flex gap-1 bg-background-800 rounded-xl p-1 border border-background-700">
        {([
          { id: 'calendar', icon: <CalendarIcon size={14} />, label: 'Calendar' },
          { id: 'list', icon: <List size={14} />, label: 'Upcoming' },
          { id: 'analytics', icon: <BarChart3 size={14} />, label: 'Analytics' },
          { id: 'ai-chat', icon: <MessageSquare size={14} />, label: 'AI Chat' },
        ] as { id: ViewMode; icon: JSX.Element; label: string }[]).map(v => (
          <button key={v.id} onClick={() => setViewMode(v.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-medium transition-all ${viewMode === v.id ? 'bg-primary-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}>
            {v.icon}<span className="hidden sm:inline">{v.label}</span>
          </button>
        ))}
      </div>

      {/* Main Content */}
      {viewMode === 'calendar' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar */}
          <div className="lg:col-span-1 space-y-4">
            <Card>
              <div className="custom-calendar">
                <Calendar onChange={setDate} value={date}
                  className="bg-card text-white rounded-lg w-full"
                  tileClassName={({ date: d, view }) => {
                    if (view !== 'month') return null;
                    const hasEvent = events.some(e => e.date.toDateString() === d.toDateString());
                    const hasUrgent = events.some(e => e.date.toDateString() === d.toDateString() && e.priority === 'high');
                    return hasUrgent ? 'has-event urgent-event' : hasEvent ? 'has-event' : null;
                  }}
                  prevLabel={<ChevronLeft size={16} />} nextLabel={<ChevronRight size={16} />}
                  navigationLabel={({ date: d }) => <span className="text-white font-medium">{format(d, 'MMMM yyyy')}</span>}
                />
              </div>
              <div className="mt-4 pt-4 border-t border-background-700 space-y-1.5">
                {[['bg-indigo-500', 'Class / Teacher Events'], ['bg-emerald-500', 'Study Sessions'], ['bg-red-500', 'Exams / Deadlines'], ['bg-purple-500', 'Personal Events'], ['bg-purple-600 ring-2 ring-purple-400', 'AI Generated']].map(([cls, lbl]) => (
                  <div key={lbl} className="flex items-center gap-2">
                    <div className={`h-2.5 w-2.5 rounded-full ${cls}`} />
                    <span className="text-xs text-gray-400">{lbl}</span>
                  </div>
                ))}
              </div>
            </Card>

            {/* AI Insights */}
            {insights.length > 0 && (
              <Card>
                <div className="flex items-center gap-2 mb-3">
                  <Zap size={14} className="text-amber-400" />
                  <h3 className="text-sm font-semibold text-white">AI Insights</h3>
                </div>
                <div className="space-y-2">
                  {insights.map((ins, i) => <InsightCard key={i} insight={ins} />)}
                </div>
              </Card>
            )}
          </div>

          {/* Day Events + Tabs */}
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-white">{format(selectedDate, 'EEEE, MMMM d')}</h2>
                <div className="flex gap-1">
                  {(['events', 'goals', 'pomodoro'] as TabMode[]).map(t => (
                    <button key={t} onClick={() => setActiveTab(t)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${activeTab === t ? 'bg-primary-600 text-white' : 'bg-background-800 text-gray-400 hover:text-white'}`}>
                      {t === 'pomodoro' ? '🍅 Timer' : t === 'goals' ? '🎯 Goals' : '📅 Events'}
                    </button>
                  ))}
                </div>
              </div>

              {activeTab === 'events' && (
                eventsForSelectedDate.length > 0 ? (
                  <div className="space-y-3">
                    {eventsForSelectedDate.map(e => <EventRow key={e.id} event={e} />)}
                  </div>
                ) : (
                  <div className="py-12 text-center">
                    <CalendarIcon size={36} className="mx-auto mb-3 text-gray-600" />
                    <p className="text-gray-400 text-sm">No events for this day</p>
                    <button onClick={() => { setCurrentEvent(null); setShowModal(true); }}
                      className="mt-3 inline-flex items-center gap-1.5 text-primary-400 hover:text-primary-300 text-sm transition-colors">
                      <Plus size={14} /> Add Event
                    </button>
                  </div>
                )
              )}

              {activeTab === 'goals' && (
                <div className="space-y-3">
                  {goals.map(g => (
                    <GoalCard key={g.id} goal={g}
                      onUpdate={async (id, p) => { await studyPlanService.updateGoal(id, p); await loadAll(); }}
                      onDelete={async (id) => { await studyPlanService.deleteGoal(id); await loadAll(); }}
                    />
                  ))}
                  {showGoalForm ? (
                    <div className="bg-background-800 rounded-xl p-4 border border-primary-500/30 space-y-3">
                      <h4 className="text-sm font-semibold text-white">New Study Goal</h4>
                      <input value={newGoal.subject} onChange={e => setNewGoal(p => ({ ...p, subject: e.target.value }))}
                        placeholder="Subject / Topic" className="w-full bg-background-700 text-white text-sm rounded-lg px-3 py-2 border border-background-600 focus:outline-none focus:border-primary-500" />
                      <div className="grid grid-cols-2 gap-2">
                        <input type="number" value={newGoal.hoursNeeded} min={1} max={200}
                          onChange={e => setNewGoal(p => ({ ...p, hoursNeeded: +e.target.value }))}
                          placeholder="Hours needed" className="w-full bg-background-700 text-white text-sm rounded-lg px-3 py-2 border border-background-600 focus:outline-none focus:border-primary-500" />
                        <input type="date" value={newGoal.targetDate} onChange={e => setNewGoal(p => ({ ...p, targetDate: e.target.value }))}
                          className="w-full bg-background-700 text-white text-sm rounded-lg px-3 py-2 border border-background-600 focus:outline-none focus:border-primary-500" />
                      </div>
                      <select value={newGoal.difficulty} onChange={e => setNewGoal(p => ({ ...p, difficulty: e.target.value as any }))}
                        className="w-full bg-background-700 text-white text-sm rounded-lg px-3 py-2 border border-background-600 focus:outline-none focus:border-primary-500">
                        <option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option>
                      </select>
                      <div className="flex gap-2">
                        <button onClick={handleAddGoal} className="flex-1 bg-primary-600 hover:bg-primary-700 text-white py-2 rounded-lg text-sm font-medium transition-colors">Save Goal</button>
                        <button onClick={() => setShowGoalForm(false)} className="px-4 bg-background-700 text-gray-300 rounded-lg text-sm transition-colors">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setShowGoalForm(true)}
                      className="w-full py-3 rounded-xl border-2 border-dashed border-background-700 text-gray-400 hover:text-white hover:border-primary-500 transition-all text-sm flex items-center justify-center gap-2">
                      <Plus size={16} /> Add Study Goal
                    </button>
                  )}
                </div>
              )}

              {activeTab === 'pomodoro' && (
                <PomodoroTimer subjects={subjects} onSessionComplete={handlePomodoroComplete} />
              )}
            </Card>
          </div>
        </div>
      )}

      {viewMode === 'list' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card>
              <h2 className="text-base font-semibold text-white mb-4">Upcoming Events</h2>
              {upcomingEvents.length > 0 ? (
                <div className="space-y-3">
                  {upcomingEvents.map(e => (
                    <div key={e.id} className={`bg-gradient-to-r ${priorityGradients[e.priority]} rounded-xl`}>
                      <EventRow event={e} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center">
                  <Star size={36} className="mx-auto mb-3 text-gray-600" />
                  <p className="text-gray-400 text-sm">All clear! No upcoming events.</p>
                </div>
              )}
            </Card>
          </div>
          <div className="space-y-4">
            <Card>
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2"><TrendingUp size={14} className="text-emerald-400" /> Progress</h3>
              <div className="space-y-3">
                {goals.slice(0, 4).map(g => (
                  <div key={g.id}>
                    <div className="flex justify-between text-xs mb-1"><span className="text-gray-300">{g.subject}</span><span className="text-white">{g.currentProgress}%</span></div>
                    <div className="h-2 bg-background-700 rounded-full"><div className="h-full rounded-full bg-primary-500 transition-all" style={{ width: `${g.currentProgress}%` }} /></div>
                  </div>
                ))}
              </div>
            </Card>
            {insights.length > 0 && (
              <Card>
                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2"><Brain size={14} className="text-purple-400" /> AI Tips</h3>
                <div className="space-y-2">{insights.slice(0, 2).map((ins, i) => <InsightCard key={i} insight={ins} />)}</div>
              </Card>
            )}
          </div>
        </div>
      )}

      {viewMode === 'analytics' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2"><BarChart3 size={16} className="text-primary-400" /> Study Overview</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Total Events', value: events.length },
                  { label: 'Completed', value: completedCount },
                  { label: 'Pomodoros', value: sessions.length },
                ].map(s => (
                  <div key={s.label} className="bg-background-800 rounded-xl p-3 text-center">
                    <div className="text-2xl font-bold text-white">{s.value}</div>
                    <div className="text-xs text-gray-400 mt-1">{s.label}</div>
                  </div>
                ))}
              </div>
              <div>
                <div className="flex justify-between text-sm mb-2"><span className="text-gray-400">Overall Completion</span><span className="text-white font-semibold">{completionRate}%</span></div>
                <div className="h-3 bg-background-700 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-primary-500 to-emerald-500 transition-all duration-700" style={{ width: `${completionRate}%` }} />
                </div>
              </div>
              <div>
                <h3 className="text-sm text-gray-400 mb-3">Events by Type</h3>
                {['study_session', 'exam', 'assignment', 'class', 'personal'].map(type => {
                  const count = events.filter(e => e.eventType === type).length;
                  const pct = events.length > 0 ? (count / events.length) * 100 : 0;
                  return count > 0 ? (
                    <div key={type} className="mb-2">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-300 capitalize">{type.replace('_', ' ')}</span>
                        <span className="text-gray-400">{count}</span>
                      </div>
                      <div className="h-1.5 bg-background-700 rounded-full">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: eventColors[type] }} />
                      </div>
                    </div>
                  ) : null;
                })}
              </div>
            </div>
          </Card>

          <Card>
            <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2"><Award size={16} className="text-amber-400" /> Achievements</h2>
            <div className="space-y-3">
              {[
                { icon: '🔥', title: 'Study Streak', desc: `${streak.current} days in a row`, earned: streak.current > 0 },
                { icon: '🎯', title: 'Goal Setter', desc: `${goals.length} active goals`, earned: goals.length > 0 },
                { icon: '🍅', title: 'Pomodoro Pro', desc: `${sessions.length} sessions complete`, earned: sessions.length >= 5 },
                { icon: '✅', title: 'Completionist', desc: `${completionRate}% completion rate`, earned: completionRate >= 50 },
                { icon: '🤖', title: 'AI Adopter', desc: 'Used AI schedule generator', earned: events.some(e => e.isAIGenerated) },
                { icon: '📚', title: 'Dedicated', desc: `${streak.total} total sessions`, earned: streak.total >= 10 },
              ].map(a => (
                <div key={a.title} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${a.earned ? 'bg-amber-500/10 border-amber-500/30' : 'bg-background-800 border-background-700 opacity-40'}`}>
                  <span className="text-2xl">{a.icon}</span>
                  <div>
                    <p className="text-sm font-semibold text-white">{a.title}</p>
                    <p className="text-xs text-gray-400">{a.desc}</p>
                  </div>
                  {a.earned && <CheckCircle2 size={16} className="ml-auto text-emerald-400 flex-shrink-0" />}
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {viewMode === 'ai-chat' && (
        <Card className="flex flex-col" style={{ height: '560px' }}>
          <div className="flex items-center gap-3 mb-4 pb-4 border-b border-background-700">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center flex-shrink-0">
              <Brain size={18} className="text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">AI Study Assistant</h2>
              <p className="text-xs text-emerald-400">● Online · Powered by Gemini</p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-1">
            {chatMessages.length === 0 && (
              <div className="text-center py-8">
                <Sparkles size={32} className="mx-auto mb-3 text-purple-400 opacity-50" />
                <p className="text-gray-400 text-sm">Ask me anything about studying, planning, or your schedule!</p>
                <div className="mt-4 flex flex-wrap gap-2 justify-center">
                  {['How should I prioritize my exams?', 'Give me study tips for math', 'How many hours should I study daily?'].map(q => (
                    <button key={q} onClick={() => setChatInput(q)}
                      className="text-xs bg-background-800 border border-background-700 text-gray-300 px-3 py-1.5 rounded-full hover:border-primary-500 hover:text-white transition-all">
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {chatMessages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center mr-2 mt-1 flex-shrink-0">
                    <Brain size={14} className="text-white" />
                  </div>
                )}
                <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${msg.role === 'user' ? 'bg-primary-600 text-white rounded-br-sm' : 'bg-background-800 text-gray-200 rounded-bl-sm border border-background-700'}`}>
                  {msg.content}
                  <div className="text-xs opacity-50 mt-1.5">{format(msg.time, 'h:mm a')}</div>
                </div>
              </div>
            ))}
            {chatLoading && (
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center flex-shrink-0">
                  <Brain size={14} className="text-white" />
                </div>
                <div className="bg-background-800 rounded-2xl rounded-bl-sm px-4 py-3 border border-background-700">
                  <div className="flex gap-1">
                    {[0, 1, 2].map(i => <div key={i} className="w-2 h-2 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="flex gap-2">
            <input value={chatInput} onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendChat(); } }}
              placeholder="Ask your AI study assistant..." disabled={chatLoading}
              className="flex-1 bg-background-800 text-white text-sm rounded-xl px-4 py-3 border border-background-700 focus:outline-none focus:border-primary-500 transition-colors" />
            <button onClick={handleSendChat} disabled={chatLoading || !chatInput.trim()}
              className="p-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-xl transition-all disabled:opacity-50">
              <Send size={16} />
            </button>
          </div>
        </Card>
      )}

      {/* AI Suggestions Modal */}
      {showAISuggestions && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-background-900 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col border border-purple-500/30 shadow-2xl shadow-purple-500/10">
            <div className="p-5 border-b border-background-700 flex items-center justify-between">
              <div>
                <h3 className="text-white font-bold flex items-center gap-2"><Sparkles size={16} className="text-purple-400" /> AI Generated Schedule</h3>
                <p className="text-xs text-gray-400 mt-0.5">{aiSuggestions.length} optimized sessions for the next 7 days</p>
              </div>
              <button onClick={() => setShowAISuggestions(false)} className="p-2 text-gray-400 hover:text-white transition-colors"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {aiSuggestions.map((s, i) => (
                <div key={i} className="bg-background-800 rounded-xl p-4 border border-background-700 border-l-4 border-l-purple-500">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-white">{s.title}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${s.sessionType === 'focus' ? 'bg-indigo-500/20 text-indigo-300' : s.sessionType === 'review' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}>
                          {s.sessionType}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">{s.reason}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                        <span>📅 {format(s.date, 'MMM d')}</span>
                        <span>⏰ {s.startTime}–{s.endTime}</span>
                        <span>📚 {s.subject}</span>
                      </div>
                      {s.tips?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {s.tips.map((tip, j) => <span key={j} className="text-xs bg-purple-500/10 text-purple-300 px-2 py-0.5 rounded">💡 {tip}</span>)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-5 border-t border-background-700 flex gap-3">
              <button onClick={handleAcceptAISuggestions} disabled={aiLoading}
                className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                {aiLoading ? <Loader size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                Accept All & Add to Schedule
              </button>
              <button onClick={() => setShowAISuggestions(false)}
                className="px-6 bg-background-700 text-gray-300 hover:text-white rounded-xl text-sm transition-colors">
                Discard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Event Modal */}
      {showModal && (
        <StudyPlanEventModal
          selectedDate={selectedDate} currentUser={user} allStudents={[]} allCourses={[]}
          onClose={() => { setShowModal(false); setCurrentEvent(null); }}
          onSave={handleSaveEvent} isPersonalEvent={true}
          event={currentEvent}
        />
      )}
    </div>
  );
};

export default StudentStudyPlan;
