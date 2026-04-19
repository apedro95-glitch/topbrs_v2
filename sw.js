const CACHE = 'topbrs-premium-pwa-v2098-icons';
const CORE = ['./','./index.html','./app.css','./app.js','./data.js','./manifest.json','./icon-1024.png','./apple-touch-icon.png','./icons/icon-180.png','./icons/icon-192.png','./icons/icon-512.png','./icons/icon-1024.png','./icons/icon-maskable-512.png','./icons/favicon.png'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
    const clients = await self.clients.matchAll({type:'window', includeUncontrolled:true});
    for (const client of clients) {
      client.postMessage({type:'TOPBRS_SW_READY', version:'2.0.9.8'});
    }
  })());
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  const isCore = url.origin === location.origin && (url.pathname.endsWith('/index.html') || CORE.some(a => url.pathname.endsWith(a.replace('./','/'))));
  if (isCore) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(event.request, {cache:'no-store'});
        if (fresh && fresh.ok) {
          const cache = await caches.open(CACHE);
          cache.put(event.request, fresh.clone());
        }
        return fresh;
      } catch (err) {
        const cached = await caches.match(event.request);
        return cached || caches.match('./index.html');
      }
    })());
    return;
  }
  event.respondWith((async () => {
    const cached = await caches.match(event.request);
    if (cached) return cached;
    try {
      const fresh = await fetch(event.request);
      if (fresh && fresh.ok) {
        const cache = await caches.open(CACHE);
        cache.put(event.request, fresh.clone());
      }
      return fresh;
    } catch (err) {
      return caches.match('./index.html');
    }
  })());
});
