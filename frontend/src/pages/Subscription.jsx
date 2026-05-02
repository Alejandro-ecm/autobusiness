import { useState, useEffect } from 'react'
import { subscription as subApi } from '../api'
import { useToast } from '../store/ToastContext'
import { useAuth } from '../store/AuthContext'
import './Subscription.css'

const PLAN_INFO = {
  FREE:    { color: '#64748b', features: ['50 productos', '2 usuarios', 'POS básico', 'Inventario'] },
  BASIC:   { color: '#3b82f6', features: ['500 productos', '5 usuarios', 'Tienda online + QR', 'Reportes'] },
  PRO:     { color: '#6366f1', features: ['Productos ilimitados', '15 usuarios', 'Todo en BASIC', 'IA diagnósticos', 'Mercado Pago'] },
  PREMIUM: { color: '#8b5cf6', features: ['Todo ilimitado', 'Usuarios ilimitados', 'CFDI', 'Soporte prioritario', 'Multi-sucursal'] },
}

const STATUS_LABEL = {
  TRIAL:    { label: 'Prueba gratuita', cls: 'sub-badge-trial' },
  ACTIVE:   { label: 'Activa',          cls: 'sub-badge-active' },
  PAST_DUE: { label: 'Vencida',         cls: 'sub-badge-due' },
  CANCELED: { label: 'Cancelada',       cls: 'sub-badge-canceled' },
}

const fmt = n => `$${Number(n).toLocaleString('es-MX')}`

export default function Subscription() {
  const { show } = useToast()
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [plans, setPlans] = useState({})
  const [loading, setLoading] = useState(true)
  const [upgrading, setUpgrading] = useState(null)

  useEffect(() => {
    Promise.all([subApi.status(), subApi.plans()])
      .then(([s, p]) => { setData(s); setPlans(p) })
      .catch(() => show('Error al cargar suscripción', 'error'))
      .finally(() => setLoading(false))
  }, [])

  const handleUpgrade = async (plan) => {
    setUpgrading(plan)
    try {
      const res = await subApi.upgrade(plan)
      // Redirigir al init_point de MP (en sandbox usa sandboxPoint)
      const url = res.sandboxPoint || res.initPoint
      window.open(url, '_blank', 'noopener')
      show('Serás redirigido a Mercado Pago para completar el pago', 'success')
    } catch (err) {
      show(err?.error || 'Error al generar enlace de pago', 'error')
    } finally { setUpgrading(null) }
  }

  if (loading) return <div className="page-loading"><div className="spinner" /></div>

  const currentPlan  = data?.plan || 'FREE'
  const status       = data?.status || 'TRIAL'
  const isActive     = data?.isActive
  const daysLeft     = data?.daysLeft || 0
  const periodEnd    = data?.currentPeriodEnd
  const info         = PLAN_INFO[currentPlan] || PLAN_INFO.FREE
  const badge        = STATUS_LABEL[status] || STATUS_LABEL.TRIAL

  return (
    <div className="sub-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Suscripción</h1>
          <p className="page-subtitle">Gestiona tu plan y facturación</p>
        </div>
      </div>

      {/* Estado actual */}
      <div className="sub-current card">
        <div className="sub-current-left">
          <div className="sub-plan-name" style={{ color: info.color }}>Plan {currentPlan}</div>
          <span className={`sub-badge ${badge.cls}`}>{badge.label}</span>
          {isActive && daysLeft > 0 && (
            <p className="sub-days">
              {status === 'TRIAL'
                ? `Prueba termina en ${daysLeft} día${daysLeft !== 1 ? 's' : ''}`
                : `Siguiente cobro en ${daysLeft} día${daysLeft !== 1 ? 's' : ''}`}
            </p>
          )}
          {!isActive && (
            <p className="sub-expired">Tu suscripción está vencida. Elige un plan para seguir usando AutoBusiness.</p>
          )}
        </div>
        <div className="sub-current-features">
          {info.features.map(f => <span key={f} className="sub-feat">✓ {f}</span>)}
        </div>
      </div>

      {/* Uso actual */}
      {data?.usage && (
        <div className="card sub-usage">
          <h3>Uso actual</h3>
          <div className="sub-usage-grid">
            <div className="sub-usage-item">
              <span className="sub-usage-val">{data.usage.products}</span>
              <span className="sub-usage-lbl">Productos
                {data.limits?.maxProducts > 0 && ` / ${data.limits.maxProducts}`}
              </span>
            </div>
            <div className="sub-usage-item">
              <span className="sub-usage-val">{data.usage.users}</span>
              <span className="sub-usage-lbl">Usuarios
                {data.limits?.maxUsers > 0 && ` / ${data.limits.maxUsers}`}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Planes disponibles */}
      <h2 style={{ fontSize: 20, fontWeight: 700, margin: '8px 0 4px' }}>Cambiar plan</h2>
      <p style={{ fontSize: 14, color: '#64748b', margin: '0 0 16px' }}>
        Al pagar serás redirigido a Mercado Pago. El plan se activa automáticamente.
      </p>
      <div className="sub-plans">
        {['BASIC', 'PRO', 'PREMIUM'].map(plan => {
          const pi      = PLAN_INFO[plan]
          const planDef = plans[plan] || {}
          const price   = planDef.price || 0
          const isCurrent = plan === currentPlan && isActive

          return (
            <div key={plan} className={`sub-plan-card${plan === 'PRO' ? ' sub-plan-pro' : ''}`}>
              {plan === 'PRO' && <div className="sub-plan-badge">⭐ Más popular</div>}
              <div className="sub-plan-title" style={{ color: pi.color }}>{plan}</div>
              <div className="sub-plan-price">{fmt(price)}<span>/mes</span></div>
              <ul className="sub-plan-feats">
                {pi.features.map(f => <li key={f}>✓ {f}</li>)}
              </ul>
              {isCurrent ? (
                <div className="sub-current-tag">Plan actual</div>
              ) : (
                <button
                  className={`btn ${plan === 'PRO' ? 'btn-primary' : 'btn-outline'} sub-upgrade-btn`}
                  onClick={() => handleUpgrade(plan)}
                  disabled={upgrading === plan}>
                  {upgrading === plan ? <div className="spinner" /> : `Cambiar a ${plan}`}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
