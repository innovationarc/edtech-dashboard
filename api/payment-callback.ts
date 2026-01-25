// api/payment-callback.ts
// Complete SSLCOMMERZ callback handler with validation
// This WILL work because it's a Vercel serverless function

import { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';
import admin from 'firebase-admin';

// ==================== FIREBASE INIT ====================

function initializeFirebase() {
  if (admin.apps && admin.apps.length > 0) {
    return admin.apps[0];
  }

  const serviceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  };

  return admin.initializeApp({
    credential: admin.credential.cert({
      projectId: serviceAccount.projectId,
      clientEmail: serviceAccount.clientEmail,
      privateKey: serviceAccount.privateKey,
    }),
  });
}

let firebaseApp: admin.app.App | null = null;
let db: admin.firestore.Firestore | null = null;

try {
  firebaseApp = initializeFirebase();
  db = firebaseApp.firestore();
} catch (error) {
  console.error('Firebase init error:', error);
}

// ==================== CONFIG ====================

const SSLCOMMERZ_CONFIG = {
  storeId: process.env.SSLCOMMERZ_STORE_ID || '',
  storePassword: process.env.SSLCOMMERZ_STORE_PASSWORD || '',
  isLive: process.env.SSLCOMMERZ_IS_LIVE === 'true',
  validationUrl: process.env.SSLCOMMERZ_IS_LIVE === 'true'
    ? 'https://securepay.sslcommerz.com/validator/api/validationserverAPI.php'
    : 'https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php'
};

// ==================== HANDLER ====================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('');
  console.log('='.repeat(80));
  console.log('🔔 SSLCOMMERZ CALLBACK');
  console.log('='.repeat(80));
  console.log('Timestamp:', new Date().toISOString());
  console.log('Method:', req.method);
  console.log('Body:', JSON.stringify(req.body, null, 2));
  console.log('='.repeat(80));

  try {
    // Extract data (SSLCOMMERZ sends as POST form data, which Vercel parses to req.body)
    const status = req.body?.status || req.query.status;
    const tran_id = req.body?.tran_id || req.query.tran_id;
    const val_id = req.body?.val_id || req.query.val_id;
    const card_type = req.body?.card_type;
    const bank_tran_id = req.body?.bank_tran_id;
    const risk_level = req.body?.risk_level || '0';

    console.log('Extracted:', { status, tran_id, val_id, card_type, risk_level });

    if (!tran_id) {
      console.error('❌ Missing transaction ID');
      return res.redirect(302, '/course-enrollment?error=invalid_transaction');
    }

    // Handle cancelled/failed
    if (status === 'CANCELLED' || status === 'FAILED') {
      console.log('⚠️ Payment', status);
      
      if (db) {
        try {
          await updateTransactionStatus(tran_id, status === 'CANCELLED' ? 'cancelled' : 'failed');
        } catch (err) {
          console.warn('Failed to update status:', err);
        }
      }

      return res.redirect(302, `/course-enrollment?status=${status.toLowerCase()}&tran_id=${tran_id}`);
    }

    // Handle success - validate with SSLCOMMERZ
    if (status === 'VALID' || status === 'VALIDATED') {
      console.log('🔍 Validating payment...');

      if (!val_id) {
        console.error('❌ Missing validation ID');
        return res.redirect(302, `/course-enrollment?status=failed&tran_id=${tran_id}`);
      }

      try {
        const validationResponse = await axios.get(SSLCOMMERZ_CONFIG.validationUrl, {
          params: {
            val_id,
            store_id: SSLCOMMERZ_CONFIG.storeId,
            store_passwd: SSLCOMMERZ_CONFIG.storePassword,
            format: 'json'
          },
          timeout: 30000
        });

        const validationData = validationResponse.data;
        console.log('✅ Validation response:', validationData.status);

        if (validationData.status === 'VALID' || validationData.status === 'VALIDATED') {
          
          // Check risk
          if (risk_level === '1') {
            console.warn('⚠️ High risk transaction');
            
            if (db) {
              await updateTransactionStatus(tran_id, 'validating', {
                validationId: val_id,
                paymentMethod: card_type,
                bankTransactionId: bank_tran_id,
                riskLevel: risk_level,
                needsManualReview: true
              });
            }

            return res.redirect(302, `/course-enrollment?status=validating&tran_id=${tran_id}`);
          }

          // Success!
          if (db) {
            await updateTransactionStatus(tran_id, 'success', {
              validationId: val_id,
              paymentMethod: card_type,
              bankTransactionId: bank_tran_id,
              riskLevel: risk_level
            });

            // Create enrollment
            await createEnrollment(tran_id);
          }

          console.log('✅ Payment successful, redirecting...');
          return res.redirect(302, `/course-enrollment?enrolled=true&tran_id=${tran_id}`);
        } else {
          console.error('❌ Validation failed:', validationData.status);
          
          if (db) {
            await updateTransactionStatus(tran_id, 'failed', { validationData });
          }

          return res.redirect(302, `/course-enrollment?status=failed&tran_id=${tran_id}`);
        }
      } catch (validationError: any) {
        console.error('❌ Validation error:', validationError.message);
        return res.redirect(302, `/course-enrollment?status=validation_error&tran_id=${tran_id}`);
      }
    }

    // Unknown status
    console.error('❌ Unknown status:', status);
    return res.redirect(302, `/course-enrollment?status=unknown&tran_id=${tran_id}`);

  } catch (error: any) {
    console.error('');
    console.error('💥 CALLBACK ERROR');
    console.error('='.repeat(80));
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
    console.error('='.repeat(80));

    return res.redirect(302, '/course-enrollment?error=callback_failed');
  }
}

