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
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import ComingSoon from './pages/ComingSoon';
import CourseCreation from './pages/CourseCreation';
import PaymentManagement from './pages/PaymentManagement';
import MCQPractice from './pages/MCQPractice';
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

import { useDashboard } from './contexts/DashboardContext';

// Protected Route Component for Admin-only pages
const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isAuthenticated } = useDashboard();
  
  if (!isAuthenticated || user?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <>{children}</>;
};

// Protected Route Component for Teacher and Admin pages
const TeacherAdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isAuthenticated } = useDashboard();
  
  if (!isAuthenticated || (user?.role !== 'admin' && user?.role !== 'teacher')) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <>{children}</>;
};

// Protected Route Component for Student-only pages
const StudentRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isAuthenticated } = useDashboard();
  
  if (!isAuthenticated || user?.role !== 'student') {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <>{children}</>;
};

// Protected Route Component for Teacher-only pages
const TeacherRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isAuthenticated } = useDashboard();
  
  if (!isAuthenticated || user?.role !== 'teacher') {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <>{children}</>;
};

// Protected Route Component for Admin, Manager, Coordinator pages
const ManagementRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isAuthenticated } = useDashboard();
  
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
  const { user, isAuthenticated } = useDashboard();
  
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

const AppRoutes = () => {
  const { user, isAuthenticated, loading } = useDashboard();

  // CRITICAL FIX: Optimistic rendering while Firebase confirms auth
  // Eliminates 3-5 second blank screen on page reload
  // Security: Firebase still validates in background and will force logout if invalid
  if (loading) {
    // Check localStorage for auth tokens
    const hasAuthToken = localStorage.getItem('token') || localStorage.getItem('user_id');
    
    if (hasAuthToken) {
      // User likely authenticated - render routes optimistically
      // Firebase will validate in background and redirect if invalid
      // This prevents blank screen during auth check
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
            {/* Show a loading state for the main route while Firebase confirms */}
            <Route index element={
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
                  <p className="text-gray-400">Loading dashboard...</p>
                </div>
              </div>
            } />
            
            {/* All other routes render normally - Firebase will redirect if needed */}
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="student-dashboard" element={<StudentDashboard />} />
            <Route path="student-qa" element={<StudentQA />} />
            <Route path="student-tasks" element={<StudentTaskDashboard />} />
            <Route path="student-study-plan" element={<StudentStudyPlan />} />
            <Route path="teacher-dashboard" element={<TeacherDashboard />} />
            <Route path="teacher-qa" element={<TeacherQA />} />
            <Route path="teacher-tasks" element={<TeacherTaskManagement />} />
            <Route path="payments" element={<PaymentManagement />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="announcements" element={<AllAnnouncements />} />
            <Route path="manage-coupon" element={<CouponManagement />} />
            <Route path="users" element={<ManageUsers />} />
            <Route path="manage/students" element={<ManageStudent />} />
            <Route path="manage/parents" element={<ManageParent />} />
            <Route path="manage/teachers" element={<ManageTeacher />} />
            <Route path="manage/coordinators" element={<ManageCoordinator />} />
            <Route path="manage/managers" element={<ManageManager />} />
            <Route path="manage/admins" element={<ManageAdmin />} />
            <Route path="content" element={<ContentUpload />} />
            <Route path="course-creation" element={<CourseCreation />} />
            <Route path="course-creation/:courseId" element={<CourseCreation />} />
            <Route path="study-plan" element={<StudyPlan />} />
            <Route path="progress" element={<Progress />} />
            <Route path="content-library" element={<ContentLibrary />} />
            <Route path="course-enrollment" element={<CourseEnrollment />} />
            <Route path="receipt" element={<CourseReceipt />} />
            <Route path="mcq-practice" element={<MCQPractice />} />
            <Route path="achievements" element={<Achievements />} />
            <Route path="coming-soon" element={<ComingSoon />} />
            <Route path="settings" element={<Settings />} />
            <Route path="question/:questionId" element={<QuestionDetail />} />
          </Route>
        </Routes>
      );
    }
    
    // No auth tokens - stay on public routes or show blank
    // The DashboardLayout will handle showing login modal
    return (
      <Routes>
        <Route path="/payment-success" element={<PaymentSuccess />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/terms-of-service" element={<TermsOfService />} />
        <Route path="/verify-profile" element={<VerifyProfile />} />
        <Route path="/verify-id" element={<VerifyId />} />
        <Route path="/verify-receipt" element={<VerifyReceipt />} />
        <Route path="*" element={<DashboardLayout />} />
      </Routes>
    );
  }

  // Firebase auth check complete - render with proper role-based protection
  // Redirect users to their appropriate dashboard by default
  const getDefaultRoute = () => {
    if (!isAuthenticated) return '/dashboard';
    if (user?.role === 'student') return '/student-dashboard';
    if (user?.role === 'teacher') return '/teacher-dashboard';
    return '/dashboard'; // Admin, Manager, Coordinator goes to main dashboard
  };

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
        <Route index element={<Navigate to={getDefaultRoute()} replace />} />
        
        {/* Admin dashboard */}
        <Route path="dashboard" element={
          <AdminRoute>
            <Dashboard />
          </AdminRoute>
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
          <TeacherAdminRoute>
            <Progress />
          </TeacherAdminRoute>
        } />
        
        {/* Public routes (all authenticated users) */}
        <Route path="content-library" element={<ContentLibrary />} />
        <Route path="course-enrollment" element={<CourseEnrollment />} />
        <Route path="receipt" element={<CourseReceipt />} />
        <Route path="mcq-practice" element={<MCQPractice />} />
        <Route path="achievements" element={<Achievements />} />
        <Route path="coming-soon" element={<ComingSoon />} />
        <Route path="settings" element={<Settings />} />
        <Route path="question/:questionId" element={<QuestionDetail />} />
      </Route>
    </Routes>
  );
};

export default AppRoutes;
