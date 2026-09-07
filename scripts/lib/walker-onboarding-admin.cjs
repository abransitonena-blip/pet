/* global module, Buffer */
'use strict'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PROJECT_PATTERN = /^[a-z][a-z0-9-]{4,29}$/
const ALLOWED_ROLES = new Set(['walker'])
const KNOWN_ROLES = new Set(['customer', 'client', 'walker', 'supervisor', 'admin'])
const AUTH_MODES = new Set(['existing', 'create'])
const PROFILE_STATUSES = new Set(['invited', 'active'])

class WalkerOnboardingError extends Error {
  constructor(code, stage, writeMayHaveOccurred = false, compensation = 'not-needed') {
    super(code)
    this.name = 'WalkerOnboardingError'
    this.code = code
    this.stage = stage
    this.writeMayHaveOccurred = writeMayHaveOccurred
    this.compensation = compensation
  }
}

function usage() {
  return [
    'Preflight (predeterminado):',
    '  node scripts/onboard-walker.mjs --email EMAIL --project PROJECT --name NAME --role walker --auth-mode existing --initial-status active --verify-only',
    'Ejecución (requiere autorización separada):',
    '  node scripts/onboard-walker.mjs --email EMAIL --project PROJECT --name NAME --role walker --auth-mode existing --initial-status active --execute --confirm ONBOARD_WALKER_IN_PROJECT',
    'Para una cuenta Auth nueva use --auth-mode create --initial-status invited. El script no crea, recibe ni imprime contraseñas.',
  ].join('\n')
}

function confirmationPhrase(options) {
  return `ONBOARD_WALKER_IN_${options.projectId}`
}

function parseArgs(argv) {
  const options = {
    email: null,
    projectId: null,
    name: null,
    role: null,
    authMode: null,
    initialStatus: null,
    execute: false,
    verifyOnly: true,
    confirm: null,
    help: false,
  }
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index]
    if (value === '--help' || value === '-h') options.help = true
    else if (value === '--verify-only') options.verifyOnly = true
    else if (value === '--execute') {
      options.execute = true
      options.verifyOnly = false
    } else if (['--email', '--project', '--name', '--role', '--auth-mode', '--initial-status', '--confirm'].includes(value)) {
      const next = argv[index + 1]
      if (!next || next.startsWith('--')) throw new WalkerOnboardingError('missing-argument-value', 'arguments')
      if (value === '--email') options.email = next.trim().toLowerCase()
      if (value === '--project') options.projectId = next.trim()
      if (value === '--name') options.name = next.trim().replace(/\s+/g, ' ')
      if (value === '--role') options.role = next.trim().toLowerCase()
      if (value === '--auth-mode') options.authMode = next.trim().toLowerCase()
      if (value === '--initial-status') options.initialStatus = next.trim().toLowerCase()
      if (value === '--confirm') options.confirm = next
      index += 1
    } else {
      throw new WalkerOnboardingError('unknown-argument', 'arguments')
    }
  }

  if (options.help) return options
  if (!options.email || !EMAIL_PATTERN.test(options.email)) throw new WalkerOnboardingError('valid-email-required', 'arguments')
  if (!options.projectId || !PROJECT_PATTERN.test(options.projectId)) throw new WalkerOnboardingError('valid-project-required', 'arguments')
  if (!options.name || options.name.length < 2 || options.name.length > 100) throw new WalkerOnboardingError('valid-name-required', 'arguments')
  if (!ALLOWED_ROLES.has(options.role)) throw new WalkerOnboardingError('role-not-allowed', 'arguments')
  if (!AUTH_MODES.has(options.authMode)) throw new WalkerOnboardingError('auth-mode-required', 'arguments')
  if (!PROFILE_STATUSES.has(options.initialStatus)) throw new WalkerOnboardingError('initial-status-required', 'arguments')
  if (options.authMode === 'create' && options.initialStatus !== 'invited') {
    throw new WalkerOnboardingError('new-account-must-start-invited', 'arguments')
  }
  if (!options.execute && options.confirm) throw new WalkerOnboardingError('confirmation-without-execute', 'arguments')
  if (options.execute && options.confirm !== confirmationPhrase(options)) {
    throw new WalkerOnboardingError('explicit-confirmation-required', 'confirmation')
  }
  return options
}

