// ================================================================
// AMCAG AGM 2026 Module
// Registration, reporting, and payment status tools
// ================================================================

const AGMModule = (function() {
  'use strict';

  const EVENT = {
    id: 'agm-2026',
    title: '2026 Annual General Meeting',
    organizer: 'Association of Medicine Counter Assistants, Ghana',
    shortName: 'AMCAG',
    theme: 'Empowering MCAs for Sustainable Growth and Improved Welfare - The Role of AMCAG',
    dateLabel: '10th - 11th July, 2026',
    startsAt: '2026-07-10T09:00:00',
    venue: 'PCG Ascension Presbyterian Church Hall, Koforidua, Eastern Region',
    fee: 60,
    shortcode: '*713*4380#',
    shortcodeDial: 'tel:*713*4380%23',
    contacts: ['0246 325 910', '0547 904 727', '055 867 2187']
  };

  const REGIONS = [
    'Ahafo',
    'Ashanti',
    'Bono',
    'Bono East',
    'Central',
    'Eastern',
    'Greater Accra',
    'North East',
    'Northern',
    'Oti',
    'Savannah',
    'Upper East',
    'Upper West',
    'Volta',
    'Western',
    'Western North'
  ];

  let dashboardState = {
    scope: 'national',
    records: [],
    filtered: [],
    user: null
  };

  function db() {
    return firebase.firestore();
  }

  function timestampNow() {
    return firebase.firestore.FieldValue.serverTimestamp();
  }

  function normalizeRegionId(region) {
    return String(region || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'unknown';
  }

  function normalizeEmail(email) {
    return String(email || '').trim().toLowerCase();
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function parseDate(value) {
    if (!value) return null;
    if (typeof value.toDate === 'function') return value.toDate();
    if (value instanceof Date) return value;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function formatDate(value) {
    const date = parseDate(value);
    if (!date) return 'Not recorded';
    return date.toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  function formatCurrency(amount) {
    return `GHS ${Number(amount || 0).toFixed(2)}`;
  }

  function setText(selector, value) {
    const element = document.querySelector(selector);
    if (element) element.textContent = value;
  }

  function setStatus(message, type = 'info') {
    const status = document.getElementById('agm-status');
    if (!status) return;

    status.className = `alert alert-${type}`;
    status.style.display = 'flex';
    status.innerHTML = `<div class="alert-content"><div class="alert-message">${escapeHtml(message)}</div></div>`;
  }

  function populateRegionOptions(select) {
    if (!select) return;

    const currentValue = select.value;
    select.innerHTML = '<option value="">Select region</option>' +
      REGIONS.map(region => `<option value="${escapeHtml(region)}">${escapeHtml(region)}</option>`).join('');

    if (currentValue) select.value = currentValue;
  }

  function populateAllRegionSelects() {
    document.querySelectorAll('[data-agm-region-select]').forEach(populateRegionOptions);
  }

  function generatePaymentReference(region) {
    const regionCode = normalizeRegionId(region).slice(0, 3).toUpperCase().padEnd(3, 'X');
    const timePart = Date.now().toString(36).toUpperCase();
    const randomPart = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `AGM2026-${regionCode}-${timePart}-${randomPart}`;
  }

  function resolveAgmPaymentAccount() {
    if (window.AMCAGPaymentConfig && typeof window.AMCAGPaymentConfig.resolveAccount === 'function') {
      return window.AMCAGPaymentConfig.resolveAccount({ type: 'agm_registration' });
    }

    return {
      scope: 'national',
      owner: 'AMCAG National'
    };
  }

  function getAuthUser() {
    return new Promise((resolve) => {
      const auth = firebase.auth();
      const existing = auth.currentUser;
      if (existing) {
        resolve(existing);
        return;
      }

      const unsubscribe = auth.onAuthStateChanged((user) => {
        unsubscribe();
        resolve(user);
      });
    });
  }

  async function getUserProfile(uid) {
    const doc = await db().collection('users').doc(uid).get();
    return doc.exists ? doc.data() : {};
  }

  function formValue(form, name) {
    return String(form.elements[name]?.value || '').trim();
  }

  async function findExistingRegistration(uid) {
    const snapshot = await db().collection('agmRegistrations')
      .where('memberUid', '==', uid)
      .limit(10)
      .get();

    const doc = snapshot.docs.find(item => item.data().eventId === EVENT.id);
    if (!doc) return null;
    return { id: doc.id, ...doc.data() };
  }

  async function initRegistrationPage() {
    populateAllRegionSelects();

    try {
      const feeDoc = await db().collection('system_settings').doc('fees').get();
      const configuredFee = Number(feeDoc.data()?.registrationFee);
      if (feeDoc.exists && Number.isFinite(configuredFee) && configuredFee > 0) {
        EVENT.fee = Number(configuredFee.toFixed(2));
      }
    } catch (error) {
      console.warn('Using default registration fee:', error.message);
    }

    setText('[data-agm-date]', EVENT.dateLabel);
    setText('[data-agm-theme]', EVENT.theme);
    setText('[data-agm-venue]', EVENT.venue);
    setText('[data-agm-fee]', formatCurrency(EVENT.fee));
    setText('[data-agm-shortcode]', EVENT.shortcode);

    const form = document.getElementById('agm-registration-form');
    const submitButton = document.getElementById('agm-submit-button');
    const user = await getAuthUser();

    if (!user) {
      window.location.href = '/membership.html?next=/member-dashboard/agm-registration.html';
      return;
    }

    if (!user.emailVerified) {
      setStatus('Please verify your email address before registering for AGM 2026.', 'warning');
      setTimeout(() => {
        window.location.href = '/membership.html?verified=false';
      }, 1200);
      return;
    }

    const profile = await getUserProfile(user.uid);
    fillMemberForm(form, user, profile);
    if (form.elements.email) {
      form.elements.email.value = user.email || '';
      form.elements.email.readOnly = true;
    }

    const existing = await findExistingRegistration(user.uid);
    if (existing) renderExistingRegistration(existing);

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      submitButton.disabled = true;
      submitButton.textContent = 'Saving registration...';

      try {
        const registration = await submitRegistration(form, user, profile);
        renderRegistrationResult(registration);
        setStatus('Registration saved. Your AGM payment is pending until Hubtel confirmation or executive verification.', 'success');

      } catch (error) {
        console.error('AGM registration failed:', error);
        setStatus(error.message || 'Unable to submit AGM registration. Please try again.', 'error');
      } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Register for AGM 2026';
      }
    });
  }

  function fillMemberForm(form, user, profile) {
    if (!form) return;

    const mappings = {
      fullName: profile.fullName || profile.name || user.displayName || '',
      phone: profile.phone || profile.phoneNumber || '',
      email: profile.email || user.email || '',
      region: profile.region || '',
      district: profile.district || profile.city || '',
      memberId: profile.memberId || profile.membershipId || '',
      facilityName: profile.facilityName || profile.pharmacyName || profile.currentWorkplace || '',
      position: profile.position || profile.roleTitle || profile.occupation || 'Member',
      emergencyContact: profile.emergencyContact || profile.nextOfKin?.contact || ''
    };

    Object.entries(mappings).forEach(([name, value]) => {
      if (form.elements[name] && value) {
        form.elements[name].value = value;
      }
    });

    document.querySelectorAll('[data-agm-member-field]').forEach((element) => {
      const field = element.dataset.agmMemberField;
      element.textContent = mappings[field] || 'Not available';
    });
  }

  async function submitRegistration(form, user, profile) {
    const fullName = formValue(form, 'fullName');
    const phone = formValue(form, 'phone');
    const email = normalizeEmail(user.email);
    const region = formValue(form, 'region');
    const district = formValue(form, 'district');
    const facilityName = formValue(form, 'facilityName');
    const memberId = formValue(form, 'memberId');
    const position = formValue(form, 'position');
    const emergencyContact = formValue(form, 'emergencyContact');

    if (!user.emailVerified) {
      throw new Error('Please verify your email address before registering for AGM 2026.');
    }

    if (!fullName || !phone || !email || !region) {
      throw new Error('Your membership profile is missing a name, phone number, or region. Please update your profile before registering.');
    }

    const existing = await findExistingRegistration(user.uid);
    if (existing && existing.paymentStatus === 'paid') {
      throw new Error('You are already registered and marked as paid for AGM 2026.');
    }

    const registrationId = existing?.id || db().collection('agmRegistrations').doc().id;
    const regionId = normalizeRegionId(region);
    const paymentReference = existing?.paymentReference || generatePaymentReference(region);
    const paymentAccount = resolveAgmPaymentAccount();

    const registrationData = {
      fullName,
      phone,
      email,
      region,
      regionId,
      district,
      facilityName,
      memberId,
      memberUid: user.uid,
      position,
      emergencyContact,
      eventId: EVENT.id,
      eventTitle: EVENT.title,
      eventTheme: EVENT.theme,
      eventDate: EVENT.dateLabel,
      eventVenue: EVENT.venue,
      registrationFee: EVENT.fee,
      paymentStatus: existing?.paymentStatus || 'pending',
      paymentAccountScope: paymentAccount.scope,
      paymentAccountOwner: paymentAccount.owner,
      hubtelTransactionId: existing?.hubtelTransactionId || '',
      paymentReference,
      updatedAt: timestampNow()
    };

    if (!existing) {
      registrationData.registeredAt = timestampNow();
    }

    const regionMemberData = {
      uid: user.uid,
      fullName,
      phone,
      email,
      region,
      regionId,
      district,
      facilityName,
      memberId,
      position,
      updatedAt: timestampNow()
    };

    const batch = db().batch();
    const centralRef = db().collection('agmRegistrations').doc(registrationId);
    const regionMemberRef = db().collection('regions').doc(regionId).collection('members').doc(user.uid);
    const regionalRegistrationRef = db().collection('regions').doc(regionId).collection('agmRegistrations').doc(registrationId);

    batch.set(centralRef, registrationData, { merge: true });
    batch.set(regionMemberRef, regionMemberData, { merge: true });
    batch.set(regionalRegistrationRef, registrationData, { merge: true });
    await batch.commit();

    return { id: registrationId, ...registrationData };
  }

  function renderExistingRegistration(registration) {
    const panel = document.getElementById('agm-existing-registration');
    if (!panel) return;

    panel.style.display = 'block';
    panel.innerHTML = registrationSummaryHtml(registration, 'Your current AGM registration') + paymentActionsHtml(registration);
    bindHubtelCheckout(panel, registration);
  }

  function renderRegistrationResult(registration) {
    const panel = document.getElementById('agm-registration-result');
    if (!panel) return;

    panel.style.display = 'block';
    panel.innerHTML = registrationSummaryHtml(registration, 'Registration saved') + paymentActionsHtml(registration);
    bindHubtelCheckout(panel, registration);
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function paymentActionsHtml(registration) {
    const paymentButton = String(registration.paymentStatus || '').toLowerCase() === 'paid'
      ? ''
      : '<button type="button" class="btn btn-primary" data-hubtel-checkout>Pay securely with Hubtel</button>';
    return `
      <div class="flex gap-2 mt-3" style="flex-wrap: wrap;">
        ${paymentButton}
        <a href="${EVENT.shortcodeDial}" class="btn btn-outline">Use Hubtel shortcode</a>
        <a href="/member-dashboard.html" class="btn btn-outline">Back to dashboard</a>
      </div>
    `;
  }

  function bindHubtelCheckout(container, registration) {
    const button = container.querySelector('[data-hubtel-checkout]');
    if (!button) return;

    button.addEventListener('click', async () => {
      button.disabled = true;
      button.textContent = 'Opening Hubtel checkout...';
      try {
        const initiateCheckout = firebase.functions().httpsCallable('initiateHubtelCheckout');
        const result = await initiateCheckout({registrationId: registration.id});
        const checkoutUrl = result?.data?.checkoutUrl;
        if (!checkoutUrl) throw new Error('Hubtel checkout URL was not returned.');
        window.location.href = checkoutUrl;
      } catch (error) {
        console.error('Unable to initiate Hubtel checkout:', error);
        setStatus(error.message || 'Unable to initiate Hubtel checkout. Please try again.', 'error');
        button.disabled = false;
        button.textContent = 'Pay securely with Hubtel';
      }
    });
  }

  function registrationSummaryHtml(registration, title) {
    return `
      <h3 class="card-title">${escapeHtml(title)}</h3>
      <div class="grid grid-2 gap-3 mt-3">
        <div>
          <div style="color: var(--text-secondary); font-size: var(--text-sm);">Payment reference</div>
          <div style="font-family: monospace; font-weight: 700;">${escapeHtml(registration.paymentReference)}</div>
        </div>
        <div>
          <div style="color: var(--text-secondary); font-size: var(--text-sm);">Payment status</div>
          ${statusBadge(registration.paymentStatus)}
        </div>
        <div>
          <div style="color: var(--text-secondary); font-size: var(--text-sm);">Hubtel shortcode</div>
          <div style="font-weight: 700;">${escapeHtml(EVENT.shortcode)}</div>
        </div>
        <div>
          <div style="color: var(--text-secondary); font-size: var(--text-sm);">Amount</div>
          <div style="font-weight: 700;">${formatCurrency(registration.registrationFee)}</div>
        </div>
      </div>
    `;
  }

  function statusBadge(status) {
    const value = String(status || 'pending').toLowerCase();
    const classes = {
      paid: 'badge-success',
      pending: 'badge-warning',
      failed: 'badge-error',
      cancelled: 'badge-error'
    };
    return `<span class="badge ${classes[value] || 'badge-warning'}">${escapeHtml(value)}</span>`;
  }

  async function initDashboard(scope = 'national') {
    populateAllRegionSelects();
    dashboardState.scope = scope;

    const user = await getAuthUser();
    if (!user) {
      window.location.href = '/membership.html';
      return;
    }

    const profile = await getUserProfile(user.uid);
    dashboardState.user = { uid: user.uid, email: user.email, profile };

    const allowed = ['super_admin', 'national_executive', 'regional_executive'];
    if (!allowed.includes(profile.role)) {
      // ✅ NAVIGATION PATCH START
      const routes = window.AMCAG_ROUTES || {};
      window.location.href = routes.MEMBER_DASHBOARD || '/member-dashboard.html';
      // ✅ NAVIGATION PATCH END
      return;
    }

    const regionFilter = document.getElementById('filter-region');
    if (scope === 'regional') {
      if (profile.role === 'regional_executive') {
        regionFilter.value = profile.region || '';
        regionFilter.disabled = true;
      }
      setText('[data-dashboard-region]', profile.region || 'Regional');
    }

    bindDashboardFilters();
    await loadDashboardRegistrations();
  }

  function bindDashboardFilters() {
    ['filter-region', 'filter-status', 'filter-start', 'filter-end', 'filter-search'].forEach(id => {
      const element = document.getElementById(id);
      if (!element || element.dataset.agmBound === '1') return;
      element.dataset.agmBound = '1';
      element.addEventListener('input', applyDashboardFilters);
      element.addEventListener('change', applyDashboardFilters);
    });

    const csvButton = document.getElementById('export-csv');
    if (csvButton) csvButton.addEventListener('click', exportCsv);

    const pdfButton = document.getElementById('export-pdf');
    if (pdfButton) pdfButton.addEventListener('click', printDashboardReport);
  }

  async function loadDashboardRegistrations() {
    const tableBody = document.getElementById('agm-registrations-table');
    if (tableBody) {
      tableBody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:2rem;">Loading AGM registrations...</td></tr>';
    }

    let query = db().collection('agmRegistrations').limit(1000);
    const userProfile = dashboardState.user?.profile || {};

    if (dashboardState.scope === 'regional' && userProfile.role === 'regional_executive' && userProfile.region) {
      query = db().collection('agmRegistrations').where('region', '==', userProfile.region).limit(1000);
    }

    const snapshot = await query.get();
    dashboardState.records = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    dashboardState.records.sort((a, b) => (parseDate(b.registeredAt)?.getTime() || 0) - (parseDate(a.registeredAt)?.getTime() || 0));
    applyDashboardFilters();
  }

  function applyDashboardFilters() {
    const region = document.getElementById('filter-region')?.value || '';
    const status = document.getElementById('filter-status')?.value || '';
    const start = document.getElementById('filter-start')?.valueAsDate || null;
    const end = document.getElementById('filter-end')?.valueAsDate || null;
    const search = String(document.getElementById('filter-search')?.value || '').trim().toLowerCase();

    dashboardState.filtered = dashboardState.records.filter(record => {
      if (region && record.region !== region) return false;
      if (status && record.paymentStatus !== status) return false;

      const registeredAt = parseDate(record.registeredAt);
      if (start && registeredAt && registeredAt < start) return false;
      if (end && registeredAt) {
        const inclusiveEnd = new Date(end);
        inclusiveEnd.setHours(23, 59, 59, 999);
        if (registeredAt > inclusiveEnd) return false;
      }

      if (search) {
        const haystack = [record.fullName, record.phone, record.email, record.paymentReference, record.region]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(search)) return false;
      }

      return true;
    });

    renderDashboard();
  }

  function renderDashboard() {
    const records = dashboardState.filtered;
    const paid = records.filter(item => item.paymentStatus === 'paid');
    const pending = records.filter(item => item.paymentStatus === 'pending');
    const amount = paid.reduce((sum, item) => sum + Number(item.registrationFee || 0), 0);

    setText('#total-registrations', String(records.length));
    setText('#paid-registrations', String(paid.length));
    setText('#pending-registrations', String(pending.length));
    setText('#paid-amount', formatCurrency(amount));

    const tableBody = document.getElementById('agm-registrations-table');
    if (!tableBody) return;

    if (!records.length) {
      tableBody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:2rem;">No AGM registrations found.</td></tr>';
      return;
    }

    tableBody.innerHTML = records.map(record => `
      <tr>
        <td>
          <div style="font-weight: 700;">${escapeHtml(record.fullName)}</div>
          <div style="font-size: var(--text-sm); color: var(--text-secondary);">${escapeHtml(record.memberId || 'No member ID')}</div>
        </td>
        <td>
          <div>${escapeHtml(record.phone)}</div>
          <div style="font-size: var(--text-sm); color: var(--text-secondary);">${escapeHtml(record.email)}</div>
        </td>
        <td>${escapeHtml(record.region || '')}</td>
        <td>${escapeHtml(record.district || '')}</td>
        <td>${escapeHtml(record.facilityName || '')}</td>
        <td><span style="font-family: monospace;">${escapeHtml(record.paymentReference || '')}</span></td>
        <td>${statusBadge(record.paymentStatus)}</td>
        <td>${formatDate(record.registeredAt)}</td>
        <td>
          <select class="form-input" data-status-id="${escapeHtml(record.id)}" style="min-width: 130px;">
            ${['pending', 'paid', 'failed', 'cancelled'].map(status => `<option value="${status}" ${record.paymentStatus === status ? 'selected' : ''}>${status}</option>`).join('')}
          </select>
        </td>
      </tr>
    `).join('');

    tableBody.querySelectorAll('[data-status-id]').forEach(select => {
      select.addEventListener('change', async () => {
        const id = select.getAttribute('data-status-id');
        const status = select.value;
        select.disabled = true;
        try {
          await updatePaymentStatus(id, status);
          if (window.UIModule?.showAlert) UIModule.showAlert('AGM payment status updated', 'success');
          await loadDashboardRegistrations();
        } catch (error) {
          console.error('Unable to update AGM payment status:', error);
          if (window.UIModule?.showAlert) UIModule.showAlert(error.message || 'Unable to update status', 'error');
          select.disabled = false;
        }
      });
    });
  }

  async function updatePaymentStatus(id, status) {
    const record = dashboardState.records.find(item => item.id === id);
    if (!record) throw new Error('Registration not found.');

    const user = dashboardState.user;
    const profile = user?.profile || {};
    if (profile.role === 'regional_executive' && record.region !== profile.region) {
      throw new Error('Regional executives can only update their own region.');
    }

    const updates = {
      paymentStatus: status,
      updatedAt: timestampNow(),
      paymentVerifiedBy: user.uid,
      paymentVerifiedByEmail: user.email || ''
    };

    if (status === 'paid') {
      updates.paidAt = timestampNow();
    }

    const batch = db().batch();
    const centralRef = db().collection('agmRegistrations').doc(id);
    const regionRef = db().collection('regions').doc(record.regionId || normalizeRegionId(record.region)).collection('agmRegistrations').doc(id);
    batch.update(centralRef, updates);
    batch.set(regionRef, updates, { merge: true });
    await batch.commit();
  }

  function exportCsv() {
    const headers = [
      'Full name',
      'Phone',
      'Email',
      'Region',
      'District/City',
      'Facility/Pharmacy',
      'Member ID',
      'Position',
      'Payment status',
      'Payment reference',
      'Registered at'
    ];

    const rows = dashboardState.filtered.map(record => [
      record.fullName,
      record.phone,
      record.email,
      record.region,
      record.district,
      record.facilityName,
      record.memberId,
      record.position,
      record.paymentStatus,
      record.paymentReference,
      formatDate(record.registeredAt)
    ]);

    const csv = [headers, ...rows]
      .map(row => row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `agm-2026-registrations-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function printDashboardReport() {
    window.print();
  }

  return {
    EVENT,
    REGIONS,
    normalizeRegionId,
    initRegistrationPage,
    initDashboard,
    populateAllRegionSelects
  };
})();
