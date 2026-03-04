# 🔥 FIREBASE SETUP GUIDE
## AMCAG National Digital Governance Ecosystem

---

## STEP 1: CREATE FIREBASE PROJECT

1. **Go to Firebase Console**
   - Visit: https://console.firebase.google.com/
   - Sign in with Google account

2. **Create New Project**
   - Click "Add project"
   - Project name: `AMCAG-Ghana` or `AMCAG-National-Platform`
   - Accept terms and click Continue

3. **Google Analytics (Optional)**
   - Enable Google Analytics if you want usage tracking
   - Choose or create Analytics account
   - Click "Create project"

---

## STEP 2: ENABLE AUTHENTICATION

1. **Navigate to Authentication**
   - In left sidebar, click "Build" → "Authentication"
   - Click "Get started"

2. **Enable Email/Password**
   - Click "Sign-in method" tab
   - Click "Email/Password"
   - Toggle "Enable"
   - Click "Save"

3. **Optional: Enable Additional Providers**
   - Google Sign-In (recommended for Ghana)
   - Facebook Sign-In
   - Phone Authentication

---

## STEP 3: CREATE FIRESTORE DATABASE

1. **Navigate to Firestore Database**
   - Left sidebar → "Build" → "Firestore Database"
   - Click "Create database"

2. **Choose Mode**
   - Select "Start in **production mode**"
   - Click "Next"

3. **Choose Location**
   - Recommended: `eur3 (europe-west)` (closest to Ghana)
   - Alternative: `us-central` or `asia-southeast1`
   - Click "Enable"

4. **Wait for provisioning** (30-60 seconds)

---

## STEP 4: CREATE FIRESTORE COLLECTIONS

### Create Collections Manually

1. In Firestore, click "Start collection"
2. Create each collection:

```
Collection ID: users
First document ID: (auto-generate)
Fields:
  - uid: string
  - email: string
  - role: string (value: "member")
  - fullName: string
  - createdAt: timestamp
```

### Required Collections

Create these collections (can be empty initially):
- ✅ `users`
- ✅ `members`
- ✅ `regions`
- ✅ `events`
- ✅ `payments`
- ✅ `certificates`
- ✅ `news`
- ✅ `announcements`
- ✅ `gallery`
- ✅ `videos`
- ✅ `leadership`

---

## STEP 5: CONFIGURE SECURITY RULES

### Firestore Rules

1. Go to "Firestore Database" → "Rules" tab
2. Replace default rules with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper function to check user role
    function isRole(role) {
      return request.auth != null && 
             get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == role;
    }
    
    function hasAnyRole(roles) {
      return request.auth != null && 
             get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in roles;
    }
    
    // Users collection
    match /users/{userId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update: if request.auth.uid == userId || hasAnyRole(['super_admin', 'national_executive']);
      allow delete: if hasAnyRole(['super_admin']);
    }
    
    // Members collection
    match /members/{memberId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update: if hasAnyRole(['super_admin', 'national_executive', 'regional_executive']);
      allow delete: if hasAnyRole(['super_admin', 'national_executive']);
    }
    
    // Regions collection
    match /regions/{regionId} {
      allow read: if true; // Public read
      allow write: if hasAnyRole(['super_admin', 'national_executive']);
    }
    
    // Events collection
    match /events/{eventId} {
      allow read: if true; // Public read
      allow create: if request.auth != null;
      allow update, delete: if hasAnyRole(['super_admin', 'national_executive', 'regional_executive']);
    }
    
    // Payments collection
    match /payments/{paymentId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update: if hasAnyRole(['super_admin', 'national_executive']);
    }
    
    // Certificates collection (public read for verification)
    match /certificates/{certId} {
      allow read: if true; // Public verification
      allow write: if hasAnyRole(['super_admin', 'national_executive']);
    }
    
    // News and announcements (public read)
    match /news/{newsId} {
      allow read: if true;
      allow write: if hasAnyRole(['super_admin', 'national_executive']);
    }
    
    match /announcements/{announcementId} {
      allow read: if true;
      allow write: if hasAnyRole(['super_admin', 'national_executive']);
    }
    
    // Gallery and videos (public read)
    match /gallery/{photoId} {
      allow read: if true;
      allow write: if hasAnyRole(['super_admin', 'national_executive', 'regional_executive']);
    }
    
    match /videos/{videoId} {
      allow read: if true;
      allow write: if hasAnyRole(['super_admin', 'national_executive', 'regional_executive']);
    }
    
    // Leadership (public read)
    match /leadership/{leaderId} {
      allow read: if true;
      allow write: if hasAnyRole(['super_admin', 'national_executive']);
    }
  }
}
```

3. Click "Publish"

---

## STEP 6: SETUP STORAGE

1. **Navigate to Storage**
   - Left sidebar → "Build" → "Storage"
   - Click "Get started"

2. **Security Rules**
   - Start in production mode
   - Click "Next"

3. **Location**
   - Choose same location as Firestore
   - Click "Done"

4. **Update Storage Rules**

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    
    // Media uploads (authenticated users)
    match /media/{allPaths=**} {
      allow read: if true; // Public read
      allow write: if request.auth != null && 
                      request.resource.size < 10 * 1024 * 1024; // 10MB limit
    }
    
    // Profile pictures
    match /profiles/{userId}/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth.uid == userId ||
                      request.auth.token.role in ['super_admin', 'national_executive'];
    }
    
    // Certificates (restricted write)
    match /certificates/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth.token.role in ['super_admin', 'national_executive'];
    }
    
    // Documents (authenticated read)
    match /documents/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth.token.role in ['super_admin', 'national_executive'];
    }
  }
}
```

