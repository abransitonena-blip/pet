import fs from 'node:fs'
import path from 'node:path'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import PWARegister, { requestServiceWorkerUpdate, SERVICE_WORKER_UPDATE_MESSAGE } from '@/components/PWARegister'

const root = path.resolve(__dirname, '..')
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8')

describe('Phase B service worker cache policy', () => {
  test('never intercepts navigation, private routes, APIs or query URLs', () => {
    const worker = read('public/sw.js')

    expect(worker).toContain("e.request.mode === 'navigate'")
    expect(worker).toContain('url.search')
    expect(worker).toContain("'/api/'")
    expect(worker).toContain("'/familia'")
    expect(worker).not.toMatch(/const ASSETS = \[[\s\S]*?['"]\/['"][\s\S]*?\]/)
    expect(worker).not.toContain("'/manifest.json'")
  })

  test('only removes PET Ap caches and preserves unrelated origin storage', () => {
    const worker = read('public/sw.js')

    expect(worker).toContain("const OWNED_CACHE_PREFIX = 'pet-ap-'")
    expect(worker).toContain("'pet-v2-static'")
    expect(worker).toContain('key.startsWith(OWNED_CACHE_PREFIX) || LEGACY_CACHES.has(key)')
    expect(worker).not.toContain('keys.filter((k) => k !== CACHE)')
  })

  test('waits for an explicit update request and claims clients once activated', () => {
    const worker = read('public/sw.js')
    const installHandler = worker.slice(worker.indexOf("self.addEventListener('install'"), worker.indexOf("self.addEventListener('activate'"))

    expect(installHandler).not.toContain('skipWaiting')
    expect(worker).toContain("e.data?.type === 'SKIP_WAITING'")
    expect(worker).toContain('self.clients.claim()')
  })

  test('sends the update message only to an actual waiting worker', () => {
    const postMessage = jest.fn()
    const withWaiting = { waiting: { postMessage } } as unknown as ServiceWorkerRegistration
    const withoutWaiting = { waiting: null } as unknown as ServiceWorkerRegistration

    expect(requestServiceWorkerUpdate(withoutWaiting)).toBe(false)
    expect(requestServiceWorkerUpdate(withWaiting)).toBe(true)
    expect(postMessage).toHaveBeenCalledWith({ type: SERVICE_WORKER_UPDATE_MESSAGE })
  })

  test('registers globally and offers an accessible manual update', async () => {
    const postMessage = jest.fn()
    const registration = {
      waiting: { postMessage },
      installing: null,
      update: jest.fn().mockResolvedValue(undefined),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    } as unknown as ServiceWorkerRegistration
    const serviceWorker = {
      controller: {},
      register: jest.fn().mockResolvedValue(registration),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }

    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: serviceWorker })
    render(<PWARegister />)

    const updateButton = await screen.findByRole('button', { name: 'Actualizar' })
    expect(screen.getByRole('status').textContent).toContain('Hay una nueva versión de PET Ap disponible.')
    expect(serviceWorker.register).toHaveBeenCalledWith('/sw.js', { scope: '/' })

    fireEvent.click(updateButton)
    expect(postMessage).toHaveBeenCalledWith({ type: SERVICE_WORKER_UPDATE_MESSAGE })

    fireEvent.click(screen.getByRole('button', { name: 'Más tarde' }))
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull())
    expect(read('src/app/layout.tsx')).toContain('<PWARegister />')
    expect(read('src/app/HomeClient.tsx')).not.toContain('<PWARegister />')
  })
})
