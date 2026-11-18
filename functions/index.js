const functions = require("firebase-functions");
const {onDocumentCreated} = require("firebase-functions/v2/firestore");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");
const crypto = require("crypto");
const axios = require("axios");

admin.initializeApp();

// Hubtel payment API configuration
const HUBTEL_API_ID = String(process.env.HUBTEL_API_ID || "").trim();
const HUBTEL_API_KEY = String(process.env.HUBTEL_API_KEY || "").trim();
const NATIONAL_HUBTEL_API_ID = String(process.env.NATIONAL_HUBTEL_API_ID || HUBTEL_API_ID).trim();
const NATIONAL_HUBTEL_API_KEY = String(process.env.NATIONAL_HUBTEL_API_KEY || HUBTEL_API_KEY).trim();
// A separate Greater Accra merchant account is optional. Until it is configured,
// use the national Hubtel account for members in that region as well.
const GREATER_ACCRA_HUBTEL_API_ID = String(process.env.GREATER_ACCRA_HUBTEL_API_ID || NATIONAL_HUBTEL_API_ID).trim();
const GREATER_ACCRA_HUBTEL_API_KEY = String(process.env.GREATER_ACCRA_HUBTEL_API_KEY || NATIONAL_HUBTEL_API_KEY).trim();
const HUBTEL_WEBHOOK_SECRET = String(process.env.HUBTEL_WEBHOOK_SECRET || "").trim();
// Static egress IP (34.9.123.89) via Cloud NAT: Hubtel only accepts whitelisted IPs for Receive Money and status checks
const HUBTEL_STATIC_EGRESS = {
  vpcConnector: "amcag-connector",
  vpcConnectorEgressSettings: "ALL_TRAFFIC"
};

const HUBTEL_SECRET_NAMES = [
  "NATIONAL_HUBTEL_API_ID",
  "NATIONAL_HUBTEL_API_KEY",
  "HUBTEL_WEBHOOK_SECRET"
];

const DEFAULT_FEE_SETTINGS = Object.freeze({
  monthlyDues: 10.00,
  registrationFee: 60.00,
  currency: "GHS"
});

async function getFeeSettings(db) {
  const snap = await db.collection('system_settings').doc('fees').get();
  const data = snap.exists ? (snap.data() || {}) : {};
  const monthlyDues = Number(data.monthlyDues);
  const registrationFee = Number(data.registrationFee);
  return {
    monthlyDues: Number.isFinite(monthlyDues) && monthlyDues > 0 ? Number(monthlyDues.toFixed(2)) : DEFAULT_FEE_SETTINGS.monthlyDues,
    registrationFee: Number.isFinite(registrationFee) && registrationFee > 0 ? Number(registrationFee.toFixed(2)) : DEFAULT_FEE_SETTINGS.registrationFee,
    currency: DEFAULT_FEE_SETTINGS.currency,
    updatedAt: data.updatedAt || null,
    updatedBy: data.updatedBy || null
  };
}

function canManageFeeSettings(profile = {}) {
  return profile.role === 'super_admin' ||
    profile.role === 'national_president' ||
    (profile.role === 'national_executive' &&
      (profile.canManageFeeSettings === true || profile.permissions?.canManageFeeSettings === true));
}

exports.getFeeSettings = functions.https.onCall(async (request) => {
  if (!request.auth) throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  const db = admin.firestore();
  const settings = await getFeeSettings(db);
  return {success: true, settings};
});

exports.updateFeeSettings = functions.https.onCall(async (request) => {
  if (!request.auth) throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  const db = admin.firestore();
  const actorRef = db.collection('users').doc(request.auth.uid);
  const actorSnap = await actorRef.get();
  const actor = actorSnap.exists ? (actorSnap.data() || {}) : {};
  if (!canManageFeeSettings(actor)) {
    throw new functions.https.HttpsError('permission-denied', 'You are not authorized to change AMCAG fees');
  }

  const monthlyDues = Number(request.data?.monthlyDues);
  const registrationFee = Number(request.data?.registrationFee);
  if (!Number.isFinite(monthlyDues) || monthlyDues <= 0 || monthlyDues > 100000 ||
      !Number.isFinite(registrationFee) || registrationFee <= 0 || registrationFee > 100000) {
    throw new functions.https.HttpsError('invalid-argument', 'Enter valid positive fee amounts');
  }

  const current = await getFeeSettings(db);
  const now = admin.firestore.Timestamp.now();
  await db.collection('system_settings').doc('fees').set({
    monthlyDues: Number(monthlyDues.toFixed(2)),
    registrationFee: Number(registrationFee.toFixed(2)),
    currency: 'GHS',
    updatedAt: now,
    updatedBy: request.auth.uid,
    updatedByName: actor.fullName || actor.email || request.auth.uid
  }, {merge: true});
  await db.collection('audit_logs').add({
    action: 'fee_settings_updated',
    performedBy: request.auth.uid,
    performedByName: actor.fullName || actor.email || request.auth.uid,
    performedByRole: actor.role || null,
    details: {before: current, after: {monthlyDues, registrationFee, currency: 'GHS'}},
    timestamp: now
  });
  return {success: true, settings: await getFeeSettings(db)};
});

const PAYMENT_ACCOUNTS = {
  national: {
    scope: "national",
    owner: "AMCAG National",
    hubtelApiId: NATIONAL_HUBTEL_API_ID,
    hubtelApiKey: NATIONAL_HUBTEL_API_KEY
  },
  greater_accra: {
    scope: "greater_accra",
    owner: "AMCAG Greater Accra",
    hubtelApiId: GREATER_ACCRA_HUBTEL_API_ID,
    hubtelApiKey: GREATER_ACCRA_HUBTEL_API_KEY
  }
};

function normalizePaymentRegion(region) {
  return String(region || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function resolvePaymentAccount({type, region}) {
  const normalizedType = String(type || "").trim().toLowerCase();
  const normalizedRegion = normalizePaymentRegion(region);

  if (normalizedType === "agm_registration" || normalizedType === "registration_fee") {
    return PAYMENT_ACCOUNTS.national;
  }

  if (normalizedRegion === "greater accra") {
    return PAYMENT_ACCOUNTS.greater_accra;
  }

  return PAYMENT_ACCOUNTS.national;
}

function ensureHubtelCredentialsConfigured(paymentAccount = PAYMENT_ACCOUNTS.national) {
  if (!paymentAccount.hubtelApiId || !paymentAccount.hubtelApiKey) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      `${paymentAccount.owner} Hubtel API credentials are not configured.`
    );
  }
}

// ===== HELPER: Security Event Logger =====
async function logSecurityEvent(eventData) {
  const db = admin.firestore();
  const now = Date.now();
  
  // Create security event
  const eventRef = await db.collection("security_events").add({
    ...eventData,
    createdAt: now,
    _timestamp: admin.firestore.FieldValue.serverTimestamp()
  });
  
  return eventRef.id;
}

// ===== HELPER: Check Security Controls (Kill Switch) =====
async function checkSecurityControls(uid) {
  const controlDoc = await admin.firestore()
    .collection("security_controls")
    .doc(uid)
    .get();
  
  if (controlDoc.exists) {
    const control = controlDoc.data();
    if (control.blockSensitiveActions) {
      // Check if block is still active
      if (!control.until || Date.now() < control.until) {
        throw new functions.https.HttpsError(
          "permission-denied",
          `Sensitive actions blocked: ${control.reason || 'Security investigation'}`
        );
      }
    }
  }
}

// ===== HELPER: Hash IP/User Agent for Privacy =====
function hashData(data) {
  return crypto.createHash("sha256").update(data || "unknown").digest("hex");
}

