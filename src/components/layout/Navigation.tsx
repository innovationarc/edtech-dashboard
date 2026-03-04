/* /src/components/layout/Navigation.tsx — FINAL: Glass Sidebar + Scroll-safe Active State */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Bell, Search, LogOut, X,
  LayoutDashboard, Users, Upload, Calendar, Medal, BarChart3, Settings, Clock,
  CreditCard, Library, GraduationCap, BookOpen, Brain, ShoppingCart, Trophy,
  Ticket, PlusCircle, Megaphone, FileText, MessageSquare, Sun, Moon, Loader2, ChevronRight, ClipboardCheck
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

        /* ── raised glass card when active ── */
        background: isActive
          ? darkMode
            ? `linear-gradient(135deg, rgba(${pRgb},0.22) 0%, rgba(${aRgb},0.14) 55%, rgba(255,255,255,0.06) 100%)`
            : `linear-gradient(135deg, rgba(255,255,255,0.97) 0%, rgba(255,255,255,0.88) 100%)`
          : isHovered
            ? darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)'
            : 'transparent',

        border: isActive
          ? darkMode
            ? `1px solid rgba(${pRgb},0.38)`
            : `1px solid rgba(${pRgb},0.22)`
          : isHovered
            ? darkMode ? '1px solid rgba(255,255,255,0.09)' : '1px solid rgba(0,0,0,0.07)'
            : '1px solid transparent',

        /* shadow lifts card above the gradient bar — the video "popup" */
        boxShadow: isActive
          ? darkMode
            ? `0 4px 24px -4px rgba(${pRgb},0.5), 0 1px 0 rgba(255,255,255,0.12) inset`
            : `0 4px 16px -4px rgba(${pRgb},0.28), 0 1px 0 rgba(255,255,255,1) inset`
          : isHovered
            ? darkMode
              ? `0 2px 12px -4px rgba(${pRgb},0.3)`
              : `0 2px 8px -4px rgba(${pRgb},0.15)`
            : 'none',

        backdropFilter: isActive ? 'blur(20px) saturate(180%)' : 'none',
        WebkitBackdropFilter: isActive ? 'blur(20px) saturate(180%)' : 'none',

        /* slight right-push: the "pop-out" from the video */
        transform: isActive && sidebarOpen
          ? 'translateX(3px) scale(1.01)'
          : isHovered && sidebarOpen
            ? 'translateX(2px) scale(1.005)'
            : 'scale(1)',
        transition: 'all 0.22s cubic-bezier(0.34,1.25,0.64,1)',

        color: isActive
          ? darkMode ? 'white' : primaryColor
          : isHovered
            ? darkMode ? 'rgba(226,232,240,0.95)' : 'rgba(31,41,55,0.95)'
            : darkMode ? 'rgba(148,163,184,0.85)' : 'rgba(75,85,99,0.9)',
      }}
    >
      {/* ── icon bubble ── */}
      <span
        className="flex items-center justify-center flex-shrink-0 rounded-xl"
        style={{
          width: 34, height: 34,
          background: isActive
            ? gradient
            : isHovered
              ? darkMode ? `rgba(${pRgb},0.18)` : `rgba(${pRgb},0.12)`
              : darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)',
          border: isActive
            ? '1px solid rgba(255,255,255,0.28)'
            : isHovered
              ? darkMode ? `1px solid rgba(${pRgb},0.3)` : `1px solid rgba(${pRgb},0.2)`
              : darkMode ? '1px solid rgba(255,255,255,0.09)' : '1px solid rgba(0,0,0,0.09)',
          boxShadow: isActive
            ? `0 3px 14px rgba(${pRgb},0.55)`
            : isHovered
              ? `0 2px 8px rgba(${pRgb},0.25)`
              : 'none',
          transform: isActive ? 'scale(1.09)' : isHovered ? 'scale(1.05)' : 'scale(1)',
          transition: 'all 0.22s cubic-bezier(0.34,1.25,0.64,1)',
        }}
      >
        <Icon size={16} strokeWidth={isActive || isHovered ? 2.5 : 2}
          style={{ color: isActive ? 'white' : isHovered ? (darkMode ? `rgb(${pRgb})` : primaryColor) : 'inherit',
            transition: 'color 0.22s ease' }} />
      </span>

      {/* ── label ── */}
      {sidebarOpen && (
        <span style={{
          fontSize: 'clamp(0.75rem,1.1vw,0.8125rem)',
          fontWeight: isActive ? 700 : isHovered ? 600 : 500,
          letterSpacing: isActive ? '0.015em' : 0,
          flex: 1,
          transition: 'font-weight 0.2s ease',
          /* shaded gradient text on active */
          ...(isActive ? {
            background: darkMode
              ? 'linear-gradient(90deg,#fff 0%,rgba(255,255,255,0.82) 100%)'
              : `linear-gradient(90deg,${primaryColor},${accentColor})`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          } : {}),
        }}>
          {name}
        </span>
      )}

      {/* chevron hint */}
      {sidebarOpen && isActive && (
        <ChevronRight size={12} style={{ color: darkMode ? 'rgba(255,255,255,0.35)' : `rgba(${pRgb},0.45)`, flexShrink: 0 }} />
      )}

      {/* collapsed: glowing right-edge pill */}
      {!sidebarOpen && isActive && (
        <span className="absolute right-0 top-1/2 -translate-y-1/2 rounded-l-full"
          style={{ width: 3, height: 20, background: gradient, boxShadow: `0 0 10px rgba(${pRgb},0.9)` }} />
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
    { name:'Payments',      Icon:CreditCard,      path:'/payments',           roles:['admin'] },
    { name:'Analytics',     Icon:BarChart3,       path:'/analytics',          roles:['admin'] },
    { name:'Content',       Icon:Upload,          path:'/content',            roles:['admin','teacher'] },
    { name:'Courses',       Icon:PlusCircle,      path:'/course-creation',    roles:['admin','teacher'] },
    { name:'Coupons',       Icon:Ticket,          path:'/manage-coupon',      roles:['admin','manager'] },
    { name:'Study Plans',   Icon:Calendar,        path:'/study-plan',         roles:['admin','teacher'] },
    { name:'Progress',      Icon:Medal,           path:'/progress',           roles:['admin','teacher'] },
    { name:'Evaluate Exam', Icon:ClipboardCheck,  path:'/exam-evaluation',    roles:['admin','teacher'] },
    { name:'Questions',     Icon:MessageSquare,   path:'/teacher-qa',         roles:['teacher'] },
    { name:'Tasks',         Icon:FileText,        path:'/teacher-tasks',      roles:['teacher'] },
    { name:'Library',       Icon:Library,         path:'/content-library',    roles:['admin','teacher','student'] },
    { name:'Courses',       Icon:ShoppingCart,    path:'/course-enrollment',  roles:['admin','teacher','student'] },
    { name:'Practice',      Icon:Brain,           path:'/mcq-practice',       roles:['admin','teacher','student'] },
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

  /* Shared glass style — tinted with primary colour, matching sidebar */
  const glassBtn: React.CSSProperties = {
    background:           darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
    border:               darkMode ? `1px solid rgba(${pRgb},0.15)` : `1px solid rgba(${pRgb},0.12)`,
    backdropFilter:       'blur(16px) saturate(180%)',
    WebkitBackdropFilter: 'blur(16px) saturate(180%)',
    transition:           'all 0.2s cubic-bezier(0.34,1.25,0.64,1)',
  };
  const glassBtnHov: React.CSSProperties = {
    background:  darkMode ? `rgba(${pRgb},0.12)` : `rgba(${pRgb},0.07)`,
    border:      darkMode ? `1px solid rgba(${pRgb},0.28)` : `1px solid rgba(${pRgb},0.22)`,
    boxShadow:   darkMode ? `0 4px 16px -4px rgba(${pRgb},0.3)` : `0 4px 12px -4px rgba(${pRgb},0.2)`,
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
    color: hov && danger ? '#f87171' : (darkMode ? 'rgba(148,163,184,0.85)' : 'rgba(75,85,99,0.9)'),
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
          /* primary-tinted glass — the "shaded colour" */
          background: darkMode
            ? `linear-gradient(170deg,
                rgba(6,9,20,0.98)    0%,
                rgba(${pRgb},0.09)  28%,
                rgba(10,14,30,0.97) 58%,
                rgba(${aRgb},0.07)  82%,
                rgba(6,9,20,0.98)   100%)`
            : `linear-gradient(170deg,
                rgba(250,251,255,0.98) 0%,
                rgba(${pRgb},0.06)    40%,
                rgba(${aRgb},0.03)    70%,
                rgba(248,250,255,0.97) 100%)`,
          backdropFilter:       'blur(32px) saturate(200%)',
          WebkitBackdropFilter: 'blur(32px) saturate(200%)',
          borderRight: darkMode
            ? `1px solid rgba(${pRgb},0.16)`
            : `1px solid rgba(${pRgb},0.13)`,
          boxShadow: `8px 0 48px -4px rgba(0,0,0,0.55), inset -1px 0 0 rgba(${pRgb},0.09)`,
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
        <div className={clsx('p-3 border-b flex-shrink-0', darkMode ? 'border-white/[0.06]' : 'border-black/[0.07]')}>
          <button
            onClick={() => setShowProfile(true)}
            onMouseEnter={() => setHovProfile(true)}
            onMouseLeave={() => setHovProfile(false)}
            className={clsx('w-full flex items-center rounded-2xl transition-all duration-200',
              sidebarOpen ? 'gap-3 px-3 py-2.5' : 'justify-center p-2.5')}
            style={bottomBtnStyle(hovProfile)}
          >
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
              style={{ background: gradient, boxShadow: `0 3px 12px rgba(${pRgb},0.4)` }}>
              {user && getInitials(user.name)}
            </div>
            {sidebarOpen && (
              <div className="flex-1 min-w-0 text-left">
                <p className={clsx('text-[13px] font-bold truncate leading-tight', darkMode ? 'text-white' : 'text-gray-900')}>
                  {user?.name}
                </p>
                <p className="text-[11px] font-semibold capitalize" style={{ color: primaryColor }}>
                  {user?.role}
                </p>
              </div>
            )}
          </button>
        </div>

        {/* ══════════════════════════════════════════════
            NAV LIST
            — gradient-tinted bar fills the whole area
            — each NavItem is self-contained in normal flow
            — scrolling NEVER misaligns the active style
        ══════════════════════════════════════════════ */}
        <div className="flex-1 relative overflow-hidden">

          {/* gradient bar backdrop (the coloured bar from the video) */}
          {sidebarOpen && (
            <div className="absolute inset-x-2 inset-y-2 rounded-3xl pointer-events-none"
              style={{
                background: darkMode
                  ? `linear-gradient(180deg, rgba(${pRgb},0.11) 0%, rgba(${pRgb},0.06) 50%, rgba(${aRgb},0.09) 100%)`
                  : `linear-gradient(180deg, rgba(${pRgb},0.07) 0%, rgba(${pRgb},0.03) 50%, rgba(${aRgb},0.06) 100%)`,
                border: darkMode
                  ? `1px solid rgba(${pRgb},0.13)`
                  : `1px solid rgba(${pRgb},0.10)`,
              }}
            />
          )}

          {/* scroll container — clipped inside the glass backdrop boundary */}
          <div className="absolute inset-x-2 inset-y-2 rounded-3xl overflow-hidden">
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
          /* Same tinted deep-glass as sidebar — horizontal direction */
          background: darkMode
            ? `linear-gradient(90deg,
                rgba(6,9,20,0.97)    0%,
                rgba(${pRgb},0.09)  25%,
                rgba(10,14,30,0.97) 55%,
                rgba(${aRgb},0.07)  80%,
                rgba(6,9,20,0.97)   100%)`
            : `linear-gradient(90deg,
                rgba(250,251,255,0.97) 0%,
                rgba(${pRgb},0.06)    40%,
                rgba(${aRgb},0.04)    70%,
                rgba(248,250,255,0.97) 100%)`,
          backdropFilter:       'blur(32px) saturate(200%)',
          WebkitBackdropFilter: 'blur(32px) saturate(200%)',
          borderBottom: darkMode
            ? `1px solid rgba(${pRgb},0.16)`
            : `1px solid rgba(${pRgb},0.13)`,
          boxShadow: darkMode
            ? `0 1px 0 rgba(255,255,255,0.03), 0 8px 40px -8px rgba(0,0,0,0.5), inset 0 -1px 0 rgba(${pRgb},0.08)`
            : `0 1px 0 rgba(0,0,0,0.04), 0 4px 20px rgba(0,0,0,0.07), inset 0 -1px 0 rgba(${pRgb},0.06)`,
          fontFamily: "'Outfit', sans-serif",
          position: 'fixed',
        }}
      >
        {/* ── Inner gradient strip — mirrors sidebar nav bar, horizontal ── */}
        <div className="absolute inset-x-3 inset-y-2 rounded-2xl pointer-events-none hidden lg:block"
          style={{
            background: darkMode
              ? `linear-gradient(90deg, rgba(${pRgb},0.11) 0%, rgba(${pRgb},0.06) 50%, rgba(${aRgb},0.09) 100%)`
              : `linear-gradient(90deg, rgba(${pRgb},0.07) 0%, rgba(${pRgb},0.03) 50%, rgba(${aRgb},0.06) 100%)`,
            border: darkMode
              ? `1px solid rgba(${pRgb},0.13)`
              : `1px solid rgba(${pRgb},0.10)`,
          }}
        />

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
                  placeholder="Search courses, content…"
                  className="search-input w-full h-10 rounded-xl focus:outline-none text-[13px] font-medium"
                  style={{
                    /* Tinted glass matching sidebar inactive icon bubbles */
                    background: darkMode
                      ? `rgba(${pRgb},0.1)`
                      : `rgba(255,255,255,0.7)`,
                    border: darkMode
                      ? `1px solid rgba(${pRgb},0.22)`
                      : `1px solid rgba(${pRgb},0.18)`,
                    paddingLeft: 42, paddingRight: 16,
                    color: darkMode ? '#f1f5f9' : '#111827',
                    backdropFilter: 'blur(16px)',
                    fontFamily: "'Outfit', sans-serif",
                    boxShadow: darkMode
                      ? `inset 0 1px 0 rgba(255,255,255,0.07), 0 1px 0 rgba(0,0,0,0.2)`
                      : `inset 0 1px 0 rgba(255,255,255,0.9), 0 1px 0 rgba(0,0,0,0.06)`,
                    transition: 'all 0.25s cubic-bezier(0.34,1.25,0.64,1)',
                  }}
                  onFocus={e => {
                    e.currentTarget.style.background = darkMode ? `rgba(${pRgb},0.18)` : 'rgba(255,255,255,0.95)';
                    e.currentTarget.style.border = `1px solid rgba(${pRgb},0.5)`;
                    e.currentTarget.style.boxShadow = `0 0 0 3px rgba(${pRgb},0.15), inset 0 1px 0 rgba(255,255,255,0.08)`;
                  }}
                  onBlur={e => {
                    e.currentTarget.style.background = darkMode ? `rgba(${pRgb},0.1)` : 'rgba(255,255,255,0.7)';
                    e.currentTarget.style.border = darkMode ? `1px solid rgba(${pRgb},0.22)` : `1px solid rgba(${pRgb},0.18)`;
                    e.currentTarget.style.boxShadow = darkMode
                      ? `inset 0 1px 0 rgba(255,255,255,0.07), 0 1px 0 rgba(0,0,0,0.2)`
                      : `inset 0 1px 0 rgba(255,255,255,0.9), 0 1px 0 rgba(0,0,0,0.06)`;
                  }}
                />
                {/* Search icon bubble — same style as sidebar icon bubbles */}
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-lg flex items-center justify-center pointer-events-none"
                  style={{
                    background: darkMode ? `rgba(${pRgb},0.2)` : `rgba(${pRgb},0.12)`,
                    border: darkMode ? `1px solid rgba(${pRgb},0.28)` : `1px solid rgba(${pRgb},0.2)`,
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

              {/* Profile chip — raised glass card, same style as active NavItem */}
              <button onClick={() => setShowProfile(true)}
                className="flex items-center gap-2.5 pl-1.5 pr-3 py-1 rounded-xl transition-all duration-200"
                style={{
                  /* Active nav item card style */
                  background: darkMode
                    ? `linear-gradient(135deg, rgba(${pRgb},0.22) 0%, rgba(${aRgb},0.14) 55%, rgba(255,255,255,0.06) 100%)`
                    : `linear-gradient(135deg, rgba(255,255,255,0.97) 0%, rgba(255,255,255,0.88) 100%)`,
                  border: darkMode
                    ? `1px solid rgba(${pRgb},0.38)`
                    : `1px solid rgba(${pRgb},0.22)`,
                  boxShadow: darkMode
                    ? `0 4px 20px -4px rgba(${pRgb},0.45), 0 1px 0 rgba(255,255,255,0.12) inset`
                    : `0 4px 14px -4px rgba(${pRgb},0.25), 0 1px 0 rgba(255,255,255,1) inset`,
                  backdropFilter: 'blur(20px) saturate(180%)',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.boxShadow = darkMode
                    ? `0 6px 24px -4px rgba(${pRgb},0.6), 0 1px 0 rgba(255,255,255,0.15) inset`
                    : `0 6px 18px -4px rgba(${pRgb},0.35), 0 1px 0 rgba(255,255,255,1) inset`;
                  e.currentTarget.style.transform = 'scale(1.02)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.boxShadow = darkMode
                    ? `0 4px 20px -4px rgba(${pRgb},0.45), 0 1px 0 rgba(255,255,255,0.12) inset`
                    : `0 4px 14px -4px rgba(${pRgb},0.25), 0 1px 0 rgba(255,255,255,1) inset`;
                  e.currentTarget.style.transform = 'scale(1)';
                }}>
                {/* Avatar bubble — same gradient as active nav icon */}
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs flex-shrink-0"
                  style={{ background: gradient, boxShadow: `0 3px 10px rgba(${pRgb},0.5)` }}>
                  {user && getInitials(user.name)}
                </div>
                <div className="text-left hidden xl:block">
                  {/* Gradient text — same as active NavItem label */}
                  <p className="text-[13px] font-bold leading-tight" style={{
                    background: darkMode
                      ? 'linear-gradient(90deg,#fff 0%,rgba(255,255,255,0.82) 100%)'
                      : `linear-gradient(90deg,${primaryColor},${accentColor})`,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}>
                    {user?.name}
                  </p>
                  <p className="text-[11px] font-semibold capitalize" style={{ color: darkMode ? primaryColor : primaryColor }}>
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
