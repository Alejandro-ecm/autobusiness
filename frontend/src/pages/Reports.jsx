import { useState, useEffect } from 'react'
import { reports as api } from '../api'
import { useToast } from '../store/ToastContext'
import './Reports.css'

const fmt    = (n) => `$${Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`
const fmtDay = (s) => new Date(s).toLocaleDateString('es-MX', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })

const RANGES = [
  { label: 'Hoy',         days: 0 },
  { label: 'Esta semana', days: 7 },
  { label: 'Este mes',    days: 30 },
  { label: '3 meses',     days: 90 },
  { label: 'Año',         days: 365 },
]

const PAY_ICONS = { cash:'💵', card:'💳', transfer:'🏦', mp:'💙' }

export default function Reports() {
  const { show }   = useToast()
  const [range,    setRange]    = useState(30)
  const [data,     setData]     = useState(null)
  const [loading,  setLoading]  = useState(false)
  const [expanded, setExpanded] = useState(null)

  const load = async (days) => {
    setLoading(true)
    const now  = Date.now()
    const from = days === 0 ? new Date().setHours(0,0,0,0) : now - days * 86400000
    try {
      const res = await api.sales(from, now)
      setData(res)
    } catch { show('Error al cargar reporte', 'error') }
    finally { setLoading(false) }
  }

  useEffect(() => { load(range) }, [range])

  const exportCsv = () => {
    if (!data) return
    const rows = ['Fecha,Método,Total,Cajero,Productos']
    data.sales.forEach(s => {
      const items = s.items.map(i => `${i.name}x${i.qty}`).join(';')
      rows.push(`"${fmtDay(s.date)}","${s.paymentMethod}",${s.total},"${s.cashier}","${items}"`)
    })
    const a = document.createElement('a')
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(rows.join('\n'))
    a.download = `ventas_${new Date().toISOString().slice(0,10)}.csv`
    a.click()
  }

  const printReport = () => {
    if (!data) return
    const rows = data.sales.map(s => `
      <tr>
        <td>${fmtDay(s.date)}</td>
        <td>${PAY_ICONS[s.paymentMethod] || ''} ${s.paymentMethod}</td>
        <td>${s.cashier}</td>
        <td>${s.items.map(i => `${i.name} ×${i.qty}`).join(', ')}</td>
        <td style="text-align:right;font-weight:bold">${fmt(s.total)}</td>
      </tr>`).join('')
    const w = window.open('', '_blank')
    w.document.write(`<!DOCTYPE html><html><head><title>Reporte de Ventas</title>
    <style>body{font-family:Arial;padding:20px}h2{color:#6366f1}
    table{width:100%;border-collapse:collapse;margin-top:16px}
    th{background:#f1f5f9;padding:8px 10px;font-size:12px;text-align:left}
    td{padding:7px 10px;border-bottom:1px solid #f1f5f9;font-size:12px}
    .total-row{font-weight:bold;font-size:14px;color:#6366f1}
    </style></head><body>
    <h2>Reporte de Ventas — ${RANGES.find(r=>r.days===range)?.label}</h2>
    <p style="color:#64748b">${data.count} ventas · Total: ${fmt(data.sales.reduce((s,v)=>s+Number(v.total),0))}</p>
    <table><thead><tr><th>Fecha</th><th>Pago</th><th>Cajero</th><th>Productos</th><th>Total</th></tr></thead>
    <tbody>${rows}</tbody></table>
    <script>window.onload=()=>{window.print()}<\/script>
    </body></html>`)
    w.document.close()
  }

  const totalRevenue   = data?.sales.reduce((s, v) => s + Number(v.total), 0) || 0
  const avgTicket      = data?.count > 0 ? totalRevenue / data.count : 0
  const byMethod       = data?.sales.reduce((acc, s) => {
    acc[s.paymentMethod] = (acc[s.paymentMethod] || 0) + Number(s.total); return acc
  }, {}) || {}

  return (
    <div className="reports-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Reportes de Ventas</h1>
          <p className="page-subtitle">{data ? `${data.count} ventas encontradas` : 'Selecciona un período'}</p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn btn-outline" onClick={exportCsv} disabled={!data?.count}>⬇ CSV</button>
          <button className="btn btn-outline" onClick={printReport} disabled={!data?.count}>🖨️ Imprimir</button>
        </div>
      </div>

      {/* Range selector */}
      <div className="reports-range">
        {RANGES.map(r => (
          <button key={r.days}
            className={`reports-range-btn${range === r.days ? ' active' : ''}`}
            onClick={() => setRange(r.days)}>
            {r.label}
          </button>
        ))}
      </div>

      {loading && <div className="page-loading"><div className="spinner" /></div>}

      {!loading && data && (
        <>
          {/* KPI cards */}
          <div className="reports-kpis">
            <div className="reports-kpi">
              <span className="reports-kpi-val" style={{ color:'#6366f1' }}>{fmt(totalRevenue)}</span>
              <span className="reports-kpi-lbl">Total ingresos</span>
            </div>
            <div className="reports-kpi">
              <span className="reports-kpi-val">{data.count}</span>
              <span className="reports-kpi-lbl">Ventas</span>
            </div>
            <div className="reports-kpi">
              <span className="reports-kpi-val">{fmt(avgTicket)}</span>
              <span className="reports-kpi-lbl">Ticket promedio</span>
            </div>
            {Object.entries(byMethod).map(([method, total]) => (
              <div key={method} className="reports-kpi">
                <span className="reports-kpi-val">{fmt(total)}</span>
                <span className="reports-kpi-lbl">{PAY_ICONS[method] || ''} {method}</span>
              </div>
            ))}
          </div>

          {/* Sales table */}
          {data.sales.length === 0 ? (
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
                    <th>Productos</th>
                    <th style={{ textAlign:'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.sales.map(s => (
                    <>
                      <tr key={s.id} className="reports-sale-row"
                        onClick={() => setExpanded(expanded === s.id ? null : s.id)}
                        style={{ cursor:'pointer' }}>
                        <td className="text-soft text-sm">{fmtDay(s.date)}</td>
                        <td><span className="badge badge-blue">{PAY_ICONS[s.paymentMethod]} {s.paymentMethod}</span></td>
                        <td className="text-soft">{s.cashier}</td>
                        <td className="text-soft text-sm">{s.items.length} artículo{s.items.length !== 1 ? 's' : ''} {expanded === s.id ? '▲' : '▼'}</td>
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
