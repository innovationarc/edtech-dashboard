// src/pages/TeacherDashboard.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, formatDistanceToNow } from 'date-fns';
import { Users, BookOpen, TrendingUp, Calendar, Star, RotateCcw, Lightbulb, Megaphone, Loader, AlertCircle, MessageSquare, ClipboardCheck, Clock, PartyPopper, ChevronRight, AlertTriangle, Plus } from 'lucide-react'; // Import MessageSquare
import Card from '../components/ui/Card';
import StatsCard from '../components/ui/StatsCard';
import { getRandomQuoteByCategory } from '../utils/quotes';
import CreateAnnouncementModal from '../components/announcements/CreateAnnouncementModal';
import { useDashboard } from '../contexts/DashboardContext';
import { userService } from '../services/userService';
import { courseService, Course } from '../services/courseService';
import { studyPlanService, StudyPlanEvent } from '../services/studyPlanService'; // Import studyPlanService
import { qaService, Question } from '../services/qaService'; // Import qaService for real-time Q&A notifications
import { taskService, TaskGroup, Submission } from '../services/taskService';

export default function TeacherDashboard() {
  const { user } = useDashboard();
  const navigate = useNavigate();
  const [dailyQuote, setDailyQuote] = useState(() => getRandomQuoteByCategory('education'));
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // State for dashboard data
  const [totalStudents, setTotalStudents] = useState(0);
  const [activeCourses, setActiveCourses] = useState(0);
  const [avgPerformance, setAvgPerformance] = useState(0);
  const [recentStudentActivity, setRecentStudentActivity] = useState<any[]>([]);
  const [upcomingClasses, setUpcomingClasses] = useState<StudyPlanEvent[]>([]); // Use StudyPlanEvent type
  const [pendingQuestionsCount, setPendingQuestionsCount] = useState(0); // New state for pending questions
  const [myCourses, setMyCourses] = useState<Course[]>([]); // For the "My Courses" strip

  // ── "Needs Your Attention" widget state ──
  const [ungradedSubmissions, setUngradedSubmissions] = useState<(Submission & { groupTitle: string })[]>([]);
  const [dueSoonGroups, setDueSoonGroups] = useState<TaskGroup[]>([]);
  const [pendingQuestionsPreview, setPendingQuestionsPreview] = useState<Question[]>([]);
  const [attentionLoading, setAttentionLoading] = useState(true);

  useEffect(() => {
    // Set a new random education-focused quote when component mounts
    setDailyQuote(getRandomQuoteByCategory('education'));

    if (user) {
      loadDashboardData();
    }
  }, [user]);

  // Effect for real-time Q&A notifications for teachers
  useEffect(() => {
    if (user && user.role === 'teacher') {
      const unsubscribe = qaService.onNewPendingQuestions((questions) => {
        const newPendingCount = questions.length;
        if (newPendingCount > pendingQuestionsCount) {
          if ((window as any).addNotification) {
            (window as any).addNotification(
              `You have ${newPendingCount - pendingQuestionsCount} new pending question(s)!`,
              'info'
            );
          }
        }
        setPendingQuestionsCount(newPendingCount);
        setPendingQuestionsPreview(
          [...questions].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()).slice(0, 3)
        );
      });

      return () => unsubscribe();
    }
  }, [user, pendingQuestionsCount]); // Re-run if user or pendingQuestionsCount changes

  const loadDashboardData = async () => {
    if (!user) return;

    setLoading(true);
    setError('');
    try {
      const [
        allUsers,
        teacherCourses,
        allEnrollments,
        teacherStudyPlanEvents, // Fetch study plan events
        pendingQuestions, // Fetch pending questions
        teacherTaskGroups // Fetch this teacher's task groups (for grading + due-soon widget)
      ] = await Promise.all([
        userService.getAllUsers().catch(() => []),
        courseService.getCoursesByInstructor(user.uid).catch(() => [],),
        courseService.getAllEnrollments().catch(() => []),
        studyPlanService.getEventsByTeacher(user.uid).catch(() => []), // Fetch events for this teacher
        qaService.getQuestions(undefined, 'pending').catch(() => []), // Fetch pending questions
        taskService.getTaskGroupsByTeacher(user.uid).catch(() => [])
      ]);

      // Total Students
      setTotalStudents(allUsers.filter(u => u.role === 'student').length);

      // Active Courses (created by this teacher)
      setActiveCourses(teacherCourses.length);
      setMyCourses(teacherCourses);

      // Avg performance not available without quiz sessions
      setAvgPerformance(0);

      // Recent Student Activity — enrollments only
      const recentActivities: any[] = [];
      allEnrollments.filter(enrollment =>
        teacherCourses.some(course => course.id === enrollment.courseId)
      ).sort((a, b) => b.enrolledAt.getTime() - a.enrolledAt.getTime()).slice(0, 2).forEach(enrollment => {
        recentActivities.push({
          id: `enroll-${enrollment.id}`,
          studentName: enrollment.studentName,
          description: `Enrolled in ${enrollment.courseId}`, // Course ID, ideally course name
          status: 'New Enrollment',
          statusColor: 'text-primary-400'
        });
      });
      setRecentStudentActivity(recentActivities.sort((a, b) => b.id.localeCompare(a.id)).slice(0, 4)); // Sort by ID to keep consistent order for mock data

      // Upcoming Classes from Study Plan Events
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const next7Days = new Date(today);
      next7Days.setDate(today.getDate() + 7);

      const filteredUpcomingClasses = teacherStudyPlanEvents.filter(event => {
        const eventDate = new Date(event.date.getFullYear(), event.date.getMonth(), event.date.getDate());
        return eventDate >= today && eventDate <= next7Days;
      }).sort((a, b) => {
        // Sort by date, then by start time
        const dateA = a.date.getTime();
        const dateB = b.date.getTime();
        if (dateA !== dateB) return dateA - dateB;

        const timeA = parseInt(a.startTime.replace(':', ''));
        const timeB = parseInt(b.startTime.replace(':', ''));
        return timeA - timeB;
      });

      setUpcomingClasses(filteredUpcomingClasses);

      // Set pending questions count + a small preview (oldest-waiting first = most urgent)
      setPendingQuestionsCount(pendingQuestions.length);
      setPendingQuestionsPreview(
        [...pendingQuestions].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()).slice(0, 3)
      );

      // Task groups due within the next 3 days (published only — no point nudging drafts)
      const dueWindow = new Date(today);
      dueWindow.setDate(today.getDate() + 3);
      setDueSoonGroups(
        teacherTaskGroups
          .filter(g => g.status === 'published' && g.dueDate >= now && g.dueDate <= dueWindow)
          .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
      );

      // Ungraded submissions across all this teacher's task groups
      loadUngradedSubmissions(teacherTaskGroups);

    } catch (err: any) {
      console.error('Error loading teacher dashboard data:', err);
      setError('Failed to load dashboard data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Pulls submissions for every task group this teacher owns and keeps the ones still awaiting a grade.
  // Kept separate from loadDashboardData so a failure here never blocks the rest of the dashboard.
  const loadUngradedSubmissions = async (groups: TaskGroup[]) => {
    setAttentionLoading(true);
    try {
      const publishedGroups = groups.filter(g => g.status !== 'draft');
      const perGroupSubs = await Promise.all(
        publishedGroups.map(g => taskService.getGroupSubmissions(g.id).catch(() => []))
      );
      const ungraded = publishedGroups.flatMap((g, i) =>
        perGroupSubs[i]
          .filter(s => s.status !== 'reviewed')
          .map(s => ({ ...s, groupTitle: g.title }))
      ).sort((a, b) => a.submittedAt.getTime() - b.submittedAt.getTime()); // oldest waiting first
      setUngradedSubmissions(ungraded);
    } catch (err) {
      console.error('Error loading ungraded submissions:', err);
      setUngradedSubmissions([]);
    } finally {
      setAttentionLoading(false);
    }
  };

  const handleCreateAnnouncement = () => {
    setShowAnnouncementModal(true);
  };

  const handleAnnouncementSuccess = () => {
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
          <p className="text-gray-400">Loading teacher dashboard data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-white mb-2">Error Loading Dashboard</h3>
        <p className="text-gray-400 mb-4">{error}</p>
        <button
          onClick={loadDashboardData}
          className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Teacher Dashboard</h1>
          <p className="text-gray-400 mt-1">Inspire minds, shape futures</p>
        </div>
        <button
          onClick={handleCreateAnnouncement}
          className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg transition-colors shadow-lg hover:shadow-xl"
        >
          <Megaphone size={20} />
          <span>Create Announcement</span>
        </button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Total Students"
          value={totalStudents.toString()}
          change={{ value: "12%", positive: true }} // Placeholder for actual change calculation
          icon={<Users size={20} className="text-white" />}
          onClick={() => navigate('/course-enrollment')}
        />
        <StatsCard
          title="Active Courses"
          value={activeCourses.toString()}
          change={{ value: "2", positive: true }} // Placeholder
          icon={<BookOpen size={20} className="text-white" />}
          onClick={() => navigate('/course-creation')}
        />
        <StatsCard
          title="Avg. Performance"
          value={`${avgPerformance}%`}
          change={{ value: "5%", positive: true }} // Placeholder
          icon={<TrendingUp size={20} className="text-white" />}
          onClick={() => navigate('/leaderboard')}
        />
        <StatsCard
          title="Classes This Week"
          value={upcomingClasses.length.toString()} // Use actual count
          change={{ value: "3", positive: true }} // Still hardcoded
          icon={<Calendar size={20} className="text-white" />}
          onClick={() => navigate('/study-plan')}
        />
      </div>

      {/* Needs Your Attention */}
      <NeedsAttentionCard
        loading={attentionLoading}
        ungradedSubmissions={ungradedSubmissions}
        dueSoonGroups={dueSoonGroups}
        pendingQuestionsCount={pendingQuestionsCount}
        pendingQuestionsPreview={pendingQuestionsPreview}
      />

      {/* My Courses */}
      <MyCoursesStrip loading={loading} courses={myCourses} />

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Recent Student Activity" className="p-6">
          <div className="space-y-4">
            {recentStudentActivity.length > 0 ? (
              recentStudentActivity.map((activity, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-background-800 rounded-lg">
                  <div>
                    <p className="font-medium text-white">{activity.studentName}</p>
                    <p className="text-sm text-gray-400">{activity.description}</p>
                  </div>
                  <span className={`text-sm font-medium ${activity.statusColor}`}>{activity.status}</span>
                </div>
              ))
            ) : (
              <div className="text-center py-6">
                <p className="text-gray-400 mb-3">No recent student activity.</p>
                {activeCourses === 0 ? (
                  <button
                    onClick={() => navigate('/course-creation')}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-400 hover:text-primary-300 transition-colors"
                  >
                    <BookOpen size={14} /> Create your first course
                  </button>
                ) : (
                  <button
                    onClick={() => navigate('/course-enrollment')}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-400 hover:text-primary-300 transition-colors"
                  >
                    <Users size={14} /> View your courses to get students enrolled
                  </button>
                )}
              </div>
            )}
          </div>
        </Card>

        <Card title="Upcoming Classes" className="p-6">
          <div className="space-y-4">
            {upcomingClasses.length > 0 ? (
              upcomingClasses.map((cls) => (
                <div key={cls.id} className={`flex items-center justify-between p-3 rounded-lg border-l-4 border-primary-500 bg-primary-900/20`}>
                  <div>
                    <p className="font-medium text-white">{cls.title}</p>
                    <p className="text-sm text-gray-400">{cls.course} - {format(cls.date, 'MMM d')}</p>
                  </div>
                  <span className="text-sm text-primary-400 font-medium">{cls.startTime} - {cls.endTime}</span>
                </div>
              ))
            ) : (
              <div className="text-center py-6">
                <p className="text-gray-400 mb-3">No upcoming classes scheduled.</p>
                <button
                  onClick={() => navigate('/study-plan')}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-400 hover:text-primary-300 transition-colors"
                >
                  <Calendar size={14} /> Schedule a class
                </button>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Teacher Inspiration Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card title="Teaching Resources" className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { icon: BookOpen, color: 'text-primary-400', title: 'Lesson Plans', desc: 'Create and manage your lesson content', path: '/content' },
                { icon: Users, color: 'text-secondary-400', title: 'Topic Groups', desc: 'Organize subjects, chapters & topics', path: '/teacher-topic-groups' },
                { icon: TrendingUp, color: 'text-accent-400', title: 'Progress Reports', desc: 'Grading stats & submission rates', path: '/teacher-tasks' },
                { icon: Calendar, color: 'text-warning-DEFAULT', title: 'Schedule', desc: 'Manage your teaching schedule', path: '/study-plan' },
              ].map(({ icon: TileIcon, color, title, desc, path }) => (
                <div
                  key={title}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(path)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate(path); }}
                  className="p-4 bg-background-800 rounded-lg hover:bg-background-700 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <TileIcon size={20} className={color} />
                    <h4 className="font-medium text-white">{title}</h4>
                  </div>
                  <p className="text-sm text-gray-400">{desc}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Daily Inspiration */}
        <Card title="Daily Inspiration" icon={<Lightbulb size={20} className="text-warning-DEFAULT" />}>
          <div className="text-center">
            <div className="mb-4">
              <div className="text-4xl mb-3">🎓</div>
              <blockquote className="text-sm text-gray-300 italic leading-relaxed mb-3">
                "{dailyQuote.text}"
              </blockquote>
              <cite className="text-xs text-primary-400 font-medium">
                — {dailyQuote.author}
              </cite>
            </div>

            <div className="mt-4 pt-4 border-t border-background-700">
              <button
                onClick={() => setDailyQuote(getRandomQuoteByCategory('education'))}
                className="text-xs bg-background-700 hover:bg-background-600 text-gray-300 hover:text-white px-3 py-1.5 rounded-full transition-colors flex items-center gap-1 mx-auto"
              >
                <RotateCcw size={12} />
                New Quote
              </button>
            </div>
          </div>
        </Card>
      </div>

      {/* Create Announcement Modal */}
      {showAnnouncementModal && (
        <CreateAnnouncementModal
          onClose={() => setShowAnnouncementModal(false)}
          onSuccess={handleAnnouncementSuccess}
        />
      )}
    </div>
  );
}

// ─── Needs Your Attention widget ───────────────────────────────────────────────
// Surfaces the three things a teacher is most likely to be blocking students on:
// ungraded submissions, task groups due soon, and unanswered questions — each
// row links straight to where it can be acted on.

function joinNames(names: string[], extraCount: number): string {
  if (names.length === 0) return '';
  const base = names.slice(0, 2).join(', ');
  const remaining = names.length - 2 + extraCount;
  return remaining > 0 ? `${base} +${remaining} more` : base;
}

interface NeedsAttentionCardProps {
  loading: boolean;
  ungradedSubmissions: (Submission & { groupTitle: string })[];
  dueSoonGroups: TaskGroup[];
  pendingQuestionsCount: number;
  pendingQuestionsPreview: Question[];
}

function NeedsAttentionCard({
  loading, ungradedSubmissions, dueSoonGroups, pendingQuestionsCount, pendingQuestionsPreview,
}: NeedsAttentionCardProps) {
  const totalItems = ungradedSubmissions.length + dueSoonGroups.length + pendingQuestionsCount;

  const dueDateLabel = (d: Date) => {
    const diffHrs = (d.getTime() - Date.now()) / 36e5;
    if (diffHrs <= 24) return `due ${formatDistanceToNow(d, { addSuffix: true })}`;
    return `due ${format(d, 'MMM d')}`;
  };

  return (
    <Card title="Needs Your Attention" icon={<AlertTriangle size={20} className="text-warning-DEFAULT" />} className="p-6">
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-8 text-gray-400">
          <Loader size={16} className="animate-spin" />
          <span className="text-sm">Checking what needs you...</span>
        </div>
      ) : totalItems === 0 ? (
        <div className="text-center py-8">
          <PartyPopper size={28} className="mx-auto text-primary-400 mb-2" />
          <p className="text-white font-medium">You're all caught up!</p>
          <p className="text-sm text-gray-400 mt-1">No grading, questions, or deadlines need you right now.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {ungradedSubmissions.length > 0 && (
            <a
              href="/teacher-tasks"
              className="flex items-center justify-between gap-3 p-4 rounded-lg bg-background-800 hover:bg-background-700 transition-colors border-l-4 border-orange-500"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-orange-500/15 flex items-center justify-center shrink-0">
                  <ClipboardCheck size={18} className="text-orange-400" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-white">
                    {ungradedSubmissions.length} submission{ungradedSubmissions.length === 1 ? '' : 's'} awaiting grading
                  </p>
                  <p className="text-xs text-gray-400 truncate">
                    {joinNames(ungradedSubmissions.map(s => s.studentName), 0)}
                    {ungradedSubmissions[0] && ` · oldest waiting ${formatDistanceToNow(ungradedSubmissions[0].submittedAt)}`}
                  </p>
                </div>
              </div>
              <ChevronRight size={18} className="text-gray-500 shrink-0" />
            </a>
          )}

          {dueSoonGroups.length > 0 && (
            <a
              href="/teacher-tasks"
              className="flex items-center justify-between gap-3 p-4 rounded-lg bg-background-800 hover:bg-background-700 transition-colors border-l-4 border-red-500"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-red-500/15 flex items-center justify-center shrink-0">
                  <Clock size={18} className="text-red-400" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-white">
                    {dueSoonGroups.length} task group{dueSoonGroups.length === 1 ? '' : 's'} due soon
                  </p>
                  <p className="text-xs text-gray-400 truncate">
                    {dueSoonGroups[0].title} — {dueDateLabel(dueSoonGroups[0].dueDate)}
                    {dueSoonGroups.length > 1 && ` +${dueSoonGroups.length - 1} more`}
                  </p>
                </div>
              </div>
              <ChevronRight size={18} className="text-gray-500 shrink-0" />
            </a>
          )}

          {pendingQuestionsCount > 0 && (
            <a
              href="/teacher-qa"
              className="flex items-center justify-between gap-3 p-4 rounded-lg bg-background-800 hover:bg-background-700 transition-colors border-l-4 border-primary-500"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-primary-500/15 flex items-center justify-center shrink-0">
                  <MessageSquare size={18} className="text-primary-400" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-white">
                    {pendingQuestionsCount} question{pendingQuestionsCount === 1 ? '' : 's'} waiting for an answer
                  </p>
                  <p className="text-xs text-gray-400 truncate">
                    {joinNames(pendingQuestionsPreview.map(q => q.studentName), pendingQuestionsCount - pendingQuestionsPreview.length)}
                    {pendingQuestionsPreview[0] && ` · ${pendingQuestionsPreview[0].subject}`}
                  </p>
                </div>
              </div>
              <ChevronRight size={18} className="text-gray-500 shrink-0" />
            </a>
          )}
        </div>
      )}
    </Card>
  );
}

