// api/user-search.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import admin from 'firebase-admin';

interface UserSearchRequest {
  loginId?: string;
  phoneNumber?: string;
  email?: string;
  purpose?: 'password-reset' | 'user-lookup';
  checkDuplicates?: boolean;
  apiKey?: string;
}

interface UserSearchResponse {
  success: boolean;
  phoneNumber?: string;
  userData?: any;
  message?: string;
  error?: string;
  exists?: boolean;
  field?: 'phone' | 'email';
  count?: number;
}

// Initialize Firebase Admin SDK
function initializeFirebaseAdmin() {
  if (admin.apps.length > 0) {
    console.log('✅ Firebase Admin already initialized');
    return;
  }

  try {
    console.log('🔧 Initializing Firebase Admin...');

    // METHOD 1: Try using full service account JSON (RECOMMENDED)
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
    
    if (serviceAccountJson) {
      console.log('📋 Using FIREBASE_SERVICE_ACCOUNT (full JSON)');
      const serviceAccount = JSON.parse(serviceAccountJson);
      
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      
      console.log('✅ Firebase Admin initialized with full JSON');
      return;
    }

    // METHOD 2: Fallback to individual credentials
    console.log('📋 Using individual credentials (fallback)');
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (!projectId || !clientEmail || !privateKey) {
      throw new Error('Missing Firebase credentials. Please set FIREBASE_SERVICE_ACCOUNT or individual credentials.');
    }

    // Fix private key formatting
    privateKey = privateKey.replace(/\\n/g, '\n');
    privateKey = privateKey.replace(/^["']|["']$/g, '');

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });

    console.log('✅ Firebase Admin initialized with individual credentials');
  } catch (error: any) {
    console.error('❌ Firebase Admin initialization error:', error.message);
    console.error('Stack:', error.stack);
    throw error;
  }
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse<UserSearchResponse>
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
        error: 'Firebase Admin configuration error. Please check environment variables.',
      });
    }

    const { loginId, phoneNumber, email, purpose, checkDuplicates, apiKey } = req.body as UserSearchRequest;

    // Optional: Validate API Key if MASTER_KEY is set
    const MASTER_API_KEY = process.env.SMS_MASTER_KEY;
    if (MASTER_API_KEY && apiKey !== MASTER_API_KEY) {
      console.error('❌ Unauthorized request - invalid API key');
      return res.status(401).json({
        success: false,
        error: 'Unauthorized request',
      });
    }

    const db = admin.firestore();

    // ==========================================
    // DUPLICATE CHECK MODE (for registration)
    // ==========================================
    if (checkDuplicates && phoneNumber) {
      console.log('🔍 Checking for duplicate phone numbers:', phoneNumber.substring(0, 5) + '****');
      
      const phoneQuery = await db.collection('users')
        .where('phoneNumber', '==', phoneNumber)
        .get();

      const count = phoneQuery.size;
      
      console.log(`✅ Found ${count} account(s) with this phone number`);
      
      return res.status(200).json({
        success: true,
        count,
        message: count > 0 ? `${count} account(s) found with this phone number` : 'No accounts found'
      });
    }

    // ==========================================
    // EXISTING USER CHECK MODE (deprecated - kept for backward compatibility)
    // ==========================================
    if (!loginId && !purpose && (phoneNumber || email)) {
      console.log('🔍 Checking user existence:', {
        hasPhone: !!phoneNumber,
        hasEmail: !!email
      });

      // Check phone number in Firestore
      if (phoneNumber) {
        console.log('🔍 Checking phone number in Firestore:', phoneNumber.substring(0, 5) + '****');
        const phoneQuery = await db.collection('users')
          .where('phoneNumber', '==', phoneNumber)
          .limit(1)
          .get();

        if (!phoneQuery.empty) {
          console.log('⚠️ Phone number already exists in Firestore');
          return res.status(200).json({
            success: true,
            exists: true,
            field: 'phone',
            message: 'This phone number is already registered'
          });
        }
        
        console.log('✅ Phone number available in Firestore');
      }

      // Check email in Firestore
      if (email && email.trim() && !email.endsWith('@student.local')) {
        console.log('🔍 Checking email in Firestore only:', email);
        
        const emailQuery = await db.collection('users')
          .where('email', '==', email)
          .limit(1)
          .get();

        if (!emailQuery.empty) {
          console.log('⚠️ Email already exists in Firestore');
          return res.status(200).json({
            success: true,
            exists: true,
            field: 'email',
            message: 'This email is already registered'
          });
        }
        
        // Check for orphaned auth accounts
        try {
          const userRecord = await admin.auth().getUserByEmail(email);
          if (userRecord) {
            console.log('⚠️ Orphaned auth account detected for email:', email);
            
            const userDoc = await db.collection('users').doc(userRecord.uid).get();
            
            if (!userDoc.exists()) {
              console.log('🗑️ Deleting orphaned auth account:', userRecord.uid);
              await admin.auth().deleteUser(userRecord.uid);
              console.log('✅ Orphaned account deleted - email is now available');
            } else {
              console.log('⚠️ Email already registered with active account');
              return res.status(200).json({
                success: true,
                exists: true,
                field: 'email',
                message: 'This email is already registered'
              });
            }
          }
        } catch (authError: any) {
          if (authError.code === 'auth/user-not-found') {
            console.log('✅ Email not found in Firebase Authentication');
          } else {
            console.error('⚠️ Error checking Firebase Auth:', authError.message);
          }
        }
        
        console.log('✅ Email available for registration');
      }

      console.log('✅ Phone/Email available for registration');
      return res.status(200).json({
        success: true,
        exists: false,
        message: 'Available'
      });
    }

    // ==========================================
    // USER LOOKUP MODE (for login/password reset)
    // ==========================================
    if (!loginId || !purpose) {
      console.error('❌ Missing required fields for user lookup');
      return res.status(400).json({
        success: false,
        error: 'Login ID and purpose are required for user lookup',
      });
    }

    console.log('🔍 User search request:', {
      purpose,
      loginIdPrefix: loginId?.substring(0, 5) + '...',
      hasApiKey: !!apiKey
    });
    
    let userDoc = null;
    let userData = null;

    console.log('🔍 Searching by userId...');
    // Try to find by userId
    try {
      const userIdQuery = await db.collection('users')
        .where('userId', '==', loginId)
        .limit(1)
        .get();
      
      if (!userIdQuery.empty) {
        userDoc = userIdQuery.docs[0];
        userData = userDoc.data();
        console.log('✅ User found by Student ID');
      }
    } catch (queryError: any) {
      console.error('⚠️ Error querying by userId:', queryError.message);
    }

    // Try to find by phone number
    if (!userData) {
      console.log('🔍 Searching by phoneNumber...');
      try {
        const phoneQuery = await db.collection('users')
          .where('phoneNumber', '==', loginId)
          .limit(1)
          .get();
        
        if (!phoneQuery.empty) {
          userDoc = phoneQuery.docs[0];
          userData = phoneQuery.docs[0].data();
          console.log('✅ User found by phone number');
        }
      } catch (queryError: any) {
        console.error('⚠️ Error querying by phoneNumber:', queryError.message);
      }
    }

    // Try to find by email
    if (!userData) {
      console.log('🔍 Searching by email...');
      try {
        const emailQuery = await db.collection('users')
          .where('email', '==', loginId)
          .limit(1)
          .get();
        
        if (!emailQuery.empty) {
          userDoc = emailQuery.docs[0];
          userData = emailQuery.docs[0].data();
          console.log('✅ User found by email');
        }
      } catch (queryError: any) {
        console.error('⚠️ Error querying by email:', queryError.message);
      }
    }

    if (!userData) {
      console.log('❌ User not found with login ID:', loginId.substring(0, 5) + '...');
      return res.status(404).json({
        success: false,
        error: 'Account not found. Please check your Student ID, phone number, or email.',
      });
    }

    // Check if user has phone number
    if (!userData.phoneNumber) {
      console.error('❌ No phone number on account');
      return res.status(400).json({
        success: false,
        error: 'No phone number associated with this account. Please contact support.',
      });
    }

    console.log('✅ User search successful - Phone:', userData.phoneNumber.substring(0, 5) + '****');

    // For password-reset purpose, only return phone number
    if (purpose === 'password-reset') {
      return res.status(200).json({
        success: true,
        phoneNumber: userData.phoneNumber,
        message: 'Account found. Please verify your phone number.'
      });
    }

    // For user-lookup purpose (sign-in), return full user data
    if (purpose === 'user-lookup') {
      // Include the Firestore document ID as uid
      const userDataWithUid = {
        uid: userDoc?.id,
        ...userData
      };

      return res.status(200).json({
        success: true,
        phoneNumber: userData.phoneNumber,
        userData: userDataWithUid,
        message: 'User found successfully.'
      });
    }

    // Unknown purpose
    return res.status(400).json({
      success: false,
      error: 'Invalid purpose specified'
    });

  } catch (error: any) {
    console.error('🔥 User search error:', {
      message: error.message,
      code: error.code,
      stack: error.stack
    });

    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
}
