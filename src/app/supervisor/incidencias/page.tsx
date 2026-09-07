'use client'

import { useState, useEffect } from 'react'
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore'
import { db } from '@/firebase/config'
import { PageHeader, DataCard, EmptyState, LoadingState } from '@/components/ui'
import { AlertTriangle } from 'lucide-react'

interface ReviewDoc {
  id: string
  rating?: number
  comment?: string
  author?: string
  customerId?: string
}

export default function SupervisorIncidencias() {
  const [loading, setLoading] = useState(true)
  const [reviews, setReviews] = useState<ReviewDoc[]>([])

  useEffect(() => {
    const q = query(collection(db, 'reviews'), orderBy('createdAt', 'desc'), limit(30))
    const unsub = onSnapshot(q, (snap) => {
      setReviews(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ReviewDoc))
      setLoading(false)
    })
    return unsub
  }, [])

  const lowRatings = reviews.filter((r) => typeof r.rating === 'number' && r.rating <= 3)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Incidencias y reportes"
        description="Revisión de reseñas y reportes de baja calificación. Solo lectura."
        icon={<AlertTriangle size={20} />}
      />

      <DataCard title={`Incidencias potenciales (${lowRatings.length})`} padded={false}>
        {loading ? (
          <LoadingState message="Cargando reportes..." rows={4} />
        ) : lowRatings.length === 0 ? (
          <EmptyState icon={<AlertTriangle size={20} />} title="Sin incidencias" description="No hay reportes de baja calificación en este momento." />
        ) : (
          <ul className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {lowRatings.map((r) => (
              <li key={r.id} className="px-4 py-3">
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  {'★'.repeat(r.rating ?? 0)}{'☆'.repeat(5 - (r.rating ?? 0))}
                </p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{r.comment || 'Sin comentario'}</p>
              </li>
            ))}
          </ul>
        )}
      </DataCard>
    </div>
  )
}
