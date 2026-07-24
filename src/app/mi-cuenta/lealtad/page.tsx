'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '@/firebase/config'
import { onAuthStateChanged } from 'firebase/auth'
import { motion } from 'framer-motion'
import { FaArrowLeft, FaGift, FaStar, FaCheckCircle, FaDog } from 'react-icons/fa'
import LoyaltyProgram from '@/components/LoyaltyProgram'

export default function LealtadPage() {
  const router = useRouter()
  const [phone, setPhone] = useState('')
  const [userName, setUserName] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { router.push('/login'); return }
      const snap = await getDoc(doc(db, 'clients', user.uid))
      if (snap.exists()) {
        setPhone(snap.data().phone || '')
        setUserName(snap.data().name || 'Familia')
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
        <button
          onClick={() => router.push('/mi-cuenta')}
          className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-white/5"
          style={{ color: 'var(--text-muted)' }}
        >
          <FaArrowLeft size={14} />
        </button>
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
          <FaGift size={16} className="text-brand-400" />
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>¿Cómo funciona?</h2>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: FaDog, label: 'Pasea', desc: 'Disfruta tus paseos' },
            { icon: FaCheckCircle, label: 'Acumula', desc: '10 paseos = 1 gratis' },
            { icon: FaStar, label: 'Canjea', desc: 'Paseo individual gratis' },
          ].map((step, i) => {
            const Icon = step.icon
            return (
              <div key={i} className="text-center">
                <div className="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center mx-auto mb-2">
                  <Icon size={16} className="text-brand-400" />
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
        transition={{ delay: 0.1 }}
      >
        <LoyaltyProgram phone={phone} />
      </motion.div>

      {/* No phone warning */}
      {!phone && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-2xl p-5 text-center"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
        >
          <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
            Registra tu WhatsApp en tu perfil para ver tu progreso de lealtad
          </p>
          <button
            onClick={() => router.push('/mi-cuenta/config')}
            className="text-xs px-4 py-2 rounded-lg transition-colors hover:bg-white/5"
            style={{ color: 'var(--color-primary)', border: '1px solid var(--color-primary)' }}
          >
            Ir a configuración
          </button>
        </motion.div>
      )}
    </div>
  )
}
