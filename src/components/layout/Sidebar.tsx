/* /src/components/layout/Sidebar.tsx */
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  Upload, 
  Calendar, 
  Medal, 
  BarChart3, 
  Settings, 
  Clock, 
  LogOut,
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
  X,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon
} from 'lucide-react';
import { useDashboard } from '../../contexts/DashboardContext';
import clsx from 'clsx';
import { useEffect, useState } from 'react';
import Profile from '../profile/Profile';

const Sidebar = () => {
  const { 
    sidebarOpen, 
    user, 
    handleMouseEnterSidebarArea, 
    handleMouseLeaveSidebarArea,
    toggleSidebarClick,
    handleSignOut
  } = useDashboard();
  const location = useLocation();
  const [showProfile, setShowProfile] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('sidebarTheme');
    return saved ? saved === 'dark' : true; // Default to dark
  });

  useEffect(() => {
    localStorage.setItem('sidebarTheme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

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

  const getSidebarConfig = () => {
    switch (user?.role) {
      case 'student':
        return {
          title: 'Student Portal',
          // Dark mode: Vibrant emerald-cyan gradient
          darkGradient: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)',
          darkGlow: 'rgba(16, 185, 129, 0.15)',
          darkAccent: '#10b981',
          darkAccentRgb: '16, 185, 129',
          darkRoleBg: 'rgba(16, 185, 129, 0.15)',
          darkRoleText: '#34d399',
          // Light mode: Professional indigo
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
          // Dark mode: Vibrant purple-pink gradient
          darkGradient: 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)',
          darkGlow: 'rgba(168, 85, 247, 0.15)',
          darkAccent: '#a855f7',
          darkAccentRgb: '168, 85, 247',
          darkRoleBg: 'rgba(168, 85, 247, 0.15)',
          darkRoleText: '#c084fc',
          // Light mode: Professional rose
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
          // Dark mode: Vibrant blue-indigo gradient
          darkGradient: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
          darkGlow: 'rgba(59, 130, 246, 0.15)',
          darkAccent: '#3b82f6',
          darkAccentRgb: '59, 130, 246',
          darkRoleBg: 'rgba(59, 130, 246, 0.15)',
          darkRoleText: '#60a5fa',
          // Light mode: Professional navy blue
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
  
  // Select colors based on dark/light mode
  const sidebarConfig = {
    title: config.title,
    gradient: darkMode ? config.darkGradient : config.lightGradient,
    glowColor: darkMode ? config.darkGlow : config.lightGlow,
    accent: darkMode ? config.darkAccent : config.lightAccent,
    accentRgb: darkMode ? config.darkAccentRgb : config.lightAccentRgb,
    roleBg: darkMode ? config.darkRoleBg : config.lightRoleBg,
    roleText: darkMode ? config.darkRoleText : config.lightRoleText
  };

  useEffect(() => {
    if (window.innerWidth < 1024 && sidebarOpen) {
      toggleSidebarClick();
    }
  }, [location.pathname]);

  useEffect(() => {
    if (window.innerWidth < 1024) {
      document.body.style.overflow = sidebarOpen ? 'hidden' : 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [sidebarOpen]);

  const getInitials = (name: string) => {
    const names = name.trim().split(' ');
    if (names.length === 1) return names[0].charAt(0).toUpperCase();
    return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
  };

  const getSurname = (name: string) => {
    const names = name.trim().split(' ');
    return names.length > 1 ? names[names.length - 1] : '';
  };

  const handleSignOutClick = async () => {
    try {
      await handleSignOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleProfileSuccess = () => {
    setShowProfile(false);
    window.location.reload();
  };

  return (
    <>
      {/* Premium Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden transition-all duration-300"
          onClick={toggleSidebarClick}
        />
      )}

      {/* Premium Sidebar */}
      <aside 
        className={clsx(
          "fixed left-0 top-0 h-full flex flex-col z-50 transition-all duration-500 ease-out",
          "lg:relative",
          sidebarOpen ? "lg:w-72" : "lg:w-20",
          sidebarOpen ? "translate-x-0 w-72" : "-translate-x-full w-72",
          darkMode 
            ? "bg-[#0a0e1a]" 
            : "bg-white",
          darkMode 
            ? "border-r border-white/[0.06]" 
            : "border-r border-gray-200",
          "shadow-[0_0_60px_-15px_rgba(0,0,0,0.3)]"
        )}
        onMouseEnter={handleMouseEnterSidebarArea}
        onMouseLeave={handleMouseLeaveSidebarArea}
      >
        {/* Subtle Glow Effect */}
        <div 
          className="absolute top-0 left-0 w-full h-40 pointer-events-none opacity-30"
          style={{
            background: darkMode ? sidebarConfig.glowColor : 'transparent',
            filter: 'blur(80px)',
            transform: 'translateY(-30px)'
          }}
        />

        {/* Header */}
        <div className={clsx(
          "relative flex items-center h-[72px] px-5 flex-shrink-0 border-b",
          darkMode ? "border-white/[0.06]" : "border-gray-200",
          !sidebarOpen && "lg:justify-center lg:px-3"
        )}>
          {sidebarOpen ? (
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-3">
                <div 
                  className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg relative overflow-hidden"
                  style={{ 
                    background: sidebarConfig.gradient
                  }}
                >
                  <GraduationCap size={20} className="text-white relative z-10" strokeWidth={2.5} />
                </div>
                <h1 className={clsx(
                  "text-base font-bold tracking-tight",
                  darkMode ? "text-white" : "text-gray-900"
                )}>
                  {sidebarConfig.title}
                </h1>
              </div>
              <button
                onClick={toggleSidebarClick}
                className={clsx(
                  "lg:hidden p-2 rounded-xl transition-all duration-200",
                  darkMode 
                    ? "hover:bg-white/[0.06] text-slate-400 hover:text-white" 
                    : "hover:bg-gray-100 text-gray-500 hover:text-gray-700"
                )}
              >
                <X size={20} strokeWidth={2} />
              </button>
            </div>
          ) : (
            <div 
              className="hidden lg:flex items-center justify-center w-11 h-11 rounded-xl shadow-lg relative overflow-hidden"
              style={{ background: sidebarConfig.gradient }}
            >
              <GraduationCap size={18} className="text-white" strokeWidth={2.5} />
            </div>
          )}

          {/* Desktop Toggle */}
          <button
            onClick={toggleSidebarClick}
            className={clsx(
              "hidden lg:flex absolute -right-3 top-[28px]",
              "items-center justify-center w-7 h-7 rounded-full",
              "shadow-lg transition-all duration-300 hover:scale-110",
              darkMode 
                ? "bg-[#1a1f2e] border border-white/[0.08] text-slate-300 hover:text-white" 
                : "bg-white border border-gray-200 text-gray-600 hover:text-gray-900"
            )}
          >
            {sidebarOpen ? <ChevronLeft size={14} strokeWidth={3} /> : <ChevronRight size={14} strokeWidth={3} />}
          </button>
        </div>

        {/* Premium Profile Card - Clickable */}
        {sidebarOpen && user && (
          <button
            onClick={() => setShowProfile(true)}
            className={clsx(
              "mx-4 my-4 p-4 rounded-2xl relative overflow-hidden transition-all duration-200 text-left w-[calc(100%-2rem)]",
              darkMode 
                ? "bg-white/[0.03] hover:bg-white/[0.05] border border-white/[0.08] hover:border-white/[0.12]" 
                : "bg-gray-50 hover:bg-gray-100 border border-gray-200 hover:border-gray-300"
            )}
          >
            <div className="flex items-center gap-3.5 relative z-10">
              {/* Profile Image */}
              <div className="relative flex-shrink-0">
                {user.profilePictureUrl ? (
                  <img
                    src={user.profilePictureUrl}
                    alt={user.name}
                    className="w-12 h-12 rounded-xl object-cover ring-2 ring-offset-2 shadow-md"
                    style={{ 
                      ringColor: sidebarConfig.accent,
                      ringOffsetColor: darkMode ? '#0a0e1a' : '#ffffff'
                    }}
                  />
                ) : (
                  <div 
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-base shadow-md"
                    style={{ 
                      background: sidebarConfig.gradient
                    }}
                  >
                    {getInitials(user.name)}
                  </div>
                )}
                {/* Online Status */}
                <div 
                  className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2"
                  style={{ 
                    backgroundColor: '#10b981',
                    borderColor: darkMode ? '#0a0e1a' : '#ffffff'
                  }}
                />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className={clsx(
                  "text-sm font-bold truncate",
                  darkMode ? "text-white" : "text-gray-900"
                )}>
                  {user.name}
                </div>
                {getSurname(user.name) && (
                  <div className={clsx(
                    "text-xs font-medium truncate mt-0.5",
                    darkMode ? "text-slate-400" : "text-gray-600"
                  )}>
                    {getSurname(user.name)}
                  </div>
                )}
                <div 
                  className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold capitalize mt-1.5"
                  style={{ 
                    background: sidebarConfig.roleBg,
                    color: sidebarConfig.roleText
                  }}
                >
                  {user.role}
                </div>
              </div>
            </div>
          </button>
        )}

        {/* Collapsed Profile - Clickable */}
        {!sidebarOpen && user && (
          <button
            onClick={() => setShowProfile(true)}
            className={clsx(
              "hidden lg:flex justify-center px-3 py-3 border-b transition-all duration-200",
              darkMode 
                ? "border-white/[0.06] hover:bg-white/[0.04]" 
                : "border-gray-200 hover:bg-gray-50"
            )}
          >
            <div className="relative">
              {user.profilePictureUrl ? (
                <img
                  src={user.profilePictureUrl}
                  alt={user.name}
                  className="w-11 h-11 rounded-xl object-cover ring-2 shadow-md"
                  style={{ 
                    ringColor: sidebarConfig.accent
                  }}
                />
              ) : (
                <div 
                  className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-md"
                  style={{ 
                    background: sidebarConfig.gradient
                  }}
                >
                  {getInitials(user.name)}
                </div>
              )}
              <div 
                className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2"
                style={{ 
                  backgroundColor: '#10b981',
                  borderColor: darkMode ? '#0a0e1a' : '#ffffff'
                }}
              />
            </div>
          </button>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-2 px-3 premium-scrollbar">
          <ul className="space-y-0.5">
            {filteredNavItems.map((item) => {
              const isActive = location.pathname === item.path;
              
              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    className={clsx(
                      "group relative flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-[13px] transition-all duration-200",
                      !sidebarOpen && "lg:justify-center lg:px-0 lg:w-14 lg:mx-auto",
                      isActive 
                        ? "text-white shadow-lg"
                        : darkMode
                          ? "text-slate-400 hover:bg-white/[0.06] hover:text-white"
                          : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                    )}
                    style={isActive ? { 
                      background: sidebarConfig.gradient,
                      boxShadow: `0 4px 12px -2px rgba(${sidebarConfig.accentRgb}, 0.3)`
                    } : {}}
                  >
                    <span className={clsx(
                      "flex-shrink-0 transition-transform duration-200",
                      isActive && "scale-110"
                    )}>
                      {item.icon}
                    </span>
                    
                    {sidebarOpen && (
                      <span className="truncate font-semibold">
                        {item.name}
                      </span>
                    )}
                    
                    {/* Tooltip */}
                    {!sidebarOpen && (
                      <div className={clsx(
                        "absolute left-full ml-2 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap",
                        "opacity-0 invisible group-hover:opacity-100 group-hover:visible",
                        "transition-all duration-200 pointer-events-none z-50",
                        darkMode 
                          ? "bg-[#1a1f2e] text-white border border-white/[0.1] shadow-2xl" 
                          : "bg-gray-900 text-white shadow-xl"
                      )}>
                        {item.name}
                        <div 
                          className="absolute right-full top-1/2 -translate-y-1/2 border-[5px] border-transparent"
                          style={{ 
                            borderRightColor: darkMode ? '#1a1f2e' : '#111827'
                          }}
                        />
                      </div>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer */}
        <div className={clsx(
          "border-t flex-shrink-0",
          darkMode ? "border-white/[0.06]" : "border-gray-200"
        )}>
          {/* Animated Theme Toggle */}
          <div className="p-3">
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={clsx(
                "w-full group relative flex items-center h-11 rounded-xl font-medium text-[13px] transition-all duration-200 overflow-hidden",
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
                  {/* Animated Toggle Switch */}
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
              
              {!sidebarOpen && (
                <div className={clsx(
                  "absolute left-full ml-2 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap",
                  "opacity-0 invisible group-hover:opacity-100 group-hover:visible",
                  "transition-all duration-200 pointer-events-none z-50",
                  darkMode 
                    ? "bg-[#1a1f2e] text-white border border-white/[0.1] shadow-2xl" 
                    : "bg-gray-900 text-white shadow-xl"
                )}>
                  Toggle Theme
                  <div 
                    className="absolute right-full top-1/2 -translate-y-1/2 border-[5px] border-transparent"
                    style={{ 
                      borderRightColor: darkMode ? '#1a1f2e' : '#111827'
                    }}
                  />
                </div>
              )}
            </button>
          </div>

          {/* Settings */}
          <div className={clsx(
            "p-3 border-t",
            darkMode ? "border-white/[0.06]" : "border-gray-200"
          )}>
            <Link
              to="/settings"
              className={clsx(
                "group relative flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-[13px] transition-all duration-200",
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
              
              {!sidebarOpen && (
                <div className={clsx(
                  "absolute left-full ml-2 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap",
                  "opacity-0 invisible group-hover:opacity-100 group-hover:visible",
                  "transition-all duration-200 pointer-events-none z-50",
                  darkMode 
                    ? "bg-[#1a1f2e] text-white border border-white/[0.1] shadow-2xl" 
                    : "bg-gray-900 text-white shadow-xl"
                )}>
                  Settings
                  <div 
                    className="absolute right-full top-1/2 -translate-y-1/2 border-[5px] border-transparent"
                    style={{ 
                      borderRightColor: darkMode ? '#1a1f2e' : '#111827'
                    }}
                  />
                </div>
              )}
            </Link>
          </div>

          {/* Logout */}
          <div className="p-3">
            <button
              onClick={handleSignOutClick}
              className={clsx(
                "group relative flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-[13px] transition-all duration-200 w-full",
                !sidebarOpen && "lg:justify-center lg:px-0",
                darkMode
                  ? "text-slate-400 hover:bg-red-500/10 hover:text-red-400"
                  : "text-gray-700 hover:bg-red-50 hover:text-red-600"
              )}
            >
              <LogOut size={20} strokeWidth={2} />
              {sidebarOpen && <span className="font-semibold">Sign Out</span>}
              
              {!sidebarOpen && (
                <div className={clsx(
                  "absolute left-full ml-2 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap",
                  "opacity-0 invisible group-hover:opacity-100 group-hover:visible",
                  "transition-all duration-200 pointer-events-none z-50",
                  darkMode 
                    ? "bg-[#1a1f2e] text-white border border-white/[0.1] shadow-2xl" 
                    : "bg-gray-900 text-white shadow-xl"
                )}>
                  Sign Out
                  <div 
                    className="absolute right-full top-1/2 -translate-y-1/2 border-[5px] border-transparent"
                    style={{ 
                      borderRightColor: darkMode ? '#1a1f2e' : '#111827'
                    }}
                  />
                </div>
              )}
            </button>
          </div>
        </div>
      </aside>

      {/* Profile Modal */}
      {showProfile && (
        <Profile
          onClose={() => setShowProfile(false)}
          onSuccess={handleProfileSuccess}
        />
      )}

      <style jsx>{`
        /* Ultra-smooth premium scrollbar */
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

        /* Premium text rendering */
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

export default Sidebar;
