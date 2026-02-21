// src/services/paymentService.ts

import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp
} from 'firebase/firestore';
import { db } from '../config/firebase';
import axios from 'axios';

// Get backend URL from current window location
const BACKEND_URL =
  typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

console.log('💳 PaymentService initialized');
console.log('🌐 Backend URL:', BACKEND_URL);

// ==================== INTERFACES ====================

export interface Transaction {
  id: string;
  userId: string;
  userName: string;
  userEmail: string; // May be a placeholder when user has no email
  amount: number;
  currency: string;
  status: 'success' | 'failed' | 'pending' | 'validating' | 'refunded' | 'cancelled';
  gateway: string;
  productName: string;
  productId: string;
  productType: 'course' | 'content' | 'subscription';
  transactionId: string;
  gatewayTransactionId?: string;
  validationId?: string;
  bankTransactionId?: string;
  paymentMethod?: string;
  riskLevel?: string;
  appliedDiscounts?: {
    previousStudentDiscount?: number;
    extraDiscount?: number;
    couponDiscount?: number;
  };
  metadata?: any;
  createdAt: Date;
  updatedAt?: Date;
  completedAt?: Date;
}

export interface PaymentInitiationRequest {
  userId: string;
  userName: string;
  userEmail?: string; // OPTIONAL — not required by the user system
  amount: number;
  productId: string;
  productName: string;
  productType: 'course' | 'content' | 'subscription';
  appliedDiscounts?: {
    previousStudentDiscount?: number;
    extraDiscount?: number;
    couponDiscount?: number;
  };
  metadata?: any;
}

export interface PaymentInitiationResponse {
  success: boolean;
  gatewayUrl?: string;
  transactionId?: string;
  sessionId?: string;
  error?: string;
  details?: string;
  userMessage?: string;
}

export interface PaymentValidationResponse {
  success: boolean;
  status?: string;
  validated?: boolean;
  transaction?: Transaction;
  error?: string;
  details?: string;
  userMessage?: string;
}

// ==================== FIRESTORE SANITIZER ====================
// Firestore rejects documents that contain `undefined` anywhere in the object tree
// (including nested objects like metadata.couponId).
// This function recursively removes every undefined key so all writes are safe.

function sanitizeForFirestore(value: any): any {
  // Undefined at the top level becomes null (caller decides whether to include key)
  if (value === undefined) return null;
  if (value === null) return null;

  // Leave Timestamps and Dates intact
  if (value instanceof Date) return value;
  if (value && typeof value === 'object' && typeof value.toDate === 'function') {
    return value; // Firestore Timestamp — keep as-is
  }

  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== undefined)
      .map((item) => sanitizeForFirestore(item));
  }

  if (typeof value === 'object') {
    const clean: Record<string, any> = {};
    for (const key of Object.keys(value)) {
      if (value[key] === undefined) continue; // drop the key entirely
      clean[key] = sanitizeForFirestore(value[key]);
    }
    return clean;
  }

  // Primitives (string, number, boolean) — safe as-is
  return value;
}

// ==================== TIMESTAMP HELPER ====================
// Safely converts any Firestore timestamp variant to a JS Date.
// Handles: Firestore Timestamp, plain {seconds,nanoseconds} objects,
// already-Date values, ISO strings, and Unix epoch numbers.
// Returns undefined (not null) so optional Date fields stay optional.

function safeToDate(value: any): Date | undefined {
  if (!value) return undefined;

  // Already a real JS Date
  if (value instanceof Date) return isNaN(value.getTime()) ? undefined : value;

  // Firestore Timestamp instance (has .toDate())
  if (typeof value.toDate === 'function') {
    try { return value.toDate(); } catch { return undefined; }
  }

  // Plain Firestore-like object: { seconds: number, nanoseconds: number }
  if (typeof value === 'object' && typeof value.seconds === 'number') {
    return new Date(value.seconds * 1000);
  }

  // ISO string or numeric timestamp
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    return isNaN(d.getTime()) ? undefined : d;
  }

  return undefined;
}

// ==================== ERROR DISPLAY HELPER ====================

