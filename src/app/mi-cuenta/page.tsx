'use client'

import { useState, useEffect } from 'react'
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore'
import { auth, db } from '@/firebase/config'
import { onAuthStateChanged } from 'firebase/auth'
import { motion } from 'framer-motion'
import { FaCalendarAlt, FaDog, FaClock, FaMapMarkerAlt } from 'react-icons/fa'
import type { Reservation } from '@/types'

export default function MisReservasPage() {
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) return
      const q = query(
        collection(db, 'reservations'),
        where('uid', '==', user.uid),
        orderBy('createdAt', 'desc')
      )
      const unsubRes = onSnapshot(q, (snap) => {
        setReservations(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Reservation)))
        setLoading(false)
      })
      return unsubRes
    })
    return unsub
  }, [])

  return (
    <div>
      <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Mis reservas</h2>
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="skeleton h-20 rounded-xl" />)}
        </div>
      ) : reservations.length === 0 ? (
        <div className="rounded-2xl p-8 text-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <FaCalendarAlt className="text-3xl mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No tienes reservas aún</p>
          <a href="/#reservar" className="btn-primary inline-flex mt-4 text-xs">Reservar ahora</a>
        </div>
      ) : (
        <div className="space-y-3">
          {reservations.map((res) => (
            <div key={res.id} className="rounded-2xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center">
                    <FaDog size={16} className="text-brand-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{res.service}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{res.petName} · {res.date}</p>
                  </div>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                  res.status === 'completed' ? 'bg-success-500/15 text-success-400' :
                  res.status === 'pending' ? 'bg-brand-500/15 text-brand-400' :
                  'bg-white/10 text-slate-400'
                }`}>
                  {res.status === 'completed' ? 'Completado' : res.status === 'pending' ? 'Pendiente' : res.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
