// functions/src/index.ts
import * as admin from 'firebase-admin';
import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import fetch from 'node-fetch';

if (!admin.apps.length) {
  admin.initializeApp();
}

// Define secret via Firebase Secret Manager (more secure than config)
const recaptchaSecret = defineSecret('RECAPTCHA_SECRET');

const MIN_SCORE = 0.5;

// ✅ v2 onRequest with built-in cors option — no packages, no manual headers
export const verifyRecaptcha = onRequest(
  {
    cors: [
      'https://edtech-dashboard-alpha.vercel.app',
      'http://localhost:5173',
      'http://localhost:3000',
    ],
    secrets: [recaptchaSecret],
    timeoutSeconds: 10,
    memory: '128MiB',
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const { token, action } = req.body;
    const secret = recaptchaSecret.value();

    if (!secret) {
      res.status(500).json({ error: 'reCAPTCHA secret not configured' });
      return;
    }

    if (!token || !action) {
      res.status(400).json({ error: 'Missing token or action' });
      return;
    }

    try {
      const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
        method: 'POST',
        body: new URLSearchParams({ secret, response: token }),
      });

      const result = await response.json() as {
        success: boolean;
        score: number;
        action: string;
        'error-codes'?: string[];
      };

      if (!result.success) {
        res.status(403).json({ error: 'reCAPTCHA verification failed' });
        return;
      }

      if (result.action !== action) {
        res.status(403).json({ error: 'reCAPTCHA action mismatch' });
        return;
      }

      if (result.score < MIN_SCORE) {
        res.status(403).json({ error: 'Suspicious activity detected. Please try again.' });
        return;
      }

      res.status(200).json({ success: true, score: result.score });

    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  }
);
