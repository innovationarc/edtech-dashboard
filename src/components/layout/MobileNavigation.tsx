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
  Library,
  GraduationCap,
  BookOpen,
  Brain,
  ShoppingCart,
  Trophy,
  FileText,
  MessageSquare // Import MessageSquare icon
} from 'lucide-react';
import { useDashboard } from '../../contexts/DashboardContext';
import clsx from 'clsx';

const MobileNavigation = () => {
  const { user } = useDashboard();
  const location = useLocation();

  // Get primary navigation items based on user role
  const getPrimaryNavItems = () => {
    if (!user) return [];

    const baseItems = [
      { name: 'Library', icon: <Library size={20} />, path: '/content-library' },
      { name: 'Courses', icon: <ShoppingCart size={20} />, path: '/course-enrollment' },
      { name: 'Practice', icon: <Brain size={20} />, path: '/mcq-practice' },
    ];

    switch (user.role) {
      case 'student':
        return [
          { name: 'Dashboard', icon: <GraduationCap size={20} />, path: '/student-dashboard' },
          ...baseItems,
          { name: 'Ask Q', icon: <MessageSquare size={20} />, path: '/student-qa' }, // New Student Q&A link
          { name: 'My Tasks', icon: <FileText size={20} />, path: '/student-tasks' }, // New Student Task Dashboard link
          { name: 'Study Plan', icon: <Calendar size={20} />, path: '/student-study-plan' }, // New Student Study Plan link
          { name: 'Achievements', icon: <Trophy size={20} />, path: '/achievements' },
          { name: 'Settings', icon: <Settings size={20} />, path: '/settings' }
        ];
      case 'teacher':
        return [
          { name: 'Dashboard', icon: <BookOpen size={20} />, path: '/teacher-dashboard' },
          { name: 'Upload', icon: <Upload size={20} />, path: '/content' },
          { name: 'Questions', icon: <MessageSquare size={20} />, path: '/teacher-qa' }, // New Teacher Q&A link
          { name: 'Tasks', icon: <FileText size={20} />, path: '/teacher-tasks' }, // New Teacher Task Management link
          ...baseItems,
          { name: 'Achievements', icon: <Trophy size={20} />, path: '/achievements' },
          { name: 'Settings', icon: <Settings size={20} />, path: '/settings' }
        ];
      case 'admin':
        return [
          { name: 'Dashboard', icon: <LayoutDashboard size={20} />, path: '/dashboard' },
          { name: 'Users', icon: <Users size={20} />, path: '/users' },
          { name: 'Analytics', icon: <BarChart3 size={20} />, path: '/analytics' },
          { name: 'Achievements', icon: <Trophy size={20} />, path: '/achievements' },
          { name: 'Settings', icon: <Settings size={20} />, path: '/settings' }
        ];
      default:
        return [...baseItems, { name: 'Achievements', icon: <Trophy size={20} />, path: '/achievements' }, { name: 'Settings', icon: <Settings size={20} />, path: '/settings' }];
    }
  };

  const navItems = getPrimaryNavItems();

  return (
    <nav className="mobile-nav">
      <div className="flex justify-around items-center py-2 px-4">
        {navItems.slice(0, 5).map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={clsx(
              "flex flex-col items-center justify-center p-2 rounded-lg transition-colors min-w-0 flex-1",
              location.pathname === item.path 
                ? "text-primary-400" 
                : "text-gray-400 hover:text-white"
            )}
          >
            <div className="mb-1">
              {item.icon}
            </div>
            <span className="text-xs font-medium truncate w-full text-center">
              {item.name}
            </span>
          </Link>
        ))}
      </div>
    </nav>
  );
};

export default MobileNavigation;
