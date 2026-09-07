import {
  WALK_REPORT_TEXT_LIMITS,
  toReportTicketReference,
  validateWalkReportContent,
  walkReportId,
  type WalkReport,
  type WalkReportContent,
} from '@/lib/walkReports'

const empty: WalkReportContent = {
  summary: '', behaviorNotes: '', bathroomNotes: '', waterProvided: false, incidentsSummary: '', mediaReferences: [],
}

describe('canonical walk report contract', () => {
  test('uses the walk session id deterministically', () => {
    expect(walkReportId('session-1')).toBe('session-1')
    expect(() => walkReportId('')).toThrow('invalid-walk-session-id')
    expect(() => walkReportId('session/other')).toThrow('invalid-walk-session-id')
  })

  test('allows partial drafts and requires a summary for submission', () => {
    expect(validateWalkReportContent(empty, 'draft')).toEqual([])
    expect(validateWalkReportContent(empty, 'submit')).toContain('summary-required')
    expect(validateWalkReportContent({ ...empty, summary: 'Paseo completado' }, 'submit')).toEqual([])
  })

  test('enforces text limits and keeps private media disabled', () => {
    expect(validateWalkReportContent({ ...empty, summary: 'x'.repeat(WALK_REPORT_TEXT_LIMITS.summary + 1) }, 'draft')).toContain('summary-too-long')
    expect(validateWalkReportContent({ ...empty, mediaReferences: ['https://public.example/photo'] }, 'draft')).toContain('media-disabled')
  })

  test('ticket adapter accepts only a submitted report and invents no payment data', () => {
    const report = {
      ...empty,
      summary: 'Paseo completado',
      walkSessionId: 'session-1',
      orderId: 'order-1',
      customerId: 'customer-1',
      walkerId: 'walker-1',
      dogIds: ['dog-1'],
      status: 'submitted',
      createdBy: 'walker-1',
      createdAt: '2026-08-24T00:00:00Z',
      updatedAt: '2026-08-24T00:00:00Z',
      submittedAt: '2026-08-24T00:00:00Z',
      schemaVersion: 1,
    } satisfies WalkReport
    expect(toReportTicketReference(report)).toEqual({
      walkSessionId: 'session-1',
      reportId: 'session-1',
      reportPath: '/familia/reportes/session-1',
      reportStatus: 'submitted',
      schemaVersion: 1,
    })
    expect(toReportTicketReference(report)).not.toHaveProperty('paymentId')
    expect(() => toReportTicketReference({ ...report, status: 'draft' })).toThrow('walk-report-not-submitted')
  })
})
