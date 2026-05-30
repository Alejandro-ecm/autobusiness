import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../store/AuthContext'
import { inventory as inventoryApi, orders as ordersApi, store as storeApi, business as businessApi, upload as uploadApi } from '../api'
import { useToast } from '../store/ToastContext'
import './StoreAdmin.css'

const BASE_API = (import.meta.env.VITE_API_URL || '/api')

const fmt = (n) => `$${Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`

const STATUS_LABELS = {
  pending:   { label: 'Pendiente',  cls: 'badge-yellow' },
  confirmed: { label: 'Confirmado', cls: 'badge-blue' },
  shipped:   { label: 'Enviado',    cls: 'badge-blue' },
  delivered: { label: 'Entregado',  cls: 'badge-green' },
  cancelled: { label: 'Cancelado',  cls: 'badge-red' },
}

const THEMES = [
  {
    id: 'modern',
    name: 'Moderno',
    desc: 'Fondo oscuro con estrellas, degradado índigo-teal. Elegante y llamativo.',
    preview: '🌌',
    bg: 'linear-gradient(135deg,#0d1b2e,#162744,#1a3560)',
    text: '#fff',
  },
  {
    id: 'classic',
    name: 'Clásico',
    desc: 'Fondo claro y cálido, tarjetas bien definidas. Limpio y confiable.',
    preview: '☀️',
    bg: 'linear-gradient(135deg,#fef9f0,#fff7ed)',
    text: '#1e293b',
  },
  {
    id: 'minimal',
    name: 'Minimal',
    desc: 'Todo blanco, tipografía clara. Ultra-limpio y moderno.',
    preview: '⬜',
    bg: '#ffffff',
    text: '#0f172a',
  },
]

