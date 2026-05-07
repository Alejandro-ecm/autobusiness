import { useState, useEffect, useMemo } from 'react'
import { reports as api } from '../api'
import { useToast } from '../store/ToastContext'
import './Reports.css'

const fmt    = (n) => `$${Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`
const fmtDay = (s) => new Date(s).toLocaleDateString('es-MX', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })

const PAY_ICONS = { cash:'💵', card:'💳', transfer:'🏦', mp:'💙' }
const PAY_LABEL = { cash:'Efectivo', card:'Tarjeta', transfer:'Transferencia', mp:'MercadoPago' }

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
  const [data,     setData]     = useState(null)
  const [loading,  setLoading]  = useState(false)
  const [expanded, setExpanded] = useState(null)
  const [activeRange, setActiveRange] = useState(30)
  const [customFrom,  setCustomFrom]  = useState('')
  const [customTo,    setCustomTo]    = useState('')
  const [useCustom,   setUseCustom]   = useState(false)
  const [filterCashier, setFilterCashier] = useState('todos')

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
    <p style="color:#64748b">${filteredSales.length} ventas · Total: ${fmt(totalRevenue)}</p>
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
                          <td colSpan={2} style={{ paddingLeft:32, color:'#64748b', fontSize:12 }}>{item.name}</td>
                          <td style={{ color:'#94a3b8', fontSize:12 }}>×{item.qty}</td>
                          <td style={{ color:'#94a3b8', fontSize:12 }}>{fmt(item.price)} c/u</td>
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
    </div>
  )
}
