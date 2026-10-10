const CACHE_NAME = 'linkneomeal-cache-v1';
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
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(assetsToCache);
    })
  );
});

// Aktivasi & Hapus Cache Lama jika ada pembaruan versi
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
});

// Strategi Fetch: Cache First, Fallback to Network
// Mempercepat loading aset statis, sementara request Firebase tetap live ke internet
self.addEventListener('fetch', event => {
  // Jangan cache request Firebase Realtime Database atau API eksternal
  if (event.request.url.includes('firebaseio.com') || event.request.url.includes('api.imgbb.com')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      return cachedResponse || fetch(event.request);
    })
  );
});