export default function StoreAdmin() {
  const { user } = useAuth()
  const { show } = useToast()
  const [products, setProducts] = useState([])
  const [orders, setOrders]   = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab]         = useState('catalogo')

  const [showQr, setShowQr] = useState(false)
  const storeUrl     = user?.businessSlug ? `/tienda/${user.businessSlug}` : null
  const fullStoreUrl = storeUrl ? `${window.location.origin}${storeUrl}` : null

  // Diseño state
  const [design, setDesign] = useState({ name: '', description: '', logoUrl: '', bannerUrl: '', storeTheme: 'modern' })
  const [designLoading, setDesignLoading] = useState(false)
  const [logoError, setLogoError]         = useState(false)
  const [bannerError, setBannerError]     = useState(false)
  const [logoUploading, setLogoUploading]     = useState(false)
  const [bannerUploading, setBannerUploading] = useState(false)
  const logoInputRef   = useRef(null)
  const bannerInputRef = useRef(null)
  const [deliveryCode, setDeliveryCode] = useState('')

  const handleLogoUpload = async (file) => {
    if (!file || !file.type.startsWith('image/')) return
    if (file.size > 5 * 1024 * 1024) { show('Imagen demasiado grande (máx 5 MB)', 'error'); return }
    setLogoUploading(true)
    try {
      const result = await uploadApi.image(file, 'logos')
      setDesign(d => ({ ...d, logoUrl: result.url }))
      setLogoError(false)
    } catch { show('Error al subir logo', 'error') }
    finally { setLogoUploading(false) }
  }

  const handleBannerUpload = async (file) => {
    if (!file || !file.type.startsWith('image/')) return
    if (file.size > 5 * 1024 * 1024) { show('Imagen demasiado grande (máx 5 MB)', 'error'); return }
    setBannerUploading(true)
    try {
      const result = await uploadApi.image(file, 'banners')
      setDesign(d => ({ ...d, bannerUrl: result.url }))
      setBannerError(false)
    } catch { show('Error al subir banner', 'error') }
    finally { setBannerUploading(false) }
  }

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

  const loadStorefront = async () => {
    if (!user?.businessSlug) return
    try {
      const data = await storeApi.storefront(user.businessSlug)
      const b = data?.business || {}
      setDesign({
        name:        b.name        || user?.businessName || '',
        description: b.description || '',
        logoUrl:     b.logoUrl     || '',
        bannerUrl:   b.bannerUrl   || '',
        storeTheme:  b.storeTheme  || 'modern',
      })
    } catch { /* ignore */ }
  }

  useEffect(() => {
    load()
    loadStorefront()
    businessApi.deliveryCode().then(d => setDeliveryCode(d.deliveryCode || '')).catch(() => {})
  }, [])

  const onlineProducts   = products.filter(p => p.isOnline)
  const pendingOrders    = orders.filter(o => o.status === 'pending')
  const totalOnlineRevenue = orders
    .filter(o => o.status !== 'cancelled')
    .reduce((s, o) => s + Number(o.total || 0), 0)

  const toggleOnline = async (product) => {
    try {
      await inventoryApi.update(product.id, {
        name: product.name, price: product.price, cost: product.cost || 0,
        minStock: product.minStock || 5, description: product.description, isOnline: !product.isOnline,
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

  const saveDesign = async () => {
    setDesignLoading(true)
    try {
      await businessApi.updateSettings(design)
      show('Diseño guardado correctamente', 'success')
    } catch (e) {
      show(e?.error || 'Error al guardar diseño', 'error')
    } finally {
      setDesignLoading(false)
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
        {[
          { id: 'catalogo', label: '🏪 Catálogo' },
          { id: 'pedidos',  label: `📋 Pedidos${pendingOrders.length > 0 ? ` (${pendingOrders.length})` : ''}` },
          { id: 'delivery', label: '🛵 Delivery' },
          { id: 'diseno',   label: '🎨 Diseño' },
        ].map(t => (
          <button key={t.id} className={`tab-btn ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
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

      {/* Delivery */}
      {tab === 'delivery' && (
        <DeliveryCodePanel code={deliveryCode} baseApi={BASE_API} show={show} />
      )}

      {/* Diseño */}
      {tab === 'diseno' && (
        <div className="design-tab">
          {/* Identidad */}
          <div className="card design-section">
            <h3 className="design-section-title">Identidad de la tienda</h3>

            <div className="design-field">
              <label className="design-label">Nombre del negocio</label>
              <input
                className="input"
                value={design.name}
                onChange={e => setDesign(d => ({ ...d, name: e.target.value }))}
                placeholder="Ej: Sky Market"
              />
            </div>

            <div className="design-field">
              <label className="design-label">Descripción</label>
              <textarea
                className="input"
                rows={3}
                value={design.description}
                onChange={e => setDesign(d => ({ ...d, description: e.target.value }))}
                placeholder="Breve descripción de tu tienda o negocio…"
                style={{ resize: 'vertical' }}
              />
            </div>

            <div className="design-field">
              <label className="design-label">Logo del negocio</label>
              <input ref={logoInputRef} type="file" accept="image/*" style={{ display: 'none' }}
                onChange={e => handleLogoUpload(e.target.files[0])} />
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  className="input"
                  value={design.logoUrl}
                  onChange={e => { setDesign(d => ({ ...d, logoUrl: e.target.value })); setLogoError(false) }}
                  placeholder="https://…/logo.png  o sube una imagen"
                  style={{ flex: 1 }}
                />
                <button className="btn btn-secondary" style={{ whiteSpace: 'nowrap' }}
                  onClick={() => logoInputRef.current?.click()} disabled={logoUploading}>
                  {logoUploading ? 'Subiendo...' : '📷 Subir'}
                </button>
              </div>
              {design.logoUrl && !logoError && (
                <div className="design-preview-wrap">
                  <img src={design.logoUrl} alt="Logo preview" className="design-logo-preview"
                    onError={() => setLogoError(true)} />
                  <span className="design-preview-label">Vista previa del logo</span>
                </div>
              )}
              {logoError && <p className="design-preview-error">No se pudo cargar la imagen.</p>}
            </div>

            <div className="design-field">
              <label className="design-label">Imagen de fondo (banner)</label>
              <input ref={bannerInputRef} type="file" accept="image/*" style={{ display: 'none' }}
                onChange={e => handleBannerUpload(e.target.files[0])} />
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  className="input"
                  value={design.bannerUrl}
                  onChange={e => { setDesign(d => ({ ...d, bannerUrl: e.target.value })); setBannerError(false) }}
                  placeholder="https://…/banner.jpg  o sube una imagen (opcional)"
                  style={{ flex: 1 }}
                />
                <button className="btn btn-secondary" style={{ whiteSpace: 'nowrap' }}
                  onClick={() => bannerInputRef.current?.click()} disabled={bannerUploading}>
                  {bannerUploading ? 'Subiendo...' : '🖼️ Subir'}
                </button>
              </div>
              {design.bannerUrl && !bannerError && (
                <div className="design-banner-preview-wrap">
                  <img src={design.bannerUrl} alt="Banner preview" className="design-banner-preview"
                    onError={() => setBannerError(true)} />
                  <span className="design-preview-label">Vista previa del banner</span>
                </div>
              )}
              {bannerError && <p className="design-preview-error">No se pudo cargar la imagen.</p>}
            </div>
          </div>

          {/* Tema */}
          <div className="card design-section">
            <h3 className="design-section-title">Estilo de la tienda</h3>
            <p className="design-section-sub">Elige cómo se verá tu tienda para los clientes.</p>
            <div className="design-themes">
              {THEMES.map(t => (
                <button
                  key={t.id}
                  className={`design-theme-card ${design.storeTheme === t.id ? 'active' : ''}`}
                  onClick={() => setDesign(d => ({ ...d, storeTheme: t.id }))}
                >
                  <div className="design-theme-preview" style={{ background: t.bg }}>
                    <span className="design-theme-emoji">{t.preview}</span>
                    <div className="design-theme-bars" style={{ opacity: t.id === 'minimal' ? 0.2 : 0.4 }}>
                      <div style={{ background: t.text, height: 6, borderRadius: 3, width: '60%', marginBottom: 4 }} />
                      <div style={{ background: t.text, height: 4, borderRadius: 3, width: '40%', marginBottom: 4 }} />
                      <div style={{ background: t.text, height: 4, borderRadius: 3, width: '50%' }} />
                    </div>
                  </div>
                  <div className="design-theme-info">
                    <div className="design-theme-name">{t.name}</div>
                    <div className="design-theme-desc">{t.desc}</div>
                  </div>
                  {design.storeTheme === t.id && <div className="design-theme-check">✓</div>}
                </button>
              ))}
            </div>
          </div>

          {/* Guardar */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={saveDesign} disabled={designLoading}>
              {designLoading ? 'Guardando…' : '💾 Guardar diseño'}
            </button>
            {storeUrl && (
              <a href={storeUrl} target="_blank" rel="noopener noreferrer" className="btn btn-outline">
                👁 Ver tienda
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function DeliveryCodePanel({ code, baseApi, show }) {
  const copyCode = () => {
    navigator.clipboard.writeText(code)
    show('Código copiado', 'success')
  }
  const copyEndpoint = () => {
    const url = `${baseApi}/delivery/orders?code=${code}`
    navigator.clipboard.writeText(url)
    show('Endpoint copiado', 'success')
  }

  return (
    <div style={{ display: 'grid', gap: 20 }}>

      {/* Código */}
      <div className="card" style={{ textAlign: 'center', padding: '32px 24px' }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>🛵</div>
        <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 4, color: '#0f172a' }}>
          Código de sincronización Delivery
        </h2>
        <p style={{ fontSize: 13, color: '#64748b', marginBottom: 24 }}>
          Comparte este código con tu app de repartidores para que reciban los pedidos automáticamente.
        </p>

        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 16,
          background: '#0f172a', borderRadius: 16, padding: '18px 28px',
          marginBottom: 20
        }}>
          <span style={{
            fontFamily: 'monospace', fontSize: 32, fontWeight: 900,
            color: '#6366f1', letterSpacing: 6
          }}>
            {code || '—'}
          </span>
          <button onClick={copyCode}
            style={{
              background: '#6366f1', color: '#fff', border: 'none',
              borderRadius: 10, padding: '8px 16px', cursor: 'pointer',
              fontWeight: 700, fontSize: 13
            }}>
            Copiar
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: '#f0fdf4', color: '#16a34a', borderRadius: 20,
            padding: '4px 12px', fontSize: 12, fontWeight: 600
          }}>
            🔒 Solo tú ves este código
          </span>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: '#eff6ff', color: '#2563eb', borderRadius: 20,
            padding: '4px 12px', fontSize: 12, fontWeight: 600
          }}>
            🔄 Se sincroniza en tiempo real
          </span>
        </div>
      </div>

      {/* Endpoint para desarrollador */}
      <div className="card">
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>🔌 Endpoint para tu app</div>
        <p style={{ fontSize: 13, color: '#64748b', marginBottom: 14 }}>
          Tu app de delivery hace una petición GET a esta URL para obtener los pedidos activos con ubicación GPS.
        </p>
        <div style={{
          background: '#0f172a', borderRadius: 10, padding: '14px 16px',
          display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap'
        }}>
          <code style={{ color: '#a5f3fc', fontSize: 12, wordBreak: 'break-all', flex: 1 }}>
            GET {baseApi}/delivery/orders?code=<span style={{ color: '#fb923c', fontWeight: 700 }}>{code}</span>
          </code>
          <button onClick={copyEndpoint}
            style={{
              background: '#6366f1', color: '#fff', border: 'none',
              borderRadius: 8, padding: '6px 14px', cursor: 'pointer',
              fontWeight: 600, fontSize: 12, flexShrink: 0
            }}>
            Copiar
          </button>
        </div>

        <div style={{ marginTop: 16, background: '#f8fafc', borderRadius: 10, padding: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 12, color: '#374151', marginBottom: 8 }}>Respuesta JSON por pedido:</div>
          <div style={{ display: 'grid', gap: 5 }}>
            {[
              ['customerName',     'Nombre del cliente'],
              ['customerPhone',    'WhatsApp / teléfono'],
              ['deliveryAddress',  'Calle y número escrita'],
              ['deliveryLat/Lng',  'Coordenadas GPS exactas del pin'],
              ['mapsUrl',          'Ver ubicación en Google Maps'],
              ['navUrl',           'Abrir navegación guiada en Google Maps'],
              ['wazeUrl',          'Abrir navegación guiada en Waze'],
              ['total',            'Total del pedido'],
              ['paymentMethod',    '"cash_on_delivery" o "online"'],
              ['status',           'Estado actual del pedido'],
              ['items[]',          'Lista de productos con cantidad y precio'],
            ].map(([field, desc]) => (
              <div key={field} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12 }}>
                <span style={{ fontFamily: 'monospace', color: '#6366f1', fontWeight: 700, minWidth: 120, flexShrink: 0 }}>{field}</span>
                <span style={{ color: '#64748b' }}>— {desc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Otros endpoints */}
        <div style={{ marginTop: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 12, color: '#374151', marginBottom: 8 }}>Otros endpoints disponibles:</div>
          <div style={{ display: 'grid', gap: 6 }}>
            {[
              ['PATCH', `/delivery/orders/{id}/status?code=${code}`, 'Cambiar estado: pending→confirmed→preparing→ready→delivered'],
              ['POST',  `/delivery/orders/{id}/deliver?code=${code}`, 'Marcar como entregado (registra la venta si es efectivo)'],
              ['GET',   `/delivery/earnings?code=${code}`, 'Historial de ventas y ganancias del día'],
            ].map(([method, path, desc]) => (
              <div key={path} style={{ background: '#0f172a', borderRadius: 8, padding: '8px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                  <span style={{ color: method === 'GET' ? '#34d399' : method === 'PATCH' ? '#fbbf24' : '#60a5fa', fontFamily: 'monospace', fontWeight: 700, fontSize: 11 }}>{method}</span>
                  <code style={{ color: '#a5f3fc', fontSize: 11, wordBreak: 'break-all' }}>{path}</code>
                </div>
                <span style={{ color: '#64748b', fontSize: 11 }}>{desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Instrucciones */}
      <div className="card" style={{ background: 'linear-gradient(135deg,#eff6ff,#f0fdf4)' }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>📱 Qué configurar en Auto Delivery</div>
        <div style={{ display: 'grid', gap: 10 }}>
          {[
            ['1', `URL base del API: ${baseApi}`],
            ['2', `Código de delivery: ${code || '(ver arriba)'} — es la "API key" del negocio`],
            ['3', 'Usa navUrl de cada pedido para abrir Google Maps en modo navegación guiada'],
            ['4', 'O usa wazeUrl para abrir Waze con la ruta ya calculada'],
            ['5', 'Llama PATCH /delivery/orders/{id}/status para actualizar el estado en tiempo real'],
            ['6', 'Llama POST /delivery/orders/{id}/deliver cuando el cliente recibe el pedido'],
          ].map(([n, text]) => (
            <div key={n} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span style={{
                width: 26, height: 26, borderRadius: '50%', background: '#6366f1',
                color: '#fff', fontWeight: 700, fontSize: 13,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
              }}>{n}</span>
              <span style={{ fontSize: 13, color: '#374151', paddingTop: 3, wordBreak: 'break-all' }}>{text}</span>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
