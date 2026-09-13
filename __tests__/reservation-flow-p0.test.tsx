import { fireEvent, render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import StepV2Service from '@/components/reservation-steps-v2/StepV2Service'
import { getReservationValidationIssues, isValidSameDayWindow, timeToMinutes } from '@/lib/reservationValidation'
import { getReservationServiceOptions } from '@/lib/walkServices'
import { submitReservation } from '@/lib/submitReservation'
import { createEmptyServicePrices, type PublicServicePrice } from '@/lib/servicePricing'
import { getReservationServiceDefinitions } from '@/lib/walkServices'

const mockBatchSet = jest.fn()
const mockBatchCommit = jest.fn()
const mockWriteBatch = jest.fn(() => ({ set: mockBatchSet, commit: mockBatchCommit }))
const mockGetDoc = jest.fn()

jest.mock('@/firebase/config', () => ({ auth: { currentUser: { uid: 'customer-1' } }, db: {} }))
jest.mock('firebase/firestore', () => ({
  collection: jest.fn((_db: unknown, name: string) => ({ name })),
  doc: jest.fn((...args: unknown[]) => args.length === 3
    ? { collection: args[1], id: args[2] }
    : { id: 'deterministic-test-id' }),
  getDoc: (reference: unknown) => mockGetDoc(reference),
  serverTimestamp: jest.fn(() => 'server-timestamp'),
  writeBatch: () => mockWriteBatch(),
}))

describe('catálogo de reserva', () => {
  const configuredPrices = (overrides: Record<string, Partial<PublicServicePrice>> = {}) => {
    const prices = createEmptyServicePrices(getReservationServiceDefinitions())
    for (const [id, override] of Object.entries(overrides)) prices[id] = { ...prices[id], ...override }
    return prices
  }

  test('expone el catálogo real y nunca convierte una tarifa ausente en cero', () => {
    const options = getReservationServiceOptions(configuredPrices({
      'paseo-individual': { amountCents: 18_000, active: true, version: 1 },
      'paseo-esencial': { amountCents: 0, active: false, complimentary: false, version: 1 },
    }))

    // Owner decision (2026-09-10): a short catalogue; adiestramiento joined it
    // on 2026-09-13. The remaining definitions still exist for the price rules,
    // but are never listed.
    expect(options.map((item) => item.id)).toEqual(['paseo-individual', 'paseo-extendido', 'paseo-adiestramiento'])
    expect(options.find((item) => item.name === 'Paseo Individual')).toMatchObject({
      id: 'paseo-individual', amountCents: 18_000, isRequestable: true,
    })
    expect(options.find((item) => item.name === 'Paseo Extendido')).toMatchObject({
      amountCents: null, isRequestable: false, unavailableReason: 'Precio no configurado',
    })
    expect(options.find((item) => item.name === 'Paseo Esencial')).toBeUndefined()
  })

  // Deliberate product change: a plan the customer cannot book is no longer
  // listed as a greyed-out row. The catalog helper above still reports every
  // service with its isRequestable flag -- what changed is only what the
  // booking step renders.
  test('oculta las opciones sin precio y conserva una selección válida', () => {
    const updateForm = jest.fn()
    const prices = configuredPrices({ 'paseo-individual': { amountCents: 18_000, active: true, version: 3 } })
    const form = { serviceId: '', serviceName: '', servicePackageType: '' as const, serviceAmountCents: null, serviceVersion: null, serviceComplimentary: false, serviceDurationMinutes: null }
    const { rerender } = render(
      <StepV2Service form={form} updateForm={updateForm} prices={prices} priceStatus="ready" onNext={jest.fn()} onBack={jest.fn()} />,
    )

    expect(screen.queryByText('Precio no configurado')).toBeNull()
    expect(screen.queryByRole('radio', { name: /Paseo Extendido/ })).toBeNull()
    expect(screen.getByText(/tarifa publicada/)).toBeTruthy()
    fireEvent.click(screen.getByRole('radio', { name: /Paseo Individual/ }))
    expect(updateForm).toHaveBeenCalledWith({
      serviceId: 'paseo-individual',
      serviceName: 'Paseo Individual',
      servicePackageType: 'individual',
      serviceAmountCents: 18_000,
      serviceVersion: 3,
      serviceComplimentary: false,
      serviceDurationMinutes: 30,
    })

    rerender(
      <StepV2Service
        form={{ serviceId: 'paseo-individual', serviceName: 'Paseo Individual', servicePackageType: 'individual', serviceAmountCents: 18_000, serviceVersion: 3, serviceComplimentary: false, serviceDurationMinutes: 30 }}
        updateForm={updateForm}
        prices={prices}
        priceStatus="ready"
        onNext={jest.fn()}
        onBack={jest.fn()}
      />,
    )
    expect(screen.getByRole('radio', { name: /Paseo Individual/ }).getAttribute('aria-checked')).toBe('true')
  })
})

describe('validación final de reserva', () => {
  beforeEach(() => {
    mockGetDoc.mockImplementation(async (reference: { collection?: string }) => ({
      exists: () => true,
      data: () => reference.collection === 'zones'
        ? { active: true }
        : reference.collection === 'addresses'
          ? { ownerId: 'customer-1', zoneId: 'zone-1' }
          : { ownerId: 'customer-1' },
    }))
  })

  test('enumera cada dato faltante con el paso donde se corrige', () => {
    const issues = getReservationValidationIssues({
      petId: '', addressId: '', whenType: 'scheduled', date: '', windowStart: '', windowEnd: '',
      serviceId: '', serviceName: '', servicePackageType: '', serviceAmountCents: null, serviceVersion: null, serviceComplimentary: false, serviceDurationMinutes: null,
    })

    expect(issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'petId', step: 'details' }),
      expect.objectContaining({ field: 'addressId', step: 'details' }),
      expect.objectContaining({ field: 'date', step: 'schedule' }),
      expect.objectContaining({ field: 'windowStart', step: 'schedule' }),
      expect.objectContaining({ field: 'windowEnd', step: 'schedule' }),
      expect.objectContaining({ field: 'serviceId', step: 'service' }),
    ]))
  })

  test('bloquea una dirección sin zona y no fabrica IDs temporales', () => {
    const issues = getReservationValidationIssues({
      petId: 'dog-1', addressId: 'address-1', zoneId: '', zoneActive: false, whenType: 'scheduled',
      date: '2026-08-30', windowStart: '10:00', windowEnd: '11:00',
      serviceId: 'paseo-individual', serviceName: 'Paseo Individual', servicePackageType: 'individual',
      serviceAmountCents: 3_000, serviceVersion: 1, serviceComplimentary: false, serviceDurationMinutes: 60,
    })
    expect(issues).toContainEqual(expect.objectContaining({ field: 'zoneId', step: 'details' }))
    const addressStep = readFileSync('src/components/reservation-steps-v2/StepV2Address.tsx', 'utf8')
    expect(addressStep).not.toContain('addr_${Date.now()}')
    expect(addressStep).toContain('/familia/direcciones')
  })

  test('bloquea una dirección cuya zona dejó de estar activa', () => {
    const issues = getReservationValidationIssues({
      petId: 'dog-1', addressId: 'address-1', zoneId: 'zone-legacy', zoneActive: false, whenType: 'scheduled',
      date: '2026-08-30', windowStart: '10:00', windowEnd: '11:00',
      serviceId: 'paseo-individual', serviceName: 'Paseo Individual', servicePackageType: 'individual',
      serviceAmountCents: 3_000, serviceVersion: 1, serviceComplimentary: false, serviceDurationMinutes: 60,
    })
    expect(issues).toContainEqual(expect.objectContaining({
      field: 'zoneId', step: 'details', label: 'La zona de esta dirección ya no está disponible',
    }))
  })

  test('acepta una solicitud individual completa y rechaza una tarifa ausente', () => {
    const valid = {
      petId: 'dog-1', addressId: 'address-1', zoneId: 'zone-1', zoneActive: true, whenType: 'scheduled' as const,
      date: '2026-08-30', windowStart: '10:00', windowEnd: '11:00',
      serviceId: 'paseo-individual', serviceName: 'Paseo Individual',
      servicePackageType: 'individual' as const, serviceAmountCents: 18_000, serviceVersion: 1, serviceComplimentary: false,
      serviceDurationMinutes: 60,
    }
    expect(getReservationValidationIssues(valid)).toEqual([])
    expect(getReservationValidationIssues({ ...valid, serviceAmountCents: null })).toContainEqual(
      expect.objectContaining({ field: 'servicePrice', step: 'service' }),
    )
  })

  test.each([
    ['11:00', '11:00'],
    ['12:00', '11:00'],
    ['', '11:00'],
    ['11:00', ''],
    ['25:00', '26:00'],
  ])('rechaza la ventana no válida %s–%s', (windowStart, windowEnd) => {
    expect(isValidSameDayWindow(windowStart, windowEnd)).toBe(false)
    const issues = getReservationValidationIssues({
      petId: 'dog-1', addressId: 'address-1', zoneId: 'zone-1', whenType: 'scheduled', date: '2026-08-30', windowStart, windowEnd,
      serviceId: 'paseo-individual', serviceName: 'Paseo Individual', servicePackageType: 'individual',
      serviceAmountCents: 3_000, serviceVersion: 1, serviceComplimentary: false, serviceDurationMinutes: 60,
    })
    expect(issues.some((issue) => issue.step === 'schedule')).toBe(true)
  })

  test('acepta únicamente un final posterior durante el mismo día', () => {
    expect(timeToMinutes('10:30')).toBe(630)
    expect(isValidSameDayWindow('10:30', '11:00')).toBe(true)
    expect(isValidSameDayWindow('23:30', '00:30')).toBe(false)
  })

  test('el bloqueo de doble envío ocurre antes de invocar submitReservation', () => {
    const flow = readFileSync('src/components/reservation-steps-v2/ReservationFlow.tsx', 'utf8')
    expect(flow.indexOf('if (submissionLocked.current) return')).toBeLessThan(flow.indexOf('await submitReservation'))
    expect(flow).toContain('submissionLocked.current = true')
    expect(flow).toContain('submissionLocked.current = false')
  })

  test('submitReservation valida antes de construir referencias o batches', () => {
    const submit = readFileSync('src/lib/submitReservation.ts', 'utf8')
    expect(submit.indexOf("throw new Error('SERVICE_PRICE_NOT_CONFIGURED')")).toBeLessThan(submit.indexOf("doc(collection(db, 'serviceOrders'))"))
    expect(submit.indexOf("throw new Error('BOOKING_SCHEDULE_INCOMPLETE')")).toBeLessThan(submit.indexOf("doc(collection(db, 'serviceOrders'))"))
    expect(submit.indexOf('parseTimeWindow(time)')).toBeLessThan(submit.indexOf("doc(collection(db, 'serviceOrders'))"))
  })

  test('el editor actualiza el documento existente, conserva ownerId y usa un retorno cerrado', () => {
    const editor = readFileSync('src/app/familia/direcciones/page.tsx', 'utf8')
    const addressStep = readFileSync('src/components/reservation-steps-v2/StepV2Address.tsx', 'utf8')
    expect(editor).toContain("updateDoc(doc(db, 'addresses', editing.id), data)")
    expect(editor).toContain('ownerId: user.uid')
    expect(editor).toContain("searchParams.get('returnTo') === '/familia/nueva-reserva'")
    expect(addressStep).toContain('/familia/direcciones?returnTo=/familia/nueva-reserva')
  })

  test('una zona desactivada falla antes de crear IDs, referencias o batches', async () => {
    mockGetDoc.mockImplementation(async (reference: { collection?: string }) => ({
      exists: () => true,
      data: () => reference.collection === 'zones'
        ? { active: false }
        : reference.collection === 'addresses'
          ? { ownerId: 'customer-1', zoneId: 'zone-1' }
          : { ownerId: 'customer-1' },
    }))
    mockWriteBatch.mockClear()
    await expect(submitReservation({
      form: {
        name: '', phone: '', petId: 'dog-1', petName: 'Compañero', petType: 'perro', zoneId: 'zone-1',
        serviceId: 'paseo-individual', serviceName: 'Paseo Individual', servicePackageType: 'individual', serviceVersion: 1,
        serviceDurationMinutes: 60,
        date: '2026-08-30', time: '10:00-11:00', notes: '', coupon: '', addressId: 'address-1', walkerPreference: '',
      },
      couponStatus: null, referralCode: '', walkerPreference: '', availableWalkers: [], selectedAddressId: 'address-1',
    })).rejects.toThrow('BOOKING_ZONE_UNAVAILABLE')
    expect(mockWriteBatch).not.toHaveBeenCalled()
  })

  test('un intervalo igual o inverso no construye referencias ni batches', async () => {
    mockWriteBatch.mockClear()
    mockBatchCommit.mockClear()
    const base = {
      name: '', phone: '', petId: 'dog-1', petName: 'Compañero', petType: 'perro',
      serviceId: 'paseo-individual', serviceName: 'Paseo Individual', servicePackageType: 'individual' as const, serviceVersion: 1,
      serviceDurationMinutes: 60,
      zoneId: 'zone-1',
      date: '2026-08-30', notes: '', coupon: '', addressId: 'address-1', walkerPreference: '',
    }
    await expect(submitReservation({
      form: { ...base, time: '11:00-11:00' }, couponStatus: null, referralCode: '', walkerPreference: '', availableWalkers: [], selectedAddressId: 'address-1',
    })).rejects.toThrow('BOOKING_INVALID_TIME_WINDOW')
    await expect(submitReservation({
      form: { ...base, time: '12:00-11:00' }, couponStatus: null, referralCode: '', walkerPreference: '', availableWalkers: [], selectedAddressId: 'address-1',
    })).rejects.toThrow('BOOKING_INVALID_TIME_WINDOW')
    expect(mockWriteBatch).not.toHaveBeenCalled()
    expect(mockBatchCommit).not.toHaveBeenCalled()
  })

  test('una tarifa ausente no construye ni confirma escrituras', async () => {
    mockWriteBatch.mockClear()
    mockBatchCommit.mockClear()
    await expect(submitReservation({
      form: {
        name: '', phone: '', petId: 'dog-1', petName: 'Compañero', petType: 'perro',
        serviceId: 'paseo-individual', serviceName: 'Paseo Individual', servicePackageType: 'individual', serviceVersion: null,
        serviceDurationMinutes: 60,
        zoneId: 'zone-1',
        date: '2026-08-30', time: '10:00-11:00', notes: '', coupon: '', addressId: 'address-1', walkerPreference: '',
      },
      couponStatus: null, referralCode: '', walkerPreference: '', availableWalkers: [], selectedAddressId: 'address-1',
    })).rejects.toThrow('SERVICE_PRICE_NOT_CONFIGURED')
    expect(mockWriteBatch).not.toHaveBeenCalled()
    expect(mockBatchCommit).not.toHaveBeenCalled()
  })
})
