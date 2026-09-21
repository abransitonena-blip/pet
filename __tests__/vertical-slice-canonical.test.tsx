import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import CanonicalDispatchPanel from '@/components/admin/CanonicalDispatchPanel'
import { planFamilyHome } from '@/lib/familyHome'
import { STATUS_LABELS } from '@/lib/sessionMachine'

const mockRequested = jest.fn()
const mockWalkers = jest.fn()
const mockCustomer = jest.fn()
const mockAddressZones = jest.fn()
const mockAssign = jest.fn()
const mockReprogram = jest.fn()

jest.mock('@/lib/useCanonicalWalkSessions', () => ({
  useRequestedWalkSessions: () => mockRequested(),
  useActiveWalkerOptions: () => mockWalkers(),
  useCustomerWalkSessions: () => mockCustomer(),
  useCanonicalAddressZones: () => mockAddressZones(),
  useUpcomingAssignments: () => ({ assignments: [], capped: false }),
  assignCanonicalWalkSession: (...args: unknown[]) => mockAssign(...args),
  reprogramCanonicalWalkSession: (...args: unknown[]) => mockReprogram(...args),
  canonicalReadErrorMessage: (error: string) => error === 'permission-denied' ? 'Tu sesión no tiene permiso para consultar estas solicitudes.' : 'Error de red',
  CanonicalOperationError: class CanonicalOperationError extends Error {},
}))

const session = {
  id: 'session-canonical-123456', orderId: 'order-1', customerId: 'customer-1', dogIds: ['dog-1'],
  addressId: 'address-1', serviceId: 'walk-30', scheduledDate: '2026-08-20', scheduledStart: '10:00',
  status: 'requested',
}

beforeEach(() => {
  jest.clearAllMocks()
  mockRequested.mockReturnValue({ sessions: [], loading: false, error: null, retry: jest.fn() })
  mockWalkers.mockReturnValue({ walkers: [], loading: false, error: null })
  mockCustomer.mockReturnValue({ sessions: [], loading: false, error: null, retry: jest.fn() })
  mockAddressZones.mockReturnValue({ zonesByAddress: { 'address-1': 'La Quebrada' }, error: null })
  mockAssign.mockResolvedValue(undefined)
  mockReprogram.mockResolvedValue(undefined)
})

test('Admin distinguishes loading, permission and empty states', () => {
  mockRequested.mockReturnValueOnce({ sessions: [], loading: true, error: null, retry: jest.fn() })
  const { rerender } = render(<CanonicalDispatchPanel />)
  expect(screen.getAllByText(/Consultando solicitudes/).length).toBeGreaterThan(0)

  mockRequested.mockReturnValueOnce({ sessions: [], loading: false, error: 'permission-denied', retry: jest.fn() })
  rerender(<CanonicalDispatchPanel />)
  expect(screen.getByText(/no tiene permiso/)).toBeTruthy()

  mockRequested.mockReturnValueOnce({ sessions: [], loading: false, error: null, retry: jest.fn() })
  rerender(<CanonicalDispatchPanel />)
  expect(screen.getByText('No hay solicitudes pendientes')).toBeTruthy()
})

test('Admin reviews and confirms assignment before the transaction', async () => {
  mockRequested.mockReturnValue({ sessions: [session], loading: false, error: null, retry: jest.fn() })
  mockWalkers.mockReturnValue({ walkers: [{ uid: 'walker-1', name: 'Paseador activo', status: 'active' }], loading: false, error: null })
  render(<CanonicalDispatchPanel />)
  expect(screen.getByText('La Quebrada')).toBeTruthy()
  fireEvent.change(screen.getByLabelText('Paseador'), { target: { value: 'walker-1' } })
  fireEvent.click(screen.getByRole('button', { name: 'Revisar asignación' }))
  expect(screen.getByRole('dialog').textContent).toContain('Confirmar asignación')
  expect(mockAssign).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Asignar paseador' }))
  await waitFor(() => expect(mockAssign).toHaveBeenCalledWith(session.id, 'walker-1'))
})

test('Familia: una solicitud nueva es su próximo paseo y se ve como Solicitado', () => {
  // El inicio ya no tiene su propia lista de solicitudes: leía en orden
  // ascendente con tope y mostraba los cinco paseos más antiguos de la cuenta.
  expect(planFamilyHome([]).next).toBeNull()
  const requested = { id: session.id, status: 'requested' as const, date: '2026-09-20', time: '10:00', assignedWalker: '' }
  const home = planFamilyHome([requested])
  expect(home.next).toBe(requested)
  expect(STATUS_LABELS[home.next!.status]).toBe('Solicitado')
  expect(readFileSync('src/app/familia/FamiliaPanel.tsx', 'utf8')).toContain('No tienes paseos por delante')
})

test('frontend uses bounded canonical queries and does not submit payment data', () => {
  const hooks = readFileSync('src/lib/useCanonicalWalkSessions.ts', 'utf8')
  const walkerHooks = readFileSync('src/lib/useServiceOrders.ts', 'utf8')
  const submit = readFileSync('src/lib/submitReservation.ts', 'utf8')
  // La consulta por dueño vive en un solo constructor, compartido con las páginas que siguen.
  const queries = readFileSync('src/lib/walkWindowQueries.ts', 'utf8')
  expect(hooks).toContain("walkWindowQuery(db, { field: 'customerId', uid: customerId }")
  expect(queries).toContain("where(owner.field, '==', owner.uid)")
  expect(hooks).toContain("where('status', '==', 'requested')")
  expect(hooks).toContain("where('status', '==', 'active')")
  expect(walkerHooks).toContain("walkWindowQuery(db, { field: 'walkerId', uid: walkerId }")
  expect(hooks).toContain('limit(100)')
  expect(queries).toContain('limit(WALK_WINDOW_CAP)')
  expect(submit).toContain("paymentStatus: 'pending'")
  expect(submit).not.toContain('walkerId:')
  expect(submit).not.toContain("collection(db, 'reservations')")
  expect(submit).not.toContain('addDoc(')
})
