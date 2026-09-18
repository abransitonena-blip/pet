import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { readFileSync } from 'node:fs'

const mockUpdate = jest.fn()
jest.mock('@/firebase/db', () => ({ db: {} }))
jest.mock('firebase/firestore', () => ({
  doc: (_db: unknown, collection: string, id: string) => ({ collection, id }),
  updateDoc: (...args: unknown[]) => mockUpdate(...args),
  serverTimestamp: () => 'servidor',
}))

import CancelWalkButton from '../src/components/family/CancelWalkButton'
import RescheduleWalkButton from '../src/components/family/RescheduleWalkButton'
import { canCancel, cancelErrorMessage, cancelOwnWalk, rescheduleOwnWalk } from '../src/lib/familyCancellation'

const read = (path: string) => readFileSync(path, 'utf8')

beforeEach(() => {
  jest.clearAllMocks()
  mockUpdate.mockResolvedValue(undefined)
})

describe('cuándo se puede cancelar', () => {
  it('mientras nadie haya salido', () => {
    for (const status of ['requested', 'pending_assignment', 'assigned', 'confirmed'] as const) {
      expect({ status, puede: canCancel(status) }).toEqual({ status, puede: true })
    }
  })

  it('ya no, en cuanto el paseo va en camino o terminó', () => {
    for (const status of ['on_the_way', 'arrived', 'in_progress', 'completed', 'cancelled'] as const) {
      expect({ status, puede: canCancel(status) }).toEqual({ status, puede: false })
    }
  })
})

describe('la escritura de la cancelación', () => {
  it('cambia el estado, firma quién y cuándo, y nada más', async () => {
    const result = await cancelOwnWalk({ sessionId: 's1', uid: 'customer-1', status: 'confirmed', reason: '  Imprevisto  ' })
    expect(result).toEqual({ ok: true })
    expect(mockUpdate).toHaveBeenCalledWith({ collection: 'walkSessions', id: 's1' }, {
      status: 'cancelled',
      cancelledBy: 'customer-1',
      cancelledAt: 'servidor',
      cancelReason: 'Imprevisto',
      updatedAt: 'servidor',
    })
  })

  it('sin motivo no manda un campo vacío', async () => {
    await cancelOwnWalk({ sessionId: 's1', uid: 'customer-1', status: 'assigned' })
    expect(mockUpdate.mock.calls[0][1]).not.toHaveProperty('cancelReason')
  })

  it('no intenta escribir un paseo que ya empezó', async () => {
    expect(await cancelOwnWalk({ sessionId: 's1', uid: 'customer-1', status: 'in_progress' })).toEqual({ ok: false, reason: 'too-late' })
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('si la regla lo rechaza, explica que el paseo cambió; no culpa al internet', async () => {
    mockUpdate.mockRejectedValue({ code: 'permission-denied' })
    const result = await cancelOwnWalk({ sessionId: 's1', uid: 'customer-1', status: 'confirmed' })
    expect(result).toEqual({ ok: false, reason: 'not-allowed' })
    expect(cancelErrorMessage('not-allowed')).toMatch(/cambió mientras/)
    expect(cancelErrorMessage('failed')).toMatch(/conexión/)
  })
})

describe('el botón', () => {
  it('no se ofrece cuando ya no se puede cancelar', () => {
    const { container } = render(<CancelWalkButton sessionId="s1" uid="customer-1" status="in_progress" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('pregunta antes, con el nombre del perro, y deja escribir el motivo', async () => {
    render(<CancelWalkButton sessionId="s1" uid="customer-1" status="confirmed" dogName="Luna" />)
    fireEvent.click(screen.getByRole('button', { name: /Cancelar este paseo/ }))
    expect(screen.getByRole('dialog')).toHaveTextContent('¿Cancelar el paseo de Luna?')
    expect(mockUpdate).not.toHaveBeenCalled()

    fireEvent.change(screen.getByLabelText(/¿Nos cuentas por qué\?/), { target: { value: 'Nos vamos de viaje' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sí, cancelar' }))
    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1))
    expect(mockUpdate.mock.calls[0][1].cancelReason).toBe('Nos vamos de viaje')
  })
})

describe('dónde aparece', () => {
  it('en el próximo paseo del inicio y en el historial', () => {
    expect(read('src/app/familia/FamiliaPanel.tsx')).toContain('<CancelWalkButton sessionId={next.id}')
    expect(read('src/components/family/CanonicalFamilyHistory.tsx')).toContain('canCancel(session.status)')
  })
})

describe('mover el paseo a otro día', () => {
  it('manda la fecha, la ventana de llegada, y suelta al paseador', async () => {
    const result = await rescheduleOwnWalk({
      sessionId: 's1', uid: 'customer-1', status: 'confirmed',
      date: '2026-10-08', start: '12:00', end: '12:20',
    })
    expect(result).toEqual({ ok: true })
    expect(mockUpdate).toHaveBeenCalledWith({ collection: 'walkSessions', id: 's1' }, {
      scheduledDate: '2026-10-08',
      scheduledStart: '12:00',
      arrivalWindowStart: '12:00',
      arrivalWindowEnd: '12:20',
      status: 'requested',
      walkerId: '',
      rescheduledBy: 'customer-1',
      rescheduledAt: 'servidor',
      updatedAt: 'servidor',
    })
  })

  it('no intenta mover un paseo que ya empezó', async () => {
    expect(await rescheduleOwnWalk({
      sessionId: 's1', uid: 'customer-1', status: 'in_progress',
      date: '2026-10-08', start: '12:00', end: '12:20',
    })).toEqual({ ok: false, reason: 'too-late' })
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('avisa que el paseo vuelve a la cola antes de confirmar, no después', () => {
    render(<RescheduleWalkButton sessionId="s1" uid="customer-1" status="confirmed" currentDate="2026-10-01" />)
    fireEvent.click(screen.getByRole('button', { name: /Cambiar de día/ }))
    expect(screen.getByRole('dialog')).toHaveTextContent('vuelve a la lista por asignar')
    expect(screen.getByLabelText('Nuevo día')).toHaveAttribute('min', new Date().toLocaleDateString('en-CA'))
  })

  it('las horas salen del mismo horario que usa la reserva', () => {
    expect(read('src/components/family/RescheduleWalkButton.tsx')).toContain('generateTimeSlots(getDayOfWeek(date))')
  })

  it('está donde está cancelar: el próximo paseo y el historial', () => {
    expect(read('src/app/familia/FamiliaPanel.tsx')).toContain('<RescheduleWalkButton sessionId={next.id}')
    expect(read('src/components/family/CanonicalFamilyHistory.tsx')).toContain('<RescheduleWalkButton sessionId={session.id}')
  })
})
