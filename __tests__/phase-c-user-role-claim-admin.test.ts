// eslint-disable-next-line @typescript-eslint/no-require-imports
const claimAdmin = require('../scripts/lib/user-role-claim-admin.cjs') as {
  confirmationPhrase: (options: Record<string, unknown>) => string
  parseRoleClaimArgs: (argv: string[]) => Record<string, unknown>
  runRoleClaimOperation: (adapter: Record<string, jest.Mock>, options: Record<string, unknown>) => Promise<Record<string, unknown>>
  safeFailure: (error: unknown, options?: Record<string, unknown>) => Record<string, unknown>
}

const baseArgs = [
  '--email', 'ap9871888@gmail.com',
  '--project', 'pet-1cb0b',
  '--role', 'admin',
  '--expect-current-role', 'absent',
]

function user(overrides: Record<string, unknown> = {}) {
  return {
    uid: 'full-uid-must-never-be-printed',
    email: 'ap9871888@gmail.com',
    disabled: false,
    emailVerified: false,
    customClaims: {},
    ...overrides,
  }
}

function adapter(authUser = user()) {
  return {
    getUserByEmail: jest.fn(async () => authUser),
    setCustomUserClaims: jest.fn(async () => undefined),
    getUser: jest.fn(async () => authUser),
  }
}

describe('set-user-role-claim — argumentos y confirmación', () => {
  it('usa verify-only por defecto y proyecto/email obligatorios', () => {
    expect(claimAdmin.parseRoleClaimArgs(baseArgs)).toMatchObject({
      verifyOnly: true,
      execute: false,
      role: 'admin',
      projectId: 'pet-1cb0b',
    })
    expect(() => claimAdmin.parseRoleClaimArgs(baseArgs.slice(0, 2))).toThrow('valid-project-required')
  })

  it('rechaza roles no permitidos', () => {
    expect(() => claimAdmin.parseRoleClaimArgs(baseArgs.map((value) => value === 'admin' ? 'owner' : value))).toThrow('role-not-allowed')
  })

  it('bloquea execute sin la confirmación exacta', () => {
    expect(() => claimAdmin.parseRoleClaimArgs([...baseArgs, '--execute'])).toThrow('explicit-confirmation-required')
    const options = claimAdmin.parseRoleClaimArgs([
      ...baseArgs,
      '--execute',
      '--confirm', 'SET_ROLE_admin_IN_pet-1cb0b',
    ])
    expect(options).toMatchObject({ execute: true, verifyOnly: false })
  })
})

describe('set-user-role-claim — operación pura', () => {
  it('dry-run no escribe y describe únicamente role', async () => {
    const auth = adapter()
    const options = claimAdmin.parseRoleClaimArgs(baseArgs)
    const report = await claimAdmin.runRoleClaimOperation(auth, options)
    expect(auth.setCustomUserClaims).not.toHaveBeenCalled()
    expect(report).toMatchObject({
      mode: 'verify-only',
      status: 'preflight-passed',
      proposedChange: { field: 'role', from: null, to: 'admin', changed: true },
    })
    expect(JSON.stringify(report)).not.toMatch(/full-uid|customClaims|token/i)
  })

  it('preserva claims existentes al establecer admin', async () => {
    const auth = adapter(user({ customClaims: { capability: 'support', nested: { enabled: true } } }))
    auth.getUser.mockResolvedValue(user({ customClaims: { capability: 'support', nested: { enabled: true }, role: 'admin' } }))
    const options = claimAdmin.parseRoleClaimArgs([
      ...baseArgs, '--execute', '--confirm', 'SET_ROLE_admin_IN_pet-1cb0b',
    ])
    const report = await claimAdmin.runRoleClaimOperation(auth, options)
    expect(auth.setCustomUserClaims).toHaveBeenCalledWith('full-uid-must-never-be-printed', {
      capability: 'support', nested: { enabled: true }, role: 'admin',
    })
    expect(report).toMatchObject({ status: 'executed-and-verified', postVerified: true })
  })

  it('bloquea una cuenta deshabilitada antes de escribir', async () => {
    const auth = adapter(user({ disabled: true }))
    const options = claimAdmin.parseRoleClaimArgs(baseArgs)
    await expect(claimAdmin.runRoleClaimOperation(auth, options)).rejects.toMatchObject({ code: 'account-disabled', stage: 'preflight' })
    expect(auth.setCustomUserClaims).not.toHaveBeenCalled()
  })

  it('detecta cambio concurrente del rol antes de escribir', async () => {
    const auth = adapter(user({ customClaims: { role: 'customer' } }))
    const options = claimAdmin.parseRoleClaimArgs(baseArgs)
    await expect(claimAdmin.runRoleClaimOperation(auth, options)).rejects.toMatchObject({ code: 'current-role-changed' })
  })

  it('reporta fallo parcial si no puede verificar después de escribir', async () => {
    const auth = adapter()
    auth.getUser.mockRejectedValue(new Error('hidden provider message'))
    const options = claimAdmin.parseRoleClaimArgs([
      ...baseArgs, '--execute', '--confirm', 'SET_ROLE_admin_IN_pet-1cb0b',
    ])
    let caught: unknown
    try {
      await claimAdmin.runRoleClaimOperation(auth, options)
    } catch (error) {
      caught = error
    }
    const report = claimAdmin.safeFailure(caught, options)
    expect(report).toMatchObject({
      code: 'post-verification-read-failed',
      stage: 'post-verification',
      writeMayHaveOccurred: true,
    })
    expect(JSON.stringify(report)).not.toContain('hidden provider message')
  })

  it('falla si la post-verificación no conserva exactamente los claims', async () => {
    const auth = adapter()
    auth.getUser.mockResolvedValue(user({ customClaims: { role: 'admin', unexpected: true } }))
    const options = claimAdmin.parseRoleClaimArgs([
      ...baseArgs, '--execute', '--confirm', 'SET_ROLE_admin_IN_pet-1cb0b',
    ])
    await expect(claimAdmin.runRoleClaimOperation(auth, options)).rejects.toMatchObject({
      code: 'post-verification-mismatch',
      writeMayHaveOccurred: true,
    })
  })

  it('prepara rollback lógico retirando solo role y preservando los demás claims', async () => {
    const options = claimAdmin.parseRoleClaimArgs([
      '--email', 'ap9871888@gmail.com', '--project', 'pet-1cb0b',
      '--remove-role', '--expect-current-role', 'admin',
    ])
    const auth = adapter(user({ customClaims: { role: 'admin', capability: 'support' } }))
    const report = await claimAdmin.runRoleClaimOperation(auth, options)
    expect(report).toMatchObject({
      mode: 'verify-only',
      proposedChange: { field: 'role', from: 'admin', to: null, preservedClaimCount: 1 },
    })
    expect(auth.setCustomUserClaims).not.toHaveBeenCalled()
  })
})
