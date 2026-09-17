import React from 'react'
import { act, render, renderHook, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { readFileSync } from 'node:fs'

const unsubscribe = jest.fn()
const timestamp = { __type: 'server-timestamp' }

jest.mock('@/firebase/config', () => ({ db: {} }))
jest.mock('firebase/firestore', () => ({
  collection: jest.fn((_db, name) => ({ kind: 'collection', name })),
  query: jest.fn((...parts) => ({ parts })),
  where: jest.fn((field, op, value) => ({ kind: 'where', field, op, value })),
  orderBy: jest.fn((field, direction) => ({ kind: 'orderBy', field, direction })),
  limit: jest.fn((value) => ({ kind: 'limit', value })),
  onSnapshot: jest.fn(() => unsubscribe),
  doc: jest.fn((_db, collectionName, id) => ({ collectionName, id })),
  runTransaction: jest.fn(async (_db, callback) => callback({
    get: jest.fn(async () => ({
      exists: () => true,
      data: () => ({ status: 'assigned', walkerId: 'walker-1' }),
    })),
    update: jest.fn(),
  })),
  setDoc: jest.fn(async () => undefined),
  serverTimestamp: jest.fn(() => timestamp),
  getDocs: jest.fn(),
}))
jest.mock('@/firebase/db', () => ({ db: {} }))

import { limit, onSnapshot, orderBy, runTransaction, setDoc, where } from 'firebase/firestore'
import { advanceWalkerSession, useWalkerSessions } from '../src/lib/useServiceOrders'
import {
  classifyWalkerReadError,
  getWalkerTransition,
  isAssignedToWalker,
  walkerReadErrorMessage,
} from '../src/lib/walkerPanel'
import WalkerSessionCard from '../src/components/walker/WalkerSessionCard'
import WalkerHeartbeat from '../src/components/WalkerHeartbeat'
import type { WalkSession } from '../src/types'

const session = {
  id: 'session-1', orderId: 'order-1', customerId: 'customer-1', dogName: 'Luna',
  serviceName: 'Paseo', scheduledDate: '2026-08-14', scheduledStart: '10:00',
  date: '2026-08-14', startTime: '10:00', walkerId: 'walker-1', status: 'assigned',
  sessionStatus: 'assigned',
} as WalkSession

function emitSnapshot(docs: WalkSession[]) {
  const success = (onSnapshot as jest.Mock).mock.calls.at(-1)[1]
  act(() => success({ docs: docs.map((item) => ({ id: item.id, data: () => item })) }))
}

function emitError(code: string) {
  const failure = (onSnapshot as jest.Mock).mock.calls.at(-1)[2]
  act(() => failure({ code }))
}

beforeEach(() => {
  jest.clearAllMocks()
  unsubscribe.mockClear()
  ;(onSnapshot as jest.Mock).mockImplementation(() => unsubscribe)
})

describe('Walker panel — consultas, estado y listeners', () => {
  it('consulta walkSessions por UID, orden y límite, sin reservations legacy', () => {
    renderHook(() => useWalkerSessions('walker-1'))
    expect(where).toHaveBeenCalledWith('walkerId', '==', 'walker-1')
    expect(orderBy).toHaveBeenCalledWith('scheduledDate', 'asc')
    expect(limit).toHaveBeenCalledWith(100)

    const dashboard = readFileSync('src/app/walker/page.tsx', 'utf8')
    const history = readFileSync('src/app/walker/historial/page.tsx', 'utf8')
    expect(dashboard).not.toContain("collection(db, 'reservations')")
    expect(history).not.toContain("collection(db, 'reservations')")
    // La jornada recorta la consulta a su semana: sin piso, el orden ascendente
    // con tope devolvía los 100 paseos más antiguos y dejaba fuera los de hoy.
    expect(dashboard).toContain('useWalkerSessions(uid, { since: weekStart })')
    // El historial pide un mes; sin ventana traía los 100 paseos más antiguos.
    expect(history).toContain('monthWindow(todayKey(), offset)')
    expect(history).toContain('since: month.since')
    expect(history).toContain("until: offset < 0 ? month.until : undefined")
  })

  it('distingue loading, vacío, permiso y red', () => {
    const first = renderHook(() => useWalkerSessions('walker-1'))
    expect(first.result.current.loading).toBe(true)
    emitSnapshot([])
    expect(first.result.current.loading).toBe(false)
    expect(first.result.current.sessions).toEqual([])
    first.unmount()

    const permission = renderHook(() => useWalkerSessions('walker-1'))
    emitError('permission-denied')
    expect(permission.result.current.error).toBe('permission-denied')
    expect(walkerReadErrorMessage('permission-denied')).toMatch(/permiso/i)
    permission.unmount()

    const network = renderHook(() => useWalkerSessions('walker-1'))
    emitError('unavailable')
    expect(network.result.current.error).toBe('unavailable')
    expect(classifyWalkerReadError({ code: 'firestore/network-request-failed' })).toBe('network-error')
    network.unmount()
  })

  it('reemplaza el snapshot y limpia el único listener al desmontar', () => {
    const hook = renderHook(() => useWalkerSessions('walker-1'))
    expect(onSnapshot).toHaveBeenCalledTimes(1)
    emitSnapshot([session])
    expect(hook.result.current.sessions).toHaveLength(1)
    emitSnapshot([{ ...session, status: 'confirmed', sessionStatus: 'confirmed' }])
    expect(hook.result.current.sessions).toHaveLength(1)
    expect(hook.result.current.sessions[0].status).toBe('confirmed')
    hook.unmount()
    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })
})

describe('Walker panel — asignación y transiciones', () => {
  it('acepta únicamente asignación por UID canónico', () => {
    expect(isAssignedToWalker(session, 'walker-1')).toBe(true)
    expect(isAssignedToWalker(session, 'walker-2')).toBe(false)
    expect(isAssignedToWalker(session, '')).toBe(false)
  })

  it('expone solo la secuencia permitida para el paseador', () => {
    expect(getWalkerTransition('assigned')?.to).toBe('confirmed')
    expect(getWalkerTransition('confirmed')?.to).toBe('on_the_way')
    expect(getWalkerTransition('on_the_way')?.to).toBe('arrived')
    expect(getWalkerTransition('arrived')?.to).toBe('in_progress')
    expect(getWalkerTransition('in_progress')?.to).toBe('completed')
    expect(getWalkerTransition('completed')).toBeNull()
    expect(getWalkerTransition('cancelled')).toBeNull()
  })

  it('escribe únicamente estado, timestamp de transición y updatedAt', async () => {
    await advanceWalkerSession(session)
    const transaction = (runTransaction as jest.Mock).mock.calls[0][1]
    const update = jest.fn()
    await transaction({
      get: jest.fn(async () => ({ exists: () => true, data: () => ({ status: 'assigned', walkerId: 'walker-1' }) })),
      update,
    })
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ collectionName: 'walkSessions', id: 'session-1' }),
      { status: 'confirmed', confirmedAt: timestamp, updatedAt: timestamp },
    )
  })

  it('rechaza una transición obsoleta antes de escribir', async () => {
    ;(runTransaction as jest.Mock).mockImplementationOnce(async (_db, callback) => callback({
      get: jest.fn(async () => ({ exists: () => true, data: () => ({ status: 'confirmed', walkerId: 'walker-1' }) })),
      update: jest.fn(),
    }))

    await expect(advanceWalkerSession(session)).rejects.toThrow('walker-transition-conflict')
  })

  it('renderiza una acción accesible y no inventa información ausente', () => {
    render(<WalkerSessionCard session={session} onAdvance={jest.fn()} />)
    expect(screen.getByText('Luna')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Confirmar paseo para Luna/i })).toHaveClass('h-11', 'text-white')
    expect(screen.getByRole('list', { name: /Progreso del paseo/i })).toBeInTheDocument()
    // La insignia, la etiqueta del paso y la línea "Paso 1 de 6" que se ve en teléfono.
    expect(screen.getAllByText('Asignado')).toHaveLength(3)
    expect(screen.getByText('Completado')).toBeInTheDocument()
    expect(screen.queryByText(/cliente satisfecho|calificación/i)).not.toBeInTheDocument()
  })

  it('en una sesión completada ofrece la ruta determinista del reporte', () => {
    render(<WalkerSessionCard session={{ ...session, status: 'completed', sessionStatus: 'completed' }} />)
    expect(screen.getByRole('link', { name: /Reporte del paseo/i })).toHaveAttribute('href', '/walker/reportes/session-1')
  })

  it('mantiene filtros del historial con altura táctil mínima y contraste en el activo', () => {
    const history = readFileSync('src/app/walker/historial/page.tsx', 'utf8')
    expect(history).toContain("className={`h-11 shrink-0 ${filter === item.value ? 'text-white' : ''}`}")
    expect(history).toContain("value: 'today'")
    expect(history).toContain("value: 'upcoming'")
    expect(history).toContain("value: 'completed'")
  })

  it('lista como reportes por enviar sólo los completados cuyo reporte no salió', () => {
    const dashboard = readFileSync('src/app/walker/page.tsx', 'utf8')
    expect(dashboard).toContain('useSubmittedReports(uid, day.recentCompleted.map((session) => session.id))')
    expect(dashboard).toContain("reports.state === 'ready'")
    expect(dashboard).toContain('!reports.submitted.has(session.id)')
    expect(dashboard).toContain('Reportes por enviar')
    expect(dashboard).not.toContain('Reportes pendientes de cierre')
  })
})

describe('Walker panel — presencia contenida', () => {
  it('sin UID de paseador no escribe presencia y lo dice', () => {
    // PET Ahora is on now, so the containment that still matters is the
    // identity one: without a walker UID there is nothing to write presence
    // for, and the badge must say so instead of claiming to be live.
    render(<WalkerHeartbeat walkerId="" walkerName="Abraham" />)
    expect(screen.getByTitle(/presencia automática se activará/i)).toBeInTheDocument()
    expect(setDoc).not.toHaveBeenCalled()
  })

  it('con PET Ahora encendido reporta el estado de presencia', () => {
    render(<WalkerHeartbeat walkerId="walker-1" walkerName="Abraham" />)
    expect(screen.getByRole('status')).toHaveTextContent(/Presencia activa|Sin GPS/)
  })
})
