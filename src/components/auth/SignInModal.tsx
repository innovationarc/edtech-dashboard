// src/components/auth/SignInModal.tsx
import { useState, useEffect } from 'react';
import { X, Lock, Loader, CreditCard, AlertCircle, Eye, EyeOff, UserCircle, Shield, ArrowRight } from 'lucide-react';
import { useDashboard } from '../../contexts/DashboardContext';
import { AccountStatusError } from '../../services/authService';
import RegisterModal from './RegisterModal';
import ForgotPasswordModal from './ForgotPasswordModal';
import ForgotUserIdModal from './ForgotUserIdModal';
import AccountStatusModal from './AccountStatusModal';

interface SignInModalProps {
  onClose: () => void;
}

const SignInModal = ({ onClose }: SignInModalProps) => {
  const { handleSignIn } = useDashboard();
  
  // State management
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showForgotUserId, setShowForgotUserId] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [captchaLoaded, setCaptchaLoaded] = useState(false);
  const [displayUserId, setDisplayUserId] = useState('');
  const [showAccountStatusModal, setShowAccountStatusModal] = useState(false);
  const [accountStatus, setAccountStatus] = useState<'inactive' | 'pending' | null>(null);
  const [accountUserId, setAccountUserId] = useState<string | undefined>(undefined);

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

  // Load remember me preference on mount
  useEffect(() => {
    try {
      const savedRememberMe = localStorage.getItem('auth_remember_me');
      const savedUserId = localStorage.getItem('auth_user_id');
      
      if (savedRememberMe === 'true' && savedUserId) {
        setRememberMe(true);
        setUserId(savedUserId);
        setDisplayUserId(savedUserId);
      }
    } catch {
      // Fail silently if localStorage not available
    }
  }, []);

  // Get reCAPTCHA v3 token
  const getCaptchaToken = async (): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!window.grecaptcha || !captchaLoaded) {
        reject(new Error('reCAPTCHA not loaded'));
        return;
      }

      window.grecaptcha.ready(() => {
        window.grecaptcha
          .execute(import.meta.env.VITE_RECAPTCHA_SITE_KEY || '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI', { action: 'login' })
          .then(resolve)
          .catch(reject);
      });
    });
  };

  // Format User ID input with auto-formatting: XX-YYMM-XXXXX
  const formatUserIdInput = (input: string): { display: string; value: string } => {
    const cleaned = input.replace(/[^a-zA-Z0-9]/g, '');
    
    let prefix = '';
    let yearMonth = '';
    let sequence = '';
    
    if (cleaned.length >= 1) {
      prefix = cleaned.substring(0, 2).toUpperCase().replace(/[^A-Z]/g, '');
    }
    
    if (cleaned.length > 2) {
      const remaining = cleaned.substring(prefix.length);
      yearMonth = remaining.substring(0, 4).replace(/[^0-9]/g, '');
    }
    
    if (cleaned.length > 6) {
      const remaining = cleaned.substring(prefix.length + yearMonth.length);
      sequence = remaining.substring(0, 5).replace(/[^0-9]/g, '');
    }
    
    let display = prefix;
    if (yearMonth) {
      display += '-' + yearMonth;
    }
    if (sequence) {
      display += '-' + sequence;
    }
    
    const value = prefix + (yearMonth ? '-' + yearMonth : '') + (sequence ? '-' + sequence : '');
    
    return { display, value };
  };

  // Handle User ID input change with formatting
  const handleUserIdChange = (input: string) => {
    const formatted = formatUserIdInput(input);
    setDisplayUserId(formatted.display);
    setUserId(formatted.value);
    
    if (error) {
      setError('');
    }
  };

  // Handle submit
  const handleSubmit = async () => {
    setError('');
    setLoading(true);

    if (!userId || !password) {
      setError('Please fill in all fields');
      setLoading(false);
      return;
    }

    try {
      await getCaptchaToken();
    } catch (err) {
      setError('Please wait for security verification to load');
      setLoading(false);
      return;
    }

    try {
      await handleSignIn(userId, password, rememberMe);
      onClose();
    } catch (err: any) {
      if (err instanceof AccountStatusError) {
        setAccountStatus(err.status);
        setAccountUserId(err.userId);
        setShowAccountStatusModal(true);
      } else {
        setError(err.message || 'Invalid credentials');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  if (showRegister) {
    return <RegisterModal onClose={() => setShowRegister(false)} onSwitchToSignIn={() => setShowRegister(false)} />;
  }

  if (showForgotPassword) {
    return (
      <ForgotPasswordModal 
        onClose={() => setShowForgotPassword(false)}
        onSwitchToForgotUserId={() => {
          setShowForgotPassword(false);
          setShowForgotUserId(true);
        }}
      />
    );
  }

  if (showForgotUserId) {
    return <ForgotUserIdModal onClose={() => setShowForgotUserId(false)} />;
  }

  if (showAccountStatusModal && accountStatus) {
    return (
      <AccountStatusModal 
        status={accountStatus}
        userId={accountUserId}
        onClose={() => {
          setShowAccountStatusModal(false);
          setAccountStatus(null);
          setAccountUserId(undefined);
        }}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-start sm:items-center justify-center z-50 p-3 sm:p-4 md:p-6 overflow-y-auto">
      <div className="bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-[400px] sm:max-w-md md:max-w-lg border border-gray-700/50 relative overflow-hidden my-auto">
        {/* Animated background effects */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary-500/5 via-purple-500/5 to-blue-500/5 pointer-events-none"></div>
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative">
          {/* Header */}
          <div className="flex items-center justify-between p-4 sm:p-5 md:p-6 border-b border-gray-700/50">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="h-8 w-8 sm:h-9 sm:w-9 md:h-10 md:w-10 rounded-xl bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center shadow-lg">
                <Lock size={16} className="sm:w-[18px] sm:h-[18px] md:w-5 md:h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-300">
                  Welcome Back
                </h2>
                <p className="text-[10px] sm:text-xs text-gray-400 mt-0.5">Sign in to continue</p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={loading}
              className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl bg-gray-800/50 hover:bg-gray-700/50 backdrop-blur-sm flex items-center justify-center transition-all duration-300 group border border-gray-700/30 hover:border-gray-600/50 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Close modal"
            >
              <X size={16} className="sm:w-[18px] sm:h-[18px] text-gray-400 group-hover:text-white transition-colors" />
            </button>
          </div>

          {/* Content */}
          <div className="p-4 sm:p-5 md:p-6 space-y-3 sm:space-y-4">
            {/* Error Message */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-2.5 sm:p-3 flex items-start gap-2 backdrop-blur-sm animate-shake">
                <AlertCircle size={16} className="sm:w-[18px] sm:h-[18px] text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-[11px] sm:text-xs md:text-sm text-red-200 leading-snug">{error}</p>
              </div>
            )}

            {/* Sign In Form */}
            <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="space-y-3 sm:space-y-4">
              {/* User ID Input */}
              <div className="group">
                <label className="block text-xs md:text-sm font-semibold text-gray-300 mb-1 md:mb-1.5 flex items-center gap-1 md:gap-1.5">
                  <CreditCard size={12} className="md:w-[14px] md:h-[14px] text-primary-400" />
                  User ID
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={displayUserId}
                    onChange={(e) => handleUserIdChange(e.target.value)}
                    onKeyPress={handleKeyPress}
                    onFocus={(e) => { e.currentTarget.style.borderColor = '#6366f1'; e.currentTarget.style.boxShadow = '0 0 0 4px rgba(99,102,241,0.15)'; e.currentTarget.style.outline = 'none'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(55,65,81,0.5)'; e.currentTarget.style.boxShadow = 'none'; }}
                    className="w-full bg-gray-800/50 backdrop-blur-sm text-white rounded-xl py-2 md:py-3.5 pl-8 md:pl-11 pr-3 border-2 border-gray-700/50 focus:outline-none transition-all duration-300 placeholder:text-gray-500 group-hover:border-gray-600/70 disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wide text-xs md:text-base"
                    style={{ borderWidth: '2px', borderStyle: 'solid', borderColor: 'rgba(55,65,81,0.5)', outline: 'none' }}
                    placeholder="ST-2601-00001"
                    disabled={loading}
                    autoComplete="username"
                    maxLength={13}
                  />
                  <CreditCard size={14} className="md:w-[18px] md:h-[18px] absolute left-2.5 md:left-4 top-2 md:top-3.5 text-gray-500 group-hover:text-primary-400 transition-colors pointer-events-none" />
                </div>
                <div className="flex items-center justify-between -mt-2 md:mt-1">
                  <p className="text-[10px] md:text-xs text-gray-500">Format: XX-YYMM-XXXXX</p>
                  <button 
                    type="button"
                    onClick={() => setShowForgotUserId(true)}
                    className="text-[10px] md:text-xs text-primary-400 hover:text-primary-300 transition-colors duration-200 font-medium hover:underline underline-offset-2"
                    disabled={loading}
                  >
                    Forgot User ID?
                  </button>
                </div>
              </div>

              {/* Password Input */}
              <div className="group">
                <label className="block text-xs md:text-sm font-semibold text-gray-300 mb-1 md:mb-1.5 flex items-center gap-1 md:gap-1.5">
                  <Lock size={12} className="md:w-[14px] md:h-[14px] text-primary-400" />
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyPress={handleKeyPress}
                    onFocus={(e) => { e.currentTarget.style.borderColor = '#6366f1'; e.currentTarget.style.boxShadow = '0 0 0 4px rgba(99,102,241,0.15)'; e.currentTarget.style.outline = 'none'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(55,65,81,0.5)'; e.currentTarget.style.boxShadow = 'none'; }}
                    className="w-full bg-gray-800/50 backdrop-blur-sm text-white rounded-xl py-2 md:py-3.5 pl-8 md:pl-11 pr-8 md:pr-12 border-2 border-gray-700/50 focus:outline-none transition-all duration-300 placeholder:text-gray-500 group-hover:border-gray-600/70 disabled:opacity-50 disabled:cursor-not-allowed text-xs md:text-base"
                    style={{ borderWidth: '2px', borderStyle: 'solid', borderColor: 'rgba(55,65,81,0.5)', outline: 'none' }}
                    placeholder="Enter your password"
                    disabled={loading}
                    autoComplete="current-password"
                  />
                  <Lock size={14} className="md:w-[18px] md:h-[18px] absolute left-2.5 md:left-4 top-2 md:top-3.5 text-gray-500 group-hover:text-primary-400 transition-colors pointer-events-none" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors duration-200"
                    disabled={loading}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={14} className="md:w-[18px] md:h-[18px]" /> : <Eye size={14} className="md:w-[18px] md:h-[18px]" />}
                  </button>
                </div>
                <div className="flex items-center justify-between -mt-2 md:mt-1">
                  <p className="text-[10px] md:text-xs text-gray-500">Use a strong password</p>
                  <button 
                    type="button"
                    onClick={() => setShowForgotPassword(true)}
                    className="text-[10px] md:text-xs text-primary-400 hover:text-primary-300 transition-colors duration-200 font-medium hover:underline underline-offset-2"
                    disabled={loading}
                  >
                    Forgot Password?
                  </button>
                </div>
              </div>

              {/* Remember Me Checkbox */}
              <div className="flex items-center pt-0.5 md:pt-1">
                <label className="flex items-center gap-2 md:gap-2.5 cursor-pointer group select-none">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="peer sr-only"
                      disabled={loading}
                    />
                    <div className="w-4 h-4 md:w-5 md:h-5 border-2 border-gray-600 rounded bg-gray-800/50 peer-checked:bg-gradient-to-br peer-checked:from-primary-500 peer-checked:to-purple-600 peer-checked:border-primary-500 transition-all duration-300 flex items-center justify-center group-hover:border-primary-500/50 peer-disabled:opacity-50 peer-disabled:cursor-not-allowed">
                      <svg 
                        className={`w-2.5 h-2.5 md:w-3 md:h-3 text-white transition-all duration-300 ${rememberMe ? 'scale-100 opacity-100' : 'scale-0 opacity-0'}`}
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
                  <span className="text-xs md:text-sm text-gray-400 group-hover:text-gray-300 transition-colors font-medium">
                    Keep me signed in
                  </span>
                </label>
              </div>

              {/* Sign In Button */}
              <button
                type="submit"
                disabled={loading || !captchaLoaded}
                className="w-full bg-gradient-to-r from-primary-600 via-purple-600 to-blue-600 hover:from-primary-700 hover:via-purple-700 hover:to-blue-700 disabled:from-gray-700 disabled:via-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed text-white py-2.5 md:py-3.5 rounded-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 md:gap-2.5 font-bold text-xs md:text-base shadow-2xl hover:shadow-primary-500/50 disabled:shadow-none group relative overflow-hidden"
              >
                {/* Button gradient overlay animation */}
                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000"></div>
                
                <span className="relative flex items-center gap-2 md:gap-2.5">
                  {loading && <Loader size={15} className="md:w-[18px] md:h-[18px] animate-spin" />}
                  <span>{loading ? 'Signing In...' : !captchaLoaded ? 'Loading Security...' : 'Sign In'}</span>
                  {!loading && captchaLoaded && <ArrowRight size={15} className="md:w-[18px] md:h-[18px] group-hover:translate-x-1 transition-transform" />}
                </span>
              </button>
            </form>

            {/* Divider */}
            <div className="relative my-3.5 md:my-5.5">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-700/50"></div>
              </div>
              <div className="relative flex justify-center text-[10px] md:text-xs">
                <span className="px-2.5 md:px-4 bg-gray-900 text-gray-500 font-medium">New to our platform?</span>
              </div>
            </div>

            {/* Create Account Button */}
            <button 
              type="button"
              onClick={() => setShowRegister(true)}
              className="w-full bg-gray-800/50 hover:bg-gray-800/80 backdrop-blur-sm border-2 border-gray-700/50 hover:border-primary-500/50 text-white py-2.5 md:py-3.5 rounded-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 md:gap-2.5 font-bold text-xs md:text-base shadow-lg group relative overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading}
            >
              <span className="relative flex items-center gap-2 md:gap-2.5">
                <UserCircle size={15} className="md:w-[18px] md:h-[18px] group-hover:rotate-12 transition-transform" />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-purple-400 group-hover:from-primary-300 group-hover:to-purple-300">
                  Create New Account
                </span>
                <ArrowRight size={15} className="md:w-[18px] md:h-[18px] text-primary-400 group-hover:translate-x-1 transition-transform" />
              </span>
            </button>

            {/* Info Box */}
            <div className="mt-3.5 md:mt-5.5 bg-gradient-to-br from-blue-900/20 to-purple-900/20 border border-blue-500/20 rounded-xl p-2.5 md:p-4 backdrop-blur-sm hover:scale-[1.02] transition-all duration-300 shadow-lg">
              <div className="flex items-start gap-2 md:gap-2.5">
                <div className="h-5 w-5 md:h-7 md:w-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-lg">
                  <span className="text-[10px] md:text-sm text-white font-bold">i</span>
                </div>
                <div className="flex-1">
                  <p className="text-[10px] md:text-xs text-blue-100/90 leading-relaxed">
                    <strong className="text-blue-50 font-semibold block mb-0.5 md:mb-1">First time signing in?</strong>
                    Use the User ID provided during registration along with your password to access your account.
                  </p>
                </div>
              </div>
            </div>

            {/* Security Badge */}
            {captchaLoaded && (
              <div className="mt-2.5 md:mt-3.5 flex items-center justify-center gap-1 md:gap-1.5 text-xs text-gray-500">
                <Shield size={11} className="md:w-3.5 md:h-3.5 text-green-500" />
                <span className="text-[9px] md:text-xs">Protected by reCAPTCHA</span>
              </div>
            )}

            {/* Terms and Privacy Notice */}
            <div className="mt-2.5 md:mt-4.5 text-center pb-1">
              <p className="text-[9px] md:text-xs text-gray-500 leading-relaxed px-1">
                By continuing, you agree to our{' '}
                <a 
                  href="/terms-of-service" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary-400 hover:text-primary-300 underline underline-offset-2 transition-colors font-medium"
                >
                  Terms of Service
                </a>
                {' '}and{' '}
                <a 
                  href="/privacy-policy" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary-400 hover:text-primary-300 underline underline-offset-2 transition-colors font-medium"
                >
                  Privacy Policy
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignInModal;
