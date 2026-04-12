import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useDashboard } from './contexts/DashboardContext';

// ── Eagerly loaded (needed immediately on any page load) ──
import DashboardLayout from './components/layout/DashboardLayout';
import OfflineBanner from './components/shared/OfflineBanner';

// ── Lazy-loaded pages (each becomes its own chunk) ──
const Dashboard               = lazy(() => import('./pages/Dashboard'));
const StudentDashboard        = lazy(() => import('./pages/StudentDashboard'));
const TeacherDashboard        = lazy(() => import('./pages/TeacherDashboard'));
const ManageUsers             = lazy(() => import('./pages/ManageUsers'));
const ContentUpload           = lazy(() => import('./pages/ContentUpload'));
const ContentLibrary          = lazy(() => import('./pages/ContentLibrary'));
const CourseEnrollment        = lazy(() => import('./pages/CourseEnrollment'));
const PaymentSuccess          = lazy(() => import('./pages/PaymentSuccess'));
const StudyPlan               = lazy(() => import('./pages/StudyPlan'));
const Progress                = lazy(() => import('./pages/Progress'));
const Leaderboard             = lazy(() => import('./pages/Leaderboard'));
const Analytics               = lazy(() => import('./pages/Analytics'));
const Settings                = lazy(() => import('./pages/Settings'));
const ComingSoon              = lazy(() => import('./pages/ComingSoon'));
const CourseCreation          = lazy(() => import('./pages/CourseCreation'));
const PaymentManagement       = lazy(() => import('./pages/PaymentManagement'));
const Achievements            = lazy(() => import('./pages/Achievements'));
const AllAnnouncements        = lazy(() => import('./pages/AllAnnouncements'));
const StudentQA               = lazy(() => import('./pages/StudentQA'));
const StudentTaskDashboard    = lazy(() => import('./pages/StudentTaskDashboard'));
const StudentStudyPlan        = lazy(() => import('./pages/StudentStudyPlan'));
const TeacherQA               = lazy(() => import('./pages/TeacherQA'));
const TeacherTaskManagement   = lazy(() => import('./pages/TeacherTaskManagement'));
const QuestionDetail          = lazy(() => import('./pages/QuestionDetail'));
const PrivacyPolicy           = lazy(() => import('./pages/PrivacyPolicy'));
const TermsOfService          = lazy(() => import('./pages/TermsOfService'));
const VerifyProfile           = lazy(() => import('./pages/VerifyProfile'));
const VerifyId                = lazy(() => import('./pages/VerifyId'));
const CourseReceipt           = lazy(() => import('./pages/CourseReceipt'));
const VerifyReceipt           = lazy(() => import('./pages/VerifyReceipt'));
const ManageStudent           = lazy(() => import('./pages/ManageStudent'));
const ManageParent            = lazy(() => import('./pages/ManageParent'));
const ManageTeacher           = lazy(() => import('./pages/ManageTeacher'));
const ManageCoordinator       = lazy(() => import('./pages/ManageCoordinator'));
const ManageManager           = lazy(() => import('./pages/ManageManager'));
const ManageAdmin             = lazy(() => import('./pages/ManageAdmin'));
const CouponManagement        = lazy(() => import('./pages/CouponManagement'));
const ComingSoonManagement    = lazy(() => import('./pages/ComingSoonManagement'));
const AIModelSettings         = lazy(() => import('./pages/AIModelSettings'));
const AdminNovaContext        = lazy(() => import('./pages/AdminNovaContext'));
const NotificationsPage       = lazy(() => import('./components/shared/NotificationsPage'));
const TeacherTopicGroups      = lazy(() => import('./pages/TeacherTopicGroups'));
const CourseAssignment        = lazy(() => import('./pages/CourseAssignment'));
const LessonViewer            = lazy(() => import('./pages/LessonViewer'));
const NoteViewer              = lazy(() => import('./pages/NoteViewer'));
const ExamViewer              = lazy(() => import('./pages/ExamViewer'));
const ExamEvaluation          = lazy(() => import('./pages/ExamEvaluation'));
const TeacherLiveClass        = lazy(() => import('./pages/TeacherLiveClass'));
const StudentLiveClass        = lazy(() => import('./pages/StudentLiveClass'));
const LiveClassSettings       = lazy(() => import('./components/admin/LiveClassSettings'));
const TeacherStream           = lazy(() => import('./pages/TeacherStream'));
const StudentStream           = lazy(() => import('./pages/StudentStream'));
const StreamSettings          = lazy(() => import('./components/admin/StreamSettings'));
const LiveExam                = lazy(() => import('./pages/LiveExam'));
const AdminFirebaseMonitor    = lazy(() => import('./pages/AdminFirebaseMonitor'));

