//manages the cache used to serve the files and intercept fetch request to serve without going to the network

//since the app is cache-first, BUMP this every github pages deploy to force a reload of the cache
const CACHE_NAME = 'v1';
const PRECACHE = [
    './',
    './index.html',
    './app.js',
    './worker.js',
    './shared.js',
    // The expensive part: ~30MB of toolchain. Cached once, then instant.
    './clang',
    './lld',
    './memfs',
    './sysroot.tar',
];


self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
        .then((cache) => cache.addALL(PRECACHE)).
        .then(() => self.skipWaiting())
    );
});


self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
        .then((keys) => Promise.all(
            keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
        ))
        .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    event.respondWith(
        caches.match(event.request).then((hit) => {
            if (hit) return hit;
            console.log(`got uncached request ${event.request.url}`);
            return fetch(event.request).then((response) => {

                if (!response || response.status !== 200 || response.type !== 'basic') {
                    return response;
                }

                const copy = response.clone();
                event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)));
                return response;
            });
        })
    );
});




