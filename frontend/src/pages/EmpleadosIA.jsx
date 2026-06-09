import { useState } from 'react'
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

export default function EmpleadosIA() {
  const toast = useToast()
  const [activos, setActivos] = useState({ vendedor: true })

  const toggle = (emp) => {
    if (emp.estado !== 'activo') {
      toast.show(`${emp.nombre} estará disponible muy pronto.`)
      return
    }
    setActivos(prev => ({ ...prev, [emp.id]: !prev[emp.id] }))
  }

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
          <button className="empia-banner-btn" onClick={() => toast.show('Conexión de WhatsApp próximamente disponible.')}>
            Conectar mi WhatsApp
          </button>
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
                {disponible && <span className="empia-avatar-badge">✓</span>}
              </div>

              <div className="empia-card-head">
                <h3>{emp.nombre}</h3>
                <span className={`empia-tag ${disponible ? 'empia-tag--activo' : 'empia-tag--soon'}`}>
                  {disponible ? 'Activo' : 'Próximamente'}
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

              <button
                className="empia-train-btn"
                disabled={!disponible}
                onClick={() => disponible
                  ? toast.show(`Configura tu ${emp.nombre} desde el panel de WhatsApp.`, 'success')
                  : toast.show(`${emp.nombre} estará disponible muy pronto.`)}
              >
                Entrenar Empleado
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
