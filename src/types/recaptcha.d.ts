// src/types/recaptcha.d.ts

declare global {
  interface Window {
    grecaptcha?: {
      // v3
      ready: (callback: () => void) => void;
      execute: (siteKey: string, options: { action: string }) => Promise<string>;

      // v2
      render: (
        container: string | HTMLElement,
        parameters: {
          sitekey:             string;
          theme?:              'dark' | 'light';
          size?:               'normal' | 'compact' | 'invisible';
          callback?:           (token: string) => void;
          'expired-callback'?: () => void;
          'error-callback'?:   () => void;
        }
      ) => number; // returns widgetId

      reset:   (widgetId?: number) => void;
      getResponse: (widgetId?: number) => string;
    };
  }
}

export {};
