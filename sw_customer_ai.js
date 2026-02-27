// Service Worker for Magic Customer AI PWA
// Provides offline shell caching and PWA installability

var CACHE_NAME = 'magic-ops-v1';
var SHELL_URLS = [
  './',
  './customer_ai_pwa.html',
  'https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/marked/9.1.6/marked.min.js'
];

// Install — cache the app shell
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(SHELL_URLS);
    })
  );
  self.skipWaiting();
});

// Activate — clean up old caches
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(key) { return key !== CACHE_NAME; })
            .map(function(key) { return caches.delete(key); })
      );
    })
  );
  self.clients.claim();
});

// Fetch — network-first for API calls, cache-first for shell
self.addEventListener('fetch', function(event) {
  var url = event.request.url;

  // Never cache API calls (Apps Script endpoints)
  if (url.indexOf('script.google.com') !== -1 ||
      url.indexOf('generativelanguage.googleapis.com') !== -1) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Cache-first for everything else (shell assets)
  event.respondWith(
    caches.match(event.request).then(function(cached) {
      return cached || fetch(event.request).then(function(response) {
        // Cache new successful responses
        if (response.ok) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, clone);
          });
        }
        return response;
      });
    }).catch(function() {
      // Offline fallback — return the cached shell
      if (event.request.mode === 'navigate') {
        return caches.match('./customer_ai_pwa.html');
      }
    })
  );
});
