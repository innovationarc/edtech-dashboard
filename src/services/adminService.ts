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
 * Normalize phone number to 13-digit format: 8801XXXXXXXXX
 * 
 * Rules:
 * - 10-digit starting with 1 (1XXXXXXXXX) → add 880 prefix → 8801XXXXXXXXX
 * - 11-digit starting with 0 (01XXXXXXXXX) → add 88 prefix → 8801XXXXXXXXX
 * - Already 13-digit starting with 880 → keep as is
 * - Result is always 13 digits
 */
const normalizePhoneNumber = (phoneNumber: string): string => {
  // Handle null, undefined, or empty string
  if (!phoneNumber || phoneNumber.trim() === '') {
    throw new Error('Phone number is required');
  }

  // Remove all non-digit characters
  let cleaned = phoneNumber.replace(/\D/g, '');
  
  // If already 13 digits starting with 880, it's already normalized
  if (cleaned.length === 13 && cleaned.startsWith('880')) {
    return cleaned;
  }
  
  // If starts with 880 (but not 13 digits), remove it and reprocess
  if (cleaned.startsWith('880')) {
    cleaned = cleaned.substring(3);
  } 
  // If starts with 88, remove it
  else if (cleaned.startsWith('88')) {
    cleaned = cleaned.substring(2);
  }
  
  // Now handle the two main cases:
  
  // Case 1: 11-digit number starting with 0 (01XXXXXXXXX)
  if (cleaned.length === 11 && cleaned.startsWith('0')) {
    // Remove the leading 0, then add 880
    return `880${cleaned.substring(1)}`;
  }
  
  // Case 2: 10-digit number starting with 1 (1XXXXXXXXX)
  if (cleaned.length === 10 && cleaned.startsWith('1')) {
    // Add 880 prefix
    return `880${cleaned}`;
  }
  
  // If we have 10 digits but starting with 0, remove it
  if (cleaned.length === 10 && cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }
  
  // After all processing, we should have 10 digits starting with 1
  if (cleaned.length === 10 && cleaned.startsWith('1')) {
    return `880${cleaned}`;
  }
  
  // If none of the above conditions match, it's an invalid number
  throw new Error('Invalid phone number format. Please enter a valid Bangladesh phone number.');
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

If you have any questions, please contact your administrator.

Regards,
Ed-tech Team`;
  
  await sendSMS(phoneNumber, message);
};

/**
 * Send phone number change SMS notification
 */
const sendPhoneNumberChangeSMS = async (
  oldPhoneNumber: string,
  newPhoneNumber: string,
  adminId: string,
  changedByAdminId: string
): Promise<void> => {
  const message = `Sir,
The phone number for your Ed-tech administrator account has been changed.
Admin ID: ${adminId}
Old Number: ${oldPhoneNumber}
New Number: ${newPhoneNumber}
Changed by: ${changedByAdminId}

If you were not aware of this change, please take immediate action to secure your account.

Regards,
Ed-tech Team`;
  
  await sendSMS(oldPhoneNumber, message);
};

export const adminService = {
  // Generate unique Admin ID
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

      // Check if response is ok before parsing JSON
      if (!response.ok) {
        throw new Error(`API returned status ${response.status}`);
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('API did not return JSON response');
      }

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

  // Create new admin - FIXED VERSION with proper parameter handling and error checking
  async createAdmin(
    phoneNumber: string,
    email: string,
    password: string,
    surname: string,
    fullName?: string,
    dob?: string,
    phone?: string,
    bloodGroup?: 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-',
    gender?: 'male' | 'female' | 'other',
    religion?: string,
    address?: string,
    birthCertificateNumber?: string,
    nid?: string,
    createdByAdminId?: string,
    createdByAdminUid?: string,
    createdByAdminSurname?: string,
    profilePictureUrl?: string
  ): Promise<Admin> {
    try {
      // Validate required fields
      if (!phoneNumber || phoneNumber.trim() === '') {
        throw new Error('Phone number is required');
      }
      if (!surname || surname.trim() === '') {
        throw new Error('Surname is required');
      }
      if (!password || password.trim() === '') {
        throw new Error('Password is required');
      }

      // Normalize phone number BEFORE sending to API
      const normalizedPhoneNumber = normalizePhoneNumber(phoneNumber);
      
      // Generate Admin ID first
      const userId = await this.generateAdminId();
      
      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 
                         import.meta.env.VITE_API_URL ||
                         'https://edtech-dashboard-alpha.vercel.app';
      const MASTER_API_KEY = import.meta.env.VITE_SMS_MASTER_KEY;

      // Prepare admin data
      const adminData: any = {
        surname,
        fullName,
        phoneNumber: normalizedPhoneNumber,
        email: email || '',
        password,
        dob,
        gender,
        bloodGroup,
        religion,
        address,
        birthCertificateNumber,
        nid,
        userId,
        role: 'admin',
        status: 'active',
        profilePictureUrl,
        apiKey: MASTER_API_KEY
      };

      // Register the admin using the register.ts API with normalized phone
      const response = await fetch(`${BACKEND_URL}/api/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(adminData)
      });

      // Check if response is ok before parsing JSON
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error Response:', errorText);
        throw new Error(`API returned status ${response.status}: ${errorText}`);
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const responseText = await response.text();
        console.error('Non-JSON Response:', responseText);
        throw new Error('API did not return JSON response');
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || 'Failed to create admin');
      }

      console.log('✅ Admin created successfully with normalized phone:', normalizedPhoneNumber);

      // Send SMS notification to new admin (use normalized phone)
      if (normalizedPhoneNumber) {
        await sendAdminCreationSMS(normalizedPhoneNumber, userId);
      }

      // Log admin creation in security logs
      if (createdByAdminUid && createdByAdminId && createdByAdminSurname) {
        try {
          await addDoc(collection(db, 'security_logs'), {
            action: 'admin_created',
            targetAdminUid: result.uid,
            targetAdminUserId: userId,
            targetAdminSurname: surname,
            performedByUid: createdByAdminUid,
            performedByUserId: createdByAdminId,
            performedBySurname: createdByAdminSurname,
            timestamp: Timestamp.now(),
            details: `New admin ${surname} (${userId}) was created by ${createdByAdminSurname} (${createdByAdminId})`,
            changes: JSON.stringify({
              action: 'create',
              adminData: {
                userId,
                surname,
                fullName,
                phoneNumber: normalizedPhoneNumber,
                email: email || '',
                status: 'active'
              }
            })
          });
          console.log('✅ Admin creation logged in security logs');
        } catch (logError) {
          console.warn('⚠️ Failed to log admin creation:', logError);
        }
      }

      return {
        uid: result.uid,
        userId,
        surname,
        fullName,
        email: email || '',
        phoneNumber: normalizedPhoneNumber,
        dob,
        gender,
        bloodGroup,
        religion,
        address,
        birthCertificateNumber,
        nid,
        role: 'admin',
        status: 'active',
        profilePictureUrl,
        createdAt: new Date(),
        createdBy: createdByAdminId || 'system',
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
      
      console.log(`✅ Fetched ${logs.length} security logs${adminUid ? ' for admin ' + adminUid : ''}`);
      return logs;
    } catch (error: any) {
      console.error('Error fetching security logs:', error);
      throw new Error(error.message || 'Failed to fetch security logs');
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
      
      console.log(`✅ Fetched ${logs.length} total security logs`);
      return logs;
    } catch (error: any) {
      console.error('Error fetching all security logs:', error);
      throw new Error(error.message || 'Failed to fetch all security logs');
    }
  },

  // Reset admin password using password-reset.ts API
  async resetAdminPassword(
    uid: string, 
    newPassword: string,
    resetByAdmin?: Admin
  ): Promise<void> {
    try {
      // Get admin data first for SMS and logging
      const adminDoc = await getDoc(doc(db, 'users', uid));
      if (!adminDoc.exists()) {
        throw new Error('Admin not found');
      }
      
      const adminData = adminDoc.data();
      
      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 
                         import.meta.env.VITE_API_URL ||
                         'https://edtech-dashboard-alpha.vercel.app';
      const MASTER_API_KEY = import.meta.env.VITE_SMS_MASTER_KEY;

      // Call password-reset API
      const response = await fetch(`${BACKEND_URL}/api/password-reset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          uid,
          newPassword,
          apiKey: MASTER_API_KEY
        })
      });

      // Check if response is ok before parsing JSON
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API returned status ${response.status}: ${errorText}`);
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('API did not return JSON response');
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || 'Failed to reset password');
      }

      console.log('✅ Password reset successfully');

      // Send SMS notification
      if (adminData.phoneNumber) {
        await sendPasswordResetSMS(
          adminData.phoneNumber,
          adminData.userId || 'N/A',
          resetByAdmin?.userId || 'System'
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
              resetBy: resetByAdmin.userId
            })
          });
          console.log('✅ Password reset logged in security logs');
        } catch (logError) {
          console.warn('⚠️ Failed to log password reset:', logError);
        }
      }
    } catch (error: any) {
      console.error('Error resetting password:', error);
      throw new Error(error.message || 'Failed to reset password');
    }
  },

  // Update admin
  async updateAdmin(
    uid: string, 
    updates: Partial<Admin>,
    updatedByAdmin: Admin
  ): Promise<void> {
    try {
      // Get current admin data first
      const adminDoc = await getDoc(doc(db, 'users', uid));
      if (!adminDoc.exists()) {
        throw new Error('Admin not found');
      }
      
      const currentAdmin = adminDoc.data() as Admin;
      
      // Normalize phone number if it's being updated
      if (updates.phoneNumber) {
        updates.phoneNumber = normalizePhoneNumber(updates.phoneNumber);
      }

      // Update the admin document
      const adminRef = doc(db, 'users', uid);
      const updateData: any = {
        ...updates,
        updatedAt: Timestamp.now()
      };

      await updateDoc(adminRef, updateData);
      console.log('✅ Admin updated successfully');

      // Handle status change separately
      if (updates.status && updates.status !== currentAdmin.status) {
        // Send SMS notification for status change
        if (currentAdmin.phoneNumber) {
          await sendStatusChangeSMS(
            currentAdmin.phoneNumber,
            currentAdmin.userId,
            currentAdmin.status,
            updates.status,
            updatedByAdmin.userId
          );
        }

        // Log status change in security logs
        try {
          await addDoc(collection(db, 'security_logs'), {
            action: 'status_changed',
            targetAdminUid: uid,
            targetAdminUserId: currentAdmin.userId || 'N/A',
            targetAdminSurname: currentAdmin.surname || 'N/A',
            performedByUid: updatedByAdmin.uid,
            performedByUserId: updatedByAdmin.userId || 'N/A',
            performedBySurname: updatedByAdmin.surname || 'N/A',
            timestamp: Timestamp.now(),
            details: `Status changed from ${currentAdmin.status} to ${updates.status} for ${currentAdmin.surname} (${currentAdmin.userId})`,
            changes: JSON.stringify({
              action: 'status_change',
              previousStatus: currentAdmin.status,
              newStatus: updates.status
            })
          });
          console.log('✅ Status change logged in security logs');
        } catch (logError) {
          console.warn('⚠️ Failed to log status change:', logError);
        }
      }

      // Handle phone number change separately
      if (updates.phoneNumber && updates.phoneNumber !== currentAdmin.phoneNumber) {
        try {
          await addDoc(collection(db, 'security_logs'), {
            action: 'phone_number_changed',
            targetAdminUid: uid,
            targetAdminUserId: currentAdmin.userId || 'N/A',
            targetAdminSurname: currentAdmin.surname || 'N/A',
            performedByUid: updatedByAdmin.uid,
            performedByUserId: updatedByAdmin.userId || 'N/A',
            performedBySurname: updatedByAdmin.surname || 'N/A',
            timestamp: Timestamp.now(),
            details: `Phone number changed for ${currentAdmin.surname} (${currentAdmin.userId})`,
            changes: JSON.stringify({
              action: 'phone_number_change',
              oldPhoneNumber: currentAdmin.phoneNumber,
              newPhoneNumber: updates.phoneNumber
            })
          });
          console.log('✅ Phone number change logged in security logs');

          // Send SMS to old number
          if (currentAdmin.phoneNumber) {
            await sendPhoneNumberChangeSMS(
              currentAdmin.phoneNumber,
              updates.phoneNumber,
              currentAdmin.userId,
              updatedByAdmin.userId
            );
          }
        } catch (logError) {
          console.warn('⚠️ Failed to log phone number change:', logError);
        }
      }

      // Log other changes (excluding status and phone which were handled above)
      const changedFields: any = {};
      const changesArray: string[] = [];
      
      // Track all changes except status and phoneNumber (already handled)
      Object.keys(updates).forEach(key => {
        if (key !== 'status' && key !== 'phoneNumber' && key !== 'updatedAt') {
          const updateKey = key as keyof Admin;
          if (updates[updateKey] !== currentAdmin[key]) {
            changedFields[key] = { from: currentAdmin[key], to: updates[updateKey] };
            changesArray.push(`${key} changed`);
          }
        }
      });

      // Special handling for profilePictureUrl
      if (updates.profilePictureUrl && updates.profilePictureUrl !== currentAdmin.profilePictureUrl) {
        changedFields.profilePictureUrl = { from: 'previous', to: 'updated' };
        changesArray.push(`profile picture updated`);
        
        // Create separate log for profile picture update
        try {
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
          console.log('✅ Profile picture update logged in security logs');
        } catch (logError) {
          console.warn('⚠️ Failed to log profile update:', logError);
        }
      }

      // Create main edit log (only if there are non-status/non-phone changes)
      if (changesArray.length > 0) {
        try {
          await addDoc(collection(db, 'security_logs'), {
            action: 'admin_edited',
            targetAdminUid: uid,
            targetAdminUserId: currentAdmin.userId || 'N/A',
            targetAdminSurname: currentAdmin.surname || 'N/A',
            performedByUid: updatedByAdmin.uid,
            performedByUserId: updatedByAdmin.userId || 'N/A',
            performedBySurname: updatedByAdmin.surname || 'N/A',
            timestamp: Timestamp.now(),
            details: `Admin details updated for ${currentAdmin.surname} (${currentAdmin.userId}). Changed fields: ${changesArray.join(', ')}`,
            changes: JSON.stringify({
              action: 'edit',
              changedFields: changedFields,
              fieldCount: Object.keys(changedFields).length
            })
          });
          console.log('✅ Admin edit logged in security logs');
        } catch (logError) {
          console.warn('⚠️ Failed to log admin edit:', logError);
        }
      }
    } catch (error: any) {
      console.error('Error updating admin:', error);
      throw new Error(error.message || 'Failed to update admin');
    }
  },

  // Delete admin using UNIFIED delete-user.ts API
  async deleteAdmin(
    uid: string, 
    userEmail?: string,
    deletedByAdmin?: Admin
  ): Promise<void> {
    try {
      // Get admin data first for logging and profile picture URL
      const adminDoc = await getDoc(doc(db, 'users', uid));
      const adminData = adminDoc.exists() ? adminDoc.data() : null;
      
      // CRITICAL: Delete from Firestore FIRST (handled by unified delete-user.ts API)
      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 
                         import.meta.env.VITE_API_URL ||
                         'https://edtech-dashboard-alpha.vercel.app';
      const MASTER_API_KEY = import.meta.env.VITE_SMS_MASTER_KEY;

      // Call unified delete-user API (handles Firestore + Supabase + Auth)
      const deleteResponse = await fetch(`${BACKEND_URL}/api/delete-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          uid,
          email: userEmail,
          action: 'delete-auth-user',
          profilePictureUrl: adminData?.profilePictureUrl || null,
          apiKey: MASTER_API_KEY
        })
      });

      // Check if response is ok before parsing JSON
      if (!deleteResponse.ok) {
        const errorText = await deleteResponse.text();
        throw new Error(`API returned status ${deleteResponse.status}: ${errorText}`);
      }

      const contentType = deleteResponse.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('API did not return JSON response');
      }

      const deleteResult = await deleteResponse.json();

      if (!deleteResult.success) {
        throw new Error(deleteResult.error || 'Failed to delete admin');
      }

      console.log('✅ Admin deleted successfully (unified deletion completed)');
      console.log('  - Firestore:', deleteResult.details.firestoreDeleted ? 'DELETED' : 'FAILED');
      console.log('  - Profile Picture:', deleteResult.details.profilePicDeleted ? 'DELETED' : 'SKIPPED/FAILED');
      console.log('  - Firebase Auth:', deleteResult.details.authDeleted ? 'DELETED' : 'SKIPPED/FAILED');
      
      // Log admin deletion in security logs
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
                profilePictureDeleted: deleteResult.details.profilePicDeleted,
                firestoreDeleted: deleteResult.details.firestoreDeleted,
                authDeleted: deleteResult.details.authDeleted
              }
            })
          });
          console.log('✅ Admin deletion logged in security logs');
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
