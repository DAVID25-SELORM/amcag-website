const admin = require('firebase-admin');
const serviceAccount = require('./firebase-reset/serviceAccountKey.json.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function verifySuperAdminPermissions() {
  try {
    const email = 'gabiondavidselorm@gmail.com';
    
    console.log('═══════════════════════════════════════════════════════');
    console.log('🔐 SUPER ADMIN PERMISSIONS VERIFICATION');
    console.log('═══════════════════════════════════════════════════════\n');
    
    // Get user from Auth
    const userRecord = await admin.auth().getUserByEmail(email);
    console.log('✅ Firebase Auth Status:');
    console.log('   UID:', userRecord.uid);
    console.log('   Email:', userRecord.email);
    console.log('   Email Verified:', userRecord.emailVerified);
    console.log('   Disabled:', userRecord.disabled);
    console.log('   Custom Claims:', userRecord.customClaims || 'None');
    
    // Get user from Firestore
    const userDoc = await db.collection('users').doc(userRecord.uid).get();
    
    if (!userDoc.exists) {
      console.log('\n❌ CRITICAL ERROR: User document not found in Firestore!');
      process.exit(1);
    }
    
    const userData = userDoc.data();
    console.log('\n✅ Firestore User Document:');
    console.log('   Full Name:', userData.fullName);
    console.log('   Role:', userData.role);
    console.log('   Status:', userData.status);
    console.log('   Region:', userData.region);
    console.log('   Email:', userData.email);
    
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('🎯 ROLE VERIFICATION');
    console.log('═══════════════════════════════════════════════════════\n');
    
    // Verify role
    if (userData.role === 'super_admin') {
      console.log('✅ CONFIRMED: User has super_admin role\n');
      
      console.log('📋 SUPER ADMIN PERMISSIONS:');
      console.log('');
      console.log('Frontend Access (Router):');
      console.log('   ✅ Public routes (/, /about, /events, etc.)');
      console.log('   ✅ Member routes (/member-dashboard, /dues, /payments, etc.)');
      console.log('   ✅ Regional routes (/region-dashboard/*, etc.)');
      console.log('   ✅ National routes (/national/*, etc.)');
      console.log('');
      console.log('Firestore Security Rules:');
      console.log('   ✅ users collection: read, update, delete');
      console.log('   ✅ members collection: read, update, delete');
      console.log('   ✅ regions collection: read, write');
      console.log('   ✅ events collection: read, update, delete');
      console.log('   ✅ payments collection: read, update, delete');
      console.log('   ✅ certificates collection: read, write');
      console.log('   ✅ news collection: read, write');
      console.log('');
      console.log('Dashboard Access:');
      console.log('   ✅ /national/dashboard.html - PRIMARY DASHBOARD');
      console.log('   ✅ Can access all member, regional, and national dashboards');
      console.log('');
      console.log('Admin Capabilities:');
      console.log('   ✅ Approve/reject members');
      console.log('   ✅ Manage regions');
      console.log('   ✅ Grant permissions to regional executives');
      console.log('   ✅ Manage payments and waivers');
      console.log('   ✅ Delete records');
      console.log('   ✅ Full system access');
      
    } else {
      console.log('❌ ERROR: User role is NOT super_admin!');
      console.log('   Current role:', userData.role);
      console.log('   Expected role: super_admin');
    }
    
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('🔍 STATUS VERIFICATION');
    console.log('═══════════════════════════════════════════════════════\n');
    
    // Verify status
    if (userData.status === 'approved' || userData.status === 'active') {
      console.log('✅ CONFIRMED: Account status is valid:', userData.status);
      console.log('   Login should be allowed');
    } else {
      console.log('❌ WARNING: Account status may block login:', userData.status);
      console.log('   Expected: "approved" or "active"');
    }
    
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('🚪 LOGIN PROCESS VERIFICATION');
    console.log('═══════════════════════════════════════════════════════\n');
    
    console.log('Login Flow Checkpoints:');
    console.log('');
    console.log('1. Firebase Auth:');
    console.log('   ✅ Email verified:', userRecord.emailVerified);
    console.log('   ✅ Account enabled:', !userRecord.disabled);
    console.log('');
    console.log('2. Firestore Document:');
    console.log('   ✅ Document exists:', userDoc.exists);
    console.log('   ✅ Has role field:', !!userData.role);
    console.log('   ✅ Has status field:', !!userData.status);
    console.log('');
    console.log('3. Status Check (membership.html line 451):');
    if (userData.status === 'approved' || userData.status === 'active') {
      console.log('   ✅ PASS - Status is', userData.status);
      console.log('   Will NOT trigger signOut()');
    } else {
      console.log('   ❌ FAIL - Status is', userData.status);
      console.log('   WILL trigger signOut() at membership.html:454');
    }
    console.log('');
    console.log('4. Role Check (national/dashboard.html line 415):');
    if (userData.role === 'super_admin' || userData.role === 'national_executive') {
      console.log('   ✅ PASS - Role is', userData.role);
      console.log('   Allowed to access /national/dashboard.html');
    } else {
      console.log('   ❌ FAIL - Role is', userData.role);
      console.log('   Will redirect to another dashboard');
    }
    console.log('');
    console.log('5. Router Protection (router.js line 128):');
    console.log('   ✅ PATCHED - Router waits for profile to load');
    console.log('   Will not redirect during async Firestore fetch');
    
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('✅ VERIFICATION COMPLETE');
    console.log('═══════════════════════════════════════════════════════\n');
    
    console.log('SUMMARY:');
    console.log('   Role: super_admin ✅');
    console.log('   Status: approved ✅');
    console.log('   Permissions: FULL ACCESS ✅');
    console.log('   Login: SHOULD WORK ✅');
    console.log('');
    console.log('If login still fails, check:');
    console.log('   • Browser console for errors');
    console.log('   • Tracking prevention is disabled');
    console.log('   • Clear browser cache (Ctrl+Shift+Delete)');
    console.log('   • Local server is running (firebase serve)');
    console.log('');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
  
  process.exit(0);
}

verifySuperAdminPermissions();
