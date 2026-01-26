// src/components/auth/RegisterModal.tsx - PART 1
// Paste this part first, then immediately paste Part 2
import { useState, useEffect, useRef } from 'react';
import { X, Mail, Lock, User, Loader, CheckCircle, Phone, Calendar, Users, Shield, AlertCircle, Eye, EyeOff, Droplet } from 'lucide-react';
import { authService, validatePasswordStrength } from '../../services/authService';
import { otpService } from '../../services/otpService';
import ReCAPTCHA from 'react-google-recaptcha';

interface RegisterModalProps {
  onClose: () => void;
  onSuccess?: () => void;
}

const RegisterModal = ({ onClose, onSuccess }: RegisterModalProps) => {
  // Form data state
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
    classGrade: '' as '' | 'class6' | 'class7' | 'class8' | 'class9' | 'class10' | 'ssc' | 'class11' | 'class12' | 'hsc' | 'diploma' | 'undergraduate' | 'graduated',
    role: 'student' as 'admin' | 'teacher' | 'student'
  });

  // UI States
  const [currentStep, setCurrentStep] = useState<'form' | 'otp' | 'success'>('form');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [generatedUserId, setGeneratedUserId] = useState('');
  
  // Password visibility states
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState<{
    strength: 'weak' | 'medium' | 'strong' | 'very-strong';
    issues: string[];
  }>({ strength: 'weak', issues: [] });
  
  // OTP States
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [otpError, setOtpError] = useState('');
  const [otpSuccess, setOtpSuccess] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [canResendOTP, setCanResendOTP] = useState(false);
  const [resendTimer, setResendTimer] = useState(60);

  // reCAPTCHA state
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const recaptchaRef = useRef<ReCAPTCHA>(null);

  // Password strength checker
  useEffect(() => {
    if (formData.password) {
      const validation = validatePasswordStrength(formData.password);
      setPasswordStrength({
        strength: validation.strength,
        issues: validation.issues
      });
    } else {
      setPasswordStrength({ strength: 'weak', issues: [] });
    }
  }, [formData.password]);

  // Start resend timer
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

  // Handle phone number formatting
  const handlePhoneNumberChange = (value: string, field: 'phoneNumber' | 'guardianPhone') => {
    // Remove all non-digit characters
    let cleaned = value.replace(/\D/g, '');
    
    // Remove leading zeros and country codes
    if (cleaned.startsWith('880')) {
      cleaned = cleaned.substring(3);
    } else if (cleaned.startsWith('88')) {
      cleaned = cleaned.substring(2);
    } else if (cleaned.startsWith('0')) {
      cleaned = cleaned.substring(1);
    }
    
    // Limit to 10 digits
    cleaned = cleaned.substring(0, 10);
    
    setFormData(prev => ({ ...prev, [field]: cleaned }));
  };

  // Get formatted phone display
  const getPhoneDisplay = (digits: string) => {
    if (!digits) return '';
    return digits;
  };

  // Handle CAPTCHA change
  const handleCaptchaChange = (token: string | null) => {
    setCaptchaToken(token);
  };

  // Handle form submission (move to OTP step)
  const handleFormSubmit = async () => {
    setError('');
    setLoading(true);

    // Validation
    if (!formData.surname || !formData.fullName || !formData.dob || !formData.phoneNumber || 
        !formData.password || !formData.confirmPassword || !formData.classGrade || 
        !formData.gender) {
      setError('Please fill in all required fields');
      setLoading(false);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    const validation = validatePasswordStrength(formData.password);
    if (!validation.isStrong) {
      setError('Password must meet all security requirements');
      setLoading(false);
      return;
    }

    // Validate phone number
    const fullPhoneNumber = `+8801${formData.phoneNumber}`;
    if (!otpService.validatePhoneNumber(fullPhoneNumber)) {
      setError('Invalid phone number. Must be 10 digits starting with 1, 3, 4, 5, 6, 7, 8, or 9');
      setLoading(false);
      return;
    }

    // CAPTCHA validation
    if (!captchaToken) {
      setError('Please complete the CAPTCHA verification');
      setLoading(false);
      return;
    }

    try {
      // Send OTP
      const result = await otpService.sendOTP(fullPhoneNumber, 'registration', formData.surname);
      
      if (result.success) {
        setOtpSuccess(result.message);
        setCurrentStep('otp');
        startResendTimer();
      } else {
        setError(result.message);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  // Handle OTP input
  const handleOTPChange = (index: number, value: string) => {
    if (value.length > 1) value = value[0];
    if (!/^\d*$/.test(value)) return;

    const newOTP = [...otp];
    newOTP[index] = value;
    setOtp(newOTP);

    if (value && index < 5) {
      const nextInput = document.getElementById(`otp-${index + 1}`);
      nextInput?.focus();
    }
  };

  // Handle OTP backspace
  const handleOTPKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      const prevInput = document.getElementById(`otp-${index - 1}`);
      prevInput?.focus();
    }
  };

  // Handle OTP paste
  const handleOTPPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const newOTP = [...otp];
    
    for (let i = 0; i < pastedData.length; i++) {
      newOTP[i] = pastedData[i];
    }
    
    setOtp(newOTP);
  };

  // Verify OTP and create account
  const handleVerifyOTP = async () => {
    setOtpError('');
    setOtpLoading(true);

    const otpCode = otp.join('');
    
    if (otpCode.length !== 6) {
      setOtpError('Please enter a valid 6-digit OTP');
      setOtpLoading(false);
      return;
    }

    try {
      const fullPhoneNumber = `+8801${formData.phoneNumber}`;
      
      // Verify OTP
      const result = await otpService.verifyOTP(fullPhoneNumber, otpCode, 'registration');
      
      if (!result.success) {
        setOtpError(result.message);
        setOtpLoading(false);
        return;
      }

      // OTP verified, create user account
      const userProfile = await authService.createUser(
        fullPhoneNumber,
        formData.email.trim() || '',
        formData.password,
        formData.surname,
        formData.fullName,
        formData.dob,
        fullPhoneNumber,
        formData.guardianPhone ? `+8801${formData.guardianPhone}` : '',
        formData.bloodGroup,
        formData.gender,
        formData.religion.trim() || '',
        formData.classGrade,
        formData.role,
        false
      );
      
      setGeneratedUserId(userProfile.userId || '');
      setRequiresApproval(userProfile.status === 'pending');
      
      // Send registration success SMS
      await otpService.sendRegistrationSuccessSMS(
        fullPhoneNumber,
        formData.surname,
        userProfile.userId || ''
      );
      
      setCurrentStep('success');
      
    } catch (err: any) {
      setOtpError(err.message || 'Failed to create account');
    } finally {
      setOtpLoading(false);
    }
  };

  // Resend OTP
  const handleResendOTP = async () => {
    setOtpError('');
    setOtpSuccess('');
    setOtp(['', '', '', '', '', '']);
    
    try {
      const fullPhoneNumber = `+8801${formData.phoneNumber}`;
      const result = await otpService.sendOTP(fullPhoneNumber, 'registration', formData.surname);
      
      if (result.success) {
        setOtpSuccess(result.message);
        startResendTimer();
      } else {
        setOtpError(result.message);
      }
    } catch (err: any) {
      setOtpError(err.message || 'Failed to resend OTP');
    }
  };

  // Password strength indicator
  const getStrengthColor = () => {
    switch (passwordStrength.strength) {
      case 'very-strong': return 'bg-green-500';
      case 'strong': return 'bg-blue-500';
      case 'medium': return 'bg-yellow-500';
      default: return 'bg-red-500';
    }
  };

  const getStrengthWidth = () => {
    switch (passwordStrength.strength) {
      case 'very-strong': return 'w-full';
      case 'strong': return 'w-3/4';
      case 'medium': return 'w-1/2';
      default: return 'w-1/4';
    }
  };

  // Continue to Part 2...
// src/components/auth/RegisterModal.tsx - PART 2
// Paste this immediately after Part 1

  // Success Screen
  if (currentStep === 'success') {
    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 animate-fade-in p-4">
        <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-3xl w-full max-w-md p-8 relative shadow-2xl border border-gray-700/50 animate-scale-in">
          <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 via-emerald-500/5 to-green-500/10 rounded-3xl animate-pulse-slow"></div>
          
          <div className="relative text-center">
            <div className="flex justify-center mb-6">
              <div className="relative animate-bounce-slow">
                <div className="absolute inset-0 bg-green-500/30 blur-2xl animate-pulse"></div>
                <div className="relative bg-gradient-to-br from-green-400 to-emerald-500 rounded-full p-4 shadow-2xl shadow-green-500/50">
                  <CheckCircle size={64} className="text-white" />
                </div>
              </div>
            </div>
            
            <h2 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 via-emerald-400 to-green-500 mb-6 animate-text-shine">
              Registration Successful!
            </h2>
            
            <div className="bg-gray-800/60 backdrop-blur-xl rounded-2xl p-6 mb-6 border border-gray-700/50 shadow-inner">
              <p className="text-gray-300 text-sm mb-3 font-medium">Your Student ID</p>
              <div className="bg-gradient-to-r from-primary-600 via-purple-600 to-primary-600 rounded-xl p-5 shadow-2xl animate-gradient">
                <p className="text-3xl font-mono font-bold text-white tracking-wider drop-shadow-lg">{generatedUserId}</p>
              </div>
              <p className="text-xs text-gray-400 mt-3 flex items-center justify-center gap-2">
                <Shield size={14} />
                Save this ID for login
              </p>
            </div>
            
            <div className="bg-gradient-to-r from-green-900/40 to-emerald-900/40 text-green-200 px-6 py-4 rounded-xl border border-green-700/50 backdrop-blur-sm mb-6">
              <p className="text-sm font-semibold mb-2 flex items-center justify-center gap-2">
                <CheckCircle size={18} />
                Account Ready!
              </p>
              <p className="text-sm">Sign in with your Student ID and password to start learning!</p>
            </div>
            
            <button
              onClick={() => {
                if (onSuccess) onSuccess();
                onClose();
              }}
              className="w-full bg-gradient-to-r from-primary-600 via-purple-600 to-primary-600 hover:from-primary-700 hover:via-purple-700 hover:to-primary-700 text-white py-4 rounded-xl transition-all duration-300 active:scale-95 font-semibold shadow-2xl hover:shadow-primary-500/50 animate-gradient"
            >
              Login Now
            </button>
          </div>
        </div>
      </div>
    );
  }

  // OTP Verification Screen
  if (currentStep === 'otp') {
    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 animate-fade-in p-4">
        <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-3xl w-full max-w-md p-8 relative shadow-2xl border border-gray-700/50 animate-slide-up">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-purple-500/5 to-blue-500/10 rounded-3xl"></div>
          
          <button
            onClick={() => setCurrentStep('form')}
            className="absolute left-4 top-4 text-gray-400 hover:text-white transition-all duration-200 hover:scale-110 z-10"
          >
            <X size={24} />
          </button>

          <div className="relative text-center">
            <div className="flex justify-center mb-6">
              <div className="relative">
                <div className="absolute inset-0 bg-blue-500/30 blur-2xl animate-pulse"></div>
                <div className="relative bg-gradient-to-br from-blue-500 to-purple-600 rounded-full p-4 shadow-2xl shadow-blue-500/50">
                  <Shield size={48} className="text-white" />
                </div>
              </div>
            </div>

            <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-blue-500 mb-2 animate-text-shine">
              Verify Your Phone
            </h2>
            <p className="text-gray-400 text-sm mb-6">
              Enter the 6-digit code sent to<br />
              <span className="text-white font-semibold">+8801{formData.phoneNumber}</span>
            </p>

            {otpError && (
              <div className="bg-red-900/40 border border-red-700/50 text-red-200 px-4 py-3 rounded-xl mb-6 backdrop-blur-sm animate-shake">
                <p className="text-sm flex items-center justify-center gap-2">
                  <AlertCircle size={16} />
                  {otpError}
                </p>
              </div>
            )}

            {otpSuccess && (
              <div className="bg-green-900/40 border border-green-700/50 text-green-200 px-4 py-3 rounded-xl mb-6 backdrop-blur-sm animate-slide-down">
                <p className="text-sm flex items-center justify-center gap-2">
                  <CheckCircle size={16} />
                  {otpSuccess}
                </p>
              </div>
            )}

            <div className="flex gap-3 justify-center mb-6" onPaste={handleOTPPaste}>
              {otp.map((digit, index) => (
                <input
                  key={index}
                  id={`otp-${index}`}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOTPChange(index, e.target.value)}
                  onKeyDown={(e) => handleOTPKeyDown(index, e)}
                  className="w-12 h-12 sm:w-14 sm:h-14 bg-gray-800/60 backdrop-blur-xl text-white text-2xl font-bold text-center rounded-xl border-2 border-gray-700/50 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30 transition-all duration-200"
                  disabled={otpLoading}
                />
              ))}
            </div>

            <button
              onClick={handleVerifyOTP}
              disabled={otpLoading || otp.join('').length !== 6}
              className="w-full bg-gradient-to-r from-primary-600 via-purple-600 to-primary-600 hover:from-primary-700 hover:via-purple-700 hover:to-primary-700 disabled:from-gray-700 disabled:to-gray-800 disabled:cursor-not-allowed text-white py-4 rounded-xl transition-all duration-300 active:scale-95 flex items-center justify-center gap-2 font-semibold shadow-2xl hover:shadow-primary-500/50 mb-4 animate-gradient"
            >
              {otpLoading && <Loader size={20} className="animate-spin" />}
              <span>{otpLoading ? 'Verifying...' : 'Verify & Create Account'}</span>
            </button>

            <div className="text-sm text-gray-400">
              {canResendOTP ? (
                <button
                  onClick={handleResendOTP}
                  className="text-primary-400 hover:text-primary-300 font-medium transition-colors duration-200"
                >
                  Resend OTP
                </button>
              ) : (
                <span>Resend OTP in <span className="text-white font-semibold">{resendTimer}s</span></span>
              )}
            </div>

            <div className="mt-6 bg-gray-800/40 backdrop-blur-xl rounded-xl p-4 border border-gray-700/30">
              <p className="text-xs text-gray-400 flex items-center justify-center gap-2">
                <Shield size={14} />
                OTP expires in 2 minutes
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Registration Form
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 animate-fade-in p-4 overflow-y-auto">
      <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-3xl w-full max-w-2xl p-4 sm:p-8 my-4 relative shadow-2xl border border-gray-700/50 animate-slide-up custom-scrollbar">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-500/5 to-purple-500/5 rounded-3xl pointer-events-none"></div>
        
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-400 hover:text-white transition-all duration-200 hover:rotate-90 hover:scale-110 z-10"
          disabled={loading}
        >
          <X size={24} />
        </button>

        <div className="relative">
          <h2 className="text-3xl sm:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary-400 via-purple-400 to-primary-500 mb-2 animate-text-shine">
            Create Account
          </h2>
          <p className="text-gray-400 text-sm mb-6">Join our learning community</p>

          {error && (
            <div className="bg-red-900/40 border border-red-700/50 text-red-200 px-4 py-3 rounded-xl mb-6 backdrop-blur-sm animate-shake">
              <p className="text-sm flex items-center gap-2">
                <AlertCircle size={16} />
                {error}
              </p>
            </div>
          )}

          <div className="space-y-4 sm:space-y-5">
            {/* Surname and Full Name */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
              <div className="group">
                <label className="block text-sm font-medium text-gray-300 mb-2">Surname *</label>
                <div className="relative">
                  <input
                    type="text"
                    value={formData.surname}
                    onChange={(e) => setFormData(prev => ({ ...prev, surname: e.target.value }))}
                    className="w-full bg-gray-800/60 backdrop-blur-xl text-white rounded-xl py-3 pl-11 pr-4 border border-gray-700/50 focus:border-primary-500/50 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all duration-200 group-hover:border-gray-600"
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
                    onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
                    className="w-full bg-gray-800/60 backdrop-blur-xl text-white rounded-xl py-3 pl-11 pr-4 border border-gray-700/50 focus:border-primary-500/50 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all duration-200 group-hover:border-gray-600"
                    placeholder="Enter full name"
                    disabled={loading}
                  />
                  <User size={18} className="absolute left-3.5 top-3.5 text-gray-400 group-hover:text-primary-400 transition-colors" />
                </div>
              </div>
            </div>

            {/* DOB and Class/Grade */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
              <div className="group">
                <label className="block text-sm font-medium text-gray-300 mb-2">Date of Birth *</label>
                <div className="relative">
                  <input
                    type="date"
                    value={formData.dob}
                    onChange={(e) => setFormData(prev => ({ ...prev, dob: e.target.value }))}
                    className="w-full bg-gray-800/60 backdrop-blur-xl text-white rounded-xl py-3 pl-11 pr-4 border border-gray-700/50 focus:border-primary-500/50 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all duration-200 group-hover:border-gray-600"
                    disabled={loading}
                  />
                  <Calendar size={18} className="absolute left-3.5 top-3.5 text-gray-400 group-hover:text-primary-400 transition-colors" />
                </div>
              </div>

              <div className="group">
                <label className="block text-sm font-medium text-gray-300 mb-2">Class/Grade *</label>
                <select
                  value={formData.classGrade}
                  onChange={(e) => setFormData(prev => ({ ...prev, classGrade: e.target.value as any }))}
                  className="w-full bg-gray-800/60 backdrop-blur-xl text-white rounded-xl py-3 pl-4 pr-4 border border-gray-700/50 focus:border-primary-500/50 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all duration-200 group-hover:border-gray-600 appearance-none cursor-pointer"
                  disabled={loading}
                >
                  <option value="">Select class/grade</option>
                  <option value="class6">Class 6</option>
                  <option value="class7">Class 7</option>
                  <option value="class8">Class 8</option>
                  <option value="class9">Class 9</option>
                  <option value="class10">Class 10</option>
                  <option value="ssc">SSC</option>
                  <option value="class11">Class 11</option>
                  <option value="class12">Class 12</option>
                  <option value="hsc">HSC</option>
                  <option value="diploma">Diploma</option>
                  <option value="undergraduate">Undergraduate</option>
                  <option value="graduated">Graduated</option>
                </select>
              </div>
            </div>

            {/* Phone Number */}
            <div className="group">
              <label className="block text-sm font-medium text-gray-300 mb-2">Phone Number *</label>
              <div className="relative flex items-center">
                <div className="absolute left-3.5 top-3.5 flex items-center gap-2 pointer-events-none z-10">
                  <Phone size={18} className="text-gray-400 group-hover:text-primary-400 transition-colors" />
                  <span className="text-white font-medium">+8801</span>
                </div>
                <input
                  type="tel"
                  value={getPhoneDisplay(formData.phoneNumber)}
                  onChange={(e) => handlePhoneNumberChange(e.target.value, 'phoneNumber')}
                  className="w-full bg-gray-800/60 backdrop-blur-xl text-white rounded-xl py-3 pl-[7.5rem] pr-4 border border-gray-700/50 focus:border-primary-500/50 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all duration-200 group-hover:border-gray-600"
                  placeholder="XXXXXXXXX"
                  maxLength={10}
                  disabled={loading}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1.5">Enter 10 digits (e.g., 1712345678)</p>
            </div>

            {/* Guardian Phone */}
            <div className="group">
              <label className="block text-sm font-medium text-gray-300 mb-2">Guardian Phone <span className="text-gray-500">(Optional)</span></label>
              <div className="relative flex items-center">
                <div className="absolute left-3.5 top-3.5 flex items-center gap-2 pointer-events-none z-10">
                  <Users size={18} className="text-gray-400 group-hover:text-primary-400 transition-colors" />
                  <span className="text-white font-medium">+8801</span>
                </div>
                <input
                  type="tel"
                  value={getPhoneDisplay(formData.guardianPhone)}
                  onChange={(e) => handlePhoneNumberChange(e.target.value, 'guardianPhone')}
                  className="w-full bg-gray-800/60 backdrop-blur-xl text-white rounded-xl py-3 pl-[7.5rem] pr-4 border border-gray-700/50 focus:border-primary-500/50 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all duration-200 group-hover:border-gray-600"
                  placeholder="XXXXXXXXX"
                  maxLength={10}
                  disabled={loading}
                />
              </div>
            </div>

            {/* Blood Group, Gender, Religion */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
              <div className="group">
                <label className="block text-sm font-medium text-gray-300 mb-2">Blood Group <span className="text-gray-500">(Optional)</span></label>
                <div className="relative">
                  <select
                    value={formData.bloodGroup}
                    onChange={(e) => setFormData(prev => ({ ...prev, bloodGroup: e.target.value as any }))}
                    className="w-full bg-gray-800/60 backdrop-blur-xl text-white rounded-xl py-3 pl-11 pr-4 border border-gray-700/50 focus:border-primary-500/50 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all duration-200 group-hover:border-gray-600 appearance-none cursor-pointer"
                    disabled={loading}
                  >
                    <option value="">Select</option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                  </select>
                  <Droplet size={18} className="absolute left-3.5 top-3.5 text-gray-400 group-hover:text-primary-400 transition-colors pointer-events-none" />
                </div>
              </div>

              <div className="group">
                <label className="block text-sm font-medium text-gray-300 mb-2">Gender *</label>
                <select
                  value={formData.gender}
                  onChange={(e) => setFormData(prev => ({ ...prev, gender: e.target.value as any }))}
                  className="w-full bg-gray-800/60 backdrop-blur-xl text-white rounded-xl py-3 pl-4 pr-4 border border-gray-700/50 focus:border-primary-500/50 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all duration-200 group-hover:border-gray-600 appearance-none cursor-pointer"
                  disabled={loading}
                >
                  <option value="">Select</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="group">
                <label className="block text-sm font-medium text-gray-300 mb-2">Religion <span className="text-gray-500">(Optional)</span></label>
                <input
                  type="text"
                  value={formData.religion}
                  onChange={(e) => setFormData(prev => ({ ...prev, religion: e.target.value }))}
                  className="w-full bg-gray-800/60 backdrop-blur-xl text-white rounded-xl py-3 pl-4 pr-4 border border-gray-700/50 focus:border-primary-500/50 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all duration-200 group-hover:border-gray-600"
                  placeholder="Your religion"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Email */}
            <div className="group">
              <label className="block text-sm font-medium text-gray-300 mb-2">Email <span className="text-gray-500">(Optional)</span></label>
              <div className="relative">
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full bg-gray-800/60 backdrop-blur-xl text-white rounded-xl py-3 pl-11 pr-4 border border-gray-700/50 focus:border-primary-500/50 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all duration-200 group-hover:border-gray-600"
                  placeholder="Enter your email"
                  disabled={loading}
                />
                <Mail size={18} className="absolute left-3.5 top-3.5 text-gray-400 group-hover:text-primary-400 transition-colors" />
              </div>
            </div>

            {/* Password Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
              <div className="group">
                <label className="block text-sm font-medium text-gray-300 mb-2">Password *</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                    className="w-full bg-gray-800/60 backdrop-blur-xl text-white rounded-xl py-3 pl-11 pr-11 border border-gray-700/50 focus:border-primary-500/50 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all duration-200 group-hover:border-gray-600"
                    placeholder="Min. 8 characters"
                    disabled={loading}
                  />
                  <Lock size={18} className="absolute left-3.5 top-3.5 text-gray-400 group-hover:text-primary-400 transition-colors" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-3.5 text-gray-400 hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {formData.password && (
                  <div className="mt-2">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                        <div className={`h-full transition-all duration-300 ${getStrengthColor()} ${getStrengthWidth()}`}></div>
                      </div>
                      <span className="text-xs text-gray-400 capitalize">{passwordStrength.strength.replace('-', ' ')}</span>
                    </div>
                    {passwordStrength.issues.length > 0 && (
                      <div className="text-xs text-red-300 space-y-0.5">
                        {passwordStrength.issues.map((issue, idx) => (
                          <div key={idx} className="flex items-center gap-1">
                            <span className="text-red-400">•</span> {issue}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="group">
                <label className="block text-sm font-medium text-gray-300 mb-2">Confirm Password *</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                    className="w-full bg-gray-800/60 backdrop-blur-xl text-white rounded-xl py-3 pl-11 pr-11 border border-gray-700/50 focus:border-primary-500/50 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all duration-200 group-hover:border-gray-600"
                    placeholder="Re-enter password"
                    disabled={loading}
                  />
                  <Lock size={18} className="absolute left-3.5 top-3.5 text-gray-400 group-hover:text-primary-400 transition-colors" />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3.5 top-3.5 text-gray-400 hover:text-white transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            </div>

            {/* reCAPTCHA */}
            <div className="flex justify-center">
              <ReCAPTCHA
                ref={recaptchaRef}
                sitekey={import.meta.env.VITE_RECAPTCHA_SITE_KEY || "6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI"}
                onChange={handleCaptchaChange}
                theme="dark"
              />
            </div>

            {/* Info Banner */}
            <div className="bg-gradient-to-r from-green-900/30 to-emerald-900/30 border border-green-700/30 rounded-xl p-4 backdrop-blur-xl">
              <div className="flex items-start gap-3">
                <div className="h-6 w-6 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-lg">
                  <CheckCircle size={14} className="text-white" />
                </div>
                <div>
                  <p className="text-sm text-green-100 font-semibold">Instant Account Activation</p>
                  <p className="text-xs text-green-200/80 mt-1">
                    Student accounts are automatically approved. Sign in immediately after verification!
                  </p>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <button
              onClick={handleFormSubmit}
              disabled={loading || !captchaToken}
              className="w-full bg-gradient-to-r from-primary-600 via-purple-600 to-primary-600 hover:from-primary-700 hover:via-purple-700 hover:to-primary-700 disabled:from-gray-700 disabled:to-gray-800 disabled:cursor-not-allowed text-white py-4 rounded-xl transition-all duration-300 active:scale-95 flex items-center justify-center gap-2 font-semibold shadow-2xl hover:shadow-primary-500/50 animate-gradient"
            >
              {loading && <Loader size={20} className="animate-spin" />}
              <span>{loading ? 'Processing...' : 'Continue to Verification'}</span>
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

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(31, 41, 55, 0.5);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: linear-gradient(to bottom, #8b5cf6, #6366f1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(to bottom, #7c3aed, #4f46e5);
        }
        @keyframes text-shine {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .animate-text-shine {
          background-size: 200% 200%;
          animation: text-shine 3s ease infinite;
        }
        @keyframes gradient {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .animate-gradient {
          background-size: 200% 200%;
          animation: gradient 3s ease infinite;
        }
        @keyframes pulse-slow {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
        .animate-pulse-slow {
          animation: pulse-slow 3s ease-in-out infinite;
        }
        @keyframes bounce-slow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        .animate-bounce-slow {
          animation: bounce-slow 2s ease-in-out infinite;
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
        @keyframes slide-up {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-slide-up {
          animation: slide-up 0.4s ease-out;
        }
        @keyframes slide-down {
          from { transform: translateY(-20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-slide-down {
          animation: slide-down 0.3s ease-out;
        }
        @keyframes scale-in {
          from { transform: scale(0.9); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .animate-scale-in {
          animation: scale-in 0.4s ease-out;
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
          20%, 40%, 60%, 80% { transform: translateX(5px); }
        }
        .animate-shake {
          animation: shake 0.5s ease-in-out;
        }
      `}</style>
    </div>
  );
};

export default RegisterModal;
