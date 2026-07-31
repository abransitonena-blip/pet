'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Gift, Star, Dog, CheckCircle, Award, Sparkles } from 'lucide-react'
import { doc, onSnapshot, updateDoc, increment } from 'firebase/firestore'
import { db, auth } from '@/firebase/config'
import { onAuthStateChanged } from 'firebase/auth'
import { getFunctions, httpsCallable } from 'firebase/functions'

const FREE_AFTER = 10

export default function LoyaltyProgram() {
  const [uid, setUid] = useState<string | null>(null)
  const [loyalty, setLoyalty] = useState<{ points: number; totalWalks: number; freeWalksEarned: number; freeWalksUsed: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [redeeming, setRedeeming] = useState(false)
  const [redeemMsg, setRedeemMsg] = useState('')

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) setUid(user.uid)
    })
    return unsub
  }, [])

  useEffect(() => {
    if (!uid) return
    const unsub = onSnapshot(doc(db, 'loyalty', uid), (snap) => {
      if (snap.exists()) {
        setLoyalty(snap.data() as typeof loyalty)
      }
      setLoading(false)
    })
    return unsub
  }, [uid])

  const totalWalks = loyalty?.totalWalks ?? 0
  const cycle = totalWalks % FREE_AFTER
  const freeAvailable = (loyalty?.freeWalksEarned ?? 0) - (loyalty?.freeWalksUsed ?? 0)
  const canRedeem = freeAvailable > 0

  const handleRedeem = async () => {
    if (!canRedeem || !uid) return
    setRedeeming(true)
    setRedeemMsg('')
    try {
      const functions = getFunctions()
      const redeemFn = httpsCallable(functions, 'redeemFreeWalk')
      await redeemFn({ uid })
      setRedeemMsg('✅ Paseo gratis canjeado! Te contactaremos para agendarlo.')
    } catch {
      setRedeemMsg('Error al canjear. Intenta de nuevo.')
    } finally {
      setRedeeming(false)
    }
  }

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
      ) : !uid ? (
        <p className="text-xs text-muted text-center py-4">Inicia sesión para ver tu progreso</p>
      ) : totalWalks === 0 ? (
        <div className="text-center py-4">
          <Star className="mx-auto text-muted mb-2" size={24} />
          <p className="text-xs text-muted">Completa tu primer paseo para comenzar</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted">
              {totalWalks} paseo{totalWalks !== 1 ? 's' : ''} completado{totalWalks !== 1 ? 's' : ''}
            </span>
            <span className="text-primary font-semibold">
              {cycle}/{FREE_AFTER}
            </span>
          </div>

          <div className="flex items-center gap-1">
            {Array.from({ length: FREE_AFTER }).map((_, i) => (
              <div key={i} className="flex-1">
                <div className={`h-2 rounded-full transition-all ${i < cycle ? 'bg-primary' : 'bg-border'}`} />
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-muted">
              {cycle === 0 ? '¡Siguiente paseo = gratis!' : `Faltan ${FREE_AFTER - cycle} para tu paseo gratis`}
            </span>
          </div>

          {canRedeem && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-3 rounded-xl bg-success/10 border border-success/20 mt-3"
            >
              <div className="flex items-start gap-2 mb-2">
                <Award className="text-success shrink-0 mt-0.5" size={16} />
                <div>
                  <p className="text-sm font-semibold text-success">Paseo{freeAvailable > 1 ? 's' : ''} gratis disponible{freeAvailable > 1 ? 's' : ''}</p>
                  <p className="text-xs text-muted">Tienes {freeAvailable} paseo{freeAvailable !== 1 ? 's' : ''} gratis para canjear. Sin costo, sin compromiso.</p>
                </div>
              </div>
              <button
                onClick={handleRedeem}
                disabled={redeeming}
                className="btn-trust w-full mt-2 inline-flex items-center justify-center gap-2 !py-2 !text-xs"
              >
                {redeeming ? (
                  <span className="flex items-center gap-2">
                    <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Canjeando...
                  </span>
                ) : (
                  <>
                    <Sparkles size={12} />
                    Canjear paseo gratis
                  </>
                )}
              </button>
              {redeemMsg && (
                <p className="text-xs mt-2 text-center text-muted">{redeemMsg}</p>
              )}
            </motion.div>
          )}
        </div>
      )}

      <p className="text-2xs text-muted text-center mt-4">
        {FREE_AFTER} paseos completados = 1 paseo individual gratis
      </p>
    </div>
  )
}
