import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../store/AuthContext'
import { auth as authApi } from '../api'

const SUPPORT_EMAIL = 'soporte@skytechnologieslatam.com'

const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }) : ''

export default function AccountDeletion() {
  const { user, updateUser } = useAuth()
  const pendingDeletion = !!user?.deletionRequestedAt
  const [step, setStep] = useState(pendingDeletion ? 'pending' : 'info')   // 'info' | 'confirm' | 'pending' | 'done' | 'cancelled'
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [confirmText, setConfirmText] = useState('')
  const [scheduledFor, setScheduledFor] = useState(user?.deletionScheduledFor || null)
  const [exporting, setExporting] = useState(false)

  const handleDelete = async () => {
    if (confirmText.trim().toUpperCase() !== 'ELIMINAR') {
      setErrorMsg('Escribe ELIMINAR para confirmar.')
      return
    }
    setLoading(true)
    setErrorMsg('')
    try {
      const res = await authApi.requestDeletion()
      setScheduledFor(res.deletionScheduledFor)
      updateUser({ deletionRequestedAt: res.deletionRequestedAt, deletionScheduledFor: res.deletionScheduledFor })
      setStep('done')
    } catch (err) {
      setErrorMsg(err?.error || 'No se pudo procesar la solicitud. Por favor, contacta a soporte.')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = async () => {
    setLoading(true)
    setErrorMsg('')
    try {
      await authApi.cancelDeletion()
      updateUser({ deletionRequestedAt: null, deletionScheduledFor: null })
      setStep('cancelled')
    } catch (err) {
      setErrorMsg(err?.error || 'No se pudo cancelar la solicitud. Por favor, contacta a soporte.')
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const data = await authApi.exportData()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `mis-datos-autobusiness-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(a.href)
    } catch {
      setErrorMsg('No se pudieron descargar tus datos. Intenta de nuevo.')
    } finally {
      setExporting(false)
    }
  }

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
          <h1 style={styles.title}>Eliminar mi cuenta</h1>
          <p style={styles.subtitle}>
            Tienes 30 días para cancelar tu solicitud antes de que se haga efectiva.
          </p>
        </div>

        {/* Descargar mis datos — disponible siempre que haya sesión, sin importar el paso */}
        {user && step !== 'pending' && (
          <div style={{ ...styles.card, textAlign: 'center' }}>
            <p style={styles.bodyText}>
              ¿Solo quieres una copia de tus datos? Puedes descargarlos sin eliminar tu cuenta.
            </p>
            <button style={styles.btnOutline} onClick={handleExport} disabled={exporting}>
              {exporting ? 'Preparando descarga...' : '⬇ Descargar mis datos (JSON)'}
            </button>
          </div>
        )}

        {/* Step: Info */}
        {step === 'info' && (
          <div style={styles.card}>
            <div style={styles.warningBanner}>
              <span style={styles.warningIcon}>&#9888;</span>
              <strong>Antes de continuar</strong>
            </div>

            <p style={styles.bodyText}>
              Al solicitar la eliminación de tu cuenta de <strong>AutoBusiness AI</strong>, en
              <strong> 30 días</strong> se anonimizarán de forma permanente los siguientes datos
              (puedes cancelar la solicitud en cualquier momento antes de esa fecha):
            </p>

            <ul style={styles.list}>
              <li>Tu perfil de usuario y credenciales de acceso</li>
              <li>Todos los datos de tu negocio (nombre, configuración, sucursales)</li>
              <li>Usuarios internos (administradores, cajeros)</li>
              <li>Datos de clientes registrados en tu cuenta</li>
            </ul>

            <p style={styles.bodyText}>
              Tu inventario, ventas y pedidos <strong>no se borran</strong> — la ley fiscal
              mexicana exige conservarlos hasta 5 años. Quedan desvinculados de tu nombre real
              (anonimizados), no de tu negocio como registro contable.
            </p>

            <div style={styles.infoBox}>
              <p style={{ margin: 0 }}>
                <strong>Suscripciones activas:</strong> Si tienes una suscripción de pago activa,
                cancela tu plan antes de eliminar la cuenta para evitar cargos futuros. La eliminación
                de cuenta no cancela automáticamente los cargos recurrentes de MercadoPago.
              </p>
            </div>

            <div style={styles.actions}>
              {user ? (
                <button
                  style={styles.btnDanger}
                  onClick={() => setStep('confirm')}
                >
                  Continuar con la eliminación
                </button>
              ) : (
                <div style={{ textAlign: 'center' }}>
                  <p style={styles.bodyText}>
                    Para eliminar tu cuenta, primero inicia sesión o envía un correo a:
                  </p>
                  <a href={`mailto:${SUPPORT_EMAIL}?subject=Solicitud%20eliminaci%C3%B3n%20de%20cuenta&body=Por%20favor%20elimina%20mi%20cuenta%20de%20AutoBusiness%20AI.%0A%0AEmail%20de%20la%20cuenta%3A%20`}
                    style={styles.btnOutline}>
                    Solicitar por email
                  </a>
                  <div style={{ marginTop: 12 }}>
                    <Link to="/login" style={styles.btnPrimary}>Iniciar sesión para eliminar</Link>
                  </div>
                </div>
              )}
              <Link to="/" style={styles.cancelLink}>Cancelar — conservar mi cuenta</Link>
            </div>
          </div>
        )}

        {/* Step: Confirm */}
        {step === 'confirm' && (
          <div style={styles.card}>
            <div style={styles.warningBanner}>
              <span style={styles.warningIcon}>&#9888;</span>
              <strong>Confirma la eliminación</strong>
            </div>

            {user && (
              <p style={styles.bodyText}>
                Vas a solicitar la eliminación de la cuenta <strong>{user.email}</strong> y del
                negocio <strong>{user.businessName || 'tu negocio'}</strong>. Tendrás 30 días
                para cancelar antes de que se haga efectiva.
              </p>
            )}

            <p style={styles.bodyText}>
              Escribe <strong>ELIMINAR</strong> en el campo de abajo para confirmar:
            </p>

            <input
              type="text"
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              placeholder="Escribe ELIMINAR"
              style={styles.confirmInput}
              autoComplete="off"
            />

            {errorMsg && (
              <div style={styles.errorBox}>{errorMsg}</div>
            )}

            <div style={styles.actions}>
              <button
                style={loading ? { ...styles.btnDanger, opacity: 0.6, cursor: 'not-allowed' } : styles.btnDanger}
                onClick={handleDelete}
                disabled={loading}
              >
                {loading ? 'Enviando solicitud...' : 'Solicitar eliminación de cuenta'}
              </button>
              <button
                style={styles.cancelLink}
                onClick={() => { setStep('info'); setConfirmText(''); setErrorMsg('') }}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Step: Done — solicitud enviada, con fecha real y opción de cancelar */}
        {step === 'done' && (
          <div style={styles.card}>
            <div style={styles.successBanner}>
              <span style={{ fontSize: 32 }}>&#10003;</span>
              <strong>Solicitud registrada</strong>
            </div>
            <p style={styles.bodyText}>
              Tu cuenta se eliminará el <strong>{fmtDate(scheduledFor)}</strong> si no cancelas
              antes. Antes de esa fecha, tu negocio sigue funcionando con normalidad.
            </p>
            {errorMsg && <div style={styles.errorBox}>{errorMsg}</div>}
            <div style={styles.actions}>
              <button
                style={loading ? { ...styles.btnOutline, opacity: 0.6, cursor: 'not-allowed' } : styles.btnOutline}
                onClick={handleCancel}
                disabled={loading}
              >
                {loading ? 'Cancelando...' : 'Cancelar la eliminación'}
              </button>
            </div>
            <p style={styles.bodyText}>
              Si tienes dudas, escríbenos a{' '}
              <a href={`mailto:${SUPPORT_EMAIL}`} style={styles.link}>{SUPPORT_EMAIL}</a>.
            </p>
          </div>
        )}

        {/* Step: Pending — ya existía una solicitud activa al entrar a esta pagina */}
        {step === 'pending' && (
          <div style={styles.card}>
            <div style={styles.warningBanner}>
              <span style={styles.warningIcon}>&#9888;</span>
              <strong>Eliminación programada</strong>
            </div>
            <p style={styles.bodyText}>
              Ya solicitaste eliminar la cuenta de <strong>{user?.businessName || 'tu negocio'}</strong>.
              Se eliminará el <strong>{fmtDate(scheduledFor)}</strong> si no cancelas antes.
            </p>
            {errorMsg && <div style={styles.errorBox}>{errorMsg}</div>}
            <div style={styles.actions}>
              <button
                style={loading ? { ...styles.btnDanger, opacity: 0.6, cursor: 'not-allowed' } : styles.btnDanger}
                onClick={handleCancel}
                disabled={loading}
              >
                {loading ? 'Cancelando...' : 'Cancelar la eliminación'}
              </button>
              <Link to="/" style={styles.cancelLink}>Volver al inicio</Link>
            </div>
          </div>
        )}

        {/* Step: Cancelled */}
        {step === 'cancelled' && (
          <div style={styles.card}>
            <div style={styles.successBanner}>
              <span style={{ fontSize: 32 }}>&#10003;</span>
              <strong>Eliminación cancelada</strong>
            </div>
            <p style={styles.bodyText}>
              Tu cuenta y la de <strong>{user?.businessName || 'tu negocio'}</strong> siguen
              activas con normalidad.
            </p>
            <div style={styles.actions}>
              <Link to="/" style={styles.btnPrimary}>Volver al inicio</Link>
            </div>
          </div>
        )}

        {/* Alternative: contact support */}
        {step !== 'done' && (
          <div style={styles.altContact}>
            <p style={{ margin: 0, fontSize: 13, color: '#1e293b' }}>
              ¿Prefieres contactar a soporte?{' '}
              <a href={`mailto:${SUPPORT_EMAIL}?subject=Solicitud%20eliminaci%C3%B3n%20de%20cuenta`}
                style={styles.link}>
                {SUPPORT_EMAIL}
              </a>
            </p>
          </div>
        )}

        {/* Footer */}
        <div style={styles.footer}>
          <Link to="/privacy-policy" style={styles.link}>Política de Privacidad</Link>
          <span style={{ color: '#cbd5e1' }}>·</span>
          <Link to="/terms" style={styles.link}>Términos de Servicio</Link>
          <span style={{ color: '#cbd5e1' }}>·</span>
          <Link to="/login" style={styles.link}>Iniciar sesión</Link>
        </div>
      </div>
    </div>
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
    maxWidth: 600,
    margin: '0 auto',
    padding: '40px 24px 64px',
  },
  header: {
    textAlign: 'center',
    marginBottom: 32,
    paddingBottom: 28,
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
    fontSize: 26,
    fontWeight: 800,
    color: '#0f172a',
    margin: '0 0 8px',
  },
  subtitle: {
    fontSize: 14,
    color: '#ef4444',
    margin: 0,
    fontWeight: 600,
  },
  card: {
    background: '#fff',
    border: '1.5px solid #e2e8f0',
    borderRadius: 16,
    padding: '28px 28px 24px',
    marginBottom: 20,
  },
  warningBanner: {
    background: '#fff7ed',
    border: '1.5px solid #fed7aa',
    color: '#c2410c',
    borderRadius: 10,
    padding: '12px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
    fontSize: 14,
    fontWeight: 600,
  },
  warningIcon: {
    fontSize: 18,
  },
  successBanner: {
    background: '#f0fdf4',
    border: '1.5px solid #bbf7d0',
    color: '#15803d',
    borderRadius: 10,
    padding: '12px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
    fontSize: 14,
    fontWeight: 600,
  },
  infoBox: {
    background: '#eff6ff',
    border: '1px solid #bfdbfe',
    color: '#1e40af',
    borderRadius: 10,
    padding: '12px 16px',
    fontSize: 13,
    lineHeight: 1.6,
    marginTop: 16,
    marginBottom: 16,
  },
  bodyText: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 1.7,
    margin: '0 0 12px',
  },
  list: {
    margin: '8px 0 16px',
    paddingLeft: 20,
    fontSize: 14,
    color: '#334155',
    lineHeight: 1.8,
  },
  actions: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    marginTop: 24,
    alignItems: 'stretch',
  },
  btnDanger: {
    background: '#ef4444',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    padding: '13px 20px',
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    textAlign: 'center',
    transition: 'opacity 0.15s',
  },
  btnPrimary: {
    display: 'inline-block',
    background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    padding: '12px 20px',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    textAlign: 'center',
    textDecoration: 'none',
    marginTop: 8,
  },
  btnOutline: {
    display: 'inline-block',
    background: '#fff',
    color: '#6366f1',
    border: '2px solid #6366f1',
    borderRadius: 10,
    padding: '11px 20px',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    textAlign: 'center',
    textDecoration: 'none',
  },
  cancelLink: {
    background: 'none',
    border: 'none',
    color: '#1e293b',
    fontSize: 13,
    cursor: 'pointer',
    textAlign: 'center',
    padding: '8px 0',
    textDecoration: 'none',
    display: 'block',
  },
  confirmInput: {
    width: '100%',
    boxSizing: 'border-box',
    border: '2px solid #fca5a5',
    borderRadius: 10,
    padding: '11px 14px',
    fontSize: 15,
    color: '#0f172a',
    outline: 'none',
    marginTop: 4,
  },
  errorBox: {
    background: '#fef2f2',
    border: '1px solid #fecaca',
    color: '#dc2626',
    borderRadius: 10,
    padding: '10px 14px',
    fontSize: 13,
    marginTop: 12,
  },
  altContact: {
    textAlign: 'center',
    padding: '16px 0',
  },
  link: {
    color: '#6366f1',
    textDecoration: 'none',
    fontWeight: 500,
  },
  footer: {
    marginTop: 32,
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
