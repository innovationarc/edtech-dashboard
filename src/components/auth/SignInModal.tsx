// src/components/auth/SignInModal.tsx
import { useState, useEffect } from 'react';
import { X, Lock, Loader, CreditCard, AlertCircle, Eye, EyeOff, UserCircle, Shield, ArrowRight, LogOut } from 'lucide-react';
import { useDashboard } from '../../contexts/DashboardContext';
import { AccountStatusError } from '../../services/authService';
import RegisterModal from './RegisterModal';
import ForgotPasswordModal from './ForgotPasswordModal';
import ForgotUserIdModal from './ForgotUserIdModal';
import AccountStatusModal from './AccountStatusModal';
import { useRecaptcha } from '../../hooks/useRecaptcha';

// ─── Self-contained color tokens (no external config needed) ───────────────
const C = {
  primary300: '#a5b4fc',
  primary400: '#818cf8',
  primary500: '#6366f1',
  primary600: '#4f46e5',
  primary700: '#4338ca',
  purple400:  '#c084fc',
  purple500:  '#a855f7',
  purple600:  '#9333ea',
  purple700:  '#7e22ce',
  blue600:    '#2563eb',
  blue700:    '#1d4ed8',
  // text
  gray300: '#d1d5db',
  gray400: '#9ca3af',
  gray500: '#6b7280',
  white:   '#ffffff',
  red200:  '#fecaca',
  red400:  '#f87171',
  green500:'#22c55e',
} as const;

const SIGN_IN_STYLES = `
  @keyframes sin-shake {
    0%,100% { transform: translateX(0); }
    20%      { transform: translateX(-6px); }
    40%      { transform: translateX(6px); }
    60%      { transform: translateX(-4px); }
    80%      { transform: translateX(4px); }
  }
  [data-sin] .sin-shake { animation: sin-shake 0.4s ease-in-out; }

  [data-sin] .sin-input:focus {
    border-color: #6366f1 !important;
    box-shadow: 0 0 0 4px rgba(99,102,241,0.15) !important;
    outline: none !important;
  }

  [data-sin] .sin-icon-hover:hover { color: #818cf8; }

  [data-sin] .sin-link {
    color: #818cf8 !important;
    font-weight: 500;
    text-decoration: underline;
    text-underline-offset: 2px;
    transition: color 0.2s;
  }
  [data-sin] .sin-link:hover { color: #a5b4fc !important; }

  [data-sin] .sin-checkbox-box {
    background: rgba(31,41,55,0.5);
    border: 2px solid #4b5563;
    transition: background 0.3s, border-color 0.3s;
  }
  [data-sin] .sin-checkbox-input:checked + .sin-checkbox-box {
    background: linear-gradient(to bottom right, #6366f1, #9333ea);
    border-color: #6366f1;
  }
  [data-sin] .sin-checkbox-label:hover .sin-checkbox-box { border-color: rgba(99,102,241,0.5); }

  [data-sin] .sin-checkbox-check {
    width: 10px; height: 10px;
    color: white;
    transition: opacity 0.2s, transform 0.2s;
  }
  [data-sin] .sin-checkbox-input:not(:checked) ~ .sin-checkbox-check {
    opacity: 0; transform: scale(0);
  }
  [data-sin] .sin-checkbox-input:checked ~ .sin-checkbox-check {
    opacity: 1; transform: scale(1);
  }

  [data-sin] .sin-btn-primary {
    background: linear-gradient(to right, #4f46e5, #9333ea, #2563eb);
    transition: background 0.3s, transform 0.15s, box-shadow 0.3s;
  }
  [data-sin] .sin-btn-primary:hover:not(:disabled) {
    background: linear-gradient(to right, #4338ca, #7e22ce, #1d4ed8);
    transform: scale(1.02);
    box-shadow: 0 10px 30px rgba(99,102,241,0.4);
  }
  [data-sin] .sin-btn-primary:active:not(:disabled) { transform: scale(0.98); }
  [data-sin] .sin-btn-primary:disabled {
    background: linear-gradient(to right, #374151, #374151, #374151);
    cursor: not-allowed;
    box-shadow: none;
  }

  [data-sin] .sin-btn-secondary { transition: background 0.2s, border-color 0.2s, transform 0.15s; }
  [data-sin] .sin-btn-secondary:hover:not(:disabled) {
    border-color: rgba(99,102,241,0.5);
    transform: scale(1.02);
  }
  [data-sin] .sin-btn-secondary:active:not(:disabled) { transform: scale(0.98); }

  [data-sin] .sin-account-btn:hover { background: rgba(31,41,55,0.8); }

  [data-sin] .sin-shimmer {
    position: absolute; inset: 0;
    background: linear-gradient(to right, transparent, rgba(255,255,255,0.2), transparent);
    transform: translateX(-200%);
    transition: transform 1s;
  }
  [data-sin] .sin-btn-primary:hover .sin-shimmer,
  [data-sin] .sin-btn-secondary:hover .sin-shimmer { transform: translateX(200%); }

  [data-sin] .sin-info-box:hover { transform: scale(1.02); }
  [data-sin] .sin-info-box { transition: transform 0.3s; }
`;

