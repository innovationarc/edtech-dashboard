import { Routes, Route, Navigate } from 'react-router-dom';
import DashboardLayout from './components/layout/DashboardLayout';
import Dashboard from './pages/Dashboard';
import StudentDashboard from './pages/StudentDashboard';
import TeacherDashboard from './pages/TeacherDashboard';
import ManageUsers from './pages/ManageUsers';
import ContentUpload from './pages/ContentUpload';
import ContentLibrary from './pages/ContentLibrary';
import CourseEnrollment from './pages/CourseEnrollment';
import PaymentSuccess from './pages/PaymentSuccess';
import StudyPlan from './pages/StudyPlan';
import Progress from './pages/Progress';
import Leaderboard from './pages/Leaderboard';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import ComingSoon from './pages/ComingSoon';
import CourseCreation from './pages/CourseCreation';
import PaymentManagement from './pages/PaymentManagement';
import Achievements from './pages/Achievements';
import AllAnnouncements from './pages/AllAnnouncements';
import StudentQA from './pages/StudentQA';
import StudentTaskDashboard from './pages/StudentTaskDashboard';
import StudentStudyPlan from './pages/StudentStudyPlan';
import TeacherQA from './pages/TeacherQA';
import TeacherTaskManagement from './pages/TeacherTaskManagement';
import QuestionDetail from './pages/QuestionDetail';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsOfService from './pages/TermsOfService';
import VerifyProfile from './pages/VerifyProfile';
import VerifyId from './pages/VerifyId'; // NEW: ID Card Verification
import CourseReceipt from './pages/CourseReceipt'; // Receipt page
import VerifyReceipt from './pages/VerifyReceipt'; // Public receipt verification

// Import role-specific management pages (placeholders)
import ManageStudent from './pages/ManageStudent';
import ManageParent from './pages/ManageParent';
import ManageTeacher from './pages/ManageTeacher';
import ManageCoordinator from './pages/ManageCoordinator';
import ManageManager from './pages/ManageManager';
import ManageAdmin from './pages/ManageAdmin';

// NEW: Coupon Management
import CouponManagement from './pages/CouponManagement';

// Coming Soon Management
import ComingSoonManagement from './pages/ComingSoonManagement';

// AI Model Settings (Admin only)
import AIModelSettings from './pages/AIModelSettings';

// NEW: Course Assignment Management
import CourseAssignment from './pages/CourseAssignment';

// NEW: Content Library Viewer Pages
import LessonViewer from './pages/LessonViewer';
import NoteViewer from './pages/NoteViewer';
import ExamViewer from './pages/ExamViewer';

// NEW: Exam Evaluation Page (teacher/admin/evaluator)
import ExamEvaluation from './pages/ExamEvaluation';

import { useDashboard } from './contexts/DashboardContext';

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
            <AIModelSettings />
          </AdminRoute>
        } />

        {/* Course Assignment Management - Admin and Manager */}
        <Route path="course-assignment" element={
          <AdminManagerRoute>
            <CourseAssignment />
          </AdminManagerRoute>
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
        <Route path="content-library/exam/:courseId/:contentId" element={<ExamViewer />} />

        {/* ── Exam Evaluation Routes ── */}
        {/* Hub page — shows all exams with written parts */}
        <Route path="exam-evaluation" element={
          <EvaluatorRoute>
            <ExamEvaluation />
          </EvaluatorRoute>
        } />
        {/* Direct link to a specific exam's evaluation */}
        <Route path="exam-evaluation/:contentId" element={
          <EvaluatorRoute>
            <ExamEvaluation />
          </EvaluatorRoute>
        } />
        {/* Scoped to a specific course */}
        <Route path="exam-evaluation/:contentId/:courseId" element={
          <EvaluatorRoute>
            <ExamEvaluation />
          </EvaluatorRoute>
        } />

      </Route>
    </Routes>
  );
};

export default AppRoutes;
