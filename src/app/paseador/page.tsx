'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '@/firebase/config'
import { onAuthStateChanged } from 'firebase/auth'
import { motion } from 'framer-motion'
import {
  FaDog, FaCalendarAlt, FaClock, FaCheckCircle, FaArrowRight,
  FaCamera, FaWalking, FaSpinner, FaWhatsapp,
} from 'react-icons/fa'
import WalkSessionModal from '@/components/WalkSessionModal'
import type { Reservation } from '@/types'

export default function PaseadorDashboard() {
  const router = useRouter()
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [walkerName, setWalkerName] = useState('')
  const [loading, setLoading] = useState(true)
  const [walkModal, setWalkModal] = useState<{ reservation: Reservation; mode: 'check_in' | 'check_out' } | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  useEffect(() => {
    let unsubRes: (() => void) | undefined

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (unsubRes) { unsubRes(); unsubRes = undefined }
      if (!user) { router.push('/login'); return }

      const userSnap = await import('firebase/firestore').then(({ getDoc }) =>
        getDoc(doc(db, 'users', user.uid))
      )
      const name = userSnap.exists() ? userSnap.data().name || user.displayName || '' : ''
      setWalkerName(name)

      if (!name) { setLoading(false); return }

      const q = query(collection(db, 'reservations'), where('assignedWalker', '==', name))
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

  const today = new Date().toISOString().split('T')[0]
  const todayWalks = reservations.filter((r) => r.date === today)
  const pending = todayWalks.filter((r) => r.status === 'pending' || r.status === 'en_camino')
  const active = todayWalks.filter((r) => r.status === 'paseando')
  const completedToday = todayWalks.filter((r) => r.status === 'completed')
  const totalCompleted = reservations.filter((r) => r.status === 'completed').length

  const handleStatusUpdate = async (id: string, status: string) => {
    setUpdatingId(id)
    try {
      await updateDoc(doc(db, 'reservations', id), { status })
    } catch (e) {
      console.error('Error updating status:', e)
    }
    setUpdatingId(null)
  }

  const openWhatsApp = (phone: string) => {
    window.open(`https://wa.me/52${phone.replace(/\D/g, '')}?text=Hola, soy tu paseador de PET Ap 🐾`, '_blank')
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-28 rounded-2xl" />
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => <div key={i} className="skeleton h-20 rounded-xl" />)}
        </div>
        <div className="skeleton h-40 rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl p-6 relative overflow-hidden"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
      >
        <div className="absolute top-0 right-0 w-48 h-48 bg-success-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative">
          <p className="text-sm mb-1" style={{ color: 'var(--text-muted)' }}>Bienvenido</p>
          <h1 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
            {walkerName} 🦮
          </h1>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {todayWalks.length === 0
              ? 'No tienes paseos asignados hoy'
              : `${todayWalks.length} paseo${todayWalks.length !== 1 ? 's' : ''} hoy · ${completedToday.length} completado${completedToday.length !== 1 ? 's' : ''}`
            }
          </p>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl p-4"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
        >
          <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{pending.length}</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Pendientes</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-2xl p-4"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
        >
          <p className="text-2xl font-bold text-success-400">{active.length + completedToday.length}</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>En progreso</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-2xl p-4"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
        >
          <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{totalCompleted}</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Total completados</p>
        </motion.div>
      </div>

      {/* Active Walks */}
      {active.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <span className="w-2 h-2 rounded-full bg-success-400 animate-pulse" />
            En paseo ahora
          </h2>
          <div className="space-y-2">
            {active.map((res) => (
              <div
                key={res.id}
                className="rounded-xl p-4"
                style={{ background: 'linear-gradient(135deg, rgba(5,150,105,0.1), rgba(5,150,105,0.05))', border: '1px solid rgba(5,150,105,0.2)' }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-success-500/20 flex items-center justify-center">
                      <FaWalking size={16} className="text-success-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{res.petName}</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{res.service} · {res.time}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setWalkModal({ reservation: res, mode: 'check_out' })}
                    className="text-xs px-3 py-1.5 rounded-lg bg-white/10 font-medium transition-all hover:bg-white/20"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    Terminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Today's Walks */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
          Paseos de hoy
        </h2>
        {todayWalks.length === 0 ? (
          <div className="rounded-2xl p-8 text-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <FaCalendarAlt className="text-3xl mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
            <p className="text-sm mb-1" style={{ color: 'var(--text-primary)' }}>Sin paseos hoy</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Disfruta tu día libre</p>
          </div>
        ) : (
          <div className="space-y-2">
            {todayWalks.map((res, i) => (
              <motion.div
                key={res.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.35 + i * 0.05 }}
                className="rounded-xl p-4"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      res.status === 'completed' ? 'bg-success-500/10' :
                      res.status === 'paseando' ? 'bg-success-500/20' :
                      res.status === 'en_camino' ? 'bg-blue-500/10' :
                      'bg-brand-500/10'
                    }`}>
                      {res.status === 'completed' ? <FaCheckCircle size={14} className="text-success-400" /> :
                       res.status === 'paseando' ? <FaWalking size={14} className="text-success-400" /> :
                       <FaDog size={14} className="text-brand-400" />}
                    </div>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{res.petName}</p>
                      <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                        <span>{res.service}</span>
                        <span>·</span>
                        <span className="flex items-center gap-1"><FaClock size={9} /> {res.time}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {res.status === 'pending' && (
                      <button
                        onClick={() => handleStatusUpdate(res.id, 'en_camino')}
                        disabled={updatingId === res.id}
                        className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-blue-500/10 text-blue-400"
                        title="En camino"
                      >
                        {updatingId === res.id ? <FaSpinner className="animate-spin" size={12} /> : <FaArrowRight size={12} />}
                      </button>
                    )}
                    {res.status === 'en_camino' && (
                      <button
                        onClick={() => setWalkModal({ reservation: res, mode: 'check_in' })}
                        className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-brand-500/10 text-brand-400"
                        title="Iniciar paseo"
                      >
                        <FaCamera size={12} />
                      </button>
                    )}
                    {res.phone && (
                      <button
                        onClick={() => openWhatsApp(res.phone)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-success-500/10 text-success-400"
                        title="WhatsApp"
                      >
                        <FaWhatsapp size={13} />
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>

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
