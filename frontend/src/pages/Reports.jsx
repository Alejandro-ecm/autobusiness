import { useState, useEffect, useMemo } from 'react'
import { reports as api } from '../api'
import { useToast } from '../store/ToastContext'
import { useAuth } from '../store/AuthContext'
import './Reports.css'

const fmt    = (n) => `$${Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`
const fmtDay = (s) => new Date(s).toLocaleDateString('es-MX', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })

const PAY_ICONS = { cash:'💵', card:'💳', transfer:'🏦', mp:'💙' }
const PAY_LABEL = { cash:'Efectivo', card:'Tarjeta', transfer:'Transferencia', mp:'MercadoPago' }

// Folio corto derivado del id de la venta — mismo criterio que el ticket del POS
const folioOf = (id) => id ? String(id).replace(/-/g, '').slice(0, 8).toUpperCase() : '—'

const escHtml = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Mismo criterio que el ticket del POS: los productos por peso deben mostrar
// la unidad ("2.350 kg"), no un número pelón indistinguible de piezas.
const isWeightItem = (i) => i.saleMode === 'WEIGHT' || i.saleMode === 'MIXED'
const qtyLabel = (i) => isWeightItem(i)
  ? `${Number(i.qty).toFixed(3)} ${i.baseUnit || 'kg'}`
  : String(i.qty)

