// src/pages/Dashboard.tsx
import { useState, useEffect } from 'react';
import { Users, BookOpen, FileText, Loader, AlertCircle, LayoutGrid, LayoutList, Columns, Megaphone } from 'lucide-react';
import StatsCard from '../components/ui/StatsCard';
import WelcomeCard from '../components/dashboard/WelcomeCard';
import SatisfactionCard from '../components/dashboard/SatisfactionCard';
import ReferralCard from '../components/dashboard/ReferralCard';
import SalesChart from '../components/dashboard/SalesChart';
import ActiveUsersChart from '../components/dashboard/ActiveUsersChart';
import RecentActivityTable from '../components/dashboard/RecentActivityTable';
import OrdersOverview from '../components/dashboard/OrdersOverview';
import ContentStatsChart from '../components/dashboard/ContentStatsChart';
import SubjectBreakdown from '../components/dashboard/SubjectBreakdown';
import CreateAnnouncementModal from '../components/announcements/CreateAnnouncementModal';
import { WidgetGrid, WidgetEditBar, Widget, WidgetSize } from '../components/dashboard/WidgetDashboard';
import ClockWidget from '../components/dashboard/ClockWidget';
import { useDashboard } from '../contexts/DashboardContext';
import { userService } from '../services/userService';
import { contentService } from '../services/contentService';
import { courseService } from '../services/courseService';
import { paymentService } from '../services/paymentService';
import { announcementService } from '../services/announcementService';

interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  pendingUsers: number;
  totalContent: number;
  totalCourses: number;
  totalAnnouncements: number;
  recentTransactions: any[];
  contentBySubject: { name: string; lessons: number; notes: number; mcqs: number; total: number }[];
  userGrowth: number[];
  satisfactionRate: number;
  recentActivity: any[];
}

