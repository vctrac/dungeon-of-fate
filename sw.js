const CACHE = 'dungeon-of-fate-v2.16-1';
const SHELL = ['./index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key.startsWith('dungeon-of-fate-') && key !== CACHE).map(key => caches.delete(key))
  )).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  const shellURLs = SHELL.map(path => new URL(path, self.registration.scope).href);
  const isLaunch = event.request.mode === 'navigate' &&
    (url.pathname === new URL('./', self.registration.scope).pathname ||
     url.pathname === new URL('./index.html', self.registration.scope).pathname);
  if (isLaunch) {
    event.respondWith(fetch(event.request).catch(() =>
      caches.open(CACHE).then(cache => cache.match('./index.html'))
    ));
  } else if (shellURLs.includes(url.href)) {
    event.respondWith(caches.open(CACHE).then(async cache =>
      (await cache.match(event.request)) || fetch(event.request)
    ));
  }
});



