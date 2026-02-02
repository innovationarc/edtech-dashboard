// src/components/auth/ForgotUserIdModal.tsx
import { useState } from 'react';
import { X, Loader, Shield, AlertCircle, CheckCircle, Phone, UserSearch, CreditCard, LogIn, Copy } from 'lucide-react';
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

  // Get role badge color
  const getRoleBadgeColor = (role: string) => {
    const roleColors: { [key: string]: string } = {
      'student': 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
      'teacher': 'bg-purple-500/20 text-purple-300 border border-purple-500/30',
      'parent': 'bg-green-500/20 text-green-300 border border-green-500/30',
      'admin': 'bg-red-500/20 text-red-300 border border-red-500/30',
    };
    return roleColors[role.toLowerCase()] || 'bg-gray-500/20 text-gray-300 border border-gray-500/30';
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
      <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4">
        <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-8 relative shadow-2xl border border-gray-700/50">
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
              User ID{users.length > 1 ? 's' : ''} Found!
            </h2>
            <p className="text-gray-400 text-sm mb-6 text-center">
              {users.length} account{users.length > 1 ? 's' : ''} found with phone number:<br />
              <span className="text-white font-semibold">{getDisplayPhoneNumber()}</span>
            </p>

            {success && (
              <div className="bg-green-900/40 border border-green-700/50 text-green-200 px-4 py-3 rounded-xl mb-6 backdrop-blur-sm">
                <p className="text-sm flex items-center justify-center gap-2">
                  <CheckCircle size={16} />
                  {success}
                </p>
              </div>
            )}

            <div className="space-y-4 mb-6">
              {users.map((user, index) => (
                <div 
                  key={user.uid || index}
                  className="bg-gray-800/60 backdrop-blur-xl rounded-xl p-5 border border-gray-700/50 hover:border-primary-500/50 transition-all duration-300 group"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="bg-gradient-to-br from-primary-500 to-purple-600 rounded-lg p-2.5">
                          <CreditCard size={20} className="text-white" />
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 font-medium">User ID</p>
                          <p className="text-lg font-bold text-white">{user.userId}</p>
                        </div>
                      </div>
                      
                      {(user.fullName || user.name) && (
                        <p className="text-sm text-gray-300 mb-1">
                          <span className="text-gray-500">Name:</span> {user.fullName || user.name}
                        </p>
                      )}
                      
                      {user.surname && (
                        <p className="text-sm text-gray-300 mb-1">
                          <span className="text-gray-500">Surname:</span> {user.surname}
                        </p>
                      )}
                      
                      <div className="flex flex-wrap gap-2 mt-3">
                        <span className={`px-3 py-1 rounded-lg text-xs font-semibold backdrop-blur-sm ${getRoleBadgeColor(user.role)}`}>
                          {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                        </span>
                        <span className={`px-3 py-1 rounded-lg text-xs font-semibold backdrop-blur-sm ${getStatusBadgeColor(user.status)}`}>
                          {user.status.charAt(0).toUpperCase() + user.status.slice(1)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleCopyUserId(user.userId)}
                      className="flex-1 bg-gray-700/50 hover:bg-gray-700 text-white py-2.5 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 text-sm font-medium"
                    >
                      {copiedUserId === user.userId ? (
                        <>
                          <CheckCircle size={16} />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy size={16} />
                          <span>Copy ID</span>
                        </>
                      )}
                    </button>
                    
                    <button
                      onClick={() => handleSignInWithUserId(user.userId)}
                      className="flex-1 bg-gradient-to-r from-primary-600 to-purple-600 hover:from-primary-700 hover:to-purple-700 text-white py-2.5 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 text-sm font-medium shadow-lg hover:shadow-primary-500/50"
                    >
                      <LogIn size={16} />
                      <span>Sign In</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-blue-900/40 border border-blue-700/50 rounded-xl p-4 backdrop-blur-sm mb-4">
              <p className="text-xs text-blue-200 flex items-center justify-center gap-2">
                <Shield size={14} />
                Keep your User ID safe and secure
              </p>
            </div>

            <button
              onClick={onClose}
              className="w-full bg-gradient-to-r from-gray-700 to-gray-800 hover:from-gray-600 hover:to-gray-700 text-white py-3 rounded-xl transition-all duration-300 active:scale-95 flex items-center justify-center gap-2 font-semibold"
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
      <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4">
        <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-3xl w-full max-w-md p-8 relative shadow-2xl border border-gray-700/50">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 rounded-3xl pointer-events-none"></div>
          
          <button
            onClick={onClose}
            className="absolute right-4 top-4 text-gray-400 hover:text-white transition-all duration-200 hover:rotate-90 hover:scale-110 z-10"
          >
            <X size={24} />
          </button>

          <div className="relative">
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
