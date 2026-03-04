// ================================================================
// AMCAG NATIONAL DIGITAL GOVERNANCE ECOSYSTEM
// Router Module - Role-Based Navigation & Access Control
// ================================================================

const RouterModule = (function() {
  'use strict';
  
  // ===== ROUTE DEFINITIONS =====
  const routes = {
    // Public routes (no authentication required)
    public: [
      '/',
      '/index.html',
      '/about.html',
      '/leadership.html',
      '/events.html',
      '/news.html',
      '/gallery.html',
      '/videos.html',
      '/regions.html',
      '/region.html',
      '/certificate-verify.html',
      '/contact.html',
      '/membership.html',
      '/registration.html'
    ],
    
    // Member routes (requires member authentication)
    member: [
      '/member-dashboard.html',
      '/dues.html',
      '/payments.html',
      '/contributions.html',
      '/profile.html',
      '/certificates.html'
    ],
    
    // Regional executive routes
    regional: [
      '/region-dashboard/index.html',
      '/region-dashboard/members.html',
      '/region-dashboard/events.html',
      '/region-dashboard/payments.html',
      '/region-dashboard/media.html'
    ],
    
    // National executive routes
    national: [
      '/national/dashboard.html',
      '/national/members.html',
      '/national/regions.html',
      '/national/payments.html',
      '/national/certificates.html',
      '/national/events.html',
      '/national/analytics.html',
      '/national/leadership.html'
    ]
  };
  
  // ===== ROLE HIERARCHY =====
  const roleHierarchy = {
    super_admin: ['public', 'member', 'regional', 'national'],
    national_executive: ['public', 'member', 'regional', 'national'],
    regional_executive: ['public', 'member', 'regional'],
    member: ['public', 'member'],
    public: ['public']
  };
  
  // ===== CHECK ROUTE ACCESS =====
  function canAccessRoute(path, userRole = 'public') {
    // Normalize path
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    
    // Get allowed route types for this role
    const allowedTypes = roleHierarchy[userRole] || ['public'];
    
    // Check if route is in any allowed type
    for (const type of allowedTypes) {
      if (routes[type] && routes[type].includes(normalizedPath)) {
        return true;
      }
    }
    
    return false;
  }
  
  // ===== GET ROUTE TYPE =====
  function getRouteType(path) {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    
    for (const [type, paths] of Object.entries(routes)) {
      if (paths.includes(normalizedPath)) {
        return type;
      }
    }
    
    return null;
  }
  
  // ===== GET DEFAULT DASHBOARD FOR ROLE =====
  function getDashboardForRole(role) {
    const dashboards = {
      super_admin: '/national/dashboard.html',
      national_executive: '/national/dashboard.html',
      regional_executive: '/region-dashboard/index.html',
      member: '/member-dashboard.html',
      public: '/index.html'
    };
    
    return dashboards[role] || '/index.html';
  }
  
  // ===== PROTECT ROUTE =====
  function protectRoute() {
    const currentPath = window.location.pathname;
    
    // Skip protection on login/registration pages (they handle their own logic)
    if (currentPath === '/membership.html' || currentPath === '/registration.html') {
      return true;
    }
    
    // 🔥 CRITICAL FIX: Wait for auth to fully initialize before checking user
    if (!window.AuthModule.isAuthReady()) {
      console.log('[RouterModule] ⏳ Waiting for auth to initialize...');
      return true; // Allow page load, auth is loading
    }
    
    const user = window.AuthModule.getCurrentUser();
    console.log('[RouterModule] ✅ Auth ready, checking route protection for user:', user?.uid);
    
    // 🔧 PATCH: Wait for profile to load (race condition fix)
    // If user is authenticated but profile hasn't loaded yet, DON'T redirect
    // auth.js is still fetching from Firestore - give it time
    if (user && !user.profile) {
      console.log('[RouterModule] User authenticated but profile loading... waiting');
      return true; // Allow page to load, auth.js will handle redirect if needed
    }
    
    const userRole = user && user.profile ? user.profile.role : 'public';
    
    // Check if user can access this route
    if (!canAccessRoute(currentPath, userRole)) {
      const routeType = getRouteType(currentPath);
      
      if (!user) {
        // Redirect to login
        console.log('[RouterModule] No user, redirecting to login');
        window.location.href = '/membership.html?redirect=' + encodeURIComponent(currentPath);
      } else {
        // Redirect to appropriate dashboard
        console.log('[RouterModule] Wrong role, redirecting to dashboard');
        window.location.href = getDashboardForRole(userRole);
      }
      
      return false;
    }
    
    return true;
  }
  
  // ===== NAVIGATE =====
  function navigate(path) {
    const user = window.AuthModule.getCurrentUser();
    const userRole = user && user.profile ? user.profile.role : 'public';
    
    if (canAccessRoute(path, userRole)) {
      window.location.href = path;
    } else {
      console.warn(`Access denied to ${path} for role ${userRole}`);
      
      if (!user) {
        window.location.href = '/membership.html?redirect=' + encodeURIComponent(path);
      } else {
        alert('You do not have permission to access this page.');
      }
    }
  }
  
  // ===== GET REDIRECT URL =====
  function getRedirectUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('redirect') || null;
  }
  
  // ===== HANDLE POST-LOGIN REDIRECT =====
  function handlePostLoginRedirect(user) {
    const redirectUrl = getRedirectUrl();
    
    if (redirectUrl) {
      const userRole = user.profile ? user.profile.role : 'member';
      
      if (canAccessRoute(redirectUrl, userRole)) {
        window.location.href = redirectUrl;
        return;
      }
    }
    
    // Redirect to default dashboard
    const dashboard = getDashboardForRole(user.profile.role);
    window.location.href = dashboard;
  }
  
  // ===== GET BREADCRUMBS =====
  function getBreadcrumbs(path = window.location.pathname) {
    const pathParts = path.split('/').filter(part => part && part !== 'index.html');
    const breadcrumbs = [{ label: 'Home', path: '/' }];
    
    let currentPath = '';
    
    for (const part of pathParts) {
      currentPath += `/${part}`;
      
      // Format label
      let label = part.replace('.html', '').replace(/-/g, ' ');
      label = label.charAt(0).toUpperCase() + label.slice(1);
      
      breadcrumbs.push({
        label,
        path: currentPath
      });
    }
    
    return breadcrumbs;
  }
  
  // ===== RENDER BREADCRUMBS =====
  function renderBreadcrumbs(containerId = 'breadcrumbs') {
    const container = document.getElementById(containerId);
    
    if (!container) {
      return;
    }
    
    const breadcrumbs = getBreadcrumbs();
    const breadcrumbHTML = breadcrumbs.map((crumb, index) => {
      const isLast = index === breadcrumbs.length - 1;
      
      return `
        <div class="breadcrumb-item ${isLast ? 'active' : ''}">
          ${isLast ? crumb.label : `<a href="${crumb.path}">${crumb.label}</a>`}
        </div>
        ${!isLast ? '<span class="breadcrumb-separator">/</span>' : ''}
      `;
    }).join('');
    
    container.innerHTML = breadcrumbHTML;
  }
  
  // ===== HIGHLIGHT ACTIVE NAV =====
  function highlightActiveNav() {
    const currentPath = window.location.pathname;
    const navLinks = document.querySelectorAll('.navbar-link, .sidebar-link');
    
    navLinks.forEach(link => {
      const href = link.getAttribute('href');
      
      if (href === currentPath || (href !== '/' && currentPath.includes(href))) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });
  }
  
  // ===== INIT ROUTER =====
  function init() {
    const currentPath = window.location.pathname;
    
    // Skip router initialization on login/registration pages
    if (currentPath === '/membership.html' || currentPath === '/registration.html') {
      console.log('Router: Skipping protection on auth page');
      return;
    }
    
    // Protect current route
    protectRoute();
    
    // Render breadcrumbs if container exists
    renderBreadcrumbs();
    
    // Highlight active navigation
    highlightActiveNav();
    
    // Listen for auth state changes
    window.AuthModule.onAuthStateChanged((user) => {
      // Re-check route protection when auth state changes (except on login pages)
      if (currentPath !== '/membership.html' && currentPath !== '/registration.html') {
        protectRoute();
      }
    });
    
    console.log('Router module initialized');
  }
  
  // ===== PUBLIC API =====
  return {
    init,
    canAccessRoute,
    getRouteType,
    getDashboardForRole,
    protectRoute,
    navigate,
    handlePostLoginRedirect,
    getBreadcrumbs,
    renderBreadcrumbs,
    highlightActiveNav
  };
})();

// Initialize router when DOM is ready (unless explicitly skipped)
if (!window.SKIP_ROUTER) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => RouterModule.init());
  } else {
    RouterModule.init();
  }
}

// Export to window
window.RouterModule = RouterModule;
