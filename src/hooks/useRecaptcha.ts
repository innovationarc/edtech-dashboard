// src/hooks/useRecaptcha.ts
// ⚠️  RECAPTCHA SKIPPED — swap this file with useRecaptcha.PRODUCTION.ts when ready
import { useState } from 'react';

export const useRecaptcha = () => {
  // Always ready, never blocks
  const [captchaReady] = useState(true);

  const executeRecaptcha = async (_action: string): Promise<void> => {
    // No-op — verification skipped
    return;
  };

  return { executeRecaptcha, captchaReady };
};
