import { useState, useEffect, useRef } from 'react'
import { printJobs as printJobsApi } from '../api'
import { useAuth } from '../store/AuthContext'
import { buildEscposTicket } from '../utils/escposTicket'
import { bluetoothSupported, bluetoothConnected, bluetoothConnect, bluetoothPrint } from '../utils/bluetoothPrinter'

const POLL_MS = 4000

// Estación de Impresión: convierte cualquier Android/tablet en el "servidor
// de impresión" del negocio. Se deja esta página abierta junto a la impresora
// (conectada por Bluetooth) y los tickets que cobren los demás celulares
// —iPhone incluido— salen aquí solos.
export default function PrintStation() {
  const { user } = useAuth()
  const [connected, setConnected] = useState(false)
  const [running, setRunning] = useState(false)
  const [printed, setPrinted] = useState(0)
  const [lastAt, setLastAt] = useState(null)
  const [error, setError] = useState('')
  const busy = useRef(false)
  const wakeLock = useRef(null)

  // Mantener la pantalla encendida mientras la estación está activa
  useEffect(() => {
    if (!running) return
    const acquire = async () => {
      try { wakeLock.current = await navigator.wakeLock?.request('screen') } catch { /* no soportado */ }
    }
    acquire()
    const onVisible = () => { if (document.visibilityState === 'visible') acquire() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      wakeLock.current?.release().catch(() => {})
    }
  }, [running])

  // Poll de la cola de impresión
  useEffect(() => {
    if (!running) return
    const tick = async () => {
      if (busy.current) return
      busy.current = true
      try {
        const jobs = await printJobsApi.pending()
        for (const job of jobs) {
          if (!bluetoothConnected()) { setConnected(false); setRunning(false); break }
          await bluetoothPrint(buildEscposTicket(JSON.parse(job.payload)))
          await printJobsApi.done(job.id)
          setPrinted(n => n + 1)
          setLastAt(new Date())
        }
        setError('')
      } catch (err) {
        setError(err?.error || err?.message || 'Error al revisar la cola')
      } finally {
        busy.current = false
      }
    }
    tick()
    const id = setInterval(tick, POLL_MS)
    return () => clearInterval(id)
  }, [running])

  const handleConnect = async () => {
    setError('')
    try {
      await bluetoothConnect()
      setConnected(true)
    } catch (err) {
      if (err?.name !== 'NotFoundError') setError(err?.message || 'No se pudo conectar')
    }
  }

  const handleTest = async () => {
    setError('')
    try {
      await bluetoothPrint(buildEscposTicket({
        business: user?.businessName || 'AutoBusiness',
        folio: 'PRUEBA',
        cashier: 'Estación de impresión',
        payMethod: 'Efectivo',
        items: [{ name: 'Ticket de prueba', quantity: 1, price: 0, subtotal: 0 }],
        subtotal: 0, discountAmount: 0, total: 0,
      }))
      setConnected(true)
    } catch (err) {
      if (err?.name !== 'NotFoundError') setError(err?.message || 'No se pudo imprimir')
    }
  }

  const S = {
    page: { minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', gap: 18, padding: 24, background: '#0f172a', color: '#e2e8f0',
            fontFamily: 'Inter, sans-serif', textAlign: 'center' },
    icon: { fontSize: 64 },
    h1: { fontSize: 26, fontWeight: 800, margin: 0 },
    sub: { color: '#94a3b8', maxWidth: 420, lineHeight: 1.6, margin: 0 },
    btn: { padding: '16px 28px', borderRadius: 14, border: 'none', fontSize: 17, fontWeight: 700,
           cursor: 'pointer', minWidth: 280 },
    stat: { display: 'flex', gap: 28, marginTop: 6 },
    statBox: { textAlign: 'center' },
    statNum: { fontSize: 30, fontWeight: 800 },
    statLbl: { fontSize: 12, color: '#94a3b8' },
    err: { color: '#f87171', maxWidth: 420 },
    pill: (on) => ({ padding: '6px 14px', borderRadius: 99, fontSize: 13, fontWeight: 700,
                     background: on ? 'rgba(74,222,128,.15)' : 'rgba(148,163,184,.15)',
                     color: on ? '#4ade80' : '#94a3b8' }),
  }

  if (!bluetoothSupported()) return (
    <div style={S.page}>
      <div style={S.icon}>🖨️</div>
      <h1 style={S.h1}>Estación de Impresión</h1>
      <p style={S.sub}>
        Este navegador no soporta Bluetooth. Abre esta página en <b>Chrome en un
        teléfono o tablet Android</b> — ese dispositivo se convertirá en la
        impresora del negocio.
      </p>
    </div>
  )

  return (
    <div style={S.page}>
      <div style={S.icon}>{running ? '🟢' : '🖨️'}</div>
      <h1 style={S.h1}>Estación de Impresión</h1>
      <p style={S.sub}>
        Deja esta pantalla abierta junto a la impresora. Los tickets que cobren
        los demás celulares del negocio se imprimirán aquí automáticamente.
      </p>

      <div style={{ display: 'flex', gap: 10 }}>
        <span style={S.pill(connected)}>{connected ? '● Impresora conectada' : '○ Impresora sin conectar'}</span>
        <span style={S.pill(running)}>{running ? '● Estación activa' : '○ Estación detenida'}</span>
      </div>

      {!connected && (
        <button style={{ ...S.btn, background: '#6366f1', color: '#fff' }} onClick={handleConnect}>
          🔗 Conectar impresora Bluetooth
        </button>
      )}

      {connected && !running && (
        <button style={{ ...S.btn, background: '#22c55e', color: '#052e16' }} onClick={() => setRunning(true)}>
          ▶ Iniciar estación
        </button>
      )}

      {running && (
        <button style={{ ...S.btn, background: 'rgba(148,163,184,.2)', color: '#e2e8f0' }} onClick={() => setRunning(false)}>
          ⏸ Pausar
        </button>
      )}

      {connected && (
        <button style={{ ...S.btn, background: 'transparent', color: '#94a3b8', border: '1px solid #334155' }}
                onClick={handleTest}>
          Imprimir prueba
        </button>
      )}

      <div style={S.stat}>
        <div style={S.statBox}>
          <div style={S.statNum}>{printed}</div>
          <div style={S.statLbl}>tickets impresos</div>
        </div>
        <div style={S.statBox}>
          <div style={S.statNum}>{lastAt ? lastAt.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : '—'}</div>
          <div style={S.statLbl}>último ticket</div>
        </div>
      </div>

      {error && <div style={S.err}>⚠️ {error}</div>}
      <p style={{ ...S.sub, fontSize: 12 }}>
        La pantalla se mantiene encendida sola. Conecta el dispositivo a la corriente.
      </p>
    </div>
  )
}
