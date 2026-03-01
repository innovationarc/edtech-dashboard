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
  designation?: string;
  validTill?: string | 'lifetime';
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
Your ID: ${adminId}

This position is confidential and demands a high standard of responsibility. Please ensure your credentials remain private.

Thank you.
Ed-tech Support`;
  
  await sendSMS(phoneNumber, message);
};

/**
 * Send SMS notification for admin deletion
 */
const sendAdminDeleteSMS = async (
  phoneNumber: string, 
  adminId: string, 
  deletedByAdminId: string
): Promise<void> => {
  const message = `Sir,
This is to inform you that your Administrator access on Ed-tech has been permanently revoked by Admin ${deletedByAdminId}.

Your ID: ${adminId}

You will no longer have access to the administrative panel. All credentials associated with this account have been invalidated.

If you believe this action was taken in error, please contact the system administrator immediately.

Thank you.
Ed-tech Support`;
  
  await sendSMS(phoneNumber, message);
};

/**
 * Send SMS notification for password reset
 */
const sendPasswordResetSMS = async (
  phoneNumber: string,
  adminId: string,
  newPassword: string,
  resetByAdminId: string
): Promise<void> => {
  const message = `Sir,
Your password for Ed-tech Administrator access has been reset by Admin ${resetByAdminId}.

Your ID: ${adminId}
New Password: ${newPassword}

For security reasons, please change this password immediately upon your next login.

Thank you.
Ed-tech Support`;
  
  await sendSMS(phoneNumber, message);
};

/**
 * Send SMS notification for admin edit/profile update
 */
const sendAdminEditSMS = async (
  phoneNumber: string,
  adminId: string,
  changedFields: string[] | Array<{ field: string; oldValue: string; newValue: string }>
): Promise<void> => {
  // Normalize changedFields to string array
  const fields = Array.isArray(changedFields) && changedFields.length > 0 && typeof changedFields[0] === 'object'
    ? (changedFields as Array<{ field: string }>).map(f => f.field)
    : changedFields as string[];
    
  const fieldList = fields.join(', ');
  
  const message = `Sir,
Your Administrator profile on Ed-tech has been updated.

Admin ID: ${adminId}
Modified fields: ${fieldList}

If you did not authorize these changes, please contact the system administrator immediately.

