import type { VercelRequest, VercelResponse } from '@vercel/node';

// Firebase Admin will be initialized dynamically
let adminSDK: any = null;
let initialized = false;

async function initializeFirebaseAdmin() {
  if (initialized && adminSDK) {
    return adminSDK;
  }

  try {
    console.log('🔧 Starting Firebase Admin initialization...');
    
    // Dynamically import firebase-admin
    const admin = await import('firebase-admin');
    
    // Check if already initialized
    if (admin.apps && admin.apps.length > 0) {
      console.log('✅ Firebase Admin already initialized');
      adminSDK = admin;
      initialized = true;
      return admin;
    }

    // Get credentials from environment variables
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    
    console.log('🔍 Checking environment variables:');
    console.log('Project ID:', projectId ? '✓ Present' : '✗ Missing');
    console.log('Client Email:', clientEmail ? '✓ Present' : '✗ Missing');
    console.log('Private Key:', privateKey ? '✓ Present' : '✗ Missing');
    
    if (!projectId || !clientEmail || !privateKey) {
      const missing = [];
      if (!projectId) missing.push('FIREBASE_PROJECT_ID');
      if (!clientEmail) missing.push('FIREBASE_CLIENT_EMAIL');
      if (!privateKey) missing.push('FIREBASE_PRIVATE_KEY');
      
      throw new Error(`Missing Firebase credentials: ${missing.join(', ')}`);
    }

    // Initialize Firebase Admin
    console.log('🚀 Initializing Firebase Admin SDK...');
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
    
    console.log('✅ Firebase Admin initialized successfully');
    adminSDK = admin;
    initialized = true;
    
    return admin;
  } catch (error: any) {
    console.error('❌ Firebase Admin initialization failed:', error.message);
    console.error('Stack:', error.stack);
    throw new Error(`Firebase initialization failed: ${error.message}`);
  }
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  console.log('📥 DELETE USER API - Request received:', req.method);

  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed. Use POST.' 
    });
  }

  try {
    const { uid, email, action, apiKey } = req.body;

    console.log('📋 Request details:', { 
      uid: uid ? '✓' : '✗', 
      email: email ? '✓' : '✗', 
      action,
      hasApiKey: !!apiKey 
    });

    // Verify action
    if (action !== 'delete-auth-user') {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid action. Expected "delete-auth-user"' 
      });
    }

    // Verify API key if provided in environment
    const MASTER_API_KEY = process.env.VITE_SMS_MASTER_KEY || process.env.SMS_MASTER_KEY;
    if (MASTER_API_KEY && apiKey !== MASTER_API_KEY) {
      console.warn('⚠️ Invalid API key provided');
      return res.status(403).json({ 
        success: false, 
        error: 'Invalid API key' 
      });
    }

    // Validate required fields
    if (!uid) {
      return res.status(400).json({ 
        success: false, 
        error: 'User UID is required' 
      });
    }

    console.log('🔥 Processing deletion for UID:', uid);

    // Initialize Firebase Admin
    let admin: any;
    try {
      admin = await initializeFirebaseAdmin();
    } catch (initError: any) {
      console.error('❌ Initialization error:', initError.message);
      return res.status(500).json({
        success: false,
        error: `Firebase initialization failed: ${initError.message}`,
        details: initError.stack?.split('\n').slice(0, 3).join('\n')
      });
    }

    const auth = admin.auth();
    const db = admin.firestore();

    let authDeleted = false;
    let firestoreDeleted = false;

    // Step 1: Delete from Firebase Authentication
    try {
      console.log('🔐 Attempting to delete from Firebase Auth...');
      await auth.deleteUser(uid);
      authDeleted = true;
      console.log('✅ Successfully deleted from Firebase Auth');
    } catch (error: any) {
      console.error('❌ Auth deletion error:', {
        code: error.code,
        message: error.message
      });
      
      // If user not found in Auth, consider it already deleted
      if (error.code === 'auth/user-not-found') {
        console.log('⚠️ User not found in Auth (may have been deleted already)');
        authDeleted = true;
      } else {
        return res.status(500).json({
          success: false,
          error: `Auth deletion failed: ${error.message}`,
          code: error.code
        });
      }
    }

    // Step 2: Delete from Firestore
    try {
      console.log('📄 Attempting to delete from Firestore...');
      const userRef = db.collection('users').doc(uid);
      const userDoc = await userRef.get();
      
      if (userDoc.exists) {
        await userRef.delete();
        firestoreDeleted = true;
        console.log('✅ Successfully deleted from Firestore');
      } else {
        console.log('⚠️ User not found in Firestore (may have been deleted already)');
        firestoreDeleted = true;
      }
    } catch (error: any) {
      console.error('❌ Firestore deletion error:', error.message);
      return res.status(500).json({
        success: false,
        error: `Firestore deletion failed: ${error.message}`,
        code: error.code
      });
    }

    // Success response
    console.log('✅ User deletion completed successfully');
    return res.status(200).json({ 
      success: true, 
      message: 'User deleted successfully from both Firebase Auth and Firestore',
      uid,
      email: email || 'N/A',
      details: {
        authDeleted,
        firestoreDeleted
      }
    });

  } catch (error: any) {
    console.error('❌ Unexpected error in delete-user API:', error.message);
    console.error('Stack trace:', error.stack);
    
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Internal server error',
      details: error.stack?.split('\n').slice(0, 3).join('\n')
    });
  }
}
