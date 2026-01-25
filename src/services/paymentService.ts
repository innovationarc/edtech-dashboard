// src/services/paymentService.ts
// Payment Service - FULLY FIXED with Detailed Error Logging

import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc, 
  query, 
  where, 
  orderBy,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../config/firebase';
import axios from 'axios';

// FIXED: Get backend URL from current window location
const BACKEND_URL = typeof window !== 'undefined' 
  ? window.location.origin 
  : 'http://localhost:3000';

console.log('💳 PaymentService initialized');
console.log('🌐 Backend URL:', BACKEND_URL);

// ==================== INTERFACES ====================

export interface Transaction {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
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
  userEmail: string;
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
}

export interface PaymentValidationResponse {
  success: boolean;
  status?: string;
  validated?: boolean;
  transaction?: Transaction;
  error?: string;
  details?: string;
}

// ==================== PAYMENT SERVICE ====================

export const paymentService = {
  
  // ==================== PAYMENT INITIATION ====================
  
  async initiatePayment(request: PaymentInitiationRequest): Promise<PaymentInitiationResponse> {
    console.log('');
    console.log('='.repeat(80));
    console.log('💳 PAYMENT SERVICE: Initiating Payment');
    console.log('='.repeat(80));
    console.log('User ID:', request.userId);
    console.log('Product ID:', request.productId);
    console.log('Amount:', request.amount);
    console.log('Product Type:', request.productType);
    console.log('='.repeat(80));

    try {
      // Step 1: Validate request
      console.log('📋 Step 1: Validating request...');
      const validation = this.validatePaymentRequest(request);
      if (!validation.valid) {
        console.error('❌ Validation failed:', validation.error);
        return {
          success: false,
          error: 'Invalid payment request',
          details: validation.error
        };
      }
      console.log('✅ Request validated');

      // Step 2: Generate transaction ID
      console.log('📋 Step 2: Generating transaction ID...');
      const transactionId = this.generateTransactionId(request.productId, request.userId);
      console.log('✅ Transaction ID:', transactionId);

      // Step 3: Create Firestore record
      console.log('📋 Step 3: Creating Firestore transaction...');
      try {
        const firestoreId = await this.createTransaction({
          transactionId,
          userId: request.userId,
          userName: request.userName,
          userEmail: request.userEmail,
          amount: request.amount,
          currency: 'BDT',
          gateway: 'SSLCOMMERZ',
          productName: request.productName,
          productId: request.productId,
          productType: request.productType,
          status: 'pending',
          appliedDiscounts: request.appliedDiscounts,
          metadata: request.metadata
        });
        console.log('✅ Firestore record created:', firestoreId);
      } catch (firestoreError: any) {
        console.error('❌ Firestore error:', firestoreError.message);
        return {
          success: false,
          error: 'Database error',
          details: `Failed to create transaction record: ${firestoreError.message}`
        };
      }

      // Step 4: Call backend API
      console.log('📋 Step 4: Calling backend API...');
      const apiUrl = `${BACKEND_URL}/api/payment?action=initiate`;
      console.log('API URL:', apiUrl);
      
      const payload = {
        transactionId,
        userId: request.userId,
        userName: request.userName,
        userEmail: request.userEmail,
        amount: request.amount,
        productId: request.productId,
        productName: request.productName,
        productType: request.productType,
        appliedDiscounts: request.appliedDiscounts,
        metadata: request.metadata
      };
      
      console.log('Payload:', JSON.stringify(payload, null, 2));

      try {
        const response = await axios.post(apiUrl, payload, {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          timeout: 30000
        });

        console.log('📥 Backend response:', JSON.stringify(response.data, null, 2));

        if (response.data.success) {
          console.log('✅ Payment initiation successful');
          
          // Update transaction with gateway session
          try {
            await this.updateTransactionByTranId(transactionId, {
              gatewayTransactionId: response.data.gatewayTransactionId,
              status: 'pending'
            });
            console.log('✅ Transaction updated with gateway session');
          } catch (updateError) {
            console.warn('⚠️ Failed to update transaction:', updateError);
          }

          return {
            success: true,
            gatewayUrl: response.data.gatewayUrl,
            transactionId: transactionId,
            sessionId: response.data.gatewayTransactionId
          };
        } else {
          console.error('❌ Backend returned error:', response.data.error);
          
          // Update transaction as failed
          try {
            await this.updateTransactionByTranId(transactionId, {
              status: 'failed',
              metadata: { 
                error: response.data.error,
                details: response.data.details,
                timestamp: new Date().toISOString()
              }
            });
          } catch (updateError) {
            console.warn('⚠️ Failed to update failed transaction');
          }

          return {
            success: false,
            error: response.data.error || 'Payment initiation failed',
            details: response.data.details || 'Backend rejected the payment request'
          };
        }
      } catch (axiosError: any) {
        console.error('');
        console.error('💥 AXIOS ERROR');
        console.error('='.repeat(80));
        console.error('Message:', axiosError.message);
        console.error('Code:', axiosError.code);
        console.error('URL:', apiUrl);
        
        if (axiosError.response) {
          console.error('Response Status:', axiosError.response.status);
          console.error('Response Data:', JSON.stringify(axiosError.response.data, null, 2));
        }
        console.error('='.repeat(80));
        
        // Handle specific error types
        if (axiosError.code === 'ECONNABORTED') {
          return {
            success: false,
            error: 'Request timeout',
            details: 'The payment gateway is taking too long to respond. Please try again.'
          };
        }
        
        if (axiosError.code === 'ERR_NETWORK') {
          return {
            success: false,
            error: 'Network error',
            details: 'Unable to connect to payment gateway. Please check your internet connection.'
          };
        }

        if (axiosError.response) {
          return {
            success: false,
            error: axiosError.response.data?.error || 'Server error',
            details: axiosError.response.data?.details || axiosError.message
          };
        }
        
        return {
          success: false,
          error: 'Payment initiation failed',
          details: axiosError.message || 'An unexpected error occurred'
        };
      }
    } catch (error: any) {
      console.error('');
      console.error('💥 UNEXPECTED ERROR');
      console.error('='.repeat(80));
      console.error('Message:', error.message);
      console.error('Stack:', error.stack);
      console.error('='.repeat(80));
      
      return {
        success: false,
        error: 'Unexpected error',
        details: error.message || 'An unexpected error occurred during payment initiation'
      };
    }
  },

  async validatePayment(transactionId: string): Promise<PaymentValidationResponse> {
    console.log('');
    console.log('🔍 Validating payment:', transactionId);

    try {
      if (!transactionId || !transactionId.trim()) {
        return {
          success: false,
          error: 'Invalid transaction ID',
          details: 'Transaction ID is required for validation'
        };
      }

      // Get from Firestore
      const transaction = await this.getTransactionByTranId(transactionId);
      
      if (!transaction) {
        console.error('❌ Transaction not found');
        return {
          success: false,
          error: 'Transaction not found',
          details: 'No transaction record found for this ID'
        };
      }

      console.log('Current status:', transaction.status);

      // Return cached result if completed
      if (transaction.status === 'success') {
        console.log('✅ Already validated');
        return {
          success: true,
          status: 'success',
          validated: true,
          transaction
        };
      }

      // Return if failed/cancelled
      if (transaction.status === 'failed' || transaction.status === 'cancelled') {
        return {
          success: false,
          status: transaction.status,
          validated: false,
          transaction,
          error: `Payment ${transaction.status}`,
          details: `This payment was ${transaction.status}`
        };
      }

      // Call backend to validate
      console.log('📞 Calling backend validate API...');
      
      try {
        const response = await axios.post(
          `${BACKEND_URL}/api/payment?action=validate`,
          { transactionId },
          {
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            timeout: 30000
          }
        );

        console.log('📥 Validation response:', response.data);

        if (response.data.success) {
          return {
            success: true,
            status: response.data.status,
            validated: response.data.validated,
            transaction: response.data.transaction || transaction
          };
        } else {
          return {
            success: false,
            error: response.data.error || 'Validation failed',
            status: transaction.status,
            transaction,
            details: 'Unable to validate payment status'
          };
        }
      } catch (axiosError: any) {
        console.error('❌ Validation API error:', axiosError.message);
        
        if (axiosError.code === 'ECONNABORTED') {
          return {
            success: false,
            error: 'Request timeout',
            details: 'Payment validation is taking too long. Please try again.',
            transaction
          };
        }
        
        return {
          success: false,
          error: 'Network error',
          details: 'Unable to validate payment. Please contact support.',
          transaction
        };
      }
    } catch (error: any) {
      console.error('❌ Validation error:', error.message);
      return {
        success: false,
        error: 'Validation failed',
        details: error.message || 'An unexpected error occurred during validation'
      };
    }
  },

  // ==================== VALIDATION HELPERS ====================

  validatePaymentRequest(request: PaymentInitiationRequest): { valid: boolean; error?: string } {
    if (!request.userId || !request.userId.trim()) {
      return { valid: false, error: 'User ID is required' };
    }

    if (!request.userName || !request.userName.trim()) {
      return { valid: false, error: 'User name is required' };
    }

    if (!request.userEmail || !request.userEmail.trim()) {
      return { valid: false, error: 'User email is required' };
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(request.userEmail)) {
      return { valid: false, error: 'Invalid email address format' };
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
      const transactionData = {
        ...data,
        createdAt: Timestamp.now()
      };

      const docRef = await addDoc(collection(db, 'transactions'), transactionData);
      return docRef.id;
    } catch (error: any) {
      console.error('❌ Error creating transaction:', error.message);
      throw new Error(`Failed to create transaction: ${error.message}`);
    }
  },

  async getTransactionByTranId(transactionId: string): Promise<Transaction | null> {
    try {
      const transactionsCollection = collection(db, 'transactions');
      const q = query(
        transactionsCollection,
        where('transactionId', '==', transactionId)
      );
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        const docData = snapshot.docs[0];
        const data = docData.data();
        
        return {
          id: docData.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate(),
          completedAt: data.completedAt?.toDate()
        } as Transaction;
      }
      
      return null;
    } catch (error: any) {
      console.error('❌ Error getting transaction:', error.message);
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
      
      const cleanUpdates: any = { ...updates };
      delete cleanUpdates.id;
      delete cleanUpdates.createdAt;
      delete cleanUpdates.transactionId;
      delete cleanUpdates.userId;

      await updateDoc(transactionRef, {
        ...cleanUpdates,
        updatedAt: Timestamp.now()
      });
    } catch (error: any) {
      console.error('❌ Error updating transaction:', error.message);
      throw new Error(`Failed to update transaction: ${error.message}`);
    }
  },

  async getAllTransactions(): Promise<Transaction[]> {
    try {
      const transactionsCollection = collection(db, 'transactions');
      const transactionsSnapshot = await getDocs(
        query(transactionsCollection, orderBy('createdAt', 'desc'))
      );
      
      return transactionsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate(),
          completedAt: data.completedAt?.toDate()
        } as Transaction;
      });
    } catch (error: any) {
      console.error('❌ Error getting all transactions:', error.message);
      throw new Error(`Failed to get transactions: ${error.message}`);
    }
  },

  async getUserTransactions(userId: string): Promise<Transaction[]> {
    try {
      if (!userId || !userId.trim()) {
        throw new Error('User ID is required');
      }

      const transactionsCollection = collection(db, 'transactions');
      const q = query(
        transactionsCollection,
        where('userId', '==', userId),
        orderBy('createdAt', 'desc')
      );
      const transactionsSnapshot = await getDocs(q);
      
      return transactionsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate(),
          completedAt: data.completedAt?.toDate()
        } as Transaction;
      });
    } catch (error: any) {
      console.error('❌ Error getting user transactions:', error.message);
      throw new Error(`Failed to get user transactions: ${error.message}`);
    }
  }
};

export default paymentService;
