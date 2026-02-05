// src/services/adminService.ts - ENHANCED VERSION WITH DETAILED LOGGING
// CRITICAL FIX: Uses backend create-user API to avoid session disruption
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

Note: Your password is not included in this message for security reasons. Contact other system administrators if you do not have it.

Please begin executing your administrative responsibilities.

Regards,
Ed-tech Platform`;
  
  await sendSMS(phoneNumber, message);
};

/**
 * Send SMS notification for admin edit
 */
const sendAdminEditSMS = async (phoneNumber: string, adminId: string, changes: string[]): Promise<void> => {
  const changesList = changes.join(', ');
  const message = `Sir,
Your administrator profile has been updated in the Ed-tech platform management system.

Admin ID: ${adminId}
Changes: ${changesList}

If you did not request these changes or have any concerns, please contact other administrators administrators immediately.

Regards,
Ed-tech Platform`;
  
  await sendSMS(phoneNumber, message);
};

/**
 * Send SMS notification for status-only change (NEW)
 */
const sendAdminStatusChangeSMS = async (
  phoneNumber: string,
  adminId: string,
  oldStatus: string,
  newStatus: string,
  changedByUserId: string
): Promise<void> => {
  const message = `Sir,
The status of your Ed-tech administrator account has been changed from ${oldStatus} to ${newStatus}.
Admin ID: ${adminId}
Changed by: ${changedByUserId}

If you were not aware of this change, please take immediate action.

Regards,
Ed-tech Team`;
  
  await sendSMS(phoneNumber, message);
};

/**
 * Send SMS notification for admin deletion (NEW)
 */
const sendAdminDeletionSMS = async (
  phoneNumber: string,
  adminId: string,
  deletedByUserId: string
): Promise<void> => {
  const message = `Sir,
Your Ed-tech administrator account has been permanently deleted.
Admin ID: ${adminId}
Action performed by: ${deletedByUserId}

If you were not aware of this action, please contact other system administrators immediately and take action.

Regards,
Ed-tech Team`;
  
  await sendSMS(phoneNumber, message);
};

/**
 * Send SMS notification for password reset
 */
const sendPasswordResetSMS = async (
  phoneNumber: string, 
  adminId: string, 
  changedByUserId: string,
  resetReason?: string
): Promise<void> => {
  const message = `Sir,
Your Ed-tech administrator account password has been changed.

Admin ID: ${adminId}
Changed by: ${changedByUserId}
Reason: ${resetReason || 'Undefined'}

If you were not aware of this change, please take immediate action to secure your account.

Regards,
Ed-tech Team`;
  
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
      throw new Error(`Failed to generate user ID: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    
    if (!result.success || !result.userId) {
      console.error('❌ Invalid response from generate-id API:', result);
      throw new Error(result.error || 'Failed to generate user ID');
    }

    console.log('✅ Generated userId:', result.userId);
    return result.userId;
    
  } catch (error: any) {
    console.error('❌ Error generating userId:', error);
    throw new Error(error.message || 'Failed to generate user ID');
  }
};

/**
 * Calculate field-level changes between old and new data
 */
const calculateFieldChanges = (
  oldData: any, 
  newData: Partial<Admin>
): Array<{ field: string; oldValue: string; newValue: string }> => {
  const changes: Array<{ field: string; oldValue: string; newValue: string }> = [];
  
  // List of fields to track
  const fieldsToTrack = [
    'surname', 'fullName', 'email', 'phoneNumber', 'dob', 
    'gender', 'bloodGroup', 'religion', 'address', 
    'birthCertificateNumber', 'nid', 'status'
  ];
  
  for (const field of fieldsToTrack) {
    if (newData.hasOwnProperty(field)) {
      const oldValue = oldData[field] || 'Not set';
      const newValue = (newData as any)[field] || 'Not set';
      
      if (oldValue !== newValue) {
        changes.push({
          field,
          oldValue: String(oldValue),
          newValue: String(newValue)
        });
      }
    }
  }
  
  return changes;
};

