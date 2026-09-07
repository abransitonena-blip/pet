'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getCustomerProfile } from '@/lib/customerProfile'
import { auth } from '@/firebase/config'
import { onAuthStateChanged } from 'firebase/auth'
import { motion } from 'framer-motion'
import { ArrowLeft, Gift, Star, CheckCircle2, Dog } from 'lucide-react'
import LoyaltyProgram from '@/components/LoyaltyProgram'
import { Button } from '@/components/ui'

export default function LealtadPage() {
  const router = useRouter()
  const [phone, setPhone] = useState('')
  const [, setUserName] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { router.push('/login'); return }
      const profile = await getCustomerProfile(user.uid)
      if (profile) {
        setPhone(profile.phone || '')
        setUserName(profile.name || 'Familia')
      }
      setLoading(false)
    })
    return unsub
  }, [router])

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
        <Button
          variant="icon"
          onClick={() => router.push('/familia')}
          aria-label="Volver al inicio de Familia PET"
        >
          <ArrowLeft size={14} />
        </Button>
        <div>
          <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Mi lealtad</h1>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Programa de recompensas</p>
        </div>
      </div>

      {/* How it works */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl p-5"
        style={{ background: 'linear-gradient(135deg, rgba(217,119,6,0.1), rgba(217,119,6,0.05))', border: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-2 mb-3">
          <Gift size={16} className="text-brand-600" />
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>¿Cómo funciona?</h2>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: Dog, label: 'Pasea', desc: 'Disfruta tus paseos' },
            { icon: CheckCircle2, label: 'Registra', desc: 'Solo paseos pagados y completados' },
            { icon: Star, label: 'Solicita', desc: 'Administración revisa el beneficio' },
          ].map((step, i) => {
            const Icon = step.icon
            return (
              <div key={i} className="text-center">
                <div className="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center mx-auto mb-2">
                  <Icon size={16} className="text-brand-600" />
                </div>
                <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{step.label}</p>
                <p className="text-2xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{step.desc}</p>
              </div>
            )
          })}
        </div>
      </motion.div>

      {/* Loyalty Progress */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, delay: 0.1 }}
      >
        <LoyaltyProgram />
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
            Registra tu WhatsApp en tu perfil para ver tu progreso de lealtad
          </p>
          <Button size="sm" variant="secondary" onClick={() => router.push('/familia/config')}>
            Ir a configuración
          </Button>
        </motion.div>
      )}
    </div>
  )
}
