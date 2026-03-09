/* /src/components/layout/Navigation.tsx — FINAL: Glass Sidebar + Scroll-safe Active State */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Bell, Search, LogOut, X,
  LayoutDashboard, Users, Upload, Calendar, Medal, BarChart3, Settings, Clock,
  CreditCard, Library, GraduationCap, BookOpen, Brain, ShoppingCart, Trophy,
  Ticket, PlusCircle, Megaphone, FileText, MessageSquare, Sun, Moon, Loader2, ChevronRight, ClipboardCheck, UserCheck, ListOrdered
} from 'lucide-react';
import { useDashboard } from '../../contexts/DashboardContext';
import Profile from '../profile/Profile';
import HamburgerMenuIcon from '../ui/HamburgerMenuIcon';
import clsx from 'clsx';

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
        'group relative flex items-center rounded-2xl select-none outline-none',
        sidebarOpen ? 'gap-3 px-3 py-2.5' : 'justify-center p-2.5',
      )}
      style={{
        fontFamily: "'Outfit', sans-serif",

        /* ── iDraft-style active: gradient pill background ── */
        background: isActive
          ? darkMode
            ? `linear-gradient(135deg, rgba(${pRgb},0.18) 0%, rgba(${aRgb},0.12) 100%)`
            : `linear-gradient(135deg, rgba(${pRgb},0.12) 0%, rgba(${aRgb},0.08) 100%)`
          : isHovered
            ? darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'
            : 'transparent',

        border: isActive
          ? darkMode
            ? `1px solid rgba(${pRgb},0.25)`
            : `1px solid rgba(${pRgb},0.18)`
          : isHovered
            ? darkMode ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(0,0,0,0.06)'
            : '1px solid transparent',

        boxShadow: isActive
          ? `0 2px 10px rgba(${pRgb},0.15)`
          : 'none',

        backdropFilter: isActive ? 'blur(8px)' : 'none',
        WebkitBackdropFilter: isActive ? 'blur(8px)' : 'none',

        transform: isActive && sidebarOpen
          ? 'translateX(2px)'
          : isHovered && sidebarOpen
            ? 'translateX(1px)'
            : 'none',
        transition: 'all 0.2s cubic-bezier(0.34,1.25,0.64,1)',

        /* ── Crisp readable text in both modes ── */
        color: isActive
          ? darkMode ? '#ffffff' : primaryColor
          : isHovered
            ? darkMode ? '#e2e8f0' : '#1f2937'
            : darkMode ? '#94a3b8' : '#4b5563',
      }}
    >
      {/* ── icon bubble — colored on active ── */}
      <span
        className="flex items-center justify-center flex-shrink-0 rounded-xl"
        style={{
          width: 34, height: 34,
          background: isActive
            ? gradient
            : isHovered
              ? darkMode ? `rgba(${pRgb},0.12)` : `rgba(${pRgb},0.08)`
              : darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
          border: isActive
            ? `1px solid rgba(${pRgb},0.35)`
            : isHovered
              ? darkMode ? `1px solid rgba(${pRgb},0.2)` : `1px solid rgba(${pRgb},0.15)`
              : darkMode ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(0,0,0,0.08)',
          boxShadow: isActive ? `0 2px 8px rgba(${pRgb},0.35)` : 'none',
          transform: isActive ? 'scale(1.05)' : isHovered ? 'scale(1.02)' : 'scale(1)',
          transition: 'all 0.2s cubic-bezier(0.34,1.25,0.64,1)',
        }}
      >
        <Icon size={16} strokeWidth={isActive || isHovered ? 2.5 : 2}
          style={{
            color: isActive ? 'white'
              : isHovered ? (darkMode ? `rgb(${pRgb})` : primaryColor)
              : darkMode ? '#94a3b8' : '#6b7280',
            transition: 'color 0.2s ease',
          }} />
      </span>

      {/* ── label — always readable ── */}
      {sidebarOpen && (
        <span style={{
          fontSize: '0.8125rem',
          fontWeight: isActive ? 700 : isHovered ? 600 : 500,
          flex: 1,
          transition: 'all 0.2s ease',
          color: isActive
            ? darkMode ? '#ffffff' : primaryColor
            : isHovered
              ? darkMode ? '#e2e8f0' : '#1f2937'
              : darkMode ? '#94a3b8' : '#4b5563',
        }}>
          {name}
        </span>
      )}

      {/* chevron hint on active */}
      {sidebarOpen && isActive && (
        <ChevronRight size={12} style={{ color: darkMode ? `rgba(${pRgb},0.6)` : `rgba(${pRgb},0.5)`, flexShrink: 0 }} />
      )}

      {/* collapsed: right-edge pill */}
      {!sidebarOpen && isActive && (
        <span className="absolute right-0 top-1/2 -translate-y-1/2 rounded-l-full"
          style={{ width: 3, height: 20, background: gradient }} />
      )}

      {/* tooltip for collapsed mode */}
      {!sidebarOpen && (
        <span
          className="pointer-events-none absolute px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap"
          style={{
            left: 54, zIndex: 99999,
            opacity: isHovered ? 1 : 0,
            transform: isHovered ? 'translateX(0) scale(1)' : 'translateX(-4px) scale(0.96)',
            transition: 'opacity 0.18s ease, transform 0.18s cubic-bezier(0.34,1.25,0.64,1)',
            background: darkMode ? 'rgba(8,12,24,0.97)' : '#1a1f2e',
            color: 'white',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
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
      className="relative h-full overflow-y-auto py-2 px-2 space-y-0.5"
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
  }, []);
  useEffect(() => {
    (window as any).addNotification = addNotification;
    return () => { delete (window as any).addNotification; };
  }, [addNotification]);
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

  /* Header button style — clean, readable in both modes */
  const glassBtn: React.CSSProperties = {
    background:           darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
    border:               darkMode ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.09)',
    backdropFilter:       'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    transition:           'all 0.2s ease',
  };
  const glassBtnHov: React.CSSProperties = {
    background:  darkMode ? `rgba(${pRgb},0.14)` : `rgba(${pRgb},0.08)`,
    border:      darkMode ? `1px solid rgba(${pRgb},0.3)` : `1px solid rgba(${pRgb},0.2)`,
    boxShadow:   `0 2px 10px rgba(${pRgb},0.15)`,
  };

  /* bottom-row button shared style */
  const bottomBtnStyle = (hov: boolean, danger = false): React.CSSProperties => ({
    fontFamily: "'Outfit', sans-serif",
    background: hov
      ? danger ? 'rgba(239,68,68,0.1)' : (darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)')
      : 'transparent',
    border: hov
      ? danger ? '1px solid rgba(239,68,68,0.2)' : (darkMode ? '1px solid rgba(255,255,255,0.09)' : '1px solid rgba(0,0,0,0.08)')
      : '1px solid transparent',
    backdropFilter: hov ? 'blur(8px)' : 'none',
    /* ── always legible text ── */
    color: hov && danger ? '#f87171' : (darkMode ? '#cbd5e1' : '#374151'),
    transition: 'all 0.2s ease',
  });

  const iconWrap = (hov: boolean, danger = false) => ({
    width: 34, height: 34,
    background: hov && danger
      ? 'rgba(239,68,68,0.15)'
      : darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)',
    border: darkMode ? '1px solid rgba(255,255,255,0.09)' : '1px solid rgba(0,0,0,0.09)',
    borderRadius: 12,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0 as const,
    transition: 'all 0.2s ease',
  });

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
          /* Clean neutral sidebar — iDraft style */
          background: darkMode
            ? '#0d1017'
            : '#ffffff',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderRight: darkMode
            ? '1px solid rgba(255,255,255,0.06)'
            : '1px solid rgba(0,0,0,0.08)',
          boxShadow: darkMode
            ? '4px 0 24px rgba(0,0,0,0.4)'
            : '4px 0 16px rgba(0,0,0,0.06)',
          fontFamily: "'Outfit', sans-serif",
        }}
      >

        {/* ── brand ── */}
        <div className={clsx(
          'h-16 sm:h-[68px] lg:h-[72px] px-4 flex items-center justify-between flex-shrink-0 border-b',
          darkMode ? 'border-white/[0.06]' : 'border-black/[0.07]',
        )}>
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <Link to="/dashboard"
              className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 hover:scale-105 active:scale-95 transition-transform"
              style={{
                background: gradient,
                boxShadow: `0 4px 16px rgba(${pRgb},0.4)`,
              }}>
              <GraduationCap className="w-5 h-5 text-white" strokeWidth={2.5} />
            </Link>
            {sidebarOpen && (
              <span style={{
                fontSize: '15px', fontWeight: 700, letterSpacing: '-0.01em',
                color: darkMode ? '#ffffff' : '#111827',
              }}>
                {user?.role === 'student' ? 'Student Portal' : user?.role === 'teacher' ? 'Teacher Portal' : 'Admin Panel'}
              </span>
            )}
          </div>
          <button onClick={toggleSidebarClick}
            className="lg:hidden flex items-center justify-center w-9 h-9 rounded-xl flex-shrink-0"
            style={{ outline:'none', border:'none', boxShadow:'none', WebkitTapHighlightColor:'rgba(0,0,0,0)' }}>
            <HamburgerMenuIcon state={sidebarOpen ? 'open' : 'closed'} size={36}
              style={{ color: darkMode ? '#94a3b8' : '#6b7280' }} />
          </button>
          {sidebarOpen && (
            <button onClick={toggleSidebarClick}
              className="hidden lg:flex items-center justify-center w-9 h-9 rounded-xl flex-shrink-0"
              style={{ outline:'none', border:'none', boxShadow:'none' }}>
              <HamburgerMenuIcon state="open" size={36}
                style={{ color: darkMode ? '#94a3b8' : '#6b7280' }} />
            </button>
          )}
        </div>

        {/* ── user profile ── */}
        <div className="p-3 border-b flex-shrink-0" style={{ borderColor: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)' }}>
          <button
            onClick={() => setShowProfile(true)}
            onMouseEnter={() => setHovProfile(true)}
            onMouseLeave={() => setHovProfile(false)}
            className={clsx('w-full flex items-center rounded-2xl transition-all duration-200',
              sidebarOpen ? 'gap-3 px-3 py-2.5' : 'justify-center p-2.5')}
            style={{
              background: hovProfile
                ? darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'
                : 'transparent',
              border: hovProfile
                ? darkMode ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.07)'
                : '1px solid transparent',
              transition: 'all 0.2s ease',
            }}
          >
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
              style={{ background: gradient }}>
              {user && getInitials(user.name)}
            </div>
            {sidebarOpen && (
              <div className="flex-1 min-w-0 text-left">
                <p style={{ fontSize: '13px', fontWeight: 700, color: darkMode ? '#ffffff' : '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user?.name}
                </p>
                <p style={{ fontSize: '11px', fontWeight: 600, textTransform: 'capitalize', color: primaryColor }}>
                  {user?.role}
                </p>
              </div>
            )}
          </button>
        </div>

        {/* ══════════════════════════════════════════════
            NAV LIST — rounded container like iDraft
        ══════════════════════════════════════════════ */}
        <div className="flex-1 relative overflow-hidden">

          {/* iDraft-style: rounded container around nav items */}
          {sidebarOpen && (
            <div className="absolute inset-x-3 inset-y-3 rounded-2xl pointer-events-none"
              style={{
                background: darkMode
                  ? 'rgba(255,255,255,0.03)'
                  : 'rgba(0,0,0,0.02)',
                border: darkMode
                  ? '1px solid rgba(255,255,255,0.05)'
                  : '1px solid rgba(0,0,0,0.05)',
              }}
            />
          )}

          {/* scroll container */}
          <div className="absolute inset-x-2 inset-y-2 rounded-2xl overflow-hidden">
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
        <div className={clsx('flex-shrink-0 px-2 py-2 border-t pb-16 sm:pb-20 lg:pb-2',
          darkMode ? 'border-white/[0.06]' : 'border-black/[0.07]')}>

          {/* dark-mode toggle */}
          <button
            onClick={() => setDarkMode(v => !v)}
            onMouseEnter={() => setHovTheme(true)}
            onMouseLeave={() => setHovTheme(false)}
            className={clsx('w-full flex items-center rounded-2xl transition-all duration-200 mb-0.5',
              sidebarOpen ? 'gap-3 px-3 py-2.5' : 'justify-center p-2.5')}
            style={bottomBtnStyle(hovTheme)}
          >
            <span style={iconWrap(hovTheme)}>
              {darkMode
                ? <Moon size={15} className="text-indigo-300" strokeWidth={2}/>
                : <Sun size={15} className="text-amber-500" strokeWidth={2}/>}
            </span>
            {sidebarOpen && (
              <div className="flex items-center justify-between flex-1">
                <span className="text-[13px] font-semibold">
                  {darkMode ? 'Dark' : 'Light'} Mode
                </span>
                <div className="relative rounded-full flex-shrink-0"
                  style={{ width:38, height:20, background: darkMode ? gradient : 'rgba(0,0,0,0.15)', transition:'background 0.3s' }}>
                  <div className="absolute top-[3px] w-[14px] h-[14px] rounded-full bg-white shadow"
                    style={{ left: darkMode ? 21 : 3, transition:'left 0.3s' }}/>
                </div>
              </div>
            )}
          </button>

          {/* settings */}
          <Link
            to="/settings"
            onClick={() => setShowProfile(false)}
            onMouseEnter={() => setHovSettings(true)}
            onMouseLeave={() => setHovSettings(false)}
            className={clsx('flex items-center rounded-2xl transition-all duration-200 mb-0.5',
              sidebarOpen ? 'gap-3 px-3 py-2.5' : 'justify-center p-2.5')}
            style={{
              ...bottomBtnStyle(hovSettings || location.pathname === '/settings'),
              ...(location.pathname === '/settings' ? {
                background: gradient,
                border: `1px solid rgba(${pRgb},0.3)`,
                color: 'white',
                boxShadow: `0 4px 14px rgba(${pRgb},0.3)`,
              } : {}),
            }}
          >
            <span style={{
              ...iconWrap(hovSettings),
              ...(location.pathname === '/settings' ? {
                background: 'rgba(255,255,255,0.2)',
                border: '1px solid rgba(255,255,255,0.28)',
              } : {}),
            }}>
              <Settings size={16} strokeWidth={2} style={{ color: location.pathname === '/settings' ? 'white' : 'inherit' }} />
            </span>
            {sidebarOpen && <span className="text-[13px] font-semibold">Settings</span>}
            {!sidebarOpen && (
              <span className="pointer-events-none fixed opacity-0 group-hover:opacity-100 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap"
                style={{ left:88, zIndex:99999, background:'rgba(8,12,24,0.97)', color:'white', border:'1px solid rgba(255,255,255,0.1)', fontFamily:"'Outfit',sans-serif" }}>
                Settings
              </span>
            )}
          </Link>

          {/* sign out */}
          <button
            onClick={handleSignOutClick}
            disabled={isSigningOut}
            onMouseEnter={() => setHovLogout(true)}
            onMouseLeave={() => setHovLogout(false)}
            className={clsx('w-full flex items-center rounded-2xl transition-all duration-200',
              sidebarOpen ? 'gap-3 px-3 py-2.5' : 'justify-center p-2.5',
              isSigningOut && 'opacity-60 cursor-not-allowed')}
            style={bottomBtnStyle(hovLogout, true)}
          >
            <span style={iconWrap(hovLogout, true)}>
              {isSigningOut
                ? <Loader2 size={16} strokeWidth={2} className="animate-spin"/>
                : <LogOut size={16} strokeWidth={2}/>}
            </span>
            {sidebarOpen && <span className="text-[13px] font-semibold">{isSigningOut ? 'Signing Out…' : 'Sign Out'}</span>}
            {!sidebarOpen && !isSigningOut && (
              <span className="pointer-events-none fixed opacity-0 group-hover:opacity-100 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap"
                style={{ left:88, zIndex:99999, background:'rgba(8,12,24,0.97)', color:'white', border:'1px solid rgba(255,255,255,0.1)', fontFamily:"'Outfit',sans-serif" }}>
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
          HEADER — exact same glass-bar language as the sidebar
          • Header bg: same tinted gradient as aside, horizontal sweep
          • Inner gradient strip: mirrors the sidebar nav bar strip
          • Buttons: glass popup cards matching NavItem active style
          • Search: glass pill with tinted border + icon bubble
          • Profile chip: active-nav-card style (raised glass + shadow)
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
          /* Clean glass header — neutral monochrome like iDraft */
          background: darkMode
            ? 'rgba(13,16,26,0.96)'
            : 'rgba(248,249,252,0.96)',
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          borderBottom: darkMode
            ? '1px solid rgba(255,255,255,0.06)'
            : '1px solid rgba(0,0,0,0.07)',
          boxShadow: darkMode
            ? '0 1px 0 rgba(255,255,255,0.03), 0 4px 20px rgba(0,0,0,0.3)'
            : '0 1px 0 rgba(0,0,0,0.04), 0 2px 12px rgba(0,0,0,0.05)',
          fontFamily: "'Outfit', sans-serif",
          position: 'fixed',
        }}
      >
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

          {/* Center logo */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: gradient, boxShadow: `0 4px 14px rgba(${pRgb},0.45)` }}>
              <GraduationCap className="w-[18px] h-[18px] text-white" strokeWidth={2.5}/>
            </div>
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
                  placeholder="Search courses, content..."
                  className="search-input w-full h-10 rounded-2xl focus:outline-none text-[13px] font-medium"
                  style={{
                    background: darkMode ? 'rgba(255,255,255,0.06)' : '#ffffff',
                    border: darkMode ? '1px solid rgba(255,255,255,0.10)' : '1px solid rgba(0,0,0,0.10)',
                    paddingLeft: 40, paddingRight: 16,
                    color: darkMode ? '#f1f5f9' : '#111827',
                    fontFamily: "'Outfit', sans-serif",
                    boxShadow: darkMode ? 'none' : '0 1px 3px rgba(0,0,0,0.08)',
                    transition: 'all 0.2s ease',
                  }}
                  onFocus={e => {
                    e.currentTarget.style.border = `1px solid rgba(${pRgb},0.5)`;
                    e.currentTarget.style.boxShadow = `0 0 0 3px rgba(${pRgb},0.12)`;
                  }}
                  onBlur={e => {
                    e.currentTarget.style.border = darkMode ? '1px solid rgba(255,255,255,0.10)' : '1px solid rgba(0,0,0,0.10)';
                    e.currentTarget.style.boxShadow = darkMode ? 'none' : '0 1px 3px rgba(0,0,0,0.08)';
                  }}
                />
                {/* Search icon */}
                <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  <Search size={14} style={{ color: darkMode ? '#64748b' : '#9ca3af' }} strokeWidth={2}/>
                </span>
                {/* Search results dropdown */}
                {showSearchResults && searchQuery && (
                  <div className="search-results absolute top-full left-0 right-0 mt-2 rounded-2xl overflow-hidden z-50"
                    style={{
                      background: darkMode ? '#0d1017' : '#ffffff',
                      border: `1px solid rgba(${pRgb},0.2)`,
                      boxShadow: `0 16px 40px rgba(0,0,0,0.3)`,
                    }}>
                    <div className="px-3 py-2.5 border-b" style={{ borderColor: darkMode ? 'rgba(255,255,255,0.06)' : '#f3f4f6' }}>
                      <p style={{ fontSize: '11px', fontWeight: 500, color: darkMode ? '#64748b' : '#9ca3af' }}>
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
                        style={{ color: darkMode ? '#e2e8f0' : '#111827', borderColor: darkMode ? 'rgba(255,255,255,0.05)' : '#f3f4f6', fontFamily:"'Outfit',sans-serif" }}
                        onMouseEnter={e => {
                          e.currentTarget.style.background = darkMode ? `rgba(${pRgb},0.1)` : `rgba(${pRgb},0.06)`;
                          e.currentTarget.style.paddingLeft = '20px';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = 'transparent';
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

              {/* + Create button — matches iDraft reference */}
              <button
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-semibold text-white transition-all duration-200"
                style={{
                  background: darkMode
                    ? `linear-gradient(135deg, ${primaryColor} 0%, ${accentColor} 100%)`
                    : `linear-gradient(135deg, ${primaryColor} 0%, ${accentColor} 100%)`,
                  boxShadow: `0 2px 8px rgba(${pRgb},0.35)`,
                  border: 'none',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'scale(1.04)';
                  e.currentTarget.style.boxShadow = `0 4px 16px rgba(${pRgb},0.5)`;
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.boxShadow = `0 2px 8px rgba(${pRgb},0.35)`;
                }}
              >
                <span style={{ fontSize: 16, lineHeight: 1, marginTop: -1 }}>+</span>
                Create
              </button>

              {/* Bell */}
              <div className="relative">
                <button onClick={() => setShowNotifications(v => !v)}
                  className="notif-btn relative flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-200"
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

              {/* Profile avatar — iDraft style: avatar + full name, pill shape */}
              <button onClick={() => setShowProfile(true)}
                className="flex items-center gap-2.5 pl-1.5 pr-3 py-1.5 rounded-2xl transition-all duration-200"
                style={{
                  background: darkMode ? 'rgba(255,255,255,0.07)' : '#ffffff',
                  border: darkMode ? '1px solid rgba(255,255,255,0.10)' : '1px solid rgba(0,0,0,0.10)',
                  boxShadow: darkMode ? 'none' : '0 1px 4px rgba(0,0,0,0.08)',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = darkMode ? `rgba(${pRgb},0.12)` : '#f9fafb';
                  e.currentTarget.style.borderColor = `rgba(${pRgb},0.3)`;
                  e.currentTarget.style.transform = 'scale(1.02)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.07)' : '#ffffff';
                  e.currentTarget.style.borderColor = darkMode ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)';
                  e.currentTarget.style.transform = 'scale(1)';
                }}>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-xs flex-shrink-0"
                  style={{ background: gradient }}>
                  {user && getInitials(user.name)}
                </div>
                <span style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: darkMode ? '#e2e8f0' : '#111827',
                  whiteSpace: 'nowrap',
                  maxWidth: 160,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {user?.name}
                </span>
              </button>

              {/* Sign-out */}
              <button onClick={handleSignOutClick} disabled={isSigningOut}
                className="flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-200"
                style={glassBtn} title="Sign Out"
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(239,68,68,0.12)';
                  e.currentTarget.style.border = '1px solid rgba(239,68,68,0.28)';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(239,68,68,0.2)';
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
                      border: darkMode ? `1px solid rgba(${pRgb},0.28)` : `1px solid rgba(${pRgb},0.2)`,
                      paddingLeft: 42, paddingRight: 16,
                      color: darkMode ? '#f1f5f9' : '#111827',
                      backdropFilter: 'blur(16px)',
                      fontFamily: "'Outfit',sans-serif",
                      boxShadow: `0 0 0 3px rgba(${pRgb},0.12)`,
                    }}/>
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-lg flex items-center justify-center pointer-events-none"
                    style={{
                      background: darkMode ? `rgba(${pRgb},0.2)` : `rgba(${pRgb},0.12)`,
                      border: darkMode ? `1px solid rgba(${pRgb},0.28)` : `1px solid rgba(${pRgb},0.2)`,
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
