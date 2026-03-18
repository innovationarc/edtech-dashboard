// src/components/auth/ForgotPasswordModal.tsx
import { useState, useEffect } from 'react';
import { X, Lock, Loader, Shield, AlertCircle, CheckCircle, Eye, EyeOff, CreditCard } from 'lucide-react';
import { authService, validatePasswordStrength } from '../../services/authService';
import { otpService } from '../../services/otpService';
import { useRecaptcha } from '../../hooks/useRecaptcha';

interface ForgotPasswordModalProps {
  onClose: () => void;
  onSuccess?: () => void;
  onSwitchToForgotUserId?: () => void;
}

const ForgotPasswordModal = ({ onClose, onSuccess, onSwitchToForgotUserId }: ForgotPasswordModalProps) => {
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
  const { executeRecaptcha } = useRecaptcha();
  const [captchaReady, setCaptchaReady] = useState(false);

  // Password strength state
  const [passwordStrength, setPasswordStrength] = useState<{
    strength: 'weak' | 'medium' | 'strong' | 'very-strong';
    issues: string[];
  }>({ strength: 'weak', issues: [] });

  // Poll until grecaptcha is ready (script loaded globally in App.tsx)
  useEffect(() => {
    if (window.grecaptcha) { setCaptchaReady(true); return; }
    const interval = setInterval(() => {
      if (window.grecaptcha) { setCaptchaReady(true); clearInterval(interval); }
    }, 200);
    return () => clearInterval(interval);
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
    if (loading || !captchaReady) return false;
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

    // Get reCAPTCHA token
    try {
      await executeRecaptcha('forgot_password');
    } catch (err) {
      setError('Verification failed. Please try again.');
      setLoading(false);
      return;
    }

    try {
      // Step 1: Identify user and get phone number using user-search API
      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 
                         import.meta.env.VITE_API_URL ||
                         'https://edtech-dashboard-alpha.vercel.app';
      const MASTER_API_KEY = import.meta.env.VITE_SMS_MASTER_KEY;

      const requestBody: any = {
        loginId: userId,
        purpose: 'password-reset'
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
        const errorData = await response.json().catch(() => ({ error: 'Server error' }));
        
        if (response.status === 404) {
          setError('No account found with this User ID.');
        } else {
          setError(errorData.error || 'Something went wrong. Please try again.');
        }
        setLoading(false);
        return;
      }

      const result = await response.json();
      
      if (result.success && result.phoneNumber) {
        setPhoneNumber(result.phoneNumber);
        
        // Step 2: Send OTP using otpService with 'password-reset' purpose
        const otpResult = await otpService.sendOTP(result.phoneNumber, 'password-reset');
        
        if (otpResult.success) {
          setSuccess(otpResult.message);
          setCurrentStep('otp');
          startResendTimer();
        } else {
          setError(otpResult.message);
        }
      } else {
        setError(result.message || 'No account found with this User ID.');
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
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
      const nextInput = document.getElementById(`reset-otp-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handleOTPKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      const prevInput = document.getElementById(`reset-otp-${index - 1}`);
      prevInput?.focus();
    }
  };

  const handleOTPPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const newOTP = [...otp];
    
    for (let i = 0; i < pastedData.length; i++) {
      newOTP[i] = pastedData[i];
    }
    
    setOtp(newOTP);
    
    if (pastedData.length === 6) {
      const lastInput = document.getElementById(`reset-otp-5`);
      lastInput?.focus();
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOTP = async () => {
    setError('');
    setSuccess('');
    setLoading(true);

    const otpCode = otp.join('');
    if (otpCode.length !== 6) {
      setError('Please enter the complete 6-digit OTP');
      setLoading(false);
      return;
    }

    try {
      const result = await otpService.verifyOTP(phoneNumber, otpCode, 'password-reset');
      
      if (result.success) {
        setSuccess('Phone verified! Set your new password');
        setCurrentStep('reset');
      } else {
        setError(result.message);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to verify OTP');
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
      const result = await otpService.sendOTP(phoneNumber, 'password-reset');
      
      if (result.success) {
        setSuccess(result.message);
        startResendTimer();
      } else {
        setError(result.message);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to resend OTP');
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Reset Password
  const handleResetPassword = async () => {
    setError('');
    setSuccess('');
    setLoading(true);

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

    const validation = validatePasswordStrength(newPassword);
    if (!validation.isStrong) {
      setError('Password must include uppercase, lowercase, number, and special character (min 8 chars)');
      setLoading(false);
      return;
    }

    try {
      await authService.resetPassword(phoneNumber, newPassword);
      setSuccess('Password reset successfully!');
      setCurrentStep('success');
      
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  // Success Screen
  if (currentStep === 'success') {
    return (
      <div data-fpm="" className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-3 md:p-4">
        <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl md:rounded-3xl w-full max-w-[95%] sm:max-w-md p-4 sm:p-6 md:p-8 relative shadow-2xl border border-gray-700/50">
          <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 via-emerald-500/5 to-green-500/10 rounded-2xl md:rounded-3xl"></div>
          
          <div className="relative text-center">
            <div className="flex justify-center mb-4 md:mb-6">
              <div className="relative">
                <div className="absolute inset-0 bg-green-500/30 blur-2xl"></div>
                <div className="relative bg-gradient-to-br from-green-500 to-emerald-600 rounded-full p-3 md:p-4 shadow-2xl shadow-green-500/50">
                  <CheckCircle size={32} className="md:w-12 md:h-12" style={{color:"#ffffff"}} />
                </div>
              </div>
            </div>

            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 via-emerald-400 to-green-500 mb-2 px-2">
              Password Reset!
            </h2>
            <p className="text-xs sm:text-sm mb-4 md:mb-6 px-2" style={{color:"#9ca3af"}}>
              Your password has been successfully reset.<br />
              You can now sign in with your new password.
            </p>

            <div className="bg-green-900/40 border border-green-700/50 text-green-200 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl backdrop-blur-sm">
              <p className="text-xs sm:text-sm flex items-center justify-center gap-2">
                <CheckCircle size={14} className="sm:w-4 sm:h-4" />
                {success}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Reset Password Screen
  if (currentStep === 'reset') {
    const strengthColors = {
      weak: 'bg-red-500',
      medium: 'bg-yellow-500',
      strong: 'bg-blue-500',
      'very-strong': 'bg-green-500'
    };

    const strengthWidths = {
      weak: 'w-1/4',
      medium: 'w-1/2',
      strong: 'w-3/4',
      'very-strong': 'w-full'
    };

    return (
      <div data-fpm="" className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-3 md:p-4">
        <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl md:rounded-3xl w-full max-w-[95%] sm:max-w-md p-4 sm:p-6 md:p-8 relative shadow-2xl border border-gray-700/50 max-h-[90vh] overflow-y-auto">
          <div className="absolute inset-0 bg-gradient-to-br from-primary-500/10 via-purple-500/5 to-primary-500/10 rounded-2xl md:rounded-3xl"></div>
          
          <button
            onClick={() => setCurrentStep('otp')}
            className="absolute left-3 top-3 md:left-4 md:top-4 text-gray-400 hover:text-white transition-all duration-200 hover:scale-110 z-10"
          >
            <X size={20} className="md:w-6 md:h-6" />
          </button>

          <div className="relative">
            <div className="flex justify-center mb-4 md:mb-6">
              <div className="relative">
                <div className="absolute inset-0 bg-primary-500/30 blur-2xl"></div>
                <div className="relative bg-gradient-to-br from-primary-500 to-purple-600 rounded-full p-3 md:p-4 shadow-2xl shadow-primary-500/50">
                  <Lock size={32} className="md:w-12 md:h-12" style={{color:"#ffffff"}} />
                </div>
              </div>
            </div>

            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary-400 via-purple-400 to-primary-500 mb-2 text-center px-2">
              Set New Password
            </h2>
            <p className="text-xs sm:text-sm mb-4 md:mb-6 text-center px-2" style={{color:"#9ca3af"}}>
              Create a strong, secure password
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
                <label className="block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2" style={{color:"#d1d5db"}}>New Password</label>
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
                    className="absolute right-2.5 sm:right-3 top-2.5 sm:top-3 text-gray-400 hover:text-white transition-colors"
                    disabled={loading}
                  >
                    {showNewPassword ? <EyeOff size={16} className="sm:w-[18px] sm:h-[18px]" /> : <Eye size={16} className="sm:w-[18px] sm:h-[18px]" />}
                  </button>
                </div>

                {newPassword && (
                  <div className="mt-2 sm:mt-3">
                    <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                      <span className="text-[10px] sm:text-xs text-gray-400">Password Strength</span>
                      <span style={{color: (
                        passwordStrength.strength === 'very-strong' ? '#22c55e' :
                        passwordStrength.strength === 'strong' ? '#60a5fa' :
                        passwordStrength.strength === 'medium' ? '#facc15' :
                        '#f87171'
                      ), fontSize: "0.7rem", fontWeight: 600}}>
                        {passwordStrength.strength === 'very-strong' ? 'Very Strong' :
                         passwordStrength.strength === 'strong' ? 'Strong' :
                         passwordStrength.strength === 'medium' ? 'Medium' : 'Weak'}
                      </span>
                    </div>
                    <div className="h-1.5 sm:h-2 bg-gray-700/50 rounded-full overflow-hidden">
                      <div className={`h-full ${strengthColors[passwordStrength.strength]} ${strengthWidths[passwordStrength.strength]} transition-all duration-300`}></div>
                    </div>
                    {passwordStrength.issues.length > 0 && (
                      <ul className="mt-1.5 sm:mt-2 text-[10px] sm:text-xs text-gray-400 space-y-0.5 sm:space-y-1">
                        {passwordStrength.issues.map((issue, idx) => (
                          <li key={idx} className="flex items-center gap-1">
                            <span className="text-red-400">•</span>
                            {issue}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>

              <div className="group">
                <label className="block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2" style={{color:"#d1d5db"}}>Confirm Password</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-gray-800/60 backdrop-blur-xl text-white rounded-lg sm:rounded-xl py-2.5 sm:py-3 pl-9 sm:pl-11 pr-9 sm:pr-11 border border-gray-700/50 focus:border-primary-500/50 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all duration-200 group-hover:border-gray-600 text-sm sm:text-base"
                    placeholder="Confirm new password"
                    disabled={loading}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !loading) {
                        handleResetPassword();
                      }
                    }}
                  />
                  <Lock size={16} className="sm:w-[18px] sm:h-[18px] absolute left-2.5 sm:left-3.5 top-2.5 sm:top-3.5 text-gray-400 group-hover:text-primary-400 transition-colors" />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-2.5 sm:right-3 top-2.5 sm:top-3 text-gray-400 hover:text-white transition-colors"
                    disabled={loading}
                  >
                    {showConfirmPassword ? <EyeOff size={16} className="sm:w-[18px] sm:h-[18px]" /> : <Eye size={16} className="sm:w-[18px] sm:h-[18px]" />}
                  </button>
                </div>
              </div>

              <button
                onClick={handleResetPassword}
                disabled={loading}
                className="w-full bg-gradient-to-r from-primary-600 via-purple-600 to-primary-600 hover:from-primary-700 hover:via-purple-700 hover:to-primary-700 disabled:from-gray-700 disabled:to-gray-800 disabled:cursor-not-allowed text-white py-3 sm:py-4 rounded-lg sm:rounded-xl transition-all duration-300 active:scale-95 flex items-center justify-center gap-2 font-semibold shadow-2xl hover:shadow-primary-500/50 text-sm sm:text-base"
              >
                {loading && <Loader size={18} className="sm:w-5 sm:h-5 animate-spin" />}
                <span>{loading ? 'Resetting...' : 'Reset Password'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // OTP Verification Screen
  if (currentStep === 'otp') {
    return (
      <div data-fpm="" className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-3 md:p-4">
        <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl md:rounded-3xl w-full max-w-[95%] sm:max-w-md p-4 sm:p-6 md:p-8 relative shadow-2xl border border-gray-700/50">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-purple-500/5 to-blue-500/10 rounded-2xl md:rounded-3xl"></div>
          
          <button
            onClick={() => setCurrentStep('identify')}
            className="absolute left-3 top-3 md:left-4 md:top-4 text-gray-400 hover:text-white transition-all duration-200 hover:scale-110 z-10"
          >
            <X size={20} className="md:w-6 md:h-6" />
          </button>

          <div className="relative text-center">
            <div className="flex justify-center mb-4 md:mb-6">
              <div className="relative">
                <div className="absolute inset-0 bg-blue-500/30 blur-2xl"></div>
                <div className="relative bg-gradient-to-br from-blue-500 to-purple-600 rounded-full p-3 md:p-4 shadow-2xl shadow-blue-500/50">
                  <Shield size={32} className="md:w-12 md:h-12" style={{color:"#ffffff"}} />
                </div>
              </div>
            </div>

            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-blue-500 mb-2 px-2">
              Verify Your Phone
            </h2>
            <p className="text-xs sm:text-sm mb-4 md:mb-6 px-2" style={{color:"#9ca3af"}}>
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

            <div className="text-xs sm:text-sm" style={{color:"#9ca3af"}}>
              {canResendOTP ? (
                <button
                  onClick={handleResendOTP}
                  disabled={loading}
                  className="text-primary-400 hover:text-primary-300 font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Resend OTP
                </button>
              ) : (
                <span>Resend OTP in <span className="font-semibold" style={{color:"#ffffff"}}>{resendTimer}s</span></span>
              )}
            </div>

            <div className="mt-4 sm:mt-6 bg-gray-800/40 backdrop-blur-xl rounded-lg sm:rounded-xl p-3 sm:p-4 border border-gray-700/30">
              <p className="text-[10px] sm:text-xs flex items-center justify-center gap-1.5 sm:gap-2" style={{color:"#9ca3af"}}>
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
    <div data-fpm="" className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-3 md:p-4">
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
                <Lock size={32} className="md:w-12 md:h-12" style={{color:"#ffffff"}} />
              </div>
            </div>
          </div>

          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary-400 via-purple-400 to-primary-500 mb-2 text-center px-2">
            Reset Password
          </h2>
          <p className="text-xs sm:text-sm mb-4 md:mb-6 text-center px-2" style={{color:"#9ca3af"}}>
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
              <label className="block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2" style={{color:"#d1d5db"}}>User ID</label>
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
                  onClick={() => {
                    if (onSwitchToForgotUserId) {
                      onSwitchToForgotUserId();
                    } else {
                      onClose();
                    }
                  }}
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
              <span>{loading ? 'Processing...' : !captchaReady ? 'Loading Security...' : 'Continue'}</span>
            </button>
          </div>

          <div className="mt-4 sm:mt-6 text-center">
            <button 
              onClick={onClose}
              className="text-xs sm:text-sm transition-colors duration-200" style={{color:"#9ca3af"}}
            >
              Back to Sign In
            </button>
          </div>

          {captchaReady && (
            <div className="mt-3 sm:mt-4 md:mt-5 flex items-center justify-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs" style={{color:"#6b7280"}}>
              <Shield size={12} className="sm:w-[14px] sm:h-[14px]" style={{color:"#22c55e"}} />
              <span>Protected by reCAPTCHA</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordModal;
