'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { auth, db } from '@/firebase/config'
import { onAuthStateChanged } from 'firebase/auth'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import {
  FaHistory, FaDog, FaCheckCircle, FaCalendarAlt, FaClock, FaArrowLeft,
  FaChevronDown, FaMapMarkerAlt, FaStickyNote, FaCamera,
} from 'react-icons/fa'
import type { Reservation } from '@/types'

export default function HistorialPage() {
  const router = useRouter()
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'completed' | 'cancelled'>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    let unsubRes: (() => void) | undefined

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (unsubRes) { unsubRes(); unsubRes = undefined }
      if (!user) { router.push('/login'); return }

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

  const filtered = filter === 'all' ? reservations : reservations.filter((r) => r.status === filter)
  const completedCount = reservations.filter((r) => r.status === 'completed').length

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="skeleton h-10 w-48 rounded-xl" />
        <div className="skeleton h-8 rounded-xl" />
        {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-20 rounded-xl" />)}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/mi-cuenta')}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-white/5"
            style={{ color: 'var(--text-muted)' }}
          >
            <FaArrowLeft size={14} />
          </button>
          <div>
            <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Mi historial</h1>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {completedCount} paseo{completedCount !== 1 ? 's' : ''} completado{completedCount !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {([
          { value: 'all' as const, label: 'Todos', count: reservations.length },
          { value: 'completed' as const, label: 'Completados', count: reservations.filter((r) => r.status === 'completed').length },
          { value: 'cancelled' as const, label: 'Cancelados', count: reservations.filter((r) => r.status === 'cancelled').length },
        ]).map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all"
            style={{
              background: filter === f.value ? 'var(--color-primary-light)' : 'transparent',
              color: filter === f.value ? 'var(--color-primary)' : 'var(--text-muted)',
              border: filter === f.value ? '1px solid var(--color-primary)' : '1px solid transparent',
            }}
          >
            {f.label} ({f.count})
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl p-8 text-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <FaHistory className="text-3xl mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm mb-1" style={{ color: 'var(--text-primary)' }}>
            {filter === 'all' ? 'No hay reservas en tu historial' : `No hay reservas ${filter === 'completed' ? 'completadas' : 'canceladas'}`}
          </p>
          <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
            Tu historial se actualizará automáticamente
          </p>
          <button onClick={() => router.push('/mi-cuenta/nueva-reserva')} className="btn-primary text-xs inline-flex">
            Reservar un paseo
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((res, i) => {
            const hasWalkData = !!(res.walkCheckIn || res.walkCheckOut)
            const isExpanded = expandedId === res.id
            return (
              <motion.div
                key={res.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="rounded-xl overflow-hidden"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
              >
                <div
                  className="p-4 flex items-start gap-3 transition-all hover:bg-white/[0.02]"
                  onClick={() => hasWalkData && setExpandedId(isExpanded ? null : res.id)}
                  style={{ cursor: hasWalkData ? 'pointer' : undefined }}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    res.status === 'completed' ? 'bg-success-500/10' :
                    res.status === 'cancelled' ? 'bg-danger-500/10' :
                    'bg-brand-500/10'
                  }`}>
                    {res.status === 'completed' ? <FaCheckCircle size={14} className="text-success-400" /> :
                     res.status === 'cancelled' ? <span className="text-danger-400 text-sm">✕</span> :
                     <FaDog size={14} className="text-brand-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{res.service}</p>
                      <div className="flex items-center gap-2 shrink-0">
                        {hasWalkData && (
                          <FaCamera size={10} className="text-success-400" />
                        )}
                        <span className={`text-2xs px-2 py-0.5 rounded-full font-medium ${
                          res.status === 'completed' ? 'bg-success-500/15 text-success-400' :
                          res.status === 'cancelled' ? 'bg-danger-500/15 text-danger-400' :
                          res.status === 'pending' ? 'bg-brand-500/15 text-brand-400' :
                          'bg-white/10 text-[var(--text-muted)]'
                        }`}>
                          {res.status === 'completed' ? 'Completado' :
                           res.status === 'cancelled' ? 'Cancelado' :
                           res.status === 'pending' ? 'Pendiente' :
                           res.status === 'confirmed' ? 'Confirmado' : res.status}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                      <span className="flex items-center gap-1"><FaDog size={10} /> {res.petName}</span>
                      <span className="flex items-center gap-1"><FaCalendarAlt size={10} /> {res.date}</span>
                      {res.time && <span className="flex items-center gap-1"><FaClock size={10} /> {res.time}</span>}
                    </div>
                    {hasWalkData && (
                      <div className="flex items-center gap-1 mt-1.5 text-2xs" style={{ color: 'var(--text-muted)' }}>
                        <FaChevronDown
                          size={8}
                          className="transition-transform"
                          style={{ transform: isExpanded ? 'rotate(180deg)' : undefined }}
                        />
                        {isExpanded ? 'Ocultar detalles del paseo' : 'Ver detalles del paseo'}
                      </div>
                    )}
                  </div>
                </div>

                {/* Walk Log Details */}
                <AnimatePresence>
                  {isExpanded && hasWalkData && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 space-y-3" style={{ borderTop: '1px solid var(--border)' }}>
                        {/* Check-in */}
                        {res.walkCheckIn && (
                          <div className="pt-3">
                            <p className="text-2xs font-semibold mb-2 flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
                              <span className="w-2 h-2 rounded-full bg-success-400" />
                              Inicio del paseo
                            </p>
                            {res.walkCheckIn.photo && (
                              <div className="relative rounded-xl overflow-hidden mb-2">
                                <Image
                                  src={res.walkCheckIn.photo}
                                  alt="Check-in"
                                  width={400}
                                  height={160}
                                  unoptimized
                                  className="w-full h-40 object-cover"
                                />
                              </div>
                            )}
                            <div className="flex items-center gap-3 text-2xs" style={{ color: 'var(--text-muted)' }}>
                              <span className="flex items-center gap-1">
                                <FaMapMarkerAlt size={9} className="text-success-400" />
                                {res.walkCheckIn.lat.toFixed(4)}, {res.walkCheckIn.lng.toFixed(4)}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Check-out */}
                        {res.walkCheckOut && (
                          <div>
                            <p className="text-2xs font-semibold mb-2 flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
                              <span className="w-2 h-2 rounded-full bg-brand-400" />
                              Fin del paseo
                            </p>
                            {res.walkCheckOut.photo && (
                              <div className="relative rounded-xl overflow-hidden mb-2">
                                <Image
                                  src={res.walkCheckOut.photo}
                                  alt="Check-out"
                                  width={400}
                                  height={160}
                                  unoptimized
                                  className="w-full h-40 object-cover"
                                />
                              </div>
                            )}
                            <div className="flex items-center gap-3 text-2xs" style={{ color: 'var(--text-muted)' }}>
                              <span className="flex items-center gap-1">
                                <FaMapMarkerAlt size={9} className="text-brand-400" />
                                {res.walkCheckOut.lat.toFixed(4)}, {res.walkCheckOut.lng.toFixed(4)}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Walk Notes */}
                        {res.walkNotes && (
                          <div className="flex items-start gap-2 p-2.5 rounded-lg text-xs" style={{ background: 'var(--glass-bg)', border: '1px solid var(--border)' }}>
                            <FaStickyNote size={10} className="text-pink-400 mt-0.5 shrink-0" />
                            <span style={{ color: 'var(--text-secondary)' }}>{res.walkNotes}</span>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
