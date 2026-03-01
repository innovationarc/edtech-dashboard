// src/services/teacherService.ts - TEACHER MANAGEMENT SERVICE
// Uses existing backend APIs: generate-id.ts, create-user.ts, password-reset.ts, delete-user.ts
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

export interface Teacher {
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
  role: 'teacher';
  status: 'active' | 'inactive' | 'pending';
  profilePictureUrl?: string;
  createdAt: Date;
  createdBy: string;
  lastLogin?: Date;
}

export interface SecurityLog {
  id?: string;
  action: 'login' | 'logout' | 'password_reset' | 'teacher_created' | 'teacher_edited' | 'teacher_deleted' | 'status_changed' | 'profile_updated' | 'phone_number_changed';
  targetTeacherUid: string;
  targetTeacherUserId: string;
  targetTeacherSurname: string;
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

/* Normalize phone number to 13-digit format: 8801XXXXXXXXX */
const normalizePhoneNumber = (phoneNumber: string): string => {
  if (!phoneNumber || phoneNumber.trim() === '') {
    throw new Error('Phone number is required');
  }

  let cleaned = phoneNumber.replace(/\D/g, '');
  
  if (cleaned.length === 13 && cleaned.startsWith('880')) {
    return cleaned;
  }
  
  if (cleaned.startsWith('880')) {
    cleaned = cleaned.substring(3);
  } else if (cleaned.startsWith('88')) {
    cleaned = cleaned.substring(2);
  }
  
  if (cleaned.length === 11 && cleaned.startsWith('0')) {
    return `880${cleaned.substring(1)}`;
  }
  
  if (cleaned.length === 10 && cleaned.startsWith('1')) {
    return `880${cleaned}`;
  }
  
  if (cleaned.length === 10 && cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }
  
  if (cleaned.length === 10 && cleaned.startsWith('1')) {
    return `880${cleaned}`;
  }
  
  if (cleaned.length === 9) {
    return `8801${cleaned}`;
  }
  
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
 * Send SMS notification to new teacher
 */
const sendTeacherCreationSMS = async (phoneNumber: string, teacherId: string): Promise<void> => {
  const message = `Dear Teacher,
You have been granted Teacher access on Ed-tech platform. You can now access the education management system.

Login credentials:
User ID: ${teacherId}
Password: The password set during account creation

Please log in at: https://edtech-dashboard-alpha.vercel.app

For assistance, contact your administrator.

Best regards,
Ed-tech Team`;

  await sendSMS(phoneNumber, message);
};

/**
 * Send password reset SMS
 */
const sendPasswordResetSMS = async (phoneNumber: string, teacherId: string, newPassword: string): Promise<void> => {
  const message = `Dear Teacher,
Your password has been reset by an administrator.

New login credentials:
User ID: ${teacherId}
New Password: ${newPassword}

Please log in and change your password: https://edtech-dashboard-alpha.vercel.app

For security reasons, change this password immediately after logging in.

Best regards,
Ed-tech Team`;

  await sendSMS(phoneNumber, message);
};

/**
 * Send teacher deletion SMS
 */
const sendTeacherDeleteSMS = async (phoneNumber: string, teacherId: string, deletedBy: string): Promise<void> => {
  const message = `Dear Teacher,
Your teacher account (${teacherId}) has been permanently deleted by administrator ${deletedBy}.

All your access to the Ed-tech platform has been revoked. If you believe this is an error, please contact your administrator immediately.

Best regards,
Ed-tech Team`;

  await sendSMS(phoneNumber, message);
};

/**
 * Fetch with retry logic
 */
const fetchWithRetry = async (url: string, options: RequestInit, maxRetries = 3): Promise<Response> => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (response.ok || attempt === maxRetries) {
        return response;
      }
      await new Date(Math.min(1000 * Math.pow(2, attempt), 10000));
    } catch (error) {
      if (attempt === maxRetries) throw error;
      await new Promise(resolve => setTimeout(resolve, Math.min(1000 * Math.pow(2, attempt), 10000)));
    }
  }
  throw new Error('Max retries reached');
};

