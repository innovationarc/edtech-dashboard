/* /src/components/layout/Navigation.tsx — FINAL: Glass Sidebar + Scroll-safe Active State */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Bell, Search, LogOut, X,
  LayoutDashboard, Users, Upload, Calendar, Medal, BarChart3, Settings, Clock,
  CreditCard, Library, GraduationCap, BookOpen, Brain, ShoppingCart, Trophy,
  Ticket, PlusCircle, Megaphone, FileText, MessageSquare, Sun, Moon, Loader2, ClipboardCheck, UserCheck, ListOrdered
} from 'lucide-react';
import { useDashboard } from '../../contexts/DashboardContext';
import Profile from '../profile/Profile';
import HamburgerMenuIcon from '../ui/HamburgerMenuIcon';
import clsx from 'clsx';
import { MobileIslandLogo } from '../ui/DynamicIsland';
import type { DynamicIslandNotification, IslandMode } from '../ui/DynamicIsland';

/* ─── colour helper ─── */
const hexRgb = (hex: string) => {
  if (!hex || hex.length < 7) return '99,102,241';
  return `${parseInt(hex.slice(1,3),16)},${parseInt(hex.slice(3,5),16)},${parseInt(hex.slice(5,7),16)}`;
};

/* ─────────────────────────────────────────────────────────────
   NavItem — smooth hover animation, no flicker on cursor move.
   onMouseEnter/onMouseLeave are NOT called here — they belong
   only on the <aside> wrapper to prevent rapid open/close flicker
   when moving between items.
───────────────────────────────────────────────────────────── */
interface NavItemProps {
  path: string;
  name: string;
  Icon: React.ElementType;
  isActive: boolean;
  isHovered: boolean;
  sidebarOpen: boolean;
  darkMode: boolean;
  primaryColor: string;
  accentColor: string;
  pRgb: string;
  aRgb: string;
  gradient: string;
  onHover: (hov: boolean) => void;
  onClick: () => void;
}
const NavItem: React.FC<NavItemProps> = ({
  path, name, Icon, isActive, isHovered, sidebarOpen, darkMode,
  primaryColor, accentColor, pRgb, aRgb, gradient,
  onHover, onClick,
}) => {
  return (
    <Link
      to={path}
      onClick={onClick}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      className={clsx(
        'group relative flex items-center select-none outline-none',
        sidebarOpen ? 'gap-3 px-2.5 py-2 rounded-2xl' : 'justify-center p-2.5 rounded-2xl',
      )}
      style={{
        fontFamily: "'Outfit', sans-serif",
        /* Clean borderless — only the bubble carries the state */
        background: isActive
          ? darkMode
            ? 'rgba(255,255,255,0.05)'
            : 'rgba(0,0,0,0.04)'
          : isHovered
            ? darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'
            : 'transparent',
        border: '1px solid transparent',
        boxShadow: 'none',
        transform: isHovered ? 'scale(1.01)' : 'scale(1)',
        transition: 'all 0.2s cubic-bezier(0.34,1.2,0.64,1)',
        color: isActive
          ? darkMode ? 'rgba(255,255,255,0.95)' : 'rgba(17,24,39,0.95)'
          : isHovered
            ? darkMode ? 'rgba(226,232,240,0.9)' : 'rgba(31,41,55,0.9)'
            : darkMode ? 'rgba(148,163,184,0.7)' : 'rgba(100,116,139,0.85)',
      }}
    >
      {/* ── icon bubble — carries all the visual weight ── */}
      <span
        className="flex items-center justify-center flex-shrink-0 rounded-xl"
        style={{
          width: 36, height: 36,
          /* active: filled gradient bubble with glow */
          background: isActive
            ? gradient
            : isHovered
              ? darkMode ? `rgba(${pRgb},0.2)` : `rgba(${pRgb},0.14)`
              : darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
          border: isActive
            ? 'none'
            : isHovered
              ? darkMode ? `1px solid rgba(${pRgb},0.28)` : `1px solid rgba(${pRgb},0.18)`
              : darkMode ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(0,0,0,0.07)',
          /* glow on hover + active */
          boxShadow: isActive
            ? `0 0 0 4px rgba(${pRgb},0.15), 0 4px 16px rgba(${pRgb},0.5)`
            : isHovered
              ? `0 0 0 3px rgba(${pRgb},0.1), 0 2px 10px rgba(${pRgb},0.3)`
              : 'none',
          transform: isActive
            ? 'scale(1.12)'
            : isHovered
              ? 'scale(1.1)'
              : 'scale(1)',
          transition: 'all 0.22s cubic-bezier(0.34,1.3,0.64,1)',
        }}
      >
        <Icon
          size={15}
          strokeWidth={isActive ? 2.5 : isHovered ? 2.2 : 2}
          style={{
            color: isActive ? 'white' : isHovered
              ? (darkMode ? `rgb(${pRgb})` : primaryColor)
              : 'currentColor',
            transition: 'color 0.2s ease',
          }}
        />
      </span>

      {/* ── label (expanded sidebar only) ── */}
      {sidebarOpen && (
        <span style={{
          fontSize: '0.8125rem',
          fontWeight: isActive ? 650 : isHovered ? 580 : 500,
          flex: 1,
          color: 'inherit',
          transition: 'font-weight 0.15s ease',
          letterSpacing: isActive ? '0.01em' : 0,
        }}>
          {name}
        </span>
      )}

      {/* active dot indicator on right when expanded */}
      {sidebarOpen && isActive && (
        <span style={{
          width: 5, height: 5, borderRadius: '50%',
          background: primaryColor,
          boxShadow: `0 0 6px rgba(${pRgb},0.8)`,
          flexShrink: 0,
        }} />
      )}

      {/* collapsed: glowing bottom dot */}
      {!sidebarOpen && isActive && (
        <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 rounded-full"
          style={{ width: 4, height: 4, background: primaryColor, boxShadow: `0 0 8px rgba(${pRgb},0.9)` }} />
      )}

      {/* tooltip for collapsed mode */}
      {!sidebarOpen && (
        <span
          className="pointer-events-none absolute px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap"
          style={{
            left: 58, zIndex: 99999,
            opacity: isHovered ? 1 : 0,
            transform: isHovered ? 'translateX(0) scale(1)' : 'translateX(-6px) scale(0.95)',
            transition: 'opacity 0.15s ease, transform 0.15s cubic-bezier(0.34,1.25,0.64,1)',
            background: darkMode ? 'rgba(8,12,24,0.96)' : 'rgba(17,24,39,0.94)',
            color: 'white',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
            backdropFilter: 'blur(12px)',
            fontFamily: "'Outfit', sans-serif",
          }}
        >
          {name}
        </span>
      )}
    </Link>
  );
};

