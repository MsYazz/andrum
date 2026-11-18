// Nätet först, så att nya rum dyker upp direkt. Cachen används när telefonen är offline.
const CACHE = 'andrum-v3';
const FILER = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.webmanifest',
  './lib/gl.js',
  './lib/ljud.js',
  './lib/haptik.js',
  './lib/rorelse.js',
  './luckor/01-andetaget.js',
  './luckor/02-sandladan.js',
  './luckor/03-lavalampan.js',
  './ikoner/ikon-180.png',
  './ikoner/ikon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILER)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((nycklar) => Promise.all(nycklar.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then((svar) => {
        const kopia = svar.clone();
        caches.open(CACHE).then((c) => c.put(e.request, kopia));
        return svar;
      })
      .catch(() => caches.match(e.request)),
  );
});
