'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Users, Dog, CalendarDays,
  Clock, UserPlus, X, Crown, Heart, AlertTriangle } from 'lucide-react'
import PageHeader from '@/components/ui/PageHeader'
import LoadingState from '@/components/ui/LoadingState'
import EmptyState from '@/components/ui/EmptyState'
import ErrorState from '@/components/ui/ErrorState'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { confirmWhatsAppShare } from '@/lib/utils'
import { useCanonicalDirectory, type DirectoryDog } from '@/lib/useCanonicalDirectory'
import { useCanonicalReservations, type CanonicalReservationView } from '@/lib/useCanonicalReservations'
import { canonicalReadErrorMessage } from '@/lib/useCanonicalWalkSessions'
import { WhatsAppIcon } from '@/components/ui/SocialIcons'

/**
 * Directorio de familias registradas.
 *
 * Two deliberate changes from the previous version:
 *
 * 1. The roster comes from `customerProfiles`, not from the frozen legacy
 *    `reservations` collection. Before, a family only appeared once it had a
 *    legacy booking, so almost every real account was invisible here.
 *
 * 2. There is no LTV or "total gastado" column. Canonical walk sessions carry
 *    no price, and the only way to show a peso figure would be to multiply
 *    walks by a current service price -- a number that would look like revenue
 *    without being it. Segmentation therefore uses completed walks and
 *    recency, which the data actually supports.
 */

interface ClientRow {
  uid: string
  name: string
  email: string
  phone: string
  dogs: DirectoryDog[]
  sessions: CanonicalReservationView[]
  completedCount: number
  cancelledCount: number
  lastVisit: string
  firstVisit: string
  avgFrequency: number
  segment: 'vip' | 'regular' | 'new' | 'at_risk' | 'churned' | 'sin_actividad'
}

function daysBetween(a: string, b: string): number {
  return Math.abs(Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000))
}

function relativeTime(dateStr: string): string {
  if (!dateStr) return 'Sin paseos'
  const days = Math.round((Date.now() - new Date(dateStr).getTime()) / 86400000)
  if (days <= 0) return 'Hoy'
  if (days === 1) return 'Ayer'
  if (days < 7) return `Hace ${days} días`
  if (days < 30) return `Hace ${Math.round(days / 7)} sem`
  if (days < 365) return `Hace ${Math.round(days / 30)} mes${Math.round(days / 30) !== 1 ? 'es' : ''}`
  return `Hace ${Math.round(days / 365)} año${Math.round(days / 365) !== 1 ? 's' : ''}`
}

const SEGMENT_CONFIG: Record<ClientRow['segment'], { label: string; color: string; icon: typeof Crown }> = {
  vip: { label: 'VIP', color: 'text-amber-800 bg-warning-500/15', icon: Crown },
  regular: { label: 'Frecuente', color: 'text-success-600 bg-success-500/15', icon: Heart },
  new: { label: 'Nuevo', color: 'text-blue-700 bg-blue-500/15', icon: Dog },
  at_risk: { label: 'En riesgo', color: 'text-orange-800 bg-orange-500/15', icon: AlertTriangle },
  churned: { label: 'Inactivo', color: 'text-muted bg-ink/5', icon: Clock },
  sin_actividad: { label: 'Sin paseos', color: 'text-muted bg-ink/5', icon: UserPlus },
}

const SEGMENT_ORDER: readonly ClientRow['segment'][] = ['vip', 'regular', 'new', 'at_risk', 'churned', 'sin_actividad']

function segmentFor(completed: number, lastVisit: string, today: string): ClientRow['segment'] {
  if (!lastVisit) return 'sin_actividad'
  const lastVisitDays = daysBetween(lastVisit, today)
  if (completed >= 10) return 'vip'
  if (completed >= 3) return 'regular'
  if (lastVisitDays <= 30) return 'new'
  if (lastVisitDays <= 60) return 'at_risk'
  return 'churned'
}

