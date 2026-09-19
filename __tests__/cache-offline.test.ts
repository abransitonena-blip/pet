import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(path, 'utf8')

/**
 * Quien trabaja en la calle pierde señal. Sin caché persistente, lo que un
 * paseador anota sin red vive sólo en memoria: si cierra la pestaña, se pierde
 * sin avisar, y al volver a abrir el panel arranca vacío.
 */
describe('la caché del navegador', () => {
  const db = read('src/firebase/db.ts')

  it('guarda en disco y permite dos pestañas', () => {
    expect(db).toContain('persistentLocalCache({')
    expect(db).toContain('tabManager: persistentMultipleTabManager()')
  })

  it('el tamaño va dentro de la caché, no al lado', () => {
    // Firebase rechaza los dos juntos con `invalid-argument`, y esa excepción
    // tumba la pantalla entera al arrancar: pasó, y no lo vio ninguna prueba
    // de código -- lo vio el navegador.
    const settings = db.slice(db.indexOf('initializeFirestore(app, {'))
    const topLevelSize = /\n\s{2}cacheSizeBytes:/.test(settings)
    expect({ tamañoAlLado: topLevelSize }).toEqual({ tamañoAlLado: false })
    expect(db).toContain('    cacheSizeBytes: CACHE_SIZE_UNLIMITED,')
  })

  it('sigue forzando el canal largo, que es lo que conecta en redes malas', () => {
    expect(db).toContain('experimentalForceLongPolling: true')
  })
})
