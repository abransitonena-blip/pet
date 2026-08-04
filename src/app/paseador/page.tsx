'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '@/firebase/config'
import { onAuthStateChanged } from 'firebase/auth'
import { motion } from 'framer-motion'
import { Dog, CalendarDays, Clock, CheckCircle2,
  PersonStanding, Loader2, Package } from 'lucide-react'
import WalkSessionModal from '@/components/WalkSessionModal'
import PetAhoraPhotoModal from '@/components/PetAhoraPhotoModal'
import { useWalkerSessions } from '@/lib/useServiceOrders'
import { STATUS_LABELS, STATUS_COLORS } from '@/lib/sessionMachine'
import { logAudit } from '@/lib/auditLog'
import { usePetAhoraWalkerOffers } from '@/lib/usePetAhoraWalker'
import { PetAhoraOffersList } from '@/components/PetAhoraOfferCard'
import { usePetAhoraActiveWalks, updatePetAhoraWalkStatus } from '@/lib/usePetAhoraActiveWalks'
import type { Reservation, SessionStatus } from '@/types'

export default function PaseadorDashboard() {
  const router = useRouter()
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [walkerName, setWalkerName] = useState('')
  const [walkerUid, setWalkerUid] = useState<string | undefined>()
  const [loading, setLoading] = useState(true)
  const [walkModal, setWalkModal] = useState<{ reservation: Reservation; mode: 'check_in' | 'check_out' } | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const { offers: petAhoraOffers } = usePetAhoraWalkerOffers(walkerUid)
  const { walks: petAhoraWalks } = usePetAhoraActiveWalks(walkerUid)
  const [updatingPetAhoraId, setUpdatingPetAhoraId] = useState<string | null>(null)
  const [petAhoraPhoto, setPetAhoraPhoto] = useState<{ requestId: string; mode: 'check_in' | 'check_out' } | null>(null)

  useEffect(() => {
    let unsubRes: (() => void) | undefined
    let unsubResUid: (() => void) | undefined
    let seenIds = new Set<string>()
    let allReservations: Reservation[] = []

    const emitUpdate = () => {
      const merged = [...allReservations]
      merged.sort((a, b) => {
        const ca = a.createdAt as string | { seconds?: number } | undefined
        const cb = b.createdAt as string | { seconds?: number } | undefined
        const ta = typeof ca === 'string' ? new Date(ca).getTime() : ca?.seconds ? ca.seconds * 1000 : 0
        const tb = typeof cb === 'string' ? new Date(cb).getTime() : cb?.seconds ? cb.seconds * 1000 : 0
        return tb - ta
      })
      setReservations(merged)
      setLoading(false)
    }

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (unsubRes) { unsubRes(); unsubRes = undefined }
      if (unsubResUid) { unsubResUid(); unsubResUid = undefined }
      seenIds = new Set<string>()
      allReservations = []
      if (!user) { router.push('/login'); return }

      setWalkerUid(user.uid)
      const userSnap = await import('firebase/firestore').then(({ getDoc }) =>
        getDoc(doc(db, 'users', user.uid))
      )
      const name = userSnap.exists() ? userSnap.data().name || user.displayName || '' : ''
      setWalkerName(name)

      if (!name) { setLoading(false); return }

      // Query by name (legacy) AND by uid (new auto-assign)
      // Only show active sessions (not completed or cancelled) for today's view
      const qName = query(collection(db, 'reservations'), where('assignedWalker', '==', name))
      unsubRes = onSnapshot(qName, (snap) => {
        snap.docChanges().forEach((change) => {
          const docData = { id: change.doc.id, ...change.doc.data() } as Reservation
          if (change.type === 'added' || change.type === 'modified') {
            seenIds.add(docData.id)
            const idx = allReservations.findIndex((r) => r.id === docData.id)
            if (idx >= 0) allReservations[idx] = docData
            else allReservations.push(docData)
          } else if (change.type === 'removed') {
            seenIds.delete(docData.id)
            allReservations = allReservations.filter((r) => r.id !== docData.id)
          }
        })
        emitUpdate()
      }, (err) => {
        console.error('Walker name query error:', err)
        setLoading(false)
      })

      // Query by assignment.walkerId (uid) - new auto-assign
      const qUid = query(collection(db, 'reservations'), where('assignment.walkerId', '==', user.uid))
      unsubResUid = onSnapshot(qUid, (snap) => {
        snap.docChanges().forEach((change) => {
          const docData = { id: change.doc.id, ...change.doc.data() } as Reservation
          if (change.type === 'added' || change.type === 'modified') {
            if (!seenIds.has(docData.id)) {
              seenIds.add(docData.id)
              allReservations.push(docData)
            }
          } else if (change.type === 'removed') {
            if (seenIds.has(docData.id)) {
              seenIds.delete(docData.id)
              allReservations = allReservations.filter((r) => r.id !== docData.id)
            }
          }
        })
        emitUpdate()
      }, (err) => {
        console.error('Walker uid query error:', err)
        setLoading(false)
      })
    })
    return () => { unsubRes?.(); unsubResUid?.(); unsubAuth() }
  }, [router])

  const today = new Date().toISOString().split('T')[0]
  const todayWalks = reservations.filter((r) => r.date === today)
  const pending = todayWalks.filter((r) => r.status === 'assigned' || r.status === 'pending')
  const active = todayWalks.filter((r) => r.status === 'in_progress')
  const completedToday = todayWalks.filter((r) => r.status === 'completed')
  const totalCompleted = reservations.filter((r) => r.status === 'completed').length

  // Service order sessions (weekly packages)
  const { sessions: walkerSessions } = useWalkerSessions(
    auth.currentUser?.uid || '',
    walkerName,
  )
  const todaySessions = walkerSessions.filter(
    (s) => s.date === today && s.sessionStatus !== 'completed' && s.sessionStatus !== 'cancelled',
  )

  const handlePetAhoraStatus = async (id: string, status: string) => {
    setUpdatingPetAhoraId(id)
    const ok = await updatePetAhoraWalkStatus(id, status)
    if (!ok) console.error('Failed to update PET Ahora status')
    setUpdatingPetAhoraId(null)
  }

  const handleStatusUpdate = async (id: string, status: string) => {
    setUpdatingId(id)
    try {
      await updateDoc(doc(db, 'reservations', id), { status, updatedAt: serverTimestamp() })
      logAudit({
        action: status === 'completed' ? 'complete' : 'update',
        entity: 'walkSession',
        entityId: id,
        after: { status },
      })
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

      {/* PET Ahora Offers */}
      <PetAhoraOffersList offers={petAhoraOffers} onDone={() => {}} />

      {/* Active PET Ahora Walks */}
      {petAhoraWalks.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
            PET Ahora activos
          </h2>
          <div className="space-y-2">
            {petAhoraWalks.map((walk) => (
              <div
                key={walk.id}
                className="rounded-xl p-4"
                style={{ background: 'linear-gradient(135deg, rgba(251,191,36,0.08), rgba(251,191,36,0.03))', border: '1px solid rgba(251,191,36,0.15)' }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(251,191,36,0.15)' }}>
                      <Dog size={14} className="text-secondary" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{walk.petName}</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {walk.status === 'accepted' ? 'Aceptado' : walk.status === 'en_camino' ? 'En camino' : 'Paseando'}
                        {walk.address && ` · ${walk.address.street}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {walk.status === 'accepted' && (
                      <button
                        onClick={() => handlePetAhoraStatus(walk.id, 'en_camino')}
                        disabled={updatingPetAhoraId === walk.id}
                        className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all"
                        style={{ background: 'rgba(59,130,246,0.1)', color: '#3b82f6' }}
                      >
                        {updatingPetAhoraId === walk.id ? <Loader2 className="animate-spin" size={12} /> : 'En camino'}
                      </button>
                    )}
                    {walk.status === 'en_camino' && (
                      <button
                        onClick={() => setPetAhoraPhoto({ requestId: walk.id, mode: 'check_in' })}
                        className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all"
                        style={{ background: 'rgba(5,150,105,0.1)', color: '#059669' }}
                      >
                        Iniciar paseo
                      </button>
                    )}
                    {walk.status === 'paseando' && (
                      <button
                        onClick={() => setPetAhoraPhoto({ requestId: walk.id, mode: 'check_out' })}
                        className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all"
                        style={{ background: 'rgba(5,150,105,0.15)', color: '#059669' }}
                      >
                        Completar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

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
                      <PersonStanding size={16} className="text-success-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{res.petName}</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{res.service} · {res.arrivalWindowStart ? `${res.arrivalWindowStart}${res.arrivalWindowEnd ? `-${res.arrivalWindowEnd}` : ''}` : res.time}</p>
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
            <CalendarDays className="text-3xl mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
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
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${STATUS_COLORS[res.status]?.bg || 'bg-brand-500/10'}`}>
                      {res.status === 'completed' ? <CheckCircle2 size={14} className="text-success-400" /> :
                       res.status === 'in_progress' ? <PersonStanding size={14} className="text-success-400" /> :
                       <Dog size={14} className={STATUS_COLORS[res.status]?.text || 'text-brand-400'} />}
                    </div>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{res.petName}</p>
                      <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                        <span>{res.service}</span>
                        <span>·</span>
                        <span className="flex items-center gap-1"><Clock size={9} /> {res.arrivalWindowStart ? `${res.arrivalWindowStart}${res.arrivalWindowEnd ? `-${res.arrivalWindowEnd}` : ''}` : res.time}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {res.status === 'assigned' && (
                      <button
                        onClick={() => handleStatusUpdate(res.id, 'on_the_way')}
                        disabled={updatingId === res.id}
                        className="text-xs px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 font-medium transition-all hover:bg-blue-500/20"
                      >
                        {updatingId === res.id ? <Loader2 className="animate-spin" size={12} /> : 'En camino'}
                      </button>
                    )}
                    {res.status === 'pending' && (
                      <button
                        onClick={() => handleStatusUpdate(res.id, 'on_the_way')}
                        disabled={updatingId === res.id}
                        className="text-xs px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 font-medium transition-all hover:bg-blue-500/20"
                      >
                        {updatingId === res.id ? <Loader2 className="animate-spin" size={12} /> : 'En camino'}
                      </button>
                    )}
                    {res.status === 'on_the_way' && (
                      <button
                        onClick={() => setWalkModal({ reservation: res, mode: 'check_in' })}
                        className="text-xs px-3 py-1.5 rounded-lg bg-brand-500/10 text-brand-400 font-medium transition-all hover:bg-brand-500/20"
                      >
                        Llegué
                      </button>
                    )}
                    {res.phone && (
                      <button
                        onClick={() => openWhatsApp(res.phone)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-success-500/10 text-success-400"
                        title="WhatsApp"
                      >
                        <WhatsAppIcon width={13} height={13} />
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Service Order Sessions (Weekly Packages) */}
      {todaySessions.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <Package size={12} className="text-accent-400" />
            Sesiones de paquete ({todaySessions.length})
          </h2>
          <div className="space-y-2">
            {todaySessions.map((session) => (
              <div
                key={session.id}
                className="rounded-xl p-3 flex items-center gap-3"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
              >
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                  STATUS_COLORS[session.sessionStatus as SessionStatus]?.bg || 'bg-accent-500/10'
                }`}>
                  {session.sessionStatus === 'in_progress' ? <PersonStanding size={14} className={STATUS_COLORS[session.sessionStatus as SessionStatus]?.text || 'text-accent-400'} /> :
                   <Dog size={14} className={STATUS_COLORS[session.sessionStatus as SessionStatus]?.text || 'text-accent-400'} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{session.dogName}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {session.serviceName} · {session.arrivalWindowStart ? `${session.arrivalWindowStart}${session.arrivalWindowEnd ? `-${session.arrivalWindowEnd}` : ''}` : session.startTime}
                  </p>
                </div>
                <span className={`text-2xs px-2 py-0.5 rounded-full font-medium ${
                  STATUS_COLORS[session.sessionStatus as SessionStatus]?.bg || 'bg-white/10'
                } ${STATUS_COLORS[session.sessionStatus as SessionStatus]?.text || 'text-[var(--text-muted)]'}`}>
                  {STATUS_LABELS[session.sessionStatus as SessionStatus] || session.sessionStatus}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Walk Session Modal */}
      <WalkSessionModal
        isOpen={!!walkModal}
        onClose={() => setWalkModal(null)}
        reservation={walkModal?.reservation || ({} as Reservation)}
        mode={walkModal?.mode || 'check_in'}
      />

      {/* PET Ahora Photo Modal */}
      <PetAhoraPhotoModal
        isOpen={!!petAhoraPhoto}
        onClose={() => setPetAhoraPhoto(null)}
        requestId={petAhoraPhoto?.requestId || ''}
        mode={petAhoraPhoto?.mode || 'check_in'}
        onDone={() => setPetAhoraPhoto(null)}
      />
    </div>
  )
}

import { WhatsAppIcon } from '@/components/ui/SocialIcons'
