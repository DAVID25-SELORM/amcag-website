// Adds a show/hide (eye) button to every password box, so people can check what they typed.
(function () {
  var css = '' +
    '.pt-wrap{position:relative;display:block;width:100%}' +
    '.pt-wrap>input{width:100%;box-sizing:border-box;padding-right:46px !important}' +
    '.pt-btn{position:absolute;right:6px;top:50%;transform:translateY(-50%);width:36px;height:36px;border:0;background:transparent;cursor:pointer;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#5a6778;padding:0}' +
    '.pt-btn:hover{background:rgba(11,93,59,.1);color:#0b5d3b}' +
    '.pt-btn svg{width:20px;height:20px;pointer-events:none}';

  var EYE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
  var EYE_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';

  function addStyle() {
    if (document.getElementById('pt-style')) return;
    var s = document.createElement('style');
    s.id = 'pt-style';
    s.textContent = css;
    document.head.appendChild(s);
  }

  function enhance(input) {
    if (input.dataset.ptDone) return;
    input.dataset.ptDone = '1';
    addStyle();
    var wrap = document.createElement('span');
    wrap.className = 'pt-wrap';
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pt-btn';
    btn.setAttribute('aria-label', 'Show password');
    btn.innerHTML = EYE;
    btn.addEventListener('click', function () {
      var show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.innerHTML = show ? EYE_OFF : EYE;
      btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
      input.focus();
    });
    wrap.appendChild(btn);
  }

  function scan(root) {
    if (!root.querySelectorAll) return;
    root.querySelectorAll('input[type="password"]').forEach(enhance);
  }

  function start() {
    scan(document);
    new MutationObserver(function (list) {
      list.forEach(function (m) {
        m.addedNodes.forEach(function (n) { if (n.nodeType === 1) scan(n); });
      });
    }).observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
