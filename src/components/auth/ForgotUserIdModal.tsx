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
  const [phoneNumber, setPhoneNumber] = useState('');
  const [displayPhone, setDisplayPhone] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [users, setUsers] = useState<UserData[]>([]);
  const [userCount, setUserCount] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [canResendOTP, setCanResendOTP] = useState(false);
  const [resendTimer, setResendTimer] = useState(60);

  // Phone number formatting
  const formatPhoneNumber = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    
    if (numbers.startsWith('880')) {
      const rest = numbers.substring(3);
      if (rest.length <= 5) {
        return `+880 ${rest}`;
      } else if (rest.length <= 9) {
        return `+880 ${rest.substring(0, 5)}-${rest.substring(5)}`;
      } else {
        return `+880 ${rest.substring(0, 5)}-${rest.substring(5, 9)}`;
      }
    } else if (numbers.startsWith('88')) {
      const rest = numbers.substring(2);
      if (rest.length <= 5) {
        return `+880 ${rest}`;
      } else if (rest.length <= 9) {
        return `+880 ${rest.substring(0, 5)}-${rest.substring(5)}`;
      } else {
        return `+880 ${rest.substring(0, 5)}-${rest.substring(5, 9)}`;
      }
    } else if (numbers.startsWith('0')) {
      const rest = numbers.substring(1);
      if (rest.length <= 5) {
        return `+880 ${rest}`;
      } else if (rest.length <= 9) {
        return `+880 ${rest.substring(0, 5)}-${rest.substring(5)}`;
      } else {
        return `+880 ${rest.substring(0, 5)}-${rest.substring(5, 9)}`;
      }
    } else {
      if (numbers.length <= 5) {
        return `+880 ${numbers}`;
      } else if (numbers.length <= 9) {
        return `+880 ${numbers.substring(0, 5)}-${numbers.substring(5)}`;
      } else {
        return `+880 ${numbers.substring(0, 5)}-${numbers.substring(5, 9)}`;
      }
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setDisplayPhone(formatted);
    setPhoneNumber(e.target.value.replace(/\D/g, ''));
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
      if (!otpService.validatePhoneNumber(phoneNumber)) {
        setError('Please enter a valid Bangladeshi phone number');
        setLoading(false);
        return;
      }

      const normalizedPhone = otpService.normalizePhoneNumber(phoneNumber);

      // Search for users with this phone number using checkDuplicates
      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 
                         import.meta.env.VITE_API_URL ||
                         'https://edtech-dashboard-alpha.vercel.app';
      const MASTER_API_KEY = import.meta.env.VITE_SMS_MASTER_KEY;

      const requestBody: any = {
        phoneNumber: normalizedPhone,
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
        throw new Error('Failed to search for users');
      }

      const result = await response.json();

      if (result.count === 0) {
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
      const normalizedPhone = otpService.normalizePhoneNumber(phoneNumber);
      
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

  // Step 2: Verify OTP and fetch user list
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
      const normalizedPhone = otpService.normalizePhoneNumber(phoneNumber);
      
      // Verify OTP
      const result = await otpService.verifyOTP(normalizedPhone, otpCode, 'user-search');
      
      if (result.success) {
        // Fetch all users with this phone number using authService
        await fetchUsers(normalizedPhone);
      } else {
        setError(result.message);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to verify OTP');
    } finally {
      setLoading(false);
    }
  };

  // Fetch users after OTP verification using authService
  const fetchUsers = async (normalizedPhone: string) => {
    try {
      const result = await authService.getUsersByPhone(normalizedPhone);

      if (result.success && result.users) {
        setUsers(result.users);
        setCurrentStep('results');
        setSuccess('User IDs retrieved successfully');
      } else {
        setError(result.message || 'Failed to retrieve user information');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch user information');
    }
  };

  // Resend OTP
  const handleResendOTP = async () => {
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const normalizedPhone = otpService.normalizePhoneNumber(phoneNumber);
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

  const handleGoToSignIn = () => {
    if (onSignInClick) {
      onSignInClick();
    } else {
      onClose();
    }
  };

  // Results Screen
  if (currentStep === 'results') {
    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4">
        <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-3xl w-full max-w-2xl p-8 relative shadow-2xl border border-gray-700/50 max-h-[90vh] overflow-y-auto">
          <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 via-blue-500/5 to-green-500/10 rounded-3xl"></div>
          
          <button
            onClick={onClose}
            className="absolute right-4 top-4 text-gray-400 hover:text-white transition-all duration-200 hover:rotate-90 hover:scale-110 z-10"
          >
            <X size={24} />
          </button>

          <div className="relative text-center">
            <div className="flex justify-center mb-6">
              <div className="relative">
                <div className="absolute inset-0 bg-green-500/30 blur-2xl"></div>
                <div className="relative bg-gradient-to-br from-green-500 to-blue-600 rounded-full p-4 shadow-2xl shadow-green-500/50">
                  <CheckCircle size={48} className="text-white" />
                </div>
              </div>
            </div>

            <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 via-blue-400 to-green-500 mb-2">
              User ID{users.length > 1 ? 's' : ''} Found
            </h2>
            <p className="text-gray-400 text-sm mb-6">
              {users.length} user{users.length > 1 ? 's' : ''} found with phone number<br />
              <span className="text-white font-semibold">{otpService.formatForDisplay(phoneNumber)}</span>
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

            <div className="space-y-4 mb-6">
              {users.map((user, index) => (
                <div
                  key={user.uid || index}
                  className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-xl rounded-xl p-5 border border-gray-700/50 hover:border-primary-500/50 transition-all duration-300 hover:scale-102 shadow-lg"
                >
                  <div className="grid grid-cols-2 gap-4 text-left">
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">User ID</p>
                      <p className="text-white font-bold text-lg flex items-center gap-2">
                        <CreditCard size={18} className="text-primary-400" />
                        {user.userId}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Surname</p>
                      <p className="text-white font-semibold">{user.surname || user.fullName || user.name || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Role</p>
                      <p className="text-white font-semibold capitalize">{user.role || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Status</p>
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                        user.status === 'active' 
                          ? 'bg-green-900/50 text-green-300 border border-green-700/50' 
                          : user.status === 'pending'
                          ? 'bg-yellow-900/50 text-yellow-300 border border-yellow-700/50'
                          : 'bg-red-900/50 text-red-300 border border-red-700/50'
                      }`}>
                        {user.status || 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={handleGoToSignIn}
              className="w-full bg-gradient-to-r from-primary-600 via-purple-600 to-primary-600 hover:from-primary-700 hover:via-purple-700 hover:to-primary-700 text-white py-4 rounded-xl transition-all duration-300 active:scale-95 flex items-center justify-center gap-2 font-semibold shadow-2xl hover:shadow-primary-500/50"
            >
              <LogIn size={20} />
              <span>Go to Sign In</span>
            </button>

            <div className="mt-6 bg-gray-800/40 backdrop-blur-xl rounded-xl p-4 border border-gray-700/30">
              <p className="text-xs text-gray-400">
                Use any of the User IDs shown above to sign in to your account
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
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-purple-500/5 to-blue-500/10 rounded-3xl"></div>
          
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
              <span className="text-white font-semibold">{otpService.formatForDisplay(phoneNumber)}</span>
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
              <label className="block text-sm font-medium text-gray-300 mb-2">Phone Number</label>
              <div className="relative">
                <input
                  type="tel"
                  value={displayPhone}
                  onChange={handlePhoneChange}
                  className="w-full bg-gray-800/60 backdrop-blur-xl text-white rounded-xl py-3 pl-11 pr-4 border border-gray-700/50 focus:border-primary-500/50 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all duration-200 group-hover:border-gray-600"
                  placeholder="+880 12345-6789"
                  disabled={loading}
                />
                <Phone size={18} className="absolute left-3.5 top-3.5 text-gray-400 group-hover:text-primary-400 transition-colors" />
              </div>
              <p className="text-xs text-gray-500 mt-1.5">Enter your registered Bangladeshi phone number</p>
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
