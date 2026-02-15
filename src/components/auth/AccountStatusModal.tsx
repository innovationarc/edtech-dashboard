// src/components/auth/AccountStatusModal.tsx
import { X, AlertCircle, ShieldAlert } from 'lucide-react';

interface AccountStatusModalProps {
  status: 'inactive' | 'pending';
  userId?: string;
  onClose: () => void;
  onSignInAnotherAccount: () => void;
}

const AccountStatusModal = ({ status, userId, onClose, onSignInAnotherAccount }: AccountStatusModalProps) => {
  const statusConfig = {
    pending: {
      icon: AlertCircle,
      iconColor: 'text-yellow-400',
      iconBgColor: 'bg-yellow-500/10',
      borderColor: 'border-yellow-500/30',
      title: 'Account Pending Approval',
      message: 'Your account is currently pending approval. Please contact the administration to activate your account.',
      statusLabel: 'Pending',
      statusBadgeColor: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
    },
    inactive: {
      icon: ShieldAlert,
      iconColor: 'text-red-400',
      iconBgColor: 'bg-red-500/10',
      borderColor: 'border-red-500/30',
      title: 'Account Inactive',
      message: 'Your account has been deactivated. Please contact the administration to reactivate your account.',
      statusLabel: 'Inactive',
      statusBadgeColor: 'bg-red-500/20 text-red-400 border-red-500/30'
    }
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-3 md:p-4">
      <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl md:rounded-3xl w-full max-w-[95%] sm:max-w-md p-4 sm:p-6 md:p-8 relative shadow-2xl border border-gray-700/50">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-500/5 to-purple-500/5 rounded-2xl md:rounded-3xl pointer-events-none"></div>
        
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-3 top-3 md:right-4 md:top-4 text-gray-400 hover:text-white transition-all duration-200 hover:rotate-90 hover:scale-110 z-10"
          aria-label="Close"
        >
          <X size={20} className="md:w-6 md:h-6" />
        </button>

        <div className="relative">
          {/* Icon and Title */}
          <div className="text-center mb-4 sm:mb-5 md:mb-6">
            <div className={`inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-xl sm:rounded-2xl ${config.iconBgColor} mb-3 sm:mb-4 shadow-lg border ${config.borderColor}`}>
              <Icon className={`w-8 h-8 sm:w-10 sm:h-10 ${config.iconColor}`} />
            </div>
            <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-white mb-2 px-2">{config.title}</h2>
            
            {/* Status Badge */}
            <div className="flex justify-center mb-3 sm:mb-4">
              <span className={`inline-flex items-center px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-semibold border ${config.statusBadgeColor}`}>
                Account Status: {config.statusLabel}
              </span>
            </div>
          </div>

          {/* User ID Display */}
          {userId && (
            <div className="mb-4 sm:mb-5 md:mb-6 p-3 sm:p-4 bg-gray-800/50 rounded-lg sm:rounded-xl border border-gray-700/50">
              <p className="text-xs sm:text-sm text-gray-400 mb-1">Your User ID</p>
              <p className="text-base sm:text-lg font-mono font-semibold text-white break-all">{userId}</p>
            </div>
          )}

          {/* Message */}
          <div className={`mb-4 sm:mb-5 md:mb-6 p-3 sm:p-4 rounded-lg sm:rounded-xl border ${config.borderColor} ${config.iconBgColor}`}>
            <p className="text-xs sm:text-sm text-gray-300 text-center leading-relaxed">
              {config.message}
            </p>
          </div>

          {/* Contact Information */}
          <div className="mb-4 sm:mb-5 md:mb-6 p-3 sm:p-4 bg-gradient-to-r from-primary-500/10 to-purple-500/10 rounded-lg sm:rounded-xl border border-primary-500/20">
            <p className="text-xs sm:text-sm text-gray-400 mb-1.5 sm:mb-2 text-center">Need Help?</p>
            <p className="text-xs sm:text-sm text-gray-300 text-center leading-relaxed">
              Please reach out to your administrator or contact support for assistance with your account activation.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2.5 sm:space-y-3">
            <button
              onClick={onSignInAnotherAccount}
              className="w-full px-4 sm:px-6 py-2.5 sm:py-3 md:py-3.5 bg-gradient-to-r from-primary-600 to-purple-600 text-white rounded-lg sm:rounded-xl font-semibold hover:from-primary-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-primary-500/50 transform hover:scale-[1.02] text-sm sm:text-base"
            >
              Sign In to Another Account
            </button>
            
            <button
              onClick={onClose}
              className="w-full px-4 sm:px-6 py-2.5 sm:py-3 md:py-3.5 bg-gray-800 text-gray-300 rounded-lg sm:rounded-xl font-semibold hover:bg-gray-700 transition-all duration-200 border border-gray-700 hover:border-gray-600 text-sm sm:text-base"
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
