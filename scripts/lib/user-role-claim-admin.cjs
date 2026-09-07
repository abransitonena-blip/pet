/* global module, Buffer */
'use strict'

const ASSIGNABLE_ROLES = new Set(['admin'])
const KNOWN_ROLES = new Set(['customer', 'walker', 'supervisor', 'admin', 'client'])
const PROJECT_PATTERN = /^[a-z][a-z0-9-]{4,29}$/
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

class RoleClaimOperationError extends Error {
  constructor(code, stage, writeMayHaveOccurred = false) {
    super(code)
    this.name = 'RoleClaimOperationError'
    this.code = code
    this.stage = stage
    this.writeMayHaveOccurred = writeMayHaveOccurred
  }
}

function usage() {
  return [
    'Preflight:',
    '  node scripts/set-user-role-claim.mjs --email EMAIL --project PROJECT --role admin --expect-current-role absent --verify-only',
    'Ejecución (requiere autorización separada):',
    '  node scripts/set-user-role-claim.mjs --email EMAIL --project PROJECT --role admin --expect-current-role absent --execute --confirm SET_ROLE_admin_IN_PROJECT',
    'Rollback lógico (requiere autorización separada):',
    '  node scripts/set-user-role-claim.mjs --email EMAIL --project PROJECT --remove-role --expect-current-role admin --execute --confirm REMOVE_ROLE_admin_IN_PROJECT',
  ].join('\n')
}

function confirmationPhrase(options) {
  return options.removeRole
    ? `REMOVE_ROLE_admin_IN_${options.projectId}`
    : `SET_ROLE_${options.role}_IN_${options.projectId}`
}

function parseRoleClaimArgs(argv) {
  const options = {
    email: null,
    projectId: null,
    role: null,
    expectCurrentRole: null,
    removeRole: false,
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
    } else if (value === '--remove-role') options.removeRole = true
    else if (['--email', '--project', '--role', '--expect-current-role', '--confirm'].includes(value)) {
      const next = argv[index + 1]
      if (!next || next.startsWith('--')) throw new RoleClaimOperationError('missing-argument-value', 'arguments')
      if (value === '--email') options.email = next.trim().toLowerCase()
      if (value === '--project') options.projectId = next.trim()
      if (value === '--role') options.role = next.trim().toLowerCase()
      if (value === '--expect-current-role') options.expectCurrentRole = next.trim().toLowerCase()
      if (value === '--confirm') options.confirm = next
      index += 1
    } else {
      throw new RoleClaimOperationError('unknown-argument', 'arguments')
    }
  }

  if (options.help) return options
  if (!options.email || !EMAIL_PATTERN.test(options.email)) throw new RoleClaimOperationError('valid-email-required', 'arguments')
  if (!options.projectId || !PROJECT_PATTERN.test(options.projectId)) throw new RoleClaimOperationError('valid-project-required', 'arguments')
  if (options.removeRole === Boolean(options.role)) throw new RoleClaimOperationError('choose-set-or-remove-role', 'arguments')
  if (!options.removeRole && !ASSIGNABLE_ROLES.has(options.role)) throw new RoleClaimOperationError('role-not-allowed', 'arguments')
  if (!['absent', 'admin'].includes(options.expectCurrentRole)) throw new RoleClaimOperationError('expected-current-role-required', 'arguments')
  if (!options.removeRole && options.expectCurrentRole !== 'absent') throw new RoleClaimOperationError('set-requires-absent-role', 'arguments')
  if (options.removeRole && options.expectCurrentRole !== 'admin') throw new RoleClaimOperationError('remove-requires-admin-role', 'arguments')
  if (!options.execute && options.confirm) throw new RoleClaimOperationError('confirmation-without-execute', 'arguments')
  if (options.execute && options.confirm !== confirmationPhrase(options)) {
    throw new RoleClaimOperationError('explicit-confirmation-required', 'confirmation')
  }
  return options
}

