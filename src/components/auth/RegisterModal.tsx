// src/components/auth/RegisterModal.tsx
import { useState, useEffect, useRef } from 'react';
import { X, Mail, Lock, User, Loader, CheckCircle, Phone, Calendar, Users, Shield, AlertCircle, Eye, EyeOff, Droplet, MapPin } from 'lucide-react';
import { authService, validatePasswordStrength } from '../../services/authService';
import { otpService } from '../../services/otpService';

interface RegisterModalProps {
  onClose: () => void;
  onSuccess?: () => void;
  onSwitchToSignIn?: () => void;
}

const RegisterModal = ({ onClose, onSuccess, onSwitchToSignIn }: RegisterModalProps) => {
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
    address: '',
    classGrade: '' as '' | 'class6' | 'class7' | 'class8' | 'class9' | 'class10' | 'ssc' | 'class11' | 'class12' | 'hsc' | 'diploma' | 'undergraduate' | 'graduated',
    role: 'student' as 'admin' | 'teacher' | 'student'
  });

  // UI States
  const [currentStep, setCurrentStep] = useState<'form' | 'duplicate-check' | 'otp' | 'success'>('form');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [generatedUserId, setGeneratedUserId] = useState('');
  
  // Duplicate check states
  const [existingAccountsCount, setExistingAccountsCount] = useState(0);
  const [duplicateCheckLoading, setDuplicateCheckLoading] = useState(false);
  
  // Password visibility states
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState<{
    strength: 'weak' | 'medium' | 'strong' | 'very-strong';
    issues: string[];
  }>({ strength: 'weak', issues: [] });
  
  // Agreement checkboxes
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [agreedToPrivacy, setAgreedToPrivacy] = useState(false);
  
  // OTP States
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [otpError, setOtpError] = useState('');
  const [otpSuccess, setOtpSuccess] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [canResendOTP, setCanResendOTP] = useState(false);
  const [resendTimer, setResendTimer] = useState(60);

  // reCAPTCHA v3 state
  const [captchaLoaded, setCaptchaLoaded] = useState(false);

  // Scroll detection for close button visibility
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout>();

  // Floating notification state for mobile
  const [floatingNotification, setFloatingNotification] = useState('');
  const floatingNotificationTimeoutRef = useRef<NodeJS.Timeout>();

  // Show floating notification (mobile only)
  const showFloatingNotification = (message: string) => {
    setFloatingNotification(message);
    
    if (floatingNotificationTimeoutRef.current) {
      clearTimeout(floatingNotificationTimeoutRef.current);
    }
    
    floatingNotificationTimeoutRef.current = setTimeout(() => {
      setFloatingNotification('');
    }, 3000);
  };

  // Update error setter to also show floating notification
  const setErrorWithNotification = (message: string) => {
    setError(message);
    if (message) {
      showFloatingNotification(message);
    }
  };

  // Load reCAPTCHA v3
  useEffect(() => {
    const loadRecaptcha = () => {
      if (window.grecaptcha) {
        setCaptchaLoaded(true);
        return;
      }

      const script = document.createElement('script');
      script.src = `https://www.google.com/recaptcha/api.js?render=${import.meta.env.VITE_RECAPTCHA_SITE_KEY || '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI'}`;
      script.async = true;
      script.defer = true;
      script.onload = () => setCaptchaLoaded(true);
      document.head.appendChild(script);
    };

    loadRecaptcha();
  }, []);

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
    
    // Remove country code if user accidentally types it
    if (cleaned.startsWith('880')) {
      cleaned = cleaned.substring(3);
    } else if (cleaned.startsWith('88')) {
      cleaned = cleaned.substring(2);
    }
    
    // Limit to 11 digits
    cleaned = cleaned.substring(0, 11);
    
    setFormData(prev => ({ ...prev, [field]: cleaned }));
  };

  // Normalize phone number to 880XXXXXXXXXX format
  const normalizePhoneNumber = (phoneNumber: string): string => {
    let cleaned = phoneNumber.replace(/\D/g, '');
    
    // Remove country code if present
    if (cleaned.startsWith('880')) {
      cleaned = cleaned.substring(3);
    } else if (cleaned.startsWith('88')) {
      cleaned = cleaned.substring(2);
    }
    
    // Remove leading zero if present
    if (cleaned.startsWith('0')) {
      cleaned = cleaned.substring(1);
    }
    
    // Should now have 10 digits
    if (cleaned.length !== 10) {
      throw new Error('Invalid phone number format');
    }
    
    // Return in format: 880XXXXXXXXXX (no + sign)
    return `880${cleaned}`;
  };

  // Validate phone number
  const validatePhoneNumber = (phoneNumber: string): boolean => {
    const cleaned = phoneNumber.replace(/\D/g, '');
    
    // Must be 10 or 11 digits
    if (cleaned.length !== 10 && cleaned.length !== 11) {
      return false;
    }
    
    // If 11 digits, must start with 0
    if (cleaned.length === 11 && !cleaned.startsWith('0')) {
      return false;
    }
    
    // Get the first digit after optional leading 0
    const firstDigit = cleaned.startsWith('0') ? cleaned[1] : cleaned[0];
    
    // Must start with valid digits (1,3,4,5,6,7,8,9)
    return ['1', '3', '4', '5', '6', '7', '8', '9'].includes(firstDigit);
  };

  // Get reCAPTCHA v3 token
  const getCaptchaToken = async (): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!window.grecaptcha || !captchaLoaded) {
        reject(new Error('reCAPTCHA not loaded'));
        return;
      }

      window.grecaptcha.ready(() => {
        window.grecaptcha
          .execute(import.meta.env.VITE_RECAPTCHA_SITE_KEY || '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI', { action: 'register' })
          .then((token: string) => {
            resolve(token);
          })
          .catch((error: Error) => {
            reject(error);
          });
      });
    });
  };

  // Check for existing users with same phone number
  const checkExistingUsers = async (phoneNumber: string): Promise<number> => {
    try {
      const normalized = normalizePhoneNumber(phoneNumber);
      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 
                         import.meta.env.VITE_API_URL ||
                         'https://edtech-dashboard-alpha.vercel.app';
      const MASTER_API_KEY = import.meta.env.VITE_SMS_MASTER_KEY;

      const requestBody: any = {
        phoneNumber: normalized,
        checkDuplicates: true
      };

      if (MASTER_API_KEY) {
        requestBody.apiKey = MASTER_API_KEY;
      }

      const response = await fetch(`${BACKEND_URL}/api/user-search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        return 0; // No existing users found or error
      }

      const result = await response.json();
      
      if (result.success && result.count) {
        return result.count;
      }
      
      return 0;
    } catch (error) {
      console.error('Error checking existing users:', error);
      return 0;
    }
  };

  // Handle form submission (before OTP)
  const handleFormSubmit = async () => {
    setError('');
    setFloatingNotification('');
    setLoading(true);

    try {
      // Validate all required fields
      if (!formData.surname.trim()) {
        throw new Error('Surname is required');
      }
      if (!formData.fullName.trim()) {
        throw new Error('Full name is required');
      }
      if (!formData.dob) {
        throw new Error('Date of birth is required');
      }
      if (!formData.phoneNumber.trim()) {
        throw new Error('Phone number is required');
      }
      if (!formData.gender) {
        throw new Error('Gender is required');
      }
      if (!formData.classGrade) {
        throw new Error('Class/Grade is required');
      }
      if (!formData.password) {
        throw new Error('Password is required');
      }
      if (formData.password !== formData.confirmPassword) {
        throw new Error('Passwords do not match');
      }

      // Validate phone number
      if (!validatePhoneNumber(formData.phoneNumber)) {
        throw new Error('Please enter a valid Bangladesh phone number');
      }

      // Validate guardian phone if provided
      if (formData.guardianPhone && !validatePhoneNumber(formData.guardianPhone)) {
        throw new Error('Please enter a valid guardian phone number');
      }

      // Validate password strength
      const passwordValidation = validatePasswordStrength(formData.password);
      if (!passwordValidation.isStrong) {
        throw new Error('Password must include uppercase, lowercase, number, and special character (min 8 chars)');
      }

      // Validate terms agreement
      if (!agreedToTerms || !agreedToPrivacy) {
        throw new Error('Please agree to Terms of Service and Privacy Policy');
      }

      // Check for existing users with same phone number
      setDuplicateCheckLoading(true);
      const count = await checkExistingUsers(formData.phoneNumber);
      setDuplicateCheckLoading(false);
      
      if (count > 0) {
        // Show duplicate check screen
        setExistingAccountsCount(count);
        setCurrentStep('duplicate-check');
        setLoading(false);
        return;
      }

      // No duplicates, proceed to send OTP
      await sendOTP();

    } catch (error: any) {
      const errorMessage = error.message || 'Registration failed. Please try again.';
      setError(errorMessage);
      showFloatingNotification(errorMessage);
      setLoading(false);
      setDuplicateCheckLoading(false);
    }
  };

  // Send OTP using otpService
  const sendOTP = async () => {
    try {
      setLoading(true);
      setError('');

      const normalizedPhone = normalizePhoneNumber(formData.phoneNumber);

      // Use otpService.sendOTP instead of direct API call
      const result = await otpService.sendOTP(normalizedPhone, 'registration', formData.surname);

      if (!result.success) {
        throw new Error(result.message || 'Failed to send OTP');
      }

      setCurrentStep('otp');
      startResendTimer();
      setLoading(false);
    } catch (error: any) {
      setError(error.message || 'Failed to send OTP');
      setLoading(false);
    }
  };

  // Handle OTP input
  const handleOTPChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);

    if (value && index < 5) {
      const nextInput = document.getElementById(`otp-${index + 1}`);
      nextInput?.focus();
    }
  };

  // Handle OTP backspace
  const handleOTPKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      const prevInput = document.getElementById(`otp-${index - 1}`);
      prevInput?.focus();
    }
  };

  // Verify OTP and complete registration
  const handleOTPVerification = async () => {
    const otpCode = otp.join('');
    
    if (otpCode.length !== 6) {
      setOtpError('Please enter the complete 6-digit OTP');
      return;
    }

    setOtpLoading(true);
    setOtpError('');

    try {
      const normalizedPhone = normalizePhoneNumber(formData.phoneNumber);

      // Verify OTP using otpService
      const verifyResult = await otpService.verifyOTP(normalizedPhone, otpCode, 'registration');
      
      if (!verifyResult.success) {
        throw new Error(verifyResult.message || 'Invalid or expired OTP. Please try again.');
      }

      // Generate student ID via backend
      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 
                         import.meta.env.VITE_API_URL ||
                         'https://edtech-dashboard-alpha.vercel.app';
      const MASTER_API_KEY = import.meta.env.VITE_SMS_MASTER_KEY;

      const idRequestBody: any = {
        role: 'student'
      };

      if (MASTER_API_KEY) {
        idRequestBody.apiKey = MASTER_API_KEY;
      }

      const idResponse = await fetch(`${BACKEND_URL}/api/generate-id`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(idRequestBody)
      });

      if (!idResponse.ok) {
        throw new Error('Failed to generate student ID');
      }

      const idResult = await idResponse.json();
      
      if (!idResult.success || !idResult.userId) {
        throw new Error('Failed to generate student ID');
      }

      const studentId = idResult.userId;
      setGeneratedUserId(studentId);

      // Prepare guardian phone
      let guardianPhone = undefined;
      if (formData.guardianPhone && formData.guardianPhone.trim()) {
        guardianPhone = normalizePhoneNumber(formData.guardianPhone);
      }

      // Register user with authService
      await authService.register(
        formData.email && formData.email.trim() ? formData.email.trim() : undefined,
        formData.password,
        formData.fullName,
        formData.surname,
        formData.dob,
        normalizedPhone,
        guardianPhone,
        formData.bloodGroup || undefined,
        formData.gender,
        formData.religion || undefined,
        formData.classGrade,
        formData.role,
        studentId,
        normalizedPhone,
        formData.address || undefined
      );

      // Send registration success SMS using otpService
      await otpService.sendRegistrationSuccessSMS(normalizedPhone, formData.surname, studentId);

      setOtpSuccess('Registration successful! You can now sign in.');
      setCurrentStep('success');
      
      setTimeout(() => {
        if (onSuccess) {
          onSuccess();
        } else {
          onClose();
        }
      }, 2000);

    } catch (error: any) {
      setOtpError(error.message || 'Verification failed. Please try again.');
    } finally {
      setOtpLoading(false);
    }
  };

  // Resend OTP using otpService
  const handleResendOTP = async () => {
    try {
      setOtpError('');
      setOtpSuccess('');
      setOtp(['', '', '', '', '', '']);

      const normalizedPhone = normalizePhoneNumber(formData.phoneNumber);

      // Use otpService.sendOTP instead of direct API call
      const result = await otpService.sendOTP(normalizedPhone, 'registration', formData.surname);

      if (!result.success) {
        throw new Error(result.message || 'Failed to resend OTP');
      }

      setOtpSuccess('OTP resent successfully!');
      startResendTimer();
      
      setTimeout(() => setOtpSuccess(''), 3000);
    } catch (error: any) {
      setOtpError(error.message || 'Failed to resend OTP');
    }
  };

  // Helper function for password strength color
  const getStrengthColor = () => {
    switch (passwordStrength.strength) {
      case 'very-strong': return 'bg-green-500';
      case 'strong': return 'bg-blue-500';
      case 'medium': return 'bg-yellow-500';
      default: return 'bg-red-500';
    }
  };

  // Helper function for password strength width
  const getStrengthWidth = () => {
    switch (passwordStrength.strength) {
      case 'very-strong': return 'w-full';
      case 'strong': return 'w-3/4';
      case 'medium': return 'w-1/2';
      default: return 'w-1/4';
    }
  };

  // Render OTP step
  if (currentStep === 'otp') {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[80] overflow-y-auto">
        <div className="flex justify-center min-h-full items-start p-3 md:p-4">
        <div className="relative w-full max-w-[95%] sm:max-w-md">
            onClick={onClose}
            className="absolute -top-10 sm:-top-12 right-0 text-gray-400 hover:text-white transition-colors"
          >
            <X size={20} className="sm:w-6 sm:h-6" />
          </button>

          <div className="bg-gradient-to-br from-gray-900 via-gray-900 to-primary-900/30 rounded-xl sm:rounded-2xl shadow-2xl border border-gray-800/50 overflow-hidden backdrop-blur-xl">
            <div className="p-4 sm:p-6 md:p-8">
              <div className="text-center mb-6 sm:mb-8">
                <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-primary-500 to-purple-600 rounded-full mb-3 sm:mb-4 shadow-lg">
                  <Phone className="text-white" size={24} />
                </div>
                <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary-400 via-purple-400 to-primary-400 mb-2 px-2">
                  Verify Phone Number
                </h2>
                <p className="text-gray-400 text-xs sm:text-sm px-2">
                  Enter the 6-digit code sent to<br />
                  <span className="text-primary-400 font-medium">+{normalizePhoneNumber(formData.phoneNumber)}</span>
                </p>
              </div>

              <div className="space-y-4 sm:space-y-6">
                {otpError && (
                  <div className="bg-red-500/10 border border-red-500/50 rounded-lg sm:rounded-xl p-3 sm:p-4 backdrop-blur-xl">
                    <div className="flex items-start gap-2 sm:gap-3">
                      <AlertCircle className="text-red-400 flex-shrink-0 mt-0.5" size={16} />
                      <p className="text-red-300 text-xs sm:text-sm">{otpError}</p>
                    </div>
                  </div>
                )}

                {otpSuccess && (
                  <div className="bg-green-500/10 border border-green-500/50 rounded-lg sm:rounded-xl p-3 sm:p-4 backdrop-blur-xl">
                    <div className="flex items-start gap-2 sm:gap-3">
                      <CheckCircle className="text-green-400 flex-shrink-0 mt-0.5" size={16} />
                      <p className="text-green-300 text-xs sm:text-sm">{otpSuccess}</p>
                    </div>
                  </div>
                )}

                <div className="flex gap-1.5 sm:gap-2 justify-center">
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
                      className="w-10 h-12 sm:w-12 sm:h-14 text-center text-xl sm:text-2xl font-bold bg-gray-800/60 backdrop-blur-xl text-white rounded-lg sm:rounded-xl border border-gray-700/50 focus:border-primary-500/50 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all duration-200"
                      disabled={otpLoading}
                    />
                  ))}
                </div>

                <button
                  onClick={handleOTPVerification}
                  disabled={otpLoading || otp.join('').length !== 6}
                  className="w-full bg-gradient-to-r from-primary-600 via-purple-600 to-primary-600 hover:from-primary-700 hover:via-purple-700 hover:to-primary-700 disabled:from-gray-700 disabled:to-gray-800 disabled:cursor-not-allowed text-white py-3 sm:py-4 rounded-lg sm:rounded-xl transition-all duration-300 active:scale-95 flex items-center justify-center gap-2 font-semibold shadow-2xl hover:shadow-primary-500/50 text-sm sm:text-base"
                >
                  {otpLoading && <Loader size={18} className="sm:w-5 sm:h-5 animate-spin" />}
                  <span>{otpLoading ? 'Verifying...' : 'Verify & Register'}</span>
                </button>

                <div className="text-center">
                  {canResendOTP ? (
                    <button
                      onClick={handleResendOTP}
                      className="text-primary-400 hover:text-primary-300 text-xs sm:text-sm font-medium transition-colors"
                    >
                      Resend OTP
                    </button>
                  ) : (
                    <p className="text-gray-400 text-xs sm:text-sm">
                      Resend OTP in <span className="text-primary-400 font-medium">{resendTimer}s</span>
                    </p>
                  )}
                </div>

                <button
                  onClick={() => setCurrentStep('form')}
                  className="w-full text-gray-400 hover:text-white text-xs sm:text-sm transition-colors"
                >
                  ← Back to registration form
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
    );
  }

  // Render duplicate check step
  if (currentStep === 'duplicate-check') {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[80] overflow-y-auto">
        <div className="flex justify-center min-h-full items-start p-3 md:p-4">
        <div className="relative w-full max-w-[95%] sm:max-w-md">
            onClick={onClose}
            className="absolute -top-10 sm:-top-12 right-0 text-gray-400 hover:text-white transition-colors"
          >
            <X size={20} className="sm:w-6 sm:h-6" />
          </button>

          <div className="bg-gradient-to-br from-gray-900 via-gray-900 to-yellow-900/30 rounded-xl sm:rounded-2xl shadow-2xl border border-gray-800/50 overflow-hidden backdrop-blur-xl">
            <div className="p-4 sm:p-6 md:p-8">
              <div className="text-center mb-6 sm:mb-8">
                <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-full mb-3 sm:mb-4 shadow-lg">
                  <AlertCircle className="text-white" size={24} className="sm:w-7 sm:h-7" />
                </div>
                <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-orange-400 to-yellow-400 mb-2 px-2">
                  Existing Accounts Found
                </h2>
                <p className="text-gray-400 text-xs sm:text-sm px-2">
                  {existingAccountsCount} student account{existingAccountsCount > 1 ? 's' : ''} already exist{existingAccountsCount === 1 ? 's' : ''} with this mobile number
                </p>
                <p className="text-primary-400 font-medium mt-2 text-sm sm:text-base">
                  +{normalizePhoneNumber(formData.phoneNumber)}
                </p>
              </div>

              <div className="space-y-3 sm:space-y-4">
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg sm:rounded-xl p-3 sm:p-4 backdrop-blur-xl">
                  <p className="text-yellow-200 text-xs sm:text-sm text-center">
                    You can sign in to an existing account or create a new one with the same phone number
                  </p>
                </div>

                <button
                  onClick={onClose}
                  className="w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 hover:from-blue-700 hover:via-indigo-700 hover:to-blue-700 text-white py-3 sm:py-4 rounded-lg sm:rounded-xl transition-all duration-300 active:scale-95 flex items-center justify-center gap-2 font-semibold shadow-2xl text-sm sm:text-base"
                >
                  <Shield size={18} className="sm:w-5 sm:h-5" />
                  <span>Sign In to Existing Account</span>
                </button>

                <button
                  onClick={async () => {
                    await sendOTP();
                  }}
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-primary-600 via-purple-600 to-primary-600 hover:from-primary-700 hover:via-purple-700 hover:to-primary-700 disabled:from-gray-700 disabled:to-gray-800 disabled:cursor-not-allowed text-white py-3 sm:py-4 rounded-lg sm:rounded-xl transition-all duration-300 active:scale-95 flex items-center justify-center gap-2 font-semibold shadow-2xl text-sm sm:text-base"
                >
                  {loading && <Loader size={18} className="sm:w-5 sm:h-5 animate-spin" />}
                  <span>{loading ? 'Sending OTP...' : 'Create New Account'}</span>
                </button>

                <button
                  onClick={() => setCurrentStep('form')}
                  className="w-full text-gray-400 hover:text-white text-xs sm:text-sm transition-colors"
                >
                  ← Back to registration form
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
    );
  }

  // Render success step
  if (currentStep === 'success') {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[80] overflow-y-auto">
        <div className="flex justify-center min-h-full items-start p-3 md:p-4">
        <div className="relative w-full max-w-[95%] sm:max-w-md">
            <div className="p-4 sm:p-6 md:p-8">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full mb-4 sm:mb-6 shadow-lg animate-bounce">
                  <CheckCircle className="text-white" size={32} className="sm:w-10 sm:h-10" />
                </div>
                <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 via-emerald-400 to-green-400 mb-3 sm:mb-4 px-2">
                  Registration Successful!
                </h2>
                {generatedUserId && (
                  <div className="bg-gray-800/60 backdrop-blur-xl rounded-lg sm:rounded-xl p-3 sm:p-4 mb-4 sm:mb-6 border border-gray-700/50">
                    <p className="text-xs sm:text-sm text-gray-400 mb-1.5 sm:mb-2">Your Student ID</p>
                    <p className="text-lg sm:text-xl md:text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-purple-500 break-all">
                      {generatedUserId}
                    </p>
                  </div>
                )}
                <p className="text-xs sm:text-sm text-gray-300 mb-4 sm:mb-6 px-2">
                  Your account has been created successfully. You can now sign in and start learning!
                </p>
                <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-green-500 to-emerald-500 animate-pulse"></div>
                </div>
                <p className="text-xs sm:text-sm text-gray-400 mt-3 sm:mt-4">Redirecting to sign in...</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
    );
  }

  // Handle scroll to hide/show close button
  const handleScroll = () => {
    setIsScrolling(true);
    
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    
    scrollTimeoutRef.current = setTimeout(() => {
      setIsScrolling(false);
    }, 150);
  };

  // Render form step
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[80] overflow-y-auto">
      <div className="flex justify-center min-h-full items-start p-0 sm:p-4">
      <div className="relative w-full h-full sm:h-auto sm:max-w-2xl sm:my-8 flex flex-col">
          onClick={onClose}
          className={`absolute top-3 right-3 sm:-top-12 sm:right-0 text-gray-400 hover:text-white transition-all duration-300 z-20 ${
            isScrolling || floatingNotification ? 'opacity-0 pointer-events-none' : 'opacity-100'
          } sm:opacity-100 sm:pointer-events-auto`}
          aria-label="Close"
        >
          <X size={20} className="sm:w-6 sm:h-6" strokeWidth={2.5} />
        </button>

        <div className="bg-gradient-to-br from-gray-900 via-gray-900 to-primary-900/30 sm:rounded-2xl shadow-2xl border-0 sm:border border-gray-800/50 overflow-hidden backdrop-blur-xl h-full sm:h-auto flex flex-col">
          <div className="p-4 sm:p-6 md:p-8 flex-1 overflow-y-auto" onScroll={handleScroll}>
            <div className="text-center mb-4 sm:mb-6 md:mb-8 pt-8 sm:pt-0">
              <div className="inline-flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 bg-gradient-to-br from-primary-500 to-purple-600 rounded-full mb-3 sm:mb-4 shadow-lg">
                <User className="text-white" size={20} className="sm:w-6 sm:h-6 md:w-7 md:h-7" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary-400 via-purple-400 to-primary-400 mb-2 px-2">
                Create Account
              </h2>
              <p className="text-gray-400 text-xs sm:text-sm px-2">Join us and start your learning journey</p>
            </div>

            {error && (
              <div className="mb-4 sm:mb-6 bg-red-500/10 border border-red-500/50 rounded-lg sm:rounded-xl p-3 sm:p-4 backdrop-blur-xl">
                <div className="flex items-start gap-2 sm:gap-3">
                  <AlertCircle className="text-red-400 flex-shrink-0 mt-0.5" size={16} className="sm:w-[18px] sm:h-[18px]" />
                  <p className="text-red-300 text-xs sm:text-sm">{error}</p>
                </div>
              </div>
            )}

            <div className="space-y-3 sm:space-y-4 md:space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 md:gap-5">
                <div className="group">
                  <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1.5 sm:mb-2">Surname *</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.surname}
                      onChange={(e) => setFormData(prev => ({ ...prev, surname: e.target.value }))}
                      className="w-full bg-gray-800/60 backdrop-blur-xl text-white rounded-lg sm:rounded-xl py-2.5 sm:py-3 pl-9 sm:pl-11 pr-3 sm:pr-4 border border-gray-700/50 focus:border-primary-500/50 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all duration-200 group-hover:border-gray-600 text-sm sm:text-base"
                      placeholder="Your surname"
                      disabled={loading || duplicateCheckLoading}
                    />
                    <User size={16} className="sm:w-[18px] sm:h-[18px] absolute left-2.5 sm:left-3.5 top-2.5 sm:top-3.5 text-gray-400 group-hover:text-primary-400 transition-colors" />
                  </div>
                </div>

                <div className="group">
                  <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1.5 sm:mb-2">Full Name *</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.fullName}
                      onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
                      className="w-full bg-gray-800/60 backdrop-blur-xl text-white rounded-lg sm:rounded-xl py-2.5 sm:py-3 pl-9 sm:pl-11 pr-3 sm:pr-4 border border-gray-700/50 focus:border-primary-500/50 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all duration-200 group-hover:border-gray-600 text-sm sm:text-base"
                      placeholder="Your full name"
                      disabled={loading || duplicateCheckLoading}
                    />
                    <User size={16} className="sm:w-[18px] sm:h-[18px] absolute left-2.5 sm:left-3.5 top-2.5 sm:top-3.5 text-gray-400 group-hover:text-primary-400 transition-colors" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 md:gap-5">
                <div className="group">
                  <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1.5 sm:mb-2">Date of Birth *</label>
                  <div className="relative">
                    <input
                      type="date"
                      value={formData.dob}
                      onChange={(e) => setFormData(prev => ({ ...prev, dob: e.target.value }))}
                      className="w-full bg-gray-800/60 backdrop-blur-xl text-white rounded-lg sm:rounded-xl py-2.5 sm:py-3 pl-9 sm:pl-11 pr-3 sm:pr-4 border border-gray-700/50 focus:border-primary-500/50 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all duration-200 group-hover:border-gray-600 text-sm sm:text-base"
                      disabled={loading || duplicateCheckLoading}
                    />
                    <Calendar size={16} className="sm:w-[18px] sm:h-[18px] absolute left-2.5 sm:left-3.5 top-2.5 sm:top-3.5 text-gray-400 group-hover:text-primary-400 transition-colors" />
                  </div>
                </div>

                <div className="group">
                  <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1.5 sm:mb-2">Gender *</label>
                  <div className="relative">
                    <select
                      value={formData.gender}
                      onChange={(e) => setFormData(prev => ({ ...prev, gender: e.target.value as any }))}
                      className="w-full bg-gray-800/60 backdrop-blur-xl text-white rounded-lg sm:rounded-xl py-2.5 sm:py-3 pl-9 sm:pl-11 pr-3 sm:pr-4 border border-gray-700/50 focus:border-primary-500/50 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all duration-200 group-hover:border-gray-600 appearance-none cursor-pointer"
                      disabled={loading || duplicateCheckLoading}
                    >
                      <option value="">Select gender</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                    <Users size={16} className="sm:w-[18px] sm:h-[18px] absolute left-2.5 sm:left-3.5 top-2.5 sm:top-3.5 text-gray-400 group-hover:text-primary-400 transition-colors pointer-events-none" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                <div className="group">
                  <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1.5 sm:mb-2">Phone Number *</label>
                  <div className="relative">
                    <input
                      type="tel"
                      value={formData.phoneNumber}
                      onChange={(e) => handlePhoneNumberChange(e.target.value, 'phoneNumber')}
                      className="w-full bg-gray-800/60 backdrop-blur-xl text-white rounded-lg sm:rounded-xl py-2.5 sm:py-3 pl-9 sm:pl-11 pr-3 sm:pr-4 border border-gray-700/50 focus:border-primary-500/50 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all duration-200 group-hover:border-gray-600"
                      placeholder="01XXXXXXXXX"
                      disabled={loading || duplicateCheckLoading}
                    />
                    <Phone size={16} className="sm:w-[18px] sm:h-[18px] absolute left-2.5 sm:left-3.5 top-2.5 sm:top-3.5 text-gray-400 group-hover:text-primary-400 transition-colors" />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Bangladesh phone number</p>
                </div>

                <div className="group">
                  <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1.5 sm:mb-2">Guardian Phone <span className="text-gray-500">(Optional)</span></label>
                  <div className="relative">
                    <input
                      type="tel"
                      value={formData.guardianPhone}
                      onChange={(e) => handlePhoneNumberChange(e.target.value, 'guardianPhone')}
                      className="w-full bg-gray-800/60 backdrop-blur-xl text-white rounded-lg sm:rounded-xl py-2.5 sm:py-3 pl-9 sm:pl-11 pr-3 sm:pr-4 border border-gray-700/50 focus:border-primary-500/50 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all duration-200 group-hover:border-gray-600"
                      placeholder="01XXXXXXXXX"
                      disabled={loading || duplicateCheckLoading}
                    />
                    <Phone size={16} className="sm:w-[18px] sm:h-[18px] absolute left-2.5 sm:left-3.5 top-2.5 sm:top-3.5 text-gray-400 group-hover:text-primary-400 transition-colors" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                <div className="group">
                  <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1.5 sm:mb-2">Blood Group <span className="text-gray-500">(Optional)</span></label>
                  <div className="relative">
                    <select
                      value={formData.bloodGroup}
                      onChange={(e) => setFormData(prev => ({ ...prev, bloodGroup: e.target.value as any }))}
                      className="w-full bg-gray-800/60 backdrop-blur-xl text-white rounded-lg sm:rounded-xl py-2.5 sm:py-3 pl-9 sm:pl-11 pr-3 sm:pr-4 border border-gray-700/50 focus:border-primary-500/50 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all duration-200 group-hover:border-gray-600 appearance-none cursor-pointer"
                      disabled={loading || duplicateCheckLoading}
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
                    <Droplet size={16} className="sm:w-[18px] sm:h-[18px] absolute left-2.5 sm:left-3.5 top-2.5 sm:top-3.5 text-gray-400 group-hover:text-primary-400 transition-colors pointer-events-none" />
                  </div>
                </div>

                <div className="group">
                  <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1.5 sm:mb-2">Class/Grade *</label>
                  <div className="relative">
                    <select
                      value={formData.classGrade}
                      onChange={(e) => setFormData(prev => ({ ...prev, classGrade: e.target.value as any }))}
                      className="w-full bg-gray-800/60 backdrop-blur-xl text-white rounded-xl py-3 pl-4 pr-4 border border-gray-700/50 focus:border-primary-500/50 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all duration-200 group-hover:border-gray-600 appearance-none cursor-pointer"
                      disabled={loading || duplicateCheckLoading}
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
              </div>

              <div className="group">
                <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1.5 sm:mb-2">Religion <span className="text-gray-500">(Optional)</span></label>
                <input
                  type="text"
                  value={formData.religion}
                  onChange={(e) => setFormData(prev => ({ ...prev, religion: e.target.value }))}
                  className="w-full bg-gray-800/60 backdrop-blur-xl text-white rounded-xl py-3 pl-4 pr-4 border border-gray-700/50 focus:border-primary-500/50 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all duration-200 group-hover:border-gray-600"
                  placeholder="Your religion"
                  disabled={loading || duplicateCheckLoading}
                />
              </div>

              <div className="group">
                <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1.5 sm:mb-2">Address <span className="text-gray-500">(Optional)</span></label>
                <div className="relative">
                  <textarea
                    value={formData.address}
                    onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                    className="w-full bg-gray-800/60 backdrop-blur-xl text-white rounded-lg sm:rounded-xl py-2.5 sm:py-3 pl-9 sm:pl-11 pr-3 sm:pr-4 border border-gray-700/50 focus:border-primary-500/50 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all duration-200 group-hover:border-gray-600 min-h-[80px] resize-none"
                    placeholder="Enter your address"
                    disabled={loading || duplicateCheckLoading}
                    rows={3}
                  />
                  <MapPin size={16} className="sm:w-[18px] sm:h-[18px] absolute left-2.5 sm:left-3.5 top-2.5 sm:top-3.5 text-gray-400 group-hover:text-primary-400 transition-colors" />
                </div>
              </div>

              <div className="group">
                <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1.5 sm:mb-2">Email <span className="text-gray-500">(Optional)</span></label>
                <div className="relative">
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full bg-gray-800/60 backdrop-blur-xl text-white rounded-lg sm:rounded-xl py-2.5 sm:py-3 pl-9 sm:pl-11 pr-3 sm:pr-4 border border-gray-700/50 focus:border-primary-500/50 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all duration-200 group-hover:border-gray-600"
                    placeholder="Enter your email"
                    disabled={loading || duplicateCheckLoading}
                  />
                  <Mail size={16} className="sm:w-[18px] sm:h-[18px] absolute left-2.5 sm:left-3.5 top-2.5 sm:top-3.5 text-gray-400 group-hover:text-primary-400 transition-colors" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                <div className="group">
                  <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1.5 sm:mb-2">Password *</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={formData.password}
                      onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                      className="w-full bg-gray-800/60 backdrop-blur-xl text-white rounded-lg sm:rounded-xl py-2.5 sm:py-3 pl-9 sm:pl-11 pr-9 sm:pr-11 border border-gray-700/50 focus:border-primary-500/50 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all duration-200 group-hover:border-gray-600 text-sm sm:text-base"
                      placeholder="Min. 8 characters"
                      disabled={loading || duplicateCheckLoading}
                    />
                    <Lock size={16} className="sm:w-[18px] sm:h-[18px] absolute left-2.5 sm:left-3.5 top-2.5 sm:top-3.5 text-gray-400 group-hover:text-primary-400 transition-colors pointer-events-none" />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors duration-200"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={16} className="sm:w-[18px] sm:h-[18px]" /> : <Eye size={16} className="sm:w-[18px] sm:h-[18px]" />}
                    </button>
                  </div>
                  {formData.password && (
                    <div className="mt-1.5 sm:mt-2">
                      <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
                        <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                          <div className={`h-full transition-all duration-300 ${getStrengthColor()} ${getStrengthWidth()}`}></div>
                        </div>
                        <span className="text-[10px] sm:text-xs text-gray-400 capitalize whitespace-nowrap">{passwordStrength.strength.replace('-', ' ')}</span>
                      </div>
                      {passwordStrength.issues.length > 0 && (
                        <div className="text-[10px] sm:text-xs text-red-300 space-y-0.5">
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
                  <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1.5 sm:mb-2">Confirm Password *</label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                      className="w-full bg-gray-800/60 backdrop-blur-xl text-white rounded-lg sm:rounded-xl py-2.5 sm:py-3 pl-9 sm:pl-11 pr-9 sm:pr-11 border border-gray-700/50 focus:border-primary-500/50 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all duration-200 group-hover:border-gray-600 text-sm sm:text-base"
                      placeholder="Re-enter password"
                      disabled={loading || duplicateCheckLoading}
                    />
                    <Lock size={16} className="sm:w-[18px] sm:h-[18px] absolute left-2.5 sm:left-3.5 top-2.5 sm:top-3.5 text-gray-400 group-hover:text-primary-400 transition-colors pointer-events-none" />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors duration-200"
                      aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                    >
                      {showConfirmPassword ? <EyeOff size={16} className="sm:w-[18px] sm:h-[18px]" /> : <Eye size={16} className="sm:w-[18px] sm:h-[18px]" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Agreement Checkboxes */}
              <div className="space-y-2.5 sm:space-y-3 bg-gray-800/40 backdrop-blur-xl rounded-lg sm:rounded-xl p-3 sm:p-4 border border-gray-700/30">
                <label className="flex items-start gap-2 sm:gap-3 cursor-pointer group select-none">
                  <div className="relative flex-shrink-0 mt-0.5">
                    <input
                      type="checkbox"
                      checked={agreedToTerms}
                      onChange={(e) => setAgreedToTerms(e.target.checked)}
                      className="peer sr-only"
                      disabled={loading || duplicateCheckLoading}
                    />
                    <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-gray-600 rounded bg-gray-800/50 peer-checked:bg-gradient-to-br peer-checked:from-primary-500 peer-checked:to-purple-600 peer-checked:border-primary-500 transition-all duration-300 flex items-center justify-center group-hover:border-primary-500/50 peer-disabled:opacity-50 peer-disabled:cursor-not-allowed">
                      <svg 
                        className={`w-2.5 h-2.5 sm:w-3 sm:h-3 text-white transition-all duration-300 ${agreedToTerms ? 'scale-100 opacity-100' : 'scale-0 opacity-0'}`}
                        fill="none" 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth="3" 
                        viewBox="0 0 24 24" 
                        stroke="currentColor"
                      >
                        <path d="M5 13l4 4L19 7"></path>
                      </svg>
                    </div>
                  </div>
                  <span className="text-xs sm:text-sm text-gray-300 group-hover:text-gray-200 transition-colors">
                    I agree to the{' '}
                    <a 
                      href="/terms-of-service" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary-400 hover:text-primary-300 underline underline-offset-2 transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Terms of Service
                    </a>
                  </span>
                </label>

                <label className="flex items-start gap-2 sm:gap-3 cursor-pointer group select-none">
                  <div className="relative flex-shrink-0 mt-0.5">
                    <input
                      type="checkbox"
                      checked={agreedToPrivacy}
                      onChange={(e) => setAgreedToPrivacy(e.target.checked)}
                      className="peer sr-only"
                      disabled={loading || duplicateCheckLoading}
                    />
                    <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-gray-600 rounded bg-gray-800/50 peer-checked:bg-gradient-to-br peer-checked:from-primary-500 peer-checked:to-purple-600 peer-checked:border-primary-500 transition-all duration-300 flex items-center justify-center group-hover:border-primary-500/50 peer-disabled:opacity-50 peer-disabled:cursor-not-allowed">
                      <svg 
                        className={`w-2.5 h-2.5 sm:w-3 sm:h-3 text-white transition-all duration-300 ${agreedToPrivacy ? 'scale-100 opacity-100' : 'scale-0 opacity-0'}`}
                        fill="none" 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth="3" 
                        viewBox="0 0 24 24" 
                        stroke="currentColor"
                      >
                        <path d="M5 13l4 4L19 7"></path>
                      </svg>
                    </div>
                  </div>
                  <span className="text-xs sm:text-sm text-gray-300 group-hover:text-gray-200 transition-colors">
                    I agree to the{' '}
                    <a 
                      href="/privacy-policy" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary-400 hover:text-primary-300 underline underline-offset-2 transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Privacy Policy
                    </a>
                  </span>
                </label>
              </div>

              <div className="bg-gradient-to-r from-green-900/30 to-emerald-900/30 border border-green-700/30 rounded-lg sm:rounded-xl p-3 sm:p-4 backdrop-blur-xl">
                <div className="flex items-start gap-2 sm:gap-3">
                  <div className="h-5 w-5 sm:h-6 sm:w-6 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-lg">
                    <CheckCircle size={12} className="sm:w-[14px] sm:h-[14px] text-white" />
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm text-green-100 font-semibold">Instant Account Activation</p>
                    <p className="text-[10px] sm:text-xs text-green-200/80 mt-0.5 sm:mt-1">
                      Student accounts are automatically approved. Sign in immediately after verification!
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={handleFormSubmit}
                disabled={loading || duplicateCheckLoading || !captchaLoaded || !agreedToTerms || !agreedToPrivacy}
                className="w-full bg-gradient-to-r from-primary-600 via-purple-600 to-primary-600 hover:from-primary-700 hover:via-purple-700 hover:to-primary-700 disabled:from-gray-700 disabled:to-gray-800 disabled:cursor-not-allowed text-white py-3 sm:py-4 rounded-lg sm:rounded-xl transition-all duration-300 active:scale-95 flex items-center justify-center gap-2 font-semibold shadow-2xl hover:shadow-primary-500/50 text-sm sm:text-base"
              >
                {(loading || duplicateCheckLoading) && <Loader size={18} className="sm:w-5 sm:h-5 animate-spin" />}
                <span>
                  {duplicateCheckLoading ? 'Checking...' : loading ? 'Validating...' : !captchaLoaded ? 'Loading Security...' : 'Continue to Verification'}
                </span>
              </button>
            </div>

            <div className="mt-4 sm:mt-6 text-center pb-safe">
              <p className="text-xs sm:text-sm text-gray-400">
                Already have an account?{' '}
                <button 
                  onClick={() => {
                    if (onSwitchToSignIn) {
                      onSwitchToSignIn();
                    } else {
                      onClose();
                    }
                  }}
                  className="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-purple-500 hover:from-primary-300 hover:to-purple-400 transition-all duration-200 font-medium"
                >
                  Sign in instead
                </button>
              </p>
            </div>
          </div>

          {/* Floating Notification for Mobile */}
          {floatingNotification && (
            <div className="fixed top-4 left-4 right-4 z-[90] sm:hidden animate-pulse">
              <div className="bg-red-500/95 backdrop-blur-md border border-red-400/50 text-white px-4 py-3 rounded-xl shadow-2xl transform transition-all duration-300 animate-bounce">
                <div className="flex items-start gap-3">
                  <AlertCircle className="flex-shrink-0 mt-0.5" size={18} />
                  <p className="text-sm font-medium flex-1">{floatingNotification}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
};

export default RegisterModal;
