'use client'

import { motion } from 'framer-motion'
import { usePetAhoraDispatch } from '@/lib/usePetAhoraDispatch'
import { formatEta } from '@/lib/eta'
import { FaBolt, FaDog, FaMapMarkerAlt, FaCheck, FaTimes, FaExclamationTriangle } from 'react-icons/fa'
import type { PetAhoraOffer, PetAhoraRequest } from '@/types'

interface Props {
  offer: PetAhoraOffer & { request?: PetAhoraRequest }
  onDone: () => void
}

export default function PetAhoraOfferCard({ offer, onDone }: Props) {
  const { acceptOffer, declineOffer } = usePetAhoraDispatch()

  const handleAccept = async () => {
    const ok = await acceptOffer(offer.id, offer.requestId, offer.walkerId)
    if (ok) onDone()
  }

  const handleDecline = async () => {
    await declineOffer(offer.id, offer.requestId)
    onDone()
  }

  const expiresIn = Math.max(0, Math.floor((offer.expiresAt.seconds * 1000 - Date.now()) / 1000))
  const expired = expiresIn <= 0

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: -10 }}
      animate={{ opacity: expired ? 0.4 : 1, scale: 1, y: 0 }}
      className="glass-card p-4 border border-secondary/20"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(251,191,36,0.15)' }}>
          <FaBolt className="text-secondary" size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <h4 className="text-sm font-bold">PET Ahora</h4>
            {!expired && (
              <span className="text-xs font-mono" style={{ color: expiresIn < 10 ? 'var(--color-danger)' : 'var(--text-muted)' }}>
                {expiresIn}s
              </span>
            )}
          </div>
          {offer.request && (
            <div className="space-y-1 mb-2">
              <p className="flex items-center gap-1.5 text-sm">
                <FaDog size={10} style={{ color: 'var(--text-muted)' }} />
                {offer.request.petName}
              </p>
              {offer.request.address && (
                <p className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                  <FaMapMarkerAlt size={9} />
                  {offer.request.address.street}
                </p>
              )}
            </div>
          )}
          {offer.etaMinutes != null && (
            <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
              ETA: {formatEta(offer.etaMinutes)}
            </p>
          )}
          {expired ? (
            <p className="text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
              <FaExclamationTriangle size={10} /> Oferta expirada
            </p>
          ) : (
            <div className="flex gap-2">
              <button onClick={handleAccept} className="flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 text-white" style={{ background: 'var(--color-primary)' }}>
                <FaCheck size={10} /> Aceptar
              </button>
              <button onClick={handleDecline} className="flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5" style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--color-danger)' }}>
                <FaTimes size={10} /> Rechazar
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

export function PetAhoraOffersList({ offers, onDone }: { offers: (PetAhoraOffer & { request?: PetAhoraRequest })[]; onDone: () => void }) {
  if (offers.length === 0) return null

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
        <FaBolt size={10} /> Solicitudes PET Ahora
      </h3>
      {offers.map((o) => (
        <PetAhoraOfferCard key={o.id} offer={o} onDone={onDone} />
      ))}
    </div>
  )
}
