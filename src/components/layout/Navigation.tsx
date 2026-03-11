/* Navigation.tsx
   — Solid frosted header (never transparent) — no overlap
   — Auto-hide sidebar: collapsed (64px icons) on desktop, expands on hover
   — Mobile: slide-in drawer + fixed top bar
   — Fluid spring animations throughout
*/
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

/* ── Notif Dropdown ── */
const NotifDropdown: React.FC<{
  darkMode: boolean; pRgb: string;
  notifications: Array<{ id: string; message: string; type: string; timestamp: Date }>;
  onClear: () => void; onRemove: (id: string) => void;
}> = ({ darkMode, pRgb, notifications, onClear, onRemove }) => (
  <div className="notif-dropdown absolute top-full right-0 mt-2 rounded-2xl overflow-hidden z-[200]"
    style={{
      width: 320,
      background: darkMode ? '#0f1117' : '#ffffff',
      border: `1px solid rgba(${pRgb},0.18)`,
      boxShadow: '0 16px 48px rgba(0,0,0,0.28)',
    }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: darkMode ? '1px solid rgba(255,255,255,0.06)' : '1px solid #f0f0f0' }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: darkMode ? '#fff' : '#111827' }}>Notifications</span>
      {notifications.length > 0 && <button onClick={onClear} style={{ fontSize: 11, color: '#64748b', background: 'none', border: 'none', cursor: 'pointer' }}>Clear all</button>}
    </div>
    <div style={{ maxHeight: 280, overflowY: 'auto' }}>
      {notifications.length === 0
        ? <div style={{ padding: '24px 0', textAlign: 'center', color: '#64748b', fontSize: 13 }}>No notifications</div>
        : notifications.map(n => (
          <div key={n.id} style={{ display: 'flex', gap: 10, padding: '10px 16px', borderBottom: darkMode ? '1px solid rgba(255,255,255,0.04)' : '1px solid #f9fafb' }}>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 12, color: darkMode ? '#e2e8f0' : '#111827', margin: 0 }}>{n.message}</p>
              <p style={{ fontSize: 10, color: '#64748b', margin: '2px 0 0' }}>{new Date(n.timestamp).toLocaleTimeString()}</p>
            </div>
            <button onClick={() => onRemove(n.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', flexShrink: 0 }}><X size={12}/></button>
          </div>
        ))
      }
    </div>
  </div>
);

