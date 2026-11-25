/* EvoSoft admin panel. Small extras on top of pages that work without scripts.
   © 2026 EvoSoft Solutions. All rights reserved. */
(function () {
  'use strict';

  // One request: draw the visitor's design with the public site's own preview (assets/js/site-preview.js, which
  // index.php loads before this file when the build has made it). Without it, say so; the choices are listed anyway.
  var data = document.getElementById('design-data');
  var host = document.getElementById('preview');
  if (data && host) {
    var design = null;
    try { design = JSON.parse(data.textContent || 'null'); } catch (e) { design = null; }
    var P = window.EvoPreview;
    var draw = function (device) {
      try { P.render(host, design, {}, { device: device }); return true; } catch (e) {
        if (window.console) console.warn('EvoPreview.render failed', e);
        return false;
      }
    };
    var drawn = !!(design && P && typeof P.render === 'function') && draw('desktop');
    if (!drawn) {
      host.hidden = true;
      var missing = document.getElementById('preview-missing');
      if (missing) missing.hidden = false;
    } else {
      // desktop / tablet / phone, like on the quote builder
      var bar = document.createElement('div');
      bar.className = 'preview-tools';
      bar.setAttribute('role', 'group');
      bar.setAttribute('aria-label', 'Preview size');
      [['desktop', 'Desktop'], ['tablet', 'Tablet'], ['phone', 'Phone']].forEach(function (d, i) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'btn small';
        b.textContent = d[1];
        b.setAttribute('aria-pressed', i === 0 ? 'true' : 'false');
        b.addEventListener('click', function () {
          Array.prototype.forEach.call(bar.children, function (x) { x.setAttribute('aria-pressed', String(x === b)); });
          draw(d[0]);
        });
        bar.appendChild(b);
      });
      host.parentNode.insertBefore(bar, host);
      // the same page in words (the preview itself is a picture, hidden from screen readers)
      if (typeof P.summary === 'function') {
        try {
          var text = P.summary(design, {});
          if (text) {
            var p = document.createElement('p');
            p.className = 'preview-summary muted small';
            p.textContent = text;
            host.parentNode.insertBefore(p, host.nextSibling);
          }
        } catch (e) { /* the list of choices above says it all */ }
      }
    }
  }

  // "Copy" buttons next to the settings lines (setup and Security). They only show when copying can work.
  var live = null;
  var say = function (text) {
    if (!live) {
      live = document.createElement('p');
      live.className = 'sr-only';
      live.setAttribute('role', 'status');
      document.body.appendChild(live);
    }
    live.textContent = '';
    window.setTimeout(function () { live.textContent = text; }, 30);
  };
  if (navigator.clipboard && window.isSecureContext) {
    Array.prototype.forEach.call(document.querySelectorAll('button[data-copy]'), function (btn) {
      var target = document.getElementById(btn.getAttribute('data-copy'));
      if (!target) return;
      btn.hidden = false;
      btn.addEventListener('click', function () {
        navigator.clipboard.writeText(target.textContent.trim()).then(function () {
          btn.textContent = 'Copied';
          say('Copied');
          window.setTimeout(function () { btn.textContent = 'Copy'; }, 2000);
        }, function () { say('Copying didn’t work. Select the text and copy it instead.'); });
      });
    });
  }
})();
