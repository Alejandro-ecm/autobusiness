import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../store/AuthContext'
import { subscription as subApi } from '../api'
import { useToast } from '../store/ToastContext'

const PLAN_PRICES = { BASIC: 60, PRO: 120, PREMIUM: 190 }
const PLAN_FEATURES = {
  BASIC:   ['100 productos', '5 usuarios', 'Tienda online + QR', 'Reportes', 'Soporte por email'],
  PRO:     ['Productos ilimitados', '15 usuarios', 'Todo en BASIC', 'IA diagnósticos', 'Cobros con Mercado Pago'],
  PREMIUM: ['Todo ilimitado', 'Usuarios ilimitados', 'CFDI / facturación', 'Multi-sucursal', 'Soporte prioritario'],
}
const PLAN_COLOR = { BASIC: '#3b82f6', PRO: '#6366f1', PREMIUM: '#8b5cf6' }

let mpInitialized = false
async function initMP(publicKey) {
  if (mpInitialized || !publicKey) return
  const { initMercadoPago } = await import('@mercadopago/sdk-react')
  initMercadoPago(publicKey, { locale: 'es-MX' })
  mpInitialized = true
}

function PaymentStep({ plan, price, preferenceId, initPoint, onSuccess, onError }) {
  const [BrickComponent, setBrickComponent] = useState(null)
  const [brickError, setBrickError] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    import('@mercadopago/sdk-react').then(m => setBrickComponent(() => m.Payment))
  }, [])

  // Fallback: no preferenceId → redirect button
  if (!preferenceId && initPoint) {
    return (
      <div style={{ textAlign: 'center', padding: '32px 0' }}>
        <p style={{ color: '#475569', marginBottom: 20, fontSize: 15 }}>
          Serás redirigido a Mercado Pago para completar el pago de manera segura.
        </p>
        <a href={initPoint} style={{
          display: 'inline-block', padding: '13px 28px', background: '#6366f1',
          color: '#fff', borderRadius: 10, fontWeight: 700, textDecoration: 'none', fontSize: 15,
        }}>
          Pagar con Mercado Pago →
        </a>
        <br />
        <button onClick={() => navigate('/dashboard')}
          style={{ marginTop: 16, background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 13 }}>
          Continuar con prueba gratuita de 14 días
        </button>
      </div>
    )
  }

  // Brick error recovery UI
  if (brickError) {
    return (
      <div style={{ textAlign: 'center', padding: '24px 0' }}>
        <p style={{ color: '#b91c1c', marginBottom: 16, fontSize: 14 }}>
          Hubo un problema al cargar el formulario de pago.
        </p>
        {initPoint && (
          <a href={initPoint} style={{
            display: 'inline-block', padding: '12px 24px', background: '#6366f1',
            color: '#fff', borderRadius: 10, fontWeight: 700, textDecoration: 'none', fontSize: 14,
          }}>
            Pagar en Mercado Pago →
          </a>
        )}
        <br />
        <button onClick={() => setBrickError(null)}
          style={{ marginTop: 12, background: 'none', border: 'none', color: '#6366f1', cursor: 'pointer', fontSize: 13 }}>
          Reintentar formulario
        </button>
        <br />
        <button onClick={() => navigate('/dashboard')}
          style={{ marginTop: 8, background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 13 }}>
          Continuar con prueba gratuita de 14 días
        </button>
      </div>
    )
  }

  return (
    <div>
      {!BrickComponent ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <p style={{ color: '#64748b', marginTop: 12 }}>Cargando métodos de pago...</p>
        </div>
      ) : (
        <>
          <BrickComponent
            initialization={{ amount: price, ...(preferenceId ? { preferenceId } : {}) }}
            customization={{
              paymentMethods: { creditCard: 'all', debitCard: 'all', mercadoPago: 'all' },
              visual: { style: { theme: 'default' } },
            }}
            onSubmit={async ({ formData }) => {
              try {
                const result = await subApi.processPayment(plan, formData)
                if (result.status === 'approved') { onSuccess('approved'); return { status: 'approved' } }
                if (result.status === 'pending' || result.status === 'in_process') {
                  onSuccess('pending'); return { status: 'pending' }
                }
                return { status: 'rejected' }
              } catch (err) {
                onError(err?.error || 'Error al procesar el pago')
                return { status: 'rejected' }
              }
            }}
            onReady={() => {}}
            onError={(err) => {
              // Solo mostrar error crítico — ignorar errores no_críticos del autocompletado
              if (err?.type === 'non_critical') return
              setBrickError(true)
            }}
          />
          <button onClick={() => navigate('/dashboard')}
            style={{ width: '100%', marginTop: 12, background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 13 }}>
            Continuar con prueba gratuita de 14 días →
          </button>
        </>
      )}
    </div>
  )
}

