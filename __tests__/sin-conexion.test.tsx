import React from 'react'
import { act, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { readFileSync } from 'node:fs'
import OfflineNotice from '../src/components/layout/OfflineNotice'

const read = (path: string) => readFileSync(path, 'utf8')

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { value, configurable: true })
  act(() => { window.dispatchEvent(new Event(value ? 'online' : 'offline')) })
}

afterEach(() => setOnline(true))

/**
 * Desde que la caché de Firestore vive en el disco, un panel sin internet se ve
 * igual que uno con internet: datos viejos que parecen de ahora y escrituras
 * que esperan sin decirlo.
 */
describe('el aviso de sin conexión', () => {
  it('no se ve mientras hay red', () => {
    setOnline(true)
    const { container } = render(<OfflineNotice />)
    expect(container).toBeEmptyDOMElement()
  })

  it('aparece al perderla y explica las dos cosas que importan', () => {
    setOnline(true)
    render(<OfflineNotice />)
    setOnline(false)
    const notice = screen.getByRole('status')
    expect(notice).toHaveTextContent('Sin conexión')
    expect(notice).toHaveTextContent('puede estar desactualizado')
    expect(notice).toHaveTextContent('saldrá solo cuando vuelva la señal')
  })

  it('se va al volver la red', () => {
    setOnline(false)
    render(<OfflineNotice />)
    expect(screen.getByRole('status')).toBeInTheDocument()
    setOnline(true)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('está en los tres armazones: familia, paseador y administración', () => {
    expect(read('src/components/layout/AppShell.tsx')).toContain('<OfflineNotice />')
    expect(read('src/components/layout/AdminShell.tsx')).toContain('<OfflineNotice />')
  })

  it('sólo afirma lo que sabe: nunca dice que hay red, sólo que no la hay', () => {
    const source = read('src/components/layout/OfflineNotice.tsx')
    expect(source).toContain('if (!offline) return null')
    expect(source).toContain('setOffline(!navigator.onLine)')
  })
})