const Dashboard = () => {
  const { user, dashboardLayout, setDashboardLayout } = useDashboard();
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [widgetEditMode, setWidgetEditMode] = useState(false);

  const DEFAULT_WIDGETS: Widget[] = [
    { id: 'welcome',      size: '1x2', title: 'Welcome',         order: 0 },
    { id: 'clock',        size: '1x1', title: 'Clock',           order: 1 },
    { id: 'satisfaction', size: '1x1', title: 'Satisfaction',    order: 2 },
    { id: 'referral',     size: '1x1', title: 'User Stats',      order: 3 },
    { id: 'content-chart',size: '2x2', title: 'Content Stats',   order: 4 },
    { id: 'users-chart',  size: '1x1', title: 'Active Users',    order: 5 },
    { id: 'activity',     size: '2x1', title: 'Recent Activity', order: 6 },
    { id: 'subject',      size: '1x1', title: 'Subjects',        order: 7 },
  ];

  const [widgets, setWidgets] = useState<Widget[]>(() => {
    try {
      const saved = localStorage.getItem('dashboardWidgets');
      return saved ? JSON.parse(saved) : DEFAULT_WIDGETS;
    } catch { return DEFAULT_WIDGETS; }
  });

  const handleWidgetResize = (id: string, size: WidgetSize) => {
    const updated = widgets.map(w => w.id === id ? { ...w, size } : w);
    setWidgets(updated);
    localStorage.setItem('dashboardWidgets', JSON.stringify(updated));
  };

  const handleWidgetReorder = (reordered: Widget[]) => {
    setWidgets(reordered);
    localStorage.setItem('dashboardWidgets', JSON.stringify(reordered));
  };

  const handleResetWidgets = () => {
    setWidgets(DEFAULT_WIDGETS);
    localStorage.removeItem('dashboardWidgets');
  };
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    activeUsers: 0,
    pendingUsers: 0,
    totalContent: 0,
    totalCourses: 0,
    totalAnnouncements: 0,
    recentTransactions: [],
    contentBySubject: [],
    userGrowth: [],
    satisfactionRate: 0,
    recentActivity: []
  });

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError('');

      // Fetch all data concurrently
      const [
        allUsers,
        allContent,
        allCourses,
        allTransactions,
        allAnnouncements
      ] = await Promise.all([
        userService.getAllUsers().catch(() => []),
        contentService.getAllContent().catch(() => []),
        courseService.getAllCourses().catch(() => []),
        paymentService.getAllTransactions().catch(() => []),
        announcementService.getAllAnnouncements().catch(() => [])
      ]);

      // Process user statistics
      const activeUsers = allUsers.filter(u => u.status === 'active').length;
      const pendingUsers = allUsers.filter(u => u.status === 'pending').length;

      // Process content by subject
      const contentBySubject = processContentBySubject(allContent);

      // Calculate satisfaction rate from course ratings
      const coursesWithRatings = allCourses.filter(c => c.rating > 0);
      const satisfactionRate = coursesWithRatings.length > 0
        ? Math.round((coursesWithRatings.reduce((sum, c) => sum + c.rating, 0) / coursesWithRatings.length) * 20) // Convert 5-star to percentage
        : 85; // Default value

      // Generate user growth data
      const userGrowth = generateUserGrowthData(allUsers);

      // Process recent activity
      const recentActivity = processRecentActivity(allContent, allCourses, allUsers);

      // Get recent transactions
      const recentTransactions = allTransactions
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, 5);

      setStats({
        totalUsers: allUsers.length,
        activeUsers,
        pendingUsers,
        totalContent: allContent.length,
        totalCourses: allCourses.length,
        totalAnnouncements: allAnnouncements.length,
        recentTransactions,
        contentBySubject,
        userGrowth,
        satisfactionRate,
        recentActivity
      });

    } catch (error: any) {
      console.error('Error loading dashboard data:', error);
      setError('Failed to load dashboard data. Some features may not work correctly.');
    } finally {
      setLoading(false);
    }
  };

  const processContentBySubject = (content: any[]) => {
    const subjectMap = new Map<string, { name: string; lessons: number; notes: number; mcqs: number; total: number }>();
    
    content.forEach(item => {
      const subject = item.category || item.subject || 'Other';
      if (!subjectMap.has(subject)) {
        subjectMap.set(subject, {
          name: subject,
          lessons: 0,
          notes: 0,
          mcqs: 0,
          total: 0
        });
      }
      
      const subjectData = subjectMap.get(subject)!;
      if (item.type === 'lesson') subjectData.lessons++;
      else if (item.type === 'note' || item.type === 'trick') subjectData.notes++; // Group tricks with notes
      else if (item.type === 'mcq') subjectData.mcqs++;
      subjectData.total++;
    });

    return Array.from(subjectMap.values()).sort((a, b) => b.total - a.total);
  };

  const generateUserGrowthData = (users: any[]) => {
    const today = new Date();
    const last7DaysData = Array(7).fill(0);

    users.forEach(user => {
      const userCreatedAt = user.createdAt;
      if (userCreatedAt) {
        const diffTime = Math.abs(today.getTime() - userCreatedAt.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays <= 7) {
          const dayIndex = (userCreatedAt.getDay() + 6) % 7; // 0 for Monday, 6 for Sunday
          last7DaysData[dayIndex]++;
        }
      }
    });

    // Reorder data to start from Monday of the current week
    const currentDayOfWeek = (today.getDay() + 6) % 7; // 0 for Monday, 6 for Sunday
    const orderedData = [...last7DaysData.slice(currentDayOfWeek + 1), ...last7DaysData.slice(0, currentDayOfWeek + 1)];

    return orderedData;
  };

  const processRecentActivity = (content: any[], courses: any[], users: any[]) => {
    const activities = [];

    // Recent content uploads (lessons, notes, tricks)
    content.forEach(item => {
      const user = users.find(u => u.uid === item.createdBy);
      activities.push({
        id: `content-${item.id}`,
        type: 'content_upload',
        title: `New ${item.type} uploaded`,
        description: item.title,
        user: user?.name || 'Unknown User',
        timestamp: item.createdAt,
        icon: getContentIcon(item.type)
      });
    });

    // Recent course creations
    courses.forEach(course => {
      const user = users.find(u => u.uid === course.instructorId);
      activities.push({
        id: `course-${course.id}`,
        type: 'course_creation',
        title: 'New course created',
        description: course.title,
        user: user?.name || course.instructor,
        timestamp: course.createdAt,
        icon: <BookOpen size={16} className="text-primary-400" />
      });
    });

    // Recent user registrations
    users.forEach(user => {
      activities.push({
        id: `user-${user.uid}`,
        type: 'user_registration',
        title: 'New user registered',
        description: `${user.name} (${user.role})`,
        user: 'System',
        timestamp: user.createdAt,
        icon: <UserPlus size={16} className="text-success-DEFAULT" />
      });
    });

    return activities
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 6);
  };

  const getContentIcon = (type: string) => {
    switch (type) {
      case 'lesson': return <BookOpen size={16} className="text-primary-400" />;
      case 'note': return <FileText size={16} className="text-secondary-400" />;
      case 'trick': return <PenTool size={16} className="text-accent-400" />;
      case 'mcq': return <BrainCircuit size={16} className="text-warning-DEFAULT" />;
      default: return <FileText size={16} className="text-gray-400" />;
    }
  };

  const handleCreateAnnouncement = () => {
    setShowAnnouncementModal(true);
  };

  const handleAnnouncementSuccess = () => {
    // Reload announcements count
    loadDashboardData();
    
    // Add success notification
    if ((window as any).addNotification) {
      (window as any).addNotification(
        'Announcement published and sent to students!',
        'success'
      );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-4">
          <Loader size={32} className="animate-spin text-primary-500" />
          <p className="text-gray-400">Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  const renderWidget = (widget: Widget) => {
    const { stats } = { stats: (window as any).__dashStats || stats };
    switch (widget.id) {
      case 'welcome':      return <WelcomeCard userName={user?.name || 'Admin'} />;
      case 'clock':        return <ClockWidget />;
      case 'satisfaction': return <SatisfactionCard satisfactionRate={stats.satisfactionRate} />;
      case 'referral':     return <ReferralCard invitedCount={stats.totalUsers} bonusValue={stats.activeUsers} />;
      case 'content-chart':return <ContentStatsChart chartData={stats.contentBySubject} />;
      case 'users-chart':  return <ActiveUsersChart chartData={stats.userGrowth} />;
      case 'activity':     return <RecentActivityTable recentItems={stats.recentActivity} />;
      case 'subject':      return <SubjectBreakdown subjectsData={stats.contentBySubject} />;
      default:             return null;
    }
  };

  // Store stats in window for widget renderer
  (window as any).__dashStats = stats;

  return (
    <div className="space-y-5" style={{ fontFamily: "'Outfit', sans-serif" }}>

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-bold text-white tracking-tight" style={{ fontSize: 'clamp(1.25rem, 2.5vw, 1.75rem)' }}>
            Dashboard
          </h1>
          <p style={{ fontSize: 'clamp(0.75rem, 1.3vw, 0.875rem)', color: 'rgba(156,163,175,1)', marginTop: '2px' }}>
            {stats.pendingUsers > 0
              ? <span style={{ color: '#fbbf24' }}>⚠ {stats.pendingUsers} pending approvals</span>
              : 'All systems running smoothly'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <WidgetEditBar
            editMode={widgetEditMode}
            onToggleEdit={() => setWidgetEditMode(!widgetEditMode)}
            onReset={handleResetWidgets}
          />
          <div className="flex items-center gap-1 rounded-xl p-1" style={{ background: 'var(--color-card, #1f2937)', border: '1px solid rgba(255,255,255,0.05)' }}>
            {(['default','compact','wide'] as const).map((l, i) => {
              const icons = [<LayoutGrid size={14}/>, <LayoutList size={14}/>, <Columns size={14}/>];
              return (
                <button key={l} onClick={() => setDashboardLayout(l)} title={l}
                  className={`p-2 rounded-lg transition-all ${dashboardLayout === l ? 'bg-primary-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
                  {icons[i]}
                </button>
              );
            })}
          </div>
          <button onClick={handleCreateAnnouncement}
            className="flex items-center gap-2 bg-primary-600 hover:bg-primary-500 text-white rounded-xl font-semibold transition-all shadow-lg shadow-primary-900/30"
            style={{ padding: 'clamp(0.4rem, 0.8vw, 0.5rem) clamp(0.75rem, 1.5vw, 1rem)', fontSize: 'clamp(0.75rem, 1.2vw, 0.875rem)' }}>
            <Megaphone size={15} /><span>Announce</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-rose-300" style={{ background: 'rgba(159,18,57,0.15)', border: '1px solid rgba(159,18,57,0.3)', fontSize: 'clamp(0.75rem,1.2vw,0.875rem)' }}>
          <AlertCircle size={15} /><span>{error}</span>
        </div>
      )}

      {/* ── Stats Row ── */}
      <div className={`grid gap-3 ${
        dashboardLayout === 'compact' ? 'grid-cols-2 xl:grid-cols-4'
        : dashboardLayout === 'wide'  ? 'grid-cols-2'
        : 'grid-cols-2 lg:grid-cols-4'
      }`}>
        <StatsCard title="Total Users"    value={stats.totalUsers}
          icon={<Users size={16}/>}
          change={{ value: stats.activeUsers > 0 ? `${Math.round((stats.activeUsers/stats.totalUsers)*100)}% active` : '—', positive: true }}
          colorScheme="primary" />
        <StatsCard title="Content Items"  value={stats.totalContent}
          icon={<FileText size={16}/>}
          change={{ value: 'Published', positive: true }}
          colorScheme="secondary" />
        <StatsCard title="Active Courses" value={stats.totalCourses}
          icon={<BookOpen size={16}/>}
          change={{ value: 'Published', positive: true }}
          colorScheme="accent" />
        <StatsCard title="Announcements"  value={stats.totalAnnouncements}
          icon={<Megaphone size={16}/>}
          change={{ value: 'Live', positive: true }}
          colorScheme="success" />
      </div>

      {/* ── Edit Mode hint ── */}
      {widgetEditMode && (
        <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl" style={{
          background: 'rgba(99,102,241,0.08)',
          border: '1px solid rgba(99,102,241,0.2)',
          fontSize: 'clamp(0.7rem, 1.1vw, 0.8rem)',
          color: 'rgb(167,139,250)'
        }}>
          <span className="w-2 h-2 rounded-full bg-primary-500 animate-pulse flex-shrink-0 inline-block" />
          <span>Drag the <strong>grip handle</strong> to reorder · Tap resize button to change widget size</span>
        </div>
      )}

      {/* ── Widget Grid — drag & resize ── */}
      <WidgetGrid
        widgets={widgets}
        onReorder={handleWidgetReorder}
        onResize={handleWidgetResize}
        editMode={widgetEditMode}
      >
        {(widget) => renderWidget(widget)}
      </WidgetGrid>

      {/* ── Orders Row ── */}
      {stats.recentTransactions.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-2xl overflow-hidden"><OrdersOverview recentOrders={stats.recentTransactions} /></div>
          <div className="rounded-2xl overflow-hidden"><SalesChart chartData={stats.recentTransactions} /></div>
        </div>
      )}

      {showAnnouncementModal && (
        <CreateAnnouncementModal
          onClose={() => setShowAnnouncementModal(false)}
          onSuccess={handleAnnouncementSuccess}
        />
      )}

      <style>{`
        @keyframes slideDown {
          from { opacity:0; transform:translateY(-6px) scale(0.97); }
          to   { opacity:1; transform:translateY(0)   scale(1); }
        }
      `}</style>
    </div>
  );
};

export default Dashboard;
