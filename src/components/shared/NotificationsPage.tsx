/**
 * NotificationsPage.tsx  —  iOS-style notifications
 *
 * Features:
 *   • Swipe left  → reveal "Read" (primary) + "Delete" (red) action buttons
 *   • Full swipe  → instant delete with slide-out + collapse animation
 *   • Tap card    → expand / collapse long messages
 *   • Mark all read  /  Clear all  (header buttons)
 *   • Filter tabs scrollable horizontally
 *   • One-time swipe-hint for mobile first-timers
 *   • Fully responsive — works on every screen size
 *   • Real-time Firestore subscription
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Bell, BellOff, Megaphone, BookOpen, Clock, AlertTriangle,
  Star, Cpu, Check, CheckCheck, Trash2, RefreshCw, Inbox, ChevronDown,
} from 'lucide-react';
import { useDashboard } from '../../contexts/DashboardContext';
import {
  notificationService,
  AppNotification,
  NotificationType,
} from '../../services/notificationService';
import { getUserNotificationSettings } from '../../services/settingsService';

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

const hexRgb = (hex: string) => {
  if (!hex || hex.length < 7) return '99,102,241';
  return `${parseInt(hex.slice(1,3),16)},${parseInt(hex.slice(3,5),16)},${parseInt(hex.slice(5,7),16)}`;
};

function relativeTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1)  return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7)  return `${d}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/* ─── Type config ─────────────────────────────────────────────────────────── */

interface TypeConfig { Icon: React.ElementType; color: string; bg: string; label: string }

const TYPE_CFG: Record<NotificationType, TypeConfig> = {
  announcement: { Icon: Megaphone,     color: '#6366f1', bg: 'rgba(99,102,241,0.15)',  label: 'Announcement' },
  assignment:   { Icon: BookOpen,      color: '#10b981', bg: 'rgba(16,185,129,0.15)',  label: 'Assignment'   },
  reminder:     { Icon: Clock,         color: '#f59e0b', bg: 'rgba(245,158,11,0.15)',  label: 'Reminder'     },
  urgent:       { Icon: AlertTriangle, color: '#ef4444', bg: 'rgba(239,68,68,0.15)',   label: 'Urgent'       },
  grade:        { Icon: Star,          color: '#8b5cf6', bg: 'rgba(139,92,246,0.15)',  label: 'Grade'        },
  system:       { Icon: Cpu,           color: '#64748b', bg: 'rgba(100,116,139,0.15)', label: 'System'       },
};

/* ─── Tabs ────────────────────────────────────────────────────────────────── */

type FilterTab = 'all' | 'unread' | NotificationType;

const TABS: { id: FilterTab; label: string }[] = [
  { id: 'all',          label: 'All'           },
  { id: 'unread',       label: 'Unread'        },
  { id: 'announcement', label: 'Announcements' },
  { id: 'assignment',   label: 'Assignments'   },
  { id: 'reminder',     label: 'Reminders'     },
  { id: 'urgent',       label: 'Urgent'        },
  { id: 'grade',        label: 'Grades'        },
  { id: 'system',       label: 'System'        },
];

/* ─── Skeleton ────────────────────────────────────────────────────────────── */

const Skeleton: React.FC<{ dark: boolean }> = ({ dark }) => (
  <div style={{
    padding: 16, borderRadius: 16,
    background: dark ? 'rgba(255,255,255,0.03)' : '#fff',
    border: dark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.07)',
    display: 'flex', gap: 12, alignItems: 'flex-start',
    animation: 'npulse 1.6s ease-in-out infinite',
  }}>
    <div style={{ width:44, height:44, borderRadius:14, flexShrink:0,
      background: dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)' }} />
    <div style={{ flex:1, display:'flex', flexDirection:'column', gap:8, paddingTop:2 }}>
      {[55,80,45].map((w,i) => (
        <div key={i} style={{ height: i===0?13:11, borderRadius:6, width:`${w}%`,
          background: dark ? `rgba(255,255,255,${i===0?0.07:0.05})` : `rgba(0,0,0,${i===0?0.07:0.05})` }} />
      ))}
    </div>
  </div>
);

/* ─── Empty state ─────────────────────────────────────────────────────────── */

