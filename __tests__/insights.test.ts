import { computeInsights, reportCheckSessionIds, shiftDate, type InsightInputs } from '@/lib/insights'
import type { CanonicalReservationView } from '@/lib/useCanonicalReservations'
import type { DirectoryCustomer, DirectoryDog } from '@/lib/useCanonicalDirectory'

const today = '2026-09-10'

const session = (overrides: Partial<CanonicalReservationView>): CanonicalReservationView => ({
  id: 's1',
  orderId: 'o1',
  customerId: 'c1',
  name: 'Ana López',
  phone: '',
  dogIds: ['d1'],
  petName: 'Luna',
  serviceId: 'paseo-individual',
  service: 'Paseo individual',
  serviceVersion: 1,
  date: today,
  time: '10:00',
  status: 'confirmed',
  assignedWalker: '',
  walkerName: '',
  addressId: 'a1',
  notes: '',
  createdAt: null,
  ...overrides,
})

// Noon in Mexico City on that calendar date.
const registeredOn = (date: string) => {
  const [year, month, day] = date.split('-').map(Number)
  return { seconds: Date.UTC(year, month - 1, day, 18) / 1000, nanoseconds: 0 }
}

const customer = (uid: string, name: string, registered = '2026-01-01'): DirectoryCustomer => ({
  uid, name, email: '', phone: '5512345678', createdAt: registeredOn(registered),
})

const dog = (overrides: Partial<DirectoryDog>): DirectoryDog => ({
  id: 'd1', ownerId: 'c1', name: 'Luna', breed: '', size: 'mediano', petType: 'perro', notes: '', sex: '', age: '', weight: '',
  energyLevel: '', temperament: [], allergies: [], medications: [], vaccines: [], vetName: '', vetPhone: '', specialNeeds: '',
  ...overrides,
})

const run = (partial: Partial<InsightInputs>) => computeInsights({
  sessions: [],
  customers: [],
  dogs: [],
  services: {},
  pricesLoaded: false,
  submittedReportIds: null,
  openGeofenceAlerts: null,
  zonesByAddress: null,
  today,
  periodDays: 30,
  ...partial,
})

const find = (result: ReturnType<typeof run>, id: string) => result.insights.find((insight) => insight.id === id)

