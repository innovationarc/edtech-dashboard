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
  Timestamp 
} from 'firebase/firestore';
import { db } from '../config/firebase';

export interface Transaction {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  amount: number;
  currency: string;
  status: 'success' | 'failed' | 'pending' | 'refunded';
  gateway: string;
  productName: string;
  productId: string;
  transactionId: string;
  gatewayTransactionId?: string;
  createdAt: Date;
  updatedAt?: Date;
}

export interface PaymentGateway {
  id: string;
  name: string;
  enabled: boolean;
  status: 'connected' | 'not_connected';
  settings: {
    apiKey?: string;
    secretKey?: string;
    webhookSecret?: string;
    testMode?: boolean;
  };
  createdAt: Date;
  updatedAt?: Date;
}

export const paymentService = {
  // Transaction methods
  async getAllTransactions(): Promise<Transaction[]> {
    try {
      const transactionsCollection = collection(db, 'transactions');
      const transactionsSnapshot = await getDocs(query(transactionsCollection, orderBy('createdAt', 'desc')));
      
      return transactionsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt.toDate(),
        updatedAt: doc.data().updatedAt?.toDate()
      })) as Transaction[];
    } catch (error: any) {
      throw new Error(error.message);
    }
  },

  async createTransaction(transaction: Omit<Transaction, 'id' | 'createdAt'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, 'transactions'), {
        ...transaction,
        createdAt: Timestamp.now()
      });
      return docRef.id;
    } catch (error: any) {
      throw new Error(error.message);
    }
  },

  async updateTransaction(id: string, updates: Partial<Transaction>): Promise<void> {
    try {
      const transactionRef = doc(db, 'transactions', id);
      await updateDoc(transactionRef, {
        ...updates,
        updatedAt: Timestamp.now()
      });
    } catch (error: any) {
      throw new Error(error.message);
    }
  },

  // Payment Gateway methods
  async getAllGateways(): Promise<PaymentGateway[]> {
    try {
      const gatewaysCollection = collection(db, 'paymentGateways');
      const gatewaysSnapshot = await getDocs(gatewaysCollection);
      
      return gatewaysSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt.toDate(),
        updatedAt: doc.data().updatedAt?.toDate()
      })) as PaymentGateway[];
    } catch (error: any) {
      throw new Error(error.message);
    }
  },

  async updateGateway(id: string, updates: Partial<PaymentGateway>): Promise<void> {
    try {
      const gatewayRef = doc(db, 'paymentGateways', id);
      await updateDoc(gatewayRef, {
        ...updates,
        updatedAt: Timestamp.now()
      });
    } catch (error: any) {
      throw new Error(error.message);
    }
  },

  async createGateway(gateway: Omit<PaymentGateway, 'id' | 'createdAt'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, 'paymentGateways'), {
        ...gateway,
        createdAt: Timestamp.now()
      });
      return docRef.id;
    } catch (error: any) {
      throw new Error(error.message);
    }
  },

  // Search and filter methods
  async searchTransactions(searchTerm: string): Promise<Transaction[]> {
    try {
      const transactions = await this.getAllTransactions();
      return transactions.filter(transaction => 
        transaction.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        transaction.userEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
        transaction.transactionId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        transaction.productName.toLowerCase().includes(searchTerm.toLowerCase())
      );
    } catch (error: any) {
      throw new Error(error.message);
    }
  },

  async filterTransactionsByStatus(status: string): Promise<Transaction[]> {
    try {
      if (status === 'all') {
        return this.getAllTransactions();
      }
      
      const transactionsCollection = collection(db, 'transactions');
      const q = query(transactionsCollection, where('status', '==', status), orderBy('createdAt', 'desc'));
      const transactionsSnapshot = await getDocs(q);
      
      return transactionsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt.toDate(),
        updatedAt: doc.data().updatedAt?.toDate()
      })) as Transaction[];
    } catch (error: any) {
      throw new Error(error.message);
    }
  }
};