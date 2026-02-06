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
      // Simplify error message for invalid credentials
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password' || error.message?.toLowerCase().includes('credential')) {
        setError('Wrong Current Password');
      } else {
        setError('Wrong Current Password');
      }
    } finally {
      setLoading(false);
    }
  };

  // Success State
  if (success) {
    return (
      <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center z-50 p-4">
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700/50 rounded-2xl w-full max-w-md p-8 relative shadow-2xl animate-fadeIn">
          <div className="text-center">
            <div className="flex justify-center mb-6">
              <div className="bg-emerald-950/50 border border-emerald-800/30 rounded-full p-4 shadow-lg animate-scaleIn">
                <CheckCircle size={64} className="text-emerald-400" />
              </div>
            </div>
            
            <h2 className="text-4xl font-bold text-slate-100 mb-4" style={{ fontFamily: 'Inter, sans-serif' }}>
              Password Changed!
            </h2>
            
            <p className="text-slate-400 text-lg mb-6" style={{ fontFamily: 'Inter, sans-serif' }}>
              Your password has been successfully updated.
            </p>

            <div className="bg-blue-950/50 border border-blue-800/30 rounded-xl p-4">
              <p className="text-sm text-blue-300 font-medium" style={{ fontFamily: 'Inter, sans-serif' }}>
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
    <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700/50 rounded-2xl w-full max-w-md relative shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-slate-900 rounded-t-2xl px-8 pt-8 pb-4 border-b border-slate-700/30 z-10">
          <button
            onClick={onClose}
            disabled={loading}
            className="absolute top-6 right-6 p-2 hover:bg-slate-800 disabled:hover:bg-transparent disabled:opacity-50 rounded-full transition-colors"
            aria-label="Close"
          >
            <X size={24} className="text-slate-400 hover:text-slate-300" />
          </button>
          
          <div className="flex items-center gap-3 mb-3">
            <div className="h-12 w-12 rounded-xl bg-cyan-600/10 border border-cyan-500/30 flex items-center justify-center shadow-md">
              <Lock size={24} className="text-cyan-400" />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-slate-100" style={{ fontFamily: 'Inter, sans-serif' }}>
                Change Password
              </h2>
            </div>
          </div>
          <p className="text-slate-400" style={{ fontFamily: 'Inter, sans-serif' }}>
            Update your account password for enhanced security
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-8 py-6 space-y-6">
          {/* Error Message */}
          {error && (
            <div className="bg-red-950/50 border border-red-800/30 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle size={20} className="text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-red-300 text-sm font-semibold" style={{ fontFamily: 'Inter, sans-serif' }}>
                {error}
              </p>
            </div>
          )}

          {/* Password Requirements Info */}
          <div className="bg-blue-950/50 border border-blue-800/30 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <Shield size={18} className="text-blue-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-blue-300 mb-2" style={{ fontFamily: 'Inter, sans-serif' }}>
                  Password Requirements:
                </p>
                <ul className="text-xs text-blue-400 space-y-1" style={{ fontFamily: 'Inter, sans-serif' }}>
                  <li>• At least 8 characters long</li>
                  <li>• Contains uppercase and lowercase letters</li>
                  <li>• Contains at least one number</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Current Password */}
          <div>
            <label className="block text-sm font-bold text-slate-300 mb-2" style={{ fontFamily: 'Inter, sans-serif' }}>
              Current Password <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <input
                type={showCurrentPassword ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => {
                  setCurrentPassword(e.target.value);
                  setError('');
                }}
                className="w-full bg-slate-900 text-slate-100 rounded-xl py-3 pl-11 pr-12 border border-slate-700/50 focus:border-cyan-500/50 focus:outline-none transition-all duration-200 font-semibold"
                style={{ fontFamily: 'Inter, sans-serif' }}
                placeholder="Enter current password"
                disabled={loading}
                required
              />
              <Lock size={18} className="absolute left-3.5 top-3.5 text-slate-500" />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-3.5 top-3.5 text-slate-500 hover:text-slate-400 transition-colors"
                disabled={loading}
                tabIndex={-1}
              >
                {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div>
            <label className="block text-sm font-bold text-slate-300 mb-2" style={{ fontFamily: 'Inter, sans-serif' }}>
              New Password <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  setError('');
                }}
                className="w-full bg-slate-900 text-slate-100 rounded-xl py-3 pl-11 pr-12 border border-slate-700/50 focus:border-cyan-500/50 focus:outline-none transition-all duration-200 font-semibold"
                style={{ fontFamily: 'Inter, sans-serif' }}
                placeholder="Enter new password"
                disabled={loading}
                required
              />
              <Key size={18} className="absolute left-3.5 top-3.5 text-slate-500" />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3.5 top-3.5 text-slate-500 hover:text-slate-400 transition-colors"
                disabled={loading}
                tabIndex={-1}
              >
                {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-sm font-bold text-slate-300 mb-2" style={{ fontFamily: 'Inter, sans-serif' }}>
              Confirm New Password <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setError('');
                }}
                className="w-full bg-slate-900 text-slate-100 rounded-xl py-3 pl-11 pr-12 border border-slate-700/50 focus:border-cyan-500/50 focus:outline-none transition-all duration-200 font-semibold"
                style={{ fontFamily: 'Inter, sans-serif' }}
                placeholder="Confirm new password"
                disabled={loading}
                required
              />
              <Key size={18} className="absolute left-3.5 top-3.5 text-slate-500" />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3.5 top-3.5 text-slate-500 hover:text-slate-400 transition-colors"
                disabled={loading}
                tabIndex={-1}
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {confirmPassword && newPassword && confirmPassword !== newPassword && (
              <p className="text-xs text-red-400 mt-1 font-medium" style={{ fontFamily: 'Inter, sans-serif' }}>
                Passwords do not match
              </p>
            )}
            {confirmPassword && newPassword && confirmPassword === newPassword && (
              <p className="text-xs text-emerald-400 mt-1 font-medium flex items-center gap-1" style={{ fontFamily: 'Inter, sans-serif' }}>
                <CheckCircle size={12} />
                Passwords match
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row justify-end gap-3 pt-6 border-t border-slate-700/30">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-6 py-3 bg-slate-800/60 hover:bg-slate-800 disabled:bg-slate-900 disabled:text-slate-600 text-slate-300 rounded-lg transition-all duration-200 border border-slate-700/50 font-medium"
              style={{ fontFamily: 'Inter, sans-serif' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !currentPassword || !newPassword || !confirmPassword || newPassword !== confirmPassword}
              className="px-6 py-3 bg-cyan-600/10 hover:bg-cyan-600/20 disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed text-cyan-400 border border-cyan-500/30 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 font-medium"
              style={{ fontFamily: 'Inter, sans-serif' }}
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
