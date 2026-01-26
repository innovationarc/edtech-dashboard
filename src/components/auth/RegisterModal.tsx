// src/components/auth/RegisterModal.tsx
import { useState } from 'react';
import { X, Mail, Lock, User, Loader, CheckCircle, Phone, Calendar, Users, Shield } from 'lucide-react';
import { authService } from '../../services/authService';
import { otpService } from '../../services/otpService';

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
    bloodGroup: '' as '' | 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-',
    gender: '' as '' | 'male' | 'female' | 'other',
    religion: '',
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
  
  // OTP verification states
  const [showOTPVerification, setShowOTPVerification] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [otpSuccess, setOtpSuccess] = useState('');
  const [canResendOTP, setCanResendOTP] = useState(false);
  const [resendTimer, setResendTimer] = useState(60);

  const startResendTimer = () => {
    setCanResendOTP(false);
    setResendTimer(60);
    
    const interval = setInterval(() => {
      setResendTimer(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          setCanResendOTP(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSendOTP = async () => {
    setOtpError('');
    setOtpSuccess('');
    setOtpLoading(true);

    // Validate phone number first
    if (!formData.phoneNumber) {
      setOtpError('Please enter your phone number');
      setOtpLoading(false);
      return;
    }

    if (!otpService.validatePhoneNumber(formData.phoneNumber)) {
      setOtpError('Invalid phone number format. Use: +880 1xxxxxxxxx or 01xxxxxxxxx');
      setOtpLoading(false);
      return;
    }

    try {
      const result = await otpService.sendOTP(formData.phoneNumber);
      
      if (result.success) {
        setOtpSuccess(result.message);
        setShowOTPVerification(true);
        startResendTimer();
      } else {
        setOtpError(result.message);
      }
    } catch (err: any) {
      setOtpError(err.message || 'Failed to send OTP');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    setOtpError('');
    setOtpLoading(true);

    if (!otp || otp.length !== 6) {
      setOtpError('Please enter a valid 6-digit OTP');
      setOtpLoading(false);
      return;
    }

    try {
      const result = await otpService.verifyOTP(formData.phoneNumber, otp);
      
      if (result.success) {
        setOtpVerified(true);
        setOtpSuccess(result.message);
        setShowOTPVerification(false);
      } else {
        setOtpError(result.message);
      }
    } catch (err: any) {
      setOtpError(err.message || 'Failed to verify OTP');
    } finally {
      setOtpLoading(false);
    }
  };

  const handlePhoneNumberChange = (value: string) => {
    // Auto-format phone number
    let formatted = value.replace(/\D/g, ''); // Remove non-digits
    
    // Handle different input formats
    if (formatted.startsWith('880')) {
      formatted = '+' + formatted;
    } else if (formatted.startsWith('88')) {
      formatted = '+' + formatted;
    } else if (formatted.startsWith('0') && formatted.length > 1) {
      formatted = '+88' + formatted;
    } else if (formatted.startsWith('1') && formatted.length === 10) {
      formatted = '+880' + formatted;
    } else if (!formatted.startsWith('+') && formatted.length > 0) {
      formatted = '+880' + formatted;
    }
    
    setFormData(prev => ({ ...prev, phoneNumber: formatted }));
    
    // Reset OTP verification if phone number changes
    if (otpVerified) {
      setOtpVerified(false);
      setOtp('');
      setShowOTPVerification(false);
    }
  };

  const handleSubmit = async () => {
    setError('');
    setLoading(true);

    // Validation
    if (!formData.surname || !formData.fullName || !formData.dob || !formData.phoneNumber || !formData.password || !formData.confirmPassword || !formData.grade || !formData.bloodGroup || !formData.gender) {
      setError('Please fill in all required fields');
      setLoading(false);
      return;
    }

    // Check OTP verification
    if (!otpVerified) {
      setError('Please verify your phone number with OTP first');
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
      // Format phone number before creating user
      const formattedPhone = otpService.formatPhoneNumber(formData.phoneNumber);
      
      const userProfile = await authService.createUser(
        formattedPhone,
        formData.email.trim() || '',
        formData.password,
        formData.surname,
        formData.fullName,
        formData.dob,
        formattedPhone,
        formData.guardianPhone.trim() || '',
        formData.bloodGroup,
        formData.gender,
        formData.religion.trim() || '',
        formData.grade,
        formData.role,
        false // Auto-approve students
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
      if (showOTPVerification) {
        handleVerifyOTP();
      } else {
        handleSubmit();
      }
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
                <p className="text-sm font-semibold mb-2">✓ Account Ready!</p>
                <p className="text-sm">Your account is active and ready to use. Sign in with your Student ID and password to start learning!</p>
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

            <div className="space-y-3">
              <div className="group">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Phone Number * 
                  {otpVerified && <span className="text-green-400 ml-2 text-xs">✓ Verified</span>}
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    value={formData.phoneNumber}
                    onChange={(e) => handlePhoneNumberChange(e.target.value)}
                    onKeyPress={handleKeyPress}
                    className={`w-full bg-gray-800/50 backdrop-blur-sm text-white rounded-xl py-3 pl-11 pr-32 border ${
                      otpVerified ? 'border-green-500/50' : 'border-gray-700/50'
                    } focus:border-primary-500/50 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all duration-200 group-hover:border-gray-600`}
                    placeholder="+880 1XXXXXXXXX"
                    disabled={loading || otpVerified}
                  />
                  <Phone size={18} className="absolute left-3.5 top-3.5 text-gray-400 group-hover:text-primary-400 transition-colors" />
                  {!otpVerified && (
                    <button
                      type="button"
                      onClick={handleSendOTP}
                      disabled={otpLoading || !formData.phoneNumber}
                      className="absolute right-2 top-2 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white px-4 py-1.5 rounded-lg text-sm transition-all duration-200"
                    >
                      {otpLoading ? <Loader size={16} className="animate-spin" /> : 'Send OTP'}
                    </button>
                  )}
                  {otpVerified && (
                    <div className="absolute right-2 top-2 bg-green-600 text-white px-4 py-1.5 rounded-lg text-sm flex items-center gap-1">
                      <Shield size={16} />
                      <span>Verified</span>
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1.5">Format: +880 1XXXXXXXXX or 01XXXXXXXXX</p>
              </div>

              {showOTPVerification && !otpVerified && (
                <div className="bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-blue-700/30 rounded-xl p-4 backdrop-blur-sm space-y-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield size={18} className="text-blue-400" />
                    <p className="text-sm font-medium text-blue-200">Enter OTP sent to your phone</p>
                  </div>
                  
                  {otpError && (
                    <div className="bg-red-900/30 border border-red-700/50 text-red-200 px-3 py-2 rounded-lg text-xs">
                      {otpError}
                    </div>
                  )}
                  
                  {otpSuccess && (
                    <div className="bg-green-900/30 border border-green-700/50 text-green-200 px-3 py-2 rounded-lg text-xs">
                      {otpSuccess}
                    </div>
                  )}
       <div className="flex gap-2">
                    <input
                      type="text"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleVerifyOTP();
                        }
                      }}
                      className="flex-1 bg-gray-800/50 text-white rounded-lg py-2 px-4 border border-gray-700/50 focus:border-primary-500/50 focus:outline-none focus:ring-2 focus:ring-primary-500/20 text-center text-lg font-mono tracking-widest"
                      placeholder="000000"
                      maxLength={6}
                      disabled={otpLoading}
                    />
                    <button
                      type="button"
                      onClick={handleVerifyOTP}
                      disabled={otpLoading || otp.length !== 6}
                      className="bg-primary-600 hover:bg-primary-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg transition-all duration-200 flex items-center gap-2"
                    >
                      {otpLoading ? <Loader size={18} className="animate-spin" /> : 'Verify'}
                    </button>
                  </div>
                  
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-400">
                      {canResendOTP ? (
                        <button
                          type="button"
                          onClick={handleSendOTP}
                          className="text-primary-400 hover:text-primary-300"
                        >
                          Resend OTP
                        </button>
                      ) : (
                        <span>Resend OTP in {resendTimer}s</span>
                      )}
                    </span>
                    <span className="text-gray-500">OTP expires in 10 minutes</span>
                  </div>
                </div>
              )}
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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="group">
                <label className="block text-sm font-medium text-gray-300 mb-2">Blood Group *</label>
                <div className="relative">
                  <select
                    value={formData.bloodGroup}
                    onChange={(e) => handleInputChange('bloodGroup', e.target.value)}
                    className="w-full bg-gray-800/50 backdrop-blur-sm text-white rounded-xl py-3 pl-4 pr-4 border border-gray-700/50 focus:border-primary-500/50 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all duration-200 group-hover:border-gray-600 appearance-none cursor-pointer"
                    disabled={loading}
                  >
                    <option value="">Select blood group</option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                  </select>
                </div>
              </div>

              <div className="group">
                <label className="block text-sm font-medium text-gray-300 mb-2">Gender *</label>
                <div className="relative">
                  <select
                    value={formData.gender}
                    onChange={(e) => handleInputChange('gender', e.target.value)}
                    className="w-full bg-gray-800/50 backdrop-blur-sm text-white rounded-xl py-3 pl-4 pr-4 border border-gray-700/50 focus:border-primary-500/50 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all duration-200 group-hover:border-gray-600 appearance-none cursor-pointer"
                    disabled={loading}
                  >
                    <option value="">Select gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div className="group">
                <label className="block text-sm font-medium text-gray-300 mb-2">Religion <span className="text-gray-500">(Optional)</span></label>
                <div className="relative">
                  <input
                    type="text"
                    value={formData.religion}
                    onChange={(e) => handleInputChange('religion', e.target.value)}
                    onKeyPress={handleKeyPress}
                    className="w-full bg-gray-800/50 backdrop-blur-sm text-white rounded-xl py-3 pl-4 pr-4 border border-gray-700/50 focus:border-primary-500/50 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all duration-200 group-hover:border-gray-600"
                    placeholder="Your religion"
                    disabled={loading}
                  />
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

            <div className="bg-gradient-to-r from-green-900/20 to-emerald-900/20 border border-green-700/30 rounded-xl p-4 backdrop-blur-sm">
              <div className="flex items-start gap-3">
                <div className="h-6 w-6 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-lg">
                  <span className="text-xs text-white font-bold">✓</span>
                </div>
                <div>
                  <p className="text-sm text-green-100 font-semibold">Instant Account Activation</p>
                  <p className="text-xs text-green-200/80 mt-1">
                    Student accounts are automatically approved. You can sign in immediately after registration!
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={loading || !otpVerified}
              className="w-full bg-gradient-to-r from-primary-600 to-purple-600 hover:from-primary-700 hover:to-purple-700 disabled:from-gray-700 disabled:to-gray-800 disabled:cursor-not-allowed text-white py-3.5 rounded-xl transition-all duration-300 active:scale-95 flex items-center justify-center gap-2 font-medium shadow-lg hover:shadow-primary-500/50"
            >
              {loading && <Loader size={20} className="animate-spin" />}
              <span>{loading ? 'Creating Account...' : otpVerified ? 'Create Account' : 'Verify Phone First'}</span>
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
