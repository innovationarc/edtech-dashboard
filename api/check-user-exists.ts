// api/check-user-exists.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import admin from 'firebase-admin';

interface CheckUserRequest {
  phoneNumber?: string;
  email?: string;
  apiKey?: string;
}

interface CheckUserResponse {
  success: boolean;
  exists: boolean;
  field?: 'phone' | 'email';
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
  res: VercelResponse<CheckUserResponse>
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
      exists: false,
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
        exists: false,
        error: 'Firebase Admin configuration error',
      });
    }

    const { phoneNumber, email, apiKey } = req.body as CheckUserRequest;

    console.log('🔍 Checking user existence:', {
      hasPhone: !!phoneNumber,
      hasEmail: !!email
    });

    // Validate required fields
    if (!phoneNumber && !email) {
      return res.status(400).json({
        success: false,
        exists: false,
        error: 'Phone number or email is required',
      });
    }

    // Optional: Validate API Key
    const MASTER_API_KEY = process.env.SMS_MASTER_KEY;
    if (MASTER_API_KEY && apiKey !== MASTER_API_KEY) {
      console.error('❌ Unauthorized request');
      return res.status(401).json({
        success: false,
        exists: false,
        error: 'Unauthorized request',
      });
    }

    const db = admin.firestore();

    // Check phone number
    if (phoneNumber) {
      console.log('🔍 Checking phone number:', phoneNumber.substring(0, 5) + '****');
      const phoneQuery = await db.collection('users')
        .where('phoneNumber', '==', phoneNumber)
        .limit(1)
        .get();

      if (!phoneQuery.empty) {
        console.log('⚠️ Phone number already exists');
        return res.status(200).json({
          success: true,
          exists: true,
          field: 'phone',
          message: 'This phone number is already registered'
        });
      }
    }

    // Check email
    if (email && email.trim() && !email.endsWith('@student.local')) {
      console.log('🔍 Checking email:', email);
      const emailQuery = await db.collection('users')
        .where('email', '==', email)
        .limit(1)
        .get();

      if (!emailQuery.empty) {
        console.log('⚠️ Email already exists');
        return res.status(200).json({
          success: true,
          exists: true,
          field: 'email',
          message: 'This email is already registered'
        });
      }
    }

    console.log('✅ Phone/Email available');
    return res.status(200).json({
      success: true,
      exists: false,
      message: 'Available'
    });

  } catch (error: any) {
    console.error('🔥 Check user existence error:', error);

    return res.status(500).json({
      success: false,
      exists: false,
      error: error.message || 'Internal server error',
    });
  }
}
