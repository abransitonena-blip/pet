import { readFileSync } from 'node:fs'
import { distanceMeters, isOutsideZone, isUsableCenter, MAX_ACCURACY_TOLERANCE_METERS } from '@/lib/geo'

const read = (path: string) => readFileSync(path, 'utf8')

/**
 * Zone alerts during a walk: the server decides "outside" from the stored
 * session, address and zone; the phone only says where it is. Getting the
 * tolerance wrong either misses a walker who left or pages an admin for every
 * noisy GPS fix.
 */
describe('distancia y zona', () => {
  test('un grado de latitud mide ~111 km', () => {
    expect(Math.abs(distanceMeters({ lat: 0, lng: 0 }, { lat: 1, lng: 0 }) - 111_195)).toBeLessThan(200)
  })

  test('0,0 no es un centro real: es lo que guarda un formulario vacío', () => {
    expect(isUsableCenter({ lat: 0, lng: 0 })).toBe(false)
    expect(isUsableCenter({ lat: 19.43, lng: -99.13 })).toBe(true)
    expect(isUsableCenter({ lat: 120, lng: 0 })).toBe(false)
    expect(isUsableCenter(null)).toBe(false)
  })

  test('en el borde con buena señal no es "fuera"; claramente lejos sí', () => {
    const center = { lat: 19.4326, lng: -99.1332 }
    // ~1.1 km al norte del centro, con zona de 1 km y 150 m de error: dentro de la tolerancia.
    const nearEdge = { lat: 19.4425, lng: -99.1332 }
    expect(isOutsideZone(nearEdge, 150, center, 1).outside).toBe(false)
    // ~2.2 km al norte: fuera sin importar la precisión reportada.
    const far = { lat: 19.4524, lng: -99.1332 }
    expect(isOutsideZone(far, 5_000, center, 1).outside).toBe(true)
  })

  test('la tolerancia nunca excede el tope aunque el teléfono reporte un error enorme', () => {
    const center = { lat: 19.4326, lng: -99.1332 }
    const justPastCap = { lat: 19.4326 + (1000 + MAX_ACCURACY_TOLERANCE_METERS + 60) / 111_195, lng: -99.1332 }
    expect(isOutsideZone(justPastCap, 100_000, center, 1).outside).toBe(true)
  })
})

describe('rastreo y alertas', () => {
  test('el servidor exige que la sesión sea del paseador y esté en curso', () => {
    const route = read('src/app/api/tracking/point/route.ts')
    expect(route).toContain('verifyWalkerToken')
    expect(route).toContain('session.walkerId !== walkerUid')
    expect(route).toContain("session.status !== 'in_progress'")
    expect(route).toContain('FEATURE_FLAGS.WALK_TRACKING_ENABLED')
    // The phone never tells the server whether it is outside.
    expect(route).not.toMatch(/body\.(outside|inside)/)
  })

  test('el paseador ve que se comparte su ubicación y por qué debe dejar la pantalla abierta', () => {
    const tracker = read('src/components/walker/WalkTracker.tsx')
    expect(tracker).toContain("where('status', '==', 'in_progress')")
    expect(tracker).toContain('Mantén esta pantalla abierta')
  })

  test('las reglas: nadie escribe puntos ni alertas desde el navegador; staff solo marca Enterado', () => {
    const rules = read('firestore.rules')
    expect(rules).toContain('match /geofenceAlerts/{sessionId}')
    expect(rules).toContain("onlyAllowedFieldsChanged(['status', 'acknowledgedBy', 'acknowledgedAt'])")
    expect(rules).toContain('match /points/{pointId}')
  })

  test('el mapa no pide llave y escapa los nombres de zona', () => {
    const map = read('src/components/map/ZoneMap.tsx')
    expect(map).toContain('https://tile.openstreetmap.org/{z}/{x}/{y}.png')
    expect(map).toContain('element.textContent = text')
    expect(read('security-headers.js')).toContain('https://tile.openstreetmap.org')
  })
})
