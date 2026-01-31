// /api/fix-existing-admins.ts
// Run this API route ONCE to fix all existing admin accounts
// Call from browser: https://your-app.vercel.app/api/fix-existing-admins?secret=YOUR_SECRET

import type { VercelRequest, VercelResponse } from '@vercel/node';
import admin from 'firebase-admin';

// Initialize Firebase Admin SDK safely
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
  // 🔒 Secret check to prevent accidental runs
  if (req.query.secret !== process.env.ADMIN_MIGRATION_SECRET) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  try {
    console.log('🔍 Searching for admin accounts...');

    const usersCollection = db.collection('users');
    const adminQuery = usersCollection.where('role', '==', 'admin');
    const adminsSnapshot = await adminQuery.get();

    console.log(`✅ Found ${adminsSnapshot.size} admin accounts`);

    let fixed = 0;
    let skipped = 0;

    for (const adminDoc of adminsSnapshot.docs) {
      const adminData = adminDoc.data();
      const adminId = adminDoc.id;

      console.log(`\n📝 Processing: ${adminData.surname || adminData.fullName || 'Unknown'} (${adminData.userId})`);

      // Check if admin needs fixing
      const needsFix = !adminData.name || !adminData.surname;

      if (!needsFix) {
        console.log(`   ✓ Already has required fields - skipping`);
        skipped++;
        continue;
      }

      // Prepare update data
      const updates: any = {};

      // Fix missing 'name' field
      if (!adminData.name) {
        updates.name = adminData.fullName || adminData.surname || 'Admin';
        console.log(`   📌 Adding name: ${updates.name}`);
      }

      // Fix missing 'surname' field
      if (!adminData.surname) {
        updates.surname = adminData.fullName || adminData.name || 'Admin';
        console.log(`   📌 Adding surname: ${updates.surname}`);
      }

      // Fix missing 'fullName' field
      if (!adminData.fullName) {
        updates.fullName = adminData.surname || adminData.name || 'Admin';
        console.log(`   📌 Adding fullName: ${updates.fullName}`);
      }

      // Apply updates
      if (Object.keys(updates).length > 0) {
        await db.collection('users').doc(adminId).update(updates);
        console.log(`   ✅ Updated successfully`);
        fixed++;
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('📊 Migration Summary:');
    console.log(`   ✅ Fixed: ${fixed} admins`);
    console.log(`   ⏭️  Skipped: ${skipped} admins (already correct)`);
    console.log(`   📝 Total: ${adminsSnapshot.size} admins`);
    console.log('='.repeat(50));
    console.log('\n✨ Migration complete! All admin accounts should now work correctly.');

    return res.json({
      success: true,
      total: adminsSnapshot.size,
      fixed,
      skipped,
    });
  } catch (error: any) {
    console.error('❌ Migration failed:', error);
    console.error('Error details:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
}
