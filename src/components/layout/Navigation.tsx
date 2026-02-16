/* /src/components/layout/Navigation.tsx */
/* Combined Sidebar + Header Component - Production Grade - FIXED LAYOUT */
import React from 'react';
import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Bell, 
  Search, 
  LogOut, 
  X, 
  LayoutDashboard, 
  Users, 
  Upload, 
  Calendar, 
  Medal, 
  BarChart3, 
  Settings, 
  Clock,
  CreditCard,
  Library,
  GraduationCap,
  BookOpen,
  Brain,
  ShoppingCart,
  Trophy,
  PlusCircle,
  Megaphone,
  FileText,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  Loader2
} from 'lucide-react';
import { useDashboard } from '../../contexts/DashboardContext';
import Profile from '../profile/Profile';
import AnimatedMenuIcon from '../ui/AnimatedMenuIcon';
import clsx from 'clsx';

const Navigation = () => {
  const { 
    sidebarOpen,
    toggleSidebarClick,
    handleMouseEnterSidebarArea,
    handleMouseLeaveSidebarArea,
    sidebarAnimationState,
    handleSearch, 
    handleSignOut,
    isAuthenticated, 
    user
  } = useDashboard();
  
  const location = useLocation();
  
  // Header States
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [notifications, setNotifications] = useState<Array<{
    id: string;
    message: string;
    type: 'success' | 'info' | 'warning' | 'error';
    timestamp: Date;
  }>>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  
  // Sidebar States
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('sidebarTheme');
    return saved ? saved === 'dark' : true; // Default to dark
  });
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    localStorage.setItem('sidebarTheme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  // Navigation Items
  const navItems = [
    { name: 'Dashboard', icon: <LayoutDashboard size={20} strokeWidth={2} />, path: '/dashboard', roles: ['admin'] },
    { name: 'Dashboard', icon: <GraduationCap size={20} strokeWidth={2} />, path: '/student-dashboard', roles: ['student'] },
    { name: 'Dashboard', icon: <BookOpen size={20} strokeWidth={2} />, path: '/teacher-dashboard', roles: ['teacher'] },
    { name: 'Users', icon: <Users size={20} strokeWidth={2} />, path: '/users', roles: ['admin'] },
    { name: 'Announcements', icon: <Megaphone size={20} strokeWidth={2} />, path: '/announcements', roles: ['admin'] },
    { name: 'Payments', icon: <CreditCard size={20} strokeWidth={2} />, path: '/payments', roles: ['admin'] },
    { name: 'Analytics', icon: <BarChart3 size={20} strokeWidth={2} />, path: '/analytics', roles: ['admin'] },
    { name: 'Content', icon: <Upload size={20} strokeWidth={2} />, path: '/content', roles: ['admin', 'teacher'] },
    { name: 'Create Course', icon: <PlusCircle size={20} strokeWidth={2} />, path: '/course-creation', roles: ['admin', 'teacher'] },
    { name: 'Study Plans', icon: <Calendar size={20} strokeWidth={2} />, path: '/study-plan', roles: ['admin', 'teacher'] },
    { name: 'Progress', icon: <Medal size={20} strokeWidth={2} />, path: '/progress', roles: ['admin', 'teacher'] },
    { name: 'Questions', icon: <MessageSquare size={20} strokeWidth={2} />, path: '/teacher-qa', roles: ['teacher'] },
    { name: 'Tasks', icon: <FileText size={20} strokeWidth={2} />, path: '/teacher-tasks', roles: ['teacher'] },
    { name: 'Library', icon: <Library size={20} strokeWidth={2} />, path: '/content-library', roles: ['admin', 'teacher', 'student'] },
    { name: 'Courses', icon: <ShoppingCart size={20} strokeWidth={2} />, path: '/course-enrollment', roles: ['admin', 'teacher', 'student'] },
    { name: 'Practice', icon: <Brain size={20} strokeWidth={2} />, path: '/mcq-practice', roles: ['admin', 'teacher', 'student'] },
    { name: 'Ask Question', icon: <MessageSquare size={20} strokeWidth={2} />, path: '/student-qa', roles: ['student'] },
    { name: 'Achievements', icon: <Trophy size={20} strokeWidth={2} />, path: '/achievements', roles: ['admin', 'teacher', 'student'] },
    { name: 'My Tasks', icon: <FileText size={20} strokeWidth={2} />, path: '/student-tasks', roles: ['student'] },
    { name: 'My Study Plan', icon: <Calendar size={20} strokeWidth={2} />, path: '/student-study-plan', roles: ['student'] },
    { name: 'Coming Soon', icon: <Clock size={20} strokeWidth={2} />, path: '/coming-soon', roles: ['admin', 'teacher', 'student'] },
  ];

  const filteredNavItems = navItems.filter(item => 
    user && item.roles.includes(user.role)
  );

  // Header Functions
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch(searchQuery);
    setShowSearchResults(true);
    setShowMobileSearch(false);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    if (e.target.value === '') {
      setShowSearchResults(false);
    }
  };

  const handleSignOutClick = async () => {
    setIsSigningOut(true);
    try {
      await handleSignOut();
    } catch (error) {
      console.error('Error signing out:', error);
      setIsSigningOut(false);
    }
  };

  const addNotification = (message: string, type: 'success' | 'info' | 'warning' | 'error' = 'info') => {
    const notification = {
      id: Date.now().toString(),
      message,
      type,
      timestamp: new Date()
    };
    setNotifications(prev => [notification, ...prev.slice(0, 4)]);
    
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== notification.id));
    }, 5000);
  };

  useEffect(() => {
    (window as any).addNotification = addNotification;
    return () => {
      delete (window as any).addNotification;
    };
  }, []);

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success': return '✅';
      case 'warning': return '⚠️';
      case 'error': return '❌';
      default: return 'ℹ️';
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'success': return 'bg-success-dark border-success-DEFAULT text-success-light';
      case 'warning': return 'bg-warning-dark border-warning-DEFAULT text-warning-light';
      case 'error': return 'bg-error-dark border-error-DEFAULT text-error-light';
      default: return 'bg-primary-dark border-primary-DEFAULT text-primary-light';
    }
  };

  const handleProfileSuccess = () => {
    setShowProfile(false);
    window.location.reload();
  };

  const isStudent = user?.role === 'student';
  const isTeacher = user?.role === 'teacher';

  // Sidebar Functions
  const getSidebarConfig = () => {
    switch (user?.role) {
      case 'student':
        return {
          title: 'Student Portal',
          darkGradient: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)',
          darkGlow: 'rgba(16, 185, 129, 0.15)',
          darkAccent: '#10b981',
          darkAccentRgb: '16, 185, 129',
          darkRoleBg: 'rgba(16, 185, 129, 0.15)',
          darkRoleText: '#34d399',
          lightGradient: 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)',
          lightGlow: 'rgba(79, 70, 229, 0.1)',
          lightAccent: '#4f46e5',
          lightAccentRgb: '79, 70, 229',
          lightRoleBg: 'rgba(79, 70, 229, 0.1)',
          lightRoleText: '#4f46e5'
        };
      case 'teacher':
        return {
          title: 'Teacher Portal',
          darkGradient: 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)',
          darkGlow: 'rgba(168, 85, 247, 0.15)',
          darkAccent: '#a855f7',
          darkAccentRgb: '168, 85, 247',
          darkRoleBg: 'rgba(168, 85, 247, 0.15)',
          darkRoleText: '#c084fc',
          lightGradient: 'linear-gradient(135deg, #be123c 0%, #9f1239 100%)',
          lightGlow: 'rgba(190, 18, 60, 0.1)',
          lightAccent: '#be123c',
          lightAccentRgb: '190, 18, 60',
          lightRoleBg: 'rgba(190, 18, 60, 0.1)',
          lightRoleText: '#be123c'
        };
      case 'admin':
      default:
        return {
          title: 'Admin Panel',
          darkGradient: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
          darkGlow: 'rgba(59, 130, 246, 0.15)',
          darkAccent: '#3b82f6',
          darkAccentRgb: '59, 130, 246',
          darkRoleBg: 'rgba(59, 130, 246, 0.15)',
          darkRoleText: '#60a5fa',
          lightGradient: 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%)',
          lightGlow: 'rgba(30, 58, 138, 0.1)',
          lightAccent: '#1e3a8a',
          lightAccentRgb: '30, 58, 138',
          lightRoleBg: 'rgba(30, 58, 138, 0.1)',
          lightRoleText: '#1e3a8a'
        };
    }
  };

  const config = getSidebarConfig();
  const sidebarConfig = {
    title: config.title,
    gradient: darkMode ? config.darkGradient : config.lightGradient,
    glowColor: darkMode ? config.darkGlow : config.lightGlow,
    accent: darkMode ? config.darkAccent : config.lightAccent,
    accentRgb: darkMode ? config.darkAccentRgb : config.lightAccentRgb,
    roleBg: darkMode ? config.darkRoleBg : config.lightRoleBg,
    roleText: darkMode ? config.darkRoleText : config.lightRoleText
  };

  const getInitials = (name: string) => {
    const names = name.trim().split(' ');
    if (names.length === 1) return names[0].charAt(0).toUpperCase();
    return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
  };

  const getSurname = (name: string) => {
    const names = name.trim().split(' ');
    return names.length > 1 ? names[names.length - 1] : '';
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.notifications-dropdown') && !target.closest('.notifications-button')) {
        setShowNotifications(false);
      }
      if (!target.closest('.search-results') && !target.closest('.search-input')) {
        setShowSearchResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close sidebar on route change for mobile
  useEffect(() => {
    if (window.innerWidth < 1024 && sidebarOpen) {
      toggleSidebarClick();
    }
  }, [location.pathname]);

  // Prevent body scroll when sidebar is open on mobile
  useEffect(() => {
    if (window.innerWidth < 1024) {
      document.body.style.overflow = sidebarOpen ? 'hidden' : 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [sidebarOpen]);

  return (
    <>
      {/* SIDEBAR - Fixed Position */}
      <aside
        className={clsx(
          "fixed top-0 left-0 h-screen flex flex-col transition-all duration-300 ease-in-out z-50",
          sidebarOpen ? "w-64" : "w-20",
          "lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
        onMouseEnter={handleMouseEnterSidebarArea}
        onMouseLeave={handleMouseLeaveSidebarArea}
        style={{
          background: darkMode 
            ? 'linear-gradient(to bottom, #0a0e1a 0%, #0d1220 100%)' 
            : 'linear-gradient(to bottom, #ffffff 0%, #f8fafc 100%)',
          borderRight: darkMode 
            ? '1px solid rgba(255, 255, 255, 0.06)' 
            : '1px solid rgba(0, 0, 0, 0.08)',
          boxShadow: darkMode 
            ? '4px 0 24px -8px rgba(0, 0, 0, 0.4)' 
            : '4px 0 24px -8px rgba(0, 0, 0, 0.1)'
        }}
      >
        {/* Sidebar Header with Logo/Brand */}
        <div className={clsx(
          "p-4 border-b flex items-center justify-between flex-shrink-0",
          darkMode ? "border-white/[0.06]" : "border-gray-200"
        )}>
          <div className="flex items-center gap-3 min-w-0">
            <div 
              className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg"
              style={{ 
                background: sidebarConfig.gradient,
                boxShadow: `0 4px 12px -2px rgba(${sidebarConfig.accentRgb}, 0.3)`
              }}
            >
              <GraduationCap className="w-5 h-5 text-white" strokeWidth={2.5} />
            </div>
            {sidebarOpen && (
              <div className="min-w-0 flex-1">
                <h1 className={clsx(
                  "text-base font-bold tracking-tight truncate",
                  darkMode ? "text-white" : "text-gray-900"
                )}>
                  {sidebarConfig.title}
                </h1>
              </div>
            )}
          </div>
          
          {/* Desktop Toggle Button */}
          <button
            onClick={toggleSidebarClick}
            className={clsx(
              "hidden lg:flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-200 flex-shrink-0",
              darkMode 
                ? "hover:bg-white/[0.06] text-slate-400 hover:text-white" 
                : "hover:bg-gray-100 text-gray-600 hover:text-gray-900",
              !sidebarOpen && "mx-auto"
            )}
          >
            {sidebarOpen ? (
              <ChevronLeft size={18} strokeWidth={2} />
            ) : (
              <ChevronRight size={18} strokeWidth={2} />
            )}
          </button>

          {/* Mobile Close Button */}
          <button
            onClick={toggleSidebarClick}
            className={clsx(
              "lg:hidden flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-200",
              darkMode 
                ? "hover:bg-white/[0.06] text-slate-400 hover:text-white" 
                : "hover:bg-gray-100 text-gray-600 hover:text-gray-900"
            )}
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        {/* User Profile Section */}
        <div className={clsx(
          "p-3 border-b flex-shrink-0",
          darkMode ? "border-white/[0.06]" : "border-gray-200"
        )}>
          <button
            onClick={() => setShowProfile(true)}
            className={clsx(
              "w-full group relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200",
              !sidebarOpen && "lg:justify-center lg:px-0",
              darkMode 
                ? "hover:bg-white/[0.06]" 
                : "hover:bg-gray-100"
            )}
          >
            <div 
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-md"
              style={{ background: sidebarConfig.gradient }}
            >
              {user && getInitials(user.name)}
            </div>
            
            {sidebarOpen && (
              <div className="flex-1 min-w-0 text-left">
                <div className={clsx(
                  "text-sm font-bold truncate",
                  darkMode ? "text-white" : "text-gray-900"
                )}>
                  {user?.name}
                </div>
                <div 
                  className="text-xs font-semibold capitalize truncate"
                  style={{ color: sidebarConfig.roleText }}
                >
                  {user?.role}
                </div>
              </div>
            )}

            {/* Tooltip */}
            {!sidebarOpen && user && (
              <span className={clsx(
                "fixed px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap",
                "opacity-0 invisible group-hover:opacity-100 group-hover:visible",
                "transition-all duration-200 pointer-events-none ml-2",
                darkMode 
                  ? "bg-[#1a1f2e] text-white border border-white/[0.1] shadow-2xl" 
                  : "bg-gray-900 text-white shadow-xl"
              )}
              style={{
                left: sidebarOpen ? '256px' : '80px',
                zIndex: 99999
              }}>
                {user.name}
                <span 
                  className="absolute right-full top-1/2 -translate-y-1/2 border-[5px] border-transparent"
                  style={{ 
                    borderRightColor: darkMode ? '#1a1f2e' : '#111827'
                  }}
                />
              </span>
            )}
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 overflow-y-auto premium-scrollbar p-3 space-y-1">
          {filteredNavItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={clsx(
                "group relative flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-[13px] transition-all duration-200",
                !sidebarOpen && "lg:justify-center lg:px-0",
                location.pathname === item.path
                  ? "text-white shadow-lg"
                  : darkMode
                    ? "text-slate-400 hover:bg-white/[0.06] hover:text-white"
                    : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
              )}
              style={location.pathname === item.path ? { 
                background: sidebarConfig.gradient,
                boxShadow: `0 4px 12px -2px rgba(${sidebarConfig.accentRgb}, 0.3)`
              } : {}}
            >
              <span className="flex items-center justify-center">
                {item.icon}
              </span>
              {sidebarOpen && <span className="font-semibold">{item.name}</span>}
              
              {/* Tooltip */}
              {!sidebarOpen && (
                <span className={clsx(
                  "fixed px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap",
                  "opacity-0 invisible group-hover:opacity-100 group-hover:visible",
                  "transition-all duration-200 pointer-events-none ml-2",
                  darkMode 
                    ? "bg-[#1a1f2e] text-white border border-white/[0.1] shadow-2xl" 
                    : "bg-gray-900 text-white shadow-xl"
                )}
                style={{
                  left: sidebarOpen ? '256px' : '80px',
                  zIndex: 99999
                }}>
                  {item.name}
                  <span 
                    className="absolute right-full top-1/2 -translate-y-1/2 border-[5px] border-transparent"
                    style={{ 
                      borderRightColor: darkMode ? '#1a1f2e' : '#111827'
                    }}
                  />
                </span>
              )}
            </Link>
          ))}
        </nav>

        {/* Bottom Actions */}
        <div className="flex-shrink-0 pb-8 sm:pb-10 md:pb-12 lg:pb-0">
          {/* Theme Toggle */}
          <div className="px-3 py-1">
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={clsx(
                "w-full group relative flex items-center h-9 rounded-xl font-medium text-[13px] transition-all duration-200 overflow-hidden",
                !sidebarOpen && "lg:justify-center lg:px-0",
                darkMode
                  ? "hover:bg-white/[0.06]"
                  : "hover:bg-gray-100"
              )}
            >
              {sidebarOpen ? (
                <div className="flex items-center justify-between w-full px-3.5">
                  <span className={clsx(
                    "font-semibold transition-colors",
                    darkMode ? "text-slate-300 group-hover:text-white" : "text-gray-700 group-hover:text-gray-900"
                  )}>
                    Theme
                  </span>
                  <div className={clsx(
                    "relative w-11 h-6 rounded-full transition-all duration-300",
                    darkMode ? "bg-white/[0.12]" : "bg-gray-200"
                  )}>
                    <div 
                      className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full transition-all duration-300 flex items-center justify-center shadow-md"
                      style={{
                        background: darkMode ? sidebarConfig.gradient : '#ffffff',
                        transform: darkMode ? 'translateX(20px)' : 'translateX(0)'
                      }}
                    >
                      {darkMode ? (
                        <Moon size={11} className="text-white" strokeWidth={2.5} />
                      ) : (
                        <Sun size={11} className="text-gray-600" strokeWidth={2.5} />
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center w-full">
                  {darkMode ? (
                    <Moon size={18} className="text-slate-400 group-hover:text-white transition-colors" strokeWidth={2} />
                  ) : (
                    <Sun size={18} className="text-gray-600 group-hover:text-gray-900 transition-colors" strokeWidth={2} />
                  )}
                </div>
              )}

              {/* Tooltip */}
              {!sidebarOpen && (
                <span className={clsx(
                  "fixed px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap",
                  "opacity-0 invisible group-hover:opacity-100 group-hover:visible",
                  "transition-all duration-200 pointer-events-none ml-2",
                  darkMode 
                    ? "bg-[#1a1f2e] text-white border border-white/[0.1] shadow-2xl" 
                    : "bg-gray-900 text-white shadow-xl"
                )}
                style={{
                  left: sidebarOpen ? '256px' : '80px',
                  zIndex: 99999
                }}>
                  Toggle Theme
                  <span 
                    className="absolute right-full top-1/2 -translate-y-1/2 border-[5px] border-transparent"
                    style={{ 
                      borderRightColor: darkMode ? '#1a1f2e' : '#111827'
                    }}
                  />
                </span>
              )}
            </button>
          </div>

          {/* Settings */}
          <div className={clsx(
            "px-3 py-1 border-t",
            darkMode ? "border-white/[0.06]" : "border-gray-200"
          )}>
            <Link
              to="/settings"
              className={clsx(
                "group relative flex items-center gap-3 px-3.5 py-2 rounded-xl font-medium text-[13px] transition-all duration-200",
                !sidebarOpen && "lg:justify-center lg:px-0",
                location.pathname === '/settings'
                  ? "text-white shadow-lg"
                  : darkMode
                    ? "text-slate-400 hover:bg-white/[0.06] hover:text-white"
                    : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
              )}
              style={location.pathname === '/settings' ? { 
                background: sidebarConfig.gradient,
                boxShadow: `0 4px 12px -2px rgba(${sidebarConfig.accentRgb}, 0.3)`
              } : {}}
            >
              <Settings size={20} strokeWidth={2} />
              {sidebarOpen && <span className="font-semibold">Settings</span>}

              {/* Tooltip */}
              {!sidebarOpen && (
                <span className={clsx(
                  "fixed px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap",
                  "opacity-0 invisible group-hover:opacity-100 group-hover:visible",
                  "transition-all duration-200 pointer-events-none ml-2",
                  darkMode 
                    ? "bg-[#1a1f2e] text-white border border-white/[0.1] shadow-2xl" 
                    : "bg-gray-900 text-white shadow-xl"
                )}
                style={{
                  left: sidebarOpen ? '256px' : '80px',
                  zIndex: 99999
                }}>
                  Settings
                  <span 
                    className="absolute right-full top-1/2 -translate-y-1/2 border-[5px] border-transparent"
                    style={{ 
                      borderRightColor: darkMode ? '#1a1f2e' : '#111827'
                    }}
                  />
                </span>
              )}
            </Link>
          </div>

          {/* Logout */}
          <div className="px-3 py-1">
            <button
              onClick={handleSignOutClick}
              disabled={isSigningOut}
              className={clsx(
                "group relative flex items-center gap-3 px-3.5 py-2 rounded-xl font-medium text-[13px] transition-all duration-200 w-full",
                !sidebarOpen && "lg:justify-center lg:px-0",
                isSigningOut && "opacity-60 cursor-not-allowed",
                !isSigningOut && (darkMode
                  ? "text-slate-400 hover:bg-red-500/10 hover:text-red-400"
                  : "text-gray-700 hover:bg-red-50 hover:text-red-600")
              )}
            >
              {isSigningOut ? (
                <Loader2 size={20} strokeWidth={2} className="animate-spin" />
              ) : (
                <LogOut size={20} strokeWidth={2} />
              )}
              {sidebarOpen && (
                <span className="font-semibold">
                  {isSigningOut ? 'Signing Out...' : 'Sign Out'}
                </span>
              )}

              {/* Tooltip */}
              {!sidebarOpen && !isSigningOut && (
                <span className={clsx(
                  "fixed px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap",
                  "opacity-0 invisible group-hover:opacity-100 group-hover:visible",
                  "transition-all duration-200 pointer-events-none ml-2",
                  darkMode 
                    ? "bg-[#1a1f2e] text-white border border-white/[0.1] shadow-2xl" 
                    : "bg-gray-900 text-white shadow-xl"
                )}
                style={{
                  left: sidebarOpen ? '256px' : '80px',
                  zIndex: 99999
                }}>
                  Sign Out
                  <span 
                    className="absolute right-full top-1/2 -translate-y-1/2 border-[5px] border-transparent"
                    style={{ 
                      borderRightColor: darkMode ? '#1a1f2e' : '#111827'
                    }}
                  />
                </span>
              )}
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300"
          onClick={toggleSidebarClick}
        />
      )}

      {/* HEADER - Fixed at top, positioned after sidebar */}
      <header 
        className={clsx(
          "header-container fixed top-0 right-0 h-16 sm:h-[68px] lg:h-[72px] bg-gradient-to-b from-[#0a0e1a] to-[#0d1220] border-b border-white/[0.06] flex items-center justify-between px-4 sm:px-6 lg:px-8 xl:px-12 safe-area-top z-40 backdrop-blur-xl bg-opacity-95 shadow-[0_1px_0_0_rgba(255,255,255,0.03),0_8px_32px_-8px_rgba(0,0,0,0.4)] transition-all duration-300 ease-in-out",
          "lg:left-64 lg:w-[calc(100%-256px)]",
          !sidebarOpen && "lg:!left-20 lg:!w-[calc(100%-80px)]",
          "left-0 w-full"
        )}
      >
        
        {/* MOBILE LAYOUT (< lg) */}
        <div className="lg:hidden w-full flex items-center justify-between relative">
          {/* Left Actions: Sidebar + Search */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {isAuthenticated && (
              <>
                {/* Sidebar Button */}
                <button 
                  onClick={toggleSidebarClick}
                  onMouseEnter={handleMouseEnterSidebarArea}
                  onMouseLeave={handleMouseLeaveSidebarArea}
                  className="group flex items-center justify-center w-11 h-11 rounded-xl hover:bg-white/[0.06] active:bg-white/[0.04] transition-all duration-200 ease-out"
                  aria-label="Toggle menu"
                >
                  <AnimatedMenuIcon 
                    state={sidebarAnimationState}
                    size={20}
                    className="text-slate-400 group-hover:text-slate-200 transition-colors duration-200"
                  />
                </button>

                {/* Search Button */}
                <button
                  onClick={() => setShowMobileSearch(true)}
                  className="flex items-center justify-center w-11 h-11 rounded-xl hover:bg-white/[0.06] active:bg-white/[0.04] text-slate-400 hover:text-slate-200 transition-all duration-200 ease-out"
                  aria-label="Search"
                >
                  <Search size={20} strokeWidth={2} />
                </button>
              </>
            )}
          </div>

          {/* Center Logo - Absolute Center */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 via-purple-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-[0_4px_20px_rgba(99,102,241,0.35),0_0_0_1px_rgba(255,255,255,0.12)_inset]">
              <GraduationCap className="w-6 h-6 text-white" strokeWidth={2.5} />
            </div>
          </div>

          {/* Right Actions: Notifications + Profile */}
          {isAuthenticated && (
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Notifications */}
              <div className="relative">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="notifications-button relative flex items-center justify-center w-11 h-11 rounded-xl hover:bg-white/[0.06] active:bg-white/[0.04] text-slate-400 hover:text-slate-200 transition-all duration-200 ease-out group"
                  aria-label="Notifications"
                >
                  <Bell size={20} strokeWidth={2} className="group-hover:scale-105 transition-transform duration-200" />
                  {notifications.length > 0 && (
                    <span className="absolute top-1.5 right-1.5 bg-gradient-to-br from-red-500 to-red-600 text-white text-[10px] leading-none rounded-full min-w-[17px] h-[17px] px-1 flex items-center justify-center font-bold shadow-[0_2px_8px_rgba(239,68,68,0.4),0_0_0_2px_#0a0e1a] ring-1 ring-white/10">
                      {notifications.length > 9 ? '9+' : notifications.length}
                    </span>
                  )}
                </button>
                
                {/* Notifications Dropdown - Mobile */}
                {showNotifications && (
                  <div className="notifications-dropdown fixed top-[72px] right-2 w-[calc(100vw-16px)] max-w-[360px] bg-[#0f1419] border border-white/[0.08] rounded-xl shadow-[0_12px_48px_-4px_rgba(0,0,0,0.6),0_0_0_1px_rgba(255,255,255,0.04)_inset] overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
                      <h3 className="text-sm font-bold text-slate-100">Notifications</h3>
                      {notifications.length > 0 && (
                        <button 
                          onClick={() => setNotifications([])}
                          className="text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors duration-150"
                        >
                          Clear all
                        </button>
                      )}
                    </div>
                    <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                      {notifications.length === 0 ? (
                        <div className="px-4 py-8 text-center">
                          <Bell size={32} className="mx-auto mb-3 text-slate-600" strokeWidth={1.5} />
                          <p className="text-sm font-medium text-slate-400">No notifications yet</p>
                          <p className="text-xs text-slate-500 mt-1">We'll notify you when something arrives</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-white/[0.04]">
                          {notifications.map((notification) => (
                            <div 
                              key={notification.id}
                              className={`px-4 py-3 hover:bg-white/[0.02] transition-colors duration-150 group relative ${getNotificationColor(notification.type)} border-l-2`}
                            >
                              <div className="flex items-start gap-3">
                                <span className="text-lg flex-shrink-0 mt-0.5">{getNotificationIcon(notification.type)}</span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-[13px] font-medium leading-snug">{notification.message}</p>
                                  <p className="text-[11px] opacity-70 mt-1">
                                    {new Date(notification.timestamp).toLocaleTimeString('en-US', { 
                                      hour: 'numeric', 
                                      minute: '2-digit',
                                      hour12: true 
                                    })}
                                  </p>
                                </div>
                                <button
                                  onClick={() => removeNotification(notification.id)}
                                  className="flex-shrink-0 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-200 transition-all duration-150 p-1"
                                  aria-label="Dismiss"
                                >
                                  <X size={14} strokeWidth={2} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Profile Avatar */}
              <button
                onClick={() => setShowProfile(true)}
                className="relative flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-purple-600 text-white font-bold text-sm shadow-[0_4px_16px_rgba(99,102,241,0.3),0_0_0_1px_rgba(255,255,255,0.12)_inset] hover:shadow-[0_6px_20px_rgba(99,102,241,0.4),0_0_0_1px_rgba(255,255,255,0.15)_inset] hover:scale-105 active:scale-95 transition-all duration-200 ease-out flex-shrink-0"
                aria-label="Profile"
              >
                {user && getInitials(user.name)}
              </button>
            </div>
          )}
        </div>

        {/* DESKTOP LAYOUT (>= lg) */}
        <div className="hidden lg:flex items-center justify-between w-full">
          {/* Left Section: Search */}
          {isAuthenticated && (
            <div className="flex-1 max-w-xl">
              <form onSubmit={handleSearchSubmit} className="relative">
                <div className="relative">
                  <input 
                    type="text" 
                    value={searchQuery}
                    onChange={handleSearchChange}
                    placeholder="Search courses, content..."
                    className="search-input w-full h-11 bg-white/[0.04] text-slate-100 rounded-xl py-2.5 pl-11 pr-3 text-[14px] placeholder:text-slate-500 border border-white/[0.06] hover:border-white/[0.1] focus:border-indigo-500/40 focus:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all duration-200"
                    style={{ WebkitFontSmoothing: 'antialiased', MozOsxFontSmoothing: 'grayscale' }}
                  />
                  <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" strokeWidth={2} />
                </div>
                
                {/* Search Results Dropdown - Desktop */}
                {showSearchResults && searchQuery && (
                  <div className="search-results absolute top-full left-0 right-0 mt-2 bg-[#0f1419] border border-white/[0.08] rounded-xl shadow-[0_12px_48px_-4px_rgba(0,0,0,0.6),0_0_0_1px_rgba(255,255,255,0.04)_inset] overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="px-3 py-2 border-b border-white/[0.06]">
                      <p className="text-[11px] text-slate-500 font-medium tracking-wide">
                        Results for <span className="text-slate-300 font-semibold">"{searchQuery}"</span>
                      </p>
                    </div>
                    <div className="max-h-[320px] overflow-y-auto custom-scrollbar">
                      {isStudent ? (
                        <>
                          <button className="w-full text-left px-4 py-2.5 hover:bg-white/[0.04] active:bg-white/[0.02] text-slate-200 text-[13px] font-medium transition-all duration-150 border-b border-white/[0.03]">
                            Student Dashboard
                          </button>
                          <button className="w-full text-left px-4 py-2.5 hover:bg-white/[0.04] active:bg-white/[0.02] text-slate-200 text-[13px] font-medium transition-all duration-150 border-b border-white/[0.03]">
                            Content Library
                          </button>
                          <button className="w-full text-left px-4 py-2.5 hover:bg-white/[0.04] active:bg-white/[0.02] text-slate-200 text-[13px] font-medium transition-all duration-150">
                            My Progress
                          </button>
                        </>
                      ) : isTeacher ? (
                        <>
                          <button className="w-full text-left px-4 py-2.5 hover:bg-white/[0.04] active:bg-white/[0.02] text-slate-200 text-[13px] font-medium transition-all duration-150 border-b border-white/[0.03]">
                            Teacher Dashboard
                          </button>
                          <button className="w-full text-left px-4 py-2.5 hover:bg-white/[0.04] active:bg-white/[0.02] text-slate-200 text-[13px] font-medium transition-all duration-150 border-b border-white/[0.03]">
                            Content Upload
                          </button>
                          <button className="w-full text-left px-4 py-2.5 hover:bg-white/[0.04] active:bg-white/[0.02] text-slate-200 text-[13px] font-medium transition-all duration-150">
                            Study Plans
                          </button>
                        </>
                      ) : (
                        <>
                          <button className="w-full text-left px-4 py-2.5 hover:bg-white/[0.04] active:bg-white/[0.02] text-slate-200 text-[13px] font-medium transition-all duration-150 border-b border-white/[0.03]">
                            Content Library
                          </button>
                          <button className="w-full text-left px-4 py-2.5 hover:bg-white/[0.04] active:bg-white/[0.02] text-slate-200 text-[13px] font-medium transition-all duration-150">
                            My Courses
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </form>
            </div>
          )}

          {/* Right Section: Actions */}
          {isAuthenticated && (
            <div className="flex items-center gap-2">
              {/* Notifications */}
              <div className="relative">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="notifications-button relative flex items-center justify-center w-11 h-11 rounded-xl hover:bg-white/[0.06] active:bg-white/[0.04] text-slate-400 hover:text-slate-200 transition-all duration-200 ease-out group"
                  aria-label="Notifications"
                >
                  <Bell size={20} strokeWidth={2} className="group-hover:scale-105 transition-transform duration-200" />
                  {notifications.length > 0 && (
                    <span className="absolute top-1.5 right-1.5 bg-gradient-to-br from-red-500 to-red-600 text-white text-[10px] leading-none rounded-full min-w-[17px] h-[17px] px-1 flex items-center justify-center font-bold shadow-[0_2px_8px_rgba(239,68,68,0.4),0_0_0_2px_#0a0e1a] ring-1 ring-white/10">
                      {notifications.length > 9 ? '9+' : notifications.length}
                    </span>
                  )}
                </button>
                
                {/* Notifications Dropdown - Desktop */}
                {showNotifications && (
                  <div className="notifications-dropdown absolute top-full right-0 mt-2 w-[380px] bg-[#0f1419] border border-white/[0.08] rounded-xl shadow-[0_12px_48px_-4px_rgba(0,0,0,0.6),0_0_0_1px_rgba(255,255,255,0.04)_inset] overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
                      <h3 className="text-sm font-bold text-slate-100">Notifications</h3>
                      {notifications.length > 0 && (
                        <button 
                          onClick={() => setNotifications([])}
                          className="text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors duration-150"
                        >
                          Clear all
                        </button>
                      )}
                    </div>
                    <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                      {notifications.length === 0 ? (
                        <div className="px-4 py-8 text-center">
                          <Bell size={32} className="mx-auto mb-3 text-slate-600" strokeWidth={1.5} />
                          <p className="text-sm font-medium text-slate-400">No notifications yet</p>
                          <p className="text-xs text-slate-500 mt-1">We'll notify you when something arrives</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-white/[0.04]">
                          {notifications.map((notification) => (
                            <div 
                              key={notification.id}
                              className={`px-4 py-3 hover:bg-white/[0.02] transition-colors duration-150 group relative ${getNotificationColor(notification.type)} border-l-2`}
                            >
                              <div className="flex items-start gap-3">
                                <span className="text-lg flex-shrink-0 mt-0.5">{getNotificationIcon(notification.type)}</span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-[13px] font-medium leading-snug">{notification.message}</p>
                                  <p className="text-[11px] opacity-70 mt-1">
                                    {new Date(notification.timestamp).toLocaleTimeString('en-US', { 
                                      hour: 'numeric', 
                                      minute: '2-digit',
                                      hour12: true 
                                    })}
                                  </p>
                                </div>
                                <button
                                  onClick={() => removeNotification(notification.id)}
                                  className="flex-shrink-0 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-200 transition-all duration-150 p-1"
                                  aria-label="Dismiss"
                                >
                                  <X size={14} strokeWidth={2} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Profile Avatar with Name */}
              <button
                onClick={() => setShowProfile(true)}
                className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/[0.06] active:bg-white/[0.04] transition-all duration-200 ease-out group"
                aria-label="Profile"
              >
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs shadow-[0_4px_16px_rgba(99,102,241,0.3),0_0_0_1px_rgba(255,255,255,0.12)_inset] group-hover:shadow-[0_6px_20px_rgba(99,102,241,0.4),0_0_0_1px_rgba(255,255,255,0.15)_inset] transition-shadow duration-200 flex-shrink-0">
                  {user && getInitials(user.name)}
                </div>
                <div className="text-left min-w-0">
                  <span className="block text-sm font-bold text-slate-100 group-hover:text-white transition-colors duration-200 truncate leading-tight">
                    {user?.name}
                  </span>
                  <span className={`text-[11px] capitalize truncate font-medium leading-tight ${
                    isStudent ? 'text-emerald-400' : 
                    isTeacher ? 'text-violet-400' : 
                    'text-blue-400'
                  }`}>
                    {user?.role}
                  </span>
                </div>
              </button>

              {/* Sign Out Button - Desktop Only */}
              <button 
                onClick={handleSignOutClick}
                disabled={isSigningOut}
                className={clsx(
                  "flex items-center justify-center w-11 h-11 rounded-xl transition-all duration-200 ease-out group",
                  isSigningOut 
                    ? "opacity-60 cursor-not-allowed text-slate-400" 
                    : "hover:bg-red-500/10 active:bg-red-500/5 text-slate-400 hover:text-red-400"
                )}
                title={isSigningOut ? "Signing Out..." : "Sign Out"}
                aria-label={isSigningOut ? "Signing Out..." : "Sign Out"}
              >
                {isSigningOut ? (
                  <Loader2 size={19} strokeWidth={2} className="animate-spin" />
                ) : (
                  <LogOut size={19} strokeWidth={2} className="group-hover:scale-105 transition-transform duration-200" />
                )}
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Mobile Search Modal */}
      {showMobileSearch && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 lg:hidden animate-in fade-in duration-200" 
          onClick={() => setShowMobileSearch(false)}
        >
          <div 
            className="absolute top-0 left-0 right-0 bg-gradient-to-b from-[#0f1419] to-[#0a0e1a] px-3 py-4 border-b border-white/[0.06] shadow-[0_8px_32px_rgba(0,0,0,0.4)]" 
            onClick={(e) => e.stopPropagation()}
            style={{ paddingTop: 'max(env(safe-area-inset-top, 0px) + 16px, 16px)' }}
          >
            <div className="flex items-center gap-2.5">
              <form onSubmit={handleSearchSubmit} className="flex-1">
                <div className="relative">
                  <input 
                    type="text" 
                    value={searchQuery}
                    onChange={handleSearchChange}
                    placeholder="Search courses, content..."
                    className="w-full h-11 bg-white/[0.06] text-slate-100 rounded-xl py-2.5 pl-11 pr-3 text-[14px] placeholder:text-slate-500 border border-white/[0.08] focus:border-indigo-500/40 focus:bg-white/[0.08] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all duration-200"
                    autoFocus
                    style={{ WebkitFontSmoothing: 'antialiased', MozOsxFontSmoothing: 'grayscale' }}
                  />
                  <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" strokeWidth={2} />
                </div>
              </form>
              <button
                onClick={() => setShowMobileSearch(false)}
                className="flex items-center justify-center w-11 h-11 text-slate-400 hover:text-slate-200 hover:bg-white/[0.06] active:bg-white/[0.04] rounded-xl transition-all duration-200 flex-shrink-0"
                aria-label="Close"
              >
                <X size={20} strokeWidth={2} />
              </button>
            </div>
            
            {searchQuery && (
              <div className="mt-3 space-y-1">
                <div className="text-[12px] text-slate-500 font-medium tracking-wide px-3 py-1">
                  Results for <span className="text-slate-300 font-semibold">"{searchQuery}"</span>
                </div>
                <div className="space-y-1 max-h-[calc(100vh-180px)] overflow-y-auto custom-scrollbar">
                  {isStudent ? (
                    <>
                      <button className="w-full text-left px-4 py-3 hover:bg-white/[0.06] active:bg-white/[0.04] text-slate-200 rounded-xl text-[14px] font-medium transition-all duration-150">
                        Student Dashboard
                      </button>
                      <button className="w-full text-left px-4 py-3 hover:bg-white/[0.06] active:bg-white/[0.04] text-slate-200 rounded-xl text-[14px] font-medium transition-all duration-150">
                        Content Library
                      </button>
                      <button className="w-full text-left px-4 py-3 hover:bg-white/[0.06] active:bg-white/[0.04] text-slate-200 rounded-xl text-[14px] font-medium transition-all duration-150">
                        My Progress
                      </button>
                    </>
                  ) : isTeacher ? (
                    <>
                      <button className="w-full text-left px-4 py-3 hover:bg-white/[0.06] active:bg-white/[0.04] text-slate-200 rounded-xl text-[14px] font-medium transition-all duration-150">
                        Teacher Dashboard
                      </button>
                      <button className="w-full text-left px-4 py-3 hover:bg-white/[0.06] active:bg-white/[0.04] text-slate-200 rounded-xl text-[14px] font-medium transition-all duration-150">
                        Content Upload
                      </button>
                      <button className="w-full text-left px-4 py-3 hover:bg-white/[0.06] active:bg-white/[0.04] text-slate-200 rounded-xl text-[14px] font-medium transition-all duration-150">
                        Study Plans
                      </button>
                    </>
                  ) : (
                    <>
                      <button className="w-full text-left px-4 py-3 hover:bg-white/[0.06] active:bg-white/[0.04] text-slate-200 rounded-xl text-[14px] font-medium transition-all duration-150">
                        Content Library
                      </button>
                      <button className="w-full text-left px-4 py-3 hover:bg-white/[0.06] active:bg-white/[0.04] text-slate-200 rounded-xl text-[14px] font-medium transition-all duration-150">
                        My Courses
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Profile Modal */}
      {showProfile && isAuthenticated && (
        <Profile
          onClose={() => setShowProfile(false)}
          onSuccess={handleProfileSuccess}
        />
      )}

      {/* Enhanced Styles */}
      <style jsx>{`
        /* Custom Scrollbar */
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(148, 163, 184, 0.2);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(148, 163, 184, 0.3);
        }

        /* Premium Sidebar Scrollbar */
        .premium-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .premium-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .premium-scrollbar::-webkit-scrollbar-thumb {
          background: ${darkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'};
          border-radius: 10px;
          transition: background 0.2s ease;
        }
        .premium-scrollbar::-webkit-scrollbar-thumb:hover {
          background: ${darkMode ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)'};
        }

        /* Smooth Animations */
        @keyframes slide-in-from-top-2 {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-in {
          animation-duration: 200ms;
          animation-fill-mode: both;
        }
        
        .fade-in {
          animation-name: fade-in;
        }
        
        .slide-in-from-top-2 {
          animation-name: slide-in-from-top-2;
        }
        
        @keyframes fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        /* Reduced Motion Support */
        @media (prefers-reduced-motion: reduce) {
          *,
          *::before,
          *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }

        /* High-quality text rendering */
        .header-container,
        aside {
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          text-rendering: optimizeLegibility;
        }

        /* Smooth transitions */
        aside * {
          transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
        }
      `}</style>
    </>
  );
};

export default Navigation;
