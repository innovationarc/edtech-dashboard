// api/payment.ts
// Vercel Serverless Function for SSLCOMMERZ Payment Integration
// Production-Ready with Comprehensive Error Handling

import { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';

// Initialize Firebase Admin
import * as admin from 'firebase-admin';

// Initialize Firebase Admin (only once)
if (!admin.apps.length) {
  try {
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    
    if (!privateKey || !process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL) {
      console.error('Missing Firebase credentials');
    }

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: privateKey,
      }),
    });
    console.log('Firebase Admin initialized successfully');
  } catch (error) {
    console.error('Error initializing Firebase Admin:', error);
  }
}

const db = admin.firestore();

// ==================== CONFIGURATION ====================

const SSLCOMMERZ_CONFIG = {
  storeId: process.env.SSLCOMMERZ_STORE_ID || '',
  storePassword: process.env.SSLCOMMERZ_STORE_PASSWORD || '',
  isLive: process.env.SSLCOMMERZ_IS_LIVE === 'true',
  sessionUrl: process.env.SSLCOMMERZ_IS_LIVE === 'true'
    ? 'https://securepay.sslcommerz.com/gwprocess/v4/api.php'
    : 'https://sandbox.sslcommerz.com/gwprocess/v4/api.php',
  validationUrl: process.env.SSLCOMMERZ_IS_LIVE === 'true'
    ? 'https://securepay.sslcommerz.com/validator/api/validationserverAPI.php'
    : 'https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php'
};

const FRONTEND_URL = process.env.FRONTEND_URL || process.env.VERCEL_URL 
  ? `https://${process.env.VERCEL_URL}` 
  : 'http://localhost:3000';

const BACKEND_URL = process.env.BACKEND_URL || process.env.VERCEL_URL 
  ? `https://${process.env.VERCEL_URL}` 
  : 'http://localhost:3000';

// In-memory cache for processed IPNs
const processedIPNs = new Set<string>();

// ==================== HELPER FUNCTIONS ====================

async function getTransaction(transactionId: string) {
  try {
    const snapshot = await db.collection('transactions')
      .where('transactionId', '==', transactionId)
      .limit(1)
      .get();

    if (snapshot.empty) {
      console.log('Transaction not found:', transactionId);
      return null;
    }

    const doc = snapshot.docs[0];
    return { id: doc.id, ref: doc.ref, ...doc.data() };
  } catch (error) {
    console.error('Error getting transaction:', error);
    return null;
  }
}