/* ════ NAVIGATION ════ */
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
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  /* Desktop sidebar: expanded by default, collapses to icon strip on toggle */
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const sidebarHoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSidebarMouseEnter = () => {
    if (sidebarHoverTimeout.current) clearTimeout(sidebarHoverTimeout.current);
    setSidebarExpanded(true);
  };
  const handleSidebarMouseLeave = () => {
    // Don't auto-collapse — sidebar stays open unless manually toggled
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

  // Close mobile sidebar on route change
  useEffect(() => {
    if (sidebarOpen) toggleSidebarClick();
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [sidebarOpen]);

  /* ─── Sidebar bg — matte crystal frosted ─── */
  const sbBg = darkMode
    ? 'rgba(13,16,23,0.96)'
    : 'rgba(255,255,255,0.78)';
  const sbBorder = darkMode
    ? '1px solid rgba(255,255,255,0.07)'
    : '1px solid rgba(255,255,255,0.9)';
  const sbShadow = darkMode
    ? '4px 0 32px rgba(0,0,0,0.5)'
    : '4px 0 24px rgba(0,0,0,0.09), inset -1px 0 0 rgba(255,255,255,0.8)';

  /* ─── Header bg — solid frosted, never transparent ─── */
  const hdrBg = darkMode
    ? 'rgba(13,16,23,0.96)'
    : 'rgba(255,255,255,0.96)';

  return (
    <>
      {/* ══════════════════════════════════════════
          DESKTOP SIDEBAR
          Auto-collapses to 64px icons, expands on hover to 220px
      ══════════════════════════════════════════ */}
      <aside
        onMouseEnter={handleSidebarMouseEnter}
        onMouseLeave={handleSidebarMouseLeave}
        className="fixed top-0 left-0 h-screen z-[110] hidden lg:flex flex-col"
        style={{
          width: SIDEBAR_W,
          background: sbBg,
          backdropFilter: 'blur(28px) saturate(180%)',
          WebkitBackdropFilter: 'blur(28px) saturate(180%)',
          borderRight: sbBorder,
          boxShadow: sidebarExpanded ? sbShadow : 'none',
          fontFamily: "'Outfit', sans-serif",
          padding: '0 8px 12px',
          overflow: 'hidden',
          transition: 'width 0.28s cubic-bezier(0.34,1.15,0.64,1), box-shadow 0.28s ease',
        }}
      >
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
            fontWeight: 700, fontSize: 11,
          }}>
            {user && getInitials(user.name)}
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
      </aside>

      {/* ══════════════════════════════════════════
          MOBILE SIDEBAR DRAWER (slide in from left)
      ══════════════════════════════════════════ */}
      {/* Overlay */}
      {sidebarOpen && (
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
      <aside
        className="lg:hidden fixed top-0 left-0 h-screen z-[110] flex flex-col"
        style={{
          width: 240,
          background: sbBg,
          backdropFilter: 'blur(28px) saturate(180%)',
          WebkitBackdropFilter: 'blur(28px) saturate(180%)',
          borderRight: sbBorder,
          boxShadow: sidebarOpen ? sbShadow : 'none',
          fontFamily: "'Outfit', sans-serif",
          padding: '0 10px 12px',
          transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.3s cubic-bezier(0.34,1.15,0.64,1)',
          overflow: 'hidden',
        }}
      >
        {/* Mobile sidebar header */}
        <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 12, background: gradient, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 3px 12px rgba(${pRgb},0.4)` }}>
              <GraduationCap size={17} color="#fff" strokeWidth={2.5}/>
            </div>
            <span style={{ fontSize: 15, fontWeight: 800, color: darkMode ? '#fff' : '#111827', letterSpacing: '-0.02em' }}>EduPlatform</span>
          </div>
          <button onClick={toggleSidebarClick} style={{ width: 32, height: 32, borderRadius: 10, background: darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={15} color={darkMode ? '#94a3b8' : '#6b7280'}/>
          </button>
        </div>

        {/* User chip */}
        <button onClick={() => { setShowProfile(true); toggleSidebarClick(); }}
          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 12, width: '100%', marginBottom: 8, flexShrink: 0, background: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)', border: darkMode ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(0,0,0,0.07)', cursor: 'pointer', transition: 'all 0.18s ease' }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, flexShrink: 0, background: gradient, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12 }}>
            {user && getInitials(user.name)}
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
      </aside>

      {/* ══════════════════════════════════════════
          DESKTOP HEADER
          Solid frosted background — NEVER transparent
          Positioned right of the sidebar (64px gap)
      ══════════════════════════════════════════ */}
      <header
        className="hidden lg:flex fixed top-0 right-0 z-[100] items-center justify-end"
        style={{
          left: SIDEBAR_W,
          height: 64,
          padding: '0 20px',
          gap: 8,
          /* Solid frosted — no content bleed-through */
          background: hdrBg,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: darkMode ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.08)',
          boxShadow: darkMode ? '0 2px 16px rgba(0,0,0,0.3)' : '0 2px 12px rgba(0,0,0,0.07)',
          fontFamily: "'Outfit', sans-serif",
          transition: 'left 0.28s cubic-bezier(0.34,1.15,0.64,1)',
        }}
      >
        {/* Date display — left side */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: darkMode ? '#475569' : '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Today</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: darkMode ? '#e2e8f0' : '#111827', lineHeight: 1.2 }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          </span>
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

            {/* Bell */}
            <div style={{ position: 'relative' }}>
              <button onClick={() => setShowNotifications(v => !v)} className="notif-btn" style={{
                width: 38, height: 38, borderRadius: 12,
                background: 'transparent', border: '1px solid transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', position: 'relative', transition: 'all 0.18s ease',
              }}
                onMouseEnter={e => { e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'; e.currentTarget.style.borderColor = darkMode ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.09)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; }}
              >
                <Bell size={16} color={darkMode ? '#64748b' : '#9ca3af'}/>
                {notifications.length > 0 && (
                  <span style={{ position: 'absolute', top: 8, right: 8, width: 7, height: 7, borderRadius: '50%', background: gradient }} />
                )}
              </button>
              {showNotifications && (
                <NotifDropdown darkMode={darkMode} pRgb={pRgb}
                  notifications={notifications} onClear={() => setNotifications([])}
                  onRemove={id => setNotifications(p => p.filter(n => n.id !== id))}
                />
              )}
            </div>

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
              <div style={{ width: 28, height: 28, borderRadius: 8, background: gradient, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 11, flexShrink: 0 }}>
                {user && getInitials(user.name)}
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

      {/* ══════════════════════════════════════════
          MOBILE HEADER — solid, always visible
      ══════════════════════════════════════════ */}
      <header
        className="lg:hidden fixed top-0 left-0 right-0 z-[100] flex items-center justify-between"
        style={{
          height: 60,
          padding: '0 14px',
          background: hdrBg,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: darkMode ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.08)',
          boxShadow: darkMode ? '0 2px 12px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.07)',
          fontFamily: "'Outfit', sans-serif",
        }}
      >
        {/* Hamburger */}
        <button onClick={toggleSidebarClick} style={{
          width: 38, height: 38, borderRadius: 10,
          background: darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)',
          border: darkMode ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
        }}>
          <HamburgerMenuIcon state={sidebarOpen ? 'open' : 'closed'} size={32}
            style={{ color: darkMode ? '#94a3b8' : '#6b7280' }} />
        </button>

        {/* Logo center */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 30, height: 30, borderRadius: 9, background: gradient, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <GraduationCap size={14} color="#fff" strokeWidth={2.5}/>
          </div>
          <span style={{ fontSize: 14, fontWeight: 800, color: darkMode ? '#fff' : '#111827' }}>EduPlatform</span>
        </div>

        {/* Right actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button onClick={() => setShowMobileSearch(true)} style={{
            width: 36, height: 36, borderRadius: 10,
            background: darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)',
            border: darkMode ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          }}>
            <Search size={15} color={darkMode ? '#94a3b8' : '#6b7280'}/>
          </button>
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowNotifications(v => !v)} className="notif-btn" style={{
              width: 36, height: 36, borderRadius: 10,
              background: darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)',
              border: darkMode ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative',
            }}>
              <Bell size={15} color={darkMode ? '#94a3b8' : '#6b7280'}/>
              {notifications.length > 0 && <span style={{ position: 'absolute', top: 6, right: 6, width: 7, height: 7, borderRadius: '50%', background: gradient }} />}
            </button>
            {showNotifications && (
              <div style={{ position: 'fixed', top: 68, right: 12, zIndex: 200 }}>
                <NotifDropdown darkMode={darkMode} pRgb={pRgb}
                  notifications={notifications} onClear={() => setNotifications([])}
                  onRemove={id => setNotifications(p => p.filter(n => n.id !== id))}
                />
              </div>
            )}
          </div>
          <button onClick={() => setShowProfile(true)} style={{
            width: 32, height: 32, borderRadius: '50%',
            background: gradient, color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: 11, border: 'none', cursor: 'pointer',
          }}>
            {user && getInitials(user.name)}
          </button>
        </div>
      </header>

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
        @keyframes notif-in {
          from { opacity:0; transform:translateY(-6px) scale(0.97) }
          to   { opacity:1; transform:translateY(0) scale(1) }
        }
        .notif-dropdown { animation: notif-in 0.18s cubic-bezier(0.34,1.2,0.64,1) forwards; }
      `}</style>
    </>
  );
};

export default Navigation;
