'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { AlertTriangle, ArrowLeft, ChevronDown, FileText, Pencil, Phone, Syringe } from 'lucide-react'
import { auth, db } from '@/firebase/config'
import { Card, EmptyState, ErrorState, LoadingState } from '@/components/ui'
import DogAvatar from '@/components/dogs/DogAvatar'
import DogPhotoButton from '@/components/family/DogPhotoButton'
import { useDogPhotos } from '@/lib/useDogPhotos'
import { isDogPhotoReference } from '@/lib/dogPhotos'
import { canonicalReadErrorMessage, useCustomerWalkSessions } from '@/lib/useCanonicalWalkSessions'
import EmergencyTagSection from '@/components/family/EmergencyTagSection'
import { dogAlerts } from '@/lib/dogHealth'
import { mexicoCityToday } from '@/lib/customerSegments'

/**
 * Perfil de la mascota.
 *
 * Everything the family has told us about their dog, gathered on one page
 * with its walks -- the profile the family asked for. It reads only the dog's
 * own document and the family's own sessions, both of which the rules already
 * let the owner read. Nothing here is public or shareable: a dog's profile
 * carries the family's routine and, through its walks, where they live.
 */

interface DogProfile {
  name: string
  breed: string
  size: string
  sex: string
  age: string
  weight: string
  petType: string
  notes: string
  energyLevel: string
  temperament: string[]
  allergies: string[]
  medications: string[]
  vaccines: { name: string; date: string; nextDue?: string }[]
  vetName: string
  vetPhone: string
  favoriteToys: string[]
  commands: string[]
  specialNeeds: string
  /** Id opaco del asset privado; no es un URL. */
  photoReference: string
}

const SIZE_LABELS: Record<string, string> = { 'pequeño': 'Pequeño', pequeno: 'Pequeño', mediano: 'Mediano', grande: 'Grande' }
const SEX_LABELS: Record<string, string> = { macho: 'Macho', hembra: 'Hembra' }
const ENERGY_LABELS: Record<string, string> = { bajo: 'Tranquilo', medio: 'Activo', alto: 'Muy activo' }
const TYPE_LABELS: Record<string, string> = { perro: 'Perro', gato: 'Gato', otro: 'Mascota' }
const UPCOMING = new Set(['requested', 'pending_assignment', 'assigned', 'confirmed'])

function text(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return ''
}

function list(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : []
}

function profileFrom(data: Record<string, unknown>): DogProfile {
  const personality = (data.personality ?? {}) as Record<string, unknown>
  const health = (data.health ?? {}) as Record<string, unknown>
  const preferences = (data.preferences ?? {}) as Record<string, unknown>
  const vaccines = Array.isArray(health.vaccines)
    ? health.vaccines.flatMap((item) => {
      if (!item || typeof item !== 'object') return []
      const vaccine = item as Record<string, unknown>
      const name = text(vaccine.name)
      return name ? [{ name, date: text(vaccine.date), nextDue: text(vaccine.nextDue) || undefined }] : []
    })
    : []

  return {
    name: text(data.name) || 'Sin nombre',
    breed: text(data.breed),
    size: text(data.size),
    sex: text(data.sex),
    age: text(data.age),
    weight: text(data.weight),
    petType: text(data.petType) || 'perro',
    notes: text(data.notes),
    energyLevel: text(personality.energyLevel),
    temperament: list(personality.temperament),
    allergies: list(health.allergies),
    medications: list(health.medications),
    vaccines,
    vetName: text(health.vetName),
    vetPhone: text(health.vetPhone),
    favoriteToys: list(preferences.favoriteToys),
    commands: list(preferences.commands),
    specialNeeds: text(preferences.specialNeeds),
    photoReference: isDogPhotoReference(data.photoReference) ? data.photoReference : '',
  }
}

function Chips({ items, tone = 'primary' }: { items: string[]; tone?: 'primary' | 'neutral' }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span
          key={item}
          className={`rounded-full px-3 py-1 text-xs font-medium ${tone === 'primary' ? 'bg-primary/10 text-primary' : 'bg-ink/5 text-ink'}`}
        >
          {item}
        </span>
      ))}
    </div>
  )
}

/**
 * Un apartado que empieza cerrado.
 *
 * El perfil traía todo abierto -- personalidad, preferencias, vacunas,
 * veterinario, la placa QR -- y lo urgente se perdía entre lo que se consulta
 * una vez al año. Lo que un paseador necesita saber hoy vive arriba, a la vista;
 * el resto se abre cuando alguien lo busca.
 */
