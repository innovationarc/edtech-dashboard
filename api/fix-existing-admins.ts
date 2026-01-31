import type { VercelRequest, VercelResponse } from '@vercel/node';
import admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.query.secret !== process.env.ADMIN_MIGRATION_SECRET) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  try {
    const snapshot = await db
      .collection('users')
      .where('role', '==', 'admin')
      .get();

    let fixed = 0;
    let skipped = 0;

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();

      const updates: any = {};

      if (!data.name) updates.name = data.fullName || 'Admin';
      if (!data.surname) updates.surname = data.fullName || 'Admin';
      if (!data.fullName)
        updates.fullName = `${updates.name || 'Admin'} ${updates.surname || ''}`.trim();

      if (Object.keys(updates).length === 0) {
        skipped++;
        continue;
      }

      await docSnap.ref.update(updates);
      fixed++;
    }

    return res.json({
      success: true,
      total: snapshot.size,
      fixed,
      skipped,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
