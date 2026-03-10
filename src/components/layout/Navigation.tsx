/* Navigation.tsx — iDraft-style: rounded sidebar with labels + transparent hide-on-scroll header */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Bell, Search, LogOut, X,
  LayoutDashboard, Users, Upload, Calendar, Medal, BarChart3, Settings, Clock,
  CreditCard, Library, GraduationCap, BookOpen, ShoppingCart, Trophy,
  Ticket, PlusCircle, Megaphone, FileText, MessageSquare, Sun, Moon, Loader2,
  ClipboardCheck, UserCheck, ListOrdered, Plus, ChevronRight,
} from 'lucide-react';
import { useDashboard } from '../../contexts/DashboardContext';
import Profile from '../profile/Profile';
import HamburgerMenuIcon from '../ui/HamburgerMenuIcon';
import clsx from 'clsx';

const hexRgb = (hex: string) => {
  if (!hex || hex.length < 7) return '99,102,241';
  return `${parseInt(hex.slice(1,3),16)},${parseInt(hex.slice(3,5),16)},${parseInt(hex.slice(5,7),16)}`;
};

/* ─── NavItem — iDraft rounded row with icon + label ─── */
interface NavItemProps {
  path: string; name: string; Icon: React.ElementType;
  isActive: boolean; darkMode: boolean;
  pRgb: string; gradient: string; lightBg: string;
  onClick: () => void;
}
const NavItem: React.FC<NavItemProps> = ({ path, name, Icon, isActive, darkMode, pRgb, gradient, lightBg, onClick }) => {
  const [hov, setHov] = useState(false);
  return (
    <Link
      to={path} onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '9px 12px',
        borderRadius: 12,
        textDecoration: 'none',
        transition: 'all 0.18s cubic-bezier(0.34,1.25,0.64,1)',
        background: isActive
          ? darkMode ? `rgba(${pRgb},0.15)` : `rgba(${pRgb},0.10)`
          : hov
            ? darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'
            : 'transparent',
        border: isActive
          ? `1px solid rgba(${pRgb},0.22)`
          : '1px solid transparent',
        transform: hov && !isActive ? 'translateX(2px)' : 'none',
      }}
    >
      {/* Icon bubble */}
      <span style={{
        width: 32, height: 32, borderRadius: 10, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: isActive ? gradient : hov
          ? darkMode ? `rgba(${pRgb},0.15)` : `rgba(${pRgb},0.10)`
          : darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)',
        boxShadow: isActive ? `0 3px 10px rgba(${pRgb},0.35)` : 'none',
        transition: 'all 0.18s ease',
      }}>
        <Icon size={15} strokeWidth={isActive ? 2.5 : 2} style={{
          color: isActive ? '#fff' : hov
            ? darkMode ? `rgb(${pRgb})` : `rgb(${pRgb})`
            : darkMode ? '#64748b' : '#6b7280',
          transition: 'color 0.15s ease',
        }} />
      </span>
      {/* Label */}
      <span style={{
        fontSize: 13, fontWeight: isActive ? 700 : hov ? 600 : 500, flex: 1,
        color: isActive
          ? darkMode ? `rgb(${pRgb})` : `rgb(${pRgb})`
          : hov
            ? darkMode ? '#e2e8f0' : '#1f2937'
            : darkMode ? '#94a3b8' : '#6b7280',
        transition: 'color 0.15s ease',
        letterSpacing: isActive ? '0.01em' : 0,
      }}>
        {name}
      </span>
      {isActive && <ChevronRight size={13} style={{ color: `rgba(${pRgb},0.5)`, flexShrink: 0 }} />}
    </Link>
  );
};

