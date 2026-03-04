/* ================================================================
   AMCAG - Mobile Menu & Navigation Handler
   Responsive Navigation System for Mobile Devices
   ================================================================ */

(function() {
  'use strict';

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMobileMenu);
  } else {
    initMobileMenu();
  }

  function initMobileMenu() {
    // Create mobile navigation toggle if it doesn't exist
    createMobileToggle();
    
    // Handle existing navbar for mobile
    setupNavbarMobile();
    
    // Handle dashboard sidebar for mobile
    setupDashboardSidebar();
    
    // Handle window resize
    handleWindowResize();
  }

  function createMobileToggle() {
    const navbar = document.querySelector('.navbar');
    if (!navbar) return;

    const navbarContainer = navbar.querySelector('.navbar-container');
    if (!navbarContainer) return;

    // Check if toggle already exists
    if (navbarContainer.querySelector('.navbar-toggle')) return;

    // Create toggle button
    const toggle = document.createElement('button');
    toggle.className = 'navbar-toggle';
    toggle.setAttribute('aria-label', 'Toggle navigation');
    toggle.innerHTML = `
      <span></span>
      <span></span>
      <span></span>
    `;

    // Add toggle functionality
    toggle.addEventListener('click', () => {
      const menu = navbarContainer.querySelector('.navbar-menu');
      if (menu) {
        menu.classList.toggle('active');
        toggle.classList.toggle('active');
        document.body.style.overflow = menu.classList.contains('active') ? 'hidden' : '';
      }
    });

    // Insert toggle before navbar menu
    const menu = navbarContainer.querySelector('.navbar-menu');
    if (menu) {
      navbarContainer.insertBefore(toggle, menu);
    }
  }

  function setupNavbarMobile() {
    const navbarMenu = document.querySelector('.navbar-menu');
    if (!navbarMenu) return;

    // Close menu when clicking a link
    const links = navbarMenu.querySelectorAll('.navbar-link');
    links.forEach(link => {
      link.addEventListener('click', () => {
        if (window.innerWidth <= 768) {
          navbarMenu.classList.remove('active');
          const toggle = document.querySelector('.navbar-toggle');
          if (toggle) toggle.classList.remove('active');
          document.body.style.overflow = '';
        }
      });
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
      if (window.innerWidth <= 768) {
        const navbar = document.querySelector('.navbar');
        if (navbar && !navbar.contains(e.target)) {
          navbarMenu.classList.remove('active');
          const toggle = document.querySelector('.navbar-toggle');
          if (toggle) toggle.classList.remove('active');
          document.body.style.overflow = '';
        }
      }
    });
  }

  function setupDashboardSidebar() {
    const sidebar = document.querySelector('.dashboard-sidebar');
    if (!sidebar) return;

    // Create overlay for mobile sidebar
    let overlay = document.querySelector('.sidebar-overlay');
    if (!overlay && window.innerWidth <= 768) {
      overlay = document.createElement('div');
      overlay.className = 'sidebar-overlay';
      document.body.appendChild(overlay);

      overlay.addEventListener('click', () => {
        sidebar.classList.remove('active');
        overlay.classList.remove('active');
        document.body.style.overflow = '';
      });
    }

    // Create mobile menu toggle button for dashboard
    let menuToggle = document.querySelector('.mobile-menu-toggle');
    if (!menuToggle && window.innerWidth <= 768) {
      menuToggle = document.createElement('button');
      menuToggle.className = 'mobile-menu-toggle';
      menuToggle.innerHTML = '☰';
      menuToggle.setAttribute('aria-label', 'Toggle sidebar');
      document.body.appendChild(menuToggle);

      menuToggle.addEventListener('click', () => {
        sidebar.classList.toggle('active');
        if (overlay) {
          overlay.classList.toggle('active');
        }
        document.body.style.overflow = sidebar.classList.contains('active') ? 'hidden' : '';
      });
    }

    // Close sidebar when clicking a nav item on mobile
    const navItems = sidebar.querySelectorAll('.dashboard-nav-item, .sidebar-link');
    navItems.forEach(item => {
      item.addEventListener('click', () => {
        if (window.innerWidth <= 768) {
          sidebar.classList.remove('active');
          if (overlay) overlay.classList.remove('active');
          document.body.style.overflow = '';
        }
      });
    });
  }

  function handleWindowResize() {
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        // Reset mobile menu on resize to desktop
        if (window.innerWidth > 768) {
          const navbarMenu = document.querySelector('.navbar-menu');
          const toggle = document.querySelector('.navbar-toggle');
          const sidebar = document.querySelector('.dashboard-sidebar');
          const overlay = document.querySelector('.sidebar-overlay');

          if (navbarMenu) navbarMenu.classList.remove('active');
          if (toggle) toggle.classList.remove('active');
          if (sidebar) sidebar.classList.remove('active');
          if (overlay) overlay.classList.remove('active');
          document.body.style.overflow = '';

          // Remove mobile menu toggle if on desktop
          const mobileToggle = document.querySelector('.mobile-menu-toggle');
          if (mobileToggle) mobileToggle.remove();
          if (overlay) overlay.remove();
        } else {
          // Recreate mobile elements if switching back to mobile
          setupDashboardSidebar();
        }
      }, 250);
    });
  }

  // Touch swipe to close mobile menu
  let touchStartX = 0;
  let touchEndX = 0;

  document.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
  });

  document.addEventListener('touchend', (e) => {
    touchEndX = e.changedTouches[0].screenX;
    handleSwipe();
  });

  function handleSwipe() {
    const sidebar = document.querySelector('.dashboard-sidebar');
    const overlay = document.querySelector('.sidebar-overlay');

    if (sidebar && sidebar.classList.contains('active')) {
      // Swipe left to close
      if (touchStartX - touchEndX > 50) {
        sidebar.classList.remove('active');
        if (overlay) overlay.classList.remove('active');
        document.body.style.overflow = '';
      }
    }
  }

  // Prevent scroll on body when menu is open
  function preventScroll(e) {
    const navbarMenu = document.querySelector('.navbar-menu');
    const sidebar = document.querySelector('.dashboard-sidebar');
    
    if ((navbarMenu && navbarMenu.classList.contains('active')) ||
        (sidebar && sidebar.classList.contains('active'))) {
      if (!e.target.closest('.navbar-menu') && !e.target.closest('.dashboard-sidebar')) {
        e.preventDefault();
      }
    }
  }

  document.addEventListener('touchmove', preventScroll, { passive: false });

  // Expose global functions for manual control
  window.AMCAG = window.AMCAG || {};
  window.AMCAG.mobileMenu = {
    openNavbar: function() {
      const menu = document.querySelector('.navbar-menu');
      const toggle = document.querySelector('.navbar-toggle');
      if (menu) menu.classList.add('active');
      if (toggle) toggle.classList.add('active');
    },
    closeNavbar: function() {
      const menu = document.querySelector('.navbar-menu');
      const toggle = document.querySelector('.navbar-toggle');
      if (menu) menu.classList.remove('active');
      if (toggle) toggle.classList.remove('active');
      document.body.style.overflow = '';
    },
    toggleNavbar: function() {
      const menu = document.querySelector('.navbar-menu');
      if (menu && menu.classList.contains('active')) {
        this.closeNavbar();
      } else {
        this.openNavbar();
      }
    },
    openSidebar: function() {
      const sidebar = document.querySelector('.dashboard-sidebar');
      const overlay = document.querySelector('.sidebar-overlay');
      if (sidebar) sidebar.classList.add('active');
      if (overlay) overlay.classList.add('active');
    },
    closeSidebar: function() {
      const sidebar = document.querySelector('.dashboard-sidebar');
      const overlay = document.querySelector('.sidebar-overlay');
      if (sidebar) sidebar.classList.remove('active');
      if (overlay) overlay.classList.remove('active');
      document.body.style.overflow = '';
    },
    toggleSidebar: function() {
      const sidebar = document.querySelector('.dashboard-sidebar');
      if (sidebar && sidebar.classList.contains('active')) {
        this.closeSidebar();
      } else {
        this.openSidebar();
      }
    }
  };

})();
