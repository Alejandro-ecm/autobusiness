// Impresión Bluetooth (BLE) para impresoras térmicas ESC/POS desde el
// navegador. Funciona en Chrome/Edge de Android (Web Bluetooth).
// iOS/Safari NO soporta Web Bluetooth — en iPhone no hay impresión directa.
//
// La primera vez el usuario elige su impresora en el selector del navegador;
// la conexión queda cacheada para el resto de la sesión (auto-print).

// Servicios BLE que usan las impresoras térmicas chinas más comunes
const PRINTER_SERVICES = [
  0x18f0,                                   // estándar en muchas POS-58/80
  0xffe0,                                   // módulos tipo HM-10
  0xff00,
  0xfff0,
  '49535343-fe7d-4ae5-8fa9-9fafd205e455',   // chip ISSC/Microchip
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',   // módulos serial-over-BLE
]

const CHUNK_SIZE = 100   // bytes por escritura — conservador para impresoras baratas
const CHUNK_DELAY = 20   // ms entre escrituras

let cachedDevice = null
let cachedChar = null

export function bluetoothSupported() {
  return typeof navigator !== 'undefined' && !!navigator.bluetooth
}

export function bluetoothConnected() {
  return !!(cachedDevice && cachedDevice.gatt?.connected && cachedChar)
}

async function findWritableCharacteristic(server) {
  for (const svcId of PRINTER_SERVICES) {
    try {
      const svc = await server.getPrimaryService(svcId)
      const chars = await svc.getCharacteristics()
      const ch = chars.find(c => c.properties.writeWithoutResponse || c.properties.write)
      if (ch) return ch
    } catch { /* la impresora no tiene este servicio, probar el siguiente */ }
  }
  return null
}

async function connect() {
  if (bluetoothConnected()) return
  if (!cachedDevice) {
    // Selector del navegador — requiere un gesto del usuario (tap en Imprimir)
    cachedDevice = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: PRINTER_SERVICES,
    })
    cachedDevice.addEventListener('gattserverdisconnected', () => { cachedChar = null })
  }
  const server = await cachedDevice.gatt.connect()
  cachedChar = await findWritableCharacteristic(server)
  if (!cachedChar) {
    cachedDevice.gatt.disconnect()
    cachedDevice = null
    throw new Error('El dispositivo elegido no parece ser una impresora térmica compatible')
  }
}

// Imprime bytes ESC/POS. Lanza si el usuario cancela el selector (NotFoundError)
// o si el dispositivo no es una impresora compatible.
export async function bluetoothPrint(bytes) {
  if (!bluetoothSupported()) throw new Error('Este navegador no soporta Bluetooth')
  await connect()
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.slice(i, i + CHUNK_SIZE)
    if (cachedChar.properties.writeWithoutResponse) await cachedChar.writeValueWithoutResponse(chunk)
    else await cachedChar.writeValue(chunk)
    if (CHUNK_DELAY > 0) await new Promise(r => setTimeout(r, CHUNK_DELAY))
  }
}
