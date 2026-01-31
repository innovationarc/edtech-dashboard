// /api/fix-existing-admins.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';

import { initializeApp, getApps } from 'firebase/app';
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  updateDoc,
  query,
  where
} from 'firebase/firestore';

// ⚠️ Use ENV variables in Vercel (recommended)
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY!,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.VITE_FIREBASE_APP_ID!
};

// Prevent re-initialization on hot reload
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // 🔒 Simple protection (VERY IMPORTANT)
  if (req.query.secret !== process.env.ADMIN_MIGRATION_SECRET) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  try {
    const usersCollection = collection(db, 'users');
    const adminQuery = query(usersCollection, where('role', '==', 'admin'));
    const adminsSnapshot = await getDocs(adminQuery);

    let fixed = 0;
    let skipped = 0;

    for (const adminDoc of adminsSnapshot.docs) {
      const data = adminDoc.data();
      const adminId = adminDoc.id;

      const needsFix = !data.name || !data.surname || !data.fullName;

      if (!needsFix) {
        skipped++;
        continue;
      }

      const updates: any = {};

      if (!data.name) {
        updates.name = data.fullName || data.surname || 'Admin';
      }

      if (!data.surname) {
        updates.surname = data.fullName || data.name || 'Admin';
      }

      if (!data.fullName) {
        updates.fullName = `${updates.name || data.name || 'Admin'} ${updates.surname || data.surname || ''}`.trim();
      }

      await updateDoc(doc(db, 'users', adminId), updates);
      fixed++;
    }

    return res.json({
      success: true,
      total: adminsSnapshot.size,
      fixed,
      skipped
    });

  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
