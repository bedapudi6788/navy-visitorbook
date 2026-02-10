const CACHE_NAME = 'visitorbook-v6';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/css/tailwind.css',
    '/css/app.css',
    '/js/app.js',
    '/js/canvas.js',
    '/js/camera.js',
    '/js/storage.js',
    '/manifest.json'
];

function isNavigationRequest(request) {
    return request.mode === 'navigate';
}

// Install event - cache assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Caching app assets');
                return cache.addAll(ASSETS_TO_CACHE);
            })
            .then(() => self.skipWaiting())
    );
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((name) => name !== CACHE_NAME)
                        .map((name) => caches.delete(name))
                );
            })
            .then(() => self.clients.claim())
    );
});

// Fetch event - network-first strategy with offline fallback
self.addEventListener('fetch', (event) => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') return;

    // Skip cross-origin requests (like Tailwind CDN)
    if (!event.request.url.startsWith(self.location.origin)) {
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                if (!response || response.status !== 200) {
                    return response;
                }

                const responseToCache = response.clone();

                caches.open(CACHE_NAME)
                    .then((cache) => {
                        cache.put(event.request, responseToCache);
                    });

                return response;
            })
            .catch(() => {
                return caches.match(event.request)
                    .then((cachedResponse) => {
                        if (cachedResponse) {
                            return cachedResponse;
                        }

                        if (isNavigationRequest(event.request)) {
                            return caches.match('/index.html');
                        }

                        return new Response('', { status: 504, statusText: 'Gateway Timeout' });
                    });
            })
    );
});
