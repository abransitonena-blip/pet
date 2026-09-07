/* global module */
'use strict'

const CANONICAL_ROLES = new Set(['customer', 'walker', 'supervisor', 'admin'])
const TEAM_ROLES = new Set(['walker', 'supervisor', 'admin'])

function usage() {
  return [
    'Uso:',
    '  node scripts/verify-user-access.mjs --email usuario@dominio --verify-only',
    '  node scripts/verify-user-access.mjs --uid UID --verify-only',
    '',
    'Opcional: --project PROJECT_ID --debug-safe',
    'Este comando nunca modifica Auth, claims ni Firestore.',
  ].join('\n')
}

function parseVerifyUserAccessArgs(argv) {
  const parsed = { email: null, uid: null, projectId: null, verifyOnly: true, debugSafe: false, help: false }
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index]
    if (value === '--help' || value === '-h') {
      parsed.help = true
    } else if (value === '--verify-only') {
      parsed.verifyOnly = true
    } else if (value === '--debug-safe') {
      parsed.debugSafe = true
    } else if (value === '--execute' || value === '--repair') {
      throw new Error('El modo de reparación no está implementado. Use únicamente --verify-only.')
    } else if (value === '--email' || value === '--uid' || value === '--project') {
      const next = argv[index + 1]
      if (!next || next.startsWith('--')) throw new Error(`Falta el valor de ${value}.`)
      if (value === '--email') parsed.email = next.trim().toLowerCase()
      if (value === '--uid') parsed.uid = next.trim()
      if (value === '--project') parsed.projectId = next.trim()
      index += 1
    } else {
      throw new Error(`Argumento no reconocido: ${value}`)
    }
  }

  if (!parsed.help && Number(Boolean(parsed.email)) + Number(Boolean(parsed.uid)) !== 1) {
    throw new Error('Indique exactamente uno de --email o --uid.')
  }
  return parsed
}

const SAFE_STAGES = new Set([
  'arguments',
  'admin-initialization',
  'auth-lookup',
  'firestore-user',
  'firestore-walker-profile',
])
const SAFE_SERVICES = new Set(['local', 'firebase-admin', 'firebase-auth', 'firestore'])
const SAFE_ERROR_CLASSES = new Set([
  'Error',
  'FirebaseAppError',
  'FirebaseAuthError',
  'GoogleAuthError',
  'GaxiosError',
  'FetchError',
  'TypeError',
  'AggregateError',
])
const SAFE_PROVIDER_REASONS = new Set([
  'SERVICE_DISABLED',
  'ACCESS_TOKEN_SCOPE_INSUFFICIENT',
  'CONSUMER_INVALID',
  'PERMISSION_DENIED',
  'SERVICE_NOT_FOUND',
  'API_KEY_INVALID',
])
const GOOGLE_API_HOST_PATTERN = /^[a-z0-9.-]+\.googleapis\.com$/

function errorChain(error) {
  const chain = []
  const seen = new Set()
  let current = error
  while (current && typeof current === 'object' && !seen.has(current) && chain.length < 9) {
    chain.push(current)
    seen.add(current)
    current = 'cause' in current ? current.cause : null
  }
  return chain
}

function normalizeProviderCode(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const normalized = String(value).trim().toLowerCase().replace(/_/g, '-')
  if (!normalized || normalized.length > 80 || !/^[a-z0-9./:-]+$/.test(normalized)) return null
  return normalized
}

function directProviderCodes(node) {
  const values = [
    node.code,
    node.status,
    node.reason,
    node.errorInfo?.code,
    node.response?.data?.error?.status,
    node.response?.data?.error?.errors?.[0]?.reason,
  ]
  return values.map(normalizeProviderCode).filter(Boolean)
}

function structuredErrorDetails(node) {
  const candidates = [
    node.errorInfo,
    node.metadata,
    node.response?.data?.error,
    ...(Array.isArray(node.details) ? node.details : []),
    ...(Array.isArray(node.response?.data?.error?.details) ? node.response.data.error.details : []),
  ]
  return candidates.filter((value) => value && typeof value === 'object')
}

