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
  const year = now.getFullYear().toString().slice(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const prefix = `ST-${year}${month}-`;
  
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
  
  const studentId = `${prefix}${nextNumber.toString().padStart(5, '0')}`;
  
  return studentId;
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

// Helper function to find user by Student ID, Phone Number, or Email
const findUserByLoginId = async (loginId: string): Promise<any> => {
  const usersRef = collection(db, 'users');
  
  // Try to find by userId first
  let q = query(usersRef, where('userId', '==', loginId));
  let querySnapshot = await getDocs(q);
  
  if (!querySnapshot.empty) {
    return { uid: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() };
  }
  
  // Try to find by phone number
  q = query(usersRef, where('phoneNumber', '==', loginId));
  querySnapshot = await getDocs(q);
  
  if (!querySnapshot.empty) {
    return { uid: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() };
  }
  
  // Try to find by email
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
          
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            userData = { uid: user.uid, ...userDoc.data() };
          }
        } catch (error) {
          console.log('Direct email login failed, trying search...');
        }
      }
      
      if (!userData) {
        userData = await findUserByLoginId(loginId);
        
        if (!userData) {
          throw new Error('Account not found. Please check your Student ID, phone number, or email.');
        }
        
        const emailForAuth = userData.email || `${userData.userId || userData.phoneNumber}@student.local`;
        userCredential = await signInWithEmailAndPassword(auth, emailForAuth, password);
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
      const passwordValidation = validatePasswordStrength(password);
      if (!passwordValidation.isStrong) {
        throw new Error('Password must include uppercase, lowercase, number, and special character (min 8 chars)');
      }
      
      const studentId = await generateStudentId();
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
      
      console.log('User created with Student ID:', studentId, 'Status:', initialStatus);
      
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

  async resetPassword(phoneNumber: string, newPassword: string): Promise<void> {
    try {
      const passwordValidation = validatePasswordStrength(newPassword);
      if (!passwordValidation.isStrong) {
        throw new Error('Password must include uppercase, lowercase, number, and special character (min 8 chars)');
      }
      
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('phoneNumber', '==', phoneNumber));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        throw new Error('Account not found.');
      }
      
      const userDoc = querySnapshot.docs[0];
      const userData = userDoc.data();
      
      await updateDoc(userDoc.ref, {
        passwordResetPending: true,
        passwordResetAt: Timestamp.now()
      });
      
      console.log('Password reset marked as pending for:', userData.userId);
    } catch (error: any) {
      throw new Error(error.message);
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
