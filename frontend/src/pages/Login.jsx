import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useAuth } from '../store/AuthContext'
import { useToast } from '../store/ToastContext'
import { legal as legalApi, auth as authApi } from '../api'
import ConsentCheckbox from '../components/ConsentCheckbox'
import { DraftBanner } from '../components/legal/LegalPageLayout'
import './Login.css'

function LegalAcceptanceScreen({ onDone }) {
  const [legalAccepted, setLegalAccepted] = useState({ terms: false, privacy: false, acceptableUse: false })
  const [submitting, setSubmitting] = useState(false)
  const [docModal, setDocModal] = useState(null)
  const { updateUser } = useAuth()
  const navigate = useNavigate()
  const { show } = useToast()

  const allAccepted = legalAccepted.terms && legalAccepted.privacy && legalAccepted.acceptableUse

  const handleAccept = async () => {
    if (!allAccepted) return
    setSubmitting(true)
    try {
      await legalApi.accept()
      updateUser({ requiresLegalAcceptance: false })
      onDone()
    } catch {
      show('Error al registrar la aceptación. Intenta de nuevo.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ padding: '24px 0' }}>
      {docModal && (
        <LegalDocModal
          type={docModal.type}
          title={docModal.title}
          onClose={() => setDocModal(null)}
        />
      )}
      <h3 style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 6 }}>
        Acuerdos Legales Requeridos
      </h3>
      <p style={{ fontSize: 13, color: 'rgba(226,232,240,.8)', marginBottom: 16, lineHeight: 1.5 }}>
        Para continuar usando AutoBusiness AI debes aceptar los siguientes documentos legales actualizados.
      </p>

      <div style={{ background: '#f8fafc', borderRadius: 12, padding: '16px 18px', border: '1px solid #e2e8f0' }}>
        {[
          { key: 'terms',         type: 'terms',         label: 'Términos y Condiciones' },
          { key: 'privacy',       type: 'privacy',       label: 'Política de Privacidad' },
          { key: 'acceptableUse', type: 'acceptable-use',label: 'Política de Uso Aceptable' },
        ].map(({ key, type, label }) => (
          <ConsentCheckbox
            key={key}
            checked={legalAccepted[key]}
            onChange={() => setLegalAccepted(a => ({ ...a, [key]: !a[key] }))}
            style={{ marginBottom: 10 }}
          >
            He leído y acepto{' '}
            <button
              type="button"
              onClick={() => setDocModal({ type, title: label })}
              style={{
                background: 'none', border: 'none', padding: 0,
                color: '#6366f1', fontWeight: 600, cursor: 'pointer',
                textDecoration: 'underline', fontSize: 13,
              }}>
              los {label}
            </button>.
          </ConsentCheckbox>
        ))}

        <div style={{
          marginTop: 12, padding: '12px 14px', background: '#eff6ff',
          borderRadius: 8, border: '1px solid #bfdbfe',
          fontSize: 12, color: '#1e40af', lineHeight: 1.6,
        }}>
          <strong>Declaración:</strong> Declaro que utilizaré AutoBusiness AI únicamente para actividades legales. Soy responsable de los productos, servicios, contenido y operaciones realizadas mediante mi cuenta.
        </div>
      </div>

      <button
        onClick={handleAccept}
        disabled={!allAccepted || submitting}
        style={{
          marginTop: 16, width: '100%',
          background: allAccepted ? '#6366f1' : '#e2e8f0',
          color: allAccepted ? '#fff' : '#94a3b8',
          border: 'none', borderRadius: 10, padding: '12px 0',
          fontWeight: 700, fontSize: 15, cursor: allAccepted ? 'pointer' : 'not-allowed',
          transition: 'all .15s',
        }}>
        {submitting ? 'Procesando...' : 'Continuar'}
      </button>
    </div>
  )
}

function LegalDocModal({ type, title, onClose }) {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetcher = type === 'terms' ? legalApi.terms
      : type === 'privacy' ? legalApi.privacy
      : legalApi.acceptableUse
    fetcher().then(d => setContent(d.content)).catch(() => setContent('No se pudo cargar el documento.')).finally(() => setLoading(false))
  }, [type])

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }} onClick={onClose}>
      <div style={{
        background: '#fff', borderRadius: 16, maxWidth: 640, width: '100%',
        maxHeight: '85vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,.3)',
      }} onClick={e => e.stopPropagation()}>
        <div style={{
          padding: '18px 24px', borderBottom: '1px solid #e2e8f0',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0,
        }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#0f172a' }}>{title}</h3>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#64748b',
            width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6,
          }}>x</button>
        </div>
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>Cargando...</div>
          ) : (
            <>
              <DraftBanner>debe revisarlo un abogado antes de publicarse como definitivo.</DraftBanner>
              <div style={{ fontSize: 13, lineHeight: 1.7, color: '#374151', whiteSpace: 'pre-line' }}>
                {content}
              </div>
            </>
          )}
        </div>
        <div style={{ padding: '14px 24px', borderTop: '1px solid #e2e8f0', textAlign: 'center', flexShrink: 0 }}>
          <button onClick={onClose} style={{
            background: '#6366f1', color: '#fff', border: 'none', borderRadius: 8,
            padding: '10px 28px', fontWeight: 700, fontSize: 14, cursor: 'pointer',
          }}>Cerrar</button>
        </div>
      </div>
    </div>
  )
}

