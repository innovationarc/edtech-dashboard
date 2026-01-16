//src/components/layout/Sidebar.tsx
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
  MessageSquare // Import MessageSquare icon
} from 'lucide-react';
import { useDashboard } from '../../contexts/DashboardContext';
import clsx from 'clsx';

const Sidebar = () => {
  const { 
    sidebarOpen, 
    user, 
    handleMouseEnterSidebarArea, 
    handleMouseLeaveSidebarArea 
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
    
    // Teacher and Admin routes
    { name: 'Content Upload', icon: <Upload size={20} />, path: '/content', roles: ['admin', 'teacher'] },
    { name: 'Create Course', icon: <PlusCircle size={20} />, path: '/course-creation', roles: ['admin', 'teacher'] },
    { name: 'Study Plan Builder', icon: <Calendar size={20} />, path: '/study-plan', roles: ['admin', 'teacher'] },
    { name: 'Progress & Leaderboard', icon: <Medal size={20} />, path: '/progress', roles: ['admin', 'teacher'] },
    { name: 'Student Questions', icon: <MessageSquare size={20} />, path: '/teacher-qa', roles: ['teacher'] }, // New Teacher Q&A link
    { name: 'Task Management', icon: <FileText size={20} />, path: '/teacher-tasks', roles: ['teacher'] }, // New Teacher Task Management link
    
    // All authenticated users
    { name: 'Content Library', icon: <Library size={20} />, path: '/content-library', roles: ['admin', 'teacher', 'student'] },
    { name: 'Course Enrollment', icon: <ShoppingCart size={20} />, path: '/course-enrollment', roles: ['admin', 'teacher', 'student'] },
    { name: 'MCQ Practice', icon: <Brain size={20} />, path: '/mcq-practice', roles: ['admin', 'teacher', 'student'] },
    { name: 'Ask a Question', icon: <MessageSquare size={20} />, path: '/student-qa', roles: ['student'] }, // New Student Q&A link
    { name: 'Achievements', icon: <Trophy size={20} />, path: '/achievements', roles: ['admin', 'teacher', 'student'] },
    { name: 'My Tasks', icon: <FileText size={20} />, path: '/student-tasks', roles: ['student'] }, // New Student Task Dashboard link
    { name: 'My Study Plan', icon: <Calendar size={20} />, path: '/student-study-plan', roles: ['student'] }, // New Student Study Plan link
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

  return (
    <aside 
      className={clsx(
        "fixed left-0 top-0 h-full bg-background-900 text-white transition-all duration-300 z-10 flex flex-col",
        sidebarOpen ? "w-64" : "w-20"
      )}
      onMouseEnter={handleMouseEnterSidebarArea}
      onMouseLeave={handleMouseLeaveSidebarArea}
    >
      <div className="flex h-16 items-center justify-center border-b border-background-800">
        <div className="flex items-center">
          <div className="h-10 w-10 flex items-center justify-center bg-primary-500 text-white rounded-lg">
            {sidebarConfig.icon}
          </div>
          {sidebarOpen && (
            <span className="ml-3 font-semibold text-lg">
              {sidebarConfig.title}
            </span>
          )}
        </div>
      </div>

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
                  {sidebarOpen && <span className="ml-4">{item.name}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      <div className="p-4">
        <div className="px-2">
          <Link
            to="/"
            className="flex items-center px-4 py-3 text-gray-300 hover:bg-background-800 rounded-lg transition-colors"
          >
            <span className="flex-shrink-0"><LogOut size={20} /></span>
            {sidebarOpen && <span className="ml-4">Sign Out</span>}
          </Link>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
