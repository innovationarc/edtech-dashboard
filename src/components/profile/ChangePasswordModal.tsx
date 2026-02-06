// src/components/profile/ChangePasswordModal.tsx
import { useState } from 'react';
import { X, Lock, Eye, EyeOff, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import { authService } from '../../services/authService';

interface ChangePasswordModalProps {
  onClose: () => void;
  onSuccess?: () => void;
}

const ChangePasswordModal = ({ onClose, onSuccess }: ChangePasswordModalProps) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('All fields are required');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await authService.updatePassword(currentPassword, newPassword);
      setSuccess(true);
      
      setTimeout(() => {
        if (onSuccess) {
          onSuccess();
        }
        onClose();
      }, 2000);
    } catch (error: any) {
      console.error('Error changing password:', error);
      setError(error.message || 'Failed to change password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-3xl w-full max-w-md p-8 relative shadow-2xl">
          <div className="text-center">
            <div className="flex justify-center mb-6">
              <div className="bg-green-100 rounded-full p-4 shadow-lg">
                <CheckCircle size={64} className="text-green-600" />
              </div>
            </div>
            
            <h2 className="text-4xl font-bold text-gray-900 mb-4" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
              Password Changed!
            </h2>
            
            <p className="text-gray-600 text-lg mb-6" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
              Your password has been successfully updated.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl w-full max-w-md relative shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white rounded-t-3xl px-8 pt-8 pb-4 border-b-2 border-gray-200 z-10">
          <button
            onClick={onClose}
            disabled={loading}
            className="absolute top-6 right-6 p-2 hover:bg-gray-100 disabled:hover:bg-transparent disabled:opacity-50 rounded-full transition-colors"
            aria-label="Close"
          >
            <X size={24} className="text-gray-600" />
          </button>
          
          <div className="flex items-center gap-3 mb-3">
            <div className="h-12 w-12 rounded-xl bg-indigo-100 flex items-center justify-center shadow-md">
              <Lock size={24} className="text-indigo-600" />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-gray-900" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
                Change Password
              </h2>
            </div>
          </div>
          <p className="text-gray-600" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
            Update your account password
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-8 py-6">
          {/* Error Message */}
          {error && (
            <div className="mb-6 bg-red-50 border-2 border-red-200 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-red-800 text-sm font-semibold" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
                {error}
              </p>
            </div>
          )}

          {/* Current Password */}
          <div className="mb-6">
            <label className="block text-sm font-bold text-gray-700 mb-2" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
              Current Password
            </label>
            <div className="relative">
              <input
                type={showCurrentPassword ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => {
                  setCurrentPassword(e.target.value);
                  setError('');
                }}
                className="w-full bg-white text-gray-900 rounded-xl py-3 pl-11 pr-12 border-2 border-gray-300 focus:border-indigo-500 focus:outline-none transition-all duration-200 font-semibold"
                style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
                placeholder="Enter current password"
                disabled={loading}
                required
              />
              <Lock size={18} className="absolute left-3.5 top-3.5 text-gray-400" />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-3.5 top-3.5 text-gray-400 hover:text-gray-600"
                disabled={loading}
              >
                {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div className="mb-6">
            <label className="block text-sm font-bold text-gray-700 mb-2" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
              New Password
            </label>
            <div className="relative">
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  setError('');
                }}
                className="w-full bg-white text-gray-900 rounded-xl py-3 pl-11 pr-12 border-2 border-gray-300 focus:border-indigo-500 focus:outline-none transition-all duration-200 font-semibold"
                style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
                placeholder="Enter new password"
                disabled={loading}
                required
              />
              <Lock size={18} className="absolute left-3.5 top-3.5 text-gray-400" />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3.5 top-3.5 text-gray-400 hover:text-gray-600"
                disabled={loading}
              >
                {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div className="mb-6">
            <label className="block text-sm font-bold text-gray-700 mb-2" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
              Confirm New Password
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setError('');
                }}
                className="w-full bg-white text-gray-900 rounded-xl py-3 pl-11 pr-12 border-2 border-gray-300 focus:border-indigo-500 focus:outline-none transition-all duration-200 font-semibold"
                style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
                placeholder="Confirm new password"
                disabled={loading}
                required
              />
              <Lock size={18} className="absolute left-3.5 top-3.5 text-gray-400" />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3.5 top-3.5 text-gray-400 hover:text-gray-600"
                disabled={loading}
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row justify-end gap-3 pt-6 border-t-2 border-gray-200">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-6 py-3 bg-white hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400 text-gray-900 rounded-xl transition-all duration-200 border-2 border-gray-300 font-bold"
              style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !currentPassword || !newPassword || !confirmPassword}
              className="px-6 py-3 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 hover:from-indigo-700 hover:via-purple-700 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed text-white rounded-xl transition-all duration-300 active:scale-95 flex items-center justify-center gap-2 font-bold shadow-lg hover:shadow-xl"
              style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
            >
              {loading && <Loader size={18} className="animate-spin" />}
              <Lock size={18} />
              <span>{loading ? 'Updating...' : 'Change Password'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChangePasswordModal;
