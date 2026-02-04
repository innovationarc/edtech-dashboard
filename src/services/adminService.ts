// src/services/adminService.ts - ENHANCED VERSION WITH DETAILED LOGGING
// PART 1 OF 4 - PASTE IMMEDIATELY
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
  fieldChanges?: Array<{
    field: string;
    oldValue: string;
    newValue: string;
  }>;
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
// src/services/adminService.ts - PART 2 OF 4
// PASTE THIS IMMEDIATELY AFTER PART 1

/**
 * Send SMS notification for admin edit
 */
const sendAdminEditSMS = async (phoneNumber: string, adminId: string, changes: string[]): Promise<void> => {
  const changesList = changes.join(', ');
  const message = `Sir,
Your administrator profile has been updated in the Ed-tech platform management system.

Admin ID: ${adminId}
Changes: ${changesList}

If you did not request these changes or have any concerns, please contact system administrators immediately.

Regards,
Ed-tech Platform`;
  
  await sendSMS(phoneNumber, message);
};

/**
 * Send SMS notification for password reset
 */
const sendPasswordResetSMS = async (phoneNumber: string, adminId: string, resetReason?: string): Promise<void> => {
  const message = `Sir,
Your administrator password has been successfully reset in the Ed-tech platform.

Admin ID: ${adminId}
${resetReason ? `Reason: ${resetReason}` : ''}

For security purposes, we recommend you change your password again after logging in.

If you did not request this reset, please contact system administrators immediately.

Regards,
Ed-tech Platform`;
  
  await sendSMS(phoneNumber, message);
};

/**
 * Retry fetch with exponential backoff
 */
