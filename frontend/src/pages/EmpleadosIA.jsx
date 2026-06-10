import { useState, useEffect, useRef, useCallback } from 'react'
import { aiEmployees, whatsapp } from '../api'
import { useToast } from '../store/ToastContext'
import './EmpleadosIA.css'

const EMPLEADOS = [
  {
    id: 'vendedor',
    nombre: 'Vendedor IA',
    foto: '/vendedora-ia.webp',
    estado: 'activo',
    descripcion: 'Responde automáticamente las consultas de tu WhatsApp las 24hs del día.',
  },
  {
    id: 'cobrador',
    nombre: 'Cobrador IA',
    foto: '/cobrador-ia.avif',
    estado: 'proximamente',
    descripcion: 'Gestiona cobros y pagos pendientes por WhatsApp de forma automática.',
  },
  {
    id: 'repositor',
    nombre: 'Repositor IA',
    foto: '/repositor-ia.webp',
    estado: 'proximamente',
    descripcion: 'Controla tu inventario y te avisa cuando un producto está por agotarse.',
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
  const [qrModal, setQrModal] = useState(false)
  const [testModal, setTestModal] = useState(false)
  const pollRef = useRef(null)

  // Estado inicial: empleados + conexión WhatsApp
  useEffect(() => {
    aiEmployees.list()
      .then(res => setActivos(res.employees || {}))
      .catch(() => {})
    whatsapp.status()
      .then(setWaStatus)
      .catch(() => {})
    return () => clearInterval(pollRef.current)
  }, [])

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

  const toggle = async (emp) => {
    if (emp.estado !== 'activo') {
      toast.show(`${emp.nombre} estará disponible muy pronto.`)
      return
    }
    const next = !activos[emp.id]
    setActivos(prev => ({ ...prev, [emp.id]: next })) // optimista
    try {
      await aiEmployees.toggle(emp.id, next)
      if (next && waStatus.status !== 'connected') {
        toast.show('Vendedor IA activado — conecta tu WhatsApp para que empiece a responder', 'success')
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
          <h2>Haz que la IA responda WhatsApp por ti</h2>
          <p>Tu Vendedor IA responde automáticamente 24/7 preguntas de clientes sobre productos, precios y stock.</p>
          <div className="empia-wa-row">
            {connected ? (
              <>
                <span className="empia-wa-connected">
                  ✅ Conectado{waStatus.phone ? `: +${waStatus.phone}` : ''}
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
          return (
            <div key={emp.id} className="card empia-card">
              <div className="empia-avatar-wrap">
                {emp.foto
                  ? <img className="empia-avatar empia-avatar--img" src={emp.foto} alt={emp.nombre} />
                  : <div className="empia-avatar">{emp.avatar}</div>}
                {disponible && on && <span className="empia-avatar-badge">✓</span>}
              </div>

              <div className="empia-card-head">
                <h3>{emp.nombre}</h3>
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

              {emp.id === 'vendedor' && disponible && on && !connected && (
                <p className="empia-card-warn">⚠ Conecta tu WhatsApp para que empiece a responder.</p>
              )}

              <button
                className="empia-train-btn"
                disabled={!disponible}
                onClick={() => disponible
                  ? setTestModal(true)
                  : toast.show(`${emp.nombre} estará disponible muy pronto.`)}
              >
                {emp.id === 'vendedor' ? '💬 Probar Empleado' : 'Entrenar Empleado'}
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
