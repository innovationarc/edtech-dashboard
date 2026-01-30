// src/services/userService.ts
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

  // Delete user from both Firestore and Firebase Authentication
  async deleteUser(uid: string, userEmail?: string): Promise<void> {
    try {
      console.log('🗑️ Starting user deletion process for UID:', uid);
      
      // Step 1: Delete from Firestore first (we have direct access)
      try {
        console.log('📄 Attempting to delete from Firestore...');
        const userRef = doc(db, 'users', uid);
        const userDoc = await getDoc(userRef);
        
        if (userDoc.exists()) {
          await deleteDoc(userRef);
          console.log('✅ User deleted from Firestore');
        } else {
          console.log('⚠️ User not found in Firestore (already deleted)');
        }
      } catch (firestoreError: any) {
        console.error('❌ Firestore deletion error:', firestoreError.message);
        throw new Error(`Failed to delete from Firestore: ${firestoreError.message}`);
      }
      
      // Step 2: Delete from Firebase Authentication via backend API
      try {
        const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 
                           import.meta.env.VITE_API_URL ||
                           'https://edtech-dashboard-alpha.vercel.app';
        const MASTER_API_KEY = import.meta.env.VITE_SMS_MASTER_KEY;

        const requestBody: any = {
          uid,
          email: userEmail,
          action: 'delete-auth-user'
        };

        if (MASTER_API_KEY) {
          requestBody.apiKey = MASTER_API_KEY;
        }

        console.log('🌐 Calling backend API to delete from Firebase Auth...');

        const response = await fetch(`${BACKEND_URL}/api/delete-user`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.warn('⚠️ Backend API error (continuing anyway):', errorText);
          
          // Don't throw error here - Firestore deletion already succeeded
          // The auth deletion might fail if user was already deleted from Auth
          console.log('⚠️ Auth deletion may have failed, but Firestore deletion succeeded');
        } else {
          const result = await response.json();
          
          if (result.success) {
            console.log('✅ User deleted from Firebase Authentication');
          } else {
            console.warn('⚠️ Auth deletion reported failure:', result.error);
          }
        }
      } catch (authError: any) {
        // Don't throw - Firestore deletion already succeeded
        console.warn('⚠️ Firebase Auth deletion attempt failed (but Firestore deletion succeeded):', authError.message);
      }
      
      // Step 3: Delete profile picture from Storage if exists
      try {
        // Attempt to delete with various common extensions
        const extensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
        let deleted = false;
        
        for (const ext of extensions) {
          try {
            const pictureRef = ref(storage, `profile_pictures/${uid}_profile_picture.${ext}`);
            await deleteObject(pictureRef);
            console.log(`✅ Profile picture deleted from Storage (.${ext})`);
            deleted = true;
            break;
          } catch (e) {
            // Continue to next extension
          }
        }
        
        if (!deleted) {
          console.log('ℹ️ No profile picture found in Storage (or already deleted)');
        }
      } catch (storageError) {
        console.warn('⚠️ Profile picture deletion skipped:', storageError);
      }
      
      console.log('✅ User deletion process completed');
    } catch (error: any) {
      console.error('❌ Error deleting user:', error);
      throw new Error(error.message || 'Failed to delete user');
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
        user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.userId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.surname?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.phoneNumber?.toLowerCase().includes(searchTerm.toLowerCase())
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
    byRole: { 
      admin: number; 
      manager: number;
      course_manager: number;
      student_manager: number;
      coordinator: number;
      teacher: number; 
      parent: number;
      student: number;
    };
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
          manager: users.filter(u => u.role === 'manager').length,
          course_manager: users.filter(u => u.role === 'course_manager').length,
          student_manager: users.filter(u => u.role === 'student_manager').length,
          coordinator: users.filter(u => u.role === 'coordinator').length,
          teacher: users.filter(u => u.role === 'teacher').length,
          parent: users.filter(u => u.role === 'parent').length,
          student: users.filter(u => u.role === 'student').length,
        }
      };
    } catch (error: any) {
      console.error('Error getting user stats:', error);
      throw new Error(error.message);
    }
  }
};
