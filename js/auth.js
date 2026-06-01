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
  // ✅ NAVIGATION PATCH START
  function isPreviewMode() {
    try {
      return new URL(window.location.href).searchParams.has('preview');
    } catch (error) {
      return false;
    }
  }

  function redirectTo(path) {
    const target = new URL(path, window.location.origin);
    const current = new URL(window.location.href);
    if (current.pathname === target.pathname && current.search === target.search && current.hash === target.hash) {
      return false;
    }
    window.location.href = `${target.pathname}${target.search}${target.hash}`;
    return true;
  }
  // ✅ NAVIGATION PATCH END

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
      const previewMode = isPreviewMode();

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
          redirectTo('/membership.html?verified=false');
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
              redirectTo('/change-password.html');
              return; // Stop execution here
            }
          }

          // ===== FORCE PROFILE COMPLETION FOR NEW LEADERS =====
          if (currentUser.profile.mustCompleteProfile === true) {
            if (!currentPath.includes('complete-profile')) {
              console.log('[AuthModule] ⚠️ User must complete profile - redirecting...');
              redirectTo('/complete-profile.html');
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
        if (previewMode) {
          console.log('[AuthModule] Preview mode active, role-based redirect skipped');
        } else {
          console.log('[AuthModule] Calling handleRoleBasedRedirect');
          handleRoleBasedRedirect(currentUser.profile);
        }
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

  function normalizeEmail(email) {
    return String(email || '').trim().toLowerCase();
  }

  function validateRealEmailAddress(email) {
    const normalized = normalizeEmail(email);
    const blockedDomains = new Set([
      '10minutemail.com',
      'guerrillamail.com',
      'mailinator.com',
      'tempmail.com',
      'temp-mail.org',
      'yopmail.com'
    ]);

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalized)) {
      return 'Please enter a valid email address.';
    }

    const domain = normalized.split('@')[1] || '';
    if (blockedDomains.has(domain)) {
      return 'Please use a permanent personal or work email address, not a temporary email service.';
    }

    return '';
  }

  const GOVERNANCE_PERMISSION_PRESETS = {
    super_admin: {
      canCreateRegions: true,
      canManageNationalExecutives: true,
      canResetPasswords: true,
      canManageSystemSettings: true,
      canViewAuditLogs: true,
      canViewFullAnalytics: true,
      canApproveRoleChanges: true,
      canExportReports: true,
      canAccessAllModules: true,
      canManageMembers: true,
      canApproveMembers: true,
      canManagePayments: true,
      canViewFinancialReports: true,
      canViewNationalPayments: true,
      canViewRegionalPayments: true,
      canExportFinancialReports: true,
      canCreateEvents: true,
      canApproveEvents: true,
      canManageExecutives: true,
      canSuspendMembers: true,
      canBroadcastMessages: true,
      canViewSensitiveContactDetails: true
    },
    national_president: {
      canManageMembers: true,
      canApproveMembers: true,
      canManagePayments: true,
      canViewFinancialReports: true,
      canViewNationalPayments: true,
      canViewRegionalPayments: true,
      canExportFinancialReports: true,
      canCreateEvents: true,
      canApproveEvents: true,
      canManageExecutives: true,
      canSuspendMembers: true,
      canExportReports: true,
      canBroadcastMessages: true,
      canViewAuditLogs: true,
      canViewFullAnalytics: true,
      canViewSensitiveContactDetails: true
    },
    national_secretary: {
      canManageMembers: true,
      canApproveMembers: true,
      canManagePayments: false,
      canViewFinancialReports: false,
      canViewNationalPayments: false,
      canViewRegionalPayments: false,
      canExportFinancialReports: false,
      canCreateEvents: true,
      canApproveEvents: true,
      canManageExecutives: false,
      canSuspendMembers: false,
      canExportReports: true,
      canBroadcastMessages: true,
      canViewSensitiveContactDetails: true
    },
    national_treasurer: {
      canManageMembers: false,
      canApproveMembers: false,
      canManagePayments: true,
      canViewFinancialReports: true,
      canViewNationalPayments: true,
      canViewRegionalPayments: true,
      canExportFinancialReports: true,
      canCreateEvents: false,
      canApproveEvents: false,
      canManageExecutives: false,
      canSuspendMembers: false,
      canExportReports: true,
      canBroadcastMessages: false,
      canViewSensitiveContactDetails: false
    },
    regional_president: {
      canManageMembers: true,
      canApproveMembers: true,
      canManagePayments: false,
      canViewFinancialReports: true,
      canViewNationalPayments: false,
      canViewRegionalPayments: true,
      canExportFinancialReports: true,
      canCreateEvents: true,
      canManageExecutives: true,
      canSuspendMembers: false,
      canExportReports: true,
      canBroadcastMessages: true,
      canViewSensitiveContactDetails: true
    },
    regional_secretary: {
      canManageMembers: true,
      canApproveMembers: true,
      canManagePayments: false,
      canViewFinancialReports: false,
      canViewNationalPayments: false,
      canViewRegionalPayments: false,
      canExportFinancialReports: false,
      canCreateEvents: true,
      canManageExecutives: false,
      canSuspendMembers: false,
      canExportReports: true,
      canBroadcastMessages: true,
      canViewSensitiveContactDetails: true
    },
    regional_treasurer: {
      canManageMembers: false,
      canApproveMembers: false,
      canManagePayments: true,
      canViewFinancialReports: true,
      canViewNationalPayments: false,
      canViewRegionalPayments: true,
      canExportFinancialReports: true,
      canCreateEvents: false,
      canManageExecutives: false,
      canSuspendMembers: false,
      canExportReports: true,
      canBroadcastMessages: false,
      canViewSensitiveContactDetails: false
    },
    member: {}
  };

  function normalizeExecutiveTitle(profile = {}) {
    return String(profile.executiveTitle || profile.title || profile.position || '')
      .trim()
      .toLowerCase()
      .replace(/^national\s+/, '')
      .replace(/^regional\s+/, '')
      .replace(/\s+/g, '_');
  }

  function getGovernanceKey(profile = {}) {
    const role = String(profile.role || 'member').toLowerCase();
    const level = String(profile.executiveLevel || '').toLowerCase();
    const title = normalizeExecutiveTitle(profile);

    if (role === 'super_admin') return 'super_admin';
    if (role === 'national_executive') return `national_${title || level || 'secretary'}`;
    if (role === 'regional_executive') return `regional_${title || level || 'secretary'}`;
    return role;
  }

  function getEffectivePermissions(profile = {}) {
    const preset = GOVERNANCE_PERMISSION_PRESETS[getGovernanceKey(profile)] || GOVERNANCE_PERMISSION_PRESETS[profile.role] || {};
    return {
      ...preset,
      ...(profile.permissions || {})
    };
  }
  
  // ===== SIGN UP WITH EMAIL/PASSWORD =====
  async function signUp(email, password, profileData, profilePictureFile = null) {
    try {
      const emailError = validateRealEmailAddress(email);
      if (emailError) {
        throw new Error(emailError);
      }

      const auth = window.FirebaseModule.auth();
      const normalizedEmail = normalizeEmail(email);
      const userCredential = await auth.createUserWithEmailAndPassword(normalizedEmail, password);
      const user = userCredential.user;

      try {
        localStorage.setItem(`amcagPendingRegistration:${normalizedEmail}`, JSON.stringify({
          ...profileData,
          email: normalizedEmail,
          savedAt: new Date().toISOString()
        }));
      } catch (storageError) {
        console.warn('Unable to save pending registration locally:', storageError);
      }

      // Send email verification
      await user.sendEmailVerification();
      await auth.signOut();
      
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
      
      // ✅ NAVIGATION PATCH START
      const routes = window.AMCAG_ROUTES || {};
      console.log('[AuthModule] Sign out successful, redirecting to login...');
      window.location.href = routes.LOGOUT_REDIRECT || routes.LOGIN || '/membership.html';
      // ✅ NAVIGATION PATCH END
      
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

      const payload = {
        ...updates,
        updatedAt: window.FirebaseModule.timestamp.now()
      };

      await window.FirebaseModule.collections.users()
        .doc(currentUser.uid)
        .update(payload);

      try {
        const memberRef = window.FirebaseModule.collections.members().doc(currentUser.uid);
        const memberDoc = await memberRef.get();
        if (memberDoc.exists) {
          await memberRef.update(payload);
        }
      } catch (memberUpdateError) {
        console.warn('Member mirror profile update skipped:', memberUpdateError);
      }

      try {
        if ((updates.fullName || updates.photoURL || updates.profilePictureUrl) && typeof currentUser.updateProfile === 'function') {
          const authProfileUpdates = {};
          if (updates.fullName) {
            authProfileUpdates.displayName = updates.fullName;
          }
          if (updates.photoURL || updates.profilePictureUrl) {
            authProfileUpdates.photoURL = updates.photoURL || updates.profilePictureUrl;
          }
          await currentUser.updateProfile(authProfileUpdates);
        }
      } catch (authProfileError) {
        console.warn('Firebase Auth profile sync skipped:', authProfileError);
      }
      
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

    if (currentUser.profile.role === 'super_admin') {
      return true;
    }

    const effectivePermissions = getEffectivePermissions(currentUser.profile);
    return effectivePermissions[permission] === true;
  }

  function getExecutiveLevel() {
    return currentUser?.profile?.executiveLevel || '';
  }

  function getExecutiveTitle() {
    return currentUser?.profile?.executiveTitle || currentUser?.profile?.title || currentUser?.profile?.position || '';
  }

  function getUserRegion() {
    return currentUser?.profile?.region || currentUser?.profile?.regionId || '';
  }

  function isNationalExecutive() {
    return hasAnyRole(['super_admin', 'national_executive']);
  }

  function isRegionalExecutive() {
    return hasRole('regional_executive');
  }

  function canAccessRegion(region) {
    if (!currentUser || !currentUser.profile) {
      return false;
    }

    if (isNationalExecutive()) {
      return true;
    }

    return isRegionalExecutive() &&
      String(getUserRegion()).toLowerCase() === String(region || '').toLowerCase();
  }

  function canViewPayment(payment = {}) {
    if (!currentUser || !currentUser.profile) {
      return false;
    }

    if (payment.uid === currentUser.uid || payment.memberUid === currentUser.uid) {
      return true;
    }

    if (hasPermission('canViewNationalPayments')) {
      return true;
    }

    if (hasPermission('canViewRegionalPayments')) {
      return canAccessRegion(payment.regionId || payment.region);
    }

    return false;
  }
  
  // ===== REQUIRE AUTHENTICATION =====
  // ✅ NAVIGATION PATCH START
  function getLoginRoute() {
    const routes = window.AMCAG_ROUTES || {};
    return routes.LOGIN || '/membership.html';
  }

  function requireAuth(redirectUrl = getLoginRoute()) {
    if (!currentUser) {
      window.location.href = redirectUrl;
      return false;
    }
    return true;
  }
  
  // ===== REQUIRE ROLE =====
  function requireRole(requiredRole, redirectUrl = getLoginRoute()) {
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
  function requireAnyRole(allowedRoles, redirectUrl = getLoginRoute()) {
    if (!requireAuth(redirectUrl)) {
      return false;
    }
    
    if (!hasAnyRole(allowedRoles)) {
      window.location.href = redirectUrl;
      return false;
    }
    
    return true;
  }
  // ✅ NAVIGATION PATCH END
  
  // ===== ROLE-BASED REDIRECT =====
  function normalizeRoutePath(path) {
    const cleanPath = String(path || '/').split('?')[0].split('#')[0] || '/';
    if (cleanPath === '/') return '/';
    return cleanPath.endsWith('/') ? cleanPath.slice(0, -1) : cleanPath;
  }

  function isMemberPortalPath(path) {
    const currentPath = normalizeRoutePath(path);
    const currentPathHtml = currentPath.endsWith('.html') ? currentPath : `${currentPath}.html`;
    const memberPortalPages = new Set([
      '/member-dashboard.html',
      '/profile.html',
      '/certificates.html',
      '/dues.html',
      '/payments.html',
      '/payment-receipt.html',
      '/change-password.html',
      '/complete-profile.html',
      '/member-dashboard/agm-registration.html',
      '/member-dashboard/donate.html',
      '/member-dashboard/dues-payment.html',
      '/member-dashboard/meetings.html',
      '/member-dashboard/my-donations.html',
      '/member-dashboard/regional-chat.html',
      '/member-dashboard/waiver-request.html'
    ]);

    return currentPath.startsWith('/member-dashboard/') ||
      memberPortalPages.has(currentPath) ||
      memberPortalPages.has(currentPathHtml);
  }

  function handleRoleBasedRedirect(profile) {
    const currentPath = normalizeRoutePath(window.location.pathname);

    // ✅ NAVIGATION PATCH START
    if (isPreviewMode()) {
      console.log('[AuthModule] Preview mode active, dashboard redirect skipped');
      return;
    }
    // ✅ NAVIGATION PATCH END

    // Keep users on completion page until profile is completed
    if (currentPath.includes('complete-profile')) {
      return;
    }

    // Enforce profile completion gate before dashboard routing
    if (profile && profile.mustCompleteProfile === true) {
      redirectTo('/complete-profile.html');
      return;
    }
    
    // Don't redirect if already on an app page the signed-in user explicitly opened
    if (
      currentPath.includes('dashboard') ||
      currentPath.includes('national/') ||
      currentPath.includes('region-dashboard/') ||
      isMemberPortalPath(currentPath)
    ) {
      return;
    }
    
    // Don't redirect if on public pages
    const publicPages = [
      '/',
      '/index.html',
      '/index-modern.html',
      '/about.html',
      '/contact.html',
      '/events.html',
      '/news.html',
      '/leadership.html',
      '/regions.html',
      '/region.html',
      '/gallery.html',
      '/videos.html',
      '/donate.html',
      '/donor-recognition.html',
      '/certificate-verify.html',
      '/certificate-view.html'
    ];
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
          redirectTo('/national/dashboard.html');
        }
        break;
      case 'regional_executive':
        if (!currentPath.includes('/region-dashboard/')) {
          redirectTo('/region-dashboard/index.html');
        }
        break;
      case 'member':
      default:
        if (!isMemberPortalPath(currentPath)) {
          redirectTo('/member-dashboard.html');
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
    getEffectivePermissions: () => currentUser?.profile ? getEffectivePermissions(currentUser.profile) : {},
    getExecutiveLevel,
    getExecutiveTitle,
    getUserRegion,
    isNationalExecutive,
    isRegionalExecutive,
    canAccessRegion,
    canViewPayment,
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
