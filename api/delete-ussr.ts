import type { VercelRequest, VercelResponse } from '@vercel/node';

// Initialize Firebase Admin SDK with better error handling
let admin: any;
let initialized = false;

async function initializeFirebaseAdmin() {
  if (initialized) {
    return admin;
  }

  try {
    // Dynamic import to avoid module loading issues
    admin = await import('firebase-admin');
    
    if (!admin.apps || admin.apps.length === 0) {
      const projectId = process.env.FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
      
      console.log('🔧 Initializing Firebase Admin...');
      console.log('Project ID:', projectId ? '✓' : '✗');
      console.log('Client Email:', clientEmail ? '✓' : '✗');
      console.log('Private Key:', privateKey ? '✓' : '✗');
      
      if (!projectId || !clientEmail || !privateKey) {
        throw new Error('Missing Firebase Admin credentials');
      }

      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
      
      console.log('✅ Firebase Admin initialized successfully');
    }
    
    initialized = true;
    return admin;
  } catch (error: any) {
    console.error('❌ Firebase Admin initialization failed:', error);
    throw new Error(`Firebase initialization failed: ${error.message}`);
  }
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  console.log('📥 API Request received:', req.method);

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
    // Initialize Firebase Admin
    const adminSDK = await initializeFirebaseAdmin();
    
    const { uid, email, action, apiKey } = req.body;

    console.log('📥 Request body:', { uid, email, action, hasApiKey: !!apiKey });

    // Verify action
    if (action !== 'delete-auth-user') {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid action' 
      });
    }

    // Verify API key if provided
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

    console.log('🗑️ Starting deletion for UID:', uid);

    const auth = adminSDK.auth();
    const db = adminSDK.firestore();

    let authDeleted = false;
    let firestoreDeleted = false;

    // Step 1: Delete from Firebase Authentication
    try {
      console.log('🔥 Attempting to delete from Firebase Auth...');
      await auth.deleteUser(uid);
      authDeleted = true;
      console.log('✅ Deleted from Firebase Auth');
    } catch (error: any) {
      console.error('❌ Auth deletion error:', error.code, error.message);
      
      if (error.code === 'auth/user-not-found') {
        console.log('⚠️ User not found in Auth (already deleted)');
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
        console.log('✅ Deleted from Firestore');
      } else {
        console.log('⚠️ User not found in Firestore (already deleted)');
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

    // Success
    console.log('✅ Deletion completed successfully');
    return res.status(200).json({ 
      success: true, 
      message: 'User deleted from both Auth and Firestore',
      uid,
      details: {
        authDeleted,
        firestoreDeleted
      }
    });

  } catch (error: any) {
    console.error('❌ Unexpected error:', error);
    
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Internal server error',
      details: error.stack?.split('\n').slice(0, 3).join('\n')
    });
  }
}
