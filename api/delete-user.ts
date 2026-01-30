import type { VercelRequest, VercelResponse } from '@vercel/node';

// Global cache for Firebase Admin instance
let firebaseAdmin: any = null;

/**
 * Initialize and return Firebase Admin SDK
 * Uses caching to prevent re-initialization
 */
async function initializeFirebaseAdmin() {
  // Return cached instance if available
  if (firebaseAdmin !== null) {
    console.log('✅ Using cached Firebase Admin instance');
    return firebaseAdmin;
  }

  try {
    console.log('🔧 Initializing Firebase Admin SDK...');
    
    // Use require for better compatibility in Vercel serverless functions
    const admin = require('firebase-admin');
    
    // Check if already initialized
    if (admin.apps && admin.apps.length > 0) {
      console.log('✅ Firebase Admin already initialized');
      firebaseAdmin = admin;
      return admin;
    }

    // Get credentials from environment variables
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;

    // Validate all required environment variables
    const missingVars = [];
    if (!projectId) missingVars.push('FIREBASE_PROJECT_ID');
    if (!clientEmail) missingVars.push('FIREBASE_CLIENT_EMAIL');
    if (!privateKey) missingVars.push('FIREBASE_PRIVATE_KEY');

    if (missingVars.length > 0) {
      const error = `Missing required environment variables: ${missingVars.join(', ')}`;
      console.error('❌', error);
      throw new Error(error);
    }

    // Process private key: replace literal \n with actual newlines
    privateKey = privateKey!.replace(/\\n/g, '\n');

    console.log('📋 Initializing with:');
    console.log('  - Project ID:', projectId);
    console.log('  - Client Email:', clientEmail);
    console.log('  - Private Key: [length:', privateKey.length, ']');

    // Initialize Firebase Admin with credentials
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
      projectId,
    });

    console.log('✅ Firebase Admin SDK initialized successfully');
    
    // Cache the instance
    firebaseAdmin = admin;
    
    return admin;

  } catch (error: any) {
    console.error('❌ Firebase Admin initialization failed');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    
    // Reset cache on failure
    firebaseAdmin = null;
    
    throw new Error(`Firebase Admin initialization failed: ${error.message}`);
  }
}

/**
 * Main API handler for deleting users
 * Deletes from BOTH Firebase Auth AND Firestore
 * Only returns success if BOTH deletions succeed
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  console.log('\n==========================================');
  console.log('DELETE USER API - Request received');
  console.log('Time:', new Date().toISOString());
  console.log('Method:', req.method);
  console.log('==========================================\n');

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    console.log('✅ Preflight request handled');
    return res.status(200).end();
  }

  // Only allow POST method
  if (req.method !== 'POST') {
    console.log('❌ Invalid method:', req.method);
    return res.status(405).json({
      success: false,
      error: 'Method not allowed. Use POST.'
    });
  }

  try {
    // Parse and validate request body
    const { uid, email, action, apiKey } = req.body;

    console.log('📥 Request details:');
    console.log('  - UID:', uid || '[MISSING]');
    console.log('  - Email:', email || '[NONE]');
    console.log('  - Action:', action || '[MISSING]');
    console.log('  - API Key:', apiKey ? '[PROVIDED]' : '[NONE]');

    // Validate action parameter
    if (action !== 'delete-auth-user') {
      console.log('❌ Invalid action:', action);
      return res.status(400).json({
        success: false,
        error: `Invalid action. Expected 'delete-auth-user', got '${action}'`
      });
    }

    // Validate UID
    if (!uid || typeof uid !== 'string' || uid.trim() === '') {
      console.log('❌ Invalid or missing UID');
      return res.status(400).json({
        success: false,
        error: 'Valid UID is required'
      });
    }

    // Verify API key if configured
    const masterKey = process.env.VITE_SMS_MASTER_KEY || process.env.SMS_MASTER_KEY;
    if (masterKey) {
      if (apiKey !== masterKey) {
        console.log('❌ API key mismatch');
        return res.status(403).json({
          success: false,
          error: 'Unauthorized: Invalid API key'
        });
      }
      console.log('✅ API key validated');
    } else {
      console.log('⚠️ No master API key configured - skipping validation');
    }

    console.log('\n--- Starting deletion process ---\n');

    // Initialize Firebase Admin
    let admin: any;
    try {
      admin = await initializeFirebaseAdmin();
    } catch (initError: any) {
      console.error('❌ Failed to initialize Firebase Admin:', initError.message);
      return res.status(500).json({
        success: false,
        error: 'Failed to initialize Firebase Admin SDK',
        details: initError.message
      });
    }

    const auth = admin.auth();
    const firestore = admin.firestore();

    // Track deletion status
    let authDeleted = false;
    let firestoreDeleted = false;
    const errors: string[] = [];

    // STEP 1: Delete from Firebase Authentication
    console.log('🔐 STEP 1: Deleting from Firebase Authentication...');
    try {
      await auth.deleteUser(uid);
      authDeleted = true;
      console.log('✅ Successfully deleted from Firebase Auth');
    } catch (authError: any) {
      // Check if user was already deleted
      if (authError.code === 'auth/user-not-found') {
        console.log('ℹ️ User not found in Auth (already deleted or never existed)');
        authDeleted = true; // Consider this a success
      } else {
        const errorMsg = `Firebase Auth deletion failed: ${authError.message} (code: ${authError.code})`;
        console.error('❌', errorMsg);
        errors.push(errorMsg);
      }
    }

    // STEP 2: Delete from Firestore
    console.log('\n📄 STEP 2: Deleting from Firestore...');
    try {
      const userRef = firestore.collection('users').doc(uid);
      const userDoc = await userRef.get();
      
      if (userDoc.exists) {
        await userRef.delete();
        firestoreDeleted = true;
        console.log('✅ Successfully deleted from Firestore');
      } else {
        console.log('ℹ️ User not found in Firestore (already deleted or never existed)');
        firestoreDeleted = true; // Consider this a success
      }
    } catch (firestoreError: any) {
      const errorMsg = `Firestore deletion failed: ${firestoreError.message}`;
      console.error('❌', errorMsg);
      errors.push(errorMsg);
    }

    // Determine final success status
    const overallSuccess = authDeleted && firestoreDeleted;

    console.log('\n--- Deletion Summary ---');
    console.log('Firebase Auth:', authDeleted ? '✅ DELETED' : '❌ FAILED');
    console.log('Firestore:', firestoreDeleted ? '✅ DELETED' : '❌ FAILED');
    console.log('Overall Status:', overallSuccess ? '✅ SUCCESS' : '❌ FAILURE');
    
    if (errors.length > 0) {
      console.log('Errors:', errors);
    }
    console.log('==========================================\n');

    // Return appropriate response
    if (overallSuccess) {
      return res.status(200).json({
        success: true,
        message: 'User successfully deleted from both Firebase Auth and Firestore',
        uid,
        email: email || null,
        details: {
          authDeleted: true,
          firestoreDeleted: true,
          timestamp: new Date().toISOString()
        }
      });
    } else {
      return res.status(500).json({
        success: false,
        error: 'Failed to delete user from both systems',
        uid,
        details: {
          authDeleted,
          firestoreDeleted,
          errors: errors.length > 0 ? errors : ['Unknown error occurred']
        }
      });
    }

  } catch (error: any) {
    console.error('\n❌ UNEXPECTED ERROR:');
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
    console.log('==========================================\n');
    
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message,
      stack: error.stack?.split('\n').slice(0, 3).join('\n')
    });
  }
}
