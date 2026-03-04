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
  
  // ===== SCROLL TO TOP =====
  function scrollToTop(smooth = true) {
    window.scrollTo({
      top: 0,
      behavior: smooth ? 'smooth' : 'auto'
    });
  }
  
  // ===== INIT UI MODULE =====
  function init() {
    // Add mobile navbar toggle listener
    const navbarToggle = document.querySelector('.navbar-toggle');
    if (navbarToggle) {
      navbarToggle.addEventListener('click', toggleNavbar);
    }
    
    // Close mobile menu when clicking outside
    document.addEventListener('click', (e) => {
      const navbar = document.querySelector('.navbar');
      const menu = document.querySelector('.navbar-menu');
      
      if (menu && menu.classList.contains('active') && 
          !navbar.contains(e.target)) {
        menu.classList.remove('active');
      }
    });
    
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
