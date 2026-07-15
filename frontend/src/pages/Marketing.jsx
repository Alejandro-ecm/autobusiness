import { useState, useEffect } from 'react'
import { useAuth } from '../store/AuthContext'
import client from '../api/client'
import { useToast } from '../store/ToastContext'
import StoreQRCode from '../components/StoreQRCode'
import './Marketing.css'

// ── Canvas image generator ──────────────────────────────────────────────────
const SCHEMES = [
  { id: 'purple', bg: ['#6366f1', '#4f46e5'], accent: '#fbbf24', cta: '#3730a3' },
  { id: 'green',  bg: ['#10b981', '#059669'], accent: '#fde68a', cta: '#065f46' },
  { id: 'red',    bg: ['#ef4444', '#dc2626'], accent: '#fde68a', cta: '#991b1b' },
  { id: 'dark',   bg: ['#1e293b', '#0f172a'], accent: '#6366f1', cta: '#1e1b4b' },
]

function rRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function wrapText(ctx, text, x, y, maxW, lineH) {
  const words = text.split(' ')
  let line = ''; const lines = []
  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = word }
    else { line = test }
  }
  if (line) lines.push(line)
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * lineH))
  return lines.length
}

function generatePromoImage({ businessName, productName, price, originalPrice, discount, scheme, platform }) {
  const SIZE = platform === 'facebook' ? { w: 1200, h: 628 } : { w: 1080, h: 1080 }
  const { w, h } = SIZE
  const s = w / 800
  const canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  const ctx = canvas.getContext('2d')

  // Background
  const grad = ctx.createLinearGradient(0, 0, w, h)
  grad.addColorStop(0, scheme.bg[0]); grad.addColorStop(1, scheme.bg[1])
  ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h)

  // Decorative circles
  ctx.fillStyle = 'rgba(255,255,255,0.07)'
  ctx.beginPath(); ctx.arc(w * 0.88, -h * 0.05, h * 0.42, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.04)'
  ctx.beginPath(); ctx.arc(-w * 0.05, h * 0.9, h * 0.28, 0, Math.PI * 2); ctx.fill()

  // Business name pill
  ctx.fillStyle = 'rgba(255,255,255,0.18)'
  rRect(ctx, 44 * s, 40 * s, 230 * s, 40 * s, 20 * s); ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.font = `600 ${16 * s}px Arial,sans-serif`
  ctx.textBaseline = 'middle'
  ctx.fillText(businessName.substring(0, 24), 64 * s, 60 * s)

  // Discount badge
  const disc = discount > 0 ? discount : (originalPrice && price < originalPrice
    ? Math.round((1 - price / originalPrice) * 100) : 0)
  if (disc > 0) {
    ctx.fillStyle = scheme.accent
    ctx.beginPath(); ctx.arc(w - 88 * s, 104 * s, 68 * s, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#1a1a1a'
    ctx.font = `bold ${32 * s}px Arial,sans-serif`
    ctx.textAlign = 'center'
    ctx.fillText(`-${disc}%`, w - 88 * s, 98 * s)
    ctx.font = `700 ${14 * s}px Arial,sans-serif`
    ctx.fillText('OFERTA', w - 88 * s, 124 * s)
    ctx.textAlign = 'left'
  }

  // Product name
  ctx.fillStyle = '#fff'
  const titleSz = platform === 'facebook' ? 54 : 62
  ctx.font = `800 ${titleSz * s}px Arial,sans-serif`
  ctx.textBaseline = 'top'
  const maxTW = (disc > 0 ? 570 : 700) * s
  const tLines = wrapText(ctx, productName, 50 * s, h * 0.38, maxTW, (titleSz + 8) * s)

  // Prices
  const pY = h * 0.38 + tLines * (titleSz + 8) * s + 24 * s
  if (originalPrice && Number(originalPrice) > Number(price)) {
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.font = `${26 * s}px Arial,sans-serif`
    const origTxt = `$${Number(originalPrice).toFixed(0)}`
    ctx.fillText(origTxt, 50 * s, pY)
    const origW = ctx.measureText(origTxt).width
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2 * s
    ctx.beginPath(); ctx.moveTo(50 * s, pY + 14 * s); ctx.lineTo(50 * s + origW, pY + 14 * s); ctx.stroke()
  }
  ctx.fillStyle = scheme.accent
  ctx.font = `800 ${78 * s}px Arial,sans-serif`
  ctx.fillText(`$${Number(price).toFixed(0)} MXN`, 50 * s, pY + (originalPrice ? 34 : 0) * s)

  // CTA bar
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(0, h - 80 * s, w, 80 * s)
  ctx.fillStyle = '#fff'
  ctx.font = `700 ${20 * s}px Arial,sans-serif`
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText('📲 Contáctanos ya · Precio válido hoy', w / 2, h - 40 * s)
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'

  return canvas.toDataURL('image/jpeg', 0.92)
}

