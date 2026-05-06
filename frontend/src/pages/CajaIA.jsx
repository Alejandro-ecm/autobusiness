import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../store/AuthContext'
import { useToast } from '../store/ToastContext'
import { pos as posApi } from '../api'
import './CajaIA.css'

const API = import.meta.env.VITE_API_URL || '/api'

// COCO-SSD keyword → Spanish product keywords (fallback when no custom model)
const KEYWORD_MAP = {
  bottle:       ['agua', 'refresco', 'bebida', 'cerveza', 'jugo', 'botella', 'coca', 'pepsi', 'sprite', 'soda', 'leche', 'yogurt', 'vinagre', 'aceite', 'salsa'],
  cup:          ['café', 'té', 'atole', 'taza', 'vaso', 'malteada', 'champurrado'],
  banana:       ['plátano', 'banana'],
  apple:        ['manzana'],
  orange:       ['naranja', 'mandarina'],
  sandwich:     ['sándwich', 'torta', 'tostada', 'pan', 'baguette'],
  pizza:        ['pizza'],
  'hot dog':    ['hot dog', 'hotdog', 'salchicha', 'chorizo'],
  cake:         ['pastel', 'bizcocho', 'panqué', 'pay', 'tarta'],
  donut:        ['dona', 'donut', 'rosquilla'],
  carrot:       ['zanahoria'],
  broccoli:     ['brócoli'],
  bowl:         ['bowl', 'tazón', 'cereal', 'sopa'],
  book:         ['libro', 'cuaderno', 'libreta', 'revista', 'agenda'],
  backpack:     ['mochila', 'bolsa', 'morral'],
  scissors:     ['tijeras'],
  toothbrush:   ['cepillo', 'pasta dental'],
  remote:       ['control', 'remoto'],
  refrigerator: ['refrigerador', 'nevera'],
}

const fmt = (n) => `$${Number(n || 0).toFixed(2)}`

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)

function CameraDeniedHelp({ onRetry }) {
  const certUrl = `${window.location.protocol}//${window.location.hostname}:${window.location.port || (window.location.protocol === 'https:' ? '3443' : '3000')}/autobusiness-ca.crt`
  const siteUrl = `https://${window.location.hostname}:3443`

  return (
    <div className="caia-camera-placeholder caia-denied">
      <span>🚫</span>
      <p>Permiso de cámara denegado</p>
      {isIOS ? (
        <div className="caia-denied-steps">
          <strong>Paso 1 — Instalar certificado de confianza:</strong>
          <ol>
            <li>Abre Safari y ve a:<br /><a href={certUrl} className="caia-cert-link">{certUrl}</a></li>
            <li>iOS dirá <b>"Perfil descargado"</b> → ve a <b>Configuración</b></li>
            <li>Toca el banner <b>"Perfil descargado"</b> → <b>Instalar</b> → ingresa tu contraseña → <b>Instalar</b></li>
            <li>Ve a <b>Configuración → General → Información → Configuración de confianza de certificado</b></li>
            <li>Activa el interruptor junto a <b>AutoBusiness</b></li>
          </ol>
          <strong>Paso 2 — Permitir cámara en Safari:</strong>
          <ol>
            <li>Ve a <b>Configuración → Safari → Cámara</b></li>
            <li>Selecciona <b>Permitir</b></li>
            <li>Vuelve aquí y toca <b>Reintentar</b></li>
          </ol>
        </div>
      ) : (
        <div className="caia-denied-steps">
          <strong>En Android / Chrome:</strong>
          <ol>
            <li>Asegúrate de estar en <b>https://</b> (no http)</li>
            <li>Toca el 🔒 o ⚠️ en la barra de direcciones</li>
            <li>Toca <b>Permisos del sitio → Cámara → Permitir</b></li>
            <li>Recarga la página y toca <b>Reintentar</b></li>
          </ol>
          <hr />
          <small>Si sigue sin funcionar, descarga e instala el certificado:<br />
            <a href={certUrl} className="caia-cert-link">{certUrl}</a>
          </small>
        </div>
      )}
      <button className="caia-btn-primary" onClick={onRetry}>
        Reintentar cámara
      </button>
    </div>
  )
}

// IoU between two [x, y, w, h] bounding boxes
function iou(a, b) {
  const [ax, ay, aw, ah] = a; const [bx, by, bw, bh] = b
  const xi  = Math.max(ax, bx);         const yi  = Math.max(ay, by)
  const xi2 = Math.min(ax + aw, bx + bw); const yi2 = Math.min(ay + ah, by + bh)
  const inter = Math.max(0, xi2 - xi) * Math.max(0, yi2 - yi)
  return inter / (aw * ah + bw * bh - inter + 1e-6)
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return }
    const s = document.createElement('script')
    s.src = src; s.crossOrigin = 'anonymous'
    s.onload = resolve
    s.onerror = () => reject(new Error(`No se pudo cargar: ${src}`))
    document.head.appendChild(s)
  })
}

function roundRect(ctx, x, y, w, h, r = 4) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

