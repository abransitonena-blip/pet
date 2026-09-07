'use client'

import { useEffect, useState } from 'react'
import { Circle, WifiOff } from 'lucide-react'
import { FEATURE_FLAGS } from '@/lib/featureFlags'
import { useWalkerPresence } from '@/lib/useWalkerPresence'

interface WalkerHeartbeatProps {
  walkerId: string
  walkerName: string
}

export default function WalkerHeartbeat({ walkerId, walkerName }: WalkerHeartbeatProps) {
  const enabled = FEATURE_FLAGS.PET_AHORA_ENABLED && Boolean(walkerId)
  const [gpsUnavailable, setGpsUnavailable] = useState(false)

  useWalkerPresence({ walkerId, walkerName, enabled })

  useEffect(() => {
    if (enabled && !navigator.geolocation) setGpsUnavailable(true)
  }, [enabled])

  if (!enabled) {
    return (
      <span
        className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-ink/5 px-3 text-xs font-medium text-muted"
        title="La presencia automática se activará cuando PET Ahora tenga un backend seguro."
      >
        <WifiOff size={13} aria-hidden="true" />
        <span className="hidden sm:inline">Presencia pausada</span>
        <span className="sm:hidden">Pausada</span>
      </span>
    )
  }

  return (
    <span
      className={`inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium ${gpsUnavailable ? 'bg-warning/10 text-amber-800' : 'bg-success/10 text-success-700'}`}
      role="status"
    >
      <Circle size={7} className={gpsUnavailable ? 'fill-amber-600 text-amber-600' : 'fill-success-600 text-success-600'} aria-hidden="true" />
      {gpsUnavailable ? 'Sin GPS' : 'Presencia activa'}
    </span>
  )
}
