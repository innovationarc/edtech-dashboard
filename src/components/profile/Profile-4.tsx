// src/components/profile/Profile-4.tsx — Student Profile v3 Matte Crystal Sparkle (Mobile Fixed)
import { useState, useEffect, useRef, useCallback } from 'react';
import { useDashboard } from '../../contexts/DashboardContext';
import {
  User, Mail, Phone, MapPin, Calendar, BookOpen,
  Edit, Lock, Printer, Loader, X, Clock, CheckCircle2,
  GraduationCap, Shield, Zap, Award, Flame,
  CheckSquare
} from 'lucide-react';
import ChangePasswordModal from './ChangePasswordModal';
import ProfileEditModal from './ProfileEditModal';
import { dashboardStatsService, KPIStats, CourseProgressItem } from '../../services/dashboardStatsService';
import { userStatsService, UserStats } from '../../services/userStatsService';
import ProfileEditModal from './ProfileEditModal';

interface Profile4Props { onClose?: () => void; }

/* ─── helpers ─── */
const hexRgb = (hex = '#6366f1') => {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)].join(',');
};

const NOISE = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

const SPARK_COLORS = ['#a5b4fc','#c4b5fd','#fbcfe8','#fde68a','#6ee7b7','rgba(255,255,255,0.9)'];

const fmtDate = (d?: Date | string) => {
  if (!d) return undefined;
  return new Date(d).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
};
const fmtDateTime = (d?: Date | string) => {
  if (!d) return undefined;
  const dt = new Date(d);
  return `${fmtDate(dt)} at ${dt.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',hour12:false})}`;
};
const gradeLabel = (g?: string) => {
  const map: Record<string,string> = {
    class6:'Class 6',class7:'Class 7',class8:'Class 8',class9:'Class 9',
    class10:'Class 10',ssc:'SSC',class11:'Class 11',class12:'Class 12',
    hsc:'HSC',diploma:'Diploma',undergraduate:'Undergraduate',graduated:'Graduated'
  };
  return g ? (map[g] || g) : undefined;
};

/* ─── Sparkle ─── */
function useSparkle() {
  return useCallback((e: React.MouseEvent<HTMLElement>) => {
    const el = e.currentTarget;
    const layer = document.createElement('div');
    layer.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:30;overflow:hidden;border-radius:inherit';
    el.style.position = 'relative';
    el.appendChild(layer);
    for (let i = 0; i < 12; i++) {
      const sp = document.createElement('div');
      const size = 2 + Math.random() * 4;
      const color = SPARK_COLORS[Math.floor(Math.random() * SPARK_COLORS.length)];
      sp.style.cssText = `
        position:absolute;border-radius:50%;
        width:${size}px;height:${size}px;
        left:${5 + Math.random()*90}%;top:${5 + Math.random()*90}%;
        background:${color};box-shadow:0 0 ${size*2}px ${color};
        animation:spPop 0.75s ${Math.random()*0.25}s ease-out forwards;
        --dx:${(Math.random()-0.5)*40}px;--dy:-${10+Math.random()*30}px;
      `;
      layer.appendChild(sp);
    }
    setTimeout(() => layer.remove(), 1100);
  }, []);
}

