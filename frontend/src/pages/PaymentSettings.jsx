import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { mpSettings } from '../api'
import { useToast } from '../store/ToastContext'

export default function PaymentSettings() {
  const { show } = useToast()
  const [params] = useSearchParams()
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [manualOpen, setManualOpen] = useState(false)
  const [manualToken, setManualToken] = useState('')
  const [savingManual, setSavingManual] = useState(false)

  const loadStatus = () =>
    mpSettings.status()
      .then(setStatus)
      .catch(() => show('Error al cargar configuración', 'error'))
      .finally(() => setLoading(false))

  useEffect(() => {
    loadStatus()
    if (params.get('mp_connected') === 'true') show('Mercado Pago conectado correctamente', 'success')
    if (params.get('mp_error') === 'true')     show('Error al conectar Mercado Pago. Intenta de nuevo.', 'error')
  }, [])

  const handleOAuth = async () => {
    setConnecting(true)
    try {
      const { url } = await mpSettings.connectUrl()
      const w = 520, h = 700
      const left = Math.round(window.screenX + (window.outerWidth - w) / 2)
      const top  = Math.round(window.screenY + (window.outerHeight - h) / 2)
      const popup = window.open(url, 'mp_oauth',
        `width=${w},height=${h},left=${left},top=${top},toolbar=no,menubar=no`)
      // Escuchar cuando el popup cierre para refrescar el estado
      const timer = setInterval(() => {
        if (popup?.closed) {
          clearInterval(timer)
          setConnecting(false)
          loadStatus()
        }
      }, 800)
    } catch (err) {
      show(err?.error || 'Error al obtener URL de conexión', 'error')
      setConnecting(false)
    }
  }

  const handleManual = async (e) => {
    e.preventDefault()
    setSavingManual(true)
    try {
      await mpSettings.connectManual(manualToken.trim())
      show('Mercado Pago conectado correctamente', 'success')
      setManualToken('')
      setManualOpen(false)
      loadStatus()
    } catch (err) {
      show(err?.error || 'Token inválido', 'error')
    } finally { setSavingManual(false) }
  }

  const handleDisconnect = async () => {
    if (!window.confirm('¿Desconectar tu cuenta de Mercado Pago? Los clientes no podrán pagar online hasta que la reconectes.')) return
    setDisconnecting(true)
    try {
      await mpSettings.disconnect()
      show('Cuenta de Mercado Pago desconectada', 'success')
      loadStatus()
    } catch { show('Error al desconectar', 'error') }
    finally { setDisconnecting(false) }
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 16px 40px' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Configuración de Cobros</h1>
          <p className="page-subtitle">Conecta métodos de pago para recibir dinero directamente en tu cuenta</p>
        </div>
      </div>

      {/* ── Mercado Pago ── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: 'linear-gradient(135deg,#009ee3,#00ccff)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 26, flexShrink: 0
          }}>💳</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 17, color: '#0f172a' }}>Mercado Pago</div>
            <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
              Tarjetas, transferencia SPEI, OXXO, CoDi y más
            </div>
          </div>
          {!loading && status?.connected && (
            <span style={{
              background: '#dcfce7', color: '#16a34a', borderRadius: 20,
              padding: '4px 12px', fontSize: 12, fontWeight: 600
            }}>Conectado</span>
          )}
          {!loading && !status?.connected && (
            <span style={{
              background: '#fee2e2', color: '#dc2626', borderRadius: 20,
              padding: '4px 12px', fontSize: 12, fontWeight: 600
            }}>Sin conectar</span>
          )}
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}>
            <div className="spinner" />
          </div>
        ) : status?.connected ? (
          <div>
            <div style={{
              background: '#f0fdf4', border: '1px solid #bbf7d0',
              borderRadius: 12, padding: '12px 16px', marginBottom: 16,
              display: 'flex', alignItems: 'center', gap: 10
            }}>
              <span style={{ fontSize: 20 }}>✅</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, color: '#166534' }}>
                  Cuenta conectada — ID: {status.mpUserId}
                </div>
                <div style={{ fontSize: 12, color: '#16a34a' }}>
                  Los pagos de tu tienda llegan directo a tu cuenta de Mercado Pago
                </div>
              </div>
            </div>
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              style={{
                background: 'transparent', color: '#dc2626',
                border: '1.5px solid #fca5a5', borderRadius: 8,
                padding: '8px 16px', cursor: 'pointer', fontWeight: 600, fontSize: 13
              }}>
              {disconnecting ? 'Desconectando...' : 'Desconectar cuenta'}
            </button>
          </div>
        ) : (
          <div>
            <p style={{ fontSize: 14, color: '#475569', marginBottom: 16, lineHeight: 1.6 }}>
              Conecta tu cuenta de Mercado Pago para que cuando tus clientes compren en tu tienda,
              el dinero llegue directo a ti — sin intermediarios.
            </p>

            {/* Botón OAuth (si está habilitado en la plataforma) */}
            {status?.oauthEnabled ? (
              <button
                onClick={handleOAuth}
                disabled={connecting}
                style={{
                  background: 'linear-gradient(135deg,#009ee3,#0077b6)',
                  color: '#fff', border: 'none', borderRadius: 10,
                  padding: '12px 24px', cursor: 'pointer',
                  fontWeight: 700, fontSize: 15, width: '100%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  boxShadow: '0 4px 14px rgba(0,158,227,0.4)',
                  transition: 'opacity .2s', opacity: connecting ? .6 : 1
                }}>
                {connecting
                  ? <><div className="spinner" style={{ borderTopColor: '#fff' }} /> Conectando...</>
                  : <><span>💳</span> Conectar con Mercado Pago</>}
              </button>
            ) : (
              /* Token manual (cuando OAuth no está configurado en Render) */
              <div>
                <button
                  onClick={() => setManualOpen(o => !o)}
                  style={{
                    background: 'linear-gradient(135deg,#009ee3,#0077b6)',
                    color: '#fff', border: 'none', borderRadius: 10,
                    padding: '12px 24px', cursor: 'pointer',
                    fontWeight: 700, fontSize: 15, width: '100%',
                    boxShadow: '0 4px 14px rgba(0,158,227,0.4)'
                  }}>
                  💳 Conectar Mercado Pago
                </button>
                {manualOpen && (
                  <form onSubmit={handleManual} style={{ marginTop: 16 }}>
                    <div style={{ marginBottom: 8, fontSize: 13, color: '#475569' }}>
                      Ve a{' '}
                      <a href="https://www.mercadopago.com.mx/developers/panel/credentials"
                        target="_blank" rel="noopener noreferrer"
                        style={{ color: '#009ee3' }}>
                        mercadopago.com.mx → Credenciales
                      </a>
                      {' '}y copia tu <strong>Access Token de producción</strong> (empieza con APP_USR-)
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        className="input"
                        value={manualToken}
                        onChange={e => setManualToken(e.target.value)}
                        placeholder="APP_USR-xxxxxxxxxxxxxxxx"
                        style={{ flex: 1, fontFamily: 'monospace', fontSize: 13 }}
                        required
                      />
                      <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={savingManual || !manualToken}>
                        {savingManual ? <div className="spinner" /> : 'Guardar'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
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
          <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>{subtitle}</div>
        </div>
        <span style={{
          background: '#f1f5f9', color: '#94a3b8', borderRadius: 20,
          padding: '4px 12px', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap'
        }}>Próximamente</span>
      </div>
      <ul style={{ margin: 0, paddingLeft: 20, color: '#64748b', fontSize: 13, lineHeight: 2 }}>
        {features.map(f => <li key={f}>{f}</li>)}
      </ul>
    </div>
  )
}