function displayError(error: string, details?: string): void {
  console.error('');
  console.error('🚨 PAYMENT ERROR 🚨');
  console.error('═'.repeat(80));
  console.error('Error:', error);
  if (details) console.error('Details:', details);
  console.error('Timestamp:', new Date().toISOString());
  console.error('═'.repeat(80));
  console.error('');

  if (typeof window !== 'undefined') {
    try {
      const existing = document.getElementById('payment-error-toast');
      if (existing) existing.remove();

      const errorDiv = document.createElement('div');
      errorDiv.id = 'payment-error-toast';
      errorDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #dc2626;
        color: white;
        padding: 16px 24px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 999999;
        max-width: 400px;
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 14px;
        line-height: 1.5;
        word-wrap: break-word;
      `;
      errorDiv.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 4px;">⚠️ Payment Error</div>
        <div>${escapeHtml(error)}</div>
        ${details ? `<div style="margin-top: 8px; font-size: 12px; opacity: 0.9;">${escapeHtml(details)}</div>` : ''}
      `;
      document.body.appendChild(errorDiv);
      setTimeout(() => errorDiv.remove(), 10000);
    } catch (e) {
      console.error('Could not display error UI:', e);
    }
  }
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ==================== EMAIL HELPER ====================
// SSLCOMMERZ requires a cus_email value. Since our user system does not mandate
// email, we generate a safe deterministic placeholder when none exists.

function resolveEmail(userId: string, userEmail?: string): string {
  if (
    userEmail &&
    userEmail.trim() &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userEmail.trim())
  ) {
    return userEmail.trim();
  }
  const safeId =
    String(userId)
      .replace(/[^a-zA-Z0-9]/g, '')
      .substring(0, 20) || 'user';
  return `${safeId}@noemail.local`;
}

// ==================== PAYMENT SERVICE ====================

