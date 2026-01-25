// api/payment/internal/update/route.ts
// Internal API for updating transaction status from callback handler

import { NextRequest, NextResponse } from 'next/server';
import admin from 'firebase-admin';

// Initialize Firebase Admin
function initializeFirebase() {
  if (admin.apps && admin.apps.length > 0) {
    return admin.apps[0];
  }

  const serviceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  };

  return admin.initializeApp({
    credential: admin.credential.cert({
      projectId: serviceAccount.projectId,
      clientEmail: serviceAccount.clientEmail,
      privateKey: serviceAccount.privateKey,
    }),
  });
}

let firebaseApp: admin.app.App | null = null;
let db: admin.firestore.Firestore | null = null;

try {
  firebaseApp = initializeFirebase();
  db = firebaseApp.firestore();
} catch (error) {
  console.error('Firebase initialization error:', error);
}

export async function POST(req: NextRequest) {
  try {
    // Verify internal request
    const internalKey = req.headers.get('X-Internal-Key');
    const expectedKey = process.env.INTERNAL_API_KEY || 'dev-key';
    
    if (internalKey !== expectedKey) {
      console.error('❌ Unauthorized internal API call');
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { transactionId, status, metadata } = await req.json();

    if (!transactionId || !status) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (!db) {
      throw new Error('Firestore not initialized');
    }

    // Find transaction
    const snapshot = await db.collection('transactions')
      .where('transactionId', '==', transactionId)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return NextResponse.json(
        { success: false, error: 'Transaction not found' },
        { status: 404 }
      );
    }

    const docRef = snapshot.docs[0].ref;

    // Update transaction
    const updateData: any = {
      status,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    if (metadata) {
      if (metadata.validationId) updateData.validationId = metadata.validationId;
      if (metadata.paymentMethod) updateData.paymentMethod = metadata.paymentMethod;
      if (metadata.bankTransactionId) updateData.bankTransactionId = metadata.bankTransactionId;
      if (metadata.riskLevel) updateData.riskLevel = metadata.riskLevel;
      if (metadata.metadata) updateData.metadata = metadata;
    }

    if (status === 'success') {
      updateData.completedAt = admin.firestore.FieldValue.serverTimestamp();
    }

    await docRef.update(updateData);

    console.log('✅ Transaction updated:', transactionId, status);

    // If successful, create enrollment
    if (status === 'success') {
      const transactionData = snapshot.docs[0].data();
      
      if (transactionData.productType === 'course') {
        await createEnrollment(transactionData, metadata);
      }
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('❌ Internal update error:', error.message);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

async function createEnrollment(transaction: any, metadata: any) {
  try {
    if (!db) return;

    // Check if already enrolled
    const existingEnrollment = await db.collection('enrollments')
      .where('courseId', '==', transaction.productId)
      .where('studentId', '==', transaction.userId)
      .limit(1)
      .get();

    if (!existingEnrollment.empty) {
      console.log('ℹ️ Enrollment already exists');
      return;
    }

    const enrollmentData = {
      courseId: transaction.productId,
      studentId: transaction.userId,
      studentName: transaction.userName,
      studentEmail: transaction.userEmail,
      progress: 0,
      completedLessons: [],
      enrolledAt: admin.firestore.FieldValue.serverTimestamp(),
      lastAccessedAt: admin.firestore.FieldValue.serverTimestamp(),
      paymentStatus: 'completed',
      transactionId: transaction.transactionId,
      amountPaid: transaction.amount,
      paymentMethod: metadata?.paymentMethod || 'SSLCOMMERZ',
      paymentDate: admin.firestore.FieldValue.serverTimestamp(),
      appliedDiscounts: transaction.appliedDiscounts || {}
    };

    const enrollmentRef = await db.collection('enrollments').add(enrollmentData);
    console.log('✅ Enrollment created:', enrollmentRef.id);

    // Update course student count
    try {
      const courseRef = db.collection('courses').doc(transaction.productId);
      await courseRef.update({
        studentCount: admin.firestore.FieldValue.increment(1)
      });
    } catch (error) {
      console.warn('⚠️ Course count update failed');
    }

    // Add to content library
    try {
      await addCourseToLibrary(transaction.productId, transaction.userId);
    } catch (error) {
      console.warn('⚠️ Library addition failed');
    }

  } catch (error: any) {
    console.error('❌ Enrollment creation error:', error.message);
  }
}

async function addCourseToLibrary(courseId: string, studentId: string) {
  try {
    if (!db) return;

    const courseDoc = await db.collection('courses').doc(courseId).get();
    if (!courseDoc.exists) return;

    const course = courseDoc.data();

    const mainCourseEntry = {
      title: course?.title,
      description: course?.description,
      type: 'course',
      course: course?.title,
      category: course?.category,
      class: course?.class,
      subjects: course?.subjects || [],
      difficulty: course?.level || 'beginner',
      tags: [...(course?.tags || []), 'purchased-course', 'enrolled', 'full-course'],
      courseId: courseId,
      isFromCourse: true,
      accessLevel: 'full',
      duration: course?.duration,
      instructor: course?.instructor,
      thumbnail: course?.thumbnail,
      rating: course?.rating || 0,
      studentCount: course?.studentCount || 0,
      hasAiQnA: course?.hasAiQnA || false,
      hasHumanQnA: course?.hasHumanQnA || false,
      hasStudyPlanner: course?.hasStudyPlanner || false,
      createdBy: course?.instructorId,
      enrolledStudentId: studentId,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await db.collection('studentContent').add(mainCourseEntry);
    console.log('✅ Course added to library');
  } catch (error: any) {
    console.error('❌ Library addition error:', error.message);
  }
}
