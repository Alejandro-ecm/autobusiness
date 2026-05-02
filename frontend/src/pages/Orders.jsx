import { useState, useEffect } from 'react'
import { orders as ordersApi } from '../api'
import { useToast } from '../store/ToastContext'
import './Orders.css'

const statusLabel = {
  pending: { label: 'Pendiente', cls: 'badge-yellow' },
  confirmed: { label: 'Confirmado', cls: 'badge-blue' },
  shipped: { label: 'Enviado', cls: 'badge-blue' },
  delivered: { label: 'Entregado', cls: 'badge-green' },
  cancelled: { label: 'Cancelado', cls: 'badge-red' },
}

const fmt = (n) => `$${Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`
const fmtDate = (d) => new Date(d).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

export default function Orders() {
  const { show } = useToast()
  const [orderList, setOrderList] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('all')
  const [search, setSearch] = useState('')

  const load = () => ordersApi.list().then(setOrderList).finally(() => setLoading(false))
  useEffect(() => { load() }, [])

  const changeStatus = async (id, status) => {
    try {
      await ordersApi.updateStatus(id, status)
      show('Estado actualizado', 'success')
      load()
    } catch (err) {
      show(err?.error || 'Error', 'error')
    }
  }

  if (loading) return <div className="page-loading"><div className="spinner" style={{ width: 32, height: 32 }} /></div>

  const filtered = orderList.filter(o => {
    const matchStatus = filterStatus === 'all' || o.status === filterStatus
    const q = search.toLowerCase()
    const matchSearch = !q ||
      (o.customerName || '').toLowerCase().includes(q) ||
      (o.customerPhone || '').toLowerCase().includes(q) ||
      (o.orderNumber || '').toLowerCase().includes(q)
    return matchStatus && matchSearch
  })

  const pending = filtered.filter(o => o.status === 'pending')
  const other = filtered.filter(o => o.status !== 'pending')

  return (
    <div className="orders-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Pedidos Online</h1>
          <p className="page-subtitle">{orderList.filter(o => o.status === 'pending').length} pendientes de atender</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          className="input"
          placeholder="Buscar cliente o teléfono..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ maxWidth: 260 }}
        />
        <div className="finance-tabs" style={{ flex: 'none' }}>
          {[['all', 'Todos'], ['pending', 'Pendiente'], ['confirmed', 'Confirmado'], ['shipped', 'Enviado'], ['delivered', 'Entregado'], ['cancelled', 'Cancelado']].map(([val, label]) => (
            <button key={val} className={`tab-btn ${filterStatus === val ? 'active' : ''}`}
              onClick={() => setFilterStatus(val)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {pending.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h3 className="section-title" style={{ marginBottom: 12 }}>Requieren atención</h3>
          <div className="orders-grid">
            {pending.map(o => <OrderCard key={o.id} order={o} onStatus={changeStatus} />)}
          </div>
        </div>
      )}

      {other.length > 0 && (
        <div>
          <h3 className="section-title" style={{ marginBottom: 12 }}>Historial</h3>
          <div className="card" style={{ padding: 0 }}>
            <table className="orders-table">
              <thead>
                <tr>
                  <th>Orden</th>
                  <th>Cliente</th>
                  <th>Total</th>
                  <th>Estado</th>
                  <th>Fecha</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {other.map(o => {
                  const st = statusLabel[o.status] || { label: o.status, cls: 'badge-gray' }
                  return (
                    <tr key={o.id}>
                      <td className="font-semibold">{o.orderNumber}</td>
                      <td>{o.customerName || 'Anónimo'}</td>
                      <td className="font-semibold">{fmt(o.total)}</td>
                      <td><span className={`badge ${st.cls}`}>{st.label}</span></td>
                      <td className="text-soft text-sm">{fmtDate(o.createdAt)}</td>
                      <td>
                        <select className="input" style={{ padding: '4px 8px', fontSize: 12 }}
                          value={o.status}
                          onChange={e => changeStatus(o.id, e.target.value)}>
                          {Object.entries(statusLabel).map(([v, { label }]) => (
                            <option key={v} value={v}>{label}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {orderList.length === 0 && (
        <div className="card empty-state" style={{ textAlign: 'center', padding: 48 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
          <p className="font-semibold">Sin pedidos todavía</p>
          <p className="text-soft">Los pedidos de tu tienda online aparecerán aquí</p>
        </div>
      )}
    </div>
  )
}

function OrderCard({ order, onStatus }) {
  return (
    <div className="order-card card">
      <div className="order-card-header">
        <span className="font-semibold">{order.orderNumber}</span>
        <span className="badge badge-yellow">Pendiente</span>
      </div>
      <div className="order-customer">
        <div className="font-semibold">{order.customerName || 'Cliente'}</div>
        {order.customerPhone && <div className="text-soft text-sm">📱 {order.customerPhone}</div>}
        {order.customerEmail && <div className="text-soft text-sm">✉️ {order.customerEmail}</div>}
      </div>
      <div className="order-items-preview">
        {order.items?.map(i => (
          <div key={i.id} className="order-item-preview">
            <span>{i.product?.name} x{i.quantity}</span>
            <span>${Number(i.subtotal).toFixed(2)}</span>
          </div>
        ))}
      </div>
      <div className="order-card-footer">
        <span className="order-total">${Number(order.total).toFixed(2)}</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn-sm btn-success" onClick={() => onStatus(order.id, 'confirmed')}>Confirmar</button>
          <button className="btn btn-sm btn-outline" onClick={() => onStatus(order.id, 'cancelled')}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}
