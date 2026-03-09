const admin = require("firebase-admin");

let serviceAccount;
try {
  serviceAccount = require("./functions/serviceAccountKey.json");
} catch (e) {
  try {
    serviceAccount = require("./firebase-reset/serviceAccountKey.json");
  } catch (e2) {
    console.error("ERROR: Service account key not found.");
    process.exit(1);
  }
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function verifySuperAdminPermissions() {
  const email = process.argv[2];

  if (!email) {
    console.log("Usage: node verify-super-admin-permissions.js <email>");
    process.exit(1);
  }

  try {
    console.log("SUPER ADMIN PERMISSIONS VERIFICATION");
    console.log("====================================\n");

    // Get user from Auth
    const userRecord = await admin.auth().getUserByEmail(email);
    console.log("Firebase Auth:");
    console.log("  UID:", userRecord.uid);
    console.log("  Email:", userRecord.email);
    console.log("  Email Verified:", userRecord.emailVerified);
    console.log("  Disabled:", userRecord.disabled);
    console.log("  Custom Claims:", userRecord.customClaims || {});

    // Get user from Firestore
    const userDoc = await db.collection("users").doc(userRecord.uid).get();
    if (!userDoc.exists) {
      console.log("\nERROR: User document not found in Firestore.");
      process.exit(1);
    }

    const userData = userDoc.data();
    console.log("\nFirestore User Document:");
    console.log("  Full Name:", userData.fullName);
    console.log("  Role:", userData.role);
    console.log("  Status:", userData.status);
    console.log("  Region:", userData.region);
    console.log("  Email:", userData.email);

    const hasSuperAdminRole = userData.role === "super_admin";
    const hasValidStatus = userData.status === "approved" || userData.status === "active";
    const authEnabled = !userRecord.disabled && userRecord.emailVerified === true;

    console.log("\nVerification Summary:");
    console.log("  Super Admin Role:", hasSuperAdminRole ? "OK" : "FAIL");
    console.log("  Active/Approved Status:", hasValidStatus ? "OK" : "FAIL");
    console.log("  Auth Enabled + Verified:", authEnabled ? "OK" : "FAIL");

    if (!hasSuperAdminRole || !hasValidStatus || !authEnabled) {
      process.exit(1);
    }
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }

  process.exit(0);
}

verifySuperAdminPermissions();
