import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { reports as reportsApi } from '../../api'
import { qtyLabel } from '../../lib/ticketReprint'
import { periodRange, PERIOD_LABELS } from '../../lib/categoryPeriods'
import './CategoryDetailModal.css'

const fmt = (n) => `$${Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const EPS = 0.005 // tolerancia de centavos por redondeo acumulado

// Reconstruye el desglose por producto de una categoría a partir de
// GET /reports/sales (ventas + items, sin categoryId por ítem) cruzado con
// el inventario (que sí tiene categoryId por producto). Los ítems "libres"
// de la Caja con categoría elegida a mano no son identificables en
// /reports/sales, así que la diferencia contra el total real de la tarjeta
// se muestra como una fila "Otros" — así la suma siempre cuadra exacto.
function buildBreakdown(sales, products, categoryId, cardRevenue, cardProfit) {
  const nameToCategoryId = new Map(products.map(p => [p.name, p.categoryId || null]))
  const byName = new Map()

  for (const sale of sales || []) {
    for (const item of sale.items || []) {
      // Un nombre que no está en el inventario es un "producto libre" sin
      // categoría identificable — nunca debe contar como match directo (ni
      // siquiera contra "Sin categoría"), o se cuela en la fila equivocada.
      // Su importe solo aparece vía la reconciliación "Otros" de su categoría real.
      if (!nameToCategoryId.has(item.name)) continue
      if ((nameToCategoryId.get(item.name) || null) !== (categoryId || null)) continue
      const qty = Number(item.qty)
      const revenue = Number(item.subtotal)
      const profit = (Number(item.price) - Number(item.cost || 0)) * qty
      const row = byName.get(item.name) || { name: item.name, qty: 0, revenue: 0, profit: 0 }
      row.qty += qty
      row.revenue += revenue
      row.profit += profit
      byName.set(item.name, row)
    }
  }

  const rows = [...byName.values()]
  const matchedRevenue = rows.reduce((s, r) => s + r.revenue, 0)
  const matchedProfit = rows.reduce((s, r) => s + r.profit, 0)
  const otrosRevenue = Number(cardRevenue || 0) - matchedRevenue
  const otrosProfit = Number(cardProfit || 0) - matchedProfit

  if (Math.abs(otrosRevenue) > EPS || Math.abs(otrosProfit) > EPS) {
    rows.push({ name: 'Otros / sin desglose', qty: null, revenue: otrosRevenue, profit: otrosProfit })
  }

  rows.sort((a, b) => b.revenue - a.revenue)
  return rows
}

export default function CategoryDetailModal({ category, periodKey, cardRevenue, cardProfit, products, onClose }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [rows, setRows] = useState([])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(false)
    const { from, to } = periodRange(periodKey)
    reportsApi.sales(from, to)
      .then(res => {
        if (cancelled) return
        setRows(buildBreakdown(res?.sales, products, category.categoryId, cardRevenue, cardProfit))
      })
      .catch(() => { if (!cancelled) setError(true) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [category.categoryId, periodKey])

  return createPortal(
    <div className="catdet-overlay" onClick={onClose}>
      <div className="catdet-box" onClick={e => e.stopPropagation()}>
        <div className="catdet-header">
          <div className="catdet-header-info">
            <span className="catdet-dot" style={{ background: category.color }} />
            <div>
              <h3>{category.name}</h3>
              <span className="catdet-period">{PERIOD_LABELS[periodKey] || periodKey}</span>
            </div>
          </div>
          <button className="catdet-close" onClick={onClose} aria-label="Cerrar">×</button>
        </div>

        <div className="catdet-body">
          {loading && (
            <div className="catdet-loading"><div className="spinner" /></div>
          )}
          {!loading && error && (
            <p className="catdet-empty">No se pudo cargar el detalle. Intenta de nuevo.</p>
          )}
          {!loading && !error && rows.length === 0 && (
            <p className="catdet-empty">Sin ventas en esta categoría</p>
          )}
          {!loading && !error && rows.length > 0 && (
            <table className="catdet-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Cantidad</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                  <th style={{ textAlign: 'right' }}>Ganancia</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className={r.qty == null ? 'catdet-row-otros' : ''}>
                    <td>{r.name}</td>
                    <td>{r.qty == null ? '—' : qtyLabel(r.qty)}</td>
                    <td style={{ textAlign: 'right' }}>{fmt(r.revenue)}</td>
                    <td style={{ textAlign: 'right', color: r.profit >= 0 ? '#15803d' : '#dc2626' }}>{fmt(r.profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
