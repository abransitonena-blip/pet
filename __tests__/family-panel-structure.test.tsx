import fs from 'node:fs'
import path from 'node:path'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import AppShell from '@/components/layout/AppShell'

jest.mock('next/navigation', () => ({
  usePathname: () => '/familia/fotos',
}))

const root = path.resolve(__dirname, '..')
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8')

describe('panel de familia ordenado', () => {
  test('el menú empieza por el paseo y agrupa el resto, sin perder ningún destino', () => {
    const layout = read('src/app/familia/FamilyLayoutClient.tsx')
    const hrefs = Array.from(layout.matchAll(/href: '([^']+)'/g), (match) => match[1])
    expect(hrefs.slice(0, 6)).toEqual([
      '/familia', '/familia/nueva-reserva', '/familia/historial', '/familia/fotos', '/familia/perros', '/familia/direcciones',
    ])
    expect(hrefs).toHaveLength(14)
    for (const group of ['Paseos', 'Mi familia', 'Beneficios', 'Cuenta']) {
      expect(layout).toContain(`group: '${group}'`)
    }
    for (const href of hrefs) {
      const page = href === '/familia' ? 'src/app/familia/page.tsx' : `src/app${href}/page.tsx`
      expect(fs.existsSync(path.join(root, page))).toBe(true)
    }
  })

  test('AppShell muestra los encabezados de grupo y una sola sección activa', () => {
    render(
      <AppShell
        navItems={[
          { id: 'inicio', label: 'Inicio', href: '/familia', group: 'Paseos' },
          { id: 'fotos', label: 'Fotos y reportes', href: '/familia/fotos', group: 'Paseos' },
          { id: 'perros', label: 'Mis perros', href: '/familia/perros', group: 'Mi familia' },
        ]}
        userName="Ana"
        userRole="Familia PET"
        onLogout={jest.fn()}
      >
        <p>Contenido</p>
      </AppShell>,
    )
    expect(screen.getByText('Paseos')).toBeInTheDocument()
    expect(screen.getByText('Mi familia')).toBeInTheDocument()
    const current = screen.getAllByRole('link', { current: 'page' })
    expect(current).toHaveLength(1)
    expect(current[0]).toHaveTextContent('Fotos y reportes')
  })

  test('fotos: un reporte en borrador no se presenta como paseo sin fotos, y solo los recientes cargan fotos', () => {
    const page = read('src/app/familia/fotos/page.tsx')
    expect(page).toContain("'Reporte en preparación'")
    expect(page).toContain('const INLINE_PHOTO_WALKS = 6')
    expect(page).toContain('<WalkPhotos sessionId={session.id} references={photos} />')
  })
})