function isJsonValue(value) {
  if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) return true
  if (Array.isArray(value)) return value.every(isJsonValue)
  if (typeof value === 'object') {
    const prototype = Object.getPrototypeOf(value)
    return (prototype === Object.prototype || prototype === null)
      && Object.values(value).every(isJsonValue)
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

function claimsEqual(left, right) {
  return JSON.stringify(sortedJson(left)) === JSON.stringify(sortedJson(right))
}

function maskEmail(email) {
  const [local, domain] = email.split('@')
  return `${local.slice(0, 1)}***@${domain}`
}

function createPlan(authUser, options) {
  if (!authUser || typeof authUser.uid !== 'string') throw new RoleClaimOperationError('auth-user-invalid', 'preflight')
  if (authUser.disabled) throw new RoleClaimOperationError('account-disabled', 'preflight')
  const previousClaims = authUser.customClaims == null ? {} : authUser.customClaims
  if (!isJsonValue(previousClaims) || Array.isArray(previousClaims)) {
    throw new RoleClaimOperationError('existing-claims-invalid', 'preflight')
  }
  const currentRole = typeof previousClaims.role === 'string' ? previousClaims.role : null
  if (currentRole && !KNOWN_ROLES.has(currentRole)) throw new RoleClaimOperationError('existing-role-unsupported', 'preflight')
  const expectedRole = options.expectCurrentRole === 'absent' ? null : options.expectCurrentRole
  if (currentRole !== expectedRole) throw new RoleClaimOperationError('current-role-changed', 'preflight')

  const nextClaims = { ...previousClaims }
  if (options.removeRole) delete nextClaims.role
  else nextClaims.role = options.role
  if (!isJsonValue(nextClaims) || Buffer.byteLength(JSON.stringify(nextClaims), 'utf8') > 1000) {
    throw new RoleClaimOperationError('resulting-claims-invalid', 'preflight')
  }

  return {
    uid: authUser.uid,
    previousClaims,
    nextClaims,
    currentRole,
    targetRole: options.removeRole ? null : options.role,
    changed: !claimsEqual(previousClaims, nextClaims),
    preservedClaimCount: Object.keys(previousClaims).filter((key) => key !== 'role').length,
    emailVerified: Boolean(authUser.emailVerified),
  }
}

function safeReport(options, plan, status, postVerified = false) {
  return {
    mode: options.execute ? 'execute' : 'verify-only',
    projectId: options.projectId,
    account: {
      emailMasked: maskEmail(options.email),
      disabled: false,
      emailVerified: plan.emailVerified,
    },
    proposedChange: {
      field: 'role',
      from: plan.currentRole,
      to: plan.targetRole,
      changed: plan.changed,
      preservedClaimCount: plan.preservedClaimCount,
    },
    status,
    postVerified,
  }
}

async function runRoleClaimOperation(adapter, options) {
  let authUser
  try {
    authUser = await adapter.getUserByEmail(options.email)
  } catch {
    throw new RoleClaimOperationError('auth-lookup-failed', 'preflight')
  }
  const plan = createPlan(authUser, options)
  if (!options.execute) return safeReport(options, plan, 'preflight-passed')
  if (!plan.changed) return safeReport(options, plan, 'already-consistent', true)

  try {
    await adapter.setCustomUserClaims(plan.uid, plan.nextClaims)
  } catch {
    throw new RoleClaimOperationError('claim-write-failed', 'write')
  }

  let verifiedUser
  try {
    verifiedUser = await adapter.getUser(plan.uid)
  } catch {
    throw new RoleClaimOperationError('post-verification-read-failed', 'post-verification', true)
  }
  const verifiedClaims = verifiedUser.customClaims == null ? {} : verifiedUser.customClaims
  if (!claimsEqual(verifiedClaims, plan.nextClaims)) {
    throw new RoleClaimOperationError('post-verification-mismatch', 'post-verification', true)
  }
  return safeReport(options, plan, 'executed-and-verified', true)
}

function safeFailure(error, options = {}) {
  const known = error instanceof RoleClaimOperationError
  return {
    mode: options.execute ? 'execute' : 'verify-only',
    projectId: typeof options.projectId === 'string' && PROJECT_PATTERN.test(options.projectId) ? options.projectId : null,
    account: { emailMasked: typeof options.email === 'string' && EMAIL_PATTERN.test(options.email) ? maskEmail(options.email) : null },
    status: 'blocked',
    code: known ? error.code : 'unknown-error',
    stage: known ? error.stage : 'unknown',
    writeMayHaveOccurred: known ? error.writeMayHaveOccurred : false,
  }
}

module.exports = {
  ASSIGNABLE_ROLES,
  RoleClaimOperationError,
  confirmationPhrase,
  createPlan,
  parseRoleClaimArgs,
  runRoleClaimOperation,
  safeFailure,
  usage,
}