Thank you.
Ed-tech Support`;
  
  await sendSMS(phoneNumber, message);
};

/**
 * Retry logic for fetch requests
 */
const fetchWithRetry = async (
  url: string, 
  options: RequestInit, 
  retries: number = 3
): Promise<Response> => {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      return response;
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
  throw new Error('Max retries reached');
};

/**
 * Generate userId using backend API
 */
const generateUserId = async (role: string): Promise<string> => {
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 
                     import.meta.env.VITE_API_URL ||
                     'https://edtech-dashboard-alpha.vercel.app';
  const MASTER_API_KEY = import.meta.env.VITE_SMS_MASTER_KEY;

  try {
    const response = await fetch(`${BACKEND_URL}/api/generate-userid`, {
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
      throw new Error('Failed to generate userId');
    }

    const result = await response.json();
    return result.userId;
  } catch (error) {
    console.error('Error generating userId:', error);
    throw error;
  }
};

/**
 * Calculate field-level changes between current and updated data
 */
const calculateFieldChanges = (
  currentData: any,
  updates: any
): Array<{ field: string; oldValue: string; newValue: string }> => {
  const changes: Array<{ field: string; oldValue: string; newValue: string }> = [];
  
  // Check each field in updates
  Object.keys(updates).forEach(key => {
    const oldValue = currentData[key];
    const newValue = updates[key];
    
    // Convert to strings for comparison
    const oldStr = oldValue === undefined || oldValue === null ? 'Not set' : String(oldValue);
    const newStr = newValue === undefined || newValue === null ? 'Not set' : String(newValue);
    
    // Only add if values are different
    if (oldStr !== newStr) {
      changes.push({
        field: key,
        oldValue: oldStr,
        newValue: newStr
      });
    }
  });
  
  return changes;
};

export const adminService = {
  // Get all admins with ordering
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
          designation: data.designation || '',
          validTill: data.validTill || 'lifetime',
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
        designation: data.designation || '',
        validTill: data.validTill || 'lifetime',
      } as Admin;
    } catch (error: any) {
      console.error('Error fetching admin:', error);
      throw new Error(error.message || 'Failed to fetch admin');
    }
  },

  // Create new admin - CRITICAL FIX: Uses backend create-user API to preserve session
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
    profilePictureUrl?: string,
    designation?: string,
    validTill?: string | 'lifetime'
  ): Promise<Admin> {
    // Verify current admin is logged in
    const currentUser = auth.currentUser;
    
    if (!currentUser) {
      throw new Error('No authenticated user found. Please sign in again.');
    }

    try {
      console.log('🚀 Creating admin account via backend API...');
      console.log('📊 Creator info:', { createdByAdminId, createdByAdminUid, createdByAdminSurname });
      console.log('🔐 Current admin UID (will be preserved):', currentUser.uid);
      
      // Generate unique userId using backend API (format: AD-YYMM-XXXXX)
      const userId = await generateUserId('admin');
      console.log('📝 Generated userId:', userId);
      
      // IMPORTANT: Use userId@admin.local format for Firebase Auth
      const authEmail = `${userId}@admin.local`;
      console.log('📧 Auth email format:', authEmail);
      
      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 
                         import.meta.env.VITE_API_URL ||
                         'https://edtech-dashboard-alpha.vercel.app';
      const MASTER_API_KEY = import.meta.env.VITE_SMS_MASTER_KEY;

      console.log('🌐 Backend URL:', BACKEND_URL);

      // CRITICAL FIX: Call backend create-user API (supports all 8 roles, creating admin here)
      console.log('📡 Calling backend create-user API...');
      const createUserResponse = await fetchWithRetry(
        `${BACKEND_URL}/api/create-user`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: authEmail,
            password: password,
            role: 'admin',
            userData: {
              userId: userId,
              surname: surname,
              fullName: fullName || '',
              email: email || '',
              phoneNumber: phone,
              dob: dob || '',
              gender: gender || '',
              bloodGroup: bloodGroup || '',
              religion: religion || '',
              address: address || '',
              birthCertificateNumber: birthCertificateNumber || '',
              nid: nid || '',
              designation: designation || '',
              validTill: validTill || 'lifetime',
              status: 'active',
              createdBy: createdByAdminId,
              profilePictureUrl: profilePictureUrl || '',
              deviceId: ''
            },
            apiKey: MASTER_API_KEY
          })
        },
        3
      );

      console.log('📥 Create user response received:', {
        status: createUserResponse.status,
        statusText: createUserResponse.statusText,
        ok: createUserResponse.ok
      });

      if (!createUserResponse.ok) {
        let errorText = '';
        try {
          errorText = await createUserResponse.text();
        } catch (e) {
          errorText = 'Could not read error response';
        }
        console.error('❌ Create user API error:', errorText);
        throw new Error(`API returned status ${createUserResponse.status}: ${errorText}`);
      }

      const contentType = createUserResponse.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.error('❌ Invalid content type:', contentType);
        throw new Error('API did not return JSON response');
      }

      let createResult;
      try {
        createResult = await createUserResponse.json();
        console.log('✅ Create result:', createResult);
      } catch (parseError) {
        console.error('❌ Failed to parse JSON response:', parseError);
        throw new Error('Failed to parse API response');
      }

      if (!createResult.success || !createResult.uid) {
        console.error('❌ User creation failed:', createResult.error);
        throw new Error(createResult.error || 'Failed to create admin user');
      }

      const newUid = createResult.uid;
      console.log('✅ Admin user created via backend with UID:', newUid);
      console.log('✅✅ CRITICAL: Current admin session FULLY PRESERVED - NO LOGOUT');
      
      // Prepare admin data for return
      const adminData: any = {
        uid: newUid,
        userId: userId,
        surname: surname,
        fullName: fullName || '',
        email: email || '',
        phoneNumber: phone,
        dob: dob || '',
        gender: gender || '',
        bloodGroup: bloodGroup || '',
        religion: religion || '',
        address: address || '',
        birthCertificateNumber: birthCertificateNumber || '',
        nid: nid || '',
        designation: designation || '',
        validTill: validTill || 'lifetime',
        role: 'admin',
        status: 'active',
        createdAt: Timestamp.now(),
        createdBy: createdByAdminId,
        deviceId: '',
        profilePictureUrl: profilePictureUrl || ''
      };
      
      // CRITICAL: ENHANCED ADMIN CREATION LOGGING
      try {
        console.log('📝 Creating security log for admin creation...');
        
        const logData = {
          action: 'admin_created',
          targetAdminUid: newUid,
          targetAdminUserId: userId,
          targetAdminSurname: surname,
          performedByUid: createdByAdminUid,
          performedByUserId: createdByAdminId,
          performedBySurname: createdByAdminSurname,
          timestamp: Timestamp.now(),
          details: `New admin created: ${surname} (${userId}) by ${createdByAdminSurname} (${createdByAdminId}). Designation: ${designation || 'Not specified'}. Valid Till: ${validTill === 'lifetime' ? 'Lifetime' : validTill || 'Lifetime'}.`,
          changes: JSON.stringify({
            action: 'create',
            newAdmin: adminData,
            createdBy: {
              uid: createdByAdminUid,
              userId: createdByAdminId,
              surname: createdByAdminSurname
            }
          })
        };
        
        console.log('💾 Saving admin creation log to security_logs collection...');
        const logRef = await addDoc(collection(db, 'security_logs'), logData);
        console.log('✅ Admin creation security log created with ID:', logRef.id);
        
        // Verify the log was saved
        const verifyLog = await getDoc(logRef);
        if (verifyLog.exists()) {
          console.log('✅✅ Admin creation log VERIFIED in Firestore');
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
      }
      
      // Send creation SMS
      try {
        console.log('📱 Sending admin creation SMS...');
        await sendAdminCreationSMS(phone, userId);
        console.log('✅ Admin creation SMS sent successfully');
      } catch (smsError) {
        console.warn('⚠️ Failed to send creation SMS:', smsError);
      }

      return {
        uid: newUid,
        userId: userId,
        surname: surname,
        fullName: fullName || '',
        email: email || '',
        phoneNumber: phone,
        dob: dob || '',
        gender: gender || '',
        bloodGroup: bloodGroup || '',
        religion: religion || '',
        address: address || '',
        birthCertificateNumber: birthCertificateNumber || '',
        nid: nid || '',
        designation: designation || '',
        validTill: validTill || 'lifetime',
        role: 'admin',
        status: 'active',
        createdAt: new Date(),
        createdBy: createdByAdminId,
        profilePictureUrl: profilePictureUrl || ''
      } as Admin;

    } catch (error: any) {
      console.error('❌ Create admin error:', error);
      throw new Error(error.message || 'Failed to create admin');
    }
  },

  // Get all security logs for all admins (used by All Admin Logs Modal)
  async getAllSecurityLogs(): Promise<SecurityLog[]> {
    try {
      const logsCollection = collection(db, 'security_logs');
      const logsQuery = query(
        logsCollection,
        orderBy('timestamp', 'desc')
      );
      const logsSnapshot = await getDocs(logsQuery);
      
      return logsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate() || new Date(),
      })) as SecurityLog[];
    } catch (error: any) {
      console.error('Error fetching all security logs:', error);
      throw new Error(error.message || 'Failed to fetch security logs');
    }
  },

  // Get security logs for a specific admin
  async getSecurityLogs(adminUid: string): Promise<SecurityLog[]> {
    try {
      const logsCollection = collection(db, 'security_logs');
      const logsQuery = query(
        logsCollection,
        where('targetAdminUid', '==', adminUid),
        orderBy('timestamp', 'desc')
      );
      const logsSnapshot = await getDocs(logsQuery);
      
      return logsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate() || new Date(),
      })) as SecurityLog[];
    } catch (error: any) {
      console.error('Error fetching security logs:', error);
      throw new Error(error.message || 'Failed to fetch security logs');
    }
  },

  // Reset admin password using backend API
  async resetPassword(
    uid: string,
    newPassword: string,
    reason: string,
    resetByAdmin: Admin
  ): Promise<void> {
    try {
      console.log('🔐 Resetting admin password:', uid);
      
      // Get admin data first
      const adminDoc = await getDoc(doc(db, 'users', uid));
      if (!adminDoc.exists()) {
        throw new Error('Admin not found');
      }
      
      const adminData = adminDoc.data();
      const adminUserId = adminData.userId || 'N/A';
      const adminSurname = adminData.surname || adminData.name || 'N/A';
      
      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 
                         import.meta.env.VITE_API_URL ||
                         'https://edtech-dashboard-alpha.vercel.app';
      const MASTER_API_KEY = import.meta.env.VITE_SMS_MASTER_KEY;
      
      console.log('📡 Calling password reset API...');
      const response = await fetchWithRetry(
        `${BACKEND_URL}/api/reset-password`,
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
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Password reset API error:', errorText);
        throw new Error(`API returned status ${response.status}: ${errorText}`);
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to reset password');
      }
      
      console.log('✅ Password reset successfully');
      
      // Send SMS notification
      try {
        console.log('📱 Sending password reset SMS notification...');
        await sendPasswordResetSMS(
          adminData.phoneNumber,
          adminUserId,
          newPassword,
          resetByAdmin.userId || 'N/A'
        );
        console.log('✅ Password reset SMS sent successfully');
      } catch (smsError) {
        console.warn('⚠️ Failed to send password reset SMS:', smsError);
      }
      
      // Log password reset in security logs
      try {
        console.log('📝 Creating password reset security log...');
        
        const logData = {
          action: 'password_reset',
          targetAdminUid: uid,
          targetAdminUserId: adminUserId,
          targetAdminSurname: adminSurname,
          performedByUid: resetByAdmin.uid,
          performedByUserId: resetByAdmin.userId || 'N/A',
          performedBySurname: resetByAdmin.surname || 'N/A',
          timestamp: Timestamp.now(),
          reason: reason,
          details: `Password reset for admin ${adminSurname} (${adminUserId}) by ${resetByAdmin.surname} (${resetByAdmin.userId}). Reason: ${reason}`
        };
        
        const logRef = await addDoc(collection(db, 'security_logs'), logData);
        console.log('✅ Password reset security log created with ID:', logRef.id);
      } catch (logError) {
        console.error('❌ Failed to log password reset:', logError);
      }
      
    } catch (error: any) {
      console.error('❌ Reset password error:', error);
      throw new Error(error.message || 'Failed to reset password');
    }
  },

  // Update admin status (active/inactive/pending)
  async updateAdminStatus(
    uid: string, 
    newStatus: 'active' | 'inactive' | 'pending'
  ): Promise<void> {
    try {
      console.log('🔄 Updating admin status:', { uid, newStatus });
      
      // Get current status first for logging
      const adminDoc = await getDoc(doc(db, 'users', uid));
      if (!adminDoc.exists()) {
        throw new Error('Admin not found');
      }
      
      const currentStatus = adminDoc.data().status;
      
      // Update status
      await updateDoc(doc(db, 'users', uid), { status: newStatus });
      
      console.log('✅ Admin status updated successfully');
      console.log(`  Old status: ${currentStatus}`);
      console.log(`  New status: ${newStatus}`);
    } catch (error: any) {
      console.error('Error updating admin status:', error);
      throw new Error(error.message || 'Failed to update admin status');
    }
  },

  // Update admin profile - ENHANCED WITH COMPREHENSIVE LOGGING
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
          
// Send SMS for profile edit
          try {
            await sendAdminEditSMS(
              currentAdmin.phoneNumber,
              currentAdmin.userId,
              fieldChanges
            );
            console.log('✅ Admin edit SMS notification sent');
          } catch (smsError) {
            console.warn('⚠️ Failed to send edit SMS:', smsError);
          }
          
          // Send SMS for profile edit
          try {
            await sendAdminEditSMS(
              currentAdmin.phoneNumber,
              currentAdmin.userId,
              changesArray
            );
            console.log('✅ Admin edit SMS notification sent');
          } catch (smsError) {
            console.warn('⚠️ Failed to send edit SMS:', smsError);
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
      // Send SMS notification to deleted admin
      if (adminData?.phoneNumber && deletedByAdmin) {
        try {
          console.log('📱 Sending deletion SMS notification...');
          await sendAdminDeleteSMS(
            adminData.phoneNumber,
            adminData.userId || 'N/A',
            deletedByAdmin.userId || 'N/A'
          );
          console.log('✅ Admin deletion SMS sent successfully');
        } catch (smsError) {
          console.warn('⚠️ Failed to send deletion SMS:', smsError);
          // Don't throw error - deletion was successful, SMS is just notification
        }
      } else {
        console.warn('⚠️ Skipping deletion SMS - missing phone number or deletedByAdmin info');
      }
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
                designation: adminData.designation || 'Not provided',
                validTill: adminData.validTill || 'lifetime',
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
          designation: data.designation || '',
          validTill: data.validTill || 'lifetime',
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
  },

  // Alias for resetPassword — used by PasswordResetModal
  async resetAdminPassword(
    uid: string,
    newPassword: string,
    reason: string,
    resetByAdmin: Admin
  ): Promise<void> {
    return adminService.resetPassword(uid, newPassword, reason, resetByAdmin);
  }
}

// END OF FILE - THIS IS THE COMPLETE adminService.ts
