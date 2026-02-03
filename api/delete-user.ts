// api/delete-user.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Global cache for Firebase Admin instance
let firebaseAdmin: any = null;
let initializationAttempts = 0;
const MAX_INIT_ATTEMPTS = 3;

/**
 * Properly format and clean private key
 */
function formatPrivateKey(key: string): string {
  if (!key) {
    throw new Error('Private key is empty or undefined');
  }

  // Remove all whitespace and newlines
  let cleaned = key.trim();
  
  // Replace literal \n with actual newlines
  if (cleaned.includes('\\n')) {
    cleaned = cleaned.replace(/\\n/g, '\n');
  }
  
  // Remove any existing headers/footers
  cleaned = cleaned.replace(/-----BEGIN PRIVATE KEY-----/g, '');
  cleaned = cleaned.replace(/-----END PRIVATE KEY-----/g, '');
  
  // Remove all whitespace and newlines from the key content
  cleaned = cleaned.replace(/\s+/g, '');
  
  // Add proper headers and format with line breaks every 64 characters
  const keyContent = cleaned.match(/.{1,64}/g)?.join('\n') || cleaned;
  
  return `-----BEGIN PRIVATE KEY-----\n${keyContent}\n-----END PRIVATE KEY-----`;
}

/**
 * Initialize and return Firebase Admin SDK with enhanced error handling
 */
async function initializeFirebaseAdmin() {
  // Return cached instance if available
  if (firebaseAdmin !== null) {
    console.log('✅ Using cached Firebase Admin instance');
    return firebaseAdmin;
  }

  // Check if we've exceeded max attempts
  if (initializationAttempts >= MAX_INIT_ATTEMPTS) {
    throw new Error(`Firebase Admin initialization failed after ${MAX_INIT_ATTEMPTS} attempts`);
  }

  initializationAttempts++;

  try {
    console.log(`🔧 Initializing Firebase Admin SDK (Attempt ${initializationAttempts}/${MAX_INIT_ATTEMPTS})...`);
    
    // Use dynamic import for ES module compatibility
    const admin = await import('firebase-admin').then(m => m.default || m);
    
    // Check if already initialized
    if (admin.apps && admin.apps.length > 0) {
      console.log('✅ Firebase Admin already initialized');
      firebaseAdmin = admin;
      initializationAttempts = 0; // Reset on success
      return admin;
    }

    // Get credentials from environment variables
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;

    // Validate all required environment variables
    const missingVars = [];
    if (!projectId) missingVars.push('FIREBASE_PROJECT_ID');
    if (!clientEmail) missingVars.push('FIREBASE_CLIENT_EMAIL');
    if (!privateKeyRaw) missingVars.push('FIREBASE_PRIVATE_KEY');

    if (missingVars.length > 0) {
      const error = `Missing required environment variables: ${missingVars.join(', ')}`;
      console.error('❌', error);
      throw new Error(error);
    }

    // Format private key properly
    let privateKey: string;
    try {
      privateKey = formatPrivateKey(privateKeyRaw!);
      console.log('✅ Private key formatted successfully');
      console.log('  - Length:', privateKey.length);
      console.log('  - Starts with:', privateKey.substring(0, 30));
      console.log('  - Ends with:', privateKey.substring(privateKey.length - 30));
    } catch (keyError: any) {
      console.error('❌ Private key formatting failed:', keyError.message);
      throw new Error(`Private key formatting failed: ${keyError.message}`);
    }

    console.log('📋 Initializing with:');
    console.log('  - Project ID:', projectId);
    console.log('  - Client Email:', clientEmail);

    // Initialize Firebase Admin with credentials
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: projectId!,
        clientEmail: clientEmail!,
        privateKey: privateKey,
      }),
      projectId: projectId!,
    });

    console.log('✅ Firebase Admin SDK initialized successfully');
    
    // Cache the instance and reset attempts
    firebaseAdmin = admin;
    initializationAttempts = 0;
    
    return admin;

  } catch (error: any) {
    console.error('❌ Firebase Admin initialization failed');
    console.error('Error:', error.message);
    console.error('Code:', error.code);
    console.error('Stack:', error.stack);
    
    // Reset cache on failure
    firebaseAdmin = null;
    
    // Provide more specific error messages
    if (error.message && error.message.includes('DECODER')) {
      throw new Error('Firebase private key decoding failed. Please check your FIREBASE_PRIVATE_KEY environment variable format.');
    }
    
    throw new Error(`Firebase Admin initialization failed: ${error.message}`);
  }
}

/**
 * Delete profile picture from Supabase Storage
 */