// ===== ZERO-TRUST ADMIN PASSWORD RESET =====
exports.adminResetPassword = functions.https.onCall(
  async (data, context) => {
    const now = Date.now();
    let eventId = null;

    // ===== SECURITY LAYER 1: Authentication Check =====
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Login required"
      );
    }

    const callerUid = context.auth.uid;
    const targetUid = data.uid;
    const newPassword = data.newPassword;
    
    // Extract request metadata
    const ipAddress = context.rawRequest?.ip || "unknown";
    const userAgent = context.rawRequest?.headers?.["user-agent"] || "unknown";

    // ===== SECURITY LAYER 2: Role Validation =====
    const callerDoc = await admin.firestore()
      .collection("users")
      .doc(callerUid)
      .get();

    if (!callerDoc.exists) {
      throw new functions.https.HttpsError(
        "not-found",
        "Admin user not found"
      );
    }

    const callerData = callerDoc.data();

    if (callerData.role !== "super_admin") {
      // Log unauthorized attempt
      await logSecurityEvent({
        type: "UNAUTHORIZED_PASSWORD_RESET_ATTEMPT",
        severity: "CRITICAL",
        actorUid: callerUid,
        actorRole: callerData.role || "unknown",
        actorEmail: callerData.email || "unknown",
        targetUid: targetUid,
        orgId: callerData.orgId || "none",
        ipHash: hashData(ipAddress),
        userAgentHash: hashData(userAgent),
        meta: { reason: "Insufficient role permissions", requiredRole: "super_admin" },
        success: false
      });
      
      throw new functions.https.HttpsError(
        "permission-denied",
        "Only Super Admin can reset passwords"
      );
    }
    
    // ===== SECURITY CONTROL: Kill Switch Check =====
    await checkSecurityControls(callerUid);

    // ===== SECURITY LAYER 3: Target User Validation =====
    const targetDoc = await admin.firestore()
      .collection("users")
      .doc(targetUid)
      .get();

    if (!targetDoc.exists) {
      throw new functions.https.HttpsError(
        "not-found",
        "Target user not found"
      );
    }

    const targetData = targetDoc.data();

    // ===== SECURITY LAYER 4: Organization Isolation =====
    // Prevent cross-organization resets (if orgs are implemented)
    if (callerData.orgId && targetData.orgId) {
      if (callerData.orgId !== targetData.orgId) {
        throw new functions.https.HttpsError(
          "permission-denied",
          "Cannot reset password for user in different organization"
        );
      }
    }

    // ===== SECURITY LAYER 5: Rate Limiting =====
    const securityRef = admin.firestore()
      .collection("admin_security")
      .doc(callerUid);

    const securityDoc = await securityRef.get();
    const oneHour = 60 * 60 * 1000;

    if (securityDoc.exists) {
      const secData = securityDoc.data();
      const windowStart = secData.lastResetWindow || 0;
      const resetCount = secData.resetCount || 0;

      // Check if within same hour window
      if (now - windowStart < oneHour) {
        if (resetCount >= 5) {
          throw new functions.https.HttpsError(
            "resource-exhausted",
            "Rate limit exceeded. Maximum 5 password resets per hour."
          );
        }
        
        // Increment count within same window
        await securityRef.update({
          resetCount: resetCount + 1,
          lastResetTimestamp: admin.firestore.FieldValue.serverTimestamp()
        });
      } else {
        // New window, reset counter
        await securityRef.set({
          resetCount: 1,
          lastResetWindow: now,
          lastResetTimestamp: admin.firestore.FieldValue.serverTimestamp()
        });
      }
    } else {
      // First reset, create security doc
      await securityRef.set({
        resetCount: 1,
        lastResetWindow: now,
        lastResetTimestamp: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    // ===== SECURITY LAYER 6: Reset Cooldown Check =====
    const lastResetTime = targetData.lastPasswordReset || 0;
    const cooldownPeriod = 10 * 60 * 1000; // 10 minutes

    if (now - lastResetTime < cooldownPeriod) {
      const minutesRemaining = Math.ceil((cooldownPeriod - (now - lastResetTime)) / 60000);
      throw new functions.https.HttpsError(
        "failed-precondition",
        `User password was recently reset. Please wait ${minutesRemaining} more minute(s).`
      );
    }

    // ===== EXECUTE PASSWORD RESET =====
    try {
      await admin.auth().updateUser(targetUid, {
        password: newPassword
      });

      // Update user document with security flags
      await admin.firestore()
        .collection("users")
        .doc(targetUid)
        .update({
          mustResetPassword: true,
          temporaryPasswordCreatedAt: admin.firestore.FieldValue.serverTimestamp(),
          lastPasswordReset: now,
          lastPasswordResetBy: callerUid
        });

      // ===== SECURITY EVENT: Log successful reset =====
      eventId = await logSecurityEvent({
        type: "PASSWORD_RESET",
        severity: "HIGH",
        actorUid: callerUid,
        actorRole: callerData.role,
        actorEmail: callerData.email || "unknown",
        targetUid: targetUid,
        targetEmail: targetData.email || "unknown",
        targetRole: targetData.role || "unknown",
        orgId: callerData.orgId || "none",
        ipHash: hashData(ipAddress),
        userAgentHash: hashData(userAgent),
        meta: { 
          reason: "Admin-initiated password reset",
          channel: "dashboard",
          targetRegion: targetData.region || "unknown"
        },
        success: true
      });

      // ===== UPDATE SECURITY PROFILE =====
      const profileRef = admin.firestore().collection("security_profiles").doc(callerUid);
      const profileDoc = await profileRef.get();
      
      if (profileDoc.exists) {
        const profile = profileDoc.data();
        const newResetCount = (profile.counters?.passwordResets_1h || 0) + 1;
        
        await profileRef.update({
          lastSeen: now,
          "counters.passwordResets_1h": newResetCount,
          riskScore: admin.firestore.FieldValue.increment(10),
          lastAction: {
            type: "PASSWORD_RESET",
            targetUid: targetUid,
            timestamp: now,
            eventId: eventId
          }
        });
      } else {
        // Create profile  
        await profileRef.set({
          uid: callerUid,
          orgId: callerData.orgId || "none",
          role: callerData.role,
          riskScore: 10,
          counters: {
            passwordResets_1h: 1,
            roleChanges_24h: 0,
            failedReauth_1h: 0
          },
          lastSeen: now,
          createdAt: now,
          lastAction: {
            type: "PASSWORD_RESET",
            targetUid: targetUid,
            timestamp: now,
            eventId: eventId
          }
        });
      }

      // ===== SECURITY LAYER 7: Comprehensive Audit Log =====
      await admin.firestore()
        .collection("audit_logs")
        .add({
          action: "password_reset",
          actionType: "admin_action",
          severity: "high",
          adminUid: callerUid,
          adminEmail: callerData.email || "unknown",
          targetUid: targetUid,
          targetEmail: targetData.email || "unknown",
          targetRole: targetData.role || "unknown",
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          timestampMs: now,
          ipAddress: ipAddress,
          userAgent: userAgent,
          success: true,
          securityEventId: eventId
        });

      // ===== SECURITY LAYER 8: Security Alert Notification =====
      await admin.firestore()
        .collection("notifications")
        .add({
          userId: targetUid,
          type: "security_alert",
          title: "Password Reset by Administrator",
          message: "Your password was reset by an administrator. You will be required to create a new password on your next login. If you did not request this, please contact support immediately.",
          priority: "high",
          read: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          relatedEventId: eventId
        });

      return { 
        success: true,
        message: "Password reset successful. User will be required to change password on next login.",
        eventId: eventId
      };

    } catch (error) {
      // Log failed attempt
      eventId = await logSecurityEvent({
        type: "PASSWORD_RESET",
        severity: "HIGH",
        actorUid: callerUid,
        actorRole: callerData.role,
        actorEmail: callerData.email || "unknown",
        targetUid: targetUid,
        orgId: callerData.orgId || "none",
        ipHash: hashData(ipAddress),
        userAgentHash: hashData(userAgent),
        meta: { error: error.message },
        success: false
      });
      
      await admin.firestore()
        .collection("audit_logs")
        .add({
          action: "password_reset",
          actionType: "admin_action",
          severity: "high",
          adminUid: callerUid,
          targetUid: targetUid,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          success: false,
          errorMessage: error.message,
          securityEventId: eventId
        });

      throw new functions.https.HttpsError(
        "internal",
        "Failed to reset password: " + error.message
      );
    }
  }
);
// ===== RISK ENGINE: Process Security Events =====
exports.onSecurityEventCreated = onDocumentCreated(
  'security_events/{eventId}',
  async (event) => {
    const snap = event.data;
    const eventData = snap.data();
    const db = admin.firestore();
    const now = Date.now();
    
    // Get security settings (thresholds)
    const settingsDoc = await db.collection('security_settings')
      .doc(eventData.orgId || 'default')
      .get();
    
    const settings = settingsDoc.exists ? settingsDoc.data() : {
      maxPasswordResetsPerHour: 5,
      cooldownBetweenResetsMinutes: 10,
      criticalSpikeWindowMinutes: 20,
      criticalSpikeCount: 7,
      highRiskThreshold: 50
    };
    
    // ===== SPIKE DETECTION =====
    if (eventData.type === 'PASSWORD_RESET' && eventData.success) {
      const spikeWindow = settings.criticalSpikeWindowMinutes * 60 * 1000;
      const spikeThreshold = settings.criticalSpikeCount;
      
      // Count recent resets by this actor
      const recentEvents = await db.collection('security_events')
        .where('actorUid', '==', eventData.actorUid)
        .where('type', '==', 'PASSWORD_RESET')
        .where('success', '==', true)
        .where('createdAt', '>=', now - spikeWindow)
        .get();
      
      if (recentEvents.size >= spikeThreshold) {
        // CRITICAL ALERT: Spike detected
        const eventIds = recentEvents.docs.map(doc => doc.id);
        
        await db.collection('security_alerts').add({
          orgId: eventData.orgId || 'none',
          status: 'OPEN',
          title: '🚨 Critical: Password Reset Spike Detected',
          summary: `Admin ${eventData.actorEmail || eventData.actorUid} performed ${recentEvents.size} password resets in ${settings.criticalSpikeWindowMinutes} minutes`,
          severity: 'CRITICAL',
          signalType: 'RATE_SPIKE',
          actorUid: eventData.actorUid,
          actorRole: eventData.actorRole,
          actorEmail: eventData.actorEmail,
          linkedEventIds: eventIds,
          createdAt: now,
          _timestamp: admin.firestore.FieldValue.serverTimestamp(),
          ack: { by: null, at: null },
          resolution: { by: null, at: null, note: null },
          meta: {
            resetCount: recentEvents.size,
            windowMinutes: settings.criticalSpikeWindowMinutes
          }
        });
        
        // Notify all super admins
        const admins = await db.collection('users')
          .where('role', '==', 'super_admin')
          .get();
        
        const notificationPromises = admins.docs.map(adminDoc => {
          return db.collection('notifications').add({
            uid: adminDoc.id, userId: adminDoc.id,
            type: 'security_alert_critical',
            title: '🚨 CRITICAL SECURITY ALERT',
            message: `Admin ${eventData.actorEmail || eventData.actorUid} has performed ${recentEvents.size} password resets in ${settings.criticalSpikeWindowMinutes} minutes. Review immediately in Security Command Center.`,
            priority: 'critical',
            read: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            actionUrl: '/national/security-command-center.html'
          });
        });
        
        await Promise.all(notificationPromises);
      }
    }
    
    // ===== HIGH-RISK ADMIN DETECTION =====
    const profileRef = db.collection('security_profiles').doc(eventData.actorUid);
    const profileDoc = await profileRef.get();
    
    if (profileDoc.exists) {
      const profile = profileDoc.data();
      
      if (profile.riskScore >= settings.highRiskThreshold) {
        // Check if alert already exists
        const existingAlert = await db.collection('security_alerts')
          .where('actorUid', '==', eventData.actorUid)
          .where('signalType', '==', 'HIGH_RISK_ADMIN')
          .where('status', '==', 'OPEN')
          .limit(1)
          .get();
        
        if (existingAlert.empty) {
          await db.collection('security_alerts').add({
            orgId: eventData.orgId || 'none',
            status: 'OPEN',
            title: '⚠️ High-Risk Admin Detected',
            summary: `Admin ${eventData.actorEmail || eventData.actorUid} has risk score of ${profile.riskScore}`,
            severity: 'HIGH',
            signalType: 'HIGH_RISK_ADMIN',
            actorUid: eventData.actorUid,
            actorRole: eventData.actorRole,
            actorEmail: eventData.actorEmail,
            linkedEventIds: [event.params.eventId],
            createdAt: now,
            _timestamp: admin.firestore.FieldValue.serverTimestamp(),
            ack: { by: null, at: null },
            resolution: { by: null, at: null, note: null },
            meta: {
              riskScore: profile.riskScore,
              counters: profile.counters
            }
          });
        }
      }
    }
    
    // ===== UNAUTHORIZED ATTEMPT DETECTION =====
    if (eventData.type === 'UNAUTHORIZED_PASSWORD_RESET_ATTEMPT') {
      await db.collection('security_alerts').add({
        orgId: eventData.orgId || 'none',
        status: 'OPEN',
        title: '⚠️ Unauthorized Action Attempt',
        summary: `User ${eventData.actorEmail || eventData.actorUid} (${eventData.actorRole}) attempted to reset password without permission`,
        severity: 'HIGH',
        signalType: 'UNAUTHORIZED_ATTEMPT',
        actorUid: eventData.actorUid,
        actorRole: eventData.actorRole,
        actorEmail: eventData.actorEmail,
        linkedEventIds: [event.params.eventId],
        createdAt: now,
        _timestamp: admin.firestore.FieldValue.serverTimestamp(),
        ack: { by: null, at: null },
        resolution: { by: null, at: null, note: null },
        meta: eventData.meta
      });
    }
    
    return null;
  });

// ===== CLEANUP: Reset Risk Counters Hourly =====
exports.resetHourlyCounters = onSchedule(
  '0 * * * *', // Every hour
  async () => {
    const db = admin.firestore();
    const profiles = await db.collection('security_profiles').get();
    
    const updates = profiles.docs.map(doc => {
      return doc.ref.update({
        'counters.passwordResets_1h': 0,
        'counters.failedReauth_1h': 0
      });
    });
    
    await Promise.all(updates);
    return null;
  });

// ===== CLEANUP: Reset Daily Counters =====
exports.resetDailyCounters = onSchedule(
  '0 0 * * *', // Midnight every day
  async () => {
    const db = admin.firestore();
    const profiles = await db.collection('security_profiles').get();
    
    const updates = profiles.docs.map(doc => {
      return doc.ref.update({
        'counters.roleChanges_24h': 0,
        riskScore: 0 // Reset risk scores daily
      });
    });
    
    await Promise.all(updates);
    return null;
  });

// ===============================================
// MEMBER APPROVAL WORKFLOW FUNCTIONS
// ===============================================

// ===== GENERATE MEMBERSHIP ID =====
const REGION_CODE_MAP = {
  'greater accra': 'GA',
  ashanti: 'AR',
  central: 'CR',
  eastern: 'ER',
  northern: 'NR',
  'upper east': 'UER',
  'upper west': 'UWR',
  volta: 'VR',
  western: 'WR',
  'western north': 'WNR',
  bono: 'BR',
  'bono east': 'BER',
  ahafo: 'AHR',
  savannah: 'SR',
  'north east': 'NER',
  oti: 'OR'
};

function getRegionCode(region) {
  const normalized = String(region || '').trim().toLowerCase();
  if (REGION_CODE_MAP[normalized]) return REGION_CODE_MAP[normalized];

  const generated = normalized
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .replace(/[^a-z]/g, '')
    .toUpperCase();

  return generated || 'GEN';
}

function toDateSafe(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getRegistrationYear(member) {
  const registrationDate = toDateSafe(member?.registrationDate) || toDateSafe(member?.createdAt);
  return registrationDate ? registrationDate.getFullYear() : new Date().getFullYear();
}

function getMembershipSequenceFromId(memberId, expectedRegionCode, expectedYear) {
  const match = String(memberId || '').match(/^AMCAG-([A-Z]{2,4})-(\d{4})-(\d{3,6})$/i);
  if (!match) return 0;

  const idRegionCode = String(match[1] || '').toUpperCase();
  const idYear = parseInt(match[2], 10);
  const seq = parseInt(match[3], 10);
  if (!Number.isFinite(idYear) || !Number.isFinite(seq)) return 0;
  if (idRegionCode !== expectedRegionCode) return 0;
  if (idYear !== expectedYear) return 0;
  return seq > 0 ? seq : 0;
}

async function generateMembershipId(db, member = {}) {
  const regionCode = getRegionCode(member.region);
  const registrationYear = getRegistrationYear(member);
  const counterRef = db.collection('system_counters').doc(`membership_id_${regionCode}_${registrationYear}`);
  const memberIdPrefix = `AMCAG-${regionCode}-${registrationYear}-`;
  
  try {
    // Query must happen outside the transaction \u2014 Firestore transactions only support document reads.
    const latestMemberForYear = await db.collection('users')
      .where('memberId', '>=', memberIdPrefix)
      .where('memberId', '<=', `${memberIdPrefix}\uf8ff`)
      .orderBy('memberId', 'desc')
      .limit(1)
      .get();

    const result = await db.runTransaction(async (transaction) => {
      const counterDoc = await transaction.get(counterRef);

      let counterNumber = 0;
      let existingNumber = 0;

      if (counterDoc.exists) {
        const data = counterDoc.data();
        if (data.year === registrationYear && data.regionCode === regionCode) {
          const parsedCounter = parseInt(data.lastNumber || 0, 10);
          if (Number.isFinite(parsedCounter) && parsedCounter > 0) {
            counterNumber = parsedCounter;
          }
        }
      }

      if (!latestMemberForYear.empty) {
        const latestMemberData = latestMemberForYear.docs[0].data() || {};
        existingNumber = getMembershipSequenceFromId(latestMemberData.memberId, regionCode, registrationYear);
      }

      // Keep sequence strictly increasing even if counter was reset/deleted.
      const nextNumber = Math.max(counterNumber, existingNumber) + 1;
      
      // Update counter
      transaction.set(counterRef, {
        lastNumber: nextNumber,
        regionCode: regionCode,
        year: registrationYear,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      // Generate ID in format: AMCAG-GA-2026-0001
      const memberId = `${memberIdPrefix}${String(nextNumber).padStart(4, '0')}`;
      
      return memberId;
    });
    
    return result;
  } catch (error) {
    console.error('Error generating membership ID:', error);
    throw new functions.https.HttpsError('internal', 'Failed to generate membership ID');
  }
}

async function approveMemberForUid(data, approverUid) {
  const { memberUid, notes } = data; // Removed memberId from required params

  if (!memberUid) {
    throw new functions.https.HttpsError('invalid-argument', 'Member UID is required');
  }

  try {
    const db = admin.firestore();
    
    // Get approver details
    const approverDoc = await db.collection('users').doc(approverUid).get();
    if (!approverDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Approver not found');
    }

    const approver = approverDoc.data();

    // Get member details
    const memberDoc = await db.collection('users').doc(memberUid).get();
    if (!memberDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Member not found');
    }

    const member = memberDoc.data();
    const approverRegion = approver.region || approver.regionId;
    const memberRegion = member.region || member.regionName || member.assignedRegion || member.regionId;
    const sameRegion = String(approverRegion || '').trim().toLowerCase() === String(memberRegion || '').trim().toLowerCase();

    // Check permissions
    const canApprove = 
      approver.role === 'super_admin' ||
      approver.role === 'national_executive' ||
      (approver.role === 'regional_executive' && 
       approver.canApproveMembership === true && 
       sameRegion);

    if (!canApprove) {
      throw new functions.https.HttpsError('permission-denied', 'Not authorized to approve members');
    }

    // If regional approval, check if region has permission
    if (approver.role === 'regional_executive') {
      const regionDoc = await db.collection('regions').doc(memberRegion).get();
      if (!regionDoc.exists || regionDoc.data().canApproveMembersLocally !== true) {
        throw new functions.https.HttpsError('permission-denied', 'Region does not have local approval permission');
      }
    }

    // Check member status
    if (member.status !== 'pending') {
      throw new functions.https.HttpsError('failed-precondition', 'Member is not pending approval');
    }

    // ===== AUTO-GENERATE MEMBERSHIP ID =====
    const memberId = await generateMembershipId(db, { ...member, region: memberRegion });
    console.log(`✅ Generated membership ID: ${memberId} for ${member.fullName}`);

    const now = admin.firestore.FieldValue.serverTimestamp();

    // Update users collection
    await db.collection('users').doc(memberUid).update({
      status: 'active',
      memberId: memberId,
      joiningDate: now,
      approvedBy: approverUid,
      approvedByName: approver.fullName || approver.email,
      approvedAt: now,
      approvalNotes: notes || '',
      updatedAt: now
    });

    // Keep the member mirror present even when older registrations only exist in users.
    await db.collection('members').doc(memberUid).set({
      ...member,
      uid: memberUid,
      region: memberRegion || null,
      status: 'active',
      memberId: memberId,
      joiningDate: now,
      approvalStatus: 'approved',
      approvedBy: approverUid,
      approvedByName: approver.fullName || approver.email,
      approvedAt: now,
      updatedAt: now
    }, { merge: true });

    // Create audit log
    await db.collection('audit_logs').add({
      action: 'member_approved',
      performedBy: approverUid,
      performedByName: approver.fullName || approver.email,
      performedByRole: approver.role,
      targetUser: memberUid,
      targetUserName: member.fullName,
      details: {
        memberId: memberId,
        region: memberRegion,
        notes: notes || '',
        approvalType: approver.role === 'regional_executive' ? 'regional' : 'national'
      },
      timestamp: now
    });

    // Send notification to member
    await db.collection('notifications').add({
      uid: memberUid,
      type: 'membership_approved',
      title: 'Membership Approved! 🎉',
      message: `Your AMCAG membership has been approved. Your Member ID is: ${memberId}`,
      status: 'unread',
      createdAt: now
    });

    return { 
      success: true,
      memberId: memberId,
      message: 'Member approved successfully'
    };

  } catch (error) {
    console.error('Error approving member:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
}

// ===== APPROVE MEMBER =====
exports.approveMember = functions.https.onCall(async (data, context) => {
  // Authentication check
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  return approveMemberForUid(data, context.auth.uid);
});

async function rejectMemberForUid(data, approverUid) {
  const { memberUid, reason } = data;

  if (!memberUid || !reason) {
    throw new functions.https.HttpsError('invalid-argument', 'Member UID and rejection reason are required');
  }

  try {
    const db = admin.firestore();
    
    // Get approver details
    const approverDoc = await db.collection('users').doc(approverUid).get();
    if (!approverDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Approver not found');
    }

    const approver = approverDoc.data();

    // Get member details
    const memberDoc = await db.collection('users').doc(memberUid).get();
    if (!memberDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Member not found');
    }

    const member = memberDoc.data();
    const approverRegion = approver.region || approver.regionId;
    const memberRegion = member.region || member.regionName || member.assignedRegion || member.regionId;
    const sameRegion = String(approverRegion || '').trim().toLowerCase() === String(memberRegion || '').trim().toLowerCase();

    // Check permissions (same as approve)
    const canReject = 
      approver.role === 'super_admin' ||
      approver.role === 'national_executive' ||
      (approver.role === 'regional_executive' && 
       approver.canApproveMembership === true && 
       sameRegion);

    if (!canReject) {
      throw new functions.https.HttpsError('permission-denied', 'Not authorized to reject members');
    }

    const now = admin.firestore.FieldValue.serverTimestamp();

    // Update status to rejected
    await db.collection('users').doc(memberUid).update({
      status: 'rejected',
      rejectedBy: approverUid,
      rejectedByName: approver.fullName || approver.email,
      rejectedAt: now,
      rejectionReason: reason,
      updatedAt: now
    });

    // Keep the member mirror present even when older registrations only exist in users.
    await db.collection('members').doc(memberUid).set({
      ...member,
      uid: memberUid,
      region: memberRegion || null,
      status: 'rejected',
      approvalStatus: 'rejected',
      rejectedBy: approverUid,
      rejectedByName: approver.fullName || approver.email,
      rejectedAt: now,
      rejectionReason: reason,
      updatedAt: now
    }, { merge: true });

    // Create audit log
    await db.collection('audit_logs').add({
      action: 'member_rejected',
      performedBy: approverUid,
      performedByName: approver.fullName || approver.email,
      performedByRole: approver.role,
      targetUser: memberUid,
      targetUserName: member.fullName,
      details: {
        reason: reason,
        region: memberRegion,
        rejectionType: approver.role === 'regional_executive' ? 'regional' : 'national'
      },
      timestamp: now
    });

    // Send notification to member
    await db.collection('notifications').add({
      uid: memberUid,
      type: 'membership_rejected',
      title: 'Membership Application Update',
      message: `Your membership application has been reviewed. Reason: ${reason}`,
      status: 'unread',
      createdAt: now
    });

    return { 
      success: true,
      message: 'Member registration rejected'
    };

  } catch (error) {
    console.error('Error rejecting member:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
}

// ===== REJECT MEMBER =====
exports.rejectMember = functions.https.onCall(async (data, context) => {
  // Authentication check
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  return rejectMemberForUid(data, context.auth.uid);
});

function setCorsHeaders(res) {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
}

async function getUidFromBearerToken(req) {
  const authHeader = req.get('Authorization') || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const decodedToken = await admin.auth().verifyIdToken(match[1]);
  return decodedToken.uid;
}

function sendHttpsError(res, error) {
  const statusByCode = {
    unauthenticated: 401,
    'permission-denied': 403,
    'not-found': 404,
    'invalid-argument': 400,
    'failed-precondition': 412,
    internal: 500
  };
  const status = statusByCode[error.code] || 500;
  res.status(status).json({
    error: {
      status: error.code || 'internal',
      message: error.message || 'Approval service failed'
    }
  });
}

exports.approveMemberHttp = functions.https.onRequest(async (req, res) => {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: { status: 'method-not-allowed', message: 'POST required' } });
    return;
  }

  try {
    const approverUid = await getUidFromBearerToken(req);
    const result = await approveMemberForUid(req.body?.data || req.body || {}, approverUid);
    res.status(200).json({ result });
  } catch (error) {
    sendHttpsError(res, error);
  }
});

exports.rejectMemberHttp = functions.https.onRequest(async (req, res) => {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: { status: 'method-not-allowed', message: 'POST required' } });
    return;
  }

  try {
    const approverUid = await getUidFromBearerToken(req);
    const result = await rejectMemberForUid(req.body?.data || req.body || {}, approverUid);
    res.status(200).json({ result });
  } catch (error) {
    sendHttpsError(res, error);
  }
});

// ===== TOGGLE REGIONAL APPROVAL PERMISSION =====
exports.toggleRegionalApproval = functions.https.onCall(async (data, context) => {
  // Authentication check
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { regionName, enabled } = data;
  const adminUid = context.auth.uid;

  if (!regionName || typeof enabled !== 'boolean') {
    throw new functions.https.HttpsError('invalid-argument', 'Region name and enabled status are required');
  }

  try {
    const db = admin.firestore();
    
    // Get admin details
    const adminDoc = await db.collection('users').doc(adminUid).get();
    if (!adminDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Admin not found');
    }

    const admin = adminDoc.data();

    // Check permissions - only national executives and super admin
    if (admin.role !== 'super_admin' && admin.role !== 'national_executive') {
      throw new functions.https.HttpsError('permission-denied', 'Only National Executives can modify regional permissions');
    }

    const now = admin.firestore.FieldValue.serverTimestamp();

    // Update region document
    await db.collection('regions').doc(regionName).set({
      name: regionName,
      canApproveMembersLocally: enabled,
      approvalEnabledBy: enabled ? adminUid : null,
      approvalEnabledByName: enabled ? (admin.fullName || admin.email) : null,
      approvalEnabledAt: enabled ? now : null,
      approvalDisabledAt: !enabled ? now : null,
      updatedAt: now
    }, { merge: true });

    // Create audit log
    await db.collection('audit_logs').add({
      action: enabled ? 'regional_approval_enabled' : 'regional_approval_disabled',
      performedBy: adminUid,
      performedByName: admin.fullName || admin.email,
      performedByRole: admin.role,
      targetRegion: regionName,
      details: {
        enabled: enabled,
        action: enabled ? 'enabled' : 'disabled'
      },
      timestamp: now
    });

    return { 
      success: true,
      message: `Regional approval ${enabled ? 'enabled' : 'disabled'} for ${regionName}`
    };

  } catch (error) {
    console.error('Error toggling regional approval:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// ===== HUBTEL DIRECT RECEIVE MONEY HELPERS =====
const HUBTEL_MOMO_CHANNELS = new Set(['mtn-gh', 'vodafone-gh', 'tigo-gh']);

function hubtelCallbackUrl() {
  return `https://us-central1-amcag-af624.cloudfunctions.net/hubtelWebhook?secret=${encodeURIComponent(HUBTEL_WEBHOOK_SECRET)}`;
}

function normalizeGhanaMsisdn(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (/^233\d{9}$/.test(digits)) return digits;
  if (/^0\d{9}$/.test(digits)) return `233${digits.slice(1)}`;
  if (/^\d{9}$/.test(digits)) return `233${digits}`;
  return '';
}

async function sendHubtelReceiveMoney({paymentAccount, msisdn, channel, amount, description, clientReference, name, email}) {
  const basicAuth = Buffer.from(
    `${paymentAccount.hubtelApiId}:${paymentAccount.hubtelApiKey}`, 'utf8'
  ).toString('base64');
  const response = await axios.post(
    `https://rmp.hubtel.com/merchantaccount/merchants/${encodeURIComponent(paymentAccount.hubtelApiId)}/receive/mobilemoney`,
    {
      CustomerName: name || '',
      CustomerMsisdn: msisdn,
      CustomerEmail: email || '',
      Channel: channel,
      Amount: Number(Number(amount).toFixed(2)),
      PrimaryCallbackUrl: hubtelCallbackUrl(),
      Description: description,
      ClientReference: clientReference
    },
    {
      headers: {Authorization: `Basic ${basicAuth}`, 'Content-Type': 'application/json'},
      timeout: 30000
    }
  );
  return response.data || {};
}

// ===== PROCESS DUES PAYMENT =====
exports.processDuesPayment = functions.https.onCall({
  secrets: HUBTEL_SECRET_NAMES,
  ...HUBTEL_STATIC_EGRESS
}, async (request) => {
  const data = request.data || {};
  const context = request;
  // Authentication check
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { months, paymentMethod, amount, notes, transferReference } = data;
  const channel = String(data.channel || '').trim();
  const requestedPaymentPhone = String(data.paymentPhone || '').trim();
  const isHubtel = paymentMethod === 'hubtel';
  // For Hubtel, the reference is generated server-side (max 36 chars, unique per transaction)
  const hubtelClientReference = isHubtel ? `DUES-${crypto.randomBytes(8).toString('hex')}` : (data.hubtelClientReference || null);
  const hubtelTransactionId = isHubtel ? null : (data.hubtelTransactionId || null);
  let hubtelMsisdn = '';
  const actorUid = context.auth.uid;
  const requestedMemberUid = String(data.memberUid || '').trim();
  const memberUid = requestedMemberUid || actorUid;

  if (!months || !Array.isArray(months) || months.length === 0) {
    throw new functions.https.HttpsError('invalid-argument', 'Months array is required');
  }

  if (!paymentMethod || !amount) {
    throw new functions.https.HttpsError('invalid-argument', 'Payment method and amount are required');
  }

  const db = admin.firestore();
  if (memberUid !== actorUid) {
    if (!isHubtel) {
      throw new functions.https.HttpsError('invalid-argument', 'Executive payment requests must use Hubtel mobile money');
    }
    const actorSnap = await db.collection('users').doc(actorUid).get();
    const actor = actorSnap.exists ? (actorSnap.data() || {}) : {};
    const canRequestForOthers = actor.role === 'super_admin' ||
      actor.role === 'national_executive' ||
      (actor.role === 'regional_executive' && actor.permissions?.canManagePayments === true);
    if (!canRequestForOthers) {
      throw new functions.https.HttpsError('permission-denied', 'You are not authorized to request payments for members');
    }
    if (actor.role === 'regional_executive') {
      const targetSnap = await db.collection('users').doc(memberUid).get();
      const target = targetSnap.exists ? (targetSnap.data() || {}) : {};
      if (!targetSnap.exists || String(target.region || '') !== String(actor.region || '')) {
        throw new functions.https.HttpsError('permission-denied', 'Regional executives may only request payments for members in their region');
      }
    }
  }
  const feeSettings = await getFeeSettings(db);
  const MONTHLY_DUES_AMOUNT = feeSettings.monthlyDues;
  const expectedAmount = months.length * MONTHLY_DUES_AMOUNT;

  if (Math.abs(amount - expectedAmount) > 0.01) {
    throw new functions.https.HttpsError('invalid-argument', `Invalid amount. Expected GHS ${expectedAmount.toFixed(2)}`);
  }

  try {
    
    // Get member details
    const memberDoc = await db.collection('users').doc(memberUid).get();
    if (!memberDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Member not found');
    }

    const member = memberDoc.data();

    if (member.status !== 'active') {
      throw new functions.https.HttpsError('permission-denied', 'Only active members can pay dues');
    }

    const paymentAccount = resolvePaymentAccount({
      type: 'monthly_dues',
      region: member.region
    });
    const now = admin.firestore.Timestamp.now();
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();
    const monthKey = (year, month) => `${year}-${String(month).padStart(2, '0')}`;

    if (isHubtel) {
      ensureHubtelCredentialsConfigured(paymentAccount);

      if (!HUBTEL_MOMO_CHANNELS.has(channel)) {
        throw new functions.https.HttpsError('invalid-argument', 'Select a valid mobile money network');
      }
      // Members may use a one-time alternate Ghana number without changing
      // the phone number saved on their profile.
      hubtelMsisdn = normalizeGhanaMsisdn(requestedPaymentPhone || member.phone);
      if (!hubtelMsisdn) {
        throw new functions.https.HttpsError('failed-precondition', 'Enter a valid Ghana mobile number before paying online');
      }
    } else if (hubtelTransactionId) {
      const existingPayment = await db.collection('payments')
        .where('hubtelTransactionId', '==', hubtelTransactionId)
        .get();

      if (!existingPayment.empty) {
        throw new functions.https.HttpsError('already-exists', 'This Hubtel transaction has already been recorded');
      }
    }

    // Validate months
    for (const monthData of months) {
      const { month, year } = monthData;

      if (!Number.isInteger(month) || !Number.isInteger(year) || month < 1 || month > 12) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid dues month selected');
      }

      // Cannot pay future months
      if (year > currentYear || (year === currentYear && month > currentMonth)) {
        throw new functions.https.HttpsError('invalid-argument', 
          `Cannot pay for future months. Cannot pay ${month}/${year}`);
      }

      // Check if already paid
      const existingPayment = await db.collection('payments')
        .where('uid', '==', memberUid)
        .where('type', '==', 'monthly_dues')
        .where('month', '==', month)
        .where('year', '==', year)
        .where('status', 'in', ['paid', 'waived'])
        .get();

      if (!existingPayment.empty) {
        throw new functions.https.HttpsError('already-exists', 
          `Payment for ${month}/${year} already exists`);
      }

      if (isHubtel) {
        // Avoid duplicate mobile money prompts while a recent request is still awaiting approval
        const inFlight = await db.collection('payments')
          .where('uid', '==', memberUid)
          .where('type', '==', 'monthly_dues')
          .where('month', '==', month)
          .where('year', '==', year)
          .where('status', '==', 'awaiting_payment')
          .get();
        const recent = inFlight.docs.some(d => {
          const created = d.data().createdAt;
          return created && (Date.now() - created.toMillis()) < 10 * 60 * 1000;
        });
        if (recent) {
          throw new functions.https.HttpsError('already-exists',
            `A mobile money prompt for ${month}/${year} is still pending. Approve it on your phone or wait a few minutes.`);
        }
      }
    }

    // Get registration date to validate sequential payment
    const configuredMonth = String(member.duesStartMonth || '');
    const toBillingDate = value => {
      if (!value) return null;
      const date = typeof value.toDate === 'function' ? value.toDate() : new Date(value);
      return Number.isNaN(date.getTime()) ? null : date;
    };
    const fallbackDate = toBillingDate(member.joiningDate) || toBillingDate(member.approvalDate) ||
      toBillingDate(member.approvedAt) || toBillingDate(member.registrationDate) ||
      toBillingDate(member.createdAt) || currentDate;
    const parts = /^\d{4}-(0[1-9]|1[0-2])$/.test(configuredMonth) ? configuredMonth.split('-').map(Number) : null;
    const regDate = parts ? new Date(parts[0], parts[1] - 1, 1) :
      new Date(fallbackDate.getFullYear(), fallbackDate.getMonth(), 1);
    if (months.some(item => new Date(item.year, item.month - 1, 1) < regDate)) {
      throw new functions.https.HttpsError('invalid-argument', 'Selected month is before the dues start month');
    }

    // Get all paid months
    const allPaymentsSnapshot = await db.collection('payments')
      .where('uid', '==', memberUid)
      .where('type', '==', 'monthly_dues')
      .where('status', 'in', ['paid', 'waived'])
      .get();

    const paidMonths = new Set();
    allPaymentsSnapshot.docs.forEach(doc => {
      const payment = doc.data();
      paidMonths.add(monthKey(payment.year, payment.month));
    });

    // Find first unpaid month
    let checkDate = new Date(regDate);
    let firstUnpaid = null;

    while (checkDate <= currentDate) {
      const checkMonth = checkDate.getMonth() + 1;
      const checkYear = checkDate.getFullYear();
      const key = monthKey(checkYear, checkMonth);

      if (!paidMonths.has(key)) {
        firstUnpaid = { month: checkMonth, year: checkYear };
        break;
      }

      checkDate.setMonth(checkDate.getMonth() + 1);
    }

    // Validate paying from first unpaid month sequentially
    if (firstUnpaid) {
      const sortedMonths = months.sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return a.month - b.month;
      });

      const firstPayMonth = sortedMonths[0];
      if (firstPayMonth.month !== firstUnpaid.month || firstPayMonth.year !== firstUnpaid.year) {
        throw new functions.https.HttpsError('invalid-argument', 
          `You must pay sequentially starting from ${firstUnpaid.month}/${firstUnpaid.year}`);
      }

      // Validate all months are consecutive
      let expectedDate = new Date(firstUnpaid.year, firstUnpaid.month - 1, 1);
      for (const monthData of sortedMonths) {
        const expectedMonth = expectedDate.getMonth() + 1;
        const expectedYear = expectedDate.getFullYear();

        if (monthData.month !== expectedMonth || monthData.year !== expectedYear) {
          throw new functions.https.HttpsError('invalid-argument', 
            'Cannot skip months. Must pay consecutively.');
        }

        do {
          expectedDate.setMonth(expectedDate.getMonth() + 1);
        } while (paidMonths.has(monthKey(expectedDate.getFullYear(), expectedDate.getMonth() + 1)));
      }
    }

    // Create payment records
    const batch = db.batch();
    const paymentIds = [];
    
    // Determine payment status
    const paymentStatus = isHubtel ? 'awaiting_payment' : 'pending';

    for (const monthData of months) {
      const { month, year } = monthData;

      const paymentRef = db.collection('payments').doc();
      paymentIds.push(paymentRef.id);

      const paymentData = {
        uid: memberUid,
        requestedBy: actorUid,
        memberName: member.fullName || 'Unknown',
        memberId: member.memberId || null,
        region: member.region || null,
        paymentAccountScope: paymentAccount.scope,
        paymentAccountOwner: paymentAccount.owner,
        type: 'monthly_dues',
        month: month,
        year: year,
        amount: MONTHLY_DUES_AMOUNT,
        paymentMethod: paymentMethod,
        paymentProvider: paymentMethod === 'hubtel' ? 'hubtel' : 'manual',
        notes: notes || null,
        status: paymentStatus,
        createdAt: now
      };

      if (hubtelTransactionId) {
        paymentData.hubtelTransactionId = hubtelTransactionId;
      }

      if (hubtelClientReference) {
        paymentData.hubtelClientReference = hubtelClientReference;
      }

      if (isHubtel) {
        paymentData.hubtelChannel = channel;
        paymentData.hubtelMsisdn = `***${hubtelMsisdn.slice(-4)}`;
        paymentData.requiresApproval = false;
        paymentData.approvalStatus = 'awaiting_payment';
      }

      // Add transfer reference for bank transfers
      if (transferReference) {
        paymentData.transferReference = transferReference;
      }

      // If pending, add approval fields
      if (paymentStatus === 'pending') {
        paymentData.requiresApproval = true;
        paymentData.approvalStatus = 'pending';
      }

      batch.set(paymentRef, paymentData);
    }

    // Create audit log
    const auditRef = db.collection('audit_logs').doc();
    batch.set(auditRef, {
      action: paymentStatus === 'paid' ? 'dues_payment_processed' : 'dues_payment_requested',
      performedBy: actorUid,
      performedByName: memberUid === actorUid ? (member.fullName || member.email) : (context.auth.token?.email || actorUid),
      performedByRole: memberUid === actorUid ? (member.role || 'member') : 'executive_payment_requester',
      details: {
        targetMemberUid: memberUid,
        monthsCount: months.length,
        totalAmount: amount,
        paymentMethod: paymentMethod,
        paymentStatus: paymentStatus,
        paymentAccountScope: paymentAccount.scope,
        paymentAccountOwner: paymentAccount.owner,
        hubtelTransactionId: hubtelTransactionId || null,
        hubtelClientReference: hubtelClientReference || null,
        months: months.map(m => `${m.month}/${m.year}`).join(', ')
      },
      timestamp: now
    });

    // Create notification
    const notificationTitle = paymentStatus === 'paid' ? 
      'Dues Payment Received' : 
      'Payment Request Submitted';
    const notificationMessage = paymentStatus === 'paid' ?
      `Your payment of GHS ${amount.toFixed(2)} for ${months.length} month(s) has been received and verified.` :
      `Your payment request of GHS ${amount.toFixed(2)} for ${months.length} month(s) has been submitted and is pending confirmation.`;
    
    const notificationRef = db.collection('notifications').doc();
    batch.set(notificationRef, {
      uid: memberUid,
      type: paymentStatus === 'paid' ? 'payment_confirmation' : 'payment_pending',
      title: notificationTitle,
      message: notificationMessage,
      status: 'unread',
      createdAt: now
    });

    // ===== ACTIVATE MEMBERSHIP IF PAYMENT IS VERIFIED =====
    if (paymentStatus === 'paid') {
      // Generate membership ID if member doesn't have one
      let memberId = member.memberId;
      if (!memberId) {
        memberId = await generateMembershipId(db, member);
        console.log(`✅ Generated membership ID: ${memberId} for ${member.fullName} (payment activation)`);
      }
      
      // Calculate renewal date (1 year from now or extend existing)
      const currentRenewalDate = member.renewalDate ? member.renewalDate.toDate() : now.toDate();
      const baseDate = currentRenewalDate > now.toDate() ? currentRenewalDate : now.toDate();
      const renewalDate = new Date(baseDate);
      renewalDate.setFullYear(renewalDate.getFullYear() + 1);

      // Update member status to active
      const memberUpdateRef = db.collection('members').doc(memberUid);
      batch.update(memberUpdateRef, {
        status: 'active',
        memberId: memberId,
        renewalDate: admin.firestore.Timestamp.fromDate(renewalDate),
        lastPaymentDate: now,
        updatedAt: now
      });

      // Also update users collection
      const userUpdateRef = db.collection('users').doc(memberUid);
      batch.update(userUpdateRef, {
        status: 'active',
        memberId: memberId,
        renewalDate: admin.firestore.Timestamp.fromDate(renewalDate),
        lastPaymentDate: now,
        updatedAt: now
      });

      console.log(`✅ Member ${memberUid} activated with renewal date: ${renewalDate.toISOString()}`);
    }

    await batch.commit();

    if (isHubtel) {
      try {
        const hubtelResponse = await sendHubtelReceiveMoney({
          paymentAccount,
          msisdn: hubtelMsisdn,
          channel,
          amount,
          description: `AMCAG Dues ${months.length} month(s)`,
          clientReference: hubtelClientReference,
          name: member.fullName,
          email: member.email
        });
        const code = String(hubtelResponse.ResponseCode || '');
        const hubtelData = hubtelResponse.Data || {};
        if (code !== '0001' && code !== '0000') {
          throw new Error(hubtelResponse.Message || `Hubtel responded with code ${code || 'unknown'}`);
        }
        const txId = hubtelData.TransactionId || null;
        if (txId) {
          const followUp = db.batch();
          paymentIds.forEach(id => followUp.update(db.collection('payments').doc(id), {hubtelTransactionId: txId}));
          await followUp.commit();
        }
        return {
          success: true,
          pending: true,
          message: 'Approve the mobile money prompt on your phone to complete payment.',
          paymentIds,
          clientReference: hubtelClientReference,
          totalAmount: amount
        };
      } catch (hubtelError) {
        console.error('Hubtel receive money failed:', hubtelError.response?.data || hubtelError.message);
        const failBatch = db.batch();
        paymentIds.forEach(id => failBatch.update(db.collection('payments').doc(id), {
          status: 'failed',
          hubtelCallbackStatus: 'request_failed',
          updatedAt: admin.firestore.Timestamp.now()
        }));
        await failBatch.commit();
        const apiMessage = hubtelError.response?.data?.Message || hubtelError.response?.data?.message;
        const httpStatus = hubtelError.response?.status;
        throw new functions.https.HttpsError(
          'internal',
          httpStatus === 403
            ? 'Hubtel rejected the request (server IP not whitelisted). Please use another payment method.'
            : (apiMessage || 'Could not start the mobile money payment. Please try again.')
        );
      }
    }

    return { 
      success: true,
      message: `Payment processed successfully for ${months.length} month(s)`,
      paymentIds: paymentIds,
      totalAmount: amount,
      paymentAccountScope: paymentAccount.scope,
      paymentAccountOwner: paymentAccount.owner
    };

  } catch (error) {
    console.error('Error processing dues payment:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// ===== INITIATE HUBTEL ONLINE CHECKOUT =====
exports.initiateHubtelCheckout = functions.https.onCall({
  secrets: HUBTEL_SECRET_NAMES
}, async (request) => {
  if (!request.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const registrationId = String(request.data?.registrationId || '').trim();
  if (!registrationId) {
    throw new functions.https.HttpsError('invalid-argument', 'AGM registration ID is required');
  }

  const db = admin.firestore();
  const registrationRef = db.collection('agmRegistrations').doc(registrationId);
  const registrationDoc = await registrationRef.get();
  if (!registrationDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'AGM registration was not found');
  }

  const registration = registrationDoc.data() || {};
  if (registration.memberUid !== request.auth.uid) {
    throw new functions.https.HttpsError('permission-denied', 'This registration belongs to another member');
  }
  if (String(registration.paymentStatus || '').toLowerCase() === 'paid') {
    throw new functions.https.HttpsError('failed-precondition', 'This AGM registration is already paid');
  }

  const paymentAccount = resolvePaymentAccount({
    type: 'agm_registration',
    region: registration.region
  });
  ensureHubtelCredentialsConfigured(paymentAccount);

  const clientReference = String(registration.paymentReference || `AGM2026-${registrationId}`).trim();
  const callbackUrl = `https://us-central1-amcag-af624.cloudfunctions.net/hubtelWebhook?secret=${encodeURIComponent(HUBTEL_WEBHOOK_SECRET)}`;
  const returnUrl = `https://amcag-af624.web.app/member-dashboard/agm-registration?payment=returned&reference=${encodeURIComponent(clientReference)}`;
  const cancellationUrl = `https://amcag-af624.web.app/member-dashboard/agm-registration?payment=cancelled&reference=${encodeURIComponent(clientReference)}`;
  const checkoutRequest = {
    totalAmount: Number(registration.registrationFee || (await getFeeSettings(db)).registrationFee),
    description: 'AMCAG AGM 2026 Registration',
    callbackUrl,
    returnUrl,
    cancellationUrl,
    merchantAccountNumber: paymentAccount.hubtelApiId,
    clientReference,
    payeeName: registration.fullName || '',
    payeeMobileNumber: registration.phone || '',
    payeeEmail: registration.email || request.auth.token.email || ''
  };

  try {
    const basicAuth = Buffer.from(
      `${paymentAccount.hubtelApiId}:${paymentAccount.hubtelApiKey}`,
      'utf8'
    ).toString('base64');
    const response = await axios.post(
      'https://payproxyapi.hubtel.com/items/initiate',
      checkoutRequest,
      {
        headers: {
          Authorization: `Basic ${basicAuth}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    const payload = response.data || {};
    const responseData = payload.data || payload.Data || payload;
    const checkoutUrl = responseData.checkoutUrl || responseData.CheckoutUrl ||
      responseData.checkoutDirectUrl || responseData.CheckoutDirectUrl || '';
    if (!checkoutUrl) {
      console.error('Hubtel checkout response did not include a checkout URL:', payload);
      throw new Error('Hubtel did not return a checkout URL');
    }

    await registrationRef.set({
      paymentMethod: 'hubtel_online_checkout',
      paymentProvider: 'hubtel',
      paymentAccountScope: paymentAccount.scope,
      paymentAccountOwner: paymentAccount.owner,
      hubtelClientReference: clientReference,
      hubtelCheckoutInitiatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, {merge: true});

    return {success: true, checkoutUrl, clientReference};
  } catch (error) {
    const hubtelMessage = error.response?.data?.message || error.response?.data?.Message || error.message;
    console.error('Hubtel checkout initiation failed:', error.response?.data || error);
    if (error.response?.status === 401) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        `${paymentAccount.owner} Hubtel credentials were rejected. Confirm that the programmable key is active and enabled for Online Checkout.`
      );
    }
    throw new functions.https.HttpsError('internal', hubtelMessage || 'Unable to initiate Hubtel checkout');
  }
});

// ===== HUBTEL PAYMENT CALLBACK HANDLER =====
exports.hubtelWebhook = functions.https.onRequest({
  secrets: ["HUBTEL_WEBHOOK_SECRET"]
}, async (req, res) => {
  if (req.method !== 'POST' || !HUBTEL_WEBHOOK_SECRET) {
    return res.status(401).send('Unauthorized');
  }
  const suppliedSecret = String(
    req.get('x-amcag-webhook-secret') || req.get('x-hubtel-webhook-secret') || req.query?.secret || ''
  ).trim();
  const expected = Buffer.from(HUBTEL_WEBHOOK_SECRET);
  const supplied = Buffer.from(suppliedSecret);
  if (expected.length !== supplied.length || !crypto.timingSafeEqual(expected, supplied)) {
    return res.status(401).send('Unauthorized');
  }
  const payload = req.body || {};
  const data = payload.Data || payload.data || payload;
  const transactionId = data.TransactionId || data.transactionId || data.HubtelTransactionId || data.hubtelTransactionId ||
    data.SalesInvoiceId || data.salesInvoiceId || data.CheckoutId || data.checkoutId || '';
  const clientReference = data.ClientReference || data.clientReference || data.CustomerReference || data.customerReference || '';
  const responseCode = String(payload.ResponseCode || payload.responseCode || '');
  let status = String(data.Status || data.status || payload.Status || payload.status || '').toLowerCase();
  // Direct Receive Money callbacks carry only ResponseCode/Message (0000 = success)
  if (!status && responseCode) {
    status = responseCode === '0000' ? 'success' : (responseCode === '0001' ? 'pending' : 'failed');
  }
  const successStatuses = new Set(['success', 'successful', 'paid', 'completed']);

  // Keep every raw callback (success or failure) for reconciliation and Hubtel UAT samples
  try {
    await admin.firestore().collection('hubtel_callbacks').add({
      type: 'callback',
      clientReference: clientReference || null,
      status: status || null,
      payload,
      receivedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  } catch (logError) {
    console.error('Failed to store Hubtel callback:', logError);
  }

  try {
    if (!successStatuses.has(status)) {
      console.log('Hubtel callback is not successful:', status || 'unknown');
      if (clientReference && ['failed', 'failure', 'cancelled'].includes(status)) {
        const awaiting = await admin.firestore().collection('payments')
          .where('hubtelClientReference', '==', clientReference)
          .where('status', '==', 'awaiting_payment')
          .get();
        if (!awaiting.empty) {
          const failBatch = admin.firestore().batch();
          awaiting.docs.forEach(doc => failBatch.update(doc.ref, {
            status: 'failed',
            hubtelCallbackStatus: status,
            hubtelTransactionId: transactionId || null,
            updatedAt: admin.firestore.Timestamp.now()
          }));
          await failBatch.commit();
        }
      }
      return res.status(200).send('OK');
    }

    if (!transactionId && !clientReference) {
      console.warn('Hubtel callback missing transaction identifier:', payload);
      return res.status(200).send('OK');
    }

    const db = admin.firestore();
    const snapshots = [];

    if (transactionId) {
      snapshots.push(await db.collection('payments')
        .where('hubtelTransactionId', '==', transactionId)
        .get());
    }

    if (clientReference) {
      snapshots.push(await db.collection('payments')
        .where('hubtelClientReference', '==', clientReference)
        .get());
    }

    const docsById = new Map();
    snapshots.forEach(snapshot => {
      snapshot.docs.forEach(doc => docsById.set(doc.id, doc));
    });

    const agmDocsById = new Map();
    if (clientReference) {
      const agmByReference = await db.collection('agmRegistrations')
        .where('paymentReference', '==', clientReference)
        .get();
      agmByReference.docs.forEach(doc => agmDocsById.set(doc.id, doc));

      const agmByHubtelReference = await db.collection('agmRegistrations')
        .where('hubtelClientReference', '==', clientReference)
        .get();
      agmByHubtelReference.docs.forEach(doc => agmDocsById.set(doc.id, doc));
    }

    if (!docsById.size && !agmDocsById.size) {
      console.warn('No pending payment matched Hubtel callback:', { transactionId, clientReference });
      return res.status(200).send('OK');
    }

    const now = admin.firestore.Timestamp.now();
    const batch = db.batch();

    // Guard: callback amount must equal the total of the dues payments sharing this reference
    let amountMismatch = false;
    if (data.Amount !== undefined && clientReference) {
      const sameRef = [...docsById.values()].map(d => d.data()).filter(p => p.hubtelClientReference === clientReference);
      const expectedTotal = sameRef.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
      if (sameRef.length && Math.abs(Number(data.Amount) - expectedTotal) > 0.01) {
        amountMismatch = true;
        console.warn('Hubtel callback amount mismatch:', {clientReference, callback: data.Amount, expected: expectedTotal});
      }
    }

    docsById.forEach(doc => {
      const payment = doc.data();
      if (amountMismatch) return;
      if (String(payment.status || '').toLowerCase() === 'paid') return;

      batch.update(doc.ref, {
        status: 'paid',
        approvalStatus: 'approved',
        requiresApproval: false,
        paymentDate: now,
        processedAt: now,
        verified: true,
        paymentProvider: 'hubtel',
        hubtelTransactionId: transactionId || payment.hubtelTransactionId || null,
        hubtelClientReference: clientReference || payment.hubtelClientReference || null,
        hubtelCallbackStatus: status,
        hubtelCallbackPayload: payload,
        updatedAt: now
      });
    });

    agmDocsById.forEach(doc => {
      const registration = doc.data();
      const updates = {
        paymentStatus: 'paid',
        paymentMethod: 'hubtel_online_checkout',
        paymentProvider: 'hubtel',
        hubtelTransactionId: transactionId || registration.hubtelTransactionId || null,
        hubtelClientReference: clientReference || registration.hubtelClientReference || null,
        hubtelCallbackStatus: status,
        paidAt: now,
        updatedAt: now
      };
      batch.update(doc.ref, updates);
      if (registration.regionId) {
        const regionalRef = db.collection('regions').doc(registration.regionId)
          .collection('agmRegistrations').doc(doc.id);
        batch.set(regionalRef, updates, {merge: true});
      }
    });

    await batch.commit();
    res.status(200).send('OK');
  } catch (error) {
    console.error('Hubtel webhook error:', error);
    res.status(500).send('Error');
  }
});

// ===== HUBTEL TRANSACTION STATUS CHECK =====
// Hubtel requires a status check when no final callback arrives within 5 minutes.
// NOTE: api-txnstatus.hubtel.com only accepts whitelisted IPs (max 4). Cloud Functions need a
// static egress IP (VPC connector + Cloud NAT) that is submitted to Hubtel for whitelisting.
exports.checkHubtelTransactionStatus = functions.https.onCall({
  secrets: HUBTEL_SECRET_NAMES,
  ...HUBTEL_STATIC_EGRESS
}, async (request) => {
  if (!request.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }
  const clientReference = String(request.data?.clientReference || '').trim();
  if (!clientReference || clientReference.length > 36) {
    throw new functions.https.HttpsError('invalid-argument', 'A valid client reference is required');
  }

  const db = admin.firestore();
  const userDoc = await db.collection('users').doc(request.auth.uid).get();
  const role = userDoc.exists ? userDoc.data().role : '';
  const isExecutive = ['super_admin', 'national_executive'].includes(role);

  // Locate the target: an AGM registration or a set of dues payments
  let regDoc = null;
  for (const field of ['paymentReference', 'hubtelClientReference']) {
    const snap = await db.collection('agmRegistrations').where(field, '==', clientReference).limit(1).get();
    if (!snap.empty) { regDoc = snap.docs[0]; break; }
  }
  let paymentDocs = [];
  if (!regDoc) {
    const snap = await db.collection('payments').where('hubtelClientReference', '==', clientReference).get();
    paymentDocs = snap.docs;
  }
  if (!regDoc && !paymentDocs.length) {
    throw new functions.https.HttpsError('not-found', 'No payment matches this reference');
  }

  const registration = regDoc ? (regDoc.data() || {}) : null;
  const ownerUid = registration ? registration.memberUid : paymentDocs[0].data().uid;
  if (ownerUid !== request.auth.uid && !isExecutive) {
    throw new functions.https.HttpsError('permission-denied', 'Not allowed to check this transaction');
  }

  const paymentAccount = registration
    ? resolvePaymentAccount({type: 'agm_registration', region: registration.region})
    : resolvePaymentAccount({
      type: paymentDocs[0].data().type === 'registration_fee' ? 'registration_fee' : 'monthly_dues',
      region: paymentDocs[0].data().region
    });
  ensureHubtelCredentialsConfigured(paymentAccount);
  const basicAuth = Buffer.from(
    `${paymentAccount.hubtelApiId}:${paymentAccount.hubtelApiKey}`, 'utf8'
  ).toString('base64');

  try {
    const response = await axios.get(
      `https://api-txnstatus.hubtel.com/transactions/${encodeURIComponent(paymentAccount.hubtelApiId)}/status`,
      {
        params: {clientReference},
        headers: {Authorization: `Basic ${basicAuth}`},
        timeout: 30000
      }
    );
    const payload = response.data || {};
    const data = payload.data || payload.Data || {};
    const txStatus = String(data.status || data.Status || '').toLowerCase();

    await db.collection('hubtel_callbacks').add({
      type: 'status_check',
      clientReference,
      status: txStatus || null,
      payload,
      receivedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    const now = admin.firestore.Timestamp.now();
    const txId = data.transactionId || data.TransactionId || null;
    if (txStatus === 'paid') {
      const batch = db.batch();
      if (registration && String(registration.paymentStatus || '').toLowerCase() !== 'paid') {
        const updates = {
          paymentStatus: 'paid',
          paymentMethod: 'hubtel_online_checkout',
          paymentProvider: 'hubtel',
          hubtelTransactionId: txId,
          hubtelClientReference: clientReference,
          hubtelCallbackStatus: 'paid',
          paidAt: now,
          updatedAt: now
        };
        batch.update(regDoc.ref, updates);
        if (registration.regionId) {
          batch.set(db.collection('regions').doc(registration.regionId)
            .collection('agmRegistrations').doc(regDoc.id), updates, {merge: true});
        }
      }
      paymentDocs.forEach(doc => {
        const payment = doc.data();
        if (String(payment.status || '').toLowerCase() === 'paid') return;
        batch.update(doc.ref, {
          status: 'paid',
          approvalStatus: 'approved',
          requiresApproval: false,
          paymentDate: now,
          processedAt: now,
          verified: true,
          paymentProvider: 'hubtel',
          hubtelTransactionId: txId || payment.hubtelTransactionId || null,
          hubtelCallbackStatus: 'paid',
          updatedAt: now
        });
      });
      await batch.commit();
    }

    return {success: true, status: txStatus || 'unknown', clientReference};
  } catch (error) {
    console.error('Hubtel status check failed:', error.response?.status, error.response?.data || error.message);
    if (error.response?.status === 403) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Hubtel rejected the request: this server IP is not whitelisted for status checks.'
      );
    }
    throw new functions.https.HttpsError('internal', 'Unable to check transaction status');
  }
});

// ===== APPROVE MANUAL PAYMENT (Regional Executive / National Executive) =====
exports.approveManualPayment = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { paymentIds, action } = data; // action: 'approve' or 'reject'
  const adminUid = context.auth.uid;

  if (!paymentIds || !Array.isArray(paymentIds) || paymentIds.length === 0) {
    throw new functions.https.HttpsError('invalid-argument', 'Payment IDs array is required');
  }

  if (!action || (action !== 'approve' && action !== 'reject')) {
    throw new functions.https.HttpsError('invalid-argument', 'Action must be approve or reject');
  }

  try {
    const db = admin.firestore();
    
    // Verify admin has permission
    const adminDoc = await db.collection('users').doc(adminUid).get();
    if (!adminDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Admin user not found');
    }

    const adminData = adminDoc.data();
    const allowedRoles = ['regional_executive', 'national_executive', 'super_admin'];
    
    if (!allowedRoles.includes(adminData.role)) {
      throw new functions.https.HttpsError('permission-denied', 'Insufficient permissions');
    }

    const now = admin.firestore.Timestamp.now();
    const batch = db.batch();

    for (const paymentId of paymentIds) {
      const paymentRef = db.collection('payments').doc(paymentId);
      const paymentDoc = await paymentRef.get();

      if (!paymentDoc.exists) {
        console.warn('Payment not found:', paymentId);
        continue;
      }

      const payment = paymentDoc.data();

      // Verify payment is pending
      if (payment.status !== 'pending') {
        console.warn('Payment not pending:', paymentId);
        continue;
      }

      // Regional executives can only approve payments from their region
      if (adminData.role === 'regional_executive' && payment.region !== adminData.region) {
        throw new functions.https.HttpsError('permission-denied', 
          'Regional executives can only approve payments from their region');
      }

      // Update payment status
      batch.update(paymentRef, {
        status: action === 'approve' ? 'paid' : 'rejected',
        approvalStatus: action === 'approve' ? 'approved' : 'rejected',
        approvedBy: adminUid,
        approvedByName: adminData.fullName || adminData.email,
        approvedAt: now,
        paymentDate: action === 'approve' ? now : null,
        processedAt: now
      });

      // Create notification for member
      const notificationRef = db.collection('notifications').doc();
      batch.set(notificationRef, {
        uid: payment.uid,
        type: action === 'approve' ? 'payment_approved' : 'payment_rejected',
        title: action === 'approve' ? 'Payment Approved' : 'Payment Rejected',
        message: action === 'approve' ? 
          `Your payment of GHS ${payment.amount.toFixed(2)} for ${payment.month}/${payment.year} has been approved.` :
          `Your payment request of GHS ${payment.amount.toFixed(2)} for ${payment.month}/${payment.year} was rejected. Please contact your regional executive.`,
        status: 'unread',
        createdAt: now
      });

      // ===== ACTIVATE MEMBERSHIP IF PAYMENT IS APPROVED =====
      if (action === 'approve') {
        // Get member data
        const memberDoc = await db.collection('members').doc(payment.uid).get();
        if (memberDoc.exists) {
          const memberData = memberDoc.data();
          
          // Generate membership ID if member doesn't have one
          let memberId = memberData.memberId;
          if (!memberId) {
            memberId = await generateMembershipId(db, {
              ...memberData,
              region: memberData.region || payment.region || null
            });
            console.log(`✅ Generated membership ID: ${memberId} for member ${payment.uid} (manual approval)`);
          }
          
          // Calculate renewal date (1 year from now or extend existing)
          const currentRenewalDate = memberData.renewalDate ? memberData.renewalDate.toDate() : now.toDate();
          const baseDate = currentRenewalDate > now.toDate() ? currentRenewalDate : now.toDate();
          const renewalDate = new Date(baseDate);
          renewalDate.setFullYear(renewalDate.getFullYear() + 1);

          // Update member status to active
          const memberUpdateRef = db.collection('members').doc(payment.uid);
          batch.update(memberUpdateRef, {
            status: 'active',
            memberId: memberId,
            renewalDate: admin.firestore.Timestamp.fromDate(renewalDate),
            lastPaymentDate: now,
            updatedAt: now
          });

          // Also update users collection
          const userUpdateRef = db.collection('users').doc(payment.uid);
          batch.update(userUpdateRef, {
            status: 'active',
            memberId: memberId,
            renewalDate: admin.firestore.Timestamp.fromDate(renewalDate),
            lastPaymentDate: now,
            updatedAt: now
          });

          console.log(`✅ Member ${payment.uid} activated via manual approval with renewal date: ${renewalDate.toISOString()}`);
        }
      }
    }

    // Create audit log
    const auditRef = db.collection('audit_logs').doc();
    batch.set(auditRef, {
      action: action === 'approve' ? 'manual_payment_approved' : 'manual_payment_rejected',
      performedBy: adminUid,
      performedByName: adminData.fullName || adminData.email,
      performedByRole: adminData.role,
      details: {
        paymentIdsCount: paymentIds.length,
        paymentIds: paymentIds
      },
      timestamp: now
    });

    await batch.commit();

    return {
      success: true,
      message: `${paymentIds.length} payment(s) ${action === 'approve' ? 'approved' : 'rejected'} successfully`
    };

  } catch (error) {
    console.error('Error approving payment:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// ===== WAIVE DUES PAYMENT (Regional Financial Secretary) =====
exports.waiveDuesPayment = functions.https.onCall(async (data, context) => {
  // Authentication check
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { memberUid, months, reason } = data;
  const adminUid = context.auth.uid;

  if (!memberUid || !months || !Array.isArray(months) || months.length === 0) {
    throw new functions.https.HttpsError('invalid-argument', 'Member UID and months array are required');
  }

  if (!reason || reason.trim().length < 10) {
    throw new functions.https.HttpsError('invalid-argument', 'Detailed reason required (minimum 10 characters)');
  }

  try {
    const db = admin.firestore();
    
    // Get admin details
    const adminDoc = await db.collection('users').doc(adminUid).get();
    if (!adminDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Admin not found');
    }

    const adminData = adminDoc.data();

    // Get member details
    const memberDoc = await db.collection('users').doc(memberUid).get();
    if (!memberDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Member not found');
    }

    const member = memberDoc.data();

    // Check permissions
    let canWaive = false;

    if (adminData.role === 'super_admin' || adminData.role === 'national_executive') {
      canWaive = true;
    } else if (adminData.role === 'regional_executive' && adminData.region === member.region) {
      // Regional Financial Secretary can waive for their region
      // Check if they have financial secretary permission (could add specific field)
      canWaive = true;
    }

    if (!canWaive) {
      throw new functions.https.HttpsError('permission-denied', 
        'Only National Executives or Regional Financial Secretaries can waive dues');
    }

    const now = admin.firestore.Timestamp.now();
    const MONTHLY_DUES_AMOUNT = (await getFeeSettings(db)).monthlyDues;

    // Validate months and check if already exists
    for (const monthData of months) {
      const { month, year } = monthData;

      // Check if already paid or waived
      const existingPayment = await db.collection('payments')
        .where('uid', '==', memberUid)
        .where('type', '==', 'monthly_dues')
        .where('month', '==', month)
        .where('year', '==', year)
        .where('status', 'in', ['paid', 'waived'])
        .get();

      if (!existingPayment.empty) {
        throw new functions.https.HttpsError('already-exists', 
          `Payment for ${month}/${year} already exists`);
      }
    }

    // Create waiver records
    const batch = db.batch();
    const waiverIds = [];

    for (const monthData of months) {
      const { month, year } = monthData;

      const paymentRef = db.collection('payments').doc();
      waiverIds.push(paymentRef.id);

      batch.set(paymentRef, {
        uid: memberUid,
        memberName: member.fullName || 'Unknown',
        memberId: member.memberId || null,
        region: member.region || null,
        type: 'monthly_dues',
        month: month,
        year: year,
        amount: MONTHLY_DUES_AMOUNT,
        paymentMethod: 'waived',
        status: 'waived',
        waivedBy: adminUid,
        waivedByName: adminData.fullName || adminData.email,
        waivedByRole: adminData.role,
        waiverReason: reason,
        paymentDate: now,
        createdAt: now,
        processedAt: now
      });
    }

    // Create audit log
    const auditRef = db.collection('audit_logs').doc();
    batch.set(auditRef, {
      action: 'dues_payment_waived',
      performedBy: adminUid,
      performedByName: adminData.fullName || adminData.email,
      performedByRole: adminData.role,
      targetUser: memberUid,
      targetUserName: member.fullName,
      details: {
        monthsCount: months.length,
        months: months.map(m => `${m.month}/${m.year}`).join(', '),
        reason: reason,
        region: member.region
      },
      timestamp: now
    });

    // Create notification
    const notificationRef = db.collection('notifications').doc();
    batch.set(notificationRef, {
      uid: memberUid,
      type: 'payment_waived',
      title: 'Dues Payment Waived',
      message: `${months.length} month(s) of dues have been waived. Reason: ${reason}`,
      status: 'unread',
      createdAt: now
    });

    await batch.commit();

    return { 
      success: true,
      message: `Waived ${months.length} month(s) of dues for ${member.fullName}`,
      waiverIds: waiverIds
    };

  } catch (error) {
    console.error('Error waiving dues payment:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// ===== SCHEDULED: MONTHLY DUES REMINDERS =====
// Runs on the 1st day of each month at 9:00 AM
exports.sendMonthlyDuesReminders = onSchedule(
  {
    schedule: '0 9 1 * *', // Cron: At 09:00 on day-of-month 1
    timeZone: 'Africa/Accra',
    memory: '512MiB'
  },
  async (event) => {
    const db = admin.firestore();
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const timestamp = admin.firestore.Timestamp.now();

    console.log(`Starting monthly dues reminders for ${currentMonth}/${currentYear}`);

    try {
      // Get all active members
      const membersSnapshot = await db.collection('users')
        .where('status', '==', 'active')
        .get();

      const members = membersSnapshot.docs.map(doc => ({
        uid: doc.id,
        ...doc.data()
      }));

      console.log(`Processing ${members.length} active members`);

      let remindersCount = 0;
      let overdueCount = 0;
      const MONTHLY_DUES_AMOUNT = (await getFeeSettings(db)).monthlyDues;

      // Process members in batches
      for (const member of members) {
        try {
          const regDate = member.registrationDate ? 
            member.registrationDate.toDate() : 
            new Date();

          // Get member payments
          const paymentsSnapshot = await db.collection('payments')
            .where('uid', '==', member.uid)
            .where('type', '==', 'monthly_dues')
            .where('status', 'in', ['paid', 'waived'])
            .get();

          const paidMonths = new Set();
          paymentsSnapshot.docs.forEach(doc => {
            const payment = doc.data();
            paidMonths.add(`${payment.year}-${payment.month}`);
          });

          // Calculate overdue months
          let checkDate = new Date(regDate);
          const overdueMonths = [];

          while (checkDate < now) {
            const checkMonth = checkDate.getMonth() + 1;
            const checkYear = checkDate.getFullYear();
            const key = `${checkYear}-${checkMonth}`;

            // Don't count current month as overdue on the 1st
            const isCurrentMonth = checkYear === currentYear && checkMonth === currentMonth;
            
            if (!paidMonths.has(key) && !isCurrentMonth) {
              overdueMonths.push({ month: checkMonth, year: checkYear });
            }

            checkDate.setMonth(checkDate.getMonth() + 1);
          }

          // Send reminder if overdue or current month not paid
          const currentMonthKey = `${currentYear}-${currentMonth}`;
          const needsReminder = overdueMonths.length > 0 || !paidMonths.has(currentMonthKey);

          if (needsReminder) {
            const overdueAmount = overdueMonths.length * MONTHLY_DUES_AMOUNT;
            const totalOwed = (overdueMonths.length + (paidMonths.has(currentMonthKey) ? 0 : 1)) * MONTHLY_DUES_AMOUNT;

            let message = '';
            if (overdueMonths.length > 0) {
              message = `You have ${overdueMonths.length} overdue month(s) totaling GHS ${overdueAmount.toFixed(2)}. `;
              overdueCount++;
            }
            message += `Please pay your monthly dues of GHS ${MONTHLY_DUES_AMOUNT.toFixed(2)} for the current month.`;

            // Create notification
            await db.collection('notifications').add({
              uid: member.uid,
              type: overdueMonths.length > 0 ? 'dues_overdue_reminder' : 'dues_payment_reminder',
              title: overdueMonths.length > 0 ? '⚠️ Overdue Dues Payment' : '💰 Monthly Dues Reminder',
              message: message,
              status: 'unread',
              createdAt: timestamp,
              metadata: {
                overdueMonths: overdueMonths.length,
                totalOwed: totalOwed,
                currentMonth: currentMonth,
                currentYear: currentYear
              }
            });

            remindersCount++;
          }

        } catch (memberError) {
          console.error(`Error processing member ${member.uid}:`, memberError);
          // Continue with next member
        }
      }

      // Log completion
      await db.collection('system_logs').add({
        type: 'monthly_dues_reminders_sent',
        month: currentMonth,
        year: currentYear,
        totalMembers: members.length,
        remindersCount: remindersCount,
        overdueCount: overdueCount,
        timestamp: timestamp
      });

      console.log(`Sent ${remindersCount} reminders (${overdueCount} overdue) to ${members.length} members`);
      
      return {
        success: true,
        totalMembers: members.length,
        remindersSent: remindersCount,
        overdueNotifications: overdueCount
      };

    } catch (error) {
      console.error('Error sending monthly dues reminders:', error);
      
      // Log error
      await db.collection('system_logs').add({
        type: 'monthly_dues_reminders_error',
        error: error.message,
        timestamp: timestamp
      });

      throw error;
    }
  }
);

// ===== SCHEDULED: ELECTION TERM REMINDERS =====
// Runs daily at 8:00 AM to check for expiring terms
exports.sendElectionReminders = onSchedule(
  {
    schedule: '0 8 * * *', // Cron: Daily at 08:00
    timeZone: 'Africa/Accra',
    memory: '512MiB'
  },
  async (event) => {
    const db = admin.firestore();
    const now = new Date();
    const timestamp = admin.firestore.Timestamp.now();

    console.log(`Starting election term reminders check for ${now.toLocaleDateString()}`);

    try {
      // Get all active leadership terms
      const termsSnapshot = await db.collection('leadership_terms')
        .get();

      const terms = termsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      console.log(`Checking ${terms.length} leadership terms`);

      let reminders90 = 0;
      let reminders60 = 0;
      let reminders30 = 0;
      let expiredNotifications = 0;

      // Helper: Calculate days between dates
      function daysBetween(date1, date2) {
        const oneDay = 24 * 60 * 60 * 1000;
        return Math.round((date2 - date1) / oneDay);
      }

      // Process each term
      for (const term of terms) {
        try {
          const termEndDate = term.termEndDate.toDate();
          const daysRemaining = daysBetween(now, termEndDate);

          // Skip if already ended early
          if (term.endedEarly) {
            continue;
          }

          // 90-day reminder
          if (daysRemaining <= 90 && daysRemaining > 89 && !term.notification90DaySent) {
            // Send notification to all national executives
            const nationalExecsSnapshot = await db.collection('users')
              .where('role', 'in', ['super_admin', 'national_executive'])
              .get();

            for (const execDoc of nationalExecsSnapshot.docs) {
              await db.collection('notifications').add({
                uid: execDoc.id,
                type: 'election_reminder_90',
                title: '📅 Election Reminder: 90 Days',
                message: `The term for ${term.positionTitle} (${term.incumbentName}) expires in 90 days on ${termEndDate.toLocaleDateString()}. Please schedule elections.`,
                status: 'unread',
                createdAt: timestamp,
                metadata: {
                  termId: term.id,
                  position: term.positionTitle,
                  daysRemaining: daysRemaining,
                  termEndDate: term.termEndDate
                }
              });
            }

            // Update term
            await db.collection('leadership_terms').doc(term.id).update({
              notification90DaySent: true,
              notification90DayDate: timestamp
            });

            reminders90++;
            console.log(`90-day reminder sent for ${term.positionTitle}`);
          }

          // 60-day reminder
          if (daysRemaining <= 60 && daysRemaining > 59 && !term.notification60DaySent) {
            const nationalExecsSnapshot = await db.collection('users')
              .where('role', 'in', ['super_admin', 'national_executive'])
              .get();

            for (const execDoc of nationalExecsSnapshot.docs) {
              await db.collection('notifications').add({
                uid: execDoc.id,
                type: 'election_reminder_60',
                title: '⚠️ Election Reminder: 60 Days',
                message: `URGENT: The term for ${term.positionTitle} (${term.incumbentName}) expires in 60 days on ${termEndDate.toLocaleDateString()}. Elections must be scheduled soon.`,
                status: 'unread',
                createdAt: timestamp,
                metadata: {
                  termId: term.id,
                  position: term.positionTitle,
                  daysRemaining: daysRemaining,
                  termEndDate: term.termEndDate
                }
              });
            }

            await db.collection('leadership_terms').doc(term.id).update({
              notification60DaySent: true,
              notification60DayDate: timestamp
            });

            reminders60++;
            console.log(`60-day reminder sent for ${term.positionTitle}`);
          }

          // 30-day reminder
          if (daysRemaining <= 30 && daysRemaining > 29 && !term.notification30DaySent) {
            const nationalExecsSnapshot = await db.collection('users')
              .where('role', 'in', ['super_admin', 'national_executive'])
              .get();

            for (const execDoc of nationalExecsSnapshot.docs) {
              await db.collection('notifications').add({
                uid: execDoc.id,
                type: 'election_reminder_30',
                title: '🚨 CRITICAL: Election in 30 Days',
                message: `CRITICAL: The term for ${term.positionTitle} (${term.incumbentName}) expires in 30 days on ${termEndDate.toLocaleDateString()}. Immediate action required!`,
                status: 'unread',
                createdAt: timestamp,
                metadata: {
                  termId: term.id,
                  position: term.positionTitle,
                  daysRemaining: daysRemaining,
                  termEndDate: term.termEndDate
                }
              });
            }

            await db.collection('leadership_terms').doc(term.id).update({
              notification30DaySent: true,
              notification30DayDate: timestamp
            });

            reminders30++;
            console.log(`30-day reminder sent for ${term.positionTitle}`);
          }

          // Expired notification (sent once when term expires)
          if (daysRemaining < 0 && !term.notificationExpiredSent) {
            const nationalExecsSnapshot = await db.collection('users')
              .where('role', 'in', ['super_admin', 'national_executive'])
              .get();

            for (const execDoc of nationalExecsSnapshot.docs) {
              await db.collection('notifications').add({
                uid: execDoc.id,
                type: 'election_expired',
                title: '❌ Term Expired',
                message: `The term for ${term.positionTitle} (${term.incumbentName}) has EXPIRED as of ${termEndDate.toLocaleDateString()}. Elections are overdue by ${Math.abs(daysRemaining)} days.`,
                status: 'unread',
                createdAt: timestamp,
                metadata: {
                  termId: term.id,
                  position: term.positionTitle,
                  daysOverdue: Math.abs(daysRemaining),
                  termEndDate: term.termEndDate
                }
              });
            }

            await db.collection('leadership_terms').doc(term.id).update({
              notificationExpiredSent: true,
              notificationExpiredDate: timestamp
            });

            expiredNotifications++;
            console.log(`Expired notification sent for ${term.positionTitle}`);
          }

        } catch (termError) {
          console.error(`Error processing term ${term.id}:`, termError);
          // Continue with next term
        }
      }

      // Log completion
      await db.collection('system_logs').add({
        type: 'election_reminders_sent',
        date: now.toISOString(),
        totalTerms: terms.length,
        reminders90Day: reminders90,
        reminders60Day: reminders60,
        reminders30Day: reminders30,
        expiredNotifications: expiredNotifications,
        timestamp: timestamp
      });

      console.log(`Election reminders: 90-day=${reminders90}, 60-day=${reminders60}, 30-day=${reminders30}, expired=${expiredNotifications}`);
      
      return {
        success: true,
        totalTerms: terms.length,
        reminders90Day: reminders90,
        reminders60Day: reminders60,
        reminders30Day: reminders30,
        expiredNotifications: expiredNotifications
      };

    } catch (error) {
      console.error('Error sending election reminders:', error);
      
      // Log error
      await db.collection('system_logs').add({
        type: 'election_reminders_error',
        error: error.message,
        timestamp: timestamp
      });

      throw error;
    }
  }
);

// ===== WAIVER REQUEST REVIEW =====
exports.reviewWaiverRequest = functions.https.onCall(async (data, context) => {
  // Verify authentication
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'Authentication required'
    );
  }

  const reviewerUid = context.auth.uid;
  const { requestId, decision, reviewNotes } = data;

  // Validate input
  if (!requestId || !decision || !reviewNotes) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Missing required fields: requestId, decision, reviewNotes'
    );
  }

  if (decision !== 'approve' && decision !== 'reject') {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Decision must be "approve" or "reject"'
    );
  }

  try {
    const db = admin.firestore();

    // Get reviewer data
    const reviewerDoc = await db.collection('users').doc(reviewerUid).get();
    if (!reviewerDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Reviewer not found');
    }

    const reviewer = reviewerDoc.data();

    // Verify reviewer is Regional Financial Secretary
    if (reviewer.role !== 'regional_executive') {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Only Regional Financial Secretaries can review waiver requests'
      );
    }

    // Get waiver request
    const requestDoc = await db.collection('waiver_requests').doc(requestId).get();
    if (!requestDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Waiver request not found');
    }

    const request = requestDoc.data();

    // Verify request is from reviewer's region
    if (request.region !== reviewer.region) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Can only review waiver requests from your region'
      );
    }

    // Verify request is pending
    if (request.status !== 'pending') {
      throw new functions.https.HttpsError(
        'failed-precondition',
        `Request already ${request.status}`
      );
    }

    const timestamp = admin.firestore.FieldValue.serverTimestamp();

    // Update waiver request
    await db.collection('waiver_requests').doc(requestId).update({
      status: decision === 'approve' ? 'approved' : 'rejected',
      reviewedBy: reviewerUid,
      reviewedByName: reviewer.fullName || 'Unknown',
      reviewNotes: reviewNotes,
      reviewedAt: timestamp,
      updatedAt: timestamp
    });

    // If approved, create waived payment records
    if (decision === 'approve') {
      const batch = db.batch();

      // Create waived payment records for each month
      for (const monthData of request.months) {
        const paymentRef = db.collection('payments').doc();
        batch.set(paymentRef, {
          uid: request.memberUid,
          memberId: request.memberId,
          memberName: request.memberName,
          region: request.region,
          year: monthData.year,
          month: monthData.month,
          amount: (await getFeeSettings(db)).monthlyDues,
          type: 'monthly_dues',
          status: 'waived',
          waivedBy: reviewerUid,
          waivedByName: reviewer.fullName || 'Unknown',
          waiverReason: `Request approved: ${request.reasonCategory}`,
          waiverRequestId: requestId,
          createdAt: timestamp
        });
      }

      await batch.commit();
    }

    // Send notification to member
    await db.collection('notifications').add({
      uid: request.memberUid,
      type: decision === 'approve' ? 'waiver_approved' : 'waiver_rejected',
      title: decision === 'approve' ? 
        '✅ Waiver Request Approved' : 
        '❌ Waiver Request Rejected',
      message: decision === 'approve' ?
        `Your waiver request for ${request.months.length} month(s) (GHS ${request.totalAmount.toFixed(2)}) has been approved.` :
        `Your waiver request for ${request.months.length} month(s) has been rejected. Review notes: ${reviewNotes}`,
      link: '/member-dashboard/waiver-request.html',
      read: false,
      createdAt: timestamp
    });

    // Log the action
    await db.collection('audit_logs').add({
      type: decision === 'approve' ? 'waiver_approved' : 'waiver_rejected',
      performedBy: reviewerUid,
      performedByName: reviewer.fullName || 'Unknown',
      performedByRole: reviewer.role,
      targetUid: request.memberUid,
      targetName: request.memberName,
      details: {
        requestId: requestId,
        months: request.months,
        totalAmount: request.totalAmount,
        reasonCategory: request.reasonCategory,
        reviewNotes: reviewNotes
      },
      timestamp: timestamp
    });

    return {
      success: true,
      decision: decision
    };

  } catch (error) {
    console.error('Error reviewing waiver request:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// ===== SUSPEND USER =====
exports.suspendUser = functions.https.onCall(async (data, context) => {
  // Verify authentication
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'Authentication required'
    );
  }

  const adminUid = context.auth.uid;
  const { targetUid, durationType, endDate, reason, notes } = data;

  // Validate input
  if (!targetUid || !durationType || !reason || !notes) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Missing required fields'
    );
  }

  if (durationType !== 'temporary' && durationType !== 'permanent') {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Duration type must be "temporary" or "permanent"'
    );
  }

  if (durationType === 'temporary' && !endDate) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'End date required for temporary suspension'
    );
  }

  try {
    const db = admin.firestore();

    // Get admin data
    const adminDoc = await db.collection('users').doc(adminUid).get();
    if (!adminDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Admin not found');
    }

    const adminData = adminDoc.data();

    // Verify admin is Super Admin
    if (adminData.role !== 'super_admin') {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Only Super Admins can suspend users'
      );
    }

    // Get target user
    const targetDoc = await db.collection('users').doc(targetUid).get();
    if (!targetDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Target user not found');
    }

    const targetData = targetDoc.data();

    // Prevent suspending other super admins
    if (targetData.role === 'super_admin') {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Cannot suspend Super Admins'
      );
    }

    const timestamp = admin.firestore.FieldValue.serverTimestamp();

    // Create suspension record
    await db.collection('suspensions').add({
      type: 'user',
      targetUid: targetUid,
      targetName: targetData.fullName || 'Unknown',
      region: targetData.region || null,
      durationType: durationType,
      endDate: endDate || null,
      reason: reason,
      notes: notes,
      suspendedBy: adminUid,
      suspendedByName: adminData.fullName || 'Unknown',
      status: 'active',
      action: 'suspended',
      createdAt: timestamp
    });

    // Mark user as suspended
    await db.collection('users').doc(targetUid).update({
      suspended: true,
      suspensionReason: reason,
      suspensionDate: timestamp
    });

    // Send notification to user
    await db.collection('notifications').add({
      uid: targetUid,
      type: 'account_suspended',
      title: '🚫 Account Suspended',
      message: `Your account has been suspended. Reason: ${reason}. ${durationType === 'temporary' ? `Your account will be automatically reinstated on ${endDate}.` : 'Contact administration for more information.'}`,
      link: null,
      read: false,
      createdAt: timestamp
    });

    // Log the action
    await db.collection('audit_logs').add({
      type: 'user_suspended',
      performedBy: adminUid,
      performedByName: adminData.fullName || 'Unknown',
      performedByRole: adminData.role,
      targetUid: targetUid,
      targetName: targetData.fullName || 'Unknown',
      details: {
        durationType: durationType,
        endDate: endDate,
        reason: reason,
        notes: notes
      },
      timestamp: timestamp
    });

    return {
      success: true
    };

  } catch (error) {
    console.error('Error suspending user:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// ===== UNSUSPEND USER =====
exports.unsuspendUser = functions.https.onCall(async (data, context) => {
  // Verify authentication
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'Authentication required'
    );
  }

  const adminUid = context.auth.uid;
  const { suspensionId } = data;

  if (!suspensionId) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Suspension ID required'
    );
  }

  try {
    const db = admin.firestore();

    // Get admin data
    const adminDoc = await db.collection('users').doc(adminUid).get();
    if (!adminDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Admin not found');
    }

    const adminData = adminDoc.data();

    // Verify admin is Super Admin
    if (adminData.role !== 'super_admin') {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Only Super Admins can unsuspend users'
      );
    }

    // Get suspension record
    const suspensionDoc = await db.collection('suspensions').doc(suspensionId).get();
    if (!suspensionDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Suspension not found');
    }

    const suspension = suspensionDoc.data();

    if (suspension.type !== 'user') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'This is not a user suspension'
      );
    }

    const timestamp = admin.firestore.FieldValue.serverTimestamp();

    // Update suspension record
    await db.collection('suspensions').doc(suspensionId).update({
      status: 'unsuspended',
      unsuspendedBy: adminUid,
      unsuspendedByName: adminData.fullName || 'Unknown',
      unsuspendedAt: timestamp
    });

    // Remove suspension from user
    await db.collection('users').doc(suspension.targetUid).update({
      suspended: false,
      suspensionReason: admin.firestore.FieldValue.delete(),
      suspensionDate: admin.firestore.FieldValue.delete()
    });

    // Send notification to user
    await db.collection('notifications').add({
      uid: suspension.targetUid,
      type: 'account_unsuspended',
      title: '✅ Account Reinstated',
      message: 'Your account suspension has been lifted. You now have full access to the platform.',
      link: null,
      read: false,
      createdAt: timestamp
    });

    // Log the action
    await db.collection('audit_logs').add({
      type: 'user_unsuspended',
      performedBy: adminUid,
      performedByName: adminData.fullName || 'Unknown',
      performedByRole: adminData.role,
      targetUid: suspension.targetUid,
      targetName: suspension.targetName,
      details: {
        originalReason: suspension.reason,
        originalSuspensionDate: suspension.createdAt
      },
      timestamp: timestamp
    });

    return {
      success: true
    };

  } catch (error) {
    console.error('Error unsuspending user:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// ===== SUSPEND REGION =====
exports.suspendRegion = functions.https.onCall(async (data, context) => {
  // Verify authentication
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'Authentication required'
    );
  }

  const adminUid = context.auth.uid;
  const { targetRegion, durationType, endDate, reason, notes } = data;

  // Validate input
  if (!targetRegion || !durationType || !reason || !notes) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Missing required fields'
    );
  }

  if (durationType !== 'temporary' && durationType !== 'permanent') {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Duration type must be "temporary" or "permanent"'
    );
  }

  if (durationType === 'temporary' && !endDate) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'End date required for temporary suspension'
    );
  }

  try {
    const db = admin.firestore();

    // Get admin data
    const adminDoc = await db.collection('users').doc(adminUid).get();
    if (!adminDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Admin not found');
    }

    const adminData = adminDoc.data();

    // Verify admin is Super Admin
    if (adminData.role !== 'super_admin') {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Only Super Admins can suspend regions'
      );
    }

    const timestamp = admin.firestore.FieldValue.serverTimestamp();

    // Create suspension record
    await db.collection('suspensions').add({
      type: 'region',
      targetRegion: targetRegion,
      durationType: durationType,
      endDate: endDate || null,
      reason: reason,
      notes: notes,
      suspendedBy: adminUid,
      suspendedByName: adminData.fullName || 'Unknown',
      status: 'active',
      action: 'suspended',
      createdAt: timestamp
    });

    // Mark region as suspended
    const regionDoc = await db.collection('regions').doc(targetRegion).get();
    if (regionDoc.exists) {
      await db.collection('regions').doc(targetRegion).update({
        suspended: true,
        suspensionReason: reason,
        suspensionDate: timestamp
      });
    } else {
      // Create region document if it doesn't exist
      await db.collection('regions').doc(targetRegion).set({
        name: targetRegion,
        suspended: true,
        suspensionReason: reason,
        suspensionDate: timestamp
      });
    }

    // Get all users in the region
    const usersSnapshot = await db.collection('users')
      .where('region', '==', targetRegion)
      .get();

    // Send notifications to all affected users
    const notificationPromises = [];
    usersSnapshot.docs.forEach(doc => {
      notificationPromises.push(
        db.collection('notifications').add({
          uid: doc.id,
          type: 'region_suspended',
          title: '🚫 Region Suspended',
          message: `The ${targetRegion} region has been suspended. Reason: ${reason}. ${durationType === 'temporary' ? `Regional services will be reinstated on ${endDate}.` : 'Contact national administration for more information.'}`,
          link: null,
          read: false,
          createdAt: timestamp
        })
      );
    });

    await Promise.all(notificationPromises);

    // Log the action
    await db.collection('audit_logs').add({
      type: 'region_suspended',
      performedBy: adminUid,
      performedByName: adminData.fullName || 'Unknown',
      performedByRole: adminData.role,
      targetRegion: targetRegion,
      details: {
        durationType: durationType,
        endDate: endDate,
        reason: reason,
        notes: notes,
        affectedUsers: usersSnapshot.size
      },
      timestamp: timestamp
    });

    return {
      success: true,
      affectedUsers: usersSnapshot.size
    };

  } catch (error) {
    console.error('Error suspending region:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// ===== UNSUSPEND REGION =====
exports.unsuspendRegion = functions.https.onCall(async (data, context) => {
  // Verify authentication
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'Authentication required'
    );
  }

  const adminUid = context.auth.uid;
  const { suspensionId } = data;

  if (!suspensionId) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Suspension ID required'
    );
  }

  try {
    const db = admin.firestore();

    // Get admin data
    const adminDoc = await db.collection('users').doc(adminUid).get();
    if (!adminDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Admin not found');
    }

    const adminData = adminDoc.data();

    // Verify admin is Super Admin
    if (adminData.role !== 'super_admin') {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Only Super Admins can unsuspend regions'
      );
    }

    // Get suspension record
    const suspensionDoc = await db.collection('suspensions').doc(suspensionId).get();
    if (!suspensionDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Suspension not found');
    }

    const suspension = suspensionDoc.data();

    if (suspension.type !== 'region') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'This is not a region suspension'
      );
    }

    const timestamp = admin.firestore.FieldValue.serverTimestamp();

    // Update suspension record
    await db.collection('suspensions').doc(suspensionId).update({
      status: 'unsuspended',
      unsuspendedBy: adminUid,
      unsuspendedByName: adminData.fullName || 'Unknown',
      unsuspendedAt: timestamp
    });

    // Remove suspension from region
    const regionDoc = await db.collection('regions').doc(suspension.targetRegion).get();
    if (regionDoc.exists) {
      await db.collection('regions').doc(suspension.targetRegion).update({
        suspended: false,
        suspensionReason: admin.firestore.FieldValue.delete(),
        suspensionDate: admin.firestore.FieldValue.delete()
      });
    }

    // Get all users in the region
    const usersSnapshot = await db.collection('users')
      .where('region', '==', suspension.targetRegion)
      .get();

    // Send notifications to all affected users
    const notificationPromises = [];
    usersSnapshot.docs.forEach(doc => {
      notificationPromises.push(
        db.collection('notifications').add({
          uid: doc.id,
          type: 'region_unsuspended',
          title: '✅ Region Reinstated',
          message: `The ${suspension.targetRegion} region suspension has been lifted. Regional services are now available.`,
          link: null,
          read: false,
          createdAt: timestamp
        })
      );
    });

    await Promise.all(notificationPromises);

    // Log the action
    await db.collection('audit_logs').add({
      type: 'region_unsuspended',
      performedBy: adminUid,
      performedByName: adminData.fullName || 'Unknown',
      performedByRole: adminData.role,
      targetRegion: suspension.targetRegion,
      details: {
        originalReason: suspension.reason,
        originalSuspensionDate: suspension.createdAt,
        affectedUsers: usersSnapshot.size
      },
      timestamp: timestamp
    });

    return {
      success: true,
      affectedUsers: usersSnapshot.size
    };

  } catch (error) {
    console.error('Error unsuspending region:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// ===== DONATION SYSTEM FUNCTIONS =====

// Import email templates
const emailTemplates = require('./email-templates');
const nodemailer = require('nodemailer');

// Configure email transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'amcag2018@gmail.com',
    pass: process.env.EMAIL_PASS || ''
  }
});

