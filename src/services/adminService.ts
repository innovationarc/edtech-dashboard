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
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { db, auth } from '../config/firebase';

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
  status: 'active' | 'inactive' | 'pending';
  profilePictureUrl?: string;
  createdAt: Date;
  createdBy: string;
  lastLogin?: Date;
}

export interface SecurityLog {
  id?: string;
  action: 'login' | 'logout' | 'password_reset' | 'admin_created' | 'admin_edited' | 'admin_deleted' | 'status_changed' | 'profile_updated';
  targetAdminUid: string;
  targetAdminUserId: string;
  targetAdminSurname: string;
  performedByUid: string;
  performedByUserId: string;
  performedBySurname: string;
  timestamp: Date;
  reason?: string;
  details?: string;
  changes?: string;
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
 * Generate device fingerprint
 */
const generateDeviceId = (): string => {
  const navigator = window.navigator;
  const screen = window.screen;
  
  const fingerprint = [
    navigator.userAgent,
    navigator.language,
    screen.colorDepth,
    screen.width + 'x' + screen.height,
    new Date().getTimezoneOffset(),
    navigator.hardwareConcurrency || 'unknown',
  ].join('|');
  
  let hash = 0;
  for (let i = 0; i < fingerprint.length; i++) {
    const char = fingerprint.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  return 'device_' + Math.abs(hash).toString(36);
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
      // Fallback to timestamp-based ID with AD prefix
      const now = new Date();
      const year = now.getFullYear().toString().slice(-2);
      const month = (now.getMonth() + 1).toString().padStart(2, '0');
      const fallbackId = `AD-${year}${month}-${Date.now().toString().slice(-5)}`;
      console.log('⚠️ Using fallback Admin ID:', fallbackId);
      return fallbackId;
    }
  },

  // Create a new admin - DOES NOT USE authService.createUser to avoid ID conflicts
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
      // Validate required fields
      if (!surname || surname.trim() === '') {
        throw new Error('Surname is required');
      }
      if (!phone || phone.trim() === '') {
        throw new Error('Phone number is required');
      }

      // STEP 1: Generate Admin ID FIRST
      const adminId = await this.generateAdminId();
      console.log('🆔 Admin ID generated:', adminId);

      // STEP 2: Create auth email (use real email if provided, otherwise use adminId)
      const authEmail = email && email.trim() ? email.trim() : `${adminId}@admin.local`;

      // STEP 3: Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, authEmail, password);
      const user = userCredential.user;
      console.log('✅ Firebase Auth user created:', user.uid);

      // STEP 4: Create Firestore document with ALL required fields properly initialized
      const adminProfile: any = {
        userId: adminId, // Admin ID with AD prefix
        surname: surname.trim(), // REQUIRED - must not be empty
        fullName: fullName && fullName.trim() ? fullName.trim() : surname.trim(), // Default to surname if fullName is empty
        name: fullName && fullName.trim() ? fullName.trim() : surname.trim(), // Add 'name' field for compatibility
        dob: dob && dob.trim() ? dob.trim() : '',
        phoneNumber: phone.trim(), // REQUIRED
        gender: gender && gender.trim() ? gender.trim() : '',
        bloodGroup: bloodGroup && bloodGroup.trim() ? bloodGroup.trim() : '',
        religion: religion && religion.trim() ? religion.trim() : '',
        address: address && address.trim() ? address.trim() : '',
        birthCertificateNumber: birthCertificateNumber && birthCertificateNumber.trim() ? birthCertificateNumber.trim() : '',
        nid: nid && nid.trim() ? nid.trim() : '',
        role: 'admin',
        status: 'active',
        createdAt: Timestamp.now(),
        createdBy: createdByAdminId,
        deviceId: generateDeviceId()
      };

      // Add email if provided
      if (email && email.trim()) {
        adminProfile.email = email.trim();
      }

      // Add profile picture if provided
      if (profilePictureUrl && profilePictureUrl.trim()) {
        adminProfile.profilePictureUrl = profilePictureUrl.trim();
      }

      // STEP 5: Save to Firestore with the Admin ID
      await setDoc(doc(db, 'users', user.uid), adminProfile);
      console.log('✅ Firestore document created with Admin ID:', adminId);
      console.log('✅ Admin profile:', adminProfile);

