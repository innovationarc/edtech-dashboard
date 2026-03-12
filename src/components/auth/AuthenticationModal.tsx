// src/components/auth/AuthenticationModal.tsx
import React, { useState } from 'react';
import { LogIn, UserPlus, Shield, Lock, ArrowRight } from 'lucide-react';
import SignInModal from './SignInModal';
import RegisterModal from './RegisterModal';

// ─── Self-contained color tokens ───────────────────────────────────────────
const C = {
  primary300: '#a5b4fc',
  primary400: '#818cf8',
  primary500: '#6366f1',
  primary600: '#4f46e5',
  primary700: '#4338ca',
  purple300:  '#d8b4fe',
  purple400:  '#c084fc',
  purple600:  '#9333ea',
  purple700:  '#7e22ce',
  blue500:    '#3b82f6',
  gray400:    '#9ca3af',
  gray500:    '#6b7280',
  gray900:    '#111827',
  white:      '#ffffff',
  green500:   '#22c55e',
  blueLite:   'rgba(219,234,254,0.9)',
  blueXLite:  '#eff6ff',
} as const;

const AUTH_STYLES = `
  [data-auth] .modal-scroll::-webkit-scrollbar { width: 6px; }
  [data-auth] .modal-scroll::-webkit-scrollbar-track {
    background: rgba(31,41,55,0.3); border-radius: 10px;
  }
  [data-auth] .modal-scroll::-webkit-scrollbar-thumb {
    background: linear-gradient(to bottom, rgb(139,92,246), rgb(168,85,247));
    border-radius: 10px;
  }
  [data-auth] .modal-scroll::-webkit-scrollbar-thumb:hover {
    background: linear-gradient(to bottom, rgb(124,58,237), rgb(147,51,234));
  }
  [data-auth] .modal-scroll {
    scrollbar-width: thin;
    scrollbar-color: rgb(139,92,246) rgba(31,41,55,0.3);
  }

  [data-auth] .auth-link {
    color: #818cf8 !important;
    text-decoration: underline;
    text-underline-offset: 2px;
    font-weight: 500;
    transition: color 0.2s;
  }
  [data-auth] .auth-link:hover { color: #a5b4fc !important; }

  [data-auth] .auth-btn-primary {
    background: linear-gradient(to right, #4f46e5, #9333ea, #2563eb);
    transition: background 0.3s, transform 0.15s, box-shadow 0.3s;
  }
  [data-auth] .auth-btn-primary:hover {
    background: linear-gradient(to right, #4338ca, #7e22ce, #1d4ed8);
    transform: scale(1.02);
    box-shadow: 0 10px 30px rgba(99,102,241,0.4);
  }
  [data-auth] .auth-btn-primary:active { transform: scale(0.98); }

  [data-auth] .auth-btn-secondary { transition: background 0.2s, border-color 0.2s, transform 0.15s; }
  [data-auth] .auth-btn-secondary:hover {
    background: rgba(31,41,55,0.8);
    border-color: rgba(99,102,241,0.5);
    transform: scale(1.02);
  }
  [data-auth] .auth-btn-secondary:active { transform: scale(0.98); }

  [data-auth] .auth-shimmer {
    position: absolute; inset: 0;
    background: linear-gradient(to right, transparent, rgba(255,255,255,0.2), transparent);
    transform: translateX(-200%);
    transition: transform 1s;
  }
  [data-auth] .auth-btn-primary:hover .auth-shimmer { transform: translateX(200%); }

  [data-auth] .auth-info-box { transition: transform 0.3s; }
  [data-auth] .auth-info-box:hover { transform: scale(1.02); }
`;

interface AuthenticationModalProps {
  onClose?: () => void;
}

