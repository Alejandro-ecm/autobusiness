/**
 * WhatsApp Service — sesiones multi-tenant (una por negocio) sobre whatsapp-web.js.
 *
 * A diferencia de Baileys (que reimplementa el protocolo), whatsapp-web.js corre
 * el WhatsApp Web REAL dentro de un Chromium headless. Para Meta luce como un
 * navegador normal, así que es mucho más difícil de bloquear durante el
 * emparejamiento por QR.
 *
 * El dueño escanea un QR (como WhatsApp Web) y el Vendedor IA responde los
 * mensajes entrantes consultando al ai-engine. El backend Java es el único
 * cliente de este servicio (header x-internal-token).
 *
 * Endpoints (idénticos al servicio anterior):
 *   POST /sessions/:businessId/connect      → inicia sesión / genera QR
 *   GET  /sessions/:businessId/status        → { status, qr?, phone? }
 *   POST /sessions/:businessId/send          → mensaje a un cliente por teléfono
 *   POST /sessions/:businessId/notify-self   → mensaje al chat propio del negocio
 *   POST /sessions/:businessId/logout        → cierra sesión y borra credenciales
 *   GET  /health                             → sin token
 */
import express from 'express'
import fs from 'fs'
import path from 'path'
import pino from 'pino'
import QRCode from 'qrcode'
import wweb from 'whatsapp-web.js'

const { Client, LocalAuth } = wweb

const PORT = process.env.PORT || 8002
const AI_ENGINE_URL = process.env.AI_ENGINE_URL || 'http://localhost:8001'
const INTERNAL_TOKEN = process.env.WA_INTERNAL_TOKEN || 'autobusiness_wa_internal_dev'
const SESSIONS_DIR = process.env.SESSIONS_DIR || path.join(process.cwd(), 'sessions')
// En Docker apuntamos al chromium del sistema; en local, puppeteer usa el suyo
const CHROME_PATH = process.env.PUPPETEER_EXECUTABLE_PATH || undefined

const log = pino({ level: process.env.LOG_LEVEL || 'info' })

fs.mkdirSync(SESSIONS_DIR, { recursive: true })

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** businessId → { client, status, qr, phone, stopping } */
const sessions = new Map()

// LocalAuth guarda cada sesión en SESSIONS_DIR/session-<businessId>
const sessionFolder = (businessId) => path.join(SESSIONS_DIR, `session-${businessId}`)

function puppeteerOpts() {
  return {
    headless: true,
    executablePath: CHROME_PATH,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--no-first-run',
      '--no-zygote',
    ],
  }
}

async function startSession(businessId) {
  const existing = sessions.get(businessId)
  if (existing && ['connecting', 'qr', 'connected'].includes(existing.status)) return existing

  const state = { client: null, status: 'connecting', qr: null, phone: null, stopping: false }
  sessions.set(businessId, state)

  const client = new Client({
    authStrategy: new LocalAuth({ clientId: businessId, dataPath: SESSIONS_DIR }),
    puppeteer: puppeteerOpts(),
  })
  state.client = client

  client.on('qr', async (qr) => {
    try {
      state.qr = await QRCode.toDataURL(qr, { margin: 1, width: 320 })
      state.status = 'qr'
      log.info({ businessId }, 'QR generado')
    } catch (e) {
      log.error({ businessId, err: e.message }, 'error generando QR')
    }
  })

  client.on('authenticated', () => {
    state.qr = null
    log.info({ businessId }, 'autenticado — cargando sesión')
  })

  client.on('auth_failure', (m) => {
    state.status = 'disconnected'
    log.error({ businessId, msg: m }, 'fallo de autenticación')
  })

  client.on('ready', () => {
    state.status = 'connected'
    state.qr = null
    state.phone = client.info?.wid?.user || null
    log.info({ businessId, phone: state.phone }, 'WhatsApp conectado')
  })

  client.on('disconnected', async (reason) => {
    state.qr = null
    log.warn({ businessId, reason }, 'conexión cerrada')
    try { await client.destroy() } catch { /* noop */ }
    sessions.delete(businessId)

    if (state.stopping || reason === 'LOGOUT') {
      // El usuario desvinculó el dispositivo → borrar credenciales
      fs.rmSync(sessionFolder(businessId), { recursive: true, force: true })
      log.info({ businessId }, 'sesión cerrada (logout)')
      return
    }
    // Caída temporal → reintentar
    setTimeout(() => startSession(businessId).catch(e =>
      log.error({ businessId, err: e.message }, 'fallo al reconectar')), 3000)
  })

  client.on('message', async (msg) => {
    try {
      await handleIncoming(businessId, client, msg)
    } catch (e) {
      log.error({ businessId, err: e.message }, 'error procesando mensaje')
    }
  })

  client.initialize().catch(e => {
    log.error({ businessId, err: e.message }, 'error inicializando cliente')
    state.status = 'disconnected'
    sessions.delete(businessId)
  })

  return state
}

