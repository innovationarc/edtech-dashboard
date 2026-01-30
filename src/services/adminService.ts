// src/services/adminService.ts
import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy,
  Timestamp,
  setDoc
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { authService } from './authService';

export interface Admin {
  uid: string;
  userId: string;
  surname: string;
  fullName?: string;
  email?: string;
  phoneNumber: string;
  dob?: string;
  gender?: 'male' | 'female' | 'other';
  bloodGroup?: 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';
  religion?: string;
  address?: string;
  birthCertificateNumber?: string;
  nid?: string;
  role: 'admin';
  status: 'active' | 'inactive';
  profilePictureUrl?: string;
  createdAt: Date;
  createdBy: string;
  lastLogin?: Date;
}

export const adminService = {
  // Generate Admin ID in format: AD-YYMM-XXXXX
  async generateAdminId(): Promise<string> {
    try {
      // Call backend API to generate ID
      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 
                         import.meta.env.VITE_API_URL ||
                         'https://edtech-dashboard-alpha.vercel.app';
      const MASTER_API_KEY = import.meta.env.VITE_SMS_MASTER_KEY;

      const response = await fetch(`${BACKEND_URL}/api/generate-admin-id`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          apiKey: MASTER_API_KEY
        })
      });

      const data = await response.json();
      
      if (!data.success || !data.adminId) {
        throw new Error('Failed to generate Admin ID');
      }

      return data.adminId;
    } catch (error: any) {
      console.error('Error generating Admin ID:', error);
      // Fallback to timestamp-based ID
      const now = new Date();
      const year = now.getFullYear().toString().slice(-2);
      const month = (now.getMonth() + 1).toString().padStart(2, '0');
      const fallbackId = `AD-${year}${month}-${Date.now().toString().slice(-5)}`;
      return fallbackId;
    }
  },

  // Create a new admin
  async createAdmin(
    phoneNumber: string,
    email: string,
    password: string,
    surname: string,
    fullName: string,
    dob: string,
    phone: string,
    bloodGroup: '' | 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-',
    gender: '' | 'male' | 'female' | 'other',
    religion: string,
    address: string,
    birthCertificateNumber: string,
    nid: string,
    createdByAdminId: string
  ): Promise<Admin> {
    try {
      // Generate Admin ID
      const adminId = await this.generateAdminId();

      // Create user in Firebase Auth and Firestore
      const userProfile = await authService.createUser(
        phoneNumber,
        email,
        password,
        surname,
        fullName,
        dob,
        phone,
        '', // guardianPhone not needed for admin
        bloodGroup,
        gender,
        religion,
        '', // classGrade not needed for admin
        'admin',
        false, // skipApproval - admins don't need approval
        adminId // custom userId
      );

      // Update admin document with additional fields
      await updateDoc(doc(db, 'users', userProfile.uid), {
        address: address || '',
        birthCertificateNumber: birthCertificateNumber || '',
        nid: nid || '',
        createdBy: createdByAdminId,
        createdAt: Timestamp.now(),
        status: 'active'
      });

      // Return admin object
      return {
        uid: userProfile.uid,
        userId: adminId,
        surname,
        fullName: fullName || '',
        email: email || '',
        phoneNumber: phone,
        dob: dob || '',
        gender: gender || undefined,
        bloodGroup: bloodGroup || undefined,
        religion: religion || '',
        address: address || '',
        birthCertificateNumber: birthCertificateNumber || '',
        nid: nid || '',
        role: 'admin',
        status: 'active',
        createdAt: new Date(),
        createdBy: createdByAdminId
      };
    } catch (error: any) {
      console.error('Error creating admin:', error);
      throw new Error(error.message || 'Failed to create admin account');
    }
  },

  // Get all admins
  async getAllAdmins(): Promise<Admin[]> {
    try {
      const usersCollection = collection(db, 'users');
      const adminQuery = query(
        usersCollection, 
        where('role', '==', 'admin'),
        orderBy('createdAt', 'desc')
      );
      const adminsSnapshot = await getDocs(adminQuery);
      
      return adminsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          uid: doc.id,
          createdAt: data.createdAt?.toDate() || new Date(),
          lastLogin: data.lastLogin?.toDate(),
        };
      }) as Admin[];
    } catch (error: any) {
      throw new Error(error.message);
    }
  },

  // Get admin by ID
  async getAdminById(uid: string): Promise<Admin | null> {
    try {
      const adminDoc = await getDoc(doc(db, 'users', uid));
      
      if (!adminDoc.exists()) {
        return null;
      }
      
      const adminData = adminDoc.data();
      
      if (adminData.role !== 'admin') {
        return null;
      }
      
      return {
        ...adminData,
        uid: adminDoc.id,
        createdAt: adminData.createdAt?.toDate() || new Date(),
        lastLogin: adminData.lastLogin?.toDate(),
      } as Admin;
    } catch (error: any) {
      throw new Error(error.message);
    }
  },

  // Update admin
  async updateAdmin(uid: string, updates: Partial<Admin>): Promise<void> {
    try {
      const adminRef = doc(db, 'users', uid);
      const updateData = { ...updates };
      
      // Convert dates to Timestamps for Firestore
      if (updateData.createdAt) {
        updateData.createdAt = Timestamp.fromDate(updateData.createdAt) as any;
      }
      if (updateData.lastLogin) {
        updateData.lastLogin = Timestamp.fromDate(updateData.lastLogin) as any;
      }
      
      await updateDoc(adminRef, {
        ...updateData,
        updatedAt: Timestamp.now()
      });
    } catch (error: any) {
      throw new Error(error.message);
    }
  },

  // Delete admin
  async deleteAdmin(uid: string, userEmail?: string): Promise<void> {
    try {
      // Get admin data first to check for profile picture URL
      const adminDoc = await getDoc(doc(db, 'users', uid));
      const adminData = adminDoc.exists() ? adminDoc.data() : null;
      
      // STEP 1: Delete from Firestore (PRIMARY - MUST SUCCEED)
      if (adminDoc.exists()) {
        await deleteDoc(doc(db, 'users', uid));
      }
      
      // STEP 2: Delete profile picture from Supabase (if exists)
      if (adminData?.profilePictureUrl) {
        try {
          const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 
                             import.meta.env.VITE_API_URL ||
                             'https://edtech-dashboard-alpha.vercel.app';
          const MASTER_API_KEY = import.meta.env.VITE_SMS_MASTER_KEY;

          await fetch(`${BACKEND_URL}/api/delete-profile-picture`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              profilePictureUrl: adminData.profilePictureUrl,
              uid: uid,
              apiKey: MASTER_API_KEY
            })
          });
        } catch (supabaseError) {
          // Non-critical, continue
          console.warn('Failed to delete profile picture:', supabaseError);
        }
      }
      
      // STEP 3: Optionally attempt to delete from Firebase Auth (non-critical)
      try {
        const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 
                           import.meta.env.VITE_API_URL ||
                           'https://edtech-dashboard-alpha.vercel.app';
        const MASTER_API_KEY = import.meta.env.VITE_SMS_MASTER_KEY;

        await fetch(`${BACKEND_URL}/api/delete-user`, {
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
      } catch (authError) {
        // Auth deletion failure is non-critical
        console.warn('Failed to delete from Auth:', authError);
      }
      
    } catch (error: any) {
      throw new Error(error.message || 'Failed to delete admin');
    }
  },

  // Search admins
  async searchAdmins(searchTerm: string): Promise<Admin[]> {
    try {
      const usersCollection = collection(db, 'users');
      const adminQuery = query(
        usersCollection, 
        where('role', '==', 'admin')
      );
      const adminsSnapshot = await getDocs(adminQuery);
      
      const admins = adminsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          uid: doc.id,
          createdAt: data.createdAt?.toDate() || new Date(),
          lastLogin: data.lastLogin?.toDate(),
        };
      }) as Admin[];
      
      return admins.filter(admin => 
        admin.surname?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        admin.userId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        admin.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        admin.phoneNumber?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    } catch (error: any) {
      throw new Error(error.message);
    }
  },

  // Get admin statistics
  async getAdminStats(): Promise<{
    total: number;
    active: number;
    inactive: number;
  }> {
    try {
      const admins = await this.getAllAdmins();
      
      return {
        total: admins.length,
        active: admins.filter(a => a.status === 'active').length,
        inactive: admins.filter(a => a.status === 'inactive').length,
      };
    } catch (error: any) {
      throw new Error(error.message);
    }
  }
};
