import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { pos as posApi } from '../api'
import { useAuth } from '../store/AuthContext'
import { useToast } from '../store/ToastContext'
import './POS.css'

const fmt = (n) => `$${Number(n || 0).toFixed(2)}`
const OFFLINE_KEY = 'ab_offline_sales'

// ── Código de barras compacto, siempre visible en la tarjeta de producto ──
function CardBarcode({ code }) {
  const ref = useRef()
  useEffect(() => {
    if (!ref.current || !code) return
    import('jsbarcode').then(({ default: JsBarcode }) => {
      const svg = ref.current
      if (!svg) return
      try {
        // CODE128 siempre: acepta cualquier código y todas las tarjetas se ven uniformes
        JsBarcode(svg, String(code).trim(), {
          format:       'CODE128',
          width:        1.4,
          height:       30,
          displayValue: false,
          margin:       0,
        })
        // JsBarcode no pone viewBox: sin él, el SVG se recorta en vez de escalar
        const w = svg.getAttribute('width'), h = svg.getAttribute('height')
        if (w && h) {
          svg.setAttribute('viewBox', `0 0 ${parseFloat(w)} ${parseFloat(h)}`)
          svg.removeAttribute('width')
          svg.removeAttribute('height')
        }
      } catch { /* código vacío/inválido — no se dibuja */ }
    })
  }, [code])
  if (!code) return null
  return (
    <div className="product-barcode">
      <svg ref={ref} />
      <span className="product-barcode-num">{String(code).trim()}</span>
    </div>
  )
}

let mpPosInitialized = false
async function initMPPos(publicKey) {
  if (mpPosInitialized || !publicKey) return
  const { initMercadoPago } = await import('@mercadopago/sdk-react')
  initMercadoPago(publicKey, { locale: 'es-MX' })
  mpPosInitialized = true
}

