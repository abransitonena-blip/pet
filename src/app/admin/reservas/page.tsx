'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { db } from '@/firebase/config'
import {
  doc, updateDoc,
  deleteDoc, serverTimestamp, where, getDocs, collection, query as fsQuery, orderBy as fsOrderBy,
  getDoc,
} from 'firebase/firestore'
import { Search, Dog, Pencil, Trash2,
  Camera, Download, Loader2, X,
  ArrowRight, Undo2, PersonStanding, Sparkles, Package, ChevronDown, ChevronRight } from 'lucide-react'
import { STATUS_LABELS, STATUS_COLORS } from '@/lib/sessionMachine'
import type { SessionStatus } from '@/types'
import { getServicePrice } from '@/lib/services'
import { usePrices } from '@/context/PricesContext'
import { useReservations } from '@/context/ReservationsContext'
import { useToast } from '@/context/ToastContext'
import { useConfig } from '@/context/ConfigContext'
import { isWalkerAvailable } from '@/lib/scheduling'
import Badge from '@/components/ui/Badge'
import EditReservationModal from '@/components/EditReservationModal'
import WalkSessionModal from '@/components/WalkSessionModal'
import { logChange } from '@/lib/audit'
import type { Reservation } from '@/types'
import { useServiceOrders, type ServiceOrderWithSessions } from '@/lib/useServiceOrders'

type StatusFilter = 'all' | 'pending' | 'assigned' | 'on_the_way' | 'in_progress' | 'completed' | 'cancelled'

