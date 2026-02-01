// src/components/auth/ForgotUserIdModal.tsx
import { useState } from 'react';
import { X, Loader, Shield, AlertCircle, CheckCircle, Phone, UserSearch, CreditCard, LogIn } from 'lucide-react';
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
  const [phoneNumber, setPhoneNumber] = useState(''); // Raw input (10 or 11 digits)
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [users, setUsers] = useState<UserData[]>([]);
  const [userCount, setUserCount] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [canResendOTP, setCanResendOTP] = useState(false);
  const [resendTimer, setResendTimer] = useState(60);

  // Handle phone number input - same as RegisterModal
  const handlePhoneNumberChange = (value: string) => {
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
    
    setPhoneNumber(cleaned);
  };

  // Normalize phone number to 880XXXXXXXXXX format (13 digits) - same as RegisterModal
  const normalizePhoneNumber = (phoneNumber: string): string => {
    let cleaned = phoneNumber.replace(/\D/g, '');
    
    // Remove country code if present
    if (cleaned.startsWith('880')) {
      cleaned = cleaned.substring(3);
    } else if (cleaned.startsWith('88')) {
      cleaned = cleaned.substring(2);
    }
    
    // Remove leading zero if present (for 11 digit numbers starting with 0)
    if (cleaned.startsWith('0')) {
      cleaned = cleaned.substring(1);
    }
    
    // Should now have 10 digits
    if (cleaned.length !== 10) {
      throw new Error('Invalid phone number format');
    }
    
    // Return in format: 880XXXXXXXXXX (13 digits, no + sign)
    return `880${cleaned}`;
  };

  // Validate phone number - same as RegisterModal
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

  // Step 1: Search for users by phone number
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
      // Validate phone number format
      if (!validatePhoneNumber(phoneNumber)) {
        setError('Please enter a valid Bangladeshi phone number (10 or 11 digits)');
        setLoading(false);
        return;
      }

      const normalizedPhone = normalizePhoneNumber(phoneNumber);

      // Use authService.getUsersByPhone which uses user-search API with purpose: 'user-id-recovery'
      // This will return ALL types of accounts (admin, teacher, student, etc.)
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
      
      // Send OTP with user-search purpose
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

  // Step 2: Verify OTP and fetch users
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
      const result = await otpService.verifyOTP(normalizedPhone, otpCode, 'user-search');
      
      if (result.success) {
        // Fetch users using authService which uses user-search API
        const usersResult = await authService.getUsersByPhone(normalizedPhone);
        
        if (usersResult.success && usersResult.users && usersResult.users.length > 0) {
          setUsers(usersResult.users);
          setSuccess('Phone verified! Here are your User IDs');
          setCurrentStep('results');
        } else {
          setError('No users found with this phone number');
        }
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

  // Format phone number for display
  const getDisplayPhoneNumber = () => {
    if (!phoneNumber) return '';
    try {
      const normalized = normalizePhoneNumber(phoneNumber);
      return `+${normalized}`;
    } catch {
      return phoneNumber;
    }
  };

  // Get role display name
  const getRoleDisplayName = (role: string): string => {
    const roleMap: { [key: string]: string } = {
      admin: 'Admin',
      manager: 'Manager',
      course_manager: 'Course Manager',
      student_manager: 'Student Manager',
      coordinator: 'Coordinator',
      teacher: 'Teacher',
      parent: 'Parent',
      student: 'Student'
    };
    return roleMap[role] || role;
  };

  // Get role icon
  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
      case 'manager':
      case 'course_manager':
      case 'student_manager':
        return '👑';
      case 'coordinator':
        return '🎯';
      case 'teacher':
        return '👨‍🏫';
      case 'parent':
        return '👨‍👩‍👧';
      case 'student':
        return '🎓';
      default:
        return '👤';
    }
  };

  // Results Screen
  if (currentStep === 'results') {
    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4">
        <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-3xl w-full max-w-md p-8 relative shadow-2xl border border-gray-700/50 max-h-[90vh] overflow-y-auto">
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
              Found {users.length} account{users.length > 1 ? 's' : ''} with this phone number
            </p>

            {success && (
              <div className="bg-green-900/40 border border-green-700/50 text-green-200 px-4 py-3 rounded-xl mb-6 backdrop-blur-sm">
                <p className="text-sm flex items-center justify-center gap-2">
                  <CheckCircle size={16} />
                  {success}
                </p>
              </div>
            )}

            <div className="space-y-4">
              {users.map((user, index) => (
                <div 
                  key={user.uid}
                  className="bg-gray-800/60 backdrop-blur-xl rounded-xl p-5 border border-gray-700/50 hover:border-primary-500/50 transition-all duration-300 hover:scale-105"
                >
                  <div className="flex items-start gap-4">
                    <div className="text-4xl">{getRoleIcon(user.role)}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-white font-semibold text-lg">
                          {user.fullName || user.name || user.surname}
                        </h3>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          user.status === 'active' 
                            ? 'bg-green-900/40 text-green-300 border border-green-700/50' 
                            : user.status === 'pending'
                            ? 'bg-yellow-900/40 text-yellow-300 border border-yellow-700/50'
                            : 'bg-red-900/40 text-red-300 border border-red-700/50'
                        }`}>
                          {user.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-400 mb-2">{getRoleDisplayName(user.role)}</p>
                      <div className="bg-gradient-to-r from-primary-900/40 to-purple-900/40 border border-primary-700/50 rounded-lg p-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CreditCard size={18} className="text-primary-400" />
                          <span className="text-white font-mono font-semibold">{user.userId}</span>
                        </div>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(user.userId);
                            setSuccess('User ID copied to clipboard!');
                            setTimeout(() => setSuccess(''), 2000);
                          }}
                          className="text-xs bg-primary-600 hover:bg-primary-700 text-white px-3 py-1 rounded-lg transition-colors"
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => {
                if (onSignInClick) {
                  onSignInClick();
                } else {
                  onClose();
                }
              }}
              className="w-full mt-6 bg-gradient-to-r from-primary-600 via-purple-600 to-primary-600 hover:from-primary-700 hover:via-purple-700 hover:to-primary-700 text-white py-4 rounded-xl transition-all duration-300 active:scale-95 flex items-center justify-center gap-2 font-semibold shadow-2xl hover:shadow-primary-500/50"
            >
              <LogIn size={20} />
              <span>Go to Sign In</span>
            </button>
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
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-purple-500/5 to-blue-500/10 rounded-3xl pointer-events-none"></div>
          
          <button
            onClick={() => setCurrentStep('phone')}
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
                    // Optionally trigger registration modal
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
