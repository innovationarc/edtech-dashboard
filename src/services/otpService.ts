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
    return true;
  } catch (error: any) {
    firestoreAvailable = false;
    return false;
  }
}

export const otpService = {
  generateOTP(): string {
    // Use crypto.getRandomValues for secure random number generation
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    const randomNum = array[0] % 900000 + 100000;
    return randomNum.toString();
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
      }
    }
  },

  async sendOTP(
    phoneNumber: string, 
    purpose: 'registration' | 'password-reset' | 'user-search' = 'registration',
    surname?: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const normalizedPhone = this.normalizePhoneNumber(phoneNumber);
      
      if (!this.validatePhoneNumber(phoneNumber)) {
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
                } else {
                  await deleteDoc(doc.ref);
                }
              }
            } catch (docError) {
              // Silent error handling for production
            }
          }
        } catch (firestoreError: any) {
          // Silent error handling for production
        }
      }

      // Check in-memory storage for recent OTP
      if (!hasRecentOTP && inMemoryOTPStore.has(otpKey)) {
        const stored = inMemoryOTPStore.get(otpKey)!;
        if (stored.expiresAt >= now) {
          const timeSinceCreation = (now.getTime() - stored.createdAt.getTime()) / 1000;
          if (timeSinceCreation < 60) {
            hasRecentOTP = true;
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
        } catch (firestoreError: any) {
          // Silent error handling for production
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

      // Prepare SMS message based on purpose using GSM_7BIT_EX format
      let message = '';
      
      switch (purpose) {
        case 'registration':
          message = toGSM7Bit(
            `Your Ed-tech verification code is ${otp}.\n` +
            `This code expires in 02 minutes.\n` +
            `If you didn't request this, please ignore.`
          );
          break;
          
        case 'password-reset':
          message = toGSM7Bit(
            `Your Ed-tech password reset code is ${otp}.\n` +
            `This code is valid for 02 minutes.\n` +
            `Do not share this code with anyone.`
          );
          break;
          
        case 'user-search':
          message = toGSM7Bit(
            `Your Ed-tech user search verification code is ${otp}.\n` +
            `This code is valid for 02 minutes.\n` +
            `If you didn't request this, please ignore.`
          );
          break;
      }

      // Send SMS via backend API
      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://api.edtech.com';
      const MASTER_API_KEY = import.meta.env.VITE_MASTER_API_KEY;

      const requestBody: any = {
        phoneNumber: normalizedPhone,
        message,
        encoding: 'GSM_7BIT_EX'
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
        throw new Error('SMS service unavailable');
      }

      return { 
        success: true, 
        message: 'OTP sent successfully' 
      };
    } catch (error: any) {
      return { 
        success: false, 
        message: 'Failed to send OTP. Please try again.' 
      };
    }
  },

  async sendRegistrationSuccessSMS(phoneNumber: string, surname: string, studentId: string): Promise<void> {
    try {
      const normalizedPhone = this.normalizePhoneNumber(phoneNumber);

      // Registration success message using GSM_7BIT_EX format
      const message = toGSM7Bit(
        `Dear ${surname},\n` +
        `Your registration on Ed-tech has been successfully completed.\n` +
        `Student ID: ${studentId}\n` +
        `We look forward to supporting your learning journey.`
      );

      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://api.edtech.com';
      const MASTER_API_KEY = import.meta.env.VITE_MASTER_API_KEY;

      const requestBody: any = {
        phoneNumber: normalizedPhone,
        message,
        encoding: 'GSM_7BIT_EX'
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
      // Silent error handling for production
    }
  },

  async verifyOTP(phoneNumber: string, otp: string, purpose: 'registration' | 'password-reset' | 'user-search' = 'registration'): Promise<{ success: boolean; message: string }> {
    try {
      const normalizedPhone = this.normalizePhoneNumber(phoneNumber);
      
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
                } else {
                  otpData = {
                    ...data,
                    docRef: doc.ref,
                    expiresAt
                  };
                  source = 'firestore';
                  break;
                }
              } catch (docError) {
                // Silent error handling for production
              }
            }
          }
        } catch (firestoreError: any) {
          // Silent error handling for production
        }
      }

      // Fallback to in-memory storage
      if (!otpData && inMemoryOTPStore.has(otpKey)) {
        const stored = inMemoryOTPStore.get(otpKey)!;
        
        if (stored.expiresAt < now) {
          inMemoryOTPStore.delete(otpKey);
        } else {
          otpData = stored;
          source = 'memory';
        }
      }

      // No OTP found
      if (!otpData) {
        return { 
          success: false, 
          message: 'No OTP found. Please request a new one.' 
        };
      }

      // Check if OTP has expired
      if (otpData.expiresAt < now) {
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
        if (source === 'firestore' && otpData.docRef) {
          try {
            await deleteDoc(otpData.docRef);
          } catch (e) {
            // Silent error handling for production
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
        // Delete OTP after successful verification
        if (source === 'firestore' && otpData.docRef) {
          try {
            await deleteDoc(otpData.docRef);
          } catch (deleteError) {
            // Silent error handling for production
          }
        }
        if (source === 'memory') {
          inMemoryOTPStore.delete(otpKey);
        }
        
        return { 
          success: true, 
          message: 'Phone number verified successfully' 
        };
      } else {
        const newAttempts = otpData.attempts + 1;
        
        if (newAttempts >= MAX_OTP_ATTEMPTS) {
          if (source === 'firestore' && otpData.docRef) {
            try {
              await deleteDoc(otpData.docRef);
            } catch (e) {
              // Silent error handling for production
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
          } catch (updateError) {
            // Silent error handling for production
          }
        }
        if (source === 'memory') {
          const stored = inMemoryOTPStore.get(otpKey);
          if (stored) {
            stored.attempts = newAttempts;
          }
        }
        
        return { 
          success: false, 
          message: `Invalid OTP. ${MAX_OTP_ATTEMPTS - newAttempts} attempts remaining.` 
        };
      }
    } catch (error: any) {
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
          // Silent error handling for production
        }
      }
      
      await Promise.allSettled(deletePromises);
    } catch (error) {
      // Silent error handling for production
    }
  }
};
