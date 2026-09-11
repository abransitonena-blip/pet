import { readFileSync } from 'node:fs'
import {
  SEGMENT_ORDER,
  customerActivity,
  daysBetweenDates,
  describeDaysAgo,
  firstNameOf,
  formatShortDate,
  joinNames,
  mexicoCityToday,
  segmentMessage,
  timestampToMexicoCityDate,
} from '@/lib/customerSegments'

const today = '2026-09-10'
const longAgo = '2026-01-01'
const walk = (date: string, status = 'completed') => ({ date, status })

describe('etapa de cada familia', () => {
  test('una cuenta de los últimos 30 días es nueva, aunque ya haya paseado', () => {
    expect(customerActivity([], '2026-08-15', today).segment).toBe('nueva')
    expect(customerActivity([walk('2026-09-01')], '2026-08-20', today).segment).toBe('nueva')
  })

  test('activa: completó un paseo en 30 días o tiene uno agendado', () => {
    expect(customerActivity([walk('2026-08-11')], longAgo, today).segment).toBe('activa')
    expect(customerActivity([walk('2026-05-01'), walk('2026-09-15', 'confirmed')], longAgo, today)).toMatchObject({
      segment: 'activa',
      nextWalkDate: '2026-09-15',
      upcomingCount: 1,
    })
  })

  test('en riesgo de 31 a 60 días sin nada agendado; inactiva después', () => {
    expect(customerActivity([walk('2026-08-10')], longAgo, today).segment).toBe('en_riesgo')
    expect(customerActivity([walk('2026-07-12')], longAgo, today).segment).toBe('en_riesgo')
    expect(customerActivity([walk('2026-07-11')], longAgo, today).segment).toBe('inactiva')
  })

  test('un paseo cancelado, o uno pasado que nunca se completó, no cuenta como último paseo', () => {
    const activity = customerActivity(
      [walk('2026-05-01'), walk('2026-09-05', 'cancelled'), walk('2026-09-01', 'requested')],
      longAgo,
      today,
    )
    expect(activity).toMatchObject({
      segment: 'inactiva',
      lastCompletedDate: '2026-05-01',
      completedCount: 1,
      cancelledCount: 1,
      upcomingCount: 0,
    })
  })

  test('sin paseos: nunca completó uno ni tiene uno agendado', () => {
    expect(customerActivity([], longAgo, today).segment).toBe('sin_paseos')
    // Without a registration date a family cannot be called new.
    expect(customerActivity([walk('2026-09-05', 'cancelled')], '', today).segment).toBe('sin_paseos')
  })

  test('VIP y frecuente van aparte y no esconden que la familia dejó de reservar', () => {
    const march = Array.from({ length: 10 }, (_, index) => walk(`2026-03-${String(index + 1).padStart(2, '0')}`))
    expect(customerActivity(march, '2025-12-01', today)).toMatchObject({ loyalty: 'vip', segment: 'inactiva', completedCount: 10 })
    expect(customerActivity(march.slice(0, 3), '2025-12-01', today).loyalty).toBe('frecuente')
    expect(customerActivity(march.slice(0, 2), '2025-12-01', today).loyalty).toBeNull()
  })

  test('frecuencia promedio entre paseos completados', () => {
    expect(customerActivity([walk('2026-09-01'), walk('2026-09-08'), walk('2026-08-25')], longAgo, today).avgFrequencyDays).toBe(7)
    expect(customerActivity([walk('2026-09-01')], longAgo, today).avgFrequencyDays).toBeNull()
  })
})

describe('fechas de la Ciudad de México', () => {
  test('a las 21:00 del 10 de septiembre en CDMX ya es 11 en UTC, pero hoy sigue siendo 10', () => {
    expect(mexicoCityToday(new Date('2026-09-11T03:00:00Z'))).toBe('2026-09-10')
    expect(timestampToMexicoCityDate({ seconds: Date.UTC(2026, 8, 11, 3, 0) / 1000 })).toBe('2026-09-10')
    expect(timestampToMexicoCityDate(null)).toBe('')
  })

  test('días entre fechas y cómo se leen', () => {
    expect(daysBetweenDates('2026-08-10', today)).toBe(31)
    expect(daysBetweenDates('ayer', today)).toBeNull()
    expect(describeDaysAgo(0)).toBe('Hoy')
    expect(describeDaysAgo(1)).toBe('Ayer')
    expect(describeDaysAgo(45)).toBe('Hace 2 meses')
    expect(describeDaysAgo(null)).toBe('Sin paseos completados')
    expect(formatShortDate('2026-09-10')).toMatch(/10.*2026/)
    expect(formatShortDate('')).toBe('')
  })
})

describe('mensajes de WhatsApp por etapa', () => {
  test('usan el primer nombre y los perros', () => {
    expect(firstNameOf('Ana López')).toBe('Ana')
    expect(firstNameOf('Sin nombre')).toBe('')
    expect(joinNames(['Luna', 'Max', 'Toby'])).toBe('Luna, Max y Toby')
    expect(segmentMessage('en_riesgo', 'Ana López', ['Luna'])).toBe(
      'Hola Ana, somos PET Ap. Hace unas semanas que no paseamos a Luna. ¿Te agendamos un paseo?',
    )
    expect(segmentMessage('sin_paseos', 'Sin nombre', [])).toMatch(/^Hola, somos PET Ap\./)
  })

  test('ninguno promete precios ni descuentos', () => {
    for (const segment of SEGMENT_ORDER) {
      expect(segmentMessage(segment, 'Ana', ['Luna'])).not.toMatch(/\$|descuento|gratis|promoci|%/i)
    }
  })
})

describe('página de familias', () => {
  test('usa las etapas, el reloj de la Ciudad de México y no oculta un error de lectura de paseos', () => {
    const page = readFileSync('src/app/admin/clientes/page.tsx', 'utf8')
    expect(page).toContain('customerActivity(sessions, timestampToMexicoCityDate(customer.createdAt), today)')
    expect(page).not.toContain('toISOString()')
    expect(page).toContain('error ?? sessionsError')
  })
})
