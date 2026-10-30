/* GitHub Pages-compatible service worker. Uses the repository subfolder as its base. */
'use strict';
const BASE_URL = new URL('./', self.location.href);
const CACHE_NAME = 'ngothang-video-github-v5';
const SHELL_PATHS = [
  './', './index.html', './styles.css', './app.js', './manifest.webmanifest',
  './offline.html', './privacy.html', './BAT_DAU_NHANH.html',
  './assets/icon-192.png', './assets/icon-512.png', './assets/apple-touch-icon.png'
];
const APP_SHELL = SHELL_PATHS.map(path => new URL(path, BASE_URL).toString());
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith(BASE_URL.pathname)) return;
  // The shared API config must not be cached by this service worker.
  if (url.pathname.endsWith('/config.js')) return;
  if (url.pathname.endsWith('/privacy.html')) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(response => {
      if (response.ok) caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()));
      return response;
    }).catch(async () => (await caches.match(request)) || (await caches.match(new URL('./index.html', BASE_URL).toString())) || caches.match(new URL('./offline.html', BASE_URL).toString())));
    return;
  }
  event.respondWith(caches.match(request).then(cached => {
    const network = fetch(request).then(response => {
      if (response.ok) caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()));
      return response;
    }).catch(() => cached);
    return cached || network;
  }));
});
