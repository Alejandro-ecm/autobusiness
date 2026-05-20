import { useState, useEffect, useRef, useCallback } from 'react'
import { pos as posApi } from '../api'
import { useAuth } from '../store/AuthContext'
import { useToast } from '../store/ToastContext'
import './POS.css'

const fmt = (n) => `$${Number(n || 0).toFixed(2)}`
const OFFLINE_KEY = 'ab_offline_sales'

// Guarda venta pendiente en localStorage con manejo seguro de errores
function saveOfflineSale(data) {
  try {
    const pending = JSON.parse(localStorage.getItem(OFFLINE_KEY) || '[]')
    pending.push({ ...data, savedAt: Date.now() })
    localStorage.setItem(OFFLINE_KEY, JSON.stringify(pending))
  } catch {
    // Si el storage está lleno o bloqueado, la venta no se puede guardar offline
    console.warn('No se pudo guardar la venta offline — storage no disponible')
  }
}

// Intenta sincronizar ventas offline al recuperar conexión
async function syncOfflineSales(checkoutFn, onSuccess) {
  let pending
  try {
    pending = JSON.parse(localStorage.getItem(OFFLINE_KEY) || '[]')
  } catch {
    return 0
  }
  if (pending.length === 0) return 0
  let synced = 0
  const remaining = []
  for (const sale of pending) {
    try {
      await checkoutFn(sale)
      synced++
    } catch {
      remaining.push(sale)
    }
  }
  try { localStorage.setItem(OFFLINE_KEY, JSON.stringify(remaining)) } catch {}
  if (synced > 0) onSuccess(synced)
  return synced
}

const PAY_METHODS = [
  { id: 'cash',     label: 'Efectivo', icon: '💵' },
  { id: 'card',     label: 'Tarjeta',  icon: '💳' },
  { id: 'transfer', label: 'Transfer', icon: '📲' },
  { id: 'mp',       label: 'MercadoPago', icon: '🟦' },
]

