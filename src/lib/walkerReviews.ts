/**
 * La calificación que una familia le deja a su paseador.
 *
 * Una reseña vale por quién la escribe: aquí sólo puede dejarla la familia de un
 * paseo que de verdad ocurrió, una vez por paseo. No hay formulario abierto ni
 * reseñas anónimas, así que un promedio no se puede inflar escribiendo más.
 *
 * Por eso el documento se identifica con el id del paseo: dos reseñas del mismo
 * paseo son imposibles sin borrar la primera, y borrar no está permitido.
 */

export const WALKER_REVIEW_TEXT_LIMIT = 600
/** Debajo de esto, un promedio dice más del azar que del paseador. */
export const MIN_REVIEWS_FOR_AVERAGE = 3

export interface WalkerReview {
  sessionId: string
  walkerId: string
  customerId: string
  rating: number
  text: string
  createdAt?: unknown
}

export type WalkerReviewError = 'rating-out-of-range' | 'text-too-long'

export function validateWalkerReview(review: { rating: number; text: string }): WalkerReviewError[] {
  const errors: WalkerReviewError[] = []
  if (!Number.isInteger(review.rating) || review.rating < 1 || review.rating > 5) errors.push('rating-out-of-range')
  if (review.text.length > WALKER_REVIEW_TEXT_LIMIT) errors.push('text-too-long')
  return errors
}

export function walkerReviewErrorMessage(error: WalkerReviewError): string {
  if (error === 'rating-out-of-range') return 'Elige de 1 a 5 estrellas.'
  return `El comentario no puede pasar de ${WALKER_REVIEW_TEXT_LIMIT} caracteres.`
}

export interface WalkerRatingSummary {
  count: number
  /** Promedio con un decimal, o null mientras haya muy pocas para decir algo. */
  average: number | null
  /** Cuántas reseñas de cada calificación, de 1 a 5. */
  distribution: Record<1 | 2 | 3 | 4 | 5, number>
  /** Por qué no hay promedio, cuando no lo hay. */
  pendingReason: string
}

export function summarizeWalkerRatings(reviews: readonly { rating: number }[]): WalkerRatingSummary {
  const distribution: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  let total = 0
  let count = 0

  for (const review of reviews) {
    if (!Number.isInteger(review.rating) || review.rating < 1 || review.rating > 5) continue
    distribution[review.rating as 1 | 2 | 3 | 4 | 5] += 1
    total += review.rating
    count += 1
  }

  if (count < MIN_REVIEWS_FOR_AVERAGE) {
    return {
      count,
      average: null,
      distribution,
      pendingReason: count === 0
        ? 'Todavía no tienes calificaciones.'
        : `Con ${count} calificaci${count === 1 ? 'ón' : 'ones'} todavía no mostramos promedio: hacen falta ${MIN_REVIEWS_FOR_AVERAGE}.`,
    }
  }

  return {
    count,
    average: Math.round((total / count) * 10) / 10,
    distribution,
    pendingReason: '',
  }
}
