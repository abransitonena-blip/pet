'use client'

import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, Clock, Crown, Heart, Search, Sparkles, UserPlus, Users, X } from 'lucide-react'
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
import { STATUS_LABELS } from '@/lib/businessMetrics'
import {
  LOYALTY_INFO,
  SEGMENT_INFO,
  SEGMENT_ORDER,
  customerActivity,
  describeDaysAgo,
  formatShortDate,
  mexicoCityToday,
  segmentMessage,
  timestampToMexicoCityDate,
  type CustomerActivity,
  type LifecycleSegment,
} from '@/lib/customerSegments'
import { dogAlerts, type DogAlert } from '@/lib/dogHealth'

/**
 * Directorio de familias registradas.
 *
 * The roster comes from `customerProfiles`; walks are layered on from the
 * canonical sessions. How families are grouped lives in customerSegments.ts:
 * a stage by recency (nueva, activa, en riesgo, inactiva, sin paseos) and a
 * separate loyalty tag, so a VIP family that stopped booking is not hidden
 * behind its VIP badge.
 *
 * There is no LTV or "total gastado" column: sessions carry a plan and a
 * tariff version, not an amount. Finanzas is where verifiable money is shown.
 */

const MAX_SESSIONS = 500

type Filter = 'all' | LifecycleSegment | 'vip' | 'sin_perro'
type SortKey = 'actividad' | 'reciente' | 'registro' | 'nombre'

const SORT_LABELS: Record<SortKey, string> = {
  actividad: 'Más paseos',
  reciente: 'Paseo más reciente',
  registro: 'Registro más reciente',
  nombre: 'Nombre',
}

const SEGMENT_STYLE: Record<LifecycleSegment, { pill: string; icon: typeof Crown }> = {
  nueva: { pill: 'text-blue-700 bg-blue-500/15', icon: Sparkles },
  activa: { pill: 'text-success-600 bg-success-500/15', icon: Heart },
  en_riesgo: { pill: 'text-orange-800 bg-orange-500/15', icon: AlertTriangle },
  inactiva: { pill: 'text-muted bg-ink/5', icon: Clock },
  sin_paseos: { pill: 'text-muted bg-ink/5', icon: UserPlus },
}

const ALERT_TONE: Record<DogAlert['tone'], string> = {
  danger: 'bg-danger-500/10 text-red-700',
  warning: 'bg-warning-500/15 text-amber-800',
  info: 'bg-blue-500/10 text-blue-700',
}

interface ClientRow extends CustomerActivity {
  customer: DirectoryCustomer
  dogs: DirectoryDog[]
  sessions: CanonicalReservationView[]
}

function chipClass(active: boolean): string {
  return `whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
    active ? 'bg-brand-500/15 text-brand-600' : 'bg-ink/5 text-muted hover:text-primary'
  }`
}

function walkLabel(client: CustomerActivity): string {
  if (client.nextWalkDate) return `Próximo paseo: ${formatShortDate(client.nextWalkDate)}`
  if (client.daysSinceLastWalk === null) return 'Sin paseos completados'
  return `Último paseo: ${describeDaysAgo(client.daysSinceLastWalk).toLowerCase()}`
}

function SegmentPill({ segment }: { segment: LifecycleSegment }) {
  const { pill, icon: Icon } = SEGMENT_STYLE[segment]
  return (
    <span className={`text-2xs inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${pill}`}>
      <Icon size={9} aria-hidden="true" />
      {SEGMENT_INFO[segment].label}
    </span>
  )
}

function LoyaltyPill({ loyalty }: { loyalty: CustomerActivity['loyalty'] }) {
  if (!loyalty) return null
  return (
    <span className={`text-2xs inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${
      loyalty === 'vip' ? 'bg-warning-500/15 text-amber-800' : 'bg-brand-500/10 text-brand-600'
    }`}>
      {loyalty === 'vip' && <Crown size={9} aria-hidden="true" />}
      {LOYALTY_INFO[loyalty].label}
    </span>
  )
}

