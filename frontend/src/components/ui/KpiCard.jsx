import './KpiCard.css'

export default function KpiCard({ label, value, sub, trend, icon, color = 'primary' }) {
  const isPositive = trend > 0
  const isNegative = trend < 0

  return (
    <div className={`kpi-card kpi-card--${color}`}>
      <div className="kpi-header">
        <span className="kpi-label">{label}</span>
        {icon && <span className="kpi-icon">{icon}</span>}
      </div>
      <div className="kpi-value">{value}</div>
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
