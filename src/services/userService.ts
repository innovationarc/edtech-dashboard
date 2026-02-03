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
  emergencyContact?: string;
  bloodGroup?: string;
}

/**
 * Helper function to ensure user data has all required fields
 * This fixes old admin accounts that might be missing 'name' or 'surname' fields
 */
const ensureUserFields = (userData: any): any => {
  const fixed = { ...userData };
  
  // Ensure 'name' field exists (fallback chain: fullName -> surname -> 'User')
  if (!fixed.name || fixed.name.trim() === '') {
    fixed.name = fixed.fullName || fixed.surname || 'User';
  }
  
  // Ensure 'surname' field exists (fallback chain: name -> fullName -> 'User')
  if (!fixed.surname || fixed.surname.trim() === '') {
    fixed.surname = fixed.name || fixed.fullName || 'User';
  }
  
  // Ensure 'fullName' field exists (fallback chain: name -> surname -> 'User')
  if (!fixed.fullName || fixed.fullName.trim() === '') {
    fixed.fullName = fixed.name || fixed.surname || 'User';
  }
  
  return fixed;
};

/**
 * Check if the current user can edit a specific user based on role-based permissions
 */
export const canEditUserRole = (currentUserRole: string, targetUserRole: string): boolean => {
  switch (currentUserRole) {
    case 'admin':
      // Admin can edit ALL roles
      return true;
    
    case 'manager':
      // Manager can edit all EXCEPT Admin and Manager
      return targetUserRole !== 'admin' && targetUserRole !== 'manager';
    
    case 'coordinator':
      // Coordinator can edit ONLY Student and Parent
      return targetUserRole === 'student' || targetUserRole === 'parent';
    
    case 'student_manager':
      // Student Manager can edit ONLY Student and Parent
      return targetUserRole === 'student' || targetUserRole === 'parent';
    
    case 'course_manager':
      // Course Manager can edit ONLY Teacher, Student, and Parent
      return targetUserRole === 'teacher' || targetUserRole === 'student' || targetUserRole === 'parent';
    
    default:
      // Teacher, Student, Parent cannot edit anyone
      return false;
  }
};

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
  // Non-admin users will not see admin accounts (filtered on frontend)
  async getAllUsers(): Promise<User[]> {
    try {
      const usersCollection = collection(db, 'users');
      const usersSnapshot = await getDocs(query(usersCollection, orderBy('createdAt', 'desc')));
      
      return usersSnapshot.docs.map(doc => {
        const data = doc.data();
        
        // Ensure all required fields exist (fixes old admin accounts)
        const fixedData = ensureUserFields(data);
        
        return {
          ...fixedData,
          uid: doc.id,
          createdAt: fixedData.createdAt?.toDate() || new Date(),
          lastLogin: fixedData.lastLogin?.toDate(),
          approvedAt: fixedData.approvedAt?.toDate()
        };
      }) as User[];
    } catch (error: any) {
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
      
      return usersSnapshot.docs.map(doc => {
        const data = doc.data();
        const fixedData = ensureUserFields(data);
        
        return {
          ...fixedData,
          uid: doc.id,
          createdAt: fixedData.createdAt?.toDate() || new Date(),
          lastLogin: fixedData.lastLogin?.toDate(),
          approvedAt: fixedData.approvedAt?.toDate()
        };
      }) as User[];
    } catch (error: any) {
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
        const fixedData = ensureUserFields(data);
        
        return {
          ...fixedData,
          uid: doc.id,
          createdAt: fixedData.createdAt?.toDate() || new Date(),
          lastLogin: fixedData.lastLogin?.toDate(),
          approvedAt: fixedData.approvedAt?.toDate()
        };
      }) as User[];
    } catch (error: any) {
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
        const fixedData = ensureUserFields(data);
        
        return {
          ...fixedData,
          uid: doc.id,
          createdAt: fixedData.createdAt?.toDate() || new Date(),
          lastLogin: fixedData.lastLogin?.toDate(),
          approvedAt: fixedData.approvedAt?.toDate()
        };
      }) as User[];
    } catch (error: any) {
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
      
      // Ensure all required fields exist (fixes old admin accounts)
      const fixedData = ensureUserFields(userData);
      
      return {
        ...fixedData,
        uid: userDoc.id,
        createdAt: fixedData.createdAt?.toDate() || new Date(),
        lastLogin: fixedData.lastLogin?.toDate(),
        approvedAt: fixedData.approvedAt?.toDate()
      } as User;
    } catch (error: any) {
      throw new Error(error.message);
    }
  },

  // Update user - with authorization check
  async updateUser(uid: string, updates: Partial<User>, currentUserRole?: string): Promise<void> {
    try {
      // If currentUserRole is provided, check permissions
      if (currentUserRole) {
        const targetUser = await this.getUserById(uid);
        if (!targetUser) {
          throw new Error('User not found');
        }
        
        if (!canEditUserRole(currentUserRole, targetUser.role)) {
          throw new Error('You do not have permission to edit this user');
        }
      }
      
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
      throw new Error(error.message);
    }
  },

  // Delete user is REMOVED as per requirements
  // Delete functionality is completely removed from user management

  // Search users
  async searchUsers(searchTerm: string): Promise<User[]> {
    try {
      const usersCollection = collection(db, 'users');
      const usersSnapshot = await getDocs(usersCollection);
      
      const users = usersSnapshot.docs.map(doc => {
        const data = doc.data();
        const fixedData = ensureUserFields(data);
        
        return {
          ...fixedData,
          uid: doc.id,
          createdAt: fixedData.createdAt?.toDate() || new Date(),
          lastLogin: fixedData.lastLogin?.toDate(),
          approvedAt: fixedData.approvedAt?.toDate()
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
      throw new Error(error.message);
    }
  }
};
