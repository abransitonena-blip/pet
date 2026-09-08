'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { collection, doc, getDoc, getDocs, limit, orderBy, query, type DocumentData, type FirestoreError } from 'firebase/firestore'
import { Check, ChevronDown, Clipboard, Download, FileCode2, Printer, RotateCcw, Save } from 'lucide-react'
import { db } from '@/firebase/config'
import { Button, EmptyState, ErrorState, LoadingState } from '@/components/ui'
import { ROLES } from '@/lib/roles'
import { SITE_URL } from '@/lib/siteUrl'
import { useSessionRole } from '@/lib/useSessionRole'
import { getReservationServiceDefinitions } from '@/lib/walkServices'
import { buildPetApTicket } from '@/lib/printing/petApTicketBuilder'
import { buildTicketSnapshotFromSession, type TicketSourceSession } from '@/lib/printing/ticketSnapshotBuilder'
import { ManualHexTransport, WebBluetoothTransport, isWebBluetoothAvailable } from '@/lib/printing/transports'
import { FEATURE_FLAGS } from '@/lib/featureFlags'
import type { TemporaryReportStatus, TemporaryTicketSnapshot } from '@/lib/finance/domain/ticketPreview'
import { createPersistentTicket, TicketOperationError } from '@/lib/tickets'
import PetApDogMark from '@/components/tickets/PetApDogMark'

const TICKET_SESSION_READ_LIMIT = 50

type LoadState = 'idle' | 'loading' | 'ready' | 'permission' | 'network'
type SourceKind = 'production-read' | 'development-fixture'

interface CompletedSessionOption extends TicketSourceSession {
  readonly sourceData: DocumentData
}

function text(data: DocumentData, ...keys: string[]): string {
  for (const key of keys) {
    if (typeof data[key] === 'string' && data[key].trim()) return data[key].trim()
  }
  return ''
}

function timestampDate(value: unknown): Date | null {
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    const date = value.toDate()
    return date instanceof Date && !Number.isNaN(date.getTime()) ? date : null
  }
  return null
}

function time(value: unknown): string | null {
  const date = timestampDate(value)
  return date ? date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false }) : null
}

function elapsedMinutes(start: unknown, end: unknown): number | null {
  const startDate = timestampDate(start)
  const endDate = timestampDate(end)
  if (!startDate || !endDate) return null
  const minutes = Math.round((endDate.getTime() - startDate.getTime()) / 60_000)
  return minutes > 0 ? minutes : null
}

function completedSession(id: string, data: DocumentData): CompletedSessionOption | null {
  const status = text(data, 'status', 'sessionStatus')
  if (status !== 'completed') return null
  const serviceId = text(data, 'serviceId')
  const definition = getReservationServiceDefinitions().find((item) => item.id === serviceId)
  const startedAt = time(data.startedAt)
  const completedAt = time(data.completedAt)
  return {
    id,
    customerId: text(data, 'customerId'),
    dogIds: Array.isArray(data.dogIds) ? data.dogIds.filter((value: unknown): value is string => typeof value === 'string' && Boolean(value.trim())) : [],
    walkerId: text(data, 'walkerId'),
    serviceId,
    serviceDisplayName: text(data, 'serviceName') || definition?.name || serviceId,
    durationMinutes: elapsedMinutes(data.startedAt, data.completedAt),
    scheduledDate: text(data, 'scheduledDate', 'date'),
    scheduledStart: startedAt || text(data, 'scheduledStart', 'startTime') || 'Hora no registrada',
    scheduledEnd: completedAt,
    status,
    sourceData: data,
  }
}

function classifyReadError(error: FirestoreError | unknown): 'permission' | 'network' {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : ''
  return code.includes('permission-denied') ? 'permission' : 'network'
}

function abbreviated(value: string): string {
  return value.length > 12 ? `${value.slice(0, 8)}…` : value
}

