// ================================================================
// AMCAG payment routing configuration
// Public labels only. Secret API keys stay in Firebase Functions env.
// ================================================================

const AMCAGPaymentConfig = (function() {
  'use strict';

  const ACCOUNTS = {
    national: {
      scope: 'national',
      owner: 'AMCAG National',
      label: 'National / AGM payments'
    },
    greaterAccra: {
      scope: 'greater_accra',
      owner: 'AMCAG Greater Accra',
      label: 'Greater Accra payments'
    }
  };

  function normalizeRegion(region) {
    return String(region || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  function resolveAccount({ type = '', region = '' } = {}) {
    const normalizedType = String(type || '').trim().toLowerCase();

    if (normalizedType === 'agm_registration') {
      return ACCOUNTS.national;
    }

    if (normalizeRegion(region) === 'greater accra') {
      return ACCOUNTS.greaterAccra;
    }

    return ACCOUNTS.national;
  }

  return {
    ACCOUNTS,
    resolveAccount
  };
})();

window.AMCAGPaymentConfig = AMCAGPaymentConfig;
