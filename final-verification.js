// ================================================================
// AMCAG - FINAL ACCOUNT VERIFICATION (READ-ONLY)
// ================================================================

const admin = require("firebase-admin");

let serviceAccount;
try {
  serviceAccount = require("./functions/serviceAccountKey.json");
} catch (e) {
  try {
    serviceAccount = require("./firebase-reset/serviceAccountKey.json");
  } catch (e2) {
    console.log("\nWARNING: Service account key not found.");
    console.log("Expected one of:");
    console.log(" - ./functions/serviceAccountKey.json");
    console.log(" - ./firebase-reset/serviceAccountKey.json");
    console.log("Skipping verification in this environment.\n");
    process.exit(0);
  }
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://amcag-website-default-rtdb.firebaseio.com",
});

const auth = admin.auth();
const db = admin.firestore();

async function runReadOnlyVerification() {
  const email = process.argv[2];

  if (!email) {
    console.log("No email argument provided.");
    console.log("Usage: node final-verification.js <email>");
    console.log("Skipping user verification (read-only script).");
    return;
  }

  console.log("\n===========================================");
  console.log("   FINAL ACCOUNT VERIFICATION (READ-ONLY)");
  console.log("===========================================\n");

  const userRecord = await auth.getUserByEmail(email);
  console.log("Firebase Auth user found");
  console.log(`  UID: ${userRecord.uid}`);
  console.log(`  Email: ${userRecord.email}`);
  console.log(`  Email verified: ${userRecord.emailVerified}`);
  console.log(`  Disabled: ${userRecord.disabled}`);
  console.log(`  Custom claims: ${JSON.stringify(userRecord.customClaims || {})}`);

  const userDoc = await db.collection("users").doc(userRecord.uid).get();
  if (!userDoc.exists) {
    console.log("\nWARNING: Firestore profile users/{uid} not found.");
  } else {
    const userData = userDoc.data();
    console.log("\nFirestore profile:");
    console.log(`  Role: ${userData.role || "(missing)"}`);
    console.log(`  Status: ${userData.status || "(missing)"}`);
    console.log(`  Region: ${userData.region || "(missing)"}`);
    console.log(`  Full name: ${userData.fullName || "(missing)"}`);
    console.log(`  Email: ${userData.email || "(missing)"}`);
    console.log(`  mustResetPassword: ${userData.mustResetPassword === true}`);

    if (userData.email && userData.email !== userRecord.email) {
      console.log("  WARNING: Auth email and Firestore email are different.");
    }
  }

  console.log("\n===========================================");
  console.log("   VERIFICATION COMPLETE");
  console.log("===========================================\n");
  console.log("No writes were performed by this script.");
}

runReadOnlyVerification()
  .catch((error) => {
    console.error("\nERROR:", error.message);
    process.exit(1);
  })
  .finally(() => process.exit());
