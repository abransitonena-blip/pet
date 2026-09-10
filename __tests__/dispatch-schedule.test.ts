import { businessClock, daySlots, scoreWalker } from '@/lib/dispatch'
import type { Walker } from '@/types'

/**
 * The walker's availability was never matched: their profile screen stores
 * `monday`…`sunday`, older admin tooling stored `lun`…`dom`, and dispatch asked
 * for `lunes`…`domingo`. And dispatch moved to the server, which runs in UTC.
 * These pin both fixes.
 */
describe('horario del paseador en el despacho', () => {
  test('encuentra el horario guardado con claves en inglés al pedirlo en español', () => {
    expect(daySlots({ monday: [{ start: '09:00', end: '12:00' }] }, 'lunes')).toEqual([{ start: '09:00', end: '12:00' }])
  })

  test('también acepta las abreviaturas en español de la herramienta anterior', () => {
    expect(daySlots({ lun: [{ start: '09:00', end: '12:00' }] }, 'monday')).toHaveLength(1)
    expect(daySlots({ mie: [{ start: '09:00', end: '12:00' }] }, 'miercoles')).toHaveLength(1)
  })

  test('un día sin horario devuelve una lista vacía', () => {
    expect(daySlots({}, 'lunes')).toEqual([])
    expect(daySlots(undefined, 'lunes')).toEqual([])
  })

  test('respeta varios bloques en un mismo día y excluye el hueco entre ellos', () => {
    const walker = {
      id: 'walker-1',
      name: 'Paseador',
      status: 'active',
      zones: ['zone-1'],
      schedule: { monday: [{ start: '07:00', end: '10:00' }, { start: '17:00', end: '20:00' }] },
    } as unknown as Walker

    expect(scoreWalker(walker, 'zone-1', 'lunes', '08:30').reasons).toContain('Horario disponible')
    expect(scoreWalker(walker, 'zone-1', 'lunes', '18:00').reasons).toContain('Horario disponible')
    expect(scoreWalker(walker, 'zone-1', 'lunes', '13:00').reasons).toContain('Fuera de horario')
  })

  test('usa la hora de Ciudad de México aunque el servidor corra en UTC', () => {
    // 01:30 UTC del jueves 10 es el miércoles 9 a las 19:30 en CDMX (UTC-6).
    expect(businessClock(new Date('2026-09-10T01:30:00Z'))).toEqual({ day: 'miercoles', time: '19:30' })
    // Medianoche local se escribe 00:00, nunca 24:00.
    expect(businessClock(new Date('2026-09-10T06:00:00Z'))).toEqual({ day: 'jueves', time: '00:00' })
  })
})