async function resolveSnapshot(session: CompletedSessionOption, generatedAt: string): Promise<{ snapshot: TemporaryTicketSnapshot; reportStatus: TemporaryReportStatus }> {
  const [customerDocument, walkerDocument, reportDocument, ...dogDocuments] = await Promise.all([
    getDoc(doc(db, 'customerProfiles', session.customerId)),
    getDoc(doc(db, 'walkerProfiles', session.walkerId)),
    getDoc(doc(db, 'walkReports', session.id)),
    ...session.dogIds.map((dogId) => getDoc(doc(db, 'dogs', dogId))),
  ])
  const customerName = text(session.sourceData, 'customerName') || (customerDocument.exists() ? text(customerDocument.data(), 'name', 'displayName') : '')
  const walkerName = text(session.sourceData, 'walkerName') || (walkerDocument.exists() ? text(walkerDocument.data(), 'name', 'displayName') : '')
  const dogNames = Object.fromEntries(session.dogIds.map((dogId, index) => {
    const document = dogDocuments[index]
    const inlineName = session.dogIds.length === 1 ? text(session.sourceData, 'dogName') : ''
    return [dogId, inlineName || (document?.exists() ? text(document.data(), 'name') : '')]
  }))
  const reportStatus = reportDocument.exists() && reportDocument.data().status === 'submitted'
    ? 'submitted'
    : reportDocument.exists() ? 'draft' : 'missing'
  return {
    reportStatus,
    snapshot: buildTicketSnapshotFromSession({
      session,
      names: { customerName, dogNames, walkerName },
      reportStatus,
      siteOrigin: SITE_URL,
      generatedAt,
    }),
  }
}