describe('Centro de Insights', () => {
  test('sin datos no inventa nada', () => {
    const result = run({})
    expect(result.insights).toEqual([])
    expect(result.metrics).toMatchObject({ walks: 0, completed: 0, cancelRate: 0 })
  })

  test('paseos de hoy sin paseador y paseos pasados sin cerrar, con nombre y perro', () => {
    const result = run({
      sessions: [
        session({ id: 'a', date: today, status: 'requested' }),
        session({ id: 'b', date: '2026-09-08', status: 'confirmed', petName: 'Max', name: 'Luis Pérez' }),
      ],
    })
    expect(find(result, 'unassigned-today')).toMatchObject({ priority: 'high', title: '1 paseo de hoy sin paseador' })
    const stale = find(result, 'stale-open')
    expect(stale).toMatchObject({ priority: 'high', title: '1 paseo pasado sin cerrar' })
    expect(stale?.items[0].detail).toContain('Max · Luis Pérez · Confirmado')
    expect(result.insights[0].priority).toBe('high')
  })

  test('reportes pendientes solo cuando ya se sabe qué reportes se enviaron', () => {
    const sessions = [
      session({ id: 'c', date: '2026-09-09', status: 'completed', walkerName: 'Efrain' }),
      session({ id: 'd', date: '2026-09-08', status: 'completed' }),
      session({ id: 'old', date: '2026-08-01', status: 'completed' }),
    ]
    expect(reportCheckSessionIds(sessions, today)).toEqual(['c', 'd'])
    expect(find(run({ sessions }), 'reports-pending')).toBeUndefined()
    const pending = find(run({ sessions, submittedReportIds: new Set(['c']) }), 'reports-pending')
    expect(pending?.title).toBe('1 paseo completado sin reporte enviado')
    expect(pending?.items).toHaveLength(1)
  })

  test('perro con alergia en un paseo próximo, y refuerzo de vacuna vencido', () => {
    const result = run({
      sessions: [session({ id: 'u', date: '2026-09-12', status: 'confirmed', dogIds: ['d1'] })],
      dogs: [dog({ allergies: ['Pollo'], vaccines: [{ name: 'Rabia', date: '', nextDue: '2026-09-01' }] })],
      customers: [customer('c1', 'Ana López')],
    })
    const care = find(result, 'care-upcoming')
    expect(care?.items[0].detail).toContain('Alergias: Pollo')
    expect(care?.items[0].detail).toContain('Refuerzo vencido: Rabia')
    expect(find(result, 'boosters')?.items[0]).toMatchObject({ label: 'Luna' })
  })

  test('una familia VIP que dejó de reservar es urgente y no se repite en "en riesgo"', () => {
    const june = Array.from({ length: 10 }, (_, index) => session({
      id: `v${index}`, customerId: 'c1', status: 'completed', date: `2026-06-${String(index + 1).padStart(2, '0')}`,
    }))
    const result = run({
      sessions: [...june, session({ id: 'r', customerId: 'c2', status: 'completed', date: '2026-08-05' })],
      customers: [customer('c1', 'Ana López'), customer('c2', 'Luis Pérez')],
    })
    expect(find(result, 'vip-slipping')).toMatchObject({ priority: 'high', title: '1 familia VIP sin reservar' })
    expect(find(result, 'vip-slipping')?.items[0].label).toBe('Ana López')
    expect(find(result, 'at-risk')?.items.map((item) => item.label)).toEqual(['Luis Pérez'])
  })

  test('familia nueva sin su primer paseo y familia sin perro', () => {
    const result = run({ customers: [customer('c3', 'Sofía Ruiz', '2026-09-01')] })
    expect(find(result, 'new-no-walk')?.items[0].label).toBe('Sofía Ruiz')
    expect(find(result, 'no-dog')?.items[0]).toMatchObject({ label: 'Sofía Ruiz', detail: '5512345678' })
  })

  test('alertas de zona abiertas con paseador, zona y distancia', () => {
    const result = run({ openGeofenceAlerts: [{ sessionId: 'x', walkerName: 'Efrain', zoneName: 'Roma', distanceMeters: 850 }] })
    const alert = find(result, 'geofence-open')
    expect(alert).toMatchObject({ priority: 'high', category: 'seguridad', title: '1 alerta de zona sin revisar' })
    expect(alert?.items[0]).toEqual({ label: 'Efrain', detail: 'Zona Roma · a 850 m del centro' })
  })

  test('la tarifa faltante solo se reporta cuando los precios ya cargaron', () => {
    expect(find(run({ pricesLoaded: false }), 'missing-prices')).toBeUndefined()
    expect(find(run({ pricesLoaded: true }), 'missing-prices')?.priority).toBe('high')
  })

  test('demanda por zona: solo con la cadena dirección → zona, y lo que no se sabe se cuenta aparte', () => {
    const sessions = [
      ...Array.from({ length: 6 }, (_, index) => session({ id: `r${index}`, addressId: 'a1', status: 'completed', date: '2026-09-05' })),
      session({ id: 'c1', addressId: 'a2', status: 'cancelled', date: '2026-09-04' }),
      session({ id: 'n1', addressId: 'a3', status: 'completed', date: '2026-09-03' }),
      session({ id: 'x1', addressId: 'sin-leer', status: 'completed', date: '2026-09-02' }),
    ]
    expect(run({ sessions }).zones).toEqual([])

    const result = run({ sessions, zonesByAddress: { a1: 'Roma', a2: 'Condesa', a3: 'Zona no definida' } })
    expect(result.zones).toEqual([
      { zone: 'Roma', walks: 6, completed: 6, cancelled: 0 },
      { zone: 'Condesa', walks: 1, completed: 0, cancelled: 1 },
      { zone: 'Zona no definida', walks: 1, completed: 1, cancelled: 0 },
      { zone: 'Zona desconocida', walks: 1, completed: 1, cancelled: 0 },
    ])
    expect(find(result, 'zone-top')?.title).toBe('Zona con más paseos: Roma')
    expect(find(result, 'zone-missing')?.title).toBe('1 paseo con dirección sin zona')
    // Una sola cancelación no alcanza para señalar una zona.
    expect(find(result, 'zone-cancellations')).toBeUndefined()
  })

  test('patrones solo con suficientes paseos; la anticipación es la mediana', () => {
    // 7 sept 2026 es lunes; se reservaron 1, 2, 3, 4 y 10 días antes.
    const sessions = [1, 2, 3, 4, 10].map((lead, index) => session({
      id: `p${index}`,
      status: 'completed',
      date: '2026-09-07',
      createdAt: registeredOn(shiftDate('2026-09-07', -lead)),
    }))
    const result = run({ sessions })
    expect(find(result, 'peak-day')?.title).toBe('Día más demandado: lunes')
    expect(find(result, 'lead-time')?.title).toBe('Las familias reservan con 3 días de anticipación')
    expect(find(run({ sessions: sessions.slice(0, 4) }), 'peak-day')).toBeUndefined()
  })
})