export default function AdminReservas() {
  const { reservations, loading } = useReservations()
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [historyReservations, setHistoryReservations] = useState<Reservation[]>([])
  const [historyPhone, setHistoryPhone] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const [walkModal, setWalkModal] = useState<{ reservation: Reservation; mode: 'check_in' | 'check_out' } | null>(null)
  const [walkerFilter, setWalkerFilter] = useState('')
  const [autoAssigning, setAutoAssigning] = useState(false)
  const [viewTab, setViewTab] = useState<'reservations' | 'orders'>('reservations')
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null)
  const { prices } = usePrices()
  const { toast } = useToast()
  const { config } = useConfig()
  const { orders } = useServiceOrders()

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

  const handleComplete = async (id: string) => {
    try {
      await updateDoc(doc(db, 'reservations', id), { status: 'completed', completedAt: serverTimestamp() })
      toast('Reserva completada')
    } catch { toast('Error al completar reserva', 'error') }
  }

  const handlePaymentToggle = async (id: string, current: 'pending' | 'paid' | undefined) => {
    const newStatus = current === 'paid' ? 'pending' : 'paid'
    try {
      logChange('payment_toggle', id, { from: current, to: newStatus })
      await updateDoc(doc(db, 'reservations', id), { paymentStatus: newStatus })
      toast('Pago actualizado')
    } catch { toast('Error al actualizar pago', 'error') }
  }

  const handleDelete = async () => {
    if (!confirmDelete) return
    try {
      logChange('delete', confirmDelete, { col: 'reservations' })
      await deleteDoc(doc(db, 'reservations', confirmDelete))
      setConfirmDelete(null)
      toast('Reserva eliminada')
    } catch { toast('Error al eliminar reserva', 'error') }
  }

  const openWhatsApp = (phone: string, name: string) => {
    const cleaned = phone.replace(/\D/g, '')
    window.open(`https://wa.me/52${cleaned}?text=Hola ${encodeURIComponent(name)}, soy de PET Ap 🐾`, '_blank')
  }

  const viewHistory = async (phone: string) => {
    const q = fsQuery(collection(db, 'reservations'), where('phone', '==', phone), fsOrderBy('createdAt', 'desc'))
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
      const walkerProfilesSnap = await getDocs(collection(db, 'walkerProfiles'))
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
              (r) => r.client?.uid === res.client?.uid && (r.assignment?.walkerId === uidA || r.assignedWalker === a.name) && r.status === 'completed',
            ) ? 1 : 0
            const prevWalkerB = reservations.some(
              (r) => r.client?.uid === res.client?.uid && (r.assignment?.walkerId === uidB || r.assignedWalker === b.name) && r.status === 'completed',
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

  const walkers = useMemo(() => {
    // Combine walkers from reservations and config
    const fromReservations = reservations.filter((r) => r.assignedWalker).map((r) => r.assignedWalker)
    const fromConfig = ((config.walkers || []) as { name: string }[]).map((w) => w.name)
    return Array.from(new Set([...fromReservations, ...fromConfig]))
  }, [reservations, config.walkers])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Gestión de Reservas</h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {stats.total} reservas · {stats.pending} pendientes · {stats.today} hoy
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={autoAssign} disabled={autoAssigning || stats.pending === 0} className="btn-secondary !text-xs flex items-center gap-1.5 disabled:opacity-40">
            {autoAssigning ? <Loader2 className="animate-spin" size={12} /> : <Sparkles size={12} />}
            Auto-asignar
          </button>
          <button onClick={exportCSV} className="btn-secondary !text-xs flex items-center gap-1.5">
            <Download size={12} /> Exportar
          </button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: stats.total, color: '#D97706' },
          { label: 'Pendientes', value: stats.pending, color: '#3b82f6' },
          { label: 'Hoy', value: stats.today, color: '#059669' },
          { label: 'Completadas', value: stats.completed, color: '#7C3AED' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
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
            type="text"
            placeholder="Buscar por nombre, mascota, teléfono..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field pl-9"
          />
        </div>
        <select
          value={walkerFilter}
          onChange={(e) => setWalkerFilter(e.target.value)}
          className="input-field !w-auto"
        >
          <option value="">Todos los paseadores</option>
          {walkers.map((w) => (
            <option key={w} value={w}>{w}</option>
          ))}
        </select>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="input-field !w-auto"
          title="Desde"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="input-field !w-auto"
          title="Hasta"
        />
      </div>

      {/* View tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setViewTab('reservations')}
          className={`text-xs px-4 py-2 rounded-lg font-medium transition-all ${
            viewTab === 'reservations' ? 'bg-brand-500/15 text-brand-600 border border-brand-500/30' : 'border border-ink/15 text-muted hover:text-ink/70'
          }`}
        >
          🐾 Reservas
        </button>
        <button
          onClick={() => setViewTab('orders')}
          className={`text-xs px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
            viewTab === 'orders' ? 'bg-brand-500/15 text-brand-600 border border-brand-500/30' : 'border border-ink/15 text-muted hover:text-ink/70'
          }`}
        >
          <Package size={11} /> Paquetes {orders.length > 0 && <span className="bg-brand-500/20 text-brand-600 px-1.5 py-0.5 rounded-full text-2xs">{orders.length}</span>}
        </button>
      </div>

      {/* Status filter tabs (only for reservations view) */}
      {viewTab === 'reservations' && (
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
      )}

      {/* Reservation list */}
      {viewTab === 'reservations' && (loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="skeleton h-24 rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Dog className="text-4xl mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {searchQuery || statusFilter !== 'all' ? 'Sin resultados' : 'No hay reservas aún'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((res) => (
            <div
              key={res.id}
              className="rounded-xl p-4 transition-all hover:bg-ink/5"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
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
                    {res.orderId && (
                      <span className="text-2xs px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-600">
                        📦 Paquete
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
                      className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded transition-all ${
                        res.paymentStatus === 'paid' ? 'bg-success-500/15 text-success-600' : 'bg-brand-500/15 text-brand-600'
                      }`}
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
                  <button onClick={() => setEditingReservation(res)} className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-blue-500/10 text-blue-400" title="Editar">
                    <Pencil size={12} />
                  </button>
                  {(res.status === 'pending' || res.status === 'assigned') && (
                    <button onClick={async () => { try { await updateDoc(doc(db, 'reservations', res.id), { status: 'on_the_way' }); toast('Estado actualizado') } catch { toast('Error al actualizar estado', 'error') } }} className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-purple-500/10 text-purple-400" title="En camino">
                      <ArrowRight size={12} />
                    </button>
                  )}
                  {res.status === 'on_the_way' && (
                    <button onClick={() => setWalkModal({ reservation: res, mode: 'check_in' })} className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-brand-500/10 text-brand-400" title="Iniciar paseo (check-in)">
                      <Camera size={12} />
                    </button>
                  )}
                  {res.status === 'in_progress' && (
                    <button onClick={() => setWalkModal({ reservation: res, mode: 'check_out' })} className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-success-500/10 text-success-400" title="Terminar paseo (check-out)">
                      <PersonStanding size={12} />
                    </button>
                  )}
                  {res.status === 'completed' && (
                    <button onClick={async () => { try { await updateDoc(doc(db, 'reservations', res.id), { status: 'pending' }); toast('Estado restaurado') } catch { toast('Error al restaurar estado', 'error') } }} className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-brand-500/10 text-brand-400" title="Restaurar">
                      <Undo2 size={11} />
                    </button>
                  )}
                  <button onClick={() => setConfirmDelete(res.id)} className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-danger-500/10 text-danger-400" title="Eliminar">
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ))}

      {/* ─── SERVICE ORDERS TAB ─── */}
      {viewTab === 'orders' && (
        <div className="space-y-3">
          {orders.length === 0 ? (
            <div className="text-center py-16">
              <Package className="text-4xl mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No hay paquetes semanales activos</p>
            </div>
          ) : (
            orders.map((order) => {
              const isExpanded = expandedOrder === order.id
              const scheduledSessions = order.sessions.filter((s) => s.sessionStatus !== 'cancelled')
              const completedSessions = order.sessions.filter((s) => s.sessionStatus === 'completed')
              return (
                <div key={order.id} className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                  <button
                    onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                    className="w-full flex items-center justify-between p-4 text-left hover:bg-ink/5 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{order.clientName}</span>
                        <Badge variant={order.status === 'active' ? 'success' : order.status === 'completed' ? 'default' : 'danger'}>
                          {order.status === 'active' ? 'Activo' : order.status === 'completed' ? 'Completado' : order.status}
                        </Badge>
                        <span className="text-2xs px-2 py-0.5 rounded-full bg-brand-500/15 text-brand-600 font-medium">
                          {completedSessions.length}/{scheduledSessions.length} sesiones
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                        <span>🐾 {order.dogName}</span>
                        <span>📋 {order.serviceName}</span>
                        <span>📞 {order.clientPhone}</span>
                        {order.total > 0 && <span className="font-medium" style={{ color: 'var(--text-primary)' }}>${order.total.toLocaleString()} MXN</span>}
                      </div>
                    </div>
                    {isExpanded ? <ChevronDown size={12} style={{ color: 'var(--text-muted)' }} /> : <ChevronRight size={12} style={{ color: 'var(--text-muted)' }} />}
                  </button>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                        <div className="px-4 pb-4 space-y-2" style={{ borderTop: '1px solid var(--border)' }}>
                          {order.sessions.map((session) => (
                            <div key={session.id} className="flex items-center justify-between py-2 px-3 rounded-lg text-xs" style={{ background: 'var(--glass-bg)' }}>
                              <div className="flex items-center gap-3">
                                <span className="capitalize" style={{ color: 'var(--text-secondary)' }}>
                                  {new Date(session.date + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })}
                                </span>
                                <span style={{ color: 'var(--text-muted)' }}>🕐 {session.startTime}</span>
                                {session.walkerName && <span style={{ color: 'var(--text-muted)' }}>🦮 {session.walkerName}</span>}
                              </div>
                              <span className={`text-2xs px-2 py-0.5 rounded-full font-medium ${
                                STATUS_COLORS[session.sessionStatus as SessionStatus]?.bg || 'bg-brand-500/15'
                              } ${STATUS_COLORS[session.sessionStatus as SessionStatus]?.text || 'text-brand-400'}`}>
                                {STATUS_LABELS[session.sessionStatus as SessionStatus] || session.sessionStatus}
                              </span>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )
            })
          )}
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
      <AnimatePresence>
        {confirmDelete && (
                     <div className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60" onClick={() => setConfirmDelete(null)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative rounded-2xl p-6 w-full max-w-sm"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
            >
              <h3 className="text-base font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Eliminar reserva</h3>
              <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>Esta acción no se puede deshacer.</p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmDelete(null)} className="flex-1 btn-secondary !text-xs">Cancelar</button>
                <button onClick={handleDelete} className="flex-1 btn-primary !text-xs !bg-danger-500 hover:!bg-danger-600">Eliminar</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* History Modal */}
      <AnimatePresence>
        {showHistory && (
                     <div className="fixed inset-0 z-[var(--z-overlay)] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60" onClick={() => setShowHistory(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative rounded-2xl p-6 w-full max-w-lg max-h-[70vh] overflow-y-auto"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Historial · {historyPhone}</h3>
                <button onClick={() => setShowHistory(false)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-ink/5" style={{ color: 'var(--text-muted)' }}>
                  <X size={14} />
                </button>
              </div>
              {historyReservations.length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Sin historial</p>
              ) : (
                <div className="space-y-2">
                  {historyReservations.map((r) => (
                    <div key={r.id} className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'var(--glass-bg)', border: '1px solid var(--border)' }}>
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

import { WhatsAppIcon } from '@/components/ui/SocialIcons'
