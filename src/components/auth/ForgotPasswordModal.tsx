// src/components/auth/ForgotPasswordModal.tsx
import { useState, useEffect } from 'react';
import { X, Lock, Loader, Shield, AlertCircle, CheckCircle, Phone, Eye, EyeOff, Smartphone } from 'lucide-react';
import { authService, validatePasswordStrength } from '../../services/authService';
import { otpService } from '../../services/otpService';

interface ForgotPasswordModalProps {
  onClose: () => void;
  onSuccess?: () => void;
}

const ForgotPasswordModal = ({ onClose, onSuccess }: ForgotPasswordModalProps) => {
  const [currentStep, setCurrentStep] = useState<'identify' | 'otp' | 'reset' | 'success'>('identify');
  const [loginId, setLoginId] = useState('');
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
        setCaptchaLoaded(true); // Allow form to work even if reCAPTCHA fails
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

  // Helper function to normalize Student ID format (ST-YYMM-XXXXX)
  const normalizeStudentId = (id: string): string => {
    // Trim whitespace
    id = id.trim();
    
    // Check if it matches the student ID pattern (with prefix)
    const studentIdPattern = /^([sS][tT])-?(\d{4})-?(\d{5})$/;
    const match = id.match(studentIdPattern);
    
    if (match) {
      // Convert prefix to uppercase and format properly
      return `ST-${match[2]}-${match[3]}`;
    }
    
    // Return as-is if not a student ID pattern (could be phone/email)
    return id;
  };

  // Step 1: Identify user
  const handleIdentifyUser = async () => {
    setError('');
    setSuccess('');
    setLoading(true);

    if (!loginId.trim()) {
      setError('Please enter your Student ID, phone number, or email');
      setLoading(false);
      return;
    }

    // Get reCAPTCHA token (optional - don't block if it fails)
    try {
      await getCaptchaToken();
    } catch (err) {
      console.warn('reCAPTCHA verification skipped');
    }

    try {
      // Normalize the loginId (especially for Student IDs)
      const normalizedLoginId = normalizeStudentId(loginId);
      
      const result = await authService.sendPasswordResetOTP(normalizedLoginId);
      
      if (result.success && result.phoneNumber) {
        setPhoneNumber(result.phoneNumber);
        
        // Send OTP using otpService with 'password-reset' purpose
        const otpResult = await otpService.sendOTP(result.phoneNumber, 'password-reset');
        
        if (otpResult.success) {
          setSuccess(otpResult.message);
          setCurrentStep('otp');
          startResendTimer();
        } else {
          setError(otpResult.message);
        }
      } else {
        setError(result.message || 'Account not found');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to process request');
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
      // Use otpService to verify OTP with 'password-reset' purpose
      const result = await otpService.verifyOTP(phoneNumber, otpCode, 'password-reset');
      
      if (result.success) {
        setSuccess(result.message);
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
      // Use otpService to resend OTP with 'password-reset' purpose
      const result = await otpService.sendOTP(phoneNumber, 'password-reset');
      
      if (result.success) {
        setSuccess(result.message);
        setOtp(['', '', '', '', '', '']);
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
      setError('Please fill in all password fields');
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
      setSuccess('Password reset successful! You can now sign in with your new password.');
      setCurrentStep('success');
      
      // Auto-close and trigger success callback after 3 seconds
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  // Get password strength color
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

  const getStrengthText = () => {
    switch (passwordStrength.strength) {
      case 'very-strong': return 'Very Strong';
      case 'strong': return 'Strong';
      case 'medium': return 'Medium';
      default: return 'Weak';
    }
  };

  // Success Screen
  if (currentStep === 'success') {
    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4">
        <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-3xl w-full max-w-md p-8 relative shadow-2xl border border-gray-700/50">
          <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 via-blue-500/5 to-green-500/10 rounded-3xl"></div>
          
          <div className="relative text-center">
            <div className="flex justify-center mb-6">
              <div className="relative">
                <div className="absolute inset-0 bg-green-500/30 blur-2xl animate-pulse"></div>
                <div className="relative bg-gradient-to-br from-green-500 to-blue-600 rounded-full p-4 shadow-2xl shadow-green-500/50">
                  <CheckCircle size={64} className="text-white" />
                </div>
              </div>
            </div>

            <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 via-blue-400 to-green-500 mb-2">
              Password Reset Successful!
            </h2>
            <p className="text-gray-300 text-base mb-6">
              Your password has been successfully reset.<br />
              You can now sign in with your new password.
            </p>

            {success && (
              <div className="bg-green-900/40 border border-green-700/50 text-green-200 px-4 py-3 rounded-xl mb-6 backdrop-blur-sm">
                <p className="text-sm flex items-center justify-center gap-2">
                  <CheckCircle size={16} />
                  {success}
                </p>
              </div>
            )}

            <button
              onClick={() => {
                onSuccess?.();
                onClose();
              }}
              className="w-full bg-gradient-to-r from-green-600 via-blue-600 to-green-600 hover:from-green-700 hover:via-blue-700 hover:to-green-700 text-white py-4 rounded-xl transition-all duration-300 active:scale-95 flex items-center justify-center gap-2 font-semibold shadow-2xl hover:shadow-green-500/50"
            >
              <span>Continue to Sign In</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Reset Password Screen
  if (currentStep === 'reset') {
    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4">
        <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-3xl w-full max-w-md p-8 relative shadow-2xl border border-gray-700/50 max-h-[90vh] overflow-y-auto">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-blue-500/5 to-purple-500/10 rounded-3xl"></div>
          
          <button
            onClick={() => setCurrentStep('otp')}
            className="absolute left-4 top-4 text-gray-400 hover:text-white transition-all duration-200 hover:scale-110 z-10"
          >
            <X size={24} />
          </button>

          <div className="relative">
            <div className="flex justify-center mb-6">
              <div className="relative">
                <div className="absolute inset-0 bg-purple-500/30 blur-2xl"></div>
                <div className="relative bg-gradient-to-br from-purple-500 to-blue-600 rounded-full p-4 shadow-2xl shadow-purple-500/50">
                  <Lock size={48} className="text-white" />
                </div>
              </div>
            </div>

            <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-blue-400 to-purple-500 mb-2 text-center">
              Create New Password
            </h2>
            <p className="text-gray-400 text-sm mb-6 text-center">
              Choose a strong password for your account
            </p>

            {error && (
              <div className="bg-red-900/40 border border-red-700/50 text-red-200 px-4 py-3 rounded-xl mb-6 backdrop-blur-sm">
                <p className="text-sm flex items-center gap-2">
                  <AlertCircle size={16} />
                  {error}
                </p>
              </div>
            )}

            {success && (
              <div className="bg-green-900/40 border border-green-700/50 text-green-200 px-4 py-3 rounded-xl mb-6 backdrop-blur-sm">
                <p className="text-sm flex items-center gap-2">
                  <CheckCircle size={16} />
                  {success}
                </p>
              </div>
            )}

            <div className="space-y-5">
              <div className="group">
                <label className="block text-sm font-medium text-gray-300 mb-2">New Password</label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-gray-800/60 backdrop-blur-xl text-white rounded-xl py-3 pl-11 pr-12 border border-gray-700/50 focus:border-primary-500/50 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all duration-200 group-hover:border-gray-600"
                    placeholder="Enter new password"
                    disabled={loading}
                  />
                  <Lock size={18} className="absolute left-3.5 top-3.5 text-gray-400 group-hover:text-primary-400 transition-colors" />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3.5 top-3.5 text-gray-400 hover:text-white transition-colors"
                  >
                    {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

                {newPassword && (
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-400">Password Strength</span>
                      <span className={`font-semibold ${
                        passwordStrength.strength === 'very-strong' ? 'text-green-400' :
                        passwordStrength.strength === 'strong' ? 'text-blue-400' :
                        passwordStrength.strength === 'medium' ? 'text-yellow-400' :
                        'text-red-400'
                      }`}>
                        {getStrengthText()}
                      </span>
                    </div>
                    <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div className={`h-full ${getStrengthColor()} ${getStrengthWidth()} transition-all duration-300`}></div>
                    </div>
                    {passwordStrength.issues.length > 0 && (
                      <div className="bg-gray-800/50 rounded-lg p-3 mt-2">
                        <p className="text-xs text-gray-400 mb-1">Required:</p>
                        <ul className="space-y-1">
                          {passwordStrength.issues.map((issue, index) => (
                            <li key={index} className="text-xs text-gray-300 flex items-center gap-2">
                              <span className="text-red-400">•</span>
                              {issue}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="group">
                <label className="block text-sm font-medium text-gray-300 mb-2">Confirm Password</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-gray-800/60 backdrop-blur-xl text-white rounded-xl py-3 pl-11 pr-12 border border-gray-700/50 focus:border-primary-500/50 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all duration-200 group-hover:border-gray-600"
                    placeholder="Confirm new password"
                    disabled={loading}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !loading) {
                        handleResetPassword();
                      }
                    }}
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

              <button
                onClick={handleResetPassword}
                disabled={loading}
                className="w-full bg-gradient-to-r from-primary-600 via-purple-600 to-primary-600 hover:from-primary-700 hover:via-purple-700 hover:to-primary-700 disabled:from-gray-700 disabled:to-gray-800 disabled:cursor-not-allowed text-white py-4 rounded-xl transition-all duration-300 active:scale-95 flex items-center justify-center gap-2 font-semibold shadow-2xl hover:shadow-primary-500/50"
              >
                {loading && <Loader size={20} className="animate-spin" />}
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
      <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4">
        <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-3xl w-full max-w-md p-8 relative shadow-2xl border border-gray-700/50">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-purple-500/5 to-blue-500/10 rounded-3xl"></div>
          
          <button
            onClick={() => setCurrentStep('identify')}
            className="absolute left-4 top-4 text-gray-400 hover:text-white transition-all duration-200 hover:scale-110 z-10"
          >
            <X size={24} />
          </button>

          <div className="relative text-center">
            <div className="flex justify-center mb-6">
              <div className="relative">
                <div className="absolute inset-0 bg-blue-500/30 blur-2xl"></div>
                <div className="relative bg-gradient-to-br from-blue-500 to-purple-600 rounded-full p-4 shadow-2xl shadow-blue-500/50">
                  <Shield size={48} className="text-white" />
                </div>
              </div>
            </div>

            <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-blue-500 mb-2">
              Verify Your Phone
            </h2>
            <p className="text-gray-400 text-sm mb-6">
              Enter the 6-digit code sent to<br />
              <span className="text-white font-semibold">{phoneNumber}</span>
            </p>

            {error && (
              <div className="bg-red-900/40 border border-red-700/50 text-red-200 px-4 py-3 rounded-xl mb-6 backdrop-blur-sm">
                <p className="text-sm flex items-center justify-center gap-2">
                  <AlertCircle size={16} />
                  {error}
                </p>
              </div>
            )}

            {success && (
              <div className="bg-green-900/40 border border-green-700/50 text-green-200 px-4 py-3 rounded-xl mb-6 backdrop-blur-sm">
                <p className="text-sm flex items-center justify-center gap-2">
                  <CheckCircle size={16} />
                  {success}
                </p>
              </div>
            )}

            <div className="flex gap-3 justify-center mb-6" onPaste={handleOTPPaste}>
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
                  className="w-12 h-12 sm:w-14 sm:h-14 bg-gray-800/60 backdrop-blur-xl text-white text-2xl font-bold text-center rounded-xl border-2 border-gray-700/50 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30 transition-all duration-200"
                  disabled={loading}
                />
              ))}
            </div>

            <button
              onClick={handleVerifyOTP}
              disabled={loading || otp.join('').length !== 6}
              className="w-full bg-gradient-to-r from-primary-600 via-purple-600 to-primary-600 hover:from-primary-700 hover:via-purple-700 hover:to-primary-700 disabled:from-gray-700 disabled:to-gray-800 disabled:cursor-not-allowed text-white py-4 rounded-xl transition-all duration-300 active:scale-95 flex items-center justify-center gap-2 font-semibold shadow-2xl hover:shadow-primary-500/50 mb-4"
            >
              {loading && <Loader size={20} className="animate-spin" />}
              <span>{loading ? 'Verifying...' : 'Verify OTP'}</span>
            </button>

            <div className="text-sm text-gray-400">
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

  // Identify User Screen
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-3xl w-full max-w-md p-8 relative shadow-2xl border border-gray-700/50">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-500/5 to-purple-500/5 rounded-3xl"></div>
        
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-400 hover:text-white transition-all duration-200 hover:rotate-90 hover:scale-110 z-10"
        >
          <X size={24} />
        </button>

        <div className="relative">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 bg-primary-500/30 blur-2xl"></div>
              <div className="relative bg-gradient-to-br from-primary-500 to-purple-600 rounded-full p-4 shadow-2xl shadow-primary-500/50">
                <Lock size={48} className="text-white" />
              </div>
            </div>
          </div>

          <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary-400 via-purple-400 to-primary-500 mb-2 text-center">
            Reset Password
          </h2>
          <p className="text-gray-400 text-sm mb-6 text-center">
            Enter your Student ID, phone, or email
          </p>

          {error && (
            <div className="bg-red-900/40 border border-red-700/50 text-red-200 px-4 py-3 rounded-xl mb-6 backdrop-blur-sm">
              <p className="text-sm flex items-center gap-2">
                <AlertCircle size={16} />
                {error}
              </p>
            </div>
          )}

          <div className="space-y-5">
            <div className="group">
              <label className="block text-sm font-medium text-gray-300 mb-2">Student ID, Phone, or Email</label>
              <div className="relative">
                <input
                  type="text"
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  className="w-full bg-gray-800/60 backdrop-blur-xl text-white rounded-xl py-3 pl-11 pr-4 border border-gray-700/50 focus:border-primary-500/50 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all duration-200 group-hover:border-gray-600"
                  placeholder="ST-2601-00001, phone, or email"
                  disabled={loading}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !loading) {
                      handleIdentifyUser();
                    }
                  }}
                />
                <Smartphone size={18} className="absolute left-3.5 top-3.5 text-gray-400 group-hover:text-primary-400 transition-colors" />
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Accepts formats: ST-2601-00001, st-2601-00001, or ST260100001
              </p>
            </div>

            <button
              onClick={handleIdentifyUser}
              disabled={loading}
              className="w-full bg-gradient-to-r from-primary-600 via-purple-600 to-primary-600 hover:from-primary-700 hover:via-purple-700 hover:to-primary-700 disabled:from-gray-700 disabled:to-gray-800 disabled:cursor-not-allowed text-white py-4 rounded-xl transition-all duration-300 active:scale-95 flex items-center justify-center gap-2 font-semibold shadow-2xl hover:shadow-primary-500/50"
            >
              {loading && <Loader size={20} className="animate-spin" />}
              <span>{loading ? 'Processing...' : 'Continue'}</span>
            </button>
          </div>

          <div className="mt-6 text-center">
            <button 
              onClick={onClose}
              className="text-sm text-gray-400 hover:text-white transition-colors duration-200"
            >
              Back to Sign In
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordModal;
