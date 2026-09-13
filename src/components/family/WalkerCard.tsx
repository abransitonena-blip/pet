'use client'

import { UserRound } from 'lucide-react'
import { useWalkerPhoto } from '@/lib/useWalkerPhoto'

/**
 * Quién va a tocar la puerta.
 *
 * Una familia entrega su perro a alguien que hasta ahora era "el paseador
 * asignado". Ver su nombre y su cara antes de abrir es lo que convierte eso en
 * una persona.
 *
 * Se pide por el paseo, no por el paseador: el servidor comprueba que ese paseo
 * sea de quien pregunta. Si el paseador todavía no subió foto, queda su nombre,
 * que ya es algo; si no hay ni nombre, la tarjeta no se muestra.
 */
export default function WalkerCard({ sessionId }: { sessionId: string }) {
  const walker = useWalkerPhoto({ sessionId })

  if (!walker) return null

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-ink/10 bg-surface p-3">
      <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full bg-primary/10 text-primary">
        {walker.photoUrl
          ? <img src={walker.photoUrl} alt={`Foto de ${walker.name}`} className="h-full w-full object-cover" />
          : <UserRound size={22} aria-hidden="true" />}
      </span>
      <div className="min-w-0">
        <p className="text-2xs font-semibold uppercase tracking-wide text-muted">Tu paseador</p>
        <p className="truncate text-sm font-semibold text-ink">{walker.name}</p>
      </div>
    </div>
  )
}