const Empty: React.FC<{ dark: boolean; pRgb: string; filter: FilterTab }> = ({ dark, pRgb, filter }) => (
  <div style={{ display:'flex', flexDirection:'column', alignItems:'center',
    justifyContent:'center', gap:16, padding:'60px 24px', textAlign:'center' }}>
    <div style={{
      width:80, height:80, borderRadius:24,
      background: dark ? `rgba(${pRgb},0.10)` : `rgba(${pRgb},0.08)`,
      border: `1.5px solid rgba(${pRgb},0.2)`,
      display:'flex', alignItems:'center', justifyContent:'center',
    }}>
      {filter === 'unread'
        ? <BellOff size={32} color={`rgba(${pRgb},0.55)`} strokeWidth={1.5} />
        : <Inbox   size={32} color={`rgba(${pRgb},0.55)`} strokeWidth={1.5} />}
    </div>
    <div>
      <p style={{ fontSize:16, fontWeight:700, color: dark?'#e2e8f0':'#111827', margin:0 }}>
        {filter==='unread' ? "You're all caught up!" : 'No notifications yet'}
      </p>
      <p style={{ fontSize:13, color:'#64748b', margin:'8px 0 0', lineHeight:1.6, maxWidth:240 }}>
        {filter==='unread'
          ? 'All your notifications have been read.'
          : 'Notifications from your courses and teachers will show up here.'}
      </p>
    </div>
  </div>
);

/* ─── Notification card ───────────────────────────────────────────────────── */

interface CardProps {
  notif: AppNotification;
  dark: boolean;
  pRgb: string;
  onRead: (id: string) => void;
  onDelete: (id: string) => void;
  idx: number;
}

const SNAP_PX   = 160;   // px to snap open (shows both actions)
const SNAP1_PX  = 80;    // px when only Delete (already read)
const THRESH    = 50;    // minimum drag to trigger snap
const FULL_DEL  = 240;   // drag distance for full-swipe delete
const MSG_LIMIT = 120;   // chars before collapsing message

