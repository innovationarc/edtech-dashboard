// src/components/shared/ModalShell.tsx
// Shared modal chrome used across the app (Create Announcement, Schedule Live Class,
// Create Live Stream, Add Knowledge to Database, New Task Group, Create Event, ...).
// Gives every "create/edit X" modal the same look: blurred backdrop, glass card,
// icon + title header, scrollable body, sticky footer — and hides the mobile
// header/bottom nav while open so nothing peeks out from behind the blur.

import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useDashboard } from '../../contexts/DashboardContext';

const hexRgb = (hex: string) => {
  if (!hex || hex.length < 7) return '99,102,241';
  return `${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)}`;
};

const THEME_BG: Record<string, string> = {
  dark: '#0d1117', light: '#ebe8e1', slate: '#0f172a',
  ocean: '#0c1a2e', forest: '#0a1f14', purple: '#1e1b4b',
  pink: '#831843', sunset: '#1c0a00',
};

export interface ModalShellProps {
  /** Icon shown in the small rounded badge next to the title (e.g. <Calendar size={15} />) */
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  /** Small pill next to the subtitle, e.g. "AI Enhanced" */
  badge?: React.ReactNode;
  onClose: () => void;
  /** Scrollable body content — usually a <form> */
  children: React.ReactNode;
  /** Sticky footer, usually Cancel + primary action buttons */
  footer?: React.ReactNode;
  /** max-w-lg by default; pass true for wider forms (max-w-2xl) */
  wide?: boolean;
  /** Disable closing on backdrop click (e.g. while a submit is in-flight) */
  disableBackdropClose?: boolean;
}

const ModalShell: React.FC<ModalShellProps> = ({
  icon, title, subtitle, badge, onClose, children, footer, wide, disableBackdropClose,
}) => {
  const { theme, primaryColor, accentColor } = useDashboard();
  const darkMode = theme !== 'light';
  const pRgb = hexRgb(primaryColor);
  const baseBg = THEME_BG[theme] ?? '#0d1117';

  const T = {
    text: darkMode ? '#f1f5f9' : '#111827',
    text2: darkMode ? '#94a3b8' : '#6b7280',
    text3: darkMode ? '#475569' : '#9ca3af',
    divider: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)',
  };

  const sbSparkle = `radial-gradient(ellipse at 20% 20%, rgba(${pRgb},0.18) 0%, transparent 60%),
     radial-gradient(ellipse at 80% 80%, rgba(${pRgb},0.12) 0%, transparent 50%),
     radial-gradient(ellipse at 50% 50%, ${darkMode ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.55)'} 0%, transparent 70%)`;
  const sbBorder = darkMode ? `1px solid rgba(${pRgb},0.22)` : `1px solid rgba(255,255,255,0.95)`;
  const sbShadow = darkMode
    ? `0 8px 40px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(${pRgb},0.12), 0 0 60px rgba(${pRgb},0.06)`
    : `0 8px 32px rgba(0,0,0,0.10), inset 0 0 0 1px rgba(255,255,255,0.8), 0 0 40px rgba(${pRgb},0.07)`;

  // Hide the mobile top header + bottom nav bar while this modal is mounted, and
  // lock body scroll, so the fullscreen modal feels native on small screens.
  const openedRef = useRef(false);
  useEffect(() => {
    if (!openedRef.current) {
      document.body.classList.add('modal-shell-open');
      openedRef.current = true;
    }
    return () => { document.body.classList.remove('modal-shell-open'); };
  }, []);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <>
      <style>{`
        .modal-shell-scroll::-webkit-scrollbar { width: 6px; }
        .modal-shell-scroll::-webkit-scrollbar-thumb { background: rgba(${pRgb},0.35); border-radius: 999px; }
        .modal-shell-footer { flex-direction: column-reverse; }
        .modal-shell-footer > * { width: 100%; }
        @media (min-width: 480px) {
          .modal-shell-footer { flex-direction: row !important; justify-content: flex-end !important; }
          .modal-shell-footer > * { width: auto !important; }
        }
      `}</style>
      <div
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 300,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16, background: 'rgba(0,0,0,0.65)',
          backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
        }}
        onClick={e => { if (!disableBackdropClose && e.target === e.currentTarget) onClose(); }}
      >
        <div
          className={`w-full ${wide ? 'max-w-2xl' : 'max-w-lg'}`}
          style={{
            backgroundColor: baseBg,
            backgroundImage: sbSparkle,
            backdropFilter: 'blur(32px) saturate(200%)',
            WebkitBackdropFilter: 'blur(32px) saturate(200%)',
            border: sbBorder,
            borderRadius: 24,
            boxShadow: sbShadow,
            fontFamily: "'Outfit', sans-serif",
            position: 'relative',
            isolation: 'isolate',
            maxHeight: '92vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Noise overlay */}
          <div style={{
            position: 'absolute', inset: 0, borderRadius: 'inherit', pointerEvents: 'none', zIndex: 0,
            background: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
            opacity: darkMode ? 0.04 : 0.025, mixBlendMode: 'overlay',
          }} />
          {/* Accent glow top */}
          <div style={{
            position: 'absolute', top: -30, left: '50%', transform: 'translateX(-50%)',
            width: 120, height: 120, borderRadius: '50%',
            background: `radial-gradient(circle, rgba(${pRgb},${darkMode ? 0.20 : 0.12}) 0%, transparent 70%)`,
            pointerEvents: 'none', zIndex: 0, filter: 'blur(20px)',
          }} />

          <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px 14px', borderBottom: `1px solid ${T.divider}`, flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: `rgba(${pRgb},0.15)`, border: `1px solid rgba(${pRgb},0.25)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: primaryColor }}>
                  {icon}
                </div>
                <div style={{ minWidth: 0 }}>
                  <h3 style={{ color: T.text, fontWeight: 700, fontSize: 15, margin: 0, fontFamily: "'Outfit',sans-serif" }}>
                    {title}
                  </h3>
                  {subtitle && (
                    <p style={{ color: T.text3, fontSize: 11, margin: '2px 0 0', fontFamily: "'Outfit',sans-serif" }}>
                      {subtitle}{badge && <span style={{ marginLeft: 6 }}>{badge}</span>}
                    </p>
                  )}
                </div>
              </div>
              <button onClick={onClose} style={{ padding: 6, color: T.text2, background: 'none', border: 'none', cursor: 'pointer', borderRadius: 8, display: 'flex', flexShrink: 0 }}>
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="modal-shell-scroll" style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {children}
            </div>

            {/* Footer */}
            {footer && (
              <div className="modal-shell-footer" style={{ display: 'flex', gap: 8, padding: '14px 20px', borderTop: `1px solid ${T.divider}`, flexShrink: 0 }}>
                {footer}
              </div>
            )}
          </div>
        </div>
      </div>
    </>,
    document.body
  );
};

