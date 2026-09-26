import { Link } from 'react-router-dom'
import { LegalPageLayout, Section, DraftBanner, legalStyles as styles } from '../components/legal/LegalPageLayout'

const LAST_UPDATED = '26 de septiembre de 2026'

export default function RefundPolicy() {
  return (
    <LegalPageLayout
      title="Política de Reembolsos"
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
          Esta política aplica a la <strong>suscripción del servicio AutoBusiness AI</strong>
          (el software que usa tu negocio). Si buscas la política de devoluciones de productos
          comprados en la Tienda Online de un negocio que usa AutoBusiness, consúltala
          directamente en esa tienda — cada negocio define la suya.
        </p>
      </Section>

      <Section title="1. Periodo de prueba">
        <p>
          AutoBusiness AI ofrece un periodo de prueba gratuito sin necesidad de tarjeta. Durante
          la prueba puedes cancelar en cualquier momento sin cargo alguno.
        </p>
      </Section>

      <Section title="2. Suscripciones pagadas">
        <p>
          Los pagos de suscripción se procesan a través de MercadoPago. Puedes cancelar tu
          suscripción en cualquier momento desde tu panel — la cancelación aplica al siguiente
          ciclo de facturación; no se realizan reembolsos proporcionales por el tiempo ya
          transcurrido del periodo en curso, salvo que la ley aplicable indique lo contrario.
        </p>
      </Section>

      <Section title="3. Errores de cobro">
        <p>
          Si detectas un cobro duplicado o incorrecto, contáctanos dentro de los 30 días
          posteriores al cargo y lo revisaremos caso por caso.
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
