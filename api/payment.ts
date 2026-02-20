// api/payment.ts

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
  if (
    value &&
    typeof value === 'object' &&
    (typeof value.toDate === 'function' || typeof value._methodName === 'string')
  ) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.filter(item => item !== undefined).map(item => sanitizeForFirestore(item));
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

// ==================== ONE-TIME TOKEN GENERATOR ====================

function generateReturnToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// ==================== FIREBASE ADMIN ====================

function initializeFirebase() {
  try {
    if (admin.apps && admin.apps.length > 0) {
      return admin.apps[0]!;
    }

    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    console.log('🔧 Initializing Firebase Admin...');

    if (!projectId || !clientEmail || !privateKey) {
      throw new Error('Missing Firebase credentials in environment variables');
    }

    const app = admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey })
    });

    console.log('✅ Firebase Admin initialized');
    return app;
  } catch (error: any) {
    console.error('❌ Firebase Admin init error:', error.message);
    throw error;
  }
}

let firebaseApp: admin.app.App | null = null;
let db: admin.firestore.Firestore | null = null;

try {
  firebaseApp = initializeFirebase();
  db = firebaseApp.firestore();
} catch (error: any) {
  console.error('❌ Failed to initialize Firebase on module load:', error.message);
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
      : 'https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php',
};

function getBaseUrl(req: VercelRequest): string {
  const host = req.headers.host || 'localhost:3000';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  return `${protocol}://${host}`;
}

// ==================== EMAIL HELPER ====================

function resolveEmail(userId: string, userEmail?: string): string {
  if (userEmail && userEmail.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userEmail.trim())) {
    return userEmail.trim();
  }
  const safeId = String(userId).replace(/[^a-zA-Z0-9]/g, '').substring(0, 20) || 'user';
  return `${safeId}@noemail.local`;
}

// ==================== IPN DEDUP SET ====================

const processedIPNs = new Set<string>();

// ==================== DB HELPERS ====================

async function getTransaction(transactionId: string) {
  try {
    const firestore = getFirestore();
    const snapshot = await firestore
      .collection('transactions')
      .where('transactionId', '==', transactionId)
      .limit(1)
      .get();

    if (snapshot.empty) return null;
    const docSnap = snapshot.docs[0];
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
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await transaction.ref.update(cleanUpdates);
    console.log('✅ Transaction updated:', transactionId, updates.status || '');
    return true;
  } catch (error: any) {
    console.error('❌ Error updating transaction:', error.message);
    return false;
  }
}

// ==================== AppliedCoupon INTERFACE ====================

interface AppliedCoupon {
  couponId: string;
  couponCode: string;
  discount: number;
  successMessage?: string;
}

// ==================== COUPON USAGE RECORDER ====================

async function recordCouponUsages(transaction: any, amountPaid: number) {
  const meta = transaction.metadata || {};
  if (!meta.appliedCoupons) return;

  let appliedCoupons: AppliedCoupon[] = [];
  try {
    const parsed = JSON.parse(meta.appliedCoupons);
    if (Array.isArray(parsed)) appliedCoupons = parsed;
  } catch (_) {
    console.warn('⚠️ Could not parse appliedCoupons from metadata');
    return;
  }

  const firestore = getFirestore();

  for (const coupon of appliedCoupons) {
    try {
      if (!coupon.couponId) continue;
      await firestore.collection('couponUsage').add(sanitizeForFirestore({
        couponId: coupon.couponId,
        couponCode: coupon.couponCode,
        userId: transaction.userId,
        courseId: transaction.productId,
        userName: meta.userName || transaction.userName || '',
        courseName: meta.courseName || transaction.productName || '',
        discountApplied: coupon.discount,
        amountPaid,
        transactionId: transaction.transactionId,
        usedAt: admin.firestore.FieldValue.serverTimestamp(),
      }));
      console.log(`✅ Coupon usage recorded: ${coupon.couponCode}`);
    } catch (err: any) {
      console.warn(`⚠️ Failed to record coupon usage for ${coupon.couponCode}:`, err.message);
    }
  }
}

// ==================== ENROLLMENT CREATOR ====================

