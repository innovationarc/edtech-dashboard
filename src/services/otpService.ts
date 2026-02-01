// src/services/otpService.ts
import { collection, query, where, getDocs, addDoc, deleteDoc, Timestamp, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

interface OTPRecord {
  phoneNumber: string;
  otp: string;
  createdAt: Date;
  expiresAt: Date;
  attempts: number;
  purpose: 'registration' | 'password-reset' | 'user-search';
}

// In-memory OTP storage as fallback when Firestore fails
const inMemoryOTPStore = new Map<string, {
  otp: string;
  createdAt: Date;
  expiresAt: Date;
  attempts: number;
  purpose: 'registration' | 'password-reset' | 'user-search';
}>();

const OTP_EXPIRY_MINUTES = 2;
const MAX_OTP_ATTEMPTS = 3;
const OTP_LENGTH = 6;

// GSM 7-bit character set - extended
const GSM_7BIT_BASIC = "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ\x1BÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
const GSM_7BIT_EXTENDED = "^{}\\[~]|€";

// Convert text to GSM 7-bit compatible format
const toGSM7Bit = (text: string): string => {
  return text.split('').map(char => {
    if (GSM_7BIT_BASIC.includes(char) || GSM_7BIT_EXTENDED.includes(char)) {
      return char;
    }
    
    const replacements: { [key: string]: string } = {
      '"': '"',
      '"': '"',
      "'": "'",
      "'": "'",
      '–': '-',
      '—': '-',
      '…': '...',
      '\u00A0': ' ',
      '•': '*',
      '→': '->',
      '←': '<-',
      '™': '(TM)',
      '©': '(C)',
      '®': '(R)',
    };
    
    return replacements[char] || char;
  }).join('');
};

// Check if Firestore is accessible
let firestoreAvailable = true;
let lastFirestoreCheck = 0;
const FIRESTORE_CHECK_INTERVAL = 60000; // 1 minute

async function checkFirestoreAccess(): Promise<boolean> {
  const now = Date.now();
  
  // Only check every minute to avoid excessive checks
  if (now - lastFirestoreCheck < FIRESTORE_CHECK_INTERVAL) {
    return firestoreAvailable;
  }
  
  lastFirestoreCheck = now;
  
  try {
    const testCollection = collection(db, 'otp_verifications');
    const testQuery = query(testCollection, where('phoneNumber', '==', 'test_access_check'));
    await getDocs(testQuery);
    firestoreAvailable = true;
    console.log('✅ Firestore access: Available');
    return true;
  } catch (error: any) {
    console.warn('⚠️ Firestore access: Unavailable, using in-memory storage', error.code || error.message);
    firestoreAvailable = false;
    return false;
  }
}

export const otpService = {
  generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  },

  /**
   * Normalize phone number to 880XXXXXXXXXX format (13 digits, no + sign)
   */
  normalizePhoneNumber(phoneNumber: string): string {
    let cleaned = phoneNumber.replace(/\D/g, '');
    
    if (cleaned.startsWith('880')) {
      cleaned = cleaned.substring(3);
    } else if (cleaned.startsWith('88')) {
      cleaned = cleaned.substring(2);
    }
    
    if (cleaned.startsWith('0')) {
      cleaned = cleaned.substring(1);
    }
    
    if (cleaned.length !== 10) {
      throw new Error('Invalid phone number format');
    }
    
    return `880${cleaned}`;
  },

  validatePhoneNumber(phoneNumber: string): boolean {
    try {
      const normalized = this.normalizePhoneNumber(phoneNumber);
      
      if (!normalized.startsWith('880') || normalized.length !== 13) {
        return false;
      }
      
      const firstDigit = normalized[3];
      return ['1', '3', '4', '5', '6', '7', '8', '9'].includes(firstDigit);
    } catch {
      return false;
    }
  },

  formatForDisplay(phoneNumber: string): string {
    const normalized = this.normalizePhoneNumber(phoneNumber);
    return `+${normalized}`;
  },

  // Clean up expired in-memory OTPs
  cleanupInMemoryOTPs() {
    const now = new Date();
    for (const [key, value] of inMemoryOTPStore.entries()) {
      if (value.expiresAt < now) {
        inMemoryOTPStore.delete(key);
        console.log('🧹 Cleaned up expired in-memory OTP for:', key.substring(0, 10) + '...');
      }
    }
  },

  async sendOTP(
    phoneNumber: string, 
    purpose: 'registration' | 'password-reset' | 'user-search' = 'registration',
    surname?: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      console.log('📤 Sending OTP - Purpose:', purpose);
      
      const normalizedPhone = this.normalizePhoneNumber(phoneNumber);
      console.log('📱 Normalized phone:', normalizedPhone.substring(0, 5) + '****' + normalizedPhone.substring(normalizedPhone.length - 2));
      
      if (!this.validatePhoneNumber(phoneNumber)) {
        console.error('❌ Invalid phone number format');
        return { success: false, message: 'Invalid phone number format' };
      }

      // Clean up expired in-memory OTPs
      this.cleanupInMemoryOTPs();

      // Check Firestore availability
      const hasFirestore = await checkFirestoreAccess();
      
      const now = new Date();
      const otpKey = `${normalizedPhone}_${purpose}`;
      let hasRecentOTP = false;

      // Check for recent OTP (rate limiting)
      if (hasFirestore) {
        try {
          const otpCollection = collection(db, 'otp_verifications');
          const recentOTPQuery = query(
            otpCollection,
            where('phoneNumber', '==', normalizedPhone),
            where('purpose', '==', purpose)
          );
          
          const recentOTPs = await getDocs(recentOTPQuery);
          
          for (const doc of recentOTPs.docs) {
            try {
              const data = doc.data();
              const expiresAt = data.expiresAt.toDate();
              
              if (expiresAt < now) {
                await deleteDoc(doc.ref);
              } else {
                const createdAt = data.createdAt.toDate();
                const timeSinceCreation = (now.getTime() - createdAt.getTime()) / 1000;
                
                if (timeSinceCreation < 60) {
                  hasRecentOTP = true;
                  console.log('⏱️ Recent OTP found in Firestore');
                } else {
                  await deleteDoc(doc.ref);
                }
              }
            } catch (docError) {
              console.warn('⚠️ Error processing OTP doc:', docError);
            }
          }
        } catch (firestoreError: any) {
          console.warn('⚠️ Firestore check failed, checking in-memory:', firestoreError.code || firestoreError.message);
        }
      }

      // Check in-memory storage for recent OTP
      if (!hasRecentOTP && inMemoryOTPStore.has(otpKey)) {
        const stored = inMemoryOTPStore.get(otpKey)!;
        if (stored.expiresAt >= now) {
          const timeSinceCreation = (now.getTime() - stored.createdAt.getTime()) / 1000;
          if (timeSinceCreation < 60) {
            hasRecentOTP = true;
            console.log('⏱️ Recent OTP found in memory');
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
      console.log('🔐 OTP generated');
      
      const expiresAt = new Date(now.getTime() + OTP_EXPIRY_MINUTES * 60 * 1000);
      
      // Store OTP in both Firestore (if available) and in-memory
      let storedInFirestore = false;
      
      if (hasFirestore) {
        try {
          const otpCollection = collection(db, 'otp_verifications');
          await addDoc(otpCollection, {
            phoneNumber: normalizedPhone,
            otp,
            createdAt: Timestamp.fromDate(now),
            expiresAt: Timestamp.fromDate(expiresAt),
            attempts: 0,
            purpose
          });
          storedInFirestore = true;
          console.log('💾 OTP stored in Firestore');
        } catch (firestoreError: any) {
          console.warn('⚠️ Failed to store OTP in Firestore:', firestoreError.code || firestoreError.message);
        }
      }
      
      // Always store in memory as backup
      inMemoryOTPStore.set(otpKey, {
        otp,
        createdAt: now,
        expiresAt,
        attempts: 0,
        purpose
      });
      console.log('💾 OTP stored in memory');

      // Send SMS
      try {
        let message = '';
        
        // Customize message based on purpose
        if (purpose === 'registration') {
          message = surname 
            ? `Welcome ${surname}! Your Ed-tech registration OTP is ${otp}. Valid for 2 minutes.`
            : `Your Ed-tech registration OTP is ${otp}. Valid for 2 minutes.`;
        } else if (purpose === 'password-reset') {
          message = `Your Ed-tech password reset OTP is ${otp}. Valid for 2 minutes.`;
        } else if (purpose === 'user-search') {
          message = `Your Ed-tech user search OTP is ${otp}. Valid for 2 minutes.`;
        }

        const gsmMessage = toGSM7Bit(message);
        
        console.log('📤 Sending SMS...');
        console.log('📝 Message length:', gsmMessage.length);

        const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 
                           import.meta.env.VITE_API_URL ||
                           'https://edtech-dashboard-alpha.vercel.app';
        const MASTER_API_KEY = import.meta.env.VITE_SMS_MASTER_KEY;

        const requestBody: any = {
          phoneNumber: normalizedPhone,
          message: gsmMessage
        };

        if (MASTER_API_KEY) {
          requestBody.apiKey = MASTER_API_KEY;
        }

        const smsResponse = await fetch(`${BACKEND_URL}/api/sms`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody)
        });

        if (!smsResponse.ok) {
          const errorText = await smsResponse.text();
          console.error('❌ SMS API error:', errorText);
          
          // Even if SMS fails, OTP is still valid (stored in Firestore/memory)
          return {
            success: true,
            message: `OTP generated but SMS delivery failed. OTP: ${otp} (expires in 2 min)`
          };
        }

        const smsResult = await smsResponse.json();
        
        if (smsResult.success) {
          console.log('✅ SMS sent successfully');
          return {
            success: true,
            message: `Verification code sent to ${this.formatForDisplay(normalizedPhone)}`
          };
        } else {
          console.error('❌ SMS send failed:', smsResult.error);
          return {
            success: true,
            message: `OTP generated but SMS delivery failed. OTP: ${otp} (expires in 2 min)`
          };
        }
      } catch (smsError: any) {
        console.error('❌ SMS sending error:', smsError.message);
        return {
          success: true,
          message: `OTP generated but SMS delivery failed. OTP: ${otp} (expires in 2 min)`
        };
      }
    } catch (error: any) {
      console.error('❌ Error in sendOTP:', error.message);
      return {
        success: false,
        message: 'Failed to generate OTP. Please try again.'
      };
    }
  },

  async sendRegistrationSuccessSMS(phoneNumber: string, userId: string, surname: string): Promise<void> {
    try {
      const normalizedPhone = this.normalizePhoneNumber(phoneNumber);
      
      const message = `Congratulations ${surname}! Registration successful. Your Student ID: ${userId}. Please save this ID for future logins.`;
      const gsmMessage = toGSM7Bit(message);
      
      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 
                         import.meta.env.VITE_API_URL ||
                         'https://edtech-dashboard-alpha.vercel.app';
      const MASTER_API_KEY = import.meta.env.VITE_SMS_MASTER_KEY;

      const requestBody: any = {
        phoneNumber: normalizedPhone,
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

      if (response.ok) {
        console.log('✅ Registration success SMS sent');
      } else {
        console.error('❌ Failed to send registration success SMS');
      }
    } catch (error) {
      console.error('❌ Error sending registration success SMS:', error);
    }
  },

  async verifyOTP(phoneNumber: string, otp: string, purpose: 'registration' | 'password-reset' | 'user-search' = 'registration'): Promise<{ success: boolean; message: string }> {
    try {
      console.log('🔍 Verifying OTP - Purpose:', purpose);
      
      const normalizedPhone = this.normalizePhoneNumber(phoneNumber);
      console.log('📱 Normalized phone:', normalizedPhone.substring(0, 5) + '****' + normalizedPhone.substring(normalizedPhone.length - 2));
      
      const otpKey = `${normalizedPhone}_${purpose}`;
      const now = new Date();

      // Clean up expired in-memory OTPs
      this.cleanupInMemoryOTPs();

      // Check Firestore availability
      const hasFirestore = await checkFirestoreAccess();
      
      let otpData: any = null;
      let source: 'firestore' | 'memory' = 'memory';

      // Try Firestore first if available
      if (hasFirestore) {
        try {
          console.log('🔍 Checking Firestore for OTP...');
          const otpCollection = collection(db, 'otp_verifications');
          const otpQuery = query(
            otpCollection,
            where('phoneNumber', '==', normalizedPhone),
            where('purpose', '==', purpose)
          );
          
          const otpDocs = await getDocs(otpQuery);
          
          if (!otpDocs.empty) {
            for (const doc of otpDocs.docs) {
              try {
                const data = doc.data();
                const expiresAt = data.expiresAt.toDate();
                
                if (expiresAt < now) {
                  await deleteDoc(doc.ref);
                  console.log('🗑️ Deleted expired OTP from Firestore');
                } else {
                  otpData = {
                    ...data,
                    docRef: doc.ref,
                    expiresAt
                  };
                  source = 'firestore';
                  console.log('✅ Found valid OTP in Firestore');
                  break;
                }
              } catch (docError) {
                console.warn('⚠️ Error processing OTP document:', docError);
              }
            }
          }
        } catch (firestoreError: any) {
          console.warn('⚠️ Firestore verification failed, checking in-memory:', firestoreError.code || firestoreError.message);
        }
      }

      // Fallback to in-memory storage
      if (!otpData && inMemoryOTPStore.has(otpKey)) {
        console.log('🔍 Checking in-memory storage for OTP...');
        const stored = inMemoryOTPStore.get(otpKey)!;
        
        if (stored.expiresAt < now) {
          inMemoryOTPStore.delete(otpKey);
          console.log('🗑️ Deleted expired OTP from memory');
        } else {
          otpData = stored;
          source = 'memory';
          console.log('✅ Found valid OTP in memory');
        }
      }

      // No OTP found
      if (!otpData) {
        console.log('❌ No valid OTP found');
        return { 
          success: false, 
          message: 'No OTP found. Please request a new one.' 
        };
      }

      // Check if OTP has expired
      if (otpData.expiresAt < now) {
        console.log('❌ OTP has expired');
        if (source === 'memory') {
          inMemoryOTPStore.delete(otpKey);
        }
        return { 
          success: false, 
          message: 'OTP has expired. Please request a new one.' 
        };
      }

      // Check max attempts
      if (otpData.attempts >= MAX_OTP_ATTEMPTS) {
        console.log('❌ Max OTP attempts exceeded');
        if (source === 'firestore' && otpData.docRef) {
          try {
            await deleteDoc(otpData.docRef);
          } catch (e) {
            console.warn('⚠️ Failed to delete OTP after max attempts');
          }
        }
        if (source === 'memory') {
          inMemoryOTPStore.delete(otpKey);
        }
        return { 
          success: false, 
          message: 'Too many failed attempts. Please request a new OTP.' 
        };
      }

      // Verify OTP
      if (otpData.otp === otp) {
        console.log('✅ OTP verified successfully');
        
        // Delete OTP after successful verification
        if (source === 'firestore' && otpData.docRef) {
          try {
            await deleteDoc(otpData.docRef);
            console.log('🗑️ Deleted verified OTP from Firestore');
          } catch (deleteError) {
            console.warn('⚠️ Failed to delete OTP after verification');
          }
        }
        if (source === 'memory') {
          inMemoryOTPStore.delete(otpKey);
          console.log('🗑️ Deleted verified OTP from memory');
        }
        
        return { 
          success: true, 
          message: 'Phone number verified successfully' 
        };
      } else {
        console.log('❌ Invalid OTP entered');
        const newAttempts = otpData.attempts + 1;
        
        if (newAttempts >= MAX_OTP_ATTEMPTS) {
          if (source === 'firestore' && otpData.docRef) {
            try {
              await deleteDoc(otpData.docRef);
            } catch (e) {
              console.warn('⚠️ Failed to delete OTP after max attempts');
            }
          }
          if (source === 'memory') {
            inMemoryOTPStore.delete(otpKey);
          }
          return { 
            success: false, 
            message: 'Too many failed attempts. Please request a new OTP.' 
          };
        }
        
        // Update attempts
        if (source === 'firestore' && otpData.docRef) {
          try {
            await updateDoc(otpData.docRef, { attempts: newAttempts });
            console.log('📝 Updated attempt count in Firestore');
          } catch (updateError) {
            console.warn('⚠️ Failed to update attempts in Firestore');
          }
        }
        if (source === 'memory') {
          const stored = inMemoryOTPStore.get(otpKey);
          if (stored) {
            stored.attempts = newAttempts;
            console.log('📝 Updated attempt count in memory');
          }
        }
        
        return { 
          success: false, 
          message: `Invalid OTP. ${MAX_OTP_ATTEMPTS - newAttempts} attempts remaining.` 
        };
      }
    } catch (error: any) {
      console.error('❌ Error verifying OTP:', error.message);
      return { 
        success: false, 
        message: 'Failed to verify OTP. Please try again.' 
      };
    }
  },

  async cleanupExpiredOTPs(): Promise<void> {
    try {
      // Clean up in-memory OTPs
      this.cleanupInMemoryOTPs();
      
      // Clean up Firestore OTPs if available
      const hasFirestore = await checkFirestoreAccess();
      if (!hasFirestore) {
        console.log('⚠️ Skipping Firestore cleanup - not available');
        return;
      }

      const otpCollection = collection(db, 'otp_verifications');
      const allOTPs = await getDocs(otpCollection);
      
      const now = new Date();
      const deletePromises = [];
      
      for (const doc of allOTPs.docs) {
        try {
          const data = doc.data();
          const expiresAt = data.expiresAt.toDate();
          
          if (expiresAt < now) {
            deletePromises.push(deleteDoc(doc.ref));
          }
        } catch (docError) {
          console.warn('⚠️ Error processing OTP document during cleanup:', docError);
        }
      }
      
      await Promise.allSettled(deletePromises);
      console.log(`🧹 Cleaned up ${deletePromises.length} expired OTPs from Firestore`);
    } catch (error) {
      console.error('❌ Error cleaning up expired OTPs:', error);
    }
  }
};
