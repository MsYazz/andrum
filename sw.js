// Nätet först, så att nya rum dyker upp direkt. Allt som hämtas sparas också,
// så att rum man redan har besökt fungerar när telefonen är offline.
const CACHE = 'andrum-v7';
const SKAL = [
  './',
  './index.html',
  './style.css?v=2',
  './app.js',
  './manifest.webmanifest',
  './ikoner/ikon-180.png',
  './ikoner/ikon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SKAL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((nycklar) => Promise.all(nycklar.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) return;
  // no-cache: fråga alltid servern om filen har ändrats, så att nya och gamla filer
  // aldrig blandas efter en uppdatering
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' })
      .then((svar) => {
        if (svar.ok) {
          const kopia = svar.clone();
          caches.open(CACHE).then((c) => c.put(e.request, kopia));
        }
        return svar;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true })),
  );
});