export default function AdminClientesPage() {
  const { customers, dogs, loading, error, retry } = useCanonicalDirectory()
  const { reservations, loading: sessionsLoading } = useCanonicalReservations({ max: 300 })
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedUid, setSelectedUid] = useState<string | null>(null)
  const [segmentFilter, setSegmentFilter] = useState<'all' | ClientRow['segment']>('all')

  const clients = useMemo<ClientRow[]>(() => {
    const today = new Date().toISOString().split('T')[0]
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

    return customers
      .map((customer) => {
        const sessions = sessionsByCustomer.get(customer.uid) ?? []
        const dates = sessions.map((session) => session.date).filter(Boolean).sort()
        const completedCount = sessions.filter((session) => session.status === 'completed').length
        const lastVisit = dates[dates.length - 1] ?? ''
        const firstVisit = dates[0] ?? ''

        let avgFrequency = 0
        if (dates.length > 1) {
          let totalDays = 0
          for (let i = 1; i < dates.length; i += 1) totalDays += daysBetween(dates[i - 1], dates[i])
          avgFrequency = Math.round(totalDays / (dates.length - 1))
        }

        return {
          uid: customer.uid,
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          dogs: dogsByOwner.get(customer.uid) ?? [],
          sessions,
          completedCount,
          cancelledCount: sessions.filter((session) => session.status === 'cancelled').length,
          lastVisit,
          firstVisit,
          avgFrequency,
          segment: segmentFor(completedCount, lastVisit, today),
        }
      })
      .sort((a, b) => b.sessions.length - a.sessions.length || a.name.localeCompare(b.name))
  }, [customers, dogs, reservations])

  const filtered = useMemo(() => {
    let result = clients
    if (segmentFilter !== 'all') result = result.filter((client) => client.segment === segmentFilter)
    if (searchQuery.trim()) {
      const needle = searchQuery.toLowerCase()
      result = result.filter((client) =>
        client.name.toLowerCase().includes(needle)
        || client.phone.includes(needle)
        || client.email.toLowerCase().includes(needle)
        || client.dogs.some((dog) => dog.name.toLowerCase().includes(needle)))
    }
    return result
  }, [clients, searchQuery, segmentFilter])

  const selectedClient = useMemo(
    () => clients.find((client) => client.uid === selectedUid) ?? null,
    [clients, selectedUid],
  )

  const stats = useMemo(() => {
    const monthStart = `${new Date().toISOString().slice(0, 7)}-01`
    return {
      totalClients: clients.length,
      activeClients: clients.filter((client) => client.lastVisit >= monthStart).length,
      repeatClients: clients.filter((client) => client.sessions.length > 1).length,
      vipClients: clients.filter((client) => client.segment === 'vip').length,
      atRiskClients: clients.filter((client) => client.segment === 'at_risk' || client.segment === 'churned').length,
    }
  }, [clients])

  const openWhatsApp = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '')
    if (!cleaned) return
    confirmWhatsAppShare(`52${cleaned}`, 'Hola, soy de PET Ap. Solicito ponerme en contacto contigo.')
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Familias registradas"
        description={`${stats.totalClients} cuentas · ${stats.vipClients} VIP · ${stats.atRiskClients} en riesgo`}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Cuentas', value: stats.totalClients, icon: Users, color: '#D97706' },
          { label: 'Recurrentes', value: stats.repeatClients, icon: UserPlus, color: '#059669' },
          { label: 'Con paseo este mes', value: stats.activeClients, icon: CalendarDays, color: '#3b82f6' },
          { label: 'VIP', value: stats.vipClients, icon: Crown, color: '#F59E0B' },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-ink/10 bg-surface p-4 shadow-sm">
            <item.icon size={14} style={{ color: item.color }} className="mb-2" />
            <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{item.value}</p>
            <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>{item.label}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
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
          {(['all', ...SEGMENT_ORDER] as const).map((value) => (
            <button
              key={value}
              onClick={() => setSegmentFilter(value)}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                segmentFilter === value ? 'bg-brand-500/15 text-brand-600' : 'bg-ink/5 text-muted hover:text-primary'
              }`}
            >
              {value === 'all' ? 'Todos' : SEGMENT_CONFIG[value].label}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <Card className="p-4 shadow-none">
          <ErrorState description={canonicalReadErrorMessage(error)} onRetry={retry} />
        </Card>
      ) : loading || sessionsLoading ? (
        <LoadingState rows={4} height="h-20" />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Users size={24} />}
          title={searchQuery || segmentFilter !== 'all' ? 'Sin resultados' : 'Todavía no hay familias registradas'}
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((client) => {
            const segment = SEGMENT_CONFIG[client.segment]
            const SegmentIcon = segment.icon
            return (
              <motion.div
                key={client.uid}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="cursor-pointer rounded-xl border border-ink/10 bg-surface p-4 shadow-sm transition-colors hover:bg-ink/5"
                onClick={() => setSelectedUid(client.uid)}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{client.name}</span>
                      <span className={`text-2xs rounded-full px-2 py-0.5 font-medium ${segment.color}`}>
                        <SegmentIcon size={8} className="mr-1 inline" />
                        {segment.label}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                      {client.phone ? <span>{client.phone}</span> : <span>Sin teléfono</span>}
                      <span>{client.dogs.length === 0 ? 'Sin perros dados de alta' : client.dogs.map((dog) => dog.name).join(', ')}</span>
                      <span>{client.sessions.length} paseos</span>
                      <span>{relativeTime(client.lastVisit)}</span>
                    </div>
                    {client.avgFrequency > 0 && (
                      <p className="text-2xs mt-1" style={{ color: 'var(--text-muted)' }}>
                        Promedio cada {client.avgFrequency} días
                      </p>
                    )}
                  </div>
                  {client.phone && (
                    <Button
                      variant="icon"
                      onClick={(e) => { e.stopPropagation(); openWhatsApp(client.phone) }}
                      className="shrink-0 text-success-400 hover:bg-success-500/10"
                      aria-label={`Contactar a ${client.name} por WhatsApp`}
                    >
                      <WhatsAppIcon width={13} height={13} />
                    </Button>
                  )}
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      <AnimatePresence>
        {selectedClient && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
            onClick={() => setSelectedUid(null)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="max-h-[85vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-xl border border-ink/10 bg-surface p-5 shadow-elevated"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>{selectedClient.name}</h2>
                  <p className="truncate text-xs" style={{ color: 'var(--text-muted)' }}>
                    {[selectedClient.phone, selectedClient.email].filter(Boolean).join(' · ') || 'Sin datos de contacto'}
                  </p>
                </div>
                <Button variant="icon" onClick={() => setSelectedUid(null)} aria-label="Cerrar">
                  <X size={14} />
                </Button>
              </div>

              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: 'Paseos', value: String(selectedClient.sessions.length) },
                  { label: 'Completados', value: String(selectedClient.completedCount) },
                  { label: 'Frecuencia', value: selectedClient.avgFrequency > 0 ? `${selectedClient.avgFrequency}d` : '—' },
                  { label: 'Perros', value: String(selectedClient.dogs.length) },
                ].map((kpi) => (
                  <div key={kpi.label} className="rounded-xl py-3 text-center" style={{ background: 'var(--glass-bg)' }}>
                    <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{kpi.value}</p>
                    <p className="text-2xs" style={{ color: 'var(--text-muted)' }}>{kpi.label}</p>
                  </div>
                ))}
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Perros</p>
                {selectedClient.dogs.length === 0 ? (
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Esta familia todavía no ha dado de alta ningún perro.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedClient.dogs.map((dog) => (
                      <span key={dog.id} className="text-2xs rounded-full bg-brand-500/10 px-2.5 py-1 text-brand-600">
                        {dog.name}{dog.breed ? ` · ${dog.breed}` : ''}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Historial de paseos</p>
                {selectedClient.sessions.length === 0 ? (
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Sin paseos registrados todavía.</p>
                ) : (
                  <div className="max-h-56 space-y-1.5 overflow-y-auto">
                    {[...selectedClient.sessions].sort((a, b) => b.date.localeCompare(a.date)).map((session) => (
                      <div key={session.id} className="flex items-center justify-between rounded-xl px-3 py-2 text-xs" style={{ background: 'var(--glass-bg)', border: '1px solid var(--border)' }}>
                        <div className="flex items-center gap-2">
                          <span className={`h-1.5 w-1.5 rounded-full ${session.status === 'completed' ? 'bg-success-500' : session.status === 'cancelled' ? 'bg-danger-500' : 'bg-brand-500'}`} />
                          <div>
                            <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{session.service}</p>
                            <p className="text-2xs" style={{ color: 'var(--text-muted)' }}>{session.date} · {session.petName || 'Perro sin nombre'}</p>
                          </div>
                        </div>
                        {session.walkerName && <span className="text-2xs" style={{ color: 'var(--text-muted)' }}>{session.walkerName}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {selectedClient.phone && (
                <button
                  onClick={() => openWhatsApp(selectedClient.phone)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-success-500/10 py-2.5 text-sm font-medium text-success-600 transition-colors hover:bg-success-500/20"
                >
                  <WhatsAppIcon width={13} height={13} /> Contactar por WhatsApp
                </button>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
