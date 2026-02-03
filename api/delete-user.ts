// api/delete-user.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Global cache for Firebase Admin instance
let firebaseAdmin: any = null;

/**
 * Initialize Firebase Admin SDK with COMPREHENSIVE DEBUGGING
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

    console.log('📋 Environment Variables Status:');
    console.log('  ✓ Project ID:', projectId);
    console.log('  ✓ Client Email:', clientEmail);
    console.log('  ✓ Private Key exists: YES');
    console.log('  ✓ Private Key raw length:', privateKeyEnv.length);
    console.log('');

    // DEEP INSPECTION of the private key
    console.log('🔍 DEEP PRIVATE KEY INSPECTION:');
    console.log('-'.repeat(60));
    
    // Show first 100 characters
    console.log('First 100 chars (raw):');
    console.log(JSON.stringify(privateKeyEnv.substring(0, 100)));
    console.log('');
    
    // Show last 100 characters
    console.log('Last 100 chars (raw):');
    console.log(JSON.stringify(privateKeyEnv.substring(privateKeyEnv.length - 100)));
    console.log('');
    
    // Check for different newline patterns
    const hasBackslashN = privateKeyEnv.includes('\\n');
    const hasActualNewline = privateKeyEnv.includes('\n');
    const hasCarriageReturn = privateKeyEnv.includes('\r');
    
    console.log('Newline Analysis:');
    console.log('  - Contains \\\\n (escaped):', hasBackslashN);
    console.log('  - Contains \\n (actual):', hasActualNewline);
    console.log('  - Contains \\r (carriage return):', hasCarriageReturn);
    console.log('');

    // Process the private key - TRY MULTIPLE APPROACHES
    let privateKey: string;
    
    console.log('🔑 Processing Private Key...');
    console.log('-'.repeat(60));
    
    if (hasBackslashN && !hasActualNewline) {
      // Case 1: Has literal \n that needs to be replaced
      console.log('  Approach: Replacing \\\\n with actual newlines');
      privateKey = privateKeyEnv.replace(/\\n/g, '\n');
    } else if (hasActualNewline) {
      // Case 2: Already has actual newlines
      console.log('  Approach: Using key as-is (already has newlines)');
      privateKey = privateKeyEnv;
    } else {
      // Case 3: No newlines at all - this is wrong
      console.log('  ⚠️ WARNING: No newlines found in private key!');
      console.log('  Approach: Attempting to add newlines manually...');
      
      // Try to fix by adding newlines
      let fixed = privateKeyEnv.trim();
      
      // Remove headers if present
      fixed = fixed.replace('-----BEGIN PRIVATE KEY-----', '');
      fixed = fixed.replace('-----END PRIVATE KEY-----', '');
      fixed = fixed.trim();
      
      // Add newlines every 64 characters
      const lines = [];
      for (let i = 0; i < fixed.length; i += 64) {
        lines.push(fixed.substring(i, i + 64));
      }
      
      privateKey = '-----BEGIN PRIVATE KEY-----\n' + lines.join('\n') + '\n-----END PRIVATE KEY-----';
      console.log('  Applied manual formatting');
    }
    
    console.log('');
    console.log('Processed Key Analysis:');
    console.log('  - Final length:', privateKey.length);
    console.log('  - Number of lines:', privateKey.split('\n').length);
    console.log('  - Has BEGIN header:', privateKey.includes('-----BEGIN PRIVATE KEY-----'));
    console.log('  - Has END footer:', privateKey.includes('-----END PRIVATE KEY-----'));
    console.log('');
    
    // Show the structure
    const lines = privateKey.split('\n');
    console.log('Key Structure:');
    console.log('  Line 1 (header):', JSON.stringify(lines[0]));
    if (lines.length > 1) {
      console.log('  Line 2 (first data):', JSON.stringify(lines[1].substring(0, 50)) + '...');
    }
    if (lines.length > 2) {
      console.log('  Line', lines.length - 1, '(last data):', '...' + JSON.stringify(lines[lines.length - 2].substring(Math.max(0, lines[lines.length - 2].length - 50))));
    }
    console.log('  Line', lines.length, '(footer):', JSON.stringify(lines[lines.length - 1]));
    console.log('');
    
    // Additional validation
    console.log('Final Validation:');
    const hasProperStart = privateKey.trim().startsWith('-----BEGIN PRIVATE KEY-----');
    const hasProperEnd = privateKey.trim().endsWith('-----END PRIVATE KEY-----');
    console.log('  ✓ Starts with header:', hasProperStart);
    console.log('  ✓ Ends with footer:', hasProperEnd);
    console.log('  ✓ Minimum length (>100):', privateKey.length > 100);
    console.log('');
    
    if (!hasProperStart || !hasProperEnd) {
      console.error('❌ CRITICAL: Private key missing proper headers/footers!');
      console.log('This will definitely cause PEM parsing to fail.');
      console.log('');
    }
    
    console.log('='.repeat(60));
    console.log('');
    
    // Try to initialize
    console.log('🚀 Attempting Firebase Admin initialization...');
    
    const credential = {
      projectId: projectId,
      clientEmail: clientEmail,
      privateKey: privateKey
    };

    admin.initializeApp({
      credential: admin.credential.cert(credential)
    });

    console.log('✅ Firebase Admin SDK initialized successfully!');
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
    console.error('');
    
    if (error.stack) {
      console.error('Stack Trace:');
      const stackLines = error.stack.split('\n').slice(0, 15);
      stackLines.forEach((line: string) => console.error(line));
      console.error('');
    }
    
    // Check for specific error patterns
    if (error.message && error.message.includes('PEM')) {
      console.error('🔍 PEM ERROR DETECTED:');
      console.error('This means the private key format is not recognized by the crypto library.');
      console.error('');
      console.error('Common causes:');
      console.error('  1. Missing newlines between header and key data');
      console.error('  2. Wrong header (should be "-----BEGIN PRIVATE KEY-----")');
      console.error('  3. Extra whitespace or special characters');
      console.error('  4. Key data is corrupted or incomplete');
      console.error('');
      console.error('Please check the FIREBASE_PRIVATE_KEY environment variable.');
      console.error('It should look like this (with actual newlines):');
      console.error('-----BEGIN PRIVATE KEY-----');
      console.error('MIIEvQIBADANBgkqhkiG9w0BAQ...');
      console.error('...more base64 lines...');
      console.error('-----END PRIVATE KEY-----');
      console.error('');
      console.error('Or as a single line with \\n:');
      console.error('"-----BEGIN PRIVATE KEY-----\\nMIIEvQIB...\\n-----END PRIVATE KEY-----"');
      console.error('');
    }
    
    console.error('='.repeat(60));
    console.error('');
    
    // Reset cache on failure
    firebaseAdmin = null;
    
    // Re-throw with clear message
    throw new Error(`Firebase initialization failed: ${error.message}`);
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
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  console.log('\n' + '='.repeat(80));
  console.log('DELETE USER API - Request received');
  console.log('Time:', new Date().toISOString());
  console.log('Method:', req.method);
  console.log('='.repeat(80) + '\n');

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
    if (masterKey && apiKey !== masterKey) {
      console.log('❌ API key mismatch');
      return res.status(403).json({
        success: false,
        error: 'Unauthorized: Invalid API key'
      });
    }

    console.log('\n' + '-'.repeat(80));
    console.log('Starting deletion process...');
    console.log('-'.repeat(80) + '\n');

    // Initialize Firebase Admin
    let admin: any;
    try {
      admin = await initializeFirebaseAdmin();
    } catch (initError: any) {
      console.error('❌ Failed to initialize Firebase Admin');
      console.error('Error details:', initError.message);
      return res.status(500).json({
        success: false,
        error: 'Failed to initialize Firebase Admin SDK',
        details: initError.message,
        hint: 'Check server logs for detailed private key inspection'
      });
    }

    const firestore = admin.firestore();
    const auth = admin.auth();

    // Track deletion status
    let firestoreDeleted = false;
    let profilePicDeleted = false;
    let authDeleted = false;
    const errors: string[] = [];

    // STEP 1: Delete from Firestore (CRITICAL)
    console.log('📄 STEP 1: Deleting from Firestore...');
    try {
      const userRef = firestore.collection('users').doc(uid);
      const userDoc = await userRef.get();
      
      if (userDoc.exists) {
        await userRef.delete();
        firestoreDeleted = true;
        console.log('✅ Deleted from Firestore');
      } else {
        console.log('ℹ️ User not found in Firestore');
        firestoreDeleted = true;
      }
    } catch (firestoreError: any) {
      const errorMsg = `Firestore deletion failed: ${firestoreError.message}`;
      console.error('❌', errorMsg);
      errors.push(errorMsg);
      
      return res.status(500).json({
        success: false,
        error: 'Failed to delete user from database',
        details: { firestoreDeleted: false, errors: [errorMsg] }
      });
    }

    // STEP 2: Delete profile picture (OPTIONAL)
    if (profilePictureUrl) {
      console.log('\n🖼️ STEP 2: Deleting profile picture...');
      try {
        profilePicDeleted = await deleteProfilePicture(profilePictureUrl);
        if (!profilePicDeleted) {
          errors.push('Profile picture deletion failed (non-critical)');
        }
      } catch (error: any) {
        errors.push(`Profile picture error: ${error.message} (non-critical)`);
      }
    } else {
      console.log('\n🖼️ STEP 2: No profile picture');
      profilePicDeleted = true;
    }

    // STEP 3: Delete from Firebase Auth (OPTIONAL)
    console.log('\n🔐 STEP 3: Deleting from Firebase Auth...');
    try {
      await auth.deleteUser(uid);
      authDeleted = true;
      console.log('✅ Deleted from Firebase Auth');
    } catch (authError: any) {
      if (authError.code === 'auth/user-not-found') {
        console.log('ℹ️ User not found in Auth');
        authDeleted = true;
      } else {
        const errorMsg = `Auth deletion failed: ${authError.message}`;
        console.warn('⚠️', errorMsg);
        errors.push(`${errorMsg} (non-critical)`);
      }
    }

    // Success response
    console.log('\n' + '-'.repeat(80));
    console.log('DELETION SUMMARY:');
    console.log('  Firestore:', firestoreDeleted ? '✅ SUCCESS' : '❌ FAILED');
    console.log('  Profile Picture:', profilePicDeleted ? '✅ SUCCESS' : '⚠️ FAILED');
    console.log('  Firebase Auth:', authDeleted ? '✅ SUCCESS' : '⚠️ FAILED');
    console.log('-'.repeat(80) + '\n');

    return res.status(200).json({
      success: true,
      message: 'User successfully deleted',
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
    console.error('\n' + '='.repeat(80));
    console.error('❌ UNEXPECTED ERROR');
    console.error('='.repeat(80));
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
    console.error('='.repeat(80) + '\n');
    
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
}