export default function TicketPrintTool() {
  const sessionRole = useSessionRole([ROLES.ADMIN])
  const [sessions, setSessions] = useState<CompletedSessionOption[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [loadState, setLoadState] = useState<LoadState>('idle')
  const [revision, setRevision] = useState(0)
  const [snapshot, setSnapshot] = useState<TemporaryTicketSnapshot | null>(null)
  const [payload, setPayload] = useState<Uint8Array | null>(null)
  const [hex, setHex] = useState('')
  const [source, setSource] = useState<SourceKind>('production-read')
  const [message, setMessage] = useState('')
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [bluetoothSending, setBluetoothSending] = useState(false)
  const [bluetoothMessage, setBluetoothMessage] = useState('')
  const [persisting, setPersisting] = useState(false)
  const [persistentTicketId, setPersistentTicketId] = useState('')

  useEffect(() => {
    if (sessionRole.status !== 'ready') return
    let active = true
    setLoadState('loading')
    void getDocs(query(collection(db, 'walkSessions'), orderBy('createdAt', 'desc'), limit(TICKET_SESSION_READ_LIMIT))).then((result) => {
      if (!active) return
      const completed = result.docs.map((item) => completedSession(item.id, item.data())).filter((item): item is CompletedSessionOption => item !== null)
      setSessions(completed)
      setSelectedId((current) => current && completed.some((item) => item.id === current) ? current : completed[0]?.id ?? '')
      setLoadState('ready')
    }).catch((error: FirestoreError) => {
      if (active) setLoadState(classifyReadError(error))
    })
    return () => { active = false }
  }, [sessionRole.status, revision])

  const selected = useMemo(() => sessions.find((item) => item.id === selectedId) ?? null, [selectedId, sessions])

  const reset = useCallback(() => {
    setSnapshot(null)
    setPayload(null)
    setHex('')
    setMessage('')
    setCopied(false)
    setSource('production-read')
    setPersistentTicketId('')
  }, [])

  const generate = useCallback(async () => {
    if (!selected) return
    setGenerating(true)
    setMessage('')
    setCopied(false)
    try {
      const generatedAt = new Date().toISOString()
      const resolved = await resolveSnapshot(selected, generatedAt)
      const bytes = buildPetApTicket(resolved.snapshot)
      const transport = new ManualHexTransport()
      await transport.connect()
      await transport.write(bytes)
      const nextHex = transport.getHex()
      await transport.disconnect()
      setSnapshot(resolved.snapshot)
      setPayload(bytes)
      setHex(nextHex)
      setSource('production-read')
      setMessage(resolved.reportStatus === 'submitted'
        ? 'Vista previa generada. El QR abre el reporte enviado.'
        : 'Vista previa operativa generada. El reporte todavía no está disponible para Familia PET.')
    } catch (error) {
      const code = error instanceof Error ? error.message : ''
      setMessage(code.startsWith('missing-ticket-source:')
        ? 'La sesión no conserva todos los nombres necesarios para construir un snapshot responsable.'
        : classifyReadError(error) === 'permission'
          ? 'Tu sesión no tiene permiso para consultar los datos asociados.'
          : 'No pudimos generar la vista previa. Revisa la conexión e inténtalo nuevamente.')
    } finally {
      setGenerating(false)
    }
  }, [selected])

  /**
   * Sends the already-generated payload straight to the BLE printer. Never claims
   * the ticket printed: FF02 is write-without-response, so a clean write only
   * proves the bytes left the browser. The operator still confirms the paper.
   */
  const sendOverBluetooth = useCallback(async () => {
    if (!FEATURE_FLAGS.BLUETOOTH_PRINTING_ENABLED || !payload || payload.byteLength === 0) return
    setBluetoothSending(true)
    setBluetoothMessage('')
    const transport = new WebBluetoothTransport()
    try {
      await transport.connect()
      await transport.write(payload)
      const status = await transport.getStatus()
      setBluetoothMessage(status.message ?? 'Payload enviado. Confirma el papel impreso.')
    } catch (error) {
      const code = error instanceof Error ? error.message : ''
      setBluetoothMessage(code === 'web-bluetooth-unavailable'
        ? 'Este navegador no permite Bluetooth. Usa Chrome o Edge, o copia el HEX.'
        : 'No pudimos enviar a la impresora. Revisa el emparejamiento e inténtalo otra vez.')
    } finally {
      await transport.disconnect().catch(() => {})
      setBluetoothSending(false)
    }
  }, [payload])

  const generateDevelopmentFixture = useCallback(async () => {
    if (process.env.NODE_ENV === 'production') return
    setGenerating(true)
    setMessage('')
    try {
      const { createDevelopmentTicketFixture } = await import('@/lib/printing/developmentFixture')
      const fixtureSnapshot = buildTicketSnapshotFromSession(createDevelopmentTicketFixture(new Date().toISOString()))
      const bytes = buildPetApTicket(fixtureSnapshot)
      const transport = new ManualHexTransport()
      await transport.connect()
      await transport.write(bytes)
      setSnapshot(fixtureSnapshot)
      setPayload(bytes)
      setHex(transport.getHex())
      await transport.disconnect()
      setSource('development-fixture')
      setMessage('Fixture local generado. No representa una sesión ni datos de producción.')
    } finally {
      setGenerating(false)
    }
  }, [])

  const copyHex = useCallback(async () => {
    if (!hex) return
    try {
      await navigator.clipboard.writeText(hex)
      setCopied(true)
      setMessage('HEX copiado. Pégalo manualmente en nRF Connect cuando la impresora esté preparada.')
    } catch {
      setMessage('No se pudo copiar automáticamente. Selecciona el HEX desde el panel técnico.')
    }
  }, [hex])

  const downloadBinary = useCallback(() => {
    if (!payload) return
    const blob = new Blob([Uint8Array.from(payload)], { type: 'application/octet-stream' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${snapshot?.folio ?? 'pet-ap-ticket-preview'}.bin`
    anchor.click()
    URL.revokeObjectURL(url)
  }, [payload, snapshot?.folio])

  const persistTicket = useCallback(async () => {
    if (!snapshot || !selected || snapshot.reportStatus !== 'submitted' || !sessionRole.uid || source !== 'production-read') return
    setPersisting(true)
    setMessage('')
    try {
      const result = await createPersistentTicket({
        walkSessionId: snapshot.walkSessionId,
        walkReportId: snapshot.walkReportId,
        customerId: snapshot.customer.uid,
        walkerId: snapshot.walker.uid,
        dogIds: snapshot.dogs.map((dog) => dog.uid),
        customerName: snapshot.customer.displayName,
        dogNames: Object.fromEntries(snapshot.dogs.map((dog) => [dog.uid, dog.displayName])),
        walkerName: snapshot.walker.displayName,
        serviceId: snapshot.serviceId,
        serviceName: snapshot.serviceDisplayName,
        durationMinutes: snapshot.durationMinutes,
        serviceDate: selected.scheduledDate,
        startTime: text(selected.sourceData, 'scheduledStart'),
        endTime: text(selected.sourceData, 'arrivalWindowEnd') || null,
        siteOrigin: SITE_URL,
        createdBy: sessionRole.uid,
      })
      setPersistentTicketId(result.ticket.walkSessionId)
      setMessage(result.outcome === 'created' ? 'Ticket interno creado una sola vez. Ya puedes abrirlo y exportar su payload.' : 'El ticket idéntico ya existía; no se creó un duplicado.')
    } catch (error) {
      const code = error instanceof TicketOperationError ? error.code : ''
      setMessage(code === 'ticket-conflict'
        ? 'Conflicto: la sesión ya tiene un ticket con un snapshot diferente. No se sobrescribió.'
        : code === 'ticket-report-not-submitted' || code === 'ticket-report-missing'
          ? 'El reporte debe existir y estar enviado antes de crear el ticket.'
          : code === 'ticket-permission-denied'
            ? 'Tu sesión no tiene permiso para crear tickets.'
            : 'No pudimos crear el ticket. Revisa la conexión e inténtalo nuevamente.')
    } finally {
      setPersisting(false)
    }
  }, [selected, sessionRole.uid, snapshot, source])

  if (sessionRole.status === 'loading') return <LoadingState message="Verificando acceso administrativo…" rows={3} />
  if (sessionRole.status !== 'ready') {
    return <ErrorState title="Acceso exclusivo de Admin" description="Esta herramienta requiere un custom claim admin explícito." onRetry={() => void sessionRole.refresh()} />
  }
  if (loadState === 'loading' || loadState === 'idle') return <LoadingState message="Buscando sesiones completadas…" rows={4} />
  if (loadState === 'permission' || loadState === 'network') {
    return <ErrorState description={loadState === 'permission' ? 'No tienes permiso para consultar sesiones completadas.' : 'No pudimos consultar las sesiones. Revisa tu conexión.'} onRetry={() => setRevision((value) => value + 1)} />
  }

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 overflow-x-hidden">
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Herramienta T2 · ticket interno</p>
        <h1 className="text-2xl font-bold text-ink sm:text-3xl">Vista previa ESC/POS</h1>
        <p className="max-w-3xl text-sm text-muted">Previsualiza ESC/POS y, con reporte enviado, crea un único ticket inmutable. No crea pagos, movimientos, cierres ni CFDI.</p>
      </header>

      {sessions.length === 0 && !snapshot ? (
        <EmptyState
          icon={<Printer aria-hidden="true" />}
          title="Sin sesiones completadas disponibles"
          description="La herramienta consulta como máximo las 50 sesiones más recientes. En desarrollo puede usarse un fixture local explícito."
          action={process.env.NODE_ENV !== 'production' ? <Button type="button" onClick={() => void generateDevelopmentFixture()} isLoading={generating}>Usar fixture local</Button> : undefined}
        />
      ) : (
        <section className="space-y-4" aria-label="Generación del ticket">
          {sessions.length > 0 && <div className="flex flex-col gap-3 border-b border-ink/10 pb-5 lg:flex-row lg:items-end">
            <label className="min-w-0 flex-1 text-sm font-semibold text-ink">
              Sesión completada
              <span className="relative mt-2 block">
                <select
                  className="min-h-11 w-full appearance-none rounded-lg border border-border bg-surface px-3 pr-10 text-sm text-ink outline-none transition focus-visible:border-[var(--focus-ring)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]/20"
                  value={selectedId}
                  onChange={(event) => { setSelectedId(event.target.value); reset() }}
                >
                  {sessions.map((item) => <option key={item.id} value={item.id}>{item.scheduledDate || 'Fecha pendiente'} · {abbreviated(item.id)} · {item.serviceDisplayName}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
              </span>
            </label>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => void generate()} isLoading={generating} leftIcon={<FileCode2 className="h-4 w-4" aria-hidden="true" />}>Generar ESC/POS</Button>
              <Button type="button" variant="secondary" disabled={!snapshot} onClick={reset} leftIcon={<RotateCcw className="h-4 w-4" aria-hidden="true" />}>Restablecer</Button>
            </div>
          </div>}

          {message && <p className="rounded-lg bg-primary/10 px-4 py-3 text-sm text-ink" role="status">{message}</p>}

          {snapshot && payload ? (
            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
              <section className="min-w-0 space-y-4" aria-label="Controles técnicos">
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
                  <span className="rounded-full bg-ink/5 px-3 py-1.5">{source === 'production-read' ? 'Datos reales · solo lectura' : 'Fixture local'}</span>
                  <span>{payload.byteLength.toLocaleString('es-MX')} bytes</span>
                  <span>58 mm · 384 dots · CP850</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" disabled={snapshot.reportStatus !== 'submitted' || source !== 'production-read' || Boolean(persistentTicketId)} onClick={() => void persistTicket()} isLoading={persisting} leftIcon={<Save className="h-4 w-4" aria-hidden="true" />}>Crear ticket</Button>
                  <Button type="button" variant="secondary" onClick={() => void copyHex()} leftIcon={copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Clipboard className="h-4 w-4" aria-hidden="true" />}>{copied ? 'HEX copiado' : 'Copiar HEX'}</Button>
                  <Button type="button" variant="secondary" onClick={downloadBinary} leftIcon={<Download className="h-4 w-4" aria-hidden="true" />}>Descargar .bin</Button>
                  {FEATURE_FLAGS.BLUETOOTH_PRINTING_ENABLED && (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => void sendOverBluetooth()}
                      isLoading={bluetoothSending}
                      disabled={!isWebBluetoothAvailable()}
                      title={isWebBluetoothAvailable() ? undefined : 'Este navegador no permite Bluetooth'}
                      leftIcon={<Printer className="h-4 w-4" aria-hidden="true" />}
                    >
                      Enviar por Bluetooth
                    </Button>
                  )}
                  {persistentTicketId && <Link href={`/admin/tickets/${encodeURIComponent(persistentTicketId)}`} className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border bg-surface px-4 text-sm font-semibold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">Abrir ticket persistente</Link>}
                </div>
                {bluetoothMessage && <p role="status" className="rounded-xl bg-primary/10 px-4 py-3 text-sm text-ink">{bluetoothMessage}</p>}
                <details className="rounded-xl border border-ink/10 bg-surface p-4">
                  <summary className="min-h-11 cursor-pointer select-none py-2 text-sm font-semibold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">Panel técnico</summary>
                  <dl className="mt-3 grid gap-2 text-xs text-muted sm:grid-cols-2">
                    <div><dt className="font-semibold text-ink">Documento</dt><dd>internal-receipt</dd></div>
                    <div><dt className="font-semibold text-ink">Fiscal</dt><dd>No es CFDI</dd></div>
                    <div><dt className="font-semibold text-ink">Persistencia</dt><dd>{persistentTicketId ? 'Ticket inmutable creado' : 'Vista previa en memoria'}</dd></div>
                    <div><dt className="font-semibold text-ink">Pago</dt><dd>No registrado</dd></div>
                  </dl>
                  <label className="mt-4 block text-xs font-semibold text-ink" htmlFor="ticket-hex">HEX continuo</label>
                  <textarea id="ticket-hex" readOnly value={hex} rows={8} className="mt-2 w-full resize-y break-all rounded-lg border border-border bg-canvas p-3 font-mono text-[11px] leading-relaxed text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]" />
                </details>
              </section>

              <aside className="mx-auto w-full max-w-[384px]" aria-label="Vista previa térmica">
                <div className="overflow-hidden rounded-sm bg-white px-6 py-8 font-mono text-[12px] leading-relaxed text-black shadow-[0_14px_40px_rgba(15,23,42,0.14)]">
                  <div className="flex flex-col items-center text-center"><PetApDogMark className="mb-2 h-16 w-[76px]" /><p className="text-xl font-black">PET Ap</p><p className="text-[11px] font-bold tracking-[0.16em]">PASEO COMPLETADO</p></div>
                  <p className="my-3 overflow-hidden">--------------------------------</p>
                  <p className="font-bold">{snapshot.dogs.map((dog) => dog.displayName).join(', ')}</p>
                  <p>{snapshot.serviceDisplayName}{snapshot.durationMinutes ? ` - ${snapshot.durationMinutes} min` : ''}</p>
                  <p>{snapshot.serviceDate} · {snapshot.startTime}{snapshot.endTime ? `-${snapshot.endTime}` : ''}</p>
                  <p className="mt-2">Paseador: {snapshot.walker.displayName}</p>
                  <p>Folio: {snapshot.folio}</p>
                  <p className="mt-3 font-bold">Pago: NO REGISTRADO</p>
                  <p className="my-3 overflow-hidden">--------------------------------</p>
                  <div className="text-center"><p className="font-bold">{snapshot.reportStatus === 'submitted' ? 'VER REPORTE DEL PASEO' : 'REPORTE NO DISPONIBLE'}</p>{snapshot.reportStatus === 'submitted' && <div className="mx-auto my-3 grid h-24 w-24 grid-cols-5 gap-1 bg-black p-2" aria-label="Representación visual del QR">{Array.from({ length: 25 }, (_, index) => <span key={index} className={index % 3 === 0 || index % 7 === 0 ? 'bg-white' : 'bg-black'} />)}</div>}<p>{snapshot.reportUrl ? new URL(snapshot.reportUrl).hostname : 'Vista previa operativa'}</p><p className="mt-2">Verif: {snapshot.verificationCode}</p><p className="mt-3 font-bold">VISTA PREVIA - NO FISCAL</p><p className="mt-1">¡Gracias por confiar en PET Ap!</p></div>
                </div>
              </aside>
            </div>
          ) : (
            <div className="border-t border-ink/10 pt-5"><EmptyState title="Selecciona y genera una vista previa" description="La generación ocurre únicamente en memoria y no escribe en Firestore." /></div>
          )}
        </section>
      )}
    </main>
  )
}