function ForgotPasswordScreen({ onBack }) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const { show } = useToast()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await authApi.forgotPassword(email)
      setSent(true)
    } catch {
      show('No se pudo enviar el correo. Intenta de nuevo.', 'error')
    } finally { setLoading(false) }
  }

  if (sent) {
    return (
      <div style={{ padding: '8px 0' }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 10 }}>Revisa tu correo</h3>
        <p style={{ fontSize: 13, color: 'rgba(226,232,240,.85)', lineHeight: 1.6, marginBottom: 16 }}>
          Si <strong>{email}</strong> está registrado, te enviamos un enlace para crear una nueva contraseña.
          El enlace expira en 30 minutos.
        </p>
        <button type="button" onClick={onBack} className="btn btn-outline" style={{ width: '100%' }}>
          ← Volver a iniciar sesión
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="login-form">
      <p style={{ fontSize: 13, color: 'rgba(226,232,240,.8)', marginBottom: 12 }}>
        Ingresa el correo de tu cuenta y te enviaremos un enlace para recuperar tu contraseña.
      </p>
      <div className="input-group">
        <label>Email</label>
        <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@email.com" required />
      </div>
      <button className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: 8 }} disabled={loading}>
        {loading ? <div className="spinner" /> : 'Enviar enlace de recuperación'}
      </button>
      <button type="button" onClick={onBack} className="btn btn-outline" style={{ width: '100%', marginTop: 8 }}>
        ← Volver a iniciar sesión
      </button>
    </form>
  )
}

function ResetPasswordScreen({ token }) {
  const [password, setPassword]   = useState('')
  const [confirm, setConfirm]     = useState('')
  const [loading, setLoading]     = useState(false)
  const [done, setDone]           = useState(false)
  const { show } = useToast()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (password !== confirm) { show('Las contraseñas no coinciden', 'error'); return }
    if (password.length < 6) { show('La contraseña debe tener al menos 6 caracteres', 'error'); return }
    setLoading(true)
    try {
      await authApi.resetPassword(token, password)
      setDone(true)
      show('Contraseña actualizada. Ya puedes iniciar sesión.', 'success')
    } catch (err) {
      show(err?.error || 'El enlace no es válido o expiró', 'error')
    } finally { setLoading(false) }
  }

  if (done) {
    return (
      <div style={{ padding: '8px 0' }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 10 }}>¡Listo!</h3>
        <p style={{ fontSize: 13, color: 'rgba(226,232,240,.85)', lineHeight: 1.6, marginBottom: 16 }}>
          Tu contraseña se actualizó correctamente.
        </p>
        <button type="button" onClick={() => navigate('/login', { replace: true })} className="btn btn-primary" style={{ width: '100%' }}>
          Iniciar sesión
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="login-form">
      <p style={{ fontSize: 13, color: 'rgba(226,232,240,.8)', marginBottom: 12 }}>
        Crea tu nueva contraseña.
      </p>
      <div className="input-group">
        <label>Nueva contraseña</label>
        <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)}
          placeholder="Mínimo 6 caracteres" required minLength={6} />
      </div>
      <div className="input-group">
        <label>Confirmar contraseña</label>
        <input className="input" type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
          placeholder="Repite tu contraseña" required minLength={6} />
      </div>
      <button className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: 8 }} disabled={loading}>
        {loading ? <div className="spinner" /> : 'Guardar nueva contraseña'}
      </button>
    </form>
  )
}