// ── Text templates ───────────────────────────────────────────────────────────
function buildText(post, platform, businessName, templateType) {
  const name = post.product || 'Producto especial'
  const price = post.discountedPrice ? `$${Number(post.discountedPrice).toFixed(0)}` : '$0'
  const orig = post.originalPrice ? `$${Number(post.originalPrice).toFixed(0)}` : ''
  const disc = post.discountedPrice && post.originalPrice
    ? Math.round((1 - post.discountedPrice / post.originalPrice) * 100) : 20

  if (templateType === 'stock_alert') {
    const texts = {
      whatsapp: `📦 *¡ÚLTIMAS UNIDADES!*\n\n🔥 *${name}*\nSolo quedan pocas unidades disponibles.\n\nPrecio: *${price} MXN*\n\n⏰ No dejes pasar esta oportunidad.\n📲 Escríbenos AHORA para apartar el tuyo.\n\n_${businessName}_`,
      facebook: `📦 ¡ATENCIÓN! Últimas unidades de ${name}\n\nPrecio: ${price} MXN\n\n✅ Entrega inmediata\n✅ Calidad garantizada\n\n⚡ Una vez que se agote, no habrá más existencias.\n\n¡Escríbenos para más información!`,
      instagram: `📦 Últimas unidades disponibles ⚡\n\n${name} — solo ${price} MXN\n\n¿Lo quieres? Escríbenos al DM 💬\n🔗 Link en bio\n\n#agotandose #limitado #${businessName.replace(/\s+/g, '').toLowerCase()} #oferta #Mexico`,
    }
    return texts[platform] || texts.whatsapp
  }

  if (templateType === 'announcement') {
    const texts = {
      whatsapp: `📢 *¡NOVEDAD EN ${businessName.toUpperCase()}!*\n\nEstamos muy emocionados de presentarles:\n\n✨ *${name}*\n💰 Precio especial de lanzamiento: *${price} MXN*\n\n¡Sé de los primeros en tenerlo!\n📲 Contáctanos hoy mismo.`,
      facebook: `🎉 ¡Gran novedad en ${businessName}!\n\nPresentamos: ${name}\n💰 Precio de lanzamiento: ${price} MXN\n\n✨ Lo mejor del mercado para ti\n✅ Disponible desde hoy\n\n¡Compártelo con quien lo necesite!`,
      instagram: `✨ ¡Novedad! ✨\n\nTe presentamos ${name} a solo ${price} MXN 🚀\n\n¿Te interesa? DM para más info 💬\n🛒 Link en bio\n\n#nuevo #novedad #${businessName.replace(/\s+/g, '').toLowerCase()} #lanzamiento #Mexico`,
    }
    return texts[platform] || texts.whatsapp
  }

  // Default: promotion
  const texts = {
    whatsapp: `🔥 *¡OFERTA ESPECIAL!* 🔥\n\n📦 *${name}*\n${orig ? `~~${orig}~~ → ` : ''}*${price} MXN* (-${disc}% OFF)\n\n✅ Stock disponible\n⏰ ¡Oferta por tiempo limitado!\n📲 Escríbenos para apartar el tuyo.\n\n_${businessName}_`,
    facebook: `📣 ¡Aprovecha esta oferta increíble!\n\n${name} con ${disc}% de descuento 🔥\n\n💰 ${orig ? `Antes: ${orig} → ` : ''}Ahora: ${price} MXN\n\n✅ Entrega inmediata\n✅ Calidad garantizada\n\n👇 Envíanos un mensaje para más información. ¡Comparte con tus amigos!`,
    instagram: `🔥 ¡Oferta que no puedes perderte! 🔥\n\n${name}\n${orig ? `~~${orig}~~ → ` : ''}${price} MXN — ${disc}% OFF 💸\n\n💬 DM para más info\n🛒 Link en bio\n\n#oferta #descuento #${businessName.replace(/\s+/g, '').toLowerCase()} #promo #MexicoBusiness`,
  }
  return texts[platform] || texts.whatsapp
}

