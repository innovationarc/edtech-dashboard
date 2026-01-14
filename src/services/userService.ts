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
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '../config/firebase';
import { UserProfile } from './authService';

export interface User extends UserProfile {
  status: 'active' | 'inactive' | 'pending';
  address?: string;
  class?: string;
  school?: string;
  college?: string;
  mobileNumber?: string;
  registrationNumber?: string;
  profilePictureUrl?: string;
}

export const userService = {
  // Upload profile picture to Firebase Storage
  async uploadProfilePicture(file: File, userId: string): Promise<string> {
    try {
      const fileExtension = file.name.split('.').pop();
      const fileName = `${userId}_profile_picture.${fileExtension}`;
      const storageRef = ref(storage, `profile_pictures/${fileName}`);

      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      return url;
    } catch (error: any) {
      throw new Error(`Failed to upload profile picture: ${error.message}`);
    }
  },

  // Get all users (regardless of status)
  async getAllUsers(): Promise<User[]> {
    try {
      const usersCollection = collection(db, 'users');
      const usersSnapshot = await getDocs(query(usersCollection, orderBy('createdAt', 'desc')));
      
      console.log('Raw users from Firestore:', usersSnapshot.docs.length);
      
      return usersSnapshot.docs.map(doc => {
        const data = doc.data();
        console.log('User data:', { id: doc.id, status: data.status, name: data.name });
        
        return {
          ...data,
          uid: doc.id,
          createdAt: data.createdAt?.toDate() || new Date(),
          lastLogin: data.lastLogin?.toDate(),
          approvedAt: data.approvedAt?.toDate()
        };
      }) as User[];
    } catch (error: any) {
      console.error('Error getting all users:', error);
      throw new Error(error.message);
    }
  },

  // Get pending users (for admin approval)
  async getPendingUsers(): Promise<User[]> {
    try {
      const usersCollection = collection(db, 'users');
      const pendingQuery = query(
        usersCollection, 
        where('status', '==', 'pending'),
        orderBy('createdAt', 'desc')
      );
      const usersSnapshot = await getDocs(pendingQuery);
      
      console.log('Pending users query result:', usersSnapshot.docs.length);
      
      return usersSnapshot.docs.map(doc => {
        const data = doc.data();
        console.log('Pending user data:', data);
        return {
          ...data,
          uid: doc.id,
          createdAt: data.createdAt?.toDate() || new Date(),
          lastLogin: data.lastLogin?.toDate(),
          approvedAt: data.approvedAt?.toDate()
        };
      }) as User[];
    } catch (error: any) {
      console.error('Error getting pending users:', error);
      throw new Error(error.message);
    }
  },

  // Get active users only
  async getActiveUsers(): Promise<User[]> {
    try {
      const usersCollection = collection(db, 'users');
      const activeQuery = query(
        usersCollection, 
        where('status', '==', 'active'),
        orderBy('createdAt', 'desc')
      );
      const usersSnapshot = await getDocs(activeQuery);
      
      return usersSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          uid: doc.id,
          createdAt: data.createdAt?.toDate() || new Date(),
          lastLogin: data.lastLogin?.toDate(),
          approvedAt: data.approvedAt?.toDate()
        };
      }) as User[];
    } catch (error: any) {
      console.error('Error getting active users:', error);
      throw new Error(error.message);
    }
  },

  // Get inactive users only
  async getInactiveUsers(): Promise<User[]> {
    try {
      const usersCollection = collection(db, 'users');
      const inactiveQuery = query(
        usersCollection, 
        where('status', '==', 'inactive'),
        orderBy('createdAt', 'desc')
      );
      const usersSnapshot = await getDocs(inactiveQuery);
      
      return usersSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          uid: doc.id,
          createdAt: data.createdAt?.toDate() || new Date(),
          lastLogin: data.lastLogin?.toDate(),
          approvedAt: data.approvedAt?.toDate()
        };
      }) as User[];
    } catch (error: any) {
      console.error('Error getting inactive users:', error);
      throw new Error(error.message);
    }
  },

  // Get user by ID
  async getUserById(uid: string): Promise<User | null> {
    try {
      const userDoc = await getDoc(doc(db, 'users', uid));
      
      if (!userDoc.exists()) {
        return null;
      }
      
      const userData = userDoc.data();
      return {
        ...userData,
        uid: userDoc.id,
        createdAt: userData.createdAt?.toDate() || new Date(),
        lastLogin: userData.lastLogin?.toDate(),
        approvedAt: userData.approvedAt?.toDate()
      } as User;
    } catch (error: any) {
      console.error('Error getting user by ID:', error);
      throw new Error(error.message);
    }
  },

  // Update user
  async updateUser(uid: string, updates: Partial<User>): Promise<void> {
    try {
      const userRef = doc(db, 'users', uid);
      const updateData = { ...updates };
      
      // Convert dates to Timestamps for Firestore
      if (updateData.createdAt) {
        updateData.createdAt = Timestamp.fromDate(updateData.createdAt) as any;
      }
      if (updateData.lastLogin) {
        updateData.lastLogin = Timestamp.fromDate(updateData.lastLogin) as any;
      }
      if (updateData.approvedAt) {
        updateData.approvedAt = Timestamp.fromDate(updateData.approvedAt) as any;
      }
      
      await updateDoc(userRef, {
        ...updateData,
        updatedAt: Timestamp.now()
      });
    } catch (error: any) {
      console.error('Error updating user:', error);
      throw new Error(error.message);
    }
  },

  // Delete user
  async deleteUser(uid: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'users', uid));
    } catch (error: any) {
      console.error('Error deleting user:', error);
      throw new Error(error.message);
    }
  },

  // Search users
  async searchUsers(searchTerm: string): Promise<User[]> {
    try {
      const usersCollection = collection(db, 'users');
      const usersSnapshot = await getDocs(usersCollection);
      
      const users = usersSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          uid: doc.id,
          createdAt: data.createdAt?.toDate() || new Date(),
          lastLogin: data.lastLogin?.toDate(),
          approvedAt: data.approvedAt?.toDate()
        };
      }) as User[];
      
      return users.filter(user => 
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase())
      );
    } catch (error: any) {
      console.error('Error searching users:', error);
      throw new Error(error.message);
    }
  },

  // Get user statistics
  async getUserStats(): Promise<{
    total: number;
    active: number;
    pending: number;
    inactive: number;
    byRole: { admin: number; teacher: number; student: number };
  }> {
    try {
      const users = await this.getAllUsers();
      
      return {
        total: users.length,
        active: users.filter(u => u.status === 'active').length,
        pending: users.filter(u => u.status === 'pending').length,
        inactive: users.filter(u => u.status === 'inactive').length,
        byRole: {
          admin: users.filter(u => u.role === 'admin').length,
          teacher: users.filter(u => u.role === 'teacher').length,
          student: users.filter(u => u.role === 'student').length,
        }
      };
    } catch (error: any) {
      console.error('Error getting user stats:', error);
      throw new Error(error.message);
    }
  }
};