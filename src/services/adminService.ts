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
  setDoc,
  addDoc
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

export interface SecurityLog {
  id?: string;
  action: 'password_reset' | 'admin_created' | 'admin_edited' | 'admin_deleted';
  targetAdminUid: string;
  targetAdminUserId: string;
  targetAdminSurname: string;
  performedByUid: string;
  performedByUserId: string;
  performedBySurname: string;
  timestamp: Date;
  reason?: string;
  details?: string;
}

// GSM 7-bit character set - extended
const GSM_7BIT_BASIC = "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ\x1BÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
const GSM_7BIT_EXTENDED = "^{}\\[~]|€";

// Convert text to GSM 7-bit compatible format
const toGSM7Bit = (text: string): string => {
  return text.split('').map(char => {
    if (GSM_7BIT_BASIC.includes(char) || GSM_7BIT_EXTENDED.includes(char)) {
      return char;
    }
    
    const replacements: { [key: string]: string } = {
      '"': '"',
      '"': '"',
      "'": "'",
      "'": "'",
      '–': '-',
      '—': '-',
      '…': '...',
      '\u00A0': ' ',
      '•': '*',
      '→': '->',
      '←': '<-',
      '™': '(TM)',
      '©': '(C)',
      '®': '(R)',
    };
    
    return replacements[char] || char;
  }).join('');
};

/**
 * Normalize phone number to 880XXXXXXXXXX format (13 digits, no + sign)
 */
const normalizePhoneNumber = (phoneNumber: string): string => {
  let cleaned = phoneNumber.replace(/\D/g, '');
  
  // If starts with 880, remove it to get the 10 digit number
  if (cleaned.startsWith('880')) {
    cleaned = cleaned.substring(3);
  } 
  // If starts with 88, remove it
  else if (cleaned.startsWith('88')) {
    cleaned = cleaned.substring(2);
  }
  
  // If starts with 0, remove it (11 digit number starting with 0)
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }
  
  // Now we should have a 10 digit number
  if (cleaned.length !== 10) {
    throw new Error('Invalid phone number format');
  }
  
  // Add 880 prefix
  return `880${cleaned}`;
};

/**
 * Send SMS notification to new admin
 */
