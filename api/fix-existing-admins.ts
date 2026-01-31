import type { VercelRequest, VercelResponse } from '@vercel/node';
import admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.trim().replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Secret check
  if (req.query.secret !== process.env.ADMIN_MIGRATION_SECRET) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  try {
    console.log('🔍 Searching for admin accounts...');
    const usersSnapshot = await db.collection('users').where('role', '==', 'admin').get();

    console.log(`✅ Found ${usersSnapshot.size} admin accounts`);

    let fixed = 0;
    let skipped = 0;

    for (const docSnap of usersSnapshot.docs) {
      const data = docSnap.data() || {};
      const docRef = docSnap.ref;

      // Safe log: userId may not exist
      console.log(`\n📝 Processing: ${data.surname || data.fullName || 'Unknown'} (${data.userId ?? 'N/A'})`);

      const updates: any = {};

      if (!data.name && (data.fullName || data.surname)) updates.name = data.fullName || data.surname;
      if (!data.surname && (data.fullName || data.name)) updates.surname = data.fullName || data.name;
      if (!data.fullName && (data.name || data.surname)) updates.fullName = `${data.name || ''} ${data.surname || ''}`.trim();

      // Skip empty updates to avoid Admin SDK crash
      if (Object.keys(updates).length === 0) {
        skipped++;
        continue;
      }

      await docRef.update(updates);
      console.log(`   ✅ Updated successfully`);
      fixed++;
    }

    console.log('\n✨ Migration complete!');
    console.log(`Fixed: ${fixed}, Skipped: ${skipped}, Total: ${usersSnapshot.size}`);

    return res.json({ success: true, total: usersSnapshot.size, fixed, skipped });
  } catch (err: any) {
    console.error('❌ Migration failed:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
