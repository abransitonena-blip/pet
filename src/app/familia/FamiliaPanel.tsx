'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { auth } from '@/firebase/config'
import { onAuthStateChanged } from 'firebase/auth'
import {
  AlertTriangle, ArrowRight, CalendarDays, CheckCircle2, ChevronDown, Clock, Dog, MessagesSquare, Plus, Redo2, Syringe, Zap,
} from 'lucide-react'
import PetAhoraRequestForm from '@/components/PetAhoraRequestForm'
import { getCustomerProfile } from '@/lib/customerProfile'
import PetAhoraStatusTracker from '@/components/PetAhoraStatusTracker'
import WalletCard from '@/components/WalletCard'
import WalkerCard from '@/components/family/WalkerCard'
import CancelWalkButton from '@/components/family/CancelWalkButton'
import RescheduleWalkButton from '@/components/family/RescheduleWalkButton'
import WalkRouteMap from '@/components/walks/WalkRouteMap'
import { FEATURE_FLAGS } from '@/lib/featureFlags'
import { usePetAhoraClientRequest } from '@/lib/usePetAhoraWalker'
import { STATUS_LABELS, STATUS_COLORS } from '@/lib/sessionMachine'
import { Card, EmptyState, ErrorState } from '@/components/ui'
import { useCanonicalReservations } from '@/lib/useCanonicalReservations'
import { useConfig } from '@/context/ConfigContext'
import { walkTipIcon } from '@/lib/walkTipIcons'
import { canonicalReadErrorMessage } from '@/lib/useCanonicalWalkSessions'
import { hasWalker, planFamilyHome, walkToRate, whenLabel } from '@/lib/familyHome'
import RateWalker from '@/components/family/RateWalker'
import DogAvatar from '@/components/dogs/DogAvatar'
import { useFamilyDogs, type FamilyDog } from '@/lib/useFamilyDogs'
import { useDogPhotos } from '@/lib/useDogPhotos'
import { careReminderLabel, careReminders } from '@/lib/dogCareReminders'
import PushNudge from '@/components/push/PushNudge'

interface UserProfile {
  name: string
  phone: string
  email: string
}

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary'

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

/**
 * Las caras de los perros de un paseo.
 *
 * El inicio hablaba de "tu próximo paseo" sin enseñar nunca al perro: sólo su
 * nombre escrito. Con foto sale su foto; sin foto, la marca teñida por el grupo
 * de su raza, que es la misma que ve el paseador en su ficha.
 */
function WalkDogFaces({
  ids, dogs, photos, size = 40,
}: {
  ids: readonly string[]
  dogs: Record<string, FamilyDog>
  photos: Record<string, string>
  size?: number
}) {
  const known = ids.map((id) => dogs[id]).filter(Boolean).slice(0, 2)
  if (known.length === 0) return null
  return (
    <span className="flex shrink-0 -space-x-2">
      {known.map((dog) => (
        <DogAvatar
          key={dog.id}
          name={dog.name}
          breed={dog.breed}
          photoUrl={photos[dog.id] ?? ''}
          size={size}
          className="ring-2 ring-surface"
        />
      ))}
    </span>
  )
}

