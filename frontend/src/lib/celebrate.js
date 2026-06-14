// Confeti / animación de "fiesta mundialista" reutilizable.
// Usa canvas-confetti (carga diferida) con colores de cancha, copa y banderas.

const WORLDCUP_COLORS = ['#FFD700', '#16a34a', '#ffffff', '#e11d48', '#0ea5e9', '#facc15']

let lastRun = 0

/**
 * Lanza una celebración mundialista: estallido central + esquinas y
 * cañones laterales tipo fiesta durante ~2.5s.
 * @param {object} opts
 * @param {string} [opts.sessionKey] si se pasa, solo se dispara una vez por
 *   sesión del navegador (evita repetirlo en cada visita).
 * @param {boolean} [opts.quick] versión corta (solo estallido, sin los
 *   cañones laterales de 2.5s). Ideal para cada cambio de sección.
 */
export function celebrateWorldCup({ sessionKey, quick } = {}) {
  if (sessionKey) {
    try {
      if (sessionStorage.getItem(sessionKey)) return
      sessionStorage.setItem(sessionKey, '1')
    } catch { /* sessionStorage no disponible: continúa */ }
  }

  // Throttle: evita re-disparos encimados
  const now = Date.now()
  if (now - lastRun < 1200) return
  lastRun = now

  import('canvas-confetti').then(({ default: confetti }) => {
    const base = { zIndex: 3000, disableForReducedMotion: true, colors: WORLDCUP_COLORS }

    if (quick) {
      // Estallido rápido para cada navegación
      confetti({ ...base, particleCount: 70, spread: 80, startVelocity: 45, origin: { x: 0.5, y: 0.45 } })
      confetti({ ...base, particleCount: 30, angle: 60, spread: 60, origin: { x: 0, y: 0.75 } })
      confetti({ ...base, particleCount: 30, angle: 120, spread: 60, origin: { x: 1, y: 0.75 } })
      return
    }

    // Estallido inicial: centro + ambas esquinas inferiores
    confetti({ ...base, particleCount: 130, spread: 95, startVelocity: 55, origin: { x: 0.5, y: 0.5 } })
    confetti({ ...base, particleCount: 60, angle: 60, spread: 70, origin: { x: 0, y: 0.7 } })
    confetti({ ...base, particleCount: 60, angle: 120, spread: 70, origin: { x: 1, y: 0.7 } })

    // Cañones laterales continuos por ~2.5s
    const end = Date.now() + 2500
    const frame = () => {
      confetti({ ...base, particleCount: 4, angle: 60, spread: 55, startVelocity: 45, origin: { x: 0, y: 0.8 } })
      confetti({ ...base, particleCount: 4, angle: 120, spread: 55, startVelocity: 45, origin: { x: 1, y: 0.8 } })
      if (Date.now() < end) requestAnimationFrame(frame)
    }
    frame()
  }).catch(() => { /* sin confeti si falla la carga */ })
}
