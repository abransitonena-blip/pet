import type { PersistentPrintMode, PersistentTicketSnapshot } from '@/lib/finance/domain'
import type { TemporaryTicketSnapshot } from '@/lib/finance/domain/ticketPreview'

export function persistentTicketToPrintable(
  ticket: PersistentTicketSnapshot,
  mode: PersistentPrintMode,
  generatedAt: string,
): TemporaryTicketSnapshot {
  return Object.freeze({
    documentType: 'internal-receipt',
    isCfdi: false,
    isPersistent: false,
    currency: 'MXN',
    ticketId: ticket.walkSessionId,
    folio: ticket.folio,
    walkSessionId: ticket.walkSessionId,
    walkReportId: ticket.walkReportId,
    customer: Object.freeze({ uid: ticket.customerId, displayName: ticket.customerName }),
    dogs: Object.freeze(ticket.dogIds.map((uid) => Object.freeze({ uid, displayName: ticket.dogNames[uid] }))),
    walker: Object.freeze({ uid: ticket.walkerId, displayName: ticket.walkerName }),
    serviceId: ticket.serviceId,
    serviceDisplayName: ticket.serviceName,
    durationMinutes: ticket.durationMinutes,
    serviceDate: ticket.serviceDate,
    startTime: ticket.startTime,
    endTime: ticket.endTime,
    walkStatus: 'completed',
    reportStatus: 'submitted',
    financial: Object.freeze({
      reliable: false,
      subtotal: null,
      discount: null,
      tip: null,
      total: null,
      amountPaid: null,
      balanceDue: null,
      paymentMethod: null,
      paymentStatus: 'not_registered',
      complimentary: false,
    }),
    reportUrl: ticket.reportUrl,
    verificationCode: ticket.verificationCode,
    mode,
    generatedAt,
  })
}

