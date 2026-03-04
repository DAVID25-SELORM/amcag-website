# AMCAG NATIONAL DIGITAL GOVERNANCE ECOSYSTEM

**Association of Medicine Counter Assistants of Ghana**  
**Complete National Professional Platform**

---

## 🎯 PROJECT OVERVIEW

This is a complete, production-ready national-level digital governance platform for AMCAG, designed as a comprehensive professional association management system comparable to WHO, UN professional organizations, and government-grade portals.

### Platform Type
- ✅ National professional association portal
- ✅ Membership management system
- ✅ Governance platform with role-based access
- ✅ Financial management system
- ✅ Digital certificate authority
- ✅ Media & communications hub

---

## 🏗️ ARCHITECTURE

### **Four Governance Layers**

1. **Public Trust Layer** - Open access to public
2. **Member Operations Layer** - For registered members
3. **Regional Governance Layer** - For regional executives
4. **National Governance Layer** - For national executives

### **Role Hierarchy**

```
SUPER ADMIN
    ↓
NATIONAL EXECUTIVES
    ↓
REGIONAL EXECUTIVES
    ↓
MEMBERS
    ↓
PUBLIC
```

---

## 💻 TECH STACK

### Frontend
- **HTML5** - Semantic, accessible markup
- **CSS** - Material You design system
- **Vanilla JavaScript** - Modular ES5+ architecture

### Backend
- **Firebase Authentication** - User auth & management
- **Cloud Firestore** - NoSQL database
- **Firebase Storage** - File & media storage
- **Firebase Hosting** - Static site hosting
- **Firebase Analytics** - Usage tracking

---

## 📁 PROJECT STRUCTURE

```
AMCAGWEB/
├── index.html                  # Homepage with role gateways
├── about.html                  # About AMCAG
├── leadership.html             # Leadership profiles
├── events.html                 # Events listing
├── news.html                   # News & announcements
├── gallery.html                # Photo gallery
├── videos.html                 # Video gallery
├── regions.html                # Regional chapters
├── region.html                 # Single region view
├── certificate-verify.html     # Public certificate verification
├── contact.html                # Contact form
├── membership.html             # Login/Registration portal
├── member-dashboard.html       # Member dashboard
├── dues.html                   # Dues management
├── payments.html               # Payment history
├── contributions.html          # Contributions
├── profile.html                # Member profile
├── certificates.html           # Member certificates
│
├── region-dashboard/           # Regional Executive Portal
│   ├── index.html             # Regional dashboard
│   ├── members.html           # Regional members
│   ├── events.html            # Regional events
│   ├── payments.html          # Regional payments
│   └── media.html             # Regional media
│
├── national/                   # National Executive Portal
│   ├── dashboard.html         # National dashboard
│   ├── members.html           # All members
│   ├── regions.html           # All regions
│   ├── payments.html          # All payments
│   ├── certificates.html      # Certificate management
│   ├── events.html            # National events
│   ├── analytics.html         # Analytics & reports
│   └── leadership.html        # Leadership management
│
├── css/
│   ├── material-you.css       # Design system tokens
│   └── main.css               # Component library
│
└── js/
    ├── firebase.js            # Firebase config & init
    ├── auth.js                # Authentication module
    ├── api.js                 # Firestore API layer
    ├── router.js              # Role-based routing
    └── ui.js                  # UI utilities
```

---

## 🔐 ROLE-BASED ACCESS CONTROL

### Roles

| Role | Access Level | Permissions |
|------|-------------|-------------|
| `public` | Public pages only | View public content |
| `member` | Member portal | Dashboard, certificates, payments |
| `regional_executive` | Regional dashboard | Manage regional members, events |
| `national_executive` | National dashboard | Full oversight, analytics |
| `super_admin` | All systems | Complete control |

### Route Protection

Routes are automatically protected based on role:

```javascript
// Public routes - no auth required
/index.html, /about.html, /events.html, etc.

// Member routes - requires 'member' role
/member-dashboard.html, /dues.html, etc.

// Regional routes - requires 'regional_executive' role
/region-dashboard/**

// National routes - requires 'national_executive' role
/national/**
```

---

## ⚙️ FIREBASE SETUP

### 1. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create new project: **"AMCAG Ghana"**
3. Enable Google Analytics (optional)

### 2. Enable Authentication

1. Navigate to **Authentication** → **Sign-in method**
2. Enable **Email/Password**
3. (Optional) Enable additional providers

### 3. Create Firestore Database

1. Navigate to **Firestore Database**
2. Create database in **production mode**
3. Choose location: **eur3 (Europe)** or nearest to Ghana

### 4. Set Up Storage

1. Navigate to **Storage**
2. Get started with default security rules
3. Update rules later for production

### 5. Configure Hosting

```bash
npm install -g firebase-tools
firebase login
firebase init hosting
```

### 6. Update Firebase Config

Edit `/js/firebase.js`:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
  measurementId: "YOUR_MEASUREMENT_ID"
};
```

---

## 📊 FIRESTORE COLLECTIONS

### Collection Structure

```javascript
users/              // User accounts
  {uid}/
    - uid
    - email
    - role
    - fullName
    - phone
    - region
    - status
    - registrationDate
    - createdAt
    - updatedAt

