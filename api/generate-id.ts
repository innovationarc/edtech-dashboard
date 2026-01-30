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
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const idPrefix = `${prefix}-${year}${month}-`;

    console.log(`🔢 Generating ${role} ID with prefix:`, idPrefix);

    // Query for the highest number in current year-month for this role
    const usersQuery = await db.collection('users')
      .where('userId', '>=', idPrefix)
      .where('userId', '<', `${prefix}-${year}${month}-99999`)
      .where('role', '==', normalizedRole)
      .orderBy('userId', 'desc')
      .limit(1)
      .get();

    let nextNumber = 1;

    if (!usersQuery.empty) {
      const lastUserId = usersQuery.docs[0].data().userId;
      console.log(`📋 Last ${role} ID:`, lastUserId);
      
      const lastNumber = parseInt(lastUserId.split('-')[2]);
      if (!isNaN(lastNumber)) {
        nextNumber = lastNumber + 1;
      }
    }

    const userId = `${idPrefix}${nextNumber.toString().padStart(5, '0')}`;
    
    console.log(`✅ Generated ${role} ID:`, userId);

    return res.status(200).json({
      success: true,
      userId
    });

  } catch (error: any) {
    console.error('🔥 Generate ID error:', error);

    // Fallback: use timestamp-based ID
    const { role } = req.body as GenerateIdRequest;
    const normalizedRole = role?.toLowerCase() || 'unknown';
    const prefix = ROLE_PREFIXES[normalizedRole] || 'UN';
    
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const fallbackId = `${prefix}-${year}${month}-${Date.now().toString().slice(-5)}`;
    
    console.log('⚠️ Using fallback ID:', fallbackId);

    return res.status(200).json({
      success: true,
      userId: fallbackId
    });
  }
}
