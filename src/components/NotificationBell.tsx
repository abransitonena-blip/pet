'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FaBell, FaCheck, FaTimes, FaDog, FaCalendarCheck, FaStar, FaGift } from 'react-icons/fa'
import { db } from '@/firebase/config'
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, limit } from 'firebase/firestore'

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

export default function NotificationBell({ uid }: { uid: string }) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    if (!uid) return
    const q = query(
      collection(db, 'notifications', uid, 'items'),
      orderBy('createdAt', 'desc'),
      limit(20)
    )
    return onSnapshot(q, (snap) => {
      const items: Notification[] = []
      let count = 0
      snap.forEach((d) => {
        const data = d.data() as Omit<Notification, 'id'>
        items.push({ id: d.id, ...data })
        if (!data.read) count++
      })
      setNotifications(items)
      setUnread(count)
    })
  }, [uid])

  const markRead = async (id: string) => {
    await updateDoc(doc(db, 'notifications', uid, 'items', id), { read: true }).catch(() => {})
  }

  const markAllRead = async () => {
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id)
    await Promise.all(
      unreadIds.map((id) => updateDoc(doc(db, 'notifications', uid, 'items', id), { read: true }))
    ).catch(() => {})
  }

  const formatTime = (ts: { seconds: number; nanoseconds: number } | null) => {
    if (!ts) return 'Ahora'
    const date = new Date(ts.seconds * 1000)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    if (diffMin < 1) return 'Ahora'
    if (diffMin < 60) return `${diffMin}m`
    const diffHr = Math.floor(diffMin / 60)
    if (diffHr < 24) return `${diffHr}h`
    const diffDay = Math.floor(diffHr / 24)
    if (diffDay < 7) return `${diffDay}d`
    return date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:bg-white/5"
        style={{ color: 'var(--text-muted)' }}
      >
        <FaBell size={16} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-brand-500 text-white text-2xs font-bold flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-full mt-2 w-80 max-h-96 overflow-hidden rounded-2xl z-50"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}
            >
              <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
                <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Notificaciones</h3>
                {unread > 0 && (
                  <button onClick={markAllRead} className="text-2xs transition-colors hover:opacity-80" style={{ color: 'var(--color-primary)' }}>
                    Marcar todo leído
                  </button>
                )}
              </div>

              <div className="overflow-y-auto max-h-72">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center">
                    <FaBell size={24} className="mx-auto mb-2 opacity-20" style={{ color: 'var(--text-muted)' }} />
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Sin notificaciones</p>
                  </div>
                ) : (
                  notifications.map((n) => {
                    const Icon = typeIcons[n.type] || FaBell
                    const color = typeColors[n.type] || 'var(--text-muted)'
                    return (
                      <div
                        key={n.id}
                        onClick={() => { if (!n.read) markRead(n.id) }}
                        className="flex items-start gap-3 px-4 py-3 transition-colors cursor-pointer hover:bg-white/3"
                        style={{ background: n.read ? 'transparent' : 'rgba(217,119,6,0.05)' }}
                      >
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                          style={{ background: `${color}15` }}>
                          <Icon size={14} style={{ color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{n.title}</p>
                            {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-brand-500 shrink-0" />}
                          </div>
                          <p className="text-2xs mt-0.5 leading-relaxed" style={{ color: 'var(--text-muted)' }}>{n.message}</p>
                          <p className="text-2xs mt-1" style={{ color: 'var(--text-muted)', opacity: 0.6 }}>{formatTime(n.createdAt)}</p>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              {notifications.length > 0 && (
                <a
                  href="/mi-cuenta/notificaciones"
                  onClick={() => setOpen(false)}
                  className="block text-center py-2.5 text-xs font-medium transition-colors hover:bg-white/3"
                  style={{ color: 'var(--color-primary)', borderTop: '1px solid var(--border)' }}
                >
                  Ver todas
                </a>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
