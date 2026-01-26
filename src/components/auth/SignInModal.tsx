// src/components/auth/SignInModal.tsx
import { useState, useEffect } from 'react';
import { X, Lock, Loader, Smartphone, CreditCard, AlertCircle, Mail, Phone, Eye, EyeOff } from 'lucide-react';
import { useDashboard } from '../../contexts/DashboardContext';
import RegisterModal from './RegisterModal';
import ForgotPasswordModal from './ForgotPasswordModal';

interface SignInModalProps {
  onClose: () => void;
}

const SignInModal = ({ onClose }: SignInModalProps) => {
  const { handleSignIn } = useDashboard();
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [captchaLoaded, setCaptchaLoaded] = useState(false);

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

  const handleSubmit = async () => {
    setError('');
    setLoading(true);

    if (!loginId || !password) {
      setError('Please fill in all fields');
      setLoading(false);
      return;
    }

    // Get reCAPTCHA token
    try {
      await getCaptchaToken();
    } catch (err) {
      setError('Please wait for security verification to load');
      setLoading(false);
      return;
    }

    try {
      await handleSignIn(loginId, password, rememberMe);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading && captchaLoaded) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleRegisterSuccess = () => {
    setShowRegister(false);
  };

  const handleForgotPasswordSuccess = () => {
    setShowForgotPassword(false);
  };

  if (showForgotPassword) {
    return (
      <ForgotPasswordModal
        onClose={() => setShowForgotPassword(false)}
        onSuccess={handleForgotPasswordSuccess}
      />
    );
  }

  if (showRegister) {
    return (
      <RegisterModal 
        onClose={() => setShowRegister(false)} 
        onSuccess={handleRegisterSuccess}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-3xl w-full max-w-md p-6 sm:p-8 relative shadow-2xl border border-gray-700/50">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-500/5 to-purple-500/5 rounded-3xl pointer-events-none"></div>
        
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-400 hover:text-white transition-all duration-200 hover:rotate-90 hover:scale-110 z-10"
          disabled={loading}
        >
          <X size={24} />
        </button>

        <div className="relative">
          <div className="text-center mb-6 sm:mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-primary-500 via-purple-600 to-primary-500 mb-4 shadow-2xl shadow-primary-500/50 hover:scale-110 transition-transform duration-300">
              <CreditCard size={32} className="sm:w-10 sm:h-10 text-white" />
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary-400 via-purple-400 to-primary-500 mb-2">
              Welcome Back
            </h2>
            <p className="text-gray-400 text-sm">Sign in to continue learning</p>
          </div>

          {error && (
            <div className="bg-red-900/40 border border-red-700/50 text-red-200 px-4 py-3 rounded-xl mb-6 backdrop-blur-sm">
              <p className="text-sm flex items-center gap-2">
                <AlertCircle size={16} />
                {error}
              </p>
            </div>
          )}

          <div className="space-y-4 sm:space-y-5">
            <div className="group">
              <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                <Smartphone size={16} />
                Student ID, Phone, or Email
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="w-full bg-gray-800/60 backdrop-blur-xl text-white rounded-xl py-3.5 pl-11 pr-4 border border-gray-700/50 focus:border-primary-500/50 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all duration-200 group-hover:border-gray-600"
                  placeholder="ST-2601-00001, phone, or email"
                  disabled={loading}
                />
                <div className="absolute left-3.5 top-3.5 text-gray-400 group-hover:text-primary-400 transition-colors">
                  {loginId.includes('@') ? (
                    <Mail size={18} />
                  ) : loginId.startsWith('ST-') || loginId.startsWith('st-') ? (
                    <CreditCard size={18} />
                  ) : (
                    <Phone size={18} />
                  )}
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-1.5">Enter your Student ID, phone number, or email</p>
            </div>

            <div className="group">
              <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                <Lock size={16} />
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="w-full bg-gray-800/60 backdrop-blur-xl text-white rounded-xl py-3.5 pl-11 pr-11 border border-gray-700/50 focus:border-primary-500/50 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all duration-200 group-hover:border-gray-600"
                  placeholder="Enter your password"
                  disabled={loading}
                />
                <Lock size={18} className="absolute left-3.5 top-3.5 text-gray-400 group-hover:text-primary-400 transition-colors" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3.5 text-gray-400 hover:text-white transition-colors"
                  disabled={loading}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-primary-600 focus:ring-2 focus:ring-primary-500/20 transition-all cursor-pointer"
                  disabled={loading}
                />
                <span className="text-sm text-gray-400 group-hover:text-gray-300 transition-colors select-none">
                  Remember me
                </span>
              </label>

              <button 
                onClick={() => setShowForgotPassword(true)}
                className="text-sm text-primary-400 hover:text-primary-300 transition-colors duration-200"
                disabled={loading}
              >
                Forgot password?
              </button>
            </div>

            <button
              onClick={handleSubmit}
              disabled={loading || !captchaLoaded}
              className="w-full bg-gradient-to-r from-primary-600 via-purple-600 to-primary-600 hover:from-primary-700 hover:via-purple-700 hover:to-primary-700 disabled:from-gray-700 disabled:to-gray-800 disabled:cursor-not-allowed text-white py-4 rounded-xl transition-all duration-300 active:scale-95 flex items-center justify-center gap-2 font-semibold shadow-2xl hover:shadow-primary-500/50"
            >
              {loading && <Loader size={20} className="animate-spin" />}
              <span>{loading ? 'Signing In...' : !captchaLoaded ? 'Loading Security...' : 'Sign In'}</span>
            </button>
          </div>

          <div className="mt-6 sm:mt-8 pt-6 border-t border-gray-700/50">
            <p className="text-sm text-gray-400 text-center">
              Don't have an account?{' '}
              <button 
                onClick={() => setShowRegister(true)}
                className="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-purple-500 hover:from-primary-300 hover:to-purple-400 transition-all duration-200 font-semibold"
                disabled={loading}
              >
                Create one here
              </button>
            </p>
          </div>

          <div className="mt-6 bg-gradient-to-r from-blue-900/30 to-purple-900/30 border border-blue-700/30 rounded-xl p-4 backdrop-blur-xl hover:scale-105 transition-transform duration-300">
            <div className="flex items-start gap-3">
              <div className="h-6 w-6 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-lg">
                <span className="text-xs text-white font-bold">i</span>
              </div>
              <div>
                <p className="text-xs text-blue-200/90">
                  <strong className="text-blue-100">First time signing in?</strong> Use the Student ID provided during registration along with your password.
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
