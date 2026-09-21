/** @jest-environment node */

import { readFileSync } from 'node:fs'

const verifyTokenRole = jest.fn()
const notifyUser = jest.fn()
let firestore: unknown

jest.mock('@/lib/serverAuth', () => ({ verifyTokenRole: (...args: unknown[]) => verifyTokenRole(...args) }))
jest.mock('@/lib/finance/serverFirestore', () => ({ getPrivilegedFirestore: () => firestore }))
jest.mock('@/lib/push/pushServer', () => ({ notifyUser: (...args: unknown[]) => notifyUser(...args) }))

import { POST as track } from '../src/app/api/walks/track/route'
import { POST as escalate } from '../src/app/api/geofence/escalate/route'
import { FAMILY_NOTICE_LIMIT, checkFamilyNotice, defaultFamilyNotice, familyNoticeMessage } from '../src/lib/familyNotice'

const read = (path: string) => readFileSync(path, 'utf8')

const post = (path: string, body: unknown, token = 'token') => new Request(`http://localhost${path}`, {
  method: 'POST',
  headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
  body: JSON.stringify(body),
})

type Doc = { exists: boolean; data: () => Record<string, unknown> | undefined }
const doc = (data: Record<string, unknown> | null): Doc => ({ exists: data !== null, data: () => data ?? undefined })

/**
 * Un Firestore de mentira, con lo justo para las dos rutas: lee documentos por
 * ruta y los puntos del recorrido, y anota lo que se escribe.
 */
function fakeFirestore(docs: Record<string, Record<string, unknown> | null>, points: Record<string, unknown>[] = []) {
  const writes: { path: string; op: string; data: unknown }[] = []
  const added: { path: string; data: unknown }[] = []
  const at = (name: string, id: string) => `${name}/${id}`
  const api = {
    collection: (name: string) => ({
      doc: (id: string) => ({
        get: async () => doc(docs[at(name, id)] ?? null),
        update: async (data: unknown) => { writes.push({ path: at(name, id), op: 'update', data }) },
        collection: (sub: string) => ({
          orderBy: () => ({ limit: () => ({ get: async () => ({ docs: points.map((point) => ({ data: () => point })) }) }) }),
          add: async (data: unknown) => { added.push({ path: `${at(name, id)}/${sub}`, data }) },
        }),
      }),
    }),
    runTransaction: async (fn: (transaction: unknown) => Promise<unknown>) => fn({
      get: async (ref: { path: string }) => doc(docs[ref.path] ?? null),
      update: (ref: { path: string }, data: unknown) => { writes.push({ path: ref.path, op: 'transaction-update', data }) },
    }),
  }
  // Las referencias de la transacción necesitan su ruta.
  const original = api.collection
  api.collection = (name: string) => {
    const collection = original(name)
    return { ...collection, doc: (id: string) => ({ ...collection.doc(id), path: at(name, id) }) } as never
  }
  return { api, writes, added }
}

const POINTS = [
  { lat: 19.4, lng: -99.1, outside: false, capturedAt: { seconds: 100 } },
  { lat: 19.5, lng: -99.2, outside: true, capturedAt: { seconds: 200 } },
]

beforeEach(() => {
  jest.clearAllMocks()
  notifyUser.mockResolvedValue({ sent: 1, pruned: 0, failures: {}, devices: 1 })
})

/**
 * La salida del área recomendada se alerta PRIMERO a administración, para que
 * revise si fue un percance o una vuelta más larga por el parque. La familia no
 * se entera sola: ni por un aviso, ni por un punto rojo en su mapa.
 */
