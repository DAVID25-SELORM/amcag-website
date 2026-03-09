// ================================================================
// AMCAG NATIONAL DIGITAL GOVERNANCE ECOSYSTEM
// Firebase Configuration & Initialization Module
// ================================================================

// ===== FIREBASE CONFIGURATION =====
const firebaseConfig = {
  apiKey: "AIzaSyCLQQdTlLUVT7L-DIWXhuLq1ftpW2azUZ8",
  authDomain: "amcag-website.firebaseapp.com",
  projectId: "amcag-website",
  storageBucket: "amcag-website.firebasestorage.app",
  messagingSenderId: "341720720945",
  appId: "1:341720720945:web:ef59ad086ee6e0dcc2e52f",
  measurementId: "G-25G3EVFBBF"
};

// ===== INITIALIZE FIREBASE =====
let app;
let auth;
let db;
let storage;
let analytics;
let functions;

function initializeFirebase() {
  try {
    // Check if Firebase SDK is loaded
    if (typeof firebase === 'undefined') {
      console.error('Firebase SDK not loaded. Make sure Firebase scripts are included before this file.');
      return false;
    }
    
    // Check if already initialized
    if (firebase.apps && firebase.apps.length > 0) {
      console.log('Firebase already initialized');
      app = firebase.apps[0];
      
      // Get references to already initialized services
      if (typeof firebase.auth === 'function') {
        auth = firebase.auth();
      }
      if (typeof firebase.firestore === 'function') {
        db = firebase.firestore();
      }
      if (typeof firebase.storage === 'function') {
        storage = firebase.storage();
      }
      if (typeof firebase.analytics === 'function') {
        analytics = firebase.analytics();
      }
      if (typeof firebase.functions === 'function') {
        functions = firebase.functions();
      }
      return true;
    }
    
    // Initialize Firebase App
    app = firebase.initializeApp(firebaseConfig);
    
    // Initialize Firebase Services (only if loaded)
    if (typeof firebase.auth === 'function') {
      auth = firebase.auth();
    }
    
    if (typeof firebase.firestore === 'function') {
      db = firebase.firestore();
    }
    
    if (typeof firebase.storage === 'function') {
      storage = firebase.storage();
    }
    
    // Initialize Analytics (optional)
    if (typeof firebase.analytics === 'function') {
      analytics = firebase.analytics();
    }
    
    // Initialize Functions (optional)
    if (typeof firebase.functions === 'function') {
      functions = firebase.functions();
    }
    
    console.log('Firebase initialized successfully');
    return true;
  } catch (error) {
    console.error('Firebase initialization error:', error.message || error);
    return false;
  }
}

// ===== FIRESTORE COLLECTION REFERENCES =====
const collections = {
  users: () => db.collection('users'),
  members: () => db.collection('members'),
  regions: () => db.collection('regions'),
  leadership: () => db.collection('leadership'),
  events: () => db.collection('events'),
  payments: () => db.collection('payments'),
  dues: () => db.collection('dues'),
  contributions: () => db.collection('contributions'),
  media: () => db.collection('media'),
  certificates: () => db.collection('certificates'),
  announcements: () => db.collection('announcements'),
  news: () => db.collection('news'),
  gallery: () => db.collection('gallery'),
  videos: () => db.collection('videos')
};

// ===== STORAGE REFERENCES =====
const storageRefs = {
  photos: () => storage.ref('media/photos'),
  videos: () => storage.ref('media/videos'),
  documents: () => storage.ref('documents'),
  certificates: () => storage.ref('certificates'),
  profiles: () => storage.ref('profiles')
};

// ===== TIMESTAMP UTILITIES =====
const timestamp = {
  now: () => firebase.firestore.FieldValue.serverTimestamp(),
  fromDate: (date) => firebase.firestore.Timestamp.fromDate(date),
  toDate: (timestamp) => timestamp.toDate()
};

// ===== ERROR HANDLING =====
function handleFirebaseError(error) {
  const errorMessages = {
    'auth/user-not-found': 'No user found with this email address.',
    'auth/wrong-password': 'Incorrect password. Please try again.',
    'auth/email-already-in-use': 'This email is already registered.',
    'auth/weak-password': 'Password should be at least 6 characters.',
    'auth/invalid-email': 'Invalid email address format.',
    'auth/network-request-failed': 'Network error. Please check your connection.',
    'permission-denied': 'You do not have permission to perform this action.',
    'not-found': 'The requested resource was not found.',
    'already-exists': 'This resource already exists.',
    'unauthenticated': 'You must be signed in to perform this action.'
  };
  
  return errorMessages[error.code] || error.message || 'An unexpected error occurred.';
}

// ===== EXPORT MODULE =====
window.FirebaseModule = {
  app: () => app,
  auth: () => auth,
  db: () => db,
  firestore: () => db, // Alias for backwards compatibility
  storage: () => storage,
  analytics: () => analytics,
  functions: () => functions,
  collections,
  storageRefs,
  timestamp,
  handleFirebaseError,
  initializeFirebase
};

function bootFirebase(retries = 20) {
  if (typeof firebase === 'undefined') {
    if (retries > 0) {
      setTimeout(() => bootFirebase(retries - 1), 50);
    } else {
      console.error('Firebase SDK not available after retries.');
    }
    return;
  }

  initializeFirebase();
}

// Auto-initialize immediately. Firebase setup has no DOM dependency.
bootFirebase();

// Retry once DOM is ready as a safety net for slow script loading.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => bootFirebase(5));
}
