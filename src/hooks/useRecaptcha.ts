// src/hooks/useRecaptcha.ts
import { useCallback, useEffect, useState } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { waitForRecaptcha } from '../App';

const SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY as string;
const functionsInstance = getFunctions(undefined, 'us-central1');

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

    // Step 2: Verify token on backend — throws if score too low
    const verify = httpsCallable(functionsInstance, 'verifyRecaptcha');
    await verify({ token, action });
  }, []);

  return { executeRecaptcha, captchaReady };
};
