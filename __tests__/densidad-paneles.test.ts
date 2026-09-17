import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(path, 'utf8')

/**
 * La fase 14 sigue el mismo criterio que la 9: cada pantalla abre con lo que se
 * necesita para actuar, y lo demás queda a un toque. Estas pruebas vigilan lo
 * que es verificable desde el código: qué se carga de entrada y qué se muestra
 * por elemento de una lista.
 */
describe('Mis perros', () => {
  const page = read('src/app/familia/perros/page.tsx')
  const modal = read('src/components/family/DogFormModal.tsx')

  it('la lista no carga el formulario: se pide al agregar o editar', () => {
    expect(page).toContain("dynamic(() => import('@/components/family/DogFormModal')")
    expect(page).not.toContain('EMPTY_FORM')
    expect(page).not.toContain('VACCINE_PRESETS')
    expect(page).not.toContain('TEMPERAMENT_TAGS')
  })

  it('cada perro muestra quién es y lo que cambia un paseo, no su expediente', () => {
    expect(page).toContain('Alergias:')
    for (const detail of ['temperament', 'pet.weight', 'pet.notes', 'favoriteToys']) {
      expect({ detail, inList: page.includes(detail) }).toEqual({ detail, inList: false })
    }
    expect(page).toContain('Ver su perfil y sus paseos')
  })

  it('el sexo se lee como palabra, no sólo como símbolo', () => {
    expect(page).not.toContain('♂️')
    expect(page).toContain("pet.sex === 'macho' ? 'Macho'")
  })

  it('el formulario conserva sus cuatro pestañas y su guardado', () => {
    expect(modal).toContain("useState<PetTab>('basico')")
    expect(modal).toContain('handleSave')
    expect(modal).toContain("collection(db, 'dogs')")
  })
})

describe('Mis direcciones', () => {
  const page = read('src/app/familia/direcciones/page.tsx')
  const modal = read('src/components/family/AddressFormModal.tsx')

  it('mirar lo guardado no carga el formulario ni escucha las zonas', () => {
    expect(page).toContain("dynamic(() => import('@/components/family/AddressFormModal')")
    expect(page).not.toContain("collection(db, 'zones')")
    expect(page).not.toContain('usePostalCodeLookup')
    expect(modal).toContain("collection(db, 'zones')")
    expect(modal).toContain('usePostalCodeLookup(form.zip)')
  })

  it('la nueva dirección sigue quedando como predeterminada cuando es la primera', () => {
    expect(page).toContain('isFirst={addresses.length === 0}')
    expect(modal).toContain('isDefault: isFirst,')
  })
})

describe('Zonas', () => {
  const page = read('src/app/admin/zonas/page.tsx')

  it('mirar la cobertura no carga el formulario ni su segundo mapa', () => {
    expect(page).toContain("dynamic(() => import('@/components/admin/ZoneFormModal')")
    expect(page).not.toContain('EMPTY_FORM')
    expect(page).not.toContain('ZONE_SPOT_KINDS')
  })

  it('el panel conserva su mapa, su buscador y el aviso de códigos repetidos', () => {
    expect(page).toContain('<ZoneMap label="Mapa de todas las zonas"')
    expect(page).toContain('duplicatedPostalCodes(zones)')
    expect(page).toContain('<CoverageRequestsPanel zones={zones} />')
  })
})

describe('la fecha de hoy se calcula en la zona del negocio, no en UTC', () => {
  it('ninguna pantalla ni ruta viva toma "hoy" de toISOString()', () => {
    // En México, a partir de las 18:00, la fecha UTC ya es la de mañana: así
    // el Resumen contaba los paseos del día equivocado.
    const files = [
      'src/app/admin/page.tsx',
      'src/app/walker/page.tsx',
      'src/app/familia/page.tsx',
      'src/components/EditReservationModal.tsx',
      'src/app/api/walker/walk-sheet/route.ts',
    ]
    for (const file of files) {
      const source = read(file)
      const usesUtcDate = /new Date\(\)\.toISOString\(\)\.(split|slice)/.test(source)
      expect({ file, usesUtcDate }).toEqual({ file, usesUtcDate: false })
    }
    expect(read('src/app/api/walker/walk-sheet/route.ts')).toContain('dateInTimezone(Date.now())')
  })
})
