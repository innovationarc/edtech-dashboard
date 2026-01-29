import { useState } from 'react';
import { useDashboard } from '../../contexts/DashboardContext';
import ProfileView from '../../components/profile/ProfileView';
import ProfileEditModal from '../../components/profile/ProfileEditModal';
import ChangePasswordModal from '../../components/profile/ChangePasswordModal';
import { Loader } from 'lucide-react';

const Profile = () => {
  const { user, loading } = useDashboard();
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary-400 via-purple-400 to-primary-500 mb-2">
            My Profile
          </h1>
          <p className="text-gray-400 text-lg">
            View and manage your personal information
          </p>
        </div>

        {/* Profile View */}
        <ProfileView
          user={user}
          onEdit={() => setShowEditModal(true)}
          onChangePassword={() => setShowPasswordModal(true)}
        />

        {/* Edit Profile Modal */}
        {showEditModal && (
          <ProfileEditModal
            onClose={() => setShowEditModal(false)}
            onSuccess={() => {
              setShowEditModal(false);
              // Profile will auto-refresh via the context
            }}
          />
        )}

        {/* Change Password Modal */}
        {showPasswordModal && (
          <ChangePasswordModal
            onClose={() => setShowPasswordModal(false)}
            onSuccess={() => {
              setShowPasswordModal(false);
            }}
          />
        )}
      </div>
    </div>
  );
};

export default Profile;
