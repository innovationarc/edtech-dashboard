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

      // Check if user is approved
      if (userData.status === 'pending') {
        await firebaseSignOut(auth);
        throw new Error('Your account is pending approval. Please contact an administrator.');
      }

      if (userData.status === 'inactive') {
        await firebaseSignOut(auth);
        throw new Error('Your account has been deactivated. Please contact an administrator.');
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
      
      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 
                         import.meta.env.VITE_API_URL ||
                         'https://edtech-dashboard-alpha.vercel.app';
      const MASTER_API_KEY = import.meta.env.VITE_SMS_MASTER_KEY;

      const requestBody: any = {
        loginId: normalizedUserId,
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
        
        if (response.status === 404) {
          return {
            success: false,
            message: 'User ID not found. Please check and try again.'
          };
        }
        
        throw new Error(errorData.error || 'Failed to find user');
      }

      const result = await response.json();
      
      if (!result.success) {
        return {
          success: false,
          message: result.error || 'User ID not found'
        };
      }
      
      return {
        success: true,
        phoneNumber: result.phoneNumber,
        message: result.message || 'User found. OTP will be sent to your registered phone number.'
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
   * Check if user exists by phone number
   * Returns count of ALL account types (admin, teacher, student, parent, etc.)
   * Used for password reset (ForgotPasswordModal)
   */
  async checkUserExistsByPhone(phoneNumber: string): Promise<{ 
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
        purpose: 'password-reset' // This purpose returns ALL account types
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
            message: 'No account found with this phone number'
          };
        }
        
        throw new Error(errorData.error || 'Failed to check user');
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
