'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { db } from '@/firebase/db'
import {
  doc, updateDoc,
  deleteDoc, serverTimestamp, where, getDocs, collection, query as fsQuery, orderBy as fsOrderBy,
  limit as fsLimit,
} from 'firebase/firestore'
import { Search, Dog, Pencil, Trash2,
  Camera, Download, X,
  ArrowRight, Undo2, PersonStanding, Sparkles } from 'lucide-react'
import { STATUS_LABELS } from '@/lib/sessionMachine'
import { ReservationsProvider, useReservations } from '@/context/ReservationsContext'
import { useToast } from '@/context/ToastContext'
import { isWalkerAvailable } from '@/lib/scheduling'
import Badge from '@/components/ui/Badge'
import LoadingState from '@/components/ui/LoadingState'
import EmptyState from '@/components/ui/EmptyState'
import Button from '@/components/ui/Button'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import EditReservationModal from '@/components/EditReservationModal'
import WalkSessionModal from '@/components/WalkSessionModal'
import { logAudit } from '@/lib/auditLog'
import type { Reservation } from '@/types'
import { FEATURE_FLAGS } from '@/lib/featureFlags'
import { confirmWhatsAppShare } from '@/lib/utils'
import { WhatsAppIcon } from '@/components/ui/SocialIcons'

type StatusFilter = 'all' | 'pending' | 'assigned' | 'on_the_way' | 'in_progress' | 'completed' | 'cancelled'

/**
 * El historial anterior a walkSessions: la colección `reservations`, que nada
 * escribe desde la migración. Vivía en la página de Solicitudes y su lector en
 * vivo estaba en el layout de admin, así que CADA panel abría una escucha sobre
 * esa colección aunque nadie la mirara. Ahora se carga sólo al abrir esta vista.
 *
 * Las escrituras siguen detrás de LEGACY_RESERVATION_WRITES_ENABLED (apagada);
 * la decisión de cerrarlas también en las reglas es la fase 11.
 */
export default function LegacyReservationsTab() {
  return (
    <ReservationsProvider>
      <LegacyReservationsView />
    </ReservationsProvider>
  )
}

