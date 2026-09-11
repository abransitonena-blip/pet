import { readFileSync } from 'node:fs'
import { TRACKING_RETENTION_DAYS, trackingExpiryDate } from '@/lib/trackingRetention'
import { privacySections } from '@/lib/privacyContent'

const read = (path: string) => readFileSync(path, 'utf8')

describe('retención de la ubicación del paseo', () => {
  test('un punto caduca 30 días después de capturarse', () => {
    expect(TRACKING_RETENTION_DAYS).toBe(30)
    const captured = new Date('2026-09-11T15:00:00Z')
    expect(trackingExpiryDate(captured).toISOString()).toBe('2026-10-11T15:00:00.000Z')
  })

  test('el servidor escribe la caducidad en el punto y en la alerta', () => {
    const route = read('src/app/api/tracking/point/route.ts')
    expect(route).toContain('const expiresAt = Timestamp.fromDate(trackingExpiryDate(now.toDate()))')
    // El punto y la alerta, que también guarda una ubicación.
    expect(route.match(/expiresAt,/g) ?? []).toHaveLength(2)
  })

  test('el aviso de privacidad dice que se registra ubicación y por cuánto tiempo', () => {
    const categorias = privacySections.find((section) => section.title.startsWith('2.'))
    const retencion = privacySections.find((section) => section.title.startsWith('6.'))
    expect(categorias?.content).toContain('ubicación')
    expect(retencion?.content).toContain('30 días')
  })

  test('la política documenta cómo se borra y qué pasa si no se enciende', () => {
    const policy = read('TRACKING_POLICY.md')
    expect(policy).toContain('REQUIERE VALIDACIÓN DE ABOGADO EN MÉXICO')
    expect(policy).toContain('expiresAt')
    expect(policy).toContain('no se borran solos')
  })
})
