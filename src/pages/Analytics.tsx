// src/pages/Analytics.tsx
import { useState, useEffect } from 'react';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import Card from '../components/ui/Card';
import { Calendar, Users, Upload, BookOpen, Activity, ArrowUp, ArrowDown, Loader, DollarSign } from 'lucide-react'; // Added DollarSign import

// Import services
import { userService } from '../services/userService';
import { contentService } from '../services/contentService';
import { courseService } from '../services/courseService';
import { paymentService } from '../services/paymentService'; // Added this

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const Analytics = () => {
  const [timeRange, setTimeRange] = useState('month');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // State for dynamic data
  const [totalVisitors, setTotalVisitors] = useState(0);
  const [activeStudents, setActiveStudents] = useState(0);
  const [contentUploads, setContentUploads] = useState(0);
  const [courseCompletions, setCourseCompletions] = useState(0);
  const [totalTeachers, setTotalTeachers] = useState(0); // New state
  const [totalRevenue, setTotalRevenue] = useState(0); // New state
  const [enrollmentByCourse, setEnrollmentByCourse] = useState<Record<string, number>>({}); // New state
  const [enrollmentBySubject, setEnrollmentBySubject] = useState<Record<string, number>>({}); // New state

  const [trafficChartData, setTrafficChartData] = useState<any>({ labels: [], datasets: [] });
  const [activityChartData, setActivityChartData] = useState<any>({ labels: [], datasets: [] });
  const [uploadChartData, setUploadChartData] = useState<any>({ labels: [], datasets: [] });

  useEffect(() => {
    loadAnalyticsData();
  }, [timeRange]);

  const loadAnalyticsData = async () => {
    setLoading(true);
    setError('');
    try {
      const [
        allUsers,
        allContent,
        allCourses,
        allEnrollments,
        allTransactions // Added this
      ] = await Promise.all([
        userService.getAllUsers().catch(() => []),
        contentService.getAllContent().catch(() => []),
        courseService.getAllCourses().catch(() => []),
        courseService.getAllEnrollments().catch(() => []),
        paymentService.getAllTransactions().catch(() => []) // Added this
      ]);

      // --- Process Stats Cards Data ---
      setTotalVisitors(allUsers.length);
      setActiveStudents(allUsers.filter(u => u.role === 'student' && u.status === 'active').length);
      setContentUploads(allContent.length);
      setCourseCompletions(allEnrollments.filter(e => e.progress === 100).length);
      setTotalTeachers(allUsers.filter(u => u.role === 'teacher').length); // New calculation
      setTotalRevenue(allTransactions.filter(t => t.status === 'success').reduce((sum, t) => sum + t.amount, 0)); // New calculation

      // --- Process Enrollment Data ---
      const enrollmentCountsByCourse: Record<string, number> = {};
      const enrollmentCountsBySubject: Record<string, number> = {};

      allEnrollments.forEach(enrollment => {
        const course = allCourses.find(c => c.id === enrollment.courseId);
        if (course) {
          enrollmentCountsByCourse[course.title] = (enrollmentCountsByCourse[course.title] || 0) + 1;
          enrollmentCountsBySubject[course.category] = (enrollmentCountsBySubject[course.category] || 0) + 1;
        }
      });
      setEnrollmentByCourse(enrollmentCountsByCourse);
      setEnrollmentBySubject(enrollmentCountsBySubject);

      // --- Process Traffic Data (Visitors) ---
      // Simplified for example, would need more sophisticated date filtering for real data
      const trafficLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const visitorsData = [1200, 1900, 1500, 2100, 1800, 1350, 1600]; // Placeholder, derive from user sign-ups/logins
      const pageViewsData = [2200, 3000, 2700, 3500, 3200, 2400, 2800]; // Placeholder, no direct service for this

      setTrafficChartData({
        labels: trafficLabels,
        datasets: [
          {
            label: 'Visitors',
            data: visitorsData,
            borderColor: '#6366f1',
            backgroundColor: 'rgba(99, 102, 241, 0.1)',
            tension: 0.4,
            fill: true,
            pointBackgroundColor: '#6366f1',
          },
          {
            label: 'Page Views',
            data: pageViewsData,
            borderColor: '#8b5cf6',
            backgroundColor: 'rgba(139, 92, 246, 0.1)',
            tension: 0.4,
            fill: true,
            pointBackgroundColor: '#8b5cf6',
          },
        ],
      });

      // --- Process User Activity Data ---
      const quizAttemptsCount = 0; // quiz sessions no longer fetched
      const lessonCompletionsCount = allEnrollments.reduce((sum, enrollment) => sum + (enrollment.completedLessons?.length || 0), 0);
      // Placeholder for other activities as there's no direct service for this
      const contentViewsCount = 800;
      const forumPostsCount = 150;
      const downloadsCount = 200;

      setActivityChartData({
        labels: ['Content Views', 'Quiz Attempts', 'Lesson Completions', 'Forum Posts', 'Downloads'],
        datasets: [
          {
            data: [contentViewsCount, quizAttemptsCount, lessonCompletionsCount, forumPostsCount, downloadsCount],
            backgroundColor: ['#6366f1', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444'],
            borderWidth: 0,
            borderRadius: 4,
            barThickness: 24,
          },
        ],
      });

      // --- Process Upload Stats Data ---
      const lessonCount = allContent.filter(c => c.type === 'lesson').length;
      const noteCount = allContent.filter(c => c.type === 'note').length;
      const trickCount = allContent.filter(c => c.type === 'trick').length;
      const mcqCount = allContent.filter(c => c.type === 'mcq').length;
      const otherCount = allContent.filter(c => !['lesson', 'note', 'trick', 'mcq'].includes(c.type)).length;

      setUploadChartData({
        labels: ['Lessons', 'Notes', 'MCQs', 'Tricks & Hacks', 'Other'],
        datasets: [
          {
            data: [lessonCount, noteCount, mcqCount, trickCount, otherCount],
            backgroundColor: ['#6366f1', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444'],
            borderWidth: 0,
            hoverOffset: 4,
          },
        ],
      });

    } catch (err: any) {
      console.error('Error loading analytics data:', err);
      setError('Failed to load analytics data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getTimeLabel = () => {
    switch (timeRange) {
      case 'week': return 'This Week';
      case 'month': return 'This Month';
      case 'quarter': return 'This Quarter';
      case 'year': return 'This Year';
      default: return 'This Month';
    }
  };

  const statsCards = [
    { // New card
      title: 'Total Students',
      value: totalVisitors.toLocaleString(), // totalVisitors is now total users
      change: '+12.5%',
      positive: true,
      icon: <Users size={20} className="text-white" />,
      color: 'bg-primary-500',
    },
    { // New card
      title: 'Total Teachers',
      value: totalTeachers.toLocaleString(),
      change: '+5%',
      positive: true,
      icon: <BookOpen size={20} className="text-white" />,
      color: 'bg-secondary-500',
    },
    { // New card
      title: 'Total Revenue',
      value: `$${totalRevenue.toLocaleString()}`,
      change: '+18%',
      positive: true,
      icon: <DollarSign size={20} className="text-white" />,
      color: 'bg-accent-500',
    },
    { // Existing card, re-positioned
      title: 'Active Students',
      value: activeStudents.toLocaleString(),
      change: '+7.2%',
      positive: true,
      icon: <Activity size={20} className="text-white" />,
      color: 'bg-warning-DEFAULT',
    },
    { // Existing card, re-positioned
      title: 'Content Uploads',
      value: contentUploads.toLocaleString(),
      change: '+22.5%',
      positive: true,
      icon: <Upload size={20} className="text-white" />,
      color: 'bg-error-DEFAULT',
    },
    { // Existing card, re-positioned
      title: 'Course Completions',
      value: courseCompletions.toLocaleString(),
      change: '-3.8%',
      positive: false,
      icon: <BookOpen size={20} className="text-white" />,
      color: 'bg-purple-500',
    },
  ];

  const trafficOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
        labels: {
          color: '#e5e7eb',
          font: {
            size: 12,
          },
        },
      },
      tooltip: {
        backgroundColor: '#1f2937',
        titleColor: '#fff',
        bodyColor: '#e5e7eb',
        borderColor: '#374151',
        borderWidth: 1,
        padding: 10,
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
          drawBorder: false,
        },
        ticks: {
          color: '#9ca3af',
        },
      },
      y: {
        grid: {
          color: 'rgba(75, 85, 99, 0.2)',
          drawBorder: false,
        },
        ticks: {
          color: '#9ca3af',
          padding: 10,
        },
      },
    },
  };

  const activityOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: '#1f2937',
        titleColor: '#fff',
        bodyColor: '#e5e7eb',
        borderColor: '#374151',
        borderWidth: 1,
        padding: 10,
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
          drawBorder: false,
        },
        ticks: {
          color: '#9ca3af',
        },
      },
      y: {
        grid: {
          color: 'rgba(75, 85, 99, 0.2)',
          drawBorder: false,
        },
        ticks: {
          color: '#9ca3af',
          padding: 10,
        },
      },
    },
  };

  const uploadOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '70%',
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          color: '#e5e7eb',
          font: {
            size: 12,
          },
          padding: 20,
        },
      },
      tooltip: {
        backgroundColor: '#1f2937',
        titleColor: '#fff',
        bodyColor: '#e5e7eb',
        borderColor: '#374151',
        borderWidth: 1,
        padding: 10,
      },
    },
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-4">
          <Loader size={32} className="animate-spin text-primary-500" />
          <p className="text-gray-400">Loading analytics data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-white mb-2">Error Loading Analytics</h3>
        <p className="text-gray-400 mb-4">{error}</p>
        <button
          onClick={loadAnalyticsData}
          className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h1 className="text-2xl font-bold text-white">Analytics Dashboard</h1>

        <div className="flex p-1 bg-background-800 rounded-lg">
          {['week', 'month', 'quarter', 'year'].map((range) => (
            <button
              key={range}
              className={`px-4 py-1.5 text-sm rounded-md ${
                timeRange === range
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
              onClick={() => setTimeRange(range)}
            >
              {range.charAt(0).toUpperCase() + range.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {statsCards.map((card, index) => (
          <Card key={index} className="p-0">
            <div className="p-5 flex items-center justify-between">
              <div>
                <h3 className="text-gray-400 text-sm">{card.title}</h3>
                <p className="text-2xl font-semibold text-white mt-1">{card.value}</p>
                <div className="flex items-center mt-1">
                  {card.positive ? (
                    <ArrowUp size={14} className="text-success-DEFAULT mr-1" />
                  ) : (
                    <ArrowDown size={14} className="text-error-DEFAULT mr-1" />
                  )}
                  <span
                    className={`text-xs ${
                      card.positive ? "text-success-DEFAULT" : "text-error-DEFAULT"
                    }`}
                  >
                    {card.change} {getTimeLabel()}
                  </span>
                </div>
              </div>
              <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${card.color}`}>
                {card.icon}
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card title="Traffic Overview" subtitle="Website traffic analytics">
            <div className="h-80">
              <Line data={trafficChartData} options={trafficOptions} />
            </div>
          </Card>
        </div>

        <div className="lg:col-span-1">
          <Card title="Upload Statistics" subtitle="Content type distribution">
            <div className="h-80 flex items-center justify-center">
              <Doughnut data={uploadChartData} options={uploadOptions} />
            </div>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="User Activity" subtitle="Student interactions by category">
          <div className="h-80">
            <Bar data={activityChartData} options={activityOptions} />
          </div>
        </Card>

        <Card title="Usage Calendar" subtitle="Peak usage times">
          <div className="h-80 flex flex-col items-center justify-center text-center">
            <Calendar size={64} className="text-primary-400 mb-4" />
            <h3 className="text-white font-medium mb-2">Calendar View Coming Soon</h3>
            <p className="text-gray-400 max-w-md">
              Detailed calendar view of usage patterns is currently in development.
              This feature will show peak usage times and help you optimize content scheduling.
            </p>
          </div>
        </Card>
      </div>

      {/* New Section: Enrollment Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Enrollment by Course" subtitle="Number of students enrolled in each course">
            <div className="space-y-3">
                {Object.entries(enrollmentByCourse).length > 0 ? (
                    Object.entries(enrollmentByCourse).sort(([, a], [, b]) => b - a).map(([courseName, count]) => (
                        <div key={courseName} className="flex justify-between items-center bg-background-800 p-3 rounded-lg">
                            <span className="text-white text-sm">{courseName}</span>
                            <span className="text-primary-300 font-medium">{count} students</span>
                        </div>
                    ))
                ) : (
                    <div className="text-center text-gray-400 py-4">No course enrollment data available.</div>
                )}
            </div>
        </Card>

        <Card title="Enrollment by Subject" subtitle="Number of students enrolled in courses per subject">
            <div className="space-y-3">
                {Object.entries(enrollmentBySubject).length > 0 ? (
                    Object.entries(enrollmentBySubject).sort(([, a], [, b]) => b - a).map(([subjectName, count]) => (
                        <div key={subjectName} className="flex justify-between items-center bg-background-800 p-3 rounded-lg">
                            <span className="text-white text-sm">{subjectName}</span>
                            <span className="text-primary-300 font-medium">{count} students</span>
                        </div>
                    ))
                ) : (
                    <div className="text-center text-gray-400 py-4">No subject enrollment data available.</div>
                )}
            </div>
        </Card>
    </div>
    </div>
  );
};

export default Analytics;
