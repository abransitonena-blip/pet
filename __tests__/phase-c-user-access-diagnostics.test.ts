// eslint-disable-next-line @typescript-eslint/no-require-imports
const diagnostics = require('../scripts/lib/user-access-diagnostics.cjs') as {
  parseVerifyUserAccessArgs: (argv: string[]) => Record<string, unknown>
  classifySafeDiagnosticError: (error: unknown, context: Record<string, unknown>) => Record<string, unknown>
  buildSafeUserAccessReport: (report: Record<string, unknown>) => Record<string, unknown>
  buildUserAccessReport: (input: Record<string, unknown>) => {
    access: { status: string }
    authority: { status: string; role: string | null }
    discrepancies: Array<{ code: string }>
    auth: { customClaims: Record<string, unknown> }
  }
}

const authUser = {
  uid: 'uid-under-test',
  email: 'owner@example.test',
  emailVerified: true,
  disabled: false,
  customClaims: { role: 'admin' },
}

describe('verify-user-access — argumentos seguros', () => {
  it('es verify-only por defecto y exige un solo identificador', () => {
    expect(diagnostics.parseVerifyUserAccessArgs(['--email', 'OWNER@EXAMPLE.TEST'])).toMatchObject({
      email: 'owner@example.test',
      uid: null,
      verifyOnly: true,
    })
    expect(() => diagnostics.parseVerifyUserAccessArgs([])).toThrow('exactamente uno')
    expect(() => diagnostics.parseVerifyUserAccessArgs(['--uid', 'one', '--email', 'two@example.test'])).toThrow('exactamente uno')
  })

  it('rechaza cualquier solicitud de reparación', () => {
    expect(() => diagnostics.parseVerifyUserAccessArgs(['--uid', 'one', '--execute'])).toThrow('no está implementado')
    expect(() => diagnostics.parseVerifyUserAccessArgs(['--uid', 'one', '--repair'])).toThrow('no está implementado')
  })

  it('acepta debug-safe sin cambiar verify-only', () => {
    expect(diagnostics.parseVerifyUserAccessArgs(['--uid', 'one', '--debug-safe'])).toMatchObject({
      verifyOnly: true,
      debugSafe: true,
    })
  })
})