describe('lo que la familia ve del recorrido', () => {
  const SESSION = { customerId: 'familia-1', walkerId: 'paseador-1' }

  it('sin que administración haya decidido, ningún punto viene marcado como "fuera"', async () => {
    firestore = fakeFirestore({ 'walkSessions/s1': SESSION, 'geofenceAlerts/s1': { status: 'open', customerId: 'familia-1' } }, POINTS).api
    verifyTokenRole.mockResolvedValue({ uid: 'familia-1', role: 'customer' })
    const body = await (await track(post('/api/walks/track', { sessionId: 's1' }))).json()
    expect(body.points).toHaveLength(2)
    expect(body.points.map((item: { outside: boolean }) => item.outside)).toEqual([false, false])
  })

  it('aun sin ninguna alerta, la marca no se le enseña', async () => {
    firestore = fakeFirestore({ 'walkSessions/s1': SESSION }, POINTS).api
    verifyTokenRole.mockResolvedValue({ uid: 'familia-1', role: 'customer' })
    const body = await (await track(post('/api/walks/track', { sessionId: 's1' }))).json()
    expect(body.points.some((item: { outside: boolean }) => item.outside)).toBe(false)
  })

  it('cuando administración decide avisarle, entonces sí ve dónde fue', async () => {
    firestore = fakeFirestore({
      'walkSessions/s1': SESSION,
      'geofenceAlerts/s1': { status: 'acknowledged', familyNotifiedAt: { seconds: 300 } },
    }, POINTS).api
    verifyTokenRole.mockResolvedValue({ uid: 'familia-1', role: 'customer' })
    const body = await (await track(post('/api/walks/track', { sessionId: 's1' }))).json()
    expect(body.points.map((item: { outside: boolean }) => item.outside)).toEqual([false, true])
  })

  it('administración y el paseador ven la marca siempre: es su trabajo', async () => {
    firestore = fakeFirestore({ 'walkSessions/s1': SESSION }, POINTS).api
    for (const caller of [{ uid: 'admin-1', role: 'admin' }, { uid: 'paseador-1', role: 'walker' }]) {
      verifyTokenRole.mockResolvedValue(caller)
      const body = await (await track(post('/api/walks/track', { sessionId: 's1' }))).json()
      expect(body.points.map((item: { outside: boolean }) => item.outside)).toEqual([false, true])
    }
  })

  it('otra familia no recibe nada', async () => {
    firestore = fakeFirestore({ 'walkSessions/s1': SESSION }, POINTS).api
    verifyTokenRole.mockResolvedValue({ uid: 'familia-2', role: 'customer' })
    const response = await track(post('/api/walks/track', { sessionId: 's1' }))
    expect(response.status).toBe(403)
  })
})

