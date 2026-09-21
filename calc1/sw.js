/* MatHub service worker: makes notes, formula sheets, flashcards and tools work offline.
   Registered as sw.js?v=<build>; the build string names the cache, so every release gets a clean cache. */
const BUILD = new URL(self.location.href).searchParams.get('v') || 'dev';
const CACHE = 'mathub-' + BUILD;
const V = '?v=' + BUILD;
const SHELL = ['./', 'index.html', 'assets/styles.css' + V, 'assets/app.js' + V, 'assets/gami.js' + V, 'assets/quests.js' + V, 'assets/lesson.js' + V, 'assets/ladders.js' + V, 'assets/tools.js' + V, 'assets/auth.js' + V, 'assets/forum.js' + V, 'assets/policy.js' + V, 'assets/planner.js' + V, 'assets/social.js' + V, 'assets/admin.js' + V,
  'assets/calc-data.js' + V, 'assets/calc-quiz.js' + V, 'assets/calc-tools.js' + V, 'assets/physics-data.js' + V, 'assets/physics-quiz.js' + V, 'assets/physics-tools.js' + V,
  'assets/precalc-data.js' + V, 'assets/precalc-quiz.js' + V, 'assets/precalc-tools.js' + V, 'assets/writ-data.js' + V, 'assets/reader.js' + V, 'assets/icon.svg' + V, 'assets/icon-192.png' + V, 'assets/icon-512.png' + V, 'assets/manifest.webmanifest' + V];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(async c => { await Promise.all(SHELL.map(u => c.add(u).catch(() => {}))); }).then(() => self.skipWaiting()));
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
  if (req.mode === 'navigate' || url.pathname.endsWith('/index.html') || url.pathname.endsWith('/')) {
    e.respondWith(fetch(req).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put('index.html', copy)).catch(() => {}); return res; }).catch(() => caches.match('index.html').then(r => r || caches.match('./'))));
    return;
  }
  // Same-origin assets carry a build tag: cache first.
  if (url.origin === self.location.origin) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {}); } return res; })));
    return;
  }
  // Fonts and MathJax from CDNs: serve the cached copy at once and refresh it in the background.
  e.respondWith(caches.match(req).then(hit => { const net = fetch(req).then(res => { if (res && (res.ok || res.type === 'opaque')) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {}); } return res; }).catch(() => hit); return hit || net; }));
});
