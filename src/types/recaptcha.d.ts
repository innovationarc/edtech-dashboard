// src/types/recaptcha.d.ts
// TypeScript declarations for Google reCAPTCHA v3

interface Window {
  grecaptcha: {
    ready: (callback: () => void) => void;
    execute: (siteKey: string, options: { action: string }) => Promise<string>;
    render: (container: string | HTMLElement, parameters: any) => number;
    reset: (widgetId?: number) => void;
  };
}
