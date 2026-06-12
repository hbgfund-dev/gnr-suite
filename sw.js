/* GNR Suite — service worker: cache the app shell so it opens instantly,
   even with zero connectivity. Bump CACHE_NAME on each deploy to bust old shells. */
const CACHE_NAME = 'gnr-suite-shell-v8.2';
const SHELL = ['./', './index.html', './manifest.json',
  './icon-192.png', './icon-512.png', './icon-512-maskable.png', './apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

/* Network-first for navigation/app shell (always try to get the latest version
   when online), falling back to cache when offline. Cache-first for same-origin
   static assets (icons, manifest). Everything else (Supabase, Open-Meteo, tiles,
   CDNs) passes straight through to the network — untouched. */
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // never intercept cross-origin (Supabase, CDNs, tiles)

  if (req.mode === 'navigate' || url.pathname.endsWith('index.html') || url.pathname === '/' ) {
    e.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(req, copy));
        return res;
      }).catch(() => caches.match('./index.html'))
    );
    return;
  }

  e.respondWith(
    caches.match(req).then((cached) => cached || fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE_NAME).then((c) => c.put(req, copy));
      return res;
    }))
  );
});
