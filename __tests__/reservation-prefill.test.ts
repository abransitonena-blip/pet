import {
  RESERVATION_STEP_ORDER,
  SKIPPABLE_STEPS,
  firstStepNeedingInput,
  nextStepIndex,
  soleChoice,
} from '@/lib/reservationPrefill'
import type { ReservationValidationIssue } from '@/lib/reservationValidation'

const issue = (step: ReservationValidationIssue['step']): ReservationValidationIssue =>
  ({ field: step, step, label: step })

describe('soleChoice', () => {
  it('elige sola la única opción', () => {
    expect(soleChoice(['a'])).toBe('a')
  })

  it('no elige por nadie cuando hay de dónde escoger, ni cuando no hay nada', () => {
    expect(soleChoice(['a', 'b'])).toBeNull()
    expect(soleChoice([])).toBeNull()
  })
})

describe('nextStepIndex', () => {
  it('avanza de uno cuando el siguiente paso tiene algo que preguntar', () => {
    expect(nextStepIndex(0, [issue('details')])).toBe(1)
  })

  it('salta "perro y dirección" cuando ya quedó resuelto', () => {
    // service → (details resuelto) → schedule
    expect(nextStepIndex(0, [issue('schedule')])).toBe(2)
  })

  it('nunca salta el resumen, aunque no falte nada', () => {
    const last = RESERVATION_STEP_ORDER.length - 1
    expect(nextStepIndex(2, [])).toBe(last)
    expect(nextStepIndex(last, [])).toBe(last)
  })

  it('no salta el servicio ni el horario: son la decisión que vino a hacer', () => {
    expect(SKIPPABLE_STEPS).toEqual(['details'])
    expect(nextStepIndex(1, [])).toBe(2)
  })
})

describe('firstStepNeedingInput', () => {
  it('es el primero en orden, no el primero de la lista de problemas', () => {
    expect(firstStepNeedingInput([issue('schedule'), issue('service')])).toBe('service')
  })

  it('cuando no falta nada, es el resumen', () => {
    expect(firstStepNeedingInput([])).toBe('confirm')
  })
})