// ==================== HELPERS ====================

async function updateTransactionStatus(transactionId: string, status: string, metadata?: any) {
  if (!db) return;

  try {
    const snapshot = await db.collection('transactions')
      .where('transactionId', '==', transactionId)
      .limit(1)
      .get();

    if (snapshot.empty) {
      console.error('Transaction not found:', transactionId);
      return;
    }

    const docRef = snapshot.docs[0].ref;
    const updateData: any = {
      status,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    if (metadata) {
      if (metadata.validationId) updateData.validationId = metadata.validationId;
      if (metadata.paymentMethod) updateData.paymentMethod = metadata.paymentMethod;
      if (metadata.bankTransactionId) updateData.bankTransactionId = metadata.bankTransactionId;
      if (metadata.riskLevel) updateData.riskLevel = metadata.riskLevel;
      if (metadata.metadata) updateData.metadata = metadata;
    }

    if (status === 'success') {
      updateData.completedAt = admin.firestore.FieldValue.serverTimestamp();
    }

    await docRef.update(updateData);
    console.log('✅ Transaction updated:', transactionId, status);
  } catch (error: any) {
    console.error('Update error:', error.message);
  }
}

async function createEnrollment(transactionId: string) {
  if (!db) return;

  try {
    // Get transaction
    const snapshot = await db.collection('transactions')
      .where('transactionId', '==', transactionId)
      .limit(1)
      .get();

    if (snapshot.empty) {
      console.error('Transaction not found for enrollment');
      return;
    }

    const transaction = snapshot.docs[0].data();

    if (transaction.productType !== 'course') {
      console.log('Not a course, skipping enrollment');
      return;
    }

    // Check if already enrolled
    const existingEnrollment = await db.collection('enrollments')
      .where('courseId', '==', transaction.productId)
      .where('studentId', '==', transaction.userId)
      .limit(1)
      .get();

    if (!existingEnrollment.empty) {
      console.log('Already enrolled');
      return;
    }

    // Create enrollment
    const enrollmentData = {
      courseId: transaction.productId,
      studentId: transaction.userId,
      studentName: transaction.userName,
      studentEmail: transaction.userEmail,
      progress: 0,
      completedLessons: [],
      enrolledAt: admin.firestore.FieldValue.serverTimestamp(),
      lastAccessedAt: admin.firestore.FieldValue.serverTimestamp(),
      paymentStatus: 'completed',
      transactionId: transaction.transactionId,
      amountPaid: transaction.amount,
      paymentMethod: transaction.paymentMethod || 'SSLCOMMERZ',
      paymentDate: admin.firestore.FieldValue.serverTimestamp(),
      appliedDiscounts: transaction.appliedDiscounts || {}
    };

    await db.collection('enrollments').add(enrollmentData);
    console.log('✅ Enrollment created');

    // Update course count
    try {
      const courseRef = db.collection('courses').doc(transaction.productId);
      await courseRef.update({
        studentCount: admin.firestore.FieldValue.increment(1)
      });
    } catch (err) {
      console.warn('Course count update failed');
    }

    // Add to library
    try {
      const courseDoc = await db.collection('courses').doc(transaction.productId).get();
      if (courseDoc.exists) {
        const course = courseDoc.data();
        
        await db.collection('studentContent').add({
          title: course?.title,
          description: course?.description,
          type: 'course',
          course: course?.title,
          category: course?.category,
          class: course?.class,
          subjects: course?.subjects || [],
          difficulty: course?.level || 'beginner',
          tags: [...(course?.tags || []), 'purchased-course', 'enrolled'],
          courseId: transaction.productId,
          isFromCourse: true,
          accessLevel: 'full',
          enrolledStudentId: transaction.userId,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
    } catch (err) {
      console.warn('Library addition failed');
    }

  } catch (error: any) {
    console.error('Enrollment error:', error.message);
  }
}
