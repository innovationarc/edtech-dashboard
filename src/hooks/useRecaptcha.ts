// src/hooks/useRecaptcha.ts
import { useCallback } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';

const SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY as string;

export const useRecaptcha = () => {
  const executeRecaptcha = useCallback(async (action: string): Promise<void> => {
    // Step 1: Get token from Google
    const token = await new Promise<string>((resolve, reject) => {
      if (!window.grecaptcha) {
        reject(new Error('reCAPTCHA not loaded'));
        return;
      }
      window.grecaptcha.ready(async () => {
        try {
          const t = await window.grecaptcha!.execute(SITE_KEY, { action });
          resolve(t);
        } catch (err) {
          reject(err);
        }
      });
    });

    // Step 2: Verify token on backend — throws if score too low or bot detected
    const functions = getFunctions();
    const verify = httpsCallable(functions, 'verifyRecaptcha');
    await verify({ token, action });
  }, []);

  return { executeRecaptcha };
};
