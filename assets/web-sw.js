/* FitEngine — SW opcional: cache ligero de chunks estáticos Expo (no “offline app”). */
const CACHE = 'fitengine-expo-static-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  try {
    const u = new URL(req.url);
    if (!u.pathname.startsWith('/_expo/static/')) return;
  } catch {
    return;
  }

  event.respondWith(
    caches.open(CACHE).then((cache) =>
      cache.match(req).then((cached) => {
        const network = fetch(req)
          .then((res) => {
            try {
              if (res && res.ok) cache.put(req, res.clone());
            } catch {
              /* ignore */
            }
            return res;
          })
          .catch(() => cached);
        return cached || network;
      }),
    ),
  );
});
