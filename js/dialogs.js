// AMCAG in-app dialogs: styled replacements for the browser's alert(), confirm() and prompt().
//   AMCAGDialog.confirm(message, options)  -> Promise<boolean>
//   AMCAGDialog.prompt(message, default)   -> Promise<string|null>
//   AMCAGDialog.toast(message, type)       -> shows a banner (type: success | error | info)
// window.alert is replaced by a non-blocking toast, so existing alert() calls keep working.
(function () {
  if (window.AMCAGDialog) return;

  var css = '' +
    '.amd-back{position:fixed;inset:0;background:rgba(15,28,22,.55);display:flex;align-items:center;justify-content:center;z-index:100000;padding:16px;opacity:0;transition:opacity .15s}' +
    '.amd-back.on{opacity:1}' +
    '.amd-box{background:#fff;border-radius:14px;max-width:440px;width:100%;box-shadow:0 18px 50px rgba(0,0,0,.3);overflow:hidden;font-family:Inter,Segoe UI,Arial,sans-serif;transform:translateY(8px);transition:transform .15s}' +
    '.amd-back.on .amd-box{transform:none}' +
    '.amd-head{background:#0b5d3b;color:#fff;padding:14px 20px;font-weight:700;font-size:1rem}' +
    '.amd-head.danger{background:#b3261e}' +
    '.amd-body{padding:20px;color:#1a2433;line-height:1.5;font-size:.97rem;white-space:pre-wrap;word-break:break-word;max-height:55vh;overflow:auto}' +
    '.amd-input{width:100%;box-sizing:border-box;margin-top:12px;padding:10px 12px;border:1px solid #cfd8d2;border-radius:8px;font:inherit}' +
    '.amd-input:focus{outline:2px solid #0b5d3b;border-color:#0b5d3b}' +
    '.amd-foot{display:flex;gap:10px;justify-content:flex-end;padding:0 20px 18px}' +
    '.amd-btn{border:0;border-radius:8px;padding:10px 18px;font:inherit;font-weight:600;cursor:pointer}' +
    '.amd-ok{background:#0b5d3b;color:#fff}.amd-ok.danger{background:#b3261e}' +
    '.amd-cancel{background:#eef2ef;color:#1a2433}' +
    '.amd-toasts{position:fixed;top:16px;right:16px;left:16px;display:flex;flex-direction:column;align-items:flex-end;gap:10px;z-index:100001;pointer-events:none}' +
    '.amd-toast{pointer-events:auto;max-width:420px;background:#0b5d3b;color:#fff;padding:12px 16px;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.25);font:600 .93rem/1.45 Inter,Segoe UI,Arial,sans-serif;white-space:pre-wrap;word-break:break-word;cursor:pointer;opacity:0;transform:translateY(-6px);transition:all .2s}' +
    '.amd-toast.on{opacity:1;transform:none}' +
    '.amd-toast.error{background:#b3261e}.amd-toast.info{background:#33415c}';

  function addStyle() {
    if (document.getElementById('amd-style')) return;
    var s = document.createElement('style');
    s.id = 'amd-style';
    s.textContent = css;
    document.head.appendChild(s);
  }

  function ready(fn) {
    if (document.body) fn(); else document.addEventListener('DOMContentLoaded', fn);
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function open(opts) {
    return new Promise(function (resolve) {
      ready(function () {
        addStyle();
        var back = el('div', 'amd-back');
        var box = el('div', 'amd-box');
        box.setAttribute('role', 'dialog');
        box.setAttribute('aria-modal', 'true');
        box.appendChild(el('div', 'amd-head' + (opts.danger ? ' danger' : ''), opts.title));
        box.appendChild(el('div', 'amd-body', opts.message));
        var input = null;
        if (opts.input) {
          input = el('input', 'amd-input');
          input.type = 'text';
          input.value = opts.defaultValue || '';
          box.lastChild.appendChild(input);
        }
        var foot = el('div', 'amd-foot');
        var cancel = el('button', 'amd-btn amd-cancel', opts.cancelText);
        var ok = el('button', 'amd-btn amd-ok' + (opts.danger ? ' danger' : ''), opts.okText);
        cancel.type = ok.type = 'button';
        foot.appendChild(cancel);
        foot.appendChild(ok);
        box.appendChild(foot);
        back.appendChild(box);
        document.body.appendChild(back);

        function done(value) {
          document.removeEventListener('keydown', onKey, true);
          back.classList.remove('on');
          setTimeout(function () { back.remove(); }, 160);
          resolve(value);
        }
        function accept() { done(input ? input.value : true); }
        function reject() { done(input ? null : false); }
        function onKey(e) {
          if (e.key === 'Escape') { e.preventDefault(); reject(); }
          else if (e.key === 'Enter' && (input || document.activeElement !== cancel)) { e.preventDefault(); accept(); }
        }
        ok.addEventListener('click', accept);
        cancel.addEventListener('click', reject);
        back.addEventListener('mousedown', function (e) { if (e.target === back) reject(); });
        document.addEventListener('keydown', onKey, true);
        requestAnimationFrame(function () {
          back.classList.add('on');
          (input || ok).focus();
          if (input) input.select();
        });
      });
    });
  }

  var toastBox = null;
  function toast(message, type) {
    ready(function () {
      addStyle();
      if (!toastBox) {
        toastBox = el('div', 'amd-toasts');
        document.body.appendChild(toastBox);
      }
      var text = String(message == null ? '' : message);
      var kind = type;
      if (!kind) {
        kind = /(^|\b)(error|fail|failed|unable|could not|cannot|can't|invalid|denied|not allowed|something went wrong|please (select|enter|fill|provide|choose))/i.test(text) ? 'error' : 'success';
      }
      var t = el('div', 'amd-toast ' + kind, text);
      toastBox.appendChild(t);
      requestAnimationFrame(function () { t.classList.add('on'); });
      var remove = function () { t.classList.remove('on'); setTimeout(function () { t.remove(); }, 220); };
      t.addEventListener('click', remove);
      setTimeout(remove, Math.min(12000, 3500 + text.length * 45));
    });
  }

  window.AMCAGDialog = {
    confirm: function (message, options) {
      options = options || {};
      var text = String(message == null ? '' : message);
      return open({
        title: options.title || 'Please confirm',
        message: text,
        okText: options.okText || 'OK',
        cancelText: options.cancelText || 'Cancel',
        danger: options.danger != null ? options.danger : /delete|remove|reject|suspend|cannot be undone|sign out/i.test(text)
      });
    },
    prompt: function (message, defaultValue, options) {
      options = options || {};
      return open({
        title: options.title || 'Enter details',
        message: String(message == null ? '' : message),
        input: true,
        defaultValue: defaultValue,
        okText: options.okText || 'OK',
        cancelText: options.cancelText || 'Cancel'
      });
    },
    toast: toast
  };

  window.alert = function (message) { toast(message); };
})();
