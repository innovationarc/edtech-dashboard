// src/components/auth/RegisterModal.tsx
import { useState } from 'react';
import { X, Mail, Lock, User, Loader, CheckCircle, Phone, Calendar, Users } from 'lucide-react';
import { authService } from '../../services/authService';

interface RegisterModalProps {
  onClose: () => void;
  onSuccess?: () => void;
}

const RegisterModal = ({ onClose, onSuccess }: RegisterModalProps) => {
  const [formData, setFormData] = useState({
    surname: '',
    fullName: '',
    dob: '',
    phoneNumber: '',
    guardianPhone: '',
    email: '',
    password: '',
    confirmPassword: '',
    grade: '' as '' | 'six' | 'seven' | 'eight' | 'nine' | 'ten' | 'eleven' | 'twelve' | 'admission' | 'graduated',
    role: 'student' as 'admin' | 'teacher' | 'student'
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [generatedUserId, setGeneratedUserId] = useState('');

  const handleSubmit = async () => {
    setError('');
    setLoading(true);

    // Validation
    if (!formData.surname || !formData.fullName || !formData.dob || !formData.phoneNumber || !formData.password || !formData.confirmPassword || !formData.grade) {
      setError('Please fill in all required fields');
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

    // Validate phone number
    const phoneRegex = /^\d{10,15}$/;
    if (!phoneRegex.test(formData.phoneNumber.replace(/\D/g, ''))) {
      setError('Please enter a valid phone number (10-15 digits)');
      setLoading(false);
      return;
    }

    try {
      const userProfile = await authService.createUser(
        formData.phoneNumber,
        formData.email || '',
        formData.password,
        formData.surname,
        formData.fullName,
        formData.dob,
        formData.phoneNumber,
        formData.guardianPhone,
        formData.grade,
        formData.role,
        true // Require approval for new accounts
      );
      
      setRegistrationSuccess(true);
      setRequiresApproval(userProfile.status === 'pending');
      setGeneratedUserId(userProfile.userId || '');
      
      setTimeout(() => {
        if (onSuccess) {
          onSuccess();
        }
        onClose();
      }, 5000);
      
    } catch (err: any) {
      setError(err.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading) {
      e.preventDefault();
      handleSubmit();
    }
  };

  if (registrationSuccess) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
        <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl w-full max-w-md p-8 relative shadow-2xl border border-gray-700/50 animate-slide-up">
          <div className="absolute inset-0 bg-gradient-to-br from-primary-500/10 to-purple-500/10 rounded-2xl"></div>
          
          <div className="relative text-center">
            <div className="flex justify-center mb-6">
              <div className="relative">
                <div className="absolute inset-0 bg-success-DEFAULT/20 blur-xl animate-pulse"></div>
                <CheckCircle size={72} className="text-success-DEFAULT relative animate-bounce-slow" />
              </div>
            </div>
            
            <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500 mb-6">
              Registration Successful!
            </h2>
            
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 mb-6 border border-gray-700/50 shadow-inner">
              <p className="text-gray-300 text-sm mb-3">Your Student ID</p>
              <div className="bg-gradient-to-r from-primary-600 to-purple-600 rounded-lg p-4 shadow-lg">
                <p className="text-3xl font-mono font-bold text-white tracking-wider">{generatedUserId}</p>
              </div>
              <p className="text-xs text-gray-400 mt-3">Save this ID for login</p>
            </div>
            
            {requiresApproval ? (
              <div className="space-y-4">
                <div className="bg-gradient-to-r from-yellow-900/40 to-orange-900/40 text-yellow-200 px-6 py-4 rounded-xl border border-yellow-700/50 backdrop-blur-sm">
                  <p className="font-semibold mb-2 text-yellow-100">⏳ Account Pending Approval</p>
                  <p className="text-sm text-yellow-200/90">
                    Your account requires admin approval before you can sign in. 
                    You will receive a notification once approved.
                  </p>
                </div>
                
                <div className="bg-gray-800/30 rounded-lg p-4 text-left border border-gray-700/30">
                  <p className="text-gray-300 text-sm font-medium mb-2">📋 Next Steps:</p>
                  <ul className="space-y-2 text-sm text-gray-400">
                    <li className="flex items-start gap-2">
                      <span className="text-primary-400 mt-0.5">•</span>
                      <span>Admin will review your registration</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary-400 mt-0.5">•</span>
                      <span>You'll receive notification when approved</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary-400 mt-0.5">•</span>
                      <span>Sign in using your Student ID and password</span>
                    </li>
                  </ul>
                </div>
              </div>
            ) : (
              <div className="bg-gradient-to-r from-green-900/40 to-emerald-900/40 text-green-200 px-6 py-4 rounded-xl border border-green-700/50">
                <p className="text-sm">Your account is ready! Sign in with your Student ID and password.</p>
              </div>
            )}
            
            <button
              onClick={onClose}
              className="mt-6 w-full bg-gradient-to-r from-primary-600 to-purple-600 hover:from-primary-700 hover:to-purple-700 text-white py-3 rounded-xl transition-all duration-300 active:scale-95 font-medium shadow-lg hover:shadow-primary-500/50"
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in p-4">
      <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl w-full max-w-2xl p-8 relative max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-700/50 animate-slide-up">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-500/5 to-purple-500/5 rounded-2xl pointer-events-none"></div>
        
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-400 hover:text-white transition-all duration-200 hover:rotate-90 z-10"
          disabled={loading}
        >
          <X size={24} />
        </button>

        <div className="relative">
          <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-purple-500 mb-2">
            Create Account
          </h2>
          <p className="text-gray-400 text-sm mb-6">Join our learning community</p>

          {error && (
            <div className="bg-red-900/30 border border-red-700/50 text-red-200 px-4 py-3 rounded-xl mb-6 backdrop-blur-sm animate-shake">
              <p className="text-sm">{error}</p>
            </div>
          )}

          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="group">
                <label className="block text-sm font-medium text-gray-300 mb-2">Surname *</label>
                <div className="relative">
                  <input
                    type="text"
                    value={formData.surname}
                    onChange={(e) => handleInputChange('surname', e.target.value)}
                    onKeyPress={handleKeyPress}
                    className="w-full bg-gray-800/50 backdrop-blur-sm text-white rounded-xl py-3 pl-11 pr-4 border border-gray-700/50 focus:border-primary-500/50 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all duration-200 group-hover:border-gray-600"
                    placeholder="Enter surname"
                    disabled={loading}
                  />
                  <User size={18} className="absolute left-3.5 top-3.5 text-gray-400 group-hover:text-primary-400 transition-colors" />
                </div>
              </div>

              <div className="group">
                <label className="block text-sm font-medium text-gray-300 mb-2">Full Name *</label>
                <div className="relative">
                  <input
                    type="text"
                    value={formData.fullName}
                    onChange={(e) => handleInputChange('fullName', e.target.value)}
                    onKeyPress={handleKeyPress}
                    className="w-full bg-gray-800/50 backdrop-blur-sm text-white rounded-xl py-3 pl-11 pr-4 border border-gray-700/50 focus:border-primary-500/50 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all duration-200 group-hover:border-gray-600"
                    placeholder="Enter full name"
                    disabled={loading}
                  />
                  <User size={18} className="absolute left-3.5 top-3.5 text-gray-400 group-hover:text-primary-400 transition-colors" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="group">
                <label className="block text-sm font-medium text-gray-300 mb-2">Date of Birth *</label>
                <div className="relative">
                  <input
                    type="date"
                    value={formData.dob}
                    onChange={(e) => handleInputChange('dob', e.target.value)}
                    className="w-full bg-gray-800/50 backdrop-blur-sm text-white rounded-xl py-3 pl-11 pr-4 border border-gray-700/50 focus:border-primary-500/50 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all duration-200 group-hover:border-gray-600"
                    disabled={loading}
                  />
                  <Calendar size={18} className="absolute left-3.5 top-3.5 text-gray-400 group-hover:text-primary-400 transition-colors" />
                </div>
              </div>

              <div className="group">
                <label className="block text-sm font-medium text-gray-300 mb-2">Grade *</label>
                <div className="relative">
                  <select
                    value={formData.grade}
                    onChange={(e) => handleInputChange('grade', e.target.value)}
                    className="w-full bg-gray-800/50 backdrop-blur-sm text-white rounded-xl py-3 pl-4 pr-4 border border-gray-700/50 focus:border-primary-500/50 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all duration-200 group-hover:border-gray-600 appearance-none cursor-pointer"
                    disabled={loading}
                  >
                    <option value="">Select grade</option>
                    <option value="six">Grade 6</option>
                    <option value="seven">Grade 7</option>
                    <option value="eight">Grade 8</option>
                    <option value="nine">Grade 9</option>
                    <option value="ten">Grade 10</option>
                    <option value="eleven">Grade 11</option>
                    <option value="twelve">Grade 12</option>
                    <option value="admission">Admission</option>
                    <option value="graduated">Graduated</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="group">
                <label className="block text-sm font-medium text-gray-300 mb-2">Phone Number *</label>
                <div className="relative">
                  <input
                    type="tel"
                    value={formData.phoneNumber}
                    onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
                    onKeyPress={handleKeyPress}
                    className="w-full bg-gray-800/50 backdrop-blur-sm text-white rounded-xl py-3 pl-11 pr-4 border border-gray-700/50 focus:border-primary-500/50 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all duration-200 group-hover:border-gray-600"
                    placeholder="10-15 digits"
                    disabled={loading}
                  />
                  <Phone size={18} className="absolute left-3.5 top-3.5 text-gray-400 group-hover:text-primary-400 transition-colors" />
                </div>
              </div>

              <div className="group">
                <label className="block text-sm font-medium text-gray-300 mb-2">Guardian Phone <span className="text-gray-500">(Optional)</span></label>
                <div className="relative">
                  <input
                    type="tel"
                    value={formData.guardianPhone}
                    onChange={(e) => handleInputChange('guardianPhone', e.target.value)}
                    onKeyPress={handleKeyPress}
                    className="w-full bg-gray-800/50 backdrop-blur-sm text-white rounded-xl py-3 pl-11 pr-4 border border-gray-700/50 focus:border-primary-500/50 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all duration-200 group-hover:border-gray-600"
                    placeholder="Guardian/Additional"
                    disabled={loading}
                  />
                  <Users size={18} className="absolute left-3.5 top-3.5 text-gray-400 group-hover:text-primary-400 transition-colors" />
                </div>
              </div>
            </div>

            <div className="group">
              <label className="block text-sm font-medium text-gray-300 mb-2">Email <span className="text-gray-500">(Optional)</span></label>
              <div className="relative">
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="w-full bg-gray-800/50 backdrop-blur-sm text-white rounded-xl py-3 pl-11 pr-4 border border-gray-700/50 focus:border-primary-500/50 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all duration-200 group-hover:border-gray-600"
                  placeholder="Enter your email"
                  disabled={loading}
                />
                <Mail size={18} className="absolute left-3.5 top-3.5 text-gray-400 group-hover:text-primary-400 transition-colors" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="group">
                <label className="block text-sm font-medium text-gray-300 mb-2">Password *</label>
                <div className="relative">
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => handleInputChange('password', e.target.value)}
                    onKeyPress={handleKeyPress}
                    className="w-full bg-gray-800/50 backdrop-blur-sm text-white rounded-xl py-3 pl-11 pr-4 border border-gray-700/50 focus:border-primary-500/50 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all duration-200 group-hover:border-gray-600"
                    placeholder="Min. 6 characters"
                    disabled={loading}
                  />
                  <Lock size={18} className="absolute left-3.5 top-3.5 text-gray-400 group-hover:text-primary-400 transition-colors" />
                </div>
              </div>

              <div className="group">
                <label className="block text-sm font-medium text-gray-300 mb-2">Confirm Password *</label>
                <div className="relative">
                  <input
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                    onKeyPress={handleKeyPress}
                    className="w-full bg-gray-800/50 backdrop-blur-sm text-white rounded-xl py-3 pl-11 pr-4 border border-gray-700/50 focus:border-primary-500/50 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all duration-200 group-hover:border-gray-600"
                    placeholder="Re-enter password"
                    disabled={loading}
                  />
                  <Lock size={18} className="absolute left-3.5 top-3.5 text-gray-400 group-hover:text-primary-400 transition-colors" />
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-yellow-900/20 to-orange-900/20 border border-yellow-700/30 rounded-xl p-4 backdrop-blur-sm">
              <div className="flex items-start gap-3">
                <div className="h-6 w-6 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-lg">
                  <span className="text-xs text-white font-bold">!</span>
                </div>
                <div>
                  <p className="text-sm text-yellow-100 font-semibold">Account Approval Required</p>
                  <p className="text-xs text-yellow-200/80 mt-1">
                    New accounts require admin approval. You'll receive notification once approved.
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full bg-gradient-to-r from-primary-600 to-purple-600 hover:from-primary-700 hover:to-purple-700 disabled:from-gray-700 disabled:to-gray-800 disabled:cursor-not-allowed text-white py-3.5 rounded-xl transition-all duration-300 active:scale-95 flex items-center justify-center gap-2 font-medium shadow-lg hover:shadow-primary-500/50"
            >
              {loading && <Loader size={20} className="animate-spin" />}
              <span>{loading ? 'Creating Account...' : 'Create Account'}</span>
            </button>
          </div>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-400">
              Already have an account?{' '}
              <button 
                onClick={onClose}
                className="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-purple-500 hover:from-primary-300 hover:to-purple-400 transition-all duration-200 font-medium"
              >
                Sign in instead
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterModal;
