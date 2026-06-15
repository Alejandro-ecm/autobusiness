import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../store/AuthContext'
import client from '../api/client'

const SUPPORT_EMAIL = 'soporte@skytechnologieslatam.com'

export default function AccountDeletion() {
  const { user, logout } = useAuth()
  const [step, setStep] = useState('info')   // 'info' | 'confirm' | 'done' | 'error'
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [confirmText, setConfirmText] = useState('')

  const handleDelete = async () => {
    if (confirmText.trim().toUpperCase() !== 'ELIMINAR') {
      setErrorMsg('Escribe ELIMINAR para confirmar.')
      return
    }
    setLoading(true)
    setErrorMsg('')
    try {
      await client.delete('/auth/account')
      logout()
      setStep('done')
    } catch (err) {
      // If the endpoint doesn't exist yet, show email fallback
      const status = err?.response?.status
      if (status === 404 || status === 405) {
        setStep('email-fallback')
      } else {
        setErrorMsg(
          err?.response?.data?.error ||
          'No se pudo eliminar la cuenta. Por favor, contacta a soporte.'
        )
      }
    } finally {
      setLoading(false)
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
            Esta acción es permanente e irreversible.
          </p>
        </div>

        {/* Step: Info */}
        {step === 'info' && (
          <div style={styles.card}>
            <div style={styles.warningBanner}>
              <span style={styles.warningIcon}>&#9888;</span>
              <strong>Advertencia: acción permanente</strong>
            </div>

            <p style={styles.bodyText}>
              Al eliminar tu cuenta de <strong>AutoBusiness AI</strong>, se borrarán
              de forma <strong>permanente e irreversible</strong> los siguientes datos:
            </p>

            <ul style={styles.list}>
              <li>Tu perfil de usuario y credenciales de acceso</li>
              <li>Todos los datos de tu negocio (nombre, configuración, sucursales)</li>
              <li>Inventario completo (productos, categorías, movimientos)</li>
              <li>Historial de ventas y pedidos en línea</li>
              <li>Datos de clientes registrados en tu cuenta</li>
              <li>Usuarios internos (administradores, cajeros)</li>
              <li>Análisis financieros e insights generados por IA</li>
            </ul>

            <div style={styles.infoBox}>
              <p style={{ margin: 0 }}>
                <strong>Suscripciones activas:</strong> Si tienes una suscripción de pago activa,
                cancela tu plan antes de eliminar la cuenta para evitar cargos futuros. La eliminación
                de cuenta no cancela automáticamente los cargos recurrentes de MercadoPago.
              </p>
            </div>

            <p style={styles.bodyText}>
              Los datos se eliminan en un plazo máximo de <strong>30 días</strong> desde la solicitud.
              Algunos datos pueden retenerse si la ley fiscal mexicana lo requiere (hasta 5 años).
            </p>

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
                Vas a eliminar la cuenta de <strong>{user.email}</strong> y todos los datos del
                negocio <strong>{user.businessName || 'tu negocio'}</strong>.
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
                {loading ? 'Eliminando...' : 'Eliminar cuenta definitivamente'}
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

        {/* Step: Done */}
        {step === 'done' && (
          <div style={styles.card}>
            <div style={styles.successBanner}>
              <span style={{ fontSize: 32 }}>&#10003;</span>
              <strong>Cuenta eliminada</strong>
            </div>
            <p style={styles.bodyText}>
              Tu cuenta y todos los datos asociados han sido marcados para eliminación.
              El proceso se completará en un plazo máximo de <strong>30 días</strong>.
            </p>
            <p style={styles.bodyText}>
              Si tienes dudas, escríbenos a{' '}
              <a href={`mailto:${SUPPORT_EMAIL}`} style={styles.link}>{SUPPORT_EMAIL}</a>.
            </p>
          </div>
        )}

        {/* Step: Email fallback (endpoint not yet implemented) */}
        {step === 'email-fallback' && (
          <div style={styles.card}>
            <div style={styles.infoBox} style={{ ...styles.infoBox, marginBottom: 20 }}>
              <strong>Solicitud recibida</strong>
            </div>
            <p style={styles.bodyText}>
              Para completar la eliminación de tu cuenta, envía un correo desde la dirección
              registrada en tu cuenta a:
            </p>
            <div style={styles.emailBox}>
              <a href={`mailto:${SUPPORT_EMAIL}?subject=Solicitud%20eliminaci%C3%B3n%20de%20cuenta`}
                style={styles.emailLink}>
                {SUPPORT_EMAIL}
              </a>
            </div>
            <p style={styles.bodyText}>
              Asunto: <strong>Solicitud eliminación de cuenta</strong><br />
              Incluye en el cuerpo: tu email registrado y el nombre de tu negocio.
            </p>
            <p style={styles.bodyText}>
              Procesaremos la solicitud en un plazo máximo de <strong>72 horas hábiles</strong>.
            </p>
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
  emailBox: {
    background: '#f8fafc',
    border: '1.5px solid #e2e8f0',
    borderRadius: 10,
    padding: '14px',
    textAlign: 'center',
    margin: '12px 0',
  },
  emailLink: {
    color: '#6366f1',
    fontWeight: 700,
    fontSize: 15,
    textDecoration: 'none',
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
