// api/verify-recaptcha.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';

const RECAPTCHA_SECRET_V3 = process.env.RECAPTCHA_SECRET_KEY;
const RECAPTCHA_SECRET_V2 = process.env.RECAPTCHA_V2_SECRET_KEY;
const MIN_SCORE = 0.6;

const ALLOWED_ORIGINS = [
  'https://edtech-dashboard-alpha.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // ── CORS ──────────────────────────────────────────────────────
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST')   { res.status(405).json({ error: 'Method not allowed' }); return; }
  // ─────────────────────────────────────────────────────────────

  const { token, action, version = 'v3' } = req.body as {
    token?:   string;
    action?:  string;
    version?: 'v2' | 'v3';
  };

  console.log('[reCAPTCHA] Request:', { version, action, tokenLength: token?.length ?? 0 });

  if (!token || !action) {
    res.status(400).json({ error: 'Missing token or action' });
    return;
  }

  // ── Pick secret key based on version ─────────────────────────
  const secret = version === 'v2' ? RECAPTCHA_SECRET_V2 : RECAPTCHA_SECRET_V3;

  if (!secret) {
    const envVar = version === 'v2' ? 'RECAPTCHA_V2_SECRET_KEY' : 'RECAPTCHA_SECRET_KEY';
    console.error(`[reCAPTCHA] ERROR: ${envVar} not set in environment`);
    res.status(500).json({ error: `${envVar} not configured` });
    return;
  }

  try {
    const googleRes = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token }),
    });

    const result = await googleRes.json() as {
      success:       boolean;
      score?:        number;   // v3 only
      action?:       string;   // v3 only
      hostname?:     string;
      challenge_ts?: string;
      'error-codes'?: string[];
    };

    console.log('[reCAPTCHA] Google response:', JSON.stringify(result, null, 2));

    // ── v2 path: simple pass/fail ─────────────────────────────
    if (version === 'v2') {
      if (!result.success) {
        console.error('[reCAPTCHA] v2 FAILED. Error codes:', result['error-codes']);
        res.status(403).json({ error: 'Security check failed. Please try again.' });
        return;
      }
      console.log('[reCAPTCHA] v2 SUCCESS');
      res.status(200).json({ success: true });
      return;
    }

    // ── v3 path: check success, action match, and score ───────
    if (!result.success) {
      console.error('[reCAPTCHA] v3 FAILED: success=false. Error codes:', result['error-codes']);
      res.status(403).json({
        error: 'reCAPTCHA verification failed',
        requiresV2: false,
      });
      return;
    }

    if (result.action !== action) {
      console.error(`[reCAPTCHA] v3 FAILED: action mismatch — expected "${action}", got "${result.action}"`);
      res.status(403).json({
        error: 'reCAPTCHA action mismatch',
        requiresV2: false,
      });
      return;
    }

    if ((result.score ?? 0) < MIN_SCORE) {
      console.warn(`[reCAPTCHA] v3 score too low: ${result.score} < ${MIN_SCORE} — requesting v2 fallback`);
      // Key flag: tells the frontend to show the v2 checkbox
      res.status(403).json({
        error: 'Additional verification required.',
        requiresV2: true,
        score: result.score,
      });
      return;
    }

    console.log('[reCAPTCHA] v3 SUCCESS — score:', result.score, '| action:', result.action);
    res.status(200).json({ success: true, score: result.score });

  } catch (err: any) {
    console.error('[reCAPTCHA] EXCEPTION:', err.message, err.stack);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
