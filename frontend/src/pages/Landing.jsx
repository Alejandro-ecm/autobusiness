import { Link } from 'react-router-dom'
import './Landing.css'

const FEATURES = [
  { icon: '💳', title: 'Punto de Venta inteligente', desc: 'POS rápido con escáner de cámara, cobro en efectivo, tarjeta o transferencia.' },
  { icon: '📦', title: 'Inventario completo', desc: 'Códigos de barras EAN-13, fotos, importación Excel masiva y alertas de stock bajo.' },
  { icon: '👥', title: 'Fiado y clientes', desc: 'Registra crédito de clientes, abonos e historial de transacciones.' },
  { icon: '🏪', title: 'Tienda online con QR', desc: 'Vende por internet con tu propia tienda pública. Comparte el QR y recibe pedidos.' },
  { icon: '📊', title: 'Reportes exportables', desc: 'Ventas por período, ticket promedio, desglose por método de pago. Exporta a CSV.' },
  { icon: '🤖', title: 'Diagnóstico con IA', desc: 'Motor de análisis que detecta caídas de ventas, productos sin movimiento y márgenes bajos.' },
  { icon: '💙', title: 'Pago con Mercado Pago', desc: 'Acepta pagos online directamente desde tu tienda con Mercado Pago.' },
  { icon: '🧾', title: 'Estructura CFDI lista', desc: 'Guarda datos fiscales de tus clientes para timbrado futuro con PAC certificado.' },
]

const PLANS = [
  {
    name: 'FREE',
    price: 0,
    label: 'Gratis',
    desc: 'Para empezar sin costo',
    features: ['50 productos', '2 usuarios', 'POS básico', 'Inventario', '14 días de prueba'],
    cta: 'Crear cuenta gratis',
    highlight: false,
  },
  {
    name: 'BASIC',
    price: 29,
    label: '$29/mes',
    desc: 'Para negocios en crecimiento',
    features: ['500 productos', '5 usuarios', 'Tienda online + QR', 'Reportes', 'Soporte por email'],
    cta: 'Empezar con BASIC',
    highlight: false,
  },
  {
    name: 'PRO',
    price: 49,
    label: '$49/mes',
    desc: 'El favorito de las tiendas',
    features: ['Productos ilimitados', '15 usuarios', 'Todo en BASIC', 'IA diagnósticos', 'Cobros con Mercado Pago'],
    cta: 'Empezar con PRO',
    highlight: true,
  },
  {
    name: 'PREMIUM',
    price: 89,
    label: '$89/mes',
    desc: 'Para cadenas y franquicias',
    features: ['Todo ilimitado', 'Usuarios ilimitados', 'CFDI / facturación', 'Multi-sucursal', 'Soporte prioritario'],
    cta: 'Empezar con PREMIUM',
    highlight: false,
  },
]

export default function Landing() {
  return (
    <div className="landing">
      {/* Nav */}
      <nav className="landing-nav">
        <div className="landing-nav-inner">
          <div className="landing-logo">
            <span className="landing-logo-icon">AB</span>
            <span className="landing-logo-text">AutoBusiness</span>
          </div>
          <div className="landing-nav-links">
            <a href="#features">Funciones</a>
            <a href="#pricing">Precios</a>
            <Link to="/login" className="landing-btn-outline">Iniciar sesión</Link>
            <Link to="/register" className="landing-btn-primary">Crear cuenta gratis</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="landing-hero">
        <div className="landing-hero-badge">🇲🇽 Hecho para PyMEs mexicanas</div>
        <h1 className="landing-hero-title">
          El sistema todo-en-uno<br />
          para tu <span className="landing-gradient">tienda mexicana</span>
        </h1>
        <p className="landing-hero-sub">
          POS · Inventario · Tienda online · Fiado · Reportes · IA<br />
          Sin complicaciones. Sin contratos. Desde $0/mes.
        </p>
        <div className="landing-hero-cta">
          <Link to="/register" className="landing-btn-hero">
            Crear cuenta gratis — 14 días sin costo
          </Link>
          <span className="landing-hero-hint">No se requiere tarjeta de crédito</span>
        </div>
        <div className="landing-hero-img">
          <div className="landing-mock">
            <div className="landing-mock-bar">
              <span /><span /><span />
            </div>
            <div className="landing-mock-body">
              <div className="landing-mock-kpi"><span>$18,450</span><small>Ventas hoy</small></div>
              <div className="landing-mock-kpi"><span>47</span><small>Ventas</small></div>
              <div className="landing-mock-kpi"><span>12</span><small>Pedidos online</small></div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="landing-features">
        <h2 className="landing-section-title">Todo lo que necesita tu negocio</h2>
        <p className="landing-section-sub">Una sola app para manejar todo desde el teléfono o computadora</p>
        <div className="landing-features-grid">
          {FEATURES.map(f => (
            <div key={f.title} className="landing-feature-card">
              <div className="landing-feature-icon">{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="landing-pricing">
        <h2 className="landing-section-title">Precios transparentes</h2>
        <p className="landing-section-sub">Empieza gratis. Escala cuando lo necesites. Cancela cuando quieras.</p>
        <div className="landing-plans">
          {PLANS.map(plan => (
            <div key={plan.name} className={`landing-plan${plan.highlight ? ' landing-plan--pro' : ''}`}>
              {plan.highlight && <div className="landing-plan-badge">⭐ Más popular</div>}
              <div className="landing-plan-name">{plan.name}</div>
              <div className="landing-plan-price">{plan.label}</div>
              <div className="landing-plan-desc">{plan.desc}</div>
              <ul className="landing-plan-features">
                {plan.features.map(f => <li key={f}>✓ {f}</li>)}
              </ul>
              <Link
                to={`/register?plan=${plan.name}`}
                className={plan.highlight ? 'landing-btn-hero' : 'landing-btn-outline'}
                style={{ display: 'block', textAlign: 'center', marginTop: 'auto' }}>
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* CTA final */}
      <section className="landing-final-cta">
        <h2>¿Listo para hacer crecer tu negocio?</h2>
        <p>Únete a cientos de tiendas mexicanas que ya usan AutoBusiness.</p>
        <Link to="/register" className="landing-btn-hero">
          Crear mi cuenta ahora — es gratis
        </Link>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div className="landing-logo">
            <span className="landing-logo-icon">AB</span>
            <span className="landing-logo-text">AutoBusiness AI</span>
          </div>
          <div className="landing-footer-links">
            <a href="#features">Funciones</a>
            <a href="#pricing">Precios</a>
            <Link to="/login">Iniciar sesión</Link>
          </div>
          <p className="landing-footer-copy">© 2025 AutoBusiness AI · Hecho con ❤️ en México</p>
        </div>
      </footer>
    </div>
  )
}
