'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore'
import { db } from '@/firebase/config'
import { FaDog, FaTimes, FaSpinner, FaCalendarAlt, FaHistory } from 'react-icons/fa'

interface Reservation {
  id: string
  name: string
  petName: string
  service: string
  date: string
  time: string
  status: string
}

const SERVICE_LABELS: Record<string, string> = {
  individual: 'Individual',
  extendido: 'Extendido',
  grupal: 'Grupal',
  adiestramiento: 'Adiestramiento',
  express: 'Express',
  reporte: 'Reporte',
  semanal: 'Semanal',
}

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'Pendiente', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
  en_camino: { label: 'En camino', color: '#3b82f6', bg: 'rgba(59,130,246,0.15)' },
  paseando: { label: 'Paseando', color: '#8b5cf6', bg: 'rgba(139,92,246,0.15)' },
  completed: { label: 'Completado', color: 'var(--color-success)', bg: 'var(--color-success-light)' },
  cancelled: { label: 'Cancelado', color: 'var(--color-error)', bg: 'var(--color-error-light)' },
}

export default function ClientPanel({ phone }: { phone: string }) {
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [cancelling, setCancelling] = useState<string | null>(null)
  const [cancelled, setCancelled] = useState<string | null>(null)

  useEffect(() => {
    if (!phone.trim()) return
    const q = query(
      collection(db, 'reservations'),
      where('phone', '==', phone.trim()),
    )
    setLoading(true)
    getDocs(q).then((snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Reservation))
      data.sort((a, b) => b.date.localeCompare(a.date))
      setReservations(data)
      setSearched(true)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [phone])

  const cancelReservation = async (id: string) => {
    setCancelling(id)
    await updateDoc(doc(db, 'reservations', id), { status: 'cancelled' })
    setCancelled(id)
    setReservations((prev) => prev.map((r) => (r.id === id ? { ...r, status: 'cancelled' } : r)))
    setCancelling(null)
  }

  const active = reservations.filter((r) => r.status !== 'completed' && r.status !== 'cancelled')
  const past = reservations.filter((r) => r.status === 'completed' || r.status === 'cancelled')

  if (!phone.trim()) return null

  return (
    <div className="glass-card p-5 sm:p-6">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-2">
          <FaCalendarAlt className="text-primary" size={14} />
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Mis reservas</h3>
          {reservations.length > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/20 text-primary">
              {active.length} activa{active.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{collapsed ? 'Expandir' : 'Cerrar'}</span>
      </button>

      {loading && (
        <div className="flex items-center justify-center gap-2 py-6">
          <FaSpinner className="animate-spin text-primary" size={14} />
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Cargando reservas...</span>
        </div>
      )}

      {!loading && searched && reservations.length === 0 && (
        <p className="text-xs text-center py-4" style={{ color: 'var(--text-muted)' }}>No hay reservas con este número</p>
      )}

      {!loading && searched && reservations.length > 0 && !collapsed && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 space-y-2"
        >
          {active.length > 0 && (
            <>
              <p className="text-[10px] uppercase tracking-wider font-medium" style={{ color: 'var(--text-muted)' }}>Próximos paseos</p>
              {active.map((r) => (
                <motion.div
                  key={r.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 rounded-xl"
                  style={{ background: 'rgba(255,255,255,0.04)' }}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <FaDog className="text-primary" size={10} />
                      <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{r.petName}</span>
                    </div>
                    <span
                      className="text-[10px] px-2 py-0.5 rounded-full"
                      style={{ background: STATUS_MAP[r.status]?.bg || 'rgba(255,255,255,0.1)', color: STATUS_MAP[r.status]?.color || 'white' }}
                    >
                      {STATUS_MAP[r.status]?.label || r.status}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                    <span>{SERVICE_LABELS[r.service] || r.service}</span>
                    <span>{r.date}</span>
                    <span>{r.time}</span>
                  </div>
                  {r.status === 'pending' && (
                    <button
                      onClick={() => cancelReservation(r.id)}
                      disabled={cancelling === r.id}
                      className="mt-2 text-xs text-red-400/60 hover:text-red-400 transition-all flex items-center gap-1"
                    >
                      {cancelling === r.id ? <FaSpinner className="animate-spin" size={10} /> : <FaTimes size={10} />}
                      Cancelar
                    </button>
                  )}
                </motion.div>
              ))}
            </>
          )}

          {past.length > 0 && (
            <div className="mt-4 pt-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
              <p className="text-[10px] uppercase tracking-wider font-medium mb-2 flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                <FaHistory size={9} /> Historial ({past.length})
              </p>
              {past.slice(0, 5).map((r) => (
                <div key={r.id} className="flex items-center justify-between py-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{r.petName} · {SERVICE_LABELS[r.service] || r.service}</span>
                  </div>
                  <span className="text-[10px] shrink-0" style={{ color: r.status === 'completed' ? '#22c55e' : '#ef4444' }}>
                    {r.status === 'completed' ? '✓' : '✗'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {!searched && !loading && (
        <p className="text-xs text-center py-2" style={{ color: 'var(--text-muted)' }}>Ingresa tu teléfono en el formulario para ver tus reservas</p>
      )}
    </div>
  )
}
