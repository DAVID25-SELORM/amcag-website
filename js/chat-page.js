// AMCAG community chat: regional chat, announcements, national chat and rooms.
// Messages live in the Realtime Database; moderation, rooms and push go through Cloud Functions.
(function () {
  'use strict';

  var EMOJIS = ['\u{1F44D}', '❤️', '\u{1F602}', '\u{1F64F}', '\u{1F62E}', '\u{1F389}'];
  var EDIT_WINDOW_MS = 15 * 60 * 1000;
  var MAX_TEXT = 2000;
  var PAGE = 100;
  var EXEC_ROLES = ['super_admin', 'national_executive', 'regional_executive'];
  var SITE = 'https://amcag-af624.web.app';

  var S = {
    user: null, uid: '', role: 'member', name: '', photo: '',
    ownRaw: '', ownKey: '', oversight: false, isExec: false, isSuper: false,
    regions: [], view: { raw: '', key: '', label: '' },
    channels: [], rooms: [], store: {}, active: '', muted: {}, seen: {},
    reply: null, pending: null, sending: false, rec: null, reportBadge: 0,
    renderQueued: false, modView: false, readMarked: {}
  };

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function norm(v) {
    return String(v || '').trim().toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }
  function sanitizeKey(v) { return String(v || '').trim().replace(/[.#$\[\]\/]/g, '-').replace(/\s+/g, ' '); }
  function titleCase(v) { return String(v || '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/\b\w/g, function (l) { return l.toUpperCase(); }); }
  function toast(msg, type) {
    if (window.UIModule && UIModule.showAlert) UIModule.showAlert(msg, type || 'info');
    else window.alert(msg);
  }
  function call(name, data) {
    return firebase.functions().httpsCallable(name)(data || {}).then(function (r) { return r.data; });
  }
  function errText(e) { return (e && (e.message || e.code)) || 'Something went wrong'; }
  function roleLabel(r) {
    return { super_admin: 'Super Admin', national_executive: 'National Executive', regional_executive: 'Regional Executive', system: 'AMCAG' }[r] || '';
  }
  function safeUrl(u) { return /^https:\/\//i.test(String(u || '')) ? String(u) : ''; }
  function linkify(text) {
    return esc(text).replace(/(https?:\/\/[^\s<]+)/g, function (u) {
      return '<a href="' + u + '" target="_blank" rel="noopener noreferrer">' + u + '</a>';
    });
  }
  function timeOf(ts) { return ts ? new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : ''; }
  function dayKey(ts) { var d = new Date(ts || 0); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function dayLabel(ts) {
    var d = new Date(ts || 0), now = new Date();
    var y = new Date(); y.setDate(now.getDate() - 1);
    if (dayKey(ts) === dayKey(now.getTime())) return 'Today';
    if (dayKey(ts) === dayKey(y.getTime())) return 'Yesterday';
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  // ---------------------------------------------------------------- modal helpers
  function openModal(html) {
    var back = document.createElement('div');
    back.className = 'modal-back';
    back.innerHTML = '<div class="modal-card" role="dialog" aria-modal="true">' + html + '</div>';
    document.body.appendChild(back);
    back.addEventListener('mousedown', function (e) { if (e.target === back) closeModal(back); });
    return back;
  }
  function closeModal(back) { if (back && back.parentNode) back.parentNode.removeChild(back); }
  function askText(o) {
    return new Promise(function (resolve) {
      var field = o.multiline
        ? '<textarea id="ask-field" rows="4" maxlength="' + (o.max || 300) + '" placeholder="' + esc(o.placeholder || '') + '">' + esc(o.value || '') + '</textarea>'
        : '<input type="text" id="ask-field" maxlength="' + (o.max || 300) + '" placeholder="' + esc(o.placeholder || '') + '" value="' + esc(o.value || '') + '">';
      var m = openModal('<h3>' + esc(o.title) + '</h3>' + (o.note ? '<p style="color:var(--text-secondary);margin:0 0 8px;">' + esc(o.note) + '</p>' : '') +
        '<label for="ask-field">' + esc(o.label || '') + '</label>' + field +
        '<div class="modal-actions"><button class="btn btn-outline" id="ask-cancel">Cancel</button><button class="btn btn-primary" id="ask-ok">' + esc(o.ok || 'OK') + '</button></div>');
      var input = m.querySelector('#ask-field');
      setTimeout(function () { input.focus(); }, 30);
      function done(v) { closeModal(m); resolve(v); }
      m.querySelector('#ask-cancel').onclick = function () { done(null); };
      m.querySelector('#ask-ok').onclick = function () {
        var v = input.value.trim();
        if (!v && !o.allowEmpty) { input.focus(); return; }
        done(v);
      };
    });
  }
  function confirmBox(title, msg, ok) {
    return new Promise(function (resolve) {
      var m = openModal('<h3>' + esc(title) + '</h3><p>' + esc(msg) + '</p><div class="modal-actions"><button class="btn btn-outline" id="cf-no">Cancel</button><button class="btn btn-primary" id="cf-yes">' + esc(ok || 'Confirm') + '</button></div>');
      m.querySelector('#cf-no').onclick = function () { closeModal(m); resolve(false); };
      m.querySelector('#cf-yes').onclick = function () { closeModal(m); resolve(true); };
    });
  }

  // ---------------------------------------------------------------- local "seen" bookkeeping
  function seenStoreKey() { return 'amcagChatSeen:' + S.uid; }
  function loadSeen() {
    try { S.seen = JSON.parse(localStorage.getItem(seenStoreKey()) || '{}') || {}; } catch (e) { S.seen = {}; }
  }
  function saveSeen() { try { localStorage.setItem(seenStoreKey(), JSON.stringify(S.seen)); } catch (e) { /* storage unavailable */ } }
  function ensureSeen(key) { if (!S.seen[key]) { S.seen[key] = Date.now(); saveSeen(); } }

  // ---------------------------------------------------------------- channels
  function pathsFor(base, tail, v) {
    var out = [];
    [norm(v.raw || v.key), sanitizeKey(v.raw)].forEach(function (k) { if (k && out.indexOf(k) < 0) out.push(k); });
    return out.map(function (k) { return base + '/' + k + '/' + tail; });
  }

  function buildChannels() {
    var v = S.view, same = !!v.key && v.key === S.ownKey;
    var chs = [];
    chs.push({
      id: 'regional', kind: 'regional', icon: '💬', name: (v.label || 'Regional') + ' Chat', sub: 'Regional discussions',
      desc: v.key ? 'Members and executives of ' + v.label + ' chat here.' : 'No region is assigned to your account yet. Ask an administrator to assign your region.',
      paths: v.key ? pathsFor('regional-chats', 'messages', v) : [], idField: 'senderId',
      canPost: same, canReact: same, canMod: S.oversight || (S.role === 'regional_executive' && same),
      region: v.raw || v.label, regionKey: v.key, muteKey: 'regional:' + v.key, upload: { region: v.key, type: 'group' },
      readOnlyWhy: v.key && !same ? 'You are viewing ' + v.label + ' in read-only mode. You can still moderate and post announcements.' : '',
      privacy: 'Your regional executives, the national president, the national PRO and the super admin can view and moderate this chat. There are no private messages on AMCAG.'
    });
    chs.push({
      id: 'announcement', kind: 'announcement', icon: '📢', name: 'Announcements', sub: (v.label || 'Regional') + ' official updates',
      desc: 'Official announcements from regional and national executives.',
      paths: v.key ? pathsFor('regional-announcements', 'posts', v) : [], idField: 'authorId',
      canPost: S.isExec && (same || (S.oversight && (S.role === 'national_executive' || S.role === 'super_admin'))),
      canReact: same || S.oversight, canMod: S.oversight || (S.role === 'regional_executive' && same),
      region: v.raw || v.label, regionKey: v.key, muteKey: 'announcement:' + v.key, upload: { region: v.key, type: 'announcement' },
      readOnlyWhy: 'Only executives can post announcements.', privacy: ''
    });
    if (S.isExec) {
      chs.push({
        id: 'national', kind: 'national', icon: '🏛️', name: 'National Chat', sub: 'National & regional executives',
        desc: 'Private discussion for national and regional executives.', paths: ['national-chat/messages'], idField: 'senderId',
        canPost: true, canReact: true, canMod: S.oversight, region: '', regionKey: '', muteKey: 'national',
        upload: { region: 'national', type: 'national' }, readOnlyWhy: '', privacy: 'Executives only. The national president, PRO and super admin can moderate.'
      });
    }
    return chs;
  }

  function roomChannel(r) {
    var readable = r.isMember || S.oversight;
    var nat = r.scope === 'national';
    return {
      id: 'room:' + r.id, kind: 'room', roomId: r.id, room: r, icon: nat ? '🏛️' : '👥', name: r.name,
      sub: r.memberCount + ' member' + (r.memberCount === 1 ? '' : 's') + (r.archived ? ' · archived' : ''),
      desc: (r.description || (nat ? 'National executives room' : 'Room for ' + (r.regionName || 'your region'))),
      paths: readable ? ['chat-rooms/' + r.id + '/messages'] : [], idField: 'senderId', readable: readable,
      canPost: r.isMember && !r.archived, canReact: r.isMember, canMod: S.oversight || r.createdBy === S.uid || (S.role === 'regional_executive' && r.scope === 'region' && r.regionKey === S.ownKey),
      region: '', regionKey: r.regionKey || '', muteKey: 'room:' + r.id, upload: nat ? { region: 'national', type: 'national' } : { region: r.regionKey, type: 'room' },
      readOnlyWhy: r.archived ? 'This room is archived.' : (r.isMember ? '' : 'You are not a member of this room.'),
      privacy: 'Only room members, the national president, PRO and super admin can read this room.', canManage: S.oversight || r.createdBy === S.uid || (S.role === 'regional_executive' && r.scope === 'region' && r.regionKey === S.ownKey)
    };
  }

  function allChannels() { return S.channels.concat(S.rooms.map(roomChannel)); }
  function chById(id) { return allChannels().filter(function (c) { return c.id === id; })[0] || null; }

  // ---------------------------------------------------------------- message store + listeners
  function storeFor(ch) {
    if (!S.store[ch.id]) S.store[ch.id] = { msgs: {}, refs: [], loaded: 0, expected: 0, hasMore: true, oldest: {}, error: '' };
    return S.store[ch.id];
  }
  function detach(id) {
    var st = S.store[id];
    if (!st) return;
    st.refs.forEach(function (r) { r.ref.off('child_added', r.added); r.ref.off('child_changed', r.changed); r.ref.off('child_removed', r.removed); });
    delete S.store[id];
  }
  function attach(ch) {
    detach(ch.id);
    var st = storeFor(ch);
    st.expected = ch.paths.length;
    ch.paths.forEach(function (path) {
      var q = firebase.database().ref(path).limitToLast(PAGE);
      var put = function (snap) {
        var v = snap.val();
        if (!v || typeof v !== 'object') return;
        v.id = snap.key; v._path = path;
        var isNew = !st.msgs[snap.key] && st.ready && (v.timestamp || 0) > S.bootAt && authorOf(v) !== S.uid && !v.hidden && !v.deleted && v.system !== true && !S.muted[ch.muteKey];
        st.msgs[snap.key] = v;
        if (isNew) chime();
        if (!st.oldest[path] || snap.key < st.oldest[path]) st.oldest[path] = snap.key;
        scheduleRender();
      };
      var rem = function (snap) { delete st.msgs[snap.key]; scheduleRender(); };
      var errCb = function (e) { console.warn('[chat] listener error', path, e && e.message); st.error = 'Unable to load this conversation. Please refresh.'; st.loaded++; scheduleRender(); };
      q.on('child_added', put, errCb);
      q.on('child_changed', put, errCb);
      q.on('child_removed', rem, errCb);
      st.refs.push({ ref: q, added: put, changed: put, removed: rem });
      q.once('value').then(function (snap) { st.loaded++; st.ready = true; if (snap.numChildren() < PAGE) st.hasMore = st.hasMore && false; scheduleRender(); }, errCb);
    });
    if (!ch.paths.length) st.loaded = st.expected = 0;
    ensureSeen(ch.muteKey);
  }

  function sortedMsgs(ch) {
    var st = storeFor(ch);
    return Object.keys(st.msgs).map(function (k) { return st.msgs[k]; }).sort(function (a, b) {
      return (a.timestamp || 0) - (b.timestamp || 0) || (a.id < b.id ? -1 : 1);
    });
  }
  function authorOf(m) { return m.senderId || m.authorId || ''; }
  function unreadCount(ch) {
    var seen = S.seen[ch.muteKey] || 0, n = 0;
    var st = S.store[ch.id];
    if (!st) return 0;
    Object.keys(st.msgs).forEach(function (k) {
      var m = st.msgs[k];
      if ((m.timestamp || 0) > seen && authorOf(m) !== S.uid && !m.hidden && !m.deleted && m.system !== true) n++;
    });
    return n;
  }

  function markSeen(ch) {
    var st = S.store[ch.id];
    if (!st) return;
    var max = S.seen[ch.muteKey] || 0;
    Object.keys(st.msgs).forEach(function (k) { if ((st.msgs[k].timestamp || 0) > max) max = st.msgs[k].timestamp; });
    if (max !== S.seen[ch.muteKey]) { S.seen[ch.muteKey] = max; saveSeen(); }
  }
  function markRead(ch) {
    if (!ch.canReact || document.visibilityState !== 'visible') return;
    var st = S.store[ch.id];
    if (!st) return;
    Object.keys(st.msgs).forEach(function (k) {
      var m = st.msgs[k];
      var key = ch.id + '/' + m.id;
      if (authorOf(m) === S.uid || m.system === true || (m.readBy && m.readBy[S.uid]) || S.readMarked[key]) return;
      S.readMarked[key] = true;
      firebase.database().ref(m._path + '/' + m.id + '/readBy/' + S.uid).set(true).catch(function () { /* not a member here */ });
    });
  }

  // ---------------------------------------------------------------- rendering
  // A short chime for new messages from others while the chat page is open.
  var audioCtx = null;
  function chime() {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      var now = audioCtx.currentTime;
      [880, 1175].forEach(function (freq, i) {
        var o = audioCtx.createOscillator(), g = audioCtx.createGain();
        o.type = 'sine'; o.frequency.value = freq;
        g.gain.setValueAtTime(0.0001, now + i * 0.12);
        g.gain.exponentialRampToValueAtTime(0.18, now + i * 0.12 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.12 + 0.22);
        o.connect(g); g.connect(audioCtx.destination);
        o.start(now + i * 0.12); o.stop(now + i * 0.12 + 0.25);
      });
    } catch (e) { /* sound is optional */ }
  }

  function scheduleRender() {
    if (S.renderQueued) return;
    S.renderQueued = true;
    requestAnimationFrame(function () { S.renderQueued = false; renderAll(); });
  }

  function renderAll() {
    renderSidebar();
    if (S.modView) return;
    var ch = chById(S.active);
    if (!ch) return;
    renderMessages(ch);
    markSeen(ch);
    markRead(ch);
    renderSidebar();
    updateTitle();
  }

  function updateTitle() {
    var total = 0;
    allChannels().forEach(function (c) { if (!S.muted[c.muteKey]) total += unreadCount(c); });
    document.title = (total ? '(' + (total > 99 ? '99+' : total) + ') ' : '') + 'Chat & Announcements | AMCAG';
  }

  function tabHtml(ch) {
    var n = unreadCount(ch);
    var isActive = ch.id === S.active && !S.modView;
    return '<div class="chat-tab' + (isActive ? ' active' : '') + '" data-ch="' + esc(ch.id) + '" role="button" tabindex="0">' +
      '<span class="chat-tab-icon">' + ch.icon + '</span><div class="chat-tab-body"><div class="chat-tab-name">' + esc(ch.name) + '</div><div class="chat-tab-sub">' + esc(ch.sub) + '</div></div>' +
      (S.muted[ch.muteKey] ? '<span class="muted-mark" title="Muted">🔕</span>' : '') +
      (n && !isActive ? '<span class="unread-badge">' + (n > 99 ? '99+' : n) + '</span>' : '') + '</div>';
  }
  function renderSidebar() {
    $('channel-list').innerHTML = S.channels.map(tabHtml).join('');
    var rooms = S.rooms.map(roomChannel);
    $('room-list').innerHTML = (rooms.length ? rooms.map(tabHtml).join('') : '<div class="no-rooms" style="font-size:var(--text-sm);color:var(--text-secondary);padding:4px 2px;">No rooms yet.</div>') +
      (S.isExec ? '<div class="chat-tab new-room-tab" id="new-room-tab" role="button" tabindex="0"><span class="chat-tab-icon">➕</span><div class="chat-tab-body"><div class="chat-tab-name">New room</div><div class="chat-tab-sub">Committee, youth, women…</div></div></div>' : '');
    $('tool-moderation').classList.toggle('active', S.modView);
    var b = $('report-badge');
    b.style.display = S.reportBadge ? 'inline-flex' : 'none';
    b.textContent = S.reportBadge;
  }

  function avatarHtml(name, photo, cls) {
    var initials = String(name || 'U').split(/\s+/).map(function (n) { return n.charAt(0); }).join('').slice(0, 2).toUpperCase();
    var p = safeUrl(photo);
    return '<div class="' + cls + '" title="' + esc(name || '') + '">' + (p ? '<img src="' + esc(p) + '" alt="" loading="lazy">' : esc(initials)) + '</div>';
  }

  function attachmentHtml(m) {
    var url = safeUrl(m.fileUrl);
    if (!url) return '';
    var type = String(m.fileType || '');
    if (type.indexOf('image/') === 0) return '<div class="message-attachment"><img src="' + esc(url) + '" alt="' + esc(m.fileName || 'Photo') + '" loading="lazy" data-act="open-file" data-url="' + esc(url) + '"></div>';
    if (type.indexOf('audio/') === 0) return '<div class="message-attachment"><audio controls preload="none" src="' + esc(url) + '"></audio></div>';
    return '<div class="message-attachment"><a class="file-chip" href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">📎 ' + esc(m.fileName || 'Attachment') + '</a></div>';
  }

  function reactionsHtml(m, ch) {
    var r = m.reactions || {}, out = '';
    Object.keys(r).forEach(function (emoji) {
      var n = Object.keys(r[emoji] || {}).length;
      if (!n || EMOJIS.indexOf(emoji) < 0) return;
      var mine = !!(r[emoji] && r[emoji][S.uid]);
      out += '<button class="react-chip' + (mine ? ' mine' : '') + '" data-act="react" data-id="' + esc(m.id) + '" data-emoji="' + esc(emoji) + '"' + (ch.canReact ? '' : ' disabled') + '>' + emoji + ' ' + n + '</button>';
    });
    return out ? '<div class="reactions">' + out + '</div>' : '';
  }

  function readReceipt(m, ch) {
    if (authorOf(m) !== S.uid || ch.kind === 'announcement') return '';
    var n = Object.keys(m.readBy || {}).filter(function (u) { return u !== S.uid; }).length;
    return '<div class="message-read-receipt">' + (n ? 'Seen by ' + n + (n === 1 ? ' person' : ' people') : 'Delivered') + '</div>';
  }

  function replyQuoteHtml(m) {
    if (!m.replyTo || !m.replyTo.id) return '';
    return '<div class="reply-quote" data-act="goto" data-id="' + esc(m.replyTo.id) + '"><b>' + esc(m.replyTo.name || 'Message') + '</b>' + esc(String(m.replyTo.snippet || '')) + '</div>';
  }

  function messageHtml(m, ch) {
    var own = authorOf(m) === S.uid;
    var name = m.senderName || m.authorName || 'Member';
    var photo = m.senderPhoto || m.authorPhoto || '';
    var role = m.senderRole || m.authorRole || '';
    if (m.system === true) return '<div class="system-note">' + esc(m.text || '') + '</div>';
    var menu = '<button class="msg-menu-btn" data-act="menu" data-id="' + esc(m.id) + '" aria-label="Message options">⋯</button>';
    var body;
    if (m.hidden) {
      body = '<div class="message-removed">🚫 Removed by a moderator' + (ch.canMod && m.hiddenReason ? ' — ' + esc(m.hiddenReason) : '') + '</div>';
    } else if (m.deleted) {
      body = '<div class="message-removed">This message was deleted</div>';
    } else {
      body = replyQuoteHtml(m) + (m.text ? '<div class="' + (ch.kind === 'announcement' ? 'announcement-content' : 'message-text') + '">' + linkify(m.text) + (m.editedAt ? ' <span class="edited-tag">(edited)</span>' : '') + '</div>' : '') + attachmentHtml(m);
    }
    var removed = m.hidden || m.deleted;
    if (ch.kind === 'announcement') {
      var reads = Object.keys(m.readBy || {}).length;
      return '<div class="announcement' + (m.pinned ? ' pinned' : '') + '" data-mid="' + esc(m.id) + '">' + menu +
        '<div class="announcement-header">' + avatarHtml(name, photo, 'announcement-avatar') +
        '<div class="announcement-meta"><div class="announcement-author">' + esc(name) + (roleLabel(role) ? ' <span class="message-role">' + esc(roleLabel(role)) + '</span>' : '') + '</div>' +
        '<div class="announcement-date">' + esc(new Date(m.timestamp || 0).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })) + '</div></div>' +
        (m.pinned ? '<span class="announcement-badge" style="background:#fff3cd;color:#7a5b00;">📌 PINNED</span>' : '<span class="announcement-badge">ANNOUNCEMENT</span>') + '</div>' +
        body + (removed ? '' : reactionsHtml(m, ch) + (reads ? '<div class="message-read-receipt">👁️ ' + reads + ' ' + (reads === 1 ? 'person has' : 'people have') + ' read this</div>' : '')) + '</div>';
    }
    return '<div class="message' + (own ? ' own-message' : '') + '" data-mid="' + esc(m.id) + '">' + menu +
      avatarHtml(name, photo, 'message-avatar') +
      '<div class="message-content"><div class="message-header"><span class="message-sender">' + esc(name) + '</span>' +
      (role && role !== 'member' && roleLabel(role) ? '<span class="message-role">' + esc(roleLabel(role)) + '</span>' : '') +
      '<span class="message-time">' + esc(timeOf(m.timestamp)) + '</span></div>' + body +
      (removed ? '' : reactionsHtml(m, ch) + readReceipt(m, ch)) + '</div></div>';
  }

  function reconcile(list, items) {
    var existing = {};
    Array.prototype.forEach.call(list.children, function (el) { if (el.dataset.k) existing[el.dataset.k] = el; });
    var wanted = {};
    items.forEach(function (it) { wanted[it.key] = true; });
    Object.keys(existing).forEach(function (k) { if (!wanted[k]) { existing[k].remove(); delete existing[k]; } });
    items.forEach(function (it, idx) {
      var el = existing[it.key];
      if (!el || el._h !== it.html) {
        var t = document.createElement('div');
        t.innerHTML = it.html;
        var n = t.firstElementChild;
        n.dataset.k = it.key; n._h = it.html;
        if (el) el.replaceWith(n);
        el = n;
      }
      if (list.children[idx] !== el) list.insertBefore(el, list.children[idx] || null);
    });
  }

  function renderMessages(ch) {
    var box = $('chat-messages'), list = $('msg-list');
    var st = storeFor(ch);
    var nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 140;
    var firstFill = !list.children.length;
    var msgs = sortedMsgs(ch);
    var items = [], lastDay = '';
    msgs.forEach(function (m) {
      var d = dayKey(m.timestamp);
      if (d !== lastDay) { lastDay = d; items.push({ key: 'd:' + d, html: '<div class="day-sep">' + esc(dayLabel(m.timestamp)) + '</div>' }); }
      items.push({ key: 'm:' + m.id, html: messageHtml(m, ch) });
    });
    reconcile(list, items);

    var empty = $('empty-state');
    var loading = st.loaded < st.expected;
    if (!msgs.length && !loading) {
      var info = st.error ? ['⚠️', 'Cannot open this conversation', st.error] :
        (!ch.paths.length ? ['🔒', ch.kind === 'room' ? 'You are not a member of this room' : 'No region assigned', ch.kind === 'room' ? 'Ask the room organiser to add you.' : 'Ask an administrator to assign your region.'] :
          ch.kind === 'announcement' ? ['📢', 'No announcements yet', 'Executives will post official updates here'] : ['💬', 'No messages yet', ch.canPost ? 'Say hello 👋' : 'Nothing has been posted yet']);
      empty.innerHTML = '<div class="empty-icon">' + info[0] + '</div><h3>' + esc(info[1]) + '</h3><p>' + esc(info[2]) + '</p>';
      empty.style.display = 'flex';
    } else if (loading && !msgs.length) {
      empty.innerHTML = '<p>Loading…</p>'; empty.style.display = 'flex';
    } else empty.style.display = 'none';

    $('load-more').style.display = msgs.length >= PAGE && st.hasMore !== false ? 'block' : 'none';
    renderPinned(ch, msgs);
    if (firstFill || nearBottom || S.stickBottom) { box.scrollTop = box.scrollHeight; S.stickBottom = false; }
  }

  function renderPinned(ch, msgs) {
    var bar = $('pinned-bar');
    if (ch.kind !== 'announcement') { bar.innerHTML = ''; return; }
    var pins = msgs.filter(function (m) { return m.pinned && !m.hidden && !m.deleted; }).slice(-3).reverse();
    bar.innerHTML = pins.map(function (m) {
      return '<div class="pinned-item" data-act="goto" data-id="' + esc(m.id) + '">📌 <b>' + esc(m.authorName || 'Executive') + ':</b> ' + esc(String(m.text || (m.fileName || 'Attachment')).slice(0, 140)) + '</div>';
    }).join('');
  }

  function renderHeader(ch) {
    var btns = '';
    if (pushSupported()) btns += '<button class="hdr-btn" id="btn-push" style="display:none;">🔔 Turn on notifications</button>';
    btns += '<button class="hdr-btn" id="btn-mute">' + (S.muted[ch.muteKey] ? '🔔 Unmute' : '🔕 Mute') + '</button>';
    if (ch.kind === 'room') {
      if (ch.canManage) btns += '<button class="hdr-btn" id="btn-manage">⚙ Manage room</button>';
      if (ch.room.isMember && ch.room.createdBy !== S.uid) btns += '<button class="hdr-btn" id="btn-leave">Leave</button>';
    }
    $('chat-header').innerHTML = '<div class="chat-header-text"><h2>' + ch.icon + ' ' + esc(ch.name) + '</h2><p>' + esc(ch.desc) + '</p></div><div class="hdr-actions">' + btns + '</div>';
    var notes = [];
    if (ch.privacy) notes.push('🔒 ' + ch.privacy);
    $('notice-bar').className = 'notice-bar info';
    $('notice-bar').textContent = notes.join(' ');
    updatePushButton();
  }

  function renderComposer(ch) {
    var c = $('composer');
    if (!ch.canPost) {
      c.innerHTML = ch.readOnlyWhy ? '<div class="composer-note">' + esc(ch.readOnlyWhy) + '</div>' : '';
      c.style.display = ch.readOnlyWhy ? 'block' : 'none';
      return;
    }
    c.style.display = 'block';
    var viewing = ch.kind === 'announcement' && ch.regionKey && ch.regionKey !== S.ownKey ? '<div class="composer-note" style="padding:0 0 6px;text-align:left;">Posting to <b>' + esc(S.view.label) + '</b> as ' + esc(roleLabel(S.role) || 'executive') + '</div>' : '';
    c.innerHTML = viewing + '<div id="reply-slot"></div><div id="pending-slot"></div>' +
      '<div class="chat-input-wrapper"><textarea id="msg-input" class="chat-input" rows="1" maxlength="' + MAX_TEXT + '" placeholder="' + (ch.kind === 'announcement' ? 'Write an announcement…' : 'Type a message…') + '"></textarea>' +
      '<div class="chat-actions"><input type="file" id="file-input" style="display:none" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx">' +
      '<button class="chat-action-btn" id="btn-attach" title="Attach photo or file">📎</button>' +
      '<button class="chat-action-btn" id="btn-mic" title="Record a voice note">🎤</button>' +
      '<button class="chat-action-btn chat-send-btn" id="btn-send" title="Send">➤</button></div></div>';
    var input = $('msg-input');
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); }
    });
    input.addEventListener('input', function () { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 150) + 'px'; });
    $('btn-send').onclick = send;
    $('btn-attach').onclick = function () { $('file-input').click(); };
    $('file-input').onchange = function (e) { var f = e.target.files[0]; e.target.value = ''; if (f) pickFile(f); };
    $('btn-mic').onclick = toggleRecord;
    renderReply();
    renderPending();
  }

  function renderReply() {
    var slot = $('reply-slot');
    if (!slot) return;
    slot.innerHTML = S.reply ? '<div class="reply-bar"><span>↩</span><div class="rb-text"><b>' + esc(S.reply.name) + '</b> ' + esc(S.reply.snippet) + '</div><button class="x-btn" id="reply-x" title="Cancel reply">✕</button></div>' : '';
    if (S.reply) $('reply-x').onclick = function () { S.reply = null; renderReply(); };
  }

  function renderPending() {
    var slot = $('pending-slot');
    if (!slot) return;
    var p = S.pending;
    if (!p) { slot.innerHTML = ''; return; }
    var preview = p.type.indexOf('image/') === 0 ? '<img src="' + esc(p.preview) + '" alt="">' : p.type.indexOf('audio/') === 0 ? '<audio controls src="' + esc(p.preview) + '"></audio>' : '📎';
    slot.innerHTML = '<div class="pending-file">' + preview + '<span class="pf-name">' + esc(p.name) + ' (' + Math.max(1, Math.round(p.blob.size / 1024)) + ' KB)</span><button class="x-btn" id="pending-x" title="Remove">✕</button></div>';
    $('pending-x').onclick = clearPending;
  }
  function clearPending() {
    if (S.pending && S.pending.preview) URL.revokeObjectURL(S.pending.preview);
    S.pending = null; renderPending();
  }

  // ---------------------------------------------------------------- files, voice notes
  function compressImage(file) {
    return new Promise(function (resolve) {
      if (file.type.indexOf('image/') !== 0 || file.size < 500 * 1024 || file.type === 'image/gif') { resolve(file); return; }
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        var max = 1600, w = img.width, h = img.height, k = Math.min(1, max / Math.max(w, h));
        var cv = document.createElement('canvas');
        cv.width = Math.round(w * k); cv.height = Math.round(h * k);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(url);
        cv.toBlob(function (b) {
          if (!b || b.size >= file.size) { resolve(file); return; }
          b.name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
          resolve(b);
        }, 'image/jpeg', 0.82);
      };
      img.onerror = function () { URL.revokeObjectURL(url); resolve(file); };
      img.src = url;
    });
  }

  function pickFile(file) {
    if (file.size > 25 * 1024 * 1024) { toast('That file is too large. Choose one under 10 MB.', 'error'); return; }
    compressImage(file).then(function (blob) {
      if (blob.size > 10 * 1024 * 1024) { toast('File size must be less than 10MB', 'error'); return; }
      var name = file.name || blob.name || 'file';
      if (blob !== file && blob.name) name = blob.name;
      var type = (blob.type || file.type || 'application/octet-stream').split(';')[0];
      clearPending();
      S.pending = { blob: blob, name: name, type: type, preview: (type.indexOf('image/') === 0 || type.indexOf('audio/') === 0) ? URL.createObjectURL(blob) : '', duration: 0 };
      renderPending();
    });
  }

  function toggleRecord() {
    var btn = $('btn-mic');
    if (S.rec) { S.rec.stop(); return; }
    if (!navigator.mediaDevices || !window.MediaRecorder) { toast('Voice notes are not supported in this browser.', 'warning'); return; }
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      var mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].filter(function (t) { return MediaRecorder.isTypeSupported(t); })[0] || '';
      var rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      var chunks = [], started = Date.now(), timer;
      rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
      rec.onstop = function () {
        clearInterval(timer);
        stream.getTracks().forEach(function (t) { t.stop(); });
        S.rec = null;
        var b = $('btn-mic'); if (b) { b.classList.remove('recording'); b.textContent = '🎤'; }
        var type = (rec.mimeType || mime || 'audio/webm').split(';')[0];
        var blob = new Blob(chunks, { type: type });
        if (!blob.size) return;
        var ext = type.indexOf('mp4') >= 0 ? 'm4a' : type.indexOf('ogg') >= 0 ? 'ogg' : 'webm';
        clearPending();
        S.pending = { blob: blob, name: 'voice-note.' + ext, type: type, preview: URL.createObjectURL(blob), duration: Math.round((Date.now() - started) / 1000) };
        renderPending();
      };
      rec.start();
      S.rec = rec;
      btn.classList.add('recording');
      timer = setInterval(function () {
        var s = Math.round((Date.now() - started) / 1000);
        var b = $('btn-mic'); if (b) b.textContent = '⏹ ' + s + 's';
        if (s >= 180) rec.stop();
      }, 500);
    }).catch(function () { toast('Allow microphone access to record voice notes.', 'warning'); });
  }

  function uploadFile(p, ch) {
    var safe = String(p.name).replace(/[^A-Za-z0-9._-]+/g, '_').slice(-80);
    var path = 'chat-attachments/' + ch.upload.region + '/' + ch.upload.type + '/' + Date.now() + '_' + safe;
    var ref = firebase.storage().ref(path);
    return ref.put(p.blob, { contentType: p.type }).then(function () { return ref.getDownloadURL(); }).then(function (url) {
      return { url: url, name: p.name, type: p.type, duration: p.duration || 0 };
    });
  }

  // ---------------------------------------------------------------- sending
  function writePathOf(ch) {
    if (ch.kind === 'national') return 'national-chat/messages';
    if (ch.kind === 'room') return 'chat-rooms/' + ch.roomId + '/messages';
    return ch.paths[0];
  }

  function send() {
    var ch = chById(S.active);
    if (!ch || !ch.canPost || S.sending) return;
    var input = $('msg-input');
    var text = input.value.trim();
    var file = S.pending;
    if (!text && !file) return;
    if (text.length > MAX_TEXT) { toast('Messages can be at most ' + MAX_TEXT + ' characters.', 'warning'); return; }
    S.sending = true;
    var btn = $('btn-send'); btn.disabled = true;
    var up = file ? uploadFile(file, ch) : Promise.resolve(null);
    up.then(function (f) {
      var ann = ch.kind === 'announcement';
      var idf = ann ? 'author' : 'sender';
      var msg = {};
      msg[idf + 'Id'] = S.uid;
      msg[idf + 'Name'] = S.name;
      if (S.photo) msg[idf + 'Photo'] = S.photo;
      msg[idf + 'Role'] = S.role;
      msg.timestamp = firebase.database.ServerValue.TIMESTAMP;
      if (ch.kind === 'regional' || ann) { msg.region = ch.regionKey; msg.regionName = S.view.label; }
      if (text) msg.text = text;
      if (f) { msg.fileUrl = f.url; msg.fileName = f.name; msg.fileType = f.type; if (f.duration) msg.fileDuration = f.duration; }
      if (S.reply && !ann) msg.replyTo = { id: S.reply.id, name: S.reply.name, snippet: S.reply.snippet };
      return firebase.database().ref(writePathOf(ch)).push(msg);
    }).then(function (ref) {
      // Ask the server to push-notify the others (best effort; the message is already posted).
      call('notifyChatMessage', chanArgs(ch, { id: ref.key })).catch(function (e) { console.warn('[chat] push not sent', e && e.message); });
    }).then(function () {
      input.value = ''; input.style.height = 'auto';
      S.reply = null; renderReply(); clearPending();
      S.stickBottom = true;
      if (ch.kind === 'announcement') toast('Announcement posted.', 'success');
    }).catch(function (e) {
      console.error('[chat] send failed', e);
      toast('Message not sent: ' + errText(e), 'error');
    }).then(function () { S.sending = false; var b = $('btn-send'); if (b) b.disabled = false; });
  }

  // ---------------------------------------------------------------- message menu + actions
  function findMsg(id) {
    var ch = chById(S.active), st = ch && S.store[ch.id];
    return st ? st.msgs[id] : null;
  }
  function closePopup() { var p = document.querySelector('.msg-popup'); if (p) p.remove(); }

  function openMenu(btn, id) {
    closePopup();
    var ch = chById(S.active), m = findMsg(id);
    if (!ch || !m) return;
    var own = authorOf(m) === S.uid;
    var removed = m.hidden || m.deleted;
    var items = [];
    if (!removed && ch.canReact) items.push('<div class="emoji-row">' + EMOJIS.map(function (e) { return '<button data-pa="react" data-emoji="' + esc(e) + '">' + e + '</button>'; }).join('') + '</div>');
    if (!removed && ch.canPost && ch.kind !== 'announcement') items.push('<button class="pop-item" data-pa="reply">↩ Reply</button>');
    if (!removed && m.text) items.push('<button class="pop-item" data-pa="copy">⧉ Copy text</button>');
    var fresh = Date.now() - (m.timestamp || 0) <= EDIT_WINDOW_MS;
    if (!removed && own && fresh && m.text) items.push('<button class="pop-item" data-pa="edit">✏️ Edit</button>');
    if (!removed && own && fresh) items.push('<button class="pop-item danger" data-pa="delete">🗑 Delete</button>');
    if (ch.kind === 'announcement' && ch.canMod && !removed) items.push('<button class="pop-item" data-pa="pin">' + (m.pinned ? '📌 Unpin' : '📌 Pin to top') + '</button>');
    if (ch.canMod && !m.hidden && !m.deleted && m.system !== true) items.push('<button class="pop-item danger" data-pa="hide">🚫 Hide message</button>');
    if (ch.canMod && m.hidden && (S.oversight || m.hiddenBy === S.uid)) items.push('<button class="pop-item" data-pa="restore">↺ Restore message</button>');
    if (!own && !removed && m.system !== true && (ch.canReact || S.oversight)) items.push('<button class="pop-item danger" data-pa="report">⚑ Report</button>');
    if (!items.length) return;
    var pop = document.createElement('div');
    pop.className = 'msg-popup';
    pop.innerHTML = items.join('');
    document.body.appendChild(pop);
    var r = btn.getBoundingClientRect();
    var w = pop.offsetWidth, h = pop.offsetHeight;
    var left = Math.min(Math.max(8, r.left - w + 28), window.innerWidth - w - 8);
    var top = r.bottom + 6 + h > window.innerHeight ? Math.max(8, r.top - h - 6) : r.bottom + 6;
    pop.style.left = left + 'px'; pop.style.top = top + 'px';
    pop.onclick = function (e) {
      var t = e.target.closest('[data-pa]');
      if (!t) return;
      closePopup();
      runAction(t.getAttribute('data-pa'), m, ch, t.getAttribute('data-emoji'));
    };
  }

  function chanArgs(ch, m) {
    var a = { channel: ch.kind, messageId: m.id };
    if (ch.kind === 'room') a.roomId = ch.roomId;
    if (ch.kind === 'regional' || ch.kind === 'announcement') a.region = ch.region || ch.regionKey;
    return a;
  }
  function act(name, args, okMsg) {
    return call(name, args).then(function () { if (okMsg) toast(okMsg, 'success'); }).catch(function (e) { toast(errText(e), 'error'); });
  }

  function toggleReaction(m, ch, emoji) {
    if (!ch.canReact || EMOJIS.indexOf(emoji) < 0) return;
    var ref = firebase.database().ref(m._path + '/' + m.id + '/reactions/' + emoji + '/' + S.uid);
    var had = !!(m.reactions && m.reactions[emoji] && m.reactions[emoji][S.uid]);
    (had ? ref.remove() : ref.set(true)).catch(function (e) { toast('Could not react: ' + errText(e), 'error'); });
  }

  function runAction(a, m, ch, emoji) {
    if (a === 'react') return toggleReaction(m, ch, emoji);
    if (a === 'reply') {
      S.reply = { id: m.id, name: m.senderName || m.authorName || 'Member', snippet: String(m.text || (m.fileType && m.fileType.indexOf('audio/') === 0 ? 'Voice note' : m.fileType && m.fileType.indexOf('image/') === 0 ? 'Photo' : 'Attachment')).slice(0, 100) };
      renderReply(); var i = $('msg-input'); if (i) i.focus(); return;
    }
    if (a === 'copy') { try { navigator.clipboard.writeText(m.text || ''); toast('Copied.', 'success'); } catch (e) { /* ignore */ } return; }
    if (a === 'edit') {
      return askText({ title: 'Edit message', label: 'Message', value: m.text, multiline: true, max: MAX_TEXT, ok: 'Save' }).then(function (v) {
        if (v === null) return;
        return act('editChatMessage', Object.assign(chanArgs(ch, m), { text: v }), 'Message updated.');
      });
    }
    if (a === 'delete') {
      return confirmBox('Delete this message?', 'It will be replaced with "This message was deleted" for everyone.', 'Delete').then(function (ok) {
        if (ok) return act('deleteChatMessage', chanArgs(ch, m));
      });
    }
    if (a === 'pin') return act('moderateChatMessage', Object.assign(chanArgs(ch, m), { action: m.pinned ? 'unpin' : 'pin' }), m.pinned ? 'Unpinned.' : 'Pinned to the top.');
    if (a === 'hide') {
      return askText({ title: 'Hide this message', note: 'Members will see "Removed by a moderator". The action is logged.', label: 'Reason', placeholder: 'e.g. abusive language', ok: 'Hide message' }).then(function (v) {
        if (v === null) return;
        return act('moderateChatMessage', Object.assign(chanArgs(ch, m), { action: 'hide', reason: v }), 'Message hidden.');
      });
    }
    if (a === 'restore') return act('moderateChatMessage', Object.assign(chanArgs(ch, m), { action: 'restore' }), 'Message restored.');
    if (a === 'report') {
      return askText({ title: 'Report this message', note: 'Regional executives and national moderators will review it.', label: 'Why are you reporting it?', placeholder: 'Tell us what is wrong', ok: 'Send report', multiline: true }).then(function (v) {
        if (v === null) return;
        return act('reportChatMessage', Object.assign(chanArgs(ch, m), { reason: v }), 'Thank you. Your report was sent to the moderators.');
      });
    }
  }

  function gotoMessage(id) {
    var el = document.querySelector('[data-mid="' + (window.CSS && CSS.escape ? CSS.escape(id) : id) + '"]');
    if (!el) { toast('That message is not loaded. Use "Load earlier messages".', 'info'); return; }
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    el.classList.add('flash');
    setTimeout(function () { el.classList.remove('flash'); }, 1500);
  }

  function loadEarlier() {
    var ch = chById(S.active); if (!ch) return;
    var st = storeFor(ch);
    var btn = $('load-more'); btn.disabled = true; btn.textContent = 'Loading…';
    var jobs = ch.paths.map(function (path) {
      var oldest = st.oldest[path];
      if (!oldest) return Promise.resolve(0);
      return firebase.database().ref(path).orderByKey().endAt(oldest).limitToLast(PAGE + 1).once('value').then(function (snap) {
        var n = 0;
        snap.forEach(function (c) {
          if (c.key === oldest) return;
          var v = c.val(); if (!v || typeof v !== 'object') return;
          v.id = c.key; v._path = path; st.msgs[c.key] = v; n++;
          if (!st.oldest[path] || c.key < st.oldest[path]) st.oldest[path] = c.key;
        });
        return n;
      });
    });
    Promise.all(jobs).then(function (counts) {
      if (counts.reduce(function (a, b) { return a + b; }, 0) < PAGE / 2) st.hasMore = false;
      var box = $('chat-messages'), before = box.scrollHeight;
      renderMessages(ch);
      box.scrollTop = box.scrollHeight - before;
    }).catch(function (e) { toast('Could not load earlier messages: ' + errText(e), 'error'); })
      .then(function () { btn.disabled = false; btn.textContent = 'Load earlier messages'; });
  }

  // ---------------------------------------------------------------- open a channel
  function openChannel(id) {
    var ch = chById(id);
    if (!ch) return;
    S.modView = false;
    S.active = id; S.reply = null;
    clearPending();
    $('moderation-view').style.display = 'none';
    $('chat-messages').style.display = '';
    $('pinned-bar').style.display = '';
    $('notice-bar').style.display = '';
    $('msg-list').innerHTML = '';
    renderHeader(ch);
    renderComposer(ch);
    var st = S.store[ch.id];
    if (!st) attach(ch);
    S.stickBottom = true;
    renderAll();
    var url = new URL(window.location.href); url.searchParams.delete('view');
    try { history.replaceState(null, '', url.pathname + (ch.kind === 'room' ? '?room=' + ch.roomId : ch.kind === 'regional' ? '' : '?c=' + ch.kind)); } catch (e) { /* ignore */ }
  }

  // ---------------------------------------------------------------- moderation view
  function showModeration(tab) {
    S.modView = true;
    tab = tab || 'open';
    closePopup();
    $('chat-messages').style.display = 'none';
    $('composer').style.display = 'none';
    $('pinned-bar').style.display = 'none';
    $('notice-bar').style.display = 'none';
    var v = $('moderation-view');
    v.style.display = 'block';
    $('chat-header').innerHTML = '<div class="chat-header-text"><h2>🛡️ Moderation</h2><p>Reported messages and the moderation log. Every hide and restore is recorded.</p></div>';
    var tabs = '<div class="mod-tabs"><button class="mod-tab' + (tab === 'open' ? ' active' : '') + '" data-mt="open">Open reports</button><button class="mod-tab' + (tab === 'resolved' ? ' active' : '') + '" data-mt="resolved">Resolved</button>' +
      (S.isSuper ? '<button class="mod-tab' + (tab === 'audit' ? ' active' : '') + '" data-mt="audit">Moderation log</button>' : '') + '</div>';
    v.innerHTML = tabs + '<div id="mod-body"><p>Loading…</p></div>';
    v.onclick = function (e) {
      var t = e.target.closest('[data-mt]'); if (t) { showModeration(t.getAttribute('data-mt')); return; }
      var a = e.target.closest('[data-rep]'); if (!a) return;
      a.disabled = true;
      call('resolveChatReport', { reportId: a.getAttribute('data-id'), action: a.getAttribute('data-rep') }).then(function () {
        toast(a.getAttribute('data-rep') === 'hide' ? 'Message hidden and report resolved.' : 'Report dismissed.', 'success');
        showModeration(tab); refreshReportBadge();
      }).catch(function (er) { a.disabled = false; toast(errText(er), 'error'); });
    };
    renderSidebar();
    var body = function () { return $('mod-body'); };
    if (tab === 'audit') {
      call('listChatAudit').then(function (r) {
        body().innerHTML = r.entries.length ? r.entries.map(function (e) {
          return '<div class="audit-row"><b>' + esc(e.action.replace(/_/g, ' ')) + '</b> by ' + esc(e.byName) + ' (' + esc(roleLabel(e.byRole) || e.byRole) + ') · ' + esc(e.channel) + (e.regionKey ? ' · ' + esc(titleCase(e.regionKey)) : '') +
            (e.targetName ? ' · message from ' + esc(e.targetName) : '') + (e.reason ? '<br><span style="color:var(--text-secondary);">Reason: ' + esc(e.reason) + '</span>' : '') +
            '<br><small style="color:var(--text-secondary);">' + esc(new Date(e.at).toLocaleString('en-GB')) + '</small></div>';
        }).join('') : '<p>No moderation actions yet.</p>';
      }).catch(function (e) { body().innerHTML = '<p>' + esc(errText(e)) + '</p>'; });
      return;
    }
    call('listChatReports', { status: tab }).then(function (r) {
      if (tab === 'open') { S.reportBadge = r.reports.length; renderSidebar(); }
      body().innerHTML = r.reports.length ? r.reports.map(function (x) {
        var where = x.channel === 'room' ? 'Room' : x.channel === 'announcement' ? 'Announcements' : x.channel === 'national' ? 'National chat' : 'Regional chat';
        return '<div class="mod-card"><b>' + esc(where) + (x.regionName ? ' · ' + esc(titleCase(x.regionName)) : '') + '</b> <small style="color:var(--text-secondary);">' + esc(new Date(x.createdAt).toLocaleString('en-GB')) + '</small>' +
          '<div class="snap"><b>' + esc(x.senderName || 'Member') + ':</b> ' + esc(x.snapshot && x.snapshot.text ? x.snapshot.text : (x.snapshot && x.snapshot.fileUrl ? '[attachment]' : '[no text]')) + '</div>' +
          '<div style="font-size:var(--text-sm);">Reported by <b>' + esc(x.reportedByName) + '</b>: ' + esc(x.reason) + '</div>' +
          (tab === 'open' ? '<div class="modal-actions" style="justify-content:flex-start;"><button class="btn btn-primary btn-sm" data-rep="hide" data-id="' + esc(x.id) + '">Hide message</button><button class="btn btn-outline btn-sm" data-rep="dismiss" data-id="' + esc(x.id) + '">Dismiss</button></div>' : '<div style="font-size:var(--text-sm);color:var(--text-secondary);margin-top:6px;">' + esc(x.status) + '</div>') + '</div>';
      }).join('') : '<p>' + (tab === 'open' ? 'No open reports. 🎉' : 'Nothing resolved yet.') + '</p>';
    }).catch(function (e) { body().innerHTML = '<p>' + esc(errText(e)) + '</p>'; });
  }

  function refreshReportBadge() {
    if (!S.isExec) return;
    call('listChatReports', { status: 'open' }).then(function (r) { S.reportBadge = r.reports.length; renderSidebar(); }).catch(function () { /* optional */ });
  }

  // ---------------------------------------------------------------- invite
  function showInvite() {
    var link = SITE + '/community.html';
    var msg = 'Assalamu alaikum / Hello AMCAG members! 👋\n\nOur WhatsApp group is moving to the official AMCAG community chat on our website. It has regional chats, official announcements, photos, voice notes and notifications, all in one safe place.\n\nJoin here: ' + link + '\n\n1. Sign in with your AMCAG account (or register if you are new).\n2. Open Chat & Announcements.\n3. Turn on notifications so you never miss an update.\n\nThank you!';
    var m = openModal('<h3>Invite members</h3><p style="color:var(--text-secondary);margin:0 0 8px;">Paste this message in your WhatsApp group, then leave the group once everyone has joined.</p><textarea id="inv-text" rows="11" readonly style="width:100%;box-sizing:border-box;padding:10px;border:1px solid var(--border-color);border-radius:8px;font-family:inherit;"></textarea>' +
      '<div class="modal-actions"><button class="btn btn-outline" id="inv-close">Close</button><button class="btn btn-outline" id="inv-copy">Copy message</button><a class="btn btn-primary" id="inv-wa" target="_blank" rel="noopener noreferrer">Share on WhatsApp</a></div>');
    m.querySelector('#inv-text').value = msg;
    m.querySelector('#inv-wa').href = 'https://wa.me/?text=' + encodeURIComponent(msg);
    m.querySelector('#inv-close').onclick = function () { closeModal(m); };
    m.querySelector('#inv-copy').onclick = function () {
      var t = m.querySelector('#inv-text'); t.select();
      var done = function () { toast('Message copied. Paste it in WhatsApp.', 'success'); };
      if (navigator.clipboard) navigator.clipboard.writeText(msg).then(done, function () { document.execCommand('copy'); done(); }); else { document.execCommand('copy'); done(); }
    };
  }

  // ---------------------------------------------------------------- rooms
  function buildPicker(host, members, selected, filter) {
    host.innerHTML = '<input type="text" class="picker-search" placeholder="Search members…" style="margin-top:6px;"><div class="picker-list"></div>';
    var list = host.querySelector('.picker-list'), search = host.querySelector('.picker-search');
    function draw() {
      var q = search.value.trim().toLowerCase();
      var rows = members.filter(function (m) { return (!filter || filter(m)) && (!q || m.name.toLowerCase().indexOf(q) >= 0); }).slice(0, 300);
      list.innerHTML = rows.length ? rows.map(function (m) {
        return '<label class="picker-row" style="margin:0;font-weight:400;"><input type="checkbox" data-u="' + esc(m.uid) + '"' + (selected[m.uid] ? ' checked' : '') + (m.uid === S.uid ? ' disabled checked' : '') + '> <span>' + esc(m.name) + ' <small>' + esc(roleLabel(m.role) || '') + (m.region ? ' · ' + esc(m.region) : '') + '</small></span></label>';
      }).join('') : '<div class="picker-row">No members found.</div>';
    }
    search.oninput = draw;
    list.onchange = function (e) { var u = e.target.getAttribute('data-u'); if (u) { if (e.target.checked) selected[u] = true; else delete selected[u]; } };
    draw();
  }

  function showNewRoom() {
    var canNat = S.oversight || S.role === 'national_executive';
    var regionOpts = S.regions.map(function (r) { return '<option value="' + esc(r.raw) + '"' + (norm(r.raw) === S.view.key ? ' selected' : '') + '>' + esc(r.label) + '</option>'; }).join('');
    var m = openModal('<h3>Create a room</h3><label for="room-name">Room name</label><input type="text" id="room-name" maxlength="60" placeholder="e.g. Youth wing, Welfare committee">' +
      '<label for="room-desc">Description (optional)</label><input type="text" id="room-desc" maxlength="200">' +
      (canNat ? '<label for="room-scope">Who can be in this room?</label><select id="room-scope"><option value="region">Members of one region</option><option value="national">National and regional executives only</option></select>' : '') +
      (S.oversight ? '<div id="room-region-wrap"><label for="room-region">Region</label><select id="room-region">' + regionOpts + '</select></div>' : '') +
      '<label>Add members</label><div id="room-picker"><p style="color:var(--text-secondary);">Loading members…</p></div>' +
      '<div class="modal-actions"><button class="btn btn-outline" id="room-cancel">Cancel</button><button class="btn btn-primary" id="room-create">Create room</button></div>');
    var selected = {}; selected[S.uid] = true;
    var members = [];
    function scopeVal() { var s = m.querySelector('#room-scope'); return s ? s.value : 'region'; }
    function regionVal() { var r = m.querySelector('#room-region'); return r ? r.value : S.ownRaw; }
    function loadPicker() {
      var nat = scopeVal() === 'national';
      Object.keys(selected).forEach(function (u) { if (u !== S.uid) delete selected[u]; });
      m.querySelector('#room-picker').innerHTML = '<p style="color:var(--text-secondary);">Loading members…</p>';
      var wrap = m.querySelector('#room-region-wrap'); if (wrap) wrap.style.display = nat ? 'none' : '';
      call('listChatMembers', { region: nat ? '__all__' : regionVal() }).then(function (r) {
        members = r.members;
        buildPicker(m.querySelector('#room-picker'), members, selected, nat ? function (x) { return EXEC_ROLES.indexOf(x.role) >= 0; } : null);
      }).catch(function (e) { m.querySelector('#room-picker').innerHTML = '<p>' + esc(errText(e)) + '</p>'; });
    }
    var sc = m.querySelector('#room-scope'); if (sc) sc.onchange = loadPicker;
    var rg = m.querySelector('#room-region'); if (rg) rg.onchange = loadPicker;
    loadPicker();
    m.querySelector('#room-cancel').onclick = function () { closeModal(m); };
    m.querySelector('#room-create').onclick = function () {
      var name = m.querySelector('#room-name').value.trim();
      if (name.length < 2) { m.querySelector('#room-name').focus(); return; }
      var btn = this; btn.disabled = true;
      call('manageChatRoom', { action: 'create', name: name, description: m.querySelector('#room-desc').value.trim(), scope: scopeVal(), region: scopeVal() === 'region' ? regionVal() : '', memberUids: Object.keys(selected) }).then(function (r) {
        closeModal(m); toast('Room created.', 'success');
        return loadRooms().then(function () { openChannel('room:' + r.roomId); });
      }).catch(function (e) { btn.disabled = false; toast(errText(e), 'error'); });
    };
  }

  function showManageRoom(ch) {
    var m = openModal('<h3>Manage room</h3><label for="mr-name">Room name</label><input type="text" id="mr-name" maxlength="60"><label for="mr-desc">Description</label><input type="text" id="mr-desc" maxlength="200">' +
      '<label>Members <span id="mr-count" style="font-weight:400;color:var(--text-secondary);"></span></label><div class="picker-list" id="mr-members"><div class="picker-row">Loading…</div></div>' +
      '<label>Add members</label><div id="mr-picker"><p style="color:var(--text-secondary);">Loading…</p></div>' +
      '<div class="modal-actions"><button class="btn btn-outline" id="mr-archive">' + (ch.room.archived ? 'Unarchive' : 'Archive room') + '</button><button class="btn btn-outline" id="mr-add">Add selected</button><button class="btn btn-primary" id="mr-save">Save name</button><button class="btn btn-outline" id="mr-close">Close</button></div>');
    m.querySelector('#mr-name').value = ch.room.name; m.querySelector('#mr-desc').value = ch.room.description || '';
    var chosen = {}, current = [];
    function reloadMembers() {
      return call('manageChatRoom', { action: 'members', roomId: ch.roomId }).then(function (r) {
        current = r.members;
        m.querySelector('#mr-count').textContent = '(' + current.length + ')';
        m.querySelector('#mr-members').innerHTML = current.map(function (x) {
          return '<div class="picker-row"><span style="flex:1;">' + esc(x.name) + ' <small>' + esc(roleLabel(x.role) || '') + '</small></span>' +
            (x.uid !== ch.room.createdBy ? '<button class="x-btn" data-rm="' + esc(x.uid) + '" title="Remove">✕</button>' : '<small>creator</small>') + '</div>';
        }).join('');
      });
    }
    reloadMembers().catch(function (e) { m.querySelector('#mr-members').innerHTML = '<div class="picker-row">' + esc(errText(e)) + '</div>'; });
    var nat = ch.room.scope === 'national';
    call('listChatMembers', { region: nat ? '__all__' : (ch.room.regionName || ch.room.regionKey) }).then(function (r) {
      buildPicker(m.querySelector('#mr-picker'), r.members, chosen, function (x) { return (!nat || EXEC_ROLES.indexOf(x.role) >= 0); });
    }).catch(function (e) { m.querySelector('#mr-picker').innerHTML = '<p>' + esc(errText(e)) + '</p>'; });
    m.querySelector('#mr-members').onclick = function (e) {
      var b = e.target.closest('[data-rm]'); if (!b) return;
      b.disabled = true;
      call('manageChatRoom', { action: 'removeMembers', roomId: ch.roomId, memberUids: [b.getAttribute('data-rm')] }).then(function () { return reloadMembers(); }).then(loadRooms).catch(function (er) { b.disabled = false; toast(errText(er), 'error'); });
    };
    m.querySelector('#mr-add').onclick = function () {
      var uids = Object.keys(chosen);
      if (!uids.length) { toast('Tick the members to add first.', 'info'); return; }
      call('manageChatRoom', { action: 'addMembers', roomId: ch.roomId, memberUids: uids }).then(function () { Object.keys(chosen).forEach(function (u) { delete chosen[u]; }); toast('Members added.', 'success'); return reloadMembers(); }).then(loadRooms).catch(function (er) { toast(errText(er), 'error'); });
    };
    m.querySelector('#mr-save').onclick = function () {
      call('manageChatRoom', { action: 'update', roomId: ch.roomId, name: m.querySelector('#mr-name').value, description: m.querySelector('#mr-desc').value }).then(function () { toast('Saved.', 'success'); return loadRooms(); }).then(function () { var c = chById(S.active); if (c) { renderHeader(c); } }).catch(function (er) { toast(errText(er), 'error'); });
    };
    m.querySelector('#mr-archive').onclick = function () {
      call('manageChatRoom', { action: ch.room.archived ? 'unarchive' : 'archive', roomId: ch.roomId }).then(function () { closeModal(m); return loadRooms(); }).then(function () { openChannel(S.active); }).catch(function (er) { toast(errText(er), 'error'); });
    };
    m.querySelector('#mr-close').onclick = function () { closeModal(m); };
  }

  function loadRooms() {
    return call('listChatRooms').then(function (r) {
      var oldIds = S.rooms.map(function (x) { return x.id; });
      S.rooms = r.rooms || [];
      oldIds.forEach(function (id) { if (!S.rooms.some(function (x) { return x.id === id; })) detach('room:' + id); });
      S.rooms.forEach(function (room) {
        var ch = roomChannel(room);
        var st = S.store[ch.id];
        var had = st && st.refs.length > 0;
        if (ch.readable && !had) attach(ch);
        if (!ch.readable && st) detach(ch.id);
      });
      renderSidebar();
    }).catch(function (e) { console.warn('[chat] rooms unavailable', e && e.message); });
  }

  // ---------------------------------------------------------------- push notifications
  function pushSupported() {
    return 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window && window.firebase && firebase.messaging && typeof firebase.messaging.isSupported === 'function' && firebase.messaging.isSupported();
  }
  function isIosBrowser() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window.navigator.standalone || (window.matchMedia && matchMedia('(display-mode: standalone)').matches));
  }
  function updatePushButton() {
    var b = $('btn-push');
    if (!b) return;
    var perm = 'Notification' in window ? Notification.permission : 'denied';
    b.style.display = (perm === 'granted' && S.pushOk) ? 'none' : 'inline-block';
    b.textContent = perm === 'denied' ? '🔕 Notifications blocked' : '🔔 Turn on notifications';
    b.disabled = perm === 'denied';
    b.title = perm === 'denied' ? 'Allow notifications for this site in your browser settings' : '';
  }
  function registerPush(interactive) {
    if (!pushSupported()) {
      if (interactive) toast(isIosBrowser() ? 'On iPhone, tap Share → Add to Home Screen, then open AMCAG from the Home Screen to enable notifications.' : 'This browser does not support notifications.', 'warning');
      return Promise.resolve();
    }
    var ask = Notification.permission === 'granted' ? Promise.resolve('granted') : (interactive ? Notification.requestPermission() : Promise.resolve(Notification.permission));
    return ask.then(function (perm) {
      if (perm !== 'granted') { updatePushButton(); return; }
      return navigator.serviceWorker.register('/firebase-messaging-sw.js').then(function (reg) {
        return navigator.serviceWorker.ready.then(function () { return firebase.messaging().getToken({ serviceWorkerRegistration: reg }); });
      }).then(function (token) {
        if (!token) throw new Error('No notification token was issued');
        return call('registerPushToken', { token: token }).then(function (r) {
          S.pushOk = true; S.pushToken = token;
          try { localStorage.setItem('amcagPushToken', token); } catch (e) { /* storage unavailable */ }
          (r.muted || []).forEach(function (k) { S.muted[k] = true; });
          updatePushButton(); renderSidebar();
          if (interactive) toast('Notifications are on for this device.', 'success');
        });
      });
    }).catch(function (e) {
      console.warn('[chat] push setup failed', e);
      if (interactive) toast('Could not turn on notifications: ' + errText(e), 'error');
    });
  }
  function toggleMute() {
    var ch = chById(S.active); if (!ch) return;
    var want = !S.muted[ch.muteKey];
    call('setChatMute', { channelKey: ch.muteKey, muted: want }).then(function () {
      if (want) S.muted[ch.muteKey] = true; else delete S.muted[ch.muteKey];
      renderHeader(ch); renderSidebar(); updateTitle();
      toast(want ? 'Notifications muted for this channel.' : 'Notifications unmuted.', 'success');
    }).catch(function (e) { toast(errText(e), 'error'); });
  }

  // ---------------------------------------------------------------- region selector
  function loadRegions() {
    var own = S.ownRaw ? { raw: S.ownRaw, label: titleCase(S.ownRaw) } : null;
    var p = S.oversight ? firebase.firestore().collection('regions').get().then(function (snap) {
      var list = [];
      snap.forEach(function (d) { var x = d.data() || {}; var raw = String(x.name || d.id || '').trim(); if (raw) list.push({ raw: raw, label: raw }); });
      return list;
    }).catch(function () { return []; }) : Promise.resolve([]);
    return p.then(function (list) {
      var seen = {}, out = [];
      list.forEach(function (r) { var k = norm(r.raw); if (k && !seen[k]) { seen[k] = true; out.push(r); } });
      // Ghana's 16 regions are always listed so a region with no activity yet can still be opened.
      if (S.oversight) ['Ahafo','Ashanti','Bono','Bono East','Central','Eastern','Greater Accra','North East','Northern','Oti','Savannah','Upper East','Upper West','Volta','Western','Western North'].forEach(function (n) { var k = norm(n); if (!seen[k] && !seen[k + '-region']) { seen[k] = true; out.push({ raw: n, label: n }); } });
      if (own && !seen[norm(own.raw)]) out.push(own);
      out.sort(function (a, b) { return a.label.localeCompare(b.label); });
      S.regions = out;
    });
  }
  function setView(raw) {
    S.view = { raw: raw || '', key: norm(raw), label: raw ? (raw === S.ownRaw ? titleCase(raw) : raw) : '' };
  }
  function changeRegion(raw) {
    ['regional', 'announcement'].forEach(detach);
    setView(raw);
    S.channels = buildChannels();
    S.channels.forEach(function (c) { if (c.paths.length) attach(c); });
    var id = S.active === 'announcement' ? 'announcement' : (chById(S.active) && /^room:|^national$/.test(S.active) ? S.active : 'regional');
    openChannel(id);
  }

  // ---------------------------------------------------------------- boot
  function wire() {
    document.addEventListener('click', function (e) {
      if (!e.target.closest('.msg-popup') && !e.target.closest('[data-act="menu"]')) closePopup();
      var tab = e.target.closest('.chat-tab[data-ch]');
      if (tab) { openChannel(tab.getAttribute('data-ch')); return; }
      if (e.target.closest('#tool-moderation')) { showModeration('open'); return; }
      if (e.target.closest('#tool-invite')) { showInvite(); return; }
      if (e.target.closest('#new-room-btn') || e.target.closest('#new-room-tab')) { showNewRoom(); return; }
      var el = e.target.closest('[data-act]');
      if (e.target.closest('#btn-push')) { registerPush(true); return; }
      if (e.target.closest('#btn-mute')) { toggleMute(); return; }
      if (e.target.closest('#btn-manage')) { var c = chById(S.active); if (c) showManageRoom(c); return; }
      if (e.target.closest('#btn-leave')) {
        var rc = chById(S.active);
        if (rc) confirmBox('Leave this room?', 'You will stop receiving its messages.', 'Leave').then(function (ok) {
          if (ok) call('manageChatRoom', { action: 'leave', roomId: rc.roomId }).then(function () { return loadRooms(); }).then(function () { openChannel('regional'); }).catch(function (er) { toast(errText(er), 'error'); });
        });
        return;
      }
      if (e.target.closest('#load-more')) { loadEarlier(); return; }
      if (!el) return;
      var act = el.getAttribute('data-act'), id = el.getAttribute('data-id');
      if (act === 'menu') { e.stopPropagation(); openMenu(el, id); }
      else if (act === 'react') { var ch = chById(S.active), m = findMsg(id); if (ch && m) toggleReaction(m, ch, el.getAttribute('data-emoji')); }
      else if (act === 'goto') gotoMessage(id);
      else if (act === 'open-file') window.open(el.getAttribute('data-url'), '_blank', 'noopener');
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closePopup();
      if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('chat-tab')) { e.preventDefault(); e.target.click(); }
    });
    document.addEventListener('visibilitychange', function () { var ch = chById(S.active); if (ch && !S.modView) { markSeen(ch); markRead(ch); } });
    window.addEventListener('scroll', closePopup, true);
    $('region-select').addEventListener('change', function () { changeRegion(this.value); });
  }

  function boot(user) {
    var p = user.profile || {};
    S.user = user; S.uid = user.uid; S.bootAt = Date.now() - 2000;
    S.role = String(p.role || 'member').toLowerCase();
    S.name = p.fullName || p.name || user.displayName || user.email || 'AMCAG Member';
    S.photo = p.profilePictureUrl || p.photoURL || p.photoUrl || '';
    S.isExec = EXEC_ROLES.indexOf(S.role) >= 0;
    S.isSuper = S.role === 'super_admin';
    S.ownRaw = String(p.regionId || p.region || p.regionName || p.assignedRegion || '').trim();
    S.ownKey = norm(S.ownRaw);
    loadSeen();

    var claims = Promise.resolve();
    if (typeof firebase.functions === 'function') {
      claims = call('refreshMyClaims').then(function (r) {
        S.oversight = !!(r && r.oversight);
        return firebase.auth().currentUser.getIdToken(true);
      }).catch(function (e) { console.warn('[chat] could not refresh chat access', e && e.message); });
    }
    return claims.then(loadRegions).then(function () {
      setView(S.ownRaw || (S.oversight && S.regions[0] ? S.regions[0].raw : ''));
      if (S.oversight) {
        var sel = $('region-select');
        sel.innerHTML = S.regions.map(function (r) { return '<option value="' + esc(r.raw) + '"' + (norm(r.raw) === S.view.key ? ' selected' : '') + '>' + esc(r.label) + '</option>'; }).join('');
        $('region-picker').style.display = '';
      }
      S.channels = buildChannels();
      $('new-room-btn').style.display = S.isExec ? '' : 'none';
      $('exec-tools').style.display = S.isExec ? '' : 'none';
      S.channels.forEach(function (c) { if (c.paths.length) attach(c); });
      var q = new URLSearchParams(window.location.search);
      var start = q.get('room') ? 'room:' + q.get('room') : (q.get('c') === 'announcement' || q.get('c') === 'national' ? q.get('c') : 'regional');
      if (start === 'national' && !S.isExec) start = 'regional';
      openChannel(chById(start) ? start : 'regional');
      return call('getChatPrefs').then(function (r) { (r.muted || []).forEach(function (k) { S.muted[k] = true; }); renderSidebar(); }).catch(function () { /* optional */ });
    }).then(function () {
      return loadRooms().then(function () {
        var q = new URLSearchParams(window.location.search);
        if (q.get('room') && chById('room:' + q.get('room'))) openChannel('room:' + q.get('room'));
        if (q.get('view') === 'moderation' && S.isExec) showModeration('open');
      });
    }).then(function () {
      refreshReportBadge();
      if ('Notification' in window && Notification.permission === 'granted') registerPush(false);
      else updatePushButton();
      if (pushSupported() === false && isIosBrowser()) { var b = $('notice-bar'); if (b && !b.textContent) b.textContent = 'Tip: on iPhone, add AMCAG to your Home Screen to receive notifications.'; }
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    wire();
    var started = false;
    AuthModule.onAuthStateChanged(function (user) {
      if (!user) { window.location.href = '/membership.html'; return; }
      if (started) return;
      started = true;
      boot(user).catch(function (e) { console.error('[chat] failed to start', e); toast('Chat could not start: ' + errText(e), 'error'); });
    });
  });
})();
