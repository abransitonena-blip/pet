import { BREED_GROUP_STYLES, DOG_BREED_SUGGESTIONS, breedGroup, normalizeBreed } from '@/lib/dogBreeds'

/**
 * El color de un perro sin foto sale de la familia de su raza. Lo que lo
 * volvería inútil: que "Husky Siberiano" y "husky siberiano" cayeran en grupos
 * distintos, o que "Bulldog Francés" se resolviera como "Bulldog" a secas.
 */
describe('normalizeBreed', () => {
  it('ignora acentos, mayúsculas y espacios', () => {
    expect(normalizeBreed('  Pastor Alemán ')).toBe('pastor aleman')
    expect(normalizeBreed('MALTÉS')).toBe('maltes')
  })
})

describe('breedGroup', () => {
  it('reconoce razas de cada familia', () => {
    expect(breedGroup('Husky Siberiano')).toBe('nordico')
    expect(breedGroup('Chihuahua')).toBe('toy')
    expect(breedGroup('Pastor Alemán')).toBe('pastor')
    expect(breedGroup('Labrador Retriever')).toBe('retriever')
    expect(breedGroup('Rottweiler')).toBe('trabajo')
    expect(breedGroup('Beagle')).toBe('sabueso')
    expect(breedGroup('Pug')).toBe('braquicefalo')
    expect(breedGroup('Xoloitzcuintle')).toBe('sinpelo')
    expect(breedGroup('Mestizo')).toBe('mestizo')
  })

  it('no depende de cómo se escriba', () => {
    expect(breedGroup('husky siberiano')).toBe(breedGroup('Husky Siberiano'))
    expect(breedGroup('PASTOR ALEMAN')).toBe('pastor')
  })

  it('encuentra la raza dentro de un texto más largo, como la escribe la gente', () => {
    expect(breedGroup('Husky siberiano de ojos azules')).toBe('nordico')
    expect(breedGroup('Mi golden retriever de 3 años')).toBe('retriever')
  })

  it('la coincidencia más larga gana: un bulldog francés no es sólo un bulldog', () => {
    expect(breedGroup('Bulldog Francés')).toBe('braquicefalo')
    expect(breedGroup('Schnauzer Miniatura')).toBe('terrier')
  })

  it('una raza que no conocemos no se fuerza a un grupo', () => {
    expect(breedGroup('Perro de las praderas')).toBeNull()
    expect(breedGroup('')).toBeNull()
    expect(breedGroup('   ')).toBeNull()
  })
})

describe('el catálogo', () => {
  it('tiene bastantes razas y ninguna repetida', () => {
    expect(DOG_BREED_SUGGESTIONS.length).toBeGreaterThanOrEqual(50)
    expect(new Set(DOG_BREED_SUGGESTIONS).size).toBe(DOG_BREED_SUGGESTIONS.length)
  })

  it('cada sugerencia se puede resolver a un grupo', () => {
    // Antes fallaba: las claves con acento ("bernés de la montaña") nunca
    // coincidían, porque lo buscado llega sin acentos y la clave los tenía.
    for (const breed of DOG_BREED_SUGGESTIONS) {
      expect(breedGroup(breed)).not.toBeNull()
    }
  })

  it('cada grupo tiene su color y su nombre', () => {
    for (const style of Object.values(BREED_GROUP_STYLES)) {
      expect(style.label.length).toBeGreaterThan(0)
      expect(style.background).toMatch(/^#[0-9A-F]{6}$/i)
      expect(style.ink).toMatch(/^#[0-9A-F]{6}$/i)
    }
  })

  it('dos grupos no comparten color: si no, no distinguirían nada', () => {
    const backgrounds = Object.values(BREED_GROUP_STYLES).map((style) => style.background)
    expect(new Set(backgrounds).size).toBe(backgrounds.length)
  })
})
