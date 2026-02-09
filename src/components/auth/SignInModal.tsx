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
          setAccountStatus(null);
          setAccountUserId(undefined);
        }}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-md animate-fadeIn">
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
        .modal-viewport-wrapper {
          width: 100%;
          max-width: 28rem;
          padding: 1rem 1.5rem;
        }
        @media (max-width: 640px) {
          .modal-viewport-wrapper {
            padding: 0;
            max-width: 100%;
          }
          .modal-scale-container {
            transform: scale(0.75);
            transform-origin: center center;
          }
        }
        @media (min-width: 641px) and (max-width: 768px) {
          .modal-scale-container {
            transform: scale(0.85);
            transform-origin: center center;
          }
        }
      `}</style>
      
      <div className="modal-viewport-wrapper">
        <div className="modal-scale-container relative w-full max-w-md mx-auto">
          <div className="relative bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800/95 backdrop-blur-xl rounded-3xl shadow-[0_25px_80px_-15px_rgba(0,0,0,0.5)] border-2 border-gray-700/50 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary-500/5 via-purple-500/5 to-blue-500/5 pointer-events-none"></div>
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-primary-500/20 to-purple-500/20 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-tr from-blue-500/20 to-purple-500/20 rounded-full blur-3xl pointer-events-none"></div>
          
          <button
            onClick={onClose}
            className="absolute top-5 right-5 text-gray-400 hover:text-white transition-colors z-10 bg-gray-800/50 hover:bg-gray-700/50 backdrop-blur-sm p-2.5 rounded-xl border border-gray-700/50 hover:border-gray-600/50 hover:rotate-90 duration-300 group"
            disabled={loading}
          >
            <X size={20} className="group-hover:scale-110 transition-transform" />
          </button>

          <div className="relative p-10">
            <div className="text-center mb-9">
              <div className="mb-5 flex justify-center">
                <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary-500 via-purple-600 to-blue-600 flex items-center justify-center shadow-2xl shadow-primary-500/50 hover:scale-110 hover:rotate-6 transition-all duration-300">
                  <Lock size={32} className="text-white" />
                </div>
              </div>
              <h2 className="text-3xl font-bold text-white mb-2.5 tracking-tight">Welcome Back</h2>
              <p className="text-gray-400 text-sm font-medium">Sign in to access your account</p>
            </div>

            {error && (
              <div className="mb-6 bg-red-900/30 border-2 border-red-500/50 text-red-200 px-5 py-4 rounded-xl flex items-center gap-3 shadow-lg animate-shake backdrop-blur-sm">
                <AlertCircle size={20} className="flex-shrink-0 text-red-400" />
                <p className="text-sm font-medium">{error}</p>
              </div>
            )}

            <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="space-y-6">
              <div className="group">
                <label className="block text-sm font-semibold text-gray-300 mb-2.5 flex items-center gap-2">
                  <CreditCard size={16} className="text-primary-400" />
                  User ID
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={displayUserId}
                    onChange={(e) => handleUserIdChange(e.target.value)}
                    onKeyPress={handleKeyPress}
                    className="w-full bg-gray-800/50 backdrop-blur-sm text-white rounded-xl py-4 pl-12 pr-4 border-2 border-gray-700/50 focus:border-primary-500 focus:outline-none focus:ring-4 focus:ring-primary-500/20 transition-all duration-300 placeholder:text-gray-500 group-hover:border-gray-600/70 disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wide"
                    placeholder="ST-2601-00001"
                    disabled={loading}
                    autoComplete="username"
                    maxLength={13}
                  />
                  <CreditCard size={20} className="absolute left-4 top-4 text-gray-500 group-hover:text-primary-400 transition-colors pointer-events-none" />
                </div>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-xs text-gray-500">Format: XX-YYMM-XXXXX</p>
                  <button 
                    type="button"
                    onClick={() => setShowForgotUserId(true)}
                    className="text-xs text-primary-400 hover:text-primary-300 transition-colors duration-200 font-medium hover:underline underline-offset-2"
                    disabled={loading}
                  >
                    Forgot User ID?
                  </button>
                </div>
              </div>

              <div className="group">
                <label className="block text-sm font-semibold text-gray-300 mb-2.5 flex items-center gap-2">
                  <Lock size={16} className="text-primary-400" />
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyPress={handleKeyPress}
                    className="w-full bg-gray-800/50 backdrop-blur-sm text-white rounded-xl py-4 pl-12 pr-12 border-2 border-gray-700/50 focus:border-primary-500 focus:outline-none focus:ring-4 focus:ring-primary-500/20 transition-all duration-300 placeholder:text-gray-500 group-hover:border-gray-600/70 disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder="Enter your password"
                    disabled={loading}
                    autoComplete="current-password"
                  />
                  <Lock size={20} className="absolute left-4 top-4 text-gray-500 group-hover:text-primary-400 transition-colors pointer-events-none" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-4 text-gray-500 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/5"
                    disabled={loading}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-xs text-gray-500">Use a strong password</p>
                  <button 
                    type="button"
                    onClick={() => setShowForgotPassword(true)}
                    className="text-xs text-primary-400 hover:text-primary-300 transition-colors duration-200 font-medium hover:underline underline-offset-2"
                    disabled={loading}
                  >
                    Forgot Password?
                  </button>
                </div>
              </div>

              <div className="flex items-center pt-1">
                <label className="flex items-center gap-3 cursor-pointer group select-none">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="peer w-5 h-5 rounded-md border-2 border-gray-600 bg-gray-800/50 text-primary-600 focus:ring-2 focus:ring-primary-500/30 transition-all cursor-pointer checked:bg-primary-600 checked:border-primary-600 disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={loading}
                    />
                    <div className="absolute inset-0 rounded-md bg-primary-500/20 scale-0 peer-checked:scale-100 transition-transform pointer-events-none"></div>
                  </div>
                  <span className="text-sm text-gray-400 group-hover:text-gray-300 transition-colors font-medium">
                    Keep me signed in
                  </span>
                </label>
              </div>

              <button
                type="submit"
                disabled={loading || !captchaLoaded}
                className="w-full bg-gradient-to-r from-primary-600 via-purple-600 to-blue-600 hover:from-primary-700 hover:via-purple-700 hover:to-blue-700 disabled:from-gray-700 disabled:via-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed text-white py-4 rounded-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3 font-bold text-base shadow-2xl hover:shadow-primary-500/50 disabled:shadow-none group relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000"></div>
                
                <span className="relative flex items-center gap-3">
                  {loading && <Loader size={20} className="animate-spin" />}
                  <span>{loading ? 'Signing In...' : !captchaLoaded ? 'Loading Security...' : 'Sign In'}</span>
                  {!loading && captchaLoaded && <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />}
                </span>
              </button>
            </form>

            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-700/50"></div>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-4 bg-gray-900 text-gray-500 font-medium">New to our platform?</span>
              </div>
            </div>

            <button 
              type="button"
              onClick={() => setShowRegister(true)}
              className="w-full bg-gray-800/50 hover:bg-gray-800/80 backdrop-blur-sm border-2 border-gray-700/50 hover:border-primary-500/50 text-white py-4 rounded-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3 font-bold text-base shadow-lg group relative overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading}
            >
              <span className="relative flex items-center gap-3">
                <UserCircle size={20} className="group-hover:rotate-12 transition-transform" />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-purple-400 group-hover:from-primary-300 group-hover:to-purple-300">
                  Create New Account
                </span>
                <ArrowRight size={20} className="text-primary-400 group-hover:translate-x-1 transition-transform" />
              </span>
            </button>

            <div className="mt-7 bg-gradient-to-br from-blue-900/20 to-purple-900/20 border border-blue-500/20 rounded-xl p-5 backdrop-blur-sm hover:scale-[1.02] transition-all duration-300 shadow-lg">
              <div className="flex items-start gap-3">
                <div className="h-7 w-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-lg">
                  <span className="text-sm text-white font-bold">i</span>
                </div>
                <div className="flex-1">
                  <p className="text-xs text-blue-100/90 leading-relaxed">
                    <strong className="text-blue-50 font-semibold block mb-1">First time signing in?</strong>
                    Use the User ID provided during registration along with your password to access your account.
                  </p>
                </div>
              </div>
            </div>

            {captchaLoaded && (
              <div className="mt-5 flex items-center justify-center gap-2 text-xs text-gray-500">
                <Shield size={14} className="text-green-500" />
                <span>Protected by reCAPTCHA</span>
              </div>
            )}

            <div className="mt-6 text-center">
              <p className="text-xs text-gray-500 leading-relaxed">
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
    </div>
  );
};

export default SignInModal;
