// src/components/profile/ChangePasswordModal.tsx
import { useState } from 'react';
import { X, Lock, Eye, EyeOff, CheckCircle, AlertCircle, Loader, Shield, Key } from 'lucide-react';
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

  const validatePassword = (password: string): string | null => {
    if (password.length < 8) {
      return 'Password must be at least 8 characters long';
    }
    if (!/[A-Z]/.test(password)) {
      return 'Password must contain at least one uppercase letter';
    }
    if (!/[a-z]/.test(password)) {
      return 'Password must contain at least one lowercase letter';
    }
    if (!/[0-9]/.test(password)) {
      return 'Password must contain at least one number';
    }
    return null;
  };

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

    const validationError = validatePassword(newPassword);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (currentPassword === newPassword) {
      setError('New password must be different from current password');
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
      setError(error.message || 'Failed to change password. Please verify your current password and try again.');
    } finally {
      setLoading(false);
    }
  };

  // Success State
  if (success) {
    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-3xl w-full max-w-md p-8 relative shadow-2xl animate-fadeIn">
          <div className="text-center">
            <div className="flex justify-center mb-6">
              <div className="bg-green-100 rounded-full p-4 shadow-lg animate-scaleIn">
                <CheckCircle size={64} className="text-green-600" />
              </div>
            </div>
            
            <h2 className="text-4xl font-bold text-gray-900 mb-4" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
              Password Changed!
            </h2>
            
            <p className="text-gray-600 text-lg mb-6" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
              Your password has been successfully updated.
            </p>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p className="text-sm text-blue-800 font-medium" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
                Please use your new password for future logins.
              </p>
            </div>
          </div>
        </div>
        <style>{`
          @keyframes fadeIn {
            from {
              opacity: 0;
              transform: scale(0.95);
            }
            to {
              opacity: 1;
              transform: scale(1);
            }
          }
          @keyframes scaleIn {
            from {
              transform: scale(0);
            }
            to {
              transform: scale(1);
            }
          }
          .animate-fadeIn {
            animation: fadeIn 0.3s ease-out;
          }
          .animate-scaleIn {
            animation: scaleIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
          }
        `}</style>
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
            Update your account password for enhanced security
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-8 py-6 space-y-6">
          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-red-800 text-sm font-semibold" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
                {error}
              </p>
            </div>
          )}

          {/* Password Requirements Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <Shield size={18} className="text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-blue-900 mb-2" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
                  Password Requirements:
                </p>
                <ul className="text-xs text-blue-800 space-y-1" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
                  <li>• At least 8 characters long</li>
                  <li>• Contains uppercase and lowercase letters</li>
                  <li>• Contains at least one number</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Current Password */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
              Current Password <span className="text-red-500">*</span>
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
                className="absolute right-3.5 top-3.5 text-gray-400 hover:text-gray-600 transition-colors"
                disabled={loading}
                tabIndex={-1}
              >
                {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
              New Password <span className="text-red-500">*</span>
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
              <Key size={18} className="absolute left-3.5 top-3.5 text-gray-400" />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3.5 top-3.5 text-gray-400 hover:text-gray-600 transition-colors"
                disabled={loading}
                tabIndex={-1}
              >
                {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
              Confirm New Password <span className="text-red-500">*</span>
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
              <Key size={18} className="absolute left-3.5 top-3.5 text-gray-400" />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3.5 top-3.5 text-gray-400 hover:text-gray-600 transition-colors"
                disabled={loading}
                tabIndex={-1}
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {confirmPassword && newPassword && confirmPassword !== newPassword && (
              <p className="text-xs text-red-600 mt-1 font-medium" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
                Passwords do not match
              </p>
            )}
            {confirmPassword && newPassword && confirmPassword === newPassword && (
              <p className="text-xs text-green-600 mt-1 font-medium flex items-center gap-1" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
                <CheckCircle size={12} />
                Passwords match
              </p>
            )}
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
              disabled={loading || !currentPassword || !newPassword || !confirmPassword || newPassword !== confirmPassword}
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