const NotifCard: React.FC<CardProps> = ({ notif, dark, pRgb, onRead, onDelete, idx }) => {
  const [expanded, setExpanded] = useState(false);
  const [tx,       setTx]       = useState(0);       // translateX of fg card
  const [snap,     setSnap]     = useState(false);   // true = use CSS transition on tx
  const [hovered,  setHovered]  = useState(false);
  const [gone,     setGone]     = useState(false);   // deletion in progress

  const touch = useRef({ x0: 0, y0: 0, dir: null as 'h'|'v'|null, active: false });

  const cfg    = TYPE_CFG[notif.type] ?? TYPE_CFG.system;
  const isLong = (notif.message ?? '').length > MSG_LIMIT;
  const snapTo = notif.isRead ? SNAP1_PX : SNAP_PX;

  /* touch */
  const onTS = (e: React.TouchEvent) => {
    touch.current = { x0: e.touches[0].clientX, y0: e.touches[0].clientY, dir: null, active: true };
    setSnap(false);
  };
  const onTM = (e: React.TouchEvent) => {
    if (!touch.current.active) return;
    const dx = e.touches[0].clientX - touch.current.x0;
    const dy = e.touches[0].clientY - touch.current.y0;
    if (!touch.current.dir) {
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5)
        touch.current.dir = Math.abs(dx) >= Math.abs(dy) ? 'h' : 'v';
    }
    if (touch.current.dir !== 'h') return;
    e.preventDefault();
    setTx(Math.min(0, Math.max(-FULL_DEL, dx)));
  };
  const onTE = () => {
    if (!touch.current.active) return;
    touch.current.active = false;
    setSnap(true);
    if (tx < -(FULL_DEL - 20)) { doDelete(); return; }
    setTx(tx < -THRESH ? -snapTo : 0);
  };

  const doDelete = () => {
    setSnap(true);
    setTx(-window.innerWidth);
    setTimeout(() => { setGone(true); setTimeout(() => onDelete(notif.id), 260); }, 180);
  };

  const handleTap = () => {
    if (tx !== 0) { setSnap(true); setTx(0); return; }
    if (isLong) setExpanded(v => !v);
  };

  return (
    /* ── height-collapse wrapper (only clips during exit) ── */
    <div style={{
      overflow: gone ? 'hidden' : 'visible',
      maxHeight: gone ? 0 : 800,
      opacity:   gone ? 0 : 1,
      marginBottom: gone ? 0 : undefined,
      transition: gone
        ? 'max-height 0.28s cubic-bezier(0.4,0,0.2,1), opacity 0.2s ease, margin 0.28s ease'
        : `opacity 0.28s ease ${idx * 28}ms`,
      animation: !gone ? `nslide 0.28s cubic-bezier(0.34,1.25,0.64,1) ${idx * 28}ms both` : 'none',
    }}>

      {/* ── swipe viewport: clips the card horizontally ── */}
      <div style={{
        position: 'relative',
        overflow: 'hidden',        /* ← the ONE place we clip */
        borderRadius: 16,
        touchAction: 'pan-y',
      }}>

        {/* background action buttons */}
        <div style={{ position:'absolute', right:0, top:0, bottom:0, display:'flex', zIndex:0 }}>
          {!notif.isRead && (
            <button onClick={e => { e.stopPropagation(); onRead(notif.id); setSnap(true); setTx(0); }}
              style={{
                width: 80, border:'none', cursor:'pointer',
                background: `rgb(${pRgb})`,
                display:'flex', flexDirection:'column',
                alignItems:'center', justifyContent:'center', gap:4,
                color:'#fff', fontFamily:"'Outfit',sans-serif",
              }}>
              <Check size={22} strokeWidth={2.5} />
              <span style={{ fontSize:11, fontWeight:700 }}>Read</span>
            </button>
          )}
          <button onClick={e => { e.stopPropagation(); doDelete(); }}
            style={{
              width: 80, border:'none', cursor:'pointer',
              background: '#ef4444',
              display:'flex', flexDirection:'column',
              alignItems:'center', justifyContent:'center', gap:4,
              color:'#fff', fontFamily:"'Outfit',sans-serif",
            }}>
            <Trash2 size={22} strokeWidth={2} />
            <span style={{ fontSize:11, fontWeight:700 }}>Delete</span>
          </button>
        </div>

        {/* foreground sliding card */}
        <div
          onTouchStart={onTS}
          onTouchMove={onTM}
          onTouchEnd={onTE}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onClick={handleTap}
          style={{
            position: 'relative', zIndex: 1,
            transform: `translateX(${tx}px)`,
            transition: snap ? 'transform 0.32s cubic-bezier(0.34,1.2,0.64,1)' : 'none',
            willChange: 'transform',
            borderRadius: 16,
            overflow: 'hidden',      /* clips accent bar + rounds corners */
            cursor: isLong ? 'pointer' : 'default',
            userSelect: 'none',
            background: dark
              ? (notif.isRead ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.05)')
              : (notif.isRead ? '#ffffff' : '#fafbff'),
            border: `1px solid ${!notif.isRead
              ? (dark ? `rgba(${pRgb},0.22)` : `rgba(${pRgb},0.16)`)
              : (dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)')}`,
            boxShadow: (!notif.isRead && !dark) ? `0 2px 14px rgba(${pRgb},0.07)` : 'none',
          }}
        >
          {/* unread accent bar */}
          {!notif.isRead && (
            <span style={{
              position:'absolute', left:0, top:0, bottom:0,
              width:3, zIndex:1,
              background: cfg.color,
              boxShadow: `0 0 10px ${cfg.color}44`,
            }} />
          )}

          {/* content row */}
          <div style={{ display:'flex', gap:12, alignItems:'flex-start', padding:'14px 14px 12px 16px' }}>

            {/* icon */}
            <div style={{
              width:42, height:42, borderRadius:13, flexShrink:0,
              background: cfg.bg,
              display:'flex', alignItems:'center', justifyContent:'center',
              border: `1.5px solid ${cfg.color}28`, marginTop:1,
            }}>
              <cfg.Icon size={19} color={cfg.color} strokeWidth={2} />
            </div>

            {/* text */}
            <div style={{ flex:1, minWidth:0 }}>

              {/* title + timestamp */}
              <div style={{ display:'flex', alignItems:'flex-start', gap:6 }}>
                <p style={{
                  fontSize:13.5, fontWeight: notif.isRead?500:700,
                  margin:0, lineHeight:1.45, flex:1, minWidth:0,
                  color: dark ? (notif.isRead?'#94a3b8':'#f1f5f9') : (notif.isRead?'#6b7280':'#111827'),
                  wordBreak:'break-word', overflowWrap:'anywhere',
                }}>
                  {notif.title}
                </p>
                <div style={{ display:'flex', alignItems:'center', gap:3, flexShrink:0, marginTop:2 }}>
                  <span style={{ fontSize:11, color:'#94a3b8', fontWeight:500, whiteSpace:'nowrap' }}>
                    {relativeTime(notif.createdAt)}
                  </span>
                  {isLong && (
                    <ChevronDown size={12} color="#94a3b8" style={{
                      transition:'transform 0.2s',
                      transform: expanded ? 'rotate(180deg)' : 'none',
                      flexShrink:0,
                    }} />
                  )}
                </div>
              </div>

              {/* message */}
              {notif.message && (
                <p style={{
                  fontSize:13, color: dark?'#64748b':'#6b7280',
                  margin:'5px 0 0', lineHeight:1.65,
                  wordBreak:'break-word', overflowWrap:'anywhere',
                  ...(isLong && !expanded ? {
                    display:'-webkit-box',
                    WebkitLineClamp:2,
                    WebkitBoxOrient:'vertical' as const,
                    overflow:'hidden',
                  } : {}),
                }}>
                  {notif.message}
                </p>
              )}

              {/* chips */}
              <div style={{ display:'flex', alignItems:'center', flexWrap:'wrap', gap:5, marginTop:8 }}>
                <span style={{
                  fontSize:11, fontWeight:600, color:cfg.color,
                  background:cfg.bg, padding:'3px 9px', borderRadius:99,
                  border:`1px solid ${cfg.color}28`, whiteSpace:'nowrap',
                }}>{cfg.label}</span>
                {notif.metadata?.teacherName && (
                  <span style={{ fontSize:11, color:'#94a3b8', fontWeight:500, whiteSpace:'nowrap' }}>
                    {notif.metadata.teacherName as string}
                  </span>
                )}
                {notif.metadata?.courseName && (
                  <span style={{
                    fontSize:11, color:'#94a3b8', fontWeight:500,
                    maxWidth:130, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                  }}>· {notif.metadata.courseName as string}</span>
                )}
                {notif.priority === 'high' && (
                  <span style={{
                    fontSize:11, fontWeight:700, color:'#ef4444',
                    background:'rgba(239,68,68,0.1)', padding:'3px 9px', borderRadius:99,
                    border:'1px solid rgba(239,68,68,0.2)', whiteSpace:'nowrap',
                  }}>High priority</span>
                )}
              </div>
            </div>

            {/* desktop hover actions — hidden on touch via CSS */}
            <div className="notif-dsk"
              style={{
                display:'flex', flexDirection:'column', gap:4, flexShrink:0,
                opacity: hovered?1:0, transition:'opacity 0.15s',
                pointerEvents: hovered?'auto':'none',
              }}
            >
              {!notif.isRead && (
                <button onClick={e => { e.stopPropagation(); onRead(notif.id); }} title="Mark as read"
                  style={{
                    width:32, height:32, borderRadius:10, cursor:'pointer',
                    background: dark?`rgba(${pRgb},0.12)`:`rgba(${pRgb},0.08)`,
                    border:`1px solid rgba(${pRgb},0.2)`,
                    display:'flex', alignItems:'center', justifyContent:'center',
                  }}>
                  <Check size={14} color={`rgb(${pRgb})`} />
                </button>
              )}
              <button onClick={e => { e.stopPropagation(); doDelete(); }} title="Delete"
                style={{
                  width:32, height:32, borderRadius:10, cursor:'pointer',
                  background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.18)',
                  display:'flex', alignItems:'center', justifyContent:'center',
                }}>
                <Trash2 size={14} color="#ef4444" />
              </button>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