members/            // Member profiles
  {memberId}/
    - fullName
    - email
    - region
    - status
    - createdAt

regions/            // Regional chapters
  {regionId}/
    - name
    - code
    - description
    - executives[]
    - memberCount

events/             // Events
  {eventId}/
    - title
    - description
    - eventDate
    - location
    - region
    - type
    - createdAt

payments/           // Payment records
  {paymentId}/
    - memberId
    - type
    - amount
    - status
    - reference
    - method
    - createdAt

certificates/       // Certificates
  {certificateId}/
    - memberId
    - memberName
    - type
    - issueDate
    - status
    - createdAt

news/               // News articles
  {newsId}/
    - title
    - content
    - publishDate
    - author

announcements/      // Announcements
  {announcementId}/
    - title
    - message
    - priority
    - publishDate

gallery/            // Photo gallery
  {photoId}/
    - title
    - url
    - category
    - uploadDate

videos/             // Video gallery
  {videoId}/
    - title
    - url
    - description
    - uploadDate
```

### Security Rules Example

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users collection
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth.uid == userId || 
                      get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['super_admin', 'national_executive'];
    }
    
    // Members collection
    match /members/{memberId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update, delete: if get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['super_admin', 'national_executive', 'regional_executive'];
    }
    
    // Certificates (public read for verification)
    match /certificates/{certId} {
      allow read: if true;
      allow write: if get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['super_admin', 'national_executive'];
    }
  }
}
```

---

## 💳 PAYMENT INTEGRATION

### Paystack Integration (Ghana)

1. **Sign up** at [Paystack](https://paystack.com/)
2. Get API keys from dashboard
3. Add to environment:

```javascript
const PAYSTACK_PUBLIC_KEY = 'pk_test_...';
```

4. Example payment flow:

```javascript
// Initialize payment
const handler = PaystackPop.setup({
  key: PAYSTACK_PUBLIC_KEY,
  email: userEmail,
  amount: amount * 100, // Amount in pesewas
  currency: 'GHS',
  ref: generateReference(),
  callback: function(response) {
    // Verify payment on backend
    verifyPayment(response.reference);
  }
});
handler.openIframe();
```

---

## 🚀 DEPLOYMENT

### Deploy to Firebase Hosting

```bash
# Build (if using build process)
npm run build

# Deploy
firebase deploy --only hosting
```

### Custom Domain Setup

1. Navigate to **Hosting** → **Add custom domain**
2. Enter domain: `www.amcag.org.gh`
3. Follow DNS verification steps
4. Update DNS records with your registrar

---

## 🎨 DESIGN SYSTEM

### Color Palette

- **Primary Blue**: `#1e5bbd` - Professional authority
- **Medical Teal**: `#008585` - Healthcare trust
- **Success Green**: `#198754`
- **Warning Orange**: `#fd7e14`
- **Error Red**: `#dc3545`

### Typography

- **Display Font**: Poppins (headings)
- **Body Font**: Inter (content)
- **Scale**: 8px grid system

### Components

All components follow Material You design principles:
- Soft shadows
- 16-24px border radius
- Subtle hover states
- Clear visual hierarchy

---

## 📱 MOBILE RESPONSIVENESS

- ✅ Mobile-first CSS
- ✅ Responsive grid system
- ✅ Touch-friendly interactions
- ✅ Collapsible navigation
- ✅ Optimized images

---

## 🔒 SECURITY BEST PRACTICES

1. **Environment Variables**: Store API keys securely
2. **Firestore Rules**: Implement granular permissions
3. **Input Validation**: Client & server-side validation
4. **HTTPS Only**: Enforce SSL/TLS
5. **Rate Limiting**: Prevent abuse
6. **CORS**: Configure allowed origins

---

## 📈 ANALYTICS

### Firebase Analytics Events

```javascript
// Track important events
analytics.logEvent('user_registration', {
  region: userRegion,
  role: userRole
});

analytics.logEvent('payment_completed', {
  amount: paymentAmount,
  type: paymentType
});
```

---

## 🛠️ DEVELOPMENT

### Local Development

```bash
# Serve locally
firebase serve

# Or use any static server
python -m http.server 8000
```

### Testing

1. Create test users with different roles
2. Test role-based routing
3. Verify payment flows
4. Test certificate verification
5. Check mobile responsiveness

---

## 📞 SUPPORT

For technical support or questions:
- **Email**: tech@amcag.org.gh
- **GitHub Issues**: [Submit issue]
- **Documentation**: Internal wiki

---

## 📄 LICENSE

Copyright © 2026 Association of Medicine Counter Assistants of Ghana (AMCAG)  
All rights reserved.

---

## ✅ COMPLETION CHECKLIST

- [x] Complete folder structure
- [x] Material You CSS design system
- [x] Modular JavaScript architecture
- [x] Four governance layers
- [x] Role-based routing
- [x] Firebase integration ready
- [x] Public pages (11 pages)
- [x] Member dashboard
- [x] Regional dashboard
- [x] National dashboard
- [x] Certificate verification
- [x] Payment structure
- [x] Mobile responsive
- [x] Production-ready code

---

**Built with institutional excellence for AMCAG Ghana 🇬🇭**
