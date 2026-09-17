'use client'

import { useState, useEffect } from 'react'
import { db } from '@/firebase/db'
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore'
import { Share2, Check, Copy, Users, Loader2 } from 'lucide-react'
import { FEATURE_FLAGS } from '@/lib/featureFlags'
import { confirmWhatsAppShare } from '@/lib/utils'

function generateReferralCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

export default function ReferralSection({ phone, uid }: { phone?: string; uid?: string }) {
  const [copied, setCopied] = useState(false)
  const [referralLink, setReferralLink] = useState<string | null>(null)
  const [referralMessage, setReferralMessage] = useState<string | null>(null)
  const [referralCode, setReferralCode] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (!phone || !uid) return

    if (!FEATURE_FLAGS.AUTOMATIC_REFERRALS_ENABLED) {
      setReferralLink(`${window.location.origin}/`)
      setReferralMessage('🐾 Te recomiendo PET Ap. Conoce sus paseos programados aquí: ' + window.location.origin)
      return
    }

    const loadOrCreateCode = async () => {
      // Check if user already has a referral code
      const q = query(collection(db, 'referrals'), where('referrerUid', '==', uid), where('active', '==', true))
      const snap = await getDocs(q)

      if (!snap.empty) {
        const existing = snap.docs[0].data()
        setReferralCode(existing.code)
      } else {
        // Create new referral code
        setCreating(true)
        const code = generateReferralCode()
        await addDoc(collection(db, 'referrals'), {
          referrerUid: uid,
          referrerPhone: phone,
          code,
          active: true,
          totalReferred: 0,
          totalRewards: 0,
          createdAt: serverTimestamp(),
        })
        setReferralCode(code)
        setCreating(false)
      }
    }

    loadOrCreateCode()
  }, [phone, uid])

  useEffect(() => {
    if (!referralCode) return
    const link = `${window.location.origin}?ref=${referralCode}`
    setReferralLink(link)
    setReferralMessage(`🐾 Te recomiendo PET Ap para solicitar paseos caninos programados. Conoce el servicio aquí: ${link}`)
  }, [referralCode])

  const copyLink = () => {
    if (!referralLink) return
    navigator.clipboard.writeText(referralLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 3000)
  }

  const shareWhatsApp = () => {
    if (!referralMessage) return
    confirmWhatsAppShare('', referralMessage)
  }

  return (
    <div className="glass-card p-5 sm:p-6">
      <div className="flex items-center gap-2 mb-3">
        <Users className="text-primary" size={16} />
        <h3 className="text-sm font-semibold text-ink">Recomienda y gana</h3>
      </div>

      {!phone ? (
        <p className="text-xs text-muted text-center py-4">
          Registra tu WhatsApp para obtener tu link de referido
        </p>
      ) : creating ? (
        <p className="text-xs text-muted text-center py-4 flex items-center justify-center gap-2">
          <Loader2 className="animate-spin" size={12} /> Generando tu código...
        </p>
      ) : (
        <>
          <p className="text-xs text-muted mb-4 leading-relaxed">
            Puedes compartir PET Ap. Cualquier crédito promocional está sujeto a revisión: cliente realmente nuevo, primer paseo pagado y completado, máximo 10 recompensas mensuales, vigencia de 15 días y margen mínimo. No es efectivo ni transferible.
          </p>

          <div className="flex items-center gap-2 bg-ink/5 rounded-xl px-3 py-2.5 mb-3">
            <span className="text-xs text-muted truncate flex-1">{referralLink}</span>
            <button
              onClick={copyLink}
              className="shrink-0 text-xs px-2.5 py-1 rounded-lg bg-primary/20 text-primary-hover hover:bg-primary/30 transition-all"
            >
              {copied ? <Check size={11} /> : <Copy size={11} />}
            </button>
          </div>

          {referralCode && <div className="flex items-center justify-center gap-1 mb-3">
            <span className="text-2xs" style={{ color: 'var(--text-muted)' }}>Código:</span>
            <span className="text-xs font-mono font-bold text-primary">{referralCode}</span>
          </div>}

          <button
            onClick={shareWhatsApp}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold bg-green-500/20 hover:bg-green-500/30 transition-all" style={{ color: 'var(--color-success)' }}
          >
            <Share2 size={12} />
            Compartir por WhatsApp
          </button>
        </>
      )}
    </div>
  )
}
