// api/payment.ts
// SSLCOMMERZ Payment API Routes - Production Grade

import express, { Request, Response } from 'express';
import axios from 'axios';
import admin from '../config/firebase-admin';

const router = express.Router();
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

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';

// In-memory set to track processed IPNs (use Redis in production)
const processedIPNs = new Set<string>();

// IPN processing queue (prevents race conditions)
const ipnProcessingQueue = new Map<string, Promise<any>>();

// ==================== VALIDATION HELPERS ====================

/**
 * Validate payment request
 */
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
    return { valid: false, error: `Missing required fields: ${missing.join(', ')}` };
  }

  if (typeof data.amount !== 'number' || data.amount < 0) {
    return { valid: false, error: 'Amount must be a non-negative number' };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(data.userEmail)) {
    return { valid: false, error: 'Invalid email address' };
  }

  if (!['course', 'content', 'subscription'].includes(data.productType)) {
    return { valid: false, error: 'Invalid product type' };
  }

  return { valid: true };
}

/**
 * Validate SSLCOMMERZ configuration
 */
function validateSSLConfig(): { valid: boolean; error?: string } {
  if (!SSLCOMMERZ_CONFIG.storeId || !SSLCOMMERZ_CONFIG.storePassword) {
    return { 
      valid: false, 
      error: 'SSLCOMMERZ credentials not configured. Please set SSLCOMMERZ_STORE_ID and SSLCOMMERZ_STORE_PASSWORD environment variables.' 
    };
  }
  return { valid: true };
}

// ==================== TRANSACTION HELPERS ====================

/**
 * Get transaction from Firestore
 */
async function getTransaction(transactionId: string) {
  try {
    const snapshot = await db.collection('transactions')
      .where('transactionId', '==', transactionId)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0];
    return {
      id: doc.id,
      ref: doc.ref,
      ...doc.data()
    };
  } catch (error) {
    console.error('Error getting transaction:', error);
    return null;
  }
}

/**
 * Update transaction in Firestore
 */
