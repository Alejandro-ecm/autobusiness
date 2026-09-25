// Lectura de báscula vía Web Serial (Chrome/Edge de escritorio, en contexto
// seguro: HTTPS o localhost — Web Serial no funciona en HTTP normal). Mismo
// tipo de limitación que ya tiene el Bluetooth de la impresora en
// bluetoothPrinter.js.
//
// El peso que sale de aquí es DINERO cobrado al cliente, así que las reglas
// son estrictas:
//  - parseScaleLine() nunca asume "kg" si la báscula no manda la unidad
//    explícita — mejor mostrar la lectura cruda y que el cajero confirme.
//  - Una lectura solo se considera usable cuando está marcada estable por el
//    protocolo (bandera ST/US tipo NCI/A&D) o, si la báscula no manda esa
//    bandera, cuando 3 lecturas seguidas caen dentro de ±2 g.
//  - El peso NUNCA se agrega solo al carrito: la UI (POS.jsx) siempre
//    requiere que el cajero presione "Usar este peso" a propósito.
//
// No hay báscula física a la mano para probar contra un protocolo real — el
// parser genérico de abajo cubre texto plano ASCII con o sin bandera de
// estabilidad (formatos tipo NCI/A&D: "ST,GS,+001.500kg"). Si un modelo
// específico no calza con esto, el panel de diagnóstico (últimas líneas
// crudas) sirve para armarle un parser dedicado con el dato real en mano.

const LB_TO_KG = 0.45359237
const STABILITY_TOLERANCE_KG = 0.002
const STABILITY_COUNT = 3
const SETTINGS_KEY = 'ab_scale_settings'
const DIAG_LINES = 10

// ── Parser puro — testeable sin hardware, ver scripts/test-scale-parser.mjs ──
// Devuelve null si la línea no trae ningún número reconocible. Si no trae
// unidad reconocida, unit/kg quedan en null (a propósito: no adivinar).
export function parseScaleLine(rawLine) {
  const line = String(rawLine ?? '').trim()
  if (!line) return null

  let stable = null
  if (/\bST\b/.test(line)) stable = true
  else if (/\bUS\b/.test(line)) stable = false

  const m = line.match(/(-?\d+(?:\.\d+)?)\s*(kgs?|grs?|g|lbs?)?/i)
  if (!m) return null
  const value = parseFloat(m[1])
  if (!Number.isFinite(value)) return null

  const unitRaw = (m[2] || '').toLowerCase()
  let unit = null
  let kg = null
  if (/^kgs?$/.test(unitRaw)) { unit = 'kg'; kg = value }
  else if (/^(g|grs?)$/.test(unitRaw)) { unit = 'g'; kg = value / 1000 }
  else if (/^lbs?$/.test(unitRaw)) { unit = 'lb'; kg = value * LB_TO_KG }

  return { raw: line, value, unit, kg, stable }
}

// Valida un peso ya convertido a kg antes de dejarlo usar. maxKg es
// configurable (ver getScaleSettings) — default 40 kg.
export function validateWeightKg(kg, maxKg = 40) {
  if (kg === null || kg === undefined || !Number.isFinite(kg)) return 'Lectura inválida'
  if (kg <= 0) return 'El peso debe ser mayor a cero'
  if (kg > maxKg) return `El peso excede la capacidad máxima configurada (${maxKg} kg)`
  return null
}

// ── Configuración persistida (best-effort: localStorage puede fallar en
// modo privado/incógnito con almacenamiento bloqueado) ──
const DEFAULT_SETTINGS = { baudRate: 9600, pollCommand: '', maxKg: 40 }

export function getScaleSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveScaleSettings(partial) {
  const next = { ...getScaleSettings(), ...partial }
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(next)) } catch { /* sin storage disponible */ }
  return next
}

// ── Estado de conexión (módulo singleton — una báscula por sesión) ──
let port = null
let reader = null
let writer = null
let readLoopPromise = null
let pollTimer = null
let lineBuffer = ''
let stabilityHistory = []
let listeners = new Set()
let diagLines = []
let lastReading = null // { raw, value, unit, kg, stable, at }

export function scaleSupported() {
  return typeof navigator !== 'undefined' && !!navigator.serial
}

export function scaleConnected() {
  return !!port
}

export function getDiagnosticLines() {
  return [...diagLines]
}

export function getLastReading() {
  return lastReading
}

