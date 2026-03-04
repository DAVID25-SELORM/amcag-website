// Suspension Check Module
// Checks if user or region is suspended and blocks access

const SuspensionCheckModule = (function() {
  
  // Check if user is suspended
  async function checkUserSuspension(userUid) {
    try {
      const db = firebase.firestore();
      const userDoc = await db.collection('users').doc(userUid).get();
      
      if (!userDoc.exists) {
        return { suspended: false };
      }

      const userData = userDoc.data();

      if (userData.suspended === true) {
        return {
          suspended: true,
          reason: userData.suspensionReason || 'Your account has been suspended',
          type: 'user'
        };
      }

      return { suspended: false };
    } catch (error) {
      console.error('Error checking user suspension:', error);
      return { suspended: false };
    }
  }

  // Check if region is suspended
  async function checkRegionSuspension(region) {
   if (!region) {
      return { suspended: false };
    }

    try {
      const db = firebase.firestore();
      const regionDoc = await db.collection('regions').doc(region).get();
      
      if (!regionDoc.exists) {
        return { suspended: false };
      }

      const regionData = regionDoc.data();

      if (regionData.suspended === true) {
        return {
          suspended: true,
          reason: regionData.suspensionReason || `The ${region} region has been suspended`,
          type: 'region'
        };
      }

      return { suspended: false };
    } catch (error) {
      console.error('Error checking region suspension:', error);
      return { suspended: false };
    }
  }

  // Check both user and region suspension
  async function checkAllSuspensions(userUid, region) {
    const userCheck = await checkUserSuspension(userUid);
    
    if (userCheck.suspended) {
      return userCheck;
    }

    const regionCheck = await checkRegionSuspension(region);
    
    if (regionCheck.suspended) {
      return regionCheck;
    }

    return { suspended: false };
  }

  // Show suspension message and block access
  function showSuspensionBlock(suspensionInfo) {
    // Clear page content
    document.body.innerHTML = '';
    
    // Create suspension message
    const container = document.createElement('div');
    container.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 2rem;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      font-family: 'Inter', sans-serif;
    `;

    const card = document.createElement('div');
    card.style.cssText = `
      background: white;
      border-radius: 16px;
      padding: 3rem;
      max-width: 500px;
      text-align: center;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    `;

    const icon = document.createElement('div');
    icon.style.cssText = `
      font-size: 4rem;
      margin-bottom: 1rem;
    `;
    icon.textContent = '🚫';

    const title = document.createElement('h1');
    title.style.cssText = `
      font-size: 1.75rem;
      font-weight: 700;
      margin-bottom: 1rem;
      color: #dc2626;
    `;
    title.textContent = suspensionInfo.type === 'user' ? 'Account Suspended' : 'Region Suspended';

    const message = document.createElement('p');
    message.style.cssText = `
      font-size: 1.125rem;
      line-height: 1.6;
      color: #4b5563;
      margin-bottom: 2rem;
    `;
    message.textContent = suspensionInfo.reason;

    const info = document.createElement('p');
    info.style.cssText = `
      font-size: 0.875rem;
      color: #6b7280;
      margin-bottom: 2rem;
    `;
    info.textContent = 'If you believe this is an error, please contact AMCAG national administration.';

    const contactInfo = document.createElement('div');
    contactInfo.style.cssText = `
      background: #f3f4f6;
      padding: 1rem;
      border-radius: 8px;
      margin-bottom: 1.5rem;
    `;
    contactInfo.innerHTML = `
      <p style="margin: 0; font-size: 0.875rem; color: #374151;"><strong>Contact:</strong></p>
      <p style="margin: 0.5rem 0 0; font-size: 0.875rem; color: #6b7280;">Association of Medicine Counter Assistants of Ghana</p>
      <p style="margin: 0.25rem 0 0; font-size: 0.875rem; color: #6b7280;">Email: info@amcag.org</p>
    `;

    const signOutBtn = document.createElement('button');
    signOutBtn.style.cssText = `
      background: #dc2626;
      color: white;
      padding: 0.75rem 2rem;
      border: none;
      border-radius: 8px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
    `;
    signOutBtn.textContent = 'Sign Out';
    signOutBtn.onmouseover = () => signOutBtn.style.background = '#b91c1c';
    signOutBtn.onmouseout = () => signOutBtn.style.background = '#dc2626';
    signOutBtn.onclick = () => {
      firebase.auth().signOut().then(() => {
        window.location.href = '/index.html';
      });
    };

    card.appendChild(icon);
    card.appendChild(title);
    card.appendChild(message);
    card.appendChild(info);
    card.appendChild(contactInfo);
    card.appendChild(signOutBtn);
    container.appendChild(card);
    document.body.appendChild(container);
  }

  // Initialize suspension check for member dashboard
  async function initMemberDashboardCheck() {
    const user = firebase.auth().currentUser;
    
    if (!user) {
      return;
    }

    try {
      const db = firebase.firestore();
      const userDoc = await db.collection('users').doc(user.uid).get();
      
      if (!userDoc.exists) {
        return;
      }

      const userData = userDoc.data();
      const suspensionCheck = await checkAllSuspensions(user.uid, userData.region);

      if (suspensionCheck.suspended) {
        showSuspensionBlock(suspensionCheck);
      }
    } catch (error) {
      console.error('Error in suspension check:', error);
    }
  }

  // Initialize suspension check for regional dashboard
  async function initRegionalDashboardCheck() {
    const user = firebase.auth().currentUser;
    
    if (!user) {
      return;
    }

    try {
      const db = firebase.firestore();
      const userDoc = await db.collection('users').doc(user.uid).get();
      
      if (!userDoc.exists) {
        return;
      }

      const userData = userDoc.data();

      // Check regional dashboards for region suspension only (not user)
      const regionCheck = await checkRegionSuspension(userData.region);

      if (regionCheck.suspended) {
        showSuspensionBlock(regionCheck);
        return;
      }

      // Also check user suspension
      const userCheck = await checkUserSuspension(user.uid);

      if (userCheck.suspended) {
        showSuspensionBlock(userCheck);
      }
    } catch (error) {
      console.error('Error in suspension check:', error);
    }
  }

  // Public API
  return {
    checkUserSuspension,
    checkRegionSuspension,
    checkAllSuspensions,
    initMemberDashboardCheck,
    initRegionalDashboardCheck,
    showSuspensionBlock
  };
})();
