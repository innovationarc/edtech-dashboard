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
import { createUserWithEmailAndPassword, signOut, getAuth } from 'firebase/auth';
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

/* Normalize phone number to 13-digit format: 8801XXXXXXXXX
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
  
  // After all processing, we should have 10 digits starting with 1 or 9 digits
  if (cleaned.length === 10 && cleaned.startsWith('1')) {
    return `880${cleaned}`;
  }
  
  if (cleaned.length === 9) {
    return `8801${cleaned}`;
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
Ed-tech Platform`;
  
  await sendSMS(phoneNumber, message);
};

/**
 * Send SMS notification for admin edit
 */
const sendAdminEditSMS = async (phoneNumber: string, adminId: string, changes: string[]): Promise<void> => {
  const message = `Admin Profile Update

Your administrator account (ID: ${adminId}) has been modified.

Changes made:
${changes.slice(0, 3).join('\n')}${changes.length > 3 ? `\n...and ${changes.length - 3} more changes` : ''}

For any concerns, contact other administrators.

Regards,
Ed-tech Platform`;
  
  await sendSMS(phoneNumber, message);
};

/**
 * Send SMS notification for status change
 */
const sendStatusChangeSMS = async (phoneNumber: string, adminId: string, newStatus: string, reason?: string): Promise<void> => {
  const statusText = newStatus.charAt(0).toUpperCase() + newStatus.slice(1);
  let message = `Admin Status Update

Your administrator account (ID: ${adminId}) status has been changed to: ${statusText}`;

  if (reason) {
    message += `\n\nReason: ${reason}`;
  }

  message += `\n\nFor any concerns, please contact the platform administrators.

Regards,
Ed-tech Platform`;
  
  await sendSMS(phoneNumber, message);
};

/**
 * Helper function to retry fetch with exponential backoff
 */
