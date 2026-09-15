import React from 'react'
import { fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'

jest.mock('@/firebase/config', () => ({ db: {} }))
jest.mock('firebase/firestore', () => ({
  collection: jest.fn((_db, name) => ({ kind: 'collection', name })),
  query: jest.fn((...parts) => ({ parts })),
  where: jest.fn((field, op, value) => ({ kind: 'where', field, op, value })),
  orderBy: jest.fn((field, direction) => ({ kind: 'orderBy', field, direction })),
  limit: jest.fn((value) => ({ kind: 'limit', value })),
  onSnapshot: jest.fn(() => jest.fn()),
  getDocs: jest.fn(),
  doc: jest.fn(),
  runTransaction: jest.fn(),
  serverTimestamp: jest.fn(),
}))
// Las herramientas del paseo tienen sus propias pruebas; aquí sólo importa dónde quedan.
jest.mock('@/components/walker/WalkQuickLog', () => ({ __esModule: true, default: () => <div data-testid="quick-log" /> }))
jest.mock('@/components/walker/WalkPhotoButton', () => ({ __esModule: true, default: () => <button type="button">Foto</button> }))
jest.mock('@/components/walker/WalkSheet', () => ({ __esModule: true, default: () => <div data-testid="walk-sheet" /> }))

import { getDocs, where } from 'firebase/firestore'
import { useWalkerSessions } from '../src/lib/useServiceOrders'
import { REPORT_LOOKUP_LIMIT, useSubmittedReports } from '../src/lib/useSubmittedReports'
import { planWalkerDay, sortWalkerSessions } from '../src/lib/walkerPanel'
import WalkerSessionCard from '../src/components/walker/WalkerSessionCard'
import type { WalkSession } from '../src/types'

function walk(id: string, date: string, start: string, status: string): WalkSession {
  return {
    id, orderId: 'order-1', customerId: 'customer-1', dogName: `Perro ${id}`, walkerId: 'walker-1',
    scheduledDate: date, scheduledStart: start, date, startTime: start, status, sessionStatus: status,
  } as WalkSession
}

const TODAY = '2026-09-15'
const WEEK_START = '2026-09-09'

beforeEach(() => jest.clearAllMocks())

describe('la jornada: lo que toca primero', () => {
  it('pone arriba el paseo en curso aunque haya otro más temprano sin empezar', () => {
    const sorted = sortWalkerSessions([
      walk('a', TODAY, '08:00', 'confirmed'),
      walk('b', TODAY, '10:00', 'in_progress'),
      walk('c', TODAY, '12:00', 'assigned'),
    ])
    const day = planWalkerDay(sorted, TODAY, WEEK_START)
    expect(day.focus?.id).toBe('b')
    expect(day.restOfToday.map((session) => session.id)).toEqual(['a', 'c'])
  })

  it('sin nada en marcha, toca el primero abierto por hora; lo completado no es foco', () => {
    const sorted = sortWalkerSessions([
      walk('done', TODAY, '07:00', 'completed'),
      walk('late', TODAY, '15:00', 'assigned'),
      walk('early', TODAY, '09:00', 'confirmed'),
    ])
    const day = planWalkerDay(sorted, TODAY, WEEK_START)
    expect(day.focus?.id).toBe('early')
    expect(day.pendingToday).toBe(2)
    expect(day.completedToday).toBe(1)
  })

  it('con todo cerrado no inventa un foco, y los paseos siguen visibles', () => {
    const day = planWalkerDay([walk('done', TODAY, '07:00', 'completed')], TODAY, WEEK_START)
    expect(day.focus).toBeNull()
    expect(day.restOfToday).toHaveLength(1)
  })

  it('los completados recientes son de la semana y antes de hoy, el más nuevo primero', () => {
    const sorted = sortWalkerSessions([
      walk('old', '2026-09-01', '10:00', 'completed'),
      walk('mon', '2026-09-10', '10:00', 'completed'),
      walk('sun', '2026-09-14', '10:00', 'completed'),
      walk('cancel', '2026-09-13', '10:00', 'cancelled'),
      walk('today', TODAY, '10:00', 'completed'),
    ])
    const day = planWalkerDay(sorted, TODAY, WEEK_START)
    expect(day.recentCompleted.map((session) => session.id)).toEqual(['sun', 'mon'])
    expect(day.lastWeekCount).toBe(3)
  })
})

describe('la consulta de paseos', () => {
  it('con `since` pone piso a la fecha sobre el mismo índice', () => {
    renderHook(() => useWalkerSessions('walker-1', { since: WEEK_START }))
    expect(where).toHaveBeenCalledWith('walkerId', '==', 'walker-1')
    expect(where).toHaveBeenCalledWith('scheduledDate', '>=', WEEK_START)
  })

  it('sin `since` no agrega el piso (historial y chat siguen igual)', () => {
    renderHook(() => useWalkerSessions('walker-1'))
    expect(where).not.toHaveBeenCalledWith('scheduledDate', '>=', expect.anything())
  })
})

describe('reportes enviados', () => {
  it('pregunta sólo por los reportes propios y cuenta sólo los enviados', async () => {
    ;(getDocs as jest.Mock).mockResolvedValue({
      docs: [
        { data: () => ({ walkSessionId: 's1', status: 'submitted' }) },
        { data: () => ({ walkSessionId: 's2', status: 'draft' }) },
      ],
    })
    const { result } = renderHook(() => useSubmittedReports('walker-1', ['s1', 's2', 's3']))
    await waitFor(() => expect(result.current.state).toBe('ready'))
    expect(where).toHaveBeenCalledWith('walkerId', '==', 'walker-1')
    expect(where).toHaveBeenCalledWith('walkSessionId', 'in', ['s1', 's2', 's3'])
    const submitted = result.current.state === 'ready' ? result.current.submitted : new Set()
    expect(Array.from(submitted)).toEqual(['s1'])
  })

  it('si la consulta falla no afirma que falte nada', async () => {
    ;(getDocs as jest.Mock).mockRejectedValue({ code: 'permission-denied' })
    const { result } = renderHook(() => useSubmittedReports('walker-1', ['s1']))
    await waitFor(() => expect(result.current.state).toBe('unknown'))
  })

  it('no consulta cuando no hay paseos que revisar, y nunca pide más de diez', async () => {
    const empty = renderHook(() => useSubmittedReports('walker-1', []))
    await waitFor(() => expect(empty.result.current.state).toBe('ready'))
    expect(getDocs).not.toHaveBeenCalled()

    ;(getDocs as jest.Mock).mockResolvedValue({ docs: [] })
    const many = Array.from({ length: 14 }, (_, index) => `s${index}`)
    renderHook(() => useSubmittedReports('walker-1', many))
    await waitFor(() => expect(getDocs).toHaveBeenCalled())
    expect(where).toHaveBeenCalledWith('walkSessionId', 'in', many.slice(0, REPORT_LOOKUP_LIMIT))
  })
})

describe('la tarjeta del paseo', () => {
  it('plegable: empieza compacta y se abre con un toque', () => {
    render(<WalkerSessionCard session={walk('x', TODAY, '12:00', 'confirmed')} onAdvance={jest.fn()} collapsible />)
    expect(screen.queryByRole('list', { name: /Progreso del paseo/i })).not.toBeInTheDocument()
    // Plegada sigue ofreciendo su acción: no hay que abrirla para avanzar.
    expect(screen.getByRole('button', { name: /Ir en camino para Perro x/i })).toBeInTheDocument()

    const toggle = screen.getByRole('button', { name: 'Más detalles' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(toggle)
    expect(screen.getByRole('list', { name: /Progreso del paseo/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Menos detalles' })).toHaveAttribute('aria-expanded', 'true')
  })

  it('en teléfono, las etiquetas del progreso se ocultan a la vista pero no al lector', () => {
    render(<WalkerSessionCard session={walk('x', TODAY, '12:00', 'confirmed')} />)
    const label = screen.getAllByText('Confirmado').find((node) => node.closest('ol'))
    expect(label).toHaveClass('sr-only', 'sm:not-sr-only')
    expect(label).not.toHaveClass('hidden')
    expect(screen.getByText(/Paso 2 de 6/)).toBeInTheDocument()
  })

  it('en paseo, completar queda después de la bitácora, la foto y la incidencia', () => {
    render(<WalkerSessionCard session={walk('x', TODAY, '12:00', 'in_progress')} onAdvance={jest.fn()} />)
    const complete = screen.getByRole('button', { name: /Completar paseo/i })
    for (const earlier of [
      screen.getByTestId('quick-log'),
      screen.getByRole('link', { name: /Reportar incidencia/i }),
      screen.getByRole('button', { name: 'Foto' }),
      screen.getByRole('link', { name: /Bitácora del paseo/i }),
    ]) {
      expect(earlier.compareDocumentPosition(complete) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    }
  })

  it('antes de empezar, la acción principal va primero', () => {
    render(<WalkerSessionCard session={walk('x', TODAY, '12:00', 'arrived')} onAdvance={jest.fn()} />)
    const start = screen.getByRole('button', { name: /Iniciar paseo/i })
    const log = screen.getByRole('link', { name: /Bitácora del paseo/i })
    expect(start.compareDocumentPosition(log) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('las ubicaciones registradas quedan dentro de la ficha, no a la vista', () => {
    const session = { ...walk('x', TODAY, '12:00', 'in_progress'), startLocation: { lat: 1, lng: 1 } } as unknown as WalkSession
    render(<WalkerSessionCard session={session} />)
    expect(screen.queryByText('ubicación registrada')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Ver la ficha del paseo/i }))
    expect(screen.getByText('ubicación registrada')).toBeInTheDocument()
  })
})
