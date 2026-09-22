import { PATH_NOISE_METERS, formatWalkDistance, googleMapsRouteUrl, pathDistanceMeters, summarizeWalkPath } from '@/lib/walkPath'

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
    expect(summary.label).toContain('1 fuera del área')
  })

  it('no menciona salidas cuando el paseo se mantuvo dentro', () => {
    expect(summarizeWalkPath([A, B]).label).not.toContain('fuera del área')
  })
})

describe('googleMapsRouteUrl', () => {
  it('sin lecturas no hay enlace', () => {
    expect(googleMapsRouteUrl([])).toBeNull()
  })

  it('con una sola lectura busca el punto', () => {
    expect(googleMapsRouteUrl([A])).toBe(`https://www.google.com/maps/search/?api=1&query=${A.lat},${A.lng}`)
  })

  it('con dos o más pide una ruta a pie de origen a destino', () => {
    const url = googleMapsRouteUrl([A, B, C])
    expect(url).toContain('https://www.google.com/maps/dir/?')
    expect(url).toContain(`origin=${A.lat}%2C${A.lng}`)
    expect(url).toContain(`destination=${C.lat}%2C${C.lng}`)
    expect(url).toContain('travelmode=walking')
    expect(url).toContain(`waypoints=${B.lat}%2C${B.lng}`)
  })

  it('sin lecturas intermedias no manda waypoints vacíos', () => {
    const url = googleMapsRouteUrl([A, C])
    expect(url).not.toContain('waypoints')
  })

  it('un recorrido largo se muestrea, nunca manda más de 23 paradas intermedias', () => {
    const long = Array.from({ length: 400 }, (_, index) => ({ lat: A.lat + index * 0.0001, lng: A.lng }))
    const url = googleMapsRouteUrl(long)
    const waypointsParam = new URL(url as string).searchParams.get('waypoints') ?? ''
    const stops = waypointsParam.split('|').filter(Boolean)
    expect(stops.length).toBeLessThanOrEqual(23)
    expect(stops.length).toBeGreaterThan(0)
  })
})
