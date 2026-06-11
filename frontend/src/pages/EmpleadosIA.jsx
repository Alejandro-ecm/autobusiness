import { useState, useEffect, useRef, useCallback } from 'react'
import { aiEmployees, whatsapp, instagram, business } from '../api'
import { useToast } from '../store/ToastContext'
import './EmpleadosIA.css'

const EMPLEADOS = [
  // ── WhatsApp (verde) ──
  {
    id: 'vendedor',
    nombre: 'Vendedor IA',
    canal: 'whatsapp',
    foto: '/vendedora-ia.webp',
    estado: 'activo',
    descripcion: 'Responde automáticamente las consultas de tu WhatsApp las 24hs del día.',
  },
  {
    id: 'cobrador',
    nombre: 'Cobrador IA',
    canal: 'whatsapp',
    foto: '/cobrador-ia.avif',
    estado: 'activo',
    descripcion: 'Recuerda cada mañana a tus clientes con fiado pendiente que abonen, y les responde «¿cuánto debo?» con su saldo real.',
  },
  {
    id: 'repositor',
    nombre: 'Repositor IA',
    canal: 'whatsapp',
    foto: '/repositor-ia.webp',
    estado: 'activo',
    descripcion: 'Te manda cada mañana el reporte de stock bajo a tu propio WhatsApp y te avisa al instante cuando un producto se agota.',
    conCodigo: true,
  },
  // ── Instagram (rosa/morado) ──
  {
    id: 'vendedor_ig',
    nombre: 'Vendedor IA',
    canal: 'instagram',
    foto: '/vendedora-ia.webp',
    estado: 'activo',
    descripcion: 'Responde automáticamente los mensajes directos (DM) de tu Instagram Business.',
  },
  {
    id: 'cobrador_ig',
    nombre: 'Cobrador IA',
    canal: 'instagram',
    foto: '/cobrador-ia.avif',
    estado: 'activo',
    descripcion: 'Responde por DM «¿cuánto debo?» — el cliente manda su teléfono y recibe su saldo de fiado real.',
  },
  {
    id: 'repositor_ig',
    nombre: 'Repositor IA',
    canal: 'instagram',
    foto: '/repositor-ia.webp',
    estado: 'activo',
    descripcion: 'Mándale «inventario + tu código» por DM y te responde el reporte de stock al momento.',
    conCodigo: true,
  },
]

const WA_STATUS_LABEL = {
  connected:    { text: 'WhatsApp conectado', color: '#047857' },
  qr:           { text: 'Esperando escaneo de QR', color: '#b45309' },
  connecting:   { text: 'Conectando…', color: '#b45309' },
  paused:       { text: 'Sesión vinculada (reconectando)', color: '#b45309' },
  disconnected: { text: 'WhatsApp sin conectar', color: '#64748b' },
}

