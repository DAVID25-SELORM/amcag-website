# 🚀 Security Command Center Deployment Checklist

## ✅ Pre-Deployment (DO THIS FIRST!)

### 1. Create security_settings Document in Firestore

**Go to**: https://console.firebase.google.com/project/amcag-website/firestore/data

**Steps**:
1. Click "Start collection" (if first collection)
2. **Collection ID**: `security_settings`
3. Click "Next"
4. **Document ID**: `default`
5. Add these fields **EXACTLY** (case-sensitive):

| Field Name | Type | Value |
|-----------|------|-------|
| `maxPasswordResetsPerHour` | number | 5 |
| `cooldownBetweenResetsMinutes` | number | 10 |
| `criticalSpikeWindowMinutes` | number | 20 |
| `criticalSpikeCount` | number | 7 |
| `highRiskThreshold` | number | 50 |
| `autoBlockEnabled` | boolean | false |
| `autoBlockThreshold` | number | 100 |
| `notifyOnCritical` | boolean | true |
| `notifyOnHigh` | boolean | true |
| `enableRealTimeMonitoring` | boolean | true |

6. Click "Save"

---

## 🔥 Deployment Commands

Open PowerShell in `C:\Users\RealTimeIT\Desktop\AMCAGWEB` and run:

### Deploy Everything at Once (Recommended)
```powershell
firebase deploy
```

### Or Deploy Step-by-Step

#### Step 1: Deploy Cloud Functions
```powershell
firebase deploy --only functions
```

**Wait for**: ✅ Functions deployed successfully

**Functions being deployed**:
- ✅ `adminResetPassword` (enhanced with security events)
- ✅ `onSecurityEventCreated` (risk engine)
- ✅ `resetHourlyCounters` (cleanup)
- ✅ `resetDailyCounters` (cleanup)

#### Step 2: Deploy Firestore Rules
```powershell
firebase deploy --only firestore:rules
```

**Wait for**: ✅ Rules updated successfully

#### Step 3: Deploy Hosting
```powershell
firebase deploy --only hosting
```

**Wait for**: ✅ Hosting deployed successfully

---

## 🧪 Post-Deployment Testing

### Test 1: Access Security Command Center

1. Open browser: https://amcag-website.web.app/national/security-command-center.html
2. Login with super_admin account
3. You should see:
   - ✅ Overview cards (all showing 0 or -)
   - ✅ Security Alerts section (no alerts)
   - ✅ Live Event Stream (no events)
   - ✅ Admin Risk Leaderboard (no profiles)

### Test 2: Generate Security Event

1. Go to: https://amcag-website.web.app/national/members.html
2. Find any user
3. Click "Reset Password"
4. Re-authenticate (enter your password)
5. Generate temporary password
6. Click "Reset Password"
7. **Expected**: Success message

**Verify**:
- Go to Firebase Console → Firestore → `security_events`
- Should have 1 new document with:
  - `type: "PASSWORD_RESET"`
  - `severity: "HIGH"`
  - `actorUid: YOUR_UID`
  - `success: true`

### Test 3: Check Risk Profile

**Verify**:
- Go to Firebase Console → Firestore → `security_profiles`
- Should have 1 new document (your UID)
- Should show:
  - `riskScore: 10`
  - `counters.passwordResets_1h: 1`

### Test 4: Trigger Spike Alert

1. Reset 7 different users' passwords within 20 minutes
2. After the 7th reset, check:
   - Firebase Console → Firestore → `security_alerts`
   - Should have 1 alert with:
     - `severity: "CRITICAL"`
     - `signalType: "RATE_SPIKE"`
     - `status: "OPEN"`
3. Check Firebase Console → Firestore → `notifications`
   - All super_admin users should have a notification
4. Refresh Security Command Center
   - Should show alert in Security Alerts section
   - "Open Alerts" card should show 1

### Test 5: Kill Switch

