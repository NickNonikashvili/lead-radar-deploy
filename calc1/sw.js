/* StudyCat service worker: makes notes, formula sheets, flashcards and tools work offline.
   Registered as sw.js?v=<build>; the build string names the cache, so every release gets a clean cache.
   On install it saves the page and what the page loads, read from index.html itself (so the list never goes stale),
   and the app icons: this build's scripts and styles, nothing more. Everything else (a class's notes and questions,
   the fonts of the other looks, the Python worker, pages whose code loads when opened) is saved the first time it is
   fetched, and the page has the student's own classes saved in the background (App.warmClasses in assets/app.js).
   A new release used to re-download every class for every visitor; now it is the page's own files. */
const BUILD = new URL(self.location.href).searchParams.get('v') || 'dev';
const CACHE = 'mathub-' + BUILD;
const V = '?v=' + BUILD;
const ICONS = ['assets/icon-192.png', 'assets/icon-512.png'];
/** the scripts and stylesheets index.html loads for this build (assets/… and build-check.js, each with ?v=<build>) */
const fromPage = html => [...new Set([...html.matchAll(/(?:src|href)="((?:assets\/|build-check\.js)[^"#]*)"/g)].map(m => m[1].replace(/&amp;/g, '&')).filter(u => u.endsWith(V)))];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(async c => {
    let list = [];
    try { const res = await fetch('index.html', { cache: 'no-store' }); if (res.ok) { const html = await res.text(); await c.put('index.html', new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })); list = fromPage(html); } } catch (err) {}
    await Promise.all(['./'].concat(list, ICONS).map(u => c.add(u).catch(() => {})));
  }).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('mathub-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('message', e => { if (e.data === 'SKIP_WAITING') self.skipWaiting(); });

self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // The account server is never cached. When offline, answer with a JSON error the app understands.
  if (url.origin === self.location.origin && url.pathname.includes('/api/')) {
    e.respondWith(fetch(req).catch(() => new Response(JSON.stringify({ ok: false, error: 'You are offline.', offline: true }), { status: 503, headers: { 'Content-Type': 'application/json' } })));
    return;
  }
  // The page itself: network first so new builds arrive immediately, cached copy when offline.
  if (url.origin === self.location.origin && (url.pathname.includes('/learn/') || url.pathname.endsWith('/sitemap.xml') || url.pathname.endsWith('/robots.txt'))) { e.respondWith(fetch(req).catch(() => caches.match(req))); return; }
  if (req.mode === 'navigate' || url.pathname.endsWith('/index.html') || url.pathname.endsWith('/')) {
    e.respondWith(fetch(req).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put('index.html', copy)).catch(() => {}); return res; }).catch(() => caches.match('index.html').then(r => r || caches.match('./'))));
    return;
  }
  // Same-origin assets carry a build tag: cache first.
  if (url.origin === self.location.origin) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {}); } return res; })));
    return;
  }
  // MathJax from its CDN: serve the cached copy at once and refresh it in the background.
  e.respondWith(caches.match(req).then(hit => { const net = fetch(req).then(res => { if (res && (res.ok || res.type === 'opaque')) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {}); } return res; }).catch(() => hit); return hit || net; }));
});

/* ---------- push notifications: the push itself is empty; the pending items are fetched for the logged-in user ---------- */
self.addEventListener('push', e => {
  e.waitUntil((async () => {
    let items = [];
    try { const r = await fetch('api/index.php?r=push_pending', { credentials: 'include', headers: { 'X-Requested-With': 'MatHub' }, cache: 'no-store' }); const j = await r.json(); items = (j && j.items) || []; } catch (err) {}
    if (!items.length && e.data) { try { const d = e.data.json(); if (d && d.title) items = [d]; } catch (err) { items = [{ title: 'StudyCat', body: e.data.text() }]; } }
    if (!items.length) items = [{ title: 'StudyCat', body: 'Something new is waiting for you.', url: './' }];
    await Promise.all(items.map(it => self.registration.showNotification(it.title || 'StudyCat', { body: it.body || '', icon: 'assets/icon-192.png', badge: 'assets/icon-192.png', tag: it.tag || undefined, data: { url: it.url || './' } })));
  })());
});
self.addEventListener('notificationclick', e => {
  e.notification.close(); const target = (e.notification.data && e.notification.data.url) || './'; const url = new URL(target, self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => { const c = cs.find(x => x.url.startsWith(self.registration.scope)); if (c) { return c.focus().then(w => ('navigate' in w ? w.navigate(url) : w)); } return self.clients.openWindow(url); }));
});
