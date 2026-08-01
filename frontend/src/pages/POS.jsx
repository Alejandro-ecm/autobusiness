import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { pos as posApi, printJobs as printJobsApi } from '../api'
import { useAuth } from '../store/AuthContext'
import { useToast } from '../store/ToastContext'
import { buildEscposTicket } from '../utils/escposTicket'
import { bluetoothSupported, bluetoothConnected, bluetoothPrint } from '../utils/bluetoothPrinter'
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
            <p style={{ margin: 0, fontSize: 13, color: '#1e293b' }}>Total a cobrar: {fmt(amount)}</p>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div style={{ padding: '0 8px 8px' }}>
          {!BrickComponent ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <div className="spinner" style={{ margin: '0 auto 12px' }} />
              <p style={{ color: '#1e293b' }}>Cargando métodos de pago...</p>
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

const PAY_LABELS = { cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transferencia' }

// Datos del ticket en el formato que entienden el Print Bridge y el
// generador ESC/POS de Bluetooth
function buildTicketData(sale, user) {
  return {
    business: user.businessName || 'AutoBusiness',
    folio: sale.saleId ? String(sale.saleId).replace(/-/g, '').slice(0, 8).toUpperCase() : 'PENDIENTE',
    date: (sale.time instanceof Date ? sale.time : new Date()).toLocaleString('es-MX', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    }),
    cashier: user.name || '',
    payMethod: PAY_LABELS[sale.payMethod] || 'Efectivo',
    offline: !!sale.offline,
    items: sale.items.map(i => ({ name: i.name, quantity: i.quantity, price: i.price, subtotal: i.subtotal })),
    subtotal: sale.items.reduce((s, i) => s + i.subtotal, 0),
    discountAmount: sale.discountAmount || 0,
    total: sale.total,
    received: sale.received || 0,
    change: sale.change || 0,
  }
}

// Print Bridge local: imprime en térmica ESC/POS sin diálogo del navegador.
// Si el bridge no corre en esta PC, devuelve false y el caller usa el fallback.
const PRINT_BRIDGE_URL = 'http://localhost:17891'

async function printViaBridge(sale, user) {
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 2500)
    const res = await fetch(`${PRINT_BRIDGE_URL}/print`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify(buildTicketData(sale, user)),
    })
    clearTimeout(timer)
    return res.ok && (await res.json()).ok === true
  } catch {
    return false
  }
}

