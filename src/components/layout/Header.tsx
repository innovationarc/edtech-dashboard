import React from 'react';
import { useState } from 'react';
import { Bell, Search, Menu, CreditCard, LogOut, UserPlus, X } from 'lucide-react';
import { useDashboard } from '../../contexts/DashboardContext';
import SignInModal from '../auth/SignInModal';
import RegisterModal from '../auth/RegisterModal';
import PaymentModal from '../payment/PaymentModal';
import ProfileEditModal from '../profile/ProfileEditModal';

const Header = () => {
  const { 
    toggleSidebarClick,
    handleMouseEnterSidebarArea,
    handleMouseLeaveSidebarArea,
    handleSearch, 
    handleSignOut,
    isAuthenticated, 
    user,
    showPaymentModal,
    setShowPaymentModal 
  } = useDashboard();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [showSignInModal, setShowSignInModal] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [showProfileEditModal, setShowProfileEditModal] = useState(false);
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

  const handleRegisterSuccess = () => {
    setShowRegisterModal(false);
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

  const handleProfileEditSuccess = () => {
    setShowProfileEditModal(false);
    // Reload user data to reflect changes
    window.location.reload();
  };

  // Check if user is admin for certain features
  const isAdmin = user?.role === 'admin';
  const isStudent = user?.role === 'student';
  const isTeacher = user?.role === 'teacher';

  // Get appropriate breadcrumb based on user role
  const getBreadcrumb = () => {
    if (isStudent) {
      return {
        section: 'Student Portal',
        page: 'Learning Dashboard'
      };
    } else if (isTeacher) {
      return {
        section: 'Teacher Portal',
        page: 'Teaching Dashboard'
      };
    } else {
      return {
        section: 'Pages / Dashboard',
        page: 'Admin Dashboard'
      };
    }
  };

  const breadcrumb = getBreadcrumb();

  return (
    <>
      <header className="h-16 bg-background-900 border-b border-background-800 flex items-center justify-between px-4 lg:px-6 safe-area-top">
        <div className="flex items-center flex-1 min-w-0">
          {/* Desktop menu button */}
          <button 
            onClick={toggleSidebarClick}
            onMouseEnter={handleMouseEnterSidebarArea}
            onMouseLeave={handleMouseLeaveSidebarArea}
            className="hidden lg:flex p-2 rounded-full hover:bg-background-800 transition-colors mr-4"
          >
            <Menu size={20} className="text-gray-300" />
          </button>
          
          {/* Mobile search button */}
          <button
            onClick={() => setShowMobileSearch(true)}
            className="lg:hidden p-2 rounded-full hover:bg-background-800 transition-colors mr-2"
          >
            <Search size={20} className="text-gray-300" />
          </button>
          
          {/* Breadcrumb - hidden on mobile */}
          <div className="hidden sm:block min-w-0 flex-1">
            <div className="text-xs text-gray-400 truncate">{breadcrumb.section}</div>
            <h1 className="text-white font-medium truncate">{breadcrumb.page}</h1>
          </div>
        </div>
        
        <div className="flex items-center space-x-2 lg:space-x-4">
          {/* Desktop search */}
          <div className="hidden lg:block relative">
            <form onSubmit={handleSearchSubmit}>
              <input 
                type="text" 
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder={
                  isStudent ? "Search content..." : 
                  isTeacher ? "Search materials..." : 
                  "Search..."
                } 
                className="bg-background-800 text-white rounded-full py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 w-64"
              />
              <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
            </form>

            {showSearchResults && searchQuery && (
              <div className="absolute top-full mt-2 w-full bg-background-800 rounded-lg shadow-lg overflow-hidden z-50">
                <div className="p-2">
                  <div className="text-sm text-gray-400 px-3 py-2">
                    Search results for "{searchQuery}"
                  </div>
                  <div className="border-t border-background-700">
                    {isStudent ? (
                      <>
                        <button className="w-full text-left px-3 py-2 hover:bg-background-700 text-white text-sm">
                          Student Dashboard
                        </button>
                        <button className="w-full text-left px-3 py-2 hover:bg-background-700 text-white text-sm">
                          Content Library
                        </button>
                        <button className="w-full text-left px-3 py-2 hover:bg-background-700 text-white text-sm">
                          My Progress
                        </button>
                      </>
                    ) : isTeacher ? (
                      <>
                        <button className="w-full text-left px-3 py-2 hover:bg-background-700 text-white text-sm">
                          Teacher Dashboard
                        </button>
                        <button className="w-full text-left px-3 py-2 hover:bg-background-700 text-white text-sm">
                          Content Upload
                        </button>
                        <button className="w-full text-left px-3 py-2 hover:bg-background-700 text-white text-sm">
                          Study Plans
                        </button>
                        <button className="w-full text-left px-3 py-2 hover:bg-background-700 text-white text-sm">
                          Student Progress
                        </button>
                      </>
                    ) : (
                      <>
                        <button className="w-full text-left px-3 py-2 hover:bg-background-700 text-white text-sm">
                          Content Library
                        </button>
                        <button className="w-full text-left px-3 py-2 hover:bg-background-700 text-white text-sm">
                          My Courses
                        </button>
                        <button className="w-full text-left px-3 py-2 hover:bg-background-700 text-white text-sm">
                          Course Enrollment
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Admin payment button */}
          {isAuthenticated && isAdmin && (
            <button 
              onClick={() => setShowPaymentModal(true)}
              className="hidden sm:flex p-2 rounded-full hover:bg-background-800 relative text-gray-300 hover:text-white transition-colors"
              title="Payment Management"
            >
              <CreditCard size={20} />
            </button>
          )}
          
          {/* Notifications */}
          <div className="relative">
            <button 
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2 rounded-full hover:bg-background-800 relative transition-colors"
            >
            <Bell size={20} className="text-gray-300" />
              {notifications.length > 0 && (
                <span className="absolute top-0 right-0 h-2 w-2 bg-red-500 rounded-full"></span>
              )}
            </button>

            {/* Notifications Dropdown */}
            {showNotifications && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-background-800 rounded-lg shadow-lg overflow-hidden z-50 border border-background-700">
                <div className="p-3 border-b border-background-700">
                  <h3 className="text-white font-medium">Notifications</h3>
                </div>
                
                {notifications.length === 0 ? (
                  <div className="p-4 text-center text-gray-400">
                    <Bell size={32} className="mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No new notifications</p>
                  </div>
                ) : (
                  <div className="max-h-64 overflow-y-auto">
                    {notifications.map((notification) => (
                      <div
                        key={notification.id}
                        className={`p-3 border-l-4 border-b border-background-700 last:border-b-0 ${getNotificationColor(notification.type)}`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-2 flex-1">
                            <span className="text-sm">{getNotificationIcon(notification.type)}</span>
                            <div className="flex-1">
                              <p className="text-sm font-medium">{notification.message}</p>
                              <p className="text-xs opacity-75 mt-1">
                                {notification.timestamp.toLocaleTimeString()}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => removeNotification(notification.id)}
                            className="text-xs opacity-50 hover:opacity-100 ml-2"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* User section */}
          <div className="flex items-center">
            {isAuthenticated ? (
              <div className="flex items-center space-x-2">
                <div 
                  className="flex items-center space-x-2 bg-background-800 rounded-full py-1 pl-1 pr-3 cursor-pointer hover:bg-background-700 transition-colors"
                  onClick={() => setShowProfileEditModal(true)}
                  title="Click to edit profile"
                >
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center text-white font-medium ${
                    isStudent ? 'bg-accent-700' : 
                    isTeacher ? 'bg-secondary-700' : 
                    'bg-primary-700'
                  }`}>
                    {user?.profilePictureUrl ? (
                      <img
                        src={user.profilePictureUrl}
                        alt="Profile"
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      user?.name.charAt(0)
                    )}
                  </div>
                  <div className="hidden sm:flex flex-col">
                    <span className="text-white text-sm truncate max-w-24">{user?.name}</span>
                    <span className={`text-xs capitalize ${
                      isStudent ? 'text-accent-400' : 
                      isTeacher ? 'text-secondary-400' : 
                      'text-gray-400'
                    }`}>
                      {user?.role}
                    </span>
                  </div>
                </div>
                <button 
                  onClick={handleSignOutClick}
                  className="p-2 rounded-full hover:bg-background-800 text-gray-300 hover:text-white transition-colors"
                  title="Sign Out"
                >
                  <LogOut size={18} />
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <button 
                  onClick={() => setShowRegisterModal(true)}
                  className="hidden sm:flex items-center space-x-2 bg-primary-600 hover:bg-primary-700 rounded-full py-1 pl-1 pr-3 transition-colors"
                >
                  <div className="h-8 w-8 rounded-full bg-primary-800 flex items-center justify-center text-white font-medium">
                    <UserPlus size={16} />
                  </div>
                  <span className="text-white text-sm">Register</span>
                </button>
                
                <button 
                  onClick={() => setShowSignInModal(true)}
                  className="flex items-center space-x-2 bg-background-800 rounded-full py-1 pl-1 pr-3 hover:bg-background-700 transition-colors"
                >
                  <div className="h-8 w-8 rounded-full bg-primary-700 flex items-center justify-center text-white font-medium">
                    S
                  </div>
                  <span className="hidden sm:inline text-white text-sm">Sign In</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Search Modal */}
      {showMobileSearch && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 lg:hidden">
          <div className="bg-background-900 p-4 safe-area-top">
            <div className="flex items-center gap-3">
              <form onSubmit={handleSearchSubmit} className="flex-1">
                <div className="relative">
                  <input 
                    type="text" 
                    value={searchQuery}
                    onChange={handleSearchChange}
                    placeholder="Search..."
                    className="w-full bg-background-800 text-white rounded-lg py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    autoFocus
                  />
                  <Search size={18} className="absolute left-3 top-3.5 text-gray-400" />
                </div>
              </form>
              <button
                onClick={() => setShowMobileSearch(false)}
                className="p-2 text-gray-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>
            
            {searchQuery && (
              <div className="mt-4 space-y-2">
                <div className="text-sm text-gray-400 px-3 py-2">
                  Search results for "{searchQuery}"
                </div>
                <div className="space-y-1">
                  {isStudent ? (
                    <>
                      <button className="w-full text-left px-3 py-3 hover:bg-background-800 text-white rounded-lg">
                        Student Dashboard
                      </button>
                      <button className="w-full text-left px-3 py-3 hover:bg-background-800 text-white rounded-lg">
                        Content Library
                      </button>
                      <button className="w-full text-left px-3 py-3 hover:bg-background-800 text-white rounded-lg">
                        My Progress
                      </button>
                    </>
                  ) : isTeacher ? (
                    <>
                      <button className="w-full text-left px-3 py-3 hover:bg-background-800 text-white rounded-lg">
                        Teacher Dashboard
                      </button>
                      <button className="w-full text-left px-3 py-3 hover:bg-background-800 text-white rounded-lg">
                        Content Upload
                      </button>
                      <button className="w-full text-left px-3 py-3 hover:bg-background-800 text-white rounded-lg">
                        Study Plans
                      </button>
                    </>
                  ) : (
                    <>
                      <button className="w-full text-left px-3 py-3 hover:bg-background-800 text-white rounded-lg">
                        Content Library
                      </button>
                      <button className="w-full text-left px-3 py-3 hover:bg-background-800 text-white rounded-lg">
                        My Courses
                      </button>
                      <button className="w-full text-left px-3 py-3 hover:bg-background-800 text-white rounded-lg">
                        Course Enrollment
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      {showSignInModal && (
        <SignInModal onClose={() => setShowSignInModal(false)} />
      )}

      {showRegisterModal && (
        <RegisterModal 
          onClose={() => setShowRegisterModal(false)} 
          onSuccess={handleRegisterSuccess}
        />
      )}

      {showPaymentModal && isAdmin && (
        <PaymentModal onClose={() => setShowPaymentModal(false)} />
      )}

      {showProfileEditModal && isAuthenticated && (user?.role === 'student' || user?.role === 'teacher') && (
        <ProfileEditModal
          onClose={() => setShowProfileEditModal(false)}
          onSuccess={handleProfileEditSuccess}
        />
      )}
    </>
  );
};

export default Header;