/* Navigation.tsx — Oval icon-only sidebar + iDraft-style top nav */
import React, { useState, useEffect, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Bell, Search, LogOut, X,
  LayoutDashboard, Users, Upload, Calendar, Medal, BarChart3, Settings, Clock,
  CreditCard, Library, GraduationCap, BookOpen, ShoppingCart, Trophy,
  Ticket, PlusCircle, Megaphone, FileText, MessageSquare, Sun, Moon, Loader2,
  ClipboardCheck, UserCheck, ListOrdered, Plus,
} from 'lucide-react';
import { useDashboard } from '../../contexts/DashboardContext';
import Profile from '../profile/Profile';
import HamburgerMenuIcon from '../ui/HamburgerMenuIcon';
import clsx from 'clsx';

const hexRgb = (hex: string) => {
  if (!hex || hex.length < 7) return '99,102,241';
  return `${parseInt(hex.slice(1,3),16)},${parseInt(hex.slice(3,5),16)},${parseInt(hex.slice(5,7),16)}`;
};

/* ─── Oval Nav Item — icon only with tooltip ─── */
interface NavItemProps {
  path: string;
  name: string;
  Icon: React.ElementType;
  isActive: boolean;
  isHovered: boolean;
  darkMode: boolean;
  pRgb: string;
  gradient: string;
  onHover: (h: boolean) => void;
  onClick: () => void;
}

const NavItem: React.FC<NavItemProps> = ({
  path, name, Icon, isActive, isHovered, darkMode, pRgb, gradient, onHover, onClick,
}) => {
  return (
    <Link
      to={path}
      onClick={onClick}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      className="relative flex items-center justify-center nav-item-oval"
      style={{
        width: 46,
        height: 46,
        borderRadius: 16,
        flexShrink: 0,
        background: isActive
          ? gradient
          : isHovered
            ? darkMode ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)'
            : 'transparent',
        border: isActive
          ? 'none'
          : isHovered
            ? darkMode ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(0,0,0,0.10)'
            : '1px solid transparent',
        boxShadow: isActive ? `0 4px 16px rgba(${pRgb},0.40)` : 'none',
        transition: 'all 0.22s cubic-bezier(0.34,1.56,0.64,1)',
        transform: isActive ? 'scale(1.08)' : isHovered ? 'scale(1.04)' : 'scale(1)',
      }}
    >
      <Icon
        size={18}
        strokeWidth={isActive ? 2.5 : 2}
        style={{
          color: isActive ? '#fff' : isHovered ? (darkMode ? '#e2e8f0' : '#1f2937') : (darkMode ? '#64748b' : '#6b7280'),
          transition: 'color 0.2s ease',
        }}
      />
      {/* Tooltip */}
      <span
        className="pointer-events-none absolute left-14 px-3 py-1.5 rounded-xl text-[12px] font-semibold whitespace-nowrap z-[99999]"
        style={{
          background: darkMode ? 'rgba(15,17,27,0.97)' : '#1f2937',
          color: '#fff',
          border: '1px solid rgba(255,255,255,0.10)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          opacity: isHovered && !isActive ? 1 : 0,
          transform: isHovered && !isActive ? 'translateX(0) scale(1)' : 'translateX(-6px) scale(0.95)',
          transition: 'all 0.18s cubic-bezier(0.34,1.25,0.64,1)',
          pointerEvents: 'none',
        }}
      >
        {name}
      </span>
    </Link>
  );
};

/* ─── NavList ─── */
const NavList: React.FC<{
  navItems: Array<{ path: string; name: string; Icon: React.ElementType }>;
  location: ReturnType<typeof useLocation>;
  darkMode: boolean;
  pRgb: string;
  gradient: string;
  onItemClick: () => void;
}> = ({ navItems, location, darkMode, pRgb, gradient, onItemClick }) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  return (
    <nav
      className="flex flex-col items-center py-2 gap-1"
      style={{ overflowY: 'auto', overflowX: 'visible', scrollbarWidth: 'none', flex: 1 }}
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
          darkMode={darkMode}
          pRgb={pRgb}
          gradient={gradient}
          onHover={(h) => setHoveredIndex(h ? idx : null)}
          onClick={onItemClick}
        />
      ))}
    </nav>
  );
};