/* ─── Notif Dropdown ─── */
const NotifDropdown: React.FC<{
  darkMode: boolean; pRgb: string; lightBg: string;
  notifications: Array<{ id: string; message: string; type: string; timestamp: Date }>;
  onClear: () => void; onRemove: (id: string) => void;
}> = ({ darkMode, pRgb, lightBg, notifications, onClear, onRemove }) => (
  <div className="notif-dropdown absolute top-full right-0 mt-2 w-[340px] rounded-2xl overflow-hidden z-[200]"
    style={{
      background: darkMode ? '#0d1017' : '#ffffff',
      border: `1px solid rgba(${pRgb},0.18)`,
      boxShadow: '0 16px 48px rgba(0,0,0,0.28)',
    }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: darkMode ? '1px solid rgba(255,255,255,0.06)' : '1px solid #f3f4f6' }}>
      <h3 style={{ fontSize: 13, fontWeight: 700, color: darkMode ? '#fff' : '#111827' }}>Notifications</h3>
      {notifications.length > 0 && <button onClick={onClear} style={{ fontSize: 11, fontWeight: 600, color: '#64748b', background: 'none', border: 'none', cursor: 'pointer' }}>Clear all</button>}
    </div>
    <div style={{ maxHeight: 300, overflowY: 'auto' }}>
      {notifications.length === 0
        ? <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '28px 0', color: '#64748b' }}>
            <Bell size={22} style={{ marginBottom: 6, opacity: 0.4 }} />
            <p style={{ fontSize: 13 }}>No notifications yet</p>
          </div>
        : notifications.map(n => (
            <div key={n.id} style={{ display: 'flex', gap: 10, padding: '10px 16px', alignItems: 'flex-start', borderBottom: darkMode ? '1px solid rgba(255,255,255,0.04)' : '1px solid #f9fafb' }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 12, color: darkMode ? '#e2e8f0' : '#111827' }}>{n.message}</p>
                <p style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>{new Date(n.timestamp).toLocaleTimeString()}</p>
              </div>
              <button onClick={() => onRemove(n.id)} style={{ color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}><X size={12}/></button>
            </div>
          ))
      }
    </div>
  </div>
);

