// api/delete-user.ts

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin SDK
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
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

    const auth = getAuth();
    const db = getFirestore();

    let authDeleted = false;
    let firestoreDeleted = false;

    // Step 1: Delete from Firebase Authentication
    try {
      await auth.deleteUser(uid);
      authDeleted = true;
      console.log('✅ User deleted from Firebase Authentication:', uid);
    } catch (authError: any) {
      console.error('❌ Firebase Auth deletion error:', authError);
      
      // Handle specific error cases
      if (authError.code === 'auth/user-not-found') {
        // User already deleted or doesn't exist - consider this a success
        console.log('⚠️ User not found in Firebase Auth (may already be deleted):', uid);
        authDeleted = true;
      } else {
        throw new Error(`Firebase Auth deletion failed: ${authError.message}`);
      }
    }

    // Step 2: Delete from Firestore
    try {
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
    } catch (firestoreError: any) {
      console.error('❌ Firestore deletion error:', firestoreError);
      throw new Error(`Firestore deletion failed: ${firestoreError.message}`);
    }

    // Return success if both operations completed
    if (authDeleted && firestoreDeleted) {
      console.log('✅ User deletion completed successfully');
      return res.status(200).json({ 
        success: true, 
        message: 'User deleted successfully from both Firebase Authentication and Firestore',
        uid,
        details: {
          authDeleted,
          firestoreDeleted
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
      details: error.code || 'unknown_error'
    });
  }
}
