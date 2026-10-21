import { isActionableStatus, sessionsInZones, type ZoneSessionInput } from '@/lib/zoneAdmin'

function session(overrides: Partial<ZoneSessionInput> = {}): ZoneSessionInput {
  return { id: 's1', status: 'requested', scheduledDate: '2026-11-01', addressId: 'a1', walkerId: '', dogCount: 1, ...overrides }
}

describe('sessionsInZones', () => {
  it('sin direcciones resueltas, nadie cae en ninguna zona', () => {
    expect(sessionsInZones([session()], new Map(), ['zona-1'])).toEqual([])
  })

  it('un paseo cuya dirección cae en una de mis zonas, sí entra', () => {
    const result = sessionsInZones([session({ addressId: 'a1' })], new Map([['a1', 'zona-1']]), ['zona-1', 'zona-2'])
    expect(result).toEqual([{ ...session({ addressId: 'a1' }), zoneId: 'zona-1' }])
  })

  it('un paseo de otra zona no entra, aunque su dirección sí se resuelva', () => {
    const result = sessionsInZones([session({ addressId: 'a1' })], new Map([['a1', 'zona-3']]), ['zona-1', 'zona-2'])
    expect(result).toEqual([])
  })

  it('sin zonas asignadas, no entra nada', () => {
    const result = sessionsInZones([session({ addressId: 'a1' })], new Map([['a1', 'zona-1']]), [])
    expect(result).toEqual([])
  })

  it('filtra cada paseo de una lista mixta por su propia dirección', () => {
    const sessions = [
      session({ id: 's1', addressId: 'a1' }),
      session({ id: 's2', addressId: 'a2' }),
      session({ id: 's3', addressId: 'a3' }),
    ]
    const addressZones = new Map([['a1', 'zona-1'], ['a2', 'zona-9'], ['a3', 'zona-1']])
    const result = sessionsInZones(sessions, addressZones, ['zona-1'])
    expect(result.map((item) => item.id)).toEqual(['s1', 's3'])
  })
})

describe('isActionableStatus', () => {
  it('paseos que todavía necesitan algo de alguien', () => {
    expect(isActionableStatus('requested')).toBe(true)
    expect(isActionableStatus('assigned')).toBe(true)
    expect(isActionableStatus('in_progress')).toBe(true)
  })

  it('paseos ya resueltos no son "por hacer"', () => {
    expect(isActionableStatus('completed')).toBe(false)
    expect(isActionableStatus('cancelled')).toBe(false)
  })
})
