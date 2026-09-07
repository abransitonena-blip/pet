import {
  normalizeRole,
  roleFromToken,
  hasRole,
  isTeamRole,
  isSafeRedirect,
  resolveDestination,
  refreshTokenAndGetRole,
  evaluateTeamAccess,
  entryForPrivatePath,
  resolveRoleClaim,
  ROLE_ACCESS,
  ROLE_ENTRY,
  ROLE_HOME,
} from '../src/lib/roles'

describe('normalizeRole / roleFromToken', () => {
  it('legacy client maps to customer; missing claims → customer', () => {
    expect(normalizeRole('client')).toBe('customer')
    expect(normalizeRole(undefined)).toBe('customer')
    expect(normalizeRole(null)).toBe('customer')
    expect(normalizeRole('walker')).toBe('walker')
    expect(normalizeRole('supervisor')).toBe('supervisor')
    expect(normalizeRole('admin')).toBe('admin')
    expect(roleFromToken({ claims: { role: 'client' } })).toBe('customer')
    expect(roleFromToken({ claims: {} })).toBe('customer')
    expect(roleFromToken(null)).toBe('customer')
  })

  it('conserva la diferencia entre claim ausente, legacy y no reconocido', () => {
    expect(resolveRoleClaim(undefined)).toEqual({ role: 'customer', claimStatus: 'missing', rawRole: null })
    expect(resolveRoleClaim('client')).toEqual({ role: 'customer', claimStatus: 'legacy', rawRole: 'client' })
    expect(resolveRoleClaim('owner')).toEqual({ role: 'customer', claimStatus: 'unsupported', rawRole: 'owner' })
  })

  it('hasRole / isTeamRole', () => {
    expect(hasRole('admin', 'admin')).toBe(true)
    expect(hasRole('customer', 'admin')).toBe(false)
    expect(isTeamRole('walker')).toBe(true)
    expect(isTeamRole('customer')).toBe(false)
  })
})

describe('ROLE_HOME / resolveDestination (navegación por rol)', () => {
  it('centraliza entrada, inicio y capacidad básica por rol', () => {
    expect(ROLE_ENTRY).toEqual({ customer: '/login', walker: '/equipo', supervisor: '/equipo', admin: '/equipo' })
    expect(ROLE_ACCESS.customer.capabilities).toContain('customer:own-data')
    expect(ROLE_ACCESS.walker.capabilities).toContain('walker:assigned-sessions')
    expect(ROLE_ACCESS.supervisor.capabilities).toContain('supervisor:operations')
    expect(ROLE_ACCESS.admin.capabilities).toContain('admin:allowlisted-administration')
    expect(entryForPrivatePath('/familia/nueva-reserva')).toBe('/login')
    expect(entryForPrivatePath('/walker')).toBe('/equipo')
    expect(entryForPrivatePath('/admin')).toBe('/equipo')
  })
  // 1) customer → /familia: permitido
  it('customer → /familia permitido', () => {
    expect(ROLE_HOME.customer).toBe('/familia')
    expect(resolveDestination('customer', '/familia/historial')).toBe('/familia/historial')
  })

  // 2) customer → /walker: denegado
  it('customer → /walker denegado (cae a /familia)', () => {
    expect(resolveDestination('customer', '/walker')).toBe('/familia')
  })

  // 3) customer → /admin: denegado
  it('customer → /admin denegado', () => {
    expect(resolveDestination('customer', '/admin')).toBe('/familia')
  })

  it('walker → /walker; supervisor y admin → /admin', () => {
    expect(ROLE_HOME.walker).toBe('/walker')
    expect(ROLE_HOME.supervisor).toBe('/admin')
    expect(ROLE_HOME.admin).toBe('/admin')
    expect(resolveDestination('walker', '/walker/mis-paseos')).toBe('/walker/mis-paseos')
    expect(resolveDestination('supervisor', '/admin/reservas')).toBe('/admin/reservas')
    expect(resolveDestination('admin', '/admin/reservas')).toBe('/admin/reservas')
  })
})

