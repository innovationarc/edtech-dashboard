// api/generate-id.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import admin from 'firebase-admin';

interface GenerateIdRequest {
  role: string;
  apiKey?: string;
}

interface GenerateIdResponse {
  success: boolean;
  userId?: string;
  error?: string;
}

// Role prefix mapping
const ROLE_PREFIXES: Record<string, string> = {
  admin: 'AD',
  student: 'ST',
  coordinator: 'CR',
  parent: 'PR',
  teacher: 'TC',
  'course-manager': 'CM',
  'student-manager': 'SM',
  manager: 'MG'
};

// Initialize Firebase Admin SDK
function initializeFirebaseAdmin() {
  if (admin.apps.length > 0) {
    return;
  }

  try {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
    
    if (serviceAccountJson) {
      const serviceAccount = JSON.parse(serviceAccountJson);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      return;
    }

    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (!projectId || !clientEmail || !privateKey) {
      throw new Error('Missing Firebase credentials');
    }

    privateKey = privateKey.replace(/\\n/g, '\n').replace(/^["']|["']$/g, '');

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
  } catch (error: any) {
    console.error('❌ Firebase Admin initialization error:', error.message);
    throw error;
  }
}

// Helper function to check if a userId already exists
async function userIdExists(db: admin.firestore.Firestore, userId: string): Promise<boolean> {
  try {
    const query = await db.collection('users')
      .where('userId', '==', userId)
      .limit(1)
      .get();
    
    return !query.empty;
  } catch (error) {
    console.error('Error checking userId existence:', error);
    return false;
  }
}

// Helper function to get the highest serial number for a prefix across all months
async function getHighestSerialNumber(db: admin.firestore.Firestore, prefix: string): Promise<number> {
  try {
    console.log(`🔍 Searching for highest serial number with prefix: ${prefix}`);
    
    // Query all users with this prefix, ordered by userId descending
    // This will get the latest user ID regardless of month
    const query = await db.collection('users')
      .where('userId', '>=', `${prefix}-`)
      .where('userId', '<', `${prefix}.`)  // Using '.' as it comes after '-' in ASCII
      .orderBy('userId', 'desc')
      .limit(100)  // Get top 100 to ensure we find the highest number
      .get();

    if (query.empty) {
      console.log(`📋 No existing users found with prefix ${prefix}`);
      return 0;
    }

    let highestNumber = 0;

    // Parse all returned IDs to find the highest serial number
    query.docs.forEach(doc => {
      const userId = doc.data().userId;
      // Format: PREFIX-YYMM-XXXXX
      const parts = userId.split('-');
      
      if (parts.length === 3) {
        const serialNumber = parseInt(parts[2]);
        if (!isNaN(serialNumber) && serialNumber > highestNumber) {
          highestNumber = serialNumber;
          console.log(`📋 Found user ID: ${userId} with serial: ${serialNumber}`);
        }
      }
    });

    console.log(`✅ Highest serial number for ${prefix}: ${highestNumber}`);
    return highestNumber;
  } catch (error) {
    console.error('Error getting highest serial number:', error);
    return 0;
  }
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse<GenerateIdResponse>
) {
  // Set CORS headers
  const allowedOrigins = [
    process.env.FRONTEND_URL || 'http://localhost:5173',
    'https://edtech-dashboard-alpha.vercel.app',
    'http://localhost:3000',
    'http://localhost:5174'
  ];

  const origin = req.headers.origin || '';
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, X-API-Key'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  }

  try {
    // Initialize Firebase Admin
    try {
      initializeFirebaseAdmin();
    } catch (initError: any) {
      console.error('🔥 Firebase initialization failed:', initError.message);
      return res.status(500).json({
        success: false,
        error: 'Firebase Admin configuration error',
      });
    }

    const { role, apiKey } = req.body as GenerateIdRequest;

    // Validate role
    if (!role) {
      return res.status(400).json({
        success: false,
        error: 'Role is required'
      });
    }

    const normalizedRole = role.toLowerCase();
    const prefix = ROLE_PREFIXES[normalizedRole];

    if (!prefix) {
      return res.status(400).json({
        success: false,
        error: `Invalid role: ${role}. Valid roles are: ${Object.keys(ROLE_PREFIXES).join(', ')}`
      });
    }

    // Optional: Validate API Key
    const MASTER_API_KEY = process.env.SMS_MASTER_KEY;
    if (MASTER_API_KEY && apiKey !== MASTER_API_KEY) {
      console.error('❌ Unauthorized request');
      return res.status(401).json({
        success: false,
        error: 'Unauthorized request',
      });
    }

    const db = admin.firestore();
    
    // Generate User ID format: PREFIX-YYMM-XXXXX
    // YYMM represents creation date, XXXXX is a global sequential number for this prefix
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const yearMonth = `${year}${month}`;

    console.log(`🔢 Generating ${role} ID with prefix: ${prefix}-${yearMonth}-`);

    // Use a global counter per prefix (not per month)
    const counterRef = db.collection('counters').doc(prefix);
    
    let userId: string = '';
    let maxRetries = 10;
    let retryCount = 0;
    
    while (retryCount < maxRetries) {
      try {
        // Use Firestore transaction for atomic increment
        const generatedId = await db.runTransaction(async (transaction) => {
          const counterDoc = await transaction.get(counterRef);
          
          let nextNumber = 1;
          
          if (counterDoc.exists) {
            const currentCount = counterDoc.data()?.count || 0;
            nextNumber = currentCount + 1;
          } else {
            // First time initialization - check existing users
            console.log('🔄 Initializing counter for prefix:', prefix);
            const highestSerial = await getHighestSerialNumber(db, prefix);
            nextNumber = highestSerial + 1;
            console.log(`📊 Starting from serial number: ${nextNumber}`);
          }
          
          // Generate the user ID with current year-month but global serial number
          const proposedUserId = `${prefix}-${yearMonth}-${nextNumber.toString().padStart(5, '0')}`;
          
          // Check if this ID already exists
          const existsCheck = await userIdExists(db, proposedUserId);
          
          if (existsCheck) {
            console.warn(`⚠️ ID ${proposedUserId} already exists! Incrementing counter...`);
            // If ID exists, increment and try again
            transaction.set(counterRef, {
              count: nextNumber,
              prefix: prefix,
              lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
              skippedDuplicate: true
            }, { merge: true });
            
            throw new Error('DUPLICATE_ID_FOUND');
          }
          
          // Update the global counter for this prefix
          transaction.set(counterRef, {
            count: nextNumber,
            prefix: prefix,
            lastGenerated: proposedUserId,
            lastYearMonth: yearMonth,
            lastUpdated: admin.firestore.FieldValue.serverTimestamp()
          }, { merge: true });
          
          return proposedUserId;
        });
        
        userId = generatedId;
        console.log(`✅ Generated unique ${role} ID:`, userId);
        
        // Double-check one more time before returning
        const finalCheck = await userIdExists(db, userId);
        if (finalCheck) {
          console.error(`🚨 CRITICAL: Generated ID ${userId} already exists despite checks!`);
          retryCount++;
          continue;
        }
        
        return res.status(200).json({
          success: true,
          userId
        });
        
      } catch (transactionError: any) {
        if (transactionError.message === 'DUPLICATE_ID_FOUND') {
          console.log(`🔄 Retry ${retryCount + 1}/${maxRetries}: Duplicate found, trying next number...`);
          retryCount++;
          continue;
        }
        
        console.error('🔥 Transaction error:', transactionError);
        
        // Fallback: Get highest serial number and increment
        console.log('⚠️ Using fallback method');
        
        const highestSerial = await getHighestSerialNumber(db, prefix);
        const nextNumber = highestSerial + 1;
        
        userId = `${prefix}-${yearMonth}-${nextNumber.toString().padStart(5, '0')}`;
        
        // Check for duplicates in fallback method too
        const fallbackCheck = await userIdExists(db, userId);
        if (fallbackCheck) {
          console.error(`🚨 Fallback ID ${userId} already exists!`);
          retryCount++;
          continue;
        }
        
        console.log(`✅ Generated ${role} ID (fallback):`, userId);

        return res.status(200).json({
          success: true,
          userId
        });
      }
    }
    
    // If we've exhausted all retries
    throw new Error('Failed to generate unique ID after maximum retries');

  } catch (error: any) {
    console.error('🔥 Generate ID error:', error);

    return res.status(500).json({
      success: false,
      error: 'Failed to generate unique user ID. Please try again.',
    });
  }
}
