import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  where,
  type DocumentData,
  type FirestoreError,
} from 'firebase/firestore'
import { db } from '@/firebase/db'
import {
  buildPersistentTicketSnapshot,
  persistentTicketFingerprint,
  ticketIdForSession,
  type BuildPersistentTicketInput,
  type PersistentPrintEvent,
  type PersistentPrintMode,
  type PersistentPrintStatus,
  type PersistentPrintTransport,
  type PersistentTicketSnapshot,
} from '@/lib/finance/domain'

export const TICKET_LIST_LIMIT = 50
export const PRINT_EVENT_LIST_LIMIT = 50

export type TicketOperationErrorCode =
  | 'ticket-session-missing'
  | 'ticket-session-not-completed'
  | 'ticket-report-missing'
  | 'ticket-report-not-submitted'
  | 'ticket-reference-conflict'
  | 'ticket-conflict'
  | 'ticket-permission-denied'
  | 'ticket-network-error'

export class TicketOperationError extends Error {
  constructor(readonly code: TicketOperationErrorCode) {
    super(code)
    this.name = 'TicketOperationError'
  }
}

export type CreateTicketInput = Omit<BuildPersistentTicketInput, 'createdAt'>

export interface CreateTicketResult {
  readonly ticket: Readonly<PersistentTicketSnapshot>
  readonly outcome: 'created' | 'existing'
}

function timestampLike(value: unknown): boolean {
  return Boolean(value && typeof value === 'object')
}

function parseTicket(id: string, data: DocumentData): PersistentTicketSnapshot {
  if (data.walkSessionId !== id || data.folio !== `TKT-${id}` || data.serviceFolio !== `PET-${id}` || !timestampLike(data.createdAt)) {
    throw new TicketOperationError('ticket-reference-conflict')
  }
  return data as PersistentTicketSnapshot
}

function sameIds(left: readonly unknown[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

function assertSourceRelationship(sessionId: string, session: DocumentData, report: DocumentData, input: CreateTicketInput): void {
  if (session.status !== 'completed') throw new TicketOperationError('ticket-session-not-completed')
  if (report.status !== 'submitted') throw new TicketOperationError('ticket-report-not-submitted')
  const consistent = report.walkSessionId === sessionId
    && report.customerId === session.customerId
    && report.walkerId === session.walkerId
    && Array.isArray(report.dogIds)
    && Array.isArray(session.dogIds)
    && sameIds(report.dogIds, session.dogIds)
    && input.customerId === session.customerId
    && input.walkerId === session.walkerId
    && sameIds(input.dogIds, session.dogIds)
    && input.walkReportId === sessionId
    && input.serviceId === session.serviceId
    && input.serviceDate === session.scheduledDate
    && input.startTime === session.scheduledStart
    && input.endTime === (session.arrivalWindowEnd ?? null)
  if (!consistent) throw new TicketOperationError('ticket-reference-conflict')
}

function classify(error: unknown): TicketOperationError {
  if (error instanceof TicketOperationError) return error
  const code = error && typeof error === 'object' && 'code' in error ? String((error as FirestoreError).code) : ''
  return new TicketOperationError(code.includes('permission-denied') ? 'ticket-permission-denied' : 'ticket-network-error')
}

export async function createPersistentTicket(input: CreateTicketInput): Promise<CreateTicketResult> {
  const ticketId = ticketIdForSession(input.walkSessionId)
  try {
    return await runTransaction(db, async (transaction) => {
      const ticketRef = doc(db, 'tickets', ticketId)
      const sessionRef = doc(db, 'walkSessions', ticketId)
      const reportRef = doc(db, 'walkReports', ticketId)
      const [ticketDocument, sessionDocument, reportDocument] = await Promise.all([
        transaction.get(ticketRef),
        transaction.get(sessionRef),
        transaction.get(reportRef),
      ])
      if (!sessionDocument.exists()) throw new TicketOperationError('ticket-session-missing')
      if (!reportDocument.exists()) throw new TicketOperationError('ticket-report-missing')
      assertSourceRelationship(ticketId, sessionDocument.data(), reportDocument.data(), input)
      const candidate = buildPersistentTicketSnapshot({ ...input, createdAt: serverTimestamp() })
      if (ticketDocument.exists()) {
        const existing = parseTicket(ticketId, ticketDocument.data())
        if (persistentTicketFingerprint(existing) !== persistentTicketFingerprint(candidate)) {
          throw new TicketOperationError('ticket-conflict')
        }
        return { ticket: existing, outcome: 'existing' } as const
      }
      transaction.set(ticketRef, candidate)
      return { ticket: candidate, outcome: 'created' } as const
    })
  } catch (error) {
    throw classify(error)
  }
}

export async function getTicket(ticketId: string): Promise<PersistentTicketSnapshot | null> {
  try {
    const result = await getDoc(doc(db, 'tickets', ticketIdForSession(ticketId)))
    return result.exists() ? parseTicket(result.id, result.data()) : null
  } catch (error) {
    throw classify(error)
  }
}

export async function listTickets(filters?: { exactFolio?: string }): Promise<PersistentTicketSnapshot[]> {
  try {
    const source = filters?.exactFolio
      ? query(collection(db, 'tickets'), where('folio', '==', filters.exactFolio.trim()), limit(1))
      : query(collection(db, 'tickets'), orderBy('createdAt', 'desc'), limit(TICKET_LIST_LIMIT))
    const result = await getDocs(source)
    return result.docs.map((item) => parseTicket(item.id, item.data()))
  } catch (error) {
    throw classify(error)
  }
}

export function newPrintEventId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  throw new TicketOperationError('ticket-network-error')
}

export async function sha256Hex(payload: Uint8Array): Promise<string> {
  if (typeof crypto === 'undefined' || !crypto.subtle) throw new TicketOperationError('ticket-network-error')
  const digest = await crypto.subtle.digest('SHA-256', Uint8Array.from(payload))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export interface RecordPrintEventInput {
  readonly eventId: string
  readonly ticketId: string
  readonly actorUid: string
  readonly mode: PersistentPrintMode
  readonly transport: PersistentPrintTransport
  readonly status: PersistentPrintStatus
  readonly payloadHash: string
  readonly byteLength: number
  readonly errorCode?: string
}

function comparablePrintEvent(value: Omit<PersistentPrintEvent, 'createdAt'>): string {
  return JSON.stringify(Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right))))
}

