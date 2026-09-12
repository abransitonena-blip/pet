import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(path, 'utf8')

/**
 * El recorrido se mira, no se lee en coordenadas, y una foto del paseo cabe en
 * un toque. Dos cosas que se rompen sin avisar: una pantalla vuelve a imprimir
 * lat/lng porque era más fácil, o el permiso del recorrido se relaja para que
 * el navegador lo lea directo.
 */
describe('el recorrido se muestra como ruta', () => {
  test('el mapa dibuja la línea punteada, con inicio y fin marcados', () => {
    const map = read('src/components/map/ZoneMap.tsx')
    expect(map).toContain('L.polyline')
    // Punteada a propósito: entre lecturas nadie registró el camino.
    expect(map).toMatch(/dashArray: '8 6'/)
    expect(map).toContain("'Inicio'")
    expect(map).toContain("'Fin'")
  })

  test('ninguna pantalla imprime coordenadas', () => {
    for (const path of [
      'src/app/admin/rutas/page.tsx',
      'src/app/familia/reportes/[sessionId]/page.tsx',
      'src/components/walker/WalkerSessionCard.tsx',
    ]) {
      expect(read(path)).not.toContain('formatWalkPoint')
    }
  })

  test('admin y familia dibujan el recorrido con el mismo mapa', () => {
    expect(read('src/app/admin/rutas/page.tsx')).toContain('path={routePath}')
    expect(read('src/components/family/WalkRouteMap.tsx')).toContain('path={route.path}')
  })

  test('los puntos del recorrido siguen siendo del equipo en las reglas', () => {
    const rules = read('firestore.rules')
    const points = rules.slice(rules.indexOf('match /points/{pointId}'))
    expect(points.slice(0, 120)).toContain('allow read: if isStaff()')
  })

  test('la familia los recibe por el servidor, y sólo los de su paseo', () => {
    const route = read('src/app/api/family/walk-track/route.ts')
    expect(route).toContain('verifyAuthenticatedToken')
    expect(route).toContain("session.customerId !== uid")
    expect(route).toContain("code: 'session-not-yours'")
    // Sin identidad privilegiada no contesta: falla cerrado.
    expect(route).toContain("code: 'privileged-identity-not-configured'")
  })
})

describe('fotos del paseo en curso', () => {
  test('el botón abre la cámara y guarda en el mismo borrador de la bitácora', () => {
    const button = read('src/components/walker/WalkPhotoButton.tsx')
    expect(button).toContain('capture="environment"')
    expect(button).toContain('uploadWalkPhoto')
    expect(button).toContain("mode: 'draft'")
  })

  test('no aparece cuando el reporte ya se envió ni sin fotos habilitadas', () => {
    const button = read('src/components/walker/WalkPhotoButton.tsx')
    expect(button).toContain("report?.status === 'submitted'")
    expect(button).toContain('PRIVATE_MEDIA_UPLOADS_ENABLED')
  })

  test('vive en la tarjeta del paseo, no sólo en la bitácora', () => {
    expect(read('src/components/walker/WalkerSessionCard.tsx')).toContain('<WalkPhotoButton sessionId={session.id} />')
  })

  test('el borrador vacío es uno solo, compartido por la bitácora y el botón', () => {
    expect(read('src/lib/walkReports.ts')).toContain('export const EMPTY_WALK_REPORT')
    expect(read('src/components/walker/WalkReportEditor.tsx')).toContain('EMPTY_WALK_REPORT')
    expect(read('src/components/walker/WalkPhotoButton.tsx')).toContain('walkReportContentOf')
  })
})

/**
 * La foto del perro es privada: la sube su familia, se guarda como referencia
 * opaca y se ve con enlaces que caducan. Lo que se rompe callado es el permiso
 * -- que el servidor crea al cuerpo de la petición en vez de al documento del
 * perro -- o que la referencia termine siendo un URL público.
 */
describe('foto del perro', () => {
  test('el firmante comprueba el dueño contra el documento del perro', () => {
    const route = read('src/app/api/media/private/signature/route.ts')
    expect(route).toContain("firestore.collection('dogs').doc(dogId).get()")
    expect(route).toContain("ownerId !== callerUid")
    expect(route).toContain("code: 'dog-not-yours'")
  })

  test('la referencia es un id opaco bajo el prefijo privado, no un URL', () => {
    const lib = read('src/lib/dogPhotos.ts')
    expect(lib).toContain('pet-ap-private/dogs')
    expect(lib).toContain('isDogPhotoReference')
    expect(read('src/lib/media/dogPhotoUpload.ts')).toContain('isDogPhotoReference(result.public_id)')
  })

  test('para verla hay que pedir un enlace que caduca', () => {
    const route = read('src/app/api/media/private/dog-photos/route.ts')
    expect(route).toContain('createPrivateDownloadUrl')
    expect(route).toContain('LINK_TTL_SECONDS')
    // Un perro ajeno no viene en la respuesta.
    expect(route).toContain('if (!isStaff && dog.ownerId !== caller.uid) continue')
  })

  test('la lista pide todas las fotos de un jalón', () => {
    expect(read('src/app/familia/perros/page.tsx')).toContain('useDogPhotos(pets.map(')
    expect(read('src/lib/useDogPhotos.ts')).toContain("JSON.stringify({ dogIds })")
  })

  test('la política escrita registra la decisión', () => {
    expect(read('MEDIA_POLICY.md')).toContain('pet-ap-private/dogs/<uuid>')
  })
})
