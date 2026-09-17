import { readFileSync } from 'node:fs'

describe('MP-003 familia/historial: the list distinguishes error from empty', () => {
  const historialPage = readFileSync('src/app/familia/historial/page.tsx', 'utf8')
  const canonicalHistory = readFileSync('src/components/family/CanonicalFamilyHistory.tsx', 'utf8')

  test('reads the canonical walkSessions source, not the frozen legacy collection', () => {
    expect(historialPage).toContain('useCanonicalReservations')
    expect(historialPage).not.toContain("collection(db, 'reservations')")
  })

  test('a read failure surfaces as an error state instead of silently emptying the list', () => {
    expect(historialPage).toContain('sessionsError')
    expect(historialPage).toContain('canonicalReadErrorMessage')
    expect(historialPage).toContain('<ErrorState')
    expect(historialPage).toContain('onRetry={retry}')
  })

  test('the error branch is checked before the empty-state branch so a real error is never shown as "sin reservas"', () => {
    const errorBranchIndex = historialPage.indexOf('sessionsError ? (')
    const emptyBranchIndex = historialPage.indexOf('No hay reservas en tu historial')
    expect(errorBranchIndex).toBeGreaterThan(-1)
    expect(emptyBranchIndex).toBeGreaterThan(-1)
    expect(errorBranchIndex).toBeLessThan(emptyBranchIndex)
  })

  test('the canonical section separates loading/error/empty, now inside its month view', () => {
    const loadingBranch = canonicalHistory.indexOf('loading ? (')
    const errorBranch = canonicalHistory.indexOf('error ? (')
    const emptyBranch = canonicalHistory.indexOf('sorted.length === 0 ? (')
    expect(loadingBranch).toBeGreaterThan(-1)
    expect(errorBranch).toBeGreaterThan(loadingBranch)
    expect(emptyBranch).toBeGreaterThan(errorBranch)
    expect(canonicalHistory).toContain('canonicalReadErrorMessage')
  })
})
