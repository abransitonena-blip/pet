import fs from 'node:fs'
import path from 'node:path'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import AppShell from '@/components/layout/AppShell'
import { isPanelRouteActive } from '@/lib/navigation'

let currentPathname = '/admin/tickets/example-ticket'

jest.mock('next/navigation', () => ({
  usePathname: () => currentPathname,
}))

describe('O1 navegación compartida', () => {
  test('una subruta activa su sección específica, no la raíz del panel', () => {
    expect(isPanelRouteActive('/admin/tickets/example-ticket', '/admin')).toBe(false)
    expect(isPanelRouteActive('/admin/tickets/example-ticket', '/admin/tickets')).toBe(true)
    expect(isPanelRouteActive('/familia/reportes/session-1', '/familia')).toBe(false)
  })

  test('AppShell expone una sola sección activa y targets mínimos', () => {
    currentPathname = '/admin/tickets/example-ticket'
    render(
      <AppShell
        navItems={[
          { id: 'root', label: 'Resumen', href: '/admin' },
          { id: 'tickets', label: 'Tickets', href: '/admin/tickets' },
        ]}
        userName="Admin"
        userRole="Administración"
        onLogout={jest.fn()}
      >
        <p>Contenido</p>
      </AppShell>,
    )

    const currentLinks = screen.getAllByRole('link', { current: 'page' })
    expect(currentLinks).toHaveLength(1)
    expect(currentLinks[0]).toHaveTextContent('Tickets')
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toHaveClass('min-h-11', 'min-w-11')
  })

  test('Admin agrupa destinos existentes y el drawer tiene cierre accesible', () => {
    const root = path.resolve(__dirname, '..')
    const layout = fs.readFileSync(path.join(root, 'src/app/admin/AdminLayoutClient.tsx'), 'utf8')
    const shell = fs.readFileSync(path.join(root, 'src/components/layout/AdminShell.tsx'), 'utf8')

    expect(layout).toContain("group: 'Operación'")
    expect(layout).toContain("href: '/admin/reportes'")
    expect(shell).toContain('aria-label="Cerrar menú de navegación"')
    expect(shell).toContain("event.key === 'Escape'")
    expect(shell).toContain('motion-reduce:transition-none')

    const hrefs = Array.from(layout.matchAll(/href: '([^']+)'/g), (match) => match[1])
    for (const href of hrefs) {
      const relative = href === '/admin' ? 'src/app/admin/AdminPanel.tsx' : `src/app${href}/page.tsx`
      expect(fs.existsSync(path.join(root, relative))).toBe(true)
    }
  })

  test('el encabezado público mantiene targets de 44 px, foco y reduced motion', () => {
    const root = path.resolve(__dirname, '..')
    const header = fs.readFileSync(path.join(root, 'src/components/Header.tsx'), 'utf8')

    expect(header).toContain('min-h-11')
    expect(header).toContain('focus-visible:ring-2')
    expect(header).toContain('useReducedMotion')
    expect(header).toContain("event.key === 'Escape'")
  })
})