function LegacyReservationsView() {
  const { reservations, loading } = useReservations()
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [deletingReservation, setDeletingReservation] = useState(false)
  const [historyReservations, setHistoryReservations] = useState<Reservation[]>([])
  const [historyPhone, setHistoryPhone] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const [walkModal, setWalkModal] = useState<{ reservation: Reservation; mode: 'check_in' | 'check_out' } | null>(null)
  const [walkerFilter, setWalkerFilter] = useState('')
  const [autoAssigning, setAutoAssigning] = useState(false)
  const { toast } = useToast()

  const filtered = useMemo(() => {
    let result = reservations
    if (statusFilter !== 'all') {
      result = result.filter((r) => r.status === statusFilter)
    }
    if (dateFrom) {
      result = result.filter((r) => r.date >= dateFrom)
    }
    if (dateTo) {
      result = result.filter((r) => r.date <= dateTo)
    }
    if (walkerFilter) {
      result = result.filter((r) => r.assignedWalker === walkerFilter || r.assignment?.walkerId === walkerFilter)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (r) =>
          r.name?.toLowerCase().includes(q) ||
          r.petName?.toLowerCase().includes(q) ||
          r.phone?.includes(q) ||
          r.service?.toLowerCase().includes(q)
      )
    }
    return result
  }, [reservations, statusFilter, searchQuery, dateFrom, dateTo, walkerFilter])

  const stats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0]
    return {
      total: reservations.length,
      pending: reservations.filter((r) => r.status === 'pending').length,
      today: reservations.filter((r) => r.date === today).length,
      completed: reservations.filter((r) => r.status === 'completed').length,
    }
  }, [reservations])

  const handlePaymentToggle = async (id: string, current: 'pending' | 'paid' | undefined) => {
    if (!FEATURE_FLAGS.LEGACY_RESERVATION_WRITES_ENABLED) {
      toast('El historial legacy es de solo lectura. Actualiza la orden canónica.', 'error')
      return
    }
    const newStatus = current === 'paid' ? 'pending' : 'paid'
    try {
      void logAudit({ action: 'update', entity: 'reservation', entityId: id, meta: { from: current, to: newStatus } })
      await updateDoc(doc(db, 'reservations', id), { paymentStatus: newStatus })
      toast('Pago actualizado')
    } catch { toast('Error al actualizar pago', 'error') }
  }

  const handleDelete = async () => {
    if (!confirmDelete) return
    if (!FEATURE_FLAGS.LEGACY_RESERVATION_WRITES_ENABLED) {
      setConfirmDelete(null)
      toast('Las reservas legacy no se eliminan desde el navegador.', 'error')
      return
    }
    setDeletingReservation(true)
    try {
      void logAudit({ action: 'delete', entity: 'reservation', entityId: confirmDelete })
      await deleteDoc(doc(db, 'reservations', confirmDelete))
      setConfirmDelete(null)
      toast('Reserva eliminada')
    } catch { toast('Error al eliminar reserva', 'error') }
    setDeletingReservation(false)
  }

  const openWhatsApp = (phone: string, name: string) => {
    const cleaned = phone.replace(/\D/g, '')
    confirmWhatsAppShare(`52${cleaned}`, `Hola ${name}, soy de PET Ap. Solicito contacto sobre tu servicio.`)
  }

  const viewHistory = async (phone: string) => {
    const q = fsQuery(
      collection(db, 'reservations'),
      where('phone', '==', phone),
      fsOrderBy('createdAt', 'desc'),
      fsLimit(100),
    )
    const snap = await getDocs(q)
    const history = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    setHistoryReservations(history as Reservation[])
    setHistoryPhone(phone)
    setShowHistory(true)
  }

  const exportCSV = () => {
    const headers = ['Nombre', 'Teléfono', 'Mascota', 'Servicio', 'Fecha', 'Hora', 'Notas', 'Estado', 'Paseador']
    const rows = filtered.map((r) => [
      r.name, r.phone, r.petName, r.service, r.date, r.time,
      r.notes || '', (STATUS_LABELS as Record<string, string>)[r.status] || r.status, r.assignedWalker || '',
    ])
    const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${c}"`).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `reservas-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const autoAssign = async () => {
    if (!FEATURE_FLAGS.LEGACY_RESERVATION_WRITES_ENABLED) {
      toast('La asignación legacy está desactivada. Usa walkSessions.', 'error')
      return
    }
    setAutoAssigning(true)
    try {
      const today = new Date().toISOString().split('T')[0]
      const pending = reservations.filter((r) => r.status === 'pending' && r.date === today && !r.assignedWalker)

      if (pending.length === 0) {
        toast('Sin reservas pendientes para hoy')
        setAutoAssigning(false)
        return
      }

      // Fetch walkerProfiles from Firestore (rich data with zones, schedule, status)
      const walkerProfilesSnap = await getDocs(fsQuery(collection(db, 'walkerProfiles'), fsLimit(100)))
      const walkerProfiles = walkerProfilesSnap.docs
        .map((d) => ({ id: d.id, ...d.data() } as Record<string, unknown>))
        .filter((w) => w.status === 'active')

      if (walkerProfiles.length === 0) {
        toast('No hay paseadores activos', 'error')
        setAutoAssigning(false)
        return
      }

      // Count current assignments per walker today (by uid)
      const loads: Record<string, number> = {}
      reservations.filter((r) => r.date === today && r.assignedWalker && r.status !== 'cancelled').forEach((r) => {
        const walkerUid = r.assignment?.walkerId || r.assignedWalker
        loads[walkerUid] = (loads[walkerUid] || 0) + 1
      })

      // Get day of week for schedule matching (lun, mar, mie, jue, vie, sab, dom)
      const dayMap = ['dom', 'lun', 'mar', 'mie', 'jue', 'vie', 'sab']
      const reservationDay = dayMap[new Date(today + 'T12:00:00').getDay()]

      let assigned = 0
      for (const res of pending) {
        const timeSlot = res.arrivalWindowStart
          ? (res.arrivalWindowEnd ? `${res.arrivalWindowStart}-${res.arrivalWindowEnd}` : res.arrivalWindowStart)
          : res.time || '09:00-09:20'

        // Find walkers with capacity, matching schedule, no transit conflicts, sorted by lowest load
        const available = walkerProfiles
          .filter((w) => {
            const uid = String(w.id || w.uid || '')
            const maxDaily = Number(w.maxDaily) || 8
            const currentLoad = loads[uid] || 0

            // Check daily capacity
            if (currentLoad >= maxDaily) return false

            // Check schedule availability
            const schedule = w.schedule as Record<string, Array<{ start: string; end: string }> | undefined>
            if (schedule && schedule[reservationDay]) {
              const slots = schedule[reservationDay]
              const reservationHour = parseInt(timeSlot.split(':')[0] || '9', 10)
              const isInSlot = slots.some((slot) => {
                const startHour = parseInt(slot.start?.split(':')[0] || '0', 10)
                const endHour = parseInt(slot.end?.split(':')[0] || '23', 10)
                return reservationHour >= startHour && reservationHour < endHour
              })
              if (!isInSlot) return false
            }

            // Check transit buffer — no conflict with existing reservations
            const walkerRes = reservations.filter(
              (r) => r.assignment?.walkerId === uid || r.assignedWalker === w.name,
            )
            const { available: hasSlot } = isWalkerAvailable(
              uid, res.date, timeSlot, walkerRes, res.service, res.id,
            )
            if (!hasSlot) return false

            return true
          })
          .sort((a, b) => {
            const uidA = String(a.id || a.uid || '')
            const uidB = String(b.id || b.uid || '')

            // Continuity: prefer walker who previously served this client
            const prevWalkerA = reservations.some(
              (r) => r.customer?.uid === res.customer?.uid && (r.assignment?.walkerId === uidA || r.assignedWalker === a.name) && r.status === 'completed',
            ) ? 1 : 0
            const prevWalkerB = reservations.some(
              (r) => r.customer?.uid === res.customer?.uid && (r.assignment?.walkerId === uidB || r.assignedWalker === b.name) && r.status === 'completed',
            ) ? 1 : 0
            if (prevWalkerA !== prevWalkerB) return prevWalkerB - prevWalkerA

            // Zone match: prefer walker in reservation zone
            const zonesA = (a.zones || []) as string[]
            const zonesB = (b.zones || []) as string[]
            const zoneMatchA = res.zoneId && zonesA.includes(res.zoneId) ? 1 : 0
            const zoneMatchB = res.zoneId && zonesB.includes(res.zoneId) ? 1 : 0
            if (zoneMatchA !== zoneMatchB) return zoneMatchB - zoneMatchA

            // Load balance: prefer less loaded walker
            return (loads[uidA] || 0) - (loads[uidB] || 0)
          })

        if (available.length > 0) {
          const walker = available[0]
          const walkerUid = String(walker.id || walker.uid || '')
          const walkerName = String(walker.name || '')

          await updateDoc(doc(db, 'reservations', res.id), {
            status: 'assigned',
            assignedWalker: walkerName,
            assignment: {
              walkerId: walkerUid,
              walkerName: walkerName,
              assignedAt: serverTimestamp(),
              assignedBy: 'auto',
            },
            history: [...(res.history || []), { status: 'assigned', timestamp: new Date().toISOString() }],
          })
          loads[walkerUid] = (loads[walkerUid] || 0) + 1
          assigned++
        }
      }

      toast(assigned > 0 ? `${assigned} reserva${assigned !== 1 ? 's' : ''} asignada${assigned !== 1 ? 's' : ''}` : 'Sin reservas para asignar')
    } catch {
      toast('Error en auto-asignación', 'error')
    }
    setAutoAssigning(false)
  }

  // Nombres que aparecen en el historial legacy. Los paseadores reales viven
  // en `walkerProfiles` y se asignan desde Solicitudes canónicas.
  const walkers = useMemo(
    () => Array.from(new Set(reservations.filter((r) => r.assignedWalker).map((r) => r.assignedWalker))),
    [reservations],
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">{stats.total} reservas anteriores · {stats.pending} pendientes · {stats.today} hoy</p>
        <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={autoAssign} disabled={stats.pending === 0 || !FEATURE_FLAGS.LEGACY_RESERVATION_WRITES_ENABLED} isLoading={autoAssigning} leftIcon={<Sparkles size={12} />}>
              Auto-asignar
            </Button>
            <Button size="sm" variant="secondary" onClick={exportCSV} leftIcon={<Download size={12} />}>
              Exportar
            </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: stats.total, color: '#D97706' },
          { label: 'Pendientes', value: stats.pending, color: '#3b82f6' },
          { label: 'Hoy', value: stats.today, color: '#059669' },
          { label: 'Completadas', value: stats.completed, color: '#7C3AED' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-ink/10 bg-surface p-4 shadow-sm">
            <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{s.value}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2" size={12} style={{ color: 'var(--text-muted)' }} />
          <input
            type="search"
            aria-label="Buscar entre las solicitudes y paseos"
            placeholder="Buscar por nombre, mascota, teléfono..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field pl-9"
          />
        </div>
        <select
          value={walkerFilter}
          onChange={(e) => setWalkerFilter(e.target.value)}
          aria-label="Filtrar por paseador"
          className="input-field !w-auto"
        >
          <option value="">Todos los paseadores</option>
          {walkers.map((w) => (
            <option key={w} value={w}>{w}</option>
          ))}
        </select>
        <input
          type="date"
          aria-label="Desde esta fecha"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="input-field !w-auto"
          title="Desde"
        />
        <input
          type="date"
          aria-label="Hasta esta fecha"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="input-field !w-auto"
          title="Hasta"
        />
      </div>

      {!FEATURE_FLAGS.LEGACY_RESERVATION_WRITES_ENABLED && (
        <p className="rounded-xl bg-warning/10 px-4 py-3 text-sm text-amber-800" role="status">
          `reservations` se conserva únicamente para consulta histórica. Las asignaciones nuevas se realizan en Solicitudes canónicas.
        </p>
      )}

      <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-1">
        {(['all', 'pending', 'assigned', 'on_the_way', 'in_progress', 'completed', 'cancelled'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`text-xs whitespace-nowrap px-3 py-1.5 rounded-lg font-medium transition-all ${
              statusFilter === s
                ? s === 'completed' ? 'bg-success-500/15 text-success-600'
                : s === 'on_the_way' ? 'bg-blue-500/15 text-blue-700'
                : s === 'in_progress' ? 'bg-purple-500/15 text-purple-700'
                : s === 'assigned' ? 'bg-brand-500/15 text-brand-600'
                : s === 'cancelled' ? 'bg-danger-500/15 text-red-700'
                : s === 'pending' ? 'bg-brand-500/15 text-brand-600'
                : 'bg-ink/10 text-ink'
              : 'bg-ink/5 text-muted hover:text-primary'
            }`}
          >
            {s === 'all' ? 'Todas' : (STATUS_LABELS as Record<string, string>)[s] || s}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingState rows={5} height="h-24" />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Dog size={24} />}
          title={searchQuery || statusFilter !== 'all' ? 'Sin resultados' : 'No hay reservas aún'}
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((res) => (
            <div
              key={res.id}
              className="rounded-xl border border-ink/10 bg-surface p-4 shadow-sm transition-all hover:bg-ink/5"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{res.name}</span>
                    <Badge variant={res.status === 'completed' ? 'success' : res.status === 'on_the_way' ? 'info' : res.status === 'cancelled' ? 'danger' : res.status === 'in_progress' ? 'info' : 'brand'} className="normal-case tracking-normal">
                      {(STATUS_LABELS as Record<string, string>)[res.status] || res.status}
                    </Badge>
                    {res.assignedWalker && (
                      <span className="text-2xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400">
                        🦮 {res.assignedWalker}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                    <span>🐾 {res.petName}</span>
                    <button onClick={() => viewHistory(res.phone)} className="hover:text-brand-600 transition-colors">
                      📞 {res.phone}
                    </button>
                    <span>📋 {res.service}</span>
                    <span>📅 {res.date}</span>
                    <span>⏰ {res.arrivalWindowStart ? `${res.arrivalWindowStart}${res.arrivalWindowEnd ? `-${res.arrivalWindowEnd}` : ''}` : res.time}</span>
                    <button
                      onClick={() => handlePaymentToggle(res.id, res.paymentStatus)}
                      disabled={!FEATURE_FLAGS.LEGACY_RESERVATION_WRITES_ENABLED}
                      className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded transition-all ${
                        res.paymentStatus === 'paid' ? 'bg-success-500/15 text-success-600' : 'bg-brand-500/15 text-brand-600'
                      } disabled:cursor-not-allowed disabled:opacity-50`}
                    >
                      {res.paymentStatus === 'paid' ? '✓ Pagado' : '⏳ Pendiente'}
                    </button>
                  </div>
                  {res.notes && (
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>📝 {res.notes}</p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button onClick={() => openWhatsApp(res.phone, res.name)} className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-success-500/10 text-success-400" title="WhatsApp">
                    <WhatsAppIcon width={13} height={13} />
                  </button>
                  <button onClick={() => setEditingReservation(res)} disabled={!FEATURE_FLAGS.LEGACY_RESERVATION_WRITES_ENABLED} className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-blue-500/10 text-blue-400 disabled:cursor-not-allowed disabled:opacity-40" title={FEATURE_FLAGS.LEGACY_RESERVATION_WRITES_ENABLED ? 'Editar' : 'Legacy de solo lectura'}>
                    <Pencil size={12} />
                  </button>
                  {(res.status === 'pending' || res.status === 'assigned') && (
                    <button onClick={async () => { if (!FEATURE_FLAGS.LEGACY_RESERVATION_WRITES_ENABLED) { toast('El historial legacy es de solo lectura.', 'error'); return } try { await updateDoc(doc(db, 'reservations', res.id), { status: 'on_the_way' }); toast('Estado actualizado') } catch { toast('Error al actualizar estado', 'error') } }} disabled={!FEATURE_FLAGS.LEGACY_RESERVATION_WRITES_ENABLED} className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-purple-500/10 text-purple-400 disabled:cursor-not-allowed disabled:opacity-40" title={FEATURE_FLAGS.LEGACY_RESERVATION_WRITES_ENABLED ? 'En camino' : 'Legacy de solo lectura'}>
                      <ArrowRight size={12} />
                    </button>
                  )}
                  {res.status === 'on_the_way' && (
                    <button onClick={() => setWalkModal({ reservation: res, mode: 'check_in' })} disabled={!FEATURE_FLAGS.LEGACY_RESERVATION_WRITES_ENABLED} className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-brand-500/10 text-brand-400 disabled:cursor-not-allowed disabled:opacity-40" title={FEATURE_FLAGS.LEGACY_RESERVATION_WRITES_ENABLED ? 'Iniciar paseo (check-in)' : 'Legacy de solo lectura'}>
                      <Camera size={12} />
                    </button>
                  )}
                  {res.status === 'in_progress' && (
                    <button onClick={() => setWalkModal({ reservation: res, mode: 'check_out' })} disabled={!FEATURE_FLAGS.LEGACY_RESERVATION_WRITES_ENABLED} className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-success-500/10 text-success-400 disabled:cursor-not-allowed disabled:opacity-40" title={FEATURE_FLAGS.LEGACY_RESERVATION_WRITES_ENABLED ? 'Terminar paseo (check-out)' : 'Legacy de solo lectura'}>
                      <PersonStanding size={12} />
                    </button>
                  )}
                  {res.status === 'completed' && (
                    <button onClick={async () => { if (!FEATURE_FLAGS.LEGACY_RESERVATION_WRITES_ENABLED) { toast('El historial legacy es de solo lectura.', 'error'); return } try { await updateDoc(doc(db, 'reservations', res.id), { status: 'pending' }); toast('Estado restaurado') } catch { toast('Error al restaurar estado', 'error') } }} disabled={!FEATURE_FLAGS.LEGACY_RESERVATION_WRITES_ENABLED} className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-brand-500/10 text-brand-400 disabled:cursor-not-allowed disabled:opacity-40" title={FEATURE_FLAGS.LEGACY_RESERVATION_WRITES_ENABLED ? 'Restaurar' : 'Legacy de solo lectura'}>
                      <Undo2 size={11} />
                    </button>
                  )}
                  <button onClick={() => setConfirmDelete(res.id)} disabled={!FEATURE_FLAGS.LEGACY_RESERVATION_WRITES_ENABLED} className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-danger-500/10 text-danger-400 disabled:cursor-not-allowed disabled:opacity-40" title={FEATURE_FLAGS.LEGACY_RESERVATION_WRITES_ENABLED ? 'Eliminar' : 'Legacy de solo lectura'}>
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Modal */}
      <EditReservationModal
        isOpen={!!editingReservation}
        onClose={() => setEditingReservation(null)}
        reservation={editingReservation}
        reservations={reservations}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title="Eliminar reserva"
        description="Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        danger
        loading={deletingReservation}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
      />

      {/* History Modal */}
      <AnimatePresence>
        {showHistory && (
                     <div className="fixed inset-0 z-[var(--z-overlay)] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60" onClick={() => setShowHistory(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative rounded-xl border border-ink/10 bg-surface p-6 w-full max-w-lg max-h-[70vh] overflow-y-auto shadow-elevated"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Historial · {historyPhone}</h3>
                <Button variant="icon" onClick={() => setShowHistory(false)} aria-label="Cerrar historial">
                  <X size={14} />
                </Button>
              </div>
              {historyReservations.length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Sin historial</p>
              ) : (
                <div className="space-y-2">
                  {historyReservations.map((r) => (
                    <div key={r.id} className="flex items-center justify-between rounded-xl border border-ink/10 bg-[var(--glass-bg)] p-3">
                      <div>
                        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{r.service} · {r.petName}</p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{r.date} {r.arrivalWindowStart ? `${r.arrivalWindowStart}${r.arrivalWindowEnd ? `-${r.arrivalWindowEnd}` : ''}` : r.time}</p>
                      </div>
                      <Badge variant={r.status === 'completed' ? 'success' : r.status === 'on_the_way' ? 'info' : r.status === 'cancelled' ? 'danger' : r.status === 'in_progress' ? 'info' : 'brand'} className="normal-case tracking-normal">
                        {(STATUS_LABELS as Record<string, string>)[r.status] || r.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Walk Session Modal */}
      <WalkSessionModal
        isOpen={!!walkModal}
        onClose={() => setWalkModal(null)}
        reservation={walkModal?.reservation || ({} as Reservation)}
        mode={walkModal?.mode || 'check_in'}
      />
    </div>
  )
}