export const paymentService = {
  // ==================== PAYMENT INITIATION ====================

  async initiatePayment(
    request: PaymentInitiationRequest
  ): Promise<PaymentInitiationResponse> {
    console.log('');
    console.log('='.repeat(80));
    console.log('💳 PAYMENT SERVICE: Initiating Payment');
    console.log('='.repeat(80));
    console.log('Timestamp:', new Date().toISOString());
    console.log('User ID:', request.userId);
    console.log('Product ID:', request.productId);
    console.log('Product Name:', request.productName);
    console.log('Amount:', request.amount);
    console.log('Product Type:', request.productType);
    console.log('='.repeat(80));

    try {
      // Step 1: Validate request
      console.log('📋 Step 1: Validating request...');
      const validation = this.validatePaymentRequest(request);
      if (!validation.valid) {
        console.error('❌ Validation failed:', validation.error);
        displayError('Invalid Payment Request', validation.error);
        return {
          success: false,
          error: 'Invalid payment request',
          details: validation.error,
          userMessage:
            validation.error || 'Please check your payment details and try again.'
        };
      }
      console.log('✅ Request validated');

      // Step 2: Resolve email (placeholder if user has none)
      const resolvedEmail = resolveEmail(request.userId, request.userEmail);
      console.log('📋 Step 2: Resolved email:', resolvedEmail);

      // Step 3: Generate transaction ID
      console.log('📋 Step 3: Generating transaction ID...');
      const transactionId = this.generateTransactionId(request.productId, request.userId);
      console.log('✅ Transaction ID:', transactionId);

      // Step 4: Create Firestore record — always sanitized
      console.log('📋 Step 4: Creating Firestore transaction...');
      try {
        const firestoreId = await this.createTransaction({
          transactionId,
          userId: request.userId,
          userName: request.userName,
          userEmail: resolvedEmail,
          amount: request.amount,
          currency: 'BDT',
          gateway: 'SSLCOMMERZ',
          productName: request.productName,
          productId: request.productId,
          productType: request.productType,
          status: 'pending',
          // These two are the common sources of undefined — sanitized in createTransaction
          appliedDiscounts: request.appliedDiscounts,
          metadata: request.metadata
        });
        console.log('✅ Firestore record created:', firestoreId);
      } catch (firestoreError: any) {
        console.error('❌ Firestore error:', firestoreError.message);
        console.error('Stack:', firestoreError.stack);
        displayError('Database Error', 'Failed to create payment record. Please try again.');
        return {
          success: false,
          error: 'Database error',
          details: `Failed to create transaction record: ${firestoreError.message}`,
          userMessage: 'Failed to create payment record. Please try again.'
        };
      }

      // Step 5: Call backend API
      console.log('📋 Step 5: Calling backend API...');
      const apiUrl = `${BACKEND_URL}/api/payment?action=initiate`;
      console.log('API URL:', apiUrl);

      // Sanitize payload before sending — prevents JSON serialisation issues too
      const payload = sanitizeForFirestore({
        transactionId,
        userId: request.userId,
        userName: request.userName,
        userEmail: resolvedEmail,
        amount: request.amount,
        productId: request.productId,
        productName: request.productName,
        productType: request.productType,
        appliedDiscounts: request.appliedDiscounts || {},
        metadata: request.metadata || {}
      });

      console.log('Payload:', JSON.stringify(payload, null, 2));

      try {
        const response = await axios.post(apiUrl, payload, {
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          timeout: 30000
        });

        console.log('📥 Backend response received');
        console.log('Success:', response.data.success);
        console.log('Response:', JSON.stringify(response.data, null, 2));

        if (response.data.success) {
          console.log('✅ Payment initiation successful');
          console.log('Gateway URL:', response.data.gatewayUrl);

          try {
            await this.updateTransactionByTranId(transactionId, {
              gatewayTransactionId: response.data.gatewayTransactionId,
              status: 'pending'
            });
            console.log('✅ Transaction updated with gateway session');
          } catch (updateError: any) {
            console.warn('⚠️ Failed to update transaction:', updateError.message);
          }

          return {
            success: true,
            gatewayUrl: response.data.gatewayUrl,
            transactionId,
            sessionId: response.data.gatewayTransactionId,
            userMessage: 'Redirecting to payment gateway...'
          };
        } else {
          const errorMsg = response.data.error || 'Payment initiation failed';
          const detailsMsg =
            response.data.details ||
            response.data.userMessage ||
            'Backend rejected the payment request';

          console.error('❌ Backend returned error:', errorMsg);
          console.error('Details:', detailsMsg);
          displayError(errorMsg, detailsMsg);

          try {
            await this.updateTransactionByTranId(transactionId, {
              status: 'failed',
              metadata: { error: errorMsg, details: detailsMsg, timestamp: new Date().toISOString() }
            });
          } catch (updateError) {
            console.warn('⚠️ Failed to update failed transaction');
          }

          return {
            success: false,
            error: errorMsg,
            details: detailsMsg,
            userMessage: response.data.userMessage || detailsMsg
          };
        }
      } catch (axiosError: any) {
        console.error('');
        console.error('💥 AXIOS ERROR');
        console.error('='.repeat(80));
        console.error('Timestamp:', new Date().toISOString());
        console.error('Message:', axiosError.message);
        console.error('Code:', axiosError.code);
        console.error('URL:', apiUrl);
        if (axiosError.response) {
          console.error('Response Status:', axiosError.response.status);
          console.error('Response Data:', JSON.stringify(axiosError.response.data, null, 2));
        } else if (axiosError.request) {
          console.error('No response received');
        }
        console.error('='.repeat(80));

        let userMessage = 'An unexpected error occurred. Please try again.';
        let errorType = 'Payment initiation failed';
        let errorDetails = axiosError.message;

        if (axiosError.code === 'ECONNABORTED') {
          userMessage = 'The payment gateway is taking too long to respond. Please try again.';
          errorType = 'Request timeout';
          errorDetails = 'Connection to payment gateway timed out';
        } else if (axiosError.code === 'ERR_NETWORK') {
          userMessage =
            'Unable to connect to payment gateway. Please check your internet connection.';
          errorType = 'Network error';
          errorDetails = 'Failed to establish connection';
        } else if (axiosError.response) {
          const rd = axiosError.response.data;
          errorType = rd?.error || 'Server error';
          errorDetails = rd?.details || rd?.userMessage || axiosError.message;
          userMessage = rd?.userMessage || errorDetails;
        }

        displayError(errorType, errorDetails);

        return { success: false, error: errorType, details: errorDetails, userMessage };
      }
    } catch (error: any) {
      console.error('');
      console.error('💥 UNEXPECTED ERROR');
      console.error('='.repeat(80));
      console.error('Timestamp:', new Date().toISOString());
      console.error('Message:', error.message);
      console.error('Stack:', error.stack);
      console.error('='.repeat(80));

      displayError('Unexpected Error', error.message);

      return {
        success: false,
        error: 'Unexpected error',
        details: error.message || 'An unexpected error occurred during payment initiation',
        userMessage: 'An unexpected error occurred. Please contact support.'
      };
    }
  },

  // ==================== PAYMENT VALIDATION ====================

  async validatePayment(transactionId: string): Promise<PaymentValidationResponse> {
    console.log('');
    console.log('🔍 Validating payment:', transactionId);
    console.log('Timestamp:', new Date().toISOString());

    try {
      if (!transactionId || !transactionId.trim()) {
        displayError('Invalid Transaction ID', 'Transaction ID is required');
        return {
          success: false,
          error: 'Invalid transaction ID',
          details: 'Transaction ID is required for validation',
          userMessage: 'Invalid payment reference. Please try again.'
        };
      }

      const transaction = await this.getTransactionByTranId(transactionId);

      if (!transaction) {
        console.error('❌ Transaction not found');
        displayError('Transaction Not Found', 'No payment record exists');
        return {
          success: false,
          error: 'Transaction not found',
          details: 'No transaction record found for this ID',
          userMessage: 'Payment record not found. Please contact support.'
        };
      }

      console.log('Current status:', transaction.status);

      if (transaction.status === 'success') {
        console.log('✅ Already validated');
        return {
          success: true,
          status: 'success',
          validated: true,
          transaction,
          userMessage: 'Payment verified successfully'
        };
      }

      if (transaction.status === 'failed' || transaction.status === 'cancelled') {
        const msg = `Payment ${transaction.status}`;
        displayError(msg, `This payment was ${transaction.status}`);
        return {
          success: false,
          status: transaction.status,
          validated: false,
          transaction,
          error: msg,
          details: `This payment was ${transaction.status}`,
          userMessage: `Payment ${transaction.status}. Please try again or contact support.`
        };
      }

      console.log('📞 Calling backend validate API...');

      try {
        const response = await axios.post(
          `${BACKEND_URL}/api/payment?action=validate`,
          { transactionId },
          {
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            timeout: 30000
          }
        );

        console.log('📥 Validation response:', response.data);

        if (response.data.success) {
          return {
            success: true,
            status: response.data.status,
            validated: response.data.validated,
            transaction: response.data.transaction || transaction,
            userMessage: response.data.validated
              ? 'Payment verified successfully'
              : 'Payment is being processed'
          };
        } else {
          const errorMsg = response.data.error || 'Validation failed';
          displayError(errorMsg, response.data.details);
          return {
            success: false,
            error: errorMsg,
            status: transaction.status,
            transaction,
            details: response.data.details || 'Unable to validate payment status',
            userMessage:
              response.data.userMessage || 'Unable to verify payment. Please contact support.'
          };
        }
      } catch (axiosError: any) {
        console.error('❌ Validation API error:', axiosError.message);

        let userMessage = 'Unable to verify payment. Please contact support.';
        let errorDetails = axiosError.message;

        if (axiosError.code === 'ECONNABORTED') {
          userMessage = 'Payment verification is taking too long. Please try again.';
          errorDetails = 'Validation request timed out';
        }

        displayError('Validation Error', errorDetails);

        return {
          success: false,
          error: 'Network error',
          details: errorDetails,
          transaction,
          userMessage
        };
      }
    } catch (error: any) {
      console.error('❌ Validation error:', error.message);
      console.error('Stack:', error.stack);
      displayError('Validation Failed', error.message);
      return {
        success: false,
        error: 'Validation failed',
        details: error.message || 'An unexpected error occurred during validation',
        userMessage: 'Unable to verify payment. Please contact support.'
      };
    }
  },

  // ==================== VALIDATION HELPERS ====================

  validatePaymentRequest(request: PaymentInitiationRequest): {
    valid: boolean;
    error?: string;
  } {
    if (!request.userId || !request.userId.trim()) {
      return { valid: false, error: 'User ID is required' };
    }

    if (!request.userName || !request.userName.trim()) {
      return { valid: false, error: 'User name is required' };
    }

    // userEmail is OPTIONAL. Validate format only if a value is supplied.
    if (request.userEmail && request.userEmail.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(request.userEmail.trim())) {
        return { valid: false, error: 'Invalid email address format' };
      }
    }

    if (!request.productId || !request.productId.trim()) {
      return { valid: false, error: 'Product ID is required' };
    }

    if (!request.productName || !request.productName.trim()) {
      return { valid: false, error: 'Product name is required' };
    }

    if (typeof request.amount !== 'number' || request.amount < 0) {
      return { valid: false, error: 'Amount must be a non-negative number' };
    }

    if (!['course', 'content', 'subscription'].includes(request.productType)) {
      return { valid: false, error: 'Invalid product type' };
    }

    return { valid: true };
  },

  generateTransactionId(productId: string, userId: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    const userPart = userId.substring(0, 8).toUpperCase();
    const productPart = productId.substring(0, 8).toUpperCase();
    return `TXN_${productPart}_${userPart}_${timestamp}_${random}`;
  },

  // ==================== TRANSACTION MANAGEMENT ====================

  async createTransaction(data: Omit<Transaction, 'id' | 'createdAt'>): Promise<string> {
    try {
      // Merge in the server timestamp then sanitize the entire document.
      // sanitizeForFirestore removes EVERY undefined value in the tree —
      // this is the fix for "Unsupported field value: undefined" errors.
      const rawData = {
        ...data,
        createdAt: Timestamp.now()
      };

      const transactionData = sanitizeForFirestore(rawData);

      const docRef = await addDoc(collection(db, 'transactions'), transactionData);
      return docRef.id;
    } catch (error: any) {
      console.error('❌ Error creating transaction:', error.message);
      console.error('Stack:', error.stack);
      throw new Error(`Failed to create transaction: ${error.message}`);
    }
  },

  async getTransactionByTranId(transactionId: string): Promise<Transaction | null> {
    try {
      const q = query(
        collection(db, 'transactions'),
        where('transactionId', '==', transactionId)
      );
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const docSnap = snapshot.docs[0];
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          createdAt: safeToDate(data.createdAt) ?? new Date(),
          updatedAt: safeToDate(data.updatedAt),
          completedAt: safeToDate(data.completedAt)
        } as Transaction;
      }

      return null;
    } catch (error: any) {
      console.error('❌ Error getting transaction:', error.message);
      console.error('Stack:', error.stack);
      throw new Error(`Failed to get transaction: ${error.message}`);
    }
  },

  async updateTransactionByTranId(
    transactionId: string,
    updates: Partial<Transaction>
  ): Promise<void> {
    try {
      const transaction = await this.getTransactionByTranId(transactionId);

      if (!transaction) {
        throw new Error(`Transaction not found: ${transactionId}`);
      }

      const transactionRef = doc(db, 'transactions', transaction.id);

      // Remove fields that must never be overwritten
      const raw: any = { ...updates };
      delete raw.id;
      delete raw.createdAt;
      delete raw.transactionId;
      delete raw.userId;

      // Always sanitize before writing
      const cleanUpdates = sanitizeForFirestore({
        ...raw,
        updatedAt: Timestamp.now()
      });

      await updateDoc(transactionRef, cleanUpdates);
    } catch (error: any) {
      console.error('❌ Error updating transaction:', error.message);
      console.error('Stack:', error.stack);
      throw new Error(`Failed to update transaction: ${error.message}`);
    }
  },

  async getAllTransactions(): Promise<Transaction[]> {
    try {
      const snapshot = await getDocs(
        query(collection(db, 'transactions'), orderBy('createdAt', 'desc'))
      );

      return snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          createdAt: safeToDate(data.createdAt) ?? new Date(),
          updatedAt: safeToDate(data.updatedAt),
          completedAt: safeToDate(data.completedAt)
        } as Transaction;
      });
    } catch (error: any) {
      console.error('❌ Error getting all transactions:', error.message);
      console.error('Stack:', error.stack);
      throw new Error(`Failed to get transactions: ${error.message}`);
    }
  },

  async getUserTransactions(userId: string): Promise<Transaction[]> {
    try {
      if (!userId || !userId.trim()) {
        throw new Error('User ID is required');
      }

      const q = query(
        collection(db, 'transactions'),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);

      return snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          createdAt: safeToDate(data.createdAt) ?? new Date(),
          updatedAt: safeToDate(data.updatedAt),
          completedAt: safeToDate(data.completedAt)
        } as Transaction;
      });
    } catch (error: any) {
      console.error('❌ Error getting user transactions:', error.message);
      console.error('Stack:', error.stack);
      throw new Error(`Failed to get user transactions: ${error.message}`);
    }
  }
};

export default paymentService;
