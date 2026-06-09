import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { dashboard as dashboardApi } from '../api'
import { useAuth } from '../store/AuthContext'
import { useToast } from '../store/ToastContext'
import KpiCard from '../components/ui/KpiCard'
import './Dashboard.css'

const fmt = (n) => `$${Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 0 })}`

const STATUS_CONFIG = {
  GREEN:  { label: 'Negocio saludable', cls: 'green', emoji: '🟢' },
  YELLOW: { label: 'Atención requerida', cls: 'yellow', emoji: '🟡' },
  RED:    { label: 'Acción urgente ahora', cls: 'red', emoji: '🔴' },
}

const INSIGHT_BG = { RED: '#fff1f0', YELLOW: '#fffbeb', GREEN: '#f0fdf4' }
const INSIGHT_BORDER = { RED: '#ef4444', YELLOW: '#f59e0b', GREEN: '#10b981' }

// Consejos que rotan diariamente — alineados con el eslogan del negocio
const DAILY_TIPS = [
  {
    category: 'Libertad',
    icon: '🕊️',
    gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    title: 'Tu negocio trabaja para ti, no al revés',
    tip: 'Cada producto en tu tienda online que se vende mientras descansas es un paso hacia la libertad real. Agrega hoy los productos que más vendes y deja que trabajen solos.',
    action: 'Ir a Tienda Online',
    route: '/store-admin',
  },
  {
    category: 'Familia',
    icon: '👨‍👩‍👧',
    gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    title: 'Los mejores momentos no tienen precio de lista',
    tip: 'Revisa tus horas pico en reportes. Si tu venta fuerte es por las mañanas, organiza tus tardes para estar con las personas que más importan. Ese tiempo vale más que cualquier venta.',
    action: 'Ver mis reportes',
    route: '/reports',
  },
  {
    category: 'Crecimiento',
    icon: '🌱',
    gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    title: 'Un cliente que vuelve vale diez veces más',
    tip: 'Tienes clientes en tu base de datos. Envíales un mensaje de WhatsApp personalizado hoy. Usa Marketing para generarlo en 30 segundos — sin esfuerzo, con resultados.',
    action: 'Generar mensaje',
    route: '/marketing',
  },
  {
    category: 'Tranquilidad',
    icon: '😌',
    gradient: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    title: 'El inventario no tiene que darte dolores de cabeza',
    tip: 'Configura el stock mínimo en tus productos más vendidos. El sistema te avisa automáticamente antes de quedarte sin mercancía — tú solo te enteras cuando es necesario actuar.',
    action: 'Ver inventario',
    route: '/inventory',
  },
  {
    category: 'Libertad',
    icon: '💤',
    gradient: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
    title: 'Vende mientras duermes',
    tip: 'Tu tienda online está abierta 24/7 sin que tú estés presente. Asegúrate de que todos tus productos estrella tengan foto y descripción — cada visita nocturna es una venta potencial sin tu esfuerzo.',
    action: 'Gestionar tienda',
    route: '/store-admin',
  },
  {
    category: 'Crecimiento',
    icon: '📈',
    gradient: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
    title: 'Conoce cuándo y qué te genera más dinero',
    tip: 'Tus ventas tienen un patrón. Identificar tu hora y día pico te permite prepararte mejor — y delegar o descansar en los momentos de baja actividad.',
    action: 'Ver finanzas',
    route: '/finance',
  },
  {
    category: 'Familia',
    icon: '⏰',
    gradient: 'linear-gradient(135deg, #89f7fe 0%, #66a6ff 100%)',
    title: 'Cada minuto ahorrado es tiempo con tu familia',
    tip: 'Activar cobros con MercadoPago elimina el manejo de efectivo en cada venta. Menos riesgo, menos tiempo contando, más tiempo para lo que de verdad importa.',
    action: 'Configurar cobros',
    route: '/settings/payments',
  },
]

function getMorningAnalysis(kpis) {
  const hour = new Date().getHours()
  if (hour < 6 || hour >= 13) return null

  const revenue = Number(kpis?.todayRevenue || 0)
  const sales = Number(kpis?.todaySales || 0)
  const lowStock = Number(kpis?.lowStockCount || 0)

  if (revenue > 0) {
    return {
      icon: '🌅',
      message: `Mientras dormías, tu negocio generó ${fmt(revenue)} en ${sales} venta${sales !== 1 ? 's' : ''}. ${lowStock > 0 ? `Hay ${lowStock} producto${lowStock !== 1 ? 's' : ''} con stock bajo — revísalos antes de abrir.` : 'El inventario está en orden.'}`,
    }
  }
  return {
    icon: '🌅',
    message: `Buenos días. Tu negocio está listo para arrancar. ${lowStock > 0 ? `Hay ${lowStock} producto${lowStock !== 1 ? 's' : ''} con stock bajo que deberías revisar primero.` : 'Todo el inventario está en orden — buen día por delante.'}`,
  }
}