/* ════ MAIN NAVIGATION ════ */
const Navigation = () => {
  const {
    sidebarOpen, toggleSidebarClick,
    handleSearch, handleSignOut,
    isAuthenticated, user,
    theme, setTheme,
    primaryColor, accentColor,
  } = useDashboard();

  const location = useLocation();
  const [showProfile, setShowProfile] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Array<{ id: string; message: string; type: 'success'|'info'|'warning'|'error'; timestamp: Date }>>([]);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [hovTheme, setHovTheme] = useState(false);
  const [hovLogout, setHovLogout] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  /* Header hide-on-scroll */
  const [headerVisible, setHeaderVisible] = useState(true);
  const lastScrollY = useRef(0);
  useEffect(() => {
    const el = document.querySelector('.dl-main');
    if (!el) return;
    const onScroll = () => {
      const y = el.scrollTop;
      setHeaderVisible(y <= 10 || y < lastScrollY.current);
      lastScrollY.current = y;
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  const darkMode = theme !== 'light';
  const lightBg = '#f1eee7';
  const pRgb = hexRgb(primaryColor);
  const aRgb = hexRgb(accentColor);
  const gradient = `linear-gradient(135deg,${primaryColor} 0%,${accentColor} 100%)`;

  useEffect(() => { setIsSigningOut(false); }, [isAuthenticated]);

  const NAV_ALL = [
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
  const navItems = NAV_ALL.filter(i => user && i.roles.includes(user.role));

  const getInitials = (name: string) => {
    const p = name.trim().split(' ');
    return p.length === 1 ? p[0][0].toUpperCase() : (p[0][0]+p[p.length-1][0]).toUpperCase();
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

  useEffect(() => {
    const h = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest('.notif-dropdown') && !t.closest('.notif-btn')) setShowNotifications(false);
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

  /* Shared round button style for header */
  const roundBtn = (hov: boolean, danger = false): React.CSSProperties => ({
    width: 38, height: 38, borderRadius: 999,
    background: danger && hov
      ? 'rgba(239,68,68,0.12)'
      : hov
        ? darkMode ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.07)'
        : 'transparent',
    border: danger && hov
      ? '1px solid rgba(239,68,68,0.22)'
      : hov
        ? darkMode ? '1px solid rgba(255,255,255,0.10)' : '1px solid rgba(0,0,0,0.10)'
        : '1px solid transparent',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', transition: 'all 0.18s ease',
    transform: hov ? 'scale(1.08)' : 'scale(1)',
    flexShrink: 0,
  });

  /* ════════════════════════ RENDER ════════════════════════ */
  return (
    <>
      {/* ══════════════════════════════════════════
          SIDEBAR — iDraft rounded panel style
      ══════════════════════════════════════════ */}
      <aside
        className={clsx(
          'fixed top-0 left-0 h-screen z-[100] flex flex-col',
          'transition-transform duration-300 ease-[cubic-bezier(0.34,1.25,0.64,1)]',
          'lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
        style={{
          width: 220,
          background: darkMode ? '#0d1017' : '#ffffff',
          borderRight: darkMode ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.07)',
          boxShadow: sidebarOpen ? (darkMode ? '8px 0 32px rgba(0,0,0,0.5)' : '8px 0 24px rgba(0,0,0,0.10)') : 'none',
          fontFamily: "'Outfit', sans-serif",
          padding: '0 12px 12px',
          overflow: 'hidden',
        }}
      >
        {/* ── Logo row ── */}
        <div style={{ height: 72, display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, paddingLeft: 4 }}>
          <Link to="/dashboard" style={{
            width: 38, height: 38, borderRadius: 12,
            background: gradient,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 4px 14px rgba(${pRgb},0.4)`,
            flexShrink: 0,
            transition: 'transform 0.2s cubic-bezier(0.34,1.56,0.64,1)',
          }}
            onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.08)')}
            onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
          >
            <GraduationCap size={18} color="#fff" strokeWidth={2.5} />
          </Link>
          <span style={{ fontSize: 15, fontWeight: 800, color: darkMode ? '#fff' : '#111827', letterSpacing: '-0.02em' }}>
            EduPlatform
          </span>
        </div>

        {/* ── User profile chip ── */}
        <button onClick={() => setShowProfile(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 10px', borderRadius: 14, width: '100%',
            background: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
            border: darkMode ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(0,0,0,0.07)',
            cursor: 'pointer', marginBottom: 8, flexShrink: 0,
            transition: 'all 0.18s ease',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = darkMode ? `rgba(${pRgb},0.12)` : `rgba(${pRgb},0.08)`; e.currentTarget.style.borderColor = `rgba(${pRgb},0.25)`; }}
          onMouseLeave={e => { e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'; e.currentTarget.style.borderColor = darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'; }}
        >
          <div style={{
            width: 32, height: 32, borderRadius: 10, flexShrink: 0,
            background: gradient, color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: 12,
          }}>
            {user && getInitials(user.name)}
          </div>
          <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: darkMode ? '#fff' : '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>
              {user?.name}
            </p>
            <p style={{ fontSize: 10, fontWeight: 600, color: primaryColor, textTransform: 'capitalize', margin: 0 }}>
              {user?.role}
            </p>
          </div>
        </button>

        {/* ── Divider ── */}
        <div style={{ height: 1, background: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)', margin: '0 0 8px', flexShrink: 0 }} />

        {/* ── Nav items — iDraft rounded rows ── */}
        <nav style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', scrollbarWidth: 'none', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {navItems.map(item => (
            <NavItem
              key={item.path}
              path={item.path} name={item.name} Icon={item.Icon}
              isActive={location.pathname === item.path}
              darkMode={darkMode} pRgb={pRgb} gradient={gradient} lightBg={lightBg}
              onClick={() => setShowProfile(false)}
            />
          ))}
        </nav>

        {/* ── Divider ── */}
        <div style={{ height: 1, background: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)', margin: '8px 0', flexShrink: 0 }} />

        {/* ── Bottom actions ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
          {/* Theme toggle */}
          <button
            onClick={() => setTheme(darkMode ? 'light' : 'dark')}
            onMouseEnter={() => setHovTheme(true)}
            onMouseLeave={() => setHovTheme(false)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 12px', borderRadius: 12, width: '100%',
              background: hovTheme ? (darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)') : 'transparent',
              border: '1px solid transparent',
              cursor: 'pointer', transition: 'all 0.18s ease',
              transform: hovTheme ? 'translateX(2px)' : 'none',
            }}
          >
            <span style={{
              width: 32, height: 32, borderRadius: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)',
            }}>
              {darkMode
                ? <Sun size={15} color={hovTheme ? '#fbbf24' : '#64748b'} />
                : <Moon size={15} color={hovTheme ? '#a5b4fc' : '#6b7280'} />}
            </span>
            <span style={{ fontSize: 13, fontWeight: 500, color: darkMode ? '#94a3b8' : '#6b7280' }}>
              {darkMode ? 'Light Mode' : 'Dark Mode'}
            </span>
          </button>

          {/* Settings */}
          <Link to="/settings" onClick={() => setShowProfile(false)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 12px', borderRadius: 12,
              background: location.pathname === '/settings'
                ? darkMode ? `rgba(${pRgb},0.15)` : `rgba(${pRgb},0.10)`
                : 'transparent',
              border: location.pathname === '/settings' ? `1px solid rgba(${pRgb},0.22)` : '1px solid transparent',
              textDecoration: 'none', transition: 'all 0.18s ease',
            }}
            onMouseEnter={e => { if (location.pathname !== '/settings') { e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'; e.currentTarget.style.transform = 'translateX(2px)'; } }}
            onMouseLeave={e => { if (location.pathname !== '/settings') { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.transform = 'none'; } }}
          >
            <span style={{
              width: 32, height: 32, borderRadius: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: location.pathname === '/settings' ? gradient : (darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)'),
              boxShadow: location.pathname === '/settings' ? `0 3px 10px rgba(${pRgb},0.35)` : 'none',
            }}>
              <Settings size={15} color={location.pathname === '/settings' ? '#fff' : (darkMode ? '#64748b' : '#6b7280')} />
            </span>
            <span style={{ fontSize: 13, fontWeight: location.pathname === '/settings' ? 700 : 500, color: location.pathname === '/settings' ? `rgb(${pRgb})` : (darkMode ? '#94a3b8' : '#6b7280') }}>
              Settings
            </span>
          </Link>

          {/* Sign out */}
          <button onClick={handleSignOutClick} disabled={isSigningOut}
            onMouseEnter={() => setHovLogout(true)}
            onMouseLeave={() => setHovLogout(false)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 12px', borderRadius: 12, width: '100%',
              background: hovLogout ? 'rgba(239,68,68,0.09)' : 'transparent',
              border: hovLogout ? '1px solid rgba(239,68,68,0.18)' : '1px solid transparent',
              cursor: 'pointer', opacity: isSigningOut ? 0.6 : 1,
              transition: 'all 0.18s ease',
              transform: hovLogout ? 'translateX(2px)' : 'none',
            }}
          >
            <span style={{
              width: 32, height: 32, borderRadius: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: hovLogout ? 'rgba(239,68,68,0.14)' : (darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)'),
            }}>
              {isSigningOut
                ? <Loader2 size={15} color="#64748b" className="animate-spin"/>
                : <LogOut size={15} color={hovLogout ? '#f87171' : (darkMode ? '#64748b' : '#6b7280')} />}
            </span>
            <span style={{ fontSize: 13, fontWeight: 500, color: hovLogout ? '#f87171' : (darkMode ? '#94a3b8' : '#6b7280') }}>
              Sign Out
            </span>
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99] lg:hidden"
          onClick={toggleSidebarClick} />
      )}

      {/* ══════════════════════════════════════════════════════════
          HEADER — transparent, hides on scroll
          Buttons only: search icon | +Create | bell | avatar | logout
      ══════════════════════════════════════════════════════════ */}
      <header
        style={{
          position: 'fixed', top: 0, right: 0, zIndex: 60,
          left: 220, width: 'calc(100% - 220px)',
          height: 68,
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
          padding: '0 24px',
          gap: 8,
          /* Transparent — blends with page background */
          background: 'transparent',
          backdropFilter: 'none',
          border: 'none',
          boxShadow: 'none',
          fontFamily: "'Outfit', sans-serif",
          transition: 'transform 0.28s cubic-bezier(0.34,1.25,0.64,1), opacity 0.22s ease',
          transform: headerVisible ? 'translateY(0)' : 'translateY(-100%)',
          opacity: headerVisible ? 1 : 0,
          pointerEvents: headerVisible ? 'auto' : 'none',
        }}
        className="hidden lg:flex"
      >
        {isAuthenticated && (
          <>
            {/* Search — icon button only */}
            {(() => {
              const [hov, setHov] = useState(false);
              return (
                <button
                  onMouseEnter={() => setHov(true)}
                  onMouseLeave={() => setHov(false)}
                  onClick={() => setShowMobileSearch(true)}
                  style={roundBtn(hov)}
                >
                  <Search size={16} color={darkMode ? '#94a3b8' : '#6b7280'} />
                </button>
              );
            })()}

            {/* + Create */}
            {(() => {
              const [hov, setHov] = useState(false);
              return (
                <button
                  onMouseEnter={() => setHov(true)}
                  onMouseLeave={() => setHov(false)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '0 16px', height: 38, borderRadius: 999,
                    background: gradient, color: '#fff',
                    fontSize: 13, fontWeight: 700,
                    border: 'none', cursor: 'pointer',
                    boxShadow: hov ? `0 6px 20px rgba(${pRgb},0.5)` : `0 3px 12px rgba(${pRgb},0.35)`,
                    transform: hov ? 'scale(1.05)' : 'scale(1)',
                    transition: 'all 0.18s cubic-bezier(0.34,1.25,0.64,1)',
                    fontFamily: "'Outfit',sans-serif",
                  }}
                >
                  <Plus size={14} strokeWidth={2.5} />
                  Create
                </button>
              );
            })()}

            {/* Bell */}
            <div className="relative">
              {(() => {
                const [hov, setHov] = useState(false);
                return (
                  <button
                    onMouseEnter={() => setHov(true)}
                    onMouseLeave={() => setHov(false)}
                    onClick={() => setShowNotifications(v => !v)}
                    className="notif-btn"
                    style={{ ...roundBtn(hov), position: 'relative' }}
                  >
                    <Bell size={16} color={darkMode ? '#94a3b8' : '#6b7280'} />
                    {notifications.length > 0 && (
                      <span style={{
                        position: 'absolute', top: 7, right: 7,
                        width: 7, height: 7, borderRadius: '50%',
                        background: gradient, boxShadow: `0 0 6px rgba(${pRgb},0.8)`,
                      }} />
                    )}
                  </button>
                );
              })()}
              {showNotifications && (
                <NotifDropdown darkMode={darkMode} pRgb={pRgb} lightBg={lightBg}
                  notifications={notifications} onClear={() => setNotifications([])}
                  onRemove={id => setNotifications(p => p.filter(n => n.id !== id))}
                />
              )}
            </div>

            {/* Avatar + Name pill */}
            {(() => {
              const [hov, setHov] = useState(false);
              return (
                <button
                  onMouseEnter={() => setHov(true)}
                  onMouseLeave={() => setHov(false)}
                  onClick={() => setShowProfile(true)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '4px 12px 4px 4px', borderRadius: 999,
                    background: hov
                      ? darkMode ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.07)'
                      : darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.85)',
                    border: hov
                      ? `1px solid rgba(${pRgb},0.3)`
                      : darkMode ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.09)',
                    cursor: 'pointer',
                    boxShadow: darkMode ? 'none' : '0 1px 4px rgba(0,0,0,0.06)',
                    transform: hov ? 'scale(1.03)' : 'scale(1)',
                    transition: 'all 0.18s ease',
                    fontFamily: "'Outfit',sans-serif",
                  }}
                >
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: gradient, color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: 11, flexShrink: 0,
                  }}>
                    {user && getInitials(user.name)}
                  </div>
                  <span style={{
                    fontSize: 13, fontWeight: 600,
                    color: darkMode ? '#e2e8f0' : '#111827',
                    whiteSpace: 'nowrap', maxWidth: 160,
                    overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {user?.name}
                  </span>
                </button>
              );
            })()}

            {/* Logout */}
            {(() => {
              const [hov, setHov] = useState(false);
              return (
                <button
                  onMouseEnter={() => setHov(true)}
                  onMouseLeave={() => setHov(false)}
                  onClick={handleSignOutClick}
                  disabled={isSigningOut}
                  style={{ ...roundBtn(hov, true), opacity: isSigningOut ? 0.6 : 1 }}
                  title="Sign Out"
                >
                  {isSigningOut
                    ? <Loader2 size={15} color="#64748b" className="animate-spin"/>
                    : <LogOut size={15} color={hov ? '#f87171' : (darkMode ? '#64748b' : '#9ca3af')} />}
                </button>
              );
            })()}
          </>
        )}
      </header>

      {/* Mobile header */}
      <header
        className="lg:hidden fixed top-0 left-0 right-0 z-[60] flex items-center justify-between px-4"
        style={{
          height: 64,
          background: 'transparent',
          fontFamily: "'Outfit', sans-serif",
          transition: 'transform 0.28s cubic-bezier(0.34,1.25,0.64,1)',
          transform: headerVisible ? 'translateY(0)' : 'translateY(-100%)',
        }}
      >
        <button onClick={toggleSidebarClick} style={{
          width: 38, height: 38, borderRadius: 12,
          background: darkMode ? 'rgba(13,16,26,0.8)' : 'rgba(255,255,255,0.85)',
          border: darkMode ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.09)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          backdropFilter: 'blur(12px)',
        }}>
          <HamburgerMenuIcon state={sidebarOpen ? 'open' : 'closed'} size={34}
            style={{ color: darkMode ? '#94a3b8' : '#6b7280' }} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: gradient, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <GraduationCap size={15} color="#fff" strokeWidth={2.5}/>
          </div>
          <span style={{ fontSize: 14, fontWeight: 800, color: darkMode ? '#fff' : '#111827' }}>EduPlatform</span>
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => setShowMobileSearch(true)} style={{
            width: 38, height: 38, borderRadius: 12,
            background: darkMode ? 'rgba(13,16,26,0.8)' : 'rgba(255,255,255,0.85)',
            border: darkMode ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.09)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            backdropFilter: 'blur(12px)',
          }}>
            <Search size={15} color={darkMode ? '#94a3b8' : '#6b7280'} />
          </button>
          <button onClick={() => setShowProfile(true)} style={{
            width: 38, height: 38, borderRadius: 12,
            background: gradient, color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 12,
          }}>
            {user && getInitials(user.name)}
          </button>
        </div>
      </header>

      {/* Search modal */}
      {showMobileSearch && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-md z-[90]" onClick={() => setShowMobileSearch(false)}>
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0,
            padding: 16,
            background: darkMode ? 'rgba(13,16,26,0.98)' : 'rgba(255,255,255,0.98)',
            backdropFilter: 'blur(20px)',
            borderBottom: darkMode ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.08)',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search courses, content..." autoFocus
                  style={{
                    width: '100%', height: 44, borderRadius: 999,
                    background: darkMode ? 'rgba(255,255,255,0.07)' : '#f3f4f6',
                    border: `1px solid rgba(${pRgb},0.3)`,
                    paddingLeft: 44, paddingRight: 16,
                    color: darkMode ? '#f1f5f9' : '#111827', fontSize: 14,
                    fontFamily: "'Outfit',sans-serif", outline: 'none',
                    boxShadow: `0 0 0 3px rgba(${pRgb},0.10)`,
                  }}
                />
                <Search size={15} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: '#64748b', pointerEvents: 'none' }}/>
              </div>
              <button onClick={() => setShowMobileSearch(false)} style={{
                width: 44, height: 44, borderRadius: 999, flexShrink: 0,
                background: darkMode ? 'rgba(255,255,255,0.07)' : '#f3f4f6',
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
        @keyframes notif-in {
          from { opacity:0; transform:translateY(-6px) scale(0.97); }
          to   { opacity:1; transform:translateY(0) scale(1); }
        }
        .notif-dropdown { animation: notif-in 0.18s cubic-bezier(0.34,1.2,0.64,1) forwards; }
      `}</style>
    </>
  );
};

export default Navigation;
