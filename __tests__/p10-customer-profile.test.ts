jest.mock('@/lib/env', () => ({
  requiredEnv: (value: string | undefined, name: string) => value || `mock-${name}`
}))

jest.mock('@/firebase/config', () => ({
  db: {}
}))
jest.mock('@/firebase/db', () => ({ db: {} }))

jest.mock('firebase/firestore', () => {
  const mockFn = () => jest.fn()
  return {
    getFirestore: mockFn().mockReturnValue({}),
    doc: jest.fn().mockReturnValue({}),
    getDoc: jest.fn(),
    runTransaction: jest.fn(),
    setDoc: jest.fn().mockReturnValue({ catch: () => Promise.resolve() }),
    serverTimestamp: jest.fn(() => ({ _mock: 'serverTimestamp' }))
  } as unknown as typeof import('firebase/firestore')
})

import { getDoc as getDocMock, runTransaction as runTransactionMock, setDoc as setDocMock } from 'firebase/firestore'
import { getCustomerProfile, ensureCanonicalCustomerProfile } from '../src/lib/customerProfile'

const getDocM = getDocMock as jest.Mock
const runTransactionM = runTransactionMock as jest.Mock
const setDocM = setDocMock as jest.Mock
const transactionGetM = jest.fn()
const transactionSetM = jest.fn()

describe('customerProfile.ts', () => {
  beforeEach(() => {
    getDocM.mockReset()
    getDocM.mockReturnValue({ catch: () => Promise.resolve() })
    setDocM.mockReset()
    setDocM.mockReturnValue({ catch: () => Promise.resolve() })
    transactionGetM.mockReset()
    transactionSetM.mockReset()
    runTransactionM.mockReset()
    runTransactionM.mockImplementation((_db, callback) => callback({ get: transactionGetM, set: transactionSetM }))
  })

  describe('getCustomerProfile', () => {
    it('reads from customerProfiles when doc exists', async () => {
      getDocM.mockReturnValueOnce({ exists: () => true, data: () => ({ name: 'John', email: 'john@example.com' }) })

      const result = await getCustomerProfile('user-1')
      expect(result).toEqual({ name: 'John', email: 'john@example.com' })
      expect(getDocM).toHaveBeenCalledTimes(1)
    })

    it('falls back to legacy clients when customerProfiles missing', async () => {
      getDocM.mockReturnValueOnce({ exists: () => false })
      getDocM.mockReturnValueOnce({ exists: () => true, data: () => ({ name: 'Jane', email: 'jane@example.com' }) })

      const result = await getCustomerProfile('user-1')
      expect(result).toEqual({ name: 'Jane', email: 'jane@example.com' })
      expect(getDocM).toHaveBeenCalledTimes(2)
    })

    it('returns null when neither store has data', async () => {
      getDocM.mockReturnValue({ exists: () => false })

      const result = await getCustomerProfile('user-99')
      expect(result).toBeNull()
      expect(getDocM).toHaveBeenCalledTimes(2)
    })
  })

  describe('ensureCanonicalCustomerProfile', () => {
    it('no-op when customerProfiles already exists', async () => {
      transactionGetM.mockResolvedValueOnce({ exists: () => true, data: () => ({ name: 'Existing' }) })

      await expect(ensureCanonicalCustomerProfile({ uid: 'user-1', displayName: 'Test', email: 'test@example.com' })).resolves.toBe('existing')
      expect(transactionGetM).toHaveBeenCalledTimes(1)
      expect(transactionSetM).not.toHaveBeenCalled()
    })

    it('creates a new canonical profile without reading clients', async () => {
      transactionGetM.mockResolvedValueOnce({ exists: () => false })

      await expect(ensureCanonicalCustomerProfile({ uid: 'user-1', displayName: 'New User', email: 'new@example.com' })).resolves.toBe('created')
      expect(getDocM).not.toHaveBeenCalled()
      expect(transactionSetM).toHaveBeenCalledTimes(1)
      expect(transactionSetM).toHaveBeenCalledWith(
        expect.anything(),
        { name: 'New User', email: 'new@example.com', phone: '', createdAt: expect.anything() }
      )
    })

    it('handles null display name and email', async () => {
      transactionGetM.mockResolvedValueOnce({ exists: () => false })

      await ensureCanonicalCustomerProfile({ uid: 'user-1', displayName: null, email: null })
      expect(transactionSetM).toHaveBeenCalledWith(
        expect.anything(),
        { name: '', email: '', phone: '', createdAt: expect.anything() }
      )
    })

    it('is idempotent when a partial Auth account retries onboarding', async () => {
      let exists = false
      transactionGetM.mockImplementation(async () => ({ exists: () => exists }))
      transactionSetM.mockImplementation(() => { exists = true })

      await expect(ensureCanonicalCustomerProfile({ uid: 'partial-1', displayName: 'Retry', email: null })).resolves.toBe('created')
      await expect(ensureCanonicalCustomerProfile({ uid: 'partial-1', displayName: 'Retry', email: null })).resolves.toBe('existing')
      expect(transactionSetM).toHaveBeenCalledTimes(1)
    })

    it.each(['firestore/permission-denied', 'firestore/unavailable'])('preserves %s for stage-aware handling', async (code) => {
      runTransactionM.mockRejectedValueOnce(Object.assign(new Error('sanitized'), { code }))
      await expect(ensureCanonicalCustomerProfile({ uid: 'user-1', displayName: null, email: null }))
        .rejects.toMatchObject({ code })
    })
  })
})
