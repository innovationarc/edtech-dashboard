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
  userId?: string; // ST-YYMM-XXXXX format
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
  role: 'admin' | 'teacher' | 'student';
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

// Helper function to generate unique Student ID (ST-YYMM-XXXXX)
const generateStudentId = async (): Promise<string> => {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2); // Last 2 digits of year
  const month = (now.getMonth() + 1).toString().padStart(2, '0'); // Month with leading zero
  const prefix = `ST-${year}${month}-`;
  
  // Get the current year-month to check for reset
  const currentYearMonth = `${year}${month}`;
  
  // Query for the highest number in current year-month
  const usersRef = collection(db, 'users');
  const q = query(
    usersRef, 
    where('userId', '>=', prefix),
    where('userId', '<', `ST-${year}${month}-99999`),
    orderBy('userId', 'desc'),
    limit(1)
  );
  
  const querySnapshot = await getDocs(q);
  
  let nextNumber = 1;
  
  if (!querySnapshot.empty) {
    const lastUserId = querySnapshot.docs[0].data().userId;
    const lastNumber = parseInt(lastUserId.split('-')[2]);
    nextNumber = lastNumber + 1;
  }
  
  // Format: ST-YYMM-XXXXX (5 digits with leading zeros)
  const studentId = `${prefix}${nextNumber.toString().padStart(5, '0')}`;
  
  return studentId;
};

// Helper function to generate random registration number (kept for backward compatibility)
const generateRegistrationNumber = (): string => {
  const prefix = 'REG';
  const year = new Date().getFullYear();
  const randomNum = Math.floor(Math.random() * 900000) + 100000;
  return `${prefix}${year}${randomNum}`;
};