const sendAdminCreationSMS = async (phoneNumber: string, adminId: string): Promise<void> => {
  try {
    console.log('📤 Sending admin creation SMS');
    
    const normalizedPhone = normalizePhoneNumber(phoneNumber);
    
    // Create SMS message with proper formatting and GSM 7-bit encoding
    let message = `Sir,
This message serves as official confirmation that you have been granted Administrator access on Ed-tech with full system control. This role carries comprehensive administrative authority and is reserved for a select group responsible for overseeing core platform operations.

You can now log in to the platform:
Admin ID: ${adminId}

Note: Your password is not included in this message for security reasons. Contact other administrators if you do not have it.

Please begin executing your administrative responsibilities.

Regards,
Ed-tech Team`;
    
    message = toGSM7Bit(message);
    console.log('📝 SMS message prepared, length:', message.length);

    const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 
                       import.meta.env.VITE_API_URL ||
                       'https://edtech-dashboard-alpha.vercel.app';
    const MASTER_API_KEY = import.meta.env.VITE_SMS_MASTER_KEY;

    const requestBody: any = {
      phoneNumber: normalizedPhone,
      message
    };

    if (MASTER_API_KEY) {
      requestBody.apiKey = MASTER_API_KEY;
    }

    const response = await fetch(`${BACKEND_URL}/api/sms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    if (response.ok) {
      console.log('✅ Admin creation SMS sent successfully');
    } else {
      const errorText = await response.text();
      console.error('❌ Failed to send admin creation SMS:', errorText);
    }
  } catch (error) {
    console.error('❌ Error sending admin creation SMS:', error);
    // Don't throw error - SMS failure shouldn't prevent admin creation
  }
};

export const adminService = {
  // Generate Admin ID using generate-id.ts API
  async generateAdminId(): Promise<string> {
    try {
      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 
                         import.meta.env.VITE_API_URL ||
                         'https://edtech-dashboard-alpha.vercel.app';
      const MASTER_API_KEY = import.meta.env.VITE_SMS_MASTER_KEY;

      const response = await fetch(`${BACKEND_URL}/api/generate-id`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          role: 'admin',
          apiKey: MASTER_API_KEY
        })
      });

      const data = await response.json();
      
      if (!data.success || !data.userId) {
        throw new Error('Failed to generate Admin ID');
      }

      console.log('✅ Generated Admin ID:', data.userId);
      return data.userId;
    } catch (error: any) {
      console.error('Error generating Admin ID:', error);
      // Fallback to timestamp-based ID
      const now = new Date();
      const year = now.getFullYear().toString().slice(-2);
      const month = (now.getMonth() + 1).toString().padStart(2, '0');
      const fallbackId = `AD-${year}${month}-${Date.now().toString().slice(-5)}`;
      console.log('⚠️ Using fallback Admin ID:', fallbackId);
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
    createdByAdminId: string,
    createdByAdminUid: string,
    createdByAdminSurname: string,
    profilePictureUrl?: string
  ): Promise<Admin> {
    try {
      // Generate Admin ID
      const adminId = await this.generateAdminId();

      // Create user in Firebase Auth and Firestore (no email/phone uniqueness check)
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
        adminId, // custom userId
        profilePictureUrl
      );

      // Update admin document with additional fields
      await updateDoc(doc(db, 'users', userProfile.uid), {
        address: address || '',
        birthCertificateNumber: birthCertificateNumber || '',
        nid: nid || '',
        createdBy: createdByAdminId,
        createdAt: Timestamp.now(),
        status: 'active',
        ...(profilePictureUrl && { profilePictureUrl })
      });

      // Log admin creation in security logs
      await addDoc(collection(db, 'security_logs'), {
        action: 'admin_created',
        targetAdminUid: userProfile.uid,
        targetAdminUserId: adminId,
        targetAdminSurname: surname,
        performedByUid: createdByAdminUid,
        performedByUserId: createdByAdminId,
        performedBySurname: createdByAdminSurname,
        timestamp: Timestamp.now(),
        details: `Admin ${surname} (${adminId}) was created`
      });

      // Send SMS notification to new admin
      await sendAdminCreationSMS(phoneNumber, adminId);

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
        createdBy: createdByAdminId,
        profilePictureUrl: profilePictureUrl || undefined
      };
    } catch (error: any) {
      console.error('Error creating admin:', error);
      throw new Error(error.message || 'Failed to create admin account');
    }
  },

  // Reset admin password using password-reset.ts API
  async resetAdminPassword(
    targetAdminUid: string,
    newPassword: string,
    resetByAdmin: Admin,
    reason?: string
  ): Promise<void> {
    try {
      // Get target admin details
      const targetAdmin = await this.getAdminById(targetAdminUid);
      if (!targetAdmin) {
        throw new Error('Target admin not found');
      }

      // Call unified password reset API (password-reset.ts)
      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 
                         import.meta.env.VITE_API_URL ||
                         'https://edtech-dashboard-alpha.vercel.app';
      const MASTER_API_KEY = import.meta.env.VITE_SMS_MASTER_KEY;

      const response = await fetch(`${BACKEND_URL}/api/password-reset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          uid: targetAdminUid,
          newPassword,
          resetByUid: resetByAdmin.uid,
          resetByRole: resetByAdmin.role,
          apiKey: MASTER_API_KEY
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to reset password');
      }

      // Log the password reset in security logs
      await addDoc(collection(db, 'security_logs'), {
        action: 'password_reset',
        targetAdminUid: targetAdmin.uid,
        targetAdminUserId: targetAdmin.userId || 'N/A',
        targetAdminSurname: targetAdmin.surname || 'N/A',
        performedByUid: resetByAdmin.uid,
        performedByUserId: resetByAdmin.userId || 'N/A',
        performedBySurname: resetByAdmin.surname || 'N/A',
        timestamp: Timestamp.now(),
        reason: reason || 'No reason provided',
        details: `Password reset for ${targetAdmin.surname} (${targetAdmin.userId})`
      });

      console.log('✅ Password reset successful and logged');
    } catch (error: any) {
      console.error('Error resetting admin password:', error);
      throw new Error(error.message || 'Failed to reset admin password');
    }
  },

  // Get security logs for an admin
  async getSecurityLogs(adminUid: string): Promise<SecurityLog[]> {
    try {
      const logsCollection = collection(db, 'security_logs');
      const logsQuery = query(
        logsCollection,
        where('targetAdminUid', '==', adminUid),
        orderBy('timestamp', 'desc')
      );
      
      const logsSnapshot = await getDocs(logsQuery);
      
      return logsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          timestamp: data.timestamp?.toDate() || new Date()
        };
      }) as SecurityLog[];
    } catch (error: any) {
      console.error('Error getting security logs:', error);
      return [];
    }
  },

  // Get all security logs
  async getAllSecurityLogs(): Promise<SecurityLog[]> {
    try {
      const logsCollection = collection(db, 'security_logs');
      const logsQuery = query(logsCollection, orderBy('timestamp', 'desc'));
      
      const logsSnapshot = await getDocs(logsQuery);
      
      return logsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          timestamp: data.timestamp?.toDate() || new Date()
        };
      }) as SecurityLog[];
    } catch (error: any) {
      console.error('Error getting all security logs:', error);
      return [];
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
  async updateAdmin(
    uid: string, 
    updates: Partial<Admin>, 
    updatedByAdmin?: Admin
  ): Promise<void> {
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

      // Log admin edit in security logs
      if (updatedByAdmin) {
        const targetAdmin = await this.getAdminById(uid);
        if (targetAdmin) {
          await addDoc(collection(db, 'security_logs'), {
            action: 'admin_edited',
            targetAdminUid: uid,
            targetAdminUserId: targetAdmin.userId || 'N/A',
            targetAdminSurname: targetAdmin.surname || 'N/A',
            performedByUid: updatedByAdmin.uid,
            performedByUserId: updatedByAdmin.userId || 'N/A',
            performedBySurname: updatedByAdmin.surname || 'N/A',
            timestamp: Timestamp.now(),
            details: `Admin details updated for ${targetAdmin.surname} (${targetAdmin.userId})`
          });
        }
      }
    } catch (error: any) {
      throw new Error(error.message);
    }
  },

  // Delete admin using delete-user.ts and delete-profile-picture.ts
  async deleteAdmin(
    uid: string, 
    userEmail?: string,
    deletedByAdmin?: Admin
  ): Promise<void> {
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
      
      // STEP 3: Delete from Firebase Auth using delete-user.ts
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

      // STEP 4: Log admin deletion in security logs
      if (deletedByAdmin && adminData) {
        await addDoc(collection(db, 'security_logs'), {
          action: 'admin_deleted',
          targetAdminUid: uid,
          targetAdminUserId: adminData.userId || 'N/A',
          targetAdminSurname: adminData.surname || 'N/A',
          performedByUid: deletedByAdmin.uid,
          performedByUserId: deletedByAdmin.userId || 'N/A',
          performedBySurname: deletedByAdmin.surname || 'N/A',
          timestamp: Timestamp.now(),
          details: `Admin ${adminData.surname} (${adminData.userId}) was deleted`
        });
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
