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

  constructor(status: 'inactive' | 'pending', userId?: string, message?: string) {
    super(message || `Account status is ${status}`);
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
  const userIdPattern = /^([a-zA-Z]{2})-?(\d{4})-?(\d{5})$/;
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
// This function uses the backend API ONLY and does NOT access Firestore directly
// This avoids permission errors during the sign-in flow
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
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: errorText || `Server error: ${response.status}` };
      }
      
      if (response.status === 404) {
        return null;
      }
      
      throw new Error(errorData.error || 'Failed to search for user');
    }

    const result = await response.json();
    
    if (!result.success) {
      return null;
    }
    
    return result.userData;
    
  } catch (error: any) {
    throw new Error('Failed to search for user. Please try again.');
  }
};

// Generate device fingerprint
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

// NEW: Multi-device session management (PASSIVE - never blocks login)
// This function checks for existing sessions and logs them out AFTER new login succeeds
const handleMultiDeviceSession = async (userId: string, currentDeviceId: string, currentIp: string): Promise<void> => {
  try {
    // This is PASSIVE - runs after login succeeds, never blocks
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) return; // Fail open
    
    const userData = userDoc.data();
    const existingDeviceId = userData.deviceId;
    const existingIp = userData.lastLoginIp;
    
    // Check if there's a different device/IP
    if (existingDeviceId && existingDeviceId !== currentDeviceId) {
      // Log the multi-device event (non-blocking)
      await updateDoc(userRef, {
        previousDeviceId: existingDeviceId,
        previousLoginIp: existingIp,
        multiDeviceDetected: true,
        multiDeviceDetectedAt: Timestamp.now()
      }).catch(() => {
        // Fail silently - this is informational only
      });
    }
  } catch {
    // Fail open - never block login due to session management
    return;
  }
};

