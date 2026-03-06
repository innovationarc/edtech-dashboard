// src/pages/StudentStudyPlan.tsx
// Advanced AI Study Planner — Calendar · List · Analytics · AI Chat · Pomodoro · Goals

import { useState, useEffect, useRef } from 'react';
import {
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, Loader, AlertCircle,
  Edit, Trash2, Clock, Target, Brain, Sparkles, BarChart2, MessageSquare,
  CheckCircle2, X, Flame, BookOpen, Play, Pause, RotateCcw, Send,
  ListTodo, Timer, AlertOctagon, Lightbulb, Heart,
} from 'lucide-react';
import Calendar from 'react-calendar';
import { format, differenceInDays, startOfWeek, endOfWeek, isToday, isTomorrow } from 'date-fns';
import { useDashboard } from '../contexts/DashboardContext';
import { studyPlanService, StudyPlanEvent, StudyGoal } from '../services/studyPlanService';
import { aiStudyPlannerService, AIInsight, AIScheduleSuggestion } from '../services/aiStudyPlannerService';
import StudyPlanEventModal from '../components/shared/StudyPlanEventModal';
import Card from '../components/ui/Card';

const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

type View = 'calendar' | 'list' | 'analytics' | 'chat';
type Value = Date | null | [Date | null, Date | null];

