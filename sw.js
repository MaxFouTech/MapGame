// MapGame service worker.
//
// Two goals: instant repeat loads (the map data + d3 are ~320 KB gzip and
// change rarely) and real offline play.
//
// Strategy by resource:
//   - vendor/*, data/*, flag images  -> cache-first  (heavy, immutable-ish)
//   - index.html, css/*, js/*         -> network-first, cache fallback
//                                       (small; always fresh when online, so a
//                                       deploy is picked up on the next load
//                                       even if this file is not bumped)
//   - Supabase API                    -> network only (never cached)
//
// CACHE names the precache generation: bump it when vendor/ or data/ change
// so the old copies are dropped. App code does not need a bump.

const CACHE = 'mapgame-v1.4.0';

const PRECACHE = [
  './',
  './index.html',
  './css/style.css',
  './js/main.js', './js/countries.js', './js/capitals.js', './js/flags.js',
  './js/themes.js', './js/map.js', './js/globe.js', './js/scheduler.js',
  './js/storage.js', './js/cloud.js', './js/config.js', './js/i18n.js',
  './js/icons.js', './js/extras.js',
  './vendor/d3.min.js', './vendor/topojson-client.min.js',
  './data/countries-50m.json',
];

const FLAG_HOST = 'flagcdn.com';
const NETWORK_TIMEOUT_MS = 3000;

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function isHeavyAsset(url) {
  return url.pathname.includes('/vendor/') || url.pathname.includes('/data/');
}
function isSupabase(url) {
  return url.hostname.endsWith('.supabase.co');
}

// Cache-first: serve from cache, otherwise fetch and store.
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const res = await fetch(request);
  // Opaque (cross-origin, no-cors) responses are fine to cache for flags.
  if (res && (res.ok || res.type === 'opaque')) {
    const cache = await caches.open(CACHE);
    cache.put(request, res.clone());
  }
  return res;
}

// Network-first with a short timeout, cache fallback. Keeps app code fresh
// while still loading instantly when offline or on a stalled connection.
async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const res = await Promise.race([
      fetch(request),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), NETWORK_TIMEOUT_MS)),
    ]);
    if (res && res.ok) cache.put(request, res.clone());
    return res;
  } catch (e) {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    // Offline navigation to an unknown path: fall back to the app shell.
    if (request.mode === 'navigate') {
      const shell = await cache.match('./index.html');
      if (shell) return shell;
    }
    throw e;
  }
}

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (isSupabase(url)) return; // always live

  if (url.hostname === FLAG_HOST) {
    event.respondWith(cacheFirst(request));
    return;
  }
  if (url.origin !== self.location.origin) return;

  if (isHeavyAsset(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }
  event.respondWith(networkFirst(request));
});
