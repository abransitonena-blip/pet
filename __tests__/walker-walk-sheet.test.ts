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

  test('nunca devuelve la dirección de la familia ni sus datos de contacto', () => {
    // Lee la dirección solo para saber la zona; lo que responde no la incluye.
    for (const field of ['street', 'colony', 'zip', 'exterior', 'customerPhone', 'customerName']) {
      expect(route).not.toContain(field)
    }
    expect(route).toContain('const zone = zoneData')
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
    const dashboard = read('src/app/walker/page.tsx')
    expect(dashboard).toContain('últimos 7 días')
    expect(dashboard).toContain('const weekStart =')
    expect(dashboard).toContain('Tu horario registrado')
  })
})
