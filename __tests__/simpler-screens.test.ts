import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(path, 'utf8')

/**
 * Tres pantallas que el dueño pidió más simples. Lo que se rompe con el tiempo
 * es el regreso: un apartado nuevo sin explicación, un paso que vuelve a
 * preguntar lo que ya se sabe, o el expediente del perro otra vez todo abierto.
 */
describe('configuración', () => {
  const source = read('src/components/AdminConfig.tsx')

  test('cada apartado dice qué se cambia adentro', () => {
    const rows = source.split('\n').filter((line) => /^\s{2}\{ id: '/.test(line))
    expect(rows.length).toBeGreaterThanOrEqual(13)
    for (const row of rows) {
      expect(row).toContain('group:')
      const description = /description: '([^']+)'/.exec(row)?.[1] ?? ''
      expect(description.length).toBeGreaterThan(20)
    }
  })

  test('va en grupos, y ninguno queda fuera de los que existen', () => {
    const groups = Array.from(source.matchAll(/group: '([^']+)'/g)).map((match) => match[1])
    const declared = /const SECTION_GROUPS = \[([^\]]+)\]/.exec(source)?.[1] ?? ''
    expect(groups.length).toBeGreaterThan(0)
    for (const group of Array.from(new Set(groups))) expect(declared).toContain(`'${group}'`)
  })

  test('abre cerrada: el primer pantallazo es el mapa completo', () => {
    expect(source).toContain('useState<Section | null>(null)')
  })

  test('lo legal sigue avisando que necesita abogado', () => {
    expect(source).toContain('Requiere validación de abogado en México.')
  })
})

describe('reservar', () => {
  const flow = read('src/components/reservation-steps-v2/ReservationFlow.tsx')

  test('con un solo perro y una sola dirección, se eligen solos', () => {
    expect(flow).toContain('soleChoice(userPets)')
    expect(flow).toContain('soleChoice(userAddresses)')
  })

  test('una dirección sin zona disponible no se elige sola: el problema tiene que verse', () => {
    expect(flow).toContain('onlyAddress.zoneActive')
  })

  test('el paso ya resuelto se salta hacia adelante, nunca hacia atrás', () => {
    expect(flow).toContain('nextStepIndex(prev, issues')
    expect(flow).toContain('setStep(prev => Math.max(prev - 1, 0))')
  })
})

describe('perfil del perro', () => {
  const page = read('src/app/familia/perros/[id]/FamiliaPerrosIdPanel.tsx')

  test('lo urgente va arriba y sale del mismo cálculo que usa el panel', () => {
    expect(page).toContain('dogAlerts(')
    expect(page).toContain('mexicoCityToday()')
  })

  test('el expediente que se consulta empieza cerrado', () => {
    expect(page).toContain('function Foldable(')
    for (const title of ['Personalidad', 'Preferencias', 'Salud', 'Placa de emergencia']) {
      expect(page).toContain(`<Foldable title="${title}"`)
    }
  })

  test('las alergias no se dicen dos veces', () => {
    // La única mención que queda es el comentario que explica por qué.
    expect(page).not.toContain("Alergias: {dog.allergies.join(', ')}")
    expect(page).toContain('Alergias y medicamento ya están arriba')
  })
})
