// Lectura de báscula vía Web Serial (Chrome/Edge de escritorio — NO soportado
// en Android/iOS ni en Firefox/Safari; mismo tipo de limitación que ya tiene
// el Bluetooth de la impresora en bluetoothPrinter.js).
//
// El usuario conecta la báscula una vez por sesión con el selector nativo
// del navegador (requiere un gesto del usuario, ej. tap en "Leer báscula").
// Después queda leyendo en segundo plano y el último peso recibido queda
// disponible para consultarlo bajo demanda.
//
// La mayoría de básculas comerciales económicas transmiten texto ASCII plano
// con el peso (ej. "1.234 kg\r\n" o "ST,GS,+001.234kg\r\n"). Por default se usa
// un parser genérico que extrae el primer número decimal de cada línea
// recibida — cubre la mayoría de básculas de este tipo sin configuración.
// Si una báscula usa un protocolo binario/propietario (Toledo, NCI, CAS
// PD-II, etc.) este parser genérico puede no funcionar correctamente; en ese
// caso hay que agregar un parser específico para ese modelo una vez se tenga
// el aparato a la mano para probar contra el dato real.

let port = null
let reader = null
let readLoopPromise = null
let lineBuffer = ''
let lastWeight = null
let lastWeightAt = 0

export function scaleSupported() {
  return typeof navigator !== 'undefined' && !!navigator.serial
}

export function scaleConnected() {
  return !!port
}

// Extrae el primer número decimal (con signo opcional) de una línea de texto.
// Sirve para básculas que mandan texto plano tipo "1.234 kg" o "ST,GS,+1.234kg".
function parseGenericWeightLine(line) {
  const m = String(line).match(/-?\d+(\.\d+)?/)
  if (!m) return null
  const n = parseFloat(m[0])
  return Number.isFinite(n) ? n : null
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
            const w = parseGenericWeightLine(line)
            if (w !== null) { lastWeight = w; lastWeightAt = Date.now() }
          }
        }
      } finally {
        reader.releaseLock()
        reader = null
      }
    }
  } catch {
    // Puerto desconectado o error de lectura — se limpia con scaleDisconnect()
  }
}

// Conecta con la báscula. Requiere gesto del usuario la primera vez — el
// navegador muestra el selector nativo de puertos serie (COM).
export async function scaleConnect(baudRate = 9600) {
  if (!scaleSupported()) throw new Error('Este navegador no soporta lectura de báscula. Usa Chrome o Edge en una PC.')
  if (scaleConnected()) return
  port = await navigator.serial.requestPort()
  await port.open({ baudRate })
  lastWeight = null
  lastWeightAt = 0
  readLoopPromise = readLoop()
}

export async function scaleDisconnect() {
  try { await reader?.cancel() } catch { /* ya estaba cerrado */ }
  try { await readLoopPromise } catch { /* el loop ya terminó por el cancel */ }
  try { await port?.close() } catch { /* el puerto ya estaba cerrado */ }
  port = null
  reader = null
  readLoopPromise = null
  lastWeight = null
  lastWeightAt = 0
  lineBuffer = ''
}

// Último peso recibido (en la unidad que mande la báscula, normalmente kg),
// o null si no ha llegado nada en los últimos `maxAgeMs` — puede significar
// que la báscula está en cero/apagada, se desconectó, o su protocolo no lo
// reconoce el parser genérico.
export function readScaleWeight(maxAgeMs = 3000) {
  if (lastWeight === null) return null
  if (Date.now() - lastWeightAt > maxAgeMs) return null
  return lastWeight
}
