/**
 * pie Academy — OfflineBanner
 *
 * Drop this at the top of any page that requires internet:
 *   live classes, streams, exams, AI features, firebase monitor
 *
 * When offline → renders a full-page overlay blocking the content.
 * When online  → renders nothing (children show normally).
 *
 * Usage:
 *   <OfflineBanner feature="Live Class">
 *     <TeacherLiveClass />
 *   </OfflineBanner>
 */

import React, { useEffect, useState } from 'react';

interface OfflineBannerProps {
  /** Display name of the feature, e.g. "Live Class" or "AI Study Planner" */
  feature?: string;
  children: React.ReactNode;
}

const OfflineBanner: React.FC<OfflineBannerProps> = ({
  feature = 'This feature',
  children,
}) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) {
    return <>{children}</>;
  }

  return (
    <div className="relative min-h-[60vh] flex flex-col items-center justify-center px-6 py-16 select-none">
      {/* Blurred background content hint */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-10 blur-sm">
        {children}
      </div>

      {/* Offline card */}
      <div
        className="relative z-10 flex flex-col items-center gap-5 max-w-sm w-full text-center
                   bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl px-8 py-10
                   shadow-2xl"
        style={{ boxShadow: '0 0 60px rgba(99,102,241,0.15)' }}
      >
        {/* Animated signal icon */}
        <div className="relative flex items-center justify-center w-20 h-20 mb-2">
          {/* Pulsing rings */}
          <span
            className="absolute inset-0 rounded-full border border-indigo-500/30 animate-ping"
            style={{ animationDuration: '2s' }}
          />
          <span
            className="absolute inset-2 rounded-full border border-indigo-500/20 animate-ping"
            style={{ animationDuration: '2.5s', animationDelay: '0.3s' }}
          />
          {/* Icon */}
          <div className="relative flex items-center justify-center w-14 h-14 rounded-full bg-indigo-500/10 border border-indigo-500/30">
            <svg
              className="w-7 h-7 text-indigo-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 3l18 18M8.288 8.288A7 7 0 0115.7 15.7M4.93 4.93A10 10 0 0019.07 19.07
                   M1.41 1.41A15 15 0 0122.59 22.59"
              />
            </svg>
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-white tracking-tight">
            You're offline
          </h2>
          <p className="text-sm text-gray-400 leading-relaxed">
            <span className="text-indigo-300 font-medium">{feature}</span> requires
            an internet connection. Please check your network and try again.
          </p>
        </div>

        {/* Retry button */}
        <button
          onClick={() => window.location.reload()}
          className="mt-2 w-full py-2.5 px-6 rounded-xl text-sm font-medium
                     bg-indigo-600 hover:bg-indigo-500 active:scale-95
                     text-white transition-all duration-150"
        >
          Retry connection
        </button>

        {/* Offline badge */}
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          No internet connection
        </div>
      </div>
    </div>
  );
};

export default OfflineBanner;
