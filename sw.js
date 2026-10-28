// Lets Pawse open with no internet. Always tries the network first so updates show up right away,
// and falls back to the cached copy when offline.
const CACHE = 'pawse-v42';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './js/app.js',
  './js/db.js',
  './js/timer.js',
  './js/sound.js',
  './js/pixel.js',
  './js/scene.js',
  './js/gym.js',
  './js/gym-scene.js',
  './js/toys.js',
  './fonts/PressStart2P.woff2',
  './fonts/VT323.woff2',
  './sounds/wanna-play.mp3',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      // Only clear old Pawse caches: other sites on brandonconcepcion.com share this cache storage.
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('pawse-') && key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    // 'no-cache' = always check the server for a newer copy, so an update never mixes old and new files.
    fetch(request, { cache: 'no-cache' })
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(request, copy));
        return response;
      })
      .catch(() =>
        caches.match(request, { ignoreSearch: true }).then((cached) => cached || caches.match('./index.html'))
      )
  );
});
