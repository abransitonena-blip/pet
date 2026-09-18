import fs from 'node:fs'
import path from 'node:path'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { isMaintenanceBlockedPath } from '@/lib/maintenance'
import { MaintenanceGate } from '@/components/Maintenance'

let mockPathname = '/'
let mockMaintenance = false

jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}))

jest.mock('@/context/ConfigContext', () => ({
  useConfig: () => ({ config: { maintenance: mockMaintenance } }),
}))

const root = path.resolve(__dirname, '..')
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8')

describe('modo mantenimiento', () => {
  test('cierra solo las páginas públicas informativas', () => {
    for (const pathname of ['/', '/nosotros', '/equipo', '/equipo/', '/preguntas-frecuentes']) {
      expect(isMaintenanceBlockedPath(pathname)).toBe(true)
    }
    for (const pathname of [
      '/login', '/admin', '/admin/config', '/familia', '/familia/historial', '/walker', '/supervisor',
      '/privacidad', '/terminos', '/cancelar', '/api/version', '/qr/abc',
    ]) {
      expect(isMaintenanceBlockedPath(pathname)).toBe(false)
    }
    expect(isMaintenanceBlockedPath(null)).toBe(false)
  })

  test('encendido, la página principal muestra la pantalla de mantenimiento con el aviso de privacidad a la mano', () => {
    mockMaintenance = true
    mockPathname = '/'
    render(<MaintenanceGate><p>Inicio normal</p></MaintenanceGate>)
    expect(screen.getByRole('heading', { name: 'Estamos en mantenimiento' })).toBeInTheDocument()
    expect(screen.queryByText('Inicio normal')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Aviso de privacidad' })).toHaveAttribute('href', '/privacidad')
    expect(screen.getByRole('link', { name: 'Entrar a Familia PET' })).toHaveAttribute('href', '/login')
  })

  test('encendido, admin sigue normal; apagado, todo sigue normal', () => {
    mockMaintenance = true
    mockPathname = '/admin/config'
    const { unmount } = render(<MaintenanceGate><p>Panel admin</p></MaintenanceGate>)
    expect(screen.getByText('Panel admin')).toBeInTheDocument()
    unmount()

    mockMaintenance = false
    mockPathname = '/'
    render(<MaintenanceGate><p>Inicio normal</p></MaintenanceGate>)
    expect(screen.getByText('Inicio normal')).toBeInTheDocument()
  })

  test('las reservas nuevas se pausan, programadas y PET Ahora', () => {
    expect(read('src/app/layout.tsx')).toContain('<MaintenanceGate>{children}</MaintenanceGate>')
    expect(read('src/app/familia/nueva-reserva/FamiliaNuevaReservaPanel.tsx')).toContain('if (config.maintenance === true) return <BookingPausedNotice />')
    expect(read('src/components/PetAhoraRequestForm.tsx')).toContain('if (config.maintenance === true) return <BookingPausedNotice />')
  })

  test('Configuración dice exactamente lo que pasa', () => {
    const admin = read('src/components/AdminConfig.tsx')
    expect(admin).toContain('no se podrán solicitar paseos nuevos')
    expect(admin).not.toContain('Los clientes no podrán acceder a la página principal.')
  })
})

describe('consejos para el paseo', () => {
  test('se editan en Configuración y se muestran en el inicio de la familia', () => {
    const home = read('src/app/familia/FamiliaPanel.tsx')
    expect(home).toContain('Consejos para el paseo')
    expect(home).toContain('config.walkTips')
    expect(read('src/components/AdminConfig.tsx')).toContain("label: 'Consejos para el paseo'")
  })
})