describe('avisar a la familia', () => {
  const ALERT = { status: 'open', customerId: 'familia-1', walkerName: 'Ana' }
  const MESSAGE = 'Nuestro equipo vio que Ana salió del área recomendada y lo está revisando.'

  it('sólo administración o supervisión', async () => {
    firestore = fakeFirestore({ 'geofenceAlerts/s1': ALERT }).api
    for (const role of ['customer', 'walker']) {
      verifyTokenRole.mockResolvedValue({ uid: 'x', role })
      expect((await escalate(post('/api/geofence/escalate', { sessionId: 's1', message: MESSAGE }))).status).toBe(403)
    }
    expect(notifyUser).not.toHaveBeenCalled()
    verifyTokenRole.mockResolvedValue(null)
    expect((await escalate(post('/api/geofence/escalate', { sessionId: 's1', message: MESSAGE }))).status).toBe(403)
  })

  it('no sale con un texto vacío ni pasado de largo: es una persona quien lo escribe', async () => {
    firestore = fakeFirestore({ 'geofenceAlerts/s1': ALERT }).api
    verifyTokenRole.mockResolvedValue({ uid: 'admin-1', role: 'admin' })
    for (const message of ['', '   ', 'x'.repeat(FAMILY_NOTICE_LIMIT + 1)]) {
      const response = await escalate(post('/api/geofence/escalate', { sessionId: 's1', message }))
      expect(response.status).toBe(400)
    }
    expect(notifyUser).not.toHaveBeenCalled()
  })

  it('una alerta que no existe no le manda nada a nadie', async () => {
    firestore = fakeFirestore({}).api
    verifyTokenRole.mockResolvedValue({ uid: 'admin-1', role: 'admin' })
    expect((await escalate(post('/api/geofence/escalate', { sessionId: 'nada', message: MESSAGE }))).status).toBe(404)
    expect(notifyUser).not.toHaveBeenCalled()
  })

  it('el aviso llega al panel y al teléfono de LA familia de ese paseo, con el texto de administración', async () => {
    const fake = fakeFirestore({ 'geofenceAlerts/s1': ALERT })
    firestore = fake.api
    verifyTokenRole.mockResolvedValue({ uid: 'admin-1', role: 'admin' })
    const response = await escalate(post('/api/geofence/escalate', { sessionId: 's1', message: MESSAGE }))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ code: 'ok', phoneReached: true })

    // Su panel: notifications/{familia}/items
    expect(fake.added).toHaveLength(1)
    expect(fake.added[0].path).toBe('notifications/familia-1/items')
    expect(fake.added[0].data).toMatchObject({ message: MESSAGE, read: false, type: 'walk_update' })
    // Su teléfono, con el mismo texto y a nadie más.
    expect(notifyUser).toHaveBeenCalledTimes(1)
    expect(notifyUser.mock.calls[0][1]).toBe('familia-1')
    expect(notifyUser.mock.calls[0][2]).toMatchObject({ body: MESSAGE, url: '/familia' })
  })

  it('deja constancia de quién avisó y qué dijo, y marca la alerta como atendida', async () => {
    const fake = fakeFirestore({ 'geofenceAlerts/s1': ALERT })
    firestore = fake.api
    verifyTokenRole.mockResolvedValue({ uid: 'admin-1', role: 'admin' })
    await escalate(post('/api/geofence/escalate', { sessionId: 's1', message: MESSAGE }))
    const claim = fake.writes.find((item) => item.op === 'transaction-update')?.data as Record<string, unknown>
    expect(claim.familyNotifiedBy).toBe('admin-1')
    expect(claim.familyMessage).toBe(MESSAGE)
    expect(claim.resolution).toBe('incident')
    expect(claim.status).toBe('acknowledged')
    expect(claim.acknowledgedBy).toBe('admin-1')
  })

  it('una sola vez por alerta: dos personas del equipo no le mandan dos avisos a la misma familia', async () => {
    const fake = fakeFirestore({ 'geofenceAlerts/s1': { ...ALERT, familyNotifiedAt: { seconds: 5 } } })
    firestore = fake.api
    verifyTokenRole.mockResolvedValue({ uid: 'admin-2', role: 'supervisor' })
    const response = await escalate(post('/api/geofence/escalate', { sessionId: 's1', message: MESSAGE }))
    expect(response.status).toBe(409)
    expect((await response.json()).code).toBe('already-notified')
    expect(fake.added).toHaveLength(0)
    expect(notifyUser).not.toHaveBeenCalled()
  })

  it('si la familia no tiene avisos activos, se le dice a administración que no le sonó', async () => {
    firestore = fakeFirestore({ 'geofenceAlerts/s1': ALERT }).api
    notifyUser.mockResolvedValue({ sent: 0, pruned: 0, failures: {}, devices: 0 })
    verifyTokenRole.mockResolvedValue({ uid: 'admin-1', role: 'admin' })
    const body = await (await escalate(post('/api/geofence/escalate', { sessionId: 's1', message: MESSAGE }))).json()
    // Quedó en su panel, pero no en su teléfono: conviene escribirle por WhatsApp.
    expect(body).toEqual({ code: 'ok', phoneReached: false })
  })

  it('si no se pudo entregar, se suelta la reserva para poder reintentar', async () => {
    const fake = fakeFirestore({ 'geofenceAlerts/s1': ALERT })
    firestore = fake.api
    // El error se registra en el servidor: aquí es lo esperado, no ruido.
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    notifyUser.mockRejectedValue(new Error('fcm down'))
    verifyTokenRole.mockResolvedValue({ uid: 'admin-1', role: 'admin' })
    const response = await escalate(post('/api/geofence/escalate', { sessionId: 's1', message: MESSAGE }))
    expect(response.status).toBe(502)
    const release = fake.writes.find((item) => item.op === 'update')?.data as Record<string, unknown>
    expect(Object.keys(release)).toEqual(expect.arrayContaining(['familyNotifiedAt', 'familyNotifiedBy', 'familyMessage', 'resolution']))
    spy.mockRestore()
  })
})

