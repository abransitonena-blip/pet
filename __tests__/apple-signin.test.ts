import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(path, 'utf8')

/**
 * Acceso con Apple. Lo que se rompe callado aquí es ofrecer el botón antes de
 * que el trámite con Apple esté terminado: la palomita verde del proveedor en
 * Firebase no comprueba que el Services ID y la llave existan, así que el botón
 * trona y la familia no sabe por qué.
 */
describe('acceso con Apple', () => {
  const lib = read('src/lib/appleAuth.ts')
  const login = read('src/app/login/page.tsx')

  test('el botón sólo aparece cuando alguien lo declaró configurado', () => {
    expect(lib).toContain('NEXT_PUBLIC_APPLE_AUTH_ENABLED')
    expect(lib).toContain("=== '1'")
    expect(login).toContain('isAppleAuthConfigured() && !webView')
  })

  test('pide a Apple el nombre y el correo', () => {
    expect(lib).toContain("addScope('email')")
    expect(lib).toContain("addScope('name')")
  })

  test('no viaja ningún secreto de Apple por el navegador', () => {
    for (const forbidden of ['BEGIN PRIVATE KEY', 'teamId', 'keyId', 'p8']) {
      expect(lib).not.toContain(forbidden)
    }
  })

  test('un problema de configuración no se le achaca al internet de la familia', () => {
    expect(lib).toContain("code === 'auth/invalid-credential'")
    expect(lib).toContain('todavía no está configurado del todo')
    expect(lib).toContain("code === 'auth/operation-not-allowed'")
  })

  test('cerrar la ventana de Apple no muestra un error', () => {
    expect(lib).toContain("code === 'auth/popup-closed-by-user'")
    expect(lib).toMatch(/popup-closed-by-user[\s\S]{0,120}return ''/)
    expect(login).toContain('if (message) setError(message)')
  })

  test('el final del acceso es el mismo para correo, Google y Apple', () => {
    expect(login).toContain('const finalizeSignIn = useCallback(')
    expect(login).not.toContain('finalizeGoogle')
    // Tres proveedores, un solo camino a rol + perfil + cookie de sesión.
    expect((login.match(/await finalizeSignIn\(/g) ?? []).length).toBeGreaterThanOrEqual(4)
  })
})

/**
 * La placa QR quedó encendida con sus reglas ya publicadas. El opt-in por
 * mascota sigue siendo lo que decide si algo se publica.
 */
describe('placa de emergencia', () => {
  test('la función está encendida pero cada perro sigue decidiendo', () => {
    expect(read('src/lib/featureFlags.ts')).toContain('PET_EMERGENCY_QR_ENABLED: true')
    expect(read('src/components/family/EmergencyTagSection.tsx')).toContain('emergencyProfile')
  })

  test('las reglas del perfil público están en el archivo que se despliega', () => {
    const rules = read('firestore.rules')
    expect(rules).toContain('match /emergency-profiles/{publicSlug}')
    expect(rules).toContain('allow list: if false;')
  })
})
