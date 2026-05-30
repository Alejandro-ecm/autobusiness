import { Link } from 'react-router-dom'

const LAST_UPDATED = '30 de mayo de 2026'

export default function PrivacyPolicy() {
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
          <h1 style={styles.title}>Política de Privacidad</h1>
          <p style={styles.meta}>
            <strong>Sky Technologies Latam</strong> &nbsp;·&nbsp; Última actualización: {LAST_UPDATED}
          </p>
        </div>

        {/* Content */}
        <div style={styles.content}>

          <Section title="1. Quiénes somos">
            <p>
              <strong>Sky Technologies Latam</strong> ("la Empresa", "nosotros") opera la plataforma
              <strong> AutoBusiness AI</strong>, un sistema de gestión comercial para pequeñas y medianas
              empresas en México, disponible en web y como aplicación móvil en Google Play Store.
            </p>
            <p>
              Sitio web: <a href="https://skytechnologieslatam.com" style={styles.link}>skytechnologieslatam.com</a><br />
              Contacto de privacidad: <a href="mailto:soporte@skytechnologieslatam.com" style={styles.link}>soporte@skytechnologieslatam.com</a>
            </p>
          </Section>

          <Section title="2. Datos que recopilamos">
            <p>Recopilamos los siguientes datos cuando usas AutoBusiness AI:</p>

            <SubSection title="2.1 Datos de cuenta y negocio">
              <ul>
                <li><strong>Nombre completo</strong> del propietario o usuario registrado.</li>
                <li><strong>Correo electrónico</strong> — usado como identificador de cuenta y para comunicaciones de servicio.</li>
                <li><strong>Contraseña</strong> — almacenada de forma cifrada (bcrypt); nunca se guarda en texto plano.</li>
                <li><strong>Nombre del negocio</strong> y sucursales que registres.</li>
              </ul>
            </SubSection>

            <SubSection title="2.2 Datos operativos del negocio">
              <ul>
                <li><strong>Inventario y productos:</strong> nombre, precio, costo, stock, categorías.</li>
                <li><strong>Ventas y transacciones</strong> realizadas a través del punto de venta (POS) o tienda en línea.</li>
                <li><strong>Pedidos en línea</strong> realizados por clientes en tu tienda pública.</li>
                <li><strong>Datos de clientes</strong> que registres voluntariamente (nombre, teléfono, saldo fiado).</li>
                <li><strong>Movimientos de inventario</strong> e historial de ajustes de stock.</li>
              </ul>
            </SubSection>

            <SubSection title="2.3 Datos de pago y suscripción">
              <ul>
                <li>
                  Los pagos de suscripción se procesan a través de <strong>MercadoPago</strong>.
                  AutoBusiness AI <strong>no almacena</strong> datos de tarjetas bancarias; estos son
                  procesados directamente por MercadoPago bajo su propia política de privacidad
                  (<a href="https://www.mercadopago.com.mx/privacidad" style={styles.link}>mercadopago.com.mx/privacidad</a>).
                </li>
                <li>Se almacena el <strong>plan de suscripción activo</strong> y el historial de pagos (monto, fecha, estado).</li>
              </ul>
            </SubSection>

            <SubSection title="2.4 Datos técnicos y de uso">
              <ul>
                <li><strong>Dirección IP</strong> — registrada en logs de servidor para seguridad y detección de fraude.</li>
                <li><strong>Identificador de dispositivo</strong> en la app móvil (Capacitor/Android).</li>
                <li><strong>Eventos de uso</strong> anónimos (función utilizada, pantallas visitadas) para mejorar el producto.</li>
              </ul>
            </SubSection>
          </Section>

          <Section title="3. Cómo usamos tus datos">
            <p>Usamos tus datos exclusivamente para:</p>
            <ul>
              <li>Proveer, mantener y mejorar los servicios de AutoBusiness AI.</li>
              <li>Autenticar tu acceso y proteger la seguridad de tu cuenta.</li>
              <li>Procesar pagos y gestionar tu suscripción.</li>
              <li>Generar reportes, análisis financieros e insights automáticos de tu negocio.</li>
              <li>Enviarte notificaciones del servicio (alertas de stock bajo, vencimiento de suscripción, etc.).</li>
              <li>Cumplir con obligaciones legales aplicables en México.</li>
            </ul>
            <p>
              <strong>No vendemos, alquilamos ni comercializamos tus datos personales</strong> con terceros
              con fines publicitarios o de marketing.
            </p>
          </Section>

          <Section title="4. Base legal para el tratamiento">
            <p>
              De conformidad con la <strong>Ley Federal de Protección de Datos Personales en Posesión
              de los Particulares (LFPDPPP)</strong> de México, tratamos tus datos con base en:
            </p>
            <ul>
              <li><strong>Consentimiento:</strong> al registrarte aceptas esta política.</li>
              <li><strong>Ejecución del contrato:</strong> para prestarte el servicio contratado.</li>
              <li><strong>Interés legítimo:</strong> para la seguridad de la plataforma y prevención de fraude.</li>
              <li><strong>Obligación legal:</strong> cuando la ley mexicana lo requiera.</li>
            </ul>
          </Section>

          <Section title="5. Multi-tenancy y aislamiento de datos">
            <p>
              AutoBusiness AI es una plataforma <strong>multi-tenant</strong>. Cada negocio registrado
              tiene un identificador único (<code>business_id</code>) y sus datos están estrictamente
              separados de los de otros negocios. Ningún usuario puede acceder a datos de otro negocio.
            </p>
          </Section>

          <Section title="6. Compartir datos con terceros">
            <p>Compartimos datos únicamente con los siguientes proveedores esenciales:</p>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Proveedor</th>
                  <th style={styles.th}>Propósito</th>
                  <th style={styles.th}>Datos compartidos</th>
                </tr>
              </thead>
              <tbody>
                <TableRow cols={['MercadoPago', 'Procesamiento de pagos', 'Monto, descripción de cargo; NO datos de tarjeta almacenados por nosotros']} />
                <TableRow cols={['Proveedor de hosting (Render / Railway)', 'Infraestructura de servidores', 'Datos cifrados en tránsito; no acceden a contenido']} />
                <TableRow cols={['Google Play Store', 'Distribución de la app Android', 'Información de instalación y actualizaciones']} />
              </tbody>
            </table>
          </Section>

          <Section title="7. Retención de datos">
            <ul>
              <li>Los datos de tu cuenta se retienen mientras la cuenta esté activa.</li>
              <li>Al eliminar tu cuenta, tus datos personales y operativos se eliminan de forma permanente en un plazo máximo de <strong>30 días</strong>.</li>
              <li>Algunos datos pueden retenerse por hasta <strong>5 años</strong> cuando la ley fiscal o contable mexicana lo exija.</li>
            </ul>
          </Section>

          <Section title="8. Seguridad">
            <ul>
              <li>Comunicaciones cifradas con <strong>TLS/HTTPS</strong>.</li>
              <li>Contraseñas cifradas con <strong>bcrypt</strong> (nunca en texto plano).</li>
              <li>Autenticación mediante <strong>JWT con expiración de 24 horas</strong>.</li>
              <li>Acceso a datos segmentado por rol (OWNER, ADMIN, CAJERO).</li>
              <li>Base de datos PostgreSQL en servidor privado, no expuesta públicamente.</li>
            </ul>
          </Section>

          <Section title="9. Tus derechos (Derechos ARCO)">
            <p>
              De acuerdo con la LFPDPPP, tienes derecho a:
            </p>
            <ul>
              <li><strong>Acceso</strong> — conocer qué datos tenemos sobre ti.</li>
              <li><strong>Rectificación</strong> — corregir datos inexactos o incompletos.</li>
              <li><strong>Cancelación</strong> — solicitar la eliminación de tus datos.</li>
              <li><strong>Oposición</strong> — oponerte al tratamiento de tus datos.</li>
            </ul>
            <p>
              Para ejercer estos derechos, envía un correo a{' '}
              <a href="mailto:soporte@skytechnologieslatam.com" style={styles.link}>soporte@skytechnologieslatam.com</a>{' '}
              con el asunto "Derechos ARCO". Responderemos en un plazo máximo de 20 días hábiles.
            </p>
            <p>
              También puedes eliminar tu cuenta directamente desde la app en:{' '}
              <Link to="/account-deletion" style={styles.link}>Eliminar mi cuenta</Link>.
            </p>
          </Section>

          <Section title="10. Menores de edad">
            <p>
              AutoBusiness AI está dirigido exclusivamente a personas mayores de 18 años con capacidad
              para celebrar contratos. No recopilamos datos de menores de edad de manera intencional.
            </p>
          </Section>

          <Section title="11. Cambios a esta política">
            <p>
              Podemos actualizar esta Política de Privacidad. Te notificaremos por correo electrónico
              y/o mediante un aviso en la aplicación con al menos <strong>15 días de anticipación</strong>
              antes de que los cambios entren en vigor. El uso continuado del servicio después de dicha
              fecha implica la aceptación de los cambios.
            </p>
          </Section>

          <Section title="12. Contacto">
            <p>
              Para preguntas, quejas o ejercicio de derechos relacionados con tu privacidad:
            </p>
            <div style={styles.contactBox}>
              <p><strong>Sky Technologies Latam</strong></p>
              <p>Email: <a href="mailto:soporte@skytechnologieslatam.com" style={styles.link}>soporte@skytechnologieslatam.com</a></p>
              <p>Sitio: <a href="https://skytechnologieslatam.com" style={styles.link}>skytechnologieslatam.com</a></p>
            </div>
          </Section>

        </div>

        {/* Footer links */}
        <div style={styles.footer}>
          <Link to="/terms" style={styles.link}>Términos de Servicio</Link>
          <span style={{ color: '#cbd5e1' }}>·</span>
          <Link to="/account-deletion" style={styles.link}>Eliminar cuenta</Link>
          <span style={{ color: '#cbd5e1' }}>·</span>
          <Link to="/login" style={styles.link}>Iniciar sesión</Link>
        </div>
      </div>
    </div>
  )
}

