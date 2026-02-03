// api/delete-user.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Global cache for Firebase Admin instance
let firebaseAdmin: any = null;
let initializationAttempts = 0;
const MAX_INIT_ATTEMPTS = 3;

/**
 * Properly format and clean private key
 * Handles multiple input formats from environment variables
 */
function formatPrivateKey(key: string): string {
  if (!key) {
    throw new Error('Private key is empty or undefined');
  }

  let cleaned = key.trim();
  
  // CRITICAL: First, replace escaped newlines (\\n) with actual newlines
  // This handles keys stored in .env files as single-line strings
  cleaned = cleaned.replace(/\\n/g, '\n');
  
  // If the key already has proper headers and newlines, return as-is
  // This prevents double-processing of already-formatted keys
  if (cleaned.startsWith('-----BEGIN PRIVATE KEY-----\n') && 
      cleaned.endsWith('\n-----END PRIVATE KEY-----') &&
      cleaned.split('\n').length > 2) {
    console.log('✅ Private key already properly formatted');
    return cleaned;
  }
  
  // Extract just the key content (remove headers/footers if present)
  let keyContent = cleaned
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\r/g, '') // Remove carriage returns
    .trim();
  
  // Remove any remaining newlines/spaces from the base64 content
  // The base64 content should be continuous
  keyContent = keyContent.replace(/\s/g, '');
  
  // Validate that we have base64 content
  if (keyContent.length === 0) {
    throw new Error('Private key content is empty after processing');
  }
  
  // Check if it looks like valid base64
  if (!/^[A-Za-z0-9+/=]+$/.test(keyContent)) {
    throw new Error('Private key does not appear to be valid base64');
  }
  
  // Return properly formatted key with newlines every 64 characters
  const formattedContent = keyContent.match(/.{1,64}/g)?.join('\n') || keyContent;
  
  return `-----BEGIN PRIVATE KEY-----\n${formattedContent}\n-----END PRIVATE KEY-----`;
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

    // Format private key properly with fallback
    let privateKey: string;
    let privateKeyFormatted: string | null = null;
    
    try {
      console.log('🔑 Processing private key...');
      console.log('  - Raw key length:', privateKeyRaw!.length);
      console.log('  - Raw key preview:', privateKeyRaw!.substring(0, 50).replace(/\n/g, '\\n'));
      
      privateKeyFormatted = formatPrivateKey(privateKeyRaw!);
      privateKey = privateKeyFormatted;
      
      console.log('✅ Private key formatted successfully');
      console.log('  - Formatted key length:', privateKey.length);
      console.log('  - Line count:', privateKey.split('\n').length);
      console.log('  - First line:', privateKey.split('\n')[0]);
      console.log('  - Last line:', privateKey.split('\n')[privateKey.split('\n').length - 1]);
    } catch (keyError: any) {
      console.error('⚠️ Private key formatting failed:', keyError.message);
      console.log('🔄 Trying original key with basic \\n replacement as fallback...');
      
      // Fallback: Just replace \\n with actual newlines
      privateKey = privateKeyRaw!.replace(/\\n/g, '\n');
      console.log('  - Fallback key length:', privateKey.length);
      console.log('  - Fallback key preview (first 50):', privateKey.substring(0, 50));
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
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    console.error('Error code:', error.code || 'N/A');
    
    if (error.stack) {
      console.error('Stack trace (first 5 lines):');
      console.error(error.stack.split('\n').slice(0, 5).join('\n'));
    }
    
    // Reset cache on failure
    firebaseAdmin = null;
    
    // Provide more specific error messages based on error type
    if (error.message && (error.message.includes('DECODER') || error.message.includes('PEM'))) {
      throw new Error(
        'Firebase private key format error. Please ensure FIREBASE_PRIVATE_KEY environment variable contains a valid private key. ' +
        'The key should start with "-----BEGIN PRIVATE KEY-----" and end with "-----END PRIVATE KEY-----". ' +
        'If stored as a single line, use \\n for line breaks (e.g., "-----BEGIN PRIVATE KEY-----\\nMIIE...\\n-----END PRIVATE KEY-----")'
      );
    }
    
    if (error.message && error.message.includes('base64')) {
      throw new Error('Firebase private key contains invalid base64 characters. Please check your FIREBASE_PRIVATE_KEY environment variable.');
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
