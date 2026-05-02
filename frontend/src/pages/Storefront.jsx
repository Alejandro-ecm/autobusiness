import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { store as storeApi } from '../api'
import './Storefront.css'

const fmt = (n) => `$${Number(n || 0).toFixed(2)}`

export default function Storefront() {
  const { slug } = useParams()
  const [storefront, setStorefront] = useState(null)
  const [cart, setCart] = useState([])
  const [loading, setLoading] = useState(true)
  const [ordering, setOrdering] = useState(false)
  const [step, setStep] = useState('shop')
  const [orderResult, setOrderResult] = useState(null)
  const [customer, setCustomer] = useState({ name: '', phone: '', email: '' })
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')

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
      setStep('success')
    } catch (err) {
      alert(err?.error || 'Error al procesar pedido')
    } finally { setOrdering(false) }
  }

  if (loading) return (
    <div className="sf-loading">
      <div className="spinner" style={{ width: 32, height: 32 }} />
      <p style={{ color: '#94a3b8' }}>Cargando tienda...</p>
    </div>
  )
  if (!storefront) return (
    <div className="sf-loading"><p>Tienda no encontrada</p></div>
  )

  if (step === 'success') return (
    <div className="sf-page">
      <header className="sf-header">
        <div className="sf-header-inner">
          <div className="sf-logo">{business.name[0]}</div>
          <h1 className="sf-business-name">{business.name}</h1>
        </div>
      </header>
      <div className="sf-success">
        <div className="sf-success-box">
          <div>✅</div>
          <h2>¡Pedido enviado!</h2>
          <p>Orden: <strong>{orderResult?.orderNumber}</strong></p>
          <p className="text-soft">Te contactaremos pronto para confirmar y coordinar la entrega</p>
          <button className="btn btn-primary" style={{ marginTop: 20 }}
            onClick={() => { setStep('shop'); setCart([]) }}>
            Seguir comprando
          </button>
        </div>
      </div>
    </div>
  )

  if (step === 'checkout') return (
    <div className="sf-page">
      <header className="sf-header">
        <div className="sf-header-inner">
          <div className="sf-logo">{business.name[0]}</div>
          <h1 className="sf-business-name">{business.name}</h1>
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
            <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }}
              disabled={ordering}>
              {ordering ? <div className="spinner" /> : `Confirmar pedido — ${fmt(total)}`}
            </button>
          </form>
        </div>
      </div>
    </div>
  )

  return (
    <div className="sf-page">
      <header className="sf-header">
        <div className="sf-header-inner">
          <div className="sf-logo">{business.name[0]}</div>
          <div>
            <h1 className="sf-business-name">{business.name}</h1>
            {business.description && <p className="sf-business-desc">{business.description}</p>}
          </div>
          {cartCount > 0 && (
            <button className="sf-cart-pill" onClick={() => setStep('checkout')}>
              🛒 {cartCount} {cartCount === 1 ? 'producto' : 'productos'} — {fmt(total)}
            </button>
          )}
        </div>
      </header>

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
                  style={activeCategory === cat.id ? { borderColor: cat.color, color: cat.color } : {}}
                  onClick={() => setActiveCategory(cat.id)}>
                  {cat.name} ({products.filter(p => p.category?.id === cat.id).length})
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Results info */}
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
              return (
                <div key={p.id} className={`sf-product ${p.stock === 0 ? 'sf-product--sold-out' : ''}`}>
                  <div className="sf-product-img">
                    {p.imageUrl
                      ? <img src={p.imageUrl} alt={p.name} />
                      : <span className="sf-product-placeholder">📦</span>}
                    {p.stock === 0 && <div className="sf-sold-out-badge">Agotado</div>}
                    {p.stock > 0 && p.stock <= (p.minStock || 5) && (
                      <div className="sf-low-stock-badge">Pocas unidades</div>
                    )}
                  </div>
                  <div className="sf-product-body">
                    {p.category && (
                      <span className="sf-category-tag" style={{ color: p.category.color }}>
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
                        <button className="btn btn-primary btn-sm"
                          onClick={() => addToCart(p)} disabled={p.stock === 0}>
                          {p.stock === 0 ? 'Agotado' : '+ Agregar'}
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
            <div style={{ fontSize: 48 }}>🔍</div>
            <p>No encontramos productos{search ? ` para "${search}"` : ''}</p>
            <button className="btn btn-outline" onClick={() => { setSearch(''); setActiveCategory('all') }}>
              Ver todos los productos
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
            <button className="btn btn-primary" onClick={() => setStep('checkout')}>
              Ir al pedido →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
