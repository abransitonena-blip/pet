import { act, renderHook, waitFor } from '@testing-library/react'
import { ConfigProvider, useConfig } from '@/context/ConfigContext'

const mockSetDoc = jest.fn()
let mockSnapshot: (snapshot: unknown) => void
jest.mock('@/firebase/config', () => ({ db: {}, auth: { currentUser: { uid: 'admin-1' } } }))
jest.mock('firebase/firestore', () => ({
  doc: () => 'appSettings/public', serverTimestamp: () => 'timestamp',
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  onSnapshot: (_ref: unknown, callback: typeof mockSnapshot) => { mockSnapshot = callback; return () => {} },
}))
jest.mock('@/firebase/db', () => ({ db: {} }))

beforeEach(() => { mockSetDoc.mockReset(); mockSetDoc.mockResolvedValue(undefined) })

/**
 * El SDK de Firestore se carga con `import()` para no pesar en las pantallas
 * públicas, así que la escucha y el guardado empiezan un tick después: estas
 * pruebas esperan ese tick en vez de suponer que todo ocurre en el mismo.
 */
const settle = () => act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve() })

test('only edited fields are sent; stale sections and undefined defaults are not written', async () => {
  const { result } = renderHook(useConfig, { wrapper: ConfigProvider })
  await settle()
  act(() => mockSnapshot({ exists: () => true, data: () => ({ heroTitle: 'Old', maintenance: false }) }))
  await act(() => result.current.updateConfig({ heroTitle: 'New' }))
  expect(mockSetDoc).toHaveBeenCalledWith('appSettings/public', {
    heroTitle: 'New', updatedAt: 'timestamp', updatedBy: 'admin-1',
  }, { mergeFields: ['heroTitle', 'updatedAt', 'updatedBy'] })
  expect(result.current.saved).toBe(true)
})

test.each(['permission-denied', 'unavailable'])('save failure %s is visible and does not report success', async (code) => {
  const { result } = renderHook(useConfig, { wrapper: ConfigProvider })
  await settle()
  mockSetDoc.mockRejectedValue({ code })
  await act(() => result.current.updateConfig({ maintenance: true }))
  expect(result.current.saveError).toMatch(code === 'permission-denied' ? /permiso/ : /vuelve a intentarlo/)
  expect(result.current.saved).toBe(false)
  expect(result.current.saving).toBe(false)
  mockSetDoc.mockResolvedValue(undefined)
  await act(() => result.current.updateConfig({ maintenance: true }))
  expect(result.current.saveError).toBeNull()
  expect(result.current.saved).toBe(true)
})

test('double click sends once and a newer listener snapshot is never overwritten by save completion', async () => {
  const { result } = renderHook(useConfig, { wrapper: ConfigProvider })
  await settle()
  let finish!: () => void
  mockSetDoc.mockImplementation(() => new Promise<void>((resolve) => { finish = resolve }))
  let pending!: Promise<void>
  act(() => {
    pending = result.current.updateConfig({ heroTitle: 'First' })
    // El segundo toque cae en el mismo candado, que se cierra antes de esperar
    // al SDK: se manda una sola vez.
    void result.current.updateConfig({ heroTitle: 'First' })
  })
  await settle()
  expect(mockSetDoc).toHaveBeenCalledTimes(1)
  act(() => mockSnapshot({ exists: () => true, data: () => ({ heroTitle: 'Newer value' }) }))
  await act(async () => { finish(); await pending })
  await waitFor(() => expect(result.current.saving).toBe(false))
  expect(result.current.config.heroTitle).toBe('Newer value')
})