export const teacherService = {
  /**
   * Get all teachers
   */
  async getAllTeachers(): Promise<Teacher[]> {
    try {
      const usersCollection = collection(db, 'users');
      const teacherQuery = query(
        usersCollection, 
        where('role', '==', 'teacher'),
        orderBy('createdAt', 'desc')
      );
      const teachersSnapshot = await getDocs(teacherQuery);
      
      return teachersSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          uid: doc.id,
          surname: data.surname || data.name || data.fullName || 'Teacher',
          fullName: data.fullName || data.name || data.surname || '',
          createdAt: data.createdAt?.toDate() || new Date(),
          lastLogin: data.lastLogin?.toDate(),
        };
      }) as Teacher[];
    } catch (error: any) {
      console.error('Error getting teachers:', error);
      throw new Error(error.message || 'Failed to load teachers');
    }
  },

  /**
   * Get teacher by UID
   */
  async getTeacherByUid(uid: string): Promise<Teacher | null> {
    try {
      const teacherDoc = await getDoc(doc(db, 'users', uid));
      
      if (!teacherDoc.exists()) {
        return null;
      }
      
      const data = teacherDoc.data();
      if (data.role !== 'teacher') {
        return null;
      }
      
      return {
        ...data,
        uid: teacherDoc.id,
        surname: data.surname || data.name || data.fullName || 'Teacher',
        fullName: data.fullName || data.name || data.surname || '',
        createdAt: data.createdAt?.toDate() || new Date(),
        lastLogin: data.lastLogin?.toDate(),
      } as Teacher;
    } catch (error: any) {
      console.error('Error getting teacher by UID:', error);
      throw new Error(error.message || 'Failed to load teacher');
    }
  },

  /**
   * Create a new teacher using backend API
   */
  async createTeacher(
    phoneNumber: string,
    email: string | undefined,
    password: string,
    surname: string,
    fullName: string | undefined,
    dob: string | undefined,
    phone: string,
    bloodGroup: string | undefined,
    gender: string | undefined,
    religion: string | undefined,
    address: string | undefined,
    birthCertificateNumber: string | undefined,
    nid: string | undefined,
    createdByUserId: string,
    createdByUid: string,
    createdBySurname: string,
    profilePictureUrl?: string
  ): Promise<Teacher> {
    try {
      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 
                         import.meta.env.VITE_API_URL ||
                         'https://edtech-dashboard-alpha.vercel.app';
      const MASTER_API_KEY = import.meta.env.VITE_SMS_MASTER_KEY;

      console.log('📡 Creating teacher via backend API...');

      const requestBody: any = {
        role: 'teacher',
        surname,
        phoneNumber: phone,
        password,
        fullName,
        email,
        dob,
        gender,
        bloodGroup,
        religion,
        address,
        birthCertificateNumber,
        nid,
        status: 'active',
        profilePictureUrl,
        createdBy: createdByUserId,
        createdByUserId,
        createdByRole: 'admin',
        apiKey: MASTER_API_KEY
      };

      const response = await fetchWithRetry(
        `${BACKEND_URL}/api/create-user`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        },
        3
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error: ${errorText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to create teacher');
      }

      console.log('✅ Teacher created successfully:', result.userId);

      // Send SMS notification
      if (phone) {
        try {
          await sendTeacherCreationSMS(phone, result.userId);
          console.log('✅ Teacher creation SMS sent successfully');
        } catch (smsError) {
          console.warn('⚠️ Failed to send creation SMS:', smsError);
        }
      }

      // Log teacher creation
      try {
        const logData = {
          action: 'teacher_created',
          targetTeacherUid: result.uid,
          targetTeacherUserId: result.userId,
          targetTeacherSurname: surname,
          performedByUid: createdByUid,
          performedByUserId: createdByUserId,
          performedBySurname: createdBySurname,
          timestamp: Timestamp.now(),
          details: `Teacher ${surname} (${result.userId}) was created by ${createdBySurname}`,
        };
        
        await addDoc(collection(db, 'security_logs'), logData);
      } catch (logError) {
        console.error('❌ Failed to log teacher creation:', logError);
      }

      // Fetch the created teacher
      const teacherDoc = await getDoc(doc(db, 'users', result.uid));
      const teacherData = teacherDoc.data();

      return {
        ...teacherData,
        uid: result.uid,
        userId: result.userId,
        surname: teacherData?.surname || surname,
        fullName: teacherData?.fullName || fullName || '',
        createdAt: teacherData?.createdAt?.toDate() || new Date(),
        lastLogin: teacherData?.lastLogin?.toDate(),
      } as Teacher;

    } catch (error: any) {
      console.error('❌ Create teacher error:', error);
      throw new Error(error.message || 'Failed to create teacher account');
    }
  },

  /**
   * Update teacher
   */
  async updateTeacher(
    uid: string, 
    updates: Partial<Teacher>,
    updatedByUser?: any
  ): Promise<void> {
    try {
      const teacherRef = doc(db, 'users', uid);
      const teacherDoc = await getDoc(teacherRef);
      
      if (!teacherDoc.exists()) {
        throw new Error('Teacher not found');
      }

      const oldData = teacherDoc.data();
      
      // Track field changes
      const fieldChanges: Array<{field: string; oldValue: string; newValue: string}> = [];
      Object.keys(updates).forEach(key => {
        const oldValue = oldData[key];
        const newValue = (updates as any)[key];
        if (oldValue !== newValue) {
          fieldChanges.push({
            field: key,
            oldValue: String(oldValue || 'N/A'),
            newValue: String(newValue || 'N/A')
          });
        }
      });

      await updateDoc(teacherRef, {
        ...updates,
        updatedAt: Timestamp.now()
      });

      console.log('✅ Teacher updated successfully');

      // Log teacher edit
      if (updatedByUser && fieldChanges.length > 0) {
        try {
          const logData = {
            action: 'teacher_edited',
            targetTeacherUid: uid,
            targetTeacherUserId: oldData.userId || 'N/A',
            targetTeacherSurname: oldData.surname || 'N/A',
            performedByUid: updatedByUser.uid,
            performedByUserId: updatedByUser.userId || 'N/A',
            performedBySurname: updatedByUser.surname || 'N/A',
            timestamp: Timestamp.now(),
            details: `Teacher ${oldData.surname} (${oldData.userId}) was edited`,
            changes: JSON.stringify(fieldChanges),
            fieldChanges
          };
          
          await addDoc(collection(db, 'security_logs'), logData);
        } catch (logError) {
          console.error('❌ Failed to log teacher edit:', logError);
        }
      }
    } catch (error: any) {
      console.error('Error updating teacher:', error);
      throw new Error(error.message || 'Failed to update teacher');
    }
  },

  /**
   * Reset teacher password using backend API
   */
  async resetPassword(
    uid: string,
    newPassword: string,
    reason: string,
    resetByUser: any
  ): Promise<void> {
    try {
      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 
                         import.meta.env.VITE_API_URL ||
                         'https://edtech-dashboard-alpha.vercel.app';
      const MASTER_API_KEY = import.meta.env.VITE_SMS_MASTER_KEY;

      console.log('🔄 Resetting teacher password via backend API...');

      const teacherDoc = await getDoc(doc(db, 'users', uid));
      if (!teacherDoc.exists()) {
        throw new Error('Teacher not found');
      }

      const teacherData = teacherDoc.data();

      const response = await fetchWithRetry(
        `${BACKEND_URL}/api/password-reset`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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
        throw new Error(`API error: ${errorText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to reset password');
      }

      console.log('✅ Teacher password reset successfully');

      // Send SMS notification
      if (teacherData.phoneNumber) {
        try {
          await sendPasswordResetSMS(teacherData.phoneNumber, teacherData.userId, newPassword);
          console.log('✅ Password reset SMS sent successfully');
        } catch (smsError) {
          console.warn('⚠️ Failed to send password reset SMS:', smsError);
        }
      }

      // Log password reset
      try {
        const logData = {
          action: 'password_reset',
          targetTeacherUid: uid,
          targetTeacherUserId: teacherData.userId || 'N/A',
          targetTeacherSurname: teacherData.surname || 'N/A',
          performedByUid: resetByUser.uid,
          performedByUserId: resetByUser.userId || 'N/A',
          performedBySurname: resetByUser.surname || 'N/A',
          timestamp: Timestamp.now(),
          reason: reason || 'Password reset requested',
          details: `Password was reset for teacher ${teacherData.surname} (${teacherData.userId})`
        };
        
        await addDoc(collection(db, 'security_logs'), logData);
      } catch (logError) {
        console.error('❌ Failed to log password reset:', logError);
      }
    } catch (error: any) {
      console.error('❌ Reset password error:', error);
      throw new Error(error.message || 'Failed to reset password');
    }
  },

  /**
   * Get security logs for a specific teacher
   */
  async getSecurityLogs(teacherUid: string): Promise<SecurityLog[]> {
    try {
      const logsCollection = collection(db, 'security_logs');
      const logsQuery = query(
        logsCollection,
        where('targetTeacherUid', '==', teacherUid),
        orderBy('timestamp', 'desc')
      );
      
      const logsSnapshot = await getDocs(logsQuery);
      
      return logsSnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
        timestamp: doc.data().timestamp?.toDate() || new Date(),
      })) as SecurityLog[];
    } catch (error: any) {
      console.error('Error getting security logs:', error);
      throw new Error(error.message || 'Failed to load security logs');
    }
  },

  /**
   * Get all teacher security logs
   */
  async getAllTeacherSecurityLogs(): Promise<SecurityLog[]> {
    try {
      const logsCollection = collection(db, 'security_logs');
      const logsQuery = query(
        logsCollection,
        where('action', 'in', ['teacher_created', 'teacher_edited', 'teacher_deleted', 'password_reset']),
        orderBy('timestamp', 'desc')
      );
      
      const logsSnapshot = await getDocs(logsQuery);
      
      return logsSnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
        timestamp: doc.data().timestamp?.toDate() || new Date(),
      })) as SecurityLog[];
    } catch (error: any) {
      console.error('Error getting all teacher logs:', error);
      throw new Error(error.message || 'Failed to load teacher security logs');
    }
  },

  /**
   * Delete teacher using backend API
   */
  async deleteTeacher(
    uid: string,
    userEmail: string | undefined,
    deletedByUser?: any
  ): Promise<void> {
    try {
      console.log('🗑️ Deleting teacher:', uid);

      const teacherRef = doc(db, 'users', uid);
      const teacherDoc = await getDoc(teacherRef);
      
      if (!teacherDoc.exists()) {
        throw new Error('Teacher not found');
      }

      const teacherData = teacherDoc.data();

      if (teacherData.role !== 'teacher') {
        throw new Error('User is not a teacher');
      }

      console.log('📋 Teacher data:', {
        uid,
        userId: teacherData.userId,
        surname: teacherData.surname,
        phoneNumber: teacherData.phoneNumber,
        email: teacherData.email,
        hasProfilePicture: !!teacherData.profilePictureUrl
      });
      
      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 
                         import.meta.env.VITE_API_URL ||
                         'https://edtech-dashboard-alpha.vercel.app';
      const MASTER_API_KEY = import.meta.env.VITE_SMS_MASTER_KEY;

      console.log('🌐 Backend URL:', BACKEND_URL);

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
            profilePictureUrl: teacherData?.profilePictureUrl || null,
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
        throw new Error(deleteResult.error || 'Failed to delete teacher');
      }

      console.log('✅ Teacher deleted successfully (unified deletion completed)');
      console.log('  - Firestore:', deleteResult.details.firestoreDeleted ? 'DELETED' : 'FAILED');
      console.log('  - Profile Picture:', deleteResult.details.profilePicDeleted ? 'DELETED' : 'SKIPPED/FAILED');
      console.log('  - Firebase Auth:', deleteResult.details.authDeleted ? 'DELETED' : 'SKIPPED/FAILED');
      
      // Send SMS notification to deleted teacher
      if (teacherData?.phoneNumber && deletedByUser) {
        try {
          console.log('📱 Sending deletion SMS notification...');
          await sendTeacherDeleteSMS(
            teacherData.phoneNumber,
            teacherData.userId || 'N/A',
            deletedByUser.userId || 'N/A'
          );
          console.log('✅ Teacher deletion SMS sent successfully');
        } catch (smsError) {
          console.warn('⚠️ Failed to send deletion SMS:', smsError);
        }
      }
      
      // Log teacher deletion
      if (deletedByUser && teacherData) {
        try {
          console.log('📝 Creating comprehensive teacher deletion security log...');
          
          const logData = {
            action: 'teacher_deleted',
            targetTeacherUid: uid,
            targetTeacherUserId: teacherData.userId || 'N/A',
            targetTeacherSurname: teacherData.surname || teacherData.name || 'N/A',
            performedByUid: deletedByUser.uid,
            performedByUserId: deletedByUser.userId || 'N/A',
            performedBySurname: deletedByUser.surname || 'N/A',
            timestamp: Timestamp.now(),
            details: `Teacher ${teacherData.surname || teacherData.name} (${teacherData.userId}) was permanently deleted by ${deletedByUser.surname} (${deletedByUser.userId}). All associated data including profile picture and authentication have been removed.`,
            changes: JSON.stringify({
              action: 'delete',
              deletedTeacher: {
                uid: uid,
                userId: teacherData.userId,
                surname: teacherData.surname || teacherData.name,
                fullName: teacherData.fullName || 'Not provided',
                email: teacherData.email || 'Not provided',
                phoneNumber: teacherData.phoneNumber,
                status: teacherData.status,
                createdAt: teacherData.createdAt?.toDate?.()?.toISOString() || 'Unknown',
                createdBy: teacherData.createdBy || 'Unknown'
              },
              deletedBy: {
                uid: deletedByUser.uid,
                userId: deletedByUser.userId,
                surname: deletedByUser.surname,
              },
              timestamp: new Date().toISOString()
            }),
            fieldChanges: [
              { field: 'status', oldValue: teacherData.status || 'active', newValue: 'DELETED' },
              { field: 'account', oldValue: 'EXISTS', newValue: 'PERMANENTLY REMOVED' }
            ]
          };
          
          console.log('💾 Saving teacher deletion log to security_logs collection...');
          const logRef = await addDoc(collection(db, 'security_logs'), logData);
          console.log('✅ Teacher deletion security log created with ID:', logRef.id);
        } catch (logError: any) {
          console.error('❌ Failed to log teacher deletion:', logError);
        }
      }
      
    } catch (error: any) {
      console.error('❌ Delete error:', error);
      throw new Error(error.message || 'Failed to delete teacher');
    }
  },

  /**
   * Search teachers
   */
  async searchTeachers(searchTerm: string): Promise<Teacher[]> {
    try {
      const usersCollection = collection(db, 'users');
      const teacherQuery = query(
        usersCollection, 
        where('role', '==', 'teacher')
      );
      const teachersSnapshot = await getDocs(teacherQuery);
      
      const teachers = teachersSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          uid: doc.id,
          surname: data.surname || data.name || data.fullName || 'Teacher',
          fullName: data.fullName || data.name || data.surname || '',
          createdAt: data.createdAt?.toDate() || new Date(),
          lastLogin: data.lastLogin?.toDate(),
        };
      }) as Teacher[];
      
      return teachers.filter(teacher => 
        teacher.surname?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        teacher.userId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        teacher.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        teacher.phoneNumber?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    } catch (error: any) {
      console.error('Error searching teachers:', error);
      throw new Error(error.message || 'Failed to search teachers');
    }
  },

  /**
   * Get teacher statistics
   */
  async getTeacherStats(): Promise<{
    total: number;
    active: number;
    inactive: number;
    pending: number;
  }> {
    try {
      const teachers = await this.getAllTeachers();
      
      return {
        total: teachers.length,
        active: teachers.filter(t => t.status === 'active').length,
        inactive: teachers.filter(t => t.status === 'inactive').length,
        pending: teachers.filter(t => t.status === 'pending').length,
      };
    } catch (error: any) {
      console.error('Error getting teacher stats:', error);
      throw new Error(error.message || 'Failed to get teacher statistics');
    }
  }
};

// END OF FILE - THIS IS THE COMPLETE teacherService.ts
