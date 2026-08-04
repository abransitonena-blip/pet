'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { formatEta } from '@/lib/eta'
import { Zap, Dog, MapPin, CheckCircle2, Loader2, XCircle, PersonStanding } from 'lucide-react'
import type { PetAhoraRequest } from '@/types'

interface Props {
  request: PetAhoraRequest
}

const STATUS_FLOW: Record<string, { label: string; icon: any; step: number }> = {
  pending: { label: 'Pendiente', icon: Loader2, step: 0 },
  searching: { label: 'Buscando paseador', icon: Zap, step: 1 },
  offer_sent: { label: 'Oferta enviada', icon: Zap, step: 2 },
  accepted: { label: 'Aceptado', icon: CheckCircle2, step: 3 },
  en_camino: { label: 'Paseador en camino', icon: PersonStanding, step: 4 },
  paseando: { label: 'Paseando', icon: Dog, step: 5 },
  completed: { label: 'Completado', icon: CheckCircle2, step: 6 },
  cancelled: { label: 'Cancelado', icon: XCircle, step: -1 },
  expired: { label: 'Expirado', icon: XCircle, step: -1 },
}

export default function PetAhoraStatusTracker({ request }: Props) {
  const statusInfo = STATUS_FLOW[request.status] || STATUS_FLOW.pending
  const isDone = request.status === 'completed'
  const isFailed = request.status === 'cancelled' || request.status === 'expired'
  const totalSteps = 6

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-6"
    >
      <div className="flex items-center gap-3 mb-5">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center"
          style={{ background: isFailed ? 'rgba(239,68,68,0.1)' : 'rgba(251,191,36,0.15)' }}
        >
          {isDone || isFailed ? (
            <statusInfo.icon size={22} style={{ color: isFailed ? 'var(--color-danger)' : '#22c55e' }} />
          ) : (
            <span className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" style={{ color: 'var(--color-primary)' }} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-sm">{isFailed ? statusInfo.label : statusInfo.label}</h3>
          {request.walkerName && (
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Paseador: {request.walkerName}</p>
          )}
          {request.walkerEta != null && request.status === 'en_camino' && (
            <p className="text-xs font-semibold" style={{ color: 'var(--color-primary)' }}>
              Llega en {formatEta(request.walkerEta)}
            </p>
          )}
        </div>
      </div>

      {!isDone && !isFailed && (
        <div className="flex items-center gap-1 mb-3">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className="flex-1 h-1.5 rounded-full transition-colors"
              style={{
                background: i < statusInfo.step ? 'var(--color-primary)' : 'var(--border-color)',
              }}
            />
          ))}
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <Dog size={11} style={{ color: 'var(--text-muted)' }} />
          <span>{request.petName}</span>
        </div>
        {request.address && (
          <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
            <MapPin size={10} />
            <span>{request.address.alias || request.address.street}</span>
          </div>
        )}
      </div>
    </motion.div>
  )
}

export function PetAhoraActiveRequest({ requestId, request }: { requestId: string; request: PetAhoraRequest }) {
  return (
    <AnimatePresence>
      <PetAhoraStatusTracker request={request} />
    </AnimatePresence>
  )
}
