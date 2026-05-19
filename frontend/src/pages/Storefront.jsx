import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { store as storeApi } from '../api'
import { useToast } from '../store/ToastContext'
import './Storefront.css'

const fmt = (n) => `$${Number(n || 0).toFixed(2)}`
const DEFAULT_LOGO = '/skymarket-logo.jpg'

function ShareButtons({ slug, businessName }) {
  const { show } = useToast()
  const url = `${window.location.origin}/tienda/${slug}`
  const msg = encodeURIComponent(`¡Visita la tienda online de ${businessName}! 🛒\n${url}`)

  const copy = () => {
    navigator.clipboard.writeText(url)
      .then(() => show('Link copiado al portapapeles', 'success'))
      .catch(() => show('No se pudo copiar', 'error'))
  }

  return (
    <div className="sf-share">
      <span className="sf-share-label">Compartir tienda:</span>
      <div className="sf-share-btns">
        <a className="sf-share-btn sf-share-wa"
          href={`https://api.whatsapp.com/send?text=${msg}`} target="_blank" rel="noreferrer"
          title="WhatsApp">
          <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
        </a>
        <a className="sf-share-btn sf-share-fb"
          href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`} target="_blank" rel="noreferrer"
          title="Facebook">
          <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
        </a>
        <a className="sf-share-btn sf-share-tt"
          href={`https://www.tiktok.com/`} target="_blank" rel="noreferrer"
          title="TikTok — copia el link">
          <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.98a8.2 8.2 0 004.84 1.56V7.1a4.85 4.85 0 01-1.07-.41z"/></svg>
        </a>
        <a className="sf-share-btn sf-share-ig"
          href={`https://www.instagram.com/`} target="_blank" rel="noreferrer"
          title="Instagram — comparte en stories">
          <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
        </a>
        <button className="sf-share-btn sf-share-copy" onClick={copy} title="Copiar link">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
        </button>
      </div>
    </div>
  )
}

