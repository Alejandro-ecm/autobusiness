import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { store as storeApi } from '../api'
import { LegalPageLayout, Section, DraftBanner, legalStyles as styles } from '../components/legal/LegalPageLayout'

export default function StoreRefundPolicy() {
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

  const hasCustom = business.storeRefundPolicy && business.storeRefundPolicy.trim()

  return (
    <LegalPageLayout
      title={`Política de Cambios y Devoluciones — ${business.name}`}
      backTo={`/tienda/${slug}`}
      backLabel="← Volver a la tienda"
      footer={<>
        <Link to={`/tienda/${slug}/privacidad`} style={styles.link}>Aviso de privacidad</Link>
        <span style={{ color: '#cbd5e1' }}>·</span>
        <Link to={`/tienda/${slug}`} style={styles.link}>Volver a la tienda</Link>
      </>}
    >
      {!hasCustom && (
        <DraftBanner>
          este negocio aún no personalizó su política de devoluciones — se muestra un texto
          genérico neutral. Debe revisarla un abogado antes de considerarla definitiva.
        </DraftBanner>
      )}

      {hasCustom ? (
        <Section>
          <div style={{ whiteSpace: 'pre-line' }}>{business.storeRefundPolicy}</div>
        </Section>
      ) : (
        <Section>
          <p>
            Consulta directamente con <strong>{business.name}</strong> sobre cambios y
            devoluciones de tu pedido — contáctanos con los datos de abajo dentro de un plazo
            razonable después de recibir tu compra, indicando tu número de pedido.
          </p>
          {(business.phone || business.email) && (
            <div style={styles.contactBox}>
              {business.phone && <p>Teléfono: {business.phone}</p>}
              {business.email && <p>Email: {business.email}</p>}
            </div>
          )}
        </Section>
      )}
    </LegalPageLayout>
  )
}
