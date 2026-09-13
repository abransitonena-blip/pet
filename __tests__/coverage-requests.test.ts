import {
  COVERAGE_URGENT_REQUESTS,
  pendingCoverageCount,
  summarizeCoverageRequests,
} from '@/lib/coverageRequests'

const row = (postalCode: string, count: number) => ({ postalCode, count, lastRequestedAt: null })

describe('summarizeCoverageRequests', () => {
  const zones = [
    { name: 'Centro', active: true, postalCodes: ['06700', '06600'] },
    { name: 'Zona apagada', active: false, postalCodes: ['11000'] },
  ]

  it('marca como cubierto lo que una zona activa ya incluye', () => {
    const [first] = summarizeCoverageRequests([row('06700', 3)], zones)
    expect(first.status).toBe('cubierto')
    expect(first.zoneName).toBe('Centro')
  })

  it('una zona apagada no cuenta como cobertura', () => {
    const [first] = summarizeCoverageRequests([row('11000', 1)], zones)
    expect(first.status).toBe('sin_cobertura')
    expect(first.zoneName).toBe('')
  })

  it('se vuelve urgente cuando muchos preguntan por el mismo', () => {
    const [justUnder] = summarizeCoverageRequests([row('55555', COVERAGE_URGENT_REQUESTS - 1)], zones)
    const [atThreshold] = summarizeCoverageRequests([row('55555', COVERAGE_URGENT_REQUESTS)], zones)
    expect(justUnder.status).toBe('sin_cobertura')
    expect(atThreshold.status).toBe('urgente')
  })

  it('un CP muy pedido pero ya cubierto no es urgente: no hay nada que abrir', () => {
    const [first] = summarizeCoverageRequests([row('06700', COVERAGE_URGENT_REQUESTS * 10)], zones)
    expect(first.status).toBe('cubierto')
  })

  it('primero lo urgente, luego lo descubierto, y al final lo resuelto', () => {
    const summary = summarizeCoverageRequests([
      row('06700', 9),
      row('44444', 1),
      row('55555', COVERAGE_URGENT_REQUESTS + 2),
    ], zones)
    expect(summary.map((item) => item.postalCode)).toEqual(['55555', '44444', '06700'])
  })

  it('dentro del mismo estado, manda lo más pedido', () => {
    const summary = summarizeCoverageRequests([row('11111', 1), row('22222', 3)], [])
    expect(summary.map((item) => item.postalCode)).toEqual(['22222', '11111'])
  })

  it('compara los CP de la zona ya normalizados', () => {
    const [first] = summarizeCoverageRequests([row('06700', 1)], [{ name: 'Centro', active: true, postalCodes: [' 06700 '] }])
    expect(first.status).toBe('cubierto')
  })
})

describe('pendingCoverageCount', () => {
  it('suma sólo las preguntas que siguen sin respuesta', () => {
    const summary = summarizeCoverageRequests(
      [row('06700', 10), row('44444', 2), row('55555', 3)],
      [{ name: 'Centro', active: true, postalCodes: ['06700'] }],
    )
    expect(pendingCoverageCount(summary)).toBe(5)
  })
})

import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(path, 'utf8')

/**
 * El contador de demanda por colonia. Lo que se rompe callado: que el navegador
 * pueda escribirlo (cualquiera infla el número y "urgente" deja de significar
 * algo), o que empiece a guardarse quién preguntó.
 */
describe('registro de la consulta', () => {
  test('sólo el servidor escribe la colección', () => {
    const rules = read('firestore.rules')
    const block = rules.slice(rules.indexOf('match /coverageRequests/{postalCode}'))
    expect(block.slice(0, 200)).toContain('allow write: if false;')
    expect(block.slice(0, 200)).toContain('allow get: if isStaff();')
  })

  test('la página pública lo manda por la ruta del servidor, no a Firestore', () => {
    const section = read('src/components/CoverageSection.tsx')
    expect(section).toContain("'/api/coverage/request'")
    expect(section).not.toContain("addDoc(collection(db, 'coverageRequests')")
  })

  test('se guarda el código postal y nada de quién preguntó', () => {
    const route = read('src/app/api/coverage/request/route.ts')
    const written = route.slice(route.indexOf(".doc(postalCode).set("), route.indexOf('{ merge: true }'))
    expect(written).toContain('postalCode')
    expect(written).toContain('count:')
    expect(written).toContain('lastRequestedAt')
    for (const forbidden of ['clientIp', 'email', 'name', 'phone', 'uid']) {
      expect(written).not.toContain(forbidden)
    }
  })

  test('la ruta limita las peticiones y falla cerrada', () => {
    const route = read('src/app/api/coverage/request/route.ts')
    expect(route).toContain('checkRateLimit(')
    expect(route).toContain("code: 'privileged-identity-not-configured'")
  })

  test('no se registra una consulta por cada tecla', () => {
    const section = read('src/components/CoverageSection.tsx')
    expect(section).toContain('reported.current.has(typed)')
    expect(section).toContain('setTimeout')
  })

  test('el panel vive donde se actúa: en Zonas', () => {
    expect(read('src/app/admin/zonas/page.tsx')).toContain('<CoverageRequestsPanel zones={zones} />')
  })
})

/**
 * El recorrido se traza solo. Quien despacha no debería copiar coordenadas a
 * Google Maps para saber por dónde anduvo un paseo.
 */
describe('rutas', () => {
  const page = read('src/app/admin/rutas/page.tsx')

  test('el mapa se dibuja dentro del paseo, no en otra parte de la pantalla', () => {
    expect(page).toContain('{selected?.sessionId === row.id && <div className="mt-3">{routeMap}</div>}')
  })

  test('ya no manda a Google Maps', () => {
    expect(page).not.toContain('mapsUrlForPoint')
    expect(page).not.toContain('Abrir en mapas')
  })

  test('el botón alterna en vez de dejar el mapa pegado', () => {
    expect(page).toContain("'Ocultar recorrido'")
  })

  test('un paseo sin lecturas explica por qué, en vez de dejar el mapa vacío', () => {
    expect(page).toContain('el paseo duró menos de lo que tarda la primera')
  })
})

/** El paseador anota lo del paseo sin salir de la tarjeta. */
describe('bitácora rápida', () => {
  const quick = read('src/components/walker/WalkQuickLog.tsx')

  test('están los botones de lo que pasa en un paseo', () => {
    for (const event of ['pipi', 'popo', 'agua', 'juego', 'descanso']) {
      expect(quick).toContain(`event: '${event}'`)
    }
  })

  test('el incidente no es un botón: necesita que alguien escriba qué pasó', () => {
    expect(quick).toContain("Exclude<WalkLogEvent, 'incidente'>")
  })

  test('escribe en el mismo borrador que la bitácora', () => {
    expect(quick).toContain('walkReportContentOf(report)')
    expect(quick).toContain("mode: 'draft'")
  })

  test('vive en la tarjeta del paseo en curso', () => {
    const card = read('src/components/walker/WalkerSessionCard.tsx')
    expect(card).toContain('<WalkQuickLog sessionId={session.id} />')
    expect(card).toContain("status === 'in_progress' && !compact")
  })
})
