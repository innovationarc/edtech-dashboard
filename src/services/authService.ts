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
  sendPasswordResetEmail
} from 'firebase/auth';
import { doc, setDoc, getDoc, Timestamp, query, collection, where, getDocs, updateDoc, orderBy, limit } from 'firebase/firestore';
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
  classGrade?: 'class6' | 'class7' | 'class8' | 'class9' | 'class10' | 'ssc' | 'class11' | 'class12' | 'hsc' | 'diploma' | 'undergraduate' | 'graduated';
  role: 'admin' | 'manager' | 'course_manager' | 'student_manager' | 'coordinator' | 'teacher' | 'parent' | 'student';
  status: 'active' | 'inactive' | 'pending';
  createdAt: Date;
  lastLogin?: Date;
  approvedBy?: string;
  approvedAt?: Date;
  address?: string;
  class?: string;
  school?: string;
  college?: string;
  mobileNumber?: string;
  registrationNumber?: string;
  profilePictureUrl?: string;
  deviceId?: string;
  lastLoginIp?: string;
}

// Helper function to normalize phone number to 880XXXXXXXXXX format
const normalizePhoneNumber = (phoneNumber: string): string => {
  let cleaned = phoneNumber.replace(/\D/g, '');
  
  // Remove country code if present
  if (cleaned.startsWith('880')) {
    cleaned = cleaned.substring(3);
  } else if (cleaned.startsWith('88')) {
    cleaned = cleaned.substring(2);
  }
  
  // Remove leading zero if present
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }
  
  // Should now have 10 digits
  if (cleaned.length !== 10) {
    throw new Error('Invalid phone number format');
  }
  
  // Return in format: 880XXXXXXXXXX (no + sign)
  return `880${cleaned}`;
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

