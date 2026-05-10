const CACHE_NAME = 'ophtho-caselog-v2';
const urlsToCache = [
    '/',
    '/index.html',
    '/style.css',
    '/app.js'
];

self.addEventListener('install', function(event) {
    event.waitUntil(
        caches.open(CACHE_NAME).then(function(cache) {
            return cache.addAll(urlsToCache);
        })
    );
});

self.addEventListener('fetch', function(event) {
    event.respondWith(
        caches.match(event.request).then(function(response) {
            if (response) { return response; }
            return fetch(event.request);
        })
    );
});

// Handle push notifications
self.addEventListener('push', function(event) {
    const options = {
        body: event.data ? event.data.text() : 'Don\'t forget to log your cases today!',
        icon: '/icon.png',
        badge: '/icon.png',
        vibrate: [200, 100, 200],
        data: { url: '/' }
    };
    event.waitUntil(
        self.registration.showNotification('Ophtho CaseLog Reminder', options)
    );
});

// Handle notification click
self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    event.waitUntil(
        clients.openWindow('/')
    );
});