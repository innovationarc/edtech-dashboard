/* /src/components/layout/Header.tsx */
import React from 'react';
import { useState } from 'react';
import { Bell, Search, Menu, LogOut, X, GraduationCap } from 'lucide-react';
import { useDashboard } from '../../contexts/DashboardContext';
import Profile from '../profile/Profile';
import AnimatedMenuIcon from '../ui/AnimatedMenuIcon'; 

const Header = () => {
  const { 
    toggleSidebarClick,
    handleMouseEnterSidebarArea,
    handleMouseLeaveSidebarArea,
    sidebarAnimationState,
    handleSearch, 
    handleSignOut,
    isAuthenticated, 
    user
  } = useDashboard();
  
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
    try {
      await handleSignOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  // Function to add notifications (can be called from other components)
  const addNotification = (message: string, type: 'success' | 'info' | 'warning' | 'error' = 'info') => {
    const notification = {
      id: Date.now().toString(),
      message,
      type,
      timestamp: new Date()
    };
    setNotifications(prev => [notification, ...prev.slice(0, 4)]); // Keep only 5 notifications
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== notification.id));
    }, 5000);
  };

  // Expose addNotification globally for other components to use
  React.useEffect(() => {
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
    // Reload user data to reflect changes
    window.location.reload();
  };

  // Check if user is admin for certain features
  const isStudent = user?.role === 'student';
  const isTeacher = user?.role === 'teacher';

  // Close dropdowns when clicking outside
  React.useEffect(() => {
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

  return (
    <>
      <header className="header-container h-16 sm:h-[68px] lg:h-[72px] bg-gradient-to-b from-[#0a0e1a] to-[#0d1220] border-b border-white/[0.06] flex items-center justify-between px-4 sm:px-6 lg:px-8 xl:px-12 safe-area-top sticky top-0 z-40 backdrop-blur-xl bg-opacity-95 shadow-[0_1px_0_0_rgba(255,255,255,0.03),0_8px_32px_-8px_rgba(0,0,0,0.4)] relative">
        
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
                    <div className="px-4 py-3.5 border-b border-white/[0.06] bg-white/[0.02]">
                      <div className="flex items-center justify-between">
                        <h3 className="text-[14px] font-semibold text-slate-200 tracking-[-0.01em]">Notifications</h3>
                        <span className="text-[12px] text-slate-500 font-medium">{notifications.length} new</span>
                      </div>
                    </div>
                    <div className="max-h-[420px] overflow-y-auto custom-scrollbar">
                      {notifications.length === 0 ? (
                        <div className="px-4 py-12 text-center">
                          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-white/[0.04] flex items-center justify-center">
                            <Bell size={20} className="text-slate-600" strokeWidth={2} />
                          </div>
                          <p className="text-[13px] text-slate-500 font-medium">No new notifications</p>
                        </div>
                      ) : (
                        notifications.map((notification) => (
                          <div key={notification.id} className="border-b border-white/[0.04] last:border-0">
                            <div className={`px-4 py-3.5 ${getNotificationColor(notification.type)} border-l-2 hover:bg-white/[0.02] transition-colors duration-150`}>
                              <div className="flex gap-3">
                                <div className="flex-shrink-0 text-base mt-0.5 opacity-90">
                                  {getNotificationIcon(notification.type)}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-[13px] leading-relaxed break-words font-medium">
                                    {notification.message}
                                  </p>
                                  <p className="text-[11px] opacity-60 mt-1.5 font-medium">
                                    {notification.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </p>
                                </div>
                                <button
                                  onClick={() => removeNotification(notification.id)}
                                  className="opacity-40 hover:opacity-100 flex-shrink-0 w-6 h-6 flex items-center justify-center hover:bg-white/[0.08] rounded-lg transition-all duration-150"
                                  aria-label="Remove"
                                >
                                  <X size={13} strokeWidth={2.5} />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Profile Button */}
              <button
                className="flex items-center justify-center w-11 h-11 rounded-xl hover:bg-white/[0.06] active:bg-white/[0.04] transition-all duration-200 ease-out group"
                onClick={() => setShowProfile(true)}
                title="Profile"
              >
                <div className={`h-9 w-9 rounded-xl flex items-center justify-center text-white font-semibold text-[14px] shadow-[0_2px_8px_rgba(0,0,0,0.2),0_0_0_1px_rgba(255,255,255,0.1)_inset] transition-transform duration-200 group-hover:scale-105 ${
                  isStudent ? 'bg-gradient-to-br from-emerald-500 to-emerald-600' : 
                  isTeacher ? 'bg-gradient-to-br from-violet-500 to-violet-600' : 
                  'bg-gradient-to-br from-blue-500 to-blue-600'
                }`}>
                  {user?.profilePictureUrl ? (
                    <img
                      src={user.profilePictureUrl}
                      alt="Profile"
                      className="w-full h-full rounded-xl object-cover"
                    />
                  ) : (
                    user?.name.charAt(0).toUpperCase()
                  )}
                </div>
              </button>
            </div>
          )}
        </div>

        {/* DESKTOP LAYOUT (>= lg) */}
        <div className="hidden lg:flex w-full items-center justify-between">
          {/* Left Section - Menu + Logo */}
          <div className="flex items-center gap-4 lg:gap-5 flex-shrink-0">
            {/* Menu button - Only show when authenticated */}
            {isAuthenticated && (
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
            )}
            
            {/* Logo */}
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 via-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-[0_4px_16px_rgba(99,102,241,0.25),0_0_0_1px_rgba(255,255,255,0.1)_inset] hover:shadow-[0_6px_20px_rgba(99,102,241,0.35)] transition-shadow duration-200">
                <GraduationCap className="w-5 h-5 text-white" strokeWidth={2.5} />
              </div>
              <span className="text-[15px] lg:text-[16px] font-semibold text-white tracking-[-0.01em] leading-none">
                EduTech
              </span>
            </div>
          </div>

          {/* Center Section - Desktop Search (Only when authenticated) */}
          {isAuthenticated && (
            <div className="flex flex-1 max-w-xl xl:max-w-2xl mx-6 xl:mx-12">
              <form onSubmit={handleSearchSubmit} className="relative search-input w-full group">
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={handleSearchChange}
                  placeholder="Search courses, content, and more..."
                  className="w-full h-11 bg-white/[0.04] text-slate-100 rounded-xl py-2.5 pl-11 pr-4 text-[14px] leading-tight font-normal tracking-[-0.01em] placeholder:text-slate-500 placeholder:font-normal border border-white/[0.08] hover:border-white/[0.12] focus:border-indigo-500/40 focus:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all duration-200 ease-out"
                  style={{ WebkitFontSmoothing: 'antialiased', MozOsxFontSmoothing: 'grayscale' }}
                />
                <Search 
                  size={17} 
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-slate-400 transition-colors duration-200" 
                  strokeWidth={2}
                />
                
                {/* Search Results Dropdown */}
                {showSearchResults && searchQuery && (
                  <div className="search-results absolute top-full mt-3 w-full bg-[#0f1419] border border-white/[0.08] rounded-xl shadow-[0_12px_48px_-4px_rgba(0,0,0,0.6),0_0_0_1px_rgba(255,255,255,0.04)_inset] overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="px-4 py-3 border-b border-white/[0.06] bg-white/[0.02]">
                      <p className="text-[12px] text-slate-500 font-medium tracking-wide">
                        Results for <span className="text-slate-300 font-semibold">"{searchQuery}"</span>
                      </p>
                    </div>
                    <div className="max-h-[360px] overflow-y-auto py-1.5 custom-scrollbar">
                      {isStudent ? (
                        <>
                          <button className="w-full text-left px-4 py-2.5 hover:bg-white/[0.04] active:bg-white/[0.02] text-slate-200 text-[14px] font-medium transition-colors duration-150 ease-out">
                            Student Dashboard
                          </button>
                          <button className="w-full text-left px-4 py-2.5 hover:bg-white/[0.04] active:bg-white/[0.02] text-slate-200 text-[14px] font-medium transition-colors duration-150 ease-out">
                            Content Library
                          </button>
                          <button className="w-full text-left px-4 py-2.5 hover:bg-white/[0.04] active:bg-white/[0.02] text-slate-200 text-[14px] font-medium transition-colors duration-150 ease-out">
                            My Progress
                          </button>
                          <button className="w-full text-left px-4 py-2.5 hover:bg-white/[0.04] active:bg-white/[0.02] text-slate-200 text-[14px] font-medium transition-colors duration-150 ease-out">
                            Assignments
                          </button>
                          <button className="w-full text-left px-4 py-2.5 hover:bg-white/[0.04] active:bg-white/[0.02] text-slate-200 text-[14px] font-medium transition-colors duration-150 ease-out">
                            Study Resources
                          </button>
                        </>
                      ) : isTeacher ? (
                        <>
                          <button className="w-full text-left px-4 py-2.5 hover:bg-white/[0.04] active:bg-white/[0.02] text-slate-200 text-[14px] font-medium transition-colors duration-150 ease-out">
                            Teacher Dashboard
                          </button>
                          <button className="w-full text-left px-4 py-2.5 hover:bg-white/[0.04] active:bg-white/[0.02] text-slate-200 text-[14px] font-medium transition-colors duration-150 ease-out">
                            Content Upload
                          </button>
                          <button className="w-full text-left px-4 py-2.5 hover:bg-white/[0.04] active:bg-white/[0.02] text-slate-200 text-[14px] font-medium transition-colors duration-150 ease-out">
                            Study Plans
                          </button>
                          <button className="w-full text-left px-4 py-2.5 hover:bg-white/[0.04] active:bg-white/[0.02] text-slate-200 text-[14px] font-medium transition-colors duration-150 ease-out">
                            Student Progress
                          </button>
                          <button className="w-full text-left px-4 py-2.5 hover:bg-white/[0.04] active:bg-white/[0.02] text-slate-200 text-[14px] font-medium transition-colors duration-150 ease-out">
                            Course Materials
                          </button>
                        </>
                      ) : (
                        <>
                          <button className="w-full text-left px-4 py-2.5 hover:bg-white/[0.04] active:bg-white/[0.02] text-slate-200 text-[14px] font-medium transition-colors duration-150 ease-out">
                            Content Library
                          </button>
                          <button className="w-full text-left px-4 py-2.5 hover:bg-white/[0.04] active:bg-white/[0.02] text-slate-200 text-[14px] font-medium transition-colors duration-150 ease-out">
                            My Courses
                          </button>
                          <button className="w-full text-left px-4 py-2.5 hover:bg-white/[0.04] active:bg-white/[0.02] text-slate-200 text-[14px] font-medium transition-colors duration-150 ease-out">
                            Resources
                          </button>
                          <button className="w-full text-left px-4 py-2.5 hover:bg-white/[0.04] active:bg-white/[0.02] text-slate-200 text-[14px] font-medium transition-colors duration-150 ease-out">
                            Settings
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </form>
            </div>
          )}

          {/* Right Section - Desktop Actions */}
          {isAuthenticated && (
            <div className="flex items-center gap-3 flex-shrink-0">
              {/* Notifications */}
              <div className="relative">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="notifications-button relative flex items-center justify-center w-11 h-11 rounded-xl hover:bg-white/[0.06] active:bg-white/[0.04] text-slate-400 hover:text-slate-200 transition-all duration-200 ease-out group"
                  aria-label="Notifications"
                >
                  <Bell size={19} strokeWidth={2} className="group-hover:scale-105 transition-transform duration-200" />
                  {notifications.length > 0 && (
                    <span className="absolute top-1.5 right-1.5 bg-gradient-to-br from-red-500 to-red-600 text-white text-[10px] leading-none rounded-full min-w-[17px] h-[17px] px-1 flex items-center justify-center font-bold shadow-[0_2px_8px_rgba(239,68,68,0.4),0_0_0_2px_#0a0e1a] ring-1 ring-white/10">
                      {notifications.length > 9 ? '9+' : notifications.length}
                    </span>
                  )}
                </button>
                
                {/* Notifications Dropdown */}
                {showNotifications && (
                  <div className="notifications-dropdown absolute top-full right-0 mt-3 w-80 sm:w-[360px] bg-[#0f1419] border border-white/[0.08] rounded-xl shadow-[0_12px_48px_-4px_rgba(0,0,0,0.6),0_0_0_1px_rgba(255,255,255,0.04)_inset] overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="px-4 py-3.5 border-b border-white/[0.06] bg-white/[0.02]">
                      <div className="flex items-center justify-between">
                        <h3 className="text-[14px] font-semibold text-slate-200 tracking-[-0.01em]">Notifications</h3>
                        <span className="text-[12px] text-slate-500 font-medium">{notifications.length} new</span>
                      </div>
                    </div>
                    <div className="max-h-[420px] overflow-y-auto custom-scrollbar">
                      {notifications.length === 0 ? (
                        <div className="px-4 py-12 text-center">
                          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-white/[0.04] flex items-center justify-center">
                            <Bell size={20} className="text-slate-600" strokeWidth={2} />
                          </div>
                          <p className="text-[13px] text-slate-500 font-medium">No new notifications</p>
                        </div>
                      ) : (
                        notifications.map((notification) => (
                          <div key={notification.id} className="border-b border-white/[0.04] last:border-0">
                            <div className={`px-4 py-3.5 ${getNotificationColor(notification.type)} border-l-2 hover:bg-white/[0.02] transition-colors duration-150`}>
                              <div className="flex gap-3">
                                <div className="flex-shrink-0 text-base mt-0.5 opacity-90">
                                  {getNotificationIcon(notification.type)}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-[13px] leading-relaxed break-words font-medium">
                                    {notification.message}
                                  </p>
                                  <p className="text-[11px] opacity-60 mt-1.5 font-medium">
                                    {notification.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </p>
                                </div>
                                <button
                                  onClick={() => removeNotification(notification.id)}
                                  className="opacity-40 hover:opacity-100 flex-shrink-0 w-6 h-6 flex items-center justify-center hover:bg-white/[0.08] rounded-lg transition-all duration-150"
                                  aria-label="Remove"
                                >
                                  <X size={13} strokeWidth={2.5} />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Profile Button */}
              <button
                className="flex items-center gap-2.5 sm:gap-3 bg-white/[0.04] hover:bg-white/[0.06] active:bg-white/[0.04] rounded-xl py-2 pl-2 pr-3 sm:pr-3.5 transition-all duration-200 ease-out border border-white/[0.08] hover:border-white/[0.12] hover:shadow-[0_0_12px_rgba(99,102,241,0.12)] group"
                onClick={() => setShowProfile(true)}
                title="Profile"
              >
                <div className={`h-8 w-8 sm:h-9 sm:w-9 rounded-xl flex items-center justify-center text-white font-semibold text-[13px] sm:text-[14px] flex-shrink-0 shadow-[0_2px_8px_rgba(0,0,0,0.2),0_0_0_1px_rgba(255,255,255,0.1)_inset] transition-transform duration-200 group-hover:scale-105 ${
                  isStudent ? 'bg-gradient-to-br from-emerald-500 to-emerald-600' : 
                  isTeacher ? 'bg-gradient-to-br from-violet-500 to-violet-600' : 
                  'bg-gradient-to-br from-blue-500 to-blue-600'
                }`}>
                  {user?.profilePictureUrl ? (
                    <img
                      src={user.profilePictureUrl}
                      alt="Profile"
                      className="w-full h-full rounded-xl object-cover"
                    />
                  ) : (
                    user?.name.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="flex flex-col min-w-0 items-start gap-0.5">
                  <span className="text-slate-200 text-[13px] sm:text-[14px] font-semibold tracking-[-0.01em] truncate max-w-[100px] lg:max-w-[120px] leading-tight">
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
                className="flex items-center justify-center w-11 h-11 rounded-xl hover:bg-red-500/10 active:bg-red-500/5 text-slate-400 hover:text-red-400 transition-all duration-200 ease-out group"
                title="Sign Out"
                aria-label="Sign Out"
              >
                <LogOut size={19} strokeWidth={2} className="group-hover:scale-105 transition-transform duration-200" />
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
        .header-container {
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          text-rendering: optimizeLegibility;
        }
      `}</style>
    </>
  );
};

export default Header;
