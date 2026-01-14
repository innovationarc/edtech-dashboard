import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  User
} from 'firebase/auth';
import { doc, setDoc, getDoc, Timestamp } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

export interface UserProfile {
  uid: string;
  email: string;
  name: string;
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

// Helper function to generate random registration number
const generateRegistrationNumber = (): string => {
  const prefix = 'REG';
  const year = new Date().getFullYear();
  const randomNum = Math.floor(Math.random() * 900000) + 100000; // 6-digit random number
  return `${prefix}${year}${randomNum}`;
};

export const authService = {
  // Sign in with email and password
  async signIn(email: string, password: string): Promise<UserProfile> {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Get user profile from Firestore
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      
      if (!userDoc.exists()) {
        throw new Error('User profile not found');
      }
      
      const userData = userDoc.data();
      
      // Check if account is pending approval
      if (userData.status === 'pending') {
        await signOut(auth); // Sign out the user
        throw new Error('Your account is pending admin approval. Please wait for approval before signing in.');
      }
      
      // Check if account is inactive
      if (userData.status === 'inactive') {
        await signOut(auth); // Sign out the user
        throw new Error('Your account has been deactivated. Please contact an administrator.');
      }
      
      // Update last login
      await setDoc(doc(db, 'users', user.uid), {
        ...userData,
        lastLogin: Timestamp.now()
      }, { merge: true });
      
      return {
        uid: user.uid,
        email: user.email!,
        name: userData.name,
        role: userData.role,
        status: userData.status || 'active',
        createdAt: userData.createdAt.toDate(),
        lastLogin: new Date(),
        approvedBy: userData.approvedBy,
        approvedAt: userData.approvedAt?.toDate()
      };
    } catch (error: any) {
      throw new Error(error.message);
    }
  },

  // Create new user account
  async createUser(
    email: string, 
    password: string, 
    name: string, 
    role: 'admin' | 'teacher' | 'student' = 'student',
    requireApproval: boolean = true
  ): Promise<UserProfile> {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Determine initial status based on role and approval requirement
      let initialStatus: 'active' | 'pending' = 'active';
      
      if (requireApproval && role !== 'admin') {
        initialStatus = 'pending';
      }
      
      // Generate unique registration number
      const registrationNumber = generateRegistrationNumber();
      
      const userProfile: Omit<UserProfile, 'uid'> = {
        email: user.email!,
        name,
        role,
        status: initialStatus,
        createdAt: new Date(),
        registrationNumber
      };
      
      // Save user profile to Firestore
      await setDoc(doc(db, 'users', user.uid), {
        ...userProfile,
        createdAt: Timestamp.now()
      });
      
      console.log('User created with status:', initialStatus);
      
      // If account requires approval, sign out the user immediately
      if (initialStatus === 'pending') {
        await signOut(auth);
      }
      
      return {
        uid: user.uid,
        ...userProfile
      };
    } catch (error: any) {
      // Handle specific Firebase auth errors
      let errorMessage = error.message;
      
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'An account with this email already exists';
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
      await signOut(auth);
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
      if (!user || !user.email) {
        throw new Error('No authenticated user found');
      }

      // Re-authenticate user before password change for security
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
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