async function fetchWithRetry(
  url: string, 
  options: RequestInit, 
  maxRetries: number = 3
): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      console.log(`🔄 Fetch attempt ${attempt + 1}/${maxRetries}...`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout
      
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      return response;
      
    } catch (error: any) {
      lastError = error;
      console.error(`❌ Fetch attempt ${attempt + 1} failed:`, error.message);
      
      if (attempt < maxRetries - 1) {
        const waitTime = Math.min(1000 * Math.pow(2, attempt), 5000);
        console.log(`⏳ Waiting ${waitTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
  
  throw lastError || new Error('All fetch attempts failed');
}

/**
 * Generate unique userId using backend API
 * Format: AD-YYMM-XXXXX (e.g., AD-2402-00001)
 */
const generateUserId = async (role: string = 'admin'): Promise<string> => {
  try {
    const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 
                       import.meta.env.VITE_API_URL ||
                       'https://edtech-dashboard-alpha.vercel.app';
    const MASTER_API_KEY = import.meta.env.VITE_SMS_MASTER_KEY;

    console.log('🎯 Calling generate-id API for role:', role);

    const response = await fetch(`${BACKEND_URL}/api/generate-id`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        role: role,
        apiKey: MASTER_API_KEY
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Generate ID API error:', errorText);
      throw new Error(`Failed to generate ID: ${errorText}`);
    }

    const result = await response.json();
    
    if (!result.success || !result.userId) {
      throw new Error('API did not return a valid userId');
    }

    console.log('✅ Generated userId:', result.userId);
    return result.userId;

  } catch (error: any) {
    console.error('❌ Error generating userId:', error);
    throw new Error(error.message || 'Failed to generate unique user ID');
  }
};

export const adminService = {
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
          surname: data.surname || data.name || data.fullName || 'Admin',
          fullName: data.fullName || data.name || data.surname || '',
          createdAt: data.createdAt?.toDate() || new Date(),
          lastLogin: data.lastLogin?.toDate(),
        };
      }) as Admin[];
    } catch (error: any) {
      console.error('Error fetching admins:', error);
      throw new Error(error.message || 'Failed to fetch admins');
    }
  },

  // Get single admin
  async getAdmin(uid: string): Promise<Admin | null> {
    try {
      const adminDoc = await getDoc(doc(db, 'users', uid));
      if (!adminDoc.exists()) {
        return null;
      }
      
      const data = adminDoc.data();
      return {
        ...data,
        uid: adminDoc.id,
        surname: data.surname || data.name || data.fullName || 'Admin',
        fullName: data.fullName || data.name || data.surname || '',
        createdAt: data.createdAt?.toDate() || new Date(),
        lastLogin: data.lastLogin?.toDate(),
      } as Admin;
    } catch (error: any) {
      console.error('Error fetching admin:', error);
      throw new Error(error.message || 'Failed to fetch admin');
    }
  },

  // Create new admin - Uses generate-id API for userId with AD prefix
  // ENHANCED: Now includes role information in all log entries for granular tracking
  async createAdmin(
    phoneNumber: string,
    email: string,
    password: string,
    surname: string,
    fullName: string,
    dob: string,
    phone: string,
    bloodGroup: 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-' | '',
    gender: 'male' | 'female' | 'other' | '',
    religion: string,
    address: string,
    birthCertificateNumber: string,
    nid: string,
    createdByAdminId: string,
    createdByAdminUid: string,
    createdByAdminSurname: string,
    profilePictureUrl?: string
  ): Promise<Admin> {
    // CRITICAL: Store current auth state
    const currentUser = auth.currentUser;
    
    try {
      console.log('🚀 Creating admin account...');
      
      // Generate unique userId using backend API (format: AD-YYMM-XXXXX)
      const userId = await generateUserId('admin');
      console.log('📝 Generated userId:', userId);
      
      // IMPORTANT: Use userId@admin.local format for Firebase Auth
      const authEmail = `${userId}@admin.local`;
      console.log('📧 Auth email format:', authEmail);
      
      // Create Firebase Auth user with new email format
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        authEmail,
        password
      );
      const newUid = userCredential.user.uid;
      
      console.log('✅ Auth user created with UID:', newUid);
      
      // CRITICAL: Immediately sign out the newly created user
      // This prevents the current admin from being logged out
      await signOut(auth);
      console.log('✅ New user signed out to prevent admin logout');
      
      // Prepare admin data for Firestore
      const adminData: any = {
        uid: newUid,
        userId: userId,
        surname: surname,
        fullName: fullName || '',
        email: email || '', // Store the optional contact email separately
        phoneNumber: phone,
        dob: dob || '',
        gender: gender || '',
        bloodGroup: bloodGroup || '',
        religion: religion || '',
        address: address || '',
        birthCertificateNumber: birthCertificateNumber || '',
        nid: nid || '',
        role: 'admin',
        status: 'active',
        createdAt: Timestamp.now(),
        createdBy: createdByAdminId,
        deviceId: '', // Will be set on first login
        profilePictureUrl: profilePictureUrl || ''
      };
      
      // Save to Firestore
      await setDoc(doc(db, 'users', newUid), adminData);
      console.log('✅ Admin data saved to Firestore');
      
      // CRITICAL: Enhanced admin creation logging with FULL role and field details
      // ADDITIVE ONLY: This log structure is backward compatible with existing logs
      // New fields are OPTIONAL and will not break old log rendering
      try {
        const logRef = await addDoc(collection(db, 'security_logs'), {
          // EXISTING FIELDS (maintained for backward compatibility)
          action: 'admin_created',
          targetAdminUid: newUid,
          targetAdminUserId: userId,
          targetAdminSurname: surname,
          performedByUid: createdByAdminUid,
          performedByUserId: createdByAdminId,
          performedBySurname: createdByAdminSurname,
          timestamp: Timestamp.now(),
          details: `New admin account created: ${surname} (${userId}) by ${createdByAdminSurname} (${createdByAdminId}). Contact: ${phone}${email ? ', Email: ' + email : ''}`,
          
          // ENHANCED: Added role tracking for both creator and created admin
          // These are ADDITIVE fields - old UI will ignore them, new UI can use them
          targetAdminRole: 'admin',
          performedByRole: 'admin',
          
          // ENHANCED: More detailed change tracking
          changes: JSON.stringify({
            action: 'create',
            createdAdmin: {
              userId: userId,
              surname: surname,
              fullName: fullName,
              email: email || 'Not provided',
              phoneNumber: phone,
              dob: dob || 'Not provided',
              gender: gender || 'Not provided',
              bloodGroup: bloodGroup || 'Not provided',
              religion: religion || 'Not provided',
              address: address || 'Not provided',
              birthCertificateNumber: birthCertificateNumber || 'Not provided',
              nid: nid || 'Not provided',
              role: 'admin', // ADDITIVE: Include role in details
              status: 'active',
              authEmail: authEmail,
              profilePictureUrl: profilePictureUrl || 'Not provided'
            },
            createdBy: {
              uid: createdByAdminUid,
              userId: createdByAdminId,
              surname: createdByAdminSurname,
              role: 'admin' // ADDITIVE: Include creator role
            },
            // ADDITIVE: Metadata for advanced filtering/reporting
            metadata: {
              creationTimestamp: new Date().toISOString(),
              hasEmail: !!email,
              hasProfilePicture: !!profilePictureUrl,
              hasOptionalFields: !!(dob || gender || bloodGroup || religion || address)
            }
          })
        });
        console.log('✅ Admin creation logged in security logs with ID:', logRef.id);
        
        // Verify the log was created
        const verifyLog = await getDoc(logRef);
        if (verifyLog.exists()) {
          console.log('✅ Log verified in Firestore');
        } else {
          console.error('❌ Log not found after creation!');
        }
      } catch (logError: any) {
        console.error('❌ CRITICAL: Failed to log admin creation:', logError);
        console.error('Error details:', logError.message, logError.code);
        // Don't throw - allow admin creation to succeed even if logging fails
        // This ensures FAIL-OPEN behavior for logging
      }
      
      // Send SMS notification
      try {
        await sendAdminCreationSMS(phone, userId);
        console.log('✅ SMS notification sent');
      } catch (smsError) {
        console.warn('⚠️ Failed to send SMS notification:', smsError);
        // Don't throw - allow admin creation to succeed even if SMS fails
      }
      
      return {
        uid: newUid,
        userId: userId,
        surname: surname,
        fullName: fullName,
        email: email,
        phoneNumber: phone,
        dob: dob,
        gender: gender as any,
        bloodGroup: bloodGroup as any,
        religion: religion,
        address: address,
        birthCertificateNumber: birthCertificateNumber,
        nid: nid,
        role: 'admin',
        status: 'active',
        createdAt: new Date(),
        createdBy: createdByAdminId,
        profilePictureUrl: profilePictureUrl
      };
      
    } catch (error: any) {
      console.error('❌ Error creating admin:', error);
      throw new Error(error.message || 'Failed to create admin account');
    }
  },

  // Reset admin password with full logging
  async resetAdminPassword(
    uid: string,
    newPassword: string,
    resetByAdmin: Admin,
    reason?: string
  ): Promise<void> {
    try {
      console.log('🔐 Resetting admin password...');
      
      // Get admin data first
      const adminDoc = await getDoc(doc(db, 'users', uid));
      if (!adminDoc.exists()) {
        throw new Error('Admin not found');
      }
      const adminData = adminDoc.data();
      
      // Call backend API to reset password
      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 
                         import.meta.env.VITE_API_URL ||
                         'https://edtech-dashboard-alpha.vercel.app';
      const MASTER_API_KEY = import.meta.env.VITE_SMS_MASTER_KEY;
      
      const response = await fetch(`${BACKEND_URL}/api/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          uid: uid,
          newPassword: newPassword,
          apiKey: MASTER_API_KEY
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to reset password');
      }
      
      console.log('✅ Password reset successful');
      
      // ENHANCED: Log password reset with full details including roles
      // ADDITIVE ONLY: Maintains backward compatibility
      try {
        await addDoc(collection(db, 'security_logs'), {
          // EXISTING FIELDS
          action: 'password_reset',
          targetAdminUid: uid,
          targetAdminUserId: adminData.userId || 'N/A',
          targetAdminSurname: adminData.surname || 'N/A',
          performedByUid: resetByAdmin.uid,
          performedByUserId: resetByAdmin.userId || 'N/A',
          performedBySurname: resetByAdmin.surname || 'N/A',
          timestamp: Timestamp.now(),
          reason: reason || 'No reason provided',
          details: `Password reset for admin ${adminData.surname} (${adminData.userId}) by ${resetByAdmin.surname} (${resetByAdmin.userId})${reason ? '. Reason: ' + reason : ''}`,
          
          // ADDITIVE: Role tracking
          targetAdminRole: adminData.role || 'admin',
          performedByRole: resetByAdmin.role || 'admin',
          
          changes: JSON.stringify({
            action: 'password_reset',
            targetAdmin: {
              uid: uid,
              userId: adminData.userId,
              surname: adminData.surname,
              role: adminData.role || 'admin' // ADDITIVE
            },
            performedBy: {
              uid: resetByAdmin.uid,
              userId: resetByAdmin.userId,
              surname: resetByAdmin.surname,
              role: resetByAdmin.role || 'admin' // ADDITIVE
            },
            reason: reason || 'No reason provided',
            // ADDITIVE: Metadata
            metadata: {
              resetTimestamp: new Date().toISOString()
            }
          })
        });
        console.log('✅ Password reset logged in security logs');
      } catch (logError) {
        console.warn('⚠️ Failed to log password reset:', logError);
        // FAIL-OPEN: Don't block password reset if logging fails
      }
      
    } catch (error: any) {
      console.error('❌ Error resetting password:', error);
      throw new Error(error.message || 'Failed to reset password');
    }
  },

  // Update admin with full change tracking
  // ENHANCED: Now includes granular field-level logging with role tracking
  async updateAdmin(
    uid: string, 
    updates: Partial<Admin>,
    updatedByAdmin: Admin
  ): Promise<void> {
    try {
      console.log('🔄 Updating admin...');
      
      // Get current admin data to compare changes
      const currentAdminDoc = await getDoc(doc(db, 'users', uid));
      if (!currentAdminDoc.exists()) {
        throw new Error('Admin not found');
      }
      const currentAdmin = currentAdminDoc.data();
      
      // EXISTING: Track what changed with before/after values
      const changedFields: any = {};
      const changesArray: string[] = [];
      
      Object.keys(updates).forEach(key => {
        const oldValue = currentAdmin[key];
        const newValue = (updates as any)[key];
        
        if (oldValue !== newValue) {
          changedFields[key] = {
            from: oldValue || 'Empty',
            to: newValue || 'Empty'
          };
          changesArray.push(`${key}: "${oldValue || 'Empty'}" → "${newValue || 'Empty'}"`);
        }
      });
      
      // Update in Firestore
      await updateDoc(doc(db, 'users', uid), updates);
      console.log('✅ Admin updated in Firestore');
      
      // EXISTING: Log status change separately if status was changed
      if (updates.status && updates.status !== currentAdmin.status) {
        try {
          await addDoc(collection(db, 'security_logs'), {
            // EXISTING FIELDS
            action: 'status_changed',
            targetAdminUid: uid,
            targetAdminUserId: currentAdmin.userId || 'N/A',
            targetAdminSurname: currentAdmin.surname || 'N/A',
            performedByUid: updatedByAdmin.uid,
            performedByUserId: updatedByAdmin.userId || 'N/A',
            performedBySurname: updatedByAdmin.surname || 'N/A',
            timestamp: Timestamp.now(),
            details: `Status changed from "${currentAdmin.status}" to "${updates.status}" for admin ${currentAdmin.surname} (${currentAdmin.userId}) by ${updatedByAdmin.surname} (${updatedByAdmin.userId})`,
            
            // ADDITIVE: Role tracking
            targetAdminRole: currentAdmin.role || 'admin',
            performedByRole: updatedByAdmin.role || 'admin',
            
            changes: JSON.stringify({
              action: 'status_change',
              fieldName: 'status',
              from: currentAdmin.status,
              to: updates.status,
              targetAdmin: {
                uid: uid,
                userId: currentAdmin.userId,
                surname: currentAdmin.surname,
                role: currentAdmin.role || 'admin' // ADDITIVE
              },
              performedBy: {
                uid: updatedByAdmin.uid,
                userId: updatedByAdmin.userId,
                surname: updatedByAdmin.surname,
                role: updatedByAdmin.role || 'admin' // ADDITIVE
              },
              // ADDITIVE: Metadata
              metadata: {
                changeTimestamp: new Date().toISOString(),
                fieldType: 'status'
              }
            })
          });
          console.log('✅ Status change logged in security logs');
          
          // Send SMS for status change
          try {
            await sendStatusChangeSMS(
              currentAdmin.phoneNumber,
              currentAdmin.userId,
              updates.status
            );
          } catch (smsError) {
            console.warn('⚠️ Failed to send status change SMS:', smsError);
          }
        } catch (logError) {
          console.warn('⚠️ Failed to log status change:', logError);
          // FAIL-OPEN: Don't block update if logging fails
        }
      }
      
      // EXISTING: Log phone number change separately if phone was changed
      if (updates.phoneNumber && updates.phoneNumber !== currentAdmin.phoneNumber) {
        try {
          await addDoc(collection(db, 'security_logs'), {
            // EXISTING FIELDS
            action: 'phone_number_changed',
            targetAdminUid: uid,
            targetAdminUserId: currentAdmin.userId || 'N/A',
            targetAdminSurname: currentAdmin.surname || 'N/A',
            performedByUid: updatedByAdmin.uid,
            performedByUserId: updatedByAdmin.userId || 'N/A',
            performedBySurname: updatedByAdmin.surname || 'N/A',
            timestamp: Timestamp.now(),
            details: `Phone number changed from "${currentAdmin.phoneNumber}" to "${updates.phoneNumber}" for admin ${currentAdmin.surname} (${currentAdmin.userId}) by ${updatedByAdmin.surname} (${updatedByAdmin.userId})`,
            
            // ADDITIVE: Role tracking
            targetAdminRole: currentAdmin.role || 'admin',
            performedByRole: updatedByAdmin.role || 'admin',
            
            changes: JSON.stringify({
              action: 'phone_change',
              fieldName: 'phoneNumber',
              from: currentAdmin.phoneNumber,
              to: updates.phoneNumber,
              targetAdmin: {
                uid: uid,
                userId: currentAdmin.userId,
                surname: currentAdmin.surname,
                role: currentAdmin.role || 'admin' // ADDITIVE
              },
              performedBy: {
                uid: updatedByAdmin.uid,
                userId: updatedByAdmin.userId,
                surname: updatedByAdmin.surname,
                role: updatedByAdmin.role || 'admin' // ADDITIVE
              },
              // ADDITIVE: Metadata
              metadata: {
                changeTimestamp: new Date().toISOString(),
                fieldType: 'phoneNumber',
                phoneNormalized: normalizePhoneNumber(updates.phoneNumber)
              }
            })
          });
          console.log('✅ Phone number change logged in security logs');
        } catch (logError) {
          console.warn('⚠️ Failed to log phone number change:', logError);
          // FAIL-OPEN: Don't block update if logging fails
        }
      }
      
      // ENHANCED: Create main edit log with granular field details
      // This is ADDITIVE - includes all fields that changed (except status and phone which are logged separately)
      if (changesArray.length > 0) {
        try {
          await addDoc(collection(db, 'security_logs'), {
            // EXISTING FIELDS
            action: 'admin_edited',
            targetAdminUid: uid,
            targetAdminUserId: currentAdmin.userId || 'N/A',
            targetAdminSurname: currentAdmin.surname || 'N/A',
            performedByUid: updatedByAdmin.uid,
            performedByUserId: updatedByAdmin.userId || 'N/A',
            performedBySurname: updatedByAdmin.surname || 'N/A',
            timestamp: Timestamp.now(),
            details: `Admin ${currentAdmin.surname} (${currentAdmin.userId}) details updated by ${updatedByAdmin.surname} (${updatedByAdmin.userId}). Changes: ${changesArray.join(', ')}`,
            
            // ADDITIVE: Role tracking
            targetAdminRole: currentAdmin.role || 'admin',
            performedByRole: updatedByAdmin.role || 'admin',
            
            // ENHANCED: More detailed change tracking with field-level granularity
            changes: JSON.stringify({
              action: 'edit',
              changedFields: changedFields, // EXISTING: before/after for each field
              fieldCount: Object.keys(changedFields).length,
              targetAdmin: {
                uid: uid,
                userId: currentAdmin.userId,
                surname: currentAdmin.surname,
                role: currentAdmin.role || 'admin' // ADDITIVE
              },
              performedBy: {
                uid: updatedByAdmin.uid,
                userId: updatedByAdmin.userId,
                surname: updatedByAdmin.surname,
                role: updatedByAdmin.role || 'admin' // ADDITIVE
              },
              // ADDITIVE: Metadata for filtering/reporting
              metadata: {
                changeTimestamp: new Date().toISOString(),
                fieldsModified: Object.keys(changedFields),
                hasPersonalInfoChange: Object.keys(changedFields).some(k => 
                  ['surname', 'fullName', 'email', 'dob', 'gender', 'address'].includes(k)
                ),
                hasIdentificationChange: Object.keys(changedFields).some(k => 
                  ['nid', 'birthCertificateNumber', 'bloodGroup'].includes(k)
                ),
                hasProfilePictureChange: Object.keys(changedFields).includes('profilePictureUrl')
              }
            })
          });
          console.log('✅ Admin edit logged in security logs');
          
          // Send SMS for profile edit
          try {
            await sendAdminEditSMS(
              currentAdmin.phoneNumber,
              currentAdmin.userId,
              changesArray
            );
          } catch (smsError) {
            console.warn('⚠️ Failed to send edit SMS:', smsError);
          }
        } catch (logError) {
          console.warn('⚠️ Failed to log admin edit:', logError);
          // FAIL-OPEN: Don't block update if logging fails
        }
      }
    } catch (error: any) {
      console.error('Error updating admin:', error);
      throw new Error(error.message || 'Failed to update admin');
    }
  },

  // Delete admin using UNIFIED delete-user.ts API with retry logic
  // ENHANCED: Full field-level logging of deleted admin data
  async deleteAdmin(
    uid: string, 
    userEmail?: string,
    deletedByAdmin?: Admin
  ): Promise<void> {
    try {
      console.log('🗑️ Starting admin deletion process for UID:', uid);
      
      // Get admin data first for logging and profile picture URL
      const adminDoc = await getDoc(doc(db, 'users', uid));
      const adminData = adminDoc.exists() ? adminDoc.data() : null;
      
      if (!adminData) {
        throw new Error('Admin not found in database');
      }
      
      console.log('📄 Admin data retrieved:', {
        userId: adminData.userId,
        surname: adminData.surname,
        hasProfilePicture: !!adminData.profilePictureUrl
      });
      
      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 
                         import.meta.env.VITE_API_URL ||
                         'https://edtech-dashboard-alpha.vercel.app';
      const MASTER_API_KEY = import.meta.env.VITE_SMS_MASTER_KEY;

      console.log('🌐 Backend URL:', BACKEND_URL);

      // Call unified delete-user API with retry logic
      console.log('📡 Calling delete API with retry...');
      const deleteResponse = await fetchWithRetry(
        `${BACKEND_URL}/api/delete-user`,
        {
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
        },
        3 // Max 3 retries
      );

      console.log('📥 Response received:', {
        status: deleteResponse.status,
        statusText: deleteResponse.statusText,
        ok: deleteResponse.ok
      });

      // Check if response is ok before parsing JSON
      if (!deleteResponse.ok) {
        let errorText = '';
        try {
          errorText = await deleteResponse.text();
        } catch (e) {
          errorText = 'Could not read error response';
        }
        console.error('❌ Delete API error:', errorText);
        throw new Error(`API returned status ${deleteResponse.status}: ${errorText}`);
      }

      // Verify content type
      const contentType = deleteResponse.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.error('❌ Invalid content type:', contentType);
        throw new Error('API did not return JSON response');
      }

      let deleteResult;
      try {
        deleteResult = await deleteResponse.json();
        console.log('✅ Delete result:', deleteResult);
      } catch (parseError) {
        console.error('❌ Failed to parse JSON response:', parseError);
        throw new Error('Failed to parse API response');
      }

      if (!deleteResult.success) {
        console.error('❌ Delete operation failed:', deleteResult.error);
        throw new Error(deleteResult.error || 'Failed to delete admin');
      }

      console.log('✅ Admin deleted successfully (unified deletion completed)');
      console.log('  - Firestore:', deleteResult.details.firestoreDeleted ? 'DELETED' : 'FAILED');
      console.log('  - Profile Picture:', deleteResult.details.profilePicDeleted ? 'DELETED' : 'SKIPPED/FAILED');
      console.log('  - Firebase Auth:', deleteResult.details.authDeleted ? 'DELETED' : 'SKIPPED/FAILED');
      
      // ENHANCED: Log admin deletion with FULL field-level details
      // ADDITIVE ONLY: Maintains backward compatibility
      if (deletedByAdmin && adminData) {
        try {
          await addDoc(collection(db, 'security_logs'), {
            // EXISTING FIELDS
            action: 'admin_deleted',
            targetAdminUid: uid,
            targetAdminUserId: adminData.userId || 'N/A',
            targetAdminSurname: adminData.surname || adminData.name || 'N/A',
            performedByUid: deletedByAdmin.uid,
            performedByUserId: deletedByAdmin.userId || 'N/A',
            performedBySurname: deletedByAdmin.surname || 'N/A',
            timestamp: Timestamp.now(),
            details: `Admin ${adminData.surname || adminData.name} (${adminData.userId}) was permanently deleted by ${deletedByAdmin.surname} (${deletedByAdmin.userId}). All associated data including profile picture and authentication have been removed.`,
            
            // ADDITIVE: Role tracking
            targetAdminRole: adminData.role || 'admin',
            performedByRole: deletedByAdmin.role || 'admin',
            
            // ENHANCED: Complete snapshot of deleted admin data
            changes: JSON.stringify({
              action: 'delete',
              // EXISTING: Full admin snapshot
              deletedAdmin: {
                uid: uid,
                userId: adminData.userId,
                surname: adminData.surname || adminData.name,
                fullName: adminData.fullName || 'Not provided',
                email: adminData.email || 'Not provided',
                phoneNumber: adminData.phoneNumber,
                dob: adminData.dob || 'Not provided',
                gender: adminData.gender || 'Not provided',
                bloodGroup: adminData.bloodGroup || 'Not provided',
                religion: adminData.religion || 'Not provided',
                address: adminData.address || 'Not provided',
                birthCertificateNumber: adminData.birthCertificateNumber || 'Not provided',
                nid: adminData.nid || 'Not provided',
                role: adminData.role || 'admin', // ADDITIVE
                status: adminData.status,
                createdAt: adminData.createdAt?.toDate?.()?.toISOString() || 'Unknown',
                createdBy: adminData.createdBy || 'Unknown'
              },
              deletedBy: {
                uid: deletedByAdmin.uid,
                userId: deletedByAdmin.userId,
                surname: deletedByAdmin.surname,
                role: deletedByAdmin.role || 'admin' // ADDITIVE
              },
              deletionDetails: {
                profilePictureDeleted: deleteResult.details.profilePicDeleted,
                firestoreDeleted: deleteResult.details.firestoreDeleted,
                authDeleted: deleteResult.details.authDeleted
              },
              // ADDITIVE: Metadata
              metadata: {
                deletionTimestamp: new Date().toISOString(),
                hadProfilePicture: !!adminData.profilePictureUrl,
                hadEmail: !!adminData.email,
                accountAge: adminData.createdAt?.toDate?.() ? 
                  Math.floor((Date.now() - adminData.createdAt.toDate().getTime()) / (1000 * 60 * 60 * 24)) : null
              }
            })
          });
          console.log('✅ Admin deletion logged in security logs');
        } catch (logError) {
          console.warn('⚠️ Failed to log admin deletion:', logError);
          // FAIL-OPEN: Don't block deletion if logging fails
        }
      }
      
    } catch (error: any) {
      console.error('❌ Delete error:', error);
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
}
