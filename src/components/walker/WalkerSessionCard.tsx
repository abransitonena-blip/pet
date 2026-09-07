'use client'

import Link from 'next/link'
import { CalendarDays, Check, Clock, Dog, FileText, MapPin } from 'lucide-react'
import { Button, Card, StatusBadge } from '@/components/ui'
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
}

export default function WalkerSessionCard({ session, onAdvance, updating = false, compact = false }: WalkerSessionCardProps) {
  const status = walkerSessionStatus(session)
  const transition = getWalkerTransition(status)
  const date = walkerSessionDate(session)
  const start = walkerSessionStart(session)
  const timelinePosition = walkerTimelinePosition(status)
  const arrivalWindow = session.arrivalWindowStart
    ? `${session.arrivalWindowStart}${session.arrivalWindowEnd ? `–${session.arrivalWindowEnd}` : ''}`
    : ''

  return (
    <Card className={`p-4 shadow-none hover:shadow-sm ${compact ? 'sm:p-4' : 'sm:p-5'}`}>
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
            <StatusBadge status={status} />
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
                    <span className={`mx-auto grid h-7 w-7 place-items-center rounded-full border text-[10px] font-bold ${reached ? 'border-primary bg-primary text-white' : 'border-ink/15 bg-surface text-muted'}`}>
                      {index < timelinePosition ? <Check size={12} aria-hidden="true" /> : index + 1}
                    </span>
                    <span className={`mt-1 hidden truncate text-[10px] sm:block ${current ? 'font-semibold text-ink' : 'text-muted'}`}>{item.label}</span>
                  </li>
                )
              })}
            </ol>
          )}

          {onAdvance && transition && (
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
          )}
          {status === 'completed' && (
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <Link href={`/walker/reportes/${encodeURIComponent(session.id)}`} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary/10 px-4 text-sm font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:w-auto">
                <FileText size={16} aria-hidden="true" /> Reporte del paseo
              </Link>
              <Link href={`/walker/tickets/${encodeURIComponent(session.id)}`} className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-border bg-surface px-4 text-sm font-semibold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:w-auto">
                Ticket interno
              </Link>
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}
