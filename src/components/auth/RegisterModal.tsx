// src/components/auth/RegisterModal.tsx
import { useState } from 'react';
import { X, Mail, Lock, User, Loader, CheckCircle } from 'lucide-react';
import { authService } from '../../services/authService';

interface RegisterModalProps {
  onClose: () => void;
  onSuccess?: () => void;
}

const RegisterModal = ({ onClose, onSuccess }: RegisterModalProps) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'student' as 'admin' | 'teacher' | 'student'
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);
  const [requiresApproval, setRequiresApproval] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Validation
    if (!formData.name || !formData.email || !formData.password || !formData.confirmPassword) {
      setError('Please fill in all fields');
      setLoading(false);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long');
      setLoading(false);
      return;
    }

    try {
      const userProfile = await authService.createUser(
        formData.email,
        formData.password,
        formData.name,
        formData.role,
        true // Require approval for new accounts
      );
      
      setRegistrationSuccess(true);
      setRequiresApproval(userProfile.status === 'pending');
      
      // Don't close modal immediately, show success message first
      setTimeout(() => {
        if (onSuccess) {
          onSuccess();
        }
        onClose();
      }, 3000);
      
    } catch (err: any) {
      setError(err.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (registrationSuccess) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 animate-fade-in">
        <div className="bg-background-900 rounded-xl w-full max-w-md p-6 relative animate-slide-up">
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <CheckCircle size={64} className="text-success-DEFAULT" />
            </div>
            
            <h2 className="text-2xl font-bold text-white mb-4">Registration Successful!</h2>
            
            {requiresApproval ? (
              <div className="space-y-4">
                <div className="bg-warning-dark text-warning-light px-4 py-3 rounded-lg">
                  <p className="font-medium mb-2">Account Pending Approval</p>
                  <p className="text-sm">
                    Your account has been created successfully but requires admin approval before you can sign in. 
                    You will receive an email notification once your account is approved.
                  </p>
                </div>
                
                <div className="text-gray-400 text-sm">
                  <p>What happens next:</p>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>An admin will review your registration</li>
                    <li>You'll receive an email when approved</li>
                    <li>Then you can sign in with your credentials</li>
                  </ul>
                </div>
              </div>
            ) : (
              <div className="bg-success-dark text-success-light px-4 py-3 rounded-lg">
                <p>Your account has been created and is ready to use. You can now sign in with your credentials.</p>
              </div>
            )}
            
            <div className="mt-6">
              <button
                onClick={onClose}
                className="w-full bg-primary-600 hover:bg-primary-700 text-white py-2 rounded-lg transition-all duration-200 active:scale-98 active:translate-y-0.5"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-background-900 rounded-xl w-full max-w-md p-6 relative max-h-[90vh] overflow-y-auto animate-slide-up">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-400 hover:text-white"
          disabled={loading}
        >
          <X size={20} />
        </button>

        <h2 className="text-2xl font-bold text-white mb-6">Create Account</h2>

        {error && (
          <div className="bg-error-dark text-error-light px-4 py-2 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Full Name</label>
            <div className="relative">
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className="w-full bg-background-800 text-white rounded-lg py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all duration-200"
                placeholder="Enter your full name"
                disabled={loading}
              />
              <User size={16} className="absolute left-3 top-3 text-gray-400" />
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Email</label>
            <div className="relative">
              <input
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                className="w-full bg-background-800 text-white rounded-lg py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all duration-200"
                placeholder="Enter your email"
                disabled={loading}
              />
              <Mail size={16} className="absolute left-3 top-3 text-gray-400" />
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Password</label>
            <div className="relative">
              <input
                type="password"
                value={formData.password}
                onChange={(e) => handleInputChange('password', e.target.value)}
                className="w-full bg-background-800 text-white rounded-lg py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all duration-200"
                placeholder="Enter your password"
                disabled={loading}
              />
              <Lock size={16} className="absolute left-3 top-3 text-gray-400" />
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Confirm Password</label>
            <div className="relative">
              <input
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                className="w-full bg-background-800 text-white rounded-lg py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all duration-200"
                placeholder="Confirm your password"
                disabled={loading}
              />
              <Lock size={16} className="absolute left-3 top-3 text-gray-400" />
            </div>
          </div>

          <div className="bg-background-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="h-5 w-5 rounded-full bg-warning-DEFAULT flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs text-white">!</span>
              </div>
              <div>
                <p className="text-sm text-white font-medium">Account Approval Required</p>
                <p className="text-xs text-gray-400 mt-1">
                  New accounts require admin approval before you can sign in. You'll receive an email notification once approved.
                </p>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary-600 hover:bg-primary-700 disabled:bg-primary-800 disabled:cursor-not-allowed text-white py-2 rounded-lg transition-all duration-200 active:scale-98 active:translate-y-0.5 flex items-center justify-center gap-2"
          >
            {loading && <Loader size={16} className="animate-spin" />}
            <span>{loading ? 'Creating Account...' : 'Create Account'}</span>
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-400">
            Already have an account?{' '}
            <button 
              onClick={onClose}
              className="text-primary-400 hover:text-primary-300 transition-all duration-200 active:scale-98 active:translate-y-0.5"
            >
              Sign in instead
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default RegisterModal;
