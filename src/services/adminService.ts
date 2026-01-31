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
  action: 'login' | 'logout' | 'password_reset' | 'admin_created' | 'admin_edited' | 'admin_deleted' | 'status_changed' | 'profile_updated' | 'phone_number_changed';
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
 * Send SMS notification
 */
const sendSMS = async (phoneNumber: string, message: string): Promise<void> => {
  try {
    const normalizedPhone = normalizePhoneNumber(phoneNumber);
    const gsmMessage = toGSM7Bit(message);

    const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 
                       import.meta.env.VITE_API_URL ||
                       'https://edtech-dashboard-alpha.vercel.app';
    const MASTER_API_KEY = import.meta.env.VITE_SMS_MASTER_KEY;

    const requestBody: any = {
      phoneNumber: normalizedPhone,
      message: gsmMessage
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
      console.log('✅ SMS sent successfully');
    } else {
      const errorText = await response.text();
      console.error('❌ Failed to send SMS:', errorText);
    }
  } catch (error) {
    console.error('❌ Error sending SMS:', error);
  }
};

/**
 * Send SMS notification to new admin
 */
const sendAdminCreationSMS = async (phoneNumber: string, adminId: string): Promise<void> => {
  const message = `Sir,
This message serves as official confirmation that you have been granted Administrator access on Ed-tech with full system control. This role carries comprehensive administrative authority and is reserved for a select group responsible for overseeing core platform operations.

You can now log in to the platform:
Admin ID: ${adminId}

Note: Your password is not included in this message for security reasons. Contact other administrators if you do not have it.

Please begin executing your administrative responsibilities.

Regards,
Ed-tech Team`;
  
  await sendSMS(phoneNumber, message);
};

/**
 * Send password reset SMS notification
 */
const sendPasswordResetSMS = async (
  phoneNumber: string, 
  adminId: string, 
  changedByAdminId: string
): Promise<void> => {
  const message = `Sir,
Your Ed-tech administrator account password has been changed.
Admin ID: ${adminId}
Changed by: ${changedByAdminId}

If you were not aware of this change, please take immediate action to secure your account.

Regards,
Ed-tech Team`;
  
  await sendSMS(phoneNumber, message);
};

/**
 * Send status change SMS notification
 */
const sendStatusChangeSMS = async (
  phoneNumber: string,
  adminId: string,
  previousStatus: string,
  newStatus: string,
  changedByAdminId: string
): Promise<void> => {
  const message = `Sir,
The status of your Ed-tech administrator account has been updated from ${previousStatus} to ${newStatus}.
Admin ID: ${adminId}
Changed by: ${changedByAdminId}

If you were not aware of this change, please take immediate action.

Regards,
Ed-tech Team`;
  
  await sendSMS(phoneNumber, message);
};

/**
 * Send phone number change SMS notification to OLD number
 */
