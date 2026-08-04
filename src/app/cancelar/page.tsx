'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore'
import { db } from '@/firebase/config'
import { Phone, Loader2, CheckCircle2, X, Dog, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import type { Reservation } from '@/types'

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
        where('status', 'in', ['pending', 'on_the_way', 'in_progress'])
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
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg-primary)' }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <Link href="/" className="inline-flex items-center gap-1 text-xs text-muted hover:text-ink mb-6 transition-all">
          <ArrowLeft size={10} /> Volver al inicio
        </Link>

        <div className="glass-card p-6 sm:p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-red-500/20 flex items-center justify-center mx-auto mb-4">
            <X className="text-red-400" size={22} />
          </div>
          <h1 className="text-xl font-bold text-ink mb-2">Cancelar reserva</h1>
          <p className="text-sm text-muted mb-6">
            Ingresa tu WhatsApp para ver tus reservas activas
          </p>

          <div className="flex gap-2 mb-4">
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && search()}
              aria-label="Número de WhatsApp" placeholder="Ej: 55 2305 3772"
              className="flex-1 bg-white border border-ink/15 rounded-lg px-3 py-2.5 text-ink text-sm focus:outline-none focus:border-primary placeholder:text-muted"
            />
            <button
              onClick={search}
              disabled={loading || !phone.trim()}
              className="px-4 py-2.5 rounded-lg bg-primary/20 text-primary-hover hover:bg-primary/30 transition-all disabled:opacity-30 flex items-center gap-2"
            >
              {loading ? <Loader2 className="animate-spin" size={14} /> : <Phone size={14} />}
            </button>
          </div>

          {error && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-red-700 text-xs mb-4" role="alert"
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
              <p className="text-xs text-muted text-left">
                {reservations.length} reserva{reservations.length !== 1 ? 's' : ''} activa{reservations.length !== 1 ? 's' : ''}
              </p>
              {reservations.map((r) => (
                <div
                  key={r.id}
                  className="glass p-4 rounded-xl text-left"
                >
                  {cancelled === r.id ? (
                    <div className="text-center py-2">
                      <CheckCircle2 className="text-green-600 mx-auto mb-1" size={20} />
                      <p className="text-sm text-green-700 font-medium">Reserva cancelada</p>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 mb-2">
                        <Dog className="text-primary" size={12} />
                        <span className="text-sm font-semibold text-ink">{r.petName}</span>
                        <span className={`text-2xs px-2 py-0.5 rounded-full ${
                          r.status === 'on_the_way' ? 'bg-blue-500/15 text-blue-700' : r.status === 'in_progress' ? 'bg-purple-500/15 text-purple-700' : 'bg-ink/5 text-muted'
                        }`}>
                          {r.status === 'on_the_way' ? 'En camino' : r.status === 'in_progress' ? 'Paseando' : 'Pendiente'}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
                        <span>📋 {r.service}</span>
                        <span>📅 {r.date}</span>
                        <span>⏰ {r.arrivalWindowStart ? `${r.arrivalWindowStart}${r.arrivalWindowEnd ? `-${r.arrivalWindowEnd}` : ''}` : r.time}</span>
                      </div>
                      <button
                        onClick={() => cancelReservation(r.id)}
                        disabled={cancelling === r.id}
                        className="mt-3 w-full py-2 rounded-lg text-xs font-medium bg-red-500/15 text-red-700 hover:bg-red-500/25 transition-all disabled:opacity-30 flex items-center justify-center gap-1"
                      >
                        {cancelling === r.id ? <Loader2 className="animate-spin" size={12} /> : <X size={10} />}
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
    </div>
  )
}
