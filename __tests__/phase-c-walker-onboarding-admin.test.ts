import fs from 'node:fs'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const onboarding = require('../scripts/lib/walker-onboarding-admin.cjs') as {
  parseArgs: (argv: string[]) => Record<string, unknown>
  runOperation: (adapter: Record<string, jest.Mock>, options: Record<string, unknown>) => Promise<Record<string, unknown>>
  safeFailure: (error: unknown, options?: Record<string, unknown>) => Record<string, unknown>
}

export {}

const base = [
  '--email', 'walker@example.com', '--project', 'pet-1cb0b', '--name', 'Persona Paseadora',
  '--role', 'walker', '--auth-mode', 'existing', '--initial-status', 'active',
]
const uid = 'uid-completo-que-no-debe-aparecer'

function state(overrides: Record<string, unknown> = {}) {
  return {
    authUser: { uid, disabled: false, customClaims: {}, emailVerified: true },
    userMirror: null,
    walkerProfile: null,
    ...overrides,
  }
}

function adapter(initial = state()) {
  const final = state({
    authUser: { uid, disabled: false, customClaims: { role: 'walker' } },
    userMirror: { email: 'walker@example.com', name: 'Persona Paseadora', role: 'walker' },
    walkerProfile: { uid, email: 'walker@example.com', name: 'Persona Paseadora', status: 'active' },
  })
  return {
    inspect: jest.fn().mockResolvedValueOnce(initial).mockResolvedValue(final),
    createAuthUser: jest.fn(async () => ({ uid, disabled: false, customClaims: {} })),
    createDocumentsAtomically: jest.fn(async (input) => [
      ...(input.createUserMirror ? ['users'] : []),
      ...(input.createWalkerProfile ? ['walkerProfiles'] : []),
    ]),
    setCustomUserClaims: jest.fn(async () => undefined),
    deleteCreatedDocuments: jest.fn(async () => undefined),
    deleteCreatedAuthUser: jest.fn(async () => undefined),
  }
}

function executeArgs(extra: string[] = []) {
  return onboarding.parseArgs([...base, ...extra, '--execute', '--confirm', 'ONBOARD_WALKER_IN_pet-1cb0b'])
}

describe('alta local de paseador — argumentos seguros', () => {
  test('verify-only es predeterminado y no acepta un rol distinto', () => {
    expect(onboarding.parseArgs(base)).toMatchObject({ verifyOnly: true, execute: false, role: 'walker' })
    expect(() => onboarding.parseArgs(base.map((value) => value === 'walker' ? 'admin' : value))).toThrow('role-not-allowed')
  })

  test('execute requiere confirmación exacta', () => {
    expect(() => onboarding.parseArgs([...base, '--execute'])).toThrow('explicit-confirmation-required')
  })

  test('una cuenta nueva solo puede iniciar invited', () => {
    const args = base.map((value) => value === 'existing' ? 'create' : value)
    expect(() => onboarding.parseArgs(args)).toThrow('new-account-must-start-invited')
  })
})

