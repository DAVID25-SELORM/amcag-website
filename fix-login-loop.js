// ================================================================
// AMCAG - FIX LOGIN LOOP ISSUE
// ================================================================

const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
let serviceAccount;
try {
  serviceAccount = require('./functions/serviceAccountKey.json');
} catch (e) {
  try {
    serviceAccount = require('./firebase-reset/serviceAccountKey.json.json');
  } catch (e2) {
    console.error('\n❌ ERROR: Service account key not found!\n');
    process.exit(1);
  }
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://amcag-website-default-rtdb.firebaseio.com"
});

const db = admin.firestore();

async function fixLoginLoop() {
  console.log('\n===========================================');
  console.log('   FIX LOGIN LOOP ISSUE');
  console.log('===========================================\n');
  
  const email = 'gabiondavidselorm@gmail.com';
  
  try {
    const auth = admin.auth();
    const userRecord = await auth.getUserByEmail(email);
    
    console.log('Checking user profile...\n');
    
    const userDoc = await db.collection('users').doc(userRecord.uid).get();
    const userData = userDoc.data();
    
    console.log('Current profile data:');
    console.log(`  mustResetPassword: ${userData.mustResetPassword}`);
    console.log(`  status: ${userData.status}`);
    console.log(`  emailVerified: ${userData.emailVerified}`);
    console.log(`  role: ${userData.role}`);
    
    console.log('\n🔧 Applying fixes...\n');
    
    // Remove any problematic fields and ensure proper setup
    await db.collection('users').doc(userRecord.uid).update({
      mustResetPassword: admin.firestore.FieldValue.delete(),
      status: 'approved',
      emailVerified: true,
      role: 'super_admin',
      region: 'National',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log('✓ Removed mustResetPassword flag');
    console.log('✓ Set status to approved');
    console.log('✓ Set emailVerified to true');
    console.log('✓ Confirmed role as super_admin');
    
    console.log('\n===========================================');
    console.log('   FIX COMPLETE! ✓');
    console.log('===========================================');
    console.log('\n⚠️  Now do the following:');
    console.log('   1. Clear your browser cookies/cache OR open incognito window');
    console.log('   2. Go to: https://amcag-website.web.app/membership.html');
    console.log('   3. Login with your credentials');
    console.log('   4. You should be redirected to National Dashboard');
    console.log('\n===========================================\n');
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
  } finally {
    process.exit();
  }
}

fixLoginLoop();
