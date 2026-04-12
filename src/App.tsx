// src/App.tsx
import { useEffect } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import AppRoutes from './routes';
import { DashboardProvider } from './contexts/DashboardContext';
import UpdatePrompt from './components/shared/UpdatePrompt';

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

function App() {
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

  return (
    <DashboardProvider>
      <Router>
        <AppRoutes />
        <UpdatePrompt />
      </Router>
    </DashboardProvider>
  );
}

export default App;
