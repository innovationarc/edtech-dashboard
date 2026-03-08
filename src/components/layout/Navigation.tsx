/* Navigation.tsx — iDraft Design System
   Matches the reference image exactly:
   - Light mode: pure white sidebar, white header, clean cards
   - Dark mode: near-black sidebar, dark glass header
   - Nav items: icon + label, rounded pill active state (dark chip on white bg)
   - Header: search bar left, bell + profile chip right — no color tints
*/
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Bell, Search, LogOut, X,
  LayoutDashboard, Users, Upload, Calendar, Medal, BarChart3, Settings, Clock,
  CreditCard, Library, GraduationCap, BookOpen, Brain, ShoppingCart, Trophy,
  Ticket, PlusCircle, Megaphone, FileText, MessageSquare, Sun, Moon, Loader2,
  ChevronRight, ClipboardCheck, UserCheck, ListOrdered, Menu
} from 'lucide-react';
import { useDashboard } from '../../contexts/DashboardContext';
import Profile from '../profile/Profile';
import HamburgerMenuIcon from '../ui/HamburgerMenuIcon';
import clsx from 'clsx';

const hexRgb = (hex: string) => {
  if (!hex || hex.length < 7) return '99,102,241';
  return `${parseInt(hex.slice(1,3),16)},${parseInt(hex.slice(3,5),16)},${parseInt(hex.slice(5,7),16)}`;
};

/* ─── Notification Dropdown ─── */
const NotifDropdown: React.FC<{
  pos: 'desktop'|'mobile'; darkMode: boolean;
  notifications: Array<{id:string;message:string;type:string;timestamp:Date}>;
  onClear:()=>void; onRemove:(id:string)=>void;
  notifIcon:(t:string)=>string; notifColor:(t:string)=>string;
}> = ({ pos, darkMode, notifications, onClear, onRemove, notifIcon, notifColor }) => (
  <div className="notif-dropdown absolute right-0 w-80 rounded-2xl overflow-hidden z-[200]"
    style={{
      top: pos === 'mobile' ? 72 : 52,
      background: darkMode ? '#18191f' : '#ffffff',
      border: darkMode ? '1px solid rgba(255,255,255,0.10)' : '1px solid rgba(0,0,0,0.10)',
      boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
      fontFamily: "'DM Sans', sans-serif",
    }}>
    <div className="flex items-center justify-between px-4 py-3"
      style={{ borderBottom: darkMode ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(0,0,0,0.07)' }}>
      <h3 style={{ fontSize:14, fontWeight:700, color: darkMode ? '#fff' : '#111827' }}>Notifications</h3>
      {notifications.length > 0 && (
        <button onClick={onClear} style={{ fontSize:12, fontWeight:600, color:'#6b7280' }}>Clear all</button>
      )}
    </div>
    <div className="max-h-[360px] overflow-y-auto">
      {notifications.length === 0 ? (
        <div className="flex flex-col items-center py-10" style={{ color:'#9ca3af' }}>
          <Bell size={26} className="mb-3 opacity-40" />
          <p style={{ fontSize:13 }}>No notifications yet</p>
        </div>
      ) : notifications.map(n => (
        <div key={n.id} className={`px-4 py-3 border-l-2 flex gap-3 items-start ${notifColor(n.type)}`}>
          <span className="text-base flex-shrink-0">{notifIcon(n.type)}</span>
          <div className="flex-1 min-w-0">
            <p style={{ fontSize:13, fontWeight:500 }}>{n.message}</p>
            <p style={{ fontSize:11, opacity:0.6, marginTop:2 }}>{new Date(n.timestamp).toLocaleTimeString()}</p>
          </div>
          <button onClick={() => onRemove(n.id)} style={{ color:'#9ca3af', padding:2 }}><X size={13}/></button>
        </div>
      ))}
    </div>
  </div>
);

/* ─── Single Nav Item ─── */
const NavItem: React.FC<{
  path: string; name: string; Icon: React.ElementType;
  isActive: boolean; isHovered: boolean;
  sidebarOpen: boolean; darkMode: boolean;
  onHover:(h:boolean)=>void; onClick:()=>void;
}> = ({ path, name, Icon, isActive, isHovered, sidebarOpen, darkMode, onHover, onClick }) => {

  /* iDraft active: dark pill on white sidebar (light) / white-tinted pill on dark sidebar */
  const activeBg   = darkMode ? 'rgba(255,255,255,0.12)' : '#1A1A1E';
  const activeColor = darkMode ? '#ffffff' : '#ffffff';
  const hoverBg    = darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)';
  const idleColor  = darkMode ? 'rgba(156,163,175,0.85)' : 'rgba(75,85,99,0.85)';

  return (
    <Link
      to={path}
      onClick={onClick}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: sidebarOpen ? 10 : 0,
        justifyContent: sidebarOpen ? 'flex-start' : 'center',
        padding: sidebarOpen ? '8px 12px' : '10px',
        borderRadius: 14,
        fontFamily: "'DM Sans', sans-serif",
        background: isActive ? activeBg : isHovered ? hoverBg : 'transparent',
        color: isActive ? activeColor : idleColor,
        border: '1px solid transparent',
        transition: 'all 0.22s cubic-bezier(0.25,1,0.5,1)',
        transform: isActive && sidebarOpen ? 'translateX(2px)' : 'none',
        textDecoration: 'none',
        userSelect: 'none',
      }}
    >
      <span style={{
        width: 32, height: 32, borderRadius: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        background: isActive
          ? darkMode ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.2)'
          : 'transparent',
        transition: 'all 0.22s cubic-bezier(0.25,1,0.5,1)',
      }}>
        <Icon size={16} strokeWidth={isActive ? 2.5 : 2} />
      </span>
      {sidebarOpen && (
        <span style={{
          fontSize: 13, fontWeight: isActive ? 700 : 500,
          flex: 1, letterSpacing: '-0.01em',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {name}
        </span>
      )}
    </Link>
  );
};

