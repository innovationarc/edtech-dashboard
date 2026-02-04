// api/password-reset.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import admin from 'firebase-admin';

interface PasswordResetRequest {
  // Option 1: Reset by phone number (original functionality)
  phoneNumber?: string;
  // Option 2: Reset by UID (admin password reset functionality)
  uid?: string;
  // Required for both
  newPassword: string;
  // Optional metadata
  resetByUid?: string;
  resetByRole?: string;
  apiKey?: string;
  recaptchaToken?: string; // NEW: Optional reCAPTCHA token
}

interface PasswordResetResponse {
  success: boolean;
  message?: string;
  error?: string;
}

// Initialize Firebase Admin SDK
function initializeFirebaseAdmin() {
  if (admin.apps.length > 0) {
    return;
  }

  try {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
    
    if (serviceAccountJson) {
      const serviceAccount = JSON.parse(serviceAccountJson);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log('✅ Firebase Admin initialized');
      return;
    }

    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (!projectId || !clientEmail || !privateKey) {
      throw new Error('Missing Firebase credentials');
    }

    privateKey = privateKey.replace(/\\n/g, '\n').replace(/^["']|["']$/g, '');

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });

    console.log('✅ Firebase Admin initialized');
  } catch (error: any) {
    console.error('❌ Firebase Admin initialization error:', error.message);
    throw error;
  }
}