async function updateTransaction(transactionId: string, updates: any) {
  try {
    const transaction = await getTransaction(transactionId);
    if (!transaction) {
      console.error('Transaction not found for update:', transactionId);
      return false;
    }

    await transaction.ref.update({
      ...updates,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log('Transaction updated:', transactionId, updates.status || 'updated');
    return true;
  } catch (error) {
    console.error('Error updating transaction:', error);
    return false;
  }
}

async function createEnrollment(transaction: any) {
  try {
    if (transaction.productType !== 'course') {
      console.log('Not a course enrollment, skipping');
      return null;
    }

    console.log('Creating enrollment for transaction:', transaction.transactionId);

    // Check if enrollment already exists
    const existingEnrollment = await db.collection('enrollments')
      .where('courseId', '==', transaction.productId)
      .where('studentId', '==', transaction.userId)
      .limit(1)
      .get();

    if (!existingEnrollment.empty) {
      console.log('Enrollment already exists');
      return existingEnrollment.docs[0].id;
    }

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

    const enrollmentRef = await db.collection('enrollments').add(enrollmentData);
    console.log('Enrollment created:', enrollmentRef.id);

    // Update course student count
    try {
      const courseRef = db.collection('courses').doc(transaction.productId);
      const courseDoc = await courseRef.get();
      
      if (courseDoc.exists) {
        await courseRef.update({
          studentCount: admin.firestore.FieldValue.increment(1)
        });
        console.log('Course student count updated');
      }
    } catch (error) {
      console.error('Error updating course count:', error);
    }

    // Add to content library
    try {
      await addCourseToLibrary(transaction.productId, transaction.userId);
    } catch (error) {
      console.error('Error adding to library:', error);
    }

    return enrollmentRef.id;
  } catch (error) {
    console.error('Error creating enrollment:', error);
    throw error;
  }
}

async function addCourseToLibrary(courseId: string, studentId: string) {
  try {
    const courseDoc = await db.collection('courses').doc(courseId).get();
    if (!courseDoc.exists) {
      console.error('Course not found:', courseId);
      return;
    }

    const course = courseDoc.data();

    // Check if already added
    const existingContent = await db.collection('studentContent')
      .where('courseId', '==', courseId)
      .where('enrolledStudentId', '==', studentId)
      .where('type', '==', 'course')
      .limit(1)
      .get();

    if (!existingContent.empty) {
      console.log('Course already in library');
      return;
    }

    const mainCourseEntry = {
      title: course?.title,
      description: course?.description,
      type: 'course',
      course: course?.title,
      category: course?.category,
      class: course?.class,
      subjects: course?.subjects || [],
      difficulty: course?.level || 'beginner',
      tags: [...(course?.tags || []), 'purchased-course', 'enrolled', 'full-course'],
      courseId: courseId,
      isFromCourse: true,
      accessLevel: 'full',
      duration: course?.duration,
      instructor: course?.instructor,
      thumbnail: course?.thumbnail,
      rating: course?.rating || 0,
      studentCount: course?.studentCount || 0,
      hasAiQnA: course?.hasAiQnA || false,
      hasHumanQnA: course?.hasHumanQnA || false,
      hasStudyPlanner: course?.hasStudyPlanner || false,
      createdBy: course?.instructorId,
      enrolledStudentId: studentId,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await db.collection('studentContent').add(mainCourseEntry);
    console.log('Course added to library');
  } catch (error) {
    console.error('Error adding to library:', error);
  }
}

function validatePaymentRequest(data: any): { valid: boolean; error?: string } {
  const required = [
    'transactionId', 
    'userId', 
    'userName', 
    'userEmail', 
    'amount', 
    'productId', 
    'productName',
    'productType'
  ];
  
  const missing = required.filter(field => !data[field]);
  
  if (missing.length > 0) {
    return { valid: false, error: `Missing fields: ${missing.join(', ')}` };
  }

  if (typeof data.amount !== 'number' || data.amount < 0) {
    return { valid: false, error: 'Invalid amount' };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(data.userEmail)) {
    return { valid: false, error: 'Invalid email' };
  }

  return { valid: true };
}

function validateSSLConfig(): { valid: boolean; error?: string } {
  if (!SSLCOMMERZ_CONFIG.storeId || !SSLCOMMERZ_CONFIG.storePassword) {
    return { 
      valid: false, 
      error: 'SSLCOMMERZ credentials not configured' 
    };
  }
  return { valid: true };
}

// ==================== MAIN HANDLER ====================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { action } = req.query;

  console.log('=== Payment API Request ===');
  console.log('Action:', action);
  console.log('Method:', req.method);
  console.log('Body:', JSON.stringify(req.body, null, 2));

  try {
    // ==================== INITIATE PAYMENT ====================
    if (action === 'initiate' && req.method === 'POST') {
      console.log('Processing payment initiation...');

      // Validate SSL config
      const configValidation = validateSSLConfig();
      if (!configValidation.valid) {
        console.error('SSL Config validation failed:', configValidation.error);
        return res.status(500).json({
          success: false,
          error: configValidation.error
        });
      }

      // Validate request
      const validation = validatePaymentRequest(req.body);
      if (!validation.valid) {
        console.error('Request validation failed:', validation.error);
        return res.status(400).json({
          success: false,
          error: validation.error
        });
      }

      const {
        transactionId,
        userId,
        userName,
        userEmail,
        amount,
        productId,
        productName,
        productType,
        appliedDiscounts,
        metadata
      } = req.body;

      console.log('Preparing SSLCOMMERZ payment data...');

      const paymentData = {
        store_id: SSLCOMMERZ_CONFIG.storeId,
        store_passwd: SSLCOMMERZ_CONFIG.storePassword,
        total_amount: parseFloat(amount.toFixed(2)),
        currency: 'BDT',
        tran_id: transactionId,
        success_url: `${FRONTEND_URL}/course-enrollment?status=success&tran_id=${transactionId}`,
        fail_url: `${FRONTEND_URL}/course-enrollment?status=failed&tran_id=${transactionId}`,
        cancel_url: `${FRONTEND_URL}/course-enrollment?status=cancel&tran_id=${transactionId}`,
        ipn_url: `${BACKEND_URL}/api/payment?action=ipn`,
        cus_name: userName,
        cus_email: userEmail,
        cus_add1: 'N/A',
        cus_city: 'Dhaka',
        cus_state: 'Dhaka',
        cus_postcode: '1000',
        cus_country: 'Bangladesh',
        cus_phone: '01700000000',
        product_name: productName,
        product_category: productType === 'course' ? 'Education' : 'Digital Content',
        product_profile: 'general',
        shipping_method: 'NO',
        num_of_item: 1,
        emi_option: 0
      };

      console.log('Calling SSLCOMMERZ API:', SSLCOMMERZ_CONFIG.sessionUrl);

      try {
        const response = await axios.post(
          SSLCOMMERZ_CONFIG.sessionUrl,
          new URLSearchParams(paymentData as any).toString(),
          {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            timeout: 30000
          }
        );

        console.log('SSLCOMMERZ Response Status:', response.data.status);

        if (response.data.status === 'SUCCESS') {
          console.log('Payment initiation successful');
          return res.status(200).json({
            success: true,
            gatewayUrl: response.data.GatewayPageURL,
            gatewayTransactionId: response.data.sessionkey,
            transactionId
          });
        } else {
          console.error('SSLCOMMERZ Error:', response.data);
          await updateTransaction(transactionId, {
            status: 'failed',
            metadata: { error: response.data.failedreason }
          });
          return res.status(400).json({
            success: false,
            error: response.data.failedreason || 'Payment initiation failed'
          });
        }
      } catch (axiosError: any) {
        console.error('SSLCOMMERZ API Error:', axiosError.message);
        return res.status(500).json({
          success: false,
          error: 'Failed to connect to payment gateway. Please try again.'
        });
      }
    }

    // ==================== IPN HANDLER ====================
    if (action === 'ipn' && req.method === 'POST') {
      console.log('Processing IPN...');

      const { tran_id, val_id, card_type, bank_tran_id, status, risk_level, risk_title } = req.body;

      if (!tran_id || !val_id) {
        console.error('Missing IPN fields');
        return res.status(400).send('Missing required fields');
      }

      if (processedIPNs.has(tran_id)) {
        console.log('IPN already processed:', tran_id);
        return res.status(200).send('OK');
      }

      const transaction = await getTransaction(tran_id);
      if (!transaction) {
        console.error('Transaction not found:', tran_id);
        return res.status(404).send('Transaction not found');
      }

      if (transaction.status === 'success') {
        console.log('Transaction already completed');
        processedIPNs.add(tran_id);
        return res.status(200).send('OK');
      }

      console.log('Validating with SSLCOMMERZ...');

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
        console.log('Validation Status:', validationData.status);

        if (validationData.status === 'VALID' || validationData.status === 'VALIDATED') {
          if (risk_level === '1') {
            console.warn('High risk transaction:', tran_id);
            await updateTransaction(tran_id, {
              status: 'validating',
              validationId: val_id,
              paymentMethod: card_type,
              bankTransactionId: bank_tran_id,
              riskLevel: risk_level,
              metadata: { riskTitle: risk_title, needsManualReview: true }
            });
          } else {
            await updateTransaction(tran_id, {
              status: 'success',
              validationId: val_id,
              paymentMethod: card_type,
              bankTransactionId: bank_tran_id,
              riskLevel: risk_level || '0',
              completedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            await createEnrollment({
              ...transaction,
              paymentMethod: card_type,
              validationId: val_id,
              bankTransactionId: bank_tran_id
            });
          }
          processedIPNs.add(tran_id);
          return res.status(200).send('OK');
        } else {
          await updateTransaction(tran_id, {
            status: validationData.status === 'CANCELLED' ? 'cancelled' : 'failed',
            metadata: { validationData }
          });
          processedIPNs.add(tran_id);
          return res.status(200).send('OK');
        }
      } catch (axiosError: any) {
        console.error('Validation API Error:', axiosError.message);
        return res.status(500).send('Validation error');
      }
    }

    // ==================== VALIDATE PAYMENT ====================
    if (action === 'validate' && req.method === 'POST') {
      console.log('Validating payment...');

      const { transactionId } = req.body;

      if (!transactionId) {
        return res.status(400).json({
          success: false,
          error: 'Transaction ID required'
        });
      }

      const transaction = await getTransaction(transactionId);

      if (!transaction) {
        return res.status(404).json({
          success: false,
          error: 'Transaction not found'
        });
      }

      return res.status(200).json({
        success: true,
        status: transaction.status,
        validated: transaction.status === 'success',
        transaction
      });
    }

    // ==================== STATUS CHECK ====================
    if (action === 'status' && req.method === 'GET') {
      const { transactionId } = req.query;

      if (!transactionId || typeof transactionId !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Transaction ID required'
        });
      }

      const transaction = await getTransaction(transactionId);

      if (!transaction) {
        return res.status(404).json({
          success: false,
          error: 'Transaction not found'
        });
      }

      return res.status(200).json({
        success: true,
        transaction
      });
    }

    console.error('Route not found:', action);
    return res.status(404).json({ 
      success: false,
      error: 'Route not found' 
    });

  } catch (error: any) {
    console.error('Payment API Error:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Internal server error'
    });
  }
}