// Se dispara con cada lectura nueva ya parseada — para el readout en vivo.
// Devuelve una función para des-suscribirse.
export function subscribeScale(cb) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

function computeStable(parsed) {
  // El protocolo trae bandera explícita (ST/US) — se confía en ella.
  if (parsed.stable === true) { stabilityHistory = []; return true }
  if (parsed.stable === false) { stabilityHistory = []; return false }
  // Sin bandera y sin unidad reconocida: nunca se considera estable/usable.
  if (parsed.kg === null) { stabilityHistory = []; return false }
  // Sin bandera: 3 lecturas seguidas dentro de ±2 g se consideran estables.
  stabilityHistory.push(parsed.kg)
  if (stabilityHistory.length > STABILITY_COUNT) stabilityHistory.shift()
  if (stabilityHistory.length < STABILITY_COUNT) return false
  const [a, b, c] = stabilityHistory
  return Math.abs(a - b) <= STABILITY_TOLERANCE_KG && Math.abs(b - c) <= STABILITY_TOLERANCE_KG
}

function pushLine(line) {
  diagLines.push(line)
  if (diagLines.length > DIAG_LINES) diagLines.shift()
  const parsed = parseScaleLine(line)
  if (!parsed) return
  const stable = computeStable(parsed)
  lastReading = { ...parsed, stable, at: Date.now() }
  listeners.forEach(cb => { try { cb(lastReading) } catch { /* listener con bug — no debe tumbar la lectura */ } })
}

async function readLoop() {
  const decoder = new TextDecoder()
  try {
    while (port?.readable) {
      reader = port.readable.getReader()
      try {
        while (true) {
          const { value, done } = await reader.read()
          if (done) break
          lineBuffer += decoder.decode(value, { stream: true })
          let idx
          while ((idx = lineBuffer.indexOf('\n')) >= 0) {
            const line = lineBuffer.slice(0, idx)
            lineBuffer = lineBuffer.slice(idx + 1)
            if (line.trim()) pushLine(line)
          }
        }
      } finally {
        reader.releaseLock()
        reader = null
      }
    }
  } catch {
    // Puerto desconectado o error de lectura — scaleDisconnect() limpia el estado
  }
}

// Básculas que no transmiten solas necesitan que se les mande un comando
// (ej. "P\r" o "W\r") para que respondan — se reenvía cada 300ms mientras
// dure la conexión.
async function startPolling(pollCommand) {
  if (!pollCommand) return
  const encoder = new TextEncoder()
  writer = port.writable.getWriter()
  pollTimer = setInterval(() => {
    writer.write(encoder.encode(pollCommand)).catch(() => { /* se limpia al desconectar */ })
  }, 300)
}

async function openPort(selectedPort, settings) {
  port = selectedPort
  await port.open({ baudRate: settings.baudRate, dataBits: 8, stopBits: 1, parity: 'none' })
  lineBuffer = ''
  stabilityHistory = []
  diagLines = []
  lastReading = null
  readLoopPromise = readLoop()
  if (settings.pollCommand) await startPolling(settings.pollCommand)
}

// Conecta con la báscula. La primera vez requiere un gesto del usuario (el
// navegador muestra el selector nativo de puertos COM). Si ya se autorizó un
// puerto en una sesión anterior, se reconecta directo con
// navigator.serial.getPorts() sin volver a pedir permiso en cada venta.
export async function scaleConnect(settingsOverride) {
  if (!scaleSupported()) {
    throw new Error('Este navegador no soporta lectura de báscula. Usa Chrome o Edge en una PC, con la página en HTTPS o localhost.')
  }
  if (scaleConnected()) return
  const settings = { ...getScaleSettings(), ...(settingsOverride || {}) }

  const known = await navigator.serial.getPorts()
  const chosen = known.length === 1 ? known[0] : await navigator.serial.requestPort()
  await openPort(chosen, settings)
}

export async function scaleDisconnect() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
  try { await writer?.close() } catch { /* ya estaba cerrado */ }
  writer = null
  try { await reader?.cancel() } catch { /* ya estaba cerrado */ }
  try { await readLoopPromise } catch { /* el loop ya terminó por el cancel */ }
  try { await port?.close() } catch { /* ya estaba cerrado */ }
  port = null
  reader = null
  readLoopPromise = null
  lineBuffer = ''
  stabilityHistory = []
  lastReading = null
}
