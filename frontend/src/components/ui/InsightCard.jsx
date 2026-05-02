import './InsightCard.css'

const statusConfig = {
  RED:    { cls: 'red',    emoji: '🔴', label: 'Crítico' },
  YELLOW: { cls: 'yellow', emoji: '🟡', label: 'Atención' },
  GREEN:  { cls: 'green',  emoji: '🟢', label: 'Bien' },
}

export default function InsightCard({ insight, onDismiss }) {
  const cfg = statusConfig[insight.status] || statusConfig.GREEN

  return (
    <div className={`insight-card insight-card--${cfg.cls}`}>
      <div className="insight-header">
        <div className="insight-status">
          <span>{cfg.emoji}</span>
          <span className={`badge badge-${cfg.cls === 'red' ? 'red' : cfg.cls === 'yellow' ? 'yellow' : 'green'}`}>
            {cfg.label}
          </span>
        </div>
        {onDismiss && (
          <button className="insight-dismiss" onClick={() => onDismiss(insight.id)}>×</button>
        )}
      </div>

      <h3 className="insight-title">{insight.title}</h3>
      <p className="insight-diagnosis">{insight.diagnosis}</p>

      {insight.cause && (
        <p className="insight-cause"><strong>Por qué:</strong> {insight.cause}</p>
      )}

      <div className={`insight-action insight-action--${cfg.cls}`}>
        <span className="insight-action-label">Acción recomendada</span>
        <p>{insight.action}</p>
      </div>

      {insight.impact && (
        <div className="insight-impact">
          <span>💵</span>
          <span>{insight.impact}</span>
        </div>
      )}
    </div>
  )
}
