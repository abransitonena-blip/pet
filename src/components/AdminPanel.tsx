'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { db } from '@/firebase/config'
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  deleteDoc,
  updateDoc,
} from 'firebase/firestore'
import {
  FaTimes,
  FaTrash,
  FaCheck,
  FaSpinner,
  FaDog,
  FaChartBar,
  FaCalendarAlt,
  FaStar,
  FaBell,
} from 'react-icons/fa'

interface Reservation {
  id: string
  name: string
  phone: string
  petName: string
  petType: string
  service: string
  date: string
  time: string
  notes?: string
  status: string
  createdAt?: any
}

interface AdminReview {
  id: string
  name: string
  rating: number
  text: string
  date: string
  petName?: string
}

type Tab = 'reservas' | 'resenas' | 'estadisticas'

export default function AdminPanel({
  isOpen,
  onClose,
}: {
  isOpen: boolean
  onClose: () => void
}) {
  const [tab, setTab] = useState<Tab>('reservas')
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [reviews, setReviews] = useState<AdminReview[]>([])
  const [loading, setLoading] = useState(true)
  const [notificationsOn, setNotificationsOn] = useState(false)
  const prevCount = useRef(0)

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) return
    if (Notification.permission === 'granted') {
      setNotificationsOn(true)
      return
    }
    const result = await Notification.requestPermission()
    if (result === 'granted') setNotificationsOn(true)
  }

  useEffect(() => {
    if (!isOpen) return

    setLoading(true)

    const q = query(collection(db, 'reservations'), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Reservation[]
      setReservations(data)

      if (prevCount.current > 0 && data.length > prevCount.current && notificationsOn) {
        const newest = data[0]
        try {
          new Notification('🐾 Nueva reserva recibida!', {
            body: `${newest.name} agendó "${newest.service}" para ${newest.petName}`,
            icon: '/favicon.ico',
          })
        } catch {}
      }
      prevCount.current = data.length
      setLoading(false)
    })

    const q2 = query(collection(db, 'reviews'), orderBy('date', 'desc'))
    const unsub2 = onSnapshot(q2, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as AdminReview[]
      setReviews(data)
    })

    return () => {
      unsub()
      unsub2()
    }
  }, [isOpen])

  const handleDelete = async (id: string, col: 'reservations' | 'reviews') => {
    try {
      await deleteDoc(doc(db, col, id))
    } catch {}
  }

  const handleComplete = async (id: string) => {
    try {
      await updateDoc(doc(db, 'reservations', id), { status: 'completed' })
    } catch {}
  }

  const completedCount = reservations.filter((r) => r.status === 'completed').length
  const pendingCount = reservations.filter((r) => r.status === 'pending' || !r.status).length
  const avgRating = reviews.length > 0
    ? (reviews.reduce((a, r) => a + r.rating, 0) / reviews.length).toFixed(1)
    : '0'

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-dark-card border border-white/10 rounded-2xl w-full max-w-5xl max-h-[85vh] overflow-hidden shadow-2xl shadow-primary/10"
          >
            <div className="flex items-center justify-between p-6 border-b border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-amber-600 flex items-center justify-center text-white font-bold text-sm">
                  A
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Panel Admin</h2>
                  <p className="text-xs text-white/40">Gestión de Paseos Quebrada</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={requestNotificationPermission}
                  className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full transition-all ${
                    notificationsOn
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-white/5 text-white/40 hover:text-white/60'
                  }`}
                >
                  <FaBell size={12} />
                  {notificationsOn ? 'Notificaciones activas' : 'Activar notificaciones'}
                </button>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-all"
                >
                  <FaTimes />
                </button>
              </div>
            </div>

            <div className="flex border-b border-white/5">
              {[
                { id: 'reservas' as Tab, label: 'Reservas', icon: FaCalendarAlt },
                { id: 'resenas' as Tab, label: 'Reseñas', icon: FaStar },
                { id: 'estadisticas' as Tab, label: 'Estadísticas', icon: FaChartBar },
              ].map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-all relative ${
                    tab === id ? 'text-primary' : 'text-white/40 hover:text-white/60'
                  }`}
                >
                  <Icon size={14} />
                  {label}
                  {tab === id && (
                    <motion.div
                      layoutId="adminTab"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                    />
                  )}
                </button>
              ))}
            </div>

            <div className="overflow-y-auto max-h-[calc(85vh-130px)] p-6">
              {tab === 'reservas' && (
                <div className="space-y-3">
                  {loading ? (
                    <div className="flex items-center justify-center py-20">
                      <FaSpinner className="animate-spin text-primary text-2xl" />
                    </div>
                  ) : reservations.length === 0 ? (
                    <div className="text-center py-20 text-white/30">
                      <FaDog className="text-4xl mx-auto mb-3" />
                      <p>No hay reservas aún</p>
                    </div>
                  ) : (
                    reservations.map((res) => (
                      <motion.div
                        key={res.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="glass p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-white">{res.name}</span>
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full ${
                                res.status === 'completed'
                                  ? 'bg-green-500/20 text-green-400'
                                  : 'bg-secondary/20 text-secondary'
                              }`}
                            >
                              {res.status === 'completed' ? 'Completada' : 'Pendiente'}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/50">
                            <span>🐾 {res.petName}</span>
                            <span>📞 {res.phone}</span>
                            <span>📋 {res.service}</span>
                            <span>📅 {res.date}</span>
                            <span>⏰ {res.time}</span>
                          </div>
                          {res.notes && (
                            <p className="text-xs text-white/30 mt-1">📝 {res.notes}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {(!res.status || res.status === 'pending') && (
                            <button
                              onClick={() => handleComplete(res.id)}
                              className="w-8 h-8 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 flex items-center justify-center transition-all"
                            >
                              <FaCheck size={12} />
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(res.id, 'reservations')}
                            className="w-8 h-8 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 flex items-center justify-center transition-all"
                          >
                            <FaTrash size={12} />
                          </button>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              )}

              {tab === 'resenas' && (
                <div className="space-y-3">
                  {reviews.length === 0 ? (
                    <div className="text-center py-20 text-white/30">
                      <FaStar className="text-4xl mx-auto mb-3" />
                      <p>No hay reseñas aún</p>
                    </div>
                  ) : (
                    reviews.map((rev) => (
                      <motion.div
                        key={rev.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="glass p-4 rounded-xl flex items-start justify-between gap-4"
                      >
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-white">{rev.name}</span>
                            <div className="flex items-center gap-0.5">
                              {Array.from({ length: rev.rating }).map((_, i) => (
                                <FaStar key={i} className="text-secondary" size={10} />
                              ))}
                            </div>
                          </div>
                          <p className="text-sm text-white/60">{rev.text}</p>
                          {rev.petName && (
                            <p className="text-xs text-white/30 mt-1">🐾 {rev.petName}</p>
                          )}
                        </div>
                        <button
                          onClick={() => handleDelete(rev.id, 'reviews')}
                          className="w-8 h-8 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 flex items-center justify-center transition-all flex-shrink-0"
                        >
                          <FaTrash size={12} />
                        </button>
                      </motion.div>
                    ))
                  )}
                </div>
              )}

              {tab === 'estadisticas' && (
                <div className="grid sm:grid-cols-3 gap-4">
                  {[
                    { label: 'Reservas totales', value: reservations.length, icon: FaCalendarAlt, color: 'from-primary to-amber-600' },
                    { label: 'Completadas', value: completedCount, icon: FaCheck, color: 'from-green-500 to-emerald-600' },
                    { label: 'Pendientes', value: pendingCount, icon: FaSpinner, color: 'from-secondary to-orange-500' },
                    { label: 'Reseñas', value: reviews.length, icon: FaStar, color: 'from-pink-500 to-rose-600' },
                    { label: 'Calificación', value: avgRating, icon: FaStar, color: 'from-yellow-500 to-amber-600' },
                    { label: 'Perros', value: new Set(reservations.map((r) => r.petName)).size, icon: FaDog, color: 'from-cyan-500 to-blue-600' },
                  ].map((stat) => {
                    const Icon = stat.icon
                    return (
                      <motion.div
                        key={stat.label}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="glass-card p-6 text-center"
                      >
                        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center mx-auto mb-3`}>
                          <Icon className="text-white text-lg" />
                        </div>
                        <div className="text-2xl font-bold text-white">{stat.value}</div>
                        <div className="text-xs text-white/40 mt-1">{stat.label}</div>
                      </motion.div>
                    )
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
