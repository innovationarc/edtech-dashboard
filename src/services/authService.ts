// src/services/authService.ts
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  User
} from 'firebase/auth';
import { doc, setDoc, getDoc, Timestamp, query, collection, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

export interface UserProfile {
  uid: string;
  userId?: string; // ST-1xxxxxxx format
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
  grade?: 'six' | 'seven' | 'eight' | 'nine' | 'ten' | 'eleven' | 'twelve' | 'admission' | 'graduated';
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
}

// Helper function to generate unique Student ID (ST-1xxxxxxx)
const generateStudentId = async (): Promise<string> => {
  const prefix = 'ST-1';
  let isUnique = false;
  let studentId = '';
  
  while (!isUnique) {
    const randomNum = Math.floor(Math.random() * 9000000) + 1000000; // 7-digit random number
    studentId = `${prefix}${randomNum}`;
    
    // Check if this ID already exists
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('userId', '==', studentId));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      isUnique = true;
    }
  }
  
  return studentId;
};

// Helper function to generate random registration number (kept for backward compatibility)
const generateRegistrationNumber = (): string => {
  const prefix = 'REG';
  const year = new Date().getFullYear();
  const randomNum = Math.floor(Math.random() * 900000) + 100000; // 6-digit random number
  return `${prefix}${year}${randomNum}`;
};

// Helper function to find user by Student ID, Phone Number, or Email
const findUserByLoginId = async (loginId: string): Promise<any> => {
  const usersRef = collection(db, 'users');
  
  // Try to find by userId first (ST-1xxxxxxx)
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

export const authService = {
  // Sign in with Student ID/Phone Number/Email and password
  async signIn(loginId: string, password: string): Promise<UserProfile> {
    try {
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
          // If direct email login fails, fall through to search
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
      
      // Update last login
      await setDoc(doc(db, 'users', user.uid), {
        lastLogin: Timestamp.now()
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
        grade: userData.grade,
        role: userData.role,
        status: userData.status || 'active',
        createdAt: userData.createdAt?.toDate ? userData.createdAt.toDate() : new Date(),
        lastLogin: new Date(),
        approvedBy: userData.approvedBy,
        approvedAt: userData.approvedAt?.toDate?.(),
        registrationNumber: userData.registrationNumber
      };
    } catch (error: any) {
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        throw new Error('Invalid credentials. Please check your login information and password.');
      }
      throw new Error(error.message);
    }
  },

  // Create new user account with new registration fields
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
    grade: 'six' | 'seven' | 'eight' | 'nine' | 'ten' | 'eleven' | 'twelve' | 'admission' | 'graduated',
    role: 'admin' | 'teacher' | 'student' = 'student',
    requireApproval: boolean = false // Changed default to false for auto-approval
  ): Promise<UserProfile> {
    try {
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
      
      // Build user profile with only defined values (no undefined)
      const userProfile: any = {
        userId: studentId,
        name: fullName,
        surname,
        fullName,
        dob,
        phoneNumber: primaryPhone,
        bloodGroup,
        gender,
        grade,
        role,
        status: initialStatus,
        createdAt: Timestamp.now(),
        registrationNumber
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
      // Handle specific Firebase auth errors
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

  // Approve user account (admin only)
  async approveUser(userId: string, approvedBy: string): Promise<void> {
    try {
      console.log('Approving user in authService:', userId);
      
      const userRef = doc(db, 'users', userId);
      await setDoc(userRef, {
        status: 'active',
        approvedBy,
        approvedAt: Timestamp.now()
      }, { merge: true });
      
      console.log('User approved successfully');
    } catch (error: any) {
      console.error('Error approving user:', error);
      throw new Error(error.message);
    }
  },

  // Reject user account (admin only)
  async rejectUser(userId: string): Promise<void> {
    try {
      console.log('Rejecting user in authService:', userId);
      
      const userRef = doc(db, 'users', userId);
      await setDoc(userRef, {
        status: 'inactive'
      }, { merge: true });
      
      console.log('User rejected successfully');
    } catch (error: any) {
      console.error('Error rejecting user:', error);
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

      // Re-authenticate user before password change for security
      const credential = EmailAuthProvider.credential(userEmail, currentPassword);
      await reauthenticateWithCredential(user, credential);

      // Update password
      await updatePassword(user, newPassword);
    } catch (error: any) {
      // Handle specific Firebase auth errors
      let errorMessage = error.message;
      
      if (error.code === 'auth/wrong-password') {
        errorMessage = 'Current password is incorrect';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'New password is too weak. Please choose a stronger password';
      } else if (error.code === 'auth/requires-recent-login') {
        errorMessage = 'Please sign out and sign in again before changing your password';
      }
      
      throw new Error(errorMessage);
    }
  }
};
