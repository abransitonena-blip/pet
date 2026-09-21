import { readFileSync } from 'node:fs'
import { GEOFENCE_REPEAT_MS, buildGeofencePush, geofenceNotifyReason } from '../src/lib/geofenceAlert'

const read = (path: string) => readFileSync(path, 'utf8')
const NOW = Date.UTC(2026, 8, 22, 18, 0)

/**
 * La alerta de "salió de la zona" sólo se guardaba y salía en un cartel DENTRO del
 * panel de administración. Un cartel dentro de un panel lo ve quien lo tiene
 * abierto en ese momento: un paseador se salía y nadie se enteraba.
 */
describe('cuándo se avisa', () => {
  it('la primera vez que sale', () => {
    expect(geofenceNotifyReason(null, NOW)).toBe('first')
  })

  it('cuando vuelve a salir después de que administración la marcó', () => {
    expect(geofenceNotifyReason({ status: 'acknowledged', lastNotifiedAtMs: NOW - 5_000 }, NOW)).toBe('reopened')
  })

  it('no con cada lectura: el teléfono manda su posición cada ~2 minutos', () => {
    // Una salida produce decenas de lecturas fuera; un aviso por lectura sería ruido.
    for (let minutes = 2; minutes < 30; minutes += 2) {
      expect(geofenceNotifyReason({ status: 'open', lastNotifiedAtMs: NOW - minutes * 60_000 }, NOW)).toBeNull()
    }
  })

  it('un recordatorio si sigue abierta y nadie la atiende, cada media hora', () => {
    expect(GEOFENCE_REPEAT_MS).toBe(30 * 60_000)
    expect(geofenceNotifyReason({ status: 'open', lastNotifiedAtMs: NOW - GEOFENCE_REPEAT_MS + 1 }, NOW)).toBeNull()
    expect(geofenceNotifyReason({ status: 'open', lastNotifiedAtMs: NOW - GEOFENCE_REPEAT_MS }, NOW)).toBe('reminder')
    expect(geofenceNotifyReason({ status: 'open', lastNotifiedAtMs: NOW - 3 * 60 * 60_000 }, NOW)).toBe('reminder')
  })

  it('una alerta abierta de antes de que existieran los avisos, se avisa una vez', () => {
    expect(geofenceNotifyReason({ status: 'open' }, NOW)).toBe('reminder')
  })
})

describe('lo que dice el aviso', () => {
  const first = buildGeofencePush({ walkerName: 'Ana', zoneName: 'Roma Norte', sessionId: 's1', reason: 'first' })
  const reminder = buildGeofencePush({ walkerName: 'Ana', zoneName: 'Roma Norte', sessionId: 's1', reason: 'reminder' })

  it('dice "área recomendada", no "frontera": la zona es una sugerencia, y a quien opera le toca juzgar', () => {
    expect(first.body).toContain('área recomendada')
    expect(first.title).toContain('área recomendada')
    expect(first.body).not.toMatch(/frontera|límite|prohibid|infracci/i)
  })

  it('nombra al paseador y la zona, y manda a Rutas, donde se marca', () => {
    expect(first.title).toContain('Ana')
    expect(first.body).toContain('Roma Norte')
    expect(first.url).toBe('/admin/rutas')
    expect(first.body).toContain('márcalo en Rutas')
  })

  it('no lleva coordenadas: sale en la pantalla bloqueada', () => {
    expect(`${first.title} ${first.body}`).not.toMatch(/\d{2}\.\d{3,}/)
    expect(`${first.title} ${first.body}`).not.toMatch(/lat|lng|\bm\b de/i)
  })

  it('el recordatorio suena distinto y reemplaza al anterior en la bandeja', () => {
    expect(reminder.title).toContain('sigue fuera')
    expect(reminder.tag).toBe(first.tag)
    expect(first.tag).toBe('geofence-s1')
  })

  it('sin nombre ni zona, sigue diciendo algo entendible', () => {
    const bare = buildGeofencePush({ walkerName: '  ', zoneName: '', sessionId: 's2', reason: 'first' })
    expect(bare.title).toContain('Un paseador')
    expect(bare.body).not.toContain('()')
  })
})

describe('en la ruta del seguimiento', () => {
  const route = read('src/app/api/tracking/point/route.ts')
  const staff = read('src/lib/push/staffPush.ts')

  it('decide dentro de la transacción y sella cuándo avisó', () => {
    expect(route).toContain('geofenceNotifyReason(')
    expect(route).toContain('...(reason ? { lastNotifiedAt: now } : {})')
    expect(route).toContain('return reason')
  })

  it('el aviso sale después de guardar la alerta, sólo si toca, y nunca tumba el registro del punto', () => {
    const tx = route.indexOf('await firestore.runTransaction')
    const push = route.indexOf('await notifyStaff(')
    expect(tx).toBeGreaterThan(-1)
    expect(push).toBeGreaterThan(tx)
    const guard = route.slice(route.indexOf('if (notifyReason) {'), route.indexOf('tracking/point staff push failed'))
    expect(guard).toContain('try {')
    expect(guard).toContain('} catch (error) {')
    // Hay un solo envío: no uno por lectura.
    expect(route.match(/notifyStaff\(/g)).toHaveLength(1)
  })

  it('a quien opera se le busca por su rol, no en una lista', () => {
    expect(staff).toContain('staffUidsAmong(')
    expect(staff).toContain("collection('pushTokens')")
  })

  it('si había teléfonos y no salió ninguno, queda en el registro del servidor', () => {
    expect(staff).toContain('if (notified === 0) {')
    expect(staff).toContain('console.warn(')
  })

  it('el cartel dentro del panel sigue: el aviso lo complementa, no lo reemplaza', () => {
    expect(read('src/components/admin/GeofenceAlertsBanner.tsx')).toContain('salió de la zona')
  })
})
