'use client'

import { useEffect, useMemo, useState } from 'react'
import { collection, limit, onSnapshot, query } from 'firebase/firestore'
import { motion, AnimatePresence } from 'framer-motion'
import { CalendarDays, ChartBar, Mail, MapPinned, PersonStanding, Phone } from 'lucide-react'
import { db } from '@/firebase/db'
import { useToast } from '@/context/ToastContext'
import PageHeader from '@/components/ui/PageHeader'
import LoadingState from '@/components/ui/LoadingState'
import EmptyState from '@/components/ui/EmptyState'
import ErrorState from '@/components/ui/ErrorState'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import TeamProvisionPanel from '@/components/admin/TeamProvisionPanel'
import { WhatsAppIcon } from '@/components/ui/SocialIcons'
import StartChatButton from '@/components/admin/StartChatButton'
import { setWalkerStatus, type WalkerOperationalStatus } from '@/lib/adminWalkers'
import { useCanonicalReservations } from '@/lib/useCanonicalReservations'
import { canonicalReadErrorMessage } from '@/lib/useCanonicalWalkSessions'
import { CANCELLED_STATUSES, COMPLETED_STATUSES, UNASSIGNED_STATUSES } from '@/lib/businessMetrics'
import { daysBetweenDates, describeDaysAgo, mexicoCityToday } from '@/lib/customerSegments'
import { confirmWhatsAppShare } from '@/lib/utils'
import type { Zone } from '@/types'

/**
 * Paseadores reales: los que existen en `walkerProfiles`.
 *
 * This page used to list a roster kept inside the site config
 * (`appSettings/public.walkers`) and only "bridge" it to the canonical profile
 * by email. Anyone provisioned properly but missing from that roster never
 * appeared, and every count came from the frozen `reservations` collection, so
 * each walker showed zero walks and "Nunca".
 *
 * The list is now the profile collection the Firestore rules actually trust
 * (`walkerProfiles/{uid}.status == 'active'` gates assignment), and the walk
 * counts come from canonical sessions. Zones and the weekly schedule are shown
 * as the profile stores them: zones are set when provisioning, and the walker
 * edits their own schedule in their profile, so neither is edited here.
 */

const MAX_PROFILES = 100
const MAX_SESSIONS = 100
/** El mismo valor que usa el despacho cuando el perfil no trae capacidad. */
const DEFAULT_MAX_DAILY = 8

const DAY_LABELS: Record<string, string> = {
  monday: 'Lun', lunes: 'Lun', lun: 'Lun',
  tuesday: 'Mar', martes: 'Mar', mar: 'Mar',
  wednesday: 'Mié', miercoles: 'Mié', miércoles: 'Mié', mie: 'Mié',
  thursday: 'Jue', jueves: 'Jue', jue: 'Jue',
  friday: 'Vie', viernes: 'Vie', vie: 'Vie',
  saturday: 'Sáb', sabado: 'Sáb', sábado: 'Sáb', sab: 'Sáb',
  sunday: 'Dom', domingo: 'Dom', dom: 'Dom',
}

const STATUS_PILL: Record<WalkerOperationalStatus, { label: string; className: string }> = {
  active: { label: 'Activo', className: 'bg-success-500/15 text-success-600' },
  inactive: { label: 'Inactivo', className: 'bg-ink/10 text-muted' },
  suspended: { label: 'Suspendido', className: 'bg-danger-500/15 text-red-700' },
}

interface TimeSlot { start: string; end: string }

interface WalkerProfileRow {
  uid: string
  name: string
  email: string
  phone: string
  status: WalkerOperationalStatus
  zones: string[]
  schedule: Record<string, TimeSlot[]>
  maxDaily: number
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function slots(value: unknown): TimeSlot[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => (item && typeof item === 'object' ? item as Record<string, unknown> : {}))
    .map((item) => ({ start: text(item.start), end: text(item.end) }))
    .filter((slot) => slot.start && slot.end)
}

function profileFromSnapshot(uid: string, data: Record<string, unknown>): WalkerProfileRow {
  const rawStatus = text(data.status)
  const capacity = data.capacity && typeof data.capacity === 'object' ? data.capacity as Record<string, unknown> : {}
  const schedule: Record<string, TimeSlot[]> = {}
  if (data.schedule && typeof data.schedule === 'object') {
    for (const [day, value] of Object.entries(data.schedule as Record<string, unknown>)) {
      const daySlots = slots(value)
      if (daySlots.length > 0) schedule[day] = daySlots
    }
  }
  return {
    uid,
    name: text(data.name) || 'Paseador sin nombre',
    email: text(data.email),
    phone: text(data.phone),
    status: rawStatus === 'active' || rawStatus === 'suspended' ? rawStatus : 'inactive',
    zones: Array.isArray(data.zones) ? data.zones.filter((zone): zone is string => typeof zone === 'string') : [],
    schedule,
    maxDaily: typeof capacity.maxDaily === 'number' && capacity.maxDaily > 0 ? capacity.maxDaily : DEFAULT_MAX_DAILY,
  }
}

