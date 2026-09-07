import { CustomerRepository } from '../src/lib/repositories/customerRepository'
import { DogRepository } from '../src/lib/repositories/dogRepository'
import { ReservationRepository } from '../src/lib/repositories/reservationRepository'

jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn().mockReturnValue({}),
  doc: jest.fn().mockReturnValue({}),
  getDoc: jest.fn(),
  setDoc: jest.fn(),
  deleteDoc: jest.fn()
}))

import { getDoc, setDoc, deleteDoc } from 'firebase/firestore'

const getDocMock = getDoc as jest.Mock

describe('CustomerRepository', () => {
  beforeEach(() => {
    getDocMock.mockReset()
  })

  it('new only — reads customerProfiles', async () => {
    getDocMock.mockResolvedValue({ exists: () => true, data: () => ({ userId: 'user-1', name: 'John' }) })

    const result = await CustomerRepository.read('user-1')
    expect(result).toEqual({ uid: 'user-1', name: 'John' })
  })

  it('legacy only — fallback to clients', async () => {
    getDocMock.mockResolvedValueOnce({ exists: () => false })
    getDocMock.mockResolvedValueOnce({ exists: () => true, data: () => ({ name: 'Jane Doe', email: 'jane@example.com' }) })

    const result = await CustomerRepository.read('user-1')
    expect(result).toEqual({ uid: 'user-1', name: 'Jane Doe', email: 'jane@example.com' })
  })

  it('inexistente — returns null', async () => {
    getDocMock.mockResolvedValue({ exists: () => false })

    const result = await CustomerRepository.read('user-99')
    expect(result).toBeNull()
  })

  it('normalización — legacy fields mapped', async () => {
    getDocMock.mockResolvedValueOnce({ exists: () => false })
    getDocMock.mockResolvedValueOnce({ exists: () => true, data: () => ({ name: 'Test User', email: 'test@example.com' }) })

    const result = await CustomerRepository.read('user-2')
    expect(result?.uid).toBe('user-2')
    expect(result?.name).toBe('Test User')
    expect(result?.email).toBe('test@example.com')
  })

  it('cero escrituras — read no muta', async () => {
    const setDocMock = setDoc as unknown as jest.Mock
    const deleteDocMock = deleteDoc as unknown as jest.Mock
    getDocMock.mockResolvedValue({ exists: () => false })
    await CustomerRepository.read('user-1')
    expect(setDocMock).not.toHaveBeenCalled()
    expect(deleteDocMock).not.toHaveBeenCalled()
  })

  it('fallback registrado', async () => {
    getDocMock.mockResolvedValueOnce({ exists: () => false })
    getDocMock.mockResolvedValueOnce({ exists: () => true, data: () => ({ name: 'User' }) })

    const result = await CustomerRepository.read('user-1')
    expect(result).not.toBeNull()
    expect(getDocMock).toHaveBeenCalledTimes(2)
  })
})