export default function POS() {
  const { user } = useAuth()
  const { show } = useToast()
  const [products, setProducts] = useState([])
  const [topProducts, setTopProducts] = useState([])
  const [cart, setCart] = useState([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [cashReceived, setCashReceived] = useState('')
  const [payMethod, setPayMethod] = useState('cash')
  const [lastSale, setLastSale] = useState(null)
  const [discount, setDiscount] = useState('')
  const [discountType, setDiscountType] = useState('pct') // 'pct' | 'fixed'
  const [sessionHistory, setSessionHistory] = useState([])
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [pendingCount, setPendingCount] = useState(
    () => JSON.parse(localStorage.getItem(OFFLINE_KEY) || '[]').length
  )
  const [mobileTab, setMobileTab] = useState('products') // 'products' | 'cart'
  const searchRef = useRef()

  // Detectar conexión
  useEffect(() => {
    const on  = () => setIsOnline(true)
    const off = () => setIsOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  // Sync offline al reconectar
  useEffect(() => {
    if (!isOnline) return
    syncOfflineSales(
      (data) => posApi.checkout(data),
      (n) => {
        show(`✅ ${n} venta${n > 1 ? 's' : ''} sincronizada${n > 1 ? 's' : ''} al reconectar`, 'success')
        setPendingCount(0)
        posApi.products().then(setProducts)
      }
    )
  }, [isOnline])

  // Carga inicial
  useEffect(() => {
    posApi.products().then(setProducts)
    posApi.topProducts().then(setTopProducts).catch(() => {})
    searchRef.current?.focus()
  }, [])

  // Búsqueda con debounce
  useEffect(() => {
    const t = setTimeout(() => {
      posApi.products(query || undefined).then(setProducts)
    }, 180)
    return () => clearTimeout(t)
  }, [query])

  // Refresh stock en carrito cada 20s
  useEffect(() => {
    if (cart.length === 0) return
    const t = setInterval(() => {
      posApi.products().then(fresh => {
        setProducts(fresh)
        setCart(prev => prev.map(ci => {
          const p = fresh.find(f => f.id === ci.productId)
          if (!p) return ci
          return p.stock < ci.quantity
            ? { ...ci, maxStock: Number(p.stock), quantity: Number(p.stock), subtotal: Number(p.stock) * ci.price }
            : { ...ci, maxStock: Number(p.stock) }
        }).filter(i => i.maxStock > 0))
      })
    }, 20_000)
    return () => clearInterval(t)
  }, [cart.length])

  const addToCart = useCallback((product) => {
    const stock = Number(product.stock)
    if (stock <= 0) { show(`${product.name} está agotado`, 'error'); return }
    setCart(prev => {
      const ex = prev.find(i => i.productId === product.id)
      if (ex) {
        if (ex.quantity >= stock) { show(`Solo quedan ${stock} de ${product.name}`, 'error'); return prev }
        const q = ex.quantity + 1
        return prev.map(i => i.productId === product.id ? { ...i, quantity: q, subtotal: q * i.price } : i)
      }
      return [...prev, {
        productId: product.id,
        name: product.name,
        price: Number(product.price),
        quantity: 1,
        subtotal: Number(product.price),
        maxStock: stock,
      }]
    })
  }, [show])

  const removeFromCart = (id) => setCart(prev => prev.filter(i => i.productId !== id))

  const updateQty = (id, qty) => {
    if (qty <= 0) { removeFromCart(id); return }
    setCart(prev => prev.map(i => {
      if (i.productId !== id) return i
      if (qty > i.maxStock) { show(`Solo quedan ${i.maxStock} de ${i.name}`, 'error'); return i }
      return { ...i, quantity: qty, subtotal: qty * i.price }
    }))
  }

  const subtotalRaw = cart.reduce((s, i) => s + i.subtotal, 0)
  const discVal = parseFloat(discount) || 0
  const discountAmount = discountType === 'pct'
    ? subtotalRaw * (discVal / 100)
    : Math.min(discVal, subtotalRaw)
  const total = Math.max(0, subtotalRaw - discountAmount)
  const change = cashReceived ? parseFloat(cashReceived) - total : 0

  const doCheckout = async (offlineFallback = false) => {
    const payload = {
      branchId: user.branchId,
      items: cart.map(i => ({ productId: i.productId, quantity: i.quantity })),
      paymentMethod: payMethod,
      cashReceived: payMethod === 'cash' && cashReceived ? parseFloat(cashReceived) : undefined,
    }

    if (offlineFallback) {
      saveOfflineSale(payload)
      setPendingCount(c => c + 1)
      const saleEntry = { saleId: null, items: cart, discountAmount, total, change, time: new Date(), offline: true }
      setLastSale(saleEntry)
      setSessionHistory(prev => [saleEntry, ...prev].slice(0, 20))
      setCart([]); setCashReceived(''); setDiscount('')
      show('📴 Sin internet — venta guardada localmente', 'warning')
      return
    }

    const res = await posApi.checkout(payload)
    const saleEntry = { ...res, items: cart, discountAmount, total, change: res.change, time: new Date() }
    setLastSale(saleEntry)
    setSessionHistory(prev => [saleEntry, ...prev].slice(0, 20))
    setCart([]); setCashReceived(''); setDiscount('')
    posApi.products().then(setProducts)
    posApi.topProducts().then(setTopProducts).catch(() => {})
  }

  const checkout = async () => {
    if (cart.length === 0) { show('El carrito está vacío', 'error'); return }
    if (payMethod === 'cash' && cashReceived && change < 0) { show('Efectivo insuficiente', 'error'); return }
    setLoading(true)
    try {
      if (!isOnline) { await doCheckout(true); return }
      await doCheckout(false)
    } catch (err) {
      if (!navigator.onLine) {
        await doCheckout(true)
      } else {
        show(err?.response?.data?.error || err?.message || 'Error al procesar venta', 'error')
      }
    } finally { setLoading(false) }
  }

  const esc = (s) => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')

  const printTicket = (sale) => {
    const itemLines = sale.items.map(i =>
      `<div class="tl"><span>${esc(i.name)} x${i.quantity}</span><span>${fmt(i.subtotal)}</span></div>`
    ).join('')
    const discLine = sale.discountAmount > 0
      ? `<div class="tl" style="color:#059669"><span>Descuento</span><span>-${fmt(sale.discountAmount)}</span></div>` : ''
    const changeLine = (sale.change || 0) > 0
      ? `<div class="tl" style="color:#065f46;font-weight:bold"><span>Cambio</span><span>${fmt(sale.change)}</span></div>` : ''
    const w = window.open('', '_blank', 'width=380,height=600')
    if (!w) { show('El navegador bloqueó la ventana emergente. Permite popups para imprimir.', 'error'); return }
    w.document.write(`<html><head><title>Ticket</title><style>
      body{font-family:'Courier New',monospace;font-size:13px;padding:20px;max-width:320px;margin:0 auto}
      h2{text-align:center;font-size:16px;border-bottom:2px dashed #000;padding-bottom:8px;margin-bottom:12px}
      .tl{display:flex;justify-content:space-between;padding:3px 0}
      .tot{font-size:18px;font-weight:bold;border-top:2px dashed #000;padding-top:8px;margin-top:8px}
      .ft{text-align:center;margin-top:16px;font-size:11px;border-top:1px dashed #ccc;padding-top:8px;color:#555}
    </style></head><body>
      <h2>${esc(user.businessName) || 'AutoBusiness'}</h2>
      <div style="text-align:center;margin-bottom:10px;color:#555;font-size:11px">${new Date().toLocaleString('es-MX')}</div>
      ${itemLines}${discLine}
      <div class="tl tot"><span>TOTAL</span><span>${fmt(sale.total)}</span></div>
      ${changeLine}
      <div class="ft">¡Gracias por su compra!</div>
    </body></html>`)
    w.document.close(); w.print()
  }

  // Vista de comprobante
  if (lastSale) return (
    <div className="pos-ticket">
      <div className="ticket-card card">
        <div className="ticket-icon">{lastSale.offline ? '📴' : '✅'}</div>
        <h2>{lastSale.offline ? 'Guardado sin conexión' : 'Venta completada'}</h2>
        <div className="ticket-total">{fmt(lastSale.total)}</div>
        {lastSale.change > 0 && (
          <div className="ticket-change">
            <span>Cambio:</span><strong>{fmt(lastSale.change)}</strong>
          </div>
        )}
        <div className="divider" />
        {lastSale.items.map((i, idx) => (
          <div key={idx} className="ticket-item">
            <span>{i.name} x{i.quantity}</span>
            <span>{fmt(i.subtotal)}</span>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          {!lastSale.offline && (
            <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => printTicket(lastSale)}>
              🖨️ Imprimir
            </button>
          )}
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setLastSale(null)}>
            Nueva venta
          </button>
        </div>
      </div>
    </div>
  )

  const displayProducts = query ? products : (topProducts.length > 0 ? topProducts : products)
  const showingTop = !query && topProducts.length > 0

  const productPanel = (
    <div className="pos-products">
      <div className="pos-search">
        <input
          ref={searchRef}
          className="input pos-search-input"
          placeholder="🔍 Buscar por nombre, SKU o código..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          autoComplete="off"
        />
        {query && (
          <button className="pos-search-clear" onClick={() => setQuery('')}>✕</button>
        )}
      </div>

      {showingTop && <div className="pos-section-label">⚡ Más vendidos esta semana</div>}
      {!query && !showingTop && <div className="pos-section-label">📦 Todos los productos</div>}
      {query && <div className="pos-section-label">Resultados para "{query}"</div>}

      <div className="products-grid">
        {displayProducts.length === 0 && (
          <div className="pos-no-results">Sin resultados para "{query}"</div>
        )}
        {displayProducts.map(p => {
          const stock = Number(p.stock)
          const agotado = stock <= 0
          return (
            <button
              key={p.id}
              className={`product-card${agotado ? ' out-of-stock' : ''}`}
              onClick={() => { if (!agotado) { addToCart(p); setMobileTab('cart') } }}
              disabled={agotado}
              title={agotado ? 'Sin stock' : `${stock} disponibles`}
            >
              <div className="product-thumb">
                {p.imageUrl
                  ? <img src={p.imageUrl} alt={p.name} />
                  : <span className="product-thumb-placeholder">📦</span>}
              </div>
              <div className="product-info">
                <div className="product-name">{p.name}</div>
                <div className="product-price">{fmt(p.price)}</div>
                <div className={`product-stock${stock <= (p.minStock || 5) && !agotado ? ' low' : ''}`}>
                  {agotado ? 'Agotado' : stock <= (p.minStock || 5) ? `⚠ ${stock}` : `${stock} disp.`}
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {showingTop && products.length > topProducts.length && (
        <button className="pos-show-all" onClick={() => setQuery(' ')}>
          Ver todos los productos ({products.length}) →
        </button>
      )}
    </div>
  )

  const cartPanel = (
    <div className="pos-cart">
      <div className="pos-cart-header">
        <h2>Carrito {cart.length > 0 && <span className="cart-count">{cart.length}</span>}</h2>
        {cart.length > 0 && (
          <button className="btn btn-sm btn-outline" onClick={() => setCart([])}>Vaciar</button>
        )}
      </div>

      {cart.length === 0 ? (
        <div className="cart-empty">
          <span>🛒</span>
          <p>Toca un producto para agregar</p>
        </div>
      ) : (
        <>
          <div className="cart-items">
            {cart.map(item => (
              <div key={item.productId} className="cart-item">
                <div className="cart-item-name">{item.name}</div>
                <div className="cart-item-controls">
                  <button className="qty-btn" onClick={() => updateQty(item.productId, item.quantity - 1)}>−</button>
                  <span className="qty-value">{item.quantity}</span>
                  <button
                    className="qty-btn"
                    onClick={() => updateQty(item.productId, item.quantity + 1)}
                    disabled={item.quantity >= item.maxStock}
                  >+</button>
                  <span className="cart-item-price">{fmt(item.subtotal)}</span>
                  <button className="cart-remove" onClick={() => removeFromCart(item.productId)}>×</button>
                </div>
                {item.quantity >= item.maxStock && (
                  <div className="cart-stock-warn">Máximo: {item.maxStock}</div>
                )}
              </div>
            ))}
          </div>

          <div className="cart-total-section">
            <div className="pay-methods">
              {PAY_METHODS.map(m => (
                <button
                  key={m.id}
                  className={`pay-method-btn${payMethod === m.id ? ' active' : ''}`}
                  onClick={() => setPayMethod(m.id)}
                >
                  <span>{m.icon}</span>
                  <span>{m.label}</span>
                </button>
              ))}
            </div>

            <div className="discount-row">
              <div className="discount-type">
                <button
                  className={`disc-type-btn${discountType === 'pct' ? ' active' : ''}`}
                  onClick={() => setDiscountType('pct')}
                >%</button>
                <button
                  className={`disc-type-btn${discountType === 'fixed' ? ' active' : ''}`}
                  onClick={() => setDiscountType('fixed')}
                >$</button>
              </div>
              <input
                className="input discount-input"
                type="number"
                placeholder={discountType === 'pct' ? 'Descuento %' : 'Descuento $'}
                value={discount}
                onChange={e => setDiscount(e.target.value)}
                min="0"
                max={discountType === 'pct' ? 100 : subtotalRaw}
                step="1"
              />
              {discount && (
                <button className="disc-clear" onClick={() => setDiscount('')}>✕</button>
              )}
            </div>

            {discountAmount > 0 && (
              <div className="cart-total-row" style={{ color: '#059669', fontSize: 13, marginBottom: 4 }}>
                <span>Descuento</span><span>−{fmt(discountAmount)}</span>
              </div>
            )}

            <div className="cart-total-row">
              <span>Total</span>
              <strong className="cart-total-amount">{fmt(total)}</strong>
            </div>

            {payMethod === 'cash' && (
              <>
                <div className="input-group" style={{ marginBottom: 8 }}>
                  <label>Efectivo recibido</label>
                  <input
                    className="input"
                    type="number"
                    placeholder="0.00"
                    value={cashReceived}
                    onChange={e => setCashReceived(e.target.value)}
                    step="0.50"
                  />
                </div>
                {cashReceived && change >= 0 && (
                  <div className="cart-change positive">Cambio: <strong>{fmt(change)}</strong></div>
                )}
                {cashReceived && change < 0 && (
                  <div className="cart-change negative">Faltan: <strong>{fmt(Math.abs(change))}</strong></div>
                )}
              </>
            )}

            <button
              className="btn btn-primary btn-lg"
              style={{ width: '100%', marginTop: 8 }}
              onClick={checkout}
              disabled={loading || (payMethod === 'cash' && cashReceived && change < 0)}
            >
              {loading ? <div className="spinner" /> : `${isOnline ? '💳' : '📴'} Cobrar ${fmt(total)}`}
            </button>
          </div>
        </>
      )}
    </div>
  )

  return (
    <div className="pos-page">
      {!isOnline && (
        <div className="pos-offline-bar">
          📴 Sin conexión — las ventas se guardarán localmente y sincronizarán al reconectar
        </div>
      )}
      {isOnline && pendingCount > 0 && (
        <div className="pos-sync-bar">
          🔄 Sincronizando {pendingCount} venta{pendingCount > 1 ? 's' : ''} offline…
        </div>
      )}

      {/* Mobile tab bar */}
      <div className="pos-mobile-tabs">
        <button
          className={`pos-tab${mobileTab === 'products' ? ' active' : ''}`}
          onClick={() => setMobileTab('products')}
        >
          📦 Productos
        </button>
        <button
          className={`pos-tab${mobileTab === 'cart' ? ' active' : ''}`}
          onClick={() => setMobileTab('cart')}
        >
          🛒 Carrito
          {cart.length > 0 && <span className="cart-count">{cart.length}</span>}
        </button>
      </div>

      {/* Desktop: side by side. Mobile: tab panels */}
      <div className="pos-row">
        <div className={`pos-panel${mobileTab === 'products' ? ' pos-panel--active' : ''}`}>
          {productPanel}
        </div>
        <div className={`pos-panel pos-cart-panel${mobileTab === 'cart' ? ' pos-panel--active' : ''}`}>
          {cartPanel}
        </div>
      </div>

      {sessionHistory.length > 0 && (
        <div className="pos-history">
          <div className="pos-history-title">Ventas esta sesión ({sessionHistory.length})</div>
          <div className="pos-history-list">
            {sessionHistory.map((s, i) => (
              <div key={i} className="history-row">
                <span className="text-soft" style={{ fontSize: 11 }}>
                  {s.offline ? '📴' : '✓'} {s.time.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {s.items?.map(it => it.name).join(', ')}
                </span>
                <strong style={{ fontSize: 12, flexShrink: 0 }}>{fmt(s.total)}</strong>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