export default function EmpleadosIA() {
  const toast = useToast()
  const [activos, setActivos] = useState({})
  const [waStatus, setWaStatus] = useState({ status: 'disconnected' })
  const [igStatus, setIgStatus] = useState({ connected: false })
  const [qrModal, setQrModal] = useState(false)
  const [testModal, setTestModal] = useState(false)
  const [adminCode, setAdminCode] = useState('')
  const pollRef = useRef(null)

  // Estado inicial: empleados + conexiones
  useEffect(() => {
    aiEmployees.list()
      .then(res => setActivos(res.employees || {}))
      .catch(() => {})
    whatsapp.status()
      .then(setWaStatus)
      .catch(() => {})
    instagram.status()
      .then(setIgStatus)
      .catch(() => {})
    business.deliveryCode()
      .then(res => setAdminCode(res.deliveryCode || ''))
      .catch(() => {})

    // Regreso del OAuth de Instagram
    const params = new URLSearchParams(window.location.search)
    if (params.get('ig_connected')) {
      toast.show('📸 Instagram conectado — tu Vendedor IA ya puede responder DMs', 'success')
      window.history.replaceState({}, '', window.location.pathname)
    } else if (params.get('ig_error')) {
      toast.show('No se pudo conectar Instagram — intenta de nuevo', 'error')
      window.history.replaceState({}, '', window.location.pathname)
    }

    return () => clearInterval(pollRef.current)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const startPolling = useCallback(() => {
    clearInterval(pollRef.current)
    pollRef.current = setInterval(async () => {
      try {
        const st = await whatsapp.status()
        setWaStatus(st)
        if (st.status === 'connected') {
          clearInterval(pollRef.current)
          toast.show('✅ WhatsApp conectado — tu Vendedor IA ya puede responder', 'success')
        }
      } catch { /* siguiente intento */ }
    }, 2500)
  }, [toast])

  const openConnect = async () => {
    setQrModal(true)
    try {
      const st = await whatsapp.connect()
      setWaStatus(st)
      startPolling()
    } catch (e) {
      toast.show(e?.error || 'El servicio de WhatsApp no está disponible todavía', 'error')
      setQrModal(false)
    }
  }

  const closeQrModal = () => {
    setQrModal(false)
    clearInterval(pollRef.current)
  }

  const disconnectWA = async () => {
    try {
      await whatsapp.logout()
      setWaStatus({ status: 'disconnected' })
      toast.show('WhatsApp desconectado')
    } catch (e) {
      toast.show(e?.error || 'No se pudo desconectar', 'error')
    }
  }

  const connectInstagram = async () => {
    try {
      const res = await instagram.connectUrl()
      window.location.href = res.url
    } catch (e) {
      toast.show(e?.error || 'La conexión con Instagram aún no está disponible', 'error')
    }
  }

  const disconnectInstagram = async () => {
    try {
      await instagram.disconnect()
      setIgStatus({ connected: false })
      toast.show('Instagram desconectado')
    } catch (e) {
      toast.show(e?.error || 'No se pudo desconectar', 'error')
    }
  }

  const toggle = async (emp) => {
    if (emp.estado !== 'activo') {
      toast.show(`${emp.nombre} estará disponible muy pronto.`)
      return
    }
    const next = !activos[emp.id]
    setActivos(prev => ({ ...prev, [emp.id]: next })) // optimista
    try {
      await aiEmployees.toggle(emp.id, next)
      const canalConectado = emp.canal === 'instagram' ? igStatus.connected : waStatus.status === 'connected'
      if (next && !canalConectado) {
        toast.show(`Activado — conecta tu ${emp.canal === 'instagram' ? 'Instagram' : 'WhatsApp'} para que empiece a responder`, 'success')
      } else {
        toast.show(next ? `${emp.nombre} activado ✅` : `${emp.nombre} pausado`)
      }
    } catch (e) {
      setActivos(prev => ({ ...prev, [emp.id]: !next })) // revertir
      toast.show(e?.error || 'No se pudo guardar el cambio', 'error')
    }
  }

  const connected = waStatus.status === 'connected'
  const statusInfo = WA_STATUS_LABEL[waStatus.status] || WA_STATUS_LABEL.disconnected

  return (
    <div className="empia-page">
      <div className="page-header">
        <h1 className="page-title">Empleados IA</h1>
        <p className="page-subtitle">Automatiza la operación de tu negocio con Empleados IA</p>
      </div>

      {/* Banner destacado */}
      <div className="empia-banner">
        <img className="empia-banner-art" src="/empleados-ia-banner.webp" alt="Empleados IA" />
        <div className="empia-banner-text">
          <h2>Haz que la IA responda WhatsApp e Instagram por ti</h2>
          <p>Tu Vendedor IA responde automáticamente 24/7 preguntas de clientes sobre productos, precios y stock.</p>
          <div className="empia-wa-row">
            {connected ? (
              <>
                <span className="empia-wa-connected">
                  ✅ WhatsApp conectado{waStatus.phone ? `: +${waStatus.phone}` : ''}
                </span>
                <button className="empia-banner-btn empia-banner-btn--outline" onClick={disconnectWA}>
                  Desconectar
                </button>
              </>
            ) : (
              <button className="empia-banner-btn" onClick={openConnect}>
                Conectar mi WhatsApp
              </button>
            )}
            {igStatus.connected ? (
              <span className="empia-wa-connected">📸 Instagram: @{igStatus.username}</span>
            ) : (
              <button className="empia-banner-btn empia-banner-btn--ig" onClick={connectInstagram}>
                Conectar mi Instagram
              </button>
            )}
            <span className="empia-wa-status" style={{ color: statusInfo.color }}>
              {!connected && statusInfo.text}
            </span>
          </div>
        </div>
      </div>

      {/* Tarjetas de empleados */}
      <div className="empia-grid">
        {EMPLEADOS.map(emp => {
          const on = !!activos[emp.id]
          const disponible = emp.estado === 'activo'
          const esIG = emp.canal === 'instagram'
          const canalConectado = esIG ? igStatus.connected : connected
          return (
            <div key={emp.id} className={`card empia-card${emp.canal ? ` empia-card--${emp.canal}` : ''}`}>
              <div className="empia-avatar-wrap">
                {emp.foto
                  ? <img className="empia-avatar empia-avatar--img" src={emp.foto} alt={emp.nombre} />
                  : <div className="empia-avatar">{emp.avatar}</div>}
                {disponible && on && <span className="empia-avatar-badge">✓</span>}
                {emp.canal && (
                  <span className={`empia-canal-badge empia-canal-badge--${emp.canal}`}>
                    {esIG ? '📸' : '💬'}
                  </span>
                )}
              </div>

              <div className="empia-card-head">
                <h3>
                  {emp.nombre}
                  {emp.canal && <span className="empia-canal-label">{esIG ? ' · Instagram' : ' · WhatsApp'}</span>}
                </h3>
                <span className={`empia-tag ${disponible ? (on ? 'empia-tag--activo' : 'empia-tag--paused') : 'empia-tag--soon'}`}>
                  {disponible ? (on ? 'Activo' : 'Pausado') : 'Próximamente'}
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  disabled={!disponible}
                  className={`empia-switch${on ? ' empia-switch--on' : ''}`}
                  onClick={() => toggle(emp)}
                >
                  <span className="empia-switch-knob" />
                </button>
              </div>

              <p className="empia-card-desc">{emp.descripcion}</p>

              {/* Repositor: código de administrador para pedir el reporte */}
              {emp.conCodigo && adminCode && (
                <div className="empia-card-code">
                  🔑 Pídele el reporte escribiendo: <code>inventario {adminCode}</code>
                </div>
              )}

              {/* Estado del canal: aviso clicable que conecta directo */}
              {disponible && on && !canalConectado && (
                <button
                  className="empia-card-warn empia-card-warn--btn"
                  onClick={esIG ? connectInstagram : openConnect}
                >
                  ⚠ Falta conectar tu {esIG ? 'Instagram' : 'WhatsApp'} — <strong>Conectar ahora →</strong>
                </button>
              )}
              {disponible && canalConectado && (
                <div className="empia-card-ok">
                  ✅ {esIG ? `@${igStatus.username} conectado` : 'WhatsApp conectado'}
                  <button
                    className="empia-card-ok-disconnect"
                    onClick={esIG ? disconnectInstagram : disconnectWA}
                  >
                    Desconectar
                  </button>
                </div>
              )}

              <button
                className="empia-train-btn"
                disabled={!disponible}
                onClick={() => disponible
                  ? setTestModal(true)
                  : toast.show(`${emp.nombre} estará disponible muy pronto.`)}
              >
                {disponible ? '💬 Probar Empleado' : 'Entrenar Empleado'}
              </button>
            </div>
          )
        })}
      </div>

      {qrModal && (
        <QrModal waStatus={waStatus} onClose={closeQrModal} />
      )}
      {testModal && (
        <TestChatModal onClose={() => setTestModal(false)} />
      )}
    </div>
  )
}

// ── Modal de conexión por QR ───────────────────────────────────────────────────

function QrModal({ waStatus, onClose }) {
  const connected = waStatus.status === 'connected'
  return (
    <div className="empia-modal-overlay" onClick={onClose}>
      <div className="empia-modal" onClick={e => e.stopPropagation()}>
        <div className="empia-modal-head">
          <h3>{connected ? '✅ WhatsApp conectado' : 'Conecta tu WhatsApp'}</h3>
          <button className="empia-modal-close" onClick={onClose}>×</button>
        </div>

        {connected ? (
          <div className="empia-qr-success">
            <div className="empia-qr-success-icon">🎉</div>
            <p>Tu Vendedor IA ya está atendiendo el WhatsApp{waStatus.phone ? ` del +${waStatus.phone}` : ''}.</p>
            <button className="empia-banner-btn" onClick={onClose}>Listo</button>
          </div>
        ) : (
          <>
            <ol className="empia-qr-steps">
              <li>Abre <strong>WhatsApp</strong> en tu celular</li>
              <li>Ve a <strong>Ajustes → Dispositivos vinculados</strong></li>
              <li>Toca <strong>Vincular un dispositivo</strong> y escanea este código</li>
            </ol>
            <div className="empia-qr-box">
              {waStatus.status === 'qr' && waStatus.qr
                ? <img src={waStatus.qr} alt="Código QR de WhatsApp" />
                : (
                  <div className="empia-qr-loading">
                    <div className="spinner" />
                    <p>Generando código QR…</p>
                  </div>
                )}
            </div>
            <p className="empia-qr-note">
              El código se renueva solo. Tu WhatsApp queda vinculado como un dispositivo
              más (igual que WhatsApp Web) — tú sigues usándolo normal en tu celular.
            </p>
          </>
        )}
      </div>
    </div>
  )
}

// ── Modal para probar al Vendedor IA sin WhatsApp ──────────────────────────────

function TestChatModal({ onClose }) {
  const [messages, setMessages] = useState([
    { from: 'ia', text: 'Aquí puedes probar cómo le responderé a tus clientes. Escríbeme como si fueras uno: pregunta precios, stock, "catálogo", "horario"…' },
  ])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const listRef = useRef(null)

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  const send = async () => {
    const text = input.trim()
    if (!text || sending) return
    setInput('')
    setMessages(prev => [...prev, { from: 'cliente', text }])
    setSending(true)
    try {
      const res = await aiEmployees.test(text)
      setMessages(prev => [...prev, { from: 'ia', text: res.reply || 'No tengo respuesta para eso todavía.' }])
    } catch (e) {
      setMessages(prev => [...prev, { from: 'ia', text: `⚠ ${e?.error || 'Error al consultar al Vendedor IA'}` }])
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="empia-modal-overlay" onClick={onClose}>
      <div className="empia-modal empia-modal--chat" onClick={e => e.stopPropagation()}>
        <div className="empia-modal-head">
          <h3>💬 Probar Vendedor IA</h3>
          <button className="empia-modal-close" onClick={onClose}>×</button>
        </div>
        <div className="empia-chat-list" ref={listRef}>
          {messages.map((m, i) => (
            <div key={i} className={`empia-chat-bubble empia-chat-bubble--${m.from}`}>
              {m.text}
            </div>
          ))}
          {sending && <div className="empia-chat-bubble empia-chat-bubble--ia">Escribiendo…</div>}
        </div>
        <div className="empia-chat-input-row">
          <input
            className="input"
            placeholder="Escribe como si fueras un cliente…"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send()}
            autoFocus
          />
          <button className="empia-banner-btn" onClick={send} disabled={sending}>Enviar</button>
        </div>
      </div>
    </div>
  )
}
