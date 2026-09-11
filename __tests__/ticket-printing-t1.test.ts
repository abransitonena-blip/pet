import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { buildTemporaryTicketSnapshot, type BuildTemporaryTicketSnapshotInput, type TemporaryTicketFinancialSnapshot } from '@/lib/finance/domain/ticketPreview'
import { money } from '@/lib/finance/domain/money'
import { encodeCp850 } from '@/lib/printing/cp850'
import { createPetApDogLogo, EscPosEncoder, PET_AP_58MM_PROFILE } from '@/lib/printing/escpos'
import {
  PET_AP_TICKET_DOG_ASSET_SHA256,
  PET_AP_TICKET_DOG_RASTER_SHA256,
  PET_AP_TICKET_DOG_SOURCE_SHA256,
} from '@/lib/printing/ticketDogRaster.generated'
import { buildPetApTicket } from '@/lib/printing/petApTicketBuilder'
import { buildTicketSnapshotFromSession, durationFromSchedule } from '@/lib/printing/ticketSnapshotBuilder'
import { bytesToHex, ManualHexTransport, MockPrinterTransport } from '@/lib/printing/transports'

function input(overrides: Partial<BuildTemporaryTicketSnapshotInput> = {}): BuildTemporaryTicketSnapshotInput {
  return {
    walkSessionId: 'session-001',
    walkReportId: 'session-001',
    customer: { uid: 'customer-001', displayName: 'Familia Pérez' },
    dogs: [{ uid: 'dog-001', displayName: 'Tobi' }],
    walker: { uid: 'walker-001', displayName: 'José Muñoz' },
    serviceId: 'paseo-individual',
    serviceDisplayName: 'Paseo individual',
    durationMinutes: 60,
    serviceDate: '2026-08-08',
    startTime: '10:30',
    endTime: '11:30',
    walkStatus: 'completed',
    reportStatus: 'submitted',
    financial: null,
    siteOrigin: 'https://pet-euhz.vercel.app',
    mode: 'original',
    generatedAt: '2026-08-08T18:00:00.000Z',
    ...overrides,
  }
}

function reliable(overrides: Partial<TemporaryTicketFinancialSnapshot> = {}): TemporaryTicketFinancialSnapshot {
  return {
    reliable: true,
    subtotal: money(10_000),
    discount: money(1_000),
    tip: money(500),
    total: money(9_500),
    amountPaid: money(5_000),
    balanceDue: money(4_500),
    paymentMethod: 'Efectivo',
    paymentStatus: 'partial',
    complimentary: false,
    ...overrides,
  }
}

function ascii(payload: Uint8Array): string {
  return Array.from(payload, (value) => String.fromCharCode(value)).join('')
}

function sha256(value: Uint8Array): string {
  return createHash('sha256').update(value).digest('hex')
}

function isRasterInk(data: Uint8Array, width: number, x: number, y: number): boolean {
  const widthBytes = Math.ceil(width / 8)
  return Boolean(data[y * widthBytes + Math.floor(x / 8)] & (0x80 >> (x % 8)))
}

describe('T1 temporary ticket snapshot', () => {
  it('is deterministic, immutable, internal and never a CFDI', () => {
    const first = buildTemporaryTicketSnapshot(input())
    const second = buildTemporaryTicketSnapshot(input())
    expect(first).toEqual(second)
    expect(first.documentType).toBe('internal-receipt')
    expect(first.isCfdi).toBe(false)
    expect(first.isPersistent).toBe(false)
    expect(first.currency).toBe('MXN')
    expect(first.folio).toMatch(/^DEMO-PET-/)
    expect(Object.isFrozen(first)).toBe(true)
    expect(Object.isFrozen(first.financial)).toBe(true)
    expect(Object.isFrozen(first.dogs)).toBe(true)
  })

  it('keeps unreliable money nullable and rejects false assertions', () => {
    const snapshot = buildTemporaryTicketSnapshot(input())
    expect(snapshot.financial).toMatchObject({ reliable: false, subtotal: null, total: null, amountPaid: null, balanceDue: null, paymentStatus: 'not_registered' })
    expect(() => buildTemporaryTicketSnapshot(input({ financial: { ...reliable(), reliable: false } }))).toThrow('Unreliable financial snapshots')
  })

  it('supports multiple dogs and a nullable end time without inventing duration', () => {
    const snapshot = buildTemporaryTicketSnapshot(input({
      dogs: [{ uid: 'dog-001', displayName: 'Tobi' }, { uid: 'dog-002', displayName: 'Luna' }],
      durationMinutes: null,
      endTime: null,
    }))
    expect(snapshot.dogs.map((dog) => dog.displayName)).toEqual(['Tobi', 'Luna'])
    expect(snapshot.endTime).toBeNull()
    expect(durationFromSchedule('10:30', null)).toBeNull()
  })

  it('builds only from a completed session and never injects current prices', () => {
    const snapshot = buildTicketSnapshotFromSession({
      session: {
        id: 'session-001', customerId: 'customer-001', dogIds: ['dog-001'], walkerId: 'walker-001',
        serviceId: 'paseo-individual', serviceDisplayName: 'Paseo individual', durationMinutes: null,
        scheduledDate: '2026-08-08', scheduledStart: '10:30', scheduledEnd: '11:30', status: 'completed',
      },
      names: { customerName: 'Familia Pérez', dogNames: { 'dog-001': 'Tobi' }, walkerName: 'José Muñoz' },
      reportStatus: 'submitted', siteOrigin: 'https://pet-euhz.vercel.app', generatedAt: '2026-08-08T18:00:00.000Z',
    })
    expect(snapshot.durationMinutes).toBe(60)
    expect(snapshot.financial.reliable).toBe(false)
    expect(snapshot.financial.total).toBeNull()
  })
})

