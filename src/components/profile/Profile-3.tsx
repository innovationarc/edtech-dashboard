import { useDashboard } from '../../contexts/DashboardContext';

const Profile3 = () => {
  const { user } = useDashboard();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary-400 via-purple-400 to-primary-500 mb-2">
            Teacher Profile
          </h1>
          <p className="text-gray-400 text-lg">
            Educator Dashboard Profile
          </p>
        </div>

        {/* Placeholder Content */}
        <div className="bg-gray-800 rounded-lg p-8 border border-gray-700">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-primary-500/20 rounded-full mb-4">
              <span className="text-4xl">👨‍🏫</span>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Teacher Profile Page</h2>
            <p className="text-gray-400 mb-4">Role: {user?.role}</p>
            <p className="text-gray-500">This is a placeholder for the teacher profile page.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile3;
