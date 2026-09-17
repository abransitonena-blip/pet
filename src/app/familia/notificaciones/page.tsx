'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { onAuthStateChanged } from 'firebase/auth'
import { collection, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query, updateDoc, where } from 'firebase/firestore'
import { auth, db } from '@/firebase/config'
import { ArrowLeft, Bell, Dog, CalendarCheck, Star, Gift, MessagesSquare } from 'lucide-react'
import { Button, EmptyState, ErrorState } from '@/components/ui'
import { canonicalReadErrorMessage, useCustomerWalkSessions } from '@/lib/useCanonicalWalkSessions'
import { deriveWalkActivity } from '@/lib/walkActivity'
import PushOptIn from '@/components/PushOptIn'
import { daysAgo } from '@/lib/recentWindow'

/**
 * Notificaciones de la familia.
 *
 * Stored notifications can only be written by an admin (or, one day, a
 * trusted backend), and nothing has ever written one -- so this page was
 * permanently empty. Most of what a family wants to be told is recorded
 * anyway: each step of a walk leaves a timestamp on the session. The feed is
 * built from those (see walkActivity.ts), plus a pinned item when the admin
 * has replied in Mensajes, with any stored notifications merged in by time.
 *
 * "Unread" for the derived items is per device: anything newer than the last
 * visit to this page, remembered in localStorage.
 */

interface StoredNotification {
  id: string
  title: string
  message: string
  type: 'walk_update' | 'loyalty' | 'referral' | 'system'
  read: boolean
  createdAt: { seconds: number; nanoseconds: number } | null
}

type FeedKind = 'walk' | 'loyalty' | 'referral' | 'system' | 'message'

interface FeedItem {
  id: string
  kind: FeedKind
  title: string
  message: string
  at: number
  unread: boolean
  href?: string
  storedId?: string
}

const KIND_ICONS: Record<FeedKind, typeof Bell> = {
  walk: Dog,
  loyalty: Star,
  referral: Gift,
  system: CalendarCheck,
  message: MessagesSquare,
}

const KIND_COLORS: Record<FeedKind, string> = {
  walk: 'var(--color-primary)',
  loyalty: '#B45309',
  referral: '#7C3AED',
  system: 'var(--color-success)',
  message: '#0369A1',
}

const MAX_ITEMS = 60

function seenKey(uid: string) {
  return `pet-notificaciones-vistas:${uid}`
}

function readLastSeen(uid: string): number {
  try {
    return Number(window.localStorage.getItem(seenKey(uid))) || 0
  } catch {
    return 0
  }
}

function writeLastSeen(uid: string, at: number) {
  try {
    window.localStorage.setItem(seenKey(uid), String(at))
  } catch {
    // Private mode or blocked storage: every item simply stays "new".
  }
}

