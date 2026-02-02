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
    const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 
                       import.meta.env.VITE_API_URL ||
                       'https://edtech-dashboard-alpha.vercel.app';
    const MASTER_API_KEY = import.meta.env.VITE_SMS_MASTER_KEY;

    const requestBody: any = {
      loginId: userId, // User ID only
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
      // Validate password strength
      const passwordValidation = validatePasswordStrength(password);
      if (!passwordValidation.isStrong) {
        throw new Error('Password must include uppercase, lowercase, number, and special character (min 8 chars)');
      }

      // Determine email for Firebase Auth
      let emailForAuth = email;
      if (!emailForAuth || !emailForAuth.includes('@')) {
        if (role === 'admin') {
          emailForAuth = `${userId || phoneNumber}@admin.local`;
        } else {
          emailForAuth = `${userId || phoneNumber}@student.local`;
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
        userId: userId,
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
        userId: userId,
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
        lastLogin: new Date()
      };
    } catch (error: any) {
      let errorMessage = error.message;
      
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'An account with this email already exists';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Password is too weak';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address';
      }
      
      throw new Error(errorMessage);
    }
  },

  /**
   * Sign in with User ID and password
   * Supports all account types: admin, manager, teacher, student, parent, etc.
   */
  async signIn(userId: string, password: string, rememberMe: boolean = false): Promise<UserProfile> {
    try {
      const currentDeviceId = generateDeviceId();
      
      // Set persistence based on rememberMe
      // If rememberMe is false, use session persistence (logout when browser closes)
      // If rememberMe is true, use local persistence (stay logged in)
      if (rememberMe) {
        await setPersistence(auth, browserLocalPersistence);
      } else {
        await setPersistence(auth, browserSessionPersistence);
      }
      
      // Search for user by User ID only (no email or phone number login)
      const userData = await findUserByUserId(userId);
      
      if (!userData) {
        throw new Error('Account not found. Please check your User ID.');
      }
      
      // Determine email for auth based on role
      let emailForAuth = userData.email;
      if (!emailForAuth || !emailForAuth.includes('@')) {
        if (userData.role === 'admin') {
          emailForAuth = `${userData.userId || userData.phoneNumber}@admin.local`;
        } else {
          emailForAuth = `${userData.userId || userData.phoneNumber}@student.local`;
        }
      }
      
      const userCredential = await signInWithEmailAndPassword(auth, emailForAuth, password);
      
      // CRITICAL: Verify user exists in Firestore after Firebase Auth login
      const user = userCredential.user;
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists()) {
        await firebaseSignOut(auth);
        throw new Error('Account not found in database. Please contact administrator.');
      }
      
      // Update userData with Firestore data
      const firestoreData = userDoc.data();
      
      if (firestoreData.status === 'pending') {
        await firebaseSignOut(auth);
        throw new Error('Your account is pending approval. Please wait for an administrator to approve your account.');
      }
      
      if (firestoreData.status === 'inactive') {
        await firebaseSignOut(auth);
        throw new Error('Your account has been deactivated. Please contact support.');
      }
      
      // Device management: Only one device can be logged in at a time
      const storedDeviceId = firestoreData.deviceId;
      
      if (storedDeviceId && storedDeviceId !== currentDeviceId) {
        // Different device detected - log out from other device by updating deviceId
        // This will cause the other device to be logged out on next auth state check
        await updateDoc(doc(db, 'users', user.uid), {
          deviceId: currentDeviceId,
          lastLogin: Timestamp.now(),
          lastLoginIp: await getClientIp()
        });
      } else {
        // Same device or first login - just update lastLogin
        await updateDoc(doc(db, 'users', user.uid), {
          deviceId: currentDeviceId,
          lastLogin: Timestamp.now(),
          lastLoginIp: await getClientIp()
        });
      }
      
      return {
        uid: user.uid,
        ...firestoreData,
        createdAt: firestoreData.createdAt?.toDate() || new Date(),
        lastLogin: new Date()
      } as UserProfile;
    } catch (error: any) {
      let errorMessage = error.message;
      
      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        errorMessage = 'Invalid password. Please try again.';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many failed attempts. Please try again later.';
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage = 'Network error. Please check your connection.';
      }
      
      throw new Error(errorMessage);
    }
  },

  /**
   * Check if account exists by phone number
   * Used for duplicate checking during registration (student accounts only)
   * Returns count of STUDENT accounts only (excludes admin/manager/teacher accounts)
   */
  async checkAccountExists(phoneNumber: string): Promise<{ 
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
        purpose: 'duplicate-check' // This purpose returns STUDENT accounts only
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
            message: 'No existing accounts found'
          };
        }
        
        throw new Error(errorData.error || 'Failed to check account');
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
   */
  async signOut(): Promise<void> {
    try {
      // Clear device ID on sign out
      const user = auth.currentUser;
      if (user) {
        await updateDoc(doc(db, 'users', user.uid), {
          deviceId: null
        });
      }
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
