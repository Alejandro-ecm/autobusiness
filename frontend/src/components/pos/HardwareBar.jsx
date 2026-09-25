import { useEffect, useState } from 'react'
import { scaleSupported, scaleConnected, subscribeScale, getLastReading } from '../../utils/scaleReader'
import './HardwareBar.css'

const SHORTCUTS = [
  { key: 'F1', label: 'Cobrar' },
  { key: 'F2', label: 'Buscar' },
  { key: 'F3', label: 'Cliente / Fiado' },
]

// Franja delgada de estado de hardware + atajos de teclado, arriba de la
// parrilla de productos. La báscula solo se muestra si el navegador la
// soporta (Web Serial) — en un dispositivo sin esa capacidad (móvil, Safari,
// Firefox) simplemente no aparece, no es un negocio que necesite verla.
export default function HardwareBar() {
  const [connected, setConnected] = useState(scaleConnected())
  const [reading, setReading] = useState(getLastReading())

  useEffect(() => {
    if (!scaleSupported()) return
    const unsub = subscribeScale(r => { setReading(r); setConnected(scaleConnected()) })
    const id = setInterval(() => setConnected(scaleConnected()), 1000)
    return () => { unsub(); clearInterval(id) }
  }, [])

  return (
    <div className="pos-hwbar">
      {scaleSupported() && (
        <span className={`pos-hwbar-pill${connected ? ' on' : ''}`}>
          {connected
            ? `🟢 Báscula lista${reading?.kg != null ? `: ${reading.kg.toFixed(3)} kg` : ''}`
            : '⚪ Báscula desconectada'}
        </span>
      )}
      <div className="pos-hwbar-shortcuts">
        {SHORTCUTS.map(s => (
          <span key={s.key} className="pos-hwbar-key">
            <kbd>{s.key}</kbd> {s.label}
          </span>
        ))}
      </div>
    </div>
  )
}