describe('T1 ESC/POS output', () => {
  it('uses the confirmed 58 mm profile, CP850 and Spanish characters', () => {
    expect(PET_AP_58MM_PROFILE).toMatchObject({ paperWidthMm: 58, dotsPerLine: 384, dpi: 203, columns: 32, codePage: 'CP850' })
    expect(Array.from(encodeCp850('José Muñoz'))).toContain(130)
    expect(Array.from(encodeCp850('José Muñoz'))).toContain(164)
    expect(ascii(encodeCp850('emoji 🐾'))).toBe('emoji ?')
  })

  it('contains initialization, raster logo, native QR, feed and final reset', () => {
    const payload = buildPetApTicket(buildTemporaryTicketSnapshot(input()))
    const hex = bytesToHex(payload)
    // 11 bytes menos que antes: el folio impreso pasó del id largo del paseo a
    // su código corto de seis caracteres (ver ticketFolio.ts).
    expect(payload.byteLength).toBe(2927)
    expect(hex.startsWith('1B401B7402')).toBe(true)
    expect(hex).toContain('1D763000')
    expect(hex).toContain('1D286B040031413200')
    expect(hex).toContain('1D286B0300315130')
    expect(hex).toContain('1B6404')
    expect(hex.endsWith('1B40')).toBe(true)
    const logo = createPetApDogLogo()
    expect(logo).toMatchObject({ width: 144, height: 134 })
    expect(sha256(logo.data)).toBe(PET_AP_TICKET_DOG_RASTER_SHA256)
    expect(PET_AP_TICKET_DOG_SOURCE_SHA256).toBe('dada755ff382c57e113f5a06489204990df7ebf530ff9451f8e6e99c61b8b594')
    expect(sha256(readFileSync('public/brand/pet-ap-ticket-dog.png'))).toBe(PET_AP_TICKET_DOG_ASSET_SHA256)
    expect(isRasterInk(logo.data, logo.width, 108, 23)).toBe(false)
    expect(isRasterInk(logo.data, logo.width, 100, 23)).toBe(true)
    expect(isRasterInk(logo.data, logo.width, 80, 50)).toBe(false)
    expect(isRasterInk(logo.data, logo.width, 80, 56)).toBe(true)
  })

  it('does not display a false zero when payment is not registered', () => {
    const output = ascii(buildPetApTicket(buildTemporaryTicketSnapshot(input())))
    expect(output).toContain('Pago: NO REGISTRADO')
    expect(output).not.toContain('$0.00')
    expect(output).toContain('VISTA PREVIA - NO FISCAL')
  })

  it('renders trusted discount, tip, partial payment and balance conditionally', () => {
    const output = ascii(buildPetApTicket(buildTemporaryTicketSnapshot(input({ financial: reliable() }))))
    expect(output).toContain('Subtotal: $100.00 MXN')
    expect(output).toContain('Descuento: -$10.00 MXN')
    expect(output).toContain('Propina: $5.00 MXN')
    expect(output).toContain('Pagado: $50.00 MXN')
    expect(output).toContain('Pendiente: $45.00 MXN')
    expect(output).not.toContain('Pago no registrado =')
  })

  it('prints zero only for an explicit courtesy', () => {
    const courtesy = reliable({
      subtotal: money(0), discount: money(0), tip: money(0), total: money(0), amountPaid: money(0), balanceDue: money(0),
      paymentMethod: null, paymentStatus: 'courtesy', complimentary: true,
    })
    const output = ascii(buildPetApTicket(buildTemporaryTicketSnapshot(input({ financial: courtesy }))))
    expect(output).toContain('Pago: CORTES')
    expect(output).toContain('Total: $0.00 MXN')
  })

  it('marks a reprint without creating another financial assertion', () => {
    const output = ascii(buildPetApTicket(buildTemporaryTicketSnapshot(input({ mode: 'reprint' }))))
    expect(output).toContain('REIMPRESI')
    expect(output).toContain('VISTA PREVIA - NO FISCAL')
  })

  it('produces an identical payload for an identical snapshot', () => {
    const snapshot = buildTemporaryTicketSnapshot(input())
    expect(buildPetApTicket(snapshot)).toEqual(buildPetApTicket(snapshot))
  })

  it('validates raster width and data length', () => {
    expect(() => new EscPosEncoder().raster({ width: 385, height: 1, data: new Uint8Array(49) })).toThrow('invalid-raster-width')
    expect(() => new EscPosEncoder().raster({ width: 8, height: 2, data: new Uint8Array(1) })).toThrow('invalid-raster-data')
  })
})

describe('T1 transports', () => {
  it('creates continuous deterministic uppercase HEX with no prefix or whitespace', async () => {
    const transport = new ManualHexTransport()
    await transport.connect()
    await transport.write(Uint8Array.from([0, 1, 15, 16, 255]))
    expect(transport.getHex()).toBe('00010F10FF')
    expect(transport.getHex()).not.toMatch(/0x|\s/)
    await expect(transport.getStatus()).resolves.toMatchObject({ bytesWritten: 5, state: 'ready' })
  })

  it('mock transport copies data and never writes before connect', async () => {
    const transport = new MockPrinterTransport()
    await expect(transport.write(Uint8Array.of(1))).rejects.toThrow('printer-not-connected')
    await transport.connect()
    const source = Uint8Array.of(1, 2, 3)
    await transport.write(source)
    source[0] = 9
    expect(Array.from(transport.getWrites()[0])).toEqual([1, 2, 3])
  })
})
