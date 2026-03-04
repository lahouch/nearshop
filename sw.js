// ══════════════════════════════════════════
//  NearShop — Service Worker
//  Cache offline + mise à jour automatique
// ══════════════════════════════════════════

const CACHE_NAME = 'nearshop-v2';
const ASSETS_TO_CACHE = [
  './index.html',
  './manifest.json',
  './icon.svg',
];

// ── Installation : mise en cache des assets ──
self.addEventListener('install', event => {
  console.log('[SW] Installing NearShop Service Worker...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Caching app assets');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => self.skipWaiting())
  );
});

// ── Activation : nettoyage des anciens caches ──
self.addEventListener('activate', event => {
  console.log('[SW] Activating NearShop Service Worker...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// ── Fetch : stratégie Network First avec fallback cache ──
self.addEventListener('fetch', event => {
  // Ignorer les requêtes non-GET
  if (event.request.method !== 'GET') return;

  // Ignorer les requêtes Firebase, Google, Cloudinary (toujours en ligne)
  const url = event.request.url;
  if (
    url.includes('firebase') ||
    url.includes('googleapis') ||
    url.includes('cloudinary') ||
    url.includes('gstatic') ||
    url.includes('leaflet') ||
    url.includes('cartocdn') ||
    url.includes('google.com/vt') ||
    url.includes('openstreetmap')
  ) {
    return; // Laisser passer sans cache
  }

  event.respondWith(
    // 1. Essayer le réseau d'abord
    fetch(event.request)
      .then(response => {
        // Mettre à jour le cache avec la réponse fraîche
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // 2. Réseau indisponible → utiliser le cache
        console.log('[SW] Offline — serving from cache:', url);
        return caches.match(event.request).then(cached => {
          if (cached) return cached;
          // Fallback vers index.html pour la navigation
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
      })
  );
});

// ── Message : forcer la mise à jour ──
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
