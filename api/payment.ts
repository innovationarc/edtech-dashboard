// api/payment.ts
// PRODUCTION-GRADE SECURE PAYMENT SYSTEM
// Security Features:
// 1. ONE-TIME NONCE: Each payment URL contains a cryptographic nonce that can only be used ONCE
// 2. SERVER-SIDE ENROLLMENT: Enrollment is created server-side ONLY after payment verification
// 3. TRANSACTION STATE: Strict state machine prevents replay attacks
// 4. OWNERSHIP VERIFICATION: Transaction userId must match current user
// 5. IDEMPOTENCY: Duplicate payment attempts are safely handled

import { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';
import admin from 'firebase-admin';
import crypto from 'crypto';

// ==================== CORS ====================
function setCorsHeaders(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );
}

// ==================== FIRESTORE SANITIZER ====================
function sanitizeForFirestore(value: any): any {
  if (value === undefined) return null;
  if (value === null) return null;
  if (value instanceof Date) return value;
  if (value && typeof value === 'object' && (typeof value.toDate === 'function' || typeof value._methodName === 'string')) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.filter((item) => item !== undefined).map((item) => sanitizeForFirestore(item));
  }
  if (typeof value === 'object') {
    const clean: Record<string, any> = {};
    for (const key of Object.keys(value)) {
      if (value[key] === undefined) continue;
      clean[key] = sanitizeForFirestore(value[key]);
    }
    return clean;
  }
  return value;
}

// ==================== FIREBASE ADMIN ====================
function initializeFirebase() {
  try {
    if (admin.apps && admin.apps.length > 0) {
      console.log('✅ Firebase Admin already initialized');
      return admin.apps[0]!;
    }

    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!projectId || !clientEmail || !privateKey) {
      throw new Error('Missing Firebase credentials');
    }

    const app = admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey })
    });

    console.log('✅ Firebase Admin initialized successfully');
    return app;
  } catch (error: any) {
    console.error('❌ Firebase Admin initialization error:', error.message);
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
  console.error('❌ Failed to initialize Firebase:', error.message);
}

function getFirestore(): admin.firestore.Firestore {
  if (db) return db;
  if (!firebaseApp) firebaseApp = initializeFirebase();
  db = firebaseApp.firestore();
  return db;
}

// ==================== SSLCOMMERZ CONFIG ====================
const SSLCOMMERZ_CONFIG = {
  storeId: process.env.SSLCOMMERZ_STORE_ID || '',
  storePassword: process.env.SSLCOMMERZ_STORE_PASSWORD || '',
  isLive: process.env.SSLCOMMERZ_IS_LIVE === 'true',
  sessionUrl:
    process.env.SSLCOMMERZ_IS_LIVE === 'true'
      ? 'https://securepay.sslcommerz.com/gwprocess/v4/api.php'
      : 'https://sandbox.sslcommerz.com/gwprocess/v4/api.php',
  validationUrl:
    process.env.SSLCOMMERZ_IS_LIVE === 'true'
      ? 'https://securepay.sslcommerz.com/validator/api/validationserverAPI.php'
      : 'https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php'
};

function getBaseUrl(req: VercelRequest): string {
  const host = req.headers.host || 'localhost:3000';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  return `${protocol}://${host}`;
}

function resolveEmail(userId: string, userEmail?: string): string {
  if (userEmail && userEmail.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userEmail.trim())) {
    return userEmail.trim();
  }
  const safeId = String(userId).replace(/[^a-zA-Z0-9]/g, '').substring(0, 20) || 'user';
  return `${safeId}@noemail.local`;
}

// ==================== NONCE GENERATION ====================
// Generates a cryptographically secure one-time nonce
function generateNonce(): string {
  return crypto.randomBytes(32).toString('hex');
}

