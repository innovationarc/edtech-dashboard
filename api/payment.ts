// api/payment.ts
// Vercel Serverless Function - FULLY FIXED with CORS and Detailed Errors

import { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';

// ==================== CORS CONFIGURATION ====================
function setCorsHeaders(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');
}

// ==================== FIREBASE ADMIN INIT ====================
import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  try {
    const serviceAccount = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    };

    console.log('Initializing Firebase Admin...');
    console.log('Project ID:', serviceAccount.projectId);
    console.log('Client Email:', serviceAccount.clientEmail);
    console.log('Private Key exists:', !!serviceAccount.privateKey);

    if (!serviceAccount.projectId || !serviceAccount.clientEmail || !serviceAccount.privateKey) {
      throw new Error('Missing Firebase credentials in environment variables');
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
    });
    
    console.log('✅ Firebase Admin initialized successfully');
  } catch (error: any) {
    console.error('❌ Firebase Admin initialization error:', error.message);
    console.error('Stack:', error.stack);
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

// Get proper URLs
const getBaseUrl = (req: VercelRequest): string => {
  const host = req.headers.host || 'localhost:3000';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  return `${protocol}://${host}`;
};

const processedIPNs = new Set<string>();

// ==================== HELPER FUNCTIONS ====================

async function getTransaction(transactionId: string) {
  try {
    const snapshot = await db.collection('transactions')
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
    return false;
  }
}

async function createEnrollment(transaction: any) {
  try {
    if (transaction.productType !== 'course') {
      console.log('ℹ️ Not a course, skipping enrollment');
      return null;
    }

    console.log('📝 Creating enrollment...');

    const existingEnrollment = await db.collection('enrollments')
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

    const enrollmentRef = await db.collection('enrollments').add(enrollmentData);
    console.log('✅ Enrollment created:', enrollmentRef.id);

    // Update course count
    try {
      const courseRef = db.collection('courses').doc(transaction.productId);
      await courseRef.update({
        studentCount: admin.firestore.FieldValue.increment(1)
      });
      console.log('✅ Course student count updated');
    } catch (error: any) {
      console.warn('⚠️ Course count update failed:', error.message);
    }

    // Add to library
    try {
      await addCourseToLibrary(transaction.productId, transaction.userId);
    } catch (error: any) {
      console.warn('⚠️ Library addition failed:', error.message);
    }

    return enrollmentRef.id;
  } catch (error: any) {
    console.error('❌ Enrollment creation error:', error.message);
    throw error;
  }
}

async function addCourseToLibrary(courseId: string, studentId: string) {
  try {
    const courseDoc = await db.collection('courses').doc(courseId).get();
    if (!courseDoc.exists) {
      console.error('❌ Course not found:', courseId);
      return;
    }

    const course = courseDoc.data();

    const existingContent = await db.collection('studentContent')
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

    await db.collection('studentContent').add(mainCourseEntry);
    console.log('✅ Course added to library');
  } catch (error: any) {
    console.error('❌ Library addition error:', error.message);
  }
}

// ==================== MAIN HANDLER ====================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers for all requests
  setCorsHeaders(res);

  // Handle OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { action } = req.query;
  const baseUrl = getBaseUrl(req);

  console.log('');
  console.log('='.repeat(80));
  console.log('📨 PAYMENT API REQUEST');
  console.log('='.repeat(80));
  console.log('Action:', action);
  console.log('Method:', req.method);
  console.log('Base URL:', baseUrl);
  console.log('Body:', JSON.stringify(req.body, null, 2));
  console.log('='.repeat(80));

  try {
    // ==================== INITIATE PAYMENT ====================
    if (action === 'initiate' && req.method === 'POST') {
      console.log('🚀 Starting payment initiation...');

      // Check SSLCOMMERZ credentials
      if (!SSLCOMMERZ_CONFIG.storeId || !SSLCOMMERZ_CONFIG.storePassword) {
        console.error('❌ SSLCOMMERZ credentials missing');
        console.log('Store ID:', SSLCOMMERZ_CONFIG.storeId ? 'Present' : 'MISSING');
        console.log('Store Password:', SSLCOMMERZ_CONFIG.storePassword ? 'Present' : 'MISSING');
        
        return res.status(500).json({
          success: false,
          error: 'Payment gateway not configured',
          details: 'SSLCOMMERZ credentials are missing. Please contact support.',
          debug: {
            storeIdPresent: !!SSLCOMMERZ_CONFIG.storeId,
            storePasswordPresent: !!SSLCOMMERZ_CONFIG.storePassword
          }
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

      // Validate required fields
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
          missingFields
        });
      }

      console.log('✅ All required fields present');

      const paymentData = {
        store_id: SSLCOMMERZ_CONFIG.storeId,
        store_passwd: SSLCOMMERZ_CONFIG.storePassword,
        total_amount: parseFloat(amount.toFixed(2)),
        currency: 'BDT',
        tran_id: transactionId,
        success_url: `${baseUrl}/course-enrollment?status=success&tran_id=${transactionId}`,
        fail_url: `${baseUrl}/course-enrollment?status=failed&tran_id=${transactionId}`,
        cancel_url: `${baseUrl}/course-enrollment?status=cancel&tran_id=${transactionId}`,
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
      console.log('URL:', SSLCOMMERZ_CONFIG.sessionUrl);
      console.log('Payment Data:', JSON.stringify(paymentData, null, 2));

      try {
        const response = await axios.post(
          SSLCOMMERZ_CONFIG.sessionUrl,
          new URLSearchParams(paymentData as any).toString(),
          {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            timeout: 30000
          }
        );

        console.log('📥 SSLCOMMERZ Response:', JSON.stringify(response.data, null, 2));

        if (response.data.status === 'SUCCESS') {
          console.log('✅ Payment initiation successful');
          return res.status(200).json({
            success: true,
            gatewayUrl: response.data.GatewayPageURL,
            gatewayTransactionId: response.data.sessionkey,
            transactionId
          });
        } else {
          console.error('❌ SSLCOMMERZ returned error:', response.data);
          await updateTransaction(transactionId, {
            status: 'failed',
            metadata: { error: response.data.failedreason || 'Unknown error' }
          });
          
          return res.status(400).json({
            success: false,
            error: 'Payment gateway error',
            details: response.data.failedreason || 'Payment initiation failed',
            sslcommerzResponse: response.data
          });
        }
      } catch (axiosError: any) {
        console.error('❌ SSLCOMMERZ API call failed');
        console.error('Error:', axiosError.message);
        console.error('Code:', axiosError.code);
        console.error('Response:', axiosError.response?.data);
        
        return res.status(500).json({
          success: false,
          error: 'Failed to connect to payment gateway',
          details: axiosError.message,
          debug: {
            code: axiosError.code,
            responseData: axiosError.response?.data,
            sessionUrl: SSLCOMMERZ_CONFIG.sessionUrl
          }
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
        console.log('ℹ️ IPN already processed');
        return res.status(200).send('OK');
      }

      const transaction = await getTransaction(tran_id);
      if (!transaction) {
        console.error('❌ Transaction not found');
        return res.status(404).send('Transaction not found');
      }

      if (transaction.status === 'success') {
        console.log('ℹ️ Transaction already completed');
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
            console.warn('⚠️ High risk transaction');
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

    // ==================== UNKNOWN ACTION ====================
    console.error('❌ Unknown action:', action);
    return res.status(404).json({ 
      success: false,
      error: 'Route not found',
      details: `Unknown action: ${action}`,
      availableActions: ['initiate', 'ipn', 'validate']
    });

  } catch (error: any) {
    console.error('');
    console.error('💥 FATAL ERROR');
    console.error('='.repeat(80));
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
    console.error('='.repeat(80));
    
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