function formatTime(at: number): string {
  const diffMin = Math.floor((Date.now() - at) / 60000)
  if (diffMin < 1) return 'Ahora'
  if (diffMin < 60) return `Hace ${diffMin} min`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `Hace ${diffHr} h`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 7) return `Hace ${diffDay} d`
  return new Date(at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function NotificacionesPage() {
  const router = useRouter()
  const [uid, setUid] = useState('')
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [stored, setStored] = useState<StoredNotification[]>([])
  const [storedError, setStoredError] = useState('')
  const [dogNames, setDogNames] = useState<Record<string, string>>({})
  const [pendingReplies, setPendingReplies] = useState<{ count: number; at: number } | null>(null)
  const [lastSeen, setLastSeen] = useState<number | null>(null)
  const [retryKey, setRetryKey] = useState(0)
  // Un aviso viejo no es un aviso: la actividad sale de los últimos 30 días.
  const { sessions, loading: sessionsLoading, error: sessionsError, retry: retrySessions } = useCustomerWalkSessions(uid, { since: daysAgo(new Date().toLocaleDateString('en-CA'), 30) })

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      if (!user) { router.push('/login'); return }
      setUid(user.uid)
      setCheckingAuth(false)
    })
  }, [router])

  // Capture what counted as "seen" before this visit, then move the mark to
  // now, so items stay highlighted for the whole visit and not after it.
  useEffect(() => {
    if (!uid) return
    setLastSeen(readLastSeen(uid))
    writeLastSeen(uid, Date.now())
  }, [uid])

  useEffect(() => {
    if (!uid) return
    setStoredError('')
    return onSnapshot(
      query(collection(db, 'notifications', uid, 'items'), orderBy('createdAt', 'desc'), limit(50)),
      (snapshot) => setStored(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as StoredNotification))),
      (cause) => setStoredError(cause.code.includes('permission-denied')
        ? 'Tu sesión no tiene permiso para consultar tus notificaciones.'
        : 'No pudimos consultar tus notificaciones. Revisa tu conexión.'),
    )
  }, [uid, retryKey])

  useEffect(() => {
    if (!uid) return
    let cancelled = false
    getDocs(query(collection(db, 'dogs'), where('ownerId', '==', uid), limit(50)))
      .then((snapshot) => {
        if (cancelled) return
        setDogNames(Object.fromEntries(snapshot.docs.map((item) => [item.id, String(item.data().name ?? '')])))
      })
      .catch(() => { /* messages fall back to "tu mascota" */ })
    // A thread only exists once the family has written in Mensajes; before
    // that the read is denied, which simply means there is nothing to pin.
    getDoc(doc(db, 'conversations', uid))
      .then((snapshot) => {
        if (cancelled || !snapshot.exists()) return
        const data = snapshot.data()
        const count = typeof data.unreadClient === 'number' ? data.unreadClient : 0
        const at = typeof data.lastTimestamp?.seconds === 'number' ? data.lastTimestamp.seconds * 1000 : Date.now()
        setPendingReplies(count > 0 ? { count, at } : null)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [uid])

  const feed = useMemo<FeedItem[]>(() => {
    const seen = lastSeen ?? Number.POSITIVE_INFINITY
    const walkItems: FeedItem[] = deriveWalkActivity(sessions, dogNames).map((item) => ({
      id: item.id,
      kind: 'walk',
      title: item.title,
      message: item.message,
      at: item.at,
      unread: item.at > seen,
      href: item.href,
    }))
    const storedItems: FeedItem[] = stored.map((item) => ({
      id: `stored:${item.id}`,
      kind: item.type === 'walk_update' ? 'walk' : item.type,
      title: item.title,
      message: item.message,
      at: item.createdAt ? item.createdAt.seconds * 1000 : Date.now(),
      unread: !item.read,
      storedId: item.id,
    }))
    const replyItems: FeedItem[] = pendingReplies ? [{
      id: 'messages:unread',
      kind: 'message',
      title: pendingReplies.count === 1 ? 'Tienes 1 mensaje nuevo' : `Tienes ${pendingReplies.count} mensajes nuevos`,
      message: 'Administración respondió en tu conversación.',
      at: pendingReplies.at,
      unread: true,
      href: '/familia/mensajes',
    }] : []
    return [...replyItems, ...walkItems, ...storedItems]
      .sort((a, b) => Number(b.kind === 'message') - Number(a.kind === 'message') || b.at - a.at)
      .slice(0, MAX_ITEMS)
  }, [sessions, dogNames, stored, pendingReplies, lastSeen])

  const markRead = async (storedId: string) => {
    await updateDoc(doc(db, 'notifications', uid, 'items', storedId), { read: true }).catch(() => {})
  }

  if (checkingAuth || (sessionsLoading && feed.length === 0)) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-10 w-48 rounded-xl" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skeleton h-16 rounded-2xl" />
        ))}
      </div>
    )
  }

  const unreadCount = feed.filter((item) => item.unread).length

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="icon" onClick={() => router.push('/familia')} aria-label="Volver al inicio de Familia PET">
          <ArrowLeft size={14} />
        </Button>
        <div>
          <h1 className="text-lg font-bold text-ink">Notificaciones</h1>
          <p className="text-xs text-muted">{unreadCount === 0 ? 'Sin novedades' : `${unreadCount} sin revisar`}</p>
        </div>
      </div>

      <PushOptIn description="Recibe en este teléfono cada avance de tus paseos, aunque la app esté cerrada." />

      {sessionsError && (
        <ErrorState description={canonicalReadErrorMessage(sessionsError)} onRetry={retrySessions} />
      )}
      {storedError && (
        <ErrorState description={storedError} onRetry={() => setRetryKey((value) => value + 1)} />
      )}

      {feed.length === 0 ? (
        <EmptyState
          icon={<Bell size={28} />}
          title="Sin notificaciones"
          description="Aquí verás cada avance de tus paseos: asignación, llegada del paseador, inicio y fin."
        />
      ) : (
        <ul className="space-y-2">
          {feed.map((item) => {
            const Icon = KIND_ICONS[item.kind] ?? Bell
            const color = KIND_COLORS[item.kind] ?? 'var(--text-muted)'
            const body = (
              <>
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full" style={{ background: `color-mix(in srgb, ${color} 12%, transparent)` }}>
                  <Icon size={16} style={{ color }} aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-ink">{item.title}</p>
                    {item.unread && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Sin revisar" />}
                  </div>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted">{item.message}</p>
                  <p className="mt-1.5 text-2xs text-muted">{formatTime(item.at)}</p>
                </div>
              </>
            )
            const className = `flex items-start gap-3 rounded-2xl p-4 transition-colors ${item.unread ? 'bg-primary/[0.05]' : 'bg-surface'} hover:bg-ink/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary`
            return (
              <li key={item.id}>
                {item.href ? (
                  <Link href={item.href} className={className}>{body}</Link>
                ) : item.storedId && item.unread ? (
                  <button type="button" onClick={() => void markRead(item.storedId as string)} className={`${className} w-full text-left`}>{body}</button>
                ) : (
                  <div className={className}>{body}</div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
