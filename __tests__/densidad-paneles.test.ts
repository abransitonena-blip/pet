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
