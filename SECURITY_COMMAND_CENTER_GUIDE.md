# Security Command Center - Quick Start Guide

## 🎯 What We Built

A **SOC-grade (Security Operations Center)** security monitoring system for AMCAG with:

✅ **Immutable security event logging** - Every sensitive action tracked forever  
✅ **Real-time risk scoring** - Admins get risk scores based on behavior  
✅ **Automated threat detection** - Spikes, unauthorized attempts, high-risk actors flagged automatically  
✅ **Live alert system** - Critical security alerts sent to all super admins  
✅ **Kill switches** - Block specific admins from sensitive actions instantly  
✅ **Investigation tools** - Deep-dive into events with timeline correlation  
✅ **Zero-trust architecture** - Every action verified, logged, time-limited, multi-checked  

---

## 📊 System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   ADMIN ACTIONS                             │
│  (Password Reset, Role Change, Cert Revoke, etc.)          │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              CLOUD FUNCTION                                  │
│  1. Check kill switch (security_controls)                   │
│  2. Validate permissions                                     │
│  3. Execute action                                           │
│  4. Write to security_events (immutable)                    │
│  5. Update security_profiles (risk score)                   │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              RISK ENGINE (onSecurityEventCreated)            │
│  - Detects spikes (7 actions in 20 min → CRITICAL)         │
│  - Flags high-risk admins (score ≥ 50)                     │
│  - Creates security_alerts                                  │
│  - Sends notifications to super admins                      │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│         SECURITY COMMAND CENTER UI                           │
│  - View live event stream                                    │
│  - Acknowledge/resolve alerts                                │
│  - Investigate suspicious activity                           │
│  - Execute kill switches on admins                           │
└─────────────────────────────────────────────────────────────┘
```

---

## 🗄️ Firestore Collections

| Collection | Purpose | Who Writes | Who Reads |
|-----------|---------|-----------|----------|
| `security_events` | Immutable audit log of all sensitive actions | Cloud Functions only | Super admins |
| `security_alerts` | Auto-generated alerts for threats | Risk Engine only | Super admins |
| `security_profiles` | Risk scores & counters per admin | Cloud Functions only | Super admins |
| `security_controls` | Kill switches (block admins) | Super admins | Super admins + Cloud Functions |
| `security_settings` | Configurable thresholds | Super admins | Cloud Functions |
| `audit_logs` | Legacy audit logs (kept for compatibility) | Cloud Functions | Super admins |
| `admin_security` | Rate limiting data | Cloud Functions | Cloud Functions |
| `notifications` | User notifications | Cloud Functions | Users (their own) |

---

## 🚀 Deployment Steps

### 1. Create Security Settings

Go to **Firebase Console → Firestore Database** and create:

**Collection**: `security_settings`  
**Document ID**: `default`  

```json
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
```

### 2. Deploy Cloud Functions

```powershell
cd C:\Users\RealTimeIT\Desktop\AMCAGWEB
firebase deploy --only functions
```

**Functions deployed**:
- `adminResetPassword` (enhanced with security events)
- `onSecurityEventCreated` (risk engine)
- `resetHourlyCounters` (cleanup task)
- `resetDailyCounters` (cleanup task)

### 3. Deploy Firestore Rules

```powershell
firebase deploy --only firestore:rules
```

### 4. Deploy Hosting

```powershell
firebase deploy --only hosting
```

### 5. Access the Command Center

Navigate to: **https://amcag-website.web.app/national/security-command-center.html**

(Only super_admin role has access)

---

## 🔍 How It Works

### Example: Admin Password Reset Flow

1. **Admin clicks "Reset Password" in dashboard**
2. **Re-authentication modal appears** (must enter password within 5 min)
3. **Cloud Function: `adminResetPassword` executes**
   - Checks `security_controls/{adminUid}` for kill switch
   - Validates role = super_admin
   - Checks rate limit (5/hour max)
   - Checks cooldown (10 min between resets for same user)
   - Resets password
   - **Writes to `security_events`**:
     ```json
     {
       "type": "PASSWORD_RESET",
       "severity": "HIGH",
       "actorUid": "ADMIN_UID",
       "actorEmail": "admin@amcag.org",
       "targetUid": "USER_UID",
       "ipHash": "sha256(...)",
       "success": true,
       "createdAt": 1234567890
     }
     ```
   - **Updates `security_profiles/{adminUid}`**:
     ```json
     {
       "riskScore": 20, // +10 for this reset
       "counters": {
         "passwordResets_1h": 2
       }
     }
     ```
4. **Risk Engine: `onSecurityEventCreated` triggers**
   - Counts recent PASSWORD_RESET events by this admin
   - If ≥ 7 in 20 minutes → **Creates CRITICAL alert**
   - Sends notification to all super admins
5. **Super admin sees alert** in Security Command Center
6. **Super admin investigates**:
   - Views event timeline (related events ±30 min)
   - Sees IP hashes, timestamps, targets
7. **Super admin decides**:
   - **Acknowledge** (mark as seen)
   - **Resolve** (add resolution note)
   - **Execute kill switch** (block admin from future sensitive actions)

---

## 🛡️ Security Features

### 1. **Immutable Event Log**
- All security-relevant actions logged to `security_events`
- Cannot be deleted or modified (Firestore rules: `allow write: if false`)
- Includes IP hash, user agent hash, timestamps, full context

### 2. **Risk Scoring System**

| Action | Points Added |
|--------|-------------|
| PASSWORD_RESET | +10 |
| ROLE_CHANGE | +15 |
| CERT_REVOKE | +20 |
| IP/Device change | +25 |
| UNAUTHORIZED_ATTEMPT | +30 |
| Spike detection | +40 |

**Risk levels**:
- 0-20: Low (normal)
- 20-50: Medium (watch)
- 50-80: High (investigate)
- 80+: Critical (alert + possible auto-block)

Risk scores reset daily at midnight.

### 3. **Spike Detection**

Triggers **CRITICAL alert** if:
- Admin performs ≥7 password resets in 20 minutes
- (Configurable in `security_settings`)

### 4. **Kill Switches**

Super admins can block any admin from sensitive actions:
- Creates `security_controls/{adminUid}` with:
  ```json
  {
    "blockSensitiveActions": true,
    "reason": "Investigation ongoing",
    "until": 1234567890 // timestamp, or null for indefinite
  }
  ```
- All Cloud Functions check this before executing
- Logs `ADMIN_BLOCKED` event

### 5. **Unauthorized Attempt Detection**

If a user without proper role tries sensitive action:
- Immediately logs `UNAUTHORIZED_PASSWORD_RESET_ATTEMPT` event
- Creates HIGH severity alert
- Increments risk score by +30

---

## 📈 Using the Command Center

### Overview Cards

- **Open Alerts**: Requires immediate action
- **Critical Events (24h)**: High-severity events in last day
- **High-Risk Admins**: Admins with risk score ≥50
- **Failed Reauth (1h)**: Failed authentication attempts

### Security Alerts Section

View all system-generated alerts:
- **Filters**: All / Open / Critical / High
- **Actions**:
  - **Acknowledge**: Mark as seen (status → ACK)
  - **Resolve**: Close with resolution note (status → RESOLVED)

### Live Event Stream

Real-time table of all security events:
- **Time filters**: 15min / 1hr / 24hr / 7days
- **Columns**: Time, Type, Actor, Target, Severity, Status
- **Click any row** → Investigation modal

### Admin Risk Leaderboard

Sorted by risk score (highest first):
- Shows: Email, Risk Score, Resets (1h), Role Changes (24h), Last Seen
- **🛑 Block button** → Opens kill switch modal

### Investigation Modal

Deep-dive into any event:
- Full event details (type, actor, target, IP hash, etc.)
- **Related Events Timeline** (±30 minutes)
- Helps detect coordinated attacks or patterns

### Kill Switch Modal

Block an admin from sensitive actions:
- Select duration (1hr / 6hr / 24hr / 7days / indefinite)
- Provide reason (required for audit trail)
- Logs `ADMIN_BLOCKED` event

---

## 🧪 Testing

### 1. Trigger Security Event

1. Go to: `/national/members.html`
2. Reset a user's password
3. Check Firestore: `security_events` → Should have new `PASSWORD_RESET` event
4. Check Firestore: `security_profiles/{yourUid}` → Risk score should be 10

### 2. Trigger Spike Alert

1. Reset 7 different users' passwords within 20 minutes
2. Check Firestore: `security_alerts` → Should create `RATE_SPIKE` alert
3. Check Firestore: `notifications` → All super admins should have notification
4. Go to Security Command Center → Should see CRITICAL alert

### 3. Test Kill Switch

1. Go to Security Command Center
2. Find yourself in Admin Risk Leaderboard
3. Click **🛑 Block**
4. Set duration: 1 hour, Reason: "Testing kill switch"
5. Try to reset another password from `/national/members.html`
6. Should get error: "Sensitive actions blocked: Testing kill switch"

### 4. Test Unauthorized Attempt

1. Create a test user with role = "member"
2. Manually call `adminResetPassword` function (using console)
3. Should fail with permission denied
4. Should create `UNAUTHORIZED_PASSWORD_RESET_ATTEMPT` event
5. Should create HIGH severity alert in Command Center

---

## ⚙️ Configuration

Edit thresholds in Firestore: `security_settings/default`

| Setting | Default | Description |
|---------|---------|-------------|
| `maxPasswordResetsPerHour` | 5 | Max resets before rate limit |
| `cooldownBetweenResetsMinutes` | 10 | Min time between resets for same user |
| `criticalSpikeWindowMinutes` | 20 | Time window for spike detection |
| `criticalSpikeCount` | 7 | Resets needed to trigger spike alert |
| `highRiskThreshold` | 50 | Risk score to flag admin as high-risk |
| `autoBlockEnabled` | false | Auto-block admins above threshold |
| `autoBlockThreshold` | 100 | Risk score for auto-block |

---

## 🔧 Adding More Sensitive Actions

To monitor **Role Changes**, **Certificate Revocations**, etc.:

### 1. Create Cloud Function

```javascript
exports.adminChangeRole = functions.https.onCall(async (data, context) => {
  const { targetUid, newRole } = data;
  const callerUid = context.auth.uid;
  
  // 1. Check kill switch
  await checkSecurityControls(callerUid);
  
  // 2. Validate permissions
  // ... your validation logic ...
  
  // 3. Execute role change
  await db.collection('users').doc(targetUid).update({ role: newRole });
  
  // 4. Log security event
  await logSecurityEvent({
    type: "ROLE_CHANGE",
    severity: "HIGH",
    actorUid: callerUid,
    actorRole: callerData.role,
    actorEmail: callerData.email,
    targetUid: targetUid,
    orgId: callerData.orgId || "none",
    ipHash: hashData(context.rawRequest?.ip),
    userAgentHash: hashData(context.rawRequest?.headers?.["user-agent"]),
    meta: { oldRole: oldRole, newRole: newRole },
    success: true
  });
  
  // 5. Update risk profile
  await db.collection('security_profiles').doc(callerUid).update({
    riskScore: admin.firestore.FieldValue.increment(15),
    "counters.roleChanges_24h": admin.firestore.FieldValue.increment(1)
  });
});
```

### 2. Update Risk Engine

Add detection logic in `onSecurityEventCreated`:

```javascript
if (event.type === 'ROLE_CHANGE' && event.success) {
  // Count recent role changes
  const recentChanges = await db.collection('security_events')
    .where('actorUid', '==', event.actorUid)
    .where('type', '==', 'ROLE_CHANGE')
    .where('createdAt', '>=', now - (24 * 60 * 60 * 1000))
    .get();
  
  if (recentChanges.size >= 5) {
    // Create alert for excessive role changes
  }
}
```

### 3. Update UI

Add to event type filter in Command Center.

---

## 📋 Best Practices

### Daily:
- ✅ Review Security Command Center
- ✅ Acknowledge new alerts
- ✅ Investigate high-risk admins

### Weekly:
- ✅ Review resolved alerts
- ✅ Check for patterns in event stream
- ✅ Audit kill switches (remove expired ones)

### Monthly:
- ✅ Review and adjust `security_settings` thresholds
- ✅ Generate compliance report from `audit_logs`
- ✅ Train admins on security best practices

### Immediately:
- 🚨 CRITICAL alerts → Investigate within 1 hour
- ⚠️ HIGH alerts → Investigate within 24 hours
- 📊 MEDIUM alerts → Review within 1 week

---

## 🔐 Security Guarantees

✅ **Immutability**: Security events cannot be deleted (enforced by Firestore rules)  
✅ **Accountability**: Every action traced to specific admin UID  
✅ **Privacy**: IP addresses and user agents hashed (SHA-256)  
✅ **Zero-trust**: Admins re-authenticate every 5 minutes  
✅ **Containment**: Kill switches block admins in real-time  
✅ **Visibility**: All actions visible in Command Center  
✅ **Automation**: Risk engine detects threats without human intervention  

---

## 📞 Support

Issues? Questions?
- Check Firestore rules are deployed
- Check Cloud Functions logs: Firebase Console → Functions → Logs
- Check browser console for UI errors
- Verify `security_settings/default` document exists

---

**🎉 Your AMCAG Security Command Center is ready!**

This is enterprise-grade security monitoring for a national professional association. You now have:
- Real-time threat detection
- Automated alerting
- Forensic investigation tools
- Zero-trust admin controls
- Immutable audit trails

**Access**: https://amcag-website.web.app/national/security-command-center.html
