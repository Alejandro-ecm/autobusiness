import { useState, useEffect } from 'react'
import { useAuth } from '../store/AuthContext'
import client from '../api/client'
import './Finance.css'

const fmt = (n) => `$${Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const pct = (n) => `${Number(n || 0).toFixed(1)}%`

function BarChart({ data }) {
  if (!data?.length) return (
    <div className="chart-empty">Sin ventas en este período</div>
  )
  const revenues = data.map(d => Number(d.revenue))
  const maxRev = Math.max(...revenues, 1)
  const W = 700, H = 160, PAD_L = 8, PAD_R = 8, PAD_TOP = 12, PAD_BOT = 28
  const chartW = W - PAD_L - PAD_R
  const chartH = H - PAD_TOP - PAD_BOT
  const barW = Math.max(3, chartW / data.length - 2)
  const step = chartW / data.length

  const showLabel = (i) => {
    if (data.length <= 10) return true
    if (data.length <= 20) return i % 2 === 0
    return i % 5 === 0 || i === data.length - 1
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="bar-chart" preserveAspectRatio="none">
      {/* Grid lines */}
      {[0.25, 0.5, 0.75, 1].map(pct => (
        <line key={pct}
          x1={PAD_L} y1={PAD_TOP + chartH * (1 - pct)}
          x2={W - PAD_R} y2={PAD_TOP + chartH * (1 - pct)}
          stroke="#e2e8f0" strokeWidth="0.5" />
      ))}
      {/* Bars */}
      {data.map((d, i) => {
        const rev = Number(d.revenue)
        const barH = Math.max(2, (rev / maxRev) * chartH)
        const x = PAD_L + i * step + (step - barW) / 2
        const y = PAD_TOP + chartH - barH
        const isWeekend = new Date(d.day + 'T12:00:00').getDay() % 6 === 0
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={barH}
              fill={rev === 0 ? '#e2e8f0' : isWeekend ? '#818cf8' : '#6366f1'}
              rx={barW > 6 ? 3 : 1} opacity={0.9}>
              <title>{d.day}: {fmt(rev)}</title>
            </rect>
            {showLabel(i) && (
              <text x={x + barW / 2} y={H - 6}
                textAnchor="middle" fontSize="8" fill="#94a3b8">
                {d.day.slice(5)}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

function MiniSparkline({ data, color = '#6366f1' }) {
  if (!data?.length || data.length < 2) return null
  const vals = data.map(d => Number(d.revenue))
  const max = Math.max(...vals, 1)
  const min = Math.min(...vals)
  const range = max - min || 1
  const W = 80, H = 32
  const pts = vals.map((v, i) => {
    const x = (i / (vals.length - 1)) * W
    const y = H - ((v - min) / range) * (H - 4) - 2
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  const lastUp = vals[vals.length - 1] >= vals[vals.length - 2]
  return (
    <svg width={W} height={H} className="sparkline">
      <polyline points={pts} fill="none" stroke={lastUp ? '#10b981' : '#ef4444'} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  )
}

function KpiCard({ label, value, sub, trend, icon, color }) {
  return (
    <div className={`finance-kpi card finance-kpi--${color || 'default'}`}>
      <div className="finance-kpi-top">
        <span className="finance-kpi-icon">{icon}</span>
        <span className={`finance-kpi-trend ${trend >= 0 ? 'up' : 'down'}`}>
          {trend != null ? (trend >= 0 ? `▲ ${pct(Math.abs(trend))}` : `▼ ${pct(Math.abs(trend))}`) : ''}
        </span>
      </div>
      <div className="finance-kpi-value">{value}</div>
      <div className="finance-kpi-label">{label}</div>
      {sub && <div className="finance-kpi-sub">{sub}</div>}
    </div>
  )
}

function DonutChart({ margin }) {
  const r = 52, cx = 68, cy = 68, stroke = 14
  const circ = 2 * Math.PI * r
  const pctVal = Math.min(Math.max(Number(margin) || 0, 0), 100)
  const dash = (pctVal / 100) * circ
  const color = pctVal < 20 ? '#ef4444' : pctVal < 40 ? '#f59e0b' : '#10b981'
  return (
    <svg width={136} height={136} className="donut-chart">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f1f5f9" strokeWidth={stroke} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`} />
      <text x={cx} y={cy - 6} textAnchor="middle" fontSize="18" fontWeight="700" fill={color}>
        {pct(pctVal)}
      </text>
      <text x={cx} y={cy + 14} textAnchor="middle" fontSize="10" fill="#64748b">Margen</text>
    </svg>
  )
}

