/* /src/components/layout/MobileNavigation.tsx */
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  Upload, 
  Calendar, 
  BarChart3, 
  Settings, 
  Library,
  GraduationCap,
  BookOpen,
  Brain,
  ShoppingCart,
  Trophy,
  FileText,
  MessageSquare
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
          { name: 'Ask Q', icon: <MessageSquare size={20} />, path: '/student-qa' },
          { name: 'Tasks', icon: <FileText size={20} />, path: '/student-tasks' },
          { name: 'Study', icon: <Calendar size={20} />, path: '/student-study-plan' },
          { name: 'Awards', icon: <Trophy size={20} />, path: '/achievements' },
          { name: 'Settings', icon: <Settings size={20} />, path: '/settings' }
        ];
      case 'teacher':
        return [
          { name: 'Dashboard', icon: <BookOpen size={20} />, path: '/teacher-dashboard' },
          { name: 'Upload', icon: <Upload size={20} />, path: '/content' },
          { name: 'Questions', icon: <MessageSquare size={20} />, path: '/teacher-qa' },
          { name: 'Tasks', icon: <FileText size={20} />, path: '/teacher-tasks' },
          ...baseItems,
          { name: 'Awards', icon: <Trophy size={20} />, path: '/achievements' },
          { name: 'Settings', icon: <Settings size={20} />, path: '/settings' }
        ];
      case 'admin':
        return [
          { name: 'Dashboard', icon: <LayoutDashboard size={20} />, path: '/dashboard' },
          { name: 'Users', icon: <Users size={20} />, path: '/users' },
          { name: 'Analytics', icon: <BarChart3 size={20} />, path: '/analytics' },
          { name: 'Awards', icon: <Trophy size={20} />, path: '/achievements' },
          { name: 'Settings', icon: <Settings size={20} />, path: '/settings' }
        ];
      default:
        return [...baseItems, { name: 'Awards', icon: <Trophy size={20} />, path: '/achievements' }, { name: 'Settings', icon: <Settings size={20} />, path: '/settings' }];
    }
  };

  const navItems = getPrimaryNavItems();

  return (
    <nav className="mobile-nav fixed bottom-0 left-0 right-0 bg-background-900 border-t border-background-800 z-30 lg:hidden safe-area-bottom">
      <div className="flex justify-around items-center py-1.5 sm:py-2 px-1 sm:px-2">
        {navItems.slice(0, 5).map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={clsx(
              "flex flex-col items-center justify-center p-1.5 sm:p-2 rounded-lg transition-all duration-200 min-w-0 flex-1 touch-manipulation active:scale-95",
              location.pathname === item.path 
                ? "text-primary-400 bg-background-800 scale-105" 
                : "text-gray-400 hover:text-white hover:bg-background-800"
            )}
          >
            <div className="mb-0.5 sm:mb-1 flex-shrink-0 scale-90 sm:scale-100">
              {item.icon}
            </div>
            <span className="text-[10px] xs:text-xs font-medium truncate w-full text-center px-0.5 sm:px-1 leading-tight">
              {item.name}
            </span>
          </Link>
        ))}
      </div>
    </nav>
  );
};

export default MobileNavigation;
