/* EvoSoft admin panel: the client finder (?view=finder). Each long step (a search, research, a draft) is its own POST
   to ?action=finder.<name> with the session's CSRF token, and gets JSON back. Everything that comes back is shown as
   text (textContent) and links only ever point to http(s) addresses: search results and AI answers are untrusted.
   © 2026 EvoSoft Solutions. All rights reserved. */
(function () {
  'use strict';

  var root = document.querySelector('.finder');
  if (!root) return;
  var meta = document.querySelector('meta[name="evo-csrf"]');
  var token = meta ? meta.getAttribute('content') : '';
  var base = window.location.pathname;
  var live = document.getElementById('finder-live');

  function say(text) {
    if (!live) return;
    live.textContent = '';
    window.setTimeout(function () { live.textContent = text; }, 40);
  }

  // ---- small DOM helpers (text only, never HTML) ----
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null && text !== '') e.textContent = String(text);
    return e;
  }
  function safeUrl(u) {
    if (typeof u !== 'string' || u === '') return '';
    try {
      var x = new URL(u);
      return (x.protocol === 'https:' || x.protocol === 'http:') && !x.username && !x.password ? x.href : '';
    } catch (e) { return ''; }
  }
  function host(u) {
    try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; }
  }
  /** A link to an outside page (new tab, no referrer), or plain text when the address isn't http(s). */
  function extLink(u, text, cls) {
    var href = safeUrl(u);
    if (!href) return el('span', '', text);
    var a = el('a', cls || '', text);
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener noreferrer nofollow';
    a.appendChild(el('span', 'sr-only', ' (opens in a new tab)'));
    return a;
  }
  /** A table cell (with its label for the phone layout) added to tr; returns the box to fill. One box per cell, so
      the phone layout's two-column grid always has the label on the left and everything else on the right. */
  function cell(tr, label, cls, head) {
    var td = el(head ? 'th' : 'td', cls);
    if (head) td.scope = 'row';
    td.setAttribute('data-label', label);
    var box = el('div', 'cell');
    td.appendChild(box);
    tr.appendChild(td);
    return box;
  }

  // ---- talking to the server ----
  function post(action, params) {
    var body = params instanceof URLSearchParams ? params : new URLSearchParams();
    if (!(params instanceof URLSearchParams)) {
      Object.keys(params || {}).forEach(function (k) { body.append(k, params[k]); });
    }
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = ctrl ? window.setTimeout(function () { ctrl.abort(); }, 150000) : 0;
    return fetch(base + '?action=finder.' + action, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Accept': 'application/json', 'X-CSRF-Token': token, 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: body.toString(),
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (r) {
      return r.text().then(function (t) {
        var j = null;
        try { j = JSON.parse(t); } catch (e) { j = null; }
        if (j && typeof j === 'object') {
          if (!r.ok && !j.error) j.error = 'The server answered with an error (HTTP ' + r.status + ').';
          j.httpStatus = r.status;
          return j;
        }
        if (r.status === 401 || r.redirected) return { ok: false, error: 'You were signed out. Reload the page and sign in again.' };
        return { ok: false, error: 'The server stopped the request (HTTP ' + r.status + '). Try again in a minute.' };
      });
    }, function () {
      return { ok: false, error: 'No answer from the server (the connection dropped or it took too long). Try again.' };
    }).then(function (j) {
      if (timer) window.clearTimeout(timer);
      if (j && j.usage) showUsage(j.usage);
      return j;
    });
  }

  function showUsage(u) {
    Object.keys(u).forEach(function (k) {
      var s = document.querySelector('#finder-usage [data-u="' + k + '"]');
      if (s) s.textContent = String(u[k]);
    });
  }

  /** A button that can't be pressed twice while its step runs (aria-disabled keeps focus on it). */
  function busy(btn, on, label) {
    if (!btn) return;
    if (on) {
      btn.setAttribute('aria-disabled', 'true');
      btn.classList.add('is-busy');
      if (label) { btn.finderLabel = Array.prototype.slice.call(btn.childNodes); btn.textContent = label; }
    } else {
      btn.removeAttribute('aria-disabled');
      btn.classList.remove('is-busy');
      if (btn.finderLabel) {
        btn.textContent = '';
        btn.finderLabel.forEach(function (n) { btn.appendChild(n); }); // keeps any screen-reader-only words
        btn.finderLabel = null;
      }
    }
  }
  function isBusy(btn) { return btn && btn.getAttribute('aria-disabled') === 'true'; }

  /** A line in a progress list: running → done / error. */
  function progressLine(list, label) {
    var li = el('li', 'is-running');
    var name = el('strong', '', label + ': ');
    var text = el('span', '', 'searching…');
    li.appendChild(name);
    li.appendChild(text);
    list.appendChild(li);
    return {
      done: function (msg) { li.className = 'is-done'; text.textContent = msg; },
      fail: function (msg) { li.className = 'is-error'; text.textContent = msg; }
    };
  }

  function fieldError(input, errEl, msg) {
    if (!errEl) return;
    if (msg) {
      errEl.textContent = msg;
      errEl.hidden = false;
      if (input) { input.setAttribute('aria-invalid', 'true'); input.focus(); }
    } else {
      errEl.textContent = '';
      errEl.hidden = true;
      if (input) input.removeAttribute('aria-invalid');
    }
  }

  function showButtons(scope) {
    Array.prototype.forEach.call((scope || document).querySelectorAll('button[hidden][type="submit"], button[hidden][data-research], button[hidden][data-draft]'), function (b) { b.hidden = false; });
  }
  showButtons(root);

  // ---- results tables with "Save selected to leads" (local businesses and tenders) ----
  function resultsTable(kind) {
    var section = document.getElementById(kind + '-results');
    if (!section) return null;
    var tbody = document.getElementById(kind + '-rows');
    var bodyWrap = document.getElementById(kind + '-body');
    var saveBtn = document.getElementById(kind + '-save');
    var saveState = document.getElementById(kind + '-save-state');
    var all = document.getElementById(kind + '-all');
    var credit = document.getElementById(kind + '-osm-credit');
    var items = [];
    var step = 50;
    var limit = step;
    // long result lists are shown 50 rows at a time
    var more = el('button', 'btn results-more');
    more.type = 'button';
    more.hidden = true;
    bodyWrap.insertBefore(more, bodyWrap.querySelector('.table-wrap').nextSibling);
    var syncMore = function () {
      var left = items.length - limit;
      more.hidden = left <= 0;
      more.textContent = 'Show ' + Math.min(step, left) + ' more (' + left + ' not shown)';
    };
    more.addEventListener('click', function () {
      var first = null;
      items.slice(limit, limit + step).forEach(function (it) { it.tr.hidden = false; first = first || it.tr; });
      limit += step;
      syncMore();
      var cb = first && first.querySelector('input, a');
      if (cb) cb.focus();
    });

    function reset() {
      items = [];
      limit = step;
      more.hidden = true;
      tbody.textContent = '';
      document.getElementById(kind + '-progress').textContent = '';
      bodyWrap.hidden = true;
      if (credit) credit.hidden = true;
      saveState.textContent = '';
      all.checked = false;
      section.hidden = false;
    }
    function savedBadge(td, leadId) {
      td.textContent = '';
      var a = el('a', 'badge fst-saved', 'Saved');
      a.href = base + '?view=finder&tab=leads&lead=' + encodeURIComponent(leadId);
      a.setAttribute('aria-label', 'Saved: open the lead');
      td.appendChild(a);
    }
    function add(search, row, render) {
      var idx = items.length;
      items.push({ search: search, key: row.key, row: row });
      var tr = el('tr');
      var sel = cell(tr, 'Select', 'sel');
      if (row.saved) {
        savedBadge(sel, row.saved);
      } else {
        var cb = el('input');
        cb.type = 'checkbox';
        cb.id = kind + '-r' + idx;
        cb.value = String(idx);
        var lab = el('label', 'sr-only', 'Select ' + (row.name || 'this row'));
        lab.htmlFor = cb.id;
        sel.appendChild(cb);
        sel.appendChild(lab);
      }
      render(tr, row);
      tr.hidden = idx >= limit;
      tbody.appendChild(tr);
      items[idx].tr = tr;
      syncMore();
      bodyWrap.hidden = false;
      if (credit && row.source === 'osm') credit.hidden = false;
    }
    all.addEventListener('change', function () {
      Array.prototype.forEach.call(tbody.querySelectorAll('tr:not([hidden]) input[type="checkbox"]'), function (c) { c.checked = all.checked; });
    });
    saveBtn.addEventListener('click', function () {
      if (isBusy(saveBtn)) return;
      var chosen = [];
      Array.prototype.forEach.call(tbody.querySelectorAll('input[type="checkbox"]:checked'), function (c) {
        var it = items[parseInt(c.value, 10)];
        if (it) chosen.push(it);
      });
      if (!chosen.length) { saveState.textContent = 'Select at least one row first.'; say(saveState.textContent); return; }
      busy(saveBtn, true, 'Saving…');
      post('save', { items: JSON.stringify(chosen.map(function (it) { return { search: it.search, key: it.key }; })) }).then(function (j) {
        busy(saveBtn, false);
        saveState.textContent = j.ok ? j.message : j.error;
        say(saveState.textContent);
        if (!j.ok) return;
        chosen.forEach(function (it) {
          var id = (j.saved && j.saved[it.key]) || (j.duplicates && j.duplicates[it.key]);
          if (id) savedBadge(it.tr.querySelector('td.sel .cell'), id);
        });
        all.checked = false;
      });
    });
    return { reset: reset, add: add, progress: document.getElementById(kind + '-progress'), heading: section.querySelector('h2') };
  }

  // ---- Local businesses ----
  var localForm = document.getElementById('local-form');
  if (localForm) {
    var niche = document.getElementById('l-niche');
    var otherField = document.getElementById('l-other-field');
    var osmBox = document.getElementById('l-src-osm');
    var aiBox = document.getElementById('l-src-ai');
    var city = document.getElementById('l-city');
    var cityErr = document.getElementById('l-city-error');
    var formErr = document.getElementById('l-form-error');
    var go = localForm.querySelector('button[type="submit"]');
    var table = resultsTable('local');
    var osmWas = true;
    var syncNiche = function () {
      var other = niche.value === 'other';
      otherField.hidden = !other;
      if (other) { osmWas = osmBox.checked; osmBox.checked = false; osmBox.disabled = true; } else if (osmBox.disabled) { osmBox.disabled = false; osmBox.checked = osmWas; }
    };
    niche.addEventListener('change', syncNiche);
    syncNiche();

    var renderLocal = function (tr, r) {
      var th = cell(tr, 'Business', 'biz', true);
      th.appendChild(el('span', 'name', r.name));
      th.appendChild(el('span', 'src', r.category));
      if (r.reason) th.appendChild(el('span', 'reason', r.reason));
      cell(tr, 'Address').textContent = r.address || '—';
      cell(tr, 'Phone', 'tel').textContent = r.phone || '—';
      var o = cell(tr, 'Online');
      var labels = { none: 'No website', social_only: 'Social page only', weak: 'Weak website', ok: 'Has a website', unknown: 'Not checked' };
      o.appendChild(el('span', 'ws ws-' + (r.website_status || 'unknown'), labels[r.website_status] || labels.unknown));
      if (r.website) { o.appendChild(el('br')); o.appendChild(extLink(r.website, host(r.website))); }
      (r.social || []).forEach(function (s) { o.appendChild(el('br')); o.appendChild(extLink(s, host(s))); });
      if (r.email) { o.appendChild(el('br')); o.appendChild(el('span', 'email', r.email)); }
      var s = cell(tr, 'Source');
      s.textContent = r.source === 'osm' ? 'OpenStreetMap' : 'AI web search';
      if (r.source === 'web' && !r.verified) s.appendChild(el('span', 'src warn', 'Page not among the search results: check it'));
      cell(tr, 'Link').appendChild(extLink(r.link, r.source === 'osm' ? 'Map entry' : (host(r.link) || 'Page')));
    };

    localForm.addEventListener('submit', function (ev) {
      ev.preventDefault();
      if (isBusy(go)) return;
      fieldError(city, cityErr, '');
      fieldError(null, formErr, '');
      if (city.value.trim().length < 2) { fieldError(city, cityErr, 'Type the city or town.'); return; }
      var other = document.getElementById('l-other');
      if (niche.value === 'other' && other.value.trim().length < 3) { fieldError(other, formErr, 'Type the kind of business you’re looking for.'); return; }
      var sources = [];
      if (osmBox.checked && !osmBox.disabled) sources.push(['local_osm', 'OpenStreetMap']);
      if (aiBox && aiBox.checked && !aiBox.disabled) sources.push(['local_ai', 'AI web search']);
      if (!sources.length) { fieldError(osmBox.disabled ? aiBox : osmBox, formErr, 'Choose at least one source.'); return; }
      var data = new URLSearchParams(new FormData(localForm));
      table.reset();
      busy(go, true, 'Searching…');
      say('Searching. This can take a minute.');
      var found = 0;
      var next = function (i) {
        if (i >= sources.length) {
          busy(go, false);
          say('Search finished: ' + found + ' results.');
          return;
        }
        var line = progressLine(table.progress, sources[i][1]);
        post(sources[i][0], data).then(function (j) {
          if (j.ok) {
            (j.rows || []).forEach(function (r) { table.add(j.search, r, renderLocal); });
            found += (j.rows || []).length;
            line.done(j.note + (j.cached ? ' (from the 24-hour cache, searched at ' + j.cachedAt + ')' : ''));
          } else {
            line.fail(j.error || 'Failed.');
          }
          next(i + 1);
        });
      };
      next(0);
    });
  }

  // ---- Tenders ----
  var tedForm = document.getElementById('ted-form');
  if (tedForm) {
    var tgo = tedForm.querySelector('button[type="submit"]');
    var terr = document.getElementById('t-form-error');
    var ttable = resultsTable('ted');
    var summary = document.getElementById('tc-summary');
    var countBoxes = tedForm.querySelectorAll('input[name="countries[]"]');
    var syncCountries = function () {
      var n = tedForm.querySelectorAll('input[name="countries[]"]:checked').length;
      summary.textContent = n === 0 ? 'all' : (n === 1 ? '1 selected' : n + ' selected');
    };
    Array.prototype.forEach.call(countBoxes, function (c) { c.addEventListener('change', syncCountries); });
    var money = function (v, cur) {
      if (typeof v !== 'number') return '—';
      return v.toLocaleString('en-GB', { maximumFractionDigits: 0 }) + ' ' + (cur || '');
    };
    var renderTed = function (tr, r) {
      var t = r.tender || {};
      var th = cell(tr, 'Tender', 'biz', true);
      th.appendChild(el('span', 'name', t.title));
      th.appendChild(el('span', 'src', 'Published ' + (r.published || '—') + (r.cpv && r.cpv.length ? ' · CPV ' + r.cpv.join(', ') : '')));
      var b = cell(tr, 'Buyer');
      b.appendChild(el('span', '', r.name));
      var where = [r.city, r.country_name || r.country].filter(Boolean).join(', ');
      if (where) b.appendChild(el('span', 'src', where));
      cell(tr, 'Deadline', 'num').textContent = t.deadline || '—';
      cell(tr, 'Estimated value', 'num').textContent = money(t.value, t.currency);
      cell(tr, 'Notice').appendChild(extLink(r.link, 'Notice on TED'));
    };
    tedForm.addEventListener('submit', function (ev) {
      ev.preventDefault();
      if (isBusy(tgo)) return;
      fieldError(null, terr, '');
      if (!tedForm.querySelectorAll('input[name="cpv[]"]:checked').length) {
        fieldError(tedForm.querySelector('input[name="cpv[]"]'), terr, 'Choose at least one kind of work.');
        return;
      }
      ttable.reset();
      busy(tgo, true, 'Searching…');
      say('Searching TED.');
      var line = progressLine(ttable.progress, 'TED');
      post('ted_search', new URLSearchParams(new FormData(tedForm))).then(function (j) {
        busy(tgo, false);
        if (j.ok) {
          (j.rows || []).forEach(function (r) { ttable.add(j.search, r, renderTed); });
          line.done(j.note + (j.cached ? ' (from the cache, searched at ' + j.cachedAt + ')' : ''));
        } else {
          line.fail(j.error || 'Failed.');
        }
        say('TED search finished.');
      });
    });
  }

  // ---- Upwork ----
  var connect = document.getElementById('upw-connect');
  if (connect) {
    connect.addEventListener('submit', function (ev) {
      var btn = connect.querySelector('button');
      ev.preventDefault();
      if (isBusy(btn)) return;
      busy(btn, true, 'Opening Upwork…');
      post('upwork_connect', {}).then(function (j) {
        var url = j && j.ok ? safeUrl(j.url) : '';
        if (url) { window.location.assign(url); return; }
        busy(btn, false);
        say(j.error || 'Couldn’t start the Upwork sign-in.');
        connect.submit(); // the page version shows the reason, or a link to continue
      });
    });
  }
  var upForm = document.getElementById('upwork-form');
  if (upForm) {
    var ugo = upForm.querySelector('button[type="submit"]');
    var uerr = document.getElementById('u-form-error');
    var usection = document.getElementById('upwork-results');
    var ulist = document.getElementById('upwork-rows');
    var uprog = document.getElementById('upwork-progress');
    var budget = function (j) {
      var f = function (v) { return '$' + Math.round(v).toLocaleString('en-US'); };
      if (j.type === 'HOURLY') {
        if (j.min && j.max && j.max !== j.min) return 'Hourly ' + f(j.min) + '–' + f(j.max);
        if (j.min || j.max) return 'Hourly ' + f(j.min || j.max);
        return 'Hourly, rate not given';
      }
      return j.min ? 'Fixed price ' + f(j.min) + (j.currency && j.currency !== 'USD' ? ' ' + j.currency : '') : 'Fixed price, budget not given';
    };
    var levels = { ENTRY_LEVEL: 'Entry level', INTERMEDIATE: 'Intermediate', EXPERT: 'Expert' };
    var trackForm = function (j, holder) {
      var wrap = el('div', 'track');
      var id = 'track-' + j.id;
      var lab = el('label', '', 'Your note (optional)');
      lab.htmlFor = id;
      var inp = el('input');
      inp.type = 'text';
      inp.id = id;
      inp.maxLength = 1000;
      var save = el('button', 'btn small primary', 'Save to leads');
      save.type = 'button';
      var state = el('span', 'row-state');
      wrap.appendChild(lab);
      wrap.appendChild(inp);
      wrap.appendChild(save);
      wrap.appendChild(state);
      save.addEventListener('click', function () {
        if (isBusy(save)) return;
        busy(save, true, 'Saving…');
        post('upwork_track', { job: j.job, note: inp.value }).then(function (r) {
          busy(save, false);
          state.textContent = r.ok ? r.message : r.error;
          say(state.textContent);
        });
      });
      holder.appendChild(wrap);
      inp.focus();
    };
    upForm.addEventListener('submit', function (ev) {
      ev.preventDefault();
      if (isBusy(ugo)) return;
      fieldError(null, uerr, '');
      if (!upForm.querySelectorAll('input[name="kw[]"]:checked').length && !document.getElementById('u-own').value.trim()) {
        fieldError(upForm.querySelector('input[name="kw[]"]'), uerr, 'Choose at least one keyword, or type your own.');
        return;
      }
      usection.hidden = false;
      ulist.textContent = '';
      uprog.textContent = '';
      busy(ugo, true, 'Searching…');
      say('Searching Upwork.');
      var line = progressLine(uprog, 'Upwork');
      post('upwork_search', new URLSearchParams(new FormData(upForm))).then(function (r) {
        busy(ugo, false);
        if (!r.ok) { line.fail(r.error || 'Failed.'); say(r.error || 'Failed.'); return; }
        line.done(r.note + (r.cached ? ' (from the cache, searched at ' + r.cachedAt + ')' : ''));
        say(r.note);
        (r.rows || []).forEach(function (j) {
          var li = el('li', 'job card');
          li.appendChild(el('h3', '', j.title));
          var m = [j.posted ? 'Posted ' + j.posted : '', budget(j), levels[j.level] || ''].filter(Boolean).join(' · ');
          li.appendChild(el('p', 'meta-line', m));
          if (j.skills && j.skills.length) {
            var ul = el('ul', 'chips');
            ul.setAttribute('aria-label', 'Skills');
            j.skills.forEach(function (s) { ul.appendChild(el('li', '', s)); });
            li.appendChild(ul);
          }
          var c = [];
          if (j.country) c.push(j.country);
          if (j.rating) c.push('rating ' + j.rating + '/5' + (j.reviews ? ' (' + j.reviews + ' reviews)' : ''));
          if (j.spent) c.push('$' + Math.round(j.spent).toLocaleString('en-US') + ' spent');
          if (typeof j.hires === 'number') c.push(j.hires + (j.hires === 1 ? ' hire' : ' hires'));
          if (j.verified) c.push('payment verified');
          if (c.length) li.appendChild(el('p', 'small', 'Client: ' + c.join(' · ')));
          if (j.snippet) li.appendChild(el('p', 'small muted snippet', j.snippet));
          var act = el('div', 'row-actions');
          act.appendChild(extLink(j.url, 'Open on Upwork', 'btn small primary'));
          var tb = el('button', 'btn small', 'Track');
          tb.type = 'button';
          tb.setAttribute('aria-expanded', 'false');
          tb.addEventListener('click', function () {
            if (tb.getAttribute('aria-expanded') === 'true') return;
            tb.setAttribute('aria-expanded', 'true');
            trackForm(j, li);
          });
          act.appendChild(tb);
          li.appendChild(act);
          ulist.appendChild(li);
        });
      });
    });
  }

  // ---- Leads: research (list rows and one lead), draft emails ----
  Array.prototype.forEach.call(root.querySelectorAll('button[data-research]'), function (btn) {
    btn.addEventListener('click', function () {
      if (isBusy(btn)) return;
      var id = btn.getAttribute('data-research');
      var row = btn.closest('tr');
      var state = row ? row.querySelector('[data-state]') : root.querySelector('[data-state-for="' + id + '"]');
      busy(btn, true, 'Researching…');
      if (state) { state.className = 'row-state is-running'; state.textContent = 'Researching on the web. This can take up to a minute and a half.'; }
      say('Researching. This can take up to a minute and a half.');
      post('lead_research', { id: id }).then(function (j) {
        busy(btn, false);
        if (state) { state.className = 'row-state ' + (j.ok ? 'is-done' : 'is-error'); state.textContent = j.ok ? j.message : j.error; }
        say(j.ok ? j.message : j.error);
        if (!j.ok) return;
        if (row) {
          var sc = row.querySelector('[data-score]');
          if (sc) sc.textContent = String(j.score);
        }
        if (btn.getAttribute('data-reload')) window.setTimeout(function () { window.location.reload(); }, 600);
      });
    });
  });

  var draftForm = document.getElementById('draft-form');
  if (draftForm) {
    var subj = document.getElementById('d-subject');
    var bodyBox = document.getElementById('d-body');
    var mail = document.getElementById('d-mailto');
    var copy = document.getElementById('d-copy');
    var to = draftForm.getAttribute('data-to') || '';
    var syncMail = function () {
      mail.href = 'mailto:' + encodeURIComponent(to).replace('%40', '@') + '?subject=' + encodeURIComponent(subj.value) + '&body=' + encodeURIComponent(bodyBox.value);
    };
    subj.addEventListener('input', syncMail);
    bodyBox.addEventListener('input', syncMail);
    if (copy && navigator.clipboard && window.isSecureContext) {
      copy.hidden = false;
      copy.addEventListener('click', function () {
        navigator.clipboard.writeText(subj.value + '\n\n' + bodyBox.value).then(function () {
          copy.textContent = 'Copied';
          say('Copied the subject and message.');
          window.setTimeout(function () { copy.textContent = 'Copy'; }, 2000);
        }, function () { say('Copying didn’t work. Select the text and copy it instead.'); });
      });
    }
    var dbtn = draftForm.querySelector('button[data-draft]');
    if (dbtn) {
      dbtn.addEventListener('click', function () {
        if (isBusy(dbtn)) return;
        var id = dbtn.getAttribute('data-draft');
        var state = draftForm.querySelector('[data-state-for="draft-' + id + '"]');
        busy(dbtn, true, 'Writing…');
        state.className = 'row-state is-running';
        state.textContent = 'Writing a draft. This takes up to a minute.';
        say(state.textContent);
        post('lead_draft', { id: id, lang: document.getElementById('d-lang').value }).then(function (j) {
          busy(dbtn, false);
          state.className = 'row-state ' + (j.ok ? 'is-done' : 'is-error');
          state.textContent = j.ok ? j.message : j.error;
          say(state.textContent);
          if (!j.ok) return;
          subj.value = j.subject || '';
          bodyBox.value = j.body || '';
          syncMail();
        });
      });
    }
  }
})();
