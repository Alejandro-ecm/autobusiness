#!/usr/bin/env node
// Smoke test de la app real — lo que `vite build` no detecta (errores de
// runtime, pantallas en blanco, loaders colgados). Corre ANTES de cada
// deploy. Ver README.md para cómo ejecutarlo.
//
// Requiere el stack levantado (docker compose up) y Playwright instalado
// como devDependency de frontend/ (npm install ya lo trae).

import { chromium } from 'playwright'

const APP_URL = process.env.SMOKE_APP_URL || 'http://localhost:3000'
const API_URL = process.env.SMOKE_API_URL || 'http://localhost:8080/api'
const DEMO_EMAIL = process.env.SMOKE_EMAIL || 'dueno@demo.com'
const DEMO_PASSWORD = process.env.SMOKE_PASSWORD || 'demo123'
const LOAD_TIMEOUT_MS = 10_000

// Rutas protegidas (requieren sesión) — selector = algo que solo aparece
// cuando la pantalla realmente cargó, no solo el loader.
const AUTH_ROUTES = [
  { path: '/caja',      name: 'Caja (POS)', selector: 'input[placeholder*="Escanea"]' },
  { path: '/reports',   name: 'Reportes',   selector: 'h1:has-text("Reportes de Ventas")' },
  { path: '/inventory', name: 'Inventario', selector: 'h1:has-text("Inventario")' },
  { path: '/finance',   name: 'Finanzas',   selector: 'h1:has-text("Finanzas")' },
  { path: '/customers', name: 'Clientes',   selector: 'h1:has-text("Clientes")' },
]

// Rutas públicas — sin sesión.
const PUBLIC_ROUTES = [
  { path: '/privacidad',        name: 'Aviso de Privacidad',   selector: 'h1:has-text("Privacidad")' },
  { path: '/terminos',          name: 'Términos y Condiciones', selector: 'h1:has-text("Términos")' },
  { path: '/cookies',           name: 'Política de Cookies',   selector: 'h1:has-text("Cookies")' },
  { path: '/reembolsos',        name: 'Política de Reembolsos', selector: 'h1:has-text("Reembolsos")' },
  { path: '/tienda/tienda-demo', name: 'Tienda Online pública', selector: 'text=Tienda Demo' },
]

async function login() {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: DEMO_EMAIL, password: DEMO_PASSWORD }),
  })
  if (!res.ok) throw new Error(`Login fallo: HTTP ${res.status}`)
  const data = await res.json()
  return { token: data.token, user: data.user }
}

async function checkRoute(page, route, session) {
  const errors = []
  const onConsole = (msg) => { if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`) }
  const onPageError = (err) => errors.push(`pageerror: ${err.message}`)
  page.on('console', onConsole)
  page.on('pageerror', onPageError)

  try {
    if (session) {
      // Sesión inyectada vía localStorage, igual que hace el login real
      // (mismo mecanismo que usa AuthContext al recibir la respuesta de /auth/login).
      await page.goto(APP_URL, { waitUntil: 'domcontentloaded' })
      await page.evaluate(({ token, user }) => {
        localStorage.setItem('ab_token', token)
        localStorage.setItem('ab_user', JSON.stringify(user))
      }, session)
    }

    await page.goto(`${APP_URL}${route.path}`, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector(route.selector, { timeout: LOAD_TIMEOUT_MS })

    if (errors.length > 0) {
      return { ok: false, error: errors.join(' | ') }
    }
    return { ok: true, error: null }
  } catch (err) {
    const timedOut = /Timeout .*exceeded/.test(err.message)
    const reason = timedOut
      ? `pantalla no cargó en ${LOAD_TIMEOUT_MS / 1000}s (loader colgado o elemento clave ausente)`
      : err.message
    return { ok: false, error: [reason, ...errors].join(' | ') }
  } finally {
    page.off('console', onConsole)
    page.off('pageerror', onPageError)
  }
}

async function main() {
  console.log(`Smoke test — ${APP_URL}\n`)

  let session
  try {
    session = await login()
  } catch (err) {
    console.error(`No se pudo iniciar sesión con el usuario demo: ${err.message}`)
    console.error('¿Está el backend levantado? (docker compose up)')
    process.exit(1)
  }

  const browser = await chromium.launch()
  const results = []

  for (const route of [...AUTH_ROUTES.map(r => ({ ...r, auth: true })), ...PUBLIC_ROUTES.map(r => ({ ...r, auth: false }))]) {
    const page = await browser.newPage()
    const { ok, error } = await checkRoute(page, route, route.auth ? session : null)
    results.push({ ...route, ok, error })
    await page.close()
  }

  await browser.close()

  console.log('Ruta'.padEnd(24) + 'Estado'.padEnd(10) + 'Error')
  console.log('-'.repeat(70))
  let allOk = true
  for (const r of results) {
    if (!r.ok) allOk = false
    console.log(
      `${r.path.padEnd(24)}${(r.ok ? 'OK' : 'FALLA').padEnd(10)}${r.error || ''}`
    )
  }
  console.log()

  if (!allOk) {
    console.error('❌ Smoke test FALLÓ — no despliegues hasta corregir lo de arriba.')
    process.exit(1)
  }
  console.log('✅ Smoke test OK — todas las rutas cargaron sin errores.')
}

main()