// ── Platform icons / colors ──────────────────────────────────────────────────
const PLATFORMS = [
  { id: 'whatsapp', label: 'WhatsApp', icon: '💬', cls: 'badge-wa', color: '#128C7E' },
  { id: 'facebook', label: 'Facebook', icon: '📘', cls: 'badge-fb', color: '#1877F2' },
  { id: 'instagram', label: 'Instagram', icon: '📸', cls: 'badge-ig', color: '#E1306C' },
]

const TEMPLATES = {
  promotion: 'Promoción',
  stock_alert: 'Últimas unidades',
  announcement: 'Anuncio',
}

// ── Store invite templates ───────────────────────────────────────────────────
const STORE_PLATFORMS = [
  { id: 'whatsapp', label: 'WhatsApp', color: '#25D366', icon: '💬' },
  { id: 'facebook', label: 'Facebook', color: '#1877F2', icon: '📘' },
  { id: 'tiktok',   label: 'TikTok',   color: '#000',    icon: '🎵' },
  { id: 'instagram',label: 'Instagram',color: '#E1306C', icon: '📸' },
]

function buildStoreText(platform, businessName, storeUrl) {
  const name = businessName || 'Mi Negocio'
  const url  = storeUrl
  switch (platform) {
    case 'whatsapp':
      return `🛍️ *¡Visita nuestra tienda online!*\n\nEn *${name}* encontrarás los mejores productos al mejor precio.\n\n✅ Catálogo completo\n✅ Pedidos fáciles y rápidos\n✅ Pago seguro\n\n🔗 Entra aquí: ${url}\n\n¡Comparte con tus amigos! 🙌`
    case 'facebook':
      return `🛍️ ¡Ya tenemos tienda online! 🎉\n\n${name} ahora te permite comprar desde donde estés.\n\n✨ Explora todos nuestros productos\n📦 Pedidos rápidos y sencillos\n💳 Pago seguro\n\n👉 Visítanos ahora: ${url}\n\n¡Dale "Me gusta" y compártelo con tus amigos para que no se lo pierdan! ❤️`
    case 'tiktok':
      return `POV: Encontraste la mejor tienda online 🛒✨\n\n@${name.replace(/\s+/g, '').toLowerCase()} ya está en línea y tiene todo lo que necesitas\n\n🔗 Link en bio: ${url}\n\n#tiendaonline #comprasenlinea #mexico #negociolocal #${name.replace(/\s+/g, '').toLowerCase()}`
    case 'instagram':
      return `🛍️ ¡Ya puedes comprar desde casa! ✨\n\nNuestra tienda online ya está lista para ti 🎉\n\n📦 Todos nuestros productos disponibles\n⚡ Pedidos en minutos\n🏪 La misma calidad de siempre\n\n🔗 Link en bio o entra directo:\n${url}\n\n¡Etiqueta a alguien que le encantaría conocernos! 👇\n\n#tiendaonline #${name.replace(/\s+/g, '').toLowerCase()} #comprasenlinea #negociolocal #mexico #emprendimiento`
    default: return ''
  }
}

