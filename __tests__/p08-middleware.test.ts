import { matchPrivateRoute, middlewareDecision, PRIVATE_ROUTES } from '../src/lib/privateRoutes'
import { accessPathWithRedirect } from '../src/lib/auth'

describe('middleware — gate de navegación (privado vs público)', () => {
  it('reconoce los paneles internos como rutas privadas', () => {
    expect(matchPrivateRoute('/admin')).toBe('/admin')
    expect(matchPrivateRoute('/admin/paseadores')).toBe('/admin')
    expect(matchPrivateRoute('/familia')).toBe('/familia')
    expect(matchPrivateRoute('/familia/historial')).toBe('/familia')
    expect(matchPrivateRoute('/walker')).toBe('/walker')
    expect(matchPrivateRoute('/walker/mis-paseos')).toBe('/walker')
    expect(matchPrivateRoute('/supervisor')).toBe('/supervisor')
    expect(matchPrivateRoute('/supervisor/incidencias')).toBe('/supervisor')
  })

  it('los aliases legacy siguen cubiertos', () => {
    expect(matchPrivateRoute('/mi-cuenta')).toBe('/mi-cuenta')
    expect(matchPrivateRoute('/paseador')).toBe('/paseador')
  })

  it('las rutas públicas no pasan por el gate', () => {
    expect(matchPrivateRoute('/')).toBeNull()
    expect(matchPrivateRoute('/login')).toBeNull()
    expect(matchPrivateRoute('/terminos')).toBeNull()
    expect(matchPrivateRoute('/api/version')).toBeNull()
  })

  it('PRIVATE_ROUTES cubre los cuatro paneles de rol', () => {
    for (const p of ['/admin', '/familia', '/walker', '/supervisor']) {
      expect(PRIVATE_ROUTES).toContain(p)
    }
  })

  // 15) sesión cerrada → no conserva acceso protegido
  it('sin cookie de sesión → usa el acceso correcto para cada tipo de usuario', () => {
    expect(middlewareDecision('/admin', false)).toBe('/equipo')
    expect(middlewareDecision('/familia', false)).toBe('/login')
    expect(middlewareDecision('/walker', false)).toBe('/equipo')
    expect(middlewareDecision('/supervisor', false)).toBe('/equipo')
    expect(middlewareDecision('/paseador', false)).toBe('/equipo')
    expect(middlewareDecision('/mi-cuenta', false)).toBe('/login')
  })

  it('los layouts conservan el destino original usando la entrada canónica', () => {
    expect(accessPathWithRedirect('/familia/nueva-reserva')).toBe('/login?redirect=%2Ffamilia%2Fnueva-reserva')
    expect(accessPathWithRedirect('/walker/historial')).toBe('/equipo?redirect=%2Fwalker%2Fhistorial')
    expect(accessPathWithRedirect('/admin/reservas')).toBe('/equipo?redirect=%2Fadmin%2Freservas')
    expect(accessPathWithRedirect('//evil.example')).toBe('/equipo')
  })

  it('con sesión la ruta privada pasa al layout para autorizar por claims', () => {
    expect(middlewareDecision('/admin', true)).toBe('/admin')
    expect(middlewareDecision('/walker', true)).toBe('/walker')
  })

  it('las rutas públicas pasan aunque no haya sesión', () => {
    expect(middlewareDecision('/login', false)).toBeNull()
    expect(middlewareDecision('/', false)).toBeNull()
  })
})