const fetchWithRetry = async (
  url: string,
  options: RequestInit,
  maxRetries: number = 3
): Promise<Response> => {
  let lastError: any;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      console.log(`🔄 Fetch attempt ${attempt + 1}/${maxRetries}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
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

/**
 * Helper to safely convert value to string for logging
 */
const safeStringify = (value: any): string => {
  if (value === null || value === undefined) return 'Not provided';
  if (value === '') return 'Empty';
  if (typeof value === 'object') {
    if (value.toDate && typeof value.toDate === 'function') {
      return value.toDate().toISOString();
    }
    return JSON.stringify(value);
  }
  return String(value);
};

/**
 * Calculate field-level changes between old and new admin data
 */
const calculateFieldChanges = (oldData: any, newData: any): Array<{field: string; oldValue: string; newValue: string}> => {
  const changes: Array<{field: string; oldValue: string; newValue: string}> = [];
  
  const fieldsToTrack = [
    'surname', 'fullName', 'email', 'phoneNumber', 'dob', 'gender',
    'bloodGroup', 'religion', 'address', 'birthCertificateNumber',
    'nid', 'status', 'profilePictureUrl'
  ];
  
  for (const field of fieldsToTrack) {
    const oldValue = oldData[field];
    const newValue = newData[field];
    
    // Only log if values are different
    if (oldValue !== newValue) {
      changes.push({
        field: field,
        oldValue: safeStringify(oldValue),
        newValue: safeStringify(newValue)
      });
    }
  }
  
  return changes;
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
// src/services/adminService.ts - PART 3 OF 4
// PASTE THIS IMMEDIATELY AFTER PART 2

  // Create new admin - Uses generate-id API for userId with AD prefix
  // ENHANCED WITH GUARANTEED LOGGING
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
      console.log('📊 Creator info:', { createdByAdminId, createdByAdminUid, createdByAdminSurname });
      
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
      
      // CRITICAL: ENHANCED ADMIN CREATION LOGGING
      // This is the PRIMARY FIX for logs not showing
      try {
        console.log('📝 Creating security log for admin creation...');
        console.log('📊 Log data preparation:', {
          action: 'admin_created',
          targetAdminUid: newUid,
          targetAdminUserId: userId,
          targetAdminSurname: surname,
          performedByUid: createdByAdminUid,
          performedByUserId: createdByAdminId,
          performedBySurname: createdByAdminSurname
        });
        
        const logData = {
          action: 'admin_created',
          targetAdminUid: newUid,
          targetAdminUserId: userId,
          targetAdminSurname: surname,
          performedByUid: createdByAdminUid,
          performedByUserId: createdByAdminId,
          performedBySurname: createdByAdminSurname,
          timestamp: Timestamp.now(),
          details: `New admin account created: ${surname} (${userId}) by ${createdByAdminSurname} (${createdByAdminId}). Contact: ${phone}${email ? ', Email: ' + email : ''}`,
          changes: JSON.stringify({
            action: 'create',
            createdAdmin: {
              uid: newUid,
              userId: userId,
              surname: surname,
              fullName: fullName || 'Not provided',
              email: email || 'Not provided',
              phoneNumber: phone,
              dob: dob || 'Not provided',
              gender: gender || 'Not provided',
              bloodGroup: bloodGroup || 'Not provided',
              religion: religion || 'Not provided',
              address: address || 'Not provided',
              birthCertificateNumber: birthCertificateNumber || 'Not provided',
              nid: nid || 'Not provided',
              status: 'active',
              authEmail: authEmail,
              profilePictureUrl: profilePictureUrl || 'Not provided',
              role: 'admin',
              createdAt: new Date().toISOString()
            },
            createdBy: {
              uid: createdByAdminUid,
              userId: createdByAdminId,
              surname: createdByAdminSurname,
              role: 'admin'
            }
          }),
          // ENHANCED: Add field-level change tracking for creation
          fieldChanges: [
            { field: 'userId', oldValue: 'N/A', newValue: userId },
            { field: 'surname', oldValue: 'N/A', newValue: surname },
            { field: 'fullName', oldValue: 'N/A', newValue: fullName || 'Not provided' },
            { field: 'email', oldValue: 'N/A', newValue: email || 'Not provided' },
            { field: 'phoneNumber', oldValue: 'N/A', newValue: phone },
            { field: 'status', oldValue: 'N/A', newValue: 'active' },
            { field: 'role', oldValue: 'N/A', newValue: 'admin' }
          ]
        };
        
        console.log('💾 Attempting to save log to security_logs collection...');
        const logRef = await addDoc(collection(db, 'security_logs'), logData);
        console.log('✅ Security log created successfully with ID:', logRef.id);
        
        // ENHANCED: Double-verify the log was created
        const verifyLog = await getDoc(logRef);
        if (verifyLog.exists()) {
          console.log('✅✅ Log VERIFIED in Firestore database');
          console.log('📄 Log content:', verifyLog.data());
        } else {
          console.error('❌❌ CRITICAL: Log not found after creation!');
          // Try again once more
          console.log('🔄 Retrying log creation...');
          const retryLogRef = await addDoc(collection(db, 'security_logs'), logData);
          console.log('✅ Retry log created with ID:', retryLogRef.id);
        }
      } catch (logError: any) {
        console.error('❌ CRITICAL ERROR: Failed to log admin creation:', logError);
        console.error('Error details:', {
          message: logError.message,
          code: logError.code,
          stack: logError.stack
        });
        // PRODUCTION SAFETY: Don't throw - allow admin creation to succeed even if logging fails
        // But we log extensively for debugging
      }
      
      // Send SMS notification
      try {
        console.log('📱 Sending SMS notification to:', phone);
        await sendAdminCreationSMS(phone, userId);
        console.log('✅ SMS notification sent successfully');
      } catch (smsError: any) {
        console.warn('⚠️ Failed to send SMS notification:', smsError.message);
        // Continue - SMS failure should not block admin creation
      }
      
      console.log('🎉 Admin creation completed successfully');
      
      // Return the created admin data
      return {
        ...adminData,
        createdAt: adminData.createdAt.toDate()
      } as Admin;
      
    } catch (error: any) {
      console.error('❌ Error in createAdmin:', error);
      throw new Error(error.message || 'Failed to create admin account');
    }
  },

  // Get security logs for a specific admin
  async getSecurityLogs(adminUid: string): Promise<SecurityLog[]> {
    try {
      console.log('📋 Fetching security logs for admin:', adminUid);
      const logsCollection = collection(db, 'security_logs');
      const logsQuery = query(
        logsCollection,
        where('targetAdminUid', '==', adminUid),
        orderBy('timestamp', 'desc')
      );
      const logsSnapshot = await getDocs(logsQuery);
      
      console.log(`✅ Found ${logsSnapshot.docs.length} logs for admin ${adminUid}`);
      
      return logsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          timestamp: data.timestamp?.toDate() || new Date(),
        };
      }) as SecurityLog[];
    } catch (error: any) {
      console.error('Error fetching security logs:', error);
      throw new Error(error.message || 'Failed to fetch security logs');
    }
  },

  // Get ALL security logs (for all admins) - for the All Admin Logs modal
  async getAllSecurityLogs(): Promise<SecurityLog[]> {
    try {
      console.log('📋 Fetching ALL security logs...');
      const logsCollection = collection(db, 'security_logs');
      const logsQuery = query(
        logsCollection,
        orderBy('timestamp', 'desc')
      );
      const logsSnapshot = await getDocs(logsQuery);
      
      console.log(`✅ Found ${logsSnapshot.docs.length} total security logs`);
      
      const logs = logsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          timestamp: data.timestamp?.toDate() || new Date(),
        };
      }) as SecurityLog[];
      
      // Debug: Log first few entries to verify admin_created logs exist
      if (logs.length > 0) {
        console.log('📝 Sample logs:', logs.slice(0, 5).map(log => ({
          action: log.action,
          targetAdmin: log.targetAdminUserId,
          performedBy: log.performedByUserId,
          timestamp: log.timestamp
        })));
        
        // Count admin_created logs
        const createdLogs = logs.filter(l => l.action === 'admin_created');
        console.log(`📊 Admin creation logs found: ${createdLogs.length}`);
      }
      
      return logs;
    } catch (error: any) {
      console.error('Error fetching all security logs:', error);
      throw new Error(error.message || 'Failed to fetch security logs');
    }
  },
// src/services/adminService.ts - PART 4 OF 4 (FINAL)
// PASTE THIS IMMEDIATELY AFTER PART 3

  // Reset admin password
  // ENHANCED WITH DETAILED LOGGING
  async resetAdminPassword(
    uid: string,
    newPassword: string,
    resetByAdmin: Admin,
    reason?: string
  ): Promise<void> {
    try {
      console.log('🔄 Resetting admin password...');
      
      // Get admin data
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
      
      // ENHANCED: Log password reset with full details
      try {
        await addDoc(collection(db, 'security_logs'), {
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
          changes: JSON.stringify({
            action: 'password_reset',
            targetAdmin: {
              uid: uid,
              userId: adminData.userId,
              surname: adminData.surname
            },
            performedBy: {
              uid: resetByAdmin.uid,
              userId: resetByAdmin.userId,
              surname: resetByAdmin.surname
            },
            reason: reason || 'No reason provided'
          }),
          // ENHANCED: Field-level tracking
          fieldChanges: [
            { field: 'password', oldValue: '[HIDDEN]', newValue: '[RESET - HIDDEN]' }
          ]
        });
        console.log('✅ Password reset logged in security logs');
        
        // Send SMS notification
        try {
          await sendPasswordResetSMS(adminData.phoneNumber, adminData.userId, reason);
        } catch (smsError) {
          console.warn('⚠️ Failed to send password reset SMS:', smsError);
        }
      } catch (logError) {
        console.warn('⚠️ Failed to log password reset:', logError);
      }
    } catch (error: any) {
      console.error('Error resetting password:', error);
      throw new Error(error.message || 'Failed to reset password');
    }
  },

  // Update admin
  // ENHANCED WITH DETAILED FIELD-LEVEL CHANGE TRACKING
  async updateAdmin(uid: string, updates: Partial<Admin>, updatedByAdmin: Admin): Promise<void> {
    try {
      console.log('🔄 Updating admin:', uid);
      console.log('📝 Updates:', updates);
      
      // Get current admin data first to track changes
      const adminDoc = await getDoc(doc(db, 'users', uid));
      if (!adminDoc.exists()) {
        throw new Error('Admin not found');
      }
      
      const currentAdmin = adminDoc.data();
      
      // Calculate field-level changes
      const fieldChanges = calculateFieldChanges(currentAdmin, updates);
      
      console.log('📊 Detected field changes:', fieldChanges);
      
      // Update the admin document
      await updateDoc(doc(db, 'users', uid), updates);
      console.log('✅ Admin updated in Firestore');
      
      // ENHANCED: Log admin edit with detailed field-level changes
      if (fieldChanges.length > 0) {
        try {
          const changesArray = fieldChanges.map(c => `${c.field}: "${c.oldValue}" → "${c.newValue}"`);
          
          await addDoc(collection(db, 'security_logs'), {
            action: 'admin_edited',
            targetAdminUid: uid,
            targetAdminUserId: currentAdmin.userId || 'N/A',
            targetAdminSurname: currentAdmin.surname || 'N/A',
            performedByUid: updatedByAdmin.uid,
            performedByUserId: updatedByAdmin.userId || 'N/A',
            performedBySurname: updatedByAdmin.surname || 'N/A',
            timestamp: Timestamp.now(),
            details: `Admin ${currentAdmin.surname} (${currentAdmin.userId}) was updated by ${updatedByAdmin.surname} (${updatedByAdmin.userId}). Changes: ${changesArray.join(', ')}`,
            changes: JSON.stringify({
              action: 'edit',
              fieldChanges: fieldChanges,
              targetAdmin: {
                uid: uid,
                userId: currentAdmin.userId,
                surname: currentAdmin.surname
              },
              performedBy: {
                uid: updatedByAdmin.uid,
                userId: updatedByAdmin.userId,
                surname: updatedByAdmin.surname
              }
            }),
            // ENHANCED: Store field changes in structured format
            fieldChanges: fieldChanges
          });
          console.log('✅ Admin edit logged in security logs with', fieldChanges.length, 'field changes');
          
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
        }
      } else {
        console.log('ℹ️ No field changes detected, skipping log');
      }
    } catch (error: any) {
      console.error('Error updating admin:', error);
      throw new Error(error.message || 'Failed to update admin');
    }
  },

  // Delete admin using UNIFIED delete-user.ts API with retry logic
  // ENHANCED WITH COMPREHENSIVE LOGGING
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
      
      // ENHANCED: Log admin deletion with COMPREHENSIVE details in security logs
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
            details: `Admin ${adminData.surname || adminData.name} (${adminData.userId}) was permanently deleted by ${deletedByAdmin.surname} (${deletedByAdmin.userId}). All associated data including profile picture and authentication have been removed.`,
            changes: JSON.stringify({
              action: 'delete',
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
                status: adminData.status,
                createdAt: adminData.createdAt?.toDate?.()?.toISOString() || 'Unknown',
                createdBy: adminData.createdBy || 'Unknown'
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
            }),
            // ENHANCED: Field-level tracking for deletion
            fieldChanges: [
              { field: 'status', oldValue: adminData.status || 'active', newValue: 'DELETED' },
              { field: 'account', oldValue: 'EXISTS', newValue: 'PERMANENTLY REMOVED' }
            ]
          });
          console.log('✅ Admin deletion logged in security logs');
        } catch (logError) {
          console.warn('⚠️ Failed to log admin deletion:', logError);
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

// END OF FILE - THIS IS THE COMPLETE adminService.ts
