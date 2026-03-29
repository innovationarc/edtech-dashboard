// src/pages/StudentStudyPlan.tsx
// AI Study Planner — Calendar · Goals · Analytics · AI Chat
// Fixes: duplicate creation, broken AI, no loading states
// New: enrolled course planning, custom activities, chat persistence, add-to-calendar from chat
// AI provider loaded from Firestore (Admin → AI Model Settings) — supports Groq, Gemini, OpenAI, Anthropic, DeepSeek


import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, Loader, AlertCircle,
  Edit, Trash2, Clock, Target, Brain, Sparkles, BarChart2, MessageSquare,
  CheckCircle2, X, Flame, BookOpen, Play, Pause, RotateCcw, Send,
  ListTodo, Timer, AlertOctagon, Lightbulb, Heart, GraduationCap,
  Zap, ChevronDown, ChevronUp, Award, TrendingUp, RefreshCw, Trash,
  AlertTriangle, BarChart, Tag, Layers, Video, Coffee, Volume2, VolumeX,
  Paperclip, ImageIcon, Target as GoalIcon,
  Download, Snowflake, History, Search, Star,
} from 'lucide-react';
import Calendar from 'react-calendar';
import { format, differenceInDays, startOfWeek, endOfWeek, isToday, isTomorrow } from 'date-fns';
import { useDashboard } from '../contexts/DashboardContext';
import {
  studyPlanService, StudyPlanEvent, StudyGoal,
  CustomActivity, EnrolledCourseForPlanning, SelectedTopicItem,
} from '../services/studyPlanService';
import {
  aiStudyPlannerService, AIInsight, CalendarEventFromChat, GoalFromChat, StudyAnalytics,
} from '../services/aiStudyPlannerService';
import { aiModelConfigService, callProviderDirect, AIModelConfig } from '../services/aiModelConfigService';
import StudyPlanEventModal from '../components/shared/StudyPlanEventModal';
import { generateStudySchedule, rescheduleStudyPlan, recoverTodayPlan, ScheduledSession, ScheduleResult, GoalScheduleStats, computeGoalProgressUpdate, calcTotalHoursFromTopics, calcHoursRange } from '../services/studySchedulerService';
import { topicGroupService, TopicGroup } from '../services/topicGroupService';
import { notificationService } from '../services/notificationService';


type View = 'calendar' | 'list' | 'analytics' | 'chat';
type Value = Date | null | [Date | null, Date | null];
type GoalMode = 'simple' | 'topic' | 'course';

// ─── NoAnimCard — blocks card animations (same as StudentQA / StudentTaskDashboard) ──
import { DashboardContext } from '../contexts/DashboardContext';
import Card from '../components/ui/Card';

const NoAnimCard = ({ children, className, style, onClick }: {
  children: React.ReactNode; className?: string; style?: React.CSSProperties; onClick?: () => void;
}) => {
  const ctx = useDashboard();
  return (
    <div data-no-anim onClick={onClick} style={onClick ? { cursor: 'pointer' } : undefined}>
      <style>{`
        [data-no-anim] * { animation-duration: 0.001ms !important; animation-delay: 0s !important; animation-fill-mode: none !important; }
        [data-no-anim] .cm-tilt,[data-no-anim] .cm-lift,[data-no-anim] .cm-spring,
        [data-no-anim] .cm-glow,[data-no-anim] .cm-magnetic,[data-no-anim] .cm-reset {
          transform: none !important; box-shadow: inherit !important; transition: none !important;
        }
      `}</style>
      <DashboardContext.Provider value={{ ...ctx, cardAnimation: 'none' }}>
        <Card className={className} style={style} tilt={false}>{children}</Card>
      </DashboardContext.Provider>
    </div>
  );
};

// ─── Theme helpers — exact copy from StudentQA.tsx / LiveExam.tsx ─────────────

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
    inputBg: isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)',
    inputBorder: isLight ? 'rgba(0,0,0,0.10)' : `rgba(${hexRgb(primaryColor)},0.22)`,
    divider: isLight ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.06)',
    btnSecBg: isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.07)',
    btnSecBorder: isLight ? 'rgba(0,0,0,0.09)' : 'rgba(255,255,255,0.09)',
    danger: '#ef4444',
    green: '#22c55e',
    gold: '#f59e0b',
    purple2: '#8b5cf6',
    gradient: `linear-gradient(135deg,${primaryColor} 0%,${accentColor} 100%)`,
    // surface variants
    surfaceSm: isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.03)',
    borderSm: isLight ? '1px solid rgba(0,0,0,0.06)' : '1px solid rgba(255,255,255,0.06)',
  };
};

// ─── ModalShell — exact copy from StudentQA.tsx (portal-based themed modal) ──

import { createPortal } from 'react-dom';

