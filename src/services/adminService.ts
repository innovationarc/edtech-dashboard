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
    profilePictureUrl?: string
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
          details: `New admin account created: ${surname} (${userId}) by ${createdByAdminSurname} (${createdByAdminId}). Created fields: userId (N/A → ${userId}), surname (N/A → ${surname}), fullName (N/A → ${fullName || 'Not provided'}), email (N/A → ${email || 'Not provided'}), phoneNumber (N/A → ${phone}), status (N/A → active), role (N/A → admin)`,
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
        
        const verifyLog = await getDoc(logRef);
        if (verifyLog.exists()) {
          console.log('✅✅ Log VERIFIED in Firestore database');
        } else {
          console.error('❌❌ CRITICAL: Log not found after creation!');
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
      }
      
      // Send SMS notification
      try {
        console.log('📱 Sending SMS notification to:', phone);
        await sendAdminCreationSMS(phone, userId);
        console.log('✅ SMS notification sent successfully');
      } catch (smsError: any) {
        console.warn('⚠️ Failed to send SMS notification:', smsError.message);
      }
      
      console.log('🎉 Admin creation completed successfully');
      console.log('✅ Current admin session fully preserved');
      
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
      
      return logsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          timestamp: data.timestamp?.toDate() || new Date(),
        };
      }) as SecurityLog[];
    } catch (error: any) {
      console.error('Error fetching all security logs:', error);
      throw new Error(error.message || 'Failed to fetch security logs');
    }
  },

  // ENHANCED: Password Reset with SMS notification and COMPREHENSIVE security logging
  async resetAdminPassword(
    uid: string, 
    newPassword: string, 
    resetReason?: string,
    performedByAdmin?: Admin
  ): Promise<void> {
    try {
      console.log('🔑 Starting password reset for admin UID:', uid);
      
      // CRITICAL FIX: If performedByAdmin is not provided, get current logged-in admin
      let performerUid = performedByAdmin?.uid;
      let performerUserId = performedByAdmin?.userId;
      let performerSurname = performedByAdmin?.surname;
      let performerFullName = performedByAdmin?.fullName;
      
      if (!performedByAdmin) {
        console.log('⚠️ No performedByAdmin provided, fetching current admin...');
        const currentUser = auth.currentUser;
        if (currentUser) {
          try {
            const currentAdminDoc = await getDoc(doc(db, 'users', currentUser.uid));
            if (currentAdminDoc.exists()) {
              const currentAdminData = currentAdminDoc.data();
              performerUid = currentUser.uid;
              performerUserId = currentAdminData.userId || 'N/A';
              performerSurname = currentAdminData.surname || currentAdminData.name || 'Admin';
              performerFullName = currentAdminData.fullName || 'Not provided';
              console.log('✅ Current admin retrieved:', performerUserId);
            }
          } catch (fetchError) {
            console.warn('⚠️ Could not fetch current admin, using system as performer');
            performerUid = 'system';
            performerUserId = 'SYSTEM';
            performerSurname = 'System';
            performerFullName = 'System';
          }
        }
      }
      
      // Set defaults if still undefined
      performerUid = performerUid || 'system';
      performerUserId = performerUserId || 'SYSTEM';
      performerSurname = performerSurname || 'System';
      performerFullName = performerFullName || 'System';
      
      // Get admin data for userId and phone
      const adminDoc = await getDoc(doc(db, 'users', uid));
      if (!adminDoc.exists()) {
        throw new Error('Admin not found');
      }
      
      const adminData = adminDoc.data();
      const adminUserId = adminData.userId;
      const adminSurname = adminData.surname || adminData.name || 'Admin';
      const adminPhone = adminData.phoneNumber;
      const adminEmail = adminData.email || 'Not provided';
      const adminFullName = adminData.fullName || 'Not provided';
      
      console.log('📄 Admin data retrieved:', {
        userId: adminUserId,
        surname: adminSurname,
        phoneNumber: adminPhone
      });
      
      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 
                         import.meta.env.VITE_API_URL ||
                         'https://edtech-dashboard-alpha.vercel.app';
      const MASTER_API_KEY = import.meta.env.VITE_SMS_MASTER_KEY;

      console.log('🌐 Backend URL:', BACKEND_URL);

      // Call unified password-reset API
      console.log('📡 Calling password-reset API...');
      const response = await fetch(`${BACKEND_URL}/api/password-reset`, {
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
        const errorText = await response.text();
        console.error('❌ Password reset API error:', errorText);
        throw new Error(`API returned status ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        console.error('❌ Password reset failed:', result.error);
        throw new Error(result.error || 'Failed to reset password');
      }

      console.log('✅ Password reset successful');
      
      // Handle resetReason - it might be passed as an object by the UI (bug in calling code)
      let reasonString = '';
      if (resetReason) {
        if (typeof resetReason === 'string') {
          reasonString = resetReason;
        } else if (typeof resetReason === 'object') {
          console.warn('⚠️ WARNING: resetReason is an object (calling code bug), ignoring it');
          // The UI is incorrectly passing an admin object as resetReason
          // We'll just ignore it and use a default message
          reasonString = '';
        } else {
          reasonString = String(resetReason);
        }
      }
      
      // Send SMS notification
      try {
        await sendPasswordResetSMS(adminPhone, adminUserId, performerUserId, reasonString || undefined);
        console.log('✅ Password reset SMS sent');
      } catch (smsError) {
        console.warn('⚠️ Failed to send password reset SMS:', smsError);
      }
      
      // ENHANCED: ALWAYS log password reset in security logs
      try {
        console.log('📝 Creating comprehensive password reset security log...');
        
        // Create completely flat log data - ONLY primitive values
        const logData: any = {
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