export default function Checkout() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { register } = useAuth()
  const { show } = useToast()

  const plan = (searchParams.get('plan') || 'PRO').toUpperCase()
  if (!PLAN_PRICES[plan]) { navigate('/register'); return null }

  const price    = PLAN_PRICES[plan]
  const features = PLAN_FEATURES[plan] || []
  const color    = PLAN_COLOR[plan] || '#6366f1'

  const [phase,   setPhase]   = useState('form')   // 'form' | 'payment' | 'done'
  const [form,    setForm]    = useState({ businessName: '', ownerName: '', email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const [payData, setPayData] = useState(null)

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.businessName.trim()) { setError('Ingresa el nombre de tu negocio'); return }
    if (!form.ownerName.trim())    { setError('Ingresa tu nombre'); return }
    if (!form.email.trim())        { setError('Ingresa tu email'); return }
    if (form.password.length < 6)  { setError('La contraseña debe tener al menos 6 caracteres'); return }
    setLoading(true)
    setError('')
    try {
      await register({
        businessName: form.businessName.trim(),
        ownerName:    form.ownerName.trim(),
        email:        form.email.trim().toLowerCase(),
        password:     form.password,
      })
      const res = await subApi.upgrade(plan)
      if (res.mpPublicKey) await initMP(res.mpPublicKey)
      setPayData({ preferenceId: res.preferenceId, initPoint: res.initPoint || res.sandboxPoint, mpPublicKey: res.mpPublicKey })
      setPhase('payment')
    } catch (err) {
      setError(err?.error || err?.message || 'Error al crear la cuenta')
    } finally {
      setLoading(false)
    }
  }

  const handlePaySuccess = (status) => {
    if (status === 'pending') {
      show('Pago en proceso. Tu plan se activará cuando se confirme.', 'success')
    } else {
      show(`¡Plan ${plan} activado! Bienvenido a AutoBusiness.`, 'success')
    }
    navigate('/dashboard')
  }

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <Link to="/" style={s.logo}>
          <div style={s.logoIcon}>AB</div>
          <span style={s.logoText}>AutoBusiness</span>
        </Link>
      </div>

      <div style={s.body}>
        {/* Left — plan summary */}
        <div style={s.planCard}>
          <div style={{ ...s.planBadge, background: color }}>{plan}</div>
          <div style={s.planPrice}>
            <span style={s.planAmount}>${price}</span>
            <span style={s.planPer}>/mes</span>
          </div>
          <p style={s.planDesc}>Facturado mensualmente · Cancela cuando quieras</p>
          <ul style={s.featureList}>
            {features.map(f => (
              <li key={f} style={s.featureItem}>
                <span style={{ color, fontWeight: 700, marginRight: 8 }}>✓</span>{f}
              </li>
            ))}
          </ul>
          <div style={s.securityNote}>
            <span>🔒</span>
            <span>Pago seguro procesado por Mercado Pago</span>
          </div>
          <Link to="/" style={s.backLink}>← Ver todos los planes</Link>
        </div>

        {/* Right — form or payment */}
        <div style={s.formCard}>
          {phase === 'form' && (
            <>
              <div style={s.steps}>
                <div style={{ ...s.step, ...s.stepActive }}>
                  <span style={s.stepNum}>1</span> Tus datos
                </div>
                <div style={s.stepDivider} />
                <div style={s.step}>
                  <span style={{ ...s.stepNum, background: '#e2e8f0', color: '#94a3b8' }}>2</span> Pago
                </div>
              </div>

              <h2 style={s.formTitle}>Crea tu cuenta</h2>
              <p style={s.formSub}>
                Plan <strong style={{ color }}>{plan} — ${price}/mes</strong> seleccionado.
                El pago se solicita en el siguiente paso.
              </p>

              {error && <div style={s.errorBox}>{error}</div>}

              <form onSubmit={handleSubmit}>
                <div style={s.field}>
                  <label style={s.label}>Nombre de tu negocio *</label>
                  <input style={s.input} value={form.businessName} onChange={set('businessName')}
                    placeholder="Ej: Tienda Don Pepe" required autoFocus />
                </div>
                <div style={s.field}>
                  <label style={s.label}>Tu nombre *</label>
                  <input style={s.input} value={form.ownerName} onChange={set('ownerName')}
                    placeholder="Nombre del dueño" required />
                </div>
                <div style={s.field}>
                  <label style={s.label}>Email *</label>
                  <input style={s.input} type="email" value={form.email} onChange={set('email')}
                    placeholder="tu@email.com" required />
                </div>
                <div style={s.field}>
                  <label style={s.label}>Contraseña *</label>
                  <input style={s.input} type="password" value={form.password} onChange={set('password')}
                    placeholder="Mínimo 6 caracteres" minLength={6} required />
                </div>

                <button type="submit" disabled={loading} style={{ ...s.btnPrimary, background: color }}>
                  {loading
                    ? <><span style={s.spinner} /> Creando cuenta...</>
                    : 'Continuar al pago →'}
                </button>
              </form>

              <p style={s.loginHint}>
                ¿Ya tienes cuenta? <Link to="/login" style={{ color }}>Inicia sesión</Link>
              </p>
            </>
          )}

          {phase === 'payment' && (
            <>
              <div style={s.steps}>
                <div style={s.step}>
                  <span style={{ ...s.stepNum, background: '#10b981' }}>✓</span>
                  <span style={{ color: '#10b981' }}>Cuenta creada</span>
                </div>
                <div style={s.stepDivider} />
                <div style={{ ...s.step, ...s.stepActive }}>
                  <span style={s.stepNum}>2</span> Pago
                </div>
              </div>

              <h2 style={s.formTitle}>Completa el pago</h2>
              <p style={s.formSub}>
                Activa tu plan <strong style={{ color }}>{plan}</strong> por <strong>${price}/mes</strong>
              </p>

              <PaymentStep
                plan={plan}
                price={price}
                preferenceId={payData?.preferenceId}
                initPoint={payData?.initPoint}
                onSuccess={handlePaySuccess}
                onError={(msg) => show(msg, 'error')}
              />
            </>
          )}
        </div>
      </div>
    </div>
  )
}

