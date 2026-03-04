// ===== SECURITY COMMAND CENTER SETUP =====
// This script initializes the Security Command Center collections with default settings

// INSTRUCTIONS:
// 1. Go to Firebase Console > Firestore Database
// 2. Create the following collections and documents manually:

// ===== Collection: security_settings =====
// Document ID: default
{
  "maxPasswordResetsPerHour": 5,
  "cooldownBetweenResetsMinutes": 10,
  "criticalSpikeWindowMinutes": 20,
  "criticalSpikeCount": 7,
  "highRiskThreshold": 50,
  "autoBlockEnabled": false,
  "autoBlockThreshold": 100,
  "notifyOnCritical": true,
  "notifyOnHigh": true,
  "enableRealTimeMonitoring": true
}

// ===== Risk Score Calculation =====
// PASSWORD_RESET = +10 points
// ROLE_CHANGE = +15 points
// CERT_REVOKE = +20 points
// Multiple IP/device changes = +25 points
// UNAUTHORIZED_ATTEMPT = +30 points
// Multiple critical actions per hour = +40 points

// Risk scores reset daily (at midnight)

// ===== Collection Structure (Auto-created by functions) =====

// security_events/{eventId}
// - Append-only log of all security-relevant actions
// - Created by Cloud Functions only

// security_alerts/{alertId}
// - System-generated alerts for suspicious activity
// - Created by Risk Engine cloud function

// security_profiles/{uid}
// - Risk profiles for admins
// - Tracks counters and risk scores
// - Updated by Cloud Functions

// security_controls/{uid}
// - Kill switches to block specific admins
// - Can be created by super_admin via Command Center UI

// ===== DEPLOYMENT STEPS =====
// 1. Create the security_settings document above in Firestore manually
// 2. Deploy the updated Cloud Functions:
//    firebase deploy --only functions
// 3. Deploy the updated Firestore rules:
//    firebase deploy --only firestore:rules
// 4. Deploy the Security Command Center UI:
//    firebase deploy --only hosting
// 5. Access the Command Center at:
//    https://amcag-website.web.app/national/security-command-center.html

// ===== TESTING =====
// 1. Trigger a password reset to generate a security event
// 2. Check security_events collection for the event
// 3. Verify security_profiles was updated with risk score
// 4. Perform 7 resets within 20 minutes to trigger spike alert
// 5. Check security_alerts collection for the alert
// 6. View the alert in the Security Command Center UI

// ===== MONITORING BEST PRACTICES =====
// - Review Security Command Center daily
// - Acknowledge alerts within 1 hour
// - Resolve alerts within 24 hours
// - Investigate high-risk admins weekly
// - Review security settings monthly
// - Export audit logs for compliance (if needed)

// ===== ADDING MORE SENSITIVE ACTIONS =====
// To add more actions to monitor (role changes, cert revokes, etc.):
// 1. Create Cloud Functions for those actions (similar to adminResetPassword)
// 2. Call logSecurityEvent() in each function
// 3. Update risk scoring in the Risk Engine
// 4. Add event types to the Command Center UI filters