export default function AdminPaseadoresPage() {
  const { toast } = useToast()
  const [profiles, setProfiles] = useState<WalkerProfileRow[] | null>(null)
  const [profileError, setProfileError] = useState('')
  const [allZones, setAllZones] = useState<Zone[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)
  const [changingStatus, setChangingStatus] = useState<string | null>(null)
  const { reservations, loading: sessionsLoading, error: sessionsError, retry } = useCanonicalReservations({ max: MAX_SESSIONS })
  const today = mexicoCityToday()

  useEffect(() => onSnapshot(
    query(collection(db, 'zones'), limit(100)),
    (snapshot) => setAllZones(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as Zone))),
    () => setAllZones([]),
  ), [])

  useEffect(() => onSnapshot(
    query(collection(db, 'walkerProfiles'), limit(MAX_PROFILES)),
    (snapshot) => {
      setProfiles(snapshot.docs.map((item) => profileFromSnapshot(item.id, item.data())))
      setProfileError('')
    },
    () => {
      setProfiles([])
      setProfileError('No pudimos consultar los perfiles de paseadores.')
    },
  ), [])

  // Los nombres salen de todas las zonas: un perfil puede traer una zona que
  // hoy está apagada, y vale más mostrar su nombre que su id.
  const zoneNames = useMemo(() => new Map(allZones.map((zone) => [zone.id, zone.name])), [allZones])
  const zones = useMemo(() => allZones.filter((zone) => zone.active), [allZones])

  const statsByWalker = useMemo(() => {
    const stats = new Map<string, { today: number; upcoming: number; completed: number; lastCompleted: string }>()
    for (const session of reservations) {
      if (!session.assignedWalker || CANCELLED_STATUSES.has(session.status)) continue
      const entry = stats.get(session.assignedWalker) ?? { today: 0, upcoming: 0, completed: 0, lastCompleted: '' }
      if (session.date === today) entry.today += 1
      if (session.date > today) entry.upcoming += 1
      if (COMPLETED_STATUSES.has(session.status)) {
        entry.completed += 1
        if (session.date > entry.lastCompleted) entry.lastCompleted = session.date
      }
      stats.set(session.assignedWalker, entry)
    }
    return stats
  }, [reservations, today])

  const unassignedToday = useMemo(
    () => reservations.filter((session) => session.date === today && UNASSIGNED_STATUSES.has(session.status)).length,
    [reservations, today],
  )

  const rows = profiles ?? []
  const activeCount = rows.filter((profile) => profile.status === 'active').length

  const changeStatus = async (uid: string, status: WalkerOperationalStatus) => {
    setChangingStatus(uid)
    try {
      await setWalkerStatus(uid, status)
      toast(status === 'active' ? 'Paseador activado' : status === 'suspended' ? 'Paseador suspendido' : 'Paseador desactivado')
    } catch {
      toast('No pudimos cambiar el estado del paseador', 'error')
    } finally {
      setChangingStatus(null)
    }
  }

  const contact = (profile: WalkerProfileRow) => {
    if (!profile.phone.replace(/\D/g, '')) return
    confirmWhatsAppShare(profile.phone, `Hola ${profile.name.split(/\s+/)[0]}, somos PET Ap.`)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Paseadores"
        description={`${rows.length} con perfil · ${activeCount} activos · ${unassignedToday} paseos de hoy sin asignar`}
      />

      {profileError && <p role="alert" className="rounded-xl bg-danger-500/10 px-4 py-3 text-sm text-red-700">{profileError}</p>}

      <TeamProvisionPanel zones={zones} />

      {sessionsError && (
        <Card className="p-4 shadow-none">
          <ErrorState description={canonicalReadErrorMessage(sessionsError)} onRetry={retry} />
        </Card>
      )}

      {profiles === null || sessionsLoading ? (
        <LoadingState rows={3} height="h-28" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<PersonStanding size={24} />}
          title="Todavía no hay paseadores con perfil"
          description="La persona se registra en la app y después le das su rol arriba. Ahí mismo se crea su perfil operativo."
        />
      ) : (
        <ul className="space-y-3">
          {rows.map((profile) => {
            const stats = statsByWalker.get(profile.uid) ?? { today: 0, upcoming: 0, completed: 0, lastCompleted: '' }
            const isOpen = expanded === profile.uid
            const load = profile.maxDaily > 0 ? Math.round((stats.today / profile.maxDaily) * 100) : 0
            const pill = STATUS_PILL[profile.status]
            const scheduleDays = Object.entries(profile.schedule)

            return (
              <li key={profile.uid} className="overflow-hidden rounded-xl border border-ink/10 bg-surface shadow-sm">
                <div className="p-4">
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10">
                        <PersonStanding className="text-primary" size={16} aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-ink">{profile.name}</span>
                          <span className={`text-2xs rounded-full px-2 py-0.5 font-medium ${pill.className}`}>{pill.label}</span>
                          {load >= 90 && stats.today > 0 && (
                            <span className="text-2xs rounded-full bg-warning-500/15 px-2 py-0.5 font-medium text-amber-800">Carga alta</span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
                          {profile.email && <span className="flex items-center gap-1"><Mail size={9} aria-hidden="true" /> {profile.email}</span>}
                          <span className="flex items-center gap-1"><Phone size={9} aria-hidden="true" /> {profile.phone || 'Sin teléfono'}</span>
                          <span className="flex items-center gap-1"><CalendarDays size={9} aria-hidden="true" /> {stats.today}/{profile.maxDaily} hoy</span>
                          <span className="flex items-center gap-1"><ChartBar size={9} aria-hidden="true" /> {stats.upcoming} próximos</span>
                        </div>
                        {profile.zones.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {profile.zones.map((zoneId) => (
                              <span key={zoneId} className="text-2xs flex items-center gap-1 rounded-full bg-success-500/10 px-2 py-0.5 text-success-600">
                                <MapPinned size={7} aria-hidden="true" /> {zoneNames.get(zoneId) ?? zoneId}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5">
                      <label className="sr-only" htmlFor={`status-${profile.uid}`}>Estado operativo de {profile.name}</label>
                      <select
                        id={`status-${profile.uid}`}
                        value={profile.status}
                        onChange={(event) => void changeStatus(profile.uid, event.target.value as WalkerOperationalStatus)}
                        disabled={changingStatus === profile.uid}
                        className="text-2xs h-11 rounded-xl border border-ink/10 bg-surface px-2 font-medium text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        <option value="active">Activo</option>
                        <option value="inactive">Inactivo</option>
                        <option value="suspended">Suspendido</option>
                      </select>
                      {profile.phone && (
                        <Button
                          variant="icon"
                          onClick={() => contact(profile)}
                          className="text-success-400 hover:bg-success-500/10"
                          aria-label={`Escribir a ${profile.name} por WhatsApp`}
                        >
                          <WhatsAppIcon width={13} height={13} />
                        </Button>
                      )}
                      <Button
                        variant="icon"
                        onClick={() => setExpanded(isOpen ? null : profile.uid)}
                        aria-expanded={isOpen}
                        aria-label={`Ver detalles de ${profile.name}`}
                      >
                        <ChartBar size={13} />
                      </Button>
                    </div>
                  </div>
                </div>

                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-3 border-t border-ink/10 px-4 pb-4 pt-3">
                        <div>
                          <p className="mb-2 text-xs font-semibold text-ink">Horario que registró el paseador</p>
                          {scheduleDays.length === 0 ? (
                            <p className="text-xs text-muted">Sin horario registrado. El paseador lo edita en su propio perfil.</p>
                          ) : (
                            <ul className="flex flex-wrap gap-2">
                              {scheduleDays.map(([day, daySlots]) => (
                                <li key={day} className="text-2xs rounded-lg bg-ink/[0.04] px-2 py-1 text-muted">
                                  <span className="font-medium text-ink">{DAY_LABELS[day.toLowerCase()] ?? day}</span>{' '}
                                  {daySlots.map((slot) => `${slot.start}–${slot.end}`).join(', ')}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>

                        <div className="grid grid-cols-4 gap-2">
                          {[
                            { label: 'Hoy', value: String(stats.today) },
                            { label: 'Próximos', value: String(stats.upcoming) },
                            { label: 'Completados', value: String(stats.completed) },
                            {
                              label: 'Último paseo',
                              value: stats.lastCompleted ? describeDaysAgo(daysBetweenDates(stats.lastCompleted, today)) : '—',
                            },
                          ].map((item) => (
                            <div key={item.label} className="rounded-lg py-2 text-center" style={{ background: 'var(--glass-bg)' }}>
                              <p className="text-sm font-bold text-ink">{item.value}</p>
                              <p className="text-2xs text-muted">{item.label}</p>
                            </div>
                          ))}
                        </div>

                        <p className="text-2xs text-muted">
                          Las cifras salen de los {MAX_SESSIONS} paseos más recientes de la operación.
                        </p>

                        <StartChatButton uid={profile.uid} name={profile.name} phone={profile.phone} role="walker" />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
