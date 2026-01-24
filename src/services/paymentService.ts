// src/services/paymentService.ts
// Complete Payment Service with SSLCOMMERZ Integration - Production Grade

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

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

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
}

export interface PaymentValidationResponse {
  success: boolean;
  status?: string;
  validated?: boolean;
  transaction?: Transaction;
  error?: string;
}

// ==================== PAYMENT SERVICE ====================

export const paymentService = {
  
  // ==================== PAYMENT INITIATION ====================
  
  /**
   * Initiate payment through SSLCOMMERZ gateway
   * This creates a transaction record and redirects to payment gateway
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
        throw new Error(validation.error);
      }

      // Generate unique transaction ID
      const transactionId = this.generateTransactionId(
        request.productId, 
        request.userId
      );

      console.log('PaymentService: Generated transaction ID:', transactionId);

      // Create transaction record in Firestore (pending state)
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

      // Call backend API to initiate SSLCOMMERZ payment
      console.log('PaymentService: Calling backend initiate API...');
      
      const response = await axios.post(
        `${BACKEND_URL}/api/payment/initiate`,
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
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      console.log('PaymentService: Backend response:', response.data);

      if (response.data.success) {
        // Update transaction with gateway session details
        await this.updateTransactionByTranId(transactionId, {
          gatewayTransactionId: response.data.gatewayTransactionId,
          status: 'pending'
        });

        console.log('PaymentService: Payment initiation successful');

        return {
          success: true,
          gatewayUrl: response.data.gatewayUrl,
          transactionId: transactionId,
          sessionId: response.data.gatewayTransactionId
        };
      } else {
        console.error('PaymentService: Payment initiation failed:', response.data.error);
        
        // Update transaction as failed
        await this.updateTransactionByTranId(transactionId, {
          status: 'failed',
          metadata: { 
            error: response.data.error,
            timestamp: new Date().toISOString()
          }
        });

        return {
          success: false,
          error: response.data.error || 'Payment initiation failed'
        };
      }
    } catch (error: any) {
      console.error('PaymentService: Error initiating payment:', error);
      
      // Handle network errors
      if (error.code === 'ECONNABORTED') {
        return {
          success: false,
          error: 'Request timeout. Please try again.'
        };
      }
      
      if (error.code === 'ERR_NETWORK') {
        return {
          success: false,
          error: 'Network error. Please check your connection.'
        };
      }
      
      return {
        success: false,
        error: error.response?.data?.error || error.message || 'Failed to initiate payment'
      };
    }
  },

  /**
   * Validate payment after gateway redirect
   * This checks the payment status with the backend
   */
  async validatePayment(transactionId: string): Promise<PaymentValidationResponse> {
    try {
      console.log('PaymentService: Validating payment:', transactionId);

      if (!transactionId || !transactionId.trim()) {
        throw new Error('Transaction ID is required');
      }

      // Get transaction from Firestore
      const transaction = await this.getTransactionByTranId(transactionId);
      
      if (!transaction) {
        console.error('PaymentService: Transaction not found:', transactionId);
        return {
          success: false,
          error: 'Transaction not found'
        };
      }

      console.log('PaymentService: Transaction status:', transaction.status);

      // If already completed, return cached result
      if (transaction.status === 'success') {
        console.log('PaymentService: Transaction already validated');
        return {
          success: true,
          status: 'success',
          validated: true,
          transaction
        };
      }

      // If failed or cancelled, return current status
      if (transaction.status === 'failed' || transaction.status === 'cancelled') {
        console.log('PaymentService: Transaction failed/cancelled');
        return {
          success: false,
          status: transaction.status,
          validated: false,
          transaction,
          error: `Payment ${transaction.status}`
        };
      }

      // Call backend to validate with SSLCOMMERZ
      console.log('PaymentService: Calling backend validate API...');
      
      const response = await axios.post(
        `${BACKEND_URL}/api/payment/validate`,
        { transactionId },
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 30000
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
          transaction
        };
      }
    } catch (error: any) {
      console.error('PaymentService: Error validating payment:', error);
      
      // Handle network errors
      if (error.code === 'ECONNABORTED') {
        return {
          success: false,
          error: 'Request timeout. Please try again.'
        };
      }
      
      return {
        success: false,
        error: error.response?.data?.error || error.message || 'Failed to validate payment'
      };
    }
  },

  // ==================== VALIDATION HELPERS ====================

  /**
   * Validate payment request data
   */
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

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(request.userEmail)) {
      return { valid: false, error: 'Invalid email address' };
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

  /**
   * Generate unique transaction ID
   */
  generateTransactionId(productId: string, userId: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    const userPart = userId.substring(0, 8).toUpperCase();
    const productPart = productId.substring(0, 8).toUpperCase();
    
    return `TXN_${productPart}_${userPart}_${timestamp}_${random}`;
  },

  // ==================== TRANSACTION MANAGEMENT ====================

  /**
   * Create transaction record in Firestore
   */
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

  /**
   * Get transaction by transactionId field (not document ID)
   */
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
      
      console.warn('PaymentService: Transaction not found:', transactionId);
      return null;
    } catch (error: any) {
      console.error('PaymentService: Error getting transaction:', error);
      throw new Error(`Failed to get transaction: ${error.message}`);
    }
  },

  /**
   * Update transaction by transactionId field
   */
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
      
      // Remove fields that shouldn't be updated
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

  /**
   * Get all transactions (admin only)
   */
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

  /**
   * Get user transactions
   */
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
  },

  /**
   * Filter transactions by status
   */
  async filterTransactionsByStatus(status: string): Promise<Transaction[]> {
    try {
      if (status === 'all') {
        return this.getAllTransactions();
      }
      
      const transactionsCollection = collection(db, 'transactions');
      const q = query(
        transactionsCollection,
        where('status', '==', status),
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
      console.error('PaymentService: Error filtering transactions:', error);
      throw new Error(`Failed to filter transactions: ${error.message}`);
    }
  },

  /**
   * Search transactions
   */
  async searchTransactions(searchTerm: string): Promise<Transaction[]> {
    try {
      if (!searchTerm || !searchTerm.trim()) {
        return [];
      }

      const transactions = await this.getAllTransactions();
      const term = searchTerm.toLowerCase().trim();
      
      return transactions.filter(transaction => 
        transaction.userName.toLowerCase().includes(term) ||
        transaction.userEmail.toLowerCase().includes(term) ||
        transaction.transactionId.toLowerCase().includes(term) ||
        transaction.productName.toLowerCase().includes(term) ||
        transaction.gatewayTransactionId?.toLowerCase().includes(term) ||
        transaction.bankTransactionId?.toLowerCase().includes(term)
      );
    } catch (error: any) {
      console.error('PaymentService: Error searching transactions:', error);
      throw new Error(`Failed to search transactions: ${error.message}`);
    }
  },

  // ==================== UTILITY METHODS ====================

  /**
   * Get transaction statistics
   */
  async getTransactionStats(userId?: string): Promise<{
    total: number;
    success: number;
    pending: number;
    failed: number;
    totalAmount: number;
    successAmount: number;
  }> {
    try {
      const transactions = userId 
        ? await this.getUserTransactions(userId)
        : await this.getAllTransactions();

      const stats = {
        total: transactions.length,
        success: 0,
        pending: 0,
        failed: 0,
        totalAmount: 0,
        successAmount: 0
      };

      transactions.forEach(txn => {
        stats.totalAmount += txn.amount;
        
        if (txn.status === 'success') {
          stats.success++;
          stats.successAmount += txn.amount;
        } else if (txn.status === 'pending' || txn.status === 'validating') {
          stats.pending++;
        } else if (txn.status === 'failed' || txn.status === 'cancelled') {
          stats.failed++;
        }
      });

      return stats;
    } catch (error: any) {
      console.error('PaymentService: Error getting transaction stats:', error);
      throw new Error(`Failed to get transaction stats: ${error.message}`);
    }
  }
};

export default paymentService;
