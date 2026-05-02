import { useState, useEffect } from 'react'
import { superAdmin as api } from '../api'
import { useToast } from '../store/ToastContext'
import './SuperAdmin.css'

const fmt = n => `$${Number(n || 0).toLocaleString('es-MX')}`
const fmtDate = d => d ? new Date(d).toLocaleDateString('es-MX', { day:'2-digit', month:'short', year:'numeric' }) : '—'

const STATUS_CLS = {
  TRIAL:    'badge badge-blue',
  ACTIVE:   'badge badge-green',
  PAST_DUE: 'badge badge-yellow',
  CANCELED: 'badge badge-red',
}
const PLAN_CLS = { FREE:'badge badge-gray', BASIC:'badge badge-blue', PRO:'badge badge-green', PREMIUM:'badge badge-yellow' }

export default function SuperAdmin() {
  const { show } = useToast()
  const [businesses, setBusinesses] = useState([])
  const [metrics,    setMetrics]    = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [search,     setSearch]     = useState('')
  const [acting,     setActing]     = useState(null)

  const load = async () => {
    try {
      const [biz, met] = await Promise.all([api.businesses(), api.metrics()])
      setBusinesses(biz)
      setMetrics(met)
    } catch { show('Error al cargar datos', 'error') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const suspend = async (id) => {
    if (!window.confirm('¿Suspender este negocio?')) return
    setActing(id)
    try {
      await api.suspend(id)
      show('Negocio suspendido', 'success')
      load()
    } catch { show('Error', 'error') }
    finally { setActing(null) }
  }

  const activate = async (id) => {
    setActing(id)
    try {
      await api.activate(id)
      show('Negocio activado', 'success')
      load()
    } catch { show('Error', 'error') }
    finally { setActing(null) }
  }

  const setPlan = async (id, plan) => {
    try {
      await api.setPlan(id, plan)
      show(`Plan cambiado a ${plan}`, 'success')
      load()
    } catch { show('Error', 'error') }
  }

  const filtered = businesses.filter(b =>
    b.name.toLowerCase().includes(search.toLowerCase()) ||
    b.slug.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return <div className="page-loading"><div className="spinner" /></div>

  return (
    <div className="sa-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Super Admin</h1>
          <p className="page-subtitle">{businesses.length} negocios registrados</p>
        </div>
      </div>

      {/* Métricas */}
      {metrics && (
        <div className="sa-metrics">
          <div className="sa-metric card">
            <div className="sa-metric-val">{metrics.businesses?.total}</div>
            <div className="sa-metric-lbl">Negocios</div>
          </div>
          <div className="sa-metric card">
            <div className="sa-metric-val" style={{ color:'#10b981' }}>{metrics.businesses?.active}</div>
            <div className="sa-metric-lbl">Activos</div>
          </div>
          <div className="sa-metric card">
            <div className="sa-metric-val" style={{ color:'#6366f1' }}>{metrics.subscriptions?.active}</div>
            <div className="sa-metric-lbl">Suscrip. activas</div>
          </div>
          <div className="sa-metric card">
            <div className="sa-metric-val" style={{ color:'#f59e0b' }}>{metrics.subscriptions?.trial}</div>
            <div className="sa-metric-lbl">En prueba</div>
          </div>
          <div className="sa-metric card">
            <div className="sa-metric-val" style={{ color:'#6366f1' }}>
              {fmt(metrics.subscriptions?.mrr)}
            </div>
            <div className="sa-metric-lbl">MRR estimado</div>
          </div>
          <div className="sa-metric card">
            <div className="sa-metric-val">{metrics.users}</div>
            <div className="sa-metric-lbl">Usuarios totales</div>
          </div>
        </div>
      )}

      {/* Búsqueda */}
      <input className="input" placeholder="Buscar por nombre o slug..."
        value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: 340 }} />

      {/* Tabla */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="inv-table">
          <thead>
            <tr>
              <th>Negocio</th>
              <th>Slug</th>
              <th>Usuarios</th>
              <th>Plan</th>
              <th>Suscripción</th>
              <th>Fin período</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(b => (
              <tr key={b.id} style={{ opacity: b.isSuspended ? 0.5 : 1 }}>
                <td className="font-semibold">
                  {b.name}
                  {b.isSuspended && <span className="badge badge-red" style={{ marginLeft: 6 }}>Suspendido</span>}
                </td>
                <td className="text-soft text-sm">{b.slug}</td>
                <td>{b.userCount}</td>
                <td>
                  <select
                    className="input" style={{ padding: '4px 8px', fontSize: 12, width: 100 }}
                    value={b.subscription?.plan || b.plan?.toUpperCase() || 'FREE'}
                    onChange={e => setPlan(b.id, e.target.value)}>
                    {['FREE','BASIC','PRO','PREMIUM'].map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </td>
                <td>
                  {b.subscription ? (
                    <span className={STATUS_CLS[b.subscription.status] || 'badge badge-gray'}>
                      {b.subscription.status}
                    </span>
                  ) : <span className="text-soft text-sm">—</span>}
                </td>
                <td className="text-soft text-sm">
                  {b.subscription?.periodEnd ? fmtDate(b.subscription.periodEnd) : '—'}
                </td>
                <td>
                  <span className={`badge ${b.isActive && !b.isSuspended ? 'badge-green' : 'badge-red'}`}>
                    {b.isActive && !b.isSuspended ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td>
                  <div style={{ display:'flex', gap: 6 }}>
                    {b.isSuspended ? (
                      <button className="btn btn-sm btn-outline"
                        onClick={() => activate(b.id)} disabled={acting === b.id}>
                        Activar
                      </button>
                    ) : (
                      <button className="btn btn-sm btn-outline"
                        style={{ color:'#ef4444', borderColor:'#fca5a5' }}
                        onClick={() => suspend(b.id)} disabled={acting === b.id}>
                        Suspender
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="empty-state" style={{ padding: 40, textAlign:'center' }}>
            <p className="text-soft">Sin resultados</p>
          </div>
        )}
      </div>
    </div>
  )
}
