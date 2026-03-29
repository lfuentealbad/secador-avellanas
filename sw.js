/* ════════════════════════════════════════════════════
   SERVICE WORKER — Monitor Secado Avellanas
   Estrategia: cache-first (estáticos) · network-first (Open-Meteo)
════════════════════════════════════════════════════ */

const CACHE_NAME    = 'avellanas-v1';
const WEATHER_HOST  = 'api.open-meteo.com';

const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.svg',
  './icon-512.svg',
];

/* ── INSTALL: pre-cachear archivos estáticos ─── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

/* ── ACTIVATE: limpiar cachés antiguas ──────── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k !== CACHE_NAME)
          .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

/* ── FETCH: enrutar por estrategia ─────────── */
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  if (url.hostname === WEATHER_HOST) {
    /* API Open-Meteo → network-first, fallback a caché */
    event.respondWith(networkFirstWeather(event.request));
  } else {
    /* Archivos estáticos → cache-first */
    event.respondWith(cacheFirst(event.request));
  }
});

/* ── CACHE-FIRST ────────────────────────────── */
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response(
      '<h2 style="font-family:sans-serif;padding:2rem">Sin conexión — abre la app cuando tengas red por primera vez</h2>',
      { status: 503, headers: { 'Content-Type': 'text/html;charset=utf-8' } }
    );
  }
}

/* ── NETWORK-FIRST (clima) ──────────────────── */
async function networkFirstWeather(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    /* Sin red → devolver última respuesta cacheada si existe */
    const cached = await caches.match(request);
    if (cached) return cached;

    /* Sin red y sin caché → respuesta vacía válida para que la app no rompa */
    return new Response(
      JSON.stringify({ error: 'offline', current: null }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
