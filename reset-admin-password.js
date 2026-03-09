// ================================================================
// AMCAG - RESET ADMIN PASSWORD SCRIPT
// ================================================================
// Use this to reset the password for your admin account
// Usage: node reset-admin-password.js
// ================================================================

const admin = require('firebase-admin');
const readline = require('readline');

// Initialize Firebase Admin SDK
let serviceAccount;
try {
  serviceAccount = require('./functions/serviceAccountKey.json');
} catch (e) {
  try {
    serviceAccount = require('./firebase-reset/serviceAccountKey.json');
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

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function resetPassword() {
  console.log('\n===========================================');
  console.log('   RESET ADMIN PASSWORD');
  console.log('===========================================\n');
  
  try {
    const email = await question('Enter admin email: ');
    const newPassword = await question('Enter NEW password (min 8 characters): ');
    const confirmPassword = await question('Confirm NEW password: ');
    
    if (newPassword !== confirmPassword) {
      console.log('\n❌ Passwords do not match!\n');
      process.exit(1);
    }
    
    if (newPassword.length < 8) {
      console.log('\n❌ Password must be at least 8 characters!\n');
      process.exit(1);
    }
    
    console.log('\nResetting password...\n');
    
    const userRecord = await auth.getUserByEmail(email);
    
    await auth.updateUser(userRecord.uid, {
      password: newPassword
    });
    
    console.log('===========================================');
    console.log('   PASSWORD RESET SUCCESSFUL! ✓');
    console.log('===========================================');
    console.log(`\nEmail: ${email}`);
    console.log('Password: Updated');
    console.log(`\nYou can now login at: https://amcag-website.web.app/membership.html`);
    console.log('===========================================\n');
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
  } finally {
    rl.close();
    process.exit();
  }
}

resetPassword();
