'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Gift, Star, Award } from 'lucide-react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db, auth } from '@/firebase/config'
import { onAuthStateChanged } from 'firebase/auth'
import Link from 'next/link'
import { FEATURE_FLAGS } from '@/lib/featureFlags'

export default function LoyaltyProgram() {
  const [uid, setUid] = useState<string | null>(null)
  const [loyalty, setLoyalty] = useState<{ points: number; totalWalks: number; freeWalksEarned: number; freeWalksUsed: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) setUid(user.uid)
    })
    return unsub
  }, [])

  useEffect(() => {
    if (!uid) return
    const unsub = onSnapshot(doc(db, 'loyalty', uid), (snap) => {
      setLoyalty(snap.exists() ? snap.data() as typeof loyalty : null)
      setLoadError(false)
      setLoading(false)
    }, () => {
      setLoadError(true)
      setLoading(false)
    })
    return unsub
  }, [uid])

  const totalWalks = loyalty?.totalWalks ?? 0
  const freeAvailable = (loyalty?.freeWalksEarned ?? 0) - (loyalty?.freeWalksUsed ?? 0)
  const canRedeem = freeAvailable > 0

  return (
    <div className="card p-5 sm:p-6">
      <div className="flex items-center gap-2 mb-4">
        <Gift className="text-primary" size={16} />
        <h3 className="text-sm font-semibold text-ink">Programa de lealtad</h3>
      </div>

      {loading ? (
        <div className="space-y-3">
          <div className="skeleton h-4 w-48" />
          <div className="skeleton h-2 rounded-full" />
        </div>
      ) : loadError ? (
        <p className="text-xs text-danger text-center py-4" role="alert">No pudimos consultar tu progreso. Intenta nuevamente más tarde.</p>
      ) : !uid ? (
        <p className="text-xs text-muted text-center py-4">Inicia sesión para ver tu progreso</p>
      ) : totalWalks === 0 ? (
        <div className="text-center py-4">
          <Star className="mx-auto text-muted mb-2" size={24} />
          <p className="text-xs text-muted">Completa tu primer paseo para comenzar</p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted">Paseos pagados y completados registrados: <strong>{totalWalks}</strong></p>
          <p className="text-xs text-muted">Puntos promocionales registrados: <strong>{loyalty?.points ?? 0}</strong></p>

          {canRedeem && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-3 rounded-xl bg-success/10 border border-success/20 mt-3"
            >
              <div className="flex items-start gap-2 mb-2">
                <Award className="text-success shrink-0 mt-0.5" size={16} />
                <div>
                  <p className="text-sm font-semibold text-success">Beneficio registrado pendiente de verificación</p>
                  <p className="text-xs text-muted">Administración verificará manualmente la elegibilidad y las condiciones antes de confirmar cualquier canje.</p>
                </div>
              </div>
              {!FEATURE_FLAGS.LOYALTY_REDEMPTION_ENABLED && (
                <Link href="/familia/ayuda" className="btn-trust w-full mt-2 inline-flex items-center justify-center !py-2 !text-xs">
                  Solicitar revisión manual
                </Link>
              )}
            </motion.div>
          )}
        </div>
      )}

      <p className="text-2xs text-muted text-center mt-4">Los puntos son promocionales y el canje permanece manual durante el MVP.</p>
    </div>
  )
}
