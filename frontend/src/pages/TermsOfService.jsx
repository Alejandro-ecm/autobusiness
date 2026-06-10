import { Link } from 'react-router-dom'

const LAST_UPDATED = '30 de mayo de 2026'

const PLANS = [
  { name: 'FREE',    price: '$0',    desc: 'Acceso limitado — hasta 50 productos, sin tienda en línea.' },
  { name: 'BASIC',   price: '$80',   desc: 'Hasta 100 productos, tienda en línea, soporte por email. Plan anual: $800 (+2 meses gratis).' },
  { name: 'PRO',     price: '$150',  desc: 'Productos ilimitados, múltiples sucursales, análisis de IA, reportes avanzados. Plan anual: $1,500 (+2 meses gratis).' },
  { name: 'PREMIUM', price: '$200',  desc: 'Todo lo del plan PRO + soporte prioritario, acceso anticipado a nuevas funciones. Plan anual: $2,000 (+2 meses gratis).' },
]

export default function TermsOfService() {
  return (
    <div style={styles.page}>
      <div style={styles.container}>

        {/* Header */}
        <div style={styles.header}>
          <Link to="/" style={styles.backLink}>← Inicio</Link>
          <div style={styles.logoRow}>
            <div style={styles.logoIcon}>AB</div>
            <span style={styles.logoText}>AutoBusiness AI</span>
          </div>
          <h1 style={styles.title}>Términos y Condiciones de Servicio</h1>
          <p style={styles.meta}>
            <strong>Sky Technologies Latam</strong> &nbsp;·&nbsp; Última actualización: {LAST_UPDATED}
          </p>
        </div>

        <div style={styles.content}>

          <Section title="1. Aceptación de los términos">
            <p>
              Al registrarte en <strong>AutoBusiness AI</strong>, acceder o usar la plataforma (sitio web
              o aplicación móvil), aceptas quedar vinculado por estos Términos y Condiciones ("Términos")
              y nuestra{' '}
              <Link to="/privacy-policy" style={styles.link}>Política de Privacidad</Link>.
            </p>
            <p>
              Si no estás de acuerdo con estos Términos, no debes usar el servicio.
              El uso de AutoBusiness AI implica que eres mayor de 18 años y tienes capacidad legal para
              celebrar contratos en México.
            </p>
          </Section>

          <Section title="2. Descripción del servicio">
            <p>
              AutoBusiness AI es una plataforma SaaS (Software como Servicio) que permite a pequeñas y
              medianas empresas (PyMEs) en México gestionar:
            </p>
            <ul>
              <li>Punto de venta (POS / Caja)</li>
              <li>Inventario y control de stock</li>
              <li>Tienda en línea propia</li>
              <li>Análisis financiero e insights automáticos de negocio</li>
              <li>Gestión de clientes, pedidos y usuarios internos</li>
            </ul>
            <p>
              El servicio se opera bajo la marca <strong>AutoBusiness AI</strong> por
              <strong> Sky Technologies Latam</strong>.
            </p>
          </Section>

          <Section title="3. Planes y precios">
            <p>
              AutoBusiness AI ofrece los siguientes planes de suscripción, facturados mensualmente en
              <strong> pesos mexicanos (MXN)</strong>:
            </p>
            <div style={styles.plansGrid}>
              {PLANS.map(p => (
                <div key={p.name} style={styles.planCard}>
                  <div style={styles.planName}>{p.name}</div>
                  <div style={styles.planPrice}>{p.price} <span style={styles.planPer}>/mes</span></div>
                  <div style={styles.planDesc}>{p.desc}</div>
                </div>
              ))}
            </div>
            <p style={{ marginTop: 16 }}>
              Los precios pueden cambiar. Los cambios de precio se notificarán con al menos
              <strong> 30 días de anticipación</strong> por correo electrónico.
            </p>
          </Section>

          <Section title="4. Pagos y facturación">
            <ul>
              <li>
                Los pagos de suscripción se procesan a través de <strong>MercadoPago</strong>.
                Al suscribirte autorizas el cargo recurrente mensual.
              </li>
              <li>
                El ciclo de facturación comienza el día de la contratación. Los cargos son mensuales
                y anticipados.
              </li>
              <li>
                Si un pago falla, el acceso al plan de pago puede restringirse. Tendrás un período de
                gracia de <strong>3 días</strong> para actualizar tu método de pago.
              </li>
              <li>
                AutoBusiness AI no almacena datos de tarjetas bancarias. El procesamiento de pagos es
                responsabilidad exclusiva de MercadoPago.
              </li>
            </ul>
          </Section>

          <Section title="5. Prueba gratuita y cancelación">
            <ul>
              <li>
                Los nuevos usuarios tienen acceso a un período de prueba gratuito de <strong>14 días</strong>
                en el plan FREE sin necesidad de tarjeta de crédito.
              </li>
              <li>
                Puedes cancelar tu suscripción en cualquier momento desde la sección de
                <strong> Suscripción</strong> dentro de la app. La cancelación es efectiva al final del
                período ya pagado; no hay reembolsos proporcionales.
              </li>
              <li>
                Al cancelar, tu cuenta pasa al plan FREE con sus limitaciones correspondientes.
              </li>
            </ul>
          </Section>

          <Section title="6. Eliminación de cuenta">
            <p>
              Puedes solicitar la eliminación permanente de tu cuenta y todos tus datos en cualquier
              momento. Para ello, visita:{' '}
              <Link to="/account-deletion" style={styles.link}>Eliminar mi cuenta</Link>.
            </p>
            <p>
              La eliminación es irreversible. Se eliminarán todos los datos del negocio, inventario,
              historial de ventas y usuarios asociados en un plazo máximo de 30 días.
            </p>
          </Section>

          <Section title="7. Uso aceptable">
            <p>Al usar AutoBusiness AI, te comprometes a:</p>
            <ul>
              <li>Usar el servicio únicamente para fines comerciales legales.</li>
              <li>No intentar acceder sin autorización a datos de otros negocios.</li>
              <li>No hacer ingeniería inversa, descompilar o reproducir el software.</li>
              <li>No usar el servicio para actividades fraudulentas, ilegales o que violen derechos de terceros.</li>
              <li>No sobrecargar la infraestructura de forma intencional (ataques DoS o similares).</li>
            </ul>
            <p>
              El incumplimiento puede resultar en la suspensión o cancelación inmediata de tu cuenta
              sin reembolso.
            </p>
          </Section>

          <Section title="8. Propiedad intelectual">
            <p>
              Todo el código, diseño, marca, logotipos y contenidos de AutoBusiness AI son propiedad
              exclusiva de <strong>Sky Technologies Latam</strong> y están protegidos por las leyes de
              propiedad intelectual aplicables en México y tratados internacionales.
            </p>
            <p>
              Te otorgamos una licencia limitada, no exclusiva, intransferible y revocable para usar el
              servicio según estos Términos. No adquieres ningún derecho de propiedad sobre el software.
            </p>
            <p>
              Los datos que ingresas en la plataforma (inventario, ventas, clientes) son de tu propiedad.
              Nos otorgas licencia para procesarlos con el fin de prestarte el servicio.
            </p>
          </Section>

          <Section title="9. Disponibilidad del servicio">
            <p>
              Nos esforzamos por mantener una disponibilidad del <strong>99% mensual</strong>, pero no
              garantizamos disponibilidad ininterrumpida. Pueden producirse interrupciones por:
            </p>
            <ul>
              <li>Mantenimiento programado (notificado con anticipación cuando sea posible).</li>
              <li>Fallos de infraestructura de terceros (hosting, base de datos, MercadoPago).</li>
              <li>Casos de fuerza mayor.</li>
            </ul>
          </Section>

          <Section title="10. Limitación de responsabilidad">
            <p>
              En la máxima medida permitida por la ley mexicana, Sky Technologies Latam no será
              responsable por:
            </p>
            <ul>
              <li>Pérdidas de datos debidas a uso incorrecto del servicio por parte del usuario.</li>
              <li>Daños indirectos, incidentales o consecuentes derivados del uso o imposibilidad de uso del servicio.</li>
              <li>Decisiones comerciales tomadas con base en los análisis o reportes generados por la plataforma.</li>
            </ul>
            <p>
              La responsabilidad máxima de Sky Technologies Latam se limita al monto pagado en los
              últimos <strong>3 meses</strong> de suscripción.
            </p>
          </Section>

          <Section title="11. Modificaciones a los términos">
            <p>
              Podemos modificar estos Términos en cualquier momento. Los cambios materiales se
              comunicarán por correo electrónico y/o mediante aviso en la aplicación con al menos
              <strong> 15 días de anticipación</strong>.
            </p>
            <p>
              El uso continuado del servicio después de la fecha de vigencia de los nuevos Términos
              implica la aceptación de los mismos.
            </p>
          </Section>

          <Section title="12. Ley aplicable y jurisdicción">
            <p>
              Estos Términos se rigen por las leyes de los <strong>Estados Unidos Mexicanos</strong>.
              Cualquier controversia se resolverá ante los tribunales competentes de la
              <strong> Ciudad de México</strong>, con renuncia expresa a cualquier otro fuero.
            </p>
          </Section>

          <Section title="13. Contacto">
            <p>
              Para preguntas sobre estos Términos:
            </p>
            <div style={styles.contactBox}>
              <p><strong>Sky Technologies Latam</strong></p>
              <p>Email: <a href="mailto:soporte@skytechnologieslatam.com" style={styles.link}>soporte@skytechnologieslatam.com</a></p>
              <p>Sitio: <a href="https://autobusiness.skytechnologieslatam.com" style={styles.link}>autobusiness.skytechnologieslatam.com</a></p>
            </div>
          </Section>

        </div>

        {/* Footer links */}
        <div style={styles.footer}>
          <Link to="/privacy-policy" style={styles.link}>Política de Privacidad</Link>
          <span style={{ color: '#cbd5e1' }}>·</span>
          <Link to="/account-deletion" style={styles.link}>Eliminar cuenta</Link>
          <span style={{ color: '#cbd5e1' }}>·</span>
          <Link to="/login" style={styles.link}>Iniciar sesión</Link>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <section style={styles.section}>
      <h2 style={styles.sectionTitle}>{title}</h2>
      {children}
    </section>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#f8fafc',
    fontFamily: "'Inter', system-ui, sans-serif",
    color: '#1e293b',
  },
  container: {
    maxWidth: 760,
    margin: '0 auto',
    padding: '40px 24px 64px',
  },
  header: {
    textAlign: 'center',
    marginBottom: 40,
    paddingBottom: 32,
    borderBottom: '2px solid #e2e8f0',
  },
  backLink: {
    display: 'inline-block',
    marginBottom: 20,
    color: '#6366f1',
    textDecoration: 'none',
    fontSize: 14,
    fontWeight: 600,
  },
  logoRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 16,
  },
  logoIcon: {
    width: 40,
    height: 40,
    background: '#6366f1',
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 800,
    fontSize: 16,
    color: '#fff',
  },
  logoText: {
    fontSize: 20,
    fontWeight: 700,
    color: '#0f172a',
  },
  title: {
    fontSize: 28,
    fontWeight: 800,
    color: '#0f172a',
    margin: '0 0 8px',
  },
  meta: {
    fontSize: 13,
    color: '#64748b',
    margin: 0,
  },
  content: {
    lineHeight: 1.75,
    fontSize: 15,
    color: '#334155',
  },
  section: {
    marginBottom: 36,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: '#0f172a',
    marginBottom: 12,
    paddingBottom: 6,
    borderBottom: '1px solid #e2e8f0',
  },
  link: {
    color: '#6366f1',
    textDecoration: 'none',
    fontWeight: 500,
  },
  plansGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: 12,
    marginTop: 12,
  },
  planCard: {
    background: '#fff',
    border: '1.5px solid #e2e8f0',
    borderRadius: 12,
    padding: '16px',
    textAlign: 'center',
  },
  planName: {
    fontSize: 13,
    fontWeight: 700,
    color: '#6366f1',
    letterSpacing: '0.05em',
    marginBottom: 4,
  },
  planPrice: {
    fontSize: 22,
    fontWeight: 800,
    color: '#0f172a',
    marginBottom: 8,
  },
  planPer: {
    fontSize: 13,
    fontWeight: 400,
    color: '#94a3b8',
  },
  planDesc: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 1.5,
  },
  contactBox: {
    background: '#f1f5f9',
    border: '1px solid #e2e8f0',
    borderRadius: 12,
    padding: '16px 20px',
    marginTop: 12,
    lineHeight: 1.8,
  },
  footer: {
    marginTop: 48,
    paddingTop: 24,
    borderTop: '1px solid #e2e8f0',
    display: 'flex',
    gap: 16,
    justifyContent: 'center',
    alignItems: 'center',
    fontSize: 13,
    flexWrap: 'wrap',
  },
}
