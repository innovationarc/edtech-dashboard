// functions/src/index.ts
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import * as cors from 'cors';
import fetch from 'node-fetch';

if (!admin.apps.length) {
  admin.initializeApp();
}

const RECAPTCHA_SECRET = functions.config().recaptcha?.secret;
const MIN_SCORE = 0.5;

// Explicit CORS — allow your Vercel domain + localhost dev
const corsHandler = cors({
  origin: [
    'https://edtech-dashboard-alpha.vercel.app',
    'http://localhost:5173',
    'http://localhost:3000',
  ],
  methods: ['POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
});

export const verifyRecaptcha = functions
  .runWith({ timeoutSeconds: 10, memory: '128MB' })
  .https.onRequest((req, res) => {
    corsHandler(req, res, async () => {
      // Only allow POST
      if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
      }

      const { token, action } = req.body;

      if (!RECAPTCHA_SECRET) {
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
          body: new URLSearchParams({
            secret: RECAPTCHA_SECRET,
            response: token,
          }),
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
    });
  });
