'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { db } from '@/firebase/config'
import {
  collection, query, orderBy, onSnapshot, doc, updateDoc,
  deleteDoc, serverTimestamp, where, getDocs,
} from 'firebase/firestore'
import {
  FaSearch, FaFilter, FaDog, FaWhatsapp, FaEdit, FaTrash,
  FaCheck, FaClock, FaCamera, FaDownload, FaSpinner, FaTimes,
  FaArrowRight, FaUndo, FaMoneyBill,
} from 'react-icons/fa'
import { getServicePrice } from '@/lib/services'
import { usePrices } from '@/context/PricesContext'
import EditReservationModal from '@/components/EditReservationModal'
import { logChange } from '@/lib/audit'
import type { Reservation } from '@/types'

type StatusFilter = 'all' | 'pending' | 'en_camino' | 'paseando' | 'completed'

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  en_camino: 'En camino',
  paseando: 'Paseando',
  completed: 'Completada',
  cancelled: 'Cancelada',
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-brand-500/15 text-brand-400',
  en_camino: 'bg-blue-500/15 text-blue-400',
  paseando: 'bg-purple-500/15 text-purple-400',
  completed: 'bg-success-500/15 text-success-400',
  cancelled: 'bg-danger-500/15 text-danger-400',
}

export default function AdminReservas() {
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [historyReservations, setHistoryReservations] = useState<Reservation[]>([])
  const [historyPhone, setHistoryPhone] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const { prices } = usePrices()

  useEffect(() => {
    const q = query(collection(db, 'reservations'), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(q, (snap) => {
      setReservations(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Reservation)))
      setLoading(false)
    }, () => setLoading(false))
    return unsub
  }, [])

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
  }, [reservations, statusFilter, searchQuery, dateFrom, dateTo])

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
    } catch {}
  }

  const handlePaymentToggle = async (id: string, current: 'pending' | 'paid' | undefined) => {
    const newStatus = current === 'paid' ? 'pending' : 'paid'
    try {
      logChange('payment_toggle', id, { from: current, to: newStatus })
      await updateDoc(doc(db, 'reservations', id), { paymentStatus: newStatus })
    } catch {}
  }

  const handleDelete = async () => {
    if (!confirmDelete) return
    try {
      logChange('delete', confirmDelete, { col: 'reservations' })
      await deleteDoc(doc(db, 'reservations', confirmDelete))
      setConfirmDelete(null)
    } catch {}
  }

  const openWhatsApp = (phone: string, name: string) => {
    const cleaned = phone.replace(/\D/g, '')
    window.open(`https://wa.me/52${cleaned}?text=Hola ${encodeURIComponent(name)}, soy de PET Ap 🐾`, '_blank')
  }

  const viewHistory = async (phone: string) => {
    const q = query(collection(db, 'reservations'), where('phone', '==', phone), orderBy('createdAt', 'desc'))
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
      r.notes || '', STATUS_LABELS[r.status] || r.status, r.assignedWalker || '',
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
        <button onClick={exportCSV} className="btn-secondary !text-xs flex items-center gap-1.5">
          <FaDownload size={12} /> Exportar CSV
        </button>
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
          <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2" size={12} style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Buscar por nombre, mascota, teléfono..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field pl-9"
          />
        </div>
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

      {/* Status filter tabs */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-1">
        {(['all', 'pending', 'en_camino', 'paseando', 'completed'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`text-xs whitespace-nowrap px-3 py-1.5 rounded-lg font-medium transition-all ${
              statusFilter === s
                ? s === 'completed' ? 'bg-success-500/15 text-success-400'
                : s === 'en_camino' ? 'bg-blue-500/15 text-blue-400'
                : s === 'paseando' ? 'bg-purple-500/15 text-purple-400'
                : s === 'pending' ? 'bg-brand-500/15 text-brand-400'
                : 'bg-white/10 text-white'
              : 'bg-white/[0.04] text-white/40 hover:text-white/60'
            }`}
          >
            {s === 'all' ? 'Todas' : STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {/* Reservation list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="skeleton h-24 rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <FaDog className="text-4xl mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {searchQuery || statusFilter !== 'all' ? 'Sin resultados' : 'No hay reservas aún'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((res) => (
            <div
              key={res.id}
              className="rounded-xl p-4 transition-all hover:bg-white/[0.02]"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{res.name}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[res.status] || 'bg-white/10 text-white/40'}`}>
                      {STATUS_LABELS[res.status] || res.status}
                    </span>
                    {res.assignedWalker && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400">
                        🦮 {res.assignedWalker}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                    <span>🐾 {res.petName}</span>
                    <button onClick={() => viewHistory(res.phone)} className="hover:text-brand-400 transition-colors">
                      📞 {res.phone}
                    </button>
                    <span>📋 {res.service}</span>
                    <span>📅 {res.date}</span>
                    <span>⏰ {res.time}</span>
                    <button
                      onClick={() => handlePaymentToggle(res.id, res.paymentStatus)}
                      className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded transition-all ${
                        res.paymentStatus === 'paid' ? 'bg-success-500/15 text-success-400' : 'bg-brand-500/15 text-brand-400'
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
                    <FaWhatsapp size={13} />
                  </button>
                  <button onClick={() => setEditingReservation(res)} className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-blue-500/10 text-blue-400" title="Editar">
                    <FaEdit size={12} />
                  </button>
                  {(res.status === 'pending') && (
                    <button onClick={() => updateDoc(doc(db, 'reservations', res.id), { status: 'en_camino' })} className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-purple-500/10 text-purple-400" title="En camino">
                      <FaArrowRight size={12} />
                    </button>
                  )}
                  {res.status === 'en_camino' && (
                    <button onClick={() => handleComplete(res.id)} className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-success-500/10 text-success-400" title="Completar">
                      <FaCheck size={12} />
                    </button>
                  )}
                  {res.status === 'completed' && (
                    <button onClick={() => updateDoc(doc(db, 'reservations', res.id), { status: 'pending' })} className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-brand-500/10 text-brand-400" title="Restaurar">
                      <FaUndo size={11} />
                    </button>
                  )}
                  <button onClick={() => setConfirmDelete(res.id)} className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-danger-500/10 text-danger-400" title="Eliminar">
                    <FaTrash size={11} />
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
      <AnimatePresence>
        {confirmDelete && (
          <div className="fixed inset-0 z-[40] flex items-center justify-center p-4">
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
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
                <button onClick={() => setShowHistory(false)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/5" style={{ color: 'var(--text-muted)' }}>
                  <FaTimes size={14} />
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
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{r.date} {r.time}</p>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[r.status] || 'bg-white/10 text-slate-400'}`}>
                        {STATUS_LABELS[r.status] || r.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
