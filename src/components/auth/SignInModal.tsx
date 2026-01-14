// src/components/auth/SignInModal.tsx
import { useState } from 'react';
import { X, Mail, Lock, Loader } from 'lucide-react';
import { useDashboard } from '../../contexts/DashboardContext';
import RegisterModal from './RegisterModal';

interface SignInModalProps {
  onClose: () => void;
}

const SignInModal = ({ onClose }: SignInModalProps) => {
  const { handleSignIn } = useDashboard();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showRegister, setShowRegister] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!email || !password) {
      setError('Please fill in all fields');
      setLoading(false);
      return;
    }

    try {
      await handleSignIn(email, password);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSuccess = () => {
    setShowRegister(false);
    // Optionally show a success message or auto-sign in
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-background-900 rounded-xl w-full max-w-md p-6 relative animate-slide-up">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-400 hover:text-white"
          disabled={loading}
        >
          <X size={20} />
        </button>

        <h2 className="text-2xl font-bold text-white mb-6">Sign In</h2>

        {error && (
          <div className="bg-error-dark text-error-light px-4 py-2 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Email</label>
            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-background-800 text-white rounded-lg py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all duration-200"
                placeholder="Enter your email"
                disabled={loading}
              />
              <Mail size={16} className="absolute left-3 top-3 text-gray-400" />
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Password</label>
            <div className="relative">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-background-800 text-white rounded-lg py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all duration-200"
                placeholder="Enter your password"
                disabled={loading}
              />
              <Lock size={16} className="absolute left-3 top-3 text-gray-400" />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary-600 hover:bg-primary-700 disabled:bg-primary-800 disabled:cursor-not-allowed text-white py-2 rounded-lg transition-all duration-200 active:scale-98 active:translate-y-0.5 flex items-center justify-center gap-2"
          >
            {loading && <Loader size={16} className="animate-spin" />}
            <span>{loading ? 'Signing In...' : 'Sign In'}</span>
          </button>
        </form>

        <div className="mt-4 text-center">
          <a href="#" className="text-primary-400 hover:text-primary-300 text-sm">
            Forgot password?
          </a>
        </div>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-400">
            Don't have an account?{' '}
            <button 
              onClick={() => setShowRegister(true)}
              className="text-primary-400 hover:text-primary-300 transition-all duration-200 active:scale-98 active:translate-y-0.5"
              disabled={loading}
            >
              Create one here
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default SignInModal;
