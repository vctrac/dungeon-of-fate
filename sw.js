const CACHE = 'dungeon-of-fate-v2.23.5-1';
const SHELL = ["./index.html", "./manifest.webmanifest", "./assets/cards/consumables/death-bargain.webp", "./assets/cards/consumables/divine-charm.webp", "./assets/cards/consumables/fortune-coin.webp", "./assets/cards/consumables/healimg-flask.webp", "./assets/cards/consumables/trap-ward.webp", "./assets/cards/discoveries/corpse-remains.webp", "./assets/cards/discoveries/flower.webp", "./assets/cards/discoveries/fruit-tree.webp", "./assets/cards/discoveries/garden.webp", "./assets/cards/discoveries/hole-in-the-wall.webp", "./assets/cards/discoveries/monolith.webp", "./assets/cards/discoveries/picture.webp", "./assets/cards/encounters/altar.webp", "./assets/cards/encounters/chest.webp", "./assets/cards/encounters/shrine.webp", "./assets/cards/hazards/darts.webp", "./assets/cards/hazards/scavenge-trap.webp", "./assets/cards/hazards/spikes.webp", "./assets/cards/monsters/guardian.webp", "./assets/cards/monsters/mimic.webp", "./assets/cards/monsters/spirit.webp", "./assets/cards/monsters/wretch.webp", "./assets/cards/trinkets/compass.webp", "./assets/cards/trinkets/evil-eye.webp", "./assets/cards/trinkets/horseshoe.webp", "./assets/cards/trinkets/vampire-blood.webp", "./assets/cards/trinkets/voodoo-doll.webp", "./assets/icons/apple-touch-icon.png", "./assets/icons/icon-192.png", "./assets/icons/icon-512.png", "./assets/ui/card-frame-small.webp", "./assets/ui/card-frame.webp", "./assets/ui/card_interior_texture.png"];
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