export default function Finance() {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [today, setToday] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('resumen')
  const [advice, setAdvice] = useState([])

  const generateAdvice = (d) => {
    if (!d) return []
    const tips = []
    const rev = Number(d.revenue || 0)
    const margin = Number(d.margin || 0)
    const cost = Number(d.cost || 0)
    const daily = d.daily || []
    const top = d.topProducts || []

    if (margin < 15) {
      tips.push({ level: 'red', icon: '🚨', title: 'Margen crítico', text: `Tu margen de ${pct(margin)} es muy bajo. Por cada $100 de venta, ganas solo $${margin.toFixed(0)}. Sube precios al menos 10% o negocia mejores costos con proveedores.` })
    } else if (margin < 25) {
      tips.push({ level: 'yellow', icon: '⚠️', title: 'Margen mejorable', text: `Con ${pct(margin)} de margen tienes poco colchón ante gastos fijos. Busca reducir el costo de tus 3 productos más vendidos.` })
    } else {
      tips.push({ level: 'green', icon: '✅', title: 'Buen margen', text: `Tu margen de ${pct(margin)} es saludable. Mantén el control de costos y podrías llegar al 40%+.` })
    }

    const daysWithSales = daily.filter(d => Number(d.revenue) > 0).length
    const totalDays = daily.length
    if (totalDays > 7 && daysWithSales < totalDays * 0.5) {
      tips.push({ level: 'yellow', icon: '📅', title: 'Días sin ventas', text: `Solo tuviste ventas ${daysWithSales} de ${totalDays} días. Considera estrategias para generar tráfico los días muertos — promociones de martes o descuentos de temporada.` })
    }

    if (daily.length >= 14) {
      const firstHalf = daily.slice(0, Math.floor(daily.length/2)).reduce((s,d) => s+Number(d.revenue),0)
      const secondHalf = daily.slice(Math.floor(daily.length/2)).reduce((s,d) => s+Number(d.revenue),0)
      if (secondHalf < firstHalf * 0.8) {
        tips.push({ level: 'red', icon: '📉', title: 'Tendencia a la baja', text: `Tus ventas de la segunda quincena (${fmt(secondHalf)}) cayeron vs la primera (${fmt(firstHalf)}). Revisa si un producto se agotó o si hay competencia nueva.` })
      } else if (secondHalf > firstHalf * 1.2) {
        tips.push({ level: 'green', icon: '📈', title: 'Tendencia al alza', text: `Excelente: la segunda quincena superó a la primera en ${pct(((secondHalf-firstHalf)/firstHalf)*100)}. Aprovecha el impulso con más stock de tus productos estrella.` })
      }
    }

    if (top.length > 0) {
      const topRev = Number(top[0].revenue || 0)
      if (rev > 0 && topRev / rev > 0.6) {
        tips.push({ level: 'yellow', icon: '⚡', title: 'Alta dependencia de un producto', text: `"${top[0].name}" representa el ${pct((topRev/rev)*100)} de tus ingresos. Si se agota o baja su demanda, tu negocio se ve seriamente afectado. Diversifica tu catálogo.` })
      } else if (top.length > 0) {
        tips.push({ level: 'green', icon: '🏆', title: 'Producto estrella', text: `"${top[0].name}" es tu campeón con ${fmt(topRev)} en ventas. Asegúrate de tener siempre stock y considera crear un combo o versión premium de este producto.` })
      }
    }

    if (rev === 0) {
      tips.push({ level: 'red', icon: '🔴', title: 'Sin ventas registradas', text: 'No hay ventas en el sistema los últimos 30 días. Verifica que estés usando la Caja para registrar ventas o activa tu tienda online.' })
    } else if (rev > 0 && cost === 0) {
      tips.push({ level: 'yellow', icon: '💡', title: 'Registra tus costos', text: 'No tienes costos registrados en los productos. Sin costos, el margen real es desconocido. Actualiza el costo de cada producto en Inventario.' })
    }

    return tips
  }

  useEffect(() => {
    setLoading(true)
    setError(null)
    Promise.all([
      client.get('/dashboard/finance'),
      client.get('/dashboard').catch(() => null),
    ]).then(([finance, dash]) => {
      setData(finance)
      setAdvice(generateAdvice(finance))
      if (dash?.kpis) setToday(dash.kpis)
    }).catch(err => setError(err?.error || err?.message || 'Error al cargar datos financieros'))
      .finally(() => setLoading(false))
  }, [user?.businessId])

  if (loading) return (
    <div className="page-loading">
      <div className="spinner" style={{ width: 36, height: 36 }} />
      <p style={{ marginTop: 12, color: '#1e293b' }}>Cargando datos financieros...</p>
    </div>
  )
  if (error) return (
    <div className="page-loading">
      <div style={{ fontSize: 40 }}>⚠️</div>
      <p style={{ color: '#ef4444', fontWeight: 600, marginTop: 12 }}>{error}</p>
      <button className="btn btn-primary" style={{ marginTop: 16 }}
        onClick={() => { setLoading(true); setError(null); client.get('/dashboard/finance').then(d => { setData(d); setAdvice(generateAdvice(d)) }).catch(e => setError(e?.error || 'Error')).finally(() => setLoading(false)) }}>
        Reintentar
      </button>
    </div>
  )
  if (!data) return null

  const hasDaily = data.daily?.length > 0
  const weekRevenue = hasDaily
    ? data.daily.slice(-7).reduce((s, d) => s + Number(d.revenue), 0)
    : 0
  const prevWeekRevenue = hasDaily && data.daily.length >= 14
    ? data.daily.slice(-14, -7).reduce((s, d) => s + Number(d.revenue), 0)
    : null
  const weekTrend = prevWeekRevenue
    ? ((weekRevenue - prevWeekRevenue) / (prevWeekRevenue || 1)) * 100
    : null

  return (
    <div className="finance-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Finanzas</h1>
          <p className="page-subtitle">Período: {data.period}</p>
        </div>
        <div className="finance-tabs">
          {['resumen', 'tendencia', 'productos', 'consejos'].map(t => (
            <button key={t} className={`tab-btn ${activeTab === t ? 'active' : ''}`}
              onClick={() => setActiveTab(t)}>
              {t === 'consejos' ? `🤖 Consejos${advice.length > 0 ? ` (${advice.length})` : ''}` : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Banner HOY */}
      {today && (
        <div className="finance-today-banner">
          <div className="finance-today-item">
            <span className="finance-today-icon">📅</span>
            <div>
              <div className="finance-today-val">{fmt(today.todayRevenue)}</div>
              <div className="finance-today-lbl">Ingresos hoy</div>
            </div>
          </div>
          <div className="finance-today-divider" />
          <div className="finance-today-item">
            <span className="finance-today-icon">🛒</span>
            <div>
              <div className="finance-today-val">{today.todaySales}</div>
              <div className="finance-today-lbl">Ventas hoy</div>
            </div>
          </div>
          <div className="finance-today-divider" />
          <div className="finance-today-item">
            <span className="finance-today-icon">{Number(today.revenueGrowth) >= 0 ? '📈' : '📉'}</span>
            <div>
              <div className="finance-today-val" style={{ color: Number(today.revenueGrowth) >= 0 ? '#059669' : '#ef4444' }}>
                {Number(today.revenueGrowth) >= 0 ? '+' : ''}{pct(today.revenueGrowth)}
              </div>
              <div className="finance-today-lbl">vs mes anterior</div>
            </div>
          </div>
          {Number(data.margin) > 0 && (
            <>
              <div className="finance-today-divider" />
              <div className="finance-today-item finance-today-profit">
                <span className="finance-today-icon">💵</span>
                <div>
                  <div className="finance-today-val" style={{ color: '#059669' }}>
                    {fmt(Number(today.todayRevenue) * (Number(data.margin) / 100))}
                  </div>
                  <div className="finance-today-lbl">Utilidad est. hoy ({pct(data.margin)} margen)</div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* KPI Cards */}
      <div className="finance-kpis">
        <KpiCard icon="💰" label="Ingresos 30 días" value={fmt(data.revenue)} color="primary"
          trend={Number(data.revenueGrowth || 0)} sub="vs mes anterior" />
        <KpiCard icon="📦" label="Costo de ventas" value={fmt(data.cost)} color="warning"
          trend={null} sub="Costo directo de productos" />
        <KpiCard icon="📈" label="Ganancia bruta" value={fmt(data.grossProfit)} color="success"
          trend={null} sub={`Margen ${pct(data.margin)}`} />
        <KpiCard icon="🗓" label="Ventas última semana" value={fmt(weekRevenue)} color="info"
          trend={weekTrend} sub={weekTrend != null ? 'vs semana anterior' : 'semana en curso'} />
      </div>

      {/* Tab: Resumen */}
      {activeTab === 'resumen' && (
        <>
        {/* Month vs prev month comparison */}
        <div className="month-compare-bar card">
          <div className="month-compare-item">
            <span className="text-soft" style={{ fontSize: 12 }}>Mes anterior</span>
            <strong style={{ fontSize: 18 }}>{fmt(data.prevRevenue)}</strong>
          </div>
          <div className="month-compare-arrow">
            <span style={{ fontSize: 22 }}>{Number(data.revenueGrowth) >= 0 ? '📈' : '📉'}</span>
            <span className={`finance-kpi-trend ${Number(data.revenueGrowth) >= 0 ? 'up' : 'down'}`} style={{ fontSize: 16, padding: '4px 12px' }}>
              {Number(data.revenueGrowth) >= 0 ? '+' : ''}{pct(data.revenueGrowth)} vs mes anterior
            </span>
          </div>
          <div className="month-compare-item" style={{ textAlign: 'right' }}>
            <span className="text-soft" style={{ fontSize: 12 }}>Este mes</span>
            <strong style={{ fontSize: 18, color: '#6366f1' }}>{fmt(data.revenue)}</strong>
          </div>
        </div>
        <div className="finance-grid-2">
          {/* Donut + margen */}
          <div className="card finance-margin-card">
            <h3 className="section-title">Salud del margen</h3>
            <div className="margin-center">
              <DonutChart margin={data.margin} />
              <div className="margin-legend">
                <div className="margin-row">
                  <span className="dot dot-success" /> <span>Bueno &gt;40%</span>
                </div>
                <div className="margin-row">
                  <span className="dot dot-warning" /> <span>Aceptable 20-40%</span>
                </div>
                <div className="margin-row">
                  <span className="dot dot-danger" /> <span>Bajo &lt;20%</span>
                </div>
              </div>
            </div>
            <div className="margin-advice">
              {Number(data.margin) < 20
                ? '⚠️ Margen bajo — revisa precios y costos de compra'
                : Number(data.margin) < 40
                ? '💡 Margen aceptable — hay oportunidad de mejora'
                : '✅ Buen margen — mantén esta rentabilidad'}
            </div>
          </div>

          {/* Simulador */}
          <div className="card">
            <h3 className="section-title">Simulador "¿Qué pasa si?"</h3>
            <p className="text-soft" style={{ marginBottom: 16, fontSize: 13 }}>
              {data.simulation?.message}
            </p>
            <div className="sim-table">
              <div className="sim-row">
                <div className="sim-scenario">Precios actuales</div>
                <div className="sim-value">{fmt(data.revenue)}</div>
                <div className="sim-delta neutral">—</div>
              </div>
              <div className="sim-row highlight">
                <div className="sim-scenario">Subir precios 10%</div>
                <div className="sim-value">{fmt(data.simulation?.price_up_10)}</div>
                <div className="sim-delta positive">+{fmt(data.simulation?.price_up_10 - data.revenue)}</div>
              </div>
              <div className="sim-row highlight2">
                <div className="sim-scenario">Subir precios 15%</div>
                <div className="sim-value">{fmt(data.simulation?.price_up_15)}</div>
                <div className="sim-delta positive">+{fmt(data.simulation?.price_up_15 - data.revenue)}</div>
              </div>
            </div>
            <p className="text-soft" style={{ fontSize: 11, marginTop: 12 }}>
              * La simulación asume que el volumen de ventas se mantiene igual
            </p>
          </div>
        </div>
        </>
      )}

      {/* Tab: Tendencia */}
      {activeTab === 'tendencia' && (
        <div className="card finance-chart-card">
          <div className="chart-header">
            <h3 className="section-title">Ingresos diarios — últimos 30 días</h3>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              {hasDaily && (
                <div className="chart-legend">
                  <span className="legend-dot" style={{ background: '#6366f1' }} /> Días de semana
                  <span className="legend-dot" style={{ background: '#818cf8', marginLeft: 12 }} /> Fines de semana
                </div>
              )}
              {hasDaily && (
                <button className="btn btn-sm btn-outline" onClick={() => {
                  const csv = 'Fecha,Ingresos\n' + data.daily.map(d => `${d.day},${Number(d.revenue).toFixed(2)}`).join('\n')
                  const a = document.createElement('a')
                  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv)
                  a.download = 'ingresos_30dias.csv'
                  a.click()
                }}>
                  ⬇ Exportar CSV
                </button>
              )}
            </div>
          </div>
          <BarChart data={data.daily} />
          {hasDaily && (
            <div className="chart-stats">
              <div className="chart-stat">
                <span className="text-soft">Mejor día</span>
                <strong>{fmt(Math.max(...data.daily.map(d => Number(d.revenue))))}</strong>
              </div>
              <div className="chart-stat">
                <span className="text-soft">Promedio diario</span>
                <strong>{fmt(data.daily.reduce((s, d) => s + Number(d.revenue), 0) / data.daily.length)}</strong>
              </div>
              <div className="chart-stat">
                <span className="text-soft">Días con ventas</span>
                <strong>{data.daily.filter(d => Number(d.revenue) > 0).length} / {data.daily.length}</strong>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab: Productos */}
      {activeTab === 'productos' && (
        <div className="card">
          <h3 className="section-title" style={{ marginBottom: 20 }}>Productos más rentables — 30 días</h3>
          {data.topProducts?.length > 0 ? (
            <>
              {data.topProducts.map((p, i) => {
                const maxRev = Number(data.topProducts[0]?.revenue || 1)
                const barPct = (Number(p.revenue) / maxRev) * 100
                return (
                  <div key={i} className="top-product-row">
                    <div className="top-product-rank">{i + 1}</div>
                    <div className="top-product-info">
                      <div className="top-product-name">{p.name}</div>
                      <div className="top-product-bar-wrap">
                        <div className="top-product-bar" style={{ width: `${barPct}%` }} />
                      </div>
                    </div>
                    <div className="top-product-stats">
                      <div className="font-semibold text-success">{fmt(p.revenue)}</div>
                      <div className="text-soft text-sm">{Number(p.qty)} vendidos</div>
                    </div>
                    <MiniSparkline data={data.daily} />
                  </div>
                )
              })}
            </>
          ) : (
            <div className="empty-state" style={{ padding: 40, textAlign: 'center' }}>
              <p className="text-soft">Sin ventas en los últimos 30 días</p>
            </div>
          )}
        </div>
      )}

      {/* Tab: Consejos IA */}
      {activeTab === 'consejos' && (
        <div className="advice-section">
          <div className="advice-header">
            <span style={{ fontSize: 28 }}>🤖</span>
            <div>
              <h3 style={{ margin: 0, fontWeight: 700 }}>Análisis inteligente de tu negocio</h3>
              <p className="text-soft" style={{ fontSize: 13 }}>Basado en tus datos reales de los últimos 30 días</p>
            </div>
          </div>
          {advice.length > 0 ? advice.map((tip, i) => (
            <div key={i} className={`advice-card advice-card--${tip.level}`}>
              <div className="advice-icon">{tip.icon}</div>
              <div className="advice-body">
                <div className="advice-title">{tip.title}</div>
                <div className="advice-text">{tip.text}</div>
              </div>
            </div>
          )) : (
            <div className="card" style={{ padding: 40, textAlign: 'center' }}>
              <p className="text-soft">No hay datos suficientes para generar consejos.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