// ── Loading fallback ──
const PageLoader = () => (
  <div className="flex items-center justify-center h-64">
    <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
  </div>
);

// Returns the correct home dashboard path for any role
const getRoleDashboard = (role?: string): string => {
  if (role === 'student') return '/student-dashboard';
  if (role === 'teacher') return '/teacher-dashboard';
  return '/dashboard';
};

// Route guard specifically for /dashboard — redirects teachers/students to their own dashboard
const AdminDashboardRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isAuthenticated, loading } = useDashboard();
  if (loading || (isAuthenticated && !user)) return null;
  if (!isAuthenticated) return <Navigate to="/dashboard" replace />;
  // Only admin, manager, coordinator, student_manager, course_manager can see /dashboard
  const allowed = ['admin', 'manager', 'coordinator', 'student_manager', 'course_manager'];
  if (!allowed.includes(user?.role ?? '')) {
    return <Navigate to={getRoleDashboard(user?.role)} replace />;
  }
  return <>{children}</>;
};

// Protected Route Component for Admin-only pages
const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isAuthenticated, loading } = useDashboard();
  if (loading || (isAuthenticated && !user)) return null;
  if (!isAuthenticated || user?.role !== 'admin') {
    return <Navigate to={getRoleDashboard(user?.role)} replace />;
  }
  return <>{children}</>;
};

// Protected Route Component for Teacher and Admin pages
const TeacherAdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isAuthenticated, loading } = useDashboard();
  if (loading || (isAuthenticated && !user)) return null;
  if (!isAuthenticated || (user?.role !== 'admin' && user?.role !== 'teacher')) {
    return <Navigate to={getRoleDashboard(user?.role)} replace />;
  }
  return <>{children}</>;
};

// Protected Route Component for Student-only pages
const StudentRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isAuthenticated, loading } = useDashboard();
  if (loading || (isAuthenticated && !user)) return null;
  if (!isAuthenticated || user?.role !== 'student') {
    return <Navigate to={getRoleDashboard(user?.role)} replace />;
  }
  return <>{children}</>;
};

// Protected Route Component for Teacher-only pages
const TeacherRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isAuthenticated, loading } = useDashboard();
  if (loading || (isAuthenticated && !user)) return null;
  if (!isAuthenticated || user?.role !== 'teacher') {
    return <Navigate to={getRoleDashboard(user?.role)} replace />;
  }
  return <>{children}</>;
};

// Protected Route Component for Admin, Manager, Coordinator pages
const ManagementRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isAuthenticated, loading } = useDashboard();
  
  // Wait for user profile to load before checking role
  if (loading || (isAuthenticated && !user)) return null;
  
  if (!isAuthenticated || (user?.role !== 'admin' && user?.role !== 'manager' && user?.role !== 'coordinator')) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <div className="text-error-DEFAULT">
          <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-white">Access Denied</h2>
        <p className="text-gray-400 text-center max-w-md">
          Only administrators, managers, and coordinators can access this page.
        </p>
      </div>
    );
  }
  
  return <>{children}</>;
};

// Protected Route Component for Admin and Manager pages
const AdminManagerRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isAuthenticated, loading } = useDashboard();
  
  // Wait for user profile to load before checking role
  if (loading || (isAuthenticated && !user)) return null;
  
  if (!isAuthenticated || (user?.role !== 'admin' && user?.role !== 'manager')) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <div className="text-error-DEFAULT">
          <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-white">Access Denied</h2>
        <p className="text-gray-400 text-center max-w-md">
          Only administrators and managers can access this page.
        </p>
      </div>
    );
  }
  
  return <>{children}</>;
};