function StoreInviteSection({ user, show }) {
  const storeUrl = `${window.location.origin}/tienda/${user?.businessSlug || ''}`
  const [activePlatform, setActivePlatform] = useState('whatsapp')
  const [copied, setCopied] = useState(false)
  const [showQR, setShowQR] = useState(false)
  const text = buildStoreText(activePlatform, user?.businessName, storeUrl)

  const copy = (content) => {
    navigator.clipboard.writeText(content)
      .then(() => { show('Texto copiado', 'success'); setCopied(true); setTimeout(() => setCopied(false), 2000) })
      .catch(() => show('No se pudo copiar', 'error'))
  }

  const copyLink = () => {
    navigator.clipboard.writeText(storeUrl)
      .then(() => show('Link copiado', 'success'))
      .catch(() => show('No se pudo copiar', 'error'))
  }

  const shareWA = () => {
    const msg = encodeURIComponent(buildStoreText('whatsapp', user?.businessName, storeUrl))
    window.open(`https://api.whatsapp.com/send?text=${msg}`, '_blank')
  }

  const shareFB = () => {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(storeUrl)}`, '_blank')
  }

  return (
    <div className="card mkt-store-invite">
      <div className="mkt-store-invite-head">
        <div>
          <h3 className="section-title" style={{ marginBottom: 4 }}>🏪 Invita a conocer tu tienda online</h3>
          <p className="text-soft" style={{ fontSize: 13 }}>
            Comparte tu tienda con clientes en redes sociales y haz que ellos la difundan.
          </p>
        </div>
        <div className="mkt-store-link-box">
          <span className="mkt-store-link-url">{storeUrl}</span>
          <button className="btn btn-sm btn-outline" onClick={copyLink}>📋 Copiar link</button>
          <button className="btn btn-sm btn-outline" onClick={() => setShowQR(v => !v)}>
            📱 Código QR
          </button>
          <a className="btn btn-sm btn-primary" href={storeUrl} target="_blank" rel="noreferrer">
            👁 Ver tienda
          </a>
        </div>
      </div>

      {showQR && (
        <div style={{ marginBottom: 20 }}>
          <StoreQRCode storeUrl={storeUrl} businessName={user?.businessName} show={show} />
        </div>
      )}

      <div className="mkt-store-platforms">
        {STORE_PLATFORMS.map(p => (
          <button
            key={p.id}
            className={`mkt-store-plat-btn ${activePlatform === p.id ? 'active' : ''}`}
            style={activePlatform === p.id ? { background: p.color, borderColor: p.color, color: '#fff' } : { '--hc': p.color }}
            onClick={() => setActivePlatform(p.id)}
          >
            {p.icon} {p.label}
          </button>
        ))}
      </div>

      <div style={{ position: 'relative' }}>
        <textarea
          className="mkt-store-textarea"
          value={text}
          readOnly
          rows={activePlatform === 'instagram' ? 12 : 9}
        />
        <div className="mkt-store-actions">
          <button className="btn btn-outline" onClick={() => copy(text)}>
            {copied ? '✅ Copiado' : '📋 Copiar texto'}
          </button>
          {activePlatform === 'whatsapp' && (
            <button className="btn btn-primary" style={{ background: '#25D366', borderColor: '#25D366' }}
              onClick={shareWA}>
              💬 Abrir WhatsApp
            </button>
          )}
          {activePlatform === 'facebook' && (
            <button className="btn btn-primary" style={{ background: '#1877F2', borderColor: '#1877F2' }}
              onClick={shareFB}>
              📘 Compartir en Facebook
            </button>
          )}
          {(activePlatform === 'tiktok' || activePlatform === 'instagram') && (
            <button className="btn btn-outline" onClick={copyLink}>
              🔗 Copiar link para bio
            </button>
          )}
        </div>
      </div>

      <div className="mkt-store-tip">
        💡 <strong>Tip:</strong> Pídele a tus clientes que compartan tu tienda — cada persona que la recomienda te trae nuevos compradores sin que pagues publicidad.
      </div>
    </div>
  )
}

export default function Marketing() {
  const { user } = useAuth()
  const { show } = useToast()
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(false)
  const [generated, setGenerated] = useState(false)
  const [templateType, setTemplateType] = useState('promotion')
  const [activePlatform, setActivePlatform] = useState('whatsapp')
  const [activeScheme, setActiveScheme] = useState(0)
  const [history, setHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem('mkt_history') || '[]') } catch { return [] }
  })
  const [showHistory, setShowHistory] = useState(false)
  const [imgPreviews, setImgPreviews] = useState({})
  const [editedTexts, setEditedTexts] = useState({})

  const generate = async () => {
    setLoading(true)
    try {
      const res = await client.post(`/ai-engine/marketing/${user?.businessId}/generate`, { type: templateType })
      const raw = res?.posts || []
      setPosts(raw)
      setEditedTexts({})
      setGenerated(true)
      if (raw.length > 0) {
        const entry = { date: new Date().toISOString(), type: templateType, posts: raw }
        const updated = [entry, ...history].slice(0, 10)
        setHistory(updated)
        try { localStorage.setItem('mkt_history', JSON.stringify(updated)) } catch {}
      }
    } catch {
      show('Motor de IA no disponible. Usando plantilla de ejemplo.', 'error')
      const fallback = [{
        platform: 'whatsapp', type: templateType,
        product: 'Producto ejemplo', originalPrice: 250, discountedPrice: 200,
        content: buildText({ product: 'Producto ejemplo', originalPrice: 250, discountedPrice: 200 }, 'whatsapp', user?.businessName || 'Mi Negocio', templateType),
      }]
      setPosts(fallback)
      setEditedTexts({})
      setGenerated(true)
    } finally { setLoading(false) }
  }

  // Generate image preview whenever posts, platform, or scheme changes
  useEffect(() => {
    if (!posts.length) return
    const previews = {}
    posts.forEach((post, i) => {
      try {
        previews[i] = generatePromoImage({
          businessName: user?.businessName || 'Mi Negocio',
          productName: post.product || 'Producto',
          price: post.discountedPrice || post.originalPrice || 100,
          originalPrice: post.discountedPrice ? post.originalPrice : null,
          discount: 0,
          scheme: SCHEMES[activeScheme],
          platform: activePlatform,
        })
      } catch { previews[i] = null }
    })
    setImgPreviews(previews)
  }, [posts, activePlatform, activeScheme])

  const copyText = (content) => {
    navigator.clipboard.writeText(content)
      .then(() => show('Texto copiado al portapapeles', 'success'))
      .catch(() => show('No se pudo copiar. Selecciona el texto manualmente.', 'error'))
  }

  const downloadImage = (dataUrl, productName) => {
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = `promo_${activePlatform}_${(productName || 'post').replace(/\s+/g, '_')}.jpg`
    a.click()
    show('Imagen descargada', 'success')
  }

  return (
    <div className="marketing-page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Marketing automático</h1>
          <p className="page-subtitle">Genera contenido para WhatsApp, Facebook e Instagram con imagen y texto</p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {history.length > 0 && (
            <button className="btn btn-outline" onClick={() => setShowHistory(v => !v)}>
              🕐 Historial ({history.length})
            </button>
          )}
          <button className="btn btn-primary" onClick={generate} disabled={loading}>
            {loading ? <><div className="spinner" /> Generando...</> : '✨ Generar contenido'}
          </button>
        </div>
      </div>

      {/* Store invite section */}
      <StoreInviteSection user={user} show={show} />

      {/* Config bar */}
      <div className="mkt-config-bar card">
        <div className="mkt-config-group">
          <span className="mkt-config-label">Tipo de contenido</span>
          <div style={{ display: 'flex', gap: 8 }}>
            {Object.entries(TEMPLATES).map(([val, label]) => (
              <label key={val} className={`mkt-radio-btn ${templateType === val ? 'active' : ''}`}>
                <input type="radio" name="tpl" value={val} checked={templateType === val}
                  onChange={() => setTemplateType(val)} hidden />
                {val === 'promotion' ? '🔥' : val === 'stock_alert' ? '📦' : '📢'} {label}
              </label>
            ))}
          </div>
        </div>
        <div className="mkt-config-group">
          <span className="mkt-config-label">Plataforma</span>
          <div style={{ display: 'flex', gap: 8 }}>
            {PLATFORMS.map(p => (
              <button key={p.id} className={`mkt-platform-btn ${activePlatform === p.id ? 'active' : ''}`}
                style={{ '--p-color': p.color }} onClick={() => setActivePlatform(p.id)}>
                {p.icon} {p.label}
              </button>
            ))}
          </div>
        </div>
        <div className="mkt-config-group">
          <span className="mkt-config-label">Color de imagen</span>
          <div style={{ display: 'flex', gap: 8 }}>
            {SCHEMES.map((sc, i) => (
              <button key={sc.id} className={`mkt-color-dot ${activeScheme === i ? 'active' : ''}`}
                style={{ background: sc.bg[0] }} onClick={() => setActiveScheme(i)}
                title={sc.id} />
            ))}
          </div>
        </div>
      </div>

      {/* History panel */}
      {showHistory && history.length > 0 && (
        <div className="card">
          <h3 className="section-title" style={{ marginBottom: 12 }}>Historial de generaciones</h3>
          {history.map((entry, i) => (
            <div key={i} className="mkt-history-row">
              <div>
                <span className="font-semibold" style={{ fontSize: 13 }}>{TEMPLATES[entry.type] || entry.type}</span>
                <span className="text-soft text-sm" style={{ marginLeft: 10 }}>
                  {new Date(entry.date).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <button className="btn btn-sm btn-outline" onClick={() => { setPosts(entry.posts); setGenerated(true); setShowHistory(false) }}>
                Ver posts
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!generated && (
        <div className="marketing-empty card">
          <div style={{ fontSize: 52 }}>📣</div>
          <h3>Crea contenido para tus redes sociales</h3>
          <p className="text-soft">
            Genera imágenes y textos listos para WhatsApp, Facebook e Instagram.
            Solo haz clic en "Generar contenido" y personaliza el resultado.
          </p>
          <div className="mkt-platforms-preview">
            {PLATFORMS.map(p => (
              <div key={p.id} className="mkt-platform-pill" style={{ background: p.color + '15', color: p.color, border: `1px solid ${p.color}30` }}>
                {p.icon} {p.label}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Posts */}
      {generated && posts.length > 0 && (
        <div className="posts-grid">
          {posts.map((post, i) => {
            const baseText = buildText(post, activePlatform, user?.businessName || 'Mi Negocio', templateType)
            const textKey = `${i}_${activePlatform}`
            const displayText = editedTexts[textKey] !== undefined ? editedTexts[textKey] : baseText
            const imgSrc = imgPreviews[i]
            return (
              <div key={i} className="post-card card">
                <div className="post-header">
                  <span className={`platform-badge platform-badge--${activePlatform}`}>
                    {PLATFORMS.find(p => p.id === activePlatform)?.icon} {PLATFORMS.find(p => p.id === activePlatform)?.label}
                  </span>
                  <span className="badge badge-yellow">{TEMPLATES[templateType]}</span>
                </div>

                {/* Image preview */}
                {imgSrc && (
                  <div className="post-image-wrap">
                    <img src={imgSrc} alt="Imagen promocional" className="post-image" />
                    <button className="post-image-dl" onClick={() => downloadImage(imgSrc, post.product)}>
                      ⬇ Descargar imagen
                    </button>
                  </div>
                )}

                {post.product && (
                  <div className="post-product">
                    Producto: <strong>{post.product}</strong>
                    {post.discountedPrice && (
                      <span className="text-success font-semibold" style={{ marginLeft: 8 }}>
                        ${Number(post.discountedPrice).toFixed(0)} MXN
                        {post.originalPrice && <span className="text-soft"> (antes ${Number(post.originalPrice).toFixed(0)})</span>}
                      </span>
                    )}
                  </div>
                )}

                <div style={{ position: 'relative' }}>
                  <textarea
                    className="post-content"
                    value={displayText}
                    onChange={e => setEditedTexts(prev => ({ ...prev, [textKey]: e.target.value }))}
                    rows={10}
                  />
                  {editedTexts[textKey] !== undefined && (
                    <button
                      className="btn btn-sm btn-outline"
                      style={{ position: 'absolute', top: 8, right: 8, fontSize: 11 }}
                      onClick={() => setEditedTexts(prev => { const n = { ...prev }; delete n[textKey]; return n })}
                    >
                      Restablecer
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => copyText(displayText)}>
                    📋 Copiar texto
                  </button>
                  {imgSrc && (
                    <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => downloadImage(imgSrc, post.product)}>
                      🖼 Descargar imagen
                    </button>
                  )}
                </div>

                {/* Platform switcher */}
                <div style={{ marginTop: 10, display: 'flex', gap: 6 }}>
                  {PLATFORMS.map(p => (
                    <button key={p.id} className={`btn btn-sm ${activePlatform === p.id ? 'btn-primary' : 'btn-outline'}`}
                      style={{ flex: 1, fontSize: 11 }} onClick={() => setActivePlatform(p.id)}>
                      {p.icon}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {generated && posts.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <p className="font-semibold">Sin datos suficientes</p>
          <p className="text-soft">Agrega productos y registra ventas para generar contenido personalizado.</p>
        </div>
      )}
    </div>
  )
}