export default ModalShell;

// ── Shared field styles, so every modal's inputs match exactly ──────────────
export function useModalFieldStyles() {
  const { theme, primaryColor } = useDashboard();
  const darkMode = theme !== 'light';
  const pRgb = hexRgb(primaryColor);
  const T = {
    text: darkMode ? '#f1f5f9' : '#111827',
    text2: darkMode ? '#94a3b8' : '#6b7280',
    inputBg: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
    inputBorder: darkMode ? `rgba(${pRgb},0.22)` : 'rgba(0,0,0,0.10)',
    btnSecBg: darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)',
    btnSecBorder: darkMode ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.09)',
  };
  const inputCls = 'w-full text-sm rounded-xl px-3 py-2.5 border focus:outline-none transition-colors placeholder-gray-500';
  const inputStyle: React.CSSProperties = { background: T.inputBg, borderColor: T.inputBorder, color: T.text, fontFamily: "'Outfit', sans-serif" };
  const labelStyle: React.CSSProperties = { color: T.text2, fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6, fontFamily: "'Outfit',sans-serif" };
  const primaryBtnStyle: React.CSSProperties = { background: primaryColor, color: '#fff', border: 'none', padding: '10px 18px', borderRadius: 10, fontWeight: 600, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontFamily: "'Outfit',sans-serif" };
  const secondaryBtnStyle: React.CSSProperties = { background: T.btnSecBg, border: `1px solid ${T.btnSecBorder}`, color: T.text2, padding: '10px 18px', borderRadius: 10, fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" };
  return { inputCls, inputStyle, labelStyle, primaryBtnStyle, secondaryBtnStyle, T, pRgb };
}