describe('el texto que se le propone a administración', () => {
  it('sólo afirma lo que es cierto: el equipo lo vio y lo está revisando', () => {
    const text = defaultFamilyNotice({ walkerName: 'Ana', dogName: 'Rocco' })
    expect(text).toContain('Ana salió del área recomendada')
    expect(text).toContain('paseo de Rocco')
    expect(text).toContain('lo está revisando')
    // No dice que algo grave ocurrió: administración todavía no lo sabe.
    expect(text).not.toMatch(/accidente|peligro|perdi|emergencia|grave/i)
  })

  it('cabe en el límite, con nombres largos', () => {
    const text = defaultFamilyNotice({ walkerName: 'María de los Ángeles Fernández', dogName: 'Sir Winston Churchill' })
    expect(text.length).toBeLessThanOrEqual(FAMILY_NOTICE_LIMIT)
  })

  it('valida vacío y largo, con su mensaje', () => {
    expect(checkFamilyNotice('  ')).toBe('empty')
    expect(checkFamilyNotice('x'.repeat(FAMILY_NOTICE_LIMIT + 1))).toBe('too-long')
    expect(checkFamilyNotice('Hola')).toBe('ok')
    expect(familyNoticeMessage('empty')).toContain('Escribe')
    expect(familyNoticeMessage('too-long')).toContain(String(FAMILY_NOTICE_LIMIT))
  })
})

describe('la pantalla de administración', () => {
  const actions = read('src/components/admin/GeofenceAlertActions.tsx')

  it('da los dos caminos, y el aviso a la familia pasa por un texto editable', () => {
    expect(actions).toContain('Todo en orden')
    expect(actions).toContain('Avisar a la familia')
    expect(actions).toContain('Lo que verá la familia')
    expect(actions).toContain('defaultFamilyNotice(')
    expect(actions).toContain("fetch('/api/geofence/escalate'")
  })

  it('dice hasta dónde llegó el aviso: si al teléfono no, lo dice', () => {
    expect(actions).toContain('No tiene avisos activos en su teléfono')
    expect(actions).toContain('conviene escribirle por WhatsApp')
  })

  it('el cartel del panel y la lista de Rutas usan las mismas acciones', () => {
    expect(read('src/components/admin/GeofenceAlertsBanner.tsx')).toContain('<GeofenceAlertActions')
    expect(read('src/app/admin/rutas/AdminRutasPanel.tsx')).toContain('<GeofenceAlertActions')
  })

  it('las reglas no cambian: administración sigue sin poder escribir el aviso a otra persona desde el navegador', () => {
    const rules = read('firestore.rules')
    expect(rules).toContain("onlyAllowedFieldsChanged(['status', 'acknowledgedBy', 'acknowledgedAt'])")
    expect(rules).not.toContain('familyNotifiedAt')
  })
})

describe('las zonas dicen "área recomendada"', () => {
  it('ningún texto de la familia, el paseador o administración habla de una frontera', () => {
    for (const path of [
      'src/components/admin/GeofenceAlertsBanner.tsx',
      'src/components/walker/WalkTracker.tsx',
      'src/components/walks/WalkRouteMap.tsx',
      'src/lib/walkPath.ts',
      'src/app/supervisor/incidencias/SupervisorIncidenciasPanel.tsx',
    ]) {
      const source = read(path)
      expect(source).not.toContain('fuera de la zona')
      expect(source).not.toContain('fuera de zona')
      expect(source).not.toContain('salió de la zona')
    }
    expect(read('src/components/admin/ZoneFormModal.tsx')).toContain('Radio del área recomendada (km)')
  })

  it('al paseador se le dice sin regañarlo: por si necesita ayuda, y que puede seguir', () => {
    const tracker = read('src/components/walker/WalkTracker.tsx')
    expect(tracker).toContain('por si necesitas ayuda')
    expect(tracker).toContain('si todo va bien, puedes seguir')
    expect(tracker).not.toContain('regresa a la zona')
  })
})
