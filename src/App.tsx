// src/App.tsx
import { useEffect, useState } from 'react';
import { HashRouter as Router } from 'react-router-dom';
import AppRoutes from './routes';
import { DashboardProvider } from './contexts/DashboardContext';
import UpdatePrompt from './components/shared/UpdatePrompt';
import AppSplash from './components/shared/AppSplash';
import { useSyncService } from './hooks/useSyncService';
import AuthenticationModal from './components/auth/AuthenticationModal';

// Module-level promise — resolves once grecaptcha is ready, shared across all components
let recaptchaReadyPromise: Promise<void> | null = null;

export const waitForRecaptcha = (): Promise<void> => {
  if (recaptchaReadyPromise) return recaptchaReadyPromise;

  recaptchaReadyPromise = new Promise((resolve) => {
    if (window.grecaptcha) { resolve(); return; }
    const interval = setInterval(() => {
      if (window.grecaptcha) { clearInterval(interval); resolve(); }
    }, 100);
  });

  return recaptchaReadyPromise;
};

// ── Inner app — has access to DashboardProvider context ──
function AppInner() {
  useSyncService();

  // Read auth state directly from localStorage — instant, no async
  const [isAuthed, setIsAuthed] = useState(() =>
    localStorage.getItem('auth_firebase_session') === 'true'
  );

  // Dismiss splash once mounted
  useEffect(() => {
    const dismiss = (window as unknown as Record<string, unknown>).__splashDismiss;
    if (typeof dismiss === 'function') (dismiss as () => void)();
  }, []);

  // reCAPTCHA loader
  useEffect(() => {
    const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
    if (!siteKey || document.getElementById('recaptcha-script')) {
      waitForRecaptcha();
      return;
    }
    const script = document.createElement('script');
    script.id = 'recaptcha-script';
    script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`;
    script.async = true;
    document.head.appendChild(script);
    const style = document.createElement('style');
    style.id = 'recaptcha-badge-hide';
    style.textContent = `.grecaptcha-badge { visibility: hidden !important; opacity: 0 !important; pointer-events: none !important; }`;
    document.head.appendChild(style);
    waitForRecaptcha();
  }, []);

  // Listen for auth changes dispatched by DashboardContext
  useEffect(() => {
    const onAuthed = () => setIsAuthed(true);
    const onSignedOut = () => setIsAuthed(false);
    window.addEventListener('app-auth-success', onAuthed);
    window.addEventListener('app-auth-signout', onSignedOut);
    return () => {
      window.removeEventListener('app-auth-success', onAuthed);
      window.removeEventListener('app-auth-signout', onSignedOut);
    };
  }, []);

  // Not authed → show login immediately, no router needed
  if (!isAuthed) {
    return (
      <div style={{ backgroundColor: '#ff0000', minHeight: '100vh' }}>
        <AppSplash />
        <AuthenticationModal onClose={() => setIsAuthed(true)} />
      </div>
    );
  }

  return (
    <>
      <AppSplash />
      <Router>
        <AppRoutes />
        <UpdatePrompt />
      </Router>
    </>
  );
}

function App() {
  return (
    <DashboardProvider>
      <AppInner />
    </DashboardProvider>
  );
}

export default App;
