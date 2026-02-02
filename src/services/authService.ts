// src/services/authService.ts
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  User,
  setPersistence,
  browserSessionPersistence,
  browserLocalPersistence
} from 'firebase/auth';
import { doc, setDoc, getDoc, Timestamp, updateDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

export interface UserProfile {
  uid: string;
  userId?: string;
  email?: string;
  name: string;
  surname?: string;
  fullName?: string;
  dob?: string;
  phoneNumber?: string;
  guardianPhone?: string;
  bloodGroup?: string;
  gender?: string;
  religion?: string;
  address?: string;
  classGrade?: 'class6' | 'class7' | 'class8' | 'class9' | 'class10' | 'ssc' | 'class11' | 'class12' | 'hsc' | 'diploma' | 'undergraduate' | 'graduated';
  role: 'admin' | 'manager' | 'course_manager' | 'student_manager' | 'coordinator' | 'teacher' | 'parent' | 'student';
  status: 'active' | 'inactive' | 'pending';
  createdAt: Date;
  lastLogin?: Date;
  approvedBy?: string;
  approvedAt?: Date;
  class?: string;
  school?: string;
  college?: string;
  mobileNumber?: string;
  registrationNumber?: string;
  profilePictureUrl?: string;
  deviceId?: string;
  lastLoginIp?: string;
}

// Custom error class for account status issues
export class AccountStatusError extends Error {
  status: 'inactive' | 'pending';
  userId?: string;
  
  constructor(status: 'inactive' | 'pending', userId?: string) {
    super(`Account status is ${status}`);
    this.name = 'AccountStatusError';
    this.status = status;
    this.userId = userId;
  }
}

// Helper function to normalize User ID format
// Converts any case prefix to uppercase: st-2601-00001 → ST-2601-00001
export const normalizeUserId = (userId: string): string => {
  if (!userId) return userId;
  
  // Trim whitespace
  userId = userId.trim();
  
  // Check if it matches the pattern: XX-YYMM-XXXXX (where XX can be any case)
  const userIdPattern = /^([a-zA-Z]{2})-(\d{4})-(\d{5})$/;
  const match = userId.match(userIdPattern);
  
  if (match) {
    // Convert prefix to uppercase and reconstruct
    const prefix = match[1].toUpperCase();
    const yearMonth = match[2];
    const sequence = match[3];
    return `${prefix}-${yearMonth}-${sequence}`;
  }
  
  // If no match, just return trimmed (might be invalid format)
  return userId;
};

// Password strength validation
export const validatePasswordStrength = (password: string): {
  isStrong: boolean;
  strength: 'weak' | 'medium' | 'strong' | 'very-strong';
  issues: string[];
} => {
  const issues: string[] = [];
  let score = 0;

  if (password.length < 8) {
    issues.push('At least 8 characters');
  } else if (password.length >= 8) {
    score += 1;
  }
  if (password.length >= 12) {
    score += 1;
  }

  if (!/[A-Z]/.test(password)) {
    issues.push('One uppercase letter');
  } else {
    score += 1;
  }

  if (!/[a-z]/.test(password)) {
    issues.push('One lowercase letter');
  } else {
    score += 1;
  }

  if (!/[0-9]/.test(password)) {
    issues.push('One number');
  } else {
    score += 1;
  }

  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    issues.push('One special character');
  } else {
    score += 1;
  }

  let strength: 'weak' | 'medium' | 'strong' | 'very-strong' = 'weak';
  if (score >= 6) strength = 'very-strong';
  else if (score >= 5) strength = 'strong';
  else if (score >= 3) strength = 'medium';

  return {
    isStrong: issues.length === 0 && score >= 5,
    strength,
    issues
  };
};

