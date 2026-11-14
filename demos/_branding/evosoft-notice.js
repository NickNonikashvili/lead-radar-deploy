/*! © 2026 EvoSoft Solutions. All rights reserved. https://evosoft.solutions
 *
 * EvoSoft demo notice: a small copyright card for the public product demos.
 *
 *   <link rel="stylesheet" href="/__evosoft/evosoft-notice.css">
 *   <script src="/__evosoft/evosoft-notice.js" data-product="Evo" defer></script>
 *
 * data-product  the product name shown ("Evo demo · fictional data")
 * data-surface  optional: which screen of the product this page is (the stylesheet places the card per
 *               product and surface so it never sits on the app's own controls)
 *
 * Built with createElement / textContent only: no innerHTML, no inline styles, no eval, so it runs under
 * strict Content-Security-Policies and Trusted Types (require-trusted-types-for 'script'). The close button
 * hides it for this browser session (sessionStorage); it comes back on the next visit.
 */
(function () {
  'use strict';

  var ID = 'evosoft-notice';
  var KEY = 'evosoft-notice:hidden';
  var SITE = 'https://evosoft.solutions';

  if (document.getElementById(ID)) return; // included twice

  var tag = document.currentScript || document.querySelector('script[src*="evosoft-notice.js"]');
  var read = function (name) { return (tag && tag.getAttribute(name)) || ''; };
  var product = read('data-product').replace(/[^\w .+&'-]/g, '').replace(/\s+/g, ' ').trim().slice(0, 40);
  var slug = product.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  var surface = read('data-surface').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 30);

  var hiddenThisSession = function () {
    try { return window.sessionStorage.getItem(KEY) === '1'; } catch (e) { return false; }
  };
  if (hiddenThisSession()) return;

  var make = function (name, className, text) {
    var node = document.createElement(name);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  };

  var card = make('aside', 'evosoft-notice');
  card.id = ID;
  card.setAttribute('aria-label', 'Copyright notice');
  card.setAttribute('translate', 'no');
  if (slug) card.setAttribute('data-product', slug);
  if (surface) card.setAttribute('data-surface', surface);

  var mark = make('span', 'evosoft-notice__mark');
  mark.setAttribute('aria-hidden', 'true');

  var text = make('span', 'evosoft-notice__text');
  var line1 = make('span', 'evosoft-notice__line', '\u00a9 2026 EvoSoft Solutions. All rights reserved.');
  var line2 = make('span', 'evosoft-notice__line evosoft-notice__line--sub', (product ? product + ' demo' : 'Demo') + ' \u00b7 fictional data \u00b7 ');
  var link = make('a', 'evosoft-notice__link', 'evosoft.solutions');
  link.href = SITE;
  link.target = '_blank';
  link.rel = 'noopener';
  line2.appendChild(link);
  text.appendChild(line1);
  text.appendChild(line2);

  var close = make('button', 'evosoft-notice__close', '\u00d7');
  close.type = 'button';
  close.setAttribute('aria-label', 'Hide the copyright notice until your next visit');
  close.title = 'Hide until your next visit';

  card.appendChild(mark);
  card.appendChild(text);
  card.appendChild(close);

  var gone = false;
  var watched = null;
  var observer = null;

  // Keep the card on the page: some apps replace the whole <body> content (Evo's store apps do on
  // phones), so put it back whenever it is removed, until the visitor closes it.
  var mount = function () {
    if (gone) return;
    var body = document.body;
    if (!body) return;
    if (card.parentNode !== body) body.appendChild(card);
    if (observer && watched !== body) {
      if (watched) observer.disconnect();
      observer.observe(document.documentElement, { childList: true });
      observer.observe(body, { childList: true });
      watched = body;
    }
  };

  close.addEventListener('click', function () {
    gone = true;
    if (observer) observer.disconnect();
    try { window.sessionStorage.setItem(KEY, '1'); } catch (e) { /* storage blocked: hidden on this page only */ }
    if (card.parentNode) card.parentNode.removeChild(card);
  });

  var start = function () {
    if (typeof MutationObserver === 'function') observer = new MutationObserver(function () { if (!gone && card.parentNode !== document.body) mount(); });
    mount();
  };
  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start);
})();
