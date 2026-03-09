// ================================================================
// AMCAG - VERIFY ADMIN ACCOUNT SCRIPT
// ================================================================
// Usage:
//   node verify-admin.js <email>             # read-only verification
//   node verify-admin.js <email> --apply     # apply fixes
// ================================================================

const admin = require("firebase-admin");

let serviceAccount;
try {
  serviceAccount = require("./functions/serviceAccountKey.json");
} catch (e) {
  try {
    serviceAccount = require("./firebase-reset/serviceAccountKey.json");
  } catch (e2) {
    console.error("\nERROR: Service account key not found.\n");
    process.exit(1);
  }
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://amcag-website-default-rtdb.firebaseio.com",
});

const auth = admin.auth();
const db = admin.firestore();

async function verifyAndFixAdmin() {
  const email = process.argv[2];
  const applyFixes = process.argv.includes("--apply");

  if (!email) {
    console.log("Usage: node verify-admin.js <email> [--apply]");
    process.exit(1);
  }

  console.log("\n===========================================");
  console.log(`   VERIFY ADMIN ACCOUNT (${applyFixes ? "APPLY" : "READ-ONLY"})`);
  console.log("===========================================\n");

  try {
    // Get user from Auth
    const userRecord = await auth.getUserByEmail(email);
    console.log("Found user in Firebase Auth");
    console.log(`  UID: ${userRecord.uid}`);
    console.log(`  Email: ${userRecord.email}`);
    console.log(`  Email Verified: ${userRecord.emailVerified}`);
    console.log(`  Disabled: ${userRecord.disabled}`);
    console.log(`  Custom Claims: ${JSON.stringify(userRecord.customClaims || {})}`);

    // Get user from Firestore
    const userDoc = await db.collection("users").doc(userRecord.uid).get();
    if (userDoc.exists) {
      const userData = userDoc.data();
      console.log("\nFound user in Firestore");
      console.log(`  Role: ${userData.role}`);
      console.log(`  Status: ${userData.status}`);
      console.log(`  Region: ${userData.region}`);
      console.log(`  Full Name: ${userData.fullName}`);
    } else {
      console.log("\nWARNING: User not found in Firestore.");
    }

    if (!applyFixes) {
      console.log("\nRead-only mode complete. No writes performed.");
      return;
    }

    console.log("\nApplying fixes...\n");

    // Update Firestore profile
    await db.collection("users").doc(userRecord.uid).set(
      {
        uid: userRecord.uid,
        email: email,
        region: "National",
        role: "super_admin",
        status: "approved",
        emailVerified: true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    // Set custom claims
    await auth.setCustomUserClaims(userRecord.uid, {
      role: "super_admin",
      region: "National",
    });

    // Verify email
    await auth.updateUser(userRecord.uid, {
      emailVerified: true,
      disabled: false,
    });

    console.log("Fixes applied successfully.");
  } catch (error) {
    console.error("\nERROR:", error.message);
    process.exit(1);
  } finally {
    process.exit();
  }
}

verifyAndFixAdmin();
