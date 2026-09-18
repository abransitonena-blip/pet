import { readFileSync } from 'node:fs'
import {
  ZONE_SPOT_KINDS,
  ZONE_SPOT_LABELS,
  duplicatedPostalCodes,
  isUsableSpot,
  normalizePostalCode,
  parsePostalCodes,
  zoneForPostalCode,
} from '@/lib/zoneMatching'

const read = (path: string) => readFileSync(path, 'utf8')

const zone = (id: string, postalCodes: string[], active = true) => ({ id, name: id, active, postalCodes })

describe('zonas por código postal', () => {
  test('solo acepta códigos postales mexicanos de cinco dígitos', () => {
    expect(normalizePostalCode('06700')).toBe('06700')
    expect(normalizePostalCode(' 06700 ')).toBe('06700')
    expect(normalizePostalCode('6700')).toBe('')
    expect(normalizePostalCode('067001')).toBe('')
    expect(normalizePostalCode('CP 06700')).toBe('06700')
  })

  test('la lista se escribe libre y se limpia sola, sin repetidos', () => {
    expect(parsePostalCodes('06700, 06600 06140; 06700')).toEqual(['06700', '06600', '06140'])
    expect(parsePostalCodes('')).toEqual([])
    expect(parsePostalCodes('no es un código')).toEqual([])
  })

  test('el CP encuentra su zona activa, y una zona apagada no cuenta', () => {
    const zones = [zone('roma', ['06700', '06140']), zone('condesa', ['06140'], false)]
    expect(zoneForPostalCode(zones, '06700')?.id).toBe('roma')
    expect(zoneForPostalCode(zones, '06140')?.id).toBe('roma')
    expect(zoneForPostalCode([zone('condesa', ['06140'], false)], '06140')).toBeNull()
    expect(zoneForPostalCode(zones, '99999')).toBeNull()
    expect(zoneForPostalCode(zones, 'nada')).toBeNull()
  })

  test('avisa cuando dos zonas activas se pelean el mismo código', () => {
    expect(duplicatedPostalCodes([zone('roma', ['06700']), zone('condesa', ['06700', '06140'])])).toEqual(['06700'])
    expect(duplicatedPostalCodes([zone('roma', ['06700']), zone('condesa', ['06140'])])).toEqual([])
    // Una zona apagada no genera conflicto.
    expect(duplicatedPostalCodes([zone('roma', ['06700']), zone('vieja', ['06700'], false)])).toEqual([])
  })

  test('un lugar necesita coordenadas de verdad', () => {
    expect(isUsableSpot({ lat: 19.41, lng: -99.17 })).toBe(true)
    expect(isUsableSpot({ lat: 0, lng: 0 })).toBe(false)
    expect(isUsableSpot({ lat: Number.NaN, lng: -99.17 })).toBe(false)
  })

  test('los tres tipos de lugar tienen nombre en español', () => {
    expect(ZONE_SPOT_KINDS).toEqual(['parque', 'recomendado', 'evitar'])
    for (const kind of ZONE_SPOT_KINDS) expect(ZONE_SPOT_LABELS[kind].length).toBeGreaterThan(3)
  })

  test('el panel de zonas guarda los CP y los lugares, y explica el límite del aviso', () => {
    // El formulario salió del panel a su propio componente, que se carga al
    // crear o editar; el panel conserva el aviso de CP repetidos.
    const page = read('src/app/admin/zonas/AdminZonasPanel.tsx')
    const form = read('src/components/admin/ZoneFormModal.tsx')
    expect(form).toContain('postalCodes: parsePostalCodes(form.postalCodes)')
    expect(form).toContain('spots: form.spots')
    expect(page).toContain('duplicatedPostalCodes(zones)')
    expect(form).toContain('sigue usando el círculo')
  })
})
