/**
 * Injects a user avatar into any navbar that has a Profile link.
 * Works on both horizontal navbars and sidebar-layout pages.
 */
(function () {
  const AVATAR_ID = 'nav-user-avatar';

  const style = document.createElement('style');
  style.textContent = `
    #${AVATAR_ID} {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 34px;
      height: 34px;
      border-radius: 50%;
      background-color: var(--color-primary, #1a73e8);
      background-size: cover;
      background-position: center;
      color: #fff;
      font-weight: 700;
      font-size: 13px;
      border: 2px solid rgba(255,255,255,0.6);
      cursor: pointer;
      text-decoration: none;
      flex-shrink: 0;
      vertical-align: middle;
    }
    .sidebar-user-section {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 16px;
      border-bottom: 1px solid rgba(0,0,0,0.08);
      margin-bottom: 8px;
    }
    .sidebar-user-avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background-color: var(--color-primary, #1a73e8);
      background-size: cover;
      background-position: center;
      color: #fff;
      font-weight: 700;
      font-size: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .sidebar-user-name {
      font-size: 13px;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 140px;
    }
    .sidebar-user-role {
      font-size: 11px;
      color: var(--text-secondary, #666);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 140px;
    }
  `;
  document.head.appendChild(style);

  function getInitials(name) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function formatRole(role) {
    const map = {
      super_admin: 'Super Admin',
      national_executive: 'National Executive',
      regional_executive: 'Regional Executive',
      member: 'Member',
    };
    return map[role] || String(role || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  function injectNavbarAvatar(profile) {
    // --- Horizontal navbar: replace/update the Profile <li> ---
    const profileLinks = document.querySelectorAll('a.navbar-link[href="/profile.html"]');
    profileLinks.forEach(link => {
      const li = link.closest('li');
      if (!li) return;

      let avatar = document.getElementById(AVATAR_ID);
      if (!avatar) {
        avatar = document.createElement('a');
        avatar.id = AVATAR_ID;
        avatar.href = '/profile.html';
        avatar.title = profile.fullName || 'My Profile';
        li.parentNode.insertBefore(avatar, li);
      }

      const photoUrl = profile.profilePictureUrl || profile.photoURL || profile.photoUrl || '';
      if (photoUrl) {
        avatar.style.backgroundImage = `url("${photoUrl}")`;
        avatar.textContent = '';
      } else {
        avatar.style.backgroundImage = '';
        avatar.textContent = getInitials(profile.fullName);
      }
    });

    // --- Sidebar nav: inject user info block at top of sidebar ---
    const sidebarNavs = document.querySelectorAll('aside.dashboard-sidebar .dashboard-nav');
    sidebarNavs.forEach(nav => {
      let section = nav.querySelector('.sidebar-user-section');
      if (!section) {
        section = document.createElement('div');
        section.className = 'sidebar-user-section';
        nav.prepend(section);
      }

      const photoUrl = profile.profilePictureUrl || profile.photoURL || profile.photoUrl || '';
      const avatarDiv = section.querySelector('.sidebar-user-avatar') || document.createElement('div');
      avatarDiv.className = 'sidebar-user-avatar';
      if (photoUrl) {
        avatarDiv.style.backgroundImage = `url("${photoUrl}")`;
        avatarDiv.textContent = '';
      } else {
        avatarDiv.style.backgroundImage = '';
        avatarDiv.textContent = getInitials(profile.fullName);
      }

      const info = section.querySelector('.sidebar-user-info') || document.createElement('div');
      info.className = 'sidebar-user-info';
      info.style.overflow = 'hidden';
      info.innerHTML = `
        <div class="sidebar-user-name">${profile.fullName || 'My Profile'}</div>
        <div class="sidebar-user-role">${formatRole(profile.role)}</div>
      `;

      if (!section.contains(avatarDiv)) section.appendChild(avatarDiv);
      if (!section.contains(info)) section.appendChild(info);

      // Make the whole section link to profile
      section.style.cursor = 'pointer';
      section.onclick = () => { window.location.href = '/profile.html'; };
    });
  }

  function waitForAuth() {
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      const user = typeof AuthModule !== 'undefined' && AuthModule.getCurrentUser?.();
      const profile = user?.profile;
      if (profile) {
        clearInterval(interval);
        injectNavbarAvatar(profile);
      } else if (attempts > 40) {
        clearInterval(interval);
      }
    }, 250);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitForAuth);
  } else {
    waitForAuth();
  }
})();
