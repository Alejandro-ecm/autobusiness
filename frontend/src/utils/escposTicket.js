// Genera los bytes ESC/POS de un ticket de venta para impresoras térmicas
// de 58mm (384 dots = 32 columnas). Mismo diseño que el Print Bridge
// (print-bridge/AutoBusinessPrintBridge.ps1) y que la vista previa HTML.
// Si cambias el diseño aquí, cámbialo también en el bridge.

const LINE_WIDTH = 32
const CODE_PAGE = 16 // ESC t 16 = Windows-1252 (acentos en español)

// Windows-1252 coincide con los code points Unicode en el rango de acentos
// del español (á é í ó ú ñ ¿ ¡), así que basta truncar a un byte
function encodeText(str) {
  const out = []
  for (const ch of str) {
    const c = ch.codePointAt(0)
    out.push(c <= 0xff ? c : 0x3f) // fuera de rango → '?'
  }
  return out
}

function money(n) {
  return '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// Corta por palabras; solo parte una palabra si es más larga que la línea
function wrap(s, max) {
  const out = []
  let cur = ''
  for (let w of String(s).split(' ')) {
    while (w.length > max) {
      if (cur) { out.push(cur); cur = '' }
      out.push(w.slice(0, max)); w = w.slice(max)
    }
    if (!cur) cur = w
    else if (cur.length + 1 + w.length <= max) cur += ' ' + w
    else { out.push(cur); cur = w }
  }
  if (cur) out.push(cur)
  return out.length ? out : ['']
}

export function buildEscposTicket(j) {
  const bytes = []
  const raw = (...b) => bytes.push(...b)
  const text = (s) => bytes.push(...encodeText(s))
  const line = (s = '') => text(s + '\n')
  const row = (left, right) => {
    let l = String(left); const r = String(right)
    let space = LINE_WIDTH - l.length - r.length
    if (space < 1) { l = l.slice(0, Math.max(0, LINE_WIDTH - r.length - 1)); space = 1 }
    line(l + ' '.repeat(space) + r)
  }
  const sep = () => line('-'.repeat(LINE_WIDTH))
  const center = () => raw(27, 97, 1)
  const left = () => raw(27, 97, 0)
  const big = () => raw(29, 33, 17)
  const tall = () => raw(29, 33, 16)
  const normal = () => raw(29, 33, 0)
  const bold = (on) => raw(27, 69, on ? 1 : 0)
  const feed = (n) => raw(27, 100, n)

  raw(27, 64)                 // ESC @ init
  raw(27, 116, CODE_PAGE)     // ESC t code page

  // ── Encabezado ──
  center()
  big()
  for (const l of wrap(String(j.business || 'AutoBusiness').toUpperCase(), Math.floor(LINE_WIDTH / 2))) line(l)
  normal()
  left()
  sep()

  // ── Datos de la venta ──
  row('Folio: ' + (j.folio || ''), j.date || '')
  if (j.cashier) line('Le atendio: ' + j.cashier)
  if (j.payMethod) line('Forma de pago: ' + j.payMethod + (j.offline ? ' (offline)' : ''))
  sep()

  // ── Tabla de artículos ──
  bold(true)
  line('CANT '.padEnd(5) + 'DESCRIPCION'.padEnd(18) + '  IMPORTE')
  bold(false)
  sep()

  let piezas = 0
  for (const item of j.items || []) {
    const qty = Number(item.quantity)
    piezas += qty
    const qtyStr = Number.isInteger(qty) ? String(qty) : String(+qty.toFixed(3))
    const amt = money(item.subtotal)
    const nameWidth = LINE_WIDTH - 5 - amt.length - 1
    const chunks = wrap(String(item.name), nameWidth)
    row(qtyStr.padEnd(5) + chunks[0], amt)
    for (let i = 1; i < chunks.length; i++) line('     ' + chunks[i])
    if (qty !== 1) line('     ' + money(item.price) + ' c/u')
  }
  sep()

  // ── Totales ──
  line('Articulos: ' + (Number.isInteger(piezas) ? piezas : +piezas.toFixed(3)))
  row('Subtotal', money(j.subtotal))
  if (Number(j.discountAmount) > 0) row('Descuento', '-' + money(j.discountAmount))
  line('='.repeat(LINE_WIDTH))
  bold(true); tall()
  row('TOTAL', money(j.total))
  normal(); bold(false)
  line('='.repeat(LINE_WIDTH))
  if (Number(j.received) > 0) row('Efectivo recibido', money(j.received))
  if (Number(j.change) > 0) { bold(true); row('Su cambio', money(j.change)); bold(false) }

  // ── Pie ──
  feed(1)
  center()
  bold(true)
  line('* !Gracias por su compra! *')
  bold(false)
  line('Te esperamos pronto')
  feed(1)
  bold(true)
  line('NO SE ACEPTAN DEVOLUCIONES')
  bold(false)
  feed(1)
  line('- Ticket de AutoBusiness AI -')
  feed(4)
  raw(29, 86, 66, 0) // corte parcial (ignorado si no hay cortador)

  return new Uint8Array(bytes)
}