export default function CajaIA() {
  const { user }  = useAuth()
  const { show }  = useToast()

  // ── Refs ──────────────────────────────────────────────────────────────────
  const videoRef       = useRef()
  const overlayRef     = useRef()
  const streamRef      = useRef()
  const modelRef       = useRef()           // COCO-SSD instance
  const barcodeRef     = useRef(null)       // native BarcodeDetector
  const timerRef       = useRef()
  const cooldownRef    = useRef({})         // key → lastTimestamp (ms)
  const recentDetsRef  = useRef([])         // [{class, bbox, time}] for IoU tracking
  const productsRef    = useRef([])
  const detModeRef     = useRef('none')     // 'none' | 'backend' | 'coco'
  const autoAddRef     = useRef(false)
  const scanModeRef    = useRef('both')     // 'both' | 'barcode' | 'ai'

  // ── State ─────────────────────────────────────────────────────────────────
  const [modelStatus,      setModelStatus]      = useState('idle')
  const [modelType,        setModelType]        = useState('coco')
  const [detMode,          setDetMode]          = useState('none')
  const [cameraStatus,     setCameraStatus]     = useState('idle')
  const [detections,       setDetections]       = useState([])
  const [products,         setProducts]         = useState([])
  const [cart,             setCart]             = useState([])
  const [autoAdd,          setAutoAdd]          = useState(false)
  const [scanMode,         setScanMode]         = useState('both')
  const [barcodeSupported, setBarcodeSupported] = useState(false)
  const [cashReceived,     setCashReceived]     = useState('')
  const [lastSale,         setLastSale]         = useState(null)
  const [loading,          setLoading]          = useState(false)
  const [productSearch,    setProductSearch]    = useState('')
  const [manualCode,       setManualCode]       = useState('')
  const [recentAdd,        setRecentAdd]        = useState(null)
  const [mobileTab,        setMobileTab]        = useState('camera')
  const [customerDisplay,  setCustomerDisplay]  = useState(false)
  const [payMethod,        setPayMethod]        = useState('cash')   // cash|card|transfer|mp
  const [discount,         setDiscount]         = useState({ type: 'percent', value: '' })
  const [showDiscount,     setShowDiscount]     = useState(false)
  const [showCorte,        setShowCorte]        = useState(false)
  const [corteData,        setCorteData]        = useState(null)
  const [weightPicker,     setWeightPicker]     = useState(null)  // {product, mode}
  const [weightInput,      setWeightInput]      = useState('')

  // Keep refs in sync with state
  useEffect(() => { autoAddRef.current = autoAdd }, [autoAdd])
  useEffect(() => { scanModeRef.current = scanMode }, [scanMode])

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    loadProducts()
    initDetection()
    return () => stopCamera()
  }, [])

  const loadProducts = () => {
    posApi.products().then(data => {
      setProducts(data)
      productsRef.current = data
    }).catch(() => show('No se pudieron cargar los productos', 'error'))
  }

  const initDetection = async () => {
    setModelStatus('loading')

    // 1. Init BarcodeDetector — native (Chrome/Android) or polyfill (iOS/Firefox)
    const BARCODE_FORMATS = ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'itf', 'qr_code']
    try {
      let Detector = window.BarcodeDetector
      if (!Detector) {
        // iOS Safari / Firefox: load WASM polyfill
        const mod = await import('@undecaf/barcode-detector-polyfill')
        Detector = mod.BarcodeDetectorPolyfill
      }
      barcodeRef.current = new Detector({ formats: BARCODE_FORMATS })
      setBarcodeSupported(true)
    } catch { /* barcode detection not available */ }

    // 2. Check if backend has a custom ONNX model
    try {
      const res  = await fetch('/ai-engine/detect-info')
      const info = await res.json()
      if (info.model_available) {
        detModeRef.current = 'backend'
        setDetMode('backend')
        setModelType('custom')
        setModelStatus('ready')
        return
      }
    } catch { /* backend not available or no model */ }

    // 3. Fallback: COCO-SSD from CDN
    await loadCocoSSD()
  }

  const loadCocoSSD = async () => {
    try {
      await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.17.0/dist/tf.min.js')
      await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js')
      modelRef.current = await window.cocoSsd.load()
      detModeRef.current = 'coco'
      setDetMode('coco')
      setModelType('coco')
      setModelStatus('ready')
    } catch {
      setModelStatus('error')
    }
  }

  // ── Camera ────────────────────────────────────────────────────────────────
  const startCamera = async () => {
    setCameraStatus('starting')
    try {
      // Try rear camera first, fall back to any available camera
      let stream
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width:  { ideal: 1280 },
            height: { ideal: 720 },
          }
        })
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true })
      }

      streamRef.current = stream
      const video = videoRef.current
      if (!video) throw Object.assign(new Error('no-element'), { name: 'NoElement' })
      video.srcObject = stream

      // Wait for metadata (works with autoPlay attribute)
      await new Promise((resolve) => {
        if (video.readyState >= 1) { resolve(); return }
        video.onloadedmetadata = resolve
        setTimeout(resolve, 4000) // safety timeout
      })

      setCameraStatus('active')
      startDetectionLoop()
    } catch (err) {
      console.error('[CajaIA] camera error:', err.name, err.message)
      streamRef.current?.getTracks().forEach(t => t.stop())
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraStatus('denied')
      } else if (err.name === 'NotReadableError') {
        setCameraStatus('busy')
        show('Cámara en uso por otra aplicación. Ciérrala y reintenta.', 'error')
      } else if (err.name === 'NotFoundError') {
        setCameraStatus('error')
        show('No se encontró ninguna cámara en este dispositivo.', 'error')
      } else {
        setCameraStatus('error')
        show(`Error de cámara: ${err.name || err.message}`, 'error')
      }
    }
  }

  const stopCamera = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    const ctx = overlayRef.current?.getContext('2d')
    ctx?.clearRect(0, 0, overlayRef.current.width, overlayRef.current.height)
    setCameraStatus('idle')
    setDetections([])
  }

  // ── Capture frame as base64 JPEG for backend detection ───────────────────
  const captureFrame = () => {
    const video = videoRef.current
    if (!video || !video.videoWidth) return null
    const cap = document.createElement('canvas')
    cap.width  = 640
    cap.height = Math.round(640 * video.videoHeight / video.videoWidth)
    cap.getContext('2d').drawImage(video, 0, 0, cap.width, cap.height)
    const dataUrl = cap.toDataURL('image/jpeg', 0.72)
    return dataUrl.split(',')[1]
  }

  // ── Detection loop ────────────────────────────────────────────────────────
  const startDetectionLoop = () => {
    if (timerRef.current) clearInterval(timerRef.current)

    timerRef.current = setInterval(async () => {
      const video  = videoRef.current
      const canvas = overlayRef.current
      if (!video || !canvas || !video.videoWidth) return

      if (canvas.width !== video.videoWidth) {
        canvas.width  = video.videoWidth
        canvas.height = video.videoHeight
      }

      try {
        let aiDets = []
        const mode     = detModeRef.current
        const scanMode = scanModeRef.current

        // ── AI detection ──────────────────────────────────────────────────
        if (scanMode !== 'barcode') {
          if (mode === 'backend') {
            const frame = captureFrame()
            if (frame) {
              const res = await fetch(`/ai-engine/detect/${user.businessId}`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ image: frame, confidence: 0.65 }),
              })
              if (res.ok) {
                const data = await res.json()
                aiDets = (data.detections || []).map(d => ({
                  class:   d.class,
                  score:   d.confidence,
                  bbox:    d.bbox,
                  product: d.product || null,
                  source:  'ai',
                }))
              }
            }
          } else if (mode === 'coco' && modelRef.current) {
            const preds = await modelRef.current.detect(video)
            aiDets = preds
              .filter(p => p.score >= 0.60)
              .map(p => ({
                class:   p.class,
                score:   p.score,
                bbox:    p.bbox,
                product: matchProduct(p.class, productsRef.current, 'coco'),
                source:  'ai',
              }))
          }
        }

        // ── Barcode detection (native BarcodeDetector) ────────────────────
        let barcodeDets = []
        if (scanMode !== 'ai' && barcodeRef.current) {
          const codes = await barcodeRef.current.detect(video)
          barcodeDets = codes.map(b => {
            const bb      = b.boundingBox
            const product = productsRef.current.find(p =>
              p.barcode?.toString() === b.rawValue ||
              p.sku?.toLowerCase()  === b.rawValue.toLowerCase()
            ) || matchProduct(b.rawValue, productsRef.current, 'coco')
            return {
              class:   `barcode:${b.rawValue}`,
              score:   1.0,
              bbox:    [bb.x, bb.y, bb.width, bb.height],
              product,
              barcode: b.rawValue,
              source:  'barcode',
            }
          })
        }

        const allDets = [...barcodeDets, ...aiDets]
        drawDetections(allDets, canvas)
        setDetections(allDets)

        if (autoAddRef.current) handleAutoAdd(allDets)
      } catch { /* ignore per-frame errors */ }
    }, 380) // ~2.6 FPS — smooth enough for a cashier, low CPU
  }

  // ── Product matching ──────────────────────────────────────────────────────
  const matchProduct = useCallback((className, prods, mode = detModeRef.current) => {
    if (!className || !prods.length) return null

    // Score-based matching: try every product, pick the one with most keyword hits
    const scoreMatch = (query) => {
      const clean = query.toLowerCase().replace(/[_\-]/g, ' ')
      const kws   = clean.split(/\s+/).filter(w => w.length > 2)
      if (!kws.length) return null
      let best = null, bestScore = 0
      for (const p of prods) {
        const pn    = p.name.toLowerCase()
        const score = kws.reduce((s, kw) => s + (pn.includes(kw) ? 1 : 0), 0)
        if (score > bestScore) { bestScore = score; best = p }
      }
      return bestScore > 0 ? best : null
    }

    if (mode === 'backend' || mode === 'custom') {
      return scoreMatch(className)
    }

    // COCO-SSD: keyword map first, then score-based fallback
    const keywords = KEYWORD_MAP[className] || []
    for (const kw of keywords) {
      const match = prods.find(p => {
        const pn = p.name.toLowerCase()
        return pn.includes(kw) || kw.includes(pn.split(' ')[0])
      })
      if (match) return match
    }

    // Score-based fallback using COCO class name against product names
    return scoreMatch(className)
  }, [])

  // ── Anti-duplicate: cooldown + IoU position tracking ─────────────────────
  const handleAutoAdd = (dets) => {
    const now = Date.now()
    recentDetsRef.current = recentDetsRef.current.filter(t => now - t.time < 3000)

    dets.forEach(det => {
      const isBarcode   = det.source === 'barcode'
      const minScore    = isBarcode ? 0.99 : 0.78  // barcodes always 1.0
      const cooldownMs  = isBarcode ? 4000 : 2500   // longer hold for barcodes
      if (det.score < minScore) return

      const product = det.product || matchProduct(det.class, productsRef.current)
      if (!product) return

      // Time-based cooldown per detection key
      const key  = isBarcode ? det.barcode : det.class
      const last = cooldownRef.current[key] || 0
      if (now - last < cooldownMs) return

      // Position-based for AI dets; skip for barcodes (value is enough)
      if (!isBarcode) {
        const isDuplicate = recentDetsRef.current
          .filter(t => t.class === det.class)
          .some(t => iou(det.bbox, t.bbox) > 0.4)
        if (isDuplicate) return
      }

      cooldownRef.current[key] = now
      recentDetsRef.current.push({ class: det.class, bbox: det.bbox, time: now })
      addToCart(product)
      flashRecentAdd(product.name)
      beep(isBarcode ? 1900 : 1400, 60)   // higher pitch for barcode, lower for AI
      if (navigator.vibrate) navigator.vibrate(40)
    })
  }

  // ── Draw bounding boxes ───────────────────────────────────────────────────
  const drawDetections = (dets, canvas) => {
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    dets.forEach(det => {
      const [x, y, w, h] = det.bbox
      const matched    = det.product
      const isBarcode  = det.source === 'barcode'
      const conf       = Math.round(det.score * 100)

      // Color scheme: barcode=amber, AI matched=green, AI unmatched=indigo
      const color = isBarcode
        ? (matched ? '#f59e0b' : '#f97316')
        : (matched ? '#10b981' : '#6366f1')

      // Main box
      ctx.strokeStyle = color
      ctx.lineWidth   = isBarcode ? 3 : 2.5
      ctx.strokeRect(x, y, w, h)

      // Corner accents
      const c = 12
      ctx.strokeStyle = '#fff'
      ctx.lineWidth   = 1.5
      ;[[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]]
        .forEach(([cx, cy, sx, sy]) => {
          ctx.beginPath()
          ctx.moveTo(cx + sx * c, cy)
          ctx.lineTo(cx, cy)
          ctx.lineTo(cx, cy + sy * c)
          ctx.stroke()
        })

      // Label
      let label
      if (isBarcode) {
        label = matched ? `▐ ${det.barcode} → ${matched.name}` : `▐ ${det.barcode}`
      } else {
        label = matched ? `✓ ${matched.name} ${conf}%` : `${det.class} ${conf}%`
      }

      ctx.font     = 'bold 12px system-ui, sans-serif'
      const textW  = ctx.measureText(label).width

      ctx.fillStyle = color
      roundRect(ctx, x, y - 26, textW + 14, 26, 4)
      ctx.fill()

      ctx.fillStyle = '#fff'
      ctx.fillText(label, x + 7, y - 8)
    })
  }

  // ── Cart ──────────────────────────────────────────────────────────────────
  // quantity es número (puede ser decimal para kg). saleMode: 'UNIT'|'WEIGHT'. variantName: string|null
  const addToCart = useCallback((product, qty = 1, saleMode = 'UNIT', variantName = null) => {
    const stock = Number(product.stock)
    if (stock <= 0) { show(`${product.name} está agotado`, 'error'); return }
    const quantity = Number(qty)
    if (quantity <= 0 || isNaN(quantity)) return

    // Precio según modo: variante con priceOverride > pricePerKg (WEIGHT) > price
    let unitPrice = product.price
    if (saleMode === 'WEIGHT' && product.pricePerKg) unitPrice = product.pricePerKg
    if (variantName && product.variants) {
      try {
        const variants = JSON.parse(product.variants)
        const v = variants.find(x => x.name === variantName)
        if (v) {
          if (v.priceOverride != null) unitPrice = Number(v.priceOverride)
          else if (v.multiplier != null) {
            const base = (saleMode === 'WEIGHT' && product.pricePerKg) ? product.pricePerKg : product.price
            unitPrice = Number(base) * Number(v.multiplier)
          }
        }
      } catch { /* JSON inválido */ }
    }

    const cartKey = variantName ? `${product.id}__${variantName}` : product.id

    setCart(prev => {
      const ex = prev.find(i => i.cartKey === cartKey)
      if (ex) {
        const newQty = Number((ex.quantity + quantity).toFixed(4))
        if (newQty > stock) { show(`Máximo ${fmtStock(stock, product.baseUnit)} disponible`, 'error'); return prev }
        return prev.map(i => i.cartKey === cartKey
          ? { ...i, quantity: newQty, subtotal: Number((newQty * i.unitPrice).toFixed(2)) } : i)
      }
      return [...prev, {
        cartKey,
        productId:   product.id,
        name:        variantName ? `${product.name} — ${variantName}` : product.name,
        unitPrice,
        price:       unitPrice,  // alias para compatibilidad
        quantity,
        subtotal:    Number((quantity * unitPrice).toFixed(2)),
        maxStock:    stock,
        saleMode,
        variantName,
        baseUnit:    product.baseUnit || 'unit',
      }]
    })
    show(`✓ ${product.name}${variantName ? ` (${variantName})` : ''}`, 'success')
  }, [show])

  const fmtStock = (n, unit) => {
    const s = Number(n)
    return (unit && unit !== 'unit') ? `${s} ${unit}` : `${Math.round(s)} uds`
  }

  // Abre picker de peso para productos WEIGHT/MIXED
  const openWeightPicker = useCallback((product, mode = 'WEIGHT') => {
    setWeightInput('')
    setWeightPicker({ product, mode })
  }, [])

  const confirmWeight = () => {
    const qty = parseFloat(weightInput.replace(',', '.'))
    if (!qty || qty <= 0) { show('Ingresa un peso válido', 'error'); return }
    addToCart(weightPicker.product, qty, weightPicker.mode, null)
    setWeightPicker(null)
    setWeightInput('')
    setMobileTab('cart')
  }

  const removeFromCart = (cartKey) =>
    setCart(prev => prev.filter(i => i.cartKey !== cartKey))

  const updateQty = (cartKey, qty) => {
    const q = Number(qty)
    if (q <= 0) { removeFromCart(cartKey); return }
    setCart(prev => prev.map(i => {
      if (i.cartKey !== cartKey) return i
      if (q > i.maxStock) { show(`Máximo ${fmtStock(i.maxStock, i.baseUnit)}`, 'error'); return i }
      return { ...i, quantity: q, subtotal: Number((q * i.unitPrice).toFixed(2)) }
    }))
  }

  const total         = cart.reduce((s, i) => s + i.subtotal, 0)
  const discountAmt   = discount.value
    ? discount.type === 'percent'
      ? total * (Math.min(100, parseFloat(discount.value) || 0) / 100)
      : Math.min(total, parseFloat(discount.value) || 0)
    : 0
  const finalTotal    = Math.max(0, total - discountAmt)
  const change        = cashReceived ? parseFloat(cashReceived) - finalTotal : 0

  // ── Manual product lookup (barcode / name) ────────────────────────────────
  const handleManualEntry = (e) => {
    e.preventDefault()
    const q = manualCode.trim().toLowerCase()
    if (!q) return
    const found = products.find(p =>
      p.name.toLowerCase().includes(q) ||
      p.sku?.toLowerCase() === q ||
      p.barcode?.toString() === q
    )
    if (found) {
      addToCart(found)
      beep(1900, 60)
      if (navigator.vibrate) navigator.vibrate(40)
      setManualCode('')
    } else {
      show('Producto no encontrado', 'error')
    }
  }

  // ── Cierre de caja ────────────────────────────────────────────────────────
  const openCorte = async () => {
    try {
      const token = localStorage.getItem('ab_token')
      const data  = await fetch(`${API}/pos/corte/today`, {
        headers: { Authorization: `Bearer ${token}` }
      }).then(r => r.json())
      setCorteData(data)
      setShowCorte(true)
    } catch {
      show('No se pudo cargar el corte', 'error')
    }
  }

  const [corteNotes, setCorteNotes] = useState('')
  const [corteSaving, setCorteSaving] = useState(false)

  const handleCloseRegister = async () => {
    setCorteSaving(true)
    try {
      const token = localStorage.getItem('ab_token')
      await fetch(`${API}/pos/corte/close`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ notes: corteNotes }),
      })
      show('✓ Corte guardado correctamente', 'success')
      setShowCorte(false)
      setCorteNotes('')
    } catch {
      show('Error al guardar el corte', 'error')
    } finally { setCorteSaving(false) }
  }

  // ── Checkout ──────────────────────────────────────────────────────────────
  const checkout = async () => {
    if (!cart.length) { show('El carrito está vacío', 'error'); return }
    if (payMethod === 'cash' && cashReceived && change < 0) return
    setLoading(true)
    try {
      const res = await posApi.checkout({
        branchId:      user.branchId,
        items:         cart.map(i => ({
          productId:   i.productId,
          quantity:    i.quantity,
          saleMode:    i.saleMode    || 'UNIT',
          variantName: i.variantName || null,
        })),
        paymentMethod: payMethod,
        cashReceived:  payMethod === 'cash' && cashReceived
          ? parseFloat(cashReceived) : undefined,
      })
      setLastSale({
        ...res,
        items:     [...cart],
        total:     finalTotal,
        discount:  discountAmt,
        change,
        payMethod,
        time:      new Date(),
      })
      setCart([])
      setCashReceived('')
      setDiscount({ type: 'percent', value: '' })
      setShowDiscount(false)
      setPayMethod('cash')
      posApi.products().then(data => { setProducts(data); productsRef.current = data })
    } catch (err) {
      show(err?.error || err?.message || 'Error al procesar venta', 'error')
    } finally { setLoading(false) }
  }

  // ── Beep sound (professional POS feedback) ───────────────────────────────
  const beep = useCallback((frequency = 1800, duration = 80, volume = 0.25) => {
    try {
      const ctx  = new (window.AudioContext || window.webkitAudioContext)()
      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = frequency
      osc.type = 'sine'
      gain.gain.setValueAtTime(volume, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration / 1000)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + duration / 1000)
    } catch { /* audio not available */ }
  }, [])

  // ── WhatsApp receipt ──────────────────────────────────────────────────────
  const sendWhatsApp = useCallback(() => {
    if (!cart.length) return
    const lines  = cart.map(i => {
      const qtyStr = i.saleMode === 'WEIGHT'
        ? `${Number(i.quantity).toFixed(3)} ${i.baseUnit || 'kg'}`
        : `×${i.quantity}`
      return `• ${i.name} ${qtyStr}  $${i.subtotal.toFixed(2)}`
    })
    const text   = [
      '🧾 *Recibo de compra*',
      '',
      ...lines,
      '',
      `*Total: $${total.toFixed(2)}*`,
      '',
      '¡Gracias por su compra! 🙏',
    ].join('\n')
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
  }, [cart, total])

  const flashRecentAdd = (name) => {
    setRecentAdd(name)
    setTimeout(() => setRecentAdd(null), 1800)
  }

  // ── Sale completed screen ─────────────────────────────────────────────────
  const PAY_LABELS = { cash: '💵 Efectivo', card: '💳 Tarjeta', transfer: '🏦 Transferencia', mp: '💙 Mercado Pago' }

  // ── Modal picker de peso ──────────────────────────────────────────────────
  const WeightPickerModal = weightPicker && (
    <div className="caia-modal-backdrop" onClick={() => setWeightPicker(null)}>
      <div className="caia-modal caia-weight-modal" onClick={e => e.stopPropagation()}>
        <div className="caia-modal-header">
          <h2>⚖️ {weightPicker.product.name}</h2>
          <button className="caia-modal-close" onClick={() => setWeightPicker(null)}>✕</button>
        </div>
        <div className="caia-weight-body">
          <p className="caia-weight-price">
            {weightPicker.product.pricePerKg
              ? `${fmt(weightPicker.product.pricePerKg)} / kg`
              : fmt(weightPicker.product.price)}
          </p>
          <div className="caia-weight-quick">
            {['0.25','0.5','1','2','5'].map(w => (
              <button key={w} className="caia-weight-quick-btn"
                onClick={() => setWeightInput(String(parseFloat(weightInput || '0') + parseFloat(w)))}>
                +{w} kg
              </button>
            ))}
          </div>
          <input
            className="caia-weight-input"
            type="number"
            inputMode="decimal"
            step="0.001"
            min="0"
            placeholder="0.000 kg"
            value={weightInput}
            onChange={e => setWeightInput(e.target.value)}
            autoFocus
            onKeyDown={e => e.key === 'Enter' && confirmWeight()}
          />
          {weightInput && parseFloat(weightInput) > 0 && weightPicker.product.pricePerKg && (
            <p className="caia-weight-preview">
              Total: <strong>{fmt(parseFloat(weightInput) * weightPicker.product.pricePerKg)}</strong>
            </p>
          )}
          <button className="caia-btn-primary full" onClick={confirmWeight}
            disabled={!weightInput || parseFloat(weightInput) <= 0}>
            ✓ Agregar al carrito
          </button>
        </div>
      </div>
    </div>
  )

  if (lastSale) return (
    <div className="caia-ticket-screen">
      <div className="caia-ticket-card">
        <div className="caia-ticket-icon">✅</div>
        <h2>Venta completada</h2>
        <div className="caia-ticket-method">{PAY_LABELS[lastSale.payMethod] || lastSale.payMethod}</div>
        <div className="caia-ticket-items">
          {lastSale.items.map(i => (
            <div key={i.productId} className="caia-ticket-item">
              <span>{i.name} ×{i.quantity}</span>
              <span>{fmt(i.subtotal)}</span>
            </div>
          ))}
        </div>
        {lastSale.discount > 0 && (
          <div className="caia-ticket-item discount-row">
            <span>Descuento</span>
            <span>-{fmt(lastSale.discount)}</span>
          </div>
        )}
        <div className="caia-ticket-total">{fmt(lastSale.total)}</div>
        {lastSale.change > 0 && (
          <div className="caia-ticket-change">Cambio: <strong>{fmt(lastSale.change)}</strong></div>
        )}
        <div className="caia-ticket-actions">
          <button className="caia-btn-ghost" onClick={sendWhatsApp} title="Enviar por WhatsApp">
            📲 WhatsApp
          </button>
          <button className="caia-btn-primary" onClick={() => setLastSale(null)}>
            + Nueva venta
          </button>
        </div>
      </div>
    </div>
  )

  // ── Derived ───────────────────────────────────────────────────────────────
  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(productSearch.toLowerCase()) && Number(p.stock) > 0
  )

  const suggestions = detections
    .map(d => d.product || matchProduct(d.class, products))
    .filter(Boolean)
    .filter((p, i, arr) => arr.findIndex(x => x.id === p.id) === i)

  const modelLabel = modelStatus === 'loading' ? 'Cargando IA...'
    : modelStatus === 'error'   ? 'Error IA'
    : modelType    === 'custom' ? '🟣 Modelo personalizado'
    : '🟢 IA lista (COCO)'

  // ── Customer display (fullscreen) ─────────────────────────────────────────
  if (customerDisplay) return (
    <div className="caia-customer-display" onClick={() => setCustomerDisplay(false)}>
      <div className="caia-cd-brand">AutoBusiness</div>
      <div className="caia-cd-items">
        {cart.length === 0
          ? <p className="caia-cd-waiting">Esperando productos…</p>
          : cart.map(i => (
            <div key={i.productId} className="caia-cd-row">
              <span className="caia-cd-name">{i.name}</span>
              <span className="caia-cd-qty">×{i.quantity}</span>
              <span className="caia-cd-sub">${i.subtotal.toFixed(2)}</span>
            </div>
          ))
        }
      </div>
      <div className="caia-cd-total-wrap">
        <span className="caia-cd-total-label">TOTAL</span>
        <span className="caia-cd-total-amt">${total.toFixed(2)}</span>
      </div>
      <p className="caia-cd-hint">Toca para volver a la caja</p>
    </div>
  )

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
    {WeightPickerModal}
    {/* ── Cierre de caja modal ── */}
    {showCorte && corteData && (
      <div className="caia-modal-backdrop" onClick={() => setShowCorte(false)}>
        <div className="caia-modal" onClick={e => e.stopPropagation()}>
          <div className="caia-modal-header">
            <h2>📊 Corte de caja</h2>
            <button className="caia-modal-close" onClick={() => setShowCorte(false)}>✕</button>
          </div>
          <div className="caia-corte-body">
            <div className="caia-corte-date">{new Date().toLocaleDateString('es-MX', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}</div>
            <div className="caia-corte-stats">
              <div className="caia-corte-stat">
                <span className="caia-corte-label">Total del día</span>
                <span className="caia-corte-val" style={{ color:'#6366f1' }}>{fmt(corteData.totalRevenue ?? 0)}</span>
              </div>
              <div className="caia-corte-stat">
                <span className="caia-corte-label">Transacciones</span>
                <span className="caia-corte-val">{corteData.transactionCount ?? 0}</span>
              </div>
              <div className="caia-corte-stat">
                <span className="caia-corte-label">Ticket promedio</span>
                <span className="caia-corte-val">{fmt(corteData.avgTicket ?? 0)}</span>
              </div>
            </div>
            <div className="caia-corte-methods">
              {[
                { key:'cash',     label:'💵 Efectivo',       val: corteData.cash     ?? 0 },
                { key:'card',     label:'💳 Tarjeta',        val: corteData.card     ?? 0 },
                { key:'transfer', label:'🏦 Transferencia',  val: corteData.transfer ?? 0 },
                { key:'mp',       label:'💙 Mercado Pago',   val: corteData.mp       ?? 0 },
              ].map(m => (
                <div key={m.key} className="caia-corte-method-row">
                  <span>{m.label}</span>
                  <span>{fmt(m.val)}</span>
                </div>
              ))}
            </div>
            {corteData.history?.length > 0 && (
              <div className="caia-corte-history">
                <p className="caia-corte-history-title">Últimos cortes</p>
                {corteData.history.slice(0, 3).map(h => (
                  <div key={h.id} className="caia-corte-history-row">
                    <span>{new Date(h.closedAt).toLocaleDateString('es-MX', { day:'numeric', month:'short' })}</span>
                    <span>{h.transactions} ventas</span>
                    <span>{fmt(h.total)}</span>
                  </div>
                ))}
              </div>
            )}
            <textarea className="caia-corte-notes-input"
              placeholder="Notas del corte (fondo de caja, incidencias…)"
              rows={2}
              value={corteNotes}
              onChange={e => setCorteNotes(e.target.value)}
            />
            <button className="caia-btn-primary full"
              onClick={handleCloseRegister}
              disabled={corteSaving}>
              {corteSaving ? 'Guardando…' : '✓ Cerrar turno y guardar corte'}
            </button>
          </div>
        </div>
      </div>
    )}

    <div className="caia-page">

      {/* ── Header ── */}
      <header className="caia-header">
        <div className="caia-header-left">
          <h1>🤖 Caja IA</h1>
          <span className={`caia-pill caia-pill--${modelStatus}`}>{modelLabel}</span>
          <button className="caia-btn-ghost" onClick={() => setCustomerDisplay(true)}
            title="Pantalla de cliente">
            🖥️
          </button>
        </div>
        <div className="caia-header-right">
          {cameraStatus === 'active' && (
            <select className="caia-scan-select"
              value={scanMode}
              onChange={e => setScanMode(e.target.value)}
              title={barcodeSupported ? 'Modo de escaneo' : 'Escáner de barras no disponible en este navegador'}>
              <option value="both">{barcodeSupported ? '📊+🤖 Barras + IA' : '🤖 IA (barras no disponible)'}</option>
              <option value="barcode" disabled={!barcodeSupported}>📊 Solo barras{!barcodeSupported ? ' (no soportado)' : ''}</option>
              <option value="ai">🤖 Solo IA</option>
            </select>
          )}
          {cameraStatus === 'active' && (
            <label className="caia-toggle">
              <input type="checkbox" checked={autoAdd}
                onChange={e => setAutoAdd(e.target.checked)} />
              Auto-agregar
            </label>
          )}
          {cameraStatus === 'idle' && (
            <button className="caia-btn-primary"
              onClick={startCamera}
              disabled={modelStatus !== 'ready'}>
              📷 Iniciar cámara
            </button>
          )}
          {cameraStatus === 'starting' && (
            <button className="caia-btn-outline" disabled>Abriendo…</button>
          )}
          {cameraStatus === 'active' && (
            <button className="caia-btn-outline" onClick={stopCamera}>⏹ Detener</button>
          )}
        </div>
      </header>

      {/* ── Mobile tab bar ── */}
      <nav className="caia-tabs">
        <button className={`caia-tab${mobileTab === 'camera'   ? ' active' : ''}`}
          onClick={() => setMobileTab('camera')}>📷 Cámara</button>
        <button className={`caia-tab${mobileTab === 'products' ? ' active' : ''}`}
          onClick={() => setMobileTab('products')}>📦 Catálogo</button>
        <button className={`caia-tab${mobileTab === 'cart'     ? ' active' : ''}`}
          onClick={() => setMobileTab('cart')}>
          🛒 Carrito {cart.length > 0 && <span className="caia-badge">{cart.length}</span>}
        </button>
      </nav>

      {/* ── Body ── */}
      <div className="caia-body">

        {/* ── LEFT: Camera ── */}
        <section className={`caia-camera-col${mobileTab !== 'camera' ? ' mobile-hidden' : ''}`}>

          <div className="caia-camera-wrap">
            {/* Video always in DOM so refs are always valid */}
            <div className="caia-video-container" style={{ display: cameraStatus === 'active' ? '' : 'none' }}>
              <video ref={videoRef} className="caia-video" autoPlay playsInline muted />
              <canvas ref={overlayRef} className="caia-overlay" />
              {recentAdd && <div className="caia-flash">✓ {recentAdd}</div>}
              <div className="caia-det-badge">
                {detections.length > 0
                  ? `${detections.length} detectado${detections.length > 1 ? 's' : ''}`
                  : 'Sin detecciones'}
              </div>
            </div>

            {cameraStatus !== 'active' && (
              <div className="caia-camera-placeholder">
                {modelStatus === 'loading' && (
                  <><div className="caia-spinner" />
                    <p>Cargando modelo IA…</p>
                    <small>Primera vez tarda ~10 s</small></>
                )}
                {modelStatus === 'error' && (
                  <><span>⚠️</span>
                    <p>No se pudo cargar el modelo</p>
                    <button className="caia-btn-outline" onClick={initDetection}>Reintentar</button></>
                )}
                {modelStatus === 'ready' && (cameraStatus === 'idle') && (
                  <><span>📷</span>
                    <p>Cámara lista</p>
                    <button className="caia-btn-primary" onClick={startCamera}>Iniciar cámara</button></>
                )}
                {cameraStatus === 'starting' && (
                  <><div className="caia-spinner" /><p>Abriendo cámara…</p></>
                )}
                {cameraStatus === 'denied' && <CameraDeniedHelp onRetry={startCamera} />}
                {(cameraStatus === 'error' || cameraStatus === 'busy') && (
                  <><span>⚠️</span>
                    <p>{cameraStatus === 'busy'
                      ? 'Cámara ocupada por otra app'
                      : 'No se pudo abrir la cámara'}</p>
                    <button className="caia-btn-outline" onClick={startCamera}>Reintentar</button></>
                )}
              </div>
            )}
          </div>

          {/* Suggestion chips */}
          {suggestions.length > 0 && (
            <div className="caia-suggestions">
              <div className="caia-suggestions-label">💡 Detectado — toca para agregar:</div>
              <div className="caia-chips">
                {suggestions.map(p => (
                  <button key={p.id} className="caia-chip" onClick={() => {
                    if ((p.saleMode || 'UNIT') === 'WEIGHT') { openWeightPicker(p, 'WEIGHT'); return }
                    addToCart(p, 1, p.saleMode || 'UNIT', null)
                    setMobileTab('cart')
                  }}>
                    <span>{p.name}</span>
                    <span className="caia-chip-price">{fmt(p.price)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Manual / barcode entry */}
          <form className="caia-manual" onSubmit={handleManualEntry}>
            <input
              className="caia-manual-input"
              value={manualCode}
              onChange={e => setManualCode(e.target.value)}
              placeholder="Código o nombre de producto…"
              inputMode="text"
              autoComplete="off"
            />
            <button type="submit" className="caia-btn-outline">Agregar</button>
          </form>
        </section>

        {/* ── RIGHT: Catalog + Cart ── */}
        <section className={`caia-right-col${mobileTab === 'camera' ? ' mobile-hidden' : ''}`}>

          {/* Product catalog */}
          <div className={`caia-catalog${mobileTab === 'cart' ? ' mobile-hidden' : ''}`}>
            <div className="caia-catalog-header">
              <span>📦 Catálogo ({products.length})</span>
            </div>
            <input
              className="caia-search"
              placeholder="Buscar…"
              value={productSearch}
              onChange={e => setProductSearch(e.target.value)}
            />
            <div className="caia-product-grid">
              {filteredProducts.map(p => {
                const stock     = Number(p.stock)
                const minS      = Number(p.minStock) || 3
                const isLow     = stock <= minS
                const stockLbl  = fmtStock(stock, p.baseUnit)
                const mode      = p.saleMode || 'UNIT'
                const variants  = p.variants ? (() => { try { return JSON.parse(p.variants) } catch { return [] } })() : []

                const imgEl = p.imageUrl
                  ? <img src={p.imageUrl} alt={p.name} className="caia-prod-img" />
                  : <div className="caia-prod-img-placeholder">📦</div>

                // ── Producto con variantes ────────────────────────────────
                if (variants.length > 0) return (
                  <div key={p.id} className="caia-product-btn caia-product-variants">
                    {imgEl}
                    <span className="caia-prod-name">{p.name}</span>
                    <span className="caia-prod-price">{fmt(p.price)}/{p.baseUnit || 'unit'}</span>
                    <div className="caia-variant-btns">
                      {variants.map(v => (
                        <button key={v.name} className="caia-variant-btn"
                          onClick={() => { addToCart(p, v.multiplier || 1, mode, v.name); setMobileTab('cart') }}>
                          {v.name}
                        </button>
                      ))}
                      {mode === 'WEIGHT' && (
                        <button className="caia-variant-btn caia-variant-custom"
                          onClick={() => openWeightPicker(p, 'WEIGHT')}>
                          ⚖️ Personalizado
                        </button>
                      )}
                    </div>
                    <span className={`caia-prod-stock${isLow ? ' low' : ''}`}>{stockLbl}</span>
                  </div>
                )

                // ── Producto WEIGHT ───────────────────────────────────────
                if (mode === 'WEIGHT') return (
                  <button key={p.id} className="caia-product-btn caia-product-weight"
                    onClick={() => openWeightPicker(p, 'WEIGHT')}
                    title={`Stock: ${stockLbl}`}>
                    {imgEl}
                    <span className="caia-prod-name">{p.name}</span>
                    <span className="caia-prod-price">
                      {p.pricePerKg ? `${fmt(p.pricePerKg)}/kg` : fmt(p.price)}
                    </span>
                    <span className="caia-prod-weight-icon">⚖️ Pesar</span>
                    <span className={`caia-prod-stock${isLow ? ' low' : ''}`}>{stockLbl}</span>
                  </button>
                )

                // ── Producto MIXED ────────────────────────────────────────
                if (mode === 'MIXED') return (
                  <div key={p.id} className="caia-product-btn caia-product-mixed">
                    {imgEl}
                    <span className="caia-prod-name">{p.name}</span>
                    <span className="caia-prod-price">{fmt(p.price)}</span>
                    <div className="caia-mixed-btns">
                      <button className="caia-mixed-btn"
                        onClick={() => { addToCart(p, 1, 'UNIT', null); setMobileTab('cart') }}>
                        🔢 Pieza
                      </button>
                      <button className="caia-mixed-btn"
                        onClick={() => openWeightPicker(p, 'WEIGHT')}>
                        ⚖️ Peso
                      </button>
                    </div>
                    <span className={`caia-prod-stock${isLow ? ' low' : ''}`}>{stockLbl}</span>
                  </div>
                )

                // ── Producto UNIT (default) ───────────────────────────────
                return (
                  <button key={p.id} className="caia-product-btn"
                    onClick={() => { addToCart(p, 1, 'UNIT', null); setMobileTab('cart') }}
                    title={`Stock: ${stockLbl}`}>
                    {imgEl}
                    <span className="caia-prod-name">{p.name}</span>
                    <span className="caia-prod-price">{fmt(p.price)}</span>
                    <span className={`caia-prod-stock${isLow ? ' low' : ''}`}>{stockLbl}</span>
                  </button>
                )
              })}
              {filteredProducts.length === 0 && (
                <p className="caia-empty">Sin resultados</p>
              )}
            </div>
          </div>

          {/* Cart */}
          <div className={`caia-cart${mobileTab === 'products' ? ' mobile-hidden' : ''}`}>
            <div className="caia-cart-header">
              <span>🛒 Carrito</span>
              <div style={{ display:'flex', gap:6 }}>
                <button className="caia-clear-btn" onClick={openCorte} title="Cierre de caja">📊 Corte</button>
                {cart.length > 0 && (
                  <button className="caia-clear-btn" onClick={() => setCart([])}>Vaciar</button>
                )}
              </div>
            </div>

            {cart.length === 0 ? (
              <div className="caia-cart-empty">
                <span>🛒</span>
                <p>Vacío — detecta o toca un producto</p>
              </div>
            ) : (
              <>
                <div className="caia-cart-items">
                  {cart.map(item => {
                    const isWeight = item.saleMode === 'WEIGHT'
                    const step     = isWeight ? 0.25 : 1
                    const qtyLabel = isWeight
                      ? `${Number(item.quantity).toFixed(item.quantity % 1 === 0 ? 0 : 3)} ${item.baseUnit || 'kg'}`
                      : item.quantity
                    return (
                      <div key={item.cartKey} className="caia-cart-item">
                        <span className="caia-ci-name">{item.name}</span>
                        <div className="caia-ci-controls">
                          <button className="caia-qty-btn"
                            onClick={() => updateQty(item.cartKey, Number((item.quantity - step).toFixed(4)))}>−</button>
                          <span className="caia-qty-val">{qtyLabel}</span>
                          <button className="caia-qty-btn"
                            onClick={() => updateQty(item.cartKey, Number((item.quantity + step).toFixed(4)))}
                            disabled={item.quantity >= item.maxStock}>+</button>
                          <span className="caia-ci-sub">{fmt(item.subtotal)}</span>
                          <button className="caia-rm-btn"
                            onClick={() => removeFromCart(item.cartKey)}>×</button>
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div className="caia-cart-footer">
                  {/* Descuento */}
                  {!showDiscount ? (
                    <button className="caia-discount-trigger"
                      onClick={() => setShowDiscount(true)}>
                      + Agregar descuento
                    </button>
                  ) : (
                    <div className="caia-discount-row">
                      <select className="caia-discount-type"
                        value={discount.type}
                        onChange={e => setDiscount(d => ({ ...d, type: e.target.value }))}>
                        <option value="percent">%</option>
                        <option value="fixed">$</option>
                      </select>
                      <input className="caia-discount-input"
                        type="number" inputMode="decimal" min="0"
                        placeholder={discount.type === 'percent' ? '10' : '20.00'}
                        value={discount.value}
                        onChange={e => setDiscount(d => ({ ...d, value: e.target.value }))}
                      />
                      <button className="caia-discount-remove"
                        onClick={() => { setDiscount({ type:'percent', value:'' }); setShowDiscount(false) }}>
                        ✕
                      </button>
                    </div>
                  )}

                  {/* Totales */}
                  {discountAmt > 0 && (
                    <div className="caia-total-row small">
                      <span>Subtotal</span><span>{fmt(total)}</span>
                    </div>
                  )}
                  {discountAmt > 0 && (
                    <div className="caia-total-row small green">
                      <span>Descuento</span><span>-{fmt(discountAmt)}</span>
                    </div>
                  )}
                  <div className="caia-total-row">
                    <span>Total</span>
                    <strong className="caia-total-amt">{fmt(finalTotal)}</strong>
                  </div>

                  {/* Métodos de pago */}
                  <div className="caia-pay-tabs">
                    {[
                      { id:'cash',     label:'💵 Efectivo' },
                      { id:'card',     label:'💳 Tarjeta' },
                      { id:'transfer', label:'🏦 SPEI' },
                      { id:'mp',       label:'💙 MP' },
                    ].map(p => (
                      <button key={p.id}
                        className={`caia-pay-tab${payMethod===p.id?' active':''}`}
                        onClick={() => setPayMethod(p.id)}>
                        {p.label}
                      </button>
                    ))}
                  </div>

                  {payMethod === 'cash' && (
                    <input className="caia-cash-input"
                      type="number" inputMode="decimal"
                      placeholder="Efectivo recibido"
                      value={cashReceived}
                      onChange={e => setCashReceived(e.target.value)}
                      step="0.5"
                    />
                  )}
                  {payMethod === 'transfer' && (
                    <div className="caia-pay-info">
                      <span>Pide al cliente transferir a tu cuenta bancaria</span>
                      <small>Configura tu CLABE en Configuración</small>
                    </div>
                  )}
                  {payMethod === 'mp' && (
                    <div className="caia-pay-info">
                      <span>Usa tu código QR de Mercado Pago</span>
                      <small>Muestra tu QR al cliente para que pague</small>
                    </div>
                  )}

                  {payMethod === 'cash' && cashReceived && change >= 0 && (
                    <div className="caia-change positive">Cambio: <strong>{fmt(change)}</strong></div>
                  )}
                  {payMethod === 'cash' && cashReceived && change < 0 && (
                    <div className="caia-change negative">Faltan: <strong>{fmt(Math.abs(change))}</strong></div>
                  )}

                  <div className="caia-checkout-actions">
                    <button className="caia-btn-primary"
                      onClick={checkout}
                      disabled={loading || (payMethod==='cash' && !!cashReceived && change < 0)}
                      style={{ flex: 1 }}>
                      {loading ? <span className="caia-spinner" /> : `Cobrar ${fmt(finalTotal)}`}
                    </button>
                    <button className="caia-btn-whatsapp" onClick={sendWhatsApp}
                      title="Enviar recibo por WhatsApp">
                      📲
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
    </>
  )
}