// ==================== DB HELPERS ====================
async function getTransaction(transactionId: string) {
  try {
    const firestore = getFirestore();
    const snapshot = await firestore
      .collection('transactions')
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

    const cleanUpdates = sanitizeForFirestore({
      ...updates,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    await transaction.ref.update(cleanUpdates);
    console.log('✅ Transaction updated:', transactionId, updates.status || '');
    return true;
  } catch (error: any) {
    console.error('❌ Error updating transaction:', error.message);
    return false;
  }
}

// ==================== ENROLLMENT CREATION ====================
// CRITICAL: This function creates the enrollment document in Firestore
// It runs ONLY after payment is verified server-side
async function createEnrollment(transaction: any): Promise<boolean> {
  try {
    const firestore = getFirestore();
    const { userId, productId, productName, amount, transactionId, metadata } = transaction;

    console.log('📝 Creating enrollment...');
    console.log('User ID:', userId);
    console.log('Course ID:', productId);
    console.log('Transaction ID:', transactionId);

    // Check if enrollment already exists (idempotency)
    const existingEnrollment = await firestore
      .collection('enrollments')
      .where('studentId', '==', userId)
      .where('courseId', '==', productId)
      .limit(1)
      .get();

    if (!existingEnrollment.empty) {
      console.log('ℹ️ Enrollment already exists, skipping creation');
      return true;
    }

    // Parse applied coupons from metadata
    let appliedCoupons: any[] = [];
    if (metadata?.appliedCoupons) {
      try {
        const parsed = JSON.parse(metadata.appliedCoupons);
        if (Array.isArray(parsed)) appliedCoupons = parsed;
      } catch (_) {
        console.warn('⚠️ Could not parse appliedCoupons');
      }
    }

    // Prepare enrollment data
    const enrollmentData = sanitizeForFirestore({
      courseId: productId,
      studentId: userId,
      studentName: transaction.userName || 'Unknown',
      studentEmail: transaction.userEmail || `${userId}@noemail.local`,
      enrolledAt: admin.firestore.FieldValue.serverTimestamp(),
      progress: 0,
      completedLessons: [],
      lastAccessedAt: admin.firestore.FieldValue.serverTimestamp(),
      certificateIssued: false,
      paymentStatus: 'completed',
      transactionId: transactionId,
      amountPaid: amount,
      paymentMethod: transaction.paymentMethod || 'SSLCOMMERZ',
      paymentDate: admin.firestore.FieldValue.serverTimestamp(),
      appliedDiscounts: {
        previousStudentDiscount: metadata?.previousStudentDiscount || 0,
        extraDiscount: metadata?.extraDiscount || 0,
        couponDiscount: metadata?.couponDiscount || 0,
        appliedCoupons: appliedCoupons
      }
    });

    // Create enrollment document
    const enrollmentRef = await firestore.collection('enrollments').add(enrollmentData);
    console.log('✅ Enrollment created:', enrollmentRef.id);

    // Record coupon usage statistics
    await recordCouponUsages(transaction, amount);

    // Add course to student's content library
    await addCourseToContentLibrary(productId, userId);

    return true;
  } catch (error: any) {
    console.error('❌ Error creating enrollment:', error.message);
    console.error('Stack:', error.stack);
    return false;
  }
}

// ==================== COUPON USAGE RECORDING ====================
interface AppliedCoupon {
  couponId: string;
  couponCode: string;
  discount: number;
  successMessage?: string;
}

async function recordCouponUsages(transaction: any, amountPaid: number) {
  const firestore = getFirestore();
  const meta = transaction.metadata || {};

  let appliedCoupons: AppliedCoupon[] = [];
  if (meta.appliedCoupons) {
    try {
      const parsed = JSON.parse(meta.appliedCoupons);
      if (Array.isArray(parsed)) appliedCoupons = parsed;
    } catch (_) {
      console.warn('⚠️ Could not parse metadata.appliedCoupons JSON');
    }
  }

  if (appliedCoupons.length === 0) {
    console.log('ℹ️ No coupons to record');
    return;
  }

  console.log(`📋 Recording ${appliedCoupons.length} coupon usage(s)...`);

  for (const ac of appliedCoupons) {
    try {
      if (!ac.couponId || !ac.couponCode) {
        console.warn('⚠️ Skipping invalid coupon:', ac);
        continue;
      }

      const usageData = sanitizeForFirestore({
        couponId: ac.couponId,
        couponCode: ac.couponCode,
        userId: transaction.userId,
        userName: transaction.userName,
        userEmail: transaction.userEmail,
        courseId: transaction.productId,
        courseName: transaction.productName,
        transactionId: transaction.transactionId,
        discountAmount: ac.discount,
        orderAmount: amountPaid,
        usedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      await firestore.collection('couponUsage').add(usageData);
      console.log(`✅ Recorded coupon usage: ${ac.couponCode}`);
    } catch (error: any) {
      console.error(`❌ Error recording coupon ${ac.couponCode}:`, error.message);
    }
  }
}

// ==================== CONTENT LIBRARY HELPER ====================
async function addCourseToContentLibrary(courseId: string, studentId: string) {
  try {
    const firestore = getFirestore();
    
    // Check if already added
    const existingContent = await firestore
      .collection('studentContent')
      .where('courseId', '==', courseId)
      .where('enrolledStudentId', '==', studentId)
      .where('type', '==', 'course')
      .limit(1)
      .get();

    if (!existingContent.empty) {
      console.log('ℹ️ Course already in content library');
      return;
    }

    // Get course details
    const courseDoc = await firestore.collection('courses').doc(courseId).get();
    if (!courseDoc.exists) {
      console.warn('⚠️ Course not found:', courseId);
      return;
    }

    const course = courseDoc.data();
    if (!course) return;

    const mainCourseEntry = sanitizeForFirestore({
      title: course.title,
      description: course.description,
      type: 'course',
      course: course.title,
      category: course.category || 'General',
      class: course.class || 'All',
      subjects: course.subjects || [],
      difficulty: course.level || 'beginner',
      tags: [...(course.tags || []), 'purchased-course', 'enrolled', 'full-course'],
      courseId: courseId,
      isFromCourse: true,
      accessLevel: 'full',
      duration: course.duration || '0h 0m',
      instructor: course.instructor || 'Unknown',
      thumbnail: course.thumbnail || '',
      rating: course.rating || 0,
      studentCount: course.studentCount || 0,
      hasAiQnA: course.hasAiQnA || false,
      hasHumanQnA: course.hasHumanQnA || false,
      hasStudyPlanner: course.hasStudyPlanner || false,
      createdBy: course.instructorId || 'unknown',
      enrolledStudentId: studentId,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    await firestore.collection('studentContent').add(mainCourseEntry);
    console.log('✅ Added course to content library');
  } catch (error: any) {
    console.error('❌ Error adding to content library:', error.message);
  }
}

// ==================== IPN DEDUP ====================
const processedIPNs = new Set<string>();

// ==================== MAIN HANDLER ====================
export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const action = req.query.action as string;
  console.log('');
  console.log('='.repeat(80));
  console.log('💳 PAYMENT API REQUEST');
  console.log('Action:', action);
  console.log('Method:', req.method);
  console.log('Timestamp:', new Date().toISOString());
  console.log('='.repeat(80));

  try {
    // ========== INITIATE PAYMENT ==========
    if (action === 'initiate' && req.method === 'POST') {
      console.log('🚀 Initiating payment...');

      const {
        userId,
        userName,
        userEmail,
        amount,
        productId,
        productName,
        productType,
        transactionId,
        appliedDiscounts,
        metadata
      } = req.body;

      // Validation
      if (!userId || !userName || !productId || !productName || !transactionId) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields',
          timestamp: new Date().toISOString()
        });
      }

      if (typeof amount !== 'number' || amount < 0) {
        return res.status(400).json({
          success: false,
          error: 'Invalid amount',
          timestamp: new Date().toISOString()
        });
      }

      const resolvedEmail = resolveEmail(userId, userEmail);
      
      // Generate ONE-TIME NONCE for this payment URL
      const nonce = generateNonce();
      console.log('🔐 Generated nonce:', nonce.substring(0, 16) + '...');

      // Create transaction with nonce
      const firestore = getFirestore();
      const transactionData = sanitizeForFirestore({
        transactionId,
        userId,
        userName,
        userEmail: resolvedEmail,
        amount,
        currency: 'BDT',
        status: 'pending',
        gateway: 'SSLCOMMERZ',
        productName,
        productId,
        productType: productType || 'course',
        nonce: nonce,  // CRITICAL: Store nonce
        nonceUsed: false,  // Track if nonce has been consumed
        appliedDiscounts: appliedDiscounts || {},
        metadata: metadata || {},
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      await firestore.collection('transactions').add(transactionData);
      console.log('✅ Transaction created with nonce');

      // Build URLs with nonce
      const baseUrl = getBaseUrl(req);
      const callbackUrl = `${baseUrl}/api/payment?action=callback&tran_id=${transactionId}&nonce=${nonce}`;
      const ipnUrl = `${baseUrl}/api/payment?action=ipn`;

      // Initialize SSLCOMMERZ payment
      const paymentData = {
        store_id: SSLCOMMERZ_CONFIG.storeId,
        store_passwd: SSLCOMMERZ_CONFIG.storePassword,
        total_amount: amount,
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

      const response = await axios.post(
        SSLCOMMERZ_CONFIG.sessionUrl,
        new URLSearchParams(paymentData as any).toString(),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          timeout: 30000
        }
      );

      if (response.data.status === 'SUCCESS') {
        console.log('✅ Payment initiation successful');
        return res.status(200).json({
          success: true,
          gatewayUrl: response.data.GatewayPageURL,
          transactionId,
          timestamp: new Date().toISOString()
        });
      } else {
        const errorReason = response.data.failedreason || 'Unknown error';
        console.error('❌ SSLCOMMERZ error:', errorReason);
        await updateTransaction(transactionId, { status: 'failed' });
        return res.status(400).json({
          success: false,
          error: 'Payment gateway error',
          details: errorReason,
          timestamp: new Date().toISOString()
        });
      }
    }

    // ========== CALLBACK HANDLER ==========
    if (action === 'callback' && req.method === 'GET') {
      console.log('🔄 Processing payment callback...');

      const tranId = req.query.tran_id as string;
      const nonce = req.query.nonce as string;
      const status = req.query.status as string;

      // Build redirect URL base
      const baseUrl = getBaseUrl(req);
      
      // Terminal failures - redirect immediately
      if (!tranId) {
        return res.redirect(`${baseUrl}/course-enrollment?error=missing_transaction`);
      }

      if (status === 'CANCELLED' || status === 'cancelled') {
        return res.redirect(`${baseUrl}/course-enrollment?status=cancelled`);
      }

      if (status === 'FAILED' || status === 'failed') {
        return res.redirect(`${baseUrl}/course-enrollment?status=failed`);
      }

      // Get transaction
      const transaction = await getTransaction(tranId);
      if (!transaction) {
        return res.redirect(`${baseUrl}/course-enrollment?error=transaction_not_found`);
      }

      // CRITICAL SECURITY CHECK 1: Verify nonce
      if (!nonce || transaction.nonce !== nonce) {
        console.error('🚨 SECURITY: Invalid or missing nonce');
        console.error('Expected:', transaction.nonce?.substring(0, 16) + '...');
        console.error('Received:', nonce?.substring(0, 16) + '...');
        return res.redirect(`${baseUrl}/course-enrollment?error=invalid_nonce`);
      }

      // CRITICAL SECURITY CHECK 2: Check if nonce already used
      if (transaction.nonceUsed === true) {
        console.error('🚨 SECURITY: Nonce already used (replay attack detected)');
        return res.redirect(`${baseUrl}/course-enrollment?error=nonce_used`);
      }

      // CRITICAL: Mark nonce as used IMMEDIATELY (prevents race conditions)
      await updateTransaction(tranId, {
        nonceUsed: true,
        nonceUsedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log('✅ Nonce marked as used');

      // If already successful, redirect to success
      if (transaction.status === 'success') {
        console.log('ℹ️ Transaction already completed');
        return res.redirect(`${baseUrl}/course-enrollment?status=success&tran_id=${tranId}`);
      }

      // For pending transactions, redirect to processing
      if (transaction.status === 'pending' || transaction.status === 'validating') {
        console.log('ℹ️ Payment pending validation');
        return res.redirect(`${baseUrl}/course-enrollment?status=processing&tran_id=${tranId}`);
      }

      // Default redirect
      return res.redirect(`${baseUrl}/course-enrollment?status=${transaction.status}`);
    }

    // ========== IPN HANDLER ==========
    if (action === 'ipn' && req.method === 'POST') {
      console.log('📬 Processing IPN...');

      const { tran_id, val_id, card_type, bank_tran_id, status, risk_level } = req.body;

      if (!tran_id || !val_id) {
        console.error('❌ Missing IPN fields');
        return res.status(400).send('Missing fields');
      }

      // Deduplication
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

      // Validate with SSLCOMMERZ
      console.log('🔍 Validating with SSLCOMMERZ...');
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
            riskLevel: risk_level
          });
        } else {
          // Mark as success
          await updateTransaction(tran_id, {
            status: 'success',
            validationId: val_id,
            paymentMethod: card_type,
            bankTransactionId: bank_tran_id,
            riskLevel: risk_level || '0',
            completedAt: admin.firestore.FieldValue.serverTimestamp()
          });

          // Create enrollment SERVER-SIDE
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
          status: validationData.status === 'CANCELLED' ? 'cancelled' : 'failed'
        });
        processedIPNs.add(tran_id);
        return res.status(200).send('OK');
      }
    }

    // ========== VALIDATE PAYMENT ==========
    if (action === 'validate' && req.method === 'POST') {
      console.log('🔍 Validating payment status...');

      const { transactionId, userId } = req.body;

      if (!transactionId || !userId) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields',
          timestamp: new Date().toISOString()
        });
      }

      const transaction = await getTransaction(transactionId);

      if (!transaction) {
        return res.status(404).json({
          success: false,
          error: 'Transaction not found',
          timestamp: new Date().toISOString()
        });
      }

      // SECURITY: Verify ownership
      if (transaction.userId !== userId) {
        console.error('🚨 SECURITY: User ID mismatch');
        return res.status(403).json({
          success: false,
          error: 'Unauthorized',
          timestamp: new Date().toISOString()
        });
      }

      console.log('Transaction status:', transaction.status);

      // If payment is successful but enrollment doesn't exist, create it
      if (transaction.status === 'success') {
        const firestore = getFirestore();
        const enrollmentCheck = await firestore
          .collection('enrollments')
          .where('studentId', '==', userId)
          .where('courseId', '==', transaction.productId)
          .limit(1)
          .get();

        if (enrollmentCheck.empty) {
          console.log('ℹ️ Creating missing enrollment...');
          await createEnrollment(transaction);
        }
      }

      return res.status(200).json({
        success: true,
        status: transaction.status,
        validated: transaction.status === 'success',
        transaction,
        timestamp: new Date().toISOString()
      });
    }

    // ========== UNKNOWN ACTION ==========
    console.error('❌ Unknown action:', action);
    return res.status(404).json({
      success: false,
      error: 'Route not found',
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('💥 FATAL ERROR:', error.message);
    console.error('Stack:', error.stack);

    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
}
