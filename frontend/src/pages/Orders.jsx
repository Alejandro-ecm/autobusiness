import { useState, useEffect } from 'react'
import { orders as ordersApi } from '../api'
import { useToast } from '../store/ToastContext'
import './Orders.css'

const statusLabel = {
  pending:   { label: 'Pendiente',   cls: 'badge-yellow' },
  confirmed: { label: 'Confirmado',  cls: 'badge-blue'   },
  preparing: { label: 'Preparando',  cls: 'badge-blue'   },
  ready:     { label: 'Listo',       cls: 'badge-blue'   },
  delivered: { label: 'Entregado',   cls: 'badge-green'  },
  cancelled: { label: 'Cancelado',   cls: 'badge-red'    },
}

const STATUS_TRANSITIONS = ['pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled']

const fmt    = (n) => `$${Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`
const fmtDate = (d) => new Date(d).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

export default function Orders() {
  const { show } = useToast()
  const [orderList, setOrderList] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)

  const load = () => ordersApi.list().then(setOrderList).finally(() => setLoading(false))
  useEffect(() => { load() }, [])

  const changeStatus = async (id, status) => {
    try {
      await ordersApi.updateStatus(id, status)
      show('Estado actualizado', 'success')
      load()
      if (selected?.id === id) setSelected(s => ({ ...s, status }))
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
      (o.orderNumber || '').toLowerCase().includes(q) ||
      (o.deliveryAddress || '').toLowerCase().includes(q)
    return matchStatus && matchSearch
  })

  const pending = filtered.filter(o => o.status === 'pending')
  const other   = filtered.filter(o => o.status !== 'pending')

  return (
    <div className="orders-page">
      {/* Detail modal */}
      {selected && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 300,
          background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16
        }} onClick={() => setSelected(null)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: '#fff', borderRadius: 16, padding: 24, maxWidth: 520, width: '100%',
            maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.3)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 17 }}>{selected.orderNumber}</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>{fmtDate(selected.createdAt)}</div>
              </div>
              <button onClick={() => setSelected(null)}
                style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#94a3b8' }}>×</button>
            </div>

            {/* Cliente info */}
            <div style={{ background: '#f8fafc', borderRadius: 12, padding: 16, marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#374151', marginBottom: 10 }}>DATOS DEL CLIENTE</div>
              <div style={{ display: 'grid', gap: 8 }}>
                <InfoRow icon="👤" label="Nombre"   value={selected.customerName || '—'} />
                <InfoRow icon="📱" label="Teléfono" value={selected.customerPhone}
                  link={selected.customerPhone ? `https://wa.me/${selected.customerPhone.replace(/\D/g,'')}` : null}
                  linkLabel="WhatsApp" />
                <InfoRow icon="✉️" label="Correo"   value={selected.customerEmail}
                  link={selected.customerEmail ? `mailto:${selected.customerEmail}` : null}
                  linkLabel="Enviar" />
                <InfoRow icon="📍" label="Dirección" value={selected.deliveryAddress} />
                {selected.mapsUrl && (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 16, marginTop: 1 }}>🗺️</span>
                    <div>
                      <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>UBICACIÓN</div>
                      <a href={selected.mapsUrl} target="_blank" rel="noreferrer"
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 2,
                          background: '#4285f4', color: '#fff', borderRadius: 8,
                          padding: '6px 14px', fontSize: 13, fontWeight: 600, textDecoration: 'none'
                        }}>
                        📍 Ver en Google Maps
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Productos */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#374151', marginBottom: 8 }}>PRODUCTOS</div>
              {selected.items?.map(i => (
                <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ fontSize: 14 }}>{i.product?.name} <span style={{ color: '#94a3b8' }}>×{i.quantity}</span></span>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{fmt(i.subtotal)}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontWeight: 700, fontSize: 16 }}>
                <span>Total</span>
                <span style={{ color: '#6366f1' }}>{fmt(selected.total)}</span>
              </div>
            </div>

            {/* Cambiar estado */}
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#374151', marginBottom: 8 }}>ESTADO DEL PEDIDO</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {STATUS_TRANSITIONS.filter(s => s !== selected.status).map(s => {
                  const info = statusLabel[s] || { label: s }
                  return (
                    <button key={s}
                      onClick={() => changeStatus(selected.id, s)}
                      className="btn btn-sm btn-outline"
                      style={{ fontSize: 12 }}>
                      → {info.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="page-header">
        <div>
          <h1 className="page-title">Pedidos Online</h1>
          <p className="page-subtitle">{orderList.filter(o => o.status === 'pending').length} pendientes de atender</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
        <input
          className="input"
          placeholder="Buscar cliente, teléfono o dirección..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ maxWidth: 280 }}
        />
        <div className="finance-tabs" style={{ flex: 'none' }}>
          {[['all','Todos'],['pending','Pendiente'],['confirmed','Confirmado'],['preparing','Preparando'],['ready','Listo'],['delivered','Entregado'],['cancelled','Cancelado']].map(([val, label]) => (
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
            {pending.map(o => <OrderCard key={o.id} order={o} onStatus={changeStatus} onDetail={() => setSelected(o)} />)}
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
                  <th>Teléfono</th>
                  <th>Dirección</th>
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
                    <tr key={o.id} style={{ cursor: 'pointer' }} onClick={() => setSelected(o)}>
                      <td className="font-semibold">{o.orderNumber}</td>
                      <td>{o.customerName || 'Anónimo'}</td>
                      <td className="text-soft text-sm">
                        {o.customerPhone
                          ? <a href={`https://wa.me/${o.customerPhone.replace(/\D/g,'')}`}
                              target="_blank" rel="noreferrer"
                              onClick={e => e.stopPropagation()}
                              style={{ color: '#25d366', fontWeight: 600, textDecoration: 'none' }}>
                              📱 {o.customerPhone}
                            </a>
                          : '—'}
                      </td>
                      <td className="text-soft text-sm" style={{ maxWidth: 180 }}>
                        {o.deliveryAddress
                          ? <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 150 }}>
                                {o.deliveryAddress}
                              </span>
                              {o.mapsUrl && (
                                <a href={o.mapsUrl} target="_blank" rel="noreferrer"
                                  onClick={e => e.stopPropagation()}
                                  style={{ color: '#4285f4', fontSize: 16, flexShrink: 0 }}
                                  title="Ver en Maps">📍</a>
                              )}
                            </span>
                          : '—'}
                      </td>
                      <td className="font-semibold">{fmt(o.total)}</td>
                      <td><span className={`badge ${st.cls}`}>{st.label}</span></td>
                      <td className="text-soft text-sm">{fmtDate(o.createdAt)}</td>
                      <td onClick={e => e.stopPropagation()}>
                        <select className="input" style={{ padding: '4px 8px', fontSize: 12 }}
                          value={o.status}
                          onChange={e => changeStatus(o.id, e.target.value)}>
                          {STATUS_TRANSITIONS.map(v => (
                            <option key={v} value={v}>{statusLabel[v]?.label || v}</option>
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

function InfoRow({ icon, label, value, link, linkLabel }) {
  if (!value) return null
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
      <span style={{ fontSize: 16, marginTop: 1 }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>{label.toUpperCase()}</div>
        <div style={{ fontSize: 14, color: '#1e293b', marginTop: 1 }}>
          {value}
          {link && (
            <a href={link} target="_blank" rel="noreferrer"
              style={{ marginLeft: 8, fontSize: 12, color: '#6366f1', fontWeight: 600 }}>
              {linkLabel} →
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

function OrderCard({ order, onStatus, onDetail }) {
  return (
    <div className="order-card card" style={{ cursor: 'pointer' }} onClick={onDetail}>
      <div className="order-card-header">
        <span className="font-semibold">{order.orderNumber}</span>
        <span className="badge badge-yellow">Pendiente</span>
      </div>

      {/* Datos del cliente */}
      <div className="order-customer" style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: 10, marginBottom: 10 }}>
        <div className="font-semibold" style={{ fontSize: 15 }}>👤 {order.customerName || 'Cliente'}</div>
        {order.customerPhone && (
          <div className="text-soft text-sm" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            📱
            <a href={`https://wa.me/${order.customerPhone.replace(/\D/g,'')}`}
              target="_blank" rel="noreferrer"
              onClick={e => e.stopPropagation()}
              style={{ color: '#25d366', fontWeight: 600 }}>
              {order.customerPhone}
            </a>
          </div>
        )}
        {order.customerEmail && (
          <div className="text-soft text-sm">✉️ {order.customerEmail}</div>
        )}
        {order.deliveryAddress && (
          <div className="text-soft text-sm" style={{ marginTop: 4 }}>
            📍 {order.deliveryAddress}
          </div>
        )}
        {order.mapsUrl && (
          <a href={order.mapsUrl} target="_blank" rel="noreferrer"
            onClick={e => e.stopPropagation()}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              marginTop: 6, background: '#4285f4', color: '#fff',
              borderRadius: 6, padding: '4px 10px', fontSize: 12,
              fontWeight: 600, textDecoration: 'none'
            }}>
            🗺️ Ver ubicación en Maps
          </a>
        )}
      </div>

      {/* Productos */}
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
        <div style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
          <button className="btn btn-sm btn-success" onClick={() => onStatus(order.id, 'confirmed')}>Confirmar</button>
          <button className="btn btn-sm btn-outline" onClick={() => onStatus(order.id, 'cancelled')}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}
