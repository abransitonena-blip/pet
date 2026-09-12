import { PATH_NOISE_METERS, formatWalkDistance, pathDistanceMeters, summarizeWalkPath } from '@/lib/walkPath'

// Un grado de latitud son ~111 km, así que 0.001 son ~111 m: suficiente para
// comprobar que se suman tramos y no se inventan.
const A = { lat: 19.4326, lng: -99.1332 }
const B = { lat: 19.4336, lng: -99.1332 }
const C = { lat: 19.4346, lng: -99.1332 }

describe('pathDistanceMeters', () => {
  it('es cero cuando no hay con qué medir', () => {
    expect(pathDistanceMeters([])).toBe(0)
    expect(pathDistanceMeters([A])).toBe(0)
  })

  it('suma los tramos entre lecturas consecutivas', () => {
    const oneLeg = pathDistanceMeters([A, B])
    const twoLegs = pathDistanceMeters([A, B, C])
    expect(oneLeg).toBeGreaterThan(100)
    expect(oneLeg).toBeLessThan(120)
    expect(twoLegs).toBeCloseTo(oneLeg * 2, 0)
  })

  it('ignora el temblor del GPS en un teléfono quieto', () => {
    const jitter = Array.from({ length: 20 }, (_, index) => ({ lat: A.lat + index * 0.000002, lng: A.lng }))
    expect(pathDistanceMeters(jitter)).toBe(0)
    expect(PATH_NOISE_METERS).toBeGreaterThan(0)
  })
})

describe('formatWalkDistance', () => {
  it('usa metros abajo de un kilómetro y kilómetros arriba', () => {
    expect(formatWalkDistance(0)).toBe('0 m')
    expect(formatWalkDistance(850)).toBe('850 m')
    expect(formatWalkDistance(1000)).toBe('1.0 km')
    expect(formatWalkDistance(2540)).toBe('2.5 km')
  })
})

describe('summarizeWalkPath', () => {
  it('con una sola lectura no habla de recorrido', () => {
    const summary = summarizeWalkPath([A])
    expect(summary.label).toBe('1 lectura')
    expect(summary.distanceMeters).toBe(0)
  })

  it('cuenta lecturas, distancia y salidas de zona', () => {
    const summary = summarizeWalkPath([A, B, { ...C, outside: true }])
    expect(summary.readings).toBe(3)
    expect(summary.outsideCount).toBe(1)
    expect(summary.label).toContain('3 lecturas')
    expect(summary.label).toContain('recorrido aproximado')
    expect(summary.label).toContain('1 fuera de zona')
  })

  it('no menciona salidas cuando el paseo se mantuvo dentro', () => {
    expect(summarizeWalkPath([A, B]).label).not.toContain('fuera de zona')
  })
})
