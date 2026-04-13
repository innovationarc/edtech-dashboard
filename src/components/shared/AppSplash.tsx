/**
 * pie Academy — AppSplash
 *
 * Shows a native-feeling splash/loading screen ONLY when running inside
 * the Capacitor Android app. In a regular browser it renders nothing.
 *
 * Capacitor injects window.Capacitor into the WebView — we use this to
 * detect whether we're in the app or the browser.
 *
 * Usage: Mount once in App.tsx, before your router:
 *   <AppSplash />
 */

import { useEffect, useRef, useState } from 'react';

// Detect Capacitor WebView
function isCapacitorApp(): boolean {
  return typeof (window as unknown as Record<string, unknown>).Capacitor !== 'undefined';
}

export default function AppSplash() {
  const [visible, setVisible]   = useState(isCapacitorApp);
  const [progress, setProgress] = useState(0);
  const [status, setStatus]     = useState('Starting up…');
  const [fading, setFading]     = useState(false);
  const dismissed               = useRef(false);

  useEffect(() => {
    // Don't run any of this in the browser
    if (!isCapacitorApp()) return;

    const steps: { at: number; label: string }[] = [
      { at: 5,  label: 'Starting up…'           },
      { at: 15, label: 'Loading app shell…'      },
      { at: 30, label: 'Connecting to Firebase…' },
      { at: 50, label: 'Loading modules…'        },
      { at: 70, label: 'Preparing dashboard…'    },
      { at: 85, label: 'Almost ready…'           },
      { at: 95, label: 'Finishing up…'           },
    ];

    function advance(p: number) {
      if (dismissed.current) return;
      setProgress(prev => {
        const next = Math.min(Math.max(prev, p), 99);
        const step = [...steps].reverse().find(s => next >= s.at);
        if (step) setStatus(step.label);
        return next;
      });
    }

    // Time-based progress — always moves so bar never feels stuck
    const timers = [
      setTimeout(() => advance(10),  200),
      setTimeout(() => advance(20),  800),
      setTimeout(() => advance(35),  1500),
      setTimeout(() => advance(50),  2500),
      setTimeout(() => advance(65),  4000),
      setTimeout(() => advance(75),  6000),
      setTimeout(() => advance(82),  9000),
      setTimeout(() => advance(88),  13000),
      setTimeout(() => advance(93),  18000),
    ];

    // PerformanceObserver — real network progress on top of time-based
    let totalBytes = 0;
    let loadedBytes = 0;
    let po: PerformanceObserver | null = null;
    try {
      po = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry: PerformanceEntry) => {
          const r = entry as PerformanceResourceTiming;
          if (
            (r.initiatorType === 'script' || r.initiatorType === 'fetch') &&
            r.transferSize
          ) {
            totalBytes  += r.transferSize;
            loadedBytes += r.transferSize;
            if (totalBytes > 0) {
              advance(10 + Math.min((loadedBytes / totalBytes) * 80, 80));
            }
          }
        });
      });
      po.observe({ entryTypes: ['resource'] });
    } catch (_) { /* not supported, timer fallback is enough */ }

    // Safety net — dismiss after 25s no matter what
    const safetyTimer = setTimeout(() => dismiss(), 25000);

    // Expose dismiss for App.tsx to call on mount
    (window as unknown as Record<string, unknown>).__splashDismiss = dismiss;

    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(safetyTimer);
      po?.disconnect();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function dismiss() {
    if (dismissed.current) return;
    dismissed.current = true;
    setProgress(100);
    setStatus('Ready!');
    setFading(true);
    setTimeout(() => setVisible(false), 500);
  }

  // Expose dismiss so App.tsx can call it
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__splashDismiss = dismiss;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!visible) return null;

  return (
    <div
      style={{
        position:        'fixed',
        inset:           0,
        zIndex:          99999,
        background:      '#0f0f1a',
        display:         'flex',
        flexDirection:   'column',
        alignItems:      'center',
        justifyContent:  'center',
        opacity:          fading ? 0 : 1,
        transition:       'opacity 0.5s ease',
        pointerEvents:    fading ? 'none' : 'all',
      }}
    >
      {/* Glitter background */}
      <div style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        backgroundImage: `
          radial-gradient(circle at 20% 20%, rgba(99,102,241,0.06) 0%, transparent 50%),
          radial-gradient(circle at 80% 80%, rgba(139,92,246,0.04) 0%, transparent 50%),
          radial-gradient(circle at 30% 70%, rgba(99,102,241,0.5) 0.5px, transparent 0.5px),
          radial-gradient(circle at 70% 30%, rgba(139,92,246,0.4) 0.5px, transparent 0.5px),
          radial-gradient(circle at 50% 50%, rgba(99,102,241,0.45) 0.5px, transparent 0.5px),
          radial-gradient(circle at 15% 85%, rgba(139,92,246,0.35) 0.5px, transparent 0.5px),
          radial-gradient(circle at 85% 15%, rgba(99,102,241,0.4) 0.5px, transparent 0.5px)
        `,
        backgroundSize: 'auto, auto, 80px 80px, 120px 120px, 90px 90px, 110px 110px, 70px 70px',
      }} />

      {/* Logo */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, marginBottom: 64 }}>
        <div style={{
          width: 72, height: 72, borderRadius: 20,
          background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 40px rgba(99,102,241,0.4)',
          fontSize: 36,
        }}>
          🥧
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#ffffff', letterSpacing: '-0.5px' }}>
            <span style={{ color: '#6366f1' }}>pie</span> Academy
          </div>
          <div style={{ fontSize: 13, color: '#6b7280', letterSpacing: '0.5px' }}>
            by pieOS
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ width: 220, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: '100%', height: 3,
          background: 'rgba(255,255,255,0.08)',
          borderRadius: 99, overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${progress}%`,
            borderRadius: 99,
            background: 'linear-gradient(90deg, #6366f1, #8b5cf6)',
            boxShadow: '0 0 8px rgba(99,102,241,0.6)',
            transition: 'width 0.3s ease',
          }} />
        </div>
        <div style={{ fontSize: 12, color: '#4b5563', letterSpacing: '0.3px', minHeight: 16 }}>
          {status}
        </div>
      </div>
    </div>
  );
}
