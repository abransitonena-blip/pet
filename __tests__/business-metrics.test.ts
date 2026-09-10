import { readFileSync } from 'node:fs'
import {
  growthPercent,
  offeredPlansWithoutPrice,
  sessionValueCents,
  totalValue,
  type ValuedSession,
} from '@/lib/businessMetrics'
import { createEmptyServicePrices, type PublicServicePrice } from '@/lib/servicePricing'
import { getReservationServiceDefinitions } from '@/lib/walkServices'

const read = (path: string) => readFileSync(path, 'utf8')

function prices(overrides: Record<string, Partial<PublicServicePrice>> = {}) {
  const services = createEmptyServicePrices(getReservationServiceDefinitions())
  for (const [id, override] of Object.entries(overrides)) services[id] = { ...services[id], ...override }
  return services
}

/**
 * Finanzas, Analítica and Insights read zero because they summed a legacy
 * collection. The rewrite values real sessions -- and must not invent money
 * while doing it.
 */
describe('valor de los paseos', () => {
  const published = prices({ 'paseo-individual': { amountCents: 18_000, active: true, version: 3 } })

  test('un paseo vale la tarifa publicada si se reservó con esa misma versión', () => {
    expect(sessionValueCents({ serviceId: 'paseo-individual', serviceVersion: 3 }, published)).toBe(18_000)
  })

  test('uno reservado con otra versión no se re-cotiza al precio de hoy', () => {
    expect(sessionValueCents({ serviceId: 'paseo-individual', serviceVersion: 2 }, published)).toBeNull()
    expect(sessionValueCents({ serviceId: 'paseo-individual', serviceVersion: null }, published)).toBeNull()
  })

  test('sin tarifa, o con un plan desconocido, no hay valor', () => {
    expect(sessionValueCents({ serviceId: 'paseo-extendido', serviceVersion: 1 }, published)).toBeNull()
    expect(sessionValueCents({ serviceId: 'plan-que-no-existe', serviceVersion: 1 }, published)).toBeNull()
  })

  test('los paseos sin valor verificable se cuentan aparte, no como cero', () => {
    const sessions = [{ valueCents: 18_000 }, { valueCents: null }, { valueCents: 18_000 }] as ValuedSession[]
    expect(totalValue(sessions)).toEqual({ cents: 36_000, counted: 2, unknown: 1 })
  })

  test('solo avisa de los planes que se ofrecen', () => {
    // The five hidden plans have no price either; warning about them was
    // noise that made every screen look broken.
    expect(offeredPlansWithoutPrice(published)).toEqual(['Paseo Extendido'])
  })

  test('pasar de 0 a algo no es "+100%": no hay periodo anterior con qué comparar', () => {
    expect(growthPercent(5, 0)).toBeNull()
    expect(growthPercent(0, 0)).toBe(0)
    expect(growthPercent(15, 10)).toBe(50)
  })

  test('ninguna de las tres pantallas vuelve a leer la colección legacy', () => {
    for (const page of ['src/app/admin/finanzas/page.tsx', 'src/app/admin/analitica/page.tsx', 'src/app/admin/ia/page.tsx']) {
      const source = read(page)
      expect(source).not.toContain('useReservations')
      expect(source).toContain('useCanonicalReservations')
    }
  })
})
