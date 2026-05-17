import { useState, useEffect } from 'react'
import { useAuth } from '../store/AuthContext'
import client from '../api/client'
import { inventory as inventoryApi } from '../api'
import './Contabilidad.css'

const fmt = (n) => `$${Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const pct = (n) => `${Number(n || 0).toFixed(1)}%`

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
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 14, padding: '0 4px' }}
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

export default function Contabilidad() {
  const { user } = useAuth()
  const [finance, setFinance] = useState(null)
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [opex, setOpex] = useState('')
  const [activeTab, setActiveTab] = useState('resultados')

  const loadData = () => {
    setLoading(true)
    setError(null)
    Promise.all([
      client.get('/dashboard/finance'),
      inventoryApi.list(),
    ]).then(([fin, prods]) => {
      setFinance(fin)
      setProducts(prods)
    }).catch(err => setError(err?.error || err?.message || 'Error al cargar datos contables'))
    .finally(() => setLoading(false))
  }

  useEffect(() => { loadData() }, [user?.businessId])

  const handlePrint = () => window.print()

  if (loading) return (
    <div className="page-loading">
      <div className="spinner" style={{ width: 36, height: 36 }} />
      <p style={{ marginTop: 12, color: '#64748b' }}>Cargando datos contables...</p>
    </div>
  )
  if (error) return (
    <div className="page-loading">
      <div style={{ fontSize: 40 }}>⚠️</div>
      <p style={{ color: '#ef4444', fontWeight: 600, marginTop: 12 }}>{error}</p>
      <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={loadData}>
        Reintentar
      </button>
    </div>
  )
  if (!finance) return null

  const revenue     = Number(finance.revenue    || 0)
  const cogs        = Number(finance.cost       || 0)
  const purchasesTotal = Number(finance.purchases || 0)
  const grossProfit = Number(finance.grossProfit || 0)
  const grossMargin = Number(finance.margin     || 0)
  const opexVal     = parseFloat(opex) || 0
  const netIncome   = grossProfit - opexVal
  const netMargin   = revenue > 0 ? (netIncome / revenue * 100) : 0
  const netCash     = revenue - purchasesTotal

  const inventoryValue = products.reduce((s, p) => s + (Number(p.cost || 0) * Number(p.stock || 0)), 0)
  const cashEstimate   = Math.max(netCash * 0.7, 0)
  const totalAssets    = inventoryValue + cashEstimate
  const equity         = totalAssets  // liabilities = 0

  const inventoryTurnover = inventoryValue > 0 && cogs > 0 ? (cogs / inventoryValue).toFixed(2) : null
  const breakEven = grossMargin > 0 && opexVal > 0 ? (opexVal / (grossMargin / 100)) : null
  const avgDailySales = finance.daily?.length > 0
    ? revenue / Math.max(finance.daily.filter(d => Number(d.revenue) > 0).length, 1) : 0

  const TABS = [
    ['resultados', '📊 Estado de Resultados'],
    ['balance',    '⚖️ Balance General'],
    ['indicadores','📈 Indicadores clave'],
  ]

  return (
    <div className="conta-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Contabilidad</h1>
          <p className="page-subtitle">Reportes financieros — últimos 30 días</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button className="btn btn-outline" onClick={handlePrint}>🖨️ Imprimir reporte</button>
          <div className="finance-tabs">
            {TABS.map(([v, l]) => (
              <button key={v} className={`tab-btn ${activeTab === v ? 'active' : ''}`}
                onClick={() => setActiveTab(v)}>{l}</button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Estado de Resultados ── */}
      {activeTab === 'resultados' && (
        <div className="conta-grid">
          <div className="card">
            <div className="conta-card-header">
              <h3 className="section-title">Estado de Resultados</h3>
              <span className="text-soft text-sm">Período: {finance.period || 'últimos 30 días'}</span>
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
                <span className="conta-amount positive">{fmt(revenue)}</span>
              </div>
              <div className="conta-row conta-row--cost">
                <span>
                  📦 (−) Costo de ventas
                  <Tooltip text="Lo que pagaste por los productos que vendiste (precio de compra × unidades vendidas)." />
                </span>
                <span className="conta-amount negative">({fmt(cogs)})</span>
              </div>
              <div className="conta-row conta-row--subtotal">
                <span><strong>= Utilidad Bruta</strong> <span className="text-soft text-sm">[margen {pct(grossMargin)}]</span></span>
                <strong className="conta-amount">{fmt(grossProfit)}</strong>
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

            {/* ── Flujo de Caja (Dinero que entra y sale) ── */}
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
                  <span className="conta-amount positive">{fmt(revenue)}</span>
                </div>
                <div className="conta-row conta-row--cost">
                  <span>
                    📤 Dinero que salió (compras a proveedores)
                    <Tooltip text="Total pagado a proveedores por mercancía en los últimos 30 días. Este dinero ya salió de tu caja." />
                  </span>
                  <span className="conta-amount negative">({fmt(purchasesTotal)})</span>
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
                  <span>Margen bruto</span><strong>{pct(grossMargin)}</strong>
                </div>
                <Bar value={grossMargin} max={100} color={grossMargin > 30 ? '#10b981' : grossMargin > 15 ? '#f59e0b' : '#ef4444'} />
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

      {/* ── Balance General ── */}
      {activeTab === 'balance' && (
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
              {/* ACTIVOS */}
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

              {/* PASIVO + CAPITAL */}
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
      )}

      {/* ── Indicadores ── */}
      {activeTab === 'indicadores' && (
        <>
          <div className="conta-kpis">
            {[
              {
                icon: '📊', label: 'Margen bruto',
                value: pct(grossMargin),
                good: grossMargin >= 20,
                desc: `Por cada $100 vendidos, ganas $${grossMargin.toFixed(0)} antes de gastos operativos.`,
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
                good: breakEven ? revenue >= breakEven : true,
                desc: 'Ventas mínimas para no perder dinero. Si estás por encima, tienes utilidad.',
                bench: breakEven && revenue >= breakEven ? `✅ Estás ${fmt(revenue - breakEven)} arriba` : breakEven ? `⚠️ Faltan ${fmt(breakEven - revenue)}` : '',
              },
              {
                icon: '🧾', label: 'Promedio diario de ventas',
                value: fmt(avgDailySales),
                good: avgDailySales > 0,
                desc: 'Ingresos promedio en días con ventas registradas en los últimos 30 días.',
                bench: `${finance.daily?.filter(d => Number(d.revenue) > 0).length || 0} días activos`,
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

          <div className="card">
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