export default function AdminClientesPage() {
  const { customers, dogs, loading, error, retry } = useCanonicalDirectory()
  const {
    reservations,
    loading: sessionsLoading,
    error: sessionsError,
    retry: retrySessions,
  } = useCanonicalReservations({ max: MAX_SESSIONS })
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedUid, setSelectedUid] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [sortKey, setSortKey] = useState<SortKey>('actividad')
  const today = mexicoCityToday()

  const clients = useMemo<ClientRow[]>(() => {
    const dogsByOwner = new Map<string, DirectoryDog[]>()
    dogs.forEach((dog) => {
      const bucket = dogsByOwner.get(dog.ownerId)
      if (bucket) bucket.push(dog)
      else dogsByOwner.set(dog.ownerId, [dog])
    })
    const sessionsByCustomer = new Map<string, CanonicalReservationView[]>()
    reservations.forEach((session) => {
      const bucket = sessionsByCustomer.get(session.customerId)
      if (bucket) bucket.push(session)
      else sessionsByCustomer.set(session.customerId, [session])
    })

    return customers.map((customer) => {
      const sessions = sessionsByCustomer.get(customer.uid) ?? []
      return {
        ...customerActivity(sessions, timestampToMexicoCityDate(customer.createdAt), today),
        customer,
        dogs: dogsByOwner.get(customer.uid) ?? [],
        sessions,
      }
    })
  }, [customers, dogs, reservations, today])

  const counts = useMemo(() => {
    const bySegment = Object.fromEntries(SEGMENT_ORDER.map((segment) => [segment, 0])) as Record<LifecycleSegment, number>
    let vip = 0
    let withoutDog = 0
    let vipSlipping = 0
    clients.forEach((client) => {
      bySegment[client.segment] += 1
      if (client.loyalty === 'vip') vip += 1
      if (client.dogs.length === 0) withoutDog += 1
      if (client.loyalty === 'vip' && (client.segment === 'en_riesgo' || client.segment === 'inactiva')) vipSlipping += 1
    })
    return { bySegment, vip, withoutDog, vipSlipping }
  }, [clients])

  const visible = useMemo(() => {
    let result = clients
    if (filter === 'vip') result = result.filter((client) => client.loyalty === 'vip')
    else if (filter === 'sin_perro') result = result.filter((client) => client.dogs.length === 0)
    else if (filter !== 'all') result = result.filter((client) => client.segment === filter)

    const needle = searchQuery.trim().toLowerCase()
    if (needle) {
      result = result.filter((client) =>
        client.customer.name.toLowerCase().includes(needle)
        || client.customer.phone.includes(needle)
        || client.customer.email.toLowerCase().includes(needle)
        || client.dogs.some((dog) => dog.name.toLowerCase().includes(needle)))
    }

    const byName = (a: ClientRow, b: ClientRow) => a.customer.name.localeCompare(b.customer.name, 'es')
    return [...result].sort((a, b) => {
      switch (sortKey) {
        case 'reciente': return b.lastCompletedDate.localeCompare(a.lastCompletedDate) || byName(a, b)
        case 'registro': return b.registeredDate.localeCompare(a.registeredDate) || byName(a, b)
        case 'nombre': return byName(a, b)
        default: return b.completedCount - a.completedCount || b.upcomingCount - a.upcomingCount || byName(a, b)
      }
    })
  }, [clients, filter, searchQuery, sortKey])

  const selected = useMemo(
    () => clients.find((client) => client.customer.uid === selectedUid) ?? null,
    [clients, selectedUid],
  )

  const readError = error ?? sessionsError
  const truncated = reservations.length >= MAX_SESSIONS

  const contact = (client: ClientRow) => {
    if (!client.customer.phone.replace(/\D/g, '')) return
    confirmWhatsAppShare(
      client.customer.phone,
      segmentMessage(client.segment, client.customer.name, client.dogs.map((dog) => dog.name)),
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Familias registradas"
        description={`${clients.length} cuentas · ${counts.bySegment.en_riesgo} en riesgo${
          counts.vipSlipping > 0 ? ` · ${counts.vipSlipping} VIP sin reservar` : ''
        }`}
      />

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por etapa">
        {SEGMENT_ORDER.map((segment) => {
          const active = filter === segment
          const { icon: Icon } = SEGMENT_STYLE[segment]
          return (
            <button
              key={segment}
              type="button"
              aria-pressed={active}
              onClick={() => setFilter(active ? 'all' : segment)}
              className={`min-w-[7.5rem] flex-1 rounded-xl border p-3 text-left transition-colors ${
                active ? 'border-brand-500/40 bg-brand-500/10' : 'border-ink/10 bg-surface hover:bg-ink/5'
              }`}
            >
              <span className="flex items-center justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
                {SEGMENT_INFO[segment].label}
                <Icon size={12} aria-hidden="true" />
              </span>
              <span className="mt-1 block text-2xl font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                {counts.bySegment[segment]}
              </span>
            </button>
          )
        })}
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2" size={12} style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Buscar por nombre, teléfono, correo o perro…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field pl-9"
            aria-label="Buscar familia"
          />
        </div>
        <div className="scrollbar-none flex gap-1.5 overflow-x-auto">
          {([
            ['all', `Todas · ${clients.length}`],
            ['vip', `VIP · ${counts.vip}`],
            ['sin_perro', `Sin perro · ${counts.withoutDog}`],
          ] as const).map(([value, label]) => (
            <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)} className={chipClass(filter === value)}>
              {label}
            </button>
          ))}
        </div>
        <label className="flex shrink-0 items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
          Ordenar
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="input-field w-auto py-1.5 text-xs"
          >
            {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
              <option key={key} value={key}>{SORT_LABELS[key]}</option>
            ))}
          </select>
        </label>
      </div>

      <details className="rounded-xl border border-ink/10 bg-surface px-4 py-3 text-xs">
        <summary className="cursor-pointer font-medium" style={{ color: 'var(--text-secondary)' }}>
          ¿Cómo se calcula cada etapa?
        </summary>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          {SEGMENT_ORDER.map((segment) => (
            <div key={segment}>
              <dt className="font-semibold" style={{ color: 'var(--text-primary)' }}>{SEGMENT_INFO[segment].label}</dt>
              <dd style={{ color: 'var(--text-muted)' }}>{SEGMENT_INFO[segment].rule}</dd>
            </div>
          ))}
          {(['vip', 'frecuente'] as const).map((tier) => (
            <div key={tier}>
              <dt className="font-semibold" style={{ color: 'var(--text-primary)' }}>{LOYALTY_INFO[tier].label}</dt>
              <dd style={{ color: 'var(--text-muted)' }}>{LOYALTY_INFO[tier].rule} Se muestra junto a la etapa.</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3" style={{ color: 'var(--text-muted)' }}>
          Solo cuentan los paseos completados: uno cancelado o agendado no cambia la fecha del último paseo.
          Las fechas son de la Ciudad de México.
        </p>
      </details>

      {truncated && (
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Las etapas se calculan con los {MAX_SESSIONS} paseos más recientes. Una familia con paseos más antiguos puede mostrar menos de los que tiene.
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
          icon={<Users size={24} />}
          title={searchQuery || filter !== 'all' ? 'Sin resultados' : 'Todavía no hay familias registradas'}
        />
      ) : (
        <ul className="space-y-2">
          {visible.map((client) => (
            <li key={client.customer.uid} className="flex items-center gap-3 rounded-xl border border-ink/10 bg-surface p-4 shadow-sm transition-colors hover:bg-ink/5">
              <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setSelectedUid(client.customer.uid)}>
                <span className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{client.customer.name}</span>
                  <SegmentPill segment={client.segment} />
                  <LoyaltyPill loyalty={client.loyalty} />
                </span>
                <span className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                  <span>{client.customer.phone || 'Sin teléfono'}</span>
                  <span>{client.dogs.length === 0 ? 'Sin perros dados de alta' : client.dogs.map((dog) => dog.name).join(', ')}</span>
                  <span>{client.completedCount} {client.completedCount === 1 ? 'paseo completado' : 'paseos completados'}</span>
                  <span>{walkLabel(client)}</span>
                </span>
              </button>
              {client.customer.phone && (
                <Button
                  variant="icon"
                  onClick={() => contact(client)}
                  className="shrink-0 text-success-400 hover:bg-success-500/10"
                  aria-label={`Escribir a ${client.customer.name} por WhatsApp`}
                >
                  <WhatsAppIcon width={13} height={13} />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
            onClick={() => setSelectedUid(null)}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="family-detail-title"
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="max-h-[85vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-xl border border-ink/10 bg-surface p-5 shadow-elevated"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 id="family-detail-title" className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                    {selected.customer.name}
                  </h2>
                  <p className="truncate text-xs" style={{ color: 'var(--text-muted)' }}>
                    {[selected.customer.phone, selected.customer.email].filter(Boolean).join(' · ') || 'Sin datos de contacto'}
                  </p>
                </div>
                <Button variant="icon" onClick={() => setSelectedUid(null)} aria-label="Cerrar">
                  <X size={14} />
                </Button>
              </div>

              <div className="space-y-1.5 rounded-xl p-3" style={{ background: 'var(--glass-bg)' }}>
                <div className="flex flex-wrap items-center gap-2">
                  <SegmentPill segment={selected.segment} />
                  <LoyaltyPill loyalty={selected.loyalty} />
                </div>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{SEGMENT_INFO[selected.segment].rule}</p>
                <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{SEGMENT_INFO[selected.segment].action}</p>
              </div>

              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: 'Completados', value: String(selected.completedCount) },
                  { label: 'Agendados', value: String(selected.upcomingCount) },
                  { label: 'Cancelados', value: String(selected.cancelledCount) },
                  { label: 'Frecuencia', value: selected.avgFrequencyDays !== null ? `${selected.avgFrequencyDays} d` : '—' },
                ].map((kpi) => (
                  <div key={kpi.label} className="rounded-xl py-3 text-center" style={{ background: 'var(--glass-bg)' }}>
                    <p className="text-sm font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>{kpi.value}</p>
                    <p className="text-2xs" style={{ color: 'var(--text-muted)' }}>{kpi.label}</p>
                  </div>
                ))}
              </div>

              <dl className="grid grid-cols-3 gap-2 text-xs">
                {[
                  ['Registro', selected.registeredDate ? formatShortDate(selected.registeredDate) : 'Sin fecha'],
                  ['Último paseo', selected.lastCompletedDate ? formatShortDate(selected.lastCompletedDate) : '—'],
                  ['Próximo paseo', selected.nextWalkDate ? formatShortDate(selected.nextWalkDate) : '—'],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt style={{ color: 'var(--text-muted)' }}>{label}</dt>
                    <dd className="font-medium" style={{ color: 'var(--text-primary)' }}>{value}</dd>
                  </div>
                ))}
              </dl>

              <div>
                <p className="mb-2 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Perros</p>
                {selected.dogs.length === 0 ? (
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Esta familia todavía no ha dado de alta ningún perro.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {selected.dogs.map((dog) => (
                      <li key={dog.id} className="flex flex-wrap items-center gap-1.5 text-xs">
                        <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{dog.name}</span>
                        {dog.breed && <span style={{ color: 'var(--text-muted)' }}>· {dog.breed}</span>}
                        {dogAlerts(dog, today).map((alert) => (
                          <span key={alert.key} title={alert.detail} className={`text-2xs rounded-full px-2 py-0.5 font-medium ${ALERT_TONE[alert.tone]}`}>
                            {alert.label}
                          </span>
                        ))}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Historial de paseos</p>
                {selected.sessions.length === 0 ? (
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Sin paseos registrados todavía.</p>
                ) : (
                  <ul className="max-h-56 space-y-1.5 overflow-y-auto">
                    {[...selected.sessions].sort((a, b) => b.date.localeCompare(a.date)).map((session) => (
                      <li
                        key={session.id}
                        className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-xs"
                        style={{ background: 'var(--glass-bg)', border: '1px solid var(--border)' }}
                      >
                        <span className="min-w-0">
                          <span className="block font-medium" style={{ color: 'var(--text-primary)' }}>{session.service}</span>
                          <span className="text-2xs block" style={{ color: 'var(--text-muted)' }}>
                            {formatShortDate(session.date)} · {session.petName || 'Perro sin nombre'}
                            {session.walkerName ? ` · ${session.walkerName}` : ''}
                          </span>
                        </span>
                        <span className="text-2xs shrink-0" style={{ color: 'var(--text-muted)' }}>
                          {STATUS_LABELS[session.status] ?? session.status}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {selected.customer.phone && (
                <button
                  type="button"
                  onClick={() => contact(selected)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-success-500/10 py-2.5 text-sm font-medium text-success-600 transition-colors hover:bg-success-500/20"
                >
                  <WhatsAppIcon width={13} height={13} /> Escribir por WhatsApp
                </button>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
