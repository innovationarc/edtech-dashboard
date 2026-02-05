// api/create-user.ts
// Universal user creation endpoint for ALL roles
// Supports: Admin, Student, Teacher, Manager, Student Manager, Course Manager, Parent, Coordinator
// 
// IMPORTANT: Only userId must be unique (enforced by generate-id.ts)
// Multiple accounts CAN share the same phone number, email, or other fields
// This allows one person to have multiple role accounts (e.g., parent + teacher)
import type { VercelRequest, VercelResponse } from '@vercel/node';
import admin from 'firebase-admin';

interface CreateUserRequest {
  // Required fields
  role: 'admin' | 'student' | 'teacher' | 'manager' | 'student_manager' | 'course_manager' | 'parent' | 'coordinator';
  surname: string;
  phoneNumber: string;
  password: string;
  
  // Optional fields
  fullName?: string;
  email?: string; // Custom email (optional, will be auto-generated if not provided)
  dob?: string;
  gender?: 'male' | 'female' | 'other';
  bloodGroup?: 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';
  religion?: string;
  address?: string;
  birthCertificateNumber?: string;
  nid?: string;
  status?: 'active' | 'inactive' | 'pending';
  profilePictureUrl?: string;
  
  // Metadata
  createdBy?: string; // UID of creator
  createdByUserId?: string; // User ID of creator
  createdByRole?: string; // Role of creator
  
  // API authentication
  apiKey?: string;
}

interface CreateUserResponse {
  success: boolean;
  userId?: string;
  uid?: string;
  email?: string;
  message?: string;
  error?: string;
}

// Role prefix mapping (must match generate-id.ts)
const ROLE_PREFIXES: Record<string, string> = {
  admin: 'AD',
  student: 'ST',
  coordinator: 'CR',
  parent: 'PR',
  teacher: 'TC',
  'course-manager': 'CM',
  'course_manager': 'CM',
  'student-manager': 'SM',
  'student_manager': 'SM',
  manager: 'MG'
};

// Role display names
const ROLE_DISPLAY_NAMES: Record<string, string> = {
  admin: 'Admin',
  student: 'Student',
  coordinator: 'Coordinator',
  parent: 'Parent',
  teacher: 'Teacher',
  course_manager: 'Course Manager',
  student_manager: 'Student Manager',
  manager: 'Manager'
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
      console.log('✅ Firebase Admin initialized');
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

    console.log('✅ Firebase Admin initialized');
  } catch (error: any) {
    console.error('❌ Firebase Admin initialization error:', error.message);
    throw error;
  }
}

// Normalize role to match our system (handle hyphens and underscores)
function normalizeRole(role: string): string {
  const normalized = role.toLowerCase().replace(/-/g, '_');
  
  // Validate it's a valid role
  const validRoles = ['admin', 'student', 'teacher', 'manager', 'student_manager', 'course_manager', 'parent', 'coordinator'];
  
  if (!validRoles.includes(normalized)) {
    throw new Error(`Invalid role: ${role}. Valid roles are: ${validRoles.join(', ')}`);
  }
  
  return normalized;
}

// Normalize phone number to 13-digit format: 8801XXXXXXXXX
function normalizePhoneNumber(phoneNumber: string): string {
  if (!phoneNumber || phoneNumber.trim() === '') {
    throw new Error('Phone number is required');
  }

  // Remove all non-digit characters
  let cleaned = phoneNumber.replace(/\D/g, '');
  
  // If already 13 digits starting with 880, it's already normalized
  if (cleaned.length === 13 && cleaned.startsWith('880')) {
    return cleaned;
  }
  
  // Remove 880 prefix if present (to reprocess)
  if (cleaned.startsWith('880')) {
    cleaned = cleaned.substring(3);
  } 
  // Remove 88 prefix if present
  else if (cleaned.startsWith('88')) {
    cleaned = cleaned.substring(2);
  }
  
  // Case 1: 11-digit number starting with 0 (01XXXXXXXXX)
  if (cleaned.length === 11 && cleaned.startsWith('0')) {
    return `880${cleaned.substring(1)}`;
  }
  
  // Case 2: 10-digit number starting with 1 (1XXXXXXXXX)
  if (cleaned.length === 10 && cleaned.startsWith('1')) {
    return `880${cleaned}`;
  }
  
  // If we have 10 digits starting with 0, remove it
  if (cleaned.length === 10 && cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }
  
  // After processing, should have 10 digits starting with 1 or 9 digits
  if (cleaned.length === 10 && cleaned.startsWith('1')) {
    return `880${cleaned}`;
  }
  
  if (cleaned.length === 9) {
    return `8801${cleaned}`;
  }
  
  throw new Error('Invalid phone number format. Please enter a valid Bangladesh phone number.');
}