export default function Dashboard() {
  const { user, switchBusiness } = useAuth()
  const navigate = useNavigate()
  const { show } = useToast()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showAllInsights, setShowAllInsights] = useState(false)

  // Ranking de cajeros (solo dueño/admin)
  const canSeeRanking = user?.role === 'OWNER' || user?.role === 'ADMIN'
  const [ranking, setRanking] = useState(null)
  const [rankingDays, setRankingDays] = useState(30)

  // Multi-business
  const [accounts, setAccounts] = useState(() => {
    try { return JSON.parse(localStorage.getItem('multi_accounts') || '[]') } catch { return [] }
  })
  const [showAddBiz, setShowAddBiz] = useState(false)
  const [addForm, setAddForm] = useState({ email: '', password: '' })
  const [addLoading, setAddLoading] = useState(false)

  // Vista global multi-negocio
  const [showGlobal, setShowGlobal] = useState(false)
  const [globalData, setGlobalData] = useState([])
  const [globalLoading, setGlobalLoading] = useState(false)

  const BIZ_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']

  const addBusiness = async (e) => {
    e.preventDefault()
    setAddLoading(true)
    try {
      const BASE = import.meta.env.VITE_API_URL || '/api'
      const raw = await fetch(`${BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: addForm.email, password: addForm.password }),
      })
      const res = await raw.json()
      if (!raw.ok) {
        show(res?.error || 'Credenciales incorrectas', 'error')
        return
      }
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
        id: bizUser.id,
        businessId: bizUser.businessId,
        businessName: bizUser.businessName,
        businessSlug: bizUser.businessSlug,
        name: bizUser.name,
        email: bizUser.email,
        role: bizUser.role,
        token: res.token,
      }
      setAccounts(prev => {
        const updated = [...prev, newAcc]
        try { localStorage.setItem('multi_accounts', JSON.stringify(updated)) } catch {}
        return updated
      })
      setShowAddBiz(false)
      setAddForm({ email: '', password: '' })
      show(`Negocio "${bizUser.businessName}" conectado`, 'success')
    } catch {
      show('No se pudo conectar el negocio', 'error')
    } finally { setAddLoading(false) }
  }

  const removeAccount = (businessId) => {
    setAccounts(prev => {
      const updated = prev.filter(a => a.businessId !== businessId)
      try { localStorage.setItem('multi_accounts', JSON.stringify(updated)) } catch {}
      return updated
    })
    setGlobalData([])
  }

  const loadGlobal = async () => {
    setGlobalLoading(true)
    const BASE = import.meta.env.VITE_API_URL || '/api'
    const fetchFor = async (token, bizInfo) => {
      try {
        const res = await fetch(`${BASE}/dashboard`, { headers: { Authorization: `Bearer ${token}` } })
        if (!res.ok) return null
        const d = await res.json()
        return { ...d, _biz: bizInfo }
      } catch { return null }
    }
    const currentToken = localStorage.getItem('ab_token')
    const jobs = [
      fetchFor(currentToken, { businessId: user.businessId, businessName: user.businessName, current: true }),
      ...accounts.map(acc => fetchFor(acc.token, { businessId: acc.businessId, businessName: acc.businessName, current: false })),
    ]
    const results = (await Promise.all(jobs)).filter(Boolean)
    setGlobalData(results)
    setGlobalLoading(false)
  }

  const toggleGlobal = () => {
    if (!showGlobal && globalData.length === 0) loadGlobal()
    setShowGlobal(v => !v)
  }

  useEffect(() => {
    dashboardApi.get().then(setData).finally(() => setLoading(false))
    const iv = setInterval(() => dashboardApi.get().then(setData), 60_000)
    return () => clearInterval(iv)
  }, [])

  useEffect(() => {
    if (!canSeeRanking) return
    dashboardApi.cashierRanking(rankingDays).then(setRanking).catch(() => setRanking(null))
  }, [canSeeRanking, rankingDays])

  if (loading) return (
    <div className="page-loading">
      <div className="spinner" style={{ width: 32, height: 32 }} />
      <p>Analizando tu negocio...</p>
    </div>
  )

  const { kpis = {}, insights = [], lowStockProducts = [], topProducts = [], status = 'GREEN' } = data || {}
  const st = STATUS_CONFIG[status] || STATUS_CONFIG.GREEN

  const topInsight = insights[0] || null

  // Pick today's tip (rotates daily by day of year)
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000)
  const todayTip = DAILY_TIPS[dayOfYear % DAILY_TIPS.length]
  const morningMsg = getMorningAnalysis(kpis)

  return (
    <div className="dashboard-page">
      {/* Análisis de la mañana */}
      {morningMsg && (
        <div className="morning-banner">
          <span className="morning-icon">{morningMsg.icon}</span>
          <p>{morningMsg.message}</p>
        </div>
      )}

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Hola, {user?.name?.split(' ')[0]}</h1>
          <p className="page-subtitle">Resumen de hoy</p>
        </div>
        <div className="page-header-actions">
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

      {/* KPIs */}
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

      {/* Top insight */}
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
            <div className="main-insight-impact">💵 {topInsight.impact}</div>
          )}
        </div>
      )}

      {showAllInsights && insights.slice(1).map((ins, i) => (
        <div key={ins.id || `${ins.type}-${i}`}
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

      {/* ── CONSEJO DEL DÍA ── */}
      <div className="tip-card" style={{ background: todayTip.gradient }}>
        <div className="tip-card-top">
          <span className="tip-category">{todayTip.category}</span>
          <span className="tip-icon">{todayTip.icon}</span>
        </div>
        <h3 className="tip-title">{todayTip.title}</h3>
        <p className="tip-body">{todayTip.tip}</p>
        <div className="tip-footer">
          <button className="tip-action-btn" onClick={() => navigate(todayTip.route)}>
            {todayTip.action} →
          </button>
          <p className="tip-slogan">No construiste tu negocio para vivir estresado.<br />Lo construiste para crecer, ser libre y estar con tu familia.</p>
        </div>
      </div>

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
              <div key={p.name || `top-${i}`} className="list-item">
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

      {/* Ranking de cajeros */}
      {canSeeRanking && ranking?.ranking?.length > 0 && (
        <div className="card cashier-ranking">
          <div className="cashier-ranking-head">
            <h3 className="section-title" style={{ margin: 0 }}>🏅 Ranking de cajeros</h3>
            <div className="cashier-ranking-filter">
              {[7, 30, 90].map(d => (
                <button
                  key={d}
                  className={`crf-btn ${rankingDays === d ? 'crf-btn--active' : ''}`}
                  onClick={() => setRankingDays(d)}
                >
                  {d === 7 ? '7 días' : d === 30 ? '30 días' : '90 días'}
                </button>
              ))}
            </div>
          </div>

          <div className="cashier-ranking-list">
            {ranking.ranking.map((c) => {
              const medal = c.rank === 1 ? '🥇' : c.rank === 2 ? '🥈' : c.rank === 3 ? '🥉' : null
              return (
                <div key={c.cashierId} className={`cr-row ${c.rank === 1 ? 'cr-row--top' : ''}`}>
                  <div className="cr-rank">{medal || <span className="rank-badge">{c.rank}</span>}</div>
                  <div className="cr-main">
                    <div className="cr-name">{c.name}</div>
                    <div className="cr-bar">
                      <div className="cr-bar-fill" style={{ width: `${c.share}%` }} />
                    </div>
                    <div className="cr-sub">{c.sales} venta{c.sales !== 1 ? 's' : ''} · {c.share}% del total</div>
                  </div>
                  <div className="cr-figures">
                    <div className="cr-revenue">{fmt(c.revenue)}</div>
                    <div className="cr-profit">Ganancia {fmt(c.profit)}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Multi-negocio */}
      <div className="card" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
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
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button
                  className="btn btn-sm btn-primary"
                  style={{ fontSize: 11 }}
                  onClick={() => { switchBusiness(acc); window.location.reload() }}
                >
                  Cambiar
                </button>
                {acc.businessSlug && (
                  <a href={`/tienda/${acc.businessSlug}`} target="_blank" rel="noopener noreferrer"
                    className="btn btn-sm btn-outline" style={{ fontSize: 11 }}>
                    Ver tienda
                  </a>
                )}
              </div>
            </div>
          ))}

          {accounts.length === 0 && !showAddBiz && (
            <div style={{ fontSize: 13, color: '#94a3b8', padding: '10px 0', alignSelf: 'center' }}>
              Conecta tus otros negocios para verlos aquí
            </div>
          )}
        </div>

        {/* Vista global — siempre visible */}
        <div style={{ marginTop: 14 }}>
          <button
            onClick={toggleGlobal}
            style={{ width: '100%', background: 'linear-gradient(135deg,#ede9fe,#eff6ff)', border: '1px solid #c7d2fe', borderRadius: 8, padding: '10px 14px', cursor: 'pointer', color: '#4f46e5', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          >
            {globalLoading
              ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Cargando datos...</>
              : <>{showGlobal ? '▲' : '▼'} Datos globales — resumen financiero de todos los negocios</>
            }
          </button>

          {showGlobal && !globalLoading && globalData.length > 0 && (
            <div style={{ marginTop: 12 }}>
              {/* Totales consolidados */}
              <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                <div style={{ flex: 1, background: '#f0fdf4', borderRadius: 8, padding: '12px 14px', textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: '#16a34a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 2 }}>Ingresos hoy (total)</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: '#15803d' }}>
                    {fmt(globalData.reduce((s, d) => s + (d.kpis?.todayRevenue || 0), 0))}
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>
                    {globalData.reduce((s, d) => s + (d.kpis?.todaySales || 0), 0)} ventas entre todos
                  </div>
                </div>
                <div style={{ flex: 1, background: '#eff6ff', borderRadius: 8, padding: '12px 14px', textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: '#2563eb', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 2 }}>Ingresos este mes (total)</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: '#1d4ed8' }}>
                    {fmt(globalData.reduce((s, d) => s + (d.kpis?.monthRevenue || 0), 0))}
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>
                    {globalData.reduce((s, d) => s + (d.kpis?.monthSales || 0), 0)} ventas entre todos
                  </div>
                </div>
              </div>

              {/* Desglose por negocio */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {globalData.map((d, i) => {
                  const color = BIZ_COLORS[i % BIZ_COLORS.length]
                  const st = STATUS_CONFIG[d.status] || STATUS_CONFIG.GREEN
                  const totalHoy = globalData.reduce((s, x) => s + (x.kpis?.todayRevenue || 0), 0)
                  const pct = totalHoy > 0 ? Math.round(((d.kpis?.todayRevenue || 0) / totalHoy) * 100) : 0
                  return (
                    <div key={d._biz.businessId} style={{
                      padding: '12px 16px',
                      background: '#fff',
                      border: '1px solid #e2e8f0',
                      borderLeft: `5px solid ${color}`,
                      borderRadius: 8,
                    }}>
                      {/* Nombre del negocio */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, display: 'inline-block' }} />
                          {d._biz.businessName}
                          {d._biz.current && (
                            <span style={{ fontSize: 10, background: '#ede9fe', color: '#7c3aed', padding: '2px 7px', borderRadius: 4, fontWeight: 700 }}>activo</span>
                          )}
                        </div>
                        <span style={{ fontSize: 18 }}>{st.emoji}</span>
                      </div>
                      {/* Barra de aporte */}
                      <div style={{ marginBottom: 6 }}>
                        <div style={{ height: 6, background: '#f1f5f9', borderRadius: 3 }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width .4s' }} />
                        </div>
                        <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 3 }}>{pct}% del total de hoy</div>
                      </div>
                      {/* Datos financieros */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <div style={{ background: '#f8fafc', borderRadius: 6, padding: '8px 10px' }}>
                          <div style={{ fontSize: 10, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>Ingresos hoy</div>
                          <div style={{ fontSize: 18, fontWeight: 800, color: color }}>{fmt(d.kpis?.todayRevenue)}</div>
                          <div style={{ fontSize: 10, color: '#94a3b8' }}>{d.kpis?.todaySales || 0} ventas</div>
                        </div>
                        <div style={{ background: '#f8fafc', borderRadius: 6, padding: '8px 10px' }}>
                          <div style={{ fontSize: 10, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>Ingresos del mes</div>
                          <div style={{ fontSize: 18, fontWeight: 800, color: color }}>{fmt(d.kpis?.monthRevenue)}</div>
                          <div style={{ fontSize: 10, color: '#94a3b8' }}>{d.kpis?.monthSales || 0} ventas</div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              <button
                onClick={loadGlobal}
                style={{ marginTop: 10, background: 'none', border: 'none', color: '#94a3b8', fontSize: 11, cursor: 'pointer', width: '100%', textAlign: 'center' }}
              >
                Actualizar datos
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Acciones rápidas */}
      <div className="card" style={{ padding: '16px 20px' }}>
        <h3 className="section-title" style={{ marginBottom: 12 }}>Acciones rápidas</h3>
        <div className="quick-actions">
          <button className="btn btn-primary" onClick={() => navigate('/caja')}>
            💰 Nueva venta
          </button>
          <button className="btn btn-outline" onClick={() => navigate('/inventory')}>
            📦 Inventario
          </button>
          <button className="btn btn-outline" onClick={() => navigate('/finance')}>
            📊 Finanzas
          </button>
          <button className="btn btn-outline" onClick={() => navigate('/orders')}>
            📋 Pedidos
          </button>
          <button className="btn btn-outline" onClick={() => navigate('/marketing')}>
            📣 Marketing
          </button>
        </div>
      </div>
    </div>
  )
}
