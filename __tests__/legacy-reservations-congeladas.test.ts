import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(path, 'utf8')

/**
 * El historial legacy está congelado, y esta prueba lo comprueba en vez de
 * confiarlo a la memoria.
 *
 * En el commit fa72a45 afirmé que la bandera protegía el botón de estado pero no
 * el cambio de `paymentStatus` ni el borrado. Era falso: los tres estaban
 * protegidos. Lo había mirado por encima. Esta prueba existe para que la próxima
 * afirmación sobre esto sea verificable y no una impresión.
 */
describe('escrituras al historial legacy', () => {
  test('cada escritura a reservations pasa por la bandera', () => {
    for (const file of ['src/components/admin/LegacyReservationsView.tsx', 'src/app/cancelar/page.tsx']) {
      const source = read(file)
      // La guardia vive al principio de la función que contiene la escritura, y
      // esa función puede ser larga: `autoAssign` pone su guardia cien líneas
      // antes del updateDoc. Por eso se busca desde el inicio de la función, no
      // en una ventana de caracteres fija -- con una ventana de 700 esta prueba
      // daba por desprotegida una escritura que sí lo estaba.
      for (const match of Array.from(source.matchAll(/(?:updateDoc|deleteDoc)\(\s*doc\(db, 'reservations'/g))) {
        const before = source.slice(0, match.index)
        // El inicio de la función que la contiene: una declaración a nivel del
        // componente (dos espacios de sangría) o un manejador en línea. Buscar
        // cualquier `const ` caía en una variable local declarada DESPUÉS de la
        // guardia, y daba por desprotegida una escritura que sí lo estaba.
        const starts = [
          ...Array.from(before.matchAll(/\n {2}const \w+ = (?:async )?\(/g)).map((m) => m.index),
          before.lastIndexOf('onClick={'),
        ].filter((index) => typeof index === 'number' && index >= 0) as number[]
        const scope = before.slice(starts.length > 0 ? Math.max(...starts) : 0)
        const line = before.split('\n').length
        expect({ at: `${file}:${line}`, guarded: scope.includes('LEGACY_RESERVATION_WRITES_ENABLED') })
          .toEqual({ at: `${file}:${line}`, guarded: true })
      }
    }
  })

  test('la bandera sigue apagada: el historial no se escribe desde el navegador', () => {
    expect(read('src/lib/featureFlags.ts')).toContain('LEGACY_RESERVATION_WRITES_ENABLED: false')
  })

  test('la pantalla pública de cancelación tiene su propia llave', () => {
    expect(read('src/app/cancelar/page.tsx')).toContain('PUBLIC_PHONE_CANCELLATION_ENABLED')
  })
})
