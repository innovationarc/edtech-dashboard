// src/pages/Dashboard.tsx
import { useState, useEffect } from 'react';
import { Users, UserPlus, ShoppingBag, BookOpen, FileText, PenTool, BrainCircuit, Loader, AlertCircle } from 'lucide-react';
import { Megaphone } from 'lucide-react';
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
import { useDashboard } from '../contexts/DashboardContext';
import { userService } from '../services/userService';
import { contentService } from '../services/contentService';
import { courseService } from '../services/courseService';
import { paymentService } from '../services/paymentService';
import { mcqService } from '../services/mcqService'; // Import mcqService
import { announcementService } from '../services/announcementService';

interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  pendingUsers: number;
  totalContent: number;
  totalCourses: number;
  totalMCQs: number;
  totalAnnouncements: number;
  recentTransactions: any[];
  contentBySubject: { name: string; lessons: number; notes: number; mcqs: number; total: number }[];
  userGrowth: number[];
  satisfactionRate: number;
  recentActivity: any[];
}

const Dashboard = () => {
  const { user } = useDashboard();
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    activeUsers: 0,
    pendingUsers: 0,
    totalContent: 0,
    totalCourses: 0,
    totalMCQs: 0,
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
        allMCQs, // Fetch MCQs from mcqService
        allCourses,
        allTransactions,
        allAnnouncements
      ] = await Promise.all([
        userService.getAllUsers().catch(() => []),
        contentService.getAllContent().catch(() => []),
        mcqService.getAllMCQQuestions().catch(() => []), // Use mcqService
        courseService.getAllCourses().catch(() => []),
        paymentService.getAllTransactions().catch(() => []),
        announcementService.getAllAnnouncements().catch(() => [])
      ]);

      // Process user statistics
      const activeUsers = allUsers.filter(u => u.status === 'active').length;
      const pendingUsers = allUsers.filter(u => u.status === 'pending').length;

      // Process content by subject
      const contentBySubject = processContentBySubject([...allContent, ...allMCQs]);

      // Calculate satisfaction rate from course ratings
      const coursesWithRatings = allCourses.filter(c => c.rating > 0);
      const satisfactionRate = coursesWithRatings.length > 0
        ? Math.round((coursesWithRatings.reduce((sum, c) => sum + c.rating, 0) / coursesWithRatings.length) * 20) // Convert 5-star to percentage
        : 85; // Default value

      // Generate user growth data
      const userGrowth = generateUserGrowthData(allUsers);

      // Process recent activity
      const recentActivity = processRecentActivity(allContent, allCourses, allUsers, allMCQs);

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
        totalMCQs: allMCQs.length,
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

  const processRecentActivity = (content: any[], courses: any[], users: any[], mcqs: any[]) => {
    const activities = [];

    // Combine all content and MCQs
    const combinedContent = [...content, ...mcqs];

    // Recent content uploads (lessons, notes, tricks, MCQs)
    combinedContent.forEach(item => {
      const user = users.find(u => u.uid === item.createdBy);
      activities.push({
        id: `content-${item.id}`,
        type: item.type === 'mcq' ? 'mcq_upload' : 'content_upload',
        title: item.type === 'mcq' ? `New MCQ uploaded` : `New ${item.type} uploaded`,
        description: item.type === 'mcq' ? item.question : item.title,
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
          <p className="text-gray-400 mt-1">Manage your educational platform</p>
          {stats.pendingUsers > 0 && (
            <p className="text-warning-DEFAULT text-sm mt-1">
              {stats.pendingUsers} user{stats.pendingUsers !== 1 ? 's' : ''} pending approval
            </p>
          )}
        </div>
        <button
          onClick={handleCreateAnnouncement}
          className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg transition-colors shadow-lg hover:shadow-xl"
        >
          <Megaphone size={20} />
          <span>Create Announcement</span>
        </button>
      </div>

      {error && (
        <div className="bg-error-dark text-error-light px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard 
          title="Total Users" 
          value={stats.totalUsers.toString()} 
          icon={<Users size={20} className="text-white" />}
          change={{ 
            value: stats.activeUsers > 0 ? `${Math.round((stats.activeUsers / stats.totalUsers) * 100)}% active` : "0% active", 
            positive: stats.activeUsers > 0 
          }}
          colorScheme="primary"
        />
        <StatsCard 
          title="Total Content" 
          value={stats.totalContent.toString()} 
          icon={<FileText size={20} className="text-white" />}
          change={{ 
            value: `${stats.totalMCQs} MCQs`, 
            positive: true 
          }}
          colorScheme="secondary"
        />
        <StatsCard 
          title="Active Courses" 
          value={stats.totalCourses.toString()} 
          icon={<BookOpen size={20} className="text-white" />}
          change={{ 
            value: "Published", 
            positive: true 
          }}
          colorScheme="accent"
        />
        <StatsCard 
          title="Announcements" 
          value={stats.totalAnnouncements.toString()} 
          icon={<Megaphone size={20} className="text-white" />}
          change={{ 
            value: "Active", 
            positive: true 
          }}
          colorScheme="success"
        />
      </div>
      
      {/* Welcome and Overview Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <WelcomeCard userName={user?.name || 'Admin'} />
        </div>
        <div className="lg:col-span-1">
          <SatisfactionCard satisfactionRate={stats.satisfactionRate} />
        </div>
        <div className="lg:col-span-1">
          <ReferralCard 
            invitedCount={stats.totalUsers} 
            bonusValue={stats.activeUsers} 
          />
        </div>
      </div>
      
      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ContentStatsChart chartData={stats.contentBySubject} />
        </div>
        <div className="lg:col-span-1">
          <ActiveUsersChart chartData={stats.userGrowth} />
        </div>
      </div>
      
      {/* Activity and Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RecentActivityTable recentItems={stats.recentActivity} />
        </div>
        <div className="lg:col-span-1">
          <SubjectBreakdown subjectsData={stats.contentBySubject} />
        </div>
      </div>

      {/* Orders Overview */}
      {stats.recentTransactions.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="lg:col-span-1">
            <OrdersOverview recentOrders={stats.recentTransactions} />
          </div>
          <div className="lg:col-span-1">
            <SalesChart chartData={stats.recentTransactions} />
          </div>
        </div>
      )}

      {/* Create Announcement Modal */}
      {showAnnouncementModal && (
        <CreateAnnouncementModal
          onClose={() => setShowAnnouncementModal(false)}
          onSuccess={handleAnnouncementSuccess}
        />
      )}
    </div>
  );
};

export default Dashboard;
