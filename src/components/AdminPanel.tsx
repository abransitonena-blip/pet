'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
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
  serverTimestamp,
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
  FaTag,
  FaHome,
  FaDollarSign,
  FaCog,
} from 'react-icons/fa'
import { getServicePrice } from '@/lib/services'
import { usePrices } from '@/context/PricesContext'
import EditReservationModal from './EditReservationModal'
import CalendarView from './CalendarView'
import { getMessagingInstance } from '@/firebase/config'
import AdminGallery from './AdminGallery'
import AdminCoupons from './AdminCoupons'
import AdminBanner from './AdminBanner'
import AdminPrices from './AdminPrices'
import AdminConfig from './AdminConfig'
import { logChange } from '@/lib/audit'
import type { Reservation } from '@/types'



interface AdminReview {
  id: string
  name: string
  rating: number
  text: string
  date: string
  petName?: string
}

type Tab = 'reservas' | 'calendario' | 'resenas' | 'estadisticas' | 'cupones' | 'resumen' | 'precios' | 'config'

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
  const [tab, setTab] = useState<Tab>('resumen')
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
  const [showMobileSidebar, setShowMobileSidebar] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<{id: string; col: "reservations" | "reviews"} | null>(null)
  const [historyPhone, setHistoryPhone] = useState('')
  const [historyReservations, setHistoryReservations] = useState<Reservation[]>([])
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const prevCount = useRef(0)
  const IDLE_TIMEOUT = 30 * 60 * 1000
  const lastActivity = useRef(Date.now())
  const tabsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const resetTimer = () => { lastActivity.current = Date.now() }
    window.addEventListener("mousemove", resetTimer, { passive: true })
    window.addEventListener("keydown", resetTimer, { passive: true })
    window.addEventListener("touchstart", resetTimer, { passive: true })
    window.addEventListener("scroll", resetTimer, { passive: true })
    return () => {
      window.removeEventListener("mousemove", resetTimer)
      window.removeEventListener("keydown", resetTimer)
      window.removeEventListener("touchstart", resetTimer)
      window.removeEventListener("scroll", resetTimer)
    }
  }, [])

  useEffect(() => {
    if (!isOpen) return
    const interval = setInterval(() => {
      if (Date.now() - lastActivity.current > IDLE_TIMEOUT && onLogout) {
        onLogout()
      }
    }, 60000)
    return () => clearInterval(interval)
  }, [isOpen, onLogout])
  const { prices } = usePrices()

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
      const m = await getMessagingInstance()
      if (!m) return
      const { getToken } = await import('firebase/messaging')
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
          const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.connect(gain)
          gain.connect(ctx.destination)
          osc.frequency.value = 880
          osc.type = 'sine'
          gain.gain.setValueAtTime(0, ctx.currentTime)
          gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.02)
          gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4)
          osc.start(ctx.currentTime)
          osc.stop(ctx.currentTime + 0.4)
          setTimeout(() => {
            const osc2 = ctx.createOscillator()
            const gain2 = ctx.createGain()
            osc2.connect(gain2)
            gain2.connect(ctx.destination)
            osc2.frequency.value = 1108.73
            osc2.type = 'sine'
            gain2.gain.setValueAtTime(0, ctx.currentTime + 0.45)
            gain2.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.47)
            gain2.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.7)
            osc2.start(ctx.currentTime + 0.45)
            osc2.stop(ctx.currentTime + 0.7)
          }, 400)
        } catch {}

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
  }, [isOpen, notificationsOn])

  const handleDelete = async (id: string, col: "reservations" | "reviews") => {
    setConfirmDelete({ id, col })
  }

  
  const executeDelete = async () => {
    if (!confirmDelete) return
    try {
      logChange("delete", confirmDelete.id, { col: confirmDelete.col })
      await deleteDoc(doc(db, confirmDelete.col, confirmDelete.id))
      setConfirmDelete(null)
    } catch {}
  }
  const handleComplete = async (id: string) => {
    try {
      await updateDoc(doc(db, 'reservations', id), { status: 'completed', completedAt: serverTimestamp() })
    } catch {}
  }

  const handlePaymentToggle = async (id: string, current: "pending" | "paid" | undefined) => {
    const newStatus = current === "paid" ? "pending" : "paid"
    setReservations((prev) =>
      prev.map((r) => (r.id === id ? { ...r, paymentStatus: newStatus } : r))
    )
    try {
      logChange("payment_toggle", id, { from: current, to: newStatus })
      await updateDoc(doc(db, "reservations", id), { paymentStatus: newStatus })
    } catch {
      setReservations((prev) =>
        prev.map((r) => (r.id === id ? { ...r, paymentStatus: current } : r))
      )
    }
  }

  const viewHistory = async (phone: string) => {
    setHistoryPhone(phone)
    const { query, where, getDocs } = await import('firebase/firestore')
    const q = query(collection(db, 'reservations'), where('phone', '==', phone), orderBy('createdAt', 'desc'))
    const snap = await getDocs(q)
    setHistoryReservations(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Reservation)))
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

  const exportJSON = () => {
    const data = {
      exportedAt: new Date().toISOString(),
      totalReservations: reservations.length,
      totalReviews: reviews.length,
      reservations,
      reviews,
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "respaldo-paseos-quebrada-" + new Date().toISOString().split("T")[0] + ".json"
    a.click()
    URL.revokeObjectURL(url)
  }
  const filteredByDate = useMemo(() => {
    if (!dateFrom && !dateTo) return reservations
    return reservations.filter((r) => {
      if (dateFrom && r.date < dateFrom) return false
      if (dateTo && r.date > dateTo) return false
      return true
    })
  }, [reservations, dateFrom, dateTo])

  const getEffectivePrice = useCallback((serviceName: string) => {
    return prices[serviceName] ?? getServicePrice(serviceName)
  }, [prices])

  const totalRevenue = useMemo(() => {
    return filteredByDate
      .filter((r) => r.status === 'completed')
      .reduce((sum, r) => sum + getEffectivePrice(r.service), 0)
  }, [filteredByDate, getEffectivePrice])

  const pendingRevenue = useMemo(() => {
    return filteredByDate
      .filter((r) => r.status === 'pending' || !r.status)
      .reduce((sum, r) => sum + getEffectivePrice(r.service), 0)
  }, [filteredByDate, getEffectivePrice])

  const serviceCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    filteredByDate.forEach((r) => {
      counts[r.service] = (counts[r.service] || 0) + 1
    })
    return Object.entries(counts).sort((a, b) => b[1] - a[1])
  }, [filteredByDate])

  const dailyCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    const today = new Date()
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const key = `${d.getDate()}/${d.getMonth() + 1}`
      counts[key] = 0
    }
    filteredByDate.forEach((r) => {
      if (r.date) {
        const parts = r.date.split('-')
        if (parts.length === 3) {
          const key = `${parseInt(parts[2])}/${parseInt(parts[1])}`
          if (counts[key] !== undefined) counts[key]++
        }
      }
    })
    return Object.entries(counts)
  }, [filteredByDate])

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
            className="bg-dark-card border border-white/10 rounded-2xl w-full max-w-5xl max-h-[85vh] overflow-hidden shadow-2xl shadow-primary/10 touch-action-manipulation"
            style={{ willChange: 'transform, opacity' }}
          >
            <div className="flex items-center justify-between p-3 sm:p-6 border-b border-white/5">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <button
                  onClick={() => setShowMobileSidebar(!showMobileSidebar)}
                  className="md:hidden w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-all touch-action-manipulation"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </button>
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-primary to-amber-600 flex items-center justify-center text-white font-bold text-xs sm:text-sm shrink-0">
                  A
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm sm:text-lg font-bold text-white truncate">Panel Admin</h2>
                  <p className="text-[10px] sm:text-xs text-white/40 truncate">Gestión de Paseos Quebrada</p>
                </div>
              </div>
              <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                <button
                  onClick={() => setShowGallery(!showGallery)}
                  className={`hidden sm:flex items-center gap-1.5 text-xs px-2 sm:px-3 py-1.5 rounded-full transition-all ${
                    showGallery ? 'bg-primary/20 text-primary' : 'bg-white/5 text-white/40 hover:text-white hover:bg-white/10'
                  }`}
                  title="Galería de fotos"
                >
                  <FaImage size={12} />
                  <span className="hidden sm:inline">Fotos</span>
                </button>
                <button
                  onClick={() => setShowQuickMsg(!showQuickMsg)}
                  className="hidden sm:flex items-center gap-1.5 text-xs px-2 sm:px-3 py-1.5 rounded-full bg-white/5 text-white/40 hover:text-white hover:bg-white/10 transition-all"
                  title="Enviar WhatsApp"
                >
                  <FaPaperPlane size={12} />
                  <span className="hidden sm:inline">Mensaje</span>
                </button>
                <button
                  onClick={exportCSV}
                  className="hidden sm:flex items-center gap-1.5 text-xs px-2 sm:px-3 py-1.5 rounded-full bg-white/5 text-white/40 hover:text-white hover:bg-white/10 transition-all"
                  title="Exportar reservas CSV"
                >
                  <FaDownload size={12} />
                  <span className="hidden sm:inline">CSV</span>
                </button>
                <button
                  onClick={requestNotificationPermission}
                  className={`hidden sm:flex items-center gap-1.5 text-xs px-2 sm:px-3 py-1.5 rounded-full transition-all ${
                    notificationsOn
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-white/5 text-white/40 hover:text-white/60'
                  }`}
                >
                  <FaBell size={12} />
                  <span className="hidden sm:inline">{notificationsOn ? 'Notificaciones activas' : 'Activar notificaciones'}</span>
                </button>
                {user && (
                  <span className="text-xs text-white/30 hidden lg:block max-w-[120px] truncate">{user.email}</span>
                )}
                {onLogout && (
                  <button
                    onClick={onLogout}
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-red-500/10 text-red-400 hover:bg-red-500/20 flex items-center justify-center transition-all touch-action-manipulation"
                    title="Cerrar sesión"
                  >
                    <FaSignOutAlt size={11} />
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/5 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-all touch-action-manipulation"
                >
                  <FaTimes size={12} />
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
                <div className="p-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
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
                  <div className="flex items-center gap-2">
                    <button
                      onClick={sendQuickMessage}
                      disabled={!quickMsgNumber || !quickMsgInput}
                      className="flex-1 sm:shrink-0 px-4 py-2 rounded-lg text-xs font-semibold bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-all disabled:opacity-30 touch-action-manipulation"
                    >
                      <FaPaperPlane size={12} />
                    </button>
                    <button onClick={() => setShowQuickMsg(false)} className="shrink-0 text-white/30 hover:text-white text-xs">Cerrar</button>
                  </div>
                </div>
              </motion.div>
            )}

            <div className="hidden md:flex border-b border-white/5 overflow-x-auto scrollbar-none" ref={tabsRef}>
              {[
                { id: 'resumen' as Tab, label: 'Resumen', icon: FaHome },
                { id: 'reservas' as Tab, label: 'Reservas', icon: FaCalendarAlt },
                { id: 'calendario' as Tab, label: 'Calendario', icon: FaDog },
                { id: 'resenas' as Tab, label: 'Reseñas', icon: FaStar },
                { id: 'estadisticas' as Tab, label: 'Estadísticas', icon: FaChartBar },
                { id: 'cupones' as Tab, label: 'Cupones', icon: FaTag },
                { id: 'precios' as Tab, label: 'Precios', icon: FaDollarSign },
                { id: 'config' as Tab, label: 'Config', icon: FaCog },
              ].map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className={`flex items-center gap-2 px-3 lg:px-6 py-3 text-xs lg:text-sm font-medium transition-all relative whitespace-nowrap touch-action-manipulation ${
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

            <AnimatePresence>
              {showMobileSidebar && (
                <>
                  <motion.div
                    key="sidebar-overlay"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-sm md:hidden"
                    onClick={() => setShowMobileSidebar(false)}
                  />
                  <motion.div
                    key="sidebar-drawer"
                    initial={{ x: '-100%' }}
                    animate={{ x: 0 }}
                    exit={{ x: '-100%' }}
                    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                    className="fixed top-0 left-0 h-full w-64 max-w-[75vw] z-[310] md:hidden overflow-y-auto"
                    style={{
                      background: 'var(--bg-card)',
                      borderRight: '1px solid var(--border)',
                      boxShadow: '8px 0 32px rgba(0,0,0,0.3)',
                    }}
                  >
                    <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--border)' }}>
                      <span className="font-bold gradient-text text-sm">Navegación</span>
                      <button
                        onClick={() => setShowMobileSidebar(false)}
                        className="w-7 h-7 rounded-full flex items-center justify-center touch-action-manipulation"
                        style={{ background: 'var(--glass-bg)', color: 'var(--text-secondary)' }}
                      >
                        <FaTimes size={11} />
                      </button>
                    </div>
                    <div className="p-3 flex flex-col gap-1">
                      {[
                        { id: 'resumen' as Tab, label: 'Resumen', icon: FaHome },
                        { id: 'reservas' as Tab, label: 'Reservas', icon: FaCalendarAlt },
                        { id: 'calendario' as Tab, label: 'Calendario', icon: FaDog },
                        { id: 'resenas' as Tab, label: 'Reseñas', icon: FaStar },
                        { id: 'estadisticas' as Tab, label: 'Estadísticas', icon: FaChartBar },
                        { id: 'cupones' as Tab, label: 'Cupones', icon: FaTag },
                        { id: 'precios' as Tab, label: 'Precios', icon: FaDollarSign },
                        { id: 'config' as Tab, label: 'Config', icon: FaCog },
                      ].map(({ id, label, icon: Icon }) => (
                        <button
                          key={id}
                          onClick={() => { setTab(id); setShowMobileSidebar(false) }}
                          className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all touch-action-manipulation ${
                            tab === id
                              ? 'text-primary'
                              : 'text-white/40 hover:text-white/60'
                          }`}
                          style={tab === id ? { background: 'var(--glass-bg)' } : {}}
                        >
                          <Icon size={14} />
                          {label}
                        </button>
                      ))}
                      <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
                        {onLogout && (
                          <button
                            onClick={() => { onLogout(); setShowMobileSidebar(false) }}
                            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm text-red-400 hover:bg-red-500/10 transition-all touch-action-manipulation"
                          >
                            <FaSignOutAlt size={14} />
                            Cerrar sesión
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>

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
                    <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none w-full sm:w-auto pb-1">
                      {(['all', 'pending', 'en_camino', 'paseando', 'completed'] as const).map((s) => (
                        <button
                          key={s}
                          onClick={() => setStatusFilter(s)}
                          className={`text-xs whitespace-nowrap px-2 py-1.5 rounded-lg transition-all touch-action-manipulation ${
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
                    <div className="space-y-3">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="glass p-4 rounded-xl animate-pulse">
                          <div className="flex items-center justify-between mb-3">
                            <div className="h-4 w-28 bg-white/5 rounded" />
                            <div className="h-4 w-16 bg-white/5 rounded-full" />
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1">
                            <div className="h-3 w-20 bg-white/5 rounded" />
                            <div className="h-3 w-28 bg-white/5 rounded" />
                            <div className="h-3 w-24 bg-white/5 rounded" />
                            <div className="h-3 w-16 bg-white/5 rounded" />
                          </div>
                        </div>
                      ))}
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
                              <button onClick={() => viewHistory(res.phone)} className="hover:text-primary transition-colors flex items-center gap-1" title="Ver historial">
                                📞 {res.phone}
                              </button>
                              <span>📋 {res.service}</span>
                              <span>📅 {res.date}</span>
                              <span>⏰ {res.time}</span>
                              <button
                                onClick={() => handlePaymentToggle(res.id, res.paymentStatus)}
                                className={`text-xs flex items-center gap-0.5 px-1.5 py-0.5 rounded transition-all ${
                                  res.paymentStatus === 'paid' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                                }`}
                                title={res.paymentStatus === 'paid' ? 'Pagado' : 'Pendiente de pago'}
                              >
                                {res.paymentStatus === 'paid' ? '✓ Pagado' : '⏳ Pendiente'}
                              </button>
                            </div>
                            {res.notes && (
                              <p className="text-xs text-white/30 mt-1">📝 {res.notes}</p>
                            )}
                            {res.internalNotes && (
                              <p className="text-xs text-primary/50 mt-0.5">🔒 {res.internalNotes}</p>
                            )}
                            {res.completedAt && (
                              <p className="text-[10px] text-green-500/40 mt-0.5">
                                ✓ Completada {new Date(typeof res.completedAt === 'object' ? res.completedAt.seconds * 1000 : res.completedAt).toLocaleDateString()}
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

              {tab === 'resumen' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-white">Resumen del día</h3>
                      <p className="text-xs text-white/40">{new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
                    </div>
                    <button
                      onClick={() => {
                        const today = new Date().toISOString().split('T')[0]
                        const todays = reservations.filter((r) => r.date === today && r.status !== 'cancelled' && r.status !== 'completed')
                        if (todays.length === 0) return
                        const msg = todays.map((r) => `🐾 ${r.petName} - ${r.service} - ${r.time}`).join('\n')
                        window.open(`https://wa.me/5215523053772?text=${encodeURIComponent('📋 *Reservas de hoy:*\n\n' + msg)}`, '_blank')
                      }}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-all"
                    >
                      <FaWhatsapp size={10} /> Enviar resumen por WhatsApp
                    </button>
                  </div>

                  <motion.div
                    initial="hidden"
                    animate="visible"
                    variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
                    className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3"
                  >
                    {[
                      { label: 'Hoy', value: reservations.filter((r) => r.date === new Date().toISOString().split('T')[0] && r.status !== 'cancelled').length, color: 'from-primary to-amber-600' },
                      { label: 'Completadas hoy', value: reservations.filter((r) => r.date === new Date().toISOString().split('T')[0] && r.status === 'completed').length, color: 'from-green-500 to-emerald-600' },
                      { label: 'Pendientes', value: pendingCount, color: 'from-secondary to-orange-500' },
                      { label: 'Por facturar', value: `$${pendingRevenue.toLocaleString()}`, color: 'from-amber-500 to-orange-600' },
                    ].map((stat) => (
                      <motion.div
                        key={stat.label}
                        variants={{ hidden: { opacity: 0, y: 15 }, visible: { opacity: 1, y: 0 } }}
                        className="glass-card p-4 text-center"
                      >
                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center mx-auto mb-2`}>
                          <FaChartBar className="text-white text-sm" />
                        </div>
                        <div className="text-xl font-bold text-white">{stat.value}</div>
                        <div className="text-[10px] text-white/40 mt-0.5">{stat.label}</div>
                      </motion.div>
                    ))}
                  </motion.div>

                  <div>
                    <h4 className="text-sm font-semibold text-white mb-3">🕐 Reservas para hoy</h4>
                    {(() => {
                      const today = new Date().toISOString().split('T')[0]
                      const todaysReservations = reservations.filter((r) => r.date === today && r.status !== 'cancelled')
                      if (todaysReservations.length === 0) return <p className="text-sm text-white/30 text-center py-6">Sin reservas para hoy</p>
                      return (
                        <div className="space-y-2">
                          {todaysReservations.sort((a, b) => a.time.localeCompare(b.time)).map((r) => (
                            <motion.div
                              key={r.id}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              className="flex items-center justify-between glass p-3 rounded-xl"
                            >
                              <div className="flex items-center gap-3">
                                <div className={`w-2 h-2 rounded-full ${
                                  r.status === 'completed' ? 'bg-green-400' : r.status === 'en_camino' ? 'bg-blue-400' : r.status === 'paseando' ? 'bg-purple-400' : 'bg-secondary'
                                }`} />
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-semibold text-white">{r.petName}</span>
                                    <span className="text-[10px] text-white/40">{r.time}</span>
                                  </div>
                                  <p className="text-xs text-white/50">{r.name} — {r.service}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => openWhatsApp(r.phone, r.name)}
                                  className="w-7 h-7 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 flex items-center justify-center transition-all"
                                >
                                  <FaWhatsapp size={10} />
                                </button>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      )
                    })()}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="glass-card p-4">
                      <AdminBanner />
                    </div>
                    <div className="glass-card p-4">
                      <h4 className="text-sm font-semibold text-white mb-3">📊 Totales generales</h4>
                      <div className="space-y-1.5 text-xs">
                        <div className="flex items-center justify-between text-white/60"><span>Reservas totales</span><span className="text-white font-semibold">{reservations.length}</span></div>
                        <div className="flex items-center justify-between text-white/60"><span>Completadas</span><span className="text-green-400 font-semibold">{completedCount}</span></div>
                        <div className="flex items-center justify-between text-white/60"><span>Pendientes</span><span className="text-secondary font-semibold">{pendingCount}</span></div>
                        <div className="flex items-center justify-between text-white/60"><span>Ingresos cobrados</span><span className="text-white font-semibold">${totalRevenue.toLocaleString()}</span></div>
                        <div className="flex items-center justify-between text-white/60"><span>Calificación promedio</span><span className="text-secondary font-semibold">{avgRating}</span></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {tab === 'cupones' && (
                <AdminCoupons />
              )}
              {tab === 'precios' && (
                <AdminPrices />
              )}
              {tab === 'config' && (
                <AdminConfig />
              )}

              {tab === 'estadisticas' && (
                <div className="space-y-6">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-white/40">Desde</label>
                      <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                        className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-primary" />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-white/40">Hasta</label>
                      <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                        className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-primary" />
                    </div>
                    {(dateFrom || dateTo) && (
                      <button onClick={() => { setDateFrom(''); setDateTo('') }}
                        className="text-xs text-white/30 hover:text-white transition-all">
                        Limpiar filtro
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                    {[
                      { label: 'Reservas totales', value: filteredByDate.length, icon: FaCalendarAlt, color: 'from-primary to-amber-600' },
                      { label: 'Completadas', value: filteredByDate.filter((r) => r.status === 'completed').length, icon: FaCheck, color: 'from-green-500 to-emerald-600' },
                      { label: 'Pendientes', value: filteredByDate.filter((r) => r.status === 'pending' || !r.status).length, icon: FaSpinner, color: 'from-secondary to-orange-500' },
                      { label: 'En camino', value: filteredByDate.filter((r) => r.status === 'en_camino').length, icon: FaDog, color: 'from-blue-500 to-indigo-600' },
                      { label: 'Paseando', value: filteredByDate.filter((r) => r.status === 'paseando').length, icon: FaWalking, color: 'from-purple-500 to-violet-600' },
                      { label: 'Reseñas', value: reviews.length, icon: FaStar, color: 'from-pink-500 to-rose-600' },
                      { label: 'Calificación', value: avgRating, icon: FaStar, color: 'from-yellow-500 to-amber-600' },
                      { label: 'Perros', value: new Set(filteredByDate.map((r) => r.petName)).size, icon: FaDog, color: 'from-cyan-500 to-blue-600' },
                      { label: '💰 Ingresos cobrados', value: `$${filteredByDate.filter((r) => r.status === 'completed').reduce((sum, r) => sum + getEffectivePrice(r.service), 0).toLocaleString()}`, icon: FaChartBar, color: 'from-emerald-500 to-green-600' },
                      { label: '⏳ Por cobrar', value: `$${filteredByDate.filter((r) => r.status === 'pending' || !r.status).reduce((sum, r) => sum + getEffectivePrice(r.service), 0).toLocaleString()}`, icon: FaChartBar, color: 'from-amber-500 to-orange-600' },
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
        reservations={reservations}
        key={editingReservation?.id || 'none'}
      />


      <AnimatePresence>
        {confirmDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[400] bg-black/80 flex items-center justify-center p-4"
            onClick={() => setConfirmDelete(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-dark-card border border-white/10 rounded-2xl w-full max-w-sm p-6 text-center shadow-2xl shadow-red-500/10"
            >
              <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                <FaTrash className="text-red-400" size={18} />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Eliminar reserva</h3>
              <p className="text-sm text-white/50 mb-6">Esta acci\u00f3n no se puede deshacer. \u00bfEst\u00e1s seguro?</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmDelete(null)}
                  className="flex-1 py-2.5 rounded-xl text-sm text-white/50 hover:text-white border border-white/10 hover:border-white/20 transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={executeDelete}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-red-500 to-red-700 text-white hover:opacity-90 transition-all"
                >
                  S\u00ed, eliminar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
            <AnimatePresence>
        {historyPhone && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] bg-black/80 flex items-center justify-center p-4"
            onClick={() => setHistoryPhone('')}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-dark-card border border-white/10 rounded-2xl w-full max-w-lg max-h-[80vh] overflow-hidden shadow-2xl"
            >
              <div className="flex items-center justify-between p-5 border-b border-white/5">
                <h3 className="text-lg font-bold text-white">📋 Historial — {historyPhone}</h3>
                <button onClick={() => setHistoryPhone('')} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/50 hover:text-white transition-all">
                  <FaTimes size={12} />
                </button>
              </div>
              <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto">
                {historyReservations.length === 0 ? (
                  <p className="text-center text-white/30 py-8 text-sm">Sin historial</p>
                ) : (
                  historyReservations.map((r) => (
                    <div key={r.id} className="glass p-3 rounded-xl">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold text-white">{r.petName}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                          r.status === 'completed' ? 'bg-green-500/20 text-green-400' : r.status === 'cancelled' ? 'bg-red-500/20 text-red-400' : 'bg-secondary/20 text-secondary'
                        }`}>
                          {r.status === 'completed' ? 'Completada' : r.status === 'cancelled' ? 'Cancelada' : 'Pendiente'}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-white/50">
                        <span>📋 {r.service}</span>
                        <span>📅 {r.date}</span>
                        <span>⏰ {r.time}</span>
                        {r.paymentStatus && (
                          <span className={r.paymentStatus === 'paid' ? 'text-green-400' : 'text-yellow-400'}>
                            {r.paymentStatus === 'paid' ? '✓ Pagado' : '⏳ Pendiente'}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AnimatePresence>
  )
}
