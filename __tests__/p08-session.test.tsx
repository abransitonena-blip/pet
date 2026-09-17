import { renderHook, act, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'

jest.mock('@/firebase/config', () => ({ auth: { currentUser: null }, authPersistenceReady: Promise.resolve(), db: {} }))

jest.mock('firebase/auth', () => ({
  onAuthStateChanged: jest.fn((auth: { __cb?: (u: unknown) => void }, cb: (u: unknown) => void) => {
    auth.__cb = cb
    return jest.fn()
  }),
}))
jest.mock('@/firebase/db', () => ({ db: {} }))

jest.mock('firebase/firestore', () => ({
  doc: jest.fn(() => ({})),
  getDoc: jest.fn(),
}))

import { useSessionRole, type SessionRoleState } from '../src/lib/useSessionRole'
import { getDoc } from 'firebase/firestore'
import { auth } from '../src/firebase/config'

type MockUser = {
  uid: string
  getIdToken: jest.Mock
  getIdTokenResult: jest.Mock
}

const mockAuth = auth as { currentUser: MockUser | null; __cb?: (u: unknown) => void }

function makeUser(uid = 'u1'): MockUser {
  return {
    uid,
    getIdToken: jest.fn(async () => 'token'),
    getIdTokenResult: jest.fn(async () => ({ claims: { role: 'customer' } })),
  }
}

type AllowedRole = 'customer' | 'walker' | 'supervisor' | 'admin'

function renderThenEmit(allowed: AllowedRole[], user: MockUser | null) {
  const utils = renderHook(() => useSessionRole(allowed))
  act(() => {
    mockAuth.currentUser = user
    mockAuth.__cb?.(user)
  })
  return utils
}

async function settledStatus(result: { current: SessionRoleState }) {
  await waitFor(() => expect(result.current.status).not.toBe('loading'))
  return result.current.status
}

beforeEach(() => {
  mockAuth.currentUser = null
  delete mockAuth.__cb
  ;(getDoc as jest.Mock).mockReset()
  ;(getDoc as jest.Mock).mockResolvedValue({ exists: () => false, data: () => ({}) })
})

describe('useSessionRole — gate de layouts por custom claims', () => {
  // 1) customer → /familia: permitido
  it('customer con claims → /familia permitido', async () => {
    const { result } = renderThenEmit(['customer'], makeUser())
    expect(await settledStatus(result)).toBe('ready')
    expect(result.current.role).toBe('customer')
    expect(result.current.uid).toBe('u1')
  })

  // 2) customer → /walker: denegado
  it('customer en layout walker → denied', async () => {
    const { result } = renderThenEmit(['walker'], makeUser())
    expect(await settledStatus(result)).toBe('denied')
  })

  // 3) customer → /admin: denegado
  it('customer en layout admin → denied', async () => {
    const { result } = renderThenEmit(['admin'], makeUser())
    expect(await settledStatus(result)).toBe('denied')
  })

  // 4) walker activo → panel walker permitido
  it('walker activo → ready', async () => {
    const user = makeUser()
    user.getIdTokenResult.mockResolvedValue({ claims: { role: 'walker' } })
    ;(getDoc as jest.Mock).mockResolvedValue({ exists: () => true, data: () => ({ status: 'active' }) })
    const { result } = renderThenEmit(['walker'], user)
    expect(await settledStatus(result)).toBe('ready')
    expect(result.current.role).toBe('walker')
    expect(getDoc).toHaveBeenCalled()
  })

  it('walker con claim pero sin perfil operativo → profile-missing', async () => {
    const user = makeUser()
    user.getIdTokenResult.mockResolvedValue({ claims: { role: 'walker' } })
    const { result } = renderThenEmit(['walker'], user)
    expect(await settledStatus(result)).toBe('profile-missing')
  })

  it('cuenta autenticada sin claim de equipo → missing-claim después de un refresh', async () => {
    const user = makeUser()
    user.getIdTokenResult.mockResolvedValue({ claims: {} })
    const { result } = renderThenEmit(['admin'], user)
    expect(await settledStatus(result)).toBe('missing-claim')
    expect(user.getIdToken).toHaveBeenCalledTimes(1)
  })

  it('claim de equipo no reconocido → denied después de un refresh', async () => {
    const user = makeUser()
    user.getIdTokenResult.mockResolvedValue({ claims: { role: 'owner' } })
    const { result } = renderThenEmit(['admin'], user)
    expect(await settledStatus(result)).toBe('denied')
    expect(user.getIdToken).toHaveBeenCalledTimes(1)
  })

  // 11) cuenta suspendida → suspended
  it('walker suspendido → suspended', async () => {
    const user = makeUser()
    user.getIdTokenResult.mockResolvedValue({ claims: { role: 'walker' } })
    ;(getDoc as jest.Mock).mockResolvedValue({ exists: () => true, data: () => ({ status: 'suspended' }) })
    const { result } = renderThenEmit(['walker'], user)
    expect(await settledStatus(result)).toBe('suspended')
  })

  it('cuenta invitada (walkerProfiles invited) → invited', async () => {
    const user = makeUser()
    user.getIdTokenResult.mockResolvedValue({ claims: { role: 'walker' } })
    ;(getDoc as jest.Mock).mockResolvedValue({ exists: () => true, data: () => ({ status: 'invited' }) })
    const { result } = renderThenEmit(['walker'], user)
    expect(await settledStatus(result)).toBe('invited')
  })

  it('perfil de paseador con estado desconocido → inactive', async () => {
    const user = makeUser()
    user.getIdTokenResult.mockResolvedValue({ claims: { role: 'walker' } })
    ;(getDoc as jest.Mock).mockResolvedValue({ exists: () => true, data: () => ({ status: 'pending-review' }) })
    const { result } = renderThenEmit(['walker'], user)
    expect(await settledStatus(result)).toBe('inactive')
  })

  // 13) claims antiguos → renovación correcta
  it('claims viejos (customer→walker) refresca una vez y concede', async () => {
    const user = makeUser()
    let first = true
    user.getIdTokenResult.mockImplementation(async () => {
      if (first) {
        first = false
        return { claims: {} }
      }
      return { claims: { role: 'walker' } }
    })
    ;(getDoc as jest.Mock).mockResolvedValue({ exists: () => true, data: () => ({ status: 'active' }) })
    const { result } = renderThenEmit(['walker'], user)
    expect(await settledStatus(result)).toBe('ready')
    expect(result.current.role).toBe('walker')
    expect(user.getIdToken).toHaveBeenCalledTimes(1)
    expect(user.getIdToken).toHaveBeenCalledWith(true)
  })

  // 15) sesión cerrada → no conserva acceso protegido
  it('sin sesión → no-session', async () => {
    const { result } = renderThenEmit(['admin'], null)
    expect(await settledStatus(result)).toBe('no-session')
  })

  it('cierre de sesión tras estar dentro → no-session (sin acceso residual)', async () => {
    const user = makeUser()
    user.getIdTokenResult.mockResolvedValue({ claims: { role: 'admin' } })
    const { result } = renderThenEmit(['admin'], user)
    expect(await settledStatus(result)).toBe('ready')

    act(() => {
      mockAuth.currentUser = null
      mockAuth.__cb?.(null)
    })
    expect(await settledStatus(result)).toBe('no-session')
  })

  it('supervisor puede entrar al layout administrativo autorizado', async () => {
    const user = makeUser()
    user.getIdTokenResult.mockResolvedValue({ claims: { role: 'supervisor' } })
    const { result } = renderThenEmit(['admin', 'supervisor'], user)
    expect(await settledStatus(result)).toBe('ready')
    expect(result.current.role).toBe('supervisor')
    expect(user.getIdToken).not.toHaveBeenCalled()
  })

  it('expone error de red y abandona loading cuando falla el token', async () => {
    const user = makeUser()
    user.getIdTokenResult.mockRejectedValue({ code: 'auth/network-request-failed' })
    const { result } = renderThenEmit(['customer'], user)
    expect(await settledStatus(result)).toBe('error')
    expect(result.current.error).toBe('network-error')
  })
})
