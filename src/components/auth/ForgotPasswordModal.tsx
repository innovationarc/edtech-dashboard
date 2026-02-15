// src/components/auth/ForgotPasswordModal.tsx
import { useState, useEffect } from 'react';
import { X, Lock, Loader, Shield, AlertCircle, CheckCircle, Eye, EyeOff, CreditCard } from 'lucide-react';
import { authService, validatePasswordStrength } from '../../services/authService';
import { otpService } from '../../services/otpService';
import ForgotUserIdModal from './ForgotUserIdModal';

interface ForgotPasswordModalProps {
  onClose: () => void;
  onSuccess?: () => void;
}

const ForgotPasswordModal = ({ onClose, onSuccess }: ForgotPasswordModalProps) => {
  const [currentStep, setCurrentStep] = useState<'identify' | 'otp' | 'reset' | 'success'>('identify');
  const [userId, setUserId] = useState('');
  const [displayUserId, setDisplayUserId] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [canResendOTP, setCanResendOTP] = useState(false);
  const [resendTimer, setResendTimer] = useState(60);
  const [captchaLoaded, setCaptchaLoaded] = useState(false);
  const [showForgotUserId, setShowForgotUserId] = useState(false);

  // Password strength state
  const [passwordStrength, setPasswordStrength] = useState<{
    strength: 'weak' | 'medium' | 'strong' | 'very-strong';
    issues: string[];
  }>({ strength: 'weak', issues: [] });

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
      script.onerror = () => {
        console.error('Failed to load reCAPTCHA');
        setCaptchaLoaded(false);
      };
      document.head.appendChild(script);
    };

    loadRecaptcha();
  }, []);

  // Password strength checker
  useEffect(() => {
    if (newPassword) {
      const validation = validatePasswordStrength(newPassword);
      setPasswordStrength({
        strength: validation.strength,
        issues: validation.issues
      });
    } else {
      setPasswordStrength({ strength: 'weak', issues: [] });
    }
  }, [newPassword]);

  // Get reCAPTCHA v3 token
  const getCaptchaToken = async (): Promise<string | null> => {
    return new Promise((resolve) => {
      if (!window.grecaptcha || !captchaLoaded) {
        resolve(null);
        return;
      }

      try {
        window.grecaptcha.ready(() => {
          window.grecaptcha
            .execute(import.meta.env.VITE_RECAPTCHA_SITE_KEY || '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI', { action: 'forgot_password' })
            .then(resolve)
            .catch(() => resolve(null));
        });
      } catch {
        resolve(null);
      }
    });
  };

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

  // Format User ID input with auto-formatting: XX-YYMM-XXXXX
  const formatUserIdInput = (input: string): { display: string; value: string; isComplete: boolean } => {
    // Remove all non-alphanumeric characters
    const cleaned = input.replace(/[^a-zA-Z0-9]/g, '');
    
    // Extract parts
    let prefix = '';
    let yearMonth = '';
    let sequence = '';
    
    // Get prefix (first 2 letters, convert to uppercase)
    if (cleaned.length >= 1) {
      prefix = cleaned.substring(0, 2).toUpperCase().replace(/[^A-Z]/g, '');
    }
    
    // Get year-month (next 4 digits)
    if (cleaned.length > 2) {
      const remaining = cleaned.substring(prefix.length);
      yearMonth = remaining.substring(0, 4).replace(/[^0-9]/g, '');
    }
    
    // Get sequence (last 5 digits)
    if (cleaned.length > 6) {
      const remaining = cleaned.substring(prefix.length + yearMonth.length);
      sequence = remaining.substring(0, 5).replace(/[^0-9]/g, '');
    }
    
    // Build display value with hyphens
    let display = prefix;
    if (yearMonth) {
      display += '-' + yearMonth;
    }
    if (sequence) {
      display += '-' + sequence;
    }
    
    // Build actual value (for submission)
    const value = prefix + (yearMonth ? '-' + yearMonth : '') + (sequence ? '-' + sequence : '');
    
    // Check if complete: XX-YYYY-XXXXX (2 letters, 4 digits, 5 digits)
    const isComplete = prefix.length === 2 && yearMonth.length === 4 && sequence.length === 5;
    
    return { display, value, isComplete };
  };

  // Handle User ID input change
  const handleUserIdChange = (input: string) => {
    const formatted = formatUserIdInput(input);
    setDisplayUserId(formatted.display);
    setUserId(formatted.value);
    
    // Clear errors on input change
    if (error) {
      setError('');
    }
  };

  // Validate User ID format
  const validateUserId = (id: string): boolean => {
    // Pattern: XX-YYMM-XXXXX (2 letters, 4 digits, 5 digits)
    const userIdPattern = /^[A-Z]{2}-\d{4}-\d{5}$/;
    return userIdPattern.test(id);
  };

  // Check if Continue button should be enabled
  const isContinueEnabled = (): boolean => {
    if (loading || !captchaLoaded) return false;
    return validateUserId(userId);
  };

  // Step 1: Identify user by User ID only
  const handleIdentifyUser = async () => {
    setError('');
    setSuccess('');
    setLoading(true);

    // Validate User ID format
    if (!validateUserId(userId)) {
      setError('Please enter a valid User ID (e.g., ST-2601-00001).');
      setLoading(false);
      return;
    }

    try {
      const captchaToken = await getCaptchaToken();
      if (!captchaToken) {
        setError('Security verification failed. Please try again.');
        setLoading(false);
        return;
      }

      const response = await authService.initiatePasswordReset(userId, captchaToken);
      
      if (response.success) {
        setPhoneNumber(response.phoneNumber || '');
        startResendTimer();
        setCurrentStep('otp');
        setSuccess('OTP sent successfully!');
      } else {
        setError(response.message || 'Failed to send OTP. Please try again.');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle OTP input
  const handleOTPChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    if (value && index < 5) {
      const nextInput = document.getElementById(`reset-otp-${index + 1}`);
      nextInput?.focus();
    }

    if (error) setError('');
  };

  const handleOTPKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      const prevInput = document.getElementById(`reset-otp-${index - 1}`);
      prevInput?.focus();
    }
  };

  const handleOTPPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const newOtp = pastedData.split('').concat(Array(6).fill('')).slice(0, 6);
    setOtp(newOtp);

    const lastFilledIndex = Math.min(pastedData.length, 5);
    const nextInput = document.getElementById(`reset-otp-${lastFilledIndex}`);
    nextInput?.focus();
  };

  // Step 2: Verify OTP
  const handleVerifyOTP = async () => {
    setError('');
    setSuccess('');
    setLoading(true);

    const otpCode = otp.join('');
    if (otpCode.length !== 6) {
      setError('Please enter a valid 6-digit OTP');
      setLoading(false);
      return;
    }

    try {
      const response = await otpService.verifyOTP(userId, otpCode, 'password_reset');
      
      if (response.success) {
        setSuccess('OTP verified successfully!');
        setTimeout(() => {
          setCurrentStep('reset');
          setSuccess('');
        }, 500);
      } else {
        setError(response.message || 'Invalid OTP. Please try again.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to verify OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const handleResendOTP = async () => {
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const captchaToken = await getCaptchaToken();
      if (!captchaToken) {
        setError('Security verification failed. Please try again.');
        setLoading(false);
        return;
      }

      const response = await authService.initiatePasswordReset(userId, captchaToken);
      
      if (response.success) {
        setSuccess('OTP resent successfully!');
        startResendTimer();
        setOtp(['', '', '', '', '', '']);
        const firstInput = document.getElementById('reset-otp-0');
        firstInput?.focus();
      } else {
        setError(response.message || 'Failed to resend OTP. Please try again.');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Reset Password
  const handleResetPassword = async () => {
    setError('');
    setSuccess('');
    setLoading(true);

    // Validate passwords
    if (!newPassword || !confirmPassword) {
      setError('Please fill in all fields');
      setLoading(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (passwordStrength.strength === 'weak') {
      setError('Password is too weak. Please use a stronger password.');
      setLoading(false);
      return;
    }

    try {
      const response = await authService.resetPassword(userId, newPassword);
      
      if (response.success) {
        setSuccess('Password reset successfully!');
        setCurrentStep('success');
      } else {
        setError(response.message || 'Failed to reset password. Please try again.');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // If ForgotUserIdModal should be shown
  if (showForgotUserId) {
    return <ForgotUserIdModal onClose={() => setShowForgotUserId(false)} />;
  }

  // Success Screen
  if (currentStep === 'success') {
    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-3 md:p-4">
        <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl md:rounded-3xl w-full max-w-[95%] sm:max-w-md p-4 sm:p-6 md:p-8 relative shadow-2xl border border-gray-700/50">
          <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-emerald-500/5 rounded-2xl md:rounded-3xl"></div>
          
          <button
            onClick={onClose}
            className="absolute right-3 top-3 md:right-4 md:top-4 text-gray-400 hover:text-white transition-all duration-200 hover:rotate-90 hover:scale-110 z-10"
          >
            <X size={20} className="md:w-6 md:h-6" />
          </button>

          <div className="relative text-center">
            <div className="flex justify-center mb-4 md:mb-6">
              <div className="relative">
                <div className="absolute inset-0 bg-green-500/30 blur-2xl animate-pulse"></div>
                <div className="relative bg-gradient-to-br from-green-500 to-emerald-600 rounded-full p-3 md:p-4 shadow-2xl shadow-green-500/50">
                  <CheckCircle size={32} className="md:w-12 md:h-12 text-white" />
                </div>
              </div>
            </div>

            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 via-emerald-400 to-green-500 mb-2 px-2">
              Password Reset Successful!
            </h2>
            <p className="text-gray-400 text-xs sm:text-sm mb-4 md:mb-6 px-2">
              Your password has been reset successfully. You can now sign in with your new password.
            </p>

            <div className="bg-green-900/20 border border-green-700/30 rounded-xl p-3 sm:p-4 mb-4 md:mb-6">
              <p className="text-xs sm:text-sm text-green-200">
                Please remember your new password and keep it secure.
              </p>
            </div>

            <button
              onClick={() => {
                if (onSuccess) onSuccess();
                onClose();
              }}
              className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white py-3 sm:py-4 rounded-lg sm:rounded-xl transition-all duration-300 active:scale-95 flex items-center justify-center gap-2 font-semibold shadow-2xl hover:shadow-green-500/50 text-sm sm:text-base"
            >
              <span>Back to Sign In</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Reset Password Screen
  if (currentStep === 'reset') {
    const strengthColors = {
      'weak': 'bg-red-500',
      'medium': 'bg-yellow-500',
      'strong': 'bg-blue-500',
      'very-strong': 'bg-green-500'
    };

    const strengthLabels = {
      'weak': 'Weak',
      'medium': 'Medium',
      'strong': 'Strong',
      'very-strong': 'Very Strong'
    };

    const strengthWidth = {
      'weak': 'w-1/4',
      'medium': 'w-2/4',
      'strong': 'w-3/4',
      'very-strong': 'w-full'
    };

    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-3 md:p-4">
        <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl md:rounded-3xl w-full max-w-[95%] sm:max-w-md p-4 sm:p-6 md:p-8 relative shadow-2xl border border-gray-700/50 max-h-[95vh] overflow-y-auto">
          <div className="absolute inset-0 bg-gradient-to-br from-primary-500/5 to-purple-500/5 rounded-2xl md:rounded-3xl pointer-events-none"></div>
          
          <button
            onClick={onClose}
            className="absolute right-3 top-3 md:right-4 md:top-4 text-gray-400 hover:text-white transition-all duration-200 hover:rotate-90 hover:scale-110 z-10"
          >
            <X size={20} className="md:w-6 md:h-6" />
          </button>

          <div className="relative">
            <div className="flex justify-center mb-4 md:mb-6">
              <div className="relative">
                <div className="absolute inset-0 bg-primary-500/30 blur-2xl"></div>
                <div className="relative bg-gradient-to-br from-primary-500 to-purple-600 rounded-full p-3 md:p-4 shadow-2xl shadow-primary-500/50">
                  <Lock size={32} className="md:w-12 md:h-12 text-white" />
                </div>
              </div>
            </div>

            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary-400 via-purple-400 to-primary-500 mb-2 text-center px-2">
              Create New Password
            </h2>
            <p className="text-gray-400 text-xs sm:text-sm mb-4 md:mb-6 text-center px-2">
              Enter your new password below
            </p>

            {error && (
              <div className="bg-red-900/40 border border-red-700/50 text-red-200 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl mb-4 md:mb-6 backdrop-blur-sm">
                <p className="text-xs sm:text-sm flex items-center gap-2">
                  <AlertCircle size={14} className="sm:w-4 sm:h-4" />
                  {error}
                </p>
              </div>
            )}

            <div className="space-y-3 sm:space-y-4">
              {/* New Password */}
              <div className="group">
                <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1.5 sm:mb-2">New Password</label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-gray-800/60 backdrop-blur-xl text-white rounded-lg sm:rounded-xl py-2.5 sm:py-3 pl-9 sm:pl-11 pr-9 sm:pr-11 border border-gray-700/50 focus:border-primary-500/50 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all duration-200 group-hover:border-gray-600 text-sm sm:text-base"
                    placeholder="Enter new password"
                    disabled={loading}
                  />
                  <Lock size={16} className="sm:w-[18px] sm:h-[18px] absolute left-2.5 sm:left-3.5 top-2.5 sm:top-3.5 text-gray-400 group-hover:text-primary-400 transition-colors" />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-2.5 sm:right-3.5 top-2.5 sm:top-3.5 text-gray-400 hover:text-white transition-colors"
                    disabled={loading}
                  >
                    {showNewPassword ? <EyeOff size={16} className="sm:w-[18px] sm:h-[18px]" /> : <Eye size={16} className="sm:w-[18px] sm:h-[18px]" />}
                  </button>
                </div>

                {/* Password Strength Indicator */}
                {newPassword && (
                  <div className="mt-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] sm:text-xs text-gray-400">Password Strength</span>
                      <span className={`text-[10px] sm:text-xs font-medium ${
                        passwordStrength.strength === 'weak' ? 'text-red-400' :
                        passwordStrength.strength === 'medium' ? 'text-yellow-400' :
                        passwordStrength.strength === 'strong' ? 'text-blue-400' :
                        'text-green-400'
                      }`}>
                        {strengthLabels[passwordStrength.strength]}
                      </span>
                    </div>
                    <div className="w-full bg-gray-700/50 rounded-full h-1.5 sm:h-2 overflow-hidden">
                      <div className={`h-full ${strengthColors[passwordStrength.strength]} ${strengthWidth[passwordStrength.strength]} transition-all duration-300`}></div>
                    </div>
                    {passwordStrength.issues.length > 0 && (
                      <div className="mt-1.5 sm:mt-2 space-y-0.5 sm:space-y-1">
                        {passwordStrength.issues.map((issue, index) => (
                          <p key={index} className="text-[10px] sm:text-xs text-red-400 flex items-center gap-1">
                            <span className="w-1 h-1 bg-red-400 rounded-full"></span>
                            {issue}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div className="group">
                <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1.5 sm:mb-2">Confirm Password</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-gray-800/60 backdrop-blur-xl text-white rounded-lg sm:rounded-xl py-2.5 sm:py-3 pl-9 sm:pl-11 pr-9 sm:pr-11 border border-gray-700/50 focus:border-primary-500/50 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all duration-200 group-hover:border-gray-600 text-sm sm:text-base"
                    placeholder="Confirm new password"
                    disabled={loading}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newPassword && confirmPassword) {
                        handleResetPassword();
                      }
                    }}
                  />
                  <Lock size={16} className="sm:w-[18px] sm:h-[18px] absolute left-2.5 sm:left-3.5 top-2.5 sm:top-3.5 text-gray-400 group-hover:text-primary-400 transition-colors" />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-2.5 sm:right-3.5 top-2.5 sm:top-3.5 text-gray-400 hover:text-white transition-colors"
                    disabled={loading}
                  >
                    {showConfirmPassword ? <EyeOff size={16} className="sm:w-[18px] sm:h-[18px]" /> : <Eye size={16} className="sm:w-[18px] sm:h-[18px]" />}
                  </button>
                </div>
                {confirmPassword && newPassword !== confirmPassword && (
                  <p className="text-[10px] sm:text-xs text-red-400 mt-1 sm:mt-1.5">Passwords do not match</p>
                )}
              </div>

              <button
                onClick={handleResetPassword}
                disabled={loading || !newPassword || !confirmPassword || newPassword !== confirmPassword || passwordStrength.strength === 'weak'}
                className="w-full bg-gradient-to-r from-primary-600 via-purple-600 to-primary-600 hover:from-primary-700 hover:via-purple-700 hover:to-primary-700 disabled:from-gray-700 disabled:to-gray-800 disabled:cursor-not-allowed text-white py-3 sm:py-4 rounded-lg sm:rounded-xl transition-all duration-300 active:scale-95 flex items-center justify-center gap-2 font-semibold shadow-2xl hover:shadow-primary-500/50 text-sm sm:text-base"
              >
                {loading && <Loader size={18} className="sm:w-5 sm:h-5 animate-spin" />}
                <span>{loading ? 'Resetting Password...' : 'Reset Password'}</span>
              </button>
            </div>

            <div className="mt-4 sm:mt-6 bg-gray-800/40 backdrop-blur-xl rounded-lg sm:rounded-xl p-3 sm:p-4 border border-gray-700/30">
              <p className="text-[10px] sm:text-xs text-gray-400">
                <strong className="text-white">Password Requirements:</strong><br />
                • At least 8 characters long<br />
                • Include uppercase and lowercase letters<br />
                • Include at least one number<br />
                • Include at least one special character
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // OTP Verification Screen
  if (currentStep === 'otp') {
    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-3 md:p-4">
        <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl md:rounded-3xl w-full max-w-[95%] sm:max-w-md p-4 sm:p-6 md:p-8 relative shadow-2xl border border-gray-700/50">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 rounded-2xl md:rounded-3xl"></div>
          
          <button
            onClick={onClose}
            className="absolute right-3 top-3 md:right-4 md:top-4 text-gray-400 hover:text-white transition-all duration-200 hover:rotate-90 hover:scale-110 z-10"
          >
            <X size={20} className="md:w-6 md:h-6" />
          </button>

          <div className="relative text-center">
            <div className="flex justify-center mb-4 md:mb-6">
              <div className="relative">
                <div className="absolute inset-0 bg-blue-500/30 blur-2xl"></div>
                <div className="relative bg-gradient-to-br from-blue-500 to-purple-600 rounded-full p-3 md:p-4 shadow-2xl shadow-blue-500/50">
                  <Shield size={32} className="md:w-12 md:h-12 text-white" />
                </div>
              </div>
            </div>

            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-blue-500 mb-2 px-2">
              Verify Your Phone
            </h2>
            <p className="text-gray-400 text-xs sm:text-sm mb-4 md:mb-6 px-2">
              Enter the 6-digit code sent to<br />
              <span className="text-white font-semibold">{phoneNumber}</span>
            </p>

            {error && (
              <div className="bg-red-900/40 border border-red-700/50 text-red-200 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl mb-4 md:mb-6 backdrop-blur-sm">
                <p className="text-xs sm:text-sm flex items-center justify-center gap-2">
                  <AlertCircle size={14} className="sm:w-4 sm:h-4" />
                  {error}
                </p>
              </div>
            )}

            {success && (
              <div className="bg-green-900/40 border border-green-700/50 text-green-200 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl mb-4 md:mb-6 backdrop-blur-sm">
                <p className="text-xs sm:text-sm flex items-center justify-center gap-2">
                  <CheckCircle size={14} className="sm:w-4 sm:h-4" />
                  {success}
                </p>
              </div>
            )}

            <div className="flex gap-2 sm:gap-3 justify-center mb-4 md:mb-6" onPaste={handleOTPPaste}>
              {otp.map((digit, index) => (
                <input
                  key={index}
                  id={`reset-otp-${index}`}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOTPChange(index, e.target.value)}
                  onKeyDown={(e) => handleOTPKeyDown(index, e)}
                  className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 bg-gray-800/60 backdrop-blur-xl text-white text-xl sm:text-2xl font-bold text-center rounded-lg sm:rounded-xl border-2 border-gray-700/50 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30 transition-all duration-200"
                  disabled={loading}
                />
              ))}
            </div>

            <button
              onClick={handleVerifyOTP}
              disabled={loading || otp.join('').length !== 6}
              className="w-full bg-gradient-to-r from-primary-600 via-purple-600 to-primary-600 hover:from-primary-700 hover:via-purple-700 hover:to-primary-700 disabled:from-gray-700 disabled:to-gray-800 disabled:cursor-not-allowed text-white py-3 sm:py-4 rounded-lg sm:rounded-xl transition-all duration-300 active:scale-95 flex items-center justify-center gap-2 font-semibold shadow-2xl hover:shadow-primary-500/50 mb-3 sm:mb-4 text-sm sm:text-base"
            >
              {loading && <Loader size={18} className="sm:w-5 sm:h-5 animate-spin" />}
              <span>{loading ? 'Verifying...' : 'Verify OTP'}</span>
            </button>

            <div className="text-xs sm:text-sm text-gray-400">
              {canResendOTP ? (
                <button
                  onClick={handleResendOTP}
                  disabled={loading}
                  className="text-primary-400 hover:text-primary-300 font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Resend OTP
                </button>
              ) : (
                <span>Resend OTP in <span className="text-white font-semibold">{resendTimer}s</span></span>
              )}
            </div>

            <div className="mt-4 sm:mt-6 bg-gray-800/40 backdrop-blur-xl rounded-lg sm:rounded-xl p-3 sm:p-4 border border-gray-700/30">
              <p className="text-[10px] sm:text-xs text-gray-400 flex items-center justify-center gap-1.5 sm:gap-2">
                <Shield size={12} className="sm:w-[14px] sm:h-[14px]" />
                OTP expires in 2 minutes
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Identify User Screen (User ID only)
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-3 md:p-4">
      <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl md:rounded-3xl w-full max-w-[95%] sm:max-w-md p-4 sm:p-6 md:p-8 relative shadow-2xl border border-gray-700/50">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-500/5 to-purple-500/5 rounded-2xl md:rounded-3xl"></div>
        
        <button
          onClick={onClose}
          className="absolute right-3 top-3 md:right-4 md:top-4 text-gray-400 hover:text-white transition-all duration-200 hover:rotate-90 hover:scale-110 z-10"
        >
          <X size={20} className="md:w-6 md:h-6" />
        </button>

        <div className="relative">
          <div className="flex justify-center mb-4 md:mb-6">
            <div className="relative">
              <div className="absolute inset-0 bg-primary-500/30 blur-2xl"></div>
              <div className="relative bg-gradient-to-br from-primary-500 to-purple-600 rounded-full p-3 md:p-4 shadow-2xl shadow-primary-500/50">
                <Lock size={32} className="md:w-12 md:h-12 text-white" />
              </div>
            </div>
          </div>

          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary-400 via-purple-400 to-primary-500 mb-2 text-center px-2">
            Reset Password
          </h2>
          <p className="text-gray-400 text-xs sm:text-sm mb-4 md:mb-6 text-center px-2">
            Enter your User ID to reset your password
          </p>

          {error && (
            <div className="bg-red-900/40 border border-red-700/50 text-red-200 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl mb-4 md:mb-6 backdrop-blur-sm">
              <p className="text-xs sm:text-sm flex items-center gap-2">
                <AlertCircle size={14} className="sm:w-4 sm:h-4" />
                {error}
              </p>
            </div>
          )}

          <div className="space-y-3 sm:space-y-4 md:space-y-5">
            <div className="group">
              <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1.5 sm:mb-2">User ID</label>
              <div className="relative">
                <input
                  type="text"
                  value={displayUserId}
                  onChange={(e) => handleUserIdChange(e.target.value)}
                  className="w-full bg-gray-800/60 backdrop-blur-xl text-white rounded-lg sm:rounded-xl py-2.5 sm:py-3 pl-9 sm:pl-11 pr-3 sm:pr-4 border border-gray-700/50 focus:border-primary-500/50 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all duration-200 group-hover:border-gray-600 uppercase tracking-wide text-sm sm:text-base"
                  placeholder="ST-2601-00001"
                  disabled={loading}
                  maxLength={13}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && isContinueEnabled()) {
                      handleIdentifyUser();
                    }
                  }}
                />
                <CreditCard size={16} className="sm:w-[18px] sm:h-[18px] absolute left-2.5 sm:left-3.5 top-2.5 sm:top-3.5 text-gray-400 group-hover:text-primary-400 transition-colors" />
              </div>
              <div className="flex items-center justify-between mt-1 sm:mt-1.5">
                <p className="text-[10px] sm:text-xs text-gray-500">Format: XX-YYMM-XXXXX</p>
                <button 
                  type="button"
                  onClick={() => setShowForgotUserId(true)}
                  className="text-[10px] sm:text-xs text-primary-400 hover:text-primary-300 transition-colors duration-200 font-medium hover:underline underline-offset-2"
                  disabled={loading}
                >
                  Forgot User ID?
                </button>
              </div>
            </div>

            <button
              onClick={handleIdentifyUser}
              disabled={!isContinueEnabled()}
              className="w-full bg-gradient-to-r from-primary-600 via-purple-600 to-primary-600 hover:from-primary-700 hover:via-purple-700 hover:to-primary-700 disabled:from-gray-700 disabled:to-gray-800 disabled:cursor-not-allowed text-white py-3 sm:py-4 rounded-lg sm:rounded-xl transition-all duration-300 active:scale-95 flex items-center justify-center gap-2 font-semibold shadow-2xl hover:shadow-primary-500/50 text-sm sm:text-base"
            >
              {loading && <Loader size={18} className="sm:w-5 sm:h-5 animate-spin" />}
              <span>{loading ? 'Processing...' : !captchaLoaded ? 'Loading Security...' : 'Continue'}</span>
            </button>
          </div>

          <div className="mt-4 sm:mt-6 text-center">
            <button 
              onClick={onClose}
              className="text-xs sm:text-sm text-gray-400 hover:text-white transition-colors duration-200"
            >
              Back to Sign In
            </button>
          </div>

          {captchaLoaded && (
            <div className="mt-3 sm:mt-4 md:mt-5 flex items-center justify-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs text-gray-500">
              <Shield size={12} className="sm:w-[14px] sm:h-[14px] text-green-500" />
              <span>Protected by reCAPTCHA</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordModal;
