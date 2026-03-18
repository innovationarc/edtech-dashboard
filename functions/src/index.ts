// functions/src/index.ts
import * as functions from 'firebase-functions';
import fetch from 'node-fetch';

const RECAPTCHA_SECRET = functions.config().recaptcha.secret;

// 0.0 = definitely bot, 1.0 = definitely human
// 0.5 is Google's recommended default threshold
const MIN_SCORE = 0.5;

export const verifyRecaptcha = functions.https.onCall(async (data) => {
  const { token, action } = data;

  if (!token) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Missing reCAPTCHA token'
    );
  }

  if (!action) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Missing reCAPTCHA action'
    );
  }

  // Verify token with Google
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
    challenge_ts: string;
    hostname: string;
    'error-codes'?: string[];
  };

  // Google verification failed
  if (!result.success) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'reCAPTCHA verification failed'
    );
  }

  // Action mismatch — possible token reuse attack
  if (result.action !== action) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'reCAPTCHA action mismatch'
    );
  }

  // Score too low — likely a bot
  if (result.score < MIN_SCORE) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Suspicious activity detected. Please try again.'
    );
  }

  return { success: true, score: result.score };
});
