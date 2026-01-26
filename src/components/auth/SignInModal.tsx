// src/components/auth/SignInModal.tsx
import { useState } from 'react';
import { X, Lock, Loader, Smartphone, CreditCard, AlertCircle, Mail, Phone } from 'lucide-react';
import { useDashboard } from '../../contexts/DashboardContext';
import RegisterModal from './RegisterModal';

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

  const handleSubmit = async () => {
    setError('');
    setLoading(true);

    if (!loginId || !password) {
      setError('Please fill in all fields');
      setLoading(false);
      return;
    }

    try {
      await handleSignIn(loginId, password);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleRegisterSuccess = () => {
    setShowRegister(false);
  };

  if (showRegister) {
    return (
      <RegisterModal 
        onClose={() => setShowRegister(false)} 
        onSuccess={handleRegisterSuccess}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-3xl w-full max-w-md p-8 relative shadow-2xl border border-gray-700/50 animate-slide-up transform-gpu">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-500/5 to-purple-500/5 rounded-3xl pointer-events-none"></div>
        
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-400 hover:text-white transition-all duration-200 hover:rotate-90 hover:scale-110 z-10 transform-gpu"
          disabled={loading}
        >
          <X size={24} />
        </button>

        <div className="relative">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-primary-500 via-purple-600 to-primary-500 mb-4 shadow-2xl shadow-primary-500/50 animate-gradient transform-gpu hover:scale-110 transition-transform duration-300">
              <CreditCard size={40} className="text-white" />
            </div>
            <h2 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary-400 via-purple-400 to-primary-500 mb-2 animate-text-shine">
              Welcome Back
            </h2>
            <p className="text-gray-400 text-sm">Sign in to continue learning</p>
          </div>

          {error && (
            <div className="bg-red-900/40 border border-red-700/50 text-red-200 px-4 py-3 rounded-xl mb-6 backdrop-blur-sm animate-shake transform-gpu">
              <p className="text-sm flex items-center gap-2">
                <AlertCircle size={16} />
                {error}
              </p>
            </div>
          )}

          <div className="space-y-5">
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
                  className="w-full bg-gray-800/60 backdrop-blur-xl text-white rounded-xl py-3.5 pl-11 pr-4 border border-gray-700/50 focus:border-primary-500/50 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all duration-200 group-hover:border-gray-600 transform-gpu hover:scale-[1.01]"
                  placeholder="ST-1xxxxxxx, phone, or email"
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
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="w-full bg-gray-800/60 backdrop-blur-xl text-white rounded-xl py-3.5 pl-11 pr-4 border border-gray-700/50 focus:border-primary-500/50 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all duration-200 group-hover:border-gray-600 transform-gpu hover:scale-[1.01]"
                  placeholder="Enter your password"
                  disabled={loading}
                />
                <Lock size={18} className="absolute left-3.5 top-3.5 text-gray-400 group-hover:text-primary-400 transition-colors" />
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full bg-gradient-to-r from-primary-600 via-purple-600 to-primary-600 hover:from-primary-700 hover:via-purple-700 hover:to-primary-700 disabled:from-gray-700 disabled:to-gray-800 disabled:cursor-not-allowed text-white py-4 rounded-xl transition-all duration-300 active:scale-95 flex items-center justify-center gap-2 font-semibold shadow-2xl hover:shadow-primary-500/50 animate-gradient transform-gpu"
            >
              {loading && <Loader size={20} className="animate-spin" />}
              <span>{loading ? 'Signing In...' : 'Sign In'}</span>
            </button>
          </div>

          <div className="mt-6 text-center">
            <button 
              onClick={() => {/* TODO: Implement forgot password */}}
              className="text-sm text-primary-400 hover:text-primary-300 transition-colors duration-200 hover:scale-105 inline-block transform-gpu"
            >
              Forgot password?
            </button>
          </div>

          <div className="mt-8 pt-6 border-t border-gray-700/50">
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

          <div className="mt-6 bg-gradient-to-r from-blue-900/30 to-purple-900/30 border border-blue-700/30 rounded-xl p-4 backdrop-blur-xl transform-gpu hover:scale-105 transition-transform duration-300">
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

      <style>{`
        @keyframes text-shine {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .animate-text-shine {
          background-size: 200% 200%;
          animation: text-shine 3s ease infinite;
        }
        @keyframes gradient {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .animate-gradient {
          background-size: 200% 200%;
          animation: gradient 3s ease infinite;
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
        @keyframes slide-up {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-slide-up {
          animation: slide-up 0.4s ease-out;
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
          20%, 40%, 60%, 80% { transform: translateX(5px); }
        }
        .animate-shake {
          animation: shake 0.5s ease-in-out;
        }
      `}</style>
    </div>
  );
};

export default SignInModal;
