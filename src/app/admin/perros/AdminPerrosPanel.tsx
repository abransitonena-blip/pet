'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { ChevronDown, Dog, PawPrint, Phone, Search, Syringe } from 'lucide-react'
import PageHeader from '@/components/ui/PageHeader'
import LoadingState from '@/components/ui/LoadingState'
import EmptyState from '@/components/ui/EmptyState'
import ErrorState from '@/components/ui/ErrorState'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { WhatsAppIcon } from '@/components/ui/SocialIcons'
import { confirmWhatsAppShare } from '@/lib/utils'
import { useCanonicalDirectory, type DirectoryCustomer, type DirectoryDog } from '@/lib/useCanonicalDirectory'
import { useCanonicalReservations, type CanonicalReservationView } from '@/lib/useCanonicalReservations'
import { canonicalReadErrorMessage } from '@/lib/useCanonicalWalkSessions'
import { COMPLETED_STATUSES, STATUS_LABELS } from '@/lib/businessMetrics'
import { daysBetweenDates, describeDaysAgo, firstNameOf, formatShortDate, mexicoCityToday } from '@/lib/customerSegments'
import { dogAlerts, vaccineStatus, VACCINE_STATUS_LABELS, type DogAlert, type VaccineStatus } from '@/lib/dogHealth'

/**
 * Every dog registered by a family, not only the ones that already have a walk.
 *
 * The roster comes from `dogs`; walk history is layered on from the canonical
 * sessions. Each card surfaces what the family recorded that matters before a
 * walk -- allergies, medication, boosters, special care -- so an admin sees
 * it without opening every dog. Nothing is inferred: a field the family left
 * empty reads "Sin registrar", never "ninguna".
 */

const MAX_SESSIONS = 500

type SizeKey = 'pequeño' | 'mediano' | 'grande'
type Filter = 'all' | 'alertas' | 'refuerzos' | 'sin_paseos'

// The family form stores "pequeño" with the ñ; older records may not have it.
const SIZE_BY_VALUE: Record<string, SizeKey> = { 'pequeño': 'pequeño', pequeno: 'pequeño', mediano: 'mediano', grande: 'grande' }
const SIZE_LABELS: Record<SizeKey, string> = { 'pequeño': 'Pequeño', mediano: 'Mediano', grande: 'Grande' }
const SIZE_ORDER: readonly SizeKey[] = ['pequeño', 'mediano', 'grande']
const SEX_LABELS: Record<string, string> = { macho: 'Macho', hembra: 'Hembra' }
// The same words the family picks from in /familia/perros.
const ENERGY_LABELS: Record<string, string> = { bajo: 'Tranquilo', medio: 'Activo', alto: 'Muy activo' }

const FILTER_LABELS: Record<Filter, string> = {
  all: 'Todos',
  alertas: 'Con alerta de salud',
  refuerzos: 'Refuerzo vencido o próximo',
  sin_paseos: 'Sin paseos',
}

const ALERT_TONE: Record<DogAlert['tone'], string> = {
  danger: 'bg-danger-500/10 text-red-700',
  warning: 'bg-warning-500/15 text-amber-800',
  info: 'bg-blue-500/10 text-blue-700',
}

const VACCINE_TONE: Record<VaccineStatus, string> = {
  vencida: 'bg-danger-500/10 text-red-700',
  por_vencer: 'bg-warning-500/15 text-amber-800',
  vigente: 'bg-success-500/15 text-success-600',
  sin_refuerzo: 'bg-ink/5 text-muted',
}

interface PetRow {
  dog: DirectoryDog
  owner: DirectoryCustomer | null
  size: SizeKey | null
  sessions: CanonicalReservationView[]
  completedCount: number
  lastCompletedDate: string
  alerts: DogAlert[]
}

function matchesFilter(row: PetRow, filter: Filter): boolean {
  if (filter === 'alertas') return row.alerts.length > 0
  if (filter === 'refuerzos') return row.alerts.some((alert) => alert.key === 'vacuna_vencida' || alert.key === 'vacuna_por_vencer')
  if (filter === 'sin_paseos') return row.completedCount === 0
  return true
}

function chipClass(active: boolean): string {
  return `whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
    active ? 'bg-brand-500/15 text-brand-600' : 'bg-ink/5 text-muted hover:text-primary'
  }`
}

