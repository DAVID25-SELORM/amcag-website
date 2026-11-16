// Wraps any table that is not already inside a scrolling box, so wide tables scroll sideways
// instead of being cut off. Also covers tables that pages render later with JavaScript.
(function () {
  var SCROLLERS = '.table-container, .table-responsive, .table-scroll-wrap, .data-table-wrapper';

  function wrap(table) {
    if (!table || table.dataset.scrollWrapped) return;
    table.dataset.scrollWrapped = '1';
    if (table.closest(SCROLLERS)) return;
    var box = document.createElement('div');
    box.className = 'table-scroll-wrap';
    table.parentNode.insertBefore(box, table);
    box.appendChild(table);
  }

  function scan(root) {
    (root.querySelectorAll ? root.querySelectorAll('table') : []).forEach(wrap);
    if (root.tagName === 'TABLE') wrap(root);
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
