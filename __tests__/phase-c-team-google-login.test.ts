import fs from 'node:fs'
import path from 'node:path'

jest.mock('firebase/auth', () => ({
  GoogleAuthProvider: class {
    setCustomParameters() {}
  },
}))

import { classifyGoogleError } from '@/lib/auth'
import { evaluateWalkerProfileAccess } from '@/lib/googleAuth'
import { evaluateTeamAccess, resolveDestination, type RoleResolution } from '@/lib/roles'

const root = path.resolve(__dirname, '..')
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8')

describe('Google compartido para Familia PET y equipo', () => {
  test('existe una sola instancia de GoogleAuthProvider', () => {
    const sources = [
      read('src/lib/googleAuth.ts'),
      read('src/app/login/page.tsx'),
      read('src/components/TeamLoginForm.tsx'),
    ].join('\n')
    expect(sources.match(/new GoogleAuthProvider\(\)/g)).toHaveLength(1)
    expect(read('src/app/login/page.tsx')).toContain('signInWithPopup(auth, googleAuthProvider)')
    expect(read('src/components/TeamLoginForm.tsx')).toContain('signInWithPopup(auth, googleAuthProvider)')
  })

  test.each([
    ['admin', '/admin'],
    ['supervisor', '/admin'],
    ['walker', '/walker'],
  ] as const)('%s usa el destino canónico %s', (role, destination) => {
    expect(resolveDestination(role, null)).toBe(destination)
  })

  test('customer, claim ausente y claim desconocido se rechazan en equipo', () => {
    const cases: RoleResolution[] = [
      { role: 'customer', refreshed: false, claimStatus: 'valid', rawRole: 'customer' },
      { role: 'customer', refreshed: true, claimStatus: 'missing', rawRole: null },
      { role: 'customer', refreshed: true, claimStatus: 'unsupported', rawRole: 'owner' },
    ]
    expect(cases.map(evaluateTeamAccess)).toEqual([
      expect.objectContaining({ allowed: false, reason: 'customer-account' }),
      expect.objectContaining({ allowed: false, reason: 'missing-claim' }),
      expect.objectContaining({ allowed: false, reason: 'unsupported-claim' }),
    ])
  })

  test('walker necesita perfil activo', () => {
    expect(evaluateWalkerProfileAccess(null)).toMatchObject({ allowed: false, reason: 'profile-missing' })
    expect(evaluateWalkerProfileAccess({ status: 'suspended' })).toMatchObject({ allowed: false, reason: 'suspended' })
    expect(evaluateWalkerProfileAccess({ status: 'invited' })).toMatchObject({ allowed: false, reason: 'invited' })
    expect(evaluateWalkerProfileAccess({ status: 'inactive' })).toMatchObject({ allowed: false, reason: 'inactive' })
    expect(evaluateWalkerProfileAccess({ status: 'active' })).toEqual({ allowed: true })
  })

  test('popup cancelado y bloqueado tienen mensajes distintos', () => {
    expect(classifyGoogleError({ code: 'auth/popup-closed-by-user' })).toContain('Cerraste')
    expect(classifyGoogleError({ code: 'auth/popup-blocked' })).toContain('bloqueó')
  })

  test('el navegador no crea perfiles, cuentas internas ni claims', () => {
    const team = read('src/components/TeamLoginForm.tsx')
    expect(team).toContain("doc(db, 'walkerProfiles', user.uid)")
    expect(team).not.toMatch(/setDoc|addDoc|updateDoc|createUser|setCustomUserClaims/)
    expect(team).not.toMatch(/users[^\n]*role|data\(\)\.role/)
    expect(team).toContain('getIdTokenResult')
    expect(team).toContain('href="/login"')
  })
})
