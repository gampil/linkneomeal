const CACHE_NAME = 'linkneomeal-cache-v3-ble-printer-20261010';
const assetsToCache = [
  './',
  './index.html',
  './app-pos.js',
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-database-compat.js'
];

// Install Service Worker & Simpan Aset Statis ke Cache
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(async cache => {
        // Aset lokal wajib; kegagalan salah satu CDN tidak boleh menggagalkan update.
        await cache.addAll(['./', './index.html', './app-pos.js']);
        await Promise.allSettled(assetsToCache.slice(3).map(asset => cache.add(asset)));
      })
      .then(() => self.skipWaiting())
  );
});

// Aktivasi & Hapus Cache Lama jika ada pembaruan versi
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key.startsWith('linkneomeal-cache-') && key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Strategi Fetch: Cache First, Fallback to Network
// Mempercepat loading aset statis, sementara request Firebase tetap live ke internet
self.addEventListener('fetch', event => {
  // Jangan cache request Firebase Realtime Database atau API eksternal
  if (event.request.url.includes('firebaseio.com') || event.request.url.includes('api.imgbb.com')) {
    return;
  }

  // Prioritaskan jaringan untuk kode JS utama agar perbaikan printer tidak
  // tertahan oleh file lama pada cache perangkat kasir.
  const url = new URL(event.request.url);
  if (url.origin === self.location.origin && url.pathname.endsWith('/app-pos.js')) {
    event.respondWith(
      fetch(event.request).then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        }
        return response;
      }).catch(() => caches.match(event.request))
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then(cachedResponse => cachedResponse || fetch(event.request))
  );
});