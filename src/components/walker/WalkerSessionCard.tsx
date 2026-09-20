'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, CalendarDays, Check, ChevronDown, ClipboardList, Clock, Dog, FileText, MapPin, Stethoscope } from 'lucide-react'
import { Button, Card, StatusBadge } from '@/components/ui'
import WalkSheet from '@/components/walker/WalkSheet'
import WalkPhotoButton from '@/components/walker/WalkPhotoButton'
import WalkQuickLog from '@/components/walker/WalkQuickLog'
import type { WalkSession } from '@/types'
import {
  getWalkerTransition,
  WALKER_TIMELINE,
  walkerSessionDate,
  walkerSessionStart,
  walkerSessionStatus,
  walkerTimelinePosition,
} from '@/lib/walkerPanel'

interface WalkerSessionCardProps {
  session: WalkSession
  onAdvance?: (session: WalkSession) => void
  updating?: boolean
  compact?: boolean
  /** Empieza compacta y se abre con un toque: para los paseos que no tocan ahora. */
  collapsible?: boolean
  /** El paseo que toca ahora abre su ficha solo: ahí está a dónde llegar. */
  openSheet?: boolean
}

export default function WalkerSessionCard({ session, onAdvance, updating = false, compact: alwaysCompact = false, collapsible = false, openSheet = false }: WalkerSessionCardProps) {
  const [sheetOpen, setSheetOpen] = useState(openSheet)
  const [expanded, setExpanded] = useState(false)
  const compact = alwaysCompact || (collapsible && !expanded)
  const detailsId = `walk-details-${session.id}`
  const status = walkerSessionStatus(session)
  const transition = getWalkerTransition(status)
  const date = walkerSessionDate(session)
  const start = walkerSessionStart(session)
  const timelinePosition = walkerTimelinePosition(status)
  const arrivalWindow = session.arrivalWindowStart
    ? `${session.arrivalWindowStart}${session.arrivalWindowEnd ? `–${session.arrivalWindowEnd}` : ''}`
    : ''

  // Mientras el paseo está en curso, completar va al final: la bitácora y las
  // fotos se usan muchas veces y no deben quedar debajo del botón que lo cierra.
  const advanceButton = onAdvance && transition ? (
    <div className="mt-4 flex justify-end">
      <Button
        size="sm"
        className="h-11 w-full text-white sm:w-auto"
        onClick={() => onAdvance(session)}
        isLoading={updating}
        aria-label={`${transition.label} para ${session.dogName || 'el paseo asignado'}`}
      >
        {transition.label}
      </Button>
    </div>
  ) : null

  return (
    <Card id={detailsId} className={`p-4 shadow-none hover:shadow-sm ${compact ? 'sm:p-4' : 'sm:p-5'}`}>
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary" aria-hidden="true">
          <Dog size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">{session.dogName || 'Perro asignado'}</p>
              <p className="truncate text-xs text-muted">{session.serviceName || 'Paseo programado'}</p>
            </div>
            {/* `key` en el estado: al avanzar el paseo la insignia se vuelve a
                montar y su animación se repite, que es lo que hace visible el
                cambio sin mover nada más. */}
            <span key={status} className="animate-pop inline-flex items-center gap-1.5">
              {status === 'in_progress' && <span className="animate-live h-2 w-2 shrink-0 rounded-full bg-success-500" aria-hidden="true" />}
              <StatusBadge status={status} />
            </span>
          </div>

          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted">
            <span className="inline-flex items-center gap-1.5"><CalendarDays size={13} />{date || 'Fecha por confirmar'}</span>
            <span className="inline-flex items-center gap-1.5"><Clock size={13} />{start || 'Horario por confirmar'}</span>
            {arrivalWindow && <span className="inline-flex items-center gap-1.5"><Clock size={13} />Llegada {arrivalWindow}</span>}
            {typeof session.duration === 'number' && session.duration > 0 && <span>{session.duration} min</span>}
            {session.zoneName && <span className="inline-flex items-center gap-1.5"><MapPin size={13} />{session.zoneName}</span>}
          </div>

          {!compact && timelinePosition >= 0 && (
            <ol className="mt-4 grid grid-cols-6 gap-1" aria-label="Progreso del paseo">
              {WALKER_TIMELINE.map((item, index) => {
                const reached = index <= timelinePosition
                const current = index === timelinePosition
                return (
                  <li key={item.status} className="min-w-0 text-center" aria-current={current ? 'step' : undefined}>
                    <span className={`mx-auto grid h-7 w-7 place-items-center rounded-full border text-2xs font-bold ${reached ? 'border-primary bg-primary text-white' : 'border-ink/15 bg-surface text-muted'}`}>
                      {index < timelinePosition ? <Check size={12} aria-hidden="true" /> : index + 1}
                    </span>
                    {/* En teléfono la etiqueta sólo se oculta a la vista: el lector
                        de pantalla la sigue leyendo. */}
                    <span className={`sr-only sm:not-sr-only sm:mt-1 sm:block sm:truncate sm:text-2xs ${current ? 'font-semibold text-ink' : 'text-muted'}`}>{item.label}</span>
                  </li>
                )
              })}
            </ol>
          )}
          {!compact && timelinePosition >= 0 && (
            <p className="mt-1 text-xs text-muted sm:hidden" aria-hidden="true">
              Paso {timelinePosition + 1} de {WALKER_TIMELINE.length}: <span className="font-semibold text-ink">{WALKER_TIMELINE[timelinePosition].label}</span>
            </p>
          )}

          {status !== 'in_progress' && advanceButton}
          {!compact && (
            <div className="mt-3 space-y-2">
              <button
                type="button"
                onClick={() => setSheetOpen((open) => !open)}
                aria-expanded={sheetOpen}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-ink/[0.04] px-3 text-sm font-semibold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <Stethoscope size={15} aria-hidden="true" />
                {sheetOpen ? 'Ocultar la ficha del paseo' : 'Ver la ficha del paseo'}
              </button>
              {sheetOpen && (session.startLocation || session.endLocation) && (
                <dl className="grid gap-1 rounded-xl bg-ink/[0.03] px-3 py-2 text-xs sm:grid-cols-2">
                  {([['startLocation', 'Inicio'], ['endLocation', 'Fin']] as const).map(([field, heading]) => (
                    <div key={field} className="flex items-center gap-1.5">
                      <MapPin size={12} className="shrink-0 text-muted" aria-hidden="true" />
                      <dt className="text-muted">{heading}:</dt>
                      <dd className="text-ink">{session[field] ? 'ubicación registrada' : 'sin registrar'}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {sheetOpen && <WalkSheet sessionId={session.id} today={date} />}
            </div>
          )}

          {status === 'in_progress' && !compact && (
            <div className="mt-3">
              <WalkQuickLog sessionId={session.id} />
            </div>
          )}

          {(status === 'arrived' || status === 'in_progress') && (
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Link
                href={`/walker/reportes/${encodeURIComponent(session.id)}#incidencia`}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-danger-500/10 px-5 text-sm font-semibold text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger-500"
              >
                <AlertTriangle size={16} aria-hidden="true" /> Reportar incidencia
              </Link>
              <WalkPhotoButton sessionId={session.id} />
              <Link href={`/walker/reportes/${encodeURIComponent(session.id)}`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary/10 px-5 text-sm font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                <ClipboardList size={16} aria-hidden="true" /> Bitácora del paseo
              </Link>
            </div>
          )}

          {status === 'in_progress' && advanceButton}

          {status === 'completed' && (
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <Link href={`/walker/reportes/${encodeURIComponent(session.id)}`} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary/10 px-4 text-sm font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:w-auto">
                <FileText size={16} aria-hidden="true" /> Reporte del paseo
              </Link>
              {/* Kept reachable for operations, but demoted to a plain text link:
                  the report is the walker's job, the ticket is back-office. */}
              <Link href={`/walker/tickets/${encodeURIComponent(session.id)}`} className="inline-flex min-h-11 items-center px-2 text-xs font-medium text-muted underline-offset-2 hover:text-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                Ticket interno
              </Link>
            </div>
          )}
          {collapsible && !alwaysCompact && (
            <button
              type="button"
              onClick={() => setExpanded((open) => !open)}
              aria-expanded={expanded}
              aria-controls={detailsId}
              className="mt-2 inline-flex min-h-11 items-center gap-1.5 rounded-xl px-2 text-sm font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {expanded ? 'Menos detalles' : 'Más detalles'}
              <ChevronDown size={16} aria-hidden="true" className={`transition-transform motion-reduce:transition-none ${expanded ? 'rotate-180' : ''}`} />
            </button>
          )}
        </div>
      </div>
    </Card>
  )
}
