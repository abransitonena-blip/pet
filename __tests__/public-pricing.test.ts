import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(path, 'utf8')

/**
 * Los precios en la página pública. Lo que no puede pasar: que la página
 * prometa una cifra distinta de la que cobra el flujo de reserva, o que
 * invente una cuando nadie la configuró.
 */
describe('precios en la página pública', () => {
  const section = read('src/components/PricingSection.tsx')

  test('salen de la misma fuente que usa el flujo de reserva', () => {
    expect(section).toContain('getReservationServiceOptions')
    expect(section).toContain('usePrices()')
    expect(read('src/components/reservation-steps-v2/ReservationFlow.tsx')).toContain('getReservationServiceOptions')
  })

  test('un servicio sin precio configurado no aparece', () => {
    expect(section).toContain('option.amountCents !== null')
    expect(section).toContain('option.isRequestable')
  })

  test('sin precios configurados, la sección desaparece entera', () => {
    expect(section).toContain("if (status !== 'ready' || options.length === 0) return null")
  })

  test('usa el formateador que ya existía, no uno nuevo', () => {
    expect(section).toContain('formatAmountCents(option.amountCents, option.complimentary)')
  })

  test('el botón lleva a reservar con ese servicio ya elegido', () => {
    expect(section).toContain('/familia/nueva-reserva?repeat=')
    // El flujo entiende ese parámetro.
    expect(read('src/components/reservation-steps-v2/ReservationFlow.tsx')).toContain("searchParams.get('repeat')")
  })

  test('está en la página y en el menú', () => {
    expect(read('src/app/HomeClient.tsx')).toContain('<PricingSection />')
    expect(read('src/components/Header.tsx')).toContain("href: '/#precios'")
    expect(section).toContain('id="precios"')
  })
})

describe('demanda por colonia', () => {
  test('el panel dice cuántas preguntas siguen sin respuesta', () => {
    const panel = read('src/components/admin/CoverageRequestsPanel.tsx')
    expect(panel).toContain('pendingCoverageCount(summary)')
    expect(panel).toContain('todavía no cubrimos')
  })
})
