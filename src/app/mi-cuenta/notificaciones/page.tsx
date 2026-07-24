'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc, collection, query, orderBy, onSnapshot, updateDoc, limit } from 'firebase/firestore'
import { auth, db } from '@/firebase/config'
import { FaArrowLeft, FaBell, FaDog, FaCalendarCheck, FaStar, FaGift } from 'react-icons/fa'

interface Notification {
  id: string
  title: string
  message: string
  type: 'walk_update' | 'loyalty' | 'referral' | 'system'
  read: boolean
  createdAt: { seconds: number; nanoseconds: number } | null
}

const typeIcons: Record<string, typeof FaBell> = {
  walk_update: FaDog,
  loyalty: FaStar,
  referral: FaGift,
  system: FaCalendarCheck,
}

const typeColors: Record<string, string> = {
  walk_update: 'var(--color-primary)',
  loyalty: '#F59E0B',
  referral: '#8B5CF6',
  system: 'var(--color-success)',
}

export default function NotificacionesPage() {
  const router = useRouter()
  const [uid, setUid] = useState('')
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) { router.push('/login'); return }
      setUid(user.uid)
      setLoading(false)
    })
    return unsub
  }, [router])

  useEffect(() => {
    if (!uid) return
    const q = query(
      collection(db, 'notifications', uid, 'items'),
      orderBy('createdAt', 'desc'),
      limit(50)
    )
    return onSnapshot(q, (snap) => {
      const items: Notification[] = []
      snap.forEach((d) => {
        items.push({ id: d.id, ...d.data() } as Notification)
      })
      setNotifications(items)
    })
  }, [uid])

  const markRead = async (id: string) => {
    await updateDoc(doc(db, 'notifications', uid, 'items', id), { read: true }).catch(() => {})
  }

  const formatTime = (ts: { seconds: number; nanoseconds: number } | null) => {
    if (!ts) return 'Ahora'
    const date = new Date(ts.seconds * 1000)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    if (diffMin < 1) return 'Ahora'
    if (diffMin < 60) return `Hace ${diffMin} min`
    const diffHr = Math.floor(diffMin / 60)
    if (diffHr < 24) return `Hace ${diffHr}h`
    const diffDay = Math.floor(diffHr / 24)
    if (diffDay < 7) return `Hace ${diffDay}d`
    return date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-10 w-48 rounded-xl" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skeleton h-16 rounded-2xl" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push('/mi-cuenta')}
          className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-white/5"
          style={{ color: 'var(--text-muted)' }}
        >
          <FaArrowLeft size={14} />
        </button>
        <div>
          <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Notificaciones</h1>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{notifications.filter((n) => !n.read).length} sin leer</p>
        </div>
      </div>

      {notifications.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl p-8 text-center"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
        >
          <FaBell size={32} className="mx-auto mb-3 opacity-20" style={{ color: 'var(--text-muted)' }} />
          <h2 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Sin notificaciones</h2>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Tus actualizaciones aparecerán aquí</p>
        </motion.div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n, i) => {
            const Icon = typeIcons[n.type] || FaBell
            const color = typeColors[n.type] || 'var(--text-muted)'
            return (
              <motion.div
                key={n.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => { if (!n.read) markRead(n.id) }}
                className="flex items-start gap-3 p-4 rounded-2xl transition-all cursor-pointer hover:bg-white/[0.02]"
                style={{
                  background: n.read ? 'var(--bg-card)' : 'rgba(217,119,6,0.04)',
                  border: '1px solid var(--border)',
                }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: `${color}12` }}
                >
                  <Icon size={16} style={{ color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{n.title}</p>
                    {!n.read && <span className="w-2 h-2 rounded-full bg-brand-500 shrink-0" />}
                  </div>
                  <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--text-muted)' }}>{n.message}</p>
                  <p className="text-2xs mt-1.5" style={{ color: 'var(--text-muted)', opacity: 0.6 }}>{formatTime(n.createdAt)}</p>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
