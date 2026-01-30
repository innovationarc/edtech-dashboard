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

  // Delete user from BOTH Firestore and Firebase Authentication
  // STRICT MODE: Both must succeed or entire operation fails
  async deleteUser(uid: string, userEmail?: string): Promise<void> {
    try {
      console.log('🗑️ Starting STRICT user deletion for UID:', uid);
      console.log('⚠️ STRICT MODE: Both Auth and Firestore must succeed');
      
      let authDeleted = false;
      let firestoreDeleted = false;
      let authError: string | null = null;
      let firestoreError: string | null = null;
      
      // STEP 1: Delete from Firebase Authentication via backend API
      // This MUST succeed
      try {
        console.log('🔐 Step 1/3: Deleting from Firebase Authentication...');
        
        const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 
                           import.meta.env.VITE_API_URL ||
                           'https://edtech-dashboard-alpha.vercel.app';
        const MASTER_API_KEY = import.meta.env.VITE_SMS_MASTER_KEY;

        const response = await fetch(`${BACKEND_URL}/api/delete-user`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            uid,
            email: userEmail,
            action: 'delete-auth-user',
            apiKey: MASTER_API_KEY
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch {
            errorData = { error: errorText || `HTTP ${response.status}` };
          }
          authError = errorData.error || errorData.details || `Server error: ${response.status}`;
          throw new Error(authError);
        }

        const result = await response.json();
        
        if (!result.success) {
          authError = result.error || result.details || 'Unknown error from backend';
          throw new Error(authError);
        }

        // Check if Auth deletion actually succeeded
        if (result.details && result.details.authDeleted) {
          authDeleted = true;
          console.log('✅ Successfully deleted from Firebase Auth');
        } else {
          authError = 'Backend reported failure to delete from Auth';
          throw new Error(authError);
        }
        
      } catch (error: any) {
        authError = error.message;
        console.error('❌ Firebase Auth deletion FAILED:', authError);
        
        // STRICT MODE: If Auth deletion fails, throw error immediately
        throw new Error(`Failed to delete from Firebase Authentication: ${authError}`);
      }
      
      // STEP 2: Delete from Firestore
      // This MUST succeed
      try {
        console.log('📄 Step 2/3: Deleting from Firestore...');
        const userRef = doc(db, 'users', uid);
        const userDoc = await getDoc(userRef);
        
        if (userDoc.exists()) {
          await deleteDoc(userRef);
          firestoreDeleted = true;
          console.log('✅ Successfully deleted from Firestore');
        } else {
          // If document doesn't exist, consider it already deleted
          firestoreDeleted = true;
          console.log('ℹ️ User not found in Firestore (already deleted)');
        }
      } catch (error: any) {
        firestoreError = error.message;
        console.error('❌ Firestore deletion FAILED:', firestoreError);
        
        // STRICT MODE: If Firestore deletion fails, throw error
        throw new Error(`Failed to delete from Firestore: ${firestoreError}`);
      }
      
      // STEP 3: Delete profile picture from Storage (optional, won't fail operation)
      try {
        console.log('🖼️ Step 3/3: Deleting profile picture from Storage...');
        
        const extensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
        let deleted = false;
        
        for (const ext of extensions) {
          try {
            const pictureRef = ref(storage, `profile_pictures/${uid}_profile_picture.${ext}`);
            await deleteObject(pictureRef);
            deleted = true;
            console.log(`✅ Successfully deleted profile picture (.${ext})`);
            break;
          } catch (e) {
            // Continue to next extension
          }
        }
        
        if (!deleted) {
          console.log('ℹ️ No profile picture found in Storage');
        }
      } catch (storageError: any) {
        console.warn('⚠️ Storage cleanup failed (non-critical):', storageError.message);
        // Storage deletion failure is not critical
      }
      
      // Verify both critical deletions succeeded
      if (!authDeleted || !firestoreDeleted) {
        const errors = [];
        if (!authDeleted) errors.push('Firebase Auth deletion failed');
        if (!firestoreDeleted) errors.push('Firestore deletion failed');
        
        throw new Error(`Deletion incomplete: ${errors.join(', ')}`);
      }
      
      // Success summary
      console.log('\n=== ✅ DELETION SUCCESSFUL ===');
      console.log('Firebase Auth: ✅ DELETED');
      console.log('Firestore: ✅ DELETED');
      console.log('User has been permanently removed from the system\n');
      
    } catch (error: any) {
      console.error('\n=== ❌ DELETION FAILED ===');
      console.error('Error:', error.message);
      console.error('User deletion was NOT completed\n');
      
      throw new Error(error.message || 'Failed to delete user from both Firebase Auth and Firestore');
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