// Cola en la nube: encola el ticket para que lo imprima el Print Bridge de la
// PC o la Estación de Impresión (/impresora) del negocio. Devuelve true solo
// si hay un dispositivo de impresión activo que lo va a imprimir.
async function printViaCloud(sale, user) {
  if (!navigator.onLine) return false
  try {
    const res = await printJobsApi.create(buildTicketData(sale, user))
    return res?.willPrint === true
  } catch {
    return false
  }
}

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
  const [addedFlash, setAddedFlash] = useState(null) // overlay grande "producto agregado"
  const addedFlashTimer = useRef(null)
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

  const triggerAddedFlash = useCallback((product) => {
    clearTimeout(addedFlashTimer.current)
    // key nueva por cada add → reinicia la animación CSS aunque sea el mismo producto
    setAddedFlash({ product, key: Date.now() })
    addedFlashTimer.current = setTimeout(() => setAddedFlash(null), 1400)
    // Confeti desde el centro y ambas esquinas inferiores
    import('canvas-confetti').then(({ default: confetti }) => {
      const opts = { zIndex: 2100, disableForReducedMotion: true }
      confetti({ ...opts, particleCount: 90, spread: 75, startVelocity: 48, origin: { x: 0.5, y: 0.55 } })
      confetti({ ...opts, particleCount: 45, angle: 60, spread: 60, origin: { x: 0, y: 0.8 } })
      confetti({ ...opts, particleCount: 45, angle: 120, spread: 60, origin: { x: 1, y: 0.8 } })
    }).catch(() => {})
  }, [])

  useEffect(() => () => clearTimeout(addedFlashTimer.current), [])

  const addToCart = useCallback((product) => {
    const stock = Number(product.stock)
    if (stock <= 0) { show(`${product.name} está agotado`, 'error'); return }
    const ex = cart.find(i => i.productId === product.id)
    if (ex && ex.quantity >= stock) { show(`Solo quedan ${stock} de ${product.name}`, 'error'); return }
    setCart(prev => {
      const cur = prev.find(i => i.productId === product.id)
      if (cur) {
        if (cur.quantity >= stock) return prev
        const q = cur.quantity + 1
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
    triggerAddedFlash(product)
  }, [cart, show, triggerAddedFlash])

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
      const saleEntry = {
        saleId: null, items: cart, discountAmount, total, change, time: new Date(), offline: true,
        payMethod,
        received: payMethod === 'cash' && cashReceived ? parseFloat(cashReceived) : undefined,
      }
      setLastSale(saleEntry)
      setSessionHistory(prev => [saleEntry, ...prev].slice(0, 20))
      setCart([]); setCashReceived(''); setDiscount('')
      show('📴 Sin internet — venta guardada localmente', 'warning')
      autoPrint(saleEntry)
      return
    }

    const res = await posApi.checkout(payload)
    const saleEntry = {
      ...res, items: cart, discountAmount, total, change: res.change, time: new Date(),
      payMethod,
      received: payMethod === 'cash' && cashReceived ? parseFloat(cashReceived) : undefined,
    }
    setLastSale(saleEntry)
    setSessionHistory(prev => [saleEntry, ...prev].slice(0, 20))
    setCart([]); setCashReceived(''); setDiscount('')
    posApi.products().then(setProducts)
    posApi.topProducts().then(setTopProducts).catch(() => {})
    autoPrint(saleEntry)
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
    autoPrint(saleEntry)
  }

  const checkout = async () => {
    if (cart.length === 0) { show('El carrito está vacío', 'error'); return }
    if (payMethod === 'cash' && !cashReceived) { show('Escribe el efectivo recibido para cobrar', 'error'); return }
    if (payMethod === 'cash' && change < 0) { show('Efectivo insuficiente', 'error'); return }

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

  // HTML del ticket — el mismo para la vista previa y para imprimir
  const buildTicketHtml = (sale) => {
    const folio = sale.saleId ? String(sale.saleId).replace(/-/g, '').slice(0, 8).toUpperCase() : 'PENDIENTE'
    const fecha = (sale.time instanceof Date ? sale.time : new Date()).toLocaleString('es-MX', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    })
    const subtotal = sale.items.reduce((s, i) => s + i.subtotal, 0)
    const piezas = sale.items.reduce((s, i) => s + Number(i.quantity), 0)

    const rows = sale.items.map(i => `
      <tr>
        <td class="qty">${i.quantity}</td>
        <td>${esc(i.name)}${i.quantity > 1 ? `<div class="unit">${fmt(i.price)} c/u</div>` : ''}</td>
        <td class="amt">${fmt(i.subtotal)}</td>
      </tr>`).join('')

    return `<html><head><title>Ticket</title><meta charset="utf-8"><style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: 'Courier New', ui-monospace, monospace; font-size: 12px; color: #000;
             width: 300px; margin: 0 auto; padding: 16px 12px; background: #fff; }
      .center { text-align: center; }
      .biz { font-size: 17px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; }
      .tagline { font-size: 10px; color: #333; margin-top: 3px; }
      .sep   { border-top: 1px dashed #000; margin: 9px 0; }
      .meta { font-size: 11px; line-height: 1.7; }
      .meta-row { display: flex; justify-content: space-between; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; }
      thead th { font-size: 10px; text-align: left; letter-spacing: .5px;
                 border-bottom: 1px solid #000; padding: 3px 0; }
      th.amt, td.amt { text-align: right; white-space: nowrap; }
      td { padding: 4px 0; vertical-align: top; }
      td.qty { width: 28px; font-weight: 700; }
      .unit { font-size: 10px; color: #444; }
      .tot-row { display: flex; justify-content: space-between; font-size: 12px; padding: 2px 0; }
      .grand { font-size: 17px; font-weight: 800; border-top: 2px solid #000;
               border-bottom: 2px solid #000; padding: 7px 0; margin: 7px 0; }
      .foot { font-size: 10.5px; color: #111; margin-top: 12px; line-height: 1.8; }
      .foot .thanks { font-size: 12px; font-weight: 700; }
      @media print { body { width: auto; } }
    </style></head><body>
      <div class="center">
        <div class="biz">${esc(user.businessName) || 'AutoBusiness'}</div>
      </div>
      <div class="sep"></div>
      <div class="meta">
        <div class="meta-row"><span>Folio: <b>${folio}</b></span><span>${fecha}</span></div>
        ${user.name ? `<div>Le atendió: ${esc(user.name)}</div>` : ''}
        <div>Forma de pago: ${PAY_LABELS[sale.payMethod] || 'Efectivo'}${sale.offline ? ' (offline)' : ''}</div>
      </div>
      <div class="sep"></div>
      <table>
        <thead><tr><th>CANT</th><th>DESCRIPCIÓN</th><th class="amt">IMPORTE</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="sep"></div>
      <div class="tot-row"><span>Artículos: ${piezas}</span><span></span></div>
      <div class="tot-row"><span>Subtotal</span><span>${fmt(subtotal)}</span></div>
      ${sale.discountAmount > 0 ? `<div class="tot-row"><span>Descuento</span><span>-${fmt(sale.discountAmount)}</span></div>` : ''}
      <div class="tot-row grand"><span>TOTAL</span><span>${fmt(sale.total)}</span></div>
      ${sale.received ? `<div class="tot-row"><span>Efectivo recibido</span><span>${fmt(sale.received)}</span></div>` : ''}
      ${(sale.change || 0) > 0 ? `<div class="tot-row" style="font-weight:700"><span>Su cambio</span><span>${fmt(sale.change)}</span></div>` : ''}
      <div class="foot center">
        <div class="thanks">★ ¡Gracias por su compra! ★</div>
        <div>Te esperamos pronto</div>
        <div style="margin-top:6px;color:#666">— Ticket generado por AutoBusiness AI —</div>
      </div>
    </body></html>`
  }

  const printTicket = async (sale) => {
    // 1) Print Bridge local (PC con térmica USB, sin diálogo)
    if (await printViaBridge(sale, user)) { show('🖨️ Ticket impreso', 'success'); return }

    // 2) Bluetooth (Android/Chrome): si ya hay impresora conectada, o en
    //    celular donde el diálogo de imprimir del navegador no sirve de nada
    const isAndroid = /android/i.test(navigator.userAgent)
    if (bluetoothSupported() && (bluetoothConnected() || isAndroid)) {
      try {
        await bluetoothPrint(buildEscposTicket(buildTicketData(sale, user)))
        show('🖨️ Ticket impreso por Bluetooth', 'success')
        return
      } catch (err) {
        if (err?.name === 'NotFoundError') return // el usuario cerró el selector
        show(err?.message || 'No se pudo imprimir por Bluetooth', 'error')
        if (isAndroid) return // en Android el diálogo del navegador no imprime tickets
      }
    }

    // 3) Cola en la nube: la imprime el Print Bridge de la PC o la Estación
    //    de Impresión del negocio (así imprimen los iPhone)
    if (await printViaCloud(sale, user)) { show('🖨️ Ticket enviado a la impresora del negocio', 'success'); return }

    // 4) Fallback: diálogo de impresión del navegador
    const w = window.open('', '_blank', 'width=380,height=600')
    if (!w) { show('El navegador bloqueó la ventana emergente. Permite popups para imprimir.', 'error'); return }
    w.document.write(buildTicketHtml(sale))
    w.document.close(); w.print()
  }

  // Impresión automática al cobrar — solo por vías silenciosas: bridge de la
  // PC, Bluetooth ya conectado, o la cola en la nube si hay quién la imprima
  const autoPrint = async (saleEntry) => {
    if (await printViaBridge(saleEntry, user)) { show('🖨️ Ticket impreso', 'success'); return }
    if (bluetoothConnected()) {
      try {
        await bluetoothPrint(buildEscposTicket(buildTicketData(saleEntry, user)))
        show('🖨️ Ticket impreso por Bluetooth', 'success')
        return
      } catch { /* el cajero puede reintentar con el botón Imprimir */ }
    }
    if (await printViaCloud(saleEntry, user)) show('🖨️ Ticket enviado a la impresora del negocio', 'success')
  }

  // ── Hooks de catálogo — SIEMPRE antes del return temprano del comprobante,
  //    o React truena por "fewer hooks than expected" al completar una venta ──

  // Pasarela: top 15 más vendidos en orden (mayor → menor ventas), de izquierda a derecha
  const topRow = useMemo(() => {
    if (topProducts.length === 0) return []
    const byId = new Map(products.map(p => [p.id, p]))
    return topProducts.map(t => byId.get(t.id)).filter(Boolean).slice(0, 15)
  }, [products, topProducts])

  // Ranking 1–15 por producto: el badge no depende de la posición en la pista repetida
  const rankById = useMemo(() => new Map(topRow.map((p, i) => [p.id, i + 1])), [topRow])

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

  // Vista de comprobante — con vista previa del ticket tal como se imprime
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

        <div className="ticket-preview">
          <iframe title="Vista previa del ticket" srcDoc={buildTicketHtml(lastSale)} />
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => printTicket(lastSale)}>
            🖨️ Imprimir
          </button>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setLastSale(null)}>
            Nueva venta
          </button>
        </div>
      </div>
    </div>
  )

  const renderCard = (p, key, rank) => {
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
          {rank && <span className="product-rank">{rank}</span>}
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
              {[...carouselItems, ...carouselItems].map((p, i) => renderCard(p, `${p.id}-${i}`, rankById.get(p.id)))}
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
              disabled={loading || (payMethod === 'cash' && (!cashReceived || change < 0))}
              title={payMethod === 'cash' && !cashReceived ? 'Escribe el efectivo recibido para cobrar' : undefined}
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
      {/* Animación pantalla completa al agregar producto */}
      {addedFlash && (
        <div key={addedFlash.key} className="added-flash-overlay">
          <div className="added-flash-card">
            <div className="added-flash-img">
              {addedFlash.product.imageUrl
                ? <img src={addedFlash.product.imageUrl} alt={addedFlash.product.name} />
                : <span className="added-flash-placeholder">📦</span>}
            </div>
            <div className="added-flash-check">✓</div>
            <div className="added-flash-name">{addedFlash.product.name}</div>
            <div className="added-flash-msg">¡Producto agregado con éxito!</div>
          </div>
        </div>
      )}
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
              <p style={{ color: '#1e293b', fontSize: 13, marginBottom: 16 }}>
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
