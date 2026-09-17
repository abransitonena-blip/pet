/** @jest-environment node */
const mockVerify = jest.fn()
const mockProfileGet = jest.fn()
const mockDocument = jest.fn(() => ({ get: mockProfileGet }))
const mockCollection = jest.fn(() => ({ doc: mockDocument }))
const mockFirestore = jest.fn((): unknown => ({ collection: mockCollection }))

jest.mock('firebase-admin/app', () => ({ getApps: () => [{}], initializeApp: jest.fn(), cert: jest.fn() }))
jest.mock('firebase-admin/auth', () => ({ getAuth: () => ({ verifyIdToken: mockVerify }) }))
jest.mock('firebase-admin/firestore', () => ({ getFirestore: jest.fn() }))
jest.mock('@/lib/finance/serverFirestore', () => ({ getPrivilegedFirestore: () => mockFirestore() }))
jest.mock('@/lib/media/privateMediaAdmin.server', () => ({ createCloudinaryPrivateUploadSignature: jest.fn() }))

import { verifyAdminToken, verifyTokenRole, verifyWalkerToken } from '@/lib/serverAuth'
import { POST } from '@/app/api/media/private/signature/route'
import { createCloudinaryPrivateUploadSignature } from '@/lib/media/privateMediaAdmin.server'

beforeEach(() => {
  jest.clearAllMocks()
  mockFirestore.mockReturnValue({ collection: mockCollection })
  mockVerify.mockResolvedValue({ uid: 'walker-1', role: 'walker' })
  mockProfileGet.mockResolvedValue({ exists: true, data: () => ({ status: 'active' }) })
})

test('active Walker is checked against the canonical UID profile on every request', async () => {
  expect(await verifyWalkerToken('token')).toBe('walker-1')
  expect(await verifyTokenRole('token')).toEqual({ uid: 'walker-1', role: 'walker' })
  expect(mockCollection).toHaveBeenCalledWith('walkerProfiles')
  expect(mockDocument).toHaveBeenCalledWith('walker-1')
  expect(mockProfileGet).toHaveBeenCalledTimes(2)
})

test.each(['suspended', 'inactive', 'invited', '', undefined])('denies profile state %s despite a valid Walker claim', async (status) => {
  mockProfileGet.mockResolvedValue({ exists: true, data: () => ({ status }) })
  expect(await verifyWalkerToken('token')).toBeNull()
  expect(await verifyTokenRole('token')).toBeNull()
})

test('suspension immediately invalidates the same still-valid token', async () => {
  expect(await verifyWalkerToken('same-token')).toBe('walker-1')
  mockProfileGet.mockResolvedValue({ exists: true, data: () => ({ status: 'suspended' }) })
  expect(await verifyWalkerToken('same-token')).toBeNull()
})

test('missing profile, unavailable identity and read errors fail closed', async () => {
  mockProfileGet.mockResolvedValue({ exists: false })
  expect(await verifyWalkerToken('token')).toBeNull()
  mockFirestore.mockReturnValue(null)
  expect(await verifyTokenRole('token')).toBeNull()
  mockFirestore.mockReturnValue({ collection: mockCollection })
  mockProfileGet.mockRejectedValue(new Error('unavailable'))
  expect(await verifyTokenRole('token')).toBeNull()
})

test.each(['admin', 'supervisor', 'customer', 'client', undefined])('preserves legitimate %s claims without requiring a Walker profile', async (role) => {
  mockVerify.mockResolvedValue({ uid: 'user-1', role })
  expect(await verifyTokenRole('token')).toEqual({ uid: 'user-1', role: role ?? null })
  expect(mockProfileGet).not.toHaveBeenCalled()
  expect(await verifyAdminToken('token')).toBe(role === 'admin' ? 'user-1' : null)
})

test.each(['owner', '', null, 123, { role: 'customer' }])('does not convert an unsupported claim into customer access: %s', async (role) => {
  mockVerify.mockResolvedValue({ uid: 'user-1', role })
  expect(await verifyTokenRole('token')).toBeNull()
})

test('private upload cannot fall back to generic authentication after Walker suspension', async () => {
  mockProfileGet.mockResolvedValue({ exists: true, data: () => ({ status: 'suspended' }) })
  const response = await POST(new Request('https://pet.example/api/media/private/signature', {
    method: 'POST', headers: { authorization: 'Bearer token', 'Content-Type': 'application/json' },
    body: JSON.stringify({ folder: 'pet-ap-private/walk-reports', sessionId: 'session-1' }),
  }))
  expect(response.status).toBe(401)
  expect(createCloudinaryPrivateUploadSignature).not.toHaveBeenCalled()
})

test('invalid and absent tokens are denied without profile access', async () => {
  expect(await verifyWalkerToken('')).toBeNull()
  mockVerify.mockRejectedValue(new Error('expired'))
  expect(await verifyTokenRole('invalid')).toBeNull()
  expect(mockProfileGet).not.toHaveBeenCalled()
})
