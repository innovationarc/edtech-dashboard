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
  const freeTimePanelRef = useRef<HTMLDivElement>(null);

  // Close free-time panel on outside click
  useEffect(() => {
    if (!showFreeTimePanel) return;
    const handler = (e: MouseEvent) => {
      if (freeTimePanelRef.current && !freeTimePanelRef.current.contains(e.target as Node)) {
        setShowFreeTimePanel(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showFreeTimePanel]);

  // Load free time prefs from Firestore (per user)
  useEffect(() => {
    if (!user) return;
    studyPlanService.getFreeTimePrefs(user.uid).then(prefs => {
      if (prefs) {
        setFreeTimeMode(prefs.mode);
        setFreeHoursPerDay(prefs.hours);
        if (prefs.ranges.length > 0) setFreeTimeRanges(prefs.ranges);
        setFreeTimeConfigured(true);
      }
    }).catch(() => {});
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Save free time prefs to Firestore — called explicitly via Save button
  const [freeTimeSaving, setFreeTimeSaving] = useState(false);
  const [freeTimeSaved, setFreeTimeSaved]   = useState(false);
  const handleSaveFreeTime = async () => {
    if (!user) return;
    setFreeTimeSaving(true);
    try {
      await studyPlanService.saveFreeTimePrefs(user.uid, { mode: freeTimeMode, hours: freeHoursPerDay, ranges: freeTimeRanges });
      setFreeTimeConfigured(true);
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
        ...(hasTopics ? { topics: finalTopics, studyMode: editGoalStudyMode } : { topics: [], studyMode: undefined }),
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
                  {chap && <span className="text-[10px] text-gray-500">{chap} · </span>}
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
        {extra > 0 && <span className="text-[10px] text-gray-500">+{extra}</span>}
      </div>
    );
  };

  if (loading) return <PageSkeleton variant="mixed" />;

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
          {/* Free time selector — click to open panel with hours or multi-range mode */}
          {aiReady && goals.length > 0 && (
            <div className="relative" ref={freeTimePanelRef}>
              <button
                onClick={() => setShowFreeTimePanel(p => !p)}
                className="flex items-center gap-2 bg-background-800 border border-background-700 hover:border-primary-500/50 rounded-xl px-3 py-2 transition-colors"
                title="Set your free time"
              >
                <Clock size={12} className="text-gray-400" />
                <span className="text-xs text-gray-400">Free time:</span>
                <span className="text-xs font-semibold text-white">
                  {!freeTimeConfigured
                    ? <span className="text-amber-400">Set free time ▸</span>
                    : freeTimeMode === 'range'
                      ? freeTimeRanges.length === 1
                        ? `${effectiveFreeHours}h · ${freeTimeRanges[0].start}–${freeTimeRanges[0].end}`
                        : `${effectiveFreeHours}h · ${freeTimeRanges.length} ranges`
                      : `${freeHoursPerDay}h/day`}
                </span>
                <ChevronDown size={11} className={`text-gray-400 transition-transform ${showFreeTimePanel ? 'rotate-180' : ''}`} />
              </button>

              {showFreeTimePanel && (
                <div className="absolute right-0 top-full mt-2 z-40 w-full sm:w-80 max-w-[calc(100vw-1rem)] bg-background-900 border border-background-700 rounded-2xl shadow-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-gray-300">When are you free each day?</p>
                    <button onClick={() => setShowFreeTimePanel(false)} className="text-gray-500 hover:text-white"><X size={13} /></button>
                  </div>
                  {/* Mode toggle */}
                  <div className="flex gap-1.5 p-1 bg-background-700 rounded-lg">
                    {(['hours', 'range'] as const).map(m => (
                      <button
                        key={m}
                        onClick={() => setFreeTimeMode(m)}
                        className={`flex-1 text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${freeTimeMode === m ? 'bg-primary-600 text-white' : 'text-gray-400 hover:text-white'}`}
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
                        onChange={e => { setFreeHoursPerDay(Number(e.target.value)); setFreeTimeConfigured(true); }}
                        className="bg-background-700 border border-background-600 text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-primary-500"
                      >
                        {[1, 2, 3, 4, 5, 6, 8, 10].map(h => <option key={h} value={h}>{h}h</option>)}
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
                            onChange={e => { setFreeTimeRanges(prev => prev.map((x, i) => i === idx ? { ...x, start: e.target.value } : x)); setFreeTimeConfigured(true); }}
                            className="bg-background-700 border border-background-600 text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-primary-500"
                          />
                          <label className="text-xs text-gray-400">To</label>
                          <input
                            type="time"
                            value={r.end}
                            onChange={e => { setFreeTimeRanges(prev => prev.map((x, i) => i === idx ? { ...x, end: e.target.value } : x)); setFreeTimeConfigured(true); }}
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
                  <button onClick={handleSaveFreeTime} disabled={freeTimeSaving} className="w-full flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white text-xs font-semibold py-2 rounded-xl transition-colors mt-1">{freeTimeSaving ? <Loader size={12} className="animate-spin" /> : freeTimeSaved ? <CheckCircle2 size={12} /> : <Download size={12} />}{freeTimeSaving ? 'Saving…' : freeTimeSaved ? 'Saved!' : 'Save free time'}</button>
                </div>
              )}
            </div>
          )}
          {goals.length > 0 && (
            <button
              onClick={hasExistingAIPlan ? handleOpenReschedule : handleGenerateSchedule}
              disabled={scheduleLoading}
              className={`flex items-center gap-2 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed ${
                hasExistingAIPlan
                  ? 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700'
                  : 'bg-gradient-to-r from-purple-600 to-primary-600 hover:from-purple-700 hover:to-primary-700'
              }`}
            >
              {scheduleLoading
                ? <Loader size={14} className="animate-spin" />
                : hasExistingAIPlan ? <RefreshCw size={14} /> : <Brain size={14} />}
              {scheduleLoading ? 'Scheduling…' : hasExistingAIPlan ? 'Reschedule' : 'Schedule'}
            </button>
          )}
          <button
            onClick={() => { setEditingEvent(null); setShowModal(true); }}
            className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all"
          >
            <Plus size={14} /> Add Event
          </button>
          {helpVideoUrl && (
            <button
              onClick={handleOpenHelpVideo}
              className="flex items-center gap-2 bg-background-800 border border-background-700 hover:border-primary-500/50 text-gray-300 hover:text-white px-4 py-2 rounded-xl text-sm font-medium transition-all"
              title="Watch the guide video"
            >
              <Video size={14} className="text-primary-400" /> Watch Guide
            </button>
          )}
          {events.length > 0 && (
            <button
              onClick={handleExportICS}
              className="flex items-center gap-2 bg-background-800 border border-background-700 hover:border-emerald-500/50 text-gray-300 hover:text-white px-4 py-2 rounded-xl text-sm font-medium transition-all"
              title="Export all events to .ics (Google Calendar, Apple Calendar, etc.)"
            >
              <Download size={14} className="text-emerald-400" /> Export
            </button>
          )}
        </div>
      </div>

      {/* ── Help Video Popup ── */}
      {showHelpPopup && helpVideoUrl && (
        <ModalShell onClose={handleDismissHelpPopup}>
          <div style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ width: 42, height: 42, background: `rgba(${T.pRgb},0.15)`, border: `1px solid rgba(${T.pRgb},0.25)`, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Video size={18} style={{ color: T.primaryColor }} />
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ color: T.text, fontWeight: 700, fontSize: 15, margin: '0 0 4px' }}>Confused about the Study Planner?</h3>
                <p style={{ fontSize: 12, color: T.text2, margin: 0, lineHeight: 1.5 }}>Watch a short guide video to learn how to use the Study Planner effectively.</p>
              </div>
              <button onClick={handleDismissHelpPopup} style={{ padding: 6, color: T.text2, background: 'none', border: 'none', cursor: 'pointer', borderRadius: 8, display: 'flex', flexShrink: 0 }}><X size={15} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: `1px solid ${T.divider}`, paddingTop: 12 }}>
              <button onClick={() => { handleOpenHelpVideo(); handleDismissHelpPopup(); }}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 0', background: T.gradient, color: '#fff', border: 'none', borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>
                <Video size={14} /> Watch Guide Video
              </button>
              <button onClick={handleDismissHelpPopup}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px 0', background: T.btnSecBg, border: `1px solid ${T.btnSecBorder}`, color: T.text2, borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>
                I'm good, skip for now
              </button>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' as const }}>
              <input type="checkbox" checked={dontShowAgain} onChange={e => setDontShowAgain(e.target.checked)} style={{ width: 16, height: 16, cursor: 'pointer', accentColor: T.primaryColor }} />
              <span style={{ fontSize: 12, color: T.text3 }}>Don't show this again</span>
            </label>
          </div>
        </ModalShell>
      )}

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
          { label: 'Streak',      value: streak.current,                             extra: `Best: ${streak.longest}d`,                                                    cls: 'from-orange-600/20 to-red-600/20 border-orange-500/20',     id: 'streak' },
          { label: 'This Week',   value: thisWeekEvents.length,                      extra: `${todayEvents.length} today`,                                                 cls: 'from-blue-600/20 to-indigo-600/20 border-blue-500/20',      id: 'week' },
          { label: 'Completion',  value: `${completionRate}%`,                       extra: `${completedCount}/${events.length} done`,                                     cls: 'from-emerald-600/20 to-green-600/20 border-emerald-500/20', id: 'comp' },
          { label: 'Goals',       value: goals.filter(g => g.isActive).length,       extra: `${goals.filter(g => g.currentProgress >= 100).length} completed`,             cls: 'from-purple-600/20 to-violet-600/20 border-purple-500/20',  id: 'goals' },
        ].map(s => (
          <div key={s.label} className={`bg-gradient-to-br ${s.cls} border rounded-2xl p-4 relative`}>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">{s.label}</p>
            <p className="text-2xl font-bold text-white">{s.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{s.extra}</p>
            {/* Feature #13: Streak freeze indicator on the streak card */}
            {s.id === 'streak' && (
              <button
                onClick={() => setShowFreezePrompt(true)}
                title={freezeActiveUntil ? `Freeze active until ${freezeActiveUntil.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Use a streak freeze to protect your streak'}
                className={`absolute top-3 right-3 flex items-center gap-1 border text-xs px-1.5 py-0.5 rounded-full transition-colors ${freezeActiveUntil ? 'bg-cyan-500/30 border-cyan-400/60 text-cyan-200 animate-pulse' : streakFreezeCount > 0 ? 'bg-cyan-500/20 border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/30' : 'bg-background-700 border-background-600 text-gray-500 cursor-default'}`}
              >
                <Snowflake size={9} />{streakFreezeCount}
              </button>
            )}
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
            <NoAnimCard>
              <h2 className="text-base font-semibold text-white mb-4">Calendar</h2>
              <div className="custom-calendar">
                <style>{`.react-calendar__month-view__days__day--weekend { color: inherit !important; } .react-calendar__month-view__days__day--weekend abbr { color: inherit !important; }`}</style>
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
            </NoAnimCard>

            {/* Pomodoro Timer */}
            <NoAnimCard>
              <h2 className="text-base font-semibold text-white mb-3 flex items-center gap-2">
                <Timer size={14} className="text-primary-400" /> Focus Timer
                {pomodoroSessionCount > 0 && (
                  <span className="text-xs bg-primary-500/15 text-primary-300 px-2 py-0.5 rounded-full">
                    {pomodoroSessionCount} session{pomodoroSessionCount > 1 ? 's' : ''} today
                  </span>
                )}
                <button
                  onClick={() => setPomodoroSoundEnabled(p => !p)}
                  title={pomodoroSoundEnabled ? 'Sound on — click to mute' : 'Sound off — click to enable'}
                  className={`ml-auto p-1.5 rounded-lg transition-colors ${pomodoroSoundEnabled ? 'text-primary-400 bg-primary-500/10 hover:bg-primary-500/20' : 'text-gray-600 bg-background-700 hover:text-gray-400'}`}
                >
                  {pomodoroSoundEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
                </button>
              </h2>

              {/* Ring */}
              <div className="relative flex justify-center items-center mb-3 h-32">
                <svg width="128" height="128" className="-rotate-90" style={{ position: 'absolute' }}>
                  <circle cx="64" cy="64" r="54" strokeWidth="8" stroke="#1f2937" fill="none" />
                  <circle cx="64" cy="64" r="54" strokeWidth="8"
                    stroke={pomodoroMode === 'focus' ? '#6366f1' : pomodoroMode === 'short' ? '#10b981' : '#f59e0b'}
                    fill="none"
                    strokeDasharray={circumference}
                    strokeDashoffset={circumference * (1 - pct / 100)}
                    strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s linear' }} />
                </svg>
                <div className="relative text-center z-10">
                  <span className="text-2xl font-bold text-white font-mono">{pMins}:{pSecs}</span>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {pomodoroMode === 'short' ? 'Short Break' : pomodoroMode === 'long' ? 'Long Break' : 'Focus'}
                  </p>
                  {/* Session dots: 4 dots, filled per completed focus session in this sitting */}
                  <div className="flex gap-1 justify-center mt-1">
                    {[0, 1, 2, 3].map(i => (
                      <div key={i} className={`w-1.5 h-1.5 rounded-full ${i < (pomodoroSessionCount % 4) ? 'bg-primary-400' : 'bg-background-600'}`} />
                    ))}
                  </div>
                </div>
              </div>

              {/* Mode tabs */}
              <div className="flex gap-1.5 mb-3">
                {(['focus', 'short', 'long'] as const).map(m => (
                  <button key={m} onClick={() => resetPomodoro(m)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${pomodoroMode === m ? 'bg-primary-600 text-white' : 'bg-background-700 text-gray-400 hover:text-white'}`}>
                    {m === 'focus' ? '25 min' : m === 'short' ? '5 min' : '15 min'}
                  </button>
                ))}
              </div>

              {/* Subject picker — choose from today's events or type manually */}
              <div className="mb-2">
                <label className="text-xs text-gray-500 mb-1 block">What are you studying?</label>
                <select
                  value={pomodoroLinkedEvent || pomodoroSubject}
                  onChange={e => {
                    const val = e.target.value;
                    const matched = todayEvents.find(ev => ev.id === val);
                    if (matched) {
                      setPomodoroLinkedEvent(matched.id);
                      setPomodoroSubject(matched.course || matched.title);
                    } else {
                      setPomodoroLinkedEvent('');
                      setPomodoroSubject(val);
                    }
                  }}
                  className={inputCls + ' mb-1.5'}
                >
                  <option value="">— Pick a session or type below —</option>
                  {todayEvents.filter(e => !e.completed).map(ev => (
                    <option key={ev.id} value={ev.id}>{ev.title} ({ev.startTime}–{ev.endTime})</option>
                  ))}
                </select>
                {!pomodoroLinkedEvent && (
                  <input
                    value={pomodoroSubject}
                    onChange={e => setPomodoroSubject(e.target.value)}
                    placeholder="Or type subject manually…"
                    className={inputCls} style={inputStyle}
                  style={inputStyle}
                  />
                )}
                {pomodoroLinkedEvent && (
                  <p className="text-xs text-primary-400 flex items-center gap-1 mt-1">
                    <CheckCircle2 size={10} /> Progress auto-updates on linked session
                  </p>
                )}
              </div>

              {/* Controls */}
              <div className="flex gap-2 mt-3">
                <button onClick={startPomodoro}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${pomodoroActive ? 'bg-amber-600 hover:bg-amber-700' : 'bg-primary-600 hover:bg-primary-700'} text-white`}>
                  {pomodoroActive ? <><Pause size={13} />Pause</> : <><Play size={13} />Start</>}
                </button>
                <button onClick={() => resetPomodoro(pomodoroMode)} title="Reset timer" className="p-2.5 bg-background-700 hover:bg-background-600 text-gray-400 hover:text-white rounded-xl transition-colors">
                  <RotateCcw size={14} />
                </button>
                {pomodoroSessionCount > 0 && (
                  <button onClick={resetPomodoroSitting} title="Reset session count" className="p-2.5 bg-background-700 hover:bg-red-500/20 text-gray-400 hover:text-red-400 rounded-xl transition-colors">
                    <Trash size={14} />
                  </button>
                )}
              </div>

              {/* Stats footer */}
              <div className="mt-3 pt-3 border-t border-background-700 grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-sm font-bold text-white">{streak.totalSessions}</p>
                  <p className="text-xs text-gray-500">Total</p>
                </div>
                <div>
                  <p className="text-sm font-bold text-white">{pomodoroTodayMinutes}m</p>
                  <p className="text-xs text-gray-500">Today</p>
                </div>
                <div>
                  <p className="text-sm font-bold text-white">{Math.round(streak.totalSessions * 25 / 60)}h</p>
                  <p className="text-xs text-gray-500">All time</p>
                </div>
              </div>

              {/* Break suggestion after 4 sessions */}
              {pomodoroSessionCount > 0 && pomodoroSessionCount % 4 === 0 && pomodoroMode !== 'long' && !pomodoroActive && (
                <div className="mt-2 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2 flex items-center gap-2">
                  <Coffee size={12} className="text-amber-400 flex-shrink-0" />
                  <p className="text-xs text-amber-300">4 sessions done — take a long break!</p>
                  <button onClick={() => resetPomodoro('long')} className="ml-auto text-xs text-amber-400 hover:text-amber-300 font-medium whitespace-nowrap">15 min break</button>
                </div>
              )}
            </NoAnimCard>
          </div>

          {/* Right column */}
          <div className="lg:col-span-2 space-y-4">

            {/* Events for selected day */}
            <div ref={dayEventsRef}>
            <NoAnimCard>
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
                    let isExpired = ev.expired === true; // Firestore-persisted expiry flag
                    if (!isExpired && ev.isAIGenerated && !ev.completed) {
                      const baseSubject = ev.course?.split(' (')[0] || '';
                      const linkedGoal = goals.find(
                        g => g.subject === ev.course || g.subject.split(' (')[0] === baseSubject
                      );
                      // Only expired if the goal deadline has passed
                      isExpired = linkedGoal ? now > linkedGoal.targetDate : false;
                    } else if (!isExpired && !ev.isAIGenerated && !ev.completed) {
                      const msSince = now.getTime() - ev.date.getTime();
                      isExpired = msSince > 0 && msSince < 24 * 60 * 60 * 1000;
                    }
                    return (
                    <div key={ev.id} className={`bg-background-800 rounded-xl p-4 border-l-4 ${TYPE_COLOR[ev.eventType] || 'border-gray-500'} ${ev.completed ? 'opacity-60' : ''}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center flex-wrap gap-2 mb-1.5">
                            <span>{(() => { const Icon = TYPE_ICON[ev.eventType] || CalendarIcon; return <Icon size={13} className="text-gray-400 flex-shrink-0" />; })()}</span>
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
                          {renderSessionTopics(ev)}
                          {/* Progress bar — only for uncompleted AI sessions */}
                          {ev.isAIGenerated && ev.isPersonal && !ev.completed && (
                            <div className="mt-2 space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-gray-500">Session progress</span>
                                <span className={`text-xs font-medium ${(ev.completionPercent || 0) > 0 ? 'text-amber-400' : 'text-gray-600'}`}>
                                  {(ev.completionPercent || 0) > 0 ? `${ev.completionPercent}% done` : 'Not started'}
                                </span>
                              </div>
                              {/* Clickable segmented bar: tap a segment to set % */}
                              <div className="flex gap-0.5 h-2 rounded-full overflow-hidden cursor-pointer">
                                {[25, 50, 75, 100].map(pct => (
                                  <div
                                    key={pct}
                                    onClick={() => handleUpdateCompletionPercent(ev, pct)}
                                    title={pct === 100 ? 'Mark complete' : `Mark ${pct}% done`}
                                    className={`flex-1 transition-all hover:opacity-80 ${
                                      (ev.completionPercent || 0) >= pct
                                        ? pct === 100 ? 'bg-emerald-500' : 'bg-amber-500'
                                        : 'bg-background-600 hover:bg-background-500'
                                    }`}
                                  />
                                ))}
                              </div>
                              <div className="flex justify-between text-xs text-gray-700 select-none px-0.5">
                                <span>25%</span><span>50%</span><span>75%</span><span className="flex items-center"><CheckCircle2 size={9} /></span>
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button onClick={() => handleToggleComplete(ev)}
                            title={ev.completed ? 'Mark incomplete' : 'Mark complete'}
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
            </NoAnimCard>
            </div>

            {/* Study Goals */}
            <NoAnimCard>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-white flex items-center gap-2">
                  <Target size={14} className="text-primary-400" />Study Goals
                </h2>
                <div className="flex items-center gap-2">
                  {goals.length > 0 && goals.some(g => getGoalAIProgress(g).totalSessions > 0) && (
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
                  {/* Mode tabs */}
                  <div className="flex gap-1 bg-background-800 p-1 rounded-lg">
                    {(['simple','topic','course'] as GoalMode[]).map(m => (
                      <button key={m} onClick={() => setGoalMode(m)}
                        className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-colors ${goalMode === m ? 'bg-primary-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                        {m === 'simple' ? 'Simple' : m === 'topic' ? 'Add Topics' : 'From Course'}
                      </button>
                    ))}
                  </div>

                  {/* Subject — manual for simple/topic; auto-filled from course (hidden) */}
                  {goalMode !== 'course' ? (
                    <div className="grid grid-cols-2 gap-3">
                      <input value={newGoal.subject} onChange={e => setNewGoal(p => ({ ...p, subject: e.target.value }))} placeholder="Subject / Course" className={inputCls} style={inputStyle} />
                      <input type="date" value={newGoal.targetDate} onChange={e => setNewGoal(p => ({ ...p, targetDate: e.target.value }))} className={inputCls} style={inputStyle} />
                    </div>
                  ) : (
                    <input type="date" value={newGoal.targetDate} onChange={e => setNewGoal(p => ({ ...p, targetDate: e.target.value }))} className={inputCls} style={inputStyle} />
                  )}

                  {/* Simple mode */}
                  {goalMode === 'simple' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-gray-400 mb-1 block">Hours needed</label>
                        <input type="number" min={1} value={newGoal.hoursNeeded} onChange={e => setNewGoal(p => ({ ...p, hoursNeeded: Number(e.target.value) }))} className={inputCls} style={inputStyle} />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 mb-1 block">Difficulty</label>
                        <select value={newGoal.difficulty} onChange={e => setNewGoal(p => ({ ...p, difficulty: e.target.value as any }))} className={inputCls} style={inputStyle}>
                          <option value="easy">Easy</option>
                          <option value="medium">Medium</option>
                          <option value="hard">Hard</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {/* Add Topics mode */}
                  {goalMode === 'topic' && (
                    <div className="space-y-2">
                      <div className="flex gap-1">
                        {(['first_reading','revision'] as const).map(m => (
                          <button key={m} onClick={() => setGoalStudyMode(m)}
                            className={`flex-1 text-xs py-1.5 rounded-lg font-medium transition-colors ${goalStudyMode === m ? 'bg-teal-600 text-white' : 'bg-background-800 text-gray-400 hover:text-white'}`}>
                            {m === 'first_reading' ? 'First Reading' : 'Revision'}
                          </button>
                        ))}
                      </div>
                      <div className="space-y-1">
                        <input value={topicInput.name} onChange={e => setTopicInput(p => ({ ...p, name: e.target.value }))}
                          placeholder="Topic name" className={inputCls} style={inputStyle}
                          style={inputStyle}
                          onKeyDown={e => { if (e.key === 'Enter' && topicInput.name) { setManualTopics(p => [...p, { id: Date.now().toString(), ...topicInput }]); setTopicInput(p => ({ ...p, name: '' })); }}} />
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="text-xs text-gray-500 mb-0.5 block">Min hours</label>
                            <input type="number" min={0.5} step={0.5} value={topicInput.minHours} onChange={e => setTopicInput(p => ({ ...p, minHours: Number(e.target.value) }))} className={inputCls} style={inputStyle} />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 mb-0.5 block">Max hours</label>
                            <input type="number" min={0.5} step={0.5} value={topicInput.maxHours} onChange={e => setTopicInput(p => ({ ...p, maxHours: Number(e.target.value) }))} className={inputCls} style={inputStyle} />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 mb-0.5 block">Difficulty</label>
                            <select value={topicInput.difficulty} onChange={e => setTopicInput(p => ({ ...p, difficulty: e.target.value as any }))} className={inputCls} style={inputStyle}>
                              <option value="easy">Easy</option>
                              <option value="medium">Medium</option>
                              <option value="hard">Hard</option>
                            </select>
                          </div>
                        </div>
                      </div>
                      <button onClick={() => { if (!topicInput.name) return; setManualTopics(p => [...p, { id: Date.now().toString(), ...topicInput }]); setTopicInput(p => ({ ...p, name: '' })); }}
                        className="w-full text-xs bg-background-600 hover:bg-background-500 text-gray-300 py-1.5 rounded-lg transition-colors">
                        + Add Topic
                      </button>
                      {manualTopics.length > 0 && (
                        <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                          {manualTopics.map((t, i) => (
                            <div key={t.id} className="flex items-center justify-between bg-background-800 px-3 py-1.5 rounded-lg text-xs">
                              <span className="text-white flex-1 truncate mr-2">{t.name}</span>
                              <span className="text-gray-500 mr-2 flex-shrink-0">{t.minHours}–{t.maxHours}h · {t.difficulty}</span>
                              <button onClick={() => setManualTopics(p => p.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-300 flex-shrink-0"><X size={11} /></button>
                            </div>
                          ))}
                        </div>
                      )}
                      {calculatedHours > 0 && (
                        <p className="text-xs text-teal-400 text-right">{manualTopics.length} topics · <span className="font-semibold">{calculatedHoursRange ? `${calculatedHoursRange.min}–${calculatedHoursRange.max}h` : `${calculatedHours}h`}</span></p>
                      )}
                    </div>
                  )}

                  {/* From Course mode */}
                  {goalMode === 'course' && (
                    <div className="space-y-2">
                      <div className="flex gap-1">
                        {(['first_reading','revision'] as const).map(m => (
                          <button key={m} onClick={() => setGoalStudyMode(m)}
                            className={`flex-1 text-xs py-1.5 rounded-lg font-medium transition-colors ${goalStudyMode === m ? 'bg-teal-600 text-white' : 'bg-background-800 text-gray-400 hover:text-white'}`}>
                            {m === 'first_reading' ? 'First Reading' : 'Revision'}
                          </button>
                        ))}
                      </div>
                      {/* Custom course picker — avoids native select UX issues on mobile */}
                      {enrolledCourses.length === 0 ? (
                        <p className="text-xs text-gray-500 text-center py-3">No enrolled courses found.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {enrolledCourses.map(c => (
                            <button key={c.courseId}
                              onClick={() => { setCtCourseId(c.courseId); loadCourseTopics(c.courseId); }}
                              className={`w-full text-left px-3 py-2.5 rounded-xl border text-sm transition-colors ${
                                ctCourseId === c.courseId
                                  ? 'bg-primary-600/20 border-primary-500 text-white'
                                  : 'bg-background-800 border-background-600 text-gray-300 hover:border-background-500'
                              }`}>
                              <div className="font-medium">{c.title}</div>
                              {c.instructor && <div className="text-xs text-gray-500 mt-0.5">{c.instructor} · {c.progress}% done</div>}
                            </button>
                          ))}
                        </div>
                      )}
                      {ctLoadingGroups && (
                        <p className="text-xs text-gray-400 text-center py-2"><Loader size={12} className="inline animate-spin mr-1" />Loading topics…</p>
                      )}
                      {!ctLoadingGroups && ctGroups.length > 0 && (() => {
                        const allSubjIds  = ctGroups.flatMap(g => g.subjects.map(s => s.id));
                        const allChapIds  = ctGroups.flatMap(g => g.subjects.flatMap(s => s.chapters.map(c => c.id)));
                        const allTopicIds = ctGroups.flatMap(g => g.subjects.flatMap(s => s.chapters.flatMap(c => c.topics.map(t => t.id))));
                        const allSel      = allSubjIds.every(id => ctSelSubjects.has(id)) && allChapIds.every(id => ctSelChapters.has(id)) && allTopicIds.every(id => ctSelTopics.has(id));
                        const toggleAll   = () => {
                          setCtSelSubjects(allSel ? new Set() : new Set(allSubjIds));
                          setCtSelChapters(allSel ? new Set() : new Set(allChapIds));
                          setCtSelTopics(allSel ? new Set() : new Set(allTopicIds));
                        };
                        return (
                          <div className="bg-background-800 rounded-xl overflow-hidden">
                            {/* Select All header */}
                            <label className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-primary-300 border-b border-background-700 cursor-pointer hover:bg-background-700 transition-colors">
                              <input type="checkbox" checked={allSel} onChange={toggleAll} className="accent-primary-500" />
                              Select All ({allTopicIds.length} topics)
                            </label>
                            <div className="divide-y divide-background-700">
                              {ctGroups.flatMap(grp => grp.subjects.map(subj => {
                                const subjChapIds  = subj.chapters.map(c => c.id);
                                const subjTopicIds = subj.chapters.flatMap(c => c.topics.map(t => t.id));
                                const subjAllSel   = subjChapIds.every(id => ctSelChapters.has(id)) && subjTopicIds.every(id => ctSelTopics.has(id));
                                const subjExpanded = ctExpandedSubjects.has(subj.id);
                                const toggleSubjSel = (e: React.ChangeEvent<HTMLInputElement>) => {
                                  e.stopPropagation();
                                  setCtSelSubjects(p => { const n = new Set(p); subjAllSel ? n.delete(subj.id) : n.add(subj.id); return n; });
                                  setCtSelChapters(p => { const n = new Set(p); subjChapIds.forEach(id => subjAllSel ? n.delete(id) : n.add(id)); return n; });
                                  setCtSelTopics(p   => { const n = new Set(p); subjTopicIds.forEach(id => subjAllSel ? n.delete(id) : n.add(id)); return n; });
                                };
                                const toggleSubjExpand = () => setCtExpandedSubjects(p => { const n = new Set(p); n.has(subj.id) ? n.delete(subj.id) : n.add(subj.id); return n; });
                                return (
                                  <div key={subj.id}>
                                    {/* Subject row — chevron expands, checkbox selects */}
                                    <div className="flex items-center gap-2 px-3 py-2.5 hover:bg-background-700 transition-colors">
                                      <input type="checkbox" checked={subjAllSel} onChange={toggleSubjSel} className="accent-primary-500 flex-shrink-0" />
                                      <Layers size={11} className="text-primary-400 flex-shrink-0" />
                                      <span className="flex-1 text-xs font-semibold text-white">{subj.name}</span>
                                      <span className="text-xs text-gray-500 mr-1">{subjTopicIds.length}</span>
                                      <button onClick={toggleSubjExpand} className="text-gray-400 hover:text-white transition-colors p-0.5">
                                        {subjExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                      </button>
                                    </div>
                                    {/* Chapters — only shown when subject expanded */}
                                    {subjExpanded && subj.chapters.map(chap => {
                                      const chapTopicIds = chap.topics.map(t => t.id);
                                      const chapAllSel   = chapTopicIds.every(id => ctSelTopics.has(id));
                                      const chapExpanded = ctExpandedChapters.has(chap.id);
                                      const toggleChapSel = (e: React.ChangeEvent<HTMLInputElement>) => {
                                        e.stopPropagation();
                                        setCtSelChapters(p => { const n = new Set(p); chapAllSel ? n.delete(chap.id) : n.add(chap.id); return n; });
                                        setCtSelTopics(p   => { const n = new Set(p); chapTopicIds.forEach(id => chapAllSel ? n.delete(id) : n.add(id)); return n; });
                                      };
                                      const toggleChapExpand = () => setCtExpandedChapters(p => { const n = new Set(p); n.has(chap.id) ? n.delete(chap.id) : n.add(chap.id); return n; });
                                      return (
                                        <div key={chap.id} className="border-t border-background-700/50">
                                          {/* Chapter row */}
                                          <div className="flex items-center gap-2 pl-7 pr-3 py-2 hover:bg-background-700 transition-colors">
                                            <input type="checkbox" checked={chapAllSel} onChange={toggleChapSel} className="accent-teal-500 flex-shrink-0" />
                                            <span className="flex-1 text-xs text-gray-300">{chap.name}</span>
                                            <span className="text-xs text-gray-600 mr-1">{chapTopicIds.length}</span>
                                            <button onClick={toggleChapExpand} className="text-gray-500 hover:text-white transition-colors p-0.5">
                                              {chapExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                            </button>
                                          </div>
                                          {/* Topics — only shown when chapter expanded */}
                                          {chapExpanded && chap.topics.map(t => (
                                            <label key={t.id} className="flex items-center gap-2 pl-11 pr-3 py-1.5 text-xs text-gray-400 cursor-pointer hover:bg-background-700 transition-colors">
                                              <input type="checkbox" checked={ctSelTopics.has(t.id)}
                                                onChange={e => setCtSelTopics(p => { const n = new Set(p); e.target.checked ? n.add(t.id) : n.delete(t.id); return n; })}
                                                className="accent-teal-500" />
                                              <Tag size={9} className="text-teal-500 flex-shrink-0" />
                                              <span className="flex-1">{t.name}</span>
                                              <span className="text-gray-600 flex-shrink-0">{t.minHours}–{t.maxHours}h</span>
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
                          Study Planner not configured for this course yet. Ask your teacher to add topic groups, or use <button onClick={() => setGoalMode('topic')} className="underline font-medium">Add Topics</button> to plan manually.
                        </div>
                      )}
                      {calculatedHours > 0 && (
                        <p className="text-xs text-teal-400 text-right">{selectedCourseTopics.length} topics selected · <span className="font-semibold">{calculatedHoursRange ? `${calculatedHoursRange.min}–${calculatedHoursRange.max}h` : `${calculatedHours}h`}</span></p>
                      )}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button onClick={handleAddGoal}
                      disabled={savingGoal || !newGoal.targetDate || (goalMode !== 'course' && !newGoal.subject) || (goalMode === 'course' && !ctCourseId)}
                      className="flex-1 bg-primary-600 hover:bg-primary-700 text-white py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1">
                      {savingGoal ? <Loader size={13} className="animate-spin" /> : null}
                      Save Goal
                    </button>
                    <button onClick={resetGoalForm} className="px-4 bg-background-600 text-gray-400 py-2 rounded-xl text-sm transition-colors">Cancel</button>
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
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-semibold text-primary-400">Edit Goal</p>
                              {/* Mode badge — not a tab since mode can't change on edit */}
                              <span className="text-xs px-2 py-0.5 rounded-full bg-background-700 text-gray-400 capitalize">
                                {editGoalMode === 'simple' ? 'Simple' : editGoalMode === 'topic' ? 'Topic-based' : 'Course-based'}
                              </span>
                            </div>

                            {/* ── Date + Difficulty (all modes) ── */}
                            <div className="grid grid-cols-2 gap-2">
                              {editGoalMode !== 'course' && (
                                <input
                                  value={editGoalData.subject}
                                  onChange={e => setEditGoalData(p => ({ ...p, subject: e.target.value }))}
                                  placeholder="Subject / Course"
                                  className={inputCls} style={inputStyle}
                                style={inputStyle}
                                />
                              )}
                              <input
                                type="date"
                                value={editGoalData.targetDate}
                                onChange={e => setEditGoalData(p => ({ ...p, targetDate: e.target.value }))}
                                className={`${inputCls} ${editGoalMode === 'course' ? 'col-span-2' : ''}`}
                              />
                            </div>

                            {/* ── Difficulty (all modes) ── */}
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-xs text-gray-400 mb-1 block">Difficulty</label>
                                <select
                                  value={editGoalData.difficulty}
                                  onChange={e => setEditGoalData(p => ({ ...p, difficulty: e.target.value as any }))}
                                  className={inputCls} style={inputStyle}
                                style={inputStyle}
                                >
                                  <option value="easy">Easy</option>
                                  <option value="medium">Medium</option>
                                  <option value="hard">Hard</option>
                                </select>
                              </div>
                              {/* Hours — only editable for simple mode; auto-calculated for topic/course */}
                              {editGoalMode === 'simple' ? (
                                <div>
                                  <label className="text-xs text-gray-400 mb-1 block">Hours needed</label>
                                  <input
                                    type="number" min={1}
                                    value={editGoalData.hoursNeeded}
                                    onChange={e => setEditGoalData(p => ({ ...p, hoursNeeded: Number(e.target.value) }))}
                                    className={inputCls} style={inputStyle}
                                  style={inputStyle}
                                  />
                                </div>
                              ) : (
                                <div>
                                  <label className="text-xs text-gray-400 mb-1 block">Study mode</label>
                                  <div className="flex gap-1">
                                    {(['first_reading','revision'] as const).map(m => (
                                      <button type="button" key={m} onClick={() => setEditGoalStudyMode(m)}
                                        className={`flex-1 text-xs py-1.5 rounded-lg font-medium transition-colors ${editGoalStudyMode === m ? 'bg-teal-600 text-white' : 'bg-background-800 text-gray-400 hover:text-white'}`}>
                                        {m === 'first_reading' ? 'Read' : 'Revise'}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* ── Topic mode: add / remove manual topics ── */}
                            {editGoalMode === 'topic' && (
                              <div className="space-y-2">
                                <div className="space-y-1">
                                  <input value={editTopicInput.name}
                                    onChange={e => setEditTopicInput(p => ({ ...p, name: e.target.value }))}
                                    placeholder="Topic name"
                                    className={inputCls} style={inputStyle}
                                    style={inputStyle}
                                    onKeyDown={e => { if (e.key === 'Enter' && editTopicInput.name) { setEditManualTopics(p => [...p, { id: Date.now().toString(), ...editTopicInput }]); setEditTopicInput(p => ({ ...p, name: '' })); }}}
                                  />
                                  <div className="grid grid-cols-3 gap-2">
                                    <div>
                                      <label className="text-xs text-gray-500 mb-0.5 block">Min h</label>
                                      <input type="number" min={0.5} step={0.5} value={editTopicInput.minHours} onChange={e => setEditTopicInput(p => ({ ...p, minHours: Number(e.target.value) }))} className={inputCls} style={inputStyle} />
                                    </div>
                                    <div>
                                      <label className="text-xs text-gray-500 mb-0.5 block">Max h</label>
                                      <input type="number" min={0.5} step={0.5} value={editTopicInput.maxHours} onChange={e => setEditTopicInput(p => ({ ...p, maxHours: Number(e.target.value) }))} className={inputCls} style={inputStyle} />
                                    </div>
                                    <div>
                                      <label className="text-xs text-gray-500 mb-0.5 block">Diff</label>
                                      <select value={editTopicInput.difficulty} onChange={e => setEditTopicInput(p => ({ ...p, difficulty: e.target.value as any }))} className={inputCls} style={inputStyle}>
                                        <option value="easy">Easy</option>
                                        <option value="medium">Medium</option>
                                        <option value="hard">Hard</option>
                                      </select>
                                    </div>
                                  </div>
                                </div>
                                <button type="button" onClick={() => { if (!editTopicInput.name) return; setEditManualTopics(p => [...p, { id: Date.now().toString(), ...editTopicInput }]); setEditTopicInput(p => ({ ...p, name: '' })); }}
                                  className="w-full text-xs bg-background-600 hover:bg-background-500 text-gray-300 py-1.5 rounded-lg transition-colors">
                                  + Add Topic
                                </button>
                                {editManualTopics.length > 0 && (
                                  <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                                    {editManualTopics.map((t, i) => (
                                      <div key={t.id} className="flex items-center justify-between bg-background-800 px-3 py-1.5 rounded-lg text-xs">
                                        <span className="text-white flex-1 truncate mr-2">{t.name}</span>
                                        <span className="text-gray-500 mr-2 flex-shrink-0">{t.minHours}–{t.maxHours}h · {t.difficulty}</span>
                                        <button type="button" onClick={() => setEditManualTopics(p => p.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-300 flex-shrink-0"><X size={11} /></button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {editCalculatedHours > 0 && (
                                  <p className="text-xs text-teal-400 text-right">{editManualTopics.length} topics · <span className="font-semibold">{editCalculatedHoursRange ? `${editCalculatedHoursRange.min}–${editCalculatedHoursRange.max}h` : `${editCalculatedHours}h`}</span></p>
                                )}
                              </div>
                            )}

                            {/* ── Course mode: topic selector (pre-populated) ── */}
                            {editGoalMode === 'course' && (
                              <div className="space-y-2">
                                {editCtLoadingGroups ? (
                                  <p className="text-xs text-gray-400 text-center py-2"><Loader size={12} className="inline animate-spin mr-1" />Loading topics…</p>
                                ) : editCtGroups.length === 0 ? (
                                  <p className="text-xs text-amber-400 text-center py-2">No topic groups found for this course.</p>
                                ) : (() => {
                                  const allTopicIds = editCtGroups.flatMap(grp => grp.subjects.flatMap(s => s.chapters.flatMap(c => c.topics.map(t => t.id))));
                                  const allSel = allTopicIds.every(id => editCtSelTopics.has(id));
                                  const toggleAll = () => {
                                    if (allSel) {
                                      setEditCtSelTopics(new Set()); setEditCtSelChapters(new Set()); setEditCtSelSubjects(new Set());
                                    } else {
                                      setEditCtSelTopics(new Set(allTopicIds));
                                      setEditCtSelChapters(new Set(editCtGroups.flatMap(grp => grp.subjects.flatMap(s => s.chapters.map(c => c.id)))));
                                      setEditCtSelSubjects(new Set(editCtGroups.flatMap(grp => grp.subjects.map(s => s.id))));
                                    }
                                  };
                                  return (
                                    <div className="bg-background-800 rounded-xl overflow-hidden border border-background-700 max-h-64 overflow-y-auto">
                                      <label className="flex items-center gap-2 px-3 py-2.5 text-xs font-semibold text-gray-300 border-b border-background-700 cursor-pointer hover:bg-background-700 transition-colors">
                                        <input type="checkbox" checked={allSel} onChange={toggleAll} className="accent-primary-500" />
                                        Select All ({allTopicIds.length} topics)
                                      </label>
                                      <div className="divide-y divide-background-700">
                                        {editCtGroups.flatMap(grp => grp.subjects.map(subj => {
                                          const subjChapIds  = subj.chapters.map(c => c.id);
                                          const subjTopicIds = subj.chapters.flatMap(c => c.topics.map(t => t.id));
                                          const subjAllSel   = subjTopicIds.length > 0 && subjTopicIds.every(id => editCtSelTopics.has(id));
                                          const subjExpanded = editCtExpandedSubjects.has(subj.id);
                                          const toggleSubjSel = (e: React.ChangeEvent<HTMLInputElement>) => {
                                            e.stopPropagation();
                                            setEditCtSelSubjects(p => { const n = new Set(p); subjAllSel ? n.delete(subj.id) : n.add(subj.id); return n; });
                                            setEditCtSelChapters(p => { const n = new Set(p); subjChapIds.forEach(id => subjAllSel ? n.delete(id) : n.add(id)); return n; });
                                            setEditCtSelTopics(p  => { const n = new Set(p); subjTopicIds.forEach(id => subjAllSel ? n.delete(id) : n.add(id)); return n; });
                                          };
                                          const toggleSubjExpand = () => setEditCtExpandedSubjects(p => { const n = new Set(p); n.has(subj.id) ? n.delete(subj.id) : n.add(subj.id); return n; });
                                          return (
                                            <div key={subj.id}>
                                              <div className="flex items-center gap-2 px-3 py-2.5 hover:bg-background-700 transition-colors">
                                                <input type="checkbox" checked={subjAllSel} onChange={toggleSubjSel} className="accent-primary-500 flex-shrink-0" />
                                                <Layers size={11} className="text-primary-400 flex-shrink-0" />
                                                <span className="flex-1 text-xs font-semibold text-white">{subj.name}</span>
                                                <span className="text-xs text-gray-500 mr-1">{subjTopicIds.length}</span>
                                                <button type="button" onClick={toggleSubjExpand} className="text-gray-400 hover:text-white transition-colors p-0.5">
                                                  {subjExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                                </button>
                                              </div>
                                              {subjExpanded && subj.chapters.map(chap => {
                                                const chapTopicIds = chap.topics.map(t => t.id);
                                                const chapAllSel   = chapTopicIds.length > 0 && chapTopicIds.every(id => editCtSelTopics.has(id));
                                                const chapExpanded = editCtExpandedChapters.has(chap.id);
                                                const toggleChapSel = (e: React.ChangeEvent<HTMLInputElement>) => {
                                                  e.stopPropagation();
                                                  setEditCtSelChapters(p => { const n = new Set(p); chapAllSel ? n.delete(chap.id) : n.add(chap.id); return n; });
                                                  setEditCtSelTopics(p   => { const n = new Set(p); chapTopicIds.forEach(id => chapAllSel ? n.delete(id) : n.add(id)); return n; });
                                                };
                                                const toggleChapExpand = () => setEditCtExpandedChapters(p => { const n = new Set(p); n.has(chap.id) ? n.delete(chap.id) : n.add(chap.id); return n; });
                                                return (
                                                  <div key={chap.id} className="border-t border-background-700/50">
                                                    <div className="flex items-center gap-2 pl-7 pr-3 py-2 hover:bg-background-700 transition-colors">
                                                      <input type="checkbox" checked={chapAllSel} onChange={toggleChapSel} className="accent-teal-500 flex-shrink-0" />
                                                      <span className="flex-1 text-xs text-gray-300">{chap.name}</span>
                                                      <span className="text-xs text-gray-600 mr-1">{chapTopicIds.length}</span>
                                                      <button type="button" onClick={toggleChapExpand} className="text-gray-500 hover:text-white transition-colors p-0.5">
                                                        {chapExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                                      </button>
                                                    </div>
                                                    {chapExpanded && chap.topics.map(t => (
                                                      <label key={t.id} className="flex items-center gap-2 pl-11 pr-3 py-1.5 text-xs text-gray-400 cursor-pointer hover:bg-background-700 transition-colors">
                                                        <input type="checkbox" checked={editCtSelTopics.has(t.id)}
                                                          onChange={e => setEditCtSelTopics(p => { const n = new Set(p); e.target.checked ? n.add(t.id) : n.delete(t.id); return n; })}
                                                          className="accent-teal-500" />
                                                        <Tag size={9} className="text-teal-500 flex-shrink-0" />
                                                        <span className="flex-1">{t.name}</span>
                                                        <span className="text-gray-600 flex-shrink-0">{t.minHours}–{t.maxHours}h</span>
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
                                {editCalculatedHours > 0 && (
                                  <p className="text-xs text-teal-400 text-right">{editSelectedCourseTopics.length} topics selected · <span className="font-semibold">{editCalculatedHoursRange ? `${editCalculatedHoursRange.min}–${editCalculatedHoursRange.max}h` : `${editCalculatedHours}h`}</span></p>
                                )}
                              </div>
                            )}

                            {/* ── Actions ── */}
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={handleSaveEditGoal}
                                disabled={savingEditGoal || !editGoalData.targetDate || (editGoalMode !== 'course' && !editGoalData.subject)}
                                className="flex-1 bg-primary-600 hover:bg-primary-700 text-white py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                              >
                                {savingEditGoal ? <Loader size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                                Save
                              </button>
                              <button type="button" onClick={() => setEditingGoal(null)} className="px-4 bg-background-600 text-gray-400 py-2 rounded-xl text-sm transition-colors">
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

                        {/* AI Plan Progress Tracker — with partial completion */}
                        {prog.totalSessions > 0 && (
                          <div className="rounded-lg p-2.5 bg-background-700 border border-background-600 mt-1">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-xs text-gray-400 flex items-center gap-1.5">
                                {prog.completedSessions}/{prog.totalSessions} sessions
                                {prog.partialSessions > 0 && (
                                  <span className="text-amber-400 flex items-center gap-0.5">
                                    · <Clock size={9} />{prog.partialSessions} partial
                                  </span>
                                )}
                                {prog.behind && !prog.partialSessions && (
                                  <span className="text-red-400 ml-1">· {prog.missedSessions} missed</span>
                                )}
                              </span>
                              <span className="text-xs text-gray-500">{prog.sessionRate}%</span>
                            </div>
                            <div className="h-1.5 bg-background-600 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${prog.sessionRate === 100 ? 'bg-emerald-500' : prog.behind ? 'bg-amber-500' : 'bg-primary-500'}`}
                                style={{ width: `${Math.max(prog.sessionRate, 2)}%` }}
                              />
                            </div>
                            {/* Feature #6: Missed session recovery — show only when behind */}
                            {prog.behind && prog.missedSessions > 0 && (
                              <div className="mt-2 flex items-center justify-between">
                                <span className="text-xs text-red-400 flex items-center gap-1">
                                  <AlertTriangle size={10} />{prog.missedSessions} session{prog.missedSessions > 1 ? 's' : ''} missed
                                </span>
                                <button
                                  onClick={handleOpenRecovery}
                                  className="text-xs bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 px-2 py-0.5 rounded-lg transition-all flex items-center gap-1"
                                >
                                  <RefreshCw size={9} />Recover Plan
                                </button>
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
                        <input value={newActivity.name} onChange={e => setNewActivity(p => ({ ...p, name: e.target.value }))} placeholder="Activity name" className={inputCls} style={inputStyle} />
                        <select value={newActivity.category} onChange={e => setNewActivity(p => ({ ...p, category: e.target.value as any }))} className={inputCls} style={inputStyle}>
                          {(['sport', 'job', 'hobby', 'family', 'religious', 'social', 'transport', 'other'] as const).map(c => (
                            <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
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
                            className={inputCls} style={inputStyle}
                          style={inputStyle}
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
                          <input type="time" value={newActivity.startTime} onChange={e => setNewActivity(p => ({ ...p, startTime: e.target.value }))} className={inputCls} style={inputStyle} />
                        </div>
                        <div>
                          <label className="text-xs text-gray-400 mb-1 block">End time</label>
                          <input type="time" value={newActivity.endTime} onChange={e => setNewActivity(p => ({ ...p, endTime: e.target.value }))} className={inputCls} style={inputStyle} />
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
                                  className={inputCls} style={inputStyle}
                                style={inputStyle}
                                />
                                <select
                                  value={editActivityData.category}
                                  onChange={e => setEditActivityData(p => ({ ...p, category: e.target.value as any }))}
                                  className={inputCls} style={inputStyle}
                                style={inputStyle}
                                >
                                  {(['sport', 'job', 'hobby', 'family', 'religious', 'social', 'transport', 'other'] as const).map(c => (
                                    <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
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
                                    className={inputCls} style={inputStyle}
                                  style={inputStyle}
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
                                  <input type="time" value={editActivityData.startTime} onChange={e => setEditActivityData(p => ({ ...p, startTime: e.target.value }))} className={inputCls} style={inputStyle} />
                                </div>
                                <div>
                                  <label className="text-xs text-gray-400 mb-1 block">End time</label>
                                  <input type="time" value={editActivityData.endTime} onChange={e => setEditActivityData(p => ({ ...p, endTime: e.target.value }))} className={inputCls} style={inputStyle} />
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
                                  <span className="text-base">{(() => { const Icon = CATEGORY_ICON[a.category] || Pin; return <Icon size={15} className="text-primary-400" />; })()}</span>
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
            </NoAnimCard>
          </div>
        </div>
      )}

      {/* ════════════════════════════════ UPCOMING VIEW ═══════════════════════════ */}
      {view === 'list' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <NoAnimCard>
              {/* Feature #15: Sub-view toggle — Upcoming / History */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex gap-1 bg-background-700 p-1 rounded-xl">
                  <button onClick={() => setListSubView('upcoming')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${listSubView === 'upcoming' ? 'bg-primary-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                    <ListTodo size={11} />Upcoming
                  </button>
                  <button onClick={() => { setListSubView('history'); setHistorySearch(''); }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${listSubView === 'history' ? 'bg-primary-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                    <History size={11} />History
                  </button>
                </div>
                {listSubView === 'history' && (
                  <div className="relative">
                    <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input
                      value={historySearch}
                      onChange={e => setHistorySearch(e.target.value)}
                      placeholder="Search history…"
                      className="pl-7 pr-3 py-1.5 bg-background-700 border border-background-600 rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:border-primary-500 w-40"
                    />
                  </div>
                )}
              </div>

              {listSubView === 'upcoming' ? (
                <>
                  <p className="text-xs text-gray-500 mb-3">{upcomingEvents.length} upcoming event{upcomingEvents.length !== 1 ? 's' : ''}</p>
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
                                  <span>{(() => { const Icon = TYPE_ICON[ev.eventType] || CalendarIcon; return <Icon size={13} className="text-gray-400 flex-shrink-0" />; })()}</span>
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
                                {renderSessionTopics(ev)}
                              </div>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                {ev.isAIGenerated && ev.isPersonal && !ev.completed && (
                                  <div className="flex flex-col gap-1 min-w-[80px]">
                                    <div className="flex gap-0.5 h-1.5 rounded-full overflow-hidden cursor-pointer w-24">
                                      {[25, 50, 75, 100].map(pct => (
                                        <div
                                          key={pct}
                                          onClick={() => handleUpdateCompletionPercent(ev, pct)}
                                          title={pct === 100 ? 'Mark complete' : `${pct}% done`}
                                          className={`flex-1 transition-all hover:opacity-75 ${
                                            (ev.completionPercent || 0) >= pct
                                              ? pct === 100 ? 'bg-emerald-500' : 'bg-amber-500'
                                              : 'bg-background-600 hover:bg-background-500'
                                          }`}
                                        />
                                      ))}
                                    </div>
                                    {(ev.completionPercent || 0) > 0 && (
                                      <span className="text-xs text-amber-400">{ev.completionPercent}%</span>
                                    )}
                                  </div>
                                )}
                                <button
                                  onClick={() => handleToggleComplete(ev)}
                                  className={`p-1.5 rounded-lg transition-colors ${ev.completed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-background-700 text-gray-400 hover:text-emerald-400'}`}
                                  title={ev.completed ? 'Mark incomplete' : 'Mark complete'}
                                >
                                  <CheckCircle2 size={13} />
                                </button>
                                {ev.isPersonal && ev.studentId === user?.uid && (
                                  <>
                                    <button onClick={() => { setEditingEvent(ev); setShowModal(true); }} className="p-1.5 bg-background-700 hover:bg-background-600 text-gray-400 hover:text-white rounded-lg transition-colors" title="Edit event"><Edit size={12} /></button>
                                    <button onClick={() => handleDelete(ev.id)} className="p-1.5 bg-background-700 hover:bg-red-500/20 text-gray-400 hover:text-red-400 rounded-lg transition-colors" title="Delete event"><Trash2 size={12} /></button>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              ) : (
                /* ── Feature #15: History sub-view ── */
                (() => {
                  const historyEvents = events
                    .filter(ev => ev.completed)
                    .filter(ev => !historySearch || ev.title.toLowerCase().includes(historySearch.toLowerCase()) || (ev.course || '').toLowerCase().includes(historySearch.toLowerCase()))
                    .sort((a, b) => b.date.getTime() - a.date.getTime());
                  return (
                    <>
                      <p className="text-xs text-gray-500 mb-3">{historyEvents.length} completed event{historyEvents.length !== 1 ? 's' : ''}</p>
                      {historyEvents.length === 0 ? (
                        <div className="py-10 text-center text-gray-400">
                          <History size={36} className="mx-auto mb-3 text-gray-600" />
                          <p className="text-sm">{historySearch ? 'No results for that search' : 'No completed events yet'}</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {historyEvents.map(ev => (
                            <div key={ev.id} className={`bg-background-800 rounded-xl p-3.5 border-l-4 opacity-80 ${TYPE_COLOR[ev.eventType] || 'border-gray-500'}`}>
                              <div className="flex items-center gap-3">
                                <CheckCircle2 size={13} className="text-emerald-400 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-300 line-through truncate">{ev.title}</p>
                                  <div className="flex flex-wrap gap-3 text-xs text-gray-500 mt-0.5">
                                    <span>{format(ev.date, 'EEE, MMM d, yyyy')}</span>
                                    {ev.startTime && <span>{ev.startTime}–{ev.endTime}</span>}
                                    {ev.course && <span>{ev.course}</span>}
                                    <span className={`capitalize ${TYPE_BG[ev.eventType]} px-1.5 py-0.5 rounded-full text-xs`}>{ev.eventType.replace('_', ' ')}</span>
                                  </div>
                                </div>
                                <button
                                  onClick={() => handleToggleComplete(ev)}
                                  title="Mark incomplete"
                                  className="p-1.5 text-gray-600 hover:text-amber-400 transition-colors flex-shrink-0"
                                >
                                  <RotateCcw size={11} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  );
                })()
              )}
            </NoAnimCard>
          </div>
          <div className="space-y-4">
            <NoAnimCard>
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
            </NoAnimCard>
            <NoAnimCard>
              <h3 className="text-sm font-semibold text-white mb-3">By Event Type</h3>
              {['assignment', 'exam', 'class', 'study_session', 'deadline', 'personal'].map(t => {
                const count = events.filter(e => e.eventType === t).length;
                if (!count) return null;
                return <div key={t} className="flex items-center justify-between py-1.5 border-b border-background-700 last:border-0">{(() => { const Icon = TYPE_ICON[t] || CalendarIcon; return <span className="text-xs text-gray-400 capitalize flex items-center gap-1.5"><Icon size={11} />{t.replace('_', ' ')}</span>; })()}<span className="text-xs font-semibold text-white">{count}</span></div>;
              })}
            </NoAnimCard>
          </div>
        </div>
      )}

      {/* ════════════════════════════════ ANALYTICS VIEW ══════════════════════════ */}
      {view === 'analytics' && (
        <div className="space-y-5">
          {/* Stat cards row */}
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
          </div>

          {/* Feature #11: Subject-wise completion breakdown */}
          {subjectBreakdown.length > 0 && (
            <div className="bg-background-800 border border-background-700 rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <BarChart size={14} className="text-primary-400" />Subject Breakdown
              </h3>
              <div className="space-y-3">
                {subjectBreakdown.map(({ subject, total, completed, rate }) => (
                  <div key={subject}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-300 truncate flex-1 mr-3">{subject}</span>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs text-gray-500">{completed}/{total}</span>
                        <span className={`text-xs font-semibold w-8 text-right ${rate === 100 ? 'text-emerald-400' : rate >= 50 ? 'text-amber-400' : 'text-gray-400'}`}>{rate}%</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-background-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${rate === 100 ? 'bg-emerald-500' : rate >= 50 ? 'bg-amber-500' : 'bg-primary-500'}`}
                        style={{ width: `${Math.max(rate, 2)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Feature #3: AI Study Pattern Analysis */}
          {aiReady && (
            <div className="bg-background-800 border border-background-700 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Brain size={14} className="text-purple-400" />AI Study Pattern Analysis
                </h3>
                {!analyticsLoading && analyticsLoaded && (
                  <button
                    onClick={() => { setStudyAnalytics(null); setAnalyticsLoaded(false); }}
                    className="text-xs text-gray-500 hover:text-primary-400 transition-colors flex items-center gap-1"
                  >
                    <RefreshCw size={11} />Refresh
                  </button>
                )}
              </div>
              {analyticsLoading ? (
                <div className="space-y-3 animate-pulse">
                  {[1, 2, 3].map(i => <div key={i} className="h-4 bg-background-700 rounded w-full" />)}
                </div>
              ) : studyAnalytics ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="bg-background-700 rounded-xl p-3 text-center">
                      <p className="text-xl font-bold text-white">{studyAnalytics.productivityScore}</p>
                      <p className="text-xs text-gray-400">Productivity Score</p>
                    </div>
                    <div className="bg-background-700 rounded-xl p-3 text-center">
                      <p className="text-xl font-bold text-white">{studyAnalytics.weeklyHours}h</p>
                      <p className="text-xs text-gray-400">Weekly Hours</p>
                    </div>
                    <div className="bg-background-700 rounded-xl p-3 text-center">
                      <p className="text-xl font-bold text-white">{studyAnalytics.completionRate}%</p>
                      <p className="text-xs text-gray-400">Session Rate</p>
                    </div>
                  </div>
                  {studyAnalytics.insights.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-300 mb-2">Insights</p>
                      <ul className="space-y-1.5">
                        {studyAnalytics.insights.map((ins, i) => (
                          <li key={i} className="text-xs text-gray-400 flex items-start gap-2">
                            <Lightbulb size={11} className="text-amber-400 flex-shrink-0 mt-0.5" />{ins}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {studyAnalytics.recommendations.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-300 mb-2">Recommendations</p>
                      <ul className="space-y-1.5">
                        {studyAnalytics.recommendations.map((rec, i) => (
                          <li key={i} className="text-xs text-gray-400 flex items-start gap-2">
                            <TrendingUp size={11} className="text-primary-400 flex-shrink-0 mt-0.5" />{rec}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-gray-500">Analysis will appear once your session data is loaded.</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════ AI CHAT VIEW ════════════════════════════ */}
      {view === 'chat' && (
        <NoAnimCard>
          <div className="flex items-center justify-between mb-4 pb-4 border-b border-background-700">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-purple-600 to-primary-600 rounded-xl flex items-center justify-center">
                <Brain size={15} className="text-white" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-white">Minerva — AI Study Companion</h2>
                <p className="text-xs text-gray-400">Plans sessions & goals · reads your routine image</p>
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
                  Minerva created {pendingCalendarEvents.length} study session{pendingCalendarEvents.length > 1 ? 's' : ''}
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

          {/* Pending goals banner */}
          {pendingGoals.length > 0 && (
            <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 mb-4">
              <Target size={15} className="text-emerald-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-emerald-200">
                  Minerva created {pendingGoals.length} study goal{pendingGoals.length > 1 ? 's' : ''}
                </p>
                <p className="text-xs text-emerald-300/70">
                  {pendingGoals.map(g => `${g.subject} (${g.difficulty}, ${g.targetDate})`).join(' · ')}
                </p>
              </div>
              <button onClick={handleAddChatGoals} disabled={addingChatGoals}
                className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap disabled:opacity-50 flex items-center gap-1">
                {addingChatGoals ? <Loader size={11} className="animate-spin" /> : null}
                Add Goals
              </button>
              <button onClick={() => setPendingGoals([])} className="text-gray-500 hover:text-gray-300 flex-shrink-0">
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
                  Hi {user?.name || user?.displayName || 'there'}! I'm Minerva, your study companion. Ask me anything!
                </p>
                {[
                  `Help me create a study goal for my upcoming exam`,
                  `Plan study sessions around my free time this week`,
                  `What should I focus on given my current goals?`,
                  `I uploaded my exam routine — help me plan around it`,
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
                  <span className="text-xs text-gray-400">Minerva is thinking…</span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Image preview / OCR status */}
          {(chatImagePreview || chatImageOCRLoading) && (
            <div className="flex items-center gap-3 bg-background-800 border border-background-600 rounded-xl px-3 py-2 mb-2">
              {chatImagePreview && (
                <img src={chatImagePreview} alt="Uploaded routine" className="h-10 w-14 object-cover rounded-lg border border-background-600 flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                {chatImageOCRLoading ? (
                  <div className="flex items-center gap-2">
                    <Loader size={11} className="animate-spin text-primary-400" />
                    <span className="text-xs text-gray-400">Reading schedule image…</span>
                  </div>
                ) : chatImageText ? (
                  <div>
                    <p className="text-xs text-emerald-400 font-medium flex items-center gap-1"><CheckCircle2 size={10} /> Schedule image analyzed</p>
                    <p className="text-xs text-gray-500 truncate">{chatImageText.slice(0, 80)}…</p>
                  </div>
                ) : (
                  <p className="text-xs text-amber-400">Image ready — couldn't extract text, but Minerva knows it's attached</p>
                )}
              </div>
              <button onClick={() => { setChatImageFile(null); setChatImagePreview(''); setChatImageText(''); }} className="text-gray-500 hover:text-red-400 transition-colors flex-shrink-0">
                <X size={13} />
              </button>
            </div>
          )}

          {/* Input */}
          <div className="flex gap-2">
            {/* Hidden image input */}
            <input
              ref={chatImageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleChatImageSelect(f); e.target.value = ''; }}
            />
            {/* Image upload button */}
            <button
              onClick={() => chatImageInputRef.current?.click()}
              disabled={chatLoading || chatImageOCRLoading}
              title="Upload your exam routine or class schedule"
              className="p-2.5 bg-background-700 hover:bg-background-600 text-gray-400 hover:text-primary-400 rounded-xl transition-colors disabled:opacity-40 flex-shrink-0"
            >
              <Paperclip size={15} />
            </button>
            <input
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendChat(); } }}
              placeholder={chatImageFile ? "Add a message with your image (optional)…" : "Ask Minerva anything about your studies…"}
              className={inputCls + ' flex-1'}
            />
            <button onClick={handleSendChat} disabled={(!chatInput.trim() && !chatImageFile) || chatLoading || chatImageOCRLoading || !aiReady}
              className="bg-primary-600 hover:bg-primary-700 text-white p-2.5 rounded-xl transition-colors disabled:opacity-50 flex-shrink-0">
              <Send size={15} />
            </button>
          </div>
          {!aiReady && <p className="text-xs text-amber-400 mt-2 flex items-center gap-1"><AlertTriangle size={11} /> AI not configured — Admin → AI Model Settings</p>}
          <p className="text-xs text-gray-600 mt-1.5 text-center flex items-center justify-center gap-1"><ImageIcon size={10} /> Tip: Upload your exam routine or class timetable — Minerva will read and plan around it</p>
        </NoAnimCard>
      )}

      {/* ─── AI Schedule Modal ──────────────────────────────────────────────────── */}
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
