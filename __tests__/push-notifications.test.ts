import { readFileSync } from 'node:fs'
import { isPlausibleToken, MAX_DEVICES, mergeDeviceTokens, withoutTokens } from '@/lib/push/pushTokens'

const read = (path: string) => readFileSync(path, 'utf8')
const token = (label: string) => `${label}-${'x'.repeat(40)}`

/**
 * Push notifications ship ready but off: the code flag and a VAPID key both
 * have to exist before anything reaches a device. These pin the parts that
 * matter once it is switched on -- who may trigger a push, what it may say,
 * and that device lists cannot grow without bound.
 */
describe('avisos push: listos y apagados', () => {
  test('cada dispositivo se guarda una vez, el más reciente al final, con tope', () => {
    const devices = Array.from({ length: MAX_DEVICES }, (_, index) => token(`device-${index}`))

    const refreshed = mergeDeviceTokens(devices, devices[0])
    expect(refreshed).toHaveLength(MAX_DEVICES)
    expect(refreshed[refreshed.length - 1]).toBe(devices[0])
    expect(new Set(refreshed).size).toBe(refreshed.length)

    const withNewDevice = mergeDeviceTokens(devices, token('new-device'))
    expect(withNewDevice).toHaveLength(MAX_DEVICES)
    expect(withNewDevice).not.toContain(devices[0])
    expect(withNewDevice[withNewDevice.length - 1]).toBe(token('new-device'))
  })

  test('se olvidan los dispositivos que FCM reporta como muertos', () => {
    const devices = [token('a'), token('b'), token('c')]
    expect(withoutTokens(devices, new Set([token('b')]))).toEqual([token('a'), token('c')])
  })

  test('rechaza tokens implausibles antes de guardarlos', () => {
    expect(isPlausibleToken(token('ok'))).toBe(true)
    expect(isPlausibleToken('corto')).toBe(false)
    expect(isPlausibleToken(`${token('a')} ${token('b')}`)).toBe(false)
    expect(isPlausibleToken(42)).toBe(false)
    expect(isPlausibleToken('x'.repeat(5000))).toBe(false)
  })

  test('importar el cliente de avisos no carga los SDK de Firebase', () => {
    expect(read('src/lib/push/pushClient.ts')).not.toMatch(/^import .* from '@\/firebase\/config'/m)
  })

  test('todas las entradas pasan por FCM_ENABLED', () => {
    for (const path of [
      'src/app/api/push/register/route.ts',
      'src/app/api/push/unregister/route.ts',
      'src/app/api/push/session-event/route.ts',
      'src/app/api/push/chat-message/route.ts',
      'src/lib/push/pushServer.ts',
      'src/lib/push/pushClient.ts',
    ]) {
      expect(read(path)).toContain('FEATURE_FLAGS.FCM_ENABLED')
    }
  })

  test('el aviso de un paseo lo dispara solo el paseador asignado o staff, y nunca se repite', () => {
    const route = read('src/app/api/push/session-event/route.ts')
    expect(route).toContain('session.walkerId === caller.uid')
    expect(route).toContain(".collection('pushEvents')")
    expect(route).toContain('.create({')
    // The server announces the session's stored status, never a step the
    // caller claims happened.
    expect(route).not.toMatch(/body\.(status|step)/)
  })

  test('el aviso de chat no pone el texto del mensaje en la pantalla bloqueada', () => {
    expect(read('src/app/api/push/chat-message/route.ts')).not.toMatch(/lastMessage|\.text\b/)
  })

  test('el aviso de chat lo dispara cualquiera de los dos lados, y el servidor decide a quién', () => {
    const route = read('src/app/api/push/chat-message/route.ts')
    // Quien escribe no nombra al destinatario: se saca de la conversación.
    expect(route).toContain('participants.filter((uid) => uid !== caller.uid)')
    expect(route).toContain("!participants.includes(caller.uid)")
    expect(route).not.toMatch(/body\.(uid|target|to)\b/)
    // Y los dos lados lo llaman.
    expect(read('src/components/chat/ConversationThread.tsx')).toContain('notifyChatMessage(conversationId)')
    expect(read('src/components/AdminChat.tsx')).toContain('notifyChatMessage(')
  })

  test('los tokens viven en una colección sin regla: ningún navegador los lee', () => {
    expect(read('src/lib/push/pushServer.ts')).toContain("const COLLECTION = 'pushTokens'")
    expect(read('firestore.rules')).not.toContain('pushTokens')
  })

  test('el service worker muestra el aviso y solo abre páginas de la propia app', () => {
    const worker = read('public/sw.js')
    expect(worker).toContain("addEventListener('push'")
    expect(worker).toContain("addEventListener('notificationclick'")
    expect(worker).toContain('target.origin !== self.location.origin')
  })

  test('la CSP solo abre los dominios de FCM cuando existe la llave VAPID', () => {
    const security = read('security-headers.js')
    expect(security).toMatch(/pushConnectHosts = process\.env\.NEXT_PUBLIC_FIREBASE_VAPID_KEY\s*\?/)
    expect(security.indexOf('fcmregistrations.googleapis.com')).toBeGreaterThan(security.indexOf('NEXT_PUBLIC_FIREBASE_VAPID_KEY'))
  })

  test('la política de permisos no bloquea la ubicación del propio sitio', () => {
    // An empty allowlist denied the API to this origin too, so the walk's start
    // and end points could never be captured in production. Checked on the
    // header value itself, not the whole file, whose comment explains the old one.
    const policy = read('security-headers.js').match(/key: 'Permissions-Policy', value: '([^']*)'/)?.[1] ?? ''
    expect(policy).toContain('geolocation=(self)')
    expect(policy).not.toContain('geolocation=()')
  })
})
