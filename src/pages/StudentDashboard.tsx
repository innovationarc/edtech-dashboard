// src/pages/StudentDashboard.tsx — Student-friendly, professional, glass theme
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Target, Clock, Calendar, Star, Play, Pause, RotateCcw, Plus,
  CheckCircle, Circle, Megaphone, Award, BookOpen, Zap, Bell, X,
  Loader, AlertCircle, Video, Radio,
} from 'lucide-react';
import Card from '../components/ui/Card';
import { useDashboard } from '../contexts/DashboardContext';
import { getRandomQuote } from '../utils/quotes';
import { announcementService, Announcement } from '../services/announcementService';
import { courseService } from '../services/courseService';
import { gamificationService } from '../services/gamificationService';
import { qaService } from '../services/qaService';
import { studyPlanService, StudyPlanEvent } from '../services/studyPlanService';
import StudyPlanEventModal from '../components/shared/StudyPlanEventModal';
import { liveClassService } from '../services/liveClassService';
import { LiveClass } from '../types/liveClassTypes';
import { streamService } from '../services/streamService';
import { LiveStream } from '../types/streamTypes';

interface Objective { id:string; title:string; completed:boolean; priority:'high'|'medium'|'low'; }
interface Goal { id:string; title:string; description:string; progress:number; target:number; category:string; deadline:Date; }
interface TopicStar { id:string; name:string; mastered:boolean; progress:number; position:{x:number;y:number}; }
interface SubjectConstellation { id:string; name:string; color:string; stars:TopicStar[]; overallProgress:number; }

const GI: React.CSSProperties = {
  width:'100%', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.12)',
  borderRadius:10, padding:'8px 12px', color:'rgba(255,255,255,0.9)', fontSize:13,
  fontFamily:"'Outfit',sans-serif", outline:'none',
};
const PC = (p:string) => p==='high'?'#ef4444':p==='medium'?'#f59e0b':'#10b981';
const APB = (p:string) => p==='high'?'#ef4444':p==='medium'?'#f59e0b':p==='low'?'#10b981':'rgba(255,255,255,0.1)';
const EDC = (t:string) => { const s=t.toLowerCase(); return s.includes('exam')||s.includes('test')||s.includes('quiz')?'#ef4444':s.includes('assignment')||s.includes('due')?'#f59e0b':s.includes('class')||s.includes('lecture')?'#6366f1':'#10b981'; };

