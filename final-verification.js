// ================================================================
// AMCAG - FINAL ACCOUNT VERIFICATION & FIX
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

async function finalVerification() {
  console.log('\n===========================================');
  console.log('   FINAL ACCOUNT VERIFICATION');
  console.log('===========================================\n');
  
  const email = 'gabiondavidselorm@gmail.com';
  
  try {
    // Get user from Auth
    const userRecord = await auth.getUserByEmail(email);
    console.log('✓ Firebase Auth User Found');
    console.log(`  UID: ${userRecord.uid}`);
    console.log(`  Email: ${userRecord.email}`);
    console.log(`  Email Verified: ${userRecord.emailVerified}`);
    console.log(`  Disabled: ${userRecord.disabled}`);
    
    // Check custom claims
    console.log(`  Custom Claims: ${JSON.stringify(userRecord.customClaims || {})}`);
    
    // Update Firestore document with PERFECT configuration
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
    
    console.log('\n✓ Firestore Document Updated');
    
    // Set custom claims
    await auth.setCustomUserClaims(userRecord.uid, {
      role: 'super_admin',
      region: 'National'
    });
    
    console.log('✓ Custom Claims Updated');
    
    // Ensure email is verified and account is enabled
    await auth.updateUser(userRecord.uid, {
      emailVerified: true,
      disabled: false
    });
    
    console.log('✓ Auth Settings Updated');
    
    // Verify the update
    const updatedUserDoc = await db.collection('users').doc(userRecord.uid).get();
    const userData = updatedUserDoc.data();
    
    console.log('\n===========================================');
    console.log('   VERIFICATION COMPLETE!');
    console.log('===========================================');
    console.log('\nFirestore Profile:');
    console.log(`  Role: ${userData.role}`);
    console.log(`  Status: ${userData.status}`);
    console.log(`  Region: ${userData.region}`);
    console.log(`  Email Verified: ${userData.emailVerified}`);
    console.log(`  Full Name: ${userData.fullName}`);
    
    console.log('\n===========================================');
    console.log('   READY TO LOGIN!');
    console.log('===========================================');
    console.log('\n📋 LOGIN INSTRUCTIONS:');
    console.log('\n1. Open a NEW INCOGNITO/PRIVATE WINDOW');
    console.log('   (This is CRITICAL to avoid cached tokens)');
    console.log('\n2. Go to: https://amcag-website.web.app/membership.html');
    console.log('\n3. Login with:');
    console.log(`   Email: ${email}`);
    console.log('   Password: david@123');
    console.log('\n4. You will be redirected to National Dashboard');
    console.log('\n===========================================\n');
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
  } finally {
    process.exit();
  }
}

finalVerification();
