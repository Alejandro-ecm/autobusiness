/**
 * WhatsApp Service — sesiones Baileys multi-tenant (una por negocio).
 *
 * El dueño escanea un QR (como WhatsApp Web) y el Vendedor IA responde
 * los mensajes entrantes consultando al ai-engine. El backend Java es el
 * único cliente de este servicio (header x-internal-token).
 *
 * Endpoints:
 *   POST /sessions/:businessId/connect  → inicia sesión / genera QR
 *   GET  /sessions/:businessId/status   → { status, qr?, phone? }
 *   POST /sessions/:businessId/logout   → cierra sesión y borra credenciales
 *   GET  /health                        → sin token
 */
import express from 'express'
import fs from 'fs'
import path from 'path'
import pino from 'pino'
import QRCode from 'qrcode'
import makeWASocket, { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from 'baileys'

const PORT = process.env.PORT || 8002
const AI_ENGINE_URL = process.env.AI_ENGINE_URL || 'http://localhost:8001'
const INTERNAL_TOKEN = process.env.WA_INTERNAL_TOKEN || 'autobusiness_wa_internal_dev'
const SESSIONS_DIR = process.env.SESSIONS_DIR || path.join(process.cwd(), 'sessions')

const log = pino({ level: process.env.LOG_LEVEL || 'info' })
const baileysLog = pino({ level: 'silent' }) // Baileys es muy ruidoso

fs.mkdirSync(SESSIONS_DIR, { recursive: true })

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** businessId → { sock, status: 'connecting'|'qr'|'connected'|'disconnected', qr, phone, stopping } */
const sessions = new Map()

const sessionPath = (businessId) => path.join(SESSIONS_DIR, businessId)

async function startSession(businessId) {
  const existing = sessions.get(businessId)
  if (existing && ['connecting', 'qr', 'connected'].includes(existing.status)) return existing

  const state = { sock: null, status: 'connecting', qr: null, phone: null, stopping: false }
  sessions.set(businessId, state)

  const { state: authState, saveCreds } = await useMultiFileAuthState(sessionPath(businessId))
  // Versión actual del protocolo WhatsApp Web — sin esto WA rechaza con 405
  const { version } = await fetchLatestBaileysVersion()

  const sock = makeWASocket({
    version,
    auth: authState,
    logger: baileysLog,
    browser: ['AutoBusiness AI', 'Chrome', '1.0'],
    syncFullHistory: false,
    markOnlineOnConnect: false, // así el dueño sigue recibiendo notificaciones en su celular
  })
  state.sock = sock

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update

    if (qr) {
      try {
        state.qr = await QRCode.toDataURL(qr, { margin: 1, width: 320 })
        state.status = 'qr'
        log.info({ businessId }, 'QR generado')
      } catch (e) {
        log.error({ businessId, err: e.message }, 'error generando QR')
      }
    }

    if (connection === 'open') {
      state.status = 'connected'
      state.qr = null
      state.phone = sock.user?.id?.split(':')[0] || null
      log.info({ businessId, phone: state.phone }, 'WhatsApp conectado')
    }

    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode
      const loggedOut = code === DisconnectReason.loggedOut
      state.qr = null

      if (state.stopping || loggedOut) {
        state.status = 'disconnected'
        sessions.delete(businessId)
        if (loggedOut) {
          // El usuario desvinculó el dispositivo desde su celular → borrar credenciales
          fs.rmSync(sessionPath(businessId), { recursive: true, force: true })
          log.info({ businessId }, 'sesión cerrada (logout)')
        }
        return
      }

      // Caída temporal (restartRequired tras escanear QR, red, etc.) → reconectar
      state.status = 'connecting'
      log.warn({ businessId, code }, 'conexión cerrada — reintentando en 2s')
      sessions.delete(businessId)
      setTimeout(() => startSession(businessId).catch(e =>
        log.error({ businessId, err: e.message }, 'fallo al reconectar')), 2000)
    }
  })

  sock.ev.on('messages.upsert', async ({ type, messages }) => {
    if (type !== 'notify') return
    for (const msg of messages) {
      try {
        await handleIncoming(businessId, sock, msg)
      } catch (e) {
        log.error({ businessId, err: e.message }, 'error procesando mensaje')
      }
    }
  })

  return state
}

function extractText(msg) {
  const m = msg.message
  if (!m) return null
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    m.ephemeralMessage?.message?.conversation ||
    m.ephemeralMessage?.message?.extendedTextMessage?.text ||
    null
  )
}

async function handleIncoming(businessId, sock, msg) {
  if (msg.key.fromMe) return
  const jid = msg.key.remoteJid || ''
  // Solo chats directos: nada de grupos, difusiones ni canales
  if (!jid.endsWith('@s.whatsapp.net')) return

  const text = extractText(msg)
  if (!text || !text.trim()) return

  // Preguntar al cerebro (también valida que el Vendedor IA esté activado)
  const res = await fetch(`${AI_ENGINE_URL}/vendedor/${businessId}/reply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: text.trim(), from: jid.split('@')[0] }),
  })
  if (!res.ok) {
    log.warn({ businessId, status: res.status }, 'ai-engine respondió error')
    return
  }
  const { reply } = await res.json()
  if (!reply) return

  // Marcar leído + "escribiendo..." para que se sienta humano
  try {
    await sock.readMessages([msg.key])
    await sock.sendPresenceUpdate('composing', jid)
    await new Promise(r => setTimeout(r, 1200 + Math.random() * 800))
  } catch { /* cosmético — no bloquea la respuesta */ }

  await sock.sendMessage(jid, { text: reply })
  await sock.sendPresenceUpdate('paused', jid).catch(() => {})
  log.info({ businessId, jid: jid.split('@')[0] }, 'respuesta enviada')
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
    const hasCreds = fs.existsSync(path.join(sessionPath(businessId), 'creds.json'))
    return { status: hasCreds ? 'paused' : 'disconnected' }
  }
  return { status: s.status, qr: s.status === 'qr' ? s.qr : undefined, phone: s.phone || undefined }
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

app.post('/sessions/:businessId/logout', async (req, res) => {
  const businessId = req.params.businessId
  const s = sessions.get(businessId)
  try {
    if (s?.sock) {
      s.stopping = true
      await s.sock.logout().catch(() => {})
      s.sock.end?.()
    }
  } finally {
    sessions.delete(businessId)
    fs.rmSync(sessionPath(businessId), { recursive: true, force: true })
  }
  res.json({ status: 'disconnected' })
})

// Restaurar sesiones existentes al arrancar (negocios ya vinculados)
for (const dir of fs.readdirSync(SESSIONS_DIR, { withFileTypes: true })) {
  if (dir.isDirectory() && UUID_RE.test(dir.name) &&
      fs.existsSync(path.join(SESSIONS_DIR, dir.name, 'creds.json'))) {
    startSession(dir.name).catch(e => log.error({ businessId: dir.name, err: e.message }, 'no se pudo restaurar sesión'))
  }
}

app.listen(PORT, () => log.info(`WhatsApp service escuchando en :${PORT} — sesiones en ${SESSIONS_DIR}`))
