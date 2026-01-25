// api/payment.ts
// Vercel Serverless Function - FIXED with correct success URL handling

import { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';
import admin from 'firebase-admin';

// ==================== CORS CONFIGURATION ====================
function setCorsHeaders(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');
}

// ==================== FIREBASE ADMIN INIT ====================

function initializeFirebase() {
  try {
    if (admin.apps && admin.apps.length > 0) {
      console.log('✅ Firebase Admin already initialized');
      return admin.apps[0];
    }

    const serviceAccount = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    };

    console.log('🔧 Initializing Firebase Admin...');
    console.log('Project ID:', serviceAccount.projectId);
    console.log('Client Email:', serviceAccount.clientEmail);
    console.log('Private Key exists:', !!serviceAccount.privateKey);

    if (!serviceAccount.projectId || !serviceAccount.clientEmail || !serviceAccount.privateKey) {
      throw new Error('Missing Firebase credentials in environment variables');
    }

    const app = admin.initializeApp({
      credential: admin.credential.cert({
        projectId: serviceAccount.projectId,
        clientEmail: serviceAccount.clientEmail,
        privateKey: serviceAccount.privateKey,
      }),
    });
    
    console.log('✅ Firebase Admin initialized successfully');
    return app;
  } catch (error: any) {
    console.error('❌ Firebase Admin initialization error:', error.message);
    console.error('Stack:', error.stack);
    throw error;
  }
}

let firebaseApp: admin.app.App | null = null;
let db: admin.firestore.Firestore | null = null;

try {
  firebaseApp = initializeFirebase();
  db = firebaseApp.firestore();
  console.log('✅ Firestore initialized');
} catch (error: any) {
  console.error('❌ Failed to initialize Firebase on module load:', error.message);
}

function getFirestore(): admin.firestore.Firestore {
  if (db) {
    return db;
  }
  
  if (!firebaseApp) {
    firebaseApp = initializeFirebase();
  }
  
  db = firebaseApp.firestore();
  return db;
}

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

const getBaseUrl = (req: VercelRequest): string => {
  const host = req.headers.host || 'localhost:3000';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  return `${protocol}://${host}`;
};

const processedIPNs = new Set<string>();

// ==================== HELPER FUNCTIONS ====================

async function getTransaction(transactionId: string) {
  try {
    const firestore = getFirestore();
    const snapshot = await firestore.collection('transactions')
      .where('transactionId', '==', transactionId)
      .limit(1)
      .get();

    if (snapshot.empty) {
      console.log('❌ Transaction not found:', transactionId);
      return null;
    }

    const doc = snapshot.docs[0];
    console.log('✅ Transaction found:', transactionId);
    return { id: doc.id, ref: doc.ref, ...doc.data() };
  } catch (error: any) {
    console.error('❌ Error getting transaction:', error.message);
    console.error('Stack:', error.stack);
    return null;
  }
}

