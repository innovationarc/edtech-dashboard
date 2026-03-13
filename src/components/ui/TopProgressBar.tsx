// TopProgressBar.tsx
// Thin 2.5px indigo bar at top of viewport — appears on route change, finishes when page renders
// Wired via context so any page can call progressDone() when data is ready
import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

const TopProgressBar = () => {
  const location   = useLocation();
  const [width, setWidth]     = useState(0);
  const [visible, setVisible] = useState(false);
  const timerRef   = useRef<ReturnType<typeof setTimeout>[]>([]);
  const widthRef   = useRef(0);

  const clear = () => timerRef.current.forEach(clearTimeout);

  const start = () => {
    clear();
    widthRef.current = 0;
    setWidth(0);
    setVisible(true);

    // Rapid sprint to 30%
    const t1 = setTimeout(() => { widthRef.current = 30; setWidth(30); }, 20);
    // Ease to 60%
    const t2 = setTimeout(() => { widthRef.current = 60; setWidth(60); }, 200);
    // Slow crawl to 85% — stalls here waiting for data
    const t3 = setTimeout(() => { widthRef.current = 85; setWidth(85); }, 500);
    timerRef.current = [t1, t2, t3];
  };

  const finish = () => {
    clear();
    setWidth(100);
    const t = setTimeout(() => {
      setVisible(false);
      setTimeout(() => setWidth(0), 50);
    }, 320);
    timerRef.current = [t];
  };

  useEffect(() => {
    start();
    // Auto-finish after 600ms even if page doesn't call finish
    // (handles pages with no async loading)
    const t = setTimeout(finish, 600);
    timerRef.current.push(t);
    return clear;
  }, [location.pathname]);

  // Expose finish to window so pages can call it when data is ready
  useEffect(() => {
    (window as any).__progressFinish = finish;
    return () => { delete (window as any).__progressFinish; };
  }, []);

  if (!visible && width === 0) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0,
      height: '2.5px',
      zIndex: 10000,
      pointerEvents: 'none',
    }}>
      <div style={{
        height: '100%',
        width: `${width}%`,
        background: 'linear-gradient(90deg, #6366f1, #a78bfa, #6366f1)',
        backgroundSize: '200% 100%',
        borderRadius: '0 2px 2px 0',
        opacity: visible ? 1 : 0,
        willChange: 'width, opacity',
        transition: width === 100
          ? 'width 0.2s cubic-bezier(0.25,0.46,0.45,0.94), opacity 0.3s ease 0.1s'
          : width <= 30
          ? 'width 0.18s cubic-bezier(0.25,0.46,0.45,0.94)'
          : 'width 0.6s cubic-bezier(0.25,0.46,0.45,0.94)',
        animation: 'progressShimmer 1.4s linear infinite',
      }} />
      <style>{`
        @keyframes progressShimmer {
          0%   { background-position: 100% 0; }
          100% { background-position: -100% 0; }
        }
      `}</style>
    </div>
  );
};

// Helper — call this from any page when your data finishes loading
export const progressDone = () => {
  (window as any).__progressFinish?.();
};

export default TopProgressBar;