const ModalShell = ({
  children,
  onClose,
  wide,
  maxWidth,
}: {
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
  maxWidth?: string;
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
        className={`w-full ${maxWidth ? maxWidth : wide ? 'max-w-3xl' : 'max-w-lg'}`}
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
        {/* Noise overlay */}
        <div style={{
          position: 'absolute', inset: 0, borderRadius: 'inherit', pointerEvents: 'none', zIndex: 0,
          background: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
          opacity: darkMode ? 0.04 : 0.025,
          mixBlendMode: 'overlay',
        }} />
        {/* Accent glow top */}
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
// Icon maps replacing emojis
import {
  ClipboardList, Crosshair, School,
  AlarmClock, FileText as PersonalIcon,
  Dumbbell, Briefcase, Palette, Users, Church, PartyPopper, Bus, Pin,
  CalendarPlus,
} from 'lucide-react';
import PageSkeleton from '../components/ui/PageSkeleton';

const TYPE_ICON: Record<string, any> = {
  assignment: ClipboardList, exam: Crosshair, class: School,
  study_session: BookOpen, deadline: AlarmClock, personal: PersonalIcon,
};
const CATEGORY_ICON: Record<string, any> = {
  sport: Dumbbell, job: Briefcase, hobby: Palette, family: Users,
  religious: Church, social: PartyPopper, transport: Bus, other: Pin,
};
const INSIGHT_STYLE: Record<string, { bg: string; icon: any; color: string }> = {
  warning:    { bg: 'bg-amber-500/10 border-amber-500/30',    icon: AlertOctagon, color: 'text-amber-400' },
  success:    { bg: 'bg-emerald-500/10 border-emerald-500/30', icon: CheckCircle2, color: 'text-emerald-400' },
  tip:        { bg: 'bg-blue-500/10 border-blue-500/30',      icon: Lightbulb,    color: 'text-blue-400' },
  motivation: { bg: 'bg-purple-500/10 border-purple-500/30',  icon: Heart,        color: 'text-purple-400' },
};
const POMODORO_DURATIONS = { focus: 25 * 60, short: 5 * 60, long: 15 * 60 };
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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
  const [aiConfig, setAiConfig] = useState<AIModelConfig | null>(null);

  // Help video
  const [helpVideoUrl, setHelpVideoUrl]         = useState('');
  const [showHelpPopup, setShowHelpPopup]       = useState(false);
  const [dontShowAgain, setDontShowAgain]       = useState(false);
  const HELP_POPUP_KEY = 'studyPlan_helpPopup_dismissed';

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

  // Schedule
  const [scheduleLoading, setScheduleLoading]     = useState(false);
  const [suggestions, setSuggestions]             = useState<ScheduledSession[]>([]);
  const [scheduleGoalStats, setScheduleGoalStats] = useState<GoalScheduleStats[]>([]);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [freeHoursPerDay, setFreeHoursPerDay]     = useState(4);
  const [freeTimeConfigured, setFreeTimeConfigured] = useState(false);
  const [addingSchedule, setAddingSchedule]       = useState(false);
  const [showFreeTimePanel, setShowFreeTimePanel] = useState(false);
  const [scheduleHash, setScheduleHash]           = useState('');
  const [cachedResult, setCachedResult]           = useState<ScheduleResult | null>(null);

  // Reschedule — global (all goals at once)
  const [showRescheduleModal, setShowRescheduleModal]   = useState(false);
  const [rescheduling, setRescheduling]                 = useState(false);
  const [reschedulePreview, setReschedulePreview]       = useState<ScheduledSession[]>([]);
  const [rescheduleGoalStats, setRescheduleGoalStats]   = useState<GoalScheduleStats[]>([]);
  const [addingReschedule, setAddingReschedule]         = useState(false);
  // Recovery — today-only replanning
  const [showRecoveryModal, setShowRecoveryModal]       = useState(false);
  const [recoveryPreview, setRecoveryPreview]           = useState<ScheduledSession[]>([]);
  const [recoveryApplying, setRecoveryApplying]         = useState(false);
  const [recoveryNoSlots, setRecoveryNoSlots]           = useState(false);
  const [recoveryUnscheduled, setRecoveryUnscheduled]   = useState<string[]>([]);
  // Free time input — 'hours' mode or 'range' mode
  const [freeTimeMode, setFreeTimeMode]                 = useState<'hours' | 'range'>('hours');
  const [freeTimeRanges, setFreeTimeRanges]             = useState<{ start: string; end: string }[]>([{ start: '14:00', end: '22:00' }]);
  const freeTimeStart = freeTimeRanges[0]?.start ?? '14:00';
  const freeTimeEnd   = freeTimeRanges[0]?.end   ?? '22:00';

  const rangeMinutes = (s: string, e: string) => {
    const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
    return Math.max(0, toMin(e) - toMin(s));
  };

  // Derived: effective free hours per day (used everywhere)
  const effectiveFreeHours = freeTimeMode === 'range'
    ? Math.max(1, Math.round(freeTimeRanges.reduce((sum, r) => sum + rangeMinutes(r.start, r.end), 0) / 60))
    : freeHoursPerDay;

  // Chat
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; content: string; calendarEvents?: CalendarEventFromChat[]; goals?: GoalFromChat[] }[]>([]);
  const [chatInput, setChatInput]       = useState('');
  const [chatLoading, setChatLoading]   = useState(false);
  const [pendingCalendarEvents, setPendingCalendarEvents] = useState<CalendarEventFromChat[]>([]);
  const [addingChatEvents, setAddingChatEvents] = useState(false);
  const [chatHistoryLoaded, setChatHistoryLoaded] = useState(false);
  // Pending goals created by Minerva via chat
  const [pendingGoals, setPendingGoals]       = useState<GoalFromChat[]>([]);
  const [addingChatGoals, setAddingChatGoals] = useState(false);
  // Chat image upload + OCR
  const [chatImageFile, setChatImageFile]         = useState<File | null>(null);
  const [chatImagePreview, setChatImagePreview]   = useState<string>('');
  const [chatImageText, setChatImageText]         = useState<string>('');
  const [chatImageOCRLoading, setChatImageOCRLoading] = useState(false);

  // ── Feature #3: Analytics AI connection ──────────────────────────────────────
  const [studyAnalytics, setStudyAnalytics]     = useState<StudyAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsLoaded, setAnalyticsLoaded]   = useState(false);

  // ── Feature #13: Streak freeze ───────────────────────────────────────────────
  const [streakFreezeCount, setStreakFreezeCount] = useState(0);
  const [freezeActiveUntil, setFreezeActiveUntil] = useState<Date | null>(null);
  const [showFreezePrompt, setShowFreezePrompt]   = useState(false);

  // ── Feature #14: Goal completion celebration ─────────────────────────────────
  const [celebratingGoal, setCelebratingGoal] = useState<StudyGoal | null>(null);

  // ── Feature #15: List sub-view (upcoming ↔ history) ─────────────────────────
  const [listSubView, setListSubView]   = useState<'upcoming' | 'history'>('upcoming');
  const [historySearch, setHistorySearch] = useState('');

  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatImageInputRef = useRef<HTMLInputElement>(null);
  const dayEventsRef = useRef<HTMLDivElement>(null); // scroll to day events on calendar click
  // Load free time prefs from Firestore (per user)
  useEffect(() => {
    if (!user) return;
    studyPlanService.getFreeTimePrefs(user.uid).then(prefs => {
      if (prefs) {
        setFreeTimeMode(prefs.mode);
        setFreeHoursPerDay(prefs.hours);
        if (prefs.ranges.length > 0) setFreeTimeRanges(prefs.ranges);
        setFreeTimeConfigured(true);
        // Sync saved snapshot so label matches stored data
        setSavedFreeTimeMode(prefs.mode);
        setSavedFreeTimeHours(
          prefs.mode === 'range' && prefs.ranges.length > 0
            ? Math.max(1, Math.round(prefs.ranges.reduce((sum: number, r: { start: string; end: string }) => {
                const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
                return sum + Math.max(0, toMin(r.end) - toMin(r.start));
              }, 0) / 60))
            : prefs.hours
        );
        setSavedFreeTimeRangesCount(prefs.ranges.length || 1);
      }
    }).catch(() => {});
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Save free time prefs to Firestore — called explicitly via Save button
  const [freeTimeSaving, setFreeTimeSaving] = useState(false);
  const [freeTimeSaved, setFreeTimeSaved]   = useState(false);
  // Snapshot of last-SAVED free time — used in header label so unsaved edits don't show
  const [savedFreeTimeHours, setSavedFreeTimeHours]           = useState(4);
  const [savedFreeTimeRangesCount, setSavedFreeTimeRangesCount] = useState(1);
  const [savedFreeTimeMode, setSavedFreeTimeMode]             = useState<'hours' | 'range'>('hours');
  const handleSaveFreeTime = async () => {
    if (!user) return;
    setFreeTimeSaving(true);
    try {
      await studyPlanService.saveFreeTimePrefs(user.uid, { mode: freeTimeMode, hours: freeHoursPerDay, ranges: freeTimeRanges });
      setFreeTimeConfigured(true);
      // Snapshot saved values so the label reflects what's actually stored
      setSavedFreeTimeHours(effectiveFreeHours);
      setSavedFreeTimeRangesCount(freeTimeRanges.length);
      setSavedFreeTimeMode(freeTimeMode);
      setFreeTimeSaved(true);
      setTimeout(() => { setFreeTimeSaved(false); setShowFreeTimePanel(false); }, 900);
    } catch { } finally { setFreeTimeSaving(false); }
  };

  // Pomodoro
  const [pomodoroActive, setPomodoroActive]     = useState(false);
  const [pomodoroMode, setPomodoroMode]         = useState<'focus' | 'short' | 'long'>('focus');
  const [pomodoroTime, setPomodoroTime]         = useState(POMODORO_DURATIONS.focus);
  const [pomodoroSubject, setPomodoroSubject]   = useState('');
  const [pomodoroLinkedEvent, setPomodoroLinkedEvent] = useState(''); // event id to auto-mark progress
  const [pomodoroSessionCount, setPomodoroSessionCount] = useState(0); // focus sessions this sitting
  const [pomodoroPhase, setPomodoroPhase]       = useState<'idle' | 'focus' | 'break'>('idle');
  const [pomodoroTodayMinutes, setPomodoroTodayMinutes] = useState(0);
  const [pomodoroStartTime, setPomodoroStartTime] = useState<Date | null>(null);
  const [pomodoroSoundEnabled, setPomodoroSoundEnabled] = useState(true);
  const pomodoroRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioCtxRef   = useRef<AudioContext | null>(null);

  // Goals form
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [newGoal, setNewGoal] = useState({ subject: '', targetDate: '', hoursNeeded: 10, difficulty: 'medium' as StudyGoal['difficulty'] });
  const [savingGoal, setSavingGoal] = useState(false);
  // NEW: Goal mode and topic state
  const [goalMode, setGoalMode]           = useState<GoalMode>('simple');
  const [goalStudyMode, setGoalStudyMode] = useState<'first_reading' | 'revision'>('first_reading');
  const [manualTopics, setManualTopics]   = useState<SelectedTopicItem[]>([]);
  const [topicInput, setTopicInput]       = useState({ name: '', minHours: 1, maxHours: 2, difficulty: 'medium' as SelectedTopicItem['difficulty'] });
  const [ctCourseId, setCtCourseId]           = useState('');
  const [ctGroups, setCtGroups]               = useState<TopicGroup[]>([]);
  const [ctLoadingGroups, setCtLoadingGroups] = useState(false);
  const [ctSelSubjects, setCtSelSubjects]     = useState<Set<string>>(new Set());
  const [ctSelChapters, setCtSelChapters]     = useState<Set<string>>(new Set());
  const [ctSelTopics, setCtSelTopics]         = useState<Set<string>>(new Set());
  const [ctExpandedSubjects, setCtExpandedSubjects] = useState<Set<string>>(new Set());
  const [ctExpandedChapters, setCtExpandedChapters] = useState<Set<string>>(new Set());
  // Goal editing
  const [editingGoal, setEditingGoal]   = useState<StudyGoal | null>(null);
  const [editGoalData, setEditGoalData] = useState({ subject: '', targetDate: '', hoursNeeded: 10, difficulty: 'medium' as StudyGoal['difficulty'] });
  const [savingEditGoal, setSavingEditGoal] = useState(false);
  // Edit-mode form state (separate from creation form so they don't share state)
  const [editGoalMode, setEditGoalMode]           = useState<GoalMode>('simple');
  const [editGoalStudyMode, setEditGoalStudyMode] = useState<'first_reading' | 'revision'>('first_reading');
  const [editManualTopics, setEditManualTopics]   = useState<SelectedTopicItem[]>([]);
  const [editTopicInput, setEditTopicInput]       = useState({ name: '', minHours: 1, maxHours: 2, difficulty: 'medium' as SelectedTopicItem['difficulty'] });
  const [editCtGroups, setEditCtGroups]               = useState<TopicGroup[]>([]);
  const [editCtLoadingGroups, setEditCtLoadingGroups] = useState(false);
  const [editCtSelTopics, setEditCtSelTopics]         = useState<Set<string>>(new Set());
  const [editCtSelChapters, setEditCtSelChapters]     = useState<Set<string>>(new Set());
  const [editCtSelSubjects, setEditCtSelSubjects]     = useState<Set<string>>(new Set());
  const [editCtExpandedSubjects, setEditCtExpandedSubjects] = useState<Set<string>>(new Set());
  const [editCtExpandedChapters, setEditCtExpandedChapters] = useState<Set<string>>(new Set());
  // Activity editing
  const [editingActivity, setEditingActivity]   = useState<CustomActivity | null>(null);
  const [editActivityData, setEditActivityData] = useState({
    name: '', category: 'other' as CustomActivity['category'],
    scheduleType: 'recurring' as 'recurring' | 'specific_dates',
    daysOfWeek: [] as number[], specificDates: [] as string[],
    startTime: '08:00', endTime: '09:00', isFlexible: false, notes: '',
  });
  const [savingEditActivity, setSavingEditActivity] = useState(false);

  // ── Topic-based goal helpers (NEW) ──────────────────────────────────────────

  const selectedCourseTopics = useMemo<SelectedTopicItem[]>(() => {
    const items: SelectedTopicItem[] = [];
    for (const grp of ctGroups) {
      for (const subj of grp.subjects) {
        if (ctSelSubjects.size > 0 && !ctSelSubjects.has(subj.id)) continue;
        for (const chap of subj.chapters) {
          if (ctSelChapters.size > 0 && !ctSelChapters.has(chap.id)) continue;
          for (const topic of chap.topics) {
            if (ctSelTopics.size > 0 && !ctSelTopics.has(topic.id)) continue;
            items.push({ id: topic.id, name: topic.name, minHours: topic.minHours, maxHours: topic.maxHours, difficulty: topic.difficulty, chapterName: chap.name, subjectName: subj.name });
          }
        }
      }
    }
    return items;
  }, [ctGroups, ctSelSubjects, ctSelChapters, ctSelTopics]);

  const activeTopics    = goalMode === 'topic' ? manualTopics : goalMode === 'course' ? selectedCourseTopics : [];
  const calculatedHoursRange = activeTopics.length > 0 ? calcHoursRange(activeTopics) : null;
  const calculatedHours      = activeTopics.length > 0 ? calcTotalHoursFromTopics(activeTopics, goalStudyMode) : 0;

  // Edit-mode course topic selection (mirrors creation-form selectedCourseTopics)
  const editSelectedCourseTopics = useMemo<SelectedTopicItem[]>(() => {
    const items: SelectedTopicItem[] = [];
    for (const grp of editCtGroups) {
      for (const subj of grp.subjects) {
        for (const chap of subj.chapters) {
          for (const topic of chap.topics) {
            if (editCtSelTopics.has(topic.id)) {
              items.push({ id: topic.id, name: topic.name, minHours: topic.minHours, maxHours: topic.maxHours, difficulty: topic.difficulty, chapterName: chap.name, subjectName: subj.name });
            }
          }
        }
      }
    }
    return items;
  }, [editCtGroups, editCtSelTopics]);

  const editActiveTopics         = editGoalMode === 'topic' ? editManualTopics : editGoalMode === 'course' ? editSelectedCourseTopics : [];
  const editCalculatedHoursRange = editActiveTopics.length > 0 ? calcHoursRange(editActiveTopics) : null;
  const editCalculatedHours      = editActiveTopics.length > 0 ? calcTotalHoursFromTopics(editActiveTopics, editGoalStudyMode) : 0;

  const loadCourseTopics = async (courseId: string) => {
    if (!courseId) { setCtGroups([]); setNewGoal(p => ({ ...p, subject: '' })); return; }
    // Auto-set subject from selected course name
    const course = enrolledCourses.find(c => c.courseId === courseId);
    if (course) setNewGoal(p => ({ ...p, subject: course.title }));
    setCtLoadingGroups(true);
    try {
      const groups = await topicGroupService.getGroupsByCourse(courseId);
      setCtGroups(groups);
      setCtSelSubjects(new Set()); setCtSelChapters(new Set()); setCtSelTopics(new Set());
      setCtExpandedSubjects(new Set()); setCtExpandedChapters(new Set());
    } catch { setCtGroups([]); }
    finally { setCtLoadingGroups(false); }
  };

  /**
   * Load course topic groups for edit mode, then pre-select topics that the
   * goal currently has (matched by topic id).
   */
  const loadEditCourseTopics = async (courseId: string, existingTopicIds: string[]) => {
    if (!courseId) { setEditCtGroups([]); return; }
    setEditCtLoadingGroups(true);
    try {
      const groups = await topicGroupService.getGroupsByCourse(courseId);
      setEditCtGroups(groups);
      const ids = new Set(existingTopicIds);
      const selTopics   = new Set<string>();
      const selChapters = new Set<string>();
      const selSubjects = new Set<string>();
      for (const grp of groups) {
        for (const subj of grp.subjects) {
          let subjSel = false;
          for (const chap of subj.chapters) {
            const chapTopicIds = chap.topics.map(t => t.id);
            const chapSel = chapTopicIds.some(id => ids.has(id));
            if (chapSel) {
              chapTopicIds.filter(id => ids.has(id)).forEach(id => selTopics.add(id));
              selChapters.add(chap.id);
              subjSel = true;
            }
          }
          if (subjSel) selSubjects.add(subj.id);
        }
      }
      setEditCtSelTopics(selTopics);
      setEditCtSelChapters(selChapters);
      setEditCtSelSubjects(selSubjects);
      setEditCtExpandedSubjects(selSubjects);
      setEditCtExpandedChapters(selChapters);
    } catch { setEditCtGroups([]); }
    finally { setEditCtLoadingGroups(false); }
  };

  const resetGoalForm = () => {
    setNewGoal({ subject: '', targetDate: '', hoursNeeded: 10, difficulty: 'medium' });
    setGoalMode('simple'); setGoalStudyMode('first_reading');
    setManualTopics([]); setTopicInput({ name: '', minHours: 1, maxHours: 2, difficulty: 'medium' });
    setCtCourseId(''); setCtGroups([]);
    setCtSelSubjects(new Set()); setCtSelChapters(new Set()); setCtSelTopics(new Set());
    setCtExpandedSubjects(new Set()); setCtExpandedChapters(new Set());
    setShowGoalForm(false);
  };

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

      // Compute real streak from all 4 activity sources (lessons, live class,
      // calendar events, pomodoro) — same logic as the dashboard KPI.
      // getStreak() is still fetched for totalSessions + longest streak metadata.
      const realCurrentStreak = await studyPlanService.computeRealStreak(user.uid);

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

      // Auto-handle expired goals:
      // - Goal deadline passed but < 12h ago  → mark its sessions as expired
      // - Goal deadline passed and >= 12h ago → delete goal + all its sessions
      const nowMs = Date.now();
      const twelveHoursMs = 12 * 60 * 60 * 1000;
      const passedGoals = gls.filter(g => g.isActive && g.targetDate.getTime() < nowMs);
      const autoDeleteGoals = passedGoals.filter(g => nowMs - g.targetDate.getTime() >= twelveHoursMs);
      const justExpiredGoals = passedGoals.filter(g => nowMs - g.targetDate.getTime() < twelveHoursMs);

      if (justExpiredGoals.length > 0) {
        await studyPlanService.markGoalSessionsExpired(user.uid, justExpiredGoals.map(g => g.subject)).catch(() => {});
        // Reflect expired flag in local event state without re-fetching
        const expiredSubjects = justExpiredGoals.flatMap(g => {
          const base = g.subject.split(' (')[0];
          return [g.subject, base];
        });
        evts = evts.map(e =>
          e.isAIGenerated && e.isPersonal &&
          expiredSubjects.some(s => e.course === s || e.course?.startsWith(s))
            ? { ...e, expired: true }
            : e
        );
      }

      if (autoDeleteGoals.length > 0) {
        await Promise.all(autoDeleteGoals.map(async g => {
          await studyPlanService.deleteAllAISessionsForGoalFromFirestore(user.uid, [g.subject]).catch(() => {});
          await studyPlanService.deleteGoal(g.id).catch(() => {});
        }));
        const deletedGoalSubjects = autoDeleteGoals.flatMap(g => {
          const base = g.subject.split(' (')[0];
          return [g.subject, base];
        });
        gls = gls.filter(g => !autoDeleteGoals.some(ag => ag.id === g.id));
        evts = evts.filter(e => !(
          e.isAIGenerated && e.isPersonal &&
          deletedGoalSubjects.some(s => e.course === s || e.course?.startsWith(s))
        ));
      }

      setEvents(evts);
      setGoals(gls);
      setCustomActivities(acts);
      setEnrolledCourses(courses);
      if (stk) setStreak({ current: realCurrentStreak, longest: stk.longestStreak, totalSessions: stk.totalSessions });
      else setStreak(prev => ({ ...prev, current: realCurrentStreak }));
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

  // Load help video URL and decide whether to show popup
  useEffect(() => {
    if (!user) return;
    studyPlanService.getHelpVideoUrl().then(url => {
      if (!url) return;
      setHelpVideoUrl(url);
      // Show popup unless user previously dismissed it with "don't show again",
      // or within last 3 days (so it re-appears after a while for new users who didn't dismiss)
      const dismissed = localStorage.getItem(HELP_POPUP_KEY);
      if (dismissed === 'forever') return;
      const lastShown = dismissed ? parseInt(dismissed, 10) : 0;
      const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
      if (!lastShown || Date.now() - lastShown > threeDaysMs) {
        setShowHelpPopup(true);
      }
    });
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (user) loadAll(); }, [user, loadAll]);

  // ── Feature #13: Load streak freeze count from Firestore ─────────────────
  useEffect(() => {
    if (!user) return;
    const t = setTimeout(() => {
      studyPlanService.getStreakFreeze(user.uid, streak.current)
        .then(({ count, activeUntil }) => { setStreakFreezeCount(count); setFreezeActiveUntil(activeUntil); })
        .catch(() => {
          setTimeout(() => {
            studyPlanService.getStreakFreeze(user.uid, streak.current)
              .then(({ count, activeUntil }) => { setStreakFreezeCount(count); setFreezeActiveUntil(activeUntil); })
              .catch(() => {});
          }, 2000);
        });
    }, 500);
    return () => clearTimeout(t);
  }, [user, streak.current]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Feature #14: Check for newly completed goals → celebration ───────────────
  useEffect(() => {
    if (!user || goals.length === 0) return;
    const key = `studyPlan_celebrated_${user.uid}`;
    try {
      const celebrated: string[] = JSON.parse(localStorage.getItem(key) || '[]');
      const newlyDone = goals.find(g => g.currentProgress >= 100 && !celebrated.includes(g.id));
      if (newlyDone && !celebratingGoal) {
        setCelebratingGoal(newlyDone);
        localStorage.setItem(key, JSON.stringify([...celebrated, newlyDone.id]));
        notificationService.createNotification({
          userId: user.uid,
          title: 'Goal Complete! 🎉',
          message: `You finished "${newlyDone.subject}". Excellent work — keep the momentum going!`,
          type: 'system',
          priority: 'high',
          relatedId: newlyDone.id,
          isPermanent: true,
          relatedType: 'studyGoal',
          metadata: { subject: newlyDone.subject },
        });
      }
    } catch {}
  }, [goals, user]); // eslint-disable-line react-hooks/exhaustive-deps

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
  }, [events, aiReady, user]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Feature #3: Load AI study analytics when analytics tab opens ─────────────
  useEffect(() => {
    if (view === 'analytics' && aiReady && !analyticsLoaded && !analyticsLoading && user && events.length > 0) {
      setAnalyticsLoading(true);
      aiStudyPlannerService.analyzeStudyPatterns(
        [],
        events.map(e => ({ date: e.date, eventType: e.eventType, course: e.course || '', isPersonal: !!e.isPersonal }))
      ).then(res => { setStudyAnalytics(res); setAnalyticsLoaded(true); })
       .catch(() => {})
       .finally(() => setAnalyticsLoading(false));
    }
  }, [view, aiReady, analyticsLoaded, analyticsLoading, user, events]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const thisWeekEvents    = events.filter(e => { const n = new Date(); return e.date >= startOfWeek(n) && e.date <= endOfWeek(n); });
  const todayEvents       = events.filter(e => isToday(e.date));
  const dayEvents         = events.filter(e => e.date.toDateString() === selectedDate.toDateString());
  // True once an AI plan has been generated — drives "AI Schedule" → "Reschedule" button
  const hasExistingAIPlan = events.some(e => e.isAIGenerated && e.isPersonal && e.studentId === user?.uid);

  // ── Feature #11: Subject-wise completion breakdown ────────────────────────────
  const subjectBreakdown = useMemo(() => {
    const map: Record<string, { total: number; completed: number }> = {};
    events.forEach(ev => {
      const subj = ev.course || ev.eventType.replace('_', ' ');
      if (!map[subj]) map[subj] = { total: 0, completed: 0 };
      map[subj].total++;
      if (ev.completed) map[subj].completed++;
    });
    return Object.entries(map)
      .map(([subject, { total, completed }]) => ({
        subject,
        total,
        completed,
        rate: total > 0 ? Math.round((completed / total) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10); // cap at 10 subjects
  }, [events]);

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

  /**
   * Toggle session complete/incomplete.
   * Also syncs the linked goal's hoursCompleted and currentProgress in Firestore
   * so the progress bar always reflects real study time — not just a % estimate.
   */
  const handleToggleComplete = async (ev: StudyPlanEvent) => {
    try {
      const nowCompleted = !ev.completed;
      // Optimistic UI update
      setEvents(prev => prev.map(e => e.id === ev.id
        ? { ...e, completed: nowCompleted, completionPercent: nowCompleted ? 100 : 0, completedAt: nowCompleted ? new Date() : undefined }
        : e));
      await studyPlanService.markEventComplete(ev.id, nowCompleted);

      // Sync goal progress after the events state settles with the new value
      const updatedEvents = events.map(e => e.id === ev.id
        ? { ...e, completed: nowCompleted, completionPercent: nowCompleted ? 100 : 0 }
        : e);
      if (ev.isAIGenerated && ev.isPersonal && ev.course) {
        const linkedGoal = goals.find(g => {
          const base = g.subject.split(' (')[0].toLowerCase();
          const course = (ev.course || '').toLowerCase();
          return course === base || course.startsWith(base) || base.startsWith(course);
        });
        if (linkedGoal) {
          const update = computeGoalProgressUpdate(linkedGoal, updatedEvents);
          setGoals(prev => prev.map(g => g.id === linkedGoal.id
            ? { ...g, hoursCompleted: update.hoursCompleted, currentProgress: update.currentProgress }
            : g));
          await studyPlanService.updateGoal(linkedGoal.id, update).catch(() => {});
        }
      }
    } catch (e: any) {
      setError(e.message);
      await loadAll(); // reload on error to reset optimistic state
    }
  };

  /**
   * Set partial % on a session — optimistic update + goal progress sync.
   * Clicking the active segment resets to 0 (undo partial).
   */
  const handleUpdateCompletionPercent = async (ev: StudyPlanEvent, pct: number) => {
    const next = (ev.completionPercent || 0) === pct ? 0 : pct;
    const updatedEv = { ...ev, completionPercent: next, completed: next === 100 };

    // Optimistic events update
    const updatedEvents = events.map(e => e.id === ev.id ? updatedEv : e);
    setEvents(updatedEvents);

    try {
      await studyPlanService.updateEventCompletionPercent(ev.id, next);

      // Sync linked goal progress
      if (ev.isAIGenerated && ev.isPersonal && ev.course) {
        const linkedGoal = goals.find(g => {
          const base   = g.subject.split(' (')[0].toLowerCase();
          const course = (ev.course || '').toLowerCase();
          return course === base || course.startsWith(base) || base.startsWith(course);
        });
        if (linkedGoal) {
          const update = computeGoalProgressUpdate(linkedGoal, updatedEvents);
          setGoals(prev => prev.map(g => g.id === linkedGoal.id
            ? { ...g, hoursCompleted: update.hoursCompleted, currentProgress: update.currentProgress }
            : g));
          await studyPlanService.updateGoal(linkedGoal.id, update).catch(() => {});
        }
      }
    } catch (e: any) {
      // Roll back events on error
      setEvents(prev => prev.map(e => e.id === ev.id
        ? { ...e, completionPercent: ev.completionPercent, completed: ev.completed }
        : e));
      setError(e.message);
    }
  };

  // ── AI Schedule ─────────────────────────────────────────────────────────────

  // Fix #1: stable hash of inputs — skip AI if nothing changed
  const computeScheduleHash = () => JSON.stringify({
    today: new Date().toISOString().slice(0, 10), // bust cache daily
    freeHours: effectiveFreeHours,
    freeMode: freeTimeMode,
    freeRanges: freeTimeMode === 'range' ? freeTimeRanges : [],
    goals: goals.map(g => ({ s: g.subject, t: g.targetDate.toISOString().slice(0, 10), h: g.hoursNeeded, d: g.difficulty, p: g.currentProgress })),
    activities: customActivities.map(a => ({ n: a.name, days: a.daysOfWeek, st: a.startTime, et: a.endTime })),
  });

  const handleGenerateSchedule = () => {
    if (!goals.length || scheduleLoading) return;

    const hash = computeScheduleHash();
    if (hash === scheduleHash && cachedResult && cachedResult.sessions.length > 0) {
      setSuggestions(cachedResult.sessions);
      setScheduleGoalStats(cachedResult.goalStats);
      setShowScheduleModal(true);
      return;
    }

    setScheduleLoading(true);
    try {
      const result = generateStudySchedule({
        goals,
        existingEvents: events,
        customActivities,
        freeTimeMode,
        freeHoursPerDay: effectiveFreeHours,
        freeTimeRanges,
        now: new Date(),
        studentId: user?.uid ?? '',
      });

      if (result.sessions.length === 0) {
        setError('No sessions could be scheduled — check your free time settings or goal deadlines.');
        return;
      }

      setSuggestions(result.sessions);
      setScheduleGoalStats(result.goalStats);
      setCachedResult(result);
      setScheduleHash(hash);
      setShowScheduleModal(true);
    } catch (e: any) { setError('Schedule error: ' + e.message); }
    finally { setScheduleLoading(false); }
  };

  const handleAcceptSchedule = async () => {
    if (!user || addingSchedule) return;
    setAddingSchedule(true);
    try {
      // Nuclear wipe: clear ALL uncompleted AI events before creating the new plan.
      // No subject filter — prevents duplicates even if subjects changed.
      await studyPlanService.clearAllStudentAIEventsFromFirestore(user.uid);
      await studyPlanService.createBulkAIEvents(
        (suggestions as any[]).map(s => ({
          title:       s.title,
          description: s.reason,
          date:        s.date instanceof Date ? s.date : new Date(s.date),
          startTime:   s.startTime,
          endTime:     s.endTime,
          course:      s.subject,
          instructorId:     user.uid,
          instructorName:   user.displayName || (user as any).name || '',
          isPersonal:       true,
          studentId:        user.uid,
          targetAudience:   'specific_student' as const,
          targetStudentIds: [user.uid],
          targetCourseIds:  [],
          eventType:        'study_session' as const,
          priority:         s.priority    || 'medium',
          isAIGenerated:    true,
          aiReason:         s.reason      || '',
          aiTips:           s.tips        || [],
          sessionType:      s.sessionType || 'focus',
          completed:        false,
          completionPercent: 0,
          ...(s.topicNames?.length    ? { topicNames: s.topicNames }       : {}),
          ...((s as any).topicContext?.length ? { topicContext: (s as any).topicContext } : {}),
        })), user.uid
      );
      setShowScheduleModal(false);
      setSuggestions([]);
      setScheduleHash(''); // reset so next change triggers fresh AI call
      notificationService.createNotification({
        userId: user.uid,
        title: 'Study Schedule Created',
        message: `Your AI study schedule has been added to your calendar with ${suggestions.length} session${suggestions.length !== 1 ? 's' : ''}.`,
        type: 'system',
        priority: 'low',
        isPermanent: false,
        relatedType: 'studySchedule',
        metadata: { sessionCount: suggestions.length },
      });
      await loadAll();
    } catch (e: any) { setError(e.message); }
    finally { setAddingSchedule(false); }
  };

  // ── Goals ────────────────────────────────────────────────────────────────────

  const handleAddGoal = async () => {
    if (!user || !newGoal.subject || !newGoal.targetDate || savingGoal) return;
    setSavingGoal(true);
    try {
      const hasTopics = goalMode !== 'simple' && activeTopics.length > 0;
      const hours = hasTopics ? Math.max(1, calculatedHours) : newGoal.hoursNeeded;
      let difficulty = newGoal.difficulty;
      if (hasTopics) {
        const counts = { easy: 0, medium: 0, hard: 0 };
        activeTopics.forEach(t => counts[t.difficulty]++);
        difficulty = (Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]) as StudyGoal['difficulty'];
      }
      await studyPlanService.createGoal({
        studentId: user.uid, subject: newGoal.subject,
        targetDate: new Date(newGoal.targetDate + 'T12:00:00'),
        hoursNeeded: hours, hoursCompleted: 0,
        difficulty, currentProgress: 0, isActive: true,
        ...(hasTopics ? { topics: activeTopics, studyMode: goalStudyMode } : {}),
        ...(goalMode === 'course' && ctCourseId ? { courseId: ctCourseId } : {}),
      });
      notificationService.createNotification({
        userId: user.uid,
        title: 'Study Goal Added',
        message: `Your goal for "${newGoal.subject}" has been added. Generate your AI schedule to get started.`,
        type: 'system',
        priority: 'low',
        isPermanent: false,
        relatedType: 'studyGoal',
        metadata: { subject: newGoal.subject },
      });
      resetGoalForm();
      setGoals(await studyPlanService.getGoalsForStudent(user.uid));
    } catch (e: any) { setError(e.message); }
    finally { setSavingGoal(false); }
  };

  const handleAddGoalFromCourse = async (course: EnrolledCourseForPlanning) => {
    if (!user) return;
    if (goals.some(g => g.subject === course.title || g.subject.startsWith(course.title + ' ('))) {
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
    if (!confirm('Delete this goal? All AI-planned sessions for this goal will also be removed.')) return;
    try {
      const goal = goals.find(g => g.id === id);
      await studyPlanService.deleteGoal(id);
      if (goal && user) {
        // deleteAllAISessionsForGoalFromFirestore removes ALL sessions (including completed)
        await studyPlanService.deleteAllAISessionsForGoalFromFirestore(user.uid, [goal.subject]);
      }
      await loadAll();
    } catch { /* silent */ }
  };

  const handleOpenEditGoal = (g: StudyGoal) => {
    // Detect goal type from stored data
    const mode: GoalMode = g.topics?.length
      ? (g.courseId ? 'course' : 'topic')
      : 'simple';

    setEditingGoal(g);
    setEditGoalMode(mode);
    setEditGoalStudyMode(g.studyMode ?? 'first_reading');
    setEditGoalData({
      subject:     g.subject,
      targetDate:  g.targetDate.toISOString().slice(0, 10),
      hoursNeeded: g.hoursNeeded,
      difficulty:  g.difficulty,
    });

    if (mode === 'topic') {
      setEditManualTopics(g.topics ?? []);
      setEditTopicInput({ name: '', minHours: 1, maxHours: 2, difficulty: 'medium' });
    } else if (mode === 'course' && g.courseId) {
      const existingIds = (g.topics ?? []).map(t => t.id);
      loadEditCourseTopics(g.courseId, existingIds);
    }
  };

  const handleSaveEditGoal = async () => {
    if (!editingGoal || !editGoalData.targetDate || savingEditGoal) return;
    // Validate subject for non-course modes
    if (editGoalMode !== 'course' && !editGoalData.subject) return;

    setSavingEditGoal(true);
    try {
      const hasTopics =
        (editGoalMode === 'topic'  && editManualTopics.length > 0) ||
        (editGoalMode === 'course' && editSelectedCourseTopics.length > 0);

      const finalTopics  = editGoalMode === 'topic'  ? editManualTopics
                         : editGoalMode === 'course' ? editSelectedCourseTopics
                         : undefined;

      const finalHours   = hasTopics
        ? calcTotalHoursFromTopics(finalTopics!, editGoalStudyMode)
        : editGoalData.hoursNeeded;

      const finalSubject = editGoalMode === 'course'
        ? (enrolledCourses.find(c => c.courseId === editingGoal.courseId)?.title ?? editGoalData.subject)
        : editGoalData.subject;

      await studyPlanService.updateGoal(editingGoal.id, {
        subject:    finalSubject,
        targetDate: new Date(editGoalData.targetDate + 'T12:00:00'),
        hoursNeeded: finalHours,
        difficulty:  editGoalData.difficulty,
        ...(hasTopics ? { topics: finalTopics, studyMode: editGoalStudyMode } : { topics: [] }),
        ...(editGoalMode === 'course' && editingGoal.courseId ? { courseId: editingGoal.courseId } : {}),
      });
      setEditingGoal(null);
      setGoals(await studyPlanService.getGoalsForStudent(user!.uid));
      setScheduleHash('');
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
    // Partial sessions = not completed but have some % progress
    const partialSessions    = goalEvents.filter(e => !e.completed && (e.completionPercent || 0) > 0);
    // Weighted completion: completed=1, partial=fractional
    const weightedDone       = completedSessions + partialSessions.reduce((sum, e) => sum + (e.completionPercent || 0) / 100, 0);
    const pastSessions       = goalEvents.filter(e => e.date < now).length;
    const remainingSessions  = goalEvents.filter(e => !e.completed && e.date >= now).length;
    const completedPast      = goalEvents.filter(e => e.completed && e.date < now).length;
    // "Behind" if past sessions exist that are neither completed nor partially worked on
    const partialPast        = goalEvents.filter(e => e.date < now && !e.completed && (e.completionPercent || 0) > 0).length;
    const behind             = totalSessions > 0 && pastSessions > 0 && (completedPast + partialPast) < pastSessions;
    const missedSessions     = Math.max(0, pastSessions - completedPast - partialPast);
    const daysLeft           = differenceInDays(goal.targetDate, now);
    // Session rate uses weighted completion so partial work shows on the bar
    const sessionRate        = totalSessions > 0 ? Math.round((weightedDone / totalSessions) * 100) : 0;
    return {
      goalEvents, completedSessions, totalSessions, pastSessions, remainingSessions,
      completedPast, behind, missedSessions, daysLeft, sessionRate,
      partialSessions: partialSessions.length, weightedDone,
    };
  };

  // ── Reschedule (Global — all goals) ─────────────────────────────────────────

  const handleOpenReschedule = () => {
    setReschedulePreview([]);
    setShowRescheduleModal(true);
  };

  const handleGenerateReschedule = () => {
    if (rescheduling || goals.length === 0) return;
    setRescheduling(true);
    try {
      // For reschedule preview: strip out uncompleted AI sessions before computing.
      // The real wipe happens in handleAcceptReschedule, but we need the scheduler
      // to see only completed sessions (for hours done + session numbering) and
      // non-AI events (for conflict avoidance). Without this, computeGoalWork()
      // counts uncompleted session durations as already-done hours → hoursLeft=0
      // → "Nothing left to schedule" even though no work has been done yet.
      const eventsForReschedule = events.filter(
        e => !(e.isAIGenerated && e.isPersonal && !e.completed)
      );
      const result = rescheduleStudyPlan({
        goals,
        existingEvents: eventsForReschedule,
        customActivities,
        freeTimeMode,
        freeHoursPerDay: effectiveFreeHours,
        freeTimeRanges,
        now: new Date(),
        studentId: user?.uid ?? '',
      });

      if (result.sessions.length === 0) {
        setError('Nothing left to schedule — all goals may be complete or past deadline.');
        return;
      }

      setReschedulePreview(result.sessions);
      setRescheduleGoalStats(result.goalStats);
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
      // Step 1: Nuclear wipe — delete ALL uncompleted AI events for this student.
      // We deliberately pass NO subject filter so stale sessions from renamed/deleted goals
      // are also removed, preventing duplicates entirely. Completed sessions are safe because
      // clearAllStudentAIEventsFromFirestore only touches completed=false documents.
      await studyPlanService.clearAllStudentAIEventsFromFirestore(user.uid);

      // Step 2: Create the new scheduled sessions (ScheduledSession shape from algorithm)
      await studyPlanService.createBulkAIEvents(
        (reschedulePreview as unknown as ScheduledSession[]).map(s => ({
          title:       s.title,
          description: s.reason,
          date:        s.date instanceof Date ? s.date : new Date(s.date),
          startTime:   s.startTime,
          endTime:     s.endTime,
          course:      s.subject,
          instructorId:       user.uid,
          instructorName:     user.displayName || (user as any).name || '',
          isPersonal:         true,
          studentId:          user.uid,
          targetAudience:     'specific_student' as const,
          targetStudentIds:   [user.uid],
          targetCourseIds:    [],
          eventType:          'study_session' as const,
          priority:           s.priority,
          isAIGenerated:      true,
          aiReason:           s.reason,
          aiTips:             [],
          sessionType:        s.sessionType,
          completed:          false,
          completionPercent:  0,
          ...(s.topicNames?.length    ? { topicNames: s.topicNames }       : {}),
          ...((s as any).topicContext?.length ? { topicContext: (s as any).topicContext } : {}),
        })),
        user.uid
      );

      // Step 3: Also update goal progress fields to reflect current reality
      await Promise.all(goals.map(async g => {
        const prog = getGoalAIProgress(g);
        if (prog.completedSessions > 0) {
          const newProgress = Math.max(
            g.currentProgress,
            Math.round((prog.completedSessions / Math.max(prog.totalSessions, 1)) * 100)
          );
          if (newProgress > g.currentProgress) {
            await studyPlanService.updateGoal(g.id, { currentProgress: newProgress }).catch(() => {});
          }
        }
      }));

      setShowRescheduleModal(false);
      setReschedulePreview([]);
      setRescheduleGoalStats([]);
      setScheduleHash('');
      setCachedResult(null);
      notificationService.createNotification({
        userId: user.uid,
        title: 'Study Plan Rescheduled',
        message: `Your study plan has been rescheduled with ${reschedulePreview.length} session${reschedulePreview.length !== 1 ? 's' : ''} across your remaining goals.`,
        type: 'system',
        priority: 'low',
        isPermanent: false,
        relatedType: 'studySchedule',
        metadata: { sessionCount: reschedulePreview.length },
      });
      await loadAll();
    } catch (e: any) {
      setError('Failed to apply reschedule: ' + e.message);
    } finally {
      setAddingReschedule(false);
    }
  };

  // ── Recovery Plan (Today-only) ────────────────────────────────────────────
  const handleOpenRecovery = () => {
    if (!user || goals.length === 0) return;
    const eventsForReschedule = events.filter(e => !(e.isAIGenerated && e.isPersonal && !e.completed));
    const { sessions, hasSlots, unscheduledSubjects } = recoverTodayPlan({
      goals,
      existingEvents: eventsForReschedule,
      customActivities,
      freeTimeMode,
      freeHoursPerDay: effectiveFreeHours,
      freeTimeRanges,
      now: new Date(),
      studentId: user.uid,
    });
    setRecoveryPreview(sessions);
    setRecoveryNoSlots(!hasSlots);
    setRecoveryUnscheduled(unscheduledSubjects);
    setShowRecoveryModal(true);
  };

  const handleAcceptRecovery = async () => {
    if (!user || recoveryPreview.length === 0 || recoveryApplying) return;
    setRecoveryApplying(true);
    try {
      const todayStr = format(new Date(), 'yyyy-MM-dd');

      // FIX: Only delete today's AI sessions for subjects that ARE covered by
      // the recovery plan. Sessions for subjects that couldn't fit today
      // (recoveryUnscheduled) are deliberately left untouched so the student
      // doesn't permanently lose those missed sessions.
      const coveredSubjects = new Set(
        recoveryPreview.map(s => s.subject.toLowerCase().split(' (')[0].trim())
      );
      const todayUncompleted = events.filter(e =>
        e.isAIGenerated && e.isPersonal && !e.completed &&
        format(e.date instanceof Date ? e.date : new Date(e.date), 'yyyy-MM-dd') === todayStr &&
        coveredSubjects.has((e.course || '').toLowerCase().split(' (')[0].trim())
      );
      await Promise.all(todayUncompleted.map(e => studyPlanService.deleteEvent(e.id).catch(() => {})));

      // Add today's new sessions (only for covered subjects)
      await studyPlanService.createBulkAIEvents(
        (recoveryPreview as unknown as ScheduledSession[]).map(s => ({
          title:            s.title,
          description:      s.reason,
          date:             s.date instanceof Date ? s.date : new Date(s.date),
          startTime:        s.startTime,
          endTime:          s.endTime,
          course:           s.subject,
          instructorId:     user.uid,
          instructorName:   user.displayName || (user as any).name || '',
          isPersonal:       true,
          studentId:        user.uid,
          targetAudience:   'specific_student' as const,
          targetStudentIds: [user.uid],
          targetCourseIds:  [],
          eventType:        'study_session' as const,
          priority:         s.priority,
          isAIGenerated:    true,
          aiReason:         s.reason,
          aiTips:           [],
          sessionType:      s.sessionType,
          completed:        false,
          completionPercent: 0,
          ...(s.topicNames?.length            ? { topicNames: s.topicNames }               : {}),
          ...((s as any).topicContext?.length  ? { topicContext: (s as any).topicContext } : {}),
        })),
        user.uid
      );
      setShowRecoveryModal(false);
      setRecoveryPreview([]);
      setRecoveryUnscheduled([]);
      notificationService.createNotification({
        userId: user.uid,
        title: "Today's Plan Recovered",
        message: `${recoveryPreview.length} session${recoveryPreview.length !== 1 ? 's' : ''} have been rescheduled for today to get you back on track.`,
        type: 'system',
        priority: 'low',
        isPermanent: false,
        relatedType: 'studySchedule',
        metadata: { sessionCount: recoveryPreview.length },
      });
      await loadAll();
    } catch (e: any) {
      setError('Failed to apply recovery: ' + e.message);
    } finally {
      setRecoveryApplying(false);
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

  /**
   * Plays a chime using the Web Audio API — no external files needed.
   * type 'focus' → warm 3-note ascending chime (session done, well done!)
   * type 'break' → single soft low tone (break over, back to work)
   */
  const playPomodoroSound = (type: 'focus' | 'break') => {
    if (!pomodoroSoundEnabled) return;
    try {
      if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;

      const playNote = (freq: number, startAt: number, duration: number, gain = 0.4) => {
        const osc  = ctx.createOscillator();
        const gainNode = ctx.createGain();
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + startAt);
        gainNode.gain.setValueAtTime(0, ctx.currentTime + startAt);
        gainNode.gain.linearRampToValueAtTime(gain, ctx.currentTime + startAt + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startAt + duration);
        osc.start(ctx.currentTime + startAt);
        osc.stop(ctx.currentTime + startAt + duration + 0.05);
      };

      if (type === 'focus') {
        // Ascending 3-note chime: C5 → E5 → G5 — warm, celebratory
        playNote(523.25, 0.0, 0.6, 0.35); // C5
        playNote(659.25, 0.25, 0.6, 0.35); // E5
        playNote(783.99, 0.5, 0.9, 0.4);  // G5
      } else {
        // Single soft mid-tone: A4 — gentle, "time to focus again"
        playNote(440, 0.0, 0.8, 0.25);
      }
    } catch {
      // AudioContext blocked or unsupported — silent fail
    }
  };

  // Load today's focused minutes from streak on mount
  useEffect(() => {
    if (!user) return;
    studyPlanService.getPomodoroSessions(user.uid, 50).then(sessions => {
      const todayStr = new Date().toISOString().slice(0, 10);
      const todayMins = sessions
        .filter(s => s.completed && s.startTime.toISOString().slice(0, 10) === todayStr)
        .reduce((sum, s) => sum + s.duration, 0);
      setPomodoroTodayMinutes(todayMins);
    }).catch(() => {});
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (pomodoroActive) {
      pomodoroRef.current = setInterval(() => {
        setPomodoroTime(t => {
          if (t <= 1) {
            // Session complete
            setPomodoroActive(false);

            if (pomodoroMode === 'focus' && user) {
              // Play celebratory chime
              playPomodoroSound('focus');
              const sessionMins = 25;
              const sessionStart = pomodoroStartTime || new Date(Date.now() - sessionMins * 60 * 1000);

              // 1. Save pomodoro session to Firestore + update streak
              studyPlanService.savePomodoroSession({
                studentId: user.uid,
                subject: pomodoroSubject || 'General',
                startTime: sessionStart,
                duration: sessionMins,
                completed: true,
                notes: pomodoroLinkedEvent ? `Linked to event: ${pomodoroLinkedEvent}` : '',
              }).then(() => studyPlanService.getStreak(user.uid))
                .then(s => {
                  if (s) setStreak({ current: s.currentStreak, longest: s.longestStreak, totalSessions: s.totalSessions });
                })
                .catch(() => {});

              // 2. Update today's minutes
              setPomodoroTodayMinutes(prev => prev + sessionMins);

              // 3. Increment sitting session count
              const newCount = pomodoroSessionCount + 1;
              setPomodoroSessionCount(newCount);

              // 4. Auto-progress linked event: every focus session = 25% → mark full after 4 sessions
              if (pomodoroLinkedEvent) {
                const linkedEv = events.find(e => e.id === pomodoroLinkedEvent);
                if (linkedEv && !linkedEv.completed) {
                  const newPct = Math.min(100, (linkedEv.completionPercent || 0) + 25);
                  handleUpdateCompletionPercent(linkedEv, newPct);
                }
              }

              // 5. After every 4 focus sessions, auto-suggest long break
              setPomodoroPhase(newCount % 4 === 0 ? 'break' : 'break');
              // Auto-switch to appropriate break
              const nextMode = newCount % 4 === 0 ? 'long' : 'short';
              setPomodoroMode(nextMode);
              return POMODORO_DURATIONS[nextMode];
            } else {
              // Break finished — play soft tone, switch back to focus
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

  const startPomodoro = () => {
    if (!pomodoroActive) {
      setPomodoroStartTime(new Date());
      setPomodoroPhase('focus');
    }
    setPomodoroActive(p => !p);
  };

  const resetPomodoro = (mode: 'focus' | 'short' | 'long') => {
    setPomodoroActive(false);
    setPomodoroMode(mode);
    setPomodoroTime(POMODORO_DURATIONS[mode]);
    setPomodoroPhase('idle');
    setPomodoroStartTime(null);
  };

  const resetPomodoroSitting = () => {
    setPomodoroActive(false);
    setPomodoroMode('focus');
    setPomodoroTime(POMODORO_DURATIONS.focus);
    setPomodoroSessionCount(0);
    setPomodoroPhase('idle');
    setPomodoroStartTime(null);
  };

  const pct          = Math.round((1 - pomodoroTime / POMODORO_DURATIONS[pomodoroMode]) * 100);
  const pMins        = String(Math.floor(pomodoroTime / 60)).padStart(2, '0');
  const pSecs        = String(pomodoroTime % 60).padStart(2, '0');
  const circumference = 2 * Math.PI * 54;

  // ── Chat Image Upload + OCR ──────────────────────────────────────────────────

  const handleChatImageSelect = async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    setChatImageFile(file);
    const url = URL.createObjectURL(file);
    setChatImagePreview(url);
    setChatImageText('');
    setChatImageOCRLoading(true);
    try {
      // Dynamic import keeps bundle lean — same pattern as qaService
      const Tesseract = await import('tesseract.js');
      const worker = await (Tesseract as any).createWorker('eng', 1);
      const { data } = await worker.recognize(url);
      await worker.terminate();
      setChatImageText(data.text?.trim() || '');
    } catch {
      setChatImageText('');
    } finally {
      setChatImageOCRLoading(false);
    }
  };

  // Builds the 7-day daily schedule context block for Minerva
  const buildDailyScheduleContext = () => {
    const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const FULL_DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().slice(0, 10);
      const dayLabel = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : FULL_DAY_NAMES[d.getDay()];

      const daySessions = events
        .filter(e => e.date.toISOString().slice(0, 10) === dateStr)
        .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''))
        .map(e => ({ title: e.title, startTime: e.startTime || '', endTime: e.endTime || '', subject: e.course || '' }));

      // Activities blocking time on this day
      const dayOfWeek = d.getDay();
      const activitiesBlocked = customActivities
        .filter(a => {
          if (a.scheduleType === 'recurring') return a.daysOfWeek.includes(dayOfWeek);
          if (a.scheduleType === 'specific_dates') return (a.specificDates || []).includes(dateStr);
          return false;
        })
        .map(a => ({ name: a.name, startTime: a.startTime, endTime: a.endTime }));

      // Rough free slot count (very simple: each 90-min window in free time range)
      const freeSlotsCount = Math.max(0, Math.floor(effectiveFreeHours / 1.5) - daySessions.length);

      return { date: dateStr, dayLabel, sessions: daySessions, activitiesBlocked, freeSlotsCount };
    });
  };

  // ── Add Chat Goals to Study Plan ─────────────────────────────────────────────

  // ── Feature #9: Calendar Export (.ics) ───────────────────────────────────────
  const handleExportICS = () => {
    if (!events.length) return;
    const pad = (n: number) => String(n).padStart(2, '0');
    const fmtDt = (d: Date, time?: string) => {
      const yr  = d.getFullYear();
      const mo  = pad(d.getMonth() + 1);
      const day = pad(d.getDate());
      if (!time) return `${yr}${mo}${day}`;
      const [h, m] = (time || '00:00').split(':');
      return `${yr}${mo}${day}T${pad(Number(h))}${pad(Number(m))}00`;
    };
    const esc = (s: string) => s.replace(/,/g, '\\,').replace(/;/g, '\\;').replace(/\n/g, '\\n');
    const lines: string[] = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//StudyPlanner//EN', 'CALSCALE:GREGORIAN'];
    events.forEach(ev => {
      const uid = `${ev.id}@studyplanner`;
      const dtStamp = fmtDt(new Date()) + 'T000000Z';
      const dtStart = ev.startTime ? fmtDt(ev.date, ev.startTime) : fmtDt(ev.date);
      const dtEnd   = ev.endTime   ? fmtDt(ev.date, ev.endTime)   : fmtDt(ev.date);
      lines.push(
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTAMP:${dtStamp}`,
        `DTSTART:${dtStart}`,
        `DTEND:${dtEnd}`,
        `SUMMARY:${esc(ev.title)}`,
        `DESCRIPTION:${esc(ev.description || '')}`,
        `CATEGORIES:${esc(ev.eventType.replace('_', ' '))}`,
        'END:VEVENT',
      );
    });
    lines.push('END:VCALENDAR');
    const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'study-plan.ics';
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Feature #13: Use Streak Freeze ───────────────────────────────────────────
  const handleUseStreakFreeze = async () => {
    if (!user || streakFreezeCount <= 0) return;
    setShowFreezePrompt(false);
    const { count, activeUntil } = await studyPlanService.useStreakFreeze(user.uid);
    setStreakFreezeCount(count);
    setFreezeActiveUntil(activeUntil);
    notificationService.createNotification({
      userId: user.uid,
      title: 'Streak Freeze Activated',
      message: `Your ${streak.current}-day streak is protected for 48 hours. You have ${count} freeze${count !== 1 ? 's' : ''} remaining.`,
      type: 'system',
      priority: 'low',
      relatedType: 'streakFreeze',
      isPermanent: false,
      metadata: { streak: streak.current, freezesRemaining: count },
    });
  };

  const handleAddChatGoals = async () => {
    if (!user || !pendingGoals.length || addingChatGoals) return;
    setAddingChatGoals(true);
    try {
      for (const g of pendingGoals) {
        await studyPlanService.createGoal({
          studentId: user.uid,
          subject: g.subject,
          targetDate: new Date(g.targetDate + 'T12:00:00'),
          hoursNeeded: g.hoursNeeded,
          hoursCompleted: 0,
          difficulty: g.difficulty,
          currentProgress: 0,
          isActive: true,
        });
      }
      const count = pendingGoals.length;
      setPendingGoals([]);
      await loadAll();
      setChatMessages(p => [...p, {
        role: 'assistant',
        content: `Done! Added ${count} goal${count > 1 ? 's' : ''} to your study plan. You can find ${count > 1 ? 'them' : 'it'} in the Calendar tab under Study Goals — from there you can generate your AI schedule anytime!`,
      }]);
    } catch (e: any) {
      setError('Failed to add goals: ' + e.message);
    } finally {
      setAddingChatGoals(false);
    }
  };

  // ── Chat ─────────────────────────────────────────────────────────────────────

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);

  const handleSendChat = async () => {
    if ((!chatInput.trim() && !chatImageFile) || !aiReady || chatLoading) return;
    const msg = chatInput.trim();
    setChatInput('');

    // Compose display message — include image indicator if present
    const displayMsg = chatImageFile
      ? `${msg}${msg ? '\n' : ''}[Uploaded routine/schedule image]`
      : msg;

    const userMsg = { role: 'user' as const, content: displayMsg };
    setChatMessages(p => [...p, userMsg]);
    setChatLoading(true);

    // Capture image context then clear it
    const imageContextForCall = chatImageText;
    const hadImage = !!chatImageFile;
    setChatImageFile(null);
    setChatImagePreview('');
    setChatImageText('');

    // Fire-and-forget save
    studyPlanService.saveChatMessage(user!.uid, { role: 'user', content: displayMsg }).catch(() => {});

    // Build richer free time description
    const freeTimeInfo = freeTimeMode === 'range'
      ? freeTimeRanges.map(r => `${r.start}–${r.end}`).join(', ') + ` (${effectiveFreeHours}h total free)`
      : `${freeHoursPerDay}h/day (flexible timing)`;

    try {
      const { response, calendarEvents, goals: aiGoals } = await aiStudyPlannerService.chatWithAI(
        hadImage ? (msg || 'I uploaded my routine/schedule image') : msg,
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
          // NEW: rich schedule context
          freeTimeInfo,
          dailySchedule: buildDailyScheduleContext(),
          imageContext: imageContextForCall || undefined,
        },
        chatMessages.slice(-10),
        ''
      );

      const assistantMsg = { role: 'assistant' as const, content: response, calendarEvents, goals: aiGoals };
      setChatMessages(p => [...p, assistantMsg]);

      // Fire-and-forget save
      studyPlanService.saveChatMessage(user!.uid, { role: 'assistant', content: response, calendarEvents }).catch(() => {});

      if (calendarEvents && calendarEvents.length > 0) {
        setPendingCalendarEvents(calendarEvents);
      }
      if (aiGoals && aiGoals.length > 0) {
        setPendingGoals(aiGoals);
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

  const handleDismissHelpPopup = () => {
    if (dontShowAgain) {
      localStorage.setItem(HELP_POPUP_KEY, 'forever');
    } else {
      localStorage.setItem(HELP_POPUP_KEY, String(Date.now()));
    }
    setShowHelpPopup(false);
  };

  const handleOpenHelpVideo = () => {
    if (helpVideoUrl) window.open(helpVideoUrl, '_blank', 'noopener,noreferrer');
  };

  // ── Input style ──────────────────────────────────────────────────────────────

  const T = useT();
  const inputCls = `w-full text-sm rounded-xl px-3 py-2.5 border focus:outline-none transition-colors placeholder-gray-500`;
  const inputStyle: React.CSSProperties = {
    background: T.inputBg,
    borderColor: T.inputBorder,
    color: T.text,
    fontFamily: "'Outfit', sans-serif",
  };
  // Helper: apply both class + style for inputs
  const inp = (extra?: string) => ({ className: `${inputCls} ${extra || ''}`, style: inputStyle });

  // Render topic hierarchy on a session card — compact professional style
  const renderSessionTopics = (ev: StudyPlanEvent) => {
    if (ev.topicContext && ev.topicContext.length > 0) {
      const grouped: Record<string, Record<string, string[]>> = {};
      ev.topicContext.forEach((tc: any) => {
        const subj = tc.subjectName || 'Topics';
        const chap = tc.chapterName || '';
        if (!grouped[subj]) grouped[subj] = {};
        if (!grouped[subj][chap]) grouped[subj][chap] = [];
        if (!grouped[subj][chap].includes(tc.topicName)) grouped[subj][chap].push(tc.topicName);
      });
      return (
        <div className="mt-1.5 space-y-0.5">
          {Object.entries(grouped).map(([subj, chapters]) => (
            <div key={subj}>
              <div className="flex items-center gap-1 mb-0.5">
                <BookOpen size={9} className="text-primary-400 flex-shrink-0" />
                <span className="text-[10px] font-semibold text-primary-300 uppercase tracking-wide">{subj}</span>
              </div>
              {Object.entries(chapters).map(([chap, topics]) => (
                <div key={chap} className="pl-3">
                  {chap && <span style={{ fontSize: 10, color: "var(--sp-text3,#475569)" }}>{chap} · </span>}
                  <span className="text-[10px] text-teal-400/80">{topics.join(' · ')}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      );
    }
    // Fallback: flat topicNames — comma separated, max 3 shown
    if (!ev.topicNames || ev.topicNames.length === 0) return null;
    const shown = ev.topicNames.slice(0, 3);
    const extra = ev.topicNames.length - 3;
    return (
      <div className="flex items-center gap-1 mt-1 flex-wrap">
        <Tag size={9} className="text-teal-400 flex-shrink-0" />
        <span className="text-[10px] text-teal-400/80">{shown.join(' · ')}</span>
        {extra > 0 && <span style={{ fontSize: 10, color: "var(--sp-text3,#475569)" }}>+{extra}</span>}
      </div>
    );
  };

  if (loading) return <PageSkeleton variant="mixed" />;

  // ─── Shared inline style helpers ──────────────────────────────────────────
  const card = {
    background: T.cardBg,
    border: `1px solid ${T.border}`,
    borderRadius: 20,
    padding: '16px',
  } as React.CSSProperties;

  const surfaceCard = {
    background: T.surface,
    border: `1px solid ${T.border}`,
    borderRadius: 14,
    padding: '12px 14px',
  } as React.CSSProperties;

  const btnPrimary = {
    display: 'flex', alignItems: 'center', gap: 6,
    background: T.gradient, color: '#fff', border: 'none',
    borderRadius: 12, padding: '9px 16px', fontSize: 13, fontWeight: 600,
    cursor: 'pointer', fontFamily: "'Outfit',sans-serif", whiteSpace: 'nowrap' as const,
  } as React.CSSProperties;

  const btnSec = {
    display: 'flex', alignItems: 'center', gap: 6,
    background: T.btnSecBg, color: T.text2,
    border: `1px solid ${T.btnSecBorder}`,
    borderRadius: 12, padding: '9px 16px', fontSize: 13, fontWeight: 600,
    cursor: 'pointer', fontFamily: "'Outfit',sans-serif", whiteSpace: 'nowrap' as const,
  } as React.CSSProperties;

  const lbl = { fontSize: 12, color: T.text2, fontWeight: 600, display: 'block', marginBottom: 6 } as React.CSSProperties;

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, fontFamily: "'Outfit',sans-serif" }}>

      {/* ── Header ── */}
      <style>{`
        .ssp-btn-grid {
          display: grid;
          gap: 8px;
          width: 100%;
        }
        /* Mobile: always 2 columns, max 2 rows */
        @media (max-width: 639px) {
          .ssp-btn-grid { grid-template-columns: 1fr 1fr; }
          .ssp-btn-span2 { grid-column: span 2; }
          .ssp-btn-full { grid-column: 1 / -1; }
        }
        /* Tablet+ : auto-fit compact row */
        @media (min-width: 640px) {
          .ssp-btn-grid { grid-template-columns: repeat(auto-fit, minmax(110px, auto)); width: auto; }
          .ssp-btn-span2 { grid-column: auto; }
        }
        .ssp-btn-base {
          display: flex; align-items: center; justify-content: center; gap: 6px;
          border-radius: 12px; padding: 9px 14px; font-size: 13px; font-weight: 600;
          cursor: pointer; font-family: 'Outfit',sans-serif; white-space: nowrap;
          transition: opacity 0.15s, transform 0.12s;
          min-height: 40px;
        }
        .ssp-btn-base:active { transform: scale(0.97); }
        .ssp-btn-base:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
      `}</style>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Title row */}
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: T.text, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            My Study Plan
            {aiReady && <span style={{ fontSize: 11, background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.30)', color: '#c4b5fd', padding: '3px 8px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 4 }}><Sparkles size={10} /> AI</span>}
          </h1>
          <p style={{ color: T.text2, marginTop: 4, fontSize: 13, margin: '4px 0 0' }}>Manage your schedule and track your progress</p>
        </div>

        {/* ── Action buttons — 2-row on mobile, single row on desktop ── */}
        <div className="ssp-btn-grid">

          {/* Row 1 — col 1: Free time (conditional) OR Add Event (fallback fills col 1) */}
          {aiReady && goals.length > 0 ? (
            <div style={{ position: 'relative', gridColumn: 'auto' }}>
              <button
                onClick={() => setShowFreeTimePanel(p => !p)}
                className="ssp-btn-base"
                title="Set your free time"
                style={{ background: T.btnSecBg, color: T.text2, border: `1px solid ${T.btnSecBorder}`, width: '100%' }}
              >
                <Clock size={12} style={{ color: T.text3, flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: T.text2, flexShrink: 0 }}>Free time:</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: !freeTimeConfigured ? '#fbbf24' : T.text, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {!freeTimeConfigured ? 'Set ▸'
                    : savedFreeTimeMode === 'range'
                      ? savedFreeTimeRangesCount === 1
                        ? `${savedFreeTimeHours}h`
                        : `${savedFreeTimeHours}h·${savedFreeTimeRangesCount}r`
                      : `${savedFreeTimeHours}h/d`}
                </span>
                <ChevronDown size={11} style={{ color: T.text3, transform: showFreeTimePanel ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }} />
              </button>

              {showFreeTimePanel && createPortal(
                <>
                  {/* Backdrop */}
                  <div style={{ position: 'fixed', inset: 0, zIndex: 199, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
                    onClick={() => setShowFreeTimePanel(false)} />
                  {/* Card — starts below navbar */}
                  <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, top: 60, zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', pointerEvents: 'none' }}>
                  <div style={{
                    width: '100%', maxWidth: 576,
                    maxHeight: '100%',
                    display: 'flex', flexDirection: 'column', overflow: 'hidden',
                    borderRadius: '20px 20px 0 0',
                    background: T.isLight ? '#ffffff' : T.baseBg,
                    border: `1px solid ${T.border}`,
                    boxShadow: T.isLight ? '0 -8px 40px rgba(0,0,0,0.15)' : '0 -8px 40px rgba(0,0,0,0.5)',
                    fontFamily: "'Outfit', sans-serif",
                    pointerEvents: 'auto',
                  }}>

                    {/* ── Header (never scrolls) ── */}
                    <div style={{ flexShrink: 0, padding: '16px 16px 12px', borderBottom: `1px solid ${T.border}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                          <div style={{ width: 32, height: 32, borderRadius: 12, background: `${T.primaryColor}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Clock size={16} style={{ color: T.primaryColor }} />
                          </div>
                          <div>
                            <span style={{ fontSize: 11, fontWeight: 600, color: T.primaryColor, display: 'block' }}>Study Planner</span>
                            <h2 style={{ fontSize: 14, fontWeight: 700, color: T.text, margin: 0 }}>Free Time Settings</h2>
                          </div>
                        </div>
                        <button onClick={() => setShowFreeTimePanel(false)} style={{ padding: 6, borderRadius: 8, color: T.text2, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexShrink: 0 }}><X size={16} /></button>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px 12px', fontSize: 12, color: T.text2 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Clock size={12} />
                          {freeTimeMode === 'range'
                            ? `${effectiveFreeHours}h free · ${freeTimeRanges.length} range${freeTimeRanges.length !== 1 ? 's' : ''}`
                            : `${freeHoursPerDay}h free per day`}
                        </span>
                        {freeTimeConfigured && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#4ade80' }}>
                            <CheckCircle2 size={12} />Configured
                          </span>
                        )}
                      </div>
                    </div>

                    {/* ── Static content (never scrolls) ── */}
                    <div style={{ flexShrink: 0, padding: '12px 16px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {/* Info card */}
                      <div style={{ background: T.isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.03)', border: `1px solid ${T.border}`, borderRadius: 12, padding: '14px 16px', textAlign: 'center' }}>
                        <Clock size={28} style={{ color: T.primaryColor, margin: '0 auto 8px' }} />
                        <p style={{ fontWeight: 600, color: T.text, fontSize: 13, margin: '0 0 4px' }}>When are you free each day?</p>
                        <p style={{ fontSize: 12, color: T.text2, margin: 0, lineHeight: 1.5 }}>Set your daily free time so the AI can schedule study sessions that fit your life.</p>
                      </div>
                      {/* Mode toggle */}
                      <div style={{ display: 'flex', gap: 6, padding: 4, background: T.isLight ? 'rgba(0,0,0,0.06)' : T.divider, borderRadius: 10 }}>
                        {(['hours', 'range'] as const).map(m => (
                          <button key={m} onClick={() => setFreeTimeMode(m)} style={{ flex: 1, fontSize: 12, padding: '6px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontFamily: "'Outfit',sans-serif", background: freeTimeMode === m ? T.primaryColor : 'transparent', color: freeTimeMode === m ? '#fff' : T.text2, transition: 'all 0.15s' }}>
                            {m === 'hours' ? 'Set hours' : 'Set time range'}
                          </button>
                        ))}
                      </div>
                      {/* Hours mode inline */}
                      {freeTimeMode === 'hours' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 4 }}>
                          <label style={{ fontSize: 12, color: T.text2 }}>Free hours per day:</label>
                          <select value={freeHoursPerDay} onChange={e => { setFreeHoursPerDay(Number(e.target.value)); setFreeTimeConfigured(true); }} className={inputCls} style={{ ...inputStyle, width: 70, padding: '6px 10px', fontSize: 12 }}>
                            {[1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24].map(h => <option key={h} value={h}>{h}h</option>)}
                          </select>
                        </div>
                      )}
                    </div>

                    {/* ── Scrollable time rows only (range mode) ── */}
                    {freeTimeMode === 'range' && (
                      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '10px 16px 4px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {freeTimeRanges.map((r, idx) => (
                          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <label style={{ fontSize: 11, color: T.text3, width: 30 }}>From</label>
                            <input type="time" value={r.start} onChange={e => { setFreeTimeRanges(prev => prev.map((x, i) => i === idx ? { ...x, start: e.target.value } : x)); setFreeTimeConfigured(true); }} className={inputCls} style={{ ...inputStyle, flex: 1, minWidth: 90, padding: '6px 8px', fontSize: 12 }} />
                            <label style={{ fontSize: 11, color: T.text3 }}>To</label>
                            <input type="time" value={r.end} onChange={e => { setFreeTimeRanges(prev => prev.map((x, i) => i === idx ? { ...x, end: e.target.value } : x)); setFreeTimeConfigured(true); }} className={inputCls} style={{ ...inputStyle, flex: 1, minWidth: 90, padding: '6px 8px', fontSize: 12 }} />
                            <span style={{ fontSize: 11, color: T.text3 }}>{Math.max(0, Math.round(rangeMinutes(r.start, r.end) / 60 * 10) / 10)}h</span>
                            {freeTimeRanges.length > 1 && <button onClick={() => setFreeTimeRanges(prev => prev.filter((_, i) => i !== idx))} style={{ color: T.text3, background: 'none', border: 'none', cursor: 'pointer' }}><X size={13} /></button>}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* ── Add time range + total — always visible, never scrolls ── */}
                    {freeTimeMode === 'range' && (
                      <div style={{ flexShrink: 0, padding: '8px 16px', borderTop: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <button
                          onClick={() => {
                            if (effectiveFreeHours >= 24) return;
                            setFreeTimeRanges(prev => [...prev, { start: '18:00', end: '20:00' }]);
                          }}
                          disabled={effectiveFreeHours >= 24}
                          style={{ fontSize: 12, color: effectiveFreeHours >= 24 ? T.text3 : T.primaryColor, background: 'none', border: 'none', cursor: effectiveFreeHours >= 24 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 4, opacity: effectiveFreeHours >= 24 ? 0.4 : 1 }}>
                          <Plus size={12} /> Add time range
                        </button>
                        <span style={{ fontSize: 12, color: effectiveFreeHours > 24 ? '#ef4444' : T.text2 }}>
                          = <strong style={{ color: effectiveFreeHours > 24 ? '#ef4444' : T.text }}>{effectiveFreeHours}h</strong>
                          {effectiveFreeHours > 24
                            ? <span style={{ color: '#ef4444', fontSize: 11, marginLeft: 4 }}>exceeds 24h!</span>
                            : <span style={{ color: T.text2 }}> free</span>}
                        </span>
                      </div>
                    )}

                    {/* ── Save button (never scrolls) ── */}
                    <div style={{ flexShrink: 0, padding: freeTimeMode === 'range' ? '8px 16px 16px' : 16 }}>
                      <button onClick={handleSaveFreeTime} disabled={freeTimeSaving || effectiveFreeHours > 24}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 0', background: freeTimeSaved ? '#16a34a' : effectiveFreeHours > 24 ? '#6b7280' : T.primaryColor, color: '#fff', border: 'none', borderRadius: 14, fontSize: 14, fontWeight: 600, cursor: (freeTimeSaving || effectiveFreeHours > 24) ? 'not-allowed' : 'pointer', opacity: (freeTimeSaving || effectiveFreeHours > 24) ? 0.5 : 1, fontFamily: "'Outfit',sans-serif" }}>
                        {freeTimeSaving ? <Loader size={14} className="animate-spin" /> : freeTimeSaved ? <CheckCircle2 size={14} /> : <Download size={14} />}
                        {freeTimeSaving ? 'Saving…' : freeTimeSaved ? 'Saved!' : effectiveFreeHours > 24 ? 'Total exceeds 24h' : 'Save Free Time'}
                      </button>
                    </div>

                  </div>
                  </div>
                </>,
                document.body
              )}
            </div>
          ) : null}

          {/* Row 1 — col 2: Reschedule/Schedule (only if goals exist) */}
          {goals.length > 0 && (
            <button
              onClick={hasExistingAIPlan ? handleOpenReschedule : handleGenerateSchedule}
              disabled={scheduleLoading}
              className="ssp-btn-base"
              style={{
                background: hasExistingAIPlan ? 'linear-gradient(135deg,#d97706,#ea580c)' : 'linear-gradient(135deg,#7c3aed,#6366f1)',
                color: '#fff', border: 'none',
                opacity: scheduleLoading ? 0.6 : 1,
                cursor: scheduleLoading ? 'not-allowed' : 'pointer',
              }}
            >
              {scheduleLoading ? <Loader size={14} className="animate-spin" /> : hasExistingAIPlan ? <RefreshCw size={14} /> : <Brain size={14} />}
              {scheduleLoading ? 'Scheduling…' : hasExistingAIPlan ? 'Reschedule' : 'Schedule'}
            </button>
          )}

          {/* Row 2 — col 1: Add Event — spans full width if no Watch Guide & no Export */}
          <button
            onClick={() => { setEditingEvent(null); setShowModal(true); }}
            className={`ssp-btn-base${(!helpVideoUrl && events.length === 0) ? ' ssp-btn-span2' : ''}`}
            style={{ background: T.gradient, color: '#fff', border: 'none' }}
          >
            <Plus size={14} /> Add Event
          </button>

          {/* Row 2 — col 2: Watch Guide */}
          {helpVideoUrl && (
            <button
              onClick={handleOpenHelpVideo}
              className="ssp-btn-base"
              title="Watch the guide video"
              style={{ background: T.btnSecBg, color: T.text2, border: `1px solid ${T.btnSecBorder}` }}
            >
              <Video size={14} style={{ color: T.primaryColor }} /> Watch Guide
            </button>
          )}

          {/* Export — only when events exist; on mobile spans full if Watch Guide absent */}
          {events.length > 0 && (
            <button
              onClick={handleExportICS}
              className={`ssp-btn-base${!helpVideoUrl ? ' ssp-btn-span2' : ''}`}
              title="Export to .ics"
              style={{ background: T.btnSecBg, color: T.text2, border: `1px solid ${T.btnSecBorder}` }}
            >
              <Download size={14} style={{ color: '#4ade80' }} /> Export
            </button>
          )}
        </div>
      </div>

      {/* ── Error Banner ── */}
      {error && (
        <div style={{ background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.30)', color: '#fca5a5', padding: '10px 14px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
          <AlertCircle size={14} />{error}
          <button onClick={() => setError('')} style={{ marginLeft: 'auto', color: '#fca5a5', background: 'none', border: 'none', cursor: 'pointer' }}><X size={13} /></button>
        </div>
      )}

      {/* ── Stats Row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
        {[
          { label: 'Streak',     value: streak.current,                       extra: `Best: ${streak.longest}d`,                           grad: 'linear-gradient(135deg,rgba(234,88,12,0.25),rgba(220,38,38,0.20))', border: 'rgba(234,88,12,0.25)',  id: 'streak' },
          { label: 'This Week',  value: thisWeekEvents.length,                extra: `${todayEvents.length} today`,                        grad: 'linear-gradient(135deg,rgba(37,99,235,0.22),rgba(79,70,229,0.18))', border: 'rgba(59,130,246,0.22)', id: 'week' },
          { label: 'Completion', value: `${completionRate}%`,                 extra: `${completedCount}/${events.length} done`,             grad: 'linear-gradient(135deg,rgba(5,150,105,0.22),rgba(16,185,129,0.18))',border: 'rgba(16,185,129,0.22)', id: 'comp' },
          { label: 'Goals',      value: goals.filter(g => g.isActive).length, extra: `${goals.filter(g => g.currentProgress >= 100).length} completed`, grad: 'linear-gradient(135deg,rgba(124,58,237,0.22),rgba(139,92,246,0.18))',border: 'rgba(139,92,246,0.22)', id: 'goals' },
        ].map(s => (
          <div key={s.label} style={{ background: s.grad, border: `1px solid ${s.border}`, borderRadius: 18, padding: '14px 16px', position: 'relative' }}>
            <p style={{ fontSize: 11, color: T.text2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 4px' }}>{s.label}</p>
            <p style={{ fontSize: 26, fontWeight: 700, color: T.text, margin: '0 0 2px' }}>{s.value}</p>
            <p style={{ fontSize: 11, color: T.text2, margin: 0 }}>{s.extra}</p>
            {s.id === 'streak' && (
              <button onClick={() => setShowFreezePrompt(true)} title={freezeActiveUntil ? `Freeze active` : 'Use a streak freeze'} style={{ position: 'absolute', top: 10, right: 10, display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '3px 7px', borderRadius: 20, border: `1px solid ${freezeActiveUntil ? 'rgba(6,182,212,0.6)' : streakFreezeCount > 0 ? 'rgba(6,182,212,0.3)' : T.border}`, background: freezeActiveUntil ? 'rgba(6,182,212,0.3)' : streakFreezeCount > 0 ? 'rgba(6,182,212,0.15)' : T.surface, color: freezeActiveUntil ? '#67e8f9' : streakFreezeCount > 0 ? '#22d3ee' : T.text3, cursor: 'pointer' }}>
                <Snowflake size={9} />{streakFreezeCount}
              </button>
            )}
          </div>
        ))}
      </div>

      {/* ── AI Insights ── */}
      {(insights.length > 0 || insightsLoading) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 10 }}>
          {insightsLoading && [1, 2, 3, 4].map(i => (
            <div key={i} style={{ ...surfaceCard, animation: 'pulse 2s infinite' }}>
              <div style={{ height: 10, background: T.divider, borderRadius: 6, width: '60%', marginBottom: 8 }} />
              <div style={{ height: 8, background: T.divider, borderRadius: 6, width: '90%' }} />
            </div>
          ))}
          {insights.map((ins, i) => {
            const s = INSIGHT_STYLE[ins.type] || INSIGHT_STYLE.tip;
            const Icon = s.icon;
            return (
              <div key={i} style={{ ...surfaceCard }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <Icon size={13} className={s.color} />
                  <span style={{ fontSize: 12, fontWeight: 600 }} className={s.color}>{ins.title}</span>
                </div>
                <p style={{ fontSize: 12, color: T.text2, lineHeight: 1.5, margin: 0 }}>{ins.message}</p>
                {ins.action && <p style={{ fontSize: 12, marginTop: 6, fontWeight: 600, color: T.primaryColor, margin: '6px 0 0' }}>{ins.action} →</p>}
              </div>
            );
          })}
        </div>
      )}

      {/* ── View Tabs ── */}
      <div style={{ display: 'flex', gap: 4, background: T.surface, border: `1px solid ${T.border}`, padding: 4, borderRadius: 16, flexWrap: 'wrap', width: 'fit-content', maxWidth: '100%' }}>
        {([
          { id: 'calendar', label: 'Calendar',  Icon: CalendarIcon },
          { id: 'list',     label: 'Upcoming',  Icon: ListTodo },
          { id: 'analytics',label: 'Analytics', Icon: BarChart2 },
          { id: 'chat',     label: 'AI Chat',   Icon: MessageSquare },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setView(t.id)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 12, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: "'Outfit',sans-serif", background: view === t.id ? T.gradient : 'transparent', color: view === t.id ? '#fff' : T.text2, transition: 'all 0.15s', whiteSpace: 'nowrap' as const }}>
            <t.Icon size={13} />{t.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════ CALENDAR VIEW ═══════════════════════════ */}
      {view === 'calendar' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
          <style>{`
            @media(min-width:1024px){.sp-cal-grid{grid-template-columns:1fr 2fr!important}}
            .react-calendar{width:100%!important;background:transparent!important;border:none!important;font-family:'Outfit',sans-serif!important;color:${T.text}!important}
            .react-calendar__navigation button{color:${T.text}!important;background:none!important;border:none!important;font-size:14px!important;font-family:'Outfit',sans-serif!important}
            .react-calendar__month-view__weekdays{color:${T.text3}!important;font-size:11px!important}
            .react-calendar__month-view__days__day{color:${T.text}!important;font-family:'Outfit',sans-serif!important;border-radius:8px!important;padding:6px!important}
            .react-calendar__month-view__days__day--weekend{color:${T.text}!important}
            .react-calendar__month-view__days__day--weekend abbr{color:${T.text}!important}
            .react-calendar__tile--active{background:${T.primaryColor}!important;color:#fff!important;border-radius:8px!important}
            .react-calendar__tile--now{background:rgba(99,102,241,0.15)!important;border-radius:8px!important}
            .react-calendar__tile.has-event::after{content:'';display:block;width:5px;height:5px;background:${T.primaryColor};border-radius:50%;margin:2px auto 0}
          `}</style>
          <div className="sp-cal-grid" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
            {/* Left column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <NoAnimCard>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: T.text, margin: '0 0 14px' }}>Calendar</h2>
                <Calendar
                  onChange={(val) => { setDate(val); setTimeout(() => dayEventsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80); }}
                  value={date}
                  tileClassName={({ date: d }) => events.some(e => e.date.toDateString() === d.toDateString()) ? 'has-event' : null}
                  prevLabel={<ChevronLeft size={15} />} nextLabel={<ChevronRight size={15} />}
                  navigationLabel={({ date: d }) => <span style={{ color: T.text, fontWeight: 600 }}>{format(d, 'MMMM yyyy')}</span>}
                />
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${T.divider}`, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {[['assignment','#f59e0b'],['exam','#ef4444'],['class','#6366f1'],['study_session','#10b981'],['deadline','#ec4899'],['personal','#8b5cf6']].map(([t,c]) => (
                    <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: c, flexShrink: 0 }} />
                      <span style={{ fontSize: 11, color: T.text2, textTransform: 'capitalize' }}>{(t as string).replace('_',' ')}</span>
                    </div>
                  ))}
                </div>
              </NoAnimCard>

              {/* Pomodoro Timer */}
              <NoAnimCard>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <h2 style={{ fontSize: 15, fontWeight: 700, color: T.text, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Timer size={14} style={{ color: T.primaryColor }} /> Focus Timer
                    {pomodoroSessionCount > 0 && <span style={{ fontSize: 11, background: `rgba(${T.pRgb},0.15)`, color: T.primaryColor, padding: '2px 8px', borderRadius: 20 }}>{pomodoroSessionCount} session{pomodoroSessionCount > 1 ? 's' : ''}</span>}
                  </h2>
                  <button onClick={() => setPomodoroSoundEnabled(p => !p)} title={pomodoroSoundEnabled ? 'Sound on' : 'Sound off'} style={{ padding: 6, borderRadius: 8, border: 'none', cursor: 'pointer', background: pomodoroSoundEnabled ? `rgba(${T.pRgb},0.15)` : T.surface, color: pomodoroSoundEnabled ? T.primaryColor : T.text3, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {pomodoroSoundEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
                  </button>
                </div>

                {/* Ring */}
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: 14, height: 130, position: 'relative' }}>
                  <svg width="128" height="128" style={{ position: 'absolute', transform: 'rotate(-90deg)' }}>
                    <circle cx="64" cy="64" r="54" strokeWidth="8" stroke={T.divider} fill="none" />
                    <circle cx="64" cy="64" r="54" strokeWidth="8"
                      stroke={pomodoroMode === 'focus' ? T.primaryColor : pomodoroMode === 'short' ? '#10b981' : '#f59e0b'}
                      fill="none" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - pct / 100)}
                      strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s linear' }} />
                  </svg>
                  <div style={{ position: 'relative', textAlign: 'center', zIndex: 1 }}>
                    <span style={{ fontSize: 24, fontWeight: 700, color: T.text, fontFamily: 'monospace' }}>{pMins}:{pSecs}</span>
                    <p style={{ fontSize: 11, color: T.text2, margin: '2px 0 6px' }}>
                      {pomodoroMode === 'short' ? 'Short Break' : pomodoroMode === 'long' ? 'Long Break' : 'Focus'}
                    </p>
                    <div style={{ display: 'flex', gap: 5, justifyContent: 'center' }}>
                      {[0,1,2,3].map(i => <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: i < (pomodoroSessionCount % 4) ? T.primaryColor : T.divider }} />)}
                    </div>
                  </div>
                </div>

                {/* Mode tabs */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                  {(['focus','short','long'] as const).map(m => (
                    <button key={m} onClick={() => resetPomodoro(m)} style={{ flex: 1, padding: '7px 0', borderRadius: 10, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: "'Outfit',sans-serif", background: pomodoroMode === m ? T.gradient : T.surface, color: pomodoroMode === m ? '#fff' : T.text2, transition: 'all 0.15s' }}>
                      {m === 'focus' ? '25 min' : m === 'short' ? '5 min' : '15 min'}
                    </button>
                  ))}
                </div>

                {/* Subject picker */}
                <div style={{ marginBottom: 10 }}>
                  <label style={{ ...lbl, marginBottom: 4 }}>What are you studying?</label>
                  <select value={pomodoroLinkedEvent || pomodoroSubject} onChange={e => { const val = e.target.value; const matched = todayEvents.find(ev => ev.id === val); if (matched) { setPomodoroLinkedEvent(matched.id); setPomodoroSubject(matched.course || matched.title); } else { setPomodoroLinkedEvent(''); setPomodoroSubject(val); } }} className={inputCls} style={{ ...inputStyle, marginBottom: 6 }}>
                    <option value="">— Pick a session or type below —</option>
                    {todayEvents.filter(e => !e.completed).map(ev => <option key={ev.id} value={ev.id}>{ev.title} ({ev.startTime}–{ev.endTime})</option>)}
                  </select>
                  {!pomodoroLinkedEvent && (
                    <input value={pomodoroSubject} onChange={e => setPomodoroSubject(e.target.value)} placeholder="Or type subject manually…" className={inputCls} style={inputStyle} />
                  )}
                  {pomodoroLinkedEvent && <p style={{ fontSize: 11, color: T.primaryColor, margin: '4px 0 0', display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle2 size={10} /> Progress auto-updates</p>}
                </div>

                {/* Controls */}
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <button onClick={startPomodoro} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 0', background: pomodoroActive ? 'linear-gradient(135deg,#d97706,#b45309)' : T.gradient, color: '#fff', border: 'none', borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>
                    {pomodoroActive ? <><Pause size={13} />Pause</> : <><Play size={13} />Start</>}
                  </button>
                  <button onClick={() => resetPomodoro(pomodoroMode)} style={{ padding: 10, background: T.surface, border: `1px solid ${T.border}`, color: T.text2, borderRadius: 12, cursor: 'pointer', display: 'flex' }}><RotateCcw size={14} /></button>
                  {pomodoroSessionCount > 0 && <button onClick={resetPomodoroSitting} style={{ padding: 10, background: T.surface, border: `1px solid ${T.border}`, color: T.text2, borderRadius: 12, cursor: 'pointer', display: 'flex' }}><Trash size={14} /></button>}
                </div>

                {/* Stats footer */}
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.divider}`, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, textAlign: 'center' }}>
                  {[{ v: streak.totalSessions, l: 'Total' }, { v: `${pomodoroTodayMinutes}m`, l: 'Today' }, { v: `${Math.round(streak.totalSessions * 25 / 60)}h`, l: 'All time' }].map(s => (
                    <div key={s.l}><p style={{ fontSize: 15, fontWeight: 700, color: T.text, margin: '0 0 2px' }}>{s.v}</p><p style={{ fontSize: 11, color: T.text3, margin: 0 }}>{s.l}</p></div>
                  ))}
                </div>

                {pomodoroSessionCount > 0 && pomodoroSessionCount % 4 === 0 && pomodoroMode !== 'long' && !pomodoroActive && (
                  <div style={{ marginTop: 8, background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 12, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Coffee size={12} style={{ color: '#fbbf24', flexShrink: 0 }} />
                    <p style={{ fontSize: 12, color: '#fcd34d', margin: 0, flex: 1 }}>4 sessions done — take a long break!</p>
                    <button onClick={() => resetPomodoro('long')} style={{ fontSize: 12, color: '#fbbf24', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' }}>15 min</button>
                  </div>
                )}
              </NoAnimCard>
            </div>

            {/* Right column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Day events */}
              <div ref={dayEventsRef}>
                <NoAnimCard>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <h2 style={{ fontSize: 15, fontWeight: 700, color: T.text, margin: 0 }}>
                      {isToday(selectedDate) ? 'Today' : isTomorrow(selectedDate) ? 'Tomorrow' : format(selectedDate, 'MMMM d, yyyy')}
                      <span style={{ color: T.text3, fontSize: 13, fontWeight: 400, marginLeft: 6 }}>({dayEvents.length})</span>
                    </h2>
                    <button onClick={() => { setEditingEvent(null); setShowModal(true); }} style={{ ...btnPrimary, padding: '6px 12px', fontSize: 12 }}><Plus size={12} />Add</button>
                  </div>
                  {dayEvents.length === 0 ? (
                    <div style={{ padding: '32px 0', textAlign: 'center' }}>
                      <CalendarIcon size={36} style={{ color: T.text3, margin: '0 auto 12px', display: 'block' }} />
                      <p style={{ fontSize: 13, color: T.text2, margin: 0 }}>No events for this day</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {dayEvents.map(ev => {
                        const now = new Date();
                        let isExpired = ev.expired === true;
                        if (!isExpired && ev.isAIGenerated && !ev.completed) {
                          const baseSubject = ev.course?.split(' (')[0] || '';
                          const linkedGoal = goals.find(g => g.subject === ev.course || g.subject.split(' (')[0] === baseSubject);
                          isExpired = linkedGoal ? now > linkedGoal.targetDate : false;
                        }
                        const typeColors: Record<string, string> = { assignment: '#f59e0b', exam: '#ef4444', class: '#6366f1', study_session: '#10b981', deadline: '#ec4899', personal: '#8b5cf6' };
                        const borderColor = typeColors[ev.eventType] || T.text3;
                        const Icon = TYPE_ICON[ev.eventType] || CalendarIcon;
                        return (
                          <div key={ev.id} style={{ ...surfaceCard, borderLeft: `4px solid ${borderColor}`, opacity: ev.completed ? 0.65 : 1 }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
                                  <Icon size={13} style={{ color: T.text2, flexShrink: 0 }} />
                                  <span style={{ fontSize: 14, fontWeight: 600, color: ev.completed ? T.text3 : T.text, textDecoration: ev.completed ? 'line-through' : 'none' }}>{ev.title}</span>
                                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: `${borderColor}22`, color: borderColor, textTransform: 'capitalize' }}>{ev.eventType.replace('_',' ')}</span>
                                  {ev.isAIGenerated && <span style={{ fontSize: 11, background: 'rgba(139,92,246,0.15)', color: '#c4b5fd', padding: '2px 7px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 3 }}><Sparkles size={9} />AI</span>}
                                  {isExpired && <span style={{ fontSize: 11, background: 'rgba(239,68,68,0.12)', color: '#fca5a5', padding: '2px 7px', borderRadius: 20, border: '1px solid rgba(239,68,68,0.3)' }}>Expired</span>}
                                </div>
                                {ev.description && <p style={{ fontSize: 12, color: T.text2, margin: '0 0 6px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical' as any }}>{ev.description}</p>}
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, fontSize: 12, color: T.text2 }}>
                                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><CalendarIcon size={11} />{format(ev.date, 'MMM d, yyyy')}</span>
                                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={11} />{ev.startTime}–{ev.endTime}</span>
                                  {ev.course && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><BookOpen size={11} />{ev.course}</span>}
                                </div>
                                {ev.aiTips?.[0] && <p style={{ fontSize: 11, color: '#c4b5fd', margin: '6px 0 0' }}>{ev.aiTips[0]}</p>}
                                {renderSessionTopics(ev)}
                                {/* Progress bar */}
                                {ev.isAIGenerated && ev.isPersonal && !ev.completed && (
                                  <div style={{ marginTop: 8 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                      <span style={{ fontSize: 11, color: T.text3 }}>Session progress</span>
                                      <span style={{ fontSize: 11, fontWeight: 600, color: (ev.completionPercent || 0) > 0 ? '#fbbf24' : T.text3 }}>{(ev.completionPercent || 0) > 0 ? `${ev.completionPercent}% done` : 'Not started'}</span>
                                    </div>
                                    <div style={{ display: 'flex', gap: 3, height: 8, borderRadius: 6, overflow: 'hidden', cursor: 'pointer' }}>
                                      {[25,50,75,100].map(pct => (
                                        <div key={pct} onClick={() => handleUpdateCompletionPercent(ev, pct)} title={pct === 100 ? 'Mark complete' : `Mark ${pct}% done`} style={{ flex: 1, borderRadius: 2, transition: 'all 0.15s', background: (ev.completionPercent || 0) >= pct ? (pct === 100 ? '#10b981' : '#f59e0b') : T.divider }} />
                                      ))}
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: T.text3, marginTop: 2, padding: '0 2px' }}>
                                      <span>25%</span><span>50%</span><span>75%</span><span style={{ display: 'flex', alignItems: 'center' }}><CheckCircle2 size={9} /></span>
                                    </div>
                                  </div>
                                )}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                                <button onClick={() => handleToggleComplete(ev)} title={ev.completed ? 'Mark incomplete' : 'Mark complete'} style={{ padding: 6, borderRadius: 8, border: 'none', cursor: 'pointer', background: ev.completed ? 'rgba(16,185,129,0.15)' : T.surface, color: ev.completed ? '#4ade80' : T.text2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CheckCircle2 size={13} /></button>
                                {ev.isPersonal && ev.studentId === user?.uid && (<>
                                  <button onClick={() => { setEditingEvent(ev); setShowModal(true); }} style={{ padding: 6, borderRadius: 8, border: 'none', cursor: 'pointer', background: T.surface, color: T.text2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Edit size={12} /></button>
                                  <button onClick={() => handleDelete(ev.id)} style={{ padding: 6, borderRadius: 8, border: 'none', cursor: 'pointer', background: T.surface, color: T.text2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Trash2 size={12} /></button>
                                </>)}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </NoAnimCard>
              </div>

              {/* Study Goals */}
              <NoAnimCard>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <h2 style={{ fontSize: 15, fontWeight: 700, color: T.text, margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Target size={14} style={{ color: T.primaryColor }} />Study Goals
                  </h2>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {goals.length > 0 && goals.some(g => getGoalAIProgress(g).totalSessions > 0) && (
                      <button onClick={handleOpenReschedule} style={{ ...btnSec, padding: '6px 10px', fontSize: 12, borderColor: 'rgba(245,158,11,0.3)', color: '#fcd34d', background: 'rgba(245,158,11,0.10)' }}><RefreshCw size={11} />Replan</button>
                    )}
                    <button onClick={() => setShowGoalForm(p => !p)} style={{ ...btnPrimary, padding: '6px 12px', fontSize: 12 }}><Plus size={12} />Goal</button>
                  </div>
                </div>

                {showGoalForm && (
                  <div style={{ ...surfaceCard, marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {/* Mode tabs */}
                    <div style={{ display: 'flex', gap: 4, background: T.divider, padding: 4, borderRadius: 10 }}>
                      {(['simple','topic','course'] as GoalMode[]).map(m => (
                        <button key={m} onClick={() => setGoalMode(m)} style={{ flex: 1, fontSize: 12, padding: '6px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontFamily: "'Outfit',sans-serif", background: goalMode === m ? T.primaryColor : 'transparent', color: goalMode === m ? '#fff' : T.text2 }}>
                          {m === 'simple' ? 'Simple' : m === 'topic' ? 'Add Topics' : 'From Course'}
                        </button>
                      ))}
                    </div>

                    {goalMode !== 'course' ? (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <input value={newGoal.subject} onChange={e => setNewGoal(p => ({ ...p, subject: e.target.value }))} placeholder="Subject / Course" className={inputCls} style={inputStyle} />
                        <input type="date" value={newGoal.targetDate} onChange={e => setNewGoal(p => ({ ...p, targetDate: e.target.value }))} className={inputCls} style={inputStyle} />
                      </div>
                    ) : (
                      <input type="date" value={newGoal.targetDate} onChange={e => setNewGoal(p => ({ ...p, targetDate: e.target.value }))} className={inputCls} style={inputStyle} />
                    )}

                    {goalMode === 'simple' && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <div><label style={lbl}>Hours needed</label><input type="number" min={1} value={newGoal.hoursNeeded} onChange={e => setNewGoal(p => ({ ...p, hoursNeeded: Number(e.target.value) }))} className={inputCls} style={inputStyle} /></div>
                        <div><label style={lbl}>Difficulty</label>
                          <select value={newGoal.difficulty} onChange={e => setNewGoal(p => ({ ...p, difficulty: e.target.value as any }))} className={inputCls} style={inputStyle}>
                            <option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option>
                          </select>
                        </div>
                      </div>
                    )}

                    {goalMode === 'topic' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {(['first_reading','revision'] as const).map(m => (
                            <button key={m} onClick={() => setGoalStudyMode(m)} style={{ flex: 1, fontSize: 12, padding: '6px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontFamily: "'Outfit',sans-serif", background: goalStudyMode === m ? '#0d9488' : T.surface, color: goalStudyMode === m ? '#fff' : T.text2 }}>
                              {m === 'first_reading' ? 'First Reading' : 'Revision'}
                            </button>
                          ))}
                        </div>
                        <input value={topicInput.name} onChange={e => setTopicInput(p => ({ ...p, name: e.target.value }))} placeholder="Topic name" className={inputCls} style={inputStyle} onKeyDown={e => { if (e.key === 'Enter' && topicInput.name) { setManualTopics(p => [...p, { id: Date.now().toString(), ...topicInput }]); setTopicInput(p => ({ ...p, name: '' })); }}} />
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                          <div><label style={{ ...lbl, fontSize: 11 }}>Min h</label><input type="number" min={0.5} step={0.5} value={topicInput.minHours} onChange={e => setTopicInput(p => ({ ...p, minHours: Number(e.target.value) }))} className={inputCls} style={inputStyle} /></div>
                          <div><label style={{ ...lbl, fontSize: 11 }}>Max h</label><input type="number" min={0.5} step={0.5} value={topicInput.maxHours} onChange={e => setTopicInput(p => ({ ...p, maxHours: Number(e.target.value) }))} className={inputCls} style={inputStyle} /></div>
                          <div><label style={{ ...lbl, fontSize: 11 }}>Difficulty</label>
                            <select value={topicInput.difficulty} onChange={e => setTopicInput(p => ({ ...p, difficulty: e.target.value as any }))} className={inputCls} style={inputStyle}>
                              <option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option>
                            </select>
                          </div>
                        </div>
                        <button onClick={() => { if (!topicInput.name) return; setManualTopics(p => [...p, { id: Date.now().toString(), ...topicInput }]); setTopicInput(p => ({ ...p, name: '' })); }} style={{ ...btnSec, justifyContent: 'center', padding: '7px 0', fontSize: 12 }}>+ Add Topic</button>
                        {manualTopics.length > 0 && (
                          <div style={{ maxHeight: 140, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {manualTopics.map((t, i) => (
                              <div key={t.id} style={{ display: 'flex', alignItems: 'center', background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: '6px 10px', fontSize: 12 }}>
                                <span style={{ color: T.text, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 8 }}>{t.name}</span>
                                <span style={{ color: T.text3, marginRight: 8, flexShrink: 0 }}>{t.minHours}–{t.maxHours}h</span>
                                <button onClick={() => setManualTopics(p => p.filter((_,j) => j !== i))} style={{ color: '#f87171', background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex' }}><X size={11} /></button>
                              </div>
                            ))}
                          </div>
                        )}
                        {calculatedHours > 0 && <p style={{ fontSize: 12, color: '#2dd4bf', textAlign: 'right', margin: 0 }}>{manualTopics.length} topics · <strong>{calculatedHoursRange ? `${calculatedHoursRange.min}–${calculatedHoursRange.max}h` : `${calculatedHours}h`}</strong></p>}
                      </div>
                    )}

                    {goalMode === 'course' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {(['first_reading','revision'] as const).map(m => (
                            <button key={m} onClick={() => setGoalStudyMode(m)} style={{ flex: 1, fontSize: 12, padding: '6px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontFamily: "'Outfit',sans-serif", background: goalStudyMode === m ? '#0d9488' : T.surface, color: goalStudyMode === m ? '#fff' : T.text2 }}>
                              {m === 'first_reading' ? 'First Reading' : 'Revision'}
                            </button>
                          ))}
                        </div>
                        {enrolledCourses.length === 0 ? (
                          <p style={{ fontSize: 12, color: T.text3, textAlign: 'center', padding: '12px 0' }}>No enrolled courses found.</p>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {enrolledCourses.map(c => (
                              <button key={c.courseId} onClick={() => { setCtCourseId(c.courseId); loadCourseTopics(c.courseId); }} style={{ textAlign: 'left', padding: '10px 12px', borderRadius: 12, border: `1px solid ${ctCourseId === c.courseId ? T.primaryColor : T.border}`, background: ctCourseId === c.courseId ? `rgba(${T.pRgb},0.15)` : T.surface, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{c.title}</div>
                                {c.instructor && <div style={{ fontSize: 11, color: T.text3, marginTop: 2 }}>{c.instructor} · {c.progress}% done</div>}
                              </button>
                            ))}
                          </div>
                        )}
                        {ctLoadingGroups && <p style={{ fontSize: 12, color: T.text2, textAlign: 'center' }}><Loader size={12} className="inline animate-spin" style={{ marginRight: 4 }} />Loading topics…</p>}
                        {calculatedHours > 0 && <p style={{ fontSize: 12, color: '#2dd4bf', textAlign: 'right', margin: 0 }}>{selectedCourseTopics.length} topics · <strong>{calculatedHoursRange ? `${calculatedHoursRange.min}–${calculatedHoursRange.max}h` : `${calculatedHours}h`}</strong></p>}
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={handleAddGoal} disabled={savingGoal || !newGoal.targetDate || (goalMode !== 'course' && !newGoal.subject) || (goalMode === 'course' && !ctCourseId)} style={{ ...btnPrimary, flex: 1, justifyContent: 'center', opacity: savingGoal ? 0.6 : 1, cursor: savingGoal ? 'not-allowed' : 'pointer' }}>
                        {savingGoal ? <Loader size={13} className="animate-spin" /> : null}Save Goal
                      </button>
                      <button onClick={resetGoalForm} style={{ ...btnSec, padding: '9px 16px' }}>Cancel</button>
                    </div>
                  </div>
                )}

                {goals.length === 0 ? (
                  <p style={{ fontSize: 13, color: T.text3, textAlign: 'center', padding: '16px 0' }}>Add goals to unlock AI Schedule generation!</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {goals.map(g => {
                      const d = differenceInDays(g.targetDate, new Date());
                      const prog = getGoalAIProgress(g);
                      return (
                        <div key={g.id} style={surfaceCard}>
                          {editingGoal?.id === g.id ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <p style={{ fontSize: 12, fontWeight: 600, color: T.primaryColor, margin: 0 }}>Edit Goal</p>
                                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: T.surface, border: `1px solid ${T.border}`, color: T.text2 }}>{editGoalMode === 'simple' ? 'Simple' : editGoalMode === 'topic' ? 'Topic-based' : 'Course-based'}</span>
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: editGoalMode === 'course' ? '1fr' : '1fr 1fr', gap: 8 }}>
                                {editGoalMode !== 'course' && <input value={editGoalData.subject} onChange={e => setEditGoalData(p => ({ ...p, subject: e.target.value }))} placeholder="Subject" className={inputCls} style={inputStyle} />}
                                <input type="date" value={editGoalData.targetDate} onChange={e => setEditGoalData(p => ({ ...p, targetDate: e.target.value }))} className={inputCls} style={inputStyle} />
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                <div><label style={lbl}>Difficulty</label>
                                  <select value={editGoalData.difficulty} onChange={e => setEditGoalData(p => ({ ...p, difficulty: e.target.value as any }))} className={inputCls} style={inputStyle}>
                                    <option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option>
                                  </select>
                                </div>
                                {editGoalMode === 'simple' ? (
                                  <div><label style={lbl}>Hours needed</label><input type="number" min={1} value={editGoalData.hoursNeeded} onChange={e => setEditGoalData(p => ({ ...p, hoursNeeded: Number(e.target.value) }))} className={inputCls} style={inputStyle} /></div>
                                ) : (
                                  <div><label style={lbl}>Study mode</label>
                                    <div style={{ display: 'flex', gap: 4 }}>
                                      {(['first_reading','revision'] as const).map(m => (
                                        <button key={m} type="button" onClick={() => setEditGoalStudyMode(m)} style={{ flex: 1, fontSize: 11, padding: '7px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: "'Outfit',sans-serif", background: editGoalStudyMode === m ? '#0d9488' : T.surface, color: editGoalStudyMode === m ? '#fff' : T.text2 }}>
                                          {m === 'first_reading' ? 'Read' : 'Revise'}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                              <div style={{ display: 'flex', gap: 8 }}>
                                <button type="button" onClick={handleSaveEditGoal} disabled={savingEditGoal || !editGoalData.targetDate || (editGoalMode !== 'course' && !editGoalData.subject)} style={{ ...btnPrimary, flex: 1, justifyContent: 'center', opacity: savingEditGoal ? 0.6 : 1, cursor: savingEditGoal ? 'not-allowed' : 'pointer' }}>
                                  {savingEditGoal ? <Loader size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}Save
                                </button>
                                <button type="button" onClick={() => setEditingGoal(null)} style={{ ...btnSec, padding: '9px 14px' }}>Cancel</button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                  <span style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{g.subject}</span>
                                  <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 20, background: g.difficulty === 'hard' ? 'rgba(239,68,68,0.15)' : g.difficulty === 'medium' ? 'rgba(245,158,11,0.15)' : 'rgba(34,197,94,0.15)', color: g.difficulty === 'hard' ? '#fca5a5' : g.difficulty === 'medium' ? '#fcd34d' : '#86efac' }}>{g.difficulty}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span style={{ fontSize: 11, color: d <= 3 ? '#f87171' : d <= 7 ? '#fbbf24' : T.text3 }}>{d > 0 ? `${d}d left` : d === 0 ? 'Due today' : 'Past due'}</span>
                                  <button onClick={() => handleOpenEditGoal(g)} style={{ padding: 4, color: T.text3, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Edit size={11} /></button>
                                  <button onClick={() => handleDeleteGoal(g.id)} style={{ padding: 4, color: T.text3, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Trash2 size={11} /></button>
                                </div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                <div style={{ flex: 1, height: 6, background: T.divider, borderRadius: 4, overflow: 'hidden' }}>
                                  <div style={{ height: '100%', background: T.gradient, borderRadius: 4, width: `${g.currentProgress}%`, transition: 'width 0.3s' }} />
                                </div>
                                <span style={{ fontSize: 12, color: T.text2, width: 36, textAlign: 'right' }}>{g.currentProgress}%</span>
                              </div>
                              <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
                                {[25,50,75,100].map(p => (
                                  <button key={p} onClick={() => handleUpdateGoalProgress(g.id, p)} style={{ flex: 1, padding: '5px 0', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600, fontFamily: "'Outfit',sans-serif", background: g.currentProgress >= p ? T.gradient : T.surface, color: g.currentProgress >= p ? '#fff' : T.text3, transition: 'all 0.15s' }}>{p}%</button>
                                ))}
                              </div>
                              {prog.totalSessions > 0 && (
                                <div style={{ background: T.divider, borderRadius: 10, padding: '10px 12px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                                    <span style={{ fontSize: 12, color: T.text2, display: 'flex', alignItems: 'center', gap: 6 }}>
                                      {prog.completedSessions}/{prog.totalSessions} sessions
                                      {prog.partialSessions > 0 && <span style={{ color: '#fbbf24', display: 'flex', alignItems: 'center', gap: 3 }}>· <Clock size={9} />{prog.partialSessions} partial</span>}
                                      {prog.behind && !prog.partialSessions && <span style={{ color: '#f87171' }}>· {prog.missedSessions} missed</span>}
                                    </span>
                                    <span style={{ fontSize: 11, color: T.text3 }}>{prog.sessionRate}%</span>
                                  </div>
                                  <div style={{ height: 6, background: T.surface, borderRadius: 4, overflow: 'hidden' }}>
                                    <div style={{ height: '100%', borderRadius: 4, background: prog.sessionRate === 100 ? '#22c55e' : prog.behind ? '#f59e0b' : T.primaryColor, width: `${Math.max(prog.sessionRate, 2)}%`, transition: 'width 0.3s' }} />
                                  </div>
                                  {prog.behind && prog.missedSessions > 0 && (
                                    <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                      <span style={{ fontSize: 11, color: '#f87171', display: 'flex', alignItems: 'center', gap: 4 }}><AlertTriangle size={10} />{prog.missedSessions} missed</span>
                                      <button onClick={handleOpenRecovery} style={{ fontSize: 11, background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', color: '#fcd34d', padding: '3px 8px', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontFamily: "'Outfit',sans-serif" }}><RefreshCw size={9} />Recover</button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </NoAnimCard>

              {/* Custom Activities */}
              <NoAnimCard>
                <button onClick={() => setShowActivitiesPanel(p => !p)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: showActivitiesPanel ? 12 : 0 }}>
                  <h2 style={{ fontSize: 15, fontWeight: 700, color: T.text, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Zap size={14} style={{ color: T.primaryColor }} /> Daily Activities
                    <span style={{ fontSize: 12, color: T.text3, fontWeight: 400 }}>({customActivities.length})</span>
                  </h2>
                  {showActivitiesPanel ? <ChevronUp size={14} style={{ color: T.text2 }} /> : <ChevronDown size={14} style={{ color: T.text2 }} />}
                </button>

                {showActivitiesPanel && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <p style={{ fontSize: 12, color: T.text3, margin: 0 }}>Add your regular commitments so AI can plan around them.</p>
                    {!showActivityForm && (
                      <button onClick={() => setShowActivityForm(true)} style={{ ...btnPrimary, alignSelf: 'flex-start', padding: '7px 12px', fontSize: 12 }}><Plus size={12} /> Add Activity</button>
                    )}
                    {showActivityForm && (
                      <div style={{ ...surfaceCard, display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                          <input value={newActivity.name} onChange={e => setNewActivity(p => ({ ...p, name: e.target.value }))} placeholder="Activity name" className={inputCls} style={inputStyle} />
                          <select value={newActivity.category} onChange={e => setNewActivity(p => ({ ...p, category: e.target.value as any }))} className={inputCls} style={inputStyle}>
                            {(['sport','job','hobby','family','religious','social','transport','other'] as const).map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase()+c.slice(1)}</option>)}
                          </select>
                        </div>
                        <div>
                          <label style={lbl}>Schedule Type</label>
                          <div style={{ display: 'flex', gap: 6 }}>
                            {(['recurring','specific_dates'] as const).map(t => (
                              <button key={t} type="button" onClick={() => setNewActivity(p => ({ ...p, scheduleType: t }))} style={{ flex: 1, fontSize: 12, padding: '7px 0', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 600, fontFamily: "'Outfit',sans-serif", background: newActivity.scheduleType === t ? T.primaryColor : T.surface, color: newActivity.scheduleType === t ? '#fff' : T.text2 }}>
                                {t === 'recurring' ? 'Weekly' : 'Specific Dates'}
                              </button>
                            ))}
                          </div>
                        </div>
                        {newActivity.scheduleType === 'recurring' ? (
                          <div>
                            <label style={lbl}>Days of week</label>
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                              {DAYS.map((day, i) => (
                                <button key={i} type="button" onClick={() => toggleActivityDay(i)} style={{ padding: '5px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: "'Outfit',sans-serif", background: newActivity.daysOfWeek.includes(i) ? T.primaryColor : T.surface, color: newActivity.daysOfWeek.includes(i) ? '#fff' : T.text2 }}>{day}</button>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div>
                            <label style={lbl}>Select dates</label>
                            <input type="date" min={new Date().toISOString().slice(0,10)} onChange={e => { const val = e.target.value; if (val && !newActivity.specificDates.includes(val)) setNewActivity(p => ({ ...p, specificDates: [...p.specificDates, val].sort() })); e.target.value = ''; }} className={inputCls} style={inputStyle} />
                            {newActivity.specificDates.length > 0 && (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                                {newActivity.specificDates.map(d => (
                                  <span key={d} style={{ display: 'flex', alignItems: 'center', gap: 4, background: `rgba(${T.pRgb},0.15)`, border: `1px solid rgba(${T.pRgb},0.3)`, color: T.primaryColor, fontSize: 11, padding: '3px 8px', borderRadius: 8 }}>
                                    {d}<button type="button" onClick={() => setNewActivity(p => ({ ...p, specificDates: p.specificDates.filter(x => x !== d) }))} style={{ color: T.text3, background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}><X size={10} /></button>
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                          <div><label style={lbl}>Start time</label><input type="time" value={newActivity.startTime} onChange={e => setNewActivity(p => ({ ...p, startTime: e.target.value }))} className={inputCls} style={inputStyle} /></div>
                          <div><label style={lbl}>End time</label><input type="time" value={newActivity.endTime} onChange={e => setNewActivity(p => ({ ...p, endTime: e.target.value }))} className={inputCls} style={inputStyle} /></div>
                        </div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: T.text2 }}>
                          <input type="checkbox" checked={newActivity.isFlexible} onChange={e => setNewActivity(p => ({ ...p, isFlexible: e.target.checked }))} style={{ width: 16, height: 16, accentColor: T.primaryColor }} />
                          Flexible — AI can schedule study over this if urgent
                        </label>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={handleSaveActivity} disabled={savingActivity || !newActivity.name || (newActivity.scheduleType === 'recurring' ? !newActivity.daysOfWeek.length : !newActivity.specificDates.length)} style={{ ...btnPrimary, flex: 1, justifyContent: 'center', opacity: savingActivity ? 0.6 : 1 }}>
                            {savingActivity ? <Loader size={13} className="animate-spin" /> : null}Save
                          </button>
                          <button onClick={() => setShowActivityForm(false)} style={{ ...btnSec, padding: '9px 16px' }}>Cancel</button>
                        </div>
                      </div>
                    )}
                    {customActivities.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {customActivities.map(a => (
                          <div key={a.id} style={surfaceCard}>
                            {editingActivity?.id === a.id ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                <p style={{ fontSize: 12, fontWeight: 600, color: T.primaryColor, margin: 0 }}>Edit Activity</p>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                  <input value={editActivityData.name} onChange={e => setEditActivityData(p => ({ ...p, name: e.target.value }))} placeholder="Activity name" className={inputCls} style={inputStyle} />
                                  <select value={editActivityData.category} onChange={e => setEditActivityData(p => ({ ...p, category: e.target.value as any }))} className={inputCls} style={inputStyle}>
                                    {(['sport','job','hobby','family','religious','social','transport','other'] as const).map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase()+c.slice(1)}</option>)}
                                  </select>
                                </div>
                                <div style={{ display: 'flex', gap: 6 }}>
                                  {(['recurring','specific_dates'] as const).map(t => (
                                    <button key={t} type="button" onClick={() => setEditActivityData(p => ({ ...p, scheduleType: t }))} style={{ flex: 1, fontSize: 12, padding: '6px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: "'Outfit',sans-serif", background: editActivityData.scheduleType === t ? T.primaryColor : T.surface, color: editActivityData.scheduleType === t ? '#fff' : T.text2 }}>{t === 'recurring' ? 'Weekly' : 'Dates'}</button>
                                  ))}
                                </div>
                                {editActivityData.scheduleType === 'recurring' ? (
                                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                    {DAYS.map((day, i) => <button key={i} type="button" onClick={() => toggleEditActivityDay(i)} style={{ padding: '5px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontFamily: "'Outfit',sans-serif", background: editActivityData.daysOfWeek.includes(i) ? T.primaryColor : T.surface, color: editActivityData.daysOfWeek.includes(i) ? '#fff' : T.text2 }}>{day}</button>)}
                                  </div>
                                ) : (
                                  <div>
                                    <input type="date" min={new Date().toISOString().slice(0,10)} onChange={e => { const val = e.target.value; if (val && !editActivityData.specificDates.includes(val)) setEditActivityData(p => ({ ...p, specificDates: [...p.specificDates, val].sort() })); e.target.value = ''; }} className={inputCls} style={inputStyle} />
                                    {editActivityData.specificDates.length > 0 && (
                                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                                        {editActivityData.specificDates.map(d => <span key={d} style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, background: `rgba(${T.pRgb},0.15)`, color: T.primaryColor, padding: '2px 7px', borderRadius: 8 }}>{d}<button type="button" onClick={() => setEditActivityData(p => ({ ...p, specificDates: p.specificDates.filter(x => x !== d) }))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.text3, padding: 0, display: 'flex' }}><X size={10} /></button></span>)}
                                      </div>
                                    )}
                                  </div>
                                )}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                  <div><label style={lbl}>Start time</label><input type="time" value={editActivityData.startTime} onChange={e => setEditActivityData(p => ({ ...p, startTime: e.target.value }))} className={inputCls} style={inputStyle} /></div>
                                  <div><label style={lbl}>End time</label><input type="time" value={editActivityData.endTime} onChange={e => setEditActivityData(p => ({ ...p, endTime: e.target.value }))} className={inputCls} style={inputStyle} /></div>
                                </div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                  <button onClick={handleSaveEditActivity} disabled={savingEditActivity || !editActivityData.name} style={{ ...btnPrimary, flex: 1, justifyContent: 'center', opacity: savingEditActivity ? 0.6 : 1 }}>{savingEditActivity ? <Loader size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}Save</button>
                                  <button onClick={() => setEditingActivity(null)} style={{ ...btnSec, padding: '9px 14px' }}>Cancel</button>
                                </div>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    {(() => { const Icon = CATEGORY_ICON[a.category] || Pin; return <Icon size={14} style={{ color: T.primaryColor }} />; })()}
                                    <span style={{ fontSize: 13, fontWeight: 600, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</span>
                                    {a.isFlexible && <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 20, background: 'rgba(34,197,94,0.15)', color: '#4ade80' }}>flexible</span>}
                                  </div>
                                  <p style={{ fontSize: 11, color: T.text3, margin: '3px 0 0 22px' }}>
                                    {a.scheduleType === 'specific_dates' && a.specificDates?.length ? a.specificDates.join(', ') : a.daysOfWeek.map(d => DAYS[d]).join(', ')} · {a.startTime}–{a.endTime}
                                  </p>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginLeft: 8 }}>
                                  <button onClick={() => handleOpenEditActivity(a)} style={{ padding: 6, color: T.text3, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Edit size={12} /></button>
                                  <button onClick={() => handleDeleteActivity(a.id)} style={{ padding: 6, color: T.text3, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Trash2 size={13} /></button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </NoAnimCard>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════ LIST VIEW ═══════════════════════════════ */}
      {view === 'list' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
          <style>{`@media(min-width:1024px){.sp-list-grid{grid-template-columns:2fr 1fr!important}}`}</style>
          <div className="sp-list-grid" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
            <NoAnimCard>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
                <div style={{ display: 'flex', gap: 4, background: T.surface, border: `1px solid ${T.border}`, padding: 4, borderRadius: 14 }}>
                  {[{id:'upcoming',label:'Upcoming',Icon:ListTodo},{id:'history',label:'History',Icon:History}].map(t => (
                    <button key={t.id} onClick={() => setListSubView(t.id as any)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 10, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: "'Outfit',sans-serif", background: listSubView === t.id ? T.gradient : 'transparent', color: listSubView === t.id ? '#fff' : T.text2 }}>
                      <t.Icon size={11} />{t.label}
                    </button>
                  ))}
                </div>
                {listSubView === 'history' && (
                  <div style={{ position: 'relative' }}>
                    <Search size={11} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: T.text3 }} />
                    <input value={historySearch} onChange={e => setHistorySearch(e.target.value)} placeholder="Search history…" className={inputCls} style={{ ...inputStyle, paddingLeft: 28, width: 160, padding: '7px 10px 7px 28px', fontSize: 12 }} />
                  </div>
                )}
              </div>

              {listSubView === 'upcoming' ? (
                <>
                  <p style={{ fontSize: 12, color: T.text3, margin: '0 0 12px' }}>{upcomingEvents.length} upcoming event{upcomingEvents.length !== 1 ? 's' : ''}</p>
                  {upcomingEvents.length === 0 ? (
                    <div style={{ padding: '40px 0', textAlign: 'center' }}><CalendarIcon size={36} style={{ color: T.text3, margin: '0 auto 12px', display: 'block' }} /><p style={{ fontSize: 13, color: T.text2, margin: 0 }}>No upcoming events</p></div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {upcomingEvents.map(ev => {
                        const d = differenceInDays(ev.date, new Date());
                        const typeColors: Record<string,string> = { assignment:'#f59e0b',exam:'#ef4444',class:'#6366f1',study_session:'#10b981',deadline:'#ec4899',personal:'#8b5cf6' };
                        const bc = typeColors[ev.eventType] || T.text3;
                        const Icon = TYPE_ICON[ev.eventType] || CalendarIcon;
                        return (
                          <div key={ev.id} style={{ ...surfaceCard, borderLeft: `4px solid ${bc}` }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                              <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
                                  <Icon size={13} style={{ color: T.text2, flexShrink: 0 }} />
                                  <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{ev.title}</span>
                                  {ev.isAIGenerated && <span style={{ fontSize: 11, background: 'rgba(139,92,246,0.15)', color: '#c4b5fd', padding: '2px 7px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 3 }}><Sparkles size={9} />AI</span>}
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, fontSize: 12, color: T.text2 }}>
                                  <span>{format(ev.date, 'EEE, MMM d')}</span>
                                  {ev.startTime && <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Clock size={11} />{ev.startTime}–{ev.endTime}</span>}
                                  {ev.course && <span>{ev.course}</span>}
                                  <span style={{ fontWeight: 700, color: d <= 1 ? '#f87171' : d <= 3 ? '#fbbf24' : T.text2 }}>{d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : `${d}d`}</span>
                                </div>
                                {renderSessionTopics(ev)}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                                {ev.isAIGenerated && ev.isPersonal && !ev.completed && (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                    <div style={{ display: 'flex', gap: 2, height: 6, width: 80, borderRadius: 4, overflow: 'hidden', cursor: 'pointer' }}>
                                      {[25,50,75,100].map(pct => <div key={pct} onClick={() => handleUpdateCompletionPercent(ev, pct)} style={{ flex: 1, background: (ev.completionPercent||0) >= pct ? (pct===100?'#10b981':'#f59e0b') : T.divider }} />)}
                                    </div>
                                    {(ev.completionPercent||0) > 0 && <span style={{ fontSize: 10, color: '#fbbf24' }}>{ev.completionPercent}%</span>}
                                  </div>
                                )}
                                <button onClick={() => handleToggleComplete(ev)} style={{ padding: 6, borderRadius: 8, border: 'none', cursor: 'pointer', background: ev.completed ? 'rgba(16,185,129,0.15)' : T.surface, color: ev.completed ? '#4ade80' : T.text2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CheckCircle2 size={13} /></button>
                                {ev.isPersonal && ev.studentId === user?.uid && (<>
                                  <button onClick={() => { setEditingEvent(ev); setShowModal(true); }} style={{ padding: 6, borderRadius: 8, border: 'none', cursor: 'pointer', background: T.surface, color: T.text2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Edit size={12} /></button>
                                  <button onClick={() => handleDelete(ev.id)} style={{ padding: 6, borderRadius: 8, border: 'none', cursor: 'pointer', background: T.surface, color: T.text2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Trash2 size={12} /></button>
                                </>)}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              ) : (() => {
                const historyEvents = events.filter(ev => ev.completed).filter(ev => !historySearch || ev.title.toLowerCase().includes(historySearch.toLowerCase()) || (ev.course||'').toLowerCase().includes(historySearch.toLowerCase())).sort((a,b) => b.date.getTime()-a.date.getTime());
                return (
                  <>
                    <p style={{ fontSize: 12, color: T.text3, margin: '0 0 12px' }}>{historyEvents.length} completed</p>
                    {historyEvents.length === 0 ? (
                      <div style={{ padding: '40px 0', textAlign: 'center' }}><History size={36} style={{ color: T.text3, margin: '0 auto 12px', display: 'block' }} /><p style={{ fontSize: 13, color: T.text2, margin: 0 }}>{historySearch ? 'No results' : 'No completed events yet'}</p></div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {historyEvents.map(ev => {
                          const typeColors: Record<string,string> = { assignment:'#f59e0b',exam:'#ef4444',class:'#6366f1',study_session:'#10b981',deadline:'#ec4899',personal:'#8b5cf6' };
                          return (
                            <div key={ev.id} style={{ ...surfaceCard, borderLeft: `4px solid ${typeColors[ev.eventType]||T.text3}`, opacity: 0.8 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <CheckCircle2 size={13} style={{ color: '#4ade80', flexShrink: 0 }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <p style={{ fontSize: 13, fontWeight: 500, color: T.text2, textDecoration: 'line-through', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.title}</p>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 11, color: T.text3 }}>
                                    <span>{format(ev.date,'EEE, MMM d, yyyy')}</span>
                                    {ev.startTime && <span>{ev.startTime}–{ev.endTime}</span>}
                                    {ev.course && <span>{ev.course}</span>}
                                  </div>
                                </div>
                                <button onClick={() => handleToggleComplete(ev)} title="Mark incomplete" style={{ padding: 6, color: T.text3, background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}><RotateCcw size={11} /></button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                );
              })()}
            </NoAnimCard>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <NoAnimCard>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: T.text, margin: '0 0 12px' }}>Goals Progress</h3>
                {goals.length === 0 ? <p style={{ fontSize: 12, color: T.text3 }}>No goals added</p> : goals.map(g => (
                  <div key={g.id} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: T.text, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 8 }}>{g.subject}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        <span style={{ fontSize: 11, color: T.text3 }}>{g.currentProgress}%</span>
                        <button onClick={() => handleOpenEditGoal(g)} style={{ padding: 2, color: T.text3, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Edit size={10} /></button>
                        <button onClick={() => handleDeleteGoal(g.id)} style={{ padding: 2, color: T.text3, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Trash2 size={10} /></button>
                      </div>
                    </div>
                    <div style={{ height: 6, background: T.divider, borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', background: T.gradient, borderRadius: 4, width: `${g.currentProgress}%`, transition: 'width 0.3s' }} />
                    </div>
                  </div>
                ))}
              </NoAnimCard>
              <NoAnimCard>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: T.text, margin: '0 0 12px' }}>By Event Type</h3>
                {['assignment','exam','class','study_session','deadline','personal'].map(t => {
                  const count = events.filter(e => e.eventType === t).length;
                  if (!count) return null;
                  const Icon = TYPE_ICON[t] || CalendarIcon;
                  return <div key={t} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0', borderBottom: `1px solid ${T.divider}` }}><span style={{ fontSize: 12, color: T.text2, textTransform: 'capitalize', display: 'flex', alignItems: 'center', gap: 6 }}><Icon size={11} />{t.replace('_',' ')}</span><span style={{ fontSize: 12, fontWeight: 700, color: T.text }}>{count}</span></div>;
                })}
              </NoAnimCard>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════ ANALYTICS VIEW ════════════════════════ */}
      {view === 'analytics' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 12 }}>
            {[
              { label:'Total Events', value:events.length, Icon:CalendarIcon, color:'#60a5fa', bg:'rgba(59,130,246,0.12)' },
              { label:'Completed', value:completedCount, Icon:CheckCircle2, color:'#4ade80', bg:'rgba(16,185,129,0.12)' },
              { label:'Upcoming', value:upcomingEvents.length, Icon:Clock, color:'#fcd34d', bg:'rgba(245,158,11,0.12)' },
              { label:'Active Goals', value:goals.length, Icon:Target, color:'#c4b5fd', bg:'rgba(139,92,246,0.12)' },
              { label:'Study Streak', value:`${streak.current}d`, Icon:Flame, color:'#fb923c', bg:'rgba(234,88,12,0.12)' },
              { label:'Pomodoros', value:streak.totalSessions, Icon:Timer, color:'#f9a8d4', bg:'rgba(236,72,153,0.12)' },
            ].map(s => (
              <div key={s.label} style={{ background: T.cardBg, border: `1px solid ${T.border}`, borderRadius: 16, padding: '16px' }}>
                <div style={{ width: 38, height: 38, background: s.bg, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}><s.Icon size={16} style={{ color: s.color }} /></div>
                <p style={{ fontSize: 24, fontWeight: 700, color: T.text, margin: '0 0 3px' }}>{s.value}</p>
                <p style={{ fontSize: 12, color: T.text2, margin: 0 }}>{s.label}</p>
              </div>
            ))}
            <div style={{ background: T.cardBg, border: `1px solid ${T.border}`, borderRadius: 16, padding: '16px', gridColumn: 'span 2' }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: T.text, margin: '0 0 12px' }}>Overall Completion</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1, height: 12, background: T.divider, borderRadius: 8, overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: T.gradient, borderRadius: 8, width: `${completionRate}%`, transition: 'width 0.5s' }} />
                </div>
                <span style={{ fontSize: 24, fontWeight: 700, color: T.text, width: 56, textAlign: 'right' }}>{completionRate}%</span>
              </div>
              <p style={{ fontSize: 12, color: T.text2, margin: '6px 0 0' }}>{completedCount} of {events.length} events completed</p>
            </div>
          </div>

          {subjectBreakdown.length > 0 && (
            <NoAnimCard>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: T.text, margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 6 }}><BarChart size={14} style={{ color: T.primaryColor }} />Subject Breakdown</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {subjectBreakdown.map(({ subject, total, completed, rate }) => (
                  <div key={subject}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, color: T.text, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 12 }}>{subject}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                        <span style={{ fontSize: 11, color: T.text3 }}>{completed}/{total}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: rate===100?'#4ade80':rate>=50?'#fbbf24':T.text2, width: 36, textAlign: 'right' }}>{rate}%</span>
                      </div>
                    </div>
                    <div style={{ height: 6, background: T.divider, borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 4, background: rate===100?'#22c55e':rate>=50?'#f59e0b':T.primaryColor, width: `${Math.max(rate,2)}%`, transition: 'width 0.3s' }} />
                    </div>
                  </div>
                ))}
              </div>
            </NoAnimCard>
          )}

          {aiReady && (
            <NoAnimCard>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: T.text, margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}><Brain size={14} style={{ color: '#a78bfa' }} />AI Study Pattern Analysis</h3>
                {!analyticsLoading && analyticsLoaded && (
                  <button onClick={() => { setStudyAnalytics(null); setAnalyticsLoaded(false); }} style={{ fontSize: 12, color: T.text2, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}><RefreshCw size={11} />Refresh</button>
                )}
              </div>
              {analyticsLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{[1,2,3].map(i => <div key={i} style={{ height: 14, background: T.divider, borderRadius: 6 }} />)}</div>
              ) : studyAnalytics ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                    {[{v:studyAnalytics.productivityScore,l:'Productivity'},{v:`${studyAnalytics.weeklyHours}h`,l:'Weekly Hrs'},{v:`${studyAnalytics.completionRate}%`,l:'Session Rate'}].map(s => (
                      <div key={s.l} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: '12px', textAlign: 'center' }}>
                        <p style={{ fontSize: 20, fontWeight: 700, color: T.text, margin: '0 0 3px' }}>{s.v}</p>
                        <p style={{ fontSize: 11, color: T.text2, margin: 0 }}>{s.l}</p>
                      </div>
                    ))}
                  </div>
                  {studyAnalytics.insights.length > 0 && <div><p style={{ fontSize: 12, fontWeight: 700, color: T.text2, margin: '0 0 8px' }}>Insights</p><ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>{studyAnalytics.insights.map((ins,i) => <li key={i} style={{ fontSize: 12, color: T.text2, display: 'flex', alignItems: 'flex-start', gap: 8 }}><Lightbulb size={11} style={{ color: '#fbbf24', flexShrink: 0, marginTop: 2 }} />{ins}</li>)}</ul></div>}
                  {studyAnalytics.recommendations.length > 0 && <div><p style={{ fontSize: 12, fontWeight: 700, color: T.text2, margin: '0 0 8px' }}>Recommendations</p><ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>{studyAnalytics.recommendations.map((rec,i) => <li key={i} style={{ fontSize: 12, color: T.text2, display: 'flex', alignItems: 'flex-start', gap: 8 }}><TrendingUp size={11} style={{ color: T.primaryColor, flexShrink: 0, marginTop: 2 }} />{rec}</li>)}</ul></div>}
                </div>
              ) : <p style={{ fontSize: 12, color: T.text3 }}>Analysis will appear once your session data is loaded.</p>}
            </NoAnimCard>
          )}
        </div>
      )}

      {/* ════════════════════════════════ AI CHAT VIEW ══════════════════════════ */}
      {view === 'chat' && (
        <NoAnimCard>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, paddingBottom: 16, borderBottom: `1px solid ${T.divider}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 38, height: 38, background: 'linear-gradient(135deg,#7c3aed,#6366f1)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Brain size={15} style={{ color: '#fff' }} /></div>
              <div>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: T.text, margin: 0 }}>Minerva — AI Study Companion</h2>
                <p style={{ fontSize: 12, color: T.text2, margin: '2px 0 0' }}>Plans sessions &amp; goals · reads your routine image</p>
              </div>
            </div>
            {chatMessages.length > 0 && <button onClick={handleClearChat} style={{ padding: 6, color: T.text3, background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}><Trash size={14} /></button>}
          </div>

          {pendingCalendarEvents.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(139,92,246,0.10)', border: '1px solid rgba(139,92,246,0.25)', borderRadius: 14, padding: '10px 14px', marginBottom: 12 }}>
              <Sparkles size={15} style={{ color: '#a78bfa', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#e9d5ff', margin: '0 0 2px' }}>Minerva created {pendingCalendarEvents.length} session{pendingCalendarEvents.length>1?'s':''}</p>
                <p style={{ fontSize: 11, color: '#c4b5fd', margin: 0 }}>Add them to your calendar?</p>
              </div>
              <button onClick={handleAddChatEventsToCalendar} disabled={addingChatEvents} style={{ ...btnPrimary, padding: '6px 12px', fontSize: 12, background: '#7c3aed', opacity: addingChatEvents ? 0.6 : 1, whiteSpace: 'nowrap' }}>
                {addingChatEvents ? <Loader size={11} className="animate-spin" /> : null}Add to Calendar
              </button>
              <button onClick={() => setPendingCalendarEvents([])} style={{ color: T.text3, background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}><X size={13} /></button>
            </div>
          )}

          {pendingGoals.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.22)', borderRadius: 14, padding: '10px 14px', marginBottom: 12 }}>
              <Target size={15} style={{ color: '#4ade80', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#bbf7d0', margin: '0 0 2px' }}>Minerva created {pendingGoals.length} goal{pendingGoals.length>1?'s':''}</p>
                <p style={{ fontSize: 11, color: '#86efac', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pendingGoals.map(g=>`${g.subject} (${g.difficulty}, ${g.targetDate})`).join(' · ')}</p>
              </div>
              <button onClick={handleAddChatGoals} disabled={addingChatGoals} style={{ ...btnPrimary, padding: '6px 12px', fontSize: 12, background: '#065f46', opacity: addingChatGoals ? 0.6 : 1, whiteSpace: 'nowrap' }}>
                {addingChatGoals ? <Loader size={11} className="animate-spin" /> : null}Add Goals
              </button>
              <button onClick={() => setPendingGoals([])} style={{ color: T.text3, background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}><X size={13} /></button>
            </div>
          )}

          {/* Messages */}
          <div style={{ height: 320, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14, paddingRight: 4 }}>
            {!chatHistoryLoaded && <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0' }}><Loader size={16} className="animate-spin" style={{ color: T.primaryColor }} /></div>}
            {chatHistoryLoaded && chatMessages.length === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <p style={{ fontSize: 13, color: T.text2, textAlign: 'center', padding: '16px 0', margin: 0 }}>Hi {user?.name||user?.displayName||'there'}! I'm Minerva, your study companion. Ask me anything!</p>
                {[`Help me create a study goal for my upcoming exam`,`Plan study sessions around my free time this week`,`What should I focus on given my current goals?`,`I uploaded my exam routine — help me plan around it`].map(p => (
                  <button key={p} onClick={() => setChatInput(p)} style={{ width: '100%', textAlign: 'left', fontSize: 12, background: T.surface, border: `1px solid ${T.border}`, color: T.text2, padding: '10px 12px', borderRadius: 12, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>{p}</button>
                ))}
              </div>
            )}
            {chatMessages.map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{ maxWidth: '82%', padding: '10px 14px', borderRadius: m.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px', fontSize: 13, lineHeight: 1.6, background: m.role === 'user' ? T.gradient : T.surface, border: m.role === 'user' ? 'none' : `1px solid ${T.border}`, color: m.role === 'user' ? '#fff' : T.text }}>
                  {m.content}
                  {m.calendarEvents && m.calendarEvents.length > 0 && (
                    <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.15)', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, opacity: 0.7 }}>
                      <CalendarIcon size={10} /> {m.calendarEvents.length} session{m.calendarEvents.length>1?'s':''} created
                    </div>
                  )}
                </div>
              </div>
            ))}
            {chatLoading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{ background: T.surface, border: `1px solid ${T.border}`, padding: '10px 14px', borderRadius: '18px 18px 18px 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Loader size={11} className="animate-spin" style={{ color: T.primaryColor }} />
                  <span style={{ fontSize: 12, color: T.text2 }}>Minerva is thinking…</span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Image preview */}
          {(chatImagePreview || chatImageOCRLoading) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: '8px 12px', marginBottom: 10 }}>
              {chatImagePreview && <img src={chatImagePreview} alt="Uploaded" style={{ height: 40, width: 56, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                {chatImageOCRLoading ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Loader size={11} className="animate-spin" style={{ color: T.primaryColor }} /><span style={{ fontSize: 12, color: T.text2 }}>Reading schedule image…</span></div>
                ) : chatImageText ? (
                  <div>
                    <p style={{ fontSize: 12, color: '#4ade80', margin: '0 0 2px', display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle2 size={10} /> Schedule image analyzed</p>
                    <p style={{ fontSize: 11, color: T.text3, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{chatImageText.slice(0,80)}…</p>
                  </div>
                ) : <p style={{ fontSize: 12, color: '#fbbf24', margin: 0 }}>Image ready — Minerva knows it's attached</p>}
              </div>
              <button onClick={() => { setChatImageFile(null); setChatImagePreview(''); setChatImageText(''); }} style={{ color: T.text3, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexShrink: 0 }}><X size={13} /></button>
            </div>
          )}

          {/* Input row */}
          <div style={{ display: 'flex', gap: 8 }}>
            <input ref={chatImageInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleChatImageSelect(f); e.target.value=''; }} />
            <button onClick={() => chatImageInputRef.current?.click()} disabled={chatLoading || chatImageOCRLoading} title="Upload exam routine or class schedule" style={{ padding: 10, background: T.surface, border: `1px solid ${T.border}`, color: T.text2, borderRadius: 12, cursor: 'pointer', display: 'flex', flexShrink: 0, opacity: chatLoading ? 0.4 : 1 }}><Paperclip size={15} /></button>
            <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => { if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); handleSendChat(); } }} placeholder={chatImageFile ? 'Add a message with your image (optional)…' : 'Ask Minerva anything about your studies…'} className={inputCls} style={{ ...inputStyle, flex: 1 }} />
            <button onClick={handleSendChat} disabled={(!chatInput.trim() && !chatImageFile) || chatLoading || chatImageOCRLoading || !aiReady} style={{ padding: 10, background: T.gradient, color: '#fff', border: 'none', borderRadius: 12, cursor: 'pointer', display: 'flex', flexShrink: 0, opacity: ((!chatInput.trim() && !chatImageFile) || chatLoading || !aiReady) ? 0.5 : 1 }}><Send size={15} /></button>
          </div>
          {!aiReady && <p style={{ fontSize: 12, color: '#fbbf24', margin: '8px 0 0', display: 'flex', alignItems: 'center', gap: 4 }}><AlertTriangle size={11} /> AI not configured — Admin → AI Model Settings</p>}
          <p style={{ fontSize: 11, color: T.text3, margin: '6px 0 0', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}><ImageIcon size={10} /> Tip: Upload your exam routine — Minerva will read and plan around it</p>
        </NoAnimCard>
      )}

      {/* ════════════════ ALL MODALS (already replaced with ModalShell above) ════ */}

      {/* ─── AI Schedule Modal ───────────────────────────────────────────────── */}
      {showScheduleModal && (
        <ModalShell onClose={() => setShowScheduleModal(false)} wide>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px 16px', borderBottom: `1px solid ${T.divider}`, flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 38, height: 38, borderRadius: 12, background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Brain size={17} style={{ color: '#a78bfa' }} />
              </div>
              <div>
                <h3 style={{ color: T.text, fontWeight: 700, fontSize: 16, margin: 0 }}>Your Study Schedule</h3>
                <p style={{ color: T.text3, fontSize: 11, margin: '2px 0 0' }}>{suggestions.length} sessions · based on {effectiveFreeHours}h/day</p>
              </div>
            </div>
            <button onClick={() => setShowScheduleModal(false)} style={{ padding: 6, color: T.text2, background: 'none', border: 'none', cursor: 'pointer', borderRadius: 8, display: 'flex' }}><X size={17} /></button>
          </div>
          {/* Body */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {suggestions.length === 0 ? (
              <p style={{ textAlign: 'center', color: T.text3, padding: '32px 0' }}>No sessions generated. Try adding more goals or adjusting your free hours.</p>
            ) : suggestions.map((s, i) => {
              const grouped: Record<string, Record<string, string[]>> = {};
              ((s as any).topicContext || []).forEach((tc: any) => {
                const subj = tc.subjectName || '';
                const chap = tc.chapterName || '';
                if (!grouped[subj]) grouped[subj] = {};
                if (!grouped[subj][chap]) grouped[subj][chap] = [];
                if (!grouped[subj][chap].includes(tc.topicName)) grouped[subj][chap].push(tc.topicName);
              });
              const hasHierarchy = Object.keys(grouped).some(k => k !== '');
              return (
                <div key={i} style={{ background: T.surface, border: `1px solid ${T.border}`, borderLeft: `4px solid ${s.priority === 'high' ? '#ef4444' : s.priority === 'medium' ? '#f59e0b' : '#22c55e'}`, borderRadius: 12, padding: '12px 14px' }}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <p style={{ fontSize: 14, fontWeight: 600, color: T.text, margin: '0 0 4px' }}>{s.title}</p>
                      <p style={{ fontSize: 12, color: T.text2, margin: '0 0 4px' }}>
                        {format(s.date, 'EEE, MMM d')} · {s.startTime}–{s.endTime}
                        <span style={{ marginLeft: 8, color: T.text3, textTransform: 'capitalize' }}>{s.sessionType}</span>
                      </p>
                      {hasHierarchy ? (
                        <div className="mt-1.5 space-y-0.5">
                          {Object.entries(grouped).map(([subj, chapters]) => subj ? (
                            <div key={subj}>
                              <div className="flex items-center gap-1 mb-0.5">
                                <BookOpen size={9} style={{ color: T.primaryColor }} />
                                <span style={{ fontSize: 10, fontWeight: 700, color: T.primaryColor, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{subj}</span>
                              </div>
                              {Object.entries(chapters).map(([chap, topics]) => (
                                <div key={chap} className="pl-3">
                                  {chap && <span style={{ fontSize: 10, color: T.text3 }}>{chap} · </span>}
                                  <span style={{ fontSize: 10, color: '#2dd4bf' }}>{topics.join(' · ')}</span>
                                </div>
                              ))}
                            </div>
                          ) : null)}
                        </div>
                      ) : (
                        <p style={{ fontSize: 12, color: '#c4b5fd', margin: 0 }}>{s.reason}</p>
                      )}
                    </div>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, flexShrink: 0, background: s.priority === 'high' ? 'rgba(239,68,68,0.15)' : s.priority === 'medium' ? 'rgba(245,158,11,0.15)' : 'rgba(34,197,94,0.15)', color: s.priority === 'high' ? '#fca5a5' : s.priority === 'medium' ? '#fcd34d' : '#86efac' }}>{s.priority}</span>
                  </div>
                </div>
              );
            })}
          </div>
          {/* Footer */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderTop: `1px solid ${T.divider}`, flexShrink: 0, flexWrap: 'wrap', gap: 8 }}>
            <p style={{ fontSize: 12, color: T.text3, margin: 0 }}>Sessions fit your free windows and avoid blocked activities.</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowScheduleModal(false)} style={{ padding: '9px 18px', background: T.btnSecBg, border: `1px solid ${T.btnSecBorder}`, color: T.text2, borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>Cancel</button>
              <button onClick={handleAcceptSchedule} disabled={addingSchedule || suggestions.length === 0}
                style={{ padding: '9px 20px', background: T.gradient, color: '#fff', border: 'none', borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: addingSchedule ? 'not-allowed' : 'pointer', opacity: addingSchedule ? 0.6 : 1, fontFamily: "'Outfit',sans-serif", display: 'flex', alignItems: 'center', gap: 6 }}>
                {addingSchedule ? <Loader size={13} className="animate-spin" /> : null}
                Add All to Planner
              </button>
            </div>
          </div>
        </ModalShell>
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
          existingEvents={events.map(e => ({ title: e.title, date: e.date, startTime: e.startTime, endTime: e.endTime, eventType: e.eventType }))}
        />
      )}

      {/* ─── Goal Edit Modal ─────────────────────────────────────────────────────── */}
      {editingGoal && view !== 'calendar' && (
        <ModalShell onClose={() => setEditingGoal(null)}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px 16px', borderBottom: `1px solid ${T.divider}`, flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 38, height: 38, borderRadius: 12, background: `rgba(${T.pRgb},0.15)`, border: `1px solid rgba(${T.pRgb},0.25)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Target size={17} style={{ color: T.primaryColor }} />
              </div>
              <h3 style={{ color: T.text, fontWeight: 700, fontSize: 16, margin: 0 }}>Edit Goal</h3>
            </div>
            <button onClick={() => setEditingGoal(null)} style={{ padding: 6, color: T.text2, background: 'none', border: 'none', cursor: 'pointer', borderRadius: 8, display: 'flex' }}><X size={17} /></button>
          </div>
          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <input value={editGoalData.subject} onChange={e => setEditGoalData(p => ({ ...p, subject: e.target.value }))} placeholder="Subject / Course" className={inputCls} style={inputStyle} />
              <input type="date" value={editGoalData.targetDate} onChange={e => setEditGoalData(p => ({ ...p, targetDate: e.target.value }))} className={inputCls} style={inputStyle} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: T.text2, marginBottom: 6, fontWeight: 600 }}>Hours needed</label>
                <input type="number" min={1} value={editGoalData.hoursNeeded} onChange={e => setEditGoalData(p => ({ ...p, hoursNeeded: Number(e.target.value) }))} className={inputCls} style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: T.text2, marginBottom: 6, fontWeight: 600 }}>Difficulty</label>
                <select value={editGoalData.difficulty} onChange={e => setEditGoalData(p => ({ ...p, difficulty: e.target.value as any }))} className={inputCls} style={inputStyle}>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, paddingTop: 8, borderTop: `1px solid ${T.divider}` }}>
              <button onClick={handleSaveEditGoal} disabled={savingEditGoal || !editGoalData.subject || !editGoalData.targetDate}
                style={{ flex: 1, padding: '10px 0', background: T.gradient, color: '#fff', border: 'none', borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: savingEditGoal ? 'not-allowed' : 'pointer', opacity: savingEditGoal ? 0.6 : 1, fontFamily: "'Outfit',sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                {savingEditGoal ? <Loader size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                Save Changes
              </button>
              <button onClick={() => setEditingGoal(null)} style={{ padding: '10px 20px', background: T.btnSecBg, border: `1px solid ${T.btnSecBorder}`, color: T.text2, borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>Cancel</button>
            </div>
          </div>
        </ModalShell>
      )}

      {/* ─── Reschedule Modal ────────────────────────────────────────────────────── */}
      {showRescheduleModal && (
        <ModalShell onClose={() => { setShowRescheduleModal(false); setReschedulePreview([]); }} wide>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px 14px', borderBottom: `1px solid ${T.divider}`, flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <RefreshCw size={15} style={{ color: '#fbbf24' }} />
              </div>
              <div>
                <h3 style={{ color: T.text, fontWeight: 700, fontSize: 15, margin: 0 }}>Reschedule — Pick up where you left off</h3>
                <p style={{ color: T.text3, fontSize: 11, margin: '2px 0 0' }}>AI keeps completed sessions and replans the rest</p>
              </div>
            </div>
            <button onClick={() => { setShowRescheduleModal(false); setReschedulePreview([]); }} style={{ padding: 6, color: T.text2, background: 'none', border: 'none', cursor: 'pointer', borderRadius: 8, display: 'flex' }}><X size={16} /></button>
          </div>

          {/* Body */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Goals overview */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {goals.map(g => {
                const prog = getGoalAIProgress(g);
                const dl = Math.max(0, differenceInDays(g.targetDate, new Date()));
                const baseSubj = g.subject.split(' (')[0];
                const partialEvts = events.filter(e => e.isAIGenerated && e.isPersonal && (e.course === g.subject || e.course === baseSubj || e.course?.startsWith(baseSubj)) && !e.completed && (e.completionPercent || 0) > 0);
                return (
                  <div key={g.id} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: '10px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' as const }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: T.text, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{g.subject}</span>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, flexShrink: 0, background: g.difficulty === 'hard' ? 'rgba(239,68,68,0.15)' : g.difficulty === 'medium' ? 'rgba(245,158,11,0.15)' : 'rgba(34,197,94,0.15)', color: g.difficulty === 'hard' ? '#fca5a5' : g.difficulty === 'medium' ? '#fcd34d' : '#86efac' }}>{g.difficulty}</span>
                      <span style={{ fontSize: 11, color: dl <= 2 ? '#f87171' : dl <= 5 ? '#fbbf24' : T.text3, flexShrink: 0 }}>{dl === 0 ? 'Due today' : `${dl}d left`}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 10, fontSize: 11, flexWrap: 'wrap' as const }}>
                      {prog.totalSessions > 0 ? <>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#4ade80' }}><CheckCircle2 size={10} />{prog.completedSessions} done</span>
                        {partialEvts.length > 0 && <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#fbbf24' }}><Clock size={10} />{partialEvts.length} partial</span>}
                        {prog.behind && <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#f87171' }}><AlertTriangle size={10} />{prog.missedSessions} missed</span>}
                        <span style={{ color: T.text3 }}>{prog.remainingSessions} remaining</span>
                      </> : <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: T.primaryColor }}><Sparkles size={10} />New — fresh plan</span>}
                    </div>
                    {prog.totalSessions > 0 && (
                      <div style={{ height: 4, background: T.divider, borderRadius: 4, overflow: 'hidden', marginTop: 8 }}>
                        <div style={{ height: '100%', borderRadius: 4, background: prog.behind ? '#f59e0b' : '#22c55e', width: `${Math.max(prog.sessionRate, 2)}%`, transition: 'width 0.3s' }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Info note */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.20)', borderRadius: 12, padding: '10px 14px' }}>
              <Lightbulb size={12} style={{ color: '#60a5fa', flexShrink: 0, marginTop: 2 }} />
              <p style={{ fontSize: 12, color: '#93c5fd', margin: 0, lineHeight: 1.5 }}>Completed sessions stay as history. The new plan continues from where you stopped — partial sessions included.</p>
            </div>

            {/* Free time config */}
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: T.text2, margin: 0 }}>When are you free each day?</p>
              <div style={{ display: 'flex', gap: 6, padding: 4, background: T.divider, borderRadius: 10, width: 'fit-content' }}>
                {(['hours', 'range'] as const).map(m => (
                  <button key={m} onClick={() => setFreeTimeMode(m)} style={{ fontSize: 12, padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontFamily: "'Outfit',sans-serif", background: freeTimeMode === m ? T.primaryColor : 'transparent', color: freeTimeMode === m ? '#fff' : T.text2, transition: 'all 0.15s' }}>
                    {m === 'hours' ? 'Set hours' : 'Time range'}
                  </button>
                ))}
              </div>
              {freeTimeMode === 'hours' ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <label style={{ fontSize: 12, color: T.text2 }}>Free hours/day:</label>
                  <select value={freeHoursPerDay} onChange={e => setFreeHoursPerDay(Number(e.target.value))} className={inputCls} style={{ ...inputStyle, width: 80, padding: '6px 10px', fontSize: 12 }}>
                    {[1, 2, 3, 4, 5, 6, 8].map(h => <option key={h} value={h}>{h}h</option>)}
                  </select>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {freeTimeRanges.map((r, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' as const }}>
                      <label style={{ fontSize: 12, color: T.text3, width: 32 }}>From</label>
                      <input type="time" value={r.start} onChange={e => setFreeTimeRanges(prev => prev.map((x, i) => i === idx ? { ...x, start: e.target.value } : x))} className={inputCls} style={{ ...inputStyle, width: 110, padding: '6px 10px', fontSize: 12 }} />
                      <label style={{ fontSize: 12, color: T.text3 }}>To</label>
                      <input type="time" value={r.end} onChange={e => setFreeTimeRanges(prev => prev.map((x, i) => i === idx ? { ...x, end: e.target.value } : x))} className={inputCls} style={{ ...inputStyle, width: 110, padding: '6px 10px', fontSize: 12 }} />
                      <span style={{ fontSize: 11, color: T.text3 }}>{Math.max(0, Math.round(rangeMinutes(r.start, r.end) / 60 * 10) / 10)}h</span>
                      {freeTimeRanges.length > 1 && <button onClick={() => setFreeTimeRanges(prev => prev.filter((_, i) => i !== idx))} style={{ color: T.text3, background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}><X size={13} /></button>}
                    </div>
                  ))}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4 }}>
                    <button onClick={() => setFreeTimeRanges(prev => [...prev, { start: '18:00', end: '20:00' }])} style={{ fontSize: 12, color: T.primaryColor, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}><Plus size={12} /> Add range</button>
                    <span style={{ fontSize: 11, color: T.text2 }}>= <strong style={{ color: T.text }}>{effectiveFreeHours}h</strong> free</span>
                  </div>
                </div>
              )}
            </div>

            {/* Generate button */}
            <button onClick={handleGenerateReschedule} disabled={rescheduling} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px 0', background: 'linear-gradient(135deg,#d97706 0%,#ea580c 100%)', color: '#fff', border: 'none', borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: rescheduling ? 'not-allowed' : 'pointer', opacity: rescheduling ? 0.6 : 1, fontFamily: "'Outfit',sans-serif" }}>
              {rescheduling ? <Loader size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              {rescheduling ? 'Calculating…' : reschedulePreview.length > 0 ? 'Recalculate' : 'Calculate New Plan'}
            </button>

            {/* Preview */}
            {reschedulePreview.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {rescheduleGoalStats.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {rescheduleGoalStats.map(gs => (
                      <div key={gs.goalId} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: T.text, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, marginRight: 8 }}>{gs.subject}</span>
                          <span style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, color: gs.canFullyCover ? '#4ade80' : '#fbbf24', flexShrink: 0 }}>
                            {gs.canFullyCover ? <><CheckCircle2 size={10} />Fully covered</> : <><AlertTriangle size={10} />Partial</>}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: 10, fontSize: 11, color: T.text2, flexWrap: 'wrap' as const }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle2 size={10} style={{ color: '#4ade80' }} />{gs.completedCount} done</span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><CalendarPlus size={10} style={{ color: T.primaryColor }} />+{gs.newSessionCount} new</span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={10} />{gs.hoursScheduled.toFixed(1)}h</span>
                        </div>
                        <div style={{ height: 4, background: T.divider, borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ height: '100%', borderRadius: 4, background: 'linear-gradient(90deg,#f59e0b,#ea580c)', width: `${gs.progressPct}%`, transition: 'width 0.3s' }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: T.text3 }}>
                          <span>{gs.hoursCompleted.toFixed(1)}h done</span>
                          <span>{gs.progressPct}% of {gs.hoursNeeded}h</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: T.text2, margin: 0 }}>{reschedulePreview.length} sessions planned</p>
                    <p style={{ fontSize: 11, color: T.text3, margin: 0 }}>Review before applying</p>
                  </div>
                  {reschedulePreview.map((s, i) => (
                    <div key={i} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: '10px 12px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <div style={{ width: 3, alignSelf: 'stretch', borderRadius: 4, flexShrink: 0, background: s.priority === 'high' ? '#ef4444' : s.priority === 'medium' ? '#f59e0b' : '#22c55e' }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 12, fontWeight: 600, color: T.text, margin: '0 0 2px' }}>{s.title}</p>
                        <p style={{ fontSize: 11, color: T.text2, margin: '0 0 2px' }}>{format(s.date, 'EEE, MMM d')} · {s.startTime}–{s.endTime} · <span style={{ textTransform: 'capitalize' as const }}>{s.sessionType}</span></p>
                        <p style={{ fontSize: 11, color: T.text3, margin: 0 }}>{s.reason}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, padding: '12px 20px', borderTop: `1px solid ${T.divider}`, flexShrink: 0 }}>
            <button onClick={() => { setShowRescheduleModal(false); setReschedulePreview([]); }} style={{ padding: '9px 18px', background: T.btnSecBg, border: `1px solid ${T.btnSecBorder}`, color: T.text2, borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>Cancel</button>
            <button onClick={handleAcceptReschedule} disabled={addingReschedule || reschedulePreview.length === 0} title="Replaces old uncompleted sessions. Completed sessions preserved."
              style={{ padding: '9px 20px', background: 'linear-gradient(135deg,#d97706 0%,#ea580c 100%)', color: '#fff', border: 'none', borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: (addingReschedule || reschedulePreview.length === 0) ? 'not-allowed' : 'pointer', opacity: (addingReschedule || reschedulePreview.length === 0) ? 0.5 : 1, fontFamily: "'Outfit',sans-serif", display: 'flex', alignItems: 'center', gap: 6 }}>
              {addingReschedule ? <Loader size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
              {addingReschedule ? 'Applying…' : 'Apply & Replace Plan'}
            </button>
          </div>
        </ModalShell>
      )}
      {/* ── Recovery Plan Modal (Today-only) ─────────────────────────────────── */}
      {showRecoveryModal && (
        <ModalShell onClose={() => { setShowRecoveryModal(false); setRecoveryPreview([]); setRecoveryNoSlots(false); setRecoveryUnscheduled([]); }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px 14px', borderBottom: `1px solid ${T.divider}`, flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <RefreshCw size={15} style={{ color: '#fbbf24' }} />
              </div>
              <div>
                <h3 style={{ color: T.text, fontWeight: 700, fontSize: 15, margin: 0 }}>Recover Today's Plan</h3>
                <p style={{ color: T.text3, fontSize: 11, margin: '2px 0 0' }}>Reschedules only today's missed &amp; upcoming sessions</p>
              </div>
            </div>
            <button onClick={() => { setShowRecoveryModal(false); setRecoveryPreview([]); setRecoveryNoSlots(false); setRecoveryUnscheduled([]); }} style={{ padding: 6, color: T.text2, background: 'none', border: 'none', cursor: 'pointer', borderRadius: 8, display: 'flex' }}><X size={16} /></button>
          </div>

          {/* Body */}
          <div style={{ padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' }}>
            {recoveryNoSlots ? (
              <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 12, padding: '20px 16px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={22} style={{ color: '#f87171' }} />
                <p style={{ fontSize: 13, fontWeight: 600, color: '#fca5a5', margin: 0 }}>No free time slots left today</p>
                <p style={{ fontSize: 12, color: T.text2, margin: 0, lineHeight: 1.5 }}>There isn't enough time today to fit any sessions. Use the <span style={{ color: '#fcd34d', fontWeight: 600 }}>Replan</span> button to reschedule across remaining days.</p>
              </div>
            ) : (
              <>
                <p style={{ fontSize: 12, color: T.text2, margin: 0, lineHeight: 1.5 }}>The following sessions will <strong style={{ color: T.text }}>replace today's uncompleted sessions only</strong>. Other days and completed sessions are untouched.</p>

                {recoveryUnscheduled.length > 0 && (
                  <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 12, padding: '10px 14px', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <AlertTriangle size={13} style={{ color: '#fbbf24', flexShrink: 0, marginTop: 2 }} />
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 600, color: '#fcd34d', margin: '0 0 4px' }}>Not enough time today for all sessions</p>
                      <p style={{ fontSize: 12, color: T.text2, margin: 0, lineHeight: 1.5 }}>
                        No free slots for <span style={{ color: '#fcd34d', fontWeight: 600 }}>{recoveryUnscheduled.join(', ')}</span> — kept as-is. Use <span style={{ color: '#fcd34d', fontWeight: 600 }}>Replan</span> to redistribute.
                      </p>
                    </div>
                  </div>
                )}

                <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {recoveryPreview.map((s, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10 }}>
                      <BookOpen size={13} style={{ color: '#4ade80', flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 12, fontWeight: 600, color: T.text, margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{s.title}</p>
                        <p style={{ fontSize: 11, color: T.text2, margin: 0 }}>{s.startTime} – {s.endTime} · {s.durationMins} min</p>
                      </div>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 8, fontWeight: 600, flexShrink: 0, background: s.priority === 'high' ? 'rgba(239,68,68,0.15)' : s.priority === 'medium' ? 'rgba(245,158,11,0.15)' : 'rgba(156,163,175,0.15)', color: s.priority === 'high' ? '#fca5a5' : s.priority === 'medium' ? '#fcd34d' : T.text3 }}>{s.priority}</span>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
                  <button onClick={() => { setShowRecoveryModal(false); setRecoveryPreview([]); setRecoveryUnscheduled([]); }} style={{ flex: 1, padding: '10px 0', background: T.btnSecBg, border: `1px solid ${T.btnSecBorder}`, color: T.text2, borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>Cancel</button>
                  <button onClick={handleAcceptRecovery} disabled={recoveryApplying} style={{ flex: 1, padding: '10px 0', background: 'linear-gradient(135deg,#d97706 0%,#ea580c 100%)', color: '#fff', border: 'none', borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: recoveryApplying ? 'not-allowed' : 'pointer', opacity: recoveryApplying ? 0.6 : 1, fontFamily: "'Outfit',sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    {recoveryApplying ? <Loader size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                    {recoveryApplying ? 'Applying…' : `Apply (${recoveryPreview.length} session${recoveryPreview.length !== 1 ? 's' : ''})`}
                  </button>
                </div>
              </>
            )}
          </div>
        </ModalShell>
      )}

      {/* ── Feature #13: Streak Freeze Prompt ────────────────────────────────── */}
      {showFreezePrompt && (
        <ModalShell onClose={() => setShowFreezePrompt(false)}>
          <div style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 42, height: 42, background: 'rgba(6,182,212,0.15)', border: '1px solid rgba(6,182,212,0.25)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Snowflake size={18} style={{ color: '#22d3ee' }} />
                </div>
                <div>
                  <h3 style={{ color: T.text, fontWeight: 700, fontSize: 16, margin: 0 }}>Streak Freeze</h3>
                  <p style={{ color: T.text3, fontSize: 11, margin: '2px 0 0' }}>You have {streakFreezeCount} freeze{streakFreezeCount !== 1 ? 's' : ''} remaining · +2/month · +1/week streak (max 10)</p>
                </div>
              </div>
              <button onClick={() => setShowFreezePrompt(false)} style={{ padding: 6, color: T.text2, background: 'none', border: 'none', cursor: 'pointer', borderRadius: 8, display: 'flex' }}><X size={16} /></button>
            </div>

            {freezeActiveUntil && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(6,182,212,0.10)', border: '1px solid rgba(6,182,212,0.25)', borderRadius: 12, padding: '10px 14px' }}>
                <Snowflake size={13} style={{ color: '#22d3ee', flexShrink: 0 }} />
                <p style={{ fontSize: 12, color: '#67e8f9', margin: 0 }}>Freeze active — streak protected until <strong>{freezeActiveUntil.toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })}</strong></p>
              </div>
            )}

            <p style={{ fontSize: 13, color: T.text2, margin: 0, lineHeight: 1.6 }}>Use a streak freeze to protect your <span style={{ fontWeight: 700, color: '#fb923c' }}>{streak.current}-day streak</span> for <span style={{ fontWeight: 700, color: '#22d3ee' }}>48 hours</span>. One freeze covers up to 2 missed days.</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <p style={{ fontSize: 12, color: T.text3, margin: 0 }}>🗓 +2 freezes added every month</p>
              <p style={{ fontSize: 12, color: T.text3, margin: 0 }}>🔥 +1 freeze for every 7-day streak with no freeze used</p>
            </div>

            <div style={{ display: 'flex', gap: 10, borderTop: `1px solid ${T.divider}`, paddingTop: 12 }}>
              <button onClick={handleUseStreakFreeze} disabled={streakFreezeCount <= 0}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 0', background: 'linear-gradient(135deg,#0891b2 0%,#06b6d4 100%)', color: '#fff', border: 'none', borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: streakFreezeCount <= 0 ? 'not-allowed' : 'pointer', opacity: streakFreezeCount <= 0 ? 0.4 : 1, fontFamily: "'Outfit',sans-serif" }}>
                <Snowflake size={14} />Use Freeze
              </button>
              <button onClick={() => setShowFreezePrompt(false)} style={{ padding: '10px 20px', background: T.btnSecBg, border: `1px solid ${T.btnSecBorder}`, color: T.text2, borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>Cancel</button>
            </div>
          </div>
        </ModalShell>
      )}

      {/* ── Feature #14: Goal Completion Celebration ──────────────────────────── */}
      {celebratingGoal && (
        <ModalShell onClose={() => setCelebratingGoal(null)}>
          <div style={{ padding: '28px 24px 22px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center' }}>
            <style>{`
              @keyframes celebPop { 0%{transform:scale(0) rotate(-10deg);opacity:0} 60%{transform:scale(1.15) rotate(3deg);opacity:1} 100%{transform:scale(1) rotate(0)} }
              .celeb-pop { animation: celebPop 0.5s cubic-bezier(.17,.67,.45,1.2) forwards; }
              @keyframes starFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
              .star-float { animation: starFloat 1.8s ease-in-out infinite; }
            `}</style>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 14 }}>
              {['#facc15', '#fb923c', '#fbbf24'].map((c, i) => (
                <Star key={i} size={22} className="star-float" style={{ color: c, fill: c, animationDelay: `${i * 0.2}s` }} />
              ))}
            </div>
            <div className="celeb-pop">
              <div style={{ width: 60, height: 60, background: 'linear-gradient(135deg,#eab308,#f97316)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 32px rgba(234,179,8,0.30)' }}>
                <Award size={26} style={{ color: '#fff' }} />
              </div>
            </div>
            <div>
              <h3 style={{ color: T.text, fontWeight: 700, fontSize: 18, margin: '0 0 8px' }}>Goal Complete! 🎉</h3>
              <p style={{ fontSize: 13, color: T.text2, margin: 0, lineHeight: 1.6 }}>
                You finished <span style={{ fontWeight: 700, color: '#fcd34d' }}>{celebratingGoal.subject}</span>. Excellent work — keep the momentum going!
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10, width: '100%', borderTop: `1px solid ${T.divider}`, paddingTop: 14 }}>
              <button onClick={() => { setCelebratingGoal(null); setView('calendar'); }}
                style={{ flex: 1, padding: '10px 0', background: 'linear-gradient(135deg,#ca8a04 0%,#ea580c 100%)', color: '#fff', border: 'none', borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>
                Set New Goal
              </button>
              <button onClick={() => setCelebratingGoal(null)} style={{ padding: '10px 20px', background: T.btnSecBg, border: `1px solid ${T.btnSecBorder}`, color: T.text2, borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>Close</button>
            </div>
          </div>
        </ModalShell>
      )}
    </div>
  );
};

export default StudentStudyPlan;
