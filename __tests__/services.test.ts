import { SERVICE_CATEGORIES, getCategories, getCategory, normalizeServiceName } from '../src/lib/services'

describe('SERVICE_CATEGORIES', () => {
  it('has 4 categories', () => {
    expect(SERVICE_CATEGORIES).toHaveLength(4)
  })

  it('includes cotidiano', () => {
    const c = SERVICE_CATEGORIES.find((cat) => cat.id === 'cotidiano')
    expect(c).toBeDefined()
    expect(c?.name).toBe('Paseo cotidiano')
    expect(c?.duration).toBe('30 min')
  })

  it('includes energia', () => {
    const c = SERVICE_CATEGORIES.find((cat) => cat.id === 'energia')
    expect(c).toBeDefined()
    expect(c?.duration).toBe('1 hora')
  })

  it('includes acompanamiento', () => {
    const c = SERVICE_CATEGORIES.find((cat) => cat.id === 'acompanamiento')
    expect(c).toBeDefined()
    expect(c?.duration).toBe('45 min')
  })

  it('includes rutina', () => {
    const c = SERVICE_CATEGORIES.find((cat) => cat.id === 'rutina')
    expect(c).toBeDefined()
    expect(c?.modality).toBe('Lun a Sáb')
  })

  it('each category has required fields', () => {
    for (const cat of SERVICE_CATEGORIES) {
      expect(cat.id).toBeTruthy()
      expect(cat.name).toBeTruthy()
      expect(cat.description).toBeTruthy()
      expect(cat.duration).toBeTruthy()
      expect(cat.modality).toBeTruthy()
      expect(Array.isArray(cat.benefits)).toBe(true)
      expect(cat.benefits.length).toBeGreaterThan(0)
      expect(Array.isArray(cat.restrictions)).toBe(true)
    }
  })
})

describe('getCategories', () => {
  it('returns all categories', () => {
    expect(getCategories()).toEqual(SERVICE_CATEGORIES)
  })
})

describe('getCategory', () => {
  it('finds a category by id', () => {
    const cat = getCategory('cotidiano')
    expect(cat).toBeDefined()
    expect(cat?.name).toBe('Paseo cotidiano')
  })

  it('returns undefined for unknown id', () => {
    expect(getCategory('unknown')).toBeUndefined()
  })
})

describe('normalizeServiceName', () => {
  it('normalizes legacy names', () => {
    expect(normalizeServiceName('Paseo Individual (30 min)')).toBe('Paseo Individual')
    expect(normalizeServiceName('Paseo Express (20 min)')).toBe('Paseo Esencial')
    expect(normalizeServiceName('Paseo Express')).toBe('Paseo Esencial')
    expect(normalizeServiceName('Paquete Semanal (6 paseos)')).toBe('Paquete Semanal')
  })

  it('passes through unknown names', () => {
    expect(normalizeServiceName('Some Random Name')).toBe('Some Random Name')
  })
})
