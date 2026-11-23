/* AMCAG premium navigation: scroll shadow + keep the active dashboard tab in view. */
(function () {
  'use strict';

  function updateScrolled() {
    var scrolled = (window.pageYOffset || document.documentElement.scrollTop || 0) > 6;
    var bars = document.querySelectorAll('.navbar');
    for (var i = 0; i < bars.length; i++) bars[i].classList.toggle('is-scrolled', scrolled);
  }

  function centerActiveTab() {
    var sidebar = document.querySelector('.dashboard-sidebar');
    var active = sidebar && sidebar.querySelector('.dashboard-nav-item.active');
    if (!sidebar || !active) return;
    if (sidebar.scrollWidth <= sidebar.clientWidth + 2) return; // not a scrolling strip
    var target = active.offsetLeft - (sidebar.clientWidth - active.offsetWidth) / 2;
    sidebar.scrollLeft = Math.max(0, target);
  }

  function init() {
    updateScrolled();
    window.addEventListener('scroll', updateScrolled, { passive: true });
    centerActiveTab();
    window.addEventListener('load', centerActiveTab);
    window.addEventListener('resize', centerActiveTab);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
