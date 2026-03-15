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

const hexRgb = (hex: string) => {
  if (!hex || hex.length < 7) return '99,102,241';
  return `${parseInt(hex.slice(1,3),16)},${parseInt(hex.slice(3,5),16)},${parseInt(hex.slice(5,7),16)}`;
};

const MobileNavigation = () => {
  const { user, theme, primaryColor, accentColor } = useDashboard();
  const location = useLocation();
  const darkMode = theme !== 'light';
  const pRgb = hexRgb(primaryColor);
  const gradient = `linear-gradient(135deg,${primaryColor} 0%,${accentColor} 100%)`;
  const navBg    = darkMode ? 'rgba(13,16,23,0.96)'          : 'rgba(255,255,255,0.96)';
  const navBorder = darkMode ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.08)';

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
    <nav
      className="mobile-nav lg:hidden safe-area-bottom"
      style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 30,
        background: navBg,
        borderTop: navBorder,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow: darkMode ? '0 -2px 16px rgba(0,0,0,0.3)' : '0 -2px 12px rgba(0,0,0,0.07)',
        fontFamily: "'Outfit', sans-serif",
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', padding: '6px 4px' }}>
        {navItems.slice(0, 5).map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                padding: '6px 8px', borderRadius: 10, flex: 1, minWidth: 0,
                textDecoration: 'none',
                background: isActive ? `rgba(${pRgb},0.12)` : 'transparent',
                transform: isActive ? 'scale(1.05)' : 'scale(1)',
                transition: 'all 0.18s cubic-bezier(0.34,1.25,0.64,1)',
              }}
            >
              <div style={{
                marginBottom: 3, flexShrink: 0,
                color: isActive ? primaryColor : (darkMode ? '#64748b' : '#9ca3af'),
                transition: 'color 0.15s ease',
              }}>
                {item.icon}
              </div>
              <span style={{
                fontSize: 10, fontWeight: isActive ? 700 : 500,
                color: isActive ? primaryColor : (darkMode ? '#64748b' : '#9ca3af'),
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                width: '100%', textAlign: 'center',
                transition: 'color 0.15s ease',
              }}>
                {item.name}
              </span>
              {isActive && (
                <div style={{
                  width: 16, height: 2, borderRadius: 99, marginTop: 2,
                  background: gradient,
                }} />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileNavigation;