async function deleteProfilePicture(profilePictureUrl: string): Promise<boolean> {
  try {
    console.log('🖼️ Attempting to delete profile picture from Supabase...');
    
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.warn('⚠️ Supabase credentials not configured');
      return false;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Extract file path from URL
    // URL format: https://xxx.supabase.co/storage/v1/object/public/uploads/profile-pictures/xxx.jpg
    const urlParts = profilePictureUrl.split('/uploads/');
    if (urlParts.length < 2) {
      console.warn('⚠️ Invalid profile picture URL format');
      return false;
    }
    
    const filePath = urlParts[1];
    console.log('📁 File path:', filePath);
    
    const { error } = await supabase.storage
      .from('uploads')
      .remove([filePath]);
    
    if (error) {
      console.error('❌ Supabase deletion error:', error.message);
      return false;
    }
    
    console.log('✅ Profile picture deleted from Supabase');
    return true;
    
  } catch (error: any) {
    console.error('❌ Error deleting profile picture:', error.message);
    return false;
  }
}

/**
 * Unified API handler for deleting users
 * Deletes from: Firestore (MUST SUCCEED), Supabase Storage (optional), Firebase Auth (optional)
 * Firestore deletion MUST always succeed - other deletions are best-effort
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  console.log('\n==========================================');
  console.log('UNIFIED DELETE USER API - Request received');
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
    const { uid, email, action, profilePictureUrl, apiKey } = req.body;

    console.log('📥 Request details:');
    console.log('  - UID:', uid || '[MISSING]');
    console.log('  - Email:', email || '[NONE]');
    console.log('  - Action:', action || '[MISSING]');
    console.log('  - Profile Picture URL:', profilePictureUrl ? '[PROVIDED]' : '[NONE]');
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

    console.log('\n--- Starting unified deletion process ---\n');

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

    const firestore = admin.firestore();
    const auth = admin.auth();

    // Track deletion status
    let firestoreDeleted = false;
    let profilePicDeleted = false;
    let authDeleted = false;
    const errors: string[] = [];

    // STEP 1: Delete from Firestore (CRITICAL - MUST SUCCEED)
    console.log('📄 STEP 1: Deleting from Firestore (CRITICAL)...');
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
      const errorMsg = `CRITICAL: Firestore deletion failed: ${firestoreError.message}`;
      console.error('❌', errorMsg);
      errors.push(errorMsg);
      
      // Firestore deletion failure is critical
      return res.status(500).json({
        success: false,
        error: 'Critical error: Failed to delete user from database',
        details: {
          firestoreDeleted: false,
          errors: [errorMsg]
        }
      });
    }

    // STEP 2: Delete profile picture from Supabase (OPTIONAL - non-blocking)
    if (profilePictureUrl) {
      console.log('\n🖼️ STEP 2: Deleting profile picture from Supabase (optional)...');
      try {
        profilePicDeleted = await deleteProfilePicture(profilePictureUrl);
        if (!profilePicDeleted) {
          console.warn('⚠️ Profile picture deletion failed, but continuing...');
          errors.push('Profile picture deletion failed (non-critical)');
        }
      } catch (supabaseError: any) {
        console.warn('⚠️ Profile picture deletion error:', supabaseError.message);
        errors.push(`Profile picture deletion error: ${supabaseError.message} (non-critical)`);
      }
    } else {
      console.log('\n🖼️ STEP 2: No profile picture to delete');
      profilePicDeleted = true; // No picture to delete = success
    }

    // STEP 3: Delete from Firebase Authentication (OPTIONAL - non-blocking)
    console.log('\n🔐 STEP 3: Deleting from Firebase Authentication (optional)...');
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
        console.warn('⚠️', errorMsg);
        errors.push(`${errorMsg} (non-critical)`);
        // Don't fail the entire operation - Firestore deletion succeeded
        authDeleted = false;
      }
    }

    // Determine final success status
    // Success = Firestore deleted (required), others are optional
    const overallSuccess = firestoreDeleted;

    console.log('\n--- Deletion Summary ---');
    console.log('Firestore (CRITICAL):', firestoreDeleted ? '✅ DELETED' : '❌ FAILED');
    console.log('Profile Picture:', profilePicDeleted ? '✅ DELETED' : '⚠️ FAILED (non-critical)');
    console.log('Firebase Auth:', authDeleted ? '✅ DELETED' : '⚠️ FAILED (non-critical)');
    console.log('Overall Status:', overallSuccess ? '✅ SUCCESS' : '❌ FAILURE');
    
    if (errors.length > 0) {
      console.log('Warnings/Errors:', errors);
    }
    console.log('==========================================\n');

    // Return appropriate response
    if (overallSuccess) {
      return res.status(200).json({
        success: true,
        message: 'User successfully deleted (Firestore deletion completed)',
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
    } else {
      return res.status(500).json({
        success: false,
        error: 'Critical failure: Could not delete user from database',
        uid,
        details: {
          firestoreDeleted,
          profilePicDeleted,
          authDeleted,
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
