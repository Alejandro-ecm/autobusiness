import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { store as storeApi } from '../api'
import { useToast } from '../store/ToastContext'
import './Storefront.css'
import 'leaflet/dist/leaflet.css'

let mpInitialized = false
async function initMP(publicKey) {
  if (mpInitialized) return
  const { initMercadoPago } = await import('@mercadopago/sdk-react')
  initMercadoPago(publicKey, { locale: 'es-MX' })
  mpInitialized = true
}

function PaymentBrick({ amount, preferenceId, orderId, slug, onSuccess, onError }) {
  const [BrickComponent, setBrickComponent] = useState(null)
  const containerRef = useRef(null)

  useEffect(() => {
    import('@mercadopago/sdk-react').then(mod => {
      setBrickComponent(() => mod.Payment)
    })
  }, [])

  if (!BrickComponent) return (
    <div style={{ textAlign: 'center', padding: 40 }}>
      <div className="spinner" style={{ margin: '0 auto 12px' }} />
      <p style={{ color: '#64748b' }}>Cargando métodos de pago...</p>
    </div>
  )

  return (
    <div ref={containerRef}>
      <BrickComponent
        initialization={{ amount, preferenceId }}
        customization={{
          paymentMethods: {
            ticket: 'all',
            creditCard: 'all',
            debitCard: 'all',
            mercadoPago: 'all',
          },
          visual: { style: { theme: 'default' } }
        }}
        onSubmit={async ({ selectedPaymentMethod, formData }) => {
          try {
            const result = await storeApi.processPayment(slug, { orderId, formData })
            if (result.status === 'approved') {
              onSuccess()
              return { status: 'approved' }
            } else if (result.status === 'pending' || result.status === 'in_process') {
              onSuccess('pending')
              return { status: 'pending' }
            } else {
              return { status: 'rejected' }
            }
          } catch (err) {
            onError(err?.error || 'Error al procesar el pago')
            return { status: 'rejected' }
          }
        }}
        onReady={() => {}}
        onError={(err) => { onError('Error en el formulario de pago') }}
      />
    </div>
  )
}

const fmt = (n) => `$${Number(n || 0).toFixed(2)}`
const DEFAULT_LOGO = '/skymarket-logo.jpg'

const DAY_KEYS = ['dom', 'lun', 'mar', 'mie', 'jue', 'vie', 'sab']
const DAY_LABELS = { lun: 'Lun', mar: 'Mar', mie: 'Mié', jue: 'Jue', vie: 'Vie', sab: 'Sáb', dom: 'Dom' }

