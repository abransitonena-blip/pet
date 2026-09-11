import { readFileSync } from 'node:fs'
import { emergencyProfileUrl, generatePublicSlug, isEmergencySlug } from '@/lib/emergencyProfile'

// El módulo toca Firestore para escribir el espejo; aquí solo se prueban sus
// ayudantes puros y el contrato de las reglas, así que la app no se inicializa.
jest.mock('@/firebase/config', () => ({ db: {}, auth: {} }))

const read = (path: string) => readFileSync(path, 'utf8')

describe('placa QR de emergencia', () => {
  test('el slug es aleatorio, largo y no es el id de la mascota', () => {
    const slug = generatePublicSlug()
    expect(isEmergencySlug(slug)).toBe(true)
    expect(slug).not.toContain('/')
    expect(generatePublicSlug()).not.toBe(slug)
    expect(isEmergencySlug('')).toBe(false)
    expect(isEmergencySlug('corto')).toBe(false)
    expect(isEmergencySlug('con/diagonal-aaaaaaaaaa')).toBe(false)
    expect(emergencyProfileUrl(slug).endsWith(`/qr/${slug}`)).toBe(true)
  })

  test('el documento público no puede llevar dirección, salud ni notas', () => {
    const source = read('src/lib/emergencyProfile.ts')
    const docType = source.slice(source.indexOf('export interface EmergencyProfileDoc'), source.indexOf('// Slug generation'))
    for (const forbidden of ['address', 'direccion', 'health', 'allergies', 'medications', 'notes', 'vet']) {
      expect(docType).not.toContain(forbidden)
    }
  })

  test('las reglas abren la lectura por id y cierran el listado', () => {
    const rules = read('firestore.rules')
    const block = rules.slice(rules.indexOf('match /emergency-profiles/{publicSlug}'))
      .slice(0, rules.slice(rules.indexOf('match /emergency-profiles/{publicSlug}')).indexOf('\n    }') + 6)
    expect(block).toContain('allow get: if true;')
    expect(block).toContain('allow list: if false;')
    expect(block).toContain('request.resource.data.ownerId == request.auth.uid')
    expect(block).toContain('resource.data.ownerId == request.auth.uid')
  })

  test('la página pública y la sección de la familia respetan la bandera', () => {
    expect(read('src/app/qr/[slug]/page.tsx')).toContain('!FEATURE_FLAGS.PET_EMERGENCY_QR_ENABLED')
    expect(read('src/components/family/EmergencyTagSection.tsx')).toContain('if (!FEATURE_FLAGS.PET_EMERGENCY_QR_ENABLED) return null')
  })

  test('el teléfono solo viaja al documento público si el dueño lo activó', () => {
    const source = read('src/lib/emergencyProfile.ts')
    expect(source).toContain('if (input.showOwnerPhone && input.ownerPhone) payload.ownerPhone = input.ownerPhone')
  })
})

describe('la sesión no se cae sola', () => {
  test('la marca de sesión dura 30 días y se renueva mientras haya sesión', () => {
    expect(read('src/lib/auth.ts')).toContain('const SESSION_MAX_AGE = 60 * 60 * 24 * 30')
    const keeper = read('src/components/SessionCookieKeeper.tsx')
    expect(keeper).toContain('onAuthStateChanged')
    expect(keeper).toContain('setSessionCookie()')
    expect(keeper).toContain('clearSessionCookie()')
    expect(read('src/components/Providers.tsx')).toContain('<SessionCookieKeeper />')
  })

  test('el inventario de almacenamiento dice la duración real', () => {
    expect(read('src/lib/privacyConfig.ts')).toContain("duration: '30 días, renovada mientras la sesión siga abierta'")
  })
})
