'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { Search, Ticket } from 'lucide-react'
import { Button, EmptyState, ErrorState, Input, LoadingState, StatusBadge } from '@/components/ui'
import type { PersistentTicketSnapshot } from '@/lib/finance/domain'
import { listTickets, TicketOperationError } from '@/lib/tickets'

function dateValue(value: unknown): string {
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate().toISOString().slice(0, 10)
  }
  return ''
}

export default function AdminTicketsList() {
  const [tickets, setTickets] = useState<PersistentTicketSnapshot[]>([])
  const [exactFolio, setExactFolio] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [state, setState] = useState<'loading' | 'ready' | 'permission' | 'network'>('loading')
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let active = true
    void listTickets(exactFolio.trim() ? { exactFolio } : undefined).then((items) => {
      if (!active) return
      setTickets(items)
      setState('ready')
    }).catch((error: unknown) => {
      if (!active) return
      setState(error instanceof TicketOperationError && error.code === 'ticket-permission-denied' ? 'permission' : 'network')
    })
    return () => { active = false }
  }, [revision])
  const filtered = useMemo(() => dateFilter ? tickets.filter((ticket) => dateValue(ticket.createdAt) === dateFilter) : tickets, [dateFilter, tickets])
  const search = () => { setState('loading'); setRevision((value) => value + 1) }
  return (
    <main className="mx-auto w-full max-w-6xl space-y-5 overflow-x-hidden">
      <header><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Operación</p><h1 className="mt-1 text-2xl font-bold text-ink sm:text-3xl">Tickets internos</h1><p className="mt-1 text-sm text-muted">Últimos 50 recibos. Son documentos internos y no CFDI.</p></header>
      <form className="grid gap-3 border-b border-ink/10 pb-5 sm:grid-cols-[minmax(0,1fr)_180px_auto]" onSubmit={(event) => { event.preventDefault(); search() }}>
        <label className="text-sm font-semibold text-ink">Folio exacto<Input className="mt-2" value={exactFolio} onChange={(event) => setExactFolio(event.target.value)} placeholder="TKT-…" /></label>
        <label className="text-sm font-semibold text-ink">Fecha<Input className="mt-2" type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} /></label>
        <Button type="submit" className="self-end" leftIcon={<Search size={16} aria-hidden="true" />}>Buscar</Button>
      </form>
      {state === 'loading' ? <LoadingState message="Consultando tickets…" rows={5} /> : state === 'permission' || state === 'network' ? <ErrorState description={state === 'permission' ? 'No tienes permiso para listar tickets.' : 'No pudimos consultar los tickets.'} onRetry={search} /> : filtered.length === 0 ? <EmptyState icon={<Ticket aria-hidden="true" />} title="Sin tickets" description="Crea el primer ticket desde una sesión completada con reporte enviado." /> : (
        <div className="divide-y divide-ink/10 overflow-hidden rounded-2xl bg-surface">
          {filtered.map((ticket) => <article key={ticket.walkSessionId} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-semibold text-ink">{ticket.folio}</p><StatusBadge status={ticket.status} /></div><p className="mt-1 text-xs text-muted">{ticket.serviceDate} · {ticket.serviceName} · Pago no registrado</p></div><Link href={`/admin/tickets/${encodeURIComponent(ticket.walkSessionId)}`} className="inline-flex min-h-11 items-center justify-center rounded-lg bg-primary/10 px-4 text-sm font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">Abrir ticket</Link></article>)}
        </div>
      )}
    </main>
  )
}