async function updateTransaction(transactionId: string, updates: any) {
  try {
    const transaction = await getTransaction(transactionId);

    if (!transaction) {
      console.error('Transaction not found:', transactionId);
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

// ==================== ENROLLMENT HELPERS ====================

/**
 * Create enrollment after successful payment
 */
async function createEnrollment(transaction: any) {
  try {
    if (transaction.productType !== 'course') {
      console.log('Not a course enrollment, skipping enrollment creation');
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
      console.log('Enrollment already exists, skipping creation');
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
      console.error('Error updating course student count:', error);
    }

    // Add course to student's content library
    try {
      await addCourseToLibrary(transaction.productId, transaction.userId);
    } catch (error) {
      console.error('Error adding course to library:', error);
    }

    return enrollmentRef.id;
  } catch (error) {
    console.error('Error creating enrollment:', error);
    throw error;
  }
}

/**
 * Add course to student's content library
 */
async function addCourseToLibrary(courseId: string, studentId: string) {
  try {
    console.log('Adding course to library:', { courseId, studentId });

    const courseDoc = await db.collection('courses').doc(courseId).get();
    
    if (!courseDoc.exists) {
      throw new Error('Course not found');
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
      console.log('Course already in library, skipping');
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
    console.log('Course added to student library');
  } catch (error) {
    console.error('Error adding course to library:', error);
    throw error;
  }
}

// ==================== ROUTES ====================

/**
 * POST /api/payment/initiate
 * Initiate payment with SSLCOMMERZ
 */
router.post('/initiate', async (req: Request, res: Response) => {
  try {
    console.log('=== Payment Initiation Request ===');
    console.log('Body:', JSON.stringify(req.body, null, 2));

    // Validate SSLCOMMERZ configuration
    const configValidation = validateSSLConfig();
    if (!configValidation.valid) {
      return res.status(500).json({
        success: false,
        error: configValidation.error
      });
    }

    // Validate request
    const validation = validatePaymentRequest(req.body);
    if (!validation.valid) {
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

    // Prepare SSLCOMMERZ payment data
    const paymentData = {
      store_id: SSLCOMMERZ_CONFIG.storeId,
      store_passwd: SSLCOMMERZ_CONFIG.storePassword,
      total_amount: parseFloat(amount.toFixed(2)),
      currency: 'BDT',
      tran_id: transactionId,
      
      success_url: `${FRONTEND_URL}/course-enrollment?status=success&tran_id=${transactionId}`,
      fail_url: `${FRONTEND_URL}/course-enrollment?status=failed&tran_id=${transactionId}`,
      cancel_url: `${FRONTEND_URL}/course-enrollment?status=cancel&tran_id=${transactionId}`,
      ipn_url: `${BACKEND_URL}/api/payment/ipn`,

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

    console.log('Calling SSLCOMMERZ Session API...');
    console.log('Session URL:', SSLCOMMERZ_CONFIG.sessionUrl);

    // Call SSLCOMMERZ Session API
    const response = await axios.post(
      SSLCOMMERZ_CONFIG.sessionUrl,
      new URLSearchParams(paymentData as any).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 30000
      }
    );

    console.log('SSLCOMMERZ Response Status:', response.data.status);
    console.log('SSLCOMMERZ Response:', JSON.stringify(response.data, null, 2));

    if (response.data.status === 'SUCCESS') {
      return res.json({
        success: true,
        gatewayUrl: response.data.GatewayPageURL,
        gatewayTransactionId: response.data.sessionkey,
        transactionId: transactionId
      });
    } else {
      console.error('SSLCOMMERZ Error:', response.data);
      
      // Update transaction as failed
      await updateTransaction(transactionId, {
        status: 'failed',
        metadata: { 
          error: response.data.failedreason || 'Payment initiation failed',
          sslcommerzResponse: response.data,
          timestamp: new Date().toISOString()
        }
      });

      return res.status(400).json({
        success: false,
        error: response.data.failedreason || 'Failed to initiate payment with SSLCOMMERZ'
      });
    }
  } catch (error: any) {
    console.error('Payment Initiation Error:', error);
    
    // Handle axios errors
    if (error.response) {
      console.error('Response Error:', error.response.data);
      return res.status(500).json({
        success: false,
        error: 'SSLCOMMERZ service error. Please try again.'
      });
    }
    
    if (error.code === 'ECONNABORTED') {
      return res.status(504).json({
        success: false,
        error: 'Gateway timeout. Please try again.'
      });
    }
    
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
});

/**
 * POST /api/payment/ipn
 * Handle IPN (Instant Payment Notification) from SSLCOMMERZ
 */
router.post('/ipn', async (req: Request, res: Response) => {
  try {
    console.log('=== IPN Received ===');
    console.log('Body:', JSON.stringify(req.body, null, 2));

    const {
      tran_id,
      val_id,
      amount,
      card_type,
      bank_tran_id,
      status,
      risk_level,
      risk_title
    } = req.body;

    if (!tran_id || !val_id) {
      console.error('Missing required IPN fields');
      return res.status(400).send('Missing required fields');
    }

    // Check if already processing this IPN
    if (ipnProcessingQueue.has(tran_id)) {
      console.log('IPN already being processed:', tran_id);
      return res.status(200).send('Processing');
    }

    // Check if already processed
    if (processedIPNs.has(tran_id)) {
      console.log('IPN already processed:', tran_id);
      return res.status(200).send('OK');
    }

    // Create processing promise
    const processingPromise = (async () => {
      try {
        // Get transaction
        const transaction = await getTransaction(tran_id);
        
        if (!transaction) {
          console.error('Transaction not found:', tran_id);
          return { success: false, error: 'Transaction not found' };
        }

        console.log('Current transaction status:', transaction.status);

        // Skip if already completed
        if (transaction.status === 'success') {
          console.log('Transaction already completed');
          processedIPNs.add(tran_id);
          return { success: true, message: 'Already completed' };
        }

        // Validate with SSLCOMMERZ
        console.log('Validating with SSLCOMMERZ...');
        console.log('Validation URL:', SSLCOMMERZ_CONFIG.validationUrl);
        
        const validationResponse = await axios.get(
          SSLCOMMERZ_CONFIG.validationUrl,
          {
            params: {
              val_id: val_id,
              store_id: SSLCOMMERZ_CONFIG.storeId,
              store_passwd: SSLCOMMERZ_CONFIG.storePassword,
              format: 'json'
            },
            timeout: 30000
          }
        );

        const validationData = validationResponse.data;
        console.log('Validation Status:', validationData.status);
        console.log('Validation Data:', JSON.stringify(validationData, null, 2));

        // Handle validation response
        if (validationData.status === 'VALID' || validationData.status === 'VALIDATED') {
          // Check risk level
          if (risk_level === '1') {
            console.warn('High risk transaction detected:', tran_id);
            
            await updateTransaction(tran_id, {
              status: 'validating',
              validationId: val_id,
              paymentMethod: card_type,
              bankTransactionId: bank_tran_id,
              riskLevel: risk_level,
              metadata: {
                riskTitle: risk_title,
                validationData: validationData,
                needsManualReview: true,
                timestamp: new Date().toISOString()
              }
            });

            processedIPNs.add(tran_id);
            return { success: true, message: 'Payment held for verification' };
          }

          // Payment validated - update transaction
          await updateTransaction(tran_id, {
            status: 'success',
            validationId: val_id,
            paymentMethod: card_type,
            bankTransactionId: bank_tran_id,
            riskLevel: risk_level || '0',
            completedAt: admin.firestore.FieldValue.serverTimestamp()
          });

          // Create enrollment
          try {
            const enrollmentId = await createEnrollment({
              ...transaction,
              paymentMethod: card_type,
              validationId: val_id,
              bankTransactionId: bank_tran_id
            });
            
            console.log('Enrollment created successfully:', enrollmentId);
            
            // Update transaction with enrollment ID
            await updateTransaction(tran_id, {
              metadata: {
                ...(transaction.metadata || {}),
                enrollmentId: enrollmentId,
                enrollmentCreated: true
              }
            });
          } catch (enrollmentError: any) {
            console.error('Enrollment creation failed:', enrollmentError);
            
            await updateTransaction(tran_id, {
              metadata: {
                ...(transaction.metadata || {}),
                enrollmentError: enrollmentError.message,
                enrollmentCreated: false
              }
            });
          }

          processedIPNs.add(tran_id);
          return { success: true, message: 'Payment validated and processed' };

        } else if (validationData.status === 'FAILED') {
          console.log('Payment failed:', tran_id);
          
          await updateTransaction(tran_id, {
            status: 'failed',
            metadata: {
              failureReason: validationData.failedreason || 'Payment failed',
              validationData: validationData,
              timestamp: new Date().toISOString()
            }
          });
          
          processedIPNs.add(tran_id);
          return { success: true, message: 'Payment failed' };

        } else if (validationData.status === 'CANCELLED') {
          console.log('Payment cancelled:', tran_id);
          
          await updateTransaction(tran_id, {
            status: 'cancelled',
            metadata: {
              cancelled: true,
              validationData: validationData,
              timestamp: new Date().toISOString()
            }
          });
          
          processedIPNs.add(tran_id);
          return { success: true, message: 'Payment cancelled' };

        } else {
          console.error('Unknown validation status:', validationData.status);
          
          await updateTransaction(tran_id, {
            status: 'failed',
            metadata: {
              unknownStatus: validationData.status,
              validationData: validationData,
              timestamp: new Date().toISOString()
            }
          });
          
          return { success: false, message: 'Unknown status' };
        }
      } finally {
        // Remove from processing queue
        ipnProcessingQueue.delete(tran_id);
      }
    })();

    // Add to processing queue
    ipnProcessingQueue.set(tran_id, processingPromise);

    // Wait for processing to complete
    const result = await processingPromise;
    
    return res.status(200).send(result.message || 'OK');

  } catch (error: any) {
    console.error('IPN Processing Error:', error);
    
    // Remove from processing queue on error
    if (req.body.tran_id) {
      ipnProcessingQueue.delete(req.body.tran_id);
    }
    
    return res.status(500).send('Internal server error');
  }
});

/**
 * POST /api/payment/validate
 * Validate payment status (called by frontend)
 */
router.post('/validate', async (req: Request, res: Response) => {
  try {
    const { transactionId } = req.body;

    console.log('Validating payment for frontend:', transactionId);

    if (!transactionId) {
      return res.status(400).json({
        success: false,
        error: 'Transaction ID is required'
      });
    }

    const transaction = await getTransaction(transactionId);
    
    if (!transaction) {
      return res.status(404).json({
        success: false,
        error: 'Transaction not found'
      });
    }

    return res.json({
      success: true,
      status: transaction.status,
      validated: transaction.status === 'success',
      transaction: transaction
    });
  } catch (error: any) {
    console.error('Validation Query Error:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/payment/status/:transactionId
 * Get transaction status (for admin/debugging)
 */
router.get('/status/:transactionId', async (req: Request, res: Response) => {
  try {
    const { transactionId } = req.params;
    
    console.log('Getting transaction status:', transactionId);
    
    const transaction = await getTransaction(transactionId);
    
    if (!transaction) {
      return res.status(404).json({
        success: false,
        error: 'Transaction not found'
      });
    }

    return res.json({
      success: true,
      transaction
    });
  } catch (error: any) {
    console.error('Status Query Error:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/payment/webhook
 * Alternative webhook endpoint (some gateways use this)
 */
router.post('/webhook', async (req: Request, res: Response) => {
  // Forward to IPN handler
  return router.post('/ipn')(req, res);
});

export default router;