// Protected Route Component for Exam Evaluation — teachers, admins, managers, coordinators
const EvaluatorRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isAuthenticated, loading } = useDashboard();
  if (loading || (isAuthenticated && !user)) return null;
  const allowed = ['admin', 'teacher', 'manager', 'coordinator'];
  if (!isAuthenticated || !user?.role || !allowed.includes(user.role)) {
    return <Navigate to={getRoleDashboard(user?.role)} replace />;
  }
  return <>{children}</>;
};

// Protected Route for Leaderboard — all non-student staff roles
const LeaderboardRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isAuthenticated, loading } = useDashboard();
  if (loading || (isAuthenticated && !user)) return null;
  const allowed = ['admin', 'manager', 'teacher', 'coordinator', 'student_manager', 'course_manager'];
  if (!isAuthenticated || !user?.role || !allowed.includes(user.role)) {
    return <Navigate to={getRoleDashboard(user?.role)} replace />;
  }
  return <>{children}</>;
}; 

// Smart index redirect: waits for user profile before deciding which dashboard to show
const DefaultRedirect = () => {
  const { user, isAuthenticated, loading } = useDashboard();
  if (isAuthenticated && (loading || !user)) return null;
  return <Navigate to={getRoleDashboard(isAuthenticated ? user?.role : undefined)} replace />;
};