describe('verify-user-access — errores debug-safe', () => {
  const context = {
    stage: 'auth-lookup',
    service: 'firebase-auth',
    requestedProject: 'pet-1cb0b',
    identifierType: 'email',
  }

  const fixtures = [
    [{ code: 'auth/user-not-found' }, 'user-not-found', 'auth/user-not-found', null, false, false],
    [{ message: 'Could not load the default credentials' }, 'adc-discovery-error', null, null, false, false],
    [{ code: 'invalid_grant', message: 'credential expired' }, 'credential-refresh-error', 'invalid-grant', null, false, false],
    [{ code: 'SERVICE_DISABLED', message: 'API has not been used or is disabled' }, 'api-disabled-consumer-unknown', 'service-disabled', null, false, true],
    [{ code: 'PROJECT_NOT_FOUND', message: 'project not found' }, 'project-mismatch', 'project-not-found', null, false, false],
    [{ code: 'auth/insufficient-permission' }, 'auth-permission-denied', 'auth/insufficient-permission', null, true, false],
    [{ code: 'ETIMEDOUT' }, 'network-error', 'network-error', null, false, false],
    [{ response: { status: 401 } }, 'authorized-request-unauthenticated', 'http/401', 401, false, false],
    [{ response: { status: 403 } }, 'auth-permission-denied', 'http/403', 403, true, false],
    [{ code: 'IDENTITY_TOOLKIT_ERROR', message: 'Identity Toolkit request failed' }, 'identity-toolkit-error', 'identity-toolkit', null, false, false],
    [{ code: 'PERMISSION_DENIED', message: 'serviceusage.services.use denied' }, 'serviceusage-permission-denied', 'serviceusage.services.use', null, true, false],
  ] as const

  it.each(fixtures)('clasifica una fixture segura', (error, expectedCode, providerCode, httpStatus, permission, apiDisabled) => {
    expect(diagnostics.classifySafeDiagnosticError(error, context)).toMatchObject({
      stage: 'auth-lookup',
      service: 'firebase-auth',
      code: expectedCode,
      requestedProject: 'pet-1cb0b',
      identifierType: 'email',
      providerCode,
      httpStatus,
      credentialPhase: expectedCode === 'adc-discovery-error'
        ? 'discover'
        : expectedCode === 'credential-refresh-error'
          ? 'token-refresh'
          : 'authorized-request',
      isPermissionError: permission,
      isApiDisabledError: apiDisabled,
    })
  })

  it('distingue permisos de Firestore e inicialización de Admin', () => {
    expect(diagnostics.classifySafeDiagnosticError(
      { code: 7, message: 'PERMISSION_DENIED' },
      { ...context, stage: 'firestore-user', service: 'firestore' }
    )).toMatchObject({ code: 'firestore-permission-denied' })
    expect(diagnostics.classifySafeDiagnosticError(
      { message: 'unexpected' },
      { ...context, stage: 'admin-initialization', service: 'firebase-admin' }
    )).toMatchObject({ code: 'admin-initialization-error' })
  })

  it('no refleja mensajes, rutas, tokens, variables, headers o stacks', () => {
    const report = diagnostics.classifySafeDiagnosticError({
      message: 'token=secret /private/adc.json GOOGLE_APPLICATION_CREDENTIALS=value',
      headers: { authorization: 'Bearer secret' },
      stack: 'sensitive stack',
    }, context)
    const serialized = JSON.stringify(report)
    expect(Object.keys(report).sort()).toEqual([
      'apiActivationUrlPresent', 'causeDepth', 'code', 'consumerMatchesRequestedProject',
      'consumerSource', 'credentialPhase', 'disabledService',
      'errorClass', 'httpStatus', 'identifierType',
      'isApiDisabledError', 'isPermissionError', 'providerCode', 'providerReason',
      'quotaProjectDetected', 'recommendation', 'requestedProject', 'resourceProjectDetected',
      'service', 'stage',
    ])
    expect(serialized).not.toMatch(/secret|adc\.json|GOOGLE_APPLICATION_CREDENTIALS|authorization|sensitive stack/i)
    expect(report).toMatchObject({ code: 'unknown-error' })
  })

  it('recorre causas con límite, prefiere el código interno y no imprime causas', () => {
    const inner = Object.assign(new Error('serviceusage.services.use denied'), {
      code: 'PERMISSION_DENIED',
      response: { status: 403, headers: { authorization: 'hidden' } },
    })
    const outer = Object.assign(new Error('credential wrapper'), {
      code: 'app/invalid-credential',
      cause: inner,
    })
    const report = diagnostics.classifySafeDiagnosticError(outer, context)
    expect(report).toMatchObject({
      providerCode: 'serviceusage.services.use',
      httpStatus: 403,
      credentialPhase: 'authorized-request',
      causeDepth: 1,
      isPermissionError: true,
      errorClass: 'Error',
    })
    expect(JSON.stringify(report)).not.toContain('hidden')
    expect(report).not.toHaveProperty('cause')
  })

  it('extrae servicio, reason y presencia de activación desde campos estructurados', () => {
    const report = diagnostics.classifySafeDiagnosticError({
      code: 403,
      response: {
        status: 403,
        data: {
          error: {
            details: [{
              reason: 'SERVICE_DISABLED',
              metadata: {
                service: 'identitytoolkit.googleapis.com',
                activationUrl: 'https://console.example.invalid/path?token=hidden',
                consumer: 'projects/123456789',
              },
            }],
          },
        },
      },
    }, context)
    expect(report).toMatchObject({
      disabledService: 'identitytoolkit.googleapis.com',
      apiActivationUrlPresent: true,
      providerReason: 'SERVICE_DISABLED',
      consumerMatchesRequestedProject: null,
      consumerSource: 'error-structured',
    })
    const serialized = JSON.stringify(report)
    expect(serialized).not.toMatch(/123456789|console\.example|token=hidden|\/path/)
  })

  it('compara internamente un consumer estructurado con el project number solicitado', () => {
    const report = diagnostics.classifySafeDiagnosticError({
      code: 403,
      response: { data: { error: { details: [{
        reason: 'SERVICE_DISABLED',
        metadata: { consumer: 'projects/123456789012', service: 'identitytoolkit.googleapis.com' },
      }] } } },
    }, {
      ...context,
      requestedProjectNumber: '123456789012',
      resourceProjectId: 'pet-1cb0b',
      quotaProjectId: 'pet-1cb0b',
    })
    expect(report).toMatchObject({
      code: 'api-disabled-resource-project',
      consumerMatchesRequestedProject: true,
      consumerSource: 'error-structured',
      quotaProjectDetected: true,
      resourceProjectDetected: true,
    })
    expect(JSON.stringify(report)).not.toContain('123456789012')
  })

  it('detecta consumidor distinto mediante activation URL sin exponer identificadores', () => {
    const report = diagnostics.classifySafeDiagnosticError({
      message: 'SERVICE_DISABLED',
      errorInfo: { metadata: {
        activationUrl: 'https://console.developers.google.com/apis/api/identitytoolkit.googleapis.com/overview?project=987654321098',
      } },
    }, {
      ...context,
      requestedProjectNumber: '123456789012',
      resourceProjectId: 'pet-1cb0b',
    })
    expect(report).toMatchObject({
      code: 'api-disabled-consumer-project',
      consumerMatchesRequestedProject: false,
      consumerSource: 'activation-url',
      quotaProjectDetected: false,
      resourceProjectDetected: true,
    })
    expect(JSON.stringify(report)).not.toMatch(/987654321098|123456789012|activationUrl|console\.developers/)
  })

  it('mantiene consumidor desconocido cuando no hay identificador comparable', () => {
    const report = diagnostics.classifySafeDiagnosticError({
      reason: 'SERVICE_DISABLED',
      service: 'identitytoolkit.googleapis.com',
    }, context)
    expect(report).toMatchObject({
      code: 'api-disabled-consumer-unknown',
      consumerMatchesRequestedProject: null,
      consumerSource: 'unknown',
      quotaProjectDetected: false,
      resourceProjectDetected: false,
    })
  })

  it('como fallback conserva solo hostname y elimina ruta, query y datos vecinos', () => {
    const report = diagnostics.classifySafeDiagnosticError({
      message: 'Enable https://firestore.googleapis.com/v1/projects/987654321?token=hidden using activationUrl now',
    }, context)
    expect(report).toMatchObject({
      disabledService: 'firestore.googleapis.com',
      apiActivationUrlPresent: true,
    })
    const serialized = JSON.stringify(report)
    expect(serialized).not.toMatch(/v1\/projects|987654321|token=hidden|https:\/\//)
  })

  it('rechaza hosts externos y reasons fuera de allowlist', () => {
    const report = diagnostics.classifySafeDiagnosticError({
      reason: 'ATTACKER_CONTROLLED',
      service: 'evil.example.com',
      message: 'https://evil.example.com/path?token=hidden',
    }, context)
    expect(report).toMatchObject({
      disabledService: null,
      providerReason: null,
      apiActivationUrlPresent: false,
    })
    expect(JSON.stringify(report)).not.toMatch(/evil\.example|ATTACKER|token=hidden/)
  })

  it('abrevia el UID y omite correo, claims adicionales y mensajes completos en éxito', () => {
    const fullReport = diagnostics.buildUserAccessReport({
      authUser: { ...authUser, customClaims: { role: 'admin', department: 'ops' } },
      userMirror: { role: 'admin', status: 'active', privateNote: 'hidden' },
      walkerProfile: null,
      projectId: 'pet-1cb0b',
      lookup: { by: 'email', value: authUser.email },
    })
    const safeReport = diagnostics.buildSafeUserAccessReport(fullReport)
    const serialized = JSON.stringify(safeReport)
    expect(serialized).toContain('uid-…test')
    expect(serialized).not.toContain('uid-under-test')
    expect(serialized).not.toContain(authUser.email)
    expect(serialized).not.toContain('department')
    expect(serialized).not.toContain('privateNote')
  })
})

describe('verify-user-access — matriz de discrepancias', () => {
  it('un mirror admin nunca sustituye un claim ausente', () => {
    const report = diagnostics.buildUserAccessReport({
      authUser: { ...authUser, customClaims: {} },
      userMirror: { role: 'admin', status: 'active' },
      walkerProfile: null,
      lookup: { by: 'uid', value: authUser.uid },
    })
    expect(report.authority).toMatchObject({ status: 'missing', role: null })
    expect(report.access.status).toBe('blocked')
    expect(report.discrepancies.map((item) => item.code)).toEqual(expect.arrayContaining([
      'claim-missing',
      'mirror-without-authoritative-claim',
    ]))
  })

  it('bloquea un walker con claim válido pero sin perfil operativo', () => {
    const report = diagnostics.buildUserAccessReport({
      authUser: { ...authUser, customClaims: { role: 'walker' } },
      userMirror: { role: 'walker' },
      walkerProfile: null,
      lookup: { by: 'uid', value: authUser.uid },
    })
    expect(report.access.status).toBe('blocked')
    expect(report.discrepancies.map((item) => item.code)).toContain('walker-profile-missing')
  })

  it('reconoce un walker alineado y activo', () => {
    const report = diagnostics.buildUserAccessReport({
      authUser: { ...authUser, customClaims: { role: 'walker' } },
      userMirror: { role: 'walker' },
      walkerProfile: { status: 'active' },
      lookup: { by: 'uid', value: authUser.uid },
    })
    expect(report.access.status).toBe('consistent')
    expect(report.discrepancies).toEqual([])
  })

  it('bloquea una cuenta deshabilitada', () => {
    const report = diagnostics.buildUserAccessReport({
      authUser: { ...authUser, disabled: true },
      userMirror: { role: 'admin' },
      walkerProfile: null,
      lookup: { by: 'uid', value: authUser.uid },
    })
    expect(report.access.status).toBe('blocked')
    expect(report.discrepancies.map((item) => item.code)).toContain('auth-disabled')
  })

  it('filtra campos de claims con apariencia de secreto', () => {
    const report = diagnostics.buildUserAccessReport({
      authUser: { ...authUser, customClaims: { role: 'admin', accessToken: 'hidden', department: 'ops' } },
      userMirror: { role: 'admin' },
      walkerProfile: null,
      lookup: { by: 'uid', value: authUser.uid },
    })
    expect(report.auth.customClaims).toEqual({ role: 'admin', department: 'ops' })
  })
})
