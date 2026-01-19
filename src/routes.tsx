import { Routes, Route, Navigate } from 'react-router-dom';
import DashboardLayout from './components/layout/DashboardLayout';
import Dashboard from './pages/Dashboard';
import StudentDashboard from './pages/StudentDashboard';
import TeacherDashboard from './pages/TeacherDashboard';
import ManageUsers from './pages/ManageUsers';
import ContentUpload from './pages/ContentManage';
import ContentLibrary from './pages/ContentLibrary';
import CourseEnrollment from './pages/CourseEnrollment';
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
import StudentQA from './pages/StudentQA'; // Import StudentQA
import StudentTaskDashboard from './pages/StudentTaskDashboard'; // Import StudentTaskDashboard
import StudentStudyPlan from './pages/StudentStudyPlan'; // Import StudentStudyPlan
import TeacherQA from './pages/TeacherQA'; // Import TeacherQA
import TeacherTaskManagement from './pages/TeacherTaskManagement'; // Import TeacherTaskManagement
import QuestionDetail from './pages/QuestionDetail'; // Import QuestionDetail
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

const AppRoutes = () => {
  const { user, isAuthenticated } = useDashboard();

  // Redirect users to their appropriate dashboard by default
  const getDefaultRoute = () => {
    if (!isAuthenticated) return '/dashboard';
    if (user?.role === 'student') return '/student-dashboard';
    if (user?.role === 'teacher') return '/teacher-dashboard';
    return '/dashboard'; // Admin goes to main dashboard
  };

  return (
    <Routes>
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
        <Route path="users" element={
          <AdminRoute>
            <ManageUsers />
          </AdminRoute>
        } />
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
        
        {/* Teacher and Admin routes */}
        <Route path="content" element={
          <TeacherAdminRoute>
            <ContentManage />
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
        <Route path="mcq-practice" element={<MCQPractice />} />
        <Route path="achievements" element={<Achievements />} />
        <Route path="coming-soon" element={<ComingSoon />} />
        <Route path="settings" element={<Settings />} />
        <Route path="question/:questionId" element={<QuestionDetail />} /> {/* New Question Detail Route */}
      </Route>
    </Routes>
  );
};

export default AppRoutes;
