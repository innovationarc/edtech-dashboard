// functions/src/index.ts
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import fetch from 'node-fetch';

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp();
}

const RECAPTCHA_SECRET = functions.config().recaptcha?.secret;
const MIN_SCORE = 0.5;

export const verifyRecaptcha = functions
  .runWith({ timeoutSeconds: 10, memory: '128MB' })
  .https.onCall(async (data, context) => {
    const { token, action } = data;

    if (!RECAPTCHA_SECRET) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'reCAPTCHA secret not configured. Run: firebase functions:config:set recaptcha.secret="YOUR_KEY"'
      );
    }

    if (!token) {
      throw new functions.https.HttpsError('invalid-argument', 'Missing reCAPTCHA token');
    }

    if (!action) {
      throw new functions.https.HttpsError('invalid-argument', 'Missing reCAPTCHA action');
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

    if (!result.success) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'reCAPTCHA verification failed'
      );
    }

    if (result.action !== action) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'reCAPTCHA action mismatch'
      );
    }

    if (result.score < MIN_SCORE) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Suspicious activity detected. Please try again.'
      );
    }

    return { success: true, score: result.score };
  });
