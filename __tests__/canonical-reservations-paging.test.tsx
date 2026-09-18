import fs from 'node:fs'
import path from 'node:path'
import { renderHook, waitFor } from '@testing-library/react'
import { useCanonicalReservations, WALK_SESSIONS_PAGE_SIZE } from '@/lib/useCanonicalReservations'

type MockConstraint = { kind: string; value?: unknown }
type MockQuery = { name: string; constraints: MockConstraint[] }

const mockLimits: number[] = []
// Newest first, the order the hook asks for (scheduledDate desc).
const mockSessionDocs = Array.from({ length: 250 }, (_, index) => ({
  id: `s${String(index).padStart(3, '0')}`,
  data: () => ({
    customerId: 'c1',
    dogIds: [],
    serviceId: 'paseo-individual',
    scheduledDate: new Date(Date.UTC(2026, 8, 30) - index * 86_400_000).toISOString().slice(0, 10),
    scheduledStart: '10:00',
    status: 'completed',
    walkerId: '',
  }),
}))

function mockPage(target: MockQuery) {
  if (target.name !== 'walkSessions') return { docs: [], size: 0 }
  let start = 0
  let size = Number.POSITIVE_INFINITY
  for (const constraint of target.constraints) {
    if (constraint.kind === 'startAfter') {
      start = mockSessionDocs.findIndex((item) => item.id === (constraint.value as { id: string }).id) + 1
    }
    if (constraint.kind === 'limit') {
      size = constraint.value as number
      mockLimits.push(size)
    }
  }
  const docs = mockSessionDocs.slice(start, start + size)
  return { docs, size: docs.length }
}

jest.mock('@/firebase/config', () => ({ db: {} }))
jest.mock('@/lib/useCanonicalWalkSessions', () => ({
  classifyCanonicalReadError: () => 'unknown',
}))
jest.mock('@/firebase/db', () => ({ db: {} }))
jest.mock('firebase/firestore', () => ({
  collection: (_db: unknown, name: string) => ({ name }),
  documentId: () => '__name__',
  where: (field: string, op: string, value: unknown) => ({ kind: 'where', value: [field, op, value] }),
  orderBy: () => ({ kind: 'orderBy' }),
  limit: (value: number) => ({ kind: 'limit', value }),
  startAfter: (value: unknown) => ({ kind: 'startAfter', value }),
  query: (ref: { name: string }, ...constraints: MockConstraint[]) => ({ name: ref.name, constraints }),
  onSnapshot: (target: MockQuery, next: (snapshot: unknown) => void) => {
    next(mockPage(target))
    return () => {}
  },
  getDocs: async (target: MockQuery) => mockPage(target),
}))

beforeEach(() => {
  mockLimits.length = 0
})

describe('lectura de paseos en páginas que las reglas aceptan', () => {
  test('pedir 250 paseos nunca manda un límite mayor a 100 y trae los 250 sin repetir', async () => {
    const { result } = renderHook(() => useCanonicalReservations({ max: 250 }))
    await waitFor(() => expect(result.current.loading).toBe(false))
    const ids = result.current.reservations.map((item) => item.id)
    expect(ids).toHaveLength(250)
    expect(new Set(ids).size).toBe(250)
    expect(ids[0]).toBe('s000')
    expect(ids[249]).toBe('s249')
    expect(result.current.error).toBeNull()
    expect(Math.max(...mockLimits)).toBeLessThanOrEqual(WALK_SESSIONS_PAGE_SIZE)
    expect(mockLimits).toEqual([100, 100, 50])
  })

  test('hasta 100 es una sola consulta en vivo', async () => {
    const { result } = renderHook(() => useCanonicalReservations({ max: 50 }))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.reservations).toHaveLength(50)
    expect(mockLimits).toEqual([50])
  })

  test('el tamaño de página es el mismo que el tope de las reglas', () => {
    const rules = fs.readFileSync(path.resolve(__dirname, '../firestore.rules'), 'utf8')
    const walkSessions = rules.slice(rules.indexOf('match /walkSessions/{sessionId}'))
    const listRule = walkSessions.slice(walkSessions.indexOf('allow list'), walkSessions.indexOf('allow create'))
    expect(listRule).toContain(`validListLimit(${WALK_SESSIONS_PAGE_SIZE})`)
  })

  test('Rutas lee paseos directo y respeta el mismo tope', () => {
    const routes = fs.readFileSync(path.resolve(__dirname, '../src/app/admin/rutas/AdminRutasPanel.tsx'), 'utf8')
    const declared = Number(/const MAX_SESSIONS = (\d+)/.exec(routes)?.[1])
    expect(declared).toBeLessThanOrEqual(WALK_SESSIONS_PAGE_SIZE)
  })
})