async function createEnrollment(transaction: any) {
  try {
    if (transaction.productType !== 'course') {
      console.log('ℹ️ Not a course, skipping enrollment');
      return null;
    }

    console.log('📝 Creating enrollment for:', transaction.transactionId);

    const firestore = getFirestore();
    const meta = transaction.metadata || {};

    // Idempotency: by transactionId
    const byTxn = await firestore
      .collection('enrollments')
      .where('transactionId', '==', transaction.transactionId)
      .limit(1)
      .get();

    if (!byTxn.empty) {
      console.log('ℹ️ Enrollment already exists for transactionId:', transaction.transactionId);
      return byTxn.docs[0].id;
    }

    // Idempotency: by studentId + courseId
    const existingEnrollment = await firestore
      .collection('enrollments')
      .where('courseId', '==', transaction.productId)
      .where('studentId', '==', transaction.userId)
      .limit(1)
      .get();

    if (!existingEnrollment.empty) {
      console.log('ℹ️ Enrollment already exists for student+course');
      return existingEnrollment.docs[0].id;
    }

    // Parse applied coupons
    let appliedCoupons: AppliedCoupon[] = [];
    if (meta.appliedCoupons) {
      try {
        const parsed = JSON.parse(meta.appliedCoupons);
        if (Array.isArray(parsed)) appliedCoupons = parsed;
      } catch (_) {
        console.warn('⚠️ Could not parse metadata.appliedCoupons');
      }
    }

    const enrollmentData = sanitizeForFirestore({
      courseId: transaction.productId,
      studentId: transaction.userId,
      studentName: meta.studentName || transaction.userName || '',
      studentEmail: meta.studentEmail || transaction.userEmail || '',
      progress: 0,
      completedLessons: [],
      enrolledAt: admin.firestore.FieldValue.serverTimestamp(),
      lastAccessedAt: admin.firestore.FieldValue.serverTimestamp(),
      paymentStatus: 'completed',
      transactionId: transaction.transactionId,
      amountPaid: meta.finalPrice ?? transaction.amount ?? 0,
      paymentMethod: transaction.paymentMethod || 'SSLCOMMERZ',
      paymentDate: admin.firestore.FieldValue.serverTimestamp(),
      appliedDiscounts: {
        previousStudentDiscount: meta.previousStudentDiscount || 0,
        extraDiscount: meta.extraDiscount || 0,
        couponDiscount: meta.couponDiscount || 0,
        appliedCoupons,
        ...(meta.couponId ? { couponId: meta.couponId } : {}),
        ...(meta.couponCode ? { couponCode: meta.couponCode } : {}),
      },
    });

    const enrollmentRef = await firestore.collection('enrollments').add(enrollmentData);
    console.log('✅ Enrollment created:', enrollmentRef.id);

    // Record coupon usages
    const amountPaid = Number(meta.finalPrice ?? transaction.amount ?? 0);
    await recordCouponUsages(transaction, amountPaid);

    // Increment course student count
    try {
      await firestore
        .collection('courses')
        .doc(transaction.productId)
        .update({ studentCount: admin.firestore.FieldValue.increment(1) });
      console.log('✅ Course student count updated');
    } catch (err: any) {
      console.warn('⚠️ Course count update failed:', err.message);
    }

    // Add to student library
    try {
      await addCourseToLibrary(transaction.productId, transaction.userId);
    } catch (err: any) {
      console.warn('⚠️ Library addition failed:', err.message);
    }

    return enrollmentRef.id;
  } catch (error: any) {
    console.error('❌ Enrollment creation error:', error.message);
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

    const existingContent = await firestore
      .collection('studentContent')
      .where('courseId', '==', courseId)
      .where('enrolledStudentId', '==', studentId)
      .where('type', '==', 'course')
      .limit(1)
      .get();

    if (!existingContent.empty) {
      console.log('ℹ️ Course already in library');
      return;
    }

    const mainCourseEntry = sanitizeForFirestore({
      title: course?.title,
      description: course?.description,
      type: 'course',
      course: course?.title,
      category: course?.category,
      class: course?.class,
      subjects: course?.subjects || [],
      difficulty: course?.level || 'beginner',
      tags: [...(course?.tags || []), 'purchased-course', 'enrolled', 'full-course'],
      courseId,
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
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await firestore.collection('studentContent').add(mainCourseEntry);
    console.log('✅ Course added to library');
  } catch (error: any) {
    console.error('❌ Library addition error:', error.message);
  }
}

// ==================== CALLBACK HANDLER ====================
//
// SECURITY: On successful payment, this now:
//   1. Updates the transaction to status='success'
//   2. Creates the enrollment
//   3. Writes a cryptographically random `returnToken` to the transaction doc
//   4. Redirects to /course-enrollment?tran_id=xxx (NO enrolled=true in URL)
//
// The frontend receives the tran_id and calls courseEnrollmentService which:
//   - Atomically consumes the returnToken via Firestore transaction
//   - If already consumed: shows "already enrolled" (replay blocked)
//   - If first use: verifies payment and shows "payment successful"

async function handleCallback(req: VercelRequest, res: VercelResponse) {
  console.log('');
  console.log('='.repeat(80));
  console.log('🔔 SSLCOMMERZ CALLBACK (action=callback)');
  console.log('='.repeat(80));
  console.log('Timestamp:', new Date().toISOString());
  console.log('Method:', req.method);
  console.log('Body:', JSON.stringify(req.body, null, 2));
  console.log('='.repeat(80));

  // The React page that handles the ?tran_id= query param on return
  const RETURN_PAGE = '/course-enrollment';

  try {
    const status = req.body?.status || req.query.status;
    const tran_id = req.body?.tran_id || req.query.tran_id;
    const val_id = req.body?.val_id || req.query.val_id;
    const card_type = req.body?.card_type;
    const bank_tran_id = req.body?.bank_tran_id;
    const risk_level = req.body?.risk_level || '0';

    console.log('Extracted:', { status, tran_id, val_id, card_type, risk_level });

    if (!tran_id) {
      console.error('❌ Missing transaction ID');
      return res.redirect(302, `${RETURN_PAGE}?error=invalid_transaction`);
    }

    // ── Cancelled / Failed ──────────────────────────────────────────────────
    if (status === 'CANCELLED' || status === 'FAILED') {
      console.log('⚠️ Payment', status);
      try {
        await updateTransaction(tran_id, {
          status: status === 'CANCELLED' ? 'cancelled' : 'failed',
        });
      } catch (err) {
        console.warn('Failed to update status:', err);
      }
      return res.redirect(302, `${RETURN_PAGE}?status=${status.toLowerCase()}&tran_id=${tran_id}`);
    }

    // ── Successful ──────────────────────────────────────────────────────────
    if (status === 'VALID' || status === 'VALIDATED') {
      console.log('🔍 Validating payment...');

      if (!val_id) {
        console.error('❌ Missing validation ID');
        return res.redirect(302, `${RETURN_PAGE}?status=failed&tran_id=${tran_id}`);
      }

      try {
        const validationResponse = await axios.get(SSLCOMMERZ_CONFIG.validationUrl, {
          params: {
            val_id,
            store_id: SSLCOMMERZ_CONFIG.storeId,
            store_passwd: SSLCOMMERZ_CONFIG.storePassword,
            format: 'json',
          },
          timeout: 30000,
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
              needsManualReview: true,
            });
            return res.redirect(302, `${RETURN_PAGE}?status=validating&tran_id=${tran_id}`);
          }

          // ── Normal success path ─────────────────────────────────────────
          // Step 1: Mark transaction as success
          await updateTransaction(tran_id, {
            status: 'success',
            validationId: val_id,
            paymentMethod: card_type,
            bankTransactionId: bank_tran_id,
            riskLevel: risk_level,
            completedAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          // Step 2: Create enrollment
          const transaction = await getTransaction(tran_id);
          if (transaction) {
            try {
              await createEnrollment({
                ...transaction,
                paymentMethod: card_type,
                validationId: val_id,
                bankTransactionId: bank_tran_id,
              });
            } catch (enrollErr: any) {
              // Non-fatal — IPN will retry. User has paid and we redirect them.
              console.error('❌ Enrollment creation error (non-fatal):', enrollErr.message);
            }

            // Step 3: Write one-time return token to Firestore
            // This token is consumed atomically by the frontend on first URL open.
            // Subsequent opens (same URL, new tab, copied link) find it consumed.
            try {
              const returnToken = generateReturnToken();
              await transaction.ref.update(sanitizeForFirestore({
                returnToken,
                returnTokenIssuedAt: admin.firestore.FieldValue.serverTimestamp(),
              }));
              console.log('✅ One-time return token written to transaction');
            } catch (tokenErr: any) {
              // Non-fatal — frontend handles missing token gracefully (treats as replay)
              console.warn('⚠️ Failed to write return token (non-fatal):', tokenErr.message);
            }
          }

          console.log('✅ Payment successful — redirecting to', RETURN_PAGE);
          // Note: NO `enrolled=true` in URL — frontend reads tran_id and verifies
          // via Firestore (including consuming the one-time token).
          return res.redirect(302, `${RETURN_PAGE}?tran_id=${tran_id}`);
        } else {
          console.error('❌ Validation failed:', validationData.status);
          await updateTransaction(tran_id, {
            status: 'failed',
            metadata: { validationData },
          });
          return res.redirect(302, `${RETURN_PAGE}?status=failed&tran_id=${tran_id}`);
        }
      } catch (validationError: any) {
        console.error('❌ Validation error:', validationError.message);
        return res.redirect(302, `${RETURN_PAGE}?status=validation_error&tran_id=${tran_id}`);
      }
    }

    // ── Unknown status ──────────────────────────────────────────────────────
    console.error('❌ Unknown status:', status);
    return res.redirect(302, `${RETURN_PAGE}?status=unknown&tran_id=${tran_id}`);
  } catch (error: any) {
    console.error('💥 CALLBACK ERROR:', error.message);
    return res.redirect(302, `${RETURN_PAGE}?error=callback_failed`);
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
        timestamp: new Date().toISOString(),
      });
    }

    // ========== CALLBACK ==========
    if (action === 'callback') {
      return await handleCallback(req, res);
    }

    // ========== INITIATE PAYMENT ==========
    if (action === 'initiate' && req.method === 'POST') {
      console.log('🚀 Starting payment initiation...');

      if (!SSLCOMMERZ_CONFIG.storeId || !SSLCOMMERZ_CONFIG.storePassword) {
        return res.status(500).json({
          success: false,
          error: 'Payment gateway not configured',
          details: 'SSLCOMMERZ credentials are missing.',
          userMessage: 'Payment system is currently unavailable. Please contact support.',
          timestamp: new Date().toISOString(),
        });
      }

      const { transactionId, userId, userName, userEmail, amount, productId, productName, productType } = req.body;

      const missingFields: string[] = [];
      if (!transactionId) missingFields.push('transactionId');
      if (!userId) missingFields.push('userId');
      if (!userName) missingFields.push('userName');
      if (amount === undefined || amount === null) missingFields.push('amount');
      if (!productId) missingFields.push('productId');
      if (!productName) missingFields.push('productName');
      if (!productType) missingFields.push('productType');

      if (missingFields.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields',
          details: `Required fields missing: ${missingFields.join(', ')}`,
          userMessage: 'Payment request is incomplete. Please try again.',
          missingFields,
          timestamp: new Date().toISOString(),
        });
      }

      const resolvedEmail = resolveEmail(userId, userEmail);

      const callbackUrl = `${baseUrl}/api/payment?action=callback`;
      const ipnUrl = `${baseUrl}/api/payment?action=ipn`;

      const paymentData = {
        store_id: SSLCOMMERZ_CONFIG.storeId,
        store_passwd: SSLCOMMERZ_CONFIG.storePassword,
        total_amount: parseFloat(parseFloat(String(amount)).toFixed(2)),
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
        emi_option: 0,
      };

      try {
        const response = await axios.post(
          SSLCOMMERZ_CONFIG.sessionUrl,
          new URLSearchParams(paymentData as any).toString(),
          {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            timeout: 30000,
          }
        );

        if (response.data.status === 'SUCCESS') {
          return res.status(200).json({
            success: true,
            gatewayUrl: response.data.GatewayPageURL,
            gatewayTransactionId: response.data.sessionkey,
            transactionId,
            timestamp: new Date().toISOString(),
          });
        } else {
          const errorReason = response.data.failedreason || 'Unknown error';
          return res.status(400).json({
            success: false,
            error: 'Payment gateway error',
            details: errorReason,
            userMessage: `Payment could not be initiated: ${errorReason}`,
            timestamp: new Date().toISOString(),
          });
        }
      } catch (axiosError: any) {
        console.error('❌ SSLCOMMERZ API call failed:', axiosError.message);
        return res.status(500).json({
          success: false,
          error: 'Failed to connect to payment gateway',
          details: axiosError.message,
          userMessage: 'Unable to connect to payment gateway. Please try again later.',
          timestamp: new Date().toISOString(),
        });
      }
    }

    // ========== IPN HANDLER ==========
    if (action === 'ipn' && req.method === 'POST') {
      console.log('📬 Processing IPN...');

      const { tran_id, val_id, card_type, bank_tran_id, status, risk_level, risk_title } = req.body;

      if (!tran_id || !val_id) {
        return res.status(400).send('Missing required fields');
      }

      if (processedIPNs.has(tran_id)) {
        console.log('ℹ️ IPN already processed:', tran_id);
        return res.status(200).send('OK');
      }

      const transaction = await getTransaction(tran_id);
      if (!transaction) {
        return res.status(404).send('Transaction not found');
      }

      if (transaction.status === 'success') {
        console.log('ℹ️ Transaction already completed:', tran_id);
        processedIPNs.add(tran_id);
        return res.status(200).send('OK');
      }

      try {
        const validationResponse = await axios.get(SSLCOMMERZ_CONFIG.validationUrl, {
          params: {
            val_id,
            store_id: SSLCOMMERZ_CONFIG.storeId,
            store_passwd: SSLCOMMERZ_CONFIG.storePassword,
            format: 'json',
          },
          timeout: 30000,
        });

        const validationData = validationResponse.data;

        if (validationData.status === 'VALID' || validationData.status === 'VALIDATED') {
          if (risk_level === '1') {
            await updateTransaction(tran_id, {
              status: 'validating',
              validationId: val_id,
              paymentMethod: card_type,
              bankTransactionId: bank_tran_id,
              riskLevel: risk_level,
              metadata: { riskTitle: risk_title, needsManualReview: true },
            });
          } else {
            await updateTransaction(tran_id, {
              status: 'success',
              validationId: val_id,
              paymentMethod: card_type,
              bankTransactionId: bank_tran_id,
              riskLevel: risk_level || '0',
              completedAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            await createEnrollment({
              ...transaction,
              paymentMethod: card_type,
              validationId: val_id,
              bankTransactionId: bank_tran_id,
            });

            // IPN also writes a returnToken (in case callback failed to do so)
            // Only write if one doesn't already exist (avoid overwriting consumed token)
            try {
              const freshTxn = await getTransaction(tran_id);
              if (freshTxn && !freshTxn.returnToken && freshTxn.returnToken !== null) {
                const returnToken = generateReturnToken();
                await freshTxn.ref.update(sanitizeForFirestore({
                  returnToken,
                  returnTokenIssuedAt: admin.firestore.FieldValue.serverTimestamp(),
                  returnTokenIssuedByIPN: true,
                }));
                console.log('✅ IPN: Return token written to transaction');
              }
            } catch (tokenErr: any) {
              console.warn('⚠️ IPN: Failed to write return token (non-fatal):', tokenErr.message);
            }
          }
          processedIPNs.add(tran_id);
          return res.status(200).send('OK');
        } else {
          await updateTransaction(tran_id, {
            status: validationData.status === 'CANCELLED' ? 'cancelled' : 'failed',
            metadata: { validationData, timestamp: new Date().toISOString() },
          });
          processedIPNs.add(tran_id);
          return res.status(200).send('OK');
        }
      } catch (axiosError: any) {
        console.error('❌ IPN validation error:', axiosError.message);
        return res.status(500).send('Validation error');
      }
    }

    // ========== VALIDATE PAYMENT ==========
    if (action === 'validate' && req.method === 'POST') {
      console.log('🔍 Validating payment status...');
      const { transactionId } = req.body;

      if (!transactionId) {
        return res.status(400).json({
          success: false,
          error: 'Transaction ID required',
          userMessage: 'Transaction ID is missing',
          timestamp: new Date().toISOString(),
        });
      }

      const transaction = await getTransaction(transactionId);
      if (!transaction) {
        return res.status(404).json({
          success: false,
          error: 'Transaction not found',
          userMessage: 'Payment record not found',
          timestamp: new Date().toISOString(),
        });
      }

      return res.status(200).json({
        success: true,
        status: transaction.status,
        validated: transaction.status === 'success',
        transaction,
        timestamp: new Date().toISOString(),
      });
    }

    // ========== UNKNOWN ACTION ==========
    return res.status(404).json({
      success: false,
      error: 'Route not found',
      details: `Unknown action: ${action}`,
      userMessage: 'Invalid payment operation requested',
      availableActions: ['initiate', 'callback', 'ipn', 'validate'],
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('💥 FATAL ERROR:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message,
      userMessage: 'An unexpected error occurred. Please contact support.',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });
  }
}
