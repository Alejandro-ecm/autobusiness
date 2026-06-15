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

function SubPaymentBrick({ plan, amount, period = 'MONTHLY', preferenceId, initPoint, onSuccess, onError, onClose }) {
  const [BrickComponent, setBrickComponent] = useState(null)
  const per = period === 'ANNUAL' ? 'año' : 'mes'

  useEffect(() => {
    if (preferenceId) {
      import('@mercadopago/sdk-react').then(m => setBrickComponent(() => m.Payment))
    }
  }, [preferenceId])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box card" style={{ maxWidth: 540, width: '95%' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3>Suscripción {plan}{period === 'ANNUAL' ? ' anual' : ''}</h3>
            <p style={{ margin: 0, fontSize: 13, color: '#1e293b' }}>
              Total: ${amount}/{per}{period === 'ANNUAL' ? ' · +2 meses gratis' : ''}
            </p>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div style={{ padding: '0 8px 8px' }}>
          {/* Sin preferenceId → botón de redirección a MP */}
          {!preferenceId && initPoint ? (
            <div style={{ textAlign: 'center', padding: '24px 8px' }}>
              <p style={{ color: '#475569', marginBottom: 20, fontSize: 14 }}>
                Completa el pago en Mercado Pago de forma segura.
              </p>
              <a href={initPoint} target="_blank" rel="noopener noreferrer"
                style={{
                  display: 'inline-block', padding: '13px 28px',
                  background: '#009ee3', color: '#fff', borderRadius: 10,
                  fontWeight: 700, textDecoration: 'none', fontSize: 15,
                }}>
                Pagar ${amount}/{per} con Mercado Pago →
              </a>
              <p style={{ color: '#1e293b', fontSize: 12, marginTop: 16 }}>
                Después de pagar, tu plan se activará automáticamente.
              </p>
            </div>
          ) : !BrickComponent ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <div className="spinner" style={{ margin: '0 auto 12px' }} />
              <p style={{ color: '#1e293b' }}>Cargando métodos de pago...</p>
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
                  const result = await subApi.processPayment(plan, formData, period)
                  if (result.status === 'approved') {
                    trackRevenue(amount, 'MXN', `Suscripcion ${plan}`)
                    trackEvent('suscripcion_activada', { plan, monto: amount })
                    onSuccess(plan)
                    return { status: 'approved' }
                  }
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
              onError={(err) => { if (err?.type !== 'non_critical') onError('Error en el formulario de pago') }}
            />
          )}
        </div>
      </div>
    </div>
  )
}

const PLAN_INFO = {
  FREE:    { color: '#1e293b', features: ['20 productos', '2 usuarios', 'POS básico', 'Inventario'] },
  BASIC:   { color: '#3b82f6', features: ['100 productos', '5 usuarios', 'Tienda online + QR', 'Reportes'] },
  PRO:     { color: '#6366f1', features: ['Productos ilimitados', '15 usuarios', 'Todo en BASIC', 'IA diagnósticos', 'Mercado Pago'] },
  PREMIUM: { color: '#8b5cf6', features: ['Todo ilimitado', 'Usuarios ilimitados', 'CFDI', 'Soporte prioritario', 'Multi-sucursal'] },
}

// Precios de suscripción (MXN). Anual = 10 meses: +2 meses gratis.
const PRICES = {
  MONTHLY: { BASIC: 80,  PRO: 150,  PREMIUM: 200 },
  ANNUAL:  { BASIC: 800, PRO: 1500, PREMIUM: 2000 },
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
  const [brickData, setBrickData] = useState(null)   // { plan, amount, period, preferenceId }
  const [period, setPeriod] = useState('MONTHLY')    // MONTHLY | ANNUAL
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

  // Auto-trigger payment when coming from register with a plan selected.
  // Solo pre-carga la preferencia — NO abre popup (el browser lo bloquea desde useEffect).
  useEffect(() => {
    if (!data || !autoUpgrade || autoUpgradeTriggered.current) return
    if (!PLAN_INFO[autoUpgrade]) return
    autoUpgradeTriggered.current = true
    // Si hay public key disponible, abrir Bricks automáticamente
    if (data.mpPublicKey) {
      handleUpgrade(autoUpgrade)
    }
    // Si no hay public key, mostrar banner con botón de pago — el usuario hace clic
  }, [data, autoUpgrade])

  const handleUpgrade = async (plan, payPeriod = period) => {
    setUpgrading(plan)
    try {
      const res = await subApi.upgrade(plan, payPeriod)
      const amount = PRICES[payPeriod]?.[plan] || PRICES.MONTHLY[plan] || 150

      if (data?.mpPublicKey) {
        // Checkout Bricks — formulario embebido en modal
        setBrickData({ plan, amount, period: payPeriod, preferenceId: res.preferenceId })
      } else {
        // Sin public key → guardar initPoint y mostrar botón de redirección (no popup)
        setBrickData({
          plan,
          amount,
          period: payPeriod,
          preferenceId: null,
          initPoint: res.initPoint || res.sandboxPoint,
        })
      }
    } catch (err) {
      show(err?.error || 'Error al generar enlace de pago', 'error')
    } finally { setUpgrading(null) }
  }

  const handlePaymentSuccess = (plan, status) => {
    localStorage.removeItem('checkout_plan_pending')
    setBrickData(null)
    setFromRegister(false)
    if (status === 'pending') {
      show('Pago en proceso. Tu plan se activará cuando se confirme.', 'success')
    } else {
      show(`¡Plan ${plan} activado! Bienvenido a AutoBusiness.`, 'success')
      subApi.status().then(s => setData(s)).catch(() => {})
    }
    navigate('/dashboard')
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
        onClick={() => {
          localStorage.removeItem('checkout_plan_pending')
          setFromRegister(false)
          navigate('/dashboard')
        }}
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
          period={brickData.period}
          preferenceId={brickData.preferenceId}
          initPoint={brickData.initPoint}
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
      <p style={{ fontSize: 14, color: '#1e293b', margin: '0 0 16px' }}>
        Paga con tarjeta directo aquí. El plan se activa automáticamente.
      </p>

      {/* Selector de periodo: mensual o anual */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        <button
          className={`btn ${period === 'MONTHLY' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setPeriod('MONTHLY')}>
          Mensual
        </button>
        <button
          className={`btn ${period === 'ANNUAL' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setPeriod('ANNUAL')}>
          Anual · +2 meses gratis 🎁
        </button>
      </div>

      <div className="sub-plans">
        {['BASIC', 'PRO', 'PREMIUM'].map(plan => {
          const pi      = PLAN_INFO[plan]
          const planDef = plans[plan] || {}
          const price   = period === 'ANNUAL'
            ? (planDef.annualPrice || PRICES.ANNUAL[plan])
            : (planDef.price || PRICES.MONTHLY[plan])
          const isCurrent = plan === currentPlan && isActive

          return (
            <div key={plan} className={`sub-plan-card${plan === 'PRO' ? ' sub-plan-pro' : ''}`}>
              {plan === 'PRO' && <div className="sub-plan-badge">⭐ Más popular</div>}
              <div className="sub-plan-title" style={{ color: pi.color }}>{plan}</div>
              <div className="sub-plan-price">{fmt(price)}<span>/{period === 'ANNUAL' ? 'año' : 'mes'}</span></div>
              {period === 'ANNUAL' && (
                <div style={{
                  display: 'inline-block', background: '#ecfdf5', color: '#047857',
                  fontSize: 12, fontWeight: 700, padding: '3px 10px',
                  borderRadius: 20, margin: '4px 0 2px',
                }}>
                  🎁 +2 meses gratis
                </div>
              )}
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
