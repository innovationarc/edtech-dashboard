// src/components/auth/AuthenticationModal.tsx
import React, { useState } from 'react';
import { LogIn, UserPlus, Shield, Lock, ArrowRight } from 'lucide-react';
import SignInModal from './SignInModal';
import RegisterModal from './RegisterModal';

interface AuthenticationModalProps {
  onClose?: () => void;
}

const AuthenticationModal: React.FC<AuthenticationModalProps> = ({ onClose }) => {
  const [showSignIn, setShowSignIn] = useState(false);
  const [showRegister, setShowRegister] = useState(false);

  const handleRegisterSuccess = () => {
    setShowRegister(false);
  };

  const handleSwitchToSignIn = () => {
    setShowRegister(false);
    setShowSignIn(true);
  };

  if (showSignIn) {
    return <SignInModal onClose={() => setShowSignIn(false)} />;
  }

  if (showRegister) {
    return (
      <RegisterModal 
        onClose={() => setShowRegister(false)} 
        onSuccess={handleRegisterSuccess}
        onSwitchToSignIn={handleSwitchToSignIn}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-lg flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto">
      <style>{`
        /* Custom scrollbar styling for the modal */
        .modal-scroll::-webkit-scrollbar {
          width: 6px;
        }
        
        .modal-scroll::-webkit-scrollbar-track {
          background: rgba(31, 41, 55, 0.3);
          border-radius: 10px;
        }
        
        .modal-scroll::-webkit-scrollbar-thumb {
          background: linear-gradient(to bottom, rgb(139, 92, 246), rgb(168, 85, 247));
          border-radius: 10px;
        }
        
        .modal-scroll::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(to bottom, rgb(124, 58, 237), rgb(147, 51, 234));
        }
        
        /* Firefox scrollbar */
        .modal-scroll {
          scrollbar-width: thin;
          scrollbar-color: rgb(139, 92, 246) rgba(31, 41, 55, 0.3);
        }
      `}</style>
      
      {/* Modal Container */}
      <div className="bg-gradient-to-br from-gray-900 via-slate-900 to-gray-900 rounded-3xl w-full max-w-md relative shadow-2xl border border-gray-700/50 my-2 sm:my-8 animate-in fade-in duration-300 max-h-[98vh] overflow-hidden flex flex-col">
        
        {/* Decorative gradient overlay - subtle and sophisticated */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary-500/10 via-purple-500/10 to-blue-500/10 rounded-3xl pointer-events-none"></div>
        
        {/* Animated gradient border glow */}
        <div className="absolute -inset-[1px] bg-gradient-to-br from-primary-500/20 via-purple-500/20 to-blue-500/20 rounded-3xl -z-10 blur-xl opacity-50"></div>

        {/* Content - Scrollable */}
        <div className="relative p-4 xs:p-6 sm:p-8 md:p-10 overflow-y-auto modal-scroll">
          {/* Header */}
          <div className="flex flex-col items-center mb-4 sm:mb-6 md:mb-8">
            {/* Icon with sophisticated glow */}
            <div className="relative mb-3 sm:mb-4 md:mb-6">
              <div className="absolute inset-0 bg-primary-500/30 blur-2xl"></div>
              <div className="relative bg-gradient-to-br from-primary-500 to-purple-600 rounded-full p-3 sm:p-4 shadow-2xl shadow-primary-500/50">
                <Lock className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 text-white" strokeWidth={2.5} />
              </div>
            </div>
            
            {/* Title with gradient text */}
            <h2 className="text-2xl sm:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary-400 via-purple-400 to-blue-500 mb-1 sm:mb-2">
              Welcome
            </h2>
            <p className="text-xs sm:text-sm text-gray-400 text-center max-w-sm leading-relaxed px-2">
              Sign in to your account or create a new one to access the platform
            </p>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2.5 sm:space-y-3 md:space-y-3.5">
            {/* Sign In Button - Premium gradient */}
            <button
              onClick={() => setShowSignIn(true)}
              className="w-full bg-gradient-to-r from-primary-600 via-purple-600 to-blue-600 hover:from-primary-700 hover:via-purple-700 hover:to-blue-700 text-white py-3 sm:py-3.5 md:py-4 rounded-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 sm:gap-3 font-bold text-sm sm:text-base shadow-2xl hover:shadow-primary-500/50 group relative overflow-hidden"
            >
              {/* Animated shimmer effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000"></div>
              
              <span className="relative flex items-center gap-2 sm:gap-3">
                <LogIn size={18} className="sm:w-5 sm:h-5 group-hover:rotate-12 transition-transform" />
                <span>Sign In</span>
                <ArrowRight size={18} className="sm:w-5 sm:h-5 group-hover:translate-x-1 transition-transform" />
              </span>
            </button>

            {/* Register Button - Elegant secondary style */}
            <button
              onClick={() => setShowRegister(true)}
              className="w-full bg-gray-800/50 hover:bg-gray-800/80 backdrop-blur-sm border-2 border-gray-700/50 hover:border-primary-500/50 text-white py-3 sm:py-3.5 md:py-4 rounded-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 sm:gap-3 font-bold text-sm sm:text-base shadow-lg group relative overflow-hidden"
            >
              <span className="relative flex items-center gap-2 sm:gap-3">
                <UserPlus size={18} className="sm:w-5 sm:h-5 group-hover:rotate-12 transition-transform" />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-purple-400 group-hover:from-primary-300 group-hover:to-purple-300">
                  Create New Account
                </span>
                <ArrowRight size={18} className="sm:w-5 sm:h-5 text-primary-400 group-hover:translate-x-1 transition-transform" />
              </span>
            </button>
          </div>

          {/* Divider */}
          <div className="relative my-4 sm:my-6 md:my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-700/50"></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-3 sm:px-4 bg-gray-900 text-gray-500 font-medium">Secure Access</span>
            </div>
          </div>

          {/* Info Box - Sophisticated gradient background */}
          <div className="bg-gradient-to-br from-blue-900/20 to-purple-900/20 border border-blue-500/20 rounded-xl p-3 sm:p-4 md:p-5 backdrop-blur-sm hover:scale-[1.02] transition-all duration-300 shadow-lg">
            <div className="flex items-start gap-2 sm:gap-3">
              <div className="h-6 w-6 sm:h-7 sm:w-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-lg">
                <span className="text-xs sm:text-sm text-white font-bold">i</span>
              </div>
              <div className="flex-1">
                <p className="text-xs text-blue-100/90 leading-relaxed">
                  <strong className="text-blue-50 font-semibold block mb-0.5 sm:mb-1">First time here?</strong>
                  Create an account to unlock personalized learning, track your progress, and access exclusive content.
                </p>
              </div>
            </div>
          </div>

          {/* Security Badge */}
          <div className="mt-4 sm:mt-5 md:mt-6 flex items-center justify-center gap-1.5 sm:gap-2 text-xs text-gray-500">
            <Shield size={12} className="sm:w-3.5 sm:h-3.5 text-green-500" />
            <span className="text-[10px] sm:text-xs">Protected by reCAPTCHA & SSL encryption</span>
          </div>

          {/* Terms and Privacy */}
          <div className="mt-4 sm:mt-5 md:mt-6 text-center">
            <p className="text-[10px] sm:text-xs text-gray-500 leading-relaxed px-2">
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

export default AuthenticationModal;
