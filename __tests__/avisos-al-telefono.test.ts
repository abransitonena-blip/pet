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
  const card = read('src/components/admin/SystemHealthCard.tsx')
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
    expect(card).toContain('Lo que falta no da error: simplemente no ocurre')
    expect(card).toContain('/api/push/status')
  })

  it('vive en Configuración, junto al control para registrar el teléfono', () => {
    expect(config).toContain("id: 'avisos'")
    expect(config).toContain('<SystemHealthCard />')
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

/**
 * "0 enviados" no es un diagnóstico. La prueba de avisos decía eso tanto
 * cuando no había ningún teléfono registrado como cuando FCM rechazaba el
 * envío, que son dos problemas con arreglos opuestos. Ahora el motivo viaja.
 */
describe('cuando no sale ningún aviso, se dice por qué', () => {
  const server = read('src/lib/push/pushServer.ts')
  const route = read('src/app/api/push/status/route.ts')
  const card = read('src/components/admin/SystemHealthCard.tsx')

  it('el envío cuenta los motivos de fallo, no sólo los éxitos', () => {
    expect(server).toContain('failures: NotifyResult[\'failures\'] = {}')
    expect(server).toContain('failures[result.reason] = (failures[result.reason] ?? 0) + 1')
    // Cuántos aparatos se intentaron: sin esto, cero enviados y cero
    // registrados se ven igual.
    expect(server).toContain('devices: tokens.length')
  })

  it('la respuesta de la prueba lleva ese motivo hasta la pantalla', () => {
    expect(route).toContain("NextResponse.json({ code: 'ok', ...result }")
  })

  it('la tarjeta distingue "no hay teléfonos" de "FCM rechazó"', () => {
    expect(card).toContain('No hay ningún teléfono tuyo registrado')
    expect(card).toContain('FCM rechazó el envío')
    expect(card).toContain("failures['unregistered']")
    // El caso de cero dispositivos se decide antes de inventar un motivo.
    expect(card.indexOf('(data?.devices ?? 0) === 0')).toBeLessThan(card.indexOf("failures['not-configured']"))
  })
})

/**
 * Los avisos no llegaban por una razón más simple que cualquier fallo técnico:
 * nadie los había activado. El control existía en Notificaciones de la familia,
 * en el perfil del paseador y en Configuración -- tres pantallas a las que nadie
 * entra por su cuenta --, así que no había un solo teléfono registrado.
 */
describe('se ofrecen donde la gente está', () => {
  const nudge = read('src/components/push/PushNudge.tsx')

  it('sale en los tres inicios, que son las pantallas que todos abren', () => {
    for (const panel of [
      'src/app/familia/FamiliaPanel.tsx',
      'src/app/walker/WalkerDashboard.tsx',
      'src/app/admin/AdminPanel.tsx',
    ]) {
      expect(read(panel)).toContain('<PushNudge message=')
    }
  })

  it('no se dibuja si no hay nada que activar', () => {
    // Ya activados, bloqueados, sin soporte o con la función apagada: nada que ofrecer.
    // Sólo el estado "available" ofrece activar; en iPhone sin instalar se enseña
    // otra cosa (ver guia-iphone.test.ts).
    expect(nudge).toContain("availability === 'available' && !wasDismissed(DISMISSED_KEY)")
  })

  it('quien dice que no, no lo vuelve a ver en ese teléfono', () => {
    expect(nudge).toContain('pet-avisos-propuesta-descartada')
    expect(nudge).toContain('aria-label="Ahora no"')
  })

  it('cuando no se puede, dice por qué -- incluido el iPhone', () => {
    expect(nudge).toContain('agrega PET Ap a tu pantalla de inicio')
    expect(nudge).toContain('El navegador tiene bloqueados los avisos')
  })

  it('el control de siempre sigue en su pantalla', () => {
    expect(read('src/app/familia/notificaciones/FamiliaNotificacionesPanel.tsx')).toContain('<PushOptIn description=')
    expect(read('src/app/walker/perfil/WalkerPerfilPanel.tsx')).toContain('<PushOptIn description=')
  })
})
