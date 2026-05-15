const CACHE_NAME = 'eye-log-v4';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

// No caching — always fetch from network
self.addEventListener('fetch', event => {
    event.respondWith(fetch(event.request));
});

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

self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    event.waitUntil(clients.openWindow('/'));
});