const sendPhoneNumberChangeSMS = async (
  oldPhoneNumber: string,
  newPhoneNumber: string,
  adminId: string,
  changedByAdminId: string
): Promise<void> => {
  const message = `Sir,
The primary mobile number of your Ed-tech administrator account has been updated to ${newPhoneNumber}.
Admin ID: ${adminId}
Changed by: ${changedByAdminId}

If you were not aware of this change, please take immediate action.
Regards,
Ed-tech Team`;
  
  await sendSMS(oldPhoneNumber, message);
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
      const timestamp = Date.now().toString().slice(-6);
      return `AD${year}${month}${timestamp}`;
    }
  },

  // Create new admin using register.ts API
  async createAdmin(adminData: {
    surname: string;
    fullName?: string;
    phoneNumber: string;
    email: string;
    password: string;
    dob?: string;
    gender?: 'male' | 'female' | 'other';
    bloodGroup?: 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';
    religion?: string;
    address?: string;
    birthCertificateNumber?: string;
    nid?: string;
    status?: 'active' | 'inactive' | 'pending';
    profilePictureUrl?: string;
    createdByAdmin?: Admin;
  }): Promise<Admin> {
    try {
      // Generate Admin ID first
      const userId = await this.generateAdminId();
      
      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 
                         import.meta.env.VITE_API_URL ||
                         'https://edtech-dashboard-alpha.vercel.app';
      const MASTER_API_KEY = import.meta.env.VITE_SMS_MASTER_KEY;

      // Register the admin using the register.ts API
      const response = await fetch(`${BACKEND_URL}/api/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...adminData,
          userId,
          role: 'admin',
          apiKey: MASTER_API_KEY
        })
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || 'Failed to create admin');
      }

      console.log('✅ Admin created successfully');

      // Send SMS notification to new admin
      if (adminData.phoneNumber) {
        await sendAdminCreationSMS(adminData.phoneNumber, userId);
      }

      // Log admin creation in security logs
      if (adminData.createdByAdmin) {
        try {
          await addDoc(collection(db, 'security_logs'), {
            action: 'admin_created',
            targetAdminUid: result.uid,
            targetAdminUserId: userId,
            targetAdminSurname: adminData.surname,
            performedByUid: adminData.createdByAdmin.uid,
            performedByUserId: adminData.createdByAdmin.userId || 'N/A',
            performedBySurname: adminData.createdByAdmin.surname || 'N/A',
            timestamp: Timestamp.now(),
            details: `New admin ${adminData.surname} (${userId}) was created by ${adminData.createdByAdmin.surname} (${adminData.createdByAdmin.userId})`,
            changes: JSON.stringify({
              action: 'create',
              adminData: {
                userId,
                surname: adminData.surname,
                fullName: adminData.fullName,
                phoneNumber: adminData.phoneNumber,
                email: adminData.email,
                status: adminData.status || 'active'
              }
            })
          });
        } catch (logError) {
          console.warn('⚠️ Failed to log admin creation:', logError);
        }
      }

      return {
        uid: result.uid,
        userId,
        surname: adminData.surname,
        fullName: adminData.fullName,
        email: adminData.email,
        phoneNumber: adminData.phoneNumber,
        dob: adminData.dob,
        gender: adminData.gender,
        bloodGroup: adminData.bloodGroup,
        religion: adminData.religion,
        address: adminData.address,
        birthCertificateNumber: adminData.birthCertificateNumber,
        nid: adminData.nid,
        role: 'admin',
        status: adminData.status || 'active',
        profilePictureUrl: adminData.profilePictureUrl,
        createdAt: new Date(),
        createdBy: adminData.createdByAdmin?.userId || 'system',
      };
    } catch (error: any) {
      console.error('Error creating admin:', error);
      throw new Error(error.message || 'Failed to create admin');
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
      
      return admins;
    } catch (error: any) {
      console.error('Error fetching admins:', error);
      throw new Error(error.message || 'Failed to fetch admins');
    }
  },

  // Get security logs
  async getSecurityLogs(adminUid?: string): Promise<SecurityLog[]> {
    try {
      const logsCollection = collection(db, 'security_logs');
      let logsQuery;
      
      if (adminUid) {
        // Get logs for specific admin (both as target and performer)
        logsQuery = query(
          logsCollection,
          orderBy('timestamp', 'desc')
        );
      } else {
        // Get all logs
        logsQuery = query(
          logsCollection,
          orderBy('timestamp', 'desc')
        );
      }
      
      const logsSnapshot = await getDocs(logsQuery);
      
      let logs = logsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          action: data.action,
          targetAdminUid: data.targetAdminUid,
          targetAdminUserId: data.targetAdminUserId,
          targetAdminSurname: data.targetAdminSurname,
          performedByUid: data.performedByUid,
          performedByUserId: data.performedByUserId,
          performedBySurname: data.performedBySurname,
          timestamp: data.timestamp?.toDate() || new Date(),
          reason: data.reason,
          details: data.details,
          changes: data.changes,
        };
      }) as SecurityLog[];

      // Filter by adminUid if provided
      if (adminUid) {
        logs = logs.filter(log => 
          log.targetAdminUid === adminUid || log.performedByUid === adminUid
        );
      }
      
      return logs;
    } catch (error: any) {
      console.error('Error fetching security logs:', error);
      throw new Error(error.message || 'Failed to fetch security logs');
    }
  },

  // Reset admin password using password-reset.ts API
  async resetAdminPassword(
    uid: string, 
    newPassword: string,
    resetByAdmin?: Admin
  ): Promise<void> {
    try {
      // Get admin data first for SMS notification
      const adminDoc = await getDoc(doc(db, 'users', uid));
      if (!adminDoc.exists()) {
        throw new Error('Admin not found');
      }
      const adminData = adminDoc.data();

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
          uid,
          newPassword,
          resetByUid: resetByAdmin?.uid,
          resetByRole: resetByAdmin?.role,
          apiKey: MASTER_API_KEY
        })
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || 'Failed to reset password');
      }

      console.log('✅ Password reset successfully');

      // Send SMS notification
      if (adminData.phoneNumber && resetByAdmin) {
        await sendPasswordResetSMS(
          adminData.phoneNumber,
          adminData.userId || uid,
          resetByAdmin.userId || 'N/A'
        );
      }

      // Log password reset in security logs
      if (resetByAdmin) {
        try {
          await addDoc(collection(db, 'security_logs'), {
            action: 'password_reset',
            targetAdminUid: uid,
            targetAdminUserId: adminData.userId || 'N/A',
            targetAdminSurname: adminData.surname || adminData.name || 'N/A',
            performedByUid: resetByAdmin.uid,
            performedByUserId: resetByAdmin.userId || 'N/A',
            performedBySurname: resetByAdmin.surname || 'N/A',
            timestamp: Timestamp.now(),
            details: `Password was reset for ${adminData.surname || adminData.name} (${adminData.userId}) by ${resetByAdmin.surname} (${resetByAdmin.userId})`,
            changes: JSON.stringify({
              action: 'password_reset',
              resetBy: {
                uid: resetByAdmin.uid,
                userId: resetByAdmin.userId,
                surname: resetByAdmin.surname
              }
            })
          });
        } catch (logError) {
          console.warn('⚠️ Failed to log password reset:', logError);
        }
      }
    } catch (error: any) {
      console.error('Error resetting password:', error);
      throw new Error(error.message || 'Failed to reset password');
    }
  },

  // Update admin status
  async updateAdminStatus(
    uid: string, 
    newStatus: 'active' | 'inactive' | 'pending',
    updatedByAdmin?: Admin
  ): Promise<void> {
    try {
      // Get current admin data first
      const adminDoc = await getDoc(doc(db, 'users', uid));
      if (!adminDoc.exists()) {
        throw new Error('Admin not found');
      }
      const currentAdmin = adminDoc.data();
      const previousStatus = currentAdmin.status;

      // Update status in Firestore
      await updateDoc(doc(db, 'users', uid), {
        status: newStatus,
      });

      console.log('✅ Admin status updated successfully');

      // Send SMS notification
      if (currentAdmin.phoneNumber && updatedByAdmin && previousStatus !== newStatus) {
        await sendStatusChangeSMS(
          currentAdmin.phoneNumber,
          currentAdmin.userId || uid,
          previousStatus,
          newStatus,
          updatedByAdmin.userId || 'N/A'
        );
      }

      // Log status change in security logs
      if (updatedByAdmin && previousStatus !== newStatus) {
        try {
          await addDoc(collection(db, 'security_logs'), {
            action: 'status_changed',
            targetAdminUid: uid,
            targetAdminUserId: currentAdmin.userId || 'N/A',
            targetAdminSurname: currentAdmin.surname || currentAdmin.name || 'N/A',
            performedByUid: updatedByAdmin.uid,
            performedByUserId: updatedByAdmin.userId || 'N/A',
            performedBySurname: updatedByAdmin.surname || 'N/A',
            timestamp: Timestamp.now(),
            details: `Status changed from ${previousStatus} to ${newStatus} for ${currentAdmin.surname || currentAdmin.name} (${currentAdmin.userId}) by ${updatedByAdmin.surname} (${updatedByAdmin.userId})`,
            changes: JSON.stringify({
              action: 'status_change',
              previousStatus,
              newStatus,
              changedBy: {
                uid: updatedByAdmin.uid,
                userId: updatedByAdmin.userId,
                surname: updatedByAdmin.surname
              }
            })
          });
        } catch (logError) {
          console.warn('⚠️ Failed to log status change:', logError);
        }
      }
    } catch (error: any) {
      console.error('Error updating admin status:', error);
      throw new Error(error.message || 'Failed to update admin status');
    }
  },

  // Update admin details
  async updateAdmin(
    uid: string, 
    updates: Partial<Admin>,
    updatedByAdmin?: Admin
  ): Promise<void> {
    try {
      // Get current admin data first
      const adminDoc = await getDoc(doc(db, 'users', uid));
      if (!adminDoc.exists()) {
        throw new Error('Admin not found');
      }
      const currentAdmin = adminDoc.data();

      // Check if phone number is being changed
      const isPhoneNumberChanged = updates.phoneNumber && 
                                   updates.phoneNumber !== currentAdmin.phoneNumber;
      const oldPhoneNumber = currentAdmin.phoneNumber;

      // Prepare update data
      const updateData: any = {};
      
      if (updates.surname !== undefined) updateData.surname = updates.surname;
      if (updates.fullName !== undefined) updateData.fullName = updates.fullName;
      if (updates.email !== undefined) updateData.email = updates.email;
      if (updates.phoneNumber !== undefined) updateData.phoneNumber = updates.phoneNumber;
      if (updates.dob !== undefined) updateData.dob = updates.dob;
      if (updates.gender !== undefined) updateData.gender = updates.gender;
      if (updates.bloodGroup !== undefined) updateData.bloodGroup = updates.bloodGroup;
      if (updates.religion !== undefined) updateData.religion = updates.religion;
      if (updates.address !== undefined) updateData.address = updates.address;
      if (updates.nid !== undefined) updateData.nid = updates.nid;
      if (updates.birthCertificateNumber !== undefined) updateData.birthCertificateNumber = updates.birthCertificateNumber;
      if (updates.profilePictureUrl !== undefined) updateData.profilePictureUrl = updates.profilePictureUrl;

      // Update admin in Firestore
      await updateDoc(doc(db, 'users', uid), updateData);

      console.log('✅ Admin updated successfully');

      // Send SMS if phone number was changed (to OLD number)
      if (isPhoneNumberChanged && oldPhoneNumber && updatedByAdmin) {
        await sendPhoneNumberChangeSMS(
          oldPhoneNumber,
          updates.phoneNumber!,
          currentAdmin.userId || uid,
          updatedByAdmin.userId || 'N/A'
        );
      }

      // Log changes in security logs
      if (updatedByAdmin) {
        try {
          const changedFields: any = {};
          const changesArray: string[] = [];

          // Track all changed fields
          if (updates.surname && updates.surname !== currentAdmin.surname) {
            changedFields.surname = { from: currentAdmin.surname, to: updates.surname };
            changesArray.push(`surname changed`);
          }
          if (updates.fullName && updates.fullName !== currentAdmin.fullName) {
            changedFields.fullName = { from: currentAdmin.fullName, to: updates.fullName };
            changesArray.push(`fullName changed`);
          }
          if (updates.email && updates.email !== currentAdmin.email) {
            changedFields.email = { from: currentAdmin.email, to: updates.email };
            changesArray.push(`email changed`);
          }
          if (isPhoneNumberChanged) {
            changedFields.phoneNumber = { from: oldPhoneNumber, to: updates.phoneNumber };
            changesArray.push(`phoneNumber changed`);
            
            // Create separate log for phone number change
            await addDoc(collection(db, 'security_logs'), {
              action: 'phone_number_changed',
              targetAdminUid: uid,
              targetAdminUserId: currentAdmin.userId || 'N/A',
              targetAdminSurname: currentAdmin.surname || 'N/A',
              performedByUid: updatedByAdmin.uid,
              performedByUserId: updatedByAdmin.userId || 'N/A',
              performedBySurname: updatedByAdmin.surname || 'N/A',
              timestamp: Timestamp.now(),
              details: `Phone number changed from ${oldPhoneNumber} to ${updates.phoneNumber} for ${currentAdmin.surname} (${currentAdmin.userId})`,
              changes: JSON.stringify({
                action: 'phone_number_change',
                oldPhoneNumber,
                newPhoneNumber: updates.phoneNumber
              })
            });
          }
          if (updates.dob && updates.dob !== currentAdmin.dob) {
            changedFields.dob = { from: currentAdmin.dob, to: updates.dob };
            changesArray.push(`dob changed`);
          }
          if (updates.gender && updates.gender !== currentAdmin.gender) {
            changedFields.gender = { from: currentAdmin.gender, to: updates.gender };
            changesArray.push(`gender changed`);
          }
          if (updates.bloodGroup && updates.bloodGroup !== currentAdmin.bloodGroup) {
            changedFields.bloodGroup = { from: currentAdmin.bloodGroup, to: updates.bloodGroup };
            changesArray.push(`bloodGroup changed`);
          }
          if (updates.religion && updates.religion !== currentAdmin.religion) {
            changedFields.religion = { from: currentAdmin.religion, to: updates.religion };
            changesArray.push(`religion changed`);
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

  // Get all security logs (for all admins)
  async getAllSecurityLogs(): Promise<SecurityLog[]> {
    try {
      const logsCollection = collection(db, 'security_logs');
      const logsQuery = query(
        logsCollection,
        orderBy('timestamp', 'desc')
      );
      
      const logsSnapshot = await getDocs(logsQuery);
      
      const logs = logsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          action: data.action,
          targetAdminUid: data.targetAdminUid,
          targetAdminUserId: data.targetAdminUserId,
          targetAdminSurname: data.targetAdminSurname,
          performedByUid: data.performedByUid,
          performedByUserId: data.performedByUserId,
          performedBySurname: data.performedBySurname,
          timestamp: data.timestamp?.toDate() || new Date(),
          reason: data.reason,
          details: data.details,
          changes: data.changes,
        };
      }) as SecurityLog[];
      
      return logs;
    } catch (error: any) {
      console.error('Error fetching all security logs:', error);
      throw new Error(error.message || 'Failed to fetch all security logs');
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
