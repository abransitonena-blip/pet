'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore'
import { auth, db } from '@/firebase/config'
import { onAuthStateChanged } from 'firebase/auth'
import { motion } from 'framer-motion'
import {
  History, Dog, CheckCircle2, CalendarDays, Clock, ArrowLeft,
  PersonStanding, Camera, MapPin,
} from 'lucide-react'
import type { Reservation } from '@/types'

export default function PaseadorHistorialPage() {
  const router = useRouter()
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'completed' | 'in_progress'>('all')

  useEffect(() => {
    let unsubRes: (() => void) | undefined
    let unsubResUid: (() => void) | undefined

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (unsubRes) { unsubRes(); unsubRes = undefined }
      if (unsubResUid) { unsubResUid(); unsubResUid = undefined }
      if (!user) { router.push('/login'); return }

      const userSnap = await getDoc(doc(db, 'users', user.uid))
      const name = userSnap.exists() ? userSnap.data().name || '' : ''
      if (!name) { setLoading(false); return }

      const seenIds = new Set<string>()

      // Query by name (legacy)
      const qName = query(collection(db, 'reservations'), where('assignedWalker', '==', name))
      unsubRes = onSnapshot(qName, (snap) => {
        const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Reservation))
        docs.forEach((d) => seenIds.add(d.id))
        setReservations(docs)
        setLoading(false)
      }, () => setLoading(false))

      // Query by uid (new auto-assign)
      const qUid = query(collection(db, 'reservations'), where('assignment.walkerId', '==', user.uid))
      unsubResUid = onSnapshot(qUid, (snap) => {
        const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Reservation))
        const merged = [...reservations]
        for (const doc of docs) {
          if (!seenIds.has(doc.id)) {
            seenIds.add(doc.id)
            merged.push(doc)
          }
        }
        merged.sort((a, b) => {
          const ca = a.createdAt as string | { seconds?: number } | undefined
          const cb = b.createdAt as string | { seconds?: number } | undefined
          const ta = typeof ca === 'string' ? new Date(ca).getTime() : ca?.seconds ? ca.seconds * 1000 : 0
          const tb = typeof cb === 'string' ? new Date(cb).getTime() : cb?.seconds ? cb.seconds * 1000 : 0
          return tb - ta
        })
        setReservations(merged)
        setLoading(false)
      }, () => setLoading(false))
    })
    return () => { unsubRes?.(); unsubResUid?.(); unsubAuth() }
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
            onClick={() => router.push('/walker')}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-ink/5"
            style={{ color: 'var(--text-muted)' }}
          >
            <ArrowLeft size={14} />
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
          { value: 'completed' as const, label: 'Completados', count: completedCount },
          { value: 'in_progress' as const, label: 'En progreso', count: reservations.filter((r) => r.status === 'in_progress').length },
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
          <History className="text-3xl mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm mb-1" style={{ color: 'var(--text-primary)' }}>
            {filter === 'all' ? 'No hay paseos en tu historial' : `No hay paseos ${filter === 'completed' ? 'completados' : 'en progreso'}`}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((res, i) => (
            <motion.div
              key={res.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="rounded-xl p-4"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
            >
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  res.status === 'completed' ? 'bg-success-500/10' :
                  res.status === 'in_progress' ? 'bg-success-500/20' :
                  'bg-brand-500/10'
                }`}>
                  {res.status === 'completed' ? <CheckCircle2 size={14} className="text-success-400" /> :
                   res.status === 'in_progress' ? <PersonStanding size={14} className="text-success-400" /> :
                   <Dog size={14} className="text-brand-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{res.petName}</p>
                    <span className={`text-2xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
                      res.status === 'completed' ? 'bg-success-500/15 text-success-600' :
                      res.status === 'in_progress' ? 'bg-success-500/20 text-success-600' :
                      'bg-ink/10 text-[var(--text-muted)]'
                    }`}>
                      {res.status === 'completed' ? 'Completado' :
                       res.status === 'in_progress' ? 'En paseo' :
                       res.status === 'pending' ? 'Pendiente' : res.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                    <span>{res.service}</span>
                    <span className="flex items-center gap-1"><CalendarDays size={9} /> {res.date}</span>
                    <span className="flex items-center gap-1"><Clock size={9} /> {res.arrivalWindowStart ? `${res.arrivalWindowStart}${res.arrivalWindowEnd ? `-${res.arrivalWindowEnd}` : ''}` : res.time}</span>
                  </div>
                  {res.walkCheckIn && (
                    <div className="flex items-center gap-2 mt-1.5 text-2xs" style={{ color: 'var(--text-muted)' }}>
                      <Camera size={8} className="text-success-400" /> Check-in registrado
                      {res.walkCheckIn.lat && (
                        <span className="flex items-center gap-0.5">
                          <MapPin size={8} /> {res.walkCheckIn.lat.toFixed(3)}, {res.walkCheckIn.lng.toFixed(3)}
                        </span>
                      )}
                    </div>
                  )}
                  {res.walkNotes && (
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>📝 {res.walkNotes}</p>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