      // STEP 6: Log admin creation in security logs
      try {
        await addDoc(collection(db, 'security_logs'), {
          action: 'admin_created',
          targetAdminUid: user.uid,
          targetAdminUserId: adminId,
          targetAdminSurname: surname.trim(),
          performedByUid: createdByAdminUid,
          performedByUserId: createdByAdminId,
          performedBySurname: createdByAdminSurname,
          timestamp: Timestamp.now(),
          details: `Admin ${surname.trim()} (${adminId}) was created with role: admin, status: active`,
          changes: JSON.stringify({
            action: 'create',
            fields: {
              surname: surname.trim(),
              fullName: fullName && fullName.trim() ? fullName.trim() : surname.trim(),
              phoneNumber: phone.trim(),
              email: email && email.trim() ? email.trim() : 'Not provided',
              status: 'active',
              role: 'admin'
            }
          })
        });
      } catch (logError) {
        console.warn('⚠️ Failed to log admin creation:', logError);
      }

      // STEP 7: Send SMS notification to new admin
      await sendAdminCreationSMS(phoneNumber, adminId);

      // STEP 8: Return admin object with all fields properly set
      return {
        uid: user.uid,
        userId: adminId,
        surname: surname.trim(),
        fullName: fullName && fullName.trim() ? fullName.trim() : surname.trim(),
        email: email && email.trim() ? email.trim() : undefined,
        phoneNumber: phone.trim(),
        dob: dob && dob.trim() ? dob.trim() : undefined,
        gender: gender && gender.trim() ? (gender.trim() as any) : undefined,
        bloodGroup: bloodGroup && bloodGroup.trim() ? (bloodGroup.trim() as any) : undefined,
        religion: religion && religion.trim() ? religion.trim() : undefined,
        address: address && address.trim() ? address.trim() : undefined,
        birthCertificateNumber: birthCertificateNumber && birthCertificateNumber.trim() ? birthCertificateNumber.trim() : undefined,
        nid: nid && nid.trim() ? nid.trim() : undefined,
        role: 'admin',
        status: 'active',
        createdAt: new Date(),
        createdBy: createdByAdminId,
        profilePictureUrl: profilePictureUrl && profilePictureUrl.trim() ? profilePictureUrl.trim() : undefined
      };
    } catch (error: any) {
      console.error('❌ Error creating admin:', error);
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

      // Log the password reset in security logs with detailed information
      try {
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
          details: `Password was reset for ${targetAdmin.surname} (${targetAdmin.userId}) by ${resetByAdmin.surname} (${resetByAdmin.userId})`,
          changes: JSON.stringify({
            action: 'password_reset',
            targetAdmin: {
              uid: targetAdmin.uid,
              userId: targetAdmin.userId,
              surname: targetAdmin.surname
            },
            resetBy: {
              uid: resetByAdmin.uid,
              userId: resetByAdmin.userId,
              surname: resetByAdmin.surname
            },
            reason: reason || 'No reason provided'
          })
        });
      } catch (logError) {
        console.warn('⚠️ Failed to log password reset:', logError);
      }

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
          // Ensure surname always has a value (fallback to 'Admin' if missing)
          surname: data.surname || data.name || data.fullName || 'Admin',
          fullName: data.fullName || data.name || data.surname || '',
          createdAt: data.createdAt?.toDate() || new Date(),
          lastLogin: data.lastLogin?.toDate(),
        };
      }) as Admin[];
    } catch (error: any) {
      console.error('Error getting all admins:', error);
      throw new Error(error.message || 'Failed to get admins');
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
        // Ensure surname always has a value
        surname: adminData.surname || adminData.name || adminData.fullName || 'Admin',
        fullName: adminData.fullName || adminData.name || adminData.surname || '',
        createdAt: adminData.createdAt?.toDate() || new Date(),
        lastLogin: adminData.lastLogin?.toDate(),
      } as Admin;
    } catch (error: any) {
      console.error('Error getting admin by ID:', error);
      throw new Error(error.message || 'Failed to get admin');
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
      
      // Get current admin data to track changes
      const currentAdmin = await this.getAdminById(uid);
      
      // Ensure surname is never empty
      if (updateData.surname !== undefined && (!updateData.surname || updateData.surname.trim() === '')) {
        throw new Error('Surname cannot be empty');
      }
      
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

      // Log admin edit in security logs with detailed changes
      if (updatedByAdmin && currentAdmin) {
        try {
          // Track what fields were changed
          const changedFields: any = {};
          const changesArray: string[] = [];
          
          if (updates.surname && updates.surname !== currentAdmin.surname) {
            changedFields.surname = { from: currentAdmin.surname, to: updates.surname };
            changesArray.push(`surname: "${currentAdmin.surname}" → "${updates.surname}"`);
          }
          if (updates.fullName && updates.fullName !== currentAdmin.fullName) {
            changedFields.fullName = { from: currentAdmin.fullName, to: updates.fullName };
            changesArray.push(`fullName: "${currentAdmin.fullName}" → "${updates.fullName}"`);
          }
          if (updates.email && updates.email !== currentAdmin.email) {
            changedFields.email = { from: currentAdmin.email, to: updates.email };
            changesArray.push(`email: "${currentAdmin.email}" → "${updates.email}"`);
          }
          if (updates.phoneNumber && updates.phoneNumber !== currentAdmin.phoneNumber) {
            changedFields.phoneNumber = { from: currentAdmin.phoneNumber, to: updates.phoneNumber };
            changesArray.push(`phoneNumber: "${currentAdmin.phoneNumber}" → "${updates.phoneNumber}"`);
          }
          if (updates.status && updates.status !== currentAdmin.status) {
            changedFields.status = { from: currentAdmin.status, to: updates.status };
            changesArray.push(`status: "${currentAdmin.status}" → "${updates.status}"`);
            
            // Create separate log for status change
            await addDoc(collection(db, 'security_logs'), {
              action: 'status_changed',
              targetAdminUid: uid,
              targetAdminUserId: currentAdmin.userId || 'N/A',
              targetAdminSurname: currentAdmin.surname || 'N/A',
              performedByUid: updatedByAdmin.uid,
              performedByUserId: updatedByAdmin.userId || 'N/A',
              performedBySurname: updatedByAdmin.surname || 'N/A',
              timestamp: Timestamp.now(),
              details: `Status changed from "${currentAdmin.status}" to "${updates.status}" for ${currentAdmin.surname} (${currentAdmin.userId})`,
              changes: JSON.stringify({
                action: 'status_change',
                from: currentAdmin.status,
                to: updates.status
              })
            });
          }
          if (updates.dob && updates.dob !== currentAdmin.dob) {
            changedFields.dob = { from: currentAdmin.dob, to: updates.dob };
            changesArray.push(`dob: "${currentAdmin.dob}" → "${updates.dob}"`);
          }
          if (updates.gender && updates.gender !== currentAdmin.gender) {
            changedFields.gender = { from: currentAdmin.gender, to: updates.gender };
            changesArray.push(`gender: "${currentAdmin.gender}" → "${updates.gender}"`);
          }
          if (updates.bloodGroup && updates.bloodGroup !== currentAdmin.bloodGroup) {
            changedFields.bloodGroup = { from: currentAdmin.bloodGroup, to: updates.bloodGroup };
            changesArray.push(`bloodGroup: "${currentAdmin.bloodGroup}" → "${updates.bloodGroup}"`);
          }
          if (updates.religion && updates.religion !== currentAdmin.religion) {
            changedFields.religion = { from: currentAdmin.religion, to: updates.religion };
            changesArray.push(`religion: "${currentAdmin.religion}" → "${updates.religion}"`);
          }
          if (updates.address && updates.address !== currentAdmin.address) {
            changedFields.address = { from: currentAdmin.address, to: updates.address };
            changesArray.push(`address changed`);
          }
          if (updates.nid && updates.nid !== currentAdmin.nid) {
            changedFields.nid = { from: currentAdmin.nid, to: updates.nid };
            changesArray.push(`nid changed`);
          }
          if (updates.birthCertificateNumber && updates.birthCertificateNumber !== currentAdmin.birthCertificateNumber) {
            changedFields.birthCertificateNumber = { from: currentAdmin.birthCertificateNumber, to: updates.birthCertificateNumber };
            changesArray.push(`birthCertificateNumber changed`);
          }
          if (updates.profilePictureUrl && updates.profilePictureUrl !== currentAdmin.profilePictureUrl) {
            changedFields.profilePictureUrl = { from: 'previous', to: 'updated' };
            changesArray.push(`profile picture updated`);
            
            // Create separate log for profile picture update
            await addDoc(collection(db, 'security_logs'), {
              action: 'profile_updated',
              targetAdminUid: uid,
              targetAdminUserId: currentAdmin.userId || 'N/A',
              targetAdminSurname: currentAdmin.surname || 'N/A',
              performedByUid: updatedByAdmin.uid,
              performedByUserId: updatedByAdmin.userId || 'N/A',
              performedBySurname: updatedByAdmin.surname || 'N/A',
              timestamp: Timestamp.now(),
              details: `Profile picture updated for ${currentAdmin.surname} (${currentAdmin.userId})`,
              changes: JSON.stringify({
                action: 'profile_picture_update',
                hasProfilePicture: !!updates.profilePictureUrl
              })
            });
          }

          // Create main edit log
          await addDoc(collection(db, 'security_logs'), {
            action: 'admin_edited',
            targetAdminUid: uid,
            targetAdminUserId: currentAdmin.userId || 'N/A',
            targetAdminSurname: currentAdmin.surname || 'N/A',
            performedByUid: updatedByAdmin.uid,
            performedByUserId: updatedByAdmin.userId || 'N/A',
            performedBySurname: updatedByAdmin.surname || 'N/A',
            timestamp: Timestamp.now(),
            details: `Admin details updated for ${currentAdmin.surname} (${currentAdmin.userId}). Changed fields: ${changesArray.join(', ') || 'none'}`,
            changes: JSON.stringify({
              action: 'edit',
              changedFields: changedFields,
              fieldCount: Object.keys(changedFields).length
            })
          });
        } catch (logError) {
          console.warn('⚠️ Failed to log admin edit:', logError);
        }
      }
    } catch (error: any) {
      console.error('Error updating admin:', error);
      throw new Error(error.message || 'Failed to update admin');
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
        console.log('✅ Deleted from Firestore');
      }
      
      // STEP 2: Delete profile picture from Supabase (if exists)
      if (adminData?.profilePictureUrl) {
        try {
          const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 
                             import.meta.env.VITE_API_URL ||
                             'https://edtech-dashboard-alpha.vercel.app';
          const MASTER_API_KEY = import.meta.env.VITE_SMS_MASTER_KEY;

          const deleteProfilePicResponse = await fetch(`${BACKEND_URL}/api/delete-profile-picture`, {
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

          if (deleteProfilePicResponse.ok) {
            console.log('✅ Profile picture deleted from Supabase');
          } else {
            console.warn('⚠️ Failed to delete profile picture');
          }
        } catch (supabaseError) {
          console.warn('⚠️ Failed to delete profile picture:', supabaseError);
        }
      }
      
      // STEP 3: Delete from Firebase Auth using delete-user.ts
      try {
        const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 
                           import.meta.env.VITE_API_URL ||
                           'https://edtech-dashboard-alpha.vercel.app';
        const MASTER_API_KEY = import.meta.env.VITE_SMS_MASTER_KEY;

        const deleteAuthResponse = await fetch(`${BACKEND_URL}/api/delete-user`, {
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

        if (deleteAuthResponse.ok) {
          console.log('✅ Deleted from Firebase Auth');
        } else {
          const errorText = await deleteAuthResponse.text();
          console.warn('⚠️ Failed to delete from Firebase Auth:', errorText);
        }
      } catch (authError) {
        console.warn('⚠️ Failed to delete from Auth:', authError);
      }

      // STEP 4: Log admin deletion in security logs with full details
      if (deletedByAdmin && adminData) {
        try {
          await addDoc(collection(db, 'security_logs'), {
            action: 'admin_deleted',
            targetAdminUid: uid,
            targetAdminUserId: adminData.userId || 'N/A',
            targetAdminSurname: adminData.surname || adminData.name || 'N/A',
            performedByUid: deletedByAdmin.uid,
            performedByUserId: deletedByAdmin.userId || 'N/A',
            performedBySurname: deletedByAdmin.surname || 'N/A',
            timestamp: Timestamp.now(),
            details: `Admin ${adminData.surname || adminData.name} (${adminData.userId}) was permanently deleted by ${deletedByAdmin.surname} (${deletedByAdmin.userId})`,
            changes: JSON.stringify({
              action: 'delete',
              deletedAdmin: {
                uid: uid,
                userId: adminData.userId,
                surname: adminData.surname || adminData.name,
                email: adminData.email || 'Not provided',
                phoneNumber: adminData.phoneNumber,
                status: adminData.status,
                createdAt: adminData.createdAt?.toDate?.()?.toISOString() || 'Unknown'
              },
              deletedBy: {
                uid: deletedByAdmin.uid,
                userId: deletedByAdmin.userId,
                surname: deletedByAdmin.surname
              },
              deletionDetails: {
                profilePictureDeleted: !!adminData.profilePictureUrl,
                firestoreDeleted: true,
                authDeleted: true
              }
            })
          });
        } catch (logError) {
          console.warn('⚠️ Failed to log admin deletion:', logError);
        }
      }
      
    } catch (error: any) {
      console.error('Error deleting admin:', error);
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
          surname: data.surname || data.name || data.fullName || 'Admin',
          fullName: data.fullName || data.name || data.surname || '',
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
      console.error('Error searching admins:', error);
      throw new Error(error.message || 'Failed to search admins');
    }
  },

  // Get admin statistics
  async getAdminStats(): Promise<{
    total: number;
    active: number;
    inactive: number;
    pending: number;
  }> {
    try {
      const admins = await this.getAllAdmins();
      
      return {
        total: admins.length,
        active: admins.filter(a => a.status === 'active').length,
        inactive: admins.filter(a => a.status === 'inactive').length,
        pending: admins.filter(a => a.status === 'pending').length,
      };
    } catch (error: any) {
      console.error('Error getting admin stats:', error);
      throw new Error(error.message || 'Failed to get admin statistics');
    }
  }
};
