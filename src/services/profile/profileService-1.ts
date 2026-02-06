// src/services/profile/profileService-1.ts - Admin Profile Service
import { doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { UserProfile } from '../authService';

export interface AdminProfile extends UserProfile {
  uid: string;
  userId: string;
  surname?: string;
  fullName?: string;
  email?: string;
  phoneNumber?: string;
  dob?: string;
  gender?: 'male' | 'female' | 'other';
  bloodGroup?: 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';
  religion?: string;
  address?: string;
  birthCertificateNumber?: string;
  nid?: string;
  designation?: string;
  validTill?: string | 'lifetime';
  role: 'admin';
  status: 'active' | 'inactive' | 'pending';
  profilePictureUrl?: string;
  createdAt: Date;
  createdBy?: string;
  lastLogin?: Date;
}

export const profileService1 = {
  /**
   * Get admin profile by UID
   */
  async getAdminProfile(uid: string): Promise<AdminProfile | null> {
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
      } as AdminProfile;
    } catch (error: any) {
      console.error('Error fetching admin profile:', error);
      throw new Error(error.message || 'Failed to fetch profile');
    }
  },

  /**
   * Update admin profile
   * Excludes: userId, role, status, validTill, createdAt, designation
   */
  async updateAdminProfile(uid: string, updates: Partial<AdminProfile>): Promise<void> {
    try {
      const userRef = doc(db, 'users', uid);
      
      // Remove fields that should not be updated
      const { userId, role, status, validTill, createdAt, designation, ...allowedUpdates } = updates;
      
      const updateData: any = { ...allowedUpdates };
      
      // Convert dates to Timestamps for Firestore
      if (updateData.lastLogin) {
        updateData.lastLogin = Timestamp.fromDate(updateData.lastLogin);
      }
      
      await updateDoc(userRef, {
        ...updateData,
        updatedAt: Timestamp.now()
      });
    } catch (error: any) {
      console.error('Error updating admin profile:', error);
      throw new Error(error.message || 'Failed to update profile');
    }
  }
};
