// src/components/auth/RecaptchaV2Modal.tsx
import { useEffect, useRef } from 'react';
import { Shield, X } from 'lucide-react';

const C = {
  primary500: '#6366f1',
  purple600:  '#9333ea',
  gray400:    '#9ca3af',
  gray500:    '#6b7280',
  gray700:    '#374151',
  white:      '#ffffff',
  green500:   '#22c55e',
} as const;

interface RecaptchaV2ModalProps {
  visible:   boolean;
  siteKey:   string;
  onSuccess: (token: string) => void;
  onCancel:  () => void;
}

const WIDGET_CONTAINER_ID = 'recaptcha-v2-widget';

const RecaptchaV2Modal = ({
  visible,
  siteKey,
  onSuccess,
  onCancel,
}: RecaptchaV2ModalProps) => {
  const widgetIdRef = useRef<number | null>(null);
  const rendered    = useRef(false);

  useEffect(() => {
    if (!visible) return;

    // Small delay so the DOM node is mounted before we render into it
    const timer = setTimeout(() => {
      if (rendered.current) return;
      if (!window.grecaptcha?.render) return;

      const container = document.getElementById(WIDGET_CONTAINER_ID);
      if (!container) return;

      widgetIdRef.current = window.grecaptcha.render(WIDGET_CONTAINER_ID, {
        sitekey:  siteKey,
        theme:    'dark',
        callback: (token: string) => {
          rendered.current = false;
          onSuccess(token);
        },
        'expired-callback': () => {
          if (widgetIdRef.current !== null) {
            window.grecaptcha?.reset(widgetIdRef.current);
          }
        },
      });
      rendered.current = true;
    }, 100);

    return () => {
      clearTimeout(timer);
    };
  }, [visible, siteKey, onSuccess]);

  // Reset widget state when modal closes
  useEffect(() => {
    if (!visible) {
      rendered.current = false;
      widgetIdRef.current = null;
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 350,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        padding: '16px',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        style={{
          background: 'linear-gradient(135deg, #111827 0%, #1a1040 100%)',
          border: '1px solid rgba(99,102,241,0.3)',
          borderRadius: '20px',
          padding: '28px 24px',
          width: '100%',
          maxWidth: '360px',
          boxShadow: '0 25px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(99,102,241,0.1)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '20px',
          position: 'relative',
        }}
      >
        {/* Close button */}
        <button
          onClick={onCancel}
          style={{
            position: 'absolute',
            top: '14px',
            right: '14px',
            background: 'rgba(55,65,81,0.5)',
            border: 'none',
            borderRadius: '8px',
            padding: '6px',
            cursor: 'pointer',
            color: C.gray400,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 0.2s',
          }}
          aria-label="Cancel verification"
        >
          <X size={16} />
        </button>

        {/* Icon */}
        <div
          style={{
            width: '52px',
            height: '52px',
            borderRadius: '50%',
            background: `linear-gradient(135deg, ${C.primary500}, ${C.purple600})`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(99,102,241,0.35)',
          }}
        >
          <Shield size={24} color={C.white} />
        </div>

        {/* Text */}
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <h3
            style={{
              margin: 0,
              fontSize: '17px',
              fontWeight: 700,
              color: C.white,
              letterSpacing: '-0.2px',
            }}
          >
            Quick Security Check
          </h3>
          <p
            style={{
              margin: 0,
              fontSize: '13px',
              color: C.gray400,
              lineHeight: '1.5',
            }}
          >
            Please confirm you're not a robot to continue signing in.
          </p>
        </div>

        {/* reCAPTCHA v2 widget renders here */}
        <div
          id={WIDGET_CONTAINER_ID}
          style={{
            borderRadius: '8px',
            overflow: 'hidden',
            minHeight: '78px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        />

        {/* Footer note */}
        <p style={{ margin: 0, fontSize: '11px', color: C.gray500, textAlign: 'center' }}>
          This helps us keep your account secure.
        </p>
      </div>
    </div>
  );
};

export default RecaptchaV2Modal;