export const adminService = {
  // ENHANCED: Create admin using BACKEND create-user API (avoids session disruption)
  async createAdmin(
    surname: string, 
    phoneNumber: string, 
    password: string,
    status: 'active' | 'inactive' | 'pending' = 'active',
    createdByAdmin?: Admin
  ): Promise<{ uid: string; userId: string }> {
    try {
      console.log('👤 Creating new admin with backend API:', { surname, phoneNumber, status });
      
      // Step 1: Generate unique userId
      const userId = await generateUserId('admin');
      console.log('✅ Generated userId:', userId);

      // Step 2: Normalize phone number
      const normalizedPhone = normalizePhoneNumber(phoneNumber);
      console.log('✅ Normalized phone number:', normalizedPhone);
      
      // Step 3: Call backend create-user API with retry logic
      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 
                         import.meta.env.VITE_API_URL ||
                         'https://edtech-dashboard-alpha.vercel.app';
      const MASTER_API_KEY = import.meta.env.VITE_SMS_MASTER_KEY;

      console.log('🌐 Backend URL:', BACKEND_URL);
      console.log('📡 Calling create-user API with retry...');

      const createResponse = await fetchWithRetry(
        `${BACKEND_URL}/api/create-user`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId,
            password,
            surname,
            phoneNumber: normalizedPhone,
            role: 'admin',
            status,
            createdBy: createdByAdmin?.userId || 'system',
            apiKey: MASTER_API_KEY
          })
        },
        3
      );

      console.log('📥 Response received:', {
        status: createResponse.status,
        statusText: createResponse.statusText,
        ok: createResponse.ok
      });

      if (!createResponse.ok) {
        let errorText = '';
        try {
          errorText = await createResponse.text();
        } catch (e) {
          errorText = 'Could not read error response';
        }
        console.error('❌ Create user API error:', errorText);
        throw new Error(`API returned status ${createResponse.status}: ${errorText}`);
      }

      const contentType = createResponse.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.error('❌ Invalid content type:', contentType);
        throw new Error('API did not return JSON response');
      }

      let result;
      try {
        result = await createResponse.json();
        console.log('✅ Create result:', result);
      } catch (parseError) {
        console.error('❌ Failed to parse JSON response:', parseError);
        throw new Error('Failed to parse API response');
      }

      if (!result.success || !result.uid) {
        console.error('❌ API returned unsuccessful response:', result);
        throw new Error(result.error || 'Failed to create admin');
      }

      const { uid } = result;
      console.log('✅ Admin created successfully (unified creation completed)');
      console.log('  - Firebase Auth: CREATED');
      console.log('  - Firestore Document: CREATED');
      console.log('  - UID:', uid);
      console.log('  - User ID:', userId);
      
      // ENHANCED: Log admin creation with COMPREHENSIVE details in security logs
      if (createdByAdmin) {
        try {
          console.log('📝 Creating comprehensive admin creation security log...');
          
          const logData = {
            action: 'admin_created',
            targetAdminUid: uid,
            targetAdminUserId: userId,
            targetAdminSurname: surname,
            performedByUid: createdByAdmin.uid,
            performedByUserId: createdByAdmin.userId || 'N/A',
            performedBySurname: createdByAdmin.surname || 'N/A',
            timestamp: Timestamp.now(),
            details: `New admin ${surname} (${userId}) created by ${createdByAdmin.surname} (${createdByAdmin.userId}). Initial status: ${status}. Changes: account (NONE → CREATED), status (NONE → ${status})`,
            changes: JSON.stringify({
              action: 'create',
              newAdmin: {
                uid: uid,
                userId: userId,
                surname: surname,
                phoneNumber: normalizedPhone,
                role: 'admin',
                status: status
              },
              createdBy: {
                uid: createdByAdmin.uid,
                userId: createdByAdmin.userId,
                surname: createdByAdmin.surname,
                fullName: createdByAdmin.fullName || 'Not provided'
              },
              timestamp: new Date().toISOString()
            }),
            fieldChanges: [
              { field: 'account', oldValue: 'NONE', newValue: 'CREATED' },
              { field: 'status', oldValue: 'NONE', newValue: status }
            ]
          };
          
          console.log('💾 Saving admin creation log to security_logs collection...');
          const logRef = await addDoc(collection(db, 'security_logs'), logData);
          console.log('✅ Admin creation security log created with ID:', logRef.id);
          
          // Verify the log was saved
          const verifyLog = await getDoc(logRef);
          if (verifyLog.exists()) {
            console.log('✅✅ Admin creation log VERIFIED in Firestore');
            console.log('📊 Log data preview:', {
              action: logData.action,
              targetAdmin: userId,
              performedBy: createdByAdmin.userId,
              hasFieldChanges: logData.fieldChanges.length > 0
            });
          } else {
            console.error('❌ CRITICAL: Admin creation log not found after creation');
          }
        } catch (logError: any) {
          console.error('❌ CRITICAL ERROR: Failed to log admin creation:', logError);
          console.error('Error details:', {
            message: logError.message,
            code: logError.code,
            stack: logError.stack
          });
          // Don't throw error - admin was still created successfully
        }
      } else {
        console.warn('⚠️ No createdByAdmin provided - creation log will not be created');
      }
      
      // Send SMS notification
      try {
        await sendAdminCreationSMS(normalizedPhone, userId);
        console.log('✅ Admin creation SMS notification sent');
      } catch (smsError) {
        console.warn('⚠️ Failed to send creation SMS:', smsError);
      }

      return { uid, userId };
      
    } catch (error: any) {
      console.error('❌ Create admin error:', error);
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
      console.error('Error getting admins:', error);
      throw new Error(error.message || 'Failed to get admins');
    }
  },

  // Get admin by UID
  async getAdminByUid(uid: string): Promise<Admin | null> {
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
      console.error('Error getting admin by UID:', error);
      throw new Error(error.message || 'Failed to get admin');
    }
  },
  
  // Get admin by userId
  async getAdminByUserId(userId: string): Promise<Admin | null> {
    try {
      const usersCollection = collection(db, 'users');
      const q = query(
        usersCollection,
        where('userId', '==', userId),
        where('role', '==', 'admin')
      );
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        return null;
      }
      
      const adminDoc = querySnapshot.docs[0];
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
      console.error('Error getting admin by userId:', error);
      throw new Error(error.message || 'Failed to get admin');
    }
  },

  // Get current logged-in admin
  async getCurrentAdmin(): Promise<Admin | null> {
    try {
      const currentUser = auth.currentUser;
      
      if (!currentUser) {
        return null;
      }
      
      return await this.getAdminByUid(currentUser.uid);
    } catch (error: any) {
      console.error('Error getting current admin:', error);
      throw new Error(error.message || 'Failed to get current admin');
    }
  },

  // ENHANCED: Reset password with COMPREHENSIVE logging and SMS
  async resetPassword(
    uid: string,
    newPassword: string,
    reason?: string,
    resetByAdmin?: Admin
  ): Promise<void> {
    try {
      console.log('🔑 Resetting password for admin UID:', uid);
      
      // Get admin data first for logging
      const adminDoc = await getDoc(doc(db, 'users', uid));
      if (!adminDoc.exists()) {
        throw new Error('Admin not found');
      }
      
      const adminData = adminDoc.data();
      const adminUserId = adminData.userId || 'N/A';
      const adminSurname = adminData.surname || adminData.name || 'N/A';
      const adminPhone = adminData.phoneNumber || 'N/A';
      
      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 
                         import.meta.env.VITE_API_URL ||
                         'https://edtech-dashboard-alpha.vercel.app';
      const MASTER_API_KEY = import.meta.env.VITE_SMS_MASTER_KEY;

      console.log('🌐 Backend URL:', BACKEND_URL);
      console.log('📡 Calling update-user-password API with retry...');

      const response = await fetchWithRetry(
        `${BACKEND_URL}/api/update-user-password`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            uid,
            newPassword,
            apiKey: MASTER_API_KEY
          })
        },
        3
      );

      console.log('📥 Response received:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });

      if (!response.ok) {
        let errorText = '';
        try {
          errorText = await response.text();
        } catch (e) {
          errorText = 'Could not read error response';
        }
        console.error('❌ Update password API error:', errorText);
        throw new Error(`API returned status ${response.status}: ${errorText}`);
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.error('❌ Invalid content type:', contentType);
        throw new Error('API did not return JSON response');
      }

      let result;
      try {
        result = await response.json();
        console.log('✅ Password update result:', result);
      } catch (parseError) {
        console.error('❌ Failed to parse JSON response:', parseError);
        throw new Error('Failed to parse API response');
      }

      if (!result.success) {
        console.error('❌ API returned unsuccessful response:', result);
        throw new Error(result.error || 'Failed to reset password');
      }

      // Update Firestore with password reset metadata
      await updateDoc(doc(db, 'users', uid), {
        lastPasswordResetAt: Timestamp.now(),
        lastPasswordResetBy: resetByAdmin?.userId || 'system'
      });

      console.log('✅ Password reset successfully and metadata updated');
      
      // Send SMS notification for password reset
      try {
        await sendPasswordResetSMS(
          adminPhone,
          adminUserId,
          resetByAdmin?.userId || 'System',
          reason
        );
        console.log('✅ Password reset SMS notification sent');
      } catch (smsError) {
        console.warn('⚠️ Failed to send password reset SMS:', smsError);
      }
      
      // ENHANCED: Log password reset with COMPREHENSIVE details in security logs
      if (resetByAdmin) {
        try {
          console.log('📝 Creating comprehensive password reset security log...');
          
          const performerUid = resetByAdmin.uid;
          const performerUserId = resetByAdmin.userId || 'N/A';
          const performerSurname = resetByAdmin.surname || 'N/A';
          
          // Safely convert reason to string, handling all edge cases
          let reasonString = '';
          if (reason !== undefined && reason !== null) {
            reasonString = String(reason);
          }
          
          const logData = {
            action: 'password_reset',
            targetAdminUid: String(uid),
            targetAdminUserId: String(adminUserId),
            targetAdminSurname: String(adminSurname),
            performedByUid: String(performerUid),
            performedByUserId: String(performerUserId),
            performedBySurname: String(performerSurname),
            timestamp: Timestamp.now(),
            details: `Password reset for admin ${adminSurname} (${adminUserId}) by ${performerSurname} (${performerUserId}). Changes: password (REDACTED → RESET), passwordResetAt (${adminData.passwordResetAt ? new Date(adminData.passwordResetAt.toDate()).toISOString() : 'Never'} → ${new Date().toISOString()}), passwordResetBy (${adminData.lastPasswordResetBy || 'N/A'} → ${performerUserId})`,
            changes: `{"action":"password_reset","targetAdminUid":"${uid}","targetAdminUserId":"${adminUserId}","targetAdminSurname":"${adminSurname}","performedByUid":"${performerUid}","performedByUserId":"${performerUserId}","performedBySurname":"${performerSurname}","timestamp":"${new Date().toISOString()}"}`,
            fieldChanges: [
              { field: 'password', oldValue: 'REDACTED', newValue: 'RESET' },
              { field: 'passwordResetAt', oldValue: adminData.passwordResetAt ? new Date(adminData.passwordResetAt.toDate()).toISOString() : 'Never', newValue: new Date().toISOString() },
              { field: 'passwordResetBy', oldValue: adminData.lastPasswordResetBy || 'N/A', newValue: String(performerUserId) }
            ]
          };
          
          // Only add reason if it's a valid non-empty string
          if (reasonString && reasonString.trim() !== '') {
            logData.reason = reasonString;
          }
          
          console.log('💾 Saving password reset log to security_logs collection...');
          const logRef = await addDoc(collection(db, 'security_logs'), logData);
          console.log('✅ Password reset security log created with ID:', logRef.id);
          
          // Verify the log was saved
          const verifyLog = await getDoc(logRef);
          if (verifyLog.exists()) {
            console.log('✅✅ Password reset log VERIFIED in Firestore');
            console.log('📊 Log data preview:', {
              action: logData.action,
              targetAdmin: adminUserId,
              performedBy: performerUserId,
              hasFieldChanges: logData.fieldChanges.length > 0
            });
          } else {
            console.error('❌ CRITICAL: Password reset log not found after creation');
          }
        } catch (logError: any) {
          console.error('❌ CRITICAL ERROR: Failed to log password reset:', logError);
          console.error('Error details:', {
            message: logError.message,
            code: logError.code,
            stack: logError.stack
          });
          // Don't throw error - password was still reset successfully
        }
      }
      
    } catch (error: any) {
      console.error('❌ Password reset error:', error);
      throw new Error(error.message || 'Failed to reset password');
    }
  },
  
  // ENHANCED: Update admin status with SMS notification and security logging
  async updateAdminStatus(
    uid: string, 
    newStatus: 'active' | 'inactive', 
    reason?: string,
    updatedByAdmin?: Admin
  ): Promise<void> {
    try {
      console.log('🔄 Updating admin status:', { uid, newStatus, reason });
      
      // Get current admin data first
      const adminDoc = await getDoc(doc(db, 'users', uid));
      if (!adminDoc.exists()) {
        throw new Error('Admin not found');
      }
      
      const currentAdmin = adminDoc.data();
      const oldStatus = currentAdmin.status;
      const adminUserId = currentAdmin.userId || 'N/A';
      const adminSurname = currentAdmin.surname || currentAdmin.name || 'N/A';
      const adminFullName = currentAdmin.fullName || 'Not provided';
      const adminEmail = currentAdmin.email || 'Not provided';
      const adminPhone = currentAdmin.phoneNumber || 'Not provided';
      
      // Update status in Firestore
      await updateDoc(doc(db, 'users', uid), {
        status: newStatus
      });
      
      console.log('✅ Admin status updated in Firestore');
      
      // ENHANCED: Log status change in security logs with COMPREHENSIVE details
      if (updatedByAdmin) {
        try {
          console.log('📝 Creating comprehensive status change security log...');
          
          const logData = {
            action: 'status_changed',
            targetAdminUid: uid,
            targetAdminUserId: adminUserId,
            targetAdminSurname: adminSurname,
            performedByUid: updatedByAdmin.uid,
            performedByUserId: updatedByAdmin.userId || 'N/A',
            performedBySurname: updatedByAdmin.surname || 'N/A',
            timestamp: Timestamp.now(),
            reason: reason || 'No reason provided',
            details: `Status changed for admin ${adminSurname} (${adminUserId}) by ${updatedByAdmin.surname} (${updatedByAdmin.userId}). ${reason ? 'Reason: ' + reason + '. ' : ''}Changes: status (${oldStatus} → ${newStatus})`,
            changes: JSON.stringify({
              action: 'status_change',
              targetAdmin: {
                uid: uid,
                userId: adminUserId,
                surname: adminSurname,
                fullName: adminFullName,
                email: adminEmail,
                phoneNumber: adminPhone
              },
              performedBy: {
                uid: updatedByAdmin.uid,
                userId: updatedByAdmin.userId,
                surname: updatedByAdmin.surname,
                fullName: updatedByAdmin.fullName || 'Not provided'
              },
              oldStatus: oldStatus,
              newStatus: newStatus,
              reason: reason || 'No reason provided',
              timestamp: new Date().toISOString()
            }),
            fieldChanges: [
              { field: 'status', oldValue: oldStatus || 'unknown', newValue: newStatus }
            ]
          };
          
          console.log('💾 Saving status change log to security_logs collection...');
          const logRef = await addDoc(collection(db, 'security_logs'), logData);
          console.log('✅ Status change security log created with ID:', logRef.id);
          
          // Verify the log was saved
          const verifyLog = await getDoc(logRef);
          if (verifyLog.exists()) {
            console.log('✅✅ Status change log VERIFIED in Firestore');
          } else {
            console.error('❌ CRITICAL: Status change log not found after creation');
          }
        } catch (logError: any) {
          console.error('❌ CRITICAL ERROR: Failed to log status change:', logError);
          console.error('Error details:', {
            message: logError.message,
            code: logError.code,
            stack: logError.stack
          });
        }
      } else {
        console.warn('⚠️ No updatedByAdmin provided - status change log will not be created');
      }
    } catch (error: any) {
      console.error('Error updating admin status:', error);
      throw new Error(error.message || 'Failed to update admin status');
    }
  },

  // ENHANCED: Update admin profile with SMS notification and detailed logging
  async updateAdmin(
    uid: string, 
    updates: Partial<Admin>,
    updatedByAdmin?: Admin
  ): Promise<void> {
    try {
      console.log('📝 Updating admin profile:', uid);
      console.log('📊 Updates:', updates);
      
      // Get current admin data first for comparison
      const adminDoc = await getDoc(doc(db, 'users', uid));
      if (!adminDoc.exists()) {
        throw new Error('Admin not found');
      }
      
      const currentAdmin = adminDoc.data();
      const adminUserId = currentAdmin.userId || 'N/A';
      const adminSurname = currentAdmin.surname || currentAdmin.name || 'N/A';
      
      // Calculate field-level changes
      const fieldChanges = calculateFieldChanges(currentAdmin, updates);
      
      if (fieldChanges.length > 0) {
        console.log('🔍 Detected changes:', fieldChanges);
        
        // ✨ NEW: Check if ONLY status was changed
        const isStatusOnlyChange = fieldChanges.length === 1 && fieldChanges[0].field === 'status';
        
        // Update in Firestore
        await updateDoc(doc(db, 'users', uid), updates);
        console.log('✅ Admin profile updated in Firestore');
        
        // ENHANCED: Log in security logs with COMPREHENSIVE details
        try {
          console.log('📝 Creating comprehensive admin edit security log...');
          const changesArray = fieldChanges.map(c => c.field);
          
          // Create detailed change description for details field
          const changesDescription = fieldChanges.map(c => 
            `${c.field} (${c.oldValue} → ${c.newValue})`
          ).join(', ');
          
          const logData = {
            action: 'admin_edited',
            targetAdminUid: uid,
            targetAdminUserId: adminUserId,
            targetAdminSurname: adminSurname,
            performedByUid: updatedByAdmin?.uid || 'system',
            performedByUserId: updatedByAdmin?.userId || 'N/A',
            performedBySurname: updatedByAdmin?.surname || 'System',
            timestamp: Timestamp.now(),
            details: `Admin profile updated: ${adminSurname} (${adminUserId}). Changes: ${changesDescription}`,
            changes: JSON.stringify({
              action: 'edit',
              targetAdmin: {
                uid: uid,
                userId: adminUserId,
                surname: adminSurname,
                fullName: currentAdmin.fullName || 'Not provided',
                email: currentAdmin.email || 'Not provided',
                phoneNumber: currentAdmin.phoneNumber || 'Not provided'
              },
              performedBy: updatedByAdmin ? {
                uid: updatedByAdmin.uid,
                userId: updatedByAdmin.userId,
                surname: updatedByAdmin.surname,
                fullName: updatedByAdmin.fullName || 'Not provided'
              } : {
                uid: 'system',
                userId: 'system',
                surname: 'System',
                fullName: 'System'
              },
              changedFields: changesArray,
              oldValues: Object.fromEntries(fieldChanges.map(c => [c.field, c.oldValue])),
              newValues: Object.fromEntries(fieldChanges.map(c => [c.field, c.newValue])),
              timestamp: new Date().toISOString()
            }),
            fieldChanges: fieldChanges
          };
          
          console.log('💾 Saving admin edit log to security_logs collection...');
          const logRef = await addDoc(collection(db, 'security_logs'), logData);
          console.log('✅ Admin edit security log created with ID:', logRef.id);
          
          // Verify the log was saved
          const verifyLog = await getDoc(logRef);
          if (verifyLog.exists()) {
            console.log('✅✅ Admin edit log VERIFIED in Firestore');
          } else {
            console.error('❌ CRITICAL: Admin edit log not found after creation');
          }
          
          // ✨ NEW: Send appropriate SMS based on what changed
          try {
            if (isStatusOnlyChange) {
              // Send status-only change SMS
              const oldStatus = fieldChanges[0].oldValue;
              const newStatus = fieldChanges[0].newValue;
              await sendAdminStatusChangeSMS(
                currentAdmin.phoneNumber,
                currentAdmin.userId,
                oldStatus,
                newStatus,
                updatedByAdmin?.userId || 'System'
              );
              console.log('✅ Admin status-only change SMS notification sent');
            } else {
              // Send regular edit SMS
              await sendAdminEditSMS(
                currentAdmin.phoneNumber,
                currentAdmin.userId,
                changesArray
              );
              console.log('✅ Admin edit SMS notification sent');
            }
          } catch (smsError) {
            console.warn('⚠️ Failed to send SMS notification:', smsError);
          }
        } catch (logError: any) {
          console.error('❌ CRITICAL ERROR: Failed to log admin edit:', logError);
          console.error('Error details:', {
            message: logError.message,
            code: logError.code,
            stack: logError.stack
          });
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

      // ✨ NEW: Send deletion SMS BEFORE deleting the admin
      try {
        await sendAdminDeletionSMS(
          adminData.phoneNumber,
          adminData.userId,
          deletedByAdmin?.userId || 'System'
        );
        console.log('✅ Admin deletion SMS notification sent');
      } catch (smsError) {
        console.warn('⚠️ Failed to send deletion SMS:', smsError);
      }

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
        3
      );

      console.log('📥 Response received:', {
        status: deleteResponse.status,
        statusText: deleteResponse.statusText,
        ok: deleteResponse.ok
      });

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
          console.log('📝 Creating comprehensive admin deletion security log...');
          
          const logData = {
            action: 'admin_deleted',
            targetAdminUid: uid,
            targetAdminUserId: adminData.userId || 'N/A',
            targetAdminSurname: adminData.surname || adminData.name || 'N/A',
            performedByUid: deletedByAdmin.uid,
            performedByUserId: deletedByAdmin.userId || 'N/A',
            performedBySurname: deletedByAdmin.surname || 'N/A',
            timestamp: Timestamp.now(),
            details: `Admin ${adminData.surname || adminData.name} (${adminData.userId}) was permanently deleted by ${deletedByAdmin.surname} (${deletedByAdmin.userId}). All associated data including profile picture and authentication have been removed. Changes: status (${adminData.status || 'active'} → DELETED), account (EXISTS → PERMANENTLY REMOVED)`,
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
                surname: deletedByAdmin.surname,
                fullName: deletedByAdmin.fullName || 'Not provided'
              },
              deletionDetails: {
                profilePictureDeleted: deleteResult.details.profilePicDeleted,
                firestoreDeleted: deleteResult.details.firestoreDeleted,
                authDeleted: deleteResult.details.authDeleted
              },
              timestamp: new Date().toISOString()
            }),
            fieldChanges: [
              { field: 'status', oldValue: adminData.status || 'active', newValue: 'DELETED' },
              { field: 'account', oldValue: 'EXISTS', newValue: 'PERMANENTLY REMOVED' }
            ]
          };
          
          console.log('💾 Saving admin deletion log to security_logs collection...');
          const logRef = await addDoc(collection(db, 'security_logs'), logData);
          console.log('✅ Admin deletion security log created with ID:', logRef.id);
          
          // Verify the log was saved
          const verifyLog = await getDoc(logRef);
          if (verifyLog.exists()) {
            console.log('✅✅ Admin deletion log VERIFIED in Firestore');
          } else {
            console.error('❌ CRITICAL: Admin deletion log not found after creation');
          }
        } catch (logError: any) {
          console.error('❌ CRITICAL ERROR: Failed to log admin deletion:', logError);
          console.error('Error details:', {
            message: logError.message,
            code: logError.code,
            stack: logError.stack
          });
        }
      } else {
        console.warn('⚠️ No deletedByAdmin provided or adminData missing - deletion log will not be created');
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
