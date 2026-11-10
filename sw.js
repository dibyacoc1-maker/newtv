const CACHE_PREFIX = 'luma-tv-static-';
const CACHE_NAME = `${CACHE_PREFIX}v1.0.1`;
const CORE = [
  './', './index.html', './style.css', './player.js', './storage.js', './manifest.json', './icon.svg',
  './hls.min.js', './shaka-player.compiled.js', './data/settings.json', './data/channels.json', './data/categories.json'
];
const CONFIG_PATHS = new Set(['data/settings.json', 'data/channels.json', 'data/categories.json']);
const LIVE_MEDIA = /\.(?:m3u8|mpd|ts|m2ts|m4s|mp4|m4a|m4v|aac|mp3|vtt|webvtt|key|cmfv|cmfa)(?:$|\/)/i;

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // Populate this version completely before activation; older caches remain untouched on failure.
    await cache.addAll(CORE.map(path => new Request(new URL(path, self.registration.scope), { cache: 'reload' })));
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  const relative = decodeURIComponent(url.pathname.slice(new URL(self.registration.scope).pathname.length));
  if (CONFIG_PATHS.has(relative)) {
    event.respondWith(networkFirst(request));
    return;
  }
  if (LIVE_MEDIA.test(url.pathname) || url.pathname.includes('/segment/') || request.destination === 'video' || request.destination === 'audio') return;
  event.respondWith(cacheFirst(request));
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok && response.type !== 'opaque') await cache.put(request, response.clone());
    return response;
  } catch (_) {
    return (await cache.match(request)) || new Response('Configuration is not available offline.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok && response.type !== 'opaque') await cache.put(request, response.clone());
  return response;
}