function PosPaymentBrick({ amount, preferenceId, cartItems, branchId, onSuccess, onError, onClose }) {
  const [BrickComponent, setBrickComponent] = useState(null)

  useEffect(() => {
    import('@mercadopago/sdk-react').then(m => setBrickComponent(() => m.Payment))
  }, [])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box card" style={{ maxWidth: 540, width: '95%' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3>Pago con tarjeta</h3>
            <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>Total a cobrar: {fmt(amount)}</p>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div style={{ padding: '0 8px 8px' }}>
          {!BrickComponent ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <div className="spinner" style={{ margin: '0 auto 12px' }} />
              <p style={{ color: '#64748b' }}>Cargando métodos de pago...</p>
            </div>
          ) : (
            <BrickComponent
              initialization={{ amount, preferenceId }}
              customization={{
                paymentMethods: { creditCard: 'all', debitCard: 'all', mercadoPago: 'all' },
                visual: { style: { theme: 'default' } }
              }}
              onSubmit={async ({ formData }) => {
                try {
                  const result = await posApi.processCardPayment({
                    formData,
                    items: cartItems.map(i => ({ productId: i.productId, quantity: i.quantity })),
                    branchId,
                  })
                  if (result.status === 'approved') { onSuccess(result); return { status: 'approved' } }
                  if (result.status === 'pending' || result.status === 'in_process') {
                    onSuccess(result, 'pending'); return { status: 'pending' }
                  }
                  return { status: 'rejected' }
                } catch (err) {
                  onError(err?.error || err?.message || 'Error al procesar el pago')
                  return { status: 'rejected' }
                }
              }}
              onReady={() => {}}
              onError={() => onError('Error en el formulario de pago')}
            />
          )}
        </div>
      </div>
    </div>
  )
}

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
  const [payBrick, setPayBrick] = useState({ open: false, preferenceId: null, mpPublicKey: null, amount: 0 })
  const [cardConfirm, setCardConfirm] = useState(false)
  const [scanFlash, setScanFlash] = useState(null) // nombre del producto escaneado
  const searchRef = useRef()
  const productsRef = useRef([]) // ref para acceso sin stale closure en el listener global

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

  // Mantener productsRef sincronizado para el listener global
  useEffect(() => { productsRef.current = products }, [products])

  // Carga inicial
  useEffect(() => {
    posApi.products().then(data => { setProducts(data); productsRef.current = data })
    posApi.topProducts().then(setTopProducts).catch(() => {})
    searchRef.current?.focus()
  }, [])

  // Captura global de teclado — redirige al buscador aunque no tenga foco
  // Útil para lectores de barras hardware que "escriben" sin importar el foco
  useEffect(() => {
    const handleGlobalKey = (e) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return
      const tag = document.activeElement?.tagName
      const isEditable = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
      // Si no hay ningún campo activo y se presiona una tecla imprimible → llevar foco al buscador
      if (!isEditable && e.key.length === 1) {
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleGlobalKey)
    return () => window.removeEventListener('keydown', handleGlobalKey)
  }, [])

  // Búsqueda con debounce
  useEffect(() => {
    const t = setTimeout(() => {
      posApi.products(query || undefined).then(data => { setProducts(data); productsRef.current = data })
    }, 180)
    return () => clearTimeout(t)
  }, [query])

  // Beep de POS al escanear
  const beep = (freq = 1800, ms = 80) => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.frequency.value = freq; osc.type = 'sine'
      gain.gain.setValueAtTime(0.25, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + ms / 1000)
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + ms / 1000)
    } catch { /* sin audio disponible */ }
  }

  // Enter en el buscador → agregar producto por código de barras / SKU / único resultado
  const handleSearchEnter = (e) => {
    if (e.key !== 'Enter') return
    const q = query.trim()
    if (!q) return
    e.preventDefault()

    const all = productsRef.current
    // 1. Coincidencia exacta por código de barras o SKU
    const exact = all.find(p =>
      p.barcode?.toString() === q ||
      p.sku?.toLowerCase() === q.toLowerCase()
    )
    if (exact) {
      addToCart(exact)
      beep(1900, 70)
      if (navigator.vibrate) navigator.vibrate(30)
      setScanFlash(exact.name)
      setTimeout(() => setScanFlash(null), 1200)
      setQuery('')
      setMobileTab('cart')
      setTimeout(() => searchRef.current?.focus(), 80)
      return
    }
    // 2. Un solo resultado tras búsqueda — agregarlo directo
    const visible = products.filter(p => Number(p.stock) > 0)
    if (visible.length === 1) {
      addToCart(visible[0])
      beep(1600, 70)
      setScanFlash(visible[0].name)
      setTimeout(() => setScanFlash(null), 1200)
      setQuery('')
      setMobileTab('cart')
      setTimeout(() => searchRef.current?.focus(), 80)
    }
    // 3. Varios resultados → dejar el filtro activo para que el cajero elija
  }

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

  const handleCardPaymentSuccess = (result, status = 'approved') => {
    setPayBrick({ open: false, preferenceId: null, mpPublicKey: null, amount: 0 })
    const saleEntry = {
      saleId: result.saleId || null,
      items: cart,
      discountAmount,
      total,
      change: 0,
      time: new Date(),
      payMethod: 'card',
    }
    setLastSale(saleEntry)
    setSessionHistory(prev => [saleEntry, ...prev].slice(0, 20))
    setCart([]); setCashReceived(''); setDiscount('')
    posApi.products().then(setProducts)
    posApi.topProducts().then(setTopProducts).catch(() => {})
    show(status === 'approved' ? '💳 Pago con tarjeta aprobado' : '⏳ Pago pendiente de confirmación', status === 'approved' ? 'success' : 'warning')
  }

  const checkout = async () => {
    if (cart.length === 0) { show('El carrito está vacío', 'error'); return }
    if (payMethod === 'cash' && cashReceived && change < 0) { show('Efectivo insuficiente', 'error'); return }

    // Tarjeta → intentar Checkout Bricks si el negocio tiene MP conectado
    if (payMethod === 'card') {
      setLoading(true)
      try {
        const res = await posApi.createCardPayment({
          items: cart.map(i => ({ name: i.name, quantity: i.quantity, price: i.price })),
          total,
          branchId: user.branchId,
        })
        if (res.mpPublicKey) {
          await initMPPos(res.mpPublicKey)
          setPayBrick({ open: true, preferenceId: res.preferenceId, mpPublicKey: res.mpPublicKey, amount: total })
        } else {
          // Sin MP conectado → confirmación simple (terminal física)
          setCardConfirm(true)
        }
      } catch {
        // Fallback: confirmación simple
        setCardConfirm(true)
      } finally { setLoading(false) }
      return
    }


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

  // Pasarela: más vendidos en orden (mayor → menor ventas), de izquierda a derecha
  const topRow = useMemo(() => {
    if (topProducts.length === 0) return []
    const byId = new Map(products.map(p => [p.id, p]))
    return topProducts.map(t => byId.get(t.id)).filter(Boolean)
  }, [products, topProducts])

  // La animación hace loop con 2 copias idénticas: rellenar hasta tener pista suficiente
  const carouselItems = useMemo(() => {
    if (topRow.length === 0) return []
    const items = [...topRow]
    while (items.length < 6) items.push(...topRow)
    return items
  }, [topRow])

  // Grid: todos los productos en orden alfabético
  const displayProducts = useMemo(() => {
    if (query) return products
    return [...products].sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }))
  }, [query, products])
  const showCarousel = !query && carouselItems.length > 0

  const renderCard = (p, key) => {
    const stock = Number(p.stock)
    const agotado = stock <= 0
    return (
      <button
        key={key}
        className={`product-card${agotado ? ' out-of-stock' : ''}`}
        onClick={() => { if (!agotado) { addToCart(p); setMobileTab('cart'); setTimeout(() => searchRef.current?.focus(), 80) } }}
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
          <CardBarcode code={p.barcode} />
        </div>
      </button>
    )
  }

  const productPanel = (
    <div className="pos-products">
      {/* Flash de confirmación al escanear */}
      {scanFlash && (
        <div style={{
          position: 'fixed', top: 70, left: '50%', transform: 'translateX(-50%)',
          background: '#10b981', color: '#fff', padding: '10px 24px',
          borderRadius: 30, fontWeight: 700, fontSize: 15, zIndex: 999,
          boxShadow: '0 4px 20px rgba(16,185,129,0.4)', pointerEvents: 'none',
        }}>
          ✓ {scanFlash}
        </div>
      )}
      <div className="pos-search">
        <input
          ref={searchRef}
          className="input pos-search-input"
          placeholder="📷 Escanea o escribe nombre / código de barras..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleSearchEnter}
          autoComplete="off"
          autoFocus
        />
        {query && (
          <button className="pos-search-clear" onClick={() => { setQuery(''); searchRef.current?.focus() }}>✕</button>
        )}
      </div>

      {showCarousel && (
        <>
          <div className="pos-section-label">🔥 Más vendidos</div>
          <div className="pos-carousel">
            <div
              className="pos-carousel-track"
              style={{ animationDuration: `${carouselItems.length * 4}s` }}
            >
              {[...carouselItems, ...carouselItems].map((p, i) => renderCard(p, `${p.id}-${i}`))}
            </div>
          </div>
        </>
      )}

      {!query && <div className="pos-section-label">📦 Todos los productos · A–Z</div>}
      {query && <div className="pos-section-label">Resultados para "{query}"</div>}

      <div className="products-grid">
        {displayProducts.length === 0 && (
          <div className="pos-no-results">Sin resultados para "{query}"</div>
        )}
        {displayProducts.map(p => renderCard(p, p.id))}
      </div>

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

      {payBrick.open && (
        <PosPaymentBrick
          amount={payBrick.amount}
          preferenceId={payBrick.preferenceId}
          cartItems={cart}
          branchId={user.branchId}
          onSuccess={handleCardPaymentSuccess}
          onError={(msg) => { show(msg, 'error') }}
          onClose={() => setPayBrick({ open: false, preferenceId: null, mpPublicKey: null, amount: 0 })}
        />
      )}

      {cardConfirm && (
        <div className="modal-overlay" onClick={() => setCardConfirm(false)}>
          <div className="modal-box card" style={{ maxWidth: 400, width: '95%' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>💳 Pago con tarjeta</h3>
              <button className="modal-close" onClick={() => setCardConfirm(false)}>×</button>
            </div>
            <div style={{ padding: '8px 4px 4px', textAlign: 'center' }}>
              <div style={{ fontSize: 36, fontWeight: 800, color: '#1e293b', marginBottom: 4 }}>{fmt(total)}</div>
              <div style={{
                background: '#fffbeb', border: '1px solid #fde68a',
                borderRadius: 8, padding: '10px 14px', margin: '12px 0', textAlign: 'left'
              }}>
                <p style={{ margin: 0, color: '#92400e', fontSize: 13, lineHeight: 1.5 }}>
                  Para cobrar con tarjeta de forma digital (el cliente ingresa su número, CVV y fecha),
                  conecta tu cuenta de MercadoPago en{' '}
                  <a href="/settings/payments" style={{ color: '#b45309', fontWeight: 700 }}>
                    Configuración → Pagos
                  </a>.
                </p>
              </div>
              <p style={{ color: '#64748b', fontSize: 13, marginBottom: 16 }}>
                Por ahora puedes cobrar con tu terminal física y registrar el pago aquí.
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setCardConfirm(false)}>
                  Cancelar
                </button>
                <button
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                  disabled={loading}
                  onClick={async () => {
                    setCardConfirm(false)
                    setLoading(true)
                    try { await doCheckout(false) }
                    catch (err) { show(err?.error || err?.message || 'Error al registrar venta', 'error') }
                    finally { setLoading(false) }
                  }}
                >
                  {loading ? <div className="spinner" /> : '✓ Confirmar cobro'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
