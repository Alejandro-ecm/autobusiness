import { useState, useEffect } from 'react'
import { pos as posApi } from '../../api'
import { useToast } from '../../store/ToastContext'
import './CorteModal.css'

const fmt = (n) => `$${Number(n || 0).toFixed(2)}`

export default function CorteModal({ open, onClose }) {
  const { show } = useToast()
  const [corteData,  setCorteData]  = useState(null)
  const [notes,      setNotes]      = useState('')
  const [saving,     setSaving]     = useState(false)

  useEffect(() => {
    if (!open) return
    setCorteData(null)
    posApi.corteToday()
      .then(setCorteData)
      .catch(() => show('No se pudo cargar el corte', 'error'))
  }, [open])

  const handleCloseRegister = async () => {
    setSaving(true)
    try {
      await posApi.corteClose(notes)
      show('✓ Corte guardado correctamente', 'success')
      setNotes('')
      onClose()
    } catch {
      show('Error al guardar el corte', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (!open || !corteData) return null

  return (
    <div className="corte-modal-backdrop" onClick={onClose}>
      <div className="corte-modal" onClick={e => e.stopPropagation()}>
        <div className="corte-modal-header">
          <h2>📊 Corte de caja</h2>
          <button className="corte-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="corte-body">
          <div className="corte-date">
            {new Date().toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
          <div className="corte-stats">
            <div className="corte-stat">
              <span className="corte-label">Total del día</span>
              <span className="corte-val" style={{ color: '#6366f1' }}>{fmt(corteData.totalRevenue ?? 0)}</span>
            </div>
            <div className="corte-stat">
              <span className="corte-label">Transacciones</span>
              <span className="corte-val">{corteData.transactionCount ?? 0}</span>
            </div>
            <div className="corte-stat">
              <span className="corte-label">Ticket promedio</span>
              <span className="corte-val">{fmt(corteData.avgTicket ?? 0)}</span>
            </div>
          </div>
          <div className="corte-methods">
            {[
              { key: 'cash',     label: '💵 Efectivo',      val: corteData.cash     ?? 0 },
              { key: 'card',     label: '💳 Tarjeta',       val: corteData.card     ?? 0 },
              { key: 'transfer', label: '🏦 Transferencia', val: corteData.transfer ?? 0 },
              { key: 'mp',       label: '💙 Mercado Pago',  val: corteData.mp       ?? 0 },
            ].map(m => (
              <div key={m.key} className="corte-method-row">
                <span>{m.label}</span>
                <span>{fmt(m.val)}</span>
              </div>
            ))}
          </div>
          {corteData.history?.length > 0 && (
            <div className="corte-history">
              <p className="corte-history-title">Últimos cortes</p>
              {corteData.history.slice(0, 3).map(h => (
                <div key={h.id} className="corte-history-row">
                  <span>{new Date(h.closedAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}</span>
                  <span>{h.transactions} ventas</span>
                  <span>{fmt(h.total)}</span>
                </div>
              ))}
            </div>
          )}
          <textarea className="corte-notes-input"
            placeholder="Notas del corte (fondo de caja, incidencias…)"
            rows={2}
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
          <button className="corte-btn-primary"
            onClick={handleCloseRegister}
            disabled={saving}>
            {saving ? 'Guardando…' : '✓ Cerrar turno y guardar corte'}
          </button>
        </div>
      </div>
    </div>
  )
}
