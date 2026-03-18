// src/hooks/useRecaptcha.ts
import { useCallback, useEffect, useState } from 'react';
import { waitForRecaptcha } from '../App';

const SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY as string;

// Your deployed Cloud Function URL
const VERIFY_URL = 'https://us-central1-smart-study-ffa8e.cloudfunctions.net/verifyRecaptcha';

export const useRecaptcha = () => {
  const [captchaReady, setCaptchaReady] = useState(!!window.grecaptcha);

  useEffect(() => {
    if (window.grecaptcha) { setCaptchaReady(true); return; }
    waitForRecaptcha().then(() => setCaptchaReady(true));
  }, []);

  const executeRecaptcha = useCallback(async (action: string): Promise<void> => {
    // Wait for grecaptcha to be ready (instant if already loaded)
    await waitForRecaptcha();

    // Step 1: Get token from Google
    const token = await new Promise<string>((resolve, reject) => {
      window.grecaptcha!.ready(async () => {
        try {
          const t = await window.grecaptcha!.execute(SITE_KEY, { action });
          resolve(t);
        } catch (err) {
          reject(err);
        }
      });
    });

    // Step 2: Verify token via plain POST (onRequest with explicit CORS)
    const response = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, action }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || 'Security verification failed. Please try again.');
    }
  }, []);

  return { executeRecaptcha, captchaReady };
};
