'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { doc, getDoc, collection, query, where, onSnapshot } from 'firebase/firestore'
import { auth, db } from '@/firebase/config'
import { onAuthStateChanged } from 'firebase/auth'
import { motion } from 'framer-motion'
import { ArrowLeft, UserPlus, Users, CheckCircle2, Clock, Gift } from 'lucide-react'
import ReferralSection from '@/components/ReferralSection'

export default function ReferirPage() {
  const router = useRouter()
  const [phone, setPhone] = useState('')
  const [uid, setUid] = useState('')
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ total: 0, completed: 0, pending: 0 })

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { router.push('/login'); return }
      setUid(user.uid)
      const snap = await getDoc(doc(db, 'clients', user.uid))
      if (snap.exists()) setPhone(snap.data().phone || '')
      setLoading(false)
    })
    return unsub
  }, [router])

  useEffect(() => {
    if (!uid) return
    const q = query(collection(db, 'referrals'), where('referrerUid', '==', uid))
    return onSnapshot(q, (snap) => {
      let total = 0, completed = 0, pending = 0
      snap.forEach((doc) => {
        total++
        const data = doc.data()
        if (data.status === 'completed' || data.status === 'rewarded') completed++
        else pending++
      })
      setStats({ total, completed, pending })
    })
  }, [uid])

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-10 w-48 rounded-xl" />
        <div className="skeleton h-40 rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push('/familia')}
          className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-ink/5"
          style={{ color: 'var(--text-muted)' }}
        >
          <ArrowLeft size={14} />
        </button>
        <div>
          <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Recomendar</h1>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Invita amigos y ganen ambos</p>
        </div>
      </div>

      {/* How it works */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl p-5"
        style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.1), rgba(124,58,237,0.05))', border: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-2 mb-3">
          <Gift size={16} className="text-violet-400" />
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>¿Cómo funciona?</h2>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: UserPlus, label: 'Comparte', desc: 'Tu link personal' },
            { icon: CheckCircle2, label: 'Amigo agenda', desc: 'Primer paseo' },
            { icon: Gift, label: 'Ganan ambos', desc: '$20 de descuento' },
          ].map((step, i) => {
            const Icon = step.icon
            return (
              <div key={i} className="text-center">
                <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center mx-auto mb-2">
                  <Icon size={16} className="text-violet-400" />
                </div>
                <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{step.label}</p>
                <p className="text-2xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{step.desc}</p>
              </div>
            )
          })}
        </div>
      </motion.div>

      {/* Referral stats */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, delay: 0.1 }}
        className="grid grid-cols-3 gap-3"
      >
        {[
          { label: 'Enviados', value: stats.total, icon: Users, color: 'var(--color-primary)' },
          { label: 'Completados', value: stats.completed, icon: CheckCircle2, color: 'var(--color-success)' },
          { label: 'Pendientes', value: stats.pending, icon: Clock, color: 'var(--color-warning)' },
        ].map((stat, i) => {
          const Icon = stat.icon
          return (
            <div
              key={i}
              className="rounded-2xl p-4 text-center"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
            >
              <Icon size={16} className="mx-auto mb-2 opacity-60" style={{ color: stat.color }} />
              <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{stat.value}</p>
              <p className="text-2xs" style={{ color: 'var(--text-muted)' }}>{stat.label}</p>
            </div>
          )
        })}
      </motion.div>

      {/* Referral link + share */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, delay: 0.15 }}
      >
        <ReferralSection phone={phone} uid={uid} />
      </motion.div>

      {/* No phone warning */}
      {!phone && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, delay: 0.2 }}
          className="rounded-2xl p-5 text-center"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
        >
          <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
            Registra tu WhatsApp en tu perfil para obtener tu link de referido
          </p>
          <button
            onClick={() => router.push('/familia/config')}
            className="text-xs px-4 py-2 rounded-lg transition-colors hover:bg-ink/5"
            style={{ color: 'var(--color-primary)', border: '1px solid var(--color-primary)' }}
          >
            Ir a configuración
          </button>
        </motion.div>
      )}
    </div>
  )
}
