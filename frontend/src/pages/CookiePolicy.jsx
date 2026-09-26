import { Link } from 'react-router-dom'
import { LegalPageLayout, Section, DraftBanner, legalStyles as styles } from '../components/legal/LegalPageLayout'

const LAST_UPDATED = '26 de septiembre de 2026'

export default function CookiePolicy() {
  return (
    <LegalPageLayout
      title="Política de Cookies"
      subtitle={<><strong>Sky Technologies Latam</strong> &nbsp;·&nbsp; Última actualización: {LAST_UPDATED}</>}
      footer={<>
        <Link to="/privacidad" style={styles.link}>Aviso de Privacidad</Link>
        <span style={{ color: '#cbd5e1' }}>·</span>
        <Link to="/terminos" style={styles.link}>Términos de Servicio</Link>
        <span style={{ color: '#cbd5e1' }}>·</span>
        <Link to="/login" style={styles.link}>Iniciar sesión</Link>
      </>}
    >
      <DraftBanner>debe revisarlo un abogado antes de publicarse como definitivo.</DraftBanner>

      <Section>
        <p>
          AutoBusiness AI <strong>no usa cookies de rastreo, analíticas de terceros ni
          publicidad</strong>. Este documento existe para ser transparentes sobre qué guardamos
          en tu navegador y para qué — es un inventario real de lo que usa la aplicación, no
          una lista genérica.
        </p>
      </Section>

      <Section title="1. No usamos cookies de rastreo">
        <p>
          No usamos Google Analytics, Meta Pixel, Hotjar ni ningún servicio de analítica o
          publicidad de terceros. No hay cookies de marketing. Toda la información que se
          guarda en tu navegador es <strong>necesaria para que la aplicación funcione</strong> —
          almacenada con <code>localStorage</code>, no con cookies tradicionales.
        </p>
      </Section>

      <Section title="2. Datos guardados en tu navegador (localStorage)">
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, marginTop: 8 }}>
          <thead>
            <tr>
              <th style={th}>Clave</th>
              <th style={th}>Para qué sirve</th>
              <th style={th}>Tipo</th>
            </tr>
          </thead>
          <tbody>
            <tr><td style={td}><code>ab_token</code></td><td style={td}>Tu sesión iniciada (token de acceso)</td><td style={td}>Necesaria</td></tr>
            <tr><td style={td}><code>ab_user</code></td><td style={td}>Tus datos de usuario para no volver a pedirlos en cada pantalla</td><td style={td}>Necesaria</td></tr>
            <tr><td style={td}><code>ab_offline_sales</code></td><td style={td}>Ventas del Punto de Venta hechas sin internet, pendientes de sincronizar</td><td style={td}>Necesaria (funcional)</td></tr>
            <tr><td style={td}><code>multi_accounts</code></td><td style={td}>Cambiar rápido entre varias cuentas/negocios en el mismo navegador</td><td style={td}>Preferencia</td></tr>
            <tr><td style={td}><code>sidebar_collapsed</code></td><td style={td}>Recordar si el menú lateral está expandido o no</td><td style={td}>Preferencia</td></tr>
            <tr><td style={td}><code>mkt_history</code></td><td style={td}>Historial de publicaciones de marketing generadas para tu negocio</td><td style={td}>Funcional</td></tr>
            <tr><td style={td}><code>checkout_pending_ref</code></td><td style={td}>Referencia de un pago de suscripción en curso</td><td style={td}>Necesaria</td></tr>
            <tr><td style={td}>Configuración de báscula</td><td style={td}>Ajustes de tu báscula conectada al Punto de Venta</td><td style={td}>Funcional</td></tr>
          </tbody>
        </table>
        <p style={{ marginTop: 12 }}>
          Ninguno de estos datos se comparte con terceros ni se usa para publicidad. Puedes
          borrarlos en cualquier momento desde la configuración de tu navegador — algunos
          (como <code>ab_token</code>) simplemente cerrarán tu sesión.
        </p>
      </Section>

      <Section title="3. Banner de consentimiento">
        <p>
          Como no usamos cookies de analítica ni de marketing, no mostramos un banner de
          "Aceptar cookies" — no hay nada opcional que aceptar o rechazar. Si en el futuro
          agregamos algún servicio de este tipo, actualizaremos esta página y agregaremos el
          banner correspondiente antes de activarlo.
        </p>
      </Section>

      <Section title="4. Contacto">
        <div style={styles.contactBox}>
          <p><strong>Sky Technologies Latam</strong></p>
          <p>Email: <a href="mailto:soporte@skytechnologieslatam.com" style={styles.link}>soporte@skytechnologieslatam.com</a></p>
        </div>
      </Section>
    </LegalPageLayout>
  )
}

const th = { background: '#f1f5f9', padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: '#374151', border: '1px solid #e2e8f0' }
const td = { padding: '10px 14px', border: '1px solid #e2e8f0', verticalAlign: 'top', color: '#334155' }
