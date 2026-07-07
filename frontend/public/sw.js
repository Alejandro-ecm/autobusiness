/* ═══════════════════════════════════════════════════════════════
   AutoBusiness AI — Service Worker v1
   Estrategia: Cache-First para assets, Network-First para API,
   IndexedDB queue para POS offline
═══════════════════════════════════════════════════════════════ */

const CACHE_NAME   = 'autobusiness-v2'
const API_CACHE    = 'autobusiness-api-v1'
const OFFLINE_DB   = 'ab-offline'
const OFFLINE_STORE = 'pending-sales'

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

  // API routes: Network-First con fallback a cache
  if (url.pathname.startsWith('/api/')) {
    const shouldCache = API_CACHE_ROUTES.some(r => url.pathname.startsWith(r))

    if (shouldCache) {
      event.respondWith(networkFirstWithCache(event.request))
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

async function networkFirstWithCache(req) {
  try {
    const resp = await fetch(req)
    if (resp.ok) {
      const cache = await caches.open(API_CACHE)
      cache.put(req, resp.clone())
    }
    return resp
  } catch {
    const cached = await caches.match(req)
    return cached || new Response(JSON.stringify({ error: 'Sin conexión', offline: true }),
      { status: 503, headers: { 'Content-Type': 'application/json' } })
  }
}

// ── Background Sync: enviar ventas pendientes ─────────────────
self.addEventListener('sync', event => {
  if (event.tag === 'sync-pending-sales') {
    event.waitUntil(syncPendingSales())
  }
})

async function syncPendingSales() {
  const db   = await openDB()
  const sales = await getAllPending(db)
  if (!sales.length) return

  const token = await getToken()
  let synced  = 0

  for (const sale of sales) {
    try {
      const resp = await fetch('/api/pos/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(sale.data),
      })
      if (resp.ok) {
        await deletePending(db, sale.id)
        synced++
      }
    } catch { /* retry next time */ }
  }

  if (synced > 0) {
    self.registration.showNotification('AutoBusiness', {
      body: `${synced} venta${synced > 1 ? 's' : ''} sincronizada${synced > 1 ? 's' : ''} correctamente`,
      icon: '/favicon-192.png',
    })
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

// ── IndexedDB helpers ─────────────────────────────────────────
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(OFFLINE_DB, 1)
    req.onupgradeneeded = e => {
      e.target.result.createObjectStore(OFFLINE_STORE, { keyPath: 'id', autoIncrement: true })
    }
    req.onsuccess = e => resolve(e.target.result)
    req.onerror   = e => reject(e.target.error)
  })
}

function getAllPending(db) {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(OFFLINE_STORE, 'readonly')
    const req = tx.objectStore(OFFLINE_STORE).getAll()
    req.onsuccess = () => resolve(req.result)
    req.onerror   = () => reject(req.error)
  })
}

function deletePending(db, id) {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(OFFLINE_STORE, 'readwrite')
    const req = tx.objectStore(OFFLINE_STORE).delete(id)
    req.onsuccess = resolve
    req.onerror   = () => reject(req.error)
  })
}

async function getToken() {
  const clients = await self.clients.matchAll()
  // Token se pasa via postMessage desde el cliente
  return null
}
