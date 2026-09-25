import { useRef, useEffect } from 'react'
import { getProductEmoji } from '../../utils/productEmoji'

const fmt = (n) => `$${Number(n || 0).toFixed(2)}`

// Código de barras compacto, siempre visible en la tarjeta de producto.
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

// Tinte de fondo detrás del emoji, acorde al color de categoría del negocio
// (si tiene uno asignado) — le da volumen al placeholder sin usar fotos/IA.
function thumbGradient(color) {
  if (!color) return undefined
  return `linear-gradient(160deg, ${color}22, ${color}0d)`
}

export default function ProductCard({ product: p, rank, onSelect }) {
  const stock = Number(p.stock)
  const agotado = stock <= 0
  const isWeight = p.saleMode === 'WEIGHT' || p.saleMode === 'MIXED'
  const low = stock <= (p.minStock || 5) && !agotado

  return (
    <button
      className={`product-card${agotado ? ' out-of-stock' : ''}`}
      onClick={() => !agotado && onSelect(p)}
      disabled={agotado}
      title={agotado ? 'Sin stock' : `${stock} disponibles`}
    >
      <div className="product-thumb" style={{ background: p.imageUrl ? undefined : thumbGradient(p.category?.color) }}>
        {rank && <span className="product-rank">{rank}</span>}
        {isWeight && (
          <span className="product-weight-badge" title="Se vende por peso">
            ⚖️ {p.pricePerKg ? `${fmt(p.pricePerKg)}/${p.baseUnit || 'kg'}` : `/${p.baseUnit || 'kg'}`}
          </span>
        )}
        {p.imageUrl
          ? <img src={p.imageUrl} alt={p.name} />
          : <span className="product-thumb-placeholder">{getProductEmoji(p.name, p.category?.name) || '📦'}</span>}
      </div>
      <div className="product-info">
        <div className="product-name">{p.name}</div>
        <div className="product-price">
          {isWeight && p.pricePerKg ? `${fmt(p.pricePerKg)} / ${p.baseUnit || 'kg'}` : fmt(p.price)}
        </div>
        <div className={`product-stock${low ? ' low' : ''}`}>
          {agotado ? 'Agotado' : low ? `⚠ ${stock}` : `${stock} disp.`}
        </div>
        <CardBarcode code={p.barcode} />
      </div>
    </button>
  )
}