export default function Login() {
  const [tab, setTab] = useState('login')
  const [loading, setLoading] = useState(false)
  const [pendingUser, setPendingUser] = useState(null)
  const [form, setForm] = useState({ email: '', password: '', businessName: '', ownerName: '' })
  const { login, register, user } = useAuth()
  const { show } = useToast()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // If redirected from PrivateRoute because requiresLegalAcceptance is true,
  // show legal screen immediately for the already-authenticated user
  const showLegal = searchParams.get('legal') === '1' && user?.requiresLegalAcceptance
  // Link de recuperación de contraseña: /reset-password?token=...
  const resetToken = searchParams.get('token')

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await login(form.email, form.password)
      if (res.requiresLegalAcceptance) {
        setPendingUser(res.user)
        navigate('/login?legal=1', { replace: true })
      } else {
        navigate(res.user?.role === 'CASHIER' ? '/caja' : '/dashboard')
      }
    } catch (err) {
      if (err?.error) {
        show(err.error, 'error')
      } else if (err?.status === 401 || err?.response?.status === 401) {
        show('Email o contraseña incorrectos', 'error')
      } else {
        show('No se pudo conectar. Verifica tu conexión e intenta de nuevo.', 'error')
      }
    } finally { setLoading(false) }
  }

  const handleLegalDone = () => {
    const role = user?.role || pendingUser?.role
    navigate(role === 'CASHIER' ? '/caja' : '/dashboard', { replace: true })
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await register({ businessName: form.businessName, ownerName: form.ownerName, email: form.email, password: form.password })
      navigate('/dashboard')
    } catch (err) {
      show(err?.error || 'Error al registrarse', 'error')
    } finally { setLoading(false) }
  }

  return (
    <div className="login-page">
      {/* Banner marketplace */}
      <div
        onClick={() => navigate('/marketplace')}
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 10,
          background: '#000',
          color: '#fff', textAlign: 'center', padding: '10px',
          cursor: 'pointer', fontSize: 13, fontWeight: 600,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
        }}>
        ¿Buscas una tienda? Ver tiendas en línea →
      </div>

      <div className="login-box card" style={{ marginTop: 48 }}>
        <Link to="/" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          color: '#6366f1', fontSize: 13, fontWeight: 600,
          textDecoration: 'none', marginBottom: 12,
        }}>
          ← Volver al inicio
        </Link>
        <div className="login-logo">
          <img className="login-logo-img" src="/favicon-512.png" alt="AutoBusiness AI" />
          <h1 className="login-title">AutoBusiness AI</h1>
          <p className="login-subtitle">Plataforma inteligente para tu negocio</p>
        </div>

        {showLegal ? (
          <LegalAcceptanceScreen onDone={handleLegalDone} />
        ) : resetToken ? (
          <ResetPasswordScreen token={resetToken} />
        ) : (
          <>
            {tab !== 'forgot' && (
              <div className="login-tabs">
                <button className={`login-tab ${tab === 'login' ? 'active' : ''}`} onClick={() => setTab('login')}>
                  Iniciar sesión
                </button>
                <button className={`login-tab ${tab === 'register' ? 'active' : ''}`} onClick={() => setTab('register')}>
                  Crear cuenta
                </button>
              </div>
            )}

            {tab === 'login' ? (
              <form onSubmit={handleLogin} className="login-form">
                <div className="input-group">
                  <label>Email</label>
                  <input className="input" type="email" value={form.email} onChange={set('email')} placeholder="tu@email.com" required />
                </div>
                <div className="input-group">
                  <label>Contraseña</label>
                  <input className="input" type="password" value={form.password} onChange={set('password')} placeholder="••••••••" required />
                  <button type="button" onClick={() => setTab('forgot')}
                    style={{ background: 'none', border: 'none', padding: 0, marginTop: 6, color: '#818cf8', fontSize: 12, fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}>
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
                <button className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: 8 }} disabled={loading}>
                  {loading ? <div className="spinner" /> : 'Entrar'}
                </button>
              </form>
            ) : tab === 'forgot' ? (
              <ForgotPasswordScreen onBack={() => setTab('login')} />
            ) : (
              <form onSubmit={handleRegister} className="login-form">
                <div className="input-group">
                  <label>Nombre del negocio</label>
                  <input className="input" value={form.businessName} onChange={set('businessName')} placeholder="Ej: Tienda La Esperanza" required />
                </div>
                <div className="input-group">
                  <label>Tu nombre</label>
                  <input className="input" value={form.ownerName} onChange={set('ownerName')} placeholder="Tu nombre completo" required />
                </div>
                <div className="input-group">
                  <label>Email</label>
                  <input className="input" type="email" value={form.email} onChange={set('email')} placeholder="tu@email.com" required />
                </div>
                <div className="input-group">
                  <label>Contraseña</label>
                  <input className="input" type="password" value={form.password} onChange={set('password')} placeholder="Mínimo 8 caracteres" required minLength={8} />
                </div>
                <button className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: 8 }} disabled={loading}>
                  {loading ? <div className="spinner" /> : 'Crear negocio gratis'}
                </button>
              </form>
            )}

            {/* Link marketplace abajo */}
            <div style={{ textAlign: 'center', marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,.12)' }}>
              <span
                onClick={() => navigate('/marketplace')}
                style={{ color: '#6366f1', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
                Ver tiendas en línea
              </span>
            </div>

            {/* Legal links */}
            <div style={{ textAlign: 'center', marginTop: 14, display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
              <Link to="/terms" style={{ color: '#94a3b8', fontSize: 11, textDecoration: 'none' }}>Términos de Servicio</Link>
              <span style={{ color: '#e2e8f0', fontSize: 11 }}>·</span>
              <Link to="/privacy-policy" style={{ color: '#94a3b8', fontSize: 11, textDecoration: 'none' }}>Privacidad</Link>
              <span style={{ color: '#e2e8f0', fontSize: 11 }}>·</span>
              <Link to="/acceptable-use" style={{ color: '#94a3b8', fontSize: 11, textDecoration: 'none' }}>Uso Aceptable</Link>
              <span style={{ color: '#e2e8f0', fontSize: 11 }}>·</span>
              <Link to="/account-deletion" style={{ color: '#94a3b8', fontSize: 11, textDecoration: 'none' }}>Eliminar cuenta</Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
