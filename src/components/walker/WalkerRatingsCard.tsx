'use client'

import { useEffect, useMemo, useState } from 'react'
import { collection, limit, onSnapshot, query, where } from 'firebase/firestore'
import { Star } from 'lucide-react'
import { db } from '@/firebase/config'
import Card from '@/components/ui/Card'
import { summarizeWalkerRatings } from '@/lib/walkerReviews'

/**
 * Lo que las familias dijeron de este paseador.
 *
 * Cada calificación viene de un paseo suyo que terminó, dejada por la familia de
 * ese paseo. Por eso el promedio significa algo: no se puede inflar escribiendo
 * más, sólo paseando más.
 *
 * Con menos de tres no se muestra promedio y se dice por qué. Un "5.0" con una
 * sola reseña no describe a nadie, y presentarlo como si lo hiciera es peor que
 * no mostrar nada.
 */

// firestore.rules limita esta lista a 100 (validListLimit).
const MAX_REVIEWS = 100

interface Review {
  id: string
  rating: number
  text: string
  at: number | null
}

function formatDate(at: number | null): string {
  if (at === null) return ''
  return new Date(at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function WalkerRatingsCard({ uid }: { uid: string }) {
  const [reviews, setReviews] = useState<Review[]>([])
  const [denied, setDenied] = useState(false)

  useEffect(() => {
    if (!uid) return
    return onSnapshot(
      query(collection(db, 'walkerReviews'), where('walkerId', '==', uid), limit(MAX_REVIEWS)),
      (snapshot) => {
        setDenied(false)
        setReviews(snapshot.docs.map((item) => {
          const data = item.data()
          const at = data.createdAt as { seconds?: unknown } | undefined
          return {
            id: item.id,
            rating: Number(data.rating) || 0,
            text: String(data.text ?? ''),
            at: typeof at?.seconds === 'number' ? at.seconds * 1000 : null,
          }
        }))
      },
      () => setDenied(true),
    )
  }, [uid])

  const summary = useMemo(() => summarizeWalkerRatings(reviews), [reviews])
  const withComment = useMemo(
    () => reviews.filter((item) => item.text.trim()).sort((a, b) => (b.at ?? 0) - (a.at ?? 0)).slice(0, 5),
    [reviews],
  )

  if (denied) return null

  return (
    <Card className="p-4 shadow-none sm:p-5">
      <div className="mb-1 flex items-center gap-2">
        <Star size={17} className="text-primary" aria-hidden="true" />
        <h2 className="font-bold text-ink">Lo que dicen las familias</h2>
      </div>
      <p className="mb-4 text-xs text-muted">
        Cada calificación viene de un paseo tuyo que terminó, dejada por la familia de ese paseo.
      </p>

      {summary.average === null ? (
        <p className="rounded-xl bg-ink/[0.04] p-3 text-sm text-muted">{summary.pendingReason}</p>
      ) : (
        <>
          <div className="flex items-baseline gap-2">
            <p className="text-3xl font-bold tabular-nums text-ink">{summary.average.toFixed(1)}</p>
            <p className="text-sm text-muted">de 5 · {summary.count} calificaciones</p>
          </div>
          <ul className="mt-3 space-y-1">
            {([5, 4, 3, 2, 1] as const).map((star) => {
              const amount = summary.distribution[star]
              const share = summary.count > 0 ? Math.round((amount / summary.count) * 100) : 0
              return (
                <li key={star} className="flex items-center gap-2 text-xs text-muted">
                  <span className="w-10 shrink-0 tabular-nums">{star} ★</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-ink/[0.06]">
                    <span className="block h-full rounded-full bg-primary/60" style={{ width: `${share}%` }} />
                  </span>
                  <span className="w-8 shrink-0 text-right tabular-nums">{amount}</span>
                </li>
              )
            })}
          </ul>
        </>
      )}

      {withComment.length > 0 && (
        <ul className="mt-4 space-y-2 border-t border-ink/[0.06] pt-3">
          {withComment.map((item) => (
            <li key={item.id} className="rounded-xl bg-ink/[0.03] px-3 py-2">
              <p className="flex items-center gap-1" aria-label={`${item.rating} de 5 estrellas`}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star key={star} size={12} className={star <= item.rating ? 'fill-primary text-primary' : 'text-muted'} aria-hidden="true" />
                ))}
                <span className="ml-1 text-2xs text-muted">{formatDate(item.at)}</span>
              </p>
              <p className="mt-1 text-sm text-ink">{item.text}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
