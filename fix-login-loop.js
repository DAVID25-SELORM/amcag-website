// ================================================================
// AMCAG - FIX LOGIN LOOP ISSUE
// ================================================================
// Usage:
//   node fix-login-loop.js <email>             # read-only diagnostics
//   node fix-login-loop.js <email> --apply     # apply fixes
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

const db = admin.firestore();

async function fixLoginLoop() {
  const email = process.argv[2];
  const applyFixes = process.argv.includes("--apply");

  if (!email) {
    console.log("Usage: node fix-login-loop.js <email> [--apply]");
    process.exit(1);
  }

  console.log("\n===========================================");
  console.log(`   FIX LOGIN LOOP (${applyFixes ? "APPLY" : "READ-ONLY"})`);
  console.log("===========================================\n");

  try {
    const auth = admin.auth();
    const userRecord = await auth.getUserByEmail(email);

    console.log("Checking user profile...\n");

    const userDoc = await db.collection("users").doc(userRecord.uid).get();
    if (!userDoc.exists) {
      console.log("ERROR: User profile not found in Firestore.");
      process.exit(1);
    }

    const userData = userDoc.data();

    console.log("Current profile data:");
    console.log(`  mustResetPassword: ${userData.mustResetPassword}`);
    console.log(`  status: ${userData.status}`);
    console.log(`  emailVerified: ${userData.emailVerified}`);
    console.log(`  role: ${userData.role}`);

    if (!applyFixes) {
      console.log("\nRead-only mode complete. No writes performed.");
      return;
    }

    console.log("\nApplying fixes...\n");

    // Remove problematic fields and ensure baseline setup
    await db.collection("users").doc(userRecord.uid).update({
      mustResetPassword: admin.firestore.FieldValue.delete(),
      status: "approved",
      emailVerified: true,
      role: "super_admin",
      region: "National",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log("Removed mustResetPassword flag");
    console.log("Set status to approved");
    console.log("Set emailVerified to true");
    console.log("Confirmed role as super_admin");
  } catch (error) {
    console.error("\nERROR:", error.message);
    process.exit(1);
  } finally {
    process.exit();
  }
}

fixLoginLoop();
