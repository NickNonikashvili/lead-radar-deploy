/* ============================================================
   StudyCat — the seasons (2026.11.01.3). Every year from October 1 to November 8 the website dresses up for
   Halloween: html[data-season="halloween"] turns on assets/halloween.css (the website's own look only: not the other
   looks, not the iOS and Android apps) and the Halloween block at the end of assets/seo.css on the study guides.
   Loaded in <head> on every page (index.html right after boot.js, and each study guide), so the costume is on from
   the first paint, with no flash of the everyday colours.
   - The week after Halloween is part of it: an upload or a party a few days late still gets the costume.
   - Anyone can switch it off for the year in Settings (settings.seasonOff = that year, synced with the account);
     next October it comes back by itself. settings.season = 'halloween' or 'none' forces it either way (the tests
     and a preview; never set by the page).
   - The tab's icon (Bo in a witch's hat) and the phone's browser bar follow it.
   The moving pieces (the bats by the moon, the spider, the bats that cross the screen now and then) move a few times
   and rest, like everything else (DESIGN.md, Lighter); Reduce motion or the device's own reduced-motion setting stops
   them, and switching the look off removes them (WCAG 2.2.2 Pause, Stop, Hide).
   ============================================================ */
(function () {
  'use strict';
  var html = document.documentElement;
  var LAST_DAY = 8;   // November 8
  function halloween(d) { var m = d.getMonth(); return m === 9 || (m === 10 && d.getDate() <= LAST_DAY); }
  function seasonOf(d, s) {
    s = s || {};
    if (s.season === 'halloween') return 'halloween';
    if (s.season === 'none') return '';
    return halloween(d) && s.seasonOff !== d.getFullYear() ? 'halloween' : '';
  }
  function read() { try { return JSON.parse(localStorage.getItem('studyhub-settings') || '{}') || {}; } catch (e) { return {}; } }
  function swap(el, attr, on, to) {
    if (!el) return; var base = el.getAttribute('data-base-' + attr);
    if (base === null) { base = el.getAttribute(attr) || ''; el.setAttribute('data-base-' + attr, base); }
    el.setAttribute(attr, on ? to(base) : base);
  }
  function apply(s) {
    var name = seasonOf(new Date(), s || read());
    if (name) html.setAttribute('data-season', name); else html.removeAttribute('data-season');
    var on = name === 'halloween' && !html.hasAttribute('data-app');
    swap(document.querySelector('link[rel="icon"][type="image/svg+xml"]'), 'href', on, function (h) { return h.replace(/icon\.svg/, 'icon-halloween.svg'); });
    swap(document.querySelector('meta[name="theme-color"]'), 'content', on, function () { return '#1A1026'; });
    return name;
  }
  window.StudySeason = { of: seasonOf, inHalloween: halloween, apply: apply, lastDay: LAST_DAY };
  apply();
})();
