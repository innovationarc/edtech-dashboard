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
  
  // EXISTING: State management
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
  
  // NEW: Display-only formatted User ID (for UI presentation)
  const [displayUserId, setDisplayUserId] = useState('');
  
  // EXISTING: Account status modal state
  const [showAccountStatusModal, setShowAccountStatusModal] = useState(false);
  const [accountStatus, setAccountStatus] = useState<'inactive' | 'pending' | null>(null);
  const [accountUserId, setAccountUserId] = useState<string | undefined>(undefined);

  // EXISTING: Load reCAPTCHA v3
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

  // NEW: Load remember me preference on mount
  useEffect(() => {
    try {
      const savedRememberMe = localStorage.getItem('auth_remember_me');
      const savedUserId = localStorage.getItem('auth_user_id');
      
      if (savedRememberMe === 'true' && savedUserId) {
        setRememberMe(true);
        setUserId(savedUserId);
        setDisplayUserId(savedUserId); // Set display value as well
      }
    } catch {
      // Fail silently if localStorage not available
    }
  }, []);

  // EXISTING: Get reCAPTCHA v3 token
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

  // NEW: Format User ID input with auto-formatting: XX-YYMM-XXXXX
  const formatUserIdInput = (input: string): { display: string; value: string } => {
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
    
    return { display, value };
  };

  // NEW: Handle User ID input change with formatting
  const handleUserIdChange = (input: string) => {
    const formatted = formatUserIdInput(input);
    setDisplayUserId(formatted.display);
    setUserId(formatted.value);
    
    // Clear errors on input change
    if (error) {
      setError('');
    }
  };

  // EXISTING: Handle submit with ENHANCED error handling
  const handleSubmit = async () => {
    setError('');
    setLoading(true);

    if (!userId || !password) {
      setError('Please fill in all fields');
      setLoading(false);
      return;
    }

    // EXISTING: Get reCAPTCHA token (note: now non-blocking in authService)
    try {
      await getCaptchaToken();
    } catch (err) {
      setError('Please wait for security verification to load');
      setLoading(false);
      return;
    }

    try {
      // EXISTING: Call handleSignIn with remember me flag
      await handleSignIn(userId, password, rememberMe);
      onClose();
    } catch (err: any) {
      // EXISTING: Check if it's an AccountStatusError
      if (err instanceof AccountStatusError) {
        setAccountStatus(err.status);
        setAccountUserId(err.userId);
        setShowAccountStatusModal(true);
      } else {
        // ENHANCED: All auth errors now show as "Invalid credentials"
        setError(err.message || 'Invalid credentials');
      }
    } finally {
      setLoading(false);
    }
  };

  // EXISTING: Handle key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading && captchaLoaded) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // EXISTING: Handle register success
  const handleRegisterSuccess = () => {
    setShowRegister(false);
  };

  // EXISTING: Handle forgot password success
  const handleForgotPasswordSuccess = () => {
    setShowForgotPassword(false);
  };

  // EXISTING: Handle account status close
  const handleAccountStatusClose = () => {
    setShowAccountStatusModal(false);
    setAccountStatus(null);
    setAccountUserId(undefined);
  };

  // EXISTING: Handle sign in another account
  const handleSignInAnotherAccount = () => {
    setShowAccountStatusModal(false);
    setAccountStatus(null);
    setAccountUserId(undefined);
    setUserId('');
    setDisplayUserId(''); // NEW: Clear display value too
    setPassword('');
    setError('');
  };

  // EXISTING: Show AccountStatusModal if account is not active
  if (showAccountStatusModal && accountStatus) {
    return (
      <AccountStatusModal
        status={accountStatus}
        userId={accountUserId}
        onClose={handleAccountStatusClose}
        onSignInAnotherAccount={handleSignInAnotherAccount}
      />
    );
  }

  // EXISTING: Show forgot password modal
  if (showForgotPassword) {
    return (
      <ForgotPasswordModal
        onClose={() => setShowForgotPassword(false)}
        onSuccess={handleForgotPasswordSuccess}
      />
    );
  }

  // EXISTING: Show forgot user ID modal
  if (showForgotUserId) {
    return (
      <ForgotUserIdModal
        onClose={() => setShowForgotUserId(false)}
        onSignInClick={() => setShowForgotUserId(false)}
      />
    );
  }

  // EXISTING: Show register modal
  if (showRegister) {
    return (
      <RegisterModal 
        onClose={() => setShowRegister(false)} 
        onSuccess={handleRegisterSuccess}
      />
    );
  }

  // EXISTING: Main sign in modal UI
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-lg flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-gradient-to-br from-gray-900 via-slate-900 to-gray-900 rounded-3xl w-full max-w-md relative shadow-2xl border border-gray-700/50 my-8 animate-in fade-in duration-300">
        {/* EXISTING: Decorative gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary-500/10 via-purple-500/10 to-blue-500/10 rounded-3xl pointer-events-none"></div>
        
        {/* EXISTING: Animated background pattern */}
        <div className="absolute inset-0 opacity-5 rounded-3xl overflow-hidden pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-br from-primary-500 via-purple-500 to-blue-500 animate-pulse"></div>
        </div>
        
        {/* EXISTING: Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-400 hover:text-white transition-all duration-200 hover:rotate-90 hover:scale-110 z-10"
        >
          <X size={24} />
        </button>

        <div className="relative p-8">
          {/* EXISTING: Header with logo and title */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <div className="relative">
                <div className="absolute inset-0 bg-primary-500/30 blur-2xl"></div>
                <div className="relative bg-gradient-to-br from-primary-500 to-purple-600 rounded-full p-4 shadow-2xl shadow-primary-500/50">
                  <Lock size={48} className="text-white" />
                </div>
              </div>
            </div>
            <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary-400 via-purple-400 to-blue-500 mb-2">
              Welcome Back
            </h2>
            <p className="text-gray-400 text-sm">
              Sign in to access your dashboard
            </p>
          </div>

          {/* EXISTING: Error message display */}
          {error && (
            <div className="bg-red-900/40 border border-red-700/50 text-red-200 px-4 py-3 rounded-xl mb-6 backdrop-blur-sm animate-in fade-in slide-in-from-top-2 duration-300">
              <p className="text-sm flex items-center gap-2">
                <AlertCircle size={16} />
                {error}
              </p>
            </div>
          )}

          {/* EXISTING: Sign in form */}
          <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="space-y-6">
            {/* ENHANCED: User ID Input with auto-formatting */}
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

            {/* EXISTING: Password Input */}
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

            {/* EXISTING: Remember Me Checkbox */}
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

            {/* EXISTING: Sign In Button */}
            <button
              type="submit"
              disabled={loading || !captchaLoaded}
              className="w-full bg-gradient-to-r from-primary-600 via-purple-600 to-blue-600 hover:from-primary-700 hover:via-purple-700 hover:to-blue-700 disabled:from-gray-700 disabled:via-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed text-white py-4 rounded-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3 font-bold text-base shadow-2xl hover:shadow-primary-500/50 disabled:shadow-none group relative overflow-hidden"
            >
              {/* EXISTING: Button gradient overlay animation */}
              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000"></div>
              
              <span className="relative flex items-center gap-3">
                {loading && <Loader size={20} className="animate-spin" />}
                <span>{loading ? 'Signing In...' : !captchaLoaded ? 'Loading Security...' : 'Sign In'}</span>
                {!loading && captchaLoaded && <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />}
              </span>
            </button>
          </form>

          {/* EXISTING: Divider */}
          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-700/50"></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-4 bg-gray-900 text-gray-500 font-medium">New to our platform?</span>
            </div>
          </div>

          {/* EXISTING: Create Account Button */}
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

          {/* EXISTING: Info Box */}
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

          {/* EXISTING: Security Badge */}
          {captchaLoaded && (
            <div className="mt-5 flex items-center justify-center gap-2 text-xs text-gray-500">
              <Shield size={14} className="text-green-500" />
              <span>Protected by reCAPTCHA</span>
            </div>
          )}

          {/* EXISTING: Terms and Privacy Notice */}
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
  );
};

export default SignInModal;
