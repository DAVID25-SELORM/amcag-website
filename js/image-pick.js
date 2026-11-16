// Adds a "Choose image from computer" button next to an image-link field.
// The picked image is uploaded to Firebase Storage (site-images/{uid}/...) and its link is put in the field,
// so the existing form keeps saving the link exactly as before.
(function () {
  function attach(inputId, options) {
    var input = document.getElementById(inputId);
    if (!input || input.dataset.pickerReady) return;
    input.dataset.pickerReady = '1';
    var wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;gap:.5rem;align-items:center;flex-wrap:wrap;margin-top:.5rem;';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-outline btn-sm';
    btn.textContent = '📁 Choose image from computer';
    var hint = document.createElement('small');
    hint.style.color = 'var(--text-secondary)';
    hint.textContent = 'JPG or PNG, up to 5 MB';
    var file = document.createElement('input');
    file.type = 'file';
    file.accept = 'image/*';
    file.style.display = 'none';
    wrap.appendChild(btn); wrap.appendChild(hint); wrap.appendChild(file);
    input.insertAdjacentElement('afterend', wrap);

    btn.addEventListener('click', function () { file.click(); });
    file.addEventListener('change', async function () {
      var f = file.files && file.files[0];
      if (!f) return;
      var notify = function (m, t) { if (window.UIModule && UIModule.showAlert) UIModule.showAlert(m, t); else alert(m); };
      if (!/^image\//.test(f.type)) { notify('Please choose an image file.', 'error'); file.value = ''; return; }
      if (f.size > 5 * 1024 * 1024) { notify('That image is larger than 5 MB. Please choose a smaller one.', 'error'); file.value = ''; return; }
      var user = firebase.auth().currentUser;
      if (!user) { notify('Please sign in again.', 'error'); return; }
      var original = btn.textContent;
      btn.disabled = true; btn.textContent = 'Uploading...';
      try {
        var safe = f.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        var ref = firebase.storage().ref('site-images/' + user.uid + '/' + (options && options.folder ? options.folder + '-' : '') + Date.now() + '-' + safe);
        await ref.put(f, { contentType: f.type });
        input.value = await ref.getDownloadURL();
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        notify('Image uploaded.', 'success');
      } catch (e) {
        notify('Upload failed: ' + (e.message || 'please try again'), 'error');
      }
      btn.disabled = false; btn.textContent = original; file.value = '';
    });
  }
  window.AMCAGImagePick = { attach: attach };
})();
