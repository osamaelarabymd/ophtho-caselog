const CACHE_NAME = 'eye-log-v3';
const urlsToCache = [
    '/',
    '/index.html',
    '/style.css',
    '/app.js'
];

self.addEventListener('install', function(event) {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(function(cache) {
            return cache.addAll(urlsToCache);
        })
    );
});

self.addEventListener('activate', function(event) {
    event.waitUntil(
        caches.keys().then(function(keys) {
            return Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', function(event) {
    event.respondWith(
        fetch(event.request).catch(function() {
            return caches.match(event.request);
        })
    );
});

// Handle push notifications
self.addEventListener('push', function(event) {
    const options = {
        body: event.data ? event.data.text() : 'Don\'t forget to log your cases today!',
        icon: '/icon.svg',
        badge: '/icon.svg',
        vibrate: [200, 100, 200],
        data: { url: '/' }
    };
    event.waitUntil(
        self.registration.showNotification('EyeLog Reminder 🏥', options)
    );
});

// Handle notification click
self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    event.waitUntil(
        clients.openWindow('/')
    );
});