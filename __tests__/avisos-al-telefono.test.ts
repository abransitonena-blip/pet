import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(path, 'utf8')

/**
 * Los avisos push llevaban semanas apagados y nadie podía verlo: la llave del
 * navegador estaba guardada en Vercel como `NEXT_PUBLIC_FIREBASE_VAPID` y el
 * código pedía `NEXT_PUBLIC_FIREBASE_VAPID_KEY`. Con ese nombre de más, la app
 * se comportaba como si no hubiera llave -- sin error, sin aviso, sin tarjeta
 * para activarlos.
 */
describe('la llave de los avisos', () => {
  const client = read('src/lib/push/pushClient.ts')

  it('acepta los dos nombres con que pudo quedar guardada', () => {
    expect(client).toContain('process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY')
    expect(client).toContain('process.env.NEXT_PUBLIC_FIREBASE_VAPID')
  })

  it('sin llave sigue sin ofrecer nada a medio configurar', () => {
    expect(client).toContain("if (!FEATURE_FLAGS.FCM_ENABLED || !VAPID_KEY) return 'off'")
  })
})

describe('el estado de los avisos se puede ver y probar', () => {
  const route = read('src/app/api/push/status/route.ts')
  const card = read('src/components/admin/PushHealthCard.tsx')
  const config = read('src/components/AdminConfig.tsx')

  it('sólo administración lo consulta', () => {
    expect(route).toContain('verifyTokenRole(idToken)')
    expect(route).toContain('!staff(caller.role)')
    expect(route).toContain("role === ROLES.ADMIN || role === ROLES.SUPERVISOR")
  })

  it('la prueba se manda a uno mismo y a nadie más', () => {
    expect(route).toContain('notifyUser(firestore, caller.uid,')
    // No hay forma de nombrar a otra persona como destino.
    expect(route).not.toMatch(/body\.(uid|target|to)\b/)
  })

  it('dice qué pieza falta, en vez de fallar callado', () => {
    for (const piece of ['flagEnabled', 'serverIdentity', 'devices', 'ownDevices']) {
      expect(route).toContain(piece)
    }
    expect(card).toContain('Falta algo para que un aviso llegue')
    expect(card).toContain('/api/push/status')
  })

  it('vive en Configuración, junto al control para registrar el teléfono', () => {
    expect(config).toContain("id: 'avisos'")
    expect(config).toContain('<PushHealthCard />')
    expect(config).toContain('<PushOptIn description=')
  })
})

describe('el ícono', () => {
  it('la pestaña y la búsqueda vuelven al cuadro naranja', () => {
    const layout = read('src/app/layout.tsx')
    expect(layout).toContain('<link rel="icon" type="image/svg+xml" href="/icons/icon-192.svg" />')
    expect(layout).not.toContain('href="/brand/pet-ap-dog-logo.png"')
  })

  it('el aviso en el teléfono usa el ícono cuadrado, que sí se lee en chico', () => {
    expect(read('public/sw.js')).toContain("icon: '/icons/icon-192.png'")
    expect(read('src/components/PWARegister.tsx')).toContain("icon: '/icons/icon-192.png'")
  })
})
