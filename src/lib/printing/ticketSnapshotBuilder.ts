import { buildTemporaryTicketSnapshot, type TemporaryReportStatus, type TemporaryTicketMode, type TemporaryTicketSnapshot } from '@/lib/finance/domain/ticketPreview'

export interface TicketSourceSession {
  readonly id: string
  readonly customerId: string
  readonly dogIds: readonly string[]
  readonly walkerId: string
  readonly serviceId: string
  readonly serviceDisplayName: string
  readonly durationMinutes: number | null
  readonly scheduledDate: string
  readonly scheduledStart: string
  readonly scheduledEnd: string | null
  readonly status: string
}

export interface TicketSourceNames {
  readonly customerName: string
  readonly dogNames: Readonly<Record<string, string>>
  readonly walkerName: string
}

export interface BuildTicketSnapshotFromSessionInput {
  readonly session: TicketSourceSession
  readonly names: TicketSourceNames
  readonly reportStatus: TemporaryReportStatus
  readonly siteOrigin: string
  readonly generatedAt: string
  readonly mode?: TemporaryTicketMode
}

export function durationFromSchedule(startTime: string, endTime: string | null): number | null {
  if (endTime === null) return null
  const pattern = /^(\d{2}):(\d{2})$/
  const start = pattern.exec(startTime)
  const end = pattern.exec(endTime)
  if (!start || !end) return null
  const startMinutes = Number(start[1]) * 60 + Number(start[2])
  const endMinutes = Number(end[1]) * 60 + Number(end[2])
  const duration = endMinutes - startMinutes
  return duration > 0 ? duration : null
}

function required(value: string, field: string): string {
  const normalized = value.trim()
  if (!normalized) throw new Error(`missing-ticket-source:${field}`)
  return normalized
}

export function buildTicketSnapshotFromSession(input: BuildTicketSnapshotFromSessionInput): TemporaryTicketSnapshot {
  const { session, names } = input
  if (session.status !== 'completed') throw new Error('ticket-session-not-completed')
  const dogs = session.dogIds.map((dogId) => ({
    uid: required(dogId, 'dogId'),
    displayName: required(names.dogNames[dogId] ?? '', `dogName:${dogId}`),
  }))

  return buildTemporaryTicketSnapshot({
    walkSessionId: session.id,
    walkReportId: session.id,
    customer: { uid: session.customerId, displayName: required(names.customerName, 'customerName') },
    dogs,
    walker: { uid: session.walkerId, displayName: required(names.walkerName, 'walkerName') },
    serviceId: session.serviceId,
    serviceDisplayName: required(session.serviceDisplayName, 'serviceDisplayName'),
    durationMinutes: session.durationMinutes ?? durationFromSchedule(session.scheduledStart, session.scheduledEnd),
    serviceDate: session.scheduledDate,
    startTime: session.scheduledStart,
    endTime: session.scheduledEnd,
    walkStatus: 'completed',
    reportStatus: input.reportStatus,
    financial: null,
    siteOrigin: input.siteOrigin,
    mode: input.mode ?? 'original',
    generatedAt: input.generatedAt,
  })
}