function BusinessHours({ hoursJson }) {
  if (!hoursJson) return null
  let hours = null
  try { hours = JSON.parse(hoursJson) } catch { return null }

  const now = new Date()
  const todayKey = DAY_KEYS[now.getDay()]
  const todayHours = hours[todayKey]

  const isOpenNow = (() => {
    if (!todayHours?.open) return false
    const [fH, fM] = todayHours.from.split(':').map(Number)
    const [tH, tM] = todayHours.to.split(':').map(Number)
    const cur = now.getHours() * 60 + now.getMinutes()
    return cur >= fH * 60 + fM && cur < tH * 60 + tM
  })()

  return (
    <div style={{
      marginTop: 16,
      background: 'rgba(0,0,0,.35)',
      backdropFilter: 'blur(8px)',
      borderRadius: 14,
      padding: '12px 16px',
      display: 'inline-block',
      maxWidth: 340,
      width: '100%',
    }}>
      {/* Estado actual */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          background: isOpenNow ? '#16a34a' : '#dc2626',
          color: '#fff', borderRadius: 20, padding: '3px 10px',
          fontSize: 12, fontWeight: 700,
        }}>
          <span style={{
            width: 7, height: 7, borderRadius: '50%',
            background: '#fff', display: 'inline-block',
            animation: isOpenNow ? 'sf-pulse 1.5s infinite' : 'none',
          }} />
          {isOpenNow ? 'Abierto ahora' : 'Cerrado ahora'}
        </span>
        {todayHours?.open && (
          <span style={{ color: 'rgba(255,255,255,.75)', fontSize: 11 }}>
            Hoy: {todayHours.from} – {todayHours.to}
          </span>
        )}
      </div>
      {/* Tabla de días */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3 }}>
        {['lun','mar','mie','jue','vie','sab','dom'].map(key => {
          const d = hours[key]
          const isToday = key === todayKey
          return (
            <div key={key} style={{
              textAlign: 'center', padding: '4px 2px', borderRadius: 6,
              background: isToday ? 'rgba(255,255,255,.2)' : 'transparent',
              border: isToday ? '1px solid rgba(255,255,255,.35)' : '1px solid transparent',
            }}>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,.6)', fontWeight: isToday ? 700 : 400, marginBottom: 2 }}>
                {DAY_LABELS[key]}
              </div>
              <div style={{
                width: 6, height: 6, borderRadius: '50%', margin: '0 auto',
                background: d?.open ? '#4ade80' : '#f87171',
              }} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

function MapPicker({ initialLat, initialLng, onConfirm, onCancel }) {
  const mapDivRef = useRef(null)
  const leafletMapRef = useRef(null)
  const markerRef = useRef(null)
  const [pinPos, setPinPos] = useState({ lat: initialLat, lng: initialLng })
  const [dragged, setDragged] = useState(false)

  useEffect(() => {
    if (!mapDivRef.current || leafletMapRef.current) return
    import('leaflet').then(({ default: L }) => {
      const map = L.map(mapDivRef.current, {
        center: [initialLat, initialLng],
        zoom: 18,
        zoomControl: false,
      })

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 20,
      }).addTo(map)

      L.control.zoom({ position: 'bottomright' }).addTo(map)

      const pinIcon = L.divIcon({
        html: `
          <div style="position:relative;width:36px;height:52px;filter:drop-shadow(0 4px 8px rgba(0,0,0,.45))">
            <div style="
              width:36px;height:36px;
              background:linear-gradient(135deg,#ef4444,#dc2626);
              border:3px solid #fff;
              border-radius:50% 50% 50% 0;
              transform:rotate(-45deg);
              position:absolute;top:0;left:0">
            </div>
            <div style="
              width:12px;height:12px;
              background:#fff;
              border-radius:50%;
              position:absolute;
              top:9px;left:9px;
              opacity:.9">
            </div>
          </div>`,
        iconSize: [36, 52],
        iconAnchor: [18, 52],
        className: '',
      })

      const marker = L.marker([initialLat, initialLng], { draggable: true, icon: pinIcon }).addTo(map)

      const updatePos = (latlng) => {
        setPinPos({ lat: latlng.lat, lng: latlng.lng })
        setDragged(true)
      }

      marker.on('dragend', () => updatePos(marker.getLatLng()))
      map.on('click', (e) => { marker.setLatLng(e.latlng); updatePos(e.latlng) })

      leafletMapRef.current = map
      markerRef.current = marker
      setTimeout(() => map.invalidateSize(), 150)
    })

    return () => {
      if (leafletMapRef.current) { leafletMapRef.current.remove(); leafletMapRef.current = null }
    }
  }, [])

  const handleConfirm = () => {
    const mapsUrl = `https://www.google.com/maps?q=${pinPos.lat},${pinPos.lng}`
    onConfirm(pinPos.lat, pinPos.lng, mapsUrl)
  }

  const recenter = () => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition((pos) => {
      const latlng = { lat: pos.coords.latitude, lng: pos.coords.longitude }
      if (leafletMapRef.current && markerRef.current) {
        leafletMapRef.current.setView([latlng.lat, latlng.lng], 18)
        markerRef.current.setLatLng([latlng.lat, latlng.lng])
        setPinPos(latlng)
        setDragged(false)
      }
    }, () => {}, { enableHighAccuracy: true, timeout: 8000 })
  }

  return (
    <div style={{
      borderRadius: 20, overflow: 'hidden', marginTop: 10,
      boxShadow: '0 8px 32px rgba(99,102,241,.25), 0 2px 8px rgba(0,0,0,.12)',
      border: '2px solid rgba(99,102,241,.4)',
    }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
        padding: '14px 18px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ color: '#fff', fontWeight: 800, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>📍</span> Marca tu ubicación exacta
          </div>
          <div style={{ color: 'rgba(255,255,255,.75)', fontSize: 12, marginTop: 2 }}>
            Arrastra el pin rojo o toca cualquier punto del mapa
          </div>
        </div>
        <button type="button" onClick={onCancel}
          style={{
            background: 'rgba(255,255,255,.15)', border: '1px solid rgba(255,255,255,.3)',
            color: '#fff', borderRadius: 10, width: 34, height: 34, cursor: 'pointer',
            fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>×</button>
      </div>

      {/* Mapa */}
      <div style={{ position: 'relative' }}>
        <div ref={mapDivRef} style={{ height: 360, width: '100%' }} />

        {/* Tip flotante */}
        {!dragged && (
          <div style={{
            position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(15,23,42,.85)', color: '#fff', borderRadius: 20,
            padding: '7px 16px', fontSize: 12, fontWeight: 600, zIndex: 1000,
            backdropFilter: 'blur(8px)', whiteSpace: 'nowrap', pointerEvents: 'none',
            boxShadow: '0 4px 12px rgba(0,0,0,.3)',
          }}>
            Mueve el pin a tu puerta exacta
          </div>
        )}

        {/* Botón recentrar GPS */}
        <button type="button" onClick={recenter}
          style={{
            position: 'absolute', bottom: 52, right: 10, zIndex: 1000,
            background: '#fff', border: 'none', borderRadius: 10,
            width: 38, height: 38, cursor: 'pointer', fontSize: 18,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,.25)',
          }} title="Recentrar en mi ubicación">
          🎯
        </button>
      </div>

      {/* Footer */}
      <div style={{ background: '#fff', padding: '14px 16px', borderTop: '1px solid #e2e8f0' }}>
        {/* Coordenadas */}
        <div style={{
          background: dragged ? '#f0fdf4' : '#f8fafc',
          border: `1px solid ${dragged ? '#bbf7d0' : '#e2e8f0'}`,
          borderRadius: 12, padding: '10px 14px', marginBottom: 12,
          display: 'flex', alignItems: 'center', gap: 10, transition: 'all .3s',
        }}>
          <span style={{ fontSize: 22 }}>{dragged ? '✅' : '📌'}</span>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: dragged ? '#16a34a' : '#374151' }}>
              {dragged ? 'Ubicación ajustada' : 'Ubicación GPS inicial'}
            </div>
            <div style={{ fontSize: 11, color: '#6b7280', fontFamily: 'monospace', marginTop: 1 }}>
              {pinPos.lat.toFixed(6)}, {pinPos.lng.toFixed(6)}
            </div>
          </div>
        </div>

        {/* Botones */}
        <button type="button" onClick={handleConfirm}
          style={{
            width: '100%', padding: '15px', borderRadius: 14, border: 'none', cursor: 'pointer',
            background: 'linear-gradient(135deg, #16a34a, #15803d)',
            color: '#fff', fontWeight: 800, fontSize: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            boxShadow: '0 4px 14px rgba(22,163,74,.4)',
          }}>
          <span style={{ fontSize: 20 }}>✓</span> Confirmar esta ubicación
        </button>
      </div>
    </div>
  )
}

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

