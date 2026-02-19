// api/payment.ts
// Vercel Serverless Function
// MERGED: Handles all payment operations including the callback (previously payment-callback.ts)
// FIX: userEmail is optional — a placeholder is accepted when the user has no email

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
  const baseUrl = `${protocol}://${host}`;
  
  console.log('🌐 Base URL determined:', baseUrl);
  console.log('  - Host:', host);
  console.log('  - Protocol:', protocol);
  
  return baseUrl;
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

    const docSnap = snapshot.docs[0];
    console.log('✅ Transaction found:', transactionId);
    return { id: docSnap.id, ref: docSnap.ref, ...docSnap.data() };
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
      studentEmail: transaction.userEmail || '',
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

// ==================== CALLBACK HANDLER (merged from payment-callback.ts) ====================
// Handles SSLCOMMERZ success/fail/cancel redirects as action=callback
// SSLCOMMERZ sends as a POST (form data) which Vercel parses into req.body
// The function then redirects the browser to the /payment-success page

async function handleCallback(req: VercelRequest, res: VercelResponse) {
  console.log('');
  console.log('='.repeat(80));
  console.log('🔔 SSLCOMMERZ CALLBACK (action=callback)');
  console.log('='.repeat(80));
  console.log('Timestamp:', new Date().toISOString());
  console.log('Method:', req.method);
  console.log('Body:', JSON.stringify(req.body, null, 2));
  console.log('='.repeat(80));

  try {
    const status      = req.body?.status      || req.query.status;
    const tran_id     = req.body?.tran_id     || req.query.tran_id;
    const val_id      = req.body?.val_id      || req.query.val_id;
    const card_type   = req.body?.card_type;
    const bank_tran_id = req.body?.bank_tran_id;
    const risk_level  = req.body?.risk_level  || '0';

    console.log('Extracted:', { status, tran_id, val_id, card_type, risk_level });

    if (!tran_id) {
      console.error('❌ Missing transaction ID');
      return res.redirect(302, '/payment-success?error=invalid_transaction');
    }

    // Handle cancelled / failed
    if (status === 'CANCELLED' || status === 'FAILED') {
      console.log('⚠️ Payment', status);

      try {
        await updateTransaction(tran_id, {
          status: status === 'CANCELLED' ? 'cancelled' : 'failed'
        });
      } catch (err) {
        console.warn('Failed to update status:', err);
      }

      return res.redirect(302, `/payment-success?status=${status.toLowerCase()}&tran_id=${tran_id}`);
    }

    // Handle success — validate with SSLCOMMERZ
    if (status === 'VALID' || status === 'VALIDATED') {
      console.log('🔍 Validating payment...');

      if (!val_id) {
        console.error('❌ Missing validation ID');
        return res.redirect(302, `/payment-success?status=failed&tran_id=${tran_id}`);
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

          if (risk_level === '1') {
            console.warn('⚠️ High risk transaction');

            await updateTransaction(tran_id, {
              status: 'validating',
              validationId: val_id,
              paymentMethod: card_type,
              bankTransactionId: bank_tran_id,
              riskLevel: risk_level,
              needsManualReview: true
            });

            return res.redirect(302, `/payment-success?status=validating&tran_id=${tran_id}`);
          }

          // Normal success
          await updateTransaction(tran_id, {
            status: 'success',
            validationId: val_id,
            paymentMethod: card_type,
            bankTransactionId: bank_tran_id,
            riskLevel: risk_level,
            completedAt: admin.firestore.FieldValue.serverTimestamp()
          });

          // Get transaction for enrollment
          const transaction = await getTransaction(tran_id);
          if (transaction) {
            await createEnrollment({
              ...transaction,
              paymentMethod: card_type,
              validationId: val_id,
              bankTransactionId: bank_tran_id
            });
          }

          console.log('✅ Payment successful, redirecting to payment-success page...');
          return res.redirect(302, `/payment-success?enrolled=true&tran_id=${tran_id}`);

        } else {
          console.error('❌ Validation failed:', validationData.status);

          await updateTransaction(tran_id, {
            status: 'failed',
            metadata: { validationData }
          });

          return res.redirect(302, `/payment-success?status=failed&tran_id=${tran_id}`);
        }
      } catch (validationError: any) {
        console.error('❌ Validation error:', validationError.message);
        return res.redirect(302, `/payment-success?status=validation_error&tran_id=${tran_id}`);
      }
    }

    // Unknown status
    console.error('❌ Unknown status:', status);
    return res.redirect(302, `/payment-success?status=unknown&tran_id=${tran_id}`);

  } catch (error: any) {
    console.error('');
    console.error('💥 CALLBACK ERROR');
    console.error('='.repeat(80));
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
    console.error('='.repeat(80));

    return res.redirect(302, '/payment-success?error=callback_failed');
  }
}

// ==================== MAIN HANDLER ====================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const action = req.query.action as string | undefined;
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

    // ==================== CALLBACK (merged from payment-callback.ts) ====================
    // Accepts both GET and POST since SSLCOMMERZ may use either depending on gateway mode.
    if (action === 'callback') {
      return await handleCallback(req, res);
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
        userEmail,    // optional — may be empty or absent
        amount,
        productId,
        productName,
        productType
      } = req.body;

      // Required fields — userEmail is NOT required
      const missingFields = [];
      if (!transactionId) missingFields.push('transactionId');
      if (!userId) missingFields.push('userId');
      if (!userName) missingFields.push('userName');
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

      // Resolve email — SSLCOMMERZ requires a value; generate a placeholder when absent
      const resolvedEmail: string = (userEmail && userEmail.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userEmail.trim()))
        ? userEmail.trim()
        : `${String(userId).replace(/[^a-zA-Z0-9]/g, '').substring(0, 20) || 'user'}@noemail.local`;

      console.log('📧 Using email for gateway:', resolvedEmail);

      // Callback URL now points to this single file with action=callback
      const callbackUrl = `${baseUrl}/api/payment?action=callback`;
      const ipnUrl = `${baseUrl}/api/payment?action=ipn`;

      console.log('');
      console.log('🔗 PAYMENT URLs CONFIGURED:');
      console.log('  Success URL:', callbackUrl);
      console.log('  Fail URL:', callbackUrl);
      console.log('  Cancel URL:', callbackUrl);
      console.log('  IPN URL:', ipnUrl);
      console.log('');

      const paymentData = {
        store_id: SSLCOMMERZ_CONFIG.storeId,
        store_passwd: SSLCOMMERZ_CONFIG.storePassword,
        total_amount: parseFloat(parseFloat(amount).toFixed(2)),
        currency: 'BDT',
        tran_id: transactionId,
        success_url: callbackUrl,
        fail_url: callbackUrl,
        cancel_url: callbackUrl,
        ipn_url: ipnUrl,
        cus_name: userName,
        cus_email: resolvedEmail,
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
      availableActions: ['initiate', 'callback', 'ipn', 'validate'],
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