// Helper function to find user by User ID via BACKEND API
const findUserByUserId = async (userId: string): Promise<any> => {
  try {
    // Normalize the User ID to uppercase prefix
    const normalizedUserId = normalizeUserId(userId);
    
    const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 
                       import.meta.env.VITE_API_URL ||
                       'https://edtech-dashboard-alpha.vercel.app';
    const MASTER_API_KEY = import.meta.env.VITE_SMS_MASTER_KEY;

    const requestBody: any = {
      loginId: normalizedUserId, // Normalized User ID only
      purpose: 'user-lookup'
    };

    if (MASTER_API_KEY) {
      requestBody.apiKey = MASTER_API_KEY;
    }

    const response = await fetch(`${BACKEND_URL}/api/user-search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      console.error('Backend user lookup failed:', response.statusText);
      return null;
    }

    const data = await response.json();
    
    if (data.success && data.userData) {
      return data.userData;
    }

    return null;
  } catch (error) {
    console.error('Error finding user by User ID:', error);
    return null;
  }
};

// Generate a unique device ID based on browser fingerprint
const generateDeviceId = (): string => {
  const navigator = window.navigator;
  const screen = window.screen;
  
  const fingerprint = [
    navigator.userAgent,
    navigator.language,
    screen.colorDepth,
    screen.width + 'x' + screen.height,
    new Date().getTimezoneOffset(),
    !!window.sessionStorage,
    !!window.localStorage
  ].join('|');
  
  let hash = 0;
  for (let i = 0; i < fingerprint.length; i++) {
    const char = fingerprint.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  return 'device_' + Math.abs(hash).toString(36);
};

// Helper function to get client IP
async function getClientIp(): Promise<string> {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return data.ip || 'unknown';
  } catch {
    return 'unknown';
  }
}

export const authService = {
  /**
   * Register a new user account
   * Supports student registration with automatic approval
   */
  async register(
    email: string | undefined,
    password: string,
    fullName: string,
    surname: string,
    dob: string,
    phoneNumber: string,
    guardianPhone: string | undefined,
    bloodGroup: string | undefined,
    gender: string,
    religion: string | undefined,
    classGrade: string,
    role: string,
    userId: string,
    mobileNumber: string,
    address: string | undefined
  ): Promise<UserProfile> {
    try {
      // Normalize User ID to uppercase prefix
      const normalizedUserId = normalizeUserId(userId);
      
      // Validate password strength
      const passwordValidation = validatePasswordStrength(password);
      if (!passwordValidation.isStrong) {
        throw new Error('Password must include uppercase, lowercase, number, and special character (min 8 chars)');
      }

      // Determine email for Firebase Auth
      let emailForAuth = email;
      if (!emailForAuth || !emailForAuth.includes('@')) {
        if (role === 'admin') {
          emailForAuth = `${normalizedUserId || phoneNumber}@admin.local`;
        } else {
          emailForAuth = `${normalizedUserId || phoneNumber}@student.local`;
        }
      }

      // Create Firebase Auth user
      const userCredential = await createUserWithEmailAndPassword(auth, emailForAuth, password);
      const user = userCredential.user;

      // Determine status based on role
      // Students are automatically approved (active)
      // Other roles require admin approval (pending)
      const status = role === 'student' ? 'active' : 'pending';

      // Create user profile in Firestore
      const userProfile: any = {
        uid: user.uid,
        userId: normalizedUserId,
        email: email || null,
        name: fullName,
        surname: surname,
        fullName: fullName,
        dob: dob,
        phoneNumber: phoneNumber,
        guardianPhone: guardianPhone || null,
        bloodGroup: bloodGroup || null,
        gender: gender,
        religion: religion || null,
        address: address || null,
        classGrade: classGrade,
        role: role,
        status: status,
        mobileNumber: mobileNumber,
        createdAt: Timestamp.now(),
        lastLogin: Timestamp.now(),
        deviceId: generateDeviceId(),
        lastLoginIp: await getClientIp()
      };

      // If student, add auto-approval fields
      if (role === 'student') {
        userProfile.approvedBy = 'system';
        userProfile.approvedAt = Timestamp.now();
      }

      await setDoc(doc(db, 'users', user.uid), userProfile);

      return {
        uid: user.uid,
        userId: normalizedUserId,
        email: email,
        name: fullName,
        surname: surname,
        fullName: fullName,
        dob: dob,
        phoneNumber: phoneNumber,
        guardianPhone: guardianPhone,
        bloodGroup: bloodGroup,
        gender: gender,
        religion: religion,
        address: address,
        classGrade: classGrade as any,
        role: role as any,
        status: status as any,
        createdAt: new Date(),
        mobileNumber: mobileNumber
      };
    } catch (error: any) {
      let errorMessage = error.message;
      
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'This email is already registered';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Password must be at least 8 characters';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email format';
      }
      
      throw new Error(errorMessage);
    }
  },

  /**
   * Sign in existing user
   * Supports userId-based login with device ID tracking
   * Enhanced with account status checking
   */
  async signIn(identifier: string, password: string, rememberMe: boolean = false): Promise<UserProfile> {
    try {
      // Normalize identifier (User ID) to uppercase prefix
      const normalizedIdentifier = normalizeUserId(identifier);
      
      // Set persistence based on rememberMe
      await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);

      let emailForAuth = normalizedIdentifier;

      // Check if identifier is a User ID (e.g., ST-2601-00001)
      if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(normalizedIdentifier)) {
        // Use backend API to find user by User ID
        const userData = await findUserByUserId(normalizedIdentifier);
        
        if (!userData) {
          throw new Error('Invalid User ID or password');
        }

        // Construct email for Firebase Auth
        if (userData.email && userData.email.includes('@')) {
          emailForAuth = userData.email;
        } else {
          if (userData.role === 'admin') {
            emailForAuth = `${normalizedIdentifier}@admin.local`;
          } else {
            emailForAuth = `${normalizedIdentifier}@student.local`;
          }
        }
      }

      // Authenticate with Firebase
      const userCredential = await signInWithEmailAndPassword(auth, emailForAuth, password);
      const user = userCredential.user;

      // Fetch user profile
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      
      if (!userDoc.exists()) {
        throw new Error('User profile not found');
      }

      const userData = userDoc.data();

      // CRITICAL: Check account status BEFORE allowing login
      // If account is not active, sign out immediately and throw custom error
      if (userData.status === 'pending') {
        await firebaseSignOut(auth);
        throw new AccountStatusError('pending', userData.userId);
      }

      if (userData.status === 'inactive') {
        await firebaseSignOut(auth);
        throw new AccountStatusError('inactive', userData.userId);
      }

      // Only proceed if account is active
      if (userData.status !== 'active') {
        await firebaseSignOut(auth);
        throw new Error('Your account status is unknown. Please contact administration.');
      }

      // Generate and store device ID
      const deviceId = generateDeviceId();
      const clientIp = await getClientIp();
      
      await updateDoc(doc(db, 'users', user.uid), {
        lastLogin: Timestamp.now(),
        deviceId: deviceId,
        lastLoginIp: clientIp
      });

      return {
        uid: user.uid,
        userId: userData.userId,
        email: userData.email,
        name: userData.name,
        surname: userData.surname,
        fullName: userData.fullName,
        dob: userData.dob,
        phoneNumber: userData.phoneNumber,
        guardianPhone: userData.guardianPhone,
        bloodGroup: userData.bloodGroup,
        gender: userData.gender,
        religion: userData.religion,
        address: userData.address,
        classGrade: userData.classGrade,
        role: userData.role,
        status: userData.status,
        createdAt: userData.createdAt.toDate(),
        lastLogin: new Date(),
        approvedBy: userData.approvedBy,
        approvedAt: userData.approvedAt?.toDate(),
        mobileNumber: userData.mobileNumber,
        deviceId: deviceId,
        lastLoginIp: clientIp
      };
    } catch (error: any) {
      // Re-throw AccountStatusError as-is
      if (error instanceof AccountStatusError) {
        throw error;
      }

      let errorMessage = error.message;
      
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
        errorMessage = 'Invalid User ID or password';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many failed login attempts. Please try again later.';
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage = 'Network error. Please check your connection.';
      }
      
      throw new Error(errorMessage);
    }
  },

  /**
   * Get user profile by UID
   */
  async getUserProfile(uid: string): Promise<UserProfile | null> {
    try {
      const userDoc = await getDoc(doc(db, 'users', uid));
      
      if (!userDoc.exists()) {
        return null;
      }

      const userData = userDoc.data();
      
      return {
        uid: userDoc.id,
        userId: userData.userId,
        email: userData.email,
        name: userData.name,
        surname: userData.surname,
        fullName: userData.fullName,
        dob: userData.dob,
        phoneNumber: userData.phoneNumber,
        guardianPhone: userData.guardianPhone,
        bloodGroup: userData.bloodGroup,
        gender: userData.gender,
        religion: userData.religion,
        address: userData.address,
        classGrade: userData.classGrade,
        role: userData.role,
        status: userData.status,
        createdAt: userData.createdAt.toDate(),
        lastLogin: userData.lastLogin?.toDate(),
        approvedBy: userData.approvedBy,
        approvedAt: userData.approvedAt?.toDate(),
        mobileNumber: userData.mobileNumber
      };
    } catch (error: any) {
      throw new Error(error.message);
    }
  },

  /**
   * Send password reset OTP
   * Find user by User ID, then send OTP to their registered phone number
   * Returns phone number for OTP verification
   */
  async sendPasswordResetOTP(userId: string): Promise<{ 
    success: boolean; 
    phoneNumber?: string; 
    message: string 
  }> {
    try {
      // Normalize User ID to uppercase prefix
      const normalizedUserId = normalizeUserId(userId);
      
      // Find user via backend
      const userData = await findUserByUserId(normalizedUserId);
      
      if (!userData || !userData.phoneNumber) {
        return {
          success: false,
          message: 'User ID not found or no phone number registered'
        };
      }

      // Generate 6-digit OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Store OTP in session storage with expiry (5 minutes)
      const otpData = {
        otp: otp,
        userId: normalizedUserId,
        uid: userData.uid,
        phoneNumber: userData.phoneNumber,
        expiry: Date.now() + 5 * 60 * 1000, // 5 minutes from now
        attempts: 0
      };
      sessionStorage.setItem('passwordResetOTP', JSON.stringify(otpData));

      // Send OTP via SMS API
      try {
        const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 
                           import.meta.env.VITE_API_URL ||
                           'https://edtech-dashboard-alpha.vercel.app';
        const MASTER_API_KEY = import.meta.env.VITE_SMS_MASTER_KEY;

        const smsBody: any = {
          phoneNumber: userData.phoneNumber,
          message: `Your password reset OTP is: ${otp}. Valid for 5 minutes. Do not share this code.`,
          purpose: 'password-reset'
        };

        if (MASTER_API_KEY) {
          smsBody.apiKey = MASTER_API_KEY;
        }

        await fetch(`${BACKEND_URL}/api/sms`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(smsBody)
        });

        return {
          success: true,
          phoneNumber: userData.phoneNumber,
          message: 'OTP sent successfully'
        };
      } catch (smsError) {
        console.error('SMS sending failed:', smsError);
        // Even if SMS fails, allow OTP verification (for testing)
        return {
          success: true,
          phoneNumber: userData.phoneNumber,
          message: 'OTP generated (SMS service unavailable)'
        };
      }
    } catch (error: any) {
      throw new Error(error.message || 'Failed to send password reset OTP');
    }
  },

  /**
   * Verify password reset OTP
   * Check if provided OTP matches stored OTP
   */
  async verifyPasswordResetOTP(otp: string): Promise<{ 
    success: boolean; 
    uid?: string; 
    message: string 
  }> {
    try {
      const storedData = sessionStorage.getItem('passwordResetOTP');
      
      if (!storedData) {
        return {
          success: false,
          message: 'No OTP request found. Please request a new OTP.'
        };
      }

      const otpData = JSON.parse(storedData);

      // Check expiry
      if (Date.now() > otpData.expiry) {
        sessionStorage.removeItem('passwordResetOTP');
        return {
          success: false,
          message: 'OTP has expired. Please request a new one.'
        };
      }

      // Check attempts
      if (otpData.attempts >= 3) {
        sessionStorage.removeItem('passwordResetOTP');
        return {
          success: false,
          message: 'Too many failed attempts. Please request a new OTP.'
        };
      }

      // Verify OTP
      if (otp !== otpData.otp) {
        otpData.attempts += 1;
        sessionStorage.setItem('passwordResetOTP', JSON.stringify(otpData));
        return {
          success: false,
          message: `Invalid OTP. ${3 - otpData.attempts} attempts remaining.`
        };
      }

      // OTP verified successfully
      return {
        success: true,
        uid: otpData.uid,
        message: 'OTP verified successfully'
      };
    } catch (error: any) {
      throw new Error(error.message || 'Failed to verify OTP');
    }
  },

  /**
   * Reset password after OTP verification
   * Updates password in Firebase Auth
   */
  async resetPasswordWithOTP(newPassword: string): Promise<{ 
    success: boolean; 
    message: string 
  }> {
    try {
      const storedData = sessionStorage.getItem('passwordResetOTP');
      
      if (!storedData) {
        return {
          success: false,
          message: 'Session expired. Please start password reset again.'
        };
      }

      const otpData = JSON.parse(storedData);

      // Validate password strength
      const passwordValidation = validatePasswordStrength(newPassword);
      if (!passwordValidation.isStrong) {
        throw new Error('Password must include uppercase, lowercase, number, and special character (min 8 chars)');
      }

      // Get user email for re-authentication
      const userDoc = await getDoc(doc(db, 'users', otpData.uid));
      if (!userDoc.exists()) {
        throw new Error('User not found');
      }

      const userData = userDoc.data();
      
      // Construct email for Firebase Auth
      let emailForAuth = userData.email;
      if (!emailForAuth || !emailForAuth.includes('@')) {
        if (userData.role === 'admin') {
          emailForAuth = `${otpData.userId}@admin.local`;
        } else {
          emailForAuth = `${otpData.userId}@student.local`;
        }
      }

      // For password reset via OTP, we need to use Admin SDK
      // Since we can't directly reset password without current password
      // We'll use the backend API to handle this
      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 
                         import.meta.env.VITE_API_URL ||
                         'https://edtech-dashboard-alpha.vercel.app';
      const MASTER_API_KEY = import.meta.env.VITE_SMS_MASTER_KEY;

      const resetBody: any = {
        uid: otpData.uid,
        newPassword: newPassword,
        purpose: 'password-reset-finalize'
      };

      if (MASTER_API_KEY) {
        resetBody.apiKey = MASTER_API_KEY;
      }

      const response = await fetch(`${BACKEND_URL}/api/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(resetBody)
      });

      if (!response.ok) {
        throw new Error('Failed to reset password. Please try again.');
      }

      // Clear OTP data after successful reset
      sessionStorage.removeItem('passwordResetOTP');

      return {
        success: true,
        message: 'Password reset successfully'
      };
    } catch (error: any) {
      throw new Error(error.message || 'Failed to reset password');
    }
  },

  /**
   * Recover User ID by phone number
   * Returns list of User IDs associated with the phone number
   */
  async recoverUserId(phoneNumber: string): Promise<{ 
    success: boolean; 
    users?: Array<{ userId: string; surname: string; role: string }>; 
    message: string 
  }> {
    try {
      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 
                         import.meta.env.VITE_API_URL ||
                         'https://edtech-dashboard-alpha.vercel.app';
      const MASTER_API_KEY = import.meta.env.VITE_SMS_MASTER_KEY;

      const requestBody: any = {
        phoneNumber: phoneNumber,
        purpose: 'user-id-recovery'
      };

      if (MASTER_API_KEY) {
        requestBody.apiKey = MASTER_API_KEY;
      }

      const response = await fetch(`${BACKEND_URL}/api/user-search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error('Failed to search for User ID');
      }

      const data = await response.json();

      if (data.success && data.users && data.users.length > 0) {
        return {
          success: true,
          users: data.users.map((user: any) => ({
            userId: user.userId,
            surname: user.surname,
            role: user.role
          })),
          message: 'User IDs found'
        };
      }

      return {
        success: false,
        message: 'No accounts found with this phone number'
      };
    } catch (error: any) {
      throw new Error(error.message || 'Failed to recover User ID');
    }
  },

  /**
   * Change password for authenticated user
   */
  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('No user is currently signed in');
      }

      // Validate new password strength
      const passwordValidation = validatePasswordStrength(newPassword);
      if (!passwordValidation.isStrong) {
        throw new Error('Password must include uppercase, lowercase, number, and special character (min 8 chars)');
      }

      // Get user email
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists()) {
        throw new Error('User profile not found');
      }

      const userData = userDoc.data();
      let emailForAuth = userData.email;
      
      if (!emailForAuth || !emailForAuth.includes('@')) {
        if (userData.role === 'admin') {
          emailForAuth = `${userData.userId}@admin.local`;
        } else {
          emailForAuth = `${userData.userId}@student.local`;
        }
      }

      // Re-authenticate user
      const credential = EmailAuthProvider.credential(emailForAuth, currentPassword);
      await reauthenticateWithCredential(user, credential);

      // Update password
      await updatePassword(user, newPassword);
    } catch (error: any) {
      let errorMessage = error.message;
      
      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        errorMessage = 'Current password is incorrect';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'New password is too weak';
      } else if (error.code === 'auth/requires-recent-login') {
        errorMessage = 'Please sign out and sign in again before changing password';
      }
      
      throw new Error(errorMessage);
    }
  },

  /**
   * Sign out current user
   */
  async signOut(): Promise<void> {
    try {
      await firebaseSignOut(auth);
    } catch (error: any) {
      throw new Error(error.message);
    }
  },

  /**
   * Listen to auth state changes
   */
  onAuthStateChanged(callback: (user: User | null) => void) {
    return onAuthStateChanged(auth, callback);
  }
};
