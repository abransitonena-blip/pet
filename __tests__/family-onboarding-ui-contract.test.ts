import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(__dirname, '..')
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8')

describe('Family onboarding UI and data contract', () => {
  const page = read('src/app/familia/configuracion-inicial/FamiliaConfiguracionInicialPanel.tsx')
  const service = read('src/lib/familyOnboarding.ts')
  const shell = read('src/components/layout/AppShell.tsx')
  const familyLayout = read('src/app/familia/FamilyLayoutClient.tsx')
  const login = read('src/app/login/page.tsx')

  test('uses only active zones and persists the selected stable zone id on the own address', () => {
    expect(service).toContain("where('active', '==', true)")
    expect(service).toContain('zoneId: input.zoneId')
    expect(page).toContain('key={zone.id}')
    expect(page).toContain('setZoneId(zone.id)')
    expect(page).not.toContain('setZoneId(zone.name)')
  })

  test('prefers a zoned address when an older unzoned address also exists', () => {
    expect(service).toContain('firstAddressDocument = addresses.docs.find')
    expect(service).toContain('firstAddressId: firstAddressDocument?.id')
  })

  test('writes deterministic own onboarding documents without roles or reservations', () => {
    expect(service).toContain('`onboarding-${uid}`')
    expect(service).toContain('ownerId: uid')
    expect(service).not.toMatch(/\brole\s*:/)
    expect(service).not.toContain("collection(db, 'reservations')")
    expect(service).not.toContain("collection(db, 'serviceOrders')")
  })

  test('provides back navigation, exact errors, 44px controls and a compact mobile family menu', () => {
    expect(page).toContain('previousFamilyOnboardingStep')
    expect(page).toContain('validateFamilyOnboardingStep')
    expect(page).toContain('min-h-11')
    expect(familyLayout).toContain('mobileNavigation')
    expect(shell).toContain("navItems.length <= 4")
    expect(shell).toContain('<details')
    expect(login).toContain('Math.min(320, availableWidth')
    expect(login).toContain('overflow-x-hidden')
  })
})
