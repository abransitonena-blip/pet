'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
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
  setDoc,
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
  FaEdit,
  FaWhatsapp,
  FaDownload,
  FaSearch,
  FaUndo,
  FaSignOutAlt,
  FaPaperPlane,
  FaImage,
  FaWalking,
} from 'react-icons/fa'
import { getServicePrice } from '@/lib/services'
import EditReservationModal from './EditReservationModal'
import CalendarView from './CalendarView'
import { getToken } from 'firebase/messaging'
import { getMessagingInstance } from '@/firebase/config'
import AdminGallery from './AdminGallery'
import type { Reservation } from '@/types'



interface AdminReview {
  id: string
  name: string
  rating: number
  text: string
  date: string
  petName?: string
}

type Tab = 'reservas' | 'calendario' | 'resenas' | 'estadisticas'

export default function AdminPanel({
  isOpen,
  onClose,
  user,
  onLogout,
}: {
  isOpen: boolean
  onClose: () => void
  user: import("firebase/auth").User | null
  onLogout?: () => void
}) {
  const [tab, setTab] = useState<Tab>('reservas')
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [reviews, setReviews] = useState<AdminReview[]>([])
  const [loading, setLoading] = useState(true)
  const [notificationsOn, setNotificationsOn] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'en_camino' | 'paseando' | 'completed'>('all')
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null)
  const [quickMsgNumber, setQuickMsgNumber] = useState('')
  const [quickMsgInput, setQuickMsgInput] = useState('')
  const [showQuickMsg, setShowQuickMsg] = useState(false)
  const [showGallery, setShowGallery] = useState(false)
  const prevCount = useRef(0)

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) return
    if (Notification.permission === 'granted') {
      setNotificationsOn(true)
      storeFcmToken()
      return
    }
    const result = await Notification.requestPermission()
    if (result === 'granted') {
      setNotificationsOn(true)
      storeFcmToken()
    }
  }

  const storeFcmToken = async () => {
    try {
      const m = getMessagingInstance()
      if (!m) return
      const token = await getToken(m, { vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY })
      if (token && user) {
        const tokensRef = doc(db, 'admin', 'tokens')
        const existing = await (await import('firebase/firestore')).getDoc(tokensRef)
        const tokens = existing.data()?.fcmTokens || []
        if (!tokens.includes(token)) {
          tokens.push(token)
          await setDoc(tokensRef, { fcmTokens: tokens })
        }
      }
    } catch {}
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
            icon: '/icons/icon-192.svg',
          })
          navigator.serviceWorker.ready.then((reg) =>
            reg.showNotification('🐾 Nueva reserva recibida!', {
              body: `${newest.name} agendó "${newest.service}" para ${newest.petName}`,
              icon: '/icons/icon-192.svg',
              badge: '/icons/icon-192.svg',
            })
          )
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

  const handleRestore = async (id: string) => {
    try {
      await updateDoc(doc(db, 'reservations', id), { status: 'pending' })
    } catch {}
  }

  const filteredReservations = useMemo(() => {
    let result = reservations
    if (statusFilter !== 'all') {
      result = result.filter((r) => r.status === statusFilter)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.petName.toLowerCase().includes(q) ||
          r.phone.includes(q) ||
          r.service.toLowerCase().includes(q)
      )
    }
    return result
  }, [reservations, statusFilter, searchQuery])

  const completedCount = reservations.filter((r) => r.status === 'completed').length
  const pendingCount = reservations.filter((r) => r.status === 'pending' || !r.status).length
  const enCaminoCount = reservations.filter((r) => r.status === 'en_camino').length
  const paseandoCount = reservations.filter((r) => r.status === 'paseando').length
  const avgRating = reviews.length > 0
    ? (reviews.reduce((a, r) => a + r.rating, 0) / reviews.length).toFixed(1)
    : '0'

  const exportCSV = () => {
    const headers = ['Nombre','Teléfono','Mascota','Servicio','Fecha','Hora','Notas','Estado','Notas Internas','Paseador']
    const rows = reservations.map((r) => [
      r.name, r.phone, r.petName, r.service, r.date, r.time,
      r.notes || '', r.status === 'completed' ? 'Completada' : 'Pendiente',
      r.internalNotes || '', r.assignedWalker || '',
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

  const exportReviewsCSV = () => {
    const headers = ['Nombre','Calificación','Reseña','Fecha','Mascota']
    const rows = reviews.map((r) => [r.name, String(r.rating), r.text, r.date, r.petName || ''])
    const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${c}"`).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `resenas-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const totalRevenue = useMemo(() => {
    return reservations
      .filter((r) => r.status === 'completed')
      .reduce((sum, r) => sum + getServicePrice(r.service), 0)
  }, [reservations])

  const pendingRevenue = useMemo(() => {
    return reservations
      .filter((r) => r.status === 'pending' || !r.status)
      .reduce((sum, r) => sum + getServicePrice(r.service), 0)
  }, [reservations])

  const serviceCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    reservations.forEach((r) => {
      counts[r.service] = (counts[r.service] || 0) + 1
    })
    return Object.entries(counts).sort((a, b) => b[1] - a[1])
  }, [reservations])

  const dailyCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    const today = new Date()
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const key = `${d.getDate()}/${d.getMonth() + 1}`
      counts[key] = 0
    }
    reservations.forEach((r) => {
      if (r.date) {
        const parts = r.date.split('-')
        if (parts.length === 3) {
          const key = `${parseInt(parts[2])}/${parseInt(parts[1])}`
          if (counts[key] !== undefined) counts[key]++
        }
      }
    })
    return Object.entries(counts)
  }, [reservations])

  const maxDailyCount = Math.max(...dailyCounts.map(([, c]) => c), 1)

  const openWhatsApp = (phone: string, name: string) => {
    const cleaned = phone.replace(/\D/g, '')
    const url = `https://wa.me/52${cleaned}?text=Hola ${encodeURIComponent(name)}, soy de Paseos Quebrada 🐾`
    window.open(url, '_blank')
  }

  const sendQuickMessage = () => {
    if (!quickMsgNumber || !quickMsgInput) return
    const cleaned = quickMsgNumber.replace(/\D/g, '')
    const url = `https://wa.me/52${cleaned}?text=${encodeURIComponent(quickMsgInput)}`
    window.open(url, '_blank')
  }

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
                  onClick={() => setShowGallery(!showGallery)}
                  className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full transition-all ${
                    showGallery ? 'bg-primary/20 text-primary' : 'bg-white/5 text-white/40 hover:text-white hover:bg-white/10'
                  }`}
                  title="Galería de fotos"
                >
                  <FaImage size={12} />
                  Fotos
                </button>
                <button
                  onClick={() => setShowQuickMsg(!showQuickMsg)}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-white/5 text-white/40 hover:text-white hover:bg-white/10 transition-all"
                  title="Enviar WhatsApp"
                >
                  <FaPaperPlane size={12} />
                  Mensaje
                </button>
                <button
                  onClick={exportCSV}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-white/5 text-white/40 hover:text-white hover:bg-white/10 transition-all"
                  title="Exportar reservas CSV"
                >
                  <FaDownload size={12} />
                  CSV
                </button>
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
                {user && (
                  <span className="text-xs text-white/30 hidden sm:block">{user.email}</span>
                )}
                {onLogout && (
                  <button
                    onClick={onLogout}
                    className="w-8 h-8 rounded-full bg-red-500/10 text-red-400 hover:bg-red-500/20 flex items-center justify-center transition-all"
                    title="Cerrar sesión"
                  >
                    <FaSignOutAlt size={12} />
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-all"
                >
                  <FaTimes />
                </button>
              </div>
            </div>

            {showGallery && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                className="border-b border-white/5 overflow-hidden p-4"
              >
                <AdminGallery />
              </motion.div>
            )}

            {showQuickMsg && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                className="border-b border-white/5 overflow-hidden"
              >
                <div className="p-4 flex items-center gap-3">
                  <input
                    type="tel"
                    placeholder="WhatsApp del cliente"
                    value={quickMsgNumber}
                    onChange={(e) => setQuickMsgNumber(e.target.value)}
                    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary placeholder:text-white/20"
                  />
                  <input
                    type="text"
                    placeholder="Mensaje..."
                    value={quickMsgInput}
                    onChange={(e) => setQuickMsgInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && sendQuickMessage()}
                    className="flex-[2] bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary placeholder:text-white/20"
                  />
                  <button
                    onClick={sendQuickMessage}
                    disabled={!quickMsgNumber || !quickMsgInput}
                    className="shrink-0 px-4 py-2 rounded-lg text-xs font-semibold bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-all disabled:opacity-30"
                  >
                    <FaPaperPlane size={12} />
                  </button>
                  <button onClick={() => setShowQuickMsg(false)} className="shrink-0 text-white/30 hover:text-white text-xs">Cerrar</button>
                </div>
              </motion.div>
            )}

            <div className="flex border-b border-white/5">
              {[
                { id: 'reservas' as Tab, label: 'Reservas', icon: FaCalendarAlt },
                { id: 'calendario' as Tab, label: 'Calendario', icon: FaDog },
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
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    <div className="relative flex-1 w-full">
                      <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" size={12} />
                      <input
                        type="text"
                        placeholder="Buscar por nombre, mascota, teléfono..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-white text-sm focus:outline-none focus:border-primary placeholder:text-white/20"
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      {(['all', 'pending', 'en_camino', 'paseando', 'completed'] as const).map((s) => (
                        <button
                          key={s}
                          onClick={() => setStatusFilter(s)}
                          className={`text-xs px-2 py-1.5 rounded-lg transition-all ${
                            statusFilter === s
                              ? s === 'completed'
                                ? 'bg-green-500/20 text-green-400'
                                : s === 'en_camino'
                                  ? 'bg-blue-500/20 text-blue-400'
                                  : s === 'paseando'
                                    ? 'bg-purple-500/20 text-purple-400'
                                    : s === 'pending'
                                      ? 'bg-secondary/20 text-secondary'
                                      : 'bg-primary/20 text-primary'
                              : 'bg-white/5 text-white/40 hover:text-white/60'
                          }`}
                        >
                          {s === 'all' ? 'Todas' : s === 'pending' ? 'Pendientes' : s === 'en_camino' ? 'En camino' : s === 'paseando' ? 'Paseando' : 'Completadas'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {loading ? (
                    <div className="flex items-center justify-center py-20">
                      <FaSpinner className="animate-spin text-primary text-2xl" />
                    </div>
                  ) : filteredReservations.length === 0 ? (
                    <div className="text-center py-20 text-white/30">
                      <FaDog className="text-4xl mx-auto mb-3" />
                      <p>{searchQuery || statusFilter !== 'all' ? 'Sin resultados' : 'No hay reservas aún'}</p>
                    </div>
                  ) : (
                    filteredReservations.map((res) => (
                      <motion.div
                        key={res.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="glass p-4 rounded-xl flex flex-col gap-3"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="font-semibold text-white">{res.name}</span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${
                  res.status === 'completed'
                    ? 'bg-green-500/20 text-green-400'
                    : res.status === 'en_camino'
                      ? 'bg-blue-500/20 text-blue-400'
                      : res.status === 'paseando'
                        ? 'bg-purple-500/20 text-purple-400'
                        : 'bg-secondary/20 text-secondary'
                }`}
              >
                {res.status === 'completed' ? 'Completada' : res.status === 'en_camino' ? 'En camino' : res.status === 'paseando' ? 'Paseando' : 'Pendiente'}
              </span>
                              {res.assignedWalker && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400">
                                  🦮 {res.assignedWalker}
                                </span>
                              )}
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
                            {res.internalNotes && (
                              <p className="text-xs text-primary/50 mt-0.5">🔒 {res.internalNotes}</p>
                            )}
                            {res.completedAt && (
                              <p className="text-[10px] text-green-500/40 mt-0.5">
                                ✓ Completada {new Date(res.completedAt?.seconds * 1000 || res.completedAt).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => openWhatsApp(res.phone, res.name)}
                              className="w-8 h-8 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 flex items-center justify-center transition-all"
                              title="WhatsApp"
                            >
                              <FaWhatsapp size={14} />
                            </button>
                            <button
                              onClick={() => setEditingReservation(res)}
                              className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 flex items-center justify-center transition-all"
                              title="Editar"
                            >
                              <FaEdit size={12} />
                            </button>
                            {(!res.status || res.status === 'pending') && (
                              <button
                                onClick={() => updateDoc(doc(db, 'reservations', res.id), { status: 'en_camino' })}
                                className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 flex items-center justify-center transition-all"
                                title="En camino"
                              >
                                <FaDog size={12} />
                              </button>
                            )}
                            {res.status === 'en_camino' && (
                              <button
                                onClick={() => updateDoc(doc(db, 'reservations', res.id), { status: 'paseando' })}
                                className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 flex items-center justify-center transition-all"
                                title="Paseando"
                              >
                                <FaWalking size={12} />
                              </button>
                            )}
                            {res.status === 'paseando' && (
                              <button
                                onClick={() => handleComplete(res.id)}
                                className="w-8 h-8 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 flex items-center justify-center transition-all"
                                title="Completar"
                              >
                                <FaCheck size={12} />
                              </button>
                            )}
                            {(res.status === 'completed' || res.status === 'en_camino' || res.status === 'paseando') && (
                              <button
                                onClick={() => handleRestore(res.id)}
                                className="w-8 h-8 rounded-lg bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 flex items-center justify-center transition-all"
                                title="Restaurar como pendiente"
                              >
                                <FaUndo size={12} />
                              </button>
                            )}
                            <button
                              onClick={() => handleDelete(res.id, 'reservations')}
                              className="w-8 h-8 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 flex items-center justify-center transition-all"
                              title="Eliminar"
                            >
                              <FaTrash size={12} />
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              )}

              {tab === 'calendario' && (
                <CalendarView reservations={reservations} />
              )}

              {tab === 'resenas' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-end">
                    <button
                      onClick={exportReviewsCSV}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-white/5 text-white/40 hover:text-white hover:bg-white/10 transition-all"
                    >
                      <FaDownload size={12} />
                      Exportar CSV
                    </button>
                  </div>
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
                <div className="space-y-6">
                  <div className="grid sm:grid-cols-3 gap-4">
                    {[
                      { label: 'Reservas totales', value: reservations.length, icon: FaCalendarAlt, color: 'from-primary to-amber-600' },
                      { label: 'Completadas', value: completedCount, icon: FaCheck, color: 'from-green-500 to-emerald-600' },
                      { label: 'Pendientes', value: pendingCount, icon: FaSpinner, color: 'from-secondary to-orange-500' },
                      { label: 'En camino', value: enCaminoCount, icon: FaDog, color: 'from-blue-500 to-indigo-600' },
                      { label: 'Paseando', value: paseandoCount, icon: FaWalking, color: 'from-purple-500 to-violet-600' },
                      { label: 'Reseñas', value: reviews.length, icon: FaStar, color: 'from-pink-500 to-rose-600' },
                      { label: 'Calificación', value: avgRating, icon: FaStar, color: 'from-yellow-500 to-amber-600' },
                      { label: 'Perros', value: new Set(reservations.map((r) => r.petName)).size, icon: FaDog, color: 'from-cyan-500 to-blue-600' },
                      { label: '💰 Ingresos cobrados', value: `$${totalRevenue.toLocaleString()}`, icon: FaChartBar, color: 'from-emerald-500 to-green-600' },
                      { label: '⏳ Por cobrar', value: `$${pendingRevenue.toLocaleString()}`, icon: FaChartBar, color: 'from-amber-500 to-orange-600' },
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

                  <div className="grid sm:grid-cols-2 gap-6">
                    <div className="glass-card p-5">
                      <h4 className="text-sm font-semibold text-white mb-4">📊 Reservas últimos 7 días</h4>
                      <div className="flex items-end gap-2 h-32">
                        {dailyCounts.map(([day, count]) => (
                          <div key={day} className="flex-1 flex flex-col items-center gap-1">
                            <span className="text-xs text-white/40">{count}</span>
                            <motion.div
                              initial={{ height: 0 }}
                              animate={{ height: `${(count / maxDailyCount) * 100}%` }}
                              className="w-full rounded-t-lg bg-gradient-to-t from-primary to-amber-500"
                              style={{ minHeight: count > 0 ? 4 : 0 }}
                            />
                            <span className="text-[10px] text-white/30">{day}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="glass-card p-5">
                      <h4 className="text-sm font-semibold text-white mb-4">🏆 Servicios populares</h4>
                      <div className="space-y-2">
                        {serviceCounts.slice(0, 5).map(([service, count]) => {
                          const maxCount = serviceCounts[0]?.[1] || 1
                          return (
                            <div key={service}>
                              <div className="flex items-center justify-between text-xs mb-1">
                                <span className="text-white/60 truncate">{service}</span>
                                <span className="text-white/40">{count}</span>
                              </div>
                              <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${(count / maxCount) * 100}%` }}
                                  className="h-full rounded-full bg-gradient-to-r from-primary to-amber-500"
                                />
                              </div>
                            </div>
                          )
                        })}
                        {serviceCounts.length === 0 && (
                          <p className="text-center text-white/20 text-sm py-8">Sin datos</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}

      <EditReservationModal
        isOpen={!!editingReservation}
        onClose={() => setEditingReservation(null)}
        reservation={editingReservation}
        key={editingReservation?.id || 'none'}
      />
    </AnimatePresence>
  )
}