function Foldable({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <section className="rounded-2xl border border-ink/[0.08] bg-surface">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="flex min-h-11 w-full items-center justify-between gap-3 px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <span className="min-w-0">
          <span className="block text-xs font-semibold uppercase tracking-[0.14em] text-muted">{title}</span>
          {hint && !open && <span className="mt-0.5 block truncate text-sm text-ink">{hint}</span>}
        </span>
        <ChevronDown size={16} className={`shrink-0 text-muted transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {open && <div className="space-y-2 border-t border-ink/[0.08] px-4 py-3">{children}</div>}
    </section>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">{title}</h2>
      {children}
    </section>
  )
}

export default function DogProfilePage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const dogId = params.id
  const [uid, setUid] = useState('')
  const [dog, setDog] = useState<DogProfile | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'not-found' | 'error'>('loading')
  const { sessions, error: sessionsError, retry } = useCustomerWalkSessions(uid)
  const photoUrl = useDogPhotos(dog?.photoReference ? [{ id: dogId, reference: dog.photoReference }] : [])[dogId] ?? ''

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      if (!user) { router.push('/login'); return }
      setUid(user.uid)
      getDoc(doc(db, 'dogs', dogId))
        .then((snapshot) => {
          if (!snapshot.exists() || snapshot.data().ownerId !== user.uid) {
            setState('not-found')
            return
          }
          setDog(profileFrom(snapshot.data()))
          setState('ready')
        })
        // The rules deny reading someone else's dog, which lands here too; to
        // the person looking, both mean "this profile is not yours to see".
        .catch(() => setState('error'))
    })
  }, [dogId, router])

  const walks = useMemo(() => {
    const own = sessions.filter((session) => session.dogIds.includes(dogId))
    const today = new Date().toLocaleDateString('en-CA')
    const completed = own
      .filter((session) => session.status === 'completed')
      .sort((a, b) => b.scheduledDate.localeCompare(a.scheduledDate))
    const next = own
      .filter((session) => UPCOMING.has(session.status) && session.scheduledDate >= today)
      .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate))[0]
    return { completed, next }
  }, [sessions, dogId])

  if (state === 'loading') return <LoadingState message="Consultando el perfil…" rows={3} height="h-20" />

  if (state === 'not-found' || state === 'error' || !dog) {
    return (
      <Card className="p-4 shadow-none">
        <EmptyState
          title="Perfil no disponible"
          description="Esta mascota no existe o no pertenece a tu cuenta."
          action={<Link href="/familia/perros" className="inline-flex min-h-11 items-center rounded-xl bg-primary/10 px-4 text-sm font-semibold text-primary">Volver a Mis mascotas</Link>}
        />
      </Card>
    )
  }

  const subtitle = [
    dog.breed,
    SIZE_LABELS[dog.size] ?? dog.size,
    dog.age,
    SEX_LABELS[dog.sex],
  ].filter(Boolean).join(' · ')

  const telHref = dog.vetPhone.replace(/[^\d+]/g, '')
  const hasPreferences = dog.favoriteToys.length > 0 || dog.commands.length > 0 || Boolean(dog.specialNeeds)
  const hasHealth = dog.vaccines.length > 0 || Boolean(dog.vetName)
  // Lo que un paseador necesita saber hoy: sale del mismo cálculo que usa el panel.
  const alerts = dogAlerts(
    { allergies: dog.allergies, medications: dog.medications, vaccines: dog.vaccines.map((vaccine) => ({ name: vaccine.name, date: vaccine.date, nextDue: vaccine.nextDue ?? '' })), specialNeeds: dog.specialNeeds },
    mexicoCityToday(),
  )

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex items-center justify-between gap-3">
        <Link href="/familia/perros" aria-label="Volver a Mis mascotas" className="grid h-11 w-11 place-items-center rounded-full text-muted transition-colors hover:bg-ink/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <ArrowLeft size={18} />
        </Link>
        <Link href="/familia/perros" className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-sm font-semibold text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <Pencil size={14} aria-hidden="true" /> Editar datos
        </Link>
      </div>

      <header className="flex flex-col items-center gap-3 text-center">
        <DogAvatar name={dog.name} breed={dog.breed} photoUrl={photoUrl} size={96} />
        <DogPhotoButton
          dogId={dogId}
          hasPhoto={dog.photoReference !== ''}
          onUploaded={(reference) => setDog((current) => (current ? { ...current, photoReference: reference } : current))}
        />
        <div>
          <p className="text-2xs font-semibold uppercase tracking-[0.16em] text-muted">{TYPE_LABELS[dog.petType] ?? 'Mascota'}</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-ink">{dog.name}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
        </div>
        {ENERGY_LABELS[dog.energyLevel] && (
          <span className="rounded-full bg-ink/5 px-3 py-1 text-xs font-medium text-ink">Energía: {ENERGY_LABELS[dog.energyLevel]}</span>
        )}
      </header>

      <dl className="grid grid-cols-3 divide-x divide-border rounded-2xl bg-surface py-4 text-center">
        <div className="px-2">
          <dt className="text-2xs text-muted">Paseos</dt>
          <dd className="mt-1 text-xl font-bold tabular-nums text-ink">{walks.completed.length}</dd>
        </div>
        <div className="px-2">
          <dt className="text-2xs text-muted">Último</dt>
          <dd className="mt-1 text-sm font-semibold text-ink">{walks.completed[0]?.scheduledDate || '—'}</dd>
        </div>
        <div className="px-2">
          <dt className="text-2xs text-muted">Próximo</dt>
          <dd className="mt-1 text-sm font-semibold text-ink">{walks.next?.scheduledDate || '—'}</dd>
        </div>
      </dl>

      {alerts.length > 0 && (
        <ul className="space-y-1.5">
          {alerts.map((alert) => (
            <li
              key={alert.key}
              className={`flex items-start gap-2 rounded-2xl px-3 py-2 text-sm ${
                alert.tone === 'danger' ? 'bg-danger-500/10 text-red-700'
                  : alert.tone === 'warning' ? 'bg-warning/10 text-amber-900'
                    : 'bg-ink/[0.04] text-ink'
              }`}
            >
              <AlertTriangle size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span><span className="font-semibold">{alert.label}:</span> {alert.detail}</span>
            </li>
          ))}
        </ul>
      )}

      {(dog.temperament.length > 0 || dog.notes) && (
        <Foldable title="Personalidad" hint={dog.temperament.join(', ') || 'Notas de la familia'}>
          {dog.temperament.length > 0 && <Chips items={dog.temperament} />}
          {dog.notes && <p className="text-sm leading-relaxed text-ink">{dog.notes}</p>}
        </Foldable>
      )}

      {hasPreferences && (
        <Foldable title="Preferencias" hint="Juguetes, comandos y cuidados">
          {dog.favoriteToys.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-muted">Juguetes favoritos</p>
              <Chips items={dog.favoriteToys} tone="neutral" />
            </div>
          )}
          {dog.commands.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-muted">Comandos que conoce</p>
              <Chips items={dog.commands} tone="neutral" />
            </div>
          )}
          {dog.specialNeeds && <p className="text-sm text-ink">{dog.specialNeeds}</p>}
        </Foldable>
      )}

      {hasHealth && (
        // Alergias y medicamento ya están arriba, en la lista de avisos: aquí
        // queda el expediente que se consulta, no lo que hay que saber hoy.
        <Foldable title="Salud" hint={dog.vaccines.length > 0 ? `${dog.vaccines.length} vacuna${dog.vaccines.length === 1 ? '' : 's'} registrada${dog.vaccines.length === 1 ? '' : 's'}` : 'Expediente y veterinario'}>
          {dog.vaccines.length > 0 && (
            <ul className="space-y-1.5">
              {dog.vaccines.map((vaccine) => (
                <li key={`${vaccine.name}-${vaccine.date}`} className="flex items-center justify-between gap-3 rounded-2xl bg-surface px-3 py-2 text-sm">
                  <span className="flex items-center gap-2 text-ink"><Syringe size={14} className="text-muted" aria-hidden="true" />{vaccine.name}</span>
                  <span className="text-xs text-muted">{vaccine.date || 'Sin fecha'}{vaccine.nextDue ? ` · próxima ${vaccine.nextDue}` : ''}</span>
                </li>
              ))}
            </ul>
          )}
          {dog.vetName && (
            <p className="flex flex-wrap items-center gap-2 text-sm text-ink">
              Veterinario: {dog.vetName}
              {telHref && (
                <a href={`tel:${telHref}`} className="inline-flex min-h-9 items-center gap-1 rounded-full bg-ink/5 px-3 text-xs font-medium text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                  <Phone size={12} aria-hidden="true" /> {dog.vetPhone}
                </a>
              )}
            </p>
          )}
        </Foldable>
      )}

      <Foldable title="Placa de emergencia" hint="El QR para el collar">
        <EmergencyTagSection
          dogId={dogId}
          petName={dog.name}
          breed={dog.breed}
          size={dog.size}
          petType={dog.petType}
        />
      </Foldable>

      <Section title="Actividad reciente">
        {sessionsError ? (
          <ErrorState description={canonicalReadErrorMessage(sessionsError)} onRetry={retry} />
        ) : walks.completed.length === 0 ? (
          <p className="text-sm text-muted">{dog.name} todavía no tiene paseos terminados.</p>
        ) : (
          <ul className="space-y-1.5">
            {walks.completed.slice(0, 5).map((session) => (
              <li key={session.id}>
                <Link
                  href={`/familia/reportes/${encodeURIComponent(session.id)}`}
                  className="flex min-h-11 items-center justify-between gap-3 rounded-2xl bg-surface px-3 text-sm transition-colors hover:bg-ink/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <span className="text-ink">{session.scheduledDate} · {session.scheduledStart}</span>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary"><FileText size={13} aria-hidden="true" /> Reporte</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  )
}
