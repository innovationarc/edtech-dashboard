// api/verify-recaptcha.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';

const RECAPTCHA_SECRET = process.env.RECAPTCHA_SECRET_KEY;
const MIN_SCORE = 0.5;

const ALLOWED_ORIGINS = [
  'https://edtech-dashboard-alpha.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // ── CORS ─────────────────────────────────────────────────────
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  // ─────────────────────────────────────────────────────────────

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!RECAPTCHA_SECRET) {
    res.status(500).json({ error: 'RECAPTCHA_SECRET_KEY not configured in Vercel environment variables' });
    return;
  }

  const { token, action } = req.body;

  if (!token || !action) {
    res.status(400).json({ error: 'Missing token or action' });
    return;
  }

  try {
    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
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
}
