'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { FileText } from 'lucide-react'
import { Card, EmptyState, ErrorState, LoadingState, StatusBadge } from '@/components/ui'
import type { PersistentTicketSnapshot } from '@/lib/finance/domain'
import { getTicket, TicketOperationError } from '@/lib/tickets'
import TicketReceiptView from './TicketReceiptView'

export default function TicketReadOnlyPage({ ticketId, backHref }: { ticketId: string; backHref: string }) {
  const [ticket, setTicket] = useState<PersistentTicketSnapshot | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'permission' | 'network'>('loading')
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let active = true
    void getTicket(ticketId).then((value) => {
      if (!active) return
      setTicket(value)
      setState('ready')
    }).catch((error: unknown) => {
      if (!active) return
      setState(error instanceof TicketOperationError && error.code === 'ticket-permission-denied' ? 'permission' : 'network')
    })
    return () => { active = false }
  }, [ticketId, revision])

  if (state === 'loading') return <LoadingState message="Consultando ticket…" rows={4} />
  if (state === 'permission' || state === 'network') {
    return <ErrorState description={state === 'permission' ? 'No tienes permiso para consultar este ticket.' : 'No pudimos consultar el ticket.'} onRetry={() => { setState('loading'); setRevision((value) => value + 1) }} />
  }
  if (!ticket) {
    return <EmptyState icon={<FileText aria-hidden="true" />} title="Ticket aún no creado" description="El recibo interno aparecerá cuando PET Ap lo genere después de recibir el reporte enviado." action={<Link href={backHref} className="inline-flex min-h-11 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">Volver</Link>} />
  }
  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 overflow-x-hidden">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Recibo interno</p><h1 className="mt-1 text-2xl font-bold text-ink">{ticket.folio}</h1><p className="mt-1 text-sm text-muted">No es CFDI. No contiene un pago registrado.</p></div>
        <StatusBadge status={ticket.status} />
      </header>
      <TicketReceiptView ticket={ticket} />
      <Card className="p-4 shadow-none"><p className="text-sm text-muted">Este documento conserva el snapshot operativo del paseo. Reimprimirlo no crea pagos ni movimientos financieros.</p><Link href={ticket.reportUrl} className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-primary underline underline-offset-4">Ver reporte enviado</Link></Card>
    </main>
  )
}

