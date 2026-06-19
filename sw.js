// ===== DIVINE COIFFURE — Service Worker (PWA offline) =====
const CACHE_NOM     = 'divine-crm-v5';
const FICHIERS_APP  = ['/', '/index.html', '/style.css', '/app.js', '/manifest.json', '/icon.svg'];

// Installation : mise en cache des fichiers de l'app
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NOM).then(cache => cache.addAll(FICHIERS_APP))
  );
  self.skipWaiting();
});

// Activation : supprimer les anciens caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(cles =>
      Promise.all(cles.filter(c => c !== CACHE_NOM).map(c => caches.delete(c)))
    )
  );
  self.clients.claim();
});

// Interception : cache d'abord, réseau ensuite
self.addEventListener('fetch', e => {
  // Toujours aller sur le réseau pour Google Script (sync)
  if (e.request.url.includes('script.google.com')) return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) {
        // Mettre à jour le cache en arrière-plan si en ligne
        fetch(e.request).then(fresh => {
          if (fresh && fresh.ok) {
            caches.open(CACHE_NOM).then(c => c.put(e.request, fresh));
          }
        }).catch(() => {});
        return cached;
      }
      return fetch(e.request).then(fresh => {
        if (fresh && fresh.ok && e.request.method === 'GET') {
          const clone = fresh.clone();
          caches.open(CACHE_NOM).then(c => c.put(e.request, clone));
        }
        return fresh;
      });
    })
  );
});
