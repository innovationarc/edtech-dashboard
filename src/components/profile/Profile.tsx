import { useEffect } from 'react';
import { useDashboard } from '../../contexts/DashboardContext';
import Profile1 from './Profile-1';
import Profile2 from './Profile-2';
import Profile3 from './Profile-3';
import Profile4 from './Profile-4';
import Profile5 from './Profile-5';
import { Loader } from 'lucide-react';

const Profile = () => {
  const { user, loading } = useDashboard();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader size={48} className="animate-spin text-primary-500" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-2">User Not Found</h2>
          <p className="text-gray-400">Please sign in to view your profile.</p>
        </div>
      </div>
    );
  }

  // Route to appropriate profile based on user role
  switch (user.role) {
    case 'admin':
      return <Profile1 />;
    
    case 'manager':
    case 'coordinator':
    case 'student_manager':
    case 'course_manager':
      return <Profile2 />;
    
    case 'teacher':
      return <Profile3 />;
    
    case 'student':
      return <Profile4 />;
    
    case 'parent':
      return <Profile5 />;
    
    default:
      return (
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-white mb-2">Invalid Role</h2>
            <p className="text-gray-400">Your account role is not recognized.</p>
          </div>
        </div>
      );
  }
};

export default Profile;
