'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore'
import { db } from '@/firebase/config'
import { FaPhone, FaSpinner, FaCheckCircle, FaTimes, FaDog, FaArrowLeft } from 'react-icons/fa'
import Link from 'next/link'

interface Reservation {
  id: string
  name: string
  petName: string
  service: string
  date: string
  time: string
  status: string
}

export default function CancelarPage() {
  const [phone, setPhone] = useState('')
  const [reservations, setReservations] = useState<Reservation[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [cancelling, setCancelling] = useState<string | null>(null)
  const [cancelled, setCancelled] = useState<string | null>(null)

  const search = async () => {
    if (!phone.trim()) return
    setLoading(true)
    setError('')
    setReservations(null)
    try {
      const q = query(
        collection(db, 'reservations'),
        where('phone', '==', phone.trim()),
        where('status', 'in', ['pending', 'en_camino', 'paseando'])
      )
      const snap = await getDocs(q)
      if (snap.empty) {
        setError('No encontramos reservas activas con ese número')
      } else {
        setReservations(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Reservation)))
      }
    } catch {
      setError('Error al buscar. Intenta de nuevo.')
    }
    setLoading(false)
  }

  const cancelReservation = async (id: string) => {
    setCancelling(id)
    await updateDoc(doc(db, 'reservations', id), { status: 'cancelled' })
    setCancelled(id)
    setCancelling(null)
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg-primary)' }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <Link href="/" className="inline-flex items-center gap-1 text-xs text-white/30 hover:text-white/50 mb-6 transition-all">
          <FaArrowLeft size={10} /> Volver al inicio
        </Link>

        <div className="glass-card p-6 sm:p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-red-500/20 flex items-center justify-center mx-auto mb-4">
            <FaTimes className="text-red-400" size={22} />
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Cancelar reserva</h1>
          <p className="text-sm text-white/50 mb-6">
            Ingresa tu WhatsApp para ver tus reservas activas
          </p>

          <div className="flex gap-2 mb-4">
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && search()}
              placeholder="Ej: 5523053772"
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-primary placeholder:text-white/20"
            />
            <button
              onClick={search}
              disabled={loading || !phone.trim()}
              className="px-4 py-2.5 rounded-lg bg-primary/20 text-primary hover:bg-primary/30 transition-all disabled:opacity-30 flex items-center gap-2"
            >
              {loading ? <FaSpinner className="animate-spin" size={14} /> : <FaPhone size={14} />}
            </button>
          </div>

          {error && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-red-400 text-xs mb-4"
            >
              {error}
            </motion.p>
          )}

          {reservations && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-3 mt-2"
            >
              <p className="text-xs text-white/40 text-left">
                {reservations.length} reserva{reservations.length !== 1 ? 's' : ''} activa{reservations.length !== 1 ? 's' : ''}
              </p>
              {reservations.map((r) => (
                <div
                  key={r.id}
                  className="glass p-4 rounded-xl text-left"
                >
                  {cancelled === r.id ? (
                    <div className="text-center py-2">
                      <FaCheckCircle className="text-green-400 mx-auto mb-1" size={20} />
                      <p className="text-sm text-green-400 font-medium">Reserva cancelada</p>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 mb-2">
                        <FaDog className="text-primary" size={12} />
                        <span className="text-sm font-semibold text-white">{r.petName}</span>
                        <span className={`text-2xs px-2 py-0.5 rounded-full ${
                          r.status === 'en_camino' ? 'bg-blue-500/20 text-blue-400' : r.status === 'paseando' ? 'bg-purple-500/20 text-purple-400' : 'bg-secondary/20 text-secondary'
                        }`}>
                          {r.status === 'en_camino' ? 'En camino' : r.status === 'paseando' ? 'Paseando' : 'Pendiente'}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-white/50">
                        <span>📋 {r.service}</span>
                        <span>📅 {r.date}</span>
                        <span>⏰ {r.time}</span>
                      </div>
                      <button
                        onClick={() => cancelReservation(r.id)}
                        disabled={cancelling === r.id}
                        className="mt-3 w-full py-2 rounded-lg text-xs font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all disabled:opacity-30 flex items-center justify-center gap-1"
                      >
                        {cancelling === r.id ? <FaSpinner className="animate-spin" size={12} /> : <FaTimes size={10} />}
                        Cancelar reserva
                      </button>
                    </>
                  )}
                </div>
              ))}
            </motion.div>
          )}

          {reservations && reservations.length === 0 && (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No hay reservas activas</p>
          )}
        </div>
      </motion.div>
    </main>
  )
}