// HTML de reimpresión de un ticket individual — visualmente consistente con el
// ticket térmico del POS, pero adaptado a los campos que regresa /reports/sales
// (sin descuento/cambio, que ese endpoint no expone).
function buildTicketHtml(sale, businessName) {
  const folio = folioOf(sale.id)
  const fecha = new Date(sale.date).toLocaleString('es-MX', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
  const subtotal = sale.items.reduce((s, i) => s + Number(i.subtotal), 0)

  const rows = sale.items.map(i => `
    <tr>
      <td class="qty">${qtyLabel(i)}</td>
      <td>${escHtml(i.name)}${(isWeightItem(i) || i.qty > 1) ? `<div class="unit">${fmt(i.price)}${isWeightItem(i) ? ` / ${i.baseUnit || 'kg'}` : ' c/u'}</div>` : ''}</td>
      <td class="amt">${fmt(i.subtotal)}</td>
    </tr>`).join('')

  return `<!DOCTYPE html><html><head><title>Ticket ${folio}</title><meta charset="utf-8"><style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Courier New', ui-monospace, monospace; font-size: 12px; color: #1e293b;
           width: 320px; margin: 0 auto; padding: 14px; background: #f1f5f9; }
    .ticket { background: #fff; border-radius: 14px; padding: 20px 16px 16px;
              box-shadow: 0 8px 24px rgba(15,23,42,.12); }
    .center { text-align: center; }
    .biz-badge { width: 38px; height: 38px; border-radius: 10px; background: #6366f1;
                 color: #fff; display: flex; align-items: center; justify-content: center;
                 font-size: 18px; margin: 0 auto 8px; }
    .biz { font-size: 16px; font-weight: 800; letter-spacing: .5px; text-transform: uppercase; color: #0f172a; }
    .reprint { display: inline-block; margin-top: 8px; padding: 3px 12px; font-size: 10px;
               font-weight: 700; letter-spacing: .5px; background: #eef2ff; color: #6366f1;
               border-radius: 20px; }
    .sep { border-top: 1px dashed #cbd5e1; margin: 12px 0; }
    .meta { font-size: 11px; line-height: 1.8; color: #475569; }
    .meta-row { display: flex; justify-content: space-between; }
    .meta b { color: #0f172a; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    thead th { font-size: 10px; text-align: left; letter-spacing: .5px; color: #94a3b8;
               font-weight: 700; border-bottom: 1px solid #e2e8f0; padding: 4px 0; }
    th.amt, td.amt { text-align: right; white-space: nowrap; }
    td { padding: 6px 0; vertical-align: top; }
    td.qty { width: 56px; font-weight: 700; color: #6366f1; }
    .unit { font-size: 10px; color: #94a3b8; }
    .tot-row { display: flex; justify-content: space-between; font-size: 12px; padding: 3px 0; color: #475569; }
    .grand { background: #eef2ff; border-radius: 10px; padding: 12px 14px; margin: 10px 0;
             display: flex; justify-content: space-between; align-items: center; }
    .grand .lbl { font-size: 13px; font-weight: 700; color: #6366f1; }
    .grand .amt { font-size: 20px; font-weight: 800; color: #6366f1; }
    .foot { font-size: 10.5px; color: #64748b; margin-top: 14px; line-height: 1.8; }
    .foot .thanks { font-size: 13px; font-weight: 700; color: #0f172a; }
    .foot .noret { margin-top: 6px; font-weight: 700; color: #dc2626; }
    @media print { body { width: auto; background: #fff; padding: 0; } .ticket { box-shadow: none; border-radius: 0; } }
  </style></head><body>
    <div class="ticket">
    <div class="center">
      <div class="biz-badge">🧾</div>
      <div class="biz">${escHtml(businessName) || 'AutoBusiness'}</div>
      <div class="reprint">COPIA — REIMPRESIÓN</div>
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
    <div class="tot-row"><span>Artículos: ${sale.items.length}</span><span></span></div>
    <div class="tot-row"><span>Subtotal</span><span>${fmt(subtotal)}</span></div>
    <div class="grand"><span class="lbl">TOTAL</span><span class="amt">${fmt(sale.total)}</span></div>
    <div class="foot center">
      <div class="thanks">★ ¡Gracias por tu compra! ★</div>
      <div>Fue un gusto atenderte — ¡te esperamos pronto! 💜</div>
      <div class="noret">NO SE ACEPTAN DEVOLUCIONES</div>
      <div style="margin-top:6px;color:#94a3b8">— Ticket generado por AutoBusiness AI —</div>
    </div>
    </div>
    <script>window.onload=()=>{window.print()}<\/script>
  </body></html>`
}

const QUICK = [
  { label: 'Hoy',       days: 0 },
  { label: '7 días',    days: 7 },
  { label: '30 días',   days: 30 },
  { label: '3 meses',   days: 90 },
  { label: 'Año',       days: 365 },
]

function toDateStr(ms) {
  return new Date(ms).toISOString().slice(0, 10)
}

export default function Reports() {
  const { show } = useToast()
  const { user } = useAuth()
  const [data,     setData]     = useState(null)
  const [loading,  setLoading]  = useState(false)
  const [expanded, setExpanded] = useState(null)
  const [activeRange, setActiveRange] = useState(30)
  const [customFrom,  setCustomFrom]  = useState('')
  const [customTo,    setCustomTo]    = useState('')
  const [useCustom,   setUseCustom]   = useState(false)
  const [filterCashier, setFilterCashier] = useState('todos')
  const [showTickets, setShowTickets] = useState(false)
  const [ticketQuery, setTicketQuery] = useState('')
  const [previewSale, setPreviewSale] = useState(null)

  const load = async (days, from, to) => {
    setLoading(true)
    let fromMs, toMs
    const now = Date.now()
    if (from && to) {
      fromMs = new Date(from).setHours(0, 0, 0, 0)
      toMs   = new Date(to).setHours(23, 59, 59, 999)
    } else {
      toMs   = now
      fromMs = days === 0 ? new Date().setHours(0, 0, 0, 0) : now - days * 86400000
    }
    try {
      const res = await api.sales(fromMs, toMs)
      setData(res)
    } catch { show('Error al cargar reporte', 'error') }
    finally { setLoading(false) }
  }

  useEffect(() => {
    if (!useCustom) load(activeRange)
  }, [activeRange, useCustom])

  const handleCustomSearch = () => {
    if (!customFrom || !customTo) { show('Selecciona fechas de inicio y fin', 'error'); return }
    setUseCustom(true)
    load(0, customFrom, customTo)
  }

  const handleQuickRange = (days) => {
    setUseCustom(false)
    setActiveRange(days)
    setCustomFrom('')
    setCustomTo('')
  }

  // Cajeros únicos para filtro
  const cashiers = useMemo(() => {
    if (!data) return []
    const names = [...new Set(data.sales.map(s => s.cashier).filter(Boolean))]
    return names
  }, [data])

  const filteredSales = useMemo(() => {
    if (!data) return []
    if (filterCashier === 'todos') return data.sales
    return data.sales.filter(s => s.cashier === filterCashier)
  }, [data, filterCashier])

  const totalRevenue = filteredSales.reduce((s, v) => s + Number(v.total), 0)
  const avgTicket    = filteredSales.length > 0 ? totalRevenue / filteredSales.length : 0
  const byMethod     = filteredSales.reduce((acc, s) => {
    acc[s.paymentMethod] = (acc[s.paymentMethod] || 0) + Number(s.total)
    return acc
  }, {})
  const totalCost   = filteredSales.reduce((s, v) =>
    s + (v.items || []).reduce((a, i) => a + Number(i.qty) * Number(i.cost || 0), 0), 0)
  const totalProfit = totalRevenue - totalCost

  // Tickets anteriores: búsqueda libre sobre todas las ventas del período cargado
  const ticketResults = useMemo(() => {
    if (!data) return []
    const q = ticketQuery.trim().toLowerCase()
    if (!q) return data.sales
    return data.sales.filter(s =>
      folioOf(s.id).toLowerCase().includes(q) ||
      (s.cashier || '').toLowerCase().includes(q) ||
      fmtDay(s.date).toLowerCase().includes(q)
    )
  }, [data, ticketQuery])

  const closeTickets = () => { setShowTickets(false); setPreviewSale(null); setTicketQuery('') }

  const printSaleTicket = (sale) => {
    const w = window.open('', '_blank', 'width=380,height=600')
    if (!w) { show('El navegador bloqueó la ventana emergente. Permite popups para imprimir.', 'error'); return }
    w.document.write(buildTicketHtml(sale, user?.businessName))
    w.document.close()
  }

  const exportCsv = () => {
    if (!filteredSales.length) return
    const rows = ['Fecha,Método,Total,Cajero,Productos']
    filteredSales.forEach(s => {
      const items = s.items.map(i => `${i.name}x${i.qty}`).join(';')
      rows.push(`"${fmtDay(s.date)}","${s.paymentMethod}",${s.total},"${s.cashier}","${items}"`)
    })
    const a = document.createElement('a')
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(rows.join('\n'))
    a.download = `ventas_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
  }

  const printReport = () => {
    if (!filteredSales.length) return
    const rows = filteredSales.map(s => `
      <tr>
        <td>${fmtDay(s.date)}</td>
        <td>${PAY_LABEL[s.paymentMethod] || s.paymentMethod}</td>
        <td>${s.cashier}</td>
        <td>${s.items.map(i => `${i.name} ×${i.qty}`).join(', ')}</td>
        <td style="text-align:right;font-weight:bold">${fmt(s.total)}</td>
      </tr>`).join('')
    const w = window.open('', '_blank')
    w.document.write(`<!DOCTYPE html><html><head><title>Reporte</title>
    <style>body{font-family:Arial;padding:20px}h2{color:#6366f1}
    table{width:100%;border-collapse:collapse;margin-top:16px}
    th{background:#f1f5f9;padding:8px 10px;font-size:12px;text-align:left}
    td{padding:7px 10px;border-bottom:1px solid #f1f5f9;font-size:12px}
    </style></head><body>
    <h2>Reporte de Ventas</h2>
    <p style="color:#1e293b">${filteredSales.length} ventas · Total: ${fmt(totalRevenue)}</p>
    <table><thead><tr><th>Fecha</th><th>Pago</th><th>Cajero</th><th>Productos</th><th>Total</th></tr></thead>
    <tbody>${rows}</tbody></table>
    <script>window.onload=()=>{window.print()}<\/script>
    </body></html>`)
    w.document.close()
  }

  return (
    <div className="reports-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Reportes de Ventas</h1>
          <p className="page-subtitle">{data ? `${filteredSales.length} ventas encontradas` : 'Selecciona un período'}</p>
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <button className="btn btn-outline" onClick={exportCsv} disabled={!filteredSales.length}>⬇ CSV</button>
          <button className="btn btn-outline" onClick={printReport} disabled={!filteredSales.length}>🖨️ Imprimir</button>
          <button className="btn btn-outline" onClick={() => setShowTickets(true)} disabled={!data?.sales?.length}>🎫 Tickets anteriores</button>
        </div>
      </div>

      {/* Filtros */}
      <div className="reports-filters">
        {/* Rangos rápidos */}
        <div className="reports-range">
          {QUICK.map(r => (
            <button
              key={r.days}
              className={`reports-range-btn${!useCustom && activeRange === r.days ? ' active' : ''}`}
              onClick={() => handleQuickRange(r.days)}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* Date picker personalizado */}
        <div className="reports-custom">
          <input
            type="date"
            className="reports-date-input"
            value={customFrom}
            max={customTo || toDateStr(Date.now())}
            onChange={e => setCustomFrom(e.target.value)}
          />
          <span className="reports-date-sep">→</span>
          <input
            type="date"
            className="reports-date-input"
            value={customTo}
            min={customFrom}
            max={toDateStr(Date.now())}
            onChange={e => setCustomTo(e.target.value)}
          />
          <button className="btn btn-primary btn-sm" onClick={handleCustomSearch}>Buscar</button>
        </div>

        {/* Filtro cajero */}
        {cashiers.length > 1 && (
          <select
            className="reports-cashier-filter"
            value={filterCashier}
            onChange={e => setFilterCashier(e.target.value)}
          >
            <option value="todos">Todos los cajeros</option>
            {cashiers.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
      </div>

      {loading && <div className="page-loading"><div className="spinner" /></div>}

      {!loading && data && (
        <>
          {/* KPI cards */}
          <div className="reports-kpis">
            <div className="reports-kpi">
              <span className="reports-kpi-val" style={{ color:'#6366f1' }}>{fmt(totalRevenue)}</span>
              <span className="reports-kpi-lbl">Ingresos</span>
            </div>
            <div className="reports-kpi">
              <span className="reports-kpi-val">{filteredSales.length}</span>
              <span className="reports-kpi-lbl">Ventas</span>
            </div>
            <div className="reports-kpi">
              <span className="reports-kpi-val">{fmt(avgTicket)}</span>
              <span className="reports-kpi-lbl">Ticket promedio</span>
            </div>
            {totalCost > 0 && (
              <div className="reports-kpi">
                <span className="reports-kpi-val" style={{ color: totalProfit >= 0 ? '#059669' : '#ef4444' }}>
                  {fmt(totalProfit)}
                </span>
                <span className="reports-kpi-lbl">Utilidad estimada</span>
              </div>
            )}
            {Object.entries(byMethod).map(([method, tot]) => (
              <div key={method} className="reports-kpi">
                <span className="reports-kpi-val">{fmt(tot)}</span>
                <span className="reports-kpi-lbl">{PAY_ICONS[method]} {PAY_LABEL[method] || method}</span>
              </div>
            ))}
          </div>

          {filteredSales.length === 0 ? (
            <div className="empty-state card" style={{ padding: 40, textAlign:'center' }}>
              <p className="text-soft">Sin ventas en este período</p>
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table className="inv-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Método</th>
                    <th>Cajero</th>
                    <th>Artículos</th>
                    <th style={{ textAlign:'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSales.map(s => (
                    <>
                      <tr
                        key={s.id}
                        className="reports-sale-row"
                        onClick={() => setExpanded(expanded === s.id ? null : s.id)}
                        style={{ cursor:'pointer' }}
                      >
                        <td className="text-soft text-sm">{fmtDay(s.date)}</td>
                        <td><span className="badge badge-blue">{PAY_ICONS[s.paymentMethod]} {PAY_LABEL[s.paymentMethod] || s.paymentMethod}</span></td>
                        <td className="text-soft">{s.cashier || '—'}</td>
                        <td className="text-soft text-sm">
                          {s.items.length} ítem{s.items.length !== 1 ? 's' : ''} {expanded === s.id ? '▲' : '▼'}
                        </td>
                        <td style={{ textAlign:'right', fontWeight:700, color:'#6366f1' }}>{fmt(s.total)}</td>
                      </tr>
                      {expanded === s.id && s.items.map((item, i) => (
                        <tr key={i} className="reports-item-row">
                          <td colSpan={2} style={{ paddingLeft:32, color:'#1e293b', fontSize:12 }}>{item.name}</td>
                          <td style={{ color:'#1e293b', fontSize:12 }}>×{item.qty}</td>
                          <td style={{ color:'#1e293b', fontSize:12 }}>{fmt(item.price)} c/u</td>
                          <td style={{ textAlign:'right', fontSize:12, color:'#334155' }}>{fmt(item.subtotal)}</td>
                        </tr>
                      ))}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {showTickets && (
        <div className="modal-overlay" onClick={closeTickets}>
          <div className="modal-box card reports-ticket-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>🎫 Tickets anteriores</h3>
              <button className="modal-close" onClick={closeTickets}>×</button>
            </div>

            {!previewSale ? (
              <>
                <p className="reports-ticket-hint">
                  Busca un ticket del período seleccionado y reimprímelo en PDF.
                </p>
                <input
                  type="text"
                  className="reports-ticket-search"
                  placeholder="Buscar por folio, cajero o fecha…"
                  value={ticketQuery}
                  onChange={e => setTicketQuery(e.target.value)}
                  autoFocus
                />
                <div className="reports-ticket-list">
                  {ticketResults.length === 0 ? (
                    <p className="text-soft" style={{ padding: '24px 0', textAlign: 'center' }}>
                      No se encontraron tickets.
                    </p>
                  ) : ticketResults.map(s => (
                    <div key={s.id} className="reports-ticket-row">
                      <div className="reports-ticket-row-info">
                        <span className="reports-ticket-folio">#{folioOf(s.id)}</span>
                        <span className="text-soft text-sm">{fmtDay(s.date)} · {s.cashier || '—'}</span>
                      </div>
                      <div className="reports-ticket-row-total">{fmt(s.total)}</div>
                      <button className="btn btn-outline btn-sm" onClick={() => setPreviewSale(s)}>🖨️ Reimprimir</button>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="reports-ticket-preview-header">
                  <button className="btn btn-outline btn-sm" onClick={() => setPreviewSale(null)}>‹ Volver</button>
                  <span className="text-soft text-sm">Folio #{folioOf(previewSale.id)}</span>
                </div>
                <div className="reports-ticket-preview">
                  <iframe title="Vista previa del ticket" srcDoc={buildTicketHtml(previewSale, user?.businessName)} />
                </div>
                <div className="modal-footer">
                  <button className="btn btn-primary" onClick={() => printSaleTicket(previewSale)}>🖨️ Imprimir / Guardar PDF</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