/* ─────────────────────────────────────────────────────────────
   NotifDropdown
───────────────────────────────────────────────────────────── */
interface NotifDropdownProps {
  pos: 'mobile' | 'desktop';
  darkMode: boolean;
  pRgb: string;
  notifications: Array<{ id: string; message: string; type: string; timestamp: Date }>;
  onClear: () => void;
  onRemove: (id: string) => void;
  notifIcon: (t: string) => string;
  notifColor: (t: string) => string;
}
const NotifDropdown: React.FC<NotifDropdownProps> = ({
  pos, darkMode, pRgb, notifications, onClear, onRemove, notifIcon, notifColor,
}) => (
  <div
    className={clsx(
      'notif-dropdown rounded-2xl overflow-hidden z-[200]',
      pos === 'desktop'
        ? 'absolute top-full right-0 mt-2 w-[380px]'
        : 'fixed right-2 w-[calc(100vw-16px)] max-w-[360px]',
    )}
    style={{
      top: pos === 'mobile' ? 72 : undefined,
      background: darkMode ? 'rgba(8,12,24,0.97)' : 'rgba(255,255,255,0.97)',
      border: `1px solid rgba(${pRgb},0.18)`,
      boxShadow: '0 16px 48px rgba(0,0,0,0.55)',
      backdropFilter: 'blur(24px)',
      fontFamily: "'Outfit', sans-serif",
    }}
  >
    <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.07]">
      <h3 className={clsx('text-sm font-bold', darkMode ? 'text-white' : 'text-gray-900')}>Notifications</h3>
      {notifications.length > 0 && (
        <button onClick={onClear} className="text-xs font-semibold text-slate-400 hover:text-white transition-colors">
          Clear all
        </button>
      )}
    </div>
    <div className="max-h-[360px] overflow-y-auto">
      {notifications.length === 0 ? (
        <div className="flex flex-col items-center py-10 text-slate-500">
          <Bell size={26} className="mb-3 opacity-40" />
          <p className="text-sm">No notifications yet</p>
        </div>
      ) : notifications.map(n => (
        <div key={n.id} className={`px-4 py-3 border-l-2 flex gap-3 items-start ${notifColor(n.type)}`}>
          <span className="text-base flex-shrink-0">{notifIcon(n.type)}</span>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium">{n.message}</p>
            <p className="text-[11px] opacity-60 mt-0.5">{new Date(n.timestamp).toLocaleTimeString()}</p>
          </div>
          <button onClick={() => onRemove(n.id)} className="text-slate-400 hover:text-white p-0.5 flex-shrink-0">
            <X size={13} />
          </button>
        </div>
      ))}
    </div>
  </div>
);

