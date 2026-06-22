const CACHE_NAME = 'lnm-pos-v2'; // Versi dinaikkan
const urlsToCache = [
    './',
    './index.html',
    './style.css',
    './app-pos.js'
];

self.addEventListener('install', event => {
    // Memaksa service worker baru langsung aktif menggeser yang lama
    self.skipWaiting(); 
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
    );
});

self.addEventListener('activate', event => {
    // Menghapus cache versi lama saat update
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cache => {
                    if (cache !== CACHE_NAME) return caches.delete(cache);
                })
            );
        })
    );
});

// STRATEGI NETWORK-FIRST (Sangat cocok untuk masa Development)
self.addEventListener('fetch', event => {
    event.respondWith(
        fetch(event.request)
            .then(networkResponse => {
                // Jika internet jalan, simpan versi terbarunya ke cache diam-diam
                return caches.open(CACHE_NAME).then(cache => {
                    cache.put(event.request, networkResponse.clone());
                    return networkResponse;
                });
            })
            .catch(() => {
                // Jika internet mati (offline), baru pakai cache
                return caches.match(event.request);
            })
    );
});
