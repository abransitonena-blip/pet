import {
  MIN_REVIEWS_FOR_AVERAGE,
  WALKER_REVIEW_TEXT_LIMIT,
  summarizeWalkerRatings,
  validateWalkerReview,
} from '@/lib/walkerReviews'

const stars = (...ratings: number[]) => ratings.map((rating) => ({ rating }))

describe('validateWalkerReview', () => {
  it('acepta de 1 a 5 estrellas, enteras', () => {
    expect(validateWalkerReview({ rating: 1, text: '' })).toEqual([])
    expect(validateWalkerReview({ rating: 5, text: 'Excelente' })).toEqual([])
  })

  it('rechaza lo que está fuera de rango o no es entero', () => {
    for (const rating of [0, 6, -1, 3.5, Number.NaN]) {
      expect(validateWalkerReview({ rating, text: '' })).toContain('rating-out-of-range')
    }
  })

  it('el comentario tiene tope', () => {
    expect(validateWalkerReview({ rating: 5, text: 'a'.repeat(WALKER_REVIEW_TEXT_LIMIT) })).toEqual([])
    expect(validateWalkerReview({ rating: 5, text: 'a'.repeat(WALKER_REVIEW_TEXT_LIMIT + 1) })).toContain('text-too-long')
  })

  it('el comentario puede ir vacío: la estrella es lo que cuenta', () => {
    expect(validateWalkerReview({ rating: 4, text: '' })).toEqual([])
  })
})

describe('summarizeWalkerRatings', () => {
  it('sin reseñas no inventa un promedio', () => {
    const summary = summarizeWalkerRatings([])
    expect(summary).toMatchObject({ count: 0, average: null })
    expect(summary.pendingReason).toContain('Todavía no')
  })

  it('con muy pocas calla el promedio y dice cuántas faltan', () => {
    const summary = summarizeWalkerRatings(stars(5, 5))
    expect(summary.count).toBe(2)
    expect(summary.average).toBeNull()
    expect(summary.pendingReason).toContain(String(MIN_REVIEWS_FOR_AVERAGE))
  })

  it('a partir del mínimo promedia, con un decimal', () => {
    const summary = summarizeWalkerRatings(stars(5, 4, 4))
    expect(summary.count).toBe(3)
    expect(summary.average).toBe(4.3)
    expect(summary.pendingReason).toBe('')
  })

  it('cuenta cuántas de cada calificación', () => {
    const summary = summarizeWalkerRatings(stars(5, 5, 4, 1))
    expect(summary.distribution).toEqual({ 1: 1, 2: 0, 3: 0, 4: 1, 5: 2 })
  })

  it('una calificación imposible se ignora, no arrastra el promedio', () => {
    const summary = summarizeWalkerRatings([...stars(5, 5, 5), { rating: 99 }])
    expect(summary.count).toBe(3)
    expect(summary.average).toBe(5)
  })
})

import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(path, 'utf8')

/**
 * Una reseña vale por quién la escribe. Lo que la volvería adorno: que se
 * pudiera dejar sin haber tenido el paseo, que se pudiera reescribir, o que un
 * "5.0" con una sola reseña se presentara como si describiera a alguien.
 */
describe('las reglas de la reseña', () => {
  const rules = read('firestore.rules')
  const block = rules.slice(rules.indexOf('match /walkerReviews/{sessionId}'), rules.indexOf('function walkSessionBelongsToReviewer'))

  test('el documento es el paseo: una reseña por paseo, y no se reescribe', () => {
    expect(block).toContain('request.resource.data.sessionId == sessionId')
    expect(block).toContain('allow update, delete: if false;')
  })

  test('se comprueba contra la sesión guardada, no contra lo que diga el cliente', () => {
    const helper = rules.slice(rules.indexOf('function walkSessionBelongsToReviewer'))
    expect(helper.slice(0, 700)).toContain("data.customerId == request.auth.uid")
    expect(helper.slice(0, 700)).toContain("data.status == 'completed'")
    expect(helper.slice(0, 700)).toContain('data.walkerId == walkerId')
  })

  test('un paseador sólo puede listar las suyas', () => {
    expect(block).toContain('resource.data.walkerId == request.auth.uid')
    expect(block).toContain('validListLimit(100)')
  })
})

describe('la interfaz', () => {
  test('calificar sólo se ofrece en un paseo terminado y con paseador', () => {
    const page = read('src/app/familia/reportes/[sessionId]/FamiliaReportesSessionidPanel.tsx')
    expect(page).toContain("data.status === 'completed'")
    expect(page).toContain('if (!walk?.completed || !walk.walkerId) return null')
  })

  test('se avisa que no se puede cambiar antes de enviarla, no después', () => {
    expect(read('src/components/family/RateWalker.tsx')).toContain('no se puede cambiar después de enviarla')
  })

  test('con muy pocas reseñas el panel calla el promedio y dice por qué', () => {
    const card = read('src/components/walker/WalkerRatingsCard.tsx')
    expect(card).toContain('summary.average === null')
    expect(card).toContain('summary.pendingReason')
  })
})
