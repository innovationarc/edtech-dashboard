// src/components/auth/ForgotUserIdModal.tsx
import { useState } from 'react';
import { 
  X, Loader, Shield, AlertCircle, CheckCircle, Phone, UserSearch, 
  CreditCard, LogIn, Copy, GraduationCap, BookOpen, Users, 
  ShieldCheck, Briefcase, UserCog, Crown, Award 
} from 'lucide-react';
import { otpService } from '../../services/otpService';
import { authService } from '../../services/authService';

interface ForgotUserIdModalProps {
  onClose: () => void;
  onSignInClick?: () => void;
}

interface UserData {
  uid: string;
  userId: string;
  surname: string;
  role: string;
  status: string;
  fullName?: string;
  name?: string;
}

const ForgotUserIdModal = ({ onClose, onSignInClick }: ForgotUserIdModalProps) => {
  const [currentStep, setCurrentStep] = useState<'phone' | 'otp' | 'results'>('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [users, setUsers] = useState<UserData[]>([]);
  const [userCount, setUserCount] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [canResendOTP, setCanResendOTP] = useState(false);
  const [resendTimer, setResendTimer] = useState(60);
  const [copiedUserId, setCopiedUserId] = useState<string | null>(null);

  // Handle phone number input
  const handlePhoneNumberChange = (value: string) => {
    let cleaned = value.replace(/\D/g, '');
    
    if (cleaned.startsWith('880')) {
      cleaned = cleaned.substring(3);
    } else if (cleaned.startsWith('88')) {
      cleaned = cleaned.substring(2);
    }
    
    cleaned = cleaned.substring(0, 11);
    setPhoneNumber(cleaned);
  };

  // Normalize phone number to 880XXXXXXXXXX format
  const normalizePhoneNumber = (phoneNumber: string): string => {
    let cleaned = phoneNumber.replace(/\D/g, '');
    
    if (cleaned.startsWith('880')) {
      cleaned = cleaned.substring(3);
    } else if (cleaned.startsWith('88')) {
      cleaned = cleaned.substring(2);
    }
    
    if (cleaned.startsWith('0')) {
      cleaned = cleaned.substring(1);
    }
    
    if (cleaned.length !== 10) {
      throw new Error('Invalid phone number format');
    }
    
    return `880${cleaned}`;
  };

  // Validate phone number
  const validatePhoneNumber = (phoneNumber: string): boolean => {
    const cleaned = phoneNumber.replace(/\D/g, '');
    
    if (cleaned.length !== 10 && cleaned.length !== 11) {
      return false;
    }
    
    if (cleaned.length === 11 && !cleaned.startsWith('0')) {
      return false;
    }
    
    const firstDigit = cleaned.startsWith('0') ? cleaned[1] : cleaned[0];
    return ['1', '3', '4', '5', '6', '7', '8', '9'].includes(firstDigit);
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

  // Search for users by phone number using authService
  const handleSearchUsers = async () => {
    setError('');
    setSuccess('');
    setLoading(true);

    if (!phoneNumber) {
      setError('Please enter your phone number');
      setLoading(false);
      return;
    }

    try {
      if (!validatePhoneNumber(phoneNumber)) {
        setError('Please enter a valid Bangladeshi phone number (10 or 11 digits)');
        setLoading(false);
        return;
      }

      const normalizedPhone = normalizePhoneNumber(phoneNumber);

      // Use authService which handles all API communication securely
      const result = await authService.getUsersByPhone(normalizedPhone);

      if (!result.success || !result.users || result.count === 0) {
        setError('No user found with this phone number');
        setUserCount(0);
      } else {
        setUserCount(result.count);
        setSuccess(`${result.count} user${result.count > 1 ? 's' : ''} found with this phone number`);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to search for users');
    } finally {
      setLoading(false);
    }
  };

  // Send OTP for verification
  const handleSendOTP = async () => {
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const normalizedPhone = normalizePhoneNumber(phoneNumber);
      const otpResult = await otpService.sendOTP(normalizedPhone, 'user-search');
      
      if (otpResult.success) {
        setSuccess(otpResult.message);
        setCurrentStep('otp');
        startResendTimer();
      } else {
        setError(otpResult.message);
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
      const nextInput = document.getElementById(`userid-otp-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handleOTPKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      const prevInput = document.getElementById(`userid-otp-${index - 1}`);
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

  // Verify OTP and fetch users
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
      const normalizedPhone = normalizePhoneNumber(phoneNumber);
      
      // Verify OTP
      const verifyResult = await otpService.verifyOTP(normalizedPhone, otpCode, 'user-search');
      
      if (!verifyResult.success) {
        setError(verifyResult.message);
        setLoading(false);
        return;
      }

      // Fetch users after successful OTP verification
      const result = await authService.getUsersByPhone(normalizedPhone);

      if (!result.success || !result.users || result.count === 0) {
        setError('No user found with this phone number');
        setLoading(false);
        return;
      }

      setUsers(result.users);
      setCurrentStep('results');
      setSuccess('User ID(s) retrieved successfully!');
    } catch (err: any) {
      setError(err.message || 'Failed to verify OTP or retrieve users');
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
      const normalizedPhone = normalizePhoneNumber(phoneNumber);
      const otpResult = await otpService.sendOTP(normalizedPhone, 'user-search');
      
      if (otpResult.success) {
        setSuccess(otpResult.message);
        setOtp(['', '', '', '', '', '']);
        startResendTimer();
      } else {
        setError(otpResult.message);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to resend OTP');
    } finally {
      setLoading(false);
    }
  };

  // Copy User ID to clipboard
  const handleCopyUserId = async (userId: string) => {
    try {
      await navigator.clipboard.writeText(userId);
      setCopiedUserId(userId);
      setTimeout(() => setCopiedUserId(null), 2000);
    } catch (err) {
      setError('Failed to copy User ID');
    }
  };

  // Format phone number for display
  const getDisplayPhoneNumber = () => {
    const cleaned = phoneNumber.replace(/\D/g, '');
    if (cleaned.length === 11) {
      return `0${cleaned.substring(1, 4)} ${cleaned.substring(4, 7)} ${cleaned.substring(7)}`;
    } else if (cleaned.length === 10) {
      return `0${cleaned.substring(0, 3)} ${cleaned.substring(3, 6)} ${cleaned.substring(6)}`;
    }
    return phoneNumber;
  };

  // Get role-specific icon (8 specific roles)
  const getRoleIcon = (role: string) => {
    const roleIcons: { [key: string]: JSX.Element } = {
      'admin': <ShieldCheck className="w-[18px] h-[18px] sm:w-5 sm:h-5 md:w-[22px] md:h-[22px] text-white" />,
      'manager': <Briefcase className="w-[18px] h-[18px] sm:w-5 sm:h-5 md:w-[22px] md:h-[22px] text-white" />,
      'course manager': <BookOpen className="w-[18px] h-[18px] sm:w-5 sm:h-5 md:w-[22px] md:h-[22px] text-white" />,
      'student manager': <UserCog className="w-[18px] h-[18px] sm:w-5 sm:h-5 md:w-[22px] md:h-[22px] text-white" />,
      'coordinator': <Award className="w-[18px] h-[18px] sm:w-5 sm:h-5 md:w-[22px] md:h-[22px] text-white" />,
      'student': <GraduationCap className="w-[18px] h-[18px] sm:w-5 sm:h-5 md:w-[22px] md:h-[22px] text-white" />,
      'teacher': <Users className="w-[18px] h-[18px] sm:w-5 sm:h-5 md:w-[22px] md:h-[22px] text-white" />,
      'parent': <Crown className="w-[18px] h-[18px] sm:w-5 sm:h-5 md:w-[22px] md:h-[22px] text-white" />,
    };
    return roleIcons[role.toLowerCase()] || <CreditCard className="w-[18px] h-[18px] sm:w-5 sm:h-5 md:w-[22px] md:h-[22px] text-white" />;
  };

  // Get role badge color with icon background (8 specific roles)
  const getRoleStyle = (role: string) => {
    const roleStyles: { [key: string]: { badge: string; iconBg: string } } = {
      'admin': { 
        badge: 'bg-red-500/20 text-red-300 border border-red-500/30',
        iconBg: 'bg-gradient-to-br from-red-500 to-red-600'
      },
      'manager': { 
        badge: 'bg-orange-500/20 text-orange-300 border border-orange-500/30',
        iconBg: 'bg-gradient-to-br from-orange-500 to-orange-600'
      },
      'course manager': { 
        badge: 'bg-purple-500/20 text-purple-300 border border-purple-500/30',
        iconBg: 'bg-gradient-to-br from-purple-500 to-purple-600'
      },
      'student manager': { 
        badge: 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30',
        iconBg: 'bg-gradient-to-br from-cyan-500 to-cyan-600'
      },
      'coordinator': { 
        badge: 'bg-pink-500/20 text-pink-300 border border-pink-500/30',
        iconBg: 'bg-gradient-to-br from-pink-500 to-pink-600'
      },
      'student': { 
        badge: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
        iconBg: 'bg-gradient-to-br from-blue-500 to-blue-600'
      },
      'teacher': { 
        badge: 'bg-green-500/20 text-green-300 border border-green-500/30',
        iconBg: 'bg-gradient-to-br from-green-500 to-green-600'
      },
      'parent': { 
        badge: 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30',
        iconBg: 'bg-gradient-to-br from-yellow-500 to-yellow-600'
      },
    };
    return roleStyles[role.toLowerCase()] || { 
      badge: 'bg-gray-500/20 text-gray-300 border border-gray-500/30',
      iconBg: 'bg-gradient-to-br from-gray-500 to-gray-600'
    };
  };

  // Get status badge color
  const getStatusBadgeColor = (status: string) => {
    const statusColors: { [key: string]: string } = {
      'active': 'bg-green-500/20 text-green-300 border border-green-500/30',
      'inactive': 'bg-gray-500/20 text-gray-300 border border-gray-500/30',
      'suspended': 'bg-red-500/20 text-red-300 border border-red-500/30',
      'pending': 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30',
    };
    return statusColors[status.toLowerCase()] || 'bg-gray-500/20 text-gray-300 border border-gray-500/30';
  };

  // Handle Sign In with selected User ID
  const handleSignInWithUserId = (userId: string) => {
    // Store the selected User ID in localStorage or session storage
    localStorage.setItem('prefilledUserId', userId);
    
    // Close modal and trigger sign-in
    onClose();
    if (onSignInClick) {
      onSignInClick();
    }
  };

  // Results Screen
  if (currentStep === 'results') {
    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-3 md:p-4">
        <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl md:rounded-3xl w-full max-w-[95%] sm:max-w-lg md:max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6 md:p-8 relative shadow-2xl border border-gray-700/50">
          <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-blue-500/5 rounded-2xl md:rounded-3xl pointer-events-none"></div>
          
          <button
            onClick={onClose}
            className="absolute right-3 top-3 md:right-4 md:top-4 text-gray-400 hover:text-white transition-all duration-200 hover:rotate-90 hover:scale-110 z-10"
          >
            <X size={20} className="md:w-6 md:h-6" />
          </button>

          <div className="relative">
            <div className="flex justify-center mb-4 md:mb-6">
              <div className="relative">
                <div className="absolute inset-0 bg-green-500/30 blur-2xl"></div>
                <div className="relative bg-gradient-to-br from-green-500 to-blue-600 rounded-full p-3 md:p-4 shadow-2xl shadow-green-500/50">
                  <CheckCircle size={32} className="md:w-12 md:h-12 text-white" />
                </div>
              </div>
            </div>

            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 via-blue-400 to-green-500 mb-2 text-center px-2">
              User ID{users.length > 1 ? 's' : ''} Found!
            </h2>
            <p className="text-gray-400 text-xs sm:text-sm mb-4 md:mb-6 text-center px-2">
              {users.length} account{users.length > 1 ? 's' : ''} found with phone number:<br />
              <span className="text-white font-semibold">{getDisplayPhoneNumber()}</span>
            </p>

            {success && (
              <div className="bg-green-900/40 border border-green-700/50 text-green-200 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl mb-4 md:mb-6 backdrop-blur-sm">
                <p className="text-xs sm:text-sm flex items-center justify-center gap-2">
                  <CheckCircle size={14} className="sm:w-4 sm:h-4" />
                  {success}
                </p>
              </div>
            )}

            <div className="space-y-3 sm:space-y-4 mb-4 md:mb-6">
              {users.map((user, index) => {
                const roleStyle = getRoleStyle(user.role);
                return (
                  <div 
                    key={user.uid || index}
                    className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-xl rounded-xl sm:rounded-2xl border border-gray-700/50 hover:border-primary-500/50 transition-all duration-300 overflow-hidden group shadow-lg hover:shadow-xl hover:shadow-primary-500/10"
                  >
                    {/* Header Section with Role Icon */}
                    <div className="bg-gradient-to-r from-gray-800/60 to-gray-900/60 border-b border-gray-700/30 px-3 sm:px-4 md:px-5 py-3 sm:py-4">
                      <div className="flex items-center gap-2.5 sm:gap-3 md:gap-4">
                        <div className={`${roleStyle.iconBg} rounded-lg sm:rounded-xl p-2 sm:p-2.5 md:p-3 shadow-lg flex-shrink-0`}>
                          {getRoleIcon(user.role)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 sm:gap-2 mb-1 flex-wrap">
                            <span className={`px-2 sm:px-2.5 md:px-3 py-0.5 sm:py-1 rounded-md sm:rounded-lg text-[10px] sm:text-xs font-bold backdrop-blur-sm ${roleStyle.badge}`}>
                              {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                            </span>
                            <span className={`px-2 sm:px-2.5 md:px-3 py-0.5 sm:py-1 rounded-md sm:rounded-lg text-[10px] sm:text-xs font-bold backdrop-blur-sm ${getStatusBadgeColor(user.status)}`}>
                              {user.status.charAt(0).toUpperCase() + user.status.slice(1)}
                            </span>
                          </div>
                          <p className="text-[10px] sm:text-xs text-gray-400 font-medium">Account #{index + 1}</p>
                        </div>
                      </div>
                    </div>

                    {/* Content Section */}
                    <div className="p-3 sm:p-4 md:p-5 space-y-3 sm:space-y-4">
                      {/* User ID Display */}
                      <div className="bg-gray-900/50 rounded-lg sm:rounded-xl p-3 sm:p-4 border border-gray-700/30">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 sm:gap-3">
                            <div className="bg-gradient-to-br from-primary-500/20 to-purple-500/20 rounded-lg p-1.5 sm:p-2 flex-shrink-0">
                              <CreditCard size={16} className="sm:w-5 sm:h-5 text-primary-400" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-[10px] sm:text-xs text-gray-400 font-medium mb-0.5">User ID</p>
                              <p className="text-base sm:text-lg md:text-xl font-bold text-white tracking-wide truncate">{user.userId}</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* User Details */}
                      {((user.fullName || user.name) || user.surname) && (
                        <div className="space-y-1.5 sm:space-y-2">
                          {(user.fullName || user.name) && (
                            <div className="flex items-start gap-2">
                              <p className="text-[10px] sm:text-xs text-gray-500 font-semibold min-w-[60px] sm:min-w-[70px]">Name:</p>
                              <p className="text-xs sm:text-sm text-gray-200 font-medium break-words">{user.fullName || user.name}</p>
                            </div>
                          )}
                          
                          {user.surname && (
                            <div className="flex items-start gap-2">
                              <p className="text-[10px] sm:text-xs text-gray-500 font-semibold min-w-[60px] sm:min-w-[70px]">Surname:</p>
                              <p className="text-xs sm:text-sm text-gray-200 font-medium break-words">{user.surname}</p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex gap-2 sm:gap-3 pt-1 sm:pt-2">
                        <button
                          onClick={() => handleCopyUserId(user.userId)}
                          className="flex-1 bg-gray-700/50 hover:bg-gray-700 text-white py-2.5 sm:py-3 rounded-lg sm:rounded-xl transition-all duration-200 flex items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-semibold border border-gray-600/30 hover:border-gray-500/50"
                        >
                          {copiedUserId === user.userId ? (
                            <>
                              <CheckCircle size={16} className="sm:w-[18px] sm:h-[18px]" />
                              <span className="hidden xs:inline">Copied!</span>
                              <span className="xs:hidden">✓</span>
                            </>
                          ) : (
                            <>
                              <Copy size={16} className="sm:w-[18px] sm:h-[18px]" />
                              <span className="hidden xs:inline">Copy ID</span>
                              <span className="xs:hidden">Copy</span>
                            </>
                          )}
                        </button>
                        
                        <button
                          onClick={() => handleSignInWithUserId(user.userId)}
                          className="flex-1 bg-gradient-to-r from-primary-600 to-purple-600 hover:from-primary-700 hover:to-purple-700 text-white py-2.5 sm:py-3 rounded-lg sm:rounded-xl transition-all duration-200 flex items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-semibold shadow-lg hover:shadow-primary-500/50 active:scale-95"
                        >
                          <LogIn size={16} className="sm:w-[18px] sm:h-[18px]" />
                          <span>Sign In</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="bg-blue-900/40 border border-blue-700/50 rounded-lg sm:rounded-xl p-3 sm:p-4 backdrop-blur-sm mb-3 sm:mb-4">
              <p className="text-[10px] sm:text-xs text-blue-200 flex items-center justify-center gap-1.5 sm:gap-2">
                <Shield size={12} className="sm:w-[14px] sm:h-[14px]" />
                Keep your User ID safe and secure
              </p>
            </div>

            <button
              onClick={onClose}
              className="w-full bg-gradient-to-r from-gray-700 to-gray-800 hover:from-gray-600 hover:to-gray-700 text-white py-2.5 sm:py-3 rounded-lg sm:rounded-xl transition-all duration-300 active:scale-95 flex items-center justify-center gap-2 font-semibold text-sm sm:text-base"
            >
              Close
            </button>
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
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 rounded-2xl md:rounded-3xl pointer-events-none"></div>
          
          <button
            onClick={onClose}
            className="absolute right-3 top-3 md:right-4 md:top-4 text-gray-400 hover:text-white transition-all duration-200 hover:rotate-90 hover:scale-110 z-10"
          >
            <X size={20} className="md:w-6 md:h-6" />
          </button>

          <div className="relative">
            <div className="flex justify-center mb-4 md:mb-6">
              <div className="relative">
                <div className="absolute inset-0 bg-blue-500/30 blur-2xl"></div>
                <div className="relative bg-gradient-to-br from-blue-500 to-purple-600 rounded-full p-3 md:p-4 shadow-2xl shadow-blue-500/50">
                  <Shield size={32} className="md:w-12 md:h-12 text-white" />
                </div>
              </div>
            </div>

            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-blue-500 mb-2 text-center px-2">
              Verify Your Phone
            </h2>
            <p className="text-gray-400 text-xs sm:text-sm mb-4 md:mb-6 text-center px-2">
              Enter the 6-digit code sent to<br />
              <span className="text-white font-semibold">{getDisplayPhoneNumber()}</span>
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
                  id={`userid-otp-${index}`}
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

            <div className="text-xs sm:text-sm text-gray-400 text-center">
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

  // Phone Number Entry Screen
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-3 md:p-4">
      <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl md:rounded-3xl w-full max-w-[95%] sm:max-w-md p-4 sm:p-6 md:p-8 relative shadow-2xl border border-gray-700/50">
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
                <UserSearch size={32} className="md:w-12 md:h-12 text-white" />
              </div>
            </div>
          </div>

          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary-400 via-purple-400 to-primary-500 mb-2 text-center px-2">
            Find Your User ID
          </h2>
          <p className="text-gray-400 text-xs sm:text-sm mb-4 md:mb-6 text-center px-2">
            Enter your registered phone number to find your User ID
          </p>

          {error && (
            <div className="bg-red-900/40 border border-red-700/50 text-red-200 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl mb-4 md:mb-6 backdrop-blur-sm">
              <p className="text-xs sm:text-sm flex items-center gap-2">
                <AlertCircle size={14} className="sm:w-4 sm:h-4" />
                {error}
              </p>
            </div>
          )}

          {success && (
            <div className="bg-green-900/40 border border-green-700/50 text-green-200 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl mb-4 md:mb-6 backdrop-blur-sm">
              <p className="text-xs sm:text-sm flex items-center gap-2">
                <CheckCircle size={14} className="sm:w-4 sm:h-4" />
                {success}
              </p>
            </div>
          )}

          <div className="space-y-3 sm:space-y-4 md:space-y-5">
            <div className="group">
              <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1.5 sm:mb-2">Phone Number *</label>
              <div className="relative">
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => handlePhoneNumberChange(e.target.value)}
                  className="w-full bg-gray-800/60 backdrop-blur-xl text-white rounded-lg sm:rounded-xl py-2.5 sm:py-3 pl-9 sm:pl-11 pr-3 sm:pr-4 border border-gray-700/50 focus:border-primary-500/50 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all duration-200 group-hover:border-gray-600 text-sm sm:text-base"
                  placeholder="01XXXXXXXXX or 1XXXXXXXXX"
                  disabled={loading}
                />
                <Phone size={16} className="sm:w-[18px] sm:h-[18px] absolute left-2.5 sm:left-3.5 top-2.5 sm:top-3.5 text-gray-400 group-hover:text-primary-400 transition-colors" />
              </div>
              <p className="text-[10px] sm:text-xs text-gray-500 mt-1 sm:mt-1.5">
                Enter 11 digits starting with 0 (e.g., 01712345678) or 10 digits starting with 1 (e.g., 1712345678)
              </p>
            </div>

            {userCount === 0 && error && error.includes('No user found') && (
              <div className="bg-yellow-900/40 border border-yellow-700/50 rounded-lg sm:rounded-xl p-3 sm:p-4 backdrop-blur-sm">
                <p className="text-xs sm:text-sm text-yellow-200 mb-2 sm:mb-3">
                  No account found with this phone number
                </p>
                <button
                  onClick={() => {
                    onClose();
                  }}
                  className="w-full bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700 text-white py-2.5 sm:py-3 rounded-lg sm:rounded-xl transition-all duration-300 active:scale-95 flex items-center justify-center gap-2 font-semibold text-sm sm:text-base"
                >
                  Create New Account
                </button>
              </div>
            )}

            {userCount > 0 && (
              <button
                onClick={handleSendOTP}
                disabled={loading}
                className="w-full bg-gradient-to-r from-green-600 via-blue-600 to-green-600 hover:from-green-700 hover:via-blue-700 hover:to-green-700 disabled:from-gray-700 disabled:to-gray-800 disabled:cursor-not-allowed text-white py-3 sm:py-4 rounded-lg sm:rounded-xl transition-all duration-300 active:scale-95 flex items-center justify-center gap-2 font-semibold shadow-2xl hover:shadow-green-500/50 text-sm sm:text-base"
              >
                {loading && <Loader size={18} className="sm:w-5 sm:h-5 animate-spin" />}
                <span>{loading ? 'Processing...' : `See User${userCount > 1 ? 's' : ''}`}</span>
              </button>
            )}

            {userCount === 0 && (
              <button
                onClick={handleSearchUsers}
                disabled={loading}
                className="w-full bg-gradient-to-r from-primary-600 via-purple-600 to-primary-600 hover:from-primary-700 hover:via-purple-700 hover:to-primary-700 disabled:from-gray-700 disabled:to-gray-800 disabled:cursor-not-allowed text-white py-3 sm:py-4 rounded-lg sm:rounded-xl transition-all duration-300 active:scale-95 flex items-center justify-center gap-2 font-semibold shadow-2xl hover:shadow-primary-500/50 text-sm sm:text-base"
              >
                {loading && <Loader size={18} className="sm:w-5 sm:h-5 animate-spin" />}
                <span>{loading ? 'Searching...' : 'Search User'}</span>
              </button>
            )}
          </div>

          <div className="mt-4 sm:mt-6 text-center">
            <button 
              onClick={onClose}
              className="text-xs sm:text-sm text-gray-400 hover:text-white transition-colors"
            >
              Back to Sign In
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotUserIdModal;
