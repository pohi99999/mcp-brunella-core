const CACHE_NAME = 'p-sales-standalone-v1';
const PRECACHE_URLS = ['/', '/p-sales.webmanifest', '/p-sales-icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(PRECACHE_URLS);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key.startsWith('p-sales-standalone-') && key !== CACHE_NAME)
        .map((key) => caches.delete(key)),
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  const isNavigation = event.request.mode === 'navigate';
  const isStaticAsset = url.pathname.startsWith('/assets/') || url.pathname === '/p-sales.webmanifest' || url.pathname === '/p-sales-icon.svg';

  if (!isNavigation && !isStaticAsset) {
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(event.request);
    if (cachedResponse) {
      return cachedResponse;
    }

    try {
      const response = await fetch(event.request);
      if (response.ok) {
        await cache.put(event.request, response.clone());
      }
      return response;
    } catch (error) {
      if (isNavigation) {
        const fallback = await cache.match('/');
        if (fallback) {
          return fallback;
        }
      }
      throw error;
    }
  })());
});
