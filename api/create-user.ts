// api/create-user.ts (or create-user.js)
// Backend API endpoint for creating users with all 8 roles
// Uses Firebase Admin SDK to create users WITHOUT affecting client sessions

import { Request, Response } from 'express';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin SDK (if not already initialized)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    // Or use service account:
    // credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();
const auth = admin.auth();

// Role prefixes for user ID generation
const ROLE_PREFIXES: { [key: string]: string } = {
  'admin': 'AD',
  'manager': 'MG',
  'course_manager': 'CM',
  'student_manager': 'SM',
  'coordinator': 'CO',
  'teacher': 'TC',
  'parent': 'PA',
  'student': 'ST'
};

// Valid roles
const VALID_ROLES = [
  'admin',
  'manager',
  'course_manager',
  'student_manager',
  'coordinator',
  'teacher',
  'parent',
  'student'
];

/**
 * API Handler for creating users
 * POST /api/create-user
 * 
 * Request Body:
 * {
 *   email: string (Firebase auth email - e.g., AD-2501-00001@admin.local)
 *   password: string (user password)
 *   role: string (one of 8 roles)
 *   userData: object (user profile data)
 *   apiKey?: string (optional master API key for authentication)
 * }
 * 
 * Response:
 * {
 *   success: boolean
 *   uid: string (Firebase auth UID)
 *   message: string
 *   error?: string
 * }
 */
export default async function handler(req: Request, res: Response) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed. Use POST.'
    });
  }

  try {
    console.log('📡 Received create-user request');
    
    // Extract data from request body
    const {
      email,
      password,
      role,
      userData,
      apiKey
    } = req.body;

    // Validate API key if provided
    const MASTER_API_KEY = process.env.VITE_SMS_MASTER_KEY || process.env.MASTER_API_KEY;
    if (MASTER_API_KEY && apiKey !== MASTER_API_KEY) {
      console.error('❌ Invalid API key');
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Invalid API key'
      });
    }

    // Validate required fields
    if (!email || !password || !role || !userData) {
      console.error('❌ Missing required fields');
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: email, password, role, userData'
      });
    }

    // Validate role
    if (!VALID_ROLES.includes(role)) {
      console.error('❌ Invalid role:', role);
      return res.status(400).json({
        success: false,
        error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}`
      });
    }

    // Validate password strength
    if (password.length < 8) {
      console.error('❌ Weak password');
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 8 characters long'
      });
    }

    console.log(`🔐 Creating ${role} user with email: ${email}`);

    // CRITICAL: Create user with Firebase Admin SDK
    // This does NOT affect any client sessions!
    let userRecord;
    try {
      userRecord = await auth.createUser({
        email: email,
        password: password,
        emailVerified: false,
        disabled: false
      });
      console.log('✅ Firebase Auth user created with UID:', userRecord.uid);
    } catch (authError: any) {
      console.error('❌ Firebase Auth error:', authError);
      
      // Handle specific Firebase Auth errors
      if (authError.code === 'auth/email-already-exists') {
        return res.status(409).json({
          success: false,
          error: 'Email already exists. Please use a different email.'
        });
      } else if (authError.code === 'auth/invalid-email') {
        return res.status(400).json({
          success: false,
          error: 'Invalid email format.'
        });
      } else if (authError.code === 'auth/weak-password') {
        return res.status(400).json({
          success: false,
          error: 'Password is too weak.'
        });
      }
      
      throw authError;
    }

    // Prepare Firestore user data
    const firestoreData = {
      uid: userRecord.uid,
      role: role,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      deviceId: '',
      ...userData
    };

    // Ensure required fields based on role
    switch (role) {
      case 'admin':
      case 'manager':
      case 'course_manager':
      case 'student_manager':
      case 'coordinator':
      case 'teacher':
        // Professional accounts - ensure required fields
        if (!firestoreData.userId) {
          throw new Error('userId is required for this role');
        }
        if (!firestoreData.surname) {
          throw new Error('surname is required for this role');
        }
        if (!firestoreData.phoneNumber) {
          throw new Error('phoneNumber is required for this role');
        }
        break;
      
      case 'student':
        // Student accounts - ensure student-specific fields
        if (!firestoreData.userId) {
          throw new Error('userId is required for students');
        }
        if (!firestoreData.surname) {
          throw new Error('surname is required for students');
        }
        if (!firestoreData.phoneNumber) {
          throw new Error('phoneNumber is required for students');
        }
        break;
      
      case 'parent':
        // Parent accounts - ensure parent-specific fields
        if (!firestoreData.userId) {
          throw new Error('userId is required for parents');
        }
        if (!firestoreData.surname) {
          throw new Error('surname is required for parents');
        }
        if (!firestoreData.phoneNumber) {
          throw new Error('phoneNumber is required for parents');
        }
        break;
    }

    // Save user data to Firestore
    try {
      await db.collection('users').doc(userRecord.uid).set(firestoreData);
      console.log('✅ User data saved to Firestore');
    } catch (firestoreError: any) {
      console.error('❌ Firestore error:', firestoreError);
      
      // Rollback: Delete the auth user if Firestore save fails
      try {
        await auth.deleteUser(userRecord.uid);
        console.log('⚠️ Rolled back: Auth user deleted due to Firestore failure');
      } catch (rollbackError) {
        console.error('❌ Rollback failed:', rollbackError);
      }
      
      throw new Error('Failed to save user data to database');
    }

    // Success response
    console.log(`🎉 ${role} user created successfully: ${userRecord.uid}`);
    return res.status(200).json({
      success: true,
      uid: userRecord.uid,
      message: `${role} user created successfully`,
      userId: userData.userId || null
    });

  } catch (error: any) {
    console.error('❌ Error in create-user API:', error);
    
    // Return appropriate error response
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      error: error.message || 'Failed to create user',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

// Export for serverless functions (Vercel, Netlify, etc.)
export { handler };
