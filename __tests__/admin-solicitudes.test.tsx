import React from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { readdirSync, readFileSync } from 'node:fs'

const mockRequested = jest.fn()
const mockReprogram = jest.fn()

jest.mock('@/lib/useCanonicalWalkSessions', () => ({
  useRequestedWalkSessions: () => mockRequested(),
  useActiveWalkerOptions: () => ({ walkers: [{ uid: 'walker-1', name: 'Ana', status: 'active' }], loading: false, error: null }),
  useCanonicalAddressZones: () => ({ zonesByAddress: {}, error: null }),
  assignCanonicalWalkSession: jest.fn(),
  reprogramCanonicalWalkSession: (...args: unknown[]) => mockReprogram(...args),
  canonicalReadErrorMessage: () => 'Error',
  CanonicalOperationError: class CanonicalOperationError extends Error {},
}))
jest.mock('@/lib/push/pushClient', () => ({ notifySessionEvent: jest.fn() }))

import CanonicalDispatchPanel from '../src/components/admin/CanonicalDispatchPanel'
import { dispatchUrgency, orderDispatchQueue } from '../src/lib/dispatchQueue'
import { nextDay, whenLabel } from '../src/lib/dateLabels'

const read = (path: string) => readFileSync(path, 'utf8')

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = `${dir}/${entry.name}`
    if (entry.isDirectory()) return sourceFiles(path)
    return /\.tsx?$/.test(entry.name) && !path.startsWith('src/context/') ? [path] : []
  })
}
const today = () => new Date().toLocaleDateString('en-CA')

function request(id: string, scheduledDate: string, scheduledStart = '10:00', createdOrder = 0) {
  return {
    id, orderId: 'order-1', customerId: 'customer-1', dogIds: ['dog-1'], addressId: 'address-1',
    serviceId: 'paseo-individual', scheduledDate, scheduledStart, status: 'requested', createdOrder,
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  mockReprogram.mockResolvedValue(undefined)
})

describe('qué urge en la cola', () => {
  it('distingue fecha pasada, hoy, mañana y después, también al cruzar de mes', () => {
    expect(dispatchUrgency('2026-09-14', '2026-09-15')).toBe('overdue')
    expect(dispatchUrgency('2026-09-15', '2026-09-15')).toBe('today')
    expect(dispatchUrgency('2026-10-01', '2026-09-30')).toBe('tomorrow')
    expect(dispatchUrgency('2026-09-20', '2026-09-15')).toBe('later')
    expect(dispatchUrgency('', '2026-09-15')).toBe('later')
    expect(nextDay('2026-12-31')).toBe('2027-01-01')
  })

  it('ordena por la fecha del paseo, no por cuándo se pidió; sin fecha al final', () => {
    const queue = [
      request('pedida-primero-para-el-mes', '2026-10-10', '10:00', 1),
      request('sin-fecha', '', '', 2),
      request('pedida-ayer-para-hoy-tarde', '2026-09-15', '17:00', 3),
      request('pedida-ayer-para-hoy-temprano', '2026-09-15', '08:00', 4),
    ]
    expect(orderDispatchQueue(queue).map((item) => item.id)).toEqual([
      'pedida-ayer-para-hoy-temprano', 'pedida-ayer-para-hoy-tarde', 'pedida-primero-para-el-mes', 'sin-fecha',
    ])
  })
})

describe('el panel de solicitudes', () => {
  it('abre con la que urge, con su palabra y el nombre del servicio', () => {
    const yesterday = new Date(Date.now() - 86_400_000).toLocaleDateString('en-CA')
    mockRequested.mockReturnValue({
      sessions: [request('later-one', '2099-01-01'), request('overdue-one', yesterday)],
      loading: false, error: null, retry: jest.fn(),
    })
    render(<CanonicalDispatchPanel />)
    const cards = screen.getAllByRole('button', { name: 'Revisar asignación' })
    expect(cards).toHaveLength(2)
    expect(screen.getByText('1 con fecha pasada')).toBeTruthy()
    const labels = screen.getAllByText(/Fecha pasada|Programada/).map((node) => node.textContent)
    expect(labels).toEqual(['Fecha pasada', 'Programada'])
    expect(screen.queryByText('paseo-individual')).toBeNull()
  })

  it('cambiar el horario queda a un toque, y se cierra al guardarlo', async () => {
    mockRequested.mockReturnValue({
      sessions: [request('x', today())], loading: false, error: null, retry: jest.fn(),
    })
    const { container } = render(<CanonicalDispatchPanel />)
    const panel = container.querySelector('#reprogram-x') as HTMLElement
    expect(panel).toHaveProperty('hidden', true)

    const toggle = screen.getByRole('button', { name: /Cambiar fecha u hora/ })
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(toggle)
    expect(panel).toHaveProperty('hidden', false)

    fireEvent.change(within(panel).getByLabelText('Nueva hora'), { target: { value: '12:30' } })
    fireEvent.click(within(panel).getByRole('button', { name: 'Revisar cambio' }))
    fireEvent.click(screen.getByRole('button', { name: 'Guardar horario' }))
    await waitFor(() => expect(mockReprogram).toHaveBeenCalledWith('x', { scheduledDate: today(), scheduledStart: '12:30' }))
    await waitFor(() => expect(panel).toHaveProperty('hidden', true))
  })

  it('dice "Hoy" y "Mañana" en lugar de la fecha cruda', () => {
    expect(whenLabel(today(), today())).toBe('Hoy')
    expect(whenLabel(nextDay(today()), today())).toBe('Mañana')
  })
})

describe('lo que Solicitudes ya no carga de entrada', () => {
  it('la página no escucha colecciones viejas: las vistas de consulta se cargan al abrirlas', () => {
    const page = read('src/app/admin/reservas/AdminReservasPanel.tsx')
    expect(page).not.toContain('useReservations')
    expect(page).not.toContain('useServiceOrders')
    expect(page).toContain("dynamic(() => import('@/components/admin/LegacyReservationsView')")
    expect(page).toContain("dynamic(() => import('@/components/admin/LegacyOrdersView')")
    expect(page).toContain('aria-pressed={viewTab === view.id}')
  })

  it('el layout de admin ya no abre una escucha de `reservations` en cada panel', () => {
    expect(read('src/app/admin/AdminLayoutClient.tsx')).not.toContain('<ReservationsProvider>')
    const legacy = read('src/components/admin/LegacyReservationsView.tsx')
    expect(legacy).toContain('<ReservationsProvider>')
    // Y nadie más lo necesita: si otro panel lo usara sin proveedor, leería una lista vacía.
    const consumers = sourceFiles('src').filter((file) => read(file).includes('useReservations()'))
    expect(consumers).toEqual(['src/components/admin/LegacyReservationsView.tsx'])
  })
})