async function updateTransaction(transactionId: string, updates: any) {
  try {
    const transaction = await getTransaction(transactionId);
    if (!transaction) {
      console.error('❌ Transaction not found for update:', transactionId);
      return false;
    }

    await transaction.ref.update({
      ...updates,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log('✅ Transaction updated:', transactionId, updates.status || 'updated');
    return true;
  } catch (error: any) {
    console.error('❌ Error updating transaction:', error.message);
    console.error('Stack:', error.stack);
    return false;
  }
}

async function createEnrollment(transaction: any) {
  try {
    if (transaction.productType !== 'course') {
      console.log('ℹ️ Not a course, skipping enrollment');
      return null;
    }

    console.log('📝 Creating enrollment for:', transaction.transactionId);

    const firestore = getFirestore();
    const existingEnrollment = await firestore.collection('enrollments')
      .where('courseId', '==', transaction.productId)
      .where('studentId', '==', transaction.userId)
      .limit(1)
      .get();

    if (!existingEnrollment.empty) {
      console.log('ℹ️ Enrollment already exists');
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

    const enrollmentRef = await firestore.collection('enrollments').add(enrollmentData);
    console.log('✅ Enrollment created:', enrollmentRef.id);

    try {
      const courseRef = firestore.collection('courses').doc(transaction.productId);
      await courseRef.update({
        studentCount: admin.firestore.FieldValue.increment(1)
      });
      console.log('✅ Course student count updated');
    } catch (error: any) {
      console.warn('⚠️ Course count update failed:', error.message);
    }

    try {
      await addCourseToLibrary(transaction.productId, transaction.userId);
    } catch (error: any) {
      console.warn('⚠️ Library addition failed:', error.message);
    }

    return enrollmentRef.id;
  } catch (error: any) {
    console.error('❌ Enrollment creation error:', error.message);
    console.error('Stack:', error.stack);
    throw error;
  }
}

async function addCourseToLibrary(courseId: string, studentId: string) {
  try {
    const firestore = getFirestore();
    const courseDoc = await firestore.collection('courses').doc(courseId).get();
    if (!courseDoc.exists) {
      console.error('❌ Course not found:', courseId);
      return;
    }

    const course = courseDoc.data();

    const existingContent = await firestore.collection('studentContent')
      .where('courseId', '==', courseId)
      .where('enrolledStudentId', '==', studentId)
      .where('type', '==', 'course')
      .limit(1)
      .get();

    if (!existingContent.empty) {
      console.log('ℹ️ Course already in library');
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

    await firestore.collection('studentContent').add(mainCourseEntry);
    console.log('✅ Course added to library');
  } catch (error: any) {
    console.error('❌ Library addition error:', error.message);
    console.error('Stack:', error.stack);
  }
}

// ==================== MAIN HANDLER ====================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { action } = req.query;
  const baseUrl = getBaseUrl(req);

  console.log('');
  console.log('='.repeat(80));
  console.log('📨 PAYMENT API REQUEST');
  console.log('='.repeat(80));
  console.log('Timestamp:', new Date().toISOString());
  console.log('Action:', action);
  console.log('Method:', req.method);
  console.log('Base URL:', baseUrl);
  console.log('Query:', JSON.stringify(req.query, null, 2));
  console.log('Body:', JSON.stringify(req.body, null, 2));
  console.log('='.repeat(80));

  try {
    try {
      getFirestore();
    } catch (initError: any) {
      console.error('❌ Firebase initialization failed:', initError.message);
      return res.status(500).json({
        success: false,
        error: 'Database connection failed',
        details: initError.message,
        userMessage: 'Server configuration error. Please contact support.',
        timestamp: new Date().toISOString()
      });
    }

    // ==================== INITIATE PAYMENT ====================
    if (action === 'initiate' && req.method === 'POST') {
      console.log('🚀 Starting payment initiation...');

      if (!SSLCOMMERZ_CONFIG.storeId || !SSLCOMMERZ_CONFIG.storePassword) {
        const errorMsg = 'SSLCOMMERZ credentials missing';
        console.error('❌', errorMsg);
        
        return res.status(500).json({
          success: false,
          error: 'Payment gateway not configured',
          details: 'SSLCOMMERZ credentials are missing. Please contact support.',
          userMessage: 'Payment system is currently unavailable. Please contact support.',
          timestamp: new Date().toISOString()
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
        productType
      } = req.body;

      const missingFields = [];
      if (!transactionId) missingFields.push('transactionId');
      if (!userId) missingFields.push('userId');
      if (!userName) missingFields.push('userName');
      if (!userEmail) missingFields.push('userEmail');
      if (amount === undefined) missingFields.push('amount');
      if (!productId) missingFields.push('productId');
      if (!productName) missingFields.push('productName');
      if (!productType) missingFields.push('productType');

      if (missingFields.length > 0) {
        console.error('❌ Missing fields:', missingFields);
        return res.status(400).json({
          success: false,
          error: 'Missing required fields',
          details: `Required fields missing: ${missingFields.join(', ')}`,
          userMessage: 'Payment request is incomplete. Please try again.',
          missingFields,
          timestamp: new Date().toISOString()
        });
      }

      console.log('✅ All required fields present');

      // FIXED: Use dedicated payment success page
      const paymentData = {
        store_id: SSLCOMMERZ_CONFIG.storeId,
        store_passwd: SSLCOMMERZ_CONFIG.storePassword,
        total_amount: parseFloat(amount.toFixed(2)),
        currency: 'BDT',
        tran_id: transactionId,
        success_url: `${baseUrl}/payment-success?status=success&tran_id=${transactionId}`,
        fail_url: `${baseUrl}/payment-success?status=failed&tran_id=${transactionId}`,
        cancel_url: `${baseUrl}/payment-success?status=cancel&tran_id=${transactionId}`,
        ipn_url: `${baseUrl}/api/payment?action=ipn`,
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

      console.log('📤 Calling SSLCOMMERZ API...');
      console.log('Success URL:', paymentData.success_url);
      console.log('Fail URL:', paymentData.fail_url);
      console.log('Cancel URL:', paymentData.cancel_url);

      try {
        const response = await axios.post(
          SSLCOMMERZ_CONFIG.sessionUrl,
          new URLSearchParams(paymentData as any).toString(),
          {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            timeout: 30000
          }
        );

        console.log('📥 SSLCOMMERZ Response Status:', response.data.status);

        if (response.data.status === 'SUCCESS') {
          console.log('✅ Payment initiation successful');
          console.log('Gateway URL:', response.data.GatewayPageURL);
          
          return res.status(200).json({
            success: true,
            gatewayUrl: response.data.GatewayPageURL,
            gatewayTransactionId: response.data.sessionkey,
            transactionId,
            timestamp: new Date().toISOString()
          });
        } else {
          const errorReason = response.data.failedreason || 'Unknown error';
          console.error('❌ SSLCOMMERZ returned error:', errorReason);
          
          await updateTransaction(transactionId, {
            status: 'failed',
            metadata: { 
              error: errorReason,
              sslcommerzResponse: response.data,
              timestamp: new Date().toISOString()
            }
          });
          
          return res.status(400).json({
            success: false,
            error: 'Payment gateway error',
            details: errorReason,
            userMessage: `Payment could not be initiated: ${errorReason}`,
            sslcommerzResponse: response.data,
            timestamp: new Date().toISOString()
          });
        }
      } catch (axiosError: any) {
        console.error('❌ SSLCOMMERZ API call failed');
        console.error('Error Message:', axiosError.message);
        
        return res.status(500).json({
          success: false,
          error: 'Failed to connect to payment gateway',
          details: axiosError.message,
          userMessage: 'Unable to connect to payment gateway. Please try again later.',
          timestamp: new Date().toISOString()
        });
      }
    }

    // ==================== IPN HANDLER ====================
    if (action === 'ipn' && req.method === 'POST') {
      console.log('📬 Processing IPN...');

      const { tran_id, val_id, card_type, bank_tran_id, status, risk_level, risk_title } = req.body;

      if (!tran_id || !val_id) {
        console.error('❌ Missing IPN fields');
        return res.status(400).send('Missing required fields');
      }

      if (processedIPNs.has(tran_id)) {
        console.log('ℹ️ IPN already processed:', tran_id);
        return res.status(200).send('OK');
      }

      const transaction = await getTransaction(tran_id);
      if (!transaction) {
        console.error('❌ Transaction not found:', tran_id);
        return res.status(404).send('Transaction not found');
      }

      if (transaction.status === 'success') {
        console.log('ℹ️ Transaction already completed:', tran_id);
        processedIPNs.add(tran_id);
        return res.status(200).send('OK');
      }

      console.log('🔍 Validating with SSLCOMMERZ...');

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
          if (risk_level === '1') {
            console.warn('⚠️ High risk transaction:', tran_id);
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
            metadata: { validationData, timestamp: new Date().toISOString() }
          });
          processedIPNs.add(tran_id);
          return res.status(200).send('OK');
        }
      } catch (axiosError: any) {
        console.error('❌ Validation error:', axiosError.message);
        return res.status(500).send('Validation error');
      }
    }

    // ==================== VALIDATE PAYMENT ====================
    if (action === 'validate' && req.method === 'POST') {
      console.log('🔍 Validating payment...');

      const { transactionId } = req.body;

      if (!transactionId) {
        return res.status(400).json({
          success: false,
          error: 'Transaction ID required',
          userMessage: 'Transaction ID is missing',
          timestamp: new Date().toISOString()
        });
      }

      const transaction = await getTransaction(transactionId);

      if (!transaction) {
        return res.status(404).json({
          success: false,
          error: 'Transaction not found',
          userMessage: 'Payment record not found',
          timestamp: new Date().toISOString()
        });
      }

      console.log('Transaction status:', transaction.status);

      return res.status(200).json({
        success: true,
        status: transaction.status,
        validated: transaction.status === 'success',
        transaction,
        timestamp: new Date().toISOString()
      });
    }

    console.error('❌ Unknown action:', action);
    return res.status(404).json({ 
      success: false,
      error: 'Route not found',
      details: `Unknown action: ${action}`,
      userMessage: 'Invalid payment operation requested',
      availableActions: ['initiate', 'ipn', 'validate'],
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('');
    console.error('💥 FATAL ERROR');
    console.error('='.repeat(80));
    console.error('Timestamp:', new Date().toISOString());
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
    console.error('='.repeat(80));
    
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error',
      details: error.message,
      userMessage: 'An unexpected error occurred. Please contact support.',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      timestamp: new Date().toISOString()
    });
  }
}