---

## STEP 7: GET FIREBASE CONFIG

1. **Project Settings**
   - Click gear icon (⚙️) → "Project settings"
   
2. **Your Apps**
   - Scroll to "Your apps"
   - Click web icon `</>`
   - App nickname: "AMCAG Web"
   - Check "Also set up Firebase Hosting"
   - Click "Register app"

3. **Copy Configuration**
   - Copy the `firebaseConfig` object

4. **Update `/js/firebase.js`**

```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",              // ← Your API key
  authDomain: "amcag-ghana.firebaseapp.com",
  projectId: "amcag-ghana",
  storageBucket: "amcag-ghana.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456:web:abc123",
  measurementId: "G-ABC123"
};
```

---

## STEP 8: SETUP HOSTING

### Install Firebase CLI

```bash
npm install -g firebase-tools
```

### Login to Firebase

```bash
firebase login
```

### Initialize Project

```bash
cd /path/to/AMCAGWEB
firebase init hosting
```

**Configuration Prompts:**
- Use existing project: YES
- Select: `amcag-ghana`
- Public directory: `.` (current directory)
- Single-page app: NO
- Set up automatic builds: NO
- Overwrite index.html: NO

### Deploy

```bash
firebase deploy --only hosting
```

---

## STEP 9: SEED INITIAL DATA

### Create Super Admin User

1. **Via Firebase Console:**
   - Authentication → Users → "Add user"
   - Email: `admin@amcag.org.gh`
   - Password: (set secure password)
   - Click "Add user"

2. **Set Role in Firestore:**
   - Firestore Database → `users` collection
   - Add document with user's UID
   - Fields:
     ```
     uid: (user's UID)
     email: admin@amcag.org.gh
     role: super_admin
     fullName: System Administrator
     createdAt: (current timestamp)
     ```

### Create Regions Collection

Add documents to `regions` collection:

```javascript
// Document ID: greater-accra
{
  name: "Greater Accra",
  code: "GAR",
  memberCount: 0,
  createdAt: (timestamp)
}

// Document ID: ashanti
{
  name: "Ashanti",
  code: "ASH",
  memberCount: 0,
  createdAt: (timestamp)
}

// Repeat for all 16 regions...
```

### Ghana Regions List

1. Greater Accra
2. Ashanti
3. Central
4. Eastern
5. Northern
6. Upper East
7. Upper West
8. Volta
9. Western
10. Western North
11. Bono
12. Bono East
13. Ahafo
14. Oti
15. Savannah
16. North East

---

## STEP 10: TESTING

### Test Authentication
1. Go to `/membership.html`
2. Register new account
3. Check user appears in Authentication
4. Check user document created in Firestore

### Test Certificate Verification
1. Manually create test certificate in Firestore
2. Go to `/certificate-verify.html`
3. Enter certificate ID
4. Verify validation works

### Test Dashboards
1. Sign in as super_admin → should redirect to `/national/dashboard.html`
2. Create regional_executive user → should redirect to `/region-dashboard/`
3. Create member user → should redirect to `/member-dashboard.html`

---

## ADDITIONAL CONFIGURATIONS

### Custom Domain

1. **Hosting → Add custom domain**
2. Enter: `www.amcag.org.gh`
3. Follow DNS verification steps
4. Update DNS with provider (GoDaddy, Namecheap, etc.)

### Email Templates

1. **Authentication → Templates**
2. Customize:
   - Email verification
   - Password reset
   - Email address change

### Usage Quotas

**Free tier limits (Spark Plan):**
- Authentication: 10,000/month
- Firestore: 50,000 reads/month
- Storage: 5GB

Consider upgrading to **Blaze (Pay-as-you-go)** for production.

---

## TROUBLESHOOTING

### "Permission Denied" Errors
- Check Firestore security rules
- Verify user has correct role in `users` collection
- Check user is authenticated

### Authentication Issues
- Verify email/password is enabled
- Check for email verification requirement
- Clear browser cache and cookies

### Deployment Fails
- Run `firebase login` again
- Check `.firebaserc` project ID matches
- Verify `firebase.json` is correct

---

## PRODUCTION CHECKLIST

- [ ] Firebase project created
- [ ] Authentication enabled
- [ ] Firestore database created
- [ ] Security rules deployed
- [ ] Storage configured
- [ ] Super admin user created
- [ ] Regions seeded
- [ ] Firebase config updated in code
- [ ] Test user flows
- [ ] Deploy to Firebase Hosting
- [ ] Custom domain configured
- [ ] Email templates customized
- [ ] Analytics enabled (optional)
- [ ] Backup strategy in place

---

## SUPPORT

**Firebase Documentation:** https://firebase.google.com/docs  
**Firebase Console:** https://console.firebase.google.com/

---

**Setup Complete! 🎉**  
Your AMCAG platform is now ready for production use.
