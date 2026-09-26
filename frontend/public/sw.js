/* ═══════════════════════════════════════════════════════════════
   AutoBusiness AI — Service Worker v1
   Estrategia: Cache-First para assets con hash, Network-First para
   API/manifest.json/sw.js (para que reflejen cambios en el siguiente
   reload sin depender de subir CACHE_NAME a mano). Las ventas offline
   del POS se encolan en localStorage (ver POS.jsx), no aquí.
═══════════════════════════════════════════════════════════════ */

const CACHE_NAME   = 'autobusiness-v4'
const API_CACHE    = 'autobusiness-api-v1'

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
]

const API_CACHE_ROUTES = [
  '/api/inventory',
  '/api/pos/products',
  '/api/pos/top-products',
  '/api/dashboard',
  '/api/categories',
]

// ── Install: pre-cache static assets ─────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  )
})

// ── Activate: clean old caches ────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys
        .filter(k => k !== CACHE_NAME && k !== API_CACHE)
        .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  )
})

// ── Fetch: routing strategy ───────────────────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url)

  // Skip non-GET and cross-origin
  if (event.request.method !== 'GET') return
  if (url.origin !== self.location.origin) return

  // Navegaciones / HTML (app shell): Network-First para tomar SIEMPRE la
  // ultima version tras un deploy. Asi el HTML nunca queda apuntando a
  // bundles viejos que ya no existen (causa de "pantalla en blanco").
  if (event.request.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('.html')) {
    event.respondWith(networkFirstShell(event.request))
    return
  }

  // manifest.json y el propio sw.js: Network-First. Son metadata de la PWA,
  // no assets con hash — tienen que reflejar el cambio en el siguiente
  // reload solo, sin depender de subir CACHE_NAME a mano cada vez (eso fue
  // lo que obligo al bump manual a v3 para el fix de orientacion).
  if (url.pathname === '/manifest.json' || url.pathname === '/sw.js') {
    event.respondWith(networkFirstWithCache(event.request, CACHE_NAME))
    return
  }

  // API routes: Network-First con fallback a cache
  if (url.pathname.startsWith('/api/')) {
    const shouldCache = API_CACHE_ROUTES.some(r => url.pathname.startsWith(r))

    if (shouldCache) {
      event.respondWith(networkFirstWithCache(event.request, API_CACHE, JSON.stringify({ error: 'Sin conexión', offline: true })))
    }
    return
  }

  // Assets con hash (js/css/imagenes): Cache-First (son inmutables por build)
  event.respondWith(cacheFirstWithNetwork(event.request))
})

// Network-First para el app shell: trae el HTML fresco y solo cae al cache
// cuando no hay conexion.
async function networkFirstShell(req) {
  try {
    const resp = await fetch(req)
    if (resp.ok) {
      const cache = await caches.open(CACHE_NAME)
      cache.put('/index.html', resp.clone())
    }
    return resp
  } catch {
    return (await caches.match(req))
      || (await caches.match('/index.html'))
      || new Response('Offline', { status: 503 })
  }
}

async function cacheFirstWithNetwork(req) {
  const cached = await caches.match(req)
  if (cached) return cached
  try {
    const resp = await fetch(req)
    if (resp.ok) {
      const cache = await caches.open(CACHE_NAME)
      cache.put(req, resp.clone())
    }
    return resp
  } catch {
    // Fallback to index.html for SPA navigation
    return caches.match('/index.html') || new Response('Offline', { status: 503 })
  }
}

// Network-First con cache de respaldo — recibe a que cache guardar (API_CACHE
// para rutas de API, CACHE_NAME para manifest.json/sw.js) y un cuerpo
// opcional para cuando no hay red y tampoco hay nada cacheado todavia.
async function networkFirstWithCache(req, cacheName, offlineBody) {
  try {
    const resp = await fetch(req)
    if (resp.ok) {
      const cache = await caches.open(cacheName)
      cache.put(req, resp.clone())
    }
    return resp
  } catch {
    const cached = await caches.match(req)
    if (cached) return cached
    return offlineBody
      ? new Response(offlineBody, { status: 503, headers: { 'Content-Type': 'application/json' } })
      : new Response(null, { status: 503 })
  }
}

// ── Push Notifications ────────────────────────────────────────
self.addEventListener('push', event => {
  let data = { title: 'AutoBusiness', body: 'Tienes una notificación nueva' }
  try { data = event.data.json() } catch {}

  event.waitUntil(
    self.registration.showNotification(data.title || 'AutoBusiness', {
      body:  data.body || '',
      icon:  '/favicon-192.png',
      badge: '/favicon-192.png',
      data:  { url: data.url || '/' },
      vibrate: [200, 100, 200],
    })
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const url = event.notification.data?.url || '/'
  event.waitUntil(clients.openWindow(url))
})
