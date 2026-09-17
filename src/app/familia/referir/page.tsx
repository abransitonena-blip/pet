'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { getCustomerProfile } from '@/lib/customerProfile'
import { auth } from '@/firebase/config'
import { db } from '@/firebase/db'
import { onAuthStateChanged } from 'firebase/auth'
import { motion } from 'framer-motion'
import { ArrowLeft, UserPlus, Users, CheckCircle2, Clock, Gift } from 'lucide-react'
import ReferralSection from '@/components/ReferralSection'
import { FEATURE_FLAGS } from '@/lib/featureFlags'
import { Button, Card } from '@/components/ui'

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
      const profile = await getCustomerProfile(user.uid)
      if (profile) setPhone(profile.phone || '')
      setLoading(false)
    })
    return unsub
  }, [router])

  useEffect(() => {
    if (!FEATURE_FLAGS.AUTOMATIC_REFERRALS_ENABLED) return
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
        <Button variant="icon" onClick={() => router.push('/familia')} aria-label="Volver al inicio de Familia PET">
          <ArrowLeft size={14} />
        </Button>
        <div>
          <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Recomendar</h1>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Comparte una invitación; las recompensas requieren revisión</p>
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
            { icon: CheckCircle2, label: 'Cliente nuevo', desc: 'Primer paseo pagado y completado' },
            { icon: Gift, label: 'Revisión', desc: 'Crédito promocional sujeto a condiciones' },
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

      {!FEATURE_FLAGS.AUTOMATIC_REFERRALS_ENABLED && (
        <Card className="p-4 text-xs text-muted">
          Las recompensas automáticas están desactivadas. Administración revisará manualmente elegibilidad, límite mensual, vigencia y margen antes de registrar cualquier Crédito PET.
        </Card>
      )}

      {/* Referral stats */}
      {FEATURE_FLAGS.AUTOMATIC_REFERRALS_ENABLED && (
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
        ].map((stat, i) => (
          <Card key={i} className="p-4 text-center">
            <stat.icon size={16} className="mx-auto mb-2 opacity-60" style={{ color: stat.color }} />
            <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{stat.value}</p>
            <p className="text-2xs" style={{ color: 'var(--text-muted)' }}>{stat.label}</p>
          </Card>
        ))}
      </motion.div>
      )}

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
          className="rounded-xl border border-ink/10 bg-surface p-5 text-center shadow-sm"
        >
          <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
            Registra tu WhatsApp en tu perfil para obtener tu link de referido
          </p>
          <Button size="sm" variant="secondary" onClick={() => router.push('/familia/config')}>
            Ir a configuración
          </Button>
        </motion.div>
      )}
    </div>
  )
}
