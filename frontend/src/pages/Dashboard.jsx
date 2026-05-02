import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { dashboard as dashboardApi } from '../api'
import { useAuth } from '../store/AuthContext'
import { useToast } from '../store/ToastContext'
import KpiCard from '../components/ui/KpiCard'
import client from '../api/client'
import './Dashboard.css'

const fmt = (n) => `$${Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 0 })}`

const STATUS_CONFIG = {
  GREEN:  { label: 'Negocio saludable', cls: 'green', emoji: '🟢' },
  YELLOW: { label: 'Atención requerida', cls: 'yellow', emoji: '🟡' },
  RED:    { label: 'Acción urgente ahora', cls: 'red', emoji: '🔴' },
}

const INSIGHT_BG = { RED: '#fff1f0', YELLOW: '#fffbeb', GREEN: '#f0fdf4' }
const INSIGHT_BORDER = { RED: '#ef4444', YELLOW: '#f59e0b', GREEN: '#10b981' }

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { show } = useToast()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showAllInsights, setShowAllInsights] = useState(false)

  // Multi-business
  const [accounts, setAccounts] = useState(() => {
    try { return JSON.parse(localStorage.getItem('multi_accounts') || '[]') } catch { return [] }
  })
  const [showAddBiz, setShowAddBiz] = useState(false)
  const [addForm, setAddForm] = useState({ email: '', password: '' })
  const [addLoading, setAddLoading] = useState(false)

  const addBusiness = async (e) => {
    e.preventDefault()
    setAddLoading(true)
    try {
      const res = await client.post('/auth/login', { email: addForm.email, password: addForm.password })
      const bizUser = res.user
      if (bizUser.businessId === user.businessId) {
        show('Este negocio ya está activo', 'error')
        return
      }
      if (accounts.find(a => a.businessId === bizUser.businessId)) {
        show('Este negocio ya está en tu lista', 'error')
        return
      }
      const newAcc = {
        businessId: bizUser.businessId,
        businessName: bizUser.businessName,
        businessSlug: bizUser.businessSlug,
        name: bizUser.name,
        token: res.token,
      }
      const updated = [...accounts, newAcc]
      setAccounts(updated)
      localStorage.setItem('multi_accounts', JSON.stringify(updated))
      setShowAddBiz(false)
      setAddForm({ email: '', password: '' })
      show(`Negocio "${bizUser.businessName}" conectado`, 'success')
    } catch {
      show('Credenciales incorrectas o negocio no encontrado', 'error')
    } finally { setAddLoading(false) }
  }

  const removeAccount = (businessId) => {
    const updated = accounts.filter(a => a.businessId !== businessId)
    setAccounts(updated)
    localStorage.setItem('multi_accounts', JSON.stringify(updated))
  }

  useEffect(() => {
    dashboardApi.get().then(setData).finally(() => setLoading(false))
    const iv = setInterval(() => dashboardApi.get().then(setData), 60_000)
    return () => clearInterval(iv)
  }, [])

  if (loading) return (
    <div className="page-loading">
      <div className="spinner" style={{ width: 32, height: 32 }} />
      <p>Analizando tu negocio...</p>
    </div>
  )

  const { kpis = {}, insights = [], lowStockProducts = [], topProducts = [], status = 'GREEN' } = data || {}
  const st = STATUS_CONFIG[status] || STATUS_CONFIG.GREEN

  // Solo el insight #1 (mayor prioridad ya viene ordenado del backend)
  const topInsight = insights[0] || null

  return (
    <div className="dashboard-page">
      {/* Header — estado del negocio */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Hola, {user?.name?.split(' ')[0]}</h1>
          <p className="page-subtitle">Resumen de hoy</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className={`status-pill status-pill--${st.cls}`}>
            {st.emoji} {st.label}
          </div>
          {user?.businessSlug && (
            <a href={`/tienda/${user.businessSlug}`} target="_blank" rel="noopener noreferrer"
              className="btn btn-outline" style={{ fontSize: 13 }}>
              🏪 Ver tienda
            </a>
          )}
          <button className="btn btn-outline" style={{ fontSize: 13 }} onClick={() => navigate('/store-admin')}>
            ⚙️ Gestionar tienda
          </button>
        </div>
      </div>

      {/* 3 KPIs — máximo, sin ruido */}
      <div className="kpi-grid">
        <KpiCard
          label="Ventas hoy"
          value={fmt(kpis.todayRevenue)}
          sub={`${kpis.todaySales || 0} transacciones`}
          icon="💰"
        />
        <KpiCard
          label="Ingresos del mes"
          value={fmt(kpis.monthRevenue)}
          trend={Number(kpis.revenueGrowth || 0)}
          sub="vs mes anterior"
          icon="📈"
        />
        <KpiCard
          label="Productos sin stock"
          value={kpis.lowStockCount || 0}
          icon={kpis.lowStockCount > 0 ? '⚠️' : '✅'}
          sub={kpis.lowStockCount > 0 ? 'Requieren atención' : 'Inventario OK'}
        />
      </div>

      {/* 1 Problema + 1 Acción — corazón del dashboard */}
      {topInsight && (
        <div
          className="main-insight"
          style={{
            background: INSIGHT_BG[topInsight.status] || '#fff',
            borderLeft: `4px solid ${INSIGHT_BORDER[topInsight.status] || '#6366f1'}`,
          }}
        >
          <div className="main-insight-header">
            <span className="main-insight-badge">
              {topInsight.status === 'RED' ? '🔴' : topInsight.status === 'YELLOW' ? '🟡' : '🟢'}
              &nbsp;{topInsight.title}
            </span>
            {insights.length > 1 && (
              <button className="btn btn-sm btn-outline" style={{ fontSize: 12 }}
                onClick={() => setShowAllInsights(v => !v)}>
                {showAllInsights ? 'Ver menos' : `+${insights.length - 1} más`}
              </button>
            )}
          </div>
          <p className="main-insight-problem">{topInsight.diagnosis}</p>
          <div className="main-insight-action">
            <span className="main-insight-action-label">Qué hacer ahora</span>
            <p>{topInsight.action}</p>
          </div>
          {topInsight.impact && (
            <div className="main-insight-impact">
              💵 {topInsight.impact}
            </div>
          )}
        </div>
      )}

      {/* Expanded insights */}
      {showAllInsights && insights.slice(1).map((ins, i) => (
        <div key={i}
          className="main-insight"
          style={{
            background: INSIGHT_BG[ins.status] || '#fff',
            borderLeft: `4px solid ${INSIGHT_BORDER[ins.status] || '#6366f1'}`,
          }}
        >
          <div className="main-insight-header">
            <span className="main-insight-badge">
              {ins.status === 'RED' ? '🔴' : ins.status === 'YELLOW' ? '🟡' : '🟢'}
              &nbsp;{ins.title}
            </span>
          </div>
          <p className="main-insight-problem">{ins.diagnosis}</p>
          <div className="main-insight-action">
            <span className="main-insight-action-label">Qué hacer ahora</span>
            <p>{ins.action}</p>
          </div>
          {ins.impact && <div className="main-insight-impact">💵 {ins.impact}</div>}
        </div>
      ))}

      {!topInsight && (
        <div className="main-insight main-insight--ok">
          <span style={{ fontSize: 28 }}>✅</span>
          <div>
            <p className="font-semibold">Todo en orden</p>
            <p className="text-soft">No hay problemas detectados en este momento</p>
          </div>
        </div>
      )}

      {/* Panel secundario */}
      <div className="dashboard-secondary">
        {lowStockProducts.length > 0 && (
          <div className="card">
            <h3 className="section-title" style={{ marginBottom: 12 }}>⚠️ Stock bajo</h3>
            {lowStockProducts.slice(0, 5).map(p => (
              <div key={p.id} className="list-item">
                <span className="list-item-name">{p.name}</span>
                <span className={`badge ${p.stock === 0 ? 'badge-red' : 'badge-yellow'}`}>
                  {p.stock === 0 ? 'Agotado' : `${p.stock} uds`}
                </span>
              </div>
            ))}
          </div>
        )}

        {topProducts.length > 0 && (
          <div className="card">
            <h3 className="section-title" style={{ marginBottom: 12 }}>🏆 Más vendidos este mes</h3>
            {topProducts.slice(0, 5).map((p, i) => (
              <div key={p.id || i} className="list-item">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="rank-badge">{i + 1}</span>
                  <span className="list-item-name">{p.name}</span>
                </div>
                <span className="text-success font-semibold">{fmt(p.revenue)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Multi-negocio */}
      <div className="card" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 className="section-title" style={{ margin: 0 }}>🏢 Mis negocios</h3>
          <button className="btn btn-sm btn-outline" onClick={() => setShowAddBiz(v => !v)}>
            {showAddBiz ? 'Cancelar' : '+ Conectar negocio'}
          </button>
        </div>

        {showAddBiz && (
          <form onSubmit={addBusiness} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14, background: '#f8fafc', padding: 14, borderRadius: 10 }}>
            <input className="input" placeholder="Email del negocio" type="email" required
              value={addForm.email} onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))}
              style={{ flex: 1, minWidth: 180 }} />
            <input className="input" placeholder="Contraseña" type="password" required
              value={addForm.password} onChange={e => setAddForm(f => ({ ...f, password: e.target.value }))}
              style={{ flex: 1, minWidth: 140 }} />
            <button className="btn btn-primary" type="submit" disabled={addLoading}>
              {addLoading ? <div className="spinner" /> : 'Conectar'}
            </button>
          </form>
        )}

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {/* Current business */}
          <div style={{ padding: '10px 16px', background: '#ede9fe', borderRadius: 10, border: '2px solid #6366f1', minWidth: 160 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>Activo</div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{user?.businessName}</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>{user?.name}</div>
          </div>

          {accounts.map(acc => (
            <div key={acc.businessId} style={{ padding: '10px 16px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0', minWidth: 160, position: 'relative' }}>
              <button
                onClick={() => removeAccount(acc.businessId)}
                style={{ position: 'absolute', top: 6, right: 8, background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}
                title="Quitar">×</button>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>Otro negocio</div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{acc.businessName}</div>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>{acc.name}</div>
              {acc.businessSlug && (
                <a href={`/tienda/${acc.businessSlug}`} target="_blank" rel="noopener noreferrer"
                  className="btn btn-sm btn-outline" style={{ fontSize: 11 }}>
                  Ver tienda
                </a>
              )}
            </div>
          ))}

          {accounts.length === 0 && !showAddBiz && (
            <div style={{ fontSize: 13, color: '#94a3b8', padding: '10px 0', alignSelf: 'center' }}>
              Conecta tus otros negocios para verlos aquí
            </div>
          )}
        </div>
      </div>

      {/* Acciones rápidas */}
      <div className="card" style={{ padding: '16px 20px' }}>
        <h3 className="section-title" style={{ marginBottom: 12 }}>Acciones rápidas</h3>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={() => navigate('/caja')}>
            💰 Nueva venta
          </button>
          <button className="btn btn-outline" onClick={() => navigate('/inventory')}>
            📦 Ver inventario
          </button>
          <button className="btn btn-outline" onClick={() => navigate('/finance')}>
            📊 Ver finanzas
          </button>
          <button className="btn btn-outline" onClick={() => navigate('/orders')}>
            📋 Ver pedidos
          </button>
          <button className="btn btn-outline" onClick={() => navigate('/marketing')}>
            📣 Generar marketing
          </button>
        </div>
      </div>
    </div>
  )
}
