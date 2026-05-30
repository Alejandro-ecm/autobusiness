import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../store/AuthContext'
import { useToast } from '../store/ToastContext'
import './Login.css'

export default function Login() {
  const [tab, setTab] = useState('login')
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ email: '', password: '', businessName: '', ownerName: '' })
  const { login, register } = useAuth()
  const { show } = useToast()
  const navigate = useNavigate()

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const user = await login(form.email, form.password)
      navigate(user.role === 'CASHIER' ? '/caja' : '/dashboard')
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
          background: 'linear-gradient(90deg,#6366f1,#8b5cf6)',
          color: '#fff', textAlign: 'center', padding: '10px',
          cursor: 'pointer', fontSize: 13, fontWeight: 600,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
        }}>
        🛍️ ¿Buscas una tienda? Ver tiendas en línea →
      </div>

      <div className="login-box card" style={{ marginTop: 48 }}>
        <div className="login-logo">
          <div className="login-logo-icon">AB</div>
          <h1 className="login-title">AutoBusiness AI</h1>
          <p className="login-subtitle">Plataforma inteligente para tu negocio</p>
        </div>

        <div className="login-tabs">
          <button className={`login-tab ${tab === 'login' ? 'active' : ''}`} onClick={() => setTab('login')}>
            Iniciar sesión
          </button>
          <button className={`login-tab ${tab === 'register' ? 'active' : ''}`} onClick={() => setTab('register')}>
            Crear cuenta
          </button>
        </div>

        {tab === 'login' ? (
          <form onSubmit={handleLogin} className="login-form">
            <div className="input-group">
              <label>Email</label>
              <input className="input" type="email" value={form.email} onChange={set('email')} placeholder="tu@email.com" required />
            </div>
            <div className="input-group">
              <label>Contraseña</label>
              <input className="input" type="password" value={form.password} onChange={set('password')} placeholder="••••••••" required />
            </div>
            <button className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: 8 }} disabled={loading}>
              {loading ? <div className="spinner" /> : 'Entrar'}
            </button>
          </form>
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
        <div style={{ textAlign: 'center', marginTop: 20, paddingTop: 16, borderTop: '1px solid #f1f5f9' }}>
          <span
            onClick={() => navigate('/marketplace')}
            style={{ color: '#6366f1', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
            🛍️ Ver tiendas en línea
          </span>
        </div>

        {/* Legal links */}
        <div style={{ textAlign: 'center', marginTop: 14, display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Link to="/terms" style={{ color: '#94a3b8', fontSize: 11, textDecoration: 'none' }}>Términos de Servicio</Link>
          <span style={{ color: '#e2e8f0', fontSize: 11 }}>·</span>
          <Link to="/privacy-policy" style={{ color: '#94a3b8', fontSize: 11, textDecoration: 'none' }}>Privacidad</Link>
          <span style={{ color: '#e2e8f0', fontSize: 11 }}>·</span>
          <Link to="/account-deletion" style={{ color: '#94a3b8', fontSize: 11, textDecoration: 'none' }}>Eliminar cuenta</Link>
        </div>
      </div>
    </div>
  )
}
