/**
 * Ventanas de fecha para las pantallas que muestran "lo reciente".
 *
 * Las consultas de paseos piden `orderBy('scheduledDate','asc')` con tope de
 * 100, y eso devuelve los 100 paseos MÁS ANTIGUOS del rango: con más de cien,
 * lo nuevo no aparece. Mientras el rango se mantenga por debajo del tope, la
 * ventana entera cabe y el orden deja de importar.
 *
 * Por eso cada pantalla pide un rango, no "todo": los últimos N días para lo
 * que se consulta a diario, y un mes a la vez para el historial. Y si el rango
 * llega al tope, quien lo mira se entera (`capped`) en vez de creer que vio
 * todo.
 */

/** El tope que imponen las reglas a cualquier lista de paseos. */
export const WALK_WINDOW_CAP = 100

/** `YYYY-MM-DD` de hace `days` días, en hora local. */
export function daysAgo(today: string, days: number): string {
  const [year, month, day] = today.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day - days)).toISOString().slice(0, 10)
}

export interface MonthWindow {
  /** `YYYY-MM` del mes que se está viendo. */
  month: string
  since: string
  until: string
  label: string
}

const MONTH_LABEL = new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric', timeZone: 'UTC' })

/** El mes `YYYY-MM` desplazado `offset` meses (0 = el mes de `today`). */
export function monthWindow(today: string, offset: number): MonthWindow {
  const [year, month] = today.split('-').map(Number)
  const start = new Date(Date.UTC(year, month - 1 + offset, 1))
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0))
  const since = start.toISOString().slice(0, 10)
  return {
    month: since.slice(0, 7),
    since,
    until: end.toISOString().slice(0, 10),
    label: MONTH_LABEL.format(start),
  }
}
