import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../store/AuthContext'
import { legal as legalApi } from '../api'
import { trackEvent } from '../lib/alejandria'
import { validateEmailDomain } from '../lib/emailValidation'
import './Register.css'

function DocModal({ type, title, onClose }) {
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
            <div style={{ fontSize: 13, lineHeight: 1.7, color: '#374151', whiteSpace: 'pre-line' }}>
              {content}
            </div>
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

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const planHint = params.get('plan') || 'FREE'

  const [form, setForm] = useState({ businessName: '', ownerName: '', email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [accepted, setAccepted] = useState({ terms: false, privacy: false, acceptableUse: false })
  const [docModal, setDocModal] = useState(null)

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))
  const allAccepted = accepted.terms && accepted.privacy && accepted.acceptableUse

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.businessName.trim()) { setError('Ingresa el nombre de tu negocio'); return }
    if (!form.ownerName.trim())    { setError('Ingresa tu nombre'); return }
    if (!form.email.trim())        { setError('Ingresa tu email'); return }
    const emailErr = validateEmailDomain(form.email)
    if (emailErr) { setError(emailErr); return }
    if (form.password.length < 6)  { setError('La contraseña debe tener al menos 6 caracteres'); return }
    if (!allAccepted)              { setError('Debes aceptar todos los acuerdos legales'); return }
    setLoading(true)
    setError('')
    try {
      await register({
        businessName: form.businessName.trim(),
        ownerName:    form.ownerName.trim(),
        email:        form.email.trim().toLowerCase(),
        password:     form.password,
      })
      trackEvent('usuario_registro', { nombre: form.ownerName.trim(), plan: planHint })
      if (planHint && planHint !== 'FREE') {
        navigate(`/subscription?upgrade=${planHint}`)
      } else {
        navigate('/dashboard')
      }
    } catch (err) {
      setError(err?.error || err?.message || 'Error al crear la cuenta')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="register-page">
      {docModal && (
        <DocModal
          type={docModal.type}
          title={docModal.title}
          onClose={() => setDocModal(null)}
        />
      )}

      <div className="register-left">
        <Link to="/" className="register-logo">
          <div className="register-logo-icon">AB</div>
          <span>AutoBusiness</span>
        </Link>
        <div className="register-left-body">
          <h1>Crea tu cuenta gratis</h1>
          <p>14 días de prueba sin tarjeta. Cancela cuando quieras.</p>
          {planHint !== 'FREE' && (
            <div className="register-plan-badge">
              Plan seleccionado: <strong>{planHint}</strong>
              <span> — activa después de registrarte</span>
            </div>
          )}
        </div>
        <div className="register-testimonial">
          <p>"Antes manejaba el inventario en papel. Con AutoBusiness ya tengo todo en el celular."</p>
          <span>— Tienda de abarrotes, CDMX</span>
        </div>
      </div>

      <div className="register-right">
        <div className="register-form-wrap">
          <h2>Crear cuenta</h2>
          <p className="register-sub">¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link></p>

          {error && <div className="register-error">{error}</div>}

          <form onSubmit={handleSubmit} className="register-form">
            <div className="reg-group">
              <label>Nombre de tu negocio *</label>
              <input className="reg-input" value={form.businessName}
                onChange={set('businessName')} placeholder="Ej: Tienda Don Pepe"
                autoFocus required />
            </div>
            <div className="reg-group">
              <label>Tu nombre *</label>
              <input className="reg-input" value={form.ownerName}
                onChange={set('ownerName')} placeholder="Nombre del dueño" required />
            </div>
            <div className="reg-group">
              <label>Email *</label>
              <input className="reg-input" type="email" value={form.email}
                onChange={set('email')} placeholder="tu@email.com" required />
            </div>
            <div className="reg-group">
              <label>Contraseña *</label>
              <input className="reg-input" type="password" value={form.password}
                onChange={set('password')} placeholder="Mínimo 6 caracteres"
                minLength={6} required />
            </div>

            {/* Acuerdos Legales */}
            <div style={{
              marginTop: 20, background: '#f8fafc', borderRadius: 12,
              padding: '16px 18px', border: '1px solid #e2e8f0',
            }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a', marginBottom: 4 }}>
                Acuerdos Legales
              </div>
              <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 14px', lineHeight: 1.5 }}>
                Debes leer y aceptar todos los documentos para continuar.
              </p>

              {[
                { key: 'terms',         type: 'terms',         label: 'Términos y Condiciones' },
                { key: 'privacy',       type: 'privacy',       label: 'Política de Privacidad' },
                { key: 'acceptableUse', type: 'acceptable-use',label: 'Política de Uso Aceptable' },
              ].map(({ key, type, label }) => (
                <label key={key} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10,
                  cursor: 'pointer',
                }}>
                  <div
                    onClick={() => setAccepted(a => ({ ...a, [key]: !a[key] }))}
                    style={{
                      width: 20, height: 20, borderRadius: 5, flexShrink: 0, marginTop: 1,
                      border: `2px solid ${accepted[key] ? '#6366f1' : '#cbd5e1'}`,
                      background: accepted[key] ? '#6366f1' : '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all .15s', cursor: 'pointer',
                    }}>
                    {accepted[key] && (
                      <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
                        <path d="M1 4L4 7L10 1" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                  <span style={{ fontSize: 13, color: '#374151', lineHeight: 1.5 }}>
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
                  </span>
                </label>
              ))}

              {/* Declaración */}
              <div style={{
                marginTop: 12, padding: '12px 14px', background: '#eff6ff',
                borderRadius: 8, border: '1px solid #bfdbfe',
                fontSize: 12, color: '#1e40af', lineHeight: 1.6,
              }}>
                <strong>Declaración:</strong> Declaro que utilizaré AutoBusiness AI únicamente para actividades legales. Soy responsable de los productos, servicios, contenido y operaciones realizadas mediante mi cuenta. AutoBusiness AI proporciona herramientas tecnológicas y podrá suspender cuentas que incumplan las políticas de la plataforma.
              </div>
            </div>

            <button
              type="submit"
              className="reg-submit"
              disabled={loading || !allAccepted}
              style={{ opacity: !allAccepted ? 0.5 : 1 }}
            >
              {loading
                ? <><span className="reg-spinner" /> Creando cuenta...</>
                : 'Crear mi cuenta gratis'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
