// src/components/profile/ChangePasswordModal.tsx
import { useState, useEffect } from 'react';
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

  // Force repaint on mount to prevent blank spaces
  useEffect(() => {
    const timer = setTimeout(() => {
      window.scrollTo(0, 0);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

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
      <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-lg flex items-center justify-center z-[200] p-2 xs:p-3 sm:p-4 md:p-6">
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700/50 rounded-2xl sm:rounded-3xl w-full max-w-[280px] xs:max-w-xs sm:max-w-md p-4 xs:p-6 sm:p-8 relative shadow-2xl animate-fadeIn">
          <div className="text-center">
            <div className="flex justify-center mb-4 sm:mb-6">
              <div className="bg-emerald-950/50 border border-emerald-800/30 rounded-full p-3 xs:p-3.5 sm:p-4 shadow-lg animate-scaleIn">
                <CheckCircle className="w-12 h-12 xs:w-14 xs:h-14 sm:w-16 sm:h-16 text-emerald-400" />
              </div>
            </div>
            
            <h2 className="text-2xl xs:text-3xl sm:text-4xl font-bold text-slate-100 mb-3 sm:mb-4 leading-tight" style={{ fontFamily: 'Inter, sans-serif' }}>
              Password Changed!
            </h2>
            
            <p className="text-sm xs:text-base sm:text-lg text-slate-400 mb-4 sm:mb-6 leading-relaxed" style={{ fontFamily: 'Inter, sans-serif' }}>
              Your password has been successfully updated.
            </p>

            <div className="bg-blue-950/50 border border-blue-800/30 rounded-lg sm:rounded-xl p-3 xs:p-3.5 sm:p-4">
              <p className="text-xs xs:text-sm text-blue-300 font-medium leading-relaxed" style={{ fontFamily: 'Inter, sans-serif' }}>
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
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-lg flex items-center justify-center z-[200] p-2 xs:p-3 sm:p-4">
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700/50 rounded-2xl sm:rounded-3xl w-full max-w-[95vw] xs:max-w-[90vw] sm:max-w-md md:max-w-lg relative shadow-2xl max-h-[95vh] xs:max-h-[92vh] sm:max-h-[90vh] overflow-hidden flex flex-col">
        <div className="change-password-scroll overflow-y-auto overflow-x-hidden">
        {/* Header */}
        <div className="sticky top-0 bg-slate-900 px-3 xs:px-4 sm:px-6 md:px-8 pt-4 xs:pt-5 sm:pt-6 md:pt-8 pb-3 xs:pb-3.5 sm:pb-4 border-b border-slate-700/30 z-10">
          <button
            onClick={onClose}
            disabled={loading}
            className="absolute right-4 top-4 sm:right-6 sm:top-6 text-slate-400 hover:text-slate-100 transition-all duration-200 hover:rotate-90 hover:scale-110 z-10 bg-slate-800 rounded-full p-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Close"
          >
            <X size={24} />
          </button>
          
          <div className="flex items-center gap-2 xs:gap-2.5 sm:gap-3 mb-2 xs:mb-2.5 sm:mb-3 pr-14">
            <div className="h-9 w-9 xs:h-10 xs:w-10 sm:h-12 sm:w-12 md:h-16 md:w-16 rounded-lg sm:rounded-xl md:rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-xl flex-shrink-0">
              <Lock className="w-4 h-4 xs:w-5 xs:h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-xl xs:text-2xl sm:text-3xl font-bold text-slate-100 truncate" style={{ fontFamily: 'Inter, sans-serif' }}>
                Change Password
              </h2>
            </div>
          </div>
          <p className="text-xs xs:text-sm sm:text-base text-slate-400 leading-relaxed" style={{ fontFamily: 'Inter, sans-serif' }}>
            Update your account password for enhanced security
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-3 xs:px-4 sm:px-6 md:px-8 py-3 xs:py-4 sm:py-5 md:py-6 space-y-3 xs:space-y-4 sm:space-y-5 md:space-y-6">
          {/* Error Message */}
          {error && (
            <div className="bg-red-950/50 border border-red-800/30 rounded-lg sm:rounded-xl p-3 xs:p-3.5 sm:p-4 flex items-start gap-2 xs:gap-2.5 sm:gap-3">
              <AlertCircle className="w-4 h-4 xs:w-5 xs:h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-red-300 text-xs xs:text-sm font-semibold leading-relaxed" style={{ fontFamily: 'Inter, sans-serif' }}>
                {error}
              </p>
            </div>
          )}

          {/* Password Requirements Info */}
          <div className="bg-blue-950/50 border border-blue-800/30 rounded-lg sm:rounded-xl p-3 xs:p-3.5 sm:p-4">
            <div className="flex items-start gap-2 xs:gap-2.5 sm:gap-3">
              <Shield className="w-4 h-4 xs:w-[18px] xs:h-[18px] text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-xs xs:text-sm font-bold text-blue-300 mb-1.5 xs:mb-2" style={{ fontFamily: 'Inter, sans-serif' }}>
                  Password Requirements:
                </p>
                <ul className="text-[10px] xs:text-xs text-blue-400 space-y-0.5 xs:space-y-1 leading-relaxed" style={{ fontFamily: 'Inter, sans-serif' }}>
                  <li>• At least 8 characters long</li>
                  <li>• Contains uppercase and lowercase letters</li>
                  <li>• Contains at least one number</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Current Password */}
          <div className="min-w-0">
            <label className="block text-xs xs:text-sm font-bold text-slate-300 mb-1.5 xs:mb-2 truncate" style={{ fontFamily: 'Inter, sans-serif' }}>
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
                className="w-full bg-slate-900 text-slate-100 rounded-lg sm:rounded-xl py-2 xs:py-2.5 sm:py-3 pl-8 xs:pl-9 sm:pl-11 pr-10 xs:pr-11 sm:pr-12 border border-slate-700/50 focus:border-cyan-500/50 focus:outline-none transition-all duration-200 font-semibold text-xs xs:text-sm sm:text-base"
                style={{ fontFamily: 'Inter, sans-serif' }}
                placeholder="Enter current password"
                disabled={loading}
                required
              />
              <Lock className="absolute left-2.5 xs:left-3 sm:left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 xs:w-4 xs:h-4 sm:w-[18px] sm:h-[18px] text-slate-500 pointer-events-none" />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-2.5 xs:right-3 sm:right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-400 transition-colors p-1"
                disabled={loading}
                tabIndex={-1}
              >
                {showCurrentPassword ? <EyeOff className="w-4 h-4 xs:w-[18px] xs:h-[18px] sm:w-5 sm:h-5" /> : <Eye className="w-4 h-4 xs:w-[18px] xs:h-[18px] sm:w-5 sm:h-5" />}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div className="min-w-0">
            <label className="block text-xs xs:text-sm font-bold text-slate-300 mb-1.5 xs:mb-2 truncate" style={{ fontFamily: 'Inter, sans-serif' }}>
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
                className="w-full bg-slate-900 text-slate-100 rounded-lg sm:rounded-xl py-2 xs:py-2.5 sm:py-3 pl-8 xs:pl-9 sm:pl-11 pr-10 xs:pr-11 sm:pr-12 border border-slate-700/50 focus:border-cyan-500/50 focus:outline-none transition-all duration-200 font-semibold text-xs xs:text-sm sm:text-base"
                style={{ fontFamily: 'Inter, sans-serif' }}
                placeholder="Enter new password"
                disabled={loading}
                required
              />
              <Key className="absolute left-2.5 xs:left-3 sm:left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 xs:w-4 xs:h-4 sm:w-[18px] sm:h-[18px] text-slate-500 pointer-events-none" />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-2.5 xs:right-3 sm:right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-400 transition-colors p-1"
                disabled={loading}
                tabIndex={-1}
              >
                {showNewPassword ? <EyeOff className="w-4 h-4 xs:w-[18px] xs:h-[18px] sm:w-5 sm:h-5" /> : <Eye className="w-4 h-4 xs:w-[18px] xs:h-[18px] sm:w-5 sm:h-5" />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div className="min-w-0">
            <label className="block text-xs xs:text-sm font-bold text-slate-300 mb-1.5 xs:mb-2 truncate" style={{ fontFamily: 'Inter, sans-serif' }}>
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
                className="w-full bg-slate-900 text-slate-100 rounded-lg sm:rounded-xl py-2 xs:py-2.5 sm:py-3 pl-8 xs:pl-9 sm:pl-11 pr-10 xs:pr-11 sm:pr-12 border border-slate-700/50 focus:border-cyan-500/50 focus:outline-none transition-all duration-200 font-semibold text-xs xs:text-sm sm:text-base"
                style={{ fontFamily: 'Inter, sans-serif' }}
                placeholder="Confirm new password"
                disabled={loading}
                required
              />
              <Key className="absolute left-2.5 xs:left-3 sm:left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 xs:w-4 xs:h-4 sm:w-[18px] sm:h-[18px] text-slate-500 pointer-events-none" />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-2.5 xs:right-3 sm:right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-400 transition-colors p-1"
                disabled={loading}
                tabIndex={-1}
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4 xs:w-[18px] xs:h-[18px] sm:w-5 sm:h-5" /> : <Eye className="w-4 h-4 xs:w-[18px] xs:h-[18px] sm:w-5 sm:h-5" />}
              </button>
            </div>
            {confirmPassword && newPassword && confirmPassword !== newPassword && (
              <p className="text-[10px] xs:text-xs text-red-400 mt-1 xs:mt-1.5 font-medium leading-relaxed" style={{ fontFamily: 'Inter, sans-serif' }}>
                Passwords do not match
              </p>
            )}
            {confirmPassword && newPassword && confirmPassword === newPassword && (
              <p className="text-[10px] xs:text-xs text-emerald-400 mt-1 xs:mt-1.5 font-medium flex items-center gap-1 leading-relaxed" style={{ fontFamily: 'Inter, sans-serif' }}>
                <CheckCircle className="w-3 h-3 flex-shrink-0" />
                Passwords match
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col xs:flex-row justify-end gap-2 xs:gap-2.5 sm:gap-3 pt-3 xs:pt-4 sm:pt-6 border-t border-slate-700/30">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="w-full xs:w-auto px-4 xs:px-5 sm:px-6 py-2 xs:py-2.5 sm:py-3 bg-slate-800/60 hover:bg-slate-800 disabled:bg-slate-900 disabled:text-slate-600 text-slate-300 rounded-lg transition-all duration-200 border border-slate-700/50 font-medium text-xs xs:text-sm sm:text-base order-2 xs:order-1"
              style={{ fontFamily: 'Inter, sans-serif' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !currentPassword || !newPassword || !confirmPassword || newPassword !== confirmPassword}
              className="w-full xs:w-auto px-4 xs:px-5 sm:px-6 py-2 xs:py-2.5 sm:py-3 bg-cyan-600/10 hover:bg-cyan-600/20 disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed text-cyan-400 border border-cyan-500/30 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 font-medium text-xs xs:text-sm sm:text-base order-1 xs:order-2"
              style={{ fontFamily: 'Inter, sans-serif' }}
            >
              {loading && <Loader className="w-4 h-4 xs:w-[18px] xs:h-[18px] animate-spin" />}
              <Lock className="w-4 h-4 xs:w-[18px] xs:h-[18px]" />
              <span>{loading ? 'Updating...' : 'Change Password'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChangePasswordModal;
