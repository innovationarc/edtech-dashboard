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

  const handleUserIdChange = (input: string) => {
    const formatted = formatUserIdInput(input);
    setDisplayUserId(formatted.display);
    setUserId(formatted.value);
    
    if (error) {
      setError('');
    }
  };

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
    return <ForgotPasswordModal onClose={() => setShowForgotPassword(false)} />;
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
          onClose();
        }}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fadeIn p-2">
      <div className="relative w-full max-w-md md:max-w-lg lg:max-w-xl animate-slideUp max-h-[calc(100vh-1rem)] overflow-y-auto">
        <div className="absolute -inset-1 bg-gradient-to-r from-primary-600 via-purple-600 to-blue-600 rounded-2xl blur-xl opacity-30 animate-pulse"></div>
        
        <div className="relative bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 rounded-2xl shadow-2xl border border-gray-800/50 backdrop-blur-xl overflow-hidden">
          <button
            onClick={onClose}
            className="absolute top-2 right-2 sm:top-3 sm:right-3 z-10 text-gray-400 hover:text-white transition-all duration-200 p-1.5 hover:bg-white/10 rounded-xl backdrop-blur-sm group"
            aria-label="Close modal"
          >
            <X size={18} className="sm:size-5 group-hover:rotate-90 transition-transform duration-300" />
          </button>

          <div className="p-3 sm:p-5 md:p-7">
            <div className="flex flex-col items-center mb-3 sm:mb-4 md:mb-6">
              <div className="h-10 w-10 sm:h-12 sm:w-12 md:h-16 md:w-16 rounded-xl sm:rounded-2xl bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center shadow-2xl shadow-primary-500/50 mb-2 sm:mb-3 animate-float">
                <Lock size={18} className="sm:size-5 md:size-7 text-white" strokeWidth={2.5} />
              </div>
              
              <h2 className="text-lg sm:text-xl md:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-100 to-white mb-1 tracking-tight text-center">
                Welcome Back
              </h2>
              <p className="text-xs sm:text-sm text-gray-400 font-medium text-center">Sign in to access your account</p>
            </div>

            {error && (
              <div className="mb-2 sm:mb-3 md:mb-4 p-2 sm:p-3 bg-gradient-to-r from-red-500/10 to-pink-500/10 border border-red-500/30 rounded-xl flex items-start gap-2 backdrop-blur-sm animate-shake shadow-lg">
                <AlertCircle size={14} className="sm:size-4 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-300 leading-relaxed font-medium">{error}</p>
              </div>
            )}

            <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="space-y-2 sm:space-y-3 md:space-y-5">
              <div className="group">
                <label className="block text-xs font-semibold text-gray-300 mb-1 flex items-center gap-1">
                  <CreditCard size={12} className="sm:size-3.5 text-primary-400" />
                  User ID
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={displayUserId}
                    onChange={(e) => handleUserIdChange(e.target.value)}
                    onKeyPress={handleKeyPress}
                    className="w-full bg-gray-800/50 backdrop-blur-sm text-white rounded-xl py-2 sm:py-2.5 pl-8 sm:pl-10 pr-3 border-2 border-gray-700/50 focus:border-primary-500 focus:outline-none focus:ring-4 focus:ring-primary-500/20 transition-all duration-300 placeholder:text-gray-500 group-hover:border-gray-600/70 disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wide text-xs"
                    placeholder="ST-2601-00001"
                    disabled={loading}
                    autoComplete="username"
                    maxLength={13}
                  />
                  <CreditCard size={14} className="absolute left-2.5 sm:left-3 top-2 sm:top-2.5 text-gray-500 group-hover:text-primary-400 transition-colors pointer-events-none" />
                </div>
                <div className="flex items-center justify-between mt-0.5">
                  <p className="text-[10px] sm:text-xs text-gray-500">Format: XX-YYMM-XXXXX</p>
                  <button 
                    type="button"
                    onClick={() => setShowForgotUserId(true)}
                    className="text-[10px] sm:text-xs text-primary-400 hover:text-primary-300 transition-colors duration-200 font-medium hover:underline underline-offset-2"
                    disabled={loading}
                  >
                    Forgot ID?
                  </button>
                </div>
              </div>

              <div className="group">
                <label className="block text-xs font-semibold text-gray-300 mb-1 flex items-center gap-1">
                  <Lock size={12} className="sm:size-3.5 text-primary-400" />
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyPress={handleKeyPress}
                    className="w-full bg-gray-800/50 backdrop-blur-sm text-white rounded-xl py-2 sm:py-2.5 pl-8 sm:pl-10 pr-8 sm:pr-10 border-2 border-gray-700/50 focus:border-primary-500 focus:outline-none focus:ring-4 focus:ring-primary-500/20 transition-all duration-300 placeholder:text-gray-500 group-hover:border-gray-600/70 disabled:opacity-50 disabled:cursor-not-allowed text-xs"
                    placeholder="Enter your password"
                    disabled={loading}
                    autoComplete="current-password"
                  />
                  <Lock size={14} className="absolute left-2.5 sm:left-3 top-2 sm:top-2.5 text-gray-500 group-hover:text-primary-400 transition-colors pointer-events-none" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 sm:right-3 top-2 sm:top-2.5 text-gray-500 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/5"
                    disabled={loading}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                <div className="flex items-center justify-between mt-0.5">
                  <p className="text-[10px] sm:text-xs text-gray-500">Use a strong password</p>
                  <button 
                    type="button"
                    onClick={() => setShowForgotPassword(true)}
                    className="text-[10px] sm:text-xs text-primary-400 hover:text-primary-300 transition-colors duration-200 font-medium hover:underline underline-offset-2"
                    disabled={loading}
                  >
                    Forgot Password?
                  </button>
                </div>
              </div>

              <div className="flex items-center">
                <label className="flex items-center gap-1.5 cursor-pointer group select-none">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="peer w-3.5 h-3.5 sm:w-4 sm:h-4 rounded border-2 border-gray-600 bg-gray-800/50 text-primary-600 focus:ring-2 focus:ring-primary-500/30 transition-all cursor-pointer checked:bg-primary-600 checked:border-primary-600 disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={loading}
                    />
                    <div className="absolute inset-0 rounded bg-primary-500/20 scale-0 peer-checked:scale-100 transition-transform pointer-events-none"></div>
                  </div>
                  <span className="text-xs text-gray-400 group-hover:text-gray-300 transition-colors font-medium">
                    Keep me signed in
                  </span>
                </label>
              </div>

              <button
                type="submit"
                disabled={loading || !captchaLoaded}
                className="w-full bg-gradient-to-r from-primary-600 via-purple-600 to-blue-600 hover:from-primary-700 hover:via-purple-700 hover:to-blue-700 disabled:from-gray-700 disabled:via-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed text-white py-2.5 sm:py-3 rounded-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 font-bold text-xs sm:text-sm shadow-2xl hover:shadow-primary-500/50 disabled:shadow-none group relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000"></div>
                
                <span className="relative flex items-center gap-1.5">
                  {loading && <Loader size={14} className="animate-spin" />}
                  <span>{loading ? 'Signing In...' : !captchaLoaded ? 'Loading Security...' : 'Sign In'}</span>
                  {!loading && captchaLoaded && <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />}
                </span>
              </button>
            </form>

            <div className="relative my-3 sm:my-4 md:my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-700/50"></div>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-2 bg-gray-900 text-gray-500 font-medium">New here?</span>
              </div>
            </div>

            <button 
              type="button"
              onClick={() => setShowRegister(true)}
              className="w-full bg-gray-800/50 hover:bg-gray-800/80 backdrop-blur-sm border-2 border-gray-700/50 hover:border-primary-500/50 text-white py-2.5 sm:py-3 rounded-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 font-bold text-xs sm:text-sm shadow-lg group relative overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading}
            >
              <span className="relative flex items-center gap-1.5">
                <UserCircle size={14} className="group-hover:rotate-12 transition-transform" />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-purple-400 group-hover:from-primary-300 group-hover:to-purple-300">
                  Create Account
                </span>
                <ArrowRight size={14} className="text-primary-400 group-hover:translate-x-1 transition-transform" />
              </span>
            </button>

            <div className="mt-3 sm:mt-4 md:mt-5 bg-gradient-to-br from-blue-900/20 to-purple-900/20 border border-blue-500/20 rounded-xl p-2 sm:p-3 backdrop-blur-sm hover:scale-[1.02] transition-all duration-300 shadow-lg">
              <div className="flex items-start gap-2">
                <div className="h-5 w-5 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-lg">
                  <span className="text-[10px] text-white font-bold">i</span>
                </div>
                <div className="flex-1">
                  <p className="text-[10px] sm:text-xs text-blue-100/90 leading-relaxed">
                    <strong className="text-blue-50 font-semibold block mb-0.5">First time?</strong>
                    Use the User ID provided during registration.
                  </p>
                </div>
              </div>
            </div>

            {captchaLoaded && (
              <div className="mt-2 sm:mt-3 flex items-center justify-center gap-1.5 text-[10px] text-gray-500">
                <Shield size={10} className="text-green-500" />
                <span>Protected by reCAPTCHA</span>
              </div>
            )}

            <div className="mt-3 sm:mt-4 text-center">
              <p className="text-[10px] text-gray-500 leading-relaxed">
                By continuing, you agree to our{' '}
                <a 
                  href="/terms-of-service" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary-400 hover:text-primary-300 underline underline-offset-2 transition-colors font-medium"
                >
                  Terms
                </a>
                {' '}and{' '}
                <a 
                  href="/privacy-policy" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary-400 hover:text-primary-300 underline underline-offset-2 transition-colors font-medium"
                >
                  Privacy
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
