/* Navigation.tsx 
   — Solid frosted header (never transparent) — no overlap
   — Auto-hide sidebar: collapsed (64px icons) on desktop, expands on hover
   — Mobile: slide-in drawer + fixed top bar
   — Fluid spring animations throughout
*/
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell, Search, LogOut, X,
  LayoutDashboard, Users, Upload, Calendar, Medal, BarChart3, Settings, Clock,
  CreditCard, Library, GraduationCap, BookOpen, ShoppingCart, Trophy,
  Ticket, PlusCircle, Megaphone, FileText, MessageSquare, Sun, Moon, Loader2,
  ClipboardCheck, UserCheck, ListOrdered, Plus, ChevronRight,
  BrainCircuit, LayoutGrid, Bot, Video, Radio,
} from 'lucide-react';
import { useDashboard } from '../../contexts/DashboardContext';
import Profile from '../profile/Profile';
import HamburgerMenuIcon from '../ui/HamburgerMenuIcon';
import { notificationService } from '../../services/notificationService';

const hexRgb = (hex: string) => {
  if (!hex || hex.length < 7) return '99,102,241';
  return `${parseInt(hex.slice(1,3),16)},${parseInt(hex.slice(3,5),16)},${parseInt(hex.slice(5,7),16)}`;
};

/* ── NavItem ── */
interface NavItemProps {
  path: string; name: string; Icon: React.ElementType;
  isActive: boolean; expanded: boolean; darkMode: boolean;
  pRgb: string; gradient: string;
  onClick: () => void;
}
const NavItem: React.FC<NavItemProps> = ({
  path, name, Icon, isActive, expanded, darkMode, pRgb, gradient, onClick,
}) => {
  const [hov, setHov] = useState(false);
  return (
    <Link
      to={path} onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      title={!expanded ? name : undefined}
      style={{
        display: 'flex', alignItems: 'center',
        gap: expanded ? 10 : 0,
        padding: expanded ? '8px 10px' : '8px',
        borderRadius: 12,
        textDecoration: 'none',
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        transition: 'all 0.22s cubic-bezier(0.34,1.25,0.64,1)',
        background: isActive
          ? darkMode ? `rgba(${pRgb},0.18)` : `rgba(${pRgb},0.12)`
          : hov
            ? darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)'
            : 'transparent',
        border: isActive
          ? `1px solid rgba(${pRgb},0.25)`
          : hov ? `1px solid ${darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` : '1px solid transparent',
        transform: hov && !isActive ? 'translateX(2px)' : 'none',
        justifyContent: expanded ? 'flex-start' : 'center',
      }}
    >
      <span style={{
        width: 32, height: 32, borderRadius: 10, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: isActive ? gradient : hov
          ? darkMode ? `rgba(${pRgb},0.18)` : `rgba(${pRgb},0.12)`
          : darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
        boxShadow: isActive ? `0 3px 10px rgba(${pRgb},0.35)` : 'none',
        transition: 'all 0.2s ease',
      }}>
        <Icon size={15} strokeWidth={isActive ? 2.5 : 2} style={{
          color: isActive ? '#fff' : hov ? `rgb(${pRgb})` : darkMode ? '#64748b' : '#6b7280',
          transition: 'color 0.15s ease',
        }} />
      </span>
      {expanded && (
        <>
          <span style={{
            fontSize: 13, fontWeight: isActive ? 700 : hov ? 600 : 500, flex: 1,
            color: isActive ? `rgb(${pRgb})` : hov ? (darkMode ? '#e2e8f0' : '#1f2937') : (darkMode ? '#94a3b8' : '#6b7280'),
            transition: 'color 0.15s ease',
            opacity: expanded ? 1 : 0,
          }}>
            {name}
          </span>
          {isActive && <ChevronRight size={12} style={{ color: `rgba(${pRgb},0.5)`, flexShrink: 0 }} />}
        </>
      )}
    </Link>
  );
};