/* ─────────────────────────────────────────────────────────────
   NavList — renders all nav items with a single shared
   hoveredIndex so the hover highlight slides smoothly between
   items instead of flickering on/off per-item.
───────────────────────────────────────────────────────────── */
interface NavListProps {
  navItems: Array<{ path: string; name: string; Icon: React.ElementType }>;
  location: ReturnType<typeof useLocation>;
  sidebarOpen: boolean;
  darkMode: boolean;
  primaryColor: string;
  accentColor: string;
  pRgb: string;
  aRgb: string;
  gradient: string;
  onItemClick: () => void;
}
const NavList: React.FC<NavListProps> = ({
  navItems, location, sidebarOpen, darkMode, primaryColor, accentColor,
  pRgb, aRgb, gradient, onItemClick,
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  return (
    <nav
      className="relative h-full overflow-y-auto py-1.5 px-2 space-y-0.5"
      style={{ scrollbarWidth: 'none' }}
      onMouseLeave={() => setHoveredIndex(null)}
    >
      {navItems.map((item, idx) => (
        <NavItem
          key={item.path}
          path={item.path}
          name={item.name}
          Icon={item.Icon}
          isActive={location.pathname === item.path}
          isHovered={hoveredIndex === idx}
          sidebarOpen={sidebarOpen}
          darkMode={darkMode}
          primaryColor={primaryColor}
          accentColor={accentColor}
          pRgb={pRgb}
          aRgb={aRgb}
          gradient={gradient}
          onHover={(hov) => setHoveredIndex(hov ? idx : null)}
          onClick={onItemClick}
        />
      ))}
    </nav>
  );
};

/* ══════════════════════════════════════════════════════════════
   MAIN NAVIGATION COMPONENT
══════════════════════════════════════════════════════════════ */
const Navigation = () => {
  const {
    sidebarOpen, toggleSidebarClick,
    handleMouseEnterSidebarArea, handleMouseLeaveSidebarArea,
    handleSearch, handleSignOut,
    isAuthenticated, user,
    theme, primaryColor, accentColor,
  } = useDashboard();

  const location = useLocation();

  const [searchQuery, setSearchQuery]           = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [showMobileSearch, setShowMobileSearch]   = useState(false);
  const [showProfile, setShowProfile]             = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Array<{
    id: string; message: string; type: 'success'|'info'|'warning'|'error'; timestamp: Date;
  }>>([]);

  // ── Mobile Dynamic Island state ──
  const [diExpanded, setDiExpanded]   = useState(false);
  const [diClosing,  setDiClosing]    = useState(false);
  const [diNotif,    setDiNotif]      = useState<DynamicIslandNotification|null>(null);
  const [diMode,     setDiMode]       = useState<IslandMode>('idle');
  const [diProgress, setDiProgress]   = useState(0);
  const [diRecTime,  setDiRecTime]    = useState(0);
  const [darkMode, setDarkMode]     = useState(() => (localStorage.getItem('theme') || 'dark') !== 'light');
  const [isSigningOut, setIsSigningOut] = useState(false);
  /* per-button hover for bottom row */
  const [hovTheme, setHovTheme]     = useState(false);
  const [hovSettings, setHovSettings] = useState(false);
  const [hovLogout, setHovLogout]   = useState(false);
  const [hovProfile, setHovProfile] = useState(false);

  /* derived colours */
  const pRgb     = hexRgb(primaryColor);
  const aRgb     = hexRgb(accentColor);
  const gradient = `linear-gradient(135deg,${primaryColor} 0%,${accentColor} 100%)`;

  useEffect(() => { setDarkMode(theme !== 'light'); }, [theme]);

  /* Reset signing-out state whenever auth status changes (covers re-login without refresh) */
  useEffect(() => { setIsSigningOut(false); }, [isAuthenticated]);

  /* nav items */
  const NAV = [
    { name:'Dashboard',     Icon:LayoutDashboard, path:'/dashboard',          roles:['admin'] },
    { name:'Dashboard',     Icon:GraduationCap,   path:'/student-dashboard',  roles:['student'] },
    { name:'Dashboard',     Icon:BookOpen,        path:'/teacher-dashboard',  roles:['teacher'] },
    { name:'Users',         Icon:Users,           path:'/users',              roles:['admin'] },
    { name:'Announcements', Icon:Megaphone,       path:'/announcements',      roles:['admin'] },
    { name:'Payments',         Icon:CreditCard,      path:'/payments',           roles:['admin'] },
    { name:'Analytics',     Icon:BarChart3,       path:'/analytics',          roles:['admin'] },
    { name:'Content',       Icon:Upload,          path:'/content',            roles:['admin','teacher'] },
    { name:'Courses',           Icon:PlusCircle,      path:'/course-creation',    roles:['admin','teacher'] },
    { name:'Course Assignment', Icon:UserCheck,        path:'/course-assignment',  roles:['admin'] },
    { name:'Coupons',       Icon:Ticket,          path:'/manage-coupon',      roles:['admin','manager'] },
    { name:'Study Plans',   Icon:Calendar,        path:'/study-plan',         roles:['admin','teacher'] },
    { name:'Progress',      Icon:Medal,           path:'/progress',           roles:['student'] },
    { name:'Leaderboard',   Icon:ListOrdered,     path:'/leaderboard',        roles:['admin','manager','teacher','coordinator','student_manager','course_manager'] },
    { name:'Evaluate Exam', Icon:ClipboardCheck,  path:'/exam-evaluation',    roles:['admin','teacher'] },
    { name:'Questions',     Icon:MessageSquare,   path:'/teacher-qa',         roles:['teacher'] },
    { name:'Tasks',         Icon:FileText,        path:'/teacher-tasks',      roles:['teacher'] },
    { name:'Library',       Icon:Library,         path:'/content-library',    roles:['admin','teacher','student'] },
    { name:'Courses',       Icon:ShoppingCart,    path:'/course-enrollment',  roles:['admin','teacher','student'] },
    { name:'Ask Question',  Icon:MessageSquare,   path:'/student-qa',         roles:['student'] },
    { name:'Achievements',  Icon:Trophy,          path:'/achievements',       roles:['admin','teacher','student'] },
    { name:'My Tasks',      Icon:FileText,        path:'/student-tasks',      roles:['student'] },
    { name:'My Study Plan', Icon:Calendar,        path:'/student-study-plan', roles:['student'] },
    { name:'Coming Soon',   Icon:Clock,           path:'/coming-soon',        roles:['admin','teacher','student'] },
  ];
  const navItems = NAV.filter(i => user && i.roles.includes(user.role));

  const getInitials = (name: string) => {
    const p = name.trim().split(' ');
    return p.length === 1 ? p[0][0].toUpperCase() : (p[0][0]+p[p.length-1][0]).toUpperCase();
  };

  /* header helpers */
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault(); handleSearch(searchQuery);
    setShowSearchResults(true); setShowMobileSearch(false);
  };
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    if (!e.target.value) setShowSearchResults(false);
  };
  const handleSignOutClick = async () => {
    setIsSigningOut(true);
    try { await handleSignOut(); } catch { setIsSigningOut(false); }
  };
  const addNotification = useCallback((message: string, type: 'success'|'info'|'warning'|'error' = 'info') => {
    const n = { id: Date.now().toString(), message, type, timestamp: new Date() };
    setNotifications(prev => [n, ...prev.slice(0,4)]);
    setTimeout(() => setNotifications(prev => prev.filter(x => x.id !== n.id)), 5000);
    // Also show on Dynamic Island
    window.dispatchEvent(new CustomEvent('dynamic-island-show', {
      detail: { id: n.id, type, title: message, duration: 4000 },
    }));
  }, []);
  useEffect(() => {
    (window as any).addNotification = addNotification;
    return () => { delete (window as any).addNotification; };
  }, [addNotification]);

  // ── Listen for di-mobile-expand / di-mobile-idle events ──
  useEffect(() => {
    const onExpand = (e: CustomEvent) => {
      setDiClosing(false);
      setDiNotif(e.detail.notif);
      setDiMode(e.detail.mode);
      setDiProgress(e.detail.notif?.progress ?? 0);
      setDiRecTime(0);
      setDiExpanded(true);
    };
    const onIdle = () => {
      setDiClosing(true);
      setTimeout(() => { setDiExpanded(false); setDiClosing(false); setDiNotif(null); setDiMode('idle'); }, 450);
    };
    const onProgress = (e: CustomEvent) => setDiProgress(e.detail.progress);
    window.addEventListener('di-mobile-expand',     onExpand as EventListener);
    window.addEventListener('di-mobile-idle',       onIdle);
    window.addEventListener('dynamic-island-progress', onProgress as EventListener);
    return () => {
      window.removeEventListener('di-mobile-expand',     onExpand as EventListener);
      window.removeEventListener('di-mobile-idle',       onIdle);
      window.removeEventListener('dynamic-island-progress', onProgress as EventListener);
    };
  }, []);
  const removeNotification = (id: string) => setNotifications(prev => prev.filter(n => n.id !== id));
  const notifIcon  = (t: string): string => ({ success:'✅', warning:'⚠️', error:'❌' }[t] ?? 'ℹ️');
  const notifColor = (t: string) => ({
    success: 'bg-emerald-950/60 border-emerald-500 text-emerald-200',
    warning: 'bg-amber-950/60 border-amber-500 text-amber-200',
    error:   'bg-red-950/60 border-red-500 text-red-200',
  }[t] ?? 'bg-indigo-950/60 border-indigo-500 text-indigo-200');

  const handleProfileSuccess = () => { setShowProfile(false); window.location.reload(); };
  const isStudent = user?.role === 'student';
  const isTeacher = user?.role === 'teacher';

  /* close popups on outside click */
  useEffect(() => {
    const h = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest('.notif-dropdown') && !t.closest('.notif-btn')) setShowNotifications(false);
      if (!t.closest('.search-results') && !t.closest('.search-input-wrap')) setShowSearchResults(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  useEffect(() => {
    if (window.innerWidth < 1024 && sidebarOpen) toggleSidebarClick();
  }, [location.pathname]);

  useEffect(() => {
    if (window.innerWidth < 1024) document.body.style.overflow = sidebarOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [sidebarOpen]);

  /* Shared glass style — tinted with primary colour, matching sidebar */
  const glassBtn: React.CSSProperties = {
    background:           'transparent',
    border:               '1px solid transparent',
    backdropFilter:       'none',
    WebkitBackdropFilter: 'none',
    boxShadow:            'none',
    transition:           'all 0.18s cubic-bezier(0.34,1.25,0.64,1)',
    borderRadius:         10,
    color:                darkMode ? 'rgba(148,163,184,0.85)' : 'rgba(55,65,81,0.85)',
  };
  const glassBtnHov: React.CSSProperties = {
    background:  darkMode ? `rgba(255,255,255,0.08)` : `rgba(0,0,0,0.06)`,
    border:      darkMode ? `1px solid rgba(255,255,255,0.1)` : `1px solid rgba(0,0,0,0.08)`,
    boxShadow:   'none',
    color:       darkMode ? 'rgba(255,255,255,0.92)' : 'rgba(17,24,39,0.9)',
  };


  /* ════════════════════════════ RENDER ════════════════════════════ */
  return (
    <>
      {/* ══════════════════════════════════════════════════
          SIDEBAR
      ══════════════════════════════════════════════════ */}
      <aside
        onMouseEnter={handleMouseEnterSidebarArea}
        onMouseLeave={handleMouseLeaveSidebarArea}
        className={clsx(
          'fixed top-0 left-0 h-screen flex flex-col z-[100]',
          'transition-all duration-300 ease-in-out',
          sidebarOpen ? 'w-64' : 'w-20',
          'lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
        style={{
          /* borderless — blends with page bg, no visible edge */
          background: darkMode
            ? 'rgba(6,9,20,0.96)'
            : 'rgba(250,251,255,0.97)',
          backdropFilter:       'blur(32px) saturate(180%)',
          WebkitBackdropFilter: 'blur(32px) saturate(180%)',
          borderRight: 'none',
          boxShadow: darkMode
            ? '4px 0 32px rgba(0,0,0,0.4)'
            : '4px 0 24px rgba(0,0,0,0.06)',
          fontFamily: "'Outfit', sans-serif",
        }}
      >

        {/* ── brand ── */}
        <div className={clsx(
          'h-16 sm:h-[68px] lg:h-[72px] px-4 flex items-center justify-between flex-shrink-0',
        )}>
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <Link to="/dashboard"
              className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 hover:scale-105 active:scale-95 transition-transform"
              style={{
                background: gradient,
                boxShadow: `0 4px 16px rgba(${pRgb},0.45), 0 0 0 1px rgba(255,255,255,0.15) inset`,
              }}>
              <GraduationCap className="w-5 h-5 text-white" strokeWidth={2.5} />
            </Link>
            {sidebarOpen && (
              <span className={clsx('text-[15px] font-bold tracking-tight truncate', darkMode ? 'text-white' : 'text-gray-900')}>
                {user?.role === 'student' ? 'Student Portal' : user?.role === 'teacher' ? 'Teacher Portal' : 'Admin Panel'}
              </span>
            )}
          </div>
          <button onClick={toggleSidebarClick}
            className="lg:hidden flex items-center justify-center w-9 h-9 rounded-xl flex-shrink-0"
            style={{ outline:'none', border:'none', boxShadow:'none', WebkitTapHighlightColor:'rgba(0,0,0,0)' }}>
            <HamburgerMenuIcon state={sidebarOpen ? 'open' : 'closed'} size={36}
              className={darkMode ? 'text-slate-400' : 'text-gray-600'} />
          </button>
          {sidebarOpen && (
            <button onClick={toggleSidebarClick}
              className="hidden lg:flex items-center justify-center w-9 h-9 rounded-xl flex-shrink-0"
              style={{ outline:'none', border:'none', boxShadow:'none' }}>
              <HamburgerMenuIcon state="open" size={36}
                className={darkMode ? 'text-slate-400' : 'text-gray-600'} />
            </button>
          )}
        </div>

        {/* ── user profile ── */}
        <div className={clsx('px-2 pb-1 flex-shrink-0')}>
          <button
            onClick={() => setShowProfile(true)}
            onMouseEnter={() => setHovProfile(true)}
            onMouseLeave={() => setHovProfile(false)}
            className={clsx('w-full flex items-center rounded-2xl transition-all duration-200',
              sidebarOpen ? 'gap-3 px-2.5 py-2' : 'justify-center p-2.5')}
            style={{
              background: hovProfile
                ? darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'
                : 'transparent',
              border: '1px solid transparent',
              transition: 'all 0.2s cubic-bezier(0.34,1.2,0.64,1)',
              transform: hovProfile ? 'scale(1.01)' : 'scale(1)',
            }}
          >
            <div
              className="flex items-center justify-center text-white font-bold text-sm flex-shrink-0 rounded-xl"
              style={{
                width: 36, height: 36,
                background: gradient,
                boxShadow: hovProfile
                  ? `0 0 0 3px rgba(${pRgb},0.2), 0 4px 14px rgba(${pRgb},0.5)`
                  : `0 0 0 0 rgba(${pRgb},0), 0 2px 8px rgba(${pRgb},0.3)`,
                transform: hovProfile ? 'scale(1.1)' : 'scale(1)',
                transition: 'all 0.22s cubic-bezier(0.34,1.3,0.64,1)',
              }}>
              {user && getInitials(user.name)}
            </div>
            {sidebarOpen && (
              <div className="flex-1 min-w-0 text-left">
                <p style={{
                  fontSize: '0.8125rem', fontWeight: 650, lineHeight: 1.3,
                  color: darkMode ? 'rgba(255,255,255,0.9)' : 'rgba(17,24,39,0.9)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {user?.name}
                </p>
                <p style={{ fontSize: '0.6875rem', fontWeight: 500, color: primaryColor, textTransform: 'capitalize' }}>
                  {user?.role}
                </p>
              </div>
            )}
          </button>
        </div>

        {/* ── nav list ── */}
        <div className="flex-1 relative overflow-hidden">
          <div className="absolute inset-0 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
          <NavList
            navItems={navItems}
            location={location}
            sidebarOpen={sidebarOpen}
            darkMode={darkMode}
            primaryColor={primaryColor}
            accentColor={accentColor}
            pRgb={pRgb}
            aRgb={aRgb}
            gradient={gradient}
            onItemClick={() => setShowProfile(false)}
          />
          </div>
        </div>

        {/* ── bottom actions ── */}
        <div className="flex-shrink-0 px-2 py-2 pb-16 sm:pb-20 lg:pb-3 space-y-0.5">

          {/* dark-mode toggle */}
          <button
            onClick={() => setDarkMode(v => !v)}
            onMouseEnter={() => setHovTheme(true)}
            onMouseLeave={() => setHovTheme(false)}
            className={clsx('w-full flex items-center rounded-2xl transition-all duration-200',
              sidebarOpen ? 'gap-3 px-2.5 py-2' : 'justify-center p-2.5')}
            style={{
              background: hovTheme ? (darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)') : 'transparent',
              border: '1px solid transparent',
              transform: hovTheme ? 'scale(1.01)' : 'scale(1)',
              transition: 'all 0.2s cubic-bezier(0.34,1.2,0.64,1)',
              color: darkMode ? 'rgba(148,163,184,0.8)' : 'rgba(100,116,139,0.85)',
            }}
          >
            <span
              className="flex items-center justify-center rounded-xl flex-shrink-0"
              style={{
                width: 36, height: 36,
                background: hovTheme
                  ? darkMode ? 'rgba(99,102,241,0.2)' : 'rgba(245,158,11,0.15)'
                  : darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                border: hovTheme
                  ? darkMode ? '1px solid rgba(99,102,241,0.3)' : '1px solid rgba(245,158,11,0.25)'
                  : darkMode ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(0,0,0,0.07)',
                boxShadow: hovTheme
                  ? darkMode ? '0 0 0 3px rgba(99,102,241,0.1)' : '0 0 0 3px rgba(245,158,11,0.1)'
                  : 'none',
                transform: hovTheme ? 'scale(1.1)' : 'scale(1)',
                transition: 'all 0.22s cubic-bezier(0.34,1.3,0.64,1)',
              }}
            >
              {darkMode
                ? <Moon size={15} style={{ color: hovTheme ? '#818cf8' : 'rgba(148,163,184,0.7)' }} strokeWidth={2}/>
                : <Sun size={15} style={{ color: hovTheme ? '#f59e0b' : 'rgba(100,116,139,0.8)' }} strokeWidth={2}/>}
            </span>
            {sidebarOpen && (
              <div className="flex items-center justify-between flex-1">
                <span style={{ fontSize: '0.8125rem', fontWeight: 550, color: darkMode ? 'rgba(203,213,225,0.85)' : 'rgba(71,85,105,0.9)' }}>
                  {darkMode ? 'Dark Mode' : 'Light Mode'}
                </span>
                <div className="relative rounded-full flex-shrink-0"
                  style={{ width: 34, height: 18, background: darkMode ? gradient : 'rgba(0,0,0,0.12)', transition: 'background 0.3s' }}>
                  <div className="absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow"
                    style={{ left: darkMode ? 18 : 2, transition: 'left 0.3s' }}/>
                </div>
              </div>
            )}
          </button>

          {/* settings */}
          {(() => {
            const isSettingsActive = location.pathname === '/settings';
            return (
              <Link
                to="/settings"
                onClick={() => setShowProfile(false)}
                onMouseEnter={() => setHovSettings(true)}
                onMouseLeave={() => setHovSettings(false)}
                className={clsx('flex items-center rounded-2xl transition-all duration-200',
                  sidebarOpen ? 'gap-3 px-2.5 py-2' : 'justify-center p-2.5')}
                style={{
                  background: isSettingsActive
                    ? darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'
                    : hovSettings
                      ? darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'
                      : 'transparent',
                  border: '1px solid transparent',
                  transform: hovSettings ? 'scale(1.01)' : 'scale(1)',
                  transition: 'all 0.2s cubic-bezier(0.34,1.2,0.64,1)',
                  color: darkMode ? 'rgba(148,163,184,0.8)' : 'rgba(100,116,139,0.85)',
                }}
              >
                <span
                  className="flex items-center justify-center rounded-xl flex-shrink-0"
                  style={{
                    width: 36, height: 36,
                    background: isSettingsActive
                      ? gradient
                      : hovSettings
                        ? darkMode ? `rgba(${pRgb},0.2)` : `rgba(${pRgb},0.14)`
                        : darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                    border: isSettingsActive
                      ? 'none'
                      : hovSettings
                        ? darkMode ? `1px solid rgba(${pRgb},0.28)` : `1px solid rgba(${pRgb},0.18)`
                        : darkMode ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(0,0,0,0.07)',
                    boxShadow: isSettingsActive
                      ? `0 0 0 4px rgba(${pRgb},0.15), 0 4px 16px rgba(${pRgb},0.5)`
                      : hovSettings
                        ? `0 0 0 3px rgba(${pRgb},0.1), 0 2px 10px rgba(${pRgb},0.3)`
                        : 'none',
                    transform: isSettingsActive || hovSettings ? 'scale(1.1)' : 'scale(1)',
                    transition: 'all 0.22s cubic-bezier(0.34,1.3,0.64,1)',
                  }}
                >
                  <Settings size={15} strokeWidth={2} style={{ color: isSettingsActive ? 'white' : hovSettings ? (darkMode ? `rgb(${pRgb})` : primaryColor) : 'currentColor' }} />
                </span>
                {sidebarOpen && (
                  <span style={{ fontSize: '0.8125rem', fontWeight: isSettingsActive ? 650 : 550, color: isSettingsActive ? (darkMode ? 'rgba(255,255,255,0.95)' : 'rgba(17,24,39,0.95)') : 'inherit' }}>
                    Settings
                  </span>
                )}
                {!sidebarOpen && (
                  <span className="pointer-events-none absolute px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap"
                    style={{
                      left: 58, zIndex: 99999,
                      opacity: hovSettings ? 1 : 0,
                      transform: hovSettings ? 'translateX(0) scale(1)' : 'translateX(-6px) scale(0.95)',
                      transition: 'opacity 0.15s ease, transform 0.15s ease',
                      background: darkMode ? 'rgba(8,12,24,0.96)' : 'rgba(17,24,39,0.94)',
                      color: 'white', fontFamily: "'Outfit',sans-serif",
                      boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
                      backdropFilter: 'blur(12px)',
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}>
                    Settings
                  </span>
                )}
              </Link>
            );
          })()}

          {/* sign out */}
          <button
            onClick={handleSignOutClick}
            disabled={isSigningOut}
            onMouseEnter={() => setHovLogout(true)}
            onMouseLeave={() => setHovLogout(false)}
            className={clsx('w-full flex items-center rounded-2xl transition-all duration-200',
              sidebarOpen ? 'gap-3 px-2.5 py-2' : 'justify-center p-2.5',
              isSigningOut && 'opacity-60 cursor-not-allowed')}
            style={{
              background: hovLogout ? 'rgba(239,68,68,0.06)' : 'transparent',
              border: '1px solid transparent',
              transform: hovLogout ? 'scale(1.01)' : 'scale(1)',
              transition: 'all 0.2s cubic-bezier(0.34,1.2,0.64,1)',
            }}
          >
            <span
              className="flex items-center justify-center rounded-xl flex-shrink-0"
              style={{
                width: 36, height: 36,
                background: hovLogout
                  ? 'rgba(239,68,68,0.15)'
                  : darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                border: hovLogout
                  ? '1px solid rgba(239,68,68,0.3)'
                  : darkMode ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(0,0,0,0.07)',
                boxShadow: hovLogout ? '0 0 0 3px rgba(239,68,68,0.1)' : 'none',
                transform: hovLogout ? 'scale(1.1)' : 'scale(1)',
                transition: 'all 0.22s cubic-bezier(0.34,1.3,0.64,1)',
              }}
            >
              {isSigningOut
                ? <Loader2 size={15} strokeWidth={2} className="animate-spin" style={{ color: hovLogout ? '#f87171' : 'rgba(148,163,184,0.7)' }}/>
                : <LogOut size={15} strokeWidth={2} style={{ color: hovLogout ? '#f87171' : (darkMode ? 'rgba(148,163,184,0.7)' : 'rgba(100,116,139,0.8)') }}/>}
            </span>
            {sidebarOpen && (
              <span style={{ fontSize: '0.8125rem', fontWeight: 550, color: hovLogout ? '#f87171' : (darkMode ? 'rgba(148,163,184,0.8)' : 'rgba(100,116,139,0.85)') }}>
                {isSigningOut ? 'Signing Out…' : 'Sign Out'}
              </span>
            )}
            {!sidebarOpen && (
              <span className="pointer-events-none absolute px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap"
                style={{
                  left: 58, zIndex: 99999,
                  opacity: hovLogout ? 1 : 0,
                  transform: hovLogout ? 'translateX(0) scale(1)' : 'translateX(-6px) scale(0.95)',
                  transition: 'opacity 0.15s ease, transform 0.15s ease',
                  background: darkMode ? 'rgba(8,12,24,0.96)' : 'rgba(17,24,39,0.94)',
                  color: 'white', fontFamily: "'Outfit',sans-serif",
                  boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
                  backdropFilter: 'blur(12px)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}>
                Sign Out
              </span>
            )}
          </button>
        </div>
      </aside>

      {/* mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99] lg:hidden"
          onClick={toggleSidebarClick} />
      )}

      {/* ══════════════════════════════════════════════════════════════
          HEADER
      ══════════════════════════════════════════════════════════════ */}
      <header
        className={clsx(
          'header-container fixed top-0 right-0 z-[60]',
          'h-16 sm:h-[68px] lg:h-[72px]',
          'lg:left-64 lg:w-[calc(100%-256px)]',
          !sidebarOpen && 'lg:!left-20 lg:!w-[calc(100%-80px)]',
          'left-0 w-full',
          'transition-all duration-300 ease-in-out',
          'flex items-center',
        )}
        style={{
          /* ── Blended header: no hard border, fades into page background ── */
          background: darkMode
            ? `linear-gradient(180deg,
                rgba(6,9,20,0.92)   0%,
                rgba(6,9,20,0.72)  55%,
                rgba(6,9,20,0.0)  100%)`
            : `linear-gradient(180deg,
                rgba(248,250,252,0.96)  0%,
                rgba(248,250,252,0.72) 55%,
                rgba(248,250,252,0.0) 100%)`,
          backdropFilter:       'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          borderBottom: 'none',
          boxShadow: 'none',
          fontFamily: "'Outfit', sans-serif",
          position: 'fixed',
        }}
      >
        {/* ── No inner strip — clean blended look ── */}

        {/* ── MOBILE layout ── */}
        <div className="lg:hidden relative w-full flex items-center justify-between px-3">
          <div className="flex items-center gap-2">
            {isAuthenticated && (
              <>
                <button onClick={toggleSidebarClick}
                  className="relative flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200"
                  style={glassBtn}
                  onMouseEnter={e => Object.assign(e.currentTarget.style, glassBtnHov)}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = glassBtn.background as string;
                    e.currentTarget.style.border = glassBtn.border as string;
                    e.currentTarget.style.boxShadow = 'none';
                  }}>
                  <HamburgerMenuIcon state={sidebarOpen ? 'open' : 'closed'} size={40}
                    style={{ color: darkMode ? 'rgba(148,163,184,0.85)' : 'rgba(75,85,99,0.85)' }} />
                </button>
                <button onClick={() => setShowMobileSearch(true)}
                  className="relative flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200"
                  style={glassBtn}
                  onMouseEnter={e => Object.assign(e.currentTarget.style, glassBtnHov)}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = glassBtn.background as string;
                    e.currentTarget.style.border = glassBtn.border as string;
                    e.currentTarget.style.boxShadow = 'none';
                  }}>
                  <Search size={18} style={{ color: darkMode ? 'rgba(148,163,184,0.85)' : 'rgba(75,85,99,0.85)' }} strokeWidth={2}/>
                </button>
              </>
            )}
          </div>

          {/* Center logo — Dynamic Island on mobile */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <MobileIslandLogo
              expanded={diExpanded}
              closing={diClosing}
              notif={diNotif}
              mode={diMode}
              progress={diProgress}
              recTime={diRecTime}
              primary={primaryColor}
              gradient={gradient}
              pRgb={pRgb}
              onDismiss={() => window.dispatchEvent(new CustomEvent('dynamic-island-dismiss'))}
            />
          </div>

          {isAuthenticated && (
            <div className="flex items-center gap-2">
              {/* Bell */}
              <div className="relative">
                <button onClick={() => setShowNotifications(v => !v)}
                  className="notif-btn relative flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200"
                  style={glassBtn}
                  onMouseEnter={e => Object.assign(e.currentTarget.style, glassBtnHov)}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = glassBtn.background as string;
                    e.currentTarget.style.border = glassBtn.border as string;
                    e.currentTarget.style.boxShadow = 'none';
                  }}>
                  <Bell size={18} style={{ color: darkMode ? 'rgba(148,163,184,0.85)' : 'rgba(75,85,99,0.85)' }} strokeWidth={2}/>
                  {notifications.length > 0 && (
                    <span className="absolute top-1 right-1 text-white text-[9px] rounded-full min-w-[15px] h-[15px] px-1 flex items-center justify-center font-bold"
                      style={{ background: gradient, boxShadow: `0 2px 6px rgba(${pRgb},0.6)` }}>
                      {notifications.length > 9 ? '9+' : notifications.length}
                    </span>
                  )}
                </button>
                {showNotifications && (
                  <NotifDropdown pos="mobile" darkMode={darkMode} pRgb={pRgb}
                    notifications={notifications} onClear={() => setNotifications([])}
                    onRemove={removeNotification} notifIcon={notifIcon} notifColor={notifColor}/>
                )}
              </div>
              {/* Avatar */}
              <button onClick={() => setShowProfile(true)}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm hover:scale-105 active:scale-95 transition-all"
                style={{ background: gradient, boxShadow: `0 3px 12px rgba(${pRgb},0.45)` }}>
                {user && getInitials(user.name)}
              </button>
            </div>
          )}
        </div>

        {/* ── DESKTOP layout ── */}
        <div className="hidden lg:flex items-center justify-between w-full relative px-5 gap-4">

          {/* Search pill — glass card, same tinted treatment as inactive nav icon bubbles */}
          {isAuthenticated && (
            <div className="relative flex-1 max-w-[480px]">
              <form onSubmit={handleSearchSubmit} className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={handleSearchChange}
                  placeholder="Search courses, content…"
                  className="search-input w-full h-10 rounded-2xl focus:outline-none text-[13px] font-medium"
                  style={{
                    /* Floating pill — blends with page, lifts on focus */
                    background: darkMode
                      ? `rgba(255,255,255,0.06)`
                      : `rgba(255,255,255,0.82)`,
                    border: darkMode
                      ? `1px solid rgba(255,255,255,0.09)`
                      : `1px solid rgba(${pRgb},0.1)`,
                    paddingLeft: 42, paddingRight: 16,
                    color: darkMode ? '#f1f5f9' : '#111827',
                    backdropFilter: 'blur(12px)',
                    fontFamily: "'Outfit', sans-serif",
                    boxShadow: darkMode
                      ? `0 2px 12px rgba(0,0,0,0.25)`
                      : `0 2px 12px rgba(0,0,0,0.07), inset 0 1px 0 rgba(255,255,255,0.9)`,
                    transition: 'all 0.25s cubic-bezier(0.34,1.25,0.64,1)',
                  }}
                  onFocus={e => {
                    e.currentTarget.style.background = darkMode ? `rgba(255,255,255,0.1)` : 'rgba(255,255,255,0.98)';
                    e.currentTarget.style.border = `1px solid rgba(${pRgb},0.4)`;
                    e.currentTarget.style.boxShadow = `0 0 0 3px rgba(${pRgb},0.12), 0 4px 20px rgba(0,0,0,0.12)`;
                  }}
                  onBlur={e => {
                    e.currentTarget.style.background = darkMode ? `rgba(255,255,255,0.06)` : 'rgba(255,255,255,0.82)';
                    e.currentTarget.style.border = darkMode ? `1px solid rgba(255,255,255,0.09)` : `1px solid rgba(${pRgb},0.1)`;
                    e.currentTarget.style.boxShadow = darkMode
                      ? `0 2px 12px rgba(0,0,0,0.25)`
                      : `0 2px 12px rgba(0,0,0,0.07), inset 0 1px 0 rgba(255,255,255,0.9)`;
                  }}
                />
                {/* Search icon bubble — same style as sidebar icon bubbles */}
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-lg flex items-center justify-center pointer-events-none"
                  style={{
                    background: darkMode ? `rgba(${pRgb},0.15)` : `rgba(${pRgb},0.1)`,
                    border: darkMode ? `1px solid rgba(${pRgb},0.2)` : `1px solid rgba(${pRgb},0.15)`,
                  }}>
                  <Search size={12} style={{ color: primaryColor }} strokeWidth={2.5}/>
                </span>
                {/* Search results dropdown */}
                {showSearchResults && searchQuery && (
                  <div className="search-results absolute top-full left-0 right-0 mt-2 rounded-2xl overflow-hidden z-50"
                    style={{
                      background: darkMode
                        ? `linear-gradient(160deg, rgba(6,9,20,0.98) 0%, rgba(${pRgb},0.06) 50%, rgba(6,9,20,0.98) 100%)`
                        : 'rgba(255,255,255,0.98)',
                      border: `1px solid rgba(${pRgb},0.2)`,
                      boxShadow: `0 16px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(${pRgb},0.05) inset`,
                      backdropFilter: 'blur(24px) saturate(180%)',
                    }}>
                    <div className="px-3 py-2.5 border-b" style={{ borderColor: `rgba(${pRgb},0.1)` }}>
                      <p className="text-[11px] font-medium" style={{ color: darkMode ? 'rgba(148,163,184,0.7)' : 'rgba(75,85,99,0.7)' }}>
                        Results for <span style={{ color: darkMode ? 'white' : primaryColor, fontWeight: 700 }}>"{searchQuery}"</span>
                      </p>
                    </div>
                    {(isStudent
                      ? ['Student Dashboard','Content Library','My Progress']
                      : isTeacher
                        ? ['Teacher Dashboard','Content Upload','Study Plans']
                        : ['Content Library','My Courses','Analytics']
                    ).map(r => (
                      <button key={r}
                        className="w-full text-left px-4 py-2.5 text-[13px] font-medium border-b last:border-0 transition-all duration-150"
                        style={{ color: darkMode ? '#e2e8f0' : '#111827', borderColor: `rgba(${pRgb},0.07)`, fontFamily:"'Outfit',sans-serif" }}
                        onMouseEnter={e => {
                          e.currentTarget.style.background = darkMode ? `rgba(${pRgb},0.1)` : `rgba(${pRgb},0.06)`;
                          e.currentTarget.style.color = darkMode ? 'white' : primaryColor;
                          e.currentTarget.style.paddingLeft = '20px';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.color = darkMode ? '#e2e8f0' : '#111827';
                          e.currentTarget.style.paddingLeft = '16px';
                        }}>
                        {r}
                      </button>
                    ))}
                  </div>
                )}
              </form>
            </div>
          )}

          {/* Right-side action buttons */}
          {isAuthenticated && (
            <div className="flex items-center gap-2 flex-shrink-0">

              {/* Bell — glass popup matching sidebar inactive icon bubble */}
              <div className="relative">
                <button onClick={() => setShowNotifications(v => !v)}
                  className="notif-btn relative flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200"
                  style={glassBtn}
                  onMouseEnter={e => Object.assign(e.currentTarget.style, glassBtnHov)}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = glassBtn.background as string;
                    e.currentTarget.style.border = glassBtn.border as string;
                    e.currentTarget.style.boxShadow = 'none';
                  }}>
                  <Bell size={17} style={{ color: darkMode ? 'rgba(148,163,184,0.85)' : 'rgba(75,85,99,0.85)' }} strokeWidth={2}/>
                  {notifications.length > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 text-white text-[9px] rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center font-bold"
                      style={{ background: gradient, boxShadow: `0 2px 6px rgba(${pRgb},0.6)` }}>
                      {notifications.length > 9 ? '9+' : notifications.length}
                    </span>
                  )}
                </button>
                {showNotifications && (
                  <NotifDropdown pos="desktop" darkMode={darkMode} pRgb={pRgb}
                    notifications={notifications} onClear={() => setNotifications([])}
                    onRemove={removeNotification} notifIcon={notifIcon} notifColor={notifColor}/>
                )}
              </div>

              {/* Profile chip — clean minimal pill */}
              <button onClick={() => setShowProfile(true)}
                className="flex items-center gap-2.5 pl-1.5 pr-3 py-1 rounded-xl transition-all duration-200"
                style={{
                  background: darkMode
                    ? 'rgba(255,255,255,0.06)'
                    : 'rgba(255,255,255,0.85)',
                  border: darkMode
                    ? '1px solid rgba(255,255,255,0.1)'
                    : '1px solid rgba(0,0,0,0.08)',
                  boxShadow: 'none',
                  backdropFilter: 'blur(12px)',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.98)';
                  e.currentTarget.style.border = darkMode ? `1px solid rgba(${pRgb},0.25)` : `1px solid rgba(${pRgb},0.2)`;
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.85)';
                  e.currentTarget.style.border = darkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.08)';
                }}>
                {/* Avatar bubble */}
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs flex-shrink-0"
                  style={{ background: gradient }}>
                  {user && getInitials(user.name)}
                </div>
                <div className="text-left hidden xl:block">
                  <p className="text-[13px] font-semibold leading-tight"
                    style={{ color: darkMode ? 'rgba(255,255,255,0.9)' : 'rgba(17,24,39,0.9)' }}>
                    {user?.name}
                  </p>
                  <p className="text-[11px] font-medium capitalize"
                    style={{ color: darkMode ? 'rgba(148,163,184,0.7)' : 'rgba(75,85,99,0.7)' }}>
                    {user?.role}
                  </p>
                </div>
              </button>

              {/* Sign-out — glass button, red on hover */}
              <button onClick={handleSignOutClick} disabled={isSigningOut}
                className="flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200"
                style={glassBtn} title="Sign Out"
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(239,68,68,0.14)';
                  e.currentTarget.style.border = '1px solid rgba(239,68,68,0.35)';
                  e.currentTarget.style.boxShadow = '0 4px 16px -4px rgba(239,68,68,0.35)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = glassBtn.background as string;
                  e.currentTarget.style.border = glassBtn.border as string;
                  e.currentTarget.style.boxShadow = 'none';
                }}>
                {isSigningOut
                  ? <Loader2 size={16} style={{ color: darkMode ? 'rgba(148,163,184,0.85)' : 'rgba(75,85,99,0.85)' }} className="animate-spin"/>
                  : <LogOut size={16} style={{ color: darkMode ? 'rgba(148,163,184,0.85)' : 'rgba(75,85,99,0.85)' }} strokeWidth={2}/>}
              </button>
            </div>
          )}
        </div>
      </header>
      {/* mobile search modal — same tinted glass as header/sidebar */}
      {showMobileSearch && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[90] lg:hidden"
          onClick={() => setShowMobileSearch(false)}>
          <div className="absolute top-0 left-0 right-0 px-3 py-3 border-b"
            onClick={e => e.stopPropagation()}
            style={{
              background: darkMode
                ? `linear-gradient(90deg, rgba(6,9,20,0.98) 0%, rgba(${pRgb},0.09) 50%, rgba(6,9,20,0.98) 100%)`
                : `linear-gradient(90deg, rgba(250,251,255,0.98) 0%, rgba(${pRgb},0.06) 50%, rgba(248,250,255,0.98) 100%)`,
              backdropFilter: 'blur(32px) saturate(200%)',
              borderColor: `rgba(${pRgb},0.16)`,
              paddingTop: 'max(env(safe-area-inset-top,0px) + 12px, 12px)',
              fontFamily: "'Outfit',sans-serif",
            }}>
            <div className="flex items-center gap-2">
              <form onSubmit={handleSearchSubmit} className="flex-1">
                <div className="relative">
                  <input type="text" value={searchQuery} onChange={handleSearchChange}
                    placeholder="Search courses, content…" autoFocus
                    className="w-full h-11 rounded-xl focus:outline-none text-[14px] font-medium"
                    style={{
                      background: darkMode ? `rgba(${pRgb},0.12)` : 'rgba(255,255,255,0.8)',
                      border: darkMode ? `1px solid rgba(${pRgb},0.2)` : `1px solid rgba(${pRgb},0.15)`,
                      paddingLeft: 42, paddingRight: 16,
                      color: darkMode ? '#f1f5f9' : '#111827',
                      backdropFilter: 'blur(16px)',
                      fontFamily: "'Outfit',sans-serif",
                      boxShadow: `0 0 0 3px rgba(${pRgb},0.12)`,
                    }}/>
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-lg flex items-center justify-center pointer-events-none"
                    style={{
                      background: darkMode ? `rgba(${pRgb},0.15)` : `rgba(${pRgb},0.1)`,
                      border: darkMode ? `1px solid rgba(${pRgb},0.2)` : `1px solid rgba(${pRgb},0.15)`,
                    }}>
                    <Search size={12} style={{ color: primaryColor }} strokeWidth={2.5}/>
                  </span>
                </div>
              </form>
              <button onClick={() => setShowMobileSearch(false)}
                className="flex items-center justify-center w-11 h-11 rounded-xl flex-shrink-0 transition-all duration-200"
                style={glassBtn}
                onMouseEnter={e => Object.assign(e.currentTarget.style, glassBtnHov)}
                onMouseLeave={e => {
                  e.currentTarget.style.background = glassBtn.background as string;
                  e.currentTarget.style.border = glassBtn.border as string;
                  e.currentTarget.style.boxShadow = 'none';
                }}>
                <X size={18} style={{ color: darkMode ? 'rgba(148,163,184,0.85)' : 'rgba(75,85,99,0.85)' }} strokeWidth={2}/>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* profile modal */}
      {showProfile && isAuthenticated && (
        <Profile onClose={() => setShowProfile(false)} onSuccess={handleProfileSuccess}/>
      )}

      <style>{`
        nav::-webkit-scrollbar { display: none; }
        .header-container, aside { -webkit-font-smoothing: antialiased; }
        @keyframes notif-in {
          from { opacity:0; transform:translateY(-6px) scale(0.97); }
          to   { opacity:1; transform:translateY(0) scale(1); }
        }
        .notif-dropdown { animation: notif-in 0.18s cubic-bezier(0.34,1.2,0.64,1) forwards; }
        @media (prefers-reduced-motion:reduce) {
          *, *::before, *::after { animation-duration:.01ms!important; transition-duration:.01ms!important; }
        }
      `}</style>
    </>
  );
};

export default Navigation;
