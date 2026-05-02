import { useState, useEffect } from 'react'
import { useAuth } from '../store/AuthContext'
import { inventory as inventoryApi, orders as ordersApi } from '../api'
import { useToast } from '../store/ToastContext'
import './StoreAdmin.css'

const fmt = (n) => `$${Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`

const STATUS_LABELS = {
  pending: { label: 'Pendiente', cls: 'badge-yellow' },
  confirmed: { label: 'Confirmado', cls: 'badge-blue' },
  shipped: { label: 'Enviado', cls: 'badge-blue' },
  delivered: { label: 'Entregado', cls: 'badge-green' },
  cancelled: { label: 'Cancelado', cls: 'badge-red' },
}

export default function StoreAdmin() {
  const { user } = useAuth()
  const { show } = useToast()
  const [products, setProducts] = useState([])
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('catalogo')

  const [showQr, setShowQr] = useState(false)
  const storeUrl = user?.businessSlug ? `/tienda/${user.businessSlug}` : null
  const fullStoreUrl = storeUrl ? `${window.location.origin}${storeUrl}` : null

  const copyLink = () => {
    if (!fullStoreUrl) return
    navigator.clipboard.writeText(fullStoreUrl)
    show('Enlace copiado al portapapeles', 'success')
  }

  const load = async () => {
    try {
      const [prods, ords] = await Promise.all([
        inventoryApi.list(),
        ordersApi.list().catch(() => []),
      ])
      setProducts(prods)
      setOrders(ords)
    } catch {
      show('Error al cargar datos de la tienda', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const onlineProducts = products.filter(p => p.isOnline)
  const pendingOrders = orders.filter(o => o.status === 'pending')
  const totalOnlineRevenue = orders
    .filter(o => o.status !== 'cancelled')
    .reduce((s, o) => s + Number(o.total || 0), 0)

  const toggleOnline = async (product) => {
    try {
      await inventoryApi.update(product.id, {
        name: product.name,
        price: product.price,
        cost: product.cost || 0,
        minStock: product.minStock || 5,
        description: product.description,
        isOnline: !product.isOnline,
      })
      show(product.isOnline ? 'Quitado de la tienda' : 'Publicado en tienda', 'success')
      load()
    } catch {
      show('Error al actualizar', 'error')
    }
  }

  const updateOrderStatus = async (id, status) => {
    try {
      await ordersApi.updateStatus(id, status)
      show('Estado actualizado', 'success')
      load()
    } catch {
      show('Error al actualizar estado', 'error')
    }
  }

  if (loading) return (
    <div className="page-loading">
      <div className="spinner" style={{ width: 32, height: 32 }} />
    </div>
  )

  return (
    <div className="store-admin-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Tienda Online</h1>
          <p className="page-subtitle">{onlineProducts.length} productos publicados</p>
        </div>
        {storeUrl && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-outline" onClick={copyLink}>📋 Copiar enlace</button>
            <button className="btn btn-outline" onClick={() => setShowQr(v => !v)}>
              {showQr ? 'Ocultar QR' : '📱 Ver QR'}
            </button>
            <a href={storeUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
              🔗 Ver tienda
            </a>
          </div>
        )}
      </div>

      {/* QR panel */}
      {showQr && fullStoreUrl && (
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '16px 24px', flexWrap: 'wrap' }}>
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(fullStoreUrl)}`}
            alt="QR tienda"
            style={{ width: 140, height: 140, borderRadius: 8, border: '1px solid #e2e8f0' }}
          />
          <div>
            <div className="font-semibold" style={{ marginBottom: 6 }}>QR de tu tienda online</div>
            <div className="text-soft text-sm" style={{ marginBottom: 10, wordBreak: 'break-all' }}>{fullStoreUrl}</div>
            <button className="btn btn-outline btn-sm" onClick={copyLink}>📋 Copiar enlace</button>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="store-kpis">
        <div className="card store-kpi">
          <div className="store-kpi-icon">🛍</div>
          <div className="store-kpi-val">{onlineProducts.length}</div>
          <div className="store-kpi-label">Productos publicados</div>
        </div>
        <div className="card store-kpi">
          <div className="store-kpi-icon">📋</div>
          <div className="store-kpi-val store-kpi-val--alert">{pendingOrders.length}</div>
          <div className="store-kpi-label">Pedidos pendientes</div>
        </div>
        <div className="card store-kpi">
          <div className="store-kpi-icon">📦</div>
          <div className="store-kpi-val">{orders.length}</div>
          <div className="store-kpi-label">Pedidos totales</div>
        </div>
        <div className="card store-kpi">
          <div className="store-kpi-icon">💰</div>
          <div className="store-kpi-val">{fmt(totalOnlineRevenue)}</div>
          <div className="store-kpi-label">Ingresos online</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="store-tabs">
        {['catalogo', 'pedidos'].map(t => (
          <button key={t} className={`tab-btn ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t === 'catalogo' ? '🏪 Catálogo' : `📋 Pedidos ${pendingOrders.length > 0 ? `(${pendingOrders.length})` : ''}`}
          </button>
        ))}
      </div>

      {/* Catálogo */}
      {tab === 'catalogo' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="inv-table">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Precio</th>
                <th>Stock</th>
                <th>Estado tienda</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {products.map(p => (
                <tr key={p.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {p.imageUrl
                        ? <img src={p.imageUrl} alt={p.name} style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover' }} />
                        : <div style={{ width: 36, height: 36, background: '#f1f5f9', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>📦</div>
                      }
                      <div>
                        <div className="font-semibold">{p.name}</div>
                        {p.sku && <div className="text-soft text-sm">{p.sku}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="font-semibold">{fmt(p.price)}</td>
                  <td>
                    <span className={`badge ${p.stock === 0 ? 'badge-red' : p.stock <= (p.minStock || 5) ? 'badge-yellow' : 'badge-green'}`}>
                      {p.stock} uds
                    </span>
                  </td>
                  <td>
                    {p.isOnline
                      ? <span className="badge badge-green">✓ Publicado</span>
                      : <span className="badge badge-gray">Oculto</span>}
                  </td>
                  <td>
                    <button
                      className={`btn btn-sm ${p.isOnline ? 'btn-outline' : 'btn-primary'}`}
                      onClick={() => toggleOnline(p)}
                      disabled={p.stock === 0 && !p.isOnline}
                    >
                      {p.isOnline ? 'Ocultar' : 'Publicar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {products.length === 0 && (
            <div className="empty-state" style={{ padding: 48, textAlign: 'center' }}>
              <p className="text-soft">Sin productos. Agrégalos en Inventario.</p>
            </div>
          )}
        </div>
      )}

      {/* Pedidos */}
      {tab === 'pedidos' && (
        <div className="orders-list">
          {orders.length === 0 ? (
            <div className="card" style={{ padding: 48, textAlign: 'center' }}>
              <p style={{ fontSize: 40 }}>📦</p>
              <p className="text-soft">Aún no tienes pedidos online</p>
              {storeUrl && (
                <a href={storeUrl} target="_blank" rel="noopener noreferrer" className="btn btn-outline" style={{ marginTop: 16 }}>
                  Compartir enlace de tienda
                </a>
              )}
            </div>
          ) : (
            orders.map(o => {
              const st = STATUS_LABELS[o.status] || { label: o.status, cls: 'badge-gray' }
              return (
                <div key={o.id} className="card order-card">
                  <div className="order-header">
                    <div>
                      <div className="order-number">#{o.orderNumber}</div>
                      <div className="text-soft text-sm">
                        {o.customerName} {o.customerPhone && `· ${o.customerPhone}`}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span className={`badge ${st.cls}`}>{st.label}</span>
                      <div className="font-semibold">{fmt(o.total)}</div>
                    </div>
                  </div>
                  {o.items?.length > 0 && (
                    <div className="order-items">
                      {o.items.map((item, i) => (
                        <span key={i} className="order-item-tag">
                          {item.product?.name || 'Producto'} x{item.quantity}
                        </span>
                      ))}
                    </div>
                  )}
                  {o.status === 'pending' && (
                    <div className="order-actions">
                      <button className="btn btn-sm btn-primary" onClick={() => updateOrderStatus(o.id, 'confirmed')}>
                        Confirmar
                      </button>
                      <button className="btn btn-sm btn-outline" onClick={() => updateOrderStatus(o.id, 'shipped')}>
                        Marcar enviado
                      </button>
                      <button className="btn btn-sm" style={{ color: '#ef4444', background: 'none', border: '1px solid #fca5a5' }}
                        onClick={() => updateOrderStatus(o.id, 'cancelled')}>
                        Cancelar
                      </button>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
