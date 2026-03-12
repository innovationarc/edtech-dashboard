// src/components/auth/AccountStatusModal.tsx
import { useState } from 'react';
import { X, AlertCircle, ShieldAlert } from 'lucide-react';
import SignInModal from './SignInModal';

// ─── Self-contained color tokens ───────────────────────────────────────────
const C = {
  primary600: '#4f46e5',
  primary700: '#4338ca',
  purple600:  '#9333ea',
  purple700:  '#7e22ce',
  white:      '#ffffff',
  gray300:    '#d1d5db',
  gray400:    '#9ca3af',
  gray500:    '#6b7280',
  // status colors
  yellow400:  '#facc15',
  red400:     '#f87171',
} as const;

const ASM_STYLES = `
  [data-asm] .asm-close-btn { transition: color 0.2s, transform 0.2s; }
  [data-asm] .asm-close-btn:hover { color: #ffffff; transform: rotate(90deg) scale(1.1); }

  [data-asm] .asm-btn-primary {
    background: linear-gradient(to right, #4f46e5, #9333ea);
    transition: background 0.2s, transform 0.15s, box-shadow 0.2s;
  }
  [data-asm] .asm-btn-primary:hover {
    background: linear-gradient(to right, #4338ca, #7e22ce);
    transform: scale(1.02);
    box-shadow: 0 8px 24px rgba(99,102,241,0.4);
  }
  [data-asm] .asm-btn-primary:active { transform: scale(0.98); }

  [data-asm] .asm-btn-secondary { transition: background 0.2s, border-color 0.2s; }
  [data-asm] .asm-btn-secondary:hover { background: #374151; border-color: #4b5563; }
`;

interface AccountStatusModalProps {
  status: 'inactive' | 'pending';
  userId?: string;
  onClose: () => void;
  onSignInAnotherAccount: () => void;
}

const AccountStatusModal = ({ status, userId, onClose, onSignInAnotherAccount }: AccountStatusModalProps) => {
  const [showSignIn, setShowSignIn] = useState(false);

  const statusConfig = {
    pending: {
      icon: AlertCircle,
      iconColor: C.yellow400,
      iconBgColor: 'rgba(234,179,8,0.1)',
      borderColor: 'rgba(234,179,8,0.3)',
      title: 'Account Pending Approval',
      message: 'Your account is currently pending approval. Please contact the administration to activate your account.',
      statusLabel: 'Pending',
      badgeBg: 'rgba(234,179,8,0.2)',
      badgeText: C.yellow400,
      badgeBorder: 'rgba(234,179,8,0.3)',
    },
    inactive: {
      icon: ShieldAlert,
      iconColor: C.red400,
      iconBgColor: 'rgba(239,68,68,0.1)',
      borderColor: 'rgba(239,68,68,0.3)',
      title: 'Account Inactive',
      message: 'Your account has been deactivated. Please contact the administration to reactivate your account.',
      statusLabel: 'Inactive',
      badgeBg: 'rgba(239,68,68,0.2)',
      badgeText: C.red400,
      badgeBorder: 'rgba(239,68,68,0.3)',
    }
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  if (showSignIn) return <SignInModal onClose={() => setShowSignIn(false)} />;

  return (
    <div data-asm="" className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-3 md:p-4">
      <style>{ASM_STYLES}</style>
      <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl md:rounded-3xl w-full max-w-[95%] sm:max-w-md p-4 sm:p-6 md:p-8 relative shadow-2xl border border-gray-700/50">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-500/5 to-purple-500/5 rounded-2xl md:rounded-3xl pointer-events-none"></div>
        
        {/* Close button */}
        <button
          onClick={onClose}
          className="asm-close-btn absolute right-3 top-3 md:right-4 md:top-4 z-10"
          style={{color: C.gray400}}
          aria-label="Close"
        >
          <X size={20} className="md:w-6 md:h-6" />
        </button>

        <div className="relative">
          {/* Icon and Title */}
          <div className="text-center mb-4 sm:mb-5 md:mb-6">
            <div
              className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-xl sm:rounded-2xl mb-3 sm:mb-4 shadow-lg"
              style={{background: config.iconBgColor, border: `1px solid ${config.borderColor}`}}
            >
              <Icon className="w-8 h-8 sm:w-10 sm:h-10" style={{color: config.iconColor}} />
            </div>
            <h2 className="text-lg sm:text-xl md:text-2xl font-bold mb-2 px-2" style={{color: C.white}}>{config.title}</h2>
            
            {/* Status Badge */}
            <div className="flex justify-center mb-3 sm:mb-4">
              <span
                className="inline-flex items-center px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-semibold"
                style={{background: config.badgeBg, color: config.badgeText, border: `1px solid ${config.badgeBorder}`}}
              >
                Account Status: {config.statusLabel}
              </span>
            </div>
          </div>

          {/* User ID Display */}
          {userId && (
            <div className="mb-4 sm:mb-5 md:mb-6 p-3 sm:p-4 bg-gray-800/50 rounded-lg sm:rounded-xl border border-gray-700/50">
              <p className="text-xs sm:text-sm mb-1" style={{color: C.gray400}}>Your User ID</p>
              <p className="text-base sm:text-lg font-mono font-semibold break-all" style={{color: C.white}}>{userId}</p>
            </div>
          )}

          {/* Message */}
          <div
            className="mb-4 sm:mb-5 md:mb-6 p-3 sm:p-4 rounded-lg sm:rounded-xl"
            style={{border: `1px solid ${config.borderColor}`, background: config.iconBgColor}}
          >
            <p className="text-xs sm:text-sm text-center leading-relaxed" style={{color: C.gray300}}>
              {config.message}
            </p>
          </div>

          {/* Contact Information */}
          <div className="mb-4 sm:mb-5 md:mb-6 p-3 sm:p-4 rounded-lg sm:rounded-xl" style={{background: 'linear-gradient(to right, rgba(99,102,241,0.1), rgba(168,85,247,0.1))', border: '1px solid rgba(99,102,241,0.2)'}}>
            <p className="text-xs sm:text-sm mb-1.5 sm:mb-2 text-center" style={{color: C.gray400}}>Need Help?</p>
            <p className="text-xs sm:text-sm text-center leading-relaxed" style={{color: C.gray300}}>
              Please reach out to your administrator or contact support for assistance with your account activation.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2.5 sm:space-y-3">
            <button
              onClick={() => setShowSignIn(true)}
              className="asm-btn-primary w-full px-4 sm:px-6 py-2.5 sm:py-3 md:py-3.5 rounded-lg sm:rounded-xl font-semibold text-sm sm:text-base shadow-lg"
              style={{color: C.white}}
            >
              Sign In to Another Account
            </button>
            
            <button
              onClick={onClose}
              className="asm-btn-secondary w-full px-4 sm:px-6 py-2.5 sm:py-3 md:py-3.5 bg-gray-800 rounded-lg sm:rounded-xl font-semibold text-sm sm:text-base border border-gray-700"
              style={{color: C.gray300}}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccountStatusModal;
