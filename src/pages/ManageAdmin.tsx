// ManageAdmin.tsx
import { Shield } from 'lucide-react';

const ManageAdmin = () => {
  return (
    <div className="flex flex-col items-center justify-center h-64 space-y-4">
      <Shield size={64} className="text-gray-500" />
      <h2 className="text-2xl font-bold text-white">Admin Management</h2>
      <p className="text-gray-400 text-center max-w-md">
        This feature is under development. Admin-specific management tools will be available soon.
      </p>
    </div>
  );
};

export default ManageAdmin;