const AuthenticationModal: React.FC<AuthenticationModalProps> = ({ onClose }) => {
  const [showSignIn, setShowSignIn] = useState(false);
  const [showRegister, setShowRegister] = useState(false);

  const handleRegisterSuccess = () => { setShowRegister(false); };
  const handleSwitchToSignIn = () => { setShowRegister(false); setShowSignIn(true); };

  if (showSignIn) return <SignInModal onClose={() => setShowSignIn(false)} />;
  if (showRegister) return (
    <RegisterModal onClose={() => setShowRegister(false)} onSuccess={handleRegisterSuccess} onSwitchToSignIn={handleSwitchToSignIn} />
  );

  return (
    <div data-auth="" className="fixed inset-0 bg-black/80 backdrop-blur-lg flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto">
      <style>{AUTH_STYLES}</style>

      {/* Modal Container */}
      <div className="bg-gradient-to-br from-gray-900 via-slate-900 to-gray-900 rounded-3xl w-full max-w-md relative shadow-2xl border border-gray-700/50 my-2 sm:my-8 animate-in fade-in duration-300 max-h-[98vh] overflow-hidden flex flex-col">
        
        {/* Decorative gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary-500/10 via-purple-500/10 to-blue-500/10 rounded-3xl pointer-events-none"></div>
        
        {/* Animated gradient border glow */}
        <div className="absolute -inset-[1px] bg-gradient-to-br from-primary-500/20 via-purple-500/20 to-blue-500/20 rounded-3xl -z-10 blur-xl opacity-50"></div>

        {/* Content - Scrollable */}
        <div className="relative p-4 xs:p-6 sm:p-8 md:p-10 overflow-y-auto modal-scroll">
          {/* Header */}
          <div className="flex flex-col items-center mb-4 sm:mb-6 md:mb-8">
            {/* Icon */}
            <div className="relative mb-3 sm:mb-4 md:mb-6">
              <div className="absolute inset-0 bg-primary-500/30 blur-2xl"></div>
              <div className="relative bg-gradient-to-br from-primary-500 to-purple-600 rounded-full p-3 sm:p-4 shadow-2xl shadow-primary-500/50">
                <Lock className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7" style={{color: C.white}} strokeWidth={2.5} />
              </div>
            </div>
            
            {/* Title */}
            <h2 className="text-2xl sm:text-3xl font-bold mb-1 sm:mb-2" style={{background: `linear-gradient(to right, ${C.primary400}, ${C.purple400}, ${C.blue500})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text'}}>
              Welcome
            </h2>
            <p className="text-xs sm:text-sm text-center max-w-sm leading-relaxed px-2" style={{color: C.gray400}}>
              Sign in to your account or create a new one to access the platform
            </p>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2.5 sm:space-y-3 md:space-y-3.5">
            {/* Sign In Button */}
            <button
              onClick={() => setShowSignIn(true)}
              className="auth-btn-primary w-full py-3 sm:py-3.5 md:py-4 rounded-xl flex items-center justify-center gap-2 sm:gap-3 font-bold text-sm sm:text-base shadow-2xl group relative overflow-hidden"
              style={{color: C.white}}
            >
              <div className="auth-shimmer" />
              <span className="relative flex items-center gap-2 sm:gap-3">
                <LogIn size={18} className="sm:w-5 sm:h-5 group-hover:rotate-12 transition-transform" />
                <span>Sign In</span>
                <ArrowRight size={18} className="sm:w-5 sm:h-5 group-hover:translate-x-1 transition-transform" />
              </span>
            </button>

            {/* Register Button */}
            <button
              onClick={() => setShowRegister(true)}
              className="auth-btn-secondary w-full bg-gray-800/50 border-2 border-gray-700/50 py-3 sm:py-3.5 md:py-4 rounded-xl flex items-center justify-center gap-2 sm:gap-3 font-bold text-sm sm:text-base shadow-lg group relative overflow-hidden"
              style={{color: C.white}}
            >
              <span className="relative flex items-center gap-2 sm:gap-3">
                <UserPlus size={18} className="sm:w-5 sm:h-5 group-hover:rotate-12 transition-transform" />
                <span style={{background: `linear-gradient(to right, ${C.primary400}, ${C.purple400})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text'}}>
                  Create New Account
                </span>
                <ArrowRight size={18} className="sm:w-5 sm:h-5 group-hover:translate-x-1 transition-transform" style={{color: C.primary400}} />
              </span>
            </button>
          </div>

          {/* Divider */}
          <div className="relative my-4 sm:my-6 md:my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-700/50"></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-3 sm:px-4 bg-gray-900 font-medium" style={{color: C.gray500}}>Secure Access</span>
            </div>
          </div>

          {/* Info Box */}
          <div className="auth-info-box border border-blue-500/20 rounded-xl p-3 sm:p-4 md:p-5 backdrop-blur-sm shadow-lg" style={{background: 'linear-gradient(to bottom right, rgba(30,58,138,0.2), rgba(88,28,135,0.2))'}}>
            <div className="flex items-start gap-2 sm:gap-3">
              <div className="h-6 w-6 sm:h-7 sm:w-7 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg" style={{background: 'linear-gradient(to bottom right, #3b82f6, #9333ea)'}}>
                <span className="text-xs sm:text-sm font-bold" style={{color: C.white}}>i</span>
              </div>
              <div className="flex-1">
                <p className="text-xs leading-relaxed" style={{color: C.blueLite}}>
                  <strong className="font-semibold block mb-0.5 sm:mb-1" style={{color: C.blueXLite}}>First time here?</strong>
                  Create an account to unlock personalized learning, track your progress, and access exclusive content.
                </p>
              </div>
            </div>
          </div>

          {/* Security Badge */}
          <div className="mt-4 sm:mt-5 md:mt-6 flex items-center justify-center gap-1.5 sm:gap-2">
            <Shield size={12} className="sm:w-3.5 sm:h-3.5" style={{color: C.green500}} />
            <span className="text-[10px] sm:text-xs" style={{color: C.gray500}}>Protected by reCAPTCHA & SSL encryption</span>
          </div>

          {/* Terms and Privacy */}
          <div className="mt-4 sm:mt-5 md:mt-6 text-center">
            <p className="text-[10px] sm:text-xs leading-relaxed px-2" style={{color: C.gray500}}>
              By continuing, you agree to our{' '}
              <a href="/terms-of-service" target="_blank" rel="noopener noreferrer" className="auth-link">
                Terms of Service
              </a>
              {' '}and{' '}
              <a href="/privacy-policy" target="_blank" rel="noopener noreferrer" className="auth-link">
                Privacy Policy
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthenticationModal;
