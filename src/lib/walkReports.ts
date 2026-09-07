export const WALK_REPORT_SCHEMA_VERSION = 1 as const
export const WALK_REPORT_TEXT_LIMITS = Object.freeze({
  summary: 1200,
  behaviorNotes: 800,
  bathroomNotes: 500,
  incidentsSummary: 800,
})

export type WalkReportStatus = 'draft' | 'submitted'

export interface WalkReportContent {
  summary: string
  behaviorNotes: string
  bathroomNotes: string
  waterProvided: boolean
  incidentsSummary: string
  mediaReferences: readonly string[]
}

export interface WalkReport extends WalkReportContent {
  walkSessionId: string
  orderId: string
  customerId: string
  walkerId: string
  dogIds: readonly string[]
  status: WalkReportStatus
  createdBy: string
  createdAt: unknown
  updatedAt: unknown
  submittedAt: unknown | null
  schemaVersion: typeof WALK_REPORT_SCHEMA_VERSION
}

export type WalkReportValidationError =
  | 'summary-required'
  | 'summary-too-long'
  | 'behavior-too-long'
  | 'bathroom-too-long'
  | 'incidents-too-long'
  | 'media-disabled'

export function walkReportId(walkSessionId: string): string {
  const id = walkSessionId.trim()
  if (!id || id.includes('/')) throw new Error('invalid-walk-session-id')
  return id
}

export function validateWalkReportContent(content: WalkReportContent, mode: 'draft' | 'submit'): WalkReportValidationError[] {
  const errors: WalkReportValidationError[] = []
  if (mode === 'submit' && content.summary.trim().length === 0) errors.push('summary-required')
  if (content.summary.length > WALK_REPORT_TEXT_LIMITS.summary) errors.push('summary-too-long')
  if (content.behaviorNotes.length > WALK_REPORT_TEXT_LIMITS.behaviorNotes) errors.push('behavior-too-long')
  if (content.bathroomNotes.length > WALK_REPORT_TEXT_LIMITS.bathroomNotes) errors.push('bathroom-too-long')
  if (content.incidentsSummary.length > WALK_REPORT_TEXT_LIMITS.incidentsSummary) errors.push('incidents-too-long')
  if (content.mediaReferences.length > 0) errors.push('media-disabled')
  return errors
}

export interface ReportTicketReference {
  walkSessionId: string
  reportId: string
  reportPath: string
  reportStatus: 'submitted'
  schemaVersion: number
}

export function toReportTicketReference(report: WalkReport): Readonly<ReportTicketReference> {
  if (report.status !== 'submitted') throw new Error('walk-report-not-submitted')
  const reportId = walkReportId(report.walkSessionId)
  return Object.freeze({
    walkSessionId: report.walkSessionId,
    reportId,
    reportPath: `/familia/reportes/${encodeURIComponent(reportId)}`,
    reportStatus: 'submitted',
    schemaVersion: report.schemaVersion,
  })
}
