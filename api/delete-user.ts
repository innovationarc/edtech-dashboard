// api/delete-user.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Global cache for Firebase Admin instance
let firebaseAdmin: any = null;

/**
 * Initialize Firebase Admin SDK using SERVICE ACCOUNT JSON approach
 * This bypasses the private key string parsing issues
 */
async function initializeFirebaseAdmin() {
  // Return cached instance if available
  if (firebaseAdmin !== null) {
    console.log('✅ Using cached Firebase Admin instance');
    return firebaseAdmin;
  }

  try {
    console.log('🔧 Initializing Firebase Admin SDK...');
    console.log('='.repeat(60));
    
    // Use dynamic import for ES module compatibility
    const admin = await import('firebase-admin').then(m => m.default || m);
    
    // Check if already initialized
    if (admin.apps && admin.apps.length > 0) {
      console.log('✅ Firebase Admin already initialized');
      firebaseAdmin = admin;
      return admin;
    }

    // Get credentials from environment variables
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKeyEnv = process.env.FIREBASE_PRIVATE_KEY;

    // Validate required environment variables
    if (!projectId || !clientEmail || !privateKeyEnv) {
      const missing = [];
      if (!projectId) missing.push('FIREBASE_PROJECT_ID');
      if (!clientEmail) missing.push('FIREBASE_CLIENT_EMAIL');
      if (!privateKeyEnv) missing.push('FIREBASE_PRIVATE_KEY');
      throw new Error(`Missing environment variables: ${missing.join(', ')}`);
    }

    console.log('📋 Credentials found:');
    console.log('  ✓ Project ID:', projectId);
    console.log('  ✓ Client Email:', clientEmail);
    console.log('  ✓ Private Key length:', privateKeyEnv.length);
    console.log('');

    // Process private key with MULTIPLE fallback strategies
    let privateKey = privateKeyEnv;
    
    // Strategy 1: Replace \\n with actual newlines
    if (privateKey.includes('\\n')) {
      console.log('🔑 Strategy 1: Replacing \\\\n with newlines');
      privateKey = privateKey.replace(/\\n/g, '\n');
    }
    
    // Strategy 2: Ensure proper line endings (remove \r if present)
    if (privateKey.includes('\r')) {
      console.log('🔑 Strategy 2: Removing carriage returns');
      privateKey = privateKey.replace(/\r/g, '');
    }
    
    // Strategy 3: Ensure proper trimming
    privateKey = privateKey.trim();
    
    // Create a complete service account object
    // This is the RECOMMENDED way by Firebase Admin SDK
    const serviceAccount = {
      type: 'service_account',
      project_id: projectId,
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID || undefined,
      private_key: privateKey,
      client_email: clientEmail,
      client_id: process.env.FIREBASE_CLIENT_ID || undefined,
      auth_uri: 'https://accounts.google.com/o/oauth2/auth',
      token_uri: 'https://oauth2.googleapis.com/token',
      auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
      client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${encodeURIComponent(clientEmail)}`
    };

    console.log('🚀 Initializing with service account object...');
    console.log('  - Type:', serviceAccount.type);
    console.log('  - Project ID:', serviceAccount.project_id);
    console.log('  - Client Email:', serviceAccount.client_email);
    console.log('  - Has Private Key:', !!serviceAccount.private_key);
    console.log('  - Private Key starts with:', serviceAccount.private_key.substring(0, 30));
    console.log('');

    // Initialize Firebase Admin with the service account object
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount as any),
      projectId: projectId
    });

    console.log('✅ Firebase Admin SDK initialized successfully!');
    console.log('='.repeat(60));
    console.log('');
    
    // Cache the instance
    firebaseAdmin = admin;
    
    return admin;

  } catch (error: any) {
    console.error('');
    console.error('❌ FIREBASE ADMIN INITIALIZATION FAILED');
    console.error('='.repeat(60));
    console.error('Error Type:', error.constructor.name);
    console.error('Error Message:', error.message);
    console.error('Error Code:', error.code || 'N/A');
    
    if (error.stack) {
      console.error('');
      console.error('Stack Trace (first 10 lines):');
      const stackLines = error.stack.split('\n').slice(0, 10);
      stackLines.forEach((line: string) => console.error(line));
    }
    
    console.error('');
    console.error('='.repeat(60));
    console.error('');
    
    // Reset cache on failure
    firebaseAdmin = null;
    
    // Re-throw with clear message
    throw new Error(`Firebase Admin initialization failed: ${error.message}`);
  }
}

/**
 * Delete profile picture from Supabase Storage
 */
async function deleteProfilePicture(profilePictureUrl: string): Promise<boolean> {
  try {
    console.log('🖼️ Deleting profile picture from Supabase...');
    
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.warn('⚠️ Supabase credentials not configured');
      return false;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const urlParts = profilePictureUrl.split('/uploads/');
    if (urlParts.length < 2) {
      console.warn('⚠️ Invalid profile picture URL format');
      return false;
    }
    
    const filePath = urlParts[1];
    
    const { error } = await supabase.storage
      .from('uploads')
      .remove([filePath]);
    
    if (error) {
      console.error('❌ Supabase deletion error:', error.message);
      return false;
    }
    
    console.log('✅ Profile picture deleted');
    return true;
    
  } catch (error: any) {
    console.error('❌ Profile picture deletion error:', error.message);
    return false;
  }
}

/**
 * Unified API handler for deleting users
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  console.log('\n' + '='.repeat(80));
  console.log('DELETE USER API');
  console.log('Time:', new Date().toISOString());
  console.log('='.repeat(80) + '\n');

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  }

  try {
    const { uid, email, action, profilePictureUrl, apiKey } = req.body;

    console.log('📥 Request:');
    console.log('  - UID:', uid);
    console.log('  - Action:', action);

    if (action !== 'delete-auth-user') {
      return res.status(400).json({
        success: false,
        error: 'Invalid action'
      });
    }

    if (!uid) {
      return res.status(400).json({
        success: false,
        error: 'UID is required'
      });
    }

    const masterKey = process.env.VITE_SMS_MASTER_KEY || process.env.SMS_MASTER_KEY;
    if (masterKey && apiKey !== masterKey) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    // Initialize Firebase Admin
    let admin: any;
    try {
      admin = await initializeFirebaseAdmin();
      console.log('✅ Firebase Admin ready');
    } catch (initError: any) {
      console.error('❌ Init failed:', initError.message);
      return res.status(500).json({
        success: false,
        error: 'Failed to initialize Firebase Admin SDK',
        details: initError.message
      });
    }

    const firestore = admin.firestore();
    const auth = admin.auth();

    let firestoreDeleted = false;
    let profilePicDeleted = false;
    let authDeleted = false;
    const errors: string[] = [];

    // STEP 1: Delete from Firestore
    console.log('\n📄 Deleting from Firestore...');
    try {
      const userRef = firestore.collection('users').doc(uid);
      
      // Add timeout to prevent hanging
      const deletePromise = userRef.delete();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Firestore delete timeout after 10s')), 10000)
      );
      
      await Promise.race([deletePromise, timeoutPromise]);
      
      firestoreDeleted = true;
      console.log('✅ Firestore deleted');
    } catch (firestoreError: any) {
      const errorMsg = `Firestore error: ${firestoreError.message}`;
      console.error('❌', errorMsg);
      
      // Log the full error for debugging
      console.error('Full Firestore error:', JSON.stringify({
        name: firestoreError.name,
        message: firestoreError.message,
        code: firestoreError.code,
        details: firestoreError.details
      }, null, 2));
      
      errors.push(errorMsg);
      
      return res.status(500).json({
        success: false,
        error: 'Failed to delete user from database',
        details: {
          firestoreDeleted: false,
          errors: [errorMsg],
          errorCode: firestoreError.code,
          errorDetails: firestoreError.details
        }
      });
    }

    // STEP 2: Delete profile picture
    if (profilePictureUrl) {
      console.log('\n🖼️ Deleting profile picture...');
      try {
        profilePicDeleted = await deleteProfilePicture(profilePictureUrl);
      } catch (error: any) {
        errors.push(`Profile picture: ${error.message}`);
      }
    } else {
      profilePicDeleted = true;
    }

    // STEP 3: Delete from Auth
    console.log('\n🔐 Deleting from Auth...');
    try {
      await auth.deleteUser(uid);
      authDeleted = true;
      console.log('✅ Auth deleted');
    } catch (authError: any) {
      if (authError.code === 'auth/user-not-found') {
        authDeleted = true;
      } else {
        errors.push(`Auth: ${authError.message}`);
      }
    }

    console.log('\n✅ Deletion complete');
    console.log('='.repeat(80) + '\n');

    return res.status(200).json({
      success: true,
      message: 'User deleted successfully',
      uid,
      email: email || null,
      details: {
        firestoreDeleted: true,
        profilePicDeleted,
        authDeleted,
        timestamp: new Date().toISOString(),
        warnings: errors.length > 0 ? errors : null
      }
    });

  } catch (error: any) {
    console.error('\n❌ Unexpected error:', error.message);
    console.error('Stack:', error.stack);
    
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
}
