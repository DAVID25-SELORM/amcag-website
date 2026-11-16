// AMCAG notification bell: shows the signed-in user's in-app notifications (notifications collection).
// Adds a bell to .navbar-actions with an unread count and a dropdown list. Updates live.
(function () {
  if (window.__amcagBell) return;
  window.__amcagBell = true;

  var css = '' +
    '.nb-wrap{position:relative;display:inline-block;margin-right:10px;vertical-align:middle}' +
    '.nb-btn{position:relative;background:transparent;border:0;cursor:pointer;font-size:1.35rem;line-height:1;padding:6px 8px;border-radius:50%}' +
    '.nb-btn:hover{background:rgba(11,93,59,.1)}' +
    '.nb-count{position:absolute;top:0;right:0;min-width:18px;height:18px;padding:0 4px;box-sizing:border-box;border-radius:9px;background:#b3261e;color:#fff;font:700 .7rem/18px Inter,Arial,sans-serif;text-align:center;display:none}' +
    '.nb-panel{position:absolute;right:0;top:calc(100% + 8px);width:360px;max-width:calc(100vw - 24px);background:#fff;color:#1a2433;border-radius:12px;box-shadow:0 12px 36px rgba(0,0,0,.25);z-index:99990;display:none;overflow:hidden;font-family:Inter,Segoe UI,Arial,sans-serif;text-align:left}' +
    '.nb-panel.open{display:block}' +
    '.nb-head{display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:#0b5d3b;color:#fff;font-weight:700}' +
    '.nb-head button{background:transparent;border:0;color:#fff;font:600 .78rem Inter,Arial,sans-serif;cursor:pointer;text-decoration:underline}' +
    '.nb-list{max-height:420px;overflow:auto}' +
    '.nb-item{display:block;padding:12px 16px;border-bottom:1px solid #edf1ee;cursor:pointer;text-decoration:none;color:inherit}' +
    '.nb-item:hover{background:#f4f8f5}' +
    '.nb-item.unread{background:#eaf3ee}' +
    '.nb-title{font-weight:700;font-size:.92rem;display:flex;gap:8px;align-items:center}' +
    '.nb-dot{width:8px;height:8px;border-radius:50%;background:#0b7a4a;flex:none}' +
    '.nb-msg{font-size:.85rem;color:#33415c;margin-top:3px;line-height:1.4;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}' +
    '.nb-time{font-size:.74rem;color:#8892a0;margin-top:4px}' +
    '.nb-empty{padding:28px 16px;text-align:center;color:#5a6778;font-size:.9rem}';

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c];
    });
  }

  function safeLink(url) {
    url = String(url || '');
    return /^\/[^\/\\]/.test(url) ? url : '';
  }

  function isUnread(n) {
    if (n.read === true || n.status === 'read') return false;
    return n.read === false || n.status === 'unread';
  }

  function millis(n) {
    var t = n.createdAt;
    if (!t) return 0;
    if (typeof t.toMillis === 'function') return t.toMillis();
    if (t.seconds) return t.seconds * 1000;
    return new Date(t).getTime() || 0;
  }

  function ago(ms) {
    if (!ms) return '';
    var s = Math.max(0, Math.floor((Date.now() - ms) / 1000));
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + ' min ago';
    if (s < 86400) return Math.floor(s / 3600) + ' h ago';
    if (s < 604800) return Math.floor(s / 86400) + ' d ago';
    return new Date(ms).toLocaleDateString('en-GB', {day: 'numeric', month: 'short'});
  }

  function init(user) {
    var host = document.querySelector('.navbar-actions');
    var menu = !host ? document.querySelector('.navbar-menu') : null;
    if ((!host && !menu) || document.getElementById('nbWrap')) return;
    if (!window.firebase || !firebase.firestore) return;

    if (!document.getElementById('nb-style')) {
      var st = document.createElement('style');
      st.id = 'nb-style';
      st.textContent = css;
      document.head.appendChild(st);
    }

    var wrap = document.createElement('div');
    wrap.className = 'nb-wrap';
    wrap.id = 'nbWrap';
    wrap.innerHTML =
      '<button class="nb-btn" type="button" aria-label="Notifications" aria-haspopup="true">🔔<span class="nb-count" id="nbCount"></span></button>' +
      '<div class="nb-panel" id="nbPanel" role="menu"><div class="nb-head"><span>Notifications</span><button type="button" id="nbAll">Mark all read</button></div>' +
      '<div class="nb-list" id="nbList"><div class="nb-empty">Loading...</div></div></div>';
    if (host) {
      host.insertBefore(wrap, host.firstChild);
    } else {
      var li = document.createElement('li');
      li.style.cssText = 'list-style:none;display:flex;align-items:center';
      li.appendChild(wrap);
      menu.appendChild(li);
    }

    var btn = wrap.querySelector('.nb-btn');
    var panel = document.getElementById('nbPanel');
    var items = [];
    var db = firebase.firestore();
    var col = db.collection('notifications');

    function badge() {
      var c = items.filter(isUnread).length;
      var el = document.getElementById('nbCount');
      el.textContent = c > 99 ? '99+' : String(c);
      el.style.display = c ? 'block' : 'none';
    }

    function render() {
      var list = document.getElementById('nbList');
      if (!items.length) {
        list.innerHTML = '<div class="nb-empty">No notifications yet.</div>';
      } else {
        list.innerHTML = items.map(function (n) {
          var link = safeLink(n.link || n.actionUrl);
          var un = isUnread(n);
          return '<a class="nb-item' + (un ? ' unread' : '') + '" data-id="' + esc(n.id) + '" href="' + (link ? esc(link) : '#') + '">' +
            '<div class="nb-title">' + (un ? '<span class="nb-dot"></span>' : '') + '<span>' + esc(n.title || 'Notification') + '</span></div>' +
            '<div class="nb-msg">' + esc(n.message || n.body || '') + '</div>' +
            '<div class="nb-time">' + esc(ago(millis(n))) + '</div></a>';
        }).join('');
      }
      badge();
    }

    function markRead(id) {
      return col.doc(id).update({read: true, status: 'read'}).catch(function (e) {
        console.warn('Could not mark notification read:', e.message);
      });
    }

    function apply(snap) {
      items = snap.docs.map(function (d) { var x = d.data(); x.id = d.id; return x; })
        .sort(function (a, b) { return millis(b) - millis(a); });
      render();
    }

    function listen() {
      var q = col.where('uid', '==', user.uid);
      var unsub = q.orderBy('createdAt', 'desc').limit(30).onSnapshot(apply, function (err) {
        // Index may still be building: fall back to an unordered query sorted in the browser.
        console.warn('Notification query fallback:', err.message);
        if (unsub) unsub();
        q.limit(100).onSnapshot(function (snap) { apply(snap); }, function (e2) {
          console.warn('Notifications unavailable:', e2.message);
          document.getElementById('nbList').innerHTML = '<div class="nb-empty">Notifications are unavailable right now.</div>';
        });
      });
    }

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      panel.classList.toggle('open');
    });
    document.addEventListener('click', function (e) {
      if (!wrap.contains(e.target)) panel.classList.remove('open');
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') panel.classList.remove('open');
    });
    document.getElementById('nbAll').addEventListener('click', function () {
      items.filter(isUnread).forEach(function (n) { markRead(n.id); });
    });
    document.getElementById('nbList').addEventListener('click', function (e) {
      var a = e.target.closest('.nb-item');
      if (!a) return;
      var id = a.getAttribute('data-id');
      var n = items.filter(function (x) { return x.id === id; })[0];
      if (n && isUnread(n)) markRead(id);
      if (a.getAttribute('href') === '#') e.preventDefault();
    });

    listen();
  }

  function start() {
    if (!window.firebase || !firebase.auth) return;
    firebase.auth().onAuthStateChanged(function (user) {
      if (user) init(user);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
