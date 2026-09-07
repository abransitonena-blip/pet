'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, Clipboard, Download, FileCode2, RotateCcw } from 'lucide-react'
import { Button, ConfirmDialog, EmptyState, ErrorState, LoadingState } from '@/components/ui'
import type { PersistentPrintEvent, PersistentPrintMode, PersistentTicketSnapshot } from '@/lib/finance/domain'
import { buildPetApTicket, ManualHexTransport, persistentTicketToPrintable } from '@/lib/printing'
import { getTicket, listPrintEvents, newPrintEventId, recordPrintEvent, sha256Hex, TicketOperationError } from '@/lib/tickets'
import { ROLES } from '@/lib/roles'
import { useSessionRole } from '@/lib/useSessionRole'
import TicketReceiptView from '@/components/tickets/TicketReceiptView'

type LoadState = 'loading' | 'ready' | 'permission' | 'network'

function timestamp(value: unknown): string {
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate().toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })
  }
  return 'Fecha pendiente'
}

function eventLabel(status: PersistentPrintEvent['status']): string {
  if (status === 'operator_confirmed') return 'Confirmación manual'
  if (status === 'failed') return 'Intento fallido'
  return 'Payload exportado'
}

export default function AdminTicketDetail({ ticketId }: { ticketId: string }) {
  const session = useSessionRole([ROLES.ADMIN, ROLES.SUPERVISOR])
  const [ticket, setTicket] = useState<PersistentTicketSnapshot | null>(null)
  const [events, setEvents] = useState<PersistentPrintEvent[]>([])
  const [state, setState] = useState<LoadState>('loading')
  const [revision, setRevision] = useState(0)
  const [payload, setPayload] = useState<Uint8Array | null>(null)
  const [hex, setHex] = useState('')
  const [payloadHash, setPayloadHash] = useState('')
  const [payloadMode, setPayloadMode] = useState<PersistentPrintMode | null>(null)
  const [busy, setBusy] = useState<'generate' | 'copy' | 'download' | 'confirm' | null>(null)
  const [message, setMessage] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const mode: PersistentPrintMode = useMemo(() => events.some((event) => event.status === 'payload_exported') ? 'reprint' : 'original', [events])
  const canWrite = session.status === 'ready' && session.role === ROLES.ADMIN && Boolean(session.uid)

  useEffect(() => {
    if (session.status !== 'ready') return
    let active = true
    void Promise.all([getTicket(ticketId), listPrintEvents(ticketId)]).then(([nextTicket, nextEvents]) => {
      if (!active) return
      setTicket(nextTicket)
      setEvents(nextEvents)
      setState('ready')
    }).catch((error: unknown) => {
      if (!active) return
      setState(error instanceof TicketOperationError && error.code === 'ticket-permission-denied' ? 'permission' : 'network')
    })
    return () => { active = false }
  }, [session.status, ticketId, revision])

  const generate = useCallback(async () => {
    if (!ticket) return
    setBusy('generate')
    setMessage('')
    try {
      const printable = persistentTicketToPrintable(ticket, mode, new Date().toISOString())
      const bytes = buildPetApTicket(printable)
      const transport = new ManualHexTransport()
      await transport.connect()
      await transport.write(bytes)
      setPayload(bytes)
      setPayloadMode(mode)
      setHex(transport.getHex())
      setPayloadHash(await sha256Hex(bytes))
      await transport.disconnect()
      setMessage(`${mode === 'original' ? 'Original' : 'Reimpresión'} preparado. Aún no se registró una impresión física.`)
    } catch {
      setMessage('No pudimos generar el payload ESC/POS.')
    } finally {
      setBusy(null)
    }
  }, [mode, ticket])

  const logEvent = useCallback(async (status: 'payload_exported' | 'operator_confirmed' | 'failed', errorCode?: string) => {
    if (!ticket || !payload || !payloadHash || !payloadMode || !session.uid || !canWrite) throw new Error('event-not-ready')
    await recordPrintEvent({
      eventId: newPrintEventId(), ticketId: ticket.walkSessionId, actorUid: session.uid,
      mode: payloadMode, transport: 'manual_hex', status, payloadHash, byteLength: payload.byteLength,
      ...(errorCode ? { errorCode } : {}),
    })
  }, [canWrite, payload, payloadHash, payloadMode, session.uid, ticket])

  const copy = useCallback(async () => {
    if (!hex) return
    setBusy('copy')
    try {
      await navigator.clipboard.writeText(hex)
      await logEvent('payload_exported')
      setMessage('HEX copiado y exportación registrada. La impresión física sigue sin confirmar.')
      setRevision((value) => value + 1)
    } catch {
      try { await logEvent('failed', 'clipboard_unavailable') } catch { /* preserve the original safe message */ }
      setMessage('No se pudo copiar el HEX. No se marcó como impresión confirmada.')
    } finally { setBusy(null) }
  }, [hex, logEvent])

  const download = useCallback(async () => {
    if (!payload || !ticket) return
    setBusy('download')
    try {
      await logEvent('payload_exported')
      const blob = new Blob([Uint8Array.from(payload)], { type: 'application/octet-stream' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `${ticket.folio}.bin`
      anchor.click()
      URL.revokeObjectURL(url)
      setMessage('BIN descargado y exportación registrada. La impresión física sigue sin confirmar.')
      setRevision((value) => value + 1)
    } catch {
      setMessage('No se pudo descargar el BIN ni registrar la exportación.')
    } finally { setBusy(null) }
  }, [logEvent, payload, ticket])

  const confirmPrint = useCallback(async () => {
    setBusy('confirm')
    try {
      await logEvent('operator_confirmed')
      setMessage('Confirmación manual registrada. No se creó ningún movimiento financiero.')
      setConfirmOpen(false)
      setRevision((value) => value + 1)
    } catch {
      setMessage('No pudimos registrar la confirmación manual.')
    } finally { setBusy(null) }
  }, [logEvent])

  if (session.status === 'loading' || state === 'loading') return <LoadingState message="Consultando ticket…" rows={5} />
  if (session.status !== 'ready') return <ErrorState title="Acceso operativo requerido" description="Este detalle requiere un claim Admin o Supervisor explícito." />
  if (state === 'permission' || state === 'network') return <ErrorState description={state === 'permission' ? 'No tienes permiso para consultar este ticket.' : 'No pudimos consultar el ticket.'} onRetry={() => { setState('loading'); setRevision((value) => value + 1) }} />
  if (!ticket) return <EmptyState title="Ticket inexistente" description="La sesión todavía no tiene un recibo interno persistente." />

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 overflow-x-hidden">
      <header className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Ticket interno</p><h1 className="mt-1 break-all font-mono text-xl font-bold text-ink sm:text-2xl">{ticket.folio}</h1><p className="mt-1 text-sm text-muted">Snapshot inmutable · pago no registrado · no CFDI</p></div><span className="inline-flex min-h-8 items-center rounded-full bg-success/10 px-3 text-xs font-semibold text-success-700">Activo</span></header>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_384px]">
        <section className="min-w-0 space-y-5">
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => void generate()} isLoading={busy === 'generate'} leftIcon={<FileCode2 size={16} aria-hidden="true" />}>Generar ESC/POS</Button>
            <Button type="button" variant="secondary" disabled={!payload || !canWrite} onClick={() => void copy()} isLoading={busy === 'copy'} leftIcon={<Clipboard size={16} aria-hidden="true" />}>Copiar HEX</Button>
            <Button type="button" variant="secondary" disabled={!payload || !canWrite} onClick={() => void download()} isLoading={busy === 'download'} leftIcon={<Download size={16} aria-hidden="true" />}>Descargar .bin</Button>
            <Button type="button" variant="secondary" disabled={!payload || !canWrite} onClick={() => setConfirmOpen(true)} leftIcon={<Check size={16} aria-hidden="true" />}>Impresión confirmada</Button>
            <Button type="button" variant="ghost" disabled={!payload} onClick={() => { setPayload(null); setHex(''); setPayloadHash(''); setPayloadMode(null); setMessage('') }} leftIcon={<RotateCcw size={16} aria-hidden="true" />}>Restablecer</Button>
          </div>
          {!canWrite && <p className="rounded-lg bg-warning/10 px-4 py-3 text-sm text-ink">Supervisor: consulta de solo lectura. Solo Admin registra exportaciones.</p>}
          {message && <p className="rounded-lg bg-primary/10 px-4 py-3 text-sm text-ink" role="status">{message}</p>}
          {payload && <details className="rounded-xl border border-ink/10 bg-surface p-4"><summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">Payload técnico · {payload.byteLength.toLocaleString('es-MX')} bytes</summary><p className="mt-3 break-all font-mono text-[11px] text-muted">SHA-256: {payloadHash}</p><label className="mt-3 block text-xs font-semibold text-ink" htmlFor="persistent-ticket-hex">HEX continuo</label><textarea id="persistent-ticket-hex" readOnly value={hex} rows={8} className="mt-2 w-full resize-y break-all rounded-lg border border-border bg-canvas p-3 font-mono text-[11px] text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]" /></details>}
          <section><div className="flex items-end justify-between gap-3"><div><h2 className="text-lg font-bold text-ink">Eventos de impresión</h2><p className="text-sm text-muted">Últimos 50 eventos inmutables.</p></div><span className="text-sm text-muted">{events.length}</span></div>{events.length === 0 ? <div className="mt-3"><EmptyState title="Sin exportaciones" description="Generar una vista previa no crea eventos. Copiar o descargar sí registra la exportación." /></div> : <div className="mt-3 divide-y divide-ink/10 rounded-2xl bg-surface">{events.map((event, index) => <div key={`${event.payloadHash}-${index}`} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm"><div><p className="font-semibold text-ink">{eventLabel(event.status)}</p><p className="text-xs text-muted">{event.mode === 'original' ? 'Original' : 'Reimpresión'} · {event.byteLength} bytes · {timestamp(event.createdAt)}</p></div><span className={`inline-flex min-h-8 items-center rounded-full px-3 text-xs font-semibold ${event.status === 'failed' ? 'bg-danger/10 text-danger' : event.status === 'operator_confirmed' ? 'bg-success/10 text-success-700' : 'bg-primary/10 text-primary'}`}>{eventLabel(event.status)}</span></div>)}</div>}</section>
          <Link href={ticket.reportUrl} className="inline-flex min-h-11 items-center text-sm font-semibold text-primary underline underline-offset-4">Abrir reporte enviado</Link>
        </section>
        <TicketReceiptView ticket={ticket} />
      </div>
      <ConfirmDialog open={confirmOpen} title="Confirmar impresión física" description="Confirma únicamente si verificaste el papel impreso. FF02 Write Without Response no confirma por sí solo la impresión." confirmLabel="Sí, confirmé el papel" loading={busy === 'confirm'} onConfirm={() => void confirmPrint()} onCancel={() => setConfirmOpen(false)} />
    </main>
  )
}
