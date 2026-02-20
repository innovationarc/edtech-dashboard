// api/payment.ts
// Vercel Serverless Function — handles all payment operations
//
// FIX FOR "error:1E08010C:DECODER routines::unsupported":
// This error occurs when Firebase Admin SDK cannot parse the private key.
// Common causes:
// 1. FIREBASE_PRIVATE_KEY has incorrect newline escaping
// 2. Key is wrapped in extra quotes
// 3. Key is base64 encoded when it shouldn't be
// 4. Wrong key format entirely

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
  if (value && typeof value === 'object') {
    if (typeof value.toDate === 'function') return value;
    if (typeof value._methodName === 'string') return value;
    if (value.constructor && value.constructor.name === 'FieldTransform') return value;
  }
  if (Array.isArray(value)) {
    return value.filter(i => i !== undefined).map(i => sanitizeForFirestore(i));
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

function generateReturnToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// ==================== FIREBASE ADMIN (FIXED) ====================

function initializeFirebase(): admin.app.App {
  if (admin.apps && admin.apps.length > 0) {
    console.log('✅ Firebase Admin already initialized');
    return admin.apps[0]!;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  console.log('🔧 Firebase Admin init check:');
  console.log('  - projectId:', projectId ? '✓' : '✗ MISSING');
  console.log('  - clientEmail:', clientEmail ? '✓' : '✗ MISSING');
  console.log('  - privateKey:', privateKey ? '✓' : '✗ MISSING');

  if (!projectId || !clientEmail || !privateKey) {
    const missing = [
      !projectId && 'FIREBASE_PROJECT_ID',
      !clientEmail && 'FIREBASE_CLIENT_EMAIL',
      !privateKey && 'FIREBASE_PRIVATE_KEY'
    ].filter(Boolean);
    throw new Error(`Missing environment variables: ${missing.join(', ')}`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CRITICAL FIX: Private key parsing
  // ─────────────────────────────────────────────────────────────────────────
  // The private key from environment variables can be malformed in several ways:
  // 1. Literal "\n" strings instead of actual newlines
  // 2. Extra quotes around the key
  // 3. Missing header/footer
  // 4. Base64 encoded (rare but possible)
  
  try {
    // Step 1: Remove any surrounding quotes
    privateKey = privateKey.trim().replace(/^["']|["']$/g, '');
    
    // Step 2: Replace literal \n with actual newlines
    privateKey = privateKey.replace(/\\n/g, '\n');
    
    // Step 3: Validate key format
    if (!privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
      console.error('❌ Private key missing BEGIN header');
      throw new Error('FIREBASE_PRIVATE_KEY must be a valid PEM format key starting with -----BEGIN PRIVATE KEY-----');
    }
    if (!privateKey.includes('-----END PRIVATE KEY-----')) {
      console.error('❌ Private key missing END footer');
      throw new Error('FIREBASE_PRIVATE_KEY must be a valid PEM format key ending with -----END PRIVATE KEY-----');
    }

    console.log('✅ Private key format validated');
    console.log('  - First 50 chars:', privateKey.substring(0, 50));
    console.log('  - Has newlines:', privateKey.includes('\n') ? '✓' : '✗');
    
  } catch (e: any) {
    console.error('❌ Private key validation failed:', e.message);
    throw e;
  }

  // Initialize Firebase Admin
  try {
    const app = admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      })
    });
    console.log('✅ Firebase Admin initialized successfully');
    return app;
  } catch (e: any) {
    console.error('❌ Firebase Admin initialization failed');
    console.error('Error:', e.message);
    console.error('Stack:', e.stack);
    
    // Provide helpful error messages
    if (e.message.includes('DECODER') || e.message.includes('unsupported')) {
      console.error('');
      console.error('═══════════════════════════════════════════════════════════════');
      console.error('PRIVATE KEY FORMAT ERROR');
      console.error('═══════════════════════════════════════════════════════════════');
      console.error('Your FIREBASE_PRIVATE_KEY is malformed. Common fixes:');
      console.error('');
      console.error('1. In Vercel/Railway/etc environment variables:');
      console.error('   - DO NOT add extra quotes');
      console.error('   - Copy the entire key including BEGIN/END lines');
      console.error('   - The platform will handle escaping automatically');
      console.error('');
      console.error('2. If setting via CLI:');
      console.error('   vercel env add FIREBASE_PRIVATE_KEY');
      console.error('   (paste the key when prompted, INCLUDING the BEGIN/END lines)');
      console.error('');
      console.error('3. The key should look like:');
      console.error('   -----BEGIN PRIVATE KEY-----');
      console.error('   MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSj...');
      console.error('   -----END PRIVATE KEY-----');
      console.error('═══════════════════════════════════════════════════════════════');
    }
    
    throw e;
  }
}

let _db: admin.firestore.Firestore | null = null;

try {
  initializeFirebase();
  _db = admin.app().firestore();
  console.log('✅ Firestore instance created');
} catch (e: any) {
  console.error('❌ Firebase module-load init failed:', e.message);
  _db = null;
}

function getFirestore(): admin.firestore.Firestore {
  if (_db) return _db;
  
  try {
    initializeFirebase();
    _db = admin.app().firestore();
    return _db;
  } catch (e: any) {
    console.error('❌ getFirestore failed:', e.message);
    throw new Error(`Firestore unavailable: ${e.message}`);
  }
}

// ==================== SSLCOMMERZ ====================

const SSL = {
  storeId: process.env.SSLCOMMERZ_STORE_ID || '',
  storePassword: process.env.SSLCOMMERZ_STORE_PASSWORD || '',
  isLive: process.env.SSLCOMMERZ_IS_LIVE === 'true',
  get sessionUrl() {
    return this.isLive
      ? 'https://securepay.sslcommerz.com/gwprocess/v4/api.php'
      : 'https://sandbox.sslcommerz.com/gwprocess/v4/api.php';
  },
  get validationUrl() {
    return this.isLive
      ? 'https://securepay.sslcommerz.com/validator/api/validationserverAPI.php'
      : 'https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php';
  },
};

function getBaseUrl(req: VercelRequest): string {
  const host = req.headers.host || 'localhost:3000';
  return `${host.includes('localhost') ? 'http' : 'https'}://${host}`;
}

function resolveEmail(userId: string, userEmail?: string): string {
  if (userEmail?.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userEmail.trim())) return userEmail.trim();
  return `${String(userId).replace(/[^a-zA-Z0-9]/g, '').substring(0, 20) || 'user'}@noemail.local`;
}

// ==================== IPN DEDUP ====================

const processedIPNs = new Set<string>();

// ==================== DB HELPERS ====================

async function getTransaction(transactionId: string): Promise<any | null> {
  try {
    const db = getFirestore();
    const snap = await db
      .collection('transactions')
      .where('transactionId', '==', transactionId)
      .limit(1)
      .get();
    
    if (snap.empty) {
      console.log('❌ Transaction not found:', transactionId);
      return null;
    }
    
    const d = snap.docs[0];
    return { id: d.id, ref: d.ref, ...d.data() };
  } catch (e: any) {
    console.error('❌ getTransaction error:', e.message);
    console.error('Stack:', e.stack);
    
    // If this is the decoder error, provide specific guidance
    if (e.message.includes('DECODER') || e.message.includes('unsupported')) {
      console.error('');
      console.error('⚠️  This is the FIREBASE_PRIVATE_KEY configuration error.');
      console.error('⚠️  Please check the initialization logs above for fix instructions.');
    }
    
    return null;
  }
}

async function updateTransaction(transactionId: string, updates: any): Promise<boolean> {
  try {
    const txn = await getTransaction(transactionId);
    if (!txn) {
      console.error('❌ updateTransaction: not found:', transactionId);
      return false;
    }
    
    await txn.ref.update(sanitizeForFirestore({
      ...updates,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }));
    
    console.log('✅ Transaction updated:', transactionId, '| status:', updates.status || '-');
    return true;
  } catch (e: any) {
    console.error('❌ updateTransaction error:', e.message);
    console.error('Stack:', e.stack);
    return false;
  }
}

// ==================== ENROLLMENT CREATION ====================

interface AppliedCoupon {
  couponId: string;
  couponCode: string;
  discount: number;
  successMessage?: string;
}

interface EnrollmentResult {
  success: boolean;
  enrollmentId?: string;
  alreadyExisted?: boolean;
  error?: string;
}

async function createEnrollment(transaction: any): Promise<EnrollmentResult> {
  const TAG = '[createEnrollment]';

  if (transaction.productType !== 'course') {
    const msg = `productType is "${transaction.productType}", not "course" — skipping`;
    console.log(`${TAG} ${msg}`);
    return { success: false, error: msg };
  }

  const courseId: string = transaction.productId || '';
  const studentId: string = transaction.userId || '';
  const transactionId: string = transaction.transactionId || '';

  console.log(`${TAG} Starting — courseId=${courseId} studentId=${studentId} transactionId=${transactionId}`);

  if (!courseId || !studentId || !transactionId) {
    const msg = `Missing required fields: courseId=${courseId} studentId=${studentId} transactionId=${transactionId}`;
    console.error(`${TAG} ❌ ${msg}`);
    console.error(`${TAG} Full transaction keys:`, Object.keys(transaction));
    return { success: false, error: msg };
  }

  const db = getFirestore();

  // Idempotency check
  try {
    const existing = await db
      .collection('enrollments')
      .where('transactionId', '==', transactionId)
      .limit(1)
      .get();
    
    if (!existing.empty) {
      console.log(`${TAG} Already exists (transactionId):`, existing.docs[0].id);
      return { success: true, enrollmentId: existing.docs[0].id, alreadyExisted: true };
    }
  } catch (idxErr: any) {
    console.error(`${TAG} Idempotency check error (non-fatal, will continue):`, idxErr.message);
  }

  // Parse applied coupons
  const meta = transaction.metadata || {};
  let appliedCoupons: AppliedCoupon[] = [];
  if (meta.appliedCoupons) {
    try {
      const p = JSON.parse(meta.appliedCoupons);
      if (Array.isArray(p)) appliedCoupons = p;
    } catch (_) {
      console.warn(`${TAG} Could not parse appliedCoupons`);
    }
  }

  // Build enrollment document
  const enrollmentData = sanitizeForFirestore({
    courseId,
    studentId,
    studentName: meta.studentName || transaction.userName || '',
    studentEmail: meta.studentEmail || transaction.userEmail || '',
    progress: 0,
    completedLessons: [],
    enrolledAt: admin.firestore.FieldValue.serverTimestamp(),
    lastAccessedAt: admin.firestore.FieldValue.serverTimestamp(),
    paymentStatus: 'completed',
    transactionId,
    amountPaid: Number(meta.finalPrice ?? transaction.amount ?? 0),
    paymentMethod: transaction.paymentMethod || 'SSLCOMMERZ',
    paymentDate: admin.firestore.FieldValue.serverTimestamp(),
    appliedDiscounts: {
      previousStudentDiscount: Number(meta.previousStudentDiscount || 0),
      extraDiscount: Number(meta.extraDiscount || 0),
      couponDiscount: Number(meta.couponDiscount || 0),
      appliedCoupons,
      ...(meta.couponId ? { couponId: meta.couponId } : {}),
      ...(meta.couponCode ? { couponCode: meta.couponCode } : {}),
    },
  });

  console.log(`${TAG} Writing to Firestore...`);
  console.log(`${TAG} Data:`, JSON.stringify(enrollmentData, null, 2));

  // Write to Firestore
  let enrollmentRef: admin.firestore.DocumentReference;
  try {
    enrollmentRef = await db.collection('enrollments').add(enrollmentData);
    console.log(`${TAG} ✅ WRITTEN: enrollments/${enrollmentRef.id}`);
  } catch (writeErr: any) {
    console.error(`${TAG} ❌ FIRESTORE WRITE FAILED`);
    console.error(`${TAG} Error message:`, writeErr.message);
    console.error(`${TAG} Error code:`, writeErr.code);
    console.error(`${TAG} Stack:`, writeErr.stack);
    return { success: false, error: `Write failed: ${writeErr.message} (code: ${writeErr.code})` };
  }

  // Non-critical: coupon usage
  const amountPaid = Number(meta.finalPrice ?? transaction.amount ?? 0);
  for (const coupon of appliedCoupons) {
    if (!coupon.couponId) continue;
    try {
      await db.collection('couponUsage').add(sanitizeForFirestore({
        couponId: coupon.couponId,
        couponCode: coupon.couponCode,
        userId: studentId,
        courseId,
        userName: meta.userName || transaction.userName || '',
        courseName: meta.courseName || transaction.productName || '',
        discountApplied: coupon.discount,
        amountPaid,
        transactionId,
        usedAt: admin.firestore.FieldValue.serverTimestamp(),
      }));
    } catch (e: any) {
      console.warn(`${TAG} Coupon usage record failed:`, e.message);
    }
  }

  // Non-critical: course student count
  try {
    await db.collection('courses').doc(courseId).update({
      studentCount: admin.firestore.FieldValue.increment(1),
    });
  } catch (e: any) {
    console.warn(`${TAG} Student count update failed:`, e.message);
  }

  // Non-critical: content library
  try {
    await addCourseToLibrary(courseId, studentId, transaction.productName || '');
  } catch (e: any) {
    console.warn(`${TAG} Library addition failed:`, e.message);
  }

  return { success: true, enrollmentId: enrollmentRef.id };
}

async function addCourseToLibrary(courseId: string, studentId: string, fallbackTitle: string) {
  const db = getFirestore();

  try {
    const existing = await db.collection('studentContent')
      .where('courseId', '==', courseId)
      .where('enrolledStudentId', '==', studentId)
      .where('type', '==', 'course')
      .limit(1)
      .get();
    
    if (!existing.empty) {
      console.log('[addCourseToLibrary] Already in library');
      return;
    }
  } catch (_) {
    // Index may not exist, continue anyway
  }

  const courseDoc = await db.collection('courses').doc(courseId).get();
  const c = courseDoc.exists ? courseDoc.data() : null;

  await db.collection('studentContent').add(sanitizeForFirestore({
    title: c?.title || fallbackTitle,
    description: c?.description || '',
    type: 'course',
    course: c?.title || fallbackTitle,
    category: c?.category || '',
    class: c?.class || '',
    subjects: c?.subjects || [],
    difficulty: c?.level || 'beginner',
    tags: [...(c?.tags || []), 'purchased-course', 'enrolled', 'full-course'],
    courseId,
    isFromCourse: true,
    accessLevel: 'full',
    duration: c?.duration || '',
    instructor: c?.instructor || '',
    thumbnail: c?.thumbnail || '',
    rating: c?.rating || 0,
    studentCount: c?.studentCount || 0,
    hasAiQnA: c?.hasAiQnA || false,
    hasHumanQnA: c?.hasHumanQnA || false,
    hasStudyPlanner: c?.hasStudyPlanner || false,
    createdBy: c?.instructorId || '',
    enrolledStudentId: studentId,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  }));
  
  console.log('[addCourseToLibrary] ✅ Added');
}

// ==================== CALLBACK HANDLER ====================

async function handleCallback(req: VercelRequest, res: VercelResponse) {
  const TAG = '[handleCallback]';
  console.log('');
  console.log('='.repeat(80));
  console.log(`${TAG} RECEIVED`);
  console.log('Timestamp:', new Date().toISOString());
  console.log('Method:', req.method);
  console.log('Content-Type:', req.headers['content-type']);
  console.log('Body:', JSON.stringify(req.body || {}, null, 2));
  console.log('Query:', JSON.stringify(req.query || {}, null, 2));
  console.log('='.repeat(80));

  const RETURN_PAGE = '/course-enrollment';
  const body = req.body || {};

  try {
    const status = body.status || req.query.status;
    const tran_id = body.tran_id || req.query.tran_id;
    const val_id = body.val_id || req.query.val_id;
    const card_type = body.card_type || '';
    const bank_tran_id = body.bank_tran_id || '';
    const risk_level = body.risk_level || '0';

    console.log(`${TAG} Parsed:`, { status, tran_id, val_id, risk_level });

    if (!tran_id) {
      console.error(`${TAG} ❌ tran_id missing`);
      return res.redirect(302, `${RETURN_PAGE}?error=invalid_transaction`);
    }

    // Cancelled / Failed
    if (status === 'CANCELLED' || status === 'FAILED') {
      await updateTransaction(tran_id, {
        status: status === 'CANCELLED' ? 'cancelled' : 'failed'
      });
      return res.redirect(302, `${RETURN_PAGE}?status=${status.toLowerCase()}&tran_id=${tran_id}`);
    }

    // Success
    if (status === 'VALID' || status === 'VALIDATED') {
      if (!val_id) {
        console.error(`${TAG} ❌ val_id missing on VALID status`);
        return res.redirect(302, `${RETURN_PAGE}?status=failed&tran_id=${tran_id}`);
      }

      // Validate with SSLCOMMERZ
      let valData: any;
      try {
        const valRes = await axios.get(SSL.validationUrl, {
          params: {
            val_id,
            store_id: SSL.storeId,
            store_passwd: SSL.storePassword,
            format: 'json'
          },
          timeout: 15000,
        });
        valData = valRes.data;
        console.log(`${TAG} SSL validation response status:`, valData.status);
      } catch (e: any) {
        console.error(`${TAG} ❌ SSL validation request failed:`, e.message);
        return res.redirect(302, `${RETURN_PAGE}?status=validation_error&tran_id=${tran_id}`);
      }

      if (valData.status === 'VALID' || valData.status === 'VALIDATED') {
        // High risk — manual review
        if (risk_level === '1') {
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

        // NORMAL SUCCESS PATH

        // Step 1: Update transaction to success
        console.log(`${TAG} Step 1: Marking transaction success...`);
        await updateTransaction(tran_id, {
          status: 'success',
          validationId: val_id,
          paymentMethod: card_type,
          bankTransactionId: bank_tran_id,
          riskLevel: risk_level,
          completedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Step 2: Fetch transaction
        console.log(`${TAG} Step 2: Fetching transaction...`);
        const transaction = await getTransaction(tran_id);
        if (!transaction) {
          console.error(`${TAG} ❌ Cannot fetch transaction after update`);
          return res.redirect(302, `${RETURN_PAGE}?status=failed&tran_id=${tran_id}`);
        }

        console.log(`${TAG} Transaction data:`, {
          productType: transaction.productType,
          productId: transaction.productId,
          userId: transaction.userId,
          amount: transaction.amount,
          metadataKeys: transaction.metadata ? Object.keys(transaction.metadata) : 'NO METADATA',
        });

        // Step 3: Create enrollment
        console.log(`${TAG} Step 3: Creating enrollment...`);
        const enrollResult = await createEnrollment({
          ...transaction,
          paymentMethod: card_type,
          validationId: val_id,
          bankTransactionId: bank_tran_id,
        });

        if (!enrollResult.success) {
          console.error(`${TAG} ❌ ENROLLMENT FAILED: ${enrollResult.error}`);
          return res.redirect(302, `${RETURN_PAGE}?tran_id=${tran_id}&enrollment_error=1`);
        }

        console.log(`${TAG} ✅ Enrollment success: ${enrollResult.enrollmentId}`);

        // Step 4: Write one-time return token
        try {
          await transaction.ref.update(sanitizeForFirestore({
            returnToken: generateReturnToken(),
            returnTokenIssuedAt: admin.firestore.FieldValue.serverTimestamp(),
          }));
          console.log(`${TAG} ✅ Return token written`);
        } catch (e: any) {
          console.warn(`${TAG} Return token write failed (non-fatal):`, e.message);
        }

        // Step 5: Redirect
        console.log(`${TAG} ✅ Redirecting to ${RETURN_PAGE}?tran_id=${tran_id}`);
        return res.redirect(302, `${RETURN_PAGE}?tran_id=${tran_id}`);

      } else {
        console.error(`${TAG} SSL says payment INVALID: ${valData.status}`);
        await updateTransaction(tran_id, { status: 'failed' });
        return res.redirect(302, `${RETURN_PAGE}?status=failed&tran_id=${tran_id}`);
      }
    }

    console.error(`${TAG} Unknown status: "${status}"`);
    return res.redirect(302, `${RETURN_PAGE}?status=unknown&tran_id=${tran_id}`);

  } catch (e: any) {
    console.error(`${TAG} 💥 UNHANDLED:`, e.message, e.stack);
    return res.redirect(302, `${RETURN_PAGE}?error=callback_failed`);
  }
}

// ==================== MAIN HANDLER ====================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const action = req.query.action as string | undefined;
  console.log(`\n${'='.repeat(60)}\n📨 PAYMENT API | action=${action} | method=${req.method}\n${'='.repeat(60)}`);

  try {
    // Test Firestore connection
    try {
      getFirestore();
      console.log('✅ Firestore connection OK');
    } catch (e: any) {
      console.error('❌ Firestore connection failed:', e.message);
      return res.status(500).json({
        success: false,
        error: 'Database unavailable',
        details: e.message,
        userMessage: 'Service temporarily unavailable. Please try again later.',
        hint: 'Check FIREBASE_PRIVATE_KEY environment variable configuration'
      });
    }

    if (action === 'callback') return await handleCallback(req, res);

    if (action === 'initiate' && req.method === 'POST') {
      if (!SSL.storeId || !SSL.storePassword) {
        return res.status(500).json({
          success: false,
          error: 'Payment gateway not configured',
          userMessage: 'Payment unavailable. Contact support.'
        });
      }

      const {
        transactionId, userId, userName, userEmail,
        amount, productId, productName, productType
      } = req.body || {};

      const missing = [
        !transactionId && 'transactionId',
        !userId && 'userId',
        !userName && 'userName',
        (amount == null) && 'amount',
        !productId && 'productId',
        !productName && 'productName',
        !productType && 'productType'
      ].filter(Boolean);

      if (missing.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Missing fields',
          details: missing.join(', '),
          userMessage: 'Payment request incomplete.'
        });
      }

      const baseUrl = getBaseUrl(req);
      const callbackUrl = `${baseUrl}/api/payment?action=callback`;
      const ipnUrl = `${baseUrl}/api/payment?action=ipn`;
      console.log('Callback URL:', callbackUrl);

      try {
        const sslRes = await axios.post(
          SSL.sessionUrl,
          new URLSearchParams({
            store_id: SSL.storeId,
            store_passwd: SSL.storePassword,
            total_amount: String(parseFloat(parseFloat(String(amount)).toFixed(2))),
            currency: 'BDT',
            tran_id: transactionId,
            success_url: callbackUrl,
            fail_url: callbackUrl,
            cancel_url: callbackUrl,
            ipn_url: ipnUrl,
            cus_name: userName,
            cus_email: resolveEmail(userId, userEmail),
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
            num_of_item: '1',
            emi_option: '0',
          } as any).toString(),
          {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            timeout: 30000
          }
        );

        if (sslRes.data.status === 'SUCCESS') {
          return res.status(200).json({
            success: true,
            gatewayUrl: sslRes.data.GatewayPageURL,
            gatewayTransactionId: sslRes.data.sessionkey,
            transactionId
          });
        } else {
          return res.status(400).json({
            success: false,
            error: 'Gateway error',
            details: sslRes.data.failedreason,
            userMessage: `Payment failed: ${sslRes.data.failedreason}`
          });
        }
      } catch (e: any) {
        return res.status(500).json({
          success: false,
          error: 'Gateway unreachable',
          details: e.message,
          userMessage: 'Cannot connect to payment gateway.'
        });
      }
    }

    if (action === 'ipn' && req.method === 'POST') {
      const {
        tran_id, val_id, card_type, bank_tran_id,
        status, risk_level, risk_title
      } = req.body || {};

      if (!tran_id || !val_id) return res.status(400).send('Missing fields');
      if (processedIPNs.has(tran_id)) return res.status(200).send('OK');

      const txn = await getTransaction(tran_id);
      if (!txn) return res.status(404).send('Not found');
      if (txn.status === 'success') {
        processedIPNs.add(tran_id);
        return res.status(200).send('OK');
      }

      try {
        const valRes = await axios.get(SSL.validationUrl, {
          params: {
            val_id,
            store_id: SSL.storeId,
            store_passwd: SSL.storePassword,
            format: 'json'
          },
          timeout: 15000,
        });
        const vd = valRes.data;

        if (vd.status === 'VALID' || vd.status === 'VALIDATED') {
          if (risk_level === '1') {
            await updateTransaction(tran_id, {
              status: 'validating',
              validationId: val_id,
              paymentMethod: card_type,
              bankTransactionId: bank_tran_id,
              riskLevel: risk_level,
              needsManualReview: true
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
            
            const freshTxn = await getTransaction(tran_id);
            if (freshTxn) {
              const enrollResult = await createEnrollment({
                ...freshTxn,
                paymentMethod: card_type,
                validationId: val_id,
                bankTransactionId: bank_tran_id
              });
              console.log('IPN enrollment result:', enrollResult);
              
              if (freshTxn.returnToken === undefined) {
                try {
                  await freshTxn.ref.update(sanitizeForFirestore({
                    returnToken: generateReturnToken(),
                    returnTokenIssuedAt: admin.firestore.FieldValue.serverTimestamp(),
                    returnTokenIssuedByIPN: true
                  }));
                } catch (_) {}
              }
            }
          }
        } else {
          await updateTransaction(tran_id, {
            status: vd.status === 'CANCELLED' ? 'cancelled' : 'failed'
          });
        }

        processedIPNs.add(tran_id);
        return res.status(200).send('OK');
      } catch (e: any) {
        console.error('IPN error:', e.message);
        return res.status(500).send('Error');
      }
    }

    if (action === 'validate' && req.method === 'POST') {
      const { transactionId } = req.body || {};
      if (!transactionId) {
        return res.status(400).json({
          success: false,
          error: 'transactionId required'
        });
      }
      
      const txn = await getTransaction(transactionId);
      if (!txn) {
        return res.status(404).json({
          success: false,
          error: 'Not found'
        });
      }
      
      return res.status(200).json({
        success: true,
        status: txn.status,
        validated: txn.status === 'success',
        transaction: txn
      });
    }

    return res.status(404).json({
      success: false,
      error: `Unknown action: ${action}`,
      availableActions: ['initiate', 'callback', 'ipn', 'validate']
    });

  } catch (e: any) {
    console.error('💥 FATAL:', e.message, e.stack);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: e.message,
      userMessage: 'Unexpected error. Contact support.'
    });
  }
}