/* ══════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════ */
const Profile4 = ({ onClose }: Profile4Props) => {
  const { user, primaryColor = '#6366f1', theme } = useDashboard();
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [profileCompletion, setProfileCompletion] = useState(0);
  const [kpiStats, setKpiStats] = useState<KPIStats | null>(null);
  const [courseProgress, setCourseProgress] = useState<CourseProgressItem[]>([]);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const spawnSparkle = useSparkle();
  const pRgb = hexRgb(primaryColor);
  const gradient = `linear-gradient(135deg,${primaryColor},#8b5cf6)`;
  
  // Theme-aware colors
  const isLightTheme = theme === 'light';
  const cardBg = isLightTheme ? 'rgba(255,255,255,0.92)' : 'rgba(22,26,40,0.82)';
  const textPrimary = isLightTheme ? '#111827' : '#ffffff';
  const textSecondary = isLightTheme ? '#6b7280' : '#9ca3af';
  const textTertiary = isLightTheme ? '#94a3b8' : '#64748b';
  const borderColor = isLightTheme ? 'rgba(0,0,0,0.09)' : 'rgba(255,255,255,0.09)';
  const hoverBg = isLightTheme ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.03)';
  const shimmerColor = isLightTheme ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.15)';
  const bannerOverlay = isLightTheme 
    ? 'linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(139,92,246,0.1) 100%)'
    : 'linear-gradient(135deg, rgba(49,46,129,0.3) 0%, rgba(0,0,0,0.2) 100%)';
  const shadowColor = isLightTheme ? 'rgba(0,0,0,0.1)' : 'rgba(0,0,0,0.4)';
  const accentBg = isLightTheme ? `rgba(${pRgb},0.08)` : `rgba(${pRgb},0.14)`;
  const backdropBlur = isLightTheme ? 'blur(24px) saturate(160%)' : 'blur(32px) saturate(180%)';

  /* ─── Theme-aware GlassCard ─── */
  const GlassCard = ({ children, style, className='', onMouseEnter }: {
    children: React.ReactNode; style?: React.CSSProperties;
    className?: string; onMouseEnter?: React.MouseEventHandler<HTMLDivElement>;
  }) => (
    <div className={className} onMouseEnter={onMouseEnter} style={{
      position:'relative', isolation:'isolate', overflow:'hidden',
      background:cardBg,
      backdropFilter:backdropBlur, WebkitBackdropFilter:backdropBlur,
      border:`1px solid ${borderColor}`,
      boxShadow:`0 8px 40px ${shadowColor},inset 0 1px 0 ${shimmerColor}`,
      borderRadius:24, fontFamily:"'Outfit',sans-serif", ...style,
    }}>
      <div style={{ position:'absolute',top:0,left:0,right:0,height:1,borderRadius:'24px 24px 0 0',pointerEvents:'none',zIndex:20,
        background: isLightTheme 
          ? 'linear-gradient(90deg,transparent,rgba(0,0,0,0.08)30%,rgba(0,0,0,0.15)50%,rgba(0,0,0,0.08)70%,transparent)'
          : 'linear-gradient(90deg,transparent,rgba(255,255,255,0.15)30%,rgba(255,255,255,0.32)50%,rgba(255,255,255,0.15)70%,transparent)' }} />
      <div style={{ position:'absolute',inset:0,borderRadius:'inherit',pointerEvents:'none',zIndex:1,
        background:NOISE, opacity:isLightTheme ? 0.02 : 0.04, mixBlendMode:'overlay' as const }} />
      {children}
    </div>
  );

  /* ─── Theme-aware InfoRow ─── */
  const InfoRow = ({ icon:Icon, label, value, accent=accentBg }: {
    icon:React.ElementType; label:string; value?:string; accent?:string;
  }) => {
    if (!value) return null;
    return (
      <div className="info-row" style={{ display:'flex',alignItems:'flex-start',gap:10,padding:'7px 0',
        borderBottom:`1px solid ${isLightTheme ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.04)'}`, position:'relative',zIndex:4 }}>
        <div style={{ width:26,height:26,borderRadius:8,flexShrink:0,background:accent,
          display:'flex',alignItems:'center',justifyContent:'center' }}>
          <Icon size={13} color={textTertiary} />
        </div>
        <div>
          <div className="info-label" style={{ fontSize:9.5,fontWeight:700,color:textTertiary,textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:2 }}>{label}</div>
          <div className="info-value" style={{ fontSize:12.5,fontWeight:600,color:textSecondary, wordBreak:'break-word' }}>{value}</div>
        </div>
      </div>
    );
  };

  /* lock scroll */
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'unset'; };
  }, []);

  /* ESC to close */
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape' && onClose) onClose(); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [onClose]);

  /* profile completion */
  useEffect(() => {
    if (!user) return;
    const fields = [
      user.name, user.surname, user.email, user.phoneNumber,
      user.address, (user as any).dob, (user as any).gender, (user as any).bloodGroup,
      (user as any).religion, user.profilePictureUrl, user.class,
      (user as any).school, (user as any).college, (user as any).mobileNumber,
      (user as any).guardianPhone, user.classGrade,
    ];
    const pct = Math.round(fields.filter(f => f && String(f).trim()).length / fields.length * 100);
    setProfileCompletion(pct);
  }, [user]);

  /* fetch real dashboard/gamification stats */
  useEffect(() => {
    if (!user?.uid) return;
    let cancelled = false;
    setStatsLoading(true);
    Promise.allSettled([
      dashboardStatsService.getKPIStats(user.uid),
      dashboardStatsService.getCourseProgress(user.uid),
      userStatsService.getUserStats(user.uid),
    ]).then(([kpiRes, courseRes, statsRes]) => {
      if (cancelled) return;
      if (kpiRes.status === 'fulfilled') setKpiStats(kpiRes.value);
      if (courseRes.status === 'fulfilled') setCourseProgress(courseRes.value);
      if (statsRes.status === 'fulfilled') setUserStats(statsRes.value);
      setStatsLoading(false);
    });
    return () => { cancelled = true; };
  }, [user?.uid]);

  /* hover tilt for stat/info cards */
  const tilt = {
    onMouseMove: (e: React.MouseEvent<HTMLDivElement>) => {
      if (window.innerWidth <= 768) return;
      const el = e.currentTarget;
      const r = el.getBoundingClientRect();
      const rx = ((e.clientY - r.top - r.height/2) / r.height) * -10;
      const ry = ((e.clientX - r.left - r.width/2) / r.width) * 10;
      el.style.transform = `perspective(800px) rotateX(${rx}deg) rotateY(${ry}deg) translateZ(6px) scale(1.02)`;
      el.style.boxShadow = '0 20px 48px rgba(0,0,0,0.55),inset 0 1px 0 rgba(255,255,255,0.10)';
    },
    onMouseLeave: (e: React.MouseEvent<HTMLDivElement>) => {
      const el = e.currentTarget;
      el.style.transform = '';
      el.style.boxShadow = '0 4px 20px rgba(0,0,0,0.28),inset 0 1px 0 rgba(255,255,255,0.06)';
    },
  };

  if (!user) return (
    <div style={{ position:'fixed',inset:0,zIndex:50,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(10,12,20,0.97)' }}>
      <Loader size={42} className="animate-spin" color="#6366f1" />
    </div>
  );

  return (
    <>
      {/* ── Keyframes & Responsive Styles ── */}
      <style>{`
        @keyframes spPop{0%{transform:scale(0) translate(0,0);opacity:1}60%{opacity:.8}100%{transform:scale(0) translate(var(--dx),var(--dy));opacity:0}}
        @keyframes avSpin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes avPulse{0%,100%{opacity:.5;transform:scale(1)}50%{opacity:.9;transform:scale(1.1)}}
        @keyframes lvSweep{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}
        @keyframes fpRise{0%{transform:translateY(0) scale(1);opacity:.9}100%{transform:translateY(-220px) scale(.2);opacity:0}}
        @keyframes sdPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.7;transform:scale(1.2)}}
        .pv-sweep::after{content:'';position:absolute;inset:0;border-radius:inherit;
          background:linear-gradient(105deg,transparent 35%,rgba(255,255,255,0.06)50%,transparent 65%);
          transform:translateX(-100%);transition:transform .55s ease;pointer-events:none;z-index:3}
        .pv-sweep:hover::after{transform:translateX(100%)}
        .pv-btn-sweep::after{content:'';position:absolute;inset:0;border-radius:12px;
          background:linear-gradient(105deg,transparent 30%,rgba(255,255,255,0.18)50%,transparent 70%);
          animation:none;pointer-events:none}
        .pv-btn-sweep:hover::after{animation:lvSweep .5s ease forwards}
        @media print{body *{visibility:hidden}.pv-print,.pv-print *{visibility:visible}
          .pv-print{position:absolute;left:0;top:0;width:100%}.no-print{display:none!important}}
        .pv-scroll::-webkit-scrollbar{width:5px}
        .pv-scroll::-webkit-scrollbar-track{background:#0f1117}
        .pv-scroll::-webkit-scrollbar-thumb{background:#334155;border-radius:3px}

        /* MOBILE RESPONSIVE FIXES */
        @media (max-width: 768px) {
          .pv-print { padding: 0 12px 24px !important; }
          .pv-scroll { padding: 0 !important; }
          .identity-row { flex-direction: column !important; align-items: center !important; text-align: center !important; padding: 0 16px !important; }
          .identity-row .name-section { align-items: center !important; }
          .stat-grid { grid-template-columns: 1fr !important; }
          .id-chips { grid-template-columns: 1fr !important; }
          .achievements-grid { grid-template-columns: 1fr !important; }
          .info-grid { grid-template-columns: 1fr !important; }
          .subject-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .action-buttons { flex-direction: column !important; }
          .action-buttons button { width: 100% !important; justify-content: center !important; }
          .info-row { padding: 10px 0 !important; }
          .info-label { font-size: 10px !important; margin-bottom: 4px !important; }
          .info-value { font-size: 13px !important; }
          .hero-section { height: 140px !important; }
          .avatar-container { margin-top: -40px !important; }
          .avatar-wrap { width: 90px !important; height: 90px !important; }
          .avatar-inner { width: 84px !important; height: 84px !important; }
          .badges-container { justify-content: center !important; }
          .level-bar-container { max-width: 100% !important; }
        }
      `}</style>

      {/* ── Backdrop ── */}
      <div style={{ position:'fixed',inset:0,zIndex:50,background:'rgba(8,10,18,0.96)',backdropFilter:'blur(4px)' }}>
        <div style={{ position:'absolute',inset:0 }} onClick={onClose} />

        {/* ── Scroll container ── */}
        <div className="pv-scroll" onClick={e => e.stopPropagation()}
          style={{ position:'relative',height:'100%',width:'100%',display:'flex',flexDirection:'column',overflowY:'auto' }}>

          {/* Header spacer for nav */}
          <div style={{ flexShrink:0, height:72 }} />

          <div className="pv-print" style={{ maxWidth:900,margin:'0 auto',width:'100%',padding:'0 20px 40px',display:'flex',flexDirection:'column',gap:16 }}>

            {/* ══ BANNER CARD ══ */}
            <GlassCard>
              {/* Hero with starfield GIF */}
              <div className="hero-section" style={{ position:'relative',height:190,overflow:'hidden',borderRadius:'24px 24px 0 0' }}>
                {/* Starfield GIF background */}
                <div style={{
                  position:'absolute',inset:0,
                  backgroundImage:'url(/assets/starfield-banner.gif)',
                  backgroundSize:'cover',
                  backgroundPosition:'center',
                  backgroundRepeat:'no-repeat',
                }} />
                {/* Subtle overlay for better text readability */}
                <div style={{
                  position:'absolute',inset:0,
                  background:bannerOverlay,
                }} />
                {/* Top shimmer */}
                <div style={{ position:'absolute',top:0,left:0,right:0,height:2,
                  background:'linear-gradient(90deg,transparent,rgba(255,255,255,.5)35%,rgba(255,255,255,.95)50%,rgba(255,255,255,.5)65%,transparent)' }} />
                {/* Close */}
                {onClose && (
                  <button onClick={onClose} className="no-print" style={{
                    position:'absolute',top:14,right:14,zIndex:30,width:34,height:34,borderRadius:10,
                    background:'rgba(255,255,255,0.12)',backdropFilter:'blur(12px)',cursor:'pointer',
                    border:'1px solid rgba(255,255,255,0.2)',color:'rgba(255,255,255,0.85)',
                    fontSize:14,display:'flex',alignItems:'center',justifyContent:'center',
                    fontFamily:"'Outfit',sans-serif",
                  }}><X size={14} /></button>
                )}
              </div>

              {/* Identity row */}
              <div className="identity-row" style={{ padding:'0 28px',marginTop:-55,position:'relative',zIndex:5,display:'flex',alignItems:'flex-end',gap:22 }}>
                {/* Avatar */}
                <div className="avatar-container" style={{ position:'relative',flexShrink:0 }}>
                  <div style={{ position:'absolute',inset:-10,borderRadius:30,
                    background:`radial-gradient(circle,rgba(${pRgb},0.6)0%,transparent 70%)`,
                    filter:'blur(12px)',animation:'avPulse 2.8s ease-in-out infinite',zIndex:0 }} />
                  <div className="avatar-wrap" style={{ position:'absolute',inset:-4,borderRadius:26,
                    background:`conic-gradient(from 0deg,${primaryColor} 0%,#8b5cf6 33%,#a855f7 66%,${primaryColor} 100%)`,
                    animation:'avSpin 5s linear infinite',zIndex:1,filter:'blur(0.5px)' }} />
                  <div style={{ position:'absolute',inset:-2,borderRadius:24,background:'#0f1117',zIndex:2 }} />
                  <div className="avatar-inner" style={{ width:108,height:108,borderRadius:22,overflow:'hidden',position:'relative',zIndex:3,
                    border:'1px solid rgba(255,255,255,0.12)',boxShadow:'0 8px 30px rgba(0,0,0,0.45)' }}>
                    {user.profilePictureUrl ? (
                      <img loading="lazy" src={user.profilePictureUrl} alt={user.name} style={{ width:'100%',height:'100%',objectFit:'cover' }} />
                    ) : (
                      <div style={{ width:'100%',height:'100%',background:gradient,
                        display:'flex',alignItems:'center',justifyContent:'center',
                        fontSize:42,fontWeight:900,color:'#fff' }}>
                        {(user.surname?.charAt(0) || user.name?.charAt(0) || 'U').toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div style={{ position:'absolute',bottom:-5,right:-5,zIndex:10,width:28,height:28,borderRadius:8,
                    background:'linear-gradient(135deg,#f59e0b,#ef4444)',border:'2.5px solid #0f1117',
                    display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,
                    boxShadow:'0 3px 12px rgba(245,158,11,0.5)' }}>🏆</div>
                </div>

                {/* Name + badges + level */}
                <div className="name-section" style={{ paddingBottom:16,flex:1,minWidth:0 }}>
                  <div style={{ fontSize:22,fontWeight:900,color:textPrimary,letterSpacing:'-0.025em',lineHeight:1.2,marginBottom:8 }}>
                    {user.surname} {user.name}
                  </div>
                  <div className="badges-container" style={{ display:'flex',alignItems:'center',gap:7,flexWrap:'wrap',marginBottom:13 }}>
                    <span style={{ display:'inline-flex',alignItems:'center',gap:4,padding:'3px 11px',borderRadius:20,
                      fontSize:11,fontWeight:700,background:`rgba(${pRgb},0.18)`,color:isLightTheme ? primaryColor : '#a5b4fc',
                      border:`1px solid rgba(${pRgb},0.3)` }}>🎓 Student</span>
                    {gradeLabel(user.classGrade) && (
                      <span style={{ display:'inline-flex',alignItems:'center',gap:4,padding:'3px 11px',borderRadius:20,
                        fontSize:11,fontWeight:700,background:isLightTheme ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.07)',color:textTertiary,
                        border:`1px solid ${borderColor}` }}>{gradeLabel(user.classGrade)} · {user.class}</span>
                    )}
                    <span style={{ display:'inline-flex',alignItems:'center',gap:5,padding:'3px 11px',borderRadius:20,
                      fontSize:11,fontWeight:700,background:'rgba(16,185,129,0.12)',color:'#34d399',
                      border:'1px solid rgba(16,185,129,0.25)' }}>
                      <span style={{ width:6,height:6,borderRadius:'50%',background:'#10b981',display:'inline-block',animation:'sdPulse 2s infinite' }} />
                      Active
                    </span>
                  </div>
                  {/* Profile level bar */}
                  <div className="level-bar-container" style={{ display:'flex',alignItems:'center',gap:10,maxWidth:320 }}>
                    <span style={{ fontSize:10.5,fontWeight:700,color:textTertiary,whiteSpace:'nowrap' }}>Profile Level</span>
                    <div style={{ flex:1,height:7,borderRadius:4,background:isLightTheme ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.07)',overflow:'hidden',position:'relative' }}>
                      <div style={{ height:'100%',width:`${profileCompletion}%`,borderRadius:4,
                        background:`linear-gradient(90deg,${primaryColor},#8b5cf6,#a855f7)`,
                        boxShadow:`0 0 12px rgba(${pRgb},0.6)`,position:'relative',overflow:'hidden' }}>
                        <div style={{ position:'absolute',inset:0,
                          background:'linear-gradient(90deg,transparent,rgba(255,255,255,0.4),transparent)',
                          animation:'lvSweep 2.2s ease-in-out infinite' }} />
                      </div>
                    </div>
                    <span style={{ fontSize:11,fontWeight:800,color:primaryColor,whiteSpace:'nowrap' }}>{profileCompletion}%</span>
                  </div>
                </div>
              </div>

              {/* Stat cards */}
              <div className="stat-grid" style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14,padding:'20px 28px 0' }}>
                {[
                  { icon:CheckSquare, num: statsLoading ? '…' : String(kpiStats?.tasksCompleted ?? 0),
                    lbl:'Tasks Completed Today',
                    delta: statsLoading ? '' : `${((kpiStats?.weekStudyMinutes ?? 0) > 0 ? Math.round((kpiStats!.weekStudyMinutes)/60*10)/10 : 0)}h studied this week`,
                    dC:'#34d399', dB:'rgba(16,185,129,0.12)', glow:'rgba(16,185,129,0.5)', iconBg:'rgba(16,185,129,0.14)' },
                  { icon:Flame, num: statsLoading ? '…' : String(kpiStats?.streakDays ?? 0),
                    lbl:'Day Streak',
                    delta: statsLoading ? '' : `Best: ${userStats?.longestStreak ?? kpiStats?.streakDays ?? 0} days`,
                    dC:'#fbbf24', dB:'rgba(245,158,11,0.12)', glow:'rgba(245,158,11,0.45)', iconBg:'rgba(245,158,11,0.14)' },
                  { icon:Zap, num: statsLoading ? '…' : `${Math.round(((kpiStats?.todayStudyMinutes ?? 0)/60)*10)/10}h`,
                    lbl:'Study Hours Today',
                    delta: statsLoading ? '' : `${kpiStats?.todayStudyMinutes ?? 0} min today`,
                    dC:'#34d399', dB:'rgba(16,185,129,0.12)', glow:`rgba(${pRgb},0.5)`, iconBg:`rgba(${pRgb},0.14)` },
                ].map(({ icon:Icon, num, lbl, delta, dC, dB, glow, iconBg }, i) => (
                  <div key={i} className="pv-sweep" onMouseEnter={spawnSparkle} {...tilt}
                    style={{ borderRadius:18,padding:'16px 18px',position:'relative',overflow:'hidden',isolation:'isolate',cursor:'pointer',
                      background:isLightTheme ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.035)',backdropFilter:'blur(20px)',
                      border:`1px solid ${borderColor}`,
                      boxShadow:`0 4px 20px ${shadowColor},inset 0 1px 0 ${shimmerColor}`,
                      transition:'transform 0.25s cubic-bezier(0.34,1.25,0.64,1),box-shadow 0.25s ease',
                      transformStyle:'preserve-3d' as const }}>
                    <div style={{ position:'absolute',bottom:-20,right:-20,width:100,height:100,borderRadius:'50%',
                      background:glow,filter:'blur(24px)',opacity:0.35,zIndex:0 }} />
                    <div style={{ position:'relative',zIndex:4 }}>
                      <div style={{ width:38,height:38,borderRadius:11,background:iconBg,display:'flex',alignItems:'center',justifyContent:'center',marginBottom:12 }}>
                        <Icon size={17} color={textTertiary} />
                      </div>
                      <div style={{ fontSize:26,fontWeight:900,color:textPrimary,letterSpacing:'-0.03em',lineHeight:1 }}>{num}</div>
                      <div style={{ fontSize:11,fontWeight:600,color:textTertiary,marginTop:4 }}>{lbl}</div>
                      {delta && <span style={{ fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:6,marginTop:8,display:'inline-block',background:dB,color:dC }}>{delta}</span>}
                    </div>
                  </div>
                ))}
              </div>

              {/* ID chips */}
              <div className="id-chips" style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,padding:'14px 28px 0' }}>
                {[
                  { lbl:'Student ID',   val:user.userId },
                  { lbl:'Reg. Number',  val:user.registrationNumber || user.userId },
                ].map(({ lbl, val }) => (
                  <div key={lbl} style={{ padding:'13px 18px',borderRadius:15,
                    background:`rgba(${pRgb},0.07)`,border:`1px solid rgba(${pRgb},0.18)`,transition:'all 0.2s ease' }}>
                    <div style={{ fontSize:9.5,fontWeight:800,color:textTertiary,textTransform:'uppercase',letterSpacing:'0.09em',marginBottom:4 }}>{lbl}</div>
                    <div style={{ fontSize:14,fontWeight:800,color:textSecondary,letterSpacing:'0.04em',fontFamily:"'Courier New',monospace", wordBreak:'break-all' }}>{val||'—'}</div>
                  </div>
                ))}
              </div>

              {/* Action buttons */}
              <div className="action-buttons no-print" style={{ display:'flex',gap:10,padding:'14px 28px 24px',flexWrap:'wrap' }}>
                {[
                  { label:'✏️ Edit Profile', primary:true,  onClick:() => setShowEditModal(true) },
                  { label:'🔒 Password',      primary:false, onClick:() => setShowPasswordModal(true) },
                  { label:'🖨 Print Profile', primary:false, onClick:() => window.print() },
                ].map(({ label, onClick, primary }) => (
                  <button key={label} onClick={onClick} onMouseEnter={spawnSparkle}
                    className="pv-btn-sweep"
                    style={{ display:'inline-flex',alignItems:'center',gap:7,padding:'9px 20px',borderRadius:12,
                      fontSize:13,fontWeight:700,cursor:'pointer',border:'none',
                      fontFamily:"'Outfit',sans-serif",position:'relative',overflow:'hidden',
                      transition:'all 0.25s cubic-bezier(0.34,1.25,0.64,1)',
                      ...(primary
                        ? { background:gradient,color:'#fff',boxShadow:`0 4px 18px rgba(${pRgb},0.45)` }
                        : { background:hoverBg,color:textSecondary,
                            boxShadow:`0 2px 10px ${shadowColor}`,border:`1px solid ${borderColor}` }
                      ),
                    }}
                    onMouseEnter={e => {
                      const el = e.currentTarget;
                      if (primary) { el.style.transform='translateY(-3px) scale(1.05)'; el.style.boxShadow=`0 12px 30px rgba(${pRgb},0.55)`; }
                      else { el.style.transform='translateY(-2px) scale(1.04)'; el.style.background=isLightTheme ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)'; }
                    }}
                    onMouseLeave={e => {
                      const el = e.currentTarget;
                      el.style.transform='';
                      el.style.boxShadow = primary ? `0 4px 18px rgba(${pRgb},0.45)` : `0 2px 10px ${shadowColor}`;
                      if (!primary) el.style.background=hoverBg;
                    }}
                  >{label}</button>
                ))}
              </div>
            </GlassCard>

            {/* ══ ACHIEVEMENTS ══ */}
            <div className="achievements-grid" style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14 }}>
              {[
                { em:'⭐', title: statsLoading ? '…' : `${userStats?.totalPoints ?? 0} Points`, sub:'Total points earned',
                  bg:'rgba(245,158,11,0.08)', border:'rgba(245,158,11,0.22)', glow:'rgba(245,158,11,0.3)' },
                { em:'🔥', title: statsLoading ? '…' : `${userStats?.longestStreak ?? 0}-Day Streak`, sub:'Longest study streak',
                  bg:'rgba(239,68,68,0.08)', border:'rgba(239,68,68,0.20)', glow:'rgba(239,68,68,0.25)' },
                { em:'📚', title: statsLoading ? '…' : `${userStats?.coursesCompleted ?? 0} Courses`, sub:'Completed so far',
                  bg:`rgba(${pRgb},0.08)`, border:`rgba(${pRgb},0.22)`, glow:`rgba(${pRgb},0.25)` },
              ].map(({ em, title, sub, bg, border, glow }, i) => (
                <div key={i} className="pv-sweep" onMouseEnter={spawnSparkle}
                  style={{ borderRadius:18,padding:'14px 16px',position:'relative',overflow:'hidden',isolation:'isolate',cursor:'pointer',
                    background:bg,backdropFilter:'blur(24px)',border:`1px solid ${border}`,
                    boxShadow:`0 4px 20px ${shadowColor},inset 0 1px 0 ${shimmerColor}`,
                    display:'flex',alignItems:'center',gap:13,
                    transition:'transform 0.25s cubic-bezier(0.34,1.25,0.64,1),box-shadow 0.25s ease' }}
                  onMouseEnter={e => { e.currentTarget.style.transform='translateY(-5px) scale(1.03)'; e.currentTarget.style.boxShadow=`0 16px 38px ${glow}`; }}
                  onMouseLeave={e => { e.currentTarget.style.transform=''; e.currentTarget.style.boxShadow=`0 4px 20px ${shadowColor},inset 0 1px 0 ${shimmerColor}`; }}>
                  {i===0 && <div style={{ position:'absolute',bottom:-15,right:-15,width:80,height:80,borderRadius:'50%',background:'rgba(245,158,11,0.3)',filter:'blur(20px)' }} />}
                  <div style={{ fontSize:24,flexShrink:0,position:'relative',zIndex:4 }}>{em}</div>
                  <div style={{ position:'relative',zIndex:4, minWidth:0 }}>
                    <div style={{ fontSize:12.5,fontWeight:800,color:textSecondary, whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis' }}>{title}</div>
                    <div style={{ fontSize:10,color:textTertiary,fontWeight:600,marginTop:2, whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis' }}>{sub}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* ══ SEMESTER PROGRESS ══ */}
            <GlassCard style={{ padding:'20px 22px' }}>
              <div style={{ position:'absolute',top:-60,right:-60,width:200,height:200,borderRadius:'50%',
                background:`radial-gradient(circle,rgba(${pRgb},0.12)0%,transparent 70%)`,
                filter:'blur(24px)',zIndex:0 }} />
              <div style={{ position:'relative',zIndex:2 }}>
                <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16,flexWrap:'wrap',gap:8 }}>
                  <span style={{ fontSize:13.5,fontWeight:800,color:textSecondary,display:'flex',alignItems:'center',gap:8 }}>
                    <Zap size={15} color={primaryColor} /> Course Progress
                  </span>
                  <span style={{ fontSize:11,fontWeight:600,color:textTertiary }}>
                    {courseProgress.length} enrolled course{courseProgress.length === 1 ? '' : 's'}
                  </span>
                </div>
                {(() => {
                  const avgProgress = courseProgress.length
                    ? Math.round(courseProgress.reduce((s, c) => s + (c.progress || 0), 0) / courseProgress.length)
                    : 0;
                  return (
                    <>
                      <div style={{ height:10,borderRadius:6,background:isLightTheme ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.06)',overflow:'hidden',marginBottom:10 }}>
                        <div style={{ height:'100%',width:`${avgProgress}%`,borderRadius:6,
                          background:`linear-gradient(90deg,${primaryColor},#8b5cf6,#a855f7)`,
                          boxShadow:`0 0 14px rgba(${pRgb},0.5)`,position:'relative',overflow:'hidden' }}>
                          <div style={{ position:'absolute',inset:0,background:'linear-gradient(90deg,transparent,rgba(255,255,255,0.4),transparent)',animation:'lvSweep 2.5s ease-in-out infinite' }} />
                        </div>
                      </div>
                      <div style={{ display:'flex',justifyContent:'space-between',marginBottom:16 }}>
                        <span style={{ fontSize:10,fontWeight:600,color:textTertiary }}>Just Started</span>
                        <span style={{ fontSize:10,fontWeight:800,color:primaryColor }}>{avgProgress}% Complete (avg)</span>
                        <span style={{ fontSize:10,fontWeight:600,color:textTertiary }}>All Courses Done</span>
                      </div>
                    </>
                  );
                })()}
                {statsLoading ? (
                  <div style={{ fontSize:12,color:textTertiary,padding:'8px 0' }}>Loading your courses…</div>
                ) : courseProgress.length === 0 ? (
                  <div style={{ fontSize:12,color:textTertiary,padding:'8px 0' }}>You're not enrolled in any courses yet.</div>
                ) : (
                  <div className="subject-grid" style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10 }}>
                    {courseProgress.slice(0, 4).map((c) => {
                      const pct = Math.round(c.progress || 0);
                      const good = pct >= 80;
                      const mid = pct >= 50 && pct < 80;
                      const color = good ? '#34d399' : mid ? '#60a5fa' : '#fbbf24';
                      const fill = good ? '#10b981' : mid ? '#3b82f6' : '#f59e0b';
                      const bg = good ? 'rgba(16,185,129,0.10)' : mid ? 'rgba(59,130,246,0.10)' : 'rgba(245,158,11,0.10)';
                      const border = good ? 'rgba(16,185,129,0.18)' : mid ? 'rgba(59,130,246,0.18)' : 'rgba(245,158,11,0.18)';
                      return (
                        <div key={c.courseId} style={{ borderRadius:12,padding:'10px 12px',textAlign:'center',background:bg,border:`1px solid ${border}`,transition:'transform 0.2s ease' }}
                          onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-3px)'}}
                          onMouseLeave={e=>{e.currentTarget.style.transform=''}}>
                          <div style={{ fontSize:10,fontWeight:700,color:textTertiary,marginBottom:4, whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis' }} title={c.title}>{c.title}</div>
                          <div style={{ fontSize:17,fontWeight:900,color }}>{pct}%</div>
                          <div style={{ fontSize:9,fontWeight:600,color:textTertiary,marginTop:2 }}>{c.completedLessons}/{c.totalLessons} lessons</div>
                          <div style={{ height:3,borderRadius:2,background:isLightTheme ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.06)',marginTop:6,overflow:'hidden' }}>
                            <div style={{ height:'100%',width:`${pct}%`,borderRadius:2,background:fill }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </GlassCard>

            {/* ══ INFO GRID ══ */}
            <div className="info-grid" style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:14 }}>
              {[
                { title:'Personal Information', Icon:User, glow:`rgba(${pRgb},0.15)`, accent:`rgba(${pRgb},0.14)`,
                  rows:[
                    { icon:User,     label:'Surname',        value:user.surname },
                    { icon:User,     label:'Full Name',      value:user.name },
                    { icon:Mail,     label:'Email',          value:user.email },
                    { icon:Calendar, label:'Date of Birth',  value:fmtDate((user as any).dob) },
                    { icon:User,     label:'Gender',         value:(user as any).gender ? ((user as any).gender.charAt(0).toUpperCase()+(user as any).gender.slice(1)) : undefined },
                    { icon:User,     label:'Blood Group',    value:(user as any).bloodGroup },
                    { icon:Shield,   label:'Religion',       value:(user as any).religion },
                  ]},
                { title:'Contact Information', Icon:Phone, glow:'rgba(139,92,246,0.15)', accent:'rgba(139,92,246,0.14)',
                  rows:[
                    { icon:Phone,  label:'Phone Number',    value:user.phoneNumber },
                    { icon:Phone,  label:'Mobile Number',   value:(user as any).mobileNumber },
                    { icon:User,   label:'Guardian Phone',  value:(user as any).guardianPhone },
                    { icon:MapPin, label:'Address',         value:user.address },
                  ]},
                { title:'Academic Information', Icon:GraduationCap, glow:'rgba(16,185,129,0.12)', accent:'rgba(16,185,129,0.14)',
                  rows:[
                    { icon:GraduationCap, label:'Class / Grade',      value:gradeLabel(user.classGrade) },
                    { icon:BookOpen,      label:'Current Class',       value:user.class },
                    { icon:BookOpen,      label:'School',              value:(user as any).school },
                    { icon:GraduationCap, label:'College/University',  value:(user as any).college },
                    { icon:Shield,        label:'Registration Number', value:user.registrationNumber },
                  ]},
                { title:'Account Information', Icon:Shield, glow:'rgba(59,130,246,0.12)', accent:'rgba(59,130,246,0.14)',
                  rows:[
                    { icon:Shield,       label:'Account Type',    value:'Student' },
                    { icon:CheckCircle2, label:'Status',          value:user.status ? user.status.charAt(0).toUpperCase()+user.status.slice(1) : 'Active' },
                    { icon:Calendar,     label:'Member Since',    value:fmtDate(user.createdAt) },
                    { icon:Clock,        label:'Last Login',      value:fmtDateTime(user.lastLogin) },
                  ]},
              ].map(({ title, Icon:SectionIcon, glow, accent, rows }) => (
                <div key={title} className="pv-sweep" onMouseEnter={spawnSparkle}
                  style={{ borderRadius:20,padding:'18px 20px',position:'relative',overflow:'hidden',isolation:'isolate',cursor:'pointer',
                    background:isLightTheme ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.032)',backdropFilter:'blur(24px)',
                    border:`1px solid ${borderColor}`,
                    boxShadow:`0 4px 20px ${shadowColor},inset 0 1px 0 ${shimmerColor}`,
                    transition:'transform 0.25s cubic-bezier(0.34,1.25,0.64,1),box-shadow 0.25s ease,border-color 0.25s ease',
                    transformStyle:'preserve-3d' as const }}
                  onMouseEnter={e => { e.currentTarget.style.transform='translateY(-5px)'; e.currentTarget.style.boxShadow=`0 20px 48px ${isLightTheme ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.45)'},inset 0 1px 0 ${shimmerColor}`; e.currentTarget.style.borderColor=isLightTheme ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.13)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform=''; e.currentTarget.style.boxShadow=`0 4px 20px ${shadowColor},inset 0 1px 0 ${shimmerColor}`; e.currentTarget.style.borderColor=borderColor; }}>
                  {/* Corner glow */}
                  <div style={{ position:'absolute',top:-35,right:-35,width:120,height:120,borderRadius:'50%',
                    background:`radial-gradient(circle,${glow} 0%,transparent 70%)`,filter:'blur(22px)',zIndex:0 }} />
                  {/* Top shimmer */}
                  <div style={{ position:'absolute',top:0,left:0,right:0,height:1,zIndex:2,
                    background:isLightTheme 
                      ? 'linear-gradient(90deg,transparent,rgba(0,0,0,0.06)40%,rgba(0,0,0,0.12)50%,rgba(0,0,0,0.06)60%,transparent)'
                      : 'linear-gradient(90deg,transparent,rgba(255,255,255,0.10)40%,rgba(255,255,255,0.20)50%,rgba(255,255,255,0.10)60%,transparent)' }} />
                  {/* Noise */}
                  <div style={{ position:'absolute',inset:0,borderRadius:'inherit',pointerEvents:'none',zIndex:1,
                    background:NOISE,opacity:isLightTheme ? 0.02 : 0.04,mixBlendMode:'overlay' as const }} />
                  {/* Header */}
                  <div style={{ display:'flex',alignItems:'center',gap:9,marginBottom:14,position:'relative',zIndex:4 }}>
                    <div style={{ width:32,height:32,borderRadius:10,background:accent,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
                      <SectionIcon size={14} color={textTertiary} />
                    </div>
                    <span style={{ fontSize:13,fontWeight:800,color:textSecondary }}>{title}</span>
                  </div>
                  {rows.map(r => <InfoRow key={r.label} icon={r.icon} label={r.label} value={r.value} accent={accent} />)}
                </div>
              ))}
            </div>

          </div>{/* /pv-print */}
        </div>{/* /scroll */}
      </div>{/* /backdrop */}

      {showPasswordModal && (
        <ChangePasswordModal onClose={() => setShowPasswordModal(false)} onSuccess={() => setShowPasswordModal(false)} />
      )}

      {showEditModal && (
        <ProfileEditModal onClose={() => setShowEditModal(false)} onSuccess={() => setShowEditModal(false)} />
      )}
    </>
  );
};

export default Profile4;