function StatusPill({ status }: { status: string }) {
  const colors = STATUS_COLORS[status]
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${colors?.bg || 'bg-ink/10'} ${colors?.text || 'text-muted'}`}>
      {STATUS_LABELS[status] || status}
    </span>
  )
}

/**
 * El inicio de la familia. Abre con lo que alguien viene a hacer: ver cuándo
 * es su próximo paseo y quién lo lleva, o pedir otro. Lo demás está a un toque.
 */
export default function DashboardPage() {
  const router = useRouter()
  const [customerId, setCustomerId] = useState('')
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [activePetAhoraId, setActivePetAhoraId] = useState<string | null>(null)
  const [petAhoraOpen, setPetAhoraOpen] = useState(false)
  const [tipsOpen, setTipsOpen] = useState(false)
  const [loadError, setLoadError] = useState('')
  const { request: petAhoraRequest } = usePetAhoraClientRequest(activePetAhoraId)
  const { config } = useConfig()
  // Edited in Configuración → Consejos para el paseo; a half-filled tip is not shown.
  const walkTips = (config.walkTips ?? []).filter((tip) => tip.title?.trim() && tip.text?.trim())
  // Si PET Ahora no está disponible, no se ofrece: antes ocupaba el inicio con
  // un aviso de "en preparación".
  const petAhoraAvailable = FEATURE_FLAGS.PET_AHORA_ENABLED && config.features.petAhoraEnabled && config.maintenance !== true

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
  // Los perros de la casa: para ponerles cara en el inicio y para recordar el
  // refuerzo que la familia anotó y nadie le volvía a mencionar.
  const { dogs: familyDogs } = useFamilyDogs(customerId)
  const dogPhotos = useDogPhotos(familyDogs.map((dog) => ({ id: dog.id, reference: dog.photoReference })))
  const dogsById = Object.fromEntries(familyDogs.map((dog) => [dog.id, dog]))

  useEffect(() => {
    setLoadError(sessionsError ? canonicalReadErrorMessage(sessionsError) : '')
    setLoading(!customerId || sessionsLoading)
  }, [customerId, sessionsLoading, sessionsError])

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-20 rounded-2xl" />
        <div className="skeleton h-40 rounded-2xl" />
        <div className="skeleton h-32 rounded-2xl" />
      </div>
    )
  }

  const today = new Date().toLocaleDateString('en-CA')
  const home = planFamilyHome(reservations)
  const next = home.next
  // Al terminar un paseo se pregunta cómo estuvo, como pediría cualquiera que
  // acaba de recibir un servicio. Si ya se calificó, la tarjeta no aparece.
  const pendingRating = walkToRate(reservations, today)
  const reminders = careReminders(familyDogs, today)

  return (
    <div className="animate-enter space-y-6">
      <section aria-labelledby="family-greeting" className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-muted">Hola</p>
          <h1 id="family-greeting" className="truncate text-2xl font-bold text-ink">{profile?.name || 'Familia PET'}</h1>
        </div>
        <Link href="/familia/nueva-reserva" className={`btn-primary inline-flex min-h-11 items-center gap-2 ${FOCUS_RING}`}>
          <Plus size={16} aria-hidden="true" /> Solicitar paseo
        </Link>
      </section>

      {/* El control para activar avisos vivía en Notificaciones, donde nadie
          entra. Aquí se ofrece una vez, y quien diga que no no lo vuelve a ver. */}
      <PushNudge message="Entérate en cuanto tu paseador salga, llegue y termine el paseo, aunque tengas la app cerrada." />

      {loadError ? (
        <ErrorState description={loadError} onRetry={retry} />
      ) : (
        <section aria-labelledby="next-walk-title" className="space-y-2">
          <h2 id="next-walk-title" className="flex items-center gap-2 text-base font-bold text-ink">
            {/* El punto late sólo cuando el paseo está ocurriendo: el color no
                es el único aviso, el texto ya lo dice. */}
            {home.live && <span className="animate-live h-2 w-2 shrink-0 rounded-full bg-success-500" aria-hidden="true" />}
            {home.live ? 'Tu paseo, ahora' : 'Tu próximo paseo'}
          </h2>
          {next ? (
            <Card className="space-y-3 p-4 shadow-none">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <WalkDogFaces ids={next.dogIds} dogs={dogsById} photos={dogPhotos} size={44} />
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-ink">{next.petName || next.service}</p>
                    {next.petName && <p className="truncate text-sm text-muted">{next.service}</p>}
                  </div>
                </div>
                <StatusPill status={next.status} />
              </div>
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink">
                <span className="inline-flex items-center gap-1.5"><CalendarDays size={15} className="text-muted" aria-hidden="true" />{whenLabel(next.date, today)}</span>
                {(next.arrivalWindowStart || next.time) && (
                  <span className="inline-flex items-center gap-1.5">
                    <Clock size={15} className="text-muted" aria-hidden="true" />
                    {next.arrivalWindowStart
                      ? `Llega entre ${next.arrivalWindowStart}${next.arrivalWindowEnd ? ` y ${next.arrivalWindowEnd}` : ''}`
                      : next.time}
                  </span>
                )}
              </p>
              {/* Mientras el paseo ocurre, la familia ve por dónde van. El
                  teléfono del paseador manda una lectura cada ~2 minutos, así
                  que el mapa se vuelve a pedir cada minuto y dice de cuándo es
                  la última. */}
              {home.live && <WalkRouteMap sessionId={next.id} refreshEveryMs={60_000} live />}

              {/* Cancelar estaba sólo por WhatsApp: una familia con un
                  imprevisto tenía que escribir y esperar. */}
              <div className="flex flex-wrap gap-2">
                <RescheduleWalkButton sessionId={next.id} uid={customerId} status={next.status} currentDate={next.date} />
                <CancelWalkButton sessionId={next.id} uid={customerId} status={next.status} dogName={next.petName} />
              </div>

              {hasWalker(next) ? (
                <>
                  <WalkerCard sessionId={next.id} />
                  <Link href="/familia/mensajes" className={`inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary/10 px-4 text-sm font-semibold text-primary ${FOCUS_RING}`}>
                    <MessagesSquare size={16} aria-hidden="true" /> Escribir a tu paseador
                  </Link>
                </>
              ) : next.status === 'requested' || next.status === 'pending_assignment' ? (
                <p className="text-sm text-muted">El equipo PET revisa tu solicitud antes de asignarte un paseador.</p>
              ) : null}
            </Card>
          ) : (
            <Card className="shadow-none">
              <EmptyState
                icon={<CalendarDays size={24} />}
                title="No tienes paseos por delante"
                description="Cuando solicites uno, aquí verás cuándo llega y quién lo lleva."
              />
            </Card>
          )}
          {home.laterCount > 0 && (
            <Link href="/familia/historial" className={`inline-flex min-h-11 items-center gap-1.5 rounded-xl px-1 text-sm font-semibold text-primary ${FOCUS_RING}`}>
              {home.laterCount === 1 ? 'Y 1 paseo más por delante' : `Y ${home.laterCount} paseos más por delante`} <ArrowRight size={14} aria-hidden="true" />
            </Link>
          )}
        </section>
      )}

      {pendingRating && (
        <RateWalker
          sessionId={pendingRating.id}
          walkerId={pendingRating.assignedWalker}
          walkerName={pendingRating.walkerName || 'tu paseador'}
          dogName={pendingRating.petName}
          hideWhenRated
        />
      )}

      {/* El refuerzo que la familia anotó y no volvía a ver. Sólo sale cuando
          hay algo que hacer: un refuerzo vencido o uno de los próximos 30 días.
          La vigencia no se inventa; si no hay fecha escrita, no hay renglón. */}
      {reminders.length > 0 && (
        <section aria-labelledby="dog-care-title">
          <h2 id="dog-care-title" className="mb-2 flex items-center gap-2 text-base font-bold text-ink">
            <Syringe size={16} className="text-muted" aria-hidden="true" /> Cuidados de tus perros
          </h2>
          <ul className="space-y-2">
            {reminders.map((reminder) => (
              <li key={reminder.dogId}>
                <Link
                  href={`/familia/perros/${reminder.dogId}`}
                  className={`flex items-center gap-3 rounded-xl border p-3 transition-colors motion-reduce:transition-none ${FOCUS_RING} ${
                    reminder.urgency === 'vencida'
                      ? 'border-danger-500/25 bg-danger-500/[0.06] hover:bg-danger-500/10'
                      : 'border-warning/30 bg-warning/[0.08] hover:bg-warning/15'
                  }`}
                >
                  <DogAvatar
                    name={reminder.dogName}
                    breed={reminder.breed}
                    photoUrl={dogPhotos[reminder.dogId] ?? ''}
                    size={40}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">{reminder.dogName}</span>
                    <span className={`block text-xs ${reminder.urgency === 'vencida' ? 'text-red-700' : 'text-amber-900'}`}>
                      {careReminderLabel(reminder)}
                    </span>
                  </span>
                  <ArrowRight size={16} className="shrink-0 text-muted" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-2 px-1 text-xs text-muted">
            La fecha es la que anotaste en el perfil de tu perro. Cuándo toca cada refuerzo lo decide su
            veterinario.
          </p>
        </section>
      )}

      {/* PET Ahora — paseo al instante. El formulario lee perros y direcciones,
          así que se monta cuando alguien lo pide, no al abrir el inicio. */}
      {activePetAhoraId && petAhoraRequest ? (
        <PetAhoraStatusTracker request={petAhoraRequest} />
      ) : petAhoraAvailable && (
        <section aria-label="PET Ahora">
          {petAhoraOpen ? (
            <PetAhoraRequestForm onRequestCreated={(id) => setActivePetAhoraId(id)} />
          ) : (
            <button
              type="button"
              onClick={() => setPetAhoraOpen(true)}
              className={`flex w-full items-center gap-3 rounded-2xl border border-ink/10 bg-surface p-4 text-left transition-colors hover:bg-ink/[0.03] motion-reduce:transition-none ${FOCUS_RING}`}
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-warning-100 text-warning-600" aria-hidden="true"><Zap size={18} /></span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-ink">¿Lo necesitas ya?</span>
                <span className="block text-sm text-muted">Pide un paseo al instante con PET Ahora</span>
              </span>
              <ArrowRight size={16} className="text-muted" aria-hidden="true" />
            </button>
          )}
        </section>
      )}

      {!loadError && (
        <section aria-labelledby="recent-walks-title">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 id="recent-walks-title" className="text-base font-bold text-ink">Tus últimos paseos</h2>
            {reservations.length > 0 && (
              <Link href="/familia/historial" className={`inline-flex min-h-11 items-center gap-1 rounded-xl px-2 text-sm font-semibold text-primary ${FOCUS_RING}`}>
                Ver todo <ArrowRight size={14} aria-hidden="true" />
              </Link>
            )}
          </div>
          {home.recent.length === 0 ? (
            <p className="text-sm text-muted">Todavía no terminas ningún paseo con nosotros.</p>
          ) : (
            <ul className="animate-enter-list space-y-2">
              {home.recent.map((res) => (
                <li key={res.id} className="flex items-center gap-3 rounded-xl border border-ink/10 bg-surface p-3">
                  {/* La cara del perro identifica el renglón mejor que un
                      cuadro de color; el estado ya va escrito abajo. */}
                  {res.dogIds.some((id) => dogsById[id]) ? (
                    <WalkDogFaces ids={res.dogIds} dogs={dogsById} photos={dogPhotos} size={40} />
                  ) : (
                    <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${STATUS_COLORS[res.status]?.bg || 'bg-ink/5'}`} aria-hidden="true">
                      {res.status === 'completed' ? <CheckCircle2 size={16} className="text-success-600" />
                        : res.status === 'cancelled' ? <AlertTriangle size={16} className="text-danger-500" />
                        : <Dog size={16} className="text-brand-600" />}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{res.petName || res.service}</p>
                    <p className="truncate text-xs text-muted">{whenLabel(res.date, today)} · {STATUS_LABELS[res.status] || res.status}</p>
                  </div>
                  {res.status === 'completed' && (
                    <Link
                      href={`/familia/nueva-reserva?repeat=${encodeURIComponent(res.service)}`}
                      aria-label={`Repetir ${res.service}${res.petName ? ` con ${res.petName}` : ''}`}
                      className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl border border-brand-500/20 px-3 text-sm font-medium text-brand-600 hover:bg-brand-500/10 ${FOCUS_RING}`}
                    >
                      <Redo2 size={14} aria-hidden="true" /> Repetir
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Wallet */}
      {FEATURE_FLAGS.WALLET_MUTATIONS_ENABLED && <WalletCard compact />}

      {walkTips.length > 0 && (
        <section aria-labelledby="walk-tips-title">
          <h2 id="walk-tips-title">
            <button
              type="button"
              onClick={() => setTipsOpen((open) => !open)}
              aria-expanded={tipsOpen}
              aria-controls="walk-tips-panel"
              className={`flex min-h-11 w-full items-center justify-between gap-2 rounded-xl px-1 text-left text-base font-bold text-ink ${FOCUS_RING}`}
            >
              Consejos para el paseo
              <ChevronDown size={18} aria-hidden="true" className={`text-muted transition-transform motion-reduce:transition-none ${tipsOpen ? 'rotate-180' : ''}`} />
            </button>
          </h2>
          <ul id="walk-tips-panel" hidden={!tipsOpen} className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {walkTips.map((tip, index) => (
              <li key={`${tip.title}-${index}`} className="rounded-xl border border-ink/10 bg-surface p-4">
                <WalkTipMark icon={tip.icon} />
                <p className="mt-1 text-sm font-semibold text-ink">{tip.title}</p>
                <p className="mt-1 text-sm text-muted">{tip.text}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
