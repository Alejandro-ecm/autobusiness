#!/usr/bin/env node
// Auditoría de accesibilidad (axe-core) sobre las mismas rutas del smoke
// test. Es un REPORTE resumido por severidad, no un gate de deploy — no
// sale con código de error. Requiere el stack levantado (docker compose up).
//
// Uso: node scripts/a11y.mjs

import { chromium } from 'playwright'
import AxeBuilder from '@axe-core/playwright'

const APP_URL = process.env.SMOKE_APP_URL || 'http://localhost:3000'
const API_URL = process.env.SMOKE_API_URL || 'http://localhost:8080/api'
const DEMO_EMAIL = process.env.SMOKE_EMAIL || 'dueno@demo.com'
const DEMO_PASSWORD = process.env.SMOKE_PASSWORD || 'demo123'

// Mismas rutas y selectores que frontend/scripts/smoke.mjs — networkidle no
// sirve aquí (hay polling/analytics de fondo que nunca llegan a idle),
// así que se espera el mismo elemento clave que confirma que la pantalla
// realmente cargó.
const AUTH_ROUTES = [
  { path: '/caja',      name: 'Caja (POS)', selector: 'input[placeholder*="Escanea"]' },
  { path: '/reports',   name: 'Reportes',   selector: 'h1:has-text("Reportes de Ventas")' },
  { path: '/inventory', name: 'Inventario', selector: 'h1:has-text("Inventario")' },
  { path: '/finance',   name: 'Finanzas',   selector: 'h1:has-text("Finanzas")' },
  { path: '/customers', name: 'Clientes',   selector: 'h1:has-text("Clientes")' },
]
const PUBLIC_ROUTES = [
  { path: '/privacidad',        name: 'Aviso de Privacidad',   selector: 'h1:has-text("Privacidad")' },
  { path: '/terminos',          name: 'Términos y Condiciones', selector: 'h1:has-text("Términos")' },
  { path: '/cookies',           name: 'Política de Cookies',   selector: 'h1:has-text("Cookies")' },
  { path: '/reembolsos',        name: 'Política de Reembolsos', selector: 'h1:has-text("Reembolsos")' },
  { path: '/tienda/tienda-demo', name: 'Tienda Online pública', selector: 'text=Tienda Demo' },
]

const SEVERITY_ORDER = ['critical', 'serious', 'moderate', 'minor']

async function login() {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: DEMO_EMAIL, password: DEMO_PASSWORD }),
  })
  if (!res.ok) throw new Error(`Login falló: HTTP ${res.status}`)
  const data = await res.json()
  return { token: data.token, user: data.user }
}

async function auditRoute(page, route, session) {
  if (session) {
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' })
    await page.evaluate(({ token, user }) => {
      localStorage.setItem('ab_token', token)
      localStorage.setItem('ab_user', JSON.stringify(user))
    }, session)
  }
  await page.goto(`${APP_URL}${route.path}`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector(route.selector, { timeout: 10_000 })
  const results = await new AxeBuilder({ page }).analyze()
  return results.violations
}

async function main() {
  console.log(`Auditoría de accesibilidad (axe-core) — ${APP_URL}\n`)

  let session
  try {
    session = await login()
  } catch (err) {
    console.error(`No se pudo iniciar sesión con el usuario demo: ${err.message}`)
    console.error('¿Está el backend levantado? (docker compose up)')
    process.exit(1)
  }

  const browser = await chromium.launch()
  const totals = { critical: 0, serious: 0, moderate: 0, minor: 0 }
  const byRoute = []

  for (const route of [...AUTH_ROUTES.map(r => ({ ...r, auth: true })), ...PUBLIC_ROUTES.map(r => ({ ...r, auth: false }))]) {
    const context = await browser.newContext()
    const page = await context.newPage()
    let violations = []
    try {
      violations = await auditRoute(page, route, route.auth ? session : null)
    } catch (err) {
      console.error(`⚠️  ${route.path}: no se pudo auditar (${err.message})`)
    }
    await context.close()

    const counts = { critical: 0, serious: 0, moderate: 0, minor: 0 }
    for (const v of violations) {
      if (counts[v.impact] !== undefined) counts[v.impact]++
      if (totals[v.impact] !== undefined) totals[v.impact]++
    }
    byRoute.push({ route, violations, counts })
  }

  await browser.close()

  console.log('Ruta'.padEnd(26) + SEVERITY_ORDER.map(s => s.padEnd(11)).join(''))
  console.log('-'.repeat(26 + 11 * 4))
  for (const { route, counts } of byRoute) {
    console.log(route.path.padEnd(26) + SEVERITY_ORDER.map(s => String(counts[s]).padEnd(11)).join(''))
  }
  console.log()

  console.log('Detalle por regla (agrupado, todas las rutas):\n')
  const byRule = new Map()
  for (const { route, violations } of byRoute) {
    for (const v of violations) {
      if (!byRule.has(v.id)) byRule.set(v.id, { impact: v.impact, help: v.help, routes: new Set(), nodes: 0 })
      const entry = byRule.get(v.id)
      entry.routes.add(route.path)
      entry.nodes += v.nodes.length
    }
  }
  const rules = [...byRule.entries()].sort((a, b) => SEVERITY_ORDER.indexOf(a[1].impact) - SEVERITY_ORDER.indexOf(b[1].impact))
  if (rules.length === 0) {
    console.log('  (ninguna violación detectada por axe-core en las rutas auditadas)')
  }
  for (const [id, info] of rules) {
    console.log(`  [${info.impact}] ${id} — ${info.help}`)
    console.log(`    rutas: ${[...info.routes].join(', ')} · elementos afectados: ${info.nodes}`)
  }

  console.log(`\nTotales: critical=${totals.critical} serious=${totals.serious} moderate=${totals.moderate} minor=${totals.minor}`)
  console.log('\n(Esto es un reporte, no bloquea el deploy — revisar y decidir qué corregir.)')
}

main()