const AppRoutes = () => {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public routes - OUTSIDE DashboardLayout for clean display */}
        <Route path="/payment-success" element={<PaymentSuccess />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/terms-of-service" element={<TermsOfService />} />
        <Route path="/verify-profile" element={<VerifyProfile />} />
        
        {/* NEW: Public ID Card Verification - OUTSIDE DashboardLayout */}
        <Route path="/verify-id" element={<VerifyId />} />

        {/* Public receipt verification - OUTSIDE DashboardLayout, no auth required */}
        <Route path="/verify-receipt" element={<VerifyReceipt />} />
        
        <Route path="/" element={<DashboardLayout />}>
          <Route index element={<DefaultRedirect />} />
          
          {/* Admin dashboard - teachers/students are redirected to their own dashboard */}
          <Route path="dashboard" element={
            <AdminDashboardRoute>
              <Dashboard />
            </AdminDashboardRoute>
          } />
          
          {/* Student-only routes */}
          <Route path="student-dashboard" element={
            <StudentRoute>
              <StudentDashboard />
            </StudentRoute>
          } />
          
          {/* New Student Q&A Route */}
          <Route path="student-qa" element={
            <StudentRoute>
              <StudentQA />
            </StudentRoute>
          } />
          
          {/* New Student Task Dashboard Route */}
          <Route path="student-tasks" element={
            <StudentRoute>
              <StudentTaskDashboard />
            </StudentRoute>
          } />
          
          {/* New Student Study Plan Route */}
          <Route path="student-study-plan" element={
            <StudentRoute>
              <StudentStudyPlan />
            </StudentRoute>
          } />
          
          {/* Teacher-only routes */}
          <Route path="teacher-dashboard" element={
            <TeacherRoute>
              <TeacherDashboard />
            </TeacherRoute>
          } />
          
          {/* New Teacher Q&A Route */}
          <Route path="teacher-qa" element={
            <TeacherRoute>
              <TeacherQA />
            </TeacherRoute>
          } />
          
          {/* New Teacher Task Management Route */}
          <Route path="teacher-tasks" element={
            <TeacherRoute>
              <TeacherTaskManagement />
            </TeacherRoute>
          } />

          {/* Topic Groups — teacher defines subject/chapter/topic hierarchies for courses */}
          <Route path="teacher-topic-groups" element={
            <TeacherAdminRoute>
              <TeacherTopicGroups />
            </TeacherAdminRoute>
          } />
          
          {/* Admin-only routes */}
          <Route path="payments" element={
            <AdminRoute>
              <PaymentManagement />
            </AdminRoute>
          } />
          <Route path="analytics" element={
            <AdminRoute>
              <Analytics />
            </AdminRoute>
          } />
          <Route path="announcements" element={
            <AdminRoute>
              <AllAnnouncements />
            </AdminRoute>
          } />
          
          {/* Coupon Management - Admin and Manager */}
          <Route path="manage-coupon" element={
            <AdminManagerRoute>
              <CouponManagement />
            </AdminManagerRoute>
          } />

          {/* Coming Soon Management - Admin only */}
          <Route path="coming-soon-management" element={
            <AdminRoute>
              <ComingSoonManagement />
            </AdminRoute>
          } />

          {/* AI Model Settings - Admin only */}
          <Route path="ai-settings" element={
            <AdminRoute>
              <OfflineBanner feature="AI Model Settings">
                <AIModelSettings />
              </OfflineBanner>
            </AdminRoute>
          } />

          {/* Nova Chatbot Context - Admin only */}
          <Route path="nova-context" element={
            <AdminRoute>
              <OfflineBanner feature="Nova AI Context">
                <AdminNovaContext />
              </OfflineBanner>
            </AdminRoute>
          } />

          {/* Course Assignment Management - Admin and Manager */}
          <Route path="course-assignment" element={
            <AdminManagerRoute>
              <CourseAssignment />
            </AdminManagerRoute>
          } />

          {/* Firebase Monitor - Admin only */}
          <Route path="firebase-monitor" element={
            <AdminRoute>
              <OfflineBanner feature="Firebase Monitor">
                <AdminFirebaseMonitor />
              </OfflineBanner>
            </AdminRoute>
          } />
          
          {/* User Management - Admin, Manager, Coordinator */}
          <Route path="users" element={
            <ManagementRoute>
              <ManageUsers />
            </ManagementRoute>
          } />
          
          {/* Role-specific User Management Routes */}

          {/* Student Management - Admin, Manager, Coordinator */}
          <Route path="manage/students" element={
            <ManagementRoute>
              <ManageStudent />
            </ManagementRoute>
          } />
          
          {/* Parent Management - Admin, Manager, Coordinator */}
          <Route path="manage/parents" element={
            <ManagementRoute>
              <ManageParent />
            </ManagementRoute>
          } />
          
          {/* Teacher Management - Admin, Manager */}
          <Route path="manage/teachers" element={
            <AdminManagerRoute>
              <ManageTeacher />
            </AdminManagerRoute>
          } />
          
          {/* Coordinator Management - Admin, Manager */}
          <Route path="manage/coordinators" element={
            <AdminManagerRoute>
              <ManageCoordinator />
            </AdminManagerRoute>
          } />
          
          {/* Manager Management - Admin only */}
          <Route path="manage/managers" element={
            <AdminRoute>
              <ManageManager />
            </AdminRoute>
          } />
          
          {/* Admin Management - Admin only */}
          <Route path="manage/admins" element={
            <AdminRoute>
              <ManageAdmin />
            </AdminRoute>
          } />
          
          {/* Teacher and Admin routes */}
          <Route path="content" element={
            <TeacherAdminRoute>
              <ContentUpload />
            </TeacherAdminRoute>
          } />
          <Route path="course-creation" element={
            <TeacherAdminRoute>
              <CourseCreation />
            </TeacherAdminRoute>
          } />
          <Route path="course-creation/:courseId" element={
            <TeacherAdminRoute>
              <CourseCreation />
            </TeacherAdminRoute>
          } />
          <Route path="study-plan" element={
            <TeacherAdminRoute>
              <StudyPlan />
            </TeacherAdminRoute>
          } />
          <Route path="progress" element={
            <StudentRoute>
              <Progress />
            </StudentRoute>
          } />
          <Route path="leaderboard" element={
            <LeaderboardRoute>
              <Leaderboard />
            </LeaderboardRoute>
          } />
          
          {/* Public routes (all authenticated users) */}
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="content-library" element={<ContentLibrary />} />
          <Route path="course-enrollment" element={<CourseEnrollment />} />
          <Route path="receipt" element={<CourseReceipt />} />
          <Route path="achievements" element={<Achievements />} />
          <Route path="coming-soon" element={<ComingSoon />} />
          <Route path="settings" element={<Settings />} />
          <Route path="question/:questionId" element={<QuestionDetail />} />

          {/* ── Content Library Viewer Routes ── */}
          {/* Lesson & Trick share the same viewer page */}
          <Route path="content-library/lesson/:courseId/:contentId" element={<LessonViewer />} />
          {/* Note viewer */}
          <Route path="content-library/note/:courseId/:contentId" element={<NoteViewer />} />
          {/* Exam viewer — accessible to all authenticated users (student takes exam here) */}
          <Route path="content-library/exam/:courseId/:contentId" element={
            <OfflineBanner feature="Exams">
              <ExamViewer />
            </OfflineBanner>
          } />
          {/* Live exam direct route — no courseId, used by live exam page */}
          <Route path="exam/:contentId" element={
            <OfflineBanner feature="Exams">
              <ExamViewer />
            </OfflineBanner>
          } />

          {/* ── Exam Evaluation Routes ── */}
          {/* Hub page — shows all exams with written parts */}
          <Route path="exam-evaluation" element={
            <EvaluatorRoute>
              <OfflineBanner feature="Exam Evaluation">
                <ExamEvaluation />
              </OfflineBanner>
            </EvaluatorRoute>
          } />
          {/* Direct link to a specific exam's evaluation */}
          <Route path="exam-evaluation/:contentId" element={
            <EvaluatorRoute>
              <OfflineBanner feature="Exam Evaluation">
                <ExamEvaluation />
              </OfflineBanner>
            </EvaluatorRoute>
          } />
          {/* Scoped to a specific course */}
          <Route path="exam-evaluation/:contentId/:courseId" element={
            <EvaluatorRoute>
              <OfflineBanner feature="Exam Evaluation">
                <ExamEvaluation />
              </OfflineBanner>
            </EvaluatorRoute>
          } />

          {/* ── Live Class Routes ── */}
          {/* Teacher + Admin: schedule, host, and manage live classes */}
          <Route path="live-classes" element={
            <TeacherAdminRoute>
              <OfflineBanner feature="Live Classes">
                <TeacherLiveClass />
              </OfflineBanner>
            </TeacherAdminRoute>
          } />
          {/* Student: view upcoming, join live, and rewatch recordings */}
          <Route path="student-live-classes" element={
            <StudentRoute>
              <OfflineBanner feature="Live Classes">
                <StudentLiveClass />
              </OfflineBanner>
            </StudentRoute>
          } />
          {/* Admin only: configure provider, API keys, and Bunny.net */}
          <Route path="live-class-settings" element={
            <AdminRoute>
              <OfflineBanner feature="Live Class Settings">
                <LiveClassSettings />
              </OfflineBanner>
            </AdminRoute>
          } />

          {/* ── Streaming Routes ── */}
          {/* Teacher + Admin: create and manage live streams (YouTube, Bunny, Cloudflare) */}
          <Route path="streams" element={
            <TeacherAdminRoute>
              <OfflineBanner feature="Live Streams">
                <TeacherStream />
              </OfflineBanner>
            </TeacherAdminRoute>
          } />
          {/* Student: watch live streams and recordings */}
          <Route path="student-streams" element={
            <StudentRoute>
              <OfflineBanner feature="Live Streams">
                <StudentStream />
              </OfflineBanner>
            </StudentRoute>
          } />
          {/* Admin only: configure streaming provider API keys */}
          <Route path="stream-settings" element={
            <AdminRoute>
              <OfflineBanner feature="Stream Settings">
                <StreamSettings />
              </OfflineBanner>
            </AdminRoute>
          } />

          {/* ── Live Exam Routes ── */}
          {/* Teacher + Admin: create and manage live exams */}
          <Route path="live-exams" element={
            <TeacherAdminRoute>
              <OfflineBanner feature="Live Exams">
                <LiveExam />
              </OfflineBanner>
            </TeacherAdminRoute>
          } />
          {/* Student: view and attempt live exams assigned to them */}
          <Route path="student-live-exams" element={
            <StudentRoute>
              <OfflineBanner feature="Live Exams">
                <LiveExam />
              </OfflineBanner>
            </StudentRoute>
          } />

        </Route>
      </Routes>
    </Suspense>
  );
};

export default AppRoutes;
