import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../store/AuthContext'
import { trackEvent } from '../lib/alejandria'
import { validateEmailDomain } from '../lib/emailValidation'
import './Register.css'

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const planHint = params.get('plan') || 'FREE'

  const [form, setForm] = useState({ businessName: '', ownerName: '', email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.businessName.trim()) { setError('Ingresa el nombre de tu negocio'); return }
    if (!form.ownerName.trim())    { setError('Ingresa tu nombre'); return }
    if (!form.email.trim())        { setError('Ingresa tu email'); return }
    const emailErr = validateEmailDomain(form.email)
    if (emailErr) { setError(emailErr); return }
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
      trackEvent('usuario_registro', {
        nombre: form.ownerName.trim(),
        plan: planHint,
      })
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
          <p className="register-sub">Ya tienes cuenta? <Link to="/login">Inicia sesión</Link></p>

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

            <button type="submit" className="reg-submit" disabled={loading}>
              {loading
                ? <><span className="reg-spinner" /> Creando cuenta...</>
                : 'Crear mi cuenta gratis'}
            </button>
          </form>

          <p className="register-terms">
            Al registrarte aceptas nuestros{' '}
            <Link to="/terms" style={{ color: '#6366f1', fontWeight: 600 }}>Términos de Servicio</Link>
            {' '}y nuestra{' '}
            <Link to="/privacy-policy" style={{ color: '#6366f1', fontWeight: 600 }}>Política de Privacidad</Link>.
            No se requiere tarjeta de crédito.
          </p>
        </div>
      </div>
    </div>
  )
}
