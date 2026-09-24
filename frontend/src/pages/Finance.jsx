import { useState, useEffect } from 'react'
import { useAuth } from '../store/AuthContext'
import client from '../api/client'
import { inventory as inventoryApi } from '../api'
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

function Bar({ value, max, color = '#6366f1' }) {
  const w = max > 0 ? Math.min((Math.abs(value) / max) * 100, 100) : 0
  return (
    <div style={{ height: 8, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${w}%`, background: color, borderRadius: 4, transition: 'width .6s' }} />
    </div>
  )
}

function Tooltip({ text }) {
  const [show, setShow] = useState(false)
  return (
    <span style={{ position: 'relative', display: 'inline-block' }}>
      <button
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1e293b', fontSize: 14, padding: '0 4px' }}
        onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>ℹ️</button>
      {show && (
        <div style={{
          position: 'absolute', bottom: '120%', left: '50%', transform: 'translateX(-50%)',
          background: '#1e293b', color: '#fff', fontSize: 12, padding: '8px 12px',
          borderRadius: 8, width: 220, zIndex: 100, lineHeight: 1.5,
          boxShadow: '0 4px 16px rgba(0,0,0,.3)',
        }}>{text}</div>
      )}
    </span>
  )
}

const TABS = [
  ['resumen',     'Resumen'],
  ['tendencia',   'Tendencia'],
  ['productos',   'Productos'],
  ['consejos',    'consejos'],
  ['resultados',  '📊 Estado de Resultados'],
  ['balance',     '⚖️ Balance e Indicadores'],
]

export default function Finance() {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [today, setToday] = useState(null)
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('resumen')
  const [advice, setAdvice] = useState([])
  const [opex, setOpex] = useState('')

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

    // ── Consejos de crecimiento (siempre disponibles) ──
    // Sirven para completar hasta 8 consejos útiles para hacer crecer la tienda.
    const growth = [
      { level: 'blue', icon: '🌐', title: 'Activa tu tienda online', text: 'Publica tus productos en tu tienda online y comparte el link por WhatsApp. Vender en línea no cuesta extra y te trae clientes fuera del horario de la tienda.' },
      { level: 'blue', icon: '📲', title: 'Vende por WhatsApp', text: 'Usa la sección de Marketing para generar promociones y mándalas por WhatsApp a tus clientes frecuentes. Un mensaje a 50 contactos suele traer ventas el mismo día.' },
      { level: 'blue', icon: '🎁', title: 'Crea combos y paquetes', text: 'Arma paquetes de productos que se compran juntos (ej. cuaderno + plumas + lápiz). Los combos suben tu ticket promedio sin que sientas que "regalas" producto.' },
      { level: 'blue', icon: '🛒', title: 'Sube el ticket promedio', text: 'Entrena a tu cajero para ofrecer un producto extra al cobrar ("¿Te llevas también…?"). Una venta cruzada de $10 por cliente al día son cientos de pesos al mes.' },
      { level: 'blue', icon: '⭐', title: 'Cuida a tus clientes frecuentes', text: 'Registra a tus clientes en la sección Clientes y dales un trato preferente. Es 5 veces más barato venderle de nuevo a un cliente que conseguir uno nuevo.' },
      { level: 'blue', icon: '📦', title: 'Evita quedarte sin stock', text: 'Revisa Inventario cada semana y reabastece tus productos más vendidos antes de que se agoten. Un producto agotado es una venta que se va con la competencia.' },
      { level: 'blue', icon: '🏷️', title: 'Acomoda lo más rentable al frente', text: 'Pon los productos de mayor margen a la altura de los ojos y junto a la caja. Lo que está a la mano se vende más; lo que está escondido casi no rota.' },
      { level: 'blue', icon: '📅', title: 'Aprovecha fechas y temporadas', text: 'Planea tu surtido para fechas fuertes (regreso a clases, fin de mes, días festivos). Tener el producto correcto en la fecha correcta dispara tus ventas.' },
      { level: 'blue', icon: '💳', title: 'Acepta más formas de pago', text: 'Ofrece pago con tarjeta y transferencia además de efectivo. Muchos clientes compran más cuando no dependen del efectivo que traen encima.' },
      { level: 'blue', icon: '🧮', title: 'Registra TODO en la Caja', text: 'Cobra siempre desde la Caja, aunque sea una venta pequeña. Mientras más completos tus datos, mejores y más exactos serán estos consejos para tu tienda.' },
      { level: 'blue', icon: '🔄', title: 'Detecta productos que no rotan', text: 'Identifica los productos que llevan semanas sin venderse y ponlos en oferta o promoción. Ese dinero "dormido" en el estante lo puedes reinvertir en lo que sí vende.' },
      { level: 'blue', icon: '🤝', title: 'Negocia con tus proveedores', text: 'Pide descuento por volumen o busca un segundo proveedor para comparar precios. Bajar 5% tu costo es ganancia directa sin vender un solo producto más.' },
    ]

    // Completa hasta 8 consejos sin repetir títulos
    const seen = new Set(tips.map(t => t.title))
    for (const g of growth) {
      if (tips.length >= 8) break
      if (!seen.has(g.title)) { tips.push(g); seen.add(g.title) }
    }

    return tips.slice(0, 8)
  }

  useEffect(() => {
    setLoading(true)
    setError(null)
    Promise.all([
      client.get('/dashboard/finance'),
      client.get('/dashboard').catch(() => null),
      inventoryApi.list().catch(() => []),
    ]).then(([finance, dash, prods]) => {
      setData(finance)
      setAdvice(generateAdvice(finance))
      if (dash?.kpis) setToday(dash.kpis)
      setProducts(prods)
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

  // ── Estado de Resultados / Balance (fusionado desde Contabilidad) ──
  const purchasesTotal = Number(data.purchases || 0)
  const opexVal   = parseFloat(opex) || 0
  const netIncome = Number(data.grossProfit || 0) - opexVal
  const netMargin = Number(data.revenue) > 0 ? (netIncome / Number(data.revenue) * 100) : 0
  const netCash   = Number(data.revenue || 0) - purchasesTotal

  const inventoryValue = products.reduce((s, p) => s + (Number(p.cost || 0) * Number(p.stock || 0)), 0)
  const cashEstimate   = Math.max(netCash * 0.7, 0)
  const totalAssets    = inventoryValue + cashEstimate
  const equity         = totalAssets // pasivos = 0

  const inventoryTurnover = inventoryValue > 0 && Number(data.cost) > 0 ? (Number(data.cost) / inventoryValue).toFixed(2) : null
  const breakEven = Number(data.margin) > 0 && opexVal > 0 ? (opexVal / (Number(data.margin) / 100)) : null
  const avgDailySales = data.daily?.length > 0
    ? Number(data.revenue) / Math.max(data.daily.filter(d => Number(d.revenue) > 0).length, 1) : 0

  return (
    <div className="finance-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Finanzas</h1>
          <p className="page-subtitle">Período: {data.period}</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {(activeTab === 'resultados' || activeTab === 'balance') && (
            <button className="btn btn-outline" onClick={() => window.print()}>🖨️ Imprimir reporte</button>
          )}
          <div className="finance-tabs">
            {TABS.map(([t, label]) => (
              <button key={t} className={`tab-btn ${activeTab === t ? 'active' : ''}`}
                onClick={() => setActiveTab(t)}>
                {t === 'consejos' ? `🤖 Consejos${advice.length > 0 ? ` (${advice.length})` : ''}` : label}
              </button>
            ))}
          </div>
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

      <div className="finance-kpis">
        <KpiCard icon="🔁" label="Entradas por transferencia" value={fmt(data.incomingTransferCost)} color="success"
          trend={null} sub="Inventario recibido a costo" />
        <KpiCard icon="📤" label="Salidas por transferencia" value={fmt(data.outgoingTransferCost)} color="warning"
          trend={null} sub="Inventario enviado a costo" />
        <KpiCard icon="🏪" label="Inversión en inventario" value={fmt(data.inventoryInvestment)} color="primary"
          trend={null} sub="Compras + entradas por transferencia" />
        <KpiCard icon="🧾" label="Caja operativa" value={fmt(data.netCash)} color="info"
          trend={null} sub="Ventas - compras a proveedores" />
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

        <div className="card" style={{ marginTop: 20 }}>
          <h3 className="section-title">Transferencias entre negocios</h3>
          <p className="text-soft" style={{ marginBottom: 16, fontSize: 13 }}>
            Estas transferencias no se cuentan como ventas. Se registran aparte para cuidar inventario, presupuesto y valuación contable.
          </p>
          <div className="sim-table">
            <div className="sim-row">
              <div className="sim-scenario">Inventario recibido</div>
              <div className="sim-value">{fmt(data.incomingTransferCost)}</div>
              <div className="sim-delta positive">Entrada a costo</div>
            </div>
            <div className="sim-row">
              <div className="sim-scenario">Inventario enviado</div>
              <div className="sim-value">{fmt(data.outgoingTransferCost)}</div>
              <div className="sim-delta neutral">Salida interna</div>
            </div>
            <div className="sim-row highlight2">
              <div className="sim-scenario">Inversión total en inventario</div>
              <div className="sim-value">{fmt(data.inventoryInvestment)}</div>
              <div className="sim-delta neutral">Compras + transferencias recibidas</div>
            </div>
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

      {/* Tab: Estado de Resultados (fusionado desde Contabilidad) */}
      {activeTab === 'resultados' && (
        <div className="conta-grid">
          <div className="card">
            <div className="conta-card-header">
              <h3 className="section-title">Estado de Resultados</h3>
              <span className="text-soft text-sm">Período: {data.period || 'últimos 30 días'}</span>
            </div>
            <div className="conta-explain">
              ℹ️ Muestra cuánto ganaste o perdiste. La fórmula: <strong>Ingresos − Costos − Gastos = Utilidad</strong>
            </div>

            <div className="conta-table">
              <div className="conta-row conta-row--header">
                <span>Concepto</span><span>Monto</span>
              </div>
              <div className="conta-row conta-row--income">
                <span>
                  💹 Ingresos por ventas
                  <Tooltip text="Total de dinero cobrado por ventas en los últimos 30 días. Todavía no es ganancia." />
                </span>
                <span className="conta-amount positive">{fmt(data.revenue)}</span>
              </div>
              <div className="conta-row conta-row--cost">
                <span>
                  📦 (−) Costo de ventas
                  <Tooltip text="Lo que pagaste por los productos que vendiste (precio de compra × unidades vendidas)." />
                </span>
                <span className="conta-amount negative">({fmt(data.cost)})</span>
              </div>
              <div className="conta-row conta-row--cost">
                <span>
                  🔁 Transferencias internas recibidas
                  <Tooltip text="Mercancía recibida desde otro negocio conectado. Aumenta tu inventario, pero no cuenta como venta." />
                </span>
                <span className="conta-amount">{fmt(data.incomingTransferCost)}</span>
              </div>
              <div className="conta-row conta-row--subtotal">
                <span><strong>= Utilidad Bruta</strong> <span className="text-soft text-sm">[margen {pct(data.margin)}]</span></span>
                <strong className="conta-amount">{fmt(data.grossProfit)}</strong>
              </div>

              <div className="conta-row">
                <span>
                  🏢 (−) Gastos operativos
                  <Tooltip text="Renta, luz, internet, sueldos, etc. Ingresa el total mensual aquí para calcular tu utilidad real." />
                </span>
                <span>
                  <input
                    type="number" className="input conta-opex-input"
                    placeholder="Ej: 8000"
                    value={opex}
                    onChange={e => setOpex(e.target.value)}
                  />
                </span>
              </div>

              <div className={`conta-row conta-row--total ${netIncome >= 0 ? 'green' : 'red'}`}>
                <span><strong>= {netIncome >= 0 ? '✅ Utilidad Neta' : '❌ Pérdida Neta'}</strong></span>
                <strong className={`conta-amount ${netIncome >= 0 ? 'positive' : 'negative'}`}>{fmt(netIncome)}</strong>
              </div>
            </div>

            {/* ── Flujo de Caja ── */}
            <div style={{ marginTop: 24 }}>
              <div className="conta-card-header" style={{ marginBottom: 8 }}>
                <h3 className="section-title">Flujo de Caja</h3>
                <Tooltip text="Muestra el dinero real que entró y salió de tu bolsillo este período, independientemente de las ganancias." />
              </div>
              <div className="conta-explain" style={{ marginBottom: 10 }}>
                ℹ️ <strong>Dinero que entra y sale.</strong> Las compras a proveedores son efectivo que sale de tu caja.
              </div>
              <div className="conta-table">
                <div className="conta-row conta-row--header">
                  <span>Movimiento</span><span>Monto</span>
                </div>
                <div className="conta-row conta-row--income">
                  <span>
                    ✅ Dinero que entró (ventas)
                    <Tooltip text="Ingresos reales cobrados por ventas en los últimos 30 días." />
                  </span>
                  <span className="conta-amount positive">{fmt(data.revenue)}</span>
                </div>
                <div className="conta-row conta-row--cost">
                  <span>
                    📤 Dinero que salió (compras a proveedores)
                    <Tooltip text="Total pagado a proveedores por mercancía en los últimos 30 días. Este dinero ya salió de tu caja." />
                  </span>
                  <span className="conta-amount negative">({fmt(purchasesTotal)})</span>
                </div>
                <div className="conta-row">
                  <span>
                    📦 Transferencias entre negocios
                    <Tooltip text="Se muestran por separado para control interno. No se toman como ventas ni como efectivo cobrado." />
                  </span>
                  <span>{fmt(data.incomingTransferCost)} entrada / {fmt(data.outgoingTransferCost)} salida</span>
                </div>
                <div className={`conta-row conta-row--total ${netCash >= 0 ? 'green' : 'red'}`}>
                  <span><strong>= {netCash >= 0 ? '💰 Saldo neto de caja' : '⚠️ Déficit de caja'}</strong></span>
                  <strong className={`conta-amount ${netCash >= 0 ? 'positive' : 'negative'}`}>{fmt(netCash)}</strong>
                </div>
              </div>
              {purchasesTotal === 0 && (
                <div className="conta-explain" style={{ marginTop: 8, background: '#f8fafc' }}>
                  Sin compras a proveedores registradas en este período. Registra compras en la sección <strong>Compras</strong>.
                </div>
              )}
            </div>

            <div className="conta-bars">
              <div className="conta-bar-row">
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                  <span>Margen bruto</span><strong>{pct(data.margin)}</strong>
                </div>
                <Bar value={Number(data.margin)} max={100} color={Number(data.margin) > 30 ? '#10b981' : Number(data.margin) > 15 ? '#f59e0b' : '#ef4444'} />
              </div>
              {opexVal > 0 && (
                <div className="conta-bar-row">
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                    <span>Margen neto</span>
                    <strong style={{ color: netMargin >= 0 ? '#059669' : '#dc2626' }}>{pct(netMargin)}</strong>
                  </div>
                  <Bar value={Math.abs(netMargin)} max={100} color={netMargin >= 0 ? '#6366f1' : '#ef4444'} />
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <h3 className="section-title">Guía para no contadores</h3>
            <div className="conta-guide">
              <div className="conta-guide-item">
                <span className="conta-guide-icon">💹</span>
                <div>
                  <strong>Ingresos</strong>
                  <p>El dinero que <em>entra</em> por ventas. Si vendes 10 playeras a $200, tus ingresos son $2,000.</p>
                </div>
              </div>
              <div className="conta-guide-item">
                <span className="conta-guide-icon">📦</span>
                <div>
                  <strong>Costo de ventas (COGS)</strong>
                  <p>Lo que pagaste por esas 10 playeras (ej. $100 c/u = $1,000). Este es tu costo directo.</p>
                </div>
              </div>
              <div className="conta-guide-item">
                <span className="conta-guide-icon">🏢</span>
                <div>
                  <strong>Gastos operativos</strong>
                  <p>Renta del local, luz, internet, sueldos de empleados. Son los gastos para que el negocio funcione.</p>
                </div>
              </div>
              <div className="conta-guide-item">
                <span className={`conta-guide-icon ${netIncome >= 0 ? '' : 'danger'}`}>
                  {netIncome >= 0 ? '💰' : '⚠️'}
                </span>
                <div>
                  <strong>{netIncome >= 0 ? 'Utilidad Neta' : 'Estás perdiendo dinero'}</strong>
                  <p>{netIncome >= 0
                    ? `Tu negocio generó ${fmt(netIncome)} de ganancia real este mes. ¡Bien hecho!`
                    : `Gastas más de lo que ganas. Sube precios, reduce costos o incrementa ventas urgente.`}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Balance e Indicadores (fusionado desde Contabilidad) */}
      {activeTab === 'balance' && (
        <>
          <div className="conta-grid">
            <div className="card">
              <div className="conta-card-header">
                <h3 className="section-title">Balance General</h3>
                <span className="badge badge-blue">Estimado</span>
              </div>
              <div className="conta-explain">
                ℹ️ La regla de oro: <strong>Activos = Pasivos + Capital</strong>. Todo lo que tienes = todo lo que debes + lo tuyo.
              </div>

              <div className="conta-balance-grid">
                <div>
                  <div className="conta-section-head green">ACTIVO</div>
                  <div className="conta-table">
                    <div className="conta-row conta-row--header"><span>Concepto</span><span>Valor</span></div>
                    <div className="conta-row">
                      <span>📦 Inventario (a costo)
                        <Tooltip text="Suma del (costo × stock) de todos tus productos actuales. Es tu dinero en mercancía." />
                      </span>
                      <span className="font-semibold">{fmt(inventoryValue)}</span>
                    </div>
                    <div className="conta-row">
                      <span>🔁 Inversión en inventario del período
                        <Tooltip text="Compras a proveedores más inventario recibido por transferencias internas." />
                      </span>
                      <span className="font-semibold">{fmt(data.inventoryInvestment)}</span>
                    </div>
                    <div className="conta-row">
                      <span>💵 Efectivo estimado
                        <Tooltip text="Estimado del 70% de tu utilidad bruta del período. Para datos exactos, lleva una caja diaria." />
                      </span>
                      <span className="font-semibold">{fmt(cashEstimate)}</span>
                    </div>
                    <div className="conta-row conta-row--subtotal">
                      <strong>Total Activo</strong>
                      <strong className="conta-amount positive">{fmt(totalAssets)}</strong>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="conta-section-head red">PASIVO</div>
                  <div className="conta-table">
                    <div className="conta-row conta-row--header"><span>Concepto</span><span>Valor</span></div>
                    <div className="conta-row">
                      <span>💳 Deudas registradas
                        <Tooltip text="El sistema aún no registra deudas. Consulta a un contador para incluirlas." />
                      </span>
                      <span className="text-soft">—</span>
                    </div>
                    <div className="conta-row conta-row--subtotal">
                      <strong>Total Pasivo</strong>
                      <strong>{fmt(0)}</strong>
                    </div>
                  </div>
                  <div className="conta-section-head purple" style={{ marginTop: 14 }}>CAPITAL</div>
                  <div className="conta-table">
                    <div className="conta-row">
                      <span>🏦 Capital del negocio
                        <Tooltip text="Activos − Pasivos. Lo que vale tu negocio si pagaras todas las deudas." />
                      </span>
                      <span className="font-semibold text-success">{fmt(equity)}</span>
                    </div>
                    <div className="conta-row conta-row--subtotal">
                      <strong>Total Capital</strong>
                      <strong className="conta-amount positive">{fmt(equity)}</strong>
                    </div>
                  </div>
                  <div className="conta-balance-check">
                    <span>✅ Activo = Pasivo + Capital</span>
                    <span>{fmt(totalAssets)} = {fmt(0)} + {fmt(equity)}</span>
                  </div>
                </div>
              </div>

              <div className="conta-explain" style={{ marginTop: 16, background: '#fffbeb', borderColor: '#fbbf24' }}>
                ⚠️ Este es un balance estimado. Para fines fiscales y legales, trabaja con un contador certificado.
              </div>
            </div>

            <div className="card">
              <h3 className="section-title">¿Para qué sirve el Balance?</h3>
              <div className="conta-guide">
                <div className="conta-guide-item">
                  <span className="conta-guide-icon">🏦</span>
                  <div>
                    <strong>Activos</strong>
                    <p>Todo lo que tiene tu negocio: mercancía, efectivo, equipo, cuentas por cobrar. Es lo que posees.</p>
                  </div>
                </div>
                <div className="conta-guide-item">
                  <span className="conta-guide-icon">💳</span>
                  <div>
                    <strong>Pasivos</strong>
                    <p>Todo lo que debes: préstamos, créditos con proveedores, tarjetas. Es lo que tienes que pagar.</p>
                  </div>
                </div>
                <div className="conta-guide-item">
                  <span className="conta-guide-icon">💼</span>
                  <div>
                    <strong>Capital</strong>
                    <p>Lo que realmente es tuyo: Activos − Pasivos. Si crece cada mes, tu negocio está funcionando.</p>
                  </div>
                </div>
                <div className="conta-guide-item">
                  <span className="conta-guide-icon">📦</span>
                  <div>
                    <strong>Tu inventario vale {fmt(inventoryValue)}</strong>
                    <p>Tienes {products.length} productos. Este dinero está "guardado" en mercancía — cuídalo rotándolo bien.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="conta-kpis" style={{ marginTop: 20 }}>
            {[
              {
                icon: '📊', label: 'Margen bruto',
                value: pct(data.margin),
                good: Number(data.margin) >= 20,
                desc: `Por cada $100 vendidos, ganas $${Number(data.margin).toFixed(0)} antes de gastos operativos.`,
                bench: 'Ideal: >30%',
              },
              {
                icon: '💰', label: 'Margen neto',
                value: opexVal > 0 ? pct(netMargin) : 'Ingresa gastos →',
                good: netMargin >= 0,
                desc: `Ganancia real después de ${opexVal > 0 ? 'todos los gastos' : 'gastos operativos (ingresa tus gastos en Estado de Resultados)'}.`,
                bench: 'Ideal: >10%',
              },
              {
                icon: '🔄', label: 'Rotación de inventario',
                value: inventoryTurnover ? `${inventoryTurnover}x / mes` : 'Sin costo registrado',
                good: inventoryTurnover ? inventoryTurnover >= 1 : false,
                desc: 'Cuántas veces vendiste el valor de tu inventario. Más alto = mejor flujo de caja.',
                bench: 'Ideal: >1x por mes',
              },
              {
                icon: '📦', label: 'Valor del inventario',
                value: fmt(inventoryValue),
                good: true,
                desc: `${products.length} productos en bodega. Capital inmovilizado en mercancía.`,
                bench: `${products.filter(p => p.stock === 0).length} agotados`,
              },
              {
                icon: '⚖️', label: 'Punto de equilibrio',
                value: breakEven ? fmt(breakEven) : opexVal === 0 ? 'Ingresa gastos →' : 'N/A',
                good: breakEven ? Number(data.revenue) >= breakEven : true,
                desc: 'Ventas mínimas para no perder dinero. Si estás por encima, tienes utilidad.',
                bench: breakEven && Number(data.revenue) >= breakEven ? `✅ Estás ${fmt(Number(data.revenue) - breakEven)} arriba` : breakEven ? `⚠️ Faltan ${fmt(breakEven - Number(data.revenue))}` : '',
              },
              {
                icon: '🧾', label: 'Promedio diario de ventas',
                value: fmt(avgDailySales),
                good: avgDailySales > 0,
                desc: 'Ingresos promedio en días con ventas registradas en los últimos 30 días.',
                bench: `${data.daily?.filter(d => Number(d.revenue) > 0).length || 0} días activos`,
              },
            ].map((kpi, i) => (
              <div key={i} className="card conta-kpi-card">
                <div className="conta-kpi-top">
                  <span style={{ fontSize: 26 }}>{kpi.icon}</span>
                  <span className={`badge ${kpi.good ? 'badge-green' : 'badge-red'}`}>
                    {kpi.good ? '✓ OK' : '⚠ Atención'}
                  </span>
                </div>
                <div className="conta-kpi-val">{kpi.value}</div>
                <div className="conta-kpi-label">{kpi.label}</div>
                <div className="conta-kpi-desc">{kpi.desc}</div>
                {kpi.bench && <div className="conta-kpi-bench">{kpi.bench}</div>}
              </div>
            ))}
          </div>

          <div className="card" style={{ marginTop: 20 }}>
            <h3 className="section-title" style={{ marginBottom: 16 }}>Glosario contable básico</h3>
            <div className="conta-glosario">
              {[
                ['COGS', 'Cost of Goods Sold — Costo de lo vendido. Lo que pagaste por la mercancía que ya vendiste.'],
                ['Margen bruto', 'Ingresos − COGS. La ganancia antes de pagar gastos operativos. Mientras más alto, mejor.'],
                ['Margen neto', 'Ganancia final después de todos los gastos. Puede ser negativa si gastas más de lo que entra.'],
                ['Punto de equilibrio', 'Las ventas mínimas que necesitas para no perder. Por debajo = pérdida, por encima = ganancia.'],
                ['Rotación de inventario', 'Qué tan rápido vendes tu stock. Inventario que no rota es dinero que no trabaja.'],
                ['Capital contable', 'Lo que realmente vale tu negocio = Activos − Deudas. Busca que crezca cada mes.'],
                ['Activo circulante', 'Lo que puedes convertir en dinero rápido: efectivo, inventario, cuentas por cobrar.'],
                ['Pasivo', 'Deudas: préstamos, créditos con proveedores, impuestos pendientes.'],
              ].map(([term, def], i) => (
                <div key={i} className="conta-glosario-item">
                  <strong>{term}</strong>
                  <span>{def}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