// Submit Donation (Callable)
exports.submitDonation = functions.https.onCall(async (data, context) => {
  try {
    // Check authentication
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const db = admin.firestore();
    const timestamp = admin.firestore.FieldValue.serverTimestamp();
    const now = Date.now();
    
    // Get user data
    const userDoc = await db.collection('users').doc(context.auth.uid).get();
    if (!userDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'User not found');
    }
    const userData = userDoc.data();

    // Validate donation data
    const { type, amount, items, purpose, campaignId, paymentMethod, transactionRef, visibility } = data;

    if (!type || !['monetary', 'material'].includes(type)) {
      throw new functions.https.HttpsError('invalid-argument', 'Invalid donation type');
    }

    if (type === 'monetary' && (!amount || amount <= 0)) {
      throw new functions.https.HttpsError('invalid-argument', 'Invalid donation amount');
    }

    if (type === 'material' && (!items || items.length === 0)) {
      throw new functions.https.HttpsError('invalid-argument', 'No items provided for material donation');
    }

    // Get campaign data if campaignId provided
    let campaignData = null;
    if (campaignId) {
      const campaignDoc = await db.collection('donation_campaigns').doc(campaignId).get();
      if (campaignDoc.exists) {
        campaignData = campaignDoc.data();
      }
    }

    // Create donation document
    const donationData = {
      donorId: context.auth.uid,
      donorUid: context.auth.uid,
      donorName: userData.fullName || userData.email,
      donorEmail: userData.email,
      donorRegion: userData.region || 'unknown',
      type: type,
      status: 'pending',
      visibility: visibility || 'public',
      purpose: purpose || '',
      donatedAt: timestamp,
      createdAt: timestamp,
      _createdAt: now,
      updatedAt: timestamp
    };

    if (type === 'monetary') {
      donationData.amount = parseFloat(amount);
      donationData.paymentMethod = paymentMethod || '';
      donationData.transactionRef = transactionRef || '';
      donationData.currency = 'GHS';
    } else {
      donationData.items = items.map(item => ({
        name: item.name || '',
        quantity: parseFloat(item.quantity) || 0,
        unit: item.unit || 'pcs',
        estimatedValue: parseFloat(item.estimatedValue) || 0
      }));
    }

    if (campaignId && campaignData) {
      donationData.campaignId = campaignId;
      donationData.campaign = campaignId;
      donationData.campaignName = campaignData.name;
      donationData.campaignTitle = campaignData.title || campaignData.name || '';
      donationData.campaignType = campaignData.type;
    }

    // Save donation
    const donationRef = db.collection('donations').doc();
    donationData.donationId = donationRef.id;
    await donationRef.set(donationData);

    // Update campaign progress if applicable
    if (campaignId && type === 'monetary') {
      await db.collection('donation_campaigns').doc(campaignId).update({
        currentAmount: admin.firestore.FieldValue.increment(amount),
        donorCount: admin.firestore.FieldValue.increment(1),
        updatedAt: timestamp
      });
    }

    // Send confirmation email (non-blocking)
    const emailData = {
      donorName: donationData.donorName,
      donationType: type,
      amount: type === 'monetary' ? amount : null,
      items: type === 'material' ? items : null,
      campaignName: campaignData?.name || null,
      donationId: donationRef.id,
      createdAt: now
    };

    const emailContent = emailTemplates.donationConfirmationEmail(emailData);
    
    transporter.sendMail({
      from: process.env.EMAIL_USER || 'amcag2018@gmail.com',
      to: userData.email,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text
    }).catch(error => console.error('Email error:', error));

    // Create notification for regional officers
    const regionalOfficersSnapshot = await db.collection('users')
      .where('region', '==', userData.region)
      .where('role', 'in', ['regional_executive', 'super_admin'])
      .get();

    const notificationPromises = [];
    regionalOfficersSnapshot.docs.forEach(doc => {
      notificationPromises.push(
        db.collection('notifications').add({
          uid: doc.id,
          type: 'new_donation',
          title: `New ${type} donation`,
          message: `${donationData.donorName} submitted a ${type} donation${type === 'monetary' ? ` of GHS ${amount}` : ''}`,
          link: '/region-dashboard/donations.html',
          read: false,
          createdAt: timestamp
        })
      );
    });

    await Promise.all(notificationPromises);

    return {
      success: true,
      donationId: donationRef.id,
      message: 'Donation submitted successfully'
    };

  } catch (error) {
    console.error('Error submitting donation:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// Confirm Donation Receipt (Callable - Regional Officers)
exports.confirmDonationReceipt = functions.https.onCall(async (data, context) => {
  try {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const db = admin.firestore();
    const timestamp = admin.firestore.FieldValue.serverTimestamp();
    const now = Date.now();

    // Get user data
    const userDoc = await db.collection('users').doc(context.auth.uid).get();
    if (!userDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'User not found');
    }
    const userData = userDoc.data();

    // Check if user has permission
    if (!['regional_executive', 'national_executive', 'super_admin'].includes(userData.role)) {
      throw new functions.https.HttpsError('permission-denied', 'Insufficient permissions');
    }

    const { donationId, notes } = data;

    // Get donation
    const donationDoc = await db.collection('donations').doc(donationId).get();
    if (!donationDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Donation not found');
    }
    const donation = donationDoc.data();

    // Check if user is in same region
    if (!['super_admin', 'national_executive'].includes(userData.role) &&
        donation.donorRegion !== userData.region) {
      throw new functions.https.HttpsError('permission-denied', 'Can only confirm donations in your region');
    }

    // Update donation status
    await db.collection('donations').doc(donationId).update({
      status: 'confirmed',
      confirmedBy: context.auth.uid,
      confirmedByName: userData.fullName || userData.email,
      confirmedAt: timestamp,
      _confirmedAt: now,
      confirmationNotes: notes || '',
      updatedAt: timestamp
    });

    // Send receipt email
    const emailData = {
      donorName: donation.donorName,
      donationType: donation.type,
      amount: donation.amount || null,
      items: donation.items || null,
      campaignName: donation.campaignName || null,
      donationId: donationId,
      confirmedAt: now,
      regionalOfficer: userData.fullName || userData.email,
      receiptUrl: `https://amcag.org/receipt/${donationId}` // Placeholder
    };

    const emailContent = emailTemplates.donationReceiptEmail(emailData);
    
    transporter.sendMail({
      from: process.env.EMAIL_USER || 'amcag2018@gmail.com',
      to: donation.donorEmail,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text
    }).catch(error => console.error('Email error:', error));

    // Notify donor
    await db.collection('notifications').add({
      uid: donation.donorId,
      type: 'donation_confirmed',
      title: 'Donation Confirmed ✓',
      message: `Your ${donation.type} donation has been confirmed by ${userData.fullName || 'regional office'}`,
      link: '/member-dashboard/my-donations.html',
      read: false,
      createdAt: timestamp
    });

    // Log activity
    await db.collection('audit_logs').add({
      type: 'donation_confirmed',
      performedBy: context.auth.uid,
      performedByName: userData.fullName || 'Unknown',
      performedByRole: userData.role,
      targetId: donationId,
      details: {
        donorId: donation.donorId,
        donorName: donation.donorName,
        donationType: donation.type,
        amount: donation.amount || null
      },
      timestamp: timestamp
    });

    return {
      success: true,
      message: 'Donation confirmed successfully'
    };

  } catch (error) {
    console.error('Error confirming donation:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// Record Donation Distribution (Callable - Regional Officers)
exports.recordDonationDistribution = functions.https.onCall(async (data, context) => {
  try {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const db = admin.firestore();
    const timestamp = admin.firestore.FieldValue.serverTimestamp();
    const now = Date.now();

    // Get user data
    const userDoc = await db.collection('users').doc(context.auth.uid).get();
    if (!userDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'User not found');
    }
    const userData = userDoc.data();

    // Check permissions
    if (!['regional_executive', 'national_executive', 'super_admin'].includes(userData.role)) {
      throw new functions.https.HttpsError('permission-denied', 'Insufficient permissions');
    }

    const { donationId, beneficiaryName, beneficiaryType, distributionDate, impact, photoUrls } = data;

    // Get donation
    const donationDoc = await db.collection('donations').doc(donationId).get();
    if (!donationDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Donation not found');
    }
    const donation = donationDoc.data();

    // Check region
    if (!['super_admin', 'national_executive'].includes(userData.role) &&
        donation.donorRegion !== userData.region) {
      throw new functions.https.HttpsError('permission-denied', 'Can only record distributions in your region');
    }

    // Update donation
    await db.collection('donations').doc(donationId).update({
      status: 'distributed',
      distributedBy: context.auth.uid,
      distributedByName: userData.fullName || userData.email,
      distributedAt: timestamp,
      _distributedAt: now,
      beneficiaryName: beneficiaryName || '',
      beneficiaryType: beneficiaryType || '',
      distributionDate: distributionDate || now,
      impact: impact || '',
      distributionPhotos: (photoUrls || []).map((url, index) => ({
        url: url,
        uploadedAt: now,
        uploadedBy: context.auth.uid,
        caption: `Distribution photo ${index + 1}`
      })),
      updatedAt: timestamp
    });

    // Send distribution notification email
    const emailData = {
      donorName: donation.donorName,
      donationType: donation.type,
      amount: donation.amount || null,
      items: donation.items || null,
      distributionDate: distributionDate || now,
      beneficiaryName: beneficiaryName,
      beneficiaryType: beneficiaryType,
      impact: impact,
      distributionPhotos: (photoUrls || []).map(url => ({ url })),
      regionalOfficer: userData.fullName || userData.email
    };

    const emailContent = emailTemplates.distributionNotificationEmail(emailData);
    
    transporter.sendMail({
      from: process.env.EMAIL_USER || 'amcag2018@gmail.com',
      to: donation.donorEmail,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text
    }).catch(error => console.error('Email error:', error));

    // Notify donor
    await db.collection('notifications').add({
      uid: donation.donorId,
      type: 'donation_distributed',
      title: 'Donation Distributed! 🎉',
      message: `Your donation has been distributed to ${beneficiaryName}. View photos in your dashboard!`,
      link: '/member-dashboard/my-donations.html',
      read: false,
      createdAt: timestamp
    });

    // Log activity
    await db.collection('audit_logs').add({
      type: 'donation_distributed',
      performedBy: context.auth.uid,
      performedByName: userData.fullName || 'Unknown',
      performedByRole: userData.role,
      targetId: donationId,
      details: {
        donorId: donation.donorId,
        beneficiaryName: beneficiaryName,
        beneficiaryType: beneficiaryType
      },
      timestamp: timestamp
    });

    return {
      success: true,
      message: 'Distribution recorded successfully'
    };

  } catch (error) {
    console.error('Error recording distribution:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// ===== SYNC ROLE CUSTOM CLAIMS =====
// Sets auth.token.executive_role = true for executives so RTDB rules can gate
// announcements and national chat without needing a Firestore read.
const EXECUTIVE_ROLES = new Set(['super_admin', 'national_executive', 'regional_executive']);

async function syncRoleCustomClaim(uid, role) {
  const normalizedRole = String(role || 'member').toLowerCase();
  const isExecutive = EXECUTIVE_ROLES.has(normalizedRole);
  const profileDoc = await admin.firestore().collection('users').doc(uid).get();
  const profile = profileDoc.data() || {};
  const rawRegion = String(profile.regionId || profile.region || profile.regionName || profile.assignedRegion || '').trim();
  const regionKey = rawRegion.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const regionPaths = {};
  if (rawRegion) regionPaths[rawRegion.replace(/[.#$\[\]/]/g, '-').replace(/\s+/g, ' ')] = true;
  if (regionKey) regionPaths[regionKey] = true;
  await admin.database().ref(`user-roles/${uid}`).set({
    role: normalizedRole,
    active: ['active', 'approved'].includes(String(profile.status || '').toLowerCase()),
    regions: regionPaths,
    oversight: chatIsOversight({...profile, role: normalizedRole})
  });
  const userRecord = await admin.auth().getUser(uid);
  const existingClaims = userRecord.customClaims || {};
  await admin.auth().setCustomUserClaims(uid, {
    ...existingClaims,
    executive_role: isExecutive,
    chat_region: regionKey,
    chat_region_paths: regionPaths,
    chat_oversight: chatIsOversight({...profile, role: normalizedRole}),
    role: normalizedRole
  });
}

async function rebuildRegionCounts(db) {
  const [usersSnap, membersSnap] = await Promise.all([
    db.collection('users').get(),
    db.collection('members').get().catch(() => ({ forEach: () => {} }))
  ]);
  const merged = new Map();
  const counts = {};

  function recordUid(doc, data) {
    return data.uid || data.memberUid || doc.id;
  }

  function recordRegion(data) {
    return String(data.region ||
      data.regionName ||
      data.regionId ||
      data.assignedRegion ||
      data.chapter ||
      data.regionalChapter ||
      '').trim();
  }

  membersSnap.forEach((doc) => {
    const d = doc.data() || {};
    const uid = recordUid(doc, d);
    if (uid) merged.set(uid, d);
  });

  usersSnap.forEach((doc) => {
    const d = doc.data() || {};
    if (String(d.role || 'member').toLowerCase() !== 'member') return;
    const uid = recordUid(doc, d);
    if (!uid) return;
    merged.set(uid, {
      ...(merged.get(uid) || {}),
      ...d
    });
  });

  const activeCounts = {};
  merged.forEach((record) => {
    const region = recordRegion(record);
    if (!region) return;
    counts[region] = (counts[region] || 0) + 1;
    if (String(record.status || '').toLowerCase() === 'active') {
      activeCounts[region] = (activeCounts[region] || 0) + 1;
    }
  });

  await db.collection('publicStats').doc('regionCounts').set({
    counts,
    activeCounts,
    memberOnly: true,
    source: 'usersMembersMerged',
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });
}

exports.onUserCreated = onDocumentCreated('users/{uid}', async (event) => {
  const uid = event.params.uid;
  const data = event.data?.data() || {};
  const db = admin.firestore();
  if (data.role) {
    try { await syncRoleCustomClaim(uid, data.role); } catch (err) {
      console.error(`onUserCreated: failed to set custom claim for ${uid}:`, err);
    }
  }
  try { await rebuildRegionCounts(db); } catch (err) {
    console.error('onUserCreated: failed to rebuild region counts:', err);
  }
  if (data.status === 'pending' && data.role === 'member') {
    try { await notifyApproversOfPendingMember(db, uid, data); } catch (err) {
      console.error('onUserCreated: failed to notify approvers:', err);
    }
  }
});

// Tell everyone who can approve this member (super admin, national executives, and
// regional approvers for the member's region) through the in-app bell.
async function notifyApproversOfPendingMember(db, memberUid, member) {
  const norm = (v) => String(v || '').trim().toLowerCase().replace(/[\s_-]+/g, '-');
  const memberRegion = norm(member.region || member.regionName || member.assignedRegion || member.regionId);
  const snap = await db.collection('users').where('role', 'in', ['super_admin', 'national_executive', 'regional_executive']).get();
  const recipients = snap.docs.filter((doc) => {
    const u = doc.data();
    if (u.status && u.status !== 'active') return false;
    if (u.role !== 'regional_executive') return true;
    return u.canApproveMembership === true && memberRegion &&
      norm(u.region || u.regionId || u.assignedRegion) === memberRegion;
  });
  if (!recipients.length) return;
  const name = member.fullName || 'A new member';
  const regionLabel = member.region || 'unknown region';
  const batch = db.batch();
  recipients.forEach((doc) => {
    batch.set(db.collection('notifications').doc('pending_' + memberUid + '_' + doc.id), {
      uid: doc.id,
      type: 'new_member_pending',
      title: 'New member awaiting approval',
      message: name + ' (' + regionLabel + ') has registered and is waiting for approval.',
      link: doc.data().role === 'regional_executive' ? '/region-dashboard/member-approval.html' : '/national/member-approval.html',
      read: false,
      status: 'unread',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
  });
  await batch.commit();
}

const { onDocumentUpdated } = require('firebase-functions/v2/firestore');
exports.onUserRoleChanged = onDocumentUpdated('users/{uid}', async (event) => {
  const uid = event.params.uid;
  const before = event.data.before.data() || {};
  const after = event.data.after.data() || {};
  const db = admin.firestore();
  if (before.role !== after.role || before.region !== after.region || before.regionId !== after.regionId || before.regionName !== after.regionName || before.assignedRegion !== after.assignedRegion || before.status !== after.status) {
    try { await syncRoleCustomClaim(uid, after.role); } catch (err) {
      console.error(`onUserRoleChanged: failed to set custom claim for ${uid}:`, err);
    }
  }
  if (before.region !== after.region || before.status !== after.status) {
    try { await rebuildRegionCounts(db); } catch (err) {
      console.error('onUserRoleChanged: failed to rebuild region counts:', err);
    }
  }
});

// Callable: one-time seed / admin refresh of publicStats/regionCounts
exports.rebuildRegionStats = functions.https.onCall(async (request) => {
  const context = request;
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');
  const db = admin.firestore();
  const callerDoc = await db.collection('users').doc(context.auth.uid).get();
  if (!['super_admin', 'national_executive'].includes(callerDoc.data()?.role)) {
    throw new functions.https.HttpsError('permission-denied', 'Admins only');
  }
  await rebuildRegionCounts(db);
  return { success: true };
});

// Callable: lets admins force-sync custom claims for an existing user
exports.syncUserClaims = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');
  const db = admin.firestore();
  const callerDoc = await db.collection('users').doc(context.auth.uid).get();
  if (!['super_admin', 'national_executive'].includes(callerDoc.data()?.role)) {
    throw new functions.https.HttpsError('permission-denied', 'Admins only');
  }
  const targetUid = data.uid;
  if (!targetUid) throw new functions.https.HttpsError('invalid-argument', 'uid required');
  const targetDoc = await db.collection('users').doc(targetUid).get();
  if (!targetDoc.exists) throw new functions.https.HttpsError('not-found', 'User not found');
  await syncRoleCustomClaim(targetUid, targetDoc.data().role);
  return { success: true };
});

// Callable: lets a signed-in user refresh their own RTDB role claim from Firestore.
exports.refreshMyClaims = functions.https.onCall(async (request) => {
  const context = request;
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');
  }

  const db = admin.firestore();
  const userDoc = await db.collection('users').doc(context.auth.uid).get();
  if (!userDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'User profile not found');
  }

  const role = String(userDoc.data().role || 'member').toLowerCase();
  await syncRoleCustomClaim(context.auth.uid, role);

  return {
    success: true,
    executiveRole: EXECUTIVE_ROLES.has(role),
    oversight: chatIsOversight(userDoc.data()),
    role
  };
});

// Trigger: Send notification when donation created
exports.onDonationCreated = onDocumentCreated('donations/{donationId}', async (event) => {
  try {
    const donation = event.data.data();
    const donationId = event.params.donationId;
    const db = admin.firestore();

    // Log donation creation
    await db.collection('audit_logs').add({
      type: 'donation_created',
      performedBy: donation.donorId,
      performedByName: donation.donorName,
      targetId: donationId,
      details: {
        type: donation.type,
        amount: donation.amount || null,
        region: donation.donorRegion
      },
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

  } catch (error) {
    console.error('Error in onDonationCreated:', error);
  }
});

// Scheduled: Update donor tiers daily
exports.updateDonorTiers = onSchedule('every day 00:00', async (event) => {
  try {
    const db = admin.firestore();

    // Get all users
    const usersSnapshot = await db.collection('users').get();
    
    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      
      // Calculate total donations
      const donationsSnapshot = await db.collection('donations')
        .where('donorId', '==', userId)
        .where('type', '==', 'monetary')
        .where('status', 'in', ['confirmed', 'distributed'])
        .get();
      
      const totalDonated = donationsSnapshot.docs.reduce((sum, doc) => {
        return sum + (doc.data().amount || 0);
      }, 0);
      
      // Calculate tier
      let tier = 'bronze';
      if (totalDonated >= 5000) tier = 'diamond';
      else if (totalDonated >= 1000) tier = 'platinum';
      else if (totalDonated >= 500) tier = 'gold';
      else if (totalDonated >= 100) tier = 'silver';
      
      // Update user tier
      await db.collection('users').doc(userId).update({
        donorTier: tier,
        totalDonated: totalDonated,
        donationCount: donationsSnapshot.size,
        tierUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }
    
    console.log('Donor tiers updated successfully');
  } catch (error) {
    console.error('Error updating donor tiers:', error);
  }
});

// ============================================================================
// MEETING MANAGEMENT FUNCTIONS
// ============================================================================

/**
 * Schedule a Meeting
 * Called by: Regional/National Dashboard
 */
exports.scheduleMeeting = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const uid = context.auth.uid;
  const db = admin.firestore();

  try {
    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'User profile not found');
    }

    const userData = userDoc.data();

    // Check permissions
    const { type } = data;
    
    if (type === 'national' &&
        !['national_executive', 'super_admin'].includes(userData.role)) {
      throw new functions.https.HttpsError('permission-denied', 'Only national executives can schedule national meetings');
    }

    if (type === 'regional' &&
        !['regional_executive', 'national_executive', 'super_admin'].includes(userData.role)) {
      throw new functions.https.HttpsError('permission-denied', 'Only regional executives can schedule regional meetings');
    }

    const { title, description, scheduledTime, duration, region, visibility, meetingFormat } = data;

    if (!title || !scheduledTime) {
      throw new functions.https.HttpsError('invalid-argument', 'Title and scheduled time required');
    }

    // Generate meeting ID
    const meetingId = db.collection('meetings').doc().id.substring(0, 8);

    // Create meeting document
    const meetingData = {
      meetingId,
      title,
      description: description || null,
      scheduledTime: admin.firestore.Timestamp.fromDate(new Date(scheduledTime)),
      duration: duration || 60,
      type,
      region: type === 'regional' ? region : null,
      visibility: visibility || 'members',
      meetingFormat: meetingFormat === 'audio' ? 'audio' : 'video',
      hostUid: uid,
      hostName: userData.fullName,
      hostEmail: userData.email,
      participants: 0,
      status: 'scheduled',
      reminderSent: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: uid
    };

    const meetingRef = await db.collection('meetings').add(meetingData);

    // Send notifications to attendees
    const notificationData = {
      type: 'meeting_scheduled',
      title: 'New Meeting Scheduled',
      message: `${title} scheduled for ${new Date(scheduledTime).toLocaleString()}`,
      meetingId: meetingRef.id,
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    if (type === 'national') {
      // Notify all national executives
      const executivesSnapshot = await db.collection('users')
        .where('role', 'in', ['national_executive', 'super_admin'])
        .get();
      
      const batch = db.batch();
      executivesSnapshot.docs.forEach(doc => {
        if (doc.id !== uid) { // Don't notify the creator
          const notifRef = db.collection('notifications').doc();
          batch.set(notifRef, {
            ...notificationData,
            recipientUid: doc.id
          });
        }
      });
      await batch.commit();

    } else if (type === 'regional') {
      // Notify all members in the region
      const regionMembersSnapshot = await db.collection('users')
        .where('region', '==', region)
        .get();
      
      const batch = db.batch();
      regionMembersSnapshot.docs.forEach(doc => {
        if (doc.id !== uid) {
          const notifRef = db.collection('notifications').doc();
          batch.set(notifRef, {
            ...notificationData,
            recipientUid: doc.id
          });
        }
      });
      await batch.commit();

    } else if (type === 'general') {
      // Notify all members
      const allMembersSnapshot = await db.collection('users')
        .where('status', '==', 'active')
        .get();
      
      const batch = db.batch();
      let count = 0;
      allMembersSnapshot.docs.forEach(doc => {
        if (doc.id !== uid && count < 500) { // Firestore batch limit
          const notifRef = db.collection('notifications').doc();
          batch.set(notifRef, {
            ...notificationData,
            recipientUid: doc.id
          });
          count++;
        }
      });
      await batch.commit();
    }

    // Log activity
    await db.collection('activity_logs').add({
      action: 'meeting_scheduled',
      performedBy: uid,
      performedByName: userData.fullName,
      details: {
        meetingId,
        title,
        type,
        scheduledTime: new Date(scheduledTime).toISOString()
      },
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    return {
      success: true,
      meetingId: meetingRef.id,
      message: 'Meeting scheduled successfully'
    };

  } catch (error) {
    console.error('Error scheduling meeting:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

/**
 * Send Meeting Reminders
 * Runs every minute to check for meetings starting in 15 minutes
 */
exports.sendMeetingReminders = functions.scheduler.onSchedule('every 1 minutes', async (context) => {
  try {
    const db = admin.firestore();
    const now = new Date();
    const fifteenMinutesFromNow = new Date(now.getTime() + 15 * 60000);
    const sixteenMinutesFromNow = new Date(now.getTime() + 16 * 60000);

    // Find meetings starting between 15-16 minutes from now
    const meetingsSnapshot = await db.collection('meetings')
      .where('scheduledTime', '>=', admin.firestore.Timestamp.fromDate(fifteenMinutesFromNow))
      .where('scheduledTime', '<', admin.firestore.Timestamp.fromDate(sixteenMinutesFromNow))
      .where('reminderSent', '==', false)
      .get();

    if (meetingsSnapshot.empty) {
      console.log('No meetings requiring reminders');
      return null;
    }

    console.log(`Sending reminders for ${meetingsSnapshot.size} meetings`);

    for (const meetingDoc of meetingsSnapshot.docs) {
      const meeting = meetingDoc.data();
      const meetingId = meetingDoc.id;

      // Get attendees based on meeting type
      let attendeesSnapshot;
      
      if (meeting.type === 'national') {
        attendeesSnapshot = await db.collection('users')
          .where('role', 'in', ['national_executive', 'super_admin'])
          .get();
      } else if (meeting.type === 'regional') {
        attendeesSnapshot = await db.collection('users')
          .where('region', '==', meeting.region)
          .get();
      } else {
        attendeesSnapshot = await db.collection('users')
          .where('status', '==', 'active')
          .get();
      }

      // Send emails to attendees
      const emailPromises = attendeesSnapshot.docs.map(async (userDoc) => {
        const user = userDoc.data();
        
        if (!user.email) return;

        const meetingTime = meeting.scheduledTime.toDate().toLocaleString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });

        const emailHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #1976d2 0%, #1565c0 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: white; padding: 30px; border: 1px solid #e0e0e0; }
              .meeting-info { background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0; }
              .meeting-info h3 { margin-top: 0; color: #1976d2; }
              .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e0e0e0; }
              .info-label { font-weight: bold; color: #666; }
              .btn { display: inline-block; padding: 12px 30px; background: #4caf50; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
              .footer { text-align: center; padding: 20px; color: #999; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🔔 Meeting Reminder</h1>
                <p style="margin: 0; font-size: 18px;">Starting in 15 minutes!</p>
              </div>
              
              <div class="content">
                <h2>Hello ${user.fullName},</h2>
                <p>This is a friendly reminder that your AMCAG meeting is starting soon.</p>
                
                <div class="meeting-info">
                  <h3>${meeting.title}</h3>
                  <div class="info-row">
                    <span class="info-label">When:</span>
                    <span>${meetingTime}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">Duration:</span>
                    <span>${meeting.duration} minutes</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">Type:</span>
                    <span>${meeting.type.charAt(0).toUpperCase() + meeting.type.slice(1)}</span>
                  </div>
                  ${meeting.description ? `
                    <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e0e0e0;">
                      <strong>Description:</strong>
                      <p style="margin: 5px 0 0 0;">${meeting.description}</p>
                    </div>
                  ` : ''}
                </div>

                <center>
                  <a href="https://amcag-af624.web.app/member-dashboard/meetings.html" class="btn">
                    📹 Join Meeting Now
                  </a>
                </center>

                <p style="color: #666; font-size: 14px; margin-top: 20px;">
                  <strong>Meeting Link:</strong><br>
                  <a href="https://meet.jit.si/amcag-${meetingId}">https://meet.jit.si/amcag-${meetingId}</a>
                </p>
              </div>
              
              <div class="footer">
                <p>Association of Medicine Counter Assistants Ghana (AMCAG)</p>
                <p>This is an automated reminder. Please do not reply to this email.</p>
              </div>
            </div>
          </body>
          </html>
        `;

        const mailOptions = {
          from: `AMCAG Meetings <${process.env.EMAIL_USER || 'amcag2018@gmail.com'}>`,
          to: user.email,
          subject: `⏰ Reminder: ${meeting.title} starts in 15 minutes`,
          html: emailHtml
        };

        try {
          await transporter.sendMail(mailOptions);
          console.log(`Reminder sent to ${user.email}`);
        } catch (error) {
          console.error(`Failed to send to ${user.email}:`, error);
        }
      });

      await Promise.all(emailPromises);

      // Mark reminder as sent
      await db.collection('meetings').doc(meetingId).update({
        reminderSent: true
      });

      console.log(`Reminders sent for meeting: ${meeting.title}`);
    }

    return null;
  } catch (error) {
    console.error('Error sending meeting reminders:', error);
    return null;
  }
});

// ============================================================================
// DAILY QUESTION EMAILS
// ============================================================================
const dailyQuestions = require('./daily-questions');
const questionStore = require('./question-store');

const UNSUBSCRIBE_BASE_URL = 'https://us-central1-amcag-af624.cloudfunctions.net/unsubscribeDailyQuestions';

function createDailyQuestionTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    pool: true,
    maxConnections: 3,
    auth: {
      user: process.env.EMAIL_USER || 'amcag2018@gmail.com',
      pass: process.env.EMAIL_PASS || ''
    }
  });
}

async function ensureUnsubscribeToken(userDoc) {
  const existing = userDoc.data().dailyQuestionsToken;
  if (existing) return existing;
  const token = crypto.randomBytes(16).toString('hex');
  await userDoc.ref.update({dailyQuestionsToken: token});
  return token;
}

// Every morning at 07:00 (Africa/Accra): today's question plus yesterday's answer.
// Needs the EMAIL_PASS secret (Gmail app password for EMAIL_USER).
exports.sendDailyQuestions = onSchedule(
  {
    schedule: '0 7 * * *',
    timeZone: 'Africa/Accra',
    memory: '512MiB',
    timeoutSeconds: 540,
    secrets: ['EMAIL_PASS']
  },
  async () => {
    const db = admin.firestore();
    const dayNo = dailyQuestions.dayNumber();
    const today = await questionStore.getQuestionForDay(db, admin, dayNo);
    const yesterday = await questionStore.getQuestionForDay(db, admin, dayNo - 1, {create: false});
    const cap =Number(process.env.DAILY_QUESTION_MAX || 400);
    const transporter = createDailyQuestionTransporter();
    const from = `AMCAG Question of the Day <${process.env.EMAIL_USER || 'amcag2018@gmail.com'}>`;

    const snapshot = await db.collection('users').where('status', '==', 'active').get();
    const recipients = snapshot.docs.filter((doc) => {
      const u = doc.data();
      return u.email && u.dailyQuestionsOptOut !== true;
    });

    let sent = 0;
    let failed = 0;
    const batch = recipients.slice(0, cap);

    // In-app notification (bell) for every active member, independent of the email cap or opt-out.
    try {
      const FieldValue = admin.firestore.FieldValue;
      for (let i = 0; i < snapshot.docs.length; i += 400) {
        const wb = db.batch();
        snapshot.docs.slice(i, i + 400).forEach((doc) => {
          wb.set(db.collection('notifications').doc('dq_' + dayNo + '_' + doc.id), {
            uid: doc.id,
            type: 'daily_question',
            title: 'Question of the Day',
            message: today.topic + ': ' + today.question,
            link: '/member-dashboard/daily-question.html',
            read: false,
            status: 'unread',
            createdAt: FieldValue.serverTimestamp()
          });
        });
        await wb.commit();
      }
    } catch (error) {
      console.error('Daily question in-app notifications failed:', error.message);
    }
    if (recipients.length > cap) {
      console.warn(`Daily questions: ${recipients.length} recipients, capped at ${cap} (Gmail daily limit).`);
    }

    for (let i = 0; i < batch.length; i += 5) {
      const chunk = batch.slice(i, i + 5);
      await Promise.all(chunk.map(async (doc) => {
        try {
          const user = doc.data();
          const token = await ensureUnsubscribeToken(doc);
          const unsubscribeUrl = `${UNSUBSCRIBE_BASE_URL}?uid=${encodeURIComponent(doc.id)}&token=${token}`;
          const mail = dailyQuestions.buildDailyQuestionEmail({
            name: user.fullName, today, yesterday, unsubscribeUrl
          });
          await transporter.sendMail({
            from,
            to: user.email,
            subject: mail.subject,
            html: mail.html,
            text: mail.text,
            headers: {'List-Unsubscribe': `<${unsubscribeUrl}>`}
          });
          sent++;
        } catch (error) {
          failed++;
          console.error(`Daily question email failed for ${doc.id}:`, error.message);
        }
      }));
    }

    console.log(`Daily questions: question ${today.id || today.index}, sent ${sent}, failed ${failed}, recipients ${recipients.length}`);
  }
);

// One-click unsubscribe link used in each email.
exports.unsubscribeDailyQuestions = functions.https.onRequest(async (req, res) => {
  const uid = String(req.query.uid || '');
  const token = String(req.query.token || '');
  const page = (message) => res.status(200).send(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<body style="font-family:Segoe UI,Arial,sans-serif;max-width:520px;margin:60px auto;padding:0 20px;color:#1a2433">` +
    `<h2 style="color:#0b5d3b">AMCAG</h2><p>${message}</p></body>`
  );
  try {
    const doc = uid ? await admin.firestore().collection('users').doc(uid).get() : null;
    const stored = doc && doc.exists ? String(doc.data().dailyQuestionsToken || '') : '';
    const a = Buffer.from(stored);
    const b = Buffer.from(token);
    if (!stored || a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return page('This unsubscribe link is not valid.');
    }
    await doc.ref.update({dailyQuestionsOptOut: true});
    return page('You have been unsubscribed from the daily question emails.');
  } catch (error) {
    console.error('unsubscribeDailyQuestions error:', error);
    return page('Something went wrong. Please try again later.');
  }
});

// Admin test: sends today's question email to the signed-in super admin only.
exports.sendTestDailyQuestion = functions.https.onCall({
  secrets: ['EMAIL_PASS']
}, async (request) => {
  if (!request.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }
  const db = admin.firestore();
  const callerDoc = await db.collection('users').doc(request.auth.uid).get();
  if (!callerDoc.exists || callerDoc.data().role !== 'super_admin' || !callerDoc.data().email) {
    throw new functions.https.HttpsError('permission-denied', 'Super admins only');
  }
  const dayNo = dailyQuestions.dayNumber();
  const token = await ensureUnsubscribeToken(callerDoc);
  const mail = dailyQuestions.buildDailyQuestionEmail({
    name: callerDoc.data().fullName,
    today: await questionStore.getQuestionForDay(db, admin, dayNo),
    yesterday: await questionStore.getQuestionForDay(db, admin, dayNo - 1, {create: false}),
    unsubscribeUrl: `${UNSUBSCRIBE_BASE_URL}?uid=${encodeURIComponent(request.auth.uid)}&token=${token}`
  });
  await createDailyQuestionTransporter().sendMail({
    from: `AMCAG Question of the Day <${process.env.EMAIL_USER || 'amcag2018@gmail.com'}>`,
    to: callerDoc.data().email,
    subject: `[TEST] ${mail.subject}`,
    html: mail.html,
    text: mail.text
  });
  return {success: true};
});

// ============================================================================
// MEMBER ID CARD: QR TOKEN + PUBLIC VERIFICATION
// ============================================================================
const MEMBER_ID_PATTERN = /^AMCAG-[A-Z]{2,4}-\d{4}-\d{3,6}$/i;

// Returns the secret token embedded in a member's ID card QR code (created on first use).
// A member can fetch their own; national executives / super admins can fetch any member's.
// ID cards are valid for 3 years from the day the card was first issued (when the registration fee was paid),
// and again from the renewal date after a renewal.
const CARD_VALID_YEARS = 3;
function tsToDate(v) { return v && typeof v.toDate === 'function' ? v.toDate() : null; }
function addYears(date, years) { const d = new Date(date); d.setFullYear(d.getFullYear() + years); return d; }
async function ensureCardExpiry(userRef, user) {
  let issued = tsToDate(user.cardIssuedAt);
  let expires = tsToDate(user.cardExpiresAt);
  if (!issued || !expires) {
    issued = tsToDate(user.registrationFeePaidAt) || new Date();
    expires = addYears(issued, CARD_VALID_YEARS);
    await userRef.update({
      cardIssuedAt: admin.firestore.Timestamp.fromDate(issued),
      cardExpiresAt: admin.firestore.Timestamp.fromDate(expires)
    });
  }
  return {issued, expires};
}

exports.issueIdCardToken = functions.https.onCall(async (request) => {
  if (!request.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }
  const db = admin.firestore();
  const targetUid = String(request.data?.uid || request.auth.uid);

  const userRef = db.collection('users').doc(targetUid);
  const userDoc = await userRef.get();
  if (!userDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Member not found');
  }
  const user = userDoc.data();

  if (targetUid !== request.auth.uid) {
    // Only the super admin and selected executives may open other people's cards.
    const callerDoc = await db.collection('users').doc(request.auth.uid).get();
    const access = callerDoc.exists ? canViewQuestionAnswers(callerDoc.data()) : {allowed: false};
    const regionOk = !access.region || normRegion(access.region) === normRegion(user.region);
    if (!access.allowed || !regionOk) {
      throw new functions.https.HttpsError('permission-denied', 'Not allowed to view this ID card');
    }
  }

  if (user.status !== 'active') {
    throw new functions.https.HttpsError('failed-precondition', 'Member is not active yet');
  }
  if (user.registrationFeePaid !== true) {
    throw new functions.https.HttpsError('failed-precondition', 'REGISTRATION_FEE_UNPAID');
  }
  if (!user.memberId) {
    // Executives and admin-created accounts are not approved through the member flow: give them an ID now.
    const newId = await generateMembershipId(db, user);
    await userRef.update({memberId: newId});
    try {
      const mirror = db.collection('members').doc(targetUid);
      if ((await mirror.get()).exists) await mirror.update({memberId: newId});
    } catch (e) { console.warn('members mirror memberId update skipped:', e.message); }
    user.memberId = newId;
  }

  let token = user.cardToken;
  if (!token) {
    token = crypto.randomBytes(12).toString('hex');
    await userRef.update({cardToken: token});
  }
  const expiry = await ensureCardExpiry(userRef, user);
  return {success: true, memberId: user.memberId, token, cardIssuedAt: expiry.issued.toISOString(), cardExpiresAt: expiry.expires.toISOString(), cardExpired: expiry.expires.getTime() < Date.now()};
});

// Public verification used by the QR code. Without a valid token only the validity state
// is returned; with the token printed in the QR code, basic card details are returned.
exports.verifyMembership = functions.https.onCall(async (request) => {
  const memberId = String(request.data?.memberId || '').trim().toUpperCase();
  const token = String(request.data?.token || '').trim();
  if (!MEMBER_ID_PATTERN.test(memberId)) {
    return {state: 'not_found'};
  }

  const snap = await admin.firestore().collection('users')
    .where('memberId', '==', memberId).limit(1).get();
  if (snap.empty) {
    return {state: 'not_found'};
  }

  const user = snap.docs[0].data();
  let renewal = tsToDate(user.cardExpiresAt);
  if (!renewal && user.registrationFeePaid === true) {
    const base = tsToDate(user.registrationFeePaidAt);
    if (base) renewal = addYears(base, CARD_VALID_YEARS);
  }
  const status = String(user.status || '').toLowerCase();

  let state = 'valid';
  if (status === 'suspended') state = 'suspended';
  else if (status !== 'active' || user.registrationFeePaid !== true) state = 'inactive';
  else if (renewal && renewal.getTime() < Date.now()) state = 'expired';

  const stored = String(user.cardToken || '');
  const a = Buffer.from(stored);
  const b = Buffer.from(token);
  const tokenOk = stored && a.length === b.length && crypto.timingSafeEqual(a, b);
  if (!tokenOk) {
    return {state, memberId, detailsHidden: true};
  }

  const sinceDate = ['registrationDate', 'approvedAt', 'createdAt']
    .map((k) => user[k] && typeof user[k].toDate === 'function' ? user[k].toDate() : null)
    .find(Boolean);

  return {
    state,
    memberId,
    name: user.fullName || '',
    region: user.region || '',
    memberSince: sinceDate ? sinceDate.getFullYear() : null,
    validUntil: renewal ? renewal.toISOString() : null,
    photoUrl: user.profilePictureUrl || user.photoURL || user.photoUrl || null
  };
});

// ================================================================
// Donation campaigns: who may create them and how regional ones get approved
// Selected executives only (president, secretary, PRO). National ones go live at once;
// regional ones wait for the national president, national PRO or super admin.
// ================================================================
const CAMPAIGN_APPROVER_PATTERN = /(^|[^a-z])(president|pro|public relations( officer)?)([^a-z]|$)/;
const CAMPAIGN_APPROVER_EXCLUDE = /vice|assistant|deputy|organi[sz]er|treasurer|secretary/;

function campaignAccess(profile) {
  const view = canViewQuestionAnswers(profile);
  if (!view.allowed) return {allowed: false};
  const title = String(profile.executiveTitle || profile.title || '').toLowerCase().trim();
  const approver = profile.role === 'super_admin' ||
    (profile.role === 'national_executive' && CAMPAIGN_APPROVER_PATTERN.test(title) && !CAMPAIGN_APPROVER_EXCLUDE.test(title));
  return {allowed: true, region: view.region || null, approver};
}

async function loadCampaignActor(request) {
  if (!request.auth) throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  const snap = await admin.firestore().collection('users').doc(request.auth.uid).get();
  const profile = snap.exists ? snap.data() : null;
  const access = campaignAccess(profile);
  if (!access.allowed) {
    throw new functions.https.HttpsError('permission-denied', 'Only selected executives can manage campaigns');
  }
  return {profile, access};
}

async function notifyCampaignApprovers(db, campaign, campaignId) {
  const snap = await db.collection('users').where('role', 'in', ['super_admin', 'national_executive']).get();
  const batch = db.batch();
  let count = 0;
  snap.forEach((d) => {
    if (!campaignAccess(d.data()).approver) return;
    batch.set(db.collection('notifications').doc(), {
      uid: d.id, type: 'campaign_pending', title: 'Campaign awaiting approval',
      message: `${campaign.createdByName || 'A regional executive'} (${campaign.region || 'region'}) submitted "${campaign.title}" for approval.`,
      link: '/national/campaigns.html', read: false, createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    count += 1;
  });
  if (count) await batch.commit();
}

exports.saveCampaign = functions.https.onCall(async (request) => {
  const {profile, access} = await loadCampaignActor(request);
  const db = admin.firestore();
  const d = request.data || {};
  const title = String(d.title || '').trim().slice(0, 120);
  const description = String(d.description || '').trim().slice(0, 2000);
  if (!title || !description) throw new functions.https.HttpsError('invalid-argument', 'Title and description are required');
  const imageUrl = String(d.imageUrl || '').trim();
  if (imageUrl && (!/^https:\/\//i.test(imageUrl) || imageUrl.length > 1500)) {
    throw new functions.https.HttpsError('invalid-argument', 'Image must be an https link or an uploaded file');
  }
  const target = d.targetAmount === '' || d.targetAmount == null ? null : Number(d.targetAmount);
  if (target !== null && (!Number.isFinite(target) || target < 0)) {
    throw new functions.https.HttpsError('invalid-argument', 'Target amount is not valid');
  }
  let endDate = null;
  if (d.endDate) {
    const parsed = new Date(d.endDate);
    if (Number.isNaN(parsed.getTime())) throw new functions.https.HttpsError('invalid-argument', 'End date is not valid');
    endDate = admin.firestore.Timestamp.fromDate(parsed);
  }
  const now = admin.firestore.FieldValue.serverTimestamp();
  const name = profile.fullName || profile.email || '';
  const fields = {
    title, description, targetAmount: target, endDate, imageUrl: imageUrl || null,
    featured: d.featured === true, updatedAt: now, updatedBy: request.auth.uid, updatedByName: name
  };

  if (d.id) {
    const ref = db.collection('donation_campaigns').doc(String(d.id));
    const snap = await ref.get();
    if (!snap.exists) throw new functions.https.HttpsError('not-found', 'Campaign not found');
    const existing = snap.data();
    if (access.region && normRegion(existing.region) !== normRegion(access.region)) {
      throw new functions.https.HttpsError('permission-denied', 'You can only edit your own region\'s campaigns');
    }
    if (!['active', 'pending_approval', 'rejected'].includes(existing.status)) {
      throw new functions.https.HttpsError('failed-precondition', 'This campaign has ended and cannot be edited');
    }
    // A regional edit of a live campaign needs approving again.
    const needsReview = !!access.region && !access.approver;
    if (needsReview) fields.status = 'pending_approval';
    await ref.update(fields);
    if (needsReview) await notifyCampaignApprovers(db, {...existing, ...fields, createdByName: name}, ref.id);
    return {success: true, id: ref.id, status: needsReview ? 'pending_approval' : existing.status};
  }

  const regional = !!access.region;
  const doc = {
    ...fields,
    status: regional ? 'pending_approval' : 'active',
    region: access.region || null,
    currentAmount: 0, donorCount: 0,
    createdAt: now, createdBy: request.auth.uid, createdByName: name,
    visibility: 'public'
  };
  const ref = await db.collection('donation_campaigns').add(doc);
  if (regional) await notifyCampaignApprovers(db, doc, ref.id);
  return {success: true, id: ref.id, status: doc.status};
});

exports.reviewCampaign = functions.https.onCall(async (request) => {
  const {profile, access} = await loadCampaignActor(request);
  if (!access.approver) {
    throw new functions.https.HttpsError('permission-denied', 'Only the national president, national PRO or super admin can approve campaigns');
  }
  const db = admin.firestore();
  const ref = db.collection('donation_campaigns').doc(String(request.data?.id || ''));
  const snap = await ref.get();
  if (!snap.exists) throw new functions.https.HttpsError('not-found', 'Campaign not found');
  const c = snap.data();
  if (c.status !== 'pending_approval') throw new functions.https.HttpsError('failed-precondition', 'This campaign is not waiting for approval');
  const approve = request.data?.decision === 'approve';
  const reason = String(request.data?.reason || '').trim().slice(0, 300);
  await ref.update({
    status: approve ? 'active' : 'rejected',
    reviewedBy: request.auth.uid, reviewedByName: profile.fullName || profile.email || '',
    reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
    reviewNote: reason || null
  });
  if (c.createdBy) {
    await db.collection('notifications').add({
      uid: c.createdBy, type: approve ? 'campaign_approved' : 'campaign_rejected',
      title: approve ? 'Campaign approved' : 'Campaign not approved',
      message: approve ? `"${c.title}" is now live on the donation page.` : `"${c.title}" was not approved${reason ? ': ' + reason : '.'}`,
      link: '/national/campaigns.html', read: false, createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }
  return {success: true, status: approve ? 'active' : 'rejected'};
});

exports.setCampaignStatus = functions.https.onCall(async (request) => {
  const {profile, access} = await loadCampaignActor(request);
  const status = request.data?.status;
  if (!['completed', 'cancelled'].includes(status)) throw new functions.https.HttpsError('invalid-argument', 'Invalid status');
  const ref = admin.firestore().collection('donation_campaigns').doc(String(request.data?.id || ''));
  const snap = await ref.get();
  if (!snap.exists) throw new functions.https.HttpsError('not-found', 'Campaign not found');
  const c = snap.data();
  if (access.region && normRegion(c.region) !== normRegion(access.region)) {
    throw new functions.https.HttpsError('permission-denied', 'You can only close your own region\'s campaigns');
  }
  if (c.status !== 'active') throw new functions.https.HttpsError('failed-precondition', 'Only active campaigns can be closed');
  await ref.update({
    status, endedAt: admin.firestore.FieldValue.serverTimestamp(),
    closedBy: request.auth.uid, closedByName: profile.fullName || profile.email || '',
    cancellationReason: status === 'cancelled' ? String(request.data?.reason || 'No reason provided').slice(0, 300) : null
  });
  return {success: true};
});

// Renews a member's ID card for another 3 years (from today). Fee recorders and the super admin only.
exports.renewIdCard = functions.https.onCall(async (request) => {
  if (!request.auth) throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  const db = admin.firestore();
  const callerDoc = await db.collection('users').doc(request.auth.uid).get();
  const access = canRecordFeePayments(callerDoc.exists ? callerDoc.data() : null);
  if (!access.allowed) throw new functions.https.HttpsError('permission-denied', 'Not allowed to renew ID cards');
  const memberUid = String(request.data?.memberUid || '');
  const ref = db.collection('users').doc(memberUid);
  const doc = await ref.get();
  if (!doc.exists) throw new functions.https.HttpsError('not-found', 'Member not found');
  const m = doc.data();
  if (access.region && normRegion(access.region) !== normRegion(m.region)) {
    throw new functions.https.HttpsError('permission-denied', 'This member is outside your region');
  }
  const issued = new Date();
  const expires = addYears(issued, CARD_VALID_YEARS);
  await ref.update({cardIssuedAt: admin.firestore.Timestamp.fromDate(issued), cardExpiresAt: admin.firestore.Timestamp.fromDate(expires)});
  await db.collection('notifications').add({
    uid: memberUid, type: 'id_card_renewed', title: 'ID card renewed',
    message: 'Your AMCAG ID card has been renewed and is valid for 3 more years.',
    link: '/member-dashboard/id-card.html', read: false, createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
  return {success: true, cardExpiresAt: expires.toISOString()};
});

// ================================================================
// Question of the Day: member answers and executive results
// Answers live in daily_question_answers (no client access; everything goes through these functions).
// ================================================================
const QUESTION_VIEW_TITLE_PATTERN = /(^|[^a-z])(president|secretary|pro|public relations( officer)?)([^a-z]|$)/;
const QUESTION_VIEW_TITLE_EXCLUDE = /vice|assistant|deputy|organi[sz]er|treasurer/;

function canViewQuestionAnswers(profile) {
  if (!profile) return {allowed: false};
  if (profile.role === 'super_admin') return {allowed: true, region: null};
  if (profile.role !== 'national_executive' && profile.role !== 'regional_executive') return {allowed: false};
  const title = String(profile.executiveTitle || profile.title || '').toLowerCase().trim();
  if (!title || QUESTION_VIEW_TITLE_EXCLUDE.test(title) || !QUESTION_VIEW_TITLE_PATTERN.test(title)) {
    return {allowed: false};
  }
  if (profile.role === 'regional_executive') {
    if (!profile.region) return {allowed: false};
    return {allowed: true, region: profile.region};
  }
  return {allowed: true, region: null};
}

async function requireActiveMember(request) {
  if (!request.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }
  const snap = await admin.firestore().collection('users').doc(request.auth.uid).get();
  if (!snap.exists || (snap.data().status && snap.data().status !== 'active')) {
    throw new functions.https.HttpsError('permission-denied', 'Active members only');
  }
  return snap.data();
}

exports.getDailyQuestion = functions.https.onCall(async (request) => {
  const profile = await requireActiveMember(request);
  const dayNo = dailyQuestions.dayNumber();
  const q = await questionStore.getQuestionForDay(admin.firestore(), admin, dayNo);
  const answerRef = admin.firestore().collection('daily_question_answers').doc(`${dayNo}_${request.auth.uid}`);
  const answerSnap = await answerRef.get();
  const out = {dayNo, topic: q.topic, question: q.question, options: q.options, answered: false};
  if (answerSnap.exists) {
    out.answered = true;
    out.choice = answerSnap.data().choice;
    out.correct = answerSnap.data().correct;
    out.correctIndex = q.answer;
    out.explanation = q.explanation;
  }
  out.canViewResults = canViewQuestionAnswers({...profile}).allowed;
  out.canManageBank = questionBankPermissions(profile).canManage;
  return out;
});

exports.submitDailyAnswer = functions.https.onCall(async (request) => {
  const profile = await requireActiveMember(request);
  const choice = Number((request.data || {}).choice);
  const dayNo = dailyQuestions.dayNumber();
  const q = await questionStore.getQuestionForDay(admin.firestore(), admin, dayNo);
  if (!Number.isInteger(choice) || choice < 0 || choice >= q.options.length) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid answer choice');
  }
  const ref = admin.firestore().collection('daily_question_answers').doc(`${dayNo}_${request.auth.uid}`);
  const correct = choice === q.answer;
  await admin.firestore().runTransaction(async (tx) => {
    const existing = await tx.get(ref);
    if (existing.exists) {
      throw new functions.https.HttpsError('already-exists', 'You have already answered today\'s question');
    }
    tx.set(ref, {
      dayNo,
      uid: request.auth.uid,
      memberName: profile.fullName || profile.displayName || '',
      memberId: profile.memberId || '',
      region: profile.region || '',
      questionIndex: q.index,
      questionId: q.id || null,
      questionText: q.question,
      topic: q.topic,
      choice,
      choiceText: q.options[choice],
      correctText: q.options[q.answer],
      correct,
      answeredAt: admin.firestore.FieldValue.serverTimestamp()
    });
  });
  if (q.id) {
    const inc = admin.firestore.FieldValue.increment;
    admin.firestore().collection('question_bank').doc(q.id)
      .update({answeredCount: inc(1), correctCount: inc(correct ? 1 : 0)})
      .catch(() => {});
  }
  return {correct, correctIndex: q.answer, explanation: q.explanation, choice};
});

exports.getQuestionResults = functions.https.onCall(async (request) => {
  if (!request.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }
  const callerSnap = await admin.firestore().collection('users').doc(request.auth.uid).get();
  const access = callerSnap.exists ? canViewQuestionAnswers(callerSnap.data()) : {allowed: false};
  if (!access.allowed) {
    throw new functions.https.HttpsError('permission-denied', 'You are not allowed to view question answers');
  }
  const data = request.data || {};
  const today = dailyQuestions.dayNumber();
  const dayNo = Number.isInteger(Number(data.dayNo)) && data.dayNo !== null && data.dayNo !== '' ? Number(data.dayNo) : today;
  // Regional executives are locked to their own region; others may filter.
  const region = access.region || (data.region ? String(data.region) : null);

  // Region is filtered in memory so no composite index is needed.
  const snap = await admin.firestore().collection('daily_question_answers').where('dayNo', '>=', today - 29).limit(8000).get();

  const days = {};
  const answers = [];
  snap.forEach((doc) => {
    const a = doc.data();
    if (region && a.region !== region) return;
    const d = days[a.dayNo] || (days[a.dayNo] = {dayNo: a.dayNo, topic: a.topic, question: a.questionText, total: 0, correct: 0});
    d.total++;
    if (a.correct) d.correct++;
    if (a.dayNo === dayNo) {
      answers.push({
        memberName: a.memberName, memberId: a.memberId, region: a.region,
        choiceText: a.choiceText, correct: !!a.correct,
        answeredAt: a.answeredAt ? a.answeredAt.toMillis() : null
      });
    }
  });
  answers.sort((x, y) => (y.answeredAt || 0) - (x.answeredAt || 0));
  const q = await questionStore.getQuestionForDay(admin.firestore(), admin, dayNo, {create: false});
  return {
    today,
    dayNo,
    region,
    lockedRegion: !!access.region,
    question: q
      ? {topic: q.topic, question: q.question, correctText: q.options[q.answer]}
      : {topic: '-', question: 'No question was scheduled for this day.', correctText: '-'},
    days: Object.values(days).sort((x, y) => y.dayNo - x.dayNo),
    answers
  };
});

// ================================================================
// Email the member when their registration is approved or rejected
// ================================================================
function reviewEmailHtml(title, bodyHtml) {
  return '<!doctype html><html><body style="margin:0;background:#f3f6f4;font-family:Segoe UI,Arial,sans-serif;color:#1a2433">' +
    '<div style="max-width:600px;margin:0 auto;padding:20px"><div style="background:#0b5d3b;color:#fff;padding:18px 24px;border-radius:8px 8px 0 0;font-size:20px;font-weight:bold">' +
    dailyQuestions.escapeHtml(title) + '</div><div style="background:#fff;padding:24px;border-radius:0 0 8px 8px;line-height:1.55">' +
    bodyHtml + '<p style="font-size:12px;color:#8892a0;margin-top:28px">Association of Medicine Counter Assistants of Ghana (AMCAG)</p></div></div></body></html>';
}

exports.onMemberReviewed = onDocumentUpdated({
  document: 'users/{uid}',
  secrets: ['EMAIL_PASS']
}, async (event) => {
  const before = event.data.before.data() || {};
  const after = event.data.after.data() || {};
  if (before.status === after.status) return;
  const approved = before.status === 'pending' && after.status === 'active';
  const rejected = before.status === 'pending' && after.status === 'rejected';
  if (!approved && !rejected) return;
  if (!after.email || after.reviewEmailSent === after.status) return;

  const esc = dailyQuestions.escapeHtml;
  const first = esc(String(after.fullName || 'Member').split(' ')[0]);
  let subject;
  let html;
  let text;
  if (approved) {
    subject = 'Welcome to AMCAG: your membership is approved';
    html = reviewEmailHtml('Membership approved', '<p>Dear ' + first + ',</p>' +
      '<p>Your AMCAG membership has been <strong>approved</strong>. Your Member ID is:</p>' +
      '<p style="font-size:22px;font-weight:bold;color:#0b5d3b;margin:8px 0">' + esc(after.memberId || '') + '</p>' +
      '<p>You can now sign in to your member dashboard to pay dues, get your ID card and join meetings.</p>' +
      '<p style="text-align:center;margin:22px 0"><a href="https://amcag-af624.web.app/membership" style="background:#0b5d3b;color:#fff;text-decoration:none;padding:13px 28px;border-radius:6px;font-weight:bold;display:inline-block">Sign in</a></p>');
    text = 'Dear ' + String(after.fullName || 'Member').split(' ')[0] + ',\n\nYour AMCAG membership has been approved. Your Member ID is ' + (after.memberId || '') + '.\nSign in: https://amcag-af624.web.app/membership';
  } else {
    subject = 'Update on your AMCAG membership application';
    html = reviewEmailHtml('Membership application update', '<p>Dear ' + first + ',</p>' +
      '<p>Thank you for applying to join AMCAG. After review, we could not approve your application at this time.</p>' +
      '<p><strong>Reason:</strong> ' + esc(after.rejectionReason || 'Not specified') + '</p>' +
      '<p>If you believe this is a mistake, or you can provide the missing information, please contact your regional AMCAG executives.</p>');
    text = 'Dear ' + String(after.fullName || 'Member').split(' ')[0] + ',\n\nWe could not approve your AMCAG application at this time.\nReason: ' + (after.rejectionReason || 'Not specified');
  }

  const transporter = createDailyQuestionTransporter();
  await transporter.sendMail({
    from: 'AMCAG Membership <' + (process.env.EMAIL_USER || 'amcag2018@gmail.com') + '>',
    to: after.email,
    subject,
    html,
    text
  });
  await event.data.after.ref.update({ reviewEmailSent: after.status });
});

// ================================================================
// Membership registration fee (one-time) and who can see ID cards
// ================================================================
const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const FEE_RECORDER_PATTERN = /(president|secretary|treasurer|financial)/;
const FEE_RECORDER_EXCLUDE = /vice|assistant|deputy|organi[sz]er/;

function normRegion(v) {
  return String(v || '').trim().toLowerCase().replace(/[\s_-]+/g, '-');
}

// Super admin records for anyone; national president/secretary/treasurer for anyone;
// regional president/secretary/treasurer for their own region.
function canRecordFeePayments(profile) {
  if (!profile) return {allowed: false};
  if (profile.role === 'super_admin') return {allowed: true, region: null};
  if (profile.role !== 'national_executive' && profile.role !== 'regional_executive') return {allowed: false};
  const title = String(profile.executiveTitle || profile.title || '').toLowerCase().trim();
  if (!title || FEE_RECORDER_EXCLUDE.test(title) || !FEE_RECORDER_PATTERN.test(title)) return {allowed: false};
  if (profile.role === 'regional_executive') {
    return profile.region ? {allowed: true, region: profile.region} : {allowed: false};
  }
  return {allowed: true, region: null};
}

// Marks the member's registration fee as paid (idempotent) and tells them their ID card is ready.
async function applyRegistrationFeePaid(db, uid, payment, paymentId) {
  const now = admin.firestore.Timestamp.now();
  const fields = {
    registrationFeePaid: true,
    registrationFeePaidAt: now,
    registrationFeeReference: payment.hubtelClientReference || payment.reference || paymentId,
    registrationFeeAmount: Number(payment.amount) || 0,
    registrationFeeMethod: payment.paymentMethod || 'hubtel',
    updatedAt: now
  };
  const userRef = db.collection('users').doc(uid);
  const changed = await db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists || snap.data().registrationFeePaid === true) return false;
    tx.update(userRef, fields);
    return true;
  });
  if (!changed) return false;
  try {
    const mirror = db.collection('members').doc(uid);
    if ((await mirror.get()).exists) await mirror.update(fields);
  } catch (e) { console.warn('members mirror fee update skipped:', e.message); }
  await db.collection('notifications').doc('regfee_' + uid).set({
    uid,
    type: 'registration_fee_paid',
    title: 'Registration fee received',
    message: 'Thank you. Your registration fee of GHS ' + (Number(payment.amount) || 0).toFixed(2) + ' is confirmed and your AMCAG ID card is ready.',
    link: '/member-dashboard/id-card.html',
    read: false,
    status: 'unread',
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
  await db.collection('audit_logs').add({
    action: 'registration_fee_paid',
    performedBy: payment.recordedBy || uid,
    targetUser: uid,
    details: {paymentId, amount: Number(payment.amount) || 0, method: payment.paymentMethod || 'hubtel'},
    timestamp: now
  });
  return true;
}

// Fires for Hubtel callbacks, status checks and recorded cash payments alike.
exports.onRegistrationFeePayment = onDocumentWritten('payments/{paymentId}', async (event) => {
  const after = event.data && event.data.after && event.data.after.exists ? event.data.after.data() : null;
  if (!after || after.type !== 'registration_fee' || String(after.status || '').toLowerCase() !== 'paid') return;
  const before = event.data.before && event.data.before.exists ? event.data.before.data() : null;
  if (before && String(before.status || '').toLowerCase() === 'paid') return;
  await applyRegistrationFeePaid(admin.firestore(), after.uid, after, event.params.paymentId);
});

exports.getRegistrationFeeStatus = functions.https.onCall(async (request) => {
  if (!request.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }
  const db = admin.firestore();
  const snap = await db.collection('users').doc(request.auth.uid).get();
  if (!snap.exists) {
    throw new functions.https.HttpsError('not-found', 'Member not found');
  }
  const user = snap.data();
  const fees = await getFeeSettings(db);
  let pendingReference = null;
  if (user.registrationFeePaid !== true) {
    const inFlight = await db.collection('payments')
      .where('uid', '==', request.auth.uid)
      .where('type', '==', 'registration_fee')
      .where('status', '==', 'awaiting_payment')
      .get();
    const recent = inFlight.docs.find((d) => d.data().createdAt && (Date.now() - d.data().createdAt.toMillis()) < 10 * 60 * 1000);
    pendingReference = recent ? recent.data().hubtelClientReference : null;
  }
  return {
    fee: fees.registrationFee,
    currency: fees.currency || 'GHS',
    paid: user.registrationFeePaid === true,
    paidAt: user.registrationFeePaidAt && user.registrationFeePaidAt.toMillis ? user.registrationFeePaidAt.toMillis() : null,
    method: user.registrationFeeMethod || null,
    status: user.status || '',
    memberId: user.memberId || null,
    pendingReference
  };
});

exports.payRegistrationFee = functions.https.onCall({
  secrets: HUBTEL_SECRET_NAMES,
  ...HUBTEL_STATIC_EGRESS
}, async (request) => {
  if (!request.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }
  const db = admin.firestore();
  const uid = request.auth.uid;
  const snap = await db.collection('users').doc(uid).get();
  if (!snap.exists) {
    throw new functions.https.HttpsError('not-found', 'Member not found');
  }
  const member = snap.data();
  if (member.status !== 'active') {
    throw new functions.https.HttpsError('permission-denied', 'Your membership must be approved before paying the registration fee');
  }
  if (member.registrationFeePaid === true) {
    throw new functions.https.HttpsError('already-exists', 'Your registration fee is already paid');
  }

  const channel = String(request.data?.channel || '').trim();
  if (!HUBTEL_MOMO_CHANNELS.has(channel)) {
    throw new functions.https.HttpsError('invalid-argument', 'Select a valid mobile money network');
  }
  const msisdn = normalizeGhanaMsisdn(String(request.data?.paymentPhone || '').trim() || member.phone);
  if (!msisdn) {
    throw new functions.https.HttpsError('failed-precondition', 'Enter a valid Ghana mobile number before paying online');
  }

  const inFlight = await db.collection('payments')
    .where('uid', '==', uid)
    .where('type', '==', 'registration_fee')
    .where('status', '==', 'awaiting_payment')
    .get();
  if (inFlight.docs.some((d) => d.data().createdAt && (Date.now() - d.data().createdAt.toMillis()) < 10 * 60 * 1000)) {
    throw new functions.https.HttpsError('already-exists', 'A mobile money prompt is still pending. Approve it on your phone or wait a few minutes.');
  }

  const fees = await getFeeSettings(db);
  const amount = fees.registrationFee;
  const paymentAccount = resolvePaymentAccount({type: 'registration_fee', region: member.region});
  ensureHubtelCredentialsConfigured(paymentAccount);

  const clientReference = 'REG-' + crypto.randomBytes(8).toString('hex');
  const paymentRef = db.collection('payments').doc();
  await paymentRef.set({
    uid,
    requestedBy: uid,
    memberName: member.fullName || 'Unknown',
    memberId: member.memberId || null,
    region: member.region || null,
    paymentAccountScope: paymentAccount.scope,
    paymentAccountOwner: paymentAccount.owner,
    type: 'registration_fee',
    amount,
    paymentMethod: 'hubtel',
    paymentProvider: 'hubtel',
    status: 'awaiting_payment',
    approvalStatus: 'awaiting_payment',
    requiresApproval: false,
    hubtelClientReference: clientReference,
    hubtelChannel: channel,
    hubtelMsisdn: '***' + msisdn.slice(-4),
    createdAt: admin.firestore.Timestamp.now()
  });

  try {
    const response = await sendHubtelReceiveMoney({
      paymentAccount,
      msisdn,
      channel,
      amount,
      description: 'AMCAG Registration Fee',
      clientReference,
      name: member.fullName,
      email: member.email
    });
    const code = String(response.ResponseCode || '');
    if (code !== '0001' && code !== '0000') {
      throw new Error(response.Message || 'Hubtel responded with code ' + (code || 'unknown'));
    }
    const txId = (response.Data || {}).TransactionId || null;
    if (txId) await paymentRef.update({hubtelTransactionId: txId});
    return {
      success: true,
      pending: true,
      message: 'Approve the mobile money prompt on your phone to complete payment.',
      clientReference,
      totalAmount: amount
    };
  } catch (hubtelError) {
    console.error('Registration fee Hubtel request failed:', hubtelError.response?.data || hubtelError.message);
    await paymentRef.update({status: 'failed', hubtelCallbackStatus: 'request_failed', updatedAt: admin.firestore.Timestamp.now()});
    const apiMessage = hubtelError.response?.data?.Message || hubtelError.response?.data?.message;
    throw new functions.https.HttpsError(
      'internal',
      hubtelError.response?.status === 403
        ? 'Hubtel rejected the request (server IP not whitelisted). Please pay through an executive instead.'
        : (apiMessage || 'Could not start the mobile money payment. Please try again.')
    );
  }
});

// An authorised executive records a registration fee paid in cash, by bank transfer or manually.
exports.recordRegistrationFeePayment = functions.https.onCall(async (request) => {
  if (!request.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }
  const db = admin.firestore();
  const actorSnap = await db.collection('users').doc(request.auth.uid).get();
  const actor = actorSnap.exists ? actorSnap.data() : null;
  const access = canRecordFeePayments(actor);
  if (!access.allowed) {
    throw new functions.https.HttpsError('permission-denied', 'You are not allowed to record registration fee payments');
  }
  const memberUid = String(request.data?.memberUid || '').trim();
  const method = ['cash', 'bank_transfer', 'mobile_money_manual'].includes(request.data?.method) ? request.data.method : 'cash';
  const reference = String(request.data?.reference || '').trim().slice(0, 60);
  if (!memberUid) {
    throw new functions.https.HttpsError('invalid-argument', 'Member is required');
  }
  const targetSnap = await db.collection('users').doc(memberUid).get();
  if (!targetSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'Member not found');
  }
  const target = targetSnap.data();
  if (access.region && normRegion(access.region) !== normRegion(target.region)) {
    throw new functions.https.HttpsError('permission-denied', 'You can only record payments for members in your region');
  }
  if (target.status !== 'active') {
    throw new functions.https.HttpsError('failed-precondition', 'Only approved members can pay the registration fee');
  }
  if (target.registrationFeePaid === true) {
    throw new functions.https.HttpsError('already-exists', 'This member has already paid the registration fee');
  }
  const fees = await getFeeSettings(db);
  const now = admin.firestore.Timestamp.now();
  const payment = {
    uid: memberUid,
    memberName: target.fullName || 'Unknown',
    memberId: target.memberId || null,
    region: target.region || null,
    type: 'registration_fee',
    amount: fees.registrationFee,
    paymentMethod: method,
    paymentProvider: 'manual',
    status: 'paid',
    approvalStatus: 'approved',
    requiresApproval: false,
    verified: true,
    reference: reference || null,
    recordedBy: request.auth.uid,
    recordedByName: actor.fullName || actor.email || request.auth.uid,
    paymentDate: now,
    processedAt: now,
    createdAt: now
  };
  const ref = await db.collection('payments').add(payment);
  await applyRegistrationFeePaid(db, memberUid, payment, ref.id);
  return {success: true, amount: fees.registrationFee};
});

// Member list for the ID card page: super admin and selected executives only.
exports.listMemberCards = functions.https.onCall(async (request) => {
  if (!request.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }
  const db = admin.firestore();
  const callerSnap = await db.collection('users').doc(request.auth.uid).get();
  const caller = callerSnap.exists ? callerSnap.data() : null;
  const view = canViewQuestionAnswers(caller);
  if (!view.allowed) {
    throw new functions.https.HttpsError('permission-denied', 'You are not allowed to view member ID cards');
  }
  const record = canRecordFeePayments(caller);
  const snap = await db.collection('users').where('status', '==', 'active').limit(3000).get();
  const members = [];
  snap.forEach((doc) => {
    const u = doc.data();
    if (view.region && normRegion(view.region) !== normRegion(u.region)) return;
    const canRecordThis = record.allowed && (!record.region || normRegion(record.region) === normRegion(u.region));
    members.push({
      uid: doc.id,
      fullName: u.fullName || '',
      memberId: u.memberId || '',
      region: u.region || '',
      role: u.role || 'member',
      feePaid: u.registrationFeePaid === true,
      canRecord: canRecordThis && u.registrationFeePaid !== true,
      canRenew: canRecordThis && u.registrationFeePaid === true,
      cardExpiresAt: (tsToDate(u.cardExpiresAt) || (tsToDate(u.registrationFeePaidAt) ? addYears(tsToDate(u.registrationFeePaidAt), CARD_VALID_YEARS) : null) || {toISOString: () => ''}).toISOString(),
      photoUrl: u.profilePictureUrl || u.photoURL || u.photoUrl || ''
    });
  });
  members.sort((a, b) => a.fullName.localeCompare(b.fullName));
  return {members, scope: view.region || 'all'};
});


// ============================================================================
// ===== COMMUNITY CHAT: oversight, moderation, rooms, push notifications =====
// ============================================================================
const {onDocumentUpdated: onChatDocUpdated} = require('firebase-functions/v2/firestore');

const CHAT_EDIT_WINDOW_MS = 15 * 60 * 1000;
const CHAT_CHANNELS = ['regional', 'announcement', 'national', 'room'];
const CHAT_SITE = 'https://amcag-af624.web.app';

const chatNorm = (v) => String(v || '').trim().toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const chatSanitize = (v) => String(v || '').trim().replace(/[.#$\[\]/]/g, '-').replace(/\s+/g, ' ');
const chatRegionRaw = (p) => String((p && (p.regionId || p.region || p.regionName || p.assignedRegion)) || '').trim();
const chatErr = (code, msg) => new functions.https.HttpsError(code, msg);

// National president / PRO and the super admin may view every region's chat.
function chatIsOversight(profile) {
  if (!profile) return false;
  const role = String(profile.role || '').toLowerCase();
  if (role === 'super_admin') return true;
  if (role !== 'national_executive') return false;
  const title = String(profile.executiveTitle || profile.title || '').toLowerCase().trim();
  return CAMPAIGN_APPROVER_PATTERN.test(title) && !CAMPAIGN_APPROVER_EXCLUDE.test(title);
}

async function chatActor(request) {
  if (!request.auth) throw chatErr('unauthenticated', 'User must be authenticated');
  const snap = await admin.firestore().collection('users').doc(request.auth.uid).get();
  const profile = snap.exists ? snap.data() : null;
  if (!profile || !['active', 'approved'].includes(String(profile.status || '').toLowerCase())) {
    throw chatErr('permission-denied', 'Your account is not active');
  }
  const role = String(profile.role || 'member').toLowerCase();
  const regionRaw = chatRegionRaw(profile);
  return {
    uid: request.auth.uid,
    profile,
    role,
    name: profile.fullName || profile.name || 'AMCAG Member',
    regionRaw,
    regionKey: chatNorm(regionRaw),
    oversight: chatIsOversight(profile),
    isExec: EXECUTIVE_ROLES.has(role)
  };
}

function chatMessagePaths(channel, region, roomId) {
  if (channel === 'national') return ['national-chat/messages'];
  if (channel === 'room') return ['chat-rooms/' + roomId + '/messages'];
  const base = channel === 'announcement' ? 'regional-announcements' : 'regional-chats';
  const tail = channel === 'announcement' ? 'posts' : 'messages';
  const raw = String(region || '');
  return Array.from(new Set([chatSanitize(raw), chatNorm(raw)].filter(Boolean))).map((k) => base + '/' + k + '/' + tail);
}

function chatCheckInput(data) {
  const channel = String((data && data.channel) || '');
  const messageId = String((data && data.messageId) || '');
  const roomId = String((data && data.roomId) || '');
  if (!CHAT_CHANNELS.includes(channel)) throw chatErr('invalid-argument', 'Unknown channel');
  if (!/^[-A-Za-z0-9_]{8,40}$/.test(messageId)) throw chatErr('invalid-argument', 'Invalid message');
  if (channel === 'room' && !/^[-A-Za-z0-9_]{8,40}$/.test(roomId)) throw chatErr('invalid-argument', 'Invalid room');
  if ((channel === 'regional' || channel === 'announcement') && !chatNorm(data.region)) throw chatErr('invalid-argument', 'Region required');
  return {channel, messageId, roomId, region: String((data && data.region) || '')};
}

async function chatFindMessage(input) {
  for (const base of chatMessagePaths(input.channel, input.region, input.roomId)) {
    const ref = admin.database().ref(base + '/' + input.messageId);
    const snap = await ref.once('value');
    if (snap.exists()) return {ref, data: snap.val(), base};
  }
  throw chatErr('not-found', 'Message not found');
}

async function chatLoadRoom(roomId) {
  const snap = await admin.firestore().collection('chat_rooms').doc(roomId).get();
  if (!snap.exists) throw chatErr('not-found', 'Room not found');
  return snap.data();
}

// Is the caller allowed to see / take part in this channel?
async function chatCanAccess(actor, input) {
  if (input.channel === 'regional' || input.channel === 'announcement') {
    return actor.oversight || actor.regionKey === chatNorm(input.region);
  }
  if (input.channel === 'national') return actor.isExec;
  const room = await chatLoadRoom(input.roomId);
  return actor.oversight || (room.memberUids || []).includes(actor.uid);
}

// Can the caller hide / restore / pin things in this channel?
async function chatCanModerate(actor, input) {
  if (actor.oversight) return true;
  if (input.channel === 'regional' || input.channel === 'announcement') {
    return actor.role === 'regional_executive' && actor.regionKey === chatNorm(input.region);
  }
  if (input.channel === 'room') {
    const room = await chatLoadRoom(input.roomId);
    return room.createdBy === actor.uid || (actor.role === 'regional_executive' && room.scope === 'region' && room.regionKey === actor.regionKey);
  }
  return false;
}

async function chatAudit(entry) {
  await admin.firestore().collection('chat_audit').add({...entry, at: admin.firestore.FieldValue.serverTimestamp()});
}

function chatContentOf(data) {
  const out = {};
  ['text', 'fileUrl', 'fileName', 'fileType', 'fileDuration'].forEach((k) => { if (data[k] !== undefined && data[k] !== null) out[k] = data[k]; });
  return out;
}

async function chatHideMessage(actor, input, found, reason) {
  const data = found.data;
  if (data.hidden === true || data.deleted === true) return;
  const db = admin.firestore();
  await db.collection('chat_hidden').doc(input.channel + '_' + input.messageId).set({
    channel: input.channel, messageId: input.messageId, base: found.base,
    content: chatContentOf(data), hiddenBy: actor.uid, hiddenAt: admin.firestore.FieldValue.serverTimestamp()
  });
  await found.ref.update({
    hidden: true, hiddenBy: actor.uid, hiddenByName: actor.name, hiddenReason: String(reason || '').slice(0, 200),
    hiddenAt: admin.database.ServerValue.TIMESTAMP,
    text: null, fileUrl: null, fileName: null, fileType: null, fileDuration: null, pinned: null
  });
  await chatAudit({
    action: 'hide', channel: input.channel, regionKey: chatNorm(input.region), roomId: input.roomId || null, messageId: input.messageId,
    byUid: actor.uid, byName: actor.name, byRole: actor.role, reason: String(reason || '').slice(0, 200),
    targetUid: data.senderId || data.authorId || null, targetName: data.senderName || data.authorName || null,
    snippet: String(data.text || '').slice(0, 120)
  });
}

// ---- moderate: hide / restore / pin / unpin ----
exports.moderateChatMessage = functions.https.onCall(async (request) => {
  const actor = await chatActor(request);
  const input = chatCheckInput(request.data);
  const action = String((request.data && request.data.action) || '');
  const reason = String((request.data && request.data.reason) || '').slice(0, 200);
  if (!['hide', 'restore', 'pin', 'unpin'].includes(action)) throw chatErr('invalid-argument', 'Unknown action');
  if (!(await chatCanModerate(actor, input))) throw chatErr('permission-denied', 'You cannot moderate this channel');
  const found = await chatFindMessage(input);

  if (action === 'hide') {
    await chatHideMessage(actor, input, found, reason);
  } else if (action === 'restore') {
    if (found.data.hidden !== true) throw chatErr('failed-precondition', 'Message is not hidden');
    if (!actor.oversight && found.data.hiddenBy && found.data.hiddenBy !== actor.uid) {
      throw chatErr('permission-denied', 'Only the national president, PRO or super admin can restore this message');
    }
    const doc = await admin.firestore().collection('chat_hidden').doc(input.channel + '_' + input.messageId).get();
    const content = doc.exists ? (doc.data().content || {}) : {};
    await found.ref.update({
      hidden: null, hiddenBy: null, hiddenByName: null, hiddenReason: null, hiddenAt: null,
      text: content.text || null, fileUrl: content.fileUrl || null, fileName: content.fileName || null,
      fileType: content.fileType || null, fileDuration: content.fileDuration || null
    });
    await chatAudit({action: 'restore', channel: input.channel, regionKey: chatNorm(input.region), roomId: input.roomId || null, messageId: input.messageId, byUid: actor.uid, byName: actor.name, byRole: actor.role, reason});
  } else {
    if (input.channel !== 'announcement') throw chatErr('invalid-argument', 'Only announcements can be pinned');
    if (found.data.hidden === true) throw chatErr('failed-precondition', 'Hidden messages cannot be pinned');
    await found.ref.update({pinned: action === 'pin' ? true : null});
    await chatAudit({action, channel: input.channel, regionKey: chatNorm(input.region), messageId: input.messageId, byUid: actor.uid, byName: actor.name, byRole: actor.role, reason});
  }
  return {success: true};
});

// ---- edit / delete your own message (within 15 minutes) ----
async function chatOwnMessage(request) {
  const actor = await chatActor(request);
  const input = chatCheckInput(request.data);
  if (!(await chatCanAccess(actor, input))) throw chatErr('permission-denied', 'No access to this channel');
  const found = await chatFindMessage(input);
  const owner = found.data.senderId || found.data.authorId;
  if (owner !== actor.uid) throw chatErr('permission-denied', 'You can only change your own messages');
  if (found.data.hidden === true || found.data.deleted === true) throw chatErr('failed-precondition', 'This message was already removed');
  if (Date.now() - Number(found.data.timestamp || 0) > CHAT_EDIT_WINDOW_MS) {
    throw chatErr('failed-precondition', 'Messages can only be changed within 15 minutes of sending');
  }
  return {actor, input, found};
}

exports.editChatMessage = functions.https.onCall(async (request) => {
  const {found} = await chatOwnMessage(request);
  const text = String((request.data && request.data.text) || '').trim();
  if (!text || text.length > 2000) throw chatErr('invalid-argument', 'Message must be between 1 and 2000 characters');
  if (!found.data.text) throw chatErr('failed-precondition', 'Only text messages can be edited');
  await found.ref.update({text, editedAt: admin.database.ServerValue.TIMESTAMP});
  return {success: true};
});

exports.deleteChatMessage = functions.https.onCall(async (request) => {
  const {found} = await chatOwnMessage(request);
  await found.ref.update({deleted: true, text: null, fileUrl: null, fileName: null, fileType: null, fileDuration: null, pinned: null, editedAt: null});
  return {success: true};
});

// ---- notifications helpers ----
async function chatNotifyUsers(db, uids, payload) {
  const list = Array.from(new Set(uids)).filter(Boolean);
  for (let i = 0; i < list.length; i += 400) {
    const batch = db.batch();
    list.slice(i, i + 400).forEach((uid) => {
      batch.set(db.collection('notifications').doc(), {
        uid, type: payload.type, title: payload.title, message: payload.message, link: payload.link,
        read: false, status: 'unread', createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });
    await batch.commit();
  }
}

async function chatModeratorUids(db, regionKey, extraUids) {
  const snap = await db.collection('users').where('role', 'in', ['super_admin', 'national_executive', 'regional_executive']).get();
  const out = new Set(extraUids || []);
  snap.docs.forEach((doc) => {
    const u = doc.data();
    if (u.status && !['active', 'approved'].includes(String(u.status).toLowerCase())) return;
    if (chatIsOversight(u)) out.add(doc.id);
    else if (regionKey && u.role === 'regional_executive' && chatNorm(chatRegionRaw(u)) === regionKey) out.add(doc.id);
  });
  return Array.from(out);
}

// ---- report a message ----
exports.reportChatMessage = functions.https.onCall(async (request) => {
  const actor = await chatActor(request);
  const input = chatCheckInput(request.data);
  const reason = String((request.data && request.data.reason) || '').trim().slice(0, 300);
  if (!reason) throw chatErr('invalid-argument', 'Please say why you are reporting this message');
  if (!(await chatCanAccess(actor, input))) throw chatErr('permission-denied', 'No access to this channel');
  const found = await chatFindMessage(input);
  const senderId = found.data.senderId || found.data.authorId || '';
  if (senderId === actor.uid) throw chatErr('invalid-argument', 'You cannot report your own message');
  const db = admin.firestore();
  const regionKey = (input.channel === 'regional' || input.channel === 'announcement') ? chatNorm(input.region) : '';
  const id = input.channel + '__' + input.messageId + '__' + actor.uid;
  const ref = db.collection('chat_reports').doc(id);
  if ((await ref.get()).exists) return {success: true, duplicate: true};
  await ref.set({
    channel: input.channel, regionKey, regionName: String(input.region || ''), roomId: input.roomId || null, messageId: input.messageId,
    reportedBy: actor.uid, reportedByName: actor.name, reason,
    senderId, senderName: found.data.senderName || found.data.authorName || '',
    snapshot: {text: String(found.data.text || '').slice(0, 500), fileUrl: found.data.fileUrl || null, fileType: found.data.fileType || null},
    status: 'open', createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
  let extra = [];
  if (input.channel === 'room') { try { extra = [(await chatLoadRoom(input.roomId)).createdBy]; } catch (e) { extra = []; } }
  const mods = (await chatModeratorUids(db, regionKey, extra)).filter((u) => u !== actor.uid);
  await chatNotifyUsers(db, mods, {
    type: 'chat_report', title: 'A chat message was reported',
    message: actor.name + ' reported a message: ' + reason.slice(0, 100),
    link: '/member-dashboard/regional-chat.html?view=moderation'
  });
  return {success: true};
});

function chatReportScopeOk(actor, r) {
  if (actor.oversight) return true;
  if (actor.role === 'regional_executive' && r.regionKey && r.regionKey === actor.regionKey) return true;
  return false;
}

exports.listChatReports = functions.https.onCall(async (request) => {
  const actor = await chatActor(request);
  if (!actor.isExec) throw chatErr('permission-denied', 'Executives only');
  const status = request.data && request.data.status === 'resolved' ? 'resolved' : 'open';
  const snap = await admin.firestore().collection('chat_reports').where('status', 'in', status === 'open' ? ['open'] : ['resolved', 'dismissed']).get();
  const rows = snap.docs.map((d) => ({id: d.id, ...d.data()})).filter((r) => chatReportScopeOk(actor, r));
  rows.sort((a, b) => (b.createdAt ? b.createdAt.toMillis() : 0) - (a.createdAt ? a.createdAt.toMillis() : 0));
  return {
    reports: rows.slice(0, 100).map((r) => ({
      id: r.id, channel: r.channel, regionKey: r.regionKey, regionName: r.regionName, roomId: r.roomId, messageId: r.messageId,
      reportedByName: r.reportedByName, reason: r.reason, senderName: r.senderName, snapshot: r.snapshot, status: r.status,
      createdAt: r.createdAt ? r.createdAt.toMillis() : 0
    }))
  };
});

exports.resolveChatReport = functions.https.onCall(async (request) => {
  const actor = await chatActor(request);
  if (!actor.isExec) throw chatErr('permission-denied', 'Executives only');
  const reportId = String((request.data && request.data.reportId) || '');
  const action = String((request.data && request.data.action) || '');
  if (!reportId || !['dismiss', 'hide'].includes(action)) throw chatErr('invalid-argument', 'Invalid request');
  const ref = admin.firestore().collection('chat_reports').doc(reportId);
  const snap = await ref.get();
  if (!snap.exists) throw chatErr('not-found', 'Report not found');
  const r = snap.data();
  if (!chatReportScopeOk(actor, r) && !(r.channel === 'room' && await chatCanModerate(actor, {channel: 'room', roomId: r.roomId}))) {
    throw chatErr('permission-denied', 'You cannot resolve this report');
  }
  if (action === 'hide') {
    const input = {channel: r.channel, messageId: r.messageId, roomId: r.roomId || '', region: r.regionName || r.regionKey || ''};
    try {
      const found = await chatFindMessage(input);
      await chatHideMessage(actor, input, found, 'Reported: ' + String(r.reason || '').slice(0, 120));
    } catch (e) {
      if (!(e && e.code === 'not-found')) throw e;
    }
  }
  await ref.update({status: action === 'hide' ? 'resolved' : 'dismissed', resolvedBy: actor.uid, resolvedByName: actor.name, resolvedAt: admin.firestore.FieldValue.serverTimestamp()});
  await chatAudit({action: 'report_' + action, channel: r.channel, regionKey: r.regionKey || '', messageId: r.messageId, byUid: actor.uid, byName: actor.name, byRole: actor.role, reason: String(r.reason || '').slice(0, 200)});
  return {success: true};
});

exports.listChatAudit = functions.https.onCall(async (request) => {
  const actor = await chatActor(request);
  if (actor.role !== 'super_admin') throw chatErr('permission-denied', 'Only the super admin can view the moderation log');
  const snap = await admin.firestore().collection('chat_audit').orderBy('at', 'desc').limit(100).get();
  return {
    entries: snap.docs.map((d) => {
      const e = d.data();
      return {id: d.id, action: e.action, channel: e.channel, regionKey: e.regionKey || '', byName: e.byName, byRole: e.byRole, reason: e.reason || '',
        targetName: e.targetName || '', snippet: e.snippet || '', at: e.at ? e.at.toMillis() : 0};
    })
  };
});

// ---- members of a region / everyone (for rooms) ----
exports.listChatMembers = functions.https.onCall(async (request) => {
  const actor = await chatActor(request);
  if (!actor.isExec) throw chatErr('permission-denied', 'Executives only');
  const want = String((request.data && request.data.region) || '');
  let regionKey = chatNorm(want);
  const everyone = want === '__all__';
  if (everyone && !(actor.oversight || actor.role === 'national_executive')) throw chatErr('permission-denied', 'National executives only');
  if (!everyone) {
    if (!actor.oversight) regionKey = actor.regionKey;
    if (!regionKey) throw chatErr('invalid-argument', 'No region');
  }
  const snap = await admin.firestore().collection('users').where('status', 'in', ['active', 'approved']).get();
  const members = [];
  snap.docs.forEach((doc) => {
    const u = doc.data();
    if (!everyone && chatNorm(chatRegionRaw(u)) !== regionKey) return;
    members.push({uid: doc.id, name: u.fullName || u.name || u.email || 'Member', role: String(u.role || 'member'), title: u.executiveTitle || '', region: chatRegionRaw(u)});
  });
  members.sort((a, b) => a.name.localeCompare(b.name));
  return {members: members.slice(0, 1500)};
});

// ---- rooms (committees, youth, women, ...) ----
function chatRoomPublic(id, r, actorUid) {
  return {
    id, name: r.name, description: r.description || '', scope: r.scope, regionKey: r.regionKey || '', regionName: r.regionName || '',
    createdBy: r.createdBy, createdByName: r.createdByName || '', memberCount: (r.memberUids || []).length,
    isMember: (r.memberUids || []).includes(actorUid), archived: r.archived === true
  };
}

exports.listChatRooms = functions.https.onCall(async (request) => {
  const actor = await chatActor(request);
  const db = admin.firestore();
  const out = new Map();
  const add = (snap) => snap.docs.forEach((d) => out.set(d.id, chatRoomPublic(d.id, d.data(), actor.uid)));
  if (actor.oversight) add(await db.collection('chat_rooms').get());
  else {
    add(await db.collection('chat_rooms').where('memberUids', 'array-contains', actor.uid).get());
    if (actor.role === 'regional_executive' && actor.regionKey) add(await db.collection('chat_rooms').where('regionKey', '==', actor.regionKey).get());
  }
  const rooms = Array.from(out.values()).filter((r) => !r.archived || actor.oversight).sort((a, b) => a.name.localeCompare(b.name));
  return {rooms};
});

function chatRoomClean(data) {
  const name = String((data && data.name) || '').trim().slice(0, 60);
  const description = String((data && data.description) || '').trim().slice(0, 200);
  return {name, description};
}

async function chatRoomWriteMembers(roomId, uids) {
  const map = {};
  uids.forEach((u) => { map[u] = true; });
  await admin.database().ref('chat-rooms/' + roomId + '/meta').update({members: map});
}

exports.manageChatRoom = functions.https.onCall(async (request) => {
  const actor = await chatActor(request);
  if (!actor.isExec) throw chatErr('permission-denied', 'Executives only');
  const data = request.data || {};
  const action = String(data.action || '');
  const db = admin.firestore();
  const cleanUids = (arr) => Array.from(new Set((Array.isArray(arr) ? arr : []).map(String).filter((u) => /^[A-Za-z0-9_-]{6,128}$/.test(u))));

  async function validActiveUids(uids, execOnly) {
    const refs = uids.map((u) => db.collection('users').doc(u));
    const snaps = refs.length ? await db.getAll(...refs) : [];
    return snaps.filter((s) => s.exists && ['active', 'approved'].includes(String((s.data() || {}).status || '').toLowerCase()) && (!execOnly || EXECUTIVE_ROLES.has(String((s.data() || {}).role || '').toLowerCase()))).map((s) => s.id);
  }

  if (action === 'create') {
    const {name, description} = chatRoomClean(data);
    if (name.length < 2) throw chatErr('invalid-argument', 'Give the room a name');
    const scope = data.scope === 'national' ? 'national' : 'region';
    let regionKey = '', regionName = '';
    if (scope === 'national') {
      if (!(actor.oversight || actor.role === 'national_executive')) throw chatErr('permission-denied', 'Only national executives can create national rooms');
    } else if (actor.oversight && data.region) {
      regionKey = chatNorm(data.region); regionName = String(data.region);
    } else {
      regionKey = actor.regionKey; regionName = actor.regionRaw;
    }
    if (scope === 'region' && !regionKey) throw chatErr('invalid-argument', 'A region is required');
    const members = await validActiveUids(cleanUids(data.memberUids).slice(0, 500), scope === 'national');
    const memberUids = Array.from(new Set([actor.uid, ...members]));
    const roomId = admin.database().ref('chat-rooms').push().key;
    const room = {name, description, scope, regionKey, regionName, createdBy: actor.uid, createdByName: actor.name, memberUids, archived: false, createdAt: admin.firestore.FieldValue.serverTimestamp()};
    await db.collection('chat_rooms').doc(roomId).set(room);
    await admin.database().ref('chat-rooms/' + roomId + '/meta').set({
      name, description, scope, regionKey, regionName, createdBy: actor.uid, createdByName: actor.name,
      createdAt: admin.database.ServerValue.TIMESTAMP, archived: false, members: memberUids.reduce((m, u) => { m[u] = true; return m; }, {})
    });
    await chatNotifyUsers(db, memberUids.filter((u) => u !== actor.uid), {type: 'chat_room', title: 'You were added to a chat room', message: actor.name + ' added you to "' + name + '".', link: '/member-dashboard/regional-chat.html?room=' + roomId});
    await chatAudit({action: 'room_create', channel: 'room', roomId, regionKey, byUid: actor.uid, byName: actor.name, byRole: actor.role, reason: name});
    return {success: true, roomId};
  }

  const roomId = String(data.roomId || '');
  if (!/^[-A-Za-z0-9_]{8,40}$/.test(roomId)) throw chatErr('invalid-argument', 'Invalid room');
  const room = await chatLoadRoom(roomId);

  if (action === 'leave') {
    if (room.createdBy === actor.uid) throw chatErr('failed-precondition', 'The room creator cannot leave; archive the room instead');
    const next = (room.memberUids || []).filter((u) => u !== actor.uid);
    await db.collection('chat_rooms').doc(roomId).update({memberUids: next});
    await chatRoomWriteMembers(roomId, next);
    return {success: true};
  }

  const canManage = actor.oversight || room.createdBy === actor.uid || (actor.role === 'regional_executive' && room.scope === 'region' && room.regionKey === actor.regionKey);
  if (!canManage) throw chatErr('permission-denied', 'You cannot manage this room');

  if (action === 'update') {
    const {name, description} = chatRoomClean(data);
    if (name.length < 2) throw chatErr('invalid-argument', 'Give the room a name');
    await db.collection('chat_rooms').doc(roomId).update({name, description});
    await admin.database().ref('chat-rooms/' + roomId + '/meta').update({name, description});
    return {success: true};
  }
  if (action === 'archive' || action === 'unarchive') {
    const archived = action === 'archive';
    await db.collection('chat_rooms').doc(roomId).update({archived});
    await admin.database().ref('chat-rooms/' + roomId + '/meta').update({archived});
    await chatAudit({action: 'room_' + action, channel: 'room', roomId, byUid: actor.uid, byName: actor.name, byRole: actor.role, reason: room.name});
    return {success: true};
  }
  if (action === 'addMembers' || action === 'removeMembers') {
    let next = new Set(room.memberUids || []);
    const uids = cleanUids(data.memberUids).slice(0, 500);
    if (action === 'addMembers') {
      const valid = await validActiveUids(uids, room.scope === 'national');
      const fresh = valid.filter((u) => !next.has(u));
      valid.forEach((u) => next.add(u));
      await chatNotifyUsers(db, fresh, {type: 'chat_room', title: 'You were added to a chat room', message: actor.name + ' added you to "' + room.name + '".', link: '/member-dashboard/regional-chat.html?room=' + roomId});
    } else {
      uids.forEach((u) => { if (u !== room.createdBy) next.delete(u); });
    }
    if (next.size > 500) throw chatErr('failed-precondition', 'A room can have at most 500 members');
    const arr = Array.from(next);
    await db.collection('chat_rooms').doc(roomId).update({memberUids: arr});
    await chatRoomWriteMembers(roomId, arr);
    return {success: true, memberCount: arr.length};
  }
  if (action === 'members') {
    const refs = (room.memberUids || []).map((u) => db.collection('users').doc(u));
    const snaps = refs.length ? await db.getAll(...refs) : [];
    return {members: snaps.filter((s) => s.exists).map((s) => ({uid: s.id, name: (s.data() || {}).fullName || 'Member', role: (s.data() || {}).role || 'member'}))};
  }
  throw chatErr('invalid-argument', 'Unknown action');
});

// ---- push notification registration and mute settings ----
exports.registerPushToken = functions.https.onCall(async (request) => {
  const actor = await chatActor(request);
  const token = String((request.data && request.data.token) || '');
  if (token.length < 20 || token.length > 4096) throw chatErr('invalid-argument', 'Invalid token');
  const id = crypto.createHash('sha1').update(token).digest('hex');
  const db = admin.firestore();
  await db.collection('chat_push_tokens').doc(id).set({
    token, uid: actor.uid, regionKey: actor.regionKey || '', executive: actor.isExec, updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });
  const prefs = await db.collection('chat_prefs').doc(actor.uid).get();
  return {success: true, muted: prefs.exists ? (prefs.data().muted || []) : []};
});

exports.unregisterPushToken = functions.https.onCall(async (request) => {
  const actor = await chatActor(request);
  const token = String((request.data && request.data.token) || '');
  if (!token) return {success: true};
  const ref = admin.firestore().collection('chat_push_tokens').doc(crypto.createHash('sha1').update(token).digest('hex'));
  const snap = await ref.get();
  if (snap.exists && snap.data().uid === actor.uid) await ref.delete();
  return {success: true};
});

exports.getChatPrefs = functions.https.onCall(async (request) => {
  const actor = await chatActor(request);
  const prefs = await admin.firestore().collection('chat_prefs').doc(actor.uid).get();
  return {muted: prefs.exists ? (prefs.data().muted || []) : []};
});

exports.setChatMute = functions.https.onCall(async (request) => {
  const actor = await chatActor(request);
  const key = String((request.data && request.data.channelKey) || '');
  if (!/^(regional|announcement):[a-z0-9-]{1,80}$|^national$|^room:[-A-Za-z0-9_]{8,40}$/.test(key)) throw chatErr('invalid-argument', 'Invalid channel');
  const muted = request.data && request.data.muted === true;
  await admin.firestore().collection('chat_prefs').doc(actor.uid).set({
    muted: muted ? admin.firestore.FieldValue.arrayUnion(key) : admin.firestore.FieldValue.arrayRemove(key)
  }, {merge: true});
  return {success: true};
});

// ---- push delivery ----
function chatPreview(m) {
  if (m.text) return String(m.text).slice(0, 110);
  const t = String(m.fileType || '');
  if (t.startsWith('image/')) return 'Sent a photo';
  if (t.startsWith('audio/')) return 'Sent a voice note';
  return 'Sent a file';
}

async function chatSendPush({tokenDocs, channelKey, senderUid, title, body, link}) {
  const db = admin.firestore();
  const docs = tokenDocs.filter((d) => d.data().uid !== senderUid);
  if (!docs.length) return;
  const uids = Array.from(new Set(docs.map((d) => d.data().uid)));
  const mutedSet = new Set();
  for (let i = 0; i < uids.length; i += 300) {
    const snaps = await db.getAll(...uids.slice(i, i + 300).map((u) => db.collection('chat_prefs').doc(u)));
    snaps.forEach((s) => { if (s.exists && (s.data().muted || []).includes(channelKey)) mutedSet.add(s.id); });
  }
  const targets = docs.filter((d) => !mutedSet.has(d.data().uid));
  for (let i = 0; i < targets.length; i += 500) {
    const chunk = targets.slice(i, i + 500);
    const res = await admin.messaging().sendEachForMulticast({
      tokens: chunk.map((d) => d.data().token),
      notification: {title, body},
      data: {link},
      webpush: {headers: {Urgency: 'high', TTL: '86400'}, fcmOptions: {link: CHAT_SITE + link}, notification: {icon: CHAT_SITE + '/images/logo.jpg', tag: channelKey, renotify: true, silent: false, vibrate: [200, 100, 200]}}
    });
    const dead = [];
    res.responses.forEach((r, idx) => {
      const code = r.error && r.error.code;
      if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token') dead.push(chunk[idx].ref.delete());
    });
    if (dead.length) await Promise.all(dead);
  }
}

// Called by the page right after a message is posted: verifies the message is real and recent, then pushes it.
exports.notifyChatMessage = functions.https.onCall(async (request) => {
  const actor = await chatActor(request);
  const input = chatCheckInput(request.data);
  if (!(await chatCanAccess(actor, input))) throw chatErr('permission-denied', 'No access to this channel');
  const found = await chatFindMessage(input);
  const m = found.data;
  const sender = m.senderId || m.authorId;
  if (sender !== actor.uid) throw chatErr('permission-denied', 'Only the sender can trigger notifications');
  if (Date.now() - Number(m.timestamp || 0) > 2 * 60 * 1000) return {success: true, skipped: 'old'};
  if (m.hidden === true || m.deleted === true || m.system === true) return {success: true, skipped: 'removed'};
  try {
    await admin.firestore().collection('chat_push_sent').doc(input.channel + '_' + input.messageId).create({at: admin.firestore.FieldValue.serverTimestamp()});
  } catch (e) {
    return {success: true, skipped: 'already sent'};
  }
  const db = admin.firestore();
  if (input.channel === 'regional') {
    const key = chatNorm(input.region);
    const snap = await db.collection('chat_push_tokens').where('regionKey', '==', key).get();
    await chatSendPush({tokenDocs: snap.docs, channelKey: 'regional:' + key, senderUid: actor.uid,
      title: (m.regionName || 'Regional chat') + ' · ' + (m.senderName || 'Member'), body: chatPreview(m), link: '/member-dashboard/regional-chat.html?c=regional'});
  } else if (input.channel === 'announcement') {
    const key = chatNorm(input.region);
    const snap = await db.collection('chat_push_tokens').where('regionKey', '==', key).get();
    await chatSendPush({tokenDocs: snap.docs, channelKey: 'announcement:' + key, senderUid: actor.uid,
      title: 'Announcement · ' + (m.regionName || 'AMCAG'), body: (m.authorName || 'Executive') + ': ' + chatPreview(m), link: '/member-dashboard/regional-chat.html?c=announcement'});
  } else if (input.channel === 'national') {
    const snap = await db.collection('chat_push_tokens').where('executive', '==', true).get();
    await chatSendPush({tokenDocs: snap.docs, channelKey: 'national', senderUid: actor.uid,
      title: 'National chat · ' + (m.senderName || 'Executive'), body: chatPreview(m), link: '/member-dashboard/regional-chat.html?c=national'});
  } else {
    const room = await chatLoadRoom(input.roomId);
    const members = (room.memberUids || []).filter((u) => u !== actor.uid);
    const docs = [];
    for (let i = 0; i < members.length; i += 30) {
      const snap = await db.collection('chat_push_tokens').where('uid', 'in', members.slice(i, i + 30)).get();
      snap.docs.forEach((d) => docs.push(d));
    }
    await chatSendPush({tokenDocs: docs, channelKey: 'room:' + input.roomId, senderUid: actor.uid,
      title: room.name + ' · ' + (m.senderName || 'Member'), body: chatPreview(m), link: '/member-dashboard/regional-chat.html?room=' + input.roomId});
  }
  return {success: true};
});

// ---- friendly welcome note in the regional chat when a member is approved ----
exports.onMemberWelcomeChat = onChatDocUpdated('users/{uid}', async (event) => {
  const before = event.data.before.data() || {};
  const after = event.data.after.data() || {};
  const wasActive = ['active', 'approved'].includes(String(before.status || '').toLowerCase());
  const isActive = ['active', 'approved'].includes(String(after.status || '').toLowerCase());
  if (wasActive || !isActive) return;
  if (String(after.role || 'member').toLowerCase() !== 'member') return;
  const raw = chatRegionRaw(after);
  const key = chatNorm(raw);
  if (!key) return;
  const first = String(after.fullName || '').trim().split(/\s+/)[0] || 'a new member';
  await admin.database().ref('regional-chats/' + key + '/messages').push({
    senderId: 'system', senderName: 'AMCAG', senderRole: 'system', system: true,
    text: 'Please welcome ' + first + ' to the ' + raw + ' community chat!',
    region: key, regionName: raw, timestamp: admin.database.ServerValue.TIMESTAMP
  });
});

// ===== PUBLIC DONOR RECOGNITION =====
// The public page cannot read donations directly (they are private), so this returns only what is safe to show:
// named donors who chose to be public, overall totals, and recent impact stories without donor names.
exports.getDonorRecognition = functions.https.onCall(async () => {
  const db = admin.firestore();
  const snap = await db.collection('donations').where('status', 'in', ['confirmed', 'distributed']).get();
  const donors = {};
  const donorIds = new Set();
  let totalRaised = 0;
  const beneficiaries = new Set();
  const stories = [];
  snap.docs.forEach((doc) => {
    const d = doc.data();
    const uid = d.donorUid || d.donorId || doc.id;
    donorIds.add(uid);
    if (d.type === 'monetary') totalRaised += Number(d.amount || 0);
    const isPublic = d.visibility === 'public' && d.donorType !== 'anonymous';
    if (isPublic) {
      const row = donors[uid] || (donors[uid] = {name: d.donorName || 'AMCAG donor', total: 0, donationCount: 0, hasMaterial: false});
      if (d.type === 'monetary') row.total += Number(d.amount || 0); else row.hasMaterial = true;
      row.donationCount += 1;
    }
    if (d.status === 'distributed') {
      if (d.beneficiaryName) beneficiaries.add(String(d.beneficiaryName).trim().toLowerCase());
      if (d.visibility !== 'executives_only') {
        const when = d.distributedAt && d.distributedAt.toMillis ? d.distributedAt.toMillis() : 0;
        const photos = Array.isArray(d.distributionPhotos) ? d.distributionPhotos : [];
        const photo = photos.map((p) => p && p.url).find((u) => /^https:\/\//.test(String(u || ''))) || '';
        stories.push({
          beneficiary: String(d.beneficiaryName || '').slice(0, 120),
          beneficiaryType: String(d.beneficiaryType || '').slice(0, 60),
          impact: String(d.impact || '').slice(0, 400),
          photoUrl: photo,
          at: when
        });
      }
    }
  });
  stories.sort((a, b) => b.at - a.at);
  return {
    donors: Object.values(donors).sort((a, b) => b.total - a.total),
    stats: {
      totalRaised,
      totalDonors: donorIds.size,
      totalBeneficiaries: beneficiaries.size,
      totalDistributions: snap.docs.filter((x) => x.data().status === 'distributed').length
    },
    stories: stories.slice(0, 6)
  };
});


// ================================================================
// QUESTION BANK: add, import, review and retire questions
// Only approved questions are ever sent to members. Reviewers (super admin or members flagged
// questionReviewer) approve. Executives with president / secretary / PRO titles can add and edit.
// ================================================================
function questionBankPermissions(profile) {
  const p = profile || {};
  const isSuper = p.role === 'super_admin';
  const canReview = isSuper || p.questionReviewer === true;
  const title = String(p.executiveTitle || p.title || '').toLowerCase().trim();
  const titled = p.role === 'national_executive' && title && !QUESTION_VIEW_TITLE_EXCLUDE.test(title) &&
    /(president|secretary|pro|public relations)/.test(title);
  return {isSuper, canReview, canManage: canReview || !!titled};
}

async function requireQuestionBankActor(request, need) {
  const profile = await requireActiveMember(request);
  const perms = questionBankPermissions(profile);
  const ok = need === 'review' ? perms.canReview : need === 'super' ? perms.isSuper : perms.canManage;
  if (!ok) {
    throw new functions.https.HttpsError('permission-denied', 'You do not have access to the question bank');
  }
  return {profile, perms, uid: request.auth.uid};
}

function questionBankDoc(id, d) {
  return {
    id,
    topic: d.topic, question: d.question, options: d.options, answer: d.answer,
    explanation: d.explanation, difficulty: d.difficulty || 'medium', source: d.source || '',
    status: d.status, reviewNote: d.reviewNote || '', createdByName: d.createdByName || '',
    reviewedByName: d.reviewedByName || '',
    createdAt: d.createdAt ? d.createdAt.toMillis() : 0,
    reviewedAt: d.reviewedAt ? d.reviewedAt.toMillis() : 0,
    timesAsked: d.timesAsked || 0, lastAskedDay: d.lastAskedDay || 0,
    answeredCount: d.answeredCount || 0, correctCount: d.correctCount || 0
  };
}

async function writeQuestionAudit(actor, action, ids, note) {
  await admin.firestore().collection('question_bank_audit').add({
    action, count: ids.length, ids: ids.slice(0, 50), note: note || '',
    byUid: actor.uid, byName: actor.profile.fullName || actor.profile.displayName || '',
    at: admin.firestore.FieldValue.serverTimestamp()
  });
}

// Makes sure the original 42 built-in questions exist in the bank (as approved: they were already in use).
async function ensureLegacyQuestionsInBank() {
  const db = admin.firestore();
  const {QUESTIONS} = require('./question-bank');
  const refs = QUESTIONS.map((_, i) => db.collection('question_bank').doc('seed-' + String(i + 1).padStart(3, '0')));
  const snaps = await db.getAll(...refs);
  const batch = db.batch();
  let added = 0;
  snaps.forEach((s, i) => {
    if (s.exists) return;
    const q = QUESTIONS[i];
    batch.set(refs[i], {
      topic: q.topic, question: q.question, options: q.options, answer: q.answer, explanation: q.explanation,
      difficulty: 'medium', source: q.source || 'seed', status: 'approved', legacy: true,
      createdByName: 'AMCAG original list', timesAsked: 0, lastAskedDay: 0, answeredCount: 0, correctCount: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    added++;
  });
  if (added) await batch.commit();
  return added;
}

exports.listQuestionBank = functions.https.onCall({memory: '512MiB'}, async (request) => {
  const actor = await requireQuestionBankActor(request, 'manage');
  await ensureLegacyQuestionsInBank();
  const data = request.data || {};
  const snap = await admin.firestore().collection('question_bank').limit(8000).get();
  const counts = {pending: 0, approved: 0, retired: 0, rejected: 0};
  const topics = {};
  let all = [];
  snap.forEach((doc) => {
    const d = doc.data();
    counts[d.status] = (counts[d.status] || 0) + 1;
    const t = topics[d.topic] || (topics[d.topic] = {topic: d.topic, approved: 0, pending: 0, total: 0});
    t.total++;
    if (d.status === 'approved') t.approved++;
    if (d.status === 'pending') t.pending++;
    all.push(questionBankDoc(doc.id, d));
  });
  const status = String(data.status || '');
  const topic = String(data.topic || '');
  const difficulty = String(data.difficulty || '');
  const search = String(data.search || '').toLowerCase().trim();
  if (status) all = all.filter((q) => q.status === status);
  if (topic) all = all.filter((q) => q.topic === topic);
  if (difficulty) all = all.filter((q) => q.difficulty === difficulty);
  if (search) all = all.filter((q) => (q.question + ' ' + q.options.join(' ') + ' ' + q.explanation).toLowerCase().includes(search));
  all.sort((a, b) => (b.createdAt - a.createdAt) || a.id.localeCompare(b.id));
  const pageSize = Math.min(Math.max(Number(data.pageSize) || 25, 5), 100);
  const page = Math.max(Number(data.page) || 1, 1);
  return {
    canReview: actor.perms.canReview, isSuper: actor.perms.isSuper,
    counts, topics: Object.values(topics).sort((a, b) => a.topic.localeCompare(b.topic)),
    total: all.length, page, pageSize,
    items: all.slice((page - 1) * pageSize, page * pageSize)
  };
});

exports.saveQuestion = functions.https.onCall(async (request) => {
  const actor = await requireQuestionBankActor(request, 'manage');
  const data = request.data || {};
  const v = questionStore.validateQuestion(data);
  if (!v.ok) throw new functions.https.HttpsError('invalid-argument', v.error);
  const db = admin.firestore();
  const FieldValue = admin.firestore.FieldValue;
  const name = actor.profile.fullName || actor.profile.displayName || '';
  const id = String(data.id || '').trim();
  if (id) {
    const ref = db.collection('question_bank').doc(id);
    const snap = await ref.get();
    if (!snap.exists) throw new functions.https.HttpsError('not-found', 'Question not found');
    const old = snap.data();
    const changed = ['topic', 'question', 'explanation', 'answer'].some((k) => old[k] !== v.value[k]) ||
      JSON.stringify(old.options) !== JSON.stringify(v.value.options);
    const update = {...v.value, updatedAt: FieldValue.serverTimestamp()};
    // Content changes by a non-reviewer send an approved question back for review.
    if (changed && old.status === 'approved' && !actor.perms.canReview) {
      update.status = 'pending';
      update.reviewNote = 'Edited after approval; needs review again';
    }
    await ref.update(update);
    await writeQuestionAudit(actor, 'edit', [id], '');
    return {id, status: update.status || old.status};
  }
  const newId = questionStore.questionId(v.value.question);
  const ref = db.collection('question_bank').doc(newId);
  if ((await ref.get()).exists) {
    throw new functions.https.HttpsError('already-exists', 'This question is already in the bank');
  }
  const status = actor.perms.canReview ? 'approved' : 'pending';
  await ref.set({
    ...v.value, source: v.value.source || 'manual', status,
    createdByUid: actor.uid, createdByName: name,
    ...(status === 'approved' ? {reviewedByName: name, reviewedAt: FieldValue.serverTimestamp()} : {}),
    timesAsked: 0, lastAskedDay: 0, answeredCount: 0, correctCount: 0,
    createdAt: FieldValue.serverTimestamp()
  });
  await writeQuestionAudit(actor, 'add', [newId], '');
  return {id: newId, status};
});

// Bulk import: every row lands as "pending" until a reviewer approves it.
exports.importQuestions = functions.https.onCall({memory: '512MiB', timeoutSeconds: 120}, async (request) => {
  const actor = await requireQuestionBankActor(request, 'manage');
  const rows = Array.isArray((request.data || {}).questions) ? request.data.questions : [];
  if (!rows.length) throw new functions.https.HttpsError('invalid-argument', 'No questions supplied');
  if (rows.length > 500) throw new functions.https.HttpsError('invalid-argument', 'Import at most 500 questions at a time');
  const db = admin.firestore();
  const FieldValue = admin.firestore.FieldValue;
  const name = actor.profile.fullName || actor.profile.displayName || '';
  const sourceLabel = String((request.data || {}).source || 'import').slice(0, 100);
  const prepared = [];
  const errors = [];
  const seen = new Set();
  rows.forEach((row, i) => {
    const v = questionStore.validateQuestion(row);
    if (!v.ok) { errors.push({row: i + 1, error: v.error}); return; }
    const id = questionStore.questionId(v.value.question);
    if (seen.has(id)) { errors.push({row: i + 1, error: 'Duplicate inside this file'}); return; }
    seen.add(id);
    prepared.push({id, value: v.value});
  });
  const refs = prepared.map((p) => db.collection('question_bank').doc(p.id));
  const existing = refs.length ? await db.getAll(...refs) : [];
  let added = 0;
  let skipped = 0;
  let batch = db.batch();
  let inBatch = 0;
  for (let i = 0; i < prepared.length; i++) {
    if (existing[i].exists) { skipped++; continue; }
    batch.set(refs[i], {
      ...prepared[i].value, source: prepared[i].value.source || sourceLabel, status: 'pending',
      createdByUid: actor.uid, createdByName: name,
      timesAsked: 0, lastAskedDay: 0, answeredCount: 0, correctCount: 0,
      createdAt: FieldValue.serverTimestamp()
    });
    added++;
    if (++inBatch === 400) { await batch.commit(); batch = db.batch(); inBatch = 0; }
  }
  if (inBatch) await batch.commit();
  await writeQuestionAudit(actor, 'import', prepared.map((p) => p.id), `${added} added, ${skipped} already existed, ${errors.length} invalid (${sourceLabel})`);
  return {added, skipped, invalid: errors.length, errors: errors.slice(0, 25)};
});

exports.reviewQuestions = functions.https.onCall(async (request) => {
  const actor = await requireQuestionBankActor(request, 'review');
  const data = request.data || {};
  const ids = Array.isArray(data.ids) ? [...new Set(data.ids.map(String))] : [];
  const action = String(data.action || '');
  const map = {approve: 'approved', reject: 'rejected', retire: 'retired', restore: 'pending'};
  if (!map[action]) throw new functions.https.HttpsError('invalid-argument', 'Unknown action');
  if (!ids.length || ids.length > 400) throw new functions.https.HttpsError('invalid-argument', 'Choose 1-400 questions');
  const note = String(data.note || '').slice(0, 300);
  const db = admin.firestore();
  const refs = ids.map((id) => db.collection('question_bank').doc(id));
  const snaps = await db.getAll(...refs);
  const batch = db.batch();
  let changed = 0;
  const name = actor.profile.fullName || actor.profile.displayName || '';
  snaps.forEach((s, i) => {
    if (!s.exists) return;
    batch.update(refs[i], {
      status: map[action], reviewNote: note, reviewedByUid: actor.uid, reviewedByName: name,
      reviewedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    changed++;
  });
  if (changed) await batch.commit();
  await writeQuestionAudit(actor, action, ids, note);
  return {changed};
});

exports.deleteQuestions = functions.https.onCall(async (request) => {
  const actor = await requireQuestionBankActor(request, 'manage');
  const ids = Array.isArray((request.data || {}).ids) ? [...new Set(request.data.ids.map(String))] : [];
  if (!ids.length || ids.length > 400) throw new functions.https.HttpsError('invalid-argument', 'Choose 1-400 questions');
  const db = admin.firestore();
  const refs = ids.map((id) => db.collection('question_bank').doc(id));
  const snaps = await db.getAll(...refs);
  const batch = db.batch();
  let deleted = 0;
  snaps.forEach((s, i) => {
    // Approved or already-asked questions are retired, never deleted, so history stays intact.
    if (s.exists && s.get('status') !== 'approved' && !(s.get('timesAsked') > 0) && !s.get('legacy')) {
      batch.delete(refs[i]);
      deleted++;
    }
  });
  if (deleted) await batch.commit();
  await writeQuestionAudit(actor, 'delete', ids, `${deleted} deleted`);
  return {deleted, kept: ids.length - deleted};
});

exports.setQuestionReviewer = functions.https.onCall(async (request) => {
  const actor = await requireQuestionBankActor(request, 'super');
  const data = request.data || {};
  const value = data.value !== false;
  const email = String(data.email || '').toLowerCase().trim();
  const memberId = String(data.memberId || '').trim();
  const db = admin.firestore();
  let snap = null;
  if (email) snap = await db.collection('users').where('email', '==', email).limit(1).get();
  else if (memberId) snap = await db.collection('users').where('memberId', '==', memberId).limit(1).get();
  if (!snap || snap.empty) throw new functions.https.HttpsError('not-found', 'No member found with that email or member ID');
  const doc = snap.docs[0];
  await doc.ref.update({questionReviewer: value});
  await writeQuestionAudit(actor, value ? 'reviewer-added' : 'reviewer-removed', [doc.id], doc.get('fullName') || '');
  return {name: doc.get('fullName') || '', value};
});

exports.listQuestionReviewers = functions.https.onCall(async (request) => {
  await requireQuestionBankActor(request, 'super');
  const snap = await admin.firestore().collection('users').where('questionReviewer', '==', true).get();
  return {reviewers: snap.docs.map((d) => ({uid: d.id, name: d.get('fullName') || '', email: d.get('email') || '', memberId: d.get('memberId') || ''}))};
});