function isJsonValue(value) {
  if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) return true
  if (Array.isArray(value)) return value.every(isJsonValue)
  if (typeof value === 'object') {
    const prototype = Object.getPrototypeOf(value)
    return (prototype === Object.prototype || prototype === null) && Object.values(value).every(isJsonValue)
  }
  return false
}

function sortedJson(value) {
  if (Array.isArray(value)) return value.map(sortedJson)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortedJson(value[key])]))
  }
  return value
}

function valuesEqual(left, right) {
  return JSON.stringify(sortedJson(left)) === JSON.stringify(sortedJson(right))
}

function maskEmail(email) {
  const [local, domain] = email.split('@')
  return `${local.slice(0, 1)}***@${domain}`
}

function validateClaims(authUser) {
  const claims = authUser.customClaims == null ? {} : authUser.customClaims
  if (!isJsonValue(claims) || Array.isArray(claims)) throw new WalkerOnboardingError('existing-claims-invalid', 'preflight')
  const currentRole = typeof claims.role === 'string' ? claims.role : null
  if (currentRole && !KNOWN_ROLES.has(currentRole)) throw new WalkerOnboardingError('existing-role-unsupported', 'preflight')
  if (currentRole && currentRole !== 'walker') throw new WalkerOnboardingError('incompatible-existing-role', 'preflight')
  const nextClaims = { ...claims, role: 'walker' }
  if (Buffer.byteLength(JSON.stringify(nextClaims), 'utf8') > 1000) {
    throw new WalkerOnboardingError('resulting-claims-too-large', 'preflight')
  }
  return { currentRole, previousClaims: claims, nextClaims }
}

function validateExistingDocuments(state, options) {
  const expected = { email: options.email, name: options.name }
  if (state.userMirror) {
    if (state.userMirror.email !== expected.email || state.userMirror.name !== expected.name || state.userMirror.role !== 'walker') {
      throw new WalkerOnboardingError('incompatible-user-mirror', 'preflight')
    }
  }
  if (state.walkerProfile) {
    if (state.walkerProfile.email !== expected.email || state.walkerProfile.name !== expected.name
      || state.walkerProfile.status !== options.initialStatus || state.walkerProfile.uid !== state.authUser.uid) {
      throw new WalkerOnboardingError('incompatible-walker-profile', 'preflight')
    }
  }
}

function createPlan(state, options) {
  if (options.authMode === 'create' && state.authUser) throw new WalkerOnboardingError('auth-user-already-exists', 'preflight')
  if (options.authMode === 'existing' && !state.authUser) throw new WalkerOnboardingError('auth-user-not-found', 'preflight')

  if (!state.authUser) {
    return {
      createAuth: true,
      createUserMirror: true,
      createWalkerProfile: true,
      changeClaim: true,
      currentRole: null,
      previousClaims: {},
      nextClaims: { role: 'walker' },
      alreadyConsistent: false,
    }
  }
  if (state.authUser.disabled) throw new WalkerOnboardingError('account-disabled', 'preflight')
  const claimPlan = validateClaims(state.authUser)
  validateExistingDocuments(state, options)
  const createUserMirror = !state.userMirror
  const createWalkerProfile = !state.walkerProfile
  const changeClaim = claimPlan.currentRole !== 'walker'
  return {
    createAuth: false,
    createUserMirror,
    createWalkerProfile,
    changeClaim,
    ...claimPlan,
    alreadyConsistent: !createUserMirror && !createWalkerProfile && !changeClaim,
  }
}

function safeReport(options, plan, status, postVerified = false) {
  return {
    mode: options.execute ? 'execute' : 'verify-only',
    projectId: options.projectId,
    account: { emailMasked: maskEmail(options.email) },
    requested: { role: 'walker', authMode: options.authMode, profileStatus: options.initialStatus },
    changes: {
      authCreate: plan.createAuth,
      userMirrorCreate: plan.createUserMirror,
      walkerProfileCreate: plan.createWalkerProfile,
      roleClaimSet: plan.changeClaim,
      preservedClaimCount: Object.keys(plan.previousClaims || {}).filter((key) => key !== 'role').length,
    },
    status,
    postVerified,
  }
}