// ─── Style maps ───────────────────────────────────────────────────────────────

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
  assignment:'📋', exam:'🎯', class:'🏫', study_session:'📚', deadline:'⏰', personal:'📝',
};
const INSIGHT_STYLE: Record<string, { bg: string; icon: any; color: string }> = {
  warning:    { bg: 'bg-amber-500/10 border-amber-500/30',    icon: AlertOctagon, color: 'text-amber-400' },
  success:    { bg: 'bg-emerald-500/10 border-emerald-500/30', icon: CheckCircle2, color: 'text-emerald-400' },
  tip:        { bg: 'bg-blue-500/10 border-blue-500/30',      icon: Lightbulb,    color: 'text-blue-400' },
  motivation: { bg: 'bg-purple-500/10 border-purple-500/30',  icon: Heart,        color: 'text-purple-400' },
};
const POMODORO_DURATIONS = { focus: 25 * 60, short: 5 * 60, long: 15 * 60 };

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

  const [showModal, setShowModal]       = useState(false);
  const [editingEvent, setEditingEvent] = useState<StudyPlanEvent | null>(null);

  const [insights, setInsights]                 = useState<AIInsight[]>([]);
  const [insightsLoading, setInsightsLoading]   = useState(false);
  const [scheduleLoading, setScheduleLoading]   = useState(false);
  const [suggestions, setSuggestions]           = useState<AIScheduleSuggestion[]>([]);
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  const [chatMessages, setChatMessages] = useState<{ role: 'user'|'assistant'; content: string }[]>([]);
  const [chatInput, setChatInput]       = useState('');
  const [chatLoading, setChatLoading]   = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [pomodoroActive, setPomodoroActive] = useState(false);
  const [pomodoroMode, setPomodoroMode]     = useState<'focus'|'short'|'long'>('focus');
  const [pomodoroTime, setPomodoroTime]     = useState(POMODORO_DURATIONS.focus);
  const [pomodoroSubject, setPomodoroSubject] = useState('');
  const pomodoroRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [showGoalForm, setShowGoalForm] = useState(false);
  const [newGoal, setNewGoal] = useState({ subject:'', targetDate:'', hoursNeeded:10, difficulty:'medium' as StudyGoal['difficulty'] });

  // ── Load ──────────────────────────────────────────────────────────────────
  useEffect(() => { if (user) loadAll(); }, [user]);

  const loadAll = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [evts, gls, stk] = await Promise.all([
        studyPlanService.getEventsForStudent(user.uid),
        studyPlanService.getGoalsForStudent(user.uid),
        studyPlanService.getStreak(user.uid),
      ]);
      setEvents(evts);
      setGoals(gls);
      if (stk) setStreak({ current: stk.currentStreak, longest: stk.longestStreak, totalSessions: stk.totalSessions });
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (events.length > 0 && GEMINI_KEY && insights.length === 0 && user) loadInsights();
  }, [events]);

  const loadInsights = async () => {
    if (!user || !GEMINI_KEY) return;
    setInsightsLoading(true);
    try {
      const upcoming  = events.filter(e => e.date >= new Date() && !e.completed);
      const completed = events.filter(e => e.completed).length;
      const rate      = events.length > 0 ? Math.round((completed / events.length) * 100) : 0;
      setInsights(await aiStudyPlannerService.getPersonalizedInsights(
        user.displayName || user.name || 'Student', upcoming, rate, GEMINI_KEY
      ));
    } catch { /* silent */ } finally { setInsightsLoading(false); }
  };

  // ── Derived ────────────────────────────────────────────────────────────────
  const selectedDate   = date instanceof Date ? date : new Date();
  const upcomingEvents = events.filter(e => e.date >= new Date() && !e.completed).sort((a,b) => a.date.getTime()-b.date.getTime());
  const completedCount = events.filter(e => e.completed).length;
  const completionRate = events.length > 0 ? Math.round((completedCount/events.length)*100) : 0;
  const thisWeekEvents = events.filter(e => { const n=new Date(); return e.date>=startOfWeek(n)&&e.date<=endOfWeek(n); });
  const todayEvents    = events.filter(e => isToday(e.date));
  const dayEvents      = events.filter(e => e.date.toDateString()===selectedDate.toDateString());

  // ── CRUD ──────────────────────────────────────────────────────────────────
  const handleSaveEvent = async (data: any) => {
    if (!user) return;
    try {
      if (editingEvent) await studyPlanService.updateEvent(editingEvent.id, data);
      else              await studyPlanService.createEvent(data);
      setShowModal(false); setEditingEvent(null); await loadAll();
    } catch (e: any) { setError(e.message); }
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

  // ── AI Schedule ────────────────────────────────────────────────────────────
  const handleGenerateSchedule = async () => {
    if (!GEMINI_KEY || !goals.length) return;
    setScheduleLoading(true);
    try {
      const result = await aiStudyPlannerService.generateSmartSchedule(
        goals.map(g => ({ subject:g.subject, targetDate:g.targetDate, hoursNeeded:g.hoursNeeded, difficulty:g.difficulty, currentProgress:g.currentProgress })),
        events.map(e => ({ date:e.date, startTime:e.startTime, endTime:e.endTime })),
        6, GEMINI_KEY
      );
      setSuggestions(result); setShowScheduleModal(true);
    } catch (e: any) { setError('AI schedule: ' + e.message); }
    finally { setScheduleLoading(false); }
  };

  const handleAcceptSchedule = async () => {
    if (!user) return;
    await studyPlanService.createBulkAIEvents(
      suggestions.map(s => ({
        title:s.title, description:s.reason, date:s.date, startTime:s.startTime, endTime:s.endTime,
        course:s.subject, instructorId:user.uid, instructorName:user.displayName||user.name||'',
        isPersonal:true, studentId:user.uid, targetAudience:'specific_student' as const,
        targetStudentIds:[user.uid], targetCourseIds:[], eventType:'study_session' as const,
        priority:s.priority, isAIGenerated:true, aiReason:s.reason, aiTips:s.tips,
        sessionType:s.sessionType, completed:false,
      })), user.uid
    );
    setShowScheduleModal(false); setSuggestions([]); await loadAll();
  };

  // ── Pomodoro ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (pomodoroActive) {
      pomodoroRef.current = setInterval(() => {
        setPomodoroTime(t => {
          if (t <= 1) {
            setPomodoroActive(false);
            if (pomodoroMode === 'focus' && user) {
              studyPlanService.savePomodoroSession({ studentId:user.uid, subject:pomodoroSubject||'General', startTime:new Date(), duration:25, completed:true, notes:'' })
                .then(() => studyPlanService.getStreak(user.uid))
                .then(s => { if(s) setStreak({current:s.currentStreak,longest:s.longestStreak,totalSessions:s.totalSessions}); })
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

  const resetPomodoro = (mode: 'focus'|'short'|'long') => {
    setPomodoroActive(false); setPomodoroMode(mode); setPomodoroTime(POMODORO_DURATIONS[mode]);
  };

  const pct          = Math.round((1 - pomodoroTime / POMODORO_DURATIONS[pomodoroMode]) * 100);
  const pMins        = String(Math.floor(pomodoroTime/60)).padStart(2,'0');
  const pSecs        = String(pomodoroTime%60).padStart(2,'0');
  const circumference = 2*Math.PI*54;

  // ── Goals ──────────────────────────────────────────────────────────────────
  const handleAddGoal = async () => {
    if (!user||!newGoal.subject||!newGoal.targetDate) return;
    try {
      await studyPlanService.createGoal({ studentId:user.uid, subject:newGoal.subject, targetDate:new Date(newGoal.targetDate), hoursNeeded:newGoal.hoursNeeded, hoursCompleted:0, difficulty:newGoal.difficulty, currentProgress:0, isActive:true });
      setNewGoal({subject:'',targetDate:'',hoursNeeded:10,difficulty:'medium'}); setShowGoalForm(false);
      setGoals(await studyPlanService.getGoalsForStudent(user.uid));
    } catch (e: any) { setError(e.message); }
  };

  const handleUpdateGoalProgress = async (id: string, progress: number) => {
    try { await studyPlanService.updateGoal(id,{currentProgress:progress}); setGoals(await studyPlanService.getGoalsForStudent(user!.uid)); }
    catch { /* silent */ }
  };

  // ── Chat ───────────────────────────────────────────────────────────────────
  useEffect(() => { chatEndRef.current?.scrollIntoView({behavior:'smooth'}); }, [chatMessages]);

  const handleSendChat = async () => {
    if (!chatInput.trim()||!GEMINI_KEY||chatLoading) return;
    const msg = chatInput.trim(); setChatInput('');
    setChatMessages(p=>[...p,{role:'user',content:msg}]); setChatLoading(true);
    try {
      const subjects = [...new Set(events.map(e=>e.course).filter(Boolean))];
      const exams    = events.filter(e=>e.eventType==='exam'&&e.date>=new Date()).map(e=>e.title);
      const reply    = await aiStudyPlannerService.chatWithAI(msg,{events:events.length,subjects,upcomingExams:exams},chatMessages,GEMINI_KEY);
      setChatMessages(p=>[...p,{role:'assistant',content:reply}]);
    } catch { setChatMessages(p=>[...p,{role:'assistant',content:'Sorry, I had trouble responding. Try again.'}]); }
    finally { setChatLoading(false); }
  };

  const inputCls = 'w-full bg-background-700 text-white text-sm rounded-xl px-3 py-2.5 border border-background-600 focus:outline-none focus:border-primary-500 transition-colors placeholder-gray-500';

  if (loading) return <div className="flex items-center justify-center h-64"><Loader size={32} className="animate-spin text-primary-500" /></div>;

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            My Study Plan
            {GEMINI_KEY && <span className="text-xs bg-purple-500/15 border border-purple-500/30 text-purple-300 px-2 py-1 rounded-full flex items-center gap-1"><Sparkles size={10} /> AI</span>}
          </h1>
          <p className="text-gray-400 mt-1 text-sm">Manage your schedule and track progress</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {GEMINI_KEY && goals.length > 0 && (
            <button onClick={handleGenerateSchedule} disabled={scheduleLoading}
              className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-primary-600 hover:from-purple-700 hover:to-primary-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-lg disabled:opacity-50">
              {scheduleLoading ? <Loader size={14} className="animate-spin" /> : <Brain size={14} />}
              {scheduleLoading ? 'Generating…' : 'AI Schedule'}
            </button>
          )}
          <button onClick={() => { setEditingEvent(null); setShowModal(true); }}
            className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all">
            <Plus size={14} /> Add Event
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl flex items-center gap-2 text-sm">
          <AlertCircle size={14} />{error}<button onClick={()=>setError('')} className="ml-auto"><X size={13}/></button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {label:'Streak',      value:streak.current,          extra:`🔥 Best: ${streak.longest}d`, cls:'from-orange-600/20 to-red-600/20 border-orange-500/20'},
          {label:'This Week',   value:thisWeekEvents.length,   extra:`📅 ${todayEvents.length} today`, cls:'from-blue-600/20 to-indigo-600/20 border-blue-500/20'},
          {label:'Completion',  value:`${completionRate}%`,    extra:`✅ ${completedCount}/${events.length}`, cls:'from-emerald-600/20 to-green-600/20 border-emerald-500/20'},
          {label:'Goals',       value:goals.length,            extra:`🎯 ${goals.filter(g=>g.currentProgress>=100).length} done`, cls:'from-purple-600/20 to-violet-600/20 border-purple-500/20'},
        ].map(s=>(
          <div key={s.label} className={`bg-gradient-to-br ${s.cls} border rounded-2xl p-4`}>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">{s.label}</p>
            <p className="text-2xl font-bold text-white">{s.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{s.extra}</p>
          </div>
        ))}
      </div>

      {/* AI Insights */}
      {(insights.length>0||insightsLoading) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {insightsLoading && [1,2,3,4].map(i=>(
            <div key={i} className="bg-background-800 border border-background-700 rounded-2xl p-4 animate-pulse"><div className="h-3 bg-background-600 rounded w-24 mb-2"/><div className="h-2 bg-background-600 rounded w-full"/></div>
          ))}
          {insights.map((ins,i)=>{
            const s=INSIGHT_STYLE[ins.type]||INSIGHT_STYLE.tip; const Icon=s.icon;
            return (
              <div key={i} className={`${s.bg} border rounded-2xl p-4`}>
                <div className="flex items-center gap-2 mb-1.5"><Icon size={13} className={s.color}/><span className={`text-xs font-semibold ${s.color}`}>{ins.title}</span></div>
                <p className="text-xs text-gray-300 leading-relaxed">{ins.message}</p>
                {ins.action && <p className="text-xs mt-1.5 font-medium text-primary-400">{ins.action} →</p>}
              </div>
            );
          })}
        </div>
      )}

      {/* View Tabs */}
      <div className="flex gap-1 bg-background-800 border border-background-700 p-1 rounded-2xl w-fit flex-wrap">
        {([
          {id:'calendar',  label:'Calendar',  Icon:CalendarIcon},
          {id:'list',      label:'Upcoming',  Icon:ListTodo},
          {id:'analytics', label:'Analytics', Icon:BarChart2},
          {id:'chat',      label:'AI Chat',   Icon:MessageSquare},
        ] as const).map(t=>(
          <button key={t.id} onClick={()=>setView(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${view===t.id?'bg-primary-600 text-white shadow':'text-gray-400 hover:text-white'}`}>
            <t.Icon size={13}/>{t.label}
          </button>
        ))}
      </div>

      {/* ── CALENDAR ── */}
      {view==='calendar' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-4">
            <Card>
              <h2 className="text-base font-semibold text-white mb-4">Calendar</h2>
              <div className="custom-calendar">
                <Calendar onChange={setDate} value={date}
                  className="bg-transparent text-white rounded-lg w-full"
                  tileClassName={({date:d})=>events.some(e=>e.date.toDateString()===d.toDateString())?'has-event':null}
                  prevLabel={<ChevronLeft size={15}/>} nextLabel={<ChevronRight size={15}/>}
                  navigationLabel={({date:d})=><span className="text-white font-medium">{format(d,'MMMM yyyy')}</span>}
                />
              </div>
              <div className="mt-4 pt-4 border-t border-background-700 grid grid-cols-2 gap-1.5">
                {[['assignment','amber'],['exam','red'],['class','indigo'],['study_session','emerald'],['deadline','pink'],['personal','purple']].map(([t,c])=>(
                  <div key={t} className="flex items-center gap-1.5"><div className={`h-2 w-2 rounded-full bg-${c}-500`}/><span className="text-xs text-gray-400 capitalize">{t.replace('_',' ')}</span></div>
                ))}
              </div>
            </Card>

            {/* Pomodoro */}
            <Card>
              <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2"><Timer size={14} className="text-primary-400"/> Pomodoro Timer</h2>
              <div className="relative flex justify-center items-center mb-4 h-32">
                <svg width="128" height="128" className="-rotate-90" style={{position:'absolute'}}>
                  <circle cx="64" cy="64" r="54" strokeWidth="8" stroke="#1f2937" fill="none"/>
                  <circle cx="64" cy="64" r="54" strokeWidth="8" stroke="#6366f1" fill="none"
                    strokeDasharray={circumference} strokeDashoffset={circumference*(1-pct/100)}
                    strokeLinecap="round" style={{transition:'stroke-dashoffset 1s linear'}}/>
                </svg>
                <div className="relative text-center z-10">
                  <span className="text-2xl font-bold text-white font-mono">{pMins}:{pSecs}</span>
                  <p className="text-xs text-gray-400 capitalize">{pomodoroMode==='short'?'Short Break':pomodoroMode==='long'?'Long Break':'Focus'}</p>
                </div>
              </div>
              <div className="flex gap-2 mb-3">
                {(['focus','short','long'] as const).map(m=>(
                  <button key={m} onClick={()=>resetPomodoro(m)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${pomodoroMode===m?'bg-primary-600 text-white':'bg-background-700 text-gray-400 hover:text-white'}`}>
                    {m==='focus'?'25m':m==='short'?'5m':'15m'}
                  </button>
                ))}
              </div>
              <input value={pomodoroSubject} onChange={e=>setPomodoroSubject(e.target.value)} placeholder="Subject (optional)" className={inputCls+' mb-3'}/>
              <div className="flex gap-2">
                <button onClick={()=>setPomodoroActive(p=>!p)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${pomodoroActive?'bg-amber-600 hover:bg-amber-700':'bg-primary-600 hover:bg-primary-700'} text-white`}>
                  {pomodoroActive?<><Pause size={13}/>Pause</>:<><Play size={13}/>Start</>}
                </button>
                <button onClick={()=>resetPomodoro(pomodoroMode)} className="p-2.5 bg-background-700 hover:bg-background-600 text-gray-400 hover:text-white rounded-xl transition-colors"><RotateCcw size={14}/></button>
              </div>
              {streak.totalSessions>0 && <p className="text-xs text-center text-gray-500 mt-3">{streak.totalSessions} sessions · ~{Math.round(streak.totalSessions*25/60)}h focused</p>}
            </Card>
          </div>

          <div className="lg:col-span-2 space-y-4">
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-white">
                  {isToday(selectedDate)?'Today':isTomorrow(selectedDate)?'Tomorrow':format(selectedDate,'MMMM d, yyyy')}
                  <span className="text-gray-500 text-sm font-normal ml-2">({dayEvents.length})</span>
                </h2>
                <button onClick={()=>{setEditingEvent(null);setShowModal(true);}} className="flex items-center gap-1 text-xs bg-primary-600 hover:bg-primary-700 text-white px-3 py-1.5 rounded-lg transition-colors"><Plus size={12}/>Add</button>
              </div>
              {dayEvents.length===0 ? (
                <div className="py-8 text-center text-gray-400"><CalendarIcon size={36} className="mx-auto mb-3 text-gray-600"/><p className="text-sm">No events for this day</p></div>
              ) : (
                <div className="space-y-3">
                  {dayEvents.map(ev=>(
                    <div key={ev.id} className={`bg-background-800 rounded-xl p-4 border-l-4 ${TYPE_COLOR[ev.eventType]||'border-gray-500'} ${ev.completed?'opacity-60':''}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center flex-wrap gap-2 mb-1.5">
                            <span>{TYPE_EMOJI[ev.eventType]||'📅'}</span>
                            <span className={`text-sm font-semibold ${ev.completed?'line-through text-gray-500':'text-white'}`}>{ev.title}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${TYPE_BG[ev.eventType]}`}>{ev.eventType.replace('_',' ')}</span>
                            {ev.isAIGenerated&&<span className="text-xs bg-purple-500/15 text-purple-300 px-1.5 py-0.5 rounded-full flex items-center gap-1"><Sparkles size={9}/>AI</span>}
                          </div>
                          {ev.description&&<p className="text-xs text-gray-400 mb-1.5 line-clamp-1">{ev.description}</p>}
                          <div className="flex flex-wrap gap-3 text-xs text-gray-400">
                            <span className="flex items-center gap-1"><Clock size={11}/>{ev.startTime}–{ev.endTime}</span>
                            {ev.course&&<span className="flex items-center gap-1"><BookOpen size={11}/>{ev.course}</span>}
                            {!ev.isPersonal&&<span className="text-gray-500">by {ev.instructorName}</span>}
                          </div>
                          {ev.aiTips?.[0]&&<p className="text-xs text-purple-300/60 mt-1.5">💡 {ev.aiTips[0]}</p>}
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button onClick={()=>handleToggleComplete(ev)} className={`p-1.5 rounded-lg transition-colors ${ev.completed?'bg-emerald-500/20 text-emerald-400':'bg-background-700 text-gray-500 hover:text-emerald-400'}`}><CheckCircle2 size={13}/></button>
                          {ev.isPersonal&&ev.studentId===user?.uid&&(
                            <>
                              <button onClick={()=>{setEditingEvent(ev);setShowModal(true);}} className="p-1.5 bg-background-700 hover:bg-background-600 text-gray-400 hover:text-white rounded-lg transition-colors"><Edit size={12}/></button>
                              <button onClick={()=>handleDelete(ev.id)} className="p-1.5 bg-background-700 hover:bg-red-500/20 text-gray-400 hover:text-red-400 rounded-lg transition-colors"><Trash2 size={12}/></button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Goals */}
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-white flex items-center gap-2"><Target size={14} className="text-primary-400"/>Study Goals</h2>
                <button onClick={()=>setShowGoalForm(p=>!p)} className="flex items-center gap-1 text-xs bg-primary-600 hover:bg-primary-700 text-white px-3 py-1.5 rounded-lg transition-colors"><Plus size={12}/>Goal</button>
              </div>
              {showGoalForm&&(
                <div className="mb-4 p-4 bg-background-700 rounded-xl space-y-3 border border-background-600">
                  <div className="grid grid-cols-2 gap-3">
                    <input value={newGoal.subject} onChange={e=>setNewGoal(p=>({...p,subject:e.target.value}))} placeholder="Subject" className={inputCls}/>
                    <input type="date" value={newGoal.targetDate} onChange={e=>setNewGoal(p=>({...p,targetDate:e.target.value}))} className={inputCls}/>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="text-xs text-gray-400 mb-1 block">Hours needed</label><input type="number" min={1} value={newGoal.hoursNeeded} onChange={e=>setNewGoal(p=>({...p,hoursNeeded:Number(e.target.value)}))} className={inputCls}/></div>
                    <div><label className="text-xs text-gray-400 mb-1 block">Difficulty</label><select value={newGoal.difficulty} onChange={e=>setNewGoal(p=>({...p,difficulty:e.target.value as any}))} className={inputCls}><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleAddGoal} className="flex-1 bg-primary-600 hover:bg-primary-700 text-white py-2 rounded-xl text-sm font-medium transition-colors">Save</button>
                    <button onClick={()=>setShowGoalForm(false)} className="px-4 bg-background-600 text-gray-400 py-2 rounded-xl text-sm transition-colors">Cancel</button>
                  </div>
                </div>
              )}
              {goals.length===0 ? (
                <p className="text-sm text-gray-500 text-center py-4">Add goals to enable AI Schedule!</p>
              ) : (
                <div className="space-y-3">
                  {goals.map(g=>{
                    const d=differenceInDays(g.targetDate,new Date());
                    return (
                      <div key={g.id} className="bg-background-800 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-white">{g.subject}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded ${g.difficulty==='hard'?'bg-red-500/15 text-red-400':g.difficulty==='medium'?'bg-amber-500/15 text-amber-400':'bg-emerald-500/15 text-emerald-400'}`}>{g.difficulty}</span>
                          </div>
                          <span className={`text-xs ${d<=3?'text-red-400':d<=7?'text-amber-400':'text-gray-400'}`}>{d}d left</span>
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="flex-1 bg-background-700 rounded-full h-1.5 overflow-hidden"><div className="h-full bg-gradient-to-r from-primary-600 to-purple-600 rounded-full transition-all" style={{width:`${g.currentProgress}%`}}/></div>
                          <span className="text-xs text-gray-400 w-8 text-right">{g.currentProgress}%</span>
                        </div>
                        <div className="flex gap-1">
                          {[25,50,75,100].map(p=>(
                            <button key={p} onClick={()=>handleUpdateGoalProgress(g.id,p)}
                              className={`flex-1 py-1 rounded text-xs transition-colors ${g.currentProgress>=p?'bg-primary-600 text-white':'bg-background-700 text-gray-500 hover:text-white'}`}>
                              {p}%
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {/* ── LIST VIEW ── */}
      {view==='list' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card>
              <h2 className="text-base font-semibold text-white mb-4">Upcoming Events ({upcomingEvents.length})</h2>
              {upcomingEvents.length===0 ? (
                <div className="py-10 text-center text-gray-400"><CalendarIcon size={36} className="mx-auto mb-3 text-gray-600"/><p className="text-sm">No upcoming events</p></div>
              ) : (
                <div className="space-y-3">
                  {upcomingEvents.map(ev=>{
                    const d=differenceInDays(ev.date,new Date());
                    return (
                      <div key={ev.id} className={`bg-background-800 rounded-xl p-4 border-l-4 ${TYPE_COLOR[ev.eventType]||'border-gray-500'}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center flex-wrap gap-2 mb-1">
                              <span>{TYPE_EMOJI[ev.eventType]}</span>
                              <span className="text-sm font-semibold text-white">{ev.title}</span>
                              {ev.isAIGenerated&&<span className="text-xs bg-purple-500/15 text-purple-300 px-1.5 py-0.5 rounded-full flex items-center gap-1"><Sparkles size={9}/>AI</span>}
                            </div>
                            <div className="flex flex-wrap gap-3 text-xs text-gray-400">
                              <span>{format(ev.date,'EEE, MMM d')}</span>
                              {ev.startTime&&<span><Clock size={11} className="inline mr-0.5"/>{ev.startTime}–{ev.endTime}</span>}
                              {ev.course&&<span>{ev.course}</span>}
                              <span className={`font-semibold ${d<=1?'text-red-400':d<=3?'text-amber-400':'text-gray-400'}`}>{d===0?'Today':d===1?'Tomorrow':`${d}d`}</span>
                            </div>
                          </div>
                          <button onClick={()=>handleToggleComplete(ev)} className="p-1.5 bg-background-700 hover:bg-background-600 text-gray-400 hover:text-emerald-400 rounded-lg transition-colors flex-shrink-0"><CheckCircle2 size={13}/></button>
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
              {goals.length===0?<p className="text-xs text-gray-500">No goals added</p>:goals.map(g=>(
                <div key={g.id} className="mb-3 last:mb-0">
                  <div className="flex justify-between text-xs mb-1"><span className="text-gray-300 font-medium truncate">{g.subject}</span><span className="text-gray-500 flex-shrink-0">{g.currentProgress}%</span></div>
                  <div className="h-1.5 bg-background-700 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-primary-600 to-purple-600 rounded-full" style={{width:`${g.currentProgress}%`}}/></div>
                </div>
              ))}
            </Card>
            <Card>
              <h3 className="text-sm font-semibold text-white mb-3">By Event Type</h3>
              {['assignment','exam','class','study_session','deadline','personal'].map(t=>{
                const count=events.filter(e=>e.eventType===t).length;
                if(!count) return null;
                return <div key={t} className="flex items-center justify-between py-1.5 border-b border-background-700 last:border-0"><span className="text-xs text-gray-400 capitalize flex items-center gap-1.5">{TYPE_EMOJI[t]}{t.replace('_',' ')}</span><span className="text-xs font-semibold text-white">{count}</span></div>;
              })}
            </Card>
          </div>
        </div>
      )}

      {/* ── ANALYTICS VIEW ── */}
      {view==='analytics' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[
            {label:'Total Events',  value:events.length,        icon:CalendarIcon, c:'text-blue-400',    bg:'bg-blue-500/10'},
            {label:'Completed',     value:completedCount,       icon:CheckCircle2, c:'text-emerald-400', bg:'bg-emerald-500/10'},
            {label:'Upcoming',      value:upcomingEvents.length, icon:Clock,        c:'text-amber-400',  bg:'bg-amber-500/10'},
            {label:'Active Goals',  value:goals.length,         icon:Target,       c:'text-purple-400', bg:'bg-purple-500/10'},
            {label:'Study Streak',  value:`${streak.current}d`, icon:Flame,        c:'text-orange-400', bg:'bg-orange-500/10'},
            {label:'Pomodoros',     value:streak.totalSessions, icon:Timer,        c:'text-pink-400',   bg:'bg-pink-500/10'},
          ].map(s=>(
            <div key={s.label} className="bg-background-800 border border-background-700 rounded-2xl p-5">
              <div className={`w-10 h-10 ${s.bg} rounded-xl flex items-center justify-center mb-3`}><s.icon size={17} className={s.c}/></div>
              <p className="text-2xl font-bold text-white">{s.value}</p>
              <p className="text-sm text-gray-400 mt-0.5">{s.label}</p>
            </div>
          ))}
          <div className="bg-background-800 border border-background-700 rounded-2xl p-5 sm:col-span-2">
            <h3 className="text-sm font-semibold text-white mb-4">Overall Completion Rate</h3>
            <div className="flex items-center gap-4 mb-2">
              <div className="flex-1 bg-background-700 rounded-full h-3 overflow-hidden"><div className="h-full bg-gradient-to-r from-primary-600 to-emerald-500 rounded-full" style={{width:`${completionRate}%`}}/></div>
              <span className="text-2xl font-bold text-white w-14 text-right">{completionRate}%</span>
            </div>
            <p className="text-xs text-gray-400">{completedCount} of {events.length} events completed</p>
          </div>
          <div className="bg-background-800 border border-background-700 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Achievements</h3>
            <div className="space-y-2">
              {[
                {label:'Study Streak',  earned:streak.current>=3,   icon:'🔥', desc:'3+ day streak'},
                {label:'Goal Setter',   earned:goals.length>=1,     icon:'🎯', desc:'Added a goal'},
                {label:'Pomodoro Pro',  earned:streak.totalSessions>=5, icon:'⏱️', desc:'5+ sessions'},
                {label:'Completionist', earned:completionRate>=75,  icon:'✅', desc:'75% completion'},
                {label:'AI Adopter',    earned:events.some(e=>e.isAIGenerated), icon:'🤖', desc:'Used AI schedule'},
              ].map(a=>(
                <div key={a.label} className={`flex items-center gap-3 p-2.5 rounded-xl ${a.earned?'bg-primary-500/10':'opacity-40'}`}>
                  <span className="text-lg">{a.icon}</span>
                  <div><p className="text-xs font-semibold text-white">{a.label}</p><p className="text-xs text-gray-500">{a.desc}</p></div>
                  {a.earned&&<CheckCircle2 size={13} className="text-emerald-400 ml-auto"/>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── AI CHAT VIEW ── */}
      {view==='chat' && (
        <Card>
          <div className="flex items-center gap-3 mb-4 pb-4 border-b border-background-700">
            <div className="w-9 h-9 bg-gradient-to-br from-purple-600 to-primary-600 rounded-xl flex items-center justify-center"><Brain size={15} className="text-white"/></div>
            <div><h2 className="text-base font-semibold text-white">AI Study Assistant</h2><p className="text-xs text-gray-400">Powered by Gemini 2.5 Flash</p></div>
          </div>
          <div className="h-80 overflow-y-auto space-y-3 mb-4">
            {chatMessages.length===0&&(
              <div className="space-y-2">
                <p className="text-sm text-gray-400 text-center py-4">Ask me anything about your studies!</p>
                {['How should I prepare for my exams?','Create a study plan for this week','Best memory techniques?','Help me stay motivated'].map(p=>(
                  <button key={p} onClick={()=>setChatInput(p)} className="w-full text-left text-xs bg-background-700 hover:bg-background-600 text-gray-300 px-3 py-2.5 rounded-xl transition-colors border border-background-600">{p}</button>
                ))}
              </div>
            )}
            {chatMessages.map((m,i)=>(
              <div key={i} className={`flex ${m.role==='user'?'justify-end':'justify-start'}`}>
                <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${m.role==='user'?'bg-primary-600 text-white rounded-br-sm':'bg-background-700 text-gray-200 rounded-bl-sm'}`}>{m.content}</div>
              </div>
            ))}
            {chatLoading&&<div className="flex justify-start"><div className="bg-background-700 px-4 py-2.5 rounded-2xl rounded-bl-sm flex items-center gap-2"><Loader size={11} className="animate-spin text-primary-400"/><span className="text-xs text-gray-400">Thinking…</span></div></div>}
            <div ref={chatEndRef}/>
          </div>
          <div className="flex gap-2">
            <input value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();handleSendChat();}}} placeholder="Ask your AI study assistant…" className={inputCls+' flex-1'}/>
            <button onClick={handleSendChat} disabled={!chatInput.trim()||chatLoading||!GEMINI_KEY} className="bg-primary-600 hover:bg-primary-700 text-white p-2.5 rounded-xl transition-colors disabled:opacity-50 flex-shrink-0"><Send size={15}/></button>
          </div>
          {!GEMINI_KEY&&<p className="text-xs text-amber-400 mt-2">⚠️ VITE_GEMINI_API_KEY not set</p>}
        </Card>
      )}

      {/* AI Schedule Modal */}
      {showScheduleModal&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-background-900 border border-background-700 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-background-700">
              <div className="flex items-center gap-2"><Brain size={17} className="text-purple-400"/><h3 className="text-base font-bold text-white">AI Generated Schedule</h3><span className="text-xs text-gray-500">{suggestions.length} sessions</span></div>
              <button onClick={()=>setShowScheduleModal(false)} className="text-gray-400 hover:text-white"><X size={17}/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {suggestions.map((s,i)=>(
                <div key={i} className={`bg-background-800 rounded-xl p-4 border-l-4 ${s.priority==='high'?'border-red-500':s.priority==='medium'?'border-amber-500':'border-emerald-500'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{s.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{format(s.date,'EEE, MMM d')} · {s.startTime}–{s.endTime} · {s.subject}</p>
                      <p className="text-xs text-purple-300/70 mt-1">💡 {s.reason}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${s.priority==='high'?'bg-red-500/15 text-red-400':s.priority==='medium'?'bg-amber-500/15 text-amber-400':'bg-emerald-500/15 text-emerald-400'}`}>{s.priority}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-6 py-4 border-t border-background-700 flex gap-3 justify-end">
              <button onClick={()=>setShowScheduleModal(false)} className="px-5 py-2.5 bg-background-700 hover:bg-background-600 text-gray-300 rounded-xl text-sm font-medium transition-colors">Cancel</button>
              <button onClick={handleAcceptSchedule} className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-primary-600 hover:from-purple-700 hover:to-primary-700 text-white rounded-xl text-sm font-semibold transition-all shadow-lg">Add All to Planner</button>
            </div>
          </div>
        </div>
      )}

      {showModal&&(
        <StudyPlanEventModal selectedDate={selectedDate} currentUser={user} allStudents={[]} allCourses={[]} event={editingEvent}
          onClose={()=>{setShowModal(false);setEditingEvent(null);}} onSave={handleSaveEvent} isPersonalEvent={true}/>
      )}
    </div>
  );
};

export default StudentStudyPlan;
