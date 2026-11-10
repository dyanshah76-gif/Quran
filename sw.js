// Offline support.
//
// - Files of this site: the network is asked first, so a new version shows as
//   soon as it is published; the saved copy is used when there is no network.
// - Quran text, tafsir, hadith and fonts come from addresses pinned to a fixed
//   version (see assets/sources.js). Such a file never changes, so the saved
//   copy is used first. A surah is available offline once it has been opened.
// - Recitation files are not saved: they are streamed from EveryAyah.com.
//
// Nothing is changed on the way: responses are stored and given back as is.

const VERSION = 'v1';
const SITE = `site-${VERSION}`;
const PINNED = 'pinned-v1';
const SHELL = [
  './',
  'index.html',
  'adhkar.html',
  'manifest.webmanifest',
  'favicon.svg',
  'assets/app.js',
  'assets/audio.js',
  'assets/i18n.js',
  'assets/sources.js',
  'assets/styles.css',
  'assets/adhkar.js',
  'assets/adhkar.css',
  'assets/sky.js',
  'assets/icon-180.png',
  'assets/icon-192.png',
  'data/adhkar/adhkar.json',
];
const PINNED_HOSTS = ['cdn.jsdelivr.net', 'raw.githubusercontent.com', 'fonts.gstatic.com'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SITE)
      .then((cache) => Promise.all(SHELL.map((url) => cache.add(url).catch(() => {}))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== SITE && key !== PINNED).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (error) {
    const saved = await cache.match(request, { ignoreSearch: request.mode === 'navigate' });
    if (saved) return saved;
    throw error;
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const saved = await cache.match(request);
  if (saved) return saved;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin === self.location.origin) event.respondWith(networkFirst(request, SITE));
  else if (PINNED_HOSTS.includes(url.hostname)) event.respondWith(cacheFirst(request, PINNED));
  else if (url.hostname === 'fonts.googleapis.com') event.respondWith(networkFirst(request, PINNED));
});