describe('alta local de paseador — preflight e idempotencia', () => {
  test('dry-run no realiza escrituras', async () => {
    const api = adapter()
    const report = await onboarding.runOperation(api, onboarding.parseArgs(base))
    expect(report).toMatchObject({ mode: 'verify-only', status: 'preflight-passed' })
    expect(api.createAuthUser).not.toHaveBeenCalled()
    expect(api.createDocumentsAtomically).not.toHaveBeenCalled()
    expect(api.setCustomUserClaims).not.toHaveBeenCalled()
    expect(JSON.stringify(report)).not.toMatch(/uid-completo|password|customClaims|token/i)
  })

  test('correo nuevo prepara Auth y perfil invited sin crear nada', async () => {
    const args = onboarding.parseArgs([
      '--email', 'nuevo@example.com', '--project', 'pet-1cb0b', '--name', 'Nueva Persona',
      '--role', 'walker', '--auth-mode', 'create', '--initial-status', 'invited', '--verify-only',
    ])
    const api = adapter(state({ authUser: null }))
    const report = await onboarding.runOperation(api, args)
    expect(report).toMatchObject({
      status: 'preflight-passed',
      requested: { role: 'walker', authMode: 'create', profileStatus: 'invited' },
      changes: { authCreate: true, userMirrorCreate: true, walkerProfileCreate: true, roleClaimSet: true },
    })
    expect(api.createAuthUser).not.toHaveBeenCalled()
  })

  test('rechaza Auth existente en modo create y Auth ausente en modo existing', async () => {
    await expect(onboarding.runOperation(adapter(), onboarding.parseArgs(base.map((v) => v === 'existing' ? 'create' : v).map((v) => v === 'active' ? 'invited' : v))))
      .rejects.toMatchObject({ code: 'auth-user-already-exists' })
    await expect(onboarding.runOperation(adapter(state({ authUser: null })), onboarding.parseArgs(base)))
      .rejects.toMatchObject({ code: 'auth-user-not-found' })
  })

  test('rechaza claim incompatible, perfil incompatible y cuenta deshabilitada', async () => {
    await expect(onboarding.runOperation(adapter(state({ authUser: { uid, disabled: false, customClaims: { role: 'admin' } } })), onboarding.parseArgs(base)))
      .rejects.toMatchObject({ code: 'incompatible-existing-role' })
    await expect(onboarding.runOperation(adapter(state({ walkerProfile: { uid, email: 'other@example.com', name: 'Otro', status: 'active' } })), onboarding.parseArgs(base)))
      .rejects.toMatchObject({ code: 'incompatible-walker-profile' })
    await expect(onboarding.runOperation(adapter(state({ authUser: { uid, disabled: true, customClaims: {} } })), onboarding.parseArgs(base)))
      .rejects.toMatchObject({ code: 'account-disabled' })
  })

  test('acepta un perfil compatible preexistente sin sobrescribirlo', async () => {
    const api = adapter(state({
      authUser: { uid, disabled: false, customClaims: { role: 'walker' } },
      walkerProfile: { uid, email: 'walker@example.com', name: 'Persona Paseadora', status: 'active' },
    }))
    const report = await onboarding.runOperation(api, onboarding.parseArgs(base))
    expect(report).toMatchObject({
      changes: { userMirrorCreate: true, walkerProfileCreate: false, roleClaimSet: false },
    })
  })

  test('un reintento consistente no vuelve a escribir', async () => {
    const complete = state({
      authUser: { uid, disabled: false, customClaims: { role: 'walker', support: true } },
      userMirror: { email: 'walker@example.com', name: 'Persona Paseadora', role: 'walker' },
      walkerProfile: { uid, email: 'walker@example.com', name: 'Persona Paseadora', status: 'active' },
    })
    const api = adapter(complete)
    const report = await onboarding.runOperation(api, executeArgs())
    expect(report).toMatchObject({ status: 'already-consistent', postVerified: true })
    expect(api.createDocumentsAtomically).not.toHaveBeenCalled()
    expect(api.setCustomUserClaims).not.toHaveBeenCalled()
  })
})

describe('alta local de paseador — fallos compensables', () => {
  test('falla después de crear Auth y elimina únicamente la cuenta creada por la operación', async () => {
    const args = executeArgs(['--auth-mode', 'create', '--initial-status', 'invited'])
    const api = adapter(state({ authUser: null }))
    api.createDocumentsAtomically.mockRejectedValue(new Error('hidden'))
    await expect(onboarding.runOperation(api, args)).rejects.toMatchObject({ code: 'profile-write-failed', compensation: 'completed' })
    expect(api.deleteCreatedAuthUser).toHaveBeenCalledWith(uid)
  })

  test('preserva otros claims al asignar walker', async () => {
    const api = adapter(state({ authUser: { uid, disabled: false, customClaims: { support: true } } }))
    await onboarding.runOperation(api, executeArgs())
    expect(api.setCustomUserClaims).toHaveBeenCalledWith(uid, { support: true, role: 'walker' })
  })

  test('un fallo ambiguo al asignar claim exige verificación y no hace rollback ciego', async () => {
    const api = adapter()
    api.setCustomUserClaims.mockRejectedValue(new Error('hidden'))
    await expect(onboarding.runOperation(api, executeArgs())).rejects.toMatchObject({
      code: 'claim-write-failed', compensation: 'requires-separate-verification', writeMayHaveOccurred: true,
    })
    expect(api.deleteCreatedDocuments).not.toHaveBeenCalled()
    expect(api.deleteCreatedAuthUser).not.toHaveBeenCalled()
  })

  test('un fallo después del claim exige verificación separada y no hace rollback ciego', async () => {
    const api = adapter()
    api.inspect.mockReset().mockResolvedValueOnce(state()).mockRejectedValueOnce(new Error('hidden'))
    await expect(onboarding.runOperation(api, executeArgs())).rejects.toMatchObject({
      code: 'post-verification-read-failed', compensation: 'requires-separate-verification', writeMayHaveOccurred: true,
    })
    expect(api.deleteCreatedDocuments).not.toHaveBeenCalled()
  })
})

describe('acceso walker por asignación UID', () => {
  test('las reglas y pruebas de emulador cubren asignado, no asignado y consulta filtrada', () => {
    const rules = fs.readFileSync('firestore.rules', 'utf8')
    const emulatorTests = fs.readFileSync('__tests__/p04-firestore-rules.emulator.test.ts', 'utf8')
    expect(rules).toContain('function isAssignedWalker(walkerId)')
    expect(rules).toContain('walkerId == request.auth.uid')
    expect(emulatorTests).toContain("assertFails(getDoc(doc(walker, 'walkSessions', 'session-2')))" )
    expect(emulatorTests).toContain("where('walkerId', '==', 'walker-1')")
  })
})
