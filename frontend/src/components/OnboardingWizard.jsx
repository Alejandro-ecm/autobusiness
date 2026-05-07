import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../store/AuthContext'
import { onboarding as onboardingApi } from '../api'
import './OnboardingWizard.css'

const PROFILES = [
  { id: 'tienda',     icon: '🏪', label: 'Tienda / Miscelánea',    desc: 'Abarrotes, dulces, limpieza' },
  { id: 'abarrotes',  icon: '🛒', label: 'Abarrotes / Super',      desc: 'Productos al mayoreo y menudeo' },
  { id: 'ropa',       icon: '👕', label: 'Ropa / Boutique',         desc: 'Prendas, tallas, colores' },
  { id: 'zapateria',  icon: '👟', label: 'Zapatería',               desc: 'Calzado, tallas, modelos' },
  { id: 'abastos',    icon: '⚖️', label: 'Abastos / Mayorista',     desc: 'Ventas por kg, costal, tonelada' },
  { id: 'otro',       icon: '🏢', label: 'Otro negocio',            desc: 'Cualquier otro tipo' },
]

export default function OnboardingWizard() {
  const { updateUser, user } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleSelectProfile = (id) => setSelected(id)

  const handleNext = async () => {
    if (step === 1) {
      if (!selected) return
      setStep(2)
    } else if (step === 2) {
      setStep(3)
    } else {
      await finish()
    }
  }

  const finish = async () => {
    setLoading(true)
    try {
      await onboardingApi.complete(selected || 'otro')
      updateUser({ onboardingCompleted: true, profileType: selected || 'otro' })
    } catch (e) {
      // si falla el API igual avanzamos — el onboarding es opcional
      updateUser({ onboardingCompleted: true })
    } finally {
      setLoading(false)
      navigate('/dashboard')
    }
  }

  const skip = async () => {
    setLoading(true)
    try { await onboardingApi.complete('otro') } catch (_) {}
    updateUser({ onboardingCompleted: true })
    setLoading(false)
    navigate('/dashboard')
  }

  return (
    <div className="ob-overlay">
      <div className="ob-card">

        {/* Barra de progreso */}
        <div className="ob-progress">
          {[1, 2, 3].map(n => (
            <div key={n} className={`ob-step${step >= n ? ' ob-step--done' : ''}`}>
              <div className="ob-step-dot">{step > n ? '✓' : n}</div>
              <span>{n === 1 ? 'Tu negocio' : n === 2 ? 'Productos' : 'Primera venta'}</span>
            </div>
          ))}
        </div>

        {/* PASO 1 */}
        {step === 1 && (
          <div className="ob-body">
            <h2 className="ob-title">¿Qué tipo de negocio tienes?</h2>
            <p className="ob-sub">Personalizamos el sistema para ti</p>
            <div className="ob-profiles">
              {PROFILES.map(p => (
                <button
                  key={p.id}
                  className={`ob-profile${selected === p.id ? ' ob-profile--selected' : ''}`}
                  onClick={() => handleSelectProfile(p.id)}
                >
                  <span className="ob-profile-icon">{p.icon}</span>
                  <span className="ob-profile-label">{p.label}</span>
                  <span className="ob-profile-desc">{p.desc}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* PASO 2 */}
        {step === 2 && (
          <div className="ob-body ob-body--center">
            <div className="ob-big-icon">📦</div>
            <h2 className="ob-title">Agrega tus productos</h2>
            <p className="ob-sub">Puedes subir un Excel o crearlos uno a uno desde el inventario</p>
            <div className="ob-options">
              <button className="ob-opt" onClick={() => { navigate('/inventory'); updateUser({ onboardingCompleted: true }) }}>
                <span>📁</span>
                <div>
                  <strong>Subir Excel</strong>
                  <p>Importa tu catálogo completo</p>
                </div>
              </button>
              <button className="ob-opt" onClick={() => { navigate('/inventory'); updateUser({ onboardingCompleted: true }) }}>
                <span>✏️</span>
                <div>
                  <strong>Crear manual</strong>
                  <p>Agrega producto por producto</p>
                </div>
              </button>
            </div>
            <button className="ob-skip-link" onClick={handleNext}>
              Omitir por ahora →
            </button>
          </div>
        )}

        {/* PASO 3 */}
        {step === 3 && (
          <div className="ob-body ob-body--center">
            <div className="ob-big-icon">🎉</div>
            <h2 className="ob-title">¡Todo listo!</h2>
            <p className="ob-sub">Haz tu primera venta desde la Caja</p>
            <button className="ob-cta" onClick={() => { updateUser({ onboardingCompleted: true }); navigate('/caja') }} disabled={loading}>
              💳 Ir a la Caja
            </button>
            <button className="ob-skip-link" onClick={finish} disabled={loading}>
              Ver el dashboard primero
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="ob-footer">
          {step < 3 && step !== 2 && (
            <button className="ob-btn-primary" onClick={handleNext} disabled={step === 1 && !selected || loading}>
              {loading ? 'Guardando…' : 'Continuar →'}
            </button>
          )}
          {step === 1 && (
            <button className="ob-skip" onClick={skip} disabled={loading}>Saltar configuración</button>
          )}
        </div>

      </div>
    </div>
  )
}
