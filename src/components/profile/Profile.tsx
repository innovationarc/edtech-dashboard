import { useState } from 'react';
import { useDashboard } from '../../contexts/DashboardContext';
import Profile1 from './Profile-1';
import Profile2 from './Profile-2';
import Profile3 from './Profile-3';
import Profile4 from './Profile-4';
import Profile5 from './Profile-5';
import { Loader } from 'lucide-react';

interface ProfileProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const Profile = ({ isOpen = true, onClose }: ProfileProps) => {
  const { user, loading } = useDashboard();

  // Don't render if not open
  if (!isOpen) return null;

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950">
        <Loader size={48} className="animate-spin text-cyan-500" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950">
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
      return <Profile1 onClose={onClose} />;
    
    case 'manager':
    case 'coordinator':
    case 'student_manager':
    case 'course_manager':
      return <Profile2 onClose={onClose} />;
    
    case 'teacher':
      return <Profile3 onClose={onClose} />;
    
    case 'student':
      return <Profile4 onClose={onClose} />;
    
    case 'parent':
      return <Profile5 onClose={onClose} />;
    
    default:
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-white mb-2">Invalid Role</h2>
            <p className="text-gray-400">Your account role is not recognized.</p>
          </div>
        </div>
      );
  }
};

export default Profile;
