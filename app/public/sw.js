// Minimal PWA service worker.
// App shell: cache-first. /api/* : network-first (SSE execution must stay live).

const CACHE = 'retro-ai-workbench-v1';
const API_PREFIX = '/api/';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // API: network-first (fall back to cache only if the network is gone).
  if (url.pathname.startsWith(API_PREFIX)) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(request).then((hit) => hit ?? Response.error())),
    );
    return;
  }

  // App shell: cache-first.
  event.respondWith(
    caches
      .match(request)
      .then(
        (hit) =>
          hit ??
          fetch(request)
            .then((res) => {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
              return res;
            })
            .catch(() => caches.match('/index.html')),
      ),
  );
});
