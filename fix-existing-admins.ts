// fix-existing-admins.ts
// Run this script ONCE to fix all existing admin accounts
// Place this in your project root and run: npx ts-node fix-existing-admins.ts

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc, query, where } from 'firebase/firestore';

// Your Firebase config (copy from src/config/firebase.ts)
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function fixExistingAdmins() {
  try {
    console.log('🔍 Searching for admin accounts...');
    
    const usersCollection = collection(db, 'users');
    const adminQuery = query(usersCollection, where('role', '==', 'admin'));
    const adminsSnapshot = await getDocs(adminQuery);
    
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
        await updateDoc(doc(db, 'users', adminId), updates);
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
    
  } catch (error: any) {
    console.error('❌ Migration failed:', error);
    console.error('Error details:', error.message);
  }
}

// Run the migration
fixExistingAdmins();
