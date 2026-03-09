const functions = require("firebase-functions");
const {onDocumentCreated} = require("firebase-functions/v2/firestore");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");
const crypto = require("crypto");
const axios = require("axios");

admin.initializeApp();

// Paystack Configuration
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || "";

function ensurePaystackKeyConfigured() {
  if (!PAYSTACK_SECRET_KEY) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Paystack secret key is not configured."
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
            userId: adminDoc.id,
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
function getMembershipSequenceFromId(memberId, expectedYear) {
  const match = String(memberId || '').match(/^AMCAG-(\d{4})-(\d{3,6})$/i);
  if (!match) return 0;

  const idYear = parseInt(match[1], 10);
  const seq = parseInt(match[2], 10);
  if (!Number.isFinite(idYear) || !Number.isFinite(seq)) return 0;
  if (idYear !== expectedYear) return 0;
  return seq > 0 ? seq : 0;
}

async function generateMembershipId(db) {
  const currentYear = new Date().getFullYear();
  const counterRef = db.collection('system_counters').doc('membership_id');
  const memberIdPrefix = `AMCAG-${currentYear}-`;
  
  try {
    const result = await db.runTransaction(async (transaction) => {
      const [counterDoc, latestMemberForYear] = await Promise.all([
        transaction.get(counterRef),
        transaction.get(
          db.collection('users')
            .where('memberId', '>=', memberIdPrefix)
            .where('memberId', '<=', `${memberIdPrefix}\uf8ff`)
            .orderBy('memberId', 'desc')
            .limit(1)
        )
      ]);
      
      let counterNumber = 0;
      let existingNumber = 0;
      
      if (counterDoc.exists) {
        const data = counterDoc.data();
        if (data.year === currentYear) {
          const parsedCounter = parseInt(data.lastNumber || 0, 10);
          if (Number.isFinite(parsedCounter) && parsedCounter > 0) {
            counterNumber = parsedCounter;
          }
        }
      }

      if (!latestMemberForYear.empty) {
        const latestMemberData = latestMemberForYear.docs[0].data() || {};
        existingNumber = getMembershipSequenceFromId(latestMemberData.memberId, currentYear);
      }

      // Keep sequence strictly increasing even if counter was reset/deleted.
      const nextNumber = Math.max(counterNumber, existingNumber) + 1;
      
      // Update counter
      transaction.set(counterRef, {
        lastNumber: nextNumber,
        year: currentYear,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      // Generate ID in format: AMCAG-2026-0001
      const memberId = `AMCAG-${currentYear}-${String(nextNumber).padStart(4, '0')}`;
      
      return memberId;
    });
    
    return result;
  } catch (error) {
    console.error('Error generating membership ID:', error);
    throw new functions.https.HttpsError('internal', 'Failed to generate membership ID');
  }
}

// ===== APPROVE MEMBER =====
exports.approveMember = functions.https.onCall(async (data, context) => {
  // Authentication check
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { memberUid, notes } = data; // Removed memberId from required params
  const approverUid = context.auth.uid;

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

    // Check permissions
    const canApprove = 
      approver.role === 'super_admin' ||
      approver.role === 'national_executive' ||
      (approver.role === 'regional_executive' && 
       approver.canApproveMembership === true && 
       approver.region === member.region);

    if (!canApprove) {
      throw new functions.https.HttpsError('permission-denied', 'Not authorized to approve members');
    }

    // If regional approval, check if region has permission
    if (approver.role === 'regional_executive') {
      const regionDoc = await db.collection('regions').doc(member.region).get();
      if (!regionDoc.exists || regionDoc.data().canApproveMembersLocally !== true) {
        throw new functions.https.HttpsError('permission-denied', 'Region does not have local approval permission');
      }
    }

    // Check member status
    if (member.status !== 'pending') {
      throw new functions.https.HttpsError('failed-precondition', 'Member is not pending approval');
    }

    // ===== AUTO-GENERATE MEMBERSHIP ID =====
    const memberId = await generateMembershipId(db);
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

    // Update members collection
    await db.collection('members').doc(memberUid).update({
      status: 'active',
      memberId: memberId,
      joiningDate: now,
      approvalStatus: 'approved',
      approvedBy: approverUid,
      approvedByName: approver.fullName || approver.email,
      approvedAt: now,
      updatedAt: now
    });

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
        region: member.region,
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
});

// ===== REJECT MEMBER =====
exports.rejectMember = functions.https.onCall(async (data, context) => {
  // Authentication check
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { memberUid, reason } = data;
  const approverUid = context.auth.uid;

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

    // Check permissions (same as approve)
    const canReject = 
      approver.role === 'super_admin' ||
      approver.role === 'national_executive' ||
      (approver.role === 'regional_executive' && 
       approver.canApproveMembership === true && 
       approver.region === member.region);

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

    // Update members collection
    await db.collection('members').doc(memberUid).update({
      status: 'rejected',
      approvalStatus: 'rejected',
      rejectedBy: approverUid,
      rejectedByName: approver.fullName || approver.email,
      rejectedAt: now,
      rejectionReason: reason,
      updatedAt: now
    });

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
        region: member.region,
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

// ===== PROCESS DUES PAYMENT =====
exports.processDuesPayment = functions.https.onCall(async (data, context) => {
  // Authentication check
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { months, paymentMethod, amount, notes, paystackReference, transferReference } = data;
  const memberUid = context.auth.uid;

  if (!months || !Array.isArray(months) || months.length === 0) {
    throw new functions.https.HttpsError('invalid-argument', 'Months array is required');
  }

  if (!paymentMethod || !amount) {
    throw new functions.https.HttpsError('invalid-argument', 'Payment method and amount are required');
  }

  const MONTHLY_DUES_AMOUNT = 50.00;
  const expectedAmount = months.length * MONTHLY_DUES_AMOUNT;

  if (Math.abs(amount - expectedAmount) > 0.01) {
    throw new functions.https.HttpsError('invalid-argument', `Invalid amount. Expected GHS ${expectedAmount.toFixed(2)}`);
  }

  try {
    const db = admin.firestore();
    
    // Get member details
    const memberDoc = await db.collection('users').doc(memberUid).get();
    if (!memberDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Member not found');
    }

    const member = memberDoc.data();

    if (member.status !== 'active') {
      throw new functions.https.HttpsError('permission-denied', 'Only active members can pay dues');
    }

    const now = admin.firestore.Timestamp.now();
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();

    // Verify Paystack payment if applicable
    let paystackVerification = null;
    if (paymentMethod === 'paystack' && paystackReference) {
      try {
        ensurePaystackKeyConfigured();

        const response = await axios.get(
          `https://api.paystack.co/transaction/verify/${paystackReference}`,
          {
            headers: {
              Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`
            }
          }
        );

        if (!response.data || !response.data.data) {
          throw new Error('Invalid Paystack response');
        }

        const transaction = response.data.data;

        // Verify transaction details
        if (transaction.status !== 'success') {
          throw new functions.https.HttpsError('failed-precondition', 'Payment was not successful');
        }

        // Verify amount (Paystack returns in kobo/pesewas)
        const paidAmount = transaction.amount / 100;
        if (Math.abs(paidAmount - amount) > 0.01) {
          throw new functions.https.HttpsError('invalid-argument', 
            `Payment amount mismatch. Expected GHS ${amount.toFixed(2)}, got GHS ${paidAmount.toFixed(2)}`);
        }

        // Verify currency
        if (transaction.currency !== 'GHS') {
          throw new functions.https.HttpsError('invalid-argument', 'Invalid currency');
        }

        // Check if reference was already used
        const existingPayment = await db.collection('payments')
          .where('paystackReference', '==', paystackReference)
          .get();

        if (!existingPayment.empty) {
          throw new functions.https.HttpsError('already-exists', 'This payment reference has already been used');
        }

        paystackVerification = {
          verified: true,
          reference: paystackReference,
          transactionId: transaction.id,
          channel: transaction.channel,
          paidAt: transaction.paid_at,
          authorizationCode: transaction.authorization?.authorization_code || null
        };

      } catch (error) {
        console.error('Paystack verification error:', error);
        if (error instanceof functions.https.HttpsError) {
          throw error;
        }
        throw new functions.https.HttpsError('internal', 'Payment verification failed: ' + error.message);
      }
    }

    // Validate months
    for (const monthData of months) {
      const { month, year } = monthData;

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
    }

    // Get registration date to validate sequential payment
    const regDate = member.registrationDate ? 
      member.registrationDate.toDate() : 
      new Date();

    // Get all paid months
    const allPaymentsSnapshot = await db.collection('payments')
      .where('uid', '==', memberUid)
      .where('type', '==', 'monthly_dues')
      .where('status', 'in', ['paid', 'waived'])
      .get();

    const paidMonths = new Set();
    allPaymentsSnapshot.docs.forEach(doc => {
      const payment = doc.data();
      paidMonths.add(`${payment.year}-${payment.month}`);
    });

    // Find first unpaid month
    let checkDate = new Date(regDate);
    let firstUnpaid = null;

    while (checkDate <= currentDate) {
      const checkMonth = checkDate.getMonth() + 1;
      const checkYear = checkDate.getFullYear();
      const key = `${checkYear}-${checkMonth}`;

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

        expectedDate.setMonth(expectedDate.getMonth() + 1);
      }
    }

    // Create payment records
    const batch = db.batch();
    const paymentIds = [];
    
    // Determine payment status
    const paymentStatus = paymentMethod === 'paystack' && paystackVerification ? 'paid' : 'pending';

    for (const monthData of months) {
      const { month, year } = monthData;

      const paymentRef = db.collection('payments').doc();
      paymentIds.push(paymentRef.id);

      const paymentData = {
        uid: memberUid,
        memberName: member.fullName || 'Unknown',
        memberId: member.memberId || null,
        region: member.region || null,
        type: 'monthly_dues',
        month: month,
        year: year,
        amount: MONTHLY_DUES_AMOUNT,
        paymentMethod: paymentMethod,
        notes: notes || null,
        status: paymentStatus,
        createdAt: now
      };

      // Add Paystack verification data if applicable
      if (paystackVerification) {
        paymentData.paystackReference = paystackVerification.reference;
        paymentData.paystackTransactionId = paystackVerification.transactionId;
        paymentData.paystackChannel = paystackVerification.channel;
        paymentData.paystackPaidAt = paystackVerification.paidAt;
        paymentData.paymentDate = now;
        paymentData.processedAt = now;
        paymentData.verified = true;
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
      performedBy: memberUid,
      performedByName: member.fullName || member.email,
      performedByRole: member.role || 'member',
      details: {
        monthsCount: months.length,
        totalAmount: amount,
        paymentMethod: paymentMethod,
        paymentStatus: paymentStatus,
        paystackVerified: paystackVerification ? true : false,
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
        memberId = await generateMembershipId(db);
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

    return { 
      success: true,
      message: `Payment processed successfully for ${months.length} month(s)`,
      paymentIds: paymentIds,
      totalAmount: amount
    };

  } catch (error) {
    console.error('Error processing dues payment:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// ===== PAYSTACK WEBHOOK HANDLER =====
exports.paystackWebhook = functions.https.onRequest(async (req, res) => {
  if (!PAYSTACK_SECRET_KEY) {
    console.error("Paystack webhook called without PAYSTACK_SECRET_KEY configured");
    return res.status(500).send("Paystack is not configured");
  }

  const hash = crypto.createHmac('sha512', PAYSTACK_SECRET_KEY)
    .update(JSON.stringify(req.body))
    .digest('hex');

  if (hash !== req.headers['x-paystack-signature']) {
    console.error('Invalid Paystack signature');
    return res.status(400).send('Invalid signature');
  }

  const event = req.body;

  try {
    if (event.event === 'charge.success') {
      const { reference, amount, currency, channel, paid_at } = event.data;
      
      const db = admin.firestore();
      
      // Check if payment already processed
      const existingPayment = await db.collection('payments')
        .where('paystackReference', '==', reference)
        .get();

      if (!existingPayment.empty) {
        console.log('Payment already processed:', reference);
        return res.status(200).send('OK');
      }

      // This is a fallback in case the client-side verification didn't work
      console.log('Webhook processing payment:', reference);
      
      // You could add additional logic here to handle webhook-only payments
      // For now, we rely on client-side verification
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).send('Error');
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
            memberId = await generateMembershipId(db);
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
    const MONTHLY_DUES_AMOUNT = 50.00;

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
      const MONTHLY_DUES_AMOUNT = 50.00;

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
          amount: 50.00,
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
      donorName: userData.fullName || userData.email,
      donorEmail: userData.email,
      donorRegion: userData.region || 'unknown',
      type: type,
      status: 'pending',
      visibility: visibility || 'public',
      purpose: purpose || '',
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
      donationData.campaignName = campaignData.name;
      donationData.campaignType = campaignData.type;
    }

    // Save donation
    const donationRef = await db.collection('donations').add(donationData);

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

    const { title, description, scheduledTime, duration, region, visibility } = data;

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
                  <a href="https://amcag-website.web.app/member-dashboard/meetings.html" class="btn">
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