interface SignInModalProps {
  onClose: () => void;
}

const SignInModal = ({ onClose }: SignInModalProps) => {
  const { handleSignIn, forcedLogoutMessage, setForcedLogoutMessage } = useDashboard();
  const { executeRecaptcha } = useRecaptcha();

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
  const [captchaReady, setCaptchaReady] = useState(false);
  const [displayUserId, setDisplayUserId] = useState('');
  const [showAccountStatusModal, setShowAccountStatusModal] = useState(false);
  const [accountStatus, setAccountStatus] = useState<'inactive' | 'pending' | null>(null);
  const [accountUserId, setAccountUserId] = useState<string | undefined>(undefined);

  // Poll until grecaptcha is ready (script loaded globally in App.tsx)
  useEffect(() => {
    if (window.grecaptcha) {
      setCaptchaReady(true);
      return;
    }
    const interval = setInterval(() => {
      if (window.grecaptcha) {
        setCaptchaReady(true);
        clearInterval(interval);
      }
    }, 200);
    return () => clearInterval(interval);
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
      await executeRecaptcha('sign_in');
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
    <div data-sin="" className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[80] overflow-y-auto">
      <style>{SIGN_IN_STYLES}</style>
      <div className="flex justify-center min-h-full p-3 sm:p-4 md:p-6 items-start" style={{paddingTop: '12px'}}>
      <div className="bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-[400px] sm:max-w-md md:max-w-lg border border-gray-700/50 relative overflow-hidden mt-4 sm:mt-6 md:mt-0">
        {/* Animated background effects */}
        <div className="absolute inset-0 pointer-events-none" style={{background: 'linear-gradient(to bottom right, rgba(99,102,241,0.05), rgba(168,85,247,0.05), rgba(37,99,235,0.05))'}}></div>
        <div className="absolute -top-24 -right-24 w-48 h-48 rounded-full blur-3xl pointer-events-none" style={{background: 'rgba(99,102,241,0.1)'}}></div>
        <div className="absolute -bottom-24 -left-24 w-48 h-48 rounded-full blur-3xl pointer-events-none" style={{background: 'rgba(168,85,247,0.1)'}}></div>

        <div className="relative">
          {/* Header */}
          <div className="flex items-center justify-between p-4 sm:p-5 md:p-6 border-b border-gray-700/50">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="h-8 w-8 sm:h-9 sm:w-9 md:h-10 md:w-10 rounded-xl flex items-center justify-center shadow-lg" style={{background: `linear-gradient(to bottom right, ${C.primary500}, ${C.purple600})`}}>
                <Lock size={16} className="sm:w-[18px] sm:h-[18px] md:w-5 md:h-5" style={{color: C.white}} />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl md:text-2xl font-bold" style={{background: `linear-gradient(to right, ${C.primary300}, ${C.purple400})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text'}}>
                  Welcome Back
                </h2>
                <p className="text-[10px] sm:text-xs mt-0.5" style={{color: C.gray400}}>Sign in to continue</p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={loading}
              className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl bg-gray-800/50 hover:bg-gray-700/50 backdrop-blur-sm flex items-center justify-center transition-all duration-300 group border border-gray-700/30 hover:border-gray-600/50 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Close modal"
            >
              <X size={16} className="sm:w-[18px] sm:h-[18px] transition-colors" style={{color: C.gray400}} />
            </button>
          </div>

          {/* Content */}
          <div className="p-4 sm:p-5 md:p-6 space-y-3 sm:space-y-4">

            {/* Forced Logout Banner */}
            {forcedLogoutMessage && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-2.5 sm:p-3 flex items-start gap-2">
                <LogOut size={16} className="sm:w-[18px] sm:h-[18px] flex-shrink-0 mt-0.5" style={{color: '#f59e0b'}} />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] sm:text-xs md:text-sm leading-snug font-medium" style={{color: '#fde68a'}}>
                    Session Terminated
                  </p>
                  <p className="text-[10px] sm:text-[11px] leading-snug mt-0.5" style={{color: '#fcd34d'}}>
                    {(() => {
                      const ipMatch = forcedLogoutMessage?.match(/\[IP:\s*([\d.a-fA-F:]+)\]/);
                      if (!ipMatch) return forcedLogoutMessage;
                      const [full, ip] = ipMatch;
                      const parts = forcedLogoutMessage!.split(full);
                      return <>{parts[0]}<span style={{color: '#fb923c', fontWeight: 600}}>[IP: {ip}]</span>{parts[1]}</>;
                    })()}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setForcedLogoutMessage(null)}
                  className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity"
                  aria-label="Dismiss"
                >
                  <X size={12} style={{color: '#f59e0b'}} />
                </button>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="sin-shake bg-red-500/10 border border-red-500/30 rounded-xl p-2.5 sm:p-3 flex items-start gap-2">
                <AlertCircle size={16} className="sm:w-[18px] sm:h-[18px] flex-shrink-0 mt-0.5" style={{color: C.red400}} />
                <p className="text-[11px] sm:text-xs md:text-sm leading-snug" style={{color: C.red200}}>{error}</p>
              </div>
            )}

            {/* Sign In Form */}
            <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="space-y-3 sm:space-y-4">
              {/* User ID Input */}
              <div className="group">
                <label className="block text-xs md:text-sm font-semibold mb-1 md:mb-1.5 flex items-center gap-1 md:gap-1.5" style={{color: C.gray300}}>
                  <CreditCard size={12} className="md:w-[14px] md:h-[14px]" style={{color: C.primary400}} />
                  User ID
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={displayUserId}
                    onChange={(e) => handleUserIdChange(e.target.value)}
                    onKeyPress={handleKeyPress}
                    className="sin-input w-full bg-gray-800/50 rounded-xl py-2 md:py-3.5 pl-8 md:pl-11 pr-3 border-2 border-gray-700/50 focus:outline-none transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wide text-xs md:text-base"
                    style={{ borderWidth: '2px', borderStyle: 'solid', borderColor: 'rgba(55,65,81,0.5)', outline: 'none', color: C.white }}
                    placeholder="ST-2601-00001"
                    disabled={loading}
                    autoComplete="username"
                    maxLength={13}
                  />
                  <CreditCard size={14} className="sin-icon-hover md:w-[18px] md:h-[18px] absolute left-2.5 md:left-4 top-2 md:top-3.5 transition-colors pointer-events-none" style={{color: C.gray500}} />
                </div>
                <div className="flex items-center justify-between -mt-2 md:mt-1">
                  <p className="text-[10px] md:text-xs" style={{color: C.gray500}}>Format: XX-YYMM-XXXXX</p>
                  <button 
                    type="button"
                    onClick={() => setShowForgotUserId(true)}
                    className="sin-link text-[10px] md:text-xs transition-colors duration-200"
                    disabled={loading}
                  >
                    Forgot User ID?
                  </button>
                </div>
              </div>

              {/* Password Input */}
              <div className="group">
                <label className="block text-xs md:text-sm font-semibold mb-1 md:mb-1.5 flex items-center gap-1 md:gap-1.5" style={{color: C.gray300}}>
                  <Lock size={12} className="md:w-[14px] md:h-[14px]" style={{color: C.primary400}} />
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyPress={handleKeyPress}
                    className="sin-input w-full bg-gray-800/50 rounded-xl py-2 md:py-3.5 pl-8 md:pl-11 pr-8 md:pr-12 border-2 border-gray-700/50 focus:outline-none transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed text-xs md:text-base"
                    style={{ borderWidth: '2px', borderStyle: 'solid', borderColor: 'rgba(55,65,81,0.5)', outline: 'none', color: C.white }}
                    placeholder="Enter your password"
                    disabled={loading}
                    autoComplete="current-password"
                  />
                  <Lock size={14} className="sin-icon-hover md:w-[18px] md:h-[18px] absolute left-2.5 md:left-4 top-2 md:top-3.5 transition-colors pointer-events-none" style={{color: C.gray500}} />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 transition-colors duration-200"
                    style={{color: C.gray500}}
                    disabled={loading}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={14} className="md:w-[18px] md:h-[18px]" /> : <Eye size={14} className="md:w-[18px] md:h-[18px]" />}
                  </button>
                </div>
                <div className="flex items-center justify-between -mt-2 md:mt-1">
                  <p className="text-[10px] md:text-xs" style={{color: C.gray500}}>Use a strong password</p>
                  <button 
                    type="button"
                    onClick={() => setShowForgotPassword(true)}
                    className="sin-link text-[10px] md:text-xs transition-colors duration-200"
                    disabled={loading}
                  >
                    Forgot Password?
                  </button>
                </div>
              </div>

              {/* Remember Me Checkbox */}
              <div className="flex items-center pt-0.5 md:pt-1">
                <label className="flex items-center gap-2 md:gap-2.5 cursor-pointer select-none sin-checkbox-label">
                  <div className="relative w-4 h-4 md:w-5 md:h-5 flex-shrink-0">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="sr-only"
                      disabled={loading}
                    />
                    <div
                      className="w-4 h-4 md:w-5 md:h-5 rounded flex items-center justify-center transition-all duration-300"
                      style={{
                        border: '2px solid',
                        borderColor: rememberMe ? C.primary500 : '#4b5563',
                        background: rememberMe
                          ? `linear-gradient(to bottom right, ${C.primary500}, ${C.purple600})`
                          : 'rgba(31,41,55,0.5)',
                        opacity: loading ? 0.5 : 1,
                        cursor: loading ? 'not-allowed' : 'pointer',
                      }}
                    >
                      <svg
                        className="w-2.5 h-2.5 md:w-3 md:h-3 transition-all duration-300"
                        style={{ opacity: rememberMe ? 1 : 0, transform: rememberMe ? 'scale(1)' : 'scale(0)', color: C.white }}
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
                  <span className="text-xs md:text-sm transition-colors font-medium" style={{color: C.gray400}}>
                    Keep me signed in
                  </span>
                </label>
              </div>

              {/* Sign In Button */}
              <button
                type="submit"
                disabled={loading || !captchaReady}
                className="sin-btn-primary w-full py-2.5 md:py-3.5 rounded-xl flex items-center justify-center gap-2 md:gap-2.5 font-bold text-xs md:text-base shadow-2xl group relative overflow-hidden"
                style={{color: C.white}}
              >
                <div className="sin-shimmer"></div>
                <span className="relative flex items-center gap-2 md:gap-2.5">
                  {loading && <Loader size={15} className="md:w-[18px] md:h-[18px] animate-spin" />}
                  <span>{loading ? 'Signing In...' : !captchaReady ? 'Loading Security...' : 'Sign In'}</span>
                  {!loading && captchaReady && <ArrowRight size={15} className="md:w-[18px] md:h-[18px] group-hover:translate-x-1 transition-transform" />}
                </span>
              </button>
            </form>

            {/* Divider */}
            <div className="relative my-3.5 md:my-5.5">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-700/50"></div>
              </div>
              <div className="relative flex justify-center text-[10px] md:text-xs">
                <span className="px-2.5 md:px-4 bg-gray-900 font-medium" style={{color: C.gray300}}>New to our platform?</span>
              </div>
            </div>

            {/* Create Account Button */}
            <button 
              type="button"
              onClick={() => setShowRegister(true)}
              className="sin-btn-secondary sin-account-btn w-full bg-gray-800/50 border-2 border-gray-700/50 py-2.5 md:py-3.5 rounded-xl flex items-center justify-center gap-2 md:gap-2.5 font-bold text-xs md:text-base shadow-lg group relative overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed"
              style={{color: C.white}}
              disabled={loading}
            >
              <span className="relative flex items-center gap-2 md:gap-2.5">
                <UserCircle size={15} className="md:w-[18px] md:h-[18px] group-hover:rotate-12 transition-transform" />
                <span style={{background: `linear-gradient(to right, ${C.primary400}, ${C.purple400})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text'}}>
                  Create New Account
                </span>
                <ArrowRight size={15} className="md:w-[18px] md:h-[18px] group-hover:translate-x-1 transition-transform" style={{color: C.primary400}} />
              </span>
            </button>

            {/* Info Box */}
            <div className="sin-info-box mt-3.5 md:mt-5.5 border rounded-xl p-2.5 md:p-4 shadow-lg" style={{background: 'linear-gradient(to bottom right, rgba(30,58,138,0.2), rgba(88,28,135,0.2))', borderColor: 'rgba(59,130,246,0.2)'}}>
              <div className="flex items-start gap-2 md:gap-2.5">
                <div className="h-5 w-5 md:h-7 md:w-7 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg" style={{background: 'linear-gradient(to bottom right, #3b82f6, #9333ea)'}}>
                  <span className="text-[10px] md:text-sm font-bold" style={{color: C.white}}>i</span>
                </div>
                <div className="flex-1">
                  <p className="text-[10px] md:text-xs leading-relaxed" style={{color: 'rgba(219,234,254,0.9)'}}>
                    <strong className="font-semibold block mb-0.5 md:mb-1" style={{color: '#eff6ff'}}>First time signing in?</strong>
                    Use the User ID provided during registration along with your password to access your account.
                  </p>
                </div>
              </div>
            </div>

            {/* Security Badge */}
            {captchaReady && (
              <div className="mt-2.5 md:mt-3.5 flex items-center justify-center gap-1 md:gap-1.5 text-xs">
                <Shield size={11} className="md:w-3.5 md:h-3.5" style={{color: C.green500}} />
                <span className="text-[9px] md:text-xs" style={{color: C.gray500}}>Protected by reCAPTCHA</span>
              </div>
            )}

            {/* Terms and Privacy Notice */}
            <div className="mt-2.5 md:mt-4.5 text-center pb-1">
              <p className="text-[9px] md:text-xs leading-relaxed px-1" style={{color: C.gray500}}>
                By continuing, you agree to our{' '}
                <a 
                  href="/terms-of-service" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="sin-link"
                >
                  Terms of Service
                </a>
                {' '}and{' '}
                <a 
                  href="/privacy-policy" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="sin-link"
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
