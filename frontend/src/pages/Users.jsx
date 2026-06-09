import { useState, useEffect } from 'react'
import { users as api } from '../api'
import { useToast } from '../store/ToastContext'
import { useAuth } from '../store/AuthContext'
import './Users.css'

const ROLE_LABELS = { OWNER: '👑 Propietario', ADMIN: '🛠️ Administrador', CASHIER: '💳 Cajero' }
const ROLE_COLORS = { OWNER: 'badge-blue', ADMIN: 'badge-green', CASHIER: 'badge-gray' }

const fmt = (n) => `$${Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtQty = (n) => Number(n || 0).toLocaleString('es-MX', { maximumFractionDigits: 2 })

export default function Users() {
  const { show }    = useToast()
  const { user: me } = useAuth()

  const [userList,  setUserList]  = useState([])
  const [loading,   setLoading]   = useState(true)
  const [showAdd,   setShowAdd]   = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [form,      setForm]      = useState({ name: '', email: '', password: '', role: 'CASHIER' })

  const [statsUser,    setStatsUser]    = useState(null)   // usuario seleccionado
  const [stats,        setStats]        = useState(null)   // datos cargados
  const [statsLoading, setStatsLoading] = useState(false)

  const openStats = async (u) => {
    setStatsUser(u)
    setStats(null)
    setStatsLoading(true)
    try {
      setStats(await api.stats(u.id))
    } catch (err) {
      show(err?.error || 'Error al cargar estadísticas', 'error')
      setStatsUser(null)
    } finally {
      setStatsLoading(false)
    }
  }

  const load = () => api.list().then(setUserList).finally(() => setLoading(false))
  useEffect(() => { load() }, [])

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!form.name.trim() || !form.email.trim() || !form.password) {
      show('Completa todos los campos', 'error'); return
    }
    setSaving(true)
    try {
      await api.create(form)
      show('Usuario creado', 'success')
      setShowAdd(false)
      setForm({ name: '', email: '', password: '', role: 'CASHIER' })
      load()
    } catch (err) { show(err?.error || 'Error al crear usuario', 'error') }
    finally { setSaving(false) }
  }

  const toggleActive = async (u) => {
    if (u.role === 'OWNER') { show('No se puede desactivar al propietario', 'error'); return }
    try {
      await api.toggleActive(u.id, !u.isActive)
      show(u.isActive ? 'Usuario desactivado' : 'Usuario activado', 'success')
      load()
    } catch { show('Error', 'error') }
  }

  if (loading) return <div className="page-loading"><div className="spinner" /></div>

  return (
    <div className="users-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Usuarios</h1>
          <p className="page-subtitle">{userList.length} usuarios en tu negocio</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
          + Agregar usuario
        </button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="inv-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Email</th>
              <th>Rol</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {userList.map(u => (
              <tr key={u.id} style={{ opacity: u.isActive ? 1 : 0.5 }}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div className="users-avatar">{u.name[0].toUpperCase()}</div>
                    <span className="font-semibold">
                      {u.name}{u.id === me?.id && <span className="text-soft text-sm"> (tú)</span>}
                    </span>
                  </div>
                </td>
                <td className="text-soft">{u.email}</td>
                <td><span className={`badge ${ROLE_COLORS[u.role] || 'badge-gray'}`}>{ROLE_LABELS[u.role] || u.role}</span></td>
                <td>
                  <span className={`badge ${u.isActive ? 'badge-green' : 'badge-red'}`}>
                    {u.isActive ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button className="btn btn-sm btn-outline" onClick={() => openStats(u)}>
                      📊 Estadísticas
                    </button>
                    {u.role !== 'OWNER' && u.id !== me?.id && (
                      <button className="btn btn-sm btn-outline" onClick={() => toggleActive(u)}>
                        {u.isActive ? 'Desactivar' : 'Activar'}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal-box card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Nuevo usuario</h3>
              <button className="modal-close" onClick={() => setShowAdd(false)}>×</button>
            </div>
            <form onSubmit={handleCreate} className="modal-form">
              <div className="input-group">
                <label>Nombre *</label>
                <input className="input" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
              </div>
              <div className="input-group">
                <label>Email *</label>
                <input className="input" type="email" value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
              </div>
              <div className="input-group">
                <label>Contraseña *</label>
                <input className="input" type="password" value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  minLength={6} required placeholder="Mínimo 6 caracteres" />
              </div>
              <div className="input-group">
                <label>Rol</label>
                <select className="input" value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                  <option value="CASHIER">💳 Cajero</option>
                  <option value="ADMIN">🛠️ Administrador</option>
                </select>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowAdd(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <div className="spinner" /> : 'Crear usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {statsUser && (
        <div className="modal-overlay" onClick={() => setStatsUser(null)}>
          <div className="modal-box card stats-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>📊 Rendimiento de {statsUser.name}</h3>
              <button className="modal-close" onClick={() => setStatsUser(null)}>×</button>
            </div>

            {statsLoading && <div className="page-loading"><div className="spinner" /></div>}

            {!statsLoading && stats && (() => {
              const hasSales = stats.allTime.sales > 0
              return (
                <div className="stats-body">
                  {!hasSales && (
                    <p className="stats-empty">
                      Este usuario todavía no tiene ventas registradas.
                    </p>
                  )}

                  {/* Resumen por periodo */}
                  <div className="stats-periods">
                    {[
                      { label: 'Últimos 7 días',  d: stats.last7  },
                      { label: 'Últimos 30 días', d: stats.last30 },
                      { label: 'Histórico',       d: stats.allTime },
                    ].map(({ label, d }) => (
                      <div key={label} className="stats-period-card">
                        <span className="stats-period-label">{label}</span>
                        <div className="stats-rows">
                          <div className="stats-row">
                            <span>Ventas</span>
                            <strong>{d.sales}</strong>
                          </div>
                          <div className="stats-row">
                            <span>Dinero generado</span>
                            <strong className="stats-revenue">{fmt(d.revenue)}</strong>
                          </div>
                          <div className="stats-row">
                            <span>Ganancia</span>
                            <strong className="stats-profit">{fmt(d.profit)}</strong>
                          </div>
                          <div className="stats-row">
                            <span>Ticket promedio</span>
                            <strong>{fmt(d.avgTicket)}</strong>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {hasSales && (
                    <>
                      {/* Método de pago (30 días) */}
                      <div className="stats-section">
                        <h4>Método de pago · últimos 30 días</h4>
                        <div className="stats-pay">
                          <div className="stats-pay-item">
                            <span>💵 Efectivo</span>
                            <strong>{fmt(stats.byPayment.cash)}</strong>
                          </div>
                          <div className="stats-pay-item">
                            <span>💳 Tarjeta</span>
                            <strong>{fmt(stats.byPayment.card)}</strong>
                          </div>
                        </div>
                      </div>

                      {/* Top productos (30 días) */}
                      {stats.topProducts.length > 0 && (
                        <div className="stats-section">
                          <h4>Productos más vendidos · últimos 30 días</h4>
                          <table className="inv-table stats-top">
                            <thead>
                              <tr><th>Producto</th><th>Cant.</th><th>Vendido</th></tr>
                            </thead>
                            <tbody>
                              {stats.topProducts.map((pr, i) => (
                                <tr key={i}>
                                  <td>{pr.name}</td>
                                  <td>{fmtQty(pr.qty)}</td>
                                  <td>{fmt(pr.revenue)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )
            })()}
          </div>
        </div>
      )}
    </div>
  )
}
