import { useState } from 'react';
import { Lock, Eye, EyeOff, Loader, CheckCircle, AlertCircle } from 'lucide-react';
import { authService } from '../../services/authService';

interface ChangePasswordFormProps {
  onSuccess?: () => void;
}

const ChangePasswordForm = ({ onSuccess }: ChangePasswordFormProps) => {
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
    setError(''); // Clear error when user starts typing
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
      
      // Add success notification
      if ((window as any).addNotification) {
        (window as any).addNotification(
          'Password updated successfully!',
          'success'
        );
      }
      
      // Call success callback if provided
      if (onSuccess) {
        setTimeout(() => {
          onSuccess();
        }, 2000);
      }
      
    } catch (error: any) {
      console.error('Error updating password:', error);
      setError(error.message || 'Failed to update password. Please try again.');
      
      // Add error notification
      if ((window as any).addNotification) {
        (window as any).addNotification(
          'Failed to update password. Please check your current password.',
          'error'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const passwordStrength = validatePassword(formData.newPassword);
  const strengthScore = Math.max(0, 5 - passwordStrength.length);
  const strengthColors = ['bg-error-DEFAULT', 'bg-error-DEFAULT', 'bg-warning-DEFAULT', 'bg-warning-DEFAULT', 'bg-success-DEFAULT'];
  const strengthLabels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'];

  if (success) {
    return (
      <div className="bg-success-dark/20 border border-success-DEFAULT/30 rounded-lg p-6 text-center">
        <div className="flex justify-center mb-4">
          <CheckCircle size={48} className="text-success-DEFAULT" />
        </div>
        <h3 className="text-lg font-medium text-white mb-2">Password Updated Successfully!</h3>
        <p className="text-sm text-gray-300">
          Your password has been changed. Please remember to use your new password for future sign-ins.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-background-800 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-full bg-warning-DEFAULT flex items-center justify-center flex-shrink-0">
            <Lock size={20} className="text-white" />
          </div>
          <div>
            <h3 className="text-white font-medium mb-1">Change Your Password</h3>
            <p className="text-sm text-gray-400">
              For security reasons, you'll need to enter your current password to set a new one.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-error-dark text-error-light px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Current Password */}
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2">
            Current Password *
          </label>
          <div className="relative">
            <input
              type={showPasswords.current ? 'text' : 'password'}
              value={formData.currentPassword}
              onChange={(e) => handleInputChange('currentPassword', e.target.value)}
              className="w-full bg-background-800 text-white rounded-lg py-3 pl-10 pr-12 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors"
              placeholder="Enter your current password"
              disabled={loading}
              required
            />
            <Lock size={16} className="absolute left-3 top-3.5 text-gray-400" />
            <button
              type="button"
              onClick={() => togglePasswordVisibility('current')}
              className="absolute right-3 top-3.5 text-gray-400 hover:text-white transition-colors"
              disabled={loading}
            >
              {showPasswords.current ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {/* New Password */}
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2">
            New Password *
          </label>
          <div className="relative">
            <input
              type={showPasswords.new ? 'text' : 'password'}
              value={formData.newPassword}
              onChange={(e) => handleInputChange('newPassword', e.target.value)}
              className="w-full bg-background-800 text-white rounded-lg py-3 pl-10 pr-12 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors"
              placeholder="Enter your new password"
              disabled={loading}
              required
            />
            <Lock size={16} className="absolute left-3 top-3.5 text-gray-400" />
            <button
              type="button"
              onClick={() => togglePasswordVisibility('new')}
              className="absolute right-3 top-3.5 text-gray-400 hover:text-white transition-colors"
              disabled={loading}
            >
              {showPasswords.new ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          
          {/* Password Strength Indicator */}
          {formData.newPassword && (
            <div className="mt-2">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-gray-400">Password strength:</span>
                <span className={`text-xs font-medium ${
                  strengthScore >= 4 ? 'text-success-DEFAULT' :
                  strengthScore >= 2 ? 'text-warning-DEFAULT' : 'text-error-DEFAULT'
                }`}>
                  {strengthLabels[strengthScore]}
                </span>
              </div>
              <div className="flex gap-1">
                {[0, 1, 2, 3, 4].map((index) => (
                  <div
                    key={index}
                    className={`h-1 flex-1 rounded-full transition-colors ${
                      index < strengthScore ? strengthColors[strengthScore] : 'bg-background-700'
                    }`}
                  />
                ))}
              </div>
              {passwordStrength.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs text-gray-400 mb-1">Password must have:</p>
                  <ul className="text-xs space-y-1">
                    {passwordStrength.map((requirement, index) => (
                      <li key={index} className="text-error-DEFAULT flex items-center gap-1">
                        <span>•</span>
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
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2">
            Confirm New Password *
          </label>
          <div className="relative">
            <input
              type={showPasswords.confirm ? 'text' : 'password'}
              value={formData.confirmPassword}
              onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
              className="w-full bg-background-800 text-white rounded-lg py-3 pl-10 pr-12 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors"
              placeholder="Confirm your new password"
              disabled={loading}
              required
            />
            <Lock size={16} className="absolute left-3 top-3.5 text-gray-400" />
            <button
              type="button"
              onClick={() => togglePasswordVisibility('confirm')}
              className="absolute right-3 top-3.5 text-gray-400 hover:text-white transition-colors"
              disabled={loading}
            >
              {showPasswords.confirm ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {formData.confirmPassword && formData.newPassword !== formData.confirmPassword && (
            <p className="text-xs text-error-DEFAULT mt-1">Passwords do not match</p>
          )}
        </div>

        {/* Security Tips */}
        <div className="bg-background-800 rounded-lg p-4">
          <h4 className="text-sm font-medium text-white mb-2">Password Security Tips</h4>
          <ul className="text-xs text-gray-400 space-y-1">
            <li>• Use a unique password that you don't use elsewhere</li>
            <li>• Include a mix of letters, numbers, and special characters</li>
            <li>• Avoid using personal information like names or birthdays</li>
            <li>• Consider using a password manager</li>
          </ul>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end pt-4">
          <button
            type="submit"
            disabled={loading || !formData.currentPassword || !formData.newPassword || 
                     !formData.confirmPassword || formData.newPassword !== formData.confirmPassword ||
                     passwordStrength.length > 0}
            className="px-6 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-background-800 disabled:text-gray-500 text-white rounded-lg transition-colors flex items-center gap-2"
          >
            {loading && <Loader size={16} className="animate-spin" />}
            <Lock size={16} />
            <span>{loading ? 'Updating Password...' : 'Update Password'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};

export default ChangePasswordForm;