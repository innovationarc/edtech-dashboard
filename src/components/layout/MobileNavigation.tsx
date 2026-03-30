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
import { useState, useEffect, useRef } from 'react';

const hexRgb = (hex: string) => {
  if (!hex || hex.length < 7) return '99,102,241';
  return `${parseInt(hex.slice(1,3),16)},${parseInt(hex.slice(3,5),16)},${parseInt(hex.slice(5,7),16)}`;
};

const MobileNavigation = () => {
  const { user, theme, primaryColor, accentColor, glitterTheme } = useDashboard();
  const location = useLocation();
  const darkMode = theme !== 'light';
  const pRgb = hexRgb(primaryColor);
  const gradient = `linear-gradient(135deg,${primaryColor} 0%,${accentColor} 100%)`;

  /* ── Scroll-hide behaviour ── */
  const [visible, setVisible] = useState(true);
  const lastScrollY = useRef(0);
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onScroll = () => {
      const currentY = window.scrollY;
      if (currentY > lastScrollY.current + 4) {
        // scrolling down → hide
        setVisible(false);
      } else if (currentY < lastScrollY.current - 4) {
        // scrolling up → show
        setVisible(true);
      }
      lastScrollY.current = currentY;

      // Re-show after scroll stops for 300ms
      if (scrollTimer.current) clearTimeout(scrollTimer.current);
      scrollTimer.current = setTimeout(() => setVisible(true), 300);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (scrollTimer.current) clearTimeout(scrollTimer.current);
    };
  }, []);

  const isLight = theme === 'light';
  const themeBgColor: Record<string, string> = {
    dark:'#0d1117', light:'#ebe8e1', slate:'#0f172a',
    ocean:'#0c1a2e', forest:'#0a1f14', purple:'#1e1b4b',
    pink:'#831843', sunset:'#1c0a00',
  };
  const baseBg = themeBgColor[theme] ?? '#0d1117';

  const glitterImageMap: Record<string, string> = {
    silver: isLight ? `
      radial-gradient(ellipse at 20% 20%, rgba(0,0,0,0.04) 0%, transparent 50%),
      radial-gradient(circle at 30% 40%, rgba(80,80,100,0.60) 1px, transparent 1px),
      radial-gradient(circle at 70% 20%, rgba(80,80,100,0.52) 1px, transparent 1px),
      radial-gradient(circle at 50% 70%, rgba(80,80,100,0.56) 1px, transparent 1px),
      radial-gradient(circle at 15% 80%, rgba(80,80,100,0.48) 1px, transparent 1px),
      radial-gradient(circle at 85% 60%, rgba(80,80,100,0.60) 1px, transparent 1px)
    ` : `
      radial-gradient(circle at 30% 40%, rgba(220,220,240,0.55) 0.5px, transparent 0.5px),
      radial-gradient(circle at 70% 20%, rgba(200,200,220,0.45) 0.5px, transparent 0.5px),
      radial-gradient(circle at 50% 70%, rgba(220,220,240,0.50) 0.5px, transparent 0.5px),
      radial-gradient(circle at 15% 80%, rgba(200,200,220,0.40) 0.5px, transparent 0.5px),
      radial-gradient(circle at 85% 60%, rgba(220,220,240,0.55) 0.5px, transparent 0.5px)
    `,
    gold: isLight ? `
      radial-gradient(ellipse at 15% 15%, rgba(180,130,0,0.09) 0%, transparent 45%),
      radial-gradient(circle at 25% 35%, rgba(160,120,0,0.72) 1px, transparent 1px),
      radial-gradient(circle at 75% 25%, rgba(180,140,0,0.68) 1px, transparent 1px),
      radial-gradient(circle at 45% 65%, rgba(160,120,0,0.70) 1px, transparent 1px),
      radial-gradient(circle at 80% 70%, rgba(180,140,0,0.62) 1px, transparent 1px),
      radial-gradient(circle at 60% 15%, rgba(180,140,0,0.72) 1px, transparent 1px)
    ` : `
      radial-gradient(circle at 25% 35%, rgba(212,175,55,0.60) 0.5px, transparent 0.5px),
      radial-gradient(circle at 75% 25%, rgba(255,215,0,0.55) 0.5px, transparent 0.5px),
      radial-gradient(circle at 45% 65%, rgba(212,175,55,0.58) 0.5px, transparent 0.5px),
      radial-gradient(circle at 80% 70%, rgba(255,215,0,0.48) 0.5px, transparent 0.5px),
      radial-gradient(circle at 60% 15%, rgba(255,215,0,0.62) 0.5px, transparent 0.5px)
    `,
    purple: isLight ? `
      radial-gradient(ellipse at 20% 30%, rgba(99,102,241,0.10) 0%, transparent 45%),
      radial-gradient(circle at 30% 40%, rgba(99,102,241,0.65) 1px, transparent 1px),
      radial-gradient(circle at 70% 20%, rgba(79,70,229,0.60) 1px, transparent 1px),
      radial-gradient(circle at 55% 70%, rgba(99,102,241,0.62) 1px, transparent 1px),
      radial-gradient(circle at 88% 50%, rgba(99,102,241,0.60) 1px, transparent 1px),
      radial-gradient(circle at 45% 15%, rgba(79,70,229,0.65) 1px, transparent 1px)
    ` : `
      radial-gradient(circle at 30% 40%, rgba(200,180,255,0.70) 0.5px, transparent 0.5px),
      radial-gradient(circle at 70% 20%, rgba(180,160,240,0.62) 0.5px, transparent 0.5px),
      radial-gradient(circle at 55% 70%, rgba(220,200,255,0.68) 0.5px, transparent 0.5px),
      radial-gradient(circle at 88% 50%, rgba(180,160,240,0.64) 0.5px, transparent 0.5px),
      radial-gradient(circle at 45% 15%, rgba(220,200,255,0.72) 0.5px, transparent 0.5px)
    `,
  };
  const glitterBgImage = glitterImageMap[glitterTheme] ?? '';
  const glitterBgSize = glitterTheme === 'silver' ? 'auto, 80px 80px, 120px 120px, 90px 90px, 110px 110px, 70px 70px'
    : glitterTheme === 'gold'   ? 'auto, 60px 60px, 90px 90px, 75px 75px, 110px 110px, 80px 80px'
    : glitterTheme === 'purple' ? 'auto, 55px 55px, 85px 85px, 70px 70px, 65px 65px, 90px 90px'
    : 'auto';

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
          { name: 'Settings', icon: <Settings size={20} />, path: '/settings' }
        ];
      case 'teacher':
        return [
          { name: 'Dashboard', icon: <BookOpen size={20} />, path: '/teacher-dashboard' },
          { name: 'Upload', icon: <Upload size={20} />, path: '/content' },
          { name: 'Questions', icon: <MessageSquare size={20} />, path: '/teacher-qa' },
          { name: 'Tasks', icon: <FileText size={20} />, path: '/teacher-tasks' },
          { name: 'Study Plan', icon: <Calendar size={20} />, path: '/study-plan' },
          ...baseItems,
          { name: 'Awards', icon: <Trophy size={20} />, path: '/achievements' },
          { name: 'Settings', icon: <Settings size={20} />, path: '/settings' }
        ];
      case 'admin':
        return [
          { name: 'Dashboard', icon: <LayoutDashboard size={20} />, path: '/dashboard' },
          { name: 'Users', icon: <Users size={20} />, path: '/users' },
          { name: 'Analytics', icon: <BarChart3 size={20} />, path: '/analytics' },
          { name: 'Study Plan', icon: <Calendar size={20} />, path: '/study-plan' },
          { name: 'Q&A', icon: <MessageSquare size={20} />, path: '/teacher-qa' },
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
        backgroundColor: baseBg,
        backgroundImage: glitterBgImage || undefined,
        backgroundSize: glitterBgImage ? glitterBgSize : undefined,
        borderTop: darkMode ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.08)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow: darkMode ? '0 -2px 16px rgba(0,0,0,0.3)' : '0 -2px 12px rgba(0,0,0,0.07)',
        fontFamily: "'Outfit', sans-serif",
        transform: visible ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 0.3s cubic-bezier(0.34,1.15,0.64,1)',
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
                background: isActive ? `rgba(${pRgb},0.15)` : 'transparent',
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
                <div style={{ width: 16, height: 2, borderRadius: 99, marginTop: 2, background: gradient }} />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileNavigation;
