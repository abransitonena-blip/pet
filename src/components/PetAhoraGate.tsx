'use client'

import { ReactNode } from 'react'
import Link from 'next/link'
import { Lock, AlertTriangle, Dog, MapPin, PersonStanding } from 'lucide-react'
import { useConfig } from '@/context/ConfigContext'
import { useEligibility, type EligibilityResult } from '@/lib/useEligibility'

export default function PetAhoraGate({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  const { config } = useConfig()
  const eligibility = useEligibility()

  if (!config.features.petAhoraEnabled) {
    return null
  }

  if (eligibility.loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <span className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin" style={{ color: 'var(--text-muted)' }} />
      </div>
    )
  }

  if (!eligibility.eligible) {
    return fallback ?? <EligibilityBlocked reasons={eligibility.reasons} result={eligibility} />
  }

  return <>{children}</>
}

function EligibilityBlocked({ reasons, result }: { reasons: string[]; result: EligibilityResult }) {
  return (
    <div className="glass-card p-6 text-center">
      <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: 'var(--glass-bg)', border: '1px solid var(--border)' }}>
        <Lock className="text-secondary" size={20} />
      </div>
      <h3 className="text-lg font-bold mb-2">PET Ahora no disponible</h3>
      <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
        Completa los siguientes requisitos para acceder a paseos al instante:
      </p>
      <div className="space-y-2 text-left max-w-xs mx-auto mb-4">
        <Requirement met={result.hasPet} label="Registrar un perro" href="/mi-cuenta/perros" icon={<Dog size={12} />} />
        <Requirement met={result.hasAddress} label="Agregar dirección" href="/mi-cuenta/direcciones" icon={<MapPin size={12} />} />
        <Requirement met={result.hasCompletedWalk} label="Completar primer paseo" href="/#reservar" icon={<PersonStanding size={12} />} />
      </div>
      <div className="text-xs px-3 py-2 rounded-lg" style={{ background: 'rgba(245,158,11,0.1)', color: 'var(--text-muted)', border: '1px solid rgba(245,158,11,0.2)' }}>
        <AlertTriangle size={10} className="inline mr-1 text-amber-500" />
        PET Ahora requiere tener perro registrado, dirección guardada y al menos un paseo completado anteriormente.
      </div>
    </div>
  )
}

function Requirement({ met, label, href, icon }: { met: boolean; label: string; href: string; icon: ReactNode }) {
  return (
    <Link href={href} className="flex items-center gap-2 p-2 rounded-lg text-xs transition-colors hover:bg-white/[0.03]" style={{ color: met ? 'var(--color-success)' : 'var(--text-muted)' }}>
      <span className={`w-5 h-5 rounded-full flex items-center justify-center ${met ? 'bg-success-500/20 text-success-500' : 'bg-white/5'}`}>
        {met ? '✓' : icon}
      </span>
      <span className="flex-1">{met ? label : label}</span>
      {!met && <span className="text-2xs uppercase tracking-wider" style={{ color: 'var(--color-primary)' }}>Ir</span>}
    </Link>
  )
}
