import type { ReservationStepId, ReservationValidationIssue } from '@/lib/reservationValidation'

/**
 * Reservar sin contestar lo que ya se sabe.
 *
 * Una familia con un perro y una dirección pasaba por una pantalla que le pedía
 * elegir entre una sola opción. Eso no es una decisión, es un trámite: aquí se
 * resuelve cuál se elige sola y cuál paso todavía tiene algo que preguntar.
 *
 * El paso que se salta no se esconde: todo aparece en "Revisar y enviar", desde
 * donde se puede volver a cualquiera. Y sólo se salta hacia adelante -- el botón
 * de atrás siempre pasa por todos, porque quien va hacia atrás es justo quien
 * quiere cambiar algo.
 */

export const RESERVATION_STEP_ORDER: readonly ReservationStepId[] = ['service', 'details', 'schedule', 'confirm']

/**
 * Los pasos que pueden quedarse vacíos de decisiones. Servicio y horario nunca:
 * aunque se pudieran adivinar, son la elección que la familia vino a hacer.
 */
export const SKIPPABLE_STEPS: readonly ReservationStepId[] = ['details']

/** Cuando hay exactamente una opción, elegirla no es una decisión. */
export function soleChoice<T>(options: readonly T[]): T | null {
  return options.length === 1 ? options[0] : null
}

function stepHasIssues(issues: readonly ReservationValidationIssue[], step: ReservationStepId): boolean {
  return issues.some((issue) => issue.step === step)
}

/**
 * El siguiente paso desde `index`, saltando los que ya están resueltos. Nunca
 * salta el último: "Revisar y enviar" siempre se muestra.
 */
export function nextStepIndex(
  index: number,
  issues: readonly ReservationValidationIssue[],
  order: readonly ReservationStepId[] = RESERVATION_STEP_ORDER,
): number {
  const last = order.length - 1
  let next = Math.min(index + 1, last)
  while (next < last && SKIPPABLE_STEPS.includes(order[next]) && !stepHasIssues(issues, order[next])) {
    next += 1
  }
  return next
}

/** El primer paso que todavía necesita una decisión; el último si ya no falta nada. */
export function firstStepNeedingInput(
  issues: readonly ReservationValidationIssue[],
  order: readonly ReservationStepId[] = RESERVATION_STEP_ORDER,
): ReservationStepId {
  return order.find((step) => stepHasIssues(issues, step)) ?? order[order.length - 1]
}
