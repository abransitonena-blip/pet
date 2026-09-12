'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { auth } from '@/firebase/config'
import { onAuthStateChanged } from 'firebase/auth'
import { motion } from 'framer-motion'
import {
  CalendarDays, Dog, History, PawPrint, Gift,
  ArrowRight, CheckCircle2, ClipboardList, AlertTriangle, Redo2,
} from 'lucide-react'
import PetAhoraRequestForm from '@/components/PetAhoraRequestForm'
import { getCustomerProfile } from '@/lib/customerProfile'
import PetAhoraStatusTracker from '@/components/PetAhoraStatusTracker'
import WalletCard from '@/components/WalletCard'
import { FEATURE_FLAGS } from '@/lib/featureFlags'
import { usePetAhoraClientRequest } from '@/lib/usePetAhoraWalker'
import { STATUS_LABELS, STATUS_COLORS } from '@/lib/sessionMachine'
import CanonicalFamilyRequests from '@/components/family/CanonicalFamilyRequests'
import { Button, Card, EmptyState, ErrorState } from '@/components/ui'
import { useCanonicalReservations } from '@/lib/useCanonicalReservations'
import { useConfig } from '@/context/ConfigContext'
import { walkTipIcon } from '@/lib/walkTipIcons'
import { canonicalReadErrorMessage } from '@/lib/useCanonicalWalkSessions'
import type { WalkSessionStatus } from '@/lib/domainStates'

/** Requested through confirmed — still ahead of the customer, not yet walked. */
const UPCOMING_STATUSES: WalkSessionStatus[] = [
  'requested', 'pending_assignment', 'assigned', 'confirmed',
]

interface UserProfile {
  name: string
  phone: string
  email: string
}

/** El icono del consejo: de trazo si tiene nombre, el emoji guardado si no. */
function WalkTipMark({ icon }: { icon: string }) {
  const Icon = walkTipIcon(icon)
  if (Icon) {
    return (
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary" aria-hidden="true">
        <Icon size={16} strokeWidth={1.75} />
      </span>
    )
  }
  return icon ? <span className="text-lg" aria-hidden="true">{icon}</span> : null
}

