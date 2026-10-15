// Reimpresión de tickets de venta — compartido entre Reportes y Caja.
// Fuente de datos: GET /reports/sales (solo OWNER/ADMIN). Ese endpoint no expone
// saleMode/baseUnit por ítem, así que qtyLabel() aproxima "vendido por peso"
// cuando la cantidad no es un entero.

export const fmt    = (n) => `$${Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`
export const fmtDay = (s) => new Date(s).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

export const PAY_ICONS = { cash: '💵', card: '💳', transfer: '🏦', mp: '💙' }
export const PAY_LABEL = { cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transferencia', mp: 'MercadoPago' }

// Folio corto derivado del id de la venta — mismo criterio que el ticket del POS
export const folioOf = (id) => id ? String(id).replace(/-/g, '').slice(0, 8).toUpperCase() : '—'

const escHtml = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function qtyLabel(qty) {
  const n = Number(qty)
  return n % 1 !== 0 ? `${n.toFixed(3)} kg` : String(n)
}

export function filterTickets(sales, query) {
  const q = (query || '').trim().toLowerCase()
  if (!sales) return []
  if (!q) return sales
  return sales.filter(s =>
    folioOf(s.id).toLowerCase().includes(q) ||
    (s.cashier || '').toLowerCase().includes(q) ||
    fmtDay(s.date).toLowerCase().includes(q) ||
    String(s.total).includes(q)
  )
}

// HTML de reimpresión de un ticket individual — visualmente consistente con el
// ticket térmico del POS, pero adaptado a los campos que regresa /reports/sales
// (sin descuento/cambio, que ese endpoint no expone).
export function buildTicketHtml(sale, businessName) {
  const folio = folioOf(sale.id)
  const fecha = new Date(sale.date).toLocaleString('es-MX', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
  const reimpresoEn = new Date().toLocaleString('es-MX', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
  const subtotal = sale.items.reduce((s, i) => s + Number(i.subtotal), 0)
  const piezas   = sale.items.reduce((s, i) => s + Number(i.qty), 0)

  const rows = sale.items.map(i => `
    <tr>
      <td class="qty">${qtyLabel(i.qty)}</td>
      <td>${escHtml(i.name)}${(Number(i.qty) > 1 || Number(i.qty) % 1 !== 0) ? `<div class="unit">${fmt(i.price)} c/u</div>` : ''}</td>
      <td class="amt">${fmt(i.subtotal)}</td>
    </tr>`).join('')

  return `<!DOCTYPE html><html><head><title>Ticket ${folio}</title><meta charset="utf-8"><style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Courier New', ui-monospace, monospace; font-size: 12px; color: #000;
           width: 300px; margin: 0 auto; padding: 16px 12px; background: #fff; }
    .center { text-align: center; }
    .biz { font-size: 17px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; }
    .reprint { display: inline-block; margin-top: 6px; padding: 2px 10px; font-size: 10px;
               font-weight: 700; letter-spacing: .5px; border: 1px solid #000; border-radius: 20px; }
    .reprint-time { font-size: 9.5px; color: #444; margin-top: 4px; }
    .sep   { border-top: 1px dashed #000; margin: 9px 0; }
    .meta { font-size: 11px; line-height: 1.7; }
    .meta-row { display: flex; justify-content: space-between; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    thead th { font-size: 10px; text-align: left; letter-spacing: .5px;
               border-bottom: 1px solid #000; padding: 3px 0; }
    th.amt, td.amt { text-align: right; white-space: nowrap; }
    td { padding: 4px 0; vertical-align: top; }
    td.qty { width: 44px; font-weight: 700; }
    .unit { font-size: 10px; color: #444; }
    .tot-row { display: flex; justify-content: space-between; font-size: 12px; padding: 2px 0; }
    .grand { font-size: 17px; font-weight: 800; border-top: 2px solid #000;
             border-bottom: 2px solid #000; padding: 7px 0; margin: 7px 0; }
    .foot { font-size: 10.5px; color: #111; margin-top: 12px; line-height: 1.8; }
    .foot .thanks { font-size: 12px; font-weight: 700; }
    @media print { body { width: auto; } }
  </style></head><body>
    <div class="center">
      <div class="biz">${escHtml(businessName) || 'AutoBusiness'}</div>
      <div class="reprint">*** REIMPRESIÓN ***</div>
      <div class="reprint-time">Reimpreso: ${reimpresoEn}</div>
    </div>
    <div class="sep"></div>
    <div class="meta">
      <div class="meta-row"><span>Folio: <b>${folio}</b></span><span>${fecha}</span></div>
      ${sale.cashier ? `<div>Le atendió: ${escHtml(sale.cashier)}</div>` : ''}
      <div>Forma de pago: ${PAY_LABEL[sale.paymentMethod] || sale.paymentMethod}</div>
    </div>
    <div class="sep"></div>
    <table>
      <thead><tr><th>CANT</th><th>DESCRIPCIÓN</th><th class="amt">IMPORTE</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="sep"></div>
    <div class="tot-row"><span>Artículos: ${piezas}</span><span></span></div>
    <div class="tot-row"><span>Subtotal</span><span>${fmt(subtotal)}</span></div>
    <div class="tot-row grand"><span>TOTAL</span><span>${fmt(sale.total)}</span></div>
    <div class="foot center">
      <div class="thanks">★ ¡Gracias por su compra! ★</div>
      <div>Te esperamos pronto</div>
      <div style="margin-top:6px;font-weight:700">NO SE ACEPTAN DEVOLUCIONES</div>
      <div style="margin-top:6px;color:#666">— Ticket generado por AutoBusiness AI —</div>
    </div>
    <script>window.onload=()=>{window.print()}<\/script>
  </body></html>`
}

export function printSaleTicket(sale, businessName, onPopupBlocked) {
  const w = window.open('', '_blank', 'width=380,height=600')
  if (!w) { onPopupBlocked?.(); return }
  w.document.write(buildTicketHtml(sale, businessName))
  w.document.close()
}
