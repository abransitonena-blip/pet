import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(path, 'utf8')

/**
 * La familia ve el recorrido mientras el paseo ocurre, no sólo al terminar.
 * Los puntos ya los entregaba el servidor comprobando de quién es el paseo; lo
 * que faltaba era mirarlos a tiempo y decir de cuándo son.
 */
describe('el paseo en vivo', () => {
  const map = read('src/components/walks/WalkRouteMap.tsx')
  const home = read('src/app/familia/FamiliaPanel.tsx')

  it('el inicio de familia muestra el mapa sólo mientras el paseo ocurre', () => {
    expect(home).toContain('{home.live && <WalkRouteMap sessionId={next.id} refreshEveryMs={60_000} live />}')
  })

  it('vuelve a preguntar cada tanto y limpia su temporizador', () => {
    expect(map).toContain('const timer = setInterval(() => { void load() }, refreshEveryMs)')
    expect(map).toContain('return () => { cancelled = true; clearInterval(timer) }')
  })

  it('dice de cuándo es la última lectura, para no confundir un mapa quieto con un perro quieto', () => {
    expect(map).toContain('Última lectura:')
    expect(map).toContain('Todavía no llega ninguna lectura del teléfono del paseador.')
    expect(map).toContain('aria-live="polite"')
  })

  it('si falla un refresco, no borra el recorrido que ya se veía', () => {
    expect(map).toContain("setRoute((current) => current.status === 'ready' ? current : { ...EMPTY, status: 'error' })")
  })

  it('el paseador sabe que la familia lo ve mientras el paseo ocurre', () => {
    expect(read('src/components/walker/WalkTracker.tsx'))
      .toContain('se comparte con administración y con la familia de este paseo')
  })

  it('sigue siendo el servidor quien decide quién puede ver los puntos', () => {
    const route = read('src/app/api/walks/track/route.ts')
    expect(route).toContain('session.customerId === caller.uid')
    expect(route).toContain("code: 'session-not-yours' }, { status: 403")
    expect(map).not.toContain("collection(db, 'walkTracks')")
  })
})