// Helper function to find user by Student ID, Phone Number, or Email via BACKEND API
const findUserByLoginId = async (loginId: string): Promise<any> => {
  try {
    const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 
                       import.meta.env.VITE_API_URL ||
                       'https://edtech-dashboard-alpha.vercel.app';
    const MASTER_API_KEY = import.meta.env.VITE_SMS_MASTER_KEY;

    const requestBody: any = {
      loginId,
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
      
      // If 404, user not found
      if (response.status === 404) {
        return null;
      }
      
      throw new Error(errorData.error || 'Failed to search for user');
    }

    const result = await response.json();
    
    if (!result.success) {
      return null;
    }
    
    // Return user data from backend
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

export const authService = {
  async signIn(loginId: string, password: string, rememberMe: boolean = false): Promise<UserProfile> {
    try {
      const currentDeviceId = generateDeviceId();
      
      let userData = null;
      let userCredential = null;
      
      // Check if loginId looks like an email
      if (loginId.includes('@') && !loginId.includes('@student.local')) {
        try {
          userCredential = await signInWithEmailAndPassword(auth, loginId, password);
          const user = userCredential.user;
          
          // CRITICAL: Check if user exists in Firestore
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (!userDoc.exists()) {
            await firebaseSignOut(auth);
            throw new Error('Account not found in database. Please contact administrator.');
          }
          
          userData = { uid: user.uid, ...userDoc.data() };
        } catch (error) {
          // Continue to backend search if direct email login fails
        }
      }
      
      // If direct email login failed or loginId is not email, use backend API
      if (!userData) {
        userData = await findUserByLoginId(loginId);
        
        if (!userData) {
          throw new Error('Account not found. Please check your Student ID, phone number, or email.');
        }
        
        const emailForAuth = userData.email || `${userData.userId || userData.phoneNumber}@student.local`;
        userCredential = await signInWithEmailAndPassword(auth, emailForAuth, password);
        
        // CRITICAL: Verify user exists in Firestore after Firebase Auth login
        const user = userCredential.user;
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (!userDoc.exists()) {
          await firebaseSignOut(auth);
          throw new Error('Account not found in database. Please contact administrator.');
        }
        
        // Update userData with Firestore data
        userData = { uid: user.uid, ...userDoc.data() };
      }
      
      if (!userData || !userCredential) {
        throw new Error('Login failed. Please try again.');
      }
      
      const user = userCredential.user;
      
      if (userData.status === 'pending') {
        await firebaseSignOut(auth);
        throw new Error('Your account is pending admin approval. Please wait for approval before signing in.');
      }
      
      if (userData.status === 'inactive') {
        await firebaseSignOut(auth);
        throw new Error('Your account has been deactivated. Please contact an administrator.');
      }
      
      await setDoc(doc(db, 'users', user.uid), {
        lastLogin: Timestamp.now(),
        deviceId: currentDeviceId,
        rememberMe: rememberMe
      }, { merge: true });
      
      return {
        uid: user.uid,
        userId: userData.userId,
        email: userData.email,
        name: userData.name || userData.fullName,
        surname: userData.surname,
        fullName: userData.fullName,
        dob: userData.dob,
        phoneNumber: userData.phoneNumber,
        guardianPhone: userData.guardianPhone,
        bloodGroup: userData.bloodGroup,
        gender: userData.gender,
        religion: userData.religion,
        classGrade: userData.classGrade,
        role: userData.role,
        status: userData.status || 'active',
        createdAt: userData.createdAt?.toDate ? userData.createdAt.toDate() : new Date(),
        lastLogin: new Date(),
        approvedBy: userData.approvedBy,
        approvedAt: userData.approvedAt?.toDate?.(),
        registrationNumber: userData.registrationNumber,
        deviceId: currentDeviceId
      };
    } catch (error: any) {
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        throw new Error('Invalid credentials. Please check your login information and password.');
      }
      throw new Error(error.message);
    }
  },

  async checkUserExists(phoneNumber?: string, email?: string): Promise<{ exists: boolean; field?: 'phone' | 'email'; message?: string }> {
    try {
      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 
                         import.meta.env.VITE_API_URL ||
                         'https://edtech-dashboard-alpha.vercel.app';
      const MASTER_API_KEY = import.meta.env.VITE_SMS_MASTER_KEY;

      const requestBody: any = {};
      
      if (phoneNumber) {
        requestBody.phoneNumber = phoneNumber;
      }
      
      if (email) {
        requestBody.email = email;
      }

      if (MASTER_API_KEY) {
        requestBody.apiKey = MASTER_API_KEY;
      }

      const response = await fetch(`${BACKEND_URL}/api/check-user-exists`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        // If API fails, assume doesn't exist (fail gracefully)
        return { exists: false };
      }

      const result = await response.json();
      
      if (result.exists) {
        return {
          exists: true,
          field: result.field,
          message: result.message
        };
      }

      return { exists: false };
    } catch (error: any) {
      // If check fails, assume doesn't exist (fail gracefully)
      return { exists: false };
    }
  },

  async generateStudentId(): Promise<string> {
    try {
      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 
                         import.meta.env.VITE_API_URL ||
                         'https://edtech-dashboard-alpha.vercel.app';
      const MASTER_API_KEY = import.meta.env.VITE_SMS_MASTER_KEY;

      const requestBody: any = {
        role: 'student'
      };

      if (MASTER_API_KEY) {
        requestBody.apiKey = MASTER_API_KEY;
      }

      console.log('🔢 Generating Student ID via api/generate-id...');

      const response = await fetch(`${BACKEND_URL}/api/generate-id`, {
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
        console.error('❌ Failed to generate Student ID:', errorData.error);
        throw new Error(errorData.error || 'Failed to generate Student ID');
      }

      const result = await response.json();
      
      if (!result.success || !result.userId) {
        console.error('❌ Invalid response from ID generation service:', result);
        throw new Error('Invalid response from ID generation service');
      }

      console.log('✅ Student ID generated:', result.userId);
      return result.userId;
    } catch (error: any) {
      console.error('❌ Error generating Student ID, using fallback:', error);
      // Fallback: generate timestamp-based ID
      const now = new Date();
      const year = now.getFullYear().toString().slice(-2);
      const month = (now.getMonth() + 1).toString().padStart(2, '0');
      const fallbackId = `ST-${year}${month}-${Date.now().toString().slice(-5)}`;
      
      console.log('⚠️ Using fallback Student ID:', fallbackId);
      return fallbackId;
    }
  },

  async createUser(
    phoneNumber: string,
    email: string,
    password: string,
    surname: string,
    fullName: string,
    dob: string,
    primaryPhone: string,
    guardianPhone: string,
    bloodGroup: string,
    gender: string,
    religion: string,
    classGrade: 'class6' | 'class7' | 'class8' | 'class9' | 'class10' | 'ssc' | 'class11' | 'class12' | 'hsc' | 'diploma' | 'undergraduate' | 'graduated',
    role: 'admin' | 'manager' | 'course_manager' | 'student_manager' | 'coordinator' | 'teacher' | 'parent' | 'student' = 'student',
    requireApproval: boolean = false
  ): Promise<UserProfile> {
    try {
      const passwordValidation = validatePasswordStrength(password);
      if (!passwordValidation.isStrong) {
        throw new Error('Password must include uppercase, lowercase, number, and special character (min 8 chars)');
      }
      
      // Generate unique Student ID via api/generate-id endpoint
      const studentId = await this.generateStudentId();
      const registrationNumber = `REG${new Date().getFullYear()}${Math.floor(Math.random() * 900000) + 100000}`;
      
      let initialStatus: 'active' | 'pending' = 'active';
      if (requireApproval && role !== 'admin' && role !== 'student') {
        initialStatus = 'pending';
      }
      
      const authEmail = email && email.trim() ? email.trim() : `${studentId}@student.local`;
      
      const userCredential = await createUserWithEmailAndPassword(auth, authEmail, password);
      const user = userCredential.user;
      
      const userProfile: any = {
        userId: studentId,
        name: fullName,
        surname,
        fullName,
        dob,
        phoneNumber: primaryPhone,
        gender,
        classGrade,
        role,
        status: initialStatus,
        createdAt: Timestamp.now(),
        registrationNumber,
        deviceId: generateDeviceId()
      };

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
      
      await setDoc(doc(db, 'users', user.uid), userProfile);
      
      if (initialStatus === 'pending') {
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

  async sendPasswordResetOTP(loginId: string): Promise<{ success: boolean; phoneNumber?: string; message: string }> {
    try {
      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 
                         import.meta.env.VITE_API_URL ||
                         'https://edtech-dashboard-alpha.vercel.app';
      const MASTER_API_KEY = import.meta.env.VITE_SMS_MASTER_KEY;

      const requestBody: any = {
        loginId,
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

  async signOut(): Promise<void> {
    try {
      await firebaseSignOut(auth);
    } catch (error: any) {
      throw new Error(error.message);
    }
  },

  onAuthStateChanged(callback: (user: User | null) => void) {
    return onAuthStateChanged(auth, callback);
  },

  getCurrentUser(): User | null {
    return auth.currentUser;
  },

  isAuthenticated(): boolean {
    return !!auth.currentUser;
  },

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