// NEW: Helper function to execute reCAPTCHA verification (PASSIVE)
// Returns token if successful, null if fails - never blocks the calling function
const executeRecaptcha = async (action: string): Promise<string | null> => {
  try {
    if (!window.grecaptcha) return null;
    
    const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
    if (!siteKey) return null;
    
    return await new Promise((resolve) => {
      window.grecaptcha.ready(() => {
        window.grecaptcha
          .execute(siteKey, { action })
          .then((token: string) => resolve(token))
          .catch(() => resolve(null));
      });
    });
  } catch {
    return null; // Fail open
  }
};

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
        userId: normalizedUserId,
        name: fullName,
        surname,
        fullName,
        dob,
        phoneNumber,
        gender,
        classGrade,
        role,
        status,
        createdAt: Timestamp.now(),
        mobileNumber,
        deviceId: generateDeviceId()
      };

      // Add optional fields
      if (email && email.trim()) {
        userProfile.email = email.trim();
      }
      
      if (guardianPhone && guardianPhone.trim()) {
        userProfile.guardianPhone = guardianPhone.trim();
      }
      
      if (religion && religion.trim()) {
        userProfile.religion = religion.trim();
      }
      
      if (bloodGroup && bloodGroup.trim()) {
        userProfile.bloodGroup = bloodGroup.trim();
      }
      
      if (address && address.trim()) {
        userProfile.address = address.trim();
      }

      // Save to Firestore
      await setDoc(doc(db, 'users', user.uid), userProfile);

      // If status is pending (non-student roles), sign out immediately
      if (status === 'pending') {
        await firebaseSignOut(auth);
      }

      return {
        uid: user.uid,
        ...userProfile,
        createdAt: new Date()
      };
    } catch (error: any) {
      let errorMessage = error.message;

      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'This email is already registered. Please use a different email or sign in.';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Password is too weak. Please choose a stronger password';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address';
      }

      throw new Error(errorMessage);
    }
  },

  /**
   * Sign in user
   * Supports sign-in with User ID only (normalized to uppercase)
   * ENHANCED with: formatted input, masked errors, remember me, passive multi-device, reCAPTCHA
   */
  async signIn(userId: string, password: string, rememberMe: boolean = false): Promise<UserProfile> {
    try {
      // NEW: Execute reCAPTCHA (PASSIVE - never blocks)
      const recaptchaToken = await executeRecaptcha('login').catch(() => null);
      // Token collected but login continues regardless of result
      
      // EXISTING: Normalize User ID to uppercase prefix format
      const normalizedUserId = normalizeUserId(userId);

      // EXISTING: Set persistence based on rememberMe
      if (rememberMe) {
        await setPersistence(auth, browserLocalPersistence);
      } else {
        await setPersistence(auth, browserSessionPersistence);
      }

      // EXISTING: Use backend API to find user by User ID
      const userData = await findUserByUserId(normalizedUserId);

      if (!userData) {
        // ENHANCED: Generic error message (masks "user not found")
        throw new Error('Invalid credentials');
      }

      // EXISTING: Check account status BEFORE attempting sign-in
      if (userData.status === 'pending') {
        throw new AccountStatusError('pending', userData.userId, 'Your account is pending approval. Please wait for admin approval.');
      }

      if (userData.status === 'inactive') {
        throw new AccountStatusError('inactive', userData.userId, 'Your account has been deactivated. Please contact support.');
      }

      // EXISTING: Determine email for auth based on role
      let emailForAuth = userData.email;
      if (!emailForAuth || !emailForAuth.includes('@')) {
        if (userData.role === 'admin') {
          emailForAuth = `${userData.userId || userData.phoneNumber}@admin.local`;
        } else {
          emailForAuth = `${userData.userId || userData.phoneNumber}@student.local`;
        }
      }

      // EXISTING: Sign in with Firebase Auth
      const userCredential = await signInWithEmailAndPassword(auth, emailForAuth, password);
      const user = userCredential.user;

      // EXISTING: Generate and update device info
      const currentDeviceId = generateDeviceId();
      const clientIp = await getClientIp();

      // NEW: Handle multi-device session (PASSIVE - runs after login succeeds)
      handleMultiDeviceSession(user.uid, currentDeviceId, clientIp).catch(() => {
        // Fail silently - never block login
      });

      // EXISTING: Update last login info
      await updateDoc(doc(db, 'users', user.uid), {
        lastLogin: Timestamp.now(),
        deviceId: currentDeviceId,
        lastLoginIp: clientIp
      });

      // NEW: Store remember me preference if enabled (ADDITIONAL, not replacing)
      if (rememberMe) {
        try {
          localStorage.setItem('auth_remember_me', 'true');
          localStorage.setItem('auth_user_id', normalizedUserId);
        } catch {
          // Fail silently if localStorage not available
        }
      }

      return {
        uid: user.uid,
        ...userData,
        createdAt: userData.createdAt?.toDate?.() || new Date(),
        lastLogin: new Date()
      };
    } catch (error: any) {
      // EXISTING: If it's an AccountStatusError, throw it as-is
      if (error instanceof AccountStatusError) {
        throw error;
      }

      // ENHANCED: Map all auth errors to generic "Invalid credentials" message
      let errorMessage = 'Invalid credentials';

      // Preserve network errors (user needs to know about connectivity issues)
      if (error.code === 'auth/network-request-failed') {
        errorMessage = 'Network error. Please check your connection and try again.';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many failed login attempts. Please try again later.';
      } else if (error.message === 'Invalid credentials') {
        // Use the enhanced error message from userData check
        errorMessage = 'Invalid credentials';
      }

      throw new Error(errorMessage);
    }
  },

  /**
   * Send password reset OTP
   * Finds user by Student ID, phone number, or email and returns phone for OTP
   * Used by ForgotPasswordModal
   */
  async sendPasswordResetOTP(loginId: string): Promise<{ success: boolean; phoneNumber?: string; message: string }> {
    try {
      // Normalize the loginId (especially for Student IDs)
      const normalizedLoginId = normalizeUserId(loginId);
      
      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 
                         import.meta.env.VITE_API_URL ||
                         'https://edtech-dashboard-alpha.vercel.app';
      const MASTER_API_KEY = import.meta.env.VITE_SMS_MASTER_KEY;

      const requestBody: any = {
        loginId: normalizedLoginId,
        purpose: 'password-reset'
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
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText || `Server error: ${response.status}` };
        }
        
        throw new Error(errorData.error || 'Failed to search for account');
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Account not found');
      }
      
      return {
        success: true,
        phoneNumber: result.phoneNumber,
        message: result.message || 'Account found. Please verify your phone number.'
      };
    } catch (error: any) {
      let errorMessage = error.message;
      if (errorMessage.includes('fetch')) {
        errorMessage = 'Network error. Please check your connection and try again.';
      }
      
      throw new Error(errorMessage);
    }
  },

  /**
   * Check if phone number exists in system
   * Returns count of accounts and phone number for OTP verification
   * Used by ForgotUserIdModal for initial phone verification
   */
  async checkPhoneExists(phoneNumber: string): Promise<{ 
    exists: boolean; 
    count: number; 
    phoneNumber?: string; 
    message: string 
  }> {
    try {
      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 
                         import.meta.env.VITE_API_URL ||
                         'https://edtech-dashboard-alpha.vercel.app';
      const MASTER_API_KEY = import.meta.env.VITE_SMS_MASTER_KEY;

      const requestBody: any = {
        phoneNumber,
        purpose: 'phone-check'
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
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText || `Server error: ${response.status}` };
        }
        
        if (response.status === 404) {
          return {
            exists: false,
            count: 0,
            message: 'No accounts found with this phone number'
          };
        }
        
        throw new Error(errorData.error || 'Failed to check phone number');
      }

      const result = await response.json();
      
      if (!result.success) {
        return {
          exists: false,
          count: 0,
          message: result.error || 'No existing accounts found'
        };
      }
      
      return {
        exists: result.count > 0,
        count: result.count || 0,
        phoneNumber: result.phoneNumber,
        message: result.message || 'Account found. Please verify your phone number.'
      };
    } catch (error: any) {
      let errorMessage = error.message;
      if (errorMessage.includes('fetch')) {
        errorMessage = 'Network error. Please check your connection and try again.';
      }
      
      throw new Error(errorMessage);
    }
  },

  /**
   * Get users by phone number
   * Returns ALL account types associated with the phone number
   * Used for User ID recovery (ForgotUserIdModal)
   */
  async getUsersByPhone(phoneNumber: string): Promise<{ 
    success: boolean; 
    users?: Array<{ 
      uid: string; 
      userId: string; 
      surname: string; 
      role: string; 
      status: string; 
      fullName?: string; 
      name?: string; 
    }>; 
    count?: number; 
    message: string 
  }> {
    try {
      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 
                         import.meta.env.VITE_API_URL ||
                         'https://edtech-dashboard-alpha.vercel.app';
      const MASTER_API_KEY = import.meta.env.VITE_SMS_MASTER_KEY;

      const requestBody: any = {
        phoneNumber,
        purpose: 'user-id-recovery' // This purpose returns ALL account types
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
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText || `Server error: ${response.status}` };
        }
        
        if (response.status === 404) {
          return {
            success: false,
            message: 'No users found with this phone number'
          };
        }
        
        throw new Error(errorData.error || 'Failed to fetch users');
      }

      const result = await response.json();
      
      if (!result.success) {
        return {
          success: false,
          message: result.error || 'Failed to fetch users'
        };
      }
      
      return {
        success: true,
        users: result.users,
        count: result.count,
        message: result.message || 'Users retrieved successfully'
      };
    } catch (error: any) {
      let errorMessage = error.message;
      if (errorMessage.includes('fetch')) {
        errorMessage = 'Network error. Please check your connection and try again.';
      }
      
      return {
        success: false,
        message: errorMessage
      };
    }
  },

  /**
   * Reset password by phone number
   * Works for ALL account types (admin, manager, teacher, student, parent, etc.)
   */
  async resetPassword(phoneNumber: string, newPassword: string): Promise<void> {
    try {
      const passwordValidation = validatePasswordStrength(newPassword);
      if (!passwordValidation.isStrong) {
        throw new Error('Password must include uppercase, lowercase, number, and special character (min 8 chars)');
      }

      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 
                         import.meta.env.VITE_API_URL ||
                         'https://edtech-dashboard-alpha.vercel.app';
      const MASTER_API_KEY = import.meta.env.VITE_SMS_MASTER_KEY;

      const requestBody: any = {
        phoneNumber,
        newPassword
      };

      if (MASTER_API_KEY) {
        requestBody.apiKey = MASTER_API_KEY;
      }

      const response = await fetch(`${BACKEND_URL}/api/password-reset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText || `Server error: ${response.status}` };
        }
        
        throw new Error(errorData.error || 'Failed to reset password');
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to reset password');
      }
    } catch (error: any) {
      let errorMessage = error.message;
      if (errorMessage.includes('fetch')) {
        errorMessage = 'Network error. Please check your connection and try again.';
      }
      
      throw new Error(errorMessage);
    }
  },

  /**
   * Approve user account (Admin function)
   */
  async approveUser(userId: string, approvedBy: string): Promise<void> {
    try {
      const userRef = doc(db, 'users', userId);
      await setDoc(userRef, {
        status: 'active',
        approvedBy,
        approvedAt: Timestamp.now()
      }, { merge: true });
    } catch (error: any) {
      throw new Error(error.message);
    }
  },

  /**
   * Reject user account (Admin function)
   */
  async rejectUser(userId: string): Promise<void> {
    try {
      const userRef = doc(db, 'users', userId);
      await setDoc(userRef, {
        status: 'inactive'
      }, { merge: true });
    } catch (error: any) {
      throw new Error(error.message);
    }
  },

  /**
   * Sign out current user and clear device ID
   * ENHANCED: Also clears remember me data
   */
  async signOut(): Promise<void> {
    try {
      // EXISTING: Clear device ID on sign out
      const user = auth.currentUser;
      if (user) {
        await updateDoc(doc(db, 'users', user.uid), {
          deviceId: null
        });
      }
      
      // NEW: Clear remember me data
      try {
        localStorage.removeItem('auth_remember_me');
        localStorage.removeItem('auth_user_id');
      } catch {
        // Fail silently if localStorage not available
      }
      
      // EXISTING: Sign out from Firebase
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
  },

  /**
   * Get current authenticated user
   */
  getCurrentUser(): User | null {
    return auth.currentUser;
  },

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return !!auth.currentUser;
  },

  /**
   * Update user password (requires current password for reauthentication)
   */
  async updatePassword(currentPassword: string, newPassword: string): Promise<void> {
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('No authenticated user found');
      }

      const passwordValidation = validatePasswordStrength(newPassword);
      if (!passwordValidation.isStrong) {
        throw new Error('Password must include uppercase, lowercase, number, and special character (min 8 chars)');
      }

      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists()) {
        throw new Error('User profile not found');
      }
      
      const userData = userDoc.data();
      const userEmail = userData.email || user.email;
      
      if (!userEmail) {
        throw new Error('Email not found for authentication');
      }

      const credential = EmailAuthProvider.credential(userEmail, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
    } catch (error: any) {
      let errorMessage = error.message;
      
      if (error.code === 'auth/wrong-password') {
        errorMessage = 'Current password is incorrect';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'New password is too weak';
      } else if (error.code === 'auth/requires-recent-login') {
        errorMessage = 'Please sign out and sign in again before changing your password';
      }
      
      throw new Error(errorMessage);
    }
  }
};
