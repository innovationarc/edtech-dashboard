// src/components/profile/ChangePasswordModal.tsx
import { useState } from 'react';
import { Lock, Eye, EyeOff, Loader, CheckCircle, AlertCircle, X, Shield } from 'lucide-react';
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
        <div className="bg-white rounded-3xl w-full max-w-md p-8 relative shadow-2xl">
          <div className="text-center">
            <div className="flex justify-center mb-6">
              <div className="bg-green-100 rounded-full p-4 shadow-lg">
                <CheckCircle size={64} className="text-green-600" />
              </div>
            </div>
            
            <h2 className="text-4xl font-bold text-gray-900 mb-6" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
              Password Changed!
            </h2>
            
            <div className="bg-green-50 text-green-800 px-6 py-4 rounded-xl border border-green-200">
              <p className="font-semibold" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>Your password has been changed successfully. Please use your new password for future sign-ins.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl w-full max-w-2xl my-4 relative shadow-2xl">
        <button
          onClick={onClose}
          disabled={loading}
          className="absolute right-4 top-4 text-gray-600 hover:text-gray-900 transition-all duration-200 hover:rotate-90 hover:scale-110 z-10 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <X size={24} />
        </button>

        <div className="p-6 sm:p-8 relative">
          <div className="flex items-center gap-4 mb-8">
            <div className="relative">
              <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-yellow-500 to-orange-600 flex items-center justify-center shadow-xl">
                <Lock size={32} className="text-white" />
              </div>
            </div>
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
                Change Password
              </h2>
              <p className="text-gray-600 text-sm mt-1 font-semibold" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>Update your account password</p>
            </div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-full bg-yellow-100 flex items-center justify-center flex-shrink-0">
                <Lock size={20} className="text-yellow-600" />
              </div>
              <div>
                <h3 className="text-gray-900 font-bold mb-1" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>Security Notice</h3>
                <p className="text-sm text-gray-700 font-semibold" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
                  For security reasons, you'll need to enter your current password to set a new one.
                </p>
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl mb-6 flex items-center gap-2">
              <AlertCircle size={18} />
              <span className="text-sm font-semibold" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Current Password */}
            <div className="bg-gray-50 rounded-2xl p-6 border border-gray-200">
              <label className="block text-sm font-bold text-gray-900 mb-3" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
                Current Password *
              </label>
              <div className="relative group">
                <input
                  type={showPasswords.current ? 'text' : 'password'}
                  value={formData.currentPassword}
                  onChange={(e) => handleInputChange('currentPassword', e.target.value)}
                  className="w-full bg-white text-gray-900 rounded-xl py-3 pl-11 pr-12 border-2 border-gray-300 focus:border-yellow-500 focus:outline-none transition-all duration-200 font-semibold"
                  style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
                  placeholder="Enter your current password"
                  disabled={loading}
                  required
                />
                <Lock size={18} className="absolute left-3.5 top-3.5 text-gray-400 group-hover:text-yellow-500 transition-colors" />
                <button
                  type="button"
                  onClick={() => togglePasswordVisibility('current')}
                  className="absolute right-3.5 top-3.5 text-gray-400 hover:text-gray-900 transition-colors"
                  disabled={loading}
                >
                  {showPasswords.current ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div className="bg-gray-50 rounded-2xl p-6 border border-gray-200">
              <label className="block text-sm font-bold text-gray-900 mb-3" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
                New Password *
              </label>
              <div className="relative group">
                <input
                  type={showPasswords.new ? 'text' : 'password'}
                  value={formData.newPassword}
                  onChange={(e) => handleInputChange('newPassword', e.target.value)}
                  className="w-full bg-white text-gray-900 rounded-xl py-3 pl-11 pr-12 border-2 border-gray-300 focus:border-yellow-500 focus:outline-none transition-all duration-200 font-semibold"
                  style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
                  placeholder="Enter your new password"
                  disabled={loading}
                  required
                />
                <Lock size={18} className="absolute left-3.5 top-3.5 text-gray-400 group-hover:text-yellow-500 transition-colors" />
                <button
                  type="button"
                  onClick={() => togglePasswordVisibility('new')}
                  className="absolute right-3.5 top-3.5 text-gray-400 hover:text-gray-900 transition-colors"
                  disabled={loading}
                >
                  {showPasswords.new ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              
              {/* Password Strength Indicator */}
              {formData.newPassword && (
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-600 font-bold" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>Password strength:</span>
                    <span className={`text-xs font-bold ${
                      strengthScore >= 4 ? 'text-green-600' :
                      strengthScore >= 2 ? 'text-yellow-600' : 'text-red-600'
                    }`} style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
                      {strengthLabels[strengthScore]}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    {[0, 1, 2, 3, 4].map((index) => (
                      <div
                        key={index}
                        className={`h-2 flex-1 rounded-full transition-colors ${
                          index < strengthScore ? strengthColors[strengthScore] : 'bg-gray-300'
                        }`}
                      />
                    ))}
                  </div>
                  {passwordStrength.length > 0 && (
                    <div className="mt-3 bg-white rounded-lg p-3 border border-gray-200">
                      <p className="text-xs text-gray-700 mb-2 font-bold" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>Password must have:</p>
                      <ul className="text-xs space-y-1">
                        {passwordStrength.map((requirement, index) => (
                          <li key={index} className="text-red-700 flex items-center gap-2 font-semibold" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
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
            <div className="bg-gray-50 rounded-2xl p-6 border border-gray-200">
              <label className="block text-sm font-bold text-gray-900 mb-3" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
                Confirm New Password *
              </label>
              <div className="relative group">
                <input
                  type={showPasswords.confirm ? 'text' : 'password'}
                  value={formData.confirmPassword}
                  onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                  className="w-full bg-white text-gray-900 rounded-xl py-3 pl-11 pr-12 border-2 border-gray-300 focus:border-yellow-500 focus:outline-none transition-all duration-200 font-semibold"
                  style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
                  placeholder="Confirm your new password"
                  disabled={loading}
                  required
                />
                <Lock size={18} className="absolute left-3.5 top-3.5 text-gray-400 group-hover:text-yellow-500 transition-colors" />
                <button
                  type="button"
                  onClick={() => togglePasswordVisibility('confirm')}
                  className="absolute right-3.5 top-3.5 text-gray-400 hover:text-gray-900 transition-colors"
                  disabled={loading}
                >
                  {showPasswords.confirm ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {formData.confirmPassword && formData.newPassword !== formData.confirmPassword && (
                <p className="text-xs text-red-600 mt-2 flex items-center gap-1 font-semibold" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
                  <span className="text-red-500">✗</span>
                  Passwords do not match
                </p>
              )}
            </div>

            {/* Security Tips */}
            <div className="bg-gray-50 rounded-2xl p-6 border border-gray-200">
              <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
                <Shield size={16} className="text-yellow-500" />
                Password Security Tips
              </h4>
              <ul className="text-xs text-gray-700 space-y-2">
                <li className="flex items-start gap-2 font-semibold" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
                  <span className="text-yellow-500">•</span>
                  <span>Use a unique password that you don't use elsewhere</span>
                </li>
                <li className="flex items-start gap-2 font-semibold" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
                  <span className="text-yellow-500">•</span>
                  <span>Include a mix of letters, numbers, and special characters</span>
                </li>
                <li className="flex items-start gap-2 font-semibold" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
                  <span className="text-yellow-500">•</span>
                  <span>Avoid using personal information like names or birthdays</span>
                </li>
                <li className="flex items-start gap-2 font-semibold" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
                  <span className="text-yellow-500">•</span>
                  <span>Consider using a password manager</span>
                </li>
              </ul>
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
                disabled={loading || !formData.currentPassword || !formData.newPassword || 
                         !formData.confirmPassword || formData.newPassword !== formData.confirmPassword ||
                         passwordStrength.length > 0}
                className="px-6 py-3 bg-gradient-to-r from-yellow-600 via-orange-600 to-yellow-600 hover:from-yellow-700 hover:via-orange-700 hover:to-yellow-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed text-white rounded-xl transition-all duration-300 active:scale-95 flex items-center justify-center gap-2 font-bold shadow-lg hover:shadow-xl"
                style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
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
