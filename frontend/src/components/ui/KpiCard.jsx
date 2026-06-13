import { useState, useEffect, useRef } from 'react'
import './KpiCard.css'

// Anima el número de `value` contando desde el valor anterior hasta el nuevo.
// Conserva el prefijo ($) y sufijo (%, etc.) y formatea con separador de miles MX.
function useCountUp(value, duration = 1000) {
  const str = String(value ?? '')
  const match = str.match(/-?[\d.,]+/)
  const hasNumber = !!match

  const prefix = hasNumber ? str.slice(0, match.index) : ''
  const suffix = hasNumber ? str.slice(match.index + match[0].length) : ''
  const numericStr = hasNumber ? match[0].replace(/,/g, '') : ''
  const target = hasNumber ? parseFloat(numericStr) || 0 : 0
  const decimals = numericStr.includes('.') ? numericStr.split('.')[1].length : 0

  const [display, setDisplay] = useState(hasNumber ? `${prefix}0${suffix}` : str)
  const rafRef = useRef()
  const fromRef = useRef(0)

  useEffect(() => {
    if (!hasNumber) { setDisplay(str); return }

    const from = fromRef.current
    const to = target
    if (from === to) { setDisplay(str); return }

    const fmtNum = (n) => n.toLocaleString('es-MX', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })

    const start = performance.now()
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3) // easeOutCubic — rápido y suave al final
      const current = from + (to - from) * eased
      setDisplay(`${prefix}${fmtNum(current)}${suffix}`)
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        fromRef.current = to
      }
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [str])

  return display
}

export default function KpiCard({ label, value, sub, trend, icon, color = 'primary' }) {
  const isPositive = trend > 0
  const isNegative = trend < 0
  const display = useCountUp(value)

  return (
    <div className={`kpi-card kpi-card--${color}`}>
      <div className="kpi-header">
        <span className="kpi-label">{label}</span>
        {icon && <span className="kpi-icon">{icon}</span>}
      </div>
      <div className="kpi-value" key={String(value)}>{display}</div>
      <div className="kpi-footer">
        {trend !== undefined && (
          <span className={`kpi-trend ${isPositive ? 'up' : isNegative ? 'down' : ''}`}>
            {isPositive ? '▲' : isNegative ? '▼' : '—'} {Math.abs(trend)}%
          </span>
        )}
        {sub && <span className="kpi-sub">{sub}</span>}
      </div>
    </div>
  )
}
