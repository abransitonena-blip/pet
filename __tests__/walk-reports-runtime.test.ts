import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

describe('walk report runtime containment', () => {
  test('uses a live listener only for the walker editor', () => {
    const hook = read('src/lib/useWalkReport.ts')
    const editor = read('src/components/walker/WalkReportEditor.tsx')
    const family = read('src/app/familia/reportes/[sessionId]/page.tsx')
    expect(hook).toContain("mode: 'once' | 'live' = 'once'")
    expect(editor).toContain("useWalkReport(sessionId, 'live')")
    expect(family).toContain('useWalkReport(params.sessionId)')
  })

  test('checks the feature flag before any report listener can be created', () => {
    const hook = read('src/lib/useWalkReport.ts')
    expect(hook.indexOf('if (!FEATURE_FLAGS.WALK_REPORTS_ENABLED || !sessionId)')).toBeGreaterThan(-1)
    expect(hook.indexOf('if (!FEATURE_FLAGS.WALK_REPORTS_ENABLED || !sessionId)')).toBeLessThan(hook.indexOf('onSnapshot('))
  })

  test('limits the staff query and does not keep an admin listener', () => {
    const admin = read('src/app/admin/reportes/page.tsx')
    expect(admin).toContain('limit(50)')
    expect(admin).toContain('getDocs(')
    expect(admin).not.toContain('onSnapshot(')
    expect(admin).toContain("'draft'")
    expect(admin).toContain("'submitted'")
    expect(admin).toContain('onRetry=')
  })

  test('family history reads canonical sessions only, with reports linked per session', () => {
    const history = read('src/app/familia/historial/page.tsx')
    const canonical = read('src/components/family/CanonicalFamilyHistory.tsx')
    expect(history).toContain('<CanonicalFamilyHistory customerId={customerId} />')
    expect(history).toContain('useCanonicalReservations')
    expect(history).not.toContain("collection(db, 'reservations')")
    expect(history).toContain('/familia/reportes/')
    expect(canonical).toContain('useCustomerWalkSessions(customerId)')
    expect(canonical).toContain('/familia/reportes/')
    expect(canonical).not.toContain("collection(db, 'walkReports')")
  })

  test('provisions team roles without Cloud Functions and without handling passwords', () => {
    // The Cloud Function that set role claims can never be deployed (no billing
    // account), so provisioning moved to /api/admin/team, which writes the claim
    // through the Identity Toolkit REST API. Accounts are still created by the
    // person signing up -- this panel must never mint one or show a password.
    const walkers = read('src/app/admin/paseadores/page.tsx')
    const panel = read('src/components/admin/TeamProvisionPanel.tsx')
    const route = read('src/app/api/admin/team/route.ts')

    expect(walkers).toContain('<TeamProvisionPanel zones={zones} />')
    expect(walkers).not.toMatch(/tempPassword|CLOUD_FUNCTIONS_ENABLED/)
    expect(panel).toContain("fetch('/api/admin/team'")
    // The panel may *mention* passwords in its copy ("no se crean contraseñas
    // desde este panel"); what it must never do is collect or display one.
    expect(panel).not.toMatch(/type="password"|tempPassword|setPassword/)
    expect(route).toContain('verifyAdminToken')
    expect(route).toContain('self-demotion-blocked')
    expect(route).not.toMatch(/accounts:signUp|createUser|body\.password/)
  })

  test('walker activation is a plain admin write, not a privileged endpoint', () => {
    const helper = read('src/lib/adminWalkers.ts')
    expect(helper).toContain("doc(db, 'walkerProfiles', uid)")
    expect(helper).toContain('status, updatedAt: serverTimestamp()')
  })

  test('prevents concurrent submissions and keeps financial fields out', () => {
    const editor = read('src/components/walker/WalkReportEditor.tsx')
    const persistence = read('src/lib/useWalkReport.ts')
    expect(editor).toContain('operationInFlight.current')
    expect(persistence).not.toMatch(/amount|price|discount|tip|payment|folio|financial/i)
  })
})