describe('isSafeRedirect (redirect malicioso/externo → rechazado)', () => {
  it('rechaza redirects absolutos y protocol-relative', () => {
    expect(isSafeRedirect('https://evil.com')).toBe(false)
    expect(isSafeRedirect('//evil.com')).toBe(false)
    expect(isSafeRedirect('//evil.com/path')).toBe(false)
    expect(isSafeRedirect('javascript:alert(1)')).toBe(false)
  })

  it('rechaza backslash, doble slash codificado y traversal', () => {
    expect(isSafeRedirect('/\\evil.com')).toBe(false)
    expect(isSafeRedirect('/%2F%2Fevil.com')).toBe(false)
    expect(isSafeRedirect('/admin/../evil')).toBe(false)
    expect(isSafeRedirect('/../admin')).toBe(false)
  })

  it('acepta únicamente rutas internas de un segmento seguro', () => {
    expect(isSafeRedirect('/admin')).toBe(true)
    expect(isSafeRedirect('/familia/perros')).toBe(true)
    expect(isSafeRedirect('/familia/nueva-reserva?repeat=Paseo%20Cotidiano')).toBe(true)
    expect(isSafeRedirect('')).toBe(false)
    expect(isSafeRedirect(null)).toBe(false)
    expect(isSafeRedirect(undefined)).toBe(false)
  })
})

describe('refreshTokenAndGetRole (claims antiguos → renovación correcta)', () => {
  // 13) claims desactualizados: refresca UNA vez y comprueba de nuevo
  it('renueva el token una vez y detecta el rol nuevo', async () => {
    let first = true
    const getIdToken = jest.fn(async () => 'token')
    const getIdTokenResult = jest.fn(async () => {
      if (first) {
        first = false
        return { claims: {} }
      }
      return { claims: { role: 'walker' } }
    })

    const res = await refreshTokenAndGetRole({ getIdToken, getIdTokenResult })
    expect(res).toEqual({ role: 'walker', refreshed: true, claimStatus: 'valid', rawRole: 'walker' })
    expect(getIdToken).toHaveBeenCalledTimes(1)
    expect(getIdToken).toHaveBeenCalledWith(true)
  })

  it('no refresca si el token ya trae un rol de equipo', async () => {
    const getIdToken = jest.fn(async () => 'token')
    const getIdTokenResult = jest.fn(async () => ({ claims: { role: 'admin' } }))

    const res = await refreshTokenAndGetRole({ getIdToken, getIdTokenResult })
    expect(res).toEqual({ role: 'admin', refreshed: false, claimStatus: 'valid', rawRole: 'admin' })
    expect(getIdToken).not.toHaveBeenCalled()
  })

  it('si tras el refresh sigue sin rol de equipo, niega sin bucle infinito', async () => {
    const getIdToken = jest.fn(async () => 'token')
    const getIdTokenResult = jest.fn(async () => ({ claims: {} }))

    const res = await refreshTokenAndGetRole({ getIdToken, getIdTokenResult })
    expect(res.role).toBe('customer')
    expect(res.claimStatus).toBe('missing')
    expect(getIdToken).toHaveBeenCalledTimes(1)
  })
})

describe('evaluateTeamAccess', () => {
  it('distingue cuenta Familia, claim ausente y claim no reconocido', () => {
    expect(evaluateTeamAccess({ role: 'customer', claimStatus: 'valid', rawRole: 'customer', refreshed: false })).toMatchObject({ allowed: false, reason: 'customer-account' })
    expect(evaluateTeamAccess({ role: 'customer', claimStatus: 'missing', rawRole: null, refreshed: false })).toMatchObject({ allowed: false, reason: 'missing-claim' })
    expect(evaluateTeamAccess({ role: 'customer', claimStatus: 'unsupported', rawRole: 'owner', refreshed: false })).toMatchObject({ allowed: false, reason: 'unsupported-claim' })
  })

  it('permite únicamente roles de equipo explícitos', () => {
    expect(evaluateTeamAccess({ role: 'admin', claimStatus: 'valid', rawRole: 'admin', refreshed: false })).toEqual({ allowed: true, role: 'admin' })
  })
})