// Validate password strength
function validatePasswordStrength(password: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (password.length < 6) {
    errors.push('Password must be at least 6 characters long');
  }
  
  // For stronger passwords (recommended but not enforced for admins)
  if (password.length < 8) {
    errors.push('Password should be at least 8 characters for better security');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password should include at least one uppercase letter');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password should include at least one lowercase letter');
  }
  
  if (!/[0-9]/.test(password)) {
    errors.push('Password should include at least one number');
  }
  
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password should include at least one special character');
  }
  
  // Minimum requirement: at least 6 characters
  const isValid = password.length >= 6;
  
  return { isValid, errors };
}

// Generate User ID by calling generate-id API
async function generateUserId(role: string, apiKey?: string): Promise<string> {
  try {
    const BACKEND_URL = process.env.BACKEND_URL || 
                       process.env.FRONTEND_URL || 
                       'https://edtech-dashboard-alpha.vercel.app';
    
    const requestBody: any = {
      role: role
    };
    
    if (apiKey) {
      requestBody.apiKey = apiKey;
    }
    
    const response = await fetch(`${BACKEND_URL}/api/generate-id`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to generate user ID: ${errorText}`);
    }
    
    const result = await response.json();
    
    if (!result.success || !result.userId) {
      throw new Error('Failed to generate user ID');
    }
    
    return result.userId;
  } catch (error: any) {
    console.error('❌ Error generating user ID:', error);
    throw new Error('Failed to generate unique user ID. Please try again.');
  }
}

// Check if phone number already exists
async function phoneNumberExists(db: admin.firestore.Firestore, phoneNumber: string): Promise<boolean> {
  try {
    const query = await db.collection('users')
      .where('phoneNumber', '==', phoneNumber)
      .limit(1)
      .get();
    
    return !query.empty;
  } catch (error) {
    console.error('Error checking phone number existence:', error);
    return false;
  }
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse<CreateUserResponse>
) {
  // Set CORS headers
  const allowedOrigins = [
    process.env.FRONTEND_URL || 'http://localhost:5173',
    process.env.BACKEND_URL || 'https://edtech-dashboard-alpha.vercel.app',
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
    'Content-Type, X-API-Key, Authorization'
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
    console.log('🆕 Create user request received');
    console.log('📦 Raw request body:', JSON.stringify(req.body, null, 2));

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

    // Parse request body - handle multiple formats for backward compatibility
    let requestData: any = {};
    
    // Format 1: adminService.ts format with nested userData
    if (req.body.userData) {
      console.log('📋 Detected adminService format (nested userData)');
      requestData = {
        ...req.body.userData,
        role: req.body.role,
        password: req.body.password,
        email: req.body.email,
        apiKey: req.body.apiKey
      };
    } 
    // Format 2: Direct CreateUserRequest format
    else {
      console.log('📋 Detected direct format');
      requestData = req.body;
    }

    console.log('📋 Parsed request data:', {
      role: requestData.role,
      surname: requestData.surname,
      phoneNumber: requestData.phoneNumber ? '***' + requestData.phoneNumber.slice(-4) : undefined,
      hasPassword: !!requestData.password
    });

    const {
      role,
      surname,
      phoneNumber,
      password,
      fullName,
      email: customEmail,
      dob,
      gender,
      bloodGroup,
      religion,
      address,
      birthCertificateNumber,
      nid,
      status,
      profilePictureUrl,
      createdBy,
      createdByUserId,
      createdByRole,
      apiKey,
      userId: providedUserId // Allow pre-generated userId from adminService
    } = requestData;

    console.log('📋 Extracted fields:', {
      role,
      surname,
      phoneNumber: phoneNumber ? '***' : undefined,
      hasPassword: !!password,
      fullName,
      providedUserId,
      apiKey: apiKey ? '***' : undefined
    });

    // Validate API Key (optional but recommended)
    const MASTER_API_KEY = process.env.SMS_MASTER_KEY;
    if (MASTER_API_KEY && apiKey !== MASTER_API_KEY) {
      console.error('❌ Unauthorized request - invalid API key');
      return res.status(401).json({
        success: false,
        error: 'Unauthorized request',
      });
    }

    // Validate required fields
    if (!role) {
      console.error('❌ Validation failed: Role is missing');
      console.error('Request body:', req.body);
      return res.status(400).json({
        success: false,
        error: 'Role is required'
      });
    }

    if (!surname || surname.trim() === '') {
      console.error('❌ Validation failed: Surname is missing or empty');
      console.error('Surname value:', surname);
      console.error('Request body:', req.body);
      return res.status(400).json({
        success: false,
        error: 'Surname is required'
      });
    }

    if (!phoneNumber) {
      console.error('❌ Validation failed: Phone number is missing');
      return res.status(400).json({
        success: false,
        error: 'Phone number is required'
      });
    }

    if (!password) {
      console.error('❌ Validation failed: Password is missing');
      return res.status(400).json({
        success: false,
        error: 'Password is required'
      });
    }

    // Normalize role
    let normalizedRole: string;
    try {
      normalizedRole = normalizeRole(role);
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    console.log(`📋 Creating ${normalizedRole} account for: ${surname}`);

    // Normalize phone number
    let normalizedPhone: string;
    try {
      normalizedPhone = normalizePhoneNumber(phoneNumber);
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    // Validate password
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        success: false,
        error: passwordValidation.errors[0] || 'Password does not meet requirements'
      });
    }

    const db = admin.firestore();

    // NOTE: We do NOT check for duplicate phone numbers, emails, etc.
    // Only userId must be unique (enforced by generate-id.ts)
    // Multiple accounts can share the same phone number or email
    console.log('ℹ️ Skipping duplicate phone/email checks - only userId must be unique');

    // Generate User ID using generate-id API (or use provided userId)
    console.log('🔢 Generating user ID...');
    let userId: string;
    
    if (providedUserId) {
      // Use pre-generated userId from adminService.ts
      console.log('✅ Using provided user ID:', providedUserId);
      userId = providedUserId;
    } else {
      // Generate new userId
      try {
        userId = await generateUserId(normalizedRole, apiKey);
        console.log(`✅ Generated user ID: ${userId}`);
      } catch (error: any) {
        console.error('❌ Failed to generate user ID:', error);
        return res.status(500).json({
          success: false,
          error: 'Failed to generate unique user ID. Please try again.'
        });
      }
    }

    // Generate email in format: userid@role.local
    // Example: ST-2601-00012@student.local, AD-2601-29293@admin.local
    const roleForEmail = normalizedRole.replace(/_/g, '-'); // Convert underscores to hyphens for email
    let generatedEmail: string;
    
    // Check if customEmail is already in auth format (userid@role.local)
    if (customEmail && customEmail.includes('@') && customEmail.includes('.local')) {
      // Use the provided auth email directly
      generatedEmail = customEmail;
      console.log('📧 Using provided auth email:', generatedEmail);
    } else if (customEmail) {
      // Custom email provided but not in auth format - use it as custom email, generate auth email
      generatedEmail = `${userId.toLowerCase()}@${roleForEmail}.local`;
      console.log('📧 Generated auth email:', generatedEmail);
      console.log('📧 Custom email stored separately:', customEmail);
    } else {
      // No custom email - generate auth email
      generatedEmail = `${userId.toLowerCase()}@${roleForEmail}.local`;
      console.log('📧 Generated auth email:', generatedEmail);
    }

    // Create Firebase Auth user
    console.log('🔐 Creating Firebase Auth user...');
    let authUser: admin.auth.UserRecord;
    try {
      authUser = await admin.auth().createUser({
        email: generatedEmail,
        password: password,
        emailVerified: false,
        disabled: false
      });
      console.log(`✅ Firebase Auth user created with UID: ${authUser.uid}`);
    } catch (authError: any) {
      console.error('❌ Firebase Auth creation error:', authError);
      
      // Handle specific error cases
      if (authError.code === 'auth/email-already-exists') {
        // This should never happen since emails are userid@role.local and userId is unique
        // If it does happen, there's a critical issue with ID generation
        console.error('🚨 CRITICAL: Email conflict despite unique userId!', generatedEmail);
        return res.status(500).json({
          success: false,
          error: 'Critical error: Email conflict. Please contact system administrator.'
        });
      }
      
      if (authError.code === 'auth/invalid-email') {
        return res.status(400).json({
          success: false,
          error: 'Invalid email format'
        });
      }
      
      if (authError.code === 'auth/weak-password') {
        return res.status(400).json({
          success: false,
          error: 'Password is too weak'
        });
      }
      
      return res.status(500).json({
        success: false,
        error: `Failed to create authentication account: ${authError.message}`
      });
    }

    // Create Firestore user document
    console.log('📝 Creating Firestore user document...');
    try {
      const userDoc: any = {
        userId: userId,
        surname: surname.trim(),
        fullName: fullName?.trim() || surname.trim(),
        name: fullName?.trim() || surname.trim(), // For backward compatibility
        email: generatedEmail, // Auth email (userid@role.local)
        phoneNumber: normalizedPhone,
        role: normalizedRole,
        status: status || 'active',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: createdBy || 'system',
        createdByUserId: createdByUserId || 'system',
        createdByRole: createdByRole || 'system',
        // Optional fields
        ...(dob && { dob }),
        ...(gender && { gender }),
        ...(bloodGroup && { bloodGroup }),
        ...(religion && { religion }),
        ...(address && { address }),
        ...(birthCertificateNumber && { birthCertificateNumber }),
        ...(nid && { nid }),
        ...(profilePictureUrl && { profilePictureUrl })
      };
      
      // If customEmail was provided and it's NOT an auth email, store it separately
      if (customEmail && !customEmail.includes('.local')) {
        userDoc.customEmail = customEmail;
      }

      await db.collection('users').doc(authUser.uid).set(userDoc);
      console.log('✅ Firestore user document created');
    } catch (firestoreError: any) {
      console.error('❌ Firestore creation error:', firestoreError);
      
      // Rollback: Delete the auth user we just created
      try {
        await admin.auth().deleteUser(authUser.uid);
        console.log('🔄 Rolled back Firebase Auth user');
      } catch (deleteError) {
        console.error('❌ Failed to rollback auth user:', deleteError);
      }
      
      return res.status(500).json({
        success: false,
        error: 'Failed to create user profile. Please try again.'
      });
    }

    // Log successful creation
    console.log(`✅ ${ROLE_DISPLAY_NAMES[normalizedRole]} account created successfully`);
    console.log(`   User ID: ${userId}`);
    console.log(`   UID: ${authUser.uid}`);
    console.log(`   Phone: ${normalizedPhone}`);
    console.log(`   Email: ${generatedEmail}`);

    return res.status(201).json({
      success: true,
      userId: userId,
      uid: authUser.uid,
      email: generatedEmail,
      message: `${ROLE_DISPLAY_NAMES[normalizedRole]} account created successfully`
    });

  } catch (error: any) {
    console.error('🔥 Create user error:', error);

    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
}
