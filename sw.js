const CACHE = 'dungeon-of-fate-v2.23.1-2';
const SHELL = ["./index.html", "./manifest.webmanifest", "./assets/ui/card_reference_transparent.png", "./assets/ui/card_outer_frame.png", "./assets/ui/card_interior_texture.png", "./assets/ui/card_artwork_frame_9slice.png", "./assets/icons/icon-192.png", "./assets/icons/icon-512.png", "./assets/icons/apple-touch-icon.png", "./assets/cards/discoveries/flower.png", "./assets/cards/discoveries/garden.png", "./assets/cards/encounters/chest.png", "./assets/cards/encounters/shrine.png", "./assets/cards/hazards/darts.png", "./assets/cards/hazards/scavenge-trap.png", "./assets/cards/hazards/spikes.png", "./assets/cards/monsters/guardian.png", "./assets/cards/monsters/mimic.png", "./assets/cards/monsters/spirit.png", "./assets/cards/monsters/wretch.png"];
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



