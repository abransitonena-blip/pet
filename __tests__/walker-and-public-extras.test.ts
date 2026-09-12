import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(path, 'utf8')

/**
 * Lo que el paseador puede hacer, y lo que la página pública cuenta. Lo que se
 * rompe sin ruido: que el recorrido vuelva a ser sólo del equipo, que la foto
 * del perro se entregue a quien ya no lleva ese paseo, o que un texto que
 * administración escribe deje de aparecer donde se prometió.
 */
describe('el paseador ve su propio paseo completo', () => {
  test('el recorrido lo pide el mismo mapa que ve la familia', () => {
    const page = read('src/app/walker/reportes/[sessionId]/page.tsx')
    expect(page).toContain('<WalkRouteMap sessionId={params.sessionId} />')
    expect(read('src/components/walks/WalkRouteMap.tsx')).toContain("'/api/walks/track'")
  })

  test('el servidor autoriza a los tres lados, y a nadie más', () => {
    const route = read('src/app/api/walks/track/route.ts')
    expect(route).toContain('const isStaff =')
    expect(route).toContain('session.walkerId === caller.uid')
    expect(route).toContain('session.customerId === caller.uid')
    expect(route).toContain("code: 'session-not-yours'")
  })

  test('la foto del perro llega en la ficha, con enlace que caduca', () => {
    const sheet = read('src/app/api/walker/walk-sheet/route.ts')
    expect(sheet).toContain('createPrivateDownloadUrl')
    expect(sheet).toContain('PHOTO_TTL_SECONDS')
    expect(sheet).toContain('isDogPhotoReference')
    // Y sólo si el paseo sigue siendo suyo y está activo.
    expect(sheet).toContain("code: 'session-not-assigned'")
    expect(sheet).toContain('VISIBLE_STATUSES.has')
  })

  test('sin foto queda la misma marca teñida que ve la familia', () => {
    expect(read('src/components/walker/WalkSheet.tsx')).toContain('photoUrl={dog.photoUrl}')
    expect(read('src/components/dogs/DogAvatar.tsx')).toContain('sin foto')
  })
})

describe('la página pública', () => {
  test('publica los consejos que administración ya escribía', () => {
    const section = read('src/components/WalkTipsSection.tsx')
    expect(section).toContain('config.walkTips')
    // Sin consejos no queda un título huérfano.
    expect(section).toContain('if (tips.length === 0) return null')
    expect(read('src/app/HomeClient.tsx')).toContain('<WalkTipsSection />')
  })

  test('el menú lleva a la cobertura, que es la primera pregunta de quien llega', () => {
    expect(read('src/components/Header.tsx')).toContain("href: '/#cobertura'")
    expect(read('src/components/CoverageSection.tsx')).toContain('id="cobertura"')
  })
})

/**
 * PET Ap se instala en el teléfono sin pasar por ninguna tienda. Lo que se
 * rompe callado: el ícono. iOS no lee el manifiesto para la pantalla de inicio
 * -- si falta apple-touch-icon usa una captura de la página como ícono, y nadie
 * se entera hasta que alguien la instala.
 */
describe('se instala como app', () => {
  test('el manifiesto la declara instalable y a pantalla completa', () => {
    const manifest = JSON.parse(read('public/manifest.json')) as {
      display?: string
      start_url?: string
      icons?: Array<{ sizes?: string; type?: string }>
    }
    expect(manifest.display).toBe('standalone')
    expect(manifest.start_url).toBe('/')
    const sizes = (manifest.icons ?? []).map((icon) => icon.sizes)
    expect(sizes).toContain('192x192')
    expect(sizes).toContain('512x512')
    for (const icon of manifest.icons ?? []) expect(icon.type).toBe('image/png')
  })

  test('iOS tiene su propio ícono declarado y el archivo existe', () => {
    expect(read('src/app/layout.tsx')).toContain('rel="apple-touch-icon"')
    expect(readFileSync('public/apple-touch-icon.png').byteLength).toBeGreaterThan(1000)
  })

  test('los íconos del manifiesto existen de verdad', () => {
    for (const path of ['public/icons/icon-192.png', 'public/icons/icon-512.png']) {
      expect(readFileSync(path).byteLength).toBeGreaterThan(1000)
    }
  })
})
