// src/App.tsx
import { useEffect } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import AppRoutes from './routes';
import { DashboardProvider } from './contexts/DashboardContext';

function App() {
  useEffect(() => {
    const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
    if (!siteKey || document.getElementById('recaptcha-script')) return;

    // Inject reCAPTCHA v3 script once, globally
    const script = document.createElement('script');
    script.id = 'recaptcha-script';
    script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`;
    script.async = true;
    document.head.appendChild(script);

    // Hide the floating badge (Google ToS: must show disclosure text instead)
    const style = document.createElement('style');
    style.id = 'recaptcha-badge-hide';
    style.textContent = `.grecaptcha-badge { visibility: hidden !important; opacity: 0 !important; pointer-events: none !important; }`;
    document.head.appendChild(style);
  }, []);

  return (
    <DashboardProvider>
      <Router>
        <AppRoutes />
      </Router>
    </DashboardProvider>
  );
}

export default App;
