import { readFileSync } from 'node:fs'
import { isWalkerPhotoReference, WALKER_PHOTO_FOLDER } from '@/lib/walkerPhotos'

const read = (path: string) => readFileSync(path, 'utf8')

/**
 * La foto del paseador la ve la familia que va a abrirle la puerta. Lo que no
 * puede pasar: que cualquiera recorra las fotos del equipo, o que junto con la
 * cara viaje su teléfono y su correo.
 */
describe('referencia de la foto', () => {
  it('es un id opaco bajo el prefijo privado, nunca un URL', () => {
    expect(isWalkerPhotoReference(`${WALKER_PHOTO_FOLDER}/0f2b6c1e-1111-2222-3333-444455556666`)).toBe(true)
    expect(isWalkerPhotoReference('https://res.cloudinary.com/demo/image/upload/foto.jpg')).toBe(false)
    expect(isWalkerPhotoReference('pet-ap-private/dogs/0f2b6c1e-1111-2222-3333-444455556666')).toBe(false)
    expect(isWalkerPhotoReference('')).toBe(false)
  })
})

describe('quién puede verla', () => {
  const route = read('src/app/api/media/private/walker-photo/route.ts')

  it('se pregunta por un paseo, no por un paseador', () => {
    expect(route).toContain("firestore.collection('walkSessions').doc(sessionId).get()")
    expect(route).toContain('session.customerId === caller.uid')
    expect(route).toContain('session.walkerId === caller.uid')
    expect(route).toContain("code: 'session-not-yours'")
  })

  it('un paseador puede pedir la suya sin un paseo de por medio', () => {
    expect(route).toContain('body.self === true')
    expect(route).toContain("caller.role !== 'walker'")
  })

  it('devuelve el nombre y la foto, y nada más de su expediente', () => {
    const responder = route.slice(route.indexOf('async function respondWithWalker'), route.indexOf('export async function POST'))
    expect(responder).toContain('name:')
    expect(responder).toContain('photoUrl')
    for (const forbidden of ['phone', 'email', 'zones', 'schedule', 'maxDaily']) {
      expect(responder).not.toContain(forbidden)
    }
  })

  it('el enlace caduca', () => {
    expect(route).toContain('createPrivateDownloadUrl')
    expect(route).toContain('LINK_TTL_SECONDS')
  })
})

describe('quién puede subirla', () => {
  it('sólo un paseador, y sólo la suya', () => {
    const signature = read('src/app/api/media/private/signature/route.ts')
    expect(signature).toContain('body.folder === WALKER_PHOTO_FOLDER && !adminUid && !walkerUid')
    expect(signature).toContain("code: 'walker-required'")
    // No recibe un id: el único perfil que puede tocar es el suyo.
    expect(read('src/lib/media/walkerPhotoUpload.ts')).toContain('JSON.stringify({ folder: WALKER_PHOTO_FOLDER })')
  })

  it('las reglas le dejan escribir su referencia, y nada más nuevo', () => {
    expect(read('firestore.rules')).toContain("onlyAllowedFieldsChanged(['phone', 'schedule', 'photoReference', 'updatedAt'])")
  })
})

describe('dónde se ve', () => {
  it('en su propio perfil, y en las dos pantallas donde la familia lo espera', () => {
    expect(read('src/app/walker/perfil/page.tsx')).toContain('<WalkerPhotoButton')
    expect(read('src/app/familia/mensajes/page.tsx')).toContain('<WalkerCard sessionId={walk.id} />')
    expect(read('src/app/familia/reportes/[sessionId]/page.tsx')).toContain('<WalkerCard sessionId={params.sessionId} />')
  })

  it('sin foto queda el nombre; sin nombre no se muestra la tarjeta', () => {
    const card = read('src/components/family/WalkerCard.tsx')
    expect(card).toContain('if (!walker) return null')
    expect(card).toContain('walker.photoUrl')
  })
})
