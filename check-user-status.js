const admin = require('firebase-admin');
const serviceAccount = require('./firebase-reset/serviceAccountKey.json.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkUserStatus() {
  try {
    const email = 'gabiondavidselorm@gmail.com';
    
    console.log('🔍 Checking user status for:', email);
    console.log('=====================================');
    
    // Get user from Auth
    const userRecord = await admin.auth().getUserByEmail(email);
    console.log('\n✅ Firebase Auth:');
    console.log('   UID:', userRecord.uid);
    console.log('   Email:', userRecord.email);
    console.log('   Email Verified:', userRecord.emailVerified);
    console.log('   Disabled:', userRecord.disabled);
    
    // Get user from Firestore
    const userDoc = await db.collection('users').doc(userRecord.uid).get();
    
    if (!userDoc.exists) {
      console.log('\n❌ ERROR: User document NOT FOUND in Firestore!');
      console.log('   This is the problem - user can authenticate but has no profile.');
      process.exit(1);
    }
    
    const userData = userDoc.data();
    console.log('\n✅ Firestore Document:');
    console.log('   Full Name:', userData.fullName);
    console.log('   Role:', userData.role);
    console.log('   Status:', userData.status);
    console.log('   Email:', userData.email);
    console.log('   Region:', userData.region);
    console.log('   Must Reset Password:', userData.mustResetPassword);
    console.log('   Created At:', userData.createdAt?.toDate());
    
    console.log('\n🔍 Status Check:');
    if (userData.status === 'approved' || userData.status === 'active') {
      console.log('   ✅ Status is valid:', userData.status);
    } else {
      console.log('   ❌ Status is INVALID:', userData.status);
      console.log('   Expected: "approved" or "active"');
    }
    
    console.log('\n🔍 Role Check:');
    if (userData.role === 'super_admin' || userData.role === 'national_executive') {
      console.log('   ✅ Role is valid for national dashboard:', userData.role);
    } else {
      console.log('   ❌ Role is INVALID for national dashboard:', userData.role);
      console.log('   Expected: "super_admin" or "national_executive"');
    }
    
    console.log('\n=====================================');
    console.log('✅ User check complete!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
  
  process.exit(0);
}

checkUserStatus();