export default function DashboardPage() {
  const router = useRouter()
  const [customerId, setCustomerId] = useState('')
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [activePetAhoraId, setActivePetAhoraId] = useState<string | null>(null)
  const [petAhoraRequested, setPetAhoraRequested] = useState(false)
  const [loadError, setLoadError] = useState('')
  const { request: petAhoraRequest } = usePetAhoraClientRequest(activePetAhoraId)
  const { config } = useConfig()
  // Edited in Configuración → Consejos para el paseo; a half-filled tip is not shown.
  const walkTips = (config.walkTips ?? []).filter((tip) => tip.title?.trim() && tip.text?.trim())

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) { setCustomerId(''); router.push('/login'); return }
      setCustomerId(user.uid)

      const profile = await getCustomerProfile(user.uid)
      if (profile) {
        setProfile(profile as UserProfile)
      }

    })
    return () => { unsubAuth() }
  }, [router])

  const { reservations, loading: sessionsLoading, error: sessionsError, retry } = useCanonicalReservations({
    customerId,
    max: 50,
  })

  useEffect(() => {
    setLoadError(sessionsError ? canonicalReadErrorMessage(sessionsError) : '')
    setLoading(!customerId || sessionsLoading)
  }, [customerId, sessionsLoading, sessionsError])

  const upcoming = reservations.filter((item) => UPCOMING_STATUSES.includes(item.status))
  const completed = reservations.filter((item) => item.status === 'completed')

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-32 rounded-2xl" />
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => <div key={i} className="skeleton h-24 rounded-2xl" />)}
        </div>
        <div className="skeleton h-48 rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Welcome Hero */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-ink/10 bg-surface p-6 relative overflow-hidden shadow-sm"
      >
        <div className="absolute top-0 right-0 w-48 h-48 bg-brand-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative">
          <p className="text-sm mb-1" style={{ color: 'var(--text-muted)' }}>Cuenta</p>
          <h1 className="text-xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
            {profile?.name || 'Familia PET'}
          </h1>
          <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'var(--glass-bg)' }}>
            <div className="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center shrink-0">
              <ClipboardList size={16} className="text-brand-600" />
            </div>
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                Seguimiento de solicitudes
              </p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Consulta abajo el estado real de tus solicitudes actuales.
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {customerId && <CanonicalFamilyRequests customerId={customerId} />}

      {/* Quick Stats */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Tu actividad</p>
        <p className="mt-1 text-xs text-muted">Cifras tomadas de tus paseos registrados.</p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, delay: 0.1 }}
          className="rounded-xl border border-ink/10 bg-surface p-4 shadow-sm cursor-pointer transition-all hover:scale-[1.02]"
          onClick={() => router.push('/familia/nueva-reserva')}
        >
          <div className="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center mb-3">
            <CalendarDays size={16} className="text-brand-600" />
          </div>
          <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{upcoming.length}</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Próximos paseos</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, delay: 0.15 }}
          className="rounded-xl border border-ink/10 bg-surface p-4 shadow-sm cursor-pointer transition-all hover:scale-[1.02]"
          onClick={() => router.push('/familia/historial')}
        >
          <div className="w-10 h-10 rounded-xl bg-success-500/10 flex items-center justify-center mb-3">
            <History size={16} className="text-success-400" />
          </div>
          <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{completed.length}</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Paseos completados</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, delay: 0.2 }}
          className="rounded-xl border border-ink/10 bg-surface p-4 shadow-sm cursor-pointer transition-all hover:scale-[1.02]"
          onClick={() => router.push('/familia/lealtad')}
        >
          <div className="w-10 h-10 rounded-xl bg-pink-500/10 flex items-center justify-center mb-3">
            <Gift size={16} className="text-pink-400" />
          </div>
          <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Consulta manual</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Lealtad promocional</p>
        </motion.div>
      </div>

      {/* Wallet */}
      {FEATURE_FLAGS.WALLET_MUTATIONS_ENABLED && <WalletCard compact />}

      {/* PET Ahora — Instant Walk */}
      {activePetAhoraId && petAhoraRequest ? (
        <PetAhoraStatusTracker request={petAhoraRequest} />
      ) : !petAhoraRequested && (
        <PetAhoraRequestForm onRequestCreated={(id) => { setActivePetAhoraId(id); setPetAhoraRequested(true) }} />
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, delay: 0.25 }}
          onClick={() => router.push('/familia/nueva-reserva')}
          className="rounded-2xl p-4 text-left transition-all hover:scale-[1.02] hover:border-brand-500/30"
          style={{ background: 'linear-gradient(135deg, rgba(217,119,6,0.1), rgba(217,119,6,0.05))', border: '1px solid var(--border)' }}
        >
          <CalendarDays size={20} className="text-brand-600 mb-2" />
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Nueva reserva</p>
          <p className="text-xs mt-1 flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
            Agendar un paseo <ArrowRight size={8} />
          </p>
        </motion.button>

        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, delay: 0.3 }}
          onClick={() => router.push('/familia/perros')}
          className="rounded-2xl p-4 text-left transition-all hover:scale-[1.02] hover:border-success-500/30"
          style={{ background: 'linear-gradient(135deg, rgba(5,150,105,0.1), rgba(5,150,105,0.05))', border: '1px solid var(--border)' }}
        >
          <PawPrint size={20} className="text-success-400 mb-2" />
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Mis perros</p>
          <p className="text-xs mt-1 flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
            Registrar peludo <ArrowRight size={8} />
          </p>
        </motion.button>
      </div>

      {/* Recent Reservations */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, delay: 0.35 }}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Mis reservas</h2>
          {reservations.length > 0 && (
            <button
              onClick={() => router.push('/familia/historial')}
              className="text-xs flex items-center gap-1 transition-colors hover:text-brand-600"
              style={{ color: 'var(--text-muted)' }}
            >
              Ver todo <ArrowRight size={8} />
            </button>
          )}
        </div>

        {loadError ? (
          <ErrorState description={loadError} onRetry={retry} />
        ) : reservations.length === 0 ? (
          <Card>
            <EmptyState
              icon={<CalendarDays size={28} />}
              title="No tienes reservas aún"
              description="Tu primer paseo está a un clic de distancia"
              action={<Button size="sm" onClick={() => router.push('/familia/nueva-reserva')}>Reservar ahora</Button>}
            />
          </Card>
        ) : (
          <div className="space-y-2">
            {reservations.slice(0, 5).map((res, i) => (
              <motion.div
                key={res.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.22, delay: 0.4 + i * 0.05 }}
                className="rounded-xl border border-ink/10 bg-surface p-3 shadow-sm flex items-center gap-3 transition-all hover:bg-ink/5"
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${STATUS_COLORS[res.status]?.bg || 'bg-ink/5'}`}>
                  {res.status === 'completed' ? <CheckCircle2 size={14} className="text-success-400" /> :
                   res.status === 'cancelled' ? <AlertTriangle size={14} className="text-danger-400" /> :
                   <Dog size={14} className="text-brand-600" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{res.service}</p>
                  <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                    <span>{res.petName}</span>
                    <span>·</span>
                    <span>{res.date}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {res.status === 'completed' && (
                    <button
                      onClick={(e) => { e.preventDefault(); router.push(`/familia/nueva-reserva?repeat=${encodeURIComponent(res.service)}`) }}
                      className="flex items-center gap-1 text-2xs px-2 py-1 rounded-lg font-medium transition-all hover:bg-brand-500/10 text-brand-600 border border-brand-500/20"
                      title="Repetir este paseo"
                    >
                      <Redo2 size={8} /> Repetir
                    </button>
                  )}
                  <span className={`text-2xs px-2 py-0.5 rounded-full font-medium shrink-0 ${STATUS_COLORS[res.status]?.bg || 'bg-ink/10'} ${STATUS_COLORS[res.status]?.text || 'text-[var(--text-muted)]'}`}>
                    {STATUS_LABELS[res.status] || res.status}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>

      {walkTips.length > 0 && (
        <section aria-labelledby="walk-tips-title">
          <h2 id="walk-tips-title" className="mb-3 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Consejos para el paseo
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {walkTips.map((tip, index) => (
              <li key={`${tip.title}-${index}`} className="rounded-xl border border-ink/10 bg-surface p-4 shadow-sm">
                <WalkTipMark icon={tip.icon} />
                <p className="mt-1 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{tip.title}</p>
                <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>{tip.text}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
