const CACHE_NAME = 'linkneomeal-cache-v5-nota-percent-20261010';
const assetsToCache = [
  './',
  './index.html',
  './app-pos.js?v=20261010-nota-percent-v5',
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
        await cache.addAll(['./', './index.html', './app-pos.js?v=20261010-nota-percent-v5']);
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

  // HTML (termasuk halaman utama PWA) dan app-pos.js selalu mencoba jaringan
  // dahulu, agar preview nota & printer tidak menjalankan file cache versi lama.
  // Ketika offline tetap bisa memakai versi terakhir yang tersimpan.
  const url = new URL(event.request.url);
  const isAppScript = url.origin === self.location.origin && url.pathname.endsWith('/app-pos.js');
  const isAppDocument = url.origin === self.location.origin && (event.request.mode === 'navigate' || url.pathname.endsWith('/index.html'));
  if (isAppScript || isAppDocument) {
    event.respondWith(
      fetch(event.request).then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        }
        return response;
      }).catch(async () => (await caches.match(event.request)) || (isAppDocument ? await caches.match('./index.html') : undefined))
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then(cachedResponse => cachedResponse || fetch(event.request))
  );
});