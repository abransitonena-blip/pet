'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { auth, db } from '@/firebase/config'
import { onAuthStateChanged } from 'firebase/auth'
import { motion } from 'framer-motion'
import {
  FaCalendarAlt, FaDog, FaHistory, FaPaw, FaGift,
  FaArrowRight, FaMapMarkerAlt, FaClock, FaCheckCircle, FaExclamationTriangle,
} from 'react-icons/fa'
import type { Reservation } from '@/types'

interface UserProfile {
  name: string
  phone: string
  email: string
}

export default function DashboardPage() {
  const router = useRouter()
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let unsubRes: (() => void) | undefined

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (unsubRes) { unsubRes(); unsubRes = undefined }
      if (!user) { router.push('/login'); return }

      const profileSnap = await import('firebase/firestore').then(({ getDoc, doc }) =>
        getDoc(doc(db, 'clients', user.uid))
      )
      if (profileSnap.exists()) {
        setProfile(profileSnap.data() as UserProfile)
      }

      const q = query(collection(db, 'reservations'), where('uid', '==', user.uid))
      unsubRes = onSnapshot(q, (snap) => {
        const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Reservation))
        docs.sort((a, b) => {
          const ca = a.createdAt as string | { seconds?: number } | undefined
          const cb = b.createdAt as string | { seconds?: number } | undefined
          const ta = typeof ca === 'string' ? new Date(ca).getTime() : ca?.seconds ? ca.seconds * 1000 : 0
          const tb = typeof cb === 'string' ? new Date(cb).getTime() : cb?.seconds ? cb.seconds * 1000 : 0
          return tb - ta
        })
        setReservations(docs)
        setLoading(false)
      }, () => setLoading(false))
    })
    return () => { unsubRes?.(); unsubAuth() }
  }, [router])

  const upcoming = reservations.filter((r) => r.status === 'pending' || r.status === 'confirmed')
  const completed = reservations.filter((r) => r.status === 'completed')
  const nextWalk = upcoming[0]

  const greeting = (() => {
    const h = new Date().getHours()
    if (h < 12) return 'Buenos días'
    if (h < 19) return 'Buenas tardes'
    return 'Buenas noches'
  })()

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-32 rounded-2xl" />
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => <div key={i} className="skeleton h-24 rounded-2xl" />)}
        </div>
        <div className="skeleton h-48 rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Welcome Hero */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl p-6 relative overflow-hidden"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
      >
        <div className="absolute top-0 right-0 w-48 h-48 bg-brand-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative">
          <p className="text-sm mb-1" style={{ color: 'var(--text-muted)' }}>{greeting}</p>
          <h1 className="text-xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
            {profile?.name || 'Familia PET'} 🐾
          </h1>
          {nextWalk ? (
            <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'var(--glass-bg)' }}>
              <div className="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center shrink-0">
                <FaDog size={16} className="text-brand-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Tu próximo paseo</p>
                <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                  {nextWalk.service} · {nextWalk.petName}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{nextWalk.date}</p>
                <p className="text-xs font-medium" style={{ color: 'var(--brand)' }}>{nextWalk.time}</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'var(--glass-bg)' }}>
              <div className="w-10 h-10 rounded-xl bg-success-500/10 flex items-center justify-center shrink-0">
                <FaCheckCircle size={16} className="text-success-400" />
              </div>
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  Todo listo para la próxima aventura
                </p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  No tienes paseos pendientes
                </p>
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl p-4 cursor-pointer transition-all hover:scale-[1.02]"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
          onClick={() => router.push('/mi-cuenta/nueva-reserva')}
        >
          <div className="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center mb-3">
            <FaCalendarAlt size={16} className="text-brand-400" />
          </div>
          <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{upcoming.length}</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Próximos paseos</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-2xl p-4 cursor-pointer transition-all hover:scale-[1.02]"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
          onClick={() => router.push('/mi-cuenta/historial')}
        >
          <div className="w-10 h-10 rounded-xl bg-success-500/10 flex items-center justify-center mb-3">
            <FaHistory size={16} className="text-success-400" />
          </div>
          <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{completed.length}</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Paseos completados</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-2xl p-4 cursor-pointer transition-all hover:scale-[1.02]"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
          onClick={() => router.push('/mi-cuenta/lealtad')}
        >
          <div className="w-10 h-10 rounded-xl bg-pink-500/10 flex items-center justify-center mb-3">
            <FaGift size={16} className="text-pink-400" />
          </div>
          <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{completed.length * 10}</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Puntos de lealtad</p>
        </motion.div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          onClick={() => router.push('/mi-cuenta/nueva-reserva')}
          className="rounded-2xl p-4 text-left transition-all hover:scale-[1.02] hover:border-brand-500/30"
          style={{ background: 'linear-gradient(135deg, rgba(217,119,6,0.1), rgba(217,119,6,0.05))', border: '1px solid var(--border)' }}
        >
          <FaCalendarAlt size={20} className="text-brand-400 mb-2" />
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Nueva reserva</p>
          <p className="text-xs mt-1 flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
            Agendar un paseo <FaArrowRight size={8} />
          </p>
        </motion.button>

        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          onClick={() => router.push('/mi-cuenta/perros')}
          className="rounded-2xl p-4 text-left transition-all hover:scale-[1.02] hover:border-success-500/30"
          style={{ background: 'linear-gradient(135deg, rgba(5,150,105,0.1), rgba(5,150,105,0.05))', border: '1px solid var(--border)' }}
        >
          <FaPaw size={20} className="text-success-400 mb-2" />
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Mis perros</p>
          <p className="text-xs mt-1 flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
            Registrar peludo <FaArrowRight size={8} />
          </p>
        </motion.button>
      </div>

      {/* Recent Reservations */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Mis reservas</h2>
          {reservations.length > 0 && (
            <button
              onClick={() => router.push('/mi-cuenta/historial')}
              className="text-xs flex items-center gap-1 transition-colors hover:text-brand-400"
              style={{ color: 'var(--text-muted)' }}
            >
              Ver todo <FaArrowRight size={8} />
            </button>
          )}
        </div>

        {reservations.length === 0 ? (
          <div className="rounded-2xl p-8 text-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <FaCalendarAlt className="text-3xl mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
            <p className="text-sm mb-1" style={{ color: 'var(--text-primary)' }}>No tienes reservas aún</p>
            <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
              Tu primer paseo está a un clic de distancia
            </p>
            <button onClick={() => router.push('/mi-cuenta/nueva-reserva')} className="btn-primary inline-flex text-xs">
              Reservar ahora
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {reservations.slice(0, 5).map((res, i) => (
              <motion.div
                key={res.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + i * 0.05 }}
                className="rounded-xl p-3 flex items-center gap-3 transition-all hover:bg-white/[0.02]"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  res.status === 'completed' ? 'bg-success-500/10' :
                  res.status === 'pending' ? 'bg-brand-500/10' :
                  res.status === 'cancelled' ? 'bg-danger-500/10' :
                  'bg-white/5'
                }`}>
                  {res.status === 'completed' ? <FaCheckCircle size={14} className="text-success-400" /> :
                   res.status === 'cancelled' ? <FaExclamationTriangle size={14} className="text-danger-400" /> :
                   <FaDog size={14} className="text-brand-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{res.service}</p>
                  <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                    <span>{res.petName}</span>
                    <span>·</span>
                    <span>{res.date}</span>
                  </div>
                </div>
                <span className={`text-2xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
                  res.status === 'completed' ? 'bg-success-500/15 text-success-400' :
                  res.status === 'pending' ? 'bg-brand-500/15 text-brand-400' :
                  res.status === 'confirmed' ? 'bg-blue-500/15 text-blue-400' :
                  'bg-white/10 text-[var(--text-muted)]'
                }`}>
                  {res.status === 'completed' ? 'Completado' :
                   res.status === 'pending' ? 'Pendiente' :
                   res.status === 'confirmed' ? 'Confirmado' :
                   res.status === 'cancelled' ? 'Cancelado' : res.status}
                </span>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  )
}
