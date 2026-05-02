import { useState, useEffect, useRef, useCallback } from 'react'
import { pos as posApi } from '../api'
import { useAuth } from '../store/AuthContext'
import { useToast } from '../store/ToastContext'
import './POS.css'

const fmt = (n) => `$${Number(n || 0).toFixed(2)}`

export default function POS() {
  const { user } = useAuth()
  const { show } = useToast()
  const [products, setProducts] = useState([])
  const [cart, setCart] = useState([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [cashReceived, setCashReceived] = useState('')
  const [lastSale, setLastSale] = useState(null)
  const [discount, setDiscount] = useState('')
  const [sessionHistory, setSessionHistory] = useState([])
  const searchRef = useRef()

  // Carga inicial
  useEffect(() => {
    posApi.products().then(setProducts)
    searchRef.current?.focus()
  }, [])

  // Búsqueda con debounce 200ms
  useEffect(() => {
    const t = setTimeout(() => {
      posApi.products(query).then(setProducts)
    }, 200)
    return () => clearTimeout(t)
  }, [query])

  // Refrescar stock de productos en carrito cada 15s para evitar vender de más
  useEffect(() => {
    if (cart.length === 0) return
    const t = setInterval(() => {
      posApi.products().then(fresh => {
        setProducts(fresh)
        // Ajustar maxStock en carrito sin perder cantidades ya ingresadas
        setCart(prev => prev.map(cartItem => {
          const freshProduct = fresh.find(p => p.id === cartItem.productId)
          if (!freshProduct) return cartItem
          const newMax = freshProduct.stock
          return newMax < cartItem.quantity
            ? { ...cartItem, maxStock: newMax, quantity: newMax, subtotal: newMax * cartItem.price }
            : { ...cartItem, maxStock: newMax }
        }).filter(i => i.maxStock > 0))
      })
    }, 15_000)
    return () => clearInterval(t)
  }, [cart.length])

  const addToCart = useCallback((product) => {
    if (product.stock === 0) {
      show(`${product.name} está agotado`, 'error')
      return
    }
    setCart(prev => {
      const existing = prev.find(i => i.productId === product.id)
      if (existing) {
        if (existing.quantity >= product.stock) {
          show(`Solo quedan ${product.stock} unidades de ${product.name}`, 'error')
          return prev
        }
        const newQty = existing.quantity + 1
        return prev.map(i => i.productId === product.id
          ? { ...i, quantity: newQty, subtotal: newQty * i.price }
          : i)
      }
      return [...prev, {
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity: 1,
        subtotal: product.price,
        maxStock: product.stock,
      }]
    })
  }, [show])

  const removeFromCart = (productId) => setCart(prev => prev.filter(i => i.productId !== productId))

  const updateQty = (productId, qty) => {
    if (qty <= 0) { removeFromCart(productId); return }
    setCart(prev => prev.map(i => {
      if (i.productId !== productId) return i
      if (qty > i.maxStock) {
        show(`Solo quedan ${i.maxStock} unidades de ${i.name}`, 'error')
        return i
      }
      return { ...i, quantity: qty, subtotal: qty * i.price }
    }))
  }

  const subtotalBeforeDiscount = cart.reduce((s, i) => s + i.subtotal, 0)
  const discountPct = parseFloat(discount) || 0
  const discountAmount = subtotalBeforeDiscount * (discountPct / 100)
  const total = subtotalBeforeDiscount - discountAmount
  const change = cashReceived ? parseFloat(cashReceived) - total : 0

  const checkout = async () => {
    if (cart.length === 0) { show('El carrito está vacío', 'error'); return }
    setLoading(true)
    try {
      const res = await posApi.checkout({
        branchId: user.branchId,
        items: cart.map(i => ({ productId: i.productId, quantity: i.quantity })),
        paymentMethod: 'cash',
        cashReceived: cashReceived ? parseFloat(cashReceived) : undefined,
      })
      const saleEntry = { ...res, items: cart, discountPct, total, time: new Date() }
      setLastSale(saleEntry)
      setSessionHistory(prev => [saleEntry, ...prev].slice(0, 20))
      setCart([])
      setCashReceived('')
      setDiscount('')
      // Refrescar stock post-venta
      posApi.products().then(setProducts)
    } catch (err) {
      // El backend devuelve mensajes claros: "Solo quedan X unidades de..."
      show(err?.error || err?.message || 'Error al procesar venta', 'error')
    } finally { setLoading(false) }
  }

  const printTicket = (sale) => {
    const discLine = sale.discountPct > 0 ? `<div class="ticket-line"><span>Descuento ${sale.discountPct}%</span><span>-${fmt(sale.items.reduce((s,i)=>s+i.subtotal,0)*sale.discountPct/100)}</span></div>` : ''
    const itemLines = sale.items.map(i => `<div class="ticket-line"><span>${i.name} x${i.quantity}</span><span>${fmt(i.subtotal)}</span></div>`).join('')
    const changeLine = sale.change > 0 ? `<div class="ticket-line change"><span>Cambio</span><span>${fmt(sale.change)}</span></div>` : ''
    const w = window.open('', '_blank', 'width=380,height=600')
    w.document.write(`<html><head><title>Ticket</title><style>
      body { font-family: 'Courier New', monospace; font-size: 13px; padding: 20px; max-width: 320px; margin: 0 auto; }
      h2 { text-align: center; font-size: 16px; border-bottom: 2px dashed #000; padding-bottom: 8px; margin-bottom: 12px; }
      .ticket-line { display: flex; justify-content: space-between; padding: 3px 0; }
      .total { font-size: 18px; font-weight: bold; border-top: 2px dashed #000; padding-top: 8px; margin-top: 8px; }
      .change { color: #166534; font-weight: bold; }
      .footer { text-align: center; margin-top: 16px; font-size: 11px; border-top: 1px dashed #ccc; padding-top: 8px; color: #555; }
    </style></head><body>
      <h2>AutoBusiness AI</h2>
      <div style="text-align:center;margin-bottom:10px;color:#555;font-size:11px">${new Date().toLocaleString('es-MX')}</div>
      ${itemLines}${discLine}
      <div class="ticket-line total"><span>TOTAL</span><span>${fmt(sale.total)}</span></div>
      ${changeLine}
      <div class="footer">¡Gracias por su compra!</div>
    </body></html>`)
    w.document.close()
    w.print()
  }

  if (lastSale) return (
    <div className="pos-ticket">
      <div className="ticket-card card">
        <div className="ticket-icon">✅</div>
        <h2>Venta completada</h2>
        <div className="ticket-total">{fmt(lastSale.total)}</div>
        {lastSale.change > 0 && (
          <div className="ticket-change">
            <span>Cambio a dar:</span>
            <strong>{fmt(lastSale.change)}</strong>
          </div>
        )}
        <div className="divider" />
        {lastSale.items.map(i => (
          <div key={i.productId} className="ticket-item">
            <span>{i.name} x{i.quantity}</span>
            <span>{fmt(i.subtotal)}</span>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => printTicket(lastSale)}>
            🖨️ Imprimir ticket
          </button>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setLastSale(null)}>
            Nueva venta
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="pos-page">
      <div className="pos-row">
      <div className="pos-products">
        <div className="pos-search">
          <input
            ref={searchRef}
            className="input pos-search-input"
            placeholder="Buscar producto o SKU..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            autoComplete="off"
          />
        </div>
        <div className="products-grid">
          {products.map(p => (
            <button
              key={p.id}
              className={`product-card ${p.stock === 0 ? 'out-of-stock' : ''}`}
              onClick={() => addToCart(p)}
              title={p.stock === 0 ? 'Sin stock' : `${p.stock} disponibles`}
            >
              <div className="product-thumb">
                {p.imageUrl
                  ? <img src={p.imageUrl} alt={p.name} />
                  : <span className="product-thumb-placeholder">📦</span>}
              </div>
              <div className="product-info">
                <div className="product-name">{p.name}</div>
                <div className="product-price">{fmt(p.price)}</div>
                <div className={`product-stock ${p.stock <= p.minStock ? 'low' : ''}`}>
                  {p.stock === 0 ? 'Agotado' : p.stock <= p.minStock ? `⚠ ${p.stock} uds` : `${p.stock} disponibles`}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="pos-cart">
        <div className="pos-cart-header">
          <h2>Carrito</h2>
          {sessionHistory.length > 0 && (
            <span className="text-soft text-sm">{sessionHistory.length} venta{sessionHistory.length > 1 ? 's' : ''} hoy</span>
          )}
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
                    <div className="cart-stock-warn">Stock máximo: {item.maxStock} uds</div>
                  )}
                </div>
              ))}
            </div>

            <div className="cart-total-section">
              <div className="input-group" style={{ marginBottom: 8 }}>
                <label>Descuento (%)</label>
                <input
                  className="input"
                  type="number"
                  placeholder="0"
                  value={discount}
                  onChange={e => setDiscount(e.target.value)}
                  min="0" max="100" step="1"
                />
              </div>
              {discountPct > 0 && (
                <div className="cart-total-row" style={{ color: '#059669', fontSize: 13, marginBottom: 4 }}>
                  <span>Descuento {discountPct}%</span>
                  <span>−{fmt(discountAmount)}</span>
                </div>
              )}
              <div className="cart-total-row">
                <span>Total</span>
                <strong className="cart-total-amount">{fmt(total)}</strong>
              </div>
              <div className="input-group" style={{ marginBottom: 12 }}>
                <label>Efectivo recibido</label>
                <input
                  className="input"
                  type="number"
                  placeholder="0.00"
                  value={cashReceived}
                  onChange={e => setCashReceived(e.target.value)}
                  step="0.5"
                />
              </div>
              {cashReceived && change >= 0 && (
                <div className="cart-change positive">Cambio: <strong>{fmt(change)}</strong></div>
              )}
              {cashReceived && change < 0 && (
                <div className="cart-change negative">Faltan: <strong>{fmt(Math.abs(change))}</strong></div>
              )}
              <button
                className="btn btn-primary btn-lg"
                style={{ width: '100%' }}
                onClick={checkout}
                disabled={loading || (cashReceived && change < 0)}
              >
                {loading ? <div className="spinner" /> : `Cobrar ${fmt(total)}`}
              </button>
            </div>
          </>
        )}
      </div>
      </div>

      {/* Session history */}
      {sessionHistory.length > 0 && (
        <div className="pos-history">
          <div className="pos-history-title">Ventas esta sesión</div>
          <div className="pos-history-list">
            {sessionHistory.map((s, i) => (
              <div key={i} className="history-row">
                <span className="text-soft" style={{ fontSize: 11 }}>
                  {s.time.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
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
