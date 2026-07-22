'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { collection, query, where, getDocs, updateDoc, doc, getDoc } from 'firebase/firestore'
import { db, auth } from '@/firebase/config'
import { FaDog, FaTimes, FaSpinner, FaCalendarAlt, FaHistory, FaUser, FaSignOutAlt, FaCamera, FaMapMarkerAlt } from 'react-icons/fa'

interface WalkMedia {
  photo: string
  lat: number
  lng: number
  timestamp?: { seconds: number; nanoseconds: number }
}

interface Reservation {
  id: string
  name: string
  petName: string
  service: string
  date: string
  time: string
  status: string
  walkCheckIn?: WalkMedia
  walkCheckOut?: WalkMedia
  walkNotes?: string
}

interface ClientData {
  name: string
  email: string
  phone: string
  createdAt: string
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

export default function ClientDashboard({ onLogout }: { onLogout: () => void }) {
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [clientData, setClientData] = useState<ClientData | null>(null)
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState<string | null>(null)
  const [selectedWalk, setSelectedWalk] = useState<Reservation | null>(null)

  useEffect(() => {
    const user = auth.currentUser
    if (!user) return

    getDoc(doc(db, 'clients', user.uid)).then((snap) => {
      if (snap.exists()) setClientData(snap.data() as ClientData)
    })

    const q = query(
      collection(db, 'reservations'),
      where('phone', '==', user.displayName || '')
    )
    getDocs(q).then((snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Reservation))
      data.sort((a, b) => b.date.localeCompare(a.date))
      setReservations(data)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const cancelReservation = async (id: string) => {
    setCancelling(id)
    await updateDoc(doc(db, 'reservations', id), { status: 'cancelled' })
    setReservations((prev) => prev.map((r) => (r.id === id ? { ...r, status: 'cancelled' } : r)))
    setCancelling(null)
  }

  const active = reservations.filter((r) => r.status !== 'completed' && r.status !== 'cancelled')
  const past = reservations.filter((r) => r.status === 'completed' || r.status === 'cancelled')

  return (
    <div className="glass-card p-5 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FaUser className="text-primary" size={14} />
          <div>
            <h3 className="text-sm font-semibold text-white">Mi cuenta</h3>
            {clientData && (
              <p className="text-[10px] text-white/30">{clientData.email}</p>
            )}
          </div>
        </div>
        <button
          onClick={onLogout}
          className="flex items-center gap-1 text-xs text-white/30 hover:text-red-400 transition-all"
        >
          <FaSignOutAlt size={10} />
          Salir
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-2 py-8">
          <FaSpinner className="animate-spin text-primary" size={16} />
          <span className="text-xs text-white/30">Cargando...</span>
        </div>
      )}

      {!loading && (
        <div className="space-y-4">
          {active.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-white/20 font-medium mb-2 flex items-center gap-1">
                <FaCalendarAlt size={9} /> Próximos paseos ({active.length})
              </p>
              <div className="space-y-2">
                {active.map((r) => (
                  <motion.div
                    key={r.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <FaDog className="text-primary" size={10} />
                        <span className="text-sm font-medium text-white">{r.petName}</span>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full"
                        style={{
                          background: r.status === 'en_camino' ? 'rgba(59,130,246,0.15)' : r.status === 'paseando' ? 'rgba(139,92,246,0.15)' : 'rgba(245,158,11,0.15)',
                          color: r.status === 'en_camino' ? '#3b82f6' : r.status === 'paseando' ? '#8b5cf6' : '#f59e0b',
                        }}
                      >
                        {r.status === 'en_camino' ? 'En camino' : r.status === 'paseando' ? 'Paseando' : 'Pendiente'}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-white/40">
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
              </div>
            </div>
          )}

          {active.length === 0 && (
            <div className="text-center py-4">
              <FaDog className="text-white/10 mx-auto mb-2" size={24} />
              <p className="text-xs text-white/30">No tienes paseos próximos</p>
              <a href="#reservar" className="text-xs text-primary hover:underline mt-1 inline-block">
                Reserva uno ahora
              </a>
            </div>
          )}

          {past.length > 0 && (
            <div className="pt-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
              <p className="text-[10px] uppercase tracking-wider text-white/20 font-medium mb-2 flex items-center gap-1">
                <FaHistory size={9} /> Historial ({past.length})
              </p>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {past.slice(0, 20).map((r) => (
                  <div key={r.id} className="flex items-center justify-between py-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs text-white/60 truncate">{r.petName} · {SERVICE_LABELS[r.service] || r.service} · {r.date}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {r.status === 'completed' && r.walkCheckIn && (
                        <button onClick={() => setSelectedWalk(r)}
                          className="text-[10px] flex items-center gap-1 px-2 py-0.5 rounded-full"
                          style={{ background: 'rgba(230,126,34,0.15)', color: '#E67E22' }}
                        >
                          <FaCamera size={8} /> Ver
                        </button>
                      )}
                      <span className="text-[10px]" style={{ color: r.status === 'completed' ? '#22c55e' : '#ef4444' }}>
                        {r.status === 'completed' ? '✓' : '✗'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <AnimatePresence>
        {selectedWalk && selectedWalk.walkCheckIn && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}
            onClick={() => setSelectedWalk(null)}
          >
            <div
              className="rounded-2xl overflow-hidden w-full max-w-sm max-h-[80vh] overflow-y-auto"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b sticky top-0 z-10"
                style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}
              >
                <span className="text-sm font-bold">🐾 {selectedWalk.petName}</span>
                <button onClick={() => setSelectedWalk(null)}
                  className="w-7 h-7 rounded-full flex items-center justify-center"
                  style={{ background: 'var(--glass-bg)', color: 'var(--text-secondary)' }}
                >
                  <FaTimes size={12} />
                </button>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <p className="text-xs font-medium mb-2 flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                    <FaCamera size={11} /> Inicio del paseo
                  </p>
                  <img src={selectedWalk.walkCheckIn.photo} alt="Check-in"
                    className="w-full h-48 object-cover rounded-xl" />
                  <p className="text-[10px] mt-1.5 flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                    <FaMapMarkerAlt size={9} />
                    {selectedWalk.walkCheckIn.lat.toFixed(6)}, {selectedWalk.walkCheckIn.lng.toFixed(6)}
                  </p>
                </div>
                {selectedWalk.walkCheckOut && (
                  <div>
                    <p className="text-xs font-medium mb-2 flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                      <FaCamera size={11} /> Fin del paseo
                    </p>
                    <img src={selectedWalk.walkCheckOut.photo} alt="Check-out"
                      className="w-full h-48 object-cover rounded-xl" />
                    <p className="text-[10px] mt-1.5 flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                      <FaMapMarkerAlt size={9} />
                      {selectedWalk.walkCheckOut.lat.toFixed(6)}, {selectedWalk.walkCheckOut.lng.toFixed(6)}
                    </p>
                  </div>
                )}
                {selectedWalk.walkNotes && (
                  <div>
                    <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Notas</p>
                    <p className="text-sm p-3 rounded-xl" style={{ background: 'var(--glass-bg)', color: 'var(--text-primary)' }}>
                      {selectedWalk.walkNotes}
                    </p>
                  </div>
                )}
                <div className="text-center text-[10px]" style={{ color: 'var(--text-muted)' }}>
                  {SERVICE_LABELS[selectedWalk.service] || selectedWalk.service} · {selectedWalk.date} · {selectedWalk.time}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
