/* Travel partners: validate and send the partner enquiry (site.js MFS.send). */
document.querySelectorAll('form.pf').forEach(function (f) {
  f.addEventListener('submit', function (e) {
    e.preventDefault(); var bad = null;
    f.querySelectorAll('[required]').forEach(function (el) {
      var v = (el.value || '').trim(), ok = el.type === 'checkbox' ? el.checked : (v !== '' && (el.type !== 'email' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)));
      el.setAttribute('aria-invalid', ok ? 'false' : 'true'); if (!ok && !bad) bad = el;
    });
    var err = f.querySelector('.pf-err'); if (bad) { err.hidden = false; bad.focus(); return; } err.hidden = true;
    var btn = f.querySelector('button[type="submit"]'), label = btn ? btn.innerHTML : '';
    if (btn) { btn.disabled = true; btn.textContent = T('Sending…'); }
    MFS.send(f, 'Travel partner enquiry', f.dataset.prefix || 'P').then(function (r) {
      var ok = document.getElementById(f.dataset.ok); ok.querySelector('.ref').textContent = r.ref;
      f.hidden = true; ok.hidden = false; ok.focus();
    }, function () {
      err.textContent = T('Sorry, that didn’t send. Please try again in a minute, or email us.'); err.hidden = false;
    }).then(function () { if (btn) { btn.disabled = false; btn.innerHTML = label; } });
  });
  f.addEventListener('input', function (e) { if (e.target.getAttribute('aria-invalid') === 'true') e.target.setAttribute('aria-invalid', 'false'); });
});
