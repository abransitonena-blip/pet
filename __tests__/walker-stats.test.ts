import { activeDays, shiftDays, summarizeWalkerWork } from '@/lib/walkerStats'

const TODAY = '2026-09-13'
const walk = (date: string, status = 'completed') => ({ date, status })

describe('shiftDays', () => {
  it('cuenta días hacia atrás y hacia adelante', () => {
    expect(shiftDays(TODAY, -6)).toBe('2026-09-07')
    expect(shiftDays(TODAY, 1)).toBe('2026-09-14')
  })

  it('cruza el cambio de mes', () => {
    expect(shiftDays('2026-09-02', -6)).toBe('2026-08-27')
  })

  it('una fecha inservible no rompe la cuenta', () => {
    expect(shiftDays('no-es-fecha', -6)).toBe('no-es-fecha')
  })
})

describe('summarizeWalkerWork', () => {
  it('cuenta lo completado, y aparte la semana y el mes', () => {
    const summary = summarizeWalkerWork([
      walk('2026-09-13'), walk('2026-09-10'), walk('2026-09-02'), walk('2026-08-30'),
    ], TODAY)
    expect(summary.completed).toBe(4)
    expect(summary.completedThisWeek).toBe(2)
    expect(summary.completedThisMonth).toBe(3)
  })

  it('lo que viene son los paseos de hoy en adelante que siguen en pie', () => {
    const summary = summarizeWalkerWork([
      walk('2026-09-14', 'assigned'),
      walk('2026-09-13', 'in_progress'),
      walk('2026-09-12', 'assigned'),
    ], TODAY)
    expect(summary.upcoming).toBe(2)
  })

  it('lo cancelado se cuenta aparte, nunca como completado', () => {
    const summary = summarizeWalkerWork([walk('2026-09-10', 'cancelled'), walk('2026-09-11', 'no_show')], TODAY)
    expect(summary.completed).toBe(0)
    expect(summary.cancelled).toBe(2)
  })

  it('guarda el primero y el último paseo completado, en orden', () => {
    const summary = summarizeWalkerWork([walk('2026-09-10'), walk('2026-08-01'), walk('2026-09-13')], TODAY)
    expect(summary.firstDate).toBe('2026-08-01')
    expect(summary.lastDate).toBe('2026-09-13')
  })

  it('sin paseos no inventa fechas', () => {
    const summary = summarizeWalkerWork([], TODAY)
    expect(summary).toMatchObject({ completed: 0, firstDate: '', lastDate: '' })
  })
})

describe('activeDays', () => {
  it('cuenta días distintos, no paseos: mide constancia', () => {
    expect(activeDays([walk('2026-09-10'), walk('2026-09-10'), walk('2026-09-11')])).toBe(2)
  })

  it('un paseo cancelado no es un día trabajado', () => {
    expect(activeDays([walk('2026-09-10', 'cancelled')])).toBe(0)
  })
})

import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(path, 'utf8')

/**
 * El panel del paseador le decía qué hacer hoy y nada de lo que ya hizo. Lo que
 * no puede pasar: que estos números se conviertan en un puntaje inventado, o que
 * presenten una ventana de 100 paseos como si fuera toda su historia.
 */
describe('la tarjeta de trabajo', () => {
  const card = read('src/components/walker/WalkerWorkCard.tsx')

  test('dice de dónde salen los números', () => {
    expect(card).toContain('paseos más recientes')
    expect(card).toContain('No es toda tu historia')
  })

  test('lo que muestra son paseos contados, no un puntaje', () => {
    // Se miran las etiquetas que de verdad se dibujan: el comentario del
    // archivo sí menciona los puntajes, justo para explicar por qué no los hay.
    const labels = Array.from(card.matchAll(/label: '([^']+)'/g)).map((match) => match[1])
    expect(labels).toEqual(['Paseos completados', 'Esta semana', 'Este mes', 'Días que saliste'])
    for (const value of ['summary.completed', 'summary.completedThisWeek', 'summary.completedThisMonth', 'days']) {
      expect(card).toContain(`value: ${value}`)
    }
  })

  test('lo cancelado se explica, no se esconde', () => {
    expect(card).toContain('nunca como completados')
  })

  test('vive en el perfil del paseador', () => {
    expect(read('src/app/walker/perfil/page.tsx')).toContain('<WalkerWorkCard uid={uid} />')
  })
})