/* ── Sub-components ── */
function Section({ title, children }) {
  return (
    <section style={styles.section}>
      <h2 style={styles.sectionTitle}>{title}</h2>
      {children}
    </section>
  )
}

function SubSection({ title, children }) {
  return (
    <div style={styles.subSection}>
      <h3 style={styles.subSectionTitle}>{title}</h3>
      {children}
    </div>
  )
}

function TableRow({ cols }) {
  return (
    <tr>
      {cols.map((c, i) => (
        <td key={i} style={styles.td}>{c}</td>
      ))}
    </tr>
  )
}

/* ── Styles ── */
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
  subSection: {
    marginTop: 16,
    marginBottom: 8,
  },
  subSectionTitle: {
    fontSize: 15,
    fontWeight: 600,
    color: '#334155',
    marginBottom: 8,
  },
  link: {
    color: '#6366f1',
    textDecoration: 'none',
    fontWeight: 500,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 14,
    marginTop: 12,
  },
  th: {
    background: '#f1f5f9',
    padding: '10px 14px',
    textAlign: 'left',
    fontWeight: 600,
    color: '#374151',
    border: '1px solid #e2e8f0',
  },
  td: {
    padding: '10px 14px',
    border: '1px solid #e2e8f0',
    verticalAlign: 'top',
    color: '#334155',
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
