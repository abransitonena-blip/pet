'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { onAuthStateChanged } from 'firebase/auth'
import { useRouter } from 'next/navigation'
import { Camera, FileText, MapPin } from 'lucide-react'
import { auth } from '@/firebase/config'
import { Button, Card, EmptyState, ErrorState, LoadingState } from '@/components/ui'
import { canonicalReadErrorMessage, useCustomerWalkSessions } from '@/lib/useCanonicalWalkSessions'
import { FEATURE_FLAGS } from '@/lib/featureFlags'

/**
 * Lo que sí existe de cada paseo terminado.
 *
 * This page used to be a hardcoded empty state promising that photos "will
 * appear here". They will not, at least not yet: operational photo uploads are
 * deliberately off for the MVP (see MEDIA_POLICY.md), so the promise was
 * something the app could never keep no matter how many walks the family
 * booked.
 *
 * It now lists the family's completed walks and links to the report the walker
 * actually wrote for each one, and says plainly why there are no photos. When
 * uploads are turned on, the same list is where they will hang.
 */

export default function FotosPage() {
  const router = useRouter()
  const [uid, setUid] = useState('')
  const [checkingAuth, setCheckingAuth] = useState(true)
  const { sessions, loading, error, retry } = useCustomerWalkSessions(uid)

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      if (!user) { router.push('/login'); return }
      setUid(user.uid)
      setCheckingAuth(false)
    })
  }, [router])

  const completed = sessions
    .filter((session) => session.status === 'completed')
    .sort((a, b) => (b.scheduledDate ?? '').localeCompare(a.scheduledDate ?? ''))

  if (checkingAuth || loading) {
    return <LoadingState message="Consultando tus paseos…" rows={3} height="h-16" />
  }

  if (error) {
    return (
      <Card className="p-4 shadow-none">
        <ErrorState description={canonicalReadErrorMessage(error)} onRetry={retry} />
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-ink">Tus paseos terminados</h1>
        <p className="mt-1 text-sm text-muted">
          {FEATURE_FLAGS.PRIVATE_MEDIA_UPLOADS_ENABLED
            ? 'Aquí encontrarás las fotos y el reporte de cada paseo.'
            : 'Las fotos de paseo todavía no están habilitadas. Mientras tanto, cada paseo terminado tiene su reporte escrito por el paseador.'}
        </p>
      </div>

      {completed.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Camera size={28} />}
            title="Todavía no tienes paseos terminados"
            description="Cuando un paseo se complete, su reporte aparecerá aquí."
            action={<Button size="sm" onClick={() => router.push('/familia/nueva-reserva')}>Reservar un paseo</Button>}
          />
        </Card>
      ) : (
        <div className="space-y-2">
          {completed.map((session) => (
            <Card key={session.id} className="flex flex-wrap items-center justify-between gap-3 p-4 shadow-none">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink">{session.scheduledDate || 'Sin fecha'}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-muted">
                  <span>{session.scheduledStart || 'Sin hora'}</span>
                  {session.endLocation && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin size={11} aria-hidden="true" /> Ubicación registrada
                    </span>
                  )}
                </p>
              </div>
              <Link
                href={`/familia/reportes/${encodeURIComponent(session.id)}`}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary/10 px-4 text-sm font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <FileText size={15} aria-hidden="true" /> Ver reporte
              </Link>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