/* ─── Notification Dropdown ─── */
const NotifDropdown: React.FC<{
  pos: 'mobile' | 'desktop';
  darkMode: boolean;
  pRgb: string;
  notifications: Array<{ id: string; message: string; type: string; timestamp: Date }>;
  onClear: () => void;
  onRemove: (id: string) => void;
}> = ({ pos, darkMode, pRgb, notifications, onClear, onRemove }) => {
  const icon = (t: string) => ({ success:'✅', warning:'⚠️', error:'❌' }[t] ?? 'ℹ️');
  const color = (t: string) => ({
    success: 'bg-emerald-950/60 border-emerald-500 text-emerald-200',
    warning: 'bg-amber-950/60 border-amber-500 text-amber-200',
    error:   'bg-red-950/60 border-red-500 text-red-200',
  }[t] ?? 'bg-indigo-950/60 border-indigo-500 text-indigo-200');

  return (
    <div
      className={clsx('notif-dropdown rounded-2xl overflow-hidden z-[200]',
        pos === 'desktop' ? 'absolute top-full right-0 mt-2 w-[360px]' : 'fixed right-2 w-[calc(100vw-16px)] max-w-[340px]'
      )}
      style={{
        top: pos === 'mobile' ? 72 : undefined,
        background: darkMode ? 'rgba(13,16,26,0.98)' : '#ffffff',
        border: `1px solid rgba(${pRgb},0.18)`,
        boxShadow: '0 16px 48px rgba(0,0,0,0.4)',
        backdropFilter: 'blur(24px)',
      }}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <h3 style={{ fontSize: 13, fontWeight: 700, color: darkMode ? '#fff' : '#111827' }}>Notifications</h3>
        {notifications.length > 0 && (
          <button onClick={onClear} style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>Clear all</button>
        )}
      </div>
      <div className="max-h-[320px] overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center py-8 text-slate-500">
            <Bell size={24} className="mb-2 opacity-40" />
            <p style={{ fontSize: 13 }}>No notifications yet</p>
          </div>
        ) : notifications.map(n => (
          <div key={n.id} className={`px-4 py-2.5 border-l-2 flex gap-3 items-start ${color(n.type)}`}>
            <span className="text-sm flex-shrink-0">{icon(n.type)}</span>
            <div className="flex-1 min-w-0">
              <p style={{ fontSize: 12, fontWeight: 500 }}>{n.message}</p>
              <p style={{ fontSize: 10, opacity: 0.6, marginTop: 2 }}>{new Date(n.timestamp).toLocaleTimeString()}</p>
            </div>
            <button onClick={() => onRemove(n.id)} style={{ color: '#64748b', flexShrink: 0 }}><X size={12}/></button>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ════ MAIN NAVIGATION ════ */
const Navigation = () => {
  const {
    sidebarOpen, toggleSidebarClick,
    handleSearch, handleSignOut,
    isAuthenticated, user,
    theme, primaryColor, accentColor,
  } = useDashboard();

  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Array<{
    id: string; message: string; type: 'success'|'info'|'warning'|'error'; timestamp: Date;
  }>>([]);
  const [darkMode, setDarkMode] = useState(() => (localStorage.getItem('theme') || 'dark') !== 'light');
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [hovTheme, setHovTheme] = useState(false);
  const [hovSettings, setHovSettings] = useState(false);
  const [hovLogout, setHovLogout] = useState(false);

  const pRgb     = hexRgb(primaryColor);
  const aRgb     = hexRgb(accentColor);
  const gradient = `linear-gradient(135deg,${primaryColor} 0%,${accentColor} 100%)`;

  useEffect(() => { setDarkMode(theme !== 'light'); }, [theme]);
  useEffect(() => { setIsSigningOut(false); }, [isAuthenticated]);

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
    { name:'Course Assign', Icon:UserCheck,       path:'/course-assignment',  roles:['admin'] },
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

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault(); handleSearch(searchQuery);
    setShowSearchResults(true); setShowMobileSearch(false);
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

  /* close on outside click */
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

  const isStudent = user?.role === 'student';
  const isTeacher = user?.role === 'teacher';

  /* ── Sidebar button shared style ── */
  const iconBtn = (hov: boolean, active = false, danger = false): React.CSSProperties => ({
    width: 40, height: 40, borderRadius: 14,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: active
      ? gradient
      : danger && hov
        ? 'rgba(239,68,68,0.14)'
        : hov
          ? darkMode ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.06)'
          : 'transparent',
    border: active
      ? 'none'
      : danger && hov
        ? '1px solid rgba(239,68,68,0.25)'
        : hov
          ? darkMode ? '1px solid rgba(255,255,255,0.10)' : '1px solid rgba(0,0,0,0.09)'
          : '1px solid transparent',
    boxShadow: active ? `0 4px 14px rgba(${pRgb},0.4)` : 'none',
    transition: 'all 0.2s cubic-bezier(0.34,1.25,0.64,1)',
    transform: hov ? 'scale(1.06)' : 'scale(1)',
    cursor: 'pointer',
    flexShrink: 0,
  });

  /* ════ RENDER ════ */
  return (
    <>
      {/* ══════════════════ SIDEBAR — Oval/pill icon strip ══════════════════ */}
      <aside
        className={clsx(
          'fixed top-0 left-0 h-screen flex flex-col items-center z-[100]',
          'transition-all duration-300 ease-in-out',
          'lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
        style={{
          width: 72,
          background: darkMode ? '#0d1017' : '#ffffff',
          borderRight: darkMode ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.08)',
          boxShadow: darkMode ? '4px 0 24px rgba(0,0,0,0.4)' : '4px 0 12px rgba(0,0,0,0.06)',
          fontFamily: "'Outfit', sans-serif",
          paddingBottom: 8,
          overflow: 'visible',
        }}
      >
        {/* Logo */}
        <div style={{ height: 72, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Link
            to="/dashboard"
            className="flex items-center justify-center hover:scale-110 active:scale-95"
            style={{
              width: 44, height: 44, borderRadius: 16,
              background: gradient,
              boxShadow: `0 4px 16px rgba(${pRgb},0.45)`,
              transition: 'transform 0.2s cubic-bezier(0.34,1.56,0.64,1)',
            }}
          >
            <GraduationCap size={20} color="#fff" strokeWidth={2.5} />
          </Link>
        </div>

        {/* User avatar */}
        <div style={{ paddingBottom: 8, flexShrink: 0 }}>
          <button
            onClick={() => setShowProfile(true)}
            className="relative group"
            style={{
              width: 44, height: 44, borderRadius: 16,
              background: gradient,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontWeight: 700, fontSize: 14,
              border: 'none', cursor: 'pointer',
              boxShadow: `0 2px 10px rgba(${pRgb},0.35)`,
              transition: 'transform 0.2s cubic-bezier(0.34,1.56,0.64,1)',
            }}
            onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.08)')}
            onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
          >
            {user && getInitials(user.name)}
          </button>
        </div>

        {/* Divider */}
        <div style={{ width: 32, height: 1, background: darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)', marginBottom: 8, flexShrink: 0 }} />

        {/* Nav list inside oval container */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          width: '100%',
          overflowY: 'auto',
          overflowX: 'visible',
          scrollbarWidth: 'none',
          padding: '4px 0',
        }}>
          <NavList
            navItems={navItems}
            location={location}
            darkMode={darkMode}
            pRgb={pRgb}
            gradient={gradient}
            onItemClick={() => setShowProfile(false)}
          />
        </div>

        {/* Divider */}
        <div style={{ width: 32, height: 1, background: darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)', marginTop: 4, marginBottom: 8, flexShrink: 0 }} />

        {/* Bottom actions */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, paddingBottom: 72, flexShrink: 0 }}>
          {/* Dark mode toggle */}
          <button
            onClick={() => setDarkMode(v => !v)}
            onMouseEnter={() => setHovTheme(true)}
            onMouseLeave={() => setHovTheme(false)}
            style={iconBtn(hovTheme)}
            title={darkMode ? 'Light Mode' : 'Dark Mode'}
          >
            {darkMode
              ? <Moon size={16} color={hovTheme ? '#a5b4fc' : '#64748b'} strokeWidth={2}/>
              : <Sun size={16} color={hovTheme ? '#fbbf24' : '#6b7280'} strokeWidth={2}/>}
          </button>

          {/* Settings */}
          <Link
            to="/settings"
            onClick={() => setShowProfile(false)}
            onMouseEnter={() => setHovSettings(true)}
            onMouseLeave={() => setHovSettings(false)}
            style={iconBtn(hovSettings, location.pathname === '/settings')}
            title="Settings"
          >
            <Settings size={16}
              color={location.pathname === '/settings' ? '#fff' : hovSettings ? (darkMode ? '#e2e8f0' : '#1f2937') : (darkMode ? '#64748b' : '#6b7280')}
              strokeWidth={2}
            />
          </Link>

          {/* Sign Out */}
          <button
            onClick={handleSignOutClick}
            disabled={isSigningOut}
            onMouseEnter={() => setHovLogout(true)}
            onMouseLeave={() => setHovLogout(false)}
            style={{ ...iconBtn(hovLogout, false, true), opacity: isSigningOut ? 0.6 : 1 }}
            title="Sign Out"
          >
            {isSigningOut
              ? <Loader2 size={16} color="#64748b" className="animate-spin"/>
              : <LogOut size={16} color={hovLogout ? '#f87171' : (darkMode ? '#64748b' : '#6b7280')} strokeWidth={2}/>}
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99] lg:hidden"
          onClick={toggleSidebarClick} />
      )}

      {/* ══════════════════════════════════════════════════════════
          HEADER — iDraft top navigation style
          Search | + Create | Bell | Avatar+Name | SignOut
      ══════════════════════════════════════════════════════════ */}
      <header
        className={clsx(
          'fixed top-0 right-0 z-[60]',
          'h-[72px]',
          'left-[72px] w-[calc(100%-72px)]',
          'left-0 w-full lg:left-[72px] lg:w-[calc(100%-72px)]',
          'flex items-center',
          'transition-all duration-300',
        )}
        style={{
          background: darkMode ? 'rgba(13,16,26,0.97)' : 'rgba(248,249,252,0.97)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: darkMode ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.08)',
          boxShadow: darkMode ? '0 2px 16px rgba(0,0,0,0.3)' : '0 2px 12px rgba(0,0,0,0.06)',
          fontFamily: "'Outfit', sans-serif",
        }}
      >
        {/* Mobile header */}
        <div className="lg:hidden relative w-full flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            {isAuthenticated && (
              <button
                onClick={toggleSidebarClick}
                style={{
                  width: 40, height: 40, borderRadius: 12,
                  background: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                  border: darkMode ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <HamburgerMenuIcon state={sidebarOpen ? 'open' : 'closed'} size={36}
                  style={{ color: darkMode ? '#94a3b8' : '#6b7280' }} />
              </button>
            )}
          </div>
          {/* Center logo */}
          <div style={{
            position: 'absolute', left: '50%', top: '50%',
            transform: 'translate(-50%,-50%)',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <div style={{
              width: 34, height: 34, borderRadius: 12,
              background: gradient, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <GraduationCap size={16} color="#fff" strokeWidth={2.5}/>
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: darkMode ? '#fff' : '#111827' }}>EduPlatform</span>
          </div>
          {isAuthenticated && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowMobileSearch(true)}
                style={{
                  width: 40, height: 40, borderRadius: 12,
                  background: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                  border: darkMode ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                }}
              >
                <Search size={16} color={darkMode ? '#94a3b8' : '#6b7280'} />
              </button>
              <div className="relative">
                <button
                  onClick={() => setShowNotifications(v => !v)}
                  className="notif-btn"
                  style={{
                    width: 40, height: 40, borderRadius: 12,
                    background: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                    border: darkMode ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', position: 'relative',
                  }}
                >
                  <Bell size={16} color={darkMode ? '#94a3b8' : '#6b7280'} />
                  {notifications.length > 0 && (
                    <span style={{
                      position: 'absolute', top: 6, right: 6,
                      width: 8, height: 8, borderRadius: '50%',
                      background: gradient,
                    }} />
                  )}
                </button>
                {showNotifications && (
                  <NotifDropdown pos="mobile" darkMode={darkMode} pRgb={pRgb}
                    notifications={notifications} onClear={() => setNotifications([])}
                    onRemove={id => setNotifications(p => p.filter(n => n.id !== id))}
                  />
                )}
              </div>
              <button
                onClick={() => setShowProfile(true)}
                style={{
                  width: 36, height: 36, borderRadius: 12,
                  background: gradient, color: '#fff',
                  fontWeight: 700, fontSize: 13,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: 'none', cursor: 'pointer',
                }}
              >
                {user && getInitials(user.name)}
              </button>
            </div>
          )}
        </div>

        {/* Desktop header */}
        <div className="hidden lg:flex items-center justify-between w-full px-6 gap-4">
          {/* Search — pill style like iDraft */}
          {isAuthenticated && (
            <div className="relative flex-1 max-w-[520px]">
              <form onSubmit={handleSearchSubmit} className="relative search-input-wrap">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => { setSearchQuery(e.target.value); if (!e.target.value) setShowSearchResults(false); }}
                  placeholder="Search courses, content..."
                  style={{
                    width: '100%', height: 42,
                    borderRadius: 999,
                    background: darkMode ? 'rgba(255,255,255,0.06)' : '#ffffff',
                    border: darkMode ? '1px solid rgba(255,255,255,0.10)' : '1px solid rgba(0,0,0,0.10)',
                    paddingLeft: 44, paddingRight: 16,
                    fontSize: 13, fontWeight: 500,
                    color: darkMode ? '#f1f5f9' : '#111827',
                    fontFamily: "'Outfit',sans-serif",
                    outline: 'none',
                    boxShadow: darkMode ? 'none' : '0 1px 4px rgba(0,0,0,0.06)',
                    transition: 'all 0.2s ease',
                  }}
                  onFocus={e => {
                    e.currentTarget.style.borderColor = `rgba(${pRgb},0.5)`;
                    e.currentTarget.style.boxShadow = `0 0 0 3px rgba(${pRgb},0.12)`;
                  }}
                  onBlur={e => {
                    e.currentTarget.style.borderColor = darkMode ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)';
                    e.currentTarget.style.boxShadow = darkMode ? 'none' : '0 1px 4px rgba(0,0,0,0.06)';
                  }}
                />
                <Search size={15} style={{
                  position: 'absolute', left: 16, top: '50%',
                  transform: 'translateY(-50%)',
                  color: darkMode ? '#475569' : '#9ca3af',
                  pointerEvents: 'none',
                }} />
                {showSearchResults && searchQuery && (
                  <div className="search-results absolute top-full left-0 right-0 mt-2 rounded-2xl overflow-hidden z-50"
                    style={{
                      background: darkMode ? '#0d1017' : '#ffffff',
                      border: `1px solid rgba(${pRgb},0.2)`,
                      boxShadow: '0 16px 40px rgba(0,0,0,0.28)',
                    }}
                  >
                    <div style={{ padding: '8px 12px', borderBottom: darkMode ? '1px solid rgba(255,255,255,0.06)' : '1px solid #f3f4f6' }}>
                      <p style={{ fontSize: 11, color: '#64748b' }}>Results for <strong style={{ color: darkMode ? '#fff' : primaryColor }}>"{searchQuery}"</strong></p>
                    </div>
                    {(isStudent ? ['Student Dashboard','Content Library','My Progress'] :
                      isTeacher ? ['Teacher Dashboard','Content Upload','Study Plans'] :
                      ['Content Library','My Courses','Analytics']
                    ).map(r => (
                      <button key={r}
                        style={{
                          display: 'block', width: '100%', textAlign: 'left',
                          padding: '10px 16px', fontSize: 13, fontWeight: 500,
                          color: darkMode ? '#e2e8f0' : '#111827',
                          background: 'transparent',
                          border: 'none',
                          borderBottom: darkMode ? '1px solid rgba(255,255,255,0.04)' : '1px solid #f9fafb',
                          cursor: 'pointer', fontFamily: "'Outfit',sans-serif",
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = darkMode ? `rgba(${pRgb},0.09)` : `rgba(${pRgb},0.05)`; e.currentTarget.style.paddingLeft = '20px'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.paddingLeft = '16px'; }}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                )}
              </form>
            </div>
          )}

          {/* Right buttons */}
          {isAuthenticated && (
            <div className="flex items-center gap-2.5 flex-shrink-0">

              {/* + Create button */}
              <button
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '0 18px', height: 40, borderRadius: 999,
                  background: gradient,
                  color: '#fff', fontSize: 13, fontWeight: 700,
                  border: 'none', cursor: 'pointer',
                  boxShadow: `0 3px 12px rgba(${pRgb},0.4)`,
                  fontFamily: "'Outfit',sans-serif",
                  transition: 'all 0.2s cubic-bezier(0.34,1.25,0.64,1)',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.05)'; e.currentTarget.style.boxShadow = `0 6px 20px rgba(${pRgb},0.55)`; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = `0 3px 12px rgba(${pRgb},0.4)`; }}
              >
                <Plus size={15} strokeWidth={2.5} />
                Create
              </button>

              {/* Bell */}
              <div className="relative">
                <button
                  onClick={() => setShowNotifications(v => !v)}
                  className="notif-btn"
                  style={{
                    width: 40, height: 40, borderRadius: 999,
                    background: darkMode ? 'rgba(255,255,255,0.06)' : '#ffffff',
                    border: darkMode ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.10)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', position: 'relative',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = darkMode ? `rgba(${pRgb},0.12)` : `rgba(${pRgb},0.07)`; e.currentTarget.style.borderColor = `rgba(${pRgb},0.25)`; }}
                  onMouseLeave={e => { e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.06)' : '#ffffff'; e.currentTarget.style.borderColor = darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.10)'; }}
                >
                  <Bell size={17} color={darkMode ? '#94a3b8' : '#6b7280'} strokeWidth={2} />
                  {notifications.length > 0 && (
                    <span style={{
                      position: 'absolute', top: 8, right: 8,
                      width: 7, height: 7, borderRadius: '50%',
                      background: gradient,
                      boxShadow: `0 0 6px rgba(${pRgb},0.8)`,
                    }} />
                  )}
                </button>
                {showNotifications && (
                  <NotifDropdown pos="desktop" darkMode={darkMode} pRgb={pRgb}
                    notifications={notifications} onClear={() => setNotifications([])}
                    onRemove={id => setNotifications(p => p.filter(n => n.id !== id))}
                  />
                )}
              </div>

              {/* Profile chip — avatar + full name */}
              <button
                onClick={() => setShowProfile(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '5px 14px 5px 5px', borderRadius: 999,
                  background: darkMode ? 'rgba(255,255,255,0.07)' : '#ffffff',
                  border: darkMode ? '1px solid rgba(255,255,255,0.10)' : '1px solid rgba(0,0,0,0.10)',
                  cursor: 'pointer',
                  boxShadow: darkMode ? 'none' : '0 1px 4px rgba(0,0,0,0.08)',
                  transition: 'all 0.2s ease',
                  fontFamily: "'Outfit',sans-serif",
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = `rgba(${pRgb},0.3)`; e.currentTarget.style.transform = 'scale(1.02)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = darkMode ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'; e.currentTarget.style.transform = 'scale(1)'; }}
              >
                <div style={{
                  width: 30, height: 30, borderRadius: '50%',
                  background: gradient, color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: 12, flexShrink: 0,
                }}>
                  {user && getInitials(user.name)}
                </div>
                <span style={{
                  fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
                  maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis',
                  color: darkMode ? '#e2e8f0' : '#111827',
                }}>
                  {user?.name}
                </span>
              </button>

              {/* Sign out */}
              <button
                onClick={handleSignOutClick}
                disabled={isSigningOut}
                title="Sign Out"
                style={{
                  width: 40, height: 40, borderRadius: 999,
                  background: darkMode ? 'rgba(255,255,255,0.06)' : '#ffffff',
                  border: darkMode ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.10)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', opacity: isSigningOut ? 0.6 : 1,
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.12)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.25)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.06)' : '#ffffff'; e.currentTarget.style.borderColor = darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.10)'; }}
              >
                {isSigningOut
                  ? <Loader2 size={16} color="#64748b" className="animate-spin"/>
                  : <LogOut size={16} color={darkMode ? '#64748b' : '#9ca3af'} strokeWidth={2}/>
                }
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Mobile search modal */}
      {showMobileSearch && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[90] lg:hidden"
          onClick={() => setShowMobileSearch(false)}>
          <div className="absolute top-0 left-0 right-0 px-4 py-4"
            style={{
              background: darkMode ? 'rgba(13,16,26,0.98)' : 'rgba(248,249,252,0.98)',
              borderBottom: darkMode ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.08)',
            }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <form onSubmit={handleSearchSubmit} className="flex-1">
                <div className="relative">
                  <input type="text" value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search..." autoFocus
                    style={{
                      width: '100%', height: 44, borderRadius: 999,
                      background: darkMode ? 'rgba(255,255,255,0.07)' : '#ffffff',
                      border: `1px solid rgba(${pRgb},0.3)`,
                      paddingLeft: 44, paddingRight: 16,
                      color: darkMode ? '#f1f5f9' : '#111827', fontSize: 14,
                      fontFamily: "'Outfit',sans-serif", outline: 'none',
                      boxShadow: `0 0 0 3px rgba(${pRgb},0.12)`,
                    }}
                  />
                  <Search size={15} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: '#64748b', pointerEvents: 'none' }}/>
                </div>
              </form>
              <button onClick={() => setShowMobileSearch(false)}
                style={{
                  width: 44, height: 44, borderRadius: 999, flexShrink: 0,
                  background: darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)',
                  border: darkMode ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.09)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                }}
              >
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
        @keyframes notif-in {
          from { opacity:0; transform:translateY(-6px) scale(0.97); }
          to   { opacity:1; transform:translateY(0) scale(1); }
        }
        .notif-dropdown { animation: notif-in 0.18s cubic-bezier(0.34,1.2,0.64,1) forwards; }
        .nav-item-oval { outline: none; text-decoration: none; }
        @media (prefers-reduced-motion:reduce) {
          *, *::before, *::after { animation-duration:.01ms!important; transition-duration:.01ms!important; }
        }
      `}</style>
    </>
  );
};

export default Navigation;
