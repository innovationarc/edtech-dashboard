// src/components/auth/ForgotUserIdModal.tsx
import { useState } from 'react';
import { X, Loader, Shield, AlertCircle, CheckCircle, Phone, UserSearch, Copy } from 'lucide-react';
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
      const otpResult = await otpService.verifyOTP(normalizedPhone, otpCode);
      
      if (!otpResult.success) {
        setError(otpResult.message);
        setLoading(false);
        return;
      }

      const result = await authService.getUsersByPhone(normalizedPhone);
      
      if (!result.success || !result.users || result.count === 0) {
        setError('No user found with this phone number');
        setLoading(false);
        return;
      }

      setUsers(result.users);
      setCurrentStep('results');
      setSuccess('User IDs retrieved successfully');
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
      const normalizedPhone = normalizePhoneNumber(phoneNumber);
      const result = await otpService.sendOTP(normalizedPhone, 'user-search');
      
      if (result.success) {
        setSuccess('OTP resent successfully');
        setOtp(['', '', '', '', '', '']);
        startResendTimer();
        
        setTimeout(() => {
          const firstInput = document.getElementById('userid-otp-0');
          firstInput?.focus();
        }, 100);
      } else {
        setError(result.message);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to resend OTP');
    } finally {
      setLoading(false);
    }
  };

  // Handle Sign In navigation
  const handleSignIn = () => {
    onClose();
    if (onSignInClick) {
      onSignInClick();
    }
  };

  // Get role icon - Only 8 roles
  const getRoleIcon = (role: string) => {
    const roleIcons: { [key: string]: string } = {
      'admin': 'fa-solid fa-user-shield',
      'manager': 'fa-solid fa-user-tie',
      'course manager': 'fa-solid fa-book-open-reader',
      'course_manager': 'fa-solid fa-book-open-reader',
      'student manager': 'fa-solid fa-users-gear',
      'student_manager': 'fa-solid fa-users-gear',
      'coordinator': 'fa-solid fa-clipboard-user',
      'teacher': 'fa-solid fa-chalkboard-user',
      'student': 'fa-solid fa-user-graduate',
      'parent': 'fa-solid fa-user-group',
    };
    
    return roleIcons[role.toLowerCase()] || 'fa-solid fa-user';
  };

  // Get status badge color
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'bg-green-500/20 text-green-300 border-green-500/30';
      case 'inactive':
        return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
      case 'suspended':
        return 'bg-red-500/20 text-red-300 border-red-500/30';
      case 'pending':
        return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
      default:
        return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
    }
  };

  // Get display phone number
  const getDisplayPhoneNumber = () => {
    if (phoneNumber.length === 10) {
      return `+880 ${phoneNumber.substring(0, 4)} ${phoneNumber.substring(4)}`;
    } else if (phoneNumber.length === 11) {
      return `+88 ${phoneNumber}`;
    }
    return phoneNumber;
  };

  // Copy user ID to clipboard
  const handleCopyUserId = async (userId: string) => {
    try {
      await navigator.clipboard.writeText(userId);
      setCopiedUserId(userId);
      setTimeout(() => setCopiedUserId(null), 2000);
    } catch (err) {
      setError('Failed to copy User ID');
    }
  };

  // Results Screen - Show all users
  if (currentStep === 'results') {
    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4">
        <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-3xl w-full max-w-2xl p-8 relative shadow-2xl border border-gray-700/50 max-h-[90vh] overflow-y-auto">
          <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-blue-500/5 rounded-3xl pointer-events-none"></div>
          
          <button
            onClick={onClose}
            className="absolute right-4 top-4 text-gray-400 hover:text-white transition-all duration-200 hover:rotate-90 hover:scale-110 z-10"
          >
            <X size={24} />
          </button>

          <div className="relative">
            <div className="flex justify-center mb-6">
              <div className="relative">
                <div className="absolute inset-0 bg-green-500/30 blur-2xl"></div>
                <div className="relative bg-gradient-to-br from-green-500 to-blue-600 rounded-full p-4 shadow-2xl shadow-green-500/50">
                  <CheckCircle size={48} className="text-white" />
                </div>
              </div>
            </div>

            <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 via-blue-400 to-green-500 mb-2 text-center">
              Your User ID{users.length > 1 ? 's' : ''}
            </h2>
            <p className="text-gray-400 text-sm mb-6 text-center">
              Found {users.length} account{users.length > 1 ? 's' : ''} associated with {getDisplayPhoneNumber()}
            </p>

            {success && (
              <div className="bg-green-900/40 border border-green-700/50 text-green-200 px-4 py-3 rounded-xl mb-6 backdrop-blur-sm">
                <p className="text-sm flex items-center justify-center gap-2">
                  <CheckCircle size={16} />
                  {success}
                </p>
              </div>
            )}

            {error && (
              <div className="bg-red-900/40 border border-red-700/50 text-red-200 px-4 py-3 rounded-xl mb-6 backdrop-blur-sm">
                <p className="text-sm flex items-center justify-center gap-2">
                  <AlertCircle size={16} />
                  {error}
                </p>
              </div>
            )}

            <div className="space-y-4 mb-6">
              {users.map((user, index) => (
                <div
                  key={index}
                  className="bg-gray-800/60 backdrop-blur-xl rounded-xl p-5 border border-gray-700/50 hover:border-primary-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary-500/20"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="bg-gradient-to-br from-primary-500/20 to-purple-500/20 rounded-xl p-3 border border-primary-500/30">
                        <i className={`${getRoleIcon(user.role)} text-2xl text-primary-400`}></i>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-lg font-semibold text-white truncate">
                            {user.fullName || user.name || `${user.surname}`}
                          </h3>
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${getStatusColor(user.status)}`}>
                            {user.status}
                          </span>
                        </div>
                        
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-400">User ID:</span>
                            <div className="flex items-center gap-2 bg-gray-900/50 px-3 py-1.5 rounded-lg border border-gray-700/50">
                              <span className="text-sm font-mono text-primary-300 font-semibold">
                                {user.userId}
                              </span>
                              <button
                                onClick={() => handleCopyUserId(user.userId)}
                                className="text-gray-400 hover:text-primary-400 transition-colors duration-200 active:scale-90"
                                title="Copy User ID"
                              >
                                {copiedUserId === user.userId ? (
                                  <CheckCircle size={16} className="text-green-400" />
                                ) : (
                                  <Copy size={16} />
                                )}
                              </button>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-400">Role:</span>
                            <span className="text-sm text-white capitalize">
                              {user.role.replace('_', ' ')}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={handleSignIn}
              className="w-full bg-gradient-to-r from-primary-600 via-purple-600 to-primary-600 hover:from-primary-700 hover:via-purple-700 hover:to-primary-700 text-white py-4 rounded-xl transition-all duration-300 active:scale-95 flex items-center justify-center gap-2 font-semibold shadow-2xl hover:shadow-primary-500/50"
            >
              <span>Sign In Now</span>
            </button>

            <div className="mt-6 bg-gray-800/40 backdrop-blur-xl rounded-xl p-4 border border-gray-700/30">
              <p className="text-xs text-gray-400 text-center flex items-center justify-center gap-2">
                <Shield size={14} />
                Keep your User ID safe and confidential
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
      <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4">
        <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-3xl w-full max-w-md p-8 relative shadow-2xl border border-gray-700/50">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 rounded-3xl pointer-events-none"></div>
          
          <button
            onClick={onClose}
            className="absolute right-4 top-4 text-gray-400 hover:text-white transition-all duration-200 hover:rotate-90 hover:scale-110 z-10"
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
              <span className="text-white font-semibold">{getDisplayPhoneNumber()}</span>
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
                  id={`userid-otp-${index}`}
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

  // Phone Number Entry Screen
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-3xl w-full max-w-md p-8 relative shadow-2xl border border-gray-700/50">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-500/5 to-purple-500/5 rounded-3xl pointer-events-none"></div>
        
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
                <UserSearch size={48} className="text-white" />
              </div>
            </div>
          </div>

          <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary-400 via-purple-400 to-primary-500 mb-2 text-center">
            Find Your User ID
          </h2>
          <p className="text-gray-400 text-sm mb-6 text-center">
            Enter your registered phone number to find your User ID
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
              <label className="block text-sm font-medium text-gray-300 mb-2">Phone Number *</label>
              <div className="relative">
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => handlePhoneNumberChange(e.target.value)}
                  className="w-full bg-gray-800/60 backdrop-blur-xl text-white rounded-xl py-3 pl-11 pr-4 border border-gray-700/50 focus:border-primary-500/50 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all duration-200 group-hover:border-gray-600"
                  placeholder="01XXXXXXXXX or 1XXXXXXXXX"
                  disabled={loading}
                />
                <Phone size={18} className="absolute left-3.5 top-3.5 text-gray-400 group-hover:text-primary-400 transition-colors" />
              </div>
              <p className="text-xs text-gray-500 mt-1.5">
                Enter 11 digits starting with 0 (e.g., 01712345678) or 10 digits starting with 1 (e.g., 1712345678)
              </p>
            </div>

            {userCount === 0 && error && error.includes('No user found') && (
              <div className="bg-yellow-900/40 border border-yellow-700/50 rounded-xl p-4 backdrop-blur-sm">
                <p className="text-sm text-yellow-200 mb-3">
                  No account found with this phone number
                </p>
                <button
                  onClick={() => {
                    onClose();
                  }}
                  className="w-full bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700 text-white py-3 rounded-xl transition-all duration-300 active:scale-95 flex items-center justify-center gap-2 font-semibold"
                >
                  Create New Account
                </button>
              </div>
            )}

            {userCount > 0 && (
              <button
                onClick={handleSendOTP}
                disabled={loading}
                className="w-full bg-gradient-to-r from-green-600 via-blue-600 to-green-600 hover:from-green-700 hover:via-blue-700 hover:to-green-700 disabled:from-gray-700 disabled:to-gray-800 disabled:cursor-not-allowed text-white py-4 rounded-xl transition-all duration-300 active:scale-95 flex items-center justify-center gap-2 font-semibold shadow-2xl hover:shadow-green-500/50"
              >
                {loading && <Loader size={20} className="animate-spin" />}
                <span>{loading ? 'Processing...' : `See User${userCount > 1 ? 's' : ''}`}</span>
              </button>
            )}

            {userCount === 0 && (
              <button
                onClick={handleSearchUsers}
                disabled={loading}
                className="w-full bg-gradient-to-r from-primary-600 via-purple-600 to-primary-600 hover:from-primary-700 hover:via-purple-700 hover:to-primary-700 disabled:from-gray-700 disabled:to-gray-800 disabled:cursor-not-allowed text-white py-4 rounded-xl transition-all duration-300 active:scale-95 flex items-center justify-center gap-2 font-semibold shadow-2xl hover:shadow-primary-500/50"
              >
                {loading && <Loader size={20} className="animate-spin" />}
                <span>{loading ? 'Searching...' : 'Search User'}</span>
              </button>
            )}
          </div>

          <div className="mt-6 text-center">
            <button 
              onClick={onClose}
              className="text-sm text-gray-400 hover:text-white transition-colors"
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
