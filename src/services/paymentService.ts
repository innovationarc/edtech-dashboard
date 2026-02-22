// src/services/paymentService.ts

import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
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
  userEmail: string;
  userPhone?: string;
  amount: number;
  basePrice?: number;
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
    couponCode?: string;
  };
  metadata?: any;
  createdAt: Date;
  updatedAt?: Date;
  completedAt?: Date;
}

export interface PaymentInitiationRequest {
  userId: string;
  userName: string;
  userEmail?: string;
  amount: number;
  productId: string;
  productName: string;
  productType: 'course' | 'content' | 'subscription';
  appliedDiscounts?: {
    previousStudentDiscount?: number;
    extraDiscount?: number;
    couponDiscount?: number;
    couponCode?: string;
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

// ── NEW: Audit Log types ──────────────────────────────────────────────────────

export type AuditAction =
  | 'status_changed'
  | 'transaction_deleted'
  | 'transaction_moved_to_trash'
  | 'transaction_restored_from_trash'
  | 'transaction_purged'
  | 'transaction_viewed'
  | 'transaction_created'
  | 'transaction_updated';

export interface AuditLogChange {
  field: string;
  oldValue: any;
  newValue: any;
}

export interface AuditLog {
  id: string;
  transactionId: string;       // custom TXN_xxx string
  transactionDocId: string;    // Firestore document ID
  action: AuditAction;
  performedBy: string;         // Firebase Auth uid of the actor
  performedByName: string;     // display name at time of action
  performedBySurname?: string; // surname of the actor at time of action
  performedByUserId?: string;  // readable userId (e.g. ST-2601-00001) of the actor
  performedByRole: string;     // role at time of action
  timestamp: Date;
  changes?: AuditLogChange[];
  note?: string;
  reason?: string;             // mandatory reason for status changes / deletions
  snapshotBefore?: Partial<Transaction>;
}

// ── Trash record type ─────────────────────────────────────────────────────────

export interface TrashRecord {
  id: string;                  // Firestore doc ID in paymentTrash collection
  originalDocId: string;       // Original transactions doc ID
  transaction: Transaction;    // Full snapshot of the deleted transaction
  deletedAt: Date;
  deletedBy: string;
  deletedByName: string;
  deletedByRole: string;
  reason: string;
  expiresAt: Date;             // deletedAt + 30 days — auto-purge after this
}

// ── Backwards-compat gateway stub type ───────────────────────────────────────

export interface PaymentGateway {
  id: string;
  name: string;
  status: 'connected' | 'disconnected';
  enabled: boolean;
}

// ==================== FIRESTORE SANITIZER ====================

function sanitizeForFirestore(value: any): any {
  if (value === undefined) return null;
  if (value === null) return null;
  if (value instanceof Date) return value;
  if (value && typeof value === 'object' && typeof value.toDate === 'function') {
    return value;
  }
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== undefined)
      .map((item) => sanitizeForFirestore(item));
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

// ==================== TIMESTAMP HELPER ====================

function safeToDate(value: any): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return isNaN(value.getTime()) ? undefined : value;
  if (typeof value.toDate === 'function') {
    try { return value.toDate(); } catch { return undefined; }
  }
  if (typeof value === 'object' && typeof value.seconds === 'number') {
    return new Date(value.seconds * 1000);
  }
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

  // ── ORIGINAL: Payment Initiation ─────────────────────────────────────────────

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
      console.log('📋 Step 1: Validating request...');
      const validation = this.validatePaymentRequest(request);
      if (!validation.valid) {
        console.error('❌ Validation failed:', validation.error);
        displayError('Invalid Payment Request', validation.error);
        return {
          success: false,
          error: 'Invalid payment request',
          details: validation.error,
          userMessage: validation.error || 'Please check your payment details and try again.'
        };
      }
      console.log('✅ Request validated');

      const resolvedEmail = resolveEmail(request.userId, request.userEmail);
      console.log('📋 Step 2: Resolved email:', resolvedEmail);

      console.log('📋 Step 3: Generating transaction ID...');
      const transactionId = this.generateTransactionId(request.productId, request.userId);
      console.log('✅ Transaction ID:', transactionId);

      console.log('📋 Step 4: Creating Firestore transaction...');
      try {
        const firestoreId = await this.createTransaction({
          transactionId,
          userId: request.userId,
          userName: request.userName,
          userEmail: resolvedEmail,
          amount: request.amount,
          currency: 'BDT',
          status: 'pending',
          gateway: 'SSLCommerz',
          productName: request.productName,
          productId: request.productId,
          productType: request.productType,
          appliedDiscounts: request.appliedDiscounts,
          metadata: request.metadata,
          updatedAt: undefined,
          completedAt: undefined,
        });
        console.log('✅ Firestore transaction created:', firestoreId);
      } catch (fsError: any) {
        console.error('❌ Firestore error:', fsError.message);
        displayError('Database Error', fsError.message);
        return {
          success: false,
          error: 'Failed to create transaction record',
          details: fsError.message,
          userMessage: 'Unable to initiate payment. Please try again.'
        };
      }

      console.log('📋 Step 5: Calling backend payment API...');
      try {
        const response = await axios.post(
          `${BACKEND_URL}/api/payment?action=initiate`,
          {
            transactionId,
            userId: request.userId,
            userName: request.userName,
            userEmail: resolvedEmail,
            amount: request.amount,
            productId: request.productId,
            productName: request.productName,
            productType: request.productType,
          },
          {
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            timeout: 30000
          }
        );

        console.log('📥 Backend response:', response.data);

        if (response.data.success) {
          console.log('✅ Payment initiated. Gateway URL:', response.data.gatewayUrl);
          return {
            success: true,
            gatewayUrl: response.data.gatewayUrl,
            transactionId: response.data.transactionId,
            sessionId: response.data.gatewayTransactionId
          };
        } else {
          const errorMsg = response.data.error || 'Payment initiation failed';
          const userMsg = response.data.userMessage || 'Unable to initiate payment. Please try again.';
          console.error('❌ Backend error:', errorMsg);
          displayError(errorMsg, response.data.details);
          await this.updateTransactionByTranId(transactionId, { status: 'failed' });
          return {
            success: false,
            error: errorMsg,
            details: response.data.details,
            userMessage: userMsg
          };
        }
      } catch (axiosError: any) {
        console.error('❌ Backend API error:', axiosError.message);
        let userMessage = 'Unable to connect to payment gateway. Please try again.';
        let errorDetails = axiosError.message;

        if (axiosError.code === 'ECONNABORTED') {
          userMessage = 'Payment request timed out. Please try again.';
          errorDetails = 'Request timed out after 30 seconds';
        } else if (axiosError.response?.data) {
          userMessage = axiosError.response.data.userMessage || userMessage;
          errorDetails = axiosError.response.data.details || errorDetails;
        }

        displayError('Payment Gateway Error', errorDetails);
        await this.updateTransactionByTranId(transactionId, { status: 'failed' }).catch(() => {});
        return {
          success: false,
          error: 'Gateway connection failed',
          details: errorDetails,
          userMessage
        };
      }
    } catch (error: any) {
      console.error('❌ Unexpected error:', error.message);
      console.error('Stack:', error.stack);
      displayError('Payment Failed', error.message);
      return {
        success: false,
        error: 'Unexpected error',
        details: error.message,
        userMessage: 'An unexpected error occurred. Please try again or contact support.'
      };
    }
  },

  // ── ORIGINAL: Payment Validation ─────────────────────────────────────────────

  async validatePayment(transactionId: string): Promise<PaymentValidationResponse> {
    console.log('');
    console.log('='.repeat(80));
    console.log('🔍 PAYMENT SERVICE: Validating Payment');
    console.log('='.repeat(80));
    console.log('Transaction ID:', transactionId);

    try {
      const transaction = await this.getTransactionByTranId(transactionId);

      if (!transaction) {
        console.error('❌ Transaction not found:', transactionId);
        displayError('Transaction Not Found', `No transaction found with ID: ${transactionId}`);
        return {
          success: false,
          error: 'Transaction not found',
          details: `No transaction found with ID: ${transactionId}`,
          userMessage: 'Transaction not found. Please contact support.'
        };
      }

      console.log('✅ Transaction found. Status:', transaction.status);

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

  // ── ORIGINAL: Validation Helpers ─────────────────────────────────────────────

  validatePaymentRequest(request: PaymentInitiationRequest): { valid: boolean; error?: string } {
    if (!request.userId || !request.userId.trim()) {
      return { valid: false, error: 'User ID is required' };
    }
    if (!request.userName || !request.userName.trim()) {
      return { valid: false, error: 'User name is required' };
    }
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

  // ── ORIGINAL: Transaction CRUD ───────────────────────────────────────────────

  async createTransaction(data: Omit<Transaction, 'id' | 'createdAt'>): Promise<string> {
    try {
      const rawData = { ...data, createdAt: Timestamp.now() };
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
      const raw: any = { ...updates };
      delete raw.id;
      delete raw.createdAt;
      delete raw.transactionId;
      delete raw.userId;

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
  },

  // ── ORIGINAL: Gateway stubs (backwards compat) ───────────────────────────────
  // These were referenced by the old PaymentManagement page. Kept as stubs so any
  // other code that imports them won't break.

  async getAllGateways(): Promise<PaymentGateway[]> {
    // Gateways are managed server-side via env vars — return empty array gracefully.
    return [];
  },

  async updateGateway(_gatewayId: string, _updates: Partial<PaymentGateway>): Promise<void> {
    // No-op stub — gateway config is managed server-side.
    console.log('ℹ️ updateGateway is a no-op: gateways are managed server-side');
  },

  // ── NEW: Delete transaction by Firestore document ID ─────────────────────────
  // Pass txn.id (the Firestore doc ID). Write an audit log BEFORE calling this.

  async deleteTransactionById(docId: string): Promise<void> {
    try {
      if (!docId?.trim()) throw new Error('Document ID is required');
      await deleteDoc(doc(db, 'transactions', docId));
      console.log('✅ Transaction deleted:', docId);
    } catch (error: any) {
      console.error('❌ Error deleting transaction:', error.message);
      throw new Error(`Failed to delete transaction: ${error.message}`);
    }
  },

  // ── NEW: Update status by Firestore document ID ──────────────────────────────
  // Only touches `status` + `updatedAt`. Immutable fields are never modified.

  async updateTransactionStatusById(
    docId: string,
    newStatus: Transaction['status']
  ): Promise<void> {
    try {
      if (!docId?.trim()) throw new Error('Document ID is required');
      await updateDoc(
        doc(db, 'transactions', docId),
        sanitizeForFirestore({ status: newStatus, updatedAt: Timestamp.now() })
      );
      console.log('✅ Status updated:', docId, '→', newStatus);
    } catch (error: any) {
      console.error('❌ Error updating status:', error.message);
      throw new Error(`Failed to update status: ${error.message}`);
    }
  },

  // ── NEW: Fetch readable userId from the users collection ─────────────────────
  // txn.userId stores the Firebase Auth UID. The human-readable ID (e.g. ST-2601-00001)
  // lives in the `userId` field of that user's Firestore document.
  // Returns null on any error — never crashes the UI.

  async getReadableUserId(authUid: string): Promise<string | null> {
    try {
      if (!authUid?.trim()) return null;
      const snap = await getDoc(doc(db, 'users', authUid));
      if (!snap.exists()) return null;
      return (snap.data().userId as string) || null;
    } catch (error: any) {
      console.error('❌ getReadableUserId failed (non-fatal):', error.message);
      return null;
    }
  },

  // ── NEW: Fetch user phone number from the users collection ──────────────────
  // Returns null on any error — never crashes the UI.

  async getUserPhone(authUid: string): Promise<string | null> {
    try {
      if (!authUid?.trim()) return null;
      const snap = await getDoc(doc(db, 'users', authUid));
      if (!snap.exists()) return null;
      const data = snap.data();
      return (data.phoneNumber as string) || (data.mobileNumber as string) || null;
    } catch (error: any) {
      console.error('❌ getUserPhone failed (non-fatal):', error.message);
      return null;
    }
  },

  // ── NEW: Write an audit log entry ────────────────────────────────────────────
  // Never throws — audit failures must NEVER block the primary operation.
  // Returns the new document ID or null on failure.

  async writeAuditLog(entry: Omit<AuditLog, 'id' | 'timestamp'>): Promise<string | null> {
    try {
      const docRef = await addDoc(
        collection(db, 'paymentAuditLogs'),
        sanitizeForFirestore({ ...entry, timestamp: Timestamp.now() })
      );
      console.log('✅ Audit log written:', docRef.id);
      return docRef.id;
    } catch (error: any) {
      console.error('❌ Audit log write failed (non-blocking):', error.message);
      return null;
    }
  },

  // ── NEW: Read audit logs ──────────────────────────────────────────────────────
  // If transactionDocId is provided, fetches logs for that specific transaction only.
  // Otherwise fetches the most recent `maxResults` logs across all transactions.

  async getAuditLogs(transactionDocId?: string, maxResults = 500): Promise<AuditLog[]> {
    try {
      const constraints: any[] = [orderBy('timestamp', 'desc'), limit(maxResults)];
      if (transactionDocId) {
        constraints.unshift(where('transactionDocId', '==', transactionDocId));
      }
      const snapshot = await getDocs(query(collection(db, 'paymentAuditLogs'), ...constraints));
      return snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          timestamp: safeToDate(data.timestamp) ?? new Date()
        } as AuditLog;
      });
    } catch (error: any) {
      console.error('❌ Error fetching audit logs:', error.message);
      throw new Error(`Failed to fetch audit logs: ${error.message}`);
    }
  },

  // ── NEW: Move transaction to trash (soft delete) ─────────────────────────────
  // Moves the transaction to paymentTrash collection with a 30-day TTL.
  // Writes full snapshot + deletion metadata. Deletes from transactions collection.
  // An audit log entry is ALSO written automatically here.

  async moveTransactionToTrash(
    txn: Transaction,
    actor: { uid: string; name: string; role: string; surname?: string; userId?: string },
    reason: string
  ): Promise<void> {
    try {
      if (!txn?.id) throw new Error('Transaction document ID is required');
      if (!reason?.trim()) throw new Error('A reason is required when deleting a transaction');

      const now = Timestamp.now();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      // Write to paymentTrash collection
      const trashData = sanitizeForFirestore({
        originalDocId: txn.id,
        transaction: txn,
        deletedAt: now,
        deletedBy: actor.uid,
        deletedByName: actor.name,
        deletedBySurname: actor.surname ?? '',
        deletedByUserId: actor.userId ?? '',
        deletedByRole: actor.role,
        reason: reason.trim(),
        expiresAt: Timestamp.fromDate(expiresAt),
      });
      const trashRef = await addDoc(collection(db, 'paymentTrash'), trashData);
      console.log('✅ Transaction moved to trash:', trashRef.id);

      // Delete from live transactions
      await deleteDoc(doc(db, 'transactions', txn.id));
      console.log('✅ Transaction removed from live collection:', txn.id);

      // Write audit log
      await this.writeAuditLog({
        transactionId: txn.transactionId,
        transactionDocId: txn.id,
        action: 'transaction_moved_to_trash',
        performedBy: actor.uid,
        performedByName: actor.name,
        performedBySurname: actor.surname ?? '',
        performedByUserId: actor.userId ?? '',
        performedByRole: actor.role,
        note: `Transaction moved to trash. Trash Doc ID: ${trashRef.id}. Auto-purge after: ${expiresAt.toISOString()}`,
        reason: reason.trim(),
        snapshotBefore: {
          transactionId: txn.transactionId,
          status: txn.status,
          amount: txn.amount,
          userName: txn.userName,
          productName: txn.productName,
        },
      });
    } catch (error: any) {
      console.error('❌ Error moving transaction to trash:', error.message);
      throw new Error(`Failed to move transaction to trash: ${error.message}`);
    }
  },

  // ── NEW: Get all trash records ───────────────────────────────────────────────

  async getTrashTransactions(): Promise<TrashRecord[]> {
    try {
      const snapshot = await getDocs(
        query(collection(db, 'paymentTrash'), orderBy('deletedAt', 'desc'))
      );
      return snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        // Reconstruct Transaction dates inside snapshot
        const txnRaw = data.transaction ?? {};
        const transaction: Transaction = {
          ...txnRaw,
          createdAt: safeToDate(txnRaw.createdAt) ?? new Date(),
          updatedAt: safeToDate(txnRaw.updatedAt),
          completedAt: safeToDate(txnRaw.completedAt),
        };
        return {
          id: docSnap.id,
          originalDocId: data.originalDocId,
          transaction,
          deletedAt: safeToDate(data.deletedAt) ?? new Date(),
          deletedBy: data.deletedBy,
          deletedByName: data.deletedByName,
          deletedByRole: data.deletedByRole,
          reason: data.reason,
          expiresAt: safeToDate(data.expiresAt) ?? new Date(),
        } as TrashRecord;
      });
    } catch (error: any) {
      console.error('❌ Error fetching trash:', error.message);
      throw new Error(`Failed to fetch trash records: ${error.message}`);
    }
  },

  // ── NEW: Restore transaction from trash ──────────────────────────────────────
  // Moves the transaction back to the live transactions collection.

  async restoreTransactionFromTrash(
    trashRecord: TrashRecord,
    actor: { uid: string; name: string; role: string; surname?: string; userId?: string }
  ): Promise<void> {
    try {
      if (!trashRecord?.id) throw new Error('Trash record ID is required');

      // Re-create in transactions collection
      const txnData = sanitizeForFirestore({
        ...trashRecord.transaction,
        updatedAt: Timestamp.now(),
      });
      delete txnData.id; // Firestore auto-generates the doc ID
      const restoredRef = await addDoc(collection(db, 'transactions'), txnData);
      console.log('✅ Transaction restored to live collection:', restoredRef.id);

      // Delete from trash
      await deleteDoc(doc(db, 'paymentTrash', trashRecord.id));
      console.log('✅ Trash record deleted:', trashRecord.id);

      // Write audit log
      await this.writeAuditLog({
        transactionId: trashRecord.transaction.transactionId,
        transactionDocId: restoredRef.id,
        action: 'transaction_restored_from_trash',
        performedBy: actor.uid,
        performedByName: actor.name,
        performedBySurname: actor.surname ?? '',
        performedByUserId: actor.userId ?? '',
        performedByRole: actor.role,
        note: `Transaction restored from trash. New Doc ID: ${restoredRef.id}. Original trash ID: ${trashRecord.id}`,
      });
    } catch (error: any) {
      console.error('❌ Error restoring transaction from trash:', error.message);
      throw new Error(`Failed to restore transaction: ${error.message}`);
    }
  },

  // ── NEW: Purge expired trash records (30-day auto-cleanup) ──────────────────
  // Call this on page load to silently remove expired trash items.
  // Never throws — purge failures must not block the UI.
  // Records a purge audit log for each item removed.

  async purgeExpiredTrash(): Promise<number> {
    try {
      const now = new Date();
      const snapshot = await getDocs(query(collection(db, 'paymentTrash'), orderBy('expiresAt', 'asc')));
      let purgedCount = 0;
      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        const expiresAt = safeToDate(data.expiresAt);
        if (expiresAt && expiresAt <= now) {
          // Log the purge before deleting
          await this.writeAuditLog({
            transactionId: data.transaction?.transactionId ?? 'unknown',
            transactionDocId: data.originalDocId ?? docSnap.id,
            action: 'transaction_purged',
            performedBy: 'system',
            performedByName: 'System Auto-Purge',
            performedByRole: 'system',
            note: `Trash record auto-purged after 30-day retention. Trash Doc ID: ${docSnap.id}. Original deleted by: ${data.deletedByName ?? 'unknown'}.`,
            reason: `Auto-purge: 30-day retention expired on ${expiresAt.toISOString()}`,
          });
          await deleteDoc(doc(db, 'paymentTrash', docSnap.id));
          purgedCount++;
          console.log('✅ Expired trash purged:', docSnap.id);
        }
      }
      if (purgedCount > 0) {
        console.log(`🗑️ Auto-purged ${purgedCount} expired trash record(s)`);
      }
      return purgedCount;
    } catch (error: any) {
      console.error('❌ Trash purge failed (non-blocking):', error.message);
      return 0;
    }
  },

  // ── NEW: Get distinct course/product list from transactions ──────────────────
  // Used to populate the course filter dropdown.

  async getCourseList(): Promise<{ productId: string; productName: string }[]> {
    try {
      const snapshot = await getDocs(
        query(collection(db, 'transactions'), orderBy('createdAt', 'desc'))
      );
      const seen = new Map<string, string>();
      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.productId && data.productName && !seen.has(data.productId)) {
          seen.set(data.productId, data.productName);
        }
      });
      return Array.from(seen.entries()).map(([productId, productName]) => ({ productId, productName }));
    } catch (error: any) {
      console.error('❌ getCourseList failed (non-fatal):', error.message);
      return [];
    }
  }
};

export default paymentService;
