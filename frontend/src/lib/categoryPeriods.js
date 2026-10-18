// Límites de fecha para el detalle de "Ganancias por categoría".
// Deben coincidir EXACTO con CategoryService.getEarningsByCategory (backend),
// que calcula los periodos en UTC (LocalDate.now(ZoneOffset.UTC)), no en hora
// local del navegador — por eso aquí todo se calcula con los métodos getUTC*.

const DAY_MS = 86400000

function utcMidnight(daysAgo = 0) {
  const now = new Date()
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  return todayUtc - daysAgo * DAY_MS
}

export const PERIOD_LABELS = {
  today: 'Hoy',
  yesterday: 'Ayer',
  dayBeforeYesterday: 'Antier',
  week: 'Esta semana',
  month: 'Este mes',
  total: 'Total acumulado',
}

// Rango [from, to] en epoch ms para pasarle a GET /reports/sales.
export function periodRange(key) {
  const now = Date.now()
  const todayStart = utcMidnight(0)
  switch (key) {
    case 'today':
      return { from: todayStart, to: now }
    case 'yesterday':
      return { from: utcMidnight(1), to: todayStart }
    case 'dayBeforeYesterday':
      return { from: utcMidnight(2), to: utcMidnight(1) }
    case 'week': {
      // DayOfWeek.getValue() en Java: lunes=1 ... domingo=7. getUTCDay(): domingo=0 ... sábado=6.
      const jsDow = new Date(todayStart).getUTCDay()
      const isoDow = jsDow === 0 ? 7 : jsDow
      return { from: utcMidnight(isoDow - 1), to: now }
    }
    case 'month': {
      const d = new Date(todayStart)
      return { from: Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1), to: now }
    }
    case 'total':
      // from=1 (>0) evita el default de "últimos 30 días" de /reports/sales
      // y se acerca a "sin filtro de fecha", que es como el backend calcula
      // el total acumulado de la tarjeta.
      return { from: 1, to: now }
    default:
      return { from: todayStart, to: now }
  }
}
