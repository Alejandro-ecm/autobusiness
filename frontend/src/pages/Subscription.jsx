import { useState, useEffect, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { subscription as subApi } from '../api'
import { useToast } from '../store/ToastContext'
import { useAuth } from '../store/AuthContext'
import { trackRevenue, trackEvent } from '../lib/alejandria'
import './Subscription.css'

let mpSubInitialized = false
async function initMP(publicKey) {
  if (mpSubInitialized || !publicKey) return
  const { initMercadoPago } = await import('@mercadopago/sdk-react')
  initMercadoPago(publicKey, { locale: 'es-MX' })
  mpSubInitialized = true
}

function SubPaymentBrick({ plan, amount, preferenceId, onSuccess, onError, onClose }) {
  const [BrickComponent, setBrickComponent] = useState(null)

  useEffect(() => {
    import('@mercadopago/sdk-react').then(m => setBrickComponent(() => m.Payment))
  }, [])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box card" style={{ maxWidth: 540, width: '95%' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3>Suscripción {plan}</h3>
            <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>Total: ${amount}/mes</p>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div style={{ padding: '0 8px 8px' }}>
          {!BrickComponent ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <div className="spinner" style={{ margin: '0 auto 12px' }} />
              <p style={{ color: '#64748b' }}>Cargando métodos de pago...</p>
            </div>
          ) : (
            <BrickComponent
              initialization={{ amount, preferenceId }}
              customization={{
                paymentMethods: { creditCard: 'all', debitCard: 'all', mercadoPago: 'all' },
                visual: { style: { theme: 'default' } }
              }}
              onSubmit={async ({ formData }) => {
                try {
                  const result = await subApi.processPayment(plan, formData)
                  if (result.status === 'approved') { trackRevenue(amount, 'MXN', `Suscripcion ${plan}`); trackEvent('suscripcion_activada', { plan, monto: amount }); onSuccess(plan); return { status: 'approved' } }
                  if (result.status === 'pending' || result.status === 'in_process') {
                    onSuccess(plan, 'pending'); return { status: 'pending' }
                  }
                  return { status: 'rejected' }
                } catch (err) {
                  onError(err?.error || 'Error al procesar el pago')
                  return { status: 'rejected' }
                }
              }}
              onReady={() => {}}
              onError={() => onError('Error en el formulario de pago')}
            />
          )}
        </div>
      </div>
    </div>
  )
}

const PLAN_INFO = {
  FREE:    { color: '#64748b', features: ['20 productos', '2 usuarios', 'POS básico', 'Inventario'] },
  BASIC:   { color: '#3b82f6', features: ['100 productos', '5 usuarios', 'Tienda online + QR', 'Reportes'] },
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
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const autoUpgrade = searchParams.get('upgrade')?.toUpperCase()
  const autoUpgradeTriggered = useRef(false)

  const [data, setData] = useState(null)
  const [plans, setPlans] = useState({})
  const [loading, setLoading] = useState(true)
  const [upgrading, setUpgrading] = useState(null)
  const [brickData, setBrickData] = useState(null)   // { plan, amount, preferenceId }
  const [fromRegister, setFromRegister] = useState(!!autoUpgrade)

  useEffect(() => {
    Promise.all([subApi.status(), subApi.plans()])
      .then(([s, p]) => {
        setData(s)
        setPlans(p)
        if (s.mpPublicKey) initMP(s.mpPublicKey)
      })
      .catch(() => show('Error al cargar suscripción', 'error'))
      .finally(() => setLoading(false))
  }, [])

  // Auto-trigger payment when coming from register with a plan selected
  useEffect(() => {
    if (!data || !autoUpgrade || autoUpgradeTriggered.current) return
    if (!PLAN_INFO[autoUpgrade]) return
    autoUpgradeTriggered.current = true
    handleUpgrade(autoUpgrade)
  }, [data, autoUpgrade])

  const handleUpgrade = async (plan) => {
    setUpgrading(plan)
    try {
      const res = await subApi.upgrade(plan)
      const prices = { BASIC: 60, PRO: 120, PREMIUM: 190 }

      if (data?.mpPublicKey) {
        // Checkout Bricks — formulario embebido
        setBrickData({ plan, amount: prices[plan] || 29, preferenceId: res.preferenceId })
      } else {
        // Fallback ventana centrada si no hay public key
        const url = res.initPoint || res.sandboxPoint
        const w = 520, h = 720
        const left = Math.round(window.screenX + (window.outerWidth - w) / 2)
        const top  = Math.round(window.screenY + (window.outerHeight - h) / 2)
        window.open(url, 'mp_checkout',
          `width=${w},height=${h},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes`)
        show('Completa el pago en la ventana de Mercado Pago', 'success')
      }
    } catch (err) {
      show(err?.error || 'Error al generar enlace de pago', 'error')
    } finally { setUpgrading(null) }
  }

  const handlePaymentSuccess = (plan, status) => {
    setBrickData(null)
    setFromRegister(false)
    if (status === 'pending') {
      show('Pago en proceso. Tu plan se activará cuando se confirme.', 'success')
      navigate('/dashboard')
    } else {
      show(`¡Plan ${plan} activado! Bienvenido a AutoBusiness.`, 'success')
      subApi.status().then(s => setData(s)).catch(() => {})
      navigate('/dashboard')
    }
  }

  if (loading) return <div className="page-loading"><div className="spinner" /></div>

  // Banner cuando viene directo del registro con plan seleccionado
  const RegisterBanner = fromRegister && autoUpgrade && (
    <div style={{
      background: 'linear-gradient(90deg,#6366f1,#8b5cf6)',
      color: '#fff', borderRadius: 12, padding: '16px 20px',
      marginBottom: 20, display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
    }}>
      <div>
        <strong style={{ fontSize: 16 }}>¡Cuenta creada! Activa tu plan {autoUpgrade}</strong>
        <p style={{ margin: '4px 0 0', fontSize: 13, opacity: 0.9 }}>
          Completa el pago para acceder a todas las funciones.
        </p>
      </div>
      <button
        onClick={() => { setFromRegister(false); navigate('/dashboard') }}
        style={{
          background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.4)',
          color: '#fff', borderRadius: 8, padding: '8px 16px',
          cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap',
        }}>
        Continuar con prueba gratuita →
      </button>
    </div>
  )

  const currentPlan  = data?.plan || 'FREE'
  const status       = data?.status || 'TRIAL'
  const isActive     = data?.isActive
  const daysLeft     = data?.daysLeft || 0
  const periodEnd    = data?.currentPeriodEnd
  const info         = PLAN_INFO[currentPlan] || PLAN_INFO.FREE
  const badge        = STATUS_LABEL[status] || STATUS_LABEL.TRIAL

  return (
    <div className="sub-page">
      {RegisterBanner}
      {brickData && (
        <SubPaymentBrick
          plan={brickData.plan}
          amount={brickData.amount}
          preferenceId={brickData.preferenceId}
          onSuccess={handlePaymentSuccess}
          onError={(msg) => show(msg, 'error')}
          onClose={() => setBrickData(null)}
        />
      )}
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
        Paga con tarjeta directo aquí. El plan se activa automáticamente.
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