/* ════ NAVIGATION ════ */
const Navigation = () => {
  const {
    sidebarOpen, toggleSidebarClick,
    handleSearch, handleSignOut,
    isAuthenticated, user,
    theme, setTheme,
    primaryColor, accentColor,
    glitterTheme,
  } = useDashboard();

  const location = useLocation();
  const navigate = useNavigate();
  const [showProfile, setShowProfile] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [islandActive, setIslandActive] = useState(false);
  const [islandExpanded, setIslandExpanded] = useState(false);
  const [islandFullExpand, setIslandFullExpand] = useState(false);
  const [islandPillRadius, setIslandPillRadius] = useState(false);
  const [islandNotif, setIslandNotif] = useState<{ message: string; type: 'success'|'info'|'warning'|'error' } | null>(null);
  const islandTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const islandAllTimeouts = useRef<ReturnType<typeof setTimeout>[]>([]);
  const fullExpandTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const islandRef = useRef<HTMLDivElement>(null);

  /* Desktop sidebar: collapsed by default, expands on hover */
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const sidebarHoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSidebarMouseEnter = () => {
    if (sidebarHoverTimeout.current) clearTimeout(sidebarHoverTimeout.current);
    setSidebarExpanded(true);
  };
  const handleSidebarMouseLeave = () => {
    sidebarHoverTimeout.current = setTimeout(() => setSidebarExpanded(false), 120);
  };

  const darkMode = theme !== 'light';
  const pRgb = hexRgb(primaryColor);
  const gradient = `linear-gradient(135deg,${primaryColor} 0%,${accentColor} 100%)`;
  const SIDEBAR_W = sidebarExpanded ? 220 : 64;

  const NAV_ALL = [
    { name:'Dashboard',     Icon:LayoutDashboard, path:'/dashboard',          roles:['admin'] },
    { name:'Dashboard',     Icon:GraduationCap,   path:'/student-dashboard',  roles:['student'] },
    { name:'Dashboard',     Icon:BookOpen,        path:'/teacher-dashboard',  roles:['teacher'] },
    { name:'Users',         Icon:Users,           path:'/users',              roles:['admin'] },
    { name:'Announcements', Icon:Megaphone,       path:'/announcements',      roles:['admin'] },
    { name:'Payments',      Icon:CreditCard,      path:'/payments',           roles:['admin'] },
    { name:'Analytics',     Icon:BarChart3,       path:'/analytics',          roles:['admin'] },
    { name:'AI Settings',   Icon:BrainCircuit,    path:'/ai-settings',        roles:['admin'] },
    { name:'Content',       Icon:Upload,          path:'/content',            roles:['admin','teacher'] },
    { name:'Course Mgmt',   Icon:PlusCircle,      path:'/course-creation',    roles:['admin','teacher'] },
    { name:'Course Assign', Icon:UserCheck,       path:'/course-assignment',  roles:['admin'] },
    { name:'Coupons',       Icon:Ticket,          path:'/manage-coupon',      roles:['admin','manager'] },
    { name:'Study Plans',   Icon:Calendar,        path:'/study-plan',         roles:['admin','teacher'] },
    { name:'Progress',      Icon:Medal,           path:'/progress',           roles:['student'] },
    { name:'Leaderboard',   Icon:ListOrdered,     path:'/leaderboard',        roles:['admin','manager','teacher','coordinator','student_manager','course_manager'] },
    { name:'Evaluate Exam', Icon:ClipboardCheck,  path:'/exam-evaluation',    roles:['admin','teacher'] },
    { name:'Live Classes',  Icon:Video,           path:'/live-classes',       roles:['admin','teacher'] },
    { name:'Live Settings', Icon:Video,           path:'/live-class-settings',roles:['admin'] },
    { name:'Live Streams',  Icon:Radio,           path:'/streams',            roles:['admin','teacher'] },
    { name:'Stream Settings',Icon:Radio,          path:'/stream-settings',    roles:['admin'] },
    { name:'Questions',     Icon:MessageSquare,   path:'/teacher-qa',         roles:['teacher'] },
    { name:'Tasks',         Icon:FileText,        path:'/teacher-tasks',      roles:['teacher'] },
    { name:'Library',       Icon:Library,         path:'/content-library',    roles:['admin','teacher','student'] },
    { name:'Courses',       Icon:ShoppingCart,    path:'/course-enrollment',  roles:['admin','teacher','student'] },
    { name:'Ask Question',  Icon:MessageSquare,   path:'/student-qa',         roles:['student'] },
    { name:'Achievements',  Icon:Trophy,          path:'/achievements',       roles:['admin','teacher','student'] },
    { name:'My Tasks',      Icon:FileText,        path:'/student-tasks',      roles:['student'] },
    { name:'My Study Plan', Icon:Calendar,        path:'/student-study-plan', roles:['student'] },
    { name:'Coming Soon Mgmt', Icon:LayoutGrid,   path:'/coming-soon-management', roles:['admin'] },
    { name:'Chatbot Context', Icon:Bot,           path:'/nova-context',           roles:['admin'] },
    { name:'Coming Soon',   Icon:Clock,           path:'/coming-soon',        roles:['admin','teacher','student'] },
  ];
  const navItems = NAV_ALL.filter(i => user && i.roles.includes(user.role));

  const getInitials = (name: string) => {
    const p = name.trim().split(' ');
    return p.length === 1 ? p[0][0].toUpperCase() : (p[0][0]+p[p.length-1][0]).toUpperCase();
  };

  const handleSignOutClick = async () => {
    setIsSigningOut(true);
    try { await handleSignOut(); } catch {} finally { setIsSigningOut(false); }
  };

  // Clears every pending island timeout
  const clearAllIslandTimeouts = useCallback(() => {
    islandAllTimeouts.current.forEach(clearTimeout);
    islandAllTimeouts.current = [];
    if (islandTimeout.current) { clearTimeout(islandTimeout.current); islandTimeout.current = null; }
    if (fullExpandTimeout.current) { clearTimeout(fullExpandTimeout.current); fullExpandTimeout.current = null; }
  }, []);

  // Runs the pill→blob→gone collapse sequence from current state
  const collapseIsland = useCallback(() => {
    setIslandFullExpand(false);
    // Start width collapsing immediately
    const t1 = setTimeout(() => setIslandExpanded(false), 50);
    // Snap to pill radius only after width has nearly finished collapsing (~900ms into 1s transition)
    const tr = setTimeout(() => setIslandPillRadius(true), 950);
    const t2 = setTimeout(() => setIslandActive(false), 1150);
    const t3 = setTimeout(() => { setIslandNotif(null); setIslandPillRadius(false); }, 1550);
    islandAllTimeouts.current.push(t1, tr, t2, t3);
  }, []);

  const addNotification = useCallback((message: string, type: 'success'|'info'|'warning'|'error' = 'info') => {
    // Always start from collapsed state — fix #2
    clearAllIslandTimeouts();
    setIslandFullExpand(false);
    setIslandExpanded(false);
    setIslandActive(false);
    setIslandPillRadius(true);
    setIslandNotif({ message, type });

    // Step 1: fade in as circle (20ms)
    const t1 = setTimeout(() => setIslandActive(true), 20);
    // Step 2: expand to pill (450ms)
    const t2 = setTimeout(() => setIslandExpanded(true), 450);
    // Step 3: auto-collapse pill after hold (3450ms) — cancelled if user manually expands
    islandTimeout.current = setTimeout(() => collapseIsland(), 3450);
    islandAllTimeouts.current.push(t1, t2);
  }, [clearAllIslandTimeouts, collapseIsland]);

  useEffect(() => {
    (window as any).addNotification = addNotification;
    return () => { delete (window as any).addNotification; };
  }, [addNotification]);

  // Fix #2: reset island completely on logout
  useEffect(() => {
    if (!isAuthenticated) {
      clearAllIslandTimeouts();
      setIslandFullExpand(false);
      setIslandExpanded(false);
      setIslandActive(false);
      setIslandPillRadius(false);
      setIslandNotif(null);
    }
  }, [isAuthenticated]);

  // When user manually full-expands: cancel auto-collapse, start 5s hold then collapse sequence
  useEffect(() => {
    if (!islandFullExpand) return;
    // Cancel the pill auto-collapse that was running
    if (islandTimeout.current) { clearTimeout(islandTimeout.current); islandTimeout.current = null; }
    // After 5s: collapse fullExpand → pill → blob → gone
    fullExpandTimeout.current = setTimeout(() => {
      setIslandFullExpand(false);                        // snap back to pill
      islandTimeout.current = setTimeout(() => collapseIsland(), 1000); // then collapse pill after 1s
    }, 5000);
    return () => {
      if (fullExpandTimeout.current) clearTimeout(fullExpandTimeout.current);
    };
  }, [islandFullExpand]);

  // Collapse full-expand when clicking outside the island
  useEffect(() => {
    if (!islandFullExpand) return;
    const handler = (e: MouseEvent) => {
      if (islandRef.current && !islandRef.current.contains(e.target as Node)) {
        setIslandFullExpand(false);
        // Resume normal pill collapse after outside click
        if (fullExpandTimeout.current) { clearTimeout(fullExpandTimeout.current); fullExpandTimeout.current = null; }
        islandTimeout.current = setTimeout(() => collapseIsland(), 1500);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [islandFullExpand]);

  // Real-time unread count from Firestore
  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;
    const unsub = notificationService.subscribeToNotifications(user.id, notifs => {
      setUnreadCount(notifs.filter(n => !n.isRead).length);
    });
    return () => unsub();
  }, [isAuthenticated, user?.id]);

  // Close mobile sidebar on route change
  useEffect(() => {
    if (sidebarOpen) toggleSidebarClick();
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [sidebarOpen]);

  /* ─── Glitter backgroundImage — mirrors DashboardLayout exactly ─── */
  const isLight = theme === 'light';
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

  /* ─── Theme base colors for sidebar/header solid bg ─── */
  const themeBgColor: Record<string, string> = {
    dark:   '#0d1117', light:  '#ebe8e1', slate:  '#0f172a',
    ocean:  '#0c1a2e', forest: '#0a1f14', purple: '#1e1b4b',
    pink:   '#831843', sunset: '#1c0a00',
  };
  const baseBg = themeBgColor[theme] ?? '#0d1117';

  /* ─── Sidebar bg ─── */
  const sbBg = baseBg;
  const sbSparkle = glitterBgImage
    ? glitterBgImage
    : `radial-gradient(ellipse at 20% 20%, rgba(${pRgb},0.18) 0%, transparent 60%),
       radial-gradient(ellipse at 80% 80%, rgba(${pRgb},0.12) 0%, transparent 50%),
       radial-gradient(ellipse at 50% 50%, ${darkMode ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.55)'} 0%, transparent 70%)`;
  const sbBorder = darkMode
    ? `1px solid rgba(${pRgb},0.22)`
    : `1px solid rgba(255,255,255,0.95)`;
  const sbShadow = darkMode
    ? `6px 0 40px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(${pRgb},0.12), 0 0 60px rgba(${pRgb},0.06)`
    : `6px 0 32px rgba(0,0,0,0.10), inset 0 0 0 1px rgba(255,255,255,0.8), 0 0 40px rgba(${pRgb},0.07)`;

  /* ─── Header bg ─── */
  const hdrBg = baseBg;

  return (
    <>
      {/* DESKTOP SIDEBAR
          Auto-collapses to 64px icons, expands on hover to 220px */}
      {isAuthenticated && <aside
        onMouseEnter={handleSidebarMouseEnter}
        onMouseLeave={handleSidebarMouseLeave}
        className="fixed z-[110] hidden lg:flex flex-col"
        style={{
          top: 10,
          left: 10,
          bottom: 10,
          width: SIDEBAR_W,
          backgroundColor: sbBg,
          backgroundImage: sbSparkle,
          backgroundSize: glitterBgSize,
          backdropFilter: 'blur(32px) saturate(200%)',
          WebkitBackdropFilter: 'blur(32px) saturate(200%)',
          border: sbBorder,
          borderRadius: 24,
          boxShadow: sidebarExpanded ? sbShadow : (darkMode ? '3px 0 20px rgba(0,0,0,0.35)' : '3px 0 16px rgba(0,0,0,0.08)'),
          fontFamily: "'Outfit', sans-serif",
          padding: '0 8px 12px',
          overflow: 'hidden',
          transition: 'width 0.28s cubic-bezier(0.34,1.15,0.64,1), box-shadow 0.28s ease',
          isolation: 'isolate',
        }}
      >
        {/* Noise sparkle texture overlay */}
        <div style={{
          position: 'absolute', inset: 0, borderRadius: 24, pointerEvents: 'none', zIndex: 0,
          background: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
          opacity: darkMode ? 0.04 : 0.025,
          mixBlendMode: 'overlay',
        }}/>
        {/* Color accent glow top */}
        <div style={{
          position: 'absolute', top: -30, left: '50%', transform: 'translateX(-50%)',
          width: 120, height: 120, borderRadius: '50%',
          background: `radial-gradient(circle, rgba(${pRgb},${darkMode ? 0.28 : 0.18}) 0%, transparent 70%)`,
          pointerEvents: 'none', zIndex: 0, filter: 'blur(20px)',
        }}/>
        {/* Color accent glow bottom */}
        <div style={{
          position: 'absolute', bottom: -20, right: -10,
          width: 100, height: 100, borderRadius: '50%',
          background: `radial-gradient(circle, rgba(${pRgb},${darkMode ? 0.20 : 0.12}) 0%, transparent 70%)`,
          pointerEvents: 'none', zIndex: 0, filter: 'blur(18px)',
        }}/>
        {/* Content wrapper — above glows */}
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Logo */}
        <div style={{ height: 64, display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, overflow: 'hidden', paddingLeft: 4 }}>
          <Link to="/dashboard" style={{
            width: 36, height: 36, borderRadius: 12, flexShrink: 0,
            background: gradient, display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 3px 12px rgba(${pRgb},0.4)`,
            transition: 'transform 0.2s cubic-bezier(0.34,1.56,0.64,1)',
          }}
            onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.1)')}
            onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
          >
            <GraduationCap size={17} color="#fff" strokeWidth={2.5}/>
          </Link>
          {sidebarExpanded && (
            <span style={{
              fontSize: 15, fontWeight: 800, color: darkMode ? '#fff' : '#111827',
              letterSpacing: '-0.02em', whiteSpace: 'nowrap',
              opacity: sidebarExpanded ? 1 : 0,
              transition: 'opacity 0.18s ease',
            }}>
              EduPlatform
            </span>
          )}
        </div>

        {/* User profile chip */}
        <button
          onClick={() => setShowProfile(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: sidebarExpanded ? 10 : 0,
            padding: sidebarExpanded ? '7px 8px' : '7px',
            borderRadius: 12, width: '100%', marginBottom: 8, flexShrink: 0,
            background: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
            border: darkMode ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(0,0,0,0.07)',
            cursor: 'pointer', overflow: 'hidden',
            transition: 'all 0.22s cubic-bezier(0.34,1.25,0.64,1)',
            justifyContent: sidebarExpanded ? 'flex-start' : 'center',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = darkMode ? `rgba(${pRgb},0.14)` : `rgba(${pRgb},0.09)`; e.currentTarget.style.borderColor = `rgba(${pRgb},0.25)`; }}
          onMouseLeave={e => { e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'; e.currentTarget.style.borderColor = darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'; }}
        >
          <div style={{
            width: 30, height: 30, borderRadius: 9, flexShrink: 0,
            background: gradient, color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: 11, overflow: 'hidden',
          }}>
            {user?.profilePictureUrl
              ? <img src={user.profilePictureUrl} alt={user.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : user && getInitials(user.name)}
          </div>
          {sidebarExpanded && (
            <div style={{ flex: 1, minWidth: 0, textAlign: 'left', opacity: sidebarExpanded ? 1 : 0, transition: 'opacity 0.18s ease' }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: darkMode ? '#fff' : '#111827', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name}</p>
              <p style={{ fontSize: 10, fontWeight: 600, color: primaryColor, textTransform: 'capitalize', margin: 0 }}>{user?.role}</p>
            </div>
          )}
        </button>

        {/* Divider */}
        <div style={{ height: 1, background: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)', marginBottom: 6, flexShrink: 0 }} />

        {/* Nav items */}
        <nav style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', scrollbarWidth: 'none', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {navItems.map(item => (
            <NavItem
              key={item.path}
              path={item.path} name={item.name} Icon={item.Icon}
              isActive={location.pathname === item.path}
              expanded={sidebarExpanded}
              darkMode={darkMode} pRgb={pRgb} gradient={gradient}
              onClick={() => { setShowProfile(false); setSidebarExpanded(false); }}
            />
          ))}
        </nav>

        {/* Divider */}
        <div style={{ height: 1, background: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)', margin: '6px 0', flexShrink: 0 }} />

        {/* Bottom actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
          {/* Theme toggle */}
          <button
            onClick={() => setTheme(darkMode ? 'light' : 'dark')}
            title={darkMode ? 'Light Mode' : 'Dark Mode'}
            style={{
              display: 'flex', alignItems: 'center', gap: sidebarExpanded ? 10 : 0,
              padding: sidebarExpanded ? '8px 10px' : '8px',
              borderRadius: 12, width: '100%', cursor: 'pointer',
              background: 'transparent', border: '1px solid transparent',
              transition: 'all 0.2s ease',
              justifyContent: sidebarExpanded ? 'flex-start' : 'center',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            <span style={{ width: 32, height: 32, borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}>
              {darkMode ? <Sun size={14} color="#94a3b8"/> : <Moon size={14} color="#6b7280"/>}
            </span>
            {sidebarExpanded && <span style={{ fontSize: 13, fontWeight: 500, color: darkMode ? '#94a3b8' : '#6b7280', whiteSpace: 'nowrap', opacity: sidebarExpanded ? 1 : 0 }}>{darkMode ? 'Light Mode' : 'Dark Mode'}</span>}
          </button>

          {/* Settings */}
          <Link to="/settings" onClick={() => { setShowProfile(false); setSidebarExpanded(false); }} title="Settings"
            style={{
              display: 'flex', alignItems: 'center', gap: sidebarExpanded ? 10 : 0,
              padding: sidebarExpanded ? '8px 10px' : '8px',
              borderRadius: 12,
              background: location.pathname === '/settings' ? (darkMode ? `rgba(${pRgb},0.18)` : `rgba(${pRgb},0.12)`) : 'transparent',
              border: location.pathname === '/settings' ? `1px solid rgba(${pRgb},0.25)` : '1px solid transparent',
              textDecoration: 'none', transition: 'all 0.2s ease',
              justifyContent: sidebarExpanded ? 'flex-start' : 'center',
            }}
            onMouseEnter={e => { if (location.pathname !== '/settings') e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)'; }}
            onMouseLeave={e => { if (location.pathname !== '/settings') e.currentTarget.style.background = 'transparent'; }}
          >
            <span style={{ width: 32, height: 32, borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: location.pathname === '/settings' ? gradient : (darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'), boxShadow: location.pathname === '/settings' ? `0 3px 10px rgba(${pRgb},0.35)` : 'none' }}>
              <Settings size={14} color={location.pathname === '/settings' ? '#fff' : (darkMode ? '#64748b' : '#6b7280')} />
            </span>
            {sidebarExpanded && <span style={{ fontSize: 13, fontWeight: location.pathname === '/settings' ? 700 : 500, color: location.pathname === '/settings' ? `rgb(${pRgb})` : (darkMode ? '#94a3b8' : '#6b7280'), whiteSpace: 'nowrap', opacity: sidebarExpanded ? 1 : 0 }}>Settings</span>}
          </Link>

          {/* Sign Out */}
          <button onClick={handleSignOutClick} disabled={isSigningOut} title="Sign Out"
            style={{
              display: 'flex', alignItems: 'center', gap: sidebarExpanded ? 10 : 0,
              padding: sidebarExpanded ? '8px 10px' : '8px',
              borderRadius: 12, width: '100%', cursor: 'pointer',
              background: 'transparent', border: '1px solid transparent',
              opacity: isSigningOut ? 0.6 : 1,
              transition: 'all 0.2s ease',
              justifyContent: sidebarExpanded ? 'flex-start' : 'center',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.10)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.18)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; }}
          >
            <span style={{ width: 32, height: 32, borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}>
              {isSigningOut ? <Loader2 size={14} color="#64748b" className="animate-spin"/> : <LogOut size={14} color={darkMode ? '#64748b' : '#6b7280'}/>}
            </span>
            {sidebarExpanded && <span style={{ fontSize: 13, fontWeight: 500, color: darkMode ? '#94a3b8' : '#6b7280', whiteSpace: 'nowrap', opacity: sidebarExpanded ? 1 : 0 }}>Sign Out</span>}
          </button>
        </div>
        </div>{/* end content wrapper */}
      </aside>}

      {/* MOBILE SIDEBAR DRAWER (slide in from left) */}
      {/* Overlay */}
      {isAuthenticated && sidebarOpen && (
        <div
          onClick={toggleSidebarClick}
          className="lg:hidden fixed inset-0 z-[105]"
          style={{
            background: 'rgba(0,0,0,0.55)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            animation: 'fadeIn 0.22s ease',
          }}
        />
      )}
      {isAuthenticated && <aside
        className="lg:hidden fixed z-[110] flex flex-col"
        style={{
          top: 10, left: 10, bottom: 10,
          width: 240,
          backgroundColor: sbBg,
          backgroundImage: sbSparkle,
          backgroundSize: glitterBgSize,
          backdropFilter: 'blur(32px) saturate(200%)',
          WebkitBackdropFilter: 'blur(32px) saturate(200%)',
          border: sbBorder,
          borderRadius: 24,
          boxShadow: sidebarOpen ? sbShadow : 'none',
          fontFamily: "'Outfit', sans-serif",
          padding: '0 10px 12px',
          transform: sidebarOpen ? 'translateX(0)' : 'translateX(-120%)',
          transition: 'transform 0.3s cubic-bezier(0.34,1.15,0.64,1)',
          overflow: 'hidden',
          isolation: 'isolate',
        }}
      >
        {/* Noise + glow overlays */}
        <div style={{ position:'absolute',inset:0,borderRadius:24,pointerEvents:'none',zIndex:0,background:`url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,opacity:darkMode?0.04:0.025,mixBlendMode:'overlay' as any}}/>
        <div style={{ position:'absolute',top:-30,left:'50%',transform:'translateX(-50%)',width:120,height:120,borderRadius:'50%',background:`radial-gradient(circle, rgba(${pRgb},${darkMode?0.28:0.18}) 0%, transparent 70%)`,pointerEvents:'none',zIndex:0,filter:'blur(20px)'}}/>
        <div style={{ position:'relative',zIndex:1,display:'flex',flexDirection:'column',height:'100%' }}>
        {/* Mobile sidebar header */}
        <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 12, background: gradient, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 3px 12px rgba(${pRgb},0.4)` }}>
              <GraduationCap size={17} color="#fff" strokeWidth={2.5}/>
            </div>
            <span style={{ fontSize: 15, fontWeight: 800, color: darkMode ? '#fff' : '#111827', letterSpacing: '-0.02em' }}>EduPlatform</span>
          </div>
          <button onClick={toggleSidebarClick} style={{ width: 32, height: 32, borderRadius: 10, background: darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <HamburgerMenuIcon state={sidebarOpen ? 'open' : 'closed'} size={28} style={{ color: darkMode ? '#94a3b8' : '#6b7280' }} />
          </button>
        </div>

        {/* User chip */}
        <button onClick={() => { setShowProfile(true); toggleSidebarClick(); }}
          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 12, width: '100%', marginBottom: 8, flexShrink: 0, background: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)', border: darkMode ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(0,0,0,0.07)', cursor: 'pointer', transition: 'all 0.18s ease' }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, flexShrink: 0, background: gradient, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, overflow: 'hidden' }}>
            {user?.profilePictureUrl
              ? <img src={user.profilePictureUrl} alt={user.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : user && getInitials(user.name)}
          </div>
          <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: darkMode ? '#fff' : '#111827', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name}</p>
            <p style={{ fontSize: 10, fontWeight: 600, color: primaryColor, textTransform: 'capitalize', margin: 0 }}>{user?.role}</p>
          </div>
        </button>

        <div style={{ height: 1, background: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)', marginBottom: 6, flexShrink: 0 }} />

        {/* Mobile nav items */}
        <nav style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'none', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {navItems.map(item => (
            <NavItem
              key={item.path}
              path={item.path} name={item.name} Icon={item.Icon}
              isActive={location.pathname === item.path}
              expanded={true}
              darkMode={darkMode} pRgb={pRgb} gradient={gradient}
              onClick={() => { setShowProfile(false); }}
            />
          ))}
        </nav>

        <div style={{ height: 1, background: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)', margin: '6px 0', flexShrink: 0 }} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
          <button onClick={() => { setTheme(darkMode ? 'light' : 'dark'); toggleSidebarClick(); }} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 12, width: '100%', background: 'transparent', border: '1px solid transparent', cursor: 'pointer', transition: 'all 0.18s ease' }}
            onMouseEnter={e => { e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
            <span style={{ width: 32, height: 32, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', flexShrink: 0 }}>
              {darkMode ? <Sun size={14} color="#94a3b8"/> : <Moon size={14} color="#6b7280"/>}
            </span>
            <span style={{ fontSize: 13, fontWeight: 500, color: darkMode ? '#94a3b8' : '#6b7280' }}>{darkMode ? 'Light Mode' : 'Dark Mode'}</span>
          </button>
          <Link to="/settings" onClick={toggleSidebarClick} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 12, background: location.pathname === '/settings' ? (darkMode ? `rgba(${pRgb},0.18)` : `rgba(${pRgb},0.12)`) : 'transparent', border: location.pathname === '/settings' ? `1px solid rgba(${pRgb},0.25)` : '1px solid transparent', textDecoration: 'none', transition: 'all 0.18s ease' }}>
            <span style={{ width: 32, height: 32, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: location.pathname === '/settings' ? gradient : (darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'), flexShrink: 0 }}>
              <Settings size={14} color={location.pathname === '/settings' ? '#fff' : (darkMode ? '#64748b' : '#6b7280')}/>
            </span>
            <span style={{ fontSize: 13, fontWeight: 500, color: darkMode ? '#94a3b8' : '#6b7280' }}>Settings</span>
          </Link>
          <button onClick={handleSignOutClick} disabled={isSigningOut} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 12, width: '100%', background: 'transparent', border: '1px solid transparent', cursor: 'pointer', opacity: isSigningOut ? 0.6 : 1, transition: 'all 0.18s ease' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.10)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
            <span style={{ width: 32, height: 32, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', flexShrink: 0 }}>
              {isSigningOut ? <Loader2 size={14} color="#64748b" className="animate-spin"/> : <LogOut size={14} color={darkMode ? '#64748b' : '#6b7280'}/>}
            </span>
            <span style={{ fontSize: 13, fontWeight: 500, color: darkMode ? '#94a3b8' : '#6b7280' }}>Sign Out</span>
          </button>
        </div>
        </div>{/* end mobile content wrapper */}
      </aside>}

      {/* DESKTOP HEADER
          Solid frosted background — NEVER transparent
          Positioned right of the sidebar (64px gap) */}
      <header
        className="hidden lg:flex fixed top-0 right-0 z-[100] items-center justify-end"
        style={{
          left: SIDEBAR_W,
          height: 64,
          padding: '0 20px',
          gap: 8,
          backgroundColor: hdrBg,
          backgroundImage: glitterBgImage || undefined,
          backgroundSize: glitterBgImage ? glitterBgSize : undefined,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: darkMode ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.08)',
          boxShadow: darkMode ? '0 2px 16px rgba(0,0,0,0.3)' : '0 2px 12px rgba(0,0,0,0.07)',
          fontFamily: "'Outfit', sans-serif",
          transition: 'left 0.28s cubic-bezier(0.34,1.15,0.64,1)',
        }}
      >
        {/* Left side: Bell + Date */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Bell */}
          {isAuthenticated && (
            <div style={{ position: 'relative' }}>
              <button onClick={() => navigate('/notifications')} className="notif-btn" style={{
                width: 38, height: 38, borderRadius: 12,
                background: 'transparent', border: '1px solid transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', position: 'relative', transition: 'all 0.18s ease',
              }}
                onMouseEnter={e => { e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'; e.currentTarget.style.borderColor = darkMode ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.09)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; }}
              >
                <Bell size={16} color={darkMode ? '#64748b' : '#9ca3af'}/>
                {unreadCount > 0 && (
                  <span style={{
                    position: 'absolute', top: 6, right: 6,
                    minWidth: 16, height: 16, borderRadius: 99,
                    background: gradient,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 9, fontWeight: 800, color: '#fff',
                    padding: '0 3px',
                    boxShadow: `0 0 0 2px ${darkMode ? 'rgba(13,16,23,1)' : '#ffffff'}`,
                    lineHeight: 1,
                  }}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>
            </div>
          )}
          {/* Date */}
          {isAuthenticated && <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: darkMode ? '#475569' : '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Today</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: darkMode ? '#e2e8f0' : '#111827', lineHeight: 1.2 }}>
              {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </span>
          </div>}
        </div>

        {/* Right actions */}
        {isAuthenticated && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>

            {/* Search icon */}
            <button onClick={() => setShowMobileSearch(true)} style={{
              width: 38, height: 38, borderRadius: 12,
              background: 'transparent', border: '1px solid transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', transition: 'all 0.18s ease',
            }}
              onMouseEnter={e => { e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'; e.currentTarget.style.borderColor = darkMode ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.09)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; }}
            >
              <Search size={16} color={darkMode ? '#64748b' : '#9ca3af'}/>
            </button>

            {/* + Create */}
            <button style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '0 14px', height: 36, borderRadius: 10,
              background: gradient, color: '#fff',
              fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer',
              boxShadow: `0 3px 10px rgba(${pRgb},0.35)`,
              fontFamily: "'Outfit',sans-serif",
              transition: 'all 0.18s cubic-bezier(0.34,1.25,0.64,1)',
            }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.05)'; e.currentTarget.style.boxShadow = `0 6px 18px rgba(${pRgb},0.5)`; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = `0 3px 10px rgba(${pRgb},0.35)`; }}
            >
              <Plus size={14} strokeWidth={2.5}/> Create
            </button>

            {/* Avatar + Name pill */}
            <button onClick={() => setShowProfile(true)} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '4px 12px 4px 4px', borderRadius: 10,
              background: darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)',
              border: darkMode ? '1px solid rgba(255,255,255,0.09)' : '1px solid rgba(0,0,0,0.09)',
              cursor: 'pointer', transition: 'all 0.18s ease',
              fontFamily: "'Outfit',sans-serif",
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = `rgba(${pRgb},0.3)`; e.currentTarget.style.background = darkMode ? `rgba(${pRgb},0.12)` : `rgba(${pRgb},0.07)`; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = darkMode ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.09)'; e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)'; }}
            >
              <div style={{ width: 28, height: 28, borderRadius: 8, background: gradient, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 11, flexShrink: 0, overflow: 'hidden' }}>
                {user?.profilePictureUrl
                  ? <img src={user.profilePictureUrl} alt={user.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : user && getInitials(user.name)}
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: darkMode ? '#e2e8f0' : '#111827', whiteSpace: 'nowrap', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user?.name}
              </span>
            </button>

            {/* Sign out */}
            <button onClick={handleSignOutClick} disabled={isSigningOut} title="Sign Out" style={{
              width: 38, height: 38, borderRadius: 12,
              background: 'transparent', border: '1px solid transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', opacity: isSigningOut ? 0.6 : 1, transition: 'all 0.18s ease',
            }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.12)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.22)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; }}
            >
              {isSigningOut ? <Loader2 size={15} color="#64748b" className="animate-spin"/> : <LogOut size={15} color={darkMode ? '#64748b' : '#9ca3af'}/>}
            </button>
          </div>
        )}
      </header>

      {/* MOBILE HEADER — solid, always visible */}
      <header
        className="lg:hidden fixed top-0 left-0 right-0 z-[100] flex items-center justify-between"
        style={{
          height: 60,
          padding: '0 14px',
          backgroundColor: hdrBg,
          backgroundImage: glitterBgImage || undefined,
          backgroundSize: glitterBgImage ? glitterBgSize : undefined,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: darkMode ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.08)',
          boxShadow: darkMode ? '0 2px 12px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.07)',
          fontFamily: "'Outfit', sans-serif",
        }}
      >
        {/* Hamburger + Search */}
        {isAuthenticated ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: islandActive ? 0 : 1, transition: 'opacity 0.25s ease', pointerEvents: islandActive ? 'none' : 'auto' }}>
            <button onClick={toggleSidebarClick} style={{
              width: 38, height: 38, borderRadius: 10,
              background: darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)',
              border: darkMode ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            }}>
              <HamburgerMenuIcon state={sidebarOpen ? 'open' : 'closed'} size={32}
                style={{ color: darkMode ? '#94a3b8' : '#6b7280' }} />
            </button>
            <button onClick={() => setShowMobileSearch(true)} style={{
              width: 36, height: 36, borderRadius: 10,
              background: darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)',
              border: darkMode ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            }}>
              <Search size={15} color={darkMode ? '#94a3b8' : '#6b7280'}/>
            </button>
          </div>
        ) : <div style={{ width: 38 }} />}

        {/* Logo center */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: islandActive ? 0 : 1, transition: 'opacity 0.2s ease', pointerEvents: islandActive ? 'none' : 'auto' }}>
          <div style={{ width: 30, height: 30, borderRadius: 9, background: gradient, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <GraduationCap size={14} color="#fff" strokeWidth={2.5}/>
          </div>
          <span style={{ fontSize: 14, fontWeight: 800, color: darkMode ? '#fff' : '#111827' }}>EduPlatform</span>
        </div>

        {/* Right actions */}
        {isAuthenticated ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: islandActive ? 0 : 1, transition: 'opacity 0.25s ease', pointerEvents: islandActive ? 'none' : 'auto' }}>
            <button onClick={() => navigate('/notifications')} style={{
              width: 36, height: 36, borderRadius: 10,
              background: darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)',
              border: darkMode ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative',
            }}>
              <Bell size={15} color={darkMode ? '#94a3b8' : '#6b7280'}/>
              {unreadCount > 0 && (
                <span style={{
                  position: 'absolute', top: 5, right: 5,
                  minWidth: 16, height: 16, borderRadius: 99,
                  background: gradient,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 9, fontWeight: 800, color: '#fff',
                  padding: '0 3px',
                  boxShadow: `0 0 0 2px ${darkMode ? 'rgba(13,16,23,1)' : '#ffffff'}`,
                  lineHeight: 1,
                }}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
            <button onClick={() => setShowProfile(true)} style={{
              width: 32, height: 32, borderRadius: '50%',
              background: gradient, color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: 11, border: 'none', cursor: 'pointer', overflow: 'hidden',
            }}>
              {user?.profilePictureUrl
                ? <img src={user.profilePictureUrl} alt={user.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : user && getInitials(user.name)}
            </button>
          </div>
        ) : <div style={{ width: 38 }} />}
      </header>

      {/* Dynamic Island — fixed floating overlay, never affects layout */}
      {islandNotif && (
        <div className="lg:hidden" ref={islandRef}
          onClick={() => {
            if (!islandExpanded) return;
            if (islandFullExpand) {
              if (fullExpandTimeout.current) { clearTimeout(fullExpandTimeout.current); fullExpandTimeout.current = null; }
              setIslandFullExpand(false);
              islandTimeout.current = setTimeout(() => collapseIsland(), 1500);
            } else {
              setIslandPillRadius(false);
              setIslandFullExpand(true);
            }
          }}
          style={{
            position: 'fixed',
            top: 10,
            left: '50%',
            transform: 'translateX(-50%)',
            width: islandFullExpand ? 'calc(100vw - 28px)' : islandExpanded ? 'calc(100vw - 28px)' : '44px',
            height: islandFullExpand ? 110 : 44,
            borderRadius: islandPillRadius ? 999 : 20,
            background: darkMode ? '#0d1017' : 'rgba(255,255,255,0.95)',
            border: `1.5px solid ${islandNotif.type === 'success' ? 'rgba(34,197,94,0.45)' : islandNotif.type === 'error' ? 'rgba(239,68,68,0.45)' : islandNotif.type === 'warning' ? 'rgba(245,158,11,0.45)' : `rgba(${pRgb},0.45)`}`,
            boxShadow: `0 ${islandFullExpand ? 16 : 4}px ${islandFullExpand ? 48 : 24}px ${islandNotif.type === 'success' ? 'rgba(34,197,94,0.22)' : islandNotif.type === 'error' ? 'rgba(239,68,68,0.22)' : islandNotif.type === 'warning' ? 'rgba(245,158,11,0.22)' : `rgba(${pRgb},0.22)`}`,
            overflow: 'hidden', cursor: 'pointer',
            zIndex: 150,
            opacity: islandActive ? 1 : 0,
            transition: 'width 1s cubic-bezier(0.16,1,0.3,1), height 0.5s cubic-bezier(0.16,1,0.3,1), opacity 0.4s ease',
          }}
        >
          {/* Pill row — always rendered, fades out when full expanded */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: 44,
            display: 'flex', alignItems: 'center', padding: '0 14px', gap: 8,
            opacity: islandFullExpand ? 0 : islandExpanded ? 1 : 0,
            transition: 'opacity 0.2s ease',
            pointerEvents: islandFullExpand ? 'none' : 'auto',
          }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
              background: islandNotif.type === 'success' ? '#22c55e' : islandNotif.type === 'error' ? '#ef4444' : islandNotif.type === 'warning' ? '#f59e0b' : `rgb(${pRgb})`,
              boxShadow: `0 0 6px ${islandNotif.type === 'success' ? 'rgba(34,197,94,0.7)' : islandNotif.type === 'error' ? 'rgba(239,68,68,0.7)' : islandNotif.type === 'warning' ? 'rgba(245,158,11,0.7)' : `rgba(${pRgb},0.7)`}`,
            }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: '#f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
              {islandNotif.message}
            </span>
          </div>

          {/* Expanded card — always rendered, fades in when full expanded */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            padding: '16px 18px',
            opacity: islandFullExpand ? 1 : 0,
            transition: 'opacity 0.25s ease',
            pointerEvents: islandFullExpand ? 'auto' : 'none',
            display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 8,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                background: islandNotif.type === 'success' ? '#22c55e' : islandNotif.type === 'error' ? '#ef4444' : islandNotif.type === 'warning' ? '#f59e0b' : `rgb(${pRgb})`,
                boxShadow: `0 0 8px ${islandNotif.type === 'success' ? 'rgba(34,197,94,0.8)' : islandNotif.type === 'error' ? 'rgba(239,68,68,0.8)' : islandNotif.type === 'warning' ? 'rgba(245,158,11,0.8)' : `rgba(${pRgb},0.8)`}`,
              }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {islandNotif.type === 'success' ? 'Success' : islandNotif.type === 'error' ? 'Error' : islandNotif.type === 'warning' ? 'Warning' : 'Notification'}
              </span>
            </div>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9', margin: 0, lineHeight: 1.4 }}>
              {islandNotif.message}
            </p>
            <p style={{ fontSize: 11, color: '#475569', margin: 0 }}>Tap to collapse</p>
          </div>
        </div>
      )}

      {/* Search Modal */}
      {showMobileSearch && (
        <div className="fixed inset-0 z-[150]" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }} onClick={() => setShowMobileSearch(false)}>
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0,
            padding: '12px 16px',
            background: darkMode ? 'rgba(13,16,23,0.98)' : '#ffffff',
            backdropFilter: 'blur(20px)',
            borderBottom: darkMode ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.08)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <input
                  type="text" value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { handleSearch(searchQuery); setShowMobileSearch(false); } }}
                  placeholder="Search courses, content..." autoFocus
                  style={{
                    width: '100%', height: 44, borderRadius: 12,
                    background: darkMode ? 'rgba(255,255,255,0.07)' : '#f5f5f5',
                    border: `1px solid rgba(${pRgb},0.35)`,
                    paddingLeft: 42, paddingRight: 16,
                    color: darkMode ? '#f1f5f9' : '#111827', fontSize: 14,
                    fontFamily: "'Outfit',sans-serif", outline: 'none',
                    boxShadow: `0 0 0 3px rgba(${pRgb},0.10)`,
                  }}
                />
                <Search size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#64748b', pointerEvents: 'none' }}/>
              </div>
              <button onClick={() => setShowMobileSearch(false)} style={{
                width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                background: darkMode ? 'rgba(255,255,255,0.07)' : '#f0f0f0',
                border: darkMode ? '1px solid rgba(255,255,255,0.09)' : '1px solid rgba(0,0,0,0.09)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              }}>
                <X size={16} color={darkMode ? '#94a3b8' : '#6b7280'}/>
              </button>
            </div>
          </div>
        </div>
      )}

      {showProfile && isAuthenticated && (
        <Profile onClose={() => setShowProfile(false)} onSuccess={() => { setShowProfile(false); window.location.reload(); }}/>
      )}

      <style>{`
        nav::-webkit-scrollbar { display: none; }
        @keyframes fadeIn { from { opacity:0 } to { opacity:1 } }
      `}</style>
    </>
  );
};

export default Navigation;
