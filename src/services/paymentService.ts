// src/services/paymentService.ts
// Payment Service with Complete Error Handling and Network Fix

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
import axios, { AxiosError } from 'axios';

// Fix: Use proper backend URL for Vercel
const BACKEND_URL = typeof window !== 'undefined' 
  ? window.location.origin 
  : process.env.NEXT_PUBLIC_BACKEND_URL || process.env.REACT_APP_BACKEND_URL || 'http://localhost:3000';

console.log('PaymentService: Backend URL:', BACKEND_URL);

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
  
  /**
   * Initiate payment through SSLCOMMERZ gateway
   */
  async initiatePayment(request: PaymentInitiationRequest): Promise<PaymentInitiationResponse> {
    try {
      console.log('PaymentService: Initiating payment', {
        userId: request.userId,
        productId: request.productId,
        amount: request.amount
      });

      // Validate request
      const validation = this.validatePaymentRequest(request);
      if (!validation.valid) {
        console.error('PaymentService: Validation failed:', validation.error);
        return {
          success: false,
          error: 'Invalid payment request',
          details: validation.error
        };
      }

      // Generate unique transaction ID
      const transactionId = this.generateTransactionId(
        request.productId, 
        request.userId
      );

      console.log('PaymentService: Generated transaction ID:', transactionId);

      // Create transaction record in Firestore
      try {
        const firestoreTransactionId = await this.createTransaction({
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

        console.log('PaymentService: Transaction created in Firestore:', firestoreTransactionId);
      } catch (firestoreError: any) {
        console.error('PaymentService: Firestore error:', firestoreError);
        return {
          success: false,
          error: 'Failed to create transaction record',
          details: firestoreError.message
        };
      }

      // Call backend API
      console.log('PaymentService: Calling backend API...');
      console.log('PaymentService: URL:', `${BACKEND_URL}/api/payment?action=initiate`);
      
      try {
        const response = await axios.post(
          `${BACKEND_URL}/api/payment?action=initiate`,
          {
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
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            timeout: 30000,
            validateStatus: (status) => status < 500 // Don't throw on 4xx
          }
        );

        console.log('PaymentService: Backend response:', response.data);

        if (response.data.success) {
          // Update transaction with gateway session
          try {
            await this.updateTransactionByTranId(transactionId, {
              gatewayTransactionId: response.data.gatewayTransactionId,
              status: 'pending'
            });
          } catch (updateError) {
            console.warn('PaymentService: Failed to update transaction:', updateError);
          }

          return {
            success: true,
            gatewayUrl: response.data.gatewayUrl,
            transactionId: transactionId,
            sessionId: response.data.gatewayTransactionId
          };
        } else {
          console.error('PaymentService: Backend returned error:', response.data.error);
          
          // Update transaction as failed
          try {
            await this.updateTransactionByTranId(transactionId, {
              status: 'failed',
              metadata: { 
                error: response.data.error,
                timestamp: new Date().toISOString()
              }
            });
          } catch (updateError) {
            console.warn('PaymentService: Failed to update failed transaction:', updateError);
          }

          return {
            success: false,
            error: response.data.error || 'Payment initiation failed',
            details: 'Backend rejected the payment request'
          };
        }
      } catch (axiosError: any) {
        console.error('PaymentService: Network/API error:', axiosError);
        
        // Handle different types of errors
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
          // Server responded with error
          return {
            success: false,
            error: 'Server error',
            details: axiosError.response.data?.error || 'Payment gateway returned an error'
          };
        }
        
        return {
          success: false,
          error: 'Payment initiation failed',
          details: axiosError.message || 'An unexpected error occurred'
        };
      }
    } catch (error: any) {
      console.error('PaymentService: Unexpected error:', error);
      return {
        success: false,
        error: 'Unexpected error',
        details: error.message || 'An unexpected error occurred during payment initiation'
      };
    }
  },

  /**
   * Validate payment after gateway redirect
   */
  async validatePayment(transactionId: string): Promise<PaymentValidationResponse> {
    try {
      console.log('PaymentService: Validating payment:', transactionId);

      if (!transactionId || !transactionId.trim()) {
        return {
          success: false,
          error: 'Invalid transaction ID',
          details: 'Transaction ID is required for validation'
        };
      }

      // Get transaction from Firestore
      const transaction = await this.getTransactionByTranId(transactionId);
      
      if (!transaction) {
        console.error('PaymentService: Transaction not found:', transactionId);
        return {
          success: false,
          error: 'Transaction not found',
          details: 'No transaction record found for this ID'
        };
      }

      console.log('PaymentService: Current transaction status:', transaction.status);

      // If already completed, return cached result
      if (transaction.status === 'success') {
        return {
          success: true,
          status: 'success',
          validated: true,
          transaction
        };
      }

      // If failed or cancelled
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
      console.log('PaymentService: Calling backend validate API...');
      
      try {
        const response = await axios.post(
          `${BACKEND_URL}/api/payment?action=validate`,
          { transactionId },
          {
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            timeout: 30000,
            validateStatus: (status) => status < 500
          }
        );

        console.log('PaymentService: Validation response:', response.data);

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
        console.error('PaymentService: Validation API error:', axiosError);
        
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
      console.error('PaymentService: Validation error:', error);
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
      console.log('PaymentService: Transaction record created:', docRef.id);
      return docRef.id;
    } catch (error: any) {
      console.error('PaymentService: Error creating transaction:', error);
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
      console.error('PaymentService: Error getting transaction:', error);
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

      console.log('PaymentService: Transaction updated:', transactionId);
    } catch (error: any) {
      console.error('PaymentService: Error updating transaction:', error);
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
      console.error('PaymentService: Error getting all transactions:', error);
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
      console.error('PaymentService: Error getting user transactions:', error);
      throw new Error(`Failed to get user transactions: ${error.message}`);
    }
  }
};

export default paymentService;
