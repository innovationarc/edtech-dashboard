import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  try {
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    
    if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !privateKey) {
      throw new Error('Missing Firebase Admin credentials. Please check environment variables.');
    }

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: privateKey,
      }),
    });
    
    console.log('✅ Firebase Admin initialized successfully');
  } catch (error) {
    console.error('❌ Firebase Admin initialization failed:', error);
    throw error;
  }
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
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

    console.log('📥 Received delete request:', { uid, email, action });

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

    console.log('🗑️ Starting user deletion process:', { uid, email });

    const auth = admin.auth();
    const db = admin.firestore();

    let authDeleted = false;
    let firestoreDeleted = false;
    let authError = null;
    let firestoreError = null;

    // Step 1: Delete from Firebase Authentication
    try {
      console.log('🔥 Deleting from Firebase Auth...');
      await auth.deleteUser(uid);
      authDeleted = true;
      console.log('✅ User deleted from Firebase Authentication:', uid);
    } catch (error: any) {
      console.error('❌ Firebase Auth deletion error:', error);
      authError = error;
      
      // Handle specific error cases
      if (error.code === 'auth/user-not-found') {
        // User already deleted or doesn't exist - consider this a success
        console.log('⚠️ User not found in Firebase Auth (may already be deleted):', uid);
        authDeleted = true;
        authError = null; // Clear error since it's not a real failure
      } else {
        // This is a real error, we should fail here
        throw new Error(`Firebase Auth deletion failed: ${error.message}`);
      }
    }

    // Step 2: Delete from Firestore
    try {
      console.log('📄 Deleting from Firestore...');
      const userRef = db.collection('users').doc(uid);
      const userDoc = await userRef.get();
      
      if (userDoc.exists) {
        await userRef.delete();
        firestoreDeleted = true;
        console.log('✅ User deleted from Firestore:', uid);
      } else {
        console.log('⚠️ User not found in Firestore (may already be deleted):', uid);
        firestoreDeleted = true; // Consider it a success if already deleted
      }
    } catch (error: any) {
      console.error('❌ Firestore deletion error:', error);
      firestoreError = error;
      throw new Error(`Firestore deletion failed: ${error.message}`);
    }

    // Return success if both operations completed
    if (authDeleted && firestoreDeleted) {
      console.log('✅ User deletion completed successfully');
      return res.status(200).json({ 
        success: true, 
        message: 'User deleted successfully from both Firebase Authentication and Firestore',
        uid,
        details: {
          authDeleted: true,
          firestoreDeleted: true
        }
      });
    } else {
      throw new Error('User deletion incomplete');
    }

  } catch (error: any) {
    console.error('❌ Server error:', error);
    
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to delete user',
      details: error.code || 'unknown_error',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