describe('DogRepository', () => {
  beforeEach(() => {
    getDocMock.mockReset()
  })

  it('new only — reads dogs', async () => {
    getDocMock.mockResolvedValue({ exists: () => true, data: () => ({ id: 'dog-1', customerId: 'user-1', name: 'Fluffy', breed: 'Golden' }) })

    const result = await DogRepository.read('dog-1')
    expect(result?.name).toBe('Fluffy')
    expect(result?.customerId).toBe('user-1')
    expect(result?.id).toBe('dog-1')
  })

  it('legacy only — fallback to pets', async () => {
    getDocMock.mockResolvedValueOnce({ exists: () => false })
    getDocMock.mockResolvedValueOnce({ exists: () => true, data: () => ({ name: 'Buddy', ownerId: 'user-1' }) })

    const result = await DogRepository.read('pet-1')
    expect(result?.customerId).toBe('user-1')
    expect(result?.name).toBe('Buddy')
  })

  it('inexistente', async () => {
    getDocMock.mockResolvedValue({ exists: () => false })

    const result = await DogRepository.read('dog-99')
    expect(result).toBeNull()
  })

  it('normalización — legacy fields mapped', async () => {
    getDocMock.mockResolvedValueOnce({ exists: () => false })
    getDocMock.mockResolvedValueOnce({ exists: () => true, data: () => ({ name: 'Max', ownerId: 'user-1', breed: 'Labrador' }) })

    const result = await DogRepository.read('pet-1')
    expect(result?.id).toBe('pet-1')
    expect(result?.customerId).toBe('user-1')
    expect(result?.name).toBe('Max')
  })

  it('cero escrituras', async () => {
    const setDocMock = setDoc as unknown as jest.Mock
    const deleteDocMock = deleteDoc as unknown as jest.Mock
    getDocMock.mockResolvedValue({ exists: () => false })
    await DogRepository.read('dog-1')
    expect(setDocMock).not.toHaveBeenCalled()
    expect(deleteDocMock).not.toHaveBeenCalled()
  })

  it('both — prefer new schema', async () => {
    getDocMock.mockResolvedValue({ exists: () => true, data: () => ({ id: 'dog-1', customerId: 'user-1', name: 'New Dog' }) })

    const result = await DogRepository.read('dog-1')
    expect(result?.name).toBe('New Dog')
    expect(getDocMock).toHaveBeenCalledTimes(1)
  })

  it('empty data — safe defaults', async () => {
    const setDocMock = setDoc as unknown as jest.Mock
    const deleteDocMock = deleteDoc as unknown as jest.Mock
    getDocMock.mockResolvedValue({ exists: () => true, data: () => ({}) })

    const result = await DogRepository.read('dog-empty')
    expect(result).not.toBeNull()
    expect(result?.name).toBeUndefined()
    expect(setDocMock).not.toHaveBeenCalled()
    expect(deleteDocMock).not.toHaveBeenCalled()
  })
})

describe('ReservationRepository', () => {
  beforeEach(() => {
    getDocMock.mockReset()
  })

  it('reads reservations with normalized fields', async () => {
    getDocMock.mockResolvedValue({ exists: () => true, data: () => ({ customerId: 'user-1', dogIds: ['dog-1'], status: 'confirmed' }) })

    const result = await ReservationRepository.read('res-1')
    expect(result?.customerId).toBe('user-1')
    expect(result?.status).toBe('confirmed')
    expect(result?.dogIds).toEqual(['dog-1'])
  })

  it('inexistente', async () => {
    getDocMock.mockResolvedValue({ exists: () => false })

    const result = await ReservationRepository.read('res-99')
    expect(result).toBeNull()
  })

  it('legacy fallback — client field', async () => {
    getDocMock.mockResolvedValue({ exists: () => true, data: () => ({ client: { uid: 'user-1' }, dogs: ['dog-1'], status: 'pending' }) })

    const result = await ReservationRepository.read('res-1')
    expect(result?.customerId).toBe('user-1')
    expect(result?.dogIds).toEqual(['dog-1'])
    expect(result?.status).toBe('pending')
  })

  it('customer fallback', async () => {
    getDocMock.mockResolvedValue({ exists: () => true, data: () => ({ customer: { uid: 'user-2' }, dogIds: ['dog-2'], status: 'completed' }) })

    const result = await ReservationRepository.read('res-1')
    expect(result?.customerId).toBe('user-2')
  })

  it('cero escrituras', async () => {
    const setDocMock = setDoc as unknown as jest.Mock
    const deleteDocMock = deleteDoc as unknown as jest.Mock
    getDocMock.mockResolvedValue({ exists: () => false })
    await ReservationRepository.read('res-1')
    expect(setDocMock).not.toHaveBeenCalled()
    expect(deleteDocMock).not.toHaveBeenCalled()
  })

  it('status default — pending when missing', async () => {
    getDocMock.mockResolvedValue({ exists: () => true, data: () => ({ customerId: 'user-1', dogIds: [] }) })

    const result = await ReservationRepository.read('res-1')
    expect(result?.status).toBe('pending')
  })

  it('empty data — safe defaults', async () => {
    const setDocMock = setDoc as unknown as jest.Mock
    const deleteDocMock = deleteDoc as unknown as jest.Mock
    getDocMock.mockResolvedValue({ exists: () => true, data: () => ({}) })

    const result = await ReservationRepository.read('res-empty')
    expect(result).not.toBeNull()
    expect(result?.status).toBe('pending')
    expect(result?.dogIds).toEqual([])
    expect(setDocMock).not.toHaveBeenCalled()
    expect(deleteDocMock).not.toHaveBeenCalled()
  })
})
