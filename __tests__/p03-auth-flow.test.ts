import fs from 'node:fs'
import path from 'node:path'
import { loginPathWithRedirect } from '@/lib/auth'
import { resolveDestination, ROLE_HOME } from '@/lib/roles'

const root = path.resolve(__dirname, '..')
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8')

describe('P0.3 authentication flow', () => {
  it('defines explicit local Firebase Auth persistence', () => {
    const config = read('src/firebase/config.ts')
    expect(config).toContain('browserLocalPersistence')
    expect(config).toContain('setPersistence(auth, browserLocalPersistence)')
  })

  it('uses popup and GIS credential exchange without redirect auth', () => {
    const login = read('src/app/login/page.tsx')
    const sharedGoogle = read('src/lib/googleAuth.ts')
    expect(login).toContain('signInWithPopup')
    expect(login).toContain('signInWithCredential')
    expect(login).not.toMatch(/signInWithRedirect|getRedirectResult/)
    expect(`${login}\n${sharedGoogle}`.match(/new GoogleAuthProvider\(\)/g)).toHaveLength(1)
    expect(login).toContain('signInWithPopup(auth, googleAuthProvider)')
    expect(login).toContain('El acceso con Google no está configurado')
  })

  it('routes every role from claims to its approved home', () => {
    expect(ROLE_HOME).toEqual({
      customer: '/familia',
      walker: '/walker',
      supervisor: '/admin',
      admin: '/admin',
    })
    expect(resolveDestination('customer', '/familia/historial')).toBe('/familia/historial')
    expect(resolveDestination('walker', '/familia')).toBe('/walker')
    expect(resolveDestination('supervisor', '/admin/reservas')).toBe('/admin/reservas')
    expect(resolveDestination('supervisor', '/supervisor/incidencias')).toBe('/admin')
  })

  it('preserves safe internal destinations including their query string', () => {
    const destination = '/familia/nueva-reserva?repeat=Paseo%20Cotidiano'
    expect(loginPathWithRedirect(destination)).toBe(`/login?redirect=${encodeURIComponent(destination)}`)
    expect(resolveDestination('customer', destination)).toBe(destination)
    expect(loginPathWithRedirect('//evil.example')).toBe('/login')
  })

  it('does not use users.role as an authorization source', () => {
    const authFiles = [
      'src/app/login/page.tsx',
      'src/components/TeamLoginForm.tsx',
      'src/lib/useSessionRole.ts',
      'src/middleware.ts',
    ].map(read).join('\n')
    expect(authFiles).not.toMatch(/users[^\n]*\.role|data\(\)\.role/)
    expect(authFiles).toContain('getIdTokenResult')
  })

  it('keeps the session cookie as navigation-only and clears it on logout', () => {
    const authHelpers = read('src/lib/auth.ts')
    expect(authHelpers).toContain('session-presence flag')
    const clientLayouts = [
      'src/app/familia/FamilyLayoutClient.tsx',
      'src/app/walker/WalkerLayoutClient.tsx',
      'src/app/admin/AdminLayoutClient.tsx',
      'src/app/supervisor/SupervisorLayoutClient.tsx',
    ]
    for (const layout of clientLayouts) {
      const source = read(layout)
      expect(source).toContain('clearSessionCookie()')
      expect(source).toContain('await signOut(auth)')
    }
  })

  it('removes the nonexistent supervisors navigation entry', () => {
    expect(read('src/app/admin/AdminLayoutClient.tsx')).not.toContain('/admin/supervisores')
  })
})