/* ─── Confirm bottom-sheet ───────────────────────────────────────────────── */

const ConfirmSheet: React.FC<{
  dark: boolean;
  title: string; body: string;
  confirmLabel: string; confirmColor: string;
  onOk: () => void; onCancel: () => void;
}> = ({ dark, title, body, confirmLabel, confirmColor, onOk, onCancel }) => (
  <div onClick={onCancel} style={{
    position:'fixed', inset:0, zIndex:400,
    display:'flex', alignItems:'flex-end', justifyContent:'center',
    background:'rgba(0,0,0,0.5)', backdropFilter:'blur(6px)',
  }}>
    <div onClick={e => e.stopPropagation()} style={{
      background: dark?'#13161f':'#fff',
      border:`1px solid ${dark?'rgba(255,255,255,0.09)':'rgba(0,0,0,0.08)'}`,
      borderRadius:'24px 24px 0 0',
      padding:'20px 24px 44px',
      width:'100%', maxWidth:520,
      boxShadow:'0 -16px 48px rgba(0,0,0,0.25)',
      animation:'nsheet 0.28s cubic-bezier(0.34,1.15,0.64,1)',
      boxSizing:'border-box' as any,
    }}>
      <div style={{ width:36, height:4, borderRadius:2,
        background: dark?'rgba(255,255,255,0.15)':'rgba(0,0,0,0.15)',
        margin:'0 auto 20px' }} />
      <div style={{
        width:52, height:52, borderRadius:16,
        background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)',
        display:'flex', alignItems:'center', justifyContent:'center', marginBottom:16,
      }}>
        <Trash2 size={24} color="#ef4444" />
      </div>
      <p style={{ fontSize:17, fontWeight:700, color:dark?'#f1f5f9':'#111827', margin:'0 0 8px' }}>{title}</p>
      <p style={{ fontSize:14, color:'#64748b', margin:'0 0 24px', lineHeight:1.6 }}>{body}</p>
      <div style={{ display:'flex', gap:10 }}>
        <button onClick={onCancel} style={{
          flex:1, height:50, borderRadius:14, cursor:'pointer', fontSize:15, fontWeight:600,
          fontFamily:"'Outfit',sans-serif",
          background: dark?'rgba(255,255,255,0.07)':'#f1f5f9',
          border: dark?'1px solid rgba(255,255,255,0.09)':'1px solid rgba(0,0,0,0.09)',
          color: dark?'#94a3b8':'#6b7280',
        }}>Cancel</button>
        <button onClick={onOk} style={{
          flex:1, height:50, borderRadius:14, cursor:'pointer', fontSize:15, fontWeight:700,
          fontFamily:"'Outfit',sans-serif", border:'none',
          background: confirmColor, color:'#fff',
          boxShadow:`0 4px 16px ${confirmColor}55`,
        }}>{confirmLabel}</button>
      </div>
    </div>
  </div>
);

