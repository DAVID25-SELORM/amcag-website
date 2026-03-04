// ================================================================
// AMCAG - SUPER ADMIN SETUP SCRIPT
// ================================================================
// Run this script ONCE to create the first super admin account
// Usage: node setup-super-admin.js
// ================================================================

const admin = require('firebase-admin');
const readline = require('readline');

// Initialize Firebase Admin SDK
// Try to load service account key from multiple locations
let serviceAccount;
try {
  serviceAccount = require('./functions/serviceAccountKey.json');
} catch (e) {
  try {
    serviceAccount = require('./firebase-reset/serviceAccountKey.json.json');
  } catch (e2) {
    console.error('\n❌ ERROR: Service account key not found!');
    console.log('\nPlease download your service account key from:');
    console.log('https://console.firebase.google.com/project/amcag-website/settings/serviceaccounts/adminsdk');
    console.log('\nClick "Generate new private key" and save as:');
    console.log('functions/serviceAccountKey.json\n');
    process.exit(1);
  }
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://amcag-website-default-rtdb.firebaseio.com"
});

const auth = admin.auth();
const db = admin.firestore();

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function createSuperAdmin() {
  console.log('\n===========================================');
  console.log('   AMCAG SUPER ADMIN ACCOUNT SETUP');
  console.log('===========================================\n');
  
  try {
    // Get admin details
    const email = await question('Enter super admin email: ');
    const password = await question('Enter password (min 8 characters): ');
    const fullName = await question('Enter full name: ');
    const phone = await question('Enter phone number (+233 XX XXX XXXX): ');
    
    console.log('\nCreating super admin account...\n');
    
    // Create user in Firebase Auth
    const userRecord = await auth.createUser({
      email: email,
      password: password,
      emailVerified: true, // Auto-verify super admin
      displayName: fullName
    });
    
    console.log(`✓ Firebase Auth user created: ${userRecord.uid}`);
    
    // Create user profile in Firestore
    await db.collection('users').doc(userRecord.uid).set({
      uid: userRecord.uid,
      email: email,
      fullName: fullName,
      phone: phone,
      region: 'National',
      role: 'super_admin',
      status: 'approved',
      emailVerified: true,
      registrationDate: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log('✓ Firestore user profile created');
    
    // Set custom claims
    await auth.setCustomUserClaims(userRecord.uid, {
      role: 'super_admin',
      region: 'National'
    });
    
    console.log('✓ Custom claims set');
    
    console.log('\n===========================================');
    console.log('   SUPER ADMIN CREATED SUCCESSFULLY! ✓');
    console.log('===========================================');
    console.log(`\nEmail: ${email}`);
    console.log(`Role: Super Admin`);
    console.log(`Status: Approved & Verified`);
    console.log(`\nYou can now login at: https://amcag-website.web.app/membership.html`);
    console.log('===========================================\n');
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    
    if (error.code === 'auth/email-already-exists') {
      console.log('\nThis email already exists. Promoting existing user to super admin...\n');
      
      try {
        const userRecord = await auth.getUserByEmail(await question('Enter existing email: '));
        
        // Update user profile
        await db.collection('users').doc(userRecord.uid).update({
          role: 'super_admin',
          status: 'approved',
          emailVerified: true,
          region: 'National',
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        // Set custom claims
        await auth.setCustomUserClaims(userRecord.uid, {
          role: 'super_admin',
          region: 'National'
        });
        
        console.log('✓ User promoted to super admin successfully!');
        
      } catch (updateError) {
        console.error('❌ Failed to promote user:', updateError.message);
      }
    }
  } finally {
    rl.close();
    process.exit();
  }
}

// Run the script
createSuperAdmin();
