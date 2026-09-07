import fs from 'node:fs'
import path from 'node:path'

import {
  FamilyLoginFlowError,
  classifyFamilyLoginError,
  familyLoginError,
} from '@/lib/auth'
import { evaluateTeamAccess, resolveDestination, resolveRoleClaim } from '@/lib/roles'

const root = path.resolve(__dirname, '..')
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8')

describe('Familia PET canonical onboarding', () => {
  test('a missing claim is customer at /login but is denied at /equipo', () => {
    const resolution = resolveRoleClaim(undefined)
    expect(resolution).toMatchObject({ role: 'customer', claimStatus: 'missing' })
    expect(resolveDestination(resolution.role, null)).toBe('/familia')
    expect(evaluateTeamAccess({ ...resolution, refreshed: false })).toMatchObject({
      allowed: false,
      reason: 'missing-claim',
    })
  })

  test.each([
    ['walker', '/walker'],
    ['supervisor', '/admin'],
    ['admin', '/admin'],
  ] as const)('an explicit %s claim keeps its internal destination', (role, destination) => {
    expect(resolveDestination(role, null)).toBe(destination)
  })

  test('the login onboarding never reads clients and uses the canonical transaction', () => {
    const login = read('src/app/login/page.tsx')
    const profile = read('src/lib/customerProfile.ts')
    const onboarding = profile.slice(profile.indexOf('export async function ensureCanonicalCustomerProfile'))
    expect(login).toContain('ensureCanonicalCustomerProfile')
    expect(login).not.toContain('getCustomerProfile(')
    expect(onboarding).toContain('runTransaction')
    expect(onboarding).not.toContain("doc(db, LEGACY")
  })

  test('permission and network failures after Auth have distinct recoverable messages', () => {
    expect(classifyFamilyLoginError(familyLoginError('profile', { code: 'firestore/permission-denied' })))
      .toContain('por permisos')
    expect(classifyFamilyLoginError(familyLoginError('profile', { code: 'firestore/unavailable' })))
      .toContain('problema de red')
    expect(classifyFamilyLoginError(familyLoginError('claims', { code: 'auth/network-request-failed' })))
      .toContain('problema de red')
  })

  test('OAuth, Auth, claims and profile failures remain distinguishable', () => {
    expect(classifyFamilyLoginError({ code: 'auth/popup-blocked' })).toContain('bloqueó')
    expect(classifyFamilyLoginError({ code: 'auth/internal-error' })).toContain('Firebase Authentication')
    expect(classifyFamilyLoginError(familyLoginError('auth', { code: 'auth/session-unavailable' })))
      .toContain('Firebase Authentication')
    expect(classifyFamilyLoginError(familyLoginError('claims', { code: 'auth/internal-error' })))
      .toContain('tipo de acceso')
    expect(classifyFamilyLoginError(familyLoginError('profile', { code: 'unknown' })))
      .toContain('perfil de Familia PET')
  })

  test('flow errors expose only stage and normalized provider code', () => {
    const error = new FamilyLoginFlowError('profile', { code: 'firestore/permission-denied' })
    expect(error.stage).toBe('profile')
    expect(error.providerCode).toBe('firestore/permission-denied')
    expect(error.message).toBe('family-login-flow-error')
  })

  test('the UI has an in-flight guard against duplicate Google attempts', () => {
    const login = read('src/app/login/page.tsx')
    expect(login).toContain('googleAttemptRef.current')
    expect(login).toContain('if (googleAttemptRef.current) return')
    expect(login).toContain('googleAttemptRef.current = false')
  })

  test('browser code never writes roles or custom claims', () => {
    const sources = [
      read('src/app/login/page.tsx'),
      read('src/lib/customerProfile.ts'),
      read('src/components/TeamLoginForm.tsx'),
    ].join('\n')
    expect(sources).not.toMatch(
      /setCustomUserClaims|customClaims\s*:|role\s*:\s*['"](?:walker|supervisor|admin)['"]/,
    )
  })
})