// NEW: Verify reCAPTCHA token (optional - backend validation)
async function verifyRecaptcha(token: string): Promise<boolean> {
  // If no reCAPTCHA secret is configured, skip verification (backward compatible)
  const RECAPTCHA_SECRET = process.env.RECAPTCHA_SECRET_KEY;
  if (!RECAPTCHA_SECRET) {
    console.log('⚠️ reCAPTCHA secret not configured - skipping verification');
    return true;
  }

  try {
    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `secret=${RECAPTCHA_SECRET}&response=${token}`,
    });

    const data = await response.json();
    
    if (data.success && data.score >= 0.5) {
      console.log('✅ reCAPTCHA verified successfully, score:', data.score);
      return true;
    }
    
    console.log('❌ reCAPTCHA verification failed, score:', data.score);
    return false;
  } catch (error) {
    console.error('⚠️ reCAPTCHA verification error:', error);
    // On error, allow request to proceed (backward compatible)
    return true;
  }
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse<PasswordResetResponse>
) {
  // Set CORS headers
  const allowedOrigins = [
    process.env.FRONTEND_URL || 'http://localhost:5173',
    'https://edtech-dashboard-alpha.vercel.app',
    'http://localhost:3000',
    'http://localhost:5174'
  ];

  const origin = req.headers.origin || '';
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, X-API-Key'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  }

  try {
    // Initialize Firebase Admin
    try {
      initializeFirebaseAdmin();
    } catch (initError: any) {
      console.error('🔥 Firebase initialization failed:', initError.message);
      return res.status(500).json({
        success: false,
        error: 'Firebase Admin configuration error',
      });
    }

    const { 
      phoneNumber, 
      uid, 
      newPassword, 
      resetByUid, 
      resetByRole, 
      apiKey,
      recaptchaToken // NEW: reCAPTCHA token
    } = req.body as PasswordResetRequest;

    // NEW: Verify reCAPTCHA if token is provided (optional - backward compatible)
    if (recaptchaToken) {
      const isValidRecaptcha = await verifyRecaptcha(recaptchaToken);
      if (!isValidRecaptcha) {
        console.log('❌ reCAPTCHA verification failed');
        return res.status(400).json({
          success: false,
          error: 'Verification failed. Please try again.',
        });
      }
    }

    // Determine reset type
    const isPhoneNumberReset = !!phoneNumber;
    const isUidReset = !!uid;

    if (!isPhoneNumberReset && !isUidReset) {
      return res.status(400).json({
        success: false,
        error: 'Either phoneNumber or uid must be provided'
      });
    }

    if (isPhoneNumberReset) {
      console.log('🔐 Password reset request by phone:', phoneNumber?.substring(0, 5) + '****');
    } else {
      console.log('🔐 Password reset request by UID:', uid);
    }

    // Validate required fields
    if (!newPassword) {
      console.error('❌ Missing new password');
      return res.status(400).json({
        success: false,
        error: 'New password is required',
      });
    }

    // Validate password strength (relaxed for admin resets, strict for phone resets)
    if (isPhoneNumberReset) {
      // Strict validation for self-service password reset
      if (newPassword.length < 8) {
        return res.status(400).json({
          success: false,
          error: 'Password must be at least 8 characters long',
        });
      }

      if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || 
          !/[0-9]/.test(newPassword) || !/[!@#$%^&*(),.?":{}|<>]/.test(newPassword)) {
        return res.status(400).json({
          success: false,
          error: 'Password must include uppercase, lowercase, number, and special character',
        });
      }
    } else {
      // Relaxed validation for admin-initiated password reset
      if (newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          error: 'Password must be at least 6 characters long'
        });
      }
    }

    // Optional: Validate API Key for sensitive operations
    const MASTER_API_KEY = process.env.SMS_MASTER_KEY;
    if (MASTER_API_KEY && apiKey !== MASTER_API_KEY) {
      console.error('❌ Unauthorized request - invalid API key');
      return res.status(401).json({
        success: false,
        error: 'Unauthorized request',
      });
    }

    let targetUserId: string;
    let targetUserData: any;

    // Find user by phone number or UID
    if (isPhoneNumberReset) {
      const db = admin.firestore();
      const usersQuery = await db.collection('users')
        .where('phoneNumber', '==', phoneNumber)
        .limit(1)
        .get();

      if (usersQuery.empty) {
        console.error('❌ User not found by phone number');
        return res.status(404).json({
          success: false,
          error: 'Account not found',
        });
      }

      const userDoc = usersQuery.docs[0];
      targetUserData = userDoc.data();
      targetUserId = userDoc.id;

      console.log('✅ User found by phone:', targetUserData.userId);
    } else {
      // UID-based reset (for admin operations)
      const db = admin.firestore();
      const userDoc = await db.collection('users').doc(uid!).get();

      if (!userDoc.exists) {
        console.error('❌ User not found by UID');
        return res.status(404).json({
          success: false,
          error: 'User not found',
        });
      }

      targetUserData = userDoc.data();
      targetUserId = uid!;

      console.log('✅ User found by UID:', targetUserData.userId);
    }

    // Update password using Firebase Auth Admin SDK
    try {
      await admin.auth().updateUser(targetUserId, {
        password: newPassword
      });
      console.log('✅ Password updated in Firebase Auth');
    } catch (authError: any) {
      console.error('❌ Firebase Auth password update error:', authError.message);
      return res.status(500).json({
        success: false,
        error: 'Failed to update password in authentication system',
      });
    }

    // Update Firestore to mark password as reset
    try {
      const db = admin.firestore();
      const updateData: any = {
        passwordResetAt: admin.firestore.FieldValue.serverTimestamp(),
        passwordResetPending: false
      };

      // Add metadata if this is an admin-initiated reset
      if (resetByUid && resetByRole) {
        updateData.lastPasswordResetBy = resetByUid;
        updateData.lastPasswordResetByRole = resetByRole;
      }

      await db.collection('users').doc(targetUserId).update(updateData);
      console.log('✅ Password reset logged in Firestore');
    } catch (firestoreError: any) {
      console.warn('⚠️ Failed to update Firestore metadata:', firestoreError.message);
      // Don't fail the request if logging fails
    }

    console.log('✅ Password reset successful');

    return res.status(200).json({
      success: true,
      message: 'Password reset successfully'
    });

  } catch (error: any) {
    console.error('🔥 Password reset error:', error);

    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
}
