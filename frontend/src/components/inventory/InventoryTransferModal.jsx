import { useEffect, useMemo, useState } from 'react'
import { inventory as inventoryApi } from '../../api'
import { useToast } from '../../store/ToastContext'
import './InventoryTransferModal.css'

const formatQty = value => Number(value || 0).toLocaleString('es-MX', { maximumFractionDigits: 4 })

export default function InventoryTransferModal({ accounts, currentBusinessName, onClose }) {
  const { show } = useToast()
  const [products, setProducts] = useState([])
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [tab, setTab] = useState('transfer')
  const [search, setSearch] = useState('')
  const [productId, setProductId] = useState('')
  const [destinationId, setDestinationId] = useState(accounts[0]?.businessId || '')
  const [quantity, setQuantity] = useState('1')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    Promise.all([inventoryApi.list(), inventoryApi.transferHistory()])
      .then(([items, transfers]) => { setProducts(items || []); setHistory(transfers || []) })
      .catch(err => show(err?.error || 'No se pudo cargar el inventario', 'error'))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return products.filter(p => Number(p.stock) > 0).filter(p => !term ||
      [p.name, p.sku, p.barcode].some(v => String(v || '').toLowerCase().includes(term)))
  }, [products, search])
  const selected = products.find(p => p.id === productId)
  const destination = accounts.find(a => a.businessId === destinationId)
  const amount = Number(quantity)
  const valid = selected && destination && amount > 0 && amount <= Number(selected.stock)

  const submit = async event => {
    event.preventDefault()
    if (!valid) return
    setSending(true)
    try {
      const result = await inventoryApi.transfer({
        sourceProductId: selected.id,
        destinationBusinessId: destination.businessId,
        destinationToken: destination.token,
        quantity: amount,
        notes,
      })
      setProducts(prev => prev.map(p => p.id === selected.id ? { ...p, stock: Number(p.stock) - amount } : p))
      setHistory(prev => [result, ...prev])
      setProductId(''); setQuantity('1'); setNotes(''); setTab('history')
      show(`Transferencia de ${result.productName} completada`, 'success')
    } catch (err) {
      show(err?.error || 'No se pudo completar la transferencia', 'error')
    } finally { setSending(false) }
  }

  return (
    <div className="transfer-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="transfer-modal" role="dialog" aria-modal="true">
        <header className="transfer-header">
          <div><small>INVENTARIO ENTRE NEGOCIOS</small><h2>↔ Transferir productos</h2><p>Salida de <b>{currentBusinessName}</b> y entrada automática en la tienda destino.</p></div>
          <button onClick={onClose} aria-label="Cerrar">×</button>
        </header>
        <nav className="transfer-tabs">
          <button className={tab === 'transfer' ? 'active' : ''} onClick={() => setTab('transfer')}>Nueva transferencia</button>
          <button className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}>Historial</button>
        </nav>

        {loading ? <div className="transfer-empty"><div className="spinner" /> Cargando...</div> : tab === 'transfer' ? (
          <form className="transfer-body" onSubmit={submit}>
            <section className="transfer-catalog">
              <label>1. Selecciona un producto</label>
              <input className="input" placeholder="Buscar por nombre, SKU o código..." value={search} onChange={e => setSearch(e.target.value)} />
              <div className="transfer-grid">
                {filtered.map(product => (
                  <button type="button" key={product.id} className={productId === product.id ? 'selected' : ''} onClick={() => setProductId(product.id)}>
                    <span className="transfer-photo">{product.imageUrl ? <img src={product.imageUrl} alt="" /> : '📦'}</span>
                    <span className="transfer-product-info"><b>{product.name}</b><small>{product.sku || product.barcode || 'Sin código'}</small><em>Stock: {formatQty(product.stock)} {product.baseUnit === 'unit' ? 'pzas' : product.baseUnit}</em></span>
                    <i>✓</i>
                  </button>
                ))}
                {!filtered.length && <div className="transfer-empty">No hay productos disponibles.</div>}
              </div>
            </section>
            <aside className="transfer-ticket">
              <h3>Resumen</h3>
              <label>Tienda destino</label>
              <select className="input" value={destinationId} onChange={e => setDestinationId(e.target.value)}>
                {accounts.map(a => <option key={a.businessId} value={a.businessId}>{a.businessName}</option>)}
              </select>
              <label>Cantidad</label>
              <div className="transfer-quantity">
                <button type="button" onClick={() => setQuantity(String(Math.max(0, amount - 1)))}>−</button>
                <input
                  type="number"
                  min={selected?.allowsDecimal ? '0.0001' : '1'}
                  step={selected?.allowsDecimal ? '0.0001' : '1'}
                  max={selected?.stock}
                  value={quantity}
                  onChange={e => setQuantity(e.target.value)}
                />
                <button type="button" onClick={() => setQuantity(String(amount + 1))}>+</button>
              </div>
              {selected && amount > Number(selected.stock) && <small className="transfer-error">Stock insuficiente.</small>}
              <label>Nota opcional</label>
              <textarea className="input" rows="2" maxLength="500" placeholder="Ej. Reposición semanal" value={notes} onChange={e => setNotes(e.target.value)} />
              <div className="transfer-summary">
                <p><span>Producto</span><b>{selected?.name || '—'}</b></p>
                <p><span>Origen</span><b>{currentBusinessName}</b></p>
                <p><span>Destino</span><b>{destination?.businessName || '—'}</b></p>
                <p><span>Cantidad</span><b>{valid ? formatQty(amount) : '—'} {selected?.baseUnit === 'unit' ? 'pzas' : selected?.baseUnit}</b></p>
              </div>
              <button className="transfer-submit" type="submit" disabled={!valid || sending}>{sending ? 'Transfiriendo...' : 'Confirmar transferencia →'}</button>
              <small className="transfer-secure">🔒 Autorización de ambas tiendas</small>
            </aside>
          </form>
        ) : (
          <section className="transfer-history">
            {!history.length ? <div className="transfer-empty">Aún no hay transferencias.</div> : history.map(item => (
              <article key={item.id}>
                <strong className={item.direction === 'OUT' ? 'out' : 'in'}>{item.direction === 'OUT' ? 'SALIDA' : 'ENTRADA'}</strong>
                <div><b>{item.productName}</b><span>{item.direction === 'OUT' ? `Hacia ${item.destinationBusinessName}` : `Desde ${item.sourceBusinessName}`}</span>{item.notes && <small>{item.notes}</small>}</div>
                <p>{item.direction === 'OUT' ? '−' : '+'}{formatQty(item.quantity)} {item.unit === 'unit' ? 'pzas' : item.unit}<small>{new Date(item.createdAt).toLocaleString('es-MX')}</small></p>
              </article>
            ))}
          </section>
        )}
      </div>
    </div>
  )
}
