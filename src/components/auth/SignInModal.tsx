// src/components/auth/SignInModal.tsx
import { useState } from 'react';
import { X, Lock, Loader, Smartphone, CreditCard } from 'lucide-react';
import { useDashboard } from '../../contexts/DashboardContext';
import RegisterModal from './RegisterModal';

interface SignInModalProps {
  onClose: () => void;
}

const SignInModal = ({ onClose }: SignInModalProps) => {
  const { handleSignIn } = useDashboard();
  const [loginId, setLoginId] = useState(''); // Can be User ID or Phone Number
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl w-full max-w-md p-8 relative shadow-2xl border border-gray-700/50 animate-slide-up">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-500/5 to-purple-500/5 rounded-2xl pointer-events-none"></div>
        
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-400 hover:text-white transition-all duration-200 hover:rotate-90 z-10"
          disabled={loading}
        >
          <X size={24} />
        </button>

        <div className="relative">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-purple-600 mb-4 shadow-lg shadow-primary-500/50">
              <CreditCard size={32} className="text-white" />
            </div>
            <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-purple-500 mb-2">
              Welcome Back
            </h2>
            <p className="text-gray-400 text-sm">Sign in to continue learning</p>
          </div>

          {error && (
            <div className="bg-red-900/30 border border-red-700/50 text-red-200 px-4 py-3 rounded-xl mb-6 backdrop-blur-sm animate-shake">
              <p className="text-sm">{error}</p>
            </div>
          )}

          <div className="space-y-5">
            <div className="group">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Student ID or Phone Number
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="w-full bg-gray-800/50 backdrop-blur-sm text-white rounded-xl py-3 pl-11 pr-4 border border-gray-700/50 focus:border-primary-500/50 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all duration-200 group-hover:border-gray-600"
                  placeholder="ST-1xxxxxxx or phone number"
                  disabled={loading}
                />
                <Smartphone size={18} className="absolute left-3.5 top-3.5 text-gray-400 group-hover:text-primary-400 transition-colors" />
              </div>
              <p className="text-xs text-gray-500 mt-1.5">Enter your Student ID or registered phone number</p>
            </div>

            <div className="group">
              <label className="block text-sm font-medium text-gray-300 mb-2">Password</label>
              <div className="relative">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="w-full bg-gray-800/50 backdrop-blur-sm text-white rounded-xl py-3 pl-11 pr-4 border border-gray-700/50 focus:border-primary-500/50 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all duration-200 group-hover:border-gray-600"
                  placeholder="Enter your password"
                  disabled={loading}
                />
                <Lock size={18} className="absolute left-3.5 top-3.5 text-gray-400 group-hover:text-primary-400 transition-colors" />
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full bg-gradient-to-r from-primary-600 to-purple-600 hover:from-primary-700 hover:to-purple-700 disabled:from-gray-700 disabled:to-gray-800 disabled:cursor-not-allowed text-white py-3.5 rounded-xl transition-all duration-300 active:scale-95 flex items-center justify-center gap-2 font-medium shadow-lg hover:shadow-primary-500/50"
            >
              {loading && <Loader size={20} className="animate-spin" />}
              <span>{loading ? 'Signing In...' : 'Sign In'}</span>
            </button>
          </div>

          <div className="mt-6 text-center">
            <button 
              onClick={() => {/* TODO: Implement forgot password */}}
              className="text-sm text-primary-400 hover:text-primary-300 transition-colors duration-200"
            >
              Forgot password?
            </button>
          </div>

          <div className="mt-8 pt-6 border-t border-gray-700/50">
            <p className="text-sm text-gray-400 text-center">
              Don't have an account?{' '}
              <button 
                onClick={() => setShowRegister(true)}
                className="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-purple-500 hover:from-primary-300 hover:to-purple-400 transition-all duration-200 font-medium"
                disabled={loading}
              >
                Create one here
              </button>
            </p>
          </div>

          <div className="mt-6 bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-blue-700/30 rounded-xl p-4 backdrop-blur-sm">
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
