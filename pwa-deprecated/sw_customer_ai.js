// Service Worker for Magic Customer AI PWA (v2.0)
// Network-first for own assets (ensures updates propagate immediately)
// Cache-first for vendor assets (fonts, libraries)
// v2.0: Network-first strategy, version-check support
// v1.0: Original cache-first for everything

var CACHE_NAME = 'magic-ops-v2';

var VENDOR_ASSETS = [
  'https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/marked/9.1.6/marked.min.js'
];

// Install — cache vendor assets only
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(VENDOR_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate — clean ALL old caches immediately
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(
        names.filter(function(name) { return name !== CACHE_NAME; })
             .map(function(name) { return caches.delete(name); })
      );
    })
  );
  self.clients.claim();
});

// Message handler — allows the page to request a forced update
self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Fetch strategy:
//   - POST / Apps Script / Gemini → pass through (never cache)
//   - Own assets (same origin) → network-first, cache fallback
//   - Vendor assets (CDN) → cache-first, network fallback
self.addEventListener('fetch', function(event) {
  var url = new URL(event.request.url);

  // Only handle http/https
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return;
  }

  // Never cache API calls
  if (url.hostname === 'script.google.com' ||
      url.hostname === 'generativelanguage.googleapis.com') {
    event.respondWith(fetch(event.request));
    return;
  }

  if (event.request.method === 'POST') {
    return;
  }

  // Same-origin assets → network-first
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(event.request).then(function(response) {
        if (response.ok) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, clone);
          });
        }
        return response;
      }).catch(function() {
        return caches.match(event.request).then(function(cached) {
          if (cached) return cached;
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
      })
    );
    return;
  }

  // Vendor assets → cache-first
  event.respondWith(
    caches.match(event.request).then(function(cached) {
      if (cached) return cached;
      return fetch(event.request).then(function(response) {
        if (response.ok) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, clone);
          });
        }
        return response;
      });
    })
  );
});