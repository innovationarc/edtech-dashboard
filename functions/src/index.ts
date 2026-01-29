// functions/src/index.ts
// Deploy this as a Firebase Cloud Function

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin
admin.initializeApp();

export const deleteUser = functions.https.onCall(async (data, context) => {
  // Verify the caller is authenticated and is an admin
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be authenticated'
    );
  }

  const callerUid = context.auth.uid;
  
  // Get caller's role from Firestore
  const callerDoc = await admin.firestore().collection('users').doc(callerUid).get();
  const callerRole = callerDoc.data()?.role;

  if (!['admin', 'manager', 'coordinator'].includes(callerRole)) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Only admins, managers, and coordinators can delete users'
    );
  }

  const { uid } = data;

  if (!uid) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'User UID is required'
    );
  }

  // Prevent self-deletion
  if (uid === callerUid) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Cannot delete your own account'
    );
  }

  try {
    console.log('🗑️ Starting deletion for UID:', uid);

    // Delete from Firestore
    await admin.firestore().collection('users').doc(uid).delete();
    console.log('✅ Deleted from Firestore');

    // Delete from Authentication
    await admin.auth().deleteUser(uid);
    console.log('✅ Deleted from Authentication');

    return {
      success: true,
      message: 'User deleted successfully',
      uid
    };
  } catch (error: any) {
    console.error('❌ Deletion error:', error);
    
    if (error.code === 'auth/user-not-found') {
      // User already deleted from auth, just delete from Firestore
      try {
        await admin.firestore().collection('users').doc(uid).delete();
        return {
          success: true,
          message: 'User deleted from Firestore (already deleted from Auth)',
          uid
        };
      } catch (firestoreError) {
        throw new functions.https.HttpsError(
          'internal',
          'Failed to delete user from Firestore'
        );
      }
    }

    throw new functions.https.HttpsError(
      'internal',
      `Failed to delete user: ${error.message}`
    );
  }
});
