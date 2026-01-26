// src/services/otpService.ts
import { collection, query, where, getDocs, addDoc, deleteDoc, Timestamp, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

interface OTPRecord {
  phoneNumber: string;
  otp: string;
  createdAt: Date;
  expiresAt: Date;
  attempts: number;
  purpose: 'registration' | 'password-reset';
}

const OTP_EXPIRY_MINUTES = 2;
const MAX_OTP_ATTEMPTS = 3;
const OTP_LENGTH = 6;

// GSM 7-bit character set for SMS
const GSM_7BIT_CHARS = "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ\x1BÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";

// Convert text to GSM 7-bit compatible format
const toGSM7Bit = (text: string): string => {
  return text.split('').map(char => {
    if (GSM_7BIT_CHARS.includes(char)) {
      return char;
    }
    const replacements: { [key: string]: string } = {
      '"': '"',
      "'": "'",
      '–': '-',
      '—': '-',
      '…': '...',
      '\u00A0': ' '
    };
    return replacements[char] || char;
  }).join('');
};

export const otpService = {
  generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  },

  formatPhoneNumber(phoneNumber: string): string {
    // Remove all non-digit characters
    let cleaned = phoneNumber.replace(/\D/g, '');
    
    // Handle different input formats
    if (cleaned.startsWith('880')) {
      cleaned = cleaned.substring(3);
    } else if (cleaned.startsWith('88')) {
      cleaned = cleaned.substring(2);
    }
    
    // Remove leading zero if present
    if (cleaned.startsWith('0')) {
      cleaned = cleaned.substring(1);
    }
    
    // Validate length (should be 10 digits)
    if (cleaned.length !== 10) {
      throw new Error('Invalid phone number format');
    }
    
    // Return in international format: +8801XXXXXXXXXX
    return `+8801${cleaned}`;
  },

  validatePhoneNumber(phoneNumber: string): boolean {
    try {
      const formatted = this.formatPhoneNumber(phoneNumber);
      // Check if it starts with +8801 and has exactly 14 characters
      if (!formatted.startsWith('+8801') || formatted.length !== 14) {
        return false;
      }
      
      // Check if the first digit after +8801 is valid (1,3,4,5,6,7,8,9)
      const firstDigit = formatted[5]; // Position after +8801
      return ['1', '3', '4', '5', '6', '7', '8', '9'].includes(firstDigit);
    } catch {
      return false;
    }
  },

  async sendOTP(
    phoneNumber: string, 
    purpose: 'registration' | 'password-reset' = 'registration',
    surname?: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const formattedPhone = this.formatPhoneNumber(phoneNumber);
      
      if (!this.validatePhoneNumber(phoneNumber)) {
        return { success: false, message: 'Invalid phone number format' };
      }

      // Check for existing OTP within the last minute (rate limiting)
      const otpCollection = collection(db, 'otp_verifications');
      const recentOTPQuery = query(
        otpCollection,
        where('phoneNumber', '==', formattedPhone),
        where('purpose', '==', purpose)
      );
      
      const recentOTPs = await getDocs(recentOTPQuery);
      
      const now = new Date();
      let hasRecentOTP = false;
      
      for (const doc of recentOTPs.docs) {
        const data = doc.data();
        const expiresAt = data.expiresAt.toDate();
        
        if (expiresAt < now) {
          await deleteDoc(doc.ref);
        } else {
          const createdAt = data.createdAt.toDate();
          const timeSinceCreation = (now.getTime() - createdAt.getTime()) / 1000;
          
          if (timeSinceCreation < 60) {
            hasRecentOTP = true;
          } else {
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
      
      // Save OTP to Firestore
      const expiresAt = new Date(now.getTime() + OTP_EXPIRY_MINUTES * 60 * 1000);
      const otpDoc = await addDoc(otpCollection, {
        phoneNumber: formattedPhone,
        otp,
        createdAt: Timestamp.fromDate(now),
        expiresAt: Timestamp.fromDate(expiresAt),
        attempts: 0,
        purpose
      });

      // Create SMS message based on purpose
      let message = '';
      
      if (purpose === 'registration') {
        message = `Your Ed-tech verification code is ${otp}. This code expires in 02 minutes. If you did not request this, please ignore.`;
      } else if (purpose === 'password-reset') {
        message = `Your Ed-tech password reset code is ${otp}. This code is valid for 02 minutes. Do not share this code with anyone.`;
      }
      
      // Convert to GSM 7-bit encoding
      message = toGSM7Bit(message);

      // Send SMS
      try {
        const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 
                           import.meta.env.VITE_API_URL ||
                           'https://edtech-dashboard-alpha.vercel.app';
        const MASTER_API_KEY = import.meta.env.VITE_SMS_MASTER_KEY;

        const requestBody: any = {
          phoneNumber: formattedPhone,
          message
        };

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

        if (!response.ok) {
          const errorText = await response.text();
          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch {
            errorData = { error: errorText || `Server error: ${response.status}` };
          }
          
          throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        if (!result.success) {
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
        console.error('SMS sending error:', smsError);
        await deleteDoc(otpDoc);
        
        let errorMessage = 'Failed to send SMS. ';
        
        if (smsError.message.includes('SMS service not configured')) {
          errorMessage += 'SMS service is not properly configured.';
        } else if (smsError.message.includes('Unauthorized')) {
          errorMessage += 'Authentication failed.';
        } else if (smsError.message.includes('Network') || smsError.message.includes('fetch')) {
          errorMessage += 'Network error. Please check your connection.';
        } else {
          errorMessage += 'Please try again later.';
        }
        
        return { 
          success: false, 
          message: errorMessage
        };
      }
    } catch (error: any) {
      console.error('Error in sendOTP:', error);
      return { 
        success: false, 
        message: error.message || 'Failed to send OTP. Please try again.' 
      };
    }
  },

  async sendRegistrationSuccessSMS(phoneNumber: string, surname: string, studentId: string): Promise<void> {
    try {
      const formattedPhone = this.formatPhoneNumber(phoneNumber);
      
      let message = `Dear ${surname}, Your registration on Ed-tech has been successfully completed. Student ID: ${studentId} We look forward to supporting your learning journey.`;
      
      // Convert to GSM 7-bit encoding
      message = toGSM7Bit(message);

      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 
                         import.meta.env.VITE_API_URL ||
                         'https://edtech-dashboard-alpha.vercel.app';
      const MASTER_API_KEY = import.meta.env.VITE_SMS_MASTER_KEY;

      const requestBody: any = {
        phoneNumber: formattedPhone,
        message
      };

      if (MASTER_API_KEY) {
        requestBody.apiKey = MASTER_API_KEY;
      }

      await fetch(`${BACKEND_URL}/api/sms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });
    } catch (error) {
      console.error('Failed to send registration success SMS:', error);
    }
  },

  async verifyOTP(phoneNumber: string, otp: string, purpose: 'registration' | 'password-reset' = 'registration'): Promise<{ success: boolean; message: string }> {
    try {
      const formattedPhone = this.formatPhoneNumber(phoneNumber);
      
      const otpCollection = collection(db, 'otp_verifications');
      const otpQuery = query(
        otpCollection,
        where('phoneNumber', '==', formattedPhone),
        where('purpose', '==', purpose)
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

      for (const doc of otpDocs.docs) {
        const data = doc.data();
        const expiresAt = data.expiresAt.toDate();
        
        if (expiresAt < now) {
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

      if (otpData.attempts >= MAX_OTP_ATTEMPTS) {
        await deleteDoc(otpDoc.ref);
        return { 
          success: false, 
          message: 'Too many failed attempts. Please request a new OTP.' 
        };
      }

      if (otpData.otp === otp) {
        await deleteDoc(otpDoc.ref);
        return { 
          success: true, 
          message: 'Phone number verified successfully' 
        };
      } else {
        const newAttempts = otpData.attempts + 1;
        
        if (newAttempts >= MAX_OTP_ATTEMPTS) {
          await deleteDoc(otpDoc.ref);
          return { 
            success: false, 
            message: 'Too many failed attempts. Please request a new OTP.' 
          };
        }
        
        await updateDoc(otpDoc.ref, { attempts: newAttempts });
        
        return { 
          success: false, 
          message: `Invalid OTP. ${MAX_OTP_ATTEMPTS - newAttempts} attempts remaining.` 
        };
      }
    } catch (error: any) {
      console.error('Error verifying OTP:', error);
      return { 
        success: false, 
        message: 'Failed to verify OTP. Please try again.' 
      };
    }
  },

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
      console.log(`Cleaned up ${deletePromises.length} expired OTPs`);
    } catch (error) {
      console.error('Error cleaning up expired OTPs:', error);
    }
  }
};
