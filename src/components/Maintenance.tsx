'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Clock } from 'lucide-react'
import { Logo } from '@/components/ui/Logo'
import { useConfig } from '@/context/ConfigContext'
import { isMaintenanceBlockedPath } from '@/lib/maintenance'
import { getWhatsAppLink } from '@/lib/utils'

/**
 * Modo mantenimiento, encendido desde Configuración → Mantenimiento.
 *
 * It closes the public, informational pages and pauses new bookings. What
 * people need to keep working stays open: staff and walker panels, the family
 * panel with its scheduled walks, login, cancellations and the legal pages --
 * the privacy notice has to stay reachable no matter what.
 *
 * The switch arrives with the site config from Firestore, so a public page can
 * show for a moment before this screen replaces it. With maintenance off, the
 * normal case, nothing waits on it.
 */

export function MaintenanceScreen() {
  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4 py-12" style={{ background: 'var(--bg-primary)' }}>
      <div className="w-full max-w-md space-y-5 rounded-2xl border border-ink/10 bg-surface p-8 text-center shadow-sm">
        <div className="flex justify-center">
          <Logo size={56} />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-bold text-ink">Estamos en mantenimiento</h1>
          <p className="text-sm text-muted">Volvemos pronto. Los paseos que ya están agendados no se ven afectados.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link href="/login" className="btn-primary inline-flex min-h-11 items-center justify-center">
            Entrar a Familia PET
          </Link>
          <a
            href={getWhatsAppLink('Hola, vi que PET Ap está en mantenimiento y tengo una duda.')}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-ink/10 px-4 text-sm font-semibold text-ink transition-colors hover:bg-ink/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Escríbenos por WhatsApp
          </a>
        </div>
        <p className="text-xs text-muted">
          <Link href="/privacidad" className="underline underline-offset-2">Aviso de privacidad</Link>
        </p>
      </div>
    </div>
  )
}

/** Shown where a new walk would be booked, scheduled or PET Ahora. */
export function BookingPausedNotice() {
  return (
    <div role="status" className="rounded-2xl border border-ink/10 bg-surface p-6 text-center shadow-sm">
      <Clock className="mx-auto mb-3 text-muted" size={24} aria-hidden="true" />
      <h2 className="text-lg font-bold text-ink">Las reservas nuevas están en pausa</h2>
      <p className="mt-1 text-sm text-muted">
        Estamos en mantenimiento. Tus paseos ya agendados siguen en pie y puedes consultarlos en tu historial.
      </p>
      <Link
        href="/familia/historial"
        className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-primary/10 px-4 text-sm font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        Ver mi historial
      </Link>
    </div>
  )
}

export function MaintenanceGate({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const { config } = useConfig()
  if (config.maintenance === true && isMaintenanceBlockedPath(pathname)) return <MaintenanceScreen />
  return <>{children}</>
}