// ─── My Courses strip ──────────────────────────────────────────────────────────
// A real, clickable overview of the courses this teacher actually owns —
// replaces the previous "Active Courses" number with something browsable.

interface MyCoursesStripProps {
  loading: boolean;
  courses: Course[];
}

function MyCoursesStrip({ loading, courses }: MyCoursesStripProps) {
  const navigate = useNavigate();

  return (
    <Card title="My Courses" icon={<BookOpen size={20} className="text-primary-400" />} className="p-6">
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-8 text-gray-400">
          <Loader size={16} className="animate-spin" />
          <span className="text-sm">Loading your courses...</span>
        </div>
      ) : courses.length === 0 ? (
        <div className="text-center py-8">
          <BookOpen size={28} className="mx-auto text-gray-500 mb-2" />
          <p className="text-white font-medium">You haven't created a course yet</p>
          <p className="text-sm text-gray-400 mt-1 mb-4">Publish your first course to start enrolling students.</p>
          <button
            onClick={() => navigate('/course-creation')}
            className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium"
          >
            <Plus size={16} /> Create a Course
          </button>
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-1 -mx-1 px-1">
          {courses.map(course => {
            const thumb = course.thumbnailUrl || course.thumbnail;
            return (
              <div
                key={course.id}
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/course-creation/${course.id}`)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate(`/course-creation/${course.id}`); }}
                className="shrink-0 w-56 bg-background-800 hover:bg-background-700 rounded-xl overflow-hidden cursor-pointer transition-colors border border-white/5 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <div className="h-24 bg-gradient-to-br from-primary-600/40 to-secondary-600/30 flex items-center justify-center relative">
                  {thumb ? (
                    <img src={thumb} alt={course.title} className="w-full h-full object-cover" />
                  ) : (
                    <BookOpen size={26} className="text-white/70" />
                  )}
                  <span
                    className={`absolute top-2 right-2 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      course.isPublished ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/30 text-gray-300'
                    }`}
                  >
                    {course.isPublished ? 'Published' : 'Draft'}
                  </span>
                </div>
                <div className="p-3">
                  <p className="font-medium text-white text-sm truncate" title={course.title}>{course.title}</p>
                  <p className="text-xs text-gray-400 truncate mt-0.5">{course.class || course.category}</p>
                  <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
                    <span className="flex items-center gap-1"><Users size={12} /> {course.studentCount || 0}</span>
                    <span className="flex items-center gap-1">
                      <Star size={12} className={course.rating > 0 ? 'text-yellow-400 fill-yellow-400' : ''} />
                      {course.rating > 0 ? course.rating.toFixed(1) : '—'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Always-present "add new" tile */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => navigate('/course-creation')}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate('/course-creation'); }}
            className="shrink-0 w-56 rounded-xl border-2 border-dashed border-white/10 hover:border-primary-500/50 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors text-gray-400 hover:text-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <Plus size={22} />
            <span className="text-sm font-medium">New Course</span>
          </div>
        </div>
      )}
    </Card>
  );
}
