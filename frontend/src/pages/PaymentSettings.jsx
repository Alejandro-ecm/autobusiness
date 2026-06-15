import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { mpSettings } from '../api'
import { useToast } from '../store/ToastContext'

export default function PaymentSettings() {
  const { show } = useToast()
  const [params] = useSearchParams()
  const [status, setStatus]         = useState(null)
  const [loading, setLoading]       = useState(true)
  const [disconnecting, setDisconnecting] = useState(false)
  const [updateOpen, setUpdateOpen] = useState(false)
  const [manualToken, setManualToken]     = useState('')
  const [manualPublicKey, setManualPublicKey] = useState('')
  const [saving, setSaving]         = useState(false)

  const loadStatus = () =>
    mpSettings.status()
      .then(s => { setStatus(s); if (s?.connected && !s?.mpPublicKey) setUpdateOpen(true) })
      .catch(() => show('Error al cargar configuración', 'error'))
      .finally(() => setLoading(false))

  useEffect(() => {
    loadStatus()
    if (params.get('mp_connected') === 'true') show('Mercado Pago conectado correctamente', 'success')
    if (params.get('mp_error') === 'true')     show('Error al conectar Mercado Pago. Intenta de nuevo.', 'error')
  }, [])

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await mpSettings.connectManual(manualToken.trim() || null, manualPublicKey.trim() || null)
      show('Credenciales guardadas correctamente', 'success')
      setManualToken('')
      setManualPublicKey('')
      setUpdateOpen(false)
      loadStatus()
    } catch (err) {
      show(err?.error || 'Token inválido. Verifica tus credenciales.', 'error')
    } finally { setSaving(false) }
  }

  const handleDisconnect = async () => {
    if (!window.confirm('¿Desconectar Mercado Pago? Los cobros online se pausarán hasta que lo reconectes.')) return
    setDisconnecting(true)
    try {
      await mpSettings.disconnect()
      show('Cuenta desconectada', 'success')
      setUpdateOpen(false)
      loadStatus()
    } catch { show('Error al desconectar', 'error') }
    finally { setDisconnecting(false) }
  }

  const needsPublicKey = status?.connected && !status?.mpPublicKey

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 16px 40px' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Configuración de Cobros</h1>
          <p className="page-subtitle">Configura cómo recibes pagos con tarjeta en tu negocio</p>
        </div>
      </div>

      {/* ── Guía rápida (siempre visible) ── */}
      <div className="card" style={{ marginBottom: 20, background: 'linear-gradient(135deg,#f0f9ff,#e0f2fe)', border: '1px solid #bae6fd' }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: '#0369a1', marginBottom: 12 }}>
          ¿Cómo funciona?
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { num: '1', txt: 'Entra a tu cuenta de Mercado Pago en mercadopago.com.mx', icon: '🌐' },
            { num: '2', txt: 'Ve a Tu app → Credenciales de producción', icon: '🔑' },
            { num: '3', txt: 'Copia el Access Token y el Public Key y pégalos abajo', icon: '📋' },
            { num: '4', txt: '¡Listo! Tus clientes podrán pagar con tarjeta directo en la caja', icon: '✅' },
          ].map(s => (
            <div key={s.num} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{
                minWidth: 28, height: 28, borderRadius: '50%', background: '#0369a1',
                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: 13
              }}>{s.num}</div>
              <div style={{ fontSize: 13, color: '#0c4a6e', paddingTop: 4, lineHeight: 1.5 }}>
                {s.icon} {s.txt}
              </div>
            </div>
          ))}
        </div>
        <a
          href="https://www.mercadopago.com.mx/developers/panel/app"
          target="_blank" rel="noopener noreferrer"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            marginTop: 14, padding: '8px 16px', borderRadius: 8,
            background: '#0369a1', color: '#fff', fontSize: 13, fontWeight: 600,
            textDecoration: 'none'
          }}>
          Ir al panel de Mercado Pago →
        </a>
      </div>

      {/* ── Mercado Pago ── */}
      <div className="card" style={{ marginBottom: 20 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: 'linear-gradient(135deg,#009ee3,#00ccff)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 26, flexShrink: 0
          }}>💳</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 17, color: '#0f172a' }}>Mercado Pago</div>
            <div style={{ fontSize: 13, color: '#1e293b', marginTop: 2 }}>
              Cobra con tarjeta, OXXO, transferencia y más
            </div>
          </div>
          {!loading && (
            <span style={{
              background: status?.connected ? '#dcfce7' : '#fee2e2',
              color: status?.connected ? '#16a34a' : '#dc2626',
              borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 600
            }}>
              {status?.connected ? 'Conectado' : 'Sin conectar'}
            </span>
          )}
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}>
            <div className="spinner" />
          </div>
        ) : status?.connected ? (
          <div>
            {/* Estado Access Token */}
            <div style={{
              background: '#f0fdf4', border: '1px solid #bbf7d0',
              borderRadius: 10, padding: '10px 14px', marginBottom: 10,
              display: 'flex', alignItems: 'center', gap: 10
            }}>
              <span style={{ fontSize: 18 }}>✅</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13, color: '#166534' }}>
                  Access Token activo — cobros de tienda online funcionando
                </div>
                {status.mpUserId && (
                  <div style={{ fontSize: 11, color: '#16a34a', marginTop: 2 }}>
                    Cuenta MP: {status.mpUserId}
                  </div>
                )}
              </div>
            </div>

            {/* Estado Public Key */}
            {status?.mpPublicKey ? (
              <div style={{
                background: '#f0fdf4', border: '1px solid #bbf7d0',
                borderRadius: 10, padding: '10px 14px', marginBottom: 16,
                display: 'flex', alignItems: 'center', gap: 10
              }}>
                <span style={{ fontSize: 18 }}>✅</span>
                <div style={{ fontWeight: 600, fontSize: 13, color: '#166534' }}>
                  Public Key activa — cobro con tarjeta en caja habilitado
                </div>
              </div>
            ) : (
              <div style={{
                background: '#fff7ed', border: '1.5px solid #fed7aa',
                borderRadius: 10, padding: '12px 14px', marginBottom: 16,
                display: 'flex', alignItems: 'flex-start', gap: 10
              }}>
                <span style={{ fontSize: 20 }}>⚠️</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#c2410c' }}>
                    Falta tu Public Key — la caja no puede cobrar con tarjeta aún
                  </div>
                  <div style={{ fontSize: 12, color: '#9a3412', marginTop: 3, lineHeight: 1.5 }}>
                    Agrega tu Public Key de producción para activar el cobro con tarjeta en el punto de venta.
                    En el panel de MP la encuentras junto al Access Token.
                  </div>
                </div>
              </div>
            )}

            {/* Sección actualizar credenciales */}
            <button
              onClick={() => setUpdateOpen(o => !o)}
              style={{
                background: 'none', border: '1.5px solid #e2e8f0', borderRadius: 8,
                padding: '8px 14px', cursor: 'pointer', fontWeight: 600, fontSize: 13,
                color: '#334155', width: '100%', textAlign: 'left',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between'
              }}>
              <span>{needsPublicKey ? '➕ Agregar Public Key' : '✏️ Actualizar credenciales'}</span>
              <span style={{ fontSize: 10, color: '#1e293b' }}>{updateOpen ? '▲' : '▼'}</span>
            </button>

            {updateOpen && (
              <form onSubmit={handleSave} style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{
                  background: '#f8fafc', borderRadius: 8, padding: '10px 14px',
                  fontSize: 12, color: '#475569', lineHeight: 1.6
                }}>
                  Obtén tus claves en{' '}
                  <a href="https://www.mercadopago.com.mx/developers/panel/app"
                    target="_blank" rel="noopener noreferrer" style={{ color: '#009ee3', fontWeight: 600 }}>
                    mercadopago.com.mx → Tu app → Credenciales de producción
                  </a>
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
                    Access Token de producción
                    <span style={{ fontWeight: 400, color: '#1e293b' }}> (deja vacío para no cambiar)</span>
                  </label>
                  <input
                    className="input"
                    value={manualToken}
                    onChange={e => setManualToken(e.target.value)}
                    placeholder="APP_USR-xxxxxxxx-xxxx-xxxx-..."
                    style={{ width: '100%', fontFamily: 'monospace', fontSize: 12 }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
                    Public Key de producción
                    <span style={{ color: '#ef4444' }}> *</span>
                    <span style={{ fontWeight: 400, color: '#1e293b' }}> — necesaria para cobrar con tarjeta en caja</span>
                  </label>
                  <input
                    className="input"
                    value={manualPublicKey}
                    onChange={e => setManualPublicKey(e.target.value)}
                    placeholder="APP_USR-xxxxxxxx-xxxx-xxxx-..."
                    style={{ width: '100%', fontFamily: 'monospace', fontSize: 12 }}
                  />
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={saving || (!manualToken && !manualPublicKey)}
                    style={{ flex: 1 }}>
                    {saving ? <div className="spinner" /> : 'Guardar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setUpdateOpen(false)}
                    style={{
                      padding: '8px 16px', borderRadius: 8, border: '1px solid #e2e8f0',
                      background: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13
                    }}>
                    Cancelar
                  </button>
                </div>
              </form>
            )}

            <div style={{ borderTop: '1px solid #f1f5f9', marginTop: 16, paddingTop: 12 }}>
              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                style={{
                  background: 'transparent', color: '#dc2626',
                  border: '1.5px solid #fca5a5', borderRadius: 8,
                  padding: '7px 14px', cursor: 'pointer', fontWeight: 600, fontSize: 12
                }}>
                {disconnecting ? 'Desconectando...' : 'Desconectar cuenta'}
              </button>
            </div>
          </div>
        ) : (
          /* ── No conectado: flujo inicial ── */
          <div>
            <p style={{ fontSize: 14, color: '#475569', marginBottom: 16, lineHeight: 1.6 }}>
              Conecta tu cuenta de Mercado Pago para cobrar con tarjeta en tu caja y recibir
              pagos online — el dinero llega directo a ti.
            </p>

            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 4 }}>
                  1. Access Token de producción <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <div style={{ fontSize: 11, color: '#1e293b', marginBottom: 6 }}>
                  Empieza con APP_USR-... — en el panel de MP en "Credenciales de producción"
                </div>
                <input
                  className="input"
                  value={manualToken}
                  onChange={e => setManualToken(e.target.value)}
                  placeholder="APP_USR-xxxxxxxx-xxxx-xxxx-..."
                  style={{ width: '100%', fontFamily: 'monospace', fontSize: 12 }}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 4 }}>
                  2. Public Key de producción <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <div style={{ fontSize: 11, color: '#1e293b', marginBottom: 6 }}>
                  También en "Credenciales de producción" — necesaria para que tus clientes ingresen su tarjeta en la caja
                </div>
                <input
                  className="input"
                  value={manualPublicKey}
                  onChange={e => setManualPublicKey(e.target.value)}
                  placeholder="APP_USR-xxxxxxxx-xxxx-xxxx-..."
                  style={{ width: '100%', fontFamily: 'monospace', fontSize: 12 }}
                />
              </div>

              <button
                type="submit"
                disabled={saving || !manualToken}
                style={{
                  background: 'linear-gradient(135deg,#009ee3,#0077b6)',
                  color: '#fff', border: 'none', borderRadius: 10,
                  padding: '13px 24px', cursor: 'pointer',
                  fontWeight: 700, fontSize: 15,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  boxShadow: '0 4px 14px rgba(0,158,227,0.35)',
                  opacity: (saving || !manualToken) ? 0.6 : 1
                }}>
                {saving ? <><div className="spinner" style={{ borderTopColor: '#fff' }} /> Guardando...</> : '💳 Conectar Mercado Pago'}
              </button>
            </form>
          </div>
        )}
      </div>

      {/* ── Bancos México ── */}
      <ComingSoonCard
        icon="🏦"
        gradient="linear-gradient(135deg,#1e3a5f,#2563eb)"
        title="Transferencia bancaria directa"
        subtitle="SPEI, CoDi — todos los bancos de México"
        features={['BBVA, Santander, Banamex, HSBC, Banorte y más','CoDi por QR en punto de venta','Depósito directo a tu CLABE']}
      />

      {/* ── Recargas ── */}
      <ComingSoonCard
        icon="📱"
        gradient="linear-gradient(135deg,#7c3aed,#a855f7)"
        title="Recargas de celular"
        subtitle="Telcel, AT&T, Movistar, Unefon y más"
        features={['Comisión para ti en cada recarga','Todas las operadoras de México','Integrado en tu punto de venta']}
      />
    </div>
  )
}

function ComingSoonCard({ icon, gradient, title, subtitle, features }) {
  return (
    <div className="card" style={{ marginBottom: 20, opacity: 0.85 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
        <div style={{
          width: 52, height: 52, borderRadius: 14, background: gradient,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 26, flexShrink: 0
        }}>{icon}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 17, color: '#0f172a' }}>{title}</div>
          <div style={{ fontSize: 13, color: '#1e293b', marginTop: 2 }}>{subtitle}</div>
        </div>
        <span style={{
          background: '#f1f5f9', color: '#1e293b', borderRadius: 20,
          padding: '4px 12px', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap'
        }}>Próximamente</span>
      </div>
      <ul style={{ margin: 0, paddingLeft: 20, color: '#1e293b', fontSize: 13, lineHeight: 2 }}>
        {features.map(f => <li key={f}>{f}</li>)}
      </ul>
    </div>
  )
}