export default function Storefront() {
  const { slug } = useParams()
  const { show } = useToast()
  const [storefront, setStorefront] = useState(null)
  const [cart, setCart] = useState([])
  const [loading, setLoading] = useState(true)
  const [ordering, setOrdering] = useState(false)
  const [step, setStep] = useState('shop')
  const [orderResult, setOrderResult] = useState(null)
  const [customer, setCustomer] = useState({ name: '', phone: '', email: '' })
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')
  const [logoError, setLogoError] = useState(false)

  useEffect(() => {
    storeApi.storefront(slug).then(setStorefront).finally(() => setLoading(false))
  }, [slug])

  const { business, products = [] } = storefront || {}

  const categories = useMemo(() => {
    if (!products.length) return []
    const cats = {}
    products.forEach(p => {
      if (p.category) cats[p.category.id] = p.category
    })
    return Object.values(cats)
  }, [products])

  const filtered = useMemo(() => {
    return products.filter(p => {
      const matchSearch = !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.description || '').toLowerCase().includes(search.toLowerCase())
      const matchCat = activeCategory === 'all' || p.category?.id === activeCategory
      return matchSearch && matchCat
    })
  }, [products, search, activeCategory])

  const cartCount = cart.reduce((s, i) => s + i.qty, 0)
  const total = cart.reduce((s, i) => s + i.price * i.qty, 0)

  const addToCart = (product) => {
    setCart(prev => {
      const ex = prev.find(i => i.productId === product.id)
      if (ex) return prev.map(i => i.productId === product.id ? { ...i, qty: i.qty + 1 } : i)
      return [...prev, { productId: product.id, name: product.name, price: product.price, qty: 1 }]
    })
    show(`${product.name} añadido al carrito`, 'success')
  }

  const removeFromCart = (productId) => setCart(prev => prev.filter(i => i.productId !== productId))

  const updateQty = (productId, qty) => {
    if (qty <= 0) { removeFromCart(productId); return }
    setCart(prev => prev.map(i => i.productId === productId ? { ...i, qty } : i))
  }

  const placeOrder = async (e) => {
    e.preventDefault()
    setOrdering(true)
    try {
      const res = await storeApi.placeOrder(slug, {
        customerName: customer.name,
        customerPhone: customer.phone,
        customerEmail: customer.email,
        items: cart.map(i => ({ productId: i.productId, quantity: i.qty }))
      })
      setOrderResult(res)
      try {
        const pay = await storeApi.createPayment(slug, {
          orderId: res.id,
          total,
          items: cart.map(i => ({ title: i.name, quantity: i.qty, unit_price: i.price })),
          payerEmail: customer.email || ''
        })
        const url = pay.initPoint || pay.sandboxPoint
        if (url) { window.location.href = url; return }
      } catch { /* MP no configurado */ }
      setStep('success')
    } catch (err) {
      show(err?.error || err?.message || 'Error al procesar tu pedido. Intenta de nuevo.', 'error')
    } finally { setOrdering(false) }
  }

  const logoSrc = (!logoError && business?.logoUrl) ? business.logoUrl : DEFAULT_LOGO
  const theme   = business?.storeTheme || 'modern'
  const bannerUrl = business?.bannerUrl || ''

  if (loading) return (
    <div className="sf-loading">
      <div className="spinner" style={{ width: 36, height: 36 }} />
      <p style={{ color: '#94a3b8', marginTop: 12 }}>Cargando tienda...</p>
    </div>
  )
  if (!storefront) return (
    <div className="sf-loading">
      <div style={{ fontSize: 48 }}>🏪</div>
      <p style={{ color: '#64748b', marginTop: 12 }}>Tienda no encontrada</p>
    </div>
  )

  if (step === 'success') return (
    <div className="sf-page">
      <header className="sf-header-bar">
        <div className="sf-header-inner">
          <img className="sf-header-logo" src={logoSrc} alt={business.name}
            onError={() => setLogoError(true)} />
          <span className="sf-header-name">{business.name}</span>
        </div>
      </header>
      <div className="sf-success">
        <div className="sf-success-box">
          <div style={{ fontSize: 64 }}>✅</div>
          <h2>¡Pedido enviado!</h2>
          <p>Orden: <strong>{orderResult?.orderNumber}</strong></p>
          <p className="text-soft">Te contactaremos pronto para confirmar y coordinar la entrega.</p>
          <button className="sf-btn-primary" style={{ marginTop: 24 }}
            onClick={() => { setStep('shop'); setCart([]) }}>
            Seguir comprando
          </button>
        </div>
      </div>
    </div>
  )

  if (step === 'checkout') return (
    <div className="sf-page">
      <header className="sf-header-bar">
        <div className="sf-header-inner">
          <img className="sf-header-logo" src={logoSrc} alt={business.name}
            onError={() => setLogoError(true)} />
          <span className="sf-header-name">{business.name}</span>
        </div>
      </header>
      <div className="sf-checkout">
        <div className="sf-checkout-box">
          <button className="sf-back-btn" onClick={() => setStep('shop')}>← Seguir comprando</button>
          <h2>Tu pedido</h2>
          {cart.map(i => (
            <div key={i.productId} className="sf-cart-item">
              <div className="sf-cart-item-info">
                <span className="sf-cart-item-name">{i.name}</span>
                <div className="sf-cart-item-qty">
                  <button className="qty-ctrl" onClick={() => updateQty(i.productId, i.qty - 1)}>−</button>
                  <span>{i.qty}</span>
                  <button className="qty-ctrl" onClick={() => updateQty(i.productId, i.qty + 1)}>+</button>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span className="sf-cart-item-price">{fmt(i.price * i.qty)}</span>
                <button className="sf-remove" onClick={() => removeFromCart(i.productId)}>×</button>
              </div>
            </div>
          ))}
          <div className="sf-total">Total: <strong>{fmt(total)}</strong></div>
          <div className="divider" />
          <form onSubmit={placeOrder} className="sf-form">
            <div className="input-group">
              <label>Tu nombre *</label>
              <input className="input" value={customer.name}
                onChange={e => setCustomer(c => ({ ...c, name: e.target.value }))} required />
            </div>
            <div className="input-group">
              <label>WhatsApp / Teléfono</label>
              <input className="input" value={customer.phone}
                onChange={e => setCustomer(c => ({ ...c, phone: e.target.value }))}
                placeholder="+52 55 0000 0000" />
            </div>
            <div className="input-group">
              <label>Email (opcional)</label>
              <input className="input" type="email" value={customer.email}
                onChange={e => setCustomer(c => ({ ...c, email: e.target.value }))} />
            </div>
            <button type="submit" className="sf-btn-primary" style={{ width: '100%', marginTop: 8 }}
              disabled={ordering}>
              {ordering ? <div className="spinner" /> : `Confirmar pedido — ${fmt(total)}`}
            </button>
          </form>
        </div>
      </div>
    </div>
  )

  return (
    <div className={`sf-page sf-theme-${theme}`}>
      {/* ── HERO BANNER ─────────────────────────────────────────────────── */}
      <div
        className="sf-hero"
        style={bannerUrl ? { backgroundImage: `url(${bannerUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
      >
        {!bannerUrl && <div className="sf-hero-bg" />}
        <div className="sf-hero-content">
          <div className="sf-hero-logo-wrap">
            <img
              className="sf-hero-logo"
              src={logoSrc}
              alt={business.name}
              onError={() => setLogoError(true)}
            />
          </div>
          <h1 className="sf-hero-name">{business.name}</h1>
          {business.description && (
            <p className="sf-hero-desc">{business.description}</p>
          )}
          <div className="sf-hero-badges">
            <span className="sf-badge">🛒 Tienda en línea</span>
            <span className="sf-badge">⚡ Pedidos rápidos</span>
            <span className="sf-badge">✅ {products.length} productos</span>
          </div>
          <ShareButtons slug={slug} businessName={business.name} />
        </div>
      </div>

      {/* ── CONTENT ─────────────────────────────────────────────────────── */}
      <div className="sf-content">
        {/* Search + filters */}
        <div className="sf-controls">
          <div className="sf-search-wrap">
            <span className="sf-search-icon">🔍</span>
            <input
              className="sf-search-input"
              placeholder="Buscar productos..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button className="sf-search-clear" onClick={() => setSearch('')}>×</button>
            )}
          </div>
          {categories.length > 0 && (
            <div className="sf-categories">
              <button
                className={`sf-cat-btn ${activeCategory === 'all' ? 'active' : ''}`}
                onClick={() => setActiveCategory('all')}>
                Todos ({products.length})
              </button>
              {categories.map(cat => (
                <button key={cat.id}
                  className={`sf-cat-btn ${activeCategory === cat.id ? 'active' : ''}`}
                  style={activeCategory === cat.id ? { borderColor: cat.color, color: cat.color, background: cat.color + '15' } : {}}
                  onClick={() => setActiveCategory(cat.id)}>
                  {cat.name} ({products.filter(p => p.category?.id === cat.id).length})
                </button>
              ))}
            </div>
          )}
        </div>

        {(search || activeCategory !== 'all') && (
          <p className="sf-results-info">
            {filtered.length} resultado{filtered.length !== 1 ? 's' : ''}
            {search && <> para "<strong>{search}</strong>"</>}
          </p>
        )}

        {/* Product grid */}
        {filtered.length > 0 ? (
          <div className="sf-grid">
            {filtered.map(p => {
              const inCart = cart.find(i => i.productId === p.id)
              const soldOut = p.stock === 0
              const lowStock = !soldOut && Number(p.stock) <= Number(p.minStock || 5)
              return (
                <div key={p.id} className={`sf-product ${soldOut ? 'sf-product--sold-out' : ''}`}>
                  <div className="sf-product-img">
                    {p.imageUrl
                      ? <img src={p.imageUrl} alt={p.name} />
                      : <div className="sf-product-placeholder">
                          <span>📦</span>
                          <span className="sf-placeholder-name">{p.name[0]}</span>
                        </div>}
                    {soldOut && <div className="sf-badge-pill sf-badge-red">Agotado</div>}
                    {lowStock && <div className="sf-badge-pill sf-badge-amber">Pocas unidades</div>}
                  </div>
                  <div className="sf-product-body">
                    {p.category && (
                      <span className="sf-category-tag" style={{ color: p.category.color, background: p.category.color + '18' }}>
                        {p.category.name}
                      </span>
                    )}
                    <div className="sf-product-name">{p.name}</div>
                    {p.description && <p className="sf-product-desc">{p.description}</p>}
                    <div className="sf-product-footer">
                      <span className="sf-price">{fmt(p.price)}</span>
                      {inCart ? (
                        <div className="sf-qty-controls">
                          <button className="qty-ctrl" onClick={() => updateQty(p.id, inCart.qty - 1)}>−</button>
                          <span className="sf-qty-val">{inCart.qty}</span>
                          <button className="qty-ctrl" onClick={() => updateQty(p.id, inCart.qty + 1)}
                            disabled={p.stock > 0 && inCart.qty >= p.stock}>+</button>
                        </div>
                      ) : (
                        <button className="sf-add-btn"
                          onClick={() => addToCart(p)} disabled={soldOut}>
                          {soldOut ? 'Agotado' : '+ Agregar'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="sf-empty">
            <div style={{ fontSize: 52 }}>🔍</div>
            <p>No encontramos productos{search ? ` para "${search}"` : ' disponibles'}</p>
            <button className="sf-btn-outline" onClick={() => { setSearch(''); setActiveCategory('all') }}>
              Ver todos
            </button>
          </div>
        )}
      </div>

      {/* Sticky cart bar */}
      {cartCount > 0 && (
        <div className="sf-cart-bar">
          <div className="sf-cart-summary">
            🛒 <strong>{cartCount}</strong> {cartCount === 1 ? 'producto' : 'productos'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>{fmt(total)}</span>
            <button className="sf-btn-primary sf-btn-sm" onClick={() => setStep('checkout')}>
              Ir al pedido →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
