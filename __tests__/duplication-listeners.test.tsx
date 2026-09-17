import React from 'react'
import { render, act } from '@testing-library/react'
import '@testing-library/jest-dom'

jest.mock('firebase/firestore', () => ({
  onSnapshot: jest.fn(() => jest.fn()),
  collection: jest.fn(() => ({})),
  query: jest.fn(() => ({})),
  where: jest.fn(() => ({})),
}))

jest.mock('@/firebase/config', () => ({ db: {} }))
jest.mock('@/firebase/db', () => ({ db: {} }))

import { onSnapshot } from 'firebase/firestore'
import { useOnlineWalkers } from '../src/lib/useOnlineWalkers'

const onSnapshotMock = onSnapshot as jest.Mock

function Harness({ zoneId }: { zoneId?: string }) {
  const { loading, onlineWalkers } = useOnlineWalkers(zoneId)
  return (
    <div data-testid="out">
      {loading ? 'loading' : `${onlineWalkers.length}:${onlineWalkers.map((w) => String((w as unknown as { id?: string }).id)).join(',')}`}
    </div>
  )
}

const nowSeconds = () => Math.floor(Date.now() / 1000)

function snapFor(docs: Array<{ id: string }>) {
  return {
    docs: docs.map((d) => ({
      id: d.id,
      data: () => ({ id: d.id, status: 'online', lastHeartbeat: { seconds: nowSeconds() } }),
    })),
  }
}

function emitSnapshot(callIndex: number, snap: ReturnType<typeof snapFor>) {
  const handler = onSnapshotMock.mock.calls[callIndex][1]
  act(() => handler(snap))
}

function activeListeners(): number {
  const unsubscribed = onSnapshotMock.mock.results.filter((r) => r.value.mock.calls.length > 0).length
  return onSnapshotMock.mock.calls.length - unsubscribed
}

beforeEach(() => {
  onSnapshotMock.mockClear()
})

describe('onSnapshot: ciclo de vida sin acumular listeners ni duplicar estado', () => {
  it('unmount cancela el listener (cleanup) — no queda suscripción huérfana', () => {
    const { unmount } = render(<Harness />)
    const unsubscribe = onSnapshotMock.mock.results[0].value
    expect(onSnapshotMock).toHaveBeenCalledTimes(1)
    unmount()
    expect(unsubscribe).toHaveBeenCalledTimes(1)
    expect(activeListeners()).toBe(0)
  })

  it('cambiar de zona cancela el listener anterior: navegar rutas no acumula suscripciones', () => {
    const { rerender } = render(<Harness zoneId="z1" />)
    const unsubZ1 = onSnapshotMock.mock.results[0].value
    rerender(<Harness zoneId="z2" />)
    expect(unsubZ1).toHaveBeenCalledTimes(1)
    expect(onSnapshotMock).toHaveBeenCalledTimes(2)
    expect(activeListeners()).toBe(1)
  })

  it('una actualización de snapshot REEMPLAZA el estado en vez de acumular (sin concat)', () => {
    const { getByTestId } = render(<Harness />)
    emitSnapshot(0, snapFor([{ id: 'a' }, { id: 'b' }]))
    expect(getByTestId('out')).toHaveTextContent('2:a,b')
    emitSnapshot(0, snapFor([{ id: 'a' }, { id: 'b' }, { id: 'c' }]))
    expect(getByTestId('out')).toHaveTextContent('3:a,b,c')
  })

  it('re-emitir un snapshot con los mismos ids NO duplica los docs (reemplaza, sin acumular)', () => {
    const { getByTestId } = render(<Harness />)
    emitSnapshot(0, snapFor([{ id: 'a' }, { id: 'b' }]))
    expect(getByTestId('out')).toHaveTextContent('2:a,b')
    emitSnapshot(0, snapFor([{ id: 'a' }, { id: 'b' }]))
    expect(getByTestId('out')).toHaveTextContent('2:a,b')
  })

  it('Strict Mode (doble montaje en dev) no deja suscripción doble permanente', () => {
    render(
      <React.StrictMode>
        <Harness />
      </React.StrictMode>
    )
    expect(onSnapshotMock.mock.calls.length).toBeGreaterThanOrEqual(2)
    expect(activeListeners()).toBe(1)
  })
})
