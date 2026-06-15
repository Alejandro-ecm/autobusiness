import { useState, useEffect } from 'react'
import { customers as api } from '../api'
import { useToast } from '../store/ToastContext'
import { useAuth } from '../store/AuthContext'
import './Customers.css'

const fmt = (n) => `$${Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`

export default function Customers() {
  const { show }    = useToast()
  const { isOwner } = useAuth()

  const [customers,    setCustomers]    = useState([])
  const [loading,      setLoading]      = useState(true)
  const [search,       setSearch]       = useState('')
  const [showAdd,      setShowAdd]      = useState(false)
  const [selected,     setSelected]     = useState(null)   // customer detail/fiado
  const [txList,       setTxList]       = useState([])
  const [txLoading,    setTxLoading]    = useState(false)
  const [saving,       setSaving]       = useState(false)

  // forms
  const [addForm, setAddForm]   = useState({ name:'', phone:'', email:'', notes:'' })
  const [fiadoAmt, setFiadoAmt] = useState('')
  const [fiadoDesc, setFiadoDesc] = useState('')
  const [payAmt,    setPayAmt]  = useState('')
  const [payDesc,   setPayDesc] = useState('')
  const [activeTab, setActiveTab] = useState('fiado')  // fiado | history

  const load = (q) => {
    api.list(q || '').then(setCustomers).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const openCustomer = async (c) => {
    setSelected(c)
    setTxLoading(true)
    setActiveTab('fiado')
    try {
      const data = await api.transactions(c.id)
      setTxList(data)
    } catch { setTxList([]) }
    finally { setTxLoading(false) }
  }

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!addForm.name.trim()) { show('Nombre requerido', 'error'); return }
    setSaving(true)
    try {
      await api.create(addForm)
      show('Cliente agregado', 'success')
      setShowAdd(false)
      setAddForm({ name:'', phone:'', email:'', notes:'' })
      load()
    } catch (err) { show(err?.error || 'Error', 'error') }
    finally { setSaving(false) }
  }

  const handleFiado = async (e) => {
    e.preventDefault()
    const amount = parseFloat(fiadoAmt)
    if (!amount || amount <= 0) { show('Monto inválido', 'error'); return }
    setSaving(true)
    try {
      await api.addFiado(selected.id, { amount, description: fiadoDesc || 'Compra a crédito' })
      show(`✓ Fiado de ${fmt(amount)} registrado`, 'success')
      setFiadoAmt(''); setFiadoDesc('')
      const [updated, txs] = await Promise.all([api.list(), api.transactions(selected.id)])
      setCustomers(updated)
      setTxList(txs)
      setSelected(updated.find(c => c.id === selected.id) || selected)
    } catch (err) { show(err?.error || 'Error', 'error') }
    finally { setSaving(false) }
  }

  const handlePayment = async (e) => {
    e.preventDefault()
    const amount = parseFloat(payAmt)
    if (!amount || amount <= 0) { show('Monto inválido', 'error'); return }
    setSaving(true)
    try {
      await api.addPayment(selected.id, { amount, description: payDesc || 'Abono' })
      show(`✓ Abono de ${fmt(amount)} registrado`, 'success')
      setPayAmt(''); setPayDesc('')
      const [updated, txs] = await Promise.all([api.list(), api.transactions(selected.id)])
      setCustomers(updated)
      setTxList(txs)
      setSelected(updated.find(c => c.id === selected.id) || selected)
    } catch (err) { show(err?.error || 'Error', 'error') }
    finally { setSaving(false) }
  }

  const handleDelete = async (c, e) => {
    e.stopPropagation()
    if (!window.confirm(`¿Eliminar a ${c.name}? Esta acción no se puede deshacer.`)) return
    try {
      await api.remove(c.id)
      show('Cliente eliminado', 'success')
      if (selected?.id === c.id) setSelected(null)
      load(search)
    } catch (err) { show(err?.error || 'Error al eliminar', 'error') }
  }

  const totalFiado   = customers.reduce((s, c) => s + Number(c.totalCredit || 0), 0)
  const withDebt     = customers.filter(c => Number(c.totalCredit) > 0).length

  if (loading) return <div className="page-loading"><div className="spinner" /></div>

  return (
    <div className="customers-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Clientes &amp; Fiado</h1>
          <p className="page-subtitle">{customers.length} clientes · {withDebt} con saldo pendiente</p>
        </div>
        {isOwner && (
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
            + Agregar cliente
          </button>
        )}
      </div>

      {/* Qué es este apartado — guía rápida para el dueño */}
      <div style={{
        background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 12,
        padding: '14px 18px', marginBottom: 20, fontSize: 13.5, color: '#3730a3', lineHeight: 1.65,
      }}>
        <strong>📒 Tu libreta de fiados digital.</strong> En este apartado anotas lo que tus
        clientes se llevan fiado (a crédito) y llevas el control de cuánto te debe cada quien,
        sin libreta de papel. Así funciona:
        <span style={{ display: 'block', marginTop: 6 }}>
          <strong>1.</strong> Agrega a tu cliente con el botón <strong>"+ Agregar cliente"</strong> (solo necesitas su nombre). &nbsp;
          <strong>2.</strong> Cuando se lleve algo fiado, entra a <strong>"Ver / Fiado"</strong> y apunta el monto. &nbsp;
          <strong>3.</strong> Cuando te pague o abone, regístralo ahí mismo y su deuda baja automáticamente. &nbsp;
          También puedes consultar el historial completo de compras y abonos de cada cliente.
        </span>
      </div>

      {/* Stats */}
      <div className="cust-stats">
        <div className="cust-stat">
          <span className="cust-stat-val">{customers.length}</span>
          <span className="cust-stat-lbl">Total clientes</span>
        </div>
        <div className="cust-stat">
          <span className="cust-stat-val" style={{ color: withDebt > 0 ? '#f59e0b' : '#10b981' }}>{withDebt}</span>
          <span className="cust-stat-lbl">Con fiado pendiente</span>
        </div>
        <div className="cust-stat">
          <span className="cust-stat-val" style={{ color: totalFiado > 0 ? '#ef4444' : '#10b981' }}>{fmt(totalFiado)}</span>
          <span className="cust-stat-lbl">Total por cobrar</span>
        </div>
      </div>

      {/* Search */}
      <input className="input" placeholder="Buscar por nombre o teléfono…"
        value={search}
        onChange={e => { setSearch(e.target.value); load(e.target.value) }}
        style={{ maxWidth: 320, marginBottom: 12 }}
      />

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="inv-table">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Teléfono</th>
              <th>Fiado pendiente</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {customers.map(c => (
              <tr key={c.id}>
                <td>
                  <div className="cust-name-cell">
                    <div className="cust-avatar">{c.name[0].toUpperCase()}</div>
                    <div>
                      <div className="font-semibold">{c.name}</div>
                      {c.notes && <div className="text-soft text-sm">{c.notes}</div>}
                    </div>
                  </div>
                </td>
                <td className="text-soft">{c.phone || '—'}</td>
                <td>
                  {Number(c.totalCredit) > 0
                    ? <span className="badge badge-yellow">{fmt(c.totalCredit)}</span>
                    : <span className="badge badge-green">Al corriente</span>}
                </td>
                <td style={{ display:'flex', gap: 6 }}>
                  <button className="btn btn-sm btn-outline" onClick={() => openCustomer(c)}>
                    Ver / Fiado
                  </button>
                  {isOwner && (
                    <button className="btn btn-sm" style={{ background:'#fee2e2', color:'#dc2626', border:'1px solid #fca5a5' }}
                      onClick={(e) => handleDelete(c, e)}>
                      Eliminar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {customers.length === 0 && (
          <div className="empty-state" style={{ padding: 40, textAlign: 'center' }}>
            <p className="text-soft">No hay clientes registrados</p>
          </div>
        )}
      </div>

      {/* ── Add customer modal ── */}
      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal-box card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Nuevo cliente</h3>
              <button className="modal-close" onClick={() => setShowAdd(false)}>×</button>
            </div>
            <form onSubmit={handleAdd} className="modal-form">
              <div className="input-group">
                <label>Nombre *</label>
                <input className="input" value={addForm.name}
                  onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))} required />
              </div>
              <div className="form-row">
                <div className="input-group">
                  <label>Teléfono</label>
                  <input className="input" value={addForm.phone} inputMode="tel"
                    onChange={e => setAddForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
                <div className="input-group">
                  <label>Email</label>
                  <input className="input" type="email" value={addForm.email}
                    onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))} />
                </div>
              </div>
              <div className="input-group">
                <label>Notas</label>
                <input className="input" value={addForm.notes} placeholder="Ej. colonia, referencia…"
                  onChange={e => setAddForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowAdd(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <div className="spinner" /> : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Customer detail / fiado modal ── */}
      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal-box card cust-detail-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>{selected.name}</h3>
                {selected.phone && <p style={{ margin: 0, fontSize: 13, color: '#1e293b' }}>{selected.phone}</p>}
              </div>
              <button className="modal-close" onClick={() => setSelected(null)}>×</button>
            </div>

            <div className={`cust-balance-banner${Number(selected.totalCredit) > 0 ? ' owed' : ' clear'}`}>
              <span>{Number(selected.totalCredit) > 0 ? 'Saldo pendiente' : 'Sin deuda'}</span>
              <strong>{fmt(selected.totalCredit)}</strong>
            </div>

            <div className="cust-modal-tabs">
              <button className={`cust-tab${activeTab === 'fiado'   ? ' active' : ''}`} onClick={() => setActiveTab('fiado')}>Fiado / Abono</button>
              <button className={`cust-tab${activeTab === 'history' ? ' active' : ''}`} onClick={() => setActiveTab('history')}>Historial</button>
            </div>

            {activeTab === 'fiado' && (
              <div className="cust-fiado-body">
                <form onSubmit={handleFiado} className="cust-fiado-form">
                  <h4>Apuntar fiado</h4>
                  <div className="form-row">
                    <div className="input-group">
                      <label>Monto *</label>
                      <input className="input" type="number" step="0.01" min="0.01"
                        value={fiadoAmt} onChange={e => setFiadoAmt(e.target.value)}
                        placeholder="0.00" inputMode="decimal" />
                    </div>
                    <div className="input-group">
                      <label>Descripción</label>
                      <input className="input" value={fiadoDesc}
                        onChange={e => setFiadoDesc(e.target.value)}
                        placeholder="Productos, etc." />
                    </div>
                  </div>
                  <button type="submit" className="btn btn-primary" disabled={saving} style={{ width:'100%' }}>
                    {saving ? <div className="spinner" /> : '📌 Apuntar fiado'}
                  </button>
                </form>

                {Number(selected.totalCredit) > 0 && (
                  <form onSubmit={handlePayment} className="cust-fiado-form" style={{ borderTop: '1px solid #e2e8f0', paddingTop: 16 }}>
                    <h4>Registrar abono / pago</h4>
                    <div className="form-row">
                      <div className="input-group">
                        <label>Monto *</label>
                        <input className="input" type="number" step="0.01" min="0.01"
                          value={payAmt} onChange={e => setPayAmt(e.target.value)}
                          placeholder="0.00" inputMode="decimal" />
                      </div>
                      <div className="input-group">
                        <label>Nota</label>
                        <input className="input" value={payDesc}
                          onChange={e => setPayDesc(e.target.value)} placeholder="Abono en efectivo…" />
                      </div>
                    </div>
                    <button type="submit" className="btn btn-outline" disabled={saving} style={{ width:'100%', color:'#10b981', borderColor:'#10b981' }}>
                      {saving ? <div className="spinner" /> : '✓ Registrar abono'}
                    </button>
                  </form>
                )}
              </div>
            )}

            {activeTab === 'history' && (
              <div className="cust-history">
                {txLoading ? <div className="spinner" style={{ margin: '20px auto' }} /> :
                 txList.length === 0 ? <p className="text-soft" style={{ textAlign:'center', padding: 20 }}>Sin movimientos</p> :
                 txList.map(tx => (
                  <div key={tx.id} className={`cust-tx-row ${tx.type === 'PURCHASE' ? 'debit' : 'credit'}`}>
                    <div className="cust-tx-left">
                      <span className="cust-tx-icon">{tx.type === 'PURCHASE' ? '📌' : '✓'}</span>
                      <div>
                        <div className="cust-tx-desc">{tx.description}</div>
                        <div className="cust-tx-date">{new Date(tx.createdAt).toLocaleDateString('es-MX', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}</div>
                      </div>
                    </div>
                    <span className={`cust-tx-amt ${tx.type === 'PURCHASE' ? 'neg' : 'pos'}`}>
                      {tx.type === 'PURCHASE' ? '-' : '+'}{fmt(tx.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
