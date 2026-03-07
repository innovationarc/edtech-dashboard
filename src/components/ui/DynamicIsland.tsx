// src/components/ui/DynamicIsland.tsx
// Dynamic Island notification system — Apple-inspired, works on mobile & desktop

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Bell, BookOpen, Upload, Mic, CheckCircle, AlertCircle,
  Info, X, Clock, GraduationCap, Zap, Trophy, Calendar,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

export type IslandMode =
  | 'idle'          // pill shape, logo only
  | 'notification'  // expands with message
  | 'upload'        // progress bar
  | 'recording'     // pulse + timer
  | 'reminder';     // study plan reminder

export interface DynamicIslandNotification {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning' | 'study' | 'achievement';
  title: string;
  message?: string;
  duration?: number; // ms, default 4000
  progress?: number; // 0–100 for upload
  isRecording?: boolean;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

interface IslandState {
  mode: IslandMode;
  notification: DynamicIslandNotification | null;
  progress: number;
  recordingTime: number;
  expanded: boolean;
}

const initialState: IslandState = {
  mode: 'idle',
  notification: null,
  progress: 0,
  recordingTime: 0,
  expanded: false,
};

// ─── Main Component ──────────────────────────────────────────────────────────

interface DynamicIslandProps {
  darkMode?: boolean;
  primaryColor?: string;
  gradient?: string;
  pRgb?: string;
  logoFallback?: string;
}

const DynamicIsland: React.FC<DynamicIslandProps> = ({
  darkMode = true,
  primaryColor = '#f97316',
  gradient = 'linear-gradient(135deg,#f97316,#ef4444)',
  pRgb = '249,115,22',
  logoFallback = 'H',
}) => {
  const [state, setState] = useState<IslandState>(initialState);
  const [prevMode, setPrevMode] = useState<IslandMode>('idle');
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [logoVisible, setLogoVisible] = useState(true);
  const [contentVisible, setContentVisible] = useState(false);

  const clearTimers = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (recordTimer.current) clearInterval(recordTimer.current);
  }, []);

  // ── Show a notification ──────────────────────────────────────────────────
  const showNotification = useCallback((notif: DynamicIslandNotification) => {
    clearTimers();

    // 1. Fade logo out
    setLogoVisible(false);

    // 2. After logo fades, expand island & show content
    setTimeout(() => {
      const mode: IslandMode = notif.isRecording ? 'recording'
        : notif.progress !== undefined ? 'upload'
        : notif.type === 'study' ? 'reminder'
        : 'notification';

      setState(s => ({ ...s, mode, notification: notif, expanded: true, progress: notif.progress ?? 0 }));
      setPrevMode(mode);

      setTimeout(() => setContentVisible(true), 80);

      if (mode !== 'recording') {
        hideTimer.current = setTimeout(() => {
          dismissIsland();
        }, notif.duration ?? 4500);
      }

      // Recording timer
      if (mode === 'recording') {
        let secs = 0;
        recordTimer.current = setInterval(() => {
          secs++;
          setState(s => ({ ...s, recordingTime: secs }));
        }, 1000);
      }
    }, 200);
  }, [clearTimers]);

  // ── Dismiss ──────────────────────────────────────────────────────────────
  const dismissIsland = useCallback(() => {
    clearTimers();
    setContentVisible(false);
    setTimeout(() => {
      setState(initialState);
      setLogoVisible(true);
    }, 350);
  }, [clearTimers]);

  // ── Update upload progress ────────────────────────────────────────────────
  const updateProgress = useCallback((progress: number) => {
    setState(s => ({ ...s, progress }));
    if (progress >= 100) {
      setTimeout(() => dismissIsland(), 1000);
    }
  }, [dismissIsland]);

  // ── Global event listeners ────────────────────────────────────────────────
  useEffect(() => {
    const handleNotif = (e: CustomEvent) => showNotification(e.detail);
    const handleProgress = (e: CustomEvent) => updateProgress(e.detail.progress);
    const handleDismiss = () => dismissIsland();
    const handleStopRecording = () => {
      if (recordTimer.current) clearInterval(recordTimer.current);
      showNotification({
        id: Date.now().toString(),
        type: 'success',
        title: 'Recording saved',
        message: 'Your recording is ready',
        duration: 3000,
      });
    };

    window.addEventListener('dynamic-island-show', handleNotif as EventListener);
    window.addEventListener('dynamic-island-progress', handleProgress as EventListener);
    window.addEventListener('dynamic-island-dismiss', handleDismiss);
    window.addEventListener('dynamic-island-stop-recording', handleStopRecording);

    // Expose imperative API
    (window as any).dynamicIsland = {
      show: showNotification,
      progress: updateProgress,
      dismiss: dismissIsland,
    };

    return () => {
      window.removeEventListener('dynamic-island-show', handleNotif as EventListener);
      window.removeEventListener('dynamic-island-progress', handleProgress as EventListener);
      window.removeEventListener('dynamic-island-dismiss', handleDismiss);
      window.removeEventListener('dynamic-island-stop-recording', handleStopRecording);
      clearTimers();
    };
  }, [showNotification, updateProgress, dismissIsland, clearTimers]);

  // ── Icon per type ─────────────────────────────────────────────────────────
  const getIcon = () => {
    const n = state.notification;
    if (!n) return <Bell size={15} />;
    switch (n.type) {
      case 'success': return <CheckCircle size={15} className="text-emerald-400" />;
      case 'error':   return <AlertCircle size={15} className="text-red-400" />;
      case 'warning': return <AlertCircle size={15} className="text-amber-400" />;
      case 'study':   return <BookOpen size={15} style={{ color: primaryColor }} />;
      case 'achievement': return <Trophy size={15} className="text-yellow-400" />;
      default:        return <Info size={15} className="text-blue-400" />;
    }
  };

  const getAccent = () => {
    const n = state.notification;
    if (!n) return primaryColor;
    switch (n.type) {
      case 'success': return '#10b981';
      case 'error':   return '#ef4444';
      case 'warning': return '#f59e0b';
      case 'study':   return primaryColor;
      case 'achievement': return '#eab308';
      default:        return '#3b82f6';
    }
  };

  const accent = getAccent();
  const isExpanded = state.expanded;
  const mode = state.mode;

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  // ─── Sizing ──────────────────────────────────────────────────────────────
  const getWidth = () => {
    if (!isExpanded) return 120;
    switch (mode) {
      case 'upload':    return 280;
      case 'recording': return 200;
      case 'reminder':  return 320;
      default:          return 300;
    }
  };

  const getHeight = () => {
    if (!isExpanded) return 36;
    switch (mode) {
      case 'upload':    return 64;
      case 'recording': return 44;
      case 'reminder':  return 86;
      default:          return 64;
    }
  };

  return (
    <>
      <style>{`
        @keyframes di-pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.18); opacity: 0.7; }
        }
        @keyframes di-fade-in {
          from { opacity: 0; transform: translateY(4px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes di-logo-out {
          from { opacity: 1; transform: scale(1); }
          to   { opacity: 0; transform: scale(0.6); }
        }
        @keyframes di-logo-in {
          from { opacity: 0; transform: scale(0.6); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes di-ripple {
          0%   { transform: scale(0.8); opacity: 0.6; }
          100% { transform: scale(2.2); opacity: 0; }
        }
        @keyframes di-progress-shimmer {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        .di-logo-out { animation: di-logo-out 0.18s ease forwards; }
        .di-logo-in  { animation: di-logo-in  0.22s cubic-bezier(0.34,1.56,0.64,1) forwards; }
        .di-content  { animation: di-fade-in  0.28s cubic-bezier(0.34,1.3,0.64,1) forwards; }
        .di-rec-pulse { animation: di-pulse 1.2s ease-in-out infinite; }
        .di-ripple-ring {
          position: absolute; inset: -3px;
          border-radius: 50%;
          border: 2px solid rgba(239,68,68,0.5);
          animation: di-ripple 1.5s ease-out infinite;
        }
      `}</style>

      <div
        style={{
          position: 'fixed',
          top: 10,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 99999,
          width: getWidth(),
          height: getHeight(),
          borderRadius: isExpanded ? 20 : 18,
          background: darkMode
            ? 'rgba(10,10,10,0.95)'
            : 'rgba(15,15,15,0.92)',
          backdropFilter: 'blur(28px) saturate(180%)',
          WebkitBackdropFilter: 'blur(28px) saturate(180%)',
          border: `1px solid rgba(${pRgb},${isExpanded ? 0.35 : 0.2})`,
          boxShadow: isExpanded
            ? `0 8px 40px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.05), 0 0 20px rgba(${pRgb},0.18)`
            : `0 4px 20px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.04)`,
          transition: 'all 0.45s cubic-bezier(0.34,1.2,0.64,1)',
          overflow: 'hidden',
          cursor: isExpanded ? 'pointer' : 'default',
        }}
        onClick={isExpanded ? dismissIsland : undefined}
      >
        {/* ── Idle: Logo pill ─────────────────────────────────────────────── */}
        {!isExpanded && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: '100%', gap: 6,
          }}>
            <div
              className={logoVisible ? 'di-logo-in' : 'di-logo-out'}
              style={{
                width: 22, height: 22, borderRadius: 8,
                background: gradient,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: `0 2px 8px rgba(${pRgb},0.5)`,
                flexShrink: 0,
              }}
            >
              <GraduationCap size={12} color="white" strokeWidth={2.5} />
            </div>
            <span style={{
              fontFamily: "'Outfit', sans-serif",
              fontSize: 13, fontWeight: 600,
              color: 'rgba(255,255,255,0.75)',
              letterSpacing: '0.02em',
            }}>
              EduPlatform
            </span>
          </div>
        )}

        {/* ── Notification mode ───────────────────────────────────────────── */}
        {isExpanded && mode === 'notification' && contentVisible && (
          <div className="di-content" style={{
            display: 'flex', alignItems: 'center', height: '100%',
            padding: '0 14px', gap: 10,
          }}>
            {/* Icon circle */}
            <div style={{
              width: 34, height: 34, borderRadius: 11, flexShrink: 0,
              background: `rgba(${accent.replace('#','').match(/.{2}/g)?.map(h=>parseInt(h,16)).join(',')},0.18)`,
              border: `1px solid ${accent}44`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {getIcon()}
            </div>
            {/* Text */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                fontFamily: "'Outfit', sans-serif",
                fontSize: 13, fontWeight: 700,
                color: 'rgba(255,255,255,0.95)',
                margin: 0, lineHeight: 1.2,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {state.notification?.title}
              </p>
              {state.notification?.message && (
                <p style={{
                  fontFamily: "'Outfit', sans-serif",
                  fontSize: 11, fontWeight: 400,
                  color: 'rgba(255,255,255,0.5)',
                  margin: '2px 0 0', lineHeight: 1.3,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {state.notification.message}
                </p>
              )}
            </div>
            {/* Close dot */}
            <div style={{
              width: 18, height: 18, borderRadius: '50%',
              background: 'rgba(255,255,255,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <X size={10} color="rgba(255,255,255,0.4)" />
            </div>
          </div>
        )}

        {/* ── Upload / Progress mode ──────────────────────────────────────── */}
        {isExpanded && mode === 'upload' && contentVisible && (
          <div className="di-content" style={{
            display: 'flex', flexDirection: 'column', justifyContent: 'center',
            height: '100%', padding: '0 14px', gap: 7,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Upload size={13} style={{ color: primaryColor, flexShrink: 0 }} />
              <span style={{
                fontFamily: "'Outfit', sans-serif",
                fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.9)',
                flex: 1,
              }}>
                {state.notification?.title ?? 'Uploading…'}
              </span>
              <span style={{
                fontFamily: "'Outfit', monospace",
                fontSize: 12, fontWeight: 700,
                color: primaryColor,
              }}>
                {Math.round(state.progress)}%
              </span>
            </div>
            {/* Progress bar */}
            <div style={{
              height: 5, borderRadius: 3,
              background: 'rgba(255,255,255,0.1)',
              overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                width: `${state.progress}%`,
                borderRadius: 3,
                background: `linear-gradient(90deg, ${primaryColor}, ${primaryColor}cc, ${primaryColor})`,
                backgroundSize: '200% 100%',
                animation: 'di-progress-shimmer 1.5s ease infinite',
                transition: 'width 0.4s cubic-bezier(0.4,0,0.2,1)',
                boxShadow: `0 0 8px rgba(${pRgb},0.6)`,
              }} />
            </div>
          </div>
        )}

        {/* ── Recording mode ──────────────────────────────────────────────── */}
        {isExpanded && mode === 'recording' && contentVisible && (
          <div className="di-content" style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: '100%', padding: '0 16px', gap: 10,
          }}>
            {/* Pulsing red dot */}
            <div style={{ position: 'relative', width: 18, height: 18, flexShrink: 0 }}>
              <div className="di-ripple-ring" />
              <div className="di-rec-pulse" style={{
                width: 12, height: 12, borderRadius: '50%',
                background: '#ef4444',
                boxShadow: '0 0 10px rgba(239,68,68,0.8)',
                position: 'absolute', top: 3, left: 3,
              }} />
            </div>
            <span style={{
              fontFamily: "'Outfit', sans-serif",
              fontSize: 12, fontWeight: 700,
              color: '#ef4444', letterSpacing: '0.02em',
            }}>
              REC
            </span>
            <span style={{
              fontFamily: "'SF Mono', 'Fira Mono', monospace",
              fontSize: 15, fontWeight: 700,
              color: 'rgba(255,255,255,0.9)',
              letterSpacing: '0.05em',
            }}>
              {fmt(state.recordingTime)}
            </span>
            <Mic size={14} color="rgba(255,255,255,0.5)" />
          </div>
        )}

        {/* ── Study Reminder mode ─────────────────────────────────────────── */}
        {isExpanded && mode === 'reminder' && contentVisible && (
          <div className="di-content" style={{
            display: 'flex', alignItems: 'center',
            height: '100%', padding: '0 14px', gap: 10,
          }}>
            {/* Animated icon */}
            <div style={{
              width: 40, height: 40, borderRadius: 13, flexShrink: 0,
              background: `linear-gradient(135deg,rgba(${pRgb},0.22),rgba(${pRgb},0.08))`,
              border: `1px solid rgba(${pRgb},0.3)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 0 16px rgba(${pRgb},0.25)`,
            }}>
              <Calendar size={18} style={{ color: primaryColor }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                <Clock size={10} style={{ color: primaryColor, flexShrink: 0 }} />
                <span style={{
                  fontFamily: "'Outfit', sans-serif",
                  fontSize: 10, fontWeight: 600,
                  color: primaryColor, textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                }}>
                  Study Reminder
                </span>
              </div>
              <p style={{
                fontFamily: "'Outfit', sans-serif",
                fontSize: 13, fontWeight: 700,
                color: 'rgba(255,255,255,0.95)',
                margin: '0 0 1px',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {state.notification?.title}
              </p>
              {state.notification?.message && (
                <p style={{
                  fontFamily: "'Outfit', sans-serif",
                  fontSize: 11, color: 'rgba(255,255,255,0.45)',
                  margin: 0,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {state.notification.message}
                </p>
              )}
            </div>
            <div style={{
              padding: '4px 8px', borderRadius: 8,
              background: gradient,
              boxShadow: `0 2px 8px rgba(${pRgb},0.4)`,
            }}>
              <Zap size={11} color="white" strokeWidth={2.5} />
            </div>
          </div>
        )}

        {/* Glow accent at bottom edge */}
        {isExpanded && (
          <div style={{
            position: 'absolute', bottom: 0, left: '15%', right: '15%', height: 1,
            background: `linear-gradient(90deg, transparent, rgba(${pRgb},0.6), transparent)`,
          }} />
        )}
      </div>
    </>
  );
};

export default DynamicIsland;

// ─── Helper to fire notifications from anywhere ───────────────────────────────

export const showDynamicIsland = (notif: Omit<DynamicIslandNotification, 'id'>) => {
  window.dispatchEvent(new CustomEvent('dynamic-island-show', {
    detail: { ...notif, id: Date.now().toString() },
  }));
};

export const updateDynamicIslandProgress = (progress: number) => {
  window.dispatchEvent(new CustomEvent('dynamic-island-progress', { detail: { progress } }));
};

export const dismissDynamicIsland = () => {
  window.dispatchEvent(new CustomEvent('dynamic-island-dismiss'));
};
