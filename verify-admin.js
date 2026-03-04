// ================================================================
// AMCAG - VERIFY ADMIN ACCOUNT SCRIPT
// ================================================================
// Check and fix admin account status
// Usage: node verify-admin.js
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

const auth = admin.auth();
const db = admin.firestore();

async function verifyAndFixAdmin() {
  console.log('\n===========================================');
  console.log('   VERIFY & FIX ADMIN ACCOUNT');
  console.log('===========================================\n');
  
  const email = 'gabiondavidselorm@gmail.com';
  
  try {
    // Get user from Auth
    const userRecord = await auth.getUserByEmail(email);
    console.log('✓ Found user in Firebase Auth');
    console.log(`  UID: ${userRecord.uid}`);
    console.log(`  Email: ${userRecord.email}`);
    console.log(`  Email Verified: ${userRecord.emailVerified}`);
    
    // Check custom claims
    if (userRecord.customClaims) {
      console.log(`  Custom Claims: ${JSON.stringify(userRecord.customClaims)}`);
    } else {
      console.log('  Custom Claims: None');
    }
    
    // Get user from Firestore
    const userDoc = await db.collection('users').doc(userRecord.uid).get();
    
    if (userDoc.exists) {
      const userData = userDoc.data();
      console.log('\n✓ Found user in Firestore');
      console.log(`  Role: ${userData.role}`);
      console.log(`  Status: ${userData.status}`);
      console.log(`  Region: ${userData.region}`);
      console.log(`  Full Name: ${userData.fullName}`);
    } else {
      console.log('\n⚠️  User NOT found in Firestore - Creating now...');
    }
    
    // Fix/Update everything
    console.log('\n🔧 Applying fixes...\n');
    
    // Update Firestore profile
    await db.collection('users').doc(userRecord.uid).set({
      uid: userRecord.uid,
      email: email,
      fullName: 'David Selorm Gabion',
      phone: '+233 24 765 4381',
      region: 'National',
      role: 'super_admin',
      status: 'approved',
      emailVerified: true,
      registrationDate: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    
    console.log('✓ Firestore profile updated');
    
    // Set custom claims
    await auth.setCustomUserClaims(userRecord.uid, {
      role: 'super_admin',
      region: 'National'
    });
    
    console.log('✓ Custom claims set');
    
    // Verify email
    await auth.updateUser(userRecord.uid, {
      emailVerified: true
    });
    
    console.log('✓ Email verified');
    
    console.log('\n===========================================');
    console.log('   ACCOUNT VERIFICATION COMPLETE! ✓');
    console.log('===========================================');
    console.log('\nAccount Details:');
    console.log(`  Email: ${email}`);
    console.log(`  Role: super_admin`);
    console.log(`  Status: approved`);
    console.log(`  Region: National`);
    console.log(`  Email Verified: true`);
    console.log('\n⚠️  IMPORTANT: You must LOG OUT and LOG IN AGAIN');
    console.log('   for custom claims to take effect!');
    console.log('\nLogin at: https://amcag-website.web.app/membership.html');
    console.log('===========================================\n');
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
  } finally {
    process.exit();
  }
}

verifyAndFixAdmin();
