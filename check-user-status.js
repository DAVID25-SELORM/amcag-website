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

async function checkUserStatus() {
  const email = process.argv[2];

  if (!email) {
    console.log("Usage: node check-user-status.js <email>");
    process.exit(1);
  }

  try {
    console.log("Checking user status for:", email);
    console.log("=====================================");

    // Get user from Auth
    const userRecord = await admin.auth().getUserByEmail(email);
    console.log("\nFirebase Auth:");
    console.log("   UID:", userRecord.uid);
    console.log("   Email:", userRecord.email);
    console.log("   Email Verified:", userRecord.emailVerified);
    console.log("   Disabled:", userRecord.disabled);

    // Get user from Firestore
    const userDoc = await db.collection("users").doc(userRecord.uid).get();

    if (!userDoc.exists) {
      console.log("\nERROR: User document not found in Firestore.");
      process.exit(1);
    }

    const userData = userDoc.data();
    console.log("\nFirestore Document:");
    console.log("   Full Name:", userData.fullName);
    console.log("   Role:", userData.role);
    console.log("   Status:", userData.status);
    console.log("   Email:", userData.email);
    console.log("   Region:", userData.region);
    console.log("   Must Reset Password:", userData.mustResetPassword);
    console.log("   Created At:", userData.createdAt?.toDate?.());

    console.log("\nStatus Check:");
    if (userData.status === "approved" || userData.status === "active") {
      console.log("   OK - Status is valid:", userData.status);
    } else {
      console.log("   ERROR - Status is invalid:", userData.status);
      console.log('   Expected: "approved" or "active"');
    }

    console.log("\nRole Check:");
    if (userData.role === "super_admin" || userData.role === "national_executive") {
      console.log("   OK - Role is valid for national dashboard:", userData.role);
    } else {
      console.log("   WARNING - Role is not a national role:", userData.role);
    }

    console.log("\n=====================================");
    console.log("User check complete.");
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }

  process.exit(0);
}

checkUserStatus();
