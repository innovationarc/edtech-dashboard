// src/components/profile/ChangePasswordForm.tsx
import { useState } from 'react';
import { Lock, Eye, EyeOff, Loader, CheckCircle, AlertCircle, X } from 'lucide-react';
import { authService } from '../../services/authService';

interface ChangePasswordModalProps {
  onClose: () => void;
  onSuccess?: () => void;
}

const ChangePasswordModal = ({ onClose, onSuccess }: ChangePasswordModalProps) => {
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  const togglePasswordVisibility = (field: 'current' | 'new' | 'confirm') => {
    setShowPasswords(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const validatePassword = (password: string): string[] => {
    const errors = [];
    if (password.length < 8) {
      errors.push('At least 8 characters long');
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('At least one uppercase letter');
    }
    if (!/[a-z]/.test(password)) {
      errors.push('At least one lowercase letter');
    }
    if (!/\d/.test(password)) {
      errors.push('At least one number');
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('At least one special character');
    }
    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Validation
    if (!formData.currentPassword) {
      setError('Current password is required');
      setLoading(false);
      return;
    }

    if (!formData.newPassword) {
      setError('New password is required');
      setLoading(false);
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      setError('New passwords do not match');
      setLoading(false);
      return;
    }

    if (formData.currentPassword === formData.newPassword) {
      setError('New password must be different from current password');
      setLoading(false);
      return;
    }

    // Validate new password strength
    const passwordErrors = validatePassword(formData.newPassword);
    if (passwordErrors.length > 0) {
      setError(`Password must have: ${passwordErrors.join(', ')}`);
      setLoading(false);
      return;
    }

    try {
      await authService.updatePassword(formData.currentPassword, formData.newPassword);
      
      setSuccess(true);
      
      // Clear form
      setFormData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      
      // Show success message briefly, then close
      setTimeout(() => {
        if (onSuccess) {
          onSuccess();
        }
        onClose();
      }, 2000);
      
    } catch (error: any) {
      console.error('Error updating password:', error);
      setError(error.message || 'Failed to update password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const passwordStrength = validatePassword(formData.newPassword);
  const strengthScore = Math.max(0, 5 - passwordStrength.length);
  const strengthColors = ['bg-red-500', 'bg-red-500', 'bg-yellow-500', 'bg-yellow-500', 'bg-green-500'];
  const strengthLabels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'];

  if (success) {
    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4">
        <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-3xl w-full max-w-md p-8 relative shadow-2xl border border-gray-700/50">
          <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 via-emerald-500/5 to-green-500/10 rounded-3xl"></div>
          
          <div className="relative text-center">
            <div className="flex justify-center mb-6">
              <div className="relative">
                <div className="absolute inset-0 bg-green-500/30 blur-2xl"></div>
                <div className="relative bg-gradient-to-br from-green-400 to-emerald-500 rounded-full p-4 shadow-2xl shadow-green-500/50">
                  <CheckCircle size={64} className="text-white" />
                </div>
              </div>
            </div>
            
            <h2 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 via-emerald-400 to-green-500 mb-6">
              Password Changed!
            </h2>
            
            <div className="bg-gradient-to-r from-green-900/40 to-emerald-900/40 text-green-200 px-6 py-4 rounded-xl border border-green-700/50 backdrop-blur-sm">
              <p>Your password has been changed successfully. Please use your new password for future sign-ins.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-3xl w-full max-w-2xl my-4 relative shadow-2xl border border-gray-700/50">
        <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 to-orange-500/5 rounded-3xl pointer-events-none"></div>
        
        <button
          onClick={onClose}
          disabled={loading}
          className="absolute right-4 top-4 text-gray-400 hover:text-white transition-all duration-200 hover:rotate-90 hover:scale-110 z-10"
        >
          <X size={24} />
        </button>

        <div className="p-6 sm:p-8 relative">
          <div className="flex items-center gap-4 mb-8">
            <div className="relative">
              <div className="absolute inset-0 bg-yellow-500/30 blur-2xl"></div>
              <div className="relative h-16 w-16 rounded-2xl bg-gradient-to-br from-yellow-500 to-orange-600 flex items-center justify-center shadow-2xl shadow-yellow-500/50">
                <Lock size={32} className="text-white" />
              </div>
            </div>
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-orange-400 to-yellow-500">
                Change Password
              </h2>
              <p className="text-gray-400 text-sm mt-1">Update your account password</p>
            </div>
          </div>

          <div className="bg-yellow-900/20 border border-yellow-700/30 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-full bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
                <Lock size={20} className="text-yellow-400" />
              </div>
              <div>
                <h3 className="text-white font-medium mb-1">Security Notice</h3>
                <p className="text-sm text-gray-300">
                  For security reasons, you'll need to enter your current password to set a new one.
                </p>
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-900/40 border border-red-700/50 text-red-200 px-4 py-3 rounded-xl mb-6 backdrop-blur-sm flex items-center gap-2">
              <AlertCircle size={18} />
              <span className="text-sm">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Current Password */}
            <div className="bg-gray-800/40 backdrop-blur-xl rounded-2xl p-6 border border-gray-700/30">
              <label className="block text-sm font-medium text-gray-300 mb-3">
                Current Password *
              </label>
              <div className="relative group">
                <input
                  type={showPasswords.current ? 'text' : 'password'}
                  value={formData.currentPassword}
                  onChange={(e) => handleInputChange('currentPassword', e.target.value)}
                  className="w-full bg-gray-800/60 text-white rounded-xl py-3 pl-11 pr-12 border border-gray-700/50 focus:border-yellow-500/50 focus:outline-none focus:ring-2 focus:ring-yellow-500/20 transition-all duration-200 group-hover:border-gray-600"
                  placeholder="Enter your current password"
                  disabled={loading}
                  required
                />
                <Lock size={18} className="absolute left-3.5 top-3.5 text-gray-400 group-hover:text-yellow-400 transition-colors" />
                <button
                  type="button"
                  onClick={() => togglePasswordVisibility('current')}
                  className="absolute right-3.5 top-3.5 text-gray-400 hover:text-white transition-colors"
                  disabled={loading}
                >
                  {showPasswords.current ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div className="bg-gray-800/40 backdrop-blur-xl rounded-2xl p-6 border border-gray-700/30">
              <label className="block text-sm font-medium text-gray-300 mb-3">
                New Password *
              </label>
              <div className="relative group">
                <input
                  type={showPasswords.new ? 'text' : 'password'}
                  value={formData.newPassword}
                  onChange={(e) => handleInputChange('newPassword', e.target.value)}
                  className="w-full bg-gray-800/60 text-white rounded-xl py-3 pl-11 pr-12 border border-gray-700/50 focus:border-yellow-500/50 focus:outline-none focus:ring-2 focus:ring-yellow-500/20 transition-all duration-200 group-hover:border-gray-600"
                  placeholder="Enter your new password"
                  disabled={loading}
                  required
                />
                <Lock size={18} className="absolute left-3.5 top-3.5 text-gray-400 group-hover:text-yellow-400 transition-colors" />
                <button
                  type="button"
                  onClick={() => togglePasswordVisibility('new')}
                  className="absolute right-3.5 top-3.5 text-gray-400 hover:text-white transition-colors"
                  disabled={loading}
                >
                  {showPasswords.new ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              
              {/* Password Strength Indicator */}
              {formData.newPassword && (
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-400">Password strength:</span>
                    <span className={`text-xs font-medium ${
                      strengthScore >= 4 ? 'text-green-400' :
                      strengthScore >= 2 ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {strengthLabels[strengthScore]}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    {[0, 1, 2, 3, 4].map((index) => (
                      <div
                        key={index}
                        className={`h-2 flex-1 rounded-full transition-colors ${
                          index < strengthScore ? strengthColors[strengthScore] : 'bg-gray-700'
                        }`}
                      />
                    ))}
                  </div>
                  {passwordStrength.length > 0 && (
                    <div className="mt-3 bg-gray-900/50 rounded-lg p-3">
                      <p className="text-xs text-gray-400 mb-2">Password must have:</p>
                      <ul className="text-xs space-y-1">
                        {passwordStrength.map((requirement, index) => (
                          <li key={index} className="text-red-400 flex items-center gap-2">
                            <span className="text-red-500">✗</span>
                            <span>{requirement}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Confirm New Password */}
            <div className="bg-gray-800/40 backdrop-blur-xl rounded-2xl p-6 border border-gray-700/30">
              <label className="block text-sm font-medium text-gray-300 mb-3">
                Confirm New Password *
              </label>
              <div className="relative group">
                <input
                  type={showPasswords.confirm ? 'text' : 'password'}
                  value={formData.confirmPassword}
                  onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                  className="w-full bg-gray-800/60 text-white rounded-xl py-3 pl-11 pr-12 border border-gray-700/50 focus:border-yellow-500/50 focus:outline-none focus:ring-2 focus:ring-yellow-500/20 transition-all duration-200 group-hover:border-gray-600"
                  placeholder="Confirm your new password"
                  disabled={loading}
                  required
                />
                <Lock size={18} className="absolute left-3.5 top-3.5 text-gray-400 group-hover:text-yellow-400 transition-colors" />
                <button
                  type="button"
                  onClick={() => togglePasswordVisibility('confirm')}
                  className="absolute right-3.5 top-3.5 text-gray-400 hover:text-white transition-colors"
                  disabled={loading}
                >
                  {showPasswords.confirm ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {formData.confirmPassword && formData.newPassword !== formData.confirmPassword && (
                <p className="text-xs text-red-400 mt-2 flex items-center gap-1">
                  <span className="text-red-500">✗</span>
                  Passwords do not match
                </p>
              )}
            </div>

            {/* Security Tips */}
            <div className="bg-gray-800/40 backdrop-blur-xl rounded-2xl p-6 border border-gray-700/30">
              <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <Shield size={16} className="text-yellow-400" />
                Password Security Tips
              </h4>
              <ul className="text-xs text-gray-400 space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-yellow-400">•</span>
                  <span>Use a unique password that you don't use elsewhere</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-yellow-400">•</span>
                  <span>Include a mix of letters, numbers, and special characters</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-yellow-400">•</span>
                  <span>Avoid using personal information like names or birthdays</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-yellow-400">•</span>
                  <span>Consider using a password manager</span>
                </li>
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row justify-end gap-3 pt-6 border-t border-gray-700/50">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-6 py-3 bg-gray-800/60 hover:bg-gray-700/60 disabled:bg-gray-800/30 disabled:text-gray-500 text-white rounded-xl transition-all duration-200 border border-gray-700/50 hover:border-gray-600 font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !formData.currentPassword || !formData.newPassword || 
                         !formData.confirmPassword || formData.newPassword !== formData.confirmPassword ||
                         passwordStrength.length > 0}
                className="px-6 py-3 bg-gradient-to-r from-yellow-600 via-orange-600 to-yellow-600 hover:from-yellow-700 hover:via-orange-700 hover:to-yellow-700 disabled:from-gray-700 disabled:to-gray-800 disabled:cursor-not-allowed text-white rounded-xl transition-all duration-300 active:scale-95 flex items-center justify-center gap-2 font-semibold shadow-lg hover:shadow-yellow-500/50"
              >
                {loading && <Loader size={18} className="animate-spin" />}
                <Lock size={18} />
                <span>{loading ? 'Updating...' : 'Update Password'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ChangePasswordModal;
