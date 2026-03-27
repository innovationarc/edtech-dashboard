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

  console.log('[reCAPTCHA] Incoming request:', {
    method: req.method,
    origin,
    originAllowed: ALLOWED_ORIGINS.includes(origin),
  });

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
    console.error('[reCAPTCHA] ERROR: RECAPTCHA_SECRET_KEY is not set in environment variables');
    res.status(500).json({ error: 'RECAPTCHA_SECRET_KEY not configured in Vercel environment variables' });
    return;
  }

  console.log('[reCAPTCHA] Secret key loaded: YES (length:', RECAPTCHA_SECRET.length, ')');

  const { token, action } = req.body;

  console.log('[reCAPTCHA] Request body:', {
    tokenReceived: !!token,
    tokenLength: token?.length ?? 0,
    action,
  });

  if (!token || !action) {
    console.error('[reCAPTCHA] ERROR: Missing token or action in request body');
    res.status(400).json({ error: 'Missing token or action' });
    return;
  }

  try {
    console.log('[reCAPTCHA] Sending verification request to Google...');

    const googleRes = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret: RECAPTCHA_SECRET,
        response: token,
      }),
    });

    console.log('[reCAPTCHA] Google response status:', googleRes.status);

    const result = await googleRes.json() as {
      success: boolean;
      score: number;
      action: string;
      hostname: string;
      challenge_ts: string;
      'error-codes'?: string[];
    };

    // Log the FULL raw response from Google
    console.log('[reCAPTCHA] Full Google response:', JSON.stringify(result, null, 2));

    if (!result.success) {
      console.error('[reCAPTCHA] FAILED: Google returned success=false');
      console.error('[reCAPTCHA] Error codes:', result['error-codes']);
      res.status(403).json({
        error: 'reCAPTCHA verification failed',
        // Remove the line below before going to production
        debug_error_codes: result['error-codes'],
      });
      return;
    }

    if (result.action !== action) {
      console.error(`[reCAPTCHA] FAILED: Action mismatch — expected "${action}", got "${result.action}"`);
      res.status(403).json({
        error: 'reCAPTCHA action mismatch',
        // Remove the line below before going to production
        debug_action: { expected: action, received: result.action },
      });
      return;
    }

    if (result.score < MIN_SCORE) {
      console.error(`[reCAPTCHA] FAILED: Score too low — got ${result.score}, minimum is ${MIN_SCORE}`);
      res.status(403).json({
        error: 'Suspicious activity detected. Please try again.',
        // Remove the line below before going to production
        debug_score: { received: result.score, minimum: MIN_SCORE },
      });
      return;
    }

    console.log('[reCAPTCHA] SUCCESS — score:', result.score, '| action:', result.action);
    res.status(200).json({ success: true, score: result.score });

  } catch (err: any) {
    console.error('[reCAPTCHA] EXCEPTION during verification:', err.message, err.stack);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
