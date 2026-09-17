import { readFileSync, readdirSync } from 'node:fs'

const read = (path: string) => readFileSync(path, 'utf8')

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = `${dir}/${entry.name}`
    if (entry.isDirectory()) return sourceFiles(path)
    return /\.tsx?$/.test(entry.name) ? [path] : []
  })
}

/**
 * El SDK de Firestore pesa unos 90 kB comprimidos. Mientras `db` vivió en
 * `@/firebase/config` -- el módulo que importa cualquier pantalla que necesite
 * saber quién entró --, ese peso caía también en la portada, en el acceso de
 * familias y en el del equipo, que no consultan nada hasta que alguien entra.
 */
describe('Firestore no pesa en las pantallas públicas', () => {
  it('config expone la sesión; la base de datos vive aparte', () => {
    const config = read('src/firebase/config.ts')
    expect(config).not.toContain("from 'firebase/firestore'")
    expect(config).toContain('export { auth, authPersistenceReady }')
    expect(read('src/firebase/db.ts')).toContain('initializeFirestore(app')
  })

  it('nadie pide `db` a config: ese import ya no existe', () => {
    const offenders = sourceFiles('src').filter((file) => {
      const source = read(file)
      return /import \{[^}]*\bdb\b[^}]*\} from '@\/firebase\/config'/.test(source)
        || source.includes("const { db } = await import('@/firebase/config')")
    })
    expect(offenders).toEqual([])
  })

  it('lo que envuelve toda la app carga Firestore en segundo plano', () => {
    for (const file of [
      'src/context/ConfigContext.tsx',
      'src/context/BrandContext.tsx',
      'src/context/PricesContext.tsx',
      'src/components/BannerDisplay.tsx',
    ]) {
      const source = read(file)
      expect({ file, eager: source.includes("from 'firebase/firestore'") }).toEqual({ file, eager: false })
      expect({ file, lazy: source.includes('@/firebase/lazyFirestore') }).toEqual({ file, lazy: true })
    }
  })

  it('la portada, el acceso de familias y el del equipo tampoco lo cargan de entrada', () => {
    for (const file of [
      'src/lib/usePublicStats.ts',
      'src/lib/customerProfile.ts',
      'src/components/TeamLoginForm.tsx',
    ]) {
      const source = read(file)
      expect({ file, eager: source.includes("from 'firebase/firestore'") || source.includes("from '@/firebase/db'") })
        .toEqual({ file, eager: false })
    }
  })
})
