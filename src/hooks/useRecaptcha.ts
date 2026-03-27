// src/hooks/useRecaptcha.ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { waitForRecaptcha } from '../App';

const V3_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY as string;
const V2_SITE_KEY = import.meta.env.VITE_RECAPTCHA_V2_SITE_KEY as string;
const VERIFY_URL = '/api/verify-recaptcha';

export type RecaptchaVersion = 'v3' | 'v2';

export interface RecaptchaResult {
  success: boolean;
  requiresV2: boolean; // true = v3 score too low, show v2 checkbox
}

export const useRecaptcha = () => {
  const [captchaReady, setCaptchaReady] = useState(!!window.grecaptcha);
  const [showV2Modal, setShowV2Modal] = useState(false);

  // Holds the resolve/reject of the pending login attempt
  // so we can resume it after the user completes v2
  const v2ResolveRef = useRef<((token: string) => void) | null>(null);
  const v2RejectRef  = useRef<((err: Error)   => void) | null>(null);

  useEffect(() => {
    if (window.grecaptcha) { setCaptchaReady(true); return; }
    waitForRecaptcha().then(() => setCaptchaReady(true));
  }, []);

  // ── Step 1: Run v3 silently ───────────────────────────────────
  const getV3Token = useCallback(async (action: string): Promise<string> => {
    await waitForRecaptcha();
    return new Promise<string>((resolve, reject) => {
      window.grecaptcha!.ready(async () => {
        try {
          const token = await window.grecaptcha!.execute(V3_SITE_KEY, { action });
          resolve(token);
        } catch (err) {
          reject(err);
        }
      });
    });
  }, []);

  // ── Step 2: Wait for user to solve v2 checkbox ───────────────
  const waitForV2Token = useCallback((): Promise<string> => {
    return new Promise<string>((resolve, reject) => {
      v2ResolveRef.current = resolve;
      v2RejectRef.current  = reject;
      setShowV2Modal(true);
    });
  }, []);

  // Called by RecaptchaV2Modal when user solves the checkbox
  const onV2Success = useCallback((token: string) => {
    setShowV2Modal(false);
    v2ResolveRef.current?.(token);
    v2ResolveRef.current = null;
    v2RejectRef.current  = null;
  }, []);

  // Called by RecaptchaV2Modal when user closes/cancels
  const onV2Cancel = useCallback(() => {
    setShowV2Modal(false);
    v2RejectRef.current?.(new Error('Security check cancelled. Please try again.'));
    v2ResolveRef.current = null;
    v2RejectRef.current  = null;
  }, []);

  // ── Step 3: Verify token on server ───────────────────────────
  const verifyToken = useCallback(async (
    token: string,
    action: string,
    version: RecaptchaVersion,
  ): Promise<void> => {
    const response = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, action, version }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || 'Security verification failed. Please try again.');
    }
  }, []);

  // ── Main entry point ─────────────────────────────────────────
  // Returns normally on success, throws on failure/cancel
  const executeRecaptcha = useCallback(async (action: string): Promise<void> => {
    // 1. Try v3 first
    const v3Token = await getV3Token(action);

    const v3Response = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: v3Token, action, version: 'v3' }),
    });

    // 2. If v3 passed — done
    if (v3Response.ok) return;

    const v3Data = await v3Response.json().catch(() => ({}));

    // 3. If server says score too low — show v2 fallback
    if (v3Response.status === 403 && v3Data.requiresV2) {
      const v2Token = await waitForV2Token(); // waits for modal
      await verifyToken(v2Token, action, 'v2');
      return;
    }

    // 4. Any other error — throw normally
    throw new Error(v3Data.error || 'Security verification failed. Please try again.');
  }, [getV3Token, waitForV2Token, verifyToken]);

  return {
    executeRecaptcha,
    captchaReady,
    // V2 modal props — spread these onto <RecaptchaV2Modal />
    v2Modal: {
      visible: showV2Modal,
      siteKey: V2_SITE_KEY,
      onSuccess: onV2Success,
      onCancel: onV2Cancel,
    },
  };
};
