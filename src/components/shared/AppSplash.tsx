/**
 * pie Academy — AppSplash
 *
 * Hides the native Capacitor splash screen once React has fully mounted
 * and the app is ready to display.
 *
 * The splash screen itself is a native Android drawable (splash.xml) that
 * shows instantly when the app opens — before the WebView loads anything.
 * This component just controls when it disappears.
 *
 * In browser: does nothing (window.Capacitor is undefined).
 */

import { useEffect } from 'react';

export default function AppSplash() {
  useEffect(() => {
    // Only run inside Capacitor WebView
    const cap = (window as unknown as Record<string, unknown>).Capacitor;
    if (!cap) return;

    // Dynamically import to avoid bundling Capacitor in web build
    import('@capacitor/splash-screen').then(({ SplashScreen }) => {
      SplashScreen.hide({ fadeOutDuration: 500 });
    }).catch(() => {
      // Fail silently — splash will auto-hide via safety timeout in native code
    });
  }, []);

  // Renders nothing — splash is native, not a React component
  return null;
}

