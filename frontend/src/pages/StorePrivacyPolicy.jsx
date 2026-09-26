import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { store as storeApi } from '../api'
import { LegalPageLayout, Section, DraftBanner, legalStyles as styles } from '../components/legal/LegalPageLayout'

export default function StorePrivacyPolicy() {
  const { slug } = useParams()
  const [business, setBusiness] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    storeApi.storefront(slug)
      .then(d => setBusiness(d.business))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [slug])

  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: '#64748b' }}>Cargando…</div>
  if (error || !business) return <div style={{ padding: 60, textAlign: 'center', color: '#64748b' }}>Tienda no encontrada.</div>

  const hasCustom = business.storePrivacyNotice && business.storePrivacyNotice.trim()

  return (
    <LegalPageLayout
      title={`Aviso de Privacidad — ${business.name}`}
      backTo={`/tienda/${slug}`}
      backLabel="← Volver a la tienda"
      footer={<>
        <Link to={`/tienda/${slug}/reembolsos`} style={styles.link}>Política de reembolsos</Link>
        <span style={{ color: '#cbd5e1' }}>·</span>
        <Link to={`/tienda/${slug}`} style={styles.link}>Volver a la tienda</Link>
      </>}
    >
      {!hasCustom && (
        <DraftBanner>
          este negocio aún no personalizó su aviso de privacidad — se muestra una plantilla
          genérica con sus datos públicos. Debe revisarla un abogado antes de considerarla
          definitiva.
        </DraftBanner>
      )}

      {hasCustom ? (
        <Section>
          <div style={{ whiteSpace: 'pre-line' }}>{business.storePrivacyNotice}</div>
        </Section>
      ) : (
        <>
          <Section title="Responsable de tus datos">
            <p>
              <strong>{business.name}</strong> es responsable del tratamiento de los datos
              personales que nos proporciones al hacer un pedido en esta tienda (nombre,
              teléfono, correo y dirección de entrega).
            </p>
            {business.address && <p>Domicilio: {business.address}</p>}
            {(business.phone || business.email) && (
              <p>
                Contacto: {business.phone && <span>{business.phone}</span>}
                {business.phone && business.email && ' · '}
                {business.email && <span>{business.email}</span>}
              </p>
            )}
          </Section>
          <Section title="Para qué usamos tus datos">
            <p>Para procesar y entregar tu pedido, contactarte sobre su estado, y llevar un registro de tus compras si eres cliente frecuente.</p>
          </Section>
          <Section title="Tus derechos">
            <p>Puedes solicitar acceso, corrección o eliminación de tus datos contactando directamente a este negocio con los datos de contacto de arriba.</p>
          </Section>
        </>
      )}

      <Section title="Sobre la plataforma">
        <p style={{ fontSize: 13, color: '#64748b' }}>
          Esta tienda opera sobre AutoBusiness AI, que actúa como encargado técnico del
          tratamiento de estos datos por cuenta de {business.name}. Ver el{' '}
          <Link to="/privacidad" style={styles.link}>aviso de privacidad de AutoBusiness AI</Link>.
        </p>
      </Section>
    </LegalPageLayout>
  )
}
