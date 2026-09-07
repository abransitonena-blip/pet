import {
  buildPersistentTicketSnapshot,
  persistentTicketFingerprint,
  serviceFolioForSession,
  ticketFolioForSession,
  verificationCodeForTicket,
} from '@/lib/finance/domain'
import { persistentTicketToPrintable } from '@/lib/printing'

function input() {
  return {
    walkSessionId: 'session-1', walkReportId: 'session-1', customerId: 'customer-1', walkerId: 'walker-1',
    dogIds: ['dog-1'], customerName: 'Familia PET', dogNames: { 'dog-1': 'Tobi' }, walkerName: 'Paseador PET',
    serviceId: 'paseo-individual', serviceName: 'Paseo Individual', durationMinutes: 60,
    serviceDate: '2026-08-25', startTime: '10:00', endTime: '11:00',
    siteOrigin: 'https://pet-euhz.vercel.app', createdBy: 'admin-1', createdAt: { serverTimestamp: true },
  } as const
}

describe('T2 persistent internal ticket contract', () => {
  test('builds deterministic immutable IDs, folios and a non-financial receipt', () => {
    const ticket = buildPersistentTicketSnapshot(input())
    expect(ticket).toMatchObject({
      schemaVersion: 1, documentType: 'internal-receipt', isCfdi: false, currency: 'MXN',
      folio: 'TKT-session-1', serviceFolio: 'PET-session-1', walkSessionId: 'session-1',
      paymentStatus: 'not_recorded', subtotalCents: null, discountCents: null, tipCents: null,
      totalCents: null, amountPaidCents: null, balanceDueCents: null, paymentMethod: null, status: 'active',
    })
    expect(Object.isFrozen(ticket)).toBe(true)
    expect(ticketFolioForSession('session-1')).toBe('TKT-session-1')
    expect(serviceFolioForSession('session-1')).toBe('PET-session-1')
    expect(verificationCodeForTicket('session-1', 'session-1')).toMatch(/^[0-9A-Z]{6}$/)
  })

  test('ignores only server creation time for idempotency and detects payload changes', () => {
    const first = buildPersistentTicketSnapshot(input())
    const replay = buildPersistentTicketSnapshot({ ...input(), createdAt: { otherServerTimestamp: true } })
    const conflict = buildPersistentTicketSnapshot({ ...input(), serviceName: 'Nombre alterado' })
    expect(persistentTicketFingerprint(first)).toBe(persistentTicketFingerprint(replay))
    expect(persistentTicketFingerprint(first)).not.toBe(persistentTicketFingerprint(conflict))
  })

  test('rejects mismatched report and unsafe origins', () => {
    expect(() => buildPersistentTicketSnapshot({ ...input(), walkReportId: 'report-2' })).toThrow('walkReportId must match')
    expect(() => buildPersistentTicketSnapshot({ ...input(), siteOrigin: 'https://user:secret@example.com' })).toThrow('credential-free HTTPS')
  })

  test('adapts the persistent snapshot to the existing ESC/POS builder without inventing money', () => {
    const printable = persistentTicketToPrintable(buildPersistentTicketSnapshot(input()), 'reprint', '2026-08-25T12:00:00.000Z')
    expect(printable.folio).toBe('TKT-session-1')
    expect(printable.mode).toBe('reprint')
    expect(printable.financial).toEqual(expect.objectContaining({ reliable: false, total: null, paymentStatus: 'not_registered' }))
  })
})

