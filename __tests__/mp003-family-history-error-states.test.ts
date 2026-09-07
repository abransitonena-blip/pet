import { readFileSync } from 'node:fs'

describe('MP-003 familia/historial: legacy list distinguishes error from empty', () => {
  const historialPage = readFileSync('src/app/familia/historial/page.tsx', 'utf8')
  const canonicalHistory = readFileSync('src/components/family/CanonicalFamilyHistory.tsx', 'utf8')

  test('the legacy reservations listener sets a permission/network error instead of silently emptying', () => {
    expect(historialPage).toContain('setLegacyError')
    expect(historialPage).toContain("permission-denied")
    expect(historialPage).toContain('No pudimos consultar el historial anterior')
    expect(historialPage).toContain('<ErrorState')
    expect(historialPage).toContain('onRetry={() => setRetryKey((value) => value + 1)}')
  })

  test('the error branch is checked before the empty-state branch so a real error is never shown as "sin reservas"', () => {
    const errorBranchIndex = historialPage.indexOf('legacyError ? (')
    const emptyBranchIndex = historialPage.indexOf('No hay reservas en tu historial')
    expect(errorBranchIndex).toBeGreaterThan(-1)
    expect(emptyBranchIndex).toBeGreaterThan(-1)
    expect(errorBranchIndex).toBeLessThan(emptyBranchIndex)
  })

  test('the canonical section already separates loading/error/empty (reference behaviour kept intact)', () => {
    expect(canonicalHistory).toContain('if (loading) return <LoadingState')
    expect(canonicalHistory).toContain('if (error) return')
    expect(canonicalHistory).toContain('canonicalReadErrorMessage')
  })
})
