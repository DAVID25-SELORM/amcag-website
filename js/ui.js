// ================================================================
// AMCAG NATIONAL DIGITAL GOVERNANCE ECOSYSTEM
// UI Utilities Module
// ================================================================

const UIModule = (function() {
  'use strict';
  
  // ===== SHOW LOADER =====
  function showLoader(message = 'Loading...') {
    let loader = document.getElementById('global-loader');
    
    if (!loader) {
      loader = document.createElement('div');
      loader.id = 'global-loader';
      loader.className = 'loader-overlay';
      loader.innerHTML = `
        <div style="text-align: center;">
          <div class="loader"></div>
          <p style="color: white; margin-top: 1rem;" id="loader-message">${message}</p>
        </div>
      `;
      document.body.appendChild(loader);
    }
    
    document.getElementById('loader-message').textContent = message;
    loader.classList.add('active');
  }
  
  // ===== HIDE LOADER =====
  function hideLoader() {
    const loader = document.getElementById('global-loader');
    if (loader) {
      loader.classList.remove('active');
    }
  }
  
  // ===== SHOW ALERT =====
  function showAlert(message, type = 'info', duration = 5000) {
    const alertContainer = getOrCreateAlertContainer();
    
    const alertId = `alert-${Date.now()}`;
    const alertHTML = `
      <div id="${alertId}" class="alert alert-${type}" style="animation: slideInRight 0.3s ease-out;">
        <div class="alert-icon">${getAlertIcon(type)}</div>
        <div class="alert-content">
          <div class="alert-message">${message}</div>
        </div>
        <button onclick="UIModule.closeAlert('${alertId}')" style="background: none; border: none; cursor: pointer; padding: 0.5rem; margin-left: auto;">
          ✕
        </button>
      </div>
    `;
    
    alertContainer.insertAdjacentHTML('beforeend', alertHTML);
    
    // Auto-remove after duration
    if (duration > 0) {
      setTimeout(() => closeAlert(alertId), duration);
    }
    
    return alertId;
  }
  
  // ===== GET ALERT ICON =====
  function getAlertIcon(type) {
    const icons = {
      success: '✓',
      error: '✕',
      warning: '⚠',
      info: 'ℹ'
    };
    
    return icons[type] || icons.info;
  }
  
  // ===== CLOSE ALERT =====
  function closeAlert(alertId) {
    const alert = document.getElementById(alertId);
    if (alert) {
      alert.style.animation = 'slideOutRight 0.3s ease-out';
      setTimeout(() => alert.remove(), 300);
    }
  }
  
  // ===== GET OR CREATE ALERT CONTAINER =====
  function getOrCreateAlertContainer() {
    let container = document.getElementById('alert-container');
    
    if (!container) {
      container = document.createElement('div');
      container.id = 'alert-container';
      container.style.cssText = `
        position: fixed;
        top: 1rem;
        right: 1rem;
        z-index: 1000;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        max-width: 400px;
      `;
      document.body.appendChild(container);
      
      // Add animation styles
      const style = document.createElement('style');
      style.textContent = `
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        @keyframes slideOutRight {
          from {
            transform: translateX(0);
            opacity: 1;
          }
          to {
            transform: translateX(100%);
            opacity: 0;
          }
        }
      `;
      document.head.appendChild(style);
    }
    
    return container;
  }
  
  // ===== SHOW MODAL =====
  function showModal(options) {
    const {
      title,
      content,
      footer,
      size = 'medium',
      onClose
    } = options;
    
    const modalId = `modal-${Date.now()}`;
    const sizeClasses = {
      small: 'max-width: 400px',
      medium: 'max-width: 600px',
      large: 'max-width: 900px'
    };
    
    const modalHTML = `
      <div id="${modalId}" class="modal-backdrop">
        <div class="modal" style="${sizeClasses[size]}">
          <div class="modal-header">
            <h3 class="modal-title">${title}</h3>
            <button class="modal-close" onclick="UIModule.closeModal('${modalId}')">✕</button>
          </div>
          <div class="modal-body">
            ${content}
          </div>
          ${footer ? `<div class="modal-footer">${footer}</div>` : ''}
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    const modal = document.getElementById(modalId);
    
    // Show modal with animation
    setTimeout(() => modal.classList.add('active'), 10);
    
    // Close on backdrop click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal(modalId);
        if (onClose) onClose();
      }
    });
    
    // Close on escape key
    const escapeHandler = (e) => {
      if (e.key === 'Escape') {
        closeModal(modalId);
        if (onClose) onClose();
        document.removeEventListener('keydown', escapeHandler);
      }
    };
    
    document.addEventListener('keydown', escapeHandler);
    
    return modalId;
  }
  
  // ===== CLOSE MODAL =====
  function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    
    if (modal) {
      modal.classList.remove('active');
      setTimeout(() => modal.remove(), 300);
    }
  }
  
  // ===== CONFIRM DIALOG =====
  function confirm(message, onConfirm, onCancel) {
    const modalId = showModal({
      title: 'Confirm Action',
      content: `<p>${message}</p>`,
      footer: `
        <button class="btn btn-outline" onclick="UIModule.closeModal('${modalId}'); ${onCancel ? 'this.onCancel()' : ''}">
          Cancel
        </button>
        <button class="btn btn-primary" onclick="UIModule.closeModal('${modalId}'); this.onConfirm()">
          Confirm
        </button>
      `,
      size: 'small'
    });
    
    // Attach callbacks
    const modal = document.getElementById(modalId);
    const confirmBtn = modal.querySelector('.btn-primary');
    const cancelBtn = modal.querySelector('.btn-outline');
    
    if (confirmBtn) {
      confirmBtn.onConfirm = onConfirm;
    }
    
    if (cancelBtn && onCancel) {
      cancelBtn.onCancel = onCancel;
    }
  }
  
  // ===== FORMAT DATE =====
  function formatDate(date, format = 'short') {
    if (!date) return '';
    
    // Handle Firestore timestamp
    if (date.toDate && typeof date.toDate === 'function') {
      date = date.toDate();
    }
    
    const d = new Date(date);
    
    const formats = {
      short: { dateStyle: 'short' },
      medium: { dateStyle: 'medium' },
      long: { dateStyle: 'long' },
      full: { dateStyle: 'full', timeStyle: 'short' }
    };
    
    return new Intl.DateTimeFormat('en-GB', formats[format] || formats.medium).format(d);
  }
  
  // ===== FORMAT CURRENCY =====
  function formatCurrency(amount, currency = 'GHS') {
    return new Intl.NumberFormat('en-GH', {
      style: 'currency',
      currency: currency
    }).format(amount);
  }
  
  // ===== FORMAT NUMBER =====
  function formatNumber(number) {
    return new Intl.NumberFormat('en-GH').format(number);
  }
  
  // ===== DEBOUNCE =====
  function debounce(func, wait = 300) {
    let timeout;
    
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }
  
  // ===== THROTTLE =====
  function throttle(func, limit = 300) {
    let inThrottle;
    
    return function(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }
  
  // ===== COPY TO CLIPBOARD =====
  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      showAlert('Copied to clipboard!', 'success', 2000);
      return true;
    } catch (error) {
      console.error('Failed to copy:', error);
      showAlert('Failed to copy to clipboard', 'error', 3000);
      return false;
    }
  }
  
  // ===== VALIDATE FORM =====
  function validateForm(formId) {
    const form = document.getElementById(formId);
    if (!form) return false;
    
    let isValid = true;
    const requiredFields = form.querySelectorAll('[required]');
    
    requiredFields.forEach(field => {
      const errorElement = field.parentElement.querySelector('.form-error');
      
      if (!field.value.trim()) {
        field.classList.add('error');
        
        if (errorElement) {
          errorElement.textContent = 'This field is required';
          errorElement.style.display = 'block';
        }
        
        isValid = false;
      } else {
        field.classList.remove('error');
        
        if (errorElement) {
          errorElement.style.display = 'none';
        }
      }
    });
    
    return isValid;
  }
  
  // ===== GET FORM DATA =====
  function getFormData(formId) {
    const form = document.getElementById(formId);
    if (!form) return null;
    
    const formData = new FormData(form);
    const data = {};
    
    for (const [key, value] of formData.entries()) {
      data[key] = value;
    }
    
    return data;
  }
  
  // ===== RESET FORM =====
  function resetForm(formId) {
    const form = document.getElementById(formId);
    if (!form) return;
    
    form.reset();
    
    // Remove error states
    form.querySelectorAll('.error').forEach(el => el.classList.remove('error'));
    form.querySelectorAll('.form-error').forEach(el => el.style.display = 'none');
  }
  
  // ===== RENDER TABLE =====
  function renderTable(containerId, data, columns) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const tableHTML = `
      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              ${columns.map(col => `<th>${col.label}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${data.length === 0 ? `
              <tr>
                <td colspan="${columns.length}" style="text-align: center; padding: 2rem; color: var(--text-secondary);">
                  No data available
                </td>
              </tr>
            ` : data.map(row => `
              <tr>
                ${columns.map(col => `
                  <td>${col.render ? col.render(row[col.field], row) : row[col.field]}</td>
                `).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
    
    container.innerHTML = tableHTML;
  }
  
  // ===== RENDER PAGINATION =====
  function renderPagination(containerId, currentPage, totalPages, onPageChange) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const maxVisible = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    
    if (endPage - startPage < maxVisible - 1) {
      startPage = Math.max(1, endPage - maxVisible + 1);
    }
    
    let paginationHTML = `<div class="pagination">`;
    
    // Previous button
    paginationHTML += `
      <button class="pagination-btn" ${currentPage === 1 ? 'disabled' : ''} 
              onclick="(${onPageChange})(${currentPage - 1})">
        ‹
      </button>
    `;
    
    // Page numbers
    for (let i = startPage; i <= endPage; i++) {
      paginationHTML += `
        <button class="pagination-btn ${i === currentPage ? 'active' : ''}" 
                onclick="(${onPageChange})(${i})">
          ${i}
        </button>
      `;
    }
    
    // Next button
    paginationHTML += `
      <button class="pagination-btn" ${currentPage === totalPages ? 'disabled' : ''} 
              onclick="(${onPageChange})(${currentPage + 1})">
        ›
      </button>
    `;
    
    paginationHTML += `</div>`;
    
    container.innerHTML = paginationHTML;
  }
  
  // ===== TOGGLE NAVBAR (MOBILE) =====
  function toggleNavbar() {
    const menu = document.querySelector('.navbar-menu');
    if (menu) {
      menu.classList.toggle('active');
    }
  }

  // ===== NAVIGATION FEEDBACK =====
  function attachNavigationFeedback() {
    const navLinks = document.querySelectorAll('a.navbar-link, a.dashboard-nav-item, a.sidebar-link');

    navLinks.forEach(link => {
      if (link.dataset.navFeedbackBound === '1') {
        return;
      }

      link.dataset.navFeedbackBound = '1';
      link.addEventListener('click', (event) => {
        // Only handle normal left-click navigation.
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
          return;
        }

        const href = link.getAttribute('href');
        if (!href || href === '#' || href.startsWith('javascript:')) {
          return;
        }

        if (link.target && link.target !== '_self') {
          return;
        }

        try {
          const destination = new URL(href, window.location.origin);
          const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
          const next = `${destination.pathname}${destination.search}${destination.hash}`;

          if (current === next) {
            return;
          }
        } catch (error) {
          // If URL parsing fails, skip feedback and allow default behavior.
          return;
        }

        showLoader('Opening page...');
        setTimeout(() => hideLoader(), 2500);
      });
    });
  }

  // ✅ NAVIGATION PATCH START
  function getRoutes() {
    return window.AMCAG_ROUTES || {
      PUBLIC_HOME: '/index.html',
      LOGIN: '/membership.html',
      VIEW_SITE: '/index.html?preview=admin',
      MEMBER_VIEW_SITE: '/index.html?preview=member',
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
    };
  }

  function normalizePath(path) {
    const cleanPath = String(path || '/').split('?')[0].split('#')[0] || '/';
    if (cleanPath === '/') return '/index.html';
    if (cleanPath === '/region-dashboard/') return '/region-dashboard/index.html';
    return cleanPath.endsWith('/') ? `${cleanPath.slice(0, -1)}.html` : cleanPath;
  }

  function getCurrentUser() {
    return window.AuthModule && typeof window.AuthModule.getCurrentUser === 'function'
      ? window.AuthModule.getCurrentUser()
      : null;
  }

  function getDashboardForUser(user) {
    const routes = getRoutes();
    const role = user?.profile?.role;
    if (role === 'super_admin' || role === 'national_executive') return routes.ADMIN_DASHBOARD;
    if (role === 'regional_executive') return routes.REGIONAL_DASHBOARD;
    return routes.MEMBER_DASHBOARD;
  }

  function getRoleGroup(user) {
    const role = user?.profile?.role;
    if (role === 'super_admin' || role === 'national_executive') return 'national';
    if (role === 'regional_executive') return 'regional';
    return 'member';
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[char]));
  }

  function isDashboardPath(pathname) {
    const path = normalizePath(pathname);
    return path.startsWith('/national/') ||
      path.startsWith('/region-dashboard/') ||
      path.startsWith('/member-dashboard/') ||
      ['/member-dashboard.html', '/profile.html', '/dues.html', '/payments.html', '/certificates.html'].includes(path);
  }

  function isPublicPath(pathname) {
    const path = normalizePath(pathname);
    return [
      '/index.html',
      '/index-modern.html',
      '/about.html',
      '/events.html',
      '/news.html',
      '/gallery.html',
      '/videos.html',
      '/regions.html',
      '/region.html',
      '/leadership.html',
      '/contact.html',
      '/donate.html',
      '/donor-recognition.html',
      '/certificate-verify.html',
      '/certificate-view.html',
      '/membership.html'
    ].includes(path);
  }

  function signOutAndRedirect(event) {
    if (event) event.preventDefault();

    if (window.AuthModule && typeof window.AuthModule.signOut === 'function') {
      window.AuthModule.signOut();
      return;
    }

    const routes = getRoutes();
    const auth = window.FirebaseModule && window.FirebaseModule.auth && window.FirebaseModule.auth();
    if (auth && typeof auth.signOut === 'function') {
      auth.signOut().finally(() => {
        window.location.href = routes.LOGOUT_REDIRECT || routes.LOGIN;
      });
      return;
    }

    window.location.href = routes.LOGIN;
  }

  function getDashboardNavItems(pathname) {
    const routes = getRoutes();
    if (pathname.startsWith('/national/')) {
      return [
        [routes.ADMIN_DASHBOARD, 'Dashboard'],
        [routes.ADMIN_USERS, 'Users / Admins'],
        ['/national/member-approval.html', 'Approve Members'],
        ['/national/regions.html', 'Regions'],
        ['/national/payments.html', 'Payments'],
        ['/national/dues-management.html', 'Dues'],
        ['/national/donations-overview.html', 'Donations'],
        ['/national/agm-registrations.html', 'AGM'],
        ['/national/meetings.html', 'Meetings'],
        [routes.ADMIN_PROGRAMS, 'Programs / Events'],
        ['/national/certificates.html', 'Certificates'],
        ['/national/analytics.html', 'Analytics'],
        ['/national/leadership.html', 'Leadership'],
        [routes.ADMIN_SITE_CONTENT, 'Pages / Site Content'],
        [routes.ADMIN_MEDIA_UPLOAD, 'Media Upload'],
        ['/national/regional-permissions.html', 'Regional Permissions'],
        ['/national/security-command-center.html', 'Security'],
        ['/national/suspension-management.html', 'Suspensions'],
        [routes.VIEW_SITE, 'View Site'],
        ['#logout', 'Logout']
      ];
    }

    if (pathname.startsWith('/region-dashboard/')) {
      return [
        [routes.REGIONAL_DASHBOARD, 'Dashboard'],
        ['/region-dashboard/member-approval.html', 'Members'],
        ['/region-dashboard/payment-approvals.html', 'Payment Approvals'],
        ['/region-dashboard/dues-overview.html', 'Dues Overview'],
        ['/region-dashboard/donations.html', 'Donations'],
        ['/region-dashboard/agm-registrations.html', 'AGM'],
        [routes.REGIONAL_PROGRAMS, 'Programs / Events'],
        [routes.REGIONAL_MEDIA_UPLOAD, 'Media Upload'],
        ['/member-dashboard/regional-chat.html', 'Regional Chat'],
        ['/region-dashboard/waiver-management.html', 'Waivers'],
        [routes.VIEW_SITE, 'View Site'],
        ['#logout', 'Logout']
      ];
    }

    if (pathname.startsWith('/member-dashboard/') || pathname === '/member-dashboard.html' || pathname === '/profile.html' || pathname === '/dues.html' || pathname === '/payments.html' || pathname === '/certificates.html') {
      return [
        [routes.MEMBER_DASHBOARD, 'Dashboard'],
        [routes.MEMBER_ACCOUNT, 'My Account'],
        ['/member-dashboard/dues-payment.html', 'Dues Payment'],
        ['/payments.html', 'Payment History'],
        ['/member-dashboard/donate.html', 'Donate'],
        ['/member-dashboard/my-donations.html', 'My Donations'],
        ['/member-dashboard/agm-registration.html', 'AGM'],
        ['/member-dashboard/meetings.html', 'Meetings'],
        ['/member-dashboard/regional-chat.html', 'Regional Chat'],
        ['/certificates.html', 'Certificates'],
        ['/member-dashboard/waiver-request.html', 'Waiver Request'],
        [routes.MEMBER_VIEW_SITE, 'View Site'],
        ['#logout', 'Logout']
      ];
    }

    return [];
  }

  function getTopDashboardNavItems(pathname) {
    const routes = getRoutes();
    if (pathname.startsWith('/national/')) {
      return [
        [routes.ADMIN_DASHBOARD, 'Dashboard'],
        [routes.ADMIN_PROGRAMS, 'Programs / Events'],
        [routes.ADMIN_MEDIA_UPLOAD, 'Media Upload'],
        [routes.ADMIN_SITE_CONTENT, 'Pages / Site Content'],
        [routes.ADMIN_USERS, 'Users / Admins'],
        [routes.VIEW_SITE, 'View Site'],
        ['#logout', 'Logout']
      ];
    }

    if (pathname.startsWith('/region-dashboard/')) {
      return [
        [routes.REGIONAL_DASHBOARD, 'Dashboard'],
        [routes.REGIONAL_PROGRAMS, 'Programs / Events'],
        [routes.REGIONAL_MEDIA_UPLOAD, 'Media Upload'],
        ['/region-dashboard/member-approval.html', 'Members'],
        ['/region-dashboard/payment-approvals.html', 'Payments'],
        [routes.VIEW_SITE, 'View Site'],
        ['#logout', 'Logout']
      ];
    }

    if (pathname.startsWith('/member-dashboard/') || pathname === '/member-dashboard.html' || pathname === '/profile.html' || pathname === '/dues.html' || pathname === '/payments.html' || pathname === '/certificates.html') {
      return [
        [routes.MEMBER_DASHBOARD, 'Dashboard'],
        [routes.MEMBER_ACCOUNT, 'My Account'],
        [routes.MEMBER_VIEW_SITE, 'View Site'],
        ['#logout', 'Logout']
      ];
    }

    return [];
  }

  function normalizeDashboardNavigation() {
    const pathname = normalizePath(window.location.pathname);
    const items = getDashboardNavItems(pathname);
    if (!items.length) return;

    const navTargets = Array.from(document.querySelectorAll('.dashboard-sidebar .dashboard-nav, .navbar .dashboard-nav, .navbar .navbar-menu, .navbar-menu.dashboard-nav'));
    navTargets.forEach((nav) => {
      const isNavbar = nav.classList.contains('navbar-menu') || nav.closest('.navbar');
      const navItems = isNavbar ? getTopDashboardNavItems(pathname) : items;
      nav.innerHTML = navItems.map(([href, label]) => {
        const isLogout = href === '#logout';
        const active = !isLogout && normalizePath(href) === pathname ? ' active' : '';
        const className = isNavbar ? `navbar-link${active}` : `dashboard-nav-item${active}`;
        const attr = isLogout ? 'data-nav-logout="true"' : '';
        const link = `<a href="${href}" class="${className}" ${attr}><span aria-hidden="true"></span>${label}</a>`;
        return isNavbar && nav.tagName === 'UL' ? `<li>${link}</li>` : link;
      }).join('');
    });

    document.querySelectorAll('a[data-nav-logout="true"]').forEach((link) => {
      link.addEventListener('click', signOutAndRedirect);
    });
  }

  const PUBLIC_NAV_ITEMS = [
    { label: 'Home', href: '/index.html', key: 'home' },
    { label: 'About', href: '/about.html', key: 'about' },
    { label: 'Services / Programs', href: '/events.html', key: 'programs' },
    { label: 'Gallery / Media', href: '/gallery.html', key: 'gallery' },
    { label: 'Contact', href: '/contact.html', key: 'contact' },
    { label: 'Login', href: '/membership.html', key: 'login', button: true }
  ];

  function getGuestPublicNavItems(pathname) {
    if (pathname === '/membership.html') {
      return [
        { label: 'Home', href: '/index.html', key: 'home' },
        { label: 'About', href: '/about.html', key: 'about' },
        { label: 'Services / Programs', href: '/events.html', key: 'programs' },
        { label: 'Gallery / Media', href: '/gallery.html', key: 'gallery' },
        { label: 'Contact', href: '/contact.html', key: 'contact' },
        { label: 'Back to Site', href: '/index.html', key: 'backToSite', button: true }
      ];
    }

    return PUBLIC_NAV_ITEMS;
  }

  function getSignedInPublicNavItems(user) {
    const routes = getRoutes();
    const dashboard = getDashboardForUser(user);
    const roleGroup = getRoleGroup(user);

    if (roleGroup === 'national') {
      return [
        { label: 'Dashboard', href: dashboard, key: 'dashboard', button: true },
        { label: 'Members', href: routes.ADMIN_USERS, key: 'members' },
        { label: 'Donations', href: '/national/donations-overview.html', key: 'donations' },
        { label: 'AGM', href: '/national/agm-registrations.html', key: 'agm' },
        { label: 'View Site', href: routes.PUBLIC_HOME, key: 'publicSite' },
        { label: 'Logout', href: '#logout', key: 'logout', logout: true }
      ];
    }

    if (roleGroup === 'regional') {
      return [
        { label: 'Dashboard', href: dashboard, key: 'dashboard', button: true },
        { label: 'Members', href: '/region-dashboard/member-approval.html', key: 'members' },
        { label: 'Donations', href: '/region-dashboard/donations.html', key: 'donations' },
        { label: 'Chat', href: '/member-dashboard/regional-chat.html', key: 'chat' },
        { label: 'View Site', href: routes.PUBLIC_HOME, key: 'publicSite' },
        { label: 'Logout', href: '#logout', key: 'logout', logout: true }
      ];
    }

    return [
      { label: 'Dashboard', href: dashboard, key: 'dashboard', button: true },
      { label: 'Profile', href: routes.MEMBER_ACCOUNT, key: 'profile' },
      { label: 'Dues', href: '/member-dashboard/dues-payment.html', key: 'dues' },
      { label: 'Donations', href: '/member-dashboard/my-donations.html', key: 'donations' },
      { label: 'Chat', href: '/member-dashboard/regional-chat.html', key: 'chat' },
      { label: 'Logout', href: '#logout', key: 'logout', logout: true }
    ];
  }

  function renderPublicDashboardReturn(user) {
    if (!user || !isPublicPath(window.location.pathname) || isDashboardPath(window.location.pathname)) return;
    if (document.querySelector('[data-navigation-patch="dashboard-return"]')) return;

    const banner = document.createElement('div');
    banner.className = 'dashboard-return-bar';
    banner.dataset.navigationPatch = 'dashboard-return';
    banner.innerHTML = `
      <span>Signed in as ${escapeHtml(user.profile?.fullName || user.email || 'AMCAG member')}</span>
      <a href="${getDashboardForUser(user)}" class="navbar-cta">Back to Dashboard</a>
      <button type="button" class="navbar-link" data-nav-logout="true">Logout</button>
    `;

    const navbar = document.querySelector('.navbar');
    if (navbar && navbar.parentNode) {
      navbar.parentNode.insertBefore(banner, navbar.nextSibling);
    } else {
      document.body.insertBefore(banner, document.body.firstChild);
    }

    banner.querySelector('[data-nav-logout="true"]').addEventListener('click', signOutAndRedirect);
  }

  function installNavigationPatchStyles() {
    if (document.getElementById('navigation-patch-styles')) return;

    const style = document.createElement('style');
    style.id = 'navigation-patch-styles';
    style.textContent = `
      .dashboard-return-bar {
        display: flex;
        justify-content: flex-end;
        align-items: center;
        gap: 0.75rem;
        padding: 0.75rem clamp(1rem, 4vw, 2rem);
        background: var(--color-primary-95, #e6f7ec);
        color: var(--text-primary, #1a1c1e);
        border-bottom: 1px solid var(--border-color, rgba(0, 0, 0, 0.08));
        position: sticky;
        top: 0;
        z-index: 80;
      }

      .dashboard-return-bar span {
        margin-right: auto;
        font-weight: 600;
        font-size: 0.925rem;
      }

      .dashboard-return-bar .navbar-link {
        border: 0;
        background: transparent;
        cursor: pointer;
      }

      @media (max-width: 768px) {
        .dashboard-return-bar {
          justify-content: stretch;
          flex-wrap: wrap;
        }

        .dashboard-return-bar .navbar-cta,
        .dashboard-return-bar .navbar-link {
          flex: 1 1 140px;
          text-align: center;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function renderPublicNav() {
    const pathname = normalizePath(window.location.pathname);
    if (!isPublicPath(pathname) || isDashboardPath(pathname)) return;

    const publicNav = document.getElementById('publicNav') || document.querySelector('.navbar .navbar-menu');
    if (!publicNav) {
      console.warn('[Public Nav] #publicNav is missing');
      return;
    }

    publicNav.id = publicNav.id || 'publicNav';
    publicNav.classList.add('public-nav');
    const user = getCurrentUser();
    const items = user ? getSignedInPublicNavItems(user) : getGuestPublicNavItems(pathname);
    publicNav.innerHTML = items.map((item) => {
      const active = !item.logout && normalizePath(item.href) === pathname ? ' active' : '';
      const className = item.button ? `navbar-cta${active}` : `navbar-link${active}`;
      const attr = item.logout ? 'data-nav-logout="true"' : '';
      return `<li><a href="${item.href}" class="${className}" data-nav-key="${item.key}" ${attr}>${item.label}</a></li>`;
    }).join('');

    publicNav.querySelectorAll('[data-nav-logout="true"]').forEach((link) => {
      link.addEventListener('click', signOutAndRedirect);
    });

    document.querySelectorAll('.navbar-logo[href="/index.html"], .navbar-logo[href="/"], a.navbar-link[href="/index.html"]').forEach((link) => {
      if (user && link.textContent.trim().toLowerCase() === 'home') {
        link.href = getDashboardForUser(user);
      }
    });

    renderPublicDashboardReturn(user);
  }

  function refreshNavigationWhenAuthReady(retries = 40) {
    if (!window.AuthModule || typeof window.AuthModule.onAuthStateChanged !== 'function') {
      if (retries > 0) {
        setTimeout(() => refreshNavigationWhenAuthReady(retries - 1), 250);
      }
      return;
    }

    window.AuthModule.onAuthStateChanged(() => {
      renderPublicNav();
      normalizeDashboardNavigation();
    });
  }
  // ✅ NAVIGATION PATCH END
  
  // ===== SCROLL TO TOP =====
  function scrollToTop(smooth = true) {
    window.scrollTo({
      top: 0,
      behavior: smooth ? 'smooth' : 'auto'
    });
  }
  
  // ===== INIT UI MODULE =====
  function init() {
    // Close mobile menu when clicking outside
    document.addEventListener('click', (e) => {
      const navbar = document.querySelector('.navbar');
      const menu = document.querySelector('.navbar-menu');
      
      if (menu && navbar && menu.classList.contains('active') && 
          !navbar.contains(e.target)) {
        menu.classList.remove('active');
      }
    });

    // Show immediate loader feedback when users click dashboard/navbar tabs.
    installNavigationPatchStyles();
    renderPublicNav();
    normalizeDashboardNavigation();
    refreshNavigationWhenAuthReady();
    attachNavigationFeedback();
    
    console.log('UI module initialized');
  }
  
  // ===== PUBLIC API =====
  return {
    init,
    showLoader,
    hideLoader,
    showAlert,
    closeAlert,
    showModal,
    closeModal,
    confirm,
    formatDate,
    formatCurrency,
    formatNumber,
    debounce,
    throttle,
    copyToClipboard,
    validateForm,
    getFormData,
    resetForm,
    renderTable,
    renderPagination,
    toggleNavbar,
    renderPublicNav,
    scrollToTop
  };
})();

// Initialize UI module when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => UIModule.init());
} else {
  UIModule.init();
}

// Export to window
window.UIModule = UIModule;