async function handleIncoming(businessId, client, msg) {
  if (msg.fromMe) return
  // Solo chats directos: nada de grupos (@g.us), estados ni difusiones
  if (!msg.from || !msg.from.endsWith('@c.us')) return

  const text = (msg.body || '').trim()
  if (!text) return

  // Preguntar al cerebro (también valida que el Vendedor IA esté activado)
  const res = await fetch(`${AI_ENGINE_URL}/vendedor/${businessId}/reply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, from: msg.from.split('@')[0] }),
  })
  if (!res.ok) {
    log.warn({ businessId, status: res.status }, 'ai-engine respondió error')
    return
  }
  const { reply } = await res.json()
  if (!reply) return

  // Marcar leído + "escribiendo..." para que se sienta humano
  try {
    const chat = await msg.getChat()
    await chat.sendSeen()
    await chat.sendStateTyping()
    await new Promise(r => setTimeout(r, 1200 + Math.random() * 800))
    await chat.clearState()
  } catch { /* cosmético — no bloquea la respuesta */ }

  await client.sendMessage(msg.from, reply)
  log.info({ businessId, from: msg.from.split('@')[0] }, 'respuesta enviada')
}

/** Resuelve el chatId de WhatsApp de un teléfono (prueba con y sin lada de México). */
async function resolveChatId(client, phone) {
  const digits = String(phone).replace(/\D/g, '')
  const candidates = [...new Set([
    digits,
    digits.length === 10 ? '52' + digits : null,
    digits.length === 10 ? '521' + digits : null,
  ].filter(Boolean))]
  for (const c of candidates) {
    try {
      const id = await client.getNumberId(c)
      if (id?._serialized) return id._serialized
    } catch { /* siguiente candidato */ }
  }
  return null
}

// ── HTTP API ──────────────────────────────────────────────────────────────────

const app = express()
app.use(express.json())

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'whatsapp-service', sessions: sessions.size }))

app.use((req, res, next) => {
  if (req.headers['x-internal-token'] !== INTERNAL_TOKEN) {
    return res.status(401).json({ error: 'unauthorized' })
  }
  next()
})

app.param('businessId', (req, res, next, id) => {
  if (!UUID_RE.test(id)) return res.status(400).json({ error: 'businessId inválido' })
  next()
})

const publicState = (businessId) => {
  const s = sessions.get(businessId)
  if (!s) {
    // Hay credenciales guardadas pero la sesión no está corriendo
    const hasCreds = fs.existsSync(sessionFolder(businessId))
    return { status: hasCreds ? 'paused' : 'disconnected' }
  }
  return {
    status: s.status,
    qr: s.status === 'qr' ? s.qr : undefined,
    phone: s.phone || undefined,
  }
}

app.post('/sessions/:businessId/connect', async (req, res) => {
  try {
    await startSession(req.params.businessId)
    res.json(publicState(req.params.businessId))
  } catch (e) {
    log.error({ err: e.message }, 'error en connect')
    res.status(500).json({ error: 'No se pudo iniciar la sesión de WhatsApp' })
  }
})

app.get('/sessions/:businessId/status', (req, res) => {
  res.json(publicState(req.params.businessId))
})

// Enviar mensaje a un cliente por teléfono (Cobrador IA: recordatorios de pago)
app.post('/sessions/:businessId/send', async (req, res) => {
  const s = sessions.get(req.params.businessId)
  if (!s || s.status !== 'connected') return res.status(409).json({ error: 'WhatsApp no conectado' })
  const { phone, text } = req.body || {}
  if (!phone || !text) return res.status(400).json({ error: 'phone y text son requeridos' })
  try {
    const chatId = await resolveChatId(s.client, phone)
    if (!chatId) return res.status(404).json({ error: 'Ese número no tiene WhatsApp' })
    await s.client.sendMessage(chatId, text)
    log.info({ businessId: req.params.businessId, phone: String(phone).slice(-4) }, 'mensaje saliente enviado')
    res.json({ sent: true })
  } catch (e) {
    log.error({ err: e.message }, 'error en send')
    res.status(500).json({ error: 'No se pudo enviar el mensaje' })
  }
})

// Mensaje al chat propio del negocio (Repositor IA: reportes y alertas de stock)
app.post('/sessions/:businessId/notify-self', async (req, res) => {
  const s = sessions.get(req.params.businessId)
  if (!s || s.status !== 'connected' || !s.client?.info?.wid?._serialized) {
    return res.status(409).json({ error: 'WhatsApp no conectado' })
  }
  const { text } = req.body || {}
  if (!text) return res.status(400).json({ error: 'text es requerido' })
  try {
    await s.client.sendMessage(s.client.info.wid._serialized, text)
    res.json({ sent: true })
  } catch (e) {
    log.error({ err: e.message }, 'error en notify-self')
    res.status(500).json({ error: 'No se pudo enviar la notificación' })
  }
})

app.post('/sessions/:businessId/logout', async (req, res) => {
  const businessId = req.params.businessId
  const s = sessions.get(businessId)
  try {
    if (s?.client) {
      s.stopping = true
      await s.client.logout().catch(() => {})
      await s.client.destroy().catch(() => {})
    }
  } finally {
    sessions.delete(businessId)
    fs.rmSync(sessionFolder(businessId), { recursive: true, force: true })
  }
  res.json({ status: 'disconnected' })
})

// Restaurar sesiones existentes al arrancar (negocios ya vinculados)
for (const dir of fs.readdirSync(SESSIONS_DIR, { withFileTypes: true })) {
  const m = dir.isDirectory() && dir.name.match(/^session-(.+)$/)
  if (m && UUID_RE.test(m[1])) {
    startSession(m[1]).catch(e => log.error({ businessId: m[1], err: e.message }, 'no se pudo restaurar sesión'))
  }
}

app.listen(PORT, () => log.info(`WhatsApp service (whatsapp-web.js) escuchando en :${PORT} — sesiones en ${SESSIONS_DIR}`))
