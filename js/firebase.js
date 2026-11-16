// ================================================================
// AMCAG NATIONAL DIGITAL GOVERNANCE ECOSYSTEM
// Firebase Configuration & Initialization Module
// ================================================================

// ===== FIREBASE CONFIGURATION =====
const runtimeHostname = window.location.hostname;
const runtimeAuthDomain = runtimeHostname === "amcag-af624.web.app" ||
  runtimeHostname === "amcag-af624.firebaseapp.com"
  ? runtimeHostname
  : "amcag-af624.firebaseapp.com";

const firebaseConfig = {
  apiKey: "AIzaSyDArX-BdyqmTaLV0GRn8mAJ6jMlPN_12LI",
  authDomain: runtimeAuthDomain,
  databaseURL: "https://amcag-af624-default-rtdb.firebaseio.com",
  projectId: "amcag-af624",
  storageBucket: "amcag-af624.firebasestorage.app",
  messagingSenderId: "772149261606",
  appId: "1:772149261606:web:b3b805d94ab018da643de7",
  measurementId: "G-338RLN6NYC"
};

// ✅ NAVIGATION PATCH START
const AMCAG_ROUTES = Object.freeze({
  PUBLIC_HOME: '/',
  LOGIN: '/membership.html',
  VIEW_SITE: '/?preview=admin',
  MEMBER_VIEW_SITE: '/?preview=member',
  ADMIN_DASHBOARD: '/national/dashboard.html',
  ADMIN_PROGRAMS: '/national/events.html',
  ADMIN_MEDIA_UPLOAD: '/national/media-upload.html',
  // Media upload page also manages recent gallery/video uploads; no separate media manager page exists yet.
  ADMIN_MEDIA_MANAGER: '/national/media-upload.html',
  ADMIN_SITE_CONTENT: '/national/news-management.html',
  ADMIN_USERS: '/national/members.html',
  REGIONAL_DASHBOARD: '/region-dashboard/index.html',
  REGIONAL_PROGRAMS: '/region-dashboard/meetings.html',
  REGIONAL_MEDIA_UPLOAD: '/region-dashboard/media-upload.html',
  MEMBER_DASHBOARD: '/member-dashboard.html',
  MEMBER_ACCOUNT: '/profile.html',
  LOGOUT_REDIRECT: '/membership.html'
});

window.AMCAG_ROUTES = AMCAG_ROUTES;
// ✅ NAVIGATION PATCH END

// ===== INITIALIZE FIREBASE =====
let app;
let auth;
let db;
let storage;
let analytics;
let functions;
let firebaseReadyPromise;
let firebaseReadyResolve;
let authPersistenceConfigured = false;
const firebaseCacheVersion = '2026-05-30-listener-cache-reset';

function isIndexedDbAbortError(error) {
  const name = String(error?.name || '');
  const message = String(error?.message || error || '');
  const stack = String(error?.stack || '');
  return name === 'AbortError' ||
    (message.toLowerCase().includes('transaction was aborted') && stack.toLowerCase().includes('indexed'));
}

function installFirebaseStorageErrorGuard() {
  if (window.__amcagFirebaseStorageErrorGuardInstalled) return;
  window.__amcagFirebaseStorageErrorGuardInstalled = true;

  window.addEventListener('unhandledrejection', (event) => {
    if (!isIndexedDbAbortError(event.reason)) return;
    console.warn('Ignored transient Firebase IndexedDB abort. The app will retry storage reads automatically.');
    event.preventDefault();
  });

  window.addEventListener('error', (event) => {
    if (!isIndexedDbAbortError(event.error)) return;
    console.warn('Ignored transient Firebase IndexedDB abort. The app will retry storage reads automatically.');
    event.preventDefault();
  });
}

function clearStaleClientCaches() {
  if (window.__amcagClientCacheCleanupStarted) return;
  window.__amcagClientCacheCleanupStarted = true;

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations()
      .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
      .catch((error) => console.warn('Service worker cleanup failed:', error));
  }
}

function clearFirestorePersistenceIfStale(firestoreInstance) {
  if (!firestoreInstance || typeof firestoreInstance.clearPersistence !== 'function') {
    return Promise.resolve(false);
  }

  try {
    if (localStorage.getItem('amcagFirebaseCacheVersion') === firebaseCacheVersion) {
      return Promise.resolve(false);
    }

    return firestoreInstance.clearPersistence()
      .then(() => {
        localStorage.setItem('amcagFirebaseCacheVersion', firebaseCacheVersion);
        console.info('Cleared stale Firestore persistence cache.');
        return true;
      })
      .catch((error) => {
        localStorage.setItem('amcagFirebaseCacheVersion', firebaseCacheVersion);
        console.warn('Firestore persistence cache cleanup skipped:', error);
        return false;
      });
  } catch (error) {
    console.warn('Firestore persistence cache cleanup unavailable:', error);
    return Promise.resolve(false);
  }
}