/* ─── Main page ───────────────────────────────────────────────────────────── */

const NotificationsPage: React.FC = () => {
  const { user, isAuthenticated, theme, primaryColor, accentColor } = useDashboard();

  const dark     = theme !== 'light';
  const pRgb     = hexRgb(primaryColor);
  const gradient = `linear-gradient(135deg,${primaryColor} 0%,${accentColor??primaryColor} 100%)`;

  const [notifs,       setNotifs]       = useState<AppNotification[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [syncing,      setSyncing]      = useState(false);
  const [tab,          setTab]          = useState<FilterTab>('all');
  const [clearDlg,     setClearDlg]     = useState(false);
  const [hint,         setHint]         = useState(false);
  const [prefs,        setPrefs]        = useState<Record<string,boolean>>({});
  const [isMobile,     setIsMobile]     = useState(window.innerWidth < 768);
  const hintDone = useRef(false);

  /* tab scrolling */
  const tabsRef = useRef<HTMLDivElement>(null);
  const tabDrag = useRef({ x0:0, sl:0, on:false });
  const onTabTS = (e: React.TouchEvent) => {
    const el = tabsRef.current; if (!el) return;
    tabDrag.current = { x0: e.touches[0].pageX, sl: el.scrollLeft, on: true };
  };
  const onTabTM = (e: React.TouchEvent) => {
    if (!tabDrag.current.on || !tabsRef.current) return;
    tabsRef.current.scrollLeft = tabDrag.current.sl + (tabDrag.current.x0 - e.touches[0].pageX);
  };
  const onTabTE = () => { tabDrag.current.on = false; };

  useEffect(() => {
    const el = tabsRef.current; if (!el) return;
    const btn = el.querySelector('[data-active="true"]') as HTMLElement|null;
    btn?.scrollIntoView({ behavior:'smooth', block:'nearest', inline:'center' });
  }, [tab]);

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  /* swipe hint: show once on first load with notifications */
  useEffect(() => {
    if (isMobile && !loading && !hintDone.current && notifs.length > 0) {
      hintDone.current = true; setHint(true);
      const t = setTimeout(() => setHint(false), 5000);
      return () => clearTimeout(t);
    }
  }, [isMobile, loading, notifs.length]);

  /* subscribe */
  useEffect(() => {
    if (!isAuthenticated || !user?.uid) return;
    setLoading(true);
    const t = setTimeout(() => setLoading(false), 3000);
    const unsub = notificationService.subscribeToNotifications(
      user.uid,
      ns => { clearTimeout(t); setNotifs(ns); setLoading(false); },
      ()  => { clearTimeout(t); setLoading(false); },
    );
    return () => { clearTimeout(t); unsub(); };
  }, [isAuthenticated, user?.uid]);

  /* sync + prefs */
  useEffect(() => {
    if (!isAuthenticated || !user?.uid) return;
    (async () => {
      setSyncing(true);
      await notificationService.syncAnnouncementsAsNotifications(
        user.uid, user.role??'student', (user as any).enrolledCourseIds??[],
      );
      notificationService.purgeTransient(user.uid);
      setSyncing(false);
    })();
    getUserNotificationSettings(user.uid)
      .then(p => { if (p) setPrefs(p as any); })
      .catch(() => {});
  }, [isAuthenticated, user?.uid]);

  useEffect(() => { window.scrollTo({ top:0, behavior:'smooth' }); }, []);

  /* handlers */
  const doRead    = useCallback(async (id: string) => { await notificationService.markAsRead(id); }, []);
  const doReadAll = useCallback(async () => { if (user?.uid) await notificationService.markAllAsRead(user.uid); }, [user?.uid]);
  const doDelete  = useCallback(async (id: string) => { await notificationService.deleteNotification(id); }, []);
  const doClear   = useCallback(async () => {
    if (!user?.uid) return;
    setClearDlg(false);
    await notificationService.clearAllNotifications(user.uid);
  }, [user?.uid]);

  const muted = useCallback((n: AppNotification) => {
    const rt = (n.metadata?.relatedType as string) ?? n.relatedType ?? '';
    if (rt==='announcement'     && prefs.notifyAnnouncements       ===false) return true;
    if (rt==='courseEnrollment' && prefs.notifyCourseEnrollment    ===false) return true;
    if (rt==='qa'               && prefs.notifyQaAnswers           ===false) return true;
    if (rt==='taskGroup'        && prefs.notifyTaskAssigned        ===false) return true;
    if (rt==='task'             && prefs.notifyTaskEvaluation      ===false) return true;
    if (rt==='exam'             && prefs.notifyExamResults         ===false) return true;
    if (['studyGoal','studySchedule','streakFreeze'].includes(rt) && prefs.notifyStudyPlan===false) return true;
    if (['earlyAccess','featureRequest'].includes(rt) && prefs.notifyEarlyAccess===false) return true;
    if (rt==='comingSoon' && prefs.notifyNewComingSoonFeatures===false) return true;
    return false;
  }, [prefs]);

  const filtered = useMemo(() => notifs.filter(n => {
    if (muted(n)) return false;
    if (tab==='all')    return true;
    if (tab==='unread') return !n.isRead;
    return n.type === tab;
  }), [notifs, tab, muted]);

  const unread = useMemo(() => notifs.filter(n => !n.isRead).length, [notifs]);

  /*
   * Layout note:
   * DashboardLayout wraps content in Tailwind p-3 (12 px) on mobile.
   * We break out of that padding with negative margins so cards span full width.
   * Each section that needs inset re-applies padding manually.
   */
  const PAD = isMobile ? 12 : 0;

  return (
    <div style={{
      fontFamily: "'Outfit',sans-serif",
      paddingBottom: isMobile ? 100 : 40,
      display: 'flex', flexDirection: 'column', gap: 12,
      marginLeft:  -PAD,
      marginRight: -PAD,
      width: `calc(100% + ${PAD*2}px)`,
      boxSizing: 'border-box' as any,
    }}>

      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{
        display:'flex', alignItems:'center', justifyContent:'space-between',
        gap:8, flexWrap:'wrap',
        padding: isMobile ? `0 ${PAD}px` : '0',
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, minWidth:0 }}>
          <div style={{
            width: isMobile?36:40, height: isMobile?36:40,
            borderRadius:12, background:gradient, flexShrink:0,
            display:'flex', alignItems:'center', justifyContent:'center',
            boxShadow:`0 4px 14px rgba(${pRgb},0.35)`,
          }}>
            <Bell size={isMobile?16:18} color="#fff" strokeWidth={2.5} />
          </div>
          <div style={{ minWidth:0 }}>
            <h1 style={{
              fontSize: isMobile?18:21, fontWeight:800,
              color: dark?'#f1f5f9':'#111827',
              margin:0, lineHeight:1.2,
            }}>Notifications</h1>
            <p style={{ color:'#64748b', margin:0, fontSize:11.5,
              display:'flex', alignItems:'center', gap:4 }}>
              {syncing
                ? <><RefreshCw size={10} style={{ animation:'nspin 1.2s linear infinite' }}/> Syncing…</>
                : unread>0 ? `${unread} unread` : 'All caught up ✓'}
            </p>
          </div>
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
          {unread > 0 && (
            <button onClick={doReadAll} style={{
              height:36, padding:'0 10px', borderRadius:10, cursor:'pointer',
              background: dark?`rgba(${pRgb},0.14)`:`rgba(${pRgb},0.09)`,
              border:`1px solid rgba(${pRgb},0.25)`,
              display:'flex', alignItems:'center', gap:5,
              color:`rgb(${pRgb})`, fontSize:12, fontWeight:700,
              fontFamily:"'Outfit',sans-serif", whiteSpace:'nowrap' as any,
            }}>
              <CheckCheck size={13} />
              {isMobile ? 'Read all' : 'Mark all read'}
            </button>
          )}
          {notifs.length > 0 && (
            <button onClick={() => setClearDlg(true)} style={{
              height:36, padding:'0 10px', borderRadius:10, cursor:'pointer',
              background:'rgba(239,68,68,0.09)', border:'1px solid rgba(239,68,68,0.22)',
              display:'flex', alignItems:'center', gap:5,
              color:'#ef4444', fontSize:12, fontWeight:700,
              fontFamily:"'Outfit',sans-serif", whiteSpace:'nowrap' as any,
            }}>
              <Trash2 size={13} />
              {isMobile ? 'Clear' : 'Clear all'}
            </button>
          )}
        </div>
      </div>

      {/* ── Filter tabs ─────────────────────────────────────── */}
      <div style={{
        borderRadius: isMobile?0:14,
        background: dark?'rgba(255,255,255,0.03)':'rgba(0,0,0,0.03)',
        border:`1px solid ${dark?'rgba(255,255,255,0.07)':'rgba(0,0,0,0.07)'}`,
        padding: isMobile ? `7px ${PAD}px` : '7px 10px',
      }}>
        <div ref={tabsRef} className="np-tabs"
          onTouchStart={onTabTS} onTouchMove={onTabTM} onTouchEnd={onTabTE}
          style={{ display:'flex', gap:5, overflowX:'auto',
            WebkitOverflowScrolling:'touch', scrollBehavior:'smooth',
            userSelect:'none' as any }}>
          {TABS.map(t => {
            const active = tab === t.id;
            const count =
              t.id==='unread' ? unread
              : t.id==='all'  ? notifs.filter(n=>!muted(n)).length
              : notifs.filter(n=>!muted(n)&&n.type===t.id).length;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                data-active={active?'true':'false'}
                style={{
                  height:32, padding:'0 11px', borderRadius:99, flexShrink:0,
                  background: active
                    ? (dark?`rgba(${pRgb},0.22)`:`rgba(${pRgb},0.12)`)
                    : 'transparent',
                  border: active
                    ? `1px solid rgba(${pRgb},0.35)` : '1px solid transparent',
                  color: active ? `rgb(${pRgb})` : dark?'#64748b':'#6b7280',
                  fontSize:12, fontWeight: active?700:500,
                  fontFamily:"'Outfit',sans-serif",
                  cursor:'pointer', transition:'all 0.18s ease',
                  display:'flex', alignItems:'center', gap:5,
                  whiteSpace:'nowrap' as any,
                }}>
                {t.label}
                {count > 0 && (
                  <span style={{
                    fontSize:10, fontWeight:700, padding:'1px 6px',
                    borderRadius:99, lineHeight:'16px',
                    background: active ? `rgb(${pRgb})` : dark?'rgba(255,255,255,0.13)':'rgba(0,0,0,0.1)',
                    color: active?'#fff': dark?'#94a3b8':'#6b7280',
                  }}>
                    {count>99?'99+':count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Swipe hint ──────────────────────────────────────── */}
      {hint && (
        <div onClick={() => setHint(false)} style={{
          margin: isMobile ? `0 ${PAD}px` : '0',
          display:'flex', alignItems:'center', gap:10,
          padding:'10px 14px', borderRadius:12, cursor:'pointer',
          background: dark?'rgba(255,255,255,0.05)':'rgba(0,0,0,0.04)',
          border: dark?'1px solid rgba(255,255,255,0.07)':'1px solid rgba(0,0,0,0.07)',
          animation:'nslide 0.3s ease both',
        }}>
          <span style={{ fontSize:18 }}>👈</span>
          <span style={{ fontSize:12, color:'#64748b', fontWeight:500, flex:1 }}>
            Swipe left on a notification to mark read or delete
          </span>
          <span style={{ fontSize:11, color:'#94a3b8', fontWeight:600 }}>Got it</span>
        </div>
      )}

      {/* ── List ─────────────────────────────────────────────── */}
      <div>
        {loading ? (
          <div style={{ display:'flex', flexDirection:'column', gap:8,
            padding: isMobile ? `0 ${PAD}px` : '0' }}>
            {[0,1,2,3].map(i => <Skeleton key={i} dark={dark} />)}
          </div>
        ) : filtered.length === 0 ? (
          <Empty dark={dark} pRgb={pRgb} filter={tab} />
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {filtered.map((n,i) => (
              <NotifCard
                key={n.id} notif={n} dark={dark} pRgb={pRgb}
                onRead={doRead} onDelete={doDelete} idx={i}
              />
            ))}
            {filtered.length >= 10 && (
              <p style={{ textAlign:'center', padding:'12px 0 4px',
                fontSize:12, color:'#64748b', fontWeight:500 }}>
                — {filtered.length} notifications —
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── Clear confirm ────────────────────────────────────── */}
      {clearDlg && (
        <ConfirmSheet
          dark={dark}
          title="Clear all notifications?"
          body="This will permanently delete all your notifications. This cannot be undone."
          confirmLabel="Clear all" confirmColor="#ef4444"
          onOk={doClear} onCancel={() => setClearDlg(false)}
        />
      )}

      <style>{`
        @keyframes nslide {
          from { opacity:0; transform:translateY(10px) scale(0.97); }
          to   { opacity:1; transform:translateY(0)    scale(1);    }
        }
        @keyframes npulse {
          0%,100% { opacity:1; }
          50%      { opacity:0.4; }
        }
        @keyframes nspin {
          to { transform:rotate(360deg); }
        }
        @keyframes nsheet {
          from { transform:translateY(100%); }
          to   { transform:translateY(0);    }
        }
        .np-tabs::-webkit-scrollbar { display:none; }
        .np-tabs { -ms-overflow-style:none; scrollbar-width:none; }
        /* Hide desktop hover buttons on touchscreen devices */
        @media (hover:none) and (pointer:coarse) {
          .notif-dsk { display:none !important; }
        }
      `}</style>
    </div>
  );
};

export default NotificationsPage;
