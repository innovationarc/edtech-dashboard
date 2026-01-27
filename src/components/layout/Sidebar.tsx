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
  X
} from 'lucide-react';
import { useDashboard } from '../../contexts/DashboardContext';
import clsx from 'clsx';
import { useEffect } from 'react';

const Sidebar = () => {
  const { 
    sidebarOpen, 
    user, 
    handleMouseEnterSidebarArea, 
    handleMouseLeaveSidebarArea,
    toggleSidebarClick
  } = useDashboard();
  const location = useLocation();

  const navItems = [
    // Student gets their own dashboard
    { name: 'Student Dashboard', icon: <GraduationCap size={20} />, path: '/student-dashboard', roles: ['student'] },
    
    // Teacher gets their own dashboard
    { name: 'Teacher Dashboard', icon: <BookOpen size={20} />, path: '/teacher-dashboard', roles: ['teacher'] },
    
    // Admin dashboard
    { name: 'Admin Dashboard', icon: <LayoutDashboard size={20} />, path: '/dashboard', roles: ['admin'] },
    
    // Admin-only routes
    { name: 'Manage Users', icon: <Users size={20} />, path: '/users', roles: ['admin'] },
    { name: 'Manage Announcements', icon: <Megaphone size={20} />, path: '/announcements', roles: ['admin'] },
    { name: 'Payment Management', icon: <CreditCard size={20} />, path: '/payments', roles: ['admin'] },
    { name: 'Analytics Dashboard', icon: <BarChart3 size={20} />, path: '/analytics', roles: ['admin'] },
    
    // Teacher and Admin Upload
    { name: 'Content Management', icon: <Upload size={20} />, path: '/content', roles: ['admin', 'teacher'] },
    { name: 'Create Course', icon: <PlusCircle size={20} />, path: '/course-creation', roles: ['admin', 'teacher'] },
    { name: 'Study Plan Builder', icon: <Calendar size={20} />, path: '/study-plan', roles: ['admin', 'teacher'] },
    { name: 'Progress & Leaderboard', icon: <Medal size={20} />, path: '/progress', roles: ['admin', 'teacher'] },
    { name: 'Student Questions', icon: <MessageSquare size={20} />, path: '/teacher-qa', roles: ['teacher'] },
    { name: 'Task Management', icon: <FileText size={20} />, path: '/teacher-tasks', roles: ['teacher'] },
    
    // All authenticated users
    { name: 'Content Library', icon: <Library size={20} />, path: '/content-library', roles: ['admin', 'teacher', 'student'] },
    { name: 'Course Enrollment', icon: <ShoppingCart size={20} />, path: '/course-enrollment', roles: ['admin', 'teacher', 'student'] },
    { name: 'MCQ Practice', icon: <Brain size={20} />, path: '/mcq-practice', roles: ['admin', 'teacher', 'student'] },
    { name: 'Ask a Question', icon: <MessageSquare size={20} />, path: '/student-qa', roles: ['student'] },
    { name: 'Achievements', icon: <Trophy size={20} />, path: '/achievements', roles: ['admin', 'teacher', 'student'] },
    { name: 'My Tasks', icon: <FileText size={20} />, path: '/student-tasks', roles: ['student'] },
    { name: 'My Study Plan', icon: <Calendar size={20} />, path: '/student-study-plan', roles: ['student'] },
    { name: 'Coming Soon', icon: <Clock size={20} />, path: '/coming-soon', roles: ['admin', 'teacher', 'student'] },
    { name: 'Settings', icon: <Settings size={20} />, path: '/settings', roles: ['admin', 'teacher', 'student'] },
  ];

  // Filter navigation items based on user role
  const filteredNavItems = navItems.filter(item => 
    user && item.roles.includes(user.role)
  );

  // Get appropriate title and icon based on user role
  const getSidebarConfig = () => {
    switch (user?.role) {
      case 'student':
        return {
          title: 'Student Portal',
          icon: <GraduationCap size={24} />,
          subtitle: 'Learning Hub'
        };
      case 'teacher':
        return {
          title: 'Teacher Portal',
          icon: <BookOpen size={24} />,
          subtitle: 'Teaching Hub'
        };
      case 'admin':
      default:
        return {
          title: 'Admin Panel',
          icon: <LayoutDashboard size={24} />,
          subtitle: 'Main Menu'
        };
    }
  };

  const sidebarConfig = getSidebarConfig();

  // Close sidebar on mobile when route changes
  useEffect(() => {
    if (window.innerWidth < 1024 && sidebarOpen) {
      toggleSidebarClick();
    }
  }, [location.pathname]);

  // Prevent body scroll when sidebar is open on mobile
  useEffect(() => {
    if (window.innerWidth < 1024) {
      if (sidebarOpen) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = 'unset';
      }
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [sidebarOpen]);

  return (
    <>
      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={toggleSidebarClick}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={clsx(
          "fixed left-0 top-0 h-full bg-background-900 text-white transition-all duration-300 flex flex-col",
          "lg:z-10 z-50",
          // Desktop behavior
          "hidden lg:flex",
          sidebarOpen ? "lg:w-64" : "lg:w-20",
          // Mobile behavior
          "lg:translate-x-0",
          sidebarOpen ? "flex translate-x-0 w-64" : "-translate-x-full w-64"
        )}
        onMouseEnter={handleMouseEnterSidebarArea}
        onMouseLeave={handleMouseLeaveSidebarArea}
      >
        {/* Header */}
        <div className="flex h-16 items-center justify-between px-4 border-b border-background-800">
          <div className="flex items-center min-w-0 flex-1">
            <div className="h-10 w-10 flex items-center justify-center bg-primary-500 text-white rounded-lg flex-shrink-0">
              {sidebarConfig.icon}
            </div>
            {sidebarOpen && (
              <span className="ml-3 font-semibold text-lg truncate">
                {sidebarConfig.title}
              </span>
            )}
          </div>
          
          {/* Close button for mobile */}
          <button
            onClick={toggleSidebarClick}
            className="lg:hidden p-2 hover:bg-background-800 rounded-lg transition-colors flex-shrink-0"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="mt-6 flex-1 overflow-y-auto custom-scrollbar">
          <div>
            <div className="px-4 mb-6">
              {sidebarOpen && (
                <div>
                  <h3 className="text-xs uppercase text-gray-400 font-medium">
                    {sidebarConfig.subtitle}
                  </h3>
                  {user && (
                    <div className="mt-2 text-xs text-gray-500">
                      Role: <span className="text-primary-400 capitalize">{user.role}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <ul className="space-y-1 px-2">
              {filteredNavItems.map((item) => (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    className={clsx(
                      "flex items-center px-4 py-3 rounded-lg transition-colors",
                      location.pathname === item.path 
                        ? "bg-primary-600 text-white" 
                        : "text-gray-300 hover:bg-background-800"
                    )}
                  >
                    <span className="flex-shrink-0">{item.icon}</span>
                    {sidebarOpen && (
                      <span className="ml-4 truncate">{item.name}</span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        {/* Sign Out Button */}
        <div className="p-4 border-t border-background-800">
          <div className="px-2">
            <Link
              to="/"
              className="flex items-center px-4 py-3 text-gray-300 hover:bg-background-800 rounded-lg transition-colors"
            >
              <span className="flex-shrink-0"><LogOut size={20} /></span>
              {sidebarOpen && (
                <span className="ml-4">Sign Out</span>
              )}
            </Link>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
