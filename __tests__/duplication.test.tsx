import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'

import Header from '../src/components/Header'
import { dedupeById } from '../src/lib/collectionUtils'

const originalMatchMedia = window.matchMedia
const originalRAF = window.requestAnimationFrame

function setupEnvPolyfills() {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  })
  window.requestAnimationFrame = ((cb: FrameRequestCallback) => setTimeout(cb, 0)) as typeof window.requestAnimationFrame
  window.cancelAnimationFrame = (id: number) => clearTimeout(id)
}

function restoreEnvPolyfills() {
  window.matchMedia = originalMatchMedia
  window.requestAnimationFrame = originalRAF
}

describe('Header: único, sin duplicación', () => {
  beforeAll(setupEnvPolyfills)
  afterAll(restoreEnvPolyfills)

  it('se monta una sola vez (un único <header> en el árbol)', () => {
    const { unmount } = render(<Header />)
    const banners = screen.getAllByRole('banner')
    expect(banners).toHaveLength(1)
    unmount()
    expect(screen.queryByRole('banner')).not.toBeInTheDocument()
  })

  it('unmount limpia el listener de scroll (sin listener huérfano que acumule estado)', () => {
    const addSpy = jest.spyOn(window, 'addEventListener')
    const removeSpy = jest.spyOn(window, 'removeEventListener')
    const { unmount } = render(<Header />)
    expect(addSpy).toHaveBeenCalledWith('scroll', expect.any(Function), { passive: true })
    unmount()
    expect(removeSpy).toHaveBeenCalledWith('scroll', expect.any(Function))
    addSpy.mockRestore()
    removeSpy.mockRestore()
  })
})

describe('dedupeById', () => {
  it('no duplica documentos con el mismo id al concatenar lotes', () => {
    const items = dedupeById([
      { id: 'a', n: 1 },
      { id: 'a', n: 2 },
      { id: 'b', n: 1 },
      { id: 'c', n: 1 },
      { id: 'b', n: 2 },
    ])
    expect(items.map((i) => i.id)).toEqual(['a', 'b', 'c'])
  })

  it('respeta el primer elemento de un id duplicado (guard de paginación)', () => {
    const items = dedupeById([
      { id: 'a', seq: 1 },
      { id: 'a', seq: 2 },
    ])
    expect(items).toHaveLength(1)
    expect(items[0].seq).toBe(1)
  })
})

jest.mock('firebase/firestore', () => ({
  doc: jest.fn((_db: unknown, path: string, ...ids: string[]) => ({ path: `${path}/${ids.join('/')}` })),
  getDoc: jest.fn(),
  runTransaction: jest.fn(),
  setDoc: jest.fn(() => Promise.resolve()),
  serverTimestamp: jest.fn(() => ({ seconds: 0, nanoseconds: 0 })),
}))

jest.mock('@/firebase/config', () => ({ db: {} }))
jest.mock('@/firebase/db', () => ({ db: {} }))

import { getDoc, runTransaction, setDoc } from 'firebase/firestore'
import { ensureCanonicalCustomerProfile, getCustomerProfile, updateCustomerProfile } from '../src/lib/customerProfile'

const getDocMock = getDoc as jest.Mock
const runTransactionMock = runTransaction as jest.Mock
const setDocMock = setDoc as jest.Mock
const transactionGetMock = jest.fn()
const transactionSetMock = jest.fn()

const absent = () => ({ exists: () => false, data: () => undefined })
const present = (data: Record<string, unknown>) => ({ exists: () => true, data: () => data })

beforeEach(() => {
  getDocMock.mockClear()
  setDocMock.mockClear()
  transactionGetMock.mockReset()
  transactionSetMock.mockReset()
  runTransactionMock.mockReset()
  runTransactionMock.mockImplementation((_db, callback) => callback({ get: transactionGetMock, set: transactionSetMock }))
})

describe('customerProfile: iniciar/cerrar sesión no duplica el perfil', () => {
  it('registro/login crea exactamente UN documento canónico (customerProfiles)', async () => {
    transactionGetMock.mockResolvedValue(absent())
    await ensureCanonicalCustomerProfile({ uid: 'u1', displayName: 'Juan', email: 'juan@x.com' })
    expect(transactionSetMock).toHaveBeenCalledTimes(1)
    const call = transactionSetMock.mock.calls[0]
    expect(call[0]).toEqual({ path: 'customerProfiles/u1' })
    expect(call[1]).toMatchObject({ name: 'Juan', email: 'juan@x.com' })
  })

  it('re-login con perfil canónico existente NO vuelve a escribir', async () => {
    transactionGetMock.mockResolvedValue(present({ displayName: 'Juan' }))
    await ensureCanonicalCustomerProfile({ uid: 'u1', displayName: 'Juan', email: 'juan@x.com' })
    expect(transactionSetMock).not.toHaveBeenCalled()
  })

  it('datos legacy en clients se leen sin backfill ni migración oculta', async () => {
    getDocMock
      .mockResolvedValueOnce(absent())
      .mockResolvedValueOnce(present({ displayName: 'Antiguo', email: 'a@x.com' }))
    await getCustomerProfile('u1')
    expect(setDocMock).not.toHaveBeenCalled()
  })

  it('updateCustomerProfile escribe en el canon customerProfiles, nunca en clients', async () => {
    await updateCustomerProfile('u1', { phone: '3511234567' })
    expect(setDocMock).toHaveBeenCalledTimes(1)
    expect(setDocMock.mock.calls[0][0]).toEqual({ path: 'customerProfiles/u1' })
  })
})
