'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { FaShare, FaCheck, FaCopy, FaUsers } from 'react-icons/fa'

export default function ReferralSection({ phone }: { phone?: string }) {
  const [copied, setCopied] = useState(false)
  const [referralLink, setReferralLink] = useState<string | null>(null)
  const [referralMessage, setReferralMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!phone) return
    const link = `${window.location.origin}?ref=${phone.replace(/\D/g, '')}`
    setReferralLink(link)
    setReferralMessage(`🐾 ¡Te recomiendo PET Ap! Paseos caninos supervisados. Agenda aquí: ${link}`)
  }, [phone])

  const copyLink = () => {
    if (!referralLink) return
    navigator.clipboard.writeText(referralLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 3000)
  }

  const shareWhatsApp = () => {
    if (!referralMessage) return
    window.open(`https://wa.me/?text=${encodeURIComponent(referralMessage)}`, '_blank')
  }

  return (
    <div className="glass-card p-5 sm:p-6">
      <div className="flex items-center gap-2 mb-3">
        <FaUsers className="text-primary" size={16} />
        <h3 className="text-sm font-semibold text-white">Recomienda y gana</h3>
      </div>

      {!phone ? (
        <p className="text-xs text-white/30 text-center py-4">
          Registra tu WhatsApp para obtener tu link de referido
        </p>
      ) : (
        <>
          <p className="text-xs text-white/50 mb-4 leading-relaxed">
            Invita a tus amigos y por cada persona que agende un paseo con tu link, ambos reciben <span className="text-primary font-medium">$20 de descuento</span> 🐾
          </p>

          <div className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2.5 mb-3">
            <span className="text-xs text-white/30 truncate flex-1">{referralLink}</span>
            <button
              onClick={copyLink}
              className="shrink-0 text-xs px-2.5 py-1 rounded-lg bg-primary/20 text-primary hover:bg-primary/30 transition-all"
            >
              {copied ? <FaCheck size={11} /> : <FaCopy size={11} />}
            </button>
          </div>

          <button
            onClick={shareWhatsApp}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold bg-green-500/20 hover:bg-green-500/30 transition-all" style={{ color: 'var(--color-success)' }}
          >
            <FaShare size={12} />
            Compartir por WhatsApp
          </button>
        </>
      )}
    </div>
  )
}
