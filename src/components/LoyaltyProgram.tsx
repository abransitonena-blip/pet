'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { FaStar, FaGift, FaDog, FaCheckCircle } from 'react-icons/fa'
import { db } from '@/firebase/config'
import { collection, query, where, getDocs } from 'firebase/firestore'

const FREE_AFTER = 10

export default function LoyaltyProgram({ phone }: { phone?: string }) {
  const [count, setCount] = useState<number | null>(null)
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    if (!phone || phone.replace(/\D/g, '').length < 10) return
    setChecking(true)
    const q = query(collection(db, 'reservations'), where('phone', '==', phone), where('status', '==', 'completed'))
    getDocs(q)
      .then((snap) => setCount(snap.size))
      .catch(() => setCount(0))
      .finally(() => setChecking(false))
  }, [phone])

  const progress = count !== null ? Math.min(count / FREE_AFTER, 1) : 0
  const remaining = count !== null ? Math.max(FREE_AFTER - count, 0) : FREE_AFTER
  const earnedFree = count !== null && count > 0 && count % FREE_AFTER === 0

  return (
    <div className="glass-card p-5 sm:p-6">
      <div className="flex items-center gap-2 mb-4">
        <FaGift className="text-secondary" size={16} />
        <h3 className="text-sm font-semibold text-white">Programa de lealtad</h3>
      </div>

      {!phone ? (
        <p className="text-xs text-white/30 text-center py-4">
          Registra tu WhatsApp para ver tu progreso
        </p>
      ) : checking ? (
        <p className="text-xs text-white/30 text-center py-4">Consultando...</p>
      ) : count === null ? (
        <p className="text-xs text-white/30 text-center py-4">Sin información aún</p>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/50">
              {earnedFree ? '🎉 ¡Ganaste un paseo gratis!' : `${count} paseo${count !== 1 ? 's' : ''} completado${count !== 1 ? 's' : ''}`}
            </span>
            <span className="text-primary font-semibold">
              {count}/{FREE_AFTER}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {Array.from({ length: FREE_AFTER }).map((_, i) => (
              <div key={i} className="flex-1">
                <div
                  className={`h-2 rounded-full transition-all ${
                    i < count ? 'bg-gradient-to-r from-primary to-amber-500' : 'bg-white/10'
                  }`}
                />
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1 text-white/40">
              {Array.from({ length: Math.min(count, FREE_AFTER) }).map((_, i) => (
                <FaCheckCircle key={i} size={10} className="text-primary" />
              ))}
              {remaining > 0 && <span>Faltan {remaining} para tu paseo gratis</span>}
            </div>
            {earnedFree && (
              <span className="flex items-center gap-1 text-secondary text-xs font-medium">
                <FaStar size={10} />
                Reclama tu paseo
              </span>
            )}
          </div>
        </div>
      )}

      <p className="text-[10px] text-white/20 text-center mt-4">
        {FREE_AFTER} paseos completados = 1 paseo individual gratis 🐾
      </p>
    </div>
  )
}
