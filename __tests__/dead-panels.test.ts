import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(__dirname, '..')
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8')
const exists = (relativePath: string) => fs.existsSync(path.join(root, relativePath))

function sourceFiles(dir: string, found: string[] = []): string[] {
  for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const relative = `${dir}/${entry.name}`
    if (entry.isDirectory()) sourceFiles(relative, found)
    else if (/\.tsx?$/.test(entry.name)) found.push(relative)
  }
  return found
}

describe('paneles viejos o sin función', () => {
  test('la compuerta de PET Ahora y su elegibilidad legacy ya no existen ni se importan', () => {
    expect(exists('src/components/PetAhoraGate.tsx')).toBe(false)
    expect(exists('src/lib/useEligibility.ts')).toBe(false)
    const offenders = sourceFiles('src').filter((file) => /PetAhoraGate|useEligibility/.test(read(file)))
    expect(offenders).toEqual([])
  })

  test('ningún panel decide la elegibilidad con la colección congelada `reservations`', () => {
    const readers = sourceFiles('src').filter((file) => read(file).includes("collection(db, 'reservations')"))
    // Solo el historial legacy de admin y la cancelación por teléfono, ambos apagados.
    expect(readers.sort()).toEqual([
      'src/app/cancelar/page.tsx',
      'src/app/admin/reservas/page.tsx',
      'src/context/ReservationsContext.tsx',
    ].sort())
  })

  test('el enlace público de cancelar solo aparece si la cancelación por teléfono está encendida', () => {
    expect(read('src/components/Footer.tsx')).toContain('FEATURE_FLAGS.PUBLIC_PHONE_CANCELLATION_ENABLED && (')
  })

  test('créditos y lealtad salen del menú mientras nada pueda mover esos saldos', () => {
    const layout = read('src/app/familia/FamilyLayoutClient.tsx')
    expect(layout).toContain("if (item.id === 'billetera') return FEATURE_FLAGS.WALLET_MUTATIONS_ENABLED")
    expect(layout).toContain("if (item.id === 'lealtad') return FEATURE_FLAGS.LOYALTY_REDEMPTION_ENABLED")
    expect(read('src/app/familia/page.tsx')).toContain('{FEATURE_FLAGS.WALLET_MUTATIONS_ENABLED && <WalletCard compact />}')
  })

  test('Incidencias del supervisor mira paseos reales, no solo reseñas', () => {
    const page = read('src/app/supervisor/incidencias/page.tsx')
    expect(page).toContain('useCanonicalReservations')
    expect(page).toContain('useOpenGeofenceAlerts')
    expect(page).toContain("collection(db, 'walkReports')")
    expect(page).toContain('incidentsSummary')
    expect(page).not.toContain('Incidencias potenciales')
  })
})
