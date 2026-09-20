import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(path, 'utf8')

describe('ficha del paseo para el paseador', () => {
  const route = read('src/app/api/walker/walk-sheet/route.ts')

  test('solo responde al paseador asignado y con el paseo activo', () => {
    expect(route).toContain('verifyWalkerToken(idToken)')
    expect(route).toContain("session.walkerId !== walkerUid")
    expect(route).toContain('VISIBLE_STATUSES.has(String(session.status ?? \'\'))')
    expect(route).toContain('checkRateLimit(')
  })

  test('devuelve a dónde llegar, y nada de contacto de la familia', () => {
    // El paseador tiene que llegar a una puerta: calle, número, colonia,
    // referencias y cómo entrar viajan. El dueño lo pidió así.
    for (const field of ['street', 'colony', 'zip', 'exterior', 'references', 'instructions']) {
      expect(route).toContain(field)
    }
    // Lo que sigue sin viajar: cómo contactar a la familia por fuera de la app.
    for (const field of ['customerPhone', 'customerName', 'email']) {
      expect(route).not.toContain(field)
    }
    expect(route).toContain('const zone = zoneData')
  })

  test('la dirección deja de viajar en cuanto el paseo se completa', () => {
    expect(route).toContain("String(session.status) !== 'completed'")
    expect(route).toContain('? pickupFrom(address)')
  })

  test('el paseador puede abrirla en el mapa', () => {
    const sheet = read('src/components/walker/WalkSheet.tsx')
    expect(sheet).toContain('Dónde recoger')
    expect(sheet).toContain('https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(data.pickup.query)}')
    expect(sheet).toContain('Abrir en Google Maps')
  })

  test('la ficha muestra alergias, medicamento y cuidados, y avisa si no está disponible', () => {
    const sheet = read('src/components/walker/WalkSheet.tsx')
    expect(sheet).toContain("'/api/walker/walk-sheet'")
    expect(sheet).toContain('Alergias:')
    expect(sheet).toContain('Medicamento:')
    expect(sheet).toContain('Cuidados especiales:')
    expect(sheet).toContain("result.code === 'privileged-identity-not-configured'")
  })

  test('el paseo en curso ofrece la ficha y reportar una incidencia', () => {
    const card = read('src/components/walker/WalkerSessionCard.tsx')
    expect(card).toContain('Ver la ficha del paseo')
    expect(card).toContain('Reportar incidencia')
    expect(card).toContain('#incidencia')
    // Y la bitácora tiene ese ancla de verdad.
    expect(read('src/components/walker/WalkReportEditor.tsx')).toContain("key === 'incidentsSummary' ? 'incidencia' : undefined")
  })

  test('el panel del paseador muestra su carga de la semana y su horario', () => {
    const dashboard = read('src/app/walker/WalkerDashboard.tsx')
    expect(dashboard).toContain('últimos 7 días')
    expect(dashboard).toContain('const weekStart =')
    expect(dashboard).toContain('Tu horario registrado')
  })
})
