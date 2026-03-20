const CACHE_NAME = 'rundloop-v1';
const TILE_CACHE_NAME = 'rundloop-tiles-v1';
const MAX_TILE_ENTRIES = 50;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(['/']))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME && key !== TILE_CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Tile CDN: cache up to MAX_TILE_ENTRIES
  if (url.hostname.includes('tile') || url.hostname.includes('basemaps')) {
    event.respondWith(
      caches.open(TILE_CACHE_NAME).then((cache) =>
        cache.match(event.request).then((cached) => {
          if (cached) return cached;
          return fetch(event.request).then((response) => {
            if (response.ok) {
              cache.put(event.request, response.clone());
              // Evict old entries if over limit
              cache.keys().then((keys) => {
                if (keys.length > MAX_TILE_ENTRIES) {
                  cache.delete(keys[0]);
                }
              });
            }
            return response;
          });
        })
      )
    );
    return;
  }

  // API routes or external: network-first with cache fallback
  if (url.pathname.startsWith('/api/') || url.hostname !== self.location.hostname) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // App shell: cache-first, on miss fetch and cache
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
