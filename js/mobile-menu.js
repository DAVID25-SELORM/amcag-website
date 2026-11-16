/* ================================================================
   AMCAG - Mobile Menu & Navigation Handler
   Responsive Navigation System for Mobile Devices
   ================================================================ */

(function() {
  'use strict';

  const MOBILE_BREAKPOINT = 768;
  let lastTouchToggleAt = 0;

  window.AMCAGToggleNavbar = function(toggle, event) {
    return toggleNavbarFromEvent(toggle, event);
  };

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMobileMenu);
  } else {
    initMobileMenu();
  }

  function initMobileMenu() {
    setupAllNavbars();
    
    // Handle dashboard sidebar for mobile
    setupDashboardSidebar();
    
    // Handle window resize
    handleWindowResize();
  }

  function setupAllNavbars() {
    document.querySelectorAll('.navbar').forEach(navbar => {
      const navbarContainer = navbar.querySelector('.navbar-container') || navbar;
      const menu = navbar.querySelector('.navbar-menu');
      if (!menu) return;

      let toggle = navbar.querySelector('.navbar-toggle');
      if (!toggle) {
        toggle = document.createElement('button');
        toggle.className = 'navbar-toggle';
        toggle.innerHTML = '<span></span><span></span><span></span>';
        navbarContainer.insertBefore(toggle, menu);
      }

      toggle.setAttribute('type', 'button');
      toggle.setAttribute('aria-label', 'Toggle navigation');
      toggle.setAttribute('aria-expanded', menu.classList.contains('active') ? 'true' : 'false');

      positionNavbarMenu(navbar, menu);

      if (toggle.dataset.mobileMenuBound !== '1') {
        toggle.dataset.mobileMenuBound = '1';

        toggle.addEventListener('touchend', (event) => {
          toggleNavbarFromEvent(toggle, event);
        }, { passive: false });

        toggle.addEventListener('click', (event) => {
          if (event.defaultPrevented) return;

          if (Date.now() - lastTouchToggleAt < 500) {
            event.preventDefault();
            event.stopPropagation();
            return;
          }

          toggleNavbarFromEvent(toggle, event);
        });
      }
    });

    if (document.body.dataset.mobileNavbarDelegated === '1') return;
    document.body.dataset.mobileNavbarDelegated = '1';

    document.addEventListener('click', (event) => {
      const toggle = event.target.closest('.navbar-toggle');
      if (toggle) {
        toggleNavbarFromEvent(toggle, event);
        return;
      }

      if (window.innerWidth > MOBILE_BREAKPOINT) return;

      const openMenu = document.querySelector('.navbar-menu.active');
      if (!openMenu) return;

      const openNavbar = openMenu.closest('.navbar');
      if (event.target.closest('.navbar-menu a')) {
        setNavbarState(openNavbar, openMenu, openNavbar && openNavbar.querySelector('.navbar-toggle'), false);
        return;
      }

      if (!event.target.closest('.navbar')) {
        setNavbarState(openNavbar, openMenu, openNavbar && openNavbar.querySelector('.navbar-toggle'), false);
      }
    });
  }

  function toggleNavbarFromEvent(toggle, event) {
    if (event && event.type === 'click' && Date.now() - lastTouchToggleAt < 500) {
      event.preventDefault();
      event.stopPropagation();
      return false;
    }

    if (event && event.type === 'touchend') {
      lastTouchToggleAt = Date.now();
    }

    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    const { navbar, menu } = getNavbarParts(toggle);
    if (!menu) return false;

    const isOpen = !menu.classList.contains('active');
    closeOtherNavbars(menu);
    setNavbarState(navbar, menu, toggle, isOpen);
    return false;
  }

  function getNavbarParts(toggle) {
    const navbar = toggle ? toggle.closest('.navbar') : document.querySelector('.navbar');
    const menu = navbar ? navbar.querySelector('.navbar-menu') : document.querySelector('.navbar-menu');

    return { navbar, menu };
  }

  function closeOtherNavbars(currentMenu) {
    document.querySelectorAll('.navbar-menu.active').forEach(menu => {
      if (menu === currentMenu) return;

      const navbar = menu.closest('.navbar');
      const toggle = navbar && navbar.querySelector('.navbar-toggle');
      setNavbarState(navbar, menu, toggle, false);
    });
  }

  function setNavbarState(navbar, menu, toggle, isOpen) {
    if (isOpen) {
      positionNavbarMenu(navbar, menu);
    }

    menu.classList.toggle('active', isOpen);

    if (toggle) {
      toggle.classList.toggle('active', isOpen);
      toggle.setAttribute('aria-expanded', String(isOpen));
    }

    if (navbar) {
      navbar.classList.toggle('menu-open', isOpen);
    }

    document.body.classList.toggle('navbar-menu-open', isOpen);
    document.body.style.overflow = isOpen && window.innerWidth <= MOBILE_BREAKPOINT ? 'hidden' : '';
  }

  function positionNavbarMenu(navbar, menu) {
    if (!navbar || !menu || window.innerWidth > MOBILE_BREAKPOINT) return;

    const navbarBottom = Math.max(60, Math.round(navbar.getBoundingClientRect().bottom));
    menu.style.setProperty('--mobile-nav-top', `${navbarBottom}px`);
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
      menuToggle.innerHTML = '&#9776;';
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
        if (window.innerWidth > MOBILE_BREAKPOINT) {
          const sidebar = document.querySelector('.dashboard-sidebar');
          const overlay = document.querySelector('.sidebar-overlay');

          document.querySelectorAll('.navbar-menu.active').forEach(menu => {
            const navbar = menu.closest('.navbar');
            setNavbarState(navbar, menu, navbar && navbar.querySelector('.navbar-toggle'), false);
          });

          if (sidebar) sidebar.classList.remove('active');
          if (overlay) overlay.classList.remove('active');
          document.body.style.overflow = '';

          // Remove mobile menu toggle if on desktop
          const mobileToggle = document.querySelector('.mobile-menu-toggle');
          if (mobileToggle) mobileToggle.remove();
          if (overlay) overlay.remove();
        } else {
          document.querySelectorAll('.navbar').forEach(navbar => {
            const menu = navbar.querySelector('.navbar-menu');
            if (menu) positionNavbarMenu(navbar, menu);
          });

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
      const navbar = menu && menu.closest('.navbar');
      const toggle = navbar && navbar.querySelector('.navbar-toggle');
      if (menu) setNavbarState(navbar, menu, toggle, true);
    },
    closeNavbar: function() {
      const menu = document.querySelector('.navbar-menu');
      const navbar = menu && menu.closest('.navbar');
      const toggle = navbar && navbar.querySelector('.navbar-toggle');
      if (menu) setNavbarState(navbar, menu, toggle, false);
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