function extractGoogleApiHostname(value) {
  if (typeof value !== 'string') return null
  const match = value.toLowerCase().match(/(?:^|[^a-z0-9.-])([a-z0-9.-]+\.googleapis\.com)(?=$|[^a-z0-9.-])/)
  const hostname = match?.[1] || null
  return hostname && GOOGLE_API_HOST_PATTERN.test(hostname) ? hostname : null
}

function extractDisabledService(chain, fingerprint) {
  for (const node of chain) {
    const details = structuredErrorDetails(node)
    const candidates = [
      node.service,
      node.serviceName,
      node.metadata?.service,
      node.errorInfo?.metadata?.service,
      ...details.flatMap((detail) => [detail.service, detail.serviceName, detail.metadata?.service]),
    ]
    for (const candidate of candidates) {
      const hostname = extractGoogleApiHostname(candidate)
      if (hostname) return hostname
    }
  }
  return extractGoogleApiHostname(fingerprint)
}

function normalizeProviderReason(value) {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toUpperCase().replace(/[-\s]+/g, '_')
  return SAFE_PROVIDER_REASONS.has(normalized) ? normalized : null
}

function extractProviderReason(chain, fingerprint) {
  for (const node of chain) {
    const details = structuredErrorDetails(node)
    const candidates = [
      node.reason,
      node.errorInfo?.reason,
      node.response?.data?.error?.status,
      ...details.flatMap((detail) => [detail.reason, detail.status, detail.metadata?.reason]),
    ]
    for (const candidate of candidates) {
      const reason = normalizeProviderReason(candidate)
      if (reason) return reason
    }
  }
  for (const reason of SAFE_PROVIDER_REASONS) {
    if (fingerprint.includes(reason.toLowerCase()) || fingerprint.includes(reason.toLowerCase().replace(/_/g, '-'))) return reason
  }
  return null
}

function hasActivationUrl(chain, fingerprint) {
  for (const node of chain) {
    const details = structuredErrorDetails(node)
    const candidates = [
      node.activationUrl,
      node.activation_url,
      node.metadata?.activationUrl,
      node.errorInfo?.metadata?.activationUrl,
      ...details.flatMap((detail) => [detail.activationUrl, detail.activation_url, detail.metadata?.activationUrl]),
    ]
    if (candidates.some((candidate) => typeof candidate === 'string' && candidate.length > 0)) return true
  }
  return /activation.?url|console\.developers\.google\.com\/apis\/api/.test(fingerprint)
}

