import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../store/AuthContext'
import { purchases as purchasesApi, inventory as inventoryApi } from '../api'
import './Purchases.css'

const fmt = (n) => Number(n || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
const fmtDate = (s) => new Date(s).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

export default function Purchases() {
  const { user } = useAuth()
  const [history, setHistory] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [expanded, setExpanded] = useState(null)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Formulario nueva compra
  const [supplier, setSupplier] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState([{ productId: '', qty: '', cost: '' }])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [hist, prods] = await Promise.all([
        purchasesApi.list(),
        inventoryApi.list(),
      ])
      setHistory(hist)
      setProducts(prods)
    } catch (e) {
      setError('Error al cargar datos')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const addLine = () => setLines(l => [...l, { productId: '', qty: '', cost: '' }])
  const removeLine = (i) => setLines(l => l.filter((_, idx) => idx !== i))
  const updateLine = (i, field, val) => setLines(l => l.map((ln, idx) => idx === i ? { ...ln, [field]: val } : ln))

  const autoFillCost = (i, productId) => {
    const p = products.find(p => p.id === productId)
    if (p?.cost) updateLine(i, 'cost', p.cost)
    else updateLine(i, 'productId', productId)
  }

  const lineTotal = (ln) => {
    const q = parseFloat(ln.qty) || 0
    const c = parseFloat(ln.cost) || 0
    return q * c
  }

  const grandTotal = lines.reduce((s, l) => s + lineTotal(l), 0)

  const handleSave = async () => {
    setError('')
    const validLines = lines.filter(l => l.productId && parseFloat(l.qty) > 0 && parseFloat(l.cost) >= 0)
    if (validLines.length === 0) { setError('Agrega al menos un producto con cantidad y costo'); return }

    setSaving(true)
    try {
      await purchasesApi.create({
        supplierName: supplier || null,
        notes: notes || null,
        branchId: user.branchId || null,
        items: validLines.map(l => ({
          productId: l.productId,
          quantity: parseFloat(l.qty),
          unitCost: parseFloat(l.cost),
        })),
      })
      setSuccess('Compra registrada — stock actualizado')
      setShowForm(false)
      setSupplier('')
      setNotes('')
      setLines([{ productId: '', qty: '', cost: '' }])
      load()
      setTimeout(() => setSuccess(''), 4000)
    } catch (e) {
      setError(e?.error || e?.message || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const filtered = history.filter(h =>
    !search || (h.supplierName || '').toLowerCase().includes(search.toLowerCase())
  )

  const filteredProducts = (q) => products.filter(p =>
    !q || p.name.toLowerCase().includes(q.toLowerCase())
  )

  return (
    <div className="pur-page">
      <div className="pur-header">
        <div>
          <h1 className="pur-title">Compras a Proveedores</h1>
          <p className="pur-sub">Registra entradas de mercancía y actualiza costos automáticamente</p>
        </div>
        <button className="pur-btn-new" onClick={() => setShowForm(true)}>
          + Nueva Compra
        </button>
      </div>

      {/* Qué es este apartado — guía rápida para el dueño */}
      <div style={{
        background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 12,
        padding: '14px 18px', marginBottom: 20, fontSize: 13.5, color: '#3730a3', lineHeight: 1.65,
      }}>
        <strong>📦 El control de lo que le compras a tus proveedores.</strong> Aquí registras la
        mercancía que te surten tus proveedores (refresquero, abarrotero, panadero, etc.). Al guardar
        una compra, el stock de tus productos sube y su costo se actualiza automáticamente.
        <span style={{ display: 'block', marginTop: 6 }}>
          <strong>1.</strong> Toca <strong>"+ Nueva Compra"</strong>, escribe el nombre del proveedor y
          agrega los productos con su cantidad y costo. &nbsp;
          <strong>2.</strong> Si el proveedor te dejó la mercancía fiada (a crédito), anótalo en el campo{' '}
          <strong>"Notas"</strong> — por ejemplo: <em>"Fiado: debo $500, el cobrador pasa el viernes"</em>. &nbsp;
          <strong>3.</strong> Cuando pase el cobrador, busca aquí al proveedor y abre su compra para ver
          en las notas cuánto le debes y cuándo toca pagarle.
        </span>
      </div>

      {success && <div className="pur-success">{success}</div>}
      {error && !showForm && <div className="pur-error">{error}</div>}

      {/* Formulario nueva compra */}
      {showForm && (
        <div className="pur-form-card">
          <div className="pur-form-head">
            <h2>Nueva Compra</h2>
            <button className="pur-close" onClick={() => { setShowForm(false); setError('') }}>✕</button>
          </div>

          <div className="pur-form-meta">
            <div className="pur-field">
              <label>Proveedor</label>
              <input
                placeholder="Nombre del proveedor (opcional)"
                value={supplier}
                onChange={e => setSupplier(e.target.value)}
              />
            </div>
            <div className="pur-field">
              <label>Notas</label>
              <input
                placeholder="Número de factura, notas…"
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </div>
          </div>

          <div className="pur-lines">
            <div className="pur-lines-head">
              <span>Producto</span>
              <span>Cantidad</span>
              <span>Costo unitario</span>
              <span>Subtotal</span>
              <span></span>
            </div>

            {lines.map((ln, i) => {
              const [q, setQ] = [ln.qty, (v) => updateLine(i, 'qty', v)]
              const [c, setC] = [ln.cost, (v) => updateLine(i, 'cost', v)]
              return (
                <div className="pur-line" key={i}>
                  <select
                    value={ln.productId}
                    onChange={e => { updateLine(i, 'productId', e.target.value); autoFillCost(i, e.target.value) }}
                  >
                    <option value="">— Seleccionar producto —</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Cantidad"
                    value={ln.qty}
                    onChange={e => updateLine(i, 'qty', e.target.value)}
                  />
                  <div className="pur-cost-wrap">
                    <span>$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={ln.cost}
                      onChange={e => updateLine(i, 'cost', e.target.value)}
                    />
                  </div>
                  <span className="pur-line-sub">{fmt(lineTotal(ln))}</span>
                  {lines.length > 1 && (
                    <button className="pur-rm" onClick={() => removeLine(i)}>✕</button>
                  )}
                </div>
              )
            })}

            <button className="pur-add-line" onClick={addLine}>+ Agregar producto</button>
          </div>

          {error && <div className="pur-error">{error}</div>}

          <div className="pur-form-footer">
            <div className="pur-total">
              Total: <strong>{fmt(grandTotal)}</strong>
            </div>
            <div className="pur-form-actions">
              <button className="pur-btn-cancel" onClick={() => { setShowForm(false); setError('') }}>Cancelar</button>
              <button className="pur-btn-save" onClick={handleSave} disabled={saving}>
                {saving ? 'Guardando…' : '✓ Guardar compra'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Historial */}
      <div className="pur-section">
        <div className="pur-search-wrap">
          <input
            className="pur-search"
            placeholder="Buscar por proveedor…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="pur-empty">Cargando…</div>
        ) : filtered.length === 0 ? (
          <div className="pur-empty">
            <div style={{ fontSize: '2.5rem' }}>📦</div>
            <p>Sin compras registradas</p>
            <button className="pur-btn-new" onClick={() => setShowForm(true)}>Registrar primera compra</button>
          </div>
        ) : (
          <div className="pur-list">
            {filtered.map(p => (
              <div key={p.id} className="pur-item">
                <div className="pur-item-head" onClick={() => setExpanded(expanded === p.id ? null : p.id)}>
                  <div className="pur-item-left">
                    <div className="pur-item-icon">🧾</div>
                    <div>
                      <div className="pur-item-supplier">{p.supplierName || 'Sin proveedor'}</div>
                      <div className="pur-item-date">{fmtDate(p.createdAt)} · {p.items?.length} producto(s)</div>
                    </div>
                  </div>
                  <div className="pur-item-right">
                    <span className="pur-item-total">{fmt(p.total)}</span>
                    <span className="pur-chevron">{expanded === p.id ? '▲' : '▼'}</span>
                  </div>
                </div>

                {expanded === p.id && (
                  <div className="pur-item-detail">
                    {p.notes && <p className="pur-item-notes">📝 {p.notes}</p>}
                    <table className="pur-detail-table">
                      <thead>
                        <tr><th>Producto</th><th>Cantidad</th><th>Costo unit.</th><th>Subtotal</th></tr>
                      </thead>
                      <tbody>
                        {p.items?.map((it, idx) => (
                          <tr key={idx}>
                            <td>{it.productName}</td>
                            <td>{it.quantity}</td>
                            <td>{fmt(it.unitCost)}</td>
                            <td>{fmt(it.subtotal)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