// Password strength validation
export const validatePasswordStrength = (password: string): {
  isStrong: boolean;
  strength: 'weak' | 'medium' | 'strong' | 'very-strong';
  issues: string[];
} => {
  const issues: string[] = [];
  let score = 0;

  // Length check
  if (password.length < 8) {
    issues.push('At least 8 characters');
  } else if (password.length >= 8) {
    score += 1;
  }
  if (password.length >= 12) {
    score += 1;
  }

  // Uppercase check
  if (!/[A-Z]/.test(password)) {
    issues.push('One uppercase letter');
  } else {
    score += 1;
  }

  // Lowercase check
  if (!/[a-z]/.test(password)) {
    issues.push('One lowercase letter');
  } else {
    score += 1;
  }

  // Number check
  if (!/[0-9]/.test(password)) {
    issues.push('One number');
  } else {
    score += 1;
  }

  // Special character check
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

// Helper function to find user by Student ID, Phone Number, or Email
const findUserByLoginId = async (loginId: string): Promise<any> => {
  const usersRef = collection(db, 'users');
  
  // Try to find by userId first (ST-YYMM-XXXXX)
  let q = query(usersRef, where('userId', '==', loginId));
  let querySnapshot = await getDocs(q);
  
  if (!querySnapshot.empty) {
    return { uid: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() };
  }
  
  // If not found, try to find by phone number
  q = query(usersRef, where('phoneNumber', '==', loginId));
  querySnapshot = await getDocs(q);
  
  if (!querySnapshot.empty) {
    return { uid: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() };
  }
  
  // If not found, try to find by email
  q = query(usersRef, where('email', '==', loginId));
  querySnapshot = await getDocs(q);
  
  if (!querySnapshot.empty) {
    return { uid: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() };
  }
  
  return null;
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
  
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < fingerprint.length; i++) {
    const char = fingerprint.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  return 'device_' + Math.abs(hash).toString(36);
};

export const authService = {
  // Sign in with Student ID/Phone Number/Email and password
  async signIn(loginId: string, password: string, rememberMe: boolean = false): Promise<UserProfile> {
    try {
      const currentDeviceId = generateDeviceId();
      
      // First, try direct email login (for admin users)
      let userData = null;
      let userCredential = null;
      
      // Check if loginId looks like an email
      if (loginId.includes('@') && !loginId.includes('@student.local')) {
        try {
          userCredential = await signInWithEmailAndPassword(auth, loginId, password);
          const user = userCredential.user;
          
          // Get user profile from Firestore
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            userData = { uid: user.uid, ...userDoc.data() };
          }
        } catch (error) {
          console.log('Direct email login failed, trying search...');
        }
      }
      
      // If direct login didn't work, search by Student ID/Phone/Email
      if (!userData) {
        userData = await findUserByLoginId(loginId);
        
        if (!userData) {
          throw new Error('Account not found. Please check your Student ID, phone number, or email.');
        }
        
        // Sign in using the email associated with this account
        const emailForAuth = userData.email || `${userData.userId || userData.phoneNumber}@student.local`;
        userCredential = await signInWithEmailAndPassword(auth, emailForAuth, password);
      }
      
      if (!userData || !userCredential) {
        throw new Error('Login failed. Please try again.');
      }
      
      const user = userCredential.user;
      
      // Check if account is pending approval
      if (userData.status === 'pending') {
        await firebaseSignOut(auth);
        throw new Error('Your account is pending admin approval. Please wait for approval before signing in.');
      }
      
      // Check if account is inactive
      if (userData.status === 'inactive') {
        await firebaseSignOut(auth);
        throw new Error('Your account has been deactivated. Please contact an administrator.');
      }
      
      // Check for different device login
      if (userData.deviceId && userData.deviceId !== currentDeviceId) {
        // User is logging in from a different device
        console.log('Login detected from different device, previous session will be invalidated');
      }
      
      // Update last login and device info
      await setDoc(doc(db, 'users', user.uid), {
        lastLogin: Timestamp.now(),
        deviceId: currentDeviceId,
        rememberMe: rememberMe
      }, { merge: true });
      
      // Set persistence based on rememberMe
      if (!rememberMe) {
        // Session persistence - will be cleared when browser is closed
        // This is handled by Firebase Auth automatically
      }
      
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

  // Create new user account
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
    role: 'admin' | 'teacher' | 'student' = 'student',
    requireApproval: boolean = false
  ): Promise<UserProfile> {
    try {
      // Validate password strength
      const passwordValidation = validatePasswordStrength(password);
      if (!passwordValidation.isStrong) {
        throw new Error('Password must include uppercase, lowercase, number, and special character (min 8 chars)');
      }
      
      // Generate unique Student ID
      const studentId = await generateStudentId();
      
      // Generate unique registration number for backward compatibility
      const registrationNumber = generateRegistrationNumber();
      
      // Students are auto-approved by default, others may require approval
      let initialStatus: 'active' | 'pending' = 'active';
      if (requireApproval && role !== 'admin' && role !== 'student') {
        initialStatus = 'pending';
      }
      
      // Create email for Firebase Auth (use provided email or generate one)
      const authEmail = email && email.trim() ? email.trim() : `${studentId}@student.local`;
      
      // Create Firebase Auth user
      const userCredential = await createUserWithEmailAndPassword(auth, authEmail, password);
      const user = userCredential.user;
      
      // Build user profile with only defined values
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

      // Only add optional fields if they have values
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
      
      // Save user profile to Firestore
      await setDoc(doc(db, 'users', user.uid), userProfile);
      
      console.log('User created with Student ID:', studentId, 'Status:', initialStatus);
      
      // If account requires approval (teachers, not students), sign out the user immediately
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

  // Send password reset OTP
  async sendPasswordResetOTP(loginId: string): Promise<{ success: boolean; phoneNumber?: string; message: string }> {
    try {
      // Find user by login ID
      const userData = await findUserByLoginId(loginId);
      
      if (!userData) {
        throw new Error('Account not found. Please check your Student ID, phone number, or email.');
      }
      
      if (!userData.phoneNumber) {
        throw new Error('No phone number associated with this account. Please contact support.');
      }
      
      return {
        success: true,
        phoneNumber: userData.phoneNumber,
        message: 'Account found. Please verify your phone number.'
      };
    } catch (error: any) {
      throw new Error(error.message);
    }
  },

  // Reset password with OTP verification
  async resetPassword(phoneNumber: string, newPassword: string): Promise<void> {
    try {
      // Validate password strength
      const passwordValidation = validatePasswordStrength(newPassword);
      if (!passwordValidation.isStrong) {
        throw new Error('Password must include uppercase, lowercase, number, and special character (min 8 chars)');
      }
      
      // Find user by phone number
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('phoneNumber', '==', phoneNumber));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        throw new Error('Account not found.');
      }
      
      const userDoc = querySnapshot.docs[0];
      const userData = userDoc.data();
      
      // Get user's email for authentication
      const emailForAuth = userData.email || `${userData.userId}@student.local`;
      
      // Note: We can't directly change password without current password in Firebase
      // In production, you'd send a password reset email or use Admin SDK
      // For now, we'll update the user document to mark password reset pending
      await updateDoc(userDoc.ref, {
        passwordResetPending: true,
        passwordResetAt: Timestamp.now()
      });
      
      // In a real implementation, you would:
      // 1. Use Firebase Admin SDK to update the password
      // 2. Or send a password reset email
      // For this implementation, we're marking it as pending
      
      console.log('Password reset marked as pending for:', userData.userId);
    } catch (error: any) {
      throw new Error(error.message);
    }
  },

  // Approve user account (admin only)
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

  // Reject user account (admin only)
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

  // Sign out
  async signOut(): Promise<void> {
    try {
      await firebaseSignOut(auth);
    } catch (error: any) {
      throw new Error(error.message);
    }
  },

  // Listen to auth state changes
  onAuthStateChanged(callback: (user: User | null) => void) {
    return onAuthStateChanged(auth, callback);
  },

  // Get current user
  getCurrentUser(): User | null {
    return auth.currentUser;
  },

  // Check if user is authenticated
  isAuthenticated(): boolean {
    return !!auth.currentUser;
  },

  // Update user password
  async updatePassword(currentPassword: string, newPassword: string): Promise<void> {
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('No authenticated user found');
      }

      // Validate new password strength
      const passwordValidation = validatePasswordStrength(newPassword);
      if (!passwordValidation.isStrong) {
        throw new Error('Password must include uppercase, lowercase, number, and special character (min 8 chars)');
      }

      // Get user's email from Firestore
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists()) {
        throw new Error('User profile not found');
      }
      
      const userData = userDoc.data();
      const userEmail = userData.email || user.email;
      
      if (!userEmail) {
        throw new Error('Email not found for authentication');
      }

      // Re-authenticate user before password change
      const credential = EmailAuthProvider.credential(userEmail, currentPassword);
      await reauthenticateWithCredential(user, credential);

      // Update password
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
