'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { collection, query, where, getDocs, updateDoc, doc, getDoc } from 'firebase/firestore'
import { db, auth } from '@/firebase/config'
import { FaDog, FaTimes, FaSpinner, FaCalendarAlt, FaHistory, FaUser, FaSignOutAlt, FaPaw, FaTrash } from 'react-icons/fa'

interface Reservation {
  id: string
  name: string
  petName: string
  service: string
  date: string
  time: string
  status: string
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
                {past.slice(0, 10).map((r) => (
                  <div key={r.id} className="flex items-center justify-between py-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs text-white/60 truncate">{r.petName} · {SERVICE_LABELS[r.service] || r.service} · {r.date}</span>
                    </div>
                    <span className="text-[10px] shrink-0" style={{ color: r.status === 'completed' ? '#22c55e' : '#ef4444' }}>
                      {r.status === 'completed' ? '✓' : '✗'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