export async function recordPrintEvent(input: RecordPrintEventInput): Promise<'created' | 'existing'> {
  if (!/^[0-9a-f]{64}$/.test(input.payloadHash) || !Number.isSafeInteger(input.byteLength) || input.byteLength <= 0) {
    throw new TicketOperationError('ticket-reference-conflict')
  }
  try {
    return await runTransaction(db, async (transaction) => {
      const eventRef = doc(db, 'tickets', ticketIdForSession(input.ticketId), 'printEvents', input.eventId)
      const ticketRef = doc(db, 'tickets', input.ticketId)
      const [eventDocument, ticketDocument] = await Promise.all([transaction.get(eventRef), transaction.get(ticketRef)])
      if (!ticketDocument.exists()) throw new TicketOperationError('ticket-session-missing')
      const candidate = {
        ticketId: input.ticketId,
        actorUid: input.actorUid,
        mode: input.mode,
        transport: input.transport,
        status: input.status,
        payloadHash: input.payloadHash,
        byteLength: input.byteLength,
        ...(input.errorCode ? { errorCode: input.errorCode } : {}),
      } satisfies Omit<PersistentPrintEvent, 'createdAt'>
      if (eventDocument.exists()) {
        const { createdAt: _createdAt, ...existing } = eventDocument.data() as PersistentPrintEvent
        if (comparablePrintEvent(existing) !== comparablePrintEvent(candidate)) throw new TicketOperationError('ticket-conflict')
        return 'existing'
      }
      transaction.set(eventRef, { ...candidate, createdAt: serverTimestamp() })
      return 'created'
    })
  } catch (error) {
    throw classify(error)
  }
}

export async function listPrintEvents(ticketId: string): Promise<PersistentPrintEvent[]> {
  try {
    const result = await getDocs(query(collection(db, 'tickets', ticketIdForSession(ticketId), 'printEvents'), orderBy('createdAt', 'desc'), limit(PRINT_EVENT_LIST_LIMIT)))
    return result.docs.map((item) => item.data() as PersistentPrintEvent)
  } catch (error) {
    throw classify(error)
  }
}
