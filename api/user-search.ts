// api/user-search.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import admin from 'firebase-admin';

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
    console.log('✅ Firebase Admin initialized');
  } catch (error: any) {
    console.error('❌ Firebase Admin initialization error:', error.message);
  }
}

interface UserSearchRequest {
  loginId: string;
  purpose: 'password-reset' | 'user-lookup';
  apiKey?: string;
}

interface UserSearchResponse {
  success: boolean;
  phoneNumber?: string;
  message?: string;
  error?: string;
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
    const { loginId, purpose, apiKey } = req.body as UserSearchRequest;

    console.log('🔍 User search request - Purpose:', purpose);

    // Validate required fields
    if (!loginId || !purpose) {
      console.error('❌ Missing required fields');
      return res.status(400).json({
        success: false,
        error: 'Login ID and purpose are required',
      });
    }

    // Optional: Validate API Key if MASTER_KEY is set
    const MASTER_API_KEY = process.env.SMS_MASTER_KEY;
    if (MASTER_API_KEY && apiKey !== MASTER_API_KEY) {
      console.error('❌ Unauthorized request');
      return res.status(401).json({
        success: false,
        error: 'Unauthorized request',
      });
    }

    // Search for user in Firestore
    const db = admin.firestore();
    
    let userDoc = null;
    let userData = null;

    console.log('🔍 Searching by userId...');
    // Try to find by userId
    const userIdQuery = await db.collection('users')
      .where('userId', '==', loginId)
      .limit(1)
      .get();
    
    if (!userIdQuery.empty) {
      userDoc = userIdQuery.docs[0];
      userData = userDoc.data();
      console.log('✅ User found by Student ID');
    }

    // Try to find by phone number
    if (!userData) {
      console.log('🔍 Searching by phoneNumber...');
      const phoneQuery = await db.collection('users')
        .where('phoneNumber', '==', loginId)
        .limit(1)
        .get();
      
      if (!phoneQuery.empty) {
        userDoc = phoneQuery.docs[0];
        userData = userDoc.data();
        console.log('✅ User found by phone number');
      }
    }

    // Try to find by email
    if (!userData) {
      console.log('🔍 Searching by email...');
      const emailQuery = await db.collection('users')
        .where('email', '==', loginId)
        .limit(1)
        .get();
      
      if (!emailQuery.empty) {
        userDoc = emailQuery.docs[0];
        userData = userDoc.data();
        console.log('✅ User found by email');
      }
    }

    if (!userData) {
      console.log('❌ User not found');
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

    console.log('✅ User search successful');

    return res.status(200).json({
      success: true,
      phoneNumber: userData.phoneNumber,
      message: 'Account found. Please verify your phone number.'
    });

  } catch (error: any) {
    console.error('🔥 User search error:', error);

    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
}
