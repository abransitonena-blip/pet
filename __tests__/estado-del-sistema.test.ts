import { readFileSync } from 'node:fs'
import { buildHealthChecks, missingCount, type HealthInputs } from '../src/lib/systemHealth'

const read = (path: string) => readFileSync(path, 'utf8')

const todoBien: HealthInputs = {
  fcmEnabled: true,
  vapidKey: true,
  privilegedIdentity: true,
  serviceAccount: true,
  cloudinaryCloud: true,
  cloudinaryKey: true,
  cloudinarySecret: true,
  cronSecret: true,
  registeredDevices: 3,
  servicesWithoutPrice: [],
  zonesWithoutArea: [],
}

describe('qué depende de algo que vive fuera del código', () => {
  it('una zona sin centro y radio no puede avisar de una salida, y lo dice con su nombre', () => {
    const checks = buildHealthChecks({ ...todoBien, zonesWithoutArea: ['Roma Norte', 'Coyoacán'] })
    const zones = checks.find((check) => check.id === 'zones')
    expect(zones?.state).toBe('missing')
    expect(zones?.detail).toBe('sin área: Roma Norte, Coyoacán')
    expect(zones?.consequence).toContain('área recomendada')
    expect(zones?.fix).toContain('centro y radio')
    // Sin zonas problemáticas, la línea está en verde.
    expect(buildHealthChecks(todoBien).find((check) => check.id === 'zones')?.state).toBe('ok')
  })

  it('con todo en su lugar, no falta nada', () => {
    expect(missingCount(buildHealthChecks(todoBien))).toBe(0)
  })

  it('cada pieza que falta dice qué se apaga y cómo se arregla', () => {
    const checks = buildHealthChecks({ ...todoBien, vapidKey: false, cronSecret: false })
    const faltantes = checks.filter((check) => check.state === 'missing')
    expect(faltantes.map((check) => check.id).sort()).toEqual(['cron', 'vapid'])
    for (const check of faltantes) {
      expect(check.consequence.length).toBeGreaterThan(10)
      expect(check.fix?.length ?? 0).toBeGreaterThan(10)
    }
    expect(faltantes.find((check) => check.id === 'cron')?.consequence).toContain('recordatorio')
  })

  it('las fotos privadas necesitan las tres credenciales, y dice cuál falta', () => {
    const checks = buildHealthChecks({ ...todoBien, cloudinarySecret: false })
    const cloudinary = checks.find((check) => check.id === 'cloudinary')
    expect(cloudinary?.state).toBe('missing')
    expect(cloudinary?.detail).toBe('falta el secreto')
  })

  it('un servicio ofrecido sin tarifa no se puede pedir, y por eso se dice aquí', () => {
    // El formulario de reserva lo esconde: sin esta línea, el dueño no se entera.
    const checks = buildHealthChecks({ ...todoBien, servicesWithoutPrice: ['paseo-adiestramiento'] })
    const prices = checks.find((check) => check.id === 'prices')
    expect(prices?.state).toBe('missing')
    expect(prices?.detail).toBe('sin tarifa: paseo-adiestramiento')
    expect(prices?.consequence).toContain('nadie puede pedirlo')
  })

  it('sin teléfonos registrados no hay a quién avisarle, aunque todo lo demás esté', () => {
    const checks = buildHealthChecks({ ...todoBien, registeredDevices: 0 })
    const devices = checks.find((check) => check.id === 'devices')
    expect(devices?.state).toBe('missing')
    expect(devices?.detail).toBe('0 registrados')
  })
})

describe('de dónde salen los datos', () => {
  const route = read('src/app/api/push/status/route.ts')

  it('el servidor mira las variables reales, y acepta los dos nombres de la llave', () => {
    expect(route).toContain('process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || process.env.NEXT_PUBLIC_FIREBASE_VAPID')
    expect(route).toContain('process.env.FIREBASE_SERVICE_ACCOUNT_JSON')
    expect(route).toContain('process.env.CRON_SECRET')
    expect(route).toContain('describeCloudinaryConfig()')
    expect(route).toContain('isRequestableServicePrice(parsed?.services[id])')
  })

  it('ningún secreto viaja al navegador: sólo si está o no', () => {
    const lib = read('src/lib/systemHealth.ts')
    expect(lib).not.toMatch(/process\.env/)
    // La ruta manda booleanos, no valores.
    expect(route).toContain('vapidKey: Boolean(')
    expect(route).toContain('cronSecret: Boolean(process.env.CRON_SECRET)')
  })

  it('sólo administración la puede consultar', () => {
    expect(route).toContain('!staff(caller.role)')
  })
})