function AdminBar() {
  const user = (() => { try { return JSON.parse(localStorage.getItem('ab_user')) } catch { return null } })()
  if (!user) return null
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
      background: '#0f172a', borderBottom: '1px solid rgba(99,102,241,.4)',
      display: 'flex', alignItems: 'center', gap: 12, padding: '8px 16px',
      fontSize: 13
    }}>
      <a href="/dashboard" style={{
        display: 'flex', alignItems: 'center', gap: 6,
        color: '#818cf8', fontWeight: 700, textDecoration: 'none',
        background: 'rgba(99,102,241,.15)', borderRadius: 6,
        padding: '5px 12px', border: '1px solid rgba(99,102,241,.3)',
        transition: 'background .15s'
      }}>
        ← Dashboard
      </a>
      <span style={{ color: 'rgba(255,255,255,.4)', fontSize: 12 }}>
        Vista de tu tienda pública · {user.businessName || user.name}
      </span>
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
  const [paymentData, setPaymentData] = useState(null)  // { preferenceId, orderId, amount, mpPublicKey }
  const isAdmin = (() => { try { return !!JSON.parse(localStorage.getItem('ab_user')) } catch { return false } })()
  const [paymentStatus, setPaymentStatus] = useState(null)
  const [paymentMethod, setPaymentMethod] = useState('online')
  const [customer, setCustomer] = useState({ name: '', phone: '', email: '', address: '', mapsUrl: '', lat: null, lng: null })
  const [locating, setLocating] = useState(false)
  const [locationAccuracy, setLocationAccuracy] = useState(null)
  const [showMap, setShowMap] = useState(false)
  const [mapCenter, setMapCenter] = useState({ lat: 19.4326, lng: -99.1332 })
  const [locationMissing, setLocationMissing] = useState(false)
  const locationSectionRef = useRef(null)
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')
  const [logoError, setLogoError] = useState(false)
  const [bannerError, setBannerError] = useState(false)

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

  const getLocation = () => {
    if (!navigator.geolocation) {
      setShowMap(true)
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setMapCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setLocating(false)
        setShowMap(true)
      },
      () => {
        setLocating(false)
        setShowMap(true)
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )
  }

  const handleMapConfirm = (lat, lng, mapsUrl) => {
    setCustomer(c => ({ ...c, lat, lng, mapsUrl }))
    setShowMap(false)
    setLocationAccuracy(null)
    setLocationMissing(false)
    show('Ubicación exacta confirmada', 'success')
  }

  const placeOrder = async (e) => {
    e.preventDefault()
    // Ubicación exacta OBLIGATORIA: sin pin confirmado no se envía el pedido
    if (!customer.lat || !customer.lng) {
      setLocationMissing(true)
      show('Debes confirmar tu ubicación exacta de entrega para continuar', 'error')
      locationSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      if (!showMap) getLocation()
      return
    }
    setOrdering(true)
    try {
      const res = await storeApi.placeOrder(slug, {
        customerName:    customer.name,
        customerPhone:   customer.phone,
        customerEmail:   customer.email,
        deliveryAddress: customer.address,
        mapsUrl:         customer.mapsUrl,
        deliveryLat:     customer.lat,
        deliveryLng:     customer.lng,
        items: cart.map(i => ({ productId: i.productId, quantity: i.qty }))
      })
      setOrderResult(res)

      // Pago físico → termina aquí, sin pasar por MercadoPago
      if (paymentMethod === 'physical') {
        setStep('success')
        return
      }

      const mpPublicKey = business?.mpPublicKey
      try {
        const pay = await storeApi.createPayment(slug, {
          orderId: res.id,
          total,
          items: cart.map(i => ({ title: i.name, quantity: i.qty, unit_price: i.price })),
          payerEmail: customer.email || ''
        })

        if (mpPublicKey) {
          await initMP(mpPublicKey)
          setPaymentData({ preferenceId: pay.preferenceId, orderId: res.id, amount: total, mpPublicKey })
          setStep('payment')
        } else {
          const url = pay.initPoint || pay.sandboxPoint
          if (url) { window.open(url, '_blank'); setStep('success'); return }
          setStep('success')
        }
      } catch {
        setStep('success')
      }
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
          <p className="text-soft">
            {paymentMethod === 'physical'
              ? 'Pagarás en efectivo o transferencia al recibir tu pedido. Te contactaremos para coordinar la entrega.'
              : 'Te contactaremos pronto para confirmar y coordinar la entrega.'}
          </p>
          <button className="sf-btn-primary" style={{ marginTop: 24 }}
            onClick={() => { setStep('shop'); setCart([]) }}>
            Seguir comprando
          </button>
        </div>
      </div>
    </div>
  )

  if (step === 'payment' && paymentData) return (
    <div className="sf-page">
      <header className="sf-header-bar">
        <div className="sf-header-inner">
          <img className="sf-header-logo" src={logoSrc} alt={business.name}
            onError={() => setLogoError(true)} />
          <span className="sf-header-name">{business.name}</span>
        </div>
      </header>
      <div className="sf-checkout">
        <div className="sf-checkout-box" style={{ maxWidth: 560 }}>
          <button className="sf-back-btn" onClick={() => setStep('checkout')}>← Volver</button>
          <h2 style={{ marginBottom: 4 }}>Método de pago</h2>
          <p style={{ color: '#64748b', marginBottom: 20, fontSize: 14 }}>
            Total a pagar: <strong>{fmt(paymentData.amount)}</strong>
          </p>
          {paymentStatus === 'pending' ? (
            <div className="sf-success-box" style={{ textAlign: 'center', padding: 32 }}>
              <div style={{ fontSize: 48 }}>⏳</div>
              <h3>Pago en proceso</h3>
              <p className="text-soft">Tu pago está siendo verificado. Te notificaremos cuando se confirme.</p>
              <button className="sf-btn-primary" style={{ marginTop: 20 }}
                onClick={() => { setStep('shop'); setCart([]) }}>Volver a la tienda</button>
            </div>
          ) : (
            <PaymentBrick
              amount={paymentData.amount}
              preferenceId={paymentData.preferenceId}
              orderId={paymentData.orderId}
              slug={slug}
              onSuccess={(status) => {
                if (status === 'pending') { setPaymentStatus('pending') }
                else { setStep('success'); setCart([]) }
              }}
              onError={(msg) => show(msg, 'error')}
            />
          )}
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
            <p style={{ fontSize: 13, color: '#64748b', marginBottom: 12, marginTop: -4 }}>
              Necesitamos tus datos para coordinar la entrega
            </p>

            <div className="input-group">
              <label>Tu nombre completo *</label>
              <input className="input" value={customer.name} placeholder="Ej: Juan Pérez"
                onChange={e => setCustomer(c => ({ ...c, name: e.target.value }))} required />
            </div>

            <div className="input-group">
              <label>WhatsApp / Teléfono *</label>
              <input className="input" value={customer.phone} required
                onChange={e => setCustomer(c => ({ ...c, phone: e.target.value }))}
                placeholder="+52 55 0000 0000" />
            </div>

            <div className="input-group">
              <label>Correo electrónico *</label>
              <input className="input" type="email" value={customer.email} required
                onChange={e => setCustomer(c => ({ ...c, email: e.target.value }))}
                placeholder="tucorreo@gmail.com" />
            </div>

            <div className="input-group">
              <label>Calle y número *</label>
              <input className="input" value={customer.address} required
                onChange={e => setCustomer(c => ({ ...c, address: e.target.value }))}
                placeholder="Ej: Av. Reforma 123, Col. Centro" />
            </div>

            <div className="input-group" ref={locationSectionRef}>
              <label>
                Ubicación exacta de entrega *
                {locationMissing && !(customer.lat && customer.lng) && (
                  <span style={{ color: '#ef4444', fontWeight: 700, marginLeft: 6 }}>(obligatoria)</span>
                )}
              </label>

              {showMap ? (
                <MapPicker
                  initialLat={mapCenter.lat}
                  initialLng={mapCenter.lng}
                  onConfirm={handleMapConfirm}
                  onCancel={() => setShowMap(false)}
                />
              ) : customer.lat && customer.lng ? (
                <div style={{ background: '#f0fdf4', borderRadius: 10, padding: '12px 14px', border: '1px solid #bbf7d0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: '#16a34a' }}>Ubicación exacta confirmada</div>
                      <div style={{ fontSize: 11, color: '#4b5563', marginTop: 3 }}>
                        {customer.lat.toFixed(6)}, {customer.lng.toFixed(6)}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <a href={customer.mapsUrl} target="_blank" rel="noreferrer"
                        style={{ fontSize: 12, color: '#4285f4', fontWeight: 600, textDecoration: 'none' }}>Ver mapa</a>
                      <button type="button"
                        onClick={() => setShowMap(true)}
                        style={{ fontSize: 11, color: '#6366f1', fontWeight: 600, background: 'rgba(99,102,241,.1)', border: '1px solid rgba(99,102,241,.3)', borderRadius: 6, padding: '3px 8px', cursor: 'pointer' }}>
                        Editar
                      </button>
                      <button type="button"
                        onClick={() => { setCustomer(c => ({ ...c, mapsUrl: '', lat: null, lng: null })) }}
                        style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <button type="button" onClick={getLocation} disabled={locating}
                    style={{
                      width: '100%', padding: '13px', borderRadius: 10, cursor: locating ? 'wait' : 'pointer',
                      background: locationMissing
                        ? 'linear-gradient(135deg,#ef4444,#f87171)'
                        : 'linear-gradient(135deg,#6366f1,#818cf8)',
                      color: '#fff',
                      border: locationMissing ? '2px solid #dc2626' : 'none',
                      fontWeight: 700, fontSize: 14, display: 'flex',
                      alignItems: 'center', justifyContent: 'center', gap: 8,
                      boxShadow: locationMissing ? '0 2px 12px rgba(239,68,68,.45)' : '0 2px 8px rgba(99,102,241,.35)'
                    }}>
                    {locating
                      ? <><div className="spinner" style={{ width: 16, height: 16, borderColor: 'rgba(255,255,255,.3)', borderTopColor: '#fff' }} /> Obteniendo ubicación...</>
                      : <><span style={{ fontSize: 18 }}>📍</span> Compartir mi ubicación y marcar en el mapa</>}
                  </button>
                  <div style={{ fontSize: 11, color: locationMissing ? '#ef4444' : '#94a3b8', fontWeight: locationMissing ? 700 : 400, marginTop: 6, textAlign: 'center' }}>
                    {locationMissing
                      ? '⚠️ Sin tu ubicación exacta no podemos enviar el pedido'
                      : 'Obligatorio · acepta compartir tu ubicación y ajusta el pin a tu puerta'}
                  </div>
                </div>
              )}
            </div>

            <div className="input-group" style={{ marginTop: 4 }}>
              <label>Método de pago</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 4 }}>
                <button type="button"
                  onClick={() => setPaymentMethod('online')}
                  style={{
                    padding: '14px 10px', borderRadius: 12, cursor: 'pointer', textAlign: 'center',
                    border: paymentMethod === 'online' ? '2px solid #6366f1' : '2px solid #e2e8f0',
                    background: paymentMethod === 'online' ? 'rgba(99,102,241,.08)' : '#fff',
                    transition: 'all .15s'
                  }}>
                  <div style={{ fontSize: 24, marginBottom: 4 }}>💳</div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: paymentMethod === 'online' ? '#6366f1' : '#374151' }}>
                    Pagar en línea
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>Tarjeta / MercadoPago</div>
                </button>
                <button type="button"
                  onClick={() => setPaymentMethod('physical')}
                  style={{
                    padding: '14px 10px', borderRadius: 12, cursor: 'pointer', textAlign: 'center',
                    border: paymentMethod === 'physical' ? '2px solid #16a34a' : '2px solid #e2e8f0',
                    background: paymentMethod === 'physical' ? 'rgba(22,163,74,.08)' : '#fff',
                    transition: 'all .15s'
                  }}>
                  <div style={{ fontSize: 24, marginBottom: 4 }}>💵</div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: paymentMethod === 'physical' ? '#16a34a' : '#374151' }}>
                    Pagar al recibir
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>Efectivo / transferencia</div>
                </button>
              </div>
            </div>

            <button type="submit" className="sf-btn-primary"
              style={{ width: '100%', marginTop: 12, ...((!customer.lat || !customer.lng) ? { opacity: .55, filter: 'grayscale(.4)' } : {}) }}
              disabled={ordering}>
              {ordering
                ? <div className="spinner" />
                : (!customer.lat || !customer.lng)
                  ? '📍 Confirma tu ubicación para continuar'
                  : `Confirmar pedido — ${fmt(total)}`}
            </button>
          </form>
        </div>
      </div>
    </div>
  )

  return (
    <div className={`sf-page sf-theme-${theme}`} style={isAdmin ? { paddingTop: 41 } : {}}>
      <AdminBar />
      {/* ── HERO BANNER ─────────────────────────────────────────────────── */}
      <div className="sf-hero">
        {/* Degradado de fondo: siempre presente como respaldo si el banner no carga */}
        <div className="sf-hero-bg" />
        {bannerUrl && !bannerError && (
          <>
            <img
              className="sf-hero-banner"
              src={bannerUrl}
              alt=""
              aria-hidden="true"
              onError={() => setBannerError(true)}
            />
            <div className="sf-hero-overlay" />
          </>
        )}
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
          {business.businessHours && <BusinessHours hoursJson={business.businessHours} />}
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
                      ? <img src={p.imageUrl} alt={p.name}
                          onError={(e) => {
                            e.currentTarget.style.display = 'none'
                            e.currentTarget.parentNode.classList.add('sf-product-img--broken')
                          }} />
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
