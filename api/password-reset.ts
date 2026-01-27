// api/password-reset.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import admin from 'firebase-admin';

interface PasswordResetRequest {
  phoneNumber: string;
  newPassword: string;
  apiKey?: string;
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

    const { phoneNumber, newPassword, apiKey } = req.body as PasswordResetRequest;

    console.log('🔐 Password reset request for phone:', phoneNumber?.substring(0, 5) + '****');

    // Validate required fields
    if (!phoneNumber || !newPassword) {
      console.error('❌ Missing required fields');
      return res.status(400).json({
        success: false,
        error: 'Phone number and new password are required',
      });
    }

    // Validate password strength
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

    // Optional: Validate API Key
    const MASTER_API_KEY = process.env.SMS_MASTER_KEY;
    if (MASTER_API_KEY && apiKey !== MASTER_API_KEY) {
      console.error('❌ Unauthorized request');
      return res.status(401).json({
        success: false,
        error: 'Unauthorized request',
      });
    }

    // Find user by phone number
    const db = admin.firestore();
    const usersQuery = await db.collection('users')
      .where('phoneNumber', '==', phoneNumber)
      .limit(1)
      .get();

    if (usersQuery.empty) {
      console.error('❌ User not found');
      return res.status(404).json({
        success: false,
        error: 'Account not found',
      });
    }

    const userDoc = usersQuery.docs[0];
    const userData = userDoc.data();
    const userId = userDoc.id;

    console.log('✅ User found:', userData.userId);

    // Update password using Firebase Auth Admin SDK
    try {
      await admin.auth().updateUser(userId, {
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
      await userDoc.ref.update({
        passwordResetAt: admin.firestore.FieldValue.serverTimestamp(),
        passwordResetPending: false
      });
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