function normalizeProjectIdentifier(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const normalized = String(value).trim().toLowerCase()
    .replace(/^\/\/cloudresourcemanager\.googleapis\.com\/projects\//, '')
    .replace(/^projects?[/:-]/, '')
  return /^(?:[a-z][a-z0-9-]{4,29}|[0-9]{6,30})$/.test(normalized) ? normalized : null
}

function activationUrls(chain) {
  const urls = []
  for (const node of chain) {
    const details = structuredErrorDetails(node)
    const candidates = [
      node.activationUrl,
      node.activation_url,
      node.metadata?.activationUrl,
      node.errorInfo?.metadata?.activationUrl,
      ...details.flatMap((detail) => [detail.activationUrl, detail.activation_url, detail.metadata?.activationUrl]),
    ]
    for (const candidate of candidates) {
      if (typeof candidate === 'string') urls.push(candidate)
    }
  }
  return urls
}

function consumerFromActivationUrl(value) {
  if (typeof value !== 'string') return null
  try {
    const url = new URL(value)
    const candidates = [
      url.searchParams.get('project'),
      url.searchParams.get('consumer'),
      url.pathname.match(/\/projects\/([^/]+)/)?.[1],
      url.pathname.match(/\/project\/([^/]+)/)?.[1],
    ]
    for (const candidate of candidates) {
      const identifier = normalizeProjectIdentifier(candidate)
      if (identifier) return identifier
    }
  } catch {
    return null
  }
  return null
}

function extractConsumer(chain, fingerprint) {
  for (const node of chain) {
    const details = structuredErrorDetails(node)
    const candidates = [
      node.consumer,
      node.consumerProject,
      node.metadata?.consumer,
      node.errorInfo?.metadata?.consumer,
      ...details.flatMap((detail) => [detail.consumer, detail.consumerProject, detail.metadata?.consumer]),
    ]
    for (const candidate of candidates) {
      const identifier = normalizeProjectIdentifier(candidate)
      if (identifier) return { identifier, source: 'error-structured' }
    }
  }
  for (const url of activationUrls(chain)) {
    const identifier = consumerFromActivationUrl(url)
    if (identifier) return { identifier, source: 'activation-url' }
  }
  const activationUrlMatch = fingerprint.match(/https?:\/\/[^\s]+/)
  const activationIdentifier = consumerFromActivationUrl(activationUrlMatch?.[0])
  if (activationIdentifier) return { identifier: activationIdentifier, source: 'activation-url' }
  const messageMatch = fingerprint.match(/(?:consumer|project)[/\s:=]+(projects?[/:-])?([a-z][a-z0-9-]{4,29}|[0-9]{6,30})(?=$|[^a-z0-9-])/)
  const messageIdentifier = normalizeProjectIdentifier(messageMatch?.[2])
  return messageIdentifier
    ? { identifier: messageIdentifier, source: 'message-sanitized' }
    : { identifier: null, source: 'unknown' }
}

function extractHttpStatus(chain) {
  for (const node of chain) {
    const candidates = [node.httpStatus, node.statusCode, node.response?.status]
    for (const candidate of candidates) {
      const status = Number(candidate)
      if (Number.isInteger(status) && status >= 100 && status <= 599) return status
    }
    if (typeof node.status === 'number' && node.status >= 100 && node.status <= 599) return node.status
  }
  return null
}

function knownCodeFromFingerprint(fingerprint) {
  if (/serviceusage\.services\.use/.test(fingerprint)) return 'serviceusage.services.use'
  if (/user-not-found/.test(fingerprint)) return 'auth/user-not-found'
  if (/insufficient.permission/.test(fingerprint)) return 'auth/insufficient-permission'
  if (/service-disabled|accessnotconfigured|api .*not.*enabled|has not been used/.test(fingerprint)) return 'service-disabled'
  if (/invalid-grant|invalid_grant/.test(fingerprint)) return 'invalid-grant'
  if (/identity.?toolkit/.test(fingerprint)) return 'identity-toolkit'
  if (/permission.denied/.test(fingerprint)) return 'permission-denied'
  if (/enotfound|eai-again|eai_again|econnreset|econnrefused|etimedout|fetch failed/.test(fingerprint)) return 'network-error'
  return null
}

function selectProviderCode(chain, fingerprint, httpStatus) {
  const codes = chain.flatMap(directProviderCodes)
  const meaningful = [...codes].reverse().find((code) => !['app/invalid-credential', 'error', 'unknown'].includes(code))
  return knownCodeFromFingerprint(fingerprint)
    || meaningful
    || (httpStatus ? `http/${httpStatus}` : null)
    || codes[0]
    || null
}

function safeErrorClass(chain) {
  for (const node of chain) {
    const candidates = [node.name, node.constructor?.name]
    const matched = candidates.find((candidate) => SAFE_ERROR_CLASSES.has(candidate))
    if (matched) return matched
  }
  return 'UnknownError'
}

function errorFingerprint(error) {
  return errorChain(error).map((node) => {
    const code = 'code' in node ? String(node.code) : ''
    const details = 'details' in node ? String(node.details) : ''
    const message = 'message' in node ? String(node.message) : ''
    return `${code} ${details} ${message}`
  }).join(' ').toLowerCase()
}

function safeContext(context) {
  const requestedProject = typeof context.requestedProject === 'string'
    && /^[a-z][a-z0-9-]{4,29}$/.test(context.requestedProject)
    ? context.requestedProject
    : null
  return {
    stage: SAFE_STAGES.has(context.stage) ? context.stage : 'arguments',
    service: SAFE_SERVICES.has(context.service) ? context.service : 'local',
    requestedProject,
    identifierType: context.identifierType === 'email' || context.identifierType === 'uid'
      ? context.identifierType
      : 'unknown',
  }
}

function classifySafeDiagnosticError(error, context) {
  const safe = safeContext(context)
  const chain = errorChain(error)
  const fingerprint = errorFingerprint(error)
  const httpStatus = extractHttpStatus(chain)
  const providerCode = selectProviderCode(chain, fingerprint, httpStatus)
  const disabledService = extractDisabledService(chain, fingerprint)
  const providerReason = extractProviderReason(chain, fingerprint)
  const apiActivationUrlPresent = hasActivationUrl(chain, fingerprint)
  const consumer = extractConsumer(chain, fingerprint)
  const requestedIdentifiers = new Set([
    normalizeProjectIdentifier(safe.requestedProject),
    normalizeProjectIdentifier(context.requestedProjectNumber),
  ].filter(Boolean))
  const consumerIsNumber = Boolean(consumer.identifier && /^[0-9]+$/.test(consumer.identifier))
  const requestedNumberKnown = Boolean(normalizeProjectIdentifier(context.requestedProjectNumber))
  const consumerMatchesRequestedProject = !consumer.identifier || requestedIdentifiers.size === 0
    ? null
    : consumerIsNumber && !requestedNumberKnown
      ? null
      : requestedIdentifiers.has(consumer.identifier)
  const quotaProjectDetected = Boolean(normalizeProjectIdentifier(context.quotaProjectId))
  const resourceProjectDetected = Boolean(
    normalizeProjectIdentifier(context.resourceProjectId)
    || normalizeProjectIdentifier(context.requestedProjectNumber)
  )
  const isApiDisabledError = providerReason === 'SERVICE_DISABLED'
    || /service-disabled|accessnotconfigured|api .*not.*enabled|has not been used|serviceusage.*disabled/.test(fingerprint)
  const isPermissionError = /permission.denied|insufficient.permission|forbidden|serviceusage\.services\.use/.test(fingerprint)
    || httpStatus === 403
  let code = 'unknown-error'
  let recommendation = 'Revisa la configuración local de solo lectura y vuelve a intentar sin compartir credenciales.'

  if (/user-not-found/.test(fingerprint)) {
    code = 'user-not-found'
    recommendation = 'Verifica el identificador en el proyecto solicitado.'
  } else if (isApiDisabledError) {
    code = consumerMatchesRequestedProject === true
      ? 'api-disabled-resource-project'
      : consumerMatchesRequestedProject === false
        ? 'api-disabled-consumer-project'
        : 'api-disabled-consumer-unknown'
    recommendation = consumerMatchesRequestedProject === true
      ? 'La respuesta señala al proyecto recurso solicitado; verifica allí el servicio indicado.'
      : consumerMatchesRequestedProject === false
        ? 'La respuesta señala a otro proyecto consumidor o de cuota; verifica su configuración sin cambiar el proyecto recurso.'
        : 'No fue posible relacionar el consumidor con el proyecto solicitado; no cambies APIs hasta identificarlo.'
  } else if (/serviceusage\.services\.use/.test(fingerprint) && isPermissionError) {
    code = 'serviceusage-permission-denied'
    recommendation = 'Permiso mínimo requerido sobre el proyecto de cuota: serviceusage.services.use. No concedas Owner ni Editor.'
  } else if (/project.*not found|invalid project|project[_ -]?id|requested entity was not found/.test(fingerprint)) {
    code = 'project-mismatch'
    recommendation = 'Confirma que el proyecto solicitado exista y sea exactamente el autorizado.'
  } else if (isPermissionError) {
    if (safe.service === 'firebase-auth') {
      code = 'auth-permission-denied'
      recommendation = 'Permiso mínimo requerido: firebaseauth.users.get. No concedas Owner ni Editor.'
    } else if (safe.service === 'firestore') {
      code = 'firestore-permission-denied'
      recommendation = 'Permiso mínimo requerido para estas lecturas directas: datastore.entities.get. No concedas Owner ni Editor.'
    } else {
      code = 'permission-denied'
      recommendation = 'Identifica y concede únicamente el permiso de lectura requerido; no concedas Owner ni Editor.'
    }
  } else if (httpStatus === 401) {
    code = 'authorized-request-unauthenticated'
    recommendation = 'La solicitud autorizada recibió HTTP 401; revisa el código del proveedor sin asumir que ADC está ausente.'
  } else if (/invalid_grant|reauth|expired|credential.*expir/.test(fingerprint)) {
    code = 'credential-refresh-error'
    recommendation = 'La credencial falló durante la renovación del token; revisa el código seguro del proveedor.'
  } else if (/default credential|application default credential|could not load.*credential/.test(fingerprint)) {
    code = 'adc-discovery-error'
    recommendation = 'ADC no pudo descubrirse o cargarse; comprueba la configuración local sin mostrar su ruta o contenido.'
  } else if (/enotfound|eai_again|econnreset|econnrefused|etimedout|network|fetch failed|(^|\s)14(\s|$)|unavailable/.test(fingerprint)) {
    code = 'network-error'
    recommendation = 'Comprueba conectividad y repite la consulta de solo lectura.'
  } else if (/identity.?toolkit/.test(fingerprint)) {
    code = 'identity-toolkit-error'
    recommendation = 'La solicitud a Identity Toolkit falló; revisa providerCode y httpStatus antes de cambiar ADC o IAM.'
  } else if (/app\/invalid-credential|invalid credential/.test(fingerprint)) {
    code = 'credential-request-error'
    recommendation = 'El wrapper de credencial falló durante la solicitud; usa providerCode, httpStatus y credentialPhase para identificar la causa interna.'
  } else if (safe.stage === 'admin-initialization') {
    code = 'admin-initialization-error'
    recommendation = 'Verifica ADC y el proyecto solicitado sin inspeccionar ni mover credenciales.'
  }

  const credentialPhase = /default credential|application default credential|could not load.*credential/.test(fingerprint)
    ? 'discover'
    : safe.stage === 'admin-initialization'
      ? 'load'
      : /invalid_grant|reauth|expired|credential.*expir/.test(fingerprint)
        ? 'token-refresh'
        : 'authorized-request'

  return {
    stage: safe.stage,
    service: safe.service,
    code,
    requestedProject: safe.requestedProject,
    identifierType: safe.identifierType,
    recommendation,
    providerCode,
    httpStatus,
    credentialPhase,
    errorClass: safeErrorClass(chain),
    causeDepth: Math.max(0, chain.length - 1),
    isPermissionError,
    isApiDisabledError,
    disabledService,
    apiActivationUrlPresent,
    providerReason,
    consumerMatchesRequestedProject,
    consumerSource: consumer.source,
    quotaProjectDetected,
    resourceProjectDetected,
  }
}

function abbreviateUid(uid) {
  if (typeof uid !== 'string' || uid.length < 9) return null
  return `${uid.slice(0, 4)}…${uid.slice(-4)}`
}

function buildSafeUserAccessReport(report) {
  return {
    mode: 'verify-only',
    projectId: typeof report.projectId === 'string' && /^[a-z][a-z0-9-]{4,29}$/.test(report.projectId)
      ? report.projectId
      : null,
    identifierType: report.lookup?.by === 'email' ? 'email' : report.lookup?.by === 'uid' ? 'uid' : 'unknown',
    auth: {
      uidAbbreviated: abbreviateUid(report.auth?.uid),
      exists: true,
      disabled: Boolean(report.auth?.disabled),
      emailVerified: Boolean(report.auth?.emailVerified),
    },
    claim: {
      role: report.authority?.rawRole || null,
      status: report.authority?.claimStatus || report.authority?.status || 'unknown',
    },
    mirror: report.mirrors?.user || { exists: false },
    walkerProfile: report.mirrors?.walkerProfile || { exists: false },
    access: report.access,
    expectedNavigation: report.expectedNavigation,
    discrepancies: Array.isArray(report.discrepancies)
      ? report.discrepancies.map(({ severity, code }) => ({ severity, code }))
      : [],
  }
}

function resolveClaimRole(value) {
  if (CANONICAL_ROLES.has(value)) return { role: value, status: 'valid', rawRole: value }
  if (value === 'client') return { role: 'customer', status: 'legacy', rawRole: value }
  if (value === undefined || value === null || value === '') return { role: null, status: 'missing', rawRole: null }
  return { role: null, status: 'unsupported', rawRole: String(value) }
}

function safeCustomClaims(claims) {
  if (!claims || typeof claims !== 'object') return {}
  return Object.fromEntries(Object.entries(claims).filter(([key, value]) => {
    if (/token|secret|password|private|credential/i.test(key)) return false
    return value === null || ['string', 'number', 'boolean'].includes(typeof value)
  }))
}

function buildUserAccessReport({ authUser, userMirror, walkerProfile, projectId = null, lookup }) {
  const claims = safeCustomClaims(authUser.customClaims)
  const claim = resolveClaimRole(claims.role)
  const mirrorRole = userMirror && typeof userMirror.role === 'string' ? userMirror.role : null
  const discrepancies = []

  if (authUser.disabled) {
    discrepancies.push({ severity: 'blocker', code: 'auth-disabled', message: 'La cuenta está deshabilitada en Firebase Authentication.' })
  }
  if (claim.status === 'missing') {
    discrepancies.push({ severity: 'blocker', code: 'claim-missing', message: 'El token no contiene un claim de rol explícito.' })
  } else if (claim.status === 'unsupported') {
    discrepancies.push({ severity: 'blocker', code: 'claim-unsupported', message: 'El claim de rol no pertenece a la matriz canónica.' })
  } else if (claim.status === 'legacy') {
    discrepancies.push({ severity: 'warning', code: 'claim-legacy', message: 'El claim legacy client se interpreta como customer durante la transición.' })
  }
  if (!userMirror) {
    discrepancies.push({ severity: 'warning', code: 'user-mirror-missing', message: 'No existe el mirror users/{uid}; no se utiliza como autoridad.' })
  } else if (mirrorRole && claim.role && mirrorRole !== claim.role && !(mirrorRole === 'client' && claim.role === 'customer')) {
    discrepancies.push({ severity: 'warning', code: 'mirror-role-mismatch', message: 'users.role contradice el claim; el claim conserva la autoridad.' })
  } else if (mirrorRole && !claim.role) {
    discrepancies.push({ severity: 'warning', code: 'mirror-without-authoritative-claim', message: 'users.role existe, pero no concede acceso sin un claim válido.' })
  }

  if (claim.role === 'walker') {
    if (!walkerProfile) {
      discrepancies.push({ severity: 'blocker', code: 'walker-profile-missing', message: 'Falta walkerProfiles/{uid}.' })
    } else if (walkerProfile.status !== 'active') {
      discrepancies.push({ severity: 'blocker', code: 'walker-profile-inactive', message: 'El perfil de paseador no está activo.' })
    }
  }

  const blocked = discrepancies.some((item) => item.severity === 'blocker')
  const entry = claim.role === 'customer' ? '/login' : TEAM_ROLES.has(claim.role) ? '/equipo' : null
  const home = claim.role === 'customer' ? '/familia' : claim.role === 'walker' ? '/walker' : TEAM_ROLES.has(claim.role) ? '/admin' : null

  return {
    mode: 'verify-only',
    lookup,
    projectId,
    auth: {
      uid: authUser.uid,
      email: authUser.email || null,
      emailVerified: Boolean(authUser.emailVerified),
      disabled: Boolean(authUser.disabled),
      customClaims: claims,
    },
    authority: { source: 'firebase-auth-custom-claims', ...claim },
    mirrors: {
      user: userMirror ? { exists: true, role: mirrorRole, status: userMirror.status || null } : { exists: false },
      walkerProfile: walkerProfile ? { exists: true, status: walkerProfile.status || null } : { exists: false },
    },
    expectedNavigation: { entry, home },
    access: { status: blocked ? 'blocked' : 'consistent' },
    discrepancies,
  }
}

module.exports = {
  buildSafeUserAccessReport,
  buildUserAccessReport,
  classifySafeDiagnosticError,
  parseVerifyUserAccessArgs,
  resolveClaimRole,
  safeCustomClaims,
  usage,
}
