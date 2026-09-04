/**
 * pie Academy — UpdatePrompt
 *
 * Shows a toast-style prompt when a new version of the PWA is available.
 * User taps "Update" → page reloads with new version.
 * User taps "Later" → dismissed until next visit.
 *
 * Usage: Place once in App.tsx or your root layout:
 *   <UpdatePrompt />
 */

import React, { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

const UpdatePrompt: React.FC = () => {
  const [show, setShow] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      // Check for updates every 60 minutes
      if (r) {
        setInterval(() => r.update(), 60 * 60 * 1000);
      }
    },
    onRegisterError(error) {
      console.warn('[PWA] Service worker registration failed:', error);
    },
  });

  useEffect(() => {
    if (needRefresh) {
      setShow(true);
    }
  }, [needRefresh]);

  const handleUpdate = async () => {
    setIsUpdating(true);
    await updateServiceWorker(true);
  };

  const handleDismiss = () => {
    setShow(false);
  };

  if (!show) return null;

  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-modal w-[calc(100vw-2rem)] max-w-sm
                 animate-in slide-in-from-bottom-4 duration-300"
      role="alert"
      aria-live="polite"
    >
      <div
        className="flex items-center gap-4 px-4 py-3 rounded-2xl
                   bg-gray-900/95 backdrop-blur-xl border border-white/10
                   shadow-2xl"
        style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(99,102,241,0.2)' }}
      >
        {/* Icon */}
        <div className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/25">
          <svg
            className="w-4 h-4 text-indigo-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 
                 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white leading-tight">
            Update available
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            A new version of pie Academy is ready
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleDismiss}
            className="text-xs text-gray-500 hover:text-gray-300 px-2 py-1 transition-colors"
          >
            Later
          </button>
          <button
            onClick={handleUpdate}
            disabled={isUpdating}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg
                       bg-indigo-600 hover:bg-indigo-500 active:scale-95
                       text-white transition-all duration-150 disabled:opacity-60"
          >
            {isUpdating ? (
              <>
                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Updating…
              </>
            ) : (
              'Update'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default UpdatePrompt;
