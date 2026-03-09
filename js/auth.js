// ================================================================
// AMCAG NATIONAL DIGITAL GOVERNANCE ECOSYSTEM
// Authentication Module
// ================================================================

const AuthModule = (function() {
  'use strict';
  
  // ===== PRIVATE VARIABLES =====
  let currentUser = null;
  let authStateListeners = [];
  
  // 🛡️ ELITE AUTH GUARD - Prevents double execution and login loops
  let authBooted = false;
  let authReady = false; // 🔥 NEW: Indicates auth is fully initialized with profile loaded
  
  // ===== AUTH STATE LISTENER =====
  function initAuthListener() {
    // Check if FirebaseModule is available
    if (!window.FirebaseModule || typeof window.FirebaseModule.auth !== 'function') {
      console.error('FirebaseModule not available. Retrying in 500ms...');
      setTimeout(initAuthListener, 500);
      return;
    }
    
    const auth = window.FirebaseModule.auth();
    
    if (!auth) {
      console.error('Firebase Auth not initialized');
      return;
    }
    
    // 🛡️ ELITE AUTH GUARD - Single execution per page load
    auth.onAuthStateChanged(async (user) => {
      console.log('[AuthModule] ========== AUTH STATE CHANGED ==========');
      console.log('[AuthModule] User object:', user);
      console.log('[AuthModule] User UID:', user?.uid);
      console.log('[AuthModule] User email:', user?.email);
      console.log('[AuthModule] authBooted status:', authBooted);

      // ===== PREVENT DOUBLE EXECUTION (only on non-login pages) =====
      // CRITICAL: Don't block on membership/login pages as this prevents redirect flow
      const currentPath = window.location.pathname;
      const isLoginPage = currentPath.includes('membership') || currentPath.includes('index.html') || currentPath === '/';

      if (authBooted && !isLoginPage) {
        console.log('[AuthModule] ⚠️ Auth already processed, skipping duplicate execution');
        return;
      }

      if (!isLoginPage) {
        authBooted = true;
        console.log('[AuthModule] Setting authBooted = true (not a login page)');
      }

      if (!user) {
        // User is signed out
        console.log('[AuthModule] ❌ User is NULL - signed out');
        currentUser = null;
        authReady = true; // 🔥 Auth ready even when not logged in
        notifyAuthStateChange(null);
        console.log('[AuthModule] ========== AUTH STATE CHANGE COMPLETE ==========');
        return;
      }

      // ===== EMAIL VERIFICATION CHECK (SECURITY) =====
      if (!user.emailVerified) {
        console.log('[AuthModule] ⚠️ Email not verified - blocking access');

        // Show alert and redirect to verification page
        if (typeof UIModule !== 'undefined' && UIModule.showAlert) {
          UIModule.showAlert('Please verify your email address before accessing your dashboard. Check your inbox for the verification link.', 'warning');
        } else {
          alert('Please verify your email address. Check your inbox for the verification link.');
        }

        // Sign out and redirect to login
        setTimeout(() => {
          window.FirebaseModule.auth().signOut();
          window.location.href = '/membership.html?verified=false';
        }, 3000);
        return; // Stop execution
      }
      console.log('[AuthModule] ✅ Email verified');

      currentUser = user;
      console.log('[AuthModule] ✅ User signed in:', user.uid);

      // Fetch user profile from Firestore
      try {
        console.log('[AuthModule] Fetching user document from Firestore...');
        const userDoc = await window.FirebaseModule.collections.users()
          .doc(user.uid)
          .get();

        console.log('[AuthModule] User doc exists:', userDoc.exists);

        if (userDoc.exists) {
          currentUser.profile = userDoc.data();
          console.log('[AuthModule] ✅ Profile loaded successfully');
          console.log('[AuthModule] Profile data:', currentUser.profile);
          console.log('[AuthModule] User role:', currentUser.profile.role);
          console.log('[AuthModule] User status:', currentUser.profile.status);
          console.log('[AuthModule] Must reset password:', currentUser.profile.mustResetPassword);

          // ===== FORCE PASSWORD CHANGE CHECK (CRITICAL SECURITY) =====
          // If user has temporary password, redirect to change password page
          if (currentUser.profile.mustResetPassword === true) {
            // Don't redirect if already on change password page
            if (!currentPath.includes('change-password')) {
              console.log('[AuthModule] ⚠️ User must reset password - redirecting...');
              window.location.href = '/change-password.html';
              return; // Stop execution here
            }
          }

          // ===== FORCE PROFILE COMPLETION FOR NEW LEADERS =====
          if (currentUser.profile.mustCompleteProfile === true) {
            if (!currentPath.includes('complete-profile')) {
              console.log('[AuthModule] ⚠️ User must complete profile - redirecting...');
              window.location.href = '/complete-profile.html';
              return; // Stop execution here
            }
          }
        } else {
          // 🛡️ ELITE AUTH GUARD - No auto-logout on missing doc
          console.error('[AuthModule] ❌ User document NOT FOUND in Firestore for UID:', user.uid);
          console.error('[AuthModule] ⚠️ Auth exists but profile missing - showing error (NOT logging out)');

          // Show error to user without logging out
          if (typeof UIModule !== 'undefined' && UIModule.showAlert) {
            UIModule.showAlert('Account setup incomplete. Please contact support.', 'error');
          } else {
            alert('Account setup incomplete. Please contact support.');
          }
          return; // Stop execution but DON'T call signOut()
        }

        // Notify all listeners
        console.log('[AuthModule] Notifying', authStateListeners.length, 'auth listeners...');
        notifyAuthStateChange(currentUser);

        // 🔥 CRITICAL: Mark auth as fully ready
        authReady = true;
        console.log('[AuthModule] 🟢 Auth fully ready - profile loaded');

        // Handle role-based routing (only if user doesn't need to reset password)
        console.log('[AuthModule] Calling handleRoleBasedRedirect (currently disabled)');
        handleRoleBasedRedirect(currentUser.profile);
      } catch (error) {
        // 🛡️ ELITE AUTH GUARD - No auto-logout on Firestore errors
        console.error('[AuthModule] ❌ ERROR fetching user profile:', error);
        console.error('[AuthModule] Error code:', error.code);
        console.error('[AuthModule] Error message:', error.message);
        console.error('[AuthModule] ⚠️ Firestore error - showing error (NOT logging out)');

        // Show error without logging out
        if (typeof UIModule !== 'undefined' && UIModule.showAlert) {
          UIModule.showAlert('Unable to load profile. Please refresh the page.', 'error');
        } else {
          alert('Unable to load profile. Please refresh the page.');
        }
        return; // Stop execution but DON'T call signOut()
      }

      console.log('[AuthModule] ========== AUTH STATE CHANGE COMPLETE ==========');
    });
  }
  
  // ===== NOTIFY AUTH STATE CHANGE =====
  function notifyAuthStateChange(user) {
    authStateListeners.forEach(listener => listener(user));
  }
  
  // ===== REGISTER AUTH STATE LISTENER =====
  function onAuthStateChanged(callback) {
    authStateListeners.push(callback);
    
    // Immediately call with current state
    if (currentUser !== null) {
      callback(currentUser);
    }
  }
  
  // ===== SIGN UP WITH EMAIL/PASSWORD =====
  async function signUp(email, password, profileData, profilePictureFile = null) {
    try {
      const auth = window.FirebaseModule.auth();
      const userCredential = await auth.createUserWithEmailAndPassword(email, password);
      const user = userCredential.user;
      
      // Upload profile picture if provided
      let profilePictureUrl = '';
      if (profilePictureFile) {
        try {
          const storage = window.FirebaseModule.storage();
          const timestamp = Date.now();
          const fileName = `${user.uid}_${timestamp}.${profilePictureFile.name.split('.').pop()}`;
          const storageRef = storage.ref(`profile-pictures/${fileName}`);
          
          // Upload file
          await storageRef.put(profilePictureFile);
          
          // Get download URL
          profilePictureUrl = await storageRef.getDownloadURL();
        } catch (uploadError) {
          console.error('Profile picture upload error:', uploadError);
          // Continue registration even if picture upload fails
        }
      }
      
      // Create user profile in Firestore
      const userProfile = {
        uid: user.uid,
        email: email,
        role: profileData.role || 'member',
        fullName: profileData.fullName,
        phone: profileData.phone || '',
        region: profileData.region || '',
        // New required fields
        gender: profileData.gender || '',
        dateOfBirth: profileData.dateOfBirth || '',
        maritalStatus: profileData.maritalStatus || '',
        address: profileData.address || '',
        employmentStatus: profileData.employmentStatus || 'Not Employed',
        currentWorkplace: profileData.currentWorkplace || 'N/A',
        nextOfKin: profileData.nextOfKin || { name: '', contact: '' },
        // System fields
        registrationDate: window.FirebaseModule.timestamp.now(),
        status: 'pending',
        createdAt: window.FirebaseModule.timestamp.now(),
        updatedAt: window.FirebaseModule.timestamp.now()
      };
      
      // Add profile picture URL if uploaded
      if (profilePictureUrl) {
        userProfile.profilePictureUrl = profilePictureUrl;
      }
      
      // Add optional pharmacy council PIN if provided
      if (profileData.pharmacyCouncilPin) {
        userProfile.pharmacyCouncilPin = profileData.pharmacyCouncilPin;
      }
      
      // Add MCA school if provided
      if (profileData.mcaSchool) {
        userProfile.mcaSchool = profileData.mcaSchool;
      }
      
      await window.FirebaseModule.collections.users()
        .doc(user.uid)
        .set(userProfile);
      
      // Send email verification
      await user.sendEmailVerification();
      
      return { success: true, user };
    } catch (error) {
      console.error('Sign up error:', error);
      return { 
        success: false, 
        error: window.FirebaseModule.handleFirebaseError(error) 
      };
    }
  }
  
  // ===== SIGN IN WITH EMAIL/PASSWORD =====
  async function signIn(email, password) {
    try {
      const auth = window.FirebaseModule.auth();
      const userCredential = await auth.signInWithEmailAndPassword(email, password);
      const user = userCredential.user;
      
      // Check if email is verified
      if (!user.emailVerified) {
        return {
          success: false,
          emailNotVerified: true,
          error: 'Please verify your email address before signing in. Check your inbox for the verification link.',
          user: user // Return user object so we can resend verification email
        };
      }
      
      return { success: true, user: user };
    } catch (error) {
      console.error('Sign in error:', error);
      return { 
        success: false, 
        error: window.FirebaseModule.handleFirebaseError(error) 
      };
    }
  }
  
  // ===== SIGN OUT =====
  async function signOut() {
    console.log('[AuthModule] 🚨🚨🚨 SIGN OUT CALLED 🚨🚨🚨');
    console.trace('[AuthModule] Sign out stack trace:');
    
    try {
      const auth = window.FirebaseModule.auth();
      await auth.signOut();
      
      console.log('[AuthModule] Sign out successful, redirecting to home...');
      // Redirect to home page
      window.location.href = '/index.html';
      
      return { success: true };
    } catch (error) {
      console.error('Sign out error:', error);
      return { 
        success: false, 
        error: window.FirebaseModule.handleFirebaseError(error) 
      };
    }
  }
  
  // ===== PASSWORD RESET =====
  async function resetPassword(email) {
    try {
      const auth = window.FirebaseModule.auth();
      await auth.sendPasswordResetEmail(email);
      
      return { success: true };
    } catch (error) {
      console.error('Password reset error:', error);
      return { 
        success: false, 
        error: window.FirebaseModule.handleFirebaseError(error) 
      };
    }
  }
  
  // ===== UPDATE PROFILE =====
  async function updateProfile(updates) {
    try {
      if (!currentUser) {
        throw new Error('No user is signed in');
      }
      
      await window.FirebaseModule.collections.users()
        .doc(currentUser.uid)
        .update({
          ...updates,
          updatedAt: window.FirebaseModule.timestamp.now()
        });
      
      // Update local profile
      currentUser.profile = {
        ...currentUser.profile,
        ...updates
      };
      
      return { success: true };
    } catch (error) {
      console.error('Update profile error:', error);
      return { 
        success: false, 
        error: window.FirebaseModule.handleFirebaseError(error) 
      };
    }
  }
  
  // ===== CHANGE PASSWORD =====
  async function changePassword(currentPassword, newPassword) {
    try {
      const auth = window.FirebaseModule.auth();
      const user = auth.currentUser;
      
      // Reauthenticate user
      const credential = firebase.auth.EmailAuthProvider.credential(
        user.email,
        currentPassword
      );
      
      await user.reauthenticateWithCredential(credential);
      
      // Update password
      await user.updatePassword(newPassword);
      
      return { success: true };
    } catch (error) {
      console.error('Change password error:', error);
      return { 
        success: false, 
        error: window.FirebaseModule.handleFirebaseError(error) 
      };
    }
  }
  
  // ===== GET CURRENT USER =====
  function getCurrentUser() {
    return currentUser;
  }
  
  // ===== CHECK USER ROLE =====
  function hasRole(role) {
    if (!currentUser || !currentUser.profile) {
      return false;
    }
    
    return currentUser.profile.role === role;
  }
  
  // ===== CHECK MULTIPLE ROLES =====
  function hasAnyRole(roles) {
    if (!currentUser || !currentUser.profile) {
      return false;
    }
    
    return roles.includes(currentUser.profile.role);
  }
  
  // ===== CHECK PERMISSION =====
  function hasPermission(permission) {
    if (!currentUser || !currentUser.profile) {
      return false;
    }
    
    const role = currentUser.profile.role;
    
    // Define role hierarchy
    const rolePermissions = {
      super_admin: ['all'],
      national_executive: ['national', 'regional', 'member', 'public'],
      regional_executive: ['regional', 'member', 'public'],
      member: ['member', 'public'],
      public: ['public']
    };
    
    const userPermissions = rolePermissions[role] || [];
    return userPermissions.includes(permission) || userPermissions.includes('all');
  }
  
  // ===== REQUIRE AUTHENTICATION =====
  function requireAuth(redirectUrl = '/index.html') {
    if (!currentUser) {
      window.location.href = redirectUrl;
      return false;
    }
    return true;
  }
  
  // ===== REQUIRE ROLE =====
  function requireRole(requiredRole, redirectUrl = '/index.html') {
    if (!requireAuth(redirectUrl)) {
      return false;
    }
    
    if (!hasRole(requiredRole)) {
      window.location.href = redirectUrl;
      return false;
    }
    
    return true;
  }
  
  // ===== REQUIRE ANY ROLE (Multiple Roles) =====
  function requireAnyRole(allowedRoles, redirectUrl = '/index.html') {
    if (!requireAuth(redirectUrl)) {
      return false;
    }
    
    if (!hasAnyRole(allowedRoles)) {
      window.location.href = redirectUrl;
      return false;
    }
    
    return true;
  }
  
  // ===== ROLE-BASED REDIRECT =====
  function handleRoleBasedRedirect(profile) {
    const currentPath = window.location.pathname;

    // Keep users on completion page until profile is completed
    if (currentPath.includes('complete-profile')) {
      return;
    }

    // Enforce profile completion gate before dashboard routing
    if (profile && profile.mustCompleteProfile === true) {
      window.location.href = '/complete-profile.html';
      return;
    }
    
    // Don't redirect if already on a dashboard page
    if (currentPath.includes('dashboard') || currentPath.includes('national/') || currentPath.includes('region-dashboard/')) {
      return;
    }
    
    // Don't redirect if on public pages
    const publicPages = ['/index.html', '/about.html', '/contact.html', '/events.html', '/news.html', '/'];
    if (publicPages.includes(currentPath)) {
      return;
    }
    
    // Redirect based on role
    if (!profile || !profile.role) {
      console.log('[AuthModule] No role found, staying on current page');
      return;
    }
    
    const role = profile.role;
    console.log(`[AuthModule] Redirecting based on role: ${role}`);
    
    switch (role) {
      case 'super_admin':
      case 'national_executive':
        if (!currentPath.includes('/national/')) {
          window.location.href = '/national/dashboard.html';
        }
        break;
      case 'regional_executive':
        if (!currentPath.includes('/region-dashboard/')) {
          window.location.href = '/region-dashboard/index.html';
        }
        break;
      case 'member':
      default:
        if (!currentPath.includes('/member-dashboard')) {
          window.location.href = '/member-dashboard.html';
        }
        break;
    }
  }
  
  // ===== UPDATE UI BASED ON AUTH STATE =====
  function updateAuthUI(user) {
    const authButtons = document.querySelectorAll('[data-auth]');
    
    authButtons.forEach(button => {
      const authState = button.dataset.auth;
      
      if (authState === 'signed-in' && user) {
        button.classList.remove('hidden');
      } else if (authState === 'signed-out' && !user) {
        button.classList.remove('hidden');
      } else {
        button.classList.add('hidden');
      }
    });
    
    // Update user display elements
    if (user && user.profile) {
      const userNameElements = document.querySelectorAll('[data-user-name]');
      const userEmailElements = document.querySelectorAll('[data-user-email]');
      const userRoleElements = document.querySelectorAll('[data-user-role]');
      
      userNameElements.forEach(el => el.textContent = user.profile.fullName || 'User');
      userEmailElements.forEach(el => el.textContent = user.email);
      userRoleElements.forEach(el => el.textContent = user.profile.role || 'Member');
    }
  }
  
  // ===== INITIALIZE AUTH MODULE =====
  function init() {
    initAuthListener();
    
    // Listen for auth state changes and update UI
    onAuthStateChanged(updateAuthUI);
    
    console.log('Auth module initialized');
  }
  
  // ===== PUBLIC API =====
  return {
    init,
    signUp,
    signIn,
    signOut,
    resetPassword,
    updateProfile,
    changePassword,
    getCurrentUser,
    hasRole,
    hasAnyRole,
    hasPermission,
    requireAuth,
    requireRole,
    requireAnyRole,
    onAuthStateChanged,
    isAuthReady: () => authReady // 🔥 NEW: Check if auth is fully initialized
  };
})();

// Initialize auth module when Firebase is ready (unless on login page)
if (!window.SKIP_ROUTER) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      // Wait a bit for Firebase to initialize
      setTimeout(() => AuthModule.init(), 200);
    });
  } else {
    // DOM already loaded, wait for Firebase
    setTimeout(() => AuthModule.init(), 200);
  }
}

// Export to window
window.AuthModule = AuthModule;