const StudentDashboard = () => {
  const { user, primaryColor = '#6366f1', accentColor = '#8b5cf6', theme } = useDashboard();
  const navigate = useNavigate();
  const isLight = theme === 'light';
  const dark = !isLight;

  // Theme-aware text & surface colors
  const T = {
    text:    isLight ? '#111827'              : 'rgba(255,255,255,0.88)',
    text2:   isLight ? '#6b7280'              : 'rgba(255,255,255,0.52)',
    text3:   isLight ? '#9ca3af'              : 'rgba(255,255,255,0.32)',
    muted:   isLight ? 'rgba(0,0,0,0.45)'    : 'rgba(255,255,255,0.38)',
    surface: isLight ? 'rgba(0,0,0,0.045)'   : 'rgba(255,255,255,0.06)',
    border:  isLight ? 'rgba(0,0,0,0.075)'   : 'rgba(255,255,255,0.08)',
    dimIcon: isLight ? 'rgba(0,0,0,0.25)'    : 'rgba(255,255,255,0.24)',
    ring:    isLight ? 'rgba(0,0,0,0.08)'    : 'rgba(255,255,255,0.08)',
    trackBg: isLight ? 'rgba(0,0,0,0.08)'    : 'rgba(255,255,255,0.09)',
    starBg:  isLight ? 'rgba(0,0,0,0.06)'    : 'rgba(0,0,0,0.22)',
    tagBg:   isLight ? 'rgba(0,0,0,0.06)'    : 'rgba(255,255,255,0.065)',
  };
  const [dailyQuote, setDailyQuote]                 = useState(() => getRandomQuote());
  const [isMobile, setIsMobile]                     = useState(() => window.innerWidth < 768);
  const [announcements, setAnnouncements]           = useState<Announcement[]>([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(true);
  const [announcementsError, setAnnouncementsError] = useState('');
  const [calendarEvents, setCalendarEvents]         = useState<StudyPlanEvent[]>([]);
  const [calendarLoading, setCalendarLoading]       = useState(true);
  const [calendarError, setCalendarError]           = useState('');
  const [liveClasses, setLiveClasses]               = useState<LiveClass[]>([]);
  const [liveStreams, setLiveStreams]                = useState<LiveStream[]>([]);
  const [showObjModal, setShowObjModal]             = useState(false);
  const [showGoalModal, setShowGoalModal]           = useState(false);
  const [showEventModal, setShowEventModal]         = useState(false);
  const [selectedDate, setSelectedDate]             = useState(new Date());
  const [timerMin, setTimerMin]                     = useState(25);
  const [timerSec, setTimerSec]                     = useState(0);
  const [timerRunning, setTimerRunning]             = useState(false);
  const [timerMode, setTimerMode]                   = useState<'focus'|'break'>('focus');

  const [objectives, setObjectives] = useState<Objective[]>([
    {id:'1',title:'Complete Algebra homework',completed:false,priority:'high'},
    {id:'2',title:'Review Biology chapter 5',completed:true,priority:'medium'},
    {id:'3',title:'Practice Physics problems',completed:false,priority:'medium'},
    {id:'4',title:'Read History assignment',completed:false,priority:'low'},
  ]);

  const [goals, setGoals] = useState<Goal[]>([
    {id:'1',title:'Achieve an A in Biology',description:'Maintain high grades in all biology assessments',progress:75,target:100,category:'Academic',deadline:new Date(Date.now()+30*86400000)},
    {id:'2',title:'Complete Final Project Early',description:'Finish the CS project a week before deadline',progress:40,target:100,category:'Project',deadline:new Date(Date.now()+14*86400000)},
    {id:'3',title:'Master Calculus Fundamentals',description:'Complete all practice problems with 90% accuracy',progress:60,target:100,category:'Skill',deadline:new Date(Date.now()+21*86400000)},
  ]);

  const [constellations] = useState<SubjectConstellation[]>([
    {id:'1',name:'Mathematics',color:'#6366f1',overallProgress:75,stars:[
      {id:'1',name:'Algebra',mastered:true,progress:100,position:{x:20,y:30}},
      {id:'2',name:'Geometry',mastered:true,progress:100,position:{x:60,y:20}},
      {id:'3',name:'Calculus',mastered:false,progress:60,position:{x:40,y:60}},
      {id:'4',name:'Statistics',mastered:false,progress:30,position:{x:80,y:50}},
      {id:'5',name:'Trigonometry',mastered:false,progress:45,position:{x:30,y:80}},
    ]},
    {id:'2',name:'Physics',color:'#8b5cf6',overallProgress:60,stars:[
      {id:'6',name:'Mechanics',mastered:true,progress:100,position:{x:25,y:25}},
      {id:'7',name:'Thermodynamics',mastered:false,progress:70,position:{x:70,y:30}},
      {id:'8',name:'Electromagnetism',mastered:false,progress:40,position:{x:50,y:70}},
      {id:'9',name:'Optics',mastered:false,progress:20,position:{x:80,y:60}},
    ]},
    {id:'3',name:'Biology',color:'#10b981',overallProgress:85,stars:[
      {id:'10',name:'Cell Biology',mastered:true,progress:100,position:{x:30,y:20}},
      {id:'11',name:'Genetics',mastered:true,progress:100,position:{x:70,y:25}},
      {id:'12',name:'Evolution',mastered:true,progress:100,position:{x:50,y:50}},
      {id:'13',name:'Ecology',mastered:false,progress:80,position:{x:25,y:75}},
      {id:'14',name:'Anatomy',mastered:false,progress:65,position:{x:75,y:70}},
    ]},
  ]);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    setDailyQuote(getRandomQuote());
    if (!user) return;
    loadAnnouncements(); loadCalendarEvents(); loadLiveClasses(); loadLiveStreams();
    const iv = setInterval(()=>{loadAnnouncements();loadCalendarEvents();loadLiveClasses();loadLiveStreams();},30000);
    return ()=>clearInterval(iv);
  },[user]);

  useEffect(()=>{
    if (user?.role!=='student') return;
    let unsubs: (()=>void)[] = [];
    (async()=>{
      try {
        const qs = await qaService.getQuestions(undefined,'all');
        qs.filter(q=>q.studentId===user.uid).forEach(q=>{
          unsubs.push(qaService.onAnswerToQuestion(q.id,answers=>{
            if (answers.length>0&&q.status==='pending'&&(window as any).addNotification)
              (window as any).addNotification(`Your question "${q.questionText}" has been answered!`,'success');
          }));
        });
      } catch {}
    })();
    return ()=>unsubs.forEach(u=>u());
  },[user]);

  const loadAnnouncements = async () => {
    if (!user) return;
    try {
      setAnnouncementsLoading(true); setAnnouncementsError('');
      let ids: string[] = [];
      try { ids=(await courseService.getStudentEnrollments(user.uid)).map(e=>e.courseId); } catch {}
      setAnnouncements(await announcementService.getAnnouncementsForUser(user.uid,user.role,ids));
    } catch { setAnnouncementsError('Failed to load'); } finally { setAnnouncementsLoading(false); }
  };

  const loadCalendarEvents = async () => {
    if (!user) return;
    try {
      setCalendarLoading(true); setCalendarError('');
      const all = await studyPlanService.getEventsForStudent(user.uid);
      const now=new Date(); const today=new Date(now.getFullYear(),now.getMonth(),now.getDate());
      const next=new Date(today); next.setDate(today.getDate()+7);
      setCalendarEvents(all.filter(e=>{const d=new Date(e.date.getFullYear(),e.date.getMonth(),e.date.getDate());return d>=today&&d<=next;}).sort((a,b)=>a.date.getTime()-b.date.getTime()));
    } catch { setCalendarError('Failed to load'); setCalendarEvents([]); } finally { setCalendarLoading(false); }
  };

  const loadLiveClasses = async () => {
    try {
      const all = await liveClassService.getAll();
      const now = new Date();
      const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);
      setLiveClasses(all.filter(c => {
        if (c.status === 'live') return true;
        if (c.status === 'scheduled') {
          const t = c.scheduledAt.toDate();
          return t >= now && t <= in48h;
        }
        return false;
      }));
    } catch { /* silent — non-critical */ }
  };

  const loadLiveStreams = async () => {
    try {
      const all = await streamService.getAll();
      const now = new Date();
      const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);
      setLiveStreams(all.filter(s => {
        if (s.status === 'live') return true;
        if (s.status === 'scheduled' && s.scheduledAt) {
          const t = s.scheduledAt.toDate();
          return t >= now && t <= in48h;
        }
        return false;
      }));
    } catch { /* silent — non-critical */ }
  };

  useEffect(()=>{
    if (!timerRunning) return;
    const iv=setInterval(()=>{
      if (timerSec>0) { setTimerSec(s=>s-1); }
      else if (timerMin>0) { setTimerMin(m=>m-1); setTimerSec(59); }
      else {
        setTimerRunning(false);
        if (timerMode==='focus') { if (user) gamificationService.recordActivity(user.uid,'study_session',{duration:25}); setTimerMode('break'); setTimerMin(5); }
        else { setTimerMode('focus'); setTimerMin(25); }
        setTimerSec(0);
      }
    },1000);
    return ()=>clearInterval(iv);
  },[timerRunning,timerMin,timerSec,timerMode,user]);

  const toggleObj = (id:string) => setObjectives(p=>p.map(o=>o.id===id?{...o,completed:!o.completed}:o));
  const addObj = (title:string,priority:'high'|'medium'|'low') => { setObjectives(p=>[...p,{id:Date.now().toString(),title,completed:false,priority}]); setShowObjModal(false); };
  const addGoal = (title:string,desc:string,cat:string,dl:Date) => { setGoals(p=>[...p,{id:Date.now().toString(),title,description:desc,progress:0,target:100,category:cat,deadline:dl}]); setShowGoalModal(false); };

  const done = objectives.filter(o=>o.completed).length;
  const pct = Math.round((done/objectives.length)*100);
  const circ = 2*Math.PI*42;
  const timerPct = (timerMin*60+timerSec)/((timerMode==='focus'?25:5)*60);
  const hour = new Date().getHours();
  const greeting = hour<12?'Good morning':hour<17?'Good afternoon':'Good evening';

  return (
    <div style={{display:'flex',flexDirection:'column',gap:'clamp(18px,2.8vw,30px)',fontFamily:"'Outfit',sans-serif"}}>

      {/* Welcome Banner */}
      <div style={{animation:'cardReveal 500ms cubic-bezier(0.22,1,0.36,1) 0ms both'}}>
        <div className="flex items-start justify-between">
          <div style={{minWidth:0}}>
            <h1 style={{fontSize:'clamp(1.2rem,2.5vw,1.6rem)',fontWeight:800,color:T.text,margin:0,lineHeight:1.25}}>
              <span>Welcome back, </span>
              <span style={{display:'inline-block'}}>{user?.name || 'Student'}! 🌟</span>
            </h1>
            <p style={{color:T.text2,marginTop:4,fontSize:14,margin:'4px 0 0'}}>Ready to conquer your learning goals today?</p>
          </div>
          <div className="text-right" style={{flexShrink:0,marginLeft:12,display:'flex',flexDirection:'column',alignItems:'flex-end'}}>
            <div style={{fontSize:11,color:T.text3,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.08em'}}>Today</div>
            {isMobile ? <>
              <div style={{fontSize:16,fontWeight:700,color:T.text,whiteSpace:'nowrap'}}>
                {new Date().toLocaleDateString('en-US', { weekday:'long' })},
              </div>
              <div style={{fontSize:16,fontWeight:700,color:T.text,whiteSpace:'nowrap'}}>
                {new Date().toLocaleDateString('en-US', { month:'short', day:'numeric' })}
              </div>
            </> :
              <div style={{fontSize:16,fontWeight:700,color:T.text,whiteSpace:'nowrap'}}>
                {new Date().toLocaleDateString('en-US', { weekday:'long', month:'short', day:'numeric' })}
              </div>
            }
          </div>
        </div>
      </div>

      {/* Live Streams Card — only shown when there are live or upcoming (48h) streams */}
      {liveStreams.length > 0 && (
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <Radio size={15} color={primaryColor}/>
            <span style={{fontSize:12,fontWeight:700,color:T.text3,textTransform:'uppercase',letterSpacing:'0.08em'}}>Live Streams</span>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(min(100%,280px),1fr))',gap:'clamp(8px,1.2vw,14px)'}}>
            {liveStreams.map(s => {
              const isLive = s.status === 'live';
              const scheduledDate = s.scheduledAt?.toDate() ?? new Date();
              const diffMs = scheduledDate.getTime() - Date.now();
              const diffH = Math.floor(diffMs / 3600000);
              const diffM = Math.floor((diffMs % 3600000) / 60000);
              const timeLabel = isLive ? 'Live now' : diffH > 0 ? `In ${diffH}h ${diffM}m` : `In ${diffM}m`;
              return (
                <div key={s.id} style={{
                  display:'flex',alignItems:'center',gap:12,
                  padding:'11px 14px',borderRadius:13,
                  background: isLive ? 'rgba(99,102,241,0.08)' : T.surface,
                  border: isLive ? `1px solid rgba(99,102,241,0.28)` : `1px solid ${T.border}`,
                  transition:'all 0.15s',
                }}>
                  <div style={{width:36,height:36,borderRadius:10,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',background: isLive ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.08)'}}>
                    {isLive
                      ? <span style={{width:10,height:10,borderRadius:'50%',background:primaryColor,boxShadow:`0 0 0 3px ${primaryColor}40`,display:'block',animation:'pulse 1.5s ease-in-out infinite'}}/>
                      : <Radio size={16} color={primaryColor}/>
                    }
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <p style={{fontSize:'clamp(0.72rem,1.1vw,0.8rem)',fontWeight:700,color:T.text,margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{s.title}</p>
                    <div style={{display:'flex',alignItems:'center',gap:5,marginTop:2}}>
                      {isLive && <span style={{fontSize:9,fontWeight:800,background:'rgba(99,102,241,0.18)',color:primaryColor,borderRadius:4,padding:'1px 5px',letterSpacing:'0.05em'}}>LIVE</span>}
                      <span style={{fontSize:10,color:isLive ? `${primaryColor}bb` : T.text3}}>{timeLabel}</span>
                      {s.teacherName && <span style={{fontSize:10,color:T.text3,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>· {s.teacherName}</span>}
                    </div>
                  </div>
                  <button
                    onClick={() => navigate('/student-streams')}
                    style={{flexShrink:0,display:'flex',alignItems:'center',gap:5,padding:'6px 12px',borderRadius:8,border:'none',cursor:'pointer',fontSize:11,fontWeight:700,fontFamily:"'Outfit',sans-serif",background:`${primaryColor}cc`,color:'#fff',boxShadow:`0 2px 8px ${primaryColor}40`}}
                  >
                    <Play size={10} fill="#fff"/>
                    {isLive ? 'Watch' : 'View'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Live Classes Card — only shown when there are live or upcoming (48h) classes */}
      {liveClasses.length > 0 && (
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <Video size={15} color="#ef4444"/>
            <span style={{fontSize:12,fontWeight:700,color:T.text3,textTransform:'uppercase',letterSpacing:'0.08em'}}>Live &amp; Upcoming Classes</span>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(min(100%,280px),1fr))',gap:'clamp(8px,1.2vw,14px)'}}>
            {liveClasses.map(cls => {
              const isLive = cls.status === 'live';
              const scheduled = cls.scheduledAt.toDate();
              const diffMs = scheduled.getTime() - Date.now();
              const diffH = Math.floor(diffMs / 3600000);
              const diffM = Math.floor((diffMs % 3600000) / 60000);
              const timeLabel = isLive ? 'Happening now' : diffH > 0 ? `In ${diffH}h ${diffM}m` : `In ${diffM}m`;
              return (
                <div key={cls.id} style={{
                  display:'flex',alignItems:'center',gap:12,
                  padding:'11px 14px',borderRadius:13,
                  background: isLive ? 'rgba(239,68,68,0.08)' : T.surface,
                  border: isLive ? '1px solid rgba(239,68,68,0.28)' : `1px solid ${T.border}`,
                  transition:'all 0.15s',
                }}>
                  {/* Status dot */}
                  <div style={{
                    width:36,height:36,borderRadius:10,flexShrink:0,
                    display:'flex',alignItems:'center',justifyContent:'center',
                    background: isLive ? 'rgba(239,68,68,0.15)' : 'rgba(99,102,241,0.12)',
                  }}>
                    {isLive
                      ? <span style={{width:10,height:10,borderRadius:'50%',background:'#ef4444',boxShadow:'0 0 0 3px rgba(239,68,68,0.25)',display:'block',animation:'pulse 1.5s ease-in-out infinite'}}/>
                      : <Video size={16} color="#6366f1"/>
                    }
                  </div>
                  {/* Info */}
                  <div style={{flex:1,minWidth:0}}>
                    <p style={{fontSize:'clamp(0.72rem,1.1vw,0.8rem)',fontWeight:700,color:T.text,margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{cls.title}</p>
                    <div style={{display:'flex',alignItems:'center',gap:5,marginTop:2}}>
                      {isLive && <span style={{fontSize:9,fontWeight:800,background:'rgba(239,68,68,0.18)',color:'#ef4444',borderRadius:4,padding:'1px 5px',letterSpacing:'0.05em'}}>LIVE</span>}
                      <span style={{fontSize:10,color: isLive ? 'rgba(239,68,68,0.7)' : T.text3}}>{timeLabel}</span>
                      {cls.teacherName && <span style={{fontSize:10,color:T.text3,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>· {cls.teacherName}</span>}
                    </div>
                  </div>
                  {/* CTA */}
                  <button
                    onClick={() => navigate('/student-live-classes')}
                    style={{
                      flexShrink:0,display:'flex',alignItems:'center',gap:5,
                      padding:'6px 12px',borderRadius:8,border:'none',cursor:'pointer',
                      fontSize:11,fontWeight:700,fontFamily:"'Outfit',sans-serif",
                      background: isLive ? '#ef4444' : 'rgba(99,102,241,0.85)',
                      color:'#fff',
                      boxShadow: isLive ? '0 2px 10px rgba(239,68,68,0.35)' : '0 2px 8px rgba(99,102,241,0.3)',
                    }}
                  >
                    <Play size={10} fill="#fff"/>
                    {isLive ? 'Join Now' : 'View'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Row 1: 4-column cards */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,230px),1fr))',gap:'clamp(14px,1.8vw,22px)'}}>

        {/* Objectives */}
        <Card title="Today's Objectives" icon={<Target size={15} color="#6366f1"/>} accent="#6366f1" enterDelay={0}>
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {objectives.map(o=>(
              <div key={o.id} onClick={()=>toggleObj(o.id)}
                style={{
                  display:'flex',alignItems:'center',gap:10,
                  padding:'10px 12px',borderRadius:14,cursor:'pointer',
                  background: o.completed
                    ? (dark?'rgba(16,185,129,0.07)':'rgba(16,185,129,0.06)')
                    : T.surface,
                  border:`1px solid ${o.completed?(dark?'rgba(16,185,129,0.15)':'rgba(16,185,129,0.14)'):T.border}`,
                  transition:'all 0.20s ease',
                }}
                onMouseEnter={e=>{
                  e.currentTarget.style.background=dark?'rgba(255,255,255,0.07)':'rgba(0,0,0,0.04)';
                  e.currentTarget.style.transform='translateX(3px)';
                }}
                onMouseLeave={e=>{
                  e.currentTarget.style.background=o.completed?(dark?'rgba(16,185,129,0.07)':'rgba(16,185,129,0.06)'):T.surface;
                  e.currentTarget.style.transform='translateX(0)';
                }}
              >
                {o.completed
                  ?<CheckCircle size={18} color="#10b981" style={{flexShrink:0}}/>
                  :<Circle size={18} color={T.dimIcon} style={{flexShrink:0}}/>
                }
                <p style={{flex:1,fontSize:'clamp(0.72rem,1.08vw,0.82rem)',color:o.completed?T.text3:T.text,margin:0,textDecoration:o.completed?'line-through':'none',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{o.title}</p>
                <span style={{
                  fontSize:9,fontWeight:700,letterSpacing:'0.05em',textTransform:'uppercase',
                  padding:'3px 8px',borderRadius:99,flexShrink:0,
                  background:dark?'rgba(255,255,255,0.07)':'rgba(0,0,0,0.06)',
                  color:PC(o.priority),
                  border:`1px solid rgba(0,0,0,0.08)`,
                }}>{o.priority}</span>
              </div>
            ))}
            <button onClick={()=>setShowObjModal(true)} style={{
              display:'flex',alignItems:'center',justifyContent:'center',gap:6,
              padding:'9px 14px',borderRadius:12,marginTop:4,
              background: isLight?'rgba(99,102,241,0.07)':'rgba(99,102,241,0.10)',
              border:'1px solid rgba(99,102,241,0.20)',
              color:'#818cf8',fontSize:12,fontWeight:600,cursor:'pointer',
              fontFamily:"'Outfit',sans-serif",transition:'all 0.18s',
            }}
              onMouseEnter={e=>{e.currentTarget.style.background=isLight?'rgba(99,102,241,0.13)':'rgba(99,102,241,0.18)';e.currentTarget.style.borderColor='rgba(99,102,241,0.35)';}}
              onMouseLeave={e=>{e.currentTarget.style.background=isLight?'rgba(99,102,241,0.07)':'rgba(99,102,241,0.10)';e.currentTarget.style.borderColor='rgba(99,102,241,0.20)';}}
            >
              <Plus size={13}/> Add objective
            </button>
          </div>
        </Card>

        {/* Timer */}
        <Card title="Focus Timer" icon={<Clock size={15} color={timerMode==='focus'?'#10b981':'#f59e0b'}/>} accent={timerMode==='focus'?'#10b981':'#f59e0b'} enterDelay={90}>
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:16}}>
            <div style={{display:'flex',gap:6,width:'100%'}}>
              {(['focus','break'] as const).map(m=>(
                <button key={m} onClick={()=>{setTimerMode(m);setTimerMin(m==='focus'?25:5);setTimerSec(0);setTimerRunning(false);}} style={{flex:1,padding:'9px 0',borderRadius:10,fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:"'Outfit',sans-serif",background:timerMode===m?(m==='focus'?'rgba(16,185,129,0.18)':'rgba(245,158,11,0.18)'):T.surface,border:timerMode===m?`1px solid ${m==='focus'?'rgba(16,185,129,0.38)':'rgba(245,158,11,0.38)'}`:`1px solid ${T.border}`,color:timerMode===m?(m==='focus'?'#10b981':'#f59e0b'):T.muted}}>
                  {m==='focus'?'Focus':'Break'}
                </button>
              ))}
            </div>
            <div style={{position:'relative',width:100,height:100}}>
              <svg width="100" height="100" style={{transform:'rotate(-90deg)'}}>
                <circle cx="50" cy="50" r="42" fill="none" stroke={T.trackBg} strokeWidth="7"/>
                <circle cx="50" cy="50" r="42" fill="none" stroke={timerMode==='focus'?'#10b981':'#f59e0b'} strokeWidth="7" strokeDasharray={`${circ*timerPct} ${circ}`} strokeLinecap="round" style={{transition:'stroke-dasharray 0.9s ease'}}/>
              </svg>
              <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
                <span style={{fontSize:'clamp(1.1rem,2.5vw,1.4rem)',fontWeight:750,color:T.text,lineHeight:1}}>{String(timerMin).padStart(2,'0')}:{String(timerSec).padStart(2,'0')}</span>
                <span style={{fontSize:9,color:T.text3,textTransform:'capitalize',marginTop:2}}>{timerMode}</span>
              </div>
            </div>
            <div style={{display:'flex',gap:10}}>
              <button onClick={timerRunning?()=>setTimerRunning(false):()=>setTimerRunning(true)} style={{width:42,height:42,borderRadius:13,border:'none',cursor:'pointer',background:timerRunning?'rgba(245,158,11,0.18)':'rgba(16,185,129,0.18)',color:timerRunning?'#f59e0b':'#10b981',display:'flex',alignItems:'center',justifyContent:'center',transition:'transform 0.15s',boxShadow:timerRunning?'0 0 14px rgba(245,158,11,0.25)':'0 0 14px rgba(16,185,129,0.25)'}}>
                {timerRunning?<Pause size={17}/>:<Play size={17}/>}
              </button>
              <button onClick={()=>{setTimerRunning(false);setTimerMin(timerMode==='focus'?25:5);setTimerSec(0);}} style={{width:42,height:42,borderRadius:13,border:`1px solid ${T.ring}`,background:T.surface,color:T.muted,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
                <RotateCcw size={15}/>
              </button>
            </div>
            <p style={{fontSize:10,color:T.text3,textAlign:'center',margin:0}}>{timerMode==='focus'?'Stay focused 🎯':'Take a breath 🌿'}</p>
          </div>
        </Card>

        {/* Announcements */}
        <Card title="Latest Updates" icon={<Megaphone size={15} color="#a78bfa"/>} accent="#8b5cf6" enterDelay={180}>
          {announcementsLoading?(
            <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:8,padding:'28px 0'}}>
              <Loader size={16} color="#6366f1" className="animate-spin"/>
              <span style={{fontSize:12,color:T.text2}}>Loading…</span>
            </div>
          ):announcementsError?(
            <div style={{textAlign:'center',padding:'22px 0'}}>
              <AlertCircle size={22} color="#ef4444" style={{margin:'0 auto 5px'}}/>
              <p style={{fontSize:11,color:'rgba(239,68,68,0.8)',margin:'0 0 5px'}}>{announcementsError}</p>
              <button onClick={loadAnnouncements} style={{fontSize:11,color:'#6366f1',background:'none',border:'none',cursor:'pointer'}}>Retry</button>
            </div>
          ):announcements.length===0?(
            <div style={{textAlign:'center',padding:'24px 0'}}>
              <Megaphone size={28} color={T.dimIcon} style={{margin:'0 auto 8px'}}/>
              <p style={{fontSize:12,color:T.text3,margin:0}}>No announcements yet</p>
            </div>
          ):(
            <div style={{display:'flex',flexDirection:'column',gap:9}}>
              {announcements.slice(0,3).map(a=>(
                <div key={a.id} style={{
                  padding:'11px 13px',borderRadius:14,
                  background:T.surface,border:`1px solid ${T.border}`,
                  transition:'background 0.18s',
                }}>
                  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:5}}>
                    <div style={{
                      width:28,height:28,borderRadius:8,flexShrink:0,
                      display:'flex',alignItems:'center',justifyContent:'center',
                      background:dark?'rgba(255,255,255,0.07)':'rgba(0,0,0,0.05)',
                      border:`1px solid ${T.border}`,
                    }}>
                      <div style={{width:7,height:7,borderRadius:'50%',background:APB(a.priority)}}/>
                    </div>
                    <p style={{fontSize:'clamp(0.71rem,1.05vw,0.79rem)',fontWeight:700,color:T.text,margin:0,flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.title}</p>
                    {a.priority==='high'&&<span style={{fontSize:9,fontWeight:800,background:'rgba(239,68,68,0.12)',color:'#ef4444',borderRadius:99,padding:'2px 8px',flexShrink:0,letterSpacing:'0.05em',border:'1px solid rgba(239,68,68,0.20)'}}>URGENT</span>}
                  </div>
                  <p style={{fontSize:10,color:T.text2,margin:'0 0 3px 36px'}}>{a.teacherName} · {a.subject}</p>
                  <p style={{fontSize:11,color:T.text2,margin:'0 0 0 36px',overflow:'hidden',display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical' as any}}>{a.message}</p>
                </div>
              ))}
              {announcements.length>3&&<button style={{fontSize:11,color:'#6366f1',background:'none',border:'none',cursor:'pointer',padding:'3px 0'}}>View all {announcements.length} →</button>}
            </div>
          )}
        </Card>

        {/* Daily Quote */}
        <Card title="Daily Inspiration" icon={<Star size={15} color="#f59e0b"/>} accent="#f59e0b" enterDelay={270}>
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',textAlign:'center',gap:14}}>
            <div style={{fontSize:36}}>💡</div>
            <blockquote style={{fontSize:'clamp(0.76rem,1.15vw,0.86rem)',color:T.text2,fontStyle:'italic',lineHeight:1.65,margin:0}}>"{dailyQuote.text}"</blockquote>
            <cite style={{fontSize:12,fontWeight:700,color:'#a78bfa',fontStyle:'normal'}}>— {dailyQuote.author}</cite>
            <div style={{width:'100%',borderTop:`1px solid ${T.border}`,paddingTop:9}}>
              <button onClick={()=>setDailyQuote(getRandomQuote())} style={{display:'inline-flex',alignItems:'center',gap:5,fontSize:11,fontWeight:600,color:T.muted,background:T.surface,border:`1px solid ${T.border}`,borderRadius:20,padding:'5px 11px',cursor:'pointer',fontFamily:"'Outfit',sans-serif"}}>
                <RotateCcw size={10}/> New Quote
              </button>
            </div>
          </div>
        </Card>
      </div>

      {/* Row 2: Schedule + Goals */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,290px),1fr))',gap:'clamp(14px,1.8vw,22px)'}}>

        {/* Schedule */}
        <Card title="Weekly Schedule" subtitle="Events this week" icon={<Calendar size={15} color="#06b6d4"/>} accent="#06b6d4" enterDelay={360}>
          <div style={{display:'flex',flexDirection:'column',gap:11}}>
            <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:3}}>
              {['S','M','T','W','T','F','S'].map((d,i)=><div key={i} style={{textAlign:'center',fontSize:9,fontWeight:600,color:T.text3,padding:'2px 0'}}>{d}</div>)}
              {Array.from({length:7},(_,i)=>{
                const d=new Date(); d.setDate(d.getDate()-d.getDay()+i);
                const today=d.toDateString()===new Date().toDateString();
                const has=calendarEvents.some(e=>e.date.toDateString()===d.toDateString());
                return <div key={i} style={{position:'relative',textAlign:'center',padding:'5px 2px',borderRadius:7,fontSize:11,fontWeight:600,background:today?'rgba(99,102,241,0.32)':has?T.surface:'transparent',color:today?'white':has?T.text:T.text3,border:today?'1px solid rgba(99,102,241,0.45)':'1px solid transparent'}}>
                  {d.getDate()}
                  {has&&!today&&<div style={{position:'absolute',bottom:2,left:'50%',transform:'translateX(-50%)',width:3,height:3,borderRadius:'50%',background:'#10b981'}}/>}
                </div>;
              })}
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:5}}>
              <p style={{fontSize:10,fontWeight:700,color:T.text3,textTransform:'uppercase',letterSpacing:'0.07em',margin:0}}>Upcoming</p>
              {calendarLoading?<div style={{display:'flex',alignItems:'center',gap:5,padding:'6px 0'}}><Loader size={13} color="#6366f1" className="animate-spin"/><span style={{fontSize:11,color:T.text2}}>Loading…</span></div>
              :calendarEvents.length===0?<div style={{textAlign:'center',padding:'10px 0'}}><Calendar size={20} color={T.dimIcon} style={{margin:'0 auto 5px'}}/><p style={{fontSize:11,color:T.text3,margin:0}}>No upcoming events</p></div>
              :calendarEvents.slice(0,4).map(ev=>(
                <div key={ev.id} style={{
                  display:'flex',alignItems:'center',gap:10,
                  padding:'9px 12px',borderRadius:14,
                  background:T.surface,border:`1px solid ${T.border}`,
                  transition:'background 0.18s',
                }}>
                  <div style={{
                    width:32,height:32,borderRadius:10,flexShrink:0,
                    display:'flex',alignItems:'center',justifyContent:'center',
                    background:dark?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.04)',
                    border:`1px solid ${T.border}`,
                  }}>
                    <div style={{width:8,height:8,borderRadius:'50%',background:EDC(ev.title)}}/>
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <p style={{fontSize:'clamp(0.68rem,1.05vw,0.76rem)',fontWeight:650,color:T.text,margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{ev.title}</p>
                    <p style={{fontSize:10,color:T.text3,margin:'1px 0 0'}}>{ev.date.toLocaleDateString('en-US',{month:'short',day:'numeric'})} · {ev.startTime}</p>
                  </div>
                  <span style={{fontSize:9,fontWeight:600,color:T.muted,background:T.tagBg,borderRadius:5,padding:'2px 6px',flexShrink:0,maxWidth:65,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{ev.course}</span>
                </div>
              ))}
              <button onClick={()=>setShowEventModal(true)} style={{
                display:'flex',alignItems:'center',justifyContent:'center',gap:5,
                padding:'8px 14px',borderRadius:12,marginTop:4,
                background:isLight?'rgba(6,182,212,0.07)':'rgba(6,182,212,0.10)',
                border:'1px solid rgba(6,182,212,0.20)',
                color:'#22d3ee',fontSize:11,fontWeight:600,cursor:'pointer',
                fontFamily:"'Outfit',sans-serif",transition:'all 0.18s',
              }}
                onMouseEnter={e=>{e.currentTarget.style.background=isLight?'rgba(6,182,212,0.13)':'rgba(6,182,212,0.18)';}}
                onMouseLeave={e=>{e.currentTarget.style.background=isLight?'rgba(6,182,212,0.07)':'rgba(6,182,212,0.10)';}}
              >
                <Plus size={11}/> Add event
              </button>
            </div>
          </div>
        </Card>

        {/* Goals */}
        <Card title="My Goals" subtitle="Track your progress" icon={<Award size={15} color="#f97316"/>} accent="#f97316" enterDelay={450}>
          <div style={{display:'flex',flexDirection:'column',gap:9}}>
            {goals.map(g=>(
              <div key={g.id} style={{
                padding:'12px 14px',borderRadius:14,
                background:T.surface,
                border:`1px solid ${T.border}`,
                transition:'all 0.18s',
              }}>
                <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:7,marginBottom:7}}>
                  <div style={{flex:1,minWidth:0}}>
                    <p style={{fontSize:'clamp(0.72rem,1.1vw,0.8rem)',fontWeight:650,color:T.text,margin:'0 0 2px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{g.title}</p>
                    <p style={{fontSize:10,color:T.text2,margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{g.description}</p>
                  </div>
                  <span style={{fontSize:9,fontWeight:700,background:'rgba(99,102,241,0.14)',color:'#818cf8',border:'1px solid rgba(99,102,241,0.22)',borderRadius:5,padding:'2px 6px',flexShrink:0}}>{g.category}</span>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <div style={{flex:1,height:5,borderRadius:99,background:T.trackBg,overflow:'hidden'}}>
                    <div style={{height:'100%',width:`${g.progress}%`,borderRadius:99,background:'linear-gradient(90deg,#6366f1,#8b5cf6,#06b6d4)'}}/>
                  </div>
                  <span style={{fontSize:11,fontWeight:700,color:g.progress>70?'#10b981':g.progress>40?'#f59e0b':T.muted,flexShrink:0,minWidth:30,textAlign:'right'}}>{g.progress}%</span>
                </div>
                <p style={{fontSize:10,color:T.text3,margin:'4px 0 0'}}>Due {g.deadline.toLocaleDateString('en-US',{month:'short',day:'numeric'})}</p>
              </div>
            ))}
            <button onClick={()=>setShowGoalModal(true)} style={{
              display:'flex',alignItems:'center',justifyContent:'center',gap:5,
              padding:'9px 14px',borderRadius:12,
              background:isLight?'rgba(249,115,22,0.07)':'rgba(249,115,22,0.10)',
              border:'1px solid rgba(249,115,22,0.20)',
              color:'#fb923c',fontSize:12,fontWeight:600,cursor:'pointer',
              fontFamily:"'Outfit',sans-serif",transition:'all 0.18s',
            }}
              onMouseEnter={e=>{e.currentTarget.style.background=isLight?'rgba(249,115,22,0.13)':'rgba(249,115,22,0.18)';}}
              onMouseLeave={e=>{e.currentTarget.style.background=isLight?'rgba(249,115,22,0.07)':'rgba(249,115,22,0.10)';}}
            >
              <Plus size={11}/> Add new goal
            </button>
          </div>
        </Card>
      </div>

      {/* Row 3: Constellations */}
      <Card title="Subject Constellations" subtitle="Your knowledge map across subjects" accent="#ec4899" enterDelay={540}>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,200px),1fr))',gap:'clamp(12px,2vw,20px)'}}>
          {constellations.map(c=>(
            <div key={c.id} style={{display:'flex',flexDirection:'column',gap:8}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <div style={{display:'flex',alignItems:'center',gap:7}}>
                  <div style={{width:9,height:9,borderRadius:'50%',background:c.color,boxShadow:`0 0 7px ${c.color}`}}/>
                  <span style={{fontSize:'clamp(0.74rem,1.2vw,0.85rem)',fontWeight:700,color:T.text}}>{c.name}</span>
                </div>
                <span style={{fontSize:11,fontWeight:700,color:c.color}}>{c.overallProgress}%</span>
              </div>
              <div style={{height:3,borderRadius:2,background:T.trackBg,overflow:'hidden'}}>
                <div style={{height:'100%',width:`${c.overallProgress}%`,background:c.color,borderRadius:2}}/>
              </div>
              <div style={{position:'relative',height:130,borderRadius:10,background:T.starBg,border:`1px solid ${T.border}`,overflow:'hidden'}}>
                {Array.from({length:12}).map((_,i)=><div key={i} style={{position:'absolute',width:2,height:2,borderRadius:'50%',background:T.dimIcon,left:`${(i*41)%97}%`,top:`${(i*67)%95}%`}}/>)}
                <svg style={{position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none'}}>
                  {c.stars.map((s,i)=>i>0&&<line key={s.id} x1={`${c.stars[i-1].position.x}%`} y1={`${c.stars[i-1].position.y}%`} x2={`${s.position.x}%`} y2={`${s.position.y}%`} stroke={c.color} strokeWidth="1" opacity={s.mastered&&c.stars[i-1].mastered?0.45:0.12}/>)}
                </svg>
                {c.stars.map(s=>(
                  <div key={s.id} style={{position:'absolute',left:`${s.position.x}%`,top:`${s.position.y}%`,transform:'translate(-50%,-50%)'}} title={`${s.name} – ${s.progress}%`}>
                    <Star size={s.mastered?16:12} color={s.mastered?'#fbbf24':s.progress>50?`${c.color}88`:T.dimIcon} fill={s.mastered?'#fbbf24':'none'} style={{filter:s.mastered?'drop-shadow(0 0 4px rgba(251,191,36,0.6))':'none'}}/>
                  </div>
                ))}
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:2}}>
                {c.stars.map(s=>(
                  <div key={s.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                    <div style={{display:'flex',alignItems:'center',gap:4}}>
                      <Star size={9} color={s.mastered?'#fbbf24':T.dimIcon} fill={s.mastered?'#fbbf24':'none'}/>
                      <span style={{fontSize:10,color:s.mastered?T.text2:T.text3}}>{s.name}</span>
                    </div>
                    <span style={{fontSize:10,fontWeight:600,color:s.mastered?'#10b981':s.progress>50?'#f59e0b':T.text3}}>{s.progress}%</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Modals */}
      {showObjModal && <ObjModal onClose={()=>setShowObjModal(false)} onAdd={addObj}/>}
      {showGoalModal && <GoalModal onClose={()=>setShowGoalModal(false)} onAdd={addGoal}/>}
      {showEventModal && <StudyPlanEventModal selectedDate={selectedDate} currentUser={user} isPersonalEvent={true} onClose={()=>setShowEventModal(false)} onSave={()=>{setShowEventModal(false);loadCalendarEvents();}}/>}
    </div>
  );
};

const ObjModal = ({onClose,onAdd}:{onClose:()=>void;onAdd:(t:string,p:'high'|'medium'|'low')=>void}) => {
  const [title,setTitle]=useState(''); const [priority,setPriority]=useState<'high'|'medium'|'low'>('medium');
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.72)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999,padding:16}}>
      <div style={{background:'#0d1018',border:'1px solid rgba(255,255,255,0.1)',borderRadius:16,padding:22,width:'100%',maxWidth:380,position:'relative',fontFamily:"'Outfit',sans-serif"}}>
        <button onClick={onClose} style={{position:'absolute',top:12,right:12,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:7,width:28,height:28,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'rgba(255,255,255,0.55)'}}><X size={13}/></button>
        <h2 style={{fontSize:15,fontWeight:700,color:'rgba(255,255,255,0.9)',margin:'0 0 16px'}}>Add Objective</h2>
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          <div>
            <label style={{fontSize:10,fontWeight:700,color:'rgba(255,255,255,0.42)',display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.07em'}}>Title</label>
            <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="What do you want to achieve?" style={GI}/>
          </div>
          <div>
            <label style={{fontSize:10,fontWeight:700,color:'rgba(255,255,255,0.42)',display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.07em'}}>Priority</label>
            <div style={{display:'flex',gap:6}}>
              {(['high','medium','low'] as const).map(p=>(
                <button key={p} onClick={()=>setPriority(p)} style={{flex:1,padding:'6px 0',borderRadius:7,fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:"'Outfit',sans-serif",background:priority===p?`${PC(p)}1a`:'rgba(255,255,255,0.04)',border:priority===p?`1px solid ${PC(p)}55`:'1px solid rgba(255,255,255,0.07)',color:priority===p?PC(p):'rgba(255,255,255,0.42)'}}>
                  {p.charAt(0).toUpperCase()+p.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div style={{display:'flex',gap:8,marginTop:4}}>
            <button onClick={onClose} style={{flex:1,padding:'8px 0',borderRadius:9,border:'1px solid rgba(255,255,255,0.09)',background:'rgba(255,255,255,0.04)',color:'rgba(255,255,255,0.55)',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:"'Outfit',sans-serif"}}>Cancel</button>
            <button onClick={()=>title.trim()&&onAdd(title.trim(),priority)} style={{flex:1,padding:'8px 0',borderRadius:9,border:'none',background:'#6366f1',color:'white',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:"'Outfit',sans-serif"}}>Add</button>
          </div>
        </div>
      </div>
    </div>
  );
};

const GoalModal = ({onClose,onAdd}:{onClose:()=>void;onAdd:(t:string,d:string,c:string,dl:Date)=>void}) => {
  const [title,setTitle]=useState(''); const [desc,setDesc]=useState(''); const [cat,setCat]=useState('Academic'); const [dl,setDl]=useState('');
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.72)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999,padding:16}}>
      <div style={{background:'#0d1018',border:'1px solid rgba(255,255,255,0.1)',borderRadius:16,padding:22,width:'100%',maxWidth:400,position:'relative',fontFamily:"'Outfit',sans-serif"}}>
        <button onClick={onClose} style={{position:'absolute',top:12,right:12,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:7,width:28,height:28,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'rgba(255,255,255,0.55)'}}><X size={13}/></button>
        <h2 style={{fontSize:15,fontWeight:700,color:'rgba(255,255,255,0.9)',margin:'0 0 16px'}}>Add Goal</h2>
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          <div><label style={{fontSize:10,fontWeight:700,color:'rgba(255,255,255,0.42)',display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.07em'}}>Goal Title</label><input value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. Ace my Biology exam" style={GI}/></div>
          <div><label style={{fontSize:10,fontWeight:700,color:'rgba(255,255,255,0.42)',display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.07em'}}>Description</label><textarea value={desc} onChange={e=>setDesc(e.target.value)} placeholder="What does success look like?" rows={2} style={{...GI,resize:'none' as any}}/></div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
            <div><label style={{fontSize:10,fontWeight:700,color:'rgba(255,255,255,0.42)',display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.07em'}}>Category</label><select value={cat} onChange={e=>setCat(e.target.value)} style={GI}>{['Academic','Project','Skill','Personal','Career'].map(c=><option key={c} value={c} style={{background:'#1a1d28'}}>{c}</option>)}</select></div>
            <div><label style={{fontSize:10,fontWeight:700,color:'rgba(255,255,255,0.42)',display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.07em'}}>Deadline</label><input type="date" value={dl} onChange={e=>setDl(e.target.value)} style={{...GI,colorScheme:'dark' as any}}/></div>
          </div>
          <div style={{display:'flex',gap:8,marginTop:4}}>
            <button onClick={onClose} style={{flex:1,padding:'8px 0',borderRadius:9,border:'1px solid rgba(255,255,255,0.09)',background:'rgba(255,255,255,0.04)',color:'rgba(255,255,255,0.55)',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:"'Outfit',sans-serif"}}>Cancel</button>
            <button onClick={()=>title.trim()&&desc.trim()&&dl&&onAdd(title,desc,cat,new Date(dl))} style={{flex:1,padding:'8px 0',borderRadius:9,border:'none',background:'rgba(245,158,11,0.85)',color:'white',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:"'Outfit',sans-serif"}}>Add Goal</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentDashboard;
