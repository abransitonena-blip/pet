import { readFileSync } from 'node:fs'
import { rankWalkers, suggestionFor, type AssignedWalk, type SuggestableWalker } from '../src/lib/dispatchSuggestion'

const read = (path: string) => readFileSync(path, 'utf8')

const ana: SuggestableWalker = { uid: 'ana', name: 'Ana', zones: ['centro'], maxDaily: 4 }
const beto: SuggestableWalker = { uid: 'beto', name: 'Beto', zones: ['norte'], maxDaily: 4 }
const caro: SuggestableWalker = { uid: 'caro', name: 'Caro', zones: ['centro'], maxDaily: 4 }

const walk = { zoneId: 'centro', scheduledDate: '2026-10-02', dogIds: ['dog-1'] }

const assigned = (over: Partial<AssignedWalk> & { walkerId: string }): AssignedWalk => ({
  scheduledDate: '2026-10-02', dogIds: [], ...over,
})

describe('a quién sugerir para un paseo', () => {
  it('primero quien cubre la zona', () => {
    const ranked = rankWalkers([beto, ana], walk, [])
    expect(ranked.map((item) => item.uid)).toEqual(['ana', 'beto'])
    expect(ranked[0].reason).toContain('misma zona')
  })

  it('entre dos de la zona, quien ya paseó a ese perro', () => {
    const ranked = rankWalkers([ana, caro], walk, [assigned({ walkerId: 'caro', scheduledDate: '2026-09-01', dogIds: ['dog-1'] })])
    expect(ranked[0].uid).toBe('caro')
    expect(ranked[0].reason).toContain('ya paseó a este perro')
  })

  it('a igualdad de todo, quien va más libre ese día', () => {
    const ranked = rankWalkers([ana, caro], walk, [assigned({ walkerId: 'ana' }), assigned({ walkerId: 'ana' })])
    expect(ranked[0].uid).toBe('caro')
    expect(ranked.find((item) => item.uid === 'ana')?.reason).toContain('2 paseos ese día')
  })

  it('la carga cuenta sólo la de ese día', () => {
    const ranked = rankWalkers([ana], walk, [assigned({ walkerId: 'ana', scheduledDate: '2026-10-09' })])
    expect(ranked[0].walksThatDay).toBe(0)
    expect(ranked[0].reason).toContain('sin paseos ese día')
  })

  it('quien llegó a su tope va al final, se dice, y deja de sugerirse', () => {
    const lleno = [assigned({ walkerId: 'ana' }), assigned({ walkerId: 'ana' }), assigned({ walkerId: 'ana' }), assigned({ walkerId: 'ana' })]
    const ranked = rankWalkers([ana, beto], walk, lleno)
    expect(ranked[ranked.length - 1].uid).toBe('ana')
    expect(ranked[ranked.length - 1].reason).toContain('llegó a su tope diario')
    expect(suggestionFor(ranked)?.uid).toBe('beto')
    expect(suggestionFor(rankWalkers([ana], walk, lleno))).toBeNull()
  })

  it('sin zona resuelta, no inventa que alguien es de la zona', () => {
    const ranked = rankWalkers([ana, beto], { ...walk, zoneId: '' }, [])
    expect(ranked.every((item) => item.inZone === false)).toBe(true)
    expect(ranked.map((item) => item.uid)).toEqual(['ana', 'beto'])
  })

  it('el orden no cambia solo entre dos recargas', () => {
    const once = rankWalkers([caro, ana], walk, []).map((item) => item.uid)
    const twice = rankWalkers([ana, caro], walk, []).map((item) => item.uid)
    expect(once).toEqual(twice)
  })
})

describe('en el panel de solicitudes', () => {
  const panel = read('src/components/admin/CanonicalDispatchPanel.tsx')

  it('la lista viene ordenada y cada opción dice su motivo', () => {
    expect(panel).toContain('rankWalkers(walkerOptions.walkers, {')
    expect(panel).toContain('{walker.name} — {walker.reason}')
  })

  it('la sugerencia se nombra, y se dice que no asigna', () => {
    expect(panel).toContain('Sugerido:')
    expect(panel).toContain('La sugerencia no asigna: decide quien mira')
  })

  it('si la carga leída se quedó corta, lo dice en vez de callarlo', () => {
    expect(panel).toContain('{loadCapped && (')
    expect(panel).toContain('puede quedarse corta')
  })
})