function verifyFinalState(state, options) {
  if (!state.authUser || state.authUser.disabled || state.authUser.customClaims?.role !== 'walker') return false
  if (!state.userMirror || state.userMirror.role !== 'walker' || state.userMirror.email !== options.email || state.userMirror.name !== options.name) return false
  return Boolean(state.walkerProfile
    && state.walkerProfile.uid === state.authUser.uid
    && state.walkerProfile.email === options.email
    && state.walkerProfile.name === options.name
    && state.walkerProfile.status === options.initialStatus)
}

async function compensate(adapter, context) {
  try {
    if (context.createdDocuments.length) await adapter.deleteCreatedDocuments(context.uid, context.createdDocuments)
    if (context.createdAuth) await adapter.deleteCreatedAuthUser(context.uid)
    return 'completed'
  } catch {
    return 'incomplete'
  }
}

async function runOperation(adapter, options) {
  let initialState
  try {
    initialState = await adapter.inspect(options.email)
  } catch {
    throw new WalkerOnboardingError('preflight-read-failed', 'preflight')
  }
  const plan = createPlan(initialState, options)
  if (!options.execute) return safeReport(options, plan, 'preflight-passed')
  if (plan.alreadyConsistent) return safeReport(options, plan, 'already-consistent', true)

  const context = { createdAuth: false, createdDocuments: [], uid: initialState.authUser?.uid || null }
  let authUser = initialState.authUser
  if (plan.createAuth) {
    try {
      authUser = await adapter.createAuthUser({ email: options.email, displayName: options.name })
      context.uid = authUser.uid
      context.createdAuth = true
    } catch {
      throw new WalkerOnboardingError('auth-create-failed', 'auth-create')
    }
  }

  try {
    context.createdDocuments = await adapter.createDocumentsAtomically({
      uid: authUser.uid,
      email: options.email,
      name: options.name,
      status: options.initialStatus,
      createUserMirror: plan.createUserMirror,
      createWalkerProfile: plan.createWalkerProfile,
    })
  } catch {
    const compensation = await compensate(adapter, context)
    throw new WalkerOnboardingError('profile-write-failed', 'firestore-write', context.createdAuth, compensation)
  }

  if (plan.changeClaim) {
    try {
      await adapter.setCustomUserClaims(authUser.uid, plan.nextClaims)
    } catch {
      // A transport error cannot prove that Firebase rejected the claim write.
      // Keep the compatible profile documents so a verify-only retry can
      // determine the real state; never perform a blind privilege rollback.
      throw new WalkerOnboardingError('claim-write-failed', 'claim-write', true, 'requires-separate-verification')
    }
  }

  let finalState
  try {
    finalState = await adapter.inspect(options.email)
  } catch {
    throw new WalkerOnboardingError('post-verification-read-failed', 'post-verification', true, 'requires-separate-verification')
  }
  if (!verifyFinalState(finalState, options)) {
    throw new WalkerOnboardingError('post-verification-mismatch', 'post-verification', true, 'requires-separate-verification')
  }
  return safeReport(options, plan, 'executed-and-verified', true)
}

function safeFailure(error, options = {}) {
  const known = error instanceof WalkerOnboardingError
  return {
    mode: options.execute ? 'execute' : 'verify-only',
    projectId: typeof options.projectId === 'string' && PROJECT_PATTERN.test(options.projectId) ? options.projectId : null,
    account: { emailMasked: typeof options.email === 'string' && EMAIL_PATTERN.test(options.email) ? maskEmail(options.email) : null },
    status: 'blocked',
    code: known ? error.code : 'unknown-error',
    stage: known ? error.stage : 'unknown',
    writeMayHaveOccurred: known ? error.writeMayHaveOccurred : false,
    compensation: known ? error.compensation : 'unknown',
  }
}

module.exports = {
  WalkerOnboardingError,
  confirmationPhrase,
  createPlan,
  parseArgs,
  runOperation,
  safeFailure,
  usage,
  verifyFinalState,
  valuesEqual,
}
