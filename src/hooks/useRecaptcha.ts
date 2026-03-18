// src/hooks/useRecaptcha.ts
import { useCallback } from 'react';

const SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY as string;

export const useRecaptcha = () => {
  const executeRecaptcha = useCallback((action: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!window.grecaptcha) {
        reject(new Error('reCAPTCHA not loaded'));
        return;
      }
      window.grecaptcha.ready(async () => {
        try {
          const token = await window.grecaptcha!.execute(SITE_KEY, { action });
          resolve(token);
        } catch (err) {
          reject(err);
        }
      });
    });
  }, []);

  return { executeRecaptcha };
};
