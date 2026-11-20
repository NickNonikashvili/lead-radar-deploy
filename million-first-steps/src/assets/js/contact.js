/* Contact page: revealed email/phone with a copy button, the topic switch that shows the trip
   fields, steppers and moods, and sending the message (site.js MFS.send). */
(function () {
  // Email and phone are revealed on click, with a copy button.
  function dec(v) { try { return atob(v).split('').reverse().join(''); } catch (e) { return ''; } }
  document.querySelectorAll('.rv2').forEach(function (r) {
    r.querySelector('.reveal').addEventListener('click', function () {
      var v = dec(r.dataset.v), href = r.dataset.k === 'mail' ? 'mailto:' + v : 'tel:' + v.replace(/[^+\d]/g, '');
      r.innerHTML = '<span class="revealed"><a href="' + href + '">' + v + '</a><button type="button" class="copy">' + T('Copy') + '</button></span>';
      r.querySelector('a').focus();
      r.querySelector('.copy').addEventListener('click', function () { var b = this; try { navigator.clipboard.writeText(v).then(function () { b.textContent = T('Copied'); }); } catch (e) {} });
    });
  });

  // "A custom trip" shows the trip fields.
  var tp = document.getElementById('c-tp'), cu = document.getElementById('c-cust'), ph = document.getElementById('c-ph');
  if (tp) {
    var sync = function () {
      var on = tp.value === 'custom'; cu.hidden = !on; ph.required = on;
      var mg = document.getElementById('c-msg'); mg.required = !on; document.getElementById('c-msg-opt').hidden = !on;
      document.getElementById('c-msg-t').textContent = on ? T('Anything else?') : T('Message');
      mg.placeholder = on ? T('A special occasion, food or mobility needs, places you dream of…') : T('How can we help?');
      mg.rows = on ? 2 : 4; mg.classList.toggle('short', on);
    };
    var q = new URLSearchParams(location.search), qt = q.get('topic');
    if (qt && tp.querySelector('option[value="' + qt + '"]')) tp.value = qt;
    tp.addEventListener('change', sync); sync();
    if (qt === 'custom') { var nm = document.getElementById('c-nm'); if (nm) setTimeout(function () { nm.focus({ preventScroll: true }); }, 50); }
    // Coming from a tour page: the tour, travel style and party size are filled in.
    var tour = q.get('tour'), tier = q.get('tier'), party = +q.get('party');
    var likes = document.querySelector('input[id$="-likes"]');
    if (tour && likes) likes.value = tour + (tier ? ' (' + tier + ')' : '');
    if (party && window.mfsSetTravellers) window.mfsSetTravellers(party);
  }

  // Steppers
  document.querySelectorAll('.stepper').forEach(function (s) {
    var o = s.querySelector('output'), mn = +s.dataset.min, bs = s.querySelectorAll('button');
    function paint() { bs[0].disabled = (+o.value) <= mn; }
    s.addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; o.value = Math.max(mn, Math.min(20, (+o.value) + (+b.dataset.d))); paint(); }); paint();
  });
  // Dates: no past dates, departure after arrival
  var today = new Date(); today.setMinutes(today.getMinutes() - today.getTimezoneOffset()); var t = today.toISOString().slice(0, 10);
  document.querySelectorAll('input[type=date]').forEach(function (d) { d.min = t; });
  document.querySelectorAll('[id$="-from"]').forEach(function (a) { var b = document.getElementById(a.id.replace('-from', '-to')); if (b) a.addEventListener('change', function () { b.min = a.value || t; if (b.value && b.value < a.value) b.value = ''; }); });
  // Moods → "Would like to see"
  document.querySelectorAll('.moods').forEach(function (m) {
    var inp = m.parentNode.querySelector('input[id$="-likes"]');
    m.addEventListener('click', function (e) {
      var b = e.target.closest('.mood'); if (!b) return; var on = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', on);
      var parts = inp.value.split(',').map(function (x) { return x.trim(); }).filter(Boolean), v = b.dataset.v;
      if (on) { if (parts.indexOf(v) < 0) parts.push(v); } else { parts = parts.filter(function (x) { return x !== v; }); }
      inp.value = parts.join(', ');
    });
  });

  // Validation and sending
  document.querySelectorAll('form.rq').forEach(function (f) {
    f.addEventListener('submit', function (e) {
      e.preventDefault(); var bad = null;
      f.querySelectorAll('[required]').forEach(function (el) {
        if (el.closest('[hidden]')) return;
        var v = (el.value || '').trim(), ok = el.type === 'checkbox' ? el.checked : (v !== '' && (el.type !== 'email' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)));
        var box = el.closest('.tel2') || el; box.setAttribute('aria-invalid', ok ? 'false' : 'true'); if (!ok && !bad) bad = el;
      });
      var err = f.querySelector('.rq-err'); if (bad) { err.hidden = false; bad.focus(); return; } err.hidden = true;
      var topic = tp ? tp.options[tp.selectedIndex].value : '';
      var btn = f.querySelector('button[type="submit"]'), label = btn ? btn.innerHTML : '';
      if (btn) { btn.disabled = true; btn.textContent = T('Sending…'); }
      MFS.send(f, topic === 'custom' ? 'Trip request (contact page)' : 'Message from the contact page', f.dataset.prefix || 'C').then(function (r) {
        var ok = document.getElementById(f.dataset.ok); ok.querySelector('.ref').textContent = r.ref;
        f.hidden = true; ok.hidden = false; ok.focus();
      }, function () {
        err.textContent = T('Sorry, that didn’t send. Please try again in a minute, or email us.'); err.hidden = false;
      }).then(function () { if (btn) { btn.disabled = false; btn.innerHTML = label; } });
    });
    f.addEventListener('input', function (e) { var box = e.target.closest('.tel2') || e.target; if (box.getAttribute('aria-invalid') === 'true') box.setAttribute('aria-invalid', 'false'); });
  });
})();