function configureAuthPersistence(authInstance) {
  if (authPersistenceConfigured || !authInstance || !firebase?.auth?.Auth?.Persistence) {
    if (!authPersistenceConfigured) {
      console.warn('Auth persistence API unavailable.');
    }
    return;
  }
  authPersistenceConfigured = true;

  authInstance.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch((error) => {
    if (!isIndexedDbAbortError(error)) {
      console.warn('Firebase local auth persistence unavailable, falling back to session persistence:', error);
    }

    return authInstance.setPersistence(firebase.auth.Auth.Persistence.SESSION).catch((sessionError) => {
      console.warn('Firebase session auth persistence unavailable, continuing with default persistence:', sessionError);
    });
  });
}

function markFirebaseReady(isReady) {
  if (firebaseReadyResolve) {
    firebaseReadyResolve(isReady);
    firebaseReadyResolve = null;
  }
}

function initializeFirebase() {
  try {
    // Check if Firebase SDK is loaded
    if (typeof firebase === 'undefined') {
      console.error('Firebase SDK not loaded. Make sure Firebase scripts are included before this file.');
      return false;
    }
    
    if (!firebase.apps || !firebase.apps.length) {
      app = firebase.initializeApp(firebaseConfig);
    } else {
      console.log('Firebase already initialized');
      app = firebase.apps[0];
    }
    
    // Initialize Firebase Services (only if loaded)
    if (typeof firebase.auth === 'function') {
      auth = firebase.auth();
      configureAuthPersistence(auth);
    }
    
    if (typeof firebase.firestore === 'function') {
      db = firebase.firestore();
      clearFirestorePersistenceIfStale(db);
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
    markFirebaseReady(true);
    return true;
  } catch (error) {
    console.error('Firebase initialization error:', error.message || error);
    markFirebaseReady(false);
    return false;
  }
}

function whenReady(timeoutMs = 12000) {
  if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length > 0) {
    return Promise.resolve(true);
  }

  if (!firebaseReadyPromise) {
    firebaseReadyPromise = new Promise((resolve) => {
      firebaseReadyResolve = resolve;
    });
  }

  return Promise.race([
    firebaseReadyPromise,
    new Promise((resolve) => setTimeout(() => resolve(false), timeoutMs))
  ]);
}

function requireFirestoreDb() {
  if (!db || typeof db.collection !== 'function') {
    throw new Error('Firestore is not initialized yet.');
  }
  return db;
}

function requireStorage() {
  if (!storage || typeof storage.ref !== 'function') {
    throw new Error('Firebase Storage is not initialized yet.');
  }
  return storage;
}

// ===== FIRESTORE COLLECTION REFERENCES =====
const collections = {
  users: () => requireFirestoreDb().collection('users'),
  members: () => requireFirestoreDb().collection('members'),
  regions: () => requireFirestoreDb().collection('regions'),
  leadership: () => requireFirestoreDb().collection('leadership'),
  events: () => requireFirestoreDb().collection('events'),
  payments: () => requireFirestoreDb().collection('payments'),
  dues: () => requireFirestoreDb().collection('dues'),
  contributions: () => requireFirestoreDb().collection('contributions'),
  media: () => requireFirestoreDb().collection('media'),
  certificates: () => requireFirestoreDb().collection('certificates'),
  agmRegistrations: () => requireFirestoreDb().collection('agmRegistrations'),
  announcements: () => requireFirestoreDb().collection('announcements'),
  news: () => requireFirestoreDb().collection('news'),
  gallery: () => requireFirestoreDb().collection('gallery'),
  videos: () => requireFirestoreDb().collection('videos')
};

// ===== STORAGE REFERENCES =====
const storageRefs = {
  photos: () => requireStorage().ref('media/photos'),
  videos: () => requireStorage().ref('media/videos'),
  documents: () => requireStorage().ref('documents'),
  certificates: () => requireStorage().ref('certificates'),
  profiles: () => requireStorage().ref('profiles')
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
  initializeFirebase,
  whenReady
};

function bootFirebase(retries = 20) {
  if (typeof firebase === 'undefined') {
    if (retries > 0) {
      setTimeout(() => bootFirebase(retries - 1), 50);
    } else {
      console.error('Firebase SDK not available after retries.');
      markFirebaseReady(false);
    }
    return;
  }

  initializeFirebase();
}

// Auto-initialize immediately. Firebase setup has no DOM dependency.
installFirebaseStorageErrorGuard();
clearStaleClientCaches();
bootFirebase();

// Retry once DOM is ready as a safety net for slow script loading.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => bootFirebase(5));
}