const s = {
  page:        { minHeight: '100vh', background: '#f8fafc', fontFamily: 'Inter, system-ui, sans-serif' },
  header:      { padding: '16px 32px', background: '#fff', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center' },
  logo:        { display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: '#1e293b' },
  logoIcon:    { width: 36, height: 36, background: '#6366f1', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 14 },
  logoText:    { fontWeight: 700, fontSize: 18 },
  body:        { maxWidth: 900, margin: '40px auto', padding: '0 16px', display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' },
  planCard:    { flex: '1 1 280px', background: '#fff', borderRadius: 16, padding: 28, border: '1px solid #e2e8f0' },
  planBadge:   { display: 'inline-block', color: '#fff', fontWeight: 700, fontSize: 12, padding: '4px 12px', borderRadius: 20, marginBottom: 16 },
  planPrice:   { display: 'flex', alignItems: 'flex-end', gap: 4, marginBottom: 6 },
  planAmount:  { fontSize: 48, fontWeight: 800, color: '#1e293b', lineHeight: 1 },
  planPer:     { fontSize: 16, color: '#64748b', marginBottom: 8 },
  planDesc:    { color: '#64748b', fontSize: 13, marginBottom: 20 },
  featureList: { listStyle: 'none', padding: 0, margin: '0 0 24px' },
  featureItem: { padding: '6px 0', fontSize: 14, color: '#374151', display: 'flex', alignItems: 'center' },
  securityNote:{ display: 'flex', alignItems: 'center', gap: 8, color: '#64748b', fontSize: 12, background: '#f1f5f9', borderRadius: 8, padding: '10px 14px', marginBottom: 16 },
  backLink:    { color: '#6366f1', fontSize: 13, textDecoration: 'none' },
  formCard:    { flex: '1 1 340px', background: '#fff', borderRadius: 16, padding: 32, border: '1px solid #e2e8f0' },
  steps:       { display: 'flex', alignItems: 'center', marginBottom: 28 },
  step:        { display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#64748b', fontWeight: 500 },
  stepActive:  { color: '#1e293b', fontWeight: 600 },
  stepNum:     { width: 26, height: 26, background: '#6366f1', color: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 },
  stepDivider: { flex: 1, height: 1, background: '#e2e8f0', margin: '0 12px' },
  formTitle:   { fontSize: 22, fontWeight: 700, color: '#1e293b', margin: '0 0 6px' },
  formSub:     { fontSize: 14, color: '#64748b', margin: '0 0 24px' },
  errorBox:    { background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: 8, padding: '10px 14px', fontSize: 14, marginBottom: 16 },
  field:       { marginBottom: 16 },
  label:       { display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 },
  input:       { width: '100%', padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box' },
  btnPrimary:  { width: '100%', padding: '13px', border: 'none', borderRadius: 10, color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer', marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 },
  loginHint:   { textAlign: 'center', fontSize: 13, color: '#64748b', marginTop: 20 },
  spinner:     { width: 16, height: 16, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' },
}
