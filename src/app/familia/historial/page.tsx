'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { auth } from '@/firebase/config'
import { onAuthStateChanged } from 'firebase/auth'
import { motion } from 'framer-motion'
import Link from 'next/link'
import {
  History, Dog, CheckCircle2, CalendarDays, Clock, ArrowLeft, Camera, Redo2,
} from 'lucide-react'
import { STATUS_LABELS, STATUS_COLORS } from '@/lib/sessionMachine'
import { useCanonicalReservations } from '@/lib/useCanonicalReservations'
import { canonicalReadErrorMessage } from '@/lib/useCanonicalWalkSessions'
import CanonicalFamilyHistory from '@/components/family/CanonicalFamilyHistory'
import ReviewForm from '@/components/ReviewForm'
import { Button, Card, EmptyState, ErrorState } from '@/components/ui'

export default function HistorialPage() {
  const router = useRouter()
  const [customerId, setCustomerId] = useState('')
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'completed' | 'cancelled'>('all')

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (!user) { setCustomerId(''); router.push('/login'); return }
      setCustomerId(user.uid)
    })
    return () => { unsubAuth() }
  }, [router])

  const { reservations, loading: sessionsLoading, error: sessionsError, retry } = useCanonicalReservations({
    customerId,
    max: 50,
  })

  useEffect(() => {
    setLoading(!customerId || sessionsLoading)
  }, [customerId, sessionsLoading])

  const filtered = filter === 'all' ? reservations : reservations.filter((r) => r.status === filter)
  const completedCount = reservations.filter((r) => r.status === 'completed').length

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="skeleton h-10 w-48 rounded-xl" />
        <div className="skeleton h-8 rounded-xl" />
        {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-20 rounded-xl" />)}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/familia')}
            className="flex h-11 w-11 items-center justify-center rounded-xl transition-colors hover:bg-ink/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            style={{ color: 'var(--text-muted)' }}
            aria-label="Volver al inicio de Familia PET"
          >
            <ArrowLeft size={14} />
          </button>
          <div>
            <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Mi historial</h1>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {completedCount} paseo{completedCount !== 1 ? 's' : ''} completado{completedCount !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      </div>

      <section aria-labelledby="canonical-history-title" className="space-y-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Historial canónico</p>
          <h2 id="canonical-history-title" className="mt-1 text-base font-bold text-ink">Solicitudes y paseos actuales</h2>
        </div>
        {customerId && <CanonicalFamilyHistory customerId={customerId} />}
      </section>

      <section aria-labelledby="familia-review-title" className="space-y-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Tu opinión</p>
          <h2 id="familia-review-title" className="mt-1 text-base font-bold text-ink">Deja tu reseña</h2>
        </div>
        <ReviewForm />
      </section>

      <div className="border-t border-ink/10 pt-5">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Todos tus paseos</p>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {([
          { value: 'all' as const, label: 'Todos', count: reservations.length },
          { value: 'completed' as const, label: 'Completados', count: reservations.filter((r) => r.status === 'completed').length },
          { value: 'cancelled' as const, label: 'Cancelados', count: reservations.filter((r) => r.status === 'cancelled').length },
        ]).map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className="min-h-11 rounded-xl px-3 text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            style={{
              background: filter === f.value ? 'var(--color-primary-light)' : 'transparent',
              color: filter === f.value ? 'var(--color-primary)' : 'var(--text-muted)',
              border: filter === f.value ? '1px solid var(--color-primary)' : '1px solid transparent',
            }}
          >
            {f.label} ({f.count})
          </button>
        ))}
      </div>

      {sessionsError ? (
        <ErrorState description={canonicalReadErrorMessage(sessionsError)} onRetry={retry} />
      ) : filtered.length === 0 ? (
        <Card className="p-8">
          <EmptyState
            icon={<History size={28} />}
            title={filter === 'all' ? 'No hay reservas en tu historial' : `No hay reservas ${filter === 'completed' ? 'completadas' : 'canceladas'}`}
            description="Tu historial se actualizará automáticamente"
            action={<Button size="sm" onClick={() => router.push('/familia/nueva-reserva')}>Reservar un paseo</Button>}
          />
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((res, i) => {
            return (
              <motion.div
                key={res.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, delay: i * 0.03 }}
                className="rounded-xl border border-ink/10 bg-surface shadow-sm overflow-hidden"
              >
                <div
                  className="p-4 flex items-start gap-3 transition-all hover:bg-ink/5"
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${STATUS_COLORS[res.status]?.bg || 'bg-brand-500/10'}`}>
                    {res.status === 'completed' ? <CheckCircle2 size={14} className="text-success-400" /> :
                     res.status === 'cancelled' ? <span className="text-red-700 text-sm">✕</span> :
                     <Dog size={14} className="text-brand-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{res.service}</p>
                      <div className="flex items-center gap-2 shrink-0">
                        {res.status === 'completed' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              router.push(`/familia/nueva-reserva?repeat=${encodeURIComponent(res.service)}`)
                            }}
                            className="flex items-center gap-1 text-2xs px-2 py-1 rounded-lg font-medium transition-all hover:bg-brand-500/10 text-brand-600 border border-brand-500/20"
                            title="Repetir este paseo"
                          >
                            <Redo2 size={8} /> Repetir
                          </button>
                        )}
                    {res.status === 'completed' && (
                      <Link
                        href={`/familia/reportes/${res.id}`}
                        onClick={(event) => event.stopPropagation()}
                        className="mt-1.5 inline-flex items-center gap-1 text-2xs text-brand-600 hover:underline"
                      >
                        <Camera size={8} /> Ver reporte del paseo
                      </Link>
                    )}
                        <span className={`text-2xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[res.status]?.bg || 'bg-ink/10'} ${STATUS_COLORS[res.status]?.text || 'text-[var(--text-muted)]'}`}>
                          {STATUS_LABELS[res.status] || res.status}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                      <span className="flex items-center gap-1"><Dog size={10} /> {res.petName}</span>
                      <span className="flex items-center gap-1"><CalendarDays size={10} /> {res.date}</span>
                      {res.time && <span className="flex items-center gap-1"><Clock size={10} /> {res.arrivalWindowStart ? `${res.arrivalWindowStart}${res.arrivalWindowEnd ? `-${res.arrivalWindowEnd}` : ''}` : res.time}</span>}
                    </div>
                  </div>
                </div>

              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