const unrecorded = <span style={{ color: 'var(--text-muted)' }}>Sin registrar</span>

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3 text-xs">
      <dt className="w-28 shrink-0" style={{ color: 'var(--text-muted)' }}>{label}</dt>
      <dd className="min-w-0 flex-1" style={{ color: 'var(--text-primary)' }}>{children}</dd>
    </div>
  )
}

function DogDetail({ id, row, today }: { id: string; row: PetRow; today: string }) {
  const { dog, owner } = row
  const vetPhoneDigits = dog.vetPhone.replace(/[^\d+]/g, '')

  const contactOwner = () => {
    if (!owner?.phone) return
    const firstName = firstNameOf(owner.name)
    confirmWhatsAppShare(owner.phone, `${firstName ? `Hola ${firstName}` : 'Hola'}, somos PET Ap. Te escribimos sobre ${dog.name}.`)
  }

  return (
    <div id={id} className="grid gap-5 border-t border-ink/10 p-4 sm:grid-cols-2">
      <section aria-label="Salud">
        <h3 className="mb-2 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Salud</h3>
        <dl className="space-y-1.5">
          <Detail label="Alergias">{dog.allergies.length > 0 ? dog.allergies.join(', ') : unrecorded}</Detail>
          <Detail label="Medicamentos">{dog.medications.length > 0 ? dog.medications.join(', ') : unrecorded}</Detail>
          <Detail label="Veterinario">
            {dog.vetName || vetPhoneDigits ? (
              <>
                {dog.vetName}
                {vetPhoneDigits && (
                  <a href={`tel:${vetPhoneDigits}`} className="ml-1 inline-flex items-center gap-1 text-brand-600 underline-offset-2 hover:underline">
                    <Phone size={10} aria-hidden="true" />
                    {dog.vetPhone}
                  </a>
                )}
              </>
            ) : unrecorded}
          </Detail>
        </dl>
        <h4 className="text-2xs mb-1.5 mt-3 font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Vacunas</h4>
        {dog.vaccines.length === 0 ? (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Sin vacunas registradas.</p>
        ) : (
          <ul className="space-y-1">
            {dog.vaccines.map((vaccine, index) => {
              const status = vaccineStatus(vaccine, today)
              return (
                <li
                  key={`${vaccine.name}-${index}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-xs"
                  style={{ background: 'var(--bg-elevated)' }}
                >
                  <span className="flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                    <Syringe size={11} className="text-brand-600" aria-hidden="true" />
                    {vaccine.name}
                    {vaccine.date && <span style={{ color: 'var(--text-muted)' }}>· aplicada {formatShortDate(vaccine.date)}</span>}
                  </span>
                  <span className={`text-2xs rounded-full px-2 py-0.5 font-medium ${VACCINE_TONE[status]}`}>
                    {VACCINE_STATUS_LABELS[status]}
                    {status !== 'sin_refuerzo' ? ` · ${formatShortDate(vaccine.nextDue)}` : ''}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section aria-label="Carácter y cuidados">
        <h3 className="mb-2 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Carácter y cuidados</h3>
        <dl className="space-y-1.5">
          <Detail label="Energía">{ENERGY_LABELS[dog.energyLevel] ?? unrecorded}</Detail>
          <Detail label="Temperamento">{dog.temperament.length > 0 ? dog.temperament.join(', ') : unrecorded}</Detail>
          <Detail label="Cuidados especiales">{dog.specialNeeds || unrecorded}</Detail>
          <Detail label="Notas">{dog.notes || unrecorded}</Detail>
        </dl>
      </section>

      <section aria-label="Familia" className="sm:col-span-2">
        <h3 className="mb-2 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Familia</h3>
        {owner ? (
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span style={{ color: 'var(--text-primary)' }}>
              {owner.name}
              <span style={{ color: 'var(--text-muted)' }}>
                {[owner.phone, owner.email].filter(Boolean).map((value) => ` · ${value}`).join('')}
              </span>
            </span>
            {owner.phone && (
              <Button
                variant="icon"
                onClick={contactOwner}
                className="shrink-0 text-success-400 hover:bg-success-500/10"
                aria-label={`Escribir a ${owner.name} por WhatsApp`}
              >
                <WhatsAppIcon width={13} height={13} />
              </Button>
            )}
          </div>
        ) : (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No encontramos la cuenta de esta familia en el directorio.</p>
        )}
      </section>

      <section aria-label="Historial de paseos" className="sm:col-span-2">
        <h3 className="mb-2 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Historial de paseos</h3>
        {row.sessions.length === 0 ? (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Este perro todavía no tiene paseos registrados.</p>
        ) : (
          <ul className="max-h-48 space-y-1 overflow-y-auto">
            {row.sessions.map((session) => (
              <li
                key={session.id}
                className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-xs"
                style={{ background: 'var(--bg-elevated)' }}
              >
                <span className="min-w-0 truncate" style={{ color: 'var(--text-primary)' }}>
                  {formatShortDate(session.date)} {session.time} · {session.service}
                </span>
                <span className="text-2xs shrink-0" style={{ color: 'var(--text-muted)' }}>
                  {STATUS_LABELS[session.status] ?? session.status}
                  {session.walkerName ? ` · ${session.walkerName}` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

export default function AdminPerrosPage() {
  const { customers, dogs, loading, error, retry } = useCanonicalDirectory()
  const {
    reservations,
    loading: sessionsLoading,
    error: sessionsError,
    retry: retrySessions,
  } = useCanonicalReservations({ max: MAX_SESSIONS })
  const [searchQuery, setSearchQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [sizeFilter, setSizeFilter] = useState<SizeKey | 'all'>('all')
  const [openDogId, setOpenDogId] = useState<string | null>(null)
  const today = mexicoCityToday()

  const pets = useMemo<PetRow[]>(() => {
    const ownersByUid = new Map(customers.map((customer) => [customer.uid, customer]))
    const sessionsByDog = new Map<string, CanonicalReservationView[]>()
    reservations.forEach((session) => {
      session.dogIds.forEach((dogId) => {
        const bucket = sessionsByDog.get(dogId)
        if (bucket) bucket.push(session)
        else sessionsByDog.set(dogId, [session])
      })
    })

    return dogs
      .map((dog) => {
        const sessions = sessionsByDog.get(dog.id) ?? []
        const completed = sessions.filter((session) => COMPLETED_STATUSES.has(session.status) && session.date <= today)
        return {
          dog,
          owner: ownersByUid.get(dog.ownerId) ?? null,
          size: SIZE_BY_VALUE[dog.size] ?? null,
          sessions: [...sessions].sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time)),
          completedCount: completed.length,
          lastCompletedDate: completed.reduce((latest, session) => (session.date > latest ? session.date : latest), ''),
          alerts: dogAlerts(dog, today),
        }
      })
      .sort((a, b) => b.completedCount - a.completedCount || a.dog.name.localeCompare(b.dog.name, 'es'))
  }, [customers, dogs, reservations, today])

  const counts = useMemo(() => {
    const byFilter = Object.fromEntries(
      (Object.keys(FILTER_LABELS) as Filter[]).map((value) => [value, pets.filter((row) => matchesFilter(row, value)).length]),
    ) as Record<Filter, number>
    const bySize = Object.fromEntries(
      SIZE_ORDER.map((size) => [size, pets.filter((row) => row.size === size).length]),
    ) as Record<SizeKey, number>
    return { byFilter, bySize }
  }, [pets])

  const visible = useMemo(() => {
    const needle = searchQuery.trim().toLowerCase()
    return pets.filter((row) => {
      if (!matchesFilter(row, filter)) return false
      if (sizeFilter !== 'all' && row.size !== sizeFilter) return false
      if (!needle) return true
      return row.dog.name.toLowerCase().includes(needle)
        || row.dog.breed.toLowerCase().includes(needle)
        || (row.owner?.name ?? '').toLowerCase().includes(needle)
        || (row.owner?.phone ?? '').includes(needle)
        || row.dog.allergies.some((allergy) => allergy.toLowerCase().includes(needle))
        || row.dog.medications.some((medication) => medication.toLowerCase().includes(needle))
    })
  }, [pets, filter, sizeFilter, searchQuery])

  const readError = error ?? sessionsError
  const truncated = reservations.length >= MAX_SESSIONS

  return (
    <div className="space-y-6">
      <PageHeader
        title="Perros registrados"
        description={`${pets.length} perros · ${counts.byFilter.alertas} con alerta de salud · ${counts.byFilter.sin_paseos} sin paseos`}
      />

      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2" size={12} style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Buscar por perro, raza, familia, teléfono, alergia o medicamento…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field pl-9"
            aria-label="Buscar perro"
          />
        </div>
        <div className="scrollbar-none flex gap-1.5 overflow-x-auto" role="group" aria-label="Filtrar perros">
          {(Object.keys(FILTER_LABELS) as Filter[]).map((value) => (
            <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)} className={chipClass(filter === value)}>
              {FILTER_LABELS[value]} · {counts.byFilter[value]}
            </button>
          ))}
          <span className="mx-1 w-px shrink-0 bg-ink/10" aria-hidden="true" />
          {(['all', ...SIZE_ORDER] as const).map((value) => (
            <button key={value} type="button" aria-pressed={sizeFilter === value} onClick={() => setSizeFilter(value)} className={chipClass(sizeFilter === value)}>
              {value === 'all' ? 'Todos los tamaños' : `${SIZE_LABELS[value]} · ${counts.bySize[value]}`}
            </button>
          ))}
        </div>
      </div>

      {truncated && (
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          El historial usa los {MAX_SESSIONS} paseos más recientes. Un perro con paseos más antiguos puede mostrar menos de los que tiene.
        </p>
      )}

      {readError ? (
        <Card className="p-4 shadow-none">
          <ErrorState description={canonicalReadErrorMessage(readError)} onRetry={() => { retry(); retrySessions() }} />
        </Card>
      ) : loading || sessionsLoading ? (
        <LoadingState rows={4} height="h-20" />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<PawPrint size={24} />}
          title={searchQuery || filter !== 'all' || sizeFilter !== 'all' ? 'Sin resultados' : 'Todavía no hay perros registrados'}
          description={searchQuery || filter !== 'all' || sizeFilter !== 'all' ? undefined : 'Los perros aparecen aquí en cuanto una familia los da de alta en su cuenta.'}
        />
      ) : (
        <ul className="space-y-2">
          {visible.map((row) => {
            const isOpen = openDogId === row.dog.id
            const panelId = `dog-detail-${row.dog.id}`
            const facts = [
              row.dog.breed,
              row.size ? SIZE_LABELS[row.size] : row.dog.size,
              SEX_LABELS[row.dog.sex],
              row.dog.age,
              row.dog.weight,
            ].filter(Boolean).join(' · ')
            const walks = row.completedCount === 0
              ? 'Sin paseos completados'
              : `${row.completedCount} ${row.completedCount === 1 ? 'paseo' : 'paseos'} · último ${describeDaysAgo(daysBetweenDates(row.lastCompletedDate, today)).toLowerCase()}`

            return (
              <li key={row.dog.id} className="rounded-xl border border-ink/10 bg-surface shadow-sm">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => setOpenDogId(isOpen ? null : row.dog.id)}
                  className="flex w-full items-start gap-3 rounded-xl p-4 text-left transition-colors hover:bg-ink/5"
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: 'var(--bg-elevated)' }}>
                    <Dog size={18} style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="mb-0.5 flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{row.dog.name}</span>
                      {row.dog.petType !== 'perro' && (
                        <span className="text-2xs rounded-full px-2 py-0.5" style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>
                          {row.dog.petType}
                        </span>
                      )}
                    </span>
                    <span className="block text-xs" style={{ color: 'var(--text-muted)' }}>{facts || 'Sin raza ni tamaño capturados'}</span>
                    <span className="mt-0.5 block text-xs" style={{ color: 'var(--text-muted)' }}>
                      {row.owner ? row.owner.name : 'Familia no encontrada'} · {walks}
                    </span>
                    {row.alerts.length > 0 && (
                      <span className="mt-2 flex flex-wrap gap-1">
                        {row.alerts.map((alert) => (
                          <span key={alert.key} title={alert.detail} className={`text-2xs rounded-full px-2 py-0.5 font-medium ${ALERT_TONE[alert.tone]}`}>
                            {alert.label}
                          </span>
                        ))}
                      </span>
                    )}
                  </span>
                  <ChevronDown
                    size={14}
                    className={`mt-1 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    style={{ color: 'var(--text-muted)' }}
                    aria-hidden="true"
                  />
                </button>
                {isOpen && <DogDetail id={panelId} row={row} today={today} />}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
