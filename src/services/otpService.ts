// src/services/otpService.ts
import { collection, query, where, getDocs, addDoc, deleteDoc, Timestamp, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

interface OTPRecord {
  phoneNumber: string;
  otp: string;
  createdAt: Date;
  expiresAt: Date;
  attempts: number;
}

const OTP_EXPIRY_MINUTES = 5;
const MAX_OTP_ATTEMPTS = 3;
const OTP_LENGTH = 6;

export const otpService = {
  // Generate a random OTP
  generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  },

  // Format phone number to Bangladesh format
  formatPhoneNumber(phoneNumber: string): string {
    // Remove all non-digit characters
    let cleaned = phoneNumber.replace(/\D/g, '');
    
    // Handle different input formats
    if (cleaned.startsWith('880')) {
      // Already has country code
      cleaned = cleaned.substring(3);
    } else if (cleaned.startsWith('88')) {
      cleaned = cleaned.substring(2);
    }
    
    // Now cleaned should be 10 or 11 digits
    if (cleaned.length === 11 && cleaned.startsWith('0')) {
      // Format: 01xxxxxxxxx -> +8801xxxxxxxxx
      return `+88${cleaned}`;
    } else if (cleaned.length === 10 && cleaned.startsWith('1')) {
      // Format: 1xxxxxxxxx -> +8801xxxxxxxxx
      return `+880${cleaned}`;
    }
    
    // Invalid format
    throw new Error('Invalid phone number format');
  },

  // Validate phone number format
  validatePhoneNumber(phoneNumber: string): boolean {
    try {
      const formatted = this.formatPhoneNumber(phoneNumber);
      // Check if formatted number is valid Bangladesh mobile number
      // Bangladesh mobile: +8801xxxxxxxxx (14 characters total)
      return formatted.startsWith('+8801') && formatted.length === 14;
    } catch {
      return false;
    }
  },

  // Send OTP via SMS
  async sendOTP(phoneNumber: string): Promise<{ success: boolean; message: string }> {
    try {
      // Format and validate phone number
      const formattedPhone = this.formatPhoneNumber(phoneNumber);
      
      if (!this.validatePhoneNumber(phoneNumber)) {
        return { success: false, message: 'Invalid phone number format' };
      }

      // Check for existing OTP within the last minute (rate limiting)
      const otpCollection = collection(db, 'otp_verifications');
      const recentOTPQuery = query(
        otpCollection,
        where('phoneNumber', '==', formattedPhone)
      );
      
      const recentOTPs = await getDocs(recentOTPQuery);
      
      // Delete expired OTPs and check for recent ones
      const now = new Date();
      let hasRecentOTP = false;
      
      for (const doc of recentOTPs.docs) {
        const data = doc.data();
        const expiresAt = data.expiresAt.toDate();
        
        if (expiresAt < now) {
          // Delete expired OTP
          await deleteDoc(doc.ref);
        } else {
          // Check if OTP was sent in the last minute
          const createdAt = data.createdAt.toDate();
          const timeSinceCreation = (now.getTime() - createdAt.getTime()) / 1000;
          
          if (timeSinceCreation < 60) {
            hasRecentOTP = true;
          } else {
            // Delete old OTP to create new one
            await deleteDoc(doc.ref);
          }
        }
      }
      
      if (hasRecentOTP) {
        return { 
          success: false, 
          message: 'Please wait 60 seconds before requesting a new OTP' 
        };
      }

      // Generate OTP
      const otp = this.generateOTP();
      
      // Save OTP to Firestore first
      const expiresAt = new Date(now.getTime() + OTP_EXPIRY_MINUTES * 60 * 1000);
      const otpDoc = await addDoc(otpCollection, {
        phoneNumber: formattedPhone,
        otp,
        createdAt: Timestamp.fromDate(now),
        expiresAt: Timestamp.fromDate(expiresAt),
        attempts: 0
      });

      // Send SMS using backend API with security
      const message = `Your verification code is: ${otp}. Valid for ${OTP_EXPIRY_MINUTES} minutes. Do not share this code with anyone.`;
      
      try {
        // Get backend URL and master key from environment
        const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 
                           import.meta.env.VITE_API_URL ||
                           'https://edtech-dashboard-alpha.vercel.app';
        const MASTER_API_KEY = import.meta.env.VITE_SMS_MASTER_KEY;

        console.log('🔧 Backend URL:', BACKEND_URL);
        console.log('🔑 Master Key configured:', !!MASTER_API_KEY);

        // Prepare request body
        const requestBody: any = {
          phoneNumber: formattedPhone,
          message
        };

        // Add master key only if it's configured
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

        console.log('📡 Response status:', response.status);

        // Check if response is ok
        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ Server error:', errorText);
          
          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch {
            errorData = { error: errorText || `Server error: ${response.status}` };
          }
          
          throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        console.log('✅ SMS API response:', result);

        if (!result.success) {
          // If SMS fails, delete the OTP record
          await deleteDoc(otpDoc);
          
          return { 
            success: false, 
            message: result.error || 'Failed to send OTP' 
          };
        }

        return { 
          success: true, 
          message: 'OTP sent successfully to your phone number' 
        };
      } catch (smsError: any) {
        console.error('❌ SMS sending error:', smsError);
        
        // Delete the OTP record since SMS failed
        await deleteDoc(otpDoc);
        
        // Provide more specific error messages
        let errorMessage = 'Failed to send SMS. ';
        
        if (smsError.message.includes('SMS service not configured')) {
          errorMessage += 'SMS service is not properly configured. Please contact support.';
        } else if (smsError.message.includes('Unauthorized')) {
          errorMessage += 'Authentication failed. Please contact support.';
        } else if (smsError.message.includes('Network') || smsError.message.includes('fetch')) {
          errorMessage += 'Network error. Please check your internet connection.';
        } else {
          errorMessage += 'Please try again later.';
        }
        
        return { 
          success: false, 
          message: errorMessage
        };
      }
    } catch (error: any) {
      console.error('❌ Error in sendOTP:', error);
      return { 
        success: false, 
        message: error.message || 'Failed to send OTP. Please try again.' 
      };
    }
  },

  // Verify OTP
  async verifyOTP(phoneNumber: string, otp: string): Promise<{ success: boolean; message: string }> {
    try {
      const formattedPhone = this.formatPhoneNumber(phoneNumber);
      
      const otpCollection = collection(db, 'otp_verifications');
      const otpQuery = query(
        otpCollection,
        where('phoneNumber', '==', formattedPhone)
      );
      
      const otpDocs = await getDocs(otpQuery);
      
      if (otpDocs.empty) {
        return { 
          success: false, 
          message: 'No OTP found. Please request a new one.' 
        };
      }

      const now = new Date();
      let otpDoc = null;
      let otpData = null;

      // Find the most recent valid OTP
      for (const doc of otpDocs.docs) {
        const data = doc.data();
        const expiresAt = data.expiresAt.toDate();
        
        if (expiresAt < now) {
          // Delete expired OTP
          await deleteDoc(doc.ref);
        } else {
          otpDoc = doc;
          otpData = data;
          break;
        }
      }

      if (!otpDoc || !otpData) {
        return { 
          success: false, 
          message: 'OTP has expired. Please request a new one.' 
        };
      }

      // Check attempts
      if (otpData.attempts >= MAX_OTP_ATTEMPTS) {
        await deleteDoc(otpDoc.ref);
        return { 
          success: false, 
          message: 'Too many failed attempts. Please request a new OTP.' 
        };
      }

      // Verify OTP
      if (otpData.otp === otp) {
        // OTP is correct, delete the record
        await deleteDoc(otpDoc.ref);
        return { 
          success: true, 
          message: 'Phone number verified successfully' 
        };
      } else {
        // Increment attempts
        const newAttempts = otpData.attempts + 1;
        
        if (newAttempts >= MAX_OTP_ATTEMPTS) {
          await deleteDoc(otpDoc.ref);
          return { 
            success: false, 
            message: 'Too many failed attempts. Please request a new OTP.' 
          };
        }
        
        // Update attempts count
        await updateDoc(otpDoc.ref, { attempts: newAttempts });
        
        return { 
          success: false, 
          message: `Invalid OTP. ${MAX_OTP_ATTEMPTS - newAttempts} attempts remaining.` 
        };
      }
    } catch (error: any) {
      console.error('❌ Error verifying OTP:', error);
      return { 
        success: false, 
        message: 'Failed to verify OTP. Please try again.' 
      };
    }
  },

  // Clean up expired OTPs (can be called periodically)
  async cleanupExpiredOTPs(): Promise<void> {
    try {
      const otpCollection = collection(db, 'otp_verifications');
      const allOTPs = await getDocs(otpCollection);
      
      const now = new Date();
      const deletePromises = [];
      
      for (const doc of allOTPs.docs) {
        const data = doc.data();
        const expiresAt = data.expiresAt.toDate();
        
        if (expiresAt < now) {
          deletePromises.push(deleteDoc(doc.ref));
        }
      }
      
      await Promise.all(deletePromises);
      console.log(`🧹 Cleaned up ${deletePromises.length} expired OTPs`);
    } catch (error) {
      console.error('❌ Error cleaning up expired OTPs:', error);
    }
  }
};