/* ─── Nav List ─── */
const NavList: React.FC<{
  navItems: Array<{path:string;name:string;Icon:React.ElementType}>;
  location: ReturnType<typeof useLocation>;
  sidebarOpen: boolean; darkMode: boolean;
  onItemClick: ()=>void;
}> = ({ navItems, location, sidebarOpen, darkMode, onItemClick }) => {
  const [hovIdx, setHovIdx] = useState<number|null>(null);
  return (
    <nav className="h-full overflow-y-auto py-2 px-2 space-y-0.5"
      style={{ scrollbarWidth:'none' }}
      onMouseLeave={() => setHovIdx(null)}>
      {navItems.map((item, idx) => (
        <NavItem
          key={item.path}
          path={item.path} name={item.name} Icon={item.Icon}
          isActive={location.pathname === item.path}
          isHovered={hovIdx === idx}
          sidebarOpen={sidebarOpen} darkMode={darkMode}
          onHover={h => setHovIdx(h ? idx : null)}
          onClick={onItemClick}
        />
      ))}
    </nav>
  );
};

/* ══════════════════════════════════════════════════════════════
   MAIN NAVIGATION
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

  const [searchQuery, setSearchQuery]             = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [showMobileSearch, setShowMobileSearch]   = useState(false);
  const [showProfile, setShowProfile]             = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Array<{
    id:string; message:string; type:'success'|'info'|'warning'|'error'; timestamp:Date;
  }>>([]);
  const [darkMode, setDarkMode] = useState(() => (localStorage.getItem('theme') || 'dark') !== 'light');
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [hovTheme, setHovTheme]       = useState(false);
  const [hovSettings, setHovSettings] = useState(false);
  const [hovLogout, setHovLogout]     = useState(false);

  const pRgb     = hexRgb(primaryColor);
  const gradient = `linear-gradient(135deg,${primaryColor} 0%,${accentColor} 100%)`;

  useEffect(() => { setDarkMode(theme !== 'light'); }, [theme]);
  useEffect(() => { setIsSigningOut(false); }, [isAuthenticated]);

  /* ── iDraft colour tokens ── */
  /* Sidebar */
  const SB_BG     = darkMode ? '#0E0F14'  : '#FFFFFF';
  const SB_BORDER = darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)';
  /* Header */
  const HD_BG     = darkMode ? 'rgba(14,15,20,0.92)' : 'rgba(255,255,255,0.92)';
  const HD_BORDER = darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)';
  /* Text */
  const TX_PRIMARY   = darkMode ? '#ffffff'       : '#111827';
  const TX_SECONDARY = darkMode ? 'rgba(148,163,175,0.85)' : 'rgba(107,114,128,0.9)';
  /* Input */
  const INP_BG     = darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)';
  const INP_BORDER = darkMode ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)';
  /* Icon btn */
  const BTN_BG     = darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)';
  const BTN_BORDER = darkMode ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.09)';

  const NAV = [
    { name:'Dashboard',        Icon:LayoutDashboard, path:'/dashboard',          roles:['admin'] },
    { name:'Dashboard',        Icon:GraduationCap,   path:'/student-dashboard',  roles:['student'] },
    { name:'Dashboard',        Icon:BookOpen,        path:'/teacher-dashboard',  roles:['teacher'] },
    { name:'Users',            Icon:Users,           path:'/users',              roles:['admin'] },
    { name:'Announcements',    Icon:Megaphone,       path:'/announcements',      roles:['admin'] },
    { name:'Payments',         Icon:CreditCard,      path:'/payments',           roles:['admin'] },
    { name:'Analytics',        Icon:BarChart3,       path:'/analytics',          roles:['admin'] },
    { name:'Content',          Icon:Upload,          path:'/content',            roles:['admin','teacher'] },
    { name:'Courses',          Icon:PlusCircle,      path:'/course-creation',    roles:['admin','teacher'] },
    { name:'Course Assignment',Icon:UserCheck,       path:'/course-assignment',  roles:['admin'] },
    { name:'Coupons',          Icon:Ticket,          path:'/manage-coupon',      roles:['admin','manager'] },
    { name:'Study Plans',      Icon:Calendar,        path:'/study-plan',         roles:['admin','teacher'] },
    { name:'Progress',         Icon:Medal,           path:'/progress',           roles:['student'] },
    { name:'Leaderboard',      Icon:ListOrdered,     path:'/leaderboard',        roles:['admin','manager','teacher','coordinator','student_manager','course_manager'] },
    { name:'Evaluate Exam',    Icon:ClipboardCheck,  path:'/exam-evaluation',    roles:['admin','teacher'] },
    { name:'Questions',        Icon:MessageSquare,   path:'/teacher-qa',         roles:['teacher'] },
    { name:'Tasks',            Icon:FileText,        path:'/teacher-tasks',      roles:['teacher'] },
    { name:'Library',          Icon:Library,         path:'/content-library',    roles:['admin','teacher','student'] },
    { name:'Courses',          Icon:ShoppingCart,    path:'/course-enrollment',  roles:['admin','teacher','student'] },
    { name:'Ask Question',     Icon:MessageSquare,   path:'/student-qa',         roles:['student'] },
    { name:'Achievements',     Icon:Trophy,          path:'/achievements',       roles:['admin','teacher','student'] },
    { name:'My Tasks',         Icon:FileText,        path:'/student-tasks',      roles:['student'] },
    { name:'My Study Plan',    Icon:Calendar,        path:'/student-study-plan', roles:['student'] },
    { name:'Coming Soon',      Icon:Clock,           path:'/coming-soon',        roles:['admin','teacher','student'] },
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

  /* ─── apply dark/light class to <html> ─── */
  useEffect(() => {
    const html = document.documentElement;
    if (darkMode) {
      html.classList.remove('theme-light');
      html.classList.add('theme-dark');
      localStorage.setItem('theme', 'dark');
    } else {
      html.classList.remove('theme-dark');
      html.classList.add('theme-light');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  /* ════════════════════════════ RENDER ════════════════════════════ */
  return (
    <>
      {/* ══════════════════════════════════════════
          SIDEBAR — iDraft style
          White in light, near-black in dark
      ══════════════════════════════════════════ */}
      <aside
        onMouseEnter={handleMouseEnterSidebarArea}
        onMouseLeave={handleMouseLeaveSidebarArea}
        className={clsx(
          'fixed top-0 left-0 h-screen flex flex-col z-[100]',
          'transition-all duration-300',
          sidebarOpen ? 'w-64' : 'w-[72px]',
          'lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
        style={{
          background: SB_BG,
          borderRight: `1px solid ${SB_BORDER}`,
          boxShadow: darkMode ? '4px 0 24px rgba(0,0,0,0.4)' : '4px 0 20px rgba(0,0,0,0.06)',
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        {/* ── Brand bar ── */}
        <div style={{
          height: 64, padding: '0 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: `1px solid ${SB_BORDER}`, flexShrink: 0,
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, minWidth:0, flex:1 }}>
            <Link to="/dashboard"
              style={{
                width:36, height:36, borderRadius:10,
                display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
                background: gradient,
                boxShadow: `0 4px 12px rgba(${pRgb},0.4)`,
                transition: 'transform 0.2s',
              }}
              onMouseEnter={e => (e.currentTarget.style.transform='scale(1.07)')}
              onMouseLeave={e => (e.currentTarget.style.transform='scale(1)')}>
              <GraduationCap size={18} color="#fff" strokeWidth={2.5}/>
            </Link>
            {sidebarOpen && (
              <span style={{
                fontSize:15, fontWeight:800, letterSpacing:'-0.025em',
                color: TX_PRIMARY, truncate:'ellipsis', overflow:'hidden', whiteSpace:'nowrap',
              }}>
                {user?.role === 'student' ? 'Student Portal' : user?.role === 'teacher' ? 'Teacher Portal' : 'Admin Panel'}
              </span>
            )}
          </div>
          {/* Collapse toggle (desktop) */}
          {sidebarOpen && (
            <button onClick={toggleSidebarClick}
              style={{
                width:32, height:32, borderRadius:8, flexShrink:0,
                display:'flex', alignItems:'center', justifyContent:'center',
                background:'transparent', border:'none', cursor:'pointer',
                color: TX_SECONDARY, transition:'background 0.2s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <HamburgerMenuIcon state="open" size={32} className="" />
            </button>
          )}
          {/* Mobile close */}
          <button onClick={toggleSidebarClick}
            className="lg:hidden"
            style={{
              width:32, height:32, borderRadius:8, flexShrink:0,
              display:'flex', alignItems:'center', justifyContent:'center',
              background:'transparent', border:'none', cursor:'pointer', color: TX_SECONDARY,
            }}>
            <X size={18}/>
          </button>
        </div>

        {/* ── User chip ── */}
        {isAuthenticated && (
          <div style={{ padding:'12px 10px 8px', borderBottom:`1px solid ${SB_BORDER}`, flexShrink:0 }}>
            <button
              onClick={() => setShowProfile(true)}
              style={{
                width:'100%', display:'flex',
                alignItems:'center', gap: sidebarOpen ? 10 : 0,
                justifyContent: sidebarOpen ? 'flex-start' : 'center',
                padding: sidebarOpen ? '8px 10px' : '8px',
                borderRadius:12, border:'none', cursor:'pointer',
                background:'transparent', transition:'background 0.2s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <div style={{
                width:34, height:34, borderRadius:10, flexShrink:0,
                display:'flex', alignItems:'center', justifyContent:'center',
                background: gradient,
                color:'#fff', fontWeight:700, fontSize:13,
                boxShadow:`0 3px 10px rgba(${pRgb},0.4)`,
              }}>
                {user && getInitials(user.name)}
              </div>
              {sidebarOpen && (
                <div style={{ textAlign:'left', minWidth:0, flex:1, overflow:'hidden' }}>
                  <p style={{ fontSize:13, fontWeight:700, color:TX_PRIMARY, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                    {user?.name}
                  </p>
                  <p style={{ fontSize:11, fontWeight:600, color:TX_SECONDARY, textTransform:'capitalize' }}>
                    {user?.role}
                  </p>
                </div>
              )}
            </button>
          </div>
        )}

        {/* ── Nav list ── */}
        <div style={{ flex:1, overflow:'hidden' }}>
          <NavList
            navItems={navItems}
            location={location}
            sidebarOpen={sidebarOpen}
            darkMode={darkMode}
            onItemClick={() => setShowProfile(false)}
          />
        </div>

        {/* ── Bottom actions ── */}
        <div style={{
          padding:'8px 10px', paddingBottom:'max(8px, env(safe-area-inset-bottom))',
          borderTop:`1px solid ${SB_BORDER}`, flexShrink:0,
        }}>
          {/* Dark mode toggle */}
          <button
            onClick={() => setDarkMode(v => !v)}
            onMouseEnter={() => setHovTheme(true)}
            onMouseLeave={() => setHovTheme(false)}
            style={{
              width:'100%', display:'flex', alignItems:'center',
              gap: sidebarOpen ? 10 : 0,
              justifyContent: sidebarOpen ? 'flex-start' : 'center',
              padding: sidebarOpen ? '8px 10px' : '10px',
              borderRadius:12, border:'none', cursor:'pointer', marginBottom:2,
              background: hovTheme ? (darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)') : 'transparent',
              color: TX_SECONDARY, transition:'all 0.2s', fontFamily:"'DM Sans',sans-serif",
            }}>
            <span style={{
              width:32, height:32, borderRadius:10, flexShrink:0,
              display:'flex', alignItems:'center', justifyContent:'center',
              background: hovTheme ? (darkMode ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)') : 'transparent',
              transition:'background 0.2s',
            }}>
              {darkMode ? <Moon size={15} color="#a5b4fc" strokeWidth={2}/> : <Sun size={15} color="#f59e0b" strokeWidth={2}/>}
            </span>
            {sidebarOpen && (
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flex:1 }}>
                <span style={{ fontSize:13, fontWeight:500 }}>{darkMode ? 'Dark Mode' : 'Light Mode'}</span>
                <div style={{
                  width:36, height:20, borderRadius:10, position:'relative', flexShrink:0,
                  background: darkMode ? gradient : 'rgba(0,0,0,0.15)', transition:'background 0.3s',
                }}>
                  <div style={{
                    position:'absolute', top:3, width:14, height:14, borderRadius:'50%',
                    background:'#fff', boxShadow:'0 1px 3px rgba(0,0,0,0.3)',
                    left: darkMode ? 19 : 3, transition:'left 0.3s',
                  }}/>
                </div>
              </div>
            )}
          </button>

          {/* Settings */}
          <Link to="/settings"
            onClick={() => setShowProfile(false)}
            onMouseEnter={() => setHovSettings(true)}
            onMouseLeave={() => setHovSettings(false)}
            style={{
              display:'flex', alignItems:'center',
              gap: sidebarOpen ? 10 : 0,
              justifyContent: sidebarOpen ? 'flex-start' : 'center',
              padding: sidebarOpen ? '8px 10px' : '10px',
              borderRadius:12, marginBottom:2, textDecoration:'none',
              background: location.pathname==='/settings'
                ? (darkMode ? 'rgba(255,255,255,0.12)' : '#1A1A1E')
                : hovSettings ? (darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)') : 'transparent',
              color: location.pathname==='/settings'
                ? '#ffffff'
                : TX_SECONDARY,
              transition:'all 0.2s',
            }}>
            <span style={{
              width:32, height:32, borderRadius:10, flexShrink:0,
              display:'flex', alignItems:'center', justifyContent:'center',
            }}>
              <Settings size={15} strokeWidth={2}/>
            </span>
            {sidebarOpen && <span style={{ fontSize:13, fontWeight:500 }}>Settings</span>}
          </Link>

          {/* Sign out */}
          <button
            onClick={handleSignOutClick}
            disabled={isSigningOut}
            onMouseEnter={() => setHovLogout(true)}
            onMouseLeave={() => setHovLogout(false)}
            style={{
              width:'100%', display:'flex', alignItems:'center',
              gap: sidebarOpen ? 10 : 0,
              justifyContent: sidebarOpen ? 'flex-start' : 'center',
              padding: sidebarOpen ? '8px 10px' : '10px',
              borderRadius:12, border:'none', cursor:'pointer',
              background: hovLogout ? 'rgba(239,68,68,0.10)' : 'transparent',
              color: hovLogout ? '#f87171' : TX_SECONDARY,
              transition:'all 0.2s', fontFamily:"'DM Sans',sans-serif",
            }}>
            <span style={{
              width:32, height:32, borderRadius:10, flexShrink:0,
              display:'flex', alignItems:'center', justifyContent:'center',
            }}>
              {isSigningOut
                ? <Loader2 size={15} strokeWidth={2} className="animate-spin"/>
                : <LogOut size={15} strokeWidth={2}/>}
            </span>
            {sidebarOpen && <span style={{ fontSize:13, fontWeight:500 }}>{isSigningOut ? 'Signing out…' : 'Sign Out'}</span>}
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[99] lg:hidden"
          onClick={toggleSidebarClick}/>
      )}

      {/* ══════════════════════════════════════════
          HEADER — iDraft style
          Clean search left, icons + profile right
      ══════════════════════════════════════════ */}
      <header
        className={clsx(
          'fixed top-0 right-0 z-[60]',
          'h-16',
          sidebarOpen ? 'lg:left-64' : 'lg:left-[72px]',
          'left-0',
          'transition-all duration-300',
          'flex items-center px-4 lg:px-6 gap-4',
        )}
        style={{
          background: HD_BG,
          backdropFilter: 'blur(20px) saturate(160%)',
          WebkitBackdropFilter: 'blur(20px) saturate(160%)',
          borderBottom: `1px solid ${HD_BORDER}`,
          boxShadow: darkMode
            ? '0 4px 20px rgba(0,0,0,0.3)'
            : '0 4px 16px rgba(0,0,0,0.06)',
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        {/* ── Mobile hamburger ── */}
        <button onClick={toggleSidebarClick}
          className="lg:hidden flex-shrink-0"
          style={{
            width:36, height:36, borderRadius:10,
            display:'flex', alignItems:'center', justifyContent:'center',
            background: BTN_BG, border:`1px solid ${BTN_BORDER}`,
            cursor:'pointer', color: TX_SECONDARY,
          }}>
          <HamburgerMenuIcon state={sidebarOpen ? 'open' : 'closed'} size={36} className=""/>
        </button>

        {/* ── Search bar ── */}
        {isAuthenticated && (
          <div className="search-input-wrap relative flex-1 max-w-[520px]">
            <form onSubmit={handleSearchSubmit}>
              <div style={{ position:'relative' }}>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={handleSearchChange}
                  placeholder="Search courses, content…"
                  className="search-input w-full focus:outline-none"
                  style={{
                    height:40, borderRadius:12,
                    background: INP_BG,
                    border: `1px solid ${INP_BORDER}`,
                    paddingLeft:40, paddingRight:16,
                    fontSize:13, fontWeight:500,
                    color: TX_PRIMARY,
                    fontFamily:"'DM Sans',sans-serif",
                    transition:'all 0.22s cubic-bezier(0.25,1,0.5,1)',
                  }}
                  onFocus={e => {
                    e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.11)' : '#fff';
                    e.currentTarget.style.border = darkMode ? '1px solid rgba(255,255,255,0.20)' : '1px solid rgba(0,0,0,0.18)';
                    e.currentTarget.style.boxShadow = darkMode ? '0 0 0 3px rgba(255,255,255,0.05)' : '0 0 0 3px rgba(0,0,0,0.05)';
                  }}
                  onBlur={e => {
                    e.currentTarget.style.background = INP_BG;
                    e.currentTarget.style.border = `1px solid ${INP_BORDER}`;
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
                <Search size={14} strokeWidth={2}
                  style={{
                    position:'absolute', left:13, top:'50%', transform:'translateY(-50%)',
                    color: TX_SECONDARY, pointerEvents:'none',
                  }}
                />
              </div>
              {/* Search results */}
              {showSearchResults && searchQuery && (
                <div className="search-results absolute top-full left-0 right-0 mt-2 rounded-2xl overflow-hidden z-50"
                  style={{
                    background: darkMode ? '#18191f' : '#fff',
                    border: `1px solid ${INP_BORDER}`,
                    boxShadow:'0 16px 48px rgba(0,0,0,0.25)',
                  }}>
                  <div style={{ padding:'10px 14px 8px', borderBottom:`1px solid ${INP_BORDER}` }}>
                    <p style={{ fontSize:11, fontWeight:500, color:TX_SECONDARY }}>
                      Results for <strong style={{ color:TX_PRIMARY }}>"{searchQuery}"</strong>
                    </p>
                  </div>
                  {(isStudent
                    ? ['Student Dashboard','Content Library','My Progress']
                    : isTeacher
                      ? ['Teacher Dashboard','Content Upload','Study Plans']
                      : ['Content Library','My Courses','Analytics']
                  ).map(r => (
                    <button key={r}
                      style={{
                        width:'100%', textAlign:'left',
                        padding:'10px 14px', fontSize:13, fontWeight:500,
                        color:TX_PRIMARY, background:'transparent',
                        borderBottom:`1px solid ${INP_BORDER}`,
                        fontFamily:"'DM Sans',sans-serif", cursor:'pointer',
                        transition:'all 0.15s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'; e.currentTarget.style.paddingLeft='18px'; }}
                      onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.paddingLeft='14px'; }}>
                      {r}
                    </button>
                  ))}
                </div>
              )}
            </form>
          </div>
        )}

        {/* ── Spacer ── */}
        <div style={{ flex:1 }}/>

        {/* ── Right side actions ── */}
        {isAuthenticated && (
          <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>

            {/* Bell */}
            <div style={{ position:'relative' }}>
              <button
                onClick={() => setShowNotifications(v => !v)}
                className="notif-btn"
                style={{
                  width:36, height:36, borderRadius:10,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  background: BTN_BG, border:`1px solid ${BTN_BORDER}`,
                  cursor:'pointer', color:TX_SECONDARY, position:'relative',
                  transition:'all 0.22s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)';
                  e.currentTarget.style.transform = 'scale(1.05)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = BTN_BG;
                  e.currentTarget.style.transform = 'scale(1)';
                }}>
                <Bell size={16} strokeWidth={2}/>
                {notifications.length > 0 && (
                  <span style={{
                    position:'absolute', top:1, right:1,
                    width:8, height:8, borderRadius:'50%',
                    background:'#6366f1',
                    border: `2px solid ${darkMode ? '#0E0F14' : '#fff'}`,
                  }}/>
                )}
              </button>
              {showNotifications && (
                <NotifDropdown pos="desktop" darkMode={darkMode}
                  notifications={notifications} onClear={() => setNotifications([])}
                  onRemove={removeNotification} notifIcon={notifIcon} notifColor={notifColor}/>
              )}
            </div>

            {/* Profile chip — iDraft style: avatar + name + role */}
            <button
              onClick={() => setShowProfile(true)}
              style={{
                display:'flex', alignItems:'center', gap:10,
                padding:'5px 12px 5px 5px', borderRadius:12,
                background: BTN_BG, border:`1px solid ${BTN_BORDER}`,
                cursor:'pointer', transition:'all 0.22s cubic-bezier(0.25,1,0.5,1)',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.07)';
                e.currentTarget.style.transform = 'scale(1.02)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = BTN_BG;
                e.currentTarget.style.transform = 'scale(1)';
              }}>
              <div style={{
                width:30, height:30, borderRadius:8, flexShrink:0,
                display:'flex', alignItems:'center', justifyContent:'center',
                background: gradient,
                color:'#fff', fontWeight:800, fontSize:12,
              }}>
                {user && getInitials(user.name)}
              </div>
              <div style={{ textAlign:'left', display:'block' }} className="hidden sm:block">
                <p style={{ fontSize:13, fontWeight:700, color:TX_PRIMARY, whiteSpace:'nowrap', lineHeight:1.2 }}>
                  {user?.name}
                </p>
                <p style={{ fontSize:11, fontWeight:500, color:TX_SECONDARY, textTransform:'capitalize' }}>
                  {user?.role}
                </p>
              </div>
            </button>

            {/* Sign out */}
            <button
              onClick={handleSignOutClick}
              disabled={isSigningOut}
              title="Sign Out"
              style={{
                width:36, height:36, borderRadius:10,
                display:'flex', alignItems:'center', justifyContent:'center',
                background: BTN_BG, border:`1px solid ${BTN_BORDER}`,
                cursor:'pointer', color:TX_SECONDARY,
                transition:'all 0.22s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(239,68,68,0.12)';
                e.currentTarget.style.border = '1px solid rgba(239,68,68,0.3)';
                e.currentTarget.style.color = '#f87171';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = BTN_BG;
                e.currentTarget.style.border = `1px solid ${BTN_BORDER}`;
                e.currentTarget.style.color = TX_SECONDARY;
              }}>
              {isSigningOut
                ? <Loader2 size={15} className="animate-spin"/>
                : <LogOut size={15} strokeWidth={2}/>}
            </button>
          </div>
        )}
      </header>

      {/* Mobile search */}
      {showMobileSearch && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[90] lg:hidden"
          onClick={() => setShowMobileSearch(false)}>
          <div style={{
            position:'absolute', top:0, left:0, right:0,
            padding:'12px 12px',
            paddingTop:'max(calc(env(safe-area-inset-top) + 12px), 12px)',
            background: darkMode ? '#0E0F14' : '#fff',
            borderBottom:`1px solid ${HD_BORDER}`,
            fontFamily:"'DM Sans',sans-serif",
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <form onSubmit={handleSearchSubmit} style={{ flex:1 }}>
                <div style={{ position:'relative' }}>
                  <input type="text" value={searchQuery} onChange={handleSearchChange}
                    placeholder="Search courses, content…" autoFocus
                    style={{
                      width:'100%', height:44, borderRadius:12,
                      background: INP_BG, border:`1px solid ${INP_BORDER}`,
                      paddingLeft:40, paddingRight:16,
                      fontSize:14, color:TX_PRIMARY, fontFamily:"'DM Sans',sans-serif",
                    }}/>
                  <Search size={15} style={{ position:'absolute', left:13, top:'50%', transform:'translateY(-50%)', color:TX_SECONDARY }} strokeWidth={2}/>
                </div>
              </form>
              <button onClick={() => setShowMobileSearch(false)}
                style={{
                  width:44, height:44, borderRadius:12, flexShrink:0,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  background:BTN_BG, border:`1px solid ${BTN_BORDER}`,
                  cursor:'pointer', color:TX_SECONDARY,
                }}>
                <X size={18} strokeWidth={2}/>
              </button>
            </div>
          </div>
        </div>
      )}

      {showProfile && isAuthenticated && (
        <Profile onClose={() => setShowProfile(false)} onSuccess={handleProfileSuccess}/>
      )}

      <style>{`
        nav::-webkit-scrollbar { display:none; }
        .header-container, aside { -webkit-font-smoothing:antialiased; }
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