1. In Security Command Center → Admin Risk Leaderboard
2. Find your name (should have highest risk score)
3. Click "🛑 Block"
4. Enter reason: "Testing kill switch"
5. Select duration: "1 hour"
6. Click "🛑 Block Sensitive Actions"
7. **Expected**: Success alert
8. Try to reset another password from `/national/members.html`
9. **Expected**: Error: "Sensitive actions blocked: Testing kill switch"
10. Wait 1 hour (or manually delete the kill switch doc)
11. Try again → Should work

---

## 🎯 What You Should See

### Firestore Collections (Auto-Created)

After testing, these collections should exist:

- ✅ `security_settings` (1 doc: default)
- ✅ `security_events` (7+ docs from your tests)
- ✅ `security_alerts` (1+ docs: spike alert)
- ✅ `security_profiles` (1 doc: your admin profile)
- ✅ `security_controls` (0-1: kill switch if you tested it)
- ✅ `notifications` (1+ docs: alert notifications)
- ✅ `audit_logs` (7+ docs: legacy audit trail)
- ✅ `admin_security` (1 doc: your rate limit data)

### Security Command Center UI

**URL**: https://amcagwebsite.web.app/national/security-command-center.html

**Visible to**: super_admin only

**Sections**:
1. ✅ **Header** with pulsing red dot
2. ✅ **Overview Cards** with real counts
3. ✅ **Security Alerts** with CRITICAL spike alert
4. ✅ **Live Event Stream** with 7 PASSWORD_RESET events
5. ✅ **Admin Risk Leaderboard** with your profile (risk score 70)

---

## 🐛 Troubleshooting

### Error: "Failed to load dashboard"
- **Check**: Browser console (F12) for errors
- **Fix**: Verify Firebase config in `/js/firebase.js`

### Error: "Access denied"
- **Check**: Your user document in Firestore
- **Fix**: Ensure `role: "super_admin"`

### No alerts appearing
- **Check**: Firebase Functions logs
- **Fix**: Verify `onSecurityEventCreated` deployed successfully
  ```powershell
  firebase functions:log
  ```

### Events not being created
- **Check**: `adminResetPassword` function logs
- **Fix**: Check for JavaScript errors in function code
  ```powershell
  firebase functions:log --only adminResetPassword
  ```

### Kill switch not working
- **Check**: Firestore rules
- **Fix**: Re-deploy rules:
  ```powershell
  firebase deploy --only firestore:rules
  ```

### "security_settings not found" error
- **Check**: Firestore → `security_settings` collection exists
- **Fix**: Create the document manually (see step 1 above)

---

## 🔧 Configuration (After Deployment)

Want to change thresholds?

**Go to**: Firebase Console → Firestore → `security_settings/default`

**Edit any field**:
- `criticalSpikeCount`: Change from 7 to 5 for more sensitive spike detection
- `highRiskThreshold`: Change from 50 to 30 to flag admins sooner
- `autoBlockEnabled`: Change to `true` to auto-block high-risk admins
- etc.

**No redeployment needed** - changes take effect immediately!

---

## 📊 Next Steps

After deployment is successful:

1. ✅ Train all super_admin users on Security Command Center
2. ✅ Set up daily review schedule (check Command Center every morning)
3. ✅ Configure alert thresholds based on your organization's needs
4. ✅ Add more sensitive actions to monitor (role changes, cert revokes, etc.)
5. ✅ Export audit logs monthly for compliance

---

## 🎉 Success Indicators

Your Security Command Center is working if:

✅ You can access `/national/security-command-center.html`  
✅ Password resets create security events  
✅ Spike detection creates critical alerts  
✅ Risk profiles update in real-time  
✅ Kill switches block admins immediately  
✅ Investigation modal shows event timelines  
✅ Real-time listeners update the dashboard live  

---

**Ready to deploy?** Run:

```powershell
firebase deploy
```

**Estimated deployment time**: 2-3 minutes

**Questions?** Check `SECURITY_COMMAND_CENTER_GUIDE.md` for details.
