// Shows an unread-count badge next to "Chat & Announcements" in the dashboard menus.
// Light by design: watches only the signed-in member's own region (latest 30 messages and announcements).
(function () {
  'use strict';
  if (window.__amcagChatBadge) return;
  window.__amcagChatBadge = true;
  if (/regional-chat\.html$/.test(window.location.pathname)) return; // the chat page keeps its own counters

  var DB_SDK = 'https://www.gstatic.com/firebasejs/9.22.0/firebase-database-compat.js';
  var counts = { regional: 0, announcement: 0 };

  function norm(v) { return String(v || '').trim().toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }

  function loadDatabaseSdk() {
    if (window.firebase && typeof firebase.database === 'function') return Promise.resolve();
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = DB_SDK; s.async = true;
      s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function seenMap(uid) {
    try { return JSON.parse(localStorage.getItem('amcagChatSeen:' + uid) || '{}') || {}; } catch (e) { return {}; }
  }
  function seenAt(uid, key) {
    var m = seenMap(uid);
    if (m[key]) return m[key];
    m[key] = Date.now();
    try { localStorage.setItem('amcagChatSeen:' + uid, JSON.stringify(m)); } catch (e) { /* storage unavailable */ }
    return m[key];
  }

  function paint() {
    var total = counts.regional + counts.announcement;
    var links = document.querySelectorAll('a[href*="regional-chat.html"]');
    Array.prototype.forEach.call(links, function (a) {
      var dot = a.querySelector('.amcag-chat-dot');
      if (!total) { if (dot) dot.remove(); return; }
      if (!dot) {
        dot = document.createElement('span');
        dot.className = 'amcag-chat-dot';
        dot.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;min-width:18px;height:18px;padding:0 5px;margin-left:8px;border-radius:9px;background:#d93025;color:#fff;font-size:11px;font-weight:700;line-height:1;vertical-align:middle;';
        a.appendChild(dot);
      }
      dot.textContent = total > 99 ? '99+' : String(total);
    });
  }

  function watch(uid, key, kind, path) {
    var seen = seenAt(uid, kind + ':' + key);
    firebase.database().ref(path).limitToLast(30).on('value', function (snap) {
      var s = seenMap(uid)[kind + ':' + key] || seen, n = 0;
      snap.forEach(function (c) {
        var m = c.val() || {};
        if ((m.timestamp || 0) > s && (m.senderId || m.authorId) !== uid && !m.hidden && !m.deleted && m.system !== true) n++;
      });
      counts[kind] = n;
      paint();
    }, function () { /* no access yet: show nothing */ });
  }

  function start(user) {
    var p = user.profile || {};
    var status = String(p.status || '').toLowerCase();
    if (status && status !== 'active' && status !== 'approved') return;
    var key = norm(p.regionId || p.region || p.regionName || p.assignedRegion);
    if (!key) return;
    loadDatabaseSdk().then(function () {
      watch(user.uid, key, 'regional', 'regional-chats/' + key + '/messages');
      watch(user.uid, key, 'announcement', 'regional-announcements/' + key + '/posts');
      setInterval(paint, 1500); // menus re-render after sign-in; keep the badge on the fresh links
    }).catch(function () { /* badge is optional */ });
  }

  function boot() {
    if (!window.AuthModule || typeof AuthModule.onAuthStateChanged !== 'function') return;
    var done = false;
    AuthModule.onAuthStateChanged(function (user) {
      if (!user || done) return;
      done = true;
      try { start(user); } catch (e) { /* badge is optional */ }